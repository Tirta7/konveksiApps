/**
 * Pesanan & Retur Marketplace (Shopee / TikTok Shop / lainnya).
 *
 * - Pesanan diimpor dari CSV dashboard marketplace (satu baris = satu produk dalam satu Order ID).
 * - Saat dikemas, barcode per pcs di-scan dan ditautkan ke Order ID → jelas laku ke siapa, kapan, resi apa.
 * - Saat paket retur datang, barcode di-scan lagi:
 *     • SESUAI   → pcs kembali ke stok gudang (movement "masuk" sumber Retur Marketplace).
 *     • TIDAK SESUAI / rusak / tertukar → ditampung di daftar Banding Marketplace (tidak masuk stok)
 *       sampai dana dikembalikan marketplace.
 */
import { nextId } from "@/lib/data-store";
import { skuCode } from "@/lib/stock";

export const JENIS_MASALAH = [
  "Rusak / Cacat",
  "Barang tertukar / bukan milik kita",
  "Bekas pakai / kotor / bau",
  "Tidak lengkap / kurang",
  "Paket kosong",
  "Lainnya",
];

export const STATUS_BANDING = ["Perlu Diajukan", "Diajukan Banding", "Banding Disetujui", "Banding Ditolak"] as const;

const ymdLocal = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
};
const num = (v: any) => Number(String(v ?? "0").replace(/[^\d.-]/g, "")) || 0;

/** Kelompokkan baris CSV pesanan per Order ID + lampirkan hasil scan & retur. */
export function groupOrders(data: any) {
  const map: Record<string, any> = {};
  for (const r of data.penjualan_online || []) {
    const oid = String(r.order_id || "").trim();
    if (!oid) continue;
    const o = (map[oid] ||= {
      order_id: oid,
      marketplace: r.marketplace || (/^\d{15,}$/.test(oid) ? "TikTok Shop" : /^\d{6}[A-Z0-9]{6,}$/i.test(oid) ? "Shopee" : "Marketplace"),
      status: r.status,
      tanggal_pesanan: r.tanggal_pesanan,
      tanggal_diimpor: r.tanggal_diimpor || r.tanggal,
      buyer_username: r.buyer_username,
      recipient: r.recipient,
      phone: r.phone,
      address: r.address,
      city: r.city,
      province: r.province,
      tracking_id: r.tracking_id,
      shipping_provider: r.shipping_provider,
      payment_method: r.payment_method,
      tipe_pesanan: r.tipe_pesanan,
      items: [],
      total_qty: 0,
      total_amount: 0,
    });
    o.items.push({ id: r.id, product_name: r.product_name, variation: r.variation, seller_sku: r.seller_sku, quantity: Number(r.quantity || 1), order_amount: num(r.order_amount) });
    o.total_qty += Number(r.quantity || 1);
    // TikTok: "Order Amount" = nilai SELURUH pesanan (diulang di tiap baris produk) → ambil sekali.
    // Shopee/lainnya: nilai per baris produk → dijumlah.
    if (/tiktok/i.test(String(o.marketplace))) o.total_amount = Math.max(o.total_amount, num(r.order_amount));
    else o.total_amount += num(r.order_amount);
  }
  const sales = (data.penjualan_barcode || []).filter((s: any) => s.order_id);
  const returs = data.retur_marketplace || [];
  for (const o of Object.values(map)) {
    const mySales = sales.filter((s: any) => String(s.order_id) === o.order_id);
    o.scans = mySales.map((s: any) => ({ penjualan_id: s.id, no_transaksi: s.no_transaksi, tanggal: s.tanggal, items: s.items }));
    o.barcodes = mySales.flatMap((s: any) => s.items.map((i: any) => {
      const b = (data.barcode_item || []).find((x: any) => String(x.kodeBarcode).toUpperCase() === String(i.kode).toUpperCase());
      const ret = returs.find((r: any) => r.kode_barcode === i.kode && String(r.penjualan_id) === String(s.id));
      return { kode: i.kode, nama_barang: i.nama_barang, size: i.size, harga: i.harga, noPo: i.noPo, status: ret ? (ret.kondisi === "sesuai" ? "retur_stok" : "retur_banding") : b?.status || "terjual", no_retur: ret?.no_retur || null, penjualan_id: s.id, no_transaksi: s.no_transaksi, tanggal_kirim: s.tanggal };
    }));
    o.scanned_qty = o.barcodes.length;
    o.returs = returs.filter((r: any) => String(r.order_id) === o.order_id);
    o.status_kemas = o.scanned_qty === 0 ? "Belum Discan" : o.scanned_qty < o.total_qty ? "Sebagian Discan" : o.scanned_qty > o.total_qty ? "Kelebihan Scan" : "Sudah Discan";
    // pengajuan retur dari CSV retur marketplace (jika sudah diimpor di menu Retur)
    o.retur_request = (data.retur_online || []).filter((r: any) => String(r.order_id) === o.order_id).map((r: any) => ({ alasan: r.alasan, return_type: r.return_type, tanggal: r.tanggal_batal, qty: r.return_quantity, resi_retur: r.tracking_id }));
  }
  return map;
}

export function getOrder(data: any, orderId: string) {
  return groupOrders(data)[String(orderId || "").trim()] || null;
}

/** Info lengkap satu barcode untuk proses retur. */
export function lookupRetur(data: any, code: string) {
  const kode = String(code || "").trim().toUpperCase();
  const b = (data.barcode_item || []).find((x: any) => String(x.kodeBarcode).toUpperCase() === kode);
  if (!b) return { ok: false, kode, error: "Barcode tidak dikenal — kemungkinan barang BUKAN milik kita (tertukar). Gunakan \"Retur tanpa barcode\" lewat Order ID." };
  const barang = (data.data_barang || []).find((x: any) => String(x.id) === String(b.barang_id));
  const base = { kode, size: b.size, barang_id: b.barang_id, nama_barang: barang?.nama_barang || "-", status: b.status };
  if (b.status === "retur_banding") {
    const r = (data.retur_marketplace || []).find((x: any) => x.kode_barcode === kode && x.status !== "Dipindah ke Stok");
    return { ok: false, kode, error: `Pcs ini sudah tercatat retur TIDAK SESUAI (${r?.no_retur || "-"}) dan sedang dalam proses banding.` };
  }
  if (b.status !== "terjual") return { ok: false, kode, error: b.status === "siap_jual" ? "Pcs ini masih tercatat di stok (belum pernah terjual / sudah diretur sebelumnya)." : `Pcs ini berstatus "${b.status}", bukan barang terjual.` };
  const sale = (data.penjualan_barcode || []).find((s: any) => String(s.id) === String(b.penjualan_id));
  const order = b.order_id ? getOrder(data, b.order_id) : null;
  return {
    ok: true,
    ...base,
    harga: sale?.items?.find((i: any) => i.kode === kode)?.harga ?? Number(barang?.harga_jual || 0),
    penjualan: sale ? { id: sale.id, no_transaksi: sale.no_transaksi, tanggal: sale.tanggal, kanal: sale.kanal, pelanggan: sale.pelanggan } : null,
    order_id: b.order_id || null,
    order: order ? { order_id: order.order_id, marketplace: order.marketplace, recipient: order.recipient, buyer_username: order.buyer_username, phone: order.phone, address: order.address, city: order.city, province: order.province, tracking_id: order.tracking_id, shipping_provider: order.shipping_provider, tanggal_pesanan: order.tanggal_pesanan, items: order.items, retur_request: order.retur_request } : null,
  };
}

/** Proses retur 1 pcs (dengan barcode) atau retur tanpa barcode (barang tertukar / paket kosong). */
export function processRetur(data: any, p: {
  kode?: string | null;
  order_id?: string | null;
  kondisi: "sesuai" | "tidak_sesuai";
  jenis_masalah?: string;
  catatan?: string;
  nilai_klaim?: number;
  resi_retur?: string;
  marketplace?: string;
  now: string;
}) {
  if (!data.retur_marketplace) data.retur_marketplace = [];
  if (!data.stock_movements) data.stock_movements = [];
  const id = nextId(data, "retur_marketplace" as any);
  const no_retur = `RTR-${ymdLocal(p.now)}-${String(id).padStart(4, "0")}`;

  let info: any = null;
  let b: any = null;
  if (p.kode) {
    info = lookupRetur(data, p.kode);
    if (!info.ok) throw new Error(info.error);
    b = data.barcode_item.find((x: any) => String(x.kodeBarcode).toUpperCase() === info.kode);
  } else {
    if (p.kondisi === "sesuai") throw new Error("Retur SESUAI wajib scan barcode pcs agar stok bisa dikembalikan dengan tepat.");
    if (!p.order_id) throw new Error("Retur tanpa barcode wajib mengisi Order ID pesanan.");
  }
  const orderId = p.order_id || info?.order_id || null;
  const order = orderId ? getOrder(data, orderId) : null;
  const barang = info ? (data.data_barang || []).find((x: any) => String(x.id) === String(info.barang_id)) : null;

  const rec: any = {
    id,
    no_retur,
    tanggal: p.now,
    order_id: orderId,
    marketplace: p.marketplace || order?.marketplace || (info?.penjualan?.kanal ?? "Marketplace"),
    pembeli: order ? { recipient: order.recipient, buyer_username: order.buyer_username, phone: order.phone, kota: [order.city, order.province].filter(Boolean).join(", "), tracking_id: order.tracking_id } : info?.penjualan?.pelanggan ? { recipient: info.penjualan.pelanggan } : null,
    resi_retur: p.resi_retur || "",
    kode_barcode: info?.kode || null,
    barang_id: info?.barang_id ?? null,
    nama_barang: info?.nama_barang || (order?.items?.map((i: any) => i.product_name).join(", ") ?? "-"),
    size: info?.size || null,
    harga_jual: info?.harga ?? 0,
    penjualan_id: info?.penjualan?.id ?? null,
    no_transaksi: info?.penjualan?.no_transaksi ?? null,
    tanggal_jual: info?.penjualan?.tanggal ?? null,
    kondisi: p.kondisi,
    jenis_masalah: p.kondisi === "sesuai" ? null : p.jenis_masalah || "Lainnya",
    catatan: p.catatan || "",
    nilai_klaim: p.kondisi === "sesuai" ? 0 : Number(p.nilai_klaim ?? info?.harga ?? 0),
    dana_diterima: 0,
    status: p.kondisi === "sesuai" ? "Kembali ke Stok" : "Perlu Diajukan",
    movement_id: null as number | null,
    riwayat: [{ tanggal: p.now, status: p.kondisi === "sesuai" ? "Kembali ke Stok" : "Perlu Diajukan", catatan: p.kondisi === "sesuai" ? "Barang sesuai & layak jual, dikembalikan ke stok" : `Barang tidak sesuai: ${p.jenis_masalah || "Lainnya"}` }],
  };

  if (b) {
    if (p.kondisi === "sesuai") {
      rec.movement_id = pushReturMasuk(data, barang, b, no_retur, orderId, p.now);
      b.status = "siap_jual";
    } else {
      b.status = "retur_banding";
    }
    b.retur_at = p.now;
    b.no_retur = no_retur;
    (b.riwayat_jual ||= []).push({ penjualan_id: b.penjualan_id, no_transaksi: b.no_transaksi, kanal: b.terjual_kanal, terjual_at: b.terjual_at, order_id: b.order_id || null, no_retur, kondisi: p.kondisi });
    delete b.terjual_at; delete b.terjual_kanal; delete b.penjualan_id; delete b.no_transaksi; delete b.keluarAt; delete b.order_id;
  }
  data.retur_marketplace.unshift(rec);
  return rec;
}

function pushReturMasuk(data: any, barang: any, b: any, noRetur: string, orderId: string | null, now: string) {
  const kat = (data.kategori_produk || []).find((k: any) => String(k.id) === String(barang?.kategori_id))?.nama;
  const mid = nextId(data, "stock_movements");
  data.stock_movements.push({
    id: mid,
    tanggal: now,
    jenis: "masuk",
    barang_id: barang?.id ?? b.barang_id,
    kode: barang?.kode,
    nama_barang: barang?.nama_barang,
    kategori: kat || barang?.nama_barang,
    items: [{ size: b.size, jumlah: 1, sku: barang?.kode ? skuCode(barang.kode, b.size) : undefined }],
    jumlah: 1,
    sumber: "Retur Marketplace",
    keterangan: `${noRetur}${orderId ? ` · Order ${orderId}` : ""} · ${b.kodeBarcode}`,
    asal_po_id: b.poId, // sengaja bukan po_id agar tidak menambah hitungan hasil produksi PO
    no_retur: noRetur,
    barcodes: [b.kodeBarcode],
  });
  return mid;
}

/** Update status banding / dana diterima. */
export function updateBanding(data: any, id: any, p: { status?: string; dana_diterima?: number; catatan?: string; nilai_klaim?: number; now: string }) {
  const r = (data.retur_marketplace || []).find((x: any) => String(x.id) === String(id));
  if (!r) throw new Error("Data retur tidak ditemukan");
  if (r.kondisi === "sesuai") throw new Error("Retur sesuai sudah kembali ke stok, tidak perlu banding");
  if (p.status && !STATUS_BANDING.includes(p.status as any)) throw new Error("Status banding tidak valid");
  if (p.nilai_klaim != null) r.nilai_klaim = Number(p.nilai_klaim) || 0;
  if (p.dana_diterima != null) r.dana_diterima = Number(p.dana_diterima) || 0;
  if (p.status && p.status !== r.status) r.status = p.status;
  r.riwayat.push({ tanggal: p.now, status: r.status, catatan: p.catatan || (p.dana_diterima != null ? `Dana diterima Rp ${Number(p.dana_diterima).toLocaleString("id-ID")}` : "Update") });
  return r;
}

/** Barang retur tidak sesuai yang ternyata masih layak (mis. setelah diperbaiki) → masukkan ke stok. */
export function moveReturToStock(data: any, id: any, now: string, catatan?: string) {
  const r = (data.retur_marketplace || []).find((x: any) => String(x.id) === String(id));
  if (!r) throw new Error("Data retur tidak ditemukan");
  if (!r.kode_barcode) throw new Error("Retur tanpa barcode tidak bisa dimasukkan ke stok");
  if (r.status === "Kembali ke Stok" || r.status === "Dipindah ke Stok") throw new Error("Sudah masuk stok");
  const b = data.barcode_item.find((x: any) => x.kodeBarcode === r.kode_barcode);
  if (!b || b.status !== "retur_banding") throw new Error("Status pcs tidak sesuai untuk dipindah ke stok");
  const barang = (data.data_barang || []).find((x: any) => String(x.id) === String(b.barang_id));
  r.movement_id = pushReturMasuk(data, barang, b, r.no_retur, r.order_id, now);
  b.status = "siap_jual";
  r.status = "Dipindah ke Stok";
  r.riwayat.push({ tanggal: now, status: r.status, catatan: catatan || "Barang layak jual, dipindahkan ke stok" });
  return r;
}

/** Hapus data retur (salah input) → kembalikan pcs ke status terjual seperti semula. */
export function deleteRetur(data: any, id: any) {
  const list = data.retur_marketplace || [];
  const idx = list.findIndex((x: any) => String(x.id) === String(id));
  if (idx === -1) throw new Error("Data retur tidak ditemukan");
  const r = list[idx];
  if (r.kode_barcode) {
    const b = data.barcode_item.find((x: any) => x.kodeBarcode === r.kode_barcode);
    if (b && (b.status === "terjual" || b.no_retur !== r.no_retur)) throw new Error("Pcs ini sudah dijual ulang / diproses lagi, data retur tidak bisa dihapus");
    if (b && (b.status === "siap_jual" || b.status === "retur_banding")) {
      const last = (b.riwayat_jual || []).filter((h: any) => h.no_retur === r.no_retur).pop();
      b.status = "terjual";
      if (last) {
        b.penjualan_id = last.penjualan_id; b.no_transaksi = last.no_transaksi; b.terjual_kanal = last.kanal; b.terjual_at = last.terjual_at; b.keluarAt = last.terjual_at;
        if (last.order_id) b.order_id = last.order_id;
        b.riwayat_jual = b.riwayat_jual.filter((h: any) => h !== last);
      }
      delete b.retur_at; delete b.no_retur;
    }
    if (r.movement_id != null) data.stock_movements = (data.stock_movements || []).filter((m: any) => String(m.id) !== String(r.movement_id));
  }
  list.splice(idx, 1);
  return r;
}
