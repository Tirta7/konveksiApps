/**
 * Integrasi Marketplace — bagian umum (dipakai TikTok Shop/Tokopedia & Shopee).
 *
 * Prinsip:
 *  - Pesanan dari API disimpan ke koleksi yang SAMA dengan impor CSV (data.penjualan_online),
 *    dengan format baris yang sama → scan barcode, retur, laporan & dedupe tetap jalan.
 *  - Tiap baris API diberi `sumber: "api"`, `platform`, `shop_key`, `status_api`.
 *  - Order yang sudah ada dari CSV TIDAK ditambah baris baru (cegah dobel hitung) —
 *    hanya status/resi/kurir yang diperbarui.
 *  - Pesanan batal di marketplace → `dibatalkan: true`. Jika sudah ada pcs ter-scan,
 *    ditampilkan peringatan di Penjualan Online agar admin membatalkan scan (stok kembali).
 *  - Token toko (rahasia) disimpan di data.marketplace_shops dan TIDAK PERNAH dikirim ke browser
 *    (lihat publicShop).
 */
import crypto from "crypto";
import { nextId } from "@/lib/data-store";
import { getAuthSecret } from "@/lib/auth-core";

export type Platform = "tiktok" | "shopee";

export interface MarketplaceShop {
  key: string;                 // `${platform}:${shop_id}` — kunci unik internal
  platform: Platform;
  shop_id: string;
  shop_name: string;
  label: string;               // label di daftar pesanan: "TikTok Shop" / "Tokopedia" / "Shopee"
  region?: string;
  shop_cipher?: string;        // TikTok
  open_id?: string;            // TikTok (1 token bisa berlaku utk beberapa toko)
  access_token: string;
  access_expire: number;       // epoch ms
  refresh_token: string;
  refresh_expire: number;      // epoch ms
  aktif: boolean;
  connected_at: string;
  last_sync_at?: number;       // epoch detik (batas update_time terakhir yang sudah diambil)
  last_sync_run?: string;      // ISO waktu sinkron terakhir dijalankan
  last_result?: { added: number; updated: number; skipped: number; cancelledScanned: number; orders: number } | null;
  last_error?: string | null;
}

export function appUrl(): string {
  return (process.env.APP_URL || "").replace(/\/+$/, "");
}

export function getShops(data: any): MarketplaceShop[] {
  if (!Array.isArray(data.marketplace_shops)) data.marketplace_shops = [];
  return data.marketplace_shops;
}

export function findShop(data: any, key: string): MarketplaceShop | undefined {
  return getShops(data).find((s) => s.key === key);
}

/** Simpan / perbarui toko hasil otorisasi (label & status aktif lama dipertahankan). */
export function saveShop(data: any, shop: Omit<MarketplaceShop, "key" | "aktif" | "connected_at"> & Partial<MarketplaceShop>) {
  const list = getShops(data);
  const key = `${shop.platform}:${shop.shop_id}`;
  const prev = list.find((s) => s.key === key);
  const rec: MarketplaceShop = {
    ...(prev || {}),
    ...shop,
    key,
    label: prev?.label || shop.label,
    aktif: prev ? prev.aktif !== false : true,
    connected_at: prev?.connected_at || new Date().toISOString(),
    last_error: null,
  } as MarketplaceShop;
  if (prev) Object.assign(prev, rec);
  else list.push(rec);
  return rec;
}

/** Versi aman untuk browser — tanpa token. */
export function publicShop(s: MarketplaceShop) {
  const { access_token, refresh_token, shop_cipher, open_id, ...rest } = s as any;
  return {
    ...rest,
    token_valid_until: s.access_expire ? new Date(s.access_expire).toISOString() : null,
    perlu_hubungkan_ulang: !!s.refresh_expire && s.refresh_expire < Date.now(),
  };
}

// ── State OAuth (anti-CSRF): ditandatangani dengan AUTH_SECRET, berlaku 15 menit ──
export function makeState(platform: Platform): string {
  const body = Buffer.from(JSON.stringify({ p: platform, n: crypto.randomBytes(8).toString("hex"), exp: Date.now() + 15 * 60_000 })).toString("base64url");
  const sig = crypto.createHmac("sha256", getAuthSecret()).update("mp-state." + body).digest("base64url");
  return `${body}.${sig}`;
}
export function checkState(state: string | null, platform: Platform): boolean {
  if (!state) return false;
  const [body, sig] = state.split(".");
  if (!body || !sig) return false;
  const expected = crypto.createHmac("sha256", getAuthSecret()).update("mp-state." + body).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf-8"));
    return p.p === platform && p.exp > Date.now();
  } catch { return false; }
}

export function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(String(a || "").toLowerCase()), y = Buffer.from(String(b || "").toLowerCase());
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

// ── Format tanggal sama dengan CSV: "DD/MM/YYYY HH:mm:ss" (WIB) ──
export function fmtWIB(epochSec: number | null | undefined): string {
  if (!epochSec) return "";
  const d = new Date(Number(epochSec) * 1000 + 7 * 3600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

// ── Status marketplace → label Indonesia (selaras dengan CSV: "Dikirim", "Selesai") ──
export const STATUS_TIKTOK: Record<string, string> = {
  UNPAID: "Belum Dibayar",
  ON_HOLD: "Ditahan",
  AWAITING_SHIPMENT: "Perlu Dikirim",
  PARTIALLY_SHIPPING: "Dikirim Sebagian",
  AWAITING_COLLECTION: "Menunggu Pickup",
  IN_TRANSIT: "Dikirim",
  DELIVERED: "Terkirim",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
};
export const STATUS_SHOPEE: Record<string, string> = {
  UNPAID: "Belum Dibayar",
  READY_TO_SHIP: "Perlu Dikirim",
  PROCESSED: "Diproses",
  RETRY_SHIP: "Kirim Ulang",
  SHIPPED: "Dikirim",
  TO_CONFIRM_RECEIVE: "Terkirim",
  IN_CANCEL: "Proses Batal",
  CANCELLED: "Dibatalkan",
  TO_RETURN: "Retur",
  COMPLETED: "Selesai",
};

/** Satu pesanan hasil mapping API (baris = per produk/variasi, format = baris CSV). */
export interface MappedOrder {
  order_id: string;
  status_api: string;
  status: string;
  dibatalkan: boolean;
  belum_bayar: boolean;
  rows: any[];
}

const lineKey = (r: any) => `${String(r.order_id || "").trim()}|${r.seller_sku || ""}|${r.variation || ""}|${r.product_name || ""}`;
const ORDER_FIELDS = ["status", "status_api", "tracking_id", "shipping_provider", "jatuh_tempo", "payment_method", "tipe_pesanan", "cancel_reason"];

/**
 * Masukkan / perbarui pesanan API ke data.penjualan_online.
 *  - Pesanan baru yang belum dibayar / sudah batal → dilewati (sama dengan aturan impor CSV).
 *  - Pesanan yang sudah ada → field level-order diperbarui di semua barisnya.
 *  - Baris dari API (bukan CSV) juga disesuaikan jumlah/nilai & produk baru ditambahkan.
 */
export function upsertMarketplaceOrders(data: any, shop: MarketplaceShop, orders: MappedOrder[]) {
  if (!Array.isArray(data.penjualan_online)) data.penjualan_online = [];
  const list: any[] = data.penjualan_online;
  const now = new Date().toISOString();
  const res = { added: 0, updated: 0, skipped: 0, cancelledScanned: 0, orders: orders.length };

  const byOrder = new Map<string, any[]>();
  for (const r of list) {
    const k = String(r.order_id || "").trim();
    if (!k) continue;
    if (!byOrder.has(k)) byOrder.set(k, []);
    byOrder.get(k)!.push(r);
  }
  const scannedCount = (oid: string) =>
    (data.penjualan_barcode || []).filter((s: any) => String(s.order_id || "") === oid).reduce((n: number, s: any) => n + (s.items?.length || 0), 0);

  for (const o of orders) {
    const oid = String(o.order_id).trim();
    const existing = byOrder.get(oid) || [];
    const base = { sumber: "api", platform: shop.platform, shop_key: shop.key, marketplace: shop.label };

    if (existing.length === 0) {
      if (o.belum_bayar || o.dibatalkan || o.rows.length === 0) { res.skipped++; continue; }
      for (const r of o.rows) {
        list.push({ ...r, ...base, order_id: oid, id: nextId(data, "penjualan_online" as any), tanggal_diimpor: now, sync_at: now });
      }
      byOrder.set(oid, list.filter((r) => String(r.order_id) === oid));
      res.added++;
      continue;
    }

    // Sudah ada → perbarui level pesanan
    const wasCancelled = existing.some((r) => r.dibatalkan);
    const head = o.rows[0] || {};
    for (const r of existing) {
      for (const f of ORDER_FIELDS) {
        const v = f === "status" ? o.status : f === "status_api" ? o.status_api : head[f];
        if (v !== undefined && v !== null && v !== "") r[f] = v;
      }
      r.dibatalkan = o.dibatalkan;
      if (!r.marketplace) r.marketplace = shop.label;
      r.sync_at = now;
    }

    // Baris yang memang berasal dari API boleh disesuaikan (CSV tidak disentuh agar tidak dobel)
    if (existing.every((r) => r.sumber === "api")) {
      const exMap = new Map(existing.map((r) => [lineKey(r), r]));
      for (const r of o.rows) {
        const k = lineKey({ ...r, order_id: oid });
        const ex = exMap.get(k);
        if (ex) { ex.quantity = r.quantity; ex.order_amount = r.order_amount; ex.amount_scope = r.amount_scope; }
        else if (!o.dibatalkan) list.push({ ...r, ...base, order_id: oid, id: nextId(data, "penjualan_online" as any), tanggal_diimpor: now, sync_at: now });
      }
    }
    res.updated++;
    if (o.dibatalkan && !wasCancelled && scannedCount(oid) > 0) res.cancelledScanned++;
  }
  return res;
}
