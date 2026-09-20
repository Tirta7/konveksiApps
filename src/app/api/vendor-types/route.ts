import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";

// Default built-in types to seed if empty
const DEFAULT_TYPES = [
  { id: 1, nama: "CMT / Penjahit", slug: "cmt", emoji: "🧵", perlu_portal: true, portal_path: "/cmt", perlu_gaji: true, createdAt: new Date().toISOString() },
  { id: 2, nama: "Washing / Laundry", slug: "washing", emoji: "🚿", perlu_portal: true, portal_path: "/washing", perlu_gaji: true, createdAt: new Date().toISOString() },
  { id: 3, nama: "Bersih Benang", slug: "benang", emoji: "✂️", perlu_portal: true, portal_path: "/bersih-benang", perlu_gaji: true, createdAt: new Date().toISOString() },
  { id: 4, nama: "QC / Finishing", slug: "finishing", emoji: "⭐", perlu_portal: true, portal_path: "/finishing", perlu_gaji: false, createdAt: new Date().toISOString() },
  { id: 5, nama: "Lainnya", slug: "lainnya", emoji: "📦", perlu_portal: false, portal_path: "", perlu_gaji: false, createdAt: new Date().toISOString() },
];

export async function GET() {
  const data = readData();
  if (!data.vendor_types) data.vendor_types = [];
  if (data.vendor_types.length === 0) {
    data.vendor_types = DEFAULT_TYPES;
    writeData(data);
  }
  return NextResponse.json(data.vendor_types);
}

export async function POST(req: NextRequest) {
  const data = readData();
  if (!data.vendor_types) data.vendor_types = [];
  const body = await req.json();
  const { nama, slug, emoji, perlu_portal, portal_path, perlu_gaji } = body;
  if (!nama || !slug) return NextResponse.json({ error: "Nama dan slug wajib diisi" }, { status: 400 });
  const duplicate = data.vendor_types.find((t: any) => t.slug === slug);
  if (duplicate) return NextResponse.json({ error: "Slug sudah digunakan" }, { status: 400 });
  const id = nextId(data, "vendor_types" as any);
  const newType = { id, nama, slug, emoji: emoji || "📦", perlu_portal: !!perlu_portal, portal_path: portal_path || "", perlu_gaji: !!perlu_gaji, createdAt: new Date().toISOString() };
  data.vendor_types.push(newType);
  writeData(data);
  return NextResponse.json(newType);
}

export async function PATCH(req: NextRequest) {
  const data = readData();
  if (!data.vendor_types) data.vendor_types = [];
  const body = await req.json();
  const { id, ...updates } = body;
  const idx = data.vendor_types.findIndex((t: any) => String(t.id) === String(id));
  if (idx === -1) return NextResponse.json({ error: "Tipe tidak ditemukan" }, { status: 404 });
  data.vendor_types[idx] = { ...data.vendor_types[idx], ...updates };
  writeData(data);
  return NextResponse.json(data.vendor_types[idx]);
}

export async function DELETE(req: NextRequest) {
  const data = readData();
  if (!data.vendor_types) data.vendor_types = [];
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const idx = data.vendor_types.findIndex((t: any) => String(t.id) === id);
  if (idx === -1) return NextResponse.json({ error: "Tipe tidak ditemukan" }, { status: 404 });
  data.vendor_types.splice(idx, 1);
  writeData(data);
  return NextResponse.json({ success: true });
}