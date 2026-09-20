// @ts-nocheck
"use client";
import React, { useEffect, useState } from "react";
import { Plus, X, Pencil, Settings2, Globe, Banknote, ExternalLink, Phone, Tag, ChevronRight, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const emptyVendor = { nama: "", tipe: "", jenis_default: "", kontak: "", wajib_hitung_ulang: false, hargaPerPcs: 0, tarifPotongan: {} };
const emptyType = { nama: "", slug: "", emoji: "📦", perlu_portal: false, portal_path: "", perlu_gaji: false };

// Gradient per tipe
const TIPE_STYLE: Record<string, { grad: string; light: string; border: string; color: string }> = {
  cmt:       { grad: "linear-gradient(135deg,#1E3A5F,#2563EB)", light: "#EFF6FF", border: "#BFDBFE", color: "#1D4ED8" },
  washing:   { grad: "linear-gradient(135deg,#0C3A47,#0891B2)", light: "#ECFEFF", border: "#A5F3FC", color: "#0E7490" },
  benang:    { grad: "linear-gradient(135deg,#2D1B69,#6D28D9)", light: "#F5F3FF", border: "#DDD6FE", color: "#7C3AED" },
  finishing: { grad: "linear-gradient(135deg,#064E3B,#059669)", light: "#ECFDF5", border: "#6EE7B7", color: "#059669" },
  lainnya:   { grad: "linear-gradient(135deg,#1E293B,#475569)", light: "#F8FAFC", border: "#E2E8F0", color: "#475569" },
};
const defaultStyle = { grad: "linear-gradient(135deg,#1E293B,#475569)", light: "#F8FAFC", border: "#E2E8F0", color: "#475569" };
const getStyle = (slug: string) => TIPE_STYLE[slug] || defaultStyle;

const Toggle = ({ value, onChange, colorOn = "#2563EB" }) => (
  <button type="button" onClick={onChange} style={{ width: 44, height: 24, borderRadius: 12, border: "none", background: value ? colorOn : "#CBD5E1", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
    <div style={{ position: "absolute", top: 2, left: value ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "white", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
  </button>
);

export default function AturVendorPage() {
  const [vendors, setVendors] = useState([]);
  const [vendorTypes, setVendorTypes] = useState([]);
  const [kategoriList, setKategoriList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showVendorForm, setShowVendorForm] = useState(false);
  const [editVendorId, setEditVendorId] = useState(null);
  const [vendorForm, setVendorForm] = useState({ ...emptyVendor });
  const [savingVendor, setSavingVendor] = useState(false);
  const [showTipeForm, setShowTipeForm] = useState(false);
  const [editTipeId, setEditTipeId] = useState(null);
  const [tipeForm, setTipeForm] = useState({ ...emptyType });
  const [savingTipe, setSavingTipe] = useState(false);
  const [activeTab, setActiveTab] = useState("vendor");

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [rv, rt, rk] = await Promise.all([
        fetch("/api/vendors?_t=" + Date.now()).then(r => r.json()),
        fetch("/api/vendor-types?_t=" + Date.now()).then(r => r.json()),
        fetch("/api/kategori?_t=" + Date.now()).then(r => r.json()),
      ]);
      setVendors(Array.isArray(rv) ? rv : []);
      setVendorTypes(Array.isArray(rt) ? rt : []);
      setKategoriList(Array.isArray(rk) ? rk : []);
    } catch { toast.error("Gagal memuat data"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const h = () => load(true);
    window.addEventListener("konveksi-sync", h);
    return () => window.removeEventListener("konveksi-sync", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getTipeInfo = (slug) => vendorTypes.find(t => t.slug === slug);

  const openAddVendor = () => { setEditVendorId(null); setVendorForm({ ...emptyVendor, tipe: vendorTypes[0]?.slug || "" }); setShowVendorForm(true); };
  const openEditVendor = (v) => { setEditVendorId(v.id); setVendorForm({ nama: v.nama, tipe: v.tipe || "", jenis_default: v.jenis_default || "", kontak: v.kontak || "", wajib_hitung_ulang: !!v.wajib_hitung_ulang, hargaPerPcs: v.hargaPerPcs || 0, tarifPotongan: v.tarifPotongan || {} }); setShowVendorForm(true); };
  const handleSaveVendor = async (e) => {
    e.preventDefault(); if (!vendorForm.nama) return;
    setSavingVendor(true);
    try {
      const method = editVendorId ? "PATCH" : "POST";
      const body = editVendorId ? { id: editVendorId, ...vendorForm } : vendorForm;
      const res = await fetch("/api/vendors", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error("Gagal menyimpan");
      toast.success(editVendorId ? "Vendor diperbarui!" : "Vendor baru ditambahkan!");
      setShowVendorForm(false); load();
    } catch (err) { toast.error(err.message); }
    finally { setSavingVendor(false); }
  };
  const handleToggleAktif = async (v) => {
    await fetch("/api/vendors", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: v.id, aktif: !v.aktif }) });
    load();
  };

  const openAddTipe = () => { setEditTipeId(null); setTipeForm({ ...emptyType }); setShowTipeForm(true); };
  const openEditTipe = (t) => { setEditTipeId(t.id); setTipeForm({ nama: t.nama, slug: t.slug, emoji: t.emoji, perlu_portal: !!t.perlu_portal, portal_path: t.portal_path || "", perlu_gaji: !!t.perlu_gaji }); setShowTipeForm(true); };
  const handleSaveTipe = async (e) => {
    e.preventDefault(); if (!tipeForm.nama || !tipeForm.slug) return;
    setSavingTipe(true);
    try {
      const method = editTipeId ? "PATCH" : "POST";
      const body = editTipeId ? { id: editTipeId, ...tipeForm } : tipeForm;
      const res = await fetch("/api/vendor-types", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");
      toast.success(editTipeId ? "Tipe diperbarui!" : "Tipe baru ditambahkan!");
      setShowTipeForm(false); load();
    } catch (err) { toast.error(err.message); }
    finally { setSavingTipe(false); }
  };
  const handleDeleteTipe = async (id) => {
    if (!confirm("Hapus tipe vendor ini?")) return;
    const res = await fetch("/api/vendor-types?id=" + id, { method: "DELETE" });
    if (res.ok) { toast.success("Tipe dihapus"); load(); }
    else toast.error("Gagal menghapus");
  };

  const aktif = vendors.filter(v => v.aktif);
  const nonaktif = vendors.filter(v => !v.aktif);
  const groupedByTipe = aktif.reduce((acc, v) => { const k = v.tipe || "lainnya"; if (!acc[k]) acc[k] = []; acc[k].push(v); return acc; }, {});

  return (
    <>
      <style>{`
        .av-wrap { display: flex; flex-direction: column; height: 100%; background: #F1F5F9; overflow: hidden; }
        .av-topbar { padding: 18px 28px 0; background: white; border-bottom: 1px solid #E2E8F0; flex-shrink: 0; }
        .av-topbar-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
        .av-topbar h1 { font-size: 22px; font-weight: 900; color: #0F172A; margin: 0 0 2px; }
        .av-topbar p { font-size: 13px; color: #64748B; margin: 0; }
        .av-actions { display: flex; gap: 10px; flex-shrink: 0; }
        .av-tabs { display: flex; gap: 4px; }
        .av-tab { padding: 10px 18px; border: none; background: transparent; cursor: pointer; font-weight: 700; font-size: 14px; border-bottom: 3px solid transparent; color: #64748B; transition: color 0.15s; }
        .av-tab.active { border-bottom-color: #2563EB; color: #2563EB; }
        .av-body { flex: 1; overflow-y: auto; padding: 24px 28px; }
        .av-section { margin-bottom: 36px; }
        .av-section-hdr { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
        .av-section-pill { display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 10px; }
        .av-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 18px; }

        /* Vendor Card */
        .vc2 { border-radius: 16px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.06); transition: transform 0.2s, box-shadow 0.2s; border: 1px solid #E2E8F0; background: white; }
        .vc2:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(0,0,0,0.1); }
        .vc2-banner { padding: 18px 20px 16px; position: relative; overflow: hidden; }
        .vc2-banner::before { content: ''; position: absolute; top: -40%; right: -10%; width: 160px; height: 160px; border-radius: 50%; background: rgba(255,255,255,0.07); }
        .vc2-banner::after { content: ''; position: absolute; bottom: -50%; left: -5%; width: 130px; height: 130px; border-radius: 50%; background: rgba(255,255,255,0.04); }
        .vc2-banner-top { display: flex; justify-content: space-between; align-items: flex-start; position: relative; z-index: 1; margin-bottom: 14px; }
        .vc2-name { font-size: 17px; font-weight: 900; color: white; }
        .vc2-code { font-size: 10px; color: rgba(255,255,255,0.55); font-family: monospace; margin-top: 2px; font-weight: 600; }
        .vc2-actions { display: flex; gap: 6px; }
        .vc2-btn { width: 30px; height: 30px; border-radius: 8px; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
        .vc2-stats { display: flex; gap: 0; border-top: 1px solid rgba(255,255,255,0.12); padding-top: 12px; position: relative; z-index: 1; }
        .vc2-stat { flex: 1; }
        .vc2-stat + .vc2-stat { padding-left: 12px; border-left: 1px solid rgba(255,255,255,0.12); }
        .vc2-stat-lbl { font-size: 9px; color: rgba(255,255,255,0.5); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
        .vc2-stat-val { font-size: 14px; font-weight: 800; color: white; margin-top: 2px; }
        .vc2-body { padding: 14px 18px 16px; }
        .vc2-badges { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }
        .vc2-badge { padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; border: 1px solid; }
        .vc2-footer { display: flex; gap: 8px; }
        .vc2-wa { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 8px; background: #F0FDF4; border: 1px solid #86EFAC; color: #16A34A; text-decoration: none; border-radius: 8px; font-size: 12px; font-weight: 700; }
        .vc2-nowa { flex: 1; display: flex; align-items: center; justify-content: center; padding: 8px; background: #F8FAFC; color: #94A3B8; border-radius: 8px; font-size: 12px; font-weight: 600; }
        .vc2-portal { display: flex; align-items: center; justify-content: center; gap: 6px; padding: "8px 14px"; background: white; border: 1px solid #93C5FD; color: #2563EB; text-decoration: none; border-radius: 8px; font-size: 12px; font-weight: 700; padding: 8px 14px; }
        .vc2-tarif-row { background: #FFF7ED; border: 1px solid #FDBA74; border-radius: 8px; padding: 8px 12px; margin-bottom: 12px; }
        .vc2-tarif-title { font-size: 10px; font-weight: 700; color: "#C2410C"; color: #C2410C; margin-bottom: 6px; display: flex; align-items: center; gap: 4px; }
        .vc2-tarif-items { display: flex; flex-wrap: wrap; gap: 4px; }
        .vc2-tarif-chip { background: #FED7AA; color: #9A3412; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; }

        /* Tipe Card */
        .tc { background: white; border-radius: 14px; border: 1px solid #E2E8F0; overflow: hidden; transition: transform 0.15s, box-shadow 0.15s; }
        .tc:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.08); }
        .tc-banner { padding: 18px 18px 14px; position: relative; overflow: hidden; }
        .tc-banner::before { content: ''; position: absolute; top: -40%; right: -10%; width: 140px; height: 140px; border-radius: 50%; background: rgba(255,255,255,0.07); }
        .tc-top { display: flex; justify-content: space-between; position: relative; z-index: 1; }
        .tc-emoji { font-size: 30px; }
        .tc-name { font-size: 17px; font-weight: 900; color: white; margin-top: 6px; position: relative; z-index: 1; }
        .tc-slug { font-size: 10px; font-family: monospace; color: rgba(255,255,255,0.55); position: relative; z-index: 1; margin-top: 2px; }
        .tc-body { padding: 14px 18px 16px; }
        .tc-prop { display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; border-radius: 8px; margin-bottom: 6px; background: #F8FAFC; }
        .tc-prop-lbl { font-size: 12px; color: #64748B; font-weight: 600; display: flex; align-items: center; gap: 6px; }
        .tc-prop-val { font-size: 12px; font-weight: 700; }

        @media (max-width: 900px) { .av-grid { grid-template-columns: 1fr 1fr; } .av-body { padding: 16px; } .av-topbar { padding: 14px 16px 0; } }
        @media (max-width: 600px) { .av-grid { grid-template-columns: 1fr; } .av-actions { flex-direction: column; gap: 6px; } }
      `}</style>

      <div className="av-wrap">
        {/* Topbar */}
        <div className="av-topbar">
          <div className="av-topbar-row">
            <div>
              <h1>Atur Vendor Produksi</h1>
              <p>Manajemen direktori vendor dan kategori tipe produksi</p>
            </div>
            <div className="av-actions">
              <button onClick={() => { setActiveTab("tipe"); openAddTipe(); }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10, border: "1.5px solid #6366F1", background: "white", color: "#6366F1", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                <Settings2 size={15} /> Tambah Tipe Vendor
              </button>
              <button onClick={openAddVendor} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#2563EB,#1D4ED8)", color: "white", fontWeight: 700, cursor: "pointer", fontSize: 13, boxShadow: "0 4px 12px rgba(37,99,235,0.3)" }}>
                <Plus size={15} /> Tambah Vendor
              </button>
            </div>
          </div>
          <div className="av-tabs">
            {["vendor", "tipe"].map(tab => (
              <button key={tab} className={`av-tab${activeTab === tab ? " active" : ""}`} onClick={() => setActiveTab(tab)}>
                {tab === "vendor" ? `Daftar Vendor (${vendors.length})` : `Tipe Vendor (${vendorTypes.length})`}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="av-body">

          {/* ===== TAB VENDOR ===== */}
          {activeTab === "vendor" && (
            <>
              {loading ? <div style={{ textAlign: "center", padding: 48, color: "#64748B" }}>⏳ Memuat vendor...</div> : (

                Object.keys(groupedByTipe).length === 0 ? (
                  <div style={{ background: "white", borderRadius: 16, padding: 60, textAlign: "center", border: "1px solid #E2E8F0" }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>🏭</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>Belum ada vendor aktif</div>
                    <div style={{ fontSize: 13, color: "#64748B", marginTop: 6 }}>Klik "Tambah Vendor" untuk memulai.</div>
                  </div>
                ) : (
                  Object.entries(groupedByTipe).map(([slug, vlist]: [string, any[]]) => {
                    const ti = getTipeInfo(slug);
                    const st = getStyle(slug);
                    return (
                      <div key={slug} className="av-section">
                        <div className="av-section-hdr">
                          <div className="av-section-pill" style={{ background: st.light, border: `1.5px solid ${st.border}` }}>
                            <span style={{ fontSize: 20 }}>{ti?.emoji || "📦"}</span>
                            <div>
                              <div style={{ fontWeight: 900, fontSize: 14, color: st.color }}>Vendor {ti?.nama || slug}</div>
                              <div style={{ fontSize: 11, color: "#64748B" }}>{vlist.length} vendor aktif</div>
                            </div>
                          </div>
                          <div style={{ flex: 1, height: 1.5, background: `linear-gradient(to right,${st.border},transparent)` }} />
                        </div>

                        <div className="av-grid">
                          {vlist.map(v => {
                            const tarifEntries = Object.entries(v.tarifPotongan || {});
                            const portalHref = ti?.perlu_portal ? (ti.slug === "cmt" ? `/cmt/${v.id}` : (ti.portal_path ? `${ti.portal_path}/${v.id}` : null)) : null;

                            return (
                              <div key={v.id} className="vc2">
                                {/* Banner */}
                                <div className="vc2-banner" style={{ background: st.grad }}>
                                  <div className="vc2-banner-top">
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div className="vc2-name">{v.nama}</div>
                                      <div className="vc2-code">ID: {v.kodeVendor}</div>
                                    </div>
                                    <div className="vc2-actions">
                                      <button className="vc2-btn" onClick={() => openEditVendor(v)} style={{ background: "rgba(255,255,255,0.15)", color: "white" }} title="Edit">
                                        <Pencil size={13} />
                                      </button>
                                      <button className="vc2-btn" onClick={() => handleToggleAktif(v)} style={{ background: "rgba(239,68,68,0.2)", color: "#FCA5A5" }} title="Nonaktifkan">
                                        <X size={13} />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Stats */}
                                  <div className="vc2-stats">
                                    <div className="vc2-stat">
                                      <div className="vc2-stat-lbl">Spesialisasi</div>
                                      <div className="vc2-stat-val" style={{ fontSize: 13 }}>{v.jenis_default || "-"}</div>
                                    </div>
                                    {(v.hargaPerPcs || 0) > 0 && (
                                      <div className="vc2-stat">
                                        <div className="vc2-stat-lbl">Tarif Default</div>
                                        <div className="vc2-stat-val" style={{ fontSize: 12 }}>Rp {(v.hargaPerPcs || 0).toLocaleString("id-ID")}/pcs</div>
                                      </div>
                                    )}
                                    {tarifEntries.length > 0 && (
                                      <div className="vc2-stat">
                                        <div className="vc2-stat-lbl">Tarif Khusus</div>
                                        <div className="vc2-stat-val">{tarifEntries.length} Kategori</div>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Body */}
                                <div className="vc2-body">
                                  {/* Badges */}
                                  <div className="vc2-badges">
                                    <span className="vc2-badge" style={{ background: v.wajib_hitung_ulang ? "#FEF2F2" : "#F0FDF4", color: v.wajib_hitung_ulang ? "#DC2626" : "#16A34A", borderColor: v.wajib_hitung_ulang ? "#FECACA" : "#BBF7D0" }}>
                                      {v.wajib_hitung_ulang ? "⚖️ Wajib Hitung" : "⚡ Cepat Bypass"}
                                    </span>
                                    {ti?.perlu_gaji && (
                                      <span className="vc2-badge" style={{ background: "#EFF6FF", color: "#1D4ED8", borderColor: "#BFDBFE" }}>
                                        💰 Pencatatan Gaji
                                      </span>
                                    )}
                                    {ti?.perlu_portal && (
                                      <span className="vc2-badge" style={{ background: "#F5F3FF", color: "#7C3AED", borderColor: "#DDD6FE" }}>
                                        🌐 Punya Portal
                                      </span>
                                    )}
                                  </div>

                                  {/* Tarif Khusus detail */}
                                  {tarifEntries.length > 0 && (
                                    <div className="vc2-tarif-row">
                                      <div className="vc2-tarif-title">
                                        <Tag size={10} /> Tarif Khusus per Kategori
                                      </div>
                                      <div className="vc2-tarif-items">
                                        {tarifEntries.map(([kat, rp]: any) => (
                                          <span key={kat} className="vc2-tarif-chip">{kat}: Rp {rp.toLocaleString("id-ID")}</span>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Footer actions */}
                                  <div className="vc2-footer">
                                    {v.kontak
                                      ? <a href={`https://wa.me/62${v.kontak.replace(/^0/, "")}`} target="_blank" rel="noreferrer" className="vc2-wa">💬 Chat WA</a>
                                      : <div className="vc2-nowa">Tanpa No HP</div>
                                    }
                                    {portalHref && (
                                      <a href={portalHref} target="_blank" rel="noreferrer" className="vc2-portal">
                                        <ExternalLink size={12} /> Portal
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )
              )}

              {/* Nonaktif */}
              {nonaktif.length > 0 && (
                <div className="av-section">
                  <div className="av-section-hdr">
                    <h3 style={{ margin: 0, fontWeight: 800, color: "#64748B", fontSize: 15 }}>Vendor Dinonaktifkan ({nonaktif.length})</h3>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {nonaktif.map(v => (
                      <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", background: "white", border: "1px solid #E2E8F0", borderRadius: 10, opacity: 0.65 }}>
                        <div>
                          <div style={{ fontWeight: 700, color: "#475569" }}>{v.nama}</div>
                          <div style={{ fontSize: 11, color: "#94A3B8" }}>{v.jenis_default || v.tipe}</div>
                        </div>
                        <button onClick={() => handleToggleAktif(v)} style={{ padding: "7px 14px", background: "white", border: "1px solid #E2E8F0", color: "#475569", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                          <CheckCircle size={13} /> Aktifkan Lagi
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ===== TAB TIPE ===== */}
          {activeTab === "tipe" && (
            <>
              <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 12, padding: "12px 18px", marginBottom: 20, fontSize: 13, color: "#1E40AF", fontWeight: 600 }}>
                Tipe Vendor menentukan kategori, apakah memiliki portal akses sendiri, dan apakah perlu pencatatan gaji/biaya.
              </div>
              <div className="av-grid">
                {vendorTypes.map((t, i) => {
                  const st = getStyle(t.slug);
                  const vendorCount = aktif.filter(v => v.tipe === t.slug).length;
                  return (
                    <div key={t.id} className="tc">
                      <div className="tc-banner" style={{ background: st.grad }}>
                        <div className="tc-top">
                          <div style={{ fontSize: 32, position: "relative", zIndex: 1 }}>{t.emoji}</div>
                          <div style={{ display: "flex", gap: 6, position: "relative", zIndex: 1 }}>
                            <button onClick={() => openEditTipe(t)} style={{ width: 30, height: 30, background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Pencil size={13} /></button>
                            <button onClick={() => handleDeleteTipe(t.id)} style={{ width: 30, height: 30, background: "rgba(239,68,68,0.2)", border: "none", borderRadius: 8, color: "#FCA5A5", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={13} /></button>
                          </div>
                        </div>
                        <div className="tc-name">{t.nama}</div>
                        <div className="tc-slug">slug: {t.slug}</div>
                      </div>
                      <div className="tc-body">
                        <div className="tc-prop">
                          <div className="tc-prop-lbl"><Globe size={13} /> Portal Akses</div>
                          <div className="tc-prop-val" style={{ color: t.perlu_portal ? "#2563EB" : "#94A3B8" }}>
                            {t.perlu_portal ? `✓ ${t.portal_path}/[id]` : "Tidak ada"}
                          </div>
                        </div>
                        <div className="tc-prop">
                          <div className="tc-prop-lbl"><Banknote size={13} /> Pencatatan Gaji</div>
                          <div className="tc-prop-val" style={{ color: t.perlu_gaji ? "#16A34A" : "#94A3B8" }}>
                            {t.perlu_gaji ? "✓ Aktif" : "Tidak ada"}
                          </div>
                        </div>
                        <div className="tc-prop">
                          <div className="tc-prop-lbl" style={{ color: "#475569" }}>Vendor Aktif</div>
                          <div className="tc-prop-val" style={{ color: "#0F172A" }}>{vendorCount} vendor</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <button onClick={openAddTipe} style={{ border: "2px dashed #CBD5E1", borderRadius: 14, padding: 22, background: "transparent", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: "#64748B", minHeight: 180 }}>
                  <Plus size={28} /><span style={{ fontWeight: 700, fontSize: 14 }}>Tambah Tipe Baru</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ===== MODAL VENDOR ===== */}
      {showVendorForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.7)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "white", borderRadius: 20, width: "100%", maxWidth: 540, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(0,0,0,0.25)" }}>
            <div style={{ padding: "20px 26px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "white", zIndex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {vendorTypes.find(t => t.slug === vendorForm.tipe)?.emoji || "🏭"}
                </div>
                <h2 style={{ margin: 0, fontWeight: 800, fontSize: 17, color: "#0F172A" }}>{editVendorId ? "Edit Vendor" : "Tambah Vendor Baru"}</h2>
              </div>
              <button onClick={() => setShowVendorForm(false)} style={{ background: "#F1F5F9", border: "none", width: 32, height: 32, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B" }}><X size={16} /></button>
            </div>
            <form onSubmit={handleSaveVendor} style={{ padding: 26 }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontWeight: 700, fontSize: 12, color: "#475569", marginBottom: 6 }}>Nama Vendor / Pabrik *</label>
                <input className="form-control" value={vendorForm.nama} onChange={e => setVendorForm(f => ({ ...f, nama: e.target.value }))} placeholder="Contoh: CMT Jahit Barokah" required />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontWeight: 700, fontSize: 12, color: "#475569", marginBottom: 6 }}>Tipe Vendor *</label>
                <select className="form-control" value={vendorForm.tipe} onChange={e => setVendorForm(f => ({ ...f, tipe: e.target.value }))} required>
                  <option value="">Pilih Tipe...</option>
                  {vendorTypes.map(t => <option key={t.slug} value={t.slug}>{t.emoji} {t.nama}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontWeight: 700, fontSize: 12, color: "#475569", marginBottom: 6 }}>Keahlian / Spesialisasi</label>
                <input className="form-control" value={vendorForm.jenis_default} onChange={e => setVendorForm(f => ({ ...f, jenis_default: e.target.value }))} placeholder="Contoh: Jahit, Sablon, Bordir" />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontWeight: 700, fontSize: 12, color: "#475569", marginBottom: 6 }}>Kontak WhatsApp</label>
                <div style={{ display: "flex", border: "1px solid #E2E8F0", borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ padding: "10px 14px", background: "#F8FAFC", fontWeight: 700, fontSize: 13, color: "#64748B", borderRight: "1px solid #E2E8F0" }}>+62</div>
                  <input style={{ flex: 1, padding: "10px 14px", border: "none", outline: "none", fontSize: 14 }} value={vendorForm.kontak} onChange={e => setVendorForm(f => ({ ...f, kontak: e.target.value }))} placeholder="81234567890" />
                </div>
              </div>

              {getTipeInfo(vendorForm.tipe)?.perlu_gaji && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontWeight: 700, fontSize: 12, color: "#475569", marginBottom: 6 }}>Gaji / Tarif Default per Pcs (Rp)</label>
                  <div style={{ display: "flex", border: "1px solid #E2E8F0", borderRadius: 8, overflow: "hidden" }}>
                    <div style={{ padding: "10px 14px", background: "#F8FAFC", fontWeight: 700, fontSize: 13, color: "#64748B", borderRight: "1px solid #E2E8F0" }}>Rp</div>
                    <input type="number" style={{ flex: 1, padding: "10px 14px", border: "none", outline: "none", fontSize: 14 }} value={vendorForm.hargaPerPcs || ""} onChange={e => setVendorForm(f => ({ ...f, hargaPerPcs: parseInt(e.target.value) || 0 }))} placeholder="5000" />
                  </div>
                  <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>Tarif default jika kategori produk tidak diatur khusus.</div>

                  {/* Tarif Khusus */}
                  <div style={{ marginTop: 12, border: "1px solid #E2E8F0", borderRadius: 8, overflow: "hidden" }}>
                    <div style={{ padding: "10px 14px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: 12, color: "#475569" }}>Tarif Khusus per Kategori</strong>
                      <button type="button" onClick={() => setVendorForm(f => ({ ...f, tarifPotongan: { ...(f.tarifPotongan || {}), [Date.now().toString()]: 0 } }))} style={{ padding: "4px 10px", fontSize: 11, background: "#2563EB", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700 }}>+ Tambah</button>
                    </div>
                    <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                      {Object.keys(vendorForm.tarifPotongan || {}).length === 0 && (
                        <div style={{ fontSize: 12, color: "#94A3B8" }}>Belum ada tarif khusus. Tarif default berlaku untuk semua kategori.</div>
                      )}
                      {Object.entries(vendorForm.tarifPotongan || {}).map(([katKey, harga]: any) => (
                        <div key={katKey} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <select style={{ flex: 1, padding: "8px", border: "1px solid #E2E8F0", borderRadius: 6, fontSize: 13 }}
                            value={kategoriList.some((k: any) => k.nama === katKey) ? katKey : ""}
                            onChange={e => {
                              const newTarif = { ...vendorForm.tarifPotongan };
                              const val = e.target.value;
                              if (val) { newTarif[val] = harga; delete newTarif[katKey]; }
                              setVendorForm(f => ({ ...f, tarifPotongan: newTarif }));
                            }}>
                            <option value="">-- Pilih Kategori --</option>
                            {kategoriList.map((k: any) => <option key={k.nama} value={k.nama}>{k.nama}</option>)}
                          </select>
                          <div style={{ display: "flex", border: "1px solid #E2E8F0", borderRadius: 6, overflow: "hidden", width: 130 }}>
                            <div style={{ padding: "7px 8px", background: "#F8FAFC", fontSize: 12, color: "#64748B", borderRight: "1px solid #E2E8F0" }}>Rp</div>
                            <input type="number" style={{ flex: 1, padding: "7px 8px", border: "none", outline: "none", fontSize: 13 }} value={harga || ""} onChange={e => { const n = { ...vendorForm.tarifPotongan }; n[katKey] = parseInt(e.target.value) || 0; setVendorForm(f => ({ ...f, tarifPotongan: n })); }} placeholder="0" />
                          </div>
                          <button type="button" onClick={() => { const n = { ...vendorForm.tarifPotongan }; delete n[katKey]; setVendorForm(f => ({ ...f, tarifPotongan: n })); }} style={{ width: 30, height: 30, background: "#FEF2F2", color: "#EF4444", border: "1px solid #FECACA", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={13} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 22, padding: "12px 14px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: "#0F172A", marginBottom: 8 }}>Proses Scan QR SPK</label>
                <div style={{ display: "flex", gap: 10 }}>
                  {[{ val: true, label: "Wajib Hitung" }, { val: false, label: "Langsung Saja" }].map(opt => (
                    <label key={String(opt.val)} style={{ flex: 1, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: vendorForm.wajib_hitung_ulang === opt.val ? "#EFF6FF" : "white", border: `1px solid ${vendorForm.wajib_hitung_ulang === opt.val ? "#2563EB" : "#E2E8F0"}`, borderRadius: 8 }}>
                      <input type="radio" checked={vendorForm.wajib_hitung_ulang === opt.val} onChange={() => setVendorForm(f => ({ ...f, wajib_hitung_ulang: opt.val }))} style={{ accentColor: "#2563EB" }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: vendorForm.wajib_hitung_ulang === opt.val ? "#1D4ED8" : "#64748B" }}>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" onClick={() => setShowVendorForm(false)} style={{ flex: 1, padding: "12px", background: "#F1F5F9", color: "#475569", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer" }}>Batal</button>
                <button type="submit" disabled={savingVendor} style={{ flex: 2, padding: "12px", background: "linear-gradient(135deg,#2563EB,#1D4ED8)", color: "white", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer", opacity: savingVendor ? 0.7 : 1 }}>
                  {savingVendor ? "Menyimpan..." : editVendorId ? "Simpan Perubahan" : "Tambah Vendor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== MODAL TIPE ===== */}
      {showTipeForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.7)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "white", borderRadius: 20, width: "100%", maxWidth: 500, boxShadow: "0 24px 60px rgba(0,0,0,0.25)" }}>
            <div style={{ padding: "20px 26px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: "#F5F3FF", display: "flex", alignItems: "center", justifyContent: "center" }}><Settings2 size={18} color="#6366F1" /></div>
                <h2 style={{ margin: 0, fontWeight: 800, fontSize: 17, color: "#0F172A" }}>{editTipeId ? "Edit Tipe Vendor" : "Tambah Tipe Vendor"}</h2>
              </div>
              <button onClick={() => setShowTipeForm(false)} style={{ background: "#F1F5F9", border: "none", width: 32, height: 32, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B" }}><X size={16} /></button>
            </div>
            <form onSubmit={handleSaveTipe} style={{ padding: 26 }}>
              <div style={{ display: "flex", gap: 14, marginBottom: 16 }}>
                <div style={{ width: 80 }}>
                  <label style={{ display: "block", fontWeight: 700, fontSize: 12, color: "#475569", marginBottom: 6 }}>Emoji</label>
                  <input className="form-control" value={tipeForm.emoji} onChange={e => setTipeForm(f => ({ ...f, emoji: e.target.value }))} style={{ textAlign: "center", fontSize: 22 }} maxLength={2} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontWeight: 700, fontSize: 12, color: "#475569", marginBottom: 6 }}>Nama Tipe *</label>
                  <input className="form-control" value={tipeForm.nama} onChange={e => setTipeForm(f => ({ ...f, nama: e.target.value }))} placeholder="Contoh: QC / Finishing" required />
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontWeight: 700, fontSize: 12, color: "#475569", marginBottom: 6 }}>Slug (Kode Unik) *</label>
                <input className="form-control" value={tipeForm.slug} onChange={e => setTipeForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, "_") }))} placeholder="Contoh: qc_finishing" required />
                <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>Huruf kecil, tanpa spasi. Digunakan sebagai ID internal.</div>
              </div>
              <div style={{ marginBottom: 14, padding: "14px", background: "#F8FAFC", borderRadius: 12, border: "1px solid #E2E8F0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13, color: "#0F172A", display: "flex", alignItems: "center", gap: 6 }}><Globe size={14} /> Perlu Portal Akses?</div>
                    <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>Vendor ini punya halaman portal tersendiri?</div>
                  </div>
                  <Toggle value={tipeForm.perlu_portal} onChange={() => setTipeForm(f => ({ ...f, perlu_portal: !f.perlu_portal }))} />
                </div>
                {tipeForm.perlu_portal && (
                  <div>
                    <label style={{ display: "block", fontWeight: 700, fontSize: 11, color: "#475569", marginBottom: 4 }}>Path Portal (tanpa /[id])</label>
                    <input className="form-control" value={tipeForm.portal_path} onChange={e => setTipeForm(f => ({ ...f, portal_path: e.target.value }))} placeholder="/washing" />
                  </div>
                )}
              </div>
              <div style={{ marginBottom: 24, padding: "14px", background: "#F8FAFC", borderRadius: 12, border: "1px solid #E2E8F0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13, color: "#0F172A", display: "flex", alignItems: "center", gap: 6 }}><Banknote size={14} /> Perlu Pencatatan Gaji?</div>
                    <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>Apakah perlu input upah/gaji per pcs?</div>
                  </div>
                  <Toggle value={tipeForm.perlu_gaji} onChange={() => setTipeForm(f => ({ ...f, perlu_gaji: !f.perlu_gaji }))} colorOn="#16A34A" />
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" onClick={() => setShowTipeForm(false)} style={{ flex: 1, padding: "12px", background: "#F1F5F9", color: "#475569", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer" }}>Batal</button>
                <button type="submit" disabled={savingTipe} style={{ flex: 2, padding: "12px", background: "linear-gradient(135deg,#6366F1,#4F46E5)", color: "white", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer", opacity: savingTipe ? 0.7 : 1 }}>
                  {savingTipe ? "Menyimpan..." : editTipeId ? "Simpan Perubahan" : "Tambah Tipe"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
