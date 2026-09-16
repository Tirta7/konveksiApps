"use client";
import { useEffect, useState } from "react";
import { Plus, X, Store, ShoppingCart, BarChart2 } from "lucide-react";

const KATEGORI = ["Slim Fit","Regular Fit","Bootcut","Skinny","Wide Leg","Mom Jeans","Straight Cut","Cargo Jeans"];

function formatTgl(str: string) {
  if (!str) return "-";
  return new Date(str).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
}

export default function RetailOfflinePage() {
  const [data, setData] = useState<{ list: any[]; todayTotal: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ kategori: "", jumlah: "", tanggal: new Date().toISOString().split("T")[0], catatan: "" });
  const [saving, setSaving] = useState(false);

  const load = () => { fetch("/api/retail").then(r => r.json()).then(d => { setData(d); setLoading(false); }); };
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.kategori || !form.jumlah) return;
    setSaving(true);
    await fetch("/api/retail", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, jumlah: Number(form.jumlah) }) });
    setSaving(false);
    setShowForm(false);
    setForm({ kategori: "", jumlah: "", tanggal: new Date().toISOString().split("T")[0], catatan: "" });
    load();
  };

  const rekap: Record<string, number> = {};
  data?.list.forEach(s => { rekap[s.kategori] = (rekap[s.kategori] ?? 0) + s.jumlah; });

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
            <h1 style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", marginBottom: 4 }}>Retail Offline</h1>
            <p style={{ fontSize: 13, color: "#64748B" }}>Pencatatan penjualan di toko fisik (Kasir/POS)</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowForm(true)} style={{ padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", gap: 6, background: "#10B981", border: "none", color: "white", boxShadow: "0 4px 12px rgba(16,185,129,0.3)", cursor: "pointer" }}>
            <ShoppingCart size={16} /> Catat Penjualan
          </button>
        </div>

        {/* Modal Form */}
        {showForm && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div style={{ background: "white", borderRadius: 24, padding: "32px", width: "100%", maxWidth: 440, boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: "#DCFCE7", color: "#047857", display: "flex", alignItems: "center", justifyContent: "center" }}><Store size={20} /></div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", margin: 0 }}>Penjualan Baru</h2>
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
                    <input type="number" style={{ width: "100%", padding: "10px 14px", border: "1px solid #CBD5E1", borderRadius: 8, fontSize: 14 }} value={form.jumlah} onChange={e => setForm(f => ({ ...f, jumlah: e.target.value }))} min="1" placeholder="1" />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>Tanggal Transaksi <span style={{color:"#EF4444"}}>*</span></label>
                    <input type="date" style={{ width: "100%", padding: "10px 14px", border: "1px solid #CBD5E1", borderRadius: 8, fontSize: 14 }} value={form.tanggal} onChange={e => setForm(f => ({ ...f, tanggal: e.target.value }))} />
                  </div>
                </div>
                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>Catatan Pembeli</label>
                  <input type="text" style={{ width: "100%", padding: "10px 14px", border: "1px solid #CBD5E1", borderRadius: 8, fontSize: 14 }} value={form.catatan} onChange={e => setForm(f => ({ ...f, catatan: e.target.value }))} placeholder="Opsional..." />
                </div>
                
                <div style={{ display: "flex", gap: 12 }}>
                  <button type="button" onClick={() => setShowForm(false)} style={{ flex: 1, padding: "12px", background: "#F1F5F9", color: "#475569", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: "pointer" }}>Batal</button>
                  <button type="submit" disabled={saving || !form.kategori || !form.jumlah} style={{ flex: 2, padding: "12px", background: "#10B981", color: "white", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: saving ? "not-allowed" : "pointer", opacity: (saving || !form.kategori || !form.jumlah) ? 0.6 : 1 }}>
                    {saving ? "Menyimpan..." : "Simpan Penjualan"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Split Layout */}
        <div style={{ display: "flex", gap: 24, flex: 1, overflow: "hidden", padding: "24px 32px" }}>
          
          {/* Left Panel: Summary */}
          <div style={{ width: 360, flexShrink: 0, display: "flex", flexDirection: "column", gap: 20, overflowY: "auto", paddingRight: 8 }}>
            
            <div style={{ background: "white", borderRadius: 20, border: "1px solid #E2E8F0", padding: "24px", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div style={{ background: "#DCFCE7", color: "#10B981", padding: 8, borderRadius: 10 }}><Store size={20} /></div>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: 0 }}>Penjualan Hari Ini</h2>
              </div>
              <div style={{ fontSize: 40, fontWeight: 900, color: "#10B981", lineHeight: 1 }}>{data?.todayTotal ?? 0} <span style={{fontSize: 14, color: "#64748B", fontWeight: 700}}>pcs</span></div>
              <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 6, fontWeight: 600 }}>Total produk keluar di toko offline hari ini</div>
            </div>

            <div style={{ background: "white", borderRadius: 20, border: "1px solid #E2E8F0", padding: "24px", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                <div style={{ background: "#F1F5F9", color: "#3B82F6", padding: 8, borderRadius: 10 }}><BarChart2 size={20} /></div>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: 0 }}>Rekap Per Kategori</h2>
              </div>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {Object.entries(rekap).length === 0 ? <p style={{ fontSize: 13, color: "#94A3B8", textAlign: "center" }}>Belum ada data penjualan</p> : (
                  Object.entries(rekap).sort((a, b) => b[1] - a[1]).map(([kat, jml]) => (
                    <div key={kat} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, borderBottom: "1px solid #F1F5F9" }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: "#334155" }}>{kat}</span>
                      <span style={{ fontWeight: 900, fontSize: 14, color: "#10B981", background: "#DCFCE7", padding: "2px 8px", borderRadius: 6 }}>{jml} pcs</span>
                    </div>
                  ))
                )}
              </div>
            </div>
            
          </div>

          {/* Right Panel: Riwayat Tabel */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "white", borderRadius: 20, border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", alignItems: "center", gap: 10 }}>
              <h2 style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", margin: 0 }}>Riwayat Transaksi</h2>
            </div>
            <div style={{ flex: 1, overflow: "auto" }}>
              {loading ? (
                <div style={{ padding: 60, textAlign: "center", color: "#94A3B8" }}>⏳ Memuat data...</div>
              ) : !data?.list.length ? (
                <div style={{ padding: 60, textAlign: "center", color: "#94A3B8" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🏪</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", marginBottom: 4 }}>Belum ada transaksi</div>
                  <div style={{ fontSize: 13 }}>Transaksi offline yang ditambahkan akan muncul di sini</div>
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                    <tr style={{ background: "#F8FAFC" }}>
                      <th style={{ padding: "14px 24px", fontSize: 12, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "2px solid #E2E8F0" }}>Tanggal</th>
                      <th style={{ padding: "14px 24px", fontSize: 12, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "2px solid #E2E8F0" }}>Kategori</th>
                      <th style={{ padding: "14px 24px", fontSize: 12, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "2px solid #E2E8F0" }}>Jumlah Keluar</th>
                      <th style={{ padding: "14px 24px", fontSize: 12, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "2px solid #E2E8F0" }}>Catatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.list.map(s => (
                      <tr key={s.id} className="table-row-hover" style={{ borderBottom: "1px solid #F1F5F9" }}>
                        <td style={{ padding: "16px 24px", fontSize: 13, fontWeight: 700, color: "#334155" }}>{formatTgl(s.tanggal)}</td>
                        <td style={{ padding: "16px 24px", fontSize: 13, fontWeight: 800, color: "#0F172A" }}>{s.kategori}</td>
                        <td style={{ padding: "16px 24px", fontSize: 15, fontWeight: 900, color: "#10B981" }}>{s.jumlah} <span style={{fontSize: 12, color:"#94A3B8"}}>pcs</span></td>
                        <td style={{ padding: "16px 24px", fontSize: 13, color: "#64748B" }}>{s.catatan || "-"}</td>
                      </tr>
                    ))}
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
