/**
 * Penjualan berbasis barcode per pcs (barcode produksi, contoh SJ-02-XXL-001).
 *
 * Alur:
 *  1. Saat barang masuk Gudang & Stok, barcode produksi ditautkan ke barang jadi (barang_id + SKU) dan
 *     berstatus "siap_jual". Hanya pcs yang SUDAH masuk stok yang bisa dicetak labelnya dari Data Barang.
 *  2. Kasir / admin scan barcode di Retail Offline, Penjualan Grosir, atau Penjualan Online.
 *  3. Setiap pcs yang di-scan berubah status "terjual" (tercatat kanal, waktu, no transaksi) dan
 *     stok Data Barang berkurang lewat movement "keluar" di ledger Gudang & Stok.
 */
import { nextId } from "@/lib/data-store";
import { skuCode, type SizeQty } from "@/lib/stock";

const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "27", "28", "29", "30", "31", "32", "33", "34", "35", "36", "38", "40"];
const sizeRank = (s: string) => {
  const i = SIZE_ORDER.indexOf(String(s).toUpperCase());
  return i === -1 ? 99 : i;
};

export type ScanLookup =
  | { ok: true; kode: string; size: string; barang_id: number; nama_barang: string; sku: string; harga_jual: number; po_id: any; noPo: string }
  | { ok: false; kode: string; error: string };

/** Cek satu barcode: apakah bisa dijual sekarang. */
export function lookupBarcodeForSale(data: any, code: string): ScanLookup {
  const kode = String(code || "").trim().toUpperCase();
  if (!kode) return { ok: false, kode, error: "Kode kosong" };
  const b = (data.barcode_item || []).find((x: any) => String(x.kodeBarcode).toUpperCase() === kode);
  if (!b) {
    const isSku = (data.data_barang || []).some((x: any) => x.kode && kode.startsWith(String(x.kode).toUpperCase()));
    return { ok: false, kode, error: isSku ? "Ini kode SKU, bukan barcode per pcs. Scan barcode pada hangtag (contoh SJ-02-XL-001)." : "Barcode tidak dikenal" };
  }
  if (b.status === "terjual") return { ok: false, kode, error: `Sudah terjual${b.terjual_kanal ? ` (${b.terjual_kanal}` : ""}${b.terjual_at ? `, ${new Date(b.terjual_at).toLocaleDateString("id-ID")})` : b.terjual_kanal ? ")" : ""}` };
  if (b.status === "reject") return { ok: false, kode, error: "Pcs ini berstatus REJECT, tidak boleh dijual" };
  if (b.status !== "siap_jual" || b.barang_id == null) return { ok: false, kode, error: "Pcs ini belum masuk Gudang & Stok (masih dalam proses produksi)" };
  const barang = (data.data_barang || []).find((x: any) => String(x.id) === String(b.barang_id));
  if (!barang) return { ok: false, kode, error: "Barang jadi untuk barcode ini tidak ditemukan" };
  const po = (data.po_produksi || []).find((p: any) => String(p.id) === String(b.poId));
  return {
    ok: true,
    kode,
    size: b.size,
    barang_id: barang.id,
    nama_barang: barang.nama_barang,
    sku: b.sku || (barang.kode ? skuCode(barang.kode, b.size) : ""),
    harga_jual: Number(barang.harga_jual || 0),
    po_id: b.poId,
    noPo: po?.noPo || `PO #${b.poId}`,
  };
}

/** Jual sekumpulan barcode: tandai terjual + kurangi stok (movement keluar per barang). */
export function sellByBarcodes(data: any, codes: string[], meta: { kanal: string; pelanggan?: string; catatan?: string; harga?: Record<string, number>; now: string; order_id?: string }) {
  const unique = Array.from(new Set((codes || []).map((c) => String(c).trim().toUpperCase()).filter(Boolean)));
  if (unique.length === 0) throw new Error("Belum ada barcode yang di-scan");

  const found: Extract<ScanLookup, { ok: true }>[] = [];
  const errors: string[] = [];
  for (const c of unique) {
    const r = lookupBarcodeForSale(data, c);
    if (r.ok) found.push(r);
    else errors.push(`${c}: ${r.error}`);
  }
  if (errors.length) {
    const err: any = new Error(errors.join("\n"));
    err.details = errors;
    throw err;
  }

  if (!data.penjualan_barcode) data.penjualan_barcode = [];
  if (!data.stock_movements) data.stock_movements = [];
  const saleId = nextId(data, "penjualan_barcode" as any);
  const dt = new Date(meta.now);
  const ymd = `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, "0")}${String(dt.getDate()).padStart(2, "0")}`;
  const noTrx = `JUAL-${ymd}-${String(saleId).padStart(4, "0")}`;

  // Kelompokkan per barang → per size
  const byBarang: Record<string, typeof found> = {};
  for (const f of found) (byBarang[String(f.barang_id)] ||= []).push(f);

  const movementIds: number[] = [];
  const lines: any[] = [];
  for (const [bid, list] of Object.entries(byBarang)) {
    const barang = (data.data_barang || []).find((x: any) => String(x.id) === bid);
    const kat = (data.kategori_produk || []).find((k: any) => String(k.id) === String(barang?.kategori_id))?.nama;
    const perSize: Record<string, number> = {};
    for (const f of list) perSize[f.size] = (perSize[f.size] || 0) + 1;
    const items: (SizeQty & { sku?: string })[] = Object.entries(perSize)
      .sort((a, b) => sizeRank(a[0]) - sizeRank(b[0]))
      .map(([size, jumlah]) => ({ size, jumlah, sku: barang?.kode ? skuCode(barang.kode, size) : undefined }));
    const mid = nextId(data, "stock_movements");
    movementIds.push(mid);
    data.stock_movements.push({
      id: mid,
      tanggal: meta.now,
      jenis: "keluar",
      barang_id: barang?.id,
      kode: barang?.kode,
      nama_barang: barang?.nama_barang,
      kategori: kat || list[0].nama_barang,
      items,
      jumlah: list.length,
      sumber: meta.kanal,
      keterangan: `${noTrx}${meta.order_id ? ` · Order ${meta.order_id}` : ""}${meta.pelanggan ? ` · ${meta.pelanggan}` : ""}${meta.catatan ? ` · ${meta.catatan}` : ""}`,
      penjualan_id: saleId,
      no_transaksi: noTrx,
      order_id: meta.order_id || null,
      barcodes: list.map((f) => f.kode),
    });
    for (const f of list) {
      const harga = meta.harga?.[f.kode] ?? f.harga_jual;
      lines.push({ kode: f.kode, barang_id: f.barang_id, nama_barang: f.nama_barang, size: f.size, sku: f.sku, harga, po_id: f.po_id, noPo: f.noPo });
    }
  }

  // Tandai pcs terjual
  const codeSet = new Set(found.map((f) => f.kode));
  for (const b of data.barcode_item || []) {
    if (codeSet.has(String(b.kodeBarcode).toUpperCase())) {
      b.status = "terjual";
      b.terjual_at = meta.now;
      b.terjual_kanal = meta.kanal;
      b.penjualan_id = saleId;
      b.no_transaksi = noTrx;
      b.keluarAt = meta.now;
      if (meta.order_id) b.order_id = meta.order_id; else delete b.order_id;
    }
  }

  const total = lines.reduce((s, l) => s + Number(l.harga || 0), 0);
  const sale = {
    id: saleId,
    no_transaksi: noTrx,
    tanggal: meta.now,
    kanal: meta.kanal,
    order_id: meta.order_id || null,
    pelanggan: meta.pelanggan || "",
    catatan: meta.catatan || "",
    jumlah: lines.length,
    total,
    items: lines,
    movement_ids: movementIds,
  };
  data.penjualan_barcode.unshift(sale);
  return sale;
}

/** Batalkan transaksi scan: pcs kembali siap_jual & stok kembali. */
export function cancelBarcodeSale(data: any, saleId: any) {
  const list = data.penjualan_barcode || [];
  const idx = list.findIndex((s: any) => String(s.id) === String(saleId));
  if (idx === -1) throw new Error("Transaksi tidak ditemukan");
  const sale = list[idx];
  const sudahRetur = (data.retur_marketplace || []).filter((r: any) => String(r.penjualan_id) === String(sale.id));
  if (sudahRetur.length) throw new Error(`Transaksi ini sudah memiliki ${sudahRetur.length} data retur (${sudahRetur.map((r: any) => r.no_retur).join(", ")}). Hapus data retur terlebih dahulu.`);
  const mids = new Set((sale.movement_ids || []).map(String));
  data.stock_movements = (data.stock_movements || []).filter((m: any) => !mids.has(String(m.id)));
  const codes = new Set((sale.items || []).map((i: any) => String(i.kode).toUpperCase()));
  for (const b of data.barcode_item || []) {
    if (codes.has(String(b.kodeBarcode).toUpperCase()) && String(b.penjualan_id) === String(sale.id)) {
      b.status = "siap_jual";
      delete b.terjual_at; delete b.terjual_kanal; delete b.penjualan_id; delete b.no_transaksi; delete b.keluarAt; delete b.order_id;
    }
  }
  list.splice(idx, 1);
  return sale;
}

/**
 * Batalkan SATU pcs dari transaksi scan (salah scan / kelebihan scan).
 * Pcs kembali "siap_jual", stok kembali (movement keluar dikurangi), transaksi dihitung ulang.
 * Jika transaksi jadi kosong, transaksi ikut dihapus. Dicatat di `pembatalan_scan`.
 */
export function cancelBarcodeLine(data: any, code: string, meta: { alasan?: string; now: string }) {
  const kode = String(code || "").trim().toUpperCase();
  const b = (data.barcode_item || []).find((x: any) => String(x.kodeBarcode).toUpperCase() === kode);
  if (!b) throw new Error("Barcode tidak dikenal");
  if (b.status !== "terjual" || b.penjualan_id == null) throw new Error(`Pcs ini tidak berstatus terjual (status: ${b.status})`);
  const list = data.penjualan_barcode || [];
  const sIdx = list.findIndex((s: any) => String(s.id) === String(b.penjualan_id));
  if (sIdx === -1) throw new Error("Transaksi penjualan untuk pcs ini tidak ditemukan");
  const sale = list[sIdx];
  const ret = (data.retur_marketplace || []).find((r: any) => String(r.kode_barcode).toUpperCase() === kode && String(r.penjualan_id) === String(sale.id));
  if (ret) throw new Error(`Pcs ini sudah diproses retur (${ret.no_retur}). Gunakan menu Retur, bukan pembatalan scan.`);

  const line = (sale.items || []).find((i: any) => String(i.kode).toUpperCase() === kode);
  sale.items = (sale.items || []).filter((i: any) => String(i.kode).toUpperCase() !== kode);

  // Kurangi movement keluar yang memuat barcode ini
  const mids = new Set((sale.movement_ids || []).map(String));
  const mv = (data.stock_movements || []).find((m: any) =>
    mids.has(String(m.id)) && (m.barcodes || []).some((c: string) => String(c).toUpperCase() === kode));
  if (mv) {
    mv.barcodes = (mv.barcodes || []).filter((c: string) => String(c).toUpperCase() !== kode);
    mv.items = (mv.items || [])
      .map((it: any) => (it.size === b.size ? { ...it, jumlah: Number(it.jumlah || 0) - 1 } : it))
      .filter((it: any) => Number(it.jumlah || 0) > 0);
    mv.jumlah = Math.max(0, Number(mv.jumlah || 0) - 1);
    if (mv.jumlah <= 0) {
      data.stock_movements = data.stock_movements.filter((m: any) => m !== mv);
      sale.movement_ids = (sale.movement_ids || []).filter((id: any) => String(id) !== String(mv.id));
    }
  }

  // Pcs kembali ke stok
  b.status = "siap_jual";
  delete b.terjual_at; delete b.terjual_kanal; delete b.penjualan_id; delete b.no_transaksi; delete b.keluarAt; delete b.order_id;

  sale.jumlah = sale.items.length;
  sale.total = sale.items.reduce((s: number, l: any) => s + Number(l.harga || 0), 0);
  const saleDeleted = sale.items.length === 0;
  if (saleDeleted) list.splice(sIdx, 1);

  if (!data.pembatalan_scan) data.pembatalan_scan = [];
  data.pembatalan_scan.unshift({
    id: nextId(data, "pembatalan_scan" as any),
    tanggal: meta.now,
    kode,
    size: b.size,
    nama_barang: line?.nama_barang || null,
    harga: line?.harga ?? null,
    penjualan_id: sale.id,
    no_transaksi: sale.no_transaksi,
    kanal: sale.kanal,
    order_id: sale.order_id || null,
    alasan: meta.alasan || "",
    transaksi_dihapus: saleDeleted,
  });
  return { kode, sale, saleDeleted };
}

/** Semua pcs (barcode) milik satu barang jadi + ringkasan per size. */
export function getBarangBarcodes(data: any, barangId: any) {
  const pcs = (data.barcode_item || [])
    .filter((b: any) => String(b.barang_id) === String(barangId) && ["siap_jual", "terjual"].includes(b.status))
    .map((b: any) => {
      const po = (data.po_produksi || []).find((p: any) => String(p.id) === String(b.poId));
      return {
        kode: b.kodeBarcode,
        size: b.size,
        sku: b.sku || null,
        status: b.status,
        po_id: b.poId,
        noPo: po?.noPo || `PO #${b.poId}`,
        masuk_at: b.stockAt || null,
        terjual_at: b.terjual_at || b.keluarAt || null,
        terjual_kanal: b.terjual_kanal || null,
        no_transaksi: b.no_transaksi || null,
      };
    })
    .sort((a: any, b: any) => sizeRank(a.size) - sizeRank(b.size) || String(a.kode).localeCompare(String(b.kode)));

  const sizes: Record<string, { size: string; total: number; tersedia: number; terjual: number }> = {};
  for (const p of pcs) {
    const s = (sizes[p.size] ||= { size: p.size, total: 0, tersedia: 0, terjual: 0 });
    s.total++;
    if (p.status === "terjual") s.terjual++;
    else s.tersedia++;
  }
  return {
    pcs,
    sizes: Object.values(sizes).sort((a, b) => sizeRank(a.size) - sizeRank(b.size)),
    total: pcs.length,
    tersedia: pcs.filter((p: any) => p.status === "siap_jual").length,
    terjual: pcs.filter((p: any) => p.status === "terjual").length,
  };
}
