"use client";
import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Package, Layers, Activity } from "lucide-react";

const JENIS_COLOR: Record<string, string> = { masuk: "success", keluar: "danger" };

function formatTgl(str: string) {
  if (!str) return "-";
  return new Date(str).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export default function GudangPage() {
  const [data, setData] = useState<{ stock: any[]; movements: any[] } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    fetch("/api/stock")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  // Real-time sync: auto-refresh when another admin makes a change
  useEffect(() => {
    const handler = () => fetchData();
    window.addEventListener("konveksi-sync", handler);
    return () => window.removeEventListener("konveksi-sync", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalStok = data?.stock?.reduce((s, r) => s + r.stok_saat_ini, 0) ?? 0;
  const masukMingguIni = data?.movements?.filter(m => m.jenis === "masuk" && new Date(m.tanggal) >= new Date(Date.now() - 7 * 86400000))?.reduce((s, m) => s + m.jumlah, 0) ?? 0;
  const keluarMingguIni = data?.movements?.filter(m => m.jenis === "keluar" && new Date(m.tanggal) >= new Date(Date.now() - 7 * 86400000))?.reduce((s, m) => s + m.jumlah, 0) ?? 0;

  return (
    <>
      <style>{`
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 99px; }
        .table-row-hover:hover { background: #F8FAFC; }
      `}</style>
      
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#F1F5F9", overflow: "hidden" }}>
        
        {/* Fixed Header */}
        <div style={{ padding: "24px 32px", background: "white", borderBottom: "1px solid #E2E8F0", flexShrink: 0 }}>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", marginBottom: 4 }}>Gudang & Stok</h1>
          <p style={{ fontSize: 13, color: "#64748B" }}>Ringkasan barang jadi per kategori, serta riwayat masuk/keluar harian.</p>
        </div>

        {/* Top Summary Cards */}
        <div style={{ padding: "20px 32px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, flexShrink: 0 }}>
          <div style={{ background: "white", borderRadius: 16, border: "1px solid #E2E8F0", padding: "20px", display: "flex", alignItems: "center", gap: 16, boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#DBEAFE", color: "#1D4ED8", display: "flex", alignItems: "center", justifyContent: "center" }}><Package size={24} /></div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Total Stok Semua</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", lineHeight: 1 }}>{totalStok} <span style={{ fontSize: 14, color: "#94A3B8" }}>pcs</span></div>
            </div>
          </div>
          <div style={{ background: "white", borderRadius: 16, border: "1px solid #E2E8F0", padding: "20px", display: "flex", alignItems: "center", gap: 16, boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#DCFCE7", color: "#047857", display: "flex", alignItems: "center", justifyContent: "center" }}><TrendingUp size={24} /></div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Masuk (7 Hari Terakhir)</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#10B981", lineHeight: 1 }}>+{masukMingguIni} <span style={{ fontSize: 14, color: "#94A3B8" }}>pcs</span></div>
            </div>
          </div>
          <div style={{ background: "white", borderRadius: 16, border: "1px solid #E2E8F0", padding: "20px", display: "flex", alignItems: "center", gap: 16, boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#FEE2E2", color: "#B91C1C", display: "flex", alignItems: "center", justifyContent: "center" }}><TrendingDown size={24} /></div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Keluar (7 Hari Terakhir)</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#EF4444", lineHeight: 1 }}>-{keluarMingguIni} <span style={{ fontSize: 14, color: "#94A3B8" }}>pcs</span></div>
            </div>
          </div>
        </div>

        {/* Main Content: Split Two Tables */}
        <div style={{ display: "flex", gap: 24, flex: 1, overflow: "hidden", padding: "0 32px 24px" }}>
          
          {/* Left Table: Kategori Stok */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "white", borderRadius: 20, border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", alignItems: "center", gap: 10 }}>
              <Layers size={18} color="#3B82F6" />
              <h2 style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", margin: 0 }}>Stok Per Kategori</h2>
            </div>
            <div style={{ flex: 1, overflow: "auto" }}>
              {loading ? (
                <div style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}> Memuat stok...</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                    <tr style={{ background: "#F8FAFC" }}>
                      <th style={{ padding: "12px 20px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", borderBottom: "2px solid #E2E8F0" }}>Kategori Jeans</th>
                      <th style={{ padding: "12px 20px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", borderBottom: "2px solid #E2E8F0" }}>Stok Tersedia</th>
                      <th style={{ padding: "12px 20px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", borderBottom: "2px solid #E2E8F0" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.stock?.map(s => {
                      const isDanger = s.stok_saat_ini === 0;
                      const isWarning = s.stok_saat_ini > 0 && s.stok_saat_ini < 20;
                      const statusColor = isDanger ? "#EF4444" : isWarning ? "#F59E0B" : "#10B981";
                      const statusBg = isDanger ? "#FEF2F2" : isWarning ? "#FEF3C7" : "#DCFCE7";
                      const statusLabel = isDanger ? "Habis" : isWarning ? "Hampir Habis" : "Aman";
                      return (
                        <tr key={s.id} className="table-row-hover" style={{ borderBottom: "1px solid #F1F5F9" }}>
                          <td style={{ padding: "14px 20px", fontWeight: 700, color: "#1E293B", fontSize: 13 }}>{s.kategori}</td>
                          <td style={{ padding: "14px 20px", fontWeight: 900, color: isDanger ? "#EF4444" : "#0F172A", fontSize: 15 }}>{s.stok_saat_ini}</td>
                          <td style={{ padding: "14px 20px" }}>
                            <span style={{ background: statusBg, color: statusColor, padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 800 }}>{statusLabel}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Right Table: Riwayat Pergerakan */}
          <div style={{ flex: 1.5, display: "flex", flexDirection: "column", background: "white", borderRadius: 20, border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", alignItems: "center", gap: 10 }}>
              <Activity size={18} color="#10B981" />
              <h2 style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", margin: 0 }}>Riwayat Pergerakan Barang</h2>
            </div>
            <div style={{ flex: 1, overflow: "auto" }}>
              {loading ? (
                <div style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}> Memuat riwayat...</div>
              ) : !data?.movements?.length ? (
                <div style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>Belum ada pergerakan stok dicatat.</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                    <tr style={{ background: "#F8FAFC" }}>
                      <th style={{ padding: "12px 20px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", borderBottom: "2px solid #E2E8F0" }}>Tanggal</th>
                      <th style={{ padding: "12px 20px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", borderBottom: "2px solid #E2E8F0" }}>Tipe & Kategori</th>
                      <th style={{ padding: "12px 20px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", borderBottom: "2px solid #E2E8F0" }}>Jumlah</th>
                      <th style={{ padding: "12px 20px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", borderBottom: "2px solid #E2E8F0" }}>Keterangan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.movements?.map(m => {
                      const isMasuk = m.jenis === "masuk";
                      return (
                        <tr key={m.id} className="table-row-hover" style={{ borderBottom: "1px solid #F1F5F9" }}>
                          <td style={{ padding: "14px 20px", fontSize: 12, fontWeight: 600, color: "#475569" }}>{formatTgl(m.tanggal)}</td>
                          <td style={{ padding: "14px 20px" }}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 8px", borderRadius: 6, background: isMasuk ? "#DCFCE7" : "#FEE2E2", color: isMasuk ? "#047857" : "#B91C1C", fontSize: 10, fontWeight: 800, textTransform: "uppercase", marginBottom: 4 }}>
                              {isMasuk ? "Masuk" : "Keluar"}
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#1E293B" }}>{m.kategori}</div>
                          </td>
                          <td style={{ padding: "14px 20px", fontSize: 15, fontWeight: 900, color: isMasuk ? "#10B981" : "#EF4444" }}>
                            {isMasuk ? "+" : "-"}{m.jumlah}
                          </td>
                          <td style={{ padding: "14px 20px", fontSize: 12, color: "#64748B" }}>{m.keterangan || "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
          
        </div>
      </div>
    </>
  );
}
