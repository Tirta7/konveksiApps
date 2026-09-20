import { NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";

export async function GET() {
  const data = readData();
  return NextResponse.json(data.data_kain || []);
}

export async function POST(req: Request) {
  const data = readData();
  if (!data.data_kain) data.data_kain = [];
  
  const body = await req.json();
  const { id, nama_kain, warna, stok_meter, harga_beli } = body;

  if (!nama_kain) {
    return NextResponse.json({ error: "Nama Kain wajib diisi" }, { status: 400 });
  }

  if (id) {
    // Edit
    const index = data.data_kain.findIndex((v: any) => v.id === id);
    if (index === -1) return NextResponse.json({ error: "Data kain tidak ditemukan" }, { status: 404 });
    data.data_kain[index] = { 
      ...data.data_kain[index], 
      nama_kain, 
      warna: warna || "", 
      stok_meter: Number(stok_meter) || 0,
      harga_beli: Number(harga_beli) || 0
    };
  } else {
    // Create
    const newId = nextId(data, "data_kain" as any);
    data.data_kain.push({
      id: newId,
      nama_kain,
      warna: warna || "",
      stok_meter: Number(stok_meter) || 0,
      harga_beli: Number(harga_beli) || 0
    });
  }

  writeData(data);
  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  const data = readData();
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));

  if (!id) return NextResponse.json({ error: "ID dibutuhkan" }, { status: 400 });

  if (data.data_kain) {
    data.data_kain = data.data_kain.filter((v: any) => v.id !== id);
    writeData(data);
  }
  return NextResponse.json({ success: true });
}
