/**
 * Inti autentikasi (tanpa dependensi data-store, aman dipakai di proxy.ts & server.mjs).
 *
 * - Password di-hash dengan scrypt + salt acak.
 * - Sesi = cookie httpOnly berisi payload JSON (base64url) + tanda tangan HMAC-SHA256.
 *   Payload: { t: "user" | "vendor", id, role?, nama, exp, v }.
 * - Kunci rahasia: env AUTH_SECRET, atau dibuat otomatis & disimpan di DATA_DIR/.auth-secret.
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";

export const SESSION_COOKIE = "kv_session";
export const SESSION_TTL_SEC = 60 * 60 * 24 * 7; // 7 hari

export type Role = "owner" | "admin";
export interface Session {
  t: "user" | "vendor";
  id: number;
  role?: Role;
  nama: string;
  exp: number; // epoch detik
  v?: number; // versi sesi (naik saat password diganti → sesi lama tidak berlaku)
}

let cachedSecret: string | null = null;
export function getAuthSecret(): string {
  if (cachedSecret) return cachedSecret;
  if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 16) {
    cachedSecret = process.env.AUTH_SECRET;
    return cachedSecret;
  }
  const dir = process.env.DATA_DIR || process.cwd();
  const file = path.join(dir, ".auth-secret");
  try {
    if (fs.existsSync(file)) {
      const s = fs.readFileSync(file, "utf-8").trim();
      if (s.length >= 16) return (cachedSecret = s);
    }
    const s = crypto.randomBytes(48).toString("base64url");
    fs.writeFileSync(file, s, { mode: 0o600 });
    return (cachedSecret = s);
  } catch {
    // Terakhir: kunci sementara di memori (sesi hilang saat restart)
    cachedSecret = crypto.randomBytes(48).toString("base64url");
    return cachedSecret;
  }
}

// ── Password ──
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored?: string | null): boolean {
  if (!stored || typeof stored !== "string") return false;
  const [algo, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const test = crypto.scryptSync(String(password), salt, 64);
  const ref = Buffer.from(hash, "hex");
  return ref.length === test.length && crypto.timingSafeEqual(ref, test);
}

// ── Sesi ──
function sign(body: string): string {
  return crypto.createHmac("sha256", getAuthSecret()).update(body).digest("base64url");
}

export function createSessionToken(s: Omit<Session, "exp">, ttlSec = SESSION_TTL_SEC): string {
  const payload: Session = { ...s, exp: Math.floor(Date.now() / 1000) + ttlSec };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifySessionToken(token?: string | null): Session | null {
  if (!token) return null;
  const [body, sig] = String(token).split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString("utf-8")) as Session;
    if (!s || typeof s.exp !== "number" || s.exp < Math.floor(Date.now() / 1000)) return null;
    return s;
  } catch {
    return null;
  }
}

/** Ambil nilai cookie dari header Cookie mentah. */
export function readCookie(cookieHeader: string | null | undefined, name = SESSION_COOKIE): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

export function sessionCookieOptions(req?: Request) {
  // Secure hanya jika diakses via HTTPS (Cloudflare mengirim x-forwarded-proto)
  const proto = req?.headers.get("x-forwarded-proto") || (req ? new URL(req.url).protocol.replace(":", "") : "");
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: proto === "https",
    path: "/",
    maxAge: SESSION_TTL_SEC,
  };
}
