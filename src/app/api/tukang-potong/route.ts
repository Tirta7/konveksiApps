export const dynamic = "force-dynamic";
﻿import { NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";

export async function GET() {
  const data = readData();
  return NextResponse.json(data.tukang_potong || []);
}

export async function POST(req: Request) {
  const data = readData();
  if (!data.tukang_potong) data.tukang_potong = [];
  
  const body = await req.json();
  const { id, nama, kode, kontak } = body;

  if (!nama || !kode) {
    return NextResponse.json({ error: "Nama dan Kode wajib diisi" }, { status: 400 });
  }

  if (id) {
    // Edit
    const index = data.tukang_potong.findIndex((v: any) => v.id === id);
    if (index === -1) return NextResponse.json({ error: "Tukang potong tidak ditemukan" }, { status: 404 });
    data.tukang_potong[index] = { ...data.tukang_potong[index], nama, kode: kode.toUpperCase(), kontak };
  } else {
    // Create
    const newId = nextId(data, "tukang_potong" as any);
    data.tukang_potong.push({
      id: newId,
      nama,
      kode: kode.toUpperCase(),
      kontak: kontak || ""
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

  if (data.tukang_potong) {
    data.tukang_potong = data.tukang_potong.filter((v: any) => v.id !== id);
    writeData(data);
  }
  return NextResponse.json({ success: true });
}
