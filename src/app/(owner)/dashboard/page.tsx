"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { RefreshCw, ArrowRight } from "lucide-react";
import Link from "next/link";

function fmtWaktu(d: Date) {
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function fmtDate(str?: string) {
  if (!str) return "–";
  return new Date(str).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

const STAGE_CFG: Record<string, { label: string; bg: string; color: string }> = {
  "selesai":        { label: "Selesai",       bg: "#D1FAE5", color: "#065F46" },
  "selesai-washing":{ label: "Selesai Washing",bg: "#CFFAFE", color: "#0E7490" },
  "washing":        { label: "Washing",        bg: "#E0F2FE", color: "#0369A1" },
  "siap-tarik":     { label: "Siap Tarik",     bg: "#DCFCE7", color: "#166534" },
  "dijahit":        { label: "Dijahit",        bg: "#FEF3C7", color: "#92400E" },
  "menunggu":       { label: "Menunggu",       bg: "#F1F5F9", color: "#64748B" },
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
  const prevRef = useRef<string>("");

  useEffect(() => {
    const el = document.querySelector(".app-content") as HTMLElement;
    if (el) { el.style.overflow = "hidden"; el.style.padding = "0"; el.style.height = "100vh"; }
    return () => { if (el) { el.style.overflow = ""; el.style.padding = ""; el.style.height = ""; } };
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard", { cache: "no-store" });
      const d = await res.json();
      const ser = JSON.stringify(d);
      if (ser !== prevRef.current) { setPulse(true); setTimeout(() => setPulse(false), 800); prevRef.current = ser; }
      setData(d);
      setLastUpdated(new Date());
      setLoading(false);
    } catch {}
  }, []);

  useEffect(() => { load(); const id = setInterval(load, 5000); return () => clearInterval(id); }, [load]);

  // Real-time sync: instant refresh when another admin makes a change
  useEffect(() => {
    const handler = () => load();
    window.addEventListener("konveksi-sync", handler);
    return () => window.removeEventListener("konveksi-sync", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#F1F5F9" }}>
      <div style={{ textAlign: "center", color: "#94A3B8" }}>
        <RefreshCw size={32} style={{ animation: "spin 1s linear infinite", display: "block", margin: "0 auto 12px" }} />
        <p style={{ fontSize: 15, fontWeight: 600 }}>Memuat Dashboard...</p>
      </div>
    </div>
  );

  const poList: any[] = data?.poList || [];
  const vendorList: any[] = data?.vendorList || [];

  return (
    <>
      <style>{`
        @keyframes pulseSoft { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 99px; }
        .dash-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08)!important; transform: translateY(-1px); }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#F1F5F9", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "20px 28px", background: "white", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: "#0F172A", marginBottom: 2 }}>Dashboard Produksi</h1>
            <p style={{ fontSize: 12, color: "#64748B" }}>Ringkasan aktivitas real-time konveksi hari ini</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, background: "#DCFCE7", color: "#065F46", fontSize: 11, fontWeight: 800, padding: "4px 12px", borderRadius: 99 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981", display: "inline-block", animation: "pulseSoft 2s infinite" }} /> LIVE
            </span>
            <div style={{ fontSize: 11, color: "#94A3B8", display: "flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
              <RefreshCw size={11} style={{ animation: pulse ? "spin 0.5s linear" : "none" }} />
              {lastUpdated ? fmtWaktu(lastUpdated) : "--:--:--"}
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "20px 28px", gap: 20 }}>

          {/* ── STATS ROW ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, flexShrink: 0 }}>
            {[
              { fiIcon: "fi-sr-document", bg: "#EFF6FF", color: "#1D4ED8", label: "PO Aktif", val: data?.poAktif ?? 0 },
              { fiIcon: "fi-sr-badge-check", bg: "#ECFDF5", color: "#059669", label: "PO Selesai", val: data?.poSelesai ?? 0 },
              { fiIcon: "fi-sr-needle", bg: "#FEF3C7", color: "#D97706", label: "Total PCS", val: data?.totalPCS ?? 0 },
              { fiIcon: "fi-sr-box-open", bg: "#DCFCE7", color: "#16A34A", label: "Di Gudang", val: data?.totalDiGudang ?? 0 },
              { fiIcon: "fi-sr-users", bg: "#F5F3FF", color: "#7C3AED", label: "Vendor Aktif", val: vendorList.length },
            ].map((item, i) => (
              <div key={i} className="dash-card" style={{ background: "white", padding: "16px 18px", borderRadius: 14, border: "1px solid #E2E8F0", boxShadow: "0 2px 6px rgba(0,0,0,0.02)", transition: "all 0.2s" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: item.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <i className={`fi ${item.fiIcon}`} style={{ fontSize: 16, color: item.color }} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>{item.label}</div>
                </div>
                <div style={{ fontSize: 26, fontWeight: 900, color: "#0F172A" }}>{item.val}</div>
              </div>
            ))}
          </div>

          {/* ── MAIN TWO-COLUMN ── */}
          <div style={{ display: "flex", gap: 20, flex: 1, overflow: "hidden" }}>

            {/* LEFT: PO Progress */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "white", borderRadius: 18, border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.03)" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ background: "#EFF6FF", padding: "6px 8px", borderRadius: 8, display: "flex" }}>
                    <i className="fi fi-sr-route" style={{ fontSize: 16, color: "#3B82F6" }} />
                  </div>
                  <h2 style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", margin: 0 }}>Progress PO Produksi</h2>
                </div>
                <Link href="/peta-perjalanan" style={{ fontSize: 12, fontWeight: 700, color: "#3B82F6", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
                  Lihat Peta <ArrowRight size={13} />
                </Link>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                {poList.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 40, color: "#94A3B8", fontSize: 13 }}>
                    <i className="fi fi-rr-document" style={{ fontSize: 32, display: "block", marginBottom: 8 }} />
                    Belum ada PO produksi
                  </div>
                ) : poList.map((po: any) => {
                  const stage = STAGE_CFG[po.stage] || STAGE_CFG["menunggu"];
                  return (
                    <div key={po.id} className="dash-card" style={{ padding: "14px 16px", border: "1px solid #E2E8F0", borderRadius: 12, background: "#FAFAFA", transition: "all 0.2s", cursor: "pointer" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                            <span style={{ fontWeight: 900, fontSize: 14, color: "#0F172A", fontFamily: "monospace" }}>{po.noPo}</span>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: stage.bg, color: stage.color }}>{stage.label}</span>
                          </div>
                          <div style={{ fontSize: 12, color: "#64748B" }}>{po.model} · {po.vendor_nama} · {fmtDate(po.tanggalTerbit)}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 18, fontWeight: 900, color: "#0F172A" }}>{po.jumlahTerbit} <span style={{ fontSize: 11, color: "#94A3B8" }}>pcs</span></div>
                          <div style={{ fontSize: 10, color: "#94A3B8" }}>{po.totalDiGudang} di gudang</div>
                        </div>
                      </div>

                      {/* Progress bars */}
                      <div style={{ width: "100%", background: "#E2E8F0", height: 6, borderRadius: 3, overflow: "hidden", position: "relative" }}>
                        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${Math.min(po.pctGudang, 100)}%`, background: "#10B981", borderRadius: 3 }} />
                        <div style={{ position: "absolute", left: `${po.pctGudang}%`, top: 0, height: "100%", width: `${Math.min(po.pctDisetujui - po.pctGudang, 100)}%`, background: "#3B82F6", borderRadius: 3 }} />
                        <div style={{ position: "absolute", left: `${po.pctDisetujui}%`, top: 0, height: "100%", width: `${Math.min(po.pctCMT - po.pctDisetujui, 100)}%`, background: "#F59E0B", borderRadius: 3 }} />
                      </div>
                      <div style={{ display: "flex", gap: 10, marginTop: 5, fontSize: 10, color: "#94A3B8" }}>
                        {po.totalDiGudang > 0 && <span style={{ color: "#10B981", fontWeight: 700 }}>✓ {po.totalDiGudang} gudang</span>}
                        {po.totalDisetujui > 0 && <span style={{ color: "#3B82F6", fontWeight: 700 }}>✓ {po.totalDisetujui} ACC</span>}
                        {po.totalDilaporkan > 0 && <span style={{ color: "#F59E0B", fontWeight: 700 }}>⏳ {po.totalDilaporkan} laporan</span>}
                        {po.totalWashing > 0 && <span style={{ color: "#06B6D4", fontWeight: 700 }}>🫧 {po.totalWashingDone}/{po.totalWashing} washing</span>}
                        <span style={{ marginLeft: "auto" }}>{po.pctGudang}% selesai</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RIGHT: Vendor Aktif + Quick Actions */}
            <div style={{ width: "32%", minWidth: 280, display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Quick Actions */}
              <div style={{ background: "white", borderRadius: 14, border: "1px solid #E2E8F0", padding: "14px 16px", flexShrink: 0, boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", marginBottom: 10 }}>Aksi Cepat</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    { href: "/buat-spk", label: "Buat PO / SPK Baru", bg: "#3B82F6", color: "white", icon: "fi-sr-document-signed" },
                    { href: "/dashboard-cmt", label: "Dashboard Vendor", bg: "#F8FAFC", color: "#0F172A", icon: "fi-sr-chart-line-up" },
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
                    <h2 style={{ fontSize: 14, fontWeight: 800, color: "#0F172A", margin: 0 }}>Vendor Aktif</h2>
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
                    return (
                      <div key={v.id} className="dash-card" style={{ padding: "10px 12px", border: "1px solid #E2E8F0", borderRadius: 10, background: "white", transition: "all 0.2s" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 13, color: "#0F172A", marginBottom: 2 }}>{v.nama}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 20, background: tc.bg, color: tc.color }}>{v.tipe}</span>
                              <span style={{ fontSize: 11, color: "#94A3B8" }}>{v.jenis_pekerjaan || "–"}</span>
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 16, fontWeight: 900, color: "#0F172A" }}>{v.jumlahPO}</div>
                            <div style={{ fontSize: 10, color: "#94A3B8" }}>PO aktif</div>
                          </div>
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
