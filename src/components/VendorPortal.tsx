"use client";
import React, { use, useEffect, useRef, useState } from "react";
import {
  Briefcase,
  CheckCircle2,
  Clock,
  DollarSign,
  Package,
  PlusCircle,
  RefreshCw,
  X,
  AlertCircle,
  TrendingUp,
  PlayCircle,
  XCircle,
  FileText,
  Printer,
  ChevronDown,
  ChevronUp,
  Eye,
  Search,
  AlertTriangle,
  ShieldCheck,
  Zap,
  Info
} from "lucide-react";
import { toast } from "sonner";
import { subscribeRealtime, subscribeRealtimeStatus, visiblePoll } from "@/lib/realtime-client";

// Radial Progress Component
function RadialProgress({
  pct,
  size = 68,
  stroke = 6,
  color = "#3B82F6",
  label
}: {
  pct: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: string;
}) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const filled = circ * (1 - Math.min(Math.max(pct, 0), 100) / 100);
  const isComplete = pct >= 100;
  const c = isComplete ? "#10B981" : color;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1E293B" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={c}
          strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={filled}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(.4,2,.6,1)" }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <span
          style={{
            fontSize: size * 0.22,
            fontWeight: 900,
            color: isComplete ? "#10B981" : "white",
            lineHeight: 1
          }}
        >
          {Math.round(pct)}%
        </span>
        {label && <span style={{ fontSize: size * 0.12, color: "#94A3B8", marginTop: 2 }}>{label}</span>}
      </div>
    </div>
  );
}

function formatRupiah(num: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0
  }).format(num);
}

interface VendorPortalProps {
  vendorId?: string;
  defaultTipe?: string;
}

export default function VendorPortal({ vendorId = "1", defaultTipe = "cmt" }: VendorPortalProps) {
  const id = vendorId;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<"connected" | "connecting" | "offline">("connecting");
  const [activeTab, setActiveTab] = useState<"dashboard" | "riwayat" | "gaji" | "requests">("dashboard");

  // Modal states
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestForm, setRequestForm] = useState({ total_request: "", catatan: "", pemotongan_id: "" });
  const [fabricSearch, setFabricSearch] = useState("");

  const [showProgresModal, setShowProgresModal] = useState<any | null>(null);
  const [progresForm, setProgresForm] = useState<
    { size: string; jumlah: number | ""; maxSisa: number; totalTarget: number; done: number; pending: number }[]
  >([]);
  const [progresCatatan, setProgresCatatan] = useState("");

  const [detailPoModal, setDetailPoModal] = useState<any | null>(null);
  const [poReportsModal, setPoReportsModal] = useState<any | null>(null);
  const [printDocModal, setPrintDocModal] = useState<{ type: "gaji" | "spk"; item: any } | null>(null);
  const [confirmCancelModal, setConfirmCancelModal] = useState<any | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [justSubmittedPo, setJustSubmittedPo] = useState<string | null>(null);
  const [showThrottleInfo, setShowThrottleInfo] = useState(false);

  // Filters
  const [requestFilter, setRequestFilter] = useState("Semua");
  const [riwayatSearch, setRiwayatSearch] = useState("");
  const [gajiFilter, setGajiFilter] = useState("Semua");

  const fetchData = async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    try {
      const res = await fetch(`/api/cmt-portal/${id}?_t=` + Date.now());
      if (!res.ok) throw new Error("Portal vendor tidak ditemukan");
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      if (!isSilent) toast.error(err.message || "Gagal memuat portal vendor");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 1. Initial fetch (Top-level Hook)
  useEffect(() => {
    fetchData();
  }, [id]);

  // 2. Real-time listener via shared SSE connection (Top-level Hook)
  const fetchDataRef = useRef(fetchData);
  fetchDataRef.current = fetchData;
  useEffect(() => {
    const unsubStatus = subscribeRealtimeStatus((s) => {
      setRealtimeStatus(s === "live" ? "connected" : s);
    });
    const unsubSync = subscribeRealtime(() => fetchDataRef.current(true));
    // Fallback poll only (realtime handles normal updates); skipped while tab hidden
    const stopPoll = visiblePoll(() => fetchDataRef.current(true), 30000);

    return () => {
      unsubStatus();
      unsubSync();
      stopPoll();
    };
  }, [id]);

  // 3. Scroll unlocker for standalone portal (Top-level Hook)
  useEffect(() => {
    const origBodyOverflow = document.body.style.overflow;
    const origHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "auto";
    document.documentElement.style.overflow = "auto";
    return () => {
      document.body.style.overflow = origBodyOverflow;
      document.documentElement.style.overflow = origHtmlOverflow;
    };
  }, []);

  // Submit Laporan Progres
  const handleLaporProgres = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showProgresModal) return;

    const items = progresForm.filter((p) => Number(p.jumlah) > 0);
    if (items.length === 0) {
      toast.error("Isi setidaknya 1 size yang sudah selesai dikerjakan.");
      return;
    }

    for (const item of items) {
      if (Number(item.jumlah) > item.maxSisa) {
        toast.error(`Size ${item.size}: Jumlah (${item.jumlah}) melebihi sisa yang tersedia (${item.maxSisa} pcs)`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/cmt-progres", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          po_id: showProgresModal.id,
          vendor_id: id,
          items: items.map((i) => ({ size: i.size, jumlah: Number(i.jumlah) })),
          catatan: progresCatatan
        })
      });
      if (!res.ok) throw new Error("Gagal mengirim laporan progres");

      toast.success("Laporan progres berhasil dikirim ke Admin!");
      setJustSubmittedPo(showProgresModal.id);
      setTimeout(() => setJustSubmittedPo(null), 4000);
      setShowProgresModal(null);
      setProgresCatatan("");
      fetchData(true);
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan saat melapor progres");
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Request Kerjaan Baru
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestForm.pemotongan_id) {
      toast.error("Silakan pilih kain / batch yang tersedia terlebih dahulu!");
      return;
    }
    if (!requestForm.total_request || Number(requestForm.total_request) <= 0) {
      toast.error("Masukkan jumlah pcs yang valid!");
      return;
    }

    setSubmitting(true);
    try {
      const selectedP = (data?.pemotonganReady || []).find((p: any) => String(p.id) === requestForm.pemotongan_id);
      const isTransfer = selectedP?.is_transfer;

      const res = await fetch("/api/cmt-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor_id: Number(id),
          total_request: Number(requestForm.total_request),
          catatan: requestForm.catatan,
          pemotongan_id: isTransfer ? null : requestForm.pemotongan_id ? Number(requestForm.pemotongan_id) : null,
          transfer_id: isTransfer ? Number(requestForm.pemotongan_id) : null
        })
      });
      if (!res.ok) throw new Error("Gagal mengirim permohonan kerjaan");

      toast.success("Permohonan berhasil dikirim ke Admin!");
      setShowRequestModal(false);
      setRequestForm({ total_request: "", catatan: "", pemotongan_id: "" });
      fetchData(true);
      setActiveTab("requests");
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan");
    } finally {
      setSubmitting(false);
    }
  };

  // Mulai / Batal Mengerjakan
  const handleMulaiKerja = async (po: any, action: "mulai" | "batal") => {
    try {
      const res = await fetch("/api/portal-vendor/mulai-kerja", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: po.id,
          po_id: po.po_id || po.id,
          is_transfer: !!po.is_transfer,
          action,
          vendor_tipe: data.vendor?.tipe || defaultTipe
        })
      });
      if (!res.ok) throw new Error("Gagal mengubah status pengerjaan");
      toast.success(action === "mulai" ? "Status diperbarui: Sedang Dikerjakan!" : "Status dikembalikan ke antrean!");
      fetchData(true);
    } catch (e: any) {
      toast.error(e.message || "Gagal mengubah status");
    }
  };

  // Batalkan Request
  const handleCancelRequestConfirmed = async () => {
    if (!confirmCancelModal) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/cmt-request?id=${confirmCancelModal.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Gagal membatalkan request");
      toast.success("Permohonan berhasil dibatalkan!");
      setConfirmCancelModal(null);
      fetchData(true);
    } catch (e: any) {
      toast.error(e.message || "Gagal membatalkan request");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0F172A",
          fontFamily: "Inter, sans-serif"
        }}
      >
        <div style={{ textAlign: "center", color: "white" }}>
          <RefreshCw size={36} color="#3B82F6" style={{ animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
          <h2 style={{ fontSize: 18, fontWeight: 800 }}>Menghubungkan ke Portal Vendor...</h2>
          <p style={{ fontSize: 13, color: "#94A3B8", marginTop: 4 }}>Sinkronisasi data produksi & riwayat...</p>
        </div>
      </div>
    );
  }

  if (!data || !data.vendor) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0F172A",
          fontFamily: "Inter, sans-serif"
        }}
      >
        <div
          style={{
            textAlign: "center",
            color: "white",
            background: "#1E293B",
            padding: 32,
            borderRadius: 20,
            border: "1px solid #334155",
            maxWidth: 440
          }}
        >
          <AlertCircle size={48} color="#EF4444" style={{ margin: "0 auto 16px" }} />
          <h2 style={{ fontSize: 20, fontWeight: 800 }}>Vendor Tidak Ditemukan</h2>
          <p style={{ color: "#94A3B8", fontSize: 14, marginTop: 8 }}>
            Tautan portal vendor yang Anda tuju tidak valid atau ID vendor tidak terdaftar di sistem.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 20,
              padding: "10px 20px",
              background: "#3B82F6",
              color: "white",
              borderRadius: 10,
              border: "none",
              fontWeight: 700,
              cursor: "pointer"
            }}
          >
            Muat Ulang Halaman
          </button>
        </div>
      </div>
    );
  }

  const vendor = data.vendor;
  const activePOs = data.activePO || [];
  const historiPOs = data.historiPO || [];
  const gajiRecords = data.gaji || [];
  const requests = data.requests || [];
  const bi = data.blockInfo || null;

  const totalAktifPcs = activePOs.reduce((sum: number, po: any) => sum + (po.jumlah_terbit || 0), 0);
  const totalSelesaiPcs = historiPOs.reduce((sum: number, po: any) => sum + (po.jumlah_terbit || 0), 0);
  const totalDiserahkanAktifPcs = activePOs.reduce((sum: number, po: any) => sum + (po.totalDiambil || 0), 0);
  const totalTertunggak = data.totalTertunggak || 0;
  const pendingRequests = requests.filter((r: any) => r.status === "Pending" || r.status === "Terpenuhi Sebagian");

  const isBlocked = data.canRequest === false;
  const hasOverdue = bi?.maxOverdueDays > 0;

  return (
    <div
      id="vendor-portal-page"
      style={{
        minHeight: "100dvh",
        background: "#0F172A",
        color: "white",
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "max(120px, calc(env(safe-area-inset-bottom, 24px) + 90px))",
        width: "100%",
        WebkitFontSmoothing: "antialiased",
        overflowX: "hidden"
      }}
    >
      {/* ── RESPONSIVE STYLES FOR MOBILE & IOS ── */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            html, body {
              overflow-x: hidden !important;
              overflow-y: auto !important;
              min-height: 100vh !important;
              min-height: 100dvh !important;
              -webkit-overflow-scrolling: touch !important;
              background-color: #0F172A !important;
              overscroll-behavior: none !important;
              overscroll-behavior-y: none !important;
              -webkit-overscroll-behavior-y: none !important;
            }
            #vendor-portal-page {
              width: 100% !important;
              min-height: 100vh !important;
              min-height: 100dvh !important;
              overflow-x: hidden !important;
              background-color: #0F172A !important;
              overscroll-behavior: none !important;
              overscroll-behavior-y: none !important;
            }
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.4; }
            }
            .vendor-header-bar {
              padding-top: max(14px, calc(env(safe-area-inset-top, 14px) + 4px)) !important;
              padding-left: max(24px, env(safe-area-inset-left, 24px)) !important;
              padding-right: max(24px, env(safe-area-inset-right, 24px)) !important;
            }
            .vendor-modal-overlay {
              position: fixed !important;
              inset: 0 !important;
              background: rgba(0,0,0,0.85) !important;
              backdrop-filter: blur(8px) !important;
              -webkit-backdrop-filter: blur(8px) !important;
              display: flex !important;
              align-items: center !important;
              justify-content: center !important;
              z-index: 100 !important;
              padding-top: max(16px, calc(env(safe-area-inset-top, 16px) + 8px)) !important;
              padding-bottom: max(24px, calc(env(safe-area-inset-bottom, 24px) + 12px)) !important;
              padding-left: max(12px, env(safe-area-inset-left, 12px)) !important;
              padding-right: max(12px, env(safe-area-inset-right, 12px)) !important;
              box-sizing: border-box !important;
            }
            .vendor-modal-box {
              max-height: calc(100dvh - env(safe-area-inset-top, 24px) - env(safe-area-inset-bottom, 24px) - 24px) !important;
              overflow-y: auto !important;
              -webkit-overflow-scrolling: touch !important;
            }
            @media (max-width: 768px) {
              .vendor-header-bar {
                padding-top: max(14px, calc(env(safe-area-inset-top, 14px) + 8px)) !important;
                padding-bottom: 14px !important;
                padding-left: max(14px, env(safe-area-inset-left, 14px)) !important;
                padding-right: max(14px, env(safe-area-inset-right, 14px)) !important;
                flex-direction: column !important;
                align-items: stretch !important;
                gap: 10px !important;
                box-sizing: border-box !important;
              }
              * {
                scrollbar-width: none !important;
                -ms-overflow-style: none !important;
              }
              *::-webkit-scrollbar,
              ::-webkit-scrollbar {
                display: none !important;
                width: 0 !important;
                height: 0 !important;
                background: transparent !important;
              }
              *::-webkit-scrollbar-thumb,
              ::-webkit-scrollbar-thumb {
                display: none !important;
                background: transparent !important;
              }
              *::-webkit-scrollbar-track,
              ::-webkit-scrollbar-track {
                display: none !important;
                background: transparent !important;
              }
              .vendor-header-right {
                display: flex !important;
                flex-direction: row !important;
                align-items: center !important;
                justify-content: space-between !important;
                gap: 8px !important;
                width: 100% !important;
              }
              .vendor-header-right > * {
                flex: 1 1 auto !important;
                text-align: center !important;
                justify-content: center !important;
              }
              .vendor-main-box {
                padding: 14px 10px 0 !important;
              }
              .vendor-kpi-grid {
                grid-template-columns: repeat(2, 1fr) !important;
                gap: 8px !important;
              }
              .vendor-kpi-card {
                padding: 12px 14px !important;
              }
              .vendor-kpi-val {
                font-size: 18px !important;
              }
              .vendor-tabs-wrapper {
                width: 100% !important;
                max-width: 100% !important;
                overflow-x: auto !important;
                -webkit-overflow-scrolling: touch !important;
                scrollbar-width: none !important;
                padding: 4px !important;
              }
              .vendor-tabs-wrapper::-webkit-scrollbar {
                display: none !important;
              }
              .vendor-tab-item {
                flex-shrink: 0 !important;
                white-space: nowrap !important;
                padding: 8px 12px !important;
                font-size: 12px !important;
              }
              .vendor-po-box {
                padding: 16px 14px !important;
              }
              .vendor-po-top-row {
                display: flex !important;
                flex-direction: row !important;
                justify-content: space-between !important;
                align-items: flex-start !important;
                gap: 8px !important;
              }
              .vendor-po-actions-row {
                flex-direction: column !important;
                align-items: stretch !important;
                gap: 8px !important;
              }
              .vendor-secondary-actions {
                display: grid !important;
                grid-template-columns: 1fr 1fr !important;
                gap: 8px !important;
                width: 100% !important;
              }
              .vendor-secondary-actions button {
                width: 100% !important;
                justify-content: center !important;
              }
              .vendor-primary-actions {
                display: flex !important;
                flex-direction: column !important;
                gap: 8px !important;
                width: 100% !important;
              }
              .vendor-primary-actions button {
                width: 100% !important;
                justify-content: center !important;
              }
            }
            @media (max-width: 420px) {
              .vendor-kpi-grid {
                grid-template-columns: 1fr 1fr !important;
                gap: 6px !important;
              }
              .vendor-kpi-card {
                padding: 10px 12px !important;
              }
              .vendor-kpi-val {
                font-size: 16px !important;
              }
            }
          `
        }}
      />

      {/* ── STICKY TOPBAR HEADER ── */}
      <header
        className="vendor-header-bar"
        style={{
          background: "linear-gradient(135deg, rgba(30, 41, 59, 0.96) 0%, rgba(15, 23, 42, 0.96) 100%)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          borderBottom: "1px solid #1E293B",
          padding: "14px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          position: "sticky",
          top: 0,
          zIndex: 40,
          boxShadow: "0 4px 20px rgba(0,0,0,0.35)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              background: "linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)",
              width: 42,
              height: 42,
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 14px rgba(37,99,235,0.4)",
              flexShrink: 0
            }}
          >
            <Briefcase size={20} color="white" />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h1 style={{ fontSize: "clamp(15px, 4vw, 18px)", fontWeight: 900, margin: 0, letterSpacing: "-0.02em" }}>
                {vendor.nama || "Portal Mitra Vendor"}
              </h1>
              <span
                style={{
                  background: "#1E293B",
                  color: "#38BDF8",
                  border: "1px solid #0284C7",
                  padding: "2px 7px",
                  borderRadius: 6,
                  fontSize: 10,
                  fontWeight: 800
                }}
              >
                {vendor.kodeVendor || vendor.kode || "VENDOR"}
              </span>
            </div>
            <div style={{ fontSize: 11, color: "#94A3B8", margin: "2px 0 0", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span>Portal {vendor.tipe?.toUpperCase() || "CMT"}</span>
              <span>·</span>
              {/* Realtime Status Indicator */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  background: realtimeStatus === "connected" ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                  padding: "1px 7px",
                  borderRadius: 10,
                  border: realtimeStatus === "connected" ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(245, 158, 11, 0.3)"
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: realtimeStatus === "connected" ? "#10B981" : "#F59E0B",
                    boxShadow: realtimeStatus === "connected" ? "0 0 6px #10B981" : "none",
                    animation: realtimeStatus === "connecting" ? "pulse 1.2s infinite" : "none"
                  }}
                />
                <span
                  style={{
                    color: realtimeStatus === "connected" ? "#34D399" : "#FCD34D",
                    fontSize: 10,
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    gap: 3
                  }}
                >
                  <Zap size={10} />
                  {realtimeStatus === "connected" ? "Live Realtime" : "Menghubungkan..."}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="vendor-header-right" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            className="mobile-touch-btn"
            onClick={() => {
              fetchData();
              toast.info("Data portal berhasil disinkronkan!");
            }}
            disabled={refreshing}
            title="Sinkronkan data sekarang"
            style={{
              background: "#1E293B",
              border: "1px solid #334155",
              color: "#94A3B8",
              padding: "8px 12px",
              borderRadius: 8,
              cursor: refreshing ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 12,
              fontWeight: 700,
              minHeight: 38
            }}
          >
            <RefreshCw size={13} style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} />
            <span>Sync</span>
          </button>

          {pendingRequests.length > 0 && (
            <div
              className="mobile-touch-btn"
              onClick={() => setActiveTab("requests")}
              style={{
                background: "rgba(245, 158, 11, 0.15)",
                border: "1px solid rgba(245, 158, 11, 0.4)",
                color: "#FCD34D",
                padding: "7px 10px",
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                gap: 5,
                cursor: "pointer",
                minHeight: 38
              }}
            >
              <Clock size={13} />
              <span>{pendingRequests.length} Diproses</span>
            </div>
          )}

          <button
            type="button"
            className="mobile-touch-btn"
            onClick={() => setShowRequestModal(true)}
            style={{
              background: isBlocked
                ? "linear-gradient(135deg, #D97706 0%, #B45309 100%)"
                : "linear-gradient(135deg, #10B981 0%, #059669 100%)",
              color: "white",
              border: "none",
              padding: "8px 14px",
              borderRadius: 8,
              fontWeight: 800,
              fontSize: 12,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              minHeight: 38,
              boxShadow: isBlocked ? "0 4px 12px rgba(217,119,6,0.3)" : "0 4px 12px rgba(16,185,129,0.3)"
            }}
          >
            <PlusCircle size={15} />
            <span>Minta Kerjaan</span>
          </button>
        </div>
      </header>

      {/* ── MAIN CONTENT CONTAINER ── */}
      <main className="vendor-main-box" style={{ maxWidth: 1180, margin: "0 auto", padding: "20px 16px 0" }}>
        {/* ── SMART TRACKING BANNER & THROTTLE HEALTH ── */}
        {bi && bi.totalJumlahTerbit > 0 && (
          <div
            style={{
              marginBottom: 16,
              borderRadius: 14,
              border: isBlocked
                ? "1.5px solid rgba(239, 68, 68, 0.6)"
                : hasOverdue
                ? "1.5px solid rgba(245, 158, 11, 0.6)"
                : "1.5px solid rgba(16, 185, 129, 0.6)",
              background: isBlocked
                ? "linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(15, 23, 42, 0.96) 100%)"
                : hasOverdue
                ? "linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(15, 23, 42, 0.96) 100%)"
                : "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(15, 23, 42, 0.96) 100%)",
              overflow: "hidden",
              boxShadow: "0 4px 16px rgba(0,0,0,0.2)"
            }}
          >
            {/* Header row */}
            <div
              style={{
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 10,
                borderBottom: "1px solid rgba(255,255,255,0.06)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 220 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: isBlocked
                      ? "rgba(239, 68, 68, 0.2)"
                      : hasOverdue
                      ? "rgba(245, 158, 11, 0.2)"
                      : "rgba(16, 185, 129, 0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: isBlocked ? "#EF4444" : hasOverdue ? "#F59E0B" : "#10B981",
                    flexShrink: 0
                  }}
                >
                  {isBlocked ? <AlertTriangle size={18} /> : hasOverdue ? <Clock size={18} /> : <ShieldCheck size={18} />}
                </div>
                <div>
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: 13,
                      color: isBlocked ? "#FCA5A5" : hasOverdue ? "#FCD34D" : "#6EE7B7"
                    }}
                  >
                    {isBlocked
                      ? `Permintaan Terbatas: Progres ${bi.overallPct}% dari ${bi.effectiveMinPct}% (Target)`
                      : hasOverdue
                      ? `Ada PO Melewati Batas: Progres ${bi.overallPct}% (Masih Memenuhi Syarat)`
                      : `Status Akun Prima: Progres ${bi.overallPct}% (Target ${bi.effectiveMinPct}%)`}
                  </div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>
                    {isBlocked
                      ? `Selesaikan & lapor ${bi.neededPcs} pcs lagi, atau kirim permohonan dispensasi.`
                      : `Kinerja pengerjaan memenuhi standar operasional konveksi.`}
                  </div>
                </div>
              </div>

              {/* Progress Box & Button */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowThrottleInfo(!showThrottleInfo)}
                  style={{
                    background: "#1E293B",
                    border: "1px solid #334155",
                    color: "#94A3B8",
                    padding: "5px 10px",
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4
                  }}
                >
                  <Info size={12} />
                  <span>{showThrottleInfo ? "Tutup" : "Aturan"}</span>
                  {showThrottleInfo ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>

                <div
                  style={{
                    background: "rgba(0,0,0,0.35)",
                    padding: "4px 10px",
                    borderRadius: 8,
                    textAlign: "center",
                    border: "1px solid rgba(255,255,255,0.06)"
                  }}
                >
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 900,
                      color: isBlocked ? "#EF4444" : hasOverdue ? "#F59E0B" : "#10B981",
                      lineHeight: 1
                    }}
                  >
                    {bi.overallPct}%
                  </div>
                  <div style={{ fontSize: 9, color: "#94A3B8", fontWeight: 700, marginTop: 1 }}>
                    Target: {bi.effectiveMinPct}%
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div style={{ padding: "10px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700 }}>
                  PROGRESS ({bi.totalApprovedDone.toLocaleString("id-ID")} / {bi.totalJumlahTerbit.toLocaleString("id-ID")} pcs)
                </span>
                <span style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700 }}>TARGET {bi.effectiveMinPct}%</span>
              </div>
              <div
                style={{
                  position: "relative",
                  background: "#1E293B",
                  borderRadius: 6,
                  height: 10,
                  overflow: "hidden",
                  border: "1px solid #334155"
                }}
              >
                <div
                  style={{
                    width: `${Math.min(bi.overallPct, 100)}%`,
                    height: "100%",
                    background: isBlocked
                      ? "linear-gradient(90deg, #EF4444, #F87171)"
                      : "linear-gradient(90deg, #10B981, #34D399)",
                    borderRadius: 6,
                    transition: "width 0.8s ease"
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: `${Math.min(bi.effectiveMinPct, 100)}%`,
                    width: 2,
                    background: "#F59E0B",
                    boxShadow: "0 0 6px #F59E0B"
                  }}
                />
              </div>
            </div>

            {/* Overdue Alert */}
            {bi.overduePoList && bi.overduePoList.length > 0 && (
              <div
                style={{
                  padding: "8px 16px",
                  background: "rgba(239, 68, 68, 0.08)",
                  borderTop: "1px solid rgba(239, 68, 68, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 8
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: "#FCA5A5" }}>MELEBIHI TARGET SELESAI:</span>
                  {bi.overduePoList.map((op: any, i: number) => (
                    <div
                      key={i}
                      style={{
                        background: "rgba(239, 68, 68, 0.2)",
                        border: "1px solid rgba(239, 68, 68, 0.4)",
                        borderRadius: 6,
                        padding: "2px 6px",
                        fontSize: 10,
                        color: "#FCA5A5",
                        fontWeight: 700
                      }}
                    >
                      {op.noPo} · +{op.overdueDays} hari
                    </div>
                  ))}
                </div>
                {bi.throttlePenalty > 0 && (
                  <span style={{ fontSize: 10, color: "#F87171", fontWeight: 700 }}>
                    Penalti: +{bi.throttlePenalty}%
                  </span>
                )}
              </div>
            )}

            {/* Expandable Explanation */}
            {showThrottleInfo && (
              <div
                style={{
                  padding: "14px 16px",
                  background: "#0F172A",
                  borderTop: "1px solid #334155",
                  fontSize: 11,
                  color: "#94A3B8",
                  lineHeight: 1.5
                }}
              >
                <div style={{ fontWeight: 800, color: "white", marginBottom: 4 }}>
                  Ketentuan Target Progres Konveksi:
                </div>
                <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 3 }}>
                  <li>
                    <strong>Base Target ({bi.baseMinPct}%):</strong> Permohonan kain baru otomatis di-ACC jika progres aktif ≥ {bi.baseMinPct}%.
                  </li>
                  <li>
                    <strong>Penalti (+1%/hari):</strong> Setiap hari keterlambatan menaikkan batas target sebesar 1%.
                  </li>
                  <li>
                    <strong>Dispensasi:</strong> Jika butuh kain sebelum target tercapai, ajukan lewat tombol <em>"Minta Kerjaan"</em> untuk ditinjau Admin.
                  </li>
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ── 4 KPI SUMMARY STAT CARDS ── */}
        <div className="vendor-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 18 }}>
          {/* Card 1: Sedang Dikerjakan */}
          <div
            className="vendor-kpi-card mobile-touch-btn"
            onClick={() => setActiveTab("dashboard")}
            style={{
              background: "#1E293B",
              borderRadius: 14,
              padding: "16px 18px",
              border: "1px solid #334155",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8" }}>Sedang Dikerjakan</span>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "#1E3A5F",
                  color: "#3B82F6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Package size={16} />
              </div>
            </div>
            <div className="vendor-kpi-val" style={{ fontSize: 22, fontWeight: 900, color: "white", letterSpacing: "-0.02em" }}>
              {totalAktifPcs.toLocaleString("id-ID")}{" "}
              <span style={{ fontSize: 12, fontWeight: 600, color: "#94A3B8" }}>pcs</span>
            </div>
            <div style={{ fontSize: 10, color: "#38BDF8", fontWeight: 700, marginTop: 3 }}>
              {totalDiserahkanAktifPcs.toLocaleString("id-ID")} pcs diserahkan
            </div>
          </div>

          {/* Card 2: Total Selesai */}
          <div
            className="vendor-kpi-card mobile-touch-btn"
            onClick={() => setActiveTab("riwayat")}
            style={{
              background: "#1E293B",
              borderRadius: 14,
              padding: "16px 18px",
              border: "1px solid #334155",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8" }}>Total Selesai</span>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "#064E3B",
                  color: "#10B981",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <CheckCircle2 size={16} />
              </div>
            </div>
            <div className="vendor-kpi-val" style={{ fontSize: 22, fontWeight: 900, color: "white", letterSpacing: "-0.02em" }}>
              {totalSelesaiPcs.toLocaleString("id-ID")}{" "}
              <span style={{ fontSize: 12, fontWeight: 600, color: "#94A3B8" }}>pcs</span>
            </div>
            <div style={{ fontSize: 10, color: "#34D399", fontWeight: 700, marginTop: 3 }}>
              {historiPOs.length} PO rampung
            </div>
          </div>

          {/* Card 3: Hak / Hutang Gaji */}
          <div
            className="vendor-kpi-card mobile-touch-btn"
            onClick={() => setActiveTab("gaji")}
            style={{
              background: "#1E293B",
              borderRadius: 14,
              padding: "16px 18px",
              border: "1px solid #334155",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8" }}>Hak / Hutang Gaji</span>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "#451A03",
                  color: "#F59E0B",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <DollarSign size={16} />
              </div>
            </div>
            <div className="vendor-kpi-val" style={{ fontSize: 22, fontWeight: 900, color: "white", letterSpacing: "-0.02em" }}>
              {formatRupiah(totalTertunggak)}
            </div>
            <div style={{ fontSize: 10, color: totalTertunggak > 0 ? "#FCD34D" : "#10B981", fontWeight: 700, marginTop: 3 }}>
              {totalTertunggak > 0 ? "Belum dicairkan kasir" : "Semua upah terselesaikan"}
            </div>
          </div>

          {/* Card 4: PO Aktif */}
          <div
            className="vendor-kpi-card mobile-touch-btn"
            onClick={() => setActiveTab("dashboard")}
            style={{
              background: "#1E293B",
              borderRadius: 14,
              padding: "16px 18px",
              border: "1px solid #334155",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8" }}>Pekerjaan Aktif</span>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "#2E1065",
                  color: "#8B5CF6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Clock size={16} />
              </div>
            </div>
            <div className="vendor-kpi-val" style={{ fontSize: 22, fontWeight: 900, color: "white", letterSpacing: "-0.02em" }}>
              {activePOs.length} <span style={{ fontSize: 12, fontWeight: 600, color: "#94A3B8" }}>PO</span>
            </div>
            <div style={{ fontSize: 10, color: "#C4B5FD", fontWeight: 700, marginTop: 3 }}>
              {hasOverdue ? `${bi?.overduePoList?.length} PO lewat target` : "Sesuai jadwal"}
            </div>
          </div>
        </div>

        {/* ── HORIZONTAL SCROLLABLE TAB CONTROLS (IOS SAFE) ── */}
        <div
          className="vendor-tabs-wrapper"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "#1E293B",
            padding: 5,
            borderRadius: 12,
            marginBottom: 18,
            border: "1px solid #334155"
          }}
        >
          {[
            { key: "dashboard", label: "PO Aktif", count: activePOs.length },
            { key: "riwayat", label: "Riwayat Kinerja", count: historiPOs.length },
            { key: "gaji", label: "Slip & Riwayat Gaji", count: gajiRecords.length },
            { key: "requests", label: "Riwayat Permohonan", count: requests.length }
          ].map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                className="vendor-tab-item mobile-touch-btn"
                onClick={() => setActiveTab(tab.key as any)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 800,
                  background: isActive ? "white" : "transparent",
                  color: isActive ? "#0F172A" : "#94A3B8",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.2s"
                }}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    style={{
                      background: isActive ? "#0F172A" : "#334155",
                      color: isActive ? "white" : "#94A3B8",
                      padding: "1px 6px",
                      borderRadius: 10,
                      fontSize: 10,
                      fontWeight: 800
                    }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ══════════════════════════════════════════════════════════════
            TAB 1: PO AKTIF
           ══════════════════════════════════════════════════════════════ */}
        {activeTab === "dashboard" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {activePOs.length === 0 ? (
              <div
                style={{
                  background: "#1E293B",
                  borderRadius: 16,
                  padding: "40px 20px",
                  textAlign: "center",
                  border: "1px solid #334155"
                }}
              >
                <Package size={40} style={{ color: "#475569", margin: "0 auto 12px" }} />
                <h3 style={{ fontSize: 16, fontWeight: 800, color: "white", margin: 0 }}>
                  Tidak Ada Pekerjaan Aktif Saat Ini
                </h3>
                <p style={{ color: "#94A3B8", fontSize: 12, marginTop: 6, maxWidth: 420, margin: "6px auto 0" }}>
                  Semua SPK sudah selesai dikerjakan. Silakan klik tombol <strong>"Minta Kerjaan"</strong> untuk
                  memilih tumpukan kain yang tersedia.
                </p>
                <button
                  onClick={() => setShowRequestModal(true)}
                  className="mobile-touch-btn"
                  style={{
                    marginTop: 16,
                    padding: "9px 20px",
                    background: "linear-gradient(135deg, #10B981, #059669)",
                    color: "white",
                    borderRadius: 8,
                    border: "none",
                    fontWeight: 800,
                    cursor: "pointer",
                    fontSize: 13,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6
                  }}
                >
                  <PlusCircle size={15} /> Minta Kerjaan Baru
                </button>
              </div>
            ) : (
              activePOs.map((po: any) => {
                const totalTarget = po.jumlah_terbit || po.jumlahTerbit || 0;
                const totalDone = po.totalDiambil || 0;
                const pct = totalTarget > 0 ? Math.round((totalDone / totalTarget) * 100) : 0;
                const isJustSubmitted = justSubmittedPo === po.id;
                const isOverdue = po.isOverdue;
                const overdueDays = po.overdueDays || 0;
                const targetSelesai = po.targetSelesai;
                const isDikerjakan = po.transfer_status === "Dikerjakan";

                return (
                  <div
                    key={po.id}
                    style={{
                      background: isJustSubmitted ? "#0D2137" : "#1E293B",
                      borderRadius: 16,
                      border: isJustSubmitted
                        ? "2px solid #10B981"
                        : isOverdue
                        ? "2px solid rgba(239, 68, 68, 0.7)"
                        : "1px solid #334155",
                      overflow: "hidden",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.2)"
                    }}
                  >
                    {/* Overdue Strip */}
                    {isOverdue && (
                      <div
                        style={{
                          background: "linear-gradient(135deg, #7F1D1D 0%, #991B1B 100%)",
                          padding: "8px 16px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          flexWrap: "wrap",
                          gap: 8
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <AlertTriangle size={15} color="#FCA5A5" />
                          <div>
                            <span style={{ fontWeight: 800, fontSize: 11, color: "#FCA5A5" }}>
                              PO MELEBIHI TARGET SELESAI ({overdueDays} HARI)
                            </span>
                            <span style={{ fontSize: 10, color: "#FECACA", marginLeft: 6 }}>
                              Target:{" "}
                              {new Date(targetSelesai).toLocaleDateString("id-ID", {
                                day: "numeric",
                                month: "short"
                              })}
                            </span>
                          </div>
                        </div>
                        <div
                          style={{
                            background: "#EF4444",
                            color: "white",
                            fontSize: 10,
                            fontWeight: 800,
                            padding: "2px 8px",
                            borderRadius: 12
                          }}
                        >
                          -{overdueDays}% Throttle
                        </div>
                      </div>
                    )}

                    <div className="vendor-po-box" style={{ padding: "20px 22px" }}>
                      {/* Top Header of Card */}
                      <div className="vendor-po-top-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <h2 style={{ fontSize: 18, fontWeight: 900, color: "white", margin: 0 }}>
                              {po.no_po || po.noPo || "PO-PRODUKSI"}
                            </h2>
                            <span
                              style={{
                                background: isDikerjakan ? "#064E3B" : "#1E3A5F",
                                color: isDikerjakan ? "#34D399" : "#60A5FA",
                                border: isDikerjakan ? "1px solid #059669" : "1px solid #2563EB",
                                padding: "2px 7px",
                                borderRadius: 6,
                                fontSize: 10,
                                fontWeight: 800
                              }}
                            >
                              {isDikerjakan ? "SEDANG DIKERJAKAN" : "TERDAFTAR"}
                            </span>
                          </div>

                          <div
                            style={{
                              fontSize: 12,
                              color: "#94A3B8",
                              display: "flex",
                              gap: 8,
                              alignItems: "center",
                              flexWrap: "wrap",
                              marginTop: 5
                            }}
                          >
                            <div>
                              Model: <strong style={{ color: "white" }}>{po.model}</strong>
                            </div>
                            <span>·</span>
                            <div
                              style={{
                                background: "#451A03",
                                color: "#FCD34D",
                                padding: "1px 6px",
                                borderRadius: 5,
                                fontSize: 10,
                                fontWeight: 700
                              }}
                            >
                              Sisa: {Math.max(0, totalTarget - totalDone)} pcs
                            </div>
                            {targetSelesai && !isOverdue && (
                              <div
                                style={{
                                  background: "#064E3B",
                                  color: "#34D399",
                                  padding: "1px 6px",
                                  borderRadius: 5,
                                  fontSize: 10,
                                  fontWeight: 700
                                }}
                              >
                                Batas:{" "}
                                {new Date(targetSelesai).toLocaleDateString("id-ID", {
                                  day: "numeric",
                                  month: "short"
                                })}
                              </div>
                            )}
                          </div>

                          {isJustSubmitted && (
                            <div
                              style={{
                                marginTop: 6,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                                background: "#064E3B",
                                padding: "4px 8px",
                                borderRadius: 6
                              }}
                            >
                              <CheckCircle2 size={12} color="#10B981" />
                              <span style={{ fontSize: 11, color: "#10B981", fontWeight: 700 }}>
                                Laporan dikirim! Menunggu ACC verifikasi admin.
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Radial Progress Graphic */}
                        <div style={{ flexShrink: 0 }}>
                          <RadialProgress pct={pct} size={66} stroke={5} color="#3B82F6" />
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div
                        style={{
                          background: "#0F172A",
                          borderRadius: 10,
                          padding: "10px 14px",
                          marginBottom: 14,
                          border: "1px solid #1E293B"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                          <span style={{ fontSize: 10, color: "#94A3B8", fontWeight: 800, textTransform: "uppercase" }}>
                            Progres Diserahkan
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 900,
                              color: pct >= 100 ? "#10B981" : "#38BDF8"
                            }}
                          >
                            {totalDone.toLocaleString("id-ID")} / {totalTarget.toLocaleString("id-ID")} pcs ({pct}%)
                          </span>
                        </div>
                        <div style={{ width: "100%", background: "#1E293B", height: 7, borderRadius: 4, overflow: "hidden" }}>
                          <div
                            style={{
                              background:
                                pct >= 100 ? "#10B981" : "linear-gradient(90deg, #3B82F6 0%, #8B5CF6 100%)",
                              height: "100%",
                              width: `${Math.min(pct, 100)}%`,
                              transition: "width 0.8s cubic-bezier(.4,2,.6,1)",
                              borderRadius: 4
                            }}
                          />
                        </div>
                      </div>

                      {/* Breakdown per Size */}
                      {po.sizeBreakdown && po.sizeBreakdown.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ fontSize: 10, color: "#64748B", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                            Rincian per Size:
                          </div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {po.sizeBreakdown.map((s: any, i: number) => {
                              const sDone = po.sizeProgress?.[s.size] || 0;
                              const sPending = po.pendingSizeProgress?.[s.size] || 0;
                              const totalSizeTarget = Number(s.jumlah || s.sisa || 0);
                              const sPct = totalSizeTarget > 0 ? Math.round((sDone / totalSizeTarget) * 100) : 0;
                              return (
                                <div
                                  key={i}
                                  style={{
                                    background: "#0F172A",
                                    padding: "7px 10px",
                                    borderRadius: 8,
                                    border:
                                      sPct >= 100
                                        ? "1px solid #10B981"
                                        : sPending > 0
                                        ? "1px solid #F59E0B"
                                        : "1px solid #334155",
                                    minWidth: 62,
                                    flex: "1 1 auto",
                                    textAlign: "center"
                                  }}
                                >
                                  <div style={{ fontWeight: 900, color: "white", fontSize: 13 }}>{s.size}</div>
                                  <div
                                    style={{
                                      fontSize: 10,
                                      color: sPct >= 100 ? "#10B981" : "#94A3B8",
                                      marginTop: 1,
                                      fontWeight: 700
                                    }}
                                  >
                                    {sDone}/{totalSizeTarget}
                                  </div>
                                  {sPending > 0 && (
                                    <div style={{ fontSize: 9, color: "#F59E0B", fontWeight: 800, marginTop: 1 }}>
                                      +{sPending}
                                    </div>
                                  )}
                                  <div
                                    style={{
                                      marginTop: 4,
                                      height: 3,
                                      background: "#1E293B",
                                      borderRadius: 2,
                                      overflow: "hidden"
                                    }}
                                  >
                                    <div
                                      style={{
                                        height: "100%",
                                        width: `${sPct}%`,
                                        background: sPct >= 100 ? "#10B981" : "#3B82F6",
                                        transition: "width 0.5s"
                                      }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* ── ACTION BUTTONS TOOLBAR ── */}
                      <div
                        className="vendor-po-actions-row"
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: 8,
                          paddingTop: 14,
                          borderTop: "1px solid #334155"
                        }}
                      >
                        {/* Secondary buttons */}
                        <div className="vendor-secondary-actions" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className="mobile-touch-btn"
                            onClick={() => setDetailPoModal(po)}
                            style={{
                              background: "#0F172A",
                              border: "1px solid #334155",
                              color: "#94A3B8",
                              padding: "8px 12px",
                              borderRadius: 8,
                              fontWeight: 700,
                              fontSize: 12,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              minHeight: 38
                            }}
                          >
                            <FileText size={13} /> Rincian SPK
                          </button>

                          <button
                            type="button"
                            className="mobile-touch-btn"
                            onClick={() => setPoReportsModal(po)}
                            style={{
                              background: "#0F172A",
                              border: "1px solid #334155",
                              color: "#94A3B8",
                              padding: "8px 12px",
                              borderRadius: 8,
                              fontWeight: 700,
                              fontSize: 12,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              minHeight: 38
                            }}
                          >
                            <Clock size={13} /> Riwayat Laporan
                          </button>
                        </div>

                        {/* Primary actions */}
                        <div className="vendor-primary-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                          {!isDikerjakan ? (
                            <button
                              type="button"
                              className="mobile-touch-btn"
                              onClick={() => handleMulaiKerja(po, "mulai")}
                              style={{
                                background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
                                color: "white",
                                padding: "9px 16px",
                                borderRadius: 8,
                                fontWeight: 800,
                                fontSize: 12,
                                border: "none",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                minHeight: 40,
                                boxShadow: "0 3px 10px rgba(245,158,11,0.3)"
                              }}
                            >
                              <PlayCircle size={15} /> Mulai Mengerjakan
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="mobile-touch-btn"
                              onClick={() => handleMulaiKerja(po, "batal")}
                              style={{
                                background: "transparent",
                                color: "#EF4444",
                                border: "1px solid rgba(239, 68, 68, 0.5)",
                                padding: "8px 12px",
                                borderRadius: 8,
                                fontWeight: 700,
                                fontSize: 12,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 5,
                                minHeight: 40
                              }}
                            >
                              <XCircle size={14} /> Batal Mulai
                            </button>
                          )}

                          <button
                            type="button"
                            className="mobile-touch-btn"
                            onClick={() => {
                              setShowProgresModal(po);
                              const breakdown = po.sizeBreakdown || [];
                              const items = breakdown.map((s: any) => {
                                const approved = po.sizeProgress?.[s.size] || 0;
                                const pending = po.pendingSizeProgress?.[s.size] || 0;
                                const totalSize = Number(s.jumlah || s.sisa || 0);
                                const sisa = Math.max(totalSize - approved - pending, 0);
                                return {
                                  size: s.size,
                                  jumlah: "",
                                  maxSisa: sisa,
                                  totalTarget: totalSize,
                                  done: approved,
                                  pending: pending
                                };
                              });
                              setProgresForm(items);
                              setProgresCatatan("");
                            }}
                            style={{
                              background:
                                pct >= 100 ? "#064E3B" : "linear-gradient(135deg, #2563EB 0%, #4F46E5 100%)",
                              color: pct >= 100 ? "#34D399" : "white",
                              border: pct >= 100 ? "1px solid #059669" : "none",
                              padding: "9px 16px",
                              borderRadius: 8,
                              fontWeight: 800,
                              fontSize: 12,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              minHeight: 40,
                              boxShadow: pct >= 100 ? "none" : "0 3px 12px rgba(37,99,235,0.3)"
                            }}
                          >
                            {pct >= 100 ? (
                              <>
                                <CheckCircle2 size={14} /> Sudah 100% · Lapor Lagi?
                              </>
                            ) : (
                              <>
                                <TrendingUp size={14} /> Lapor Progres Selesai
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            TAB 2: RIWAYAT KINERJA (SELESAI)
           ══════════════════════════════════════════════════════════════ */}
        {activeTab === "riwayat" && (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 10,
                marginBottom: 14
              }}
            >
              <div style={{ position: "relative", minWidth: 220, flex: 1 }}>
                <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#64748B" }} />
                <input
                  type="text"
                  placeholder="Cari No PO atau Model..."
                  value={riwayatSearch}
                  onChange={(e) => setRiwayatSearch(e.target.value)}
                  style={{
                    width: "100%",
                    background: "#1E293B",
                    border: "1px solid #334155",
                    color: "white",
                    padding: "8px 12px 8px 34px",
                    borderRadius: 8,
                    fontSize: 16, // iOS safe
                    outline: "none"
                  }}
                />
              </div>

              <div style={{ fontSize: 11, color: "#94A3B8" }}>
                Total: <strong style={{ color: "white" }}>{historiPOs.length} PO</strong> (
                {totalSelesaiPcs.toLocaleString("id-ID")} pcs)
              </div>
            </div>

            <div style={{ background: "#1E293B", borderRadius: 14, border: "1px solid #334155", overflow: "hidden" }}>
              {(() => {
                const filtered = historiPOs.filter((po: any) => {
                  if (!riwayatSearch) return true;
                  const q = riwayatSearch.toLowerCase();
                  return (po.no_po || po.noPo || "").toLowerCase().includes(q) || (po.model || "").toLowerCase().includes(q);
                });

                if (filtered.length === 0) {
                  return (
                    <div style={{ padding: 36, textAlign: "center", color: "#64748B", fontSize: 12 }}>
                      Tidak ada riwayat pekerjaan yang cocok.
                    </div>
                  );
                }

                return (
                  <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", minWidth: 500 }}>
                      <thead>
                        <tr style={{ background: "#0F172A", borderBottom: "1px solid #334155" }}>
                          {["NO PO", "MODEL", "TOTAL PCS", "TANGGAL", "STATUS", "AKSI"].map((h) => (
                            <th
                              key={h}
                              style={{
                                padding: "10px 14px",
                                fontSize: 10,
                                fontWeight: 800,
                                color: "#64748B",
                                letterSpacing: "0.05em"
                              }}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((po: any) => (
                          <tr key={po.id} style={{ borderBottom: "1px solid #1E293B" }}>
                            <td style={{ padding: "10px 14px", fontFamily: "monospace", color: "#38BDF8", fontWeight: 700, fontSize: 12 }}>
                              {po.no_po || po.noPo || "-"}
                            </td>
                            <td style={{ padding: "10px 14px", fontWeight: 700, color: "white", fontSize: 12 }}>
                              {po.model}
                            </td>
                            <td style={{ padding: "10px 14px", fontWeight: 800, color: "#10B981", fontSize: 12 }}>
                              {(po.jumlah_terbit || 0).toLocaleString("id-ID")} pcs
                            </td>
                            <td style={{ padding: "10px 14px", color: "#94A3B8", fontSize: 11 }}>
                              {po.tanggalSelesai
                                ? new Date(po.tanggalSelesai).toLocaleDateString("id-ID", { day: "numeric", month: "short" })
                                : "Selesai"}
                            </td>
                            <td style={{ padding: "10px 14px" }}>
                              <span
                                style={{
                                  background: "#064E3B",
                                  color: "#34D399",
                                  padding: "2px 7px",
                                  borderRadius: 5,
                                  fontSize: 10,
                                  fontWeight: 800
                                }}
                              >
                                Selesai
                              </span>
                            </td>
                            <td style={{ padding: "10px 14px" }}>
                              <div style={{ display: "flex", gap: 5 }}>
                                <button
                                  type="button"
                                  className="mobile-touch-btn"
                                  onClick={() => setDetailPoModal(po)}
                                  style={{
                                    background: "#0F172A",
                                    border: "1px solid #334155",
                                    color: "#94A3B8",
                                    padding: "4px 8px",
                                    borderRadius: 6,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 3
                                  }}
                                >
                                  <Eye size={11} /> Detail
                                </button>
                                <button
                                  type="button"
                                  className="mobile-touch-btn"
                                  onClick={() => setPrintDocModal({ type: "spk", item: po })}
                                  style={{
                                    background: "#1E3A5F",
                                    border: "1px solid #2563EB",
                                    color: "#60A5FA",
                                    padding: "4px 8px",
                                    borderRadius: 6,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 3
                                  }}
                                >
                                  <Printer size={11} /> Cetak
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            TAB 3: SLIP & RIWAYAT GAJI
           ══════════════════════════════════════════════════════════════ */}
        {activeTab === "gaji" && (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 10,
                marginBottom: 14
              }}
            >
              <div style={{ display: "flex", gap: 5 }}>
                {["Semua", "Lunas", "Belum Lunas"].map((f) => (
                  <button
                    key={f}
                    type="button"
                    className="mobile-touch-btn"
                    onClick={() => setGajiFilter(f)}
                    style={{
                      padding: "5px 10px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      background: gajiFilter === f ? "#3B82F6" : "#1E293B",
                      color: gajiFilter === f ? "white" : "#94A3B8",
                      border: "1px solid #334155"
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <div style={{ fontSize: 11, color: "#94A3B8" }}>
                Tertunggak:{" "}
                <strong style={{ color: totalTertunggak > 0 ? "#FCD34D" : "#10B981" }}>
                  {formatRupiah(totalTertunggak)}
                </strong>
              </div>
            </div>

            {(() => {
              const filtered = gajiRecords.filter((g: any) => {
                if (gajiFilter === "Semua") return true;
                if (gajiFilter === "Lunas") return g.status === "Lunas";
                if (gajiFilter === "Belum Lunas") return g.status !== "Lunas";
                return true;
              });

              if (filtered.length === 0) {
                return (
                  <div
                    style={{
                      background: "#1E293B",
                      borderRadius: 14,
                      padding: 36,
                      textAlign: "center",
                      border: "1px solid #334155",
                      color: "#64748B",
                      fontSize: 12
                    }}
                  >
                    Belum ada data penggajian.
                  </div>
                );
              }

              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {filtered.map((g: any) => {
                    const isLunas = g.status === "Lunas";
                    const amt = Number(g.totalGaji || g.total || 0);
                    return (
                      <div
                        key={g.id}
                        style={{
                          background: "#1E293B",
                          borderRadius: 14,
                          padding: "14px 16px",
                          border: "1px solid #334155",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: 10
                        }}
                      >
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 800, color: "white", fontSize: 14 }}>
                              {g.keterangan || `Gaji Produksi #${g.poId || g.id}`}
                            </span>
                            <span
                              style={{
                                background: isLunas ? "#064E3B" : "#451A03",
                                color: isLunas ? "#34D399" : "#FCD34D",
                                padding: "1px 6px",
                                borderRadius: 5,
                                fontSize: 10,
                                fontWeight: 800
                              }}
                            >
                              {g.status || "Lunas"}
                            </span>
                          </div>

                          <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 3, display: "flex", gap: 6, alignItems: "center" }}>
                            <span>
                              {g.tanggal
                                ? new Date(g.tanggal).toLocaleDateString("id-ID", {
                                    day: "numeric",
                                    month: "short"
                                  })
                                : "-"}
                            </span>
                            <span>·</span>
                            <span>{g.metode || "Transfer"}</span>
                            {g.jumlahPcs && <span>· {g.jumlahPcs} pcs</span>}
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ textAlign: "right" }}>
                            <div
                              style={{
                                fontSize: 16,
                                fontWeight: 900,
                                color: isLunas ? "#10B981" : "#F59E0B"
                              }}
                            >
                              {formatRupiah(amt)}
                            </div>
                            {g.sisaTagihan > 0 && (
                              <div style={{ fontSize: 10, color: "#F87171", fontWeight: 700 }}>
                                Sisa: {formatRupiah(g.sisaTagihan)}
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            className="mobile-touch-btn"
                            onClick={() => setPrintDocModal({ type: "gaji", item: g })}
                            style={{
                              background: "#0F172A",
                              border: "1px solid #334155",
                              color: "white",
                              padding: "6px 10px",
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 4
                            }}
                          >
                            <Printer size={12} /> Cetak
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            TAB 4: RIWAYAT PERMOHONAN KERJA
           ══════════════════════════════════════════════════════════════ */}
        {activeTab === "requests" && (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 10,
                marginBottom: 14
              }}
            >
              <div style={{ display: "flex", gap: 5 }}>
                {["Semua", "Pending", "Selesai", "Ditolak"].map((f) => (
                  <button
                    key={f}
                    type="button"
                    className="mobile-touch-btn"
                    onClick={() => setRequestFilter(f)}
                    style={{
                      padding: "5px 10px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      background: requestFilter === f ? "#3B82F6" : "#1E293B",
                      color: requestFilter === f ? "white" : "#94A3B8",
                      border: "1px solid #334155"
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="mobile-touch-btn"
                onClick={() => setShowRequestModal(true)}
                style={{
                  background: "linear-gradient(135deg, #10B981, #059669)",
                  color: "white",
                  padding: "6px 12px",
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 800,
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5
                }}
              >
                <PlusCircle size={13} /> Ajukan
              </button>
            </div>

            {(() => {
              const filtered = requests.filter((r: any) => {
                if (requestFilter === "Semua") return true;
                if (requestFilter === "Selesai") return r.status === "Selesai" || r.status === "Terpenuhi Sebagian";
                return r.status === requestFilter;
              });

              if (filtered.length === 0) {
                return (
                  <div
                    style={{
                      background: "#1E293B",
                      borderRadius: 14,
                      padding: 36,
                      textAlign: "center",
                      border: "1px solid #334155",
                      color: "#64748B",
                      fontSize: 12
                    }}
                  >
                    Tidak ada catatan permohonan dengan status "{requestFilter}".
                  </div>
                );
              }

              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {filtered.map((r: any) => {
                    const isPending = r.status === "Pending";
                    const isDitolak = r.status === "Ditolak";
                    const isDone = r.status === "Selesai";

                    return (
                      <div
                        key={r.id}
                        style={{
                          background: "#1E293B",
                          borderRadius: 14,
                          padding: "14px 16px",
                          border: isPending
                            ? "1px solid rgba(245, 158, 11, 0.4)"
                            : isDitolak
                            ? "1px solid rgba(239, 68, 68, 0.4)"
                            : "1px solid #334155",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: 10
                        }}
                      >
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 800, color: "white", fontSize: 14 }}>
                              Permohonan {r.total_request} pcs
                            </span>
                            {r.pemotongan && (
                              <span
                                style={{
                                  background: "#1E3A5F",
                                  color: "#60A5FA",
                                  padding: "2px 6px",
                                  borderRadius: 5,
                                  fontSize: 10,
                                  fontWeight: 700
                                }}
                              >
                                {r.pemotongan.nama_barang} ({r.pemotongan.model})
                              </span>
                            )}
                          </div>

                          <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 3 }}>
                            {new Date(r.createdAt).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric"
                            })}
                          </div>

                          {r.catatan && (
                            <div style={{ fontSize: 11, color: "#CBD5E1", marginTop: 3, fontStyle: "italic" }}>
                              "{r.catatan}"
                            </div>
                          )}

                          {isDitolak && r.alasan_tolak && (
                            <div
                              style={{
                                marginTop: 5,
                                background: "rgba(239, 68, 68, 0.15)",
                                border: "1px solid rgba(239, 68, 68, 0.3)",
                                borderRadius: 6,
                                padding: "5px 8px",
                                color: "#FCA5A5",
                                fontSize: 10
                              }}
                            >
                              <strong>Alasan Penolakan:</strong> {r.alasan_tolak}
                            </div>
                          )}
                        </div>

                        <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
                          <div
                            style={{
                              fontSize: 16,
                              fontWeight: 900,
                              color: isDone ? "#10B981" : isDitolak ? "#EF4444" : "#F59E0B"
                            }}
                          >
                            {r.total_dipenuhi || 0} / {r.total_request} pcs
                          </div>

                          <span
                            style={{
                              background: isDone ? "#064E3B" : isDitolak ? "#450A0A" : "#451A03",
                              color: isDone ? "#34D399" : isDitolak ? "#FCA5A5" : "#FCD34D",
                              padding: "2px 7px",
                              borderRadius: 5,
                              fontSize: 10,
                              fontWeight: 800
                            }}
                          >
                            {r.status}
                          </span>

                          {isPending && (
                            <button
                              type="button"
                              className="mobile-touch-btn"
                              onClick={() => setConfirmCancelModal(r)}
                              style={{
                                background: "transparent",
                                border: "1px solid #64748B",
                                color: "#94A3B8",
                                fontSize: 10,
                                padding: "2px 6px",
                                borderRadius: 5,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 3
                              }}
                            >
                              <X size={10} /> Batal
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}
      </main>

      {/* ══════════════════════════════════════════════════════════════
          MODAL: MINTA KERJAAN BARU
         ══════════════════════════════════════════════════════════════ */}
      {showRequestModal && (
        <div className="vendor-modal-overlay">
          <div
            className="vendor-modal-box"
            style={{
              background: "#1E293B",
              width: "100%",
              maxWidth: 580,
              borderRadius: 16,
              overflow: "hidden",
              boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
              border: "1px solid #334155",
              maxHeight: "92vh",
              display: "flex",
              flexDirection: "column"
            }}
          >
            <div
              style={{
                padding: "14px 18px",
                borderBottom: "1px solid #334155",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexShrink: 0
              }}
            >
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 900, color: "white", margin: 0 }}>Minta Kerjaan Baru</h2>
                <p style={{ fontSize: 11, color: "#94A3B8", margin: "2px 0 0" }}>
                  Pilih kain dari tahap pemotongan
                </p>
              </div>
              <button
                type="button"
                className="mobile-touch-btn"
                onClick={() => setShowRequestModal(false)}
                style={{ background: "#334155", border: "none", color: "#94A3B8", padding: 6, borderRadius: 6, cursor: "pointer" }}
              >
                <X size={16} />
              </button>
            </div>

            <form
              onSubmit={handleSubmitRequest}
              style={{
                padding: "16px 18px",
                overflowY: "auto",
                WebkitOverflowScrolling: "touch",
                display: "flex",
                flexDirection: "column",
                gap: 14
              }}
            >
              {isBlocked && (
                <div
                  style={{
                    background: "rgba(245, 158, 11, 0.1)",
                    border: "1px solid rgba(245, 158, 11, 0.3)",
                    borderRadius: 10,
                    padding: "8px 12px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8
                  }}
                >
                  <AlertTriangle size={16} color="#F59E0B" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ fontSize: 11, color: "#FCD34D", lineHeight: 1.4 }}>
                    <strong>Permohonan Dispensasi:</strong> Progres saat ini {bi?.overallPct}% (target {bi?.effectiveMinPct}%).
                    Permohonan ini akan ditinjau Admin secara manual.
                  </div>
                </div>
              )}

              {/* Step 1: Fabric Selection */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                  <label style={{ fontSize: 11, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase" }}>
                    1. Pilih Kain Tersedia: <span style={{ color: "#EF4444" }}>*</span>
                  </label>
                  <span style={{ fontSize: 10, color: "#64748B" }}>
                    {(data?.pemotonganReady || []).length} batch siap
                  </span>
                </div>

                {(data?.pemotonganReady || []).length > 3 && (
                  <input
                    type="text"
                    placeholder="Filter nama kain atau model..."
                    value={fabricSearch}
                    onChange={(e) => setFabricSearch(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #334155",
                      background: "#0F172A",
                      color: "white",
                      fontSize: 16, // iOS safe
                      marginBottom: 8,
                      outline: "none"
                    }}
                  />
                )}

                {(data?.pemotonganReady || []).length === 0 ? (
                  <div style={{ background: "#0F172A", borderRadius: 10, padding: 16, textAlign: "center", color: "#64748B", fontSize: 12 }}>
                    Belum ada stok kain yang selesai dipotong saat ini.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 200, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
                    {(data?.pemotonganReady || [])
                      .filter((p: any) => {
                        if (!fabricSearch) return true;
                        const q = fabricSearch.toLowerCase();
                        return (p.nama_barang || "").toLowerCase().includes(q) || (p.model || "").toLowerCase().includes(q);
                      })
                      .map((p: any) => {
                        const isSelected = requestForm.pemotongan_id === String(p.id);
                        return (
                          <div
                            key={p.id}
                            className="mobile-touch-btn"
                            onClick={() =>
                              setRequestForm((prev) => ({
                                ...prev,
                                pemotongan_id: isSelected ? "" : String(p.id)
                              }))
                            }
                            style={{
                              background: isSelected ? "#0D2137" : "#0F172A",
                              border: isSelected ? "2px solid #3B82F6" : "1px solid #334155",
                              borderRadius: 10,
                              padding: "10px 12px",
                              cursor: "pointer"
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div>
                                <div style={{ fontWeight: 800, color: "white", fontSize: 13 }}>{p.nama_barang}</div>
                                <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 1 }}>
                                  Model: <strong style={{ color: "white" }}>{p.model}</strong> · {new Date(p.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                                </div>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: 16, fontWeight: 900, color: isSelected ? "#38BDF8" : "#10B981" }}>
                                  {p.sisa_total.toLocaleString("id-ID")}
                                </div>
                                <div style={{ fontSize: 9, color: "#64748B", fontWeight: 700 }}>sisa pcs</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Step 2: Quantity */}
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", marginBottom: 5 }}>
                  2. Jumlah yang Sanggup Dikerjakan: <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type="number"
                    min="1"
                    placeholder="Contoh: 500"
                    required
                    value={requestForm.total_request}
                    onChange={(e) => setRequestForm({ ...requestForm, total_request: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "10px 50px 10px 14px",
                      borderRadius: 10,
                      border: "2px solid #334155",
                      background: "#0F172A",
                      color: "white",
                      fontSize: 18,
                      fontWeight: 900,
                      outline: "none",
                      textAlign: "center"
                    }}
                  />
                  <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "#64748B", fontWeight: 800, fontSize: 12 }}>
                    pcs
                  </span>
                </div>

                {requestForm.pemotongan_id && (() => {
                  const sel = (data?.pemotonganReady || []).find((x: any) => String(x.id) === requestForm.pemotongan_id);
                  if (!sel) return null;
                  return (
                    <div style={{ display: "flex", gap: 5, marginTop: 6, flexWrap: "wrap" }}>
                      {[100, 200, 500, sel.sisa_total].map((val) => {
                        if (val <= 0 || (val > sel.sisa_total && val !== sel.sisa_total)) return null;
                        return (
                          <button
                            key={val}
                            type="button"
                            className="mobile-touch-btn"
                            onClick={() => setRequestForm((prev) => ({ ...prev, total_request: String(val) }))}
                            style={{
                              background: "#0F172A",
                              border: "1px solid #334155",
                              color: "#94A3B8",
                              padding: "4px 8px",
                              borderRadius: 6,
                              fontSize: 10,
                              fontWeight: 700,
                              cursor: "pointer"
                            }}
                          >
                            {val === sel.sisa_total ? `Semua (${val})` : `${val} pcs`}
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Step 3: Catatan */}
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", marginBottom: 5 }}>
                  3. Catatan / Alasan:
                </label>
                <textarea
                  rows={2}
                  placeholder="Misal: Tim siap mulai hari ini..."
                  value={requestForm.catatan}
                  onChange={(e) => setRequestForm({ ...requestForm, catatan: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid #334155",
                    background: "#0F172A",
                    color: "white",
                    fontSize: 16, // iOS safe
                    outline: "none",
                    resize: "none"
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  className="mobile-touch-btn"
                  onClick={() => setShowRequestModal(false)}
                  style={{
                    flex: 1,
                    padding: 10,
                    background: "#334155",
                    color: "#94A3B8",
                    border: "none",
                    borderRadius: 8,
                    fontWeight: 700,
                    cursor: "pointer",
                    minHeight: 40
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="mobile-touch-btn"
                  disabled={submitting}
                  style={{
                    flex: 2,
                    padding: 10,
                    background: "linear-gradient(135deg, #10B981, #059669)",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    fontWeight: 800,
                    cursor: submitting ? "not-allowed" : "pointer",
                    fontSize: 13,
                    minHeight: 40,
                    boxShadow: "0 4px 12px rgba(16,185,129,0.3)"
                  }}
                >
                  {submitting ? "Mengirim..." : "Kirim ke Admin"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL: LAPOR PROGRES JAHITAN
         ══════════════════════════════════════════════════════════════ */}
      {showProgresModal && (
        <div className="vendor-modal-overlay">
          <div
            className="vendor-modal-box"
            style={{
              background: "#1E293B",
              borderRadius: 16,
              width: "100%",
              maxWidth: 500,
              overflow: "hidden",
              border: "1px solid #334155",
              boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
              maxHeight: "92vh",
              display: "flex",
              flexDirection: "column"
            }}
          >
            <div
              style={{
                padding: "14px 18px",
                borderBottom: "1px solid #334155",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#0F172A",
                flexShrink: 0
              }}
            >
              <div>
                <h3 style={{ margin: 0, color: "white", fontSize: 16, fontWeight: 900 }}>Lapor Progres Selesai</h3>
                <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>
                  PO: <strong style={{ color: "white" }}>{showProgresModal.no_po || showProgresModal.noPo}</strong> · Model:{" "}
                  <strong style={{ color: "white" }}>{showProgresModal.model}</strong>
                </div>
              </div>
              <button
                type="button"
                className="mobile-touch-btn"
                onClick={() => setShowProgresModal(null)}
                style={{ background: "transparent", border: "none", color: "#94A3B8", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={handleLaporProgres}
              style={{
                padding: "16px 18px",
                overflowY: "auto",
                WebkitOverflowScrolling: "touch",
                display: "flex",
                flexDirection: "column",
                gap: 12
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase" }}>
                  Jumlah per Size:
                </span>
                <div style={{ display: "flex", gap: 5 }}>
                  <button
                    type="button"
                    className="mobile-touch-btn"
                    onClick={() => {
                      setProgresForm((prev) =>
                        prev.map((pf) => ({
                          ...pf,
                          jumlah: pf.maxSisa > 0 ? pf.maxSisa : ""
                        }))
                      );
                    }}
                    style={{
                      background: "#1E3A5F",
                      color: "#60A5FA",
                      border: "1px solid #2563EB",
                      padding: "3px 7px",
                      borderRadius: 5,
                      fontSize: 10,
                      fontWeight: 800,
                      cursor: "pointer"
                    }}
                  >
                    Isi Semua Sisa
                  </button>
                  <button
                    type="button"
                    className="mobile-touch-btn"
                    onClick={() => {
                      setProgresForm((prev) => prev.map((pf) => ({ ...pf, jumlah: "" })));
                    }}
                    style={{
                      background: "transparent",
                      color: "#64748B",
                      border: "1px solid #334155",
                      padding: "3px 6px",
                      borderRadius: 5,
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: "pointer"
                    }}
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* Size inputs */}
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {progresForm.map((pf, idx) => (
                  <div
                    key={pf.size}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      background: "#0F172A",
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: "1px solid #1E293B"
                    }}
                  >
                    <div
                      style={{
                        background: "#1E293B",
                        color: "white",
                        width: 36,
                        height: 36,
                        borderRadius: 7,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 900,
                        fontSize: 12,
                        flexShrink: 0
                      }}
                    >
                      <span>{pf.size}</span>
                      {pf.done > 0 && <span style={{ fontSize: 8, color: "#10B981", fontWeight: 800 }}>+{pf.done}</span>}
                    </div>

                    <div style={{ flex: 1 }}>
                      <input
                        type="number"
                        placeholder="0"
                        min="0"
                        max={pf.maxSisa}
                        value={pf.jumlah}
                        onChange={(e) => {
                          const rawVal = e.target.value ? Number(e.target.value) : "";
                          const val = rawVal !== "" && Number(rawVal) > pf.maxSisa ? pf.maxSisa : rawVal;
                          const newForm = [...progresForm];
                          newForm[idx].jumlah = val;
                          setProgresForm(newForm);
                        }}
                        style={{
                          width: "100%",
                          background: "transparent",
                          border: "none",
                          color: Number(pf.jumlah) > pf.maxSisa ? "#EF4444" : "white",
                          fontSize: 18,
                          fontWeight: 800,
                          outline: "none"
                        }}
                      />
                    </div>

                    <div style={{ textAlign: "right", minWidth: 80 }}>
                      {pf.maxSisa > 0 ? (
                        <div
                          className="mobile-touch-btn"
                          onClick={() => {
                            const newForm = [...progresForm];
                            newForm[idx].jumlah = pf.maxSisa;
                            setProgresForm(newForm);
                          }}
                          style={{
                            fontSize: 10,
                            color: "#38BDF8",
                            fontWeight: 700,
                            cursor: "pointer",
                            padding: "2px 6px",
                            borderRadius: 5,
                            border: "1px dashed #0284C7"
                          }}
                        >
                          Sisa: <strong>{pf.maxSisa}</strong>
                        </div>
                      ) : (
                        <div style={{ fontSize: 10, color: "#10B981", fontWeight: 800 }}>Selesai</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Total Calculation */}
              {progresForm.some((pf) => Number(pf.jumlah) > 0) && (
                <div
                  style={{
                    padding: "8px 12px",
                    background: "linear-gradient(135deg, #1E3A5F 0%, #1E293B 100%)",
                    border: "1px solid #3B82F6",
                    borderRadius: 8,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}
                >
                  <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 700 }}>Total dilaporkan:</span>
                  <span style={{ fontSize: 18, fontWeight: 900, color: "#38BDF8" }}>
                    {progresForm.reduce((s, pf) => s + (Number(pf.jumlah) || 0), 0)} pcs
                  </span>
                </div>
              )}

              {/* Catatan */}
              <div>
                <label style={{ display: "block", color: "#94A3B8", fontSize: 11, fontWeight: 800, textTransform: "uppercase", marginBottom: 5 }}>
                  Catatan (Opsional):
                </label>
                <textarea
                  rows={2}
                  placeholder="Misal: Sudah di-packing kardus..."
                  value={progresCatatan}
                  onChange={(e) => setProgresCatatan(e.target.value)}
                  style={{
                    width: "100%",
                    background: "#0F172A",
                    border: "1px solid #334155",
                    color: "white",
                    borderRadius: 8,
                    padding: "8px 10px",
                    outline: "none",
                    fontSize: 16, // iOS safe
                    resize: "none"
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  className="mobile-touch-btn"
                  onClick={() => setShowProgresModal(null)}
                  style={{
                    flex: 1,
                    padding: 10,
                    background: "#334155",
                    color: "#94A3B8",
                    border: "none",
                    borderRadius: 8,
                    fontWeight: 700,
                    cursor: "pointer",
                    minHeight: 40
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="mobile-touch-btn"
                  disabled={submitting}
                  style={{
                    flex: 2,
                    padding: 10,
                    background: "linear-gradient(135deg, #2563EB 0%, #4F46E5 100%)",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    fontWeight: 800,
                    fontSize: 13,
                    minHeight: 40,
                    cursor: submitting ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 12px rgba(37,99,235,0.3)"
                  }}
                >
                  {submitting ? "Mengirim..." : "Kirim Laporan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL: DETAIL SPK / PO
         ══════════════════════════════════════════════════════════════ */}
      {detailPoModal && (
        <div className="vendor-modal-overlay">
          <div
            className="vendor-modal-box"
            style={{
              background: "#1E293B",
              borderRadius: 16,
              width: "100%",
              maxWidth: 500,
              overflow: "hidden",
              border: "1px solid #334155",
              boxShadow: "0 25px 50px rgba(0,0,0,0.5)"
            }}
          >
            <div
              style={{
                padding: "14px 18px",
                borderBottom: "1px solid #334155",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#0F172A"
              }}
            >
              <div>
                <h3 style={{ margin: 0, color: "white", fontSize: 16, fontWeight: 900 }}>Rincian Dokumen SPK</h3>
                <div style={{ fontSize: 11, color: "#38BDF8", marginTop: 2, fontFamily: "monospace" }}>
                  {detailPoModal.no_po || detailPoModal.noPo}
                </div>
              </div>
              <button
                type="button"
                className="mobile-touch-btn"
                onClick={() => setDetailPoModal(null)}
                style={{ background: "transparent", border: "none", color: "#94A3B8", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div style={{ background: "#0F172A", padding: 8, borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: "#64748B", fontWeight: 700 }}>MODEL</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "white", marginTop: 1 }}>{detailPoModal.model}</div>
                </div>
                <div style={{ background: "#0F172A", padding: 8, borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: "#64748B", fontWeight: 700 }}>TOTAL TARGET</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#10B981", marginTop: 1 }}>
                    {(detailPoModal.jumlah_terbit || detailPoModal.jumlahTerbit || 0).toLocaleString("id-ID")} pcs
                  </div>
                </div>
                <div style={{ background: "#0F172A", padding: 8, borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: "#64748B", fontWeight: 700 }}>TANGGAL TERBIT</div>
                  <div style={{ fontSize: 11, color: "white", marginTop: 1 }}>
                    {detailPoModal.tanggalTerbit
                      ? new Date(detailPoModal.tanggalTerbit).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
                      : "-"}
                  </div>
                </div>
                <div style={{ background: "#0F172A", padding: 8, borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: "#64748B", fontWeight: 700 }}>TARGET SELESAI</div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: detailPoModal.isOverdue ? "#EF4444" : "white",
                      marginTop: 1
                    }}
                  >
                    {detailPoModal.targetSelesai
                      ? new Date(detailPoModal.targetSelesai).toLocaleDateString("id-ID", { day: "numeric", month: "short" })
                      : "Antrean"}
                  </div>
                </div>
              </div>

              {detailPoModal.catatan && (
                <div style={{ background: "#0F172A", padding: 8, borderRadius: 8, fontSize: 11, color: "#CBD5E1" }}>
                  <div style={{ fontSize: 9, color: "#64748B", fontWeight: 800, marginBottom: 2 }}>CATATAN:</div>
                  "{detailPoModal.catatan}"
                </div>
              )}

              <div>
                <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 800, marginBottom: 5, textTransform: "uppercase" }}>
                  Distribusi Size:
                </div>
                <div style={{ background: "#0F172A", borderRadius: 8, border: "1px solid #334155", overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 11 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #334155", color: "#64748B" }}>
                        <th style={{ padding: "5px 10px" }}>SIZE</th>
                        <th style={{ padding: "5px 10px" }}>TARGET</th>
                        <th style={{ padding: "5px 10px" }}>ACC</th>
                        <th style={{ padding: "5px 10px" }}>SISA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detailPoModal.sizeBreakdown || []).map((s: any) => {
                        const done = detailPoModal.sizeProgress?.[s.size] || 0;
                        const tgt = Number(s.jumlah || s.sisa || 0);
                        return (
                          <tr key={s.size} style={{ borderBottom: "1px solid #1E293B" }}>
                            <td style={{ padding: "5px 10px", fontWeight: 800, color: "white" }}>{s.size}</td>
                            <td style={{ padding: "5px 10px", color: "#94A3B8" }}>{tgt} pcs</td>
                            <td style={{ padding: "5px 10px", color: "#10B981", fontWeight: 700 }}>{done} pcs</td>
                            <td style={{ padding: "5px 10px", color: Math.max(0, tgt - done) > 0 ? "#F59E0B" : "#10B981" }}>
                              {Math.max(0, tgt - done)} pcs
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <button
                type="button"
                className="mobile-touch-btn"
                onClick={() => setDetailPoModal(null)}
                style={{
                  width: "100%",
                  padding: 10,
                  background: "#334155",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 800,
                  cursor: "pointer",
                  minHeight: 38
                }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL: RIWAYAT LAPORAN PO SPESIFIK
         ══════════════════════════════════════════════════════════════ */}
      {poReportsModal && (
        <div className="vendor-modal-overlay">
          <div
            className="vendor-modal-box"
            style={{
              background: "#1E293B",
              borderRadius: 16,
              width: "100%",
              maxWidth: 520,
              overflow: "hidden",
              border: "1px solid #334155",
              boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column"
            }}
          >
            <div
              style={{
                padding: "14px 18px",
                borderBottom: "1px solid #334155",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#0F172A",
                flexShrink: 0
              }}
            >
              <div>
                <h3 style={{ margin: 0, color: "white", fontSize: 16, fontWeight: 900 }}>Riwayat Laporan PO</h3>
                <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>
                  PO: <strong style={{ color: "white" }}>{poReportsModal.no_po || poReportsModal.noPo}</strong>
                </div>
              </div>
              <button
                type="button"
                className="mobile-touch-btn"
                onClick={() => setPoReportsModal(null)}
                style={{ background: "transparent", border: "none", color: "#94A3B8", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "16px 18px", overflowY: "auto", WebkitOverflowScrolling: "touch", display: "flex", flexDirection: "column", gap: 8 }}>
              {(() => {
                const cmtReports = (data.cmt_progres || []).filter(
                  (p: any) =>
                    p.po_id === poReportsModal.id ||
                    p.transfer_id === poReportsModal.id ||
                    (p.noPo && p.noPo === (poReportsModal.no_po || poReportsModal.noPo))
                );

                if (cmtReports.length === 0) {
                  return (
                    <div style={{ padding: 28, textAlign: "center", color: "#64748B", fontSize: 12 }}>
                      Belum ada laporan progres yang disubmit untuk PO ini.
                    </div>
                  );
                }

                return cmtReports.map((rec: any, idx: number) => {
                  const isAcc = rec.status === "Diterima" || rec.status === "Diverifikasi";
                  const isPending = rec.status === "Menunggu" || rec.status === "Pending";
                  return (
                    <div
                      key={idx}
                      style={{
                        background: "#0F172A",
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "1px solid #1E293B",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 10
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, color: "white", fontSize: 13 }}>
                          Setoran {rec.totalJumlah} pcs
                        </div>
                        <div style={{ fontSize: 10, color: "#64748B", marginTop: 2 }}>
                          {new Date(rec.createdAt).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </div>
                        <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginTop: 4 }}>
                          {(rec.items || []).map((it: any) => (
                            <span
                              key={it.size}
                              style={{
                                background: "#1E293B",
                                color: "#94A3B8",
                                padding: "1px 5px",
                                borderRadius: 4,
                                fontSize: 9,
                                fontWeight: 700
                              }}
                            >
                              {it.size}: {it.jumlah}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <span
                          style={{
                            background: isAcc ? "#064E3B" : isPending ? "#451A03" : "#450A0A",
                            color: isAcc ? "#34D399" : isPending ? "#FCD34D" : "#FCA5A5",
                            padding: "2px 7px",
                            borderRadius: 6,
                            fontSize: 10,
                            fontWeight: 800
                          }}
                        >
                          {rec.status}
                        </span>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL: CETAK SLIP GAJI / BUKTI SELESAI
         ══════════════════════════════════════════════════════════════ */}
      {printDocModal && (
        <div className="vendor-modal-overlay">
          <div
            className="vendor-modal-box"
            style={{
              background: "#FFFFFF",
              color: "#0F172A",
              width: "100%",
              maxWidth: 500,
              borderRadius: 14,
              overflow: "hidden",
              boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
              display: "flex",
              flexDirection: "column",
              fontFamily: "'Courier New', Courier, monospace"
            }}
          >
            <div
              style={{
                background: "#0F172A",
                color: "white",
                padding: "10px 16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontFamily: "Inter, sans-serif"
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 800 }}>Pratinjau Dokumen Cetak</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  className="mobile-touch-btn"
                  onClick={() => window.print()}
                  style={{
                    background: "#2563EB",
                    color: "white",
                    border: "none",
                    padding: "5px 10px",
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 5
                  }}
                >
                  <Printer size={13} /> Cetak (PDF)
                </button>
                <button
                  type="button"
                  className="mobile-touch-btn"
                  onClick={() => setPrintDocModal(null)}
                  style={{
                    background: "#334155",
                    color: "#94A3B8",
                    border: "none",
                    padding: "5px 8px",
                    borderRadius: 6,
                    cursor: "pointer"
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            <div id="printable-voucher" style={{ padding: "20px 20px" }}>
              <div style={{ textAlign: "center", borderBottom: "2px dashed #CBD5E1", paddingBottom: 10, marginBottom: 12 }}>
                <h2 style={{ fontSize: 15, fontWeight: 900, margin: 0 }}>TIRTA BINTANG JEANS</h2>
                <div style={{ fontSize: 10, color: "#64748B", marginTop: 2 }}>Spesialis Denim & Celana Jeans Konveksi</div>
                <div style={{ fontSize: 11, fontWeight: 900, marginTop: 5, letterSpacing: 1 }}>
                  {printDocModal.type === "gaji" ? "SLIP BUKTI PEMBAYARAN UPAH / GAJI" : "BUKTI PENYELESAIAN SPK PRODUKSI"}
                </div>
              </div>

              <div style={{ fontSize: 11, lineHeight: 1.7, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Mitra Vendor:</span>
                  <strong>{vendor.nama} ({vendor.kodeVendor || vendor.kode})</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Tanggal:</span>
                  <span>{new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
                </div>
                {printDocModal.type === "gaji" && (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Keterangan:</span>
                      <span>{printDocModal.item.keterangan || `Gaji PO #${printDocModal.item.poId || printDocModal.item.id}`}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Metode:</span>
                      <span>{printDocModal.item.metode || "Transfer Bank"}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Status:</span>
                      <strong style={{ color: printDocModal.item.status === "Lunas" ? "#059669" : "#D97706" }}>
                        {printDocModal.item.status}
                      </strong>
                    </div>
                  </>
                )}
                {printDocModal.type === "spk" && (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Nomor PO:</span>
                      <strong>{printDocModal.item.no_po || printDocModal.item.noPo}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Model:</span>
                      <span>{printDocModal.item.model}</span>
                    </div>
                  </>
                )}
              </div>

              <div
                style={{
                  background: "#F1F5F9",
                  border: "1px solid #E2E8F0",
                  borderRadius: 6,
                  padding: "8px 12px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 16
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 700 }}>
                  {printDocModal.type === "gaji" ? "TOTAL DIBAYARKAN:" : "TOTAL SELESAI:"}
                </span>
                <span style={{ fontSize: 15, fontWeight: 900, color: "#0F172A" }}>
                  {printDocModal.type === "gaji"
                    ? formatRupiah(Number(printDocModal.item.totalGaji || printDocModal.item.total || 0))
                    : `${(printDocModal.item.jumlah_terbit || 0).toLocaleString("id-ID")} pcs`}
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", textAlign: "center", fontSize: 10, marginTop: 20 }}>
                <div style={{ width: 110 }}>
                  <div>Diserahkan Oleh,</div>
                  <div style={{ height: 36 }} />
                  <div style={{ borderTop: "1px solid #0F172A", paddingTop: 3 }}>Bag. Keuangan / Kasir</div>
                </div>
                <div style={{ width: 110 }}>
                  <div>Diterima Oleh,</div>
                  <div style={{ height: 36 }} />
                  <div style={{ borderTop: "1px solid #0F172A", paddingTop: 3 }}>{vendor.nama}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL: KONFIRMASI BATALKAN PERMOHONAN
         ══════════════════════════════════════════════════════════════ */}
      {confirmCancelModal && (
        <div className="vendor-modal-overlay" style={{ zIndex: 110 }}>
          <div
            className="vendor-modal-box"
            style={{
              background: "#1E293B",
              borderRadius: 14,
              width: "100%",
              maxWidth: 380,
              padding: 20,
              border: "1px solid #334155",
              boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
              textAlign: "center"
            }}
          >
            <AlertCircle size={36} color="#EF4444" style={{ margin: "0 auto 8px" }} />
            <h3 style={{ fontSize: 16, fontWeight: 900, color: "white", margin: 0 }}>Batalkan Permohonan?</h3>
            <p style={{ color: "#94A3B8", fontSize: 12, marginTop: 6, lineHeight: 1.4 }}>
              Yakin ingin membatalkan permohonan <strong>{confirmCancelModal.total_request} pcs</strong> ini?
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button
                type="button"
                className="mobile-touch-btn"
                onClick={() => setConfirmCancelModal(null)}
                style={{
                  flex: 1,
                  padding: 9,
                  background: "#334155",
                  color: "#94A3B8",
                  border: "none",
                  borderRadius: 7,
                  fontWeight: 700,
                  cursor: "pointer",
                  minHeight: 38
                }}
              >
                Kembali
              </button>
              <button
                type="button"
                className="mobile-touch-btn"
                onClick={handleCancelRequestConfirmed}
                disabled={submitting}
                style={{
                  flex: 1,
                  padding: 9,
                  background: "#EF4444",
                  color: "white",
                  border: "none",
                  borderRadius: 7,
                  fontWeight: 800,
                  cursor: submitting ? "not-allowed" : "pointer",
                  minHeight: 38
                }}
              >
                {submitting ? "Memproses..." : "Ya, Batalkan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
