import { NextRequest, NextResponse } from "next/server";
import { readData, writeData } from "@/lib/data-store";

// GET: get pipeline for a specific po_id, or all if no query
export async function GET(req: NextRequest) {
  const data = readData();
  if (!data.po_pipeline) data.po_pipeline = [];
  const poId = req.nextUrl.searchParams.get("po_id");
  if (poId) {
    const found = data.po_pipeline.find((p: any) => String(p.po_id) === poId);
    if (!found) {
      // Auto-build from default pipeline stages
      const stages = (data.pipeline_stages || [])
        .filter((s: any) => s.aktif)
        .sort((a: any, b: any) => a.urutan - b.urutan)
        .map((s: any) => ({
          stage_id: s.id,
          slug: s.slug,
          nama: s.nama,
          emoji: s.emoji,
          warna: s.warna,
          opsional: s.opsional,
          aktif: !s.opsional, // default: non-optional = aktif, optional = off
          vendor_id: null,
          target_selesai: null,
          status: "Menunggu",
          selesai_tgl: null,
          catatan: "",
        }));
      return NextResponse.json({ po_id: Number(poId), stages, draft: true });
    }
    return NextResponse.json(found);
  }
  return NextResponse.json(data.po_pipeline);
}

// POST: save/create pipeline for a PO
export async function POST(req: NextRequest) {
  const data = readData();
  if (!data.po_pipeline) data.po_pipeline = [];
  const body = await req.json();
  const { po_id, stages } = body;
  if (!po_id || !stages) return NextResponse.json({ error: "po_id dan stages wajib" }, { status: 400 });

  const existing = data.po_pipeline.findIndex((p: any) => p.po_id === Number(po_id));
  const entry = { po_id: Number(po_id), stages, updatedAt: new Date().toISOString() };
  if (existing !== -1) {
    data.po_pipeline[existing] = entry;
  } else {
    data.po_pipeline.push(entry);
  }

  writeData(data);
  return NextResponse.json(entry, { status: 200 });
}

// PATCH: update a specific stage status within a PO pipeline
export async function PATCH(req: NextRequest) {
  const data = readData();
  if (!data.po_pipeline) data.po_pipeline = [];
  const body = await req.json();
  const { po_id, stage_id, updates } = body;
  if (!po_id || !stage_id || !updates) return NextResponse.json({ error: "po_id, stage_id, updates wajib" }, { status: 400 });

  const pIdx = data.po_pipeline.findIndex((p: any) => p.po_id === Number(po_id));
  if (pIdx === -1) return NextResponse.json({ error: "Pipeline PO tidak ditemukan" }, { status: 404 });

  const stages = data.po_pipeline[pIdx].stages;
  const sIdx = stages.findIndex((s: any) => s.stage_id === stage_id);
  if (sIdx === -1) return NextResponse.json({ error: "Stage tidak ditemukan" }, { status: 404 });

  // Apply the update
  stages[sIdx] = { ...stages[sIdx], ...updates };

  let next_stage = null;

  // CASCADE: if marking as Selesai, auto-advance next active stage to Proses
  if (updates.status === "Selesai") {
    // Find active stages sorted by urutan (use pipeline_stages for urutan reference)
    const stageTemplates = (data.pipeline_stages || []).sort((a: any, b: any) => a.urutan - b.urutan);
    const currentTemplate = stageTemplates.find((t: any) => t.id === stage_id);
    if (currentTemplate) {
      // Find next template by urutan
      const nextTemplate = stageTemplates.find((t: any) => t.urutan > currentTemplate.urutan && t.aktif);
      if (nextTemplate) {
        const nextSIdx = stages.findIndex((s: any) => s.stage_id === nextTemplate.id);
        if (nextSIdx !== -1 && stages[nextSIdx].status === "Menunggu") {
          stages[nextSIdx] = { ...stages[nextSIdx], status: "Proses" };
          next_stage = { stage_id: nextTemplate.id, nama: nextTemplate.nama, slug: nextTemplate.slug };
        }
      }
    }

    // Check if ALL stages are Selesai → mark PO as pipeline complete
    const allDone = stages.filter((s: any) => s.aktif).every((s: any) => s.status === "Selesai");
    if (allDone) {
      // Mark PO as Selesai in po_produksi
      const poIdx = (data.po_produksi || []).findIndex((p: any) => p.id === Number(po_id));
      if (poIdx !== -1) {
        data.po_produksi[poIdx].status = "Pipeline Selesai";
        data.po_produksi[poIdx].pipeline_selesai_tgl = new Date().toISOString().split("T")[0];
      }
    }
  }

  data.po_pipeline[pIdx].updatedAt = new Date().toISOString();

  writeData(data);
  return NextResponse.json({ ...data.po_pipeline[pIdx], next_stage });
}

