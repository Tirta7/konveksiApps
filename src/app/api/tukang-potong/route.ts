export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";
import { broadcast } from "@/lib/sse";

export async function GET() {
  const data = readData();
  const tukangList = data.tukang_potong || [];
  const pemotonganList = data.pemotongan_kain || [];

  const enriched = tukangList.map((tp: any) => {
    const listSpk = pemotonganList.filter((p: any) => Number(p.tukang_potong_id) === Number(tp.id));
    const totalSpk = listSpk.length;
    const totalMeter = listSpk.reduce((s: number, p: any) => s + (Number(p.meter_kain) || 0), 0);
    const totalPcs = listSpk.reduce((s: number, p: any) => s + (Number(p.total_pcs) || 0), 0);

    return {
      ...tp,
      total_spk: totalSpk,
      total_meter: Math.round(totalMeter * 10) / 10,
      total_pcs: totalPcs,
    };
  });

  return NextResponse.json(enriched);
}

export async function POST(req: Request) {
  const body = await req.json();
  const data = readData();
  if (!data.tukang_potong) data.tukang_potong = [];
  
  const { id, nama, kode, kontak } = body;

  if (!nama || !kode) {
    return NextResponse.json({ error: "Nama dan Kode wajib diisi" }, { status: 400 });
  }

  const kodeUpper = kode.trim().toUpperCase();

  if (id) {
    // Edit
    const index = data.tukang_potong.findIndex((v: any) => v.id === id);
    if (index === -1) return NextResponse.json({ error: "Tukang potong tidak ditemukan" }, { status: 404 });
    data.tukang_potong[index] = { ...data.tukang_potong[index], nama: nama.trim(), kode: kodeUpper, kontak: (kontak || "").trim() };
  } else {
    // Check unique code
    const duplicate = data.tukang_potong.some((v: any) => (v.kode || "").toUpperCase() === kodeUpper);
    if (duplicate) {
      return NextResponse.json({ error: `Kode prefix '${kodeUpper}' sudah digunakan oleh tukang potong lain.` }, { status: 400 });
    }

    const newId = nextId(data, "tukang_potong" as any);
    data.tukang_potong.push({
      id: newId,
      nama: nama.trim(),
      kode: kodeUpper,
      kontak: (kontak || "").trim()
    });
  }

  writeData(data);
  try { broadcast("tukang:updated", data.tukang_potong); } catch {}

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
    try { broadcast("tukang:updated", data.tukang_potong); } catch {}
  }
  return NextResponse.json({ success: true });
}
