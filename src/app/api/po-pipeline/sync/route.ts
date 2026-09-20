import { NextRequest, NextResponse } from "next/server";
import { readData, writeData } from "@/lib/data-store";

export async function POST() {
  const data = readData();
  if (!data.po_pipeline) data.po_pipeline = [];
  if (!data.pipeline_stages) data.pipeline_stages = [];

  const activeStages = data.pipeline_stages
    .filter((s: any) => s.aktif)
    .sort((a: any, b: any) => a.urutan - b.urutan);

  if (activeStages.length === 0) {
    return NextResponse.json({ synced: 0, message: "Tidak ada stage aktif" });
  }

  // Build cmt progress lookup: po_id -> { totalLapor, totalACC }
  const progresLookup: Record<number, { lapor: number; acc: number }> = {};
  for (const rec of (data.cmt_progres || [])) {
    if (!progresLookup[rec.po_id]) progresLookup[rec.po_id] = { lapor: 0, acc: 0 };
    const qty = (rec.items || []).reduce((s: number, i: any) => s + Number(i.jumlah || 0), 0);
    progresLookup[rec.po_id].lapor += qty;
    if (rec.status === "Diverifikasi" || rec.status === "Diterima") {
      progresLookup[rec.po_id].acc += qty;
    }
  }

  // Washing lookup: po_id -> status
  const washingLookup: Record<number, boolean> = {};
  for (const t of (data.produksi_transfers || [])) {
    if (t.ke === "washing" && t.status === "Diverifikasi") washingLookup[t.po_id] = true;
  }

  let synced = 0;

  for (const po of (data.po_produksi || [])) {
    if (data.po_pipeline.find((pp: any) => pp.po_id === po.id)) continue; // already exists

    const prog = progresLookup[po.id] || { lapor: 0, acc: 0 };
    const pctAcc = po.jumlahTerbit > 0 ? (prog.acc / po.jumlahTerbit) * 100 : 0;
    const pctLapor = po.jumlahTerbit > 0 ? (prog.lapor / po.jumlahTerbit) * 100 : 0;
    const jahitSelesai = pctAcc >= 100;
    const jahitProses = pctLapor > 0 || po.vendorId;

    const stages = activeStages.map((s: any) => {
      let status = "Menunggu";
      let selesai_tgl = null;

      if (s.slug === "potong_kain") {
        status = "Selesai";
        selesai_tgl = po.tanggalTerbit ? po.tanggalTerbit.split("T")[0] : null;
      } else if (s.slug === "jahit_kain" || s.slug === "jahit") {
        status = jahitSelesai ? "Selesai" : jahitProses ? "Proses" : "Menunggu";
        if (jahitSelesai) selesai_tgl = new Date().toISOString().split("T")[0];
      } else if (s.slug === "wahing_pakaian" || s.slug === "washing") {
        status = washingLookup[po.id] ? "Selesai" : "Menunggu";
      }

      return {
        stage_id: s.id,
        slug: s.slug,
        nama: s.nama,
        warna: s.warna,
        opsional: s.opsional,
        aktif: true,
        vendor_id: (s.slug === "jahit_kain" || s.slug === "jahit") ? (po.vendorId || null) : null,
        target_selesai: (s.slug === "jahit_kain" || s.slug === "jahit") ? (po.target_selesai || null) : null,
        status,
        selesai_tgl,
        catatan: "",
      };
    });

    data.po_pipeline.push({
      po_id: po.id,
      stages,
      updatedAt: new Date().toISOString(),
      auto_synced: true,
    });
    synced++;
  }

  if (synced > 0) writeData(data);

  return NextResponse.json({
    synced,
    total_po: data.po_produksi?.length || 0,
    total_pipeline: data.po_pipeline.length,
  });
}