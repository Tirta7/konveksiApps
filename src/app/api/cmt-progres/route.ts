import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";
import { getCmtCompletion, getTransferCompletion } from "@/lib/po-lifecycle";
import { emitEvent } from "@/lib/realtime-hub";
import { sortedStages, findStageByKey, barcodeStatusForStage } from "@/lib/stage-resolve";
import { getSessionFromRequest } from "@/lib/auth";

// ─────────────────────────────────────────────
// GET — Ambil daftar laporan progres
// ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const data = readData();
  if (!data.cmt_progres) data.cmt_progres = [];
  const { searchParams } = new URL(req.url);
  const sess = getSessionFromRequest(req);
  // Sesi vendor hanya melihat laporannya sendiri
  const vendorId = sess?.t === "vendor" ? String(sess.id) : searchParams.get("vendor_id");
  const poId = searchParams.get("po_id");
  const status = searchParams.get("status");

  let list = data.cmt_progres;
  if (vendorId) list = list.filter((p: any) => String(p.vendor_id) === vendorId);
  if (poId)     list = list.filter((p: any) => String(p.po_id) === poId);
  if (status)   list = list.filter((p: any) => p.status === status);

  const stages = data.pipeline_stages || [];
  const withInfo = list.map((p: any) => {
    const vendor = (data.vendors || []).find((v: any) => v.id === p.vendor_id);
    const po     = (data.po_produksi || []).find((po: any) => po.id === p.po_id);
    const transfer = (data.produksi_transfers || []).find((t: any) => t.id === p.transfer_id);
    // Target vendor lanjutan = jatah transfer (dikurangi reject), CMT = jumlah PO
    const targetJumlah = transfer
      ? Math.max(0, Number(transfer.jumlah_kirim || 0) - Number(transfer.jumlah_reject || 0))
      : (po ? po.jumlahTerbit : 0);
    const vendor_tipe = vendor?.tipe || (p.transfer_id ? null : "cmt");
    const stage = stages.find((s: any) => s.vendor_tipe && s.vendor_tipe === vendor_tipe);
    const tahap_nama = stage?.nama || stage?.name || (vendor_tipe ? String(vendor_tipe).charAt(0).toUpperCase() + String(vendor_tipe).slice(1) : null);
    return { ...p, vendor_nama: vendor?.nama || "Unknown", noPo: po?.noPo || "-", model: po?.model || "-", targetJumlah, vendor_tipe, tahap_nama };
  }).reverse();

  return NextResponse.json(withInfo);
}

// ─────────────────────────────────────────────
// POST — Dua mode:
//   1. Submit laporan baru dari vendor  → tidak ada `action` maupun `id`
//   2. ACC / Tolak laporan dari admin   → ada `action` + `id`
// ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json();
  const data = readData();
  const { action, id, distribusi, po_id, vendor_id, items, catatan } = body;

  // Otorisasi: vendor hanya boleh submit laporan miliknya; ACC / Tolak khusus owner/admin
  const sess = getSessionFromRequest(req);
  if (sess?.t === "vendor") {
    if (action || id) return NextResponse.json({ error: "Akses ditolak: ACC / tolak laporan hanya oleh admin" }, { status: 403 });
    if (String(vendor_id) !== String(sess.id)) return NextResponse.json({ error: "Akses ditolak: laporan harus atas nama akun vendor Anda" }, { status: 403 });
    const v = (data.vendors || []).find((x: any) => String(x.id) === String(sess.id));
    if (v && (v.tipe === "cmt" || v.tipe === "jahit")) {
      const po = (data.po_produksi || []).find((p: any) => String(p.id) === String(po_id));
      if (!po || String(po.vendorId) !== String(sess.id)) return NextResponse.json({ error: "Akses ditolak: PO ini bukan milik Anda" }, { status: 403 });
    }
  }

  // ══════════════════════════════════════════
  // MODE 1: SUBMIT LAPORAN BARU DARI VENDOR
  // ══════════════════════════════════════════
  if (!action && !id) {
    if (!po_id || !vendor_id || !items?.length) {
      return NextResponse.json({ error: "Data tidak lengkap (po_id, vendor_id, items wajib)" }, { status: 400 });
    }

    if (!data.cmt_progres) data.cmt_progres = [];

    const totalJumlah = items.reduce((sum: number, i: any) => sum + Number(i.jumlah || 0), 0);

    // Untuk vendor downstream (bukan CMT/jahit) → po_id dari frontend adalah transfer_id
    const vendor = (data.vendors || []).find((v: any) => String(v.id) === String(vendor_id));
    let realPoId = Number(po_id);
    let transferId: number | null = null;

    if (vendor && vendor.tipe !== "cmt" && vendor.tipe !== "jahit") {
      // Downstream: po_id yang dikirim adalah transfer ID
      transferId = Number(po_id);
      const transfer = (data.produksi_transfers || []).find((t: any) => String(t.id) === String(transferId));
      if (!transfer) {
        return NextResponse.json({ error: "Pekerjaan tidak ditemukan. Muat ulang portal.", code: "STALE" }, { status: 409 });
      }
      // Bentrok: admin baru saja menarik / memindahkan pekerjaan ini
      if (String(transfer.vendor_id) !== String(vendor_id) || transfer.is_forwarded || ["Kembali ke Gudang", "Ditolak"].includes(transfer.status)) {
        return NextResponse.json({ error: "Pekerjaan ini baru saja ditarik / dipindahkan oleh admin. Muat ulang portal.", code: "STALE" }, { status: 409 });
      }
      realPoId = Number(transfer.po_id);
    }

    // Validasi: tidak boleh melapor melebihi sisa / melapor pekerjaan yang sudah selesai
    if (totalJumlah <= 0) {
      return NextResponse.json({ error: "Jumlah laporan harus lebih dari 0" }, { status: 400 });
    }
    {
      let c: any = null;
      if (transferId != null) {
        const t = (data.produksi_transfers || []).find((x: any) => String(x.id) === String(transferId));
        if (t) c = getTransferCompletion(data, t);
      } else {
        const po = (data.po_produksi || []).find((p: any) => String(p.id) === String(realPoId));
        if (po) c = getCmtCompletion(data, po);
      }
      if (c) {
        if (c.done) {
          return NextResponse.json({ error: "Pekerjaan ini sudah selesai & di-ACC penuh. Tidak perlu lapor lagi." }, { status: 400 });
        }
        const sisaBolehLapor = Math.max(0, c.jumlah - c.approved - c.pending);
        if (totalJumlah > sisaBolehLapor) {
          return NextResponse.json({
            error: `Jumlah melebihi sisa. Maksimal ${sisaBolehLapor} pcs lagi (sudah ACC ${c.approved}, menunggu ACC ${c.pending} dari ${c.jumlah}).`
          }, { status: 400 });
        }
      }
    }

    const newId = nextId(data, "cmt_progres" as any);
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
    const poR = (data.po_produksi || []).find((p: any) => p.id === realPoId);
    emitEvent("progressReported", { id: newId, vendor_id: Number(vendor_id), vendor_nama: vendor?.nama || "Vendor", po_id: realPoId, no_po: poR?.noPo || "", jumlah: totalJumlah, transfer_id: transferId });
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
  if (action === "reject" || action === "tolak") {
    if (laporan.status !== "Menunggu" && laporan.status !== "Pending") {
      return NextResponse.json({ error: "Hanya laporan pending yang bisa ditolak" }, { status: 400 });
    }
    data.cmt_progres[idx].status = "Ditolak";
    data.cmt_progres[idx].ditolakPada = new Date().toISOString();
    writeData(data);
    emitEvent("reportReviewed", { id: laporan.id, vendor_id: laporan.vendor_id, status: "Ditolak", jumlah: laporan.totalJumlah });
    return NextResponse.json({ success: true });
  }

  // ── TERIMA (ACC) ──
  const ACCEPT_ACTIONS = ["terima", "accept", "acc", "approve", "verifikasi"];
  if (action && !ACCEPT_ACTIONS.includes(String(action).toLowerCase())) {
    return NextResponse.json({ error: `Aksi tidak dikenal: ${action}` }, { status: 400 });
  }
  if (laporan.status === "Diterima") {
    return NextResponse.json({ error: "Laporan sudah diterima" }, { status: 400 });
  }
  if (laporan.status === "Ditolak") {
    return NextResponse.json({ error: "Laporan sudah ditolak. Minta vendor mengirim laporan baru." }, { status: 400 });
  }
  data.cmt_progres[idx].status = "Diterima";
  data.cmt_progres[idx].diterimaPada = new Date().toISOString();

  // Tentukan stage saat ini & berikutnya dari pipeline (hanya tahap AKTIF, tanpa mengubah urutan master)
  const vendorAcc = (data.vendors || []).find((v: any) => String(v.id) === String(laporan.vendor_id));
  const stages = sortedStages(data.pipeline_stages || []);
  const currentStageSlug = vendorAcc?.tipe || "cmt";
  const currentStage = findStageByKey(stages, currentStageSlug, true);
  const currentIdx = currentStage ? stages.findIndex((s: any) => s.id === currentStage.id) : -1;
  const nextStage: any = currentIdx >= 0 && currentIdx < stages.length - 1 ? stages[currentIdx + 1] : null;
  // Kunci `ke` tetap seperti sebelumnya (vendor_tipe tahap berikutnya, kompatibel dengan portal vendor,
  // permintaan kerja & antrean Gudang). Karena vendor_tipe bisa sama dengan slug tahap lain
  // (mis. tahap "Gudang" ber-vendor_tipe "finishing" vs tahap slug "finishing" = "Packing"),
  // tahap tujuan yang PASTI disimpan di `ke_stage_slug` dan dibaca oleh lib/stage-resolve.
  const nextStageSlug = nextStage ? (nextStage.vendor_tipe || nextStage.slug) : "gudang";
  const nextStageExact = nextStage?.slug || null;
  const nextBarcodeStatus = barcodeStatusForStage(nextStage);

  // Update barcode_item status — utamakan pcs yang sedang DIKERJAKAN (milik vendor yang lapor),
  // baru pcs di tahap ini yang belum mulai. Mencegah pcs vendor lain (tahap sama) ikut berpindah.
  if (data.barcode_item) {
    const target = distribusi ? (distribusi[0]?.ke || nextBarcodeStatus) : nextBarcodeStatus;
    const rankAcc = (st: string) => {
      if (st === `${currentStageSlug}_dikerjakan` || st === "cmt_dikerjakan" || st === "potong_dikerjakan" || st === "jahit_dikerjakan") return 0;
      if (st === currentStageSlug || st === "cmt" || st === "potong") return 1;
      return 9;
    };
    for (const item of (laporan.items || [])) {
      const { size, jumlah } = item;
      data.barcode_item
        .filter((b: any) => String(b.poId) === String(laporan.po_id) && b.size === size && rankAcc(b.status) < 9)
        .sort((x: any, y: any) => rankAcc(x.status) - rankAcc(y.status) || x.id - y.id)
        .slice(0, Number(jumlah))
        .forEach((b: any) => { b.status = target; });
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
      ke_stage_slug: nextStageExact,
      dari_stage_slug: currentStage?.slug || null,
      vendor_id: null,
      dari_vendor_id: laporan.vendor_id,
      dari_transfer_id: laporan.transfer_id ?? null,
      dari_laporan_id: laporan.id,
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
        const nIdx = pStages.findIndex((s: any) => s.slug === (nextStageExact || nextStageSlug));
        if (nIdx !== -1 && pStages[nIdx].status === "Menunggu") pStages[nIdx].status = "Proses";
      }
    }
  }

  writeData(data);

  // Info penyelesaian (writeData sudah menjalankan rekonsiliasi otomatis)
  let completion: any = null;
  if (laporan.transfer_id != null) {
    const t = (data.produksi_transfers || []).find((x: any) => String(x.id) === String(laporan.transfer_id));
    if (t) completion = getTransferCompletion(data, t);
  } else {
    const po = (data.po_produksi || []).find((p: any) => String(p.id) === String(laporan.po_id));
    if (po) completion = getCmtCompletion(data, po);
  }
  emitEvent("reportReviewed", { id: laporan.id, vendor_id: laporan.vendor_id, status: "Diterima", jumlah: laporan.totalJumlah, selesai: !!completion?.done });
  return NextResponse.json({
    success: true,
    status: "Diterima",
    pekerjaanSelesai: !!completion?.done,
    terlambatHari: completion?.done ? completion.lateDays : 0,
    sisa: completion?.sisa ?? null,
  });
}

export const PATCH = POST;
