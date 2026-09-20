import { NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";

export async function GET() {
  try {
    const data = readData();
    return NextResponse.json(data.data_barang || []);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const data = readData();
    if (!data.data_barang) data.data_barang = [];
    const body = await req.json();
    const { nama_barang, kategori_id, harga_beli, harga_jual, stok } = body;
    if (!nama_barang) return NextResponse.json({ error: "Nama barang wajib diisi" }, { status: 400 });
    const id = nextId(data, "data_barang" as any);
    const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newItem = {
      id, uid: `BRG-${randomStr}`,
      nama_barang, kategori_id: Number(kategori_id) || 0,
      harga_beli: Number(harga_beli) || 0,
      harga_jual: Number(harga_jual) || 0,
      stok: Number(stok) || 0,
      createdAt: new Date().toISOString()
    };
    data.data_barang.push(newItem);
    writeData(data);
    return NextResponse.json(newItem);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const data = readData();
    if (!data.data_barang) data.data_barang = [];
    const body = await req.json();
    const { id, nama_barang, kategori_id, harga_beli, harga_jual, stok } = body;
    if (!id) return NextResponse.json({ error: "ID dibutuhkan" }, { status: 400 });
    const idx = data.data_barang.findIndex((b: any) => b.id === id);
    if (idx === -1) return NextResponse.json({ error: "Barang tidak ditemukan" }, { status: 404 });
    data.data_barang[idx] = {
      ...data.data_barang[idx],
      nama_barang, kategori_id: Number(kategori_id) || 0,
      harga_beli: Number(harga_beli) || 0,
      harga_jual: Number(harga_jual) || 0,
      stok: Number(stok) || 0
    };
    writeData(data);
    return NextResponse.json(data.data_barang[idx]);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const data = readData();
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));
    if (!id) return NextResponse.json({ error: "ID dibutuhkan" }, { status: 400 });
    data.data_barang = (data.data_barang || []).filter((b: any) => b.id !== id);
    writeData(data);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
