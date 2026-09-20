import { NextResponse } from "next/server";
import { readData, writeData } from "@/lib/data-store";

export async function GET() {
  const data = readData();
  
  // Join dengan data supplier
  const hutang = (data.hutang || []).map((h: any) => {
    const sup = (data.data_supplier || []).find((s: any) => s.id === h.supplier_id);
    return {
      ...h,
      supplier_nama: sup ? sup.nama_supplier : "Unknown"
    };
  }).reverse();

  return NextResponse.json(hutang);
}

export async function PUT(req: Request) {
  const data = readData();
  const body = await req.json();
  const { id, bayar_amount } = body;

  if (!id || !bayar_amount) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const index = data.hutang.findIndex((h: any) => h.id === id);
  if (index === -1) return NextResponse.json({ error: "Hutang tidak ditemukan" }, { status: 404 });

  const h = data.hutang[index];
  h.jumlah_dibayar += Number(bayar_amount);

  if (h.jumlah_dibayar >= h.total_tagihan) {
    h.status = "Lunas";
    h.jumlah_dibayar = h.total_tagihan; // cap at total
  } else {
    h.status = "Belum Lunas";
  }

  writeData(data);
  return NextResponse.json({ success: true, sisa: h.total_tagihan - h.jumlah_dibayar });
}
