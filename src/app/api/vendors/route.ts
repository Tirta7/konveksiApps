export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { readData, writeData } from "@/lib/data-store";
import { getCmtCompletion, getTransferCompletion, isVendorTransferActive } from "@/lib/po-lifecycle";

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

    return { ...v, throttle: currentThrottle, maxOverdueDays, activeJobCount: activePoCount + activeTransferCount };
  });

  return NextResponse.json(enrichedVendors);
}

export async function POST(req: Request) {
  const data = readData();
  const body = await req.json();
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
  data.vendors.push(newVendor);
  writeData(data);
  return NextResponse.json(newVendor);
}

export async function PATCH(req: Request) {
  const data = readData();
  const body = await req.json();
  const { id, ...updates } = body;
  const idx = data.vendors.findIndex((v: any) => String(v.id) === String(id));
  if (idx === -1) return NextResponse.json({ error: "Vendor tidak ditemukan" }, { status: 404 });
  
  data.vendors[idx] = { ...data.vendors[idx], ...updates };
  writeData(data);
  return NextResponse.json(data.vendors[idx]);
}
