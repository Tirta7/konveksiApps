/**
 * Shopee Open Platform API v2.
 *
 * Endpoint yang dipakai:
 *  - Otorisasi toko   : /api/v2/shop/auth_partner?partner_id&timestamp&sign&redirect
 *  - Tukar kode token : POST /api/v2/auth/token/get          body {code, shop_id, partner_id}
 *  - Refresh token    : POST /api/v2/auth/access_token/get   body {refresh_token, shop_id, partner_id}
 *  - Info toko        : GET  /api/v2/shop/get_shop_info
 *  - Daftar pesanan   : GET  /api/v2/order/get_order_list    (time_range_field=update_time, maks 15 hari)
 *  - Detail pesanan   : GET  /api/v2/order/get_order_detail  (maks 50 order_sn)
 *  - Nomor resi       : GET  /api/v2/logistics/get_tracking_number
 * Host live: https://partner.shopeemobile.com · sandbox: https://partner.test-stable.shopeemobile.com
 *
 * Tanda tangan:
 *  - Public (auth)  : HMAC-SHA256(partner_key, partner_id + path + timestamp)
 *  - Shop API       : HMAC-SHA256(partner_key, partner_id + path + timestamp + access_token + shop_id)
 *  - Push (webhook) : header Authorization = HMAC-SHA256(partner_key, pushUrl + "|" + rawBody)
 * Token akses berlaku 4 jam, refresh token 30 hari (diperbarui otomatis saat sinkron).
 */
import crypto from "crypto";
import { type MarketplaceShop, type MappedOrder, STATUS_SHOPEE, fmtWIB, safeEqualHex } from "./common";

export function shopeeConfig() {
  const partner_id = process.env.SHOPEE_PARTNER_ID || "";
  const partner_key = process.env.SHOPEE_PARTNER_KEY || "";
  const sandbox = /^(1|true|ya|yes)$/i.test(process.env.SHOPEE_SANDBOX || "");
  const host = sandbox ? "https://partner.test-stable.shopeemobile.com" : "https://partner.shopeemobile.com";
  return { partner_id, partner_key, sandbox, host, ready: !!(partner_id && partner_key) };
}

function requireConfig() {
  const c = shopeeConfig();
  if (!c.ready) throw new Error("Shopee belum dikonfigurasi (SHOPEE_PARTNER_ID / SHOPEE_PARTNER_KEY di .env)");
  return c;
}

function sign(key: string, base: string) {
  return crypto.createHmac("sha256", key).update(base).digest("hex");
}

export function shopeeAuthorizeUrl(redirectUrl: string): string {
  const c = requireConfig();
  const path = "/api/v2/shop/auth_partner";
  const ts = Math.floor(Date.now() / 1000);
  const s = sign(c.partner_key, `${c.partner_id}${path}${ts}`);
  return `${c.host}${path}?partner_id=${c.partner_id}&timestamp=${ts}&sign=${s}&redirect=${encodeURIComponent(redirectUrl)}`;
}

export function verifyShopeePush(pushUrl: string, rawBody: string, authHeader: string | null): boolean {
  const c = shopeeConfig();
  if (!c.ready || !authHeader) return false;
  return safeEqualHex(authHeader.trim(), sign(c.partner_key, `${pushUrl}|${rawBody}`));
}

async function publicPost(path: string, body: any) {
  const c = requireConfig();
  const ts = Math.floor(Date.now() / 1000);
  const s = sign(c.partner_key, `${c.partner_id}${path}${ts}`);
  const r = await fetch(`${c.host}${path}?partner_id=${c.partner_id}&timestamp=${ts}&sign=${s}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, partner_id: Number(c.partner_id) }),
    cache: "no-store",
  });
  const j: any = await r.json().catch(() => ({}));
  if (j.error) throw new Error(`Shopee ${path}: ${j.message || j.error}`);
  return j;
}

export async function shopeeExchangeCode(code: string, shopId: string) {
  return publicPost("/api/v2/auth/token/get", { code, shop_id: Number(shopId) });
}

export async function shopeeRefresh(refreshToken: string, shopId: string) {
  return publicPost("/api/v2/auth/access_token/get", { refresh_token: refreshToken, shop_id: Number(shopId) });
}

/** Panggilan Shop API bertanda tangan (GET). */
export async function shopeeApi(path: string, shop: { shop_id: string; access_token: string }, query: Record<string, string | number | undefined> = {}) {
  const c = requireConfig();
  const ts = Math.floor(Date.now() / 1000);
  const s = sign(c.partner_key, `${c.partner_id}${path}${ts}${shop.access_token}${shop.shop_id}`);
  const q = new URLSearchParams({ partner_id: c.partner_id, timestamp: String(ts), access_token: shop.access_token, shop_id: String(shop.shop_id), sign: s });
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== "") q.set(k, String(v));
  const r = await fetch(`${c.host}${path}?${q.toString()}`, { method: "GET", cache: "no-store" });
  const j: any = await r.json().catch(() => ({}));
  if (j.error) throw new Error(`Shopee ${path}: ${j.message || j.error}`);
  return j.response || {};
}

export async function shopeeShopInfo(shop: { shop_id: string; access_token: string }) {
  const c = requireConfig();
  const path = "/api/v2/shop/get_shop_info";
  const ts = Math.floor(Date.now() / 1000);
  const s = sign(c.partner_key, `${c.partner_id}${path}${ts}${shop.access_token}${shop.shop_id}`);
  const q = new URLSearchParams({ partner_id: c.partner_id, timestamp: String(ts), access_token: shop.access_token, shop_id: String(shop.shop_id), sign: s });
  const r = await fetch(`${c.host}${path}?${q.toString()}`, { cache: "no-store" });
  const j: any = await r.json().catch(() => ({}));
  if (j.error) throw new Error(`Shopee ${path}: ${j.message || j.error}`);
  return j; // get_shop_info mengembalikan field di root (shop_name, region, ...)
}

/** Daftar order_sn yang berubah pada rentang update_time [from, to] (dipecah per 15 hari). */
export async function shopeeOrderList(shop: MarketplaceShop, fromSec: number, toSec: number): Promise<string[]> {
  const out = new Set<string>();
  const SPAN = 15 * 86400 - 60;
  for (let a = fromSec; a < toSec; a += SPAN) {
    const b = Math.min(toSec, a + SPAN);
    let cursor = "";
    for (let page = 0; page < 50; page++) {
      const d = await shopeeApi("/api/v2/order/get_order_list", shop, { time_range_field: "update_time", time_from: a, time_to: b, page_size: 100, cursor: cursor || undefined });
      for (const o of d.order_list || []) out.add(String(o.order_sn));
      if (!d.more) break;
      cursor = d.next_cursor || "";
      if (!cursor) break;
    }
  }
  return [...out];
}

const DETAIL_FIELDS = "buyer_username,recipient_address,item_list,total_amount,shipping_carrier,payment_method,create_time,update_time,pay_time,ship_by_date,days_to_ship,order_status,cancel_reason,cod,package_list";

export async function shopeeOrderDetails(shop: MarketplaceShop, sns: string[]): Promise<any[]> {
  const out: any[] = [];
  for (let i = 0; i < sns.length; i += 50) {
    const d = await shopeeApi("/api/v2/order/get_order_detail", shop, { order_sn_list: sns.slice(i, i + 50).join(","), response_optional_fields: DETAIL_FIELDS });
    out.push(...(d.order_list || []));
  }
  return out;
}

export async function shopeeTrackingNumber(shop: MarketplaceShop, orderSn: string): Promise<string> {
  try {
    const d = await shopeeApi("/api/v2/logistics/get_tracking_number", shop, { order_sn: orderSn });
    return String(d.tracking_number || "");
  } catch { return ""; }
}

/** Order Shopee → format baris CSV (nilai per baris produk, sama seperti kolom "Total Harga Produk" CSV). */
export function mapShopeeOrder(o: any, shop: MarketplaceShop, tracking = ""): MappedOrder {
  const statusApi = String(o.order_status || "");
  const ra = o.recipient_address || {};
  const rows = (o.item_list || []).map((it: any) => {
    const qty = Number(it.model_quantity_purchased || 1);
    const price = Number(it.model_discounted_price ?? it.model_original_price ?? 0);
    return {
      marketplace: shop.label,
      status: STATUS_SHOPEE[statusApi] || statusApi,
      product_name: it.item_name || "",
      variation: it.model_name || "",
      quantity: qty,
      order_amount: String(Math.round(price * qty)),
      amount_scope: "line",
      seller_sku: it.model_sku || it.item_sku || "",
      buyer_username: o.buyer_username || "",
      recipient: ra.name || "",
      tanggal_pesanan: fmtWIB(o.create_time),
      phone: ra.phone || "",
      address: ra.full_address || "",
      city: ra.city || "",
      province: ra.state || "",
      tracking_id: tracking,
      shipping_provider: o.shipping_carrier || o.package_list?.[0]?.shipping_carrier || "",
      payment_method: o.cod ? "Bayar di tempat" : o.payment_method || "Transfer",
      // Shopee normal: dikirim 1–3 hari; pre-order: masa kirim lebih panjang
      tipe_pesanan: Number(o.days_to_ship || 0) > 3 ? "Pre-order" : "Normal",
      jatuh_tempo: fmtWIB(o.ship_by_date),
      cancel_reason: o.cancel_reason || "",
    };
  });
  return {
    order_id: String(o.order_sn),
    status_api: statusApi,
    status: STATUS_SHOPEE[statusApi] || statusApi,
    dibatalkan: statusApi === "CANCELLED",
    belum_bayar: statusApi === "UNPAID",
    rows,
  };
}
