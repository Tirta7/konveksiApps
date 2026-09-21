export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { readData, writeData } from "@/lib/data-store";

export async function GET() {
  const data = readData();
  const vendors = data.vendors || [];
  
  // Calculate global throttle for all vendors
  const today = new Date();
  today.setHours(0,0,0,0);

  const enrichedVendors = vendors.map((v: any) => {
    let maxOverdueDays = 0;

    // Check overdue from PO Jahit (CMT)
    const activePOs = (data.po_produksi || []).filter((p: any) => p.vendorId === v.id && p.status !== "Selesai");
    activePOs.forEach((po: any) => {
      if (po.target_selesai) {
        const graceDate = new Date(po.target_selesai);
        graceDate.setDate(graceDate.getDate() + 1);
        graceDate.setHours(0, 0, 0, 0);
        if (today > graceDate) {
          // Has the PO been 100% ACC'd in cmt_progres?
          const records = (data.cmt_progres || []).filter((p: any) => p.po_id === po.id && (p.status === "Diverifikasi" || p.status === "Diterima"));
          const acc = records.reduce((s: number, r: any) => s + (r.items || []).reduce((ss: number, i: any) => ss + Number(i.jumlah || 0), 0), 0);
          if (acc < po.jumlahTerbit) {
            const overdue = Math.floor((today.getTime() - graceDate.getTime()) / (1000 * 60 * 60 * 24));
            if (overdue > maxOverdueDays) maxOverdueDays = overdue;
          }
        }
      }
    });

    // Check overdue from produksi_transfers (Washing, Finishing, etc)
    const activeTransfers = (data.produksi_transfers || []).filter((t: any) => t.vendor_id === v.id && t.status !== "Diterima");
    activeTransfers.forEach((t: any) => {
      if (t.target_selesai) {
        const graceDate = new Date(t.target_selesai);
        graceDate.setDate(graceDate.getDate() + 1);
        graceDate.setHours(0, 0, 0, 0);
        if (today > graceDate) {
          const overdue = Math.floor((today.getTime() - graceDate.getTime()) / (1000 * 60 * 60 * 24));
          if (overdue > maxOverdueDays) maxOverdueDays = overdue;
        }
      }
    });

    // Calculate throttle
    let currentThrottle = 100;
    currentThrottle -= maxOverdueDays;
    if (currentThrottle < 0) currentThrottle = 0;

    return { ...v, throttle: currentThrottle };
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
