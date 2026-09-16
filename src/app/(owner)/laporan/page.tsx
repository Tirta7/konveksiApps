"use client";
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { BarChart2, TrendingUp, Store, ShoppingBag } from "lucide-react";

const COLORS = ["#3B82F6","#10B981","#F59E0B","#EF4444","#8B5CF6","#EC4899","#14B8A6","#F97316"];

export default function LaporanPage() {
  const [data, setData] = useState<any[]>([]);
  const [periode, setPeriode] = useState<"minggu" | "bulan">("minggu");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/laporan?periode=${periode}`).then(r => r.json()).then(d => { setData(d); setLoading(false); });
  }, [periode]);

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
      `}</style>
      
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#F1F5F9", overflow: "hidden" }}>
        
        {/* Fixed Header */}
        <div style={{ padding: "24px 32px", background: "white", borderBottom: "1px solid #E2E8F0", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", marginBottom: 4 }}>Laporan Penjualan</h1>
            <p style={{ fontSize: 13, color: "#64748B" }}>Analisis penjualan kategori jeans untuk perencanaan produksi</p>
          </div>
          <div style={{ display: "flex", background: "#F1F5F9", padding: 4, borderRadius: 12 }}>
            <button style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 800, border: "none", cursor: "pointer", transition: "all 0.2s", background: periode === "minggu" ? "white" : "transparent", color: periode === "minggu" ? "#0F172A" : "#64748B", boxShadow: periode === "minggu" ? "0 2px 4px rgba(0,0,0,0.05)" : "none" }} onClick={() => setPeriode("minggu")}>Minggu Ini</button>
            <button style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 800, border: "none", cursor: "pointer", transition: "all 0.2s", background: periode === "bulan" ? "white" : "transparent", color: periode === "bulan" ? "#0F172A" : "#64748B", boxShadow: periode === "bulan" ? "0 2px 4px rgba(0,0,0,0.05)" : "none" }} onClick={() => setPeriode("bulan")}>Bulan Ini</button>
          </div>
        </div>

        {/* Scrollable Area */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
          
          <div style={{ display: "flex", gap: 24, marginBottom: 24, flexWrap: "wrap" }}>
            {/* Stat Cards */}
            <div style={{ flex: 1, minWidth: 200, background: "white", borderRadius: 24, padding: 24, border: "1px solid #E2E8F0", boxShadow: "0 4px 20px rgba(0,0,0,0.02)", display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#F3F4F6", color: "#4B5563", display: "flex", alignItems: "center", justifyContent: "center" }}><TrendingUp size={28} /></div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Total Penjualan</div>
                <div style={{ fontSize: 32, fontWeight: 900, color: "#1F2937", lineHeight: 1 }}>{totalAll} <span style={{fontSize: 14, color:"#94A3B8"}}>pcs</span></div>
              </div>
            </div>
            
            <div style={{ flex: 1, minWidth: 200, background: "white", borderRadius: 24, padding: 24, border: "1px solid #E2E8F0", boxShadow: "0 4px 20px rgba(0,0,0,0.02)", display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#EFF6FF", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center" }}><ShoppingBag size={28} /></div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>PO Online</div>
                <div style={{ fontSize: 32, fontWeight: 900, color: "#2563EB", lineHeight: 1 }}>{totalPO} <span style={{fontSize: 14, color:"#94A3B8"}}>pcs</span></div>
              </div>
            </div>
            
            <div style={{ flex: 1, minWidth: 200, background: "white", borderRadius: 24, padding: 24, border: "1px solid #E2E8F0", boxShadow: "0 4px 20px rgba(0,0,0,0.02)", display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}><Store size={28} /></div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Retail Offline</div>
                <div style={{ fontSize: 32, fontWeight: 900, color: "#059669", lineHeight: 1 }}>{totalRetail} <span style={{fontSize: 14, color:"#94A3B8"}}>pcs</span></div>
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
                {loading ? (
                  <div style={{ height: 320, display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", fontWeight: 600 }}>⏳ Memuat grafik...</div>
                ) : data.length === 0 ? (
                  <div style={{ height: 320, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#94A3B8" }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
                    <div style={{ fontWeight: 800, color: "#0F172A" }}>Belum ada data penjualan</div>
                    <div style={{ fontSize: 13, marginTop: 4 }}>Data akan muncul di sini setelah ada PO / retail</div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                      <XAxis dataKey="kategori" tick={{ fontSize: 12, fill: "#64748B", fontWeight: 600 }} angle={-25} textAnchor="end" interval={0} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: "#64748B", fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <Tooltip 
                        formatter={(v: any, name: any) => [`${v} pcs`, name === "total_po" ? "PO Online" : name === "total_retail" ? "Retail Offline" : "Total"]}
                        labelStyle={{ fontWeight: 800, color: "#0F172A", marginBottom: 4 }} 
                        contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 10px 30px rgba(0,0,0,0.1)", padding: "12px 16px" }} 
                      />
                      <Bar dataKey="total_po" name="PO Online" stackId="a" fill="#3B82F6" radius={[0,0,0,0]} barSize={32} />
                      <Bar dataKey="total_retail" name="Retail" stackId="a" fill="#10B981" radius={[8,8,0,0]} barSize={32} />
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
                {loading ? (
                  <div style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontWeight: 600 }}>⏳ Memuat peringkat...</div>
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
                            {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
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
        </div>

      </div>
    </>
  );
}
