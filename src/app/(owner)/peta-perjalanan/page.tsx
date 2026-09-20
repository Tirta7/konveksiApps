"use client";
import { useEffect, useState, useCallback } from "react";

function fmtDate(str?: string) {

  if (!str) return "-";
  return new Date(str).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
}
function fmtDT(str?: string) {
  if (!str) return "-";
  const d = new Date(str);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) +
    " " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}
function fmtWaktu(d: Date) {
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// Flaticon uicon helper
function FI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <i className={`fi fi-rr-${name}`} style={{ fontSize: size, color, lineHeight: 1, display: "inline-block", verticalAlign: "middle" }} />;
}
function FIS({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <i className={`fi fi-sr-${name}`} style={{ fontSize: size, color, lineHeight: 1, display: "inline-block", verticalAlign: "middle" }} />;
}

const STAGE_CONFIG: Record<string, { label: string; color: string; bg: string; fiIcon: string }> = {
  cmt:       { label: "Penjahitan (CMT)",   color: "#8B5CF6", bg: "#F5F3FF", fiIcon: "needle" },
  washing:   { label: "Washing / Laundry",  color: "#06B6D4", bg: "#ECFEFF", fiIcon: "water" },
  benang:    { label: "Bersih Benang",      color: "#F59E0B", bg: "#FFFBEB", fiIcon: "scissors" },
  finishing: { label: "QC / Finishing",     color: "#10B981", bg: "#ECFDF5", fiIcon: "badge-check" },
  gudang:    { label: "Gudang Produksi",    color: "#3B82F6", bg: "#EFF6FF", fiIcon: "box-open" },
  sistem:    { label: "Pemotongan (Sistem)",color: "#64748B", bg: "#F8FAFC", fiIcon: "tool-box" },
};

export default function PetaPerjalananPage() {
  const [poList, setPoList] = useState<any[]>([]);
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [pulse, setPulse] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const loadList = useCallback(async () => {
    try {
      const res = await fetch("/api/po-detail?_t=" + Date.now());
      const data = await res.json();
      setPoList(Array.isArray(data) ? data : []);
      setPulse(true); setTimeout(() => setPulse(false), 600);
    } catch {}
    finally { setLastUpdated(new Date()); setLoading(false); }
  }, []);

  const loadDetail = useCallback(async (poId: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/po-detail?poId=${poId}&_t=` + Date.now());
      const data = await res.json();
      setDetail(data);
    } catch {}
    finally { setDetailLoading(false); }
  }, []);

  useEffect(() => { loadList(); const t = setInterval(loadList, 10000); return () => clearInterval(t); }, [loadList]);
  useEffect(() => { if (selectedPoId) loadDetail(selectedPoId); }, [selectedPoId, loadDetail]);
  useEffect(() => {
    const el = document.querySelector(".app-content") as HTMLElement;
    if (el) { el.style.overflow = "hidden"; el.style.padding = "0"; el.style.height = "100vh"; }
    return () => { if (el) { el.style.overflow = ""; el.style.padding = ""; el.style.height = ""; } };
  }, []);

  const filteredPo = poList.filter(po => {
    if (filterStatus === "selesai") return po.stats?.totalDiGudang >= po.jumlahTerbit;
    if (filterStatus === "proses") return po.stats?.totalDiGudang < po.jumlahTerbit;
    return true;
  });

  const getStageLabel = (po: any) => {
    if (!po.stats) return "";
    if (po.stats.totalDiGudang >= po.jumlahTerbit) return "Selesai";
    if (po.stats.totalWashing > 0 && po.stats.totalWashingDone < po.stats.totalWashing) return "Washing";
    if (po.stats.totalWashingDone > 0) return "Selesai Washing";
    if (po.stats.totalDisetujui > 0) return "Siap Tarik";
    if (po.stats.totalDilaporkan > 0) return "Dijahit";
    return "Menunggu";
  };

  const getStageColor = (po: any) => {
    const s = getStageLabel(po);
    if (s === "Selesai") return { bg: "#D1FAE5", color: "#065F46" };
    if (s === "Washing" || s === "Selesai Washing") return { bg: "#CFFAFE", color: "#0E7490" };
    if (s === "Siap Tarik") return { bg: "#DCFCE7", color: "#166534" };
    if (s === "Dijahit") return { bg: "#FEF3C7", color: "#92400E" };
    return { bg: "#F1F5F9", color: "#64748B" };
  };

  // Real-time sync: auto-refresh when another admin makes a change
  useEffect(() => {
    const handler = () => loadList();
    window.addEventListener("konveksi-sync", handler);
    return () => window.removeEventListener("konveksi-sync", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      <style>{`
        @keyframes pulse2{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.7;transform:scale(0.9)}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:99px}
        .po-card-btn:hover{background:#F0F7FF!important;border-color:#BFDBFE!important;}
        .tl-card{transition:box-shadow 0.2s,transform 0.2s;}
        .tl-card:hover{box-shadow:0 8px 20px rgba(0,0,0,0.08)!important;transform:translateY(-1px);}
      `}</style>

      <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#F1F5F9" }}>

        {/*  LEFT PANEL  */}
        <div className={`pp-left-panel ${selectedPoId ? "hide-on-mobile" : ""}`} style={{ width: 300, flexShrink: 0, display: "flex", flexDirection: "column", background: "white", borderRight: "1px solid #E2E8F0" }}>
          {/* Header */}
          <div style={{ padding: "18px 16px 12px", borderBottom: "1px solid #E2E8F0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 3 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <FIS name="map-marker" size={16} color="#3B82F6" />
              </div>
              <span style={{ fontWeight: 900, fontSize: 15, color: "#0F172A" }}>Peta Perjalanan Kain</span>
            </div>
            <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 10 }}>Riwayat lengkap tiap PO dari kain hingga gudang</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5, background: "#D1FAE5", color: "#065F46", fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 20 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981", display: "inline-block", animation: "pulse2 2s infinite" }} /> LIVE
              </span>
              <button onClick={loadList} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#94A3B8" }}>
                <FI name="refresh" size={11} color={pulse ? "#3B82F6" : "#94A3B8"} />
                {lastUpdated ? fmtWaktu(lastUpdated) : "--:--:--"}
              </button>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {[["all","Semua"],["proses","Proses"],["selesai","Selesai"]].map(([v,l]) => (
                <button key={v} onClick={() => setFilterStatus(v)} style={{ flex: 1, padding: "5px 4px", fontSize: 11, fontWeight: 700, borderRadius: 8, border: "none", cursor: "pointer", background: filterStatus === v ? "#3B82F6" : "#F1F5F9", color: filterStatus === v ? "white" : "#64748B", transition: "all 0.15s" }}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* PO List */}
          <div style={{ flex: 1, overflowY: "auto", padding: "10px" }}>
            {loading && poList.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#94A3B8", fontSize: 13 }}>Memuat data...</div>
            ) : filteredPo.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#94A3B8", fontSize: 13 }}>Tidak ada PO</div>
            ) : filteredPo.map((po) => {
              const isSel = selectedPoId === String(po.id);
              const stageLabel = getStageLabel(po);
              const stageColor = getStageColor(po);
              const pctGudang = po.stats?.pctGudang || 0;
              const pctCMT = po.stats?.pctCMT || 0;
              return (
                <button key={po.id} className="po-card-btn" onClick={() => setSelectedPoId(String(po.id))} style={{
                  width: "100%", textAlign: "left", marginBottom: 6, padding: "12px 12px",
                  borderRadius: 12, border: `2px solid ${isSel ? "#3B82F6" : "transparent"}`,
                  background: isSel ? "#EFF6FF" : "#F8FAFC", cursor: "pointer", transition: "all 0.15s"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontWeight: 900, fontSize: 13, color: "#0F172A", fontFamily: "monospace" }}>{po.noPo}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: stageColor.bg, color: stageColor.color }}>{stageLabel}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#64748B", marginBottom: 5, fontWeight: 600 }}>{po.model} · {po.jumlahTerbit} pcs</div>
                  {po.pemotongan && (
                    <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                      <FI name="notebook" size={11} color="#94A3B8" />
                      {po.pemotongan.nama_barang}
                      <FI name="scissors" size={11} color="#94A3B8" />
                      {po.pemotongan.tukang?.nama || ""}
                    </div>
                  )}
                  <div style={{ width: "100%", background: "#E2E8F0", height: 4, borderRadius: 3, overflow: "hidden", position: "relative" }}>
                    <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${Math.min(pctGudang, 100)}%`, background: "#10B981", borderRadius: 3 }} />
                    <div style={{ position: "absolute", left: `${pctGudang}%`, top: 0, height: "100%", width: `${Math.min(pctCMT - pctGudang, 100)}%`, background: "#F59E0B", borderRadius: 3 }} />
                  </div>
                  <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 3, textAlign: "right" }}>{pctGudang}% gudang · {pctCMT}% dijahit</div>
                </button>
              );
            })}
          </div>
        </div>

        {/*  RIGHT PANEL  */}
        <div className={`pp-right-panel ${!selectedPoId ? "hide-on-mobile" : ""}`} style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {selectedPoId && (
            <div className="pp-back-btn" style={{ padding: "12px 20px", background: "white", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center" }}>
              <button onClick={() => setSelectedPoId(null)} style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: "#3B82F6", cursor: "pointer" }}>
                <i className="fi fi-rr-arrow-left" /> Kembali ke Daftar
              </button>
            </div>
          )}
          {!selectedPoId ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "#94A3B8" }}>
              <div style={{ width: 80, height: 80, borderRadius: 24, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <FI name="map-marker" size={36} color="#CBD5E1" />
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#64748B" }}>Pilih PO di panel kiri</div>
              <div style={{ fontSize: 13 }}>Untuk melihat riwayat perjalanan kain lengkap</div>
            </div>
          ) : detailLoading ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", fontSize: 15, gap: 10 }}>
              <FI name="spinner" size={20} color="#3B82F6" /> Memuat detail...
            </div>
          ) : !detail ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#EF4444", fontSize: 14 }}>Gagal memuat detail PO</div>
          ) : (
            <div style={{ flex: 1, overflowY: "auto" }}>

              {/*  HEADER SNAPSHOT  */}
              <div style={{ background: "white", borderBottom: "1px solid #E2E8F0", padding: "20px 28px" }}>
                <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
                  {/* Donut progress */}
                  <div style={{ position: "relative", width: 84, height: 84, flexShrink: 0 }}>
                    <svg style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
                      <circle cx="42" cy="42" r="36" stroke="#E2E8F0" strokeWidth="7" fill="transparent" />
                      <circle cx="42" cy="42" r="36" stroke="#10B981" strokeWidth="7" fill="transparent"
                        strokeDasharray={2 * Math.PI * 36}
                        strokeDashoffset={(2 * Math.PI * 36) * (1 - (detail.stats.totalDiGudang / detail.jumlahTerbit))}
                        strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.8s ease" }} />
                    </svg>
                    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontWeight: 900, fontSize: 16, color: "#0F172A", lineHeight: 1 }}>{detail.stats.pctGudang}%</span>
                      <span style={{ fontSize: 9, color: "#94A3B8", fontWeight: 600 }}>gudang</span>
                    </div>
                  </div>

                  {/* PO Info */}
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 3 }}>
                      <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#0F172A", fontFamily: "monospace" }}>{detail.noPo}</h2>
                      {detail.stats.totalDiGudang >= detail.jumlahTerbit && (
                        <span style={{ background: "#D1FAE5", color: "#065F46", fontWeight: 800, fontSize: 11, padding: "3px 10px", borderRadius: 20, display: "flex", alignItems: "center", gap: 4 }}>
                          <FIS name="badge-check" size={12} color="#065F46" /> SELESAI
                        </span>
                      )}
                    </div>
                    <div style={{ color: "#64748B", fontWeight: 600, fontSize: 12, marginBottom: 10 }}>
                      {detail.model} · Terbit: {fmtDT(detail.tanggalTerbit)} · {detail.jumlahTerbit} pcs
                    </div>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {(detail.sizeBreakdown || []).map((s: any) => (
                        <span key={s.size} style={{ background: "#EFF6FF", color: "#1D4ED8", fontWeight: 700, fontSize: 11, padding: "3px 8px", borderRadius: 7, border: "1px solid #BFDBFE" }}>
                          {s.size}: {s.jumlah}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, minWidth: 340 }}>
                    {[
                      { icon: "needle", bg: "#FEF3C7", border: "#F59E0B", color: "#92400E", label: "Dijahit (CMT)", val: `${detail.stats.totalDilaporkan} pcs (${detail.stats.pctCMT}%)` },
                      { icon: "badge-check", bg: "#DCFCE7", border: "#10B981", color: "#166534", label: "Di-ACC Admin", val: `${detail.stats.totalDisetujui} pcs (${detail.stats.pctDisetujui}%)` },
                      ...(detail.stats.totalWashing > 0 ? [{ icon: "water", bg: "#CFFAFE", border: "#06B6D4", color: "#0E7490", label: "Washing", val: `${detail.stats.totalWashingDone}/${detail.stats.totalWashing} pcs` }] : []),
                      { icon: "box-open", bg: "#EFF6FF", border: "#3B82F6", color: "#1D4ED8", label: "Di Gudang", val: `${detail.stats.totalDiGudang} pcs (${detail.stats.pctGudang}%)` },
                    ].map((item, i) => (
                      <div key={i} style={{ background: item.bg, border: `1px solid ${item.border}`, borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                        <FIS name={item.icon} size={14} color={item.color} />
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: item.color }}>{item.label}</div>
                          <div style={{ fontSize: 12, fontWeight: 900, color: item.color }}>{item.val}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/*  ASAL USUL KAIN  */}
              {detail.pemotongan && (
                <div style={{ margin: "20px 28px 0", background: "white", borderRadius: 16, border: "1px solid #E2E8F0", overflow: "hidden" }}>
                  <div style={{ background: "#0F172A", padding: "12px 20px", display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: "#1E293B", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <FIS name="tool-box" size={14} color="#F59E0B" />
                    </div>
                    <span style={{ fontWeight: 800, fontSize: 13, color: "white" }}>Asal Usul Bahan  Pemotongan Kain</span>
                    <span style={{ marginLeft: "auto", background: "#1E293B", color: "#64748B", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 8 }}>
                      ID #{detail.pemotongan.id}
                    </span>
                  </div>
                  <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
                    {[
                      { icon: "notebook", iconColor: "#3B82F6", label: "Kode Kain", value: detail.pemotongan.nama_barang, sub: [detail.pemotongan.kain?.jenis, detail.pemotongan.kain?.warna].filter(Boolean).join(" · ") || null },
                      { icon: "calendar", iconColor: "#10B981", label: "Dipotong Tanggal", value: fmtDate(detail.pemotongan.tanggal), sub: `Input: ${fmtDT(detail.pemotongan.createdAt)}` },
                      { icon: "scissors", iconColor: "#8B5CF6", label: "Tukang Potong", value: detail.pemotongan.tukang?.nama || "", sub: detail.pemotongan.tukang ? `Kode: ${detail.pemotongan.tukang.kode} · ${detail.pemotongan.tukang.kontak}` : null },
                      { icon: "ruler-combined", iconColor: "#F59E0B", label: "Kain Terpakai", value: `${detail.pemotongan.meter_kain} meter`, sub: `${detail.pemotongan.pemakaian_cm} cm/pcs · Total: ${detail.pemotongan.total_pcs} pcs` },
                      { icon: "user", iconColor: "#06B6D4", label: "Vendor CMT", value: detail.vendorCMT?.nama || "", sub: detail.vendorCMT?.jenis_pekerjaan || detail.vendorCMT?.tipe || null },
                    ].map((item, i) => (
                      <div key={i}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                          <FIS name={item.icon} size={12} color={item.iconColor} />
                          <span style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>{item.label}</span>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>{item.value}</div>
                        {item.sub && <div style={{ fontSize: 11, color: "#64748B", marginTop: 1 }}>{item.sub}</div>}
                      </div>
                    ))}
                    {/* Size breakdown */}
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <FIS name="layers" size={12} color="#64748B" />
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>Hasil per Size</span>
                      </div>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {(detail.pemotongan.sizeBreakdown || []).map((s: any) => (
                          <span key={s.size} style={{ background: Number(s.sisa) > 0 ? "#ECFDF5" : "#F1F5F9", color: Number(s.sisa) > 0 ? "#065F46" : "#94A3B8", fontWeight: 700, fontSize: 10, padding: "2px 7px", borderRadius: 6, border: `1px solid ${Number(s.sisa) > 0 ? "#10B981" : "#E2E8F0"}` }}>
                            {s.size}: {s.jumlah} <span style={{ opacity: 0.7 }}>({s.sisa} sisa)</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/*  TIMELINE  */}
              <div style={{ margin: "20px 28px", paddingBottom: 40 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
                  <FIS name="time-forward" size={13} color="#94A3B8" />
                  <span style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 1 }}>Riwayat Perjalanan Lengkap</span>
                </div>

                <div style={{ position: "relative" }}>
                  <div style={{ position: "absolute", top: 20, bottom: 0, left: 19, width: 2, background: "#E2E8F0", borderRadius: 2 }} />

                  {/* Event 0: Penerbitan PO */}
                  <TLCard
                    fiIcon="file-invoice" iconBg="#F8FAFC" iconColor="#64748B" iconBorder="#E2E8F0"
                    badge="Penerbitan PO" badgeBg="#F1F5F9" badgeColor="#64748B"
                    time={fmtDT(detail.tanggalTerbit)}
                    title={`PO ${detail.noPo} diterbitkan`}
                    subtitle={`Model: ${detail.model} · Vendor: ${detail.vendorCMT?.nama || ""} · ${detail.jumlahTerbit} pcs`}
                    extra={detail.catatan}
                    sizes={detail.sizeBreakdown}
                  />

                  {/* CMT Records */}
                  {(detail.cmtRecords || []).map((rec: any) => {
                    const isACC = rec.status === "Diverifikasi" || rec.status === "Diterima";
                    const totalRec = (rec.items || []).reduce((s: number, i: any) => s + Number(i.jumlah || 0), 0);
                    return (
                      <TLCard
                        key={`cmt-${rec.id}`}
                        fiIcon="needle" iconBg={isACC ? "#DCFCE7" : "#FEF3C7"} iconColor={isACC ? "#10B981" : "#F59E0B"} iconBorder={isACC ? "#10B981" : "#F59E0B"}
                        badge={isACC ? "Laporan CMT  Di-ACC" : "Laporan CMT  Pending"}
                        badgeBg={isACC ? "#D1FAE5" : "#FEF3C7"} badgeColor={isACC ? "#065F46" : "#92400E"}
                        time={fmtDT(rec.createdAt)}
                        title={`${rec.vendor_nama} melaporkan ${totalRec} pcs selesai dijahit`}
                        subtitle={isACC && rec.diterimaPada ? `Di-ACC Admin: ${fmtDT(rec.diterimaPada)}` : "Menunggu persetujuan Admin"}
                        extra={rec.catatan}
                        sizes={rec.items?.map((i: any) => ({ size: i.size, jumlah: i.jumlah }))}
                        pcs={totalRec}
                      />
                    );
                  })}

                  {/* Ledger moves */}
                  {(detail.ledgers || []).filter((l: any) => l.dari !== "SISTEM" && l.dari_vendor_id !== "SISTEM").map((l: any) => {
                    const isGudang = l.ke_vendor_id === "GUDANG";
                    return (
                      <TLCard
                        key={`l-${l.id}`}
                        fiIcon={isGudang ? "box-open" : "arrow-right"} iconBg={isGudang ? "#DCFCE7" : "#EFF6FF"} iconColor={isGudang ? "#10B981" : "#3B82F6"} iconBorder={isGudang ? "#10B981" : "#3B82F6"}
                        badge={isGudang ? "Masuk Gudang Produksi" : "Tarik Barang"}
                        badgeBg={isGudang ? "#D1FAE5" : "#DBEAFE"} badgeColor={isGudang ? "#065F46" : "#1D4ED8"}
                        time={fmtDT(l.tanggal)}
                        title={`Dipindah ke: ${l.ke_nama}`}
                        subtitle={`Dari: ${l.dari_nama}`}
                        extra={l.catatan}
                        pcs={l.jumlah}
                      />
                    );
                  })}

                  {/* Produksi Transfers */}
                  {(detail.transfers || []).map((t: any) => {
                    const cfg = STAGE_CONFIG[t.ke] || { label: t.ke.toUpperCase(), color: "#3B82F6", bg: "#EFF6FF", fiIcon: "box-open" };
                    const isDone = t.status === "Diverifikasi";
                    return (
                      <TLCard
                        key={`tr-${t.id}`}
                        fiIcon={cfg.fiIcon} iconBg={isDone ? "#DCFCE7" : cfg.bg} iconColor={isDone ? "#10B981" : cfg.color} iconBorder={isDone ? "#10B981" : cfg.color}
                        badge={`${cfg.label}${isDone ? "  Selesai" : "  Dalam Proses"}`}
                        badgeBg={isDone ? "#D1FAE5" : cfg.bg} badgeColor={isDone ? "#065F46" : cfg.color}
                        time={fmtDT(t.tanggal_kirim)}
                        title={t.vendor_ke_nama ? `Dikirim ke: ${t.vendor_ke_nama} (${cfg.label})` : `Siap melakukan ${cfg.label}`}
                        subtitle={isDone ? `Selesai & Diverifikasi · Diterima: ${t.jumlah_diterima || t.jumlah_kirim} pcs` : `Dalam proses · ${t.jumlah_kirim} pcs`}
                        extra={t.catatan}
                        sizes={t.sizeBreakdown}
                        pcs={t.jumlah_kirim}
                      />
                    );
                  })}

                  {detail.cmtRecords?.length === 0 && detail.transfers?.length === 0 && (
                    <div style={{ marginLeft: 52, padding: "16px 20px", background: "white", borderRadius: 12, border: "1px dashed #E2E8F0", color: "#94A3B8", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                      <FI name="clock" size={14} color="#94A3B8" /> Belum ada aktivitas. Menunggu laporan dari vendor CMT.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/*  Timeline Card  */
function TLCard({ fiIcon, iconBg, iconColor, iconBorder, badge, badgeBg, badgeColor, time, title, subtitle, extra, sizes, pcs }: {
  fiIcon: string; iconBg: string; iconColor: string; iconBorder: string;
  badge: string; badgeBg: string; badgeColor: string;
  time: string; title: string; subtitle?: string; extra?: string;
  sizes?: { size: string; jumlah: number | string }[];
  pcs?: number;
}) {
  return (
    <div style={{ display: "flex", gap: 14, marginBottom: 16, position: "relative" }}>
      {/* Icon circle */}
      <div style={{ position: "relative", zIndex: 2, flexShrink: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: iconBg, border: `2px solid ${iconBorder}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 4px #F1F5F9" }}>
          <i className={`fi fi-sr-${fiIcon}`} style={{ fontSize: 16, color: iconColor, display: "inline-block" }} />
        </div>
      </div>
      {/* Card */}
      <div className="tl-card" style={{ flex: 1, background: "white", borderRadius: 12, padding: "14px 18px", boxShadow: "0 2px 6px rgba(0,0,0,0.04)", border: "1px solid #E2E8F0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
          <div>
            <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 3, display: "flex", alignItems: "center", gap: 5 }}>
              <i className="fi fi-rr-clock" style={{ fontSize: 11 }} /> {time}
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>{subtitle}</div>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ background: badgeBg, color: badgeColor, fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 20, whiteSpace: "nowrap" }}>{badge}</span>
            {pcs !== undefined && (
              <span style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", color: "#374151", fontWeight: 900, fontSize: 12, padding: "3px 9px", borderRadius: 20 }}>{pcs} pcs</span>
            )}
          </div>
        </div>
        {sizes && sizes.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
            {sizes.map((s: any, i: number) => (
              <span key={i} style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", color: "#374151", fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 6 }}>
                {s.size}: {s.jumlah} pcs
              </span>
            ))}
          </div>
        )}
        {extra && (
          <div style={{ marginTop: 8, background: "#F8FAFC", border: "1px dashed #E2E8F0", borderRadius: 8, padding: "6px 10px", fontSize: 12, color: "#64748B" }}>
            <i className="fi fi-rr-comment-alt" style={{ marginRight: 5 }} />{extra}
          </div>
        )}
      </div>
    </div>
  );
}
