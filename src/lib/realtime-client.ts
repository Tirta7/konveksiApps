"use client";

/**
 * Realtime client — satu koneksi SSE (/api/events) untuk SEMUA tab di satu browser.
 *
 * - Leader election via navigator.locks: hanya 1 tab yang membuka EventSource,
 *   tab lain menerima event lewat BroadcastChannel. Hemat koneksi (batas 6 koneksi
 *   HTTP/1.1 per origin) dan hemat beban server saat banyak client.
 * - Fallback: jika browser tidak mendukung locks/BroadcastChannel, tiap tab buka EventSource sendiri.
 * - Event "dataChanged" di-coalesce (250ms) → banyak perubahan beruntun = 1 refresh.
 * - Tab tersembunyi tidak refetch; saat tab kembali terlihat, 1x refresh jika ada event terlewat.
 * - Setelah reconnect, versi data dibandingkan → refresh otomatis jika ada perubahan terlewat.
 */

export type RealtimeStatus = "connecting" | "live" | "offline";
type SyncCb = () => void;
type StatusCb = (s: RealtimeStatus) => void;

const CHANNEL_NAME = "konveksi-sync";
const LOCK_NAME = "konveksi-sse-leader";
const COALESCE_MS = 250;

const syncSubs = new Set<SyncCb>();
const statusSubs = new Set<StatusCb>();

let started = false;
let status: RealtimeStatus = "connecting";
let channel: BroadcastChannel | null = null;
let es: EventSource | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let coalesceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingWhileHidden = false;
let lastVersion: number | null = null;
let releaseLeader: (() => void) | null = null;
let isLeader = false;

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
    // Reconnect: if server version moved while we were disconnected, refresh once
    if (lastVersion !== null && num !== null && num !== lastVersion) emitSync();
    if (num !== null) lastVersion = num;
    return;
  }
  if (num !== null) lastVersion = num;
  emitSync();
}

/** Open the actual EventSource (leader tab or fallback mode) */
function openEventSource() {
  if (es) return;
  setStatus("connecting");
  es = new EventSource("/api/events");

  es.addEventListener("connected", (e: MessageEvent) => {
    setStatus("live");
    let v: unknown = null;
    try { v = JSON.parse(e.data)?.v; } catch {}
    channel?.postMessage({ type: "status", status: "live" });
    channel?.postMessage({ type: "hello", v });
    handleVersion(v, true);
  });

  es.addEventListener("dataChanged", (e: MessageEvent) => {
    let v: unknown = null;
    try { v = JSON.parse(e.data)?.v; } catch {}
    channel?.postMessage({ type: "sync", v });
    handleVersion(v, false);
  });

  es.onerror = () => {
    setStatus("offline");
    channel?.postMessage({ type: "status", status: "offline" });
    // Browser auto-reconnects while CONNECTING; only rebuild when fully CLOSED
    if (es && es.readyState === EventSource.CLOSED) {
      es.close();
      es = null;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = setTimeout(openEventSource, 3000);
    }
  };
}

function closeEventSource() {
  if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
  es?.close();
  es = null;
}

function onChannelMessage(ev: MessageEvent) {
  const msg = ev.data || {};
  if (isLeader) {
    // A new follower asks for current status
    if (msg.type === "status?") channel?.postMessage({ type: "status", status });
    return;
  }
  if (msg.type === "sync") handleVersion(msg.v, false);
  else if (msg.type === "hello") handleVersion(msg.v, true);
  else if (msg.type === "status") setStatus(msg.status);
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

  const locks = (navigator as any).locks;
  const hasBC = typeof BroadcastChannel !== "undefined";

  if (!locks || !hasBC) {
    // Fallback: one EventSource per tab
    openEventSource();
    return;
  }

  channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = onChannelMessage;
  channel.postMessage({ type: "status?" });

  // Wait to become leader; the lock is held until this tab closes / stops
  locks.request(LOCK_NAME, () => new Promise<void>(resolve => {
    if (!started) { resolve(); return; }
    isLeader = true;
    releaseLeader = () => { isLeader = false; closeEventSource(); resolve(); };
    openEventSource();
  })).catch(() => {
    // Lock API failed → behave as standalone
    openEventSource();
  });
}

function stop() {
  if (!started) return;
  started = false;
  document.removeEventListener("visibilitychange", onVisibility);
  if (coalesceTimer) { clearTimeout(coalesceTimer); coalesceTimer = null; }
  if (releaseLeader) { releaseLeader(); releaseLeader = null; }
  closeEventSource();
  channel?.close();
  channel = null;
}

let stopTimer: ReturnType<typeof setTimeout> | null = null;
function maybeStop() {
  if (stopTimer) clearTimeout(stopTimer);
  // Small grace period so client-side navigation doesn't drop/reopen the connection
  stopTimer = setTimeout(() => {
    if (syncSubs.size === 0 && statusSubs.size === 0) stop();
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

export function getRealtimeStatus(): RealtimeStatus {
  return status;
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
