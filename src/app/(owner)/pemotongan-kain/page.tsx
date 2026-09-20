"use client";
import React, { useEffect, useState } from "react";
import { Plus, Scissors, Save, X, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function PemotonganKainPage() {
  const [data, setData] = useState<any[]>([]);
  const [tukangPotong, setTukangPotong] = useState<any[]>([]);
  const [dataKainList, setDataKainList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  const [submitStatus, setSubmitStatus] = useState("Selesai");
  const [form, setForm] = useState<{
    id?: number, tanggal: string, nama_barang: string, meter_kain: number, pemakaian_cm: string, tukang_potong_id: string, model: string, selectedRolls: any[], sizeBreakdown: any[]
  }>({ 
    tanggal: new Date().toISOString().split("T")[0], 
    nama_barang: "", 
    meter_kain: 0, 
    pemakaian_cm: "", 
    tukang_potong_id: "", 
    model: "",
    selectedRolls: [], // Array of roll objects selected
    sizeBreakdown: [{ size: "M", jumlah: "" }]
  });

  const fetchData = async () => {
    try {
      const [resPemotongan, resTukang, resKain] = await Promise.all([
        fetch("/api/pemotongan").then(r => r.json()),
        fetch("/api/tukang-potong").then(r => r.json()),
        fetch("/api/kain").then(r => r.json())
      ]);
      setData(resPemotongan);
      setTukangPotong(resTukang);
      setDataKainList(resKain);
    } catch (e) {
      toast.error("Gagal mengambil data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  const totalPcs = form.sizeBreakdown.reduce((sum, item) => sum + (Number(item.jumlah) || 0), 0);

  // Derive available rolls based on selected kain
  const selectedKainData = dataKainList.find(k => k.nama_kain === form.nama_barang);
  let availableRolls = selectedKainData?.rolls ? [...selectedKainData.rolls] : [];
  
  // Ensure previously selected rolls (from DB) are visible even if removed from data_kain
  if (form.selectedRolls && form.selectedRolls.length > 0) {
    const existingIds = availableRolls.map((r:any) => r.id);
    const toAdd = form.selectedRolls.filter((r:any) => !existingIds.includes(r.id));
    availableRolls = [...availableRolls, ...toAdd];
  }

  const handleRollToggle = (roll: any) => {
    const isSelected = form.selectedRolls.some(r => r.id === roll.id);
    let newSelected;
    if (isSelected) {
      // Remove
      newSelected = form.selectedRolls.filter(r => r.id !== roll.id);
    } else {
      // Add
      newSelected = [...form.selectedRolls, roll];
    }
    
    // Auto calculate total meter
    const totalMeter = newSelected.reduce((sum, r) => sum + r.meter, 0);
    const roundedTotal = Math.round(totalMeter * 1000) / 1000;
    setForm({ ...form, selectedRolls: newSelected, meter_kain: roundedTotal });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalPcs <= 0) return toast.error("Total potongan tidak valid");
    if (form.meter_kain <= 0) return toast.error("Total kain (meter) tidak valid. Harap pilih minimal 1 Roll kain.");
    
    try {
      const payload = { ...form, total_pcs: totalPcs, status: submitStatus };
      const url = form.id ? `/api/pemotongan/${form.id}` : "/api/pemotongan";
      const method = form.id ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        toast.success("Data pemotongan berhasil disimpan!");
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
    if (!confirm("Yakin ingin menghapus data pemotongan ini? (Stok kain akan dikembalikan)")) return;
    try {
      const res = await fetch(`/api/pemotongan/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Data pemotongan berhasil dihapus, stok dikembalikan");
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || "Gagal menghapus");
      }
    } catch (e) {
      toast.error("Terjadi kesalahan");
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
          <h1 className="page-title">Pemotongan Kain</h1>
          <p className="page-subtitle">Catat hasil potong bahan (berdasarkan Roll) untuk dialokasikan ke CMT.</p>
        </div>
        <button 
          className="btn btn-primary" 
          onClick={() => { 
            setForm({ id: undefined, tanggal: new Date().toISOString().split("T")[0], nama_barang: "", meter_kain: 0, pemakaian_cm: "", tukang_potong_id: "", model: "", selectedRolls: [], sizeBreakdown: [{ size: "M", jumlah: "" }] }); 
            setShowForm(true); 
          }}
        >
          <Plus size={18} /> Catat Potongan Baru
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 24, border: "2px solid var(--color-primary)" }}>
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", background: "#EFF6FF" }}>
            <h2 className="card-title" style={{ color: "var(--color-primary)", display: "flex", alignItems: "center", gap: 8 }}>
              <Scissors size={18} /> Form Input Hasil Potongan
            </h2>
            <button className="btn btn-secondary" onClick={() => setShowForm(false)} style={{ padding: 8 }}><X size={18} /></button>
          </div>
          <form onSubmit={handleSave} style={{ padding: 24 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label className="label">Tanggal Kirim / Potong</label>
                  <input required type="date" className="form-control" value={form.tanggal} onChange={e => setForm({...form, tanggal: e.target.value})} />
                </div>
                <div>
                  <label className="label">Tukang Potong</label>
                  <select required className="form-control" value={form.tukang_potong_id} onChange={e => setForm({...form, tukang_potong_id: e.target.value})}>
                    <option value="">-- Pilih Tukang Potong --</option>
                    {tukangPotong.map(tp => <option key={tp.id} value={tp.id}>{tp.nama} (Kode: {tp.kode})</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Sumber Kain (Dari Stok Gudang)</label>
                  <select required className="form-control" value={form.nama_barang} onChange={e => setForm({...form, nama_barang: e.target.value, selectedRolls: [], meter_kain: 0})}>
                    <option value="">-- Pilih Kain Mentah --</option>
                    {dataKainList.map(k => <option key={k.id} value={k.nama_kain}>{k.nama_kain} (Sisa: {Number(k.stok_meter).toFixed(2)} m)</option>)}
                  </select>
                </div>

                {/* Roll Selection UI */}
                {form.nama_barang && (
                  <div style={{ background: "#F1F5F9", padding: 16, borderRadius: 8, border: "1px solid #CBD5E1" }}>
                    <label className="label">Pilih Roll Kain yang Dipotong</label>
                    {availableRolls.length === 0 ? (
                      <div style={{ fontSize: 13, color: "#EF4444", fontWeight: 600 }}>Stok / Roll kain ini habis!</div>
                    ) : (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, maxHeight: 150, overflowY: "auto" }}>
                        {availableRolls.map((roll: any, idx: number) => {
                          const isSelected = form.selectedRolls.some(r => r.id === roll.id);
                          return (
                            <div 
                              key={idx}
                              onClick={() => handleRollToggle(roll)}
                              style={{ 
                                padding: "6px 12px", 
                                background: isSelected ? "#2563EB" : "white", 
                                color: isSelected ? "white" : "#334155",
                                border: isSelected ? "1px solid #2563EB" : "1px solid #CBD5E1",
                                borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 700,
                                display: "flex", alignItems: "center", gap: 6
                              }}
                            >
                              <div style={{ width: 14, height: 14, borderRadius: 3, border: isSelected ? "none" : "1px solid #94A3B8", background: isSelected ? "white" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {isSelected && <div style={{ width: 8, height: 8, background: "#2563EB", borderRadius: 1 }}/>}
                              </div>
                              {roll.meter} m
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label className="label">Total Diambil (Meter)</label>
                    <input type="number" readOnly className="form-control" style={{ background: "#F1F5F9", fontWeight: 700 }} value={form.meter_kain} placeholder="Otomatis" />
                  </div>
                  <div>
                    <label className="label">Pemakaian (cm/pcs)</label>
                    <input required type="number" className="form-control" value={form.pemakaian_cm} onChange={e => setForm({...form, pemakaian_cm: e.target.value})} placeholder="Contoh: 120" />
                    {form.meter_kain > 0 && Number(form.pemakaian_cm) > 0 && (
                      <div style={{ fontSize: 12, color: "#059669", marginTop: 8, fontWeight: 600 }}>
                        Estimasi Hasil: ~{Math.floor((form.meter_kain * 100) / Number(form.pemakaian_cm))} pcs (belum termasuk waste)
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="label">Model Pola</label>
                  <input required className="form-control" value={form.model} onChange={e => setForm({...form, model: e.target.value.toUpperCase()})} placeholder="Misal: GOMBRONG" />
                </div>
              </div>

              {/* Size Breakdown */}
              <div style={{ background: "#F8FAFC", padding: 16, borderRadius: 8, border: "1px solid var(--border-color)" }}>
                <label className="label">Rincian Ukuran Hasil Potong</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 16 }}>
                  {form.sizeBreakdown.map((item, idx) => {
                    const originalJumlah = Number(item.jumlah) || 0;
                    const distributed = item.sisa !== undefined ? (originalJumlah - Number(item.sisa)) : 0;
                    const currentJumlah = Number(item.jumlah) || 0;
                    const currentSisa = currentJumlah - distributed;

                    return (
                    <div key={idx} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input 
                          required 
                          className="form-control" 
                          style={{ width: "40%" }} 
                          placeholder="Size (S, M, L)" 
                          value={item.size} 
                          onChange={e => {
                            const newSize = [...form.sizeBreakdown];
                            newSize[idx].size = e.target.value.toUpperCase();
                            setForm({...form, sizeBreakdown: newSize});
                          }} 
                        />
                        <input 
                          required 
                          type="number" 
                          className="form-control" 
                          style={{ flex: 1 }} 
                          placeholder="Jumlah Potongan" 
                          value={item.jumlah} 
                          onChange={e => {
                            const newSize = [...form.sizeBreakdown];
                            newSize[idx].jumlah = e.target.value;
                            setForm({...form, sizeBreakdown: newSize});
                          }} 
                        />
                        {form.sizeBreakdown.length > 1 && (
                          <button type="button" className="btn btn-secondary" style={{ padding: "0 12px" }} onClick={() => {
                            const newSize = form.sizeBreakdown.filter((_, i) => i !== idx);
                            setForm({...form, sizeBreakdown: newSize});
                          }}><Trash2 size={16}/></button>
                        )}
                      </div>
                      {item.sisa !== undefined && (
                        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginLeft: "42%", paddingLeft: 8 }}>
                          Diambil CMT: <strong>{distributed} pcs</strong> &nbsp;|&nbsp; Sisa Stok: <strong>{currentSisa < 0 ? 0 : currentSisa} pcs</strong>
                        </div>
                      )}
                    </div>
                  )})}
                </div>
                <button type="button" className="btn btn-secondary" style={{ width: "100%" }} onClick={() => {
                  setForm({...form, sizeBreakdown: [...form.sizeBreakdown, { size: "", jumlah: "" }]})
                }}>+ Tambah Ukuran</button>

                <div style={{ marginTop: 24, padding: 16, background: "white", borderRadius: 8, border: "1px dashed var(--border-color)", textAlign: "center" }}>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 700 }}>Total Hasil Potongan</div>
                  <div style={{ fontSize: 32, fontWeight: 900, color: "var(--color-primary)" }}>{totalPcs} <span style={{ fontSize: 16 }}>pcs</span></div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button type="submit" className="btn btn-secondary" onClick={() => setSubmitStatus("Draft")} style={{ padding: "12px 24px", fontSize: 16 }}>Simpan Draft</button>
              <button type="submit" className="btn btn-primary" onClick={() => setSubmitStatus("Selesai")} style={{ padding: "12px 24px", fontSize: 16 }}><Save size={18} /> Simpan Data Potongan</button>
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
                <th>Tanggal</th>
                <th>Tukang Potong</th>
                <th>Kain / Model</th>
                <th>Jml Kain</th>
                <th>Hasil Potongan (Stock)</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {data.map(item => {
                const sisa = item.sizeBreakdown.reduce((sum:number, s:any) => sum + (s.sisa || 0), 0);
                return (
                  <tr key={item.id}>
                    <td>{item.tanggal}</td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{item.tukang_potong_nama}</div>
                      <div className="badge primary" style={{ fontSize: 10, marginTop: 4 }}>Kode: {item.tukang_potong_kode}</div>
                    </td>
                    <td>
                      <div><strong>Kain:</strong> {item.nama_barang}</div>
                      <div style={{ marginTop: 4 }}><strong>Model:</strong> {item.model}</div>
                      {item.selectedRolls && item.selectedRolls.length > 0 && (
                        <div style={{ marginTop: 6, fontSize: 11, color: "#64748B", background: "#F1F5F9", padding: "4px 8px", borderRadius: 4, display: "inline-block" }}>
                          Memotong {item.selectedRolls.length} Roll
                        </div>
                      )}
                    </td>
                    <td>{Number(item.meter_kain).toFixed(2)}m<br/><span style={{ fontSize:11, color:"gray" }}>({item.pemakaian_cm}cm/pcs)</span></td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ fontWeight: 800, fontSize: 16, color: "var(--color-primary)" }}>{item.total_pcs} pcs</div>
                        {sisa < item.total_pcs && (
                          <div className="badge secondary" style={{ fontSize: 11 }}>Sisa Stok: {sisa} pcs</div>
                        )}
                        {item.status === "Draft" && (
                          <div className="badge" style={{ fontSize: 11, background: "#F59E0B", color: "white" }}>Draft</div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
                        {item.sizeBreakdown.map((s:any, idx:number) => (
                          <div key={idx} style={{ padding: "2px 6px", background: "#F1F5F9", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                            {s.size}: {s.jumlah}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => {
                          setForm({
                            id: item.id,
                            tanggal: item.tanggal,
                            nama_barang: item.nama_barang,
                            meter_kain: item.meter_kain,
                            pemakaian_cm: item.pemakaian_cm,
                            tukang_potong_id: String(item.tukang_potong_id),
                            model: item.model,
                            selectedRolls: item.selectedRolls || [],
                            sizeBreakdown: item.sizeBreakdown || [{ size: "M", jumlah: "" }]
                          });
                          setSubmitStatus(item.status || "Selesai");
                          setShowForm(true);
                          window.scrollTo(0, 0);
                        }}>
                          <i className="fi fi-rr-edit" style={{ marginRight: 4 }} /> Edit
                        </button>
                        <button 
                          className="btn" 
                          style={{ 
                            padding: "6px 12px", 
                            fontSize: 12, 
                            background: sisa < item.total_pcs ? "#F3F4F6" : "#FEE2E2", 
                            color: sisa < item.total_pcs ? "#9CA3AF" : "#991B1B",
                            cursor: sisa < item.total_pcs ? "not-allowed" : "pointer",
                            opacity: sisa < item.total_pcs ? 0.7 : 1
                          }} 
                          onClick={() => {
                            if (sisa < item.total_pcs) {
                              alert("TIDAK DIIZINKAN: Sebagian/seluruh potongan kain ini sudah didistribusikan ke CMT (Sudah ada PO).");
                              return;
                            }
                            handleDelete(item.id);
                          }}
                        >
                          <i className="fi fi-rr-trash" style={{ marginRight: 4 }} /> Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {data.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: 32, color: "var(--text-secondary)" }}>
                    Belum ada data pemotongan kain.
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
