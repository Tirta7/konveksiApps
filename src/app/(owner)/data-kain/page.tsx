"use client";
import React, { useEffect, useState, useRef } from "react";
import { Plus, Edit2, Trash2, Save, X, ShoppingCart, Eye } from "lucide-react";
import { toast } from "sonner";

export default function DataKainPage() {
  const [data, setData] = useState<any[]>([]);
  const _bgRefresh = useRef(false);
  const [supplierList, setSupplierList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showForm, setShowForm] = useState(false);
  // Stok Awal dihilangkan, sisa Harga Beli untuk referensi
  const [form, setForm] = useState({ id: 0, nama_kain: "", warna: "", harga_beli: "" });

  const [showBeli, setShowBeli] = useState(false);
  const [beliForm, setBeliForm] = useState({
    tanggal: new Date().toISOString().split("T")[0],
    supplier_id: "",
    metode_pembayaran: "Tempo",
    status: "Diterima",
    catatan: "",
    items: [{ nama_kain: "", warna: "", roll: "", meter: 0, harga_meter: "", subtotal: 0, roll_details: [] as string[] }]
  });

  const [viewRolls, setViewRolls] = useState<any>(null); // For modal viewing rolls in stock

  const fetchData = async () => {
    if (!_bgRefresh.current) setLoading(true);
    try {
      const [resKain, resSup] = await Promise.all([
        fetch("/api/kain").then(r => r.json()),
        fetch("/api/supplier").then(r => r.json())
      ]);
      setData(resKain);
      setSupplierList(resSup);
    } catch (e) {
      toast.error("Gagal mengambil data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        stok_meter: 0 // Default 0 untuk katalog baru
      };
      const res = await fetch("/api/kain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        toast.success("Berhasil mendaftarkan kain");
        setShowForm(false);
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || "Gagal menyimpan");
      }
    } catch (e) {
      toast.error("Terjadi kesalahan");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Yakin ingin menghapus?")) return;
    try {
      const res = await fetch(`/api/kain?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Berhasil dihapus");
        fetchData();
      }
    } catch (e) {
      toast.error("Gagal menghapus");
    }
  };

  const openEdit = (item: any) => {
    setForm({ id: item.id, nama_kain: item.nama_kain, warna: item.warna, harga_beli: item.harga_beli });
    setShowForm(true);
  };

  // PEMBELIAN LOGIC
  const totalBeli = beliForm.items.reduce((sum, item) => sum + Number(item.subtotal), 0);

  const handleBeliItemChange = (idx: number, field: string, value: string) => {
    const newItems = [...beliForm.items];
    (newItems as any)[idx][field] = value;
    
    // Auto fill warna & harga beli
    if (field === "nama_kain") {
      const existing = data.find(d => d.nama_kain === value);
      if (existing) {
        newItems[idx].warna = existing.warna || "";
        if (existing.harga_beli > 0 && !newItems[idx].harga_meter) {
           newItems[idx].harga_meter = existing.harga_beli.toString();
        }
      }
    }

    // Dynamic Roll Inputs
    if (field === "roll") {
      const numRolls = parseInt(value) || 0;
      if (numRolls > 0 && numRolls <= 100) {
        // preserve existing values, add empty strings for new ones
        const currentDetails = newItems[idx].roll_details;
        const newDetails = Array(numRolls).fill("").map((_, i) => currentDetails[i] || "");
        newItems[idx].roll_details = newDetails;
      } else {
        newItems[idx].roll_details = [];
      }
      // Re-sum meter just in case
      const total = newItems[idx].roll_details.reduce((sum, val) => {
        const n = Number(String(val).replace(',', '.'));
        return sum + (isNaN(n) ? 0 : n);
      }, 0);
      newItems[idx].meter = Math.round(total * 1000) / 1000;
    }
    
    // Manual override Meter (if not using roll_details)
    if (field === "meter") {
      newItems[idx].meter = Number(value.replace(',', '.')) || 0;
    }

    // Kalkulasi subtotal
    if (field === "meter" || field === "harga_meter" || field === "roll") {
      newItems[idx].subtotal = Number(newItems[idx].meter) * Number(newItems[idx].harga_meter) || 0;
    }
    
    setBeliForm({...beliForm, items: newItems});
  };

  const handleRollDetailChange = (itemIdx: number, rollIdx: number, value: string) => {
    const newItems = [...beliForm.items];
    newItems[itemIdx].roll_details[rollIdx] = value;
    
    // Auto sum to total meter, replace comma with dot
    const totalMeter = newItems[itemIdx].roll_details.reduce((sum, val) => {
      const n = Number(String(val).replace(',', '.'));
      return sum + (isNaN(n) ? 0 : n);
    }, 0);
    newItems[itemIdx].meter = Math.round(totalMeter * 1000) / 1000;
    newItems[itemIdx].subtotal = newItems[itemIdx].meter * Number(newItems[itemIdx].harga_meter) || 0;
    
    setBeliForm({...beliForm, items: newItems});
  };

  const handleRemoveRollDetail = (itemIdx: number, rollIdx: number) => {
    const newItems = [...beliForm.items];
    newItems[itemIdx].roll_details = newItems[itemIdx].roll_details.filter((_, i) => i !== rollIdx);
    newItems[itemIdx].roll = newItems[itemIdx].roll_details.length.toString();
    
    // Auto sum to total meter, replace comma with dot
    const totalMeter = newItems[itemIdx].roll_details.reduce((sum, val) => {
      const n = Number(String(val).replace(',', '.'));
      return sum + (isNaN(n) ? 0 : n);
    }, 0);
    newItems[itemIdx].meter = Math.round(totalMeter * 1000) / 1000;
    newItems[itemIdx].subtotal = newItems[itemIdx].meter * Number(newItems[itemIdx].harga_meter) || 0;
    
    setBeliForm({...beliForm, items: newItems});
  };

  const handleSubmitBeli = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!beliForm.supplier_id || beliForm.items.some(i => !i.nama_kain || i.meter === 0 || !i.harga_meter)) {
      return toast.error("Harap lengkapi Supplier, item barang, dan pastikan total meter > 0.");
    }

    try {
      const res = await fetch("/api/pembelian", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(beliForm)
      });
      if (res.ok) {
        toast.success("Pembelian berhasil disimpan!");
        setShowBeli(false);
        fetchData();
        // Arahkan user ke halaman Pembelian PO untuk melihat hasil dan mengubah status
        window.location.href = "/pembelian";
      } else {
        const err = await res.json();
        toast.error(err.error || "Gagal memproses pembelian");
      }
    } catch (e) {
      toast.error("Terjadi kesalahan sistem");
    }
  };


  // Real-time sync: refresh data when another admin makes changes
  useEffect(() => {
    window.addEventListener("konveksi-sync", fetchData);
    return () => window.removeEventListener("konveksi-sync", fetchData);
  }, [fetchData]);
  return (
    <div style={{ padding: 32, background: "var(--bg-app)", minHeight: "100%" }}>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 className="page-title">Data Kain & Gudang</h1>
          <p className="page-subtitle">Kelola katalog kain dan pantau stok per-roll.</p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button 
            className="btn btn-secondary" 
            style={{ background: "white" }}
            onClick={() => { setForm({ id: 0, nama_kain: "", warna: "", harga_beli: "" }); setShowForm(true); setShowBeli(false); }}
          >
            <Plus size={18} /> Tambah Master Kain
          </button>
          <button 
            className="btn btn-primary" 
            onClick={() => { 
              setBeliForm({
                tanggal: new Date().toISOString().split("T")[0], supplier_id: "", metode_pembayaran: "Tempo", status: "Diterima", catatan: "",
                items: [{ nama_kain: "", warna: "", roll: "", meter: 0, harga_meter: "", subtotal: 0, roll_details: [] }]
              });
              setShowBeli(true); 
              setShowForm(false);
            }}
          >
            <ShoppingCart size={18} /> Pembelian (Barang Masuk)
          </button>
        </div>
      </div>

      {/* MODAL LIHAT DETAIL ROLL */}
      {viewRolls && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 20 }}>
          <div style={{ background: "white", width: "100%", maxWidth: 640, borderRadius: 20, overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,0.25)", display: "flex", flexDirection: "column", maxHeight: "90vh" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(135deg, #1E293B, #0F172A)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ShoppingCart size={20} color="#38BDF8" />
                </div>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 900, color: "white", margin: 0 }}>Rincian Roll</h2>
                  <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 2 }}>{viewRolls.nama_kain} ({viewRolls.warna})</div>
                </div>
              </div>
              <button onClick={() => setViewRolls(null)} style={{ background: "rgba(255,255,255,0.1)", border: "none", width: 32, height: 32, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "white", transition: "background 0.2s" }} onMouseOver={e => e.currentTarget.style.background = "rgba(255,255,255,0.2)"} onMouseOut={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}>
                <X size={16} />
              </button>
            </div>
            
            <div style={{ padding: 24, overflowY: "auto", background: "#F8FAFC" }}>
              {(!viewRolls.rolls || viewRolls.rolls.length === 0) ? (
                <div style={{ textAlign: "center", color: "#64748B", padding: "40px 20px" }}>
                  <ShoppingCart size={32} color="#CBD5E1" style={{ margin: "0 auto 12px" }} />
                  <div style={{ fontSize: 15, fontWeight: 700 }}>Tidak ada rincian roll</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>Data roll tidak tersedia untuk item ini.</div>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, background: "white", padding: "12px 16px", borderRadius: 12, border: "1px solid #E2E8F0" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 13, color: "#64748B", fontWeight: 600 }}>Total Roll:</span>
                      <span style={{ fontSize: 15, fontWeight: 900, color: "#0F172A", background: "#F1F5F9", padding: "4px 10px", borderRadius: 8 }}>{viewRolls.rolls.length}</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 13, color: "#64748B", fontWeight: 600 }}>Total Meter:</span>
                      <span style={{ fontSize: 15, fontWeight: 900, color: "#059669", background: "#D1FAE5", padding: "4px 10px", borderRadius: 8 }}>
                        {viewRolls.rolls.reduce((sum: number, r: any) => sum + Number(typeof r === 'object' ? (r.meter || 0) : (r || 0)), 0)} <span style={{ fontSize: 12, color: "#047857" }}>m</span>
                      </span>
                    </div>
                  </div>
                  
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 12 }}>
                    {viewRolls.rolls.map((r: any, i: number) => {
                      const meter = typeof r === 'object' ? (r.meter || 0) : (r || 0);
                      return (
                        <div key={i} style={{ 
                          background: "white", 
                          borderRadius: 12, 
                          textAlign: "center", 
                          border: "1px solid #E2E8F0",
                          boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
                          overflow: "hidden",
                          transition: "transform 0.2s, box-shadow 0.2s"
                        }}
                        onMouseOver={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 16px rgba(0,0,0,0.06)"; }}
                        onMouseOut={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.02)"; }}
                        >
                          <div style={{ background: "#F1F5F9", padding: "6px 0", fontSize: 11, color: "#64748B", fontWeight: 800, borderBottom: "1px solid #E2E8F0", letterSpacing: 0.5 }}>
                            ROLL {i+1}
                          </div>
                          <div style={{ padding: "16px 10px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                            <div style={{ fontSize: 20, fontWeight: 900, color: "#0F172A", lineHeight: 1 }}>
                              {meter} <span style={{ fontSize: 12, fontWeight: 600, color: "#94A3B8", marginLeft: 2 }}>m</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showBeli && (
        <div className="card" style={{ marginBottom: 24, border: "2px solid var(--color-primary)" }}>
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", background: "#EFF6FF" }}>
            <h2 className="card-title" style={{ color: "var(--color-primary)" }}>Form Pembelian Kain Baru (Barang Masuk)</h2>
            <button className="btn btn-secondary" onClick={() => setShowBeli(false)} style={{ padding: 8 }}><X size={18} /></button>
          </div>
          <form onSubmit={handleSubmitBeli} style={{ padding: 24 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
              <div>
                <label className="label">Tanggal</label>
                <input type="date" required className="form-control" value={beliForm.tanggal} onChange={e => setBeliForm({...beliForm, tanggal: e.target.value})} />
              </div>
              <div>
                <label className="label">Supplier</label>
                <select required className="form-control" value={beliForm.supplier_id} onChange={e => setBeliForm({...beliForm, supplier_id: e.target.value})}>
                  <option value="">-- Pilih Supplier --</option>
                  {supplierList.map(s => <option key={s.id} value={s.id}>{s.nama_supplier}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Metode Pembayaran</label>
                <select required className="form-control" value={beliForm.metode_pembayaran} onChange={e => setBeliForm({...beliForm, metode_pembayaran: e.target.value})}>
                  <option value="Tempo">Tempo (Hutang)</option>
                  <option value="Cash">Cash / Lunas</option>
                  <option value="Transfer">Transfer Bank</option>
                </select>
              </div>
              <div>
                <label className="label">Status Penerimaan</label>
                <select required className="form-control" value={beliForm.status} onChange={e => setBeliForm({...beliForm, status: e.target.value})}>
                  <option value="Diterima">Diterima (Langsung Masuk Gudang)</option>
                  <option value="Dikirim">Dalam Pengiriman</option>
                  <option value="PO">PO / Pesan</option>
                </select>
              </div>
            </div>

            <div style={{ background: "#F8FAFC", padding: 16, borderRadius: 8, border: "1px solid var(--border-color)", marginBottom: 16 }}>
              <label className="label">Detail Item Kain</label>
              {beliForm.items.map((item, idx) => (
                <div key={idx} style={{ marginBottom: 16, padding: 16, background: "white", borderRadius: 8, border: "1px solid #E2E8F0", position: "relative" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 80px 100px 150px 150px", gap: 12, alignItems: "flex-end" }}>
                    <div>
                      <label className="label" style={{ fontSize: 11 }}>Nama Kain</label>
                      <datalist id="kain-options">
                        {data.map(k => <option key={k.id} value={k.nama_kain} />)}
                      </datalist>
                      <input required className="form-control" list="kain-options" placeholder="Pilih / Ketik Baru" value={item.nama_kain} onChange={e => handleBeliItemChange(idx, "nama_kain", e.target.value)} />
                    </div>
                    <div>
                      <label className="label" style={{ fontSize: 11 }}>Warna</label>
                      <input className="form-control" placeholder="Warna" value={item.warna} onChange={e => handleBeliItemChange(idx, "warna", e.target.value)} />
                    </div>
                    <div>
                      <label className="label" style={{ fontSize: 11 }}>Jml Roll</label>
                      <input type="number" min="0" max="100" className="form-control" placeholder="0" value={item.roll} onChange={e => handleBeliItemChange(idx, "roll", e.target.value)} />
                    </div>
                    <div>
                      <label className="label" style={{ fontSize: 11 }}>Total (m)</label>
                      <input type="number" step="0.01" readOnly={item.roll_details.length > 0} className="form-control" style={{ background: item.roll_details.length > 0 ? "#F1F5F9" : "white" }} placeholder="Meter" value={item.meter} onChange={e => handleBeliItemChange(idx, "meter", e.target.value)} />
                    </div>
                    <div>
                      <label className="label" style={{ fontSize: 11 }}>Harga/m (Rp)</label>
                      <input type="number" required className="form-control" placeholder="Harga" value={item.harga_meter} onChange={e => handleBeliItemChange(idx, "harga_meter", e.target.value)} />
                    </div>
                    <div>
                      <label className="label" style={{ fontSize: 11 }}>Subtotal (Rp)</label>
                      <div style={{ padding: "10px 12px", background: "#F1F5F9", borderRadius: 8, fontWeight: 700, textAlign: "right", border: "1px solid #CBD5E1" }}>
                        {item.subtotal.toLocaleString("id-ID")}
                      </div>
                    </div>
                    {beliForm.items.length > 1 && (
                      <button type="button" style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", cursor: "pointer", color: "#EF4444" }} onClick={() => setBeliForm({...beliForm, items: beliForm.items.filter((_, i) => i !== idx)})}>
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  {/* Dinamis Input Roll */}
                  {item.roll_details.length > 0 && (
                    <div style={{ marginTop: 16, padding: "12px", background: "#F8FAFC", borderRadius: 8, border: "1px dashed #CBD5E1" }}>
                      <label className="label" style={{ fontSize: 11, marginBottom: 8 }}>Masukkan Panjang Meter per Roll:</label>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {item.roll_details.map((rd, rIdx) => (
                          <div key={rIdx} style={{ display: "flex", alignItems: "center", background: "white", border: "1px solid #E2E8F0", borderRadius: 6, padding: "4px 8px", width: 140 }}>
                            <span style={{ fontSize: 11, color: "#64748B", marginRight: 8, fontWeight: 700 }}>#{rIdx+1}</span>
                            <input 
                              type="text" 
                              inputMode="decimal"
                              placeholder="0" 
                              value={rd} 
                              onChange={(e) => handleRollDetailChange(idx, rIdx, e.target.value)}
                              style={{ border: "none", outline: "none", width: "100%", fontSize: 14, fontWeight: 600 }}
                              required
                            />
                            <button 
                              type="button" 
                              onClick={() => handleRemoveRollDetail(idx, rIdx)}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "#EF4444", padding: 4, display: "flex", alignItems: "center" }}
                              title="Hapus roll ini"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              ))}
              <button type="button" className="btn btn-secondary" onClick={() => setBeliForm({...beliForm, items: [...beliForm.items, { nama_kain: "", warna: "", roll: "", meter: 0, harga_meter: "", subtotal: 0, roll_details: [] }]})}>
                + Tambah Item Kain
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ flex: 1, marginRight: 24 }}>
                <input className="form-control" placeholder="Catatan Tambahan..." value={beliForm.catatan} onChange={e => setBeliForm({...beliForm, catatan: e.target.value})} />
              </div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>Total Tagihan: <span style={{ color: "var(--color-primary)" }}>Rp {totalBeli.toLocaleString("id-ID")}</span></div>
            </div>

            <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
              <button type="submit" className="btn btn-primary" style={{ padding: "12px 24px", fontSize: 16 }}><Save size={18} /> Simpan Pembelian</button>
            </div>
          </form>
        </div>
      )}

      {/* FORM MASTER MANUAL */}
      {showForm && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between" }}>
            <h2 className="card-title">{form.id ? "Edit Katalog Kain" : "Tambah Katalog Master Kain (Tanpa Stok)"}</h2>
            <button className="btn btn-secondary" onClick={() => setShowForm(false)} style={{ padding: 8 }}><X size={18} /></button>
          </div>
          <form onSubmit={handleSave} style={{ padding: 24 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <div>
                <label className="label">Nama Kain</label>
                <input required className="form-control" value={form.nama_kain || ""} onChange={e => setForm({...form, nama_kain: e.target.value})} placeholder="Contoh: Denim 12oz Hitam" />
              </div>
              <div>
                <label className="label">Warna / Kode</label>
                <input className="form-control" value={form.warna || ""} onChange={e => setForm({...form, warna: e.target.value})} placeholder="Contoh: Hitam Pekat" />
              </div>
              <div>
                <label className="label">Harga Beli Standar (Rp/Meter)</label>
                <input type="number" className="form-control" value={form.harga_beli || ""} onChange={e => setForm({...form, harga_beli: e.target.value})} placeholder="Sebagai referensi saat form PO" />
              </div>
            </div>
            <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
              <button type="submit" className="btn btn-primary"><Save size={18} /> Simpan Data</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div>Memuat data...</div>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Nama Kain</th>
                <th>Warna / Keterangan</th>
                <th>Stok Saat Ini (Meter)</th>
                <th>Harga Rata-Rata (Rp/m)</th>
                <th style={{ width: 180, textAlign: "right" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {data.map(item => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600, color: "#0F172A" }}>{item.nama_kain}</td>
                  <td>{item.warna || "-"}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div className={`badge ${item.stok_meter > 0 ? "success" : "danger"}`} style={{ fontSize: 14 }}>
                        {Number(item.stok_meter).toFixed(2)} m
                      </div>
                      {item.rolls && item.rolls.length > 0 && (
                        <span style={{ fontSize: 12, color: "#64748B", fontWeight: 700 }}>
                          ({item.rolls.length} Roll)
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>
                      Rp {Number(item.harga_beli || 0).toLocaleString("id-ID")}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button className="btn btn-secondary" onClick={() => setViewRolls(item)} style={{ padding: "6px 12px", background: "#EFF6FF", color: "#3B82F6", border: "none" }} title="Lihat Detail Roll">
                        <Eye size={16} />
                      </button>
                      <button className="btn btn-secondary" onClick={() => openEdit(item)} style={{ padding: "6px 12px", border: "none" }}>
                        <Edit2 size={16} />
                      </button>
                      <button className="btn btn-danger" onClick={() => handleDelete(item.id)} style={{ padding: "6px 12px", border: "none" }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: 32, color: "var(--text-secondary)" }}>
                    Belum ada data Kain di Gudang.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

