"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Filter, AlertTriangle, CheckCircle, Package } from "lucide-react";

function fmtDT(str?: string) {
  if (!str) return "-";
  return new Date(str).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export default function LaporanSPKListPage() {
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("semua");
  const [search, setSearch] = useState("");
  const router = useRouter();

  useEffect(() => {
    fetch("/api/spk").then(r => r.json()).then(d => { setBatches(d); setLoading(false); });
  }, []);

  const filtered = batches.filter(b => {
    const matchSearch = !search || b.kode_batch.toLowerCase().includes(search.toLowerCase()) || b.jenis_kain.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    
    if (filter === "selesai") return b.route_selesai && !b.is_retur;
    if (filter === "proses") return !b.route_selesai && b.status !== "reject" && !b.is_retur;
    if (filter === "reject") return b.status === "reject";
    if (filter === "retur") return b.is_retur === true;
    return true;
  });

  const totalCacat = (b: any) => (b.steps ?? []).reduce((s: number, st: any) => s + (st.total_cacat ?? 0), 0);

  return (
    <>
      <style>{`
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 99px; }
        .laporan-card { transition: all 0.2s; border: 1px solid #E2E8F0; }
        .laporan-card:hover { border-color: #3B82F6; box-shadow: 0 4px 16px rgba(59,130,246,0.1); transform: translateY(-1px); }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#F1F5F9", overflow: "hidden" }}>
        
        {/* Fixed Header */}
        <div style={{ padding: "24px 32px", background: "white", borderBottom: "1px solid #E2E8F0", flexShrink: 0 }}>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", marginBottom: 4 }}>Laporan SPK</h1>
          <p style={{ fontSize: 13, color: "#64748B" }}>Rekapitulasi produksi, tracking defect (cacat), dan hasil persentase keberhasilan per batch</p>
        </div>

        {/* Action Bar */}
        <div style={{ padding: "16px 32px", background: "white", borderBottom: "1px solid #E2E8F0", flexShrink: 0, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240, display: "flex", alignItems: "center", background: "#F8FAFC", border: "1px solid #CBD5E1", borderRadius: 10, padding: "0 14px", transition: "border-color 0.2s" }} onFocus={e => e.currentTarget.style.borderColor = "#3B82F6"} onBlur={e => e.currentTarget.style.borderColor = "#CBD5E1"}>
            <Search size={18} color="#94A3B8" />
            <input 
              style={{ flex: 1, padding: "10px 12px", background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#0F172A" }} 
              placeholder="Cari kode batch atau kain..." 
              value={search} onChange={e => setSearch(e.target.value)} 
            />
          </div>

          <div style={{ display: "flex", gap: 8, background: "#F1F5F9", padding: 4, borderRadius: 12 }}>
            {[
              { key: "semua", label: "Semua", icon: null },
              { key: "selesai", label: "✅ Selesai", icon: null },
              { key: "proses", label: "⚙️ Proses", icon: null },
              { key: "reject", label: "❌ Reject", icon: null },
              { key: "retur", label: "🔄 Retur", icon: null },
            ].map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", transition: "all 0.2s", 
                  background: filter === f.key ? "white" : "transparent",
                  color: filter === f.key ? "#0F172A" : "#64748B",
                  boxShadow: filter === f.key ? "0 2px 4px rgba(0,0,0,0.05)" : "none"
                }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable List */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
          
          {loading ? (
            <div style={{ padding: 60, textAlign: "center", color: "#94A3B8", fontWeight: 600 }}>⏳ Memuat Laporan...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 60, textAlign: "center", background: "white", borderRadius: 20, border: "1px solid #E2E8F0" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", marginBottom: 6 }}>Laporan Kosong</div>
              <div style={{ fontSize: 13, color: "#64748B" }}>Tidak ada batch SPK yang sesuai dengan filter Anda.</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(600px, 1fr))", gap: 16, alignItems: "start" }}>
              {filtered.map((b: any) => {
                const cacat = totalCacat(b);
                const jumlahAwal = b.jumlah_pcs ?? 0;
                const final = Math.max(0, jumlahAwal - cacat);
                const pct = jumlahAwal > 0 ? Math.round((final / jumlahAwal) * 100) : 100;
                
                const isReject = b.status === "reject";
                const isSelesai = b.route_selesai;
                
                const statusColor = isReject ? "#EF4444" : isSelesai ? "#10B981" : "#F59E0B";
                const statusBg = isReject ? "#FEF2F2" : isSelesai ? "#DCFCE7" : "#FEF3C7";
                const statusLabel = isReject ? "Reject" : isSelesai ? "Selesai" : "Proses";
                
                const progressColor = pct === 100 ? "#10B981" : pct >= 95 ? "#F59E0B" : "#EF4444";

                return (
                  <div key={b.id} className="laporan-card" onClick={() => router.push(`/laporan-spk/${b.id}`)} style={{ background: "white", borderRadius: 20, overflow: "hidden", cursor: "pointer", position: "relative" }}>
                    {/* Left Accent Bar */}
                    <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: cacat > 0 ? "#EF4444" : "#10B981" }} />
                    
                    <div style={{ padding: "20px 24px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                        
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                            <span style={{ fontWeight: 900, fontSize: 16, color: "#0F172A", fontFamily: "monospace" }}>{b.kode_batch}</span>
                            <span style={{ background: statusBg, color: statusColor, borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>{statusLabel}</span>
                            {b.is_retur && <span style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>RETUR</span>}
                          </div>
                          <div style={{ fontSize: 13, color: "#64748B", fontWeight: 600 }}>{b.jenis_kain} &bull; Dibuat: {fmtDT(b.created_at)}</div>
                        </div>

                        <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>Yield:</span>
                            <span style={{ fontSize: 24, fontWeight: 900, color: progressColor, lineHeight: 1 }}>{pct}%</span>
                          </div>
                          <div style={{ fontSize: 12, color: "#94A3B8", fontWeight: 600, marginTop: 4 }}>
                            {final} / {jumlahAwal} pcs
                          </div>
                        </div>

                      </div>

                      <div style={{ display: "flex", gap: 16, padding: "12px 16px", background: "#F8FAFC", borderRadius: 12, border: "1px solid #F1F5F9" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, color: "#64748B", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Total Step Vendor</div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: "#334155" }}>{b.total_steps || (b.steps?.length ?? 0)} Tahap</div>
                        </div>
                        <div style={{ width: 1, background: "#E2E8F0" }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, color: "#64748B", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Size Breakdown</div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {(b.size_breakdown?.length > 0) ? b.size_breakdown.map((s: any, i: number) => (
                              <span key={i} style={{ fontSize: 11, background: "white", border: "1px solid #CBD5E1", borderRadius: 6, padding: "2px 6px", color: "#475569", fontWeight: 700 }}>
                                {s.size}: {s.jumlah}
                              </span>
                            )) : <span style={{ fontSize: 12, color: "#94A3B8" }}>-</span>}
                          </div>
                        </div>
                        <div style={{ width: 1, background: "#E2E8F0" }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, color: "#64748B", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Total Cacat</div>
                          {cacat > 0 ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#EF4444", fontWeight: 800, fontSize: 14 }}>
                              <AlertTriangle size={14} /> {cacat} pcs
                            </div>
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#10B981", fontWeight: 800, fontSize: 14 }}>
                              <CheckCircle size={14} /> 0 cacat
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                    
                    {/* Hover Footer */}
                    <div style={{ background: "#F1F5F9", padding: "10px 24px", fontSize: 12, fontWeight: 700, color: "#3B82F6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>Lihat detail laporan lengkap</span>
                      <span>→</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </>
  );
}
