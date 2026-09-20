/**
 * Server-Sent Events (SSE) manager
 * Keeps track of all connected admin browser clients and broadcasts updates to them.
 */

type SSEClient = {
  id: string;
  controller: ReadableStreamDefaultController;
};

// Use a global variable so the Map persists across hot-reloads in dev
const g = global as any;
if (!g.__sseClients) {
  g.__sseClients = new Map<string, SSEClient>();
}

const clients: Map<string, SSEClient> = g.__sseClients;

/** Register a new SSE connection */
export function addClient(id: string, controller: ReadableStreamDefaultController) {
  clients.set(id, { id, controller });
}

/** Remove a disconnected client */
export function removeClient(id: string) {
  clients.delete(id);
}

/** Broadcast a named event to ALL connected clients */
export function broadcast(event: string = "dataChanged", payload: Record<string, any> = {}) {
  const msg = `event: ${event}\ndata: ${JSON.stringify({ ...payload, ts: Date.now() })}\n\n`;
  const encoded = new TextEncoder().encode(msg);
  for (const [id, client] of clients) {
    try {
      client.controller.enqueue(encoded);
    } catch {
      // Client disconnected – remove it
      clients.delete(id);
    }
  }
}

/** Return current number of connected clients */
export function clientCount() {
  return clients.size;
}
