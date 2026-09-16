"use client";
import { useEffect, useState } from "react";
import { Plus, X, ShoppingBag } from "lucide-react";

const KATEGORI = ["Slim Fit","Regular Fit","Bootcut","Skinny","Wide Leg","Mom Jeans","Straight Cut","Cargo Jeans"];
const STATUS_LABEL: Record<string, string> = { "baru":"Baru","diproses":"Diproses","siap-kirim":"Siap Kirim","terkirim":"Terkirim" };
const STATUS_STYLE: Record<string, { bg: string; color: string; dot: string }> = {
  "baru": { bg: "#FEF3C7", color: "#D97706", dot: "#F59E0B" },
  "diproses": { bg: "#DBEAFE", color: "#1D4ED8", dot: "#3B82F6" },
  "siap-kirim": { bg: "#E0E7FF", color: "#4338CA", dot: "#6366F1" },
  "terkirim": { bg: "#D1FAE5", color: "#047857", dot: "#10B981" },
};

function formatTgl(str: string) {
  if (!str) return "-";
  return new Date(str).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function isDeadlineClose(tgl: string) {
  const diff = new Date(tgl).getTime() - Date.now();
  return diff > 0 && diff < 3 * 86400000;
}

export default function POOnlinePage() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ kategori: "", jumlah: "", tanggalKirim: "", catatan: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () => { fetch("/api/po").then(r => r.json()).then(d => { setList(d); setLoading(false); }); };
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.kategori || !form.jumlah || !form.tanggalKirim) { setError("Isi semua kolom wajib."); return; }
    setSaving(true);
    const res = await fetch("/api/po", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, jumlah: Number(form.jumlah) }) });
    const data = await res.json();
    setSaving(false);
    if (data.error) { setError(data.error); return; }
    setShowForm(false);
    setForm({ kategori: "", jumlah: "", tanggalKirim: "", catatan: "" });
    load();
  };

  const handleStatusChange = async (id: number, status: string) => {
    await fetch("/api/po", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
    load();
  };

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
            <h1 style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", marginBottom: 4 }}>PO Online</h1>
            <p style={{ fontSize: 13, color: "#64748B" }}>Daftar Purchase Order dari platform penjualan online</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowForm(true)} style={{ padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={16} /> Tambah PO Baru
          </button>
        </div>

        {/* Modal Form */}
        {showForm && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div style={{ background: "white", borderRadius: 24, padding: "32px", width: "100%", maxWidth: 500, boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: "#DBEAFE", color: "#1D4ED8", display: "flex", alignItems: "center", justifyContent: "center" }}><ShoppingBag size={20} /></div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", margin: 0 }}>Tambah PO Online</h2>
                </div>
                <button onClick={() => setShowForm(false)} style={{ background: "#F1F5F9", border: "none", width: 32, height: 32, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B" }}><X size={16} /></button>
              </div>
              
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>Kategori Jeans <span style={{color:"#EF4444"}}>*</span></label>
                  <select style={{ width: "100%", padding: "10px 14px", border: "1px solid #CBD5E1", borderRadius: 8, fontSize: 14 }} value={form.kategori} onChange={e => setForm(f => ({ ...f, kategori: e.target.value }))}>
                    <option value="">— Pilih kategori —</option>
                    {KATEGORI.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>Jumlah (pcs) <span style={{color:"#EF4444"}}>*</span></label>
                    <input type="number" style={{ width: "100%", padding: "10px 14px", border: "1px solid #CBD5E1", borderRadius: 8, fontSize: 14 }} value={form.jumlah} onChange={e => setForm(f => ({ ...f, jumlah: e.target.value }))} placeholder="50" min="1" />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>Tanggal Kirim Target <span style={{color:"#EF4444"}}>*</span></label>
                    <input type="date" style={{ width: "100%", padding: "10px 14px", border: "1px solid #CBD5E1", borderRadius: 8, fontSize: 14 }} value={form.tanggalKirim} onChange={e => setForm(f => ({ ...f, tanggalKirim: e.target.value }))} />
                  </div>
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>Catatan Tambahan</label>
                  <textarea rows={2} style={{ width: "100%", padding: "10px 14px", border: "1px solid #CBD5E1", borderRadius: 8, fontSize: 14, resize: "vertical" }} value={form.catatan} onChange={e => setForm(f => ({ ...f, catatan: e.target.value }))} placeholder="Opsional..." />
                </div>
                {error && <div style={{ background: "#FEF2F2", color: "#991B1B", padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700, marginBottom: 20 }}>⚠️ {error}</div>}
                
                <div style={{ display: "flex", gap: 12 }}>
                  <button type="button" onClick={() => setShowForm(false)} style={{ flex: 1, padding: "12px", background: "#F1F5F9", color: "#475569", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: "pointer" }}>Batal</button>
                  <button type="submit" disabled={saving} style={{ flex: 2, padding: "12px", background: "#3B82F6", color: "white", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>{saving ? "Menyimpan..." : "Simpan PO"}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Scrollable Table Area */}
        <div style={{ flex: 1, padding: "24px 32px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ flex: 1, background: "white", borderRadius: 20, border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column" }}>
            
            {loading ? (
              <div style={{ padding: 60, textAlign: "center", color: "#94A3B8" }}>⏳ Memuat data PO...</div>
            ) : list.length === 0 ? (
              <div style={{ padding: 60, textAlign: "center", color: "#94A3B8" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🛒</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", marginBottom: 4 }}>Belum ada PO</div>
                <div style={{ fontSize: 13 }}>Purchase Order baru akan muncul di sini</div>
              </div>
            ) : (
              <div style={{ overflow: "auto", flex: 1 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                    <tr style={{ background: "#F8FAFC" }}>
                      <th style={{ padding: "14px 20px", fontSize: 12, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "2px solid #E2E8F0" }}>No. PO / Kategori</th>
                      <th style={{ padding: "14px 20px", fontSize: 12, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "2px solid #E2E8F0" }}>Jumlah</th>
                      <th style={{ padding: "14px 20px", fontSize: 12, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "2px solid #E2E8F0" }}>Tgl Pesan</th>
                      <th style={{ padding: "14px 20px", fontSize: 12, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "2px solid #E2E8F0" }}>Target Kirim</th>
                      <th style={{ padding: "14px 20px", fontSize: 12, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "2px solid #E2E8F0" }}>Status</th>
                      <th style={{ padding: "14px 20px", fontSize: 12, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "2px solid #E2E8F0" }}>Update Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map(po => {
                      const warning = isDeadlineClose(po.tanggal_kirim) && po.status !== "terkirim";
                      const style = STATUS_STYLE[po.status] || STATUS_STYLE["baru"];
                      return (
                        <tr key={po.id} className="table-row-hover" style={{ background: warning ? "#FFFBEB" : "transparent", borderBottom: "1px solid #F1F5F9" }}>
                          <td style={{ padding: "16px 20px" }}>
                            <div style={{ fontWeight: 800, fontSize: 14, color: "#0F172A", fontFamily: "monospace" }}>{po.no_po}</div>
                            <div style={{ fontSize: 12, color: "#64748B", marginTop: 4, fontWeight: 700 }}>{po.kategori}</div>
                          </td>
                          <td style={{ padding: "16px 20px", fontWeight: 900, color: "#0F172A", fontSize: 14 }}>{po.jumlah} <span style={{fontSize: 12, color:"#94A3B8"}}>pcs</span></td>
                          <td style={{ padding: "16px 20px", fontSize: 13, color: "#334155" }}>{formatTgl(po.tanggal_po)}</td>
                          <td style={{ padding: "16px 20px" }}>
                            <span style={{ color: warning ? "#D97706" : "#334155", fontWeight: warning ? 800 : 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                              {formatTgl(po.tanggal_kirim)} {warning && "⚠️ Dekat"}
                            </span>
                          </td>
                          <td style={{ padding: "16px 20px" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", background: style.bg, color: style.color, borderRadius: 99, fontSize: 11, fontWeight: 800 }}>
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: style.dot, display: "inline-block" }} />
                              {STATUS_LABEL[po.status]}
                            </span>
                          </td>
                          <td style={{ padding: "16px 20px" }}>
                            <select style={{ background: "#F8FAFC", border: "1px solid #CBD5E1", outline: "none", fontSize: 12, fontWeight: 700, color: "#334155", padding: "6px 12px", borderRadius: 8, cursor: "pointer" }}
                              value={po.status} onChange={e => handleStatusChange(po.id, e.target.value)}>
                              <option value="baru">Baru</option>
                              <option value="diproses">Diproses</option>
                              <option value="siap-kirim">Siap Kirim</option>
                              <option value="terkirim">Terkirim</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
