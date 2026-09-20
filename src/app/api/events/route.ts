import { NextRequest } from "next/server";
import { addClient, removeClient, broadcast } from "@/lib/sse";
import { CHANNEL } from "@/lib/redis";

// Setup Redis Pub/Sub listener once per process
// so cross-process broadcasts reach all SSE clients
const g = global as any;
if (!g.__redisSubSetup) {
  g.__redisSubSetup = true;

  import("@/lib/redis").then(({ redisSub }) => {
    async function setupSub() {
      try {
        if (redisSub.status === "wait" || redisSub.status === "close") {
          await redisSub.connect();
        }
        await redisSub.subscribe(CHANNEL);
        redisSub.on("message", (ch: string) => {
          if (ch === CHANNEL) {
            // Received change from another process — broadcast to our local SSE clients
            broadcast("dataChanged");
          }
        });
        console.log("[SSE] Redis Pub/Sub subscriber ready");
      } catch (e) {
        // Redis not available — fallback to direct in-process broadcast (still works)
        console.log("[SSE] Redis not available, using in-process broadcast only");
      }
    }
    setupSub();
  }).catch(() => {});
}

/**
 * GET /api/events
 * SSE endpoint — browsers connect here to receive real-time data change notifications.
 */
export async function GET(req: NextRequest) {
  const clientId = crypto.randomUUID();

  const stream = new ReadableStream({
    start(controller) {
      addClient(clientId, controller);

      // Send initial "connected" event
      const hello = `event: connected\ndata: {"clientId":"${clientId}"}\n\n`;
      controller.enqueue(new TextEncoder().encode(hello));

      // Keep-alive ping every 25s (prevents proxy/nginx timeouts)
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(": ping\n\n"));
        } catch {
          clearInterval(keepAlive);
        }
      }, 25000);

      // Cleanup on disconnect
      req.signal.addEventListener("abort", () => {
        clearInterval(keepAlive);
        removeClient(clientId);
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
