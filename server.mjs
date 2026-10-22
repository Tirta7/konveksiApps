/**
 * KONVEKSI APPS — Custom server: Next.js + WebSocket realtime hub (/ws)
 *
 * - Semua halaman & API tetap ditangani Next.js (dev / production).
 * - WebSocket /ws dipakai untuk push realtime (perubahan data, event bentrok, presence).
 * - Hub disimpan di global.__rtHub sehingga API route (proses yang sama) bisa broadcast
 *   lewat src/lib/realtime-hub.ts tanpa import file ini.
 * - Jika server dijalankan dengan `next dev` biasa, client otomatis fallback ke SSE (/api/events).
 */
import { createServer } from "http";
import next from "next";
import { WebSocketServer } from "ws";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { checkRequestAllowed, licenseStatus } from "./src/license.mjs";

// ── Verifikasi cookie sesi (algoritma sama dengan src/lib/auth-core.ts) ──
const DATA_DIR = process.env.DATA_DIR || process.cwd();
function authSecret() {
  if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 16) return process.env.AUTH_SECRET;
  try { return fs.readFileSync(path.join(DATA_DIR, ".auth-secret"), "utf-8").trim(); } catch { return null; }
}
function validSessionCookie(cookieHeader) {
  const secret = authSecret();
  if (!secret || !cookieHeader) return false;
  const part = cookieHeader.split(";").map((s) => s.trim()).find((s) => s.startsWith("kv_session="));
  if (!part) return false;
  const [body, sig] = decodeURIComponent(part.slice("kv_session=".length)).split(".");
  if (!body || !sig) return false;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try { return JSON.parse(Buffer.from(body, "base64url").toString("utf-8")).exp > Date.now() / 1000; } catch { return false; }
}

// ── Backup harian otomatis: DATA_DIR/backups/konveksi-data-YYYY-MM-DD.json (simpan 14 hari) ──
function dailyBackup() {
  try {
    const src = path.join(DATA_DIR, "konveksi-data.json");
    if (!fs.existsSync(src)) return;
    const dir = path.join(DATA_DIR, "backups");
    fs.mkdirSync(dir, { recursive: true });
    const day = new Date().toISOString().slice(0, 10);
    const dest = path.join(dir, `konveksi-data-${day}.json`);
    if (!fs.existsSync(dest)) fs.copyFileSync(src, dest);
    const files = fs.readdirSync(dir).filter((f) => /^konveksi-data-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
    for (const f of files.slice(0, Math.max(0, files.length - 14))) fs.unlinkSync(path.join(dir, f));
  } catch (e) { console.error("[backup] gagal:", e?.message); }
}

const port = parseInt(process.env.PORT || "3001", 10);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev, port });
const handle = app.getRequestHandler();

// ── Realtime hub (dibagi dengan API route melalui global) ──
const g = globalThis;
if (!g.__rtHub) g.__rtHub = { presence: new Map(), sinks: new Set() };
const hub = g.__rtHub;
hub.transport = "websocket";

const PRESENCE_TTL_MS = 45_000;

function presenceList() {
  const now = Date.now();
  const out = [];
  for (const [k, p] of hub.presence) {
    if (now - p.at > PRESENCE_TTL_MS) { hub.presence.delete(k); continue; }
    out.push(p);
  }
  return out;
}

app.prepare().then(() => {
  const upgradeNext = app.getUpgradeHandler();
  const server = createServer((req, res) => {
    if (!checkRequestAllowed(req, res)) return;
    return handle(req, res);
  });
  const wss = new WebSocketServer({ noServer: true });

  const sendAll = (event, data) => {
    const msg = JSON.stringify({ event, data: { ...(data || {}), ts: Date.now() } });
    for (const ws of wss.clients) {
      if (ws.readyState === 1) { try { ws.send(msg); } catch {} }
    }
  };
  // Sink dipanggil oleh src/lib/sse.ts → setiap broadcast juga dikirim via WebSocket
  hub.sinks.add(sendAll);
  hub.broadcastPresence = () => sendAll("rt", { event: "presence", data: { list: presenceList() } });

  wss.on("connection", (ws) => {
    ws.isAlive = true;
    ws.keys = new Set();
    ws.on("pong", () => { ws.isAlive = true; });
    ws.send(JSON.stringify({ event: "connected", data: { v: g.__sseVersion || 0, transport: "websocket", ts: Date.now() } }));
    ws.send(JSON.stringify({ event: "rt", data: { event: "presence", data: { list: presenceList() }, ts: Date.now() } }));

    ws.on("message", (raw) => {
      let m;
      try { m = JSON.parse(String(raw)); } catch { return; }
      if (m.t === "ping") { ws.send(JSON.stringify({ event: "pong", data: { ts: Date.now() } })); return; }
      if (m.t === "presence" && m.key) {
        const key = String(m.key);
        if (m.info) {
          hub.presence.set(key, { key, ...m.info, at: Date.now() });
          ws.keys.add(key);
        } else {
          hub.presence.delete(key);
          ws.keys.delete(key);
        }
        hub.broadcastPresence();
      }
    });

    ws.on("close", () => {
      let changed = false;
      for (const k of ws.keys) if (hub.presence.delete(k)) changed = true;
      if (changed) hub.broadcastPresence();
    });
  });

  // Heartbeat: buang koneksi mati + kedaluwarsakan presence lama
  setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) { ws.terminate(); continue; }
      ws.isAlive = false;
      try { ws.ping(); } catch {}
    }
    const before = hub.presence.size;
    presenceList();
    if (hub.presence.size !== before) hub.broadcastPresence();
  }, 20_000);

  server.on("upgrade", (req, socket, head) => {
    if (!licenseStatus.allowed) {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    const { pathname } = new URL(req.url || "/", "http://localhost");
    if (pathname === "/ws") {
      // Realtime hanya untuk pengguna/vendor yang sudah login
      if (!validSessionCookie(req.headers.cookie)) {
        socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
    } else {
      upgradeNext(req, socket, head); // HMR Next.js dll.
    }
  });

  server.listen(port, () => {
    console.log(`> KONVEKSI APPS siap di http://localhost:${port} (${dev ? "development" : "production"}) · WebSocket /ws aktif · data: ${DATA_DIR}`);
  });

  dailyBackup();
  setInterval(dailyBackup, 60 * 60 * 1000); // cek tiap jam, 1 file per hari
});
