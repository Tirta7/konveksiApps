"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { 
  RefreshCw, 
  ArrowRight, 
  AlertTriangle, 
  Clock, 
  ExternalLink, 
  MessageCircle, 
  CheckCircle2, 
  ShieldAlert, 
  Radio, 
  Filter,
  ChevronDown,
  ChevronUp,
  Search,
  X,
  Layers,
  Calendar,
  User,
  Box,
  CheckCircle,
  Truck
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

function fmtWaktu(d: Date) {
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function fmtDate(str?: string) {
  if (!str) return "-";
  return new Date(str).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function cleanWaNumber(phone?: string) {
  if (!phone) return "";
  let clean = phone.replace(/[^0-9]/g, "");
  if (clean.startsWith("62")) return clean;
  if (clean.startsWith("0")) return "62" + clean.slice(1);
  if (clean.startsWith("8")) return "62" + clean;
  return clean;
}

const STAGE_CFG: Record<string, { label: string; bg: string; color: string }> = {
  "selesai":        { label: "Selesai",        bg: "#D1FAE5", color: "#065F46" },
  "selesai-washing":{ label: "Selesai Washing", bg: "#CFFAFE", color: "#0E7490" },
  "washing":        { label: "Washing",         bg: "#E0F2FE", color: "#0369A1" },
  "siap-tarik":     { label: "Siap Tarik",      bg: "#DCFCE7", color: "#166534" },
  "dijahit":        { label: "Dijahit",         bg: "#FEF3C7", color: "#92400E" },
  "menunggu":       { label: "Menunggu",        bg: "#F1F5F9", color: "#64748B" },
};

const TIPE_CFG: Record<string, { bg: string; color: string }> = {
  cmt:      { bg: "#EFF6FF", color: "#1D4ED8" },
  washing:  { bg: "#ECFEFF", color: "#0E7490" },
  benang:   { bg: "#F5F3FF", color: "#7C3AED" },
  finishing:{ bg: "#ECFDF5", color: "#059669" },
};

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [pulse, setPulse] = useState(false);
  const [poFilter, setPoFilter] = useState<"all" | "overdue" | "ontime">("all");
  const [bannerExpanded, setBannerExpanded] = useState(true);
  const [searchPo, setSearchPo] = useState("");
  const [selectedPo, setSelectedPo] = useState<any | null>(null);
  const prevRef = useRef<string>("");
  const alertedOverdueRef = useRef<number>(-1);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (isManual = false) => {
    try {
      const res = await fetch("/api/dashboard", { cache: "no-store" });
      if (!res.ok) throw new Error(`Server merespons ${res.status}`);
      const d = await res.json();
      const ser = JSON.stringify(d);
      if (ser !== prevRef.current) { 
        setPulse(true); 
        setTimeout(() => setPulse(false), 800); 
        prevRef.current = ser; 

        // Trigger real-time toast alert if overdue PO count changes or first detected
        if (d.totalPoTerlambat > 0 && alertedOverdueRef.current !== d.totalPoTerlambat) {
          alertedOverdueRef.current = d.totalPoTerlambat;
          toast.error(`⚠️ Ada ${d.totalPoTerlambat} PO Produksi Terlambat!`, {
            description: `Pengerjaan CMT melewati target selesai. Periksa banner keterlambatan di dashboard.`,
            duration: 6000,
          });
        }
      }
      setData(d);
      setLastUpdated(new Date());
      setLoadError(null);
      if (isManual) {
        toast.success("Data dashboard berhasil disinkronkan!");
      }
    } catch (e: any) {
      setLoadError(e?.message || "Gagal terhubung ke server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { 
    load(); 
    const id = setInterval(() => load(false), 5000); 
    return () => clearInterval(id); 
  }, [load]);

  // Real-time sync: instant refresh when another admin or CMT makes a change via SSE
  useEffect(() => {
    const handler = () => {
      load(false);
    };
    window.addEventListener("konveksi-sync", handler);
    return () => window.removeEventListener("konveksi-sync", handler);
  }, [load]);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100dvh", background: "#F8FAFC" }}>
      <div style={{ textAlign: "center", color: "#64748B" }}>
        <RefreshCw size={36} style={{ animation: "spin 1s linear infinite", display: "block", margin: "0 auto 14px", color: "#3B82F6" }} />
        <p style={{ fontSize: 16, fontWeight: 700, color: "#1E293B" }}>Memuat Dashboard Produksi...</p>
        <p style={{ fontSize: 13, color: "#94A3B8" }}>Menyinkronkan data real-time konveksi</p>
      </div>
    </div>
  );

  if (!data && loadError) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "80dvh", background: "#F8FAFC", padding: 20 }}>
      <div style={{ textAlign: "center", background: "white", padding: 32, borderRadius: 20, border: "1px solid #E2E8F0", maxWidth: 400, boxShadow: "0 10px 30px rgba(0,0,0,0.05)" }}>
        <AlertTriangle size={36} color="#DC2626" style={{ margin: "0 auto 12px" }} />
        <p style={{ fontSize: 17, fontWeight: 800, color: "#0F172A", marginBottom: 6 }}>Data dashboard gagal dimuat</p>
        <p style={{ fontSize: 13, color: "#64748B", marginBottom: 20 }}>{loadError}</p>
        <button onClick={() => { setLoading(true); load(true); }} style={{ padding: "11px 24px", background: "#3B82F6", color: "white", border: "none", borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          Coba Lagi
        </button>
      </div>
    </div>
  );

  const poList: any[] = data?.poList || [];
  const vendorList: any[] = data?.vendorList || [];
  const overdueList: any[] = data?.overdueList || [];
  const totalPoTerlambat: number = data?.totalPoTerlambat || 0;

  const filteredPoList = poList.filter((po: any) => {
    // Tab filter
    if (poFilter === "overdue" && !po.isOverdue) return false;
    if (poFilter === "ontime" && po.isOverdue) return false;

    // Search query filter
    if (searchPo.trim()) {
      const q = searchPo.toLowerCase();
      const matchNoPo = po.noPo?.toLowerCase().includes(q);
      const matchModel = po.model?.toLowerCase().includes(q);
      const matchVendor = po.vendor_nama?.toLowerCase().includes(q);
      return matchNoPo || matchModel || matchVendor;
    }
    return true;
  });

  return (
    <>
      <style>{`
        @keyframes pulseSoft { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes pulseAlert { 0%,100%{transform:scale(1); opacity:1} 50%{transform:scale(1.06); opacity:0.9} }
        
        .dash-card {
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .dash-card:hover {
          box-shadow: 0 6px 20px rgba(0,0,0,0.06) !important;
          transform: translateY(-2px);
        }

        .dash-outer-container {
          display: flex;
          flex-direction: column;
          min-height: 100%;
          background: #F8FAFC;
        }
        .dash-header-bar {
          padding: 18px 32px;
          background: white;
          border-bottom: 1px solid #E2E8F0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-shrink: 0;
          position: sticky;
          top: 0;
          z-index: 20;
          box-shadow: 0 1px 4px rgba(0,0,0,0.02);
        }
        .dash-main-scroll {
          display: flex;
          flex-direction: column;
          padding: 22px 32px 56px;
          gap: 20px;
        }
        .dash-stats-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 14px;
        }
        .dash-content-row {
          display: flex;
          gap: 22px;
          align-items: flex-start;
        }
        .dash-vendor-col {
          width: 34%;
          min-width: 320px;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        @media (max-width: 1280px) {
          .dash-stats-grid {
            grid-template-columns: repeat(3, 1fr) !important;
          }
        }

        @media (max-width: 960px) {
          .dash-header-bar {
            padding: 14px 18px !important;
            flex-wrap: wrap;
            gap: 12px;
          }
          .dash-main-scroll {
            padding: 16px 16px 48px !important;
            gap: 16px !important;
          }
          .dash-stats-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 10px !important;
          }
          .dash-content-row {
            flex-direction: column !important;
            gap: 16px !important;
          }
          .dash-vendor-col {
            width: 100% !important;
            min-width: 0 !important;
          }
        }

        @media (max-width: 480px) {
          .dash-stats-grid {
            grid-template-columns: 1fr 1fr !important;
            gap: 8px !important;
          }
          .dash-header-bar {
            padding: 12px 14px !important;
          }
        }
      `}</style>

      <div className="dash-outer-container">

        {/* HEADER BAR */}
        <div className="dash-header-bar">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h1 style={{ fontSize: 21, fontWeight: 900, color: "#0F172A", margin: 0, letterSpacing: -0.3 }}>
                Dashboard Produksi
              </h1>
              {totalPoTerlambat > 0 && (
                <button
                  onClick={() => setPoFilter("overdue")}
                  style={{ 
                    background: "#FEE2E2", 
                    color: "#DC2626", 
                    border: "1px solid #FCA5A5", 
                    fontSize: 11, 
                    fontWeight: 800, 
                    padding: "3px 10px", 
                    borderRadius: 99,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    cursor: "pointer",
                    animation: "pulseAlert 2.5s infinite"
                  }}
                >
                  <AlertTriangle size={12} /> {totalPoTerlambat} PO Terlambat
                </button>
              )}
            </div>
            <p style={{ fontSize: 12, color: "#64748B", margin: "3px 0 0" }}>
              Ringkasan aktivitas real-time konveksi hari ini & pantauan progres CMT
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span 
              title="WebSocket / SSE Terhubung: Sinkronisasi real-time aktif tanpa reload"
              style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: 6, 
                background: "#DCFCE7", 
                color: "#065F46", 
                fontSize: 11, 
                fontWeight: 800, 
                padding: "6px 14px", 
                borderRadius: 99, 
                border: "1px solid #BBF7D0" 
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10B981", display: "inline-block", animation: "pulseSoft 2s infinite" }} /> 
              LIVE SYNC
            </span>

            <button
              onClick={() => { setLoading(true); load(true); }}
              title="Klik untuk menyinkronkan data terbaru sekarang"
              style={{
                background: "white",
                border: "1px solid #E2E8F0",
                borderRadius: 10,
                padding: "6px 12px",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontWeight: 700,
                color: "#475569",
                cursor: "pointer",
                boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
              }}
            >
              <RefreshCw size={12} style={{ animation: pulse ? "spin 0.6s linear" : "none" }} />
              {lastUpdated ? fmtWaktu(lastUpdated) : "--:--:--"}
            </button>
          </div>
        </div>

        {/* MAIN BODY SCROLL */}
        <div className="dash-main-scroll">

          {/* REAL-TIME OVERDUE ALERT BANNER */}
          {totalPoTerlambat > 0 && (
            <div style={{ 
              background: "linear-gradient(135deg, #FFF1F2 0%, #FEF2F2 100%)", 
              border: "1.5px solid #FECDD3", 
              borderRadius: 18, 
              padding: "16px 20px", 
              boxShadow: "0 4px 16px rgba(225, 29, 72, 0.05)"
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ 
                    width: 42, 
                    height: 42, 
                    borderRadius: 12, 
                    background: "#FEE2E2", 
                    border: "1px solid #FCA5A5", 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center",
                    flexShrink: 0,
                    animation: "pulseAlert 2s infinite"
                  }}>
                    <ShieldAlert size={22} color="#DC2626" />
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
                      <span style={{ fontSize: 15, fontWeight: 900, color: "#991B1B" }}>
                        Peringatan Real-Time: {totalPoTerlambat} PO CMT Melebihi Target Waktu Selesai!
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 800, background: "#EF4444", color: "white", padding: "2px 8px", borderRadius: 99, letterSpacing: 0.5 }}>
                        OVERDUE
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: "#7F1D1D", margin: 0, lineHeight: 1.4 }}>
                      Pengerjaan oleh vendor CMT terlambat beberapa hari dari estimasi selesai. Segera lakukan koordinasi dan follow-up.
                    </p>
                  </div>
                </div>

                <button 
                  onClick={() => setBannerExpanded(!bannerExpanded)}
                  style={{
                    background: "white",
                    border: "1px solid #FECDD3",
                    borderRadius: 8,
                    padding: "6px 12px",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#991B1B",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    flexShrink: 0
                  }}
                >
                  {bannerExpanded ? <>Tutup Rincian <ChevronUp size={14} /></> : <>Lihat {totalPoTerlambat} Rincian <ChevronDown size={14} /></>}
                </button>
              </div>

              {bannerExpanded && (
                <div style={{ 
                  marginTop: 14, 
                  display: "grid", 
                  gridTemplateColumns: overdueList.length > 1 ? "repeat(auto-fit, minmax(300px, 1fr))" : "1fr", 
                  gap: 12 
                }}>
                  {overdueList.map((po: any) => {
                    const waNum = cleanWaNumber(po.vendor_kontak);
                    return (
                      <div 
                        key={po.id} 
                        style={{ 
                          background: "white", 
                          borderRadius: 14, 
                          padding: "14px 16px", 
                          border: "1px solid #FCA5A5",
                          boxShadow: "0 2px 8px rgba(220, 38, 38, 0.04)",
                          display: "flex",
                          flexDirection: "column",
                          gap: 10
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontFamily: "monospace", fontWeight: 900, fontSize: 14, color: "#0F172A" }}>{po.noPo}</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>· {po.model}</span>
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 800, color: "#1E293B", marginTop: 2 }}>
                              Vendor: <span style={{ color: "#2563EB" }}>{po.vendor_nama || "CMT"}</span>
                            </div>
                          </div>
                          <span style={{ 
                            background: "#FEF2F2", 
                            color: "#DC2626", 
                            border: "1px solid #FCA5A5", 
                            fontSize: 11, 
                            fontWeight: 900, 
                            padding: "3px 8px", 
                            borderRadius: 6,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3
                          }}>
                            <Clock size={11} /> +{po.overdueDays} Hari
                          </span>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748B", background: "#FFF5F5", padding: "8px 12px", borderRadius: 8 }}>
                          <span>Target: <b style={{ color: "#DC2626" }}>{fmtDate(po.target_selesai)}</b></span>
                          <span>Sisa: <b style={{ color: "#0F172A" }}>{po.sisaPcs} pcs</b> ({po.pctGudang}% rampung)</span>
                        </div>

                        <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                          {po.vendorId && (
                            <Link 
                              href={`/cmt/${po.vendorId}`}
                              target="_blank"
                              style={{ 
                                flex: 1,
                                display: "inline-flex", 
                                alignItems: "center", 
                                justifyContent: "center",
                                gap: 4, 
                                fontSize: 12, 
                                fontWeight: 700, 
                                background: "#0F172A", 
                                color: "white", 
                                padding: "8px 12px", 
                                borderRadius: 10, 
                                textDecoration: "none" 
                              }}
                            >
                              Portal CMT <ExternalLink size={12} />
                            </Link>
                          )}
                          {waNum ? (
                            <a 
                              href={`https://wa.me/${waNum}?text=${encodeURIComponent(`Halo ${po.vendor_nama}, kami ingin menanyakan perkembangan pengerjaan PO ${po.noPo} (${po.model}) yang saat ini telah melewati batas estimasi target selesai (${fmtDate(po.target_selesai)}). Mohon update progres terbarunya. Terima kasih!`)}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ 
                                display: "inline-flex", 
                                alignItems: "center", 
                                justifyContent: "center",
                                gap: 4, 
                                fontSize: 12, 
                                fontWeight: 700, 
                                background: "#25D366", 
                                color: "white", 
                                padding: "8px 14px", 
                                borderRadius: 10, 
                                textDecoration: "none" 
                              }}
                            >
                              <MessageCircle size={13} /> Chat WA
                            </a>
                          ) : (
                            <Link
                              href="/atur-vendor-cmt"
                              style={{
                                display: "inline-flex", 
                                alignItems: "center", 
                                justifyContent: "center",
                                fontSize: 11, 
                                fontWeight: 700, 
                                color: "#64748B", 
                                background: "#F1F5F9", 
                                padding: "8px 12px", 
                                borderRadius: 10, 
                                textDecoration: "none" 
                              }}
                            >
                              Atur No WA
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/*  STATS ROW (6 Cards with PO Terlambat)  */}
          <div className="dash-stats-grid">
            {[
              { id: "all", fiIcon: "fi-sr-document", bg: "#EFF6FF", color: "#1D4ED8", label: "PO Aktif", val: data?.poAktif ?? 0, sub: "Sedang berjalan" },
              { id: "ontime", fiIcon: "fi-sr-badge-check", bg: "#ECFDF5", color: "#059669", label: "PO Selesai", val: data?.poSelesai ?? 0, sub: "100% masuk gudang" },
              { 
                id: "overdue",
                fiIcon: "fi-sr-time-past", 
                bg: totalPoTerlambat > 0 ? "#FEE2E2" : "#F1F5F9", 
                color: totalPoTerlambat > 0 ? "#DC2626" : "#64748B", 
                label: "PO Terlambat", 
                val: totalPoTerlambat, 
                sub: totalPoTerlambat > 0 ? "⚠️ Melebihi target" : "Semua tepat waktu",
                isAlert: totalPoTerlambat > 0
              },
              { id: "pcs", fiIcon: "fi-sr-needle", bg: "#FEF3C7", color: "#D97706", label: "Total PCS", val: data?.totalPCS ?? 0, sub: "Volume terbit" },
              { id: "gudang", fiIcon: "fi-sr-box-open", bg: "#DCFCE7", color: "#16A34A", label: "Di Gudang", val: data?.totalDiGudang ?? 0, sub: "Pcs tuntas" },
              { id: "vendor", fiIcon: "fi-sr-users", bg: "#F5F3FF", color: "#7C3AED", label: "Vendor Aktif", val: vendorList.length, sub: "CMT & Alur" },
            ].map((item, i) => {
              const isSelected = (item.id === "all" && poFilter === "all") || (item.id === "overdue" && poFilter === "overdue") || (item.id === "ontime" && poFilter === "ontime");
              return (
                <div 
                  key={i} 
                  onClick={() => {
                    if (item.id === "all" || item.id === "ontime" || item.id === "overdue") {
                      setPoFilter(item.id as any);
                    }
                  }}
                  className="dash-card" 
                  style={{ 
                    background: item.isAlert ? "#FFF5F5" : "white", 
                    padding: "16px 18px", 
                    borderRadius: 16, 
                    border: item.isAlert ? "1.5px solid #FCA5A5" : isSelected ? "1.5px solid #3B82F6" : "1px solid #E2E8F0", 
                    boxShadow: item.isAlert ? "0 2px 8px rgba(220,38,38,0.06)" : "0 2px 6px rgba(0,0,0,0.02)", 
                    cursor: (item.id === "all" || item.id === "ontime" || item.id === "overdue") ? "pointer" : "default",
                    position: "relative"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: item.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <i className={`fi ${item.fiIcon}`} style={{ fontSize: 16, color: item.color }} />
                    </div>
                    {item.isAlert && (
                      <span style={{ fontSize: 9, fontWeight: 900, background: "#EF4444", color: "white", padding: "2px 7px", borderRadius: 4, letterSpacing: 0.5 }}>
                        ACTION
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: item.isAlert ? "#991B1B" : "#64748B", marginBottom: 2 }}>{item.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: item.isAlert ? "#DC2626" : "#0F172A", lineHeight: 1.1 }}>{item.val}</div>
                  <div style={{ fontSize: 10, color: item.isAlert ? "#B91C1C" : "#94A3B8", marginTop: 4, fontWeight: item.isAlert ? 700 : 500 }}>
                    {item.sub}
                  </div>
                </div>
              );
            })}
          </div>

          {/*  MAIN TWO-COLUMN  */}
          <div className="dash-content-row">

            {/* LEFT: PO Progress */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "white", borderRadius: 18, border: "1px solid #E2E8F0", boxShadow: "0 2px 12px rgba(0,0,0,0.03)" }}>
              
              {/* Header & Filter Controls */}
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ background: "#EFF6FF", padding: "6px 8px", borderRadius: 8, display: "flex" }}>
                    <i className="fi fi-sr-route" style={{ fontSize: 16, color: "#3B82F6" }} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: 0 }}>Progress PO Produksi</h2>
                    <span style={{ fontSize: 11, color: "#94A3B8" }}>Status & pengerjaan setiap SPK / PO</span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {/* Search Input */}
                  <div style={{ position: "relative", minWidth: 180 }}>
                    <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }} />
                    <input 
                      type="text"
                      value={searchPo}
                      onChange={e => setSearchPo(e.target.value)}
                      placeholder="Cari PO / model / vendor..."
                      style={{
                        padding: "6px 10px 6px 30px",
                        fontSize: 12,
                        borderRadius: 8,
                        border: "1px solid #E2E8F0",
                        outline: "none",
                        width: "100%",
                        background: "#F8FAFC"
                      }}
                    />
                    {searchPo && (
                      <button onClick={() => setSearchPo("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", cursor: "pointer", color: "#94A3B8" }}>
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {/* Filter Tabs */}
                  <div style={{ display: "flex", alignItems: "center", gap: 4, background: "#F1F5F9", padding: "3px 4px", borderRadius: 8 }}>
                    <button 
                      onClick={() => setPoFilter("all")} 
                      style={{ 
                        border: "none", 
                        background: poFilter === "all" ? "white" : "transparent", 
                        color: poFilter === "all" ? "#0F172A" : "#64748B", 
                        fontSize: 11, 
                        fontWeight: 700, 
                        padding: "5px 10px", 
                        borderRadius: 6, 
                        cursor: "pointer",
                        boxShadow: poFilter === "all" ? "0 1px 3px rgba(0,0,0,0.08)" : "none"
                      }}
                    >
                      Semua ({poList.length})
                    </button>
                    <button 
                      onClick={() => setPoFilter("overdue")} 
                      style={{ 
                        border: "none", 
                        background: poFilter === "overdue" ? "#FEE2E2" : "transparent", 
                        color: poFilter === "overdue" ? "#DC2626" : "#64748B", 
                        fontSize: 11, 
                        fontWeight: 700, 
                        padding: "5px 10px", 
                        borderRadius: 6, 
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4
                      }}
                    >
                      🚨 Terlambat ({totalPoTerlambat})
                    </button>
                    <button 
                      onClick={() => setPoFilter("ontime")} 
                      style={{ 
                        border: "none", 
                        background: poFilter === "ontime" ? "#DCFCE7" : "transparent", 
                        color: poFilter === "ontime" ? "#059669" : "#64748B", 
                        fontSize: 11, 
                        fontWeight: 700, 
                        padding: "5px 10px", 
                        borderRadius: 6, 
                        cursor: "pointer" 
                      }}
                    >
                      Tepat Waktu ({poList.length - totalPoTerlambat})
                    </button>
                  </div>

                  <Link href="/peta-perjalanan" style={{ fontSize: 12, fontWeight: 700, color: "#3B82F6", textDecoration: "none", display: "flex", alignItems: "center", gap: 3, padding: "5px 8px" }}>
                    Lihat Peta <ArrowRight size={13} />
                  </Link>
                </div>
              </div>

              {/* PO List Cards */}
              <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
                {filteredPoList.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 48, color: "#94A3B8", fontSize: 13 }}>
                    <i className="fi fi-rr-document" style={{ fontSize: 36, display: "block", marginBottom: 10, color: "#CBD5E1" }} />
                    <p style={{ fontWeight: 700, fontSize: 14, color: "#475569", margin: "0 0 4px" }}>
                      {searchPo ? "Tidak ditemukan PO yang cocok dengan pencarian" : poFilter === "overdue" ? "Hebat! Tidak ada PO yang terlambat saat ini" : "Belum ada data PO produksi"}
                    </p>
                    <p style={{ fontSize: 12, color: "#94A3B8", margin: 0 }}>
                      {searchPo ? "Coba kata kunci nomor PO atau nama model lainnya" : "Data pengerjaan akan muncul setelah SPK diterbitkan"}
                    </p>
                  </div>
                ) : filteredPoList.map((po: any) => {
                  const stage = STAGE_CFG[po.stage] || STAGE_CFG["menunggu"];
                  const isLate = po.isOverdue;
                  const waNum = cleanWaNumber(po.vendor_kontak);

                  return (
                    <div 
                      key={po.id} 
                      className="dash-card" 
                      style={{ 
                        padding: "16px 18px", 
                        border: isLate ? "1.5px solid #FCA5A5" : "1px solid #E2E8F0", 
                        borderLeft: isLate ? "5px solid #DC2626" : "1px solid #E2E8F0",
                        borderRadius: 14, 
                        background: isLate ? "#FFFDFD" : "#FAFAFA"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, gap: 12 }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                            <span 
                              onClick={() => setSelectedPo(po)}
                              style={{ 
                                fontWeight: 900, 
                                fontSize: 15, 
                                color: "#0F172A", 
                                fontFamily: "monospace", 
                                cursor: "pointer",
                                textDecoration: "underline",
                                textUnderlineOffset: 3
                              }}
                              title="Klik untuk melihat detail lengkap PO"
                            >
                              {po.noPo}
                            </span>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: stage.bg, color: stage.color }}>
                              {stage.label}
                            </span>
                            {isLate && (
                              <span style={{ 
                                fontSize: 10, 
                                fontWeight: 800, 
                                padding: "2px 8px", 
                                borderRadius: 20, 
                                background: "#FEE2E2", 
                                color: "#DC2626", 
                                border: "1px solid #FCA5A5", 
                                display: "inline-flex", 
                                alignItems: "center", 
                                gap: 3 
                              }}>
                                <Clock size={10} /> Terlambat +{po.overdueDays} Hari
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: "#64748B" }}>
                            <strong style={{ color: "#1E293B" }}>{po.model}</strong> · Vendor: <strong style={{ color: "#2563EB" }}>{po.vendor_nama || "-"}</strong> · Terbit: {fmtDate(po.tanggalTerbit)}
                          </div>
                          {po.target_selesai && (
                            <div style={{ fontSize: 11, marginTop: 3, color: isLate ? "#DC2626" : "#64748B", fontWeight: isLate ? 700 : 500 }}>
                              Target Selesai: {fmtDate(po.target_selesai)} {isLate ? `(Melebihi target ${po.overdueDays} hari)` : ""}
                            </div>
                          )}
                        </div>

                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontSize: 19, fontWeight: 900, color: "#0F172A" }}>{po.jumlahTerbit} <span style={{ fontSize: 11, color: "#94A3B8" }}>pcs</span></div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: isLate ? "#DC2626" : "#10B981" }}>
                            {po.totalDiGudang} di gudang ({po.sisaPcs} sisa)
                          </div>
                        </div>
                      </div>

                      {/* Progress bars */}
                      <div style={{ width: "100%", background: "#E2E8F0", height: 7, borderRadius: 4, overflow: "hidden", position: "relative" }}>
                        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${Math.min(po.pctGudang, 100)}%`, background: "#10B981", borderRadius: 4 }} />
                        <div style={{ position: "absolute", left: `${po.pctGudang}%`, top: 0, height: "100%", width: `${Math.min(po.pctDisetujui - po.pctGudang, 100)}%`, background: "#3B82F6", borderRadius: 4 }} />
                        <div style={{ position: "absolute", left: `${po.pctDisetujui}%`, top: 0, height: "100%", width: `${Math.min(po.pctCMT - po.pctDisetujui, 100)}%`, background: "#F59E0B", borderRadius: 4 }} />
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, flexWrap: "wrap", gap: 8 }}>
                        <div style={{ display: "flex", gap: 10, fontSize: 10, color: "#94A3B8" }}>
                          {po.totalDiGudang > 0 && <span style={{ color: "#10B981", fontWeight: 700 }}> {po.totalDiGudang} gudang</span>}
                          {po.totalDisetujui > 0 && <span style={{ color: "#3B82F6", fontWeight: 700 }}> {po.totalDisetujui} ACC</span>}
                          {po.totalDilaporkan > 0 && <span style={{ color: "#F59E0B", fontWeight: 700 }}> {po.totalDilaporkan} laporan</span>}
                          {po.totalWashing > 0 && <span style={{ color: "#06B6D4", fontWeight: 700 }}> {po.totalWashingDone}/{po.totalWashing} washing</span>}
                          <span style={{ fontWeight: 600 }}>{po.pctGudang}% selesai</span>
                        </div>

                        {/* Quick action buttons per PO */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <button
                            onClick={() => setSelectedPo(po)}
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: "#475569",
                              background: "#F1F5F9",
                              border: "none",
                              padding: "4px 8px",
                              borderRadius: 6,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 3
                            }}
                          >
                            Rincian SPK
                          </button>

                          {po.vendorId && (
                            <Link 
                              href={`/cmt/${po.vendorId}`}
                              target="_blank"
                              style={{ 
                                fontSize: 11, 
                                fontWeight: 700, 
                                color: "#2563EB", 
                                background: "#EFF6FF", 
                                padding: "4px 8px", 
                                borderRadius: 6, 
                                textDecoration: "none",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 3
                              }}
                            >
                              Portal CMT <ExternalLink size={10} />
                            </Link>
                          )}
                          {waNum && (
                            <a 
                              href={`https://wa.me/${waNum}?text=${encodeURIComponent(`Halo ${po.vendor_nama}, mohon informasi progres untuk PO ${po.noPo} (${po.model}). Terima kasih!`)}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ 
                                fontSize: 11, 
                                fontWeight: 700, 
                                color: "#059669", 
                                background: "#ECFDF5", 
                                padding: "4px 8px", 
                                borderRadius: 6, 
                                textDecoration: "none",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 3
                              }}
                            >
                              WA <MessageCircle size={10} />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RIGHT COLUMN: Quick Actions + Vendor Aktif */}
            <div className="dash-vendor-col">

              {/* Quick Actions */}
              <div style={{ background: "white", borderRadius: 18, border: "1px solid #E2E8F0", padding: "16px 18px", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
                  Aksi Cepat
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {[
                    { href: "/buat-spk", label: "Buat PO / SPK Baru", bg: "#3B82F6", color: "white", icon: "fi-sr-document-signed" },
                    { href: "/dashboard-cmt", label: "Dashboard Vendor & Kinerja", bg: "#F8FAFC", color: "#0F172A", icon: "fi-sr-chart-line-up" },
                    { href: "/pemotongan-kain", label: "Pemotongan Kain", bg: "#F8FAFC", color: "#0F172A", icon: "fi-sr-scissors" },
                    { href: "/barcode-produksi", label: "Barcode Produksi", bg: "#F8FAFC", color: "#0F172A", icon: "fi-sr-qr-scan" },
                  ].map((item, i) => (
                    <Link key={i} href={item.href} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: item.bg, color: item.color, padding: "11px 14px", borderRadius: 12, fontWeight: 700, fontSize: 13, textDecoration: "none", border: item.bg === "#F8FAFC" ? "1px solid #E2E8F0" : "none", transition: "all 0.15s" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <i className={`fi ${item.icon}`} style={{ fontSize: 15 }} />
                        {item.label}
                      </div>
                      <ArrowRight size={14} />
                    </Link>
                  ))}
                </div>
              </div>

              {/* Vendor Aktif */}
              <div style={{ background: "white", borderRadius: 18, border: "1px solid #E2E8F0", padding: "16px 18px", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid #F1F5F9" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ background: "#FEF3C7", padding: "6px 8px", borderRadius: 8, display: "flex" }}>
                      <i className="fi fi-sr-users" style={{ fontSize: 15, color: "#D97706" }} />
                    </div>
                    <div>
                      <h2 style={{ fontSize: 14, fontWeight: 800, color: "#0F172A", margin: 0 }}>Vendor Aktif</h2>
                      <span style={{ fontSize: 10, color: "#94A3B8" }}>Kinerja & status tenggat</span>
                    </div>
                  </div>
                  <Link href="/dashboard-cmt" style={{ fontSize: 11, fontWeight: 700, color: "#3B82F6", textDecoration: "none" }}>Semua</Link>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {vendorList.length === 0 ? (
                    <div style={{ textAlign: "center", padding: 30, color: "#94A3B8", fontSize: 13 }}>
                      <i className="fi fi-rr-users" style={{ fontSize: 28, display: "block", marginBottom: 8 }} />
                      Tidak ada vendor aktif
                    </div>
                  ) : vendorList.map((v: any) => {
                    const tc = TIPE_CFG[v.tipe] || { bg: "#F1F5F9", color: "#64748B" };
                    const waNum = cleanWaNumber(v.kontak);
                    return (
                      <div 
                        key={v.id} 
                        className="dash-card" 
                        style={{ 
                          padding: "12px 14px", 
                          border: v.hasOverdue ? "1.5px solid #FCA5A5" : "1px solid #E2E8F0", 
                          borderRadius: 12, 
                          background: v.hasOverdue ? "#FFF5F5" : "white"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 13, color: "#0F172A", marginBottom: 2 }}>{v.nama}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 20, background: tc.bg, color: tc.color }}>{v.tipe}</span>
                              <span style={{ fontSize: 11, color: "#94A3B8" }}>{v.jenis_pekerjaan || ""}</span>
                            </div>
                            {v.hasOverdue && (
                              <div style={{ marginTop: 5 }}>
                                <span style={{ 
                                  fontSize: 10, 
                                  fontWeight: 800, 
                                  color: "#DC2626", 
                                  background: "#FEE2E2", 
                                  border: "1px solid #FCA5A5", 
                                  padding: "2px 7px", 
                                  borderRadius: 5,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 3
                                }}>
                                  <AlertTriangle size={10} /> {v.overdueCount} PO Terlambat (+{v.maxOverdueDays} hr)
                                </span>
                              </div>
                            )}
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 17, fontWeight: 900, color: v.hasOverdue ? "#DC2626" : "#0F172A" }}>{v.jumlahPO}</div>
                            <div style={{ fontSize: 10, color: "#94A3B8" }}>PO aktif</div>
                          </div>
                        </div>

                        {/* Quick link to Vendor Portal & WA */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, marginTop: 8, paddingTop: 8, borderTop: "1px solid #F1F5F9" }}>
                          <Link 
                            href={`/cmt/${v.id}`}
                            target="_blank"
                            style={{ 
                              fontSize: 11, 
                              fontWeight: 700, 
                              color: "#2563EB", 
                              textDecoration: "none",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 3
                            }}
                          >
                            Portal <ExternalLink size={10} />
                          </Link>
                          {waNum && (
                            <a 
                              href={`https://wa.me/${waNum}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ 
                                fontSize: 11, 
                                fontWeight: 700, 
                                color: "#059669", 
                                textDecoration: "none",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 3
                              }}
                            >
                              WA <MessageCircle size={10} />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PO DETAIL MODAL */}
        {selectedPo && (
          <div 
            onClick={() => setSelectedPo(null)}
            style={{ 
              position: "fixed", 
              inset: 0, 
              background: "rgba(15, 23, 42, 0.6)", 
              backdropFilter: "blur(4px)", 
              zIndex: 9999, 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center", 
              padding: 20 
            }}
          >
            <div 
              onClick={e => e.stopPropagation()}
              style={{ 
                background: "white", 
                borderRadius: 20, 
                maxWidth: 580, 
                width: "100%", 
                maxHeight: "90vh", 
                overflowY: "auto", 
                boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
                border: "1px solid #E2E8F0"
              }}
            >
              {/* Modal Header */}
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18, fontWeight: 900, color: "#0F172A", fontFamily: "monospace" }}>{selectedPo.noPo}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: STAGE_CFG[selectedPo.stage]?.bg || "#F1F5F9", color: STAGE_CFG[selectedPo.stage]?.color || "#64748B" }}>
                      {STAGE_CFG[selectedPo.stage]?.label || selectedPo.stage}
                    </span>
                    {selectedPo.isOverdue && (
                      <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 20, background: "#FEE2E2", color: "#DC2626", border: "1px solid #FCA5A5" }}>
                        🚨 Lewat {selectedPo.overdueDays} Hari
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 13, color: "#64748B", margin: "4px 0 0" }}>
                    Model: <strong>{selectedPo.model}</strong> · Vendor: <strong style={{ color: "#2563EB" }}>{selectedPo.vendor_nama || "-"}</strong>
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedPo(null)} 
                  style={{ border: "none", background: "#F1F5F9", width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#64748B" }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Content */}
              <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
                
                {/* Overdue alert in modal if late */}
                {selectedPo.isOverdue && (
                  <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                    <AlertTriangle size={20} color="#DC2626" style={{ flexShrink: 0 }} />
                    <div style={{ fontSize: 12, color: "#991B1B", lineHeight: 1.4 }}>
                      <strong>Pengerjaan PO Terlambat!</strong> Target selesai adalah <strong>{fmtDate(selectedPo.target_selesai)}</strong>. Saat ini telah lewat <strong>{selectedPo.overdueDays} hari</strong> dari toleransi batas waktu.
                    </div>
                  </div>
                )}

                {/* Grid info */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                  <div style={{ background: "#F8FAFC", padding: "10px 14px", borderRadius: 10, border: "1px solid #E2E8F0" }}>
                    <span style={{ fontSize: 11, color: "#64748B" }}>Tanggal Diterbitkan</span>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginTop: 2 }}>{fmtDate(selectedPo.tanggalTerbit)}</div>
                  </div>
                  <div style={{ background: "#F8FAFC", padding: "10px 14px", borderRadius: 10, border: "1px solid #E2E8F0" }}>
                    <span style={{ fontSize: 11, color: "#64748B" }}>Target Estimasi Selesai</span>
                    <div style={{ fontSize: 13, fontWeight: 700, color: selectedPo.isOverdue ? "#DC2626" : "#0F172A", marginTop: 2 }}>{fmtDate(selectedPo.target_selesai)}</div>
                  </div>
                  <div style={{ background: "#F8FAFC", padding: "10px 14px", borderRadius: 10, border: "1px solid #E2E8F0" }}>
                    <span style={{ fontSize: 11, color: "#64748B" }}>Jumlah Total Diterbitkan</span>
                    <div style={{ fontSize: 15, fontWeight: 900, color: "#0F172A", marginTop: 2 }}>{selectedPo.jumlahTerbit} pcs</div>
                  </div>
                  <div style={{ background: "#F8FAFC", padding: "10px 14px", borderRadius: 10, border: "1px solid #E2E8F0" }}>
                    <span style={{ fontSize: 11, color: "#64748B" }}>Sisa Belum ke Gudang</span>
                    <div style={{ fontSize: 15, fontWeight: 900, color: selectedPo.sisaPcs > 0 ? "#DC2626" : "#059669", marginTop: 2 }}>{selectedPo.sisaPcs} pcs</div>
                  </div>
                </div>

                {/* Progress breakdown */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#0F172A", marginBottom: 8 }}>Alur Progres Pengerjaan:</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, textAlign: "center" }}>
                    <div style={{ background: "#EFF6FF", padding: "8px 6px", borderRadius: 8 }}>
                      <div style={{ fontSize: 10, color: "#1D4ED8", fontWeight: 700 }}>Dilaporkan CMT</div>
                      <div style={{ fontSize: 14, fontWeight: 900, color: "#1E293B", marginTop: 2 }}>{selectedPo.totalDilaporkan} pcs</div>
                    </div>
                    <div style={{ background: "#F0FDF4", padding: "8px 6px", borderRadius: 8 }}>
                      <div style={{ fontSize: 10, color: "#15803D", fontWeight: 700 }}>Diverifikasi ACC</div>
                      <div style={{ fontSize: 14, fontWeight: 900, color: "#1E293B", marginTop: 2 }}>{selectedPo.totalDisetujui} pcs</div>
                    </div>
                    <div style={{ background: "#ECFEFF", padding: "8px 6px", borderRadius: 8 }}>
                      <div style={{ fontSize: 10, color: "#0E7490", fontWeight: 700 }}>Washing Selesai</div>
                      <div style={{ fontSize: 14, fontWeight: 900, color: "#1E293B", marginTop: 2 }}>{selectedPo.totalWashingDone} pcs</div>
                    </div>
                    <div style={{ background: "#DCFCE7", padding: "8px 6px", borderRadius: 8 }}>
                      <div style={{ fontSize: 10, color: "#166534", fontWeight: 700 }}>Masuk Gudang</div>
                      <div style={{ fontSize: 14, fontWeight: 900, color: "#166534", marginTop: 2 }}>{selectedPo.totalDiGudang} pcs</div>
                    </div>
                  </div>
                </div>

                {/* Size breakdown list */}
                {selectedPo.sizeBreakdown && selectedPo.sizeBreakdown.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#0F172A", marginBottom: 8 }}>Rincian Ukuran / Size:</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {selectedPo.sizeBreakdown.map((sb: any, idx: number) => (
                        <div key={idx} style={{ background: "#F1F5F9", padding: "6px 12px", borderRadius: 8, fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontWeight: 800, color: "#0F172A" }}>{sb.size}</span>
                          <span style={{ color: "#64748B" }}>: {sb.jumlah} pcs</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Modal Actions */}
                <div style={{ display: "flex", gap: 10, marginTop: 8, paddingTop: 14, borderTop: "1px solid #E2E8F0" }}>
                  {selectedPo.vendorId && (
                    <Link 
                      href={`/cmt/${selectedPo.vendorId}`}
                      target="_blank"
                      style={{ 
                        flex: 1, 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "center", 
                        gap: 6, 
                        background: "#0F172A", 
                        color: "white", 
                        padding: "10px 14px", 
                        borderRadius: 10, 
                        fontWeight: 700, 
                        fontSize: 13, 
                        textDecoration: "none" 
                      }}
                    >
                      Buka Portal CMT <ExternalLink size={13} />
                    </Link>
                  )}
                  {cleanWaNumber(selectedPo.vendor_kontak) && (
                    <a 
                      href={`https://wa.me/${cleanWaNumber(selectedPo.vendor_kontak)}?text=${encodeURIComponent(`Halo ${selectedPo.vendor_nama}, kami ingin menanyakan status pengerjaan PO ${selectedPo.noPo} (${selectedPo.model}). Terima kasih!`)}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "center", 
                        gap: 6, 
                        background: "#25D366", 
                        color: "white", 
                        padding: "10px 16px", 
                        borderRadius: 10, 
                        fontWeight: 700, 
                        fontSize: 13, 
                        textDecoration: "none" 
                      }}
                    >
                      <MessageCircle size={14} /> Chat WA
                    </a>
                  )}
                  <Link
                    href="/peta-perjalanan"
                    style={{
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "center", 
                      gap: 4, 
                      background: "#F1F5F9", 
                      color: "#334155", 
                      padding: "10px 14px", 
                      borderRadius: 10, 
                      fontWeight: 700, 
                      fontSize: 13, 
                      textDecoration: "none" 
                    }}
                  >
                    Alur Produksi 🗺
                  </Link>
                </div>

              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
