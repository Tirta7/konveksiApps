import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";

export async function GET() {
  const data = readData();
  return NextResponse.json(data.kategori_produk.slice().reverse());
}

export async function POST(req: NextRequest) {
  const data = readData();
  const { nama, deskripsi } = await req.json();
  const id = nextId(data, "kategori_produk");
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  const newKategori = { id, uid: `KTG-${randomStr}`, nama, deskripsi, createdAt: new Date().toISOString() };
  data.kategori_produk.push(newKategori);
  writeData(data);
  return NextResponse.json(newKategori);
}

export async function PUT(req: NextRequest) {
  const data = readData();
  const { id, nama, deskripsi } = await req.json();
  if (!id) return NextResponse.json({ error: "ID dibutuhkan" }, { status: 400 });
  const idx = data.kategori_produk.findIndex((k: any) => k.id === id);
  if (idx === -1) return NextResponse.json({ error: "Kategori tidak ditemukan" }, { status: 404 });
  data.kategori_produk[idx] = { ...data.kategori_produk[idx], nama, deskripsi };
  writeData(data);
  return NextResponse.json(data.kategori_produk[idx]);
}

export async function DELETE(req: NextRequest) {
  const data = readData();
  const { id } = await req.json();
  data.kategori_produk = data.kategori_produk.filter((k: any) => k.id !== id);
  writeData(data);
  return NextResponse.json({ success: true });
}
