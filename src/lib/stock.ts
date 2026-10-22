/**
 * Gudang & Stok (Barang Jadi) — satu sumber kebenaran stok barang yang sudah selesai diproses.
 *
 * Alur (mendukung setoran vendor BERTAHAP):
 *  1. Vendor lanjutan (washing, bersih benang, packing, dll) menyetor hasil sebagian-sebagian lewat laporan
 *     progres. Setiap laporan yang di-ACC admin menjadi "standby pool" (produksi_transfer tanpa vendor).
 *     Pool hasil vendor lanjutan, barang terverifikasi di Gudang Produksi, dan pekerjaan vendor yang di-ACC
 *     manual = "holding" → muncul di antrean "Siap Masuk Gudang" sebesar SISA yang belum dipindah.
 *  2. Admin memindahkan sebagian/semua sisa → `stock_movements` jenis "masuk" (beri nama barang + SKU),
 *     dan bisa mencatat reject per size → jenis "reject" (tidak menambah stok). Jumlah di holding dikurangi;
 *     holding baru ditutup (`is_forwarded`) jika sisanya 0. Sisa lain tetap di antrean / tetap di vendor.
 *  3. Sisa yang masih di vendor dapat ditutup sebagai reject (`transfer.reject_items`) sehingga pekerjaan
 *     vendor selesai = barang bagus (ACC) + reject.
 *  4. Barang keluar (penjualan, retur, sample, dll) dicatat sebagai movement "keluar".
 *  5. Stok saat ini = Σ masuk − Σ keluar per barang & size (dihitung dari ledger, bukan disimpan).
 */
import { getTransferCompletion, transferReports, REPORT_APPROVED, REPORT_PENDING } from "@/lib/po-lifecycle";
import { nextId } from "@/lib/data-store";
import { findStageByKey, transferTargetStage } from "@/lib/stage-resolve";

export type SizeQty = { size: string; jumlah: number };

export const normalizeStage = (slug?: string) => {
  const s = (slug || "").toLowerCase();
  if (s.includes("wash") || s.includes("cuci")) return "washing";
  if (s.includes("jahit") || s.includes("cmt")) return "cmt";
  if (s.includes("potong")) return "potong";
  if (s.includes("benang")) return "bersih_benang";
  if (s.includes("qc") || s.includes("gudang")) return "gudang";
  if (s.includes("pack") || s.includes("finishing")) return "finishing";
  if (s.includes("siap_jual")) return "siap_jual";
  return s;
};

const sumQty = (arr?: SizeQty[]) => (arr || []).reduce((s, x) => s + Number(x?.jumlah || 0), 0);

function activeStages(data: any): any[] {
  return (data.pipeline_stages || []).filter((s: any) => s.aktif).sort((a: any, b: any) => a.urutan - b.urutan);
}

function findStageIndex(stages: any[], slug?: string): number {
  if (!slug) return -1;
  const st = findStageByKey(stages, slug);
  return st ? stages.findIndex((s) => s === st) : -1;
}

export function stageName(data: any, slug?: string): string {
  const stages = activeStages(data);
  const i = findStageIndex(stages, slug);
  if (i !== -1) return stages[i].nama;
  const fallback: Record<string, string> = {
    washing: "Washing", cmt: "Penjahit (CMT)", gudang: "Gudang Produksi",
    bersih_benang: "Bersih Benang", finishing: "Packing / Finishing", siap_jual: "QC Siap Jual", potong: "Potong",
  };
  return fallback[normalizeStage(slug)] || slug || "-";
}

/** Nama tahap TUJUAN sebuah transfer (memperhitungkan pool ACC yang menulis vendor_tipe). */
export function transferStageName(data: any, t: any): string {
  const st = transferTargetStage(activeStages(data), t);
  return st?.nama || stageName(data, t?.ke);
}

/**
 * Ringkasan pekerjaan vendor untuk satu tahap (default: washing) per PO.
 *  kirim    : total pcs yang dikirim ke vendor tahap ini
 *  approved : setoran yang sudah di-ACC
 *  reject   : dinyatakan reject di vendor
 *  proses   : masih di vendor (kirim − approved − reject)
 * Hanya transfer ke VENDOR (pool / penarikan tidak dihitung) & tahap dicocokkan via resolver bersama.
 */
export function vendorStageSummary(data: any, poId: any, stageNorm: string = "washing") {
  const stages = activeStages(data);
  let kirim = 0, approved = 0, reject = 0;
  for (const t of (data.produksi_transfers || [])) {
    if (String(t.po_id) !== String(poId) || t.vendor_id == null || isDitolak(t)) continue;
    const st = transferTargetStage(stages, t);
    if (normalizeStage(st?.slug || t.ke) !== stageNorm && normalizeStage(st?.vendor_tipe || "") !== stageNorm) continue;
    const c = getTransferCompletion(data, t);
    kirim += Number(t.jumlah_kirim || 0);
    approved += c.approved;
    reject += Number(t.jumlah_reject || 0);
  }
  return { kirim, approved, reject, proses: Math.max(0, kirim - approved - reject) };
}

// ─── Helper jumlah per size ───────────────────────────────────────────
export const toSizeMap = (arr?: any[]): Record<string, number> => {
  const m: Record<string, number> = {};
  for (const s of arr || []) {
    if (!s || s.size == null) continue;
    const k = String(s.size);
    m[k] = (m[k] || 0) + Number(s.jumlah || 0);
  }
  return m;
};
export const fromSizeMap = (m: Record<string, number>): SizeQty[] =>
  Object.entries(m).filter(([, j]) => j > 0).map(([size, jumlah]) => ({ size, jumlah }));

/** Kurangi list size (mempertahankan properti lain seperti `max`), buang yang 0. */
function subtractList(list: any[] | undefined, used: Record<string, number>): any[] {
  return (list || [])
    .map((s: any) => ({ ...s, jumlah: Math.max(0, Number(s.jumlah || 0) - (used[String(s.size)] || 0)) }))
    .filter((s: any) => s.jumlah > 0);
}

const isDitolak = (t: any) => String(t.catatan_terima || "").toUpperCase() === "DITOLAK";
const TERMINAL_VENDOR = new Set(["Selesai", "Diverifikasi", "Kembali ke Gudang", "Ditarik Penuh"]);

/** Laporan vendor lanjutan per size: sudah ACC (sudah jadi standby pool) & menunggu ACC. */
export function reportSizes(data: any, t: any) {
  const approved: Record<string, number> = {};
  const pending: Record<string, number> = {};
  for (const r of transferReports(data, t)) {
    const target = REPORT_APPROVED.has(r.status) ? approved : REPORT_PENDING.has(r.status) ? pending : null;
    if (!target) continue;
    for (const it of r.items || []) target[String(it.size)] = (target[String(it.size)] || 0) + Number(it.jumlah || 0);
  }
  return { approved, pending };
}

/** Barang yang masih fisik di vendor (belum disetor/ACC & belum dinyatakan reject). */
export function vendorRemaining(data: any, t: any) {
  const c = getTransferCompletion(data, t);
  const base = toSizeMap(t.sizeBreakdown);
  const { approved, pending } = reportSizes(data, t);
  const rej = toSizeMap(t.reject_items);
  const sisa: Record<string, number> = {};
  const bisaTutup: Record<string, number> = {};
  for (const size of Object.keys(base)) {
    const s = Math.max(0, base[size] - (approved[size] || 0) - (rej[size] || 0));
    sisa[size] = s;
    bisaTutup[size] = Math.max(0, s - (pending[size] || 0));
  }
  const reject = Number(t.jumlah_reject || 0);
  const sizes = fromSizeMap(sisa);
  const total = Object.keys(base).length ? sumQty(sizes) : Math.max(0, Number(t.jumlah_kirim || 0) - c.approved - reject);
  const bisa = fromSizeMap(bisaTutup);
  return {
    sizes,
    total,
    bisa_tutup: bisa,
    bisa_tutup_total: Object.keys(base).length ? sumQty(bisa) : Math.max(0, total - c.pending),
    approved: c.approved,
    pending: c.pending,
    reject,
    lateDays: c.lateDays,
  };
}

export type HoldingKind = "pool" | "gudang" | "vendor_acc" | "siap_jual";

/**
 * Barang selesai yang sedang "ditampung" sebuah transfer dan bisa dipindah ke Gudang & Stok.
 *  - pool       : standby pool hasil setoran vendor lanjutan (dibuat saat laporan progres di-ACC)
 *  - gudang     : barang yang sudah diverifikasi di Gudang Produksi
 *  - vendor_acc : pekerjaan vendor yang di-ACC manual admin (tanpa laporan) → dikurangi yang sudah jadi pool
 *  - siap_jual  : hasil QC finishing
 */
export function holdingOf(data: any, t: any): { kind: HoldingKind; sizes: SizeQty[]; total: number } | null {
  if (!t || t.is_forwarded || isDitolak(t)) return null;
  const ke = normalizeStage(t.ke);
  if (ke === "cmt" || ke === "potong") return null;

  let kind: HoldingKind;
  let base: any[] = [];
  let baseTotal = 0;
  let minus: Record<string, number> = {};
  if (ke === "gudang" || ke === "siap_jual") {
    if (t.status !== "Diverifikasi") return null;
    kind = ke as HoldingKind;
    if (t.sizeBreakdown_diterima != null || t.jumlah_diterima != null || t.jumlah_diterima_awal != null) {
      base = t.sizeBreakdown_diterima || [];
      baseTotal = Number(t.jumlah_diterima || 0);
    } else {
      base = t.sizeBreakdown || [];
      baseTotal = Number(t.jumlah_kirim || 0);
    }
  } else if (t.vendor_id == null) {
    const dari = normalizeStage(t.dari);
    if (!dari || dari === "cmt" || dari === "potong" || t.status === "Ditarik Penuh") return null;
    kind = "pool";
    base = t.sizeBreakdown || [];
    baseTotal = Number(t.jumlah_kirim || 0);
  } else if (t.status === "Diverifikasi") {
    kind = "vendor_acc";
    base = t.sizeBreakdown_diterima || t.sizeBreakdown || [];
    baseTotal = Number(t.jumlah_diterima ?? t.jumlah_kirim ?? 0);
    minus = reportSizes(data, t).approved; // setoran yang sudah di-ACC sudah menjadi standby pool
  } else {
    return null;
  }

  const m = toSizeMap(base);
  for (const [size, j] of Object.entries(minus)) if (m[size] != null) m[size] = Math.max(0, m[size] - j);
  const sizes = fromSizeMap(m);
  const minusTotal = Object.values(minus).reduce((s, x) => s + x, 0);
  const total = Object.keys(toSizeMap(base)).length ? sumQty(sizes) : Math.max(0, baseTotal - minusTotal);
  if (total <= 0) return null;
  return { kind, sizes, total };
}

/** Kurangi jumlah yang ditampung transfer setelah sebagian dipindah (masuk stok / reject / dikirim). */
export function deductHolding(t: any, kind: HoldingKind, used: Record<string, number>, usedTotal: number) {
  if (kind === "pool") {
    if (t.jumlah_kirim_awal == null) {
      t.jumlah_kirim_awal = Number(t.jumlah_kirim || 0);
      t.sizeBreakdown_awal = JSON.parse(JSON.stringify(t.sizeBreakdown || []));
    }
    t.sizeBreakdown = subtractList(t.sizeBreakdown, used);
    t.jumlah_kirim = Math.max(0, Number(t.jumlah_kirim || 0) - usedTotal);
  } else {
    if (t.jumlah_diterima_awal == null) {
      t.jumlah_diterima_awal = Number(t.jumlah_diterima ?? t.jumlah_kirim ?? 0);
      t.sizeBreakdown_diterima_awal = JSON.parse(JSON.stringify(t.sizeBreakdown_diterima || t.sizeBreakdown || []));
    }
    t.sizeBreakdown_diterima = subtractList(t.sizeBreakdown_diterima || t.sizeBreakdown, used);
    t.jumlah_diterima = Math.max(0, Number(t.jumlah_diterima ?? t.jumlah_kirim ?? 0) - usedTotal);
  }
}

/** Kembalikan kuota holding dan aktifkan kembali transfer saat nota reject dibatalkan. */
export function restoreHolding(t: any, restoredSizes: SizeQty[], restoredTotal: number) {
  if (!t || restoredTotal <= 0) return;

  const toAdd: Record<string, number> = {};
  for (const it of restoredSizes || []) {
    const qty = Number(it.jumlah ?? (it as any).reject ?? 0);
    if (it.size && qty > 0) {
      toAdd[it.size] = (toAdd[it.size] || 0) + qty;
    }
  }

  const addToList = (list: any[] = []): SizeQty[] => {
    const map: Record<string, number> = {};
    for (const it of list) {
      if (it.size) map[it.size] = (map[it.size] || 0) + Number(it.jumlah || 0);
    }
    for (const [sz, qty] of Object.entries(toAdd)) {
      map[sz] = (map[sz] || 0) + qty;
    }
    return Object.entries(map).map(([size, jumlah]) => ({ size, jumlah }));
  };

  const dari = normalizeStage(t.dari);
  const ke = normalizeStage(t.ke);
  const isHoldingPenerimaan = ke === "gudang" || ke === "siap_jual" || t.jumlah_diterima_awal != null || t.sizeBreakdown_diterima_awal != null;

  if (isHoldingPenerimaan) {
    t.sizeBreakdown_diterima = addToList(t.sizeBreakdown_diterima || []);
    t.jumlah_diterima = Number(t.jumlah_diterima || 0) + restoredTotal;
  } else if (t.vendor_id == null && dari && dari !== "cmt" && dari !== "potong") {
    t.sizeBreakdown = addToList(t.sizeBreakdown || []);
    t.jumlah_kirim = Number(t.jumlah_kirim || 0) + restoredTotal;
  } else {
    if (t.sizeBreakdown_diterima) {
      t.sizeBreakdown_diterima = addToList(t.sizeBreakdown_diterima);
    } else {
      t.sizeBreakdown = addToList(t.sizeBreakdown || []);
    }
    if (t.jumlah_diterima != null) {
      t.jumlah_diterima = Number(t.jumlah_diterima || 0) + restoredTotal;
    } else {
      t.jumlah_kirim = Number(t.jumlah_kirim || 0) + restoredTotal;
    }
  }

  // Kurangi reject_qty yang tercatat
  t.reject_qty = Math.max(0, Number(t.reject_qty || 0) - restoredTotal);

  // Aktifkan kembali holding agar kembali muncul di antrean Gudang & Stok
  t.stocked = false;
  t.is_forwarded = false;

  // Pastikan status transfer aktif agar terdeteksi oleh holdingOf
  if (ke === "gudang" || ke === "siap_jual") {
    t.status = "Diverifikasi";
  } else if (t.status === "Selesai" || t.status === "Reject") {
    t.status = t.jumlah_diterima ? "Diverifikasi" : "Dikerjakan";
  }
}

/** Tahap yang barusan diselesaikan oleh holding (untuk label "Selesai Washing" & status barcode). */
function holdingStage(kind: HoldingKind, t: any): string {
  return kind === "pool" ? t.dari : t.ke;
}

/** Antrean barang yang sudah selesai diproses dan siap dimasukkan ke Gudang & Stok (sisa per holding). */
export function getStockInbound(data: any): any[] {
  const stages = activeStages(data);
  const out: any[] = [];
  for (const t of (data.produksi_transfers || [])) {
    const h = holdingOf(data, t);
    if (!h) continue;

    const po = (data.po_produksi || []).find((p: any) => String(p.id) === String(t.po_id));
    const doneSlug = holdingStage(h.kind, t);
    const vendorId = h.kind === "pool" ? (t.dari_vendor_id ?? null) : h.kind === "vendor_acc" ? t.vendor_id : null;
    const vendor = vendorId != null ? (data.vendors || []).find((v: any) => String(v.id) === String(vendorId)) : null;
    const idx = findStageIndex(stages, doneSlug);
    const nextStages = idx === -1 ? [] : stages.slice(idx + 1).filter((s: any) => !["potong", "cmt", "gudang"].includes(normalizeStage(s.slug)));
    const jumlahAwal = h.kind === "pool"
      ? Number(t.jumlah_kirim_awal ?? t.jumlah_kirim ?? 0)
      : Number(t.jumlah_diterima_awal ?? t.jumlah_diterima ?? t.jumlah_kirim ?? 0);

    out.push({
      transfer_id: t.id,
      kind: h.kind,
      po_id: t.po_id,
      noPo: po?.noPo || `PO #${t.po_id}`,
      model: po?.model || "-",
      kategori: po?.model || "Tanpa Kategori",
      tahap: h.kind === "gudang" ? "Gudang Produksi" : h.kind === "siap_jual" ? "QC Siap Jual" : stageName(data, doneSlug),
      tahap_slug: doneSlug,
      vendor_id: vendorId,
      vendor_nama: vendor?.nama || (h.kind === "gudang" ? "Gudang Produksi" : h.kind === "siap_jual" ? "QC Finishing" : "-"),
      jumlah: h.total,
      sizes: h.sizes,
      jumlah_awal: Math.max(jumlahAwal, h.total),
      sudah_masuk: Number(t.stocked_qty || 0),
      sudah_reject: Number(t.reject_qty || 0),
      ledger_from: h.kind === "pool" ? (normalizeStage(t.ke) === "gudang" ? "GUDANG" : "STANDBY") : h.kind === "vendor_acc" ? String(t.vendor_id) : "GUDANG",
      selesai_at: t.tanggal_terima || t.selesai_at || t.tanggal_kirim,
      tahap_berikutnya: nextStages.map((s: any) => s.nama),
      is_final: nextStages.length === 0,
    });
  }
  return out.sort((a, b) => new Date(b.selesai_at || 0).getTime() - new Date(a.selesai_at || 0).getTime());
}

/** Pekerjaan vendor lanjutan yang masih berjalan (barang masih di vendor). */
export function getVendorWip(data: any): any[] {
  const out: any[] = [];
  for (const t of (data.produksi_transfers || [])) {
    if (t.vendor_id == null || t.is_forwarded || isDitolak(t) || TERMINAL_VENDOR.has(t.status)) continue;
    const ke = normalizeStage(t.ke);
    if (["cmt", "potong", "gudang", "siap_jual"].includes(ke)) continue;
    const r = vendorRemaining(data, t);
    if (r.total <= 0) continue;
    const po = (data.po_produksi || []).find((p: any) => String(p.id) === String(t.po_id));
    const vendor = (data.vendors || []).find((v: any) => String(v.id) === String(t.vendor_id));
    out.push({
      transfer_id: t.id,
      po_id: t.po_id,
      noPo: po?.noPo || `PO #${t.po_id}`,
      model: po?.model || "-",
      tahap: stageName(data, t.ke),
      tahap_slug: t.ke,
      vendor_id: t.vendor_id,
      vendor_nama: vendor?.nama || "-",
      jumlah_kirim: Number(t.jumlah_kirim_awal ?? t.jumlah_kirim ?? 0),
      approved: r.approved,
      pending: r.pending,
      reject: r.reject,
      sisa: r.total,
      sizes: r.sizes,
      bisa_tutup: r.bisa_tutup,
      bisa_tutup_total: r.bisa_tutup_total,
      target_selesai: t.target_selesai || null,
      lateDays: r.lateDays,
      tanggal_kirim: t.tanggal_kirim,
    });
  }
  return out.sort((a, b) => new Date(a.tanggal_kirim || 0).getTime() - new Date(b.tanggal_kirim || 0).getTime());
}

/** Rekap per PO: berapa sudah masuk gudang, reject, antre, dan masih di vendor. */
export function getPoStockProgress(data: any, inbound: any[], wip: any[]) {
  const map: Record<string, any> = {};
  const row = (poId: any) => {
    const k = String(poId);
    if (!map[k]) {
      const po = (data.po_produksi || []).find((p: any) => String(p.id) === k);
      map[k] = { po_id: poId, noPo: po?.noPo || `PO #${poId}`, model: po?.model || "-", terbit: Number(po?.jumlahTerbit || 0), masuk: 0, reject: 0, antre: 0, di_vendor: 0 };
    }
    return map[k];
  };
  for (const m of (data.stock_movements || [])) {
    if (m.po_id == null) continue;
    if (m.jenis === "masuk") row(m.po_id).masuk += Number(m.jumlah || 0);
    else if (m.jenis === "reject") row(m.po_id).reject += Number(m.jumlah || 0);
  }
  for (const r of inbound) row(r.po_id).antre += r.jumlah;
  for (const w of wip) row(w.po_id).di_vendor += w.sisa;
  return Object.values(map);
}

/**
 * Ubah status barcode produksi untuk sejumlah pcs per size.
 * prefer = "at_stage" (default): utamakan pcs yang masih di tahap terkait (mis. reject di vendor).
 * prefer = "done": utamakan pcs yang SUDAH selesai dari tahap itu (sudah di-ACC / antre gudang),
 *                  baru kemudian pcs di tahap itu, dan terakhir pcs yang sedang dikerjakan vendor.
 */
export function markBarcodes(data: any, poId: any, items: SizeQty[], stageSlug: string, patch: (b: any) => void, prefer: "at_stage" | "done" = "at_stage") {
  if (!data.barcode_item) return;
  const keNorm = normalizeStage(stageSlug);
  const blocked = new Set(["siap_jual", "terjual", "keluar", "reject", "retur_banding"]);
  const rank = (st: string) => {
    const s = String(st);
    const dikerjakan = s.endsWith("_dikerjakan");
    const n = normalizeStage(s.replace(/_dikerjakan$/, ""));
    if (n === "cmt" || n === "potong") return 9;
    if (prefer === "done") {
      if (n === keNorm) return dikerjakan ? 3 : 2; // masih di vendor tahap ini
      return 0; // sudah lewat tahap ini (gudang / tahap berikutnya)
    }
    if (n === keNorm) return 0;
    return 1;
  };
  for (const it of items) {
    data.barcode_item
      .filter((b: any) => String(b.poId) === String(poId) && b.size === it.size && !blocked.has(b.status) && rank(b.status) < 9)
      .sort((x: any, y: any) => rank(x.status) - rank(y.status) || x.id - y.id)
      .slice(0, it.jumlah)
      .forEach(patch);
  }
}

/** Kembalikan status barcode reject ke status aktif (mis. siap_jual / tahap sebelumnya) saat nota reject dibatalkan. */
export function unmarkBarcodes(data: any, poId: any, items: SizeQty[], fallbackStatus: string = "gudang", noNota?: string) {
  if (!data?.barcode_item) return;
  for (const it of items || []) {
    const qty = Number(it.jumlah ?? (it as any).reject ?? 0);
    const all = data.barcode_item.filter((b: any) => String(b.poId) === String(poId) && (it.size === "ALL" || b.size === it.size) && b.status === "reject");
    // Prioritaskan pcs yang memang ditandai oleh nota ini
    const list = [...all.filter((b: any) => noNota && b.no_nota_reject === noNota), ...all.filter((b: any) => !(noNota && b.no_nota_reject === noNota))].slice(0, qty);
    for (const b of list) {
      // Jangan langsung siap_jual: pcs belum masuk Gudang & Stok (belum punya barang/SKU)
      const prev = b.status_sebelum_reject;
      b.status = prev && prev !== "siap_jual" && prev !== "terjual" ? prev : fallbackStatus;
      delete b.rejectAt;
      delete b.no_nota_reject;
      delete b.status_sebelum_reject;
    }
  }
}

/** Catat barang reject (tidak menambah stok) + tandai barcode + ledger + terbitkan Nota Reject & Klaim Vendor. */
export function recordReject(data: any, p: {
  po_id: any;
  items: SizeQty[];
  sumber: string;
  tahap_slug: string;
  transfer_id?: any;
  vendor_id?: any;
  vendor_nama?: string;
  ledger_from: string;
  keterangan?: string;
  now: string;
  biaya_per_pcs?: number;
  total_klaim?: number;
  tindakan_klaim?: string;
  tukang_potong?: string;
  nama_kain?: string;
  pos_asal?: string;
  pos_tujuan?: string;
  jumlah_kirim?: number;
  jumlah_diterima?: number;
}): { movement_id: number; nota: any; nota_id: number; no_nota: string } | null {
  const items = p.items.filter((i) => i.jumlah > 0);
  const jumlah = sumQty(items);
  if (jumlah <= 0) return null;

  const po = (data.po_produksi || []).find((x: any) => String(x.id) === String(p.po_id));
  const t = p.transfer_id != null ? (data.produksi_transfers || []).find((x: any) => String(x.id) === String(p.transfer_id)) : null;
  const vendorId = p.vendor_id ?? t?.vendor_id ?? t?.dari_vendor_id ?? null;
  const vendor = (data.vendors || []).find((v: any) => String(v.id) === String(vendorId));

  // 1. Buat Nota Reject & Klaim Vendor resmi
  if (!data.nota_reject_vendor) data.nota_reject_vendor = [];
  const notaId = nextId(data, "nota_reject_vendor" as any);
  const dateStr = p.now.slice(0, 10).replace(/-/g, "");
  const noNota = `REJ-${dateStr}-${String(notaId).padStart(3, "0")}`;

  const biayaPerPcs = p.biaya_per_pcs ?? (Number(vendor?.tarif || 0) || (Number(po?.biaya_total || 0) && Number(po?.jumlahTerbit || 0) ? Math.round(Number(po.biaya_total) / Number(po.jumlahTerbit)) : 0));
  const totalKlaim = p.total_klaim ?? (jumlah * biayaPerPcs);

  const notaObj: any = {
    id: notaId,
    no_nota: noNota,
    transfer_id: p.transfer_id ?? (t?.id || null),
    po_id: p.po_id,
    noPo: po?.noPo || (p.po_id ? `PO #${p.po_id}` : ""),
    model: po?.model || "-",
    vendor_id: vendor?.id || vendorId,
    vendor_nama: vendor?.nama || p.vendor_nama || p.sumber || "Vendor",
    vendor_kontak: vendor?.kontak || vendor?.telepon || "",
    pos_asal: p.pos_asal || stageName(data, p.tahap_slug) || t?.dari || "Vendor",
    pos_tujuan: p.pos_tujuan || t?.ke || "Gudang",
    jumlah_kirim: Number(p.jumlah_kirim ?? t?.jumlah_kirim ?? jumlah),
    jumlah_diterima: Number(p.jumlah_diterima ?? t?.jumlah_diterima ?? 0),
    jumlah_reject: jumlah,
    rincian_reject: items.map((i) => ({ size: i.size, jumlah: i.jumlah, alasan: p.keterangan || "Reject / cacat produksi" })),
    tukang_potong: p.tukang_potong || po?.tukang_potong || null,
    nama_kain: p.nama_kain || po?.nama_kain || po?.kain || null,
    alasan_reject: p.keterangan || "Reject / cacat produksi saat pemeriksaan",
    biaya_per_pcs: biayaPerPcs,
    total_klaim: totalKlaim,
    tindakan_klaim: p.tindakan_klaim || "potong_tagihan",
    status_klaim: "Diajukan",
    tanggal_klaim: p.now,
    catatan: p.keterangan || "",
  };
  data.nota_reject_vendor.unshift(notaObj);

  if (t) {
    t.nota_reject_id = notaId;
    t.no_nota_reject = noNota;
  }

  // 2. Catat ke retur_produksi
  if (!data.retur_produksi) data.retur_produksi = [];
  data.retur_produksi.push({
    id: nextId(data, "retur_produksi" as any),
    no_nota: noNota,
    po_id: p.po_id,
    batchId: p.po_id,
    vendor_nama: notaObj.vendor_nama,
    alasan: notaObj.alasan_reject,
    jumlah: notaObj.jumlah_reject,
    ke_berapa_kali: 1,
    status: "menunggu-spk-retur",
    tanggal: p.now,
  });

  // 3. Catat ke stock_movements (Gudang & Stok)
  if (!data.stock_movements) data.stock_movements = [];
  const id = nextId(data, "stock_movements");
  data.stock_movements.push({
    id,
    tanggal: p.now,
    jenis: "reject",
    po_id: p.po_id,
    noPo: po?.noPo || `PO #${p.po_id}`,
    kategori: po?.model || "Tanpa Kategori",
    nama_barang: po?.model || "Tanpa Kategori",
    items,
    jumlah,
    sumber: p.sumber,
    tahap_slug: p.tahap_slug,
    transfer_id: p.transfer_id ?? null,
    vendor_id: p.vendor_id ?? null,
    no_nota: noNota,
    nota_id: notaId,
    keterangan: p.keterangan || "Barang reject",
  });

  // 4. Update barcode produksi
  markBarcodes(data, p.po_id, items, p.tahap_slug, (b) => {
    b.status_sebelum_reject = b.status;
    b.status = "reject";
    b.rejectAt = p.now;
    b.no_nota_reject = noNota;
  });

  // 5. Update PO ledgers
  if (!data.po_ledgers) data.po_ledgers = [];
  data.po_ledgers.push({
    id: nextId(data, "po_ledgers"),
    poId: Number(p.po_id),
    dari_vendor_id: p.ledger_from,
    ke_vendor_id: "REJECT",
    jumlah,
    tanggal: p.now,
    catatan: `Reject (${noNota}): ${p.keterangan || p.sumber}`,
  });

  return { movement_id: id, nota: notaObj, nota_id: notaId, no_nota: noNota };
}

// ─── Barang Jadi & SKU ────────────────────────────────────────────────
// Nama barang diberikan saat barang masuk Gudang & Stok (bukan saat potong kain).
// Kode induk  : [PREFIX]-[NO URUT]       → contoh TBJ-0012  (mewakili semua size / total)
// Kode SKU    : [KODE INDUK]-[SIZE]      → contoh TBJ-0012-XS (label hangtag, dipindai saat jual)
// Barcode produksi (SJ-01-XS-001) tetap dipakai untuk tracking produksi & ditautkan ke SKU.

/** Prefix SKU = pengaturan.prefix_sku, atau inisial nama usaha (TIRTA BINTANG JEANS → TBJ). */
export function skuPrefix(data: any): string {
  const set = data.pengaturan_sistem || {};
  if (set.prefix_sku) return String(set.prefix_sku).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "BRG";
  const words = String(set.nama_usaha || "BARANG").toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  return (words.slice(0, 3).map((w) => w[0]).join("") || "BRG");
}

export const skuCode = (kodeInduk: string, size: string) => `${kodeInduk}-${String(size).toUpperCase().replace(/\s+/g, "")}`;

/** Pastikan barang punya kode induk unik. Mengembalikan kode. */
export function ensureBarangKode(data: any, barang: any): string {
  if (barang.kode) return barang.kode;
  const prefix = skuPrefix(data);
  const used = new Set((data.data_barang || []).map((b: any) => b.kode).filter(Boolean));
  let n = (data._counters?.sku_induk || 0) + 1;
  let kode = `${prefix}-${String(n).padStart(4, "0")}`;
  while (used.has(kode)) { n++; kode = `${prefix}-${String(n).padStart(4, "0")}`; }
  data._counters = data._counters || {};
  data._counters.sku_induk = n;
  barang.kode = kode;
  return kode;
}

const stockKey = (m: any) => (m.barang_id != null ? `b:${m.barang_id}` : `k:${m.kategori || "Tanpa Kategori"}`);

/** Stok saat ini per barang jadi (atau per kategori untuk data lama) + size + lot PO, dari ledger stock_movements. */
export function getStockSummary(data: any) {
  type Row = { key: string; barang_id: any; kode: string | null; nama_barang: string; kategori: string; total: number; sizes: Record<string, number>; lots: Record<string, { po_id: any; noPo: string; jumlah: number }>; lastMasuk: string | null; lastKeluar: string | null };
  const map: Record<string, Row> = {};
  const barangById = new Map((data.data_barang || []).map((b: any) => [String(b.id), b]));
  for (const m of (data.stock_movements || [])) {
    if (m.jenis !== "masuk" && m.jenis !== "keluar") continue; // reject tidak memengaruhi stok
    const key = stockKey(m);
    const b: any = m.barang_id != null ? barangById.get(String(m.barang_id)) : null;
    const row = (map[key] ||= {
      key,
      barang_id: m.barang_id ?? null,
      kode: b?.kode || m.kode || null,
      nama_barang: b?.nama_barang || m.nama_barang || m.kategori || "Tanpa Nama",
      kategori: m.kategori || "Tanpa Kategori",
      total: 0, sizes: {}, lots: {}, lastMasuk: null, lastKeluar: null,
    });
    const sign = m.jenis === "keluar" ? -1 : 1;
    const items: SizeQty[] = m.items?.length ? m.items : [{ size: "ALL", jumlah: Number(m.jumlah || 0) }];
    for (const it of items) {
      row.sizes[it.size] = (row.sizes[it.size] || 0) + sign * Number(it.jumlah || 0);
    }
    row.total += sign * Number(m.jumlah || sumQty(items));
    if (m.po_id != null && m.jenis === "masuk") {
      const lk = String(m.po_id);
      const lot = (row.lots[lk] ||= { po_id: m.po_id, noPo: m.noPo || `PO #${m.po_id}`, jumlah: 0 });
      lot.jumlah += Number(m.jumlah || 0);
    }
    if (m.jenis === "masuk" && (!row.lastMasuk || m.tanggal > row.lastMasuk)) row.lastMasuk = m.tanggal;
    if (m.jenis === "keluar" && (!row.lastKeluar || m.tanggal > row.lastKeluar)) row.lastKeluar = m.tanggal;
  }
  return Object.values(map)
    .map((r) => ({
      key: r.key,
      barang_id: r.barang_id,
      kode: r.kode,
      nama_barang: r.nama_barang,
      kategori: r.kategori,
      stok_saat_ini: r.total,
      sizes: Object.entries(r.sizes)
        .filter(([, j]) => j !== 0)
        .map(([size, jumlah]) => ({ size, jumlah, sku: r.kode ? skuCode(r.kode, size) : null })),
      lots: Object.values(r.lots),
      lastMasuk: r.lastMasuk,
      lastKeluar: r.lastKeluar,
    }))
    .sort((a, b) => b.stok_saat_ini - a.stok_saat_ini);
}

/** Stok tersedia per size untuk satu baris stok (key dari getStockSummary). */
export function getAvailableSizes(data: any, key: string): Record<string, number> {
  const row = getStockSummary(data).find((r) => r.key === key);
  const out: Record<string, number> = {};
  for (const s of row?.sizes || []) out[s.size] = s.jumlah;
  return out;
}

/** Total stok per barang_id (untuk sinkron kolom stok di Data Barang). */
export function getStockByBarang(data: any): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of getStockSummary(data)) if (r.barang_id != null) out[String(r.barang_id)] = r.stok_saat_ini;
  return out;
}

/** Cari barang dari hasil scan: kode SKU size, kode induk, atau barcode produksi. */
export function resolveScan(data: any, code: string) {
  const c = String(code || "").trim().toUpperCase();
  if (!c) return null;
  for (const b of (data.data_barang || [])) {
    if (!b.kode) continue;
    const kode = String(b.kode).toUpperCase();
    if (c === kode) return { tipe: "induk", barang: b, size: null, sku: b.kode };
    if (c.startsWith(kode + "-")) return { tipe: "sku", barang: b, size: c.slice(kode.length + 1), sku: c };
  }
  const prod = (data.barcode_item || []).find((x: any) => String(x.kodeBarcode).toUpperCase() === c);
  if (prod) {
    const b = prod.barang_id != null ? (data.data_barang || []).find((x: any) => String(x.id) === String(prod.barang_id)) : null;
    return { tipe: "produksi", barang: b || null, size: prod.size, sku: prod.sku || null, barcode: { kode: prod.kodeBarcode, status: prod.status, poId: prod.poId } };
  }
  return null;
}
