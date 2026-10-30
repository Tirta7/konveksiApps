"use client";

import { useState, useEffect, useCallback } from "react";
import {
  UploadCloud,
  CheckCircle,
  Search,
  XCircle,
  FileText,
  ChevronRight,
  User,
  Truck,
  CreditCard,
  BarChart2,
  Table as TableIcon,
  ScanLine,
  Scale,
  FileSpreadsheet,
  ExternalLink,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";
import ReturMarketplacePanel from "@/components/ReturMarketplacePanel";
import { subscribeRealtime, subscribeRealtimeEvent } from "@/lib/realtime-client";

export default function ReturOnlinePage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("Semua");
  const [filterType, setFilterType] = useState("Semua");
  const [uploading, setUploading] = useState(false);
  const [syncingMp, setSyncingMp] = useState(false);
  const [selectedRetur, setSelectedRetur] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "summary">("table");
  const [tab, setTab] = useState<"scan" | "banding" | "csv">("scan");
  const [scanOrderId, setScanOrderId] = useState<string | null>(null);

  const handleSyncMarketplace = async () => {
    setSyncingMp(true);
    try {
      const res = await fetch("/api/marketplace/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal sinkron marketplace");
      toast.success("Sinkronisasi pesanan & retur dari toko marketplace selesai!");
      await fetchData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSyncingMp(false);
    }
  };

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/returns/online?_t=${Date.now()}`);
      const json = await res.json();
      if (Array.isArray(json)) {
        setData(json);
        setSelectedRetur((prev: any) => (prev ? json.find((x: any) => x.id === prev.id) || null : null));
      }
    } catch {
      toast.error("Gagal mengambil data retur online");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const unSync = subscribeRealtime(() => fetchData());
    const unEvent = subscribeRealtimeEvent((ev) => {
      if (ev === "retur_processed" || ev === "retur_online_updated" || ev === "retur_deleted") {
        fetchData();
      }
    });
    return () => {
      unSync();
      unEvent();
    };
  }, [fetchData]);

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

        // Deteksi jenis file CSV (TikTok Return CSV, Shopee Return/Order CSV, atau TikTok Order CSV)
        const isTiktokReturnCSV = headers.includes("Return Order ID") || headers.includes("Return Reason");
        const isShopeeReturnCSV =
          headers.includes("No. Pengajuan") ||
          headers.includes("Alasan Pengembalian") ||
          headers.includes("Status Pengembalian");
        const isShopeeOrderCSV = headers.includes("No. Pesanan");

        const filtered = rows.filter((row: any) => {
          const orderId =
            row["Order ID"] || row["No. Pesanan"] || row["ID Pesanan"] || row["Return Order ID"] || row["Nomor Invoice"] || "";
          if (!orderId || String(orderId).includes("Platform unique")) return false;

          if (isTiktokReturnCSV || isShopeeReturnCSV) return true;

          const status = String(row["Order Status"] || row["Status Pesanan"] || "").toLowerCase();
          const cancelType = String(
            row["Cancelation/Return Type"] || row["Status Pembatalan/ Pengembalian"] || row["Alasan Pembatalan"] || ""
          ).toLowerCase();
          return (
            status.includes("batal") ||
            status.includes("cancel") ||
            status.includes("retur") ||
            status.includes("pengembalian") ||
            cancelType.includes("return") ||
            cancelType.includes("refund") ||
            cancelType.includes("cancel") ||
            cancelType.includes("batal") ||
            cancelType.includes("pengembalian")
          );
        });

        if (filtered.length === 0) {
          toast.info("Tidak ditemukan pesanan batal/retur di dalam file CSV ini.");
          setUploading(false);
          e.target.value = "";
          return;
        }

        const formatted = filtered.map((row: any) => {
          if (isTiktokReturnCSV) {
            let amount = row["Order Amount"] || row["Return unit price"] || "0";
            if (typeof amount === "string") amount = amount.replace(/\D/g, "");

            return {
              marketplace: "TikTok Shop",
              order_id: String(row["Order ID"] || "").trim(),
              product_name: row["Product Name"] || "-",
              variation: row["SKU Name"] || row["Variation"] || "-",
              return_quantity: parseInt(row["Return Quantity"]) || 1,
              return_type: row["Return Type"] || "Return/Refund",
              alasan: row["Return Reason"] || "-",
              buyer_note: row["Buyer Note"] || "-",
              tanggal_batal: row["Time Requested"] || "-",
              buyer_username: row["Buyer Username"] || "-",
              recipient: row["Recipient"] || "-",
              phone: row["Phone #"] || "-",
              address: "-",
              tracking_id: row["Return Logistics Tracking ID"] || row["Tracking ID"] || "-",
              shipping_provider: row["Return Logistics Provider"] || "-",
              order_amount: amount || "0",
              payment_method: row["Payment Method"] || "-",
              seller_sku: row["Seller SKU"] || "-",
            };
          } else if (isShopeeReturnCSV || isShopeeOrderCSV) {
            const qtyString =
              row["Jumlah Produk Dikembalikan"] || row["Jumlah"] || row["Sku Quantity of return"] || "1";
            let amount =
              row["Jumlah Pengembalian Dana"] ||
              row["Total Harga Produk"] ||
              row["Total Harga Pembeli"] ||
              row["Order Amount"] ||
              "0";
            if (typeof amount === "string") amount = amount.replace(/\D/g, "");

            const statusPembatalan =
              row["Status Pembatalan/ Pengembalian"] || row["Status Pengembalian"] || row["Status Pesanan"] || "";
            const isReturn =
              isShopeeReturnCSV ||
              /pengembalian|retur|return/i.test(statusPembatalan) ||
              Boolean(row["Alasan Pengembalian"]);

            const addrParts = [row["Alamat Lengkap"], row["Kota/Kabupaten"], row["Provinsi"]].filter(Boolean);

            return {
              marketplace: "Shopee",
              order_id: String(row["No. Pesanan"] || row["Order ID"] || "").trim(),
              product_name: row["Nama Produk"] || row["Product Name"] || "-",
              variation: row["Nama Variasi"] || row["Variation"] || "-",
              return_quantity: parseInt(qtyString) || 1,
              return_type: isReturn ? "Return/Refund" : "Cancel",
              alasan: row["Alasan Pengembalian"] || row["Alasan Pembatalan"] || "-",
              buyer_note: row["Catatan dari Pembeli"] || row["Catatan Pembeli"] || "-",
              tanggal_batal:
                row["Waktu Pengajuan Pengembalian"] ||
                row["Waktu Pesanan Dibatalkan"] ||
                row["Waktu Pesanan Dibuat"] ||
                "-",
              buyer_username: row["Username (Pembeli)"] || "-",
              recipient: row["Nama Penerima"] || "-",
              phone: row["No. Telepon"] || "-",
              address: addrParts.length > 0 ? addrParts.join(", ") : "-",
              tracking_id: row["No. Resi Pengembalian"] || row["No. Resi"] || "-",
              shipping_provider: row["Jasa Kirim Pengembalian"] || row["Opsi Pengiriman"] || "-",
              order_amount: amount || "0",
              payment_method: row["Metode Pembayaran"] || "-",
              seller_sku: row["Nomor Referensi SKU"] || row["SKU Induk"] || "-",
            };
          } else {
            const qtyString = row["Sku Quantity of return"] || row["Quantity"] || "1";
            let amount = row["Order Amount"] || "0";
            if (typeof amount === "string") amount = amount.replace(/\D/g, "");

            return {
              marketplace: "TikTok Shop",
              order_id: String(row["Order ID"] || "").trim(),
              product_name: row["Product Name"] || "-",
              variation: row["Variation"] || "-",
              return_quantity: parseInt(qtyString) || 1,
              return_type: row["Cancelation/Return Type"] || "Cancel",
              alasan: row["Cancel Reason"] || "-",
              buyer_note: row["Buyer Note"] || "-",
              tanggal_batal: row["Cancelled Time"] || row["Created Time"] || "-",
              buyer_username: row["Buyer Username"] || "-",
              recipient: row["Recipient"] || "-",
              phone: row["Phone #"] || "-",
              address: `${row["Detail Address"] || ""}, ${row["Regency and City"] || ""}, ${row["Province"] || ""}`,
              tracking_id: row["Tracking ID"] || "-",
              shipping_provider: row["Shipping Provider Name"] || "-",
              order_amount: amount || "0",
              payment_method: row["Payment Method"] || "-",
              seller_sku: row["Seller SKU"] || "-",
            };
          }
        });

        try {
          const res = await fetch("/api/returns/online", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formatted),
          });
          const json = await res.json();
          if (res.ok) {
            toast.success(
              `Berhasil menambahkan ${json.added ?? 0} data retur baru${
                json.skipped ? ` (${json.skipped} sudah ada, dilewati)` : ""
              }.`
            );
            fetchData();
          } else {
            toast.error(json.error || "Gagal menyimpan data");
          }
        } catch {
          toast.error("Terjadi kesalahan saat menyimpan data");
        } finally {
          setUploading(false);
          e.target.value = "";
        }
      },
      error: (_err: any) => {
        toast.error("Gagal membaca file CSV");
        setUploading(false);
      },
    });
  };

  const updateStatus = async (d: any, status: string) => {
    try {
      const res = await fetch("/api/returns/online", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: d.id, order_id: d.order_id, status }),
      });
      if (res.ok) {
        toast.success(`Status pesanan ${d.order_id} diubah menjadi "${status}"`);
        fetchData();
      } else {
        const json = await res.json();
        toast.error(json.error || "Gagal update status");
      }
    } catch {
      toast.error("Gagal update status");
    }
  };

  const deleteRow = async (d: any) => {
    if (!confirm(`Hapus baris laporan retur ${d.order_id} (${d.product_name})?`)) return;
    try {
      const res = await fetch(`/api/returns/online?id=${encodeURIComponent(d.id)}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Data retur berhasil dihapus");
        if (selectedRetur?.id === d.id) setSelectedRetur(null);
        fetchData();
      } else {
        const j = await res.json();
        toast.error(j.error || "Gagal menghapus data");
      }
    } catch {
      toast.error("Gagal menghapus data");
    }
  };

  const filtered = data.filter((d) => {
    if (d.order_id && String(d.order_id).includes("Platform unique")) return false;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      d.order_id?.toLowerCase().includes(q) ||
      d.product_name?.toLowerCase().includes(q) ||
      d.tracking_id?.toLowerCase().includes(q) ||
      d.recipient?.toLowerCase().includes(q) ||
      d.buyer_username?.toLowerCase().includes(q);
    const matchStatus =
      filterStatus === "Semua" ||
      (filterStatus === "Menunggu Gudang"
        ? !d.status || d.status === "Menunggu Gudang" || String(d.status).startsWith("Sebagian")
        : d.status === filterStatus);
    const matchType =
      filterType === "Semua" ||
      (filterType === "Cancel" && d.return_type === "Cancel") ||
      (filterType === "Return" && d.return_type !== "Cancel");
    return matchSearch && matchStatus && matchType;
  });

  // Analytics Computation
  let totalRetur = 0;
  let totalCancel = 0;
  let totalKerugian = 0;

  const alasanMap: Record<string, number> = {};
  const produkMap: Record<string, number> = {};
  const provinsiMap: Record<string, number> = {};
  const kurirMap: Record<string, number> = {};

  data.forEach((d) => {
    if (d.return_type !== "Cancel") totalRetur++;
    else totalCancel++;

    const amt = typeof d.order_amount === "string" ? parseInt(d.order_amount.replace(/\D/g, "")) : d.order_amount;
    totalKerugian += amt || 0;

    if (d.alasan && d.alasan !== "-") {
      alasanMap[d.alasan] = (alasanMap[d.alasan] || 0) + 1;
    }
    if (d.product_name) {
      const p = `${d.product_name} (${d.variation})`;
      produkMap[p] = (produkMap[p] || 0) + 1;
    }
    if (d.address && d.address !== "-") {
      const parts = d.address.split(", ");
      const prov = parts[parts.length - 1];
      if (prov) {
        provinsiMap[prov] = (provinsiMap[prov] || 0) + 1;
      }
    }
    if (d.shipping_provider && d.shipping_provider !== "-") {
      kurirMap[d.shipping_provider] = (kurirMap[d.shipping_provider] || 0) + 1;
    }
  });

  const topAlasan = Object.entries(alasanMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const topProduk = Object.entries(produkMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const topProvinsi = Object.entries(provinsiMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const topKurir = Object.entries(kurirMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <>
      <style>{`
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 99px; }
        .table-row-hover:hover { background: #F8FAFC; }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#F1F5F9", overflow: "hidden" }}>
        <div
          style={{
            padding: "24px 32px",
            background: "white",
            borderBottom: "1px solid #E2E8F0",
            flexShrink: 0,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", marginBottom: 4 }}>Retur Penjualan (Online)</h1>
            <p style={{ fontSize: 13, color: "#64748B" }}>
              Scan barang retur dari Shopee / TikTok / marketplace lain — sesuai kembali ke stok, tidak sesuai diajukan
              banding.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={handleSyncMarketplace}
              disabled={syncingMp}
              title="Tarik data pesanan & retur terbaru dari API Shopee / TikTok Shop"
              style={{
                background: "#ECFDF5",
                color: "#047857",
                border: "1px solid #A7F3D0",
                padding: "8px 12px",
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 800,
                cursor: syncingMp ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <RefreshCw size={14} className={syncingMp ? "animate-spin" : ""} />
              {syncingMp ? "Sinkron..." : "Sinkron API"}
            </button>
            <a
              href="/portal-retur"
              target="_blank"
              title="Buka portal terisolasi tanpa menu admin untuk staf gudang retur"
              style={{
                background: "#0F172A",
                color: "white",
                padding: "8px 14px",
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 800,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                boxShadow: "0 2px 6px rgba(15,23,42,0.15)",
              }}
            >
              <ExternalLink size={14} /> Mode Portal Gudang
            </a>

            <div style={{ display: "flex", background: "#F1F5F9", borderRadius: 10, padding: 4 }}>
              {(
                [
                  ["scan", "Scan Retur Datang", ScanLine],
                  ["banding", "Banding Marketplace", Scale],
                  ["csv", "Laporan Retur CSV", FileSpreadsheet],
                ] as const
              ).map(([k, l, I]) => (
                <button
                  key={k}
                  id={`tab-retur-${k}`}
                  onClick={() => setTab(k)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "none",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: tab === k ? "white" : "transparent",
                    color: tab === k ? "#0F172A" : "#64748B",
                    boxShadow: tab === k ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                  }}
                >
                  <I size={14} /> {l}
                </button>
              ))}
            </div>
            {tab === "csv" && (
              <label
                style={{
                  background: "#2563EB",
                  color: "white",
                  padding: "10px 16px",
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 800,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: uploading ? "not-allowed" : "pointer",
                  opacity: uploading ? 0.7 : 1,
                }}
              >
                <UploadCloud size={18} />
                {uploading ? "Memproses..." : "Upload CSV Retur (TikTok / Shopee)"}
                <input type="file" accept=".csv" onChange={handleFileUpload} disabled={uploading} style={{ display: "none" }} />
              </label>
            )}
          </div>
        </div>

        {tab !== "csv" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
            <ReturMarketplacePanel
              key={tab}
              tab={tab}
              initialOrderId={scanOrderId}
              onClearInitialOrder={() => setScanOrderId(null)}
            />
          </div>
        )}

        {tab === "csv" && (
          <>
            <div
              style={{
                padding: "16px 32px",
                background: "white",
                borderBottom: "1px solid #E2E8F0",
                flexShrink: 0,
                display: "flex",
                gap: 16,
                alignItems: "center",
              }}
            >
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  background: "#F8FAFC",
                  border: "1px solid #CBD5E1",
                  borderRadius: 10,
                  padding: "0 14px",
                  maxWidth: 420,
                }}
              >
                <Search size={18} color="#94A3B8" />
                <input
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    fontSize: 14,
                    color: "#0F172A",
                  }}
                  placeholder="Cari Order ID, Resi, Produk, atau Pembeli..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <select
                  style={{
                    padding: "10px 14px",
                    border: "1px solid #CBD5E1",
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#334155",
                    background: "white",
                    outline: "none",
                  }}
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="Semua">Semua Status Gudang</option>
                  <option value="Menunggu Gudang">Menunggu Gudang / Sebagian</option>
                  <option value="Masuk Gudang">Masuk Gudang (Diterima)</option>
                  <option value="Hilang">Hilang</option>
                </select>
                <select
                  style={{
                    padding: "10px 14px",
                    border: "1px solid #CBD5E1",
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#334155",
                    background: "white",
                    outline: "none",
                  }}
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                >
                  <option value="Semua">Semua Tipe Batal</option>
                  <option value="Cancel">Cancel</option>
                  <option value="Return">Return/Refund</option>
                </select>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginLeft: "auto",
                  background: "#E2E8F0",
                  padding: 4,
                  borderRadius: 10,
                }}
              >
                <button
                  onClick={() => setViewMode("table")}
                  style={{
                    padding: "6px 12px",
                    fontSize: 12,
                    fontWeight: 800,
                    borderRadius: 8,
                    background: viewMode === "table" ? "white" : "transparent",
                    color: viewMode === "table" ? "#0F172A" : "#64748B",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    boxShadow: viewMode === "table" ? "0 2px 4px rgba(0,0,0,0.05)" : "none",
                    transition: "all 0.2s",
                  }}
                >
                  <TableIcon size={14} /> Daftar Data
                </button>
                <button
                  onClick={() => setViewMode("summary")}
                  style={{
                    padding: "6px 12px",
                    fontSize: 12,
                    fontWeight: 800,
                    borderRadius: 8,
                    background: viewMode === "summary" ? "white" : "transparent",
                    color: viewMode === "summary" ? "#0F172A" : "#64748B",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    boxShadow: viewMode === "summary" ? "0 2px 4px rgba(0,0,0,0.05)" : "none",
                    transition: "all 0.2s",
                  }}
                >
                  <BarChart2 size={14} /> Rekapan
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflow: "hidden", display: "flex", position: "relative" }}>
              {/* Main List Area */}
              <div style={{ flex: 1, padding: "24px 32px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <div
                  style={{
                    flex: 1,
                    background: "white",
                    borderRadius: 20,
                    border: "1px solid #E2E8F0",
                    overflow: "hidden",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {loading ? (
                    <div style={{ padding: 60, textAlign: "center", color: "#94A3B8" }}> Memuat data...</div>
                  ) : viewMode === "summary" ? (
                    <div style={{ padding: "32px", overflow: "auto", flex: 1, background: "#F8FAFC" }}>
                      <div style={{ marginBottom: 24 }}>
                        <h2 style={{ fontSize: 18, fontWeight: 900, color: "#0F172A", marginBottom: 6 }}>
                          Rekapan Data Pembatalan & Retur
                        </h2>
                        <p style={{ fontSize: 13, color: "#64748B" }}>
                          Ringkasan singkat untuk laporan mengenai jenis komplain dan produk bermasalah.
                        </p>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginBottom: 32 }}>
                        <div
                          style={{
                            background: "white",
                            padding: 24,
                            borderRadius: 16,
                            border: "1px solid #E2E8F0",
                            display: "flex",
                            alignItems: "center",
                            gap: 20,
                            boxShadow: "0 4px 20px rgba(0,0,0,0.02)",
                          }}
                        >
                          <div
                            style={{
                              width: 64,
                              height: 64,
                              borderRadius: 16,
                              background: "#FEF2F2",
                              color: "#EF4444",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            <BarChart2 size={32} />
                          </div>
                          <div>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 800,
                                color: "#64748B",
                                textTransform: "uppercase",
                                letterSpacing: 0.5,
                                marginBottom: 4,
                              }}
                            >
                              Total Retur Produk
                            </div>
                            <div style={{ fontSize: 28, fontWeight: 900, color: "#0F172A", lineHeight: 1 }}>
                              {totalRetur} <span style={{ fontSize: 13, color: "#64748B" }}>pesanan</span>
                            </div>
                          </div>
                        </div>
                        <div
                          style={{
                            background: "white",
                            padding: 24,
                            borderRadius: 16,
                            border: "1px solid #E2E8F0",
                            display: "flex",
                            alignItems: "center",
                            gap: 20,
                            boxShadow: "0 4px 20px rgba(0,0,0,0.02)",
                          }}
                        >
                          <div
                            style={{
                              width: 64,
                              height: 64,
                              borderRadius: 16,
                              background: "#FFFBEB",
                              color: "#F59E0B",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            <XCircle size={32} />
                          </div>
                          <div>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 800,
                                color: "#64748B",
                                textTransform: "uppercase",
                                letterSpacing: 0.5,
                                marginBottom: 4,
                              }}
                            >
                              Total Cancel Order
                            </div>
                            <div style={{ fontSize: 28, fontWeight: 900, color: "#0F172A", lineHeight: 1 }}>
                              {totalCancel} <span style={{ fontSize: 13, color: "#64748B" }}>pesanan</span>
                            </div>
                          </div>
                        </div>
                        <div
                          style={{
                            background: "white",
                            padding: 24,
                            borderRadius: 16,
                            border: "1px solid #E2E8F0",
                            display: "flex",
                            alignItems: "center",
                            gap: 20,
                            boxShadow: "0 4px 20px rgba(0,0,0,0.02)",
                          }}
                        >
                          <div
                            style={{
                              width: 64,
                              height: 64,
                              borderRadius: 16,
                              background: "#ECFDF5",
                              color: "#10B981",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            <CreditCard size={32} />
                          </div>
                          <div>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 800,
                                color: "#64748B",
                                textTransform: "uppercase",
                                letterSpacing: 0.5,
                                marginBottom: 4,
                              }}
                            >
                              Total Nilai (Rp)
                            </div>
                            <div style={{ fontSize: 28, fontWeight: 900, color: "#0F172A", lineHeight: 1 }}>
                              <span style={{ fontSize: 14, color: "#64748B" }}>Rp </span>
                              {totalKerugian >= 1000000
                                ? (totalKerugian / 1000000).toFixed(1) + " Jt"
                                : totalKerugian.toLocaleString("id-ID")}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                        <div style={{ background: "white", borderRadius: 16, border: "1px solid #E2E8F0", overflow: "hidden" }}>
                          <div
                            style={{
                              padding: "16px 20px",
                              background: "#F1F5F9",
                              borderBottom: "1px solid #E2E8F0",
                              fontWeight: 800,
                              color: "#334155",
                              fontSize: 14,
                            }}
                          >
                            Tipe Komplain Terbanyak (Alasan)
                          </div>
                          <div style={{ padding: 20 }}>
                            {topAlasan.length === 0 ? (
                              <div style={{ color: "#94A3B8", fontSize: 13, textAlign: "center" }}>Belum ada data</div>
                            ) : (
                              topAlasan.map((item, i) => (
                                <div
                                  key={item[0]}
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "flex-start",
                                    padding: "12px 0",
                                    borderBottom: i < topAlasan.length - 1 ? "1px solid #F1F5F9" : "none",
                                    gap: 16,
                                  }}
                                >
                                  <div
                                    style={{
                                      fontSize: 13,
                                      fontWeight: 700,
                                      color: "#0F172A",
                                      fontStyle: "italic",
                                      lineHeight: 1.5,
                                      flex: 1,
                                    }}
                                  >
                                    "{item[0]}"
                                  </div>
                                  <div style={{ fontSize: 14, fontWeight: 900, color: "#EF4444", flexShrink: 0, marginTop: 2 }}>
                                    {item[1]}x
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        <div style={{ background: "white", borderRadius: 16, border: "1px solid #E2E8F0", overflow: "hidden" }}>
                          <div
                            style={{
                              padding: "16px 20px",
                              background: "#F1F5F9",
                              borderBottom: "1px solid #E2E8F0",
                              fontWeight: 800,
                              color: "#334155",
                              fontSize: 14,
                            }}
                          >
                            Produk Paling Sering Retur/Batal
                          </div>
                          <div style={{ padding: 20 }}>
                            {topProduk.length === 0 ? (
                              <div style={{ color: "#94A3B8", fontSize: 13, textAlign: "center" }}>Belum ada data</div>
                            ) : (
                              topProduk.map((item, i) => (
                                <div
                                  key={item[0]}
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "flex-start",
                                    padding: "12px 0",
                                    borderBottom: i < topProduk.length - 1 ? "1px solid #F1F5F9" : "none",
                                    gap: 16,
                                  }}
                                >
                                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", lineHeight: 1.5, flex: 1 }}>
                                    {item[0]}
                                  </div>
                                  <div style={{ fontSize: 14, fontWeight: 900, color: "#F59E0B", flexShrink: 0, marginTop: 2 }}>
                                    {item[1]}x
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        <div style={{ background: "white", borderRadius: 16, border: "1px solid #E2E8F0", overflow: "hidden" }}>
                          <div
                            style={{
                              padding: "16px 20px",
                              background: "#F1F5F9",
                              borderBottom: "1px solid #E2E8F0",
                              fontWeight: 800,
                              color: "#334155",
                              fontSize: 14,
                            }}
                          >
                            Provinsi Pengiriman Terbanyak
                          </div>
                          <div style={{ padding: 20 }}>
                            {topProvinsi.length === 0 ? (
                              <div style={{ color: "#94A3B8", fontSize: 13, textAlign: "center" }}>Belum ada data</div>
                            ) : (
                              topProvinsi.map((item, i) => (
                                <div
                                  key={item[0]}
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    padding: "12px 0",
                                    borderBottom: i < topProvinsi.length - 1 ? "1px solid #F1F5F9" : "none",
                                  }}
                                >
                                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{item[0]}</div>
                                  <div style={{ fontSize: 14, fontWeight: 900, color: "#3B82F6" }}>{item[1]}x</div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        <div style={{ background: "white", borderRadius: 16, border: "1px solid #E2E8F0", overflow: "hidden" }}>
                          <div
                            style={{
                              padding: "16px 20px",
                              background: "#F1F5F9",
                              borderBottom: "1px solid #E2E8F0",
                              fontWeight: 800,
                              color: "#334155",
                              fontSize: 14,
                            }}
                          >
                            Kurir Paling Sering Bermasalah
                          </div>
                          <div style={{ padding: 20 }}>
                            {topKurir.length === 0 ? (
                              <div style={{ color: "#94A3B8", fontSize: 13, textAlign: "center" }}>Belum ada data</div>
                            ) : (
                              topKurir.map((item, i) => (
                                <div
                                  key={item[0]}
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    padding: "12px 0",
                                    borderBottom: i < topKurir.length - 1 ? "1px solid #F1F5F9" : "none",
                                  }}
                                >
                                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{item[0]}</div>
                                  <div style={{ fontSize: 14, fontWeight: 900, color: "#8B5CF6" }}>{item[1]}x</div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : filtered.length === 0 ? (
                    <div style={{ padding: 60, textAlign: "center", color: "#94A3B8" }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", marginBottom: 4 }}>
                        Belum Ada Data Retur
                      </div>
                      <div style={{ fontSize: 13 }}>
                        Silakan upload file CSV laporan pesanan/retur dari TikTok Shop atau Shopee.
                      </div>
                    </div>
                  ) : (
                    <div style={{ overflow: "auto", flex: 1 }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                        <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                          <tr style={{ background: "#F8FAFC" }}>
                            <th
                              style={{
                                padding: "14px 20px",
                                fontSize: 12,
                                fontWeight: 800,
                                color: "#475569",
                                textTransform: "uppercase",
                                letterSpacing: 0.5,
                                borderBottom: "2px solid #E2E8F0",
                              }}
                            >
                              Order ID & Resi
                            </th>
                            <th
                              style={{
                                padding: "14px 20px",
                                fontSize: 12,
                                fontWeight: 800,
                                color: "#475569",
                                textTransform: "uppercase",
                                letterSpacing: 0.5,
                                borderBottom: "2px solid #E2E8F0",
                              }}
                            >
                              Produk
                            </th>
                            <th
                              style={{
                                padding: "14px 20px",
                                fontSize: 12,
                                fontWeight: 800,
                                color: "#475569",
                                textTransform: "uppercase",
                                letterSpacing: 0.5,
                                borderBottom: "2px solid #E2E8F0",
                              }}
                            >
                              Tipe & Alasan
                            </th>
                            <th
                              style={{
                                padding: "14px 20px",
                                fontSize: 12,
                                fontWeight: 800,
                                color: "#475569",
                                textTransform: "uppercase",
                                letterSpacing: 0.5,
                                borderBottom: "2px solid #E2E8F0",
                              }}
                            >
                              Status Gudang
                            </th>
                            <th
                              style={{
                                padding: "14px 20px",
                                fontSize: 12,
                                fontWeight: 800,
                                color: "#475569",
                                textTransform: "uppercase",
                                letterSpacing: 0.5,
                                borderBottom: "2px solid #E2E8F0",
                                textAlign: "right",
                              }}
                            >
                              Aksi
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((d, idx) => {
                            const isSelected = selectedRetur?.id === d.id;
                            const isPending =
                              !d.status || d.status === "Menunggu Gudang" || String(d.status).startsWith("Sebagian");
                            return (
                              <tr
                                key={d.id || `${d.order_id}-${idx}`}
                                className="table-row-hover"
                                onClick={() => setSelectedRetur(d)}
                                style={{
                                  borderBottom: "1px solid #F1F5F9",
                                  background: isSelected ? "#F8FAFC" : "transparent",
                                  cursor: "pointer",
                                  transition: "background 0.2s",
                                }}
                              >
                                <td style={{ padding: "16px 20px" }}>
                                  <div
                                    style={{
                                      fontWeight: 800,
                                      fontSize: 14,
                                      color: "#0F172A",
                                      fontFamily: "monospace",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 8,
                                    }}
                                  >
                                    {d.order_id}
                                  </div>
                                  {d.tracking_id && d.tracking_id !== "-" && (
                                    <div style={{ fontSize: 11, color: "#2563EB", fontFamily: "monospace", marginTop: 2 }}>
                                      Resi: {d.tracking_id}
                                    </div>
                                  )}
                                  <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>{d.tanggal_batal}</div>
                                </td>
                                <td style={{ padding: "16px 20px", maxWidth: 280 }}>
                                  <div
                                    style={{
                                      fontWeight: 700,
                                      fontSize: 13,
                                      color: "#334155",
                                      whiteSpace: "nowrap",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                    }}
                                  >
                                    {d.product_name}
                                  </div>
                                  <div style={{ fontSize: 12, color: "#1D4ED8", marginTop: 4, fontWeight: 600 }}>
                                    {d.variation} &bull; {d.return_quantity} pcs
                                  </div>
                                </td>
                                <td style={{ padding: "16px 20px", maxWidth: 200 }}>
                                  <div
                                    style={{
                                      fontWeight: 800,
                                      fontSize: 12,
                                      color: d.return_type === "Cancel" ? "#EAB308" : "#EF4444",
                                    }}
                                  >
                                    {d.return_type?.toUpperCase() || "DIBATALKAN"}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 11,
                                      color: "#64748B",
                                      marginTop: 4,
                                      fontStyle: "italic",
                                      whiteSpace: "nowrap",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                    }}
                                  >
                                    "{d.alasan}"
                                  </div>
                                </td>
                                <td style={{ padding: "16px 20px" }}>
                                  <span
                                    style={{
                                      padding: "4px 10px",
                                      borderRadius: 99,
                                      fontSize: 11,
                                      fontWeight: 800,
                                      letterSpacing: 0.5,
                                      background:
                                        d.status === "Masuk Gudang"
                                          ? "#D1FAE5"
                                          : d.status === "Hilang"
                                          ? "#FEE2E2"
                                          : "#FEF3C7",
                                      color:
                                        d.status === "Masuk Gudang"
                                          ? "#065F46"
                                          : d.status === "Hilang"
                                          ? "#991B1B"
                                          : "#92400E",
                                    }}
                                  >
                                    {d.status || "Menunggu Gudang"}
                                  </span>
                                </td>
                                <td style={{ padding: "16px 20px", textAlign: "right" }}>
                                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
                                    {isPending && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setScanOrderId(d.order_id);
                                          setTab("scan");
                                        }}
                                        title="Buka tab Scan untuk memverifikasi barcode/fisik pesanan ini"
                                        style={{
                                          padding: "6px 10px",
                                          background: "#0F172A",
                                          color: "white",
                                          border: "none",
                                          borderRadius: 8,
                                          fontSize: 11,
                                          fontWeight: 800,
                                          cursor: "pointer",
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 4,
                                        }}
                                      >
                                        <ScanLine size={13} /> Scan Fisik
                                      </button>
                                    )}
                                    {isPending ? (
                                      <>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            updateStatus(d, "Masuk Gudang");
                                          }}
                                          style={{
                                            padding: "6px 10px",
                                            background: "#EFF6FF",
                                            color: "#2563EB",
                                            border: "1px solid #BFDBFE",
                                            borderRadius: 8,
                                            fontSize: 11,
                                            fontWeight: 700,
                                            cursor: "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 4,
                                          }}
                                        >
                                          <CheckCircle size={14} /> Diterima
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            updateStatus(d, "Hilang");
                                          }}
                                          style={{
                                            padding: "6px 10px",
                                            background: "#FEF2F2",
                                            color: "#EF4444",
                                            border: "1px solid #FECACA",
                                            borderRadius: 8,
                                            fontSize: 11,
                                            fontWeight: 700,
                                            cursor: "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 4,
                                          }}
                                        >
                                          <XCircle size={14} /> Hilang
                                        </button>
                                      </>
                                    ) : (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          updateStatus(d, "Menunggu Gudang");
                                        }}
                                        style={{
                                          padding: "6px 10px",
                                          background: "#F8FAFC",
                                          color: "#64748B",
                                          border: "1px solid #E2E8F0",
                                          borderRadius: 8,
                                          fontSize: 11,
                                          fontWeight: 700,
                                          cursor: "pointer",
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 4,
                                        }}
                                      >
                                        Reset
                                      </button>
                                    )}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteRow(d);
                                      }}
                                      title="Hapus baris"
                                      style={{
                                        padding: "6px",
                                        background: "transparent",
                                        color: "#94A3B8",
                                        border: "none",
                                        borderRadius: 6,
                                        cursor: "pointer",
                                      }}
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Detail Drawer */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  bottom: 0,
                  width: 400,
                  background: "white",
                  borderLeft: "1px solid #E2E8F0",
                  boxShadow: "-4px 0 24px rgba(0,0,0,0.05)",
                  transform: selectedRetur ? "translateX(0)" : "translateX(100%)",
                  transition: "transform 0.3s cubic-bezier(0.16,1,0.3,1)",
                  display: "flex",
                  flexDirection: "column",
                  zIndex: 20,
                }}
              >
                {selectedRetur && (
                  <>
                    <div
                      style={{
                        padding: "24px",
                        borderBottom: "1px solid #E2E8F0",
                        background: "#F8FAFC",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 800,
                            color: "#3B82F6",
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                            marginBottom: 4,
                          }}
                        >
                          Detail {selectedRetur.return_type === "Cancel" ? "Pembatalan" : "Retur"}
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: "#0F172A", fontFamily: "monospace" }}>
                          {selectedRetur.order_id}
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedRetur(null)}
                        style={{
                          background: "white",
                          border: "1px solid #E2E8F0",
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#64748B",
                        }}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>

                    <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
                      <div
                        style={{
                          marginBottom: 24,
                          background: selectedRetur.return_type === "Cancel" ? "#FEFCE8" : "#FEF2F2",
                          padding: 16,
                          borderRadius: 12,
                          border: `1px solid ${selectedRetur.return_type === "Cancel" ? "#FEF08A" : "#FECACA"}`,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            marginBottom: 12,
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontSize: 11,
                                fontWeight: 800,
                                color: selectedRetur.return_type === "Cancel" ? "#CA8A04" : "#DC2626",
                                textTransform: "uppercase",
                                letterSpacing: 0.5,
                                marginBottom: 4,
                              }}
                            >
                              Tipe Komplain
                            </div>
                            <div
                              style={{
                                fontSize: 14,
                                fontWeight: 900,
                                color: selectedRetur.return_type === "Cancel" ? "#A16207" : "#B91C1C",
                              }}
                            >
                              {selectedRetur.return_type?.toUpperCase() || "DIBATALKAN"}
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>Tanggal Batal/Retur</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#475569", marginTop: 4 }}>
                              {selectedRetur.tanggal_batal}
                            </div>
                          </div>
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              color: selectedRetur.return_type === "Cancel" ? "#CA8A04" : "#DC2626",
                              textTransform: "uppercase",
                              letterSpacing: 0.5,
                              marginBottom: 4,
                            }}
                          >
                            Alasan & Catatan Pembeli
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#1E293B", marginBottom: 2 }}>
                            {selectedRetur.alasan}
                          </div>
                          {selectedRetur.buyer_note && selectedRetur.buyer_note !== "-" && (
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 500,
                                color: "#475569",
                                fontStyle: "italic",
                                lineHeight: 1.5,
                                background: "rgba(255,255,255,0.5)",
                                padding: "8px 12px",
                                borderRadius: 8,
                                marginTop: 8,
                                border: "1px dashed rgba(0,0,0,0.1)",
                              }}
                            >
                              "{selectedRetur.buyer_note}"
                            </div>
                          )}
                        </div>
                        <div
                          style={{
                            marginTop: 12,
                            paddingTop: 12,
                            borderTop: `1px dashed ${selectedRetur.return_type === "Cancel" ? "#FDE047" : "#FCA5A5"}`,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontSize: 11,
                                fontWeight: 800,
                                color: selectedRetur.return_type === "Cancel" ? "#CA8A04" : "#DC2626",
                                textTransform: "uppercase",
                                letterSpacing: 0.5,
                                marginBottom: 4,
                              }}
                            >
                              Status Gudang Konveksi
                            </div>
                            <div
                              style={{
                                display: "inline-block",
                                padding: "4px 10px",
                                borderRadius: 99,
                                fontSize: 12,
                                fontWeight: 800,
                                background:
                                  selectedRetur.status === "Masuk Gudang"
                                    ? "#D1FAE5"
                                    : selectedRetur.status === "Hilang"
                                    ? "#FEE2E2"
                                    : "#FEF3C7",
                                color:
                                  selectedRetur.status === "Masuk Gudang"
                                    ? "#065F46"
                                    : selectedRetur.status === "Hilang"
                                    ? "#991B1B"
                                    : "#92400E",
                              }}
                            >
                              {selectedRetur.status || "Menunggu Gudang"}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setScanOrderId(selectedRetur.order_id);
                              setTab("scan");
                            }}
                            style={{
                              padding: "8px 12px",
                              background: "#0F172A",
                              color: "white",
                              border: "none",
                              borderRadius: 8,
                              fontSize: 11,
                              fontWeight: 800,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <ScanLine size={14} /> Proses di Tab Scan
                          </button>
                        </div>
                      </div>

                      <div style={{ marginBottom: 24 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 800,
                            color: "#64748B",
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                            marginBottom: 12,
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <FileText size={16} /> Informasi Produk
                        </div>
                        <div
                          style={{
                            background: "#F8FAFC",
                            padding: 16,
                            borderRadius: 12,
                            border: "1px solid #E2E8F0",
                          }}
                        >
                          <div style={{ fontWeight: 800, color: "#0F172A", fontSize: 14, marginBottom: 4 }}>
                            {selectedRetur.product_name}
                          </div>
                          <div style={{ color: "#3B82F6", fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
                            {selectedRetur.variation}
                          </div>
                          <div style={{ display: "flex", gap: 16, borderTop: "1px dashed #CBD5E1", paddingTop: 12 }}>
                            <div>
                              <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>Jumlah Retur</div>
                              <div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>
                                {selectedRetur.return_quantity} pcs
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>Seller SKU</div>
                              <div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>
                                {selectedRetur.seller_sku || "-"}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div style={{ marginBottom: 24 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 800,
                            color: "#64748B",
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                            marginBottom: 12,
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <User size={16} /> Info Pembeli
                        </div>
                        <div
                          style={{
                            background: "white",
                            padding: 16,
                            borderRadius: 12,
                            border: "1px solid #E2E8F0",
                          }}
                        >
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>Nama Penerima / Username</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>
                              {selectedRetur.recipient || "-"}{" "}
                              <span style={{ color: "#94A3B8", fontWeight: 500 }}>({selectedRetur.buyer_username})</span>
                            </div>
                          </div>
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>Nomor Telepon</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>
                              {selectedRetur.phone || "-"}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>Alamat Lengkap</div>
                            <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.5, marginTop: 2 }}>
                              {selectedRetur.address || "-"}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div style={{ marginBottom: 24 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 800,
                            color: "#64748B",
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                            marginBottom: 12,
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <Truck size={16} /> Info Pengiriman
                        </div>
                        <div
                          style={{
                            background: "white",
                            padding: 16,
                            borderRadius: 12,
                            border: "1px solid #E2E8F0",
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 16,
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>Kurir</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>
                              {selectedRetur.shipping_provider ||
                                (selectedRetur.return_type === "Cancel" ? "Belum dikirim (Cancel)" : "-")}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>No. Resi</div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", fontFamily: "monospace" }}>
                              {selectedRetur.tracking_id ||
                                (selectedRetur.return_type === "Cancel" ? "Belum dikirim (Cancel)" : "-")}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div style={{ marginBottom: 24 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 800,
                            color: "#64748B",
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                            marginBottom: 12,
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <CreditCard size={16} /> Pembayaran
                        </div>
                        <div
                          style={{
                            background: "white",
                            padding: 16,
                            borderRadius: 12,
                            border: "1px solid #E2E8F0",
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 16,
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>Metode</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>
                              {selectedRetur.payment_method || "-"}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>Total Order</div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: "#10B981" }}>
                              Rp {parseInt(selectedRetur.order_amount || "0").toLocaleString("id-ID")}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
