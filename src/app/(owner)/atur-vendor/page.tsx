"use client";
import { useEffect, useState } from "react";
import { Plus, X, Pencil, Check, Briefcase, Factory } from "lucide-react";

export default function AturVendorPage() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ nama: "", jenis_default: "", kontak: "", wajib_hitung_ulang: false });
  const [saving, setSaving] = useState(false);

  const load = () => { setLoading(true); fetch("/api/vendors").then(r => r.json()).then(d => { setVendors(d); setLoading(false); }); };
  useEffect(() => { load(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nama) return;
    setSaving(true);
    if (editId) {
      await fetch("/api/vendors", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editId, ...form }) });
    } else {
      await fetch("/api/vendors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    }
    setSaving(false);
    setShowForm(false);
    setEditId(null);
    setForm({ nama: "", jenis_default: "", kontak: "", wajib_hitung_ulang: false });
    load();
  };

  const handleEdit = (v: any) => {
    setEditId(v.id);
    setForm({ nama: v.nama, jenis_default: v.jenis_default, kontak: v.kontak, wajib_hitung_ulang: v.wajib_hitung_ulang ?? false });
    setShowForm(true);
  };

  const handleToggleAktif = async (v: any) => {
    await fetch("/api/vendors", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: v.id, aktif: !v.aktif }) });
    load();
  };

  const aktif = vendors.filter(v => v.aktif);
  const nonaktif = vendors.filter(v => !v.aktif);

  return (
    <>
      <style>{`
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 99px; }
        .vendor-card-hover:hover { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(0,0,0,0.05) !important; border-color: #93C5FD !important; }
      `}</style>
      
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#F1F5F9", overflow: "hidden" }}>
        
        {/* Fixed Header */}
        <div style={{ padding: "24px 32px", background: "white", borderBottom: "1px solid #E2E8F0", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", marginBottom: 4 }}>Atur Vendor Produksi</h1>
            <p style={{ fontSize: 13, color: "#64748B" }}>Manajemen direktori vendor dan bengkel produksi jeans Anda</p>
          </div>
          <button className="btn btn-primary" onClick={() => { setShowForm(true); setEditId(null); setForm({ nama: "", jenis_default: "", kontak: "", wajib_hitung_ulang: false }); }} style={{ padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={16} /> Tambah Vendor
          </button>
        </div>

        {/* Modal Form */}
        {showForm && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div style={{ background: "white", borderRadius: 24, padding: "32px", width: "100%", maxWidth: 460, boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: "#F1F5F9", color: "#3B82F6", display: "flex", alignItems: "center", justifyContent: "center" }}><Factory size={20} /></div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", margin: 0 }}>{editId ? "Edit Vendor" : "Tambah Vendor Baru"}</h2>
                </div>
                <button onClick={() => setShowForm(false)} style={{ background: "#F1F5F9", border: "none", width: 32, height: 32, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B" }}><X size={16} /></button>
              </div>
              
              <form onSubmit={handleSave}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>Nama Vendor / Pabrik <span style={{color:"#EF4444"}}>*</span></label>
                  <input style={{ width: "100%", padding: "10px 14px", border: "1px solid #CBD5E1", borderRadius: 8, fontSize: 14 }} value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} placeholder="Contoh: Vendor D — Sablon Jaya" required />
                </div>
                
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>Keahlian Utama / Jenis Pekerjaan</label>
                  <input style={{ width: "100%", padding: "10px 14px", border: "1px solid #CBD5E1", borderRadius: 8, fontSize: 14 }} value={form.jenis_default} onChange={e => setForm(f => ({ ...f, jenis_default: e.target.value }))} placeholder="Contoh: Sablon, Bordir, Jahit, dll" />
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 6, fontWeight: 600 }}>Default ini bisa diubah secara kustom di tiap SPK.</div>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>Kontak WhatsApp</label>
                  <div style={{ display: "flex", alignItems: "center", border: "1px solid #CBD5E1", borderRadius: 8, overflow: "hidden" }}>
                    <div style={{ padding: "10px 14px", background: "#F1F5F9", fontSize: 14, fontWeight: 700, color: "#64748B", borderRight: "1px solid #CBD5E1" }}>+62</div>
                    <input style={{ flex: 1, padding: "10px 14px", border: "none", outline: "none", fontSize: 14 }} value={form.kontak} onChange={e => setForm(f => ({ ...f, kontak: e.target.value }))} placeholder="81234567890" />
                  </div>
                </div>

                <div style={{ marginBottom: 24, padding: "12px 14px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: "#0F172A", marginBottom: 6 }}>Proses Scan QR SPK</label>
                  <div style={{ fontSize: 11, color: "#64748B", marginBottom: 12 }}>Apakah vendor ini diwajibkan menghitung fisik ulang jumlah per size saat proses konfirmasi penerimaan barang?</div>
                  <div style={{ display: "flex", gap: 12 }}>
                    <label style={{ flex: 1, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: form.wajib_hitung_ulang ? "#EFF6FF" : "white", border: `1px solid ${form.wajib_hitung_ulang ? "#3B82F6" : "#CBD5E1"}`, borderRadius: 8 }}>
                      <input type="radio" name="wajib_hitung_ulang" checked={form.wajib_hitung_ulang === true} onChange={() => setForm(f => ({ ...f, wajib_hitung_ulang: true }))} style={{ accentColor: "#3B82F6" }} />
                      <span style={{ fontSize: 12, fontWeight: form.wajib_hitung_ulang ? 700 : 500, color: form.wajib_hitung_ulang ? "#1D4ED8" : "#475569" }}>Wajib Hitung</span>
                    </label>
                    <label style={{ flex: 1, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: !form.wajib_hitung_ulang ? "#EFF6FF" : "white", border: `1px solid ${!form.wajib_hitung_ulang ? "#3B82F6" : "#CBD5E1"}`, borderRadius: 8 }}>
                      <input type="radio" name="wajib_hitung_ulang" checked={form.wajib_hitung_ulang === false} onChange={() => setForm(f => ({ ...f, wajib_hitung_ulang: false }))} style={{ accentColor: "#3B82F6" }} />
                      <span style={{ fontSize: 12, fontWeight: !form.wajib_hitung_ulang ? 700 : 500, color: !form.wajib_hitung_ulang ? "#1D4ED8" : "#475569" }}>Langsung Saja</span>
                    </label>
                  </div>
                </div>
                
                <div style={{ display: "flex", gap: 12 }}>
                  <button type="button" onClick={() => setShowForm(false)} style={{ flex: 1, padding: "12px", background: "#F1F5F9", color: "#475569", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: "pointer" }}>Batal</button>
                  <button type="submit" disabled={saving || !form.nama} style={{ flex: 2, padding: "12px", background: "#3B82F6", color: "white", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: saving ? "not-allowed" : "pointer", opacity: (saving || !form.nama) ? 0.6 : 1 }}>
                    {saving ? "Menyimpan..." : editId ? "Simpan Perubahan" : "Simpan Vendor"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Scrollable Area */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
          
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", margin: 0 }}>Vendor Aktif</h2>
              <span style={{ background: "#DBEAFE", color: "#1E40AF", padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 900 }}>{aktif.length}</span>
            </div>
            
            {loading ? (
              <div style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontWeight: 600 }}>⏳ Memuat vendor...</div>
            ) : aktif.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", background: "white", borderRadius: 20, border: "1px dashed #CBD5E1" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🏭</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A", marginBottom: 4 }}>Belum ada vendor aktif</div>
                <div style={{ fontSize: 12, color: "#64748B" }}>Tambahkan vendor untuk mulai membuat rute SPK produksi.</div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                {aktif.map(v => (
                  <div key={v.id} className="vendor-card-hover" style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: 16, padding: "20px", display: "flex", flexDirection: "column", gap: 16, transition: "all 0.2s", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: "#EFF6FF", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Briefcase size={22} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 900, fontSize: 16, color: "#0F172A", marginBottom: 2 }}>{v.nama}</div>
                        {v.jenis_default ? (
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                            <span style={{ display: "inline-block", background: "#F1F5F9", color: "#475569", padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>{v.jenis_default}</span>
                            <span style={{ display: "inline-block", background: v.wajib_hitung_ulang ? "#FEF2F2" : "#F0FDF4", color: v.wajib_hitung_ulang ? "#991B1B" : "#166534", padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, border: `1px solid ${v.wajib_hitung_ulang ? "#FECACA" : "#DCFCE7"}` }}>{v.wajib_hitung_ulang ? "Wajib Hitung" : "Cepat (Bypass)"}</span>
                          </div>
                        ) : (
                          <span style={{ display: "inline-block", background: "#F1F5F9", color: "#94A3B8", padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, fontStyle: "italic" }}>Tidak ada keahlian default</span>
                        )}
                      </div>
                    </div>
                    
                    <div style={{ display: "flex", gap: 10, marginTop: "auto", borderTop: "1px dashed #E2E8F0", paddingTop: 16 }}>
                      {v.kontak ? (
                        <a href={`https://wa.me/62${v.kontak.replace(/^0/, "")}`} target="_blank" rel="noreferrer" style={{ flex: 1, padding: "8px", background: "#DCFCE7", color: "#065F46", textDecoration: "none", borderRadius: 8, fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, border: "1px solid #86EFAC" }}>
                          💬 Chat WA
                        </a>
                      ) : (
                        <div style={{ flex: 1, padding: "8px", background: "#F1F5F9", color: "#94A3B8", borderRadius: 8, fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                          Tanpa No HP
                        </div>
                      )}
                      
                      <button onClick={() => handleEdit(v)} style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "#F8FAFC", color: "#475569", border: "1px solid #CBD5E1", borderRadius: 8, cursor: "pointer" }}>
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => handleToggleAktif(v)} style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "#FEF2F2", color: "#991B1B", border: "1px solid #FECACA", borderRadius: 8, cursor: "pointer" }} title="Nonaktifkan Vendor">
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Vendor Nonaktif */}
          {nonaktif.length > 0 && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: "#64748B", margin: 0 }}>Vendor Dinonaktifkan</h2>
                <span style={{ background: "#F1F5F9", color: "#64748B", padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 900 }}>{nonaktif.length}</span>
              </div>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {nonaktif.map(v => (
                  <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", background: "white", border: "1px solid #E2E8F0", borderRadius: 12, opacity: 0.7 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: "#F1F5F9", color: "#94A3B8", display: "flex", alignItems: "center", justifyContent: "center" }}><Factory size={16} /></div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 14, color: "#475569", marginBottom: 2 }}>{v.nama}</div>
                        {v.jenis_default && <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600 }}>{v.jenis_default}</div>}
                      </div>
                    </div>
                    <button onClick={() => handleToggleAktif(v)} style={{ padding: "8px 16px", background: "#F8FAFC", color: "#334155", border: "1px solid #CBD5E1", borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                      <Check size={14} /> Aktifkan Lagi
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>
    </>
  );
}
