"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, Undo2, Ban, CheckCircle, Factory } from "lucide-react";
import { useRouter } from "next/navigation";

function formatTgl(str: string) {

  if (!str) return "-";
  return new Date(str).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ReturProduksiPage() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const load = () => { fetch("/api/returns/produksi").then(r => r.json()).then(d => { setList(d); setLoading(false); }); };
  useEffect(() => { load(); }, []);

  const handleBuatSPKRetur = async (batchId: number) => {
    router.push(`/buat-spk?batchId=${batchId}&retur=1`);
  };

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
        <div style={{ padding: "24px 32px", background: "white", borderBottom: "1px solid #E2E8F0", flexShrink: 0 }}>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", marginBottom: 4 }}>Retur Produksi (Washing)</h1>
          <p style={{ fontSize: 13, color: "#64748B" }}>Manajemen batch kain yang dikembalikan karena cacat pada saat QC Washing</p>
        </div>

        {/* Scrollable Content */}
        <div style={{ flex: 1, padding: "24px 32px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          
          {/* Info Box */}
          <div style={{ padding: "16px 24px", background: "#FFFBEB", borderRadius: 16, border: "1px solid #FDE68A", marginBottom: 20, flexShrink: 0, display: "flex", gap: 16 }}>
            <div style={{ color: "#D97706", marginTop: 2 }}><AlertTriangle size={24} /></div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: "#92400E", marginBottom: 6 }}>Aturan Cuci Ulang (Retur Produksi)</div>
              <ul style={{ paddingLeft: 16, fontSize: 13, color: "#B45309", margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                <li>Setiap batch yang cacat washing boleh dicuci ulang <strong>maksimal 2 kali</strong>.</li>
                <li>Pada kesempatan ke-2, sistem akan menampilkan peringatan.</li>
                <li>Jika sudah 2x dan masih cacat, batch otomatis ditandai <strong>Reject Permanen</strong> dan tidak bisa dibuatkan SPK Retur lagi.</li>
              </ul>
            </div>
          </div>

          {/* Table Container */}
          <div style={{ flex: 1, background: "white", borderRadius: 20, border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", alignItems: "center", gap: 10 }}>
              <Factory size={18} color="#D97706" />
              <h2 style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", margin: 0 }}>Daftar Antrean Retur</h2>
            </div>
            
            <div style={{ flex: 1, overflow: "auto" }}>
              {loading ? (
                <div style={{ padding: 60, textAlign: "center", color: "#94A3B8", fontWeight: 600 }}>⏳ Memuat data retur...</div>
              ) : list.length === 0 ? (
                <div style={{ padding: 60, textAlign: "center", color: "#94A3B8" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", marginBottom: 4 }}>Tidak ada retur produksi</div>
                  <div style={{ fontSize: 13 }}>Semua batch saat ini lolos proses Quality Control.</div>
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                    <tr style={{ background: "#F1F5F9" }}>
                      <th style={{ padding: "14px 24px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "2px solid #E2E8F0" }}>Informasi Batch</th>
                      <th style={{ padding: "14px 24px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "2px solid #E2E8F0" }}>Alasan Retur</th>
                      <th style={{ padding: "14px 24px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "2px solid #E2E8F0", textAlign: "center" }}>Counter Cuci Ulang</th>
                      <th style={{ padding: "14px 24px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "2px solid #E2E8F0", textAlign: "center" }}>Status</th>
                      <th style={{ padding: "14px 24px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "2px solid #E2E8F0", textAlign: "right" }}>Tindakan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map(r => {
                      const isMaxReached = r.ke_berapa_kali >= 2;
                      const isRejectPerm = r.status === "reject-permanen";
                      const statusBg = isRejectPerm ? "#FEF2F2" : r.status === "diproses-ulang" ? "#EFF6FF" : r.status === "selesai" ? "#DCFCE7" : "#FEF3C7";
                      const statusColor = isRejectPerm ? "#991B1B" : r.status === "diproses-ulang" ? "#1E40AF" : r.status === "selesai" ? "#065F46" : "#92400E";
                      const statusIcon = isRejectPerm ? <Ban size={12}/> : r.status === "diproses-ulang" ? <Undo2 size={12}/> : r.status === "selesai" ? <CheckCircle size={12}/> : <AlertTriangle size={12}/>;
                      const statusText = isRejectPerm ? "Reject Permanen" : r.status === "diproses-ulang" ? "Diproses Ulang" : r.status === "selesai" ? "Selesai" : "Menunggu SPK Retur";

                      return (
                        <tr key={r.id} className="table-row-hover" style={{ background: isRejectPerm ? "rgba(239,68,68,0.03)" : isMaxReached ? "rgba(245,158,11,0.03)" : "transparent", borderBottom: "1px solid #F1F5F9" }}>
                          
                          <td style={{ padding: "16px 24px" }}>
                            <div style={{ fontWeight: 900, fontSize: 14, color: "#0F172A", fontFamily: "monospace", marginBottom: 4 }}>{r.kode_batch}</div>
                            <div style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>{r.jenis_kain} &bull; Tgl: {formatTgl(r.tanggal)}</div>
                          </td>
                          
                          <td style={{ padding: "16px 24px", fontSize: 13, color: "#334155", fontWeight: 600, maxWidth: 200 }}>
                            {r.alasan}
                          </td>
                          
                          <td style={{ padding: "16px 24px", textAlign: "center" }}>
                            <div style={{ fontWeight: 900, fontSize: 20, color: isMaxReached ? "#EF4444" : "#F59E0B" }}>
                              {r.ke_berapa_kali} <span style={{fontSize: 12, color:"#94A3B8"}}>/ 2</span>
                            </div>
                            {isMaxReached && !isRejectPerm && <div style={{ color: "#EF4444", fontWeight: 800, fontSize: 10, marginTop: 4, textTransform: "uppercase" }}>⚠️ Kesempatan Terakhir</div>}
                            {isRejectPerm && <div style={{ color: "#991B1B", fontWeight: 800, fontSize: 10, marginTop: 4, textTransform: "uppercase" }}>🚫 Limit Tercapai</div>}
                          </td>
                          
                          <td style={{ padding: "16px 24px", textAlign: "center" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: statusBg, color: statusColor, padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>
                              {statusIcon} {statusText}
                            </span>
                          </td>
                          
                          <td style={{ padding: "16px 24px", textAlign: "right" }}>
                            {isRejectPerm ? (
                              <button disabled style={{ padding: "8px 12px", borderRadius: 8, background: "#F1F5F9", color: "#94A3B8", border: "none", fontSize: 12, fontWeight: 800, cursor: "not-allowed", display: "inline-flex", alignItems: "center", gap: 6 }}>
                                <Ban size={14} /> Tidak Bisa Retur
                              </button>
                            ) : r.status === "menunggu-spk-retur" ? (
                              <button onClick={() => handleBuatSPKRetur(r.batch_id)} style={{ padding: "8px 12px", borderRadius: 8, background: "#3B82F6", color: "white", border: "none", fontSize: 12, fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, boxShadow: "0 2px 8px rgba(59,130,246,0.3)" }}>
                                <Undo2 size={14} /> Buat SPK Retur
                              </button>
                            ) : r.status === "selesai" ? (
                              <span style={{ color: "#10B981", fontSize: 12, fontWeight: 700 }}>✅ Retur selesai</span>
                            ) : (
                              <span style={{ color: "#64748B", fontSize: 12, fontWeight: 700 }}>SPK sudah dibuat</span>
                            )}
                          </td>

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
