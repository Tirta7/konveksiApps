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
  Info,
  AlertOctagon,
  MessageCircle,
  RotateCcw,
  Scissors,
  Droplets,
  Layers,
  Truck,
  ClipboardList
} from "lucide-react";
import NotaRejectModal from "@/components/NotaRejectModal";
import { toast } from "sonner";
import {
  subscribeRealtime,
  subscribeRealtimeStatus,
  subscribeRealtimeEvent,
  subscribePresence,
  setPresence,
  getRealtimeTransport,
  type PresenceEntry,
  visiblePoll
} from "@/lib/realtime-client";

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
  /** Siapa yang membuka portal: vendor ybs, atau owner/admin (pratinjau). */
  viewer?: "vendor" | "user";
}

export default function VendorPortal({ vendorId = "1", defaultTipe = "cmt", viewer = "vendor" }: VendorPortalProps) {
  const id = vendorId;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<"connected" | "connecting" | "offline">("connecting");
  const [transport, setTransport] = useState<string | null>(null);
  const [presenceList, setPresenceList] = useState<PresenceEntry[]>([]);
  const [activeTab, setActiveTab] = useState<"dashboard" | "riwayat" | "gaji" | "requests" | "reject">("dashboard");
  const [selectedNota, setSelectedNota] = useState<any | null>(null);
  const [rejectFilter, setRejectFilter] = useState<string>("Semua");

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
  const [showCmtRef, setShowCmtRef] = useState(false);
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
      setTransport(getRealtimeTransport());
    });
    const unsubSync = subscribeRealtime(() => {
      fetchDataRef.current(true);
      setTransport(getRealtimeTransport());
    });
    const unsubPresence = subscribePresence(setPresenceList);
    const unsubEvents = subscribeRealtimeEvent((event, d) => {
      if (!d) return;
      if (event === "requestUpdated" && Number(d.vendor_id) === Number(id)) {
        if (d.status === "Selesai" || d.status === "Sebagian") {
          toast.success(`🎉 Permohonan Anda disetujui Admin! (${d.total_dipenuhi} pcs dialokasikan${d.no_po ? ` untuk ${d.no_po}` : ""})`);
        } else if (d.status === "Ditolak") {
          toast.warning(`ℹ️ Permohonan kerjaan Anda ditolak Admin: ${d.alasan || "Stok dialokasikan ke pos lain"}`);
        }
        fetchDataRef.current(true);
      } else if (event === "reportReviewed" && Number(d.vendor_id) === Number(id)) {
        if (d.status === "Diterima") {
          toast.success(`✓ Laporan pengerjaan (${d.jumlah} pcs) telah diverifikasi & di-ACC Admin!`);
        } else if (d.status === "Ditolak") {
          toast.error(`✕ Laporan pengerjaan (${d.jumlah} pcs) ditolak Admin.`);
        }
        fetchDataRef.current(true);
      } else if (event === "poolAllocated") {
        fetchDataRef.current(true);
      }
    });

    // Fallback poll only (realtime handles normal updates); skipped while tab hidden
    const stopPoll = visiblePoll(() => fetchDataRef.current(true), 30000);

    return () => {
      unsubStatus();
      unsubSync();
      unsubPresence();
      unsubEvents();
      stopPoll();
    };
  }, [id]);

  // Presence: laporkan saat vendor sedang membuka form Minta Kerjaan
  useEffect(() => {
    if (!showRequestModal) return;
    const sel = (data?.pemotonganReady || []).find((p: any) => String(p.id) === requestForm.pemotongan_id);
    const key = `minta:${id}`;
    setPresence(key, {
      key,
      role: "vendor",
      vendor_id: Number(id),
      name: data?.vendor?.nama || "Vendor",
      action: "minta",
      transfer_id: sel?.is_transfer ? Number(sel.id) : null,
      po_id: sel?.po_id || null,
      label: `${data?.vendor?.nama || "Vendor"} membuka permohonan kerjaan`
    });
    return () => setPresence(key, null);
  }, [showRequestModal, requestForm.pemotongan_id, id, data?.vendor?.nama, data?.pemotonganReady]);

  // 3. Scroll unlocker for standalone portal (Top-level Hook)
  // Hanya <html> yang menjadi scroll container. Body TIDAK boleh overflow:auto,
  // karena body ikut jadi scroll container dan "menjebak" scroll mouse/touch.
  useEffect(() => {
    const origBodyOverflow = document.body.style.overflow;
    const origHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "visible";
    document.documentElement.style.overflow = "";
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
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Gagal mengirim laporan progres");
      }

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
      const resJson = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409) {
          fetchData(true);
          toast.warning(resJson.error || "Stok sudah tidak tersedia atau bentrok dengan alokasi Admin");
          return;
        }
        throw new Error(resJson.error || "Gagal mengirim permohonan kerjaan");
      }

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
      const resJson = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(resJson.error || "Gagal membatalkan request");
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
  const rawTipe = String(vendor?.tipe || vendor?.jenis_pekerjaan || defaultTipe || "").toLowerCase();
  const rawNama = String(vendor?.nama || "").toLowerCase();
  const combinedVendor = `${rawTipe} ${rawNama}`;

  // Multi-tier Intelligent Detection:
  // Layer 1: Pilihan Tipe Vendor resmi di database (slug / tipe)
  // Layer 2: Deteksi kata kunci nama & alias usaha (Cuci, Laundry, Benang, QC Packing, dll)
  // Layer 3: Deteksi pos tahap pekerjaan per-PO (ke_tahap: "washing", "bersih_benang", dll)
  const isWashingVendor = /wash|cuci|laundr|loundr|bleach|celup|dye|stone|pewarnaan/i.test(combinedVendor);
  const isBersihBenangVendor = /benang|buang.*benang|potong.*benang|trim/i.test(combinedVendor);
  const isFinishingVendor = /finish|pack|qc|quality|gosok|setrika|steam|hangtag/i.test(combinedVendor);
  const isSablonBordirVendor = /sablon|screen|print|bordir|embroidery/i.test(combinedVendor);
  const isCmtVendor = !isWashingVendor && !isBersihBenangVendor && !isFinishingVendor && !isSablonBordirVendor;

  // Helper cerdas mendeteksi stage per individual job/PO
  const getJobStage = (poItem?: any) => {
    const jobTahap = String(poItem?.ke_tahap || poItem?.tahap || "").toLowerCase();
    const effectiveStr = `${combinedVendor} ${jobTahap}`;
    const jobWashing = /wash|cuci|laundr|loundr|bleach|celup|dye|stone|pewarnaan/i.test(effectiveStr);
    const jobBenang = /benang|buang.*benang|potong.*benang|trim/i.test(effectiveStr);
    const jobFinishing = /finish|pack|qc|quality|gosok|setrika|steam|hangtag/i.test(effectiveStr);
    const jobSablon = /sablon|screen|print|bordir|embroidery/i.test(effectiveStr);
    const jobCmt = !jobWashing && !jobBenang && !jobFinishing && !jobSablon;
    return {
      isWashing: jobWashing,
      isBersihBenang: jobBenang,
      isFinishing: jobFinishing,
      isSablonBordir: jobSablon,
      isCmt: jobCmt
    };
  };

  const isWashing = isWashingVendor;
  const isBersihBenang = isBersihBenangVendor;
  const isFinishing = isFinishingVendor;
  const isSablonBordir = isSablonBordirVendor;
  const isCmt = isCmtVendor;
  const activePOs = data.activePO || [];
  const historiPOs = data.historiPO || [];
  const gajiRecords = data.gaji || [];
  const ringkasanGaji = data.ringkasanGaji || null;
  const rincianGajiPerPo = data.rincianGajiPerPo || [];
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
        overflowX: "clip"
      }}
    >
      {/* ── RESPONSIVE STYLES FOR MOBILE & IOS ── */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            html {
              overflow-x: hidden !important;
              overflow-y: auto !important;
              min-height: 100vh !important;
              min-height: 100dvh !important;
              background-color: #0F172A !important;
              overscroll-behavior-y: none !important;
            }
            body {
              overflow: visible !important;
              overflow-x: clip !important;
              min-height: 100vh !important;
              min-height: 100dvh !important;
              background-color: #0F172A !important;
              overscroll-behavior: auto !important;
            }
            #vendor-portal-page {
              width: 100% !important;
              min-height: 100vh !important;
              min-height: 100dvh !important;
              overflow: visible !important;
              overflow-x: clip !important;
              background-color: #0F172A !important;
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
                  {realtimeStatus === "connected" ? (transport === "websocket" ? "Live Realtime · WS" : "Live Realtime") : "Menghubungkan..."}
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
                  <li>
                    <strong>Setelah semua dilaporkan:</strong> hitungan keterlambatan langsung <em>berhenti</em> (dibekukan) walau masih menunggu ACC Admin.
                  </li>
                  <li>
                    <strong>Setelah di-ACC penuh:</strong> PO pindah ke <em>Riwayat Kinerja</em> dengan catatan tepat waktu / terlambat X hari, penalti dihapus, dan Anda bisa langsung minta kerjaan baru.
                  </li>
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Banner Peringatan Tagihan Reject Vendor */}
        {(data?.totalKlaimTertunggak || 0) > 0 && (
          <div
            style={{
              background: "linear-gradient(90deg, #450A0A 0%, #1E0707 100%)",
              border: "1px solid #DC2626",
              borderRadius: 14,
              padding: "12px 18px",
              marginBottom: 16,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
              boxShadow: "0 2px 10px rgba(220,38,38,0.2)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 9,
                  background: "#7F1D1D",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#FCA5A5",
                  flexShrink: 0
                }}
              >
                <AlertTriangle size={18} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 900, color: "#FCA5A5" }}>
                  Terdapat Tagihan Klaim Reject: {formatRupiah(data.totalKlaimTertunggak)}
                </div>
                <div style={{ fontSize: 11, color: "#FECACA", marginTop: 2 }}>
                  Ada {(data.nota_reject || []).filter((n: any) => n.status_klaim !== "Lunas").length} nota klaim ganti rugi barang reject yang perlu diselesaikan / dipotongkan pada invoice vendor.
                </div>
              </div>
            </div>
            <button
              type="button"
              className="mobile-touch-btn"
              onClick={() => setActiveTab("reject")}
              style={{
                background: "#DC2626",
                color: "white",
                border: "none",
                borderRadius: 8,
                padding: "7px 14px",
                fontSize: 11.5,
                fontWeight: 800,
                cursor: "pointer"
              }}
            >
              Lihat Tagihan Reject &rarr;
            </button>
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
              {totalTertunggak > 0
                ? `${(ringkasanGaji?.totalPcsSelesai ?? totalSelesaiPcs).toLocaleString("id-ID")} pcs siap dicairkan`
                : "Semua upah terselesaikan"}
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
            { key: "requests", label: "Riwayat Permohonan", count: requests.length },
            { key: "reject", label: "Tagihan Reject", count: (data?.nota_reject || []).length, alert: (data?.totalKlaimTertunggak || 0) > 0 }
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
                const isRework = !!po.is_rework || po.transfer_status === "Retur Perbaikan";
                const isDikerjakan = po.transfer_status === "Dikerjakan";
                const totalPending = Number(po.totalPending || 0);
                const sisaBelumLapor = Math.max(0, totalTarget - totalDone - totalPending);
                const isWaitingAcc = !isRework && (!!po.waitingAcc || (totalTarget > 0 && totalPending > 0 && sisaBelumLapor <= 0));
                const pctPending = totalTarget > 0 ? Math.min(100 - Math.min(pct, 100), Math.round((totalPending / totalTarget) * 100)) : 0;
                const hasReported = totalDone > 0 || totalPending > 0;
                const statusBadge = isRework
                  ? { text: `⚠️ RETUR PERBAIKAN ${po.rework_count && po.rework_count > 1 ? `(KE-${po.rework_count})` : ""}`.trim(), bg: "#451A03", color: "#FCD34D", border: "#D97706" }
                  : isWaitingAcc
                  ? { text: "MENUNGGU ACC ADMIN", bg: "#3B0764", color: "#D8B4FE", border: "#7C3AED" }
                  : totalPending > 0
                  ? { text: "SEBAGIAN MENUNGGU ACC", bg: "#431407", color: "#FDBA74", border: "#EA580C" }
                  : totalDone > 0
                  ? { text: "SETOR BERTAHAP", bg: "#082F49", color: "#7DD3FC", border: "#0284C7" }
                  : isDikerjakan
                  ? { text: "SEDANG DIKERJAKAN", bg: "#064E3B", color: "#34D399", border: "#059669" }
                  : { text: "BELUM DIMULAI", bg: "#1E3A5F", color: "#60A5FA", border: "#2563EB" };

                return (
                  <div
                    key={po.id}
                    style={{
                      background: isJustSubmitted ? "#0D2137" : "#1E293B",
                      borderRadius: 16,
                      border: isJustSubmitted
                        ? "2px solid #10B981"
                        : isRework
                        ? "2px solid #D97706"
                        : isOverdue
                        ? "2px solid rgba(239, 68, 68, 0.7)"
                        : "1px solid #334155",
                      overflow: "hidden",
                      boxShadow: isRework ? "0 4px 20px rgba(217, 119, 6, 0.25)" : "0 4px 16px rgba(0,0,0,0.2)"
                    }}
                  >
                    {/* Retur Perbaikan Alert Strip */}
                    {isRework && (
                      <div
                        style={{
                          background: "linear-gradient(135deg, #78350F 0%, #B45309 100%)",
                          padding: "10px 16px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          flexWrap: "wrap",
                          gap: 8,
                          borderBottom: "1px solid #D97706"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <RotateCcw size={16} color="#FCD34D" />
                          <div>
                            <div style={{ fontWeight: 900, fontSize: 11.5, color: "#FEF3C7" }}>
                              PERMINTAAN PERBAIKAN / REWORK {po.rework_count && po.rework_count > 1 ? `(RETUR KE-${po.rework_count})` : ""}
                            </div>
                            <div style={{ fontSize: 10.5, color: "#FDE68A", marginTop: 2 }}>
                              {po.alasan_retur ? `Catatan QC: "${po.alasan_retur}"` : "Barang dikembalikan dari Gudang untuk diperbaiki / dicuci ulang."}
                            </div>
                          </div>
                        </div>
                        <span style={{ background: "#FEF3C7", color: "#92400E", fontSize: 10, fontWeight: 900, padding: "3px 8px", borderRadius: 6 }}>
                          Perbaiki & Laporkan Ulang
                        </span>
                      </div>
                    )}

                    {/* Waiting ACC strip: semua sudah dilaporkan → hitungan terlambat berhenti */}
                    {!isOverdue && isWaitingAcc && (
                      <div
                        style={{
                          background: "linear-gradient(135deg, #78350F 0%, #92400E 100%)",
                          padding: "8px 16px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          flexWrap: "wrap",
                          gap: 8
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Clock size={15} color="#FCD34D" />
                          <span style={{ fontWeight: 800, fontSize: 11, color: "#FDE68A" }}>
                            SEMUA SUDAH DILAPORKAN • MENUNGGU ACC ADMIN
                          </span>
                        </div>
                        <span style={{ background: "rgba(0,0,0,0.25)", color: "#FDE68A", fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 12 }}>
                          {overdueDays > 0 ? `Terlambat ${overdueDays} hari (hitungan dihentikan)` : "Tepat waktu"}
                        </span>
                      </div>
                    )}

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
                                background: statusBadge.bg,
                                color: statusBadge.color,
                                border: `1px solid ${statusBadge.border}`,
                                padding: "2px 7px",
                                borderRadius: 6,
                                fontSize: 10,
                                fontWeight: 800
                              }}
                            >
                              {statusBadge.text}
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
                            {po.nama_kain && po.nama_kain !== "-" && (
                              <>
                                <span>·</span>
                                <div>
                                  Kain: <strong style={{ color: "#38BDF8" }}>{po.nama_kain}</strong>
                                </div>
                              </>
                            )}
                            {po.asal_vendor && (
                              <>
                                <span>·</span>
                                <div>
                                  Dari: <strong style={{ color: "#E2E8F0" }}>{po.asal_vendor}</strong>
                                </div>
                              </>
                            )}
                            <span>·</span>
                            <div
                              style={{
                                background: isWaitingAcc ? "#3B0764" : "#451A03",
                                color: isWaitingAcc ? "#D8B4FE" : "#FCD34D",
                                padding: "1px 6px",
                                borderRadius: 5,
                                fontSize: 10,
                                fontWeight: 700
                              }}
                            >
                              {isWaitingAcc
                                ? `Semua dilaporkan · ${totalPending.toLocaleString("id-ID")} pcs menunggu ACC`
                                : `Belum dilaporkan: ${sisaBelumLapor.toLocaleString("id-ID")} pcs`}
                            </div>
                            {!isWaitingAcc && totalPending > 0 && (
                              <div
                                style={{
                                  background: "#431407",
                                  color: "#FDBA74",
                                  padding: "1px 6px",
                                  borderRadius: 5,
                                  fontSize: 10,
                                  fontWeight: 700
                                }}
                              >
                                Menunggu ACC: {totalPending.toLocaleString("id-ID")} pcs
                              </div>
                            )}
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
                            Progres Di-ACC Admin
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
                        <div style={{ width: "100%", background: "#1E293B", height: 7, borderRadius: 4, overflow: "hidden", display: "flex" }}>
                          <div
                            style={{
                              background:
                                pct >= 100 ? "#10B981" : "linear-gradient(90deg, #3B82F6 0%, #8B5CF6 100%)",
                              height: "100%",
                              width: `${Math.min(pct, 100)}%`,
                              transition: "width 0.8s cubic-bezier(.4,2,.6,1)"
                            }}
                          />
                          {pctPending > 0 && (
                            <div
                              style={{
                                background: "repeating-linear-gradient(45deg, #F59E0B 0 6px, #D97706 6px 12px)",
                                height: "100%",
                                width: `${pctPending}%`,
                                transition: "width 0.8s"
                              }}
                            />
                          )}
                        </div>
                        {hasReported && (
                          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 6, fontSize: 10.5, fontWeight: 700 }}>
                            <span style={{ color: "#34D399" }}>✓ {totalDone.toLocaleString("id-ID")} di-ACC</span>
                            {totalPending > 0 && <span style={{ color: "#FBBF24" }}>⏳ {totalPending.toLocaleString("id-ID")} menunggu ACC admin</span>}
                            {sisaBelumLapor > 0 && <span style={{ color: "#94A3B8" }}>{sisaBelumLapor.toLocaleString("id-ID")} belum dilaporkan</span>}
                          </div>
                        )}
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
                                    <div style={{ fontSize: 9, color: "#F59E0B", fontWeight: 800, marginTop: 1 }} title="Menunggu ACC admin">
                                      ⏳ {sPending} tunggu ACC
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

                      {/* ── CATATAN / INSTRUKSI KHUSUS PENGIRIMAN ── */}
                      {po.catatan && po.catatan !== "ACC Request" && (
                        <div
                          style={{
                            background: "rgba(245, 158, 11, 0.12)",
                            border: "1px solid rgba(245, 158, 11, 0.35)",
                            borderRadius: 8,
                            padding: "8px 12px",
                            marginBottom: 12,
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 8
                          }}
                        >
                          <ClipboardList size={15} color="#FBBF24" style={{ flexShrink: 0, marginTop: 2 }} />
                          {(() => {
                            const poStage = getJobStage(po);
                            return (
                              <div style={{ fontSize: 11.5, color: "#FEF3C7", lineHeight: 1.45 }}>
                                <strong style={{ color: "#FBBF24", marginRight: 5 }}>
                                  {poStage.isWashing ? "Catatan Washing / Pengiriman:" : poStage.isBersihBenang ? "Catatan Bersih Benang:" : poStage.isFinishing ? "Catatan Finishing / QC:" : poStage.isCmt ? "Catatan SPK Jahit:" : "Catatan Pengiriman:"}
                                </strong>
                                "{po.catatan}"
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* ── SPESIFIKASI KHUSUS PREVIEW PILLS ── */}
                      {(() => {
                        const poStage = getJobStage(po);
                        if (poStage.isWashing) {
                          return (
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14, fontSize: 11 }}>
                              <span style={{ background: "#1E3A8A", color: "#93C5FD", padding: "3px 8px", borderRadius: 6, border: "1px solid #3B82F6", display: "inline-flex", alignItems: "center", gap: 4 }}>
                                <Droplets size={11} color="#60A5FA" /> <strong>Pos:</strong> Washing / Laundry
                              </span>
                              {po.nama_kain && po.nama_kain !== "-" && (
                                <span style={{ background: "#0F172A", color: "#38BDF8", padding: "3px 8px", borderRadius: 6, border: "1px solid #0284C7", display: "inline-flex", alignItems: "center", gap: 4 }}>
                                  <Layers size={11} color="#38BDF8" /> <strong>Kain:</strong> {po.nama_kain}
                                </span>
                              )}
                              {po.asal_vendor && (
                                <span style={{ background: "#0F172A", color: "#CBD5E1", padding: "3px 8px", borderRadius: 6, border: "1px solid #334155", display: "inline-flex", alignItems: "center", gap: 4 }}>
                                  <Truck size={11} color="#94A3B8" /> <strong>Dari:</strong> {po.asal_vendor}
                                </span>
                              )}
                              {po.catatan && po.catatan !== "ACC Request" && (
                                <span style={{ background: "#451A03", color: "#FCD34D", padding: "3px 8px", borderRadius: 6, border: "1px solid #B45309", display: "inline-flex", alignItems: "center", gap: 4 }}>
                                  <ClipboardList size={11} /> <strong>Instruksi Khusus</strong>
                                </span>
                              )}
                            </div>
                          );
                        }
                        if (poStage.isBersihBenang) {
                          return (
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14, fontSize: 11 }}>
                              <span style={{ background: "#581C87", color: "#E9D5FF", padding: "3px 8px", borderRadius: 6, border: "1px solid #9333EA", display: "inline-flex", alignItems: "center", gap: 4 }}>
                                <Scissors size={11} color="#C084FC" /> <strong>Pos:</strong> Bersih Benang
                              </span>
                              {po.nama_kain && po.nama_kain !== "-" && (
                                <span style={{ background: "#0F172A", color: "#38BDF8", padding: "3px 8px", borderRadius: 6, border: "1px solid #0284C7", display: "inline-flex", alignItems: "center", gap: 4 }}>
                                  <Layers size={11} color="#38BDF8" /> <strong>Kain:</strong> {po.nama_kain}
                                </span>
                              )}
                              {po.asal_vendor && (
                                <span style={{ background: "#0F172A", color: "#CBD5E1", padding: "3px 8px", borderRadius: 6, border: "1px solid #334155", display: "inline-flex", alignItems: "center", gap: 4 }}>
                                  <Truck size={11} color="#94A3B8" /> <strong>Dari:</strong> {po.asal_vendor}
                                </span>
                              )}
                              {po.catatan && po.catatan !== "ACC Request" && (
                                <span style={{ background: "#451A03", color: "#FCD34D", padding: "3px 8px", borderRadius: 6, border: "1px solid #B45309", display: "inline-flex", alignItems: "center", gap: 4 }}>
                                  <ClipboardList size={11} /> <strong>Instruksi Khusus</strong>
                                </span>
                              )}
                            </div>
                          );
                        }
                        if (poStage.isFinishing) {
                          return (
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14, fontSize: 11 }}>
                              <span style={{ background: "#064E3B", color: "#A7F3D0", padding: "3px 8px", borderRadius: 6, border: "1px solid #059669", display: "inline-flex", alignItems: "center", gap: 4 }}>
                                <CheckCircle2 size={11} color="#34D399" /> <strong>Pos:</strong> Finishing & Packing
                              </span>
                              {po.nama_kain && po.nama_kain !== "-" && (
                                <span style={{ background: "#0F172A", color: "#38BDF8", padding: "3px 8px", borderRadius: 6, border: "1px solid #0284C7", display: "inline-flex", alignItems: "center", gap: 4 }}>
                                  <Layers size={11} color="#38BDF8" /> <strong>Kain:</strong> {po.nama_kain}
                                </span>
                              )}
                              {po.asal_vendor && (
                                <span style={{ background: "#0F172A", color: "#CBD5E1", padding: "3px 8px", borderRadius: 6, border: "1px solid #334155", display: "inline-flex", alignItems: "center", gap: 4 }}>
                                  <Truck size={11} color="#94A3B8" /> <strong>Dari:</strong> {po.asal_vendor}
                                </span>
                              )}
                              {po.catatan && po.catatan !== "ACC Request" && (
                                <span style={{ background: "#451A03", color: "#FCD34D", padding: "3px 8px", borderRadius: 6, border: "1px solid #B45309", display: "inline-flex", alignItems: "center", gap: 4 }}>
                                  <ClipboardList size={11} /> <strong>Instruksi Khusus</strong>
                                </span>
                              )}
                            </div>
                          );
                        }
                        if (poStage.isSablonBordir) {
                          return (
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14, fontSize: 11 }}>
                              <span style={{ background: "#831843", color: "#FCE7F3", padding: "3px 8px", borderRadius: 6, border: "1px solid #DB2777", display: "inline-flex", alignItems: "center", gap: 4 }}>
                                <Zap size={11} color="#F472B6" /> <strong>Pos:</strong> Sablon / Bordir
                              </span>
                              {po.nama_kain && po.nama_kain !== "-" && (
                                <span style={{ background: "#0F172A", color: "#38BDF8", padding: "3px 8px", borderRadius: 6, border: "1px solid #0284C7", display: "inline-flex", alignItems: "center", gap: 4 }}>
                                  <Layers size={11} color="#38BDF8" /> <strong>Kain:</strong> {po.nama_kain}
                                </span>
                              )}
                              {po.asal_vendor && (
                                <span style={{ background: "#0F172A", color: "#CBD5E1", padding: "3px 8px", borderRadius: 6, border: "1px solid #334155", display: "inline-flex", alignItems: "center", gap: 4 }}>
                                  <Truck size={11} color="#94A3B8" /> <strong>Dari:</strong> {po.asal_vendor}
                                </span>
                              )}
                              {po.catatan && po.catatan !== "ACC Request" && (
                                <span style={{ background: "#451A03", color: "#FCD34D", padding: "3px 8px", borderRadius: 6, border: "1px solid #B45309", display: "inline-flex", alignItems: "center", gap: 4 }}>
                                  <ClipboardList size={11} /> <strong>Instruksi Khusus</strong>
                                </span>
                              )}
                            </div>
                          );
                        }
                        return (
                          /* ── SPESIFIKASI JAHITAN & AKSESORIS PREVIEW PILLS (CMT) ── */
                          (po.jenis_jahitan || po.tipe_benang || po.tipe_resleting || (po.item_pendukung_used && po.item_pendukung_used.length > 0)) ? (
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14, fontSize: 11 }}>
                              {po.jenis_jahitan && (
                                <span style={{ background: "#0F172A", color: "#CBD5E1", padding: "3px 8px", borderRadius: 6, border: "1px solid #334155", display: "inline-flex", alignItems: "center", gap: 4 }}>
                                  <Scissors size={11} color="#818CF8" /> <strong>Jahit:</strong> {po.jenis_jahitan}
                                </span>
                              )}
                              {po.tipe_benang && (
                                <span style={{ background: "#0F172A", color: "#FCD34D", padding: "3px 8px", borderRadius: 6, border: "1px solid #334155" }}>
                                  <strong>Benang:</strong> {po.tipe_benang}
                                </span>
                              )}
                              {po.tipe_resleting && (
                                <span style={{ background: "#0F172A", color: "#38BDF8", padding: "3px 8px", borderRadius: 6, border: "1px solid #334155" }}>
                                  <strong>Resleting:</strong> {po.tipe_resleting}
                                </span>
                              )}
                              {po.item_pendukung_used && po.item_pendukung_used.length > 0 && (
                                <span style={{ background: "#0F172A", color: "#A7F3D0", padding: "3px 8px", borderRadius: 6, border: "1px solid #334155" }}>
                                  <strong>Aksesoris:</strong> {po.item_pendukung_used.map((it: any) => it.nama_barang || it.nama).filter(Boolean).join(", ")}
                                </span>
                              )}
                            </div>
                          ) : null
                        );
                      })()}

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
                          {hasReported ? null : !isDikerjakan ? (
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

                          {isWaitingAcc ? (
                            <div
                              style={{
                                background: "#2E1065",
                                color: "#D8B4FE",
                                border: "1px solid #7C3AED",
                                padding: "9px 16px",
                                borderRadius: 8,
                                fontWeight: 800,
                                fontSize: 12,
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                minHeight: 40
                              }}
                            >
                              <Clock size={14} /> Menunggu ACC Admin
                            </div>
                          ) : (
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
                                <TrendingUp size={14} /> {hasReported ? "Lapor Progres Berikutnya" : "Lapor Progres Selesai"}
                              </>
                            )}
                          </button>
                          )}
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
                {data.kinerja && historiPOs.length > 0 && (
                  <>
                    {" · "}<strong style={{ color: "#34D399" }}>{data.kinerja.tepatWaktu} tepat waktu</strong>
                    {" · "}<strong style={{ color: "#FDBA74" }}>{data.kinerja.terlambat} terlambat</strong>
                    {" · "}Ketepatan <strong style={{ color: "white" }}>{data.kinerja.pctTepatWaktu}%</strong>
                  </>
                )}
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
                          {["NO PO", "MODEL", "TOTAL PCS", "TANGGAL SELESAI", "KETEPATAN", "STATUS", "AKSI"].map((h) => (
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
                                ? new Date(po.tanggalSelesai).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
                                : "Selesai"}
                            </td>
                            <td style={{ padding: "10px 14px" }}>
                              {po.terlambatHari > 0 ? (
                                <span style={{ background: "#431407", color: "#FDBA74", border: "1px solid #9A3412", padding: "2px 7px", borderRadius: 5, fontSize: 10, fontWeight: 800, whiteSpace: "nowrap" }}>
                                  Terlambat {po.terlambatHari} hari
                                </span>
                              ) : (
                                <span style={{ background: "#064E3B", color: "#34D399", padding: "2px 7px", borderRadius: 5, fontSize: 10, fontWeight: 800, whiteSpace: "nowrap" }}>
                                  Tepat waktu
                                </span>
                              )}
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
            TAB 3: SLIP & RIWAYAT GAJI (REALTIME)
           ══════════════════════════════════════════════════════════════ */}
        {activeTab === "gaji" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* 1. Ringkasan Realtime (4 KPI Cards) */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 12
              }}
            >
              {/* Card 1: Total Hak Upah Dihasilkan */}
              <div
                style={{
                  background: "linear-gradient(135deg, #1E293B 0%, #0F172A 100%)",
                  borderRadius: 14,
                  padding: "16px 18px",
                  border: "1px solid #334155",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8" }}>TOTAL HAK UPAH</span>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: "#064E3B",
                      color: "#34D399",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <TrendingUp size={15} />
                  </div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: "white", letterSpacing: "-0.02em" }}>
                  {formatRupiah(ringkasanGaji?.totalHakGaji ?? totalTertunggak)}
                </div>
                <div style={{ fontSize: 10, color: "#34D399", fontWeight: 700, marginTop: 4 }}>
                  {(ringkasanGaji?.totalPcsSelesai ?? totalSelesaiPcs).toLocaleString("id-ID")} pcs selesai diverifikasi
                </div>
              </div>

              {/* Card 2: Sudah Dicairkan */}
              <div
                style={{
                  background: "#1E293B",
                  borderRadius: 14,
                  padding: "16px 18px",
                  border: "1px solid #334155",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8" }}>SUDAH DICAIRKAN</span>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: "#1E3A8A",
                      color: "#60A5FA",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <CheckCircle2 size={15} />
                  </div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#93C5FD", letterSpacing: "-0.02em" }}>
                  {formatRupiah(ringkasanGaji?.totalSudahDibayar ?? 0)}
                </div>
                <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700, marginTop: 4 }}>
                  Tercatat di pembukuan kasir
                </div>
              </div>

              {/* Card 3: Sisa Upah Siap Cair / Tertunggak */}
              <div
                style={{
                  background: totalTertunggak > 0 ? "linear-gradient(135deg, #1E293B 0%, #451A03 100%)" : "#1E293B",
                  borderRadius: 14,
                  padding: "16px 18px",
                  border: totalTertunggak > 0 ? "1px solid #F59E0B" : "1px solid #334155",
                  boxShadow: totalTertunggak > 0 ? "0 0 15px rgba(245, 158, 11, 0.15)" : "0 2px 8px rgba(0,0,0,0.15)"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: totalTertunggak > 0 ? "#FCD34D" : "#94A3B8" }}>
                    SISA HAK UPAH (BELUM CAIR)
                  </span>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: totalTertunggak > 0 ? "#78350F" : "#064E3B",
                      color: totalTertunggak > 0 ? "#FCD34D" : "#34D399",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <DollarSign size={15} />
                  </div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: totalTertunggak > 0 ? "#FDE68A" : "#34D399", letterSpacing: "-0.02em" }}>
                  {formatRupiah(totalTertunggak)}
                </div>
                <div style={{ fontSize: 10, color: totalTertunggak > 0 ? "#FCD34D" : "#10B981", fontWeight: 700, marginTop: 4 }}>
                  {totalTertunggak > 0 ? "Siap ditagihkan / dicairkan" : "Semua upah terselesaikan"}
                </div>
              </div>

              {/* Card 4: Tarif Pengerjaan */}
              <div
                style={{
                  background: "#1E293B",
                  borderRadius: 14,
                  padding: "16px 18px",
                  border: "1px solid #334155",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8" }}>TARIF PENGERJAAN</span>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: "#581C87",
                      color: "#C084FC",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <Scissors size={15} />
                  </div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: "white", letterSpacing: "-0.02em" }}>
                  Rp {(vendor.hargaPerPcs || 5000).toLocaleString("id-ID")}<span style={{ fontSize: 12, fontWeight: 500, color: "#94A3B8" }}> / pcs</span>
                </div>
                <div style={{ fontSize: 10, color: "#C084FC", fontWeight: 700, marginTop: 4 }}>
                  {vendor.tarifPotongan && Object.keys(vendor.tarifPotongan).length > 0
                    ? `${Object.keys(vendor.tarifPotongan).length} tarif model spesifik`
                    : "Tarif standar per pcs"}
                </div>
              </div>
            </div>

            {/* 2. Akumulasi Upah Realtime per SPK */}
            {rincianGajiPerPo.length > 0 && (
              <div
                style={{
                  background: "#1E293B",
                  borderRadius: 14,
                  padding: "18px 20px",
                  border: "1px solid #334155"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 800, color: "white", margin: 0 }}>
                        Akumulasi Upah Realtime per SPK
                      </h3>
                      <span
                        style={{
                          background: "#064E3B",
                          color: "#34D399",
                          fontSize: 10,
                          fontWeight: 800,
                          padding: "2px 8px",
                          borderRadius: 9999,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4
                        }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34D399" }} />
                        Realtime Otomatis
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>
                      Upah dihitung langsung dari jumlah pcs yang telah disetujui / diverifikasi admin konveksi
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {rincianGajiPerPo.map((po: any) => {
                    const isLunas = po.statusBayar === "Lunas";
                    const isSiapCair = po.statusBayar === "Siap Cair";
                    const isBerjalan = po.statusBayar === "Akumulasi Berjalan" || po.statusBayar === "Sebagian Dibayar";
                    const pctSelesai = po.targetPcs > 0 ? Math.min(100, Math.round((po.pcsSelesai / po.targetPcs) * 100)) : 0;

                    return (
                      <div
                        key={po.poId || po.jobId}
                        style={{
                          background: "#0F172A",
                          borderRadius: 12,
                          padding: "14px 16px",
                          border: "1px solid #334155",
                          display: "flex",
                          flexDirection: "column",
                          gap: 10
                        }}
                      >
                        {/* Header PO */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontWeight: 800, color: "white", fontSize: 14 }}>
                              SPK {po.noPo}
                            </span>
                            <span style={{ color: "#94A3B8", fontSize: 12 }}>· {po.model}</span>
                            <span
                              style={{
                                background: isLunas ? "#064E3B" : isSiapCair ? "#451A03" : isBerjalan ? "#1E3A8A" : "#334155",
                                color: isLunas ? "#34D399" : isSiapCair ? "#FCD34D" : isBerjalan ? "#93C5FD" : "#94A3B8",
                                padding: "2px 8px",
                                borderRadius: 6,
                                fontSize: 10,
                                fontWeight: 800
                              }}
                            >
                              {po.statusBayar}
                            </span>
                          </div>

                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 15, fontWeight: 900, color: po.subtotalHak > 0 ? (isLunas ? "#34D399" : "#FDE68A") : "#94A3B8" }}>
                              {formatRupiah(po.subtotalHak)}
                            </div>
                            {po.sisaHak > 0 && po.dibayar > 0 && (
                              <div style={{ fontSize: 10, color: "#FCD34D", fontWeight: 700 }}>
                                Sisa belum cair: {formatRupiah(po.sisaHak)}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Progress Pcs & Tarif */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, fontSize: 11, color: "#94A3B8" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span>Pcs Selesai ACC:</span>
                            <strong style={{ color: "white" }}>
                              {po.pcsSelesai.toLocaleString("id-ID")} / {po.targetPcs.toLocaleString("id-ID")} pcs ({pctSelesai}%)
                            </strong>
                            {po.pcsPending > 0 && (
                              <span style={{ color: "#FCD34D", fontSize: 10 }}>
                                (+{po.pcsPending} pcs menunggu ACC)
                              </span>
                            )}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span>Tarif:</span>
                            <strong style={{ color: "#38BDF8" }}>
                              Rp {po.tarifPerPcs.toLocaleString("id-ID")} / pcs
                            </strong>
                          </div>
                        </div>

                        {/* Action buttons if pcs selesai > 0 */}
                        {po.pcsSelesai > 0 && (
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 6, borderTop: "1px solid #1E293B" }}>
                            <button
                              type="button"
                              className="mobile-touch-btn"
                              onClick={() => {
                                setPrintDocModal({
                                  type: "gaji",
                                  item: {
                                    id: `rt-po-${po.poId}`,
                                    poId: po.poId,
                                    noPo: po.noPo,
                                    model: po.model,
                                    keterangan: `Upah SPK ${po.noPo} (${po.model})`,
                                    jumlahPcs: po.pcsSelesai,
                                    targetPcs: po.targetPcs,
                                    tarifPerPcs: po.tarifPerPcs,
                                    totalGaji: po.subtotalHak,
                                    dibayar: po.dibayar,
                                    sisaTagihan: po.sisaHak,
                                    status: po.statusBayar,
                                    metode: "Transfer Bank",
                                    tanggal: po.tanggalSelesai || new Date().toISOString()
                                  }
                                });
                              }}
                              style={{
                                background: "#1E293B",
                                border: "1px solid #334155",
                                color: "white",
                                padding: "5px 12px",
                                borderRadius: 6,
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 6
                              }}
                            >
                              <Printer size={12} /> Cetak Slip SPK Ini
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. Riwayat Slip Pembayaran & Bukti Pencairan */}
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 10,
                  marginBottom: 12
                }}
              >
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 800, color: "white", margin: 0 }}>
                    Riwayat Slip & Bukti Pembayaran
                  </h3>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>
                    Daftar slip pembayaran resmi dan slip upah pengerjaan
                  </div>
                </div>

                <div style={{ display: "flex", gap: 5 }}>
                  {["Semua", "Siap Cair / Belum Lunas", "Lunas"].map((f) => (
                    <button
                      key={f}
                      type="button"
                      className="mobile-touch-btn"
                      onClick={() => setGajiFilter(f === "Siap Cair / Belum Lunas" ? "Belum Lunas" : f)}
                      style={{
                        padding: "5px 10px",
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                        background:
                          (f === "Siap Cair / Belum Lunas" && gajiFilter === "Belum Lunas") || gajiFilter === f
                            ? "#3B82F6"
                            : "#1E293B",
                        color:
                          (f === "Siap Cair / Belum Lunas" && gajiFilter === "Belum Lunas") || gajiFilter === f
                            ? "white"
                            : "#94A3B8",
                        border: "1px solid #334155"
                      }}
                    >
                      {f}
                    </button>
                  ))}
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
                      Belum ada slip pembayaran untuk filter ini.
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
                                  padding: "2px 7px",
                                  borderRadius: 5,
                                  fontSize: 10,
                                  fontWeight: 800
                                }}
                              >
                                {g.status || "Lunas"}
                              </span>
                              {g.isRealtime && (
                                <span
                                  style={{
                                    background: "#1E3A8A",
                                    color: "#93C5FD",
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                    fontSize: 9,
                                    fontWeight: 700
                                  }}
                                >
                                  Akumulasi Live
                                </span>
                              )}
                            </div>

                            <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 3, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                              <span>
                                {g.tanggal
                                  ? new Date(g.tanggal).toLocaleDateString("id-ID", {
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric"
                                    })
                                  : "-"}
                              </span>
                              <span>·</span>
                              <span>{g.metode || "Transfer"}</span>
                              {g.jumlahPcs && <span>· {g.jumlahPcs.toLocaleString("id-ID")} pcs</span>}
                              {g.tarifPerPcs && <span>· @Rp {g.tarifPerPcs.toLocaleString("id-ID")}</span>}
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
                                padding: "6px 12px",
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

        {/* ══════════════════════════════════════════════════════════════
            TAB: TAGIHAN REJECT
           ══════════════════════════════════════════════════════════════ */}
        {activeTab === "reject" && (
          <div>
            {/* Header info */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 10,
                marginBottom: 16
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <AlertOctagon size={20} color="#EF4444" />
                  <h2 style={{ fontSize: 17, fontWeight: 900, color: "white", margin: 0 }}>
                    Klaim Ganti Rugi & Tagihan Reject
                  </h2>
                </div>
                <p style={{ fontSize: 11.5, color: "#94A3B8", margin: "4px 0 0" }}>
                  Catatan kerusakan / barang reject hasil verifikasi QC Gudang yang dibebankan kepada vendor beserta riwayat pelunasannya.
                </p>
              </div>

              {/* Filter Buttons */}
              <div style={{ display: "flex", gap: 5 }}>
                {["Semua", "Belum Lunas", "Lunas"].map((f) => (
                  <button
                    key={f}
                    type="button"
                    className="mobile-touch-btn"
                    onClick={() => setRejectFilter(f)}
                    style={{
                      padding: "5px 12px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      background: rejectFilter === f ? "#EF4444" : "#1E293B",
                      color: rejectFilter === f ? "white" : "#94A3B8",
                      border: "1px solid #334155"
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* 4 KPI Summary Cards for Reject */}
            {(() => {
              const allNotes = data?.nota_reject || [];
              const totalPcs = allNotes.reduce((s: number, n: any) => s + Number(n.jumlah_reject || 0), 0);
              const totalKlaim = allNotes.reduce((s: number, n: any) => s + Number(n.total_klaim || 0), 0);
              const lunasNotes = allNotes.filter((n: any) => n.status_klaim === "Lunas" || n.status_klaim === "Selesai");
              const totalLunas = lunasNotes.reduce((s: number, n: any) => s + Number(n.nominal_dibayar || n.total_klaim || 0), 0);
              const sisaTertunggak = Math.max(0, totalKlaim - totalLunas);

              return (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 10,
                    marginBottom: 18
                  }}
                >
                  <div style={{ background: "#1E293B", padding: "12px 14px", borderRadius: 10, border: "1px solid #334155" }}>
                    <div style={{ fontSize: 10.5, color: "#94A3B8", fontWeight: 700 }}>TOTAL REJECT (PCS)</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#F87171", marginTop: 4 }}>
                      {totalPcs.toLocaleString("id-ID")} <span style={{ fontSize: 11, color: "#94A3B8" }}>pcs</span>
                    </div>
                    <div style={{ fontSize: 10, color: "#64748B", marginTop: 2 }}>{allNotes.length} nota diterbitkan</div>
                  </div>

                  <div style={{ background: "#1E293B", padding: "12px 14px", borderRadius: 10, border: "1px solid #334155" }}>
                    <div style={{ fontSize: 10.5, color: "#94A3B8", fontWeight: 700 }}>TOTAL KLAIM GANTI RUGI</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "white", marginTop: 4 }}>
                      {formatRupiah(totalKlaim)}
                    </div>
                    <div style={{ fontSize: 10, color: "#64748B", marginTop: 2 }}>Nilai kerugian barang</div>
                  </div>

                  <div style={{ background: "#1E293B", padding: "12px 14px", borderRadius: 10, border: "1px solid #065F46" }}>
                    <div style={{ fontSize: 10.5, color: "#34D399", fontWeight: 700 }}>SUDAH LUNAS / DIPOTONG</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#10B981", marginTop: 4 }}>
                      {formatRupiah(totalLunas)}
                    </div>
                    <div style={{ fontSize: 10, color: "#059669", marginTop: 2 }}>{lunasNotes.length} nota selesai / ada bukti</div>
                  </div>

                  <div style={{ background: sisaTertunggak > 0 ? "#450A0A" : "#1E293B", padding: "12px 14px", borderRadius: 10, border: `1px solid ${sisaTertunggak > 0 ? "#DC2626" : "#334155"}` }}>
                    <div style={{ fontSize: 10.5, color: sisaTertunggak > 0 ? "#FCA5A5" : "#94A3B8", fontWeight: 700 }}>SISA BELUM DIBAYAR</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: sisaTertunggak > 0 ? "#EF4444" : "#10B981", marginTop: 4 }}>
                      {formatRupiah(sisaTertunggak)}
                    </div>
                    <div style={{ fontSize: 10, color: sisaTertunggak > 0 ? "#FECACA" : "#64748B", marginTop: 2 }}>
                      {sisaTertunggak > 0 ? "Perlu diselesaikan / potong gaji" : "Tidak ada tanggungan"}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* List of Reject Claims */}
            {(() => {
              const allNotes = data?.nota_reject || [];
              const filtered = allNotes.filter((n: any) => {
                const isLunas = n.status_klaim === "Lunas" || n.status_klaim === "Selesai";
                if (rejectFilter === "Lunas") return isLunas;
                if (rejectFilter === "Belum Lunas") return !isLunas;
                return true;
              });

              if (filtered.length === 0) {
                return (
                  <div
                    style={{
                      background: "#1E293B",
                      borderRadius: 14,
                      padding: "40px 20px",
                      textAlign: "center",
                      border: "1px solid #334155"
                    }}
                  >
                    <CheckCircle2 size={36} color="#10B981" style={{ margin: "0 auto 10px" }} />
                    <div style={{ fontSize: 14, fontWeight: 800, color: "white" }}>
                      Tidak Ada Data Tagihan Reject
                    </div>
                    <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>
                      {rejectFilter !== "Semua"
                        ? `Tidak ada nota reject dengan status ${rejectFilter}.`
                        : "Seluruh pengerjaan vendor bersih dan tidak ada beban klaim ganti rugi barang reject."}
                    </div>
                  </div>
                );
              }

              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {filtered.map((nota: any) => {
                    const isLunas = nota.status_klaim === "Lunas" || nota.status_klaim === "Selesai";
                    const formattedDate = nota.tanggal_klaim
                      ? new Date(nota.tanggal_klaim).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric"
                        })
                      : "-";
                    const settledDate = nota.tanggal_selesai
                      ? new Date(nota.tanggal_selesai).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit"
                        })
                      : "-";

                    return (
                      <div
                        key={nota.id || nota.no_nota}
                        style={{
                          background: "#1E293B",
                          borderRadius: 14,
                          padding: "16px 18px",
                          border: `1px solid ${isLunas ? "#059669" : "#DC2626"}`,
                          boxShadow: "0 4px 12px rgba(0,0,0,0.2)"
                        }}
                      >
                        {/* Header Row */}
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            flexWrap: "wrap",
                            gap: 8,
                            paddingBottom: 12,
                            borderBottom: "1px solid #334155"
                          }}
                        >
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 13, fontWeight: 900, color: "white", fontFamily: "monospace" }}>
                                {nota.no_nota}
                              </span>
                              <span
                                style={{
                                  background: isLunas ? "#064E3B" : "#450A0A",
                                  color: isLunas ? "#34D399" : "#FCA5A5",
                                  border: `1px solid ${isLunas ? "#059669" : "#DC2626"}`,
                                  padding: "2px 8px",
                                  borderRadius: 6,
                                  fontSize: 10,
                                  fontWeight: 800
                                }}
                              >
                                {isLunas ? "✓ LUNAS / SELESAI" : "BELUM DIBAYAR"}
                              </span>
                            </div>
                            <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 3 }}>
                              Tanggal Klaim: {formattedDate} • SPK: <strong style={{ color: "#38BDF8" }}>{nota.noPo || nota.no_spk || "-"}</strong> ({nota.model || "-"})
                            </div>
                          </div>

                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700 }}>NILAI KLAIM</div>
                            <div style={{ fontSize: 16, fontWeight: 900, color: isLunas ? "#10B981" : "#EF4444" }}>
                              {formatRupiah(nota.total_klaim || 0)}
                            </div>
                          </div>
                        </div>

                        {/* Rincian Reject & Alasan */}
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                            gap: 12,
                            padding: "12px 0",
                            borderBottom: "1px solid #334155",
                            fontSize: 11.5
                          }}
                        >
                          <div>
                            <div style={{ color: "#94A3B8", fontSize: 10, fontWeight: 700 }}>POSISI KERUSAKAN</div>
                            <div style={{ color: "white", fontWeight: 700, marginTop: 2 }}>
                              {nota.pos_asal || "WASHING"} &rarr; {nota.pos_tujuan || "GUDANG"}
                            </div>
                            <div style={{ color: "#94A3B8", fontSize: 10, marginTop: 4 }}>
                              Alasan: <strong style={{ color: "#FCD34D" }}>{nota.alasan_reject || "Barang kotor / cacat"}</strong>
                            </div>
                          </div>

                          <div>
                            <div style={{ color: "#94A3B8", fontSize: 10, fontWeight: 700 }}>RINCIAN QTY REJECT</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                              <span style={{ color: "#EF4444", fontWeight: 900, fontSize: 13 }}>
                                {nota.jumlah_reject} pcs
                              </span>
                              <span style={{ color: "#64748B", fontSize: 11 }}>
                                (@ {formatRupiah(nota.biaya_per_pcs || 0)}/pcs)
                              </span>
                              {Array.isArray(nota.rincian_reject) && nota.rincian_reject.map((r: any, idx: number) => (
                                <span
                                  key={idx}
                                  style={{
                                    background: "#0F172A",
                                    border: "1px solid #334155",
                                    color: "#FCA5A5",
                                    padding: "1px 6px",
                                    borderRadius: 4,
                                    fontSize: 10,
                                    fontWeight: 700
                                  }}
                                >
                                  {r.size}: {r.reject || r.jumlah || 0} pcs
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* RECORD PEMBAYARAN / PELUNASAN TERPERINCI (Bila Lunas) */}
                        {isLunas && (
                          <div
                            style={{
                              background: "rgba(16, 185, 129, 0.08)",
                              border: "1px dashed #059669",
                              borderRadius: 8,
                              padding: "10px 14px",
                              marginTop: 12,
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              flexWrap: "wrap",
                              gap: 10
                            }}
                          >
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <CheckCircle2 size={13} color="#10B981" />
                                <span style={{ fontSize: 11, fontWeight: 900, color: "#34D399" }}>
                                  RECORD PEMBAYARAN TERSIMPAN • INV-LUNAS-{nota.no_nota}
                                </span>
                              </div>
                              <div style={{ fontSize: 10.5, color: "#A7F3D0", marginTop: 3 }}>
                                Metode: <strong>{nota.metode_pembayaran || "Ganti Rugi Tunai"}</strong> • Waktu: {settledDate}
                              </div>
                              {nota.catatan_penyelesaian && (
                                <div style={{ fontSize: 10, color: "#6EE7B7", marginTop: 2, fontStyle: "italic" }}>
                                  Catatan: &ldquo;{nota.catatan_penyelesaian}&rdquo;
                                </div>
                              )}
                            </div>

                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: 9.5, color: "#A7F3D0", fontWeight: 700 }}>NOMINAL DILUNASI</div>
                              <div style={{ fontSize: 13, fontWeight: 900, color: "#10B981" }}>
                                {formatRupiah(nota.nominal_dibayar || nota.total_klaim || 0)}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "flex-end",
                            alignItems: "center",
                            gap: 8,
                            marginTop: 12,
                            flexWrap: "wrap"
                          }}
                        >
                          <button
                            type="button"
                            className="mobile-touch-btn"
                            onClick={() => {
                              const phone = (data?.vendor?.kontak || data?.vendor?.no_telepon || "").replace(/\D/g, "");
                              const targetPhone = phone.startsWith("0") ? "62" + phone.slice(1) : phone;
                              const msg = `*KONFIRMASI ${isLunas ? "INVOICE LUNAS" : "KLAIM"} REJECT VENDOR*\n\n` +
                                `No. Nota: *${nota.no_nota}*\n` +
                                `Status: *${isLunas ? "LUNAS / SELESAI" : "BELUM DIBAYAR"}*\n` +
                                `SPK: ${nota.noPo || "-"}\n` +
                                `Model: ${nota.model || "-"}\n` +
                                `Total Reject: ${nota.jumlah_reject} pcs\n` +
                                `Total Klaim: Rp ${Number(nota.total_klaim || 0).toLocaleString("id-ID")}\n` +
                                (isLunas ? `Metode Bayar: ${nota.metode_pembayaran || "-"}\nNominal: Rp ${Number(nota.nominal_dibayar || nota.total_klaim || 0).toLocaleString("id-ID")}\nCatatan: ${nota.catatan_penyelesaian || "-"}\n` : "") +
                                `\n_Tirta Bintang Jeans - QC & Gudang_`;
                              window.open(`https://wa.me/${targetPhone}?text=${encodeURIComponent(msg)}`, "_blank");
                            }}
                            style={{
                              background: "#065F46",
                              color: "#34D399",
                              border: "1px solid #059669",
                              padding: "6px 12px",
                              borderRadius: 8,
                              fontSize: 11,
                              fontWeight: 800,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5
                            }}
                          >
                            <MessageCircle size={12} /> WhatsApp
                          </button>

                          <button
                            type="button"
                            className="mobile-touch-btn"
                            onClick={() => setSelectedNota(nota)}
                            style={{
                              background: isLunas ? "#10B981" : "#EF4444",
                              color: "white",
                              border: "none",
                              padding: "6px 14px",
                              borderRadius: 8,
                              fontSize: 11,
                              fontWeight: 800,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5
                            }}
                          >
                            <Printer size={12} />
                            {isLunas ? "Cetak Invoice Lunas" : "Lihat / Cetak Nota Klaim"}
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

              {/* Live Admin presence warning */}
              {(() => {
                const sel = (data?.pemotonganReady || []).find((p: any) => String(p.id) === requestForm.pemotongan_id);
                const adminActive = presenceList.find(p => p.role === "admin" && (
                  (sel?.po_id != null && Number(p.po_id) === Number(sel.po_id)) ||
                  (sel?.is_transfer && p.transfer_id != null && Number(p.transfer_id) === Number(sel.id))
                ));
                if (!adminActive) return null;
                return (
                  <div style={{
                    padding: "9px 12px",
                    borderRadius: 10,
                    background: "#FEF3C7",
                    border: "1.5px solid #F59E0B",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 11.5,
                    color: "#92400E"
                  }}>
                    <Zap size={14} color="#D97706" style={{ flexShrink: 0 }} />
                    <span style={{ fontWeight: 700 }}>
                      ⚡ Admin sedang aktif membagikan stok PO ini di Alur Produksi. Permohonan Anda akan langsung terpantau di layar Admin secara realtime!
                    </span>
                  </div>
                );
              })()}

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
                                <div style={{ fontWeight: 800, color: "white", fontSize: 13 }}>
                                  {p.nama_barang}
                                  {p.dari_vendor ? <span style={{ fontSize: 11, color: "#38BDF8", fontWeight: 700, marginLeft: 6 }}>({p.dari_tahap ? `${p.dari_tahap} ` : ''}{p.dari_vendor})</span> : null}
                                </div>
                                <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 1 }}>
                                  Model: <strong style={{ color: "white" }}>{p.model}</strong> · {new Date(p.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                                </div>
                                {p.pending_requests && p.pending_requests.length > 0 && (
                                  <div style={{ marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap" }}>
                                    {p.pending_requests.map((pr: any, idx: number) => (
                                      <span key={idx} style={{ fontSize: 9.5, padding: "1px 6px", borderRadius: 4, background: pr.is_mine ? "#1E3A8A" : "#334155", color: pr.is_mine ? "#93C5FD" : "#CBD5E1" }}>
                                        {pr.is_mine ? `Permohonan Anda: ${pr.total_request} pcs` : `${pr.vendor_nama}: ${pr.total_request} pcs`}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: 16, fontWeight: 900, color: isSelected ? "#38BDF8" : "#10B981" }}>
                                  {p.sisa_total.toLocaleString("id-ID")}
                                </div>
                                <div style={{ fontSize: 9, color: "#64748B", fontWeight: 700 }}>bebas pcs</div>
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
              maxWidth: 580,
              maxHeight: "90vh",
              overflowY: "auto",
              border: "1px solid #334155",
              boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
              display: "flex",
              flexDirection: "column"
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "14px 18px",
                borderBottom: "1px solid #334155",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#0F172A",
                position: "sticky",
                top: 0,
                zIndex: 10
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <h3 style={{ margin: 0, color: "white", fontSize: 16, fontWeight: 900 }}>Rincian Dokumen SPK</h3>
                  <span style={{ fontSize: 11, background: "#0284C7", color: "white", padding: "2px 8px", borderRadius: 4, fontWeight: 800, fontFamily: "monospace" }}>
                    {detailPoModal.no_po || detailPoModal.noPo}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>
                  Petunjuk teknis perakitan jahitan, bahan baku & aksesoris CMT
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

            {/* Modal Body */}
            <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
              
              {/* 1. INFORMASI UTAMA & BAHAN (4-grid) */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div style={{ background: "#0F172A", padding: "8px 10px", borderRadius: 8, border: "1px solid #1E293B" }}>
                  <div style={{ fontSize: 10, color: "#64748B", fontWeight: 700 }}>MODEL PAKAIAN</div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "white", marginTop: 2 }}>{detailPoModal.model}</div>
                </div>
                <div style={{ background: "#0F172A", padding: "8px 10px", borderRadius: 8, border: "1px solid #1E293B" }}>
                  <div style={{ fontSize: 10, color: "#64748B", fontWeight: 700 }}>KAIN / BAHAN BAKU</div>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: "#38BDF8", marginTop: 2 }}>
                    {detailPoModal.nama_kain || detailPoModal.nama_barang || "-"}
                  </div>
                </div>
                <div style={{ background: "#0F172A", padding: "8px 10px", borderRadius: 8, border: "1px solid #1E293B" }}>
                  <div style={{ fontSize: 10, color: "#64748B", fontWeight: 700 }}>TOTAL TARGET PO</div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#10B981", marginTop: 2 }}>
                    {(detailPoModal.jumlah_terbit || detailPoModal.jumlahTerbit || 0).toLocaleString("id-ID")} pcs
                  </div>
                </div>
                <div style={{ background: "#0F172A", padding: "8px 10px", borderRadius: 8, border: "1px solid #1E293B" }}>
                  <div style={{ fontSize: 10, color: "#64748B", fontWeight: 700 }}>TARGET SELESAI</div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color: detailPoModal.isOverdue ? "#EF4444" : "white",
                      marginTop: 2
                    }}
                  >
                    {detailPoModal.targetSelesai
                      ? new Date(detailPoModal.targetSelesai).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
                      : "Antrean"}
                    {detailPoModal.isOverdue && (
                      <span style={{ fontSize: 10, background: "#7F1D1D", color: "#FCA5A5", padding: "1px 5px", borderRadius: 4, marginLeft: 6 }}>
                        +{detailPoModal.overdueDays} hr
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. SPESIFIKASI & INSTRUKSI PENUGASAN (POS LANJUTAN VS CMT) */}
              {!getJobStage(detailPoModal).isCmt ? (
                (() => {
                  const modalStage = getJobStage(detailPoModal);
                  const stageInfo = modalStage.isWashing ? {
                  title: "Instruksi & Penugasan Pos Washing",
                  badge: "Tahap Laundry / Washing",
                  color: "#60A5FA",
                  border: "#1D4ED8",
                  bgBadge: "#1E3A8A",
                  textBadge: "#BFDBFE",
                  Icon: Droplets,
                  standards: [
                    `Lakukan proses washing/cuci sesuai karakter kain ${detailPoModal.nama_kain || "denim"}.`,
                    "Periksa kondisi fisik celana sebelum & sesudah pengerjaan agar bebas dari cacat luntur/sobek.",
                    "Laporkan hasil pengerjaan secara bertahap via tombol 'Lapor Progres Selesai'."
                  ]
                } : modalStage.isBersihBenang ? {
                  title: "Instruksi & Penugasan Pos Bersih Benang",
                  badge: "Tahap Bersih Benang / Trimming",
                  color: "#C084FC",
                  border: "#7E22CE",
                  bgBadge: "#581C87",
                  textBadge: "#F3E8FF",
                  Icon: Scissors,
                  standards: [
                    "Potong dan bersihkan seluruh sisa serat benang jahit/obras pada bagian luar & dalam celana.",
                    "Pasang kancing, rivet, atau label kelengkapan yang ditentukan jika ada.",
                    "Periksa celana dari jahitan yang terlepas atau bolong sebelum diserahkan ke pos berikutnya."
                  ]
                } : modalStage.isFinishing ? {
                  title: "Instruksi & Penugasan Pos Finishing & QC",
                  badge: "Tahap Finishing / Packing",
                  color: "#34D399",
                  border: "#059669",
                  bgBadge: "#064E3B",
                  textBadge: "#D1FAE5",
                  Icon: CheckCircle2,
                  standards: [
                    "Lakukan Quality Control (QC) akhir: kelancaran resleting, kekuatan kancing, dan ukuran size celana.",
                    "Lakukan proses setrika uap / gosok hingga rapi.",
                    "Pasang hangtag, price tag, dan lipat rapi ke dalam polybag sesuai standar toko."
                  ]
                } : modalStage.isSablonBordir ? {
                  title: "Instruksi & Penugasan Pos Sablon / Bordir",
                  badge: "Tahap Sablon & Bordir",
                  color: "#F472B6",
                  border: "#BE185D",
                  bgBadge: "#831843",
                  textBadge: "#FCE7F3",
                  Icon: Zap,
                  standards: [
                    "Cetak sablon / bordir presisi sesuai dengan posisi cetak pada model pola.",
                    "Pastikan kerapian benang bordir dan ketahanan tinta sablon sebelum dikirim kembali.",
                    "Laporkan hasil pengerjaan yang lolos QC."
                  ]
                } : {
                  title: `Instruksi & Penugasan Pos ${vendor.tipe?.toUpperCase() || "Vendor Lanjutan"}`,
                  badge: `Tahap ${vendor.tipe?.toUpperCase() || "Lanjutan"}`,
                  color: "#60A5FA",
                  border: "#1D4ED8",
                  bgBadge: "#1E3A8A",
                  textBadge: "#BFDBFE",
                  Icon: Package,
                  standards: [
                    `Kerjakan pesanan sesuai spesifikasi produk ${detailPoModal?.model || ""}.`,
                    "Periksa kondisi barang dan laporkan hasil pengerjaan secara berkala via portal."
                  ]
                };

                  const StageIcon = stageInfo.Icon;

                  return (
                    <>
                      <div style={{ background: "#0F172A", borderRadius: 10, padding: "12px 14px", border: `1px solid ${stageInfo.border}` }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, borderBottom: "1px solid #1E293B", paddingBottom: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <StageIcon size={15} color={stageInfo.color} />
                            <span style={{ fontSize: 11, fontWeight: 800, color: stageInfo.color, textTransform: "uppercase", letterSpacing: 0.5 }}>
                              {stageInfo.title}
                            </span>
                          </div>
                          <span style={{ fontSize: 10, background: stageInfo.bgBadge, color: stageInfo.textBadge, padding: "2px 8px", borderRadius: 6, fontWeight: 800 }}>
                            {stageInfo.badge}
                          </span>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 11.5 }}>
                          {/* Catatan Instruksi Khusus */}
                          {detailPoModal.catatan ? (
                            <div style={{ background: "rgba(245, 158, 11, 0.15)", border: "1px solid rgba(245, 158, 11, 0.4)", borderRadius: 8, padding: "10px 12px" }}>
                              <div style={{ fontSize: 11, fontWeight: 800, color: "#FBBF24", marginBottom: 3, display: "flex", alignItems: "center", gap: 5 }}>
                                <ClipboardList size={13} /> Catatan Pengiriman & Instruksi Khusus:
                              </div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: "#FEF3C7", lineHeight: 1.5 }}>
                                "{detailPoModal.catatan}"
                              </div>
                            </div>
                          ) : (
                            <div style={{ background: "#1E293B", padding: "8px 10px", borderRadius: 6, color: "#94A3B8" }}>
                              Tidak ada catatan khusus tambahan untuk pengiriman ini.
                            </div>
                          )}

                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            <div style={{ background: "#1E293B", padding: "8px 10px", borderRadius: 6 }}>
                              <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700 }}>BAHAN / KAIN DENIM</div>
                              <div style={{ fontSize: 12, fontWeight: 800, color: "#38BDF8", marginTop: 2 }}>{detailPoModal.nama_kain || "-"}</div>
                            </div>
                            <div style={{ background: "#1E293B", padding: "8px 10px", borderRadius: 6 }}>
                              <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700 }}>ASAL PENGIRIMAN</div>
                              <div style={{ fontSize: 12, fontWeight: 800, color: "white", marginTop: 2 }}>{detailPoModal.asal_vendor || "CMT Jahit"}</div>
                            </div>
                          </div>

                          <div style={{ background: "#1E293B", borderRadius: 6, padding: "8px 10px" }}>
                            <div style={{ fontSize: 10.5, fontWeight: 800, color: "#A5B4FC", marginBottom: 4 }}>STANDAR PENGERJAAN:</div>
                            <ul style={{ margin: 0, paddingLeft: 16, color: "#CBD5E1", fontSize: 11, lineHeight: 1.5 }}>
                              {stageInfo.standards.map((std: string, idx: number) => (
                                <li key={idx}>{std}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>

                      {/* 3. REFERENSI JAHITAN CMT (COLLAPSIBLE UNTUK POS LANJUTAN) */}
                      <div style={{ background: "#0F172A", borderRadius: 10, border: "1px solid #334155", overflow: "hidden" }}>
                        <div
                          onClick={() => setShowCmtRef(!showCmtRef)}
                          style={{
                            padding: "10px 14px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            cursor: "pointer",
                            background: "#1E293B"
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <Scissors size={13} color="#94A3B8" />
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#CBD5E1" }}>
                              Referensi Hasil Jahitan CMT (Sebelum Masuk Pos Ini)
                            </span>
                            <span style={{ fontSize: 9.5, background: "#0F172A", color: "#94A3B8", padding: "1px 6px", borderRadius: 4 }}>
                              Sudah Dijahit
                            </span>
                          </div>
                          <span style={{ fontSize: 11, color: "#94A3B8", display: "flex", alignItems: "center", gap: 4 }}>
                            {showCmtRef ? "Tutup" : "Lihat"} {showCmtRef ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </span>
                        </div>

                        {showCmtRef && (
                          <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6, fontSize: 11, borderTop: "1px solid #334155" }}>
                            <div style={{ display: "flex", gap: 6 }}>
                              <span style={{ color: "#94A3B8", minWidth: 90 }}>Jenis Jahitan:</span>
                              <span style={{ color: "white" }}>{detailPoModal.jenis_jahitan || "-"}</span>
                            </div>
                            <div style={{ display: "flex", gap: 6 }}>
                              <span style={{ color: "#94A3B8", minWidth: 90 }}>Tipe Benang:</span>
                              <span style={{ color: "#FCD34D" }}>{detailPoModal.tipe_benang || "-"}</span>
                            </div>
                            <div style={{ display: "flex", gap: 6 }}>
                              <span style={{ color: "#94A3B8", minWidth: 90 }}>Tipe Resleting:</span>
                              <span style={{ color: "#38BDF8" }}>{detailPoModal.tipe_resleting || "-"}</span>
                            </div>
                            {detailPoModal.item_pendukung_used && detailPoModal.item_pendukung_used.length > 0 && (
                              <div style={{ marginTop: 4, paddingTop: 6, borderTop: "1px dashed #334155" }}>
                                <span style={{ color: "#94A3B8", display: "block", marginBottom: 4 }}>Aksesoris Terpasang:</span>
                                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                  {detailPoModal.item_pendukung_used.map((it: any, idx: number) => (
                                    <span key={idx} style={{ background: "#1E293B", color: "#34D399", padding: "2px 6px", borderRadius: 4, fontSize: 10 }}>
                                      {it.nama_item || it.nama} ({it.qty} {it.satuan})
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()
              ) : (
                <>
                  {/* SPESIFIKASI TEKNIS JAHITAN (CMT) */}
                  <div style={{ background: "#0F172A", borderRadius: 10, padding: "12px 14px", border: "1px solid #334155" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, borderBottom: "1px solid #1E293B", paddingBottom: 6 }}>
                      <Scissors size={14} color="#818CF8" />
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#A5B4FC", textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Spesifikasi Jahitan (Standar CMT)
                      </span>
                    </div>
                    
                    <div style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 11.5 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                        <span style={{ color: "#94A3B8", minWidth: 100, fontWeight: 700 }}>Jenis Jahitan:</span>
                        <span style={{ color: "white", fontWeight: 700 }}>
                          {detailPoModal.jenis_jahitan || "Rantai (Chainstitch), Obras 5 Benang, Make-up Jeans, Double Stitch, Bartack"}
                        </span>
                      </div>
                      
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                        <span style={{ color: "#94A3B8", minWidth: 100, fontWeight: 700 }}>Tipe Benang:</span>
                        <span style={{ color: "#FCD34D", fontWeight: 700 }}>
                          {detailPoModal.tipe_benang || "Benang Astra Jeans 20/2 (Gold / Kuning Emas)"}
                        </span>
                      </div>

                      <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                        <span style={{ color: "#94A3B8", minWidth: 100, fontWeight: 700 }}>Tipe Resleting:</span>
                        <span style={{ color: "#38BDF8", fontWeight: 700 }}>
                          {detailPoModal.tipe_resleting || "Resleting YKK Metal Brass No. 5 (Gigi Kuningan 5\")"}
                        </span>
                      </div>

                      {(detailPoModal.catatan_jahitan || detailPoModal.catatan) && (
                        <div style={{ marginTop: 4, background: "#1E293B", padding: "6px 10px", borderRadius: 6, border: "1px solid #334155", color: "#E2E8F0" }}>
                          <span style={{ color: "#F59E0B", fontWeight: 800, marginRight: 4 }}>Instruksi Khusus:</span>
                          "{detailPoModal.catatan || detailPoModal.catatan_jahitan}"
                        </div>
                      )}
                    </div>
                  </div>

                  {/* BAHAN PENDUKUNG & AKSESORIS */}
                  <div style={{ background: "#0F172A", borderRadius: 10, padding: "12px 14px", border: "1px solid #334155" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, borderBottom: "1px solid #1E293B", paddingBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Package size={14} color="#10B981" />
                        <span style={{ fontSize: 11, fontWeight: 800, color: "#6EE7B7", textTransform: "uppercase", letterSpacing: 0.5 }}>
                          Bahan Pendukung & Aksesoris Diserahkan
                        </span>
                      </div>
                      {detailPoModal.item_pendukung_used && detailPoModal.item_pendukung_used.length > 0 && (
                        <span style={{ fontSize: 10, background: "#064E3B", color: "#34D399", padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>
                          {detailPoModal.item_pendukung_used.length} item
                        </span>
                      )}
                    </div>

                    {detailPoModal.item_pendukung_used && detailPoModal.item_pendukung_used.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        {detailPoModal.item_pendukung_used.map((item: any, idx: number) => (
                          <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1E293B", padding: "6px 10px", borderRadius: 6, border: "1px solid #334155" }}>
                            <div>
                              <div style={{ fontSize: 11.5, fontWeight: 800, color: "white" }}>
                                {item.nama_item || item.nama}
                              </div>
                              {item.kategori && (
                                <div style={{ fontSize: 9.5, color: "#94A3B8" }}>
                                  Kategori: {item.kategori}
                                </div>
                              )}
                            </div>
                            <div style={{ background: "#0F172A", padding: "3px 8px", borderRadius: 5, border: "1px solid #334155", color: "#34D399", fontWeight: 800, fontSize: 11 }}>
                              {item.qty} {item.satuan}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 11, color: "#64748B", fontStyle: "italic", padding: "4px 0" }}>
                        Tidak ada bahan pendukung khusus tambahan (menggunakan perlengkapan standar).
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* 4. DISTRIBUSI SIZE */}
              <div>
                <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 800, marginBottom: 5, textTransform: "uppercase" }}>
                  Distribusi Size & Rincian Target:
                </div>
                <div style={{ background: "#0F172A", borderRadius: 8, border: "1px solid #334155", overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 11 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #334155", color: "#64748B" }}>
                        <th style={{ padding: "6px 10px" }}>SIZE</th>
                        <th style={{ padding: "6px 10px" }}>TARGET</th>
                        <th style={{ padding: "6px 10px" }}>ACC</th>
                        <th style={{ padding: "6px 10px" }}>SISA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detailPoModal.sizeBreakdown || []).map((s: any) => {
                        const done = detailPoModal.sizeProgress?.[s.size] || 0;
                        const tgt = Number(s.jumlah || s.sisa || 0);
                        return (
                          <tr key={s.size} style={{ borderBottom: "1px solid #1E293B" }}>
                            <td style={{ padding: "6px 10px", fontWeight: 800, color: "white" }}>{s.size}</td>
                            <td style={{ padding: "6px 10px", color: "#94A3B8" }}>{tgt} pcs</td>
                            <td style={{ padding: "6px 10px", color: "#10B981", fontWeight: 700 }}>{done} pcs</td>
                            <td style={{ padding: "6px 10px", color: Math.max(0, tgt - done) > 0 ? "#F59E0B" : "#10B981", fontWeight: 700 }}>
                              {Math.max(0, tgt - done)} pcs
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <a
                  href={`/cetak-po/${detailPoModal.id}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    flex: 1,
                    padding: "9px 12px",
                    background: "#0284C7",
                    color: "white",
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 12,
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6
                  }}
                >
                  <Printer size={13} /> Cetak / Buka Dokumen SPK Resmi ↗
                </a>
                <button
                  type="button"
                  className="mobile-touch-btn"
                  onClick={() => setDetailPoModal(null)}
                  style={{
                    padding: "9px 18px",
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
                const cmtReports = (data.cmt_progres || []).filter((p: any) =>
                  poReportsModal.is_transfer
                    ? String(p.transfer_id) === String(poReportsModal.id)
                    : !p.transfer_id && (
                        String(p.po_id) === String(poReportsModal.id) ||
                        (p.noPo && p.noPo === (poReportsModal.no_po || poReportsModal.noPo))
                      )
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
                      <strong>{printDocModal.item.keterangan || `Gaji SPK #${printDocModal.item.poId || printDocModal.item.id}`}</strong>
                    </div>
                    {printDocModal.item.noPo && (
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Nomor SPK:</span>
                        <strong>{printDocModal.item.noPo}</strong>
                      </div>
                    )}
                    {printDocModal.item.model && (
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Model:</span>
                        <span>{printDocModal.item.model}</span>
                      </div>
                    )}
                    {printDocModal.item.jumlahPcs > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Pcs Diverifikasi (ACC):</span>
                        <strong>{Number(printDocModal.item.jumlahPcs).toLocaleString("id-ID")} pcs</strong>
                      </div>
                    )}
                    {printDocModal.item.tarifPerPcs > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Tarif Satuan:</span>
                        <span>Rp {Number(printDocModal.item.tarifPerPcs).toLocaleString("id-ID")} / pcs</span>
                      </div>
                    )}
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
                    {printDocModal.item.nama_kain && (
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Bahan/Kain:</span>
                        <span>{printDocModal.item.nama_kain}</span>
                      </div>
                    )}
                    {printDocModal.item.catatan && (
                      <div style={{ marginTop: 6, padding: "5px 8px", background: "#FEF3C7", borderRadius: 4, fontSize: 10.5, color: "#92400E" }}>
                        <strong>Catatan Pengiriman:</strong> {printDocModal.item.catatan}
                      </div>
                    )}
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

      {/* ══════════════════════════════════════════════════════════════
          MODAL: NOTA REJECT & INVOICE LUNAS
         ══════════════════════════════════════════════════════════════ */}
      {selectedNota && (
        <NotaRejectModal
          nota={selectedNota}
          readOnly={viewer === "vendor"}
          onClose={() => setSelectedNota(null)}
          vendorKontak={data?.vendor?.kontak || data?.vendor?.no_telepon || data?.vendor?.telepon}
          onSettled={() => {
            fetchData(true);
            setSelectedNota(null);
          }}
          onCancelReject={() => {
            fetchData(true);
            setSelectedNota(null);
          }}
        />
      )}
    </div>
  );
}
