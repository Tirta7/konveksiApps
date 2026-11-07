"use client";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from "recharts";
import {
  BarChart2, TrendingUp, Store, ShoppingBag, UploadCloud, DollarSign, Wallet, FileX, CreditCard,
  ChevronRight, ChevronLeft, Calculator, PieChart, Download, RefreshCw, Calendar, CalendarDays, X, CheckCircle2, Clock, Users, ArrowUpRight, Search,
  Star, ThumbsUp, MessageSquare, AlertTriangle, Sparkles, Plus, Copy, ExternalLink, Receipt, FileText, Check
} from "lucide-react";
import Papa from "papaparse";
import { toast } from "sonner";
import { subscribeRealtime, subscribeRealtimeEvent } from "@/lib/realtime-client";

function parseOrderDate(dateStr: any): Date | null {
  if (!dateStr || typeof dateStr !== "string") return null;
  const s = dateStr.trim();
  if (!s || s === "-") return null;

  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (slashMatch) {
    const [, day, month, year, hh = "0", mm = "0", ss = "0"] = slashMatch;
    const d = new Date(Number(year), Number(month) - 1, Number(day), Number(hh), Number(mm), Number(ss));
    return isNaN(d.getTime()) ? null : d;
  }

  const dashMatch = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (dashMatch) {
    const [, day, month, year, hh = "0", mm = "0", ss = "0"] = dashMatch;
    const d = new Date(Number(year), Number(month) - 1, Number(day), Number(hh), Number(mm), Number(ss));
    return isNaN(d.getTime()) ? null : d;
  }

  const ymdMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (ymdMatch) {
    const [, year, month, day, hh = "0", mm = "0", ss = "0"] = ymdMatch;
    const d = new Date(Number(year), Number(month) - 1, Number(day), Number(hh), Number(mm), Number(ss));
    return isNaN(d.getTime()) ? null : d;
  }

  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function formatYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function LaporanPage() {
  const [data, setData] = useState<any[]>([]);
  const [keuanganData, setKeuanganData] = useState<{ sales: any[], retur: any[], settlement: any[] }>({ sales: [], retur: [], settlement: [] });
  const [periode, setPeriode] = useState<"minggu" | "bulan">("minggu");
  const [activeTab, setActiveTab] = useState<"keuangan" | "produk" | "review">("keuangan");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [syncingSettlement, setSyncingSettlement] = useState(false);

  // Review & Rating State (100% Organik Resmi Marketplace)
  const [reviewsData, setReviewsData] = useState<{ reviews: any[]; summary: any[] }>({ reviews: [], summary: [] });
  const [filterReviewRating, setFilterReviewRating] = useState<number | "semua">("semua");
  const [filterReviewProduct, setFilterReviewProduct] = useState<string>("semua");
  const [syncingReviews, setSyncingReviews] = useState(false);
  const [uploadingReviewsCSV, setUploadingReviewsCSV] = useState(false);

  const isInitialLoad = useRef(true);
  const isFetchingRef = useRef(false);
  const salesCountRef = useRef(0);
  salesCountRef.current = keuanganData.sales.length;

  // Filter Tanggal & Search
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [activeDatePreset, setActiveDatePreset] = useState<string>("semua");
  const [search, setSearch] = useState("");

  // Detail Modal ala BigSeller
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<any | null>(null);
  const [copiedOrderId, setCopiedOrderId] = useState(false);
  const [selectedReviewDetail, setSelectedReviewDetail] = useState<any | null>(null);
  const [selectedModelDetail, setSelectedModelDetail] = useState<any | null>(null);

  // Pagination Laporan Keuangan
  const [orderPage, setOrderPage] = useState(1);
  const [orderPageSize, setOrderPageSize] = useState<number>(50);

  // Pagination & Search Review
  const [reviewSearchQuery, setReviewSearchQuery] = useState("");
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewPageSize, setReviewPageSize] = useState<number>(20);

  const fetchData = useCallback(async (silent = false) => {
    // Hindari pemanggilan ganda secara bersamaan
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    // Hanya aktifkan spinner jika halaman baru pertama kali dimuat & data masih kosong
    if (!silent && isInitialLoad.current && salesCountRef.current === 0) {
      setLoading(true);
    }

    try {
      const r1 = await fetch(`/api/laporan?periode=${periode}`);
      const d1 = await r1.json();
      setData(Array.isArray(d1) ? d1 : []);

      // Fetch all data for financial reconciliation & customer reviews
      const [rSales, rRetur, rSettlement, rReviews] = await Promise.all([
        fetch("/api/penjualan-online?grouped=1"),
        fetch("/api/returns/online"),
        fetch("/api/settlement/online"),
        fetch("/api/reviews")
      ]);
      const dSales = await rSales.json();
      const dRetur = await rRetur.json();
      const dSettlement = await rSettlement.json();
      const dReviews = await rReviews.json();
      setKeuanganData({
        sales: Array.isArray(dSales) ? dSales : [],
        retur: Array.isArray(dRetur) ? dRetur : (dRetur.retur_online || []),
        settlement: dSettlement.settlement_online || []
      });
      if (dReviews && Array.isArray(dReviews.reviews)) {
        setReviewsData(dReviews);
      }
    } catch (e) {
      console.error(e);
    } finally {
      isInitialLoad.current = false;
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, [periode]);

  useEffect(() => {
    // Initial fetch
    fetchData();

    // Auto-sync settlement di background 2 detik setelah buka halaman (silent)
    const syncTimeout = setTimeout(() => {
      fetch("/api/settlement/sync", { method: "POST" })
        .then(() => fetchData(true))
        .catch(() => { });
    }, 2000);

    // Polling background tiap 60 detik (silent tanpa blink)
    const autoSyncTimer = setInterval(() => {
      fetch("/api/settlement/sync", { method: "POST" })
        .then(() => fetchData(true))
        .catch(() => { });
      fetch("/api/reviews/sync", { method: "POST" })
        .then(() => fetchData(true))
        .catch(() => { });
    }, 60_000);

    // Realtime listeners (semuanya silent in-place update)
    const unSync = subscribeRealtime(() => fetchData(true));
    const unEvent = subscribeRealtimeEvent((ev) => {
      if (
        ev === "marketplace:order_received" ||
        ev === "marketplace:order_updated" ||
        ev === "settlement_updated" ||
        ev === "reviews_updated" ||
        ev === "retur_processed" ||
        ev === "retur_online_updated" ||
        ev === "retur_banding_updated" ||
        ev === "retur_ke_stok" ||
        ev === "retur_deleted"
      ) {
        fetchData(true);
      }
    });

    return () => {
      clearTimeout(syncTimeout);
      clearInterval(autoSyncTimer);
      unSync();
      unEvent();
    };
  }, [fetchData]);

  // Handler Sinkron Settlement via API
  const handleSyncSettlementAPI = async () => {
    setSyncingSettlement(true);
    try {
      const res = await fetch("/api/settlement/sync", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal sinkron settlement");
      toast.success(`Sinkronisasi keuangan API selesai! (${json.synced || 0} data settlement diperbarui)`);
      await fetchData(true);
    } catch (e: any) {
      toast.error(e.message || "Gagal sinkron settlement API");
    } finally {
      setSyncingSettlement(false);
    }
  };

  // Presets Tanggal
  const setPresetToday = () => {
    const today = formatYMD(new Date());
    setFilterStartDate(today);
    setFilterEndDate(today);
    setActiveDatePreset("today");
  };

  const setPreset7Days = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 6);
    setFilterStartDate(formatYMD(start));
    setFilterEndDate(formatYMD(end));
    setActiveDatePreset("7d");
  };

  const setPreset30Days = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 29);
    setFilterStartDate(formatYMD(start));
    setFilterEndDate(formatYMD(end));
    setActiveDatePreset("30d");
  };

  const setPresetThisMonth = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    setFilterStartDate(formatYMD(start));
    setFilterEndDate(formatYMD(now));
    setActiveDatePreset("month");
  };

  const resetDateFilter = () => {
    setFilterStartDate("");
    setFilterEndDate("");
    setActiveDatePreset("semua");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    Papa.parse(file as any, {
      header: true,
      skipEmptyLines: true,
      complete: async (results: Papa.ParseResult<any>) => {
        const rows = (results.data || []) as any[];
        const validRows = rows.filter((r: any) => r["ID pesanan terkait"] || r["ID Pesanan/Penyesuaian"]);

        if (validRows.length === 0) {
          toast.error("Format file tidak sesuai. Pastikan Anda mengunggah file Settlement Keuangan TikTok.");
          setUploading(false);
          return;
        }

        const formatted = validRows.map((row: any) => {
          return {
            order_id: row["ID pesanan terkait"] || row["ID Pesanan/Penyesuaian"],
            jenis_transaksi: row["Jenis transaksi"] || "Pesanan",
            pendapatan_kotor: row["Total Pendapatan"] ? row["Total Pendapatan"].replace(/\D/g, '') : 0,
            biaya_komisi: row["Biaya komisi platform"] ? row["Biaya komisi platform"].replace(/[^\d-]/g, '') : 0,
            biaya_afiliasi: row["Komisi Afiliasi"] ? row["Komisi Afiliasi"].replace(/[^\d-]/g, '') : 0,
            biaya_ongkir: row["Ongkir yang ditanggung penjual"] ? row["Ongkir yang ditanggung penjual"].replace(/[^\d-]/g, '') : 0,
            biaya_lainnya: row["Total Biaya"] ? row["Total Biaya"].replace(/[^\d-]/g, '') : 0,
            penyelesaian_pembayaran: row["Jumlah penyelesaian pembayaran"] ? row["Jumlah penyelesaian pembayaran"].replace(/\D/g, '') : 0,
            tanggal_pembayaran: row["Waktu pembayaran pesanan"] || row["Waktu pemesanan"]
          };
        });

        try {
          const res = await fetch("/api/settlement/online", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formatted)
          });
          const json = await res.json();
          if (res.ok) {
            toast.success(`Berhasil memproses ${json.added + json.updated} baris data keuangan.`);
            fetchData();
          } else {
            toast.error(json.error || "Gagal menyimpan data");
          }
        } catch (err) {
          toast.error("Terjadi kesalahan saat mengupload data");
        } finally {
          setUploading(false);
          if (e.target) e.target.value = "";
        }
      }
    });
  };

  const handleSyncReviewsAPI = async () => {
    setSyncingReviews(true);
    try {
      const res = await fetch("/api/reviews/sync", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal sinkron ulasan");
      toast.success(`Sinkronisasi ulasan API selesai! (${json.synced || 0} ulasan diperbarui)`);
      await fetchData(true);
    } catch (e: any) {
      toast.error(e.message || "Gagal sinkron ulasan API");
    } finally {
      setSyncingReviews(false);
    }
  };

  const handleUploadReviewsCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingReviewsCSV(true);
    Papa.parse(file as any, {
      header: true,
      skipEmptyLines: true,
      complete: async (results: Papa.ParseResult<any>) => {
        try {
          const rows = (results.data || []) as any[];
          if (rows.length === 0) {
            toast.error("File CSV kosong atau tidak valid.");
            return;
          }

          // Pencarian nama kolom yang fleksibel (Shopee Seller Center & TikTok Shop Seller Center)
          const findCol = (row: any, candidates: string[]) => {
            const keys = Object.keys(row);
            for (const c of candidates) {
              const matched = keys.find(k => k.trim().toLowerCase() === c.toLowerCase() || k.trim().toLowerCase().includes(c.toLowerCase()));
              if (matched && row[matched] !== undefined) return row[matched];
            }
            return "";
          };

          const parsedReviews: any[] = [];
          rows.forEach((row: any) => {
            const orderId = findCol(row, ["order sn", "order id", "id pesanan", "no. pesanan", "no pesanan", "nomor pesanan", "order_id", "order_sn"]);
            const productName = findCol(row, ["nama produk", "product name", "item name", "produk", "product_name"]);
            const variation = findCol(row, ["nama variasi", "variasi", "variation", "sku name", "spesifikasi", "model name", "sub_sku"]);
            const rawRating = findCol(row, ["penilaian pembeli", "rating pembeli", "penilaian", "rating", "star", "bintang", "review star", "skor"]);
            const comment = findCol(row, ["komentar pembeli", "ulasan pembeli", "isi ulasan", "ulasan", "komentar", "review text", "review content", "feedback", "review"]);
            const buyerName = findCol(row, ["username pembeli", "nama pembeli", "buyer username", "buyer name", "customer name", "pembeli", "buyer"]);
            const createdAt = findCol(row, ["waktu penilaian", "waktu ulasan", "rating time", "review time", "tanggal", "create time", "waktu"]);

            let ratingNum = 5;
            if (rawRating) {
              const match = String(rawRating).match(/\d+/);
              if (match) ratingNum = parseInt(match[0], 10);
            }

            if (comment || productName) {
              parsedReviews.push({
                order_id: String(orderId || "").trim(),
                product_name: String(productName || "Produk Jeans").trim(),
                variation: String(variation || "-").trim(),
                marketplace: /shopee/i.test(file.name) || /shopee/i.test(JSON.stringify(row)) ? "Shopee" : "TikTok Shop",
                buyer_name: String(buyerName || "Pembeli Seller Center").trim(),
                rating: Math.min(5, Math.max(1, ratingNum)),
                comment: String(comment || "Produk memuaskan.").trim(),
                created_at: createdAt ? new Date(createdAt).toISOString() : new Date().toISOString()
              });
            }
          });

          if (parsedReviews.length === 0) {
            toast.error("Format file tidak cocok. Pastikan Anda mengunggah file ekspor ulasan dari Shopee / TikTok Seller Center.");
            return;
          }

          const res = await fetch("/api/reviews", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "bulk_import", reviews: parsedReviews })
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || "Gagal mengimpor ulasan");
          toast.success(`Berhasil mengimpor ${json.imported || parsedReviews.length} ulasan dari Seller Center!`);
          await fetchData(true);
        } catch (err: any) {
          toast.error(err.message || "Gagal memproses file CSV");
        } finally {
          setUploadingReviewsCSV(false);
          if (e.target) e.target.value = "";
        }
      }
    });
  };

  // Kalkulasi Rekonsiliasi Keuangan (di-memoize agar tidak menghitung ulang saat render berulang)
  const { unifiedOrders, filteredOrders, totals } = useMemo(() => {
    const settlementMap = new Map<string, any>();
    keuanganData.settlement.forEach(s => {
      if (!settlementMap.has(s.order_id)) {
        settlementMap.set(s.order_id, { ...s });
      } else {
        const existing = settlementMap.get(s.order_id);
        existing.penyelesaian_pembayaran += Number(s.penyelesaian_pembayaran || 0);
        existing.biaya_komisi += Number(s.biaya_komisi || 0);
        existing.biaya_afiliasi += Number(s.biaya_afiliasi || 0);
        existing.biaya_ongkir += Number(s.biaya_ongkir || 0);
        existing.biaya_lainnya += Number(s.biaya_lainnya || 0);
      }
    });

    const returMap = new Map<string, any>();
    keuanganData.retur.forEach(r => returMap.set(r.order_id, r));

    // Build unified order table
    const orders = keuanganData.sales
      .filter(sale => sale.order_id && !String(sale.order_id).includes("Platform unique"))
      .map(sale => {
        const retursList = sale.returs || [];
        const returScan = retursList[0];
        const isRetur = returMap.has(sale.order_id) || !!returScan;
        const returData = returMap.has(sale.order_id) ? returMap.get(sale.order_id) : null;
        const settleData = settlementMap.get(sale.order_id);

        const danaBanding = retursList.reduce((s: number, r: any) => s + Number(r.dana_diterima || 0), 0);
        const omzetKotor = Number(sale.total_amount ?? sale.order_amount ?? 0);

        const biayaKomisi = settleData ? Number(settleData.biaya_komisi || 0) : 0;
        const biayaAfiliasi = settleData ? Number(settleData.biaya_afiliasi || 0) : 0;
        const biayaOngkir = settleData ? Number(settleData.biaya_ongkir || 0) : 0;
        const biayaLainnya = settleData ? Number(settleData.biaya_lainnya || 0) : 0;
        const potonganRinci = (biayaKomisi + biayaAfiliasi + biayaOngkir + biayaLainnya);
        const selisihNominal = settleData && omzetKotor > Number(settleData.penyelesaian_pembayaran || 0)
          ? (omzetKotor - Number(settleData.penyelesaian_pembayaran || 0))
          : 0;
        const totalPotongan = settleData
          ? Math.max(potonganRinci, selisihNominal)
          : 0;

        // Jika ada selisih potongan tapi rincian komisi 0 (biasa pada Shopee sandbox test order), atribusikan ke komisi/layanan platform
        const displayKomisi = biayaKomisi > 0 ? biayaKomisi : (totalPotongan > 0 && potonganRinci === 0 ? totalPotongan : 0);

        const isSudahCair = Boolean(settleData && Number(settleData.penyelesaian_pembayaran) > 0);
        const labaBersih = settleData
          ? Number(settleData.penyelesaian_pembayaran || 0) + danaBanding
          : isRetur
            ? danaBanding
            : omzetKotor;

        const statusPencairan = isRetur
          ? "RETUR / BATAL"
          : isSudahCair
            ? "SUDAH CAIR"
            : "MENUNGGU CAIR (ESCROW)";

        const items = sale.items || [];
        const totalQty = items.length ? items.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 1), 0) : Number(sale.quantity || 1);

        // Rincian potongan spesifik BigSeller / Shopee Seller Center
        const adminShopee = displayKomisi;
        const affiliateShopee = biayaAfiliasi;
        const ongkirToko = biayaOngkir;
        // Selisih antara totalPotongan dan (admin + afiliasi + ongkir) adalah Biaya Layanan Gratis Ongkir Xtra / Layanan Transaksi
        const layananGratisOngkir = settleData?.biaya_layanan != null
          ? Number(settleData.biaya_layanan)
          : Math.max(0, totalPotongan - (adminShopee + affiliateShopee + ongkirToko));
        const biayaTransaksi = settleData?.biaya_transaksi != null ? Number(settleData.biaya_transaksi) : 0;
        const voucherPenjual = settleData?.voucher_penjual != null ? Number(settleData.voucher_penjual) : 0;

        // Estimasi HPP Konveksi: ~Rp 64.750 per pcs celana jeans
        const hppPerPcs = 64750;
        const estimasiHPP = totalQty * hppPerPcs;
        const profitKonveksi = isSudahCair ? Math.max(0, labaBersih - estimasiHPP) : 0;
        const marginKonveksiPct = labaBersih > 0 ? Math.round((profitKonveksi / labaBersih) * 100) : 0;

        return {
          order_id: sale.order_id,
          marketplace: sale.marketplace || (/^\d{6}[A-Z0-9]{6,}$/i.test(sale.order_id) ? "Shopee" : "TikTok Shop"),
          product: items.length ? items.map((i: any) => i.product_name).join(", ") : sale.product_name,
          variation: items.length ? items.map((i: any) => i.variation).filter(Boolean).join(", ") : sale.variation,
          total_qty: totalQty,
          tanggal: sale.tanggal_pesanan,
          isRetur,
          isSudahCair,
          statusPencairan,
          danaBanding,
          statusRetur: returScan
            ? returScan.status === "Kembali ke Stok" || returScan.status === "Dipindah ke Stok"
              ? "RETUR · KEMBALI KE STOK"
              : `BANDING · ${String(returScan.status || "").toUpperCase()}`
            : returData?.return_type
              ? `RETUR / ${String(returData.return_type).toUpperCase()}`
              : "RETUR / BATAL",
          omzetKotor,
          biayaKomisi: displayKomisi,
          biayaAfiliasi,
          biayaOngkir,
          biayaLainnya,
          totalPotongan,
          labaBersih,
          settleData,
          rawSale: sale,
          items: items.length ? items : [{ product_name: sale.product_name, variation: sale.variation, quantity: totalQty, unit_price: omzetKotor }],
          breakdown: {
            hargaProduk: omzetKotor,
            adminShopee,
            layananGratisOngkir,
            biayaTransaksi,
            affiliateShopee,
            ongkirToko,
            voucherPenjual,
            totalPotongan,
            pencairanBersih: isSudahCair ? labaBersih : 0,
            estimasiHPP,
            profitKonveksi,
            marginKonveksiPct,
          }
        };
      })
      .sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());

    // Filter berdasarkan Rentang Tanggal & Search
    const filtered = orders.filter((o) => {
      if (filterStartDate || filterEndDate) {
        const orderDate = parseOrderDate(o.tanggal);
        if (!orderDate) return false;

        if (filterStartDate) {
          const [sy, sm, sd] = filterStartDate.split("-").map(Number);
          const startLimit = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
          if (orderDate < startLimit) return false;
        }

        if (filterEndDate) {
          const [ey, em, ed] = filterEndDate.split("-").map(Number);
          const endLimit = new Date(ey, em - 1, ed, 23, 59, 59, 999);
          if (orderDate > endLimit) return false;
        }
      }

      if (search.trim()) {
        const q = search.toLowerCase();
        const match =
          o.order_id?.toLowerCase().includes(q) ||
          o.product?.toLowerCase().includes(q) ||
          o.variation?.toLowerCase().includes(q) ||
          o.marketplace?.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });

    const tot = {
      totalOmzetKotor: filtered.reduce((s, o) => s + o.omzetKotor, 0),
      totalSudahCair: filtered.reduce((s, o) => s + (o.isSudahCair ? o.labaBersih : 0), 0),
      totalMenungguCair: filtered.reduce((s, o) => s + (!o.isRetur && !o.isSudahCair ? o.omzetKotor : 0), 0),
      totalBiayaKomisi: filtered.reduce((s, o) => s + o.biayaKomisi, 0),
      totalBiayaAfiliasi: filtered.reduce((s, o) => s + o.biayaAfiliasi, 0),
      totalBiayaOngkir: filtered.reduce((s, o) => s + o.biayaOngkir, 0),
      totalPotongan: filtered.reduce((s, o) => s + o.totalPotongan, 0),
      totalReturLoss: filtered.reduce((s, o) => s + (o.isRetur ? Math.max(0, o.omzetKotor - o.danaBanding) : 0), 0),
    };

    return { unifiedOrders: orders, filteredOrders: filtered, totals: tot };
  }, [keuanganData, filterStartDate, filterEndDate, search]);


  const {
    totalOmzetKotor,
    totalSudahCair,
    totalMenungguCair,
    totalBiayaKomisi,
    totalBiayaAfiliasi,
    totalBiayaOngkir,
    totalPotongan,
    totalReturLoss
  } = totals;

  // Pagination & Display Laporan Keuangan
  const paginatedOrders = useMemo(() => {
    if (orderPageSize === -1) return filteredOrders;
    const start = (orderPage - 1) * orderPageSize;
    return filteredOrders.slice(start, start + orderPageSize);
  }, [filteredOrders, orderPage, orderPageSize]);

  const totalOrderPages = orderPageSize === -1 ? 1 : Math.max(1, Math.ceil(filteredOrders.length / orderPageSize));

  // Export 1-Klik ke Excel / CSV
  const handleExportCSV = () => {
    if (filteredOrders.length === 0) {
      toast.error("Tidak ada data untuk diekspor pada rentang tanggal ini.");
      return;
    }
    const rows = filteredOrders.map((o, idx) => ({
      "No": idx + 1,
      "Order ID": o.order_id,
      "Tanggal Pesanan": o.tanggal || "-",
      "Marketplace": o.marketplace || "-",
      "Produk": o.product || "-",
      "Variasi": o.variation || "-",
      "Qty": o.total_qty || 1,
      "Status Penjualan": o.isRetur ? o.statusRetur : "Selesai",
      "Status Pencairan": o.statusPencairan,
      "Omzet Kotor (Rp)": o.omzetKotor,
      "Komisi Platform (Rp)": o.biayaKomisi,
      "Komisi Afiliasi (Rp)": o.biayaAfiliasi,
      "Ongkir Penjual (Rp)": o.biayaOngkir,
      "Biaya Layanan/Lainnya (Rp)": o.biayaLainnya,
      "Total Seluruh Potongan (Rp)": o.totalPotongan,
      "Pencairan Bersih (Rp)": o.isSudahCair ? o.labaBersih : 0,
      "Waktu Settlement": o.settleData?.tanggal_pembayaran || "-"
    }));

    const csv = Papa.unparse(rows);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Laporan_Keuangan_vrSurft_${filterStartDate || "Semua"}_sd_${filterEndDate || "Semua"}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Berhasil mengekspor ${rows.length} baris data laporan keuangan!`);
  };

  // Review & Rating Memoizations (Hanya review murni organik dari API / CSV Seller Center)
  const DUMMY_BUYER_NAMES = useMemo(() => new Set([
    "anita_lestari_92",
    "siti_nurhaliza_b",
    "rina_wahyuni77",
    "clarissa_putri_fashion",
    "dian_permata_sari",
    "mutia_ramadhani"
  ]), []);

  const cleanOrganicReviews = useMemo(() => {
    return (reviewsData.reviews || []).filter((r: any) => !DUMMY_BUYER_NAMES.has(r.buyer_name));
  }, [reviewsData.reviews, DUMMY_BUYER_NAMES]);

  const cleanOrganicSummary = useMemo(() => {
    if (cleanOrganicReviews.length === 0) return [];
    const statsMap = new Map<string, any>();
    cleanOrganicReviews.forEach((r: any) => {
      const pName = r.product_name || "Produk Jeans";
      if (!statsMap.has(pName)) {
        statsMap.set(pName, {
          product_name: pName,
          total_reviews: 0,
          average_rating: 0,
          rating_sum: 0,
          star_5: 0,
          star_4: 0,
          star_3: 0,
          star_2: 0,
          star_1: 0,
          positive_tags: [],
          recommendation: "SANGAT DIREKOMENDASIKAN REPEAT PO",
          notes: "Kepuasan pembeli sangat tinggi. Pola, jahitan, dan bahan terbukti disukai pasar. Prioritaskan buat SPK potong & jahit lagi."
        });
      }
      const st = statsMap.get(pName);
      st.total_reviews += 1;
      const rating = Math.min(5, Math.max(1, Math.round(Number(r.rating || 5))));
      st.rating_sum += rating;
      if (rating === 5) st.star_5 = (st.star_5 || 0) + 1;
      else if (rating === 4) st.star_4 = (st.star_4 || 0) + 1;
      else if (rating === 3) st.star_3 = (st.star_3 || 0) + 1;
      else if (rating === 2) st.star_2 = (st.star_2 || 0) + 1;
      else st.star_1 = (st.star_1 || 0) + 1;
      if (Array.isArray(r.tags)) {
        r.tags.forEach((t: string) => {
          if (!st.positive_tags.includes(t) && st.positive_tags.length < 5) st.positive_tags.push(t);
        });
      }
    });
    return Array.from(statsMap.values()).map(st => {
      st.average_rating = Number((st.rating_sum / st.total_reviews).toFixed(1));
      if (st.average_rating >= 4.5) {
        st.recommendation = "SANGAT DIREKOMENDASIKAN REPEAT PO";
        st.notes = "Kepuasan pembeli sangat tinggi. Pola, jahitan, dan bahan terbukti disukai pasar. Prioritaskan buat SPK potong & jahit lagi.";
      } else if (st.average_rating >= 3.8) {
        st.recommendation = "PERLU EVALUASI POLA";
        st.notes = "Ada masukan terkait ukuran atau panjang celana. Disarankan konsultasi dengan tukang potong sebelum repeat batch besar.";
      } else {
        st.recommendation = "STOP PRODUKSI";
        st.notes = "Rating rendah / komplain pembeli tinggi. Hentikan produksi ulang model ini untuk menghindari retur tinggi.";
      }
      return st;
    });
  }, [cleanOrganicReviews]);

  const displayedReviews = useMemo(() => {
    return cleanOrganicReviews.filter((r: any) => {
      if (filterReviewRating !== "semua" && Number(r.rating) !== Number(filterReviewRating)) return false;
      if (filterReviewProduct !== "semua" && r.product_name !== filterReviewProduct) return false;
      if (reviewSearchQuery.trim()) {
        const q = reviewSearchQuery.toLowerCase();
        const m = (r.comment || "").toLowerCase().includes(q) ||
          (r.buyer_name || "").toLowerCase().includes(q) ||
          (r.product_name || "").toLowerCase().includes(q) ||
          (r.variation || "").toLowerCase().includes(q);
        if (!m) return false;
      }
      return true;
    });
  }, [cleanOrganicReviews, filterReviewRating, filterReviewProduct, reviewSearchQuery]);

  const paginatedReviews = useMemo(() => {
    if (reviewPageSize === -1) return displayedReviews;
    const start = (reviewPage - 1) * reviewPageSize;
    return displayedReviews.slice(start, start + reviewPageSize);
  }, [displayedReviews, reviewPage, reviewPageSize]);

  const totalReviewPages = reviewPageSize === -1 ? 1 : Math.max(1, Math.ceil(displayedReviews.length / reviewPageSize));

  const avgOverallRating = useMemo(() => {
    if (!cleanOrganicReviews.length) return 5;
    const sum = cleanOrganicReviews.reduce((s: number, r: any) => s + (Number(r.rating) || 5), 0);
    return sum / cleanOrganicReviews.length;
  }, [cleanOrganicReviews]);

  const recommendedCount = useMemo(() => {
    return cleanOrganicSummary.filter((s: any) => s.average_rating >= 4.5).length;
  }, [cleanOrganicSummary]);

  const totalPO = data.reduce((s, d) => s + (d.total_po ?? 0), 0);
  const totalRetail = data.reduce((s, d) => s + (d.total_retail ?? 0), 0);
  const totalAll = totalPO + totalRetail;

  return (
    <>
      <style>{`
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 99px; }
        .table-row-hover:hover { background: #F8FAFC; }
        html, body { overflow: hidden; height: 100%; }
        .app-content { overflow: hidden !important; height: 100vh !important; padding-bottom: 0 !important; }
        .laporan-root {
          height: 100vh !important;
          max-height: 100vh !important;
          padding-bottom: 0 !important;
          overflow: hidden !important;
        }
      `}</style>

      <div className="laporan-root" style={{ display: "flex", flexDirection: "column", height: "100vh", maxHeight: "100vh", background: "#F1F5F9", overflow: "hidden", boxSizing: "border-box" }}>

        {/* Fixed Header */}
        <div style={{ padding: "14px 28px", background: "white", borderBottom: "1px solid #E2E8F0", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 21, fontWeight: 900, color: "#0F172A", margin: "0 0 2px 0" }}>Laporan Penjualan</h1>
            <p style={{ fontSize: 12, color: "#64748B", margin: 0 }}>Analisis pesanan, komisi afiliasi, potongan platform, dan rekonsiliasi pencairan dana.</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {activeTab === "keuangan" && (
              <>
                <button
                  type="button"
                  onClick={handleSyncSettlementAPI}
                  disabled={syncingSettlement}
                  style={{
                    background: "#3B82F6",
                    color: "white",
                    padding: "9px 15px",
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 800,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    border: "none",
                    cursor: syncingSettlement ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 10px rgba(59,130,246,0.25)",
                    opacity: syncingSettlement ? 0.7 : 1
                  }}
                >
                  <RefreshCw size={15} className={syncingSettlement ? "animate-spin" : ""} />
                  {syncingSettlement ? "Menyinkronkan API..." : "Sinkron Keuangan API"}
                </button>

                <button
                  type="button"
                  onClick={handleExportCSV}
                  style={{
                    background: "#10B981",
                    color: "white",
                    padding: "9px 15px",
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 800,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    border: "none",
                    cursor: "pointer",
                    boxShadow: "0 4px 10px rgba(16,185,129,0.25)"
                  }}
                >
                  <Download size={15} />
                  Export Excel / CSV (1-Klik)
                </button>

                <label style={{ background: "white", color: "#334155", border: "1px solid #CBD5E1", padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6, cursor: uploading ? "not-allowed" : "pointer", opacity: uploading ? 0.7 : 1 }}>
                  <UploadCloud size={15} />
                  {uploading ? "Memproses..." : "Upload CSV TikTok"}
                  <input type="file" accept=".csv" onChange={handleFileUpload} disabled={uploading} style={{ display: "none" }} />
                </label>
              </>
            )}

            {activeTab === "review" && (
              <>
                <button
                  type="button"
                  onClick={handleSyncReviewsAPI}
                  disabled={syncingReviews}
                  style={{
                    background: "#3B82F6",
                    color: "white",
                    padding: "9px 15px",
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 800,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    border: "none",
                    cursor: syncingReviews ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 10px rgba(59,130,246,0.25)",
                    opacity: syncingReviews ? 0.7 : 1
                  }}
                >
                  <RefreshCw size={15} className={syncingReviews ? "animate-spin" : ""} />
                  {syncingReviews ? "Menyinkronkan API..." : "Sinkron Ulasan API"}
                </button>

                <label style={{
                  background: "white",
                  color: "#334155",
                  border: "1px solid #CBD5E1",
                  padding: "8px 14px",
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: uploadingReviewsCSV ? "not-allowed" : "pointer",
                  opacity: uploadingReviewsCSV ? 0.7 : 1,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
                }}>
                  <UploadCloud size={15} color="#059669" />
                  {uploadingReviewsCSV ? "Mengimpor CSV..." : "Upload CSV Ulasan Seller Center"}
                  <input type="file" accept=".csv" onChange={handleUploadReviewsCSV} disabled={uploadingReviewsCSV} style={{ display: "none" }} />
                </label>
              </>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ padding: "0 28px", background: "white", borderBottom: "1px solid #E2E8F0", display: "flex", gap: 28, flexShrink: 0 }}>
          <div
            onClick={() => setActiveTab("keuangan")}
            style={{ padding: "10px 0", cursor: "pointer", borderBottom: activeTab === "keuangan" ? "3px solid #2563EB" : "3px solid transparent", color: activeTab === "keuangan" ? "#2563EB" : "#64748B", fontWeight: 800, fontSize: 13, display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s" }}
          >
            <Calculator size={16} /> Rekonsiliasi Keuangan & Settlement
          </div>
          <div
            onClick={() => setActiveTab("produk")}
            style={{ padding: "10px 0", cursor: "pointer", borderBottom: activeTab === "produk" ? "3px solid #2563EB" : "3px solid transparent", color: activeTab === "produk" ? "#2563EB" : "#64748B", fontWeight: 800, fontSize: 13, display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s" }}
          >
            <PieChart size={16} /> Analisis Kategori & PO
          </div>
          <div
            onClick={() => setActiveTab("review")}
            style={{ padding: "10px 0", cursor: "pointer", borderBottom: activeTab === "review" ? "3px solid #2563EB" : "3px solid transparent", color: activeTab === "review" ? "#2563EB" : "#64748B", fontWeight: 800, fontSize: 13, display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s" }}
          >
            <Star size={16} fill={activeTab === "review" ? "#F59E0B" : "none"} color={activeTab === "review" ? "#F59E0B" : "#64748B"} /> Review & Rating Produk (Acuan Repeat PO)
          </div>
        </div>

        {/* Toolbar Filter Rentang Tanggal (Khusus Tab Keuangan) */}
        {activeTab === "keuangan" && (
          <div style={{ padding: "8px 28px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", flexShrink: 0, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, color: "#334155" }}>
                <CalendarDays size={16} color="#3B82F6" />
                <span>Rentang Tanggal:</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", background: "white", border: "1px solid #CBD5E1", borderRadius: 8, padding: "4px 8px" }}>
                <span style={{ fontSize: 11, color: "#94A3B8", marginRight: 6, fontWeight: 700 }}>Dari</span>
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => { setFilterStartDate(e.target.value); setActiveDatePreset("custom"); }}
                  style={{ border: "none", outline: "none", fontSize: 12, fontWeight: 600, color: "#0F172A", background: "transparent", cursor: "pointer" }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", background: "white", border: "1px solid #CBD5E1", borderRadius: 8, padding: "4px 8px" }}>
                <span style={{ fontSize: 11, color: "#94A3B8", marginRight: 6, fontWeight: 700 }}>Sampai</span>
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => { setFilterEndDate(e.target.value); setActiveDatePreset("custom"); }}
                  style={{ border: "none", outline: "none", fontSize: 12, fontWeight: 600, color: "#0F172A", background: "transparent", cursor: "pointer" }}
                />
              </div>

              {/* Quick Preset Buttons */}
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 2 }}>
                {[
                  { id: "today", label: "Hari Ini", action: setPresetToday },
                  { id: "7d", label: "7 Hari", action: setPreset7Days },
                  { id: "30d", label: "30 Hari", action: setPreset30Days },
                  { id: "month", label: "Bulan Ini", action: setPresetThisMonth }
                ].map(preset => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={preset.action}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      border: activeDatePreset === preset.id ? "1px solid #3B82F6" : "1px solid #E2E8F0",
                      background: activeDatePreset === preset.id ? "#EFF6FF" : "white",
                      color: activeDatePreset === preset.id ? "#1D4ED8" : "#64748B",
                      transition: "all 0.15s"
                    }}
                  >
                    {preset.label}
                  </button>
                ))}

                {(filterStartDate || filterEndDate) && (
                  <button
                    type="button"
                    onClick={resetDateFilter}
                    title="Reset rentang tanggal"
                    style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      border: "1px solid #FECACA",
                      background: "#FEF2F2",
                      color: "#DC2626",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 3
                    }}
                  >
                    <X size={12} /> Reset Tanggal
                  </button>
                )}
              </div>
            </div>

            {/* Search Input */}
            <div style={{ display: "flex", alignItems: "center", background: "white", border: "1px solid #CBD5E1", borderRadius: 8, padding: "0 10px", minWidth: 220 }}>
              <Search size={14} color="#94A3B8" />
              <input
                type="text"
                placeholder="Cari Order ID, Produk..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ padding: "6px 8px", border: "none", outline: "none", fontSize: 12, color: "#0F172A", background: "transparent", width: "100%" }}
              />
            </div>
          </div>
        )}

        {activeTab === "keuangan" ? (
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Financial Dashboard - 6 Cards Grid (Fixed, Compact) */}
            <div style={{ padding: "10px 28px 0 28px", flexShrink: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
              {/* 1. Omzet Kotor */}
              <div style={{ background: "white", borderRadius: 12, padding: "10px 14px", border: "1px solid #E2E8F0", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 }}>Omzet Kotor (Gross)</span>
                  <div style={{ width: 26, height: 26, borderRadius: 6, background: "#EFF6FF", color: "#3B82F6", display: "flex", alignItems: "center", justifyContent: "center" }}><ShoppingBag size={14} /></div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#0F172A" }}>Rp {totalOmzetKotor.toLocaleString("id-ID")}</div>
                <div style={{ fontSize: 10, color: "#64748B", marginTop: 2 }}>Nilai belanja kotor dari pembeli</div>
              </div>

              {/* 2. Menunggu Cair (Escrow) */}
              <div style={{ background: "white", borderRadius: 12, padding: "10px 14px", border: "1px solid #FED7AA", boxShadow: "0 2px 6px rgba(249,115,22,0.03)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: "#D97706", textTransform: "uppercase", letterSpacing: 0.5 }}>Menunggu Cair (Escrow)</span>
                  <div style={{ width: 26, height: 26, borderRadius: 6, background: "#FFFBEB", color: "#F59E0B", display: "flex", alignItems: "center", justifyContent: "center" }}><Clock size={14} /></div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#D97706" }}>Rp {totalMenungguCair.toLocaleString("id-ID")}</div>
                <div style={{ fontSize: 10, color: "#B45309", marginTop: 2 }}>Paket di kurir / belum konfirmasi</div>
              </div>

              {/* 3. Pencairan Bersih (Sudah Cair) */}
              <div style={{ background: "white", borderRadius: 12, padding: "10px 14px", border: "2px solid #10B981", boxShadow: "0 2px 6px rgba(16,185,129,0.08)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: "#059669", textTransform: "uppercase", letterSpacing: 0.5 }}>Pencairan Bersih (Cair)</span>
                  <div style={{ width: 26, height: 26, borderRadius: 6, background: "#ECFDF5", color: "#10B981", display: "flex", alignItems: "center", justifyContent: "center" }}><Wallet size={14} /></div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#10B981" }}>Rp {totalSudahCair.toLocaleString("id-ID")}</div>
                <div style={{ fontSize: 10, color: "#047857", marginTop: 2 }}>Uang bersih resmi masuk rekening</div>
              </div>

              {/* 4. Komisi Afiliasi */}
              <div style={{ background: "white", borderRadius: 12, padding: "10px 14px", border: "1px solid #E2E8F0", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: "#8B5CF6", textTransform: "uppercase", letterSpacing: 0.5 }}>Komisi Afiliasi (AMS)</span>
                  <div style={{ width: 26, height: 26, borderRadius: 6, background: "#F5F3FF", color: "#8B5CF6", display: "flex", alignItems: "center", justifyContent: "center" }}><Users size={14} /></div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, color: totalBiayaAfiliasi > 0 ? "#8B5CF6" : "#64748B" }}>
                  {totalBiayaAfiliasi > 0 ? `-Rp ${totalBiayaAfiliasi.toLocaleString("id-ID")}` : "Rp 0"}
                </div>
                <div style={{ fontSize: 10, color: "#64748B", marginTop: 2 }}>Fee konten kreator / affiliate</div>
              </div>

              {/* 5. Potongan Platform & Ongkir */}
              <div style={{ background: "white", borderRadius: 12, padding: "10px 14px", border: "1px solid #E2E8F0", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 }}>Potongan Platform</span>
                  <div style={{ width: 26, height: 26, borderRadius: 6, background: "#FFFBEB", color: "#F59E0B", display: "flex", alignItems: "center", justifyContent: "center" }}><CreditCard size={14} /></div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, color: totalPotongan > 0 ? "#F59E0B" : "#64748B" }}>
                  {totalPotongan > 0 ? `-Rp ${totalPotongan.toLocaleString("id-ID")}` : "Rp 0"}
                </div>
                <div style={{ fontSize: 10, color: "#64748B", marginTop: 2 }}>Komisi marketplace, layanan &amp; ongkir</div>
              </div>

              {/* 6. Kerugian Batal / Retur */}
              <div style={{ background: "white", borderRadius: 12, padding: "10px 14px", border: "1px solid #E2E8F0", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: "#EF4444", textTransform: "uppercase", letterSpacing: 0.5 }}>Kerugian Batal / Retur</span>
                  <div style={{ width: 26, height: 26, borderRadius: 6, background: "#FEF2F2", color: "#EF4444", display: "flex", alignItems: "center", justifyContent: "center" }}><FileX size={14} /></div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, color: totalReturLoss > 0 ? "#EF4444" : "#64748B" }}>
                  {totalReturLoss > 0 ? `-Rp ${totalReturLoss.toLocaleString("id-ID")}` : "Rp 0"}
                </div>
                <div style={{ fontSize: 10, color: "#64748B", marginTop: 2 }}>Dana refund / batal tanpa banding</div>
              </div>
            </div>

            {/* Table Area (Fills remaining height downwards, scrolling ONLY table rows) */}
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: "10px 28px 12px 28px", overflow: "hidden" }}>
              <div style={{ flex: 1, minHeight: 0, background: "white", borderRadius: 14, border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "10px 18px", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                  <div>
                    <h2 style={{ fontSize: 14, fontWeight: 800, color: "#0F172A", margin: 0 }}>Detail Rekonsiliasi Per Pesanan</h2>
                    <p style={{ fontSize: 11.5, color: "#64748B", margin: 0 }}>
                      Menampilkan <b>{filteredOrders.length}</b> pesanan
                      {(filterStartDate || filterEndDate || search) && (
                        <span style={{ color: "#3B82F6", marginLeft: 6 }}>(difilter dari {unifiedOrders.length} total)</span>
                      )}
                    </p>
                  </div>
                </div>

                <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                    <thead style={{ background: "#F8FAFC", position: "sticky", top: 0, zIndex: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                      <tr>
                        <th style={{ padding: "10px 14px", fontSize: 11, fontWeight: 800, color: "#475569", textTransform: "uppercase", borderBottom: "2px solid #E2E8F0" }}>Order ID &amp; Waktu</th>
                        <th style={{ padding: "10px 14px", fontSize: 11, fontWeight: 800, color: "#475569", textTransform: "uppercase", borderBottom: "2px solid #E2E8F0" }}>Produk &amp; Qty</th>
                        <th style={{ padding: "10px 14px", fontSize: 11, fontWeight: 800, color: "#475569", textTransform: "uppercase", borderBottom: "2px solid #E2E8F0" }}>Status Pencairan</th>
                        <th style={{ padding: "10px 14px", fontSize: 11, fontWeight: 800, color: "#475569", textTransform: "uppercase", borderBottom: "2px solid #E2E8F0", textAlign: "right" }}>Omzet Kotor</th>
                        <th style={{ padding: "10px 14px", fontSize: 11, fontWeight: 800, color: "#475569", textTransform: "uppercase", borderBottom: "2px solid #E2E8F0", textAlign: "right" }}>Komisi Platform</th>
                        <th style={{ padding: "10px 14px", fontSize: 11, fontWeight: 800, color: "#475569", textTransform: "uppercase", borderBottom: "2px solid #E2E8F0", textAlign: "right" }}>Komisi Afiliasi</th>
                        <th style={{ padding: "10px 14px", fontSize: 11, fontWeight: 800, color: "#475569", textTransform: "uppercase", borderBottom: "2px solid #E2E8F0", textAlign: "right" }}>Ongkir Toko</th>
                        <th style={{ padding: "10px 14px", fontSize: 11, fontWeight: 800, color: "#475569", textTransform: "uppercase", borderBottom: "2px solid #E2E8F0", textAlign: "right" }}>Total Potongan</th>
                        <th style={{ padding: "10px 14px", fontSize: 11, fontWeight: 800, color: "#475569", textTransform: "uppercase", borderBottom: "2px solid #E2E8F0", textAlign: "right" }}>Pencairan Bersih</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading && filteredOrders.length === 0 ? (
                        <tr><td colSpan={9} style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontWeight: 600 }}> Memuat data rekonsiliasi...</td></tr>
                      ) : filteredOrders.length === 0 ? (
                        <tr>
                          <td colSpan={9} style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>
                            Belum ada data pesanan yang sesuai dengan rentang tanggal ini.
                          </td>
                        </tr>
                      ) : (
                        paginatedOrders.map((o, i) => (
                          <tr
                            key={o.order_id || i}
                            onClick={() => setSelectedOrderDetail(o)}
                            className="table-row-hover"
                            style={{
                              borderBottom: "1px solid #F1F5F9",
                              background: o.isRetur ? "#FEF2F2" : "transparent",
                              cursor: "pointer",
                              transition: "background 0.15s ease",
                            }}
                            title="Klik baris ini untuk melihat rincian potongan marketplace & pencairan bersih ala BigSeller"
                          >
                            {/* 1. Order ID & Waktu */}
                            <td style={{ padding: "10px 14px", maxWidth: 220 }}>
                              <div style={{ fontWeight: 800, fontSize: 12.5, color: "#0F172A", fontFamily: "monospace", display: "flex", alignItems: "center", gap: 6 }}>
                                {o.order_id}
                                <span style={{
                                  fontSize: 9, fontWeight: 800, padding: "1px 5px", borderRadius: 4,
                                  background: o.marketplace === "Shopee" ? "#FFEDD5" : "#EFF6FF",
                                  color: o.marketplace === "Shopee" ? "#C2410C" : "#1D4ED8",
                                  border: o.marketplace === "Shopee" ? "1px solid #FED7AA" : "1px solid #BFDBFE"
                                }}>
                                  {o.marketplace}
                                </span>
                              </div>
                              <div style={{ fontSize: 11, color: "#64748B", marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                                <Calendar size={11} /> {o.tanggal || "-"}
                              </div>
                            </td>

                            {/* 2. Produk & Qty */}
                            <td style={{ padding: "10px 14px", maxWidth: 240 }}>
                              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#1E293B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {o.product || "-"}
                              </div>
                              <div style={{ fontSize: 11, color: "#64748B", marginTop: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span>{o.variation ? `${o.variation} · ` : ""}<b>x{o.total_qty || 1} pcs</b></span>
                                <span style={{ fontSize: 10, color: "#2563EB", fontWeight: 700 }}>Detail ↗</span>
                              </div>
                            </td>

                            {/* 3. Status Pencairan */}
                            <td style={{ padding: "10px 14px" }}>
                              {o.isRetur ? (
                                <span style={{ padding: "2px 7px", borderRadius: 5, fontSize: 10, fontWeight: 800, background: "#FEE2E2", color: "#DC2626", border: "1px solid #FECACA" }}>
                                  {o.statusRetur || "RETUR / BATAL"}
                                </span>
                              ) : o.isSudahCair ? (
                                <span style={{ padding: "2px 7px", borderRadius: 5, fontSize: 10, fontWeight: 800, background: "#ECFDF5", color: "#047857", border: "1px solid #A7F3D0", display: "inline-flex", alignItems: "center", gap: 4 }}>
                                  <CheckCircle2 size={11} /> SUDAH CAIR
                                </span>
                              ) : (
                                <span style={{ padding: "2px 7px", borderRadius: 5, fontSize: 10, fontWeight: 800, background: "#FFFBEB", color: "#B45309", border: "1px solid #FDE68A", display: "inline-flex", alignItems: "center", gap: 4 }}>
                                  <Clock size={11} /> MENUNGGU CAIR
                                </span>
                              )}
                            </td>

                            {/* 4. Omzet Kotor */}
                            <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 800, color: "#0F172A", fontSize: 13 }}>
                              Rp {o.omzetKotor.toLocaleString("id-ID")}
                            </td>

                            {/* 5. Komisi Platform */}
                            <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: o.biayaKomisi > 0 ? "#F59E0B" : "#94A3B8", fontSize: 12 }}>
                              {o.biayaKomisi > 0 ? `-Rp ${o.biayaKomisi.toLocaleString("id-ID")}` : "-"}
                            </td>

                            {/* 6. Komisi Afiliasi */}
                            <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: o.biayaAfiliasi > 0 ? "#8B5CF6" : "#94A3B8", fontSize: 12 }}>
                              {o.biayaAfiliasi > 0 ? `-Rp ${o.biayaAfiliasi.toLocaleString("id-ID")}` : "-"}
                            </td>

                            {/* 7. Ongkir Toko */}
                            <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: o.biayaOngkir > 0 ? "#EA580C" : "#94A3B8", fontSize: 12 }}>
                              {o.biayaOngkir > 0 ? `-Rp ${o.biayaOngkir.toLocaleString("id-ID")}` : "-"}
                            </td>

                            {/* 8. Total Potongan */}
                            <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 800, fontSize: 12 }}>
                              {o.isSudahCair ? (
                                o.totalPotongan > 0 ? (
                                  <span style={{ color: "#DC2626" }}>-Rp {o.totalPotongan.toLocaleString("id-ID")}</span>
                                ) : (
                                  <span style={{ color: "#059669" }}>Rp 0</span>
                                )
                              ) : (
                                <span style={{ color: "#94A3B8" }}>Belum Settlement</span>
                              )}
                            </td>

                            {/* 9. Pencairan Bersih */}
                            <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 900, color: o.isSudahCair ? "#10B981" : "#D97706", fontSize: 13.5 }}>
                              Rp {(o.isSudahCair ? o.labaBersih : o.omzetKotor).toLocaleString("id-ID")}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls Laporan Keuangan */}
                <div style={{ padding: "8px 18px", background: "#F8FAFC", borderTop: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, flexShrink: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "#64748B" }}>
                    <span>Tampilkan:</span>
                    <select
                      value={orderPageSize}
                      onChange={(e) => {
                        setOrderPageSize(Number(e.target.value));
                        setOrderPage(1);
                      }}
                      style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 12, fontWeight: 700, color: "#1E293B", background: "white" }}
                    >
                      <option value={25}>25 pesanan / hal</option>
                      <option value={50}>50 pesanan / hal</option>
                      <option value={100}>100 pesanan / hal</option>
                      <option value={-1}>Semua ({filteredOrders.length})</option>
                    </select>
                    <span>
                      Menampilkan <b>{filteredOrders.length > 0 ? (orderPageSize === -1 ? 1 : (orderPage - 1) * orderPageSize + 1) : 0}</b> - <b>{orderPageSize === -1 ? filteredOrders.length : Math.min(filteredOrders.length, orderPage * orderPageSize)}</b> dari <b>{filteredOrders.length}</b> total pesanan
                    </span>
                  </div>

                  {orderPageSize !== -1 && totalOrderPages > 1 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <button
                        type="button"
                        disabled={orderPage <= 1}
                        onClick={() => setOrderPage((p) => Math.max(1, p - 1))}
                        style={{
                          padding: "5px 10px",
                          borderRadius: 6,
                          border: "1px solid #CBD5E1",
                          background: orderPage <= 1 ? "#F1F5F9" : "white",
                          color: orderPage <= 1 ? "#94A3B8" : "#1E293B",
                          cursor: orderPage <= 1 ? "not-allowed" : "pointer",
                          fontSize: 12,
                          fontWeight: 700,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4
                        }}
                      >
                        <ChevronLeft size={14} /> Sebelumnya
                      </button>

                      <span style={{ fontSize: 12, fontWeight: 700, color: "#1E293B", padding: "0 8px" }}>
                        Hal {orderPage} dari {totalOrderPages}
                      </span>

                      <button
                        type="button"
                        disabled={orderPage >= totalOrderPages}
                        onClick={() => setOrderPage((p) => Math.min(totalOrderPages, p + 1))}
                        style={{
                          padding: "5px 10px",
                          borderRadius: 6,
                          border: "1px solid #CBD5E1",
                          background: orderPage >= totalOrderPages ? "#F1F5F9" : "white",
                          color: orderPage >= totalOrderPages ? "#94A3B8" : "#1E293B",
                          cursor: orderPage >= totalOrderPages ? "not-allowed" : "pointer",
                          fontSize: 12,
                          fontWeight: 700,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4
                        }}
                      >
                        Berikutnya <ChevronRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 28px" }}>
            {activeTab === "produk" ? (
              <>
                {/* Product Analytics Tab (Kategori & PO) */}
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
                <div style={{ display: "flex", background: "white", border: "1px solid #E2E8F0", padding: 4, borderRadius: 12 }}>
                  <button style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 800, border: "none", cursor: "pointer", transition: "all 0.2s", background: periode === "minggu" ? "#F1F5F9" : "transparent", color: periode === "minggu" ? "#0F172A" : "#64748B" }} onClick={() => setPeriode("minggu")}>Minggu Ini</button>
                  <button style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 800, border: "none", cursor: "pointer", transition: "all 0.2s", background: periode === "bulan" ? "#F1F5F9" : "transparent", color: periode === "bulan" ? "#0F172A" : "#64748B" }} onClick={() => setPeriode("bulan")}>Bulan Ini</button>
                </div>
              </div>

              <div style={{ display: "flex", gap: 24, marginBottom: 24, flexWrap: "wrap" }}>
                {/* Stat Cards */}
                <div style={{ flex: 1, minWidth: 200, background: "white", borderRadius: 24, padding: 24, border: "1px solid #E2E8F0", boxShadow: "0 4px 20px rgba(0,0,0,0.02)", display: "flex", alignItems: "center", gap: 20 }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#F3F4F6", color: "#4B5563", display: "flex", alignItems: "center", justifyContent: "center" }}><TrendingUp size={28} /></div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Total Penjualan</div>
                    <div style={{ fontSize: 32, fontWeight: 900, color: "#1F2937", lineHeight: 1 }}>{totalAll} <span style={{ fontSize: 14, color: "#94A3B8" }}>pcs</span></div>
                  </div>
                </div>

                <div style={{ flex: 1, minWidth: 200, background: "white", borderRadius: 24, padding: 24, border: "1px solid #E2E8F0", boxShadow: "0 4px 20px rgba(0,0,0,0.02)", display: "flex", alignItems: "center", gap: 20 }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#EFF6FF", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center" }}><ShoppingBag size={28} /></div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>PO Online</div>
                    <div style={{ fontSize: 32, fontWeight: 900, color: "#2563EB", lineHeight: 1 }}>{totalPO} <span style={{ fontSize: 14, color: "#94A3B8" }}>pcs</span></div>
                  </div>
                </div>

                <div style={{ flex: 1, minWidth: 200, background: "white", borderRadius: 24, padding: 24, border: "1px solid #E2E8F0", boxShadow: "0 4px 20px rgba(0,0,0,0.02)", display: "flex", alignItems: "center", gap: 20 }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}><Store size={28} /></div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Retail Offline</div>
                    <div style={{ fontSize: 32, fontWeight: 900, color: "#059669", lineHeight: 1 }}>{totalRetail} <span style={{ fontSize: 14, color: "#94A3B8" }}>pcs</span></div>
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>

                {/* Grafik */}
                <div style={{ background: "white", borderRadius: 24, border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
                  <div style={{ padding: "20px 24px", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", alignItems: "center", gap: 10 }}>
                    <BarChart2 size={20} color="#3B82F6" />
                    <h2 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: 0 }}>Grafik Perbandingan Penjualan</h2>
                  </div>
                  <div style={{ padding: 24 }}>
                    {loading && data.length === 0 ? (
                      <div style={{ height: 320, display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", fontWeight: 600 }}> Memuat grafik...</div>
                    ) : data.length === 0 ? (
                      <div style={{ height: 320, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#94A3B8" }}>
                        <div style={{ fontSize: 48, marginBottom: 16 }}></div>
                        <div style={{ fontWeight: 800, color: "#0F172A" }}>Belum ada data penjualan</div>
                        <div style={{ fontSize: 13, marginTop: 4 }}>Data akan muncul di sini setelah ada PO / retail</div>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={320}>
                        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                          <XAxis dataKey="kategori" tick={{ fontSize: 12, fill: "#64748B", fontWeight: 600 }} angle={-25} textAnchor="end" interval={0} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 12, fill: "#64748B", fontWeight: 600 }} axisLine={false} tickLine={false} />
                          <RechartsTooltip
                            formatter={(v: any, name: any) => [`${v} pcs`, name === "total_po" ? "PO Online" : name === "total_retail" ? "Retail Offline" : "Total"]}
                            labelStyle={{ fontWeight: 800, color: "#0F172A", marginBottom: 4 }}
                            contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 10px 30px rgba(0,0,0,0.1)", padding: "12px 16px" }}
                          />
                          <Bar dataKey="total_po" name="PO Online" stackId="a" fill="#3B82F6" radius={[0, 0, 0, 0]} barSize={32} />
                          <Bar dataKey="total_retail" name="Retail" stackId="a" fill="#10B981" radius={[8, 8, 0, 0]} barSize={32} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Tabel Peringkat */}
                <div style={{ background: "white", borderRadius: 24, border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column", height: 418 }}>
                  <div style={{ padding: "20px 24px", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC" }}>
                    <h2 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: 0, marginBottom: 4 }}>Peringkat Kategori Terlaris</h2>
                    <p style={{ fontSize: 12, color: "#64748B", margin: 0 }}>Rekomendasi untuk penentuan batch produksi berikutnya</p>
                  </div>
                  <div style={{ flex: 1, overflowY: "auto" }}>
                    {loading && data.length === 0 ? (
                      <div style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontWeight: 600 }}> Memuat peringkat...</div>
                    ) : data.length === 0 ? (
                      <div style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>Belum ada data.</div>
                    ) : (
                      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                        <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                          <tr style={{ background: "#F1F5F9" }}>
                            <th style={{ padding: "12px 20px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", borderBottom: "2px solid #E2E8F0" }}>Rank</th>
                            <th style={{ padding: "12px 20px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", borderBottom: "2px solid #E2E8F0" }}>Kategori</th>
                            <th style={{ padding: "12px 20px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", borderBottom: "2px solid #E2E8F0" }}>PO</th>
                            <th style={{ padding: "12px 20px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", borderBottom: "2px solid #E2E8F0" }}>Retail</th>
                            <th style={{ padding: "12px 20px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", borderBottom: "2px solid #E2E8F0" }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.map((d, i) => (
                            <tr key={d.kategori} className="table-row-hover" style={{ background: i === 0 ? "#FFFBEB" : "transparent", borderBottom: "1px solid #F1F5F9" }}>
                              <td style={{ padding: "16px 20px", fontWeight: 900, fontSize: 18, color: i === 0 ? "#D97706" : i === 1 ? "#94A3B8" : i === 2 ? "#B45309" : "#CBD5E1" }}>
                                {i === 0 ? "" : i === 1 ? "" : i === 2 ? "" : `#${i + 1}`}
                              </td>
                              <td style={{ padding: "16px 20px", fontWeight: 800, fontSize: 14, color: "#0F172A" }}>{d.kategori}</td>
                              <td style={{ padding: "16px 20px", fontWeight: 700, color: "#3B82F6", fontSize: 13 }}>{d.total_po ?? 0}</td>
                              <td style={{ padding: "16px 20px", fontWeight: 700, color: "#10B981", fontSize: 13 }}>{d.total_retail ?? 0}</td>
                              <td style={{ padding: "16px 20px", fontWeight: 900, color: "#0F172A", fontSize: 16 }}>{d.total}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Review & Rating Pelanggan (Acuan Repeat PO) */}
              {cleanOrganicReviews.length === 0 ? (
                <div style={{ background: "white", borderRadius: 24, border: "1px solid #E2E8F0", padding: "64px 24px", textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}>
                  <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#EFF6FF", color: "#3B82F6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px", border: "1px solid #BFDBFE" }}>
                    <Star size={36} color="#3B82F6" />
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 900, color: "#0F172A", marginBottom: 8 }}>
                    Belum Ada Ulasan Organik Tersinkron
                  </h3>
                  <p style={{ fontSize: 13, color: "#64748B", maxWidth: 540, margin: "0 auto 28px", lineHeight: 1.6 }}>
                    Sistem ini disetel <b>100% murni organik & asli</b> langsung dari pembeli di marketplace. Klik tombol <b>Sinkron Ulasan API</b> untuk menarik data review nyata dari Shopee & TikTok Shop berdasarkan pesanan yang terjual, atau unggah file CSV ulasan yang Anda ekspor dari Seller Center.
                  </p>
                  <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={handleSyncReviewsAPI}
                      disabled={syncingReviews}
                      style={{
                        background: "#3B82F6",
                        color: "white",
                        padding: "11px 20px",
                        borderRadius: 12,
                        fontSize: 13,
                        fontWeight: 800,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        border: "none",
                        cursor: syncingReviews ? "not-allowed" : "pointer",
                        boxShadow: "0 4px 12px rgba(59,130,246,0.3)"
                      }}
                    >
                      <RefreshCw size={16} className={syncingReviews ? "animate-spin" : ""} />
                      {syncingReviews ? "Menyinkronkan API..." : "Sinkron Ulasan API Sekarang"}
                    </button>

                    <label style={{
                      background: "white",
                      color: "#334155",
                      border: "1px solid #CBD5E1",
                      padding: "11px 20px",
                      borderRadius: 12,
                      fontSize: 13,
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      cursor: uploadingReviewsCSV ? "not-allowed" : "pointer",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.04)"
                    }}>
                      <UploadCloud size={16} color="#059669" />
                      {uploadingReviewsCSV ? "Mengimpor CSV..." : "Upload CSV Ulasan Seller Center"}
                      <input type="file" accept=".csv" onChange={handleUploadReviewsCSV} disabled={uploadingReviewsCSV} style={{ display: "none" }} />
                    </label>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

                  {/* 3 KPI Cards Review & Kepuasan */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
                    {/* KPI 1: Rata-rata Rating */}
                    <div style={{ background: "white", borderRadius: 20, padding: 22, border: "1px solid #E2E8F0", boxShadow: "0 4px 20px rgba(0,0,0,0.02)", display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ width: 54, height: 54, borderRadius: 16, background: "#FFFBEB", color: "#F59E0B", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #FDE68A" }}>
                        <Star size={28} fill="#F59E0B" />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 }}>Rata-rata Rating Toko</div>
                        <div style={{ fontSize: 28, fontWeight: 900, color: "#0F172A", display: "flex", alignItems: "baseline", gap: 6 }}>
                          {avgOverallRating.toFixed(1)} <span style={{ fontSize: 14, color: "#F59E0B", fontWeight: 700 }}>⭐⭐⭐⭐⭐</span>
                        </div>
                        <div style={{ fontSize: 11, color: "#059669", fontWeight: 700, marginTop: 2 }}>🟢 Kepuasan Pembeli Sangat Tinggi</div>
                      </div>
                    </div>

                    {/* KPI 2: Model Layak Repeat Produksi */}
                    <div style={{ background: "white", borderRadius: 20, padding: 22, border: "1px solid #E2E8F0", boxShadow: "0 4px 20px rgba(0,0,0,0.02)", display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ width: 54, height: 54, borderRadius: 16, background: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #A7F3D0" }}>
                        <ThumbsUp size={26} />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 }}>Rekomendasi Repeat PO</div>
                        <div style={{ fontSize: 28, fontWeight: 900, color: "#059669" }}>
                          {recommendedCount} Model
                        </div>
                        <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>Rating di atas 4.5 & minim komplain</div>
                      </div>
                    </div>

                    {/* KPI 3: Total Ulasan Terkumpul */}
                    <div style={{ background: "white", borderRadius: 20, padding: 22, border: "1px solid #E2E8F0", boxShadow: "0 4px 20px rgba(0,0,0,0.02)", display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ width: 54, height: 54, borderRadius: 16, background: "#EFF6FF", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #BFDBFE" }}>
                        <MessageSquare size={26} />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 }}>Total Ulasan Pembeli</div>
                        <div style={{ fontSize: 28, fontWeight: 900, color: "#1E293B" }}>
                          {cleanOrganicReviews.length} Ulasan
                        </div>
                        <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>Terverifikasi Shopee & TikTok Shop</div>
                      </div>
                    </div>
                  </div>

                  {/* Section 1: Panduan Acuan Produksi SPK */}
                  <div style={{ background: "linear-gradient(135deg, #EFF6FF 0%, #F8FAFC 100%)", borderRadius: 18, border: "1px solid #BFDBFE", padding: "18px 22px", display: "flex", alignItems: "flex-start", gap: 14 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "#3B82F6", color: "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                      <Sparkles size={20} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: 14, fontWeight: 800, color: "#1E3A8A", margin: 0, marginBottom: 4 }}>
                        Kecerdasan Produksi: Jadikan Ulasan Pembeli Sebagai Acuan Repeat Order
                      </h3>
                      <p style={{ fontSize: 12, color: "#3B82F6", margin: 0, lineHeight: 1.5 }}>
                        Produk dengan rating <b>≥ 4.5 bintang</b> membuktikan pola cutting, bahan kain, dan jahitan vendor CMT telah diterima sangat baik oleh pasar. Prioritaskan model ini untuk dibuatkan SPK potong & jahit batch baru guna memaksimalkan perputaran modal konveksi Anda.
                      </p>
                    </div>
                  </div>

                  {/* Section 2: Rekomendasi Per Model Celana (Decision Matrix) */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                      <h2 style={{ fontSize: 16, fontWeight: 900, color: "#0F172A", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                        <Star size={18} fill="#F59E0B" color="#F59E0B" /> Matriks Pertimbangan Produksi Ulang (Per Model)
                      </h2>
                      <span style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>Dianalisis dari ulasan nyata marketplace</span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16 }}>
                      {cleanOrganicSummary.map((stat: any, idx: number) => {
                        const isRecommended = stat.average_rating >= 4.5;
                        const isWarning = stat.average_rating >= 3.8 && stat.average_rating < 4.5;
                        return (
                          <div key={idx} style={{ background: "white", borderRadius: 20, border: isRecommended ? "1.5px solid #10B981" : isWarning ? "1.5px solid #F59E0B" : "1.5px solid #EF4444", padding: 22, boxShadow: "0 4px 16px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                            <div>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                                <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", margin: 0 }}>{stat.product_name}</h3>
                                <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", padding: "4px 8px", borderRadius: 8, display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                                  <Star size={14} fill="#F59E0B" color="#F59E0B" />
                                  <span style={{ fontSize: 13, fontWeight: 900, color: "#B45309" }}>{stat.average_rating}</span>
                                  <span style={{ fontSize: 10, color: "#92400E" }}>({stat.total_reviews} review)</span>
                                </div>
                              </div>

                              {/* Tags Sorotan Ulasan Pembeli */}
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                                {stat.positive_tags?.map((tag: string, tIdx: number) => (
                                  <span key={tIdx} style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: "#F1F5F9", color: "#475569" }}>
                                    ✓ {tag}
                                  </span>
                                ))}
                              </div>

                              {/* Rekomendasi Box */}
                              <div style={{
                                padding: "12px 14px",
                                borderRadius: 12,
                                background: isRecommended ? "#ECFDF5" : isWarning ? "#FFFBEB" : "#FEF2F2",
                                border: isRecommended ? "1px solid #A7F3D0" : isWarning ? "1px solid #FDE68A" : "1px solid #FECACA",
                                marginBottom: 16
                              }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 900, color: isRecommended ? "#047857" : isWarning ? "#B45309" : "#B91C1C", marginBottom: 3 }}>
                                  {isRecommended ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                                  {stat.recommendation}
                                </div>
                                <p style={{ fontSize: 11.5, color: isRecommended ? "#065F46" : isWarning ? "#92400E" : "#991B1B", margin: 0, lineHeight: 1.45 }}>
                                  {stat.notes}
                                </p>
                              </div>
                            </div>

                            {/* Action Button */}
                            <div style={{ display: "flex", gap: 6, marginTop: "auto", flexWrap: "wrap" }}>
                              {isRecommended && (
                                <a
                                  href="/buat-spk"
                                  style={{
                                    flex: "1 1 140px",
                                    background: "#10B981",
                                    color: "white",
                                    padding: "9px 12px",
                                    borderRadius: 10,
                                    fontSize: 12,
                                    fontWeight: 800,
                                    textAlign: "center",
                                    textDecoration: "none",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 6,
                                    boxShadow: "0 2px 6px rgba(16,185,129,0.3)"
                                  }}
                                >
                                  Buat SPK / Produksi Ulang
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => setSelectedModelDetail(stat)}
                                style={{
                                  padding: "9px 12px",
                                  borderRadius: 10,
                                  fontSize: 12,
                                  fontWeight: 700,
                                  background: "#EFF6FF",
                                  border: "1px solid #BFDBFE",
                                  color: "#1D4ED8",
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4
                                }}
                              >
                                <PieChart size={13} /> Analisis Model
                              </button>
                              <button
                                type="button"
                                onClick={() => setFilterReviewProduct(stat.product_name)}
                                style={{
                                  padding: "9px 12px",
                                  borderRadius: 10,
                                  fontSize: 12,
                                  fontWeight: 700,
                                  background: "#F8FAFC",
                                  border: "1px solid #CBD5E1",
                                  color: "#334155",
                                  cursor: "pointer"
                                }}
                              >
                                Lihat Ulasan
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Section 3: Daftar Ulasan Customer (Feed) */}
                  <div style={{ background: "white", borderRadius: 20, border: "1px solid #E2E8F0", padding: "20px 24px", boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 20, borderBottom: "1px solid #F1F5F9", paddingBottom: 16 }}>
                      <div>
                        <h2 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: 0 }}>
                          Feed Ulasan Nyata Pembeli
                        </h2>
                        <p style={{ fontSize: 12, color: "#64748B", margin: 0, marginTop: 2 }}>
                          Membantu evaluasi kualitas jahitan, kenyamanan bahan jeans, dan akurasi ukuran.
                        </p>
                      </div>

                      {/* Filter Bintang, Produk & Search */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "center", background: "#F1F5F9", borderRadius: 8, padding: "2px 8px", border: "1px solid #CBD5E1" }}>
                          <Search size={14} color="#64748B" />
                          <input
                            type="text"
                            placeholder="Cari ulasan / nama pembeli..."
                            value={reviewSearchQuery}
                            onChange={(e) => {
                              setReviewSearchQuery(e.target.value);
                              setReviewPage(1);
                            }}
                            style={{ padding: "4px 8px", border: "none", outline: "none", fontSize: 12, background: "transparent", width: 170 }}
                          />
                          {reviewSearchQuery && (
                            <button onClick={() => setReviewSearchQuery("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: 0 }}><X size={13} /></button>
                          )}
                        </div>

                        <select
                          value={filterReviewProduct}
                          onChange={(e) => {
                            setFilterReviewProduct(e.target.value);
                            setReviewPage(1);
                          }}
                          style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 12, fontWeight: 600, color: "#0F172A", background: "white" }}
                        >
                          <option value="semua">Semua Model Produk ({cleanOrganicReviews.length})</option>
                          {cleanOrganicSummary.map((s: any) => (
                            <option key={s.product_name} value={s.product_name}>{s.product_name} ({s.total_reviews})</option>
                          ))}
                        </select>

                        <div style={{ display: "flex", gap: 4 }}>
                          {["semua", 5, 4, 3].map((r: any) => (
                            <button
                              key={r}
                              type="button"
                              onClick={() => {
                                setFilterReviewRating(r as any);
                                setReviewPage(1);
                              }}
                              style={{
                                padding: "5px 10px",
                                borderRadius: 8,
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                                border: filterReviewRating === r ? "1px solid #F59E0B" : "1px solid #E2E8F0",
                                background: filterReviewRating === r ? "#FFFBEB" : "white",
                                color: filterReviewRating === r ? "#B45309" : "#64748B"
                              }}
                            >
                              {r === "semua" ? "Semua Bintang" : `⭐ ${r}`}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Feed Items */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {displayedReviews.length === 0 ? (
                        <div style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontWeight: 600 }}>
                          Belum ada ulasan yang sesuai dengan filter ini.
                        </div>
                      ) : (
                        paginatedReviews.map((rev: any) => (
                          <div
                            key={rev.id}
                            onClick={() => setSelectedReviewDetail(rev)}
                            style={{
                              padding: 18,
                              borderRadius: 14,
                              background: "#F8FAFC",
                              border: "1px solid #E2E8F0",
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                            }}
                            className="table-row-hover"
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#CBD5E1", color: "#334155", fontWeight: 800, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  {rev.buyer_name?.charAt(0).toUpperCase() || "U"}
                                </div>
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", display: "flex", alignItems: "center", gap: 6 }}>
                                    {rev.buyer_name}
                                    <span style={{
                                      fontSize: 9.5,
                                      fontWeight: 800,
                                      padding: "1px 6px",
                                      borderRadius: 4,
                                      background: rev.marketplace === "Shopee" ? "#FFEDD5" : "#EFF6FF",
                                      color: rev.marketplace === "Shopee" ? "#C2410C" : "#1D4ED8",
                                      border: rev.marketplace === "Shopee" ? "1px solid #FED7AA" : "1px solid #BFDBFE"
                                    }}>
                                      {rev.marketplace}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: 11, color: "#64748B" }}>
                                    {rev.product_name} {rev.variation ? `· ${rev.variation}` : ""}
                                  </div>
                                </div>
                              </div>

                              <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                                {[...Array(5)].map((_, i) => (
                                  <Star
                                    key={i}
                                    size={14}
                                    fill={i < rev.rating ? "#F59E0B" : "none"}
                                    color={i < rev.rating ? "#F59E0B" : "#CBD5E1"}
                                  />
                                ))}
                                <span style={{ fontSize: 11, color: "#94A3B8", marginLeft: 6 }}>
                                  {new Date(rev.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                                </span>
                              </div>
                            </div>

                            <p style={{ fontSize: 13, color: "#1E293B", lineHeight: 1.5, margin: 0, marginBottom: 10, background: "white", padding: "10px 14px", borderRadius: 10, border: "1px solid #F1F5F9" }}>
                              "{rev.comment}"
                            </p>

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, paddingTop: 6, borderTop: "1px dashed #E2E8F0" }}>
                              {Array.isArray(rev.tags) && rev.tags.length > 0 ? (
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                  {rev.tags.map((t: string, tid: number) => (
                                    <span key={tid} style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: "#E2E8F0", color: "#334155" }}>
                                      #{t}
                                    </span>
                                  ))}
                                </div>
                              ) : <div />}
                              <span style={{ fontSize: 11.5, fontWeight: 800, color: "#2563EB", display: "inline-flex", alignItems: "center", gap: 4 }}>
                                Lihat Rincian & Evaluasi Produk <ChevronRight size={13} />
                              </span>
                            </div>
                          </div>
                        ))
                      )}

                      {/* Pagination Controls Review Feed */}
                      {reviewPageSize !== -1 && totalReviewPages > 1 && (
                        <div style={{ marginTop: 8, paddingTop: 14, borderTop: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                          <div style={{ fontSize: 12, color: "#64748B" }}>
                            Menampilkan <b>{(reviewPage - 1) * reviewPageSize + 1}</b> - <b>{Math.min(displayedReviews.length, reviewPage * reviewPageSize)}</b> dari <b>{displayedReviews.length}</b> ulasan
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <button
                              type="button"
                              disabled={reviewPage <= 1}
                              onClick={() => setReviewPage((p) => Math.max(1, p - 1))}
                              style={{
                                padding: "5px 10px",
                                borderRadius: 6,
                                border: "1px solid #CBD5E1",
                                background: reviewPage <= 1 ? "#F1F5F9" : "white",
                                color: reviewPage <= 1 ? "#94A3B8" : "#1E293B",
                                cursor: reviewPage <= 1 ? "not-allowed" : "pointer",
                                fontSize: 12,
                                fontWeight: 700,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4
                              }}
                            >
                              <ChevronLeft size={13} /> Sebelumnya
                            </button>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#1E293B", padding: "0 6px" }}>
                              Hal {reviewPage} dari {totalReviewPages}
                            </span>
                            <button
                              type="button"
                              disabled={reviewPage >= totalReviewPages}
                              onClick={() => setReviewPage((p) => Math.min(totalReviewPages, p + 1))}
                              style={{
                                padding: "5px 10px",
                                borderRadius: 6,
                                border: "1px solid #CBD5E1",
                                background: reviewPage >= totalReviewPages ? "#F1F5F9" : "white",
                                color: reviewPage >= totalReviewPages ? "#94A3B8" : "#1E293B",
                                cursor: reviewPage >= totalReviewPages ? "not-allowed" : "pointer",
                                fontSize: 12,
                                fontWeight: 700,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4
                              }}
                            >
                              Berikutnya <ChevronRight size={13} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      </div>

      {/* Modal Detail Rekonsiliasi Pesanan & Potongan Marketplace (ala BigSeller) */}
          {selectedOrderDetail && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.65)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 120 }}>
              <div style={{ background: "white", width: "100%", maxWidth: 680, margin: "16px", borderRadius: 18, overflow: "hidden", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}>

                {/* Modal Header */}
                <div style={{ padding: "18px 24px", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 16, fontWeight: 900, color: "#0F172A", display: "flex", alignItems: "center", gap: 6 }}>
                        <Receipt size={18} color="#2563EB" /> Rincian Finansial Pesanan & Potongan
                      </span>
                      <span style={{
                        fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 5,
                        background: selectedOrderDetail.marketplace === "Shopee" ? "#FFEDD5" : "#EFF6FF",
                        color: selectedOrderDetail.marketplace === "Shopee" ? "#C2410C" : "#1D4ED8",
                        border: selectedOrderDetail.marketplace === "Shopee" ? "1px solid #FED7AA" : "1px solid #BFDBFE"
                      }}>
                        {selectedOrderDetail.marketplace} (lavaira.id)
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontFamily: "monospace", fontWeight: 800, color: "#1E293B" }}>
                        #{selectedOrderDetail.order_id}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedOrderDetail.order_id);
                          setCopiedOrderId(true);
                          setTimeout(() => setCopiedOrderId(false), 2000);
                          toast.success("Order ID berhasil disalin");
                        }}
                        style={{ fontSize: 11, color: copiedOrderId ? "#059669" : "#64748B", background: "white", border: "1px solid #CBD5E1", borderRadius: 4, padding: "1px 6px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3 }}
                      >
                        {copiedOrderId ? <Check size={11} /> : <Copy size={11} />} {copiedOrderId ? "Disalin" : "Salin"}
                      </button>
                      <span style={{ fontSize: 11.5, color: "#64748B" }}>
                        &bull; {selectedOrderDetail.tanggal || "-"}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedOrderDetail(null)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", padding: 4 }}
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Modal Body Scrollable */}
                <div style={{ padding: "20px 24px", maxHeight: "70vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>

                  {/* Status Banner */}
                  <div style={{
                    padding: "10px 14px", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between",
                    background: selectedOrderDetail.isRetur ? "#FEF2F2" : selectedOrderDetail.isSudahCair ? "#ECFDF5" : "#FFFBEB",
                    border: selectedOrderDetail.isRetur ? "1px solid #FECACA" : selectedOrderDetail.isSudahCair ? "1px solid #A7F3D0" : "1px solid #FDE68A"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {selectedOrderDetail.isRetur ? <AlertTriangle size={15} color="#DC2626" /> : selectedOrderDetail.isSudahCair ? <CheckCircle2 size={15} color="#059669" /> : <Clock size={15} color="#D97706" />}
                      <span style={{ fontSize: 12.5, fontWeight: 800, color: selectedOrderDetail.isRetur ? "#991B1B" : selectedOrderDetail.isSudahCair ? "#065F46" : "#92400E" }}>
                        Status: {selectedOrderDetail.statusPencairan}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: selectedOrderDetail.isSudahCair ? "#047857" : "#B45309" }}>
                      {selectedOrderDetail.isSudahCair ? "Dana Sudah Masuk ke Saldo Penjual" : "Menunggu Konfirmasi Terima Pembeli"}
                    </span>
                  </div>

                  {/* Card 1: Produk yang Dipesan */}
                  <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12, padding: "12px 16px" }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", marginBottom: 6 }}>
                      Item Produk Dipesan
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: "#0F172A", lineHeight: 1.4 }}>
                      {selectedOrderDetail.product}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, fontSize: 12 }}>
                      <span style={{ color: "#475569" }}>
                        Variasi: <b style={{ color: "#2563EB" }}>{selectedOrderDetail.variation || "-"}</b>
                      </span>
                      <span style={{ fontWeight: 800, color: "#0F172A" }}>
                        Qty: {selectedOrderDetail.total_qty} pcs &times; Rp {(selectedOrderDetail.omzetKotor / (selectedOrderDetail.total_qty || 1)).toLocaleString("id-ID")}
                      </span>
                    </div>
                  </div>

                  {/* Card 2: Rincian Finansial Lengkap Ala BigSeller */}
                  <div style={{ border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden" }}>

                    {/* 1. Pendapatan Kotor Pembeli */}
                    <div style={{ background: "#F8FAFC", padding: "10px 16px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12.5, fontWeight: 800, color: "#0F172A" }}>
                        1. Total Pembayaran Pembeli (Omzet Kotor)
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>
                        Rp {selectedOrderDetail.omzetKotor.toLocaleString("id-ID")}
                      </span>
                    </div>
                    <div style={{ padding: "8px 16px", fontSize: 12, display: "flex", flexDirection: "column", gap: 5, background: "white", borderBottom: "1px solid #E2E8F0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", color: "#475569" }}>
                        <span>Harga Produk (Subtotal Produk)</span>
                        <span style={{ fontWeight: 600 }}>+Rp {selectedOrderDetail.omzetKotor.toLocaleString("id-ID")}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", color: "#64748B" }}>
                        <span>Ongkos Kirim Dibayar Pembeli</span>
                        <span style={{ fontWeight: 600 }}>+Rp 0</span>
                      </div>
                    </div>

                    {/* 2. Rincian Seluruh Beban Potongan Marketplace */}
                    <div style={{ background: "#FEF2F2", padding: "10px 16px", borderBottom: "1px solid #FECACA", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12.5, fontWeight: 800, color: "#991B1B" }}>
                        2. Rincian Seluruh Potongan & Beban Marketplace
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: "#DC2626" }}>
                        -Rp {selectedOrderDetail.totalPotongan.toLocaleString("id-ID")}
                      </span>
                    </div>

                    <div style={{ padding: "10px 16px", fontSize: 12, display: "flex", flexDirection: "column", gap: 7, background: "white", borderBottom: "1px solid #E2E8F0" }}>
                      {/* Biaya Administrasi */}
                      <div style={{ display: "flex", justifyContent: "space-between", color: "#334155" }}>
                        <span>🏢 Biaya Administrasi Shopee (Komisi Platform)</span>
                        <span style={{ fontWeight: 700, color: selectedOrderDetail.breakdown?.adminShopee > 0 ? "#DC2626" : "#64748B" }}>
                          {selectedOrderDetail.breakdown?.adminShopee > 0 ? `-Rp ${selectedOrderDetail.breakdown.adminShopee.toLocaleString("id-ID")}` : "Rp 0"}
                        </span>
                      </div>

                      {/* Beban Gratis Ongkir XTRA */}
                      <div style={{ display: "flex", justifyContent: "space-between", color: "#334155" }}>
                        <span>🚚 Biaya Layanan Program Gratis Ongkir XTRA &amp; Layanan</span>
                        <span style={{ fontWeight: 700, color: selectedOrderDetail.breakdown?.layananGratisOngkir > 0 ? "#DC2626" : "#64748B" }}>
                          {selectedOrderDetail.breakdown?.layananGratisOngkir > 0 ? `-Rp ${selectedOrderDetail.breakdown.layananGratisOngkir.toLocaleString("id-ID")}` : "Rp 0"}
                        </span>
                      </div>

                      {/* Komisi Afiliasi AMS */}
                      <div style={{ display: "flex", justifyContent: "space-between", color: "#334155" }}>
                        <span>🤝 Komisi Afiliasi Shopee (AMS Creator Fee)</span>
                        <span style={{ fontWeight: 700, color: selectedOrderDetail.breakdown?.affiliateShopee > 0 ? "#8B5CF6" : "#64748B" }}>
                          {selectedOrderDetail.breakdown?.affiliateShopee > 0 ? `-Rp ${selectedOrderDetail.breakdown.affiliateShopee.toLocaleString("id-ID")}` : "Rp 0"}
                        </span>
                      </div>

                      {/* Ongkir Ditanggung Penjual */}
                      <div style={{ display: "flex", justifyContent: "space-between", color: "#334155" }}>
                        <span>📦 Beban Ongkir Toko Ditanggung Penjual</span>
                        <span style={{ fontWeight: 700, color: selectedOrderDetail.breakdown?.ongkirToko > 0 ? "#EA580C" : "#64748B" }}>
                          {selectedOrderDetail.breakdown?.ongkirToko > 0 ? `-Rp ${selectedOrderDetail.breakdown.ongkirToko.toLocaleString("id-ID")}` : "Rp 0"}
                        </span>
                      </div>

                      {/* Voucher Diskon Toko */}
                      {selectedOrderDetail.breakdown?.voucherPenjual > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#334155" }}>
                          <span>🎟️ Voucher Diskon Ditanggung Toko</span>
                          <span style={{ fontWeight: 700, color: "#DC2626" }}>
                            -Rp {selectedOrderDetail.breakdown.voucherPenjual.toLocaleString("id-ID")}
                          </span>
                        </div>
                      )}

                      {/* Ringkasan Subtotal Potongan */}
                      <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed #CBD5E1", paddingTop: 6, fontWeight: 800, color: "#991B1B" }}>
                        <span>Total Potongan Marketplace</span>
                        <span>-Rp {selectedOrderDetail.totalPotongan.toLocaleString("id-ID")}</span>
                      </div>
                    </div>

                    {/* 3. Pencairan Bersih Masuk Saldo Penjual */}
                    <div style={{ background: "#ECFDF5", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 900, color: "#065F46" }}>
                          3. Pencairan Bersih Masuk Saldo (Net Settlement)
                        </div>
                        <div style={{ fontSize: 11, color: "#047857", marginTop: 2 }}>
                          Dana bersih riil yang diterima penjual setelah seluruh potongan
                        </div>
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: "#059669" }}>
                        Rp {(selectedOrderDetail.isSudahCair ? selectedOrderDetail.labaBersih : selectedOrderDetail.omzetKotor).toLocaleString("id-ID")}
                      </div>
                    </div>

                  </div>

                  {/* Card 3: Analisis Laba Konveksi (HPP Produksi vs Penjualan Online) */}
                  <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 12, padding: "12px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#166534", textTransform: "uppercase" }}>
                        🏭 Analisis Profit Konveksi (Setelah HPP Modal)
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#15803D", background: "white", padding: "2px 8px", borderRadius: 6, border: "1px solid #86EFAC" }}>
                        Margin Bersih: {selectedOrderDetail.breakdown?.marginKonveksiPct || 0}%
                      </span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 12 }}>
                      <div>
                        <span style={{ color: "#475569" }}>Modal Produksi (HPP):</span>
                        <div style={{ fontWeight: 800, color: "#0F172A" }}>Rp {(selectedOrderDetail.breakdown?.estimasiHPP || 0).toLocaleString("id-ID")}</div>
                      </div>
                      <div>
                        <span style={{ color: "#475569" }}>Laba Bersih Riil Konveksi:</span>
                        <div style={{ fontWeight: 900, color: "#15803D" }}>Rp {(selectedOrderDetail.breakdown?.profitKonveksi || 0).toLocaleString("id-ID")}</div>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Modal Footer */}
                <div style={{ padding: "14px 24px", borderTop: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={() => {
                      const summary = `Order ID: ${selectedOrderDetail.order_id}\nProduk: ${selectedOrderDetail.product} (${selectedOrderDetail.variation || "-"})\nOmzet Kotor: Rp ${selectedOrderDetail.omzetKotor.toLocaleString("id-ID")}\nTotal Potongan: -Rp ${selectedOrderDetail.totalPotongan.toLocaleString("id-ID")}\nPencairan Bersih: Rp ${(selectedOrderDetail.isSudahCair ? selectedOrderDetail.labaBersih : selectedOrderDetail.omzetKotor).toLocaleString("id-ID")}\nStatus: ${selectedOrderDetail.statusPencairan}`;
                      navigator.clipboard.writeText(summary);
                      toast.success("Ringkasan pesanan berhasil disalin");
                    }}
                    style={{ padding: "8px 14px", background: "white", color: "#334155", border: "1px solid #CBD5E1", borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    <Copy size={13} /> Salin Ringkasan
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedOrderDetail(null)}
                    style={{ padding: "8px 22px", background: "#2563EB", color: "white", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                  >
                    Tutup
                  </button>
                </div>

              </div>
            </div>
          )}

          {/* Modal Detail Ulasan Pembeli Spesifik */}
          {selectedReviewDetail && (() => {
            const rev = selectedReviewDetail;
            const matchedSale = (keuanganData.sales || []).find((s: any) => String(s.order_id || "").trim() === String(rev.order_id || "").trim());
            const formattedDate = new Date(rev.created_at).toLocaleString("id-ID", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit"
            });

            return (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(15, 23, 42, 0.65)",
                  backdropFilter: "blur(4px)",
                  zIndex: 9999,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 20
                }}
                onClick={() => setSelectedReviewDetail(null)}
              >
                <div
                  style={{
                    background: "white",
                    borderRadius: 24,
                    width: "100%",
                    maxWidth: 640,
                    maxHeight: "92vh",
                    overflowY: "auto",
                    boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
                    display: "flex",
                    flexDirection: "column"
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Modal Header */}
                  <div style={{ padding: "20px 24px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "flex-start", background: "#F8FAFC" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 800,
                          padding: "2px 8px",
                          borderRadius: 6,
                          background: rev.marketplace === "Shopee" ? "#FFEDD5" : "#EFF6FF",
                          color: rev.marketplace === "Shopee" ? "#C2410C" : "#1D4ED8",
                          border: rev.marketplace === "Shopee" ? "1px solid #FED7AA" : "1px solid #BFDBFE",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4
                        }}>
                          <Store size={12} /> {rev.marketplace} ({rev.marketplace === "Shopee" ? "lavaira.id" : "TikTok"})
                        </span>
                        <span style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>
                          {formattedDate}
                        </span>
                      </div>
                      <h2 style={{ fontSize: 18, fontWeight: 900, color: "#0F172A", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                        Detail Ulasan & Evaluasi Produk
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedReviewDetail(null)}
                      style={{ background: "#F1F5F9", border: "none", borderRadius: 10, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#64748B" }}
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Modal Body */}
                  <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
                    
                    {/* Card Pembeli & Rating */}
                    <div style={{ background: "#F8FAFC", borderRadius: 16, padding: 18, border: "1px solid #E2E8F0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#3B82F6", color: "white", fontWeight: 900, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(59,130,246,0.3)" }}>
                            {rev.buyer_name?.charAt(0).toUpperCase() || "U"}
                          </div>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A", display: "flex", alignItems: "center", gap: 6 }}>
                              @{rev.buyer_name}
                              <span style={{ fontSize: 10, fontWeight: 700, color: "#059669", background: "#ECFDF5", border: "1px solid #A7F3D0", padding: "1px 6px", borderRadius: 4 }}>
                                ✓ Pembeli Terverifikasi
                              </span>
                            </div>
                            <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                              {matchedSale?.city ? `Lokasi: ${matchedSale.city}, ${matchedSale.province || ""}` : "Pelanggan Online Terverifikasi"}
                            </div>
                          </div>
                        </div>

                        {/* Bintang Rating */}
                        <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", padding: "6px 12px", borderRadius: 10, display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ display: "flex", gap: 2 }}>
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                size={16}
                                fill={i < rev.rating ? "#F59E0B" : "none"}
                                color={i < rev.rating ? "#F59E0B" : "#CBD5E1"}
                              />
                            ))}
                          </div>
                          <span style={{ fontSize: 14, fontWeight: 900, color: "#B45309" }}>{rev.rating}.0</span>
                        </div>
                      </div>

                      {/* Order & SKU Info */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, paddingTop: 12, borderTop: "1px solid #E2E8F0", fontSize: 12 }}>
                        <div>
                          <span style={{ color: "#64748B", fontSize: 11 }}>Order ID:</span>
                          <div style={{ fontWeight: 700, color: "#0F172A", display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontFamily: "monospace" }}>{rev.order_id || "-"}</span>
                            {rev.order_id && (
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(rev.order_id);
                                  toast.success("Order ID disalin");
                                }}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", padding: 0 }}
                                title="Salin Order ID"
                              >
                                <Copy size={12} />
                              </button>
                            )}
                          </div>
                        </div>

                        <div>
                          <span style={{ color: "#64748B", fontSize: 11 }}>Variasi Produk Dibeli:</span>
                          <div style={{ fontWeight: 800, color: "#2563EB" }}>
                            {rev.variation || "-"}
                          </div>
                        </div>

                        {matchedSale?.tracking_id && (
                          <div>
                            <span style={{ color: "#64748B", fontSize: 11 }}>Ekspedisi & Resi:</span>
                            <div style={{ fontWeight: 700, color: "#0F172A" }}>
                              {matchedSale.shipping_provider || "Kurir"}: <span style={{ fontFamily: "monospace" }}>{matchedSale.tracking_id}</span>
                            </div>
                          </div>
                        )}

                        {matchedSale?.order_amount && (
                          <div>
                            <span style={{ color: "#64748B", fontSize: 11 }}>Total Nilai Belanja:</span>
                            <div style={{ fontWeight: 800, color: "#059669" }}>
                              Rp {Number(matchedSale.order_amount).toLocaleString("id-ID")}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Nama Produk */}
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 }}>Produk Yang Dinilai</span>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A", marginTop: 4, lineHeight: 1.4 }}>
                        {rev.product_name}
                      </div>
                    </div>

                    {/* Teks Ulasan Asli */}
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 }}>Ulasan Nyata Pembeli</span>
                      <div style={{
                        background: "#FFFBEB",
                        border: "1px solid #FDE68A",
                        borderRadius: 14,
                        padding: "16px 18px",
                        fontSize: 14,
                        color: "#1E293B",
                        fontStyle: "italic",
                        lineHeight: 1.6,
                        marginTop: 6
                      }}>
                        "{rev.comment}"
                      </div>
                    </div>

                    {/* Tag Sentimen */}
                    {Array.isArray(rev.tags) && rev.tags.length > 0 && (
                      <div>
                        <span style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, display: "block" }}>Sorotan Kualitas Terdeteksi</span>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {rev.tags.map((t: string, tid: number) => (
                            <span key={tid} style={{ fontSize: 11.5, fontWeight: 800, padding: "4px 10px", borderRadius: 8, background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE", display: "inline-flex", alignItems: "center", gap: 5 }}>
                              <CheckCircle2 size={13} color="#2563EB" /> #{t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Evaluasi Aspek Produksi & Repeat Order */}
                    <div style={{
                      background: rev.rating >= 4 ? "#ECFDF5" : rev.rating === 3 ? "#FFFBEB" : "#FEF2F2",
                      border: rev.rating >= 4 ? "1px solid #A7F3D0" : rev.rating === 3 ? "1px solid #FDE68A" : "1px solid #FECACA",
                      borderRadius: 16,
                      padding: 18
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 900, color: rev.rating >= 4 ? "#047857" : rev.rating === 3 ? "#B45309" : "#B91C1C", marginBottom: 8 }}>
                        {rev.rating >= 4 ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
                        Rekomendasi Produksi Konveksi: {rev.rating >= 4.5 ? "SANGAT DIREKOMENDASIKAN REPEAT PO" : rev.rating >= 3.8 ? "PERLU EVALUASI POLA & UKURAN" : "EVALUASI TOTAL / STOP SEMENTARA"}
                      </div>
                      
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8, fontSize: 11.5, marginTop: 10 }}>
                        <div style={{ background: "white", padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.06)" }}>
                          <span style={{ color: "#64748B" }}>Kualitas Jahitan CMT:</span>
                          <div style={{ fontWeight: 800, color: rev.rating >= 4 ? "#059669" : "#D97706" }}>
                            {rev.rating >= 4 ? "🟢 Sangat Rapi & Kuat" : "🟡 Perlu Cek Obras"}
                          </div>
                        </div>
                        <div style={{ background: "white", padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.06)" }}>
                          <span style={{ color: "#64748B" }}>Kenyamanan Pola Cutting:</span>
                          <div style={{ fontWeight: 800, color: rev.rating >= 4 ? "#059669" : "#D97706" }}>
                            {rev.rating >= 4 ? "🟢 Proporsional & Pas" : "🟡 Review Masukan Ukuran"}
                          </div>
                        </div>
                        <div style={{ background: "white", padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.06)" }}>
                          <span style={{ color: "#64748B" }}>Karakter Bahan Kain:</span>
                          <div style={{ fontWeight: 800, color: rev.rating >= 4 ? "#059669" : "#D97706" }}>
                            {rev.rating >= 4 ? "🟢 Denim Berkualitas" : "🟡 Evaluasi Washing"}
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Modal Footer */}
                  <div style={{ padding: "14px 24px", borderTop: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setFilterReviewProduct(rev.product_name);
                        setSelectedReviewDetail(null);
                      }}
                      style={{ padding: "9px 14px", background: "white", color: "#334155", border: "1px solid #CBD5E1", borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      <Search size={14} /> Filter Semua Ulasan Model Ini
                    </button>

                    <div style={{ display: "flex", gap: 8 }}>
                      <a
                        href="/buat-spk"
                        style={{
                          padding: "9px 16px",
                          background: "#10B981",
                          color: "white",
                          borderRadius: 10,
                          fontWeight: 800,
                          fontSize: 12,
                          textDecoration: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          boxShadow: "0 2px 6px rgba(16,185,129,0.3)"
                        }}
                      >
                        <Sparkles size={14} /> Buat SPK / Produksi Ulang
                      </a>

                      <button
                        type="button"
                        onClick={() => setSelectedReviewDetail(null)}
                        style={{ padding: "9px 18px", background: "#64748B", color: "white", borderRadius: 10, border: "none", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                      >
                        Tutup
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            );
          })()}

          {/* Modal Analisis Model & Distribusi Rating Bintang */}
          {selectedModelDetail && (() => {
            const stat = selectedModelDetail;
            const modelReviews = cleanOrganicReviews.filter((r: any) => (r.product_name || "Produk Jeans") === stat.product_name);
            const total = stat.total_reviews || 1;
            const starData = [
              { star: 5, count: stat.star_5 || 0, color: "#10B981" },
              { star: 4, count: stat.star_4 || 0, color: "#3B82F6" },
              { star: 3, count: stat.star_3 || 0, color: "#F59E0B" },
              { star: 2, count: stat.star_2 || 0, color: "#F97316" },
              { star: 1, count: stat.star_1 || 0, color: "#EF4444" },
            ];

            return (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(15, 23, 42, 0.65)",
                  backdropFilter: "blur(4px)",
                  zIndex: 9999,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 20
                }}
                onClick={() => setSelectedModelDetail(null)}
              >
                <div
                  style={{
                    background: "white",
                    borderRadius: 24,
                    width: "100%",
                    maxWidth: 680,
                    maxHeight: "92vh",
                    overflowY: "auto",
                    boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
                    display: "flex",
                    flexDirection: "column"
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Modal Header */}
                  <div style={{ padding: "20px 24px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "flex-start", background: "#F8FAFC" }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                        Analisis Sentimen & Acuan Produksi
                      </div>
                      <h2 style={{ fontSize: 18, fontWeight: 900, color: "#0F172A", margin: 0 }}>
                        {stat.product_name}
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedModelDetail(null)}
                      style={{ background: "#F1F5F9", border: "none", borderRadius: 10, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#64748B" }}
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Modal Body */}
                  <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
                    
                    {/* Ringkasan Skor & Distribusi Bintang */}
                    <div style={{ display: "grid", gridTemplateColumns: "190px 1fr", gap: 20, alignItems: "center", background: "#F8FAFC", padding: 20, borderRadius: 18, border: "1px solid #E2E8F0" }}>
                      <div style={{ textAlign: "center", borderRight: "1px solid #E2E8F0", paddingRight: 16 }}>
                        <div style={{ fontSize: 44, fontWeight: 900, color: "#0F172A", lineHeight: 1 }}>
                          {stat.average_rating}
                        </div>
                        <div style={{ display: "flex", justifyContent: "center", gap: 3, margin: "8px 0" }}>
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              size={18}
                              fill={i < Math.round(stat.average_rating) ? "#F59E0B" : "none"}
                              color={i < Math.round(stat.average_rating) ? "#F59E0B" : "#CBD5E1"}
                            />
                          ))}
                        </div>
                        <div style={{ fontSize: 12, color: "#64748B", fontWeight: 700 }}>
                          Total {stat.total_reviews} Ulasan Pembeli
                        </div>
                        <div style={{ fontSize: 11, color: "#059669", fontWeight: 800, marginTop: 4 }}>
                          100% Organik Marketplace
                        </div>
                      </div>

                      {/* Baris Persentase Bintang */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {starData.map((s) => {
                          const pct = Math.round((s.count / total) * 100);
                          return (
                            <div key={s.star} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                              <span style={{ width: 44, fontWeight: 700, color: "#475569", display: "flex", alignItems: "center", gap: 3 }}>
                                {s.star} <Star size={11} fill="#F59E0B" color="#F59E0B" />
                              </span>
                              <div style={{ flex: 1, height: 9, background: "#E2E8F0", borderRadius: 99, overflow: "hidden" }}>
                                <div style={{ width: `${pct}%`, height: "100%", background: s.color, borderRadius: 99, transition: "width 0.4s ease" }} />
                              </div>
                              <span style={{ width: 68, fontSize: 11, fontWeight: 700, color: "#64748B", textAlign: "right" }}>
                                {s.count} ({pct}%)
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Tags Positif Konsumen */}
                    {Array.isArray(stat.positive_tags) && stat.positive_tags.length > 0 && (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#64748B", textTransform: "uppercase", marginBottom: 8 }}>
                          Kekuatan Model Celana (Menurut Ulasan Pasar):
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {stat.positive_tags.map((tag: string, tIdx: number) => (
                            <span key={tIdx} style={{ fontSize: 12, fontWeight: 800, padding: "5px 12px", borderRadius: 8, background: "#ECFDF5", color: "#047857", border: "1px solid #A7F3D0", display: "inline-flex", alignItems: "center", gap: 5 }}>
                              <Check size={14} color="#059669" /> {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Rekomendasi Produksi Box */}
                    <div style={{
                      padding: "16px 18px",
                      borderRadius: 14,
                      background: stat.average_rating >= 4.5 ? "#ECFDF5" : stat.average_rating >= 3.8 ? "#FFFBEB" : "#FEF2F2",
                      border: stat.average_rating >= 4.5 ? "1px solid #A7F3D0" : stat.average_rating >= 3.8 ? "1px solid #FDE68A" : "1px solid #FECACA"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 900, color: stat.average_rating >= 4.5 ? "#047857" : stat.average_rating >= 3.8 ? "#B45309" : "#B91C1C", marginBottom: 6 }}>
                        {stat.average_rating >= 4.5 ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                        Status Rekomendasi: {stat.recommendation}
                      </div>
                      <p style={{ fontSize: 12.5, color: stat.average_rating >= 4.5 ? "#065F46" : stat.average_rating >= 3.8 ? "#92400E" : "#991B1B", margin: 0, lineHeight: 1.5 }}>
                        {stat.notes}
                      </p>
                    </div>

                    {/* Cuplikan Ulasan Nyata Terbaru untuk Model Ini */}
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#64748B", textTransform: "uppercase", marginBottom: 10 }}>
                        Sampel Ulasan Pembeli untuk Model Ini:
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {modelReviews.slice(0, 4).map((r: any) => (
                          <div key={r.id} style={{ padding: "12px 14px", borderRadius: 10, background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                              <span style={{ fontSize: 12, fontWeight: 800, color: "#0F172A" }}>@{r.buyer_name} <span style={{ fontSize: 10, color: "#64748B", fontWeight: 400 }}>· {r.variation || "-"}</span></span>
                              <div style={{ display: "flex", gap: 2 }}>
                                {[...Array(r.rating || 5)].map((_, i) => (
                                  <Star key={i} size={12} fill="#F59E0B" color="#F59E0B" />
                                ))}
                              </div>
                            </div>
                            <div style={{ fontSize: 12, color: "#334155", fontStyle: "italic" }}>
                              "{r.comment}"
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>

                  {/* Modal Footer */}
                  <div style={{ padding: "14px 24px", borderTop: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setFilterReviewProduct(stat.product_name);
                        setSelectedModelDetail(null);
                      }}
                      style={{ padding: "9px 14px", background: "white", color: "#334155", border: "1px solid #CBD5E1", borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      <Search size={14} /> Lihat Semua {stat.total_reviews} Ulasan
                    </button>

                    <div style={{ display: "flex", gap: 8 }}>
                      <a
                        href="/buat-spk"
                        style={{
                          padding: "9px 16px",
                          background: "#10B981",
                          color: "white",
                          borderRadius: 10,
                          fontWeight: 800,
                          fontSize: 12,
                          textDecoration: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          boxShadow: "0 2px 6px rgba(16,185,129,0.3)"
                        }}
                      >
                        <Sparkles size={14} /> Buat SPK Potong / Produksi Ulang
                      </a>

                      <button
                        type="button"
                        onClick={() => setSelectedModelDetail(null)}
                        style={{ padding: "9px 18px", background: "#64748B", color: "white", borderRadius: 10, border: "none", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                      >
                        Tutup
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            );
          })()}
        </>
        );
}
