/**
 * Pool Guard — mencegah bentrok (race condition) pada stok standby / hasil tahap.
 *
 * Node.js menjalankan setiap handler secara single-thread; selama bagian
 * "baca → validasi → tulis" tidak diselingi `await`, operasi itu atomik.
 * Modul ini menyediakan validasi bersama yang dipakai semua endpoint yang
 * mengurangi stok pool:
 *   - POST /api/produksi-transfer      (admin kirim ke pos berikutnya)
 *   - POST /api/tarik-barang/acc-downstream (admin ACC permintaan vendor)
 *   - POST /api/cmt-request            (vendor minta kerjaan dari standby pool)
 *
 * Konsep:
 *   tersedia  = sisa pool saat ini
 *   dipesan   = total sisa permintaan vendor yang masih Pending / Sebagian
 *   bebas     = tersedia − dipesan   (yang boleh dibagikan tanpa menabrak permintaan vendor)
 */
import { holdingOf, normalizeStage } from "./stock";

export const OPEN_REQUEST = new Set(["Pending", "Sebagian"]);

export interface Reservation {
  id: number;
  vendor_id: number;
  vendor_nama: string;
  sisa: number;
  total_request: number;
  createdAt: string | null;
  catatan?: string;
}

export function requestRemaining(r: any): number {
  return Math.max(0, Number(r.total_request || 0) - Number(r.total_dipenuhi || 0));
}

/** Permintaan vendor yang masih terbuka untuk sebuah pool */
export function reservationsFor(data: any, transferId: any, excludeRequestId?: any): Reservation[] {
  return (data.cmt_requests || [])
    .filter((r: any) => r.transfer_id != null && String(r.transfer_id) === String(transferId) && OPEN_REQUEST.has(r.status))
    .filter((r: any) => excludeRequestId == null || String(r.id) !== String(excludeRequestId))
    .map((r: any) => ({
      id: r.id,
      vendor_id: r.vendor_id,
      vendor_nama: (data.vendors || []).find((v: any) => v.id === r.vendor_id)?.nama || "Vendor",
      sisa: requestRemaining(r),
      total_request: Number(r.total_request || 0),
      createdAt: r.createdAt || null,
      catatan: r.catatan || "",
    }))
    .filter((r: Reservation) => r.sisa > 0)
    .sort((a: Reservation, b: Reservation) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

/** Apakah transfer ini standby pool (belum ada vendor) yang masih punya isi */
export function isOpenPool(t: any): boolean {
  if (!t || t.vendor_id != null || t.is_forwarded) return false;
  if (["Ditarik Penuh", "Kembali ke Gudang", "Ditolak"].includes(t.status)) return false;
  return Number(t.jumlah_kirim || 0) > 0;
}

/** Sisa isi sebuah sumber (pool / holding) beserta rincian size */
export function sourceStock(data: any, t: any): { total: number; sizes: { size: string; jumlah: number }[] } {
  const h = holdingOf(data, t);
  if (h) return { total: h.total, sizes: h.sizes };
  if (isOpenPool(t)) {
    const sizes = (t.sizeBreakdown || []).map((s: any) => ({ size: String(s.size), jumlah: Number(s.jumlah || 0) })).filter((s: any) => s.jumlah > 0);
    return { total: Number(t.jumlah_kirim || 0), sizes };
  }
  return { total: 0, sizes: [] };
}

export function poolAvailability(data: any, t: any, excludeRequestId?: any) {
  const stock = sourceStock(data, t);
  const reservations = reservationsFor(data, t.id, excludeRequestId);
  const reserved = reservations.reduce((s, r) => s + r.sisa, 0);
  return { ...stock, reservations, reserved, free: Math.max(0, stock.total - reserved) };
}

/** Catat perubahan terakhir pada sumber agar pihak lain tahu "kenapa stok berubah" */
export function markSourceChange(t: any, desc: string, by: string) {
  t.last_change = { desc, by, at: new Date().toISOString() };
  t.rev = Number(t.rev || 0) + 1;
}

/** Cocokkan pool ke tipe vendor (pool.ke bisa berupa vendor tipe atau slug pipeline) */
export function poolMatchesVendorType(data: any, t: any, vendorTipe: string): boolean {
  if (!vendorTipe) return false;
  if (t.ke === vendorTipe) return true;
  const st = (data.pipeline_stages || []).find((s: any) => s.slug === t.ke);
  if (st?.vendor_tipe === vendorTipe) return true;
  return false;
}

export function stageLabel(data: any, slug: string): string {
  const stages = data.pipeline_stages || [];
  const st = stages.find((s: any) => s.slug === slug) || stages.find((s: any) => s.vendor_tipe === slug)
    || stages.find((s: any) => normalizeStage(s.slug) === normalizeStage(slug));
  return st?.nama || slug;
}
