import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";

function generateUID(prefix: string): string {
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${randomStr}`;
}

export async function GET() {
  const data = readData();
  return NextResponse.json(data.data_supplier ? data.data_supplier.slice().reverse() : []);
}

export async function POST(req: NextRequest) {
  const data = readData();
  const body = await req.json();
  const { nama_supplier, kontak, alamat, jenis_material } = body;

  if (!nama_supplier || !kontak || !alamat || !jenis_material) {
    return NextResponse.json({ error: "Semua field wajib diisi" }, { status: 400 });
  }

  const newId = nextId(data, "data_supplier");
  const newSupplier = {
    id: newId,
    uid: generateUID('SUP'),
    nama_supplier,
    kontak,
    alamat,
    jenis_material,
    created_at: new Date().toISOString(),
  };

  if (!data.data_supplier) data.data_supplier = [];
  data.data_supplier.push(newSupplier);
  writeData(data);

  return NextResponse.json(newSupplier, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const data = readData();
  const body = await req.json();
  const { id, nama_supplier, kontak, alamat, jenis_material } = body;

  if (!id || !nama_supplier) {
    return NextResponse.json({ error: "ID dan Nama Supplier wajib diisi" }, { status: 400 });
  }

  const index = data.data_supplier.findIndex(s => s.id === id);
  if (index === -1) {
    return NextResponse.json({ error: "Supplier tidak ditemukan" }, { status: 404 });
  }

  data.data_supplier[index] = {
    ...data.data_supplier[index],
    nama_supplier,
    kontak: kontak || data.data_supplier[index].kontak,
    alamat: alamat || data.data_supplier[index].alamat,
    jenis_material: jenis_material || data.data_supplier[index].jenis_material,
  };

  writeData(data);
  return NextResponse.json(data.data_supplier[index]);
}

export async function DELETE(req: NextRequest) {
  const data = readData();
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID wajib disertakan" }, { status: 400 });
  }

  const numId = Number(id);
  const index = data.data_supplier.findIndex(s => s.id === numId);
  if (index === -1) {
    return NextResponse.json({ error: "Supplier tidak ditemukan" }, { status: 404 });
  }

  data.data_supplier.splice(index, 1);
  writeData(data);

  return NextResponse.json({ success: true });
}
