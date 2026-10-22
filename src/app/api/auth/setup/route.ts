export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";
import { hashPassword, createSessionToken, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth-core";

/**
 * POST { nama, username, password } → buat akun OWNER pertama.
 * Hanya berfungsi selama belum ada satu pun akun Owner (instalasi baru).
 */
export async function POST(req: NextRequest) {
  const data: any = readData();
  if ((data.users || []).some((u: any) => u.role === "owner")) {
    return NextResponse.json({ error: "Akun Owner sudah ada. Silakan login." }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const username = String(body.username || "").trim().toLowerCase();
  const nama = String(body.nama || "").trim() || username;
  const password = String(body.password || "");
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) return NextResponse.json({ error: "Username 3–32 karakter (huruf kecil, angka, titik, strip)" }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Password minimal 8 karakter" }, { status: 400 });

  if (!data.users) data.users = [];
  const user = {
    id: nextId(data, "users" as any),
    username,
    nama,
    role: "owner",
    aktif: true,
    password_hash: hashPassword(password),
    session_v: 0,
    createdAt: new Date().toISOString(),
  };
  data.users.push(user);
  writeData(data);

  const token = createSessionToken({ t: "user", id: user.id, role: "owner", nama, v: 0 });
  const res = NextResponse.json({ success: true });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(req));
  return res;
}
