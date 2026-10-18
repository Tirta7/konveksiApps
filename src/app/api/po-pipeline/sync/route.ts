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

  // Transfers lookup by po_id: { [po_id]: transfers[] }
  const transfersByPo: Record<number, any[]> = {};
  for (const t of (data.produksi_transfers || [])) {
    if (!transfersByPo[t.po_id]) transfersByPo[t.po_id] = [];
    transfersByPo[t.po_id].push(t);
  }

  let synced = 0;

  for (const po of (data.po_produksi || [])) {
    const pemotongan = (data.pemotongan_kain || []).find((pk: any) => pk.id === po.pemotongan_id);
    const poTargetSelesai = po.target_selesai || pemotongan?.target_selesai || null;

    const prog = progresLookup[po.id] || { lapor: 0, acc: 0 };
    const pctAcc = po.jumlahTerbit > 0 ? (prog.acc / po.jumlahTerbit) * 100 : 0;
    const pctLapor = po.jumlahTerbit > 0 ? (prog.lapor / po.jumlahTerbit) * 100 : 0;
    const jahitSelesai = pctAcc >= 100;
    const jahitProses = pctLapor > 0 || !!po.vendorId;

    const poTransfers = transfersByPo[po.id] || [];

    // Find existing pipeline if any
    const existingIndex = data.po_pipeline.findIndex((pp: any) => pp.po_id === po.id);
    const existingStages = existingIndex !== -1 ? (data.po_pipeline[existingIndex].stages || []) : [];

    const stages = activeStages.map((s: any) => {
      const slugLower = (s.slug || "").toLowerCase();
      const isJahit = slugLower.includes("jahit") || slugLower.includes("cmt");
      const isPotong = slugLower.includes("potong");
      const isWash = slugLower.includes("wash") || slugLower.includes("cuci");

      // Check existing stage entry
      const prev = existingStages.find((es: any) => es.stage_id === s.id);

      let status = "Menunggu";
      let selesai_tgl = null;
      let vendor_id: number | null = null;
      let target_selesai = poTargetSelesai;
      let catatan = "";

      if (isPotong) {
        status = "Selesai";
        selesai_tgl = po.tanggalTerbit ? po.tanggalTerbit.split("T")[0] : null;
        catatan = "Pemotongan kain selesai & SPK diterbitkan";
      } else if (isJahit) {
        vendor_id = po.vendorId || null;
        status = jahitSelesai ? "Selesai" : jahitProses ? "Proses" : "Menunggu";
        if (jahitSelesai) selesai_tgl = prev?.selesai_tgl || new Date().toISOString().split("T")[0];
        catatan = po.catatan || "";
      } else if (isWash) {
        const washTfs = poTransfers.filter(t => t.ke === "washing" || t.ke === s.slug);
        const totalKirim = washTfs.reduce((sum, t) => sum + (Number(t.jumlah_kirim) || 0), 0);
        const totalTerima = washTfs.reduce((sum, t) => sum + (Number(t.jumlah_diterima) || 0), 0);
        const lastTf = washTfs[washTfs.length - 1];

        vendor_id = lastTf?.vendor_id || null;
        target_selesai = lastTf?.target_selesai || poTargetSelesai;

        if (totalTerima >= po.jumlahTerbit && po.jumlahTerbit > 0) {
          status = "Selesai";
          selesai_tgl = prev?.selesai_tgl || new Date().toISOString().split("T")[0];
        } else if (totalKirim > 0) {
          status = "Proses";
        }
        catatan = washTfs.length > 0 ? `${washTfs.length} transfer pengiriman` : "";
      } else {
        const stageTfs = poTransfers.filter(t => t.ke === s.slug);
        const totalKirim = stageTfs.reduce((sum, t) => sum + (Number(t.jumlah_kirim) || 0), 0);
        const totalTerima = stageTfs.reduce((sum, t) => sum + (Number(t.jumlah_diterima) || 0), 0);
        const lastTf = stageTfs[stageTfs.length - 1];

        vendor_id = lastTf?.vendor_id || null;
        target_selesai = lastTf?.target_selesai || poTargetSelesai;

        if (totalTerima >= po.jumlahTerbit && po.jumlahTerbit > 0) {
          status = "Selesai";
          selesai_tgl = prev?.selesai_tgl || new Date().toISOString().split("T")[0];
        } else if (totalKirim > 0) {
          status = "Proses";
        }
      }

      // Preserve manual status if explicitly set
      if (prev && prev.manual_status) {
        status = prev.status;
        selesai_tgl = prev.selesai_tgl;
        if (prev.vendor_id) vendor_id = prev.vendor_id;
        if (prev.target_selesai) target_selesai = prev.target_selesai;
      }

      return {
        stage_id: s.id,
        slug: s.slug,
        nama: s.nama,
        warna: s.warna,
        opsional: s.opsional,
        aktif: true,
        vendor_id,
        target_selesai,
        status,
        selesai_tgl,
        catatan,
      };
    });

    const pipelineEntry = {
      po_id: po.id,
      stages,
      updatedAt: new Date().toISOString(),
      auto_synced: true,
    };

    if (existingIndex !== -1) {
      data.po_pipeline[existingIndex] = pipelineEntry;
    } else {
      data.po_pipeline.push(pipelineEntry);
    }
    synced++;
  }

  if (synced > 0) writeData(data);

  return NextResponse.json({
    synced,
    total_po: data.po_produksi?.length || 0,
    total_pipeline: data.po_pipeline.length,
  });
}