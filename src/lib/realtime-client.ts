"use client";

/**
 * Realtime client — satu koneksi realtime untuk SEMUA tab di satu browser.
 *
 * Transport:
 *  1. WebSocket  (/ws, disediakan server.mjs)  → dua arah: data berubah, event bentrok, presence.
 *  2. Fallback SSE (/api/events) jika WebSocket tidak tersedia (mis. dijalankan via `next dev` biasa).
 *
 * - Leader election via navigator.locks: hanya 1 tab yang membuka koneksi,
 *   tab lain menerima event lewat BroadcastChannel. Hemat koneksi & beban server.
 * - Event "dataChanged" di-coalesce (250ms) → banyak perubahan beruntun = 1 refresh.
 * - Tab tersembunyi tidak refetch; saat tab kembali terlihat, 1x refresh jika ada event terlewat.
 * - Setelah reconnect, versi data dibandingkan → refresh otomatis jika ada perubahan terlewat.
 * - Event aplikasi ("rt"): vendorRequest, poolAllocated, requestUpdated, presence, dst.
 */

export type RealtimeStatus = "connecting" | "live" | "offline";
export type RealtimeTransport = "websocket" | "sse" | null;
type SyncCb = () => void;
type StatusCb = (s: RealtimeStatus) => void;
type EventCb = (event: string, data: any) => void;
type PresenceCb = (list: PresenceEntry[]) => void;

export interface PresenceEntry {
  key: string;
  role?: "admin" | "vendor";
  vendor_id?: number | null;
  name?: string;
  action?: string;          // "kirim" | "minta" | "acc"
  po_id?: number | null;
  transfer_id?: number | null;
  label?: string;
  at?: number;
}

const CHANNEL_NAME = "konveksi-sync";
const LOCK_NAME = "konveksi-sse-leader";
const COALESCE_MS = 250;
const PRESENCE_REFRESH_MS = 15_000;

const syncSubs = new Set<SyncCb>();
const statusSubs = new Set<StatusCb>();
const eventSubs = new Set<EventCb>();
const presenceSubs = new Set<PresenceCb>();

let started = false;
let status: RealtimeStatus = "connecting";
let transport: RealtimeTransport = null;
let channel: BroadcastChannel | null = null;
let es: EventSource | null = null;
let ws: WebSocket | null = null;
let wsUnavailable = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let coalesceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingWhileHidden = false;
let lastVersion: number | null = null;
let releaseLeader: (() => void) | null = null;
let isLeader = false;
let presenceList: PresenceEntry[] = [];

// Presence milik tab ini (dikirim ulang berkala & saat reconnect)
const myPresence = new Map<string, PresenceEntry>();
let presenceTimer: ReturnType<typeof setInterval> | null = null;

function setStatus(s: RealtimeStatus) {
  if (status === s) return;
  status = s;
  statusSubs.forEach(cb => { try { cb(s); } catch {} });
}

/** Fire sync callbacks (coalesced, visibility-aware) */
function emitSync() {
  if (typeof document !== "undefined" && document.hidden) {
    pendingWhileHidden = true;
    return;
  }
  if (coalesceTimer) return;
  coalesceTimer = setTimeout(() => {
    coalesceTimer = null;
    syncSubs.forEach(cb => { try { cb(); } catch (e) { console.error("[realtime]", e); } });
  }, COALESCE_MS);
}

function handleVersion(v: unknown, isHello: boolean) {
  const num = typeof v === "number" ? v : null;
  if (isHello) {
    if (lastVersion !== null && num !== null && num !== lastVersion) emitSync();
    if (num !== null) lastVersion = num;
    return;
  }
  if (num !== null) lastVersion = num;
  emitSync();
}

function dispatchAppEvent(event: string, data: any) {
  if (event === "presence") {
    presenceList = Array.isArray(data?.list) ? data.list : [];
    presenceSubs.forEach(cb => { try { cb(presenceList); } catch {} });
  }
  eventSubs.forEach(cb => { try { cb(event, data); } catch (e) { console.error("[realtime]", e); } });
}

/** Handle one incoming message (leader side), then relay to followers */
function onIncoming(event: string, payload: any) {
  if (event === "connected") {
    setStatus("live");
    channel?.postMessage({ type: "status", status: "live", transport });
    channel?.postMessage({ type: "hello", v: payload?.v });
    handleVersion(payload?.v, true);
    resendPresence();
  } else if (event === "dataChanged") {
    channel?.postMessage({ type: "sync", v: payload?.v });
    handleVersion(payload?.v, false);
  } else if (event === "rt") {
    channel?.postMessage({ type: "rt", event: payload?.event, data: payload?.data });
    dispatchAppEvent(payload?.event, payload?.data);
  }
}

// ── Transport: WebSocket ──
function openWebSocket(): boolean {
  if (wsUnavailable || typeof WebSocket === "undefined") return false;
  try {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const sock = new WebSocket(`${proto}://${location.host}/ws`);
    ws = sock;
    let opened = false;
    setStatus("connecting");
    sock.onopen = () => { opened = true; transport = "websocket"; };
    sock.onmessage = (ev) => {
      let m: any;
      try { m = JSON.parse(String(ev.data)); } catch { return; }
      if (m?.event) onIncoming(m.event, m.data);
    };
    sock.onclose = () => {
      if (ws === sock) ws = null;
      if (!started || !isLeaderOrStandalone()) return;
      if (!opened) {
        // Server tidak menyediakan /ws → pakai SSE untuk sesi ini
        wsUnavailable = true;
        openEventSource();
        return;
      }
      setStatus("offline");
      channel?.postMessage({ type: "status", status: "offline" });
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = setTimeout(openTransport, 2000);
    };
    sock.onerror = () => { /* onclose menangani reconnect/fallback */ };
    return true;
  } catch {
    wsUnavailable = true;
    return false;
  }
}

function wsSend(msg: any) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    try { ws.send(JSON.stringify(msg)); return true; } catch {}
  }
  return false;
}

// ── Transport: SSE (fallback) ──
function openEventSource() {
  if (es) return;
  setStatus("connecting");
  transport = "sse";
  es = new EventSource("/api/events");

  es.addEventListener("connected", (e: MessageEvent) => {
    let d: any = null;
    try { d = JSON.parse(e.data); } catch {}
    onIncoming("connected", d);
  });
  es.addEventListener("dataChanged", (e: MessageEvent) => {
    let d: any = null;
    try { d = JSON.parse(e.data); } catch {}
    onIncoming("dataChanged", d);
  });
  es.addEventListener("rt", (e: MessageEvent) => {
    let d: any = null;
    try { d = JSON.parse(e.data); } catch {}
    onIncoming("rt", d);
  });

  es.onerror = () => {
    setStatus("offline");
    channel?.postMessage({ type: "status", status: "offline" });
    if (es && es.readyState === EventSource.CLOSED) {
      es.close();
      es = null;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = setTimeout(openEventSource, 3000);
    }
  };
}

function openTransport() {
  if (ws || es) return;
  if (!openWebSocket()) openEventSource();
}

function closeTransport() {
  if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
  es?.close();
  es = null;
  if (ws) { const s = ws; ws = null; try { s.close(); } catch {} }
}

function isLeaderOrStandalone() {
  return isLeader || !channel;
}

// ── Presence ──
function sendPresence(key: string, info: PresenceEntry | null) {
  if (isLeaderOrStandalone()) {
    if (!wsSend({ t: "presence", key, info })) {
      // Fallback HTTP (SSE mode)
      fetch("/api/presence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, info }), keepalive: true }).catch(() => {});
    }
  } else {
    channel?.postMessage({ type: "presence-send", key, info });
  }
}

function resendPresence() {
  for (const [k, info] of myPresence) sendPresence(k, info);
}

function ensurePresenceTimer() {
  if (presenceTimer || typeof window === "undefined") return;
  presenceTimer = setInterval(() => { if (myPresence.size) resendPresence(); }, PRESENCE_REFRESH_MS);
  window.addEventListener("beforeunload", () => {
    for (const k of myPresence.keys()) sendPresence(k, null);
  });
}

function onChannelMessage(ev: MessageEvent) {
  const msg = ev.data || {};
  if (isLeader) {
    if (msg.type === "status?") channel?.postMessage({ type: "status", status, transport });
    else if (msg.type === "presence-send") sendPresence(msg.key, msg.info);
    else if (msg.type === "presence?") channel?.postMessage({ type: "rt", event: "presence", data: { list: presenceList } });
    return;
  }
  if (msg.type === "sync") handleVersion(msg.v, false);
  else if (msg.type === "hello") { handleVersion(msg.v, true); resendPresence(); }
  else if (msg.type === "status") { if (msg.transport) transport = msg.transport; setStatus(msg.status); }
  else if (msg.type === "rt") dispatchAppEvent(msg.event, msg.data);
}

function onVisibility() {
  if (!document.hidden && pendingWhileHidden) {
    pendingWhileHidden = false;
    emitSync();
  }
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  document.addEventListener("visibilitychange", onVisibility);
  ensurePresenceTimer();

  const locks = (navigator as any).locks;
  const hasBC = typeof BroadcastChannel !== "undefined";

  if (!locks || !hasBC) {
    openTransport();
    return;
  }

  channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = onChannelMessage;
  channel.postMessage({ type: "status?" });
  channel.postMessage({ type: "presence?" });

  locks.request(LOCK_NAME, () => new Promise<void>(resolve => {
    if (!started) { resolve(); return; }
    isLeader = true;
    releaseLeader = () => { isLeader = false; closeTransport(); resolve(); };
    openTransport();
  })).catch(() => {
    channel?.close();
    channel = null;
    openTransport();
  });
}

function stop() {
  if (!started) return;
  started = false;
  document.removeEventListener("visibilitychange", onVisibility);
  if (coalesceTimer) { clearTimeout(coalesceTimer); coalesceTimer = null; }
  if (releaseLeader) { releaseLeader(); releaseLeader = null; }
  closeTransport();
  channel?.close();
  channel = null;
}

let stopTimer: ReturnType<typeof setTimeout> | null = null;
function maybeStop() {
  if (stopTimer) clearTimeout(stopTimer);
  stopTimer = setTimeout(() => {
    if (syncSubs.size === 0 && statusSubs.size === 0 && eventSubs.size === 0 && presenceSubs.size === 0) stop();
  }, 2000);
}

/** Subscribe to data changes. Returns an unsubscribe function. */
export function subscribeRealtime(cb: SyncCb): () => void {
  syncSubs.add(cb);
  start();
  return () => { syncSubs.delete(cb); maybeStop(); };
}

/** Subscribe to connection status changes. Returns an unsubscribe function. */
export function subscribeRealtimeStatus(cb: StatusCb): () => void {
  statusSubs.add(cb);
  start();
  cb(status);
  return () => { statusSubs.delete(cb); maybeStop(); };
}

/** Subscribe to named app events (vendorRequest, poolAllocated, requestUpdated, presence, ...) */
export function subscribeRealtimeEvent(cb: EventCb): () => void {
  eventSubs.add(cb);
  start();
  return () => { eventSubs.delete(cb); maybeStop(); };
}

/** Subscribe to presence list (siapa sedang membuka form apa) */
export function subscribePresence(cb: PresenceCb): () => void {
  presenceSubs.add(cb);
  start();
  cb(presenceList);
  return () => { presenceSubs.delete(cb); maybeStop(); };
}

/** Umumkan / hapus presence tab ini (info = null untuk menghapus) */
export function setPresence(key: string, info: PresenceEntry | null) {
  start();
  if (info) myPresence.set(key, { ...info, key });
  else myPresence.delete(key);
  sendPresence(key, info ? { ...info, key } : null);
}

export function getRealtimeStatus(): RealtimeStatus {
  return status;
}

export function getRealtimeTransport(): RealtimeTransport {
  return transport;
}

/**
 * Helper for fallback polling: runs fn every `ms` only while the tab is visible.
 * Returns a cleanup function.
 */
export function visiblePoll(fn: () => void, ms = 30000): () => void {
  if (typeof window === "undefined") return () => {};
  const id = setInterval(() => { if (!document.hidden) fn(); }, ms);
  return () => clearInterval(id);
}
