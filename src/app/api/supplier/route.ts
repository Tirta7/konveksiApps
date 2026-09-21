export const dynamic = "force-dynamic";
﻿import { NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";

export async function GET() {
  try {
    const data = readData();
    const hutang = data.hutang || [];
    const suppliers = (data.data_supplier || []).map((sup: any) => {
      const hutangSupplier = hutang.filter((h: any) => h.supplier_id === sup.id && h.status !== "Lunas");
      const totalHutang = hutangSupplier.reduce((sum: number, h: any) => sum + (Number(h.total_tagihan) - Number(h.jumlah_dibayar || 0)), 0);
      return {
        ...sup,
        total_hutang: totalHutang
      };
    });
    return NextResponse.json(suppliers);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const data = readData();
  if (!data.data_supplier) data.data_supplier = [];
  
  const body = await req.json();
  const { id, nama_supplier, kontak, alamat, jenis_material } = body;

  if (!nama_supplier) {
    return NextResponse.json({ error: "Nama Supplier wajib diisi" }, { status: 400 });
  }

  if (id) {
    // Edit
    const index = data.data_supplier.findIndex((v: any) => v.id === id);
    if (index === -1) return NextResponse.json({ error: "Supplier tidak ditemukan" }, { status: 404 });
    data.data_supplier[index] = { 
      ...data.data_supplier[index], 
      nama_supplier, 
      kontak: kontak || "", 
      alamat: alamat || "",
      jenis_material: jenis_material || ""
    };
  } else {
    // Create
    const newId = nextId(data, "data_supplier" as any);
    const uid = `SUP-${String(newId).padStart(3, '0')}`;
    data.data_supplier.push({
      id: newId,
      uid,
      nama_supplier,
      kontak: kontak || "",
      alamat: alamat || "",
      jenis_material: jenis_material || ""
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

  if (data.data_supplier) {
    data.data_supplier = data.data_supplier.filter((v: any) => v.id !== id);
    writeData(data);
  }
  return NextResponse.json({ success: true });
}
