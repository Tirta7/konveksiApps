/**
 * Redis client untuk KonveksiApps
 * 
 * Fitur:
 *  - Cache data JSON di RAM Redis (baca 10x lebih cepat dari file)
 *  - Pub/Sub untuk broadcast SSE ke multi-proses server
 *  - Graceful fallback ke file-based jika Redis tidak tersedia
 */
import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const CACHE_KEY = "konveksi:data";
const CHANNEL   = "konveksi:changes";
const CACHE_TTL = 0; // 0 = no expiry (data selalu fresh)

const g = global as any;

function createClient(name: string) {
  const client = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 2000,
    lazyConnect: true,
    retryStrategy: (times) => (times > 3 ? null : Math.min(times * 500, 2000)),
  });
  client.on("connect",     () => console.log(`[Redis] ${name} connected`));
  client.on("error",       (e) => { /* suppress noise */ });
  client.on("reconnecting",() => {});
  return client;
}

// Singleton clients (survive hot-reload in Next.js dev)
if (!g.__redisClient) g.__redisClient = createClient("pub");
if (!g.__redisSub)    g.__redisSub    = createClient("sub");

export const redis:    Redis = g.__redisClient;
export const redisSub: Redis = g.__redisSub;

/** True kalau Redis terhubung & siap */
export function isRedisReady() {
  return redis.status === "ready";
}

/** Ambil data dari Redis cache; null jika cache kosong atau Redis mati */
export async function getCached(): Promise<string | null> {
  if (!isRedisReady()) return null;
  try {
    return await redis.get(CACHE_KEY);
  } catch { return null; }
}

/** Simpan data ke Redis cache */
export async function setCache(jsonStr: string): Promise<void> {
  if (!isRedisReady()) return;
  try {
    if (CACHE_TTL > 0) await redis.setex(CACHE_KEY, CACHE_TTL, jsonStr);
    else               await redis.set(CACHE_KEY, jsonStr);
  } catch {}
}

/** Hapus cache (paksa baca ulang dari file) */
export async function invalidateCache(): Promise<void> {
  if (!isRedisReady()) return;
  try { await redis.del(CACHE_KEY); } catch {}
}

/** Publish event ke semua subscriber (multi-proses) */
export async function publishChange(): Promise<void> {
  if (!isRedisReady()) return;
  try { await redis.publish(CHANNEL, "1"); } catch {}
}

/** Subscribe ke channel perubahan data */
export function subscribeChanges(onMessage: () => void): () => void {
  let active = true;

  async function trySubscribe() {
    if (!active) return;
    try {
      await redisSub.connect().catch(() => {});
      await redisSub.subscribe(CHANNEL);
      redisSub.on("message", (ch: string) => {
        if (ch === CHANNEL && active) onMessage();
      });
    } catch {
      // Redis belum siap, coba lagi setelah 5s
      setTimeout(() => { if (active) trySubscribe(); }, 5000);
    }
  }

  trySubscribe();

  // Cleanup
  return () => {
    active = false;
    redisSub.unsubscribe(CHANNEL).catch(() => {});
  };
}

export { CHANNEL };
