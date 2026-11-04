"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  UploadCloud, Search, ShoppingCart, User, FileText, ChevronRight, CreditCard, Box, 
  Calendar, Truck, MapPin, TableIcon, BarChart2, X, Eye, Clock, RefreshCw,
  CheckCircle2, AlertCircle, Info, ChevronDown, ChevronUp, Check, ShieldCheck, Sparkles, ScanLine, Trash2,
  ChevronLeft, ChevronsLeft, ChevronsRight, Filter, CalendarDays
} from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";
import ScanJualPanel from "@/components/ScanJualPanel";
import { subscribeRealtime, subscribeRealtimeEvent } from "@/lib/realtime-client";

function playOrderSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, now + 0.12); // A5
    osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.35); // D6

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.12);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.45);
  } catch {}
}

function parseOrderDate(dateStr: any): Date | null {
  if (!dateStr || typeof dateStr !== "string") return null;
  const s = dateStr.trim();
  if (!s || s === "-") return null;

  // DD/MM/YYYY or DD/MM/YYYY HH:mm:ss
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (slashMatch) {
    const [, day, month, year, hh = "0", mm = "0", ss = "0"] = slashMatch;
    const d = new Date(Number(year), Number(month) - 1, Number(day), Number(hh), Number(mm), Number(ss));
    return isNaN(d.getTime()) ? null : d;
  }

  // DD-MM-YYYY or DD-MM-YYYY HH:mm:ss
  const dashMatch = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (dashMatch) {
    const [, day, month, year, hh = "0", mm = "0", ss = "0"] = dashMatch;
    const d = new Date(Number(year), Number(month) - 1, Number(day), Number(hh), Number(mm), Number(ss));
    return isNaN(d.getTime()) ? null : d;
  }

  // YYYY-MM-DD or YYYY-MM-DD HH:mm:ss
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

export default function PenjualanOnlinePage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [syncingMp, setSyncingMp] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [scanOrderId, setScanOrderId] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [filterTipe, setFilterTipe] = useState("Semua");
  const [filterStatusScan, setFilterStatusScan] = useState<"semua" | "belum_discan" | "sudah_discan" | "pre_order">("semua");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [activeDatePreset, setActiveDatePreset] = useState<string>("semua");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showGuide, setShowGuide] = useState(true);
  const [viewMode, setViewMode] = useState<"table" | "summary">("table");
  const [selectedPenjualan, setSelectedPenjualan] = useState<any | null>(null);
  const [deletingOrder, setDeletingOrder] = useState<string | null>(null);

  const handleHapusPesanan = async (orderId: string) => {
    if (!window.confirm(`Hapus pesanan ${orderId} dari daftar? Jika sudah ada barcode yang di-scan, stok barang akan otomatis dikembalikan ke gudang.`)) return;
    setDeletingOrder(orderId);
    try {
      const res = await fetch(`/api/penjualan-online?order_id=${encodeURIComponent(orderId)}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menghapus pesanan");
      toast.success(`Pesanan ${orderId} berhasil dihapus dari sistem!`);
      if (selectedPenjualan?.order_id === orderId) setSelectedPenjualan(null);
      await fetchData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeletingOrder(null);
    }
  };

  const handleSyncMarketplace = async () => {
    setSyncingMp(true);
    try {
      const res = await fetch("/api/marketplace/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal sinkron marketplace");
      toast.success("Sinkronisasi pesanan dari toko marketplace selesai!");
      await fetchData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSyncingMp(false);
    }
  };

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/penjualan-online?_t=${Date.now()}`);
      const json = await res.json();
      setData(json);
      if (Array.isArray(json)) setSelectedPenjualan((prev: any) => (prev ? json.find((x: any) => x.id === prev.id) || null : null));
    } catch (err) {
      toast.error("Gagal mengambil data penjualan online");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Auto-sync cepat di background saat halaman dibuka
    fetch("/api/marketplace/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }).catch(() => {});

    // Polling background tiap 30 detik untuk menjamin pesanan baru selalu masuk tanpa intervensi
    const autoSyncTimer = setInterval(() => {
      fetch("/api/marketplace/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }).catch(() => {});
    }, 30_000);

    const unSync = subscribeRealtime(() => fetchData());
    const unEvent = subscribeRealtimeEvent((ev, evData) => {
      if (ev === "marketplace:order_received") {
        if (evData?.added > 0) {
          playOrderSound();
        }
        fetchData();
      } else if (
        ev === "retur_processed" ||
        ev === "retur_online_updated" ||
        ev === "retur_banding_updated" ||
        ev === "retur_ke_stok" ||
        ev === "retur_deleted"
      ) {
        fetchData();
      }
    });
    return () => {
      clearInterval(autoSyncTimer);
      unSync();
      unEvent();
    };
  }, [fetchData]);

  const [cancelingKode, setCancelingKode] = useState<string | null>(null);
  const handleBatalScan = async (b: any) => {
    const alasan = window.prompt(
      `Batalkan scan ${b.kode}?\n\nPcs akan kembali ke stok (siap jual) dan dilepas dari order ini.\nTulis alasan (contoh: salah scan / kelebihan scan):`,
      "Salah scan"
    );
    if (alasan === null) return;
    setCancelingKode(b.kode);
    try {
      const res = await fetch(`/api/penjualan-barcode?kode=${encodeURIComponent(b.kode)}&alasan=${encodeURIComponent(alasan)}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal membatalkan");
      toast.success(`${b.kode} dibatalkan — kembali ke stok${json.saleDeleted ? " (transaksi kosong ikut dihapus)" : ""}`);
      await fetchData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCancelingKode(null);
    }
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
        const headers = results.meta?.fields || Object.keys(rows[0] || {});
        const marketplace = headers.includes("No. Pesanan") ? "Shopee" : headers.includes("Order ID") ? "TikTok Shop" : "Marketplace";

        const isCancelOrReturRow = (row: any) => {
          const status = String(row["Order Status"] || row["Status Pesanan"] || "").toLowerCase();
          const cancelType = String(
            row["Cancelation/Return Type"] || row["Status Pembatalan/ Pengembalian"] || row["Alasan Pembatalan"] || ""
          ).toLowerCase();
          return (
            status.includes("batal") ||
            status.includes("cancel") ||
            status.includes("retur") ||
            status.includes("pengembalian") ||
            cancelType.includes("cancel") ||
            cancelType.includes("batal") ||
            cancelType.includes("return") ||
            cancelType.includes("refund") ||
            cancelType.includes("pengembalian")
          );
        };

        const validOrderRows = rows.filter((row: any) => {
          const orderId = row["Order ID"] || row["No. Pesanan"] || row["ID Pesanan"] || row["Nomor Invoice"];
          if (!orderId || String(orderId).includes("Platform unique")) return false;
          return true;
        });

        const filtered = validOrderRows.filter((row: any) => !isCancelOrReturRow(row));
        const cancelledOrReturRows = validOrderRows.filter((row: any) => isCancelOrReturRow(row));

        if (filtered.length === 0 && cancelledOrReturRows.length === 0) {
          toast.info("Tidak ditemukan pesanan yang valid di file ini.");
          setUploading(false);
          e.target.value = "";
          return;
        }

        const formatted = filtered.map((row: any) => {
          return {
            marketplace,
            order_id: String(row["Order ID"] || row["No. Pesanan"] || row["ID Pesanan"] || "").trim(),
            status: row["Order Status"] || row["Status Pesanan"] || "Unknown",
            product_name: row["Product Name"] || row["Nama Produk"],
            variation: row["Variation"] || row["Nama Variasi"],
            quantity: parseInt(row["Quantity"] || row["Jumlah"]) || 1,
            order_amount: row["Order Amount"] || row["Total Harga Produk"] || row["Total Harga Pembeli"],
            seller_sku: row["Seller SKU"] || row["Nomor Referensi SKU"] || row["SKU Induk"],
            buyer_username: row["Buyer Username"] || row["Username (Pembeli)"],
            recipient: row["Recipient"] || row["Nama Penerima"],
            tanggal_pesanan: row["Created Time"] || row["Waktu Pesanan Dibuat"],
            phone: row["Phone #"] || row["No. Telepon"],
            address: row["Detail Address"] || row["Alamat Lengkap"],
            city: row["Regency and City"] || row["Kota/Kabupaten"],
            province: row["Province"] || row["Provinsi"],
            tracking_id: row["Tracking ID"] || row["No. Resi"],
            shipping_provider: row["Shipping Provider Name"] || row["Opsi Pengiriman"],
            payment_method: row["Payment Method"] || row["Metode Pembayaran"] || "Transfer",
            tipe_pesanan: row["Normal or Pre-order"] || "Normal",
            jatuh_tempo: row["RTS Time"] || row["RTS SLA"] || row["Ship by Date"] || row["Batas Waktu Pengiriman"] || row["Ship By Date"] || ""
          };
        });

        // Otomatis teruskan baris batal/retur dalam CSV yang sama ke /api/returns/online agar selalu sinkron
        const formattedReturs = cancelledOrReturRows.map((row: any) => {
          let amount = row["Order Amount"] || row["Total Harga Produk"] || row["Total Harga Pembeli"] || "0";
          if (typeof amount === "string") amount = amount.replace(/\D/g, "");
          const cancelType = String(row["Cancelation/Return Type"] || row["Status Pembatalan/ Pengembalian"] || "");
          const isRet = /return|refund|retur|pengembalian/i.test(cancelType) || Boolean(row["Alasan Pengembalian"]);
          return {
            marketplace,
            order_id: String(row["Order ID"] || row["No. Pesanan"] || row["ID Pesanan"] || "").trim(),
            product_name: row["Product Name"] || row["Nama Produk"] || "-",
            variation: row["Variation"] || row["Nama Variasi"] || "-",
            return_quantity: parseInt(row["Sku Quantity of return"] || row["Jumlah Produk Dikembalikan"] || row["Quantity"] || row["Jumlah"]) || 1,
            return_type: isRet ? "Return/Refund" : (cancelType || "Cancel"),
            alasan: row["Alasan Pengembalian"] || row["Cancel Reason"] || row["Alasan Pembatalan"] || "-",
            buyer_note: row["Buyer Note"] || row["Catatan dari Pembeli"] || "-",
            tanggal_batal: row["Cancelled Time"] || row["Waktu Pesanan Dibatalkan"] || row["Created Time"] || row["Waktu Pesanan Dibuat"] || "-",
            buyer_username: row["Buyer Username"] || row["Username (Pembeli)"] || "-",
            recipient: row["Recipient"] || row["Nama Penerima"] || "-",
            phone: row["Phone #"] || row["No. Telepon"] || "-",
            address: `${row["Detail Address"] || row["Alamat Lengkap"] || ""}, ${row["Regency and City"] || row["Kota/Kabupaten"] || ""}, ${row["Province"] || row["Provinsi"] || ""}`,
            tracking_id: row["Tracking ID"] || row["No. Resi Pengembalian"] || row["No. Resi"] || "-",
            shipping_provider: row["Shipping Provider Name"] || row["Opsi Pengiriman"] || "-",
            order_amount: amount || "0",
            payment_method: row["Payment Method"] || row["Metode Pembayaran"] || "-",
            seller_sku: row["Seller SKU"] || row["Nomor Referensi SKU"] || row["SKU Induk"] || "-",
          };
        });

        try {
          let addedSales = 0, skippedSales = 0, addedReturs = 0;
          if (formatted.length > 0) {
            const res = await fetch("/api/penjualan-online", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(formatted)
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Gagal menyimpan data pesanan");
            addedSales = json.added || 0;
            skippedSales = json.skipped || 0;
          }
          if (formattedReturs.length > 0) {
            const rRet = await fetch("/api/returns/online", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(formattedReturs)
            });
            const jRet = await rRet.json().catch(() => ({}));
            if (rRet.ok) addedReturs = jRet.added || 0;
          }
          toast.success(
            `${addedSales} pesanan diimpor${skippedSales ? ` (${skippedSales} dilewati)` : ""}${
              addedReturs ? ` + ${addedReturs} pesanan batal/retur otomatis masuk ke Retur Online` : ""
            }.`
          );
          fetchData();
        } catch (err: any) {
          toast.error(err.message || "Terjadi kesalahan saat menyimpan data");
        } finally {
          setUploading(false);
          e.target.value = "";
        }
      },
      error: (_err: any) => {
        toast.error("Gagal membaca file CSV");
        setUploading(false);
      }
    });
  };

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

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterTipe, filterStatusScan, filterStartDate, filterEndDate, pageSize]);

  const filteredData = data.filter(d => {
    if (!d.order_id || d.order_id.includes("Platform unique")) return false;
    
    // Filter tipe pesanan
    if (filterTipe !== "Semua") {
      if (filterTipe === "Normal" && d.tipe_pesanan && d.tipe_pesanan !== "Normal") return false;
      if (filterTipe === "Pre-order" && d.tipe_pesanan !== "Pre-order") return false;
    }

    // Filter status scan
    if (filterStatusScan === "belum_discan" && d.status_kemas === "Sudah Discan") return false;
    if (filterStatusScan === "sudah_discan" && d.status_kemas !== "Sudah Discan") return false;
    if (filterStatusScan === "pre_order" && d.tipe_pesanan !== "Pre-order") return false;

    // Filter tanggal pesanan
    if (filterStartDate || filterEndDate) {
      const orderDate = parseOrderDate(d.tanggal_pesanan) || parseOrderDate(d.tanggal_diimpor);
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

    // Search query
    if (search.trim()) {
      const q = search.toLowerCase();
      const match =
        d.order_id?.toLowerCase().includes(q) ||
        d.product_name?.toLowerCase().includes(q) ||
        d.buyer_username?.toLowerCase().includes(q) ||
        d.recipient?.toLowerCase().includes(q) ||
        d.tracking_id?.toLowerCase().includes(q) ||
        d.seller_sku?.toLowerCase().includes(q);
      if (!match) return false;
    }

    return true;
  });

  // 1 Order ID bisa berisi beberapa baris produk → hitung pesanan per Order ID unik.
  // TikTok: "Order Amount" = nilai seluruh pesanan (diulang tiap baris) → ambil sekali per Order ID.
  const orderAmount: Record<string, number> = {};
  data.forEach(d => {
    const oid = String(d.order_id || "").trim();
    const amt = parseInt(String(d.order_amount || "0").replace(/[^\d-]/g, "")) || 0;
    if (/tiktok/i.test(String(d.marketplace || ""))) orderAmount[oid] = Math.max(orderAmount[oid] || 0, amt);
    else orderAmount[oid] = (orderAmount[oid] || 0) + amt;
  });
  const totalPesanan = Object.keys(orderAmount).length;
  const totalProduk = data.reduce((sum, d) => sum + (d.quantity || 1), 0);
  const totalPendapatan = Object.values(orderAmount).reduce((s, n) => s + n, 0);

  // Breakdown status scan kemas & stok
  const pesananSudahDiscan = data.filter(d => d.status_kemas === "Sudah Discan");
  const pesananBelumDiscan = data.filter(d => d.status_kemas !== "Sudah Discan");
  const countSudahDiscan = pesananSudahDiscan.length;
  const countBelumDiscan = pesananBelumDiscan.length;
  const countPreOrder = data.filter(d => d.tipe_pesanan === "Pre-order").length;
  const pcsSudahDiscan = pesananSudahDiscan.reduce((s, d) => s + (d.scanned_qty || d.quantity || 0), 0);
  const pcsBelumDiscan = pesananBelumDiscan.reduce((s, d) => s + Math.max(0, (d.quantity || 1) - (d.scanned_qty || 0)), 0);

  const productCount: Record<string, number> = {};
  const provinceCount: Record<string, number> = {};
  const courierCount: Record<string, number> = {};

  data.forEach(d => {
    if (d.seller_sku) productCount[d.seller_sku] = (productCount[d.seller_sku] || 0) + (d.quantity || 1);
    if (d.province) provinceCount[d.province] = (provinceCount[d.province] || 0) + 1;
    if (d.shipping_provider) courierCount[d.shipping_provider] = (courierCount[d.shipping_provider] || 0) + 1;
  });

  const getTop = (obj: Record<string, number>) => Object.entries(obj).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";

  const topProduct = getTop(productCount);
  const topProvince = getTop(provinceCount);
  const topProdukList = Object.entries(productCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topProvinsiList = Object.entries(provinceCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topKurirList = Object.entries(courierCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const computeJatuhTempo = (waktuPesanan: string, tipe: string) => {
    if (!waktuPesanan) return "-";
    const parts = waktuPesanan.split(" ");
    if (parts.length !== 2) return "-";
    
    const dateParts = parts[0].split("/");
    const timeParts = parts[1].split(":");
    
    if (dateParts.length !== 3 || timeParts.length !== 3) return "-";
    
    const dateObj = new Date(
      parseInt(dateParts[2]), 
      parseInt(dateParts[1]) - 1, 
      parseInt(dateParts[0]), 
      parseInt(timeParts[0]), 
      parseInt(timeParts[1]), 
      parseInt(timeParts[2])
    );
    
    if (isNaN(dateObj.getTime())) return "-";
    
    const daysToAdd = tipe === "Pre-order" ? 7 : 2;
    dateObj.setDate(dateObj.getDate() + daysToAdd);
    
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(dateObj.getDate())}/${pad(dateObj.getMonth() + 1)}/${dateObj.getFullYear()} ${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}:${pad(dateObj.getSeconds())}`;
  };

  // Urutkan pesanan terbaru lebih dulu & potong sesuai halaman
  const sortedData = [...filteredData].reverse();
  const totalItems = sortedData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedData = sortedData.slice(startIndex, endIndex);

  const getPageNumbers = () => {
    const delta = 1;
    const range: (number | string)[] = [];
    const left = Math.max(2, safeCurrentPage - delta);
    const right = Math.min(totalPages - 1, safeCurrentPage + delta);

    range.push(1);
    if (left > 2) range.push("...");
    for (let i = left; i <= right; i++) {
      range.push(i);
    }
    if (right < totalPages - 1) range.push("...");
    if (totalPages > 1) range.push(totalPages);

    return range;
  };

  // Real-time sync: refresh data when another admin makes changes
  useEffect(() => {
    window.addEventListener("konveksi-sync", fetchData);
    return () => window.removeEventListener("konveksi-sync", fetchData);
  }, [fetchData]);
  return (
    <>
      <style>{`
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 99px; }
        .table-row-hover:hover { background: #F8FAFC; }
      `}</style>
      
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#F1F5F9", overflow: "hidden" }}>
        
        <div style={{ padding: "24px 32px", background: "white", borderBottom: "1px solid #E2E8F0", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", marginBottom: 4 }}>Penjualan Online</h1>
            <p style={{ fontSize: 13, color: "#64748B" }}>Integrasi laporan CSV pesanan (TikTok, Shopee, dll) untuk memotong stok.</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button 
              onClick={handleSyncMarketplace} 
              disabled={syncingMp} 
              style={{ background: "#3B82F6", color: "white", padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 6, border: "none", cursor: syncingMp ? "not-allowed" : "pointer", boxShadow: "0 4px 10px rgba(59,130,246,0.25)", opacity: syncingMp ? 0.7 : 1 }}
            >
              <RefreshCw size={17} className={syncingMp ? "animate-spin" : ""} />
              {syncingMp ? "Sinkron..." : "Sinkron Marketplace"}
            </button>
            <button id="btn-online-scan" onClick={() => { setScanOrderId(undefined); setShowScan(true); }} style={{ background: "linear-gradient(135deg,#F97316,#EC4899)", color: "white", padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 6, border: "none", cursor: "pointer", boxShadow: "0 4px 10px rgba(236,72,153,0.25)" }}>
              <ScanLine size={18} /> Scan Barcode Kirim
            </button>
            <label style={{ background: "#10B981", color: "white", padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 6, cursor: uploading ? "not-allowed" : "pointer", opacity: uploading ? 0.7 : 1, boxShadow: "0 4px 10px rgba(16, 185, 129, 0.2)", transition: "all 0.2s" }}>
              <UploadCloud size={18} />
              {uploading ? "Memproses..." : "Upload Pesanan CSV"}
              <input type="file" accept=".csv" onChange={handleFileUpload} disabled={uploading} style={{ display: "none" }} />
            </label>
          </div>
        </div>

        {showScan && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 30, overflowY: "auto" }}>
            <div style={{ background: "#F1F5F9", borderRadius: 20, width: "100%", maxWidth: 1100, padding: 24, boxShadow: "0 20px 40px rgba(0,0,0,0.25)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 900, color: "#0F172A", margin: 0 }}>Scan Barcode — Penjualan Online</h2>
                  <p style={{ fontSize: 12, color: "#64748B", margin: "4px 0 0" }}>Pilih Order ID pesanan (dari CSV), lalu scan tiap pcs yang dikemas. Data pembeli, alamat & resi otomatis tercatat pada barang yang keluar.</p>
                </div>
                <button onClick={() => { setShowScan(false); fetchData(); }} style={{ background: "white", border: "1px solid #E2E8F0", width: 34, height: 34, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B" }}><X size={16} /></button>
              </div>
              <ScanJualPanel kanal="Penjualan Online" accent="#EC4899" pelangganLabel="Nama Pembeli" orderMode initialOrderId={scanOrderId} onSaved={fetchData} />
            </div>
          </div>
        )}

        {/* 1. Ringkasan Cepat & KPI Cards */}
        <div style={{ padding: "20px 32px 0 32px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          {/* Card 1: Total Pesanan */}
          <div 
            onClick={() => setFilterStatusScan("semua")}
            style={{ 
              background: "white", padding: "16px 20px", borderRadius: 14, border: filterStatusScan === "semua" ? "2px solid #3B82F6" : "1px solid #E2E8F0", 
              boxShadow: "0 2px 8px rgba(0,0,0,0.03)", cursor: "pointer", transition: "all 0.2s" 
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 }}>Total Pesanan Masuk</span>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: "#EFF6FF", color: "#3B82F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ShoppingCart size={16} />
              </div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#0F172A" }}>
              {totalPesanan} <span style={{ fontSize: 13, fontWeight: 700, color: "#94A3B8" }}>Order</span>
            </div>
            <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>
              Total {totalProduk.toLocaleString("id-ID")} pcs barang diimpor
            </div>
          </div>

          {/* Card 2: Belum Discan (Perlu Kemas) */}
          <div 
            onClick={() => setFilterStatusScan("belum_discan")}
            style={{ 
              background: countBelumDiscan > 0 ? "#FFFDF5" : "white", 
              padding: "16px 20px", borderRadius: 14, 
              border: filterStatusScan === "belum_discan" ? "2px solid #F97316" : countBelumDiscan > 0 ? "1px solid #FDE68A" : "1px solid #E2E8F0", 
              boxShadow: "0 2px 8px rgba(0,0,0,0.03)", cursor: "pointer", transition: "all 0.2s" 
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: countBelumDiscan > 0 ? "#D97706" : "#64748B", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Perlu Dikemas (Belum Scan)
              </span>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: "#FFFBEB", color: "#F59E0B", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Clock size={16} />
              </div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: countBelumDiscan > 0 ? "#D97706" : "#0F172A" }}>
              {countBelumDiscan} <span style={{ fontSize: 13, fontWeight: 700, color: countBelumDiscan > 0 ? "#B45309" : "#94A3B8" }}>Order</span>
            </div>
            <div style={{ fontSize: 11, color: countBelumDiscan > 0 ? "#B45309" : "#64748B", marginTop: 4, fontWeight: 600 }}>
              {pcsBelumDiscan.toLocaleString("id-ID")} pcs stok belum terpotong
            </div>
          </div>

          {/* Card 3: Sudah Discan (Stok Terpotong) */}
          <div 
            onClick={() => setFilterStatusScan("sudah_discan")}
            style={{ 
              background: countSudahDiscan > 0 ? "#F0FDF4" : "white", 
              padding: "16px 20px", borderRadius: 14, 
              border: filterStatusScan === "sudah_discan" ? "2px solid #10B981" : countSudahDiscan > 0 ? "1px solid #BBF7D0" : "1px solid #E2E8F0", 
              boxShadow: "0 2px 8px rgba(0,0,0,0.03)", cursor: "pointer", transition: "all 0.2s" 
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: countSudahDiscan > 0 ? "#059669" : "#64748B", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Sudah Discan (Selesai Kirim)
              </span>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: "#ECFDF5", color: "#10B981", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CheckCircle2 size={16} />
              </div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: countSudahDiscan > 0 ? "#047857" : "#0F172A" }}>
              {countSudahDiscan} <span style={{ fontSize: 13, fontWeight: 700, color: countSudahDiscan > 0 ? "#059669" : "#94A3B8" }}>Order</span>
            </div>
            <div style={{ fontSize: 11, color: countSudahDiscan > 0 ? "#047857" : "#64748B", marginTop: 4, fontWeight: 600 }}>
              ✓ {pcsSudahDiscan.toLocaleString("id-ID")} pcs stok resmi terpotong
            </div>
          </div>

          {/* Card 4: Total Omzet */}
          <div style={{ background: "white", padding: "16px 20px", borderRadius: 14, border: "1px solid #E2E8F0", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 }}>Total Omzet Terimpor</span>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: "#F5F3FF", color: "#8B5CF6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CreditCard size={16} />
              </div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#0F172A" }}>
              Rp {totalPendapatan.toLocaleString("id-ID")}
            </div>
            <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>
              Nilai kotor transaksi marketplace
            </div>
          </div>
        </div>

        {/* 2. Panduan Alur Impor & Keamanan Data (Collapsible) */}
        <div style={{ padding: "14px 32px 0 32px" }}>
          <div 
            style={{ 
              background: "linear-gradient(135deg, #EFF6FF 0%, #F0FDF4 100%)", 
              border: "1px solid #BFDBFE", 
              borderRadius: 14, 
              padding: "12px 18px",
              boxShadow: "0 2px 6px rgba(59,130,246,0.05)"
            }}
          >
            <div 
              onClick={() => setShowGuide(!showGuide)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 24, height: 24, borderRadius: 6, background: "#DBEAFE", color: "#1D4ED8", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ShieldCheck size={15} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#1E3A8A" }}>
                  Panduan Impor CSV & Pemotongan Stok Marketplace
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, background: "#DBEAFE", color: "#1D4ED8", padding: "1px 8px", borderRadius: 99 }}>
                  Aman dari Duplikasi
                </span>
              </div>
              <button 
                type="button" 
                style={{ background: "transparent", border: "none", color: "#1D4ED8", cursor: "pointer", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}
              >
                {showGuide ? "Sembunyikan Panduan" : "Tampilkan Panduan"}
                {showGuide ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>

            {showGuide && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginTop: 12, paddingTop: 10, borderTop: "1px dashed #BFDBFE" }}>
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ color: "#2563EB", marginTop: 2 }}><CheckCircle2 size={16} /></div>
                  <div style={{ fontSize: 12, color: "#1E293B", lineHeight: 1.5 }}>
                    <strong style={{ color: "#1D4ED8", display: "block" }}>1. Bebas Impor Berkala (Tanpa Takut Dobel)</strong>
                    Anda bebas mengupload CSV baru kapan saja (harian/mingguan). Sistem otomatis melewati pesanan yang sudah ada dan hanya memasukkan pesanan yang baru.
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ color: "#059669", marginTop: 2 }}><CheckCircle2 size={16} /></div>
                  <div style={{ fontSize: 12, color: "#1E293B", lineHeight: 1.5 }}>
                    <strong style={{ color: "#047857", display: "block" }}>2. Status & Barcode Tetap Terjaga</strong>
                    Pesanan yang kemarin sudah berstatus <span style={{ background: "#DCFCE7", color: "#047857", padding: "1px 5px", borderRadius: 4, fontWeight: 700 }}>✓ Sudah Discan</span> tidak akan hilang, tidak tertimpa, dan stok yang sudah terpotong tetap aman.
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ color: "#D97706", marginTop: 2 }}><ScanLine size={16} /></div>
                  <div style={{ fontSize: 12, color: "#1E293B", lineHeight: 1.5 }}>
                    <strong style={{ color: "#B45309", display: "block" }}>3. Stok Terpotong Hanya Lewat Scan</strong>
                    Impor CSV hanya menarik data pesanan. Stok gudang baru resmi terpotong saat barcode celana di-scan via tombol <b>"Scan Barcode Kirim"</b> atau tombol scan per baris.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 3. Toolbar: Search, Status Filter Chips & View Mode */}
        <div style={{ padding: "14px 32px", background: "white", borderBottom: "1px solid #E2E8F0", marginTop: 14, flexShrink: 0, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          {/* Search Box */}
          <div style={{ flex: 1, minWidth: 260, display: "flex", alignItems: "center", background: "#F8FAFC", border: "1px solid #CBD5E1", borderRadius: 10, padding: "0 14px", maxWidth: 360 }}>
            <Search size={16} color="#94A3B8" />
            <input 
              style={{ flex: 1, padding: "9px 12px", background: "transparent", border: "none", outline: "none", fontSize: 13, color: "#0F172A" }} 
              placeholder="Cari Order ID, Pembeli, Resi, SKU..." 
              value={search} onChange={e => setSearch(e.target.value)} 
            />
          </div>

          {/* Status Filter Chips */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[
              { id: "semua", label: `Semua (${data.length})` },
              { id: "belum_discan", label: `🔴 Belum Discan (${countBelumDiscan})` },
              { id: "sudah_discan", label: `🟢 Sudah Discan (${countSudahDiscan})` },
              { id: "pre_order", label: `⏳ Pre-Order (${countPreOrder})` }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterStatusScan(tab.id as any)}
                style={{
                  padding: "7px 12px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  border: filterStatusScan === tab.id ? "1px solid #3B82F6" : "1px solid #E2E8F0",
                  background: filterStatusScan === tab.id ? "#EFF6FF" : "#F8FAFC",
                  color: filterStatusScan === tab.id ? "#1D4ED8" : "#64748B",
                  transition: "all 0.15s"
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Dropdown Tipe Pesanan */}
          <select 
            value={filterTipe} 
            onChange={(e) => setFilterTipe(e.target.value)}
            style={{ padding: "8px 12px", background: "#F8FAFC", border: "1px solid #CBD5E1", borderRadius: 8, fontSize: 12, fontWeight: 700, color: "#334155", outline: "none", cursor: "pointer" }}
          >
            <option value="Semua">Semua Tipe</option>
            <option value="Normal">Normal</option>
            <option value="Pre-order">Pre-order</option>
          </select>

          {/* Toggle View Mode */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto", background: "#E2E8F0", padding: 3, borderRadius: 8 }}>
            <button onClick={() => setViewMode("table")} style={{ padding: "6px 12px", fontSize: 12, fontWeight: 800, borderRadius: 6, background: viewMode === "table" ? "white" : "transparent", color: viewMode === "table" ? "#0F172A" : "#64748B", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, boxShadow: viewMode === "table" ? "0 2px 4px rgba(0,0,0,0.05)" : "none", transition: "all 0.2s" }}>
              <TableIcon size={14} /> Daftar Data
            </button>
            <button onClick={() => setViewMode("summary")} style={{ padding: "6px 12px", fontSize: 12, fontWeight: 800, borderRadius: 6, background: viewMode === "summary" ? "white" : "transparent", color: viewMode === "summary" ? "#0F172A" : "#64748B", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, boxShadow: viewMode === "summary" ? "0 2px 4px rgba(0,0,0,0.05)" : "none", transition: "all 0.2s" }}>
              <BarChart2 size={14} /> Rekapan
            </button>
          </div>
        </div>

        {/* 4. Toolbar Baris 2: Filter Tanggal & Pilihan Baris Per Halaman */}
        <div style={{ padding: "10px 32px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", flexShrink: 0, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, color: "#334155" }}>
              <CalendarDays size={15} color="#3B82F6" />
              <span>Filter Tanggal:</span>
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

          {/* Rows Per Page */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>Tampilkan:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              style={{
                padding: "5px 10px",
                background: "white",
                border: "1px solid #CBD5E1",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 700,
                color: "#334155",
                cursor: "pointer",
                outline: "none"
              }}
            >
              <option value={10}>10 per halaman</option>
              <option value={25}>25 per halaman</option>
              <option value={50}>50 per halaman</option>
              <option value={100}>100 per halaman</option>
            </select>
          </div>
        </div>

        <div style={{ flex: 1, overflow: "hidden", display: "flex", position: "relative" }}>
          {/* Main List Area */}
          <div style={{ flex: 1, padding: "20px 32px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ flex: 1, background: "white", borderRadius: 16, border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column" }}>
            
            {loading ? (
              <div style={{ padding: 60, textAlign: "center", color: "#94A3B8" }}> Memuat data...</div>
            ) : viewMode === "summary" ? (
              <div style={{ padding: "32px", overflow: "auto", flex: 1, background: "#F8FAFC" }}>
                <div style={{ marginBottom: 24 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 900, color: "#0F172A", marginBottom: 6 }}>Rekapan Data Penjualan</h2>
                  <p style={{ fontSize: 13, color: "#64748B" }}>Ringkasan singkat performa penjualan dari seluruh pesanan online.</p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginBottom: 32 }}>
                  <div style={{ background: "white", padding: 24, borderRadius: 16, border: "1px solid #E2E8F0", display: "flex", alignItems: "center", gap: 20, boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}>
                    <div style={{ width: 64, height: 64, borderRadius: 16, background: "#EFF6FF", color: "#3B82F6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <ShoppingCart size={32} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Total Pesanan</div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", display: "flex", alignItems: "baseline", gap: 8 }}>
                        {totalPesanan} <span style={{ fontSize: 14, fontWeight: 700, color: "#94A3B8" }}>invoice</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ background: "white", padding: 24, borderRadius: 16, border: "1px solid #E2E8F0", display: "flex", alignItems: "center", gap: 20, boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}>
                    <div style={{ width: 64, height: 64, borderRadius: 16, background: "#FFFBEB", color: "#F59E0B", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Box size={32} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Produk Terjual</div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", display: "flex", alignItems: "baseline", gap: 8 }}>
                        {totalProduk} <span style={{ fontSize: 14, fontWeight: 700, color: "#94A3B8" }}>pcs</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ background: "white", padding: 24, borderRadius: 16, border: "1px solid #E2E8F0", display: "flex", alignItems: "center", gap: 20, boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}>
                    <div style={{ width: 64, height: 64, borderRadius: 16, background: "#ECFDF5", color: "#10B981", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <CreditCard size={32} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Total Pendapatan</div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: "#0F172A" }}>
                        <span style={{ fontSize: 14, color: "#64748B", marginRight: 4 }}>Rp</span>
                        {totalPendapatan.toLocaleString("id-ID")}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                  {/* Top Produk */}
                  <div style={{ background: "white", borderRadius: 16, border: "1px solid #E2E8F0", overflow: "hidden" }}>
                    <div style={{ padding: "16px 20px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", fontSize: 13, fontWeight: 800, color: "#334155" }}>
                      Produk Paling Banyak Terjual
                    </div>
                    <div style={{ padding: 20 }}>
                      {topProdukList.length === 0 ? <div style={{ color: "#94A3B8", fontSize: 13 }}>Belum ada data</div> : null}
                      {topProdukList.map(([name, count], i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: i === topProdukList.length - 1 ? "none" : "1px dashed #E2E8F0" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", flex: 1, paddingRight: 16 }}>{name}</div>
                          <div style={{ fontSize: 13, fontWeight: 900, color: "#F59E0B" }}>{count}x</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                    {/* Top Provinsi */}
                    <div style={{ background: "white", borderRadius: 16, border: "1px solid #E2E8F0", overflow: "hidden" }}>
                      <div style={{ padding: "16px 20px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", fontSize: 13, fontWeight: 800, color: "#334155" }}>
                        Sebaran Provinsi Pembeli
                      </div>
                      <div style={{ padding: 20 }}>
                        {topProvinsiList.length === 0 ? <div style={{ color: "#94A3B8", fontSize: 13 }}>Belum ada data</div> : null}
                        {topProvinsiList.map(([name, count], i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>{name || "Tidak diketahui"}</div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: "#10B981" }}>{count} order</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Top Kurir */}
                    <div style={{ background: "white", borderRadius: 16, border: "1px solid #E2E8F0", overflow: "hidden" }}>
                      <div style={{ padding: "16px 20px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", fontSize: 13, fontWeight: 800, color: "#334155" }}>
                        Ekspedisi Terpopuler
                      </div>
                      <div style={{ padding: 20 }}>
                        {topKurirList.length === 0 ? <div style={{ color: "#94A3B8", fontSize: 13 }}>Belum ada data</div> : null}
                        {topKurirList.map(([name, count], i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>{name || "Tidak diketahui"}</div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: "#3B82F6" }}>{count} order</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : filteredData.length === 0 ? (
              <div style={{ padding: 60, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <ShoppingCart size={48} color="#CBD5E1" style={{ marginBottom: 16 }} />
                <div style={{ fontSize: 16, fontWeight: 800, color: "#334155", marginBottom: 8 }}>Belum ada pesanan yang sesuai filter</div>
                <div style={{ fontSize: 13, color: "#94A3B8", maxWidth: 360, lineHeight: 1.5, marginBottom: 16 }}>
                  Coba ubah rentang tanggal, kata kunci pencarian, atau reset filter status.
                </div>
                {(filterStartDate || filterEndDate || search || filterStatusScan !== "semua" || filterTipe !== "Semua") && (
                  <button
                    onClick={() => {
                      setSearch("");
                      setFilterTipe("Semua");
                      setFilterStatusScan("semua");
                      resetDateFilter();
                    }}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 8,
                      background: "#EFF6FF",
                      border: "1px solid #BFDBFE",
                      color: "#1D4ED8",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6
                    }}
                  >
                    <RefreshCw size={13} /> Reset Semua Filter
                  </button>
                )}
              </div>
            ) : (
              <>
                <div style={{ flex: 1, overflow: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead style={{ position: "sticky", top: 0, zIndex: 10, background: "white" }}>
                    <tr style={{ borderBottom: "2px solid #E2E8F0" }}>
                      <th style={{ padding: "14px 18px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 }}>Order ID & Waktu</th>
                      <th style={{ padding: "14px 18px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 }}>Pembeli & Ekspedisi</th>
                      <th style={{ padding: "14px 18px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 }}>Produk (Seller SKU)</th>
                      <th style={{ padding: "14px 18px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 }}>Nominal</th>
                      <th style={{ padding: "14px 18px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 }}>Status Pengemasan & Stok</th>
                      <th style={{ padding: "14px 18px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, textAlign: "right" }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.map(d => {
                      const isSelected = selectedPenjualan?.id === d.id;
                      const isSudahDiscan = d.status_kemas === "Sudah Discan";
                      return (
                      <tr 
                        key={d.id} 
                        className="table-row-hover" 
                        onClick={() => setSelectedPenjualan(d)} 
                        style={{ 
                          borderBottom: "1px solid #F1F5F9", 
                          background: isSelected ? "#F8FAFC" : "transparent", 
                          cursor: "pointer", 
                          transition: "background 0.15s" 
                        }}
                      >
                        {/* 1. Order ID & Waktu */}
                        <td style={{ padding: "14px 18px" }}>
                          <div style={{ fontWeight: 800, fontSize: 13, color: "#0F172A", fontFamily: "monospace", display: "flex", alignItems: "center", gap: 6 }}>
                            {d.order_id}
                            {d.marketplace && (
                              <span style={{ 
                                fontFamily: "inherit", fontSize: 9, fontWeight: 800, padding: "1px 6px", borderRadius: 4, 
                                background: d.marketplace === "Shopee" ? "#FFEDD5" : "#EFF6FF", 
                                color: d.marketplace === "Shopee" ? "#C2410C" : "#1D4ED8",
                                border: d.marketplace === "Shopee" ? "1px solid #FED7AA" : "1px solid #BFDBFE"
                              }}>
                                {d.marketplace}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: "#64748B", marginTop: 5, display: "flex", alignItems: "center", gap: 4 }}>
                            <Calendar size={11}/> Psn: {d.tanggal_pesanan || "-"}
                          </div>
                          <div style={{ fontSize: 11, color: d.tipe_pesanan === "Pre-order" ? "#D97706" : "#64748B", marginTop: 2, display: "flex", alignItems: "center", gap: 4, fontWeight: d.tipe_pesanan === "Pre-order" ? 700 : 400 }}>
                            <Clock size={11}/> SLA: {computeJatuhTempo(d.tanggal_pesanan, d.tipe_pesanan)}
                          </div>
                        </td>

                        {/* 2. Pembeli & Ekspedisi */}
                        <td style={{ padding: "14px 18px", maxWidth: 200 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: "#334155", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {d.recipient}
                          </div>
                          <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>@{d.buyer_username}</div>
                          {d.tracking_id && (
                            <div style={{ fontSize: 10.5, color: "#64748B", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                              <Truck size={11} color="#3B82F6" /> {d.shipping_provider || "Kurir"}: <b style={{ fontFamily: "monospace", color: "#0F172A" }}>{d.tracking_id}</b>
                            </div>
                          )}
                        </td>

                        {/* 3. Produk & SKU */}
                        <td style={{ padding: "14px 18px", maxWidth: 280 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontWeight: 800, fontSize: 13, color: "#1D4ED8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {d.seller_sku}
                            </span>
                            <span style={{ background: "#EFF6FF", color: "#1D4ED8", fontWeight: 800, fontSize: 11, padding: "1px 6px", borderRadius: 4 }}>
                              x{d.quantity}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: "#64748B", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {d.variation || d.product_name}
                          </div>
                        </td>

                        {/* 4. Nominal */}
                        <td style={{ padding: "14px 18px" }}>
                          <div style={{ fontWeight: 800, fontSize: 13, color: "#10B981" }}>
                            Rp {parseInt(d.order_amount || "0").toLocaleString("id-ID")}
                          </div>
                          <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 2 }}>
                            {d.payment_method || "Transfer"}
                          </div>
                        </td>

                        {/* 5. Status Pengemasan & Stok */}
                        <td style={{ padding: "14px 18px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-start" }}>
                            {/* Status Marketplace */}
                            <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                              <span style={{ 
                                padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 800, letterSpacing: 0.3,
                                background: (d.dibatalkan || d.status === "Dibatalkan") ? "#FEE2E2" : d.status === "Selesai" ? "#DCFCE7" : d.status === "Dikirim" ? "#DBEAFE" : "#F1F5F9",
                                color: (d.dibatalkan || d.status === "Dibatalkan") ? "#DC2626" : d.status === "Selesai" ? "#047857" : d.status === "Dikirim" ? "#1D4ED8" : "#475569"
                              }}>
                                {d.dibatalkan ? "Dibatalkan" : d.status}
                              </span>
                              {(d.tipe_pesanan === "Pre-order") && (
                                <span style={{ background: "#FEF3C7", color: "#D97706", padding: "1px 6px", borderRadius: 4, fontSize: 9.5, fontWeight: 800, border: "1px solid #FDE68A" }}>
                                  PRE-ORDER
                                </span>
                              )}
                            </div>

                            {/* Status Fisik Scan Barcode Gudang */}
                            <span 
                              title="Status scan fisik celana yang keluar dari gudang" 
                              style={{ 
                                padding: "3px 8px", borderRadius: 6, fontSize: 10.5, fontWeight: 800, border: "1px solid", 
                                background: isSudahDiscan ? "#ECFDF5" : d.status_kemas === "Sebagian Discan" ? "#FFFBEB" : "#FEF2F2", 
                                color: isSudahDiscan ? "#047857" : d.status_kemas === "Sebagian Discan" ? "#B45309" : "#B91C1C", 
                                borderColor: isSudahDiscan ? "#A7F3D0" : d.status_kemas === "Sebagian Discan" ? "#FDE68A" : "#FECACA",
                                display: "inline-flex", alignItems: "center", gap: 4
                              }}
                            >
                              {isSudahDiscan ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                              {d.status_kemas || "Belum Discan"} ({d.scanned_qty || 0}/{d.order_qty || d.quantity})
                            </span>

                            <span style={{ fontSize: 9.5, color: isSudahDiscan ? "#10B981" : "#F97316", fontWeight: 700 }}>
                              {isSudahDiscan ? "✓ Stok gudang terpotong" : "Stok belum terpotong"}
                            </span>
                          </div>
                        </td>

                        {/* 6. Aksi */}
                        <td style={{ padding: "14px 18px", textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end" }}>
                            {!isSudahDiscan ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setScanOrderId(d.order_id);
                                  setShowScan(true);
                                }}
                                style={{
                                  background: "linear-gradient(135deg,#F97316,#EA580C)",
                                  color: "white",
                                  padding: "6px 12px",
                                  borderRadius: 8,
                                  fontSize: 11,
                                  fontWeight: 800,
                                  border: "none",
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 5,
                                  boxShadow: "0 2px 6px rgba(249,115,22,0.25)"
                                }}
                              >
                                <ScanLine size={13} /> Scan Kirim
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedPenjualan(d);
                                }}
                                style={{
                                  background: "#EFF6FF",
                                  color: "#1D4ED8",
                                  border: "1px solid #BFDBFE",
                                  padding: "6px 12px",
                                  borderRadius: 8,
                                  fontSize: 11,
                                  fontWeight: 800,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4
                                }}
                              >
                                <CheckCircle2 size={13} /> Rincian Scan
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer Bar */}
              <div style={{ 
                padding: "12px 24px", 
                background: "white", 
                borderTop: "1px solid #E2E8F0", 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center", 
                flexWrap: "wrap", 
                gap: 12,
                flexShrink: 0
              }}>
                <div style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>
                  Menampilkan <b style={{ color: "#0F172A" }}>{totalItems === 0 ? 0 : startIndex + 1} - {endIndex}</b> dari <b style={{ color: "#0F172A" }}>{totalItems}</b> pesanan
                  {(filterStartDate || filterEndDate || search || filterStatusScan !== "semua" || filterTipe !== "Semua") && (
                    <span style={{ marginLeft: 6, fontSize: 11, color: "#3B82F6", fontWeight: 700 }}>
                      (hasil sortir dari {data.length} total)
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  {/* Tombol Pertama */}
                  <button
                    type="button"
                    onClick={() => setCurrentPage(1)}
                    disabled={safeCurrentPage === 1}
                    title="Halaman Pertama"
                    style={{
                      padding: "6px 8px",
                      borderRadius: 6,
                      border: "1px solid #E2E8F0",
                      background: safeCurrentPage === 1 ? "#F8FAFC" : "white",
                      color: safeCurrentPage === 1 ? "#CBD5E1" : "#334155",
                      cursor: safeCurrentPage === 1 ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12
                    }}
                  >
                    <ChevronsLeft size={14} />
                  </button>

                  {/* Tombol Sebelumnya */}
                  <button
                    type="button"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={safeCurrentPage === 1}
                    title="Sebelumnya"
                    style={{
                      padding: "6px 12px",
                      borderRadius: 6,
                      border: "1px solid #E2E8F0",
                      background: safeCurrentPage === 1 ? "#F8FAFC" : "white",
                      color: safeCurrentPage === 1 ? "#CBD5E1" : "#334155",
                      cursor: safeCurrentPage === 1 ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 12,
                      fontWeight: 700
                    }}
                  >
                    <ChevronLeft size={14} /> Prev
                  </button>

                  {/* Nomor Halaman */}
                  {getPageNumbers().map((p, idx) => {
                    if (p === "...") {
                      return (
                        <span key={`ellipsis-${idx}`} style={{ padding: "0 6px", color: "#94A3B8", fontSize: 12, userSelect: "none" }}>
                          ...
                        </span>
                      );
                    }
                    const isCurrent = p === safeCurrentPage;
                    return (
                      <button
                        key={`page-${p}`}
                        type="button"
                        onClick={() => setCurrentPage(Number(p))}
                        style={{
                          minWidth: 32,
                          height: 32,
                          padding: "0 8px",
                          borderRadius: 6,
                          border: isCurrent ? "1px solid #3B82F6" : "1px solid #E2E8F0",
                          background: isCurrent ? "#3B82F6" : "white",
                          color: isCurrent ? "white" : "#334155",
                          fontWeight: isCurrent ? 800 : 700,
                          cursor: "pointer",
                          fontSize: 12,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: isCurrent ? "0 2px 4px rgba(59,130,246,0.3)" : "none"
                        }}
                      >
                        {p}
                      </button>
                    );
                  })}

                  {/* Tombol Selanjutnya */}
                  <button
                    type="button"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={safeCurrentPage >= totalPages}
                    title="Selanjutnya"
                    style={{
                      padding: "6px 12px",
                      borderRadius: 6,
                      border: "1px solid #E2E8F0",
                      background: safeCurrentPage >= totalPages ? "#F8FAFC" : "white",
                      color: safeCurrentPage >= totalPages ? "#CBD5E1" : "#334155",
                      cursor: safeCurrentPage >= totalPages ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 12,
                      fontWeight: 700
                    }}
                  >
                    Next <ChevronRight size={14} />
                  </button>

                  {/* Tombol Terakhir */}
                  <button
                    type="button"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={safeCurrentPage >= totalPages}
                    title="Halaman Terakhir"
                    style={{
                      padding: "6px 8px",
                      borderRadius: 6,
                      border: "1px solid #E2E8F0",
                      background: safeCurrentPage >= totalPages ? "#F8FAFC" : "white",
                      color: safeCurrentPage >= totalPages ? "#CBD5E1" : "#334155",
                      cursor: safeCurrentPage >= totalPages ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12
                    }}
                  >
                    <ChevronsRight size={14} />
                  </button>
                </div>
              </div>
            </>
          )}
          </div>
        </div>

        {/* Detail Drawer */}
        <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 400, background: "white", borderLeft: "1px solid #E2E8F0", boxShadow: "-4px 0 24px rgba(0,0,0,0.05)", transform: selectedPenjualan ? "translateX(0)" : "translateX(100%)", transition: "transform 0.3s cubic-bezier(0.16,1,0.3,1)", display: "flex", flexDirection: "column", zIndex: 20 }}>
          {selectedPenjualan && (
            <>
              <div style={{ padding: "24px", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#10B981", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Detail Pesanan</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#0F172A", fontFamily: "monospace" }}>{selectedPenjualan.order_id}</div>
                </div>
                <button onClick={() => setSelectedPenjualan(null)} style={{ background: "white", border: "1px solid #E2E8F0", width: 32, height: 32, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B" }}>
                  <ChevronRight size={16} />
                </button>
              </div>
              
              <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
                <div style={{ marginBottom: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div style={{ background: "white", padding: 12, borderRadius: 12, border: "1px solid #E2E8F0" }}>
                    <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><Calendar size={12}/> Waktu Pesanan</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginTop: 4 }}>{selectedPenjualan.tanggal_pesanan || "-"}</div>
                  </div>
                  <div style={{ background: selectedPenjualan.tipe_pesanan === "Pre-order" ? "#FFFBEB" : "white", padding: 12, borderRadius: 12, border: selectedPenjualan.tipe_pesanan === "Pre-order" ? "1px solid #FDE68A" : "1px solid #E2E8F0" }}>
                    <div style={{ fontSize: 11, color: selectedPenjualan.tipe_pesanan === "Pre-order" ? "#D97706" : "#64748B", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><Clock size={12}/> Jatuh Tempo / SLA</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: selectedPenjualan.tipe_pesanan === "Pre-order" ? "#92400E" : "#0F172A", marginTop: 4 }}>
                      {computeJatuhTempo(selectedPenjualan.tanggal_pesanan, selectedPenjualan.tipe_pesanan)}
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                    <FileText size={16}/> Informasi Produk
                  </div>
                  <div style={{ background: "#F8FAFC", padding: 16, borderRadius: 12, border: "1px solid #E2E8F0" }}>
                    <div style={{ fontWeight: 800, color: "#0F172A", fontSize: 14, marginBottom: 4 }}>{selectedPenjualan.product_name}</div>
                    <div style={{ color: "#3B82F6", fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{selectedPenjualan.variation}</div>
                    <div style={{ display: "flex", gap: 16, borderTop: "1px dashed #CBD5E1", paddingTop: 12 }}>
                      <div>
                        <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>Quantity</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>{selectedPenjualan.quantity} pcs</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>Seller SKU</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#1D4ED8" }}>{selectedPenjualan.seller_sku}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                    <User size={16}/> Info Pembeli
                  </div>
                  <div style={{ background: "white", padding: 16, borderRadius: 12, border: "1px solid #E2E8F0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>Penerima</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{selectedPenjualan.recipient}</div>
                      <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>{selectedPenjualan.phone || "-"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>Username</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>@{selectedPenjualan.buyer_username}</div>
                    </div>
                    <div style={{ gridColumn: "span 2", borderTop: "1px dashed #E2E8F0", paddingTop: 16 }}>
                      <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>Alamat Pengiriman</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", marginTop: 4 }}>{selectedPenjualan.city}, {selectedPenjualan.province}</div>
                      <div style={{ fontSize: 12, color: "#64748B", marginTop: 2, lineHeight: 1.5 }}>{selectedPenjualan.address}</div>
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                    <Truck size={16}/> Ekspedisi & Resi
                  </div>
                  <div style={{ background: "white", padding: 16, borderRadius: 12, border: "1px solid #E2E8F0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>Kurir</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{selectedPenjualan.shipping_provider || "-"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>No. Resi</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{selectedPenjualan.tracking_id || "-"}</div>
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                    <CreditCard size={16}/> Pembayaran & Status
                  </div>
                  <div style={{ background: "white", padding: 16, borderRadius: 12, border: "1px solid #E2E8F0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>Metode</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#1D4ED8" }}>{selectedPenjualan.payment_method || "-"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>Total Dibayar</div>
                      <div style={{ fontSize: 14, fontWeight: 900, color: "#10B981" }}>Rp {parseInt(selectedPenjualan.order_amount || "0").toLocaleString("id-ID")}</div>
                    </div>
                  </div>
                </div>
                
                <div style={{ background: selectedPenjualan.barcodes?.length ? "#ECFDF5" : "#FEF2F2", border: `1px solid ${selectedPenjualan.barcodes?.length ? "#A7F3D0" : "#FECACA"}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: selectedPenjualan.barcodes?.length ? "#065F46" : "#991B1B", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    <Box size={14}/> Barang Keluar dari Gudang ({selectedPenjualan.scanned_qty || 0}/{selectedPenjualan.order_qty || selectedPenjualan.quantity} pcs)
                  </div>
                  {(selectedPenjualan.dibatalkan || selectedPenjualan.status === "Dibatalkan") && (selectedPenjualan.scanned_qty || 0) > 0 && (
                    <div style={{ fontSize: 12, color: "#991B1B", background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: 8, padding: "8px 12px", marginBottom: 10, lineHeight: 1.5, fontWeight: 600 }}>
                      🚨 <b>PERINGATAN: Pesanan ini dibatalkan di marketplace!</b><br />
                      Ada {selectedPenjualan.scanned_qty} pcs barcode yang sudah ter-scan keluar. Klik tombol <b>Batalkan</b> pada tiap barcode di bawah agar barang kembali ke stok gudang.
                    </div>
                  )}
                  {(selectedPenjualan.scanned_qty || 0) > (selectedPenjualan.order_qty || selectedPenjualan.quantity) && (
                    <div style={{ fontSize: 11, color: "#B45309", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "6px 10px", marginBottom: 8, lineHeight: 1.5 }}>
                      ⚠️ <b>Kelebihan scan</b>: pesanan hanya {selectedPenjualan.order_qty || selectedPenjualan.quantity} pcs. Klik <b>Batalkan</b> pada pcs yang salah agar kembali ke stok.
                    </div>
                  )}
                  {selectedPenjualan.barcodes?.length ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {selectedPenjualan.barcodes.map((b: any) => (
                        <div key={b.kode} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "white", borderRadius: 8, padding: "6px 10px", fontSize: 12 }}>
                          <div><b style={{ fontFamily: "monospace" }}>{b.kode}</b><div style={{ fontSize: 11, color: "#64748B" }}>{b.nama_barang} · Size {b.size} · {b.no_transaksi} · {new Date(b.tanggal_kirim).toLocaleDateString("id-ID", { dateStyle: "medium" })}</div></div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 6, background: b.status === "retur_stok" ? "#DBEAFE" : b.status === "retur_banding" ? "#FEF3C7" : "#DCFCE7", color: b.status === "retur_stok" ? "#1D4ED8" : b.status === "retur_banding" ? "#92400E" : "#047857" }}>{b.status === "retur_stok" ? "Retur → Stok" : b.status === "retur_banding" ? "Retur → Banding" : "Terkirim"}</span>
                            {b.status === "terjual" && (
                              <button
                                id={`batal-scan-${b.kode}`}
                                title="Batalkan scan pcs ini (salah / kelebihan scan) — pcs kembali ke stok"
                                disabled={cancelingKode === b.kode}
                                onClick={() => handleBatalScan(b)}
                                style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 6, border: "1px solid #FECACA", background: "#FEF2F2", color: "#B91C1C", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3 }}
                              >
                                <X size={10} /> {cancelingKode === b.kode ? "..." : "Batalkan"}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: "#B91C1C", lineHeight: 1.5 }}>Belum ada barcode yang di-scan untuk pesanan ini, stok gudang <b>belum</b> berkurang.</div>
                  )}
                  {(selectedPenjualan.scanned_qty || 0) < (selectedPenjualan.order_qty || selectedPenjualan.quantity) && (
                    <button onClick={() => { setScanOrderId(selectedPenjualan.order_id); setShowScan(true); }} style={{ marginTop: 10, width: "100%", padding: 10, borderRadius: 8, border: "none", background: "linear-gradient(135deg,#F97316,#EC4899)", color: "white", fontWeight: 800, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <ScanLine size={14} /> Scan Barang untuk Order Ini
                    </button>
                  )}
                </div>
                {selectedPenjualan.returs?.length > 0 && (
                  <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 12, padding: 16, marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#92400E", marginBottom: 6 }}>Riwayat Retur</div>
                    {selectedPenjualan.returs.map((r: any) => (
                      <div key={r.id} style={{ fontSize: 12, color: "#78350F", padding: "4px 0", borderTop: "1px dashed #FDE68A" }}>
                        <b>{r.no_retur}</b> · {r.kode_barcode || "tanpa barcode"} · {r.kondisi === "sesuai" ? "Sesuai → kembali ke stok" : `${r.jenis_masalah} → ${r.status}`}
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ paddingTop: 16, borderTop: "1px solid #E2E8F0" }}>
                  <button
                    type="button"
                    disabled={deletingOrder === selectedPenjualan.order_id}
                    onClick={() => handleHapusPesanan(selectedPenjualan.order_id)}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "1px solid #FECACA",
                      background: "#FEF2F2",
                      color: "#DC2626",
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      transition: "all 0.15s"
                    }}
                  >
                    <Trash2 size={14} /> {deletingOrder === selectedPenjualan.order_id ? "Menghapus..." : "Hapus Pesanan dari Sistem"}
                  </button>
                  <div style={{ fontSize: 10, color: "#94A3B8", textAlign: "center", marginTop: 6 }}>
                    Gunakan untuk membersihkan pesanan uji coba / pesanan yang dibatalkan.
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      </div>
    </>
  );
}
