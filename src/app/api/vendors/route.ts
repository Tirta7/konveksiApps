export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { readData, writeData } from "@/lib/data-store";
import { getCmtCompletion, getTransferCompletion, isVendorTransferActive } from "@/lib/po-lifecycle";
import { hashPassword } from "@/lib/auth-core";
import { publicVendor } from "@/lib/auth";

/** Terapkan perubahan password portal (plaintext tidak pernah disimpan). */
function applyPortalPassword(v: any, body: any): string | null {
  if (body.portal_password_clear) {
    delete v.portal_password_hash;
    v.portal_session_v = Number(v.portal_session_v || 0) + 1;
  }
  if (body.portal_password) {
    if (String(body.portal_password).length < 6) return "Password portal minimal 6 karakter";
    v.portal_password_hash = hashPassword(String(body.portal_password));
    v.portal_session_v = Number(v.portal_session_v || 0) + 1;
  }
  return null;
}

export async function GET() {
  const data = readData();
  const vendors = data.vendors || [];
  
  // Calculate global throttle for all vendors (aturan terpusat: lib/po-lifecycle)

  const enrichedVendors = vendors.map((v: any) => {
    let maxOverdueDays = 0;

    // Overdue dari PO Jahit (CMT) — hanya yang hitungan terlambatnya masih berjalan
    const myPOs = (data.po_produksi || []).filter((p: any) => p.vendorId === v.id);
    let activePoCount = 0;
    for (const po of myPOs) {
      const c = getCmtCompletion(data, po);
      if (c.done) continue;
      activePoCount++;
      if (c.isOverdue) maxOverdueDays = Math.max(maxOverdueDays, c.lateDays);
    }

    // Overdue dari produksi_transfers (Washing, Finishing, dll)
    let activeTransferCount = 0;
    for (const t of (data.produksi_transfers || [])) {
      if (t.vendor_id !== v.id || !isVendorTransferActive(t)) continue;
      activeTransferCount++;
      const c = getTransferCompletion(data, t);
      if (c.isOverdue) maxOverdueDays = Math.max(maxOverdueDays, c.lateDays);
    }

    // Calculate throttle
    let currentThrottle = 100;
    currentThrottle -= maxOverdueDays;
    if (currentThrottle < 0) currentThrottle = 0;

    return { ...publicVendor(v), throttle: currentThrottle, maxOverdueDays, activeJobCount: activePoCount + activeTransferCount };
  });

  return NextResponse.json(enrichedVendors);
}

export async function POST(req: Request) {
  const body = await req.json();
  const data = readData();
  const newId = data.vendors.length > 0 ? Math.max(...data.vendors.map((v: any) => v.id)) + 1 : 1;
  const prefix = (body.tipe || "VND").substring(0, 3).toUpperCase();
  const kodeVendor = `${prefix}-${String(newId).padStart(3, "0")}`;

  const newVendor = {
    id: newId,
    kodeVendor,
    nama: body.nama,
    tipe: body.tipe,
    jenis_default: body.jenis_default || "",
    kontak: body.kontak || "",
    wajib_hitung_ulang: body.wajib_hitung_ulang || false,
    hargaPerPcs: body.hargaPerPcs || 0,
    tarifPotongan: body.tarifPotongan || {},
    min_progress_pct: body.min_progress_pct ?? 70,
    aktif: true,
    createdAt: new Date().toISOString()
  };
  const pwErr = applyPortalPassword(newVendor, body);
  if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 });
  data.vendors.push(newVendor);
  writeData(data);
  return NextResponse.json(publicVendor(newVendor));
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const data = readData();
  const { id, portal_password, portal_password_clear, portal_password_hash, portal_session_v, portal_aktif, ...updates } = body;
  const idx = data.vendors.findIndex((v: any) => String(v.id) === String(id));
  if (idx === -1) return NextResponse.json({ error: "Vendor tidak ditemukan" }, { status: 404 });
  
  const merged: any = { ...data.vendors[idx], ...updates };
  const pwErr = applyPortalPassword(merged, { portal_password, portal_password_clear });
  if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 });
  // Vendor dinonaktifkan → sesi portalnya ikut keluar
  if (updates.aktif === false && data.vendors[idx].aktif !== false) merged.portal_session_v = Number(merged.portal_session_v || 0) + 1;
  data.vendors[idx] = merged;
  writeData(data);
  return NextResponse.json(publicVendor(data.vendors[idx]));
}
