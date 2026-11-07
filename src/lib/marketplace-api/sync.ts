/**
 * Sinkronisasi pesanan marketplace → Penjualan Online.
 *  - ensureFreshToken : refresh token otomatis sebelum kedaluwarsa (TikTok & Shopee).
 *  - syncShop         : ambil pesanan yang BERUBAH sejak sinkron terakhir (update_time), upsert.
 *  - syncOrderIds     : dipakai webhook (ambil detail order tertentu saja).
 *  - startMarketplaceScheduler : sinkron berkala tiap 10 menit (cadangan bila webhook terlewat).
 *
 * Semua perubahan data ditulis lewat readData()/writeData() (cache global, antrean tulis atomik).
 */
import { readData, writeData, nextId } from "@/lib/data-store";
import { emitEvent } from "@/lib/realtime-hub";
import { type MarketplaceShop, type MappedOrder, findShop, getShops, upsertMarketplaceOrders } from "./common";
import { tiktokConfig, tiktokRefresh, tiktokSearchOrders, tiktokOrderDetails, mapTiktokOrder, tiktokGetReviews } from "./tiktok";
import { shopeeConfig, shopeeRefresh, shopeeOrderList, shopeeOrderDetails, shopeeTrackingNumber, mapShopeeOrder, shopeeEscrowDetail, shopeeGetComment } from "./shopee";

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
    let tracking = known.get(String(o.order_sn)) || o.package_list?.[0]?.tracking_number || "";
    const hasLogistics = (o.package_list || []).some((p: any) => p.logistics_status && p.logistics_status !== "LOGISTICS_NOT_START");
    if (!tracking && (SHIPPED_SHOPEE.has(String(o.order_status)) || hasLogistics) && calls < 60) { 
      calls++; 
      tracking = await shopeeTrackingNumber(shop, String(o.order_sn)); 
    }
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
    // Notifikasi pesanan baru masuk
    if (result.added > 0) {
      emitEvent("marketplace:order_received", { platform: fresh.platform, shop: fresh.shop_name, added: result.added });
    }
    // Realtime update ke UI (misal: nomor resi terbit, status berubah ke Diproses / Dibatalkan)
    if (result.updated > 0) {
      emitEvent("marketplace:order_updated", { platform: fresh.platform, shop: fresh.shop_name, updated: result.updated });
    }
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
  // Notifikasi pesanan baru masuk
  if (result.added > 0) {
    emitEvent("marketplace:order_received", { platform: fresh.platform, shop: fresh.shop_name, added: result.added });
  }
  // Realtime update ke UI (nomor resi / status terupdate)
  if (result.updated > 0) {
    emitEvent("marketplace:order_updated", { platform: fresh.platform, shop: fresh.shop_name, updated: result.updated });
  }
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

export async function syncMarketplaceSettlements() {
  const data: any = readData();
  const shops = getShops(data).filter((s) => s.aktif);
  if (!data.settlement_online) data.settlement_online = [];

  let synced = 0;
  for (const rawShop of shops) {
    if (rawShop.platform === "shopee") {
      let shop = await ensureFreshToken({ ...rawShop });
      const shopeeOrders: string[] = Array.from(
        new Set<string>(
          (data.penjualan_online || [])
            .filter((r: any) => r.marketplace === "Shopee" || /shopee/i.test(String(r.marketplace || "")))
            .map((r: any) => String(r.order_id).trim())
        )
      );

      const existingSet = new Set((data.settlement_online || []).map((s: any) => s.order_id));
      const unSettled = shopeeOrders.filter((id) => !existingSet.has(id));
      const toSync = [...unSettled, ...shopeeOrders].slice(0, 250);

      for (const orderId of toSync) {
        try {
          const income = await shopeeEscrowDetail(shop, orderId);
          if (income) {
            const buyer_total = Number(income.buyer_total_amount || 0);
            const comm_fee = Number(income.commission_fee || 0);
            const service_fee = Number(income.service_fee || 0);
            const trx_fee = Number(income.transaction_fee || 0);
            const aff_fee = Number(income.ams_commission_fee || 0);
            const ship_fee = Number(income.final_shipping_fee || income.actual_shipping_fee || 0);
            const voucher_fee = Number(income.voucher_from_seller || 0);
            const other_fee = Number(income.drc_adjustable_refund || 0) + voucher_fee;
            const net_payout = Number(income.escrow_amount || 0);

            const existingIndex = data.settlement_online.findIndex((s: any) => s.order_id === orderId);
            const rec = {
              order_id: orderId,
              jenis_transaksi: "Pesanan",
              pendapatan_kotor: buyer_total,
              biaya_komisi: comm_fee,
              biaya_layanan: service_fee,
              biaya_transaksi: trx_fee,
              biaya_afiliasi: aff_fee,
              biaya_ongkir: ship_fee,
              voucher_penjual: voucher_fee,
              biaya_lainnya: other_fee,
              penyelesaian_pembayaran: net_payout,
              tanggal_pembayaran: new Date().toISOString()
            };
            if (existingIndex >= 0) {
              data.settlement_online[existingIndex] = { ...data.settlement_online[existingIndex], ...rec };
            } else {
              data.settlement_online.push({ id: nextId(data, "settlement_online"), ...rec });
            }
            synced++;
          }
        } catch {}
      }
    }
  }

  if (synced > 0) {
    writeData(data);
    emitEvent("settlement_updated", { count: synced });
  }
  return { success: true, synced };
}

export function extractReviewTags(comment: string): string[] {
  const text = (comment || "").toLowerCase();
  const tags: string[] = [];
  if (text.includes("rapi") || text.includes("jahit")) tags.push("Jahitan Rapi");
  if (text.includes("nyaman") || text.includes("enak") || text.includes("pas di pinggang")) tags.push("Pola Nyaman");
  if (text.includes("tebal")) tags.push("Bahan Tebal");
  if (text.includes("lembut") || text.includes("adem") || text.includes("halus")) tags.push("Bahan Denim Lembut");
  if (text.includes("pas") || text.includes("presisi") || text.includes("sesuai ukuran")) tags.push("Ukuran Pas");
  if (text.includes("washing") || text.includes("luntur") || text.includes("warna")) tags.push("Washing Bagus");
  if (text.includes("repeat") || text.includes("langganan") || text.includes("order lagi")) tags.push("Wajib Repeat Order");
  if (text.includes("kancing") || text.includes("zipper") || text.includes("resleting")) tags.push("Aksesoris Kokoh");
  if (tags.length === 0) tags.push("Kualitas Terjamin");
  return tags.slice(0, 4);
}

export async function syncMarketplaceReviews() {
  const data: any = readData();
  const shops = getShops(data).filter((s) => s.aktif);
  if (!data.product_reviews) data.product_reviews = [];

  const orderMap = new Map<string, any>();
  (data.penjualan_online || []).forEach((o: any) => {
    if (o.order_id) orderMap.set(String(o.order_id).trim(), o);
  });

  let synced = 0;
  for (const rawShop of shops) {
    let shop = await ensureFreshToken({ ...rawShop });
    if (shop.platform === "shopee") {
      try {
        const comments = await shopeeGetComment(shop);
        for (const c of comments) {
          const orderSn = String(c.order_sn || c.order_id || "").trim();
          const existing = data.product_reviews.find((r: any) => (orderSn && r.order_id === orderSn) || r.comment_id === c.comment_id);
          const matchedOrder = orderSn ? orderMap.get(orderSn) : null;
          const pName = matchedOrder?.product_name || c.item_name || c.product_name || "Produk Jeans Shopee";
          const variation = matchedOrder?.variation || c.model_name || c.variation || "-";
          const rating = Number(c.rating_star || 5);
          const comment = c.comment || "Produk bagus, jahitan rapi.";

          const rec = {
            comment_id: c.comment_id,
            order_id: orderSn || `SHP-${c.comment_id}`,
            product_name: pName,
            variation: variation,
            marketplace: "Shopee",
            buyer_name: c.buyer_username || "Pembeli Shopee",
            rating: Math.min(5, Math.max(1, rating)),
            comment: comment,
            tags: extractReviewTags(comment),
            created_at: c.create_time ? new Date(Number(c.create_time) * 1000).toISOString() : new Date().toISOString()
          };

          if (existing) {
            Object.assign(existing, rec);
          } else {
            data.product_reviews.unshift({ id: nextId(data, "product_reviews"), ...rec });
          }
          synced++;
        }
      } catch (err: any) {
        console.warn("[marketplace] sync Shopee reviews warning:", err?.message);
      }
    } else if (shop.platform === "tiktok") {
      try {
        const reviews = await tiktokGetReviews(shop);
        for (const rv of reviews) {
          const orderId = String(rv.order_id || "").trim();
          const existing = data.product_reviews.find((r: any) => (orderId && r.order_id === orderId) || r.review_id === rv.review_id);
          const matchedOrder = orderId ? orderMap.get(orderId) : null;
          const pName = matchedOrder?.product_name || rv.product_name || "Produk Jeans TikTok";
          const variation = matchedOrder?.variation || rv.sku_name || "-";
          const rating = Number(rv.rating || 5);
          const comment = rv.review_text || rv.content || "Produk sangat bagus dan sesuai.";

          const rec = {
            review_id: rv.review_id,
            order_id: orderId || `TTK-${rv.review_id || Date.now()}`,
            product_name: pName,
            variation: variation,
            marketplace: "TikTok Shop",
            buyer_name: rv.buyer_name || "Pembeli TikTok",
            rating: Math.min(5, Math.max(1, rating)),
            comment: comment,
            tags: extractReviewTags(comment),
            created_at: rv.create_time ? new Date(Number(rv.create_time) * 1000).toISOString() : new Date().toISOString()
          };

          if (existing) {
            Object.assign(existing, rec);
          } else {
            data.product_reviews.unshift({ id: nextId(data, "product_reviews"), ...rec });
          }
          synced++;
        }
      } catch (err: any) {
        console.warn("[marketplace] sync TikTok reviews warning:", err?.message);
      }
    }
  }

  if (synced > 0) {
    writeData(data);
    emitEvent("reviews_updated", { count: synced });
  }
  return { success: true, synced };
}

export function marketplaceConfigStatus() {
  const t = tiktokConfig(), s = shopeeConfig();
  return {
    app_url: (process.env.APP_URL || "").replace(/\/+$/, ""),
    tiktok: { configured: t.ready },
    shopee: { configured: s.ready, sandbox: s.sandbox },
  };
}

/** Sinkron berkala di background (dipanggil sekali dari instrumentation.ts). */
export function startMarketplaceScheduler() {
  if (g.__mpScheduler) return;
  const INTERVAL = 30_000; // Tiap 30 detik cek pesanan baru otomatis
  let tick = 0;
  g.__mpScheduler = setInterval(() => {
    tick++;
    if (getShops(readData()).some((s) => s.aktif)) {
      syncAllShops().catch((e) => console.error("[marketplace] sinkron berkala gagal:", e?.message));
      // Tiap 5 menit (10 tick x 30s), sinkron ulasan pembeli otomatis dari marketplace
      if (tick % 10 === 0) {
        syncMarketplaceReviews().catch((e) => console.error("[marketplace] sinkron ulasan berkala gagal:", e?.message));
      }
    }
  }, INTERVAL);
  console.log("[marketplace] penjadwal sinkron aktif (tiap 30 detik)");
}
