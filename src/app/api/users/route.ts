export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";
import { hashPassword } from "@/lib/auth-core";
import { getSessionFromRequest, publicUser } from "@/lib/auth";

const ROLES = ["owner", "admin"];

function requireOwner(req: NextRequest) {
  const s = getSessionFromRequest(req);
  if (!s || s.t !== "user" || s.role !== "owner") return { s: null, err: NextResponse.json({ error: "Hanya Owner yang dapat mengelola pengguna" }, { status: 403 }) };
  return { s, err: null };
}

export async function GET(req: NextRequest) {
  const { err } = requireOwner(req);
  if (err) return err;
  const data: any = readData();
  return NextResponse.json((data.users || []).map(publicUser));
}

// POST { username, nama, role, password }
export async function POST(req: NextRequest) {
  const { err } = requireOwner(req);
  if (err) return err;
  const body = await req.json().catch(() => ({}));
  const data: any = readData();
  const username = String(body.username || "").trim().toLowerCase();
  const role = ROLES.includes(body.role) ? body.role : "admin";
  const password = String(body.password || "");
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) return NextResponse.json({ error: "Username 3–32 karakter (huruf kecil, angka, titik, strip)" }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Password minimal 8 karakter" }, { status: 400 });
  if ((data.users || []).some((u: any) => String(u.username).toLowerCase() === username)) return NextResponse.json({ error: "Username sudah dipakai" }, { status: 400 });
  if (!data.users) data.users = [];
  const user = {
    id: nextId(data, "users" as any),
    username,
    nama: String(body.nama || "").trim() || username,
    role,
    telepon: String(body.telepon || "").trim(),
    jabatan: String(body.jabatan || "").trim(),
    catatan: String(body.catatan || "").trim(),
    aktif: true,
    password_hash: hashPassword(password),
    session_v: 0,
    createdAt: new Date().toISOString(),
  };
  data.users.push(user);
  writeData(data);
  return NextResponse.json(publicUser(user));
}

// PATCH { id, nama?, role?, aktif?, password? }
export async function PATCH(req: NextRequest) {
  const { s, err } = requireOwner(req);
  if (err) return err;
  const body = await req.json().catch(() => ({}));
  const data: any = readData();
  const u = (data.users || []).find((x: any) => String(x.id) === String(body.id));
  if (!u) return NextResponse.json({ error: "Pengguna tidak ditemukan" }, { status: 404 });
  const owners = (data.users || []).filter((x: any) => x.role === "owner" && x.aktif !== false);
  const isLastOwner = u.role === "owner" && owners.length <= 1;

  if (body.nama !== undefined) u.nama = String(body.nama).trim() || u.username;
  if (body.telepon !== undefined) u.telepon = String(body.telepon).trim();
  if (body.jabatan !== undefined) u.jabatan = String(body.jabatan).trim();
  if (body.catatan !== undefined) u.catatan = String(body.catatan).trim();
  if (body.role !== undefined && ROLES.includes(body.role) && body.role !== u.role) {
    if (isLastOwner) return NextResponse.json({ error: "Tidak bisa mengubah peran Owner terakhir" }, { status: 400 });
    u.role = body.role;
    u.session_v = Number(u.session_v || 0) + 1;
  }
  if (body.aktif !== undefined && Boolean(body.aktif) !== (u.aktif !== false)) {
    if (!body.aktif && (isLastOwner || String(u.id) === String(s!.id))) return NextResponse.json({ error: "Tidak bisa menonaktifkan akun sendiri / Owner terakhir" }, { status: 400 });
    u.aktif = Boolean(body.aktif);
    u.session_v = Number(u.session_v || 0) + 1;
  }
  if (body.password) {
    if (String(body.password).length < 8) return NextResponse.json({ error: "Password minimal 8 karakter" }, { status: 400 });
    u.password_hash = hashPassword(String(body.password));
    u.session_v = Number(u.session_v || 0) + 1; // semua sesi lama otomatis keluar
  }
  writeData(data);
  return NextResponse.json(publicUser(u));
}

export async function DELETE(req: NextRequest) {
  const { s, err } = requireOwner(req);
  if (err) return err;
  const id = new URL(req.url).searchParams.get("id");
  const data: any = readData();
  const u = (data.users || []).find((x: any) => String(x.id) === String(id));
  if (!u) return NextResponse.json({ error: "Pengguna tidak ditemukan" }, { status: 404 });
  if (String(u.id) === String(s!.id)) return NextResponse.json({ error: "Tidak bisa menghapus akun sendiri" }, { status: 400 });
  if (u.role === "owner" && (data.users || []).filter((x: any) => x.role === "owner").length <= 1) return NextResponse.json({ error: "Tidak bisa menghapus Owner terakhir" }, { status: 400 });
  data.users = data.users.filter((x: any) => x !== u);
  writeData(data);
  return NextResponse.json({ success: true });
}
