import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";

// GET: list transfers, optionally filter by po_id or tahap_ke
export async function GET(req: NextRequest) {
  const data = readData();
  if (!data.produksi_transfers) data.produksi_transfers = [];
  const { searchParams } = new URL(req.url);
  const poId = searchParams.get("po_id");
  const dari = searchParams.get("dari");
  const ke = searchParams.get("ke");
  let list = data.produksi_transfers;
  if (poId) list = list.filter((t: any) => String(t.po_id) === poId);
  if (dari) list = list.filter((t: any) => t.dari === dari);
  if (ke) list = list.filter((t: any) => t.ke === ke);
  // Enrich with vendor name + po info
  const enriched = list.map((t: any) => {
    const po = (data.po_produksi || []).find((p: any) => p.id === t.po_id);
    const vendor = (data.vendors || []).find((v: any) => v.id === t.vendor_id);
    return { ...t, noPo: po?.noPo || "-", model: po?.model || "-", vendor_nama: vendor?.nama || "-" };
  }).reverse();
  return NextResponse.json(enriched);
}

// POST: create a new transfer (e.g. Gudang kirim ke Washing)
export async function POST(req: NextRequest) {
  const data = readData();
  if (!data.produksi_transfers) data.produksi_transfers = [];
  const body = await req.json();
  const { po_id, dari, ke, vendor_id, jumlah_kirim, sizeBreakdown, catatan, transfer_id_asal } = body;
  if (!po_id || !dari || !ke || !jumlah_kirim) return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
  const id = nextId(data, "produksi_transfers" as any);
  const transfer = {
    id, po_id: Number(po_id),
    dari, ke,
    vendor_id: vendor_id ? Number(vendor_id) : null,
    jumlah_kirim: Number(jumlah_kirim),
    jumlah_diterima: null,
    sizeBreakdown: sizeBreakdown || [],
    sizeBreakdown_diterima: null,
    catatan: catatan || "",
    status: "Kirim",   // Kirim | Diterima | Diverifikasi
    tanggal_kirim: new Date().toISOString(),
    tanggal_terima: null
  };
  data.produksi_transfers.push(transfer);

  // Mark the incoming transfer to Gudang as forwarded so it disappears from the "Siap Dikirim" list
  if (transfer_id_asal) {
    const originIdx = data.produksi_transfers.findIndex((t: any) => String(t.id) === String(transfer_id_asal));
    if (originIdx !== -1) {
      data.produksi_transfers[originIdx].is_forwarded = true;
    }
  }

  // Sync to po_ledgers so Dashboard CMT reflects the physical balance
  if (!data.po_ledgers) data.po_ledgers = [];
  data.po_ledgers.push({
    id: nextId(data, "po_ledgers"),
    poId: Number(po_id),
    dari_vendor_id: "GUDANG",
    ke_vendor_id: String(vendor_id),
    jumlah: Number(jumlah_kirim),
    tanggal: transfer.tanggal_kirim,
    catatan: catatan || `Dikirim dari Gudang ke ${ke}`
  });

  // Sync barcode status if moving to washing, benang, finishing
  if (data.barcode_item) {
    let updated = 0;
    for (let i = 0; i < data.barcode_item.length && updated < Number(jumlah_kirim); i++) {
      const b = data.barcode_item[i];
      if (String(b.poId) === String(po_id) && ["gudang", "siap_jual"].includes(b.status)) {
        b.status = ke === "bersih_benang" ? "benang" : (ke === "qc" ? "finishing" : ke);
        updated++;
      }
    }
  }
  writeData(data);
  return NextResponse.json(transfer);
}

// PATCH: receive/verify a transfer
export async function PATCH(req: NextRequest) {
  const data = readData();
  if (!data.produksi_transfers) data.produksi_transfers = [];
  const body = await req.json();
  const { id, jumlah_diterima, sizeBreakdown_diterima, catatan_terima } = body;
  const idx = data.produksi_transfers.findIndex((t: any) => String(t.id) === String(id));
  if (idx === -1) return NextResponse.json({ error: "Transfer tidak ditemukan" }, { status: 404 });
  const t = data.produksi_transfers[idx];
  t.jumlah_diterima = Number(jumlah_diterima);
  t.sizeBreakdown_diterima = sizeBreakdown_diterima || t.sizeBreakdown;
  t.catatan_terima = catatan_terima || "";
  t.status = "Diverifikasi";
  t.tanggal_terima = new Date().toISOString();
  data.produksi_transfers[idx] = t;
  writeData(data);
  return NextResponse.json(t);
}
