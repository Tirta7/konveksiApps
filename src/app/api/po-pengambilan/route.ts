export const dynamic = "force-dynamic";
﻿import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";

export async function GET() {
  const data = readData();
  const list = data.po_pengambilan.map((p: any) => {
    const po = data.po_produksi.find((po: any) => po.id === p.poId);
    return { ...p, po };
  }).reverse();
  
  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  const data = readData();
  const body = await req.json();
  const { poId, jumlahDiambil, penerima, catatan } = body;
  
  if (!poId || !jumlahDiambil || !penerima) {
    return NextResponse.json({ error: "Data pengambilan tidak lengkap" }, { status: 400 });
  }

  const po = data.po_produksi.find((p: any) => p.id === poId);
  if (!po) return NextResponse.json({ error: "PO Produksi tidak ditemukan" }, { status: 404 });

  // Calculate current sisa
  const pengambilans = data.po_pengambilan.filter((p: any) => p.poId === poId);
  const totalDiambilSebelumnya = pengambilans.reduce((sum: number, p: any) => sum + p.jumlahDiambil, 0);
  const sisa = po.jumlahTerbit - totalDiambilSebelumnya;

  if (Number(jumlahDiambil) > sisa) {
    return NextResponse.json({ error: `Jumlah diambil melebihi sisa PO. Sisa saat ini: ${sisa}` }, { status: 400 });
  }

  const now = new Date().toISOString();
  const id = nextId(data, "po_pengambilan");

  const newPengambilan = {
    id,
    poId: Number(poId),
    jumlahDiambil: Number(jumlahDiambil),
    penerima, // Nama vendor washing atau pihak penerima
    catatan: catatan || "",
    tanggalAmbil: now
  };
  
  data.po_pengambilan.push(newPengambilan);

  // Trigger Gaji CMT (Optional rule as requested: salary based on real taken quantity)
  const vendor = data.vendors.find((v: any) => v.id === po.vendorId);
  if (vendor && vendor.tipe === "cmt") {
    const kategori = po.model || po.kategori || ""; 
    let tarif = vendor.hargaPerPcs || 0;
    
    if (vendor.tarifPotongan && vendor.tarifPotongan[kategori]) {
      tarif = vendor.tarifPotongan[kategori];
    }

    if (tarif > 0) {
      const totalGaji = Number(jumlahDiambil) * tarif;
      data.gaji_cmt.push({
        id: nextId(data, "gaji_cmt"),
        cmtId: vendor.id,
        poId: po.id, 
        jumlahPcs: Number(jumlahDiambil),
        totalGaji: totalGaji,
        tanggal: now
      });
    }
  }

  // Update PO status if finished
  if (totalDiambilSebelumnya + Number(jumlahDiambil) >= po.jumlahTerbit) {
    po.status = "Closed";
  }

  writeData(data);
  return NextResponse.json(newPengambilan);
}
