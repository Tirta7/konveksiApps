import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";

function generateUID(prefix: string): string {
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${randomStr}`;
}

export async function GET() {
  const data = readData();
  return NextResponse.json(data.kategori_produk || []);
}

export async function POST(req: NextRequest) {
  const data = readData();
  const body = await req.json();
  const { nama, deskripsi } = body;

  if (!nama) {
    return NextResponse.json({ error: "Nama kategori wajib diisi" }, { status: 400 });
  }

  const newId = nextId(data, "kategori_produk");
  const newKategori = {
    id: newId,
    uid: generateUID('KTG'),
    nama,
    deskripsi: deskripsi || "",
    created_at: new Date().toISOString(),
  };

  if (!data.kategori_produk) data.kategori_produk = [];
  data.kategori_produk.push(newKategori);
  writeData(data);

  return NextResponse.json(newKategori, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const data = readData();
  const body = await req.json();
  const { id, nama, deskripsi } = body;

  if (!id || !nama) {
    return NextResponse.json({ error: "ID dan Nama wajib diisi" }, { status: 400 });
  }

  const index = data.kategori_produk.findIndex(k => k.id === id);
  if (index === -1) {
    return NextResponse.json({ error: "Kategori tidak ditemukan" }, { status: 404 });
  }

  data.kategori_produk[index] = {
    ...data.kategori_produk[index],
    nama,
    deskripsi: deskripsi ?? data.kategori_produk[index].deskripsi,
  };

  writeData(data);
  return NextResponse.json(data.kategori_produk[index]);
}

export async function DELETE(req: NextRequest) {
  const data = readData();
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID wajib disertakan" }, { status: 400 });
  }

  const numId = Number(id);
  const index = data.kategori_produk.findIndex(k => k.id === numId);
  if (index === -1) {
    return NextResponse.json({ error: "Kategori tidak ditemukan" }, { status: 404 });
  }

  // Cek apakah ada barang yang menggunakan kategori ini
  const isUsed = data.data_barang?.some(b => b.kategori_id === numId);
  if (isUsed) {
    return NextResponse.json({ error: "Kategori tidak dapat dihapus karena masih digunakan oleh data barang" }, { status: 400 });
  }

  data.kategori_produk.splice(index, 1);
  writeData(data);

  return NextResponse.json({ success: true });
}
