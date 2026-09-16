"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { LayoutDashboard, Package, TrendingUp, ChevronRight, RefreshCw, Activity, ArrowRight } from "lucide-react";
import Link from "next/link";

function fmtWaktu(d: Date) {
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

const statusColor: Record<string, string> = {
  "dalam-proses": "text-blue-700 bg-blue-100", "bahan-mentah": "text-amber-700 bg-amber-100",
  "gudang": "text-emerald-700 bg-emerald-100", "reject": "text-red-700 bg-red-100",
};
const statusLabel: Record<string, string> = {
  "dalam-proses": "Dalam Proses", "bahan-mentah": "Bahan Mentah",
  "gudang": "Di Gudang", "reject": "Reject",
};

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [pulse, setPulse] = useState(false);
  const prevDataRef = useRef<string>("");
  const POLL_MS = 5000;

  // Lock parent scroll
  useEffect(() => {
    const el = document.querySelector(".app-content") as HTMLElement;
    if (el) {
      el.style.overflow = "hidden";
      el.style.padding = "0";
      el.style.height = "100vh";
    }
    return () => {
      if (el) { el.style.overflow = ""; el.style.padding = ""; el.style.height = ""; }
    };
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard", { cache: "no-store" });
      const d = await res.json();
      const serialized = JSON.stringify(d);
      if (serialized !== prevDataRef.current) {
        setPulse(true);
        setTimeout(() => setPulse(false), 800);
        prevDataRef.current = serialized;
      }
      setData(d);
      setLastUpdated(new Date());
      setLoading(false);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#F1F5F9" }}>
      <div style={{ textAlign: "center", color: "#94A3B8" }}>
        <RefreshCw size={32} className="animate-spin mb-4 mx-auto" />
        <p style={{ fontSize: 16, fontWeight: 600 }}>Memuat Dashboard...</p>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes pulseSoft { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 99px; }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#F1F5F9", overflow: "hidden" }}>
        
        {/* Header */}
        <div style={{ padding: "24px 32px", background: "white", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexShrink: 0 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", marginBottom: 4 }}>Dashboard Produksi</h1>
            <p style={{ fontSize: 13, color: "#64748B" }}>Ringkasan aktivitas real-time konveksi hari ini</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, background: "#DCFCE7", color: "#065F46", fontSize: 11, fontWeight: 800, padding: "4px 12px", borderRadius: 99 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981", display: "inline-block", animation: "pulseSoft 2s infinite" }} />
              LIVE
            </span>
            <div style={{ fontSize: 11, color: "#94A3B8", display: "flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
              <RefreshCw size={11} style={{ animation: pulse ? "spin 0.5s linear" : "none" }} />
              {lastUpdated ? fmtWaktu(lastUpdated) : "--:--:--"}
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "24px 32px", gap: 24 }}>
          
          {/* Top Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, flexShrink: 0 }}>
            <div style={{ background: "white", padding: 20, borderRadius: 16, border: "1px solid #E2E8F0", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "#EFF6FF", color: "#3B82F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Package size={20} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#64748B" }}>Batch Aktif</div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#0F172A" }}>{data?.batchAktif ?? 0}</div>
            </div>
            
            <div style={{ background: "white", padding: 20, borderRadius: 16, border: "1px solid #E2E8F0", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "#ECFDF5", color: "#10B981", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <LayoutDashboard size={20} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#64748B" }}>Stok di Gudang</div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#0F172A" }}>{data?.totalStok ?? 0}</div>
            </div>
            
            <div style={{ background: "white", padding: 20, borderRadius: 16, border: "1px solid #E2E8F0", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "#FFFBEB", color: "#D97706", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <TrendingUp size={20} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#64748B" }}>Terlaris (7 Hari)</div>
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#0F172A", marginTop: 8 }}>{data?.terlaris ?? "–"}</div>
            </div>
            
            {/* Quick Actions in a tight format */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Link href="/buat-spk" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", background: "#3B82F6", color: "white", padding: "0 16px", borderRadius: 12, fontWeight: 700, fontSize: 13, textDecoration: "none", boxShadow: "0 4px 12px rgba(59,130,246,0.25)", transition: "all 0.2s" }}>
                <span>+ Buat SPK Baru</span>
                <ArrowRight size={16} />
              </Link>
              <Link href="/gudang" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", background: "white", color: "#0F172A", padding: "0 16px", borderRadius: 12, border: "1px solid #E2E8F0", fontWeight: 700, fontSize: 13, textDecoration: "none", transition: "all 0.2s" }}>
                <span>Cek Stok Gudang</span>
                <ArrowRight size={16} color="#94A3B8" />
              </Link>
            </div>
          </div>

          {/* Main Content Area (Two Columns, Scrollable) */}
          <div style={{ display: "flex", gap: 24, flex: 1, overflow: "hidden" }}>
            
            {/* Left Col: Batches */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "white", borderRadius: 20, border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ background: "#EFF6FF", color: "#3B82F6", padding: 6, borderRadius: 8 }}>
                    <Activity size={18} />
                  </div>
                  <h2 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: 0 }}>Progress Batch Kain</h2>
                </div>
                <Link href="/peta-perjalanan" style={{ fontSize: 12, fontWeight: 700, color: "#3B82F6", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
                  Lihat Peta <ChevronRight size={14} />
                </Link>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
                {data?.batches?.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 40, color: "#94A3B8", fontSize: 13 }}>Belum ada batch aktif</div>
                ) : (
                  data?.batches?.map((b: any) => (
                    <div key={b.id} style={{ padding: 16, border: "1px solid #E2E8F0", borderRadius: 12, background: b.status === "dalam-proses" ? "#FAFAFA" : "white" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                        <div>
                          <div style={{ fontWeight: 900, fontSize: 15, color: "#0F172A", marginBottom: 2 }}>{b.kode_batch}</div>
                          <div style={{ fontSize: 12, color: "#64748B" }}>{b.jenis_kain} &bull; {b.jumlah_pcs ?? b.jumlah_meter} {b.jumlah_pcs ? "pcs" : "m"}</div>
                        </div>
                        <div style={{ padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 800, background: b.status === "dalam-proses" ? "#DBEAFE" : "#D1FAE5", color: b.status === "dalam-proses" ? "#1E40AF" : "#065F46" }}>
                          {statusLabel[b.status] ?? b.status}
                        </div>
                      </div>
                      
                      {b.steps?.length > 0 && (
                        <div>
                          <div style={{ display: "flex", gap: 3, marginBottom: 8 }}>
                            {b.steps.map((s: any, i: number) => (
                              <div key={i} style={{ flex: 1, height: 4, borderRadius: 99, background: s.status === "selesai" ? "#10B981" : s.status === "berjalan" ? "#3B82F6" : "#E2E8F0" }} />
                            ))}
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11 }}>
                            <span style={{ color: "#64748B", fontWeight: 600 }}>{b.steps.filter((s: any) => s.status === "selesai").length}/{b.steps.length} step</span>
                            {b.jenis_pekerjaan_aktif && (
                              <span style={{ color: "#3B82F6", fontWeight: 700 }}>⚙️ {b.jenis_pekerjaan_aktif}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right Col: SPK Aktif */}
            <div style={{ width: "35%", minWidth: 320, display: "flex", flexDirection: "column", background: "white", borderRadius: 20, border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ background: "#FEF3C7", color: "#D97706", padding: 6, borderRadius: 8 }}>
                    <LayoutDashboard size={18} />
                  </div>
                  <h2 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: 0 }}>Vendor Aktif</h2>
                </div>
                <Link href="/daftar-spk" style={{ fontSize: 12, fontWeight: 700, color: "#3B82F6", textDecoration: "none" }}>Semua</Link>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
                {data?.spkList?.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 40, color: "#94A3B8", fontSize: 13 }}>Tidak ada SPK aktif</div>
                ) : (
                  data?.spkList?.map((s: any) => (
                    <div key={s.id} style={{ padding: 14, border: "1px solid #E2E8F0", borderRadius: 12, background: "white", position: "relative", overflow: "hidden" }}>
                      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: "#3B82F6" }} />
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <div style={{ fontWeight: 800, fontSize: 14, color: "#0F172A" }}>{s.kode_batch}</div>
                        <span style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700 }}>{s.jenis_pekerjaan}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "#64748B", marginBottom: 8 }}>{s.jenis_kain}</div>
                      {s.vendor_nama && (
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", background: "#F1F5F9", borderRadius: 6, fontSize: 11, fontWeight: 600, color: "#334155" }}>
                          📍 {s.vendor_nama}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
            
          </div>
        </div>
      </div>
    </>
  );
}
