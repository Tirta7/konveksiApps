"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Package, Plus, ChevronRight, X, Layers, AlertTriangle } from "lucide-react";

function fmtDT(str?: string) {

  if (!str) return "-";
  return new Date(str).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export default function BarangJadiPage() {
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const router = useRouter();

  const fetchData = () => {
    fetch("/api/spk").then(r => r.json()).then(d => {
      setBatches(d.filter((b: any) => b.route_selesai || b.size_breakdown?.length > 0));
      setLoading(false);
    });
  };

  useEffect(() => { fetchData(); }, []);


  const [returList, setReturList] = useState<any[]>([]);
  useEffect(() => {
    fetch("/api/returns/produksi").then(r => r.json()).then(d => setReturList(d));
  }, []);

  const batchPernahRetur = (batchId: number) => returList.some(r => r.batch_id === batchId);

  const filtered = batches.filter(b =>
    b.kode_batch?.toLowerCase().includes(search.toLowerCase()) ||
    b.jenis_kain?.toLowerCase().includes(search.toLowerCase())
  );

  const totalCacat = (b: any) => (b.size_breakdown ?? []).reduce((s: number, sz: any) => s + (sz.cacat ?? 0), 0);
  const totalPcs = (b: any) => {
    if (b.size_breakdown && b.size_breakdown.length > 0) {
      return b.size_breakdown.reduce((s: number, sz: any) => s + (sz.jumlah ?? 0), 0);
    }
    return b.jumlah_pcs ?? 0;
  };

  // Real-time sync: auto-refresh when another admin makes a change
  useEffect(() => {
    const handler = () => fetchData();
    window.addEventListener("konveksi-sync", handler);
    return () => window.removeEventListener("konveksi-sync", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      <style>{`
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 99px; }
        .batch-item-hover:hover { border-color: #93C5FD !important; background: #F8FAFC; transform: translateY(-1px); }
      `}</style>
      
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#F1F5F9", overflow: "hidden", position: "relative" }}>
        
        {/* Header */}
        <div style={{ padding: "24px 32px", background: "white", borderBottom: "1px solid #E2E8F0", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", marginBottom: 4 }}>Daftar Bundle Barang Jadi</h1>
            <p style={{ fontSize: 13, color: "#64748B" }}>Manajemen dan tracking kode item unik per bundle produksi</p>
          </div>
          <button className="btn btn-primary" onClick={() => router.push("/buat-spk")} style={{ padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={16} /> Buat SPK Baru
          </button>
        </div>

        {/* Action Bar */}
        <div style={{ padding: "16px 32px", background: "white", borderBottom: "1px solid #E2E8F0", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", background: "#F8FAFC", border: "1px solid #CBD5E1", borderRadius: 10, padding: "0 14px", maxWidth: 400, transition: "border-color 0.2s" }} onFocus={e => e.currentTarget.style.borderColor = "#3B82F6"} onBlur={e => e.currentTarget.style.borderColor = "#CBD5E1"}>
            <Search size={18} color="#94A3B8" />
            <input 
              style={{ flex: 1, padding: "10px 12px", background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#0F172A" }} 
              placeholder="Cari kode batch atau jenis kain..." 
              value={search} onChange={e => setSearch(e.target.value)} 
            />
          </div>
        </div>

        {/* Main List */}
        <div style={{ flex: 1, padding: "24px 32px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ flex: 1, background: "white", borderRadius: 20, border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column" }}>
            {loading ? (
              <div style={{ padding: 60, textAlign: "center", color: "#94A3B8", fontWeight: 600 }}> Memuat bundle...</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 60, textAlign: "center", color: "#94A3B8" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}></div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", marginBottom: 6 }}>Tidak Ada Bundle</div>
                <div style={{ fontSize: 13, color: "#64748B" }}>Belum ada bundle yang sesuai pencarian.</div>
              </div>
            ) : (
              <div style={{ overflow: "auto", flex: 1 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                    <tr style={{ background: "#F8FAFC" }}>
                      <th style={{ padding: "14px 20px", fontSize: 12, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "2px solid #E2E8F0" }}>KODE BATCH</th>
                      <th style={{ padding: "14px 20px", fontSize: 12, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "2px solid #E2E8F0" }}>INFO KAIN</th>
                      <th style={{ padding: "14px 20px", fontSize: 12, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "2px solid #E2E8F0" }}>STATUS PROSES</th>
                      <th style={{ padding: "14px 20px", fontSize: 12, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "2px solid #E2E8F0" }}>TOTAL PCS</th>
                      <th style={{ padding: "14px 20px", fontSize: 12, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, textAlign: "right", borderBottom: "2px solid #E2E8F0" }}>AKSI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((b: any) => {
                      const cacat = totalCacat(b);
                      const total = totalPcs(b);
                      const final = Math.max(0, total - cacat);
                      const isSelected = selected?.id === b.id;
                      
                      return (
                        <tr key={b.id} className="batch-item-hover" style={{ borderBottom: "1px solid #F1F5F9", background: isSelected ? "#F8FAFC" : "white", cursor: "pointer", transition: "background 0.2s" }} onClick={() => setSelected(b)}>
                          <td style={{ padding: "16px 20px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <div style={{ width: 36, height: 36, borderRadius: 10, background: isSelected ? "#DBEAFE" : "#F1F5F9", color: isSelected ? "#1D4ED8" : "#64748B", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <Package size={18} />
                              </div>
                              <div>
                                <div style={{ fontWeight: 800, fontSize: 14, color: "#0F172A", fontFamily: "monospace", display: "flex", alignItems: "center", gap: 8 }}>
                                  {b.kode_batch}
                                  {batchPernahRetur(b.id) && <span style={{ padding: "2px 6px", background: "#FEE2E2", color: "#B91C1C", borderRadius: 4, fontSize: 10, fontWeight: 900 }}>RETUR</span>}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: "16px 20px" }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: "#334155" }}>{b.jenis_kain}</div>
                            <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>Dibuat: {fmtDT(b.created_at)}</div>
                          </td>
                          <td style={{ padding: "16px 20px" }}>
                            <span style={{ padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, background: b.route_selesai ? "#D1FAE5" : "#FEF3C7", color: b.route_selesai ? "#065F46" : "#92400E" }}>
                              {b.route_selesai ? "Selesai" : "Proses"}
                            </span>
                          </td>
                          <td style={{ padding: "16px 20px" }}>
                            <div style={{ fontWeight: 800, fontSize: 15, color: "#10B981" }}>{final} <span style={{fontSize: 12, fontWeight: 600, color: "#64748B"}}>pcs</span></div>
                            <div style={{ fontSize: 12, marginTop: 4, fontWeight: 600, color: cacat > 0 ? "#EF4444" : "#64748B" }}>
                              {cacat > 0 ? `${cacat} Cacat` : "Valid"}
                            </div>
                          </td>
                          <td style={{ padding: "16px 20px", textAlign: "right" }}>
                            <button onClick={(e) => { e.stopPropagation(); setSelected(b); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", background: isSelected ? "#3B82F6" : "#F1F5F9", color: isSelected ? "white" : "#3B82F6", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }}>
                              Detail <ChevronRight size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div style={{ marginTop: 16, fontSize: 12, fontWeight: 600, color: "#94A3B8", textAlign: "right", paddingRight: 8 }}>
            Menampilkan {filtered.length} bundle
          </div>
        </div>

        {/* Drawer Detail (Slide from Right) */}
        {selected && (
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, display: "flex", justifyContent: "flex-end", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.3)", backdropFilter: "blur(2px)", animation: "fadeIn 0.2s" }} onClick={() => setSelected(null)} />
            <div style={{ width: 640, background: "white", height: "100%", boxShadow: "-10px 0 30px rgba(0,0,0,0.1)", position: "relative", zIndex: 101, display: "flex", flexDirection: "column", animation: "slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)" }}>
              
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#F8FAFC" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ background: "#DBEAFE", color: "#1D4ED8", padding: 8, borderRadius: 10 }}><Package size={18} /></div>
                  <div>
                    <h2 style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", margin: 0, marginBottom: 2 }}>Kode Item Unik</h2>
                    <div style={{ fontSize: 11, color: "#64748B", fontFamily: "monospace" }}>{selected.kode_batch}</div>
                  </div>
                </div>
                <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", padding: 6, cursor: "pointer", color: "#94A3B8", borderRadius: 8, transition: "background 0.2s" }} onMouseOver={e=>e.currentTarget.style.background="#E2E8F0"} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ padding: "12px 24px", background: "#FFFBEB", borderBottom: "1px solid #FEF3C7", display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#92400E", fontWeight: 600 }}>
                <Layers size={14} /> Format standar: [BATCH]-[SIZE]-[NOMOR URUT]
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
                {(!selected.size_breakdown || selected.size_breakdown.length === 0) ? (
                  <div style={{ textAlign: "center", padding: 40 }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}></div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>Data Size Tidak Ditemukan</div>
                    <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>Bundle ini belum memiliki pembagian size atau belum selesai proses pemotongan.</div>
                    <button className="btn btn-secondary btn-sm" style={{ marginTop: 16 }} onClick={() => router.push(`/laporan-spk/${selected.id}`)}>Buka Laporan Lengkap</button>
                  </div>
                ) : (
                  <>
                    <button className="btn btn-primary" style={{ width: "100%", marginBottom: 24, padding: "10px", borderRadius: 10, fontSize: 13, fontWeight: 800, display: "flex", justifyContent: "center", alignItems: "center", gap: 6 }} onClick={() => router.push(`/laporan-spk/${selected.id}`)}>
                       Lihat Laporan SPK Lengkap
                    </button>
                    {selected.size_breakdown.map((sz: any, si: number) => (
                      <div key={si} style={{ marginBottom: 32 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12, borderBottom: "2px solid #F1F5F9", paddingBottom: 8 }}>
                          <div style={{ fontWeight: 800, fontSize: 14, color: "#1E293B" }}>Size {sz.size}</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>
                            {sz.jumlah} pcs {(sz.cacat ?? 0) > 0 ? <span style={{color:"#EF4444"}}>{`( -${sz.cacat} cacat )`}</span> : ""}
                          </div>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                          {Array.from({ length: sz.jumlah }, (_, j) => {
                            const no = String(j + 1).padStart(4, "0");
                            const isDefect = (sz.cacat ?? 0) > 0 && j >= (sz.jumlah - (sz.cacat ?? 0));
                            return (
                              <div key={j} style={{ fontSize: 10, fontFamily: "monospace", textAlign: "center", background: isDefect ? "#FEF2F2" : "white", color: isDefect ? "#991B1B" : "#334155", border: `1px solid ${isDefect ? "#FECACA" : "#E2E8F0"}`, borderRadius: 6, padding: "8px 4px", fontWeight: 700, boxShadow: isDefect ? "none" : "0 2px 4px rgba(0,0,0,0.02)" }}>
                                {selected.kode_batch}-{sz.size}-<br/><span style={{fontSize: 12, marginTop: 4, display: "inline-block", color: isDefect ? "#7F1D1D" : "#0F172A"}}>{no}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `}</style>
    </>
  );
}
