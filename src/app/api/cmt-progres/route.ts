import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";

// ─────────────────────────────────────────────
// GET — Ambil daftar laporan progres
// ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const data = readData();
  if (!data.cmt_progres) data.cmt_progres = [];
  const { searchParams } = new URL(req.url);
  const vendorId = searchParams.get("vendor_id");
  const poId = searchParams.get("po_id");
  const status = searchParams.get("status");

  let list = data.cmt_progres;
  if (vendorId) list = list.filter((p: any) => String(p.vendor_id) === vendorId);
  if (poId)     list = list.filter((p: any) => String(p.po_id) === poId);
  if (status)   list = list.filter((p: any) => p.status === status);

  const withInfo = list.map((p: any) => {
    const vendor = (data.vendors || []).find((v: any) => v.id === p.vendor_id);
    const po     = (data.po_produksi || []).find((po: any) => po.id === p.po_id);
    const transfer = (data.produksi_transfers || []).find((t: any) => t.id === p.transfer_id);
    const targetJumlah = transfer ? transfer.jumlah_kirim : (po ? po.jumlahTerbit : 0);
    return { ...p, vendor_nama: vendor?.nama || "Unknown", noPo: po?.noPo || "-", model: po?.model || "-", targetJumlah };
  }).reverse();

  return NextResponse.json(withInfo);
}

// ─────────────────────────────────────────────
// POST — Dua mode:
//   1. Submit laporan baru dari vendor  → tidak ada `action` maupun `id`
//   2. ACC / Tolak laporan dari admin   → ada `action` + `id`
// ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const data = readData();
  const body = await req.json();
  const { action, id, distribusi, po_id, vendor_id, items, catatan } = body;

  // ══════════════════════════════════════════
  // MODE 1: SUBMIT LAPORAN BARU DARI VENDOR
  // ══════════════════════════════════════════
  if (!action && !id) {
    if (!po_id || !vendor_id || !items?.length) {
      return NextResponse.json({ error: "Data tidak lengkap (po_id, vendor_id, items wajib)" }, { status: 400 });
    }

    if (!data.cmt_progres) data.cmt_progres = [];

    const totalJumlah = items.reduce((sum: number, i: any) => sum + Number(i.jumlah || 0), 0);
    const newId = nextId(data, "cmt_progres" as any);

    // Untuk vendor downstream (bukan CMT/jahit) → po_id dari frontend adalah transfer_id
    const vendor = (data.vendors || []).find((v: any) => String(v.id) === String(vendor_id));
    let realPoId = Number(po_id);
    let transferId: number | null = null;

    if (vendor && vendor.tipe !== "cmt" && vendor.tipe !== "jahit") {
      // Downstream: po_id yang dikirim adalah transfer ID
      transferId = Number(po_id);
      const transfer = (data.produksi_transfers || []).find((t: any) => String(t.id) === String(transferId));
      if (transfer) {
        realPoId = Number(transfer.po_id);
      }
    }

    data.cmt_progres.push({
      id: newId,
      po_id: realPoId,
      vendor_id: Number(vendor_id),
      transfer_id: transferId,
      items,
      totalJumlah,
      catatan: catatan || "",
      status: "Menunggu",
      createdAt: new Date().toISOString(),
    });

    writeData(data);
    return NextResponse.json({ success: true, id: newId });
  }

  // ══════════════════════════════════════════
  // MODE 2: ACC / TOLAK LAPORAN (Admin)
  // ══════════════════════════════════════════
  if (!data.cmt_progres) return NextResponse.json({ error: "Belum ada progres" }, { status: 404 });
  const idx = data.cmt_progres.findIndex((p: any) => String(p.id) === String(id));
  if (idx === -1) return NextResponse.json({ error: "Laporan tidak ditemukan" }, { status: 404 });

  const laporan = data.cmt_progres[idx];

  // ── TOLAK ──
  if (action === "reject") {
    if (laporan.status !== "Menunggu" && laporan.status !== "Pending") {
      return NextResponse.json({ error: "Hanya laporan pending yang bisa ditolak" }, { status: 400 });
    }
    data.cmt_progres[idx].status = "Ditolak";
    data.cmt_progres[idx].ditolakPada = new Date().toISOString();
    writeData(data);
    return NextResponse.json({ success: true });
  }

  // ── TERIMA (ACC) ──
  if (laporan.status === "Diterima") {
    return NextResponse.json({ error: "Laporan sudah diterima" }, { status: 400 });
  }
  data.cmt_progres[idx].status = "Diterima";
  data.cmt_progres[idx].diterimaPada = new Date().toISOString();

  // Tentukan stage saat ini & berikutnya dari pipeline
  const vendorAcc = (data.vendors || []).find((v: any) => String(v.id) === String(laporan.vendor_id));
  const stages = (data.pipeline_stages || []).sort((a: any, b: any) => a.urutan - b.urutan);
  const currentIdx = stages.findIndex((s: any) => s.vendor_tipe === vendorAcc?.tipe);
  let nextStageSlug = "gudang";
  if (currentIdx >= 0 && currentIdx < stages.length - 1) {
    nextStageSlug = stages[currentIdx + 1].vendor_tipe || stages[currentIdx + 1].slug;
  }
  const currentStageSlug = vendorAcc?.tipe || "cmt";

  // Update barcode_item status
  if (data.barcode_item) {
    for (const item of (laporan.items || [])) {
      const { size, jumlah } = item;
      let updated = 0;
      for (let i = 0; i < data.barcode_item.length && updated < Number(jumlah); i++) {
        const b = data.barcode_item[i];
        if (
          String(b.poId) === String(laporan.po_id) &&
          b.size === size &&
          (
            b.status === currentStageSlug || b.status === `${currentStageSlug}_dikerjakan` ||
            b.status === "cmt" || b.status === "potong" ||
            b.status === "cmt_dikerjakan" || b.status === "potong_dikerjakan" || b.status === "jahit_dikerjakan"
          )
        ) {
          data.barcode_item[i].status = distribusi ? (distribusi[0]?.ke || nextStageSlug) : nextStageSlug;
          updated++;
        }
      }
    }
  }

  // Catat po_pengambilan
  if (!data.po_pengambilan) data.po_pengambilan = [];
  data.po_pengambilan.push({
    id: nextId(data, "po_pengambilan"),
    poId: laporan.po_id,
    jumlahDiambil: laporan.totalJumlah,
    items: laporan.items,
    tanggal: new Date().toISOString(),
    keterangan: `Laporan progres ACC. ${laporan.catatan || ""}`.trim(),
    laporanId: laporan.id,
  });

  if (!data.produksi_transfers) data.produksi_transfers = [];
  if (!data.po_ledgers) data.po_ledgers = [];

  if (distribusi && Array.isArray(distribusi) && distribusi.length > 0) {
    // Distribusi khusus ke beberapa vendor
    for (const dist of distribusi) {
      data.produksi_transfers.push({
        id: nextId(data, "produksi_transfers" as any),
        po_id: laporan.po_id,
        dari: currentStageSlug,
        ke: dist.ke,
        vendor_id: dist.vendor_id || null,
        jumlah_kirim: dist.jumlah,
        sizeBreakdown: dist.sizeBreakdown || [],
        target_selesai: dist.target_selesai || null,
        catatan: `Distribusi ACC ${currentStageSlug} -> ${dist.ke}`,
        status: "Proses",
        tanggal_kirim: new Date().toISOString(),
      });
      data.po_ledgers.push({
        id: nextId(data, "po_ledgers"),
        poId: laporan.po_id,
        dari_vendor_id: String(laporan.vendor_id),
        ke_vendor_id: dist.vendor_id ? String(dist.vendor_id) : "STANDBY",
        jumlah: dist.jumlah,
        tanggal: new Date().toISOString(),
        catatan: "ACC Progres Otomatis (Distribusi Khusus)",
      });
    }
    if (data.po_pipeline) {
      const pIdx = data.po_pipeline.findIndex((p: any) => String(p.po_id) === String(laporan.po_id));
      if (pIdx !== -1) {
        const pStages = data.po_pipeline[pIdx].stages;
        const nIdx = pStages.findIndex((s: any) => s.slug === distribusi[0].ke);
        if (nIdx !== -1 && pStages[nIdx].status === "Menunggu") pStages[nIdx].status = "Proses";
      }
    }
  } else {
    // Otomatis ke standby pool tahap berikutnya
    data.produksi_transfers.push({
      id: nextId(data, "produksi_transfers" as any),
      po_id: laporan.po_id,
      dari: currentStageSlug,
      ke: nextStageSlug,
      vendor_id: null,
      dari_vendor_id: laporan.vendor_id,
      jumlah_kirim: laporan.totalJumlah,
      sizeBreakdown: laporan.items || [],
      catatan: "Otomatis dari ACC Progres",
      status: nextStageSlug === "gudang" ? "Selesai" : "Pending",
      tanggal_kirim: new Date().toISOString(),
    });
    data.po_ledgers.push({
      id: nextId(data, "po_ledgers"),
      poId: laporan.po_id,
      dari_vendor_id: String(laporan.vendor_id),
      ke_vendor_id: nextStageSlug === "gudang" ? "GUDANG" : "STANDBY",
      jumlah: laporan.totalJumlah,
      tanggal: new Date().toISOString(),
      catatan: "ACC Progres Otomatis ke Standby Pool",
    });
    if (data.po_pipeline) {
      const pIdx = data.po_pipeline.findIndex((p: any) => String(p.po_id) === String(laporan.po_id));
      if (pIdx !== -1) {
        const pStages = data.po_pipeline[pIdx].stages;
        const nIdx = pStages.findIndex((s: any) => s.slug === nextStageSlug);
        if (nIdx !== -1 && pStages[nIdx].status === "Menunggu") pStages[nIdx].status = "Proses";
      }
    }
  }

  writeData(data);
  return NextResponse.json({ success: true, status: "Diterima" });
}

export const PATCH = POST;
