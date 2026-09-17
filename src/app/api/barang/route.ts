import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";

function generateUID(prefix: string): string {
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${randomStr}`;
}

export async function GET() {
  const data = readData();
  const barang = data.data_barang || [];
  
  // Join dengan kategori
  const result = barang.map(b => {
    const kategori = data.kategori_produk?.find(k => k.id === b.kategori_id);
    return {
      ...b,
      kategori_nama: kategori ? kategori.nama : "Tanpa Kategori"
    };
  });

  return NextResponse.json(result.reverse());
}

export async function POST(req: NextRequest) {
  const data = readData();
  const body = await req.json();
  const { kategori_id, nama_barang, harga_beli, harga_jual, stok } = body;

  if (!kategori_id || !nama_barang || harga_beli === undefined || harga_jual === undefined || stok === undefined) {
    return NextResponse.json({ error: "Semua field wajib diisi" }, { status: 400 });
  }

  const newId = nextId(data, "data_barang");
  const newBarang = {
    id: newId,
    uid: generateUID('BRG'),
    kategori_id: Number(kategori_id),
    nama_barang,
    harga_beli: Number(harga_beli),
    harga_jual: Number(harga_jual),
    stok: Number(stok),
    created_at: new Date().toISOString(),
  };

  if (!data.data_barang) data.data_barang = [];
  data.data_barang.push(newBarang);
  writeData(data);

  return NextResponse.json(newBarang, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const data = readData();
  const body = await req.json();
  const { id, kategori_id, nama_barang, harga_beli, harga_jual, stok } = body;

  if (!id || !kategori_id || !nama_barang) {
    return NextResponse.json({ error: "ID, Kategori, dan Nama wajib diisi" }, { status: 400 });
  }

  const index = data.data_barang.findIndex(b => b.id === id);
  if (index === -1) {
    return NextResponse.json({ error: "Data barang tidak ditemukan" }, { status: 404 });
  }

  data.data_barang[index] = {
    ...data.data_barang[index],
    kategori_id: Number(kategori_id),
    nama_barang,
    harga_beli: harga_beli !== undefined ? Number(harga_beli) : data.data_barang[index].harga_beli,
    harga_jual: harga_jual !== undefined ? Number(harga_jual) : data.data_barang[index].harga_jual,
    stok: stok !== undefined ? Number(stok) : data.data_barang[index].stok,
  };

  writeData(data);
  return NextResponse.json(data.data_barang[index]);
}

export async function DELETE(req: NextRequest) {
  const data = readData();
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID wajib disertakan" }, { status: 400 });
  }

  const numId = Number(id);
  const index = data.data_barang.findIndex(b => b.id === numId);
  if (index === -1) {
    return NextResponse.json({ error: "Data barang tidak ditemukan" }, { status: 404 });
  }

  data.data_barang.splice(index, 1);
  writeData(data);

  return NextResponse.json({ success: true });
}
