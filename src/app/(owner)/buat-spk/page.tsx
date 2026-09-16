"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Trash2, QrCode, Copy, Check, ArrowDown, Scissors, Layers, CheckCircle } from "lucide-react";

function BuatSPKContent() {
  const searchParams = useSearchParams();
  const isReturMode = searchParams.get("retur") === "1";
  const returBatchId = searchParams.get("batchId") ? Number(searchParams.get("batchId")) : null;

  const [vendors, setVendors] = useState<any[]>([]);
  const [form, setForm] = useState({ jenis_kain: "", jumlah_pcs: "", jumlah_meter: "", catatan_route: "" });
  const [steps, setSteps] = useState<any[]>([{ vendor_id: "", jenis_pekerjaan: "", jumlah_barang: "", deadline: "", catatan: "" }]);
  const [sizeBreakdown, setSizeBreakdown] = useState<{size:string;jumlah:number}[]>([{ size: "L", jumlah: 0 }, { size: "XL", jumlah: 0 }]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [parentBatch, setParentBatch] = useState<any>(null);
  const [defectiveCodes, setDefectiveCodes] = useState<string[]>([]);

  // Lock parent scroll
  useEffect(() => {
    const el = document.querySelector(".app-content") as HTMLElement;
    if (el) { el.style.overflow = "hidden"; el.style.padding = "0"; el.style.height = "100vh"; }
    return () => { if (el) { el.style.overflow = ""; el.style.padding = ""; el.style.height = ""; } };
  }, []);

  useEffect(() => {
    if (isReturMode && returBatchId) {
      fetch("/api/spk").then(r => r.json()).then((list: any[]) => {
        const found = list.find((b: any) => b.id === returBatchId);
        if (found) {
          setParentBatch(found);
          setForm(f => ({ ...f, jenis_kain: found.jenis_kain, catatan_route: `Retur dari ${found.kode_batch}` }));
          
          const cacatSizes = (found.size_breakdown ?? []).filter((s: any) => (s.cacat ?? 0) > 0);
          if (cacatSizes.length > 0) {
            setSizeBreakdown(cacatSizes.map((s: any) => ({ size: s.size, jumlah: s.cacat })));
            const totalCacat = cacatSizes.reduce((sum: number, s: any) => sum + s.cacat, 0);
            setForm(f => ({ ...f, jumlah_pcs: String(totalCacat) }));
            setSteps([{ vendor_id: "", jenis_pekerjaan: "", jumlah_barang: String(totalCacat), deadline: "", catatan: "" }]);
            
            let codes: string[] = [];
            for (const sz of cacatSizes) {
              const jumlah = sz.jumlah || 0;
              const cacat = sz.cacat || 0;
              const start = jumlah - cacat + 1;
              for (let i = start; i <= jumlah; i++) {
                codes.push(`${found.kode_batch}-${sz.size}-${String(i).padStart(4, "0")}`);
              }
            }
            setDefectiveCodes(codes);
          }
        }
      });
    }
  }, [isReturMode, returBatchId]);

  useEffect(() => {
    fetch("/api/vendors").then(r => r.json()).then(d => setVendors(d.filter((v: any) => v.aktif)));
  }, []);

  const addStep = () => setSteps(s => [...s, { vendor_id: "", jenis_pekerjaan: "", jumlah_barang: "", deadline: "", catatan: "" }]);
  const removeStep = (i: number) => setSteps(s => s.filter((_, idx) => idx !== i));
  const updateStep = (i: number, field: string, val: string) => setSteps(s => s.map((step, idx) => idx === i ? { ...step, [field]: val } : step));

  const addSize = () => setSizeBreakdown(s => [...s, { size: "", jumlah: 0 }]);
  const removeSize = (i: number) => setSizeBreakdown(s => s.filter((_, idx) => idx !== i));
  const updateSize = (i: number, field: string, val: string | number) => setSizeBreakdown(s => s.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  
  const totalSizes = sizeBreakdown.reduce((s, r) => s + (r.jumlah || 0), 0);
  const jumlahPcs = Number(form.jumlah_pcs) || 0;
  const sizeMatch = jumlahPcs === 0 || totalSizes === jumlahPcs;

  const onVendorChange = (i: number, vendorId: string) => {
    const vendor = vendors.find((v: any) => String(v.id) === vendorId);
    setSteps(s => s.map((step, idx) => idx === i ? { ...step, vendor_id: vendorId, jenis_pekerjaan: vendor?.jenis_default || step.jenis_pekerjaan } : step));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.jenis_kain) return setError("Jenis kain wajib diisi.");
    if (jumlahPcs > 0 && !sizeMatch) return setError(`Total size (${totalSizes} pcs) tidak sama dengan jumlah SPK (${jumlahPcs} pcs). Sesuaikan breakdown size.`);
    for (const [i, s] of steps.entries()) {
      if (!s.vendor_id) return setError(`Step ${i + 1}: Pilih vendor terlebih dahulu.`);
      if (!s.jenis_pekerjaan) return setError(`Step ${i + 1}: Jenis pekerjaan wajib diisi.`);
      if (!s.jumlah_barang) return setError(`Step ${i + 1}: Jumlah barang wajib diisi.`);
    }
    setLoading(true);
    const res = await fetch("/api/spk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        jumlah_pcs: Number(form.jumlah_pcs) || undefined,
        jumlah_meter: Number(form.jumlah_meter) || undefined,
        size_breakdown: sizeBreakdown.filter(s => s.size && s.jumlah > 0).map(s => ({ size: s.size, jumlah: s.jumlah, cacat: 0 })),
        steps: steps.map(s => ({ ...s, vendor_id: Number(s.vendor_id), jumlah_barang: Number(s.jumlah_barang) })),
        is_retur: isReturMode ? true : undefined,
        parent_batch_id: isReturMode && returBatchId ? returBatchId : undefined,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.error) return setError(data.error);
    setResult(data);
  };

  const [qrBaseUrl, setQrBaseUrl] = useState("");
  useEffect(() => { if (typeof window !== "undefined") setQrBaseUrl(window.location.origin); }, []);

  const spkUrl = result ? `${qrBaseUrl}/spk/${result.token}` : "";
  const handleCopy = () => { navigator.clipboard.writeText(spkUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const handleReset = () => { setResult(null); setForm({ jenis_kain: "", jumlah_pcs: "", jumlah_meter: "", catatan_route: "" }); setSteps([{ vendor_id: "", jenis_pekerjaan: "", jumlah_barang: "", deadline: "", catatan: "" }]); };

  const doneCount = form.jenis_kain ? 1 : 0;
  const progressPct = ((doneCount + (sizeMatch && totalSizes > 0 ? 1 : 0) + (steps[0].vendor_id ? 1 : 0)) / 3) * 100;

  return (
    <>
      <style>{`
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 99px; }
      `}</style>
      
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#F1F5F9", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "24px 32px", background: "white", borderBottom: "1px solid #E2E8F0", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", marginBottom: 4 }}>
              {isReturMode ? "🔄 Buat SPK Retur" : "Buat SPK Baru"}
            </h1>
            <p style={{ fontSize: 13, color: "#64748B" }}>
              {isReturMode ? "Proses ulang item cacat agar stok kembali balance" : "Terbitkan SPK dengan satu QR Code dinamis untuk semua urutan vendor"}
            </p>
          </div>
          {/* Progress Indikator */}
          <div style={{ width: 200 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, color: "#64748B", marginBottom: 6 }}>
              <span>Kelengkapan Data</span>
              <span>{Math.round(progressPct)}%</span>
            </div>
            <div style={{ height: 6, background: "#E2E8F0", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", background: "#3B82F6", width: `${progressPct}%`, transition: "width 0.3s ease" }} />
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          
          {/* Left Panel: Form Input (Scrollable) */}
          <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
            <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
              
              {isReturMode && parentBatch && (
                <div style={{ background: "#FEF3C7", border: "1px solid #F59E0B", borderRadius: 16, padding: "16px 20px", display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <span style={{ fontSize: 28, marginTop: 2 }}>🔄</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, color: "#92400E", fontSize: 16 }}>Mode SPK Retur — {parentBatch.kode_batch}</div>
                    <div style={{ fontSize: 13, color: "#78350F", marginTop: 4 }}>
                      {parentBatch.jenis_kain} &bull; {(parentBatch.size_breakdown ?? []).filter((s: any) => s.cacat > 0).map((s: any) => `Size ${s.size}: ${s.cacat}`).join(", ")}
                    </div>
                    {defectiveCodes.length > 0 && (
                      <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {defectiveCodes.map(code => (
                          <span key={code} style={{ fontSize: 11, background: "#FDE68A", color: "#92400E", padding: "3px 8px", borderRadius: 6, fontWeight: 700, fontFamily: "monospace" }}>{code}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Box 1: Info Batch */}
              <div style={{ background: "white", borderRadius: 20, border: "1px solid #E2E8F0", padding: "24px 28px", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
                  <div style={{ background: "#EFF6FF", color: "#3B82F6", padding: 8, borderRadius: 10 }}><Layers size={20} /></div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", margin: 0 }}>Info Batch Kain</h2>
                </div>
                
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>Jenis Kain <span style={{color:"#EF4444"}}>*</span></label>
                    <input style={{ width: "100%", padding: "10px 14px", border: "1px solid #CBD5E1", borderRadius: 8, fontSize: 14 }} value={form.jenis_kain} onChange={e => setForm(f => ({ ...f, jenis_kain: e.target.value }))} placeholder="Contoh: Denim Biru 12oz" />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>Jumlah (pcs)</label>
                    <input type="number" style={{ width: "100%", padding: "10px 14px", border: "1px solid #CBD5E1", borderRadius: 8, fontSize: 14 }} value={form.jumlah_pcs} onChange={e => setForm(f => ({ ...f, jumlah_pcs: e.target.value }))} placeholder="300" />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>Jumlah (meter)</label>
                    <input type="number" style={{ width: "100%", padding: "10px 14px", border: "1px solid #CBD5E1", borderRadius: 8, fontSize: 14 }} value={form.jumlah_meter} onChange={e => setForm(f => ({ ...f, jumlah_meter: e.target.value }))} placeholder="150" />
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>Catatan Umum</label>
                  <input style={{ width: "100%", padding: "10px 14px", border: "1px solid #CBD5E1", borderRadius: 8, fontSize: 14 }} value={form.catatan_route} onChange={e => setForm(f => ({ ...f, catatan_route: e.target.value }))} placeholder="Opsional" />
                </div>
              </div>

              {/* Box 2: Size Breakdown */}
              <div style={{ background: "white", borderRadius: 20, border: "1px solid #E2E8F0", padding: "24px 28px", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ background: "#F0FDF4", color: "#10B981", padding: 8, borderRadius: 10 }}><Scissors size={20} /></div>
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", margin: 0 }}>Breakdown Size</h2>
                  </div>
                  <button type="button" onClick={addSize} style={{ padding: "6px 12px", background: "#F1F5F9", color: "#334155", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                    <Plus size={14} /> Tambah Size
                  </button>
                </div>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {sizeBreakdown.map((row, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", background: "#F8FAFC", padding: 12, borderRadius: 12, border: "1px solid #E2E8F0" }}>
                      <input style={{ flex: 1, padding: "8px 12px", border: "1px solid #CBD5E1", borderRadius: 6, fontSize: 13, fontWeight: 700 }} placeholder="Size (L, XL)" value={row.size} onChange={e => updateSize(i, "size", e.target.value.toUpperCase())} />
                      <input type="number" style={{ width: 80, padding: "8px 12px", border: "1px solid #CBD5E1", borderRadius: 6, fontSize: 13 }} placeholder="Pcs" value={row.jumlah || ""} onChange={e => updateSize(i, "jumlah", parseInt(e.target.value) || 0)} />
                      <button type="button" onClick={() => removeSize(i)} disabled={sizeBreakdown.length <= 1} style={{ background: "none", border: "none", color: sizeBreakdown.length <= 1 ? "#CBD5E1" : "#EF4444", cursor: "pointer", padding: 4 }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 10, background: sizeMatch ? "#F0FDF4" : "#FEF2F2", border: `1px solid ${sizeMatch ? "#86EFAC" : "#FECACA"}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: sizeMatch ? "#065F46" : "#991B1B" }}>Total size: {totalSizes} pcs</span>
                  {jumlahPcs > 0 && (
                    <span style={{ fontSize: 12, color: sizeMatch ? "#16A34A" : "#EF4444", fontWeight: 700 }}>
                      {sizeMatch ? `✅ Sesuai SPK (${jumlahPcs} pcs)` : `⚠️ Selisih ${Math.abs(jumlahPcs - totalSizes)} pcs dari total SPK`}
                    </span>
                  )}
                </div>
              </div>

              {/* Box 3: Route Vendor */}
              <div style={{ background: "white", borderRadius: 20, border: "1px solid #E2E8F0", padding: "24px 28px", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ background: "#FEF3C7", color: "#D97706", padding: 8, borderRadius: 10 }}><ArrowDown size={20} /></div>
                    <div>
                      <h2 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", margin: 0, marginBottom: 2 }}>Route Produksi</h2>
                      <div style={{ fontSize: 12, color: "#64748B" }}>Tentukan urutan vendor pengerjaan secara berurutan</div>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {steps.map((step, i) => (
                    <div key={i} style={{ display: "flex", gap: 16, background: i % 2 === 0 ? "#F8FAFC" : "white", border: "1px solid #E2E8F0", padding: 20, borderRadius: 16 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#3B82F6", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                        {i + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                          <div style={{ flex: 1.5 }}>
                            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 4 }}>Vendor <span style={{color:"#EF4444"}}>*</span></label>
                            <select style={{ width: "100%", padding: "8px 12px", border: "1px solid #CBD5E1", borderRadius: 8, fontSize: 13 }} value={step.vendor_id} onChange={e => onVendorChange(i, e.target.value)}>
                              <option value="">— Pilih vendor —</option>
                              {vendors.map((v: any) => <option key={v.id} value={v.id}>{v.nama}</option>)}
                            </select>
                          </div>
                          <div style={{ flex: 1.5 }}>
                            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 4 }}>Jenis Pekerjaan <span style={{color:"#EF4444"}}>*</span></label>
                            <input style={{ width: "100%", padding: "8px 12px", border: "1px solid #CBD5E1", borderRadius: 8, fontSize: 13 }} value={step.jenis_pekerjaan} onChange={e => updateStep(i, "jenis_pekerjaan", e.target.value)} placeholder="Contoh: Potong" />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 4 }}>Jumlah (pcs) <span style={{color:"#EF4444"}}>*</span></label>
                            <input type="number" style={{ width: "100%", padding: "8px 12px", border: "1px solid #CBD5E1", borderRadius: 8, fontSize: 13 }} value={step.jumlah_barang} onChange={e => updateStep(i, "jumlah_barang", e.target.value)} placeholder="300" />
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 12 }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 4 }}>Deadline Target</label>
                            <input type="date" style={{ width: "100%", padding: "8px 12px", border: "1px solid #CBD5E1", borderRadius: 8, fontSize: 13 }} value={step.deadline} onChange={e => updateStep(i, "deadline", e.target.value)} />
                          </div>
                          <div style={{ flex: 2 }}>
                            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 4 }}>Instruksi Khusus Vendor</label>
                            <input style={{ width: "100%", padding: "8px 12px", border: "1px solid #CBD5E1", borderRadius: 8, fontSize: 13 }} value={step.catatan} onChange={e => updateStep(i, "catatan", e.target.value)} placeholder="Opsional" />
                          </div>
                        </div>
                      </div>
                      {steps.length > 1 && (
                        <button type="button" onClick={() => removeStep(i)} style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", height: "fit-content" }}>
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button type="button" onClick={addStep} style={{ width: "100%", marginTop: 16, padding: "12px", background: "#F1F5F9", color: "#334155", border: "1px dashed #CBD5E1", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "background 0.2s" }} onMouseOver={e => e.currentTarget.style.background = "#E2E8F0"} onMouseOut={e => e.currentTarget.style.background = "#F1F5F9"}>
                  <Plus size={16} /> Tambah Urutan Vendor
                </button>
              </div>

            </div>
          </div>

          {/* Right Panel: Submit & Preview (Fixed) */}
          <div style={{ width: 380, flexShrink: 0, background: "white", borderLeft: "1px solid #E2E8F0", padding: "24px", display: "flex", flexDirection: "column" }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", marginBottom: 16 }}>Ringkasan & Terbitkan</h3>
            
            {!result ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 16, padding: 20, textAlign: "center", color: "#94A3B8", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
                  <QrCode size={56} style={{ opacity: 0.2, marginBottom: 16 }} />
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#475569", marginBottom: 4 }}>Siap Diterbitkan</div>
                  <div style={{ fontSize: 12 }}>Isi form di samping lalu klik terbitkan untuk menghasilkan QR Code SPK.</div>
                </div>

                {error && (
                  <div style={{ marginTop: 16, padding: "12px 16px", background: "#FEF2F2", borderRadius: 12, color: "#991B1B", fontSize: 13, fontWeight: 600, border: "1px solid #FECACA" }}>
                    ⚠️ {error}
                  </div>
                )}

                <button type="button" onClick={handleSubmit} disabled={loading} style={{ width: "100%", marginTop: 16, padding: "16px", background: "#3B82F6", color: "white", border: "none", borderRadius: 14, fontSize: 14, fontWeight: 800, cursor: loading ? "not-allowed" : "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: 8, boxShadow: "0 4px 14px rgba(59,130,246,0.3)", opacity: loading ? 0.7 : 1 }}>
                  {loading ? "⏳ Memproses..." : "🚀 Terbitkan SPK"}
                </button>
              </div>
            ) : (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#DCFCE7", color: "#10B981", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                  <CheckCircle size={32} />
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 900, color: "#0F172A", marginBottom: 4 }}>Berhasil!</h3>
                <div style={{ fontSize: 13, color: "#64748B", marginBottom: 24 }}>SPK {result.kodeBatch} diterbitkan</div>

                <div style={{ background: "white", border: "1px solid #E2E8F0", padding: 16, borderRadius: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.05)", marginBottom: 24 }}>
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(spkUrl)}`} alt="QR Code" style={{ width: 180, height: 180, display: "block" }} />
                </div>

                <div style={{ width: "100%", display: "flex", gap: 8, marginBottom: 16 }}>
                  <button onClick={handleCopy} style={{ flex: 1, padding: "12px", background: "#F1F5F9", color: "#334155", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: 6 }}>
                    {copied ? <><Check size={16} color="#10B981" /> Disalin!</> : <><Copy size={16} /> Salin Link</>}
                  </button>
                  <a href={`https://wa.me/?text=${encodeURIComponent("Berikut link SPK produksi:\n" + spkUrl)}`} target="_blank" rel="noreferrer"
                    style={{ flex: 1, padding: "12px", background: "#10B981", color: "white", textDecoration: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, display: "flex", justifyContent: "center", alignItems: "center", gap: 6 }}>
                    📱 Kirim WA
                  </a>
                </div>

                <button onClick={handleReset} style={{ width: "100%", marginTop: "auto", padding: "14px", background: "white", color: "#3B82F6", border: "1px solid #BFDBFE", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  + Buat SPK Baru Lainnya
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default function BuatSPKPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "#64748B" }}>⏳ Memuat form...</div>}>
      <BuatSPKContent />
    </Suspense>
  );
}
