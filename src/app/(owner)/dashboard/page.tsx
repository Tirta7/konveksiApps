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
  ChevronUp
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
  if (clean.startsWith("0")) clean = "62" + clean.slice(1);
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
  const prevRef = useRef<string>("");
  const alertedOverdueRef = useRef<number>(-1);

  useEffect(() => {
    // Only lock .app-content on desktop (width > 900px)
    if (typeof window !== "undefined" && window.innerWidth > 900) {
      const el = document.querySelector(".app-content") as HTMLElement;
      if (el) { el.style.overflow = "hidden"; el.style.padding = "0"; el.style.height = "100vh"; }
      return () => { if (el) { el.style.overflow = ""; el.style.padding = ""; el.style.height = ""; } };
    }
  }, []);

  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
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
    } catch (e: any) {
      setLoadError(e?.message || "Gagal terhubung ke server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); const id = setInterval(load, 5000); return () => clearInterval(id); }, [load]);

  // Real-time sync: instant refresh when another admin or CMT makes a change
  useEffect(() => {
    const handler = () => {
      load();
    };
    window.addEventListener("konveksi-sync", handler);
    return () => window.removeEventListener("konveksi-sync", handler);
  }, [load]);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100dvh", background: "#F1F5F9" }}>
      <div style={{ textAlign: "center", color: "#94A3B8" }}>
        <RefreshCw size={32} style={{ animation: "spin 1s linear infinite", display: "block", margin: "0 auto 12px" }} />
        <p style={{ fontSize: 15, fontWeight: 600 }}>Memuat Dashboard...</p>
      </div>
    </div>
  );

  if (!data && loadError) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "70dvh", background: "#F1F5F9", padding: 20 }}>
      <div style={{ textAlign: "center", background: "white", padding: 28, borderRadius: 16, border: "1px solid #E2E8F0", maxWidth: 360 }}>
        <p style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", marginBottom: 6 }}>Data dashboard gagal dimuat</p>
        <p style={{ fontSize: 13, color: "#64748B", marginBottom: 16 }}>{loadError}</p>
        <button onClick={() => { setLoading(true); load(); }} style={{ padding: "10px 20px", background: "#3B82F6", color: "white", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14 }}>
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
    if (poFilter === "overdue") return po.isOverdue;
    if (poFilter === "ontime") return !po.isOverdue;
    return true;
  });

  return (
    <>
      <style>{`
        @keyframes pulseSoft { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes pulseAlert { 0%,100%{transform:scale(1); opacity:1} 50%{transform:scale(1.08); opacity:0.85} }
        @media (min-width: 769px) {
          ::-webkit-scrollbar { width: 4px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 99px; }
        }
        .dash-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08)!important; transform: translateY(-1px); }

        .dash-outer-container {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: #F8FAFC;
          overflow: hidden;
        }
        .dash-header-bar {
          padding: 16px 28px;
          background: white;
          border-bottom: 1px solid #E2E8F0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-shrink: 0;
        }
        .dash-main-scroll {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          padding: 18px 28px;
          gap: 16px;
        }
        .dash-stats-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 12px;
          flex-shrink: 0;
        }
        .dash-content-row {
          display: flex;
          gap: 18px;
          flex: 1;
          min-height: 0;
        }
        .dash-vendor-col {
          width: 32%;
          min-width: 290px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        @media (max-width: 1200px) {
          .dash-stats-grid {
            grid-template-columns: repeat(3, 1fr) !important;
          }
        }

        @media (max-width: 960px) {
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
          .dash-outer-container {
            height: auto !important;
            min-height: 100vh;
            min-height: 100dvh;
            overflow: visible !important;
          }
          .dash-header-bar {
            padding: 14px 16px !important;
            flex-wrap: wrap;
            gap: 12px;
          }
          .dash-main-scroll {
            overflow: visible !important;
            height: auto !important;
            padding: 14px 14px 48px !important;
            gap: 14px !important;
          }
          .dash-stats-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 10px !important;
          }
          .dash-content-row {
            flex-direction: column !important;
            overflow: visible !important;
            height: auto !important;
            gap: 16px !important;
          }
          .dash-vendor-col {
            width: 100% !important;
            min-width: 0 !important;
          }
        }

        @media (max-width: 480px) {
          .dash-stats-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 8px !important;
          }
          .dash-header-bar {
            padding: 12px 14px !important;
          }
        }
      `}</style>

      <div className="dash-outer-container">

        {/* Header */}
        <div className="dash-header-bar">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h1 style={{ fontSize: 20, fontWeight: 900, color: "#0F172A", margin: 0 }}>Dashboard Produksi</h1>
              {totalPoTerlambat > 0 && (
                <span style={{ 
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
                  animation: "pulseAlert 2.5s infinite"
                }}>
                  <AlertTriangle size={12} /> {totalPoTerlambat} PO Terlambat
                </span>
              )}
            </div>
            <p style={{ fontSize: 12, color: "#64748B", margin: "2px 0 0" }}>
              Ringkasan aktivitas real-time konveksi hari ini & pantauan progres CMT
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span 
              title="WebSocket / SSE Terhubung: Sinkronisasi data real-time otomatis tanpa reload"
              style={{ display: "flex", alignItems: "center", gap: 6, background: "#DCFCE7", color: "#065F46", fontSize: 11, fontWeight: 800, padding: "5px 12px", borderRadius: 99, border: "1px solid #BBF7D0", cursor: "default" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10B981", display: "inline-block", animation: "pulseSoft 2s infinite" }} /> LIVE SYNC
            </span>
            <div style={{ fontSize: 11, color: "#94A3B8", display: "flex", alignItems: "center", gap: 5, fontWeight: 600 }}>
              <RefreshCw size={11} style={{ animation: pulse ? "spin 0.5s linear" : "none" }} />
              {lastUpdated ? fmtWaktu(lastUpdated) : "--:--:--"}
            </div>
          </div>
        </div>

        <div className="dash-main-scroll">

          {/* REAL-TIME OVERDUE ALERT BANNER */}
          {totalPoTerlambat > 0 && (
            <div style={{ 
              background: "linear-gradient(135deg, #FFF1F2 0%, #FEF2F2 100%)", 
              border: "1.5px solid #FECDD3", 
              borderRadius: 16, 
              padding: "16px 20px", 
              boxShadow: "0 4px 16px rgba(225, 29, 72, 0.06)",
              flexShrink: 0
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ 
                    width: 40, 
                    height: 40, 
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
                      <span style={{ fontSize: 14, fontWeight: 900, color: "#991B1B" }}>
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
                  gridTemplateColumns: overdueList.length > 1 ? "repeat(auto-fit, minmax(280px, 1fr))" : "1fr", 
                  gap: 10 
                }}>
                  {overdueList.map((po: any) => {
                    const waNum = cleanWaNumber(po.vendor_kontak);
                    return (
                      <div 
                        key={po.id} 
                        style={{ 
                          background: "white", 
                          borderRadius: 12, 
                          padding: "12px 14px", 
                          border: "1px solid #FCA5A5",
                          boxShadow: "0 2px 6px rgba(220, 38, 38, 0.04)",
                          display: "flex",
                          flexDirection: "column",
                          gap: 8
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontFamily: "monospace", fontWeight: 900, fontSize: 13, color: "#0F172A" }}>{po.noPo}</span>
                              <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B" }}>· {po.model}</span>
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

                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748B", background: "#FFF5F5", padding: "6px 10px", borderRadius: 8 }}>
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
                                fontSize: 11, 
                                fontWeight: 700, 
                                background: "#1E293B", 
                                color: "white", 
                                padding: "6px 10px", 
                                borderRadius: 8, 
                                textDecoration: "none" 
                              }}
                            >
                              Portal CMT <ExternalLink size={11} />
                            </Link>
                          )}
                          {waNum && (
                            <a 
                              href={`https://wa.me/${waNum}?text=${encodeURIComponent(`Halo ${po.vendor_nama}, kami ingin menanyakan perkembangan pengerjaan PO ${po.noPo} (${po.model}) yang saat ini telah melewati batas estimasi target selesai (${fmtDate(po.target_selesai)}). Mohon update progres terbarunya. Terima kasih!`)}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ 
                                display: "inline-flex", 
                                alignItems: "center", 
                                justifyContent: "center",
                                gap: 4, 
                                fontSize: 11, 
                                fontWeight: 700, 
                                background: "#25D366", 
                                color: "white", 
                                padding: "6px 10px", 
                                borderRadius: 8, 
                                textDecoration: "none" 
                              }}
                            >
                              <MessageCircle size={12} /> Chat WA
                            </a>
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
              { fiIcon: "fi-sr-document", bg: "#EFF6FF", color: "#1D4ED8", label: "PO Aktif", val: data?.poAktif ?? 0, sub: "Sedang berjalan" },
              { fiIcon: "fi-sr-badge-check", bg: "#ECFDF5", color: "#059669", label: "PO Selesai", val: data?.poSelesai ?? 0, sub: "100% masuk gudang" },
              { 
                fiIcon: "fi-sr-time-past", 
                bg: totalPoTerlambat > 0 ? "#FEE2E2" : "#F1F5F9", 
                color: totalPoTerlambat > 0 ? "#DC2626" : "#64748B", 
                label: "PO Terlambat", 
                val: totalPoTerlambat, 
                sub: totalPoTerlambat > 0 ? "⚠️ Melebihi target" : "Semua tepat waktu",
                isAlert: totalPoTerlambat > 0
              },
              { fiIcon: "fi-sr-needle", bg: "#FEF3C7", color: "#D97706", label: "Total PCS", val: data?.totalPCS ?? 0, sub: "Volume terbit" },
              { fiIcon: "fi-sr-box-open", bg: "#DCFCE7", color: "#16A34A", label: "Di Gudang", val: data?.totalDiGudang ?? 0, sub: "Pcs tuntas" },
              { fiIcon: "fi-sr-users", bg: "#F5F3FF", color: "#7C3AED", label: "Vendor Aktif", val: vendorList.length, sub: "CMT & Alur" },
            ].map((item, i) => (
              <div 
                key={i} 
                className="dash-card" 
                style={{ 
                  background: item.isAlert ? "#FFF5F5" : "white", 
                  padding: "14px 16px", 
                  borderRadius: 14, 
                  border: item.isAlert ? "1.5px solid #FCA5A5" : "1px solid #E2E8F0", 
                  boxShadow: item.isAlert ? "0 2px 8px rgba(220,38,38,0.06)" : "0 2px 6px rgba(0,0,0,0.02)", 
                  transition: "all 0.2s" 
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: item.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <i className={`fi ${item.fiIcon}`} style={{ fontSize: 15, color: item.color }} />
                  </div>
                  {item.isAlert && (
                    <span style={{ fontSize: 9, fontWeight: 900, background: "#EF4444", color: "white", padding: "1px 6px", borderRadius: 4 }}>
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
            ))}
          </div>

          {/*  MAIN TWO-COLUMN  */}
          <div className="dash-content-row">

            {/* LEFT: PO Progress */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "white", borderRadius: 18, border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.03)" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ background: "#EFF6FF", padding: "6px 8px", borderRadius: 8, display: "flex" }}>
                    <i className="fi fi-sr-route" style={{ fontSize: 16, color: "#3B82F6" }} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", margin: 0 }}>Progress PO Produksi</h2>
                    <span style={{ fontSize: 11, color: "#94A3B8" }}>Status & pengerjaan setiap SPK / PO</span>
                  </div>
                </div>

                {/* Filter Tabs */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#F1F5F9", padding: "3px 4px", borderRadius: 8 }}>
                  <button 
                    onClick={() => setPoFilter("all")} 
                    style={{ 
                      border: "none", 
                      background: poFilter === "all" ? "white" : "transparent", 
                      color: poFilter === "all" ? "#0F172A" : "#64748B", 
                      fontSize: 11, 
                      fontWeight: 700, 
                      padding: "4px 10px", 
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
                      padding: "4px 10px", 
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
                      padding: "4px 10px", 
                      borderRadius: 6, 
                      cursor: "pointer" 
                    }}
                  >
                    Tepat Waktu ({poList.length - totalPoTerlambat})
                  </button>
                  <Link href="/peta-perjalanan" style={{ fontSize: 11, fontWeight: 700, color: "#3B82F6", textDecoration: "none", display: "flex", alignItems: "center", gap: 3, marginLeft: 8, padding: "4px 8px" }}>
                    Lihat Peta <ArrowRight size={12} />
                  </Link>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                {filteredPoList.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 40, color: "#94A3B8", fontSize: 13 }}>
                    <i className="fi fi-rr-document" style={{ fontSize: 32, display: "block", marginBottom: 8 }} />
                    {poFilter === "overdue" ? "Hebat! Tidak ada PO yang terlambat saat ini" : "Belum ada data PO produksi"}
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
                        padding: "14px 16px", 
                        border: isLate ? "1.5px solid #FCA5A5" : "1px solid #E2E8F0", 
                        borderLeft: isLate ? "5px solid #DC2626" : "1px solid #E2E8F0",
                        borderRadius: 12, 
                        background: isLate ? "#FFFDFD" : "#FAFAFA", 
                        transition: "all 0.2s" 
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 900, fontSize: 14, color: "#0F172A", fontFamily: "monospace" }}>{po.noPo}</span>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: stage.bg, color: stage.color }}>
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
                            <div style={{ fontSize: 11, marginTop: 2, color: isLate ? "#DC2626" : "#64748B", fontWeight: isLate ? 700 : 500 }}>
                              Target Selesai: {fmtDate(po.target_selesai)} {isLate ? `(Lewat ${po.overdueDays} hari)` : ""}
                            </div>
                          )}
                        </div>

                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontSize: 18, fontWeight: 900, color: "#0F172A" }}>{po.jumlahTerbit} <span style={{ fontSize: 11, color: "#94A3B8" }}>pcs</span></div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: isLate ? "#DC2626" : "#10B981" }}>
                            {po.totalDiGudang} di gudang ({po.sisaPcs} sisa)
                          </div>
                        </div>
                      </div>

                      {/* Progress bars */}
                      <div style={{ width: "100%", background: "#E2E8F0", height: 6, borderRadius: 3, overflow: "hidden", position: "relative" }}>
                        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${Math.min(po.pctGudang, 100)}%`, background: "#10B981", borderRadius: 3 }} />
                        <div style={{ position: "absolute", left: `${po.pctGudang}%`, top: 0, height: "100%", width: `${Math.min(po.pctDisetujui - po.pctGudang, 100)}%`, background: "#3B82F6", borderRadius: 3 }} />
                        <div style={{ position: "absolute", left: `${po.pctDisetujui}%`, top: 0, height: "100%", width: `${Math.min(po.pctCMT - po.pctDisetujui, 100)}%`, background: "#F59E0B", borderRadius: 3 }} />
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, flexWrap: "wrap", gap: 6 }}>
                        <div style={{ display: "flex", gap: 10, fontSize: 10, color: "#94A3B8" }}>
                          {po.totalDiGudang > 0 && <span style={{ color: "#10B981", fontWeight: 700 }}> {po.totalDiGudang} gudang</span>}
                          {po.totalDisetujui > 0 && <span style={{ color: "#3B82F6", fontWeight: 700 }}> {po.totalDisetujui} ACC</span>}
                          {po.totalDilaporkan > 0 && <span style={{ color: "#F59E0B", fontWeight: 700 }}> {po.totalDilaporkan} laporan</span>}
                          {po.totalWashing > 0 && <span style={{ color: "#06B6D4", fontWeight: 700 }}> {po.totalWashingDone}/{po.totalWashing} washing</span>}
                          <span>{po.pctGudang}% selesai</span>
                        </div>

                        {/* Quick action buttons per PO */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {po.vendorId && (
                            <Link 
                              href={`/cmt/${po.vendorId}`}
                              target="_blank"
                              style={{ 
                                fontSize: 10, 
                                fontWeight: 700, 
                                color: "#2563EB", 
                                background: "#EFF6FF", 
                                padding: "2px 8px", 
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
                                fontSize: 10, 
                                fontWeight: 700, 
                                color: "#059669", 
                                background: "#ECFDF5", 
                                padding: "2px 8px", 
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

            {/* RIGHT: Quick Actions + Vendor Aktif */}
            <div className="dash-vendor-col">

              {/* Quick Actions */}
              <div style={{ background: "white", borderRadius: 14, border: "1px solid #E2E8F0", padding: "14px 16px", flexShrink: 0, boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", marginBottom: 10 }}>Aksi Cepat</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    { href: "/buat-spk", label: "Buat PO / SPK Baru", bg: "#3B82F6", color: "white", icon: "fi-sr-document-signed" },
                    { href: "/dashboard-cmt", label: "Dashboard Vendor & Kinerja", bg: "#F8FAFC", color: "#0F172A", icon: "fi-sr-chart-line-up" },
                    { href: "/pemotongan-kain", label: "Pemotongan Kain", bg: "#F8FAFC", color: "#0F172A", icon: "fi-sr-scissors" },
                    { href: "/barcode-produksi", label: "Barcode Produksi", bg: "#F8FAFC", color: "#0F172A", icon: "fi-sr-qr-scan" },
                  ].map((item, i) => (
                    <Link key={i} href={item.href} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: item.bg, color: item.color, padding: "10px 14px", borderRadius: 10, fontWeight: 700, fontSize: 13, textDecoration: "none", border: item.bg === "#F8FAFC" ? "1px solid #E2E8F0" : "none", transition: "all 0.15s" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <i className={`fi ${item.icon}`} style={{ fontSize: 14 }} />
                        {item.label}
                      </div>
                      <ArrowRight size={14} />
                    </Link>
                  ))}
                </div>
              </div>

              {/* Vendor Aktif */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "white", borderRadius: 18, border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.03)" }}>
                <div style={{ padding: "14px 16px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
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
                <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
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
                          padding: "10px 12px", 
                          border: v.hasOverdue ? "1.5px solid #FCA5A5" : "1px solid #E2E8F0", 
                          borderRadius: 10, 
                          background: v.hasOverdue ? "#FFF5F5" : "white", 
                          transition: "all 0.2s" 
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
                              <div style={{ marginTop: 4 }}>
                                <span style={{ 
                                  fontSize: 10, 
                                  fontWeight: 800, 
                                  color: "#DC2626", 
                                  background: "#FEE2E2", 
                                  border: "1px solid #FCA5A5", 
                                  padding: "2px 6px", 
                                  borderRadius: 4,
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
                            <div style={{ fontSize: 16, fontWeight: 900, color: v.hasOverdue ? "#DC2626" : "#0F172A" }}>{v.jumlahPO}</div>
                            <div style={{ fontSize: 10, color: "#94A3B8" }}>PO aktif</div>
                          </div>
                        </div>

                        {/* Quick link to Vendor Portal & WA */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, marginTop: 6, paddingTop: 6, borderTop: "1px solid #F1F5F9" }}>
                          <Link 
                            href={`/cmt/${v.id}`}
                            target="_blank"
                            style={{ 
                              fontSize: 10, 
                              fontWeight: 700, 
                              color: "#2563EB", 
                              textDecoration: "none",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 2
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
                                fontSize: 10, 
                                fontWeight: 700, 
                                color: "#059669", 
                                textDecoration: "none",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 2,
                                marginLeft: 4
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
      </div>
    </>
  );
}
