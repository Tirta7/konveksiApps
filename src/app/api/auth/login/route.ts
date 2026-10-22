export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { readData } from "@/lib/data-store";
import { verifyPassword, createSessionToken, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth-core";
import { publicVendor } from "@/lib/auth";

// Batasi percobaan gagal: maks 10 kali / 10 menit per IP + akun
const g = globalThis as any;
if (!g.__loginFails) g.__loginFails = new Map<string, { n: number; until: number }>();
const fails: Map<string, { n: number; until: number }> = g.__loginFails;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILS = 10;

function clientIp(req: NextRequest) {
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
}

// POST { mode: "user", username, password } | { mode: "vendor", kode, password, vendor_id? }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const mode = body.mode === "vendor" ? "vendor" : "user";
  const ident = String(mode === "vendor" ? body.kode || "" : body.username || "").trim().toLowerCase();
  const password = String(body.password || "");
  const key = `${clientIp(req)}|${mode}|${ident}`;
  const f = fails.get(key);
  if (f && f.n >= MAX_FAILS && f.until > Date.now()) {
    const menit = Math.ceil((f.until - Date.now()) / 60000);
    return NextResponse.json({ error: `Terlalu banyak percobaan gagal. Coba lagi dalam ${menit} menit.` }, { status: 429 });
  }
  const fail = (msg: string) => {
    const cur = fails.get(key);
    const n = cur && cur.until > Date.now() ? cur.n + 1 : 1;
    fails.set(key, { n, until: Date.now() + WINDOW_MS });
    return NextResponse.json({ error: msg }, { status: 401 });
  };
  if (!ident || !password) return NextResponse.json({ error: "Isi username dan password" }, { status: 400 });

  const data: any = readData();
  let token: string;
  let result: any;
  if (mode === "user") {
    const u = (data.users || []).find((x: any) => String(x.username || "").toLowerCase() === ident);
    if (!u || !verifyPassword(password, u.password_hash)) return fail("Username atau password salah");
    if (u.aktif === false) return fail("Akun ini dinonaktifkan. Hubungi Owner.");
    token = createSessionToken({ t: "user", id: u.id, role: u.role, nama: u.nama || u.username, v: Number(u.session_v || 0) });
    result = { t: "user", id: u.id, role: u.role, nama: u.nama || u.username, username: u.username };
  } else {
    const v = (data.vendors || []).find((x: any) =>
      String(x.kodeVendor || "").toLowerCase() === ident || String(x.portal_username || "").toLowerCase() === ident);
    if (!v || !verifyPassword(password, v.portal_password_hash)) return fail("Kode vendor atau password salah");
    if (v.aktif === false) return fail("Akun vendor ini dinonaktifkan. Hubungi admin.");
    if (body.vendor_id != null && String(body.vendor_id) !== String(v.id)) return fail("Akun ini bukan untuk portal vendor tersebut");
    token = createSessionToken({ t: "vendor", id: v.id, nama: v.nama, v: Number(v.portal_session_v || 0) });
    const pv = publicVendor(v);
    result = { t: "vendor", id: v.id, nama: v.nama, tipe: pv.tipe, kodeVendor: v.kodeVendor };
  }
  fails.delete(key);
  const res = NextResponse.json({ success: true, session: result });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(req));
  return res;
}
