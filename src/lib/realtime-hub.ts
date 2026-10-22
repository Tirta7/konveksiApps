/**
 * Realtime hub (server-side) — event aplikasi & presence.
 *
 * - emitEvent(): kirim event bernama (mis. "vendorRequest", "poolAllocated") ke semua client.
 *   Lewat SSE dibungkus event "rt", dan otomatis diteruskan ke WebSocket oleh sse.ts → hub.sinks.
 * - Presence: siapa sedang membuka form apa (admin membagikan stok / vendor minta kerjaan).
 *   Saat server.mjs aktif presence dikelola via WebSocket; route /api/presence adalah fallback.
 */
import { broadcast } from "./sse";

const g = global as any;
const PRESENCE_TTL_MS = 45_000;

function hub() {
  if (!g.__rtHub) g.__rtHub = { presence: new Map(), sinks: new Set() };
  return g.__rtHub as { presence: Map<string, any>; sinks: Set<any>; transport?: string; broadcastPresence?: () => void };
}

export function emitEvent(event: string, data: Record<string, any> = {}) {
  try { broadcast("rt", { event, data }); } catch {}
}

export function presenceList(): any[] {
  const h = hub();
  const now = Date.now();
  const out: any[] = [];
  for (const [k, p] of h.presence) {
    if (now - p.at > PRESENCE_TTL_MS) { h.presence.delete(k); continue; }
    out.push(p);
  }
  return out;
}

export function setPresence(key: string, info: Record<string, any> | null) {
  const h = hub();
  if (info) h.presence.set(key, { key, ...info, at: Date.now() });
  else h.presence.delete(key);
  emitEvent("presence", { list: presenceList() });
}

/** Presence aktif untuk sebuah transfer/PO (dipakai untuk menyertakan info di respon 409) */
export function presenceFor(filter: (p: any) => boolean): any[] {
  return presenceList().filter(filter);
}
