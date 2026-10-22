/**
 * Resolver tahap pipeline — SATU aturan untuk server & client.
 *
 * Masalah yang diselesaikan:
 *  `produksi_transfers.ke/dari` dan status barcode kadang berisi SLUG tahap (mis. "finishing" = tahap "Packing"),
 *  kadang berisi VENDOR_TIPE tahap (mis. "finishing" = vendor_tipe milik tahap "Gudang"/qc_bahan).
 *  Jika tiap halaman menerjemahkan sendiri, label bisa tertukar (contoh: barang antre Gudang tampil "Packing").
 *
 * Aturan:
 *  1. Transfer yang punya `ke_stage_slug` → pakai itu (paling pasti, ditulis saat ACC sejak perbaikan ini).
 *  2. Pool otomatis hasil ACC (vendor_id null + dari_laporan_id / catatan "Otomatis dari ACC") menulis
 *     `ke` = vendor_tipe tahap berikutnya → cari berdasarkan vendor_tipe dulu, baru slug.
 *  3. Selain itu (dikirim manual dari form, memakai slug) → slug dulu, baru vendor_tipe.
 *  4. Status barcode ditulis dengan vendor_tipe → cari vendor_tipe dulu.
 */

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

export type StageLike = { id?: any; slug?: string; nama?: string; vendor_tipe?: string | null; urutan?: number; aktif?: boolean; [k: string]: any };

export function sortedStages<T extends StageLike>(stages: T[] | undefined, onlyActive = true): T[] {
  return [...(stages || [])]
    .filter((s) => !onlyActive || s.aktif !== false)
    .sort((a, b) => Number(a.urutan || 0) - Number(b.urutan || 0));
}

/** Cari tahap dari sebuah kunci (slug / vendor_tipe / alias). */
export function findStageByKey<T extends StageLike>(stages: T[] | undefined, key?: string | null, preferVendorTipe = false): T | null {
  if (!key) return null;
  const list = sortedStages(stages);
  const bySlug = list.find((s) => s.slug === key);
  const byVt = list.find((s) => !!s.vendor_tipe && s.vendor_tipe === key);
  const first = preferVendorTipe ? (byVt || bySlug) : (bySlug || byVt);
  if (first) return first;
  const n = normalizeStage(key);
  return list.find((s) => normalizeStage(s.slug) === n)
    || list.find((s) => !!s.vendor_tipe && normalizeStage(s.vendor_tipe) === n)
    || null;
}

/** Pool otomatis dari ACC laporan progres (ke = vendor_tipe tahap berikutnya). */
export function isAutoAccPool(t: any): boolean {
  if (!t || t.vendor_id != null) return false;
  return t.dari_laporan_id != null || /otomatis dari acc/i.test(String(t.catatan || ""));
}

/** Tahap tujuan sebuah transfer. */
export function transferTargetStage<T extends StageLike>(stages: T[] | undefined, t: any): T | null {
  if (!t) return null;
  if (t.ke_stage_slug) {
    const s = sortedStages(stages).find((x) => x.slug === t.ke_stage_slug);
    if (s) return s;
  }
  return findStageByKey(stages, t.ke, isAutoAccPool(t));
}

/** Tahap asal sebuah transfer (pool ACC menulis `dari` = vendor_tipe vendor pelapor). */
export function transferSourceStage<T extends StageLike>(stages: T[] | undefined, t: any): T | null {
  if (!t) return null;
  if (t.dari_stage_slug) {
    const s = sortedStages(stages).find((x) => x.slug === t.dari_stage_slug);
    if (s) return s;
  }
  return findStageByKey(stages, t.dari, isAutoAccPool(t));
}

/** Tahap "Gudang" (penampungan internal, bukan vendor). */
export function isGudangStage(stage?: StageLike | null): boolean {
  if (!stage) return false;
  return normalizeStage(stage.slug) === "gudang" || /gudang/i.test(String(stage.nama || ""));
}

/** Nama tampilan tahap dari kunci apa pun. */
export function stageDisplayName(stages: StageLike[] | undefined, key?: string | null, preferVendorTipe = false): string {
  const st = findStageByKey(stages, key, preferVendorTipe);
  if (st?.nama) return st.nama;
  const fallback: Record<string, string> = {
    washing: "Washing", cmt: "Jahit (CMT)", gudang: "Gudang Produksi", potong: "Potong",
    bersih_benang: "Bersih Benang", finishing: "Finishing", siap_jual: "QC Siap Jual",
  };
  return fallback[normalizeStage(key || "")] || key || "-";
}

/** Kunci status barcode untuk sebuah tahap: vendor_tipe bila tahap dikerjakan vendor, selain itu slug. */
export function barcodeStatusForStage(stage?: StageLike | null): string {
  if (!stage) return "gudang";
  if (isGudangStage(stage)) return "gudang";
  return stage.vendor_tipe || stage.slug || "gudang";
}
