import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";
import { broadcast } from "@/lib/sse";

export const dynamic = "force-dynamic";

export const DEFAULT_JEANS_STAGES = [
  {
    id: 1,
    nama: "Potong Kain (Cutting)",
    slug: "potong_kain",
    warna: "#2563EB",
    urutan: 1,
    vendor_tipe: null,
    opsional: false,
    butuh_vendor: false,
    aktif: true,
    estimasi_hari: 2,
    deskripsi: "Pemotongan bahan roll sesuai pola & size breakdown (Divisi Cutting)"
  },
  {
    id: 2,
    nama: "Jahit / CMT (Sewing)",
    slug: "jahit_cmt",
    warna: "#DC2626",
    urutan: 2,
    vendor_tipe: "cmt",
    opsional: false,
    butuh_vendor: true,
    aktif: true,
    estimasi_hari: 7,
    deskripsi: "Penjahitan komponen celana jeans oleh penjahit / vendor CMT"
  },
  {
    id: 3,
    nama: "Washing / Laundry",
    slug: "washing",
    warna: "#D97706",
    urutan: 3,
    vendor_tipe: "washing",
    opsional: false,
    butuh_vendor: true,
    aktif: true,
    estimasi_hari: 4,
    deskripsi: "Proses pencucian denim khusus (Bio wash, stone wash, whisker, bleach)"
  },
  {
    id: 4,
    nama: "Bersih Benang & Aksesoris",
    slug: "bersih_benang",
    warna: "#059669",
    urutan: 4,
    vendor_tipe: "bersih_benang",
    opsional: false,
    butuh_vendor: true,
    aktif: true,
    estimasi_hari: 2,
    deskripsi: "Buang sisa benang, pasang kancing donut, rivet tembaga, dan label hangtag"
  },
  {
    id: 5,
    nama: "QC Gudang (Quality Control)",
    slug: "qc_gudang",
    warna: "#4F46E5",
    urutan: 5,
    vendor_tipe: "finishing",
    opsional: false,
    butuh_vendor: false,
    aktif: true,
    estimasi_hari: 1,
    deskripsi: "Pengecekan standar mutu jahitan, ukuran lingkar pinggang, dan kelayakan"
  },
  {
    id: 6,
    nama: "Packing & Barang Jadi",
    slug: "packing_gudang",
    warna: "#9333EA",
    urutan: 6,
    vendor_tipe: "lainnya",
    opsional: true,
    butuh_vendor: false,
    aktif: true,
    estimasi_hari: 1,
    deskripsi: "Steam uap, pelipatan celana, polybag, dan transfer otomatis ke Gudang Barang Jadi"
  }
];

export async function GET() {
  const data = readData();
  if (!data.pipeline_stages || data.pipeline_stages.length === 0) {
    data.pipeline_stages = DEFAULT_JEANS_STAGES;
    writeData(data);
  }
  return NextResponse.json(data.pipeline_stages.sort((a: any, b: any) => a.urutan - b.urutan));
}

export async function POST(req: NextRequest) {
  const data = readData();
  if (!data.pipeline_stages) data.pipeline_stages = [];
  const body = await req.json();

  // Support 1-click Preset Reset
  if (body.action === "reset_preset") {
    data.pipeline_stages = DEFAULT_JEANS_STAGES.map((s, idx) => ({
      ...s,
      id: idx + 1
    }));
    writeData(data);
    broadcast("stages:updated", data.pipeline_stages);
    return NextResponse.json({ ok: true, stages: data.pipeline_stages });
  }

  const { nama, slug, warna, vendor_tipe, opsional, butuh_vendor, deskripsi, estimasi_hari } = body;
  if (!nama || !slug) return NextResponse.json({ error: "Nama dan slug wajib diisi" }, { status: 400 });

  const maxUrutan = data.pipeline_stages.length > 0
    ? Math.max(...data.pipeline_stages.map((s: any) => s.urutan || 0)) + 1
    : 1;

  const newStage = {
    id: nextId(data, "pipeline_stages" as any),
    nama,
    slug: slug.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
    warna: warna || "#2563EB",
    urutan: maxUrutan,
    vendor_tipe: vendor_tipe || null,
    opsional: opsional === true,
    butuh_vendor: butuh_vendor !== false,
    aktif: true,
    estimasi_hari: Number(estimasi_hari) || 1,
    deskripsi: deskripsi || "",
  };

  data.pipeline_stages.push(newStage);
  writeData(data);
  broadcast("stages:updated", data.pipeline_stages);
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
    broadcast("stages:updated", data.pipeline_stages);
    return NextResponse.json({ ok: true });
  }

  const { id, ...updates } = body;
  const idx = data.pipeline_stages.findIndex((s: any) => s.id === id);
  if (idx === -1) return NextResponse.json({ error: "Stage tidak ditemukan" }, { status: 404 });

  if (updates.slug) {
    updates.slug = updates.slug.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  }

  data.pipeline_stages[idx] = { 
    ...data.pipeline_stages[idx], 
    ...updates,
    estimasi_hari: updates.estimasi_hari !== undefined ? Number(updates.estimasi_hari) : data.pipeline_stages[idx].estimasi_hari
  };
  writeData(data);
  broadcast("stages:updated", data.pipeline_stages);
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
  broadcast("stages:updated", data.pipeline_stages);
  return NextResponse.json({ ok: true });
}
