// @ts-nocheck
"use client";
import React, { useEffect, useState } from "react";
import { Plus, X, Pencil, Save, Trash2, ChevronUp, ChevronDown, Eye, EyeOff, Settings2, Scissors, Zap, Droplets, Filter, Star, Package, ChevronRight } from "lucide-react";
import { toast } from "sonner";

const VENDOR_TIPE_OPTIONS = [
  { value: "", label: "-- Tidak perlu vendor (internal) --" },
  { value: "cmt", label: "CMT (Jahit)" },
  { value: "washing", label: "Washing" },
  { value: "bersih_benang", label: "Bersih Benang" },
  { value: "finishing", label: "Finishing" },
  { value: "lainnya", label: "Lainnya" },
];

const STAGE_ICON_MAP = {
  potong_kain: Scissors, jahit: Zap, bersih_benang: Filter,
  washing: Droplets, finishing: Star, gudang: Package,
};
const getIcon = (slug) => STAGE_ICON_MAP[slug] || Package;

const WARNA_OPTIONS = [
  "#3B82F6","#8B5CF6","#0891B2","#059669","#64748B",
  "#EF4444","#F59E0B","#EC4899","#14B8A6","#6366F1","#F97316","#A855F7"
];

const EMPTY_FORM = {
  nama: "", slug: "", warna: "#64748B", vendor_tipe: null, opsional: false, butuh_vendor: false, deskripsi: ""
};

export default function AlurProduksiSettingsPage() {
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editStage, setEditStage] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchStages = () => {
    setLoading(true);
    fetch("/api/pipeline-stages?_t=" + Date.now())
      .then(r => r.json())
      .then(d => { setStages(Array.isArray(d) ? d : []); setLoading(false); });
  };

  useEffect(() => { fetchStages(); }, []);

  const openNew = () => { setForm(EMPTY_FORM); setEditStage(null); setShowForm(true); };
  const openEdit = (s) => {
    setForm({ nama: s.nama, slug: s.slug, warna: s.warna, vendor_tipe: s.vendor_tipe, opsional: s.opsional, butuh_vendor: s.butuh_vendor, deskripsi: s.deskripsi || "" });
    setEditStage(s); setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (editStage) {
        await fetch("/api/pipeline-stages", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editStage.id, ...form }) });
        toast.success("Stage diperbarui!");
      } else {
        await fetch("/api/pipeline-stages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
        toast.success("Stage baru ditambahkan!");
      }
      fetchStages(); setShowForm(false);
    } catch { toast.error("Gagal menyimpan"); }
    setSaving(false);
  };

  const handleDelete = async (id, nama) => {
    if (!confirm("Hapus stage \"" + nama + "\"?")) return;
    await fetch("/api/pipeline-stages", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    toast.success("Stage \"" + nama + "\" dihapus"); fetchStages();
  };

  const handleToggleAktif = async (stage) => {
    await fetch("/api/pipeline-stages", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: stage.id, aktif: !stage.aktif }) });
    fetchStages();
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
    await fetch("/api/pipeline-stages", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reorder: newOrder }) });
    fetchStages();
  };

  const sorted = [...stages].sort((a, b) => a.urutan - b.urutan);
  const active = sorted.filter(s => s.aktif);

  return (
    <div style={{ background: "#F1F5F9", minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>

      {/* HEADER */}
      <div style={{ background: "white", borderBottom: "1px solid #E2E8F0", padding: "20px 32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,#1E3A5F,#2563EB)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Settings2 size={22} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 900, color: "#0F172A", margin: 0 }}>Pengaturan Alur Produksi</h1>
            <p style={{ color: "#94A3B8", margin: "2px 0 0", fontSize: 13 }}>Konfigurasi tahapan produksi sesuai bisnis Anda</p>
          </div>
        </div>
        <button onClick={openNew}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 12, background: "linear-gradient(135deg,#1E3A5F,#2563EB)", color: "white", border: "none", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          <Plus size={16} /> Tambah Tahap
        </button>
      </div>

      <div style={{ padding: "24px 32px" }}>

        {/* PIPELINE PREVIEW */}
        <div style={{ background: "white", borderRadius: 16, padding: "20px 24px", marginBottom: 24, border: "1px solid #E2E8F0", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>Preview Alur Produksi</div>
          {active.length === 0 ? (
            <div style={{ color: "#94A3B8", fontSize: 13 }}>Belum ada tahap aktif.</div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              {active.map((s, i) => {
                const Icon = getIcon(s.slug);
                return (
                  <React.Fragment key={s.id}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#F8FAFC", border: `1.5px solid ${s.warna}`, borderRadius: 10, padding: "7px 14px" }}>
                      <div style={{ width: 24, height: 24, borderRadius: 7, background: s.warna + "15", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Icon size={13} color={s.warna} />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{s.nama}</span>
                      {s.opsional && <span style={{ fontSize: 9, background: "#FEF3C7", color: "#92400E", padding: "1px 5px", borderRadius: 5, fontWeight: 700 }}>OPS</span>}
                    </div>
                    {i < active.length - 1 && <ChevronRight size={14} color="#CBD5E1" />}
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>

        {/* STAGE LIST */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 48, color: "#94A3B8" }}>Memuat...</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sorted.map((stage, idx) => {
              const Icon = getIcon(stage.slug);
              return (
                <div key={stage.id} style={{
                  background: "white", borderRadius: 14,
                  border: `1.5px solid ${stage.aktif ? stage.warna + "30" : "#E2E8F0"}`,
                  display: "flex", alignItems: "center", gap: 0, overflow: "hidden",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.04)", opacity: stage.aktif ? 1 : 0.6,
                }}>
                  {/* Color bar */}
                  <div style={{ width: 5, alignSelf: "stretch", background: stage.aktif ? stage.warna : "#E2E8F0", flexShrink: 0 }} />

                  {/* Reorder */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 8px", flexShrink: 0 }}>
                    <button onClick={() => moveStage(idx, "up")} disabled={idx === 0}
                      style={{ background: "none", border: "none", cursor: idx === 0 ? "default" : "pointer", color: idx === 0 ? "#E2E8F0" : "#94A3B8", padding: 2, display: "flex" }}>
                      <ChevronUp size={13} />
                    </button>
                    <button onClick={() => moveStage(idx, "down")} disabled={idx === sorted.length - 1}
                      style={{ background: "none", border: "none", cursor: idx === sorted.length - 1 ? "default" : "pointer", color: idx === sorted.length - 1 ? "#E2E8F0" : "#94A3B8", padding: 2, display: "flex" }}>
                      <ChevronDown size={13} />
                    </button>
                  </div>

                  {/* Icon */}
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: stage.warna + "12", border: `1px solid ${stage.warna}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, margin: "12px 0 12px 4px" }}>
                    <Icon size={18} color={stage.warna} />
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>{stage.nama}</span>
                      <span style={{ fontSize: 10, color: "#94A3B8", background: "#F1F5F9", padding: "1px 7px", borderRadius: 5 }}>{stage.slug}</span>
                      {stage.opsional && <span style={{ fontSize: 10, background: "#FEF3C7", color: "#92400E", padding: "1px 6px", borderRadius: 6, fontWeight: 700 }}>OPSIONAL</span>}
                      {!stage.aktif && <span style={{ fontSize: 10, background: "#FEF2F2", color: "#DC2626", padding: "1px 6px", borderRadius: 6, fontWeight: 700 }}>NONAKTIF</span>}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748B", marginTop: 3 }}>
                      {stage.deskripsi || "Tidak ada deskripsi"}
                      {stage.vendor_tipe && <span style={{ marginLeft: 10, background: "#EFF6FF", color: "#2563EB", padding: "1px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600 }}>Vendor: {stage.vendor_tipe}</span>}
                    </div>
                  </div>

                  {/* Urutan */}
                  <div style={{ flexShrink: 0, padding: "0 12px" }}>
                    <div style={{ width: 30, height: 30, borderRadius: "50%", background: stage.warna + "12", border: `1.5px solid ${stage.warna}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900, color: stage.warna }}>{stage.urutan}</div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 6, padding: "0 14px", flexShrink: 0 }}>
                    <button onClick={() => handleToggleAktif(stage)}
                      style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${stage.aktif ? "#BBF7D0" : "#FECACA"}`, background: stage.aktif ? "#F0FDF4" : "#FEF2F2", color: stage.aktif ? "#059669" : "#DC2626", cursor: "pointer", display: "flex", alignItems: "center" }}>
                      {stage.aktif ? <Eye size={13} /> : <EyeOff size={13} />}
                    </button>
                    <button onClick={() => openEdit(stage)}
                      style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #BFDBFE", background: "#EFF6FF", color: "#2563EB", cursor: "pointer", display: "flex", alignItems: "center" }}>
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => handleDelete(stage.id, stage.nama)}
                      style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #FECACA", background: "#FEF2F2", color: "#DC2626", cursor: "pointer", display: "flex", alignItems: "center" }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}

            {sorted.length === 0 && (
              <div style={{ textAlign: "center", padding: "48px 24px", background: "white", borderRadius: 16, border: "1.5px dashed #E2E8F0" }}>
                <p style={{ color: "#94A3B8", margin: 0, fontSize: 14 }}>Belum ada tahap. Klik "Tambah Tahap" untuk mulai.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* FORM MODAL */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div style={{ background: "white", borderRadius: 20, width: "100%", maxWidth: 520, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            <div style={{ padding: "18px 24px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#0F172A" }}>
                {editStage ? "Edit Stage: " + editStage.nama : "Tambah Tahap Baru"}
              </h2>
              <button onClick={() => setShowForm(false)}
                style={{ background: "#F1F5F9", border: "none", borderRadius: 8, padding: 7, cursor: "pointer", color: "#64748B", display: "flex" }}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSave} style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Nama Tahap *</label>
                  <input required value={form.nama} onChange={e => setForm({...form, nama: e.target.value})} placeholder="Bersih Benang"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #E2E8F0", background: "#F8FAFC", color: "#0F172A", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Slug *</label>
                  <input required value={form.slug} onChange={e => setForm({...form, slug: e.target.value.toLowerCase().replace(/\s+/g, "_")})} placeholder="bersih_benang"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #E2E8F0", background: "#F8FAFC", color: "#475569", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Deskripsi</label>
                <input value={form.deskripsi} onChange={e => setForm({...form, deskripsi: e.target.value})} placeholder="Penjelasan singkat tahap ini"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #E2E8F0", background: "#F8FAFC", color: "#0F172A", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Warna</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {WARNA_OPTIONS.map(w => (
                    <button key={w} type="button" onClick={() => setForm({...form, warna: w})}
                      style={{ width: 30, height: 30, borderRadius: 8, background: w, border: form.warna === w ? "3px solid #0F172A" : "2px solid transparent", cursor: "pointer", outline: "none" }} />
                  ))}
                </div>
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 20, height: 20, borderRadius: 6, background: form.warna, border: "2px solid #E2E8F0" }} />
                  <span style={{ fontSize: 12, color: "#64748B" }}>Warna dipilih: {form.warna}</span>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Tipe Vendor</label>
                <select value={form.vendor_tipe || ""} onChange={e => setForm({...form, vendor_tipe: e.target.value || null})}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #E2E8F0", background: "#F8FAFC", color: "#0F172A", fontSize: 14, outline: "none" }}>
                  {VENDOR_TIPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              <div style={{ display: "flex", gap: 24 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input type="checkbox" checked={form.opsional} onChange={e => setForm({...form, opsional: e.target.checked})} style={{ width: 15, height: 15 }} />
                  <span style={{ fontSize: 13, color: "#475569", fontWeight: 600 }}>Opsional</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input type="checkbox" checked={form.butuh_vendor} onChange={e => setForm({...form, butuh_vendor: e.target.checked})} style={{ width: 15, height: 15 }} />
                  <span style={{ fontSize: 13, color: "#475569", fontWeight: 600 }}>Butuh Vendor</span>
                </label>
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 4, borderTop: "1px solid #F1F5F9" }}>
                <button type="button" onClick={() => setShowForm(false)}
                  style={{ padding: "10px 20px", borderRadius: 10, border: "1.5px solid #E2E8F0", background: "white", fontWeight: 600, cursor: "pointer", color: "#64748B" }}>
                  Batal
                </button>
                <button type="submit" disabled={saving}
                  style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#1E3A5F,#2563EB)", color: "white", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                  <Save size={14} /> {saving ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}