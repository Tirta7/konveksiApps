export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { readData, writeData } from "@/lib/data-store";
import { lookupBarcodeForSale, sellByBarcodes, cancelBarcodeSale, cancelBarcodeLine, getBarangBarcodes } from "@/lib/barcode-sales";

// GET ?code=KODE        → cek 1 barcode (untuk keranjang scan)
// GET ?barang_id=ID     → semua pcs barang + ringkasan per size (Data Barang → Barcode)
// GET ?kanal=Retail...  → riwayat transaksi scan (opsional filter kanal)
export async function GET(req: NextRequest) {
  try {
    const data = readData();
    const sp = new URL(req.url).searchParams;
    const code = sp.get("code");
    if (code) return NextResponse.json(lookupBarcodeForSale(data, code));
    const barangId = sp.get("barang_id");
    if (barangId) return NextResponse.json(getBarangBarcodes(data, barangId));
    const kanal = sp.get("kanal");
    const list = ((data as any).penjualan_barcode || []).filter((s: any) => !kanal || s.kanal === kanal);
    return NextResponse.json(list);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST { codes:[], kanal, pelanggan?, catatan?, harga?:{kode:harga} } → simpan penjualan
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = readData();
    const kanal = String(body.kanal || "").trim();
    if (!kanal) return NextResponse.json({ error: "Kanal penjualan wajib diisi" }, { status: 400 });
    const sale = sellByBarcodes(data, body.codes || [], {
      kanal,
      pelanggan: body.pelanggan,
      catatan: body.catatan,
      harga: body.harga,
      order_id: body.order_id ? String(body.order_id).trim() : undefined,
      now: new Date().toISOString(),
    });
    writeData(data);
    return NextResponse.json({ success: true, sale });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, details: e.details || null }, { status: 400 });
  }
}

// DELETE ?id=ID → batalkan transaksi (pcs kembali tersedia, stok kembali)
// DELETE ?kode=KODE&alasan=... → batalkan SATU pcs saja (salah scan / kelebihan scan)
export async function DELETE(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const kode = sp.get("kode");
    const data = readData();
    if (kode) {
      const res = cancelBarcodeLine(data, kode, { alasan: sp.get("alasan") || "", now: new Date().toISOString() });
      writeData(data);
      return NextResponse.json({ success: true, ...res });
    }
    const id = sp.get("id");
    const sale = cancelBarcodeSale(data, id);
    writeData(data);
    return NextResponse.json({ success: true, sale });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
