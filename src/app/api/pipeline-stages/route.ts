import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";

export async function GET() {
  const data = readData();
  if (!data.pipeline_stages) data.pipeline_stages = [];
  return NextResponse.json(data.pipeline_stages.sort((a: any, b: any) => a.urutan - b.urutan));
}

export async function POST(req: NextRequest) {
  const data = readData();
  if (!data.pipeline_stages) data.pipeline_stages = [];
  const body = await req.json();
  const { nama, slug, emoji, warna, vendor_tipe, opsional, butuh_vendor, deskripsi } = body;
  if (!nama || !slug) return NextResponse.json({ error: "nama dan slug wajib diisi" }, { status: 400 });

  const maxUrutan = data.pipeline_stages.length > 0
    ? Math.max(...data.pipeline_stages.map((s: any) => s.urutan)) + 1
    : 1;

  const newStage = {
    id: nextId(data, "pipeline_stages" as any),
    nama, slug,
    emoji: emoji || "??",
    warna: warna || "#64748B",
    urutan: maxUrutan,
    vendor_tipe: vendor_tipe || null,
    opsional: opsional === true,
    butuh_vendor: butuh_vendor !== false,
    aktif: true,
    deskripsi: deskripsi || "",
  };

  data.pipeline_stages.push(newStage);
  writeData(data);
  return NextResponse.json(newStage, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const data = readData();
  if (!data.pipeline_stages) data.pipeline_stages = [];
  const body = await req.json();

  if (body.reorder && Array.isArray(body.reorder)) {
    for (const { id, urutan } of body.reorder) {
      const idx = data.pipeline_stages.findIndex((s: any) => s.id === id);
      if (idx !== -1) data.pipeline_stages[idx].urutan = urutan;
    }
    writeData(data);
    return NextResponse.json({ ok: true });
  }

  const { id, ...updates } = body;
  const idx = data.pipeline_stages.findIndex((s: any) => s.id === id);
  if (idx === -1) return NextResponse.json({ error: "Stage tidak ditemukan" }, { status: 404 });

  data.pipeline_stages[idx] = { ...data.pipeline_stages[idx], ...updates };
  writeData(data);
  return NextResponse.json(data.pipeline_stages[idx]);
}

export async function DELETE(req: NextRequest) {
  const data = readData();
  if (!data.pipeline_stages) data.pipeline_stages = [];
  const { id } = await req.json();

  const idx = data.pipeline_stages.findIndex((s: any) => s.id === id);
  if (idx === -1) return NextResponse.json({ error: "Stage tidak ditemukan" }, { status: 404 });

  data.pipeline_stages.splice(idx, 1);
  data.pipeline_stages
    .sort((a: any, b: any) => a.urutan - b.urutan)
    .forEach((s: any, i: number) => { s.urutan = i + 1; });

  writeData(data);
  return NextResponse.json({ ok: true });
}
