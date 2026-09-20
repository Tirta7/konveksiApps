"use client";
import React, { useEffect, useState } from "react";
import { Package, AlertCircle, CheckCircle2, Clock, ArrowRight, ExternalLink, Banknote, Layers } from "lucide-react";

function formatRp(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

const GROUP_META: Record<string, { label: string; emoji: string; color: string; accent: string; bg: string; border: string; gradFrom: string; gradTo: string }> = {
  cmt:       { label: "Vendor CMT / Penjahit",      emoji: "🧵", color: "#1D4ED8", accent: "#3B82F6", bg: "#EFF6FF", border: "#BFDBFE", gradFrom: "#1E3A5F", gradTo: "#2563EB" },
  washing:   { label: "Vendor Washing / Laundry",   emoji: "🫧", color: "#0E7490", accent: "#06B6D4", bg: "#ECFEFF", border: "#A5F3FC", gradFrom: "#0C3A47", gradTo: "#0891B2" },
  benang:    { label: "Vendor Bersih Benang",        emoji: "✂️", color: "#7C3AED", accent: "#8B5CF6", bg: "#F5F3FF", border: "#DDD6FE", gradFrom: "#2D1B69", gradTo: "#6D28D9" },
  finishing: { label: "Vendor Finishing / QC",      emoji: "✅", color: "#059669", accent: "#10B981", bg: "#ECFDF5", border: "#6EE7B7", gradFrom: "#064E3B", gradTo: "#059669" },
  lainnya:   { label: "Vendor Lainnya",              emoji: "📦", color: "#475569", accent: "#64748B", bg: "#F8FAFC", border: "#E2E8F0", gradFrom: "#1E293B", gradTo: "#475569" },
};

export default function DashboardCMTPage() {
  const [vendorLedgers, setVendorLedgers] = useState<any[]>([]);
  const [allVendors, setAllVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePo, setActivePo] = useState<any>(null);
  const [tarikForm, setTarikForm] = useState({ ke_vendor_id: "", catatan: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    try {
      const res = await fetch("/api/dashboard-ledger");
      const data = await res.json();
      setVendorLedgers(data.vendorLedgers || []);
      setAllVendors(data.allVendors || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = () => loadData();
    window.addEventListener("konveksi-sync", handler);
    return () => window.removeEventListener("konveksi-sync", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTarikBarang = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePo || !tarikForm.ke_vendor_id) return;
    const jumlahTarik = activePo.po.totalDisetujui || 0;
    if (jumlahTarik === 0) { alert("Belum ada laporan yang di-ACC admin."); return; }
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/tarik-barang", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poId: activePo.po.id, dari_vendor_id: activePo.dari_vendor_id, ke_vendor_id: tarikForm.ke_vendor_id, jumlah: jumlahTarik, sizeBreakdown: activePo.po.sizeProgress, catatan: tarikForm.catatan })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      alert(`Berhasil menarik ${jumlahTarik} pcs dari PO ${activePo.po.noPo}`);
      setActivePo(null); setTarikForm({ ke_vendor_id: "", catatan: "" }); loadData();
    } catch (err: any) { alert(err.message); }
    finally { setIsSubmitting(false); }
  };

  if (loading && vendorLedgers.length === 0) return <div style={{ padding: 40, textAlign: "center", color: "#64748B" }}>⏳ Memuat Ledger...</div>;

  const groups: Record<string, { meta: typeof GROUP_META["cmt"]; vendors: any[] }> = {};
  for (const key of ["cmt", "washing", "benang", "finishing", "lainnya"]) {
    groups[key] = { meta: GROUP_META[key], vendors: [] };
  }
  for (const v of vendorLedgers) {
    const tipe = v.tipe || "lainnya";
    const key = groups[tipe] ? tipe : "lainnya";
    groups[key].vendors.push(v);
  }

  return (
    <>
      <style>{`
        .dcmt-wrap { padding: 28px 32px; background: #F1F5F9; height: 100%; overflow-y: auto; }
        .dcmt-section { margin-bottom: 40px; }
        .dcmt-section-hdr { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; }
        .dcmt-section-pill { display: flex; align-items: center; gap: 10px; padding: 10px 18px; border-radius: 12px; }
        .dcmt-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 20px; }

        /* Vendor Card */
        .vc { border-radius: 18px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); transition: transform 0.2s, box-shadow 0.2s; border: 1px solid #E2E8F0; background: white; }
        .vc:hover { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(0,0,0,0.1); }

        /* Card top banner */
        .vc-banner { padding: 18px 20px 14px; position: relative; overflow: hidden; }
        .vc-banner::before { content: ''; position: absolute; top: -40%; right: -15%; width: 180px; height: 180px; border-radius: 50%; background: rgba(255,255,255,0.08); }
        .vc-banner::after { content: ''; position: absolute; bottom: -50%; left: -5%; width: 140px; height: 140px; border-radius: 50%; background: rgba(255,255,255,0.05); }
        .vc-banner-row { display: flex; justify-content: space-between; align-items: flex-start; position: relative; z-index: 1; }
        .vc-name { font-size: 17px; font-weight: 900; color: white; }
        .vc-sub { font-size: 11px; color: rgba(255,255,255,0.65); margin-top: 2px; font-weight: 600; }
        .vc-pcs-box { text-align: right; }
        .vc-pcs-label { font-size: 9px; color: rgba(255,255,255,0.55); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
        .vc-pcs-val { font-size: 26px; font-weight: 900; color: white; line-height: 1; }
        .vc-pcs-unit { font-size: 11px; color: rgba(255,255,255,0.55); margin-left: 2px; }
        .vc-stats-row { display: flex; gap: 0; margin-top: 16px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.12); position: relative; z-index: 1; }
        .vc-stat { flex: 1; }
        .vc-stat + .vc-stat { padding-left: 14px; border-left: 1px solid rgba(255,255,255,0.12); }
        .vc-stat-label { font-size: 9px; color: rgba(255,255,255,0.5); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
        .vc-stat-val { font-size: 14px; font-weight: 800; color: white; margin-top: 2px; }

        /* Card body */
        .vc-body { padding: 16px 20px 18px; }
        .vc-body-title { font-size: 10px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }

        /* PO Item */
        .po-item { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 12px 14px; margin-bottom: 8px; transition: border-color 0.15s; }
        .po-item:last-child { margin-bottom: 0; }
        .po-item.has-saldo { border-color: #BFDBFE; background: #F0F7FF; }
        .po-item-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
        .po-item-left {}
        .po-item-no { display: inline-flex; align-items: center; gap: 4px; background: #E2E8F0; color: #334155; font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 5px; font-family: monospace; margin-bottom: 4px; }
        .po-item-model { font-size: 13px; font-weight: 700; color: #0F172A; }
        .po-item-target { font-size: 11px; color: #64748B; margin-top: 2px; }
        .po-item-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
        .po-saldo-badge { background: #2563EB; color: white; font-size: 11px; font-weight: 800; padding: "3px 8px"; border-radius: 6px; white-space: nowrap; padding: 3px 9px; }
        .po-saldo-badge.zero { background: #F0FDF4; color: #16A34A; border: 1px solid #86EFAC; }

        /* Progress bar */
        .po-bar-wrap { margin: 8px 0; }
        .po-bar-track { height: 6px; border-radius: 3px; background: #E2E8F0; position: relative; overflow: hidden; }
        .po-bar-ok { position: absolute; left: 0; top: 0; height: 100%; background: #10B981; border-radius: 3px; transition: width 0.4s; }
        .po-bar-pend { position: absolute; top: 0; height: 100%; background: #F59E0B; border-radius: 3px; transition: width 0.4s; }
        .po-bar-labels { display: flex; gap: 10px; margin-top: 5px; font-size: 10px; }

        /* Size chips */
        .po-sizes { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 6px; }
        .po-size-chip { font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 5px; border: 1px solid; }

        /* Action row */
        .po-actions { display: flex; gap: 8px; margin-top: 10px; }

        /* Portal link */
        .vc-portal { display: flex; align-items: center; gap: 6px; margin-top: 12px; padding: 8px 12px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; font-size: 12px; font-weight: 700; text-decoration: none; color: #475569; transition: all 0.15s; }
        .vc-portal:hover { background: #EFF6FF; color: #2563EB; border-color: #BFDBFE; }

        /* Empty state for PO */
        .vc-empty { text-align: center; padding: 20px 0 8px; color: #94A3B8; font-size: 13px; }

        @media (max-width: 900px) { .dcmt-grid { grid-template-columns: 1fr; } .dcmt-wrap { padding: 16px; } }
        @media (max-width: 600px) { .vc-stats-row { flex-direction: column; gap: 10px; } .vc-stat + .vc-stat { padding-left: 0; border-left: none; border-top: 1px solid rgba(255,255,255,0.12); padding-top: 8px; } }
      `}</style>

      {/* Tarik Modal */}
      {activePo && (() => {
        const sp = activePo.po.sizeProgress || {};
        const sizeKeys = Object.keys(sp).filter(k => sp[k] > 0);
        const jumlahTarik = activePo.po.totalDisetujui || 0;
        return (
          <div className="modal-overlay" onClick={() => setActivePo(null)}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>
              <h2 className="modal-title" style={{ marginBottom: 4 }}>Tarik Barang: {activePo.po.noPo}</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "var(--font-size-sm)", marginBottom: 16 }}>
                Dari Vendor: <strong>{activePo.vendor_nama}</strong> &nbsp;·&nbsp; Model: <strong>{activePo.po.model}</strong>
              </p>
              <div style={{ background: "#F0FDF4", border: "1px solid #10B981", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#065F46", marginBottom: 8 }}>✓ Hasil ACC Admin — Siap Ditarik</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                  {sizeKeys.length > 0 ? sizeKeys.map(size => (
                    <span key={size} style={{ background: "#DCFCE7", color: "#065F46", fontSize: 12, fontWeight: 800, padding: "4px 12px", borderRadius: 8, border: "1px solid #10B981" }}>
                      {size}: {sp[size]} pcs
                    </span>
                  )) : <span style={{ color: "#94A3B8", fontSize: 12 }}>Belum ada laporan yang di-ACC</span>}
                </div>
                <div style={{ fontSize: 13, fontWeight: 900, color: "#065F46" }}>Total: {jumlahTarik} pcs</div>
              </div>
              {jumlahTarik === 0 ? (
                <div style={{ background: "#FEF3C7", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#92400E", marginBottom: 16 }}>
                  ⚠️ Belum ada laporan yang di-ACC admin untuk PO ini.
                </div>
              ) : (
                <form onSubmit={handleTarikBarang}>
                  <div className="form-group">
                    <label className="form-label">Tujuan (Vendor Lanjutan / Gudang)</label>
                    <select required className="form-control" value={tarikForm.ke_vendor_id} onChange={e => setTarikForm({ ...tarikForm, ke_vendor_id: e.target.value })}>
                      <option value="">-- Pilih Tujuan --</option>
                      <option value="GUDANG" style={{ fontWeight: "bold" }}>📦 MASUK GUDANG PRODUKSI (SELESAI)</option>
                      {allVendors.filter(v => String(v.id) !== String(activePo.dari_vendor_id)).map((v: any) => (
                        <option key={v.id} value={v.id}>{v.nama} ({v.jenis_pekerjaan || "Lainnya"})</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Catatan</label>
                    <input type="text" className="form-control" placeholder="Opsional" value={tarikForm.catatan} onChange={e => setTarikForm({ ...tarikForm, catatan: e.target.value })} />
                  </div>
                  <div className="modal-footer">
                    <button type="button" onClick={() => setActivePo(null)} className="btn btn-secondary">Batal</button>
                    <button type="submit" disabled={isSubmitting} className="btn btn-primary">
                      {isSubmitting ? "Menyimpan..." : `Tarik ${jumlahTarik} pcs`}
                    </button>
                  </div>
                </form>
              )}
              {jumlahTarik === 0 && (
                <div className="modal-footer" style={{ marginTop: 0 }}>
                  <button type="button" onClick={() => setActivePo(null)} className="btn btn-secondary">Tutup</button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      <div className="dcmt-wrap">
        <div className="page-header">
          <h1 className="page-title">Dashboard Ledger Produksi</h1>
          <p className="page-subtitle">Pantau saldo barang, progres CMT, dan alur produksi real-time di setiap vendor.</p>
        </div>

        {["cmt", "washing", "benang", "finishing", "lainnya"].map(key => {
          const { meta, vendors } = groups[key];
          if (vendors.length === 0) return null;
          const totalPcsGroup = vendors.reduce((s, v) => s + (v.totalSisa || 0), 0);
          const totalPoGroup = vendors.reduce((s, v) => s + v.poList.length, 0);

          return (
            <div key={key} className="dcmt-section">
              <div className="dcmt-section-hdr">
                <div className="dcmt-section-pill" style={{ background: meta.bg, border: `1.5px solid ${meta.border}` }}>
                  <span style={{ fontSize: 22 }}>{meta.emoji}</span>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 15, color: meta.color }}>{meta.label}</div>
                    <div style={{ fontSize: 11, color: "#64748B" }}>
                      {vendors.length} vendor · {totalPcsGroup} pcs di tangan · {totalPoGroup} PO aktif
                    </div>
                  </div>
                </div>
                <div style={{ flex: 1, height: 1.5, background: `linear-gradient(to right, ${meta.border}, transparent)` }} />
              </div>

              <div className="dcmt-grid">
                {vendors.map((v: any) => {
                  const gradient = `linear-gradient(135deg, ${meta.gradFrom} 0%, ${meta.gradTo} 100%)`;
                  const totalPO = v.poList.length;
                  const totalDisetujuiAll = v.poList.reduce((s: number, p: any) => s + (p.totalDisetujui || 0), 0);
                  const totalPendingAll = v.poList.reduce((s: number, p: any) => s + (p.totalPending || 0), 0);
                  const gajiInfo = v.hargaPerPcs > 0 ? formatRp(v.hargaPerPcs) + "/pcs" : null;
                  const tarifKhusus = v.tarifPotongan ? Object.keys(v.tarifPotongan).length : 0;
                  const portalHref = v.tipe === "cmt" ? `/cmt/${v.id}` : v.tipe === "washing" ? `/washing/${v.id}` : v.tipe === "benang" ? `/bersih-benang/${v.id}` : v.tipe === "finishing" ? `/finishing/${v.id}` : null;

                  return (
                    <div key={v.id} className="vc">
                      {/* Banner Gradient */}
                      <div className="vc-banner" style={{ background: gradient }}>
                        <div className="vc-banner-row">
                          <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                            <div className="vc-name">{v.nama}</div>
                            <div className="vc-sub">{v.jenis_default || v.tipe || "Vendor"} · {v.kodeVendor}</div>
                          </div>
                          <div className="vc-pcs-box">
                            <div className="vc-pcs-label">Fisik di Tangan</div>
                            <div className="vc-pcs-val">
                              {v.totalSisa}<span className="vc-pcs-unit">pcs</span>
                            </div>
                          </div>
                        </div>

                        {/* Stats Row */}
                        <div className="vc-stats-row">
                          <div className="vc-stat">
                            <div className="vc-stat-label">PO Aktif</div>
                            <div className="vc-stat-val">{totalPO} PO</div>
                          </div>
                          <div className="vc-stat">
                            <div className="vc-stat-label">✓ Di-ACC</div>
                            <div className="vc-stat-val">{totalDisetujuiAll} pcs</div>
                          </div>
                          <div className="vc-stat">
                            <div className="vc-stat-label">⏳ Pending</div>
                            <div className="vc-stat-val">{totalPendingAll} pcs</div>
                          </div>
                          {gajiInfo && (
                            <div className="vc-stat">
                              <div className="vc-stat-label">Tarif</div>
                              <div className="vc-stat-val" style={{ fontSize: 12 }}>{gajiInfo}</div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Badges info */}
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "10px 16px", borderBottom: "1px solid #F1F5F9" }}>
                        <span style={{ background: v.wajib_hitung_ulang ? "#FEF2F2" : "#F0FDF4", color: v.wajib_hitung_ulang ? "#DC2626" : "#16A34A", padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 700, border: `1px solid ${v.wajib_hitung_ulang ? "#FECACA" : "#BBF7D0"}` }}>
                          {v.wajib_hitung_ulang ? "Wajib Hitung" : "Cepat Bypass"}
                        </span>
                        {tarifKhusus > 0 && (
                          <span style={{ background: "#FFF7ED", color: "#C2410C", padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 700, border: "1px solid #FDBA74" }}>
                            +{tarifKhusus} Tarif Khusus
                          </span>
                        )}
                        {v.kontak && (
                          <a href={`https://wa.me/62${v.kontak.replace(/^0/, "")}`} target="_blank" rel="noreferrer"
                            style={{ background: "#F0FDF4", color: "#16A34A", padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 700, border: "1px solid #86EFAC", textDecoration: "none" }}>
                            💬 WA
                          </a>
                        )}
                        {portalHref && (
                          <a href={portalHref} target="_blank" rel="noreferrer"
                            style={{ background: "#EFF6FF", color: "#2563EB", padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 700, border: "1px solid #93C5FD", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
                            <ExternalLink size={10} /> Portal
                          </a>
                        )}
                      </div>

                      {/* PO List */}
                      <div className="vc-body">
                        <div className="vc-body-title">
                          <Layers size={12} color="#94A3B8" /> Rincian PO Aktif
                          {totalPO === 0 && <span style={{ color: "#CBD5E1" }}>— tidak ada</span>}
                        </div>

                        {v.poList.length === 0 ? (
                          <div className="vc-empty">
                            <Package size={28} color="#E2E8F0" style={{ margin: "0 auto 6px" }} />
                            <div>Tidak ada PO aktif di vendor ini</div>
                          </div>
                        ) : (
                          v.poList.map((po: any) => {
                            const pctOk = po.pctDisetujui || 0;
                            const pctPend = Math.max(0, Math.min((po.pctDilaporkan || 0) - pctOk, 100 - pctOk));
                            const sisaJahit = Math.max(0, po.jumlahTerbit - (po.totalDisetujui || 0));

                            return (
                              <div key={po.id} className={`po-item${po.saldo_di_vendor > 0 ? " has-saldo" : ""}`}>
                                {/* PO Header */}
                                <div className="po-item-top">
                                  <div>
                                    <div className="po-item-no">
                                      <Package size={9} /> {po.noPo}
                                    </div>
                                    <div className="po-item-model">{po.model}</div>
                                    <div className="po-item-target">
                                      Target {po.jumlahTerbit} pcs · Sisa {sisaJahit} pcs · Fisik {po.saldo_di_vendor} pcs
                                    </div>
                                  </div>
                                  <div className="po-item-right">
                                    <div className={`po-saldo-badge${po.saldo_di_vendor === 0 ? " zero" : ""}`}>
                                      {po.saldo_di_vendor === 0 ? "✓ Kosong" : `${po.saldo_di_vendor} pcs`}
                                    </div>
                                  </div>
                                </div>

                                {/* Progress bar */}
                                {(pctOk > 0 || pctPend > 0) && (
                                  <div className="po-bar-wrap">
                                    <div className="po-bar-track">
                                      <div className="po-bar-ok" style={{ width: `${Math.min(pctOk, 100)}%` }} />
                                      <div className="po-bar-pend" style={{ left: `${pctOk}%`, width: `${pctPend}%` }} />
                                    </div>
                                    <div className="po-bar-labels">
                                      {(po.totalDisetujui || 0) > 0 && <span style={{ color: "#10B981", fontWeight: 700 }}><CheckCircle2 size={9} style={{ display: "inline", marginRight: 2 }} />{po.totalDisetujui} ACC</span>}
                                      {(po.totalPending || 0) > 0 && <span style={{ color: "#F59E0B", fontWeight: 700 }}><Clock size={9} style={{ display: "inline", marginRight: 2 }} />{po.totalPending} pending</span>}
                                      {sisaJahit > 0 && <span style={{ color: "#94A3B8" }}>{sisaJahit} belum</span>}
                                      <span style={{ color: "#CBD5E1", marginLeft: "auto" }}>{pctOk}% selesai</span>
                                    </div>
                                  </div>
                                )}

                                {/* Size chips */}
                                {po.sizeBreakdown?.length > 0 && (
                                  <div className="po-sizes">
                                    {po.sizeBreakdown.map((s: any) => {
                                      const done = po.sizeProgress?.[s.size] || 0;
                                      const pend = po.sizePending?.[s.size] || 0;
                                      const isDone = done >= s.jumlah;
                                      const hasProgress = done > 0;
                                      return (
                                        <span key={s.size} className="po-size-chip" style={{
                                          background: isDone ? "#DCFCE7" : hasProgress ? "#EFF6FF" : "#F1F5F9",
                                          color: isDone ? "#065F46" : hasProgress ? "#1D4ED8" : "#94A3B8",
                                          borderColor: isDone ? "#86EFAC" : hasProgress ? "#93C5FD" : "#E2E8F0"
                                        }}>
                                          {s.size}: {done}{pend > 0 ? <span style={{ color: "#F59E0B" }}>+{pend}</span> : ""}/{s.jumlah}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}

                                {/* Action: Tarik */}
                                {po.saldo_di_vendor > 0 && (
                                  <div className="po-actions">
                                    <button
                                      onClick={() => setActivePo({ po, dari_vendor_id: v.id, vendor_nama: v.nama })}
                                      style={{ flex: 1, padding: "8px 12px", background: "#2563EB", color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                                    >
                                      <ArrowRight size={13} /> Tarik {po.totalDisetujui > 0 ? po.totalDisetujui : "Barang"} pcs
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
