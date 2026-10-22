/**
 * Gerbang akses aplikasi (Next.js 16: proxy.ts, runtime Node.js).
 *
 * 3 jenis akses:
 *  - Publik       : halaman login, API auth, link SPK bertoken, halaman portal vendor
 *                   (halaman portal menampilkan form login vendor sendiri).
 *  - Owner/Admin  : semua halaman & API. Admin tidak bisa membuka menu keuangan & pengaturan.
 *  - Vendor       : hanya API portal miliknya (kepemilikan data dicek lagi di tiap route).
 *
 * Sesi divalidasi ulang ke data (akun aktif, versi sesi) lewat validateSession.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth-core";
import { validateSession, portalPathForVendor } from "@/lib/auth";

const PORTAL_PAGE = /^\/(cmt|washing|finishing|bersih-benang)\/[^/]+\/?$/;

function isPublic(pathname: string, method: string): boolean {
  if (pathname === "/login") return true;
  if (pathname.startsWith("/api/auth/")) return true;
  if (pathname.startsWith("/api/license-status")) return true;
  if (pathname.startsWith("/spk/")) return true; // link SPK bertoken untuk tukang/vendor
  if (/^\/api\/spk\/[^/]+$/.test(pathname) && (method === "GET" || method === "PATCH")) return true;
  if (PORTAL_PAGE.test(pathname)) return true; // halaman portal: gate login vendor di sisi halaman
  if (pathname === "/api/pengaturan" && method === "GET") return true; // nama usaha & logo untuk halaman login/portal
  if (/^\/api\/marketplace\/(tiktok|shopee)\/(callback|webhook)$/.test(pathname)) return true; // callback & webhook marketplace
  if (pathname === "/manifest.webmanifest" || pathname === "/sw.js") return true;
  return false;
}

/** API yang boleh dipanggil sesi vendor (method → pola path). */
const VENDOR_API: Array<[string[], RegExp]> = [
  [["GET"], /^\/api\/cmt-portal\/[^/]+$/],
  [["GET", "POST"], /^\/api\/cmt-progres$/],
  [["GET", "POST", "PUT", "DELETE"], /^\/api\/cmt-request$/],
  [["PUT"], /^\/api\/portal-vendor\/mulai-kerja$/],
  [["GET", "POST"], /^\/api\/(events|presence)(\/.*)?$/],
];

/** Hanya Owner (Admin/Gudang ditolak). */
const OWNER_PAGES = [/^\/laporan(\/|$)/, /^\/hutang(\/|$)/, /^\/piutang(\/|$)/, /^\/karyawan(\/|$)/, /^\/pengaturan(\/|$)/];
function ownerOnlyApi(pathname: string, method: string) {
  if (/^\/api\/(hutang|settlement|laporan|users|marketplace)(\/|$)/.test(pathname)) return true;
  if (pathname === "/api/pengaturan" && method !== "GET") return true;
  return false;
}

function deny(req: NextRequest, status: number, msg: string) {
  if (req.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ error: msg }, { status });
  return null;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method.toUpperCase();
  if (isPublic(pathname, method)) return NextResponse.next();

  const session = validateSession(verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value));

  // Belum login
  if (!session) {
    const r = deny(req, 401, "Sesi berakhir. Silakan login kembali.");
    if (r) return r;
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname + req.nextUrl.search)}` : "";
    return NextResponse.redirect(url);
  }

  // Sesi vendor: hanya API portal
  if (session.t === "vendor") {
    if (pathname.startsWith("/api/")) {
      const ok = VENDOR_API.some(([methods, re]) => methods.includes(method) && re.test(pathname));
      return ok ? NextResponse.next() : NextResponse.json({ error: "Akses ditolak untuk akun vendor" }, { status: 403 });
    }
    // Halaman admin → kembalikan ke portal vendor ybs (sesuai tipe vendor)
    const url = req.nextUrl.clone();
    url.pathname = portalPathForVendor(session.id);
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Admin/Gudang: tanpa menu keuangan & pengaturan
  if (session.role !== "owner") {
    if (pathname.startsWith("/api/")) {
      if (ownerOnlyApi(pathname, method)) return NextResponse.json({ error: "Hanya Owner yang dapat mengakses data ini" }, { status: 403 });
    } else if (OWNER_PAGES.some((re) => re.test(pathname))) {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "?akses=ditolak";
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  // Lewati aset statis Next.js & file publik ber-ekstensi (gambar, ikon, dll)
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|txt|xml|woff2?|ttf|css|js|map)$).*)"],
};
