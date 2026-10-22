/**
 * Helper autentikasi sisi server (memakai data-store).
 * Sesi divalidasi ulang ke data: akun harus masih ada, aktif, dan versi sesi cocok
 * (versi naik saat password diganti / akun dinonaktifkan → sesi lama langsung tidak berlaku).
 */
import { readData } from "@/lib/data-store";
import { verifySessionToken, readCookie, type Session, type Role } from "@/lib/auth-core";

export function validateSession(s: Session | null): Session | null {
  if (!s) return null;
  const data: any = readData();
  if (s.t === "user") {
    const u = (data.users || []).find((x: any) => Number(x.id) === Number(s.id));
    if (!u || u.aktif === false || Number(u.session_v || 0) !== Number(s.v || 0)) return null;
    return { ...s, role: u.role as Role, nama: u.nama || u.username };
  }
  if (s.t === "vendor") {
    const v = (data.vendors || []).find((x: any) => Number(x.id) === Number(s.id));
    if (!v || v.aktif === false || !v.portal_password_hash || Number(v.portal_session_v || 0) !== Number(s.v || 0)) return null;
    return { ...s, nama: v.nama };
  }
  return null;
}

export function getSessionFromRequest(req: Request): Session | null {
  return validateSession(verifySessionToken(readCookie(req.headers.get("cookie"))));
}

/** Alamat portal sesuai Tipe Vendor (sumber sama dengan tombol "Portal" di Atur Vendor). */
const PORTAL_SEGMENTS = new Set(["cmt", "washing", "finishing", "bersih-benang"]);
export function portalPathForVendor(vendorId: any): string {
  const data: any = readData();
  const v = (data.vendors || []).find((x: any) => String(x.id) === String(vendorId));
  const tipe = String(v?.tipe || "cmt").toLowerCase();
  const vt = (data.vendor_types || []).find((t: any) => String(t.slug || "").toLowerCase() === tipe);
  const fromType = String(vt?.portal_path || (tipe === "cmt" ? "/cmt" : "")).replace(/^\/+|\/+$/g, "");
  const seg = PORTAL_SEGMENTS.has(fromType) ? fromType
    : tipe === "washing" ? "washing"
    : tipe === "finishing" || tipe === "packing" ? "finishing"
    : tipe.includes("benang") ? "bersih-benang"
    : "cmt";
  return `/${seg}/${vendorId}`;
}

/** Hapus field rahasia sebelum data user/vendor dikirim ke browser. */
export function publicUser(u: any) {
  if (!u) return u;
  const { password_hash, session_v, ...rest } = u;
  return rest;
}
export function publicVendor(v: any) {
  if (!v) return v;
  const { portal_password_hash, portal_session_v, ...rest } = v;
  return { ...rest, portal_aktif: !!portal_password_hash };
}

/**
 * Untuk route yang bisa diakses vendor: pastikan vendor hanya menyentuh datanya sendiri.
 * User (owner/admin) selalu lolos. Mengembalikan pesan error atau null jika boleh.
 */
export function vendorOwnershipError(req: Request, vendorId: any): string | null {
  const s = getSessionFromRequest(req);
  if (!s) return "Silakan login terlebih dahulu";
  if (s.t === "user") return null;
  if (vendorId == null || String(vendorId) !== String(s.id)) return "Akses ditolak: data ini bukan milik akun vendor Anda";
  return null;
}
