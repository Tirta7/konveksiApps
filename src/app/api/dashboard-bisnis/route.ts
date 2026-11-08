import { NextRequest, NextResponse } from "next/server";
import { readData } from "@/lib/data-store";
import { groupOrders } from "@/lib/marketplace";

export const dynamic = "force-dynamic";

/**
 * Ringkasan Bisnis & Keuangan untuk Dashboard Owner.
 *
 * GET ?range=7|30|90|365|mtd|ytd|all  (default 30)
 *
 * Sumber data (semua dari data-store yang sama dengan modul lain):
 *  - Pendapatan  : penjualan_online (per Order ID, non-batal) + penjualan_barcode non-online (Grosir / Retail)
 *  - Piutang     : pesanan marketplace yang belum cair (belum ada settlement) + saldo piutang pelanggan grosir
 *  - Hutang      : hutang supplier (pembelian kain tempo) + sisa hak upah vendor (pcs ACC × tarif − dibayar)
 *  - Pengeluaran : pembelian bahan (purchase_orders), upah vendor dibayar (gaji_cmt), potongan marketplace (settlement_online)
 */

const num = (v: any) => {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return isFinite(n) ? n : 0;
};

function parseDate(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const s = String(v).trim();
  if (!s || s === "-") return null;
  const m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (m) {
    const [, d, mo, y, hh = "0", mm = "0", ss = "0"] = m;
    const dt = new Date(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mm), Number(ss));
    return isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

const SIZE_RE = /^(XXXL|XXL|XL|L|M|S|XS|3XL|4XL|5XL|ALLSIZE|ALL SIZE|\d{2})$/i;

function extractSize(sku: string, variation: string): string {
  const tokens = String(sku || "").trim().split(/\s+/);
  const last = tokens[tokens.length - 1] || "";
  if (SIZE_RE.test(last)) return last.toUpperCase();
  // Variasi marketplace: "RETRO FOLD, L BB 49 - 54 KG"
  const parts = String(variation || "").split(",");
  const afterComma = (parts[1] || parts[0] || "").trim().split(/\s+/)[0] || "";
  if (SIZE_RE.test(afterComma)) return afterComma.toUpperCase();
  return "Lainnya";
}

function modelFromSku(sku: string): string {
  const tokens = String(sku || "").trim().split(/\s+/).filter(Boolean);
  if (tokens.length > 1 && SIZE_RE.test(tokens[tokens.length - 1])) tokens.pop();
  return tokens.join(" ").toUpperCase() || "TANPA SKU";
}

function isBatal(r: any) {
  const s = String(r?.status || "").toLowerCase();
  return Boolean(r?.dibatalkan || s.includes("batal") || s.includes("cancel"));
}

export async function GET(req: NextRequest) {
  try {
    const data: any = readData();
    const rangeParam = (new URL(req.url).searchParams.get("range") || "30").toLowerCase();

    const now = new Date();
    const today = startOfDay(now);
    const end = new Date(today.getTime() + 86400000 - 1);

    // ── Kumpulkan semua pesanan online (per Order ID) ──
    const rawOnline: any[] = data.penjualan_online || [];
    const batalIds = new Set<string>();
    for (const r of rawOnline) if (isBatal(r)) batalIds.add(String(r.order_id || "").trim());

    const grouped = Object.values(groupOrders(data)) as any[];
    const onlineOrders = grouped
      .filter((o) => (o.items || []).length > 0)
      .map((o) => ({
        ...o,
        _date: parseDate(o.tanggal_pesanan) || parseDate(o.tanggal_diimpor),
        _batal: batalIds.has(String(o.order_id)) || isBatal(o),
        _retur: /retur|return/i.test(String(o.status || "")),
      }));

    const offlineSales: any[] = (data.penjualan_barcode || [])
      .filter((p: any) => !/online/i.test(String(p.kanal || "")))
      .map((p: any) => ({ ...p, _date: parseDate(p.tanggal) }));

    // ── Tentukan rentang tanggal ──
    let start: Date;
    let label: string;
    if (rangeParam === "all") {
      const dates = [
        ...onlineOrders.map((o) => o._date),
        ...offlineSales.map((s) => s._date),
        ...(data.purchase_orders || []).map((p: any) => parseDate(p.tanggal || p.createdAt)),
      ].filter(Boolean) as Date[];
      start = dates.length ? startOfDay(new Date(Math.min(...dates.map((d) => d.getTime())))) : new Date(today.getTime() - 29 * 86400000);
      label = "Semua Waktu";
    } else if (rangeParam === "mtd") {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      label = "Bulan Ini";
    } else if (rangeParam === "ytd") {
      start = new Date(today.getFullYear(), 0, 1);
      label = "Tahun Ini";
    } else {
      const days = Math.max(1, Math.min(3650, Number(rangeParam) || 30));
      start = new Date(today.getTime() - (days - 1) * 86400000);
      label = days === 1 ? "Hari Ini" : `${days} Hari Terakhir`;
    }
    const spanMs = end.getTime() - start.getTime() + 1;
    const prevStart = new Date(start.getTime() - spanMs);
    const prevEnd = new Date(start.getTime() - 1);

    const inRange = (d: Date | null, s = start, e = end) => !!d && d >= s && d <= e;

    // ── Bucket tren ──
    const spanDays = Math.round(spanMs / 86400000);
    const granularity: "day" | "week" | "month" = spanDays <= 35 ? "day" : spanDays <= 120 ? "week" : "month";
    const bucketKey = (d: Date) => {
      if (granularity === "day") return ymd(d);
      if (granularity === "month") return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const offset = Math.floor((startOfDay(d).getTime() - start.getTime()) / (7 * 86400000));
      return `W${offset}`;
    };
    const trendMap = new Map<string, any>();
    {
      const cur = new Date(start);
      while (cur <= end) {
        const k = bucketKey(cur);
        if (!trendMap.has(k)) {
          let lbl: string;
          if (granularity === "day") lbl = `${cur.getDate()} ${BULAN[cur.getMonth()]}`;
          else if (granularity === "month") lbl = `${BULAN[cur.getMonth()]} ${String(cur.getFullYear()).slice(2)}`;
          else lbl = `${cur.getDate()} ${BULAN[cur.getMonth()]}`;
          trendMap.set(k, { key: k, label: lbl, pendapatan: 0, online: 0, offline: 0, pengeluaran: 0, laba: 0, pesanan: 0, pcs: 0 });
        }
        if (granularity === "month") cur.setMonth(cur.getMonth() + 1, 1);
        else cur.setDate(cur.getDate() + 1);
      }
    }
    const addTrend = (d: Date | null, field: string, v: number) => {
      if (!d || !inRange(d)) return;
      const b = trendMap.get(bucketKey(d));
      if (b) b[field] += v;
    };

    // ════════════════ PENDAPATAN ════════════════
    const validOnline = onlineOrders.filter((o) => !o._batal);
    const onlineInRange = validOnline.filter((o) => inRange(o._date));
    const onlinePrev = validOnline.filter((o) => inRange(o._date, prevStart, prevEnd));
    const offlineInRange = offlineSales.filter((s) => inRange(s._date));
    const offlinePrev = offlineSales.filter((s) => inRange(s._date, prevStart, prevEnd));

    const sum = (arr: any[], f: (x: any) => number) => arr.reduce((s, x) => s + f(x), 0);

    const pendOnline = sum(onlineInRange, (o) => num(o.total_amount));
    const pendOffline = sum(offlineInRange, (s) => num(s.total));
    const pendTotal = pendOnline + pendOffline;
    const pendPrev = sum(onlinePrev, (o) => num(o.total_amount)) + sum(offlinePrev, (s) => num(s.total));

    const pcsOnline = sum(onlineInRange, (o) => num(o.total_qty));
    const pcsOffline = sum(offlineInRange, (s) => num(s.jumlah || (s.items || []).length));
    const pcsPrev = sum(onlinePrev, (o) => num(o.total_qty)) + sum(offlinePrev, (s) => num(s.jumlah || (s.items || []).length));
    const jumlahPesanan = onlineInRange.length + offlineInRange.length;
    const jumlahPesananPrev = onlinePrev.length + offlinePrev.length;

    for (const o of onlineInRange) {
      addTrend(o._date, "pendapatan", num(o.total_amount));
      addTrend(o._date, "online", num(o.total_amount));
      addTrend(o._date, "pesanan", 1);
      addTrend(o._date, "pcs", num(o.total_qty));
    }
    for (const s of offlineInRange) {
      addTrend(s._date, "pendapatan", num(s.total));
      addTrend(s._date, "offline", num(s.total));
      addTrend(s._date, "pesanan", 1);
      addTrend(s._date, "pcs", num(s.jumlah || (s.items || []).length));
    }

    // Per kanal & platform
    const kanalMap: Record<string, { name: string; value: number; pesanan: number; pcs: number }> = {};
    const addKanal = (name: string, v: number, pcs: number) => {
      const k = (kanalMap[name] ||= { name, value: 0, pesanan: 0, pcs: 0 });
      k.value += v; k.pesanan += 1; k.pcs += pcs;
    };
    for (const o of onlineInRange) addKanal(String(o.marketplace || "Marketplace"), num(o.total_amount), num(o.total_qty));
    for (const s of offlineInRange) addKanal(String(s.kanal || "Offline").replace(/^Penjualan\s+/i, ""), num(s.total), num(s.jumlah || (s.items || []).length));
    const perKanal = Object.values(kanalMap).sort((a, b) => b.value - a.value);

    // Batal & retur (dalam rentang)
    const batalInRange = onlineOrders.filter((o) => o._batal && inRange(o._date));
    const nilaiBatal = sum(batalInRange, (o) => num(o.total_amount));

    // Status pesanan online (rentang)
    const statusMap: Record<string, number> = {};
    for (const o of onlineOrders.filter((o) => inRange(o._date))) {
      const st = o._batal ? "Batal" : String(o.status || "Lainnya");
      statusMap[st] = (statusMap[st] || 0) + 1;
    }
    const statusPesanan = Object.entries(statusMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    // ════════════════ PENGELUARAN ════════════════
    const purchaseOrders = (data.purchase_orders || []).filter((p: any) => !/batal|cancel/i.test(String(p.status || "")));
    const poInRange = purchaseOrders.filter((p: any) => inRange(parseDate(p.tanggal || p.createdAt)));
    const poPrev = purchaseOrders.filter((p: any) => inRange(parseDate(p.tanggal || p.createdAt), prevStart, prevEnd));
    const poTotal = (p: any) => num(p.total) || sum(p.items || [], (i: any) => num(i.subtotal));
    const pembelianBahan = sum(poInRange, poTotal);
    for (const p of poInRange) addTrend(parseDate(p.tanggal || p.createdAt), "pengeluaran", poTotal(p));

    const gajiList: any[] = data.gaji_cmt || [];
    const gajiPaid = (g: any) => num(g.dibayar ?? (g.status === "Lunas" || !g.status ? (g.totalGaji ?? g.total) : 0));
    const gajiInRange = gajiList.filter((g) => inRange(parseDate(g.tanggal || g.createdAt)));
    const gajiPrev = gajiList.filter((g) => inRange(parseDate(g.tanggal || g.createdAt), prevStart, prevEnd));
    const upahDibayar = sum(gajiInRange, gajiPaid);
    for (const g of gajiInRange) addTrend(parseDate(g.tanggal || g.createdAt), "pengeluaran", gajiPaid(g));

    const settlements: any[] = data.settlement_online || [];
    const settleByOrder = new Map<string, any>();
    for (const s of settlements) settleByOrder.set(String(s.order_id), s);
    // Potongan marketplace dihitung pada tanggal pesanan agar sejalan dengan pendapatan
    let komisi = 0, afiliasi = 0, ongkir = 0, lainnya = 0, pencairan = 0;
    let potonganPrev = 0;
    const orderDateById = new Map<string, Date | null>(onlineOrders.map((o) => [String(o.order_id), o._date]));
    for (const s of settlements) {
      const d = orderDateById.get(String(s.order_id)) || parseDate(s.tanggal_pembayaran);
      const pot = Math.abs(num(s.biaya_komisi)) + Math.abs(num(s.biaya_afiliasi)) + Math.abs(num(s.biaya_ongkir)) + Math.abs(num(s.biaya_lainnya));
      if (inRange(d)) {
        komisi += Math.abs(num(s.biaya_komisi));
        afiliasi += Math.abs(num(s.biaya_afiliasi));
        ongkir += Math.abs(num(s.biaya_ongkir));
        lainnya += Math.abs(num(s.biaya_lainnya));
        pencairan += num(s.penyelesaian_pembayaran);
        addTrend(d, "pengeluaran", pot);
      } else if (inRange(d, prevStart, prevEnd)) potonganPrev += pot;
    }
    const potonganMarketplace = komisi + afiliasi + ongkir + lainnya;
    const pengeluaranTotal = pembelianBahan + upahDibayar + potonganMarketplace;
    const pengeluaranPrev = sum(poPrev, poTotal) + sum(gajiPrev, gajiPaid) + potonganPrev;

    const pengeluaranBreakdown = [
      { name: "Pembelian Bahan / Kain", value: pembelianBahan, color: "#6366F1" },
      { name: "Upah Vendor (CMT/Washing)", value: upahDibayar, color: "#F59E0B" },
      { name: "Komisi Platform", value: komisi, color: "#EF4444" },
      { name: "Komisi Afiliasi", value: afiliasi, color: "#EC4899" },
      { name: "Ongkir Ditanggung Toko", value: ongkir, color: "#14B8A6" },
      { name: "Biaya Lainnya", value: lainnya, color: "#94A3B8" },
    ];

    const pengeluaranDetail = [
      ...poInRange.map((p: any) => {
        const sup = (data.data_supplier || []).find((s: any) => s.id === p.supplier_id);
        return {
          tanggal: p.tanggal || p.createdAt,
          kategori: "Pembelian Bahan",
          keterangan: `${p.uid || "PO"} · ${sup?.nama_supplier || "Supplier"} · ${(p.items || []).map((i: any) => i.nama_kain).filter(Boolean).join(", ")}`,
          metode: p.metode_pembayaran || "-",
          nilai: poTotal(p),
        };
      }),
      ...gajiInRange.map((g: any) => {
        const v = (data.vendors || []).find((x: any) => String(x.id) === String(g.cmtId));
        const po = (data.po_produksi || []).find((x: any) => String(x.id) === String(g.poId));
        return {
          tanggal: g.tanggal || g.createdAt,
          kategori: "Upah Vendor",
          keterangan: `${v?.nama || g.vendor_nama || "Vendor"}${po ? ` · PO ${po.noPo}` : ""}${g.jumlahPcs ? ` · ${g.jumlahPcs} pcs` : ""}`,
          metode: g.metode || "Transfer",
          nilai: gajiPaid(g),
        };
      }),
    ].sort((a, b) => (parseDate(b.tanggal)?.getTime() || 0) - (parseDate(a.tanggal)?.getTime() || 0)).slice(0, 25);

    // ════════════════ PIUTANG ════════════════
    // Pesanan marketplace valid yang belum dicairkan (seluruh waktu = saldo berjalan)
    const belumCair = validOnline.filter((o) => {
      const s = settleByOrder.get(String(o.order_id));
      return !(s && num(s.penyelesaian_pembayaran) > 0) && !o._retur;
    });
    const piutangMarketplace = sum(belumCair, (o) => num(o.total_amount));
    const piutangPerPlatform: Record<string, { name: string; value: number; pesanan: number; dikirim: number; selesai: number }> = {};
    for (const o of belumCair) {
      const k = String(o.marketplace || "Marketplace");
      const p = (piutangPerPlatform[k] ||= { name: k, value: 0, pesanan: 0, dikirim: 0, selesai: 0 });
      p.value += num(o.total_amount);
      p.pesanan += 1;
      if (/selesai|completed/i.test(String(o.status))) p.selesai += num(o.total_amount);
      else p.dikirim += num(o.total_amount);
    }
    // Umur piutang marketplace
    const aging = [
      { name: "0-7 hari", value: 0, count: 0 },
      { name: "8-14 hari", value: 0, count: 0 },
      { name: "15-30 hari", value: 0, count: 0 },
      { name: "> 30 hari", value: 0, count: 0 },
    ];
    for (const o of belumCair) {
      const age = o._date ? Math.floor((today.getTime() - startOfDay(o._date).getTime()) / 86400000) : 0;
      const idx = age <= 7 ? 0 : age <= 14 ? 1 : age <= 30 ? 2 : 3;
      aging[idx].value += num(o.total_amount);
      aging[idx].count += 1;
    }
    const pelangganPiutang = (data.data_pelanggan || [])
      .filter((p: any) => num(p.piutang) > 0)
      .map((p: any) => ({ nama: p.nama, tipe: p.tipe || "Pelanggan", kota: p.kota || "", nilai: num(p.piutang), kontak: p.kontak || "" }))
      .sort((a: any, b: any) => b.nilai - a.nilai);
    const piutangPelanggan = sum(pelangganPiutang, (p) => p.nilai);

    // ════════════════ HUTANG ════════════════
    const hutangSupplier = (data.hutang || []).map((h: any) => {
      const sup = (data.data_supplier || []).find((s: any) => s.id === h.supplier_id);
      const total = num(h.total_tagihan);
      const dibayar = num(h.jumlah_dibayar);
      const tgl = parseDate(h.tanggal || h.createdAt);
      return {
        nama: sup?.nama_supplier || "Supplier",
        jenis: "Supplier Bahan",
        referensi: h.po_uid || `#${h.id}`,
        tanggal: h.tanggal || h.createdAt,
        umurHari: tgl ? Math.floor((today.getTime() - startOfDay(tgl).getTime()) / 86400000) : 0,
        total,
        dibayar,
        sisa: Math.max(0, total - dibayar),
        status: h.status || (dibayar >= total ? "Lunas" : "Belum Lunas"),
      };
    });

    // Sisa hak upah vendor (sama dengan perhitungan modul Gaji CMT)
    const hutangUpah: any[] = [];
    for (const v of data.vendors || []) {
      const vPos = (data.po_produksi || []).filter((p: any) => String(p.vendorId) === String(v.id));
      if (!vPos.length) continue;
      let hak = 0, pcs = 0;
      for (const po of vPos) {
        const approved = (data.cmt_progres || [])
          .filter((r: any) => String(r.po_id) === String(po.id) && String(r.vendor_id) === String(v.id))
          .filter((r: any) => r.status === "Diterima" || r.status === "Diverifikasi" || r.status === "selesai")
          .reduce((s: number, r: any) => s + ((r.items || []).reduce((a: number, i: any) => a + num(i.jumlah), 0) || num(r.totalJumlah)), 0);
        const tarif = num(po.hargaPerPcs || (v.tarifPotongan && v.tarifPotongan[po.model]) || v.hargaPerPcs || 5000);
        hak += approved * tarif;
        pcs += approved;
      }
      const dibayar = sum(gajiList.filter((g) => String(g.cmtId) === String(v.id)), gajiPaid);
      if (hak <= 0 && dibayar <= 0) continue;
      hutangUpah.push({
        nama: v.nama,
        jenis: `Upah ${String(v.tipe || "Vendor").toUpperCase()}`,
        referensi: `${pcs.toLocaleString("id-ID")} pcs ACC`,
        tanggal: null,
        umurHari: 0,
        total: hak,
        dibayar,
        sisa: Math.max(0, hak - dibayar),
        status: dibayar >= hak ? "Lunas" : dibayar > 0 ? "Sebagian" : "Belum Dibayar",
      });
    }
    const hutangList = [...hutangSupplier, ...hutangUpah].sort((a, b) => b.sisa - a.sisa);
    const sisaSupplier = sum(hutangSupplier, (h) => h.sisa);
    const sisaUpah = sum(hutangUpah, (h) => h.sisa);
    const hutangTotal = sisaSupplier + sisaUpah;

    // ════════════════ PRODUK ════════════════
    const skuMap: Record<string, any> = {};
    const modelMap: Record<string, any> = {};
    const sizeMap: Record<string, number> = {};
    const addProduk = (sku: string, nama: string, size: string, pcs: number, omzet: number, kanal: string) => {
      const k = (skuMap[sku] ||= { sku, nama, pcs: 0, omzet: 0, kanal: new Set<string>() });
      k.pcs += pcs; k.omzet += omzet; k.kanal.add(kanal);
      const model = modelFromSku(sku);
      const m = (modelMap[model] ||= { model, pcs: 0, omzet: 0, sizes: {} as Record<string, number> });
      m.pcs += pcs; m.omzet += omzet; m.sizes[size] = (m.sizes[size] || 0) + pcs;
      sizeMap[size] = (sizeMap[size] || 0) + pcs;
    };
    for (const o of onlineInRange) {
      const isTt = /tiktok/i.test(String(o.marketplace));
      const totQty = Math.max(1, num(o.total_qty));
      for (const it of o.items || []) {
        const q = num(it.quantity) || 1;
        const omzet = isTt ? (num(o.total_amount) * q) / totQty : num(it.order_amount);
        const sku = String(it.seller_sku || it.variation || it.product_name || "TANPA SKU").trim().toUpperCase();
        addProduk(sku, String(it.product_name || ""), extractSize(it.seller_sku, it.variation), q, omzet, String(o.marketplace || "Online"));
      }
    }
    for (const s of offlineInRange) {
      for (const it of s.items || []) {
        const sku = String(it.sku || it.nama_barang || "TANPA SKU").toUpperCase();
        addProduk(sku, String(it.nama_barang || ""), String(it.size || "Lainnya").toUpperCase(), 1, num(it.harga), String(s.kanal || "Offline"));
      }
    }
    const topSku = Object.values(skuMap)
      .map((x: any) => ({ ...x, kanal: Array.from(x.kanal), share: pcsOnline + pcsOffline > 0 ? (x.pcs / (pcsOnline + pcsOffline)) * 100 : 0 }))
      .sort((a: any, b: any) => b.pcs - a.pcs);
    const topModel = Object.values(modelMap).sort((a: any, b: any) => b.omzet - a.omzet);
    const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "XXXL", "4XL", "5XL"];
    const perSize = Object.entries(sizeMap)
      .map(([size, pcs]) => ({ size, pcs }))
      .sort((a, b) => {
        const ia = SIZE_ORDER.indexOf(a.size), ib = SIZE_ORDER.indexOf(b.size);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return a.size.localeCompare(b.size, undefined, { numeric: true });
      });

    // Tren pcs per model (top 4) untuk grafik garis
    const topModelNames = topModel.slice(0, 4).map((m: any) => m.model);
    const modelTrendMap = new Map<string, any>();
    for (const [k, b] of trendMap) {
      const row: any = { key: k, label: b.label };
      for (const m of topModelNames) row[m] = 0;
      modelTrendMap.set(k, row);
    }
    for (const o of onlineInRange) {
      const row = modelTrendMap.get(bucketKey(o._date!));
      if (!row) continue;
      for (const it of o.items || []) {
        const model = modelFromSku(String(it.seller_sku || it.variation || it.product_name || "TANPA SKU"));
        if (topModelNames.includes(model)) row[model] += num(it.quantity) || 1;
      }
    }
    for (const s of offlineInRange) {
      const row = modelTrendMap.get(bucketKey(s._date!));
      if (!row) continue;
      for (const it of s.items || []) {
        const model = modelFromSku(String(it.sku || it.nama_barang || "TANPA SKU"));
        if (topModelNames.includes(model)) row[model] += 1;
      }
    }

    // ════════════════ INVENTORI & ASET ════════════════
    const barcodeStatus: Record<string, number> = {};
    for (const b of data.barcode_item || []) barcodeStatus[b.status || "lainnya"] = (barcodeStatus[b.status || "lainnya"] || 0) + 1;
    const STATUS_LABEL: Record<string, string> = {
      potong: "Potong / Jahit", washing_dikerjakan: "Di Washing", gudang: "Gudang Produksi",
      siap_jual: "Siap Jual", terjual: "Terjual", reject: "Reject",
    };
    const inventori = Object.entries(barcodeStatus).map(([k, v]) => ({ key: k, name: STATUS_LABEL[k] || k.replace(/_/g, " "), value: v }));
    const nilaiKain = sum(data.data_kain || [], (k: any) => num(k.stok_meter) * num(k.harga_beli));
    const meterKain = sum(data.data_kain || [], (k: any) => num(k.stok_meter));
    const nilaiAksesoris = sum(data.item_pendukung || [], (i: any) => num(i.stok) * num(i.harga_beli));
    const barangList = (data.data_barang || []).map((b: any) => ({
      nama: b.nama_barang, kode: b.kode || b.uid, kategori: b.kategori_nama || "", stok: num(b.stok),
      harga_jual: num(b.harga_jual), harga_beli: num(b.harga_beli),
    }));
    const nilaiBarangJadi = sum(barangList, (b: any) => b.stok * (b.harga_beli || 0));

    // ════════════════ WILAYAH / KURIR / PEMBAYARAN ════════════════
    const countBy = (arr: any[], f: (x: any) => string, v: (x: any) => number = () => 1) => {
      const m: Record<string, { name: string; value: number; omzet: number }> = {};
      for (const x of arr) {
        const k = f(x) || "Tidak diketahui";
        const e = (m[k] ||= { name: k, value: 0, omzet: 0 });
        e.value += 1; e.omzet += v(x);
      }
      return Object.values(m).sort((a, b) => b.value - a.value);
    };
    const perProvinsi = countBy(onlineInRange, (o) => String(o.province || "").trim(), (o) => num(o.total_amount)).slice(0, 8);
    const perKurir = countBy(onlineInRange, (o) => String(o.shipping_provider || "").trim(), (o) => num(o.total_amount)).slice(0, 6);
    const perPembayaran = countBy(onlineInRange, (o) => String(o.payment_method || "").trim(), (o) => num(o.total_amount)).slice(0, 6);

    // Hari terbaik
    const trend = Array.from(trendMap.values()).map((t) => ({ ...t, laba: t.pendapatan - t.pengeluaran }));
    const best = trend.reduce((b, t) => (t.pendapatan > (b?.pendapatan || 0) ? t : b), null as any);

    // Transaksi terbaru
    const transaksiTerbaru = [
      ...onlineInRange.map((o) => ({
        tanggal: o._date?.toISOString(), id: o.order_id, kanal: o.marketplace, pelanggan: o.buyer_username || o.recipient || "-",
        pcs: num(o.total_qty), nilai: num(o.total_amount), status: o.status,
      })),
      ...offlineInRange.map((s) => ({
        tanggal: s._date?.toISOString(), id: s.no_transaksi, kanal: String(s.kanal || "Offline").replace(/^Penjualan\s+/i, ""),
        pelanggan: s.pelanggan || "-", pcs: num(s.jumlah || (s.items || []).length), nilai: num(s.total), status: "Lunas",
      })),
    ].sort((a, b) => new Date(b.tanggal || 0).getTime() - new Date(a.tanggal || 0).getTime()).slice(0, 10);

    const growth = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : 0);

    return NextResponse.json({
      generatedAt: now.toISOString(),
      range: { key: rangeParam, label, start: start.toISOString(), end: end.toISOString(), granularity, prevStart: prevStart.toISOString(), prevEnd: prevEnd.toISOString() },
      ringkasan: {
        pendapatan: pendTotal,
        pendapatanPrev: pendPrev,
        pendapatanGrowth: growth(pendTotal, pendPrev),
        pengeluaran: pengeluaranTotal,
        pengeluaranPrev,
        pengeluaranGrowth: growth(pengeluaranTotal, pengeluaranPrev),
        arusKasBersih: pendTotal - pengeluaranTotal,
        margin: pendTotal > 0 ? ((pendTotal - pengeluaranTotal) / pendTotal) * 100 : 0,
        piutang: piutangMarketplace + piutangPelanggan,
        hutang: hutangTotal,
        posisiBersih: piutangMarketplace + piutangPelanggan - hutangTotal,
        pesanan: jumlahPesanan,
        pesananPrev: jumlahPesananPrev,
        pesananGrowth: growth(jumlahPesanan, jumlahPesananPrev),
        pcs: pcsOnline + pcsOffline,
        pcsPrev,
        pcsGrowth: growth(pcsOnline + pcsOffline, pcsPrev),
        aov: jumlahPesanan > 0 ? pendTotal / jumlahPesanan : 0,
        hargaRataPcs: pcsOnline + pcsOffline > 0 ? pendTotal / (pcsOnline + pcsOffline) : 0,
        nilaiBatal,
        jumlahBatal: batalInRange.length,
        rasioBatal: onlineOrders.filter((o) => inRange(o._date)).length > 0 ? (batalInRange.length / onlineOrders.filter((o) => inRange(o._date)).length) * 100 : 0,
        hariTerbaik: best && best.pendapatan > 0 ? { label: best.label, nilai: best.pendapatan } : null,
      },
      pendapatan: {
        total: pendTotal, online: pendOnline, offline: pendOffline,
        pcsOnline, pcsOffline,
        perKanal,
        statusPesanan,
        pencairan,
      },
      pengeluaran: {
        total: pengeluaranTotal,
        pembelianBahan, upahDibayar, potonganMarketplace,
        komisi, afiliasi, ongkir, lainnya,
        breakdown: pengeluaranBreakdown,
        detail: pengeluaranDetail,
      },
      piutang: {
        total: piutangMarketplace + piutangPelanggan,
        marketplace: piutangMarketplace,
        pelanggan: piutangPelanggan,
        pesananBelumCair: belumCair.length,
        perPlatform: Object.values(piutangPerPlatform).sort((a, b) => b.value - a.value),
        aging,
        pelangganList: pelangganPiutang.slice(0, 10),
      },
      hutang: {
        total: hutangTotal,
        supplier: sisaSupplier,
        upahVendor: sisaUpah,
        totalTagihan: sum(hutangList, (h) => h.total),
        totalDibayar: sum(hutangList, (h) => h.dibayar),
        list: hutangList.slice(0, 15),
      },
      produk: {
        topSku: topSku.slice(0, 10),
        topModel: topModel.slice(0, 8).map((m: any) => ({ model: m.model, pcs: m.pcs, omzet: m.omzet })),
        perSize,
        modelTrend: { models: topModelNames, data: Array.from(modelTrendMap.values()) },
        jumlahSku: topSku.length,
      },
      inventori: {
        status: inventori,
        nilaiKain, meterKain, nilaiAksesoris, nilaiBarangJadi,
        barang: barangList.sort((a: any, b: any) => b.stok - a.stok).slice(0, 8),
      },
      pelanggan: { perProvinsi, perKurir, perPembayaran },
      trend,
      transaksiTerbaru,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Gagal memuat ringkasan bisnis" }, { status: 500 });
  }
}

