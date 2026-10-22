/**
 * TikTok Shop Partner API (juga untuk toko Tokopedia — dikelola lewat TikTok Shop Partner Center).
 *
 * Endpoint yang dipakai (versi 202309):
 *  - Otorisasi seller : https://services.tiktokshop.com/open/authorize?service_id=...&state=...
 *  - Tukar kode token : GET https://auth.tiktok-shops.com/api/v2/token/get
 *  - Refresh token    : GET https://auth.tiktok-shops.com/api/v2/token/refresh
 *  - Daftar toko      : GET  /authorization/202309/shops
 *  - Cari pesanan     : POST /order/202309/orders/search   (body: update_time_ge / update_time_lt)
 *  - Detail pesanan   : GET  /order/202309/orders?ids=...   (dipakai webhook)
 * Base API: https://open-api.tiktokglobalshop.com — header `x-tts-access-token`.
 *
 * Tanda tangan request: HMAC-SHA256(app_secret, app_secret + path + (param urut abjad tanpa sign/access_token, key+value) + body + app_secret), hex.
 * Tanda tangan webhook : header Authorization = HMAC-SHA256(app_secret, app_key + rawBody), hex.
 */
import crypto from "crypto";
import { type MarketplaceShop, type MappedOrder, STATUS_TIKTOK, fmtWIB, safeEqualHex } from "./common";

const API_BASE = "https://open-api.tiktokglobalshop.com";
const AUTH_BASE = "https://auth.tiktok-shops.com";
const AUTHORIZE_BASE = "https://services.tiktokshop.com/open/authorize";

export function tiktokConfig() {
  const app_key = process.env.TIKTOK_APP_KEY || "";
  const app_secret = process.env.TIKTOK_APP_SECRET || "";
  const service_id = process.env.TIKTOK_SERVICE_ID || "";
  return { app_key, app_secret, service_id, ready: !!(app_key && app_secret && service_id) };
}

function requireConfig() {
  const c = tiktokConfig();
  if (!c.ready) throw new Error("TikTok Shop belum dikonfigurasi (TIKTOK_APP_KEY / TIKTOK_APP_SECRET / TIKTOK_SERVICE_ID di .env)");
  return c;
}

export function tiktokSign(path: string, params: Record<string, string>, body: string, secret: string): string {
  const keys = Object.keys(params).filter((k) => k !== "sign" && k !== "access_token").sort();
  const base = secret + path + keys.map((k) => k + params[k]).join("") + (body || "") + secret;
  return crypto.createHmac("sha256", secret).update(base).digest("hex");
}

export function tiktokAuthorizeUrl(state: string): string {
  const c = requireConfig();
  return `${AUTHORIZE_BASE}?service_id=${encodeURIComponent(c.service_id)}&state=${encodeURIComponent(state)}`;
}

export function verifyTiktokWebhook(rawBody: string, authHeader: string | null): boolean {
  const c = tiktokConfig();
  if (!c.ready || !authHeader) return false;
  const expected = crypto.createHmac("sha256", c.app_secret).update(c.app_key + rawBody).digest("hex");
  return safeEqualHex(authHeader.trim(), expected);
}

async function authCall(path: string, q: Record<string, string>) {
  const url = `${AUTH_BASE}${path}?${new URLSearchParams(q).toString()}`;
  const r = await fetch(url, { method: "GET", cache: "no-store" });
  const j: any = await r.json().catch(() => ({}));
  if (j.code !== 0 || !j.data) throw new Error(`TikTok auth: ${j.message || r.status}`);
  return j.data;
}

/** Tukar auth_code → token. */
export async function tiktokExchangeCode(code: string) {
  const c = requireConfig();
  return authCall("/api/v2/token/get", { app_key: c.app_key, app_secret: c.app_secret, auth_code: code, grant_type: "authorized_code" });
}

export async function tiktokRefresh(refresh_token: string) {
  const c = requireConfig();
  return authCall("/api/v2/token/refresh", { app_key: c.app_key, app_secret: c.app_secret, refresh_token, grant_type: "refresh_token" });
}

/** Panggilan API bertanda tangan. */
export async function tiktokApi(method: "GET" | "POST", path: string, accessToken: string, query: Record<string, string | number | undefined> = {}, body?: any) {
  const c = requireConfig();
  const params: Record<string, string> = { app_key: c.app_key, timestamp: String(Math.floor(Date.now() / 1000)) };
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== "") params[k] = String(v);
  const bodyStr = method === "POST" ? JSON.stringify(body || {}) : "";
  params.sign = tiktokSign(path, params, bodyStr, c.app_secret);
  const url = `${API_BASE}${path}?${new URLSearchParams(params).toString()}`;
  const r = await fetch(url, {
    method,
    headers: { "content-type": "application/json", "x-tts-access-token": accessToken },
    body: method === "POST" ? bodyStr : undefined,
    cache: "no-store",
  });
  const j: any = await r.json().catch(() => ({}));
  if (j.code !== 0) throw new Error(`TikTok ${path}: ${j.message || `HTTP ${r.status}`} (code ${j.code ?? "-"})`);
  return j.data || {};
}

export async function tiktokAuthorizedShops(accessToken: string): Promise<any[]> {
  const d = await tiktokApi("GET", "/authorization/202309/shops", accessToken);
  return d.shops || [];
}

/** Ambil pesanan yang berubah dalam rentang update_time [from, to) (detik). */
export async function tiktokSearchOrders(shop: MarketplaceShop, fromSec: number, toSec: number): Promise<any[]> {
  const out: any[] = [];
  let pageToken = "";
  for (let page = 0; page < 40; page++) {
    const d = await tiktokApi("POST", "/order/202309/orders/search", shop.access_token,
      { shop_cipher: shop.shop_cipher, page_size: 50, sort_field: "update_time", sort_order: "ASC", page_token: pageToken || undefined },
      { update_time_ge: fromSec, update_time_lt: toSec });
    out.push(...(d.orders || []));
    pageToken = d.next_page_token || "";
    if (!pageToken) break;
  }
  return out;
}

export async function tiktokOrderDetails(shop: MarketplaceShop, ids: string[]): Promise<any[]> {
  const out: any[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const d = await tiktokApi("GET", "/order/202309/orders", shop.access_token, { shop_cipher: shop.shop_cipher, ids: ids.slice(i, i + 50).join(",") });
    out.push(...(d.orders || []));
  }
  return out;
}

/** Label kanal: Tokopedia bila payload menandai demikian, selain itu label toko. */
function channelLabel(o: any, shop: MarketplaceShop): string {
  const hint = [o.order_source, o.channel, o.platform, o.source_platform, o.sales_channel].filter(Boolean).join(" ");
  if (/tokopedia/i.test(hint)) return "Tokopedia";
  return shop.label;
}

/** Order TikTok (202309) → format baris CSV. line_items TikTok = 1 baris per unit → dikelompokkan per SKU. */
export function mapTiktokOrder(o: any, shop: MarketplaceShop): MappedOrder {
  const statusApi = String(o.status || o.order_status || "");
  const ra = o.recipient_address || {};
  const districts: any[] = ra.district_info || [];
  const lvl = (l: string) => districts.find((x) => x.address_level === l)?.address_name || "";
  const groups = new Map<string, any>();
  let preorder = /PRE/i.test(String(o.order_type || ""));
  for (const li of o.line_items || []) {
    if (/CANCEL/i.test(String(li.display_status || ""))) continue; // unit yang dibatalkan sebagian
    if (li.is_pre_order) preorder = true;
    const k = `${li.seller_sku || ""}|${li.sku_name || ""}|${li.product_name || ""}`;
    const g = groups.get(k) || { li, qty: 0 };
    g.qty += Number(li.quantity || 1);
    groups.set(k, g);
  }
  const first: any = (o.line_items || [])[0] || {};
  const total = o.payment?.total_amount ?? "";
  const label = channelLabel(o, shop);
  const rows = [...groups.values()].map(({ li, qty }) => ({
    marketplace: label,
    status: STATUS_TIKTOK[statusApi] || statusApi,
    product_name: li.product_name || "",
    variation: li.sku_name || "",
    quantity: qty,
    order_amount: String(total),
    amount_scope: "order", // TikTok: nilai seluruh pesanan (sama dengan kolom "Order Amount" CSV)
    seller_sku: li.seller_sku || "",
    buyer_username: o.buyer_nickname || o.buyer_email || "",
    recipient: ra.name || "",
    tanggal_pesanan: fmtWIB(o.create_time),
    phone: ra.phone_number || "",
    address: ra.full_address || ra.address_detail || "",
    city: lvl("L2"),
    province: lvl("L1"),
    tracking_id: o.tracking_number || li.tracking_number || first.tracking_number || "",
    shipping_provider: o.shipping_provider || li.shipping_provider_name || first.shipping_provider_name || "",
    payment_method: o.is_cod ? "Bayar di tempat" : o.payment_method_name || "Transfer",
    tipe_pesanan: preorder ? "Pre-order" : "Normal",
    jatuh_tempo: fmtWIB(o.rts_sla_time || o.shipping_due_time),
    cancel_reason: o.cancel_reason || "",
  }));
  return {
    order_id: String(o.id || o.order_id),
    status_api: statusApi,
    status: STATUS_TIKTOK[statusApi] || statusApi,
    dibatalkan: statusApi === "CANCELLED",
    belum_bayar: statusApi === "UNPAID",
    rows,
  };
}
