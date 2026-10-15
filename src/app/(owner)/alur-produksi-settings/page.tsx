// @ts-nocheck
"use client";

import React, { useEffect, useState } from "react";
import { 
  Plus, 
  X, 
  Pencil, 
  Save, 
  Trash2, 
  ChevronUp, 
  ChevronDown, 
  Eye, 
  EyeOff, 
  Settings2, 
  Scissors, 
  Zap, 
  Droplets, 
  Filter, 
  Star, 
  Package, 
  ChevronRight, 
  RotateCcw, 
  Clock, 
  Building, 
  CheckCircle2, 
  ShieldCheck, 
  Sparkles, 
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";

const VENDOR_TIPE_OPTIONS = [
  { value: "", label: "-- Pengerjaan Internal (Tanpa Vendor) --" },
  { value: "cmt", label: "CMT (Penjahit Jeans)" },
  { value: "washing", label: "Washing / Laundry Jeans" },
  { value: "bersih_benang", label: "Bersih Benang & Pasang Aksesoris" },
  { value: "finishing", label: "Quality Control (QC) & Finishing" },
  { value: "sablon_bordir", label: "Sablon & Bordir Komputer" },
  { value: "lainnya", label: "Vendor Eksternal Lainnya" },
];

const STAGE_ICON_MAP = {
  potong_kain: Scissors, 
  potong_bahan: Scissors, 
  potong: Scissors,
  jahit_cmt: Zap, 
  penjahit_kain: Zap, 
  jahit: Zap,
  washing: Droplets, 
  washing_pakaian: Droplets,
  bersih_benang: Filter,
  qc_gudang: ShieldCheck, 
  qc_bahan: ShieldCheck, 
  qc: ShieldCheck,
  packing_gudang: Package, 
  finishing: Star, 
  gudang: Package,
};

const getIcon = (slug = "") => {
  const s = slug.toLowerCase();
  for (const key of Object.keys(STAGE_ICON_MAP)) {
    if (s.includes(key)) return STAGE_ICON_MAP[key];
  }
  return Package;
};

const WARNA_OPTIONS = [
  { hex: "#2563EB", label: "Biru Jeans" },
  { hex: "#DC2626", label: "Merah" },
  { hex: "#D97706", label: "Amber / Emas" },
  { hex: "#059669", label: "Hijau Emerald" },
  { hex: "#4F46E5", label: "Indigo" },
  { hex: "#9333EA", label: "Ungu" },
  { hex: "#0891B2", label: "Cyan" },
  { hex: "#E11D48", label: "Rose" },
  { hex: "#EA580C", label: "Orange" },
  { hex: "#475569", label: "Slate" }
];

const EMPTY_FORM = {
  nama: "",
  slug: "",
  warna: "#2563EB",
  vendor_tipe: "",
  opsional: false,
  butuh_vendor: false,
  estimasi_hari: 3,
  deskripsi: ""
};

export default function AlurProduksiSettingsPage() {
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editStage, setEditStage] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const fetchStages = () => {
    setLoading(true);
    fetch("/api/pipeline-stages?_t=" + Date.now())
      .then(r => r.json())
      .then(d => { 
        setStages(Array.isArray(d) ? d : []); 
        setLoading(false); 
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { 
    fetchStages(); 
  }, []);

  const openNew = () => { 
    setForm(EMPTY_FORM); 
    setEditStage(null); 
    setShowForm(true); 
  };

  const openEdit = (s) => {
    setForm({ 
      nama: s.nama, 
      slug: s.slug, 
      warna: s.warna || "#2563EB", 
      vendor_tipe: s.vendor_tipe || "", 
      opsional: !!s.opsional, 
      butuh_vendor: !!s.butuh_vendor, 
      estimasi_hari: s.estimasi_hari || 2,
      deskripsi: s.deskripsi || "" 
    });
    setEditStage(s); 
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault(); 
    setSaving(true);
    try {
      if (editStage) {
        await fetch("/api/pipeline-stages", { 
          method: "PATCH", 
          headers: { "Content-Type": "application/json" }, 
          body: JSON.stringify({ id: editStage.id, ...form }) 
        });
        toast.success(`Tahap "${form.nama}" berhasil diperbarui!`);
      } else {
        await fetch("/api/pipeline-stages", { 
          method: "POST", 
          headers: { "Content-Type": "application/json" }, 
          body: JSON.stringify(form) 
        });
        toast.success(`Tahap baru "${form.nama}" berhasil ditambahkan!`);
      }
      fetchStages(); 
      setShowForm(false);
    } catch { 
      toast.error("Gagal menyimpan tahap alur produksi"); 
    }
    setSaving(false);
  };

  const handleDelete = async (id, nama) => {
    if (!confirm(`Hapus tahap "${nama}" dari alur produksi?\n\nPerhatian: Tahap ini tidak akan lagi tersedia pada PO alur kerja baru.`)) return;
    try {
      await fetch("/api/pipeline-stages", { 
        method: "DELETE", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ id }) 
      });
      toast.success(`Tahap "${nama}" berhasil dihapus`); 
      fetchStages();
    } catch {
      toast.error("Gagal menghapus tahap");
    }
  };

  const handleToggleAktif = async (stage) => {
    try {
      await fetch("/api/pipeline-stages", { 
        method: "PATCH", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ id: stage.id, aktif: !stage.aktif }) 
      });
      toast.info(`Tahap "${stage.nama}" ${!stage.aktif ? "diaktifkan" : "dinonaktifkan"}`);
      fetchStages();
    } catch {
      toast.error("Gagal mengubah status tahap");
    }
  };

  const moveStage = async (idx, dir) => {
    const sorted = [...stages].sort((a, b) => a.urutan - b.urutan);
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const a = sorted[idx], b = sorted[swapIdx];
    const newOrder = sorted.map((s, i) => {
      if (i === idx) return { id: s.id, urutan: b.urutan };
      if (i === swapIdx) return { id: s.id, urutan: a.urutan };
      return { id: s.id, urutan: s.urutan };
    });
    await fetch("/api/pipeline-stages", { 
      method: "PATCH", 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify({ reorder: newOrder }) 
    });
    fetchStages();
  };

  const handleResetPreset = async () => {
    if (!confirm("Terapkan STANDAR ALUR PRODUKSI JEANS?\n\nAlur produksi akan diatur ulang ke 6 tahap standar konveksi jeans:\n1. Potong Kain (Cutting)\n2. Jahit / CMT (Sewing)\n3. Washing / Laundry\n4. Bersih Benang & Aksesoris\n5. QC Gudang\n6. Packing & Barang Jadi")) return;

    setResetting(true);
    try {
      const res = await fetch("/api/pipeline-stages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_preset" })
      });
      if (res.ok) {
        toast.success("Standar alur produksi jeans berhasil diterapkan!");
        fetchStages();
      }
    } catch {
      toast.error("Gagal menerapkan preset");
    } finally {
      setResetting(false);
    }
  };

  const sorted = [...stages].sort((a, b) => a.urutan - b.urutan);
  const active = sorted.filter(s => s.aktif);

  return (
    <div style={{ background: "#F8FAFC", minHeight: "100%", display: "flex", flexDirection: "column" }}>

      {/* HEADER SECTION */}
      <div style={{ background: "white", borderBottom: "1px solid #E2E8F0", padding: "20px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #1E3A8A, #2563EB)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 10px rgba(37,99,235,0.2)" }}>
            <Settings2 size={22} color="white" />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h1 style={{ fontSize: 20, fontWeight: 900, color: "#0F172A", margin: 0 }}>
                Pengaturan Alur Produksi (Pipeline)
              </h1>
              <span style={{ fontSize: 11, background: "#EFF6FF", color: "#2563EB", fontWeight: 800, padding: "2px 8px", borderRadius: 6, border: "1px solid #BFDBFE" }}>
                {active.length} Tahap Aktif
              </span>
            </div>
            <p style={{ color: "#64748B", margin: "3px 0 0", fontSize: 13 }}>
              Sesuaikan urutan tahap pengerjaan konveksi jeans, durasi SLA, dan integrasi vendor eksternal.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button 
            type="button"
            onClick={handleResetPreset}
            disabled={resetting}
            className="btn btn-secondary"
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 10, fontWeight: 700, fontSize: 13, background: "#F1F5F9", border: "1px solid #CBD5E1", cursor: "pointer" }}
            title="Kembalikan ke urutan baku produksi jeans (Potong > Jahit > Washing > Bersih Benang > QC > Packing)"
          >
            <RotateCcw size={15} /> {resetting ? "Menerapkan..." : "Reset Standar Jeans"}
          </button>

          <button 
            type="button"
            onClick={openNew}
            className="btn btn-primary"
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 10, background: "linear-gradient(135deg, #1E40AF, #2563EB)", color: "white", border: "none", fontWeight: 800, fontSize: 13, cursor: "pointer", boxShadow: "0 2px 8px rgba(37,99,235,0.3)" }}
          >
            <Plus size={16} /> Tambah Tahap Baru
          </button>
        </div>
      </div>

      {/* BODY CONTENT */}
      <div style={{ padding: "24px 32px", flex: 1, maxWidth: 1400, width: "100%", margin: "0 auto" }}>

        {/* PIPELINE TIMELINE PREVIEW CARD */}
        <div style={{ background: "white", borderRadius: 18, padding: "22px 26px", marginBottom: 24, border: "1px solid #E2E8F0", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 8 }}>
              <Sparkles size={15} color="#2563EB" />
              Simulasi Alur Kerja (Timeline Sequence)
            </div>
            <span style={{ fontSize: 11, color: "#64748B" }}>
              Total Estimasi Pengerjaan: <strong>{active.reduce((sum, s) => sum + (Number(s.estimasi_hari) || 0), 0)} Hari Kerja</strong>
            </span>
          </div>

          {active.length === 0 ? (
            <div style={{ color: "#94A3B8", fontSize: 13, textAlign: "center", padding: 20 }}>
              Belum ada tahap aktif. Silakan aktifkan minimal satu tahap di bawah.
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", overflowX: "auto", paddingBottom: 6 }}>
              {active.map((s, i) => {
                const Icon = getIcon(s.slug);
                return (
                  <React.Fragment key={s.id}>
                    <div style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      gap: 10, 
                      background: "#FAFBFD", 
                      border: `1.5px solid ${s.warna}`, 
                      borderRadius: 12, 
                      padding: "8px 14px",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.03)"
                    }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: s.warna + "18", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Icon size={15} color={s.warna} />
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>{s.nama}</span>
                          {s.opsional && (
                            <span style={{ fontSize: 9, background: "#FEF3C7", color: "#92400E", padding: "1px 5px", borderRadius: 4, fontWeight: 800 }}>OPS</span>
                          )}
                        </div>
                        <div style={{ fontSize: 10, color: "#64748B", marginTop: 1, display: "flex", alignItems: "center", gap: 4 }}>
                          <Clock size={10} /> {s.estimasi_hari || 1} Hari {s.vendor_tipe ? `· Vendor: ${s.vendor_tipe.toUpperCase()}` : "· Internal"}
                        </div>
                      </div>
                    </div>
                    {i < active.length - 1 && <ChevronRight size={16} color="#94A3B8" style={{ flexShrink: 0 }} />}
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>

        {/* STAGES LIST TABLE / CARDS */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#94A3B8", fontSize: 14 }}>
            Memuat konfigurasi tahapan produksi...
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {sorted.map((stage, idx) => {
              const Icon = getIcon(stage.slug);
              return (
                <div 
                  key={stage.id} 
                  style={{
                    background: "white", 
                    borderRadius: 16,
                    border: `1.5px solid ${stage.aktif ? stage.warna + "35" : "#E2E8F0"}`,
                    display: "flex", 
                    alignItems: "center", 
                    overflow: "hidden",
                    boxShadow: "0 2px 5px rgba(0,0,0,0.02)", 
                    opacity: stage.aktif ? 1 : 0.65,
                    transition: "all 0.2s ease"
                  }}
                >
                  {/* LEFT COLOR ACCENT BAR */}
                  <div style={{ width: 6, alignSelf: "stretch", background: stage.aktif ? stage.warna : "#CBD5E1", flexShrink: 0 }} />

                  {/* REORDER BUTTONS */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "0 10px 0 14px", flexShrink: 0 }}>
                    <button 
                      type="button"
                      onClick={() => moveStage(idx, "up")} 
                      disabled={idx === 0}
                      style={{ 
                        background: idx === 0 ? "transparent" : "#F1F5F9", 
                        border: "1px solid #E2E8F0", 
                        borderRadius: 6,
                        cursor: idx === 0 ? "default" : "pointer", 
                        color: idx === 0 ? "#CBD5E1" : "#334155", 
                        padding: 4, 
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                      title="Pindah urutan ke atas"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button 
                      type="button"
                      onClick={() => moveStage(idx, "down")} 
                      disabled={idx === sorted.length - 1}
                      style={{ 
                        background: idx === sorted.length - 1 ? "transparent" : "#F1F5F9", 
                        border: "1px solid #E2E8F0", 
                        borderRadius: 6,
                        cursor: idx === sorted.length - 1 ? "default" : "pointer", 
                        color: idx === sorted.length - 1 ? "#CBD5E1" : "#334155", 
                        padding: 4, 
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                      title="Pindah urutan ke bawah"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>

                  {/* URUTAN NUMBER BADGE */}
                  <div style={{ flexShrink: 0, padding: "0 12px 0 6px" }}>
                    <div style={{ 
                      width: 36, 
                      height: 36, 
                      borderRadius: 10, 
                      background: stage.warna + "15", 
                      border: `1.5px solid ${stage.warna}`, 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "center", 
                      fontSize: 14, 
                      fontWeight: 900, 
                      color: stage.warna 
                    }}>
                      {String(stage.urutan).padStart(2, "0")}
                    </div>
                  </div>

                  {/* STAGE ICON */}
                  <div style={{ 
                    width: 44, 
                    height: 44, 
                    borderRadius: 12, 
                    background: stage.warna + "14", 
                    border: `1px solid ${stage.warna}30`, 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center", 
                    flexShrink: 0, 
                    margin: "12px 6px" 
                  }}>
                    <Icon size={20} color={stage.warna} />
                  </div>

                  {/* STAGE DETAILS */}
                  <div style={{ flex: 1, padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 15, fontWeight: 900, color: "#0F172A" }}>
                        {stage.nama}
                      </span>
                      <span style={{ fontSize: 11, color: "#64748B", background: "#F1F5F9", padding: "1px 8px", borderRadius: 6, fontFamily: "monospace" }}>
                        slug: {stage.slug}
                      </span>
                      {stage.opsional && (
                        <span style={{ fontSize: 10, background: "#FEF3C7", color: "#92400E", padding: "2px 7px", borderRadius: 6, fontWeight: 800 }}>
                          OPSIONAL
                        </span>
                      )}
                      {!stage.aktif && (
                        <span style={{ fontSize: 10, background: "#FEE2E2", color: "#DC2626", padding: "2px 7px", borderRadius: 6, fontWeight: 800 }}>
                          NONAKTIF
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: 12.5, color: "#475569", marginTop: 4, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                      <span>{stage.deskripsi || "Tidak ada deskripsi proses."}</span>
                    </div>

                    {/* METADATA BADGES */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#0284C7", background: "#E0F2FE", padding: "2px 8px", borderRadius: 6, fontWeight: 700 }}>
                        <Clock size={12} /> Target SLA: {stage.estimasi_hari || 1} Hari Kerja
                      </span>

                      {stage.vendor_tipe ? (
                        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#1D4ED8", background: "#EFF6FF", padding: "2px 8px", borderRadius: 6, fontWeight: 700 }}>
                          <Building size={12} /> Vendor: {stage.vendor_tipe.toUpperCase()}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: "#475569", background: "#F1F5F9", padding: "2px 8px", borderRadius: 6, fontWeight: 600 }}>
                          🏢 Dikerjakan Internal
                        </span>
                      )}
                    </div>
                  </div>

                  {/* ACTION BUTTONS */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 18px", flexShrink: 0 }}>
                    <button 
                      type="button"
                      onClick={() => handleToggleAktif(stage)}
                      style={{ 
                        padding: "8px 12px", 
                        borderRadius: 8, 
                        border: `1px solid ${stage.aktif ? "#BBF7D0" : "#FECACA"}`, 
                        background: stage.aktif ? "#F0FDF4" : "#FEF2F2", 
                        color: stage.aktif ? "#059669" : "#DC2626", 
                        cursor: "pointer", 
                        display: "flex", 
                        alignItems: "center",
                        gap: 6,
                        fontSize: 12,
                        fontWeight: 700
                      }}
                      title={stage.aktif ? "Nonaktifkan tahap ini" : "Aktifkan tahap ini"}
                    >
                      {stage.aktif ? <><Eye size={14} /> Aktif</> : <><EyeOff size={14} /> Mati</>}
                    </button>

                    <button 
                      type="button"
                      onClick={() => openEdit(stage)}
                      className="btn btn-secondary"
                      style={{ padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}
                      title="Edit tahap"
                    >
                      <Pencil size={14} /> Edit
                    </button>

                    <button 
                      type="button"
                      onClick={() => handleDelete(stage.id, stage.nama)}
                      style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #FECACA", background: "#FEF2F2", color: "#DC2626", cursor: "pointer", display: "flex", alignItems: "center" }}
                      title="Hapus tahap"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}

            {sorted.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 24px", background: "white", borderRadius: 18, border: "1.5px dashed #CBD5E1" }}>
                <p style={{ color: "#64748B", margin: 0, fontSize: 15, fontWeight: 600 }}>
                  Belum ada tahap alur produksi.
                </p>
                <div style={{ marginTop: 12 }}>
                  <button onClick={handleResetPreset} className="btn btn-primary">
                    Terapkan Standar Alur Jeans Sekarang
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* FORM MODAL (EXPANDED & BEAUTIFIED) */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.7)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 20 }}>
          <div style={{ background: "white", borderRadius: 20, width: "100%", maxWidth: 660, boxShadow: "0 25px 70px rgba(0,0,0,0.25)", overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "92vh" }}>
            
            {/* MODAL HEADER */}
            <div style={{ padding: "20px 26px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(135deg, #F8FAFC, #EFF6FF)" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: "#0F172A" }}>
                  {editStage ? `Edit Tahap: ${editStage.nama}` : "Tambah Tahap Produksi Baru"}
                </h2>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748B" }}>
                  Atur spesifikasi pengerjaan, slug sistem, dan kebutuhan vendor
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setShowForm(false)}
                style={{ background: "#F1F5F9", border: "none", borderRadius: "50%", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#64748B" }}
              >
                <X size={17} />
              </button>
            </div>

            {/* FORM BODY */}
            <form onSubmit={handleSave} style={{ padding: "22px 26px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
              
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 14 }}>
                <div>
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                    Nama Tahapan Produksi <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <input 
                    required 
                    value={form.nama} 
                    onChange={e => {
                      const val = e.target.value;
                      const autoSlug = val.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_");
                      setForm({
                        ...form, 
                        nama: val,
                        slug: editStage ? form.slug : autoSlug
                      });
                    }} 
                    placeholder="Contoh: Washing / Laundry Jeans"
                    className="form-control"
                    style={{ fontSize: 13, fontWeight: 800 }} 
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                    Slug Sistem (ID Unik) <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <input 
                    required 
                    value={form.slug} 
                    onChange={e => setForm({...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_")})} 
                    placeholder="washing_jeans"
                    className="form-control"
                    style={{ fontSize: 12, fontFamily: "monospace", color: "#475569" }} 
                  />
                </div>
              </div>

              {/* TARGET SLA & TIPE VENDOR */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                    Estimasi Target Pengerjaan (SLA) <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <input 
                      type="number"
                      min="1"
                      required
                      value={form.estimasi_hari}
                      onChange={e => setForm({...form, estimasi_hari: Number(e.target.value) || 1})}
                      className="form-control"
                      style={{ fontSize: 13, fontWeight: 700, paddingRight: 60 }}
                    />
                    <span style={{ position: "absolute", right: 12, fontSize: 12, color: "#64748B", fontWeight: 600 }}>
                      Hari Kerja
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>
                    Digunakan untuk mendeteksi status "Terlambat" di dashboard produksi.
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                    Tipe Vendor Pelaksana
                  </label>
                  <select 
                    value={form.vendor_tipe || ""} 
                    onChange={e => setForm({
                      ...form, 
                      vendor_tipe: e.target.value || null,
                      butuh_vendor: !!e.target.value
                    })}
                    className="form-control"
                    style={{ fontSize: 13 }}
                  >
                    {VENDOR_TIPE_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>
                    Otomatis terhubung ke portal penerimaan vendor yang bersangkutan.
                  </div>
                </div>
              </div>

              {/* DESKRIPSI TAHAP */}
              <div>
                <label className="form-label" style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                  Deskripsi / Petunjuk Kerja Tahap Ini
                </label>
                <textarea 
                  rows={2}
                  value={form.deskripsi} 
                  onChange={e => setForm({...form, deskripsi: e.target.value})} 
                  placeholder="Jelaskan standar proses, contoh: pembersihan sisa benang, pasang kancing, dan rivet tembaga..."
                  className="form-control"
                  style={{ fontSize: 12, lineHeight: 1.4 }} 
                />
              </div>

              {/* WARNA THEME */}
              <div>
                <label className="form-label" style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 8 }}>
                  Pilihan Warna Badge Tahapan
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {WARNA_OPTIONS.map(w => (
                    <button 
                      key={w.hex} 
                      type="button" 
                      onClick={() => setForm({...form, warna: w.hex})}
                      style={{ 
                        width: 34, 
                        height: 34, 
                        borderRadius: 10, 
                        background: w.hex, 
                        border: form.warna === w.hex ? "3px solid #0F172A" : "2px solid rgba(0,0,0,0.1)", 
                        cursor: "pointer",
                        boxShadow: form.warna === w.hex ? "0 2px 8px rgba(0,0,0,0.25)" : "none",
                        transform: form.warna === w.hex ? "scale(1.1)" : "scale(1)",
                        transition: "all 0.15s ease"
                      }}
                      title={w.label}
                    />
                  ))}
                </div>
              </div>

              {/* OPTIONS CHECKBOXES */}
              <div style={{ background: "#F8FAFC", padding: 14, borderRadius: 12, border: "1px solid #E2E8F0", display: "flex", gap: 24, flexWrap: "wrap" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input 
                    type="checkbox" 
                    checked={form.opsional} 
                    onChange={e => setForm({...form, opsional: e.target.checked})} 
                    style={{ width: 16, height: 16 }} 
                  />
                  <div>
                    <span style={{ fontSize: 13, color: "#1E293B", fontWeight: 700 }}>Tahap Bersifat Opsional</span>
                    <div style={{ fontSize: 11, color: "#64748B" }}>Dapat dilewati jika PO tertentu tidak membutuhkan proses ini</div>
                  </div>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input 
                    type="checkbox" 
                    checked={form.butuh_vendor} 
                    onChange={e => setForm({...form, butuh_vendor: e.target.checked})} 
                    style={{ width: 16, height: 16 }} 
                  />
                  <div>
                    <span style={{ fontSize: 13, color: "#1E293B", fontWeight: 700 }}>Memerlukan Vendor Eksternal</span>
                    <div style={{ fontSize: 11, color: "#64748B" }}>Barang dikirim keluar ke tempat rekanan / CMT</div>
                  </div>
                </label>
              </div>

              {/* MODAL ACTIONS */}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 10, borderTop: "1px solid #F1F5F9" }}>
                <button 
                  type="button" 
                  onClick={() => setShowForm(false)}
                  className="btn btn-secondary"
                  style={{ padding: "10px 20px", fontSize: 13, fontWeight: 700 }}
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={saving}
                  className="btn btn-primary"
                  style={{ padding: "10px 26px", fontSize: 13, fontWeight: 800, background: "linear-gradient(135deg, #1E40AF, #2563EB)", display: "flex", alignItems: "center", gap: 8 }}
                >
                  <Save size={16} /> {saving ? "Menyimpan..." : "Simpan Tahap"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}