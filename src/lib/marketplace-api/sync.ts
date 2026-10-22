/**
 * Sinkronisasi pesanan marketplace → Penjualan Online.
 *  - ensureFreshToken : refresh token otomatis sebelum kedaluwarsa (TikTok & Shopee).
 *  - syncShop         : ambil pesanan yang BERUBAH sejak sinkron terakhir (update_time), upsert.
 *  - syncOrderIds     : dipakai webhook (ambil detail order tertentu saja).
 *  - startMarketplaceScheduler : sinkron berkala tiap 10 menit (cadangan bila webhook terlewat).
 *
 * Semua perubahan data ditulis lewat readData()/writeData() (cache global, antrean tulis atomik).
 */
import { readData, writeData } from "@/lib/data-store";
import { type MarketplaceShop, type MappedOrder, findShop, getShops, upsertMarketplaceOrders } from "./common";
import { tiktokConfig, tiktokRefresh, tiktokSearchOrders, tiktokOrderDetails, mapTiktokOrder } from "./tiktok";
import { shopeeConfig, shopeeRefresh, shopeeOrderList, shopeeOrderDetails, shopeeTrackingNumber, mapShopeeOrder } from "./shopee";

const g = globalThis as any;
if (!g.__mpLocks) g.__mpLocks = new Set<string>();
const locks: Set<string> = g.__mpLocks;

const REFRESH_MARGIN_MS = 30 * 60_000;
const OVERLAP_SEC = 10 * 60; // tumpang-tindih 10 menit agar tidak ada pesanan terlewat
const SHIPPED_SHOPEE = new Set(["PROCESSED", "SHIPPED", "TO_CONFIRM_RECEIVE", "COMPLETED", "RETRY_SHIP", "TO_RETURN"]);

/** Simpan perubahan field toko ke data (baca ulang data terbaru dulu). */
function patchShop(key: string, patch: Partial<MarketplaceShop>, alsoSameOpenId = false) {
  const data: any = readData();
  const shop = findShop(data, key);
  if (!shop) return null;
  const targets = alsoSameOpenId && shop.open_id ? getShops(data).filter((s) => s.platform === shop.platform && s.open_id === shop.open_id) : [shop];
  for (const t of targets) Object.assign(t, patch);
  writeData(data);
  return { ...shop };
}

export async function ensureFreshToken(shop: MarketplaceShop): Promise<MarketplaceShop> {
  if (shop.access_expire - Date.now() > REFRESH_MARGIN_MS) return shop;
  if (shop.refresh_expire && shop.refresh_expire < Date.now()) throw new Error("Masa berlaku otorisasi habis — klik Hubungkan Ulang di Pengaturan → Integrasi Marketplace");
  if (shop.platform === "tiktok") {
    const t = await tiktokRefresh(shop.refresh_token);
    return patchShop(shop.key, {
      access_token: t.access_token,
      access_expire: Number(t.access_token_expire_in) * 1000,
      refresh_token: t.refresh_token,
      refresh_expire: Number(t.refresh_token_expire_in) * 1000,
    }, true) || shop;
  }
  const t = await shopeeRefresh(shop.refresh_token, shop.shop_id);
  return patchShop(shop.key, {
    access_token: t.access_token,
    access_expire: Date.now() + Number(t.expire_in || 14400) * 1000,
    refresh_token: t.refresh_token,
    refresh_expire: Date.now() + 30 * 86400_000,
  }) || shop;
}

async function fetchMapped(shop: MarketplaceShop, opts: { fromSec?: number; toSec?: number; ids?: string[] }): Promise<MappedOrder[]> {
  if (shop.platform === "tiktok") {
    const raw = opts.ids ? await tiktokOrderDetails(shop, opts.ids) : await tiktokSearchOrders(shop, opts.fromSec!, opts.toSec!);
    return raw.map((o) => mapTiktokOrder(o, shop));
  }
  const sns = opts.ids || await shopeeOrderList(shop, opts.fromSec!, opts.toSec!);
  const raw = await shopeeOrderDetails(shop, sns);
  // Nomor resi Shopee diambil terpisah — hanya utk pesanan yang sudah diproses & resinya belum tersimpan
  const data: any = readData();
  const known = new Map<string, string>();
  for (const r of data.penjualan_online || []) if (r.tracking_id) known.set(String(r.order_id), r.tracking_id);
  const out: MappedOrder[] = [];
  let calls = 0;
  for (const o of raw) {
    let tracking = known.get(String(o.order_sn)) || "";
    if (!tracking && SHIPPED_SHOPEE.has(String(o.order_status)) && calls < 60) { calls++; tracking = await shopeeTrackingNumber(shop, String(o.order_sn)); }
    out.push(mapShopeeOrder(o, shop, tracking));
  }
  return out;
}

/** Sinkron satu toko. days = tarik ulang N hari ke belakang (opsional, utk sinkron manual). */
export async function syncShop(key: string, opts: { days?: number } = {}) {
  if (locks.has(key)) return { skipped: true, message: "Sinkron toko ini sedang berjalan" };
  locks.add(key);
  try {
    let shop = findShop(readData(), key);
    if (!shop) throw new Error("Toko tidak ditemukan");
    if (!shop.aktif) return { skipped: true, message: "Toko dinonaktifkan" };
    shop = await ensureFreshToken({ ...shop });
    const nowSec = Math.floor(Date.now() / 1000);
    const fromSec = opts.days
      ? nowSec - Math.min(30, Math.max(1, opts.days)) * 86400
      : shop.last_sync_at ? shop.last_sync_at - OVERLAP_SEC : nowSec - 3 * 86400; // sinkron pertama: 3 hari terakhir
    const mapped = await fetchMapped(shop, { fromSec, toSec: nowSec });
    const data: any = readData();
    const fresh = findShop(data, key)!;
    const result = upsertMarketplaceOrders(data, fresh, mapped);
    fresh.last_sync_at = Math.max(fresh.last_sync_at || 0, nowSec);
    fresh.last_sync_run = new Date().toISOString();
    fresh.last_result = result;
    fresh.last_error = null;
    writeData(data);
    return { success: true, shop: fresh.shop_name, ...result };
  } catch (e: any) {
    patchShop(key, { last_error: String(e?.message || e), last_sync_run: new Date().toISOString() });
    throw e;
  } finally {
    locks.delete(key);
  }
}

/** Webhook: perbarui order tertentu saja. */
export async function syncOrderIds(platform: "tiktok" | "shopee", shopId: string, ids: string[]) {
  const key = `${platform}:${shopId}`;
  let shop = findShop(readData(), key);
  if (!shop || !shop.aktif || ids.length === 0) return null;
  shop = await ensureFreshToken({ ...shop });
  const mapped = await fetchMapped(shop, { ids });
  const data: any = readData();
  const fresh = findShop(data, key)!;
  const result = upsertMarketplaceOrders(data, fresh, mapped);
  writeData(data);
  return result;
}

export async function syncAllShops(opts: { days?: number; platform?: string } = {}) {
  const shops = getShops(readData()).filter((s) => s.aktif && (!opts.platform || s.platform === opts.platform));
  const results: any[] = [];
  for (const s of shops) {
    try { results.push({ key: s.key, ...(await syncShop(s.key, opts)) }); }
    catch (e: any) { results.push({ key: s.key, error: String(e?.message || e) }); }
  }
  return results;
}

export function marketplaceConfigStatus() {
  const t = tiktokConfig(), s = shopeeConfig();
  return {
    app_url: (process.env.APP_URL || "").replace(/\/+$/, ""),
    tiktok: { configured: t.ready },
    shopee: { configured: s.ready, sandbox: s.sandbox },
  };
}

/** Sinkron berkala (dipanggil sekali dari instrumentation.ts). */
export function startMarketplaceScheduler() {
  if (g.__mpScheduler) return;
  const INTERVAL = 10 * 60_000;
  g.__mpScheduler = setInterval(() => {
    if (getShops(readData()).some((s) => s.aktif)) {
      syncAllShops().catch((e) => console.error("[marketplace] sinkron berkala gagal:", e?.message));
    }
  }, INTERVAL);
  console.log("[marketplace] penjadwal sinkron aktif (tiap 10 menit)");
}
