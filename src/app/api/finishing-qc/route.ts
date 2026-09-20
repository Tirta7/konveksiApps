import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";

// GET: list finishing qc results
export async function GET(req: NextRequest) {
  const data = readData();
  if (!data.produksi_transfers) data.produksi_transfers = [];
  const { searchParams } = new URL(req.url);
  const vendorId = searchParams.get("vendor_id");
  const poId = searchParams.get("po_id");
  
  // Get transfers sent TO finishing stage
  let transfers = (data.produksi_transfers || []).filter((t: any) => t.ke === "finishing");
  if (vendorId) transfers = transfers.filter((t: any) => String(t.vendor_id) === vendorId);
  if (poId) transfers = transfers.filter((t: any) => String(t.po_id) === poId);
  
  const enriched = transfers.map((t: any) => {
    const po = (data.po_produksi || []).find((p: any) => p.id === t.po_id);
    const vendor = (data.vendors || []).find((v: any) => v.id === t.vendor_id);
    
    // Count already QC'd for this PO
    const qcDone = (data.produksi_transfers || [])
      .filter((x: any) => x.po_id === t.po_id && x.dari === "finishing" && x.ke === "siap_jual")
      .reduce((sum: number, x: any) => sum + (x.jumlah_kirim || 0), 0);
    
    return {
      ...t,
      noPo: po?.noPo || "-",
      model: po?.model || "-",
      vendor_nama: vendor?.nama || "-",
      sizeBreakdown_po: po?.sizeBreakdown || [],
      qcSudahDilakukan: qcDone
    };
  }).reverse();
  
  return NextResponse.json(enriched);
}

// POST: QC finishing submit - marks barcodes as siap_jual
export async function POST(req: NextRequest) {
  const data = readData();
  if (!data.barcode_item) data.barcode_item = [];
  if (!data.produksi_transfers) data.produksi_transfers = [];
  
  const body = await req.json();
  const { po_id, vendor_id, sizeBreakdown, catatan } = body;
  // sizeBreakdown: [{ size: "XS", jumlah: 25 }, ...]
  
  if (!po_id || !sizeBreakdown?.length) {
    return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
  }
  
  const totalJumlah = sizeBreakdown.reduce((sum: number, s: any) => sum + Number(s.jumlah), 0);
  
  // For each size, mark that many barcode_items as siap_jual (take the ones still in "potong" or "proses" status)
  let totalUpdated = 0;
  for (const sizeItem of sizeBreakdown) {
    const qty = Number(sizeItem.jumlah);
    if (qty <= 0) continue;
    // Find barcode items for this PO + size that are NOT yet siap_jual
    const candidates = data.barcode_item.filter(
      (b: any) => String(b.poId) === String(po_id) && b.size === sizeItem.size && b.status !== "siap_jual"
    );
    const toUpdate = candidates.slice(0, qty);
    toUpdate.forEach((b: any) => {
      const idx = data.barcode_item.findIndex((x: any) => x.id === b.id);
      if (idx !== -1) {
        data.barcode_item[idx].status = "siap_jual";
        data.barcode_item[idx].qcAt = new Date().toISOString();
      }
    });
    totalUpdated += toUpdate.length;
  }
  
  // Create a transfer record dari finishing -> siap_jual
  const id = nextId(data, "produksi_transfers" as any);
  data.produksi_transfers.push({
    id, po_id: Number(po_id),
    dari: "finishing", ke: "siap_jual",
    vendor_id: vendor_id ? Number(vendor_id) : null,
    jumlah_kirim: totalJumlah,
    jumlah_diterima: totalUpdated,
    sizeBreakdown,
    status: "Diverifikasi",
    tanggal_kirim: new Date().toISOString(),
    tanggal_terima: new Date().toISOString(),
    catatan: catatan || ""
  });
  
  writeData(data);
  return NextResponse.json({ success: true, totalUpdated });
}
