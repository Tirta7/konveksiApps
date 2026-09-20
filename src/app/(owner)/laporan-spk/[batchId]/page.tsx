"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Printer, Activity, Package, Scissors, CheckCircle, AlertTriangle } from "lucide-react";

function fmtDT(str?: string) {

  if (!str) return "-";
  const d = new Date(str);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) +
    " " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    selesai: { bg: "#DCFCE7", color: "#065F46", label: "✅ Selesai" },
    berjalan: { bg: "#DBEAFE", color: "#1E40AF", label: "⚙️ Berjalan" },
    menunggu: { bg: "#F1F5F9", color: "#64748B", label: "⏳ Menunggu" },
    reject:   { bg: "#FEE2E2", color: "#991B1B", label: "❌ Reject" },
  };
  const s = map[status] ?? { bg: "#F1F5F9", color: "#64748B", label: status };
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 8, padding: "4px 12px", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>
      {s.label}
    </span>
  );
}

export default function LaporanSPKDetailPage() {
  const { batchId } = useParams() as { batchId: string };
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch(`/api/laporan-spk/${batchId}`);
    const d = await res.json();
    setData(d);
    setLoading(false);
  }, [batchId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", alignItems: "center", justifyContent: "center", color: "#64748B" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
      <div style={{ fontSize: 16, fontWeight: 700 }}>Memuat Laporan Lengkap...</div>
    </div>
  );
  if (!data || data.error) return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", alignItems: "center", justifyContent: "center", color: "#EF4444" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
      <div style={{ fontSize: 16, fontWeight: 700 }}>{data?.error ?? "Gagal memuat laporan"}</div>
      <button onClick={() => router.back()} style={{ marginTop: 20, padding: "10px 20px", background: "#F1F5F9", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>Kembali</button>
    </div>
  );

  const { batch, steps, rekap, logs } = data;
  const sizeBreakdown: any[] = batch.size_breakdown ?? [];

  // Real-time sync: auto-refresh when another admin makes a change
  useEffect(() => {
    const handler = () => load();
    window.addEventListener("konveksi-sync", handler);
    return () => window.removeEventListener("konveksi-sync", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
        <div className="no-print" style={{ padding: "24px 32px", background: "white", borderBottom: "1px solid #E2E8F0", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <button onClick={() => router.back()} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: "50%", background: "#F1F5F9", color: "#334155", border: "none", cursor: "pointer", transition: "background 0.2s" }} onMouseOver={e=>e.currentTarget.style.background="#E2E8F0"} onMouseOut={e=>e.currentTarget.style.background="#F1F5F9"}>
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", marginBottom: 4 }}>Laporan SPK: <span style={{fontFamily:"monospace"}}>{batch.kode_batch}</span></h1>
              <p style={{ fontSize: 13, color: "#64748B" }}>{batch.jenis_kain} &bull; Laporan rincian produksi dan tracking history</p>
            </div>
          </div>
          <button onClick={() => window.print()} style={{ padding: "12px 20px", borderRadius: 12, fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", gap: 8, background: "#3B82F6", border: "none", color: "white", boxShadow: "0 4px 12px rgba(59,130,246,0.3)", cursor: "pointer" }}>
            <Printer size={16} /> Cetak / Export PDF
          </button>
        </div>

        {/* Scrollable Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
          <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
            
            {/* Ringkasan Produksi */}
            <div style={{ background: "white", borderRadius: 24, border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", alignItems: "center", gap: 10 }}>
                <Activity size={20} color="#3B82F6" />
                <h2 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: 0 }}>Ringkasan Produksi</h2>
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, background: "#E2E8F0" }}>
                {[
                  { val: rekap.jumlah_awal, label: "Total Diproduksi", color: "#1E293B", bg: "white" },
                  { val: rekap.total_cacat, label: "Total Cacat", color: rekap.ada_cacat ? "#EF4444" : "#94A3B8", bg: "white", icon: rekap.ada_cacat ? <AlertTriangle size={14} /> : null },
                  { val: rekap.jumlah_final, label: "Final Masuk Gudang", color: "#10B981", bg: "white" },
                  { val: `${rekap.jumlah_awal > 0 ? Math.round((rekap.jumlah_final / rekap.jumlah_awal) * 100) : 100}%`, label: "Tingkat Keberhasilan", color: "#3B82F6", bg: "white" },
                ].map((item, i) => (
                  <div key={i} style={{ padding: "32px 24px", background: item.bg, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ fontSize: 36, fontWeight: 900, color: item.color, lineHeight: 1, display: "flex", alignItems: "center", gap: 8 }}>
                      {item.icon} {item.val}
                    </div>
                    <div style={{ fontSize: 13, color: "#64748B", fontWeight: 700, marginTop: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>{item.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Size Breakdown */}
            {sizeBreakdown.length > 0 && (
              <div style={{ background: "white", borderRadius: 24, border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
                <div style={{ padding: "20px 24px", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", alignItems: "center", gap: 10 }}>
                  <Scissors size={20} color="#D97706" />
                  <h2 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: 0 }}>Rekap Per Size</h2>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                    <thead>
                      <tr style={{ background: "#F1F5F9" }}>
                        <th style={{ padding: "16px 24px", fontSize: 12, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "2px solid #E2E8F0" }}>Ukuran</th>
                        <th style={{ padding: "16px 24px", fontSize: 12, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "2px solid #E2E8F0", textAlign: "center" }}>Produksi</th>
                        <th style={{ padding: "16px 24px", fontSize: 12, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "2px solid #E2E8F0", textAlign: "center" }}>Cacat</th>
                        <th style={{ padding: "16px 24px", fontSize: 12, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "2px solid #E2E8F0", textAlign: "center" }}>Final</th>
                        <th style={{ padding: "16px 24px", fontSize: 12, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "2px solid #E2E8F0", textAlign: "center" }}>Yield (%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sizeBreakdown.map((s: any, i: number) => {
                        const final = Math.max(0, s.jumlah - (s.cacat ?? 0));
                        const pct = s.jumlah > 0 ? Math.round((final / s.jumlah) * 100) : 100;
                        return (
                          <tr key={i} className="table-row-hover" style={{ borderBottom: "1px solid #F1F5F9" }}>
                            <td style={{ padding: "16px 24px", fontWeight: 800, fontSize: 14 }}>Size {s.size}</td>
                            <td style={{ padding: "16px 24px", textAlign: "center", fontWeight: 700, color: "#334155" }}>{s.jumlah} <span style={{fontSize: 11, color: "#94A3B8"}}>pcs</span></td>
                            <td style={{ padding: "16px 24px", textAlign: "center", color: (s.cacat ?? 0) > 0 ? "#EF4444" : "#94A3B8", fontWeight: (s.cacat ?? 0) > 0 ? 800 : 400 }}>
                              {(s.cacat ?? 0) > 0 ? `${s.cacat} pcs` : "—"}
                            </td>
                            <td style={{ padding: "16px 24px", textAlign: "center", color: "#10B981", fontWeight: 800, fontSize: 14 }}>{final} <span style={{fontSize: 11, color: "#94A3B8"}}>pcs</span></td>
                            <td style={{ padding: "16px 24px", textAlign: "center" }}>
                              <span style={{ background: pct === 100 ? "#DCFCE7" : pct >= 95 ? "#FEF9C3" : "#FEE2E2", color: pct === 100 ? "#065F46" : pct >= 95 ? "#854D0E" : "#991B1B", borderRadius: 6, padding: "4px 10px", fontWeight: 800, fontSize: 12 }}>{pct}%</span>
                            </td>
                          </tr>
                        );
                      })}
                      <tr style={{ background: "#F8FAFC", borderTop: "2px solid #E2E8F0" }}>
                        <td style={{ padding: "16px 24px", fontWeight: 900, fontSize: 14, color: "#0F172A" }}>TOTAL</td>
                        <td style={{ padding: "16px 24px", textAlign: "center", fontWeight: 900, color: "#0F172A", fontSize: 14 }}>{rekap.jumlah_awal} pcs</td>
                        <td style={{ padding: "16px 24px", textAlign: "center", color: rekap.total_cacat > 0 ? "#EF4444" : "#94A3B8", fontWeight: 900, fontSize: 14 }}>{rekap.total_cacat > 0 ? `${rekap.total_cacat} pcs` : "—"}</td>
                        <td style={{ padding: "16px 24px", textAlign: "center", color: "#10B981", fontWeight: 900, fontSize: 14 }}>{rekap.jumlah_final} pcs</td>
                        <td style={{ padding: "16px 24px", textAlign: "center" }}>
                          <span style={{ background: "#DCFCE7", color: "#065F46", borderRadius: 6, padding: "4px 10px", fontWeight: 900, fontSize: 12 }}>
                            {rekap.jumlah_awal > 0 ? Math.round((rekap.jumlah_final / rekap.jumlah_awal) * 100) : 100}%
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Detail Proses per Step */}
            <div style={{ background: "white", borderRadius: 24, border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", alignItems: "center", gap: 10 }}>
                <Package size={20} color="#10B981" />
                <h2 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: 0 }}>Detail Proses Per Vendor</h2>
              </div>
              <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
                {steps.map((s: any, i: number) => {
                  const isSelesai = s.status === "selesai";
                  const hasCacat = s.total_cacat > 0;
                  
                  return (
                    <div key={i} style={{ padding: 20, borderRadius: 16, border: `2px solid ${hasCacat ? "#FECACA" : isSelesai ? "#BBF7D0" : "#E2E8F0"}`, background: hasCacat ? "#FFF8F8" : isSelesai ? "#F0FDF4" : "#F8FAFC", display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Tahap {s.step_order}</div>
                          <div style={{ fontSize: 18, fontWeight: 900, color: "#0F172A", display: "flex", alignItems: "center", gap: 10 }}>
                            {s.jenis_pekerjaan}
                            {hasCacat && <span style={{ background: "#FEE2E2", color: "#991B1B", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 800 }}><AlertTriangle size={12} style={{display: "inline", verticalAlign: "middle"}}/> {s.total_cacat} Cacat</span>}
                          </div>
                          <div style={{ fontSize: 14, color: "#475569", fontWeight: 600, marginTop: 4 }}>🏢 {s.vendor_nama}</div>
                        </div>
                        <StatusBadge status={s.status} />
                      </div>

                      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 12, color: "#475569", padding: "12px 16px", background: "rgba(255,255,255,0.6)", borderRadius: 12, border: "1px solid rgba(0,0,0,0.05)" }}>
                        {s.mulai_waktu && <div style={{display: "flex", gap: 6, alignItems: "center"}}><span>Mulai:</span> <strong style={{color:"#0F172A"}}>{fmtDT(s.mulai_waktu)}</strong></div>}
                        {s.terima_waktu && <div style={{display: "flex", gap: 6, alignItems: "center"}}><span>Terima:</span> <strong style={{color:"#0F172A"}}>{fmtDT(s.terima_waktu)}</strong></div>}
                        {s.selesai_waktu && <div style={{display: "flex", gap: 6, alignItems: "center"}}><span>Selesai:</span> <strong style={{color:"#10B981"}}>{fmtDT(s.selesai_waktu)}</strong></div>}
                      </div>

                      {s.jumlah_diterima !== undefined && (
                        <div style={{ padding: "12px 16px", borderRadius: 12,
                          background: (s.selisih_terima ?? 0) === 0 ? "#F0FDF4" : (s.selisih_terima ?? 0) > 0 ? "#FEF2F2" : "#FFFBEB",
                          border: `1px solid ${(s.selisih_terima ?? 0) === 0 ? "#86EFAC" : (s.selisih_terima ?? 0) > 0 ? "#FECACA" : "#FDE68A"}` }}>
                          <div style={{ display: "flex", gap: 20, fontSize: 13, flexWrap: "wrap", alignItems: "center" }}>
                            <span>📦 <strong>Diterima: {s.jumlah_diterima} pcs</strong> <span style={{color:"#64748B", fontSize:12}}>(Sesuai SPK: {s.jumlah_barang} pcs)</span></span>
                            {(s.selisih_terima ?? 0) === 0 && <span style={{ color: "#065F46", fontWeight: 800, display:"flex", alignItems:"center", gap:6 }}><CheckCircle size={14}/> Valid (Sesuai)</span>}
                            {(s.selisih_terima ?? 0) > 0 && <span style={{ color: "#991B1B", fontWeight: 800, display:"flex", alignItems:"center", gap:6 }}><AlertTriangle size={14}/> Kurang {s.selisih_terima} pcs saat transfer</span>}
                            {(s.selisih_terima ?? 0) < 0 && <span style={{ color: "#92400E", fontWeight: 800, display:"flex", alignItems:"center", gap:6 }}><AlertTriangle size={14}/> Lebih {Math.abs(s.selisih_terima)} pcs dari SPK</span>}
                          </div>
                        </div>
                      )}

                      {s.defect_detail?.length > 0 && (
                        <div style={{ padding: "14px 16px", background: "white", borderRadius: 12, border: "1px dashed #FECACA" }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: "#991B1B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Rincian Barang Cacat:</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {s.defect_detail.map((d: any, j: number) => (
                              <div key={j} style={{ fontSize: 13, color: "#7F1D1D", display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{width: 6, height: 6, borderRadius: "50%", background: "#EF4444"}} />
                                <strong>Size {d.size}: {d.jumlah_cacat} pcs</strong>
                                <span style={{color: "#475569"}}>— {d.alasan}</span>
                                {d.waktu && <span style={{ fontSize: 11, color: "#94A3B8", marginLeft: "auto" }}>{fmtDT(d.waktu)}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Log Aktivitas */}
            <div style={{ background: "white", borderRadius: 24, border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC" }}>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: 0 }}>Log Aktivitas / History SPK</h2>
              </div>
              <div style={{ padding: "8px 24px" }}>
                {logs.length === 0 && <p style={{ color: "#94A3B8", fontSize: 13, padding: "16px 0" }}>Belum ada log aktivitas.</p>}
                {logs.map((l: any, i: number) => (
                  <div key={i} style={{ display: "flex", gap: 16, padding: "12px 0", borderBottom: i < logs.length - 1 ? "1px solid #F1F5F9" : "none" }}>
                    <div style={{ fontSize: 12, color: "#64748B", minWidth: 140, fontWeight: 600 }}>{fmtDT(l.waktu)}</div>
                    <div style={{ fontSize: 13, color: "#1E293B", fontWeight: 500, lineHeight: 1.5 }}>{l.keterangan}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

      </div>

      <style>{`
        @media print { 
          .no-print { display: none !important; } 
          body, html { height: auto !important; overflow: auto !important; }
          .app-content { overflow: visible !important; height: auto !important; }
        }
      `}</style>
    </>
  );
}
