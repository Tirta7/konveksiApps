export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { readData } from "@/lib/data-store";

/**
 * Laporan Penjualan per Kategori (tab "Produk" di /laporan).
 * Sumber: penjualan scan barcode (penjualan_barcode) — pcs yang benar-benar keluar dari stok.
 *  - total_po     : kanal "Penjualan Online" (marketplace)
 *  - total_retail : kanal offline (Retail Offline / Penjualan Grosir) + catatan retail lama
 * Pcs yang sudah diretur & kembali ke stok (status barcode bukan "terjual") tidak dihitung.
 * ?periode=minggu (7 hari) | bulan (30 hari) | semua
 */
export async function GET(req: Request) {
  try {
    const data: any = readData();
    const periode = new URL(req.url).searchParams.get("periode") || "minggu";
    const days = periode === "bulan" ? 30 : periode === "semua" ? 0 : 7;
    const since = days > 0 ? Date.now() - days * 24 * 60 * 60 * 1000 : 0;

    const kategoriById = new Map<string, string>((data.kategori_produk || []).map((k: any) => [String(k.id), k.nama]));
    const barangById = new Map<string, any>((data.data_barang || []).map((b: any) => [String(b.id), b]));
    const poById = new Map<string, any>((data.po_produksi || []).map((p: any) => [String(p.id), p]));
    const barcodeStatus = new Map<string, string>((data.barcode_item || []).map((b: any) => [String(b.kodeBarcode), b.status]));

    const kategoriOf = (it: any): string => {
      const b = barangById.get(String(it.barang_id));
      if (b?.kategori_id != null && kategoriById.has(String(b.kategori_id))) return kategoriById.get(String(b.kategori_id))!;
      const po = poById.get(String(it.po_id));
      return po?.model || b?.nama_barang || it.nama_barang || "Tanpa Kategori";
    };

    const rows: Record<string, { kategori: string; total_po: number; total_retail: number; total: number; omzet: number }> = {};
    const add = (kategori: string, online: boolean, qty: number, omzet: number) => {
      const r = (rows[kategori] ||= { kategori, total_po: 0, total_retail: 0, total: 0, omzet: 0 });
      if (online) r.total_po += qty; else r.total_retail += qty;
      r.total += qty;
      r.omzet += omzet;
    };

    for (const pj of (data.penjualan_barcode || [])) {
      if (since && new Date(pj.tanggal || 0).getTime() < since) continue;
      const online = /online/i.test(String(pj.kanal || ""));
      for (const it of (pj.items || [])) {
        const st = barcodeStatus.get(String(it.kode));
        if (st && st !== "terjual") continue; // sudah diretur / dibatalkan
        add(kategoriOf(it), online, 1, Number(it.harga || 0));
      }
    }

    // Catatan retail lama (tanpa scan barcode)
    for (const r of (data.retail_sales || [])) {
      if (since && new Date(r.tanggal || 0).getTime() < since) continue;
      const qty = Number(r.jumlah || 0);
      if (qty > 0) add(r.kategori || r.model || r.nama_barang || "Tanpa Kategori", false, qty, Number(r.total || r.harga || 0) * (r.total ? 1 : qty));
    }

    return NextResponse.json(Object.values(rows).sort((a, b) => b.total - a.total));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
