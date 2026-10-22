/**
 * Server-Sent Events (SSE) manager
 * Keeps track of all connected browser clients (admin + vendor portal) and broadcasts updates to them.
 *
 * Optimasi untuk banyak client:
 *  - "dataChanged" di-coalesce (debounce) → banyak penyimpanan beruntun = 1 event saja,
 *    sehingga semua browser tidak melakukan refetch berkali-kali.
 *  - Setiap event membawa nomor versi yang naik terus, sehingga client bisa mendeteksi event terlewat.
 *  - Client yang terputus otomatis dibuang saat enqueue gagal.
 */

type SSEClient = {
  id: string;
  controller: ReadableStreamDefaultController;
};

// Use a global variable so the Map persists across hot-reloads in dev
const g = global as any;
if (!g.__sseClients) g.__sseClients = new Map<string, SSEClient>();
if (typeof g.__sseVersion !== "number") g.__sseVersion = 0;

const clients: Map<string, SSEClient> = g.__sseClients;
const encoder = new TextEncoder();

/** Register a new SSE connection */
export function addClient(id: string, controller: ReadableStreamDefaultController) {
  clients.set(id, { id, controller });
}

/** Remove a disconnected client */
export function removeClient(id: string) {
  clients.delete(id);
}

/** Current data version (increments on every coalesced dataChanged broadcast) */
export function currentVersion(): number {
  return g.__sseVersion;
}

function send(event: string, payload: Record<string, any>) {
  const data = { ...payload, ts: Date.now() };
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  const encoded = encoder.encode(msg);
  for (const [id, client] of clients) {
    try {
      client.controller.enqueue(encoded);
    } catch {
      // Client disconnected — remove it
      clients.delete(id);
    }
  }
  // WebSocket sinks (didaftarkan oleh server.mjs) — kirim event yang sama via WebSocket
  const sinks: Set<(e: string, d: any) => void> | undefined = g.__rtHub?.sinks;
  if (sinks) for (const sink of sinks) { try { sink(event, data); } catch {} }
}

const COALESCE_MS = 120;

/**
 * Broadcast a named event to ALL connected clients.
 * "dataChanged" is coalesced: bursts of writes within COALESCE_MS produce a single event.
 */
export function broadcast(event: string = "dataChanged", payload: Record<string, any> = {}) {
  if (event !== "dataChanged") {
    send(event, payload);
    return;
  }
  if (g.__sseTimer) return; // already scheduled — this change will be included
  g.__sseTimer = setTimeout(() => {
    g.__sseTimer = null;
    g.__sseVersion += 1;
    send("dataChanged", { ...payload, v: g.__sseVersion });
  }, COALESCE_MS);
}

/** Return current number of connected clients */
export function clientCount() {
  return clients.size;
}
