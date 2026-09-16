"use client";
import { useEffect, useState } from "react";
import { Plus, X, Package, RotateCcw, AlertTriangle, CheckCircle, FileText } from "lucide-react";

const ALASAN = ["rusak", "salah-ukuran", "tidak-sesuai", "lainnya"];
const ALASAN_LABEL: Record<string, string> = { "rusak": "Rusak", "salah-ukuran": "Salah Ukuran", "tidak-sesuai": "Tidak Sesuai", "lainnya": "Lainnya" };

function formatTgl(str: string) {
  if (!str) return "-";
  return new Date(str).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ReturOnlinePage() {
  const [list, setList] = useState<any[]>([]);
  const [poList, setPoList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ poId: "", alasan: "", jumlah: "", kondisi: "bisa-dijual", catatan: "" });
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const load = () => {
    fetch("/api/returns/online").then(r => r.json()).then(d => { setList(d); setLoading(false); });
    fetch("/api/po").then(r => r.json()).then(setPoList);
  };
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.alasan || !form.jumlah || !form.kondisi) return;
    setSaving(true);
    const res = await fetch("/api/returns/online", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, poId: form.poId ? Number(form.poId) : null, jumlah: Number(form.jumlah) }),
    });
    const data = await res.json();
    setSaving(false);
    setShowForm(false);
    setForm({ poId: "", alasan: "", jumlah: "", kondisi: "bisa-dijual", catatan: "" });
    if (data.success) setSuccessMsg(form.kondisi === "bisa-dijual" ? "Retur berhasil dicatat & stok gudang otomatis bertambah!" : "Retur dicatat, barang ditolak karena kondisi rusak.");
    setTimeout(() => setSuccessMsg(""), 4000);
    load();
  };

  return (
    <>
      <style>{`
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 99px; }
        .table-row-hover:hover { background: #F8FAFC; }
        @keyframes slideInDown { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
      
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#F1F5F9", overflow: "hidden" }}>
        
        {/* Fixed Header */}
        <div style={{ padding: "24px 32px", background: "white", borderBottom: "1px solid #E2E8F0", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", marginBottom: 4 }}>Retur Penjualan Online</h1>
            <p style={{ fontSize: 13, color: "#64748B" }}>Catat pengembalian barang dari pembeli online (PO/Marketplace)</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowForm(true)} style={{ padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={16} /> Tambah Retur
          </button>

          {/* Success Notification */}
          {successMsg && (
            <div style={{ position: "absolute", bottom: -60, right: 32, padding: "12px 20px", background: "#DCFCE7", color: "#065F46", borderRadius: 12, border: "1px solid #86EFAC", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 10, boxShadow: "0 10px 25px rgba(0,0,0,0.1)", animation: "slideInDown 0.3s cubic-bezier(0.16,1,0.3,1)", zIndex: 50 }}>
              <CheckCircle size={18} /> {successMsg}
            </div>
          )}
        </div>

        {/* Modal Form */}
        {showForm && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div style={{ background: "white", borderRadius: 24, padding: "32px", width: "100%", maxWidth: 500, boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: "#F1F5F9", color: "#3B82F6", display: "flex", alignItems: "center", justifyContent: "center" }}><RotateCcw size={20} /></div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", margin: 0 }}>Form Retur Online</h2>
                </div>
                <button onClick={() => setShowForm(false)} style={{ background: "#F1F5F9", border: "none", width: 32, height: 32, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B" }}><X size={16} /></button>
              </div>
              
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>Nomor PO Terkait (Opsional)</label>
                  <select style={{ width: "100%", padding: "10px 14px", border: "1px solid #CBD5E1", borderRadius: 8, fontSize: 14 }} value={form.poId} onChange={e => setForm(f => ({ ...f, poId: e.target.value }))}>
                    <option value="">— Pilih PO —</option>
                    {poList.map(po => <option key={po.id} value={po.id}>{po.no_po} — {po.kategori} ({po.jumlah} pcs)</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>Alasan Retur <span style={{color:"#EF4444"}}>*</span></label>
                  <select style={{ width: "100%", padding: "10px 14px", border: "1px solid #CBD5E1", borderRadius: 8, fontSize: 14 }} value={form.alasan} onChange={e => setForm(f => ({ ...f, alasan: e.target.value }))}>
                    <option value="">— Pilih alasan —</option>
                    {ALASAN.map(a => <option key={a} value={a}>{ALASAN_LABEL[a]}</option>)}
                  </select>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>Jumlah Retur <span style={{color:"#EF4444"}}>*</span></label>
                    <div style={{ position: "relative" }}>
                      <input type="number" style={{ width: "100%", padding: "10px 14px", paddingRight: 40, border: "1px solid #CBD5E1", borderRadius: 8, fontSize: 14 }} value={form.jumlah} onChange={e => setForm(f => ({ ...f, jumlah: e.target.value }))} min="1" placeholder="1" />
                      <span style={{ position: "absolute", right: 14, top: 11, fontSize: 12, color: "#94A3B8", fontWeight: 700 }}>pcs</span>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>Kondisi Barang <span style={{color:"#EF4444"}}>*</span></label>
                    <select style={{ width: "100%", padding: "10px 14px", border: "1px solid #CBD5E1", borderRadius: 8, fontSize: 14, background: form.kondisi === "rusak" ? "#FEF2F2" : "white" }} value={form.kondisi} onChange={e => setForm(f => ({ ...f, kondisi: e.target.value }))}>
                      <option value="bisa-dijual">✅ Bisa Dijual Lagi</option>
                      <option value="rusak">❌ Rusak / Reject</option>
                    </select>
                  </div>
                </div>
                
                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>Catatan Pembeli</label>
                  <textarea rows={2} style={{ width: "100%", padding: "10px 14px", border: "1px solid #CBD5E1", borderRadius: 8, fontSize: 14, resize: "vertical" }} value={form.catatan} onChange={e => setForm(f => ({ ...f, catatan: e.target.value }))} placeholder="Keterangan komplain..." />
                </div>
                
                {form.kondisi === "bisa-dijual" ? (
                  <div style={{ display: "flex", gap: 10, padding: "12px 14px", background: "#F0FDF4", borderRadius: 12, border: "1px solid #BBF7D0", color: "#065F46", marginBottom: 24 }}>
                    <CheckCircle size={18} style={{flexShrink:0}} />
                    <div style={{ fontSize: 12, lineHeight: 1.4 }}><strong>Otomatis Update Stok!</strong> Barang yang bisa dijual kembali akan langsung masuk dan menambahkan stok kategori tersebut di gudang.</div>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 10, padding: "12px 14px", background: "#FEF2F2", borderRadius: 12, border: "1px solid #FECACA", color: "#991B1B", marginBottom: 24 }}>
                    <AlertTriangle size={18} style={{flexShrink:0}} />
                    <div style={{ fontSize: 12, lineHeight: 1.4 }}><strong>Barang Ditolak!</strong> Barang akan dibuang dan tidak akan menambah stok gudang.</div>
                  </div>
                )}
                
                <div style={{ display: "flex", gap: 12 }}>
                  <button type="button" onClick={() => setShowForm(false)} style={{ flex: 1, padding: "12px", background: "#F1F5F9", color: "#475569", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: "pointer" }}>Batal</button>
                  <button type="submit" disabled={saving || !form.alasan || !form.jumlah} style={{ flex: 2, padding: "12px", background: "#3B82F6", color: "white", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: saving ? "not-allowed" : "pointer", opacity: (saving || !form.alasan || !form.jumlah) ? 0.6 : 1 }}>
                    {saving ? "Memproses..." : "Simpan Retur"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Scrollable Content Area */}
        <div style={{ flex: 1, padding: "24px 32px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ flex: 1, background: "white", borderRadius: 20, border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column" }}>
            
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", alignItems: "center", gap: 10 }}>
              <Package size={18} color="#3B82F6" />
              <h2 style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", margin: 0 }}>Daftar Pengembalian Barang</h2>
            </div>
            
            <div style={{ flex: 1, overflow: "auto" }}>
              {loading ? (
                <div style={{ padding: 60, textAlign: "center", color: "#94A3B8", fontWeight: 600 }}>⏳ Memuat data retur...</div>
              ) : list.length === 0 ? (
                <div style={{ padding: 60, textAlign: "center", color: "#94A3B8" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🔄</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", marginBottom: 4 }}>Belum ada retur online</div>
                  <div style={{ fontSize: 13 }}>Data pengembalian barang dari pembeli akan muncul di sini.</div>
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                    <tr style={{ background: "#F1F5F9" }}>
                      <th style={{ padding: "14px 24px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "2px solid #E2E8F0" }}>ID Retur / PO</th>
                      <th style={{ padding: "14px 24px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "2px solid #E2E8F0" }}>Alasan</th>
                      <th style={{ padding: "14px 24px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "2px solid #E2E8F0" }}>Barang Keluar</th>
                      <th style={{ padding: "14px 24px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "2px solid #E2E8F0", textAlign: "center" }}>Kondisi Fisik</th>
                      <th style={{ padding: "14px 24px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "2px solid #E2E8F0", textAlign: "center" }}>Status & Tanggal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map(r => {
                      const isBagus = r.kondisi === "bisa-dijual";
                      const statusColor = r.status === "ditolak" ? "#EF4444" : r.status === "masuk-gudang" ? "#10B981" : "#F59E0B";
                      const statusBg = r.status === "ditolak" ? "#FEF2F2" : r.status === "masuk-gudang" ? "#DCFCE7" : "#FEF3C7";
                      const statusLabel = r.status === "ditolak" ? "Ditolak (Rusak)" : r.status === "masuk-gudang" ? "Masuk Gudang" : "Diproses";
                      
                      return (
                        <tr key={r.id} className="table-row-hover" style={{ borderBottom: "1px solid #F1F5F9" }}>
                          
                          <td style={{ padding: "16px 24px" }}>
                            <div style={{ fontWeight: 900, fontSize: 14, color: "#0F172A", fontFamily: "monospace", marginBottom: 4 }}>{r.no_retur}</div>
                            {r.no_po ? (
                              <div style={{ fontSize: 12, color: "#3B82F6", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}><FileText size={12}/> PO: {r.no_po}</div>
                            ) : (
                              <div style={{ fontSize: 12, color: "#94A3B8", fontWeight: 600 }}>Tanpa referensi PO</div>
                            )}
                          </td>
                          
                          <td style={{ padding: "16px 24px", fontSize: 13, color: "#334155", fontWeight: 600 }}>
                            {ALASAN_LABEL[r.alasan] ?? r.alasan}
                          </td>
                          
                          <td style={{ padding: "16px 24px" }}>
                            <div style={{ fontWeight: 900, fontSize: 16, color: "#0F172A" }}>{r.jumlah} <span style={{fontSize: 12, color:"#94A3B8"}}>pcs</span></div>
                          </td>
                          
                          <td style={{ padding: "16px 24px", textAlign: "center" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: isBagus ? "#F0FDF4" : "#FFF7ED", color: isBagus ? "#065F46" : "#9A3412", border: `1px solid ${isBagus ? "#BBF7D0" : "#FFEDD5"}`, padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 800 }}>
                              {isBagus ? "✅ Bisa Dijual" : "❌ Rusak"}
                            </span>
                          </td>
                          
                          <td style={{ padding: "16px 24px", textAlign: "center" }}>
                            <span style={{ display: "inline-flex", padding: "4px 10px", borderRadius: 8, background: statusBg, color: statusColor, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                              {statusLabel}
                            </span>
                            <div style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>{formatTgl(r.tanggal)}</div>
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
