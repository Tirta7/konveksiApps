"use client";
import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Trash2, QrCode, Copy, Check, ArrowDown, Scissors, Layers, CheckCircle, ChevronRight, ChevronLeft, ClipboardList, Send, Printer, CheckCircle2, Download, X } from "lucide-react";
import { toast } from "sonner";

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
  const [hydrated, setHydrated] = useState(false);
  const [showPoModal, setShowPoModal] = useState(false);
  const [poData, setPoData] = useState<any[]>([]);
  
  // Wizard State
  const [currentStep, setCurrentStep] = useState(1);

  // ✅ FITUR 1: Load dari localStorage saat halaman dibuka
  useEffect(() => {
    if (isReturMode) { setHydrated(true); return; }
    try {
      const saved = localStorage.getItem("spk_draft_v2");
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft.form) setForm(draft.form);
        if (draft.steps?.length) setSteps(draft.steps);
        if (draft.sizeBreakdown?.length) setSizeBreakdown(draft.sizeBreakdown);
        if (draft.currentStep) setCurrentStep(draft.currentStep);
      }
    } catch {}
    setHydrated(true);
  }, [isReturMode]);

  // ✅ FITUR 1: Simpan ke localStorage setiap kali ada perubahan
  useEffect(() => {
    if (!hydrated || isReturMode || result) return;
    try {
      localStorage.setItem("spk_draft_v2", JSON.stringify({ form, steps, sizeBreakdown, currentStep }));
    } catch {}
  }, [form, steps, sizeBreakdown, currentStep, hydrated, isReturMode, result]);

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

  const validateStep1 = () => {
    if (!form.jenis_kain) { setError("Jenis kain wajib diisi."); return false; }
    if (jumlahPcs > 0 && !sizeMatch) { setError(`Total size (${totalSizes} pcs) tidak sama dengan jumlah SPK (${jumlahPcs} pcs). Sesuaikan breakdown size.`); return false; }
    setError("");
    return true;
  };

  const validateStep2 = () => {
    for (const [i, s] of steps.entries()) {
      if (!s.vendor_id) { setError(`Step ${i + 1}: Pilih vendor terlebih dahulu.`); return false; }
      if (!s.jenis_pekerjaan) { setError(`Step ${i + 1}: Jenis pekerjaan wajib diisi.`); return false; }
      if (!s.jumlah_barang) { setError(`Step ${i + 1}: Jumlah barang wajib diisi.`); return false; }
    }
    setError("");
    return true;
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (validateStep1()) setCurrentStep(2);
    } else if (currentStep === 2) {
      if (validateStep2()) setCurrentStep(3);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const openPoModal = async () => {
    setShowPoModal(true);
    setPoData([]);
    try {
      const res = await fetch("/api/penjualan-online/po-summary");
      const json = await res.json();
      setPoData(json);
    } catch (err) {
      toast.error("Gagal menarik data PO");
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!validateStep1() || !validateStep2()) return;
    
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
    
    // ✅ BUG FIX: Hapus draft dari localStorage segera setelah SPK berhasil dibuat.
    // Jika tidak dihapus, saat user refresh halaman, mereka akan kembali ke Step 3 Draft dan bisa membuat SPK ganda.
    try { localStorage.removeItem("spk_draft_v2"); } catch {}
    
    setResult(data);
  };

  const [qrBaseUrl, setQrBaseUrl] = useState("");
  useEffect(() => { if (typeof window !== "undefined") setQrBaseUrl(window.location.origin); }, []);

  const spkUrl = result ? `${qrBaseUrl}/spk/${result.token}` : "";
  const handleCopy = () => { navigator.clipboard.writeText(spkUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const handleReset = () => {
    setResult(null); setCurrentStep(1);
    setForm({ jenis_kain: "", jumlah_pcs: "", jumlah_meter: "", catatan_route: "" });
    setSteps([{ vendor_id: "", jenis_pekerjaan: "", jumlah_barang: "", deadline: "", catatan: "" }]);
    setSizeBreakdown([{ size: "L", jumlah: 0 }, { size: "XL", jumlah: 0 }]);
    try { localStorage.removeItem("spk_draft_v2"); } catch {}
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#F1F5F9", overflow: "hidden" }}>
      
      {/* Header */}
      <div style={{ padding: "24px 48px", background: "white", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: "#0F172A", marginBottom: 6 }}>
            {isReturMode ? "🔄 Buat SPK Retur" : "Buat SPK Baru"}
          </h1>
          <p style={{ fontSize: 14, color: "#64748B" }}>
            {isReturMode ? "Proses ulang item cacat agar stok kembali balance" : "Isi formulir secara berurutan untuk menerbitkan SPK digital"}
          </p>
        </div>
        {!isReturMode && currentStep === 1 && !result && (
          <button onClick={openPoModal} style={{ background: "#F59E0B", color: "white", border: "none", padding: "10px 20px", borderRadius: 10, fontSize: 14, fontWeight: 800, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", boxShadow: "0 4px 10px rgba(245, 158, 11, 0.2)" }}>
            <Download size={18} /> Tarik Data PO
          </button>
        )}
      </div>

      {/* Stepper Navigation (Fixed) */}
      {!result && (
        <div style={{ padding: "32px 48px 16px", maxWidth: 700, margin: "0 auto", width: "100%", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
            {/* Background Line */}
            <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 3, background: "#E2E8F0", zIndex: 0, transform: "translateY(-50%)", borderRadius: 2 }} />
            
            {/* Active Line */}
            <div style={{ position: "absolute", top: "50%", left: 0, width: currentStep === 1 ? "0%" : currentStep === 2 ? "50%" : "100%", height: 3, background: currentStep === 3 ? "#10B981" : "#3B82F6", zIndex: 1, transform: "translateY(-50%)", transition: "width 0.4s ease, background 0.4s ease", borderRadius: 2 }} />
            
            {/* Nodes */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, zIndex: 2, background: "#F1F5F9", paddingRight: 16 }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: currentStep >= 1 ? "#3B82F6" : "#E2E8F0", color: currentStep >= 1 ? "white" : "#64748B", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, border: "4px solid #F1F5F9", transition: "all 0.3s", boxShadow: currentStep === 1 ? "0 0 0 3px rgba(59,130,246,0.2)" : "none" }}>1</div>
              <span style={{ fontWeight: 800, color: currentStep >= 1 ? "#0F172A" : "#94A3B8", fontSize: 14 }}>Info & Ukuran</span>
            </div>
            
            <div style={{ display: "flex", alignItems: "center", gap: 10, zIndex: 2, background: "#F1F5F9", padding: "0 16px" }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: currentStep >= 2 ? (currentStep === 3 ? "#10B981" : "#3B82F6") : "#E2E8F0", color: currentStep >= 2 ? "white" : "#64748B", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, border: "4px solid #F1F5F9", transition: "all 0.3s", boxShadow: currentStep === 2 ? "0 0 0 3px rgba(59,130,246,0.2)" : "none" }}>2</div>
              <span style={{ fontWeight: 800, color: currentStep >= 2 ? "#0F172A" : "#94A3B8", fontSize: 14 }}>Rute Vendor</span>
            </div>
            
            <div style={{ display: "flex", alignItems: "center", gap: 10, zIndex: 2, background: "#F1F5F9", paddingLeft: 16 }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: currentStep >= 3 ? "#10B981" : "#E2E8F0", color: currentStep >= 3 ? "white" : "#64748B", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, border: "4px solid #F1F5F9", transition: "all 0.3s", boxShadow: currentStep === 3 ? "0 0 0 3px rgba(16,185,129,0.2)" : "none" }}>3</div>
              <span style={{ fontWeight: 800, color: currentStep >= 3 ? "#0F172A" : "#94A3B8", fontSize: 14 }}>Selesai</span>
            </div>
          </div>
        </div>
      )}

      {/* Scrollable Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 48px 40px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", width: "100%" }}>

        {/* Error Notification */}
        {error && (
          <div style={{ marginBottom: 24, padding: "16px 20px", background: "#FEF2F2", borderRadius: 12, color: "#991B1B", fontSize: 14, fontWeight: 600, border: "1px solid #FECACA", display: "flex", alignItems: "center", gap: 12 }}>
            ⚠️ <span>{error}</span>
          </div>
        )}

        {/* --- STEP 1: INFO KAIN & SIZE --- */}
        {currentStep === 1 && !result && (
          <div style={{ animation: "fadeIn 0.3s" }}>
            {isReturMode && parentBatch && (
              <div style={{ background: "#FEF3C7", border: "1px solid #F59E0B", borderRadius: 16, padding: "20px 24px", display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 24 }}>
                <span style={{ fontSize: 32 }}>🔄</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, color: "#92400E", fontSize: 18, marginBottom: 4 }}>Mode SPK Retur — {parentBatch.kode_batch}</div>
                  <div style={{ fontSize: 14, color: "#78350F" }}>
                    {parentBatch.jenis_kain} &bull; {(parentBatch.size_breakdown ?? []).filter((s: any) => s.cacat > 0).map((s: any) => `Size ${s.size}: ${s.cacat}`).join(", ")}
                  </div>
                </div>
              </div>
            )}

            <div style={{ background: "white", borderRadius: 20, border: "1px solid #E2E8F0", padding: "32px", boxShadow: "0 2px 10px rgba(0,0,0,0.02)", marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                <div style={{ background: "#EFF6FF", color: "#3B82F6", padding: 10, borderRadius: 12 }}><Layers size={24} /></div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0F172A", margin: 0 }}>Info Material / Kain</h2>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 20, marginBottom: 24 }}>
                <div style={{ flex: "2 1 300px" }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#475569", marginBottom: 8 }}>Jenis Kain <span style={{color:"#EF4444"}}>*</span></label>
                  <input style={{ width: "100%", padding: "12px 16px", border: "1px solid #CBD5E1", borderRadius: 10, fontSize: 15 }} value={form.jenis_kain} onChange={e => setForm(f => ({ ...f, jenis_kain: e.target.value }))} placeholder="Contoh: Denim Biru 12oz" />
                </div>
                <div style={{ flex: "1 1 150px" }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#475569", marginBottom: 8 }}>Jumlah SPK (pcs)</label>
                  <input type="number" style={{ width: "100%", padding: "12px 16px", border: "1px solid #CBD5E1", borderRadius: 10, fontSize: 15 }} value={form.jumlah_pcs} onChange={e => setForm(f => ({ ...f, jumlah_pcs: e.target.value }))} placeholder="300" />
                </div>
                <div style={{ flex: "1 1 150px" }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#475569", marginBottom: 8 }}>Kebutuhan (meter)</label>
                  <input type="number" style={{ width: "100%", padding: "12px 16px", border: "1px solid #CBD5E1", borderRadius: 10, fontSize: 15 }} value={form.jumlah_meter} onChange={e => setForm(f => ({ ...f, jumlah_meter: e.target.value }))} placeholder="150" />
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#475569", marginBottom: 8 }}>Catatan Umum SPK (Opsional)</label>
                <input style={{ width: "100%", padding: "12px 16px", border: "1px solid #CBD5E1", borderRadius: 10, fontSize: 15 }} value={form.catatan_route} onChange={e => setForm(f => ({ ...f, catatan_route: e.target.value }))} placeholder="Keterangan tambahan untuk SPK..." />
              </div>
            </div>

            <div style={{ background: "white", borderRadius: 20, border: "1px solid #E2E8F0", padding: "32px", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ background: "#F0FDF4", color: "#10B981", padding: 10, borderRadius: 12 }}><Scissors size={24} /></div>
                  <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0F172A", margin: 0 }}>Breakdown Ukuran</h2>
                </div>
                <button type="button" onClick={addSize} style={{ padding: "10px 16px", background: "#F8FAFC", color: "#0F172A", border: "1px solid #CBD5E1", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                  <Plus size={16} /> Tambah Size
                </button>
              </div>
              
              <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
                {sizeBreakdown.map((row, i) => (
                  <div key={i} style={{ flex: "1 1 250px", display: "flex", gap: 12, alignItems: "center", background: "#F8FAFC", padding: 16, borderRadius: 12, border: "1px solid #E2E8F0" }}>
                    <input style={{ flex: 1, minWidth: 80, padding: "10px 14px", border: "1px solid #CBD5E1", borderRadius: 8, fontSize: 14, fontWeight: 700 }} placeholder="Size (L, XL)" value={row.size} onChange={e => updateSize(i, "size", e.target.value.toUpperCase())} />
                    <input type="number" style={{ width: 80, padding: "10px 14px", border: "1px solid #CBD5E1", borderRadius: 8, fontSize: 14 }} placeholder="Pcs" value={row.jumlah || ""} onChange={e => updateSize(i, "jumlah", parseInt(e.target.value) || 0)} />
                    <button type="button" onClick={() => removeSize(i)} disabled={sizeBreakdown.length <= 1} style={{ background: "none", border: "none", color: sizeBreakdown.length <= 1 ? "#CBD5E1" : "#EF4444", cursor: "pointer", padding: 4, flexShrink: 0 }}>
                      <Trash2 size={20} />
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 24, padding: "16px 20px", borderRadius: 12, background: sizeMatch ? "#F0FDF4" : "#FEF2F2", border: `1px solid ${sizeMatch ? "#86EFAC" : "#FECACA"}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 800, fontSize: 15, color: sizeMatch ? "#065F46" : "#991B1B" }}>Total size: {totalSizes} pcs</span>
                {jumlahPcs > 0 && (
                  <span style={{ fontSize: 14, color: sizeMatch ? "#16A34A" : "#EF4444", fontWeight: 700 }}>
                    {sizeMatch ? `✅ Klop dengan Jumlah SPK` : `⚠️ Selisih ${Math.abs(jumlahPcs - totalSizes)} pcs dari total SPK`}
                  </span>
                )}
              </div>
            </div>
            
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
              <button onClick={handleNext} style={{ padding: "16px 40px", background: "#0F172A", color: "white", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
                Lanjut ke Rute Vendor <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* --- STEP 2: ROUTE VENDOR --- */}
        {currentStep === 2 && !result && (
          <div style={{ animation: "fadeIn 0.3s", display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Top Bar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>Langkah 2 dari 3</div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: -0.5 }}>Rute Produksi</h2>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {jumlahPcs > 0 && (
                  <div style={{ padding: "6px 14px", background: "#EFF6FF", borderRadius: 8, fontSize: 13, fontWeight: 700, color: "#3B82F6" }}>
                    {jumlahPcs} pcs · {form.jenis_kain}
                  </div>
                )}
                <button type="button" onClick={addStep} style={{ padding: "9px 16px", background: "#3B82F6", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                  <Plus size={14} /> Tambah Baris
                </button>
              </div>
            </div>

            {/* 2-col: slim timeline + full table */}
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

              {/* Slim Timeline — no box, just dots + line */}
              <div style={{ width: 120, flexShrink: 0, position: "sticky", top: 0, paddingTop: 46 }}>
                <div style={{ position: "relative", paddingLeft: 20 }}>
                  {/* Vertical line */}
                  {steps.length > 1 && (
                    <div style={{ position: "absolute", left: 5, top: 6, bottom: 6, width: 1, background: "linear-gradient(to bottom, #93C5FD, #6EE7B7)" }} />
                  )}
                  {steps.map((step, i) => {
                    const v = vendors.find((vv: any) => String(vv.id) === String(step.vendor_id));
                    const c = i === 0 ? "#3B82F6" : i === steps.length - 1 ? "#10B981" : "#A78BFA";
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 14, position: "relative", zIndex: 1 }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: c, flexShrink: 0, marginTop: 5, marginLeft: -17 }} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 11, color: v ? "#374151" : "#D1D5DB", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontStyle: v ? "normal" : "italic" }}>
                            {v?.nama || "—"}
                          </div>
                          {step.jenis_pekerjaan && (
                            <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{step.jenis_pekerjaan}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {/* ghost */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, opacity: 0.25, position: "relative", zIndex: 1 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", border: "1px dashed #9CA3AF", flexShrink: 0, marginLeft: -17 }} />
                    <div style={{ fontSize: 10, color: "#9CA3AF" }}>+</div>
                  </div>
                </div>
              </div>

              {/* Full-width table */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ background: "white", borderRadius: 10, border: "1px solid #F1F5F9", overflow: "hidden" }}>
                  {/* Header */}
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 72px 118px 2fr 28px", gap: 10, padding: "9px 16px", background: "#F9FAFB", borderBottom: "1px solid #F1F5F9" }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", letterSpacing: 0.4 }}>Vendor</div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", letterSpacing: 0.4 }}>Pekerjaan</div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", letterSpacing: 0.4 }}>
                      Jml {jumlahPcs > 0 && <span style={{ color: "#3B82F6" }}>({jumlahPcs})</span>}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", letterSpacing: 0.4 }}>Tenggat</div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", letterSpacing: 0.4 }}>Instruksi (opsional)</div>
                    <div />
                  </div>

                  {/* Rows */}
                  {steps.map((step, i) => {
                    const isFirst = i === 0;
                    const isLast = i === steps.length - 1;
                    const dotColor = isFirst ? "#3B82F6" : isLast ? "#10B981" : "#8B5CF6";
                    return (
                      <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 72px 118px 2fr 28px", gap: 10, padding: "8px 16px", borderBottom: i < steps.length - 1 ? "1px solid #F9FAFB" : "none", alignItems: "center" }}>

                        {/* Vendor */}
                        <select style={{ width: "100%", padding: "7px 10px", border: "1px solid #E9EEF4", borderRadius: 7, fontSize: 13, background: "white", color: "#0F172A", outline: "none" }} value={step.vendor_id} onChange={e => onVendorChange(i, e.target.value)}>
                          <option value="">— Pilih —</option>
                          {vendors.map((vv: any) => <option key={vv.id} value={vv.id}>{vv.nama}</option>)}
                        </select>

                        {/* Pekerjaan */}
                        <input style={{ width: "100%", padding: "7px 10px", border: "1px solid #E9EEF4", borderRadius: 7, fontSize: 13, outline: "none" }} value={step.jenis_pekerjaan} onChange={e => updateStep(i, "jenis_pekerjaan", e.target.value)} placeholder="Jahit, Potong..." />

                        {/* Jumlah */}
                        <input type="number" style={{ width: "100%", padding: "7px 8px", border: "1px solid #E9EEF4", borderRadius: 7, fontSize: 13, textAlign: "center", outline: "none" }} value={step.jumlah_barang} onChange={e => updateStep(i, "jumlah_barang", e.target.value)} placeholder={jumlahPcs > 0 ? String(jumlahPcs) : "—"} />

                        {/* Tenggat */}
                        <input type="date" style={{ width: "100%", padding: "7px 8px", border: "1px solid #E9EEF4", borderRadius: 7, fontSize: 12, outline: "none" }} value={step.deadline} onChange={e => updateStep(i, "deadline", e.target.value)} />

                        {/* Instruksi */}
                        <input style={{ width: "100%", padding: "7px 10px", border: "1px solid #E9EEF4", borderRadius: 7, fontSize: 13, outline: "none" }} value={step.catatan} onChange={e => updateStep(i, "catatan", e.target.value)} placeholder="Catatan..." />

                        {/* Delete */}
                        {steps.length > 1 ? (
                          <button type="button" onClick={() => removeStep(i)} style={{ background: "none", border: "none", color: "#CBD5E1", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, transition: "color 0.2s" }} onMouseOver={e => e.currentTarget.style.color = "#EF4444"} onMouseOut={e => e.currentTarget.style.color = "#CBD5E1"}>
                            <Trash2 size={14} />
                          </button>
                        ) : <div />}
                      </div>
                    );
                  })}

                  {/* Add Row button (inline) */}
                  <button type="button" onClick={addStep} style={{ width: "100%", padding: "11px 16px", background: "transparent", color: "#94A3B8", border: "none", borderTop: "1px dashed #E2E8F0", fontSize: 13, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s" }} onMouseOver={e => { e.currentTarget.style.background = "#F8FAFC"; e.currentTarget.style.color = "#3B82F6"; }} onMouseOut={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#94A3B8"; }}>
                    <Plus size={14} /> Tambah baris vendor baru
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Nav */}
            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8 }}>
              <button onClick={handleBack} style={{ padding: "10px 20px", background: "white", color: "#64748B", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                <ChevronLeft size={16} /> Kembali
              </button>
              <button onClick={handleNext} style={{ padding: "10px 24px", background: "#0F172A", color: "white", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                Konfirmasi & Terbitkan <Check size={16} />
              </button>
            </div>
          </div>
        )}



        {/* --- STEP 3: CONFIRM & RESULT --- */}
        {currentStep === 3 && (
          <div style={{ animation: "fadeIn 0.3s" }}>
            {!result ? (
              /* ===== TIKET KONFIRMASI ===== */
              <div style={{ maxWidth: 600, margin: "0 auto" }}>
                {/* Ticket card */}
                <div style={{ background: "white", borderRadius: 16, overflow: "hidden", border: "1px solid #E2E8F0" }}>

                  {/* Ticket Header */}
                  <div style={{ background: "#0F172A", padding: "24px 28px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: "#475569", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Surat Perintah Kerja</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: "white", letterSpacing: -0.5, marginBottom: 4 }}>Draft SPK Baru</div>
                      <div style={{ fontSize: 12, color: "#64748B" }}>Tinjau sebelum diterbitkan</div>
                    </div>
                    <div style={{ background: "#1E293B", borderRadius: 10, padding: "8px 14px", textAlign: "right" }}>
                      <div style={{ fontSize: 10, color: "#475569", marginBottom: 2 }}>Status</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#F59E0B" }}>● DRAFT</div>
                    </div>
                  </div>

                  {/* Perforated divider */}
                  <div style={{ position: "relative", height: 20, background: "#F8FAFC" }}>
                    <div style={{ position: "absolute", left: -10, top: "50%", transform: "translateY(-50%)", width: 20, height: 20, borderRadius: "50%", background: "#F1F5F9", border: "1px solid #E2E8F0" }} />
                    <div style={{ position: "absolute", right: -10, top: "50%", transform: "translateY(-50%)", width: 20, height: 20, borderRadius: "50%", background: "#F1F5F9", border: "1px solid #E2E8F0" }} />
                    <div style={{ position: "absolute", left: 20, right: 20, top: "50%", borderTop: "1.5px dashed #D1D5DB" }} />
                  </div>

                  {/* Info badges */}
                  <div style={{ padding: "20px 28px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, borderBottom: "1px solid #F3F4F6" }}>
                    {[
                      { label: "Material", value: form.jenis_kain || "—" },
                      { label: "Jumlah", value: `${jumlahPcs} pcs` },
                      { label: "Vendor", value: `${steps.length} stasiun` },
                    ].map((item, i) => (
                      <div key={i} style={{ background: "#F9FAFB", borderRadius: 10, padding: "12px 14px" }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{item.label}</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{item.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Rute list - Horizontal Numbered Sequence */}
                  <div style={{ padding: "18px 28px 24px" }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>Urutan Rute Produksi</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 12px" }}>
                      {steps.map((step, i) => {
                        const v = vendors.find((vv: any) => String(vv.id) === String(step.vendor_id));
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 20, padding: "4px 12px 4px 6px", gap: 8 }}>
                            <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#0F172A", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>{i + 1}</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>{v?.nama || "—"}</div>
                            {step.jenis_pekerjaan && <div style={{ fontSize: 10, color: "#64748B", background: "white", padding: "1px 6px", borderRadius: 4, border: "1px solid #E2E8F0" }}>{step.jenis_pekerjaan}</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Action row */}
                <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                  <button onClick={handleBack} disabled={loading} style={{ flex: 1, padding: "12px", background: "white", color: "#6B7280", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
                    Kembali
                  </button>
                  <button onClick={handleSubmit} disabled={loading} style={{ flex: 2, padding: "12px", background: "#0F172A", color: "white", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, letterSpacing: 0.2 }}>
                    {loading ? "Menerbitkan..." : <><Send size={16} style={{ marginBottom: -2 }} /> Terbitkan SPK</>}
                  </button>
                </div>
              </div>

            ) : (
              /* ===== TIKET SPK ===== */
              <div>
                {/* Action bar (tidak ikut print) */}
                <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", display: "flex", alignItems: "center", gap: 8 }}><CheckCircle2 size={24} color="#10B981" /> SPK Berhasil Diterbitkan</div>
                    <div style={{ fontSize: 13, color: "#64748B" }}>Berikut tiket SPK digital yang dapat dicetak atau dibagikan.</div>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={handleCopy} style={{ padding: "9px 18px", background: "white", color: "#374151", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                      {copied ? <><Check size={14} color="#10B981" /> Disalin</> : <><Copy size={14} /> Salin Link</>}
                    </button>
                    <a href={`https://wa.me/?text=${encodeURIComponent("SPK: " + spkUrl)}`} target="_blank" rel="noreferrer"
                      style={{ padding: "9px 18px", background: "#22C55E", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
                      WhatsApp
                    </a>
                    <button onClick={() => window.print()} style={{ padding: "9px 18px", background: "#0F172A", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                      <Printer size={16} /> Cetak
                    </button>
                  </div>
                </div>

                {/* TIKET */}
                <div id="spk-ticket" style={{ background: "white", borderRadius: 16, border: "1px solid #E2E8F0", maxWidth: 780, margin: "0 auto", overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>

                  {/* Header tiket */}
                  <div style={{ background: "#0F172A", padding: "24px 32px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Surat Perintah Kerja</div>
                      <div style={{ fontSize: 26, fontWeight: 900, color: "white", letterSpacing: -0.5 }}>{result.kodeBatch}</div>
                      <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>Diterbitkan {new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}</div>
                    </div>
                    <div style={{ textAlign: "right", display: "flex", alignItems: "center" }}>
                      <div style={{ background: "rgba(255,255,255,0.1)", padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600, color: "#CBD5E1", letterSpacing: 1 }}>KONVEKSI APPS</div>
                    </div>
                  </div>

                  {/* Divider zigzag */}
                  <div style={{ height: 16, background: "repeating-linear-gradient(90deg, #F1F5F9 0px, #F1F5F9 12px, white 12px, white 24px)", borderTop: "1px solid #E2E8F0", borderBottom: "1px solid #E2E8F0" }} />

                  {/* Info utama */}
                  <div style={{ padding: "24px 32px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, borderBottom: "1px dashed #E2E8F0" }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Material / Kain</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A" }}>{form.jenis_kain || "—"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Total Produksi</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A" }}>{jumlahPcs} <span style={{ fontSize: 12, fontWeight: 500, color: "#64748B" }}>pcs</span></div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Total Rute Vendor</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A" }}>{steps.length} <span style={{ fontSize: 12, fontWeight: 500, color: "#64748B" }}>stasiun</span></div>
                    </div>
                  </div>

                  {/* Size breakdown jika ada */}
                  {sizeBreakdown.some(s => s.jumlah > 0) && (
                    <div style={{ padding: "16px 32px", borderBottom: "1px dashed #E2E8F0" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Breakdown Ukuran</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {sizeBreakdown.filter(s => s.jumlah > 0).map((s, i) => (
                          <div key={i} style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: "6px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{s.size}</span>
                            <span style={{ fontSize: 12, color: "#64748B" }}>{s.jumlah} pcs</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Rute Produksi Tiket Cetak */}
                  <div style={{ padding: "20px 32px 24px", borderBottom: "1px dashed #E2E8F0" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>Urutan Rute Produksi</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                      {steps.map((step, i) => {
                        const v = vendors.find((vv: any) => String(vv.id) === String(step.vendor_id));
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", background: "white", border: "1.5px solid #F1F5F9", borderRadius: 12, padding: "8px 14px 8px 8px", gap: 10, minWidth: 160, flex: "1 1 auto", maxWidth: 220 }}>
                            <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#F8FAFC", border: "1px solid #E2E8F0", color: "#64748B", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 2, overflow: "hidden" }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v?.nama || <span style={{ color: "#D1D5DB" }}>—</span>}</div>
                              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <div style={{ fontSize: 11, color: "#64748B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{step.jenis_pekerjaan || "—"}</div>
                                <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#CBD5E1" }} />
                                <div style={{ fontSize: 11, fontWeight: 700, color: "#0F172A", flexShrink: 0 }}>{step.jumlah_barang || jumlahPcs} <span style={{ fontSize: 9, color: "#9CA3AF", fontWeight: 500 }}>pcs</span></div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* QR Code + Footer */}
                  <div style={{ padding: "20px 32px", display: "flex", alignItems: "center", gap: 24 }}>
                    <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, padding: 10, flexShrink: 0 }}>
                      <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(spkUrl)}`} alt="QR SPK" style={{ width: 80, height: 80, display: "block" }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", letterSpacing: 0.5, marginBottom: 4 }}>Scan untuk melihat detail SPK</div>
                      <div style={{ fontSize: 12, color: "#374151", wordBreak: "break-all" }}>{spkUrl}</div>
                    </div>
                    <div style={{ marginLeft: "auto", textAlign: "right" }}>
                      <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 4 }}>Kode Batch</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: "#0F172A", letterSpacing: 1 }}>{result.kodeBatch}</div>
                    </div>
                  </div>
                </div>

                {/* Buat baru */}
                <div className="no-print" style={{ textAlign: "center", marginTop: 24 }}>
                  <button onClick={handleReset} style={{ padding: "10px 24px", background: "transparent", color: "#64748B", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    + Buat SPK Baru Lagi
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Print styles */}
        <style>{`
          @media print {
            .no-print { display: none !important; }
            body { background: white !important; }
            #spk-ticket { box-shadow: none !important; border: 1px solid #E2E8F0 !important; }
          }
        `}</style>




        </div>
      </div>
      
      {/* Modal PO Data */}
      {showPoModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", borderRadius: 16, width: "90%", maxWidth: 500, padding: 24, boxShadow: "0 10px 25px rgba(0,0,0,0.1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", margin: 0 }}>Tarik Data Pre-Order</h2>
                <div style={{ fontSize: 13, color: "#64748B", mt: 4 }}>Pilih model yang akan dibuatkan SPK</div>
              </div>
              <button onClick={() => setShowPoModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B" }}><X size={20}/></button>
            </div>
            
            {poData.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontSize: 14, fontWeight: 600 }}>⏳ Memuat atau tidak ada data PO aktif...</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16, maxHeight: 400, overflowY: "auto", paddingRight: 8 }}>
                {poData.map((po: any, i: number) => (
                  <div key={i} style={{ border: "1px solid #E2E8F0", borderRadius: 12, padding: 16, background: "#F8FAFC" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div style={{ fontWeight: 900, fontSize: 15, color: "#0F172A" }}>{po.model}</div>
                      <div style={{ background: "#FEF3C7", color: "#D97706", padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: 800 }}>{po.total_qty} PCS</div>
                    </div>
                    
                    <div style={{ fontSize: 13, color: "#475569", marginBottom: 16 }}>
                      {Object.entries(po.sizes).map(([sz, qty]) => `Size ${sz}: ${qty}`).join(" • ")}
                    </div>
                    
                    <button 
                      type="button"
                      onClick={() => {
                        setForm(f => ({ ...f, jenis_kain: po.model, jumlah_pcs: String(po.total_qty) }));
                        const sizes = Object.entries(po.sizes).map(([sz, qty]) => ({ size: sz, jumlah: Number(qty) }));
                        setSizeBreakdown(sizes);
                        setShowPoModal(false);
                        toast.success(`Berhasil menarik data ${po.total_qty} pcs model ${po.model} dari Penjualan Online`);
                      }}
                      style={{ width: "100%", padding: "12px", background: "#3B82F6", color: "white", borderRadius: 8, fontSize: 13, fontWeight: 800, border: "none", cursor: "pointer", boxShadow: "0 2px 4px rgba(59,130,246,0.2)" }}
                    >
                      Buatkan SPK Model Ini
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function BuatSPKPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "#64748B" }}>⏳ Memuat form...</div>}>
      <BuatSPKContent />
    </Suspense>
  );
}
