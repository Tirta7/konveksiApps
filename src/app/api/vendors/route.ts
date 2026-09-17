import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";

export async function GET() {
  return NextResponse.json(readData().vendors);
}

export async function POST(req: NextRequest) {
  const data = readData();
  const { nama, jenis_default, kontak, wajib_hitung_ulang } = await req.json();
  if (!nama) return NextResponse.json({ error: "Nama wajib diisi" }, { status: 400 });
  const now = new Date().toISOString();
  const id = nextId(data, "vendors");
  data.vendors.push({ id, nama, jenis_default: jenis_default || "", kontak: kontak || "", aktif: true, wajib_hitung_ulang: wajib_hitung_ulang ?? false, created_at: now });
  writeData(data);
  return NextResponse.json({ id });
}

export async function PATCH(req: NextRequest) {
  const data = readData();
  const { id, nama, jenis_default, kontak, aktif, wajib_hitung_ulang } = await req.json();
  const vendor = data.vendors.find(v => v.id === Number(id));
  if (!vendor) return NextResponse.json({ error: "Vendor tidak ditemukan" }, { status: 404 });
  if (nama !== undefined) vendor.nama = nama;
  if (jenis_default !== undefined) vendor.jenis_default = jenis_default;
  if (kontak !== undefined) vendor.kontak = kontak;
  if (aktif !== undefined) vendor.aktif = aktif;
  if (wajib_hitung_ulang !== undefined) vendor.wajib_hitung_ulang = wajib_hitung_ulang;
  writeData(data);
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const data = readData();
  const { id } = await req.json();
  const idx = data.vendors.findIndex(v => v.id === Number(id));
  if (idx < 0) return NextResponse.json({ error: "Vendor tidak ditemukan" }, { status: 404 });
  // Soft delete - tandai tidak aktif
  data.vendors[idx].aktif = false;
  writeData(data);
  return NextResponse.json({ success: true });
}
