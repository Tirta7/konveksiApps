// @ts-nocheck
"use client";
import React, { useEffect, useState } from "react";
import { CheckCircle, Play, Package, User, Calendar, Scissors, Zap, Droplets, Filter, Star, ChevronRight, RefreshCw, TrendingUp, AlertTriangle, Clock } from "lucide-react";

const STAGE_ICON = {
  potong_kain: Scissors, jahit_kain: Zap, jahit: Zap, bersih_benang: Filter,
  wahing_pakaian: Droplets, washing: Droplets, finishing: Star, finishing_bahan: Star, gudang: Package,
};
const getIcon = (slug) => STAGE_ICON[slug] || Package;

const STATUS_STYLE = {
  Menunggu:  { bg: "#F1F5F9", border: "#CBD5E1", dot: "#94A3B8", text: "#64748B", label: "Menunggu" },
  Proses:    { bg: "#EFF6FF", border: "#BFDBFE", dot: "#3B82F6", text: "#1D4ED8", label: "Sedang Proses" },
  Selesai:   { bg: "#F0FDF4", border: "#BBF7D0", dot: "#10B981", text: "#059669", label: "Selesai" },
  Terlambat: { bg: "#FEF2F2", border: "#FECACA", dot: "#EF4444", text: "#DC2626", label: "Terlambat" },
};

export default function AlurProduksiPage() {
  const [stages, setStages] = useState([]);
  const [poPipelines, setPoPipelines] = useState([]);
  const [poProduksi, setPoProduksi] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [cmtProgres, setCmtProgres] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeStage, setActiveStage] = useState(null);

  const doSync = async () => {
    setSyncing(true);
    try { await fetch("/api/po-pipeline/sync", { method: "POST" }); } catch {}
    setSyncing(false);
  };

  const fetchAll = async () => {
    setLoading(true);
    await doSync();
    const [s, pp, po, v, cp, tf] = await Promise.all([
      fetch("/api/pipeline-stages?_t=" + Date.now()).then(r => r.json()),
      fetch("/api/po-pipeline?_t=" + Date.now()).then(r => r.json()),
      fetch("/api/po-produksi?_t=" + Date.now()).then(r => r.json()),
      fetch("/api/vendors?_t=" + Date.now()).then(r => r.json()),
      fetch("/api/cmt-progres?_t=" + Date.now()).then(r => r.json()),
      fetch("/api/produksi-transfer?_t=" + Date.now()).then(r => r.json()),
    ]);
    const sorted = Array.isArray(s) ? s.filter(x => x.aktif).sort((a, b) => a.urutan - b.urutan) : [];
    setStages(sorted);
    if (sorted.length > 0 && !activeStage) setActiveStage(sorted[0].id);
    setPoPipelines(Array.isArray(pp) ? pp : []);
    setPoProduksi(Array.isArray(po) ? po : []);
    setVendors(Array.isArray(v) ? v : []);
    setCmtProgres(Array.isArray(cp) ? cp : []);
    setTransfers(Array.isArray(tf) ? tf : []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const getPO = (id) => poProduksi.find(p => p.id === id);
  const getVendorName = (id) => vendors.find(v => v.id === id)?.nama || "—";

  // Get active distributions for a specific stage & po
  const getActiveDistributions = (poId, stageSlug) => {
    // CMT / Jahit tracking depends on cmtProgres + initial vendorId
    if (stageSlug === "jahit" || stageSlug === "jahit_kain") {
      const po = getPO(poId);
      if (!po) return [];
      const records = cmtProgres.filter(p => p.po_id === poId);
      const lapor = records.reduce((s, r) => s + (r.items || []).reduce((ss, i) => ss + Number(i.jumlah || 0), 0), 0);
      const acc = records.filter(p => p.status === "Diverifikasi" || p.status === "Diterima")
                         .reduce((s, r) => s + (r.items || []).reduce((ss, i) => ss + Number(i.jumlah || 0), 0), 0);
      return [{
         vendor_id: po.vendorId, 
         vendor_nama: getVendorName(po.vendorId),
         target_selesai: po.target_selesai,
         qty_total: po.jumlahTerbit,
         qty_lapor: lapor,
         qty_acc: acc,
         type: "jahit"
      }];
    }
    
    // Other stages: read from transfers
    const relevantTf = transfers.filter(t => t.po_id === poId && t.ke === stageSlug);
    // group by transfer ID to show each batch
    return relevantTf.map(t => ({
      vendor_id: t.vendor_id,
      vendor_nama: getVendorName(t.vendor_id),
      target_selesai: t.target_selesai,
      qty_total: t.jumlah_kirim,
      qty_lapor: t.jumlah_diterima || 0, // as an example
      qty_acc: t.status === "Diterima" ? t.jumlah_kirim : 0,
      type: "transfer",
      status: t.status
    }));
  };

  const getTertandon = (poId, stageObj) => {
    if (!stageObj) return 0;
    const po = getPO(poId);
    if (!po) return 0;
    
    if (stageObj.slug === "jahit" || stageObj.slug === "jahit_kain") {
       // Tertandon di potong kain (yg belum dijahit)
       return 0; // Potong kain langsung 100% jadi.
    }

    // Untuk tahap setelah jahit, tertandon = Total PO - yang sudah ditransfer ke tahap ini
    const accPrev = cmtProgres.filter(p => p.po_id === poId && (p.status === "Diverifikasi" || p.status === "Diterima"))
                              .reduce((s, r) => s + (r.items || []).reduce((ss, i) => ss + Number(i.jumlah || 0), 0), 0);
    const forwarded = transfers.filter(t => t.po_id === poId && t.ke === stageObj.slug).reduce((s, t) => s + Number(t.jumlah_kirim), 0);
    return Math.max(0, po.jumlahTerbit - forwarded);
  }

  const posForStage = (stageId) =>
    poPipelines
      .filter(pip => pip.stages?.find(s => s.stage_id === stageId && s.aktif))
      .map(pip => ({ ...pip, stageEntry: pip.stages.find(s => s.stage_id === stageId) }));

  const countFor = (stageId, status) =>
    posForStage(stageId).filter(p => (p.stageEntry?.status || "Menunggu") === status).length;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const isOverdue = (t) => t && new Date(t) < today;
  const overdueDays = (t) => {
    if (!t) return 0;
    const diff = today.getTime() - new Date(t).setHours(0,0,0,0);
    return Math.ceil(diff / (1000*60*60*24));
  };

  const activeStageObj = stages.find(s => s.id === activeStage);
  const activePoItems = activeStage ? posForStage(activeStage) : [];

  if (loading) return (
    <div style={{ background: "#F8FAFC", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
      <RefreshCw size={20} color="#94A3B8" style={{ animation: "spin 1s linear infinite" }} />
      <div style={{ color: "#94A3B8", fontSize: 15 }}>Sinkronisasi data pipeline...</div>
    </div>
  );

  const totalActivePO = poProduksi.filter(p => p.status !== "Selesai").length;

  return (
    <div style={{ background: "#F1F5F9", minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>

      {/* HEADER */}
      <div style={{ background: "white", borderBottom: "1px solid #E2E8F0", padding: "0 32px" }}>
        <div style={{ paddingTop: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: "#0F172A", margin: "0 0 2px" }}>Alur Produksi (Monitoring)</h1>
            <p style={{ color: "#94A3B8", margin: "0 0 4px", fontSize: 13 }}>
              Pantau real-time penyebaran barang di setiap tahap produksi &bull; {totalActivePO} PO berjalan
            </p>
          </div>
          <button onClick={fetchAll} disabled={syncing}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 10, border: "1.5px solid #E2E8F0", background: "white", color: "#64748B", fontWeight: 600, fontSize: 13, cursor: "pointer", marginBottom: 8 }}>
            <RefreshCw size={14} style={{ animation: syncing ? "spin 1s linear infinite" : "none" }} />
            {syncing ? "Sync..." : "Sync Ulang"}
          </button>
        </div>

        {/* PIPELINE FLOW TABS */}
        {stages.length === 0 ? (
          <div style={{ paddingBottom: 20, color: "#94A3B8", fontSize: 14 }}>Belum ada tahap.</div>
        ) : (
          <div style={{ display: "flex", alignItems: "stretch", overflowX: "auto", gap: 0 }}>
            {stages.map((stage, idx) => {
              const isActive = activeStage === stage.id;
              const Icon = getIcon(stage.slug);
              const total = posForStage(stage.id).length;
              const selesai = countFor(stage.id, "Selesai");
              const proses = countFor(stage.id, "Proses");
              const pct = total > 0 ? Math.round((selesai / total) * 100) : 0;
              const badgeColor = proses > 0 ? "#2563EB" : selesai === total && total > 0 ? "#10B981" : "#F59E0B";

              return (
                <React.Fragment key={stage.id}>
                  <button onClick={() => setActiveStage(stage.id)}
                    style={{ padding: "14px 24px 0", border: "none", background: "transparent", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, borderBottom: isActive ? `3px solid ${stage.warna}` : "3px solid transparent", minWidth: 130, flexShrink: 0, transition: "all 0.2s" }}>
                    <div style={{ width: 50, height: 50, borderRadius: 14, background: isActive ? stage.warna : "#F1F5F9", border: `2px solid ${isActive ? stage.warna : "#E2E8F0"}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: isActive ? `0 4px 14px ${stage.warna}35` : "none", transition: "all 0.2s", position: "relative" }}>
                      <Icon size={22} color={isActive ? "white" : stage.warna} />
                      {total > 0 && (
                        <div style={{ position: "absolute", top: -7, right: -7, background: badgeColor, color: "white", fontSize: 9, fontWeight: 900, width: 18, height: 18, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid white" }}>{total}</div>
                      )}
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: isActive ? "#0F172A" : "#64748B", whiteSpace: "nowrap" }}>{stage.nama}</div>
                    </div>
                    {total > 0 && (
                      <div style={{ width: "100%", height: 2, background: "#E2E8F0", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ width: pct + "%", height: "100%", background: stage.warna, transition: "width 0.5s" }} />
                      </div>
                    )}
                    <div style={{ height: 4 }} />
                  </button>
                  {idx < stages.length - 1 && (
                    <div style={{ display: "flex", alignItems: "center", paddingBottom: 12, flexShrink: 0 }}>
                      <ChevronRight size={16} color="#CBD5E1" />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      {/* STAGE CONTENT */}
      <div style={{ padding: "20px 32px" }}>
        {!activeStageObj ? null : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18, padding: "12px 18px", borderRadius: 14, background: "white", border: `1.5px solid ${activeStageObj.warna}25`, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: activeStageObj.warna + "15", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {React.createElement(getIcon(activeStageObj.slug), { size: 17, color: activeStageObj.warna })}
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 800, fontSize: 15, color: "#0F172A" }}>{activeStageObj.nama}</span>
                {activeStageObj.deskripsi && <span style={{ fontSize: 13, color: "#94A3B8", marginLeft: 10 }}>{activeStageObj.deskripsi}</span>}
              </div>
            </div>

            {activePoItems.length === 0 ? (
              <div style={{ textAlign: "center", padding: "56px 24px", background: "white", borderRadius: 16, border: "1.5px dashed #E2E8F0" }}>
                <p style={{ color: "#94A3B8", margin: 0, fontSize: 14, fontWeight: 600 }}>Tidak ada order di tahap {activeStageObj.nama}</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 14 }}>
                {activePoItems.map(({ po_id, stageEntry }) => {
                  const po = getPO(po_id);
                  if (!po) return null;
                  const rawStatus = stageEntry?.status || "Menunggu";
                  const sc = STATUS_STYLE[rawStatus] || STATUS_STYLE.Menunggu;
                  const dists = getActiveDistributions(po_id, activeStageObj.slug);
                  const tertandon = getTertandon(po_id, activeStageObj);

                  return (
                    <div key={po_id} style={{ background: "white", borderRadius: 16, border: "1px solid #E2E8F0", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", overflow: "hidden" }}>
                      <div style={{ height: 4, background: rawStatus === "Proses" ? activeStageObj.warna : rawStatus === "Selesai" ? "#10B981" : "#E2E8F0" }} />
                      <div style={{ padding: "16px 18px" }}>

                        {/* Header */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ fontWeight: 900, fontSize: 16, color: "#0F172A" }}>{po.noPo}</div>
                              <div style={{ fontSize: 10, color: "#94A3B8", background: "#F1F5F9", padding: "1px 7px", borderRadius: 6 }}>ID:{po.id}</div>
                            </div>
                            <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>{po.model} &bull; Total {po.jumlahTerbit} pcs</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 20, background: sc.bg, border: `1px solid ${sc.border}` }}>
                            <div style={{ width: 6, height: 6, borderRadius: "50%", background: sc.dot }} />
                            <span style={{ fontSize: 11, fontWeight: 700, color: sc.text }}>{sc.label}</span>
                          </div>
                        </div>

                        {/* Tertandon Warning */}
                        {tertandon > 0 && (
                          <div style={{ display:"flex", alignItems:"center", gap: 8, padding:"8px 12px", background:"#FEF2F2", borderRadius: 8, border:"1px solid #FECACA", marginBottom: 12 }}>
                            <AlertTriangle size={14} color="#DC2626" />
                            <span style={{ fontSize:12, color:"#991B1B", fontWeight:700 }}>{tertandon} pcs masih tertandon di tahap sebelumnya</span>
                          </div>
                        )}

                        {/* Distributions */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {dists.length === 0 ? (
                            <div style={{ fontSize: 12, color: "#94A3B8", textAlign:"center", padding: "10px", background:"#F8FAFC", borderRadius: 8 }}>Belum didistribusikan ke vendor</div>
                          ) : (
                            dists.map((d, i) => {
                              const overdue = isOverdue(d.target_selesai) && rawStatus !== "Selesai";
                              const days = overdueDays(d.target_selesai);
                              const pct = d.qty_total > 0 ? Math.round((d.qty_acc / d.qty_total) * 100) : 0;
                              return (
                                <div key={i} style={{ background: "#F8FAFC", border: overdue ? "1px solid #FECACA" : "1px solid #E2E8F0", borderRadius: 10, padding: 12 }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                      <User size={13} color="#64748B" />
                                      <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{d.vendor_nama}</span>
                                    </div>
                                    <div style={{ fontSize: 12, fontWeight: 800, color: activeStageObj.warna }}>{d.qty_total} pcs</div>
                                  </div>
                                  
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "#64748B" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 4, color: overdue ? "#DC2626" : "#64748B" }}>
                                      <Calendar size={12} />
                                      {d.target_selesai ? new Date(d.target_selesai).toLocaleDateString("id-ID", {day:"numeric", month:"short"}) : "Tanpa Dateline"}
                                      {overdue && <span style={{ fontWeight:800 }}>({days} hari telat)</span>}
                                    </div>
                                    <div style={{ fontWeight: 600 }}>{pct}% ACC</div>
                                  </div>

                                  {/* Progress bar */}
                                  <div style={{ height: 4, background: "#E2E8F0", borderRadius: 2, overflow: "hidden", marginTop: 8 }}>
                                    <div style={{ width: pct + "%", height: "100%", background: "#10B981" }} />
                                  </div>
                                </div>
                              )
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}