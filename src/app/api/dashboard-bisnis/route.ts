import { NextRequest, NextResponse } from "next/server";
import { readData } from "@/lib/data-store";
import { groupOrders } from "@/lib/marketplace";

export const dynamic = "force-dynamic";

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
  const parts = String(variation || "").split(",");
  const afterComma = (parts[1] || parts[0] || "").trim().split(/\s+/)[0] || "";
  if (SIZE_RE.test(afterComma)) return afterComma.toUpperCase();
  return "L";
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
    const sp = new URL(req.url).searchParams;
    const rangeParam = (sp.get("range") || "30").toLowerCase();
    const shopFilter = sp.get("shop") || "all"; // "all" | "offline" | shop_key

    const now = new Date();
    const today = startOfDay(now);
    const end = new Date(today.getTime() + 86400000 - 1);

    // ── Kumpulkan semua pesanan online (per Order ID) ──
    const rawOnline: any[] = data.penjualan_online || [];
    const batalIds = new Set<string>();
    for (const r of rawOnline) if (isBatal(r)) batalIds.add(String(r.order_id || "").trim());

    const grouped = Object.values(groupOrders(data)) as any[];
    const allOnlineOrders = grouped
      .filter((o) => (o.items || []).length > 0)
      .map((o) => {
        const shopKey = o.shop_key || `mp:${o.marketplace || "Marketplace"}`;
        const shopName = o.shop_name || o.marketplace || "Toko Online";
        return {
          ...o,
          _shopKey: shopKey,
          _shopName: shopName,
          _date: parseDate(o.tanggal_pesanan) || parseDate(o.tanggal_diimpor),
          _batal: batalIds.has(String(o.order_id)) || isBatal(o),
          _retur: /retur|return/i.test(String(o.status || "")),
        };
      });

    const allOfflineSales: any[] = (data.penjualan_barcode || [])
      .filter((p: any) => !/online/i.test(String(p.kanal || "")))
      .map((p: any) => ({ ...p, _date: parseDate(p.tanggal) }));

    // Filter berdasarkan toko yang dipilih
    const onlineOrders =
      shopFilter === "all"
        ? allOnlineOrders
        : shopFilter === "offline"
        ? []
        : allOnlineOrders.filter((o) => o._shopKey === shopFilter);

    const offlineSales =
      shopFilter === "all" || shopFilter === "offline"
        ? allOfflineSales
        : [];

    // ── Tentukan rentang tanggal ──
    let start: Date;
    let label: string;
    if (rangeParam === "all") {
      const dates = [
        ...allOnlineOrders.map((o) => o._date),
        ...allOfflineSales.map((s) => s._date),
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

    const spanDays = Math.max(1, Math.round(spanMs / 86400000));
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

    const sum = (arr: any[], f: (x: any) => number) => arr.reduce((s, x) => s + f(x), 0);

    // ════════════════ MULTI-TOKO ONLINE HUB (Selalu dihitung untuk seluruh toko) ════════════════
    const settlements: any[] = data.settlement_online || [];
    const settleByOrder = new Map<string, any>();
    for (const s of settlements) settleByOrder.set(String(s.order_id), s);

    const registeredShops: any[] = Array.isArray(data.marketplace_shops) ? data.marketplace_shops : [];
    const multiShopMap = new Map<string, any>();
    for (const rs of registeredShops) {
      multiShopMap.set(String(rs.key), {
        shop_key: String(rs.key),
        shop_name: rs.shop_name || rs.label || "Toko Online",
        marketplace: rs.label || (rs.platform === "shopee" ? "Shopee" : "TikTok Shop"),
        platform: rs.platform,
        aktif: rs.aktif !== false,
        connected: true,
        last_sync_run: rs.last_sync_run || null,
        pesanan: 0,
        pcs: 0,
        omzet: 0,
        potongan: 0,
        pencairan: 0,
        escrow: 0,
        batal: 0,
      });
    }
    for (const o of allOnlineOrders.filter((x) => inRange(x._date))) {
      const k = o._shopKey;
      const entry =
        multiShopMap.get(k) ||
        (() => {
          const nw = {
            shop_key: k,
            shop_name: o._shopName,
            marketplace: o.marketplace || "Marketplace",
            platform: o.platform || (/shopee/i.test(String(o.marketplace)) ? "shopee" : "tiktok"),
            aktif: true,
            connected: false,
            last_sync_run: null,
            pesanan: 0,
            pcs: 0,
            omzet: 0,
            potongan: 0,
            pencairan: 0,
            escrow: 0,
            batal: 0,
          };
          multiShopMap.set(k, nw);
          return nw;
        })();

      if (o._batal) {
        entry.batal += 1;
        continue;
      }
      const amt = num(o.total_amount);
      entry.pesanan += 1;
      entry.pcs += num(o.total_qty);
      entry.omzet += amt;

      const st = settleByOrder.get(String(o.order_id));
      if (st) {
        const pot = Math.abs(num(st.biaya_komisi)) + Math.abs(num(st.biaya_afiliasi)) + Math.abs(num(st.biaya_ongkir)) + Math.abs(num(st.biaya_lainnya));
        entry.potongan += pot;
        entry.pencairan += num(st.penyelesaian_pembayaran);
      }
      if (!(st && num(st.penyelesaian_pembayaran) > 0) && !o._retur) {
        entry.escrow += amt;
      }
    }
    const totalAllShopOmzet = Array.from(multiShopMap.values()).reduce((s, x) => s + x.omzet, 0);
    const multiTokoList = Array.from(multiShopMap.values())
      .map((x) => ({
        ...x,
        share: totalAllShopOmzet > 0 ? (x.omzet / totalAllShopOmzet) * 100 : 0,
      }))
      .sort((a, b) => b.omzet - a.omzet);

    // ════════════════ PENDAPATAN ════════════════
    const validOnline = onlineOrders.filter((o) => !o._batal);
    const onlineInRange = validOnline.filter((o) => inRange(o._date));
    const onlinePrev = validOnline.filter((o) => inRange(o._date, prevStart, prevEnd));
    const offlineInRange = offlineSales.filter((s) => inRange(s._date));
    const offlinePrev = offlineSales.filter((s) => inRange(s._date, prevStart, prevEnd));

    const pendOnline = sum(onlineInRange, (o) => num(o.total_amount));
    const pendOffline = sum(offlineInRange, (s) => num(s.total));
    const pendTotal = pendOnline + pendOffline;
    const pendPrev = sum(onlinePrev, (o) => num(o.total_amount)) + sum(offlinePrev, (s) => num(s.total));

    const pcsOnline = sum(onlineInRange, (o) => num(o.total_qty));
    const pcsOffline = sum(offlineInRange, (s) => num(s.jumlah || (s.items || []).length));
    const pcsTotal = pcsOnline + pcsOffline;
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

    // Per kanal & nama toko
    const kanalMap: Record<string, { name: string; value: number; pesanan: number; pcs: number }> = {};
    const addKanal = (name: string, v: number, pcs: number) => {
      const k = (kanalMap[name] ||= { name, value: 0, pesanan: 0, pcs: 0 });
      k.value += v; k.pesanan += 1; k.pcs += pcs;
    };
    for (const o of onlineInRange) {
      const labelKanal = o._shopName && o._shopName !== o.marketplace ? `${o._shopName} (${o.marketplace})` : String(o.marketplace || "Marketplace");
      addKanal(labelKanal, num(o.total_amount), num(o.total_qty));
    }
    for (const s of offlineInRange) addKanal(String(s.kanal || "Offline").replace(/^Penjualan\s+/i, ""), num(s.total), num(s.jumlah || (s.items || []).length));
    const perKanal = Object.values(kanalMap).sort((a, b) => b.value - a.value);

    const batalInRange = onlineOrders.filter((o) => o._batal && inRange(o._date));
    const nilaiBatal = sum(batalInRange, (o) => num(o.total_amount));

    const statusMap: Record<string, number> = {};
    for (const o of onlineOrders.filter((o) => inRange(o._date))) {
      const st = o._batal ? "Batal" : String(o.status || "Lainnya");
      statusMap[st] = (statusMap[st] || 0) + 1;
    }
    const statusPesanan = Object.entries(statusMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    // ════════════════ PENGELUARAN (Bahan + Upah + Potongan + OPEX) ════════════════
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

    // Biaya Operasional (OPEX)
    const opexAll: any[] = Array.isArray(data.biaya_operasional) ? data.biaya_operasional : [];
    const opexInRange = opexAll.filter((x) => inRange(parseDate(x.tanggal || x.createdAt)));
    const opexPrev = opexAll.filter((x) => inRange(parseDate(x.tanggal || x.createdAt), prevStart, prevEnd));
    const opexTotal = sum(opexInRange, (x) => num(x.nominal));
    for (const x of opexInRange) addTrend(parseDate(x.tanggal || x.createdAt), "pengeluaran", num(x.nominal));

    // Potongan marketplace (hanya untuk pesanan dari toko yang sedang difilter)
    const allowedOrderIds = new Set(onlineOrders.map((o) => String(o.order_id)));
    let komisi = 0, afiliasi = 0, ongkir = 0, lainnya = 0, pencairan = 0;
    let potonganPrev = 0;
    const orderDateById = new Map<string, Date | null>(onlineOrders.map((o) => [String(o.order_id), o._date]));
    for (const s of settlements) {
      if (shopFilter !== "all" && !allowedOrderIds.has(String(s.order_id))) continue;
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
    const pengeluaranTotal = pembelianBahan + upahDibayar + potonganMarketplace + opexTotal;
    const pengeluaranPrev = sum(poPrev, poTotal) + sum(gajiPrev, gajiPaid) + potonganPrev + sum(opexPrev, (x) => num(x.nominal));

    const pengeluaranBreakdown = [
      { name: "Pembelian Bahan / Kain", value: pembelianBahan, color: "#6366F1" },
      { name: "Upah Vendor (CMT/Washing)", value: upahDibayar, color: "#F59E0B" },
      { name: "Komisi Platform Marketplace", value: komisi, color: "#EF4444" },
      { name: "Komisi Afiliasi / Kreator", value: afiliasi, color: "#EC4899" },
      { name: "Ongkir Ditanggung Toko", value: ongkir, color: "#14B8A6" },
      { name: "Biaya Operasional (OPEX)", value: opexTotal, color: "#8B5CF6" },
      { name: "Biaya Lainnya", value: lainnya, color: "#94A3B8" },
    ];

    const pengeluaranDetail = [
      ...opexInRange.map((x: any) => ({
        id: x.id,
        isOpex: true,
        tanggal: x.tanggal || x.createdAt,
        kategori: "OPEX · " + (x.kategori || "Operasional"),
        keterangan: `${x.keterangan || x.kategori}${x.toko && x.toko !== "Semua Toko / Umum" ? ` (${x.toko})` : ""}`,
        metode: x.metode || "Kas/Transfer",
        nilai: num(x.nominal),
      })),
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
    ].sort((a, b) => (parseDate(b.tanggal)?.getTime() || 0) - (parseDate(a.tanggal)?.getTime() || 0)).slice(0, 30);

    // ════════════════ PIUTANG (Escrow Multi-Toko + Buku Piutang Grosir) ════════════════
    const belumCair = validOnline.filter((o) => {
      const s = settleByOrder.get(String(o.order_id));
      return !(s && num(s.penyelesaian_pembayaran) > 0) && !o._retur;
    });
    const piutangMarketplace = sum(belumCair, (o) => num(o.total_amount));
    const piutangPerPlatform: Record<string, { name: string; value: number; pesanan: number; dikirim: number; selesai: number }> = {};
    for (const o of belumCair) {
      const k = o._shopName && o._shopName !== o.marketplace ? `${o._shopName} (${o.marketplace})` : String(o.marketplace || "Marketplace");
      const p = (piutangPerPlatform[k] ||= { name: k, value: 0, pesanan: 0, dikirim: 0, selesai: 0 });
      p.value += num(o.total_amount);
      p.pesanan += 1;
      if (/selesai|completed/i.test(String(o.status))) p.selesai += num(o.total_amount);
      else p.dikirim += num(o.total_amount);
    }

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

    // Piutang Grosir dari piutang_grosir (atau fallback data_pelanggan)
    const rawPiutangGrosir: any[] = Array.isArray(data.piutang_grosir) ? data.piutang_grosir : [];
    const pelangganPiutang =
      rawPiutangGrosir.length > 0
        ? rawPiutangGrosir
            .map((p: any) => ({
              id: p.id,
              no_faktur: p.no_faktur,
              nama: p.pelanggan_nama || "Pelanggan Grosir",
              tipe: "Grosir",
              kota: p.pelanggan_kota || "",
              jatuh_tempo: p.jatuh_tempo || "",
              nilai: Math.max(0, num(p.total_tagihan) - num(p.jumlah_dibayar)),
            }))
            .filter((p) => p.nilai > 0)
            .sort((a, b) => b.nilai - a.nilai)
        : (data.data_pelanggan || [])
            .filter((p: any) => num(p.piutang) > 0)
            .map((p: any) => ({ nama: p.nama, tipe: p.tipe || "Pelanggan", kota: p.kota || "", nilai: num(p.piutang) }))
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

    // ════════════════ PRODUK, HPP OTOMATIS (UNIT ECONOMICS) & SMART REORDER ════════════════
    const skuMap: Record<string, any> = {};
    const modelMap: Record<string, any> = {};
    const sizeMap: Record<string, number> = {};
    const addProduk = (sku: string, nama: string, size: string, pcs: number, omzet: number, kanal: string) => {
      const k = (skuMap[sku] ||= { sku, nama, pcs: 0, omzet: 0, kanal: new Set<string>() });
      k.pcs += pcs; k.omzet += omzet; k.kanal.add(kanal);
      const model = modelFromSku(sku);
      const m = (modelMap[model] ||= { model, nama: nama || model, pcs: 0, omzet: 0, sizes: {} as Record<string, number> });
      m.pcs += pcs; m.omzet += omzet; m.sizes[size] = (m.sizes[size] || 0) + pcs;
      if (!m.nama && nama) m.nama = nama;
      sizeMap[size] = (sizeMap[size] || 0) + pcs;
    };
    for (const o of onlineInRange) {
      const isTt = /tiktok/i.test(String(o.marketplace));
      const totQty = Math.max(1, num(o.total_qty));
      for (const it of o.items || []) {
        const q = num(it.quantity) || 1;
        const omzet = isTt ? (num(o.total_amount) * q) / totQty : num(it.order_amount);
        const sku = String(it.seller_sku || it.variation || it.product_name || "TANPA SKU").trim().toUpperCase();
        addProduk(sku, String(it.product_name || ""), extractSize(it.seller_sku, it.variation), q, omzet, String(o._shopName || o.marketplace || "Online"));
      }
    }
    for (const s of offlineInRange) {
      for (const it of s.items || []) {
        const sku = String(it.sku || it.nama_barang || "TANPA SKU").toUpperCase();
        addProduk(sku, String(it.nama_barang || ""), String(it.size || "L").toUpperCase(), 1, num(it.harga), String(s.kanal || "Offline"));
      }
    }
    const topSku = Object.values(skuMap)
      .map((x: any) => ({ ...x, kanal: Array.from(x.kanal), share: pcsTotal > 0 ? (x.pcs / pcsTotal) * 100 : 0 }))
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

    // ── Kalkulasi HPP Standar dari Data Produksi Riil ──
    const avgHargaKainPerMeter = (() => {
      const kains = (data.data_kain || []).filter((k: any) => num(k.harga_beli) > 0);
      return kains.length ? sum(kains, (k) => num(k.harga_beli)) / kains.length : 21170;
    })();
    const avgPemakaianMeter = (() => {
      const cuts = (data.pemotongan_kain || []).filter((c: any) => num(c.pemakaian_cm) > 0);
      return cuts.length ? sum(cuts, (c) => num(c.pemakaian_cm)) / cuts.length / 100 : 1.2;
    })();
    const defaultBiayaKain = Math.round(avgHargaKainPerMeter * avgPemakaianMeter); // ~Rp 25.404
    const defaultBiayaJahit = (() => {
      const cmtVendors = (data.vendors || []).filter((v: any) => v.tipe === "cmt" && num(v.hargaPerPcs) > 0);
      return cmtVendors.length ? Math.round(sum(cmtVendors, (v) => num(v.hargaPerPcs)) / cmtVendors.length) : 8000;
    })();
    const defaultBiayaWashing = (() => {
      const washVendors = (data.vendors || []).filter((v: any) => v.tipe === "washing" && num(v.hargaPerPcs) > 0);
      return washVendors.length ? Math.round(sum(washVendors, (v) => num(v.hargaPerPcs)) / washVendors.length) : 5000;
    })();
    const defaultBiayaAksesoris = 3500; // Benang, resleting YKK, kancing, rivet, hangtag
    const defaultHppPerPcs = defaultBiayaKain + defaultBiayaAksesoris + defaultBiayaJahit + defaultBiayaWashing;

    // Rasio potongan marketplace rata-rata terhadap omzet online
    const feeRatio = pendOnline > 0 ? potonganMarketplace / pendOnline : 0.14;

    const unitEconomics = topModel.slice(0, 10).map((m: any) => {
      // Cek apakah ada data_barang yang cocok
      const matchedBrg = (data.data_barang || []).find(
        (b: any) =>
          String(b.nama_barang || "").toUpperCase().includes(m.model) ||
          m.model.includes(String(b.warna || "").toUpperCase())
      );
      const hppPerPcs = matchedBrg && num(matchedBrg.harga_beli) > 20000 ? num(matchedBrg.harga_beli) + defaultBiayaJahit + defaultBiayaWashing : defaultHppPerPcs;
      const hargaJualRata = m.pcs > 0 ? m.omzet / m.pcs : 0;
      const potonganPerPcs = Math.round(hargaJualRata * feeRatio);
      const labaPerPcs = Math.round(hargaJualRata - potonganPerPcs - hppPerPcs);
      const totalHpp = m.pcs * hppPerPcs;
      const totalPotongan = m.pcs * potonganPerPcs;
      const totalLabaBersih = m.omzet - totalPotongan - totalHpp;
      const marginPct = m.omzet > 0 ? (totalLabaBersih / m.omzet) * 100 : 0;

      return {
        model: m.model,
        nama: m.nama,
        pcs: m.pcs,
        omzet: m.omzet,
        hargaJualRata: Math.round(hargaJualRata),
        biayaKain: defaultBiayaKain,
        biayaAksesoris: defaultBiayaAksesoris,
        biayaJahit: defaultBiayaJahit,
        biayaWashing: defaultBiayaWashing,
        hppPerPcs,
        potonganPerPcs,
        labaPerPcs,
        totalHpp,
        totalPotongan,
        totalLabaBersih: Math.round(totalLabaBersih),
        marginPct,
      };
    });

    const totalHppTerjual = sum(unitEconomics, (u) => u.totalHpp);
    const labaBersihRiil = pendTotal - potonganMarketplace - totalHppTerjual - opexTotal;
    const marginBersihRiil = pendTotal > 0 ? (labaBersihRiil / pendTotal) * 100 : 0;

    // ── Smart Reorder & Stock Run-Rate (Rekomendasi Repeat PO Otomatis) ──
    // Hitung stok siap jual & WIP dari barcode_item dan data_barang
    const totalSiapJualGlobal = (data.barcode_item || []).filter((b: any) => b.status === "siap_jual" || b.status === "gudang").length;
    const totalWipGlobal = (data.barcode_item || []).filter((b: any) => b.status === "potong" || b.status === "washing_dikerjakan").length;
    const reviews: any[] = Array.isArray(data.product_reviews) ? data.product_reviews : [];

    // Hitung jumlah hari aktif penjualan dalam periode untuk velocity akurat
    const activeSaleDates = new Set(onlineInRange.map((o) => (o._date ? ymd(o._date) : "")).filter(Boolean));
    const effectiveDays = Math.max(1, Math.min(spanDays, activeSaleDates.size || 7));

    const reorderRecommendations = topModel.slice(0, 8).map((m: any) => {
      const sharePcs = pcsTotal > 0 ? m.pcs / pcsTotal : 0;
      const matchedBrg = (data.data_barang || []).find(
        (b: any) =>
          String(b.nama_barang || "").toUpperCase().includes(m.model) ||
          m.model.includes(String(b.warna || "").toUpperCase())
      );
      // Estimasi stok siap jual untuk model ini (dari stok barang atau proporsi barcode gudang)
      const stokReady = matchedBrg && num(matchedBrg.stok) > 0 ? num(matchedBrg.stok) : Math.round(totalSiapJualGlobal * sharePcs * 0.15);
      const stokWip = Math.round(totalWipGlobal * sharePcs * 0.2);
      const velocityPerHari = Number((m.pcs / effectiveDays).toFixed(1));
      const estimasiHabisHari = velocityPerHari > 0 ? Math.round(stokReady / velocityPerHari) : 99;

      // Rating ulasan model
      const modelRevs = reviews.filter(
        (r: any) =>
          String(r.product_name || "").toUpperCase().includes(m.model) ||
          String(r.variation || "").toUpperCase().includes(m.model)
      );
      const avgRating = modelRevs.length > 0 ? sum(modelRevs, (r) => num(r.rating || 5)) / modelRevs.length : 4.9;

      // Kebutuhan 21 hari ke depan
      const targetBuffer21Hari = Math.ceil(velocityPerHari * 21);
      const kurangPcs = Math.max(0, targetBuffer21Hari - stokReady);
      const rekomendasiPotong = kurangPcs > 0 ? Math.max(120, Math.ceil(kurangPcs / 60) * 60) : 120;

      // Rasio size sesuai histori laku model ini
      const topSizes = Object.entries(m.sizes as Record<string, number>)
        .sort((a, b) => b[1] - a[1])
        .map(([sz, count]) => ({
          size: sz,
          terjual: count,
          rasioPct: m.pcs > 0 ? Math.round((count / m.pcs) * 100) : 0,
          rekomendasiPcs: m.pcs > 0 ? Math.round((count / m.pcs) * rekomendasiPotong) : 0,
        }));

      const prioritas: "KRITIS" | "SIAGA" | "AMAN" =
        estimasiHabisHari <= 5 ? "KRITIS" : estimasiHabisHari <= 12 ? "SIAGA" : "AMAN";

      return {
        model: m.model,
        nama: m.nama,
        pcsTerjual: m.pcs,
        velocityPerHari,
        stokReady,
        stokWip,
        estimasiHabisHari,
        avgRating: Number(avgRating.toFixed(1)),
        rekomendasiPotong,
        prioritas,
        topSizes,
      };
    }).sort((a, b) => a.estimasiHabisHari - b.estimasiHabisHari);

    // Tren pcs per model (top 4)
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

    const trend = Array.from(trendMap.values()).map((t) => ({ ...t, laba: t.pendapatan - t.pengeluaran }));
    const best = trend.reduce((b, t) => (t.pendapatan > (b?.pendapatan || 0) ? t : b), null as any);

    const transaksiTerbaru = [
      ...onlineInRange.map((o) => ({
        tanggal: o._date?.toISOString(),
        id: o.order_id,
        kanal: o._shopName && o._shopName !== o.marketplace ? `${o._shopName} (${o.marketplace})` : o.marketplace,
        pelanggan: o.buyer_username || o.recipient || "-",
        pcs: num(o.total_qty),
        nilai: num(o.total_amount),
        status: o.status,
      })),
      ...offlineInRange.map((s) => ({
        tanggal: s._date?.toISOString(),
        id: s.no_transaksi,
        kanal: String(s.kanal || "Offline").replace(/^Penjualan\s+/i, ""),
        pelanggan: s.pelanggan || "-",
        pcs: num(s.jumlah || (s.items || []).length),
        nilai: num(s.total),
        status: s.metode_pembayaran || "Lunas",
      })),
    ].sort((a, b) => new Date(b.tanggal || 0).getTime() - new Date(a.tanggal || 0).getTime()).slice(0, 12);

    const growth = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : 0);

    return NextResponse.json({
      generatedAt: now.toISOString(),
      shopFilter,
      multiToko: multiTokoList,
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
        hppTerjual: totalHppTerjual,
        labaBersihRiil: Math.round(labaBersihRiil),
        marginBersihRiil,
        hppStandarPerPcs: defaultHppPerPcs,
        piutang: piutangMarketplace + piutangPelanggan,
        hutang: hutangTotal,
        posisiBersih: piutangMarketplace + piutangPelanggan - hutangTotal,
        pesanan: jumlahPesanan,
        pesananPrev: jumlahPesananPrev,
        pesananGrowth: growth(jumlahPesanan, jumlahPesananPrev),
        pcs: pcsTotal,
        pcsPrev,
        pcsGrowth: growth(pcsTotal, pcsPrev),
        aov: jumlahPesanan > 0 ? pendTotal / jumlahPesanan : 0,
        hargaRataPcs: pcsTotal > 0 ? pendTotal / pcsTotal : 0,
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
        pembelianBahan, upahDibayar, potonganMarketplace, opexTotal,
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
        unitEconomics,
        reorderRecommendations,
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
