export const dynamic = "force-dynamic";
﻿import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";
import crypto from "crypto";
import QRCode from "qrcode";

export async function GET() {
  const data = readData();
  
  // Pre-build washing transfer lookup per poId
  const washingByPo: Record<string, any[]> = {};
  for (const t of (data.produksi_transfers || [])) {
    if (t.ke === "washing") {
      const key = String(t.po_id);
      if (!washingByPo[key]) washingByPo[key] = [];
      washingByPo[key].push(t);
    }
  }

  // Calculate saldo for each PO
  const poList = data.po_produksi.map((po: any) => {
    const pengambilans = data.po_pengambilan.filter((p: any) => p.poId === po.id);
    const totalDiambil = pengambilans.reduce((sum: number, p: any) => sum + p.jumlahDiambil, 0);
    const sisa = po.jumlahTerbit - totalDiambil;

    // CMT progress
    const progresRecords = (data.cmt_progres || []).filter((p: any) => p.po_id === po.id);
    const approvedRecords = progresRecords.filter((p: any) => p.status === "Diverifikasi" || p.status === "Diterima");
    const pendingRecords = progresRecords.filter((p: any) => p.status === "Menunggu" || p.status === "Pending");

    const sizeProgress: Record<string, number> = {};
    const sizePending: Record<string, number> = {};
    for (const rec of approvedRecords) {
      for (const item of (rec.items || [])) {
        sizeProgress[item.size] = (sizeProgress[item.size] || 0) + Number(item.jumlah || 0);
      }
    }
    for (const rec of pendingRecords) {
      for (const item of (rec.items || [])) {
        sizePending[item.size] = (sizePending[item.size] || 0) + Number(item.jumlah || 0);
      }
    }

    const totalDilaporkan = [...approvedRecords, ...pendingRecords]
      .reduce((sum: number, rec: any) => sum + (rec.items || []).reduce((s2: number, i: any) => s2 + Number(i.jumlah || 0), 0), 0);
    const totalDisetujui = approvedRecords
      .reduce((sum: number, rec: any) => sum + (rec.items || []).reduce((s2: number, i: any) => s2 + Number(i.jumlah || 0), 0), 0);
    const pctCmt = po.jumlahTerbit > 0 ? Math.round((totalDilaporkan / po.jumlahTerbit) * 100) : 0;
    const pctDisetujui = po.jumlahTerbit > 0 ? Math.round((totalDisetujui / po.jumlahTerbit) * 100) : 0;

    // Washing progress
    const washingRecords = washingByPo[String(po.id)] || [];
    const washingKirim = washingRecords.reduce((sum: number, t: any) => sum + (t.jumlah_kirim || 0), 0);
    const washingACC = washingRecords
      .filter((t: any) => t.status === "Diverifikasi")
      .reduce((sum: number, t: any) => sum + (t.jumlah_diterima || t.jumlah_kirim || 0), 0);
    const washingProses = washingKirim - washingACC; // still in washing
    const pctWashing = po.jumlahTerbit > 0 ? Math.round((washingKirim / po.jumlahTerbit) * 100) : 0;
    const pctWashingACC = po.jumlahTerbit > 0 ? Math.round((washingACC / po.jumlahTerbit) * 100) : 0;

    // Current stage determination
    let currentStage = "cmt";
    if (washingACC > 0) currentStage = "selesai_washing";
    else if (washingKirim > 0) currentStage = "washing";
    else if (totalDisetujui > 0) currentStage = "siap_tarik";
    else if (totalDilaporkan > 0) currentStage = "dilaporkan";

    return {
      ...po,
      totalDiambil,
      sisa,
      sizeProgress,
      sizePending,
      totalDilaporkan,
      totalDisetujui,
      pctCmt,
      pctDisetujui,
      // Washing
      washingKirim,
      washingACC,
      washingProses,
      pctWashing,
      pctWashingACC,
      currentStage,
      status: sisa <= 0 ? "Closed" : po.status
    };
  }).reverse();

  return NextResponse.json(poList);
}

export async function POST(req: NextRequest) {
  const data = readData();
  const body = await req.json();
  const { pemotonganId, sizeBreakdown, jumlahTerbit, vendorId, catatan } = body;
  
  if (!pemotonganId || !jumlahTerbit || !vendorId || !sizeBreakdown?.length) {
    return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
  }

  // 1. Cari data Pemotongan
  console.log("POST /api/po-produksi", { pemotonganId, receivedBody: body, pemotongan_kain: data.pemotongan_kain.map((x:any)=>x.id) });
  const pemotonganIndex = data.pemotongan_kain.findIndex((p:any) => String(p.id) === String(pemotonganId));
  if (pemotonganIndex === -1) return NextResponse.json({ error: `Stok potongan tidak ditemukan (ID: ${pemotonganId})` }, { status: 404 });
  const pemotongan = data.pemotongan_kain[pemotonganIndex];

  // 2. Cari kode Tukang Potong untuk prefix No PO
  const tukangPotong = data.tukang_potong.find((t:any) => t.id === pemotongan.tukang_potong_id);
  const prefix = tukangPotong ? tukangPotong.kode : "PO";

  // 3. Generate No PO (e.g. GH-01)
  const existingPOs = data.po_produksi.filter((p:any) => p.noPo.startsWith(prefix + "-"));
  const sequence = existingPOs.length + 1;
  const noPo = `${prefix}-${String(sequence).padStart(2, '0')}`;

  const now = new Date().toISOString();
  const poId = nextId(data, "po_produksi");

  // 4. Kurangi stok sisa di Pemotongan
  for (const requestedSize of sizeBreakdown) {
    const sIndex = pemotongan.sizeBreakdown.findIndex((s:any) => s.size === requestedSize.size);
    if (sIndex !== -1) {
      if (pemotongan.sizeBreakdown[sIndex].sisa < requestedSize.jumlah) {
        return NextResponse.json({ error: `Stok size ${requestedSize.size} tidak mencukupi` }, { status: 400 });
      }
      pemotongan.sizeBreakdown[sIndex].sisa -= requestedSize.jumlah;
    }
  }

  const newPo = {
    id: poId,
    noPo,
    model: pemotongan.model,
    pemotongan_id: pemotongan.id,
    sizeBreakdown, // e.g. [{ size: 'M', jumlah: 100 }]
    jumlahTerbit: Number(jumlahTerbit),
    vendorId: Number(vendorId),
    status: "Open",
    catatan: catatan || "",
    target_selesai: body.target_selesai || null,
    tanggalTerbit: now
  };

  
  data.po_produksi.push(newPo);

  // Safely initialize arrays if they don't exist yet in the JSON
  if (!data.po_ledgers) data.po_ledgers = [];
  if (!data.barcode_item) data.barcode_item = [];

  // Catat transaksi awal di Ledger
  data.po_ledgers.push({
    id: nextId(data, "po_ledgers"),
    poId,
    dari: "SISTEM",
    ke_vendor_id: Number(vendorId),
    jumlah: Number(jumlahTerbit),
    tanggal: now,
    catatan: "Penerbitan PO Awal"
  });

  // Generate barcodes per item
  for (const sizeItem of sizeBreakdown) {
    for (let i = 0; i < sizeItem.jumlah; i++) {
      const barcodeId = nextId(data, "barcode_item");
      const kodeBarcode = `${noPo}-${sizeItem.size}-${String(i + 1).padStart(3, '0')}`;
      
      // Generate QR base64
      const qrData = await QRCode.toDataURL(kodeBarcode);

      data.barcode_item.push({
        id: barcodeId,
        poId,
        kodeBarcode,
        size: sizeItem.size,
        qrCode: qrData,
        status: "potong",
        createdAt: now
      });
    }
  }

  writeData(data);
  return NextResponse.json(newPo);
}
