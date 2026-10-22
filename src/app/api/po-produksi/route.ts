export const dynamic = "force-dynamic";
﻿import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";
import { getCmtCompletion, cmtReports } from "@/lib/po-lifecycle";
import { vendorStageSummary } from "@/lib/stock";
import crypto from "crypto";
import QRCode from "qrcode";

export async function GET() {
  const data = readData();
  
  // (Washing dihitung via vendorStageSummary — transfer vendor riil, tahap via resolver bersama)

  // Calculate saldo for each PO
  const poList = data.po_produksi.map((po: any) => {
    // Hanya laporan CMT pemegang PO (laporan washing/vendor lanjutan tidak dihitung sebagai jahit)
    const myCmtReports = cmtReports(data, po);
    const cmtReportIds = new Set(myCmtReports.map((r: any) => r.id));
    const pengambilans = data.po_pengambilan.filter((p: any) =>
      p.poId === po.id && (p.laporanId == null || cmtReportIds.has(p.laporanId))
    );
    const totalDiambil = pengambilans.reduce((sum: number, p: any) => sum + p.jumlahDiambil, 0);
    const sisa = po.jumlahTerbit - totalDiambil;
    const cmt = getCmtCompletion(data, po);

    // CMT progress
    const progresRecords = myCmtReports;
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

    // Washing progress (hanya pengiriman ke vendor washing; pool/penarikan tidak dihitung)
    const ws = vendorStageSummary(data, po.id, "washing");
    const washingKirim = ws.kirim;
    const washingACC = ws.approved;
    const washingProses = ws.proses; // still in washing
    const pctWashing = po.jumlahTerbit > 0 ? Math.min(100, Math.round((washingKirim / po.jumlahTerbit) * 100)) : 0;
    const pctWashingACC = po.jumlahTerbit > 0 ? Math.min(100, Math.round((washingACC / po.jumlahTerbit) * 100)) : 0;

    // Target selesai lookup from pemotongan if null
    const pemotongan = (data.pemotongan_kain || []).find((pk: any) => pk.id === po.pemotongan_id);
    const targetSelesai = po.target_selesai || pemotongan?.target_selesai || null;

    // Current stage determination
    let currentStage = "cmt";
    if (washingACC > 0 && washingProses === 0) currentStage = "selesai_washing";
    else if (washingKirim > 0) currentStage = "washing";
    else if (totalDisetujui > 0) currentStage = "siap_tarik";
    else if (totalDilaporkan > 0) currentStage = "dilaporkan";

    // Vendor details lookup
    const vendorObj = (data.vendors || []).find((v: any) => v.id === po.vendorId) || null;

    return {
      ...po,
      nama_kain: po.nama_kain || pemotongan?.nama_barang || "-",
      jenis_jahitan: po.jenis_jahitan || pemotongan?.jenis_jahitan || "",
      tipe_benang: po.tipe_benang || pemotongan?.tipe_benang || "",
      tipe_resleting: po.tipe_resleting || pemotongan?.tipe_resleting || "",
      catatan_jahitan: po.catatan_jahitan || pemotongan?.catatan_jahitan || "",
      item_pendukung_used: po.item_pendukung_used || pemotongan?.item_pendukung_used || [],
      target_selesai: targetSelesai,
      pemotongan_target_selesai: pemotongan?.target_selesai || null,
      vendor_nama: vendorObj?.nama || null,
      vendor_kode: vendorObj?.kodeVendor || null,
      vendor_tipe: vendorObj?.tipe || null,
      vendor_kontak: vendorObj?.kontak || null,
      vendor: vendorObj,
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
      // Lifecycle CMT (aturan terpusat: lib/po-lifecycle)
      cmt_selesai: cmt.done,
      cmt_selesai_at: cmt.selesaiAt,
      cmt_menunggu_acc: cmt.waitingAcc,
      cmt_is_overdue: cmt.isOverdue,
      cmt_late_days: cmt.lateDays,
      cmt_terlambat_hari: cmt.done || cmt.waitingAcc ? cmt.lateDays : 0,
      status: sisa <= 0 ? "Closed" : po.status
    };
  }).reverse();

  return NextResponse.json(poList);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const data = readData();
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
    nama_kain: pemotongan.nama_barang || "",
    jenis_jahitan: pemotongan.jenis_jahitan || "",
    tipe_benang: pemotongan.tipe_benang || "",
    tipe_resleting: pemotongan.tipe_resleting || "",
    catatan_jahitan: pemotongan.catatan_jahitan || "",
    item_pendukung_used: pemotongan.item_pendukung_used || [],
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
