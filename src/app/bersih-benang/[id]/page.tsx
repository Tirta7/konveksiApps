"use client";
import React, { use, useEffect, useState, useRef } from "react";
import { Briefcase, CheckCircle2, Clock, DollarSign, Package, PlusCircle, RefreshCw, X, AlertCircle, TrendingUp, PlayCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

//  Radial Progress Bar 
function RadialProgress({ pct, size = 80, stroke = 7, color = "#3B82F6", label }: { pct: number; size?: number; stroke?: number; color?: string; label?: string }) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const filled = circ * (1 - Math.min(pct, 100) / 100);
  const isComplete = pct >= 100;
  const c = isComplete ? "#10B981" : color;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1E293B" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={filled}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(.4,2,.6,1)" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: size * 0.19, fontWeight: 900, color: isComplete ? "#10B981" : "white", lineHeight: 1 }}>{Math.round(pct)}%</span>
        {label && <span style={{ fontSize: size * 0.12, color: "#64748B", marginTop: 1 }}>{label}</span>}
      </div>
    </div>
  );
}

export default function CMTPortalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"dashboard" | "riwayat" | "gaji">("dashboard");
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestForm, setRequestForm] = useState({ total_request: "", catatan: "", pemotongan_id: "" });
  const [submitting, setSubmitting] = useState(false);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [requestFilter, setRequestFilter] = useState("Semua");
  const [showProgresModal, setShowProgresModal] = useState<any | null>(null);
  const [progresForm, setProgresForm] = useState<{ size: string; jumlah: number | ""; maxSisa: number; done: number }[]>([]);
  const [progresCatatan, setProgresCatatan] = useState("");
  const [justSubmittedPo, setJustSubmittedPo] = useState<string | null>(null); // PO id that just got a report

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/cmt-portal/${id}`);
      if (!res.ok) throw new Error("CMT tidak ditemukan");
      const json = await res.json();
      setData(json);
    } catch {
      toast.error("Gagal memuat portal CMT");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchData(); 
    const interval = setInterval(() => {
      // Fetch without triggering the full loading state
      fetch(`/api/cmt-portal/${id}?_t=` + Date.now())
        .then(res => res.json())
        .then(json => setData(json))
        .catch(() => {});
    }, 2000);
    return () => clearInterval(interval);
  }, [id]);

  // Real-time sync: auto-refresh when another admin makes a change
  useEffect(() => {
    const handler = () => fetchData();
    window.addEventListener("konveksi-sync", handler);
    return () => window.removeEventListener("konveksi-sync", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestForm.pemotongan_id) {
      toast.error("Silakan pilih kain yang tersedia terlebih dahulu!");
      return;
    }
    if (!requestForm.total_request || Number(requestForm.total_request) <= 0) {
      toast.error("Masukkan jumlah yang valid");
      return;
    }
    setSubmitting(true);
    try {
      const selectedP = data.pemotonganReady.find((p: any) => String(p.id) === requestForm.pemotongan_id);
          const isTransfer = selectedP?.is_transfer;
          
      const res = await fetch("/api/cmt-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor_id: Number(id),
          total_request: Number(requestForm.total_request),
          catatan: requestForm.catatan,
          pemotongan_id: isTransfer ? null : (requestForm.pemotongan_id ? Number(requestForm.pemotongan_id) : null),
          transfer_id: isTransfer ? Number(requestForm.pemotongan_id) : null,
        })
      });
      if (!res.ok) throw new Error("Gagal mengirim request");
      toast.success("Request berhasil dikirim ke Admin!");
      setShowRequestModal(false);
      setRequestForm({ total_request: "", catatan: "", pemotongan_id: "" });
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLaporProgres = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showProgresModal) return;
    
    // Filter out sizes with 0/empty jumlah
    const items = progresForm.filter(p => Number(p.jumlah) > 0);
    if (items.length === 0) {
      toast.error("Isi setidaknya 1 size yang sudah selesai dijahit.");
      return;
    }

    // Validasi: tidak boleh melebihi sisa masing-masing size
    for (const item of items) {
      if (Number(item.jumlah) > item.maxSisa) {
        toast.error(`Size ${item.size}: Jumlah (${item.jumlah}) melebihi sisa yang tersedia (${item.maxSisa} pcs)`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/cmt-progres", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          po_id: showProgresModal.id,
          vendor_id: id,
          items: items.map(i => ({ size: i.size, jumlah: Number(i.jumlah) })),
          catatan: progresCatatan
        })
      });
      if (!res.ok) throw new Error("Gagal mengirim laporan progres");
      
      toast.success(" Laporan progres berhasil dikirim ke Admin!");
      setJustSubmittedPo(showProgresModal.id);
      setTimeout(() => setJustSubmittedPo(null), 4000);
      setShowProgresModal(null);
      setProgresCatatan("");
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleMulaiKerja = async (po: any, action: "mulai" | "batal") => {
    try {
      const res = await fetch("/api/portal-vendor/mulai-kerja", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: po.id,
          po_id: po.po_id || po.id,
          is_transfer: !!po.is_transfer,
          action,
          vendor_tipe: data.vendor?.tipe || "bersih-benang"
        })
      });
      if (!res.ok) throw new Error("Gagal mengubah status");
      toast.success(action === "mulai" ? "Berhasil mulai mengerjakan!" : "Berhasil membatalkan status!");
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0F172A" }}>
      <div style={{ textAlign: "center", color: "white" }}>
        <RefreshCw size={32} style={{ animation: "spin 1s linear infinite", marginBottom: 16 }} />
        <p style={{ fontSize: 16, color: "#94A3B8" }}>Memuat Portal CMT...</p>
      </div>
    </div>
  );

  if (!data) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0F172A" }}>
      <div style={{ textAlign: "center", color: "white" }}>
        <AlertCircle size={48} style={{ margin: "0 auto 16px", color: "#EF4444" }} />
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Portal CMT Tidak Ditemukan</h1>
        <p style={{ color: "#94A3B8", marginTop: 8 }}>Pastikan link yang Anda gunakan benar.</p>
      </div>
    </div>
  );

  const totalAktif = data.activePO.reduce((sum: number, po: any) => sum + (po.jumlah_terbit || 0), 0);
  const totalSelesai = data.historiPO.reduce((sum: number, po: any) => sum + (po.jumlah_terbit || 0), 0);
  const pendingRequests = (data.requests || []).filter((r: any) => r.status === "Pending" || r.status === "Terpenuhi Sebagian");


  return (
    <div style={{ position: "fixed", inset: 0, overflowY: "auto", background: "#0F172A", color: "white", fontFamily: "Inter, sans-serif" }}>
      
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #1E293B 0%, #0F172A 100%)", borderBottom: "1px solid #1E293B", padding: "20px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ background: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)", padding: 12, borderRadius: 12, display: "flex" }}>
            <Briefcase size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{data.vendor?.nama || "CMT Portal"}</h1>
            <p style={{ fontSize: 13, color: "#64748B", margin: 0 }}>
              {data.vendor?.kode} · Portal Khusus CMT
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {pendingRequests.length > 0 && (
            <span style={{ background: "#FEF3C7", color: "#92400E", padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
               {pendingRequests.length} Request Diproses
            </span>
          )}
          {data.canRequest === false ? (
            <button 
              onClick={() => alert(` Request diblokir!\n\nAnda baru menyelesaikan ${data.blockInfo?.overallPct}% dari target ${data.blockInfo?.minPct}%.\nSelesaikan ${data.blockInfo?.neededPcs} pcs lagi dan tunggu ACC Admin untuk bisa request kain baru.`)}
              style={{ background: "#374151", color: "#9CA3AF", border: "1px solid #4B5563", padding: "10px 18px", borderRadius: 10, fontWeight: 700, cursor: "not-allowed", display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}
            >
               Minta Kerjaan
            </button>
          ) : (
            <button 
              onClick={() => setShowRequestModal(true)}
              style={{ background: "linear-gradient(135deg, #10B981, #059669)", color: "white", border: "none", padding: "10px 18px", borderRadius: 10, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 14, boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)" }}
            >
              <PlusCircle size={16} /> Minta Kerjaan
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "32px", maxWidth: 1100, margin: "0 auto" }}>

        {/* === Smart Tracking Banner + Throttle Health === */}
        {data.blockInfo && data.blockInfo.totalJumlahTerbit > 0 && (() => {
          const bi = data.blockInfo;
          const isBlocked = !data.canRequest;
          const hasOverdue = bi.maxOverdueDays > 0;
          const borderColor = isBlocked ? "#EF4444" : hasOverdue ? "#F59E0B" : "#10B981";
          const bgColor = isBlocked ? "rgba(239,68,68,0.06)" : hasOverdue ? "rgba(245,158,11,0.06)" : "rgba(16,185,129,0.06)";
          return (
            <div style={{ marginBottom: 24, borderRadius: 16, border: `1.5px solid ${borderColor}`, background: bgColor, overflow: "hidden" }}>
              {/* Header row */}
              <div style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: 14, borderBottom: `1px solid ${borderColor}30` }}>
                <div style={{ fontSize: 28 }}>{isBlocked ? "" : hasOverdue ? "" : ""}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, color: isBlocked ? "#FCA5A5" : hasOverdue ? "#FCD34D" : "#6EE7B7" }}>
                    {isBlocked ? `Request Diblokir  Progress ${bi.overallPct}% dari ${bi.effectiveMinPct}% (target)` 
                     : hasOverdue ? ` Ada PO Terlambat  Progress ${bi.overallPct}%  (Request Masih Bisa)`
                     : ` Akun Aman  Progress ${bi.overallPct}% dari ${bi.effectiveMinPct}% target`}
                  </div>
                  {bi.throttlePenalty > 0 && (
                    <div style={{ fontSize: 11, color: "#F87171", marginTop: 2, fontWeight: 600 }}>
                       Penalti Keterlambatan: +{bi.throttlePenalty}% (Base {bi.baseMinPct}%  Efektif {bi.effectiveMinPct}%)
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "center", flexShrink: 0, background: "rgba(0,0,0,0.2)", padding: "8px 16px", borderRadius: 12 }}>
                  <div style={{ fontSize: 26, fontWeight: 900, color: isBlocked ? "#EF4444" : hasOverdue ? "#F59E0B" : "#10B981", lineHeight: 1 }}>{bi.overallPct}%</div>
                  <div style={{ fontSize: 9, color: "#64748B", fontWeight: 700, marginTop: 2 }}>dari {bi.effectiveMinPct}%</div>
                </div>
              </div>

              {/* Throttle Health bar */}
              <div style={{ padding: "10px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700 }}>PROGRES ANDA</span>
                  <span style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700 }}>TARGET {bi.effectiveMinPct}%</span>
                </div>
                <div style={{ position: "relative", background: "#1E293B", borderRadius: 8, height: 12, overflow: "hidden" }}>
                  {/* Progress fill */}
                  <div style={{ width: `${Math.min(bi.overallPct, 100)}%`, height: "100%", background: isBlocked ? "linear-gradient(90deg,#EF4444,#F87171)" : "linear-gradient(90deg,#10B981,#34D399)", borderRadius: 8, transition: "width 0.8s ease" }} />
                  {/* Target marker */}
                  <div style={{ position: "absolute", top: 0, bottom: 0, left: `${bi.effectiveMinPct}%`, width: 2, background: "#F59E0B", borderRadius: 2 }} />
                </div>
                {isBlocked && (
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 6 }}>
                    Selesaikan & lapor <strong style={{ color: "white" }}>{bi.neededPcs} pcs lagi</strong> dan tunggu ACC Admin
                  </div>
                )}
              </div>

              {/* Overdue warning strip */}
              {bi.overduePoList && bi.overduePoList.length > 0 && (
                <div style={{ padding: "10px 20px", background: "rgba(239,68,68,0.08)", borderTop: "1px solid rgba(239,68,68,0.2)" }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#FCA5A5", marginBottom: 6 }}> PO MELEBIHI TARGET TANGGAL SELESAI</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {bi.overduePoList.map((op: any, i: number) => (
                      <div key={i} style={{ background: "rgba(239,68,68,0.15)", border: "1px solid #EF444460", borderRadius: 8, padding: "4px 10px", fontSize: 11 }}>
                        <span style={{ fontWeight: 800, color: "#FCA5A5" }}>{op.noPo}</span>
                        <span style={{ color: "#94A3B8" }}> · target {new Date(op.targetSelesai).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} · </span>
                        <span style={{ color: "#EF4444", fontWeight: 700 }}>+{op.overdueDays} hari</span>
                        <span style={{ color: "#F87171" }}>  -{op.overdueDays}% throttle</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}


        {/* Stat Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 20, marginBottom: 32 }}>
          {[
            { label: "Sedang Dikerjakan", value: `${totalAktif} pcs`, icon: <Package size={22} />, color: "#3B82F6", bg: "#1E3A5F" },
            { label: "Total Selesai", value: `${totalSelesai} pcs`, icon: <CheckCircle2 size={22} />, color: "#10B981", bg: "#064E3B" },
            { label: "Hutang Gaji", value: `Rp ${(data.totalTertunggak || 0).toLocaleString("id-ID")}`, icon: <DollarSign size={22} />, color: "#F59E0B", bg: "#451A03" },
            { label: "PO Aktif", value: `${data.activePO.length} PO`, icon: <Clock size={22} />, color: "#8B5CF6", bg: "#2E1065" },
          ].map((stat, i) => (
            <div key={i} style={{ background: "#1E293B", borderRadius: 16, padding: 24, border: "1px solid #334155" }}>
              <div style={{ background: stat.bg, color: stat.color, width: 48, height: 48, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                {stat.icon}
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "white", letterSpacing: "-0.5px" }}>{stat.value}</div>
              <div style={{ fontSize: 13, color: "#64748B", marginTop: 4, fontWeight: 500 }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, background: "#1E293B", padding: 6, borderRadius: 12, marginBottom: 24, width: "fit-content" }}>
          {([["dashboard", "PO Aktif"], ["riwayat", "Riwayat Kinerja"], ["gaji", "Slip Gaji"]]).map(([key, label]) => (
            <button 
              key={key} 
              onClick={() => setActiveTab(key as any)}
              style={{ padding: "10px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700, background: activeTab === key ? "white" : "transparent", color: activeTab === key ? "#0F172A" : "#64748B", transition: "all 0.2s" }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab: PO Aktif */}
        {activeTab === "dashboard" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {data.activePO.length === 0 ? (
              <div style={{ background: "#1E293B", borderRadius: 16, padding: 48, textAlign: "center", border: "1px solid #334155" }}>
                <Package size={48} style={{ color: "#334155", margin: "0 auto 16px" }} />
                <p style={{ color: "#64748B", fontSize: 16 }}>Tidak ada pekerjaan aktif saat ini.</p>
                <p style={{ color: "#475569", fontSize: 13, marginTop: 8 }}>Klik "Minta Kerjaan" untuk mengajukan permintaan ke Admin.</p>
              </div>
            ) : data.activePO.map((po: any) => {
              const totalTarget = po.jumlah_terbit || po.jumlahTerbit || 0;
              const totalDone = po.totalDiambil || 0;
              const pct = totalTarget > 0 ? Math.round((totalDone / totalTarget) * 100) : 0;
              const isJustSubmitted = justSubmittedPo === po.id;
              const isOverdue = po.isOverdue;
              const overdueDays = po.overdueDays || 0;
              const targetSelesai = po.targetSelesai;
              return (
              <div key={po.id} style={{ background: isJustSubmitted ? "#0D2137" : "#1E293B", borderRadius: 16, border: isJustSubmitted ? "2px solid #10B981" : isOverdue ? "2px solid #EF4444" : "1px solid #334155", transition: "all 0.5s", overflow: "hidden" }}>
                {/* Overdue Warning Strip */}
                {isOverdue && (
                  <div style={{ background: "linear-gradient(135deg,#7F1D1D,#991B1B)", padding: "8px 24px", display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 16 }}></span>
                    <div>
                      <span style={{ fontWeight: 800, fontSize: 12, color: "#FCA5A5" }}>
                        PO INI MELEBIHI TARGET SELESAI {overdueDays} HARI
                      </span>
                      <span style={{ fontSize: 11, color: "#FCA5A5", marginLeft: 8, opacity: 0.8 }}>
                        Target: {new Date(targetSelesai).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}
                      </span>
                    </div>
                    <div style={{ marginLeft: "auto", background: "#EF4444", color: "white", fontSize: 11, fontWeight: 800, padding: "2px 10px", borderRadius: 20 }}>
                      -{overdueDays}% Throttle
                    </div>
                  </div>
                )}
                <div style={{ padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "white", marginBottom: 4 }}>{po.no_po || po.noPo || ""}</div>
                    <div style={{ fontSize: 13, color: "#64748B", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <div>Model: <span style={{ color: "#94A3B8", fontWeight: 600 }}>{po.model}</span></div>
                      <div style={{ background: "#451A03", color: "#F59E0B", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                        Sisa Jahitan: {Math.max(0, totalTarget - totalDone)} pcs
                      </div>
                      {targetSelesai && !isOverdue && (
                        <div style={{ background: "#064E3B", color: "#34D399", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                           Target: {new Date(targetSelesai).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                        </div>
                      )}
                    </div>
                    {isJustSubmitted && (
                      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, background: "#064E3B", padding: "6px 12px", borderRadius: 8, width: "fit-content" }}>
                        <CheckCircle2 size={14} color="#10B981" />
                        <span style={{ fontSize: 12, color: "#10B981", fontWeight: 700 }}>Laporan dikirim! Menunggu verifikasi admin...</span>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    {/* Radial progress */}
                    <RadialProgress pct={pct} size={72} stroke={6} color="#3B82F6" />
                    <span style={{ background: "#064E3B", color: "#10B981", padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>AKTIF</span>
                  </div>
                </div>

                {/* Progress diterima */}
                <div style={{ background: "#0F172A", borderRadius: 12, padding: "12px 16px", marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontSize: 12, color: "#64748B", fontWeight: 700 }}>PROGRES DISERAHKAN</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: pct >= 100 ? "#10B981" : "#3B82F6" }}>
                      {totalDone} / {totalTarget} pcs
                    </div>
                  </div>
                  <div style={{ width: "100%", background: "#1E293B", height: 8, borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ background: pct >= 100 ? "#10B981" : "linear-gradient(90deg,#3B82F6,#8B5CF6)", height: "100%", width: `${Math.min(pct, 100)}%`, transition: "width 0.8s cubic-bezier(.4,2,.6,1)", borderRadius: 4 }} />
                  </div>
                  <div style={{ fontSize: 11, color: "#475569", marginTop: 4, textAlign: "right", fontWeight: 600 }}>{pct}% Selesai</div>
                </div>

                {po.sizeBreakdown && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, color: "#475569", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Breakdown per Size</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {po.sizeBreakdown.map((s: any, i: number) => {
                        const sDone = po.sizeProgress?.[s.size] || 0;
                        const sPending = po.pendingSizeProgress?.[s.size] || 0;
                        const sPct = s.jumlah > 0 ? Math.round((sDone / s.jumlah) * 100) : 0;
                        return (
                          <div key={i} style={{ background: "#0F172A", padding: "8px 12px", borderRadius: 10, border: sPct >= 100 ? "1px solid #10B981" : sPending > 0 ? "1px solid #F59E0B" : "1px solid #334155", minWidth: 70, textAlign: "center" }}>
                            <div style={{ fontWeight: 900, color: "white", fontSize: 14 }}>{s.size}</div>
                            <div style={{ fontSize: 11, color: sPct >= 100 ? "#10B981" : "#64748B", marginTop: 2 }}>{sDone}/{s.jumlah}</div>
                            {sPending > 0 && <div style={{ fontSize: 10, color: "#F59E0B", fontWeight: 700 }}>+{sPending} pending</div>}
                            <div style={{ marginTop: 4, height: 3, background: "#1E293B", borderRadius: 2, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${sPct}%`, background: sPct >= 100 ? "#10B981" : "#3B82F6", transition: "width 0.5s" }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4, gap: 8 }}>
                  {po.transfer_status !== "Dikerjakan" ? (
                    <button 
                      onClick={() => handleMulaiKerja(po, "mulai")}
                      style={{ background: "linear-gradient(135deg,#F59E0B,#D97706)", color: "white", padding: "10px 20px", borderRadius: 10, fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 12px rgba(245,158,11,0.35)" }}
                    >
                      <PlayCircle size={16} /> Mulai Mengerjakan
                    </button>
                  ) : (
                    <>
                      <button 
                        onClick={() => handleMulaiKerja(po, "batal")}
                        style={{ background: "transparent", color: "#EF4444", border: "1px solid #EF4444", padding: "10px 16px", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
                      >
                        <XCircle size={16} /> Batal Mulai
                      </button>
                      <button 
                        onClick={() => {
                          setShowProgresModal(po);
                          const items = po.sizeBreakdown.map((s: any) => {
                            const approved = po.sizeProgress?.[s.size] || 0;
                            const pending = po.pendingSizeProgress?.[s.size] || 0;
                            const sisa = Math.max(s.jumlah - approved - pending, 0);
                            return {
                              size: s.size,
                              jumlah: "",
                              maxSisa: sisa,
                              totalTarget: s.jumlah,
                              done: approved,
                              pending: pending,
                            };
                          });
                          setProgresForm(items);
                          setProgresCatatan("");
                        }}
                        style={{ background: pct >= 100 ? "#064E3B" : "linear-gradient(135deg,#3B82F6,#6366F1)", color: pct >= 100 ? "#10B981" : "white", padding: "10px 20px", borderRadius: 10, fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, boxShadow: pct >= 100 ? "none" : "0 4px 12px rgba(59,130,246,0.35)" }}
                      >
                        {pct >= 100 ? <><CheckCircle2 size={16} /> Sudah 100%  Lapor Lagi?</> : <><TrendingUp size={16} /> Lapor Progres Selesai</>}
                      </button>
                    </>
                  )}
                </div>
                </div>
              </div>
              );
            })}
          </div>
        )}

        {/* Tab: Riwayat */}
        {activeTab === "riwayat" && (
          <div style={{ background: "#1E293B", borderRadius: 16, border: "1px solid #334155", overflow: "hidden" }}>
            {data.historiPO.length === 0 ? (
              <div style={{ padding: 48, textAlign: "center" }}><p style={{ color: "#64748B" }}>Belum ada riwayat pekerjaan selesai.</p></div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#0F172A" }}>
                    {["NO PO", "MODEL", "TOTAL", "STATUS"].map(h => (
                      <th key={h} style={{ padding: "14px 20px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#475569", letterSpacing: "0.5px" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.historiPO.map((po: any, i: number) => (
                    <tr key={po.id} style={{ borderTop: "1px solid #334155" }}>
                      <td style={{ padding: "14px 20px", fontFamily: "monospace", color: "#94A3B8", fontSize: 14 }}>{po.no_po || po.noPo || ""}</td>
                      <td style={{ padding: "14px 20px", fontWeight: 600, color: "white" }}>{po.model}</td>
                      <td style={{ padding: "14px 20px", fontWeight: 700, color: "#10B981" }}>{po.jumlah_terbit} pcs</td>
                      <td style={{ padding: "14px 20px" }}>
                        <span style={{ background: "#064E3B", color: "#10B981", padding: "4px 10px", borderRadius: 12, fontSize: 12, fontWeight: 700 }}>Selesai</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab: Gaji */}
        {activeTab === "gaji" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {data.gaji.length === 0 ? (
              <div style={{ background: "#1E293B", borderRadius: 16, padding: 48, textAlign: "center", border: "1px solid #334155" }}>
                <p style={{ color: "#64748B" }}>Belum ada data penggajian.</p>
              </div>
            ) : data.gaji.map((g: any) => (
              <div key={g.id} style={{ background: "#1E293B", borderRadius: 16, padding: 24, border: "1px solid #334155", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700, color: "white", marginBottom: 4 }}>{g.keterangan || `Gaji PO #${g.po_id}`}</div>
                  <div style={{ fontSize: 13, color: "#64748B" }}>{g.tanggal}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: g.status === "Lunas" ? "#10B981" : "#F59E0B" }}>
                    Rp {(g.total || 0).toLocaleString("id-ID")}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: g.status === "Lunas" ? "#10B981" : "#F59E0B", background: g.status === "Lunas" ? "#064E3B" : "#451A03", padding: "2px 8px", borderRadius: 10 }}>
                    {g.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Riwayat Request */}
        {data.requests && data.requests.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16, color: "white" }}>Riwayat Request Saya</h2>
            
            {/* FILTER BARS */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {["Semua", "Pending", "Selesai", "Ditolak"].map(f => (
                <button 
                  key={f}
                  onClick={() => setRequestFilter(f)}
                  style={{ 
                    padding: "6px 14px", 
                    borderRadius: 20, 
                    fontSize: 13, 
                    fontWeight: 700, 
                    cursor: "pointer", 
                    background: requestFilter === f ? "#3B82F6" : "#1E293B", 
                    color: requestFilter === f ? "white" : "#94A3B8",
                    border: "1px solid #334155"
                  }}
                >
                  {f}
                </button>
              ))}
            </div>

            {(() => {
              const filtered = data.requests.filter((r: any) => {
                if (requestFilter === "Semua") return true;
                if (requestFilter === "Selesai") return r.status === "Selesai" || r.status === "Terpenuhi Sebagian";
                return r.status === requestFilter;
              });

              if (filtered.length === 0) {
                return (
                  <div style={{ background: "#1E293B", borderRadius: 12, padding: 32, textAlign: "center", border: "1px solid #334155" }}>
                    <p style={{ color: "#64748B", margin: 0 }}>Tidak ada request dengan status {requestFilter}.</p>
                  </div>
                );
              }

              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {filtered.map((r: any) => (
                <div key={r.id} style={{ background: "#1E293B", borderRadius: 12, padding: 20, border: "1px solid #334155", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 700, color: "white" }}>Request {r.total_request} pcs</div>
                    <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>{new Date(r.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</div>
                    {r.catatan && <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 4 }}>"{r.catatan}"</div>}
                    {r.status === "Ditolak" && r.alasan_tolak && (
                      <div style={{ fontSize: 13, color: "#FCA5A5", marginTop: 8, background: "#450A0A", padding: "8px 12px", borderRadius: 8, border: "1px solid #7F1D1D" }}>
                        <strong>Alasan Ditolak:</strong> {r.alasan_tolak}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: r.status === "Selesai" ? "#10B981" : r.status === "Terpenuhi Sebagian" ? "#F59E0B" : r.status === "Ditolak" ? "#EF4444" : "#3B82F6" }}>
                      {r.total_dipenuhi || 0} / {r.total_request} pcs
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end", marginTop: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 10, background: r.status === "Selesai" ? "#064E3B" : r.status === "Ditolak" ? "#450A0A" : "#1E3A5F", color: r.status === "Selesai" ? "#10B981" : r.status === "Ditolak" ? "#EF4444" : "#3B82F6" }}>
                        {r.status}
                      </span>
                      {r.status === "Pending" && (
                        <button 
                          onClick={async () => {
                            if (!confirm("Yakin ingin membatalkan request ini?")) return;
                            setCancelingId(r.id);
                            try {
                              await fetch(`/api/cmt-request?id=${r.id}`, { method: "DELETE" });
                              toast.success("Request dibatalkan");
                              fetchData();
                            } catch (e) {
                              toast.error("Gagal membatalkan request");
                            } finally {
                              setCancelingId(null);
                            }
                          }}
                          disabled={cancelingId === r.id}
                          style={{ background: "transparent", border: "1px solid #64748B", color: "#94A3B8", fontSize: 12, padding: "4px 10px", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                        >
                          <X size={12} /> {cancelingId === r.id ? "Membatalkan..." : "Batal Request"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            );
          })()}
          </div>
        )}
      </div>

      {/* Request Modal */}
      {showRequestModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
          <div style={{ background: "#1E293B", width: "100%", maxWidth: 560, borderRadius: 20, overflow: "hidden", boxShadow: "0 25px 50px rgba(0,0,0,0.5)", border: "1px solid #334155", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
            {/* Modal Header */}
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #334155", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: "white", margin: 0 }}>Minta Kerjaan Baru</h2>
                <p style={{ fontSize: 12, color: "#64748B", margin: "3px 0 0" }}>Pilih pekerjaan dan beritahu Admin jumlah yang Anda sanggup</p>
              </div>
              <button onClick={() => setShowRequestModal(false)} style={{ background: "#334155", border: "none", color: "#94A3B8", padding: 8, borderRadius: 8, cursor: "pointer" }}><X size={18} /></button>
            </div>

            <form onSubmit={handleSubmitRequest} style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16, overflowY: "auto" }}>

              {/* STEP 1: Pilih Pemotongan Kain */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
                   Pilih Kain yang Tersedia
                </div>
                {(data?.pemotonganReady || []).length === 0 ? (
                  <div style={{ background: "#0F172A", borderRadius: 12, padding: 16, textAlign: "center", color: "#475569", fontSize: 13 }}>
                    Tidak ada stok kain tersedia saat ini
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {(data?.pemotonganReady || []).map((p: any) => {
                      const isSelected = requestForm.pemotongan_id === String(p.id);
                      return (
                        <div
                          key={p.id}
                          onClick={() => setRequestForm(prev => ({ ...prev, pemotongan_id: isSelected ? "" : String(p.id) }))}
                          style={{ background: isSelected ? "#0D2137" : "#0F172A", border: `2px solid ${isSelected ? "#3B82F6" : "#334155"}`, borderRadius: 12, padding: "12px 16px", cursor: "pointer", transition: "all 0.15s" }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                            <div>
                              <div style={{ fontWeight: 800, color: "white", fontSize: 14 }}>{p.nama_barang}</div>
                              <div style={{ fontSize: 11, color: "#64748B", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 2 }}>
                                <span>Model: {p.model} · {new Date(p.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
                                {p.target_selesai && (() => {
                                  const t = new Date(p.target_selesai);
                                  const now = new Date(); now.setHours(0,0,0,0);
                                  const graceDate = new Date(t); graceDate.setDate(graceDate.getDate()+1);
                                  const isOvd = now > graceDate;
                                  const daysLeft = Math.ceil((t.getTime() - now.getTime()) / (1000*60*60*24));
                                  return (
                                    <span style={{ background: isOvd ? "#7F1D1D" : daysLeft <= 3 ? "#451A03" : "#064E3B", color: isOvd ? "#FCA5A5" : daysLeft <= 3 ? "#FCD34D" : "#34D399", padding: "1px 7px", borderRadius: 6, fontWeight: 800, fontSize: 11 }}>
                                       Target: {t.toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                                      {isOvd ? "  LEWAT!" : daysLeft <= 0 ? " (Hari ini!)" : ` (${daysLeft} hari lagi)`}
                                    </span>
                                  );
                                })()}
                              </div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontWeight: 900, fontSize: 18, color: isSelected ? "#3B82F6" : "#10B981" }}>{p.sisa_total}</div>
                              <div style={{ fontSize: 10, color: "#64748B" }}>sisa pcs</div>
                            </div>
                          </div>
                          
                          {/* NEW: show pending requests info */}
                          {p.pending_requests && p.pending_requests.length > 0 && (
                            <div style={{ fontSize: 11, color: "#F59E0B", marginBottom: 8, background: "#451A03", padding: "4px 8px", borderRadius: 6, display: "inline-block" }}>
                               Sedang di-Request: {p.pending_requests.map((pr: any) => `${pr.vendor_nama} (${pr.total_request} pcs)`).join(', ')}
                            </div>
                          )}

                          {/* Size sisa */}
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {(p.sizeBreakdown || []).map((s: any) => (
                              <span key={s.size} style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: s.sisa > 0 ? "#1E3A5F" : "#1E293B", color: s.sisa > 0 ? "#60A5FA" : "#475569", border: `1px solid ${s.sisa > 0 ? "#2563EB" : "#334155"}` }}>
                                {s.size}: {s.sisa}
                              </span>
                            ))}
                          </div>
                          {isSelected && (
                            <div style={{ marginTop: 8, fontSize: 11, color: "#3B82F6", fontWeight: 700 }}> Dipilih</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* STEP 2: Jumlah */}
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
                   Berapa pcs yang Anda sanggup kerjakan? <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type="number" min="1"
                    placeholder="Contoh: 500"
                    required
                    value={requestForm.total_request}
                    onChange={e => setRequestForm({ ...requestForm, total_request: e.target.value })}
                    style={{ width: "100%", padding: "14px 60px 14px 20px", borderRadius: 12, border: "2px solid #334155", background: "#0F172A", color: "white", fontSize: 22, fontWeight: 900, outline: "none", textAlign: "center" }}
                    onFocus={e => e.target.style.borderColor = "#3B82F6"}
                    onBlur={e => e.target.style.borderColor = "#334155"}
                  />
                  <span style={{ position: "absolute", right: 20, top: "50%", transform: "translateY(-50%)", color: "#475569", fontWeight: 700, fontSize: 14 }}>pcs</span>
                </div>
                {requestForm.pemotongan_id && (() => {
                  const p = (data?.pemotonganReady || []).find((x: any) => String(x.id) === requestForm.pemotongan_id);
                  return p ? (
                    <div style={{ marginTop: 6, fontSize: 11, color: Number(requestForm.total_request) > p.sisa_total ? "#EF4444" : "#10B981", fontWeight: 700 }}>
                      {Number(requestForm.total_request) > p.sisa_total
                        ? ` Melebihi sisa stok! Sisa hanya ${p.sisa_total} pcs`
                        : ` Stok cukup (sisa ${p.sisa_total} pcs)`}
                    </div>
                  ) : null;
                })()}
              </div>

              {/* STEP 3: Catatan */}
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}> Catatan (Opsional)</label>
                <textarea
                  rows={2}
                  placeholder="Misal: Saya bisa mulai Senin, atau ada preferensi model tertentu..."
                  value={requestForm.catatan}
                  onChange={e => setRequestForm({ ...requestForm, catatan: e.target.value })}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 12, border: "2px solid #334155", background: "#0F172A", color: "white", fontSize: 13, outline: "none", resize: "none" }}
                  onFocus={e => e.target.style.borderColor = "#3B82F6"}
                  onBlur={e => e.target.style.borderColor = "#334155"}
                />
              </div>

              <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
                <button type="button" onClick={() => setShowRequestModal(false)} style={{ flex: 1, padding: 12, background: "#334155", color: "#94A3B8", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer" }}>Batal</button>
                <button type="submit" disabled={submitting} style={{ flex: 2, padding: 12, background: "linear-gradient(135deg, #10B981, #059669)", color: "white", border: "none", borderRadius: 10, fontWeight: 800, cursor: "pointer", fontSize: 15, boxShadow: "0 4px 12px rgba(16,185,129,0.3)" }}>
                  {submitting ? "Mengirim..." : "Kirim Request ke Admin"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Lapor Progres */}
      {showProgresModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
          <div style={{ background: "#1E293B", borderRadius: 20, width: "100%", maxWidth: 500, overflow: "hidden", border: "1px solid #334155" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #334155", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0F172A" }}>
              <div>
                <h3 style={{ margin: 0, color: "white", fontSize: 18, fontWeight: 800 }}>Lapor Progres Jahitan</h3>
                <div style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>PO: {showProgresModal.no_po || showProgresModal.noPo || ""}  Model: {showProgresModal.model}</div>
              </div>
              <button onClick={() => setShowProgresModal(null)} style={{ background: "transparent", border: "none", color: "#64748B", cursor: "pointer" }}><X size={24} /></button>
            </div>
            <form onSubmit={handleLaporProgres} style={{ padding: 24 }}>
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <label style={{ display: "block", color: "#94A3B8", fontSize: 13, fontWeight: 700 }}>Masukkan Jumlah Selesai per Size:</label>
                  <button
                    type="button"
                    onClick={() => {
                      setProgresForm(prev => prev.map(pf => ({ ...pf, jumlah: pf.maxSisa > 0 ? pf.maxSisa : pf.jumlah })));
                    }}
                    style={{ background: "#1E3A5F", color: "#3B82F6", border: "1px solid #3B82F6", padding: "4px 12px", borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: "pointer" }}
                  >
                     Isi Semua
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {progresForm.map((pf, idx) => (
                    <div key={pf.size} style={{ display: "flex", alignItems: "center", gap: 12, background: "#0F172A", padding: 12, borderRadius: 12 }}>
                      <div style={{ background: "#1E293B", color: "white", width: 42, height: 42, borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13 }}>
                        <span>{pf.size}</span>
                        {pf.done > 0 && <span style={{ fontSize: 9, color: "#10B981", fontWeight: 700 }}>+{pf.done}</span>}
                      </div>
                      <div style={{ flex: 1 }}>
                        <input 
                          type="number" 
                          placeholder="0"
                          min="0"
                          max={pf.maxSisa}
                          style={{ 
                            width: "100%", background: "transparent", border: "none", 
                            color: Number(pf.jumlah) > pf.maxSisa ? "#EF4444" : "white", 
                            fontSize: 20, fontWeight: 700, outline: "none" 
                          }}
                          value={pf.jumlah}
                          onChange={e => {
                            const rawVal = e.target.value ? Number(e.target.value) : "";
                            // Clamp to maxSisa
                            const val = rawVal !== "" && Number(rawVal) > pf.maxSisa ? pf.maxSisa : rawVal;
                            if (rawVal !== "" && Number(rawVal) > pf.maxSisa) {
                              toast.warning(`Size ${pf.size}: Maksimal ${pf.maxSisa} pcs`);
                            }
                            const newForm = [...progresForm];
                            newForm[idx].jumlah = val;
                            setProgresForm(newForm);
                          }}
                        />
                      </div>
                      <div style={{ textAlign: "right", minWidth: 90 }}>
                        {pf.maxSisa > 0 ? (
                          <div 
                            onClick={() => {
                              const newForm = [...progresForm];
                              newForm[idx].jumlah = pf.maxSisa;
                              setProgresForm(newForm);
                            }}
                            title="Klik untuk isi otomatis"
                            style={{ fontSize: 12, color: "#3B82F6", fontWeight: 700, cursor: "pointer", padding: "4px 8px", borderRadius: 6, border: "1px dashed #3B82F6", display: "inline-block", transition: "all 0.15s" }}
                            onMouseEnter={e => (e.currentTarget.style.background = "#1E3A5F")}
                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                          >
                            Sisa: <strong>{pf.maxSisa} pcs </strong>
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: "#10B981", fontWeight: 700 }}> Selesai!</div>
                        )}
                        {pf.done > 0 && <div style={{ fontSize: 10, color: "#10B981", fontWeight: 700, marginTop: 2 }}> ACC: {pf.done}</div>}
                        {(pf as any).pending > 0 && <div style={{ fontSize: 10, color: "#F59E0B", fontWeight: 700, marginTop: 2 }}> Pending: {(pf as any).pending}</div>}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Live total counter */}
                {progresForm.some(pf => Number(pf.jumlah) > 0) && (
                  <div style={{ marginTop: 12, padding: "10px 14px", background: "linear-gradient(135deg,#1E3A5F,#1E293B)", border: "1px solid #3B82F6", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: "#94A3B8", fontWeight: 600 }}>Total dilaporkan kali ini:</span>
                    <span style={{ fontSize: 20, fontWeight: 900, color: "#3B82F6" }}>
                      {progresForm.reduce((s, pf) => s + (Number(pf.jumlah) || 0), 0)} pcs
                    </span>
                  </div>
                )}
              </div>
              
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", color: "#94A3B8", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Catatan (Opsional)</label>
                <textarea 
                  placeholder="Misal: Sudah di-packing kardus..."
                  rows={3}
                  style={{ width: "100%", background: "#0F172A", border: "1px solid #334155", color: "white", borderRadius: 12, padding: "12px 16px", outline: "none", fontSize: 14 }}
                  value={progresCatatan}
                  onChange={e => setProgresCatatan(e.target.value)}
                />
              </div>

              <button type="submit" disabled={submitting} style={{ width: "100%", background: "#3B82F6", color: "white", padding: 16, borderRadius: 12, border: "none", fontWeight: 800, fontSize: 15, cursor: "pointer", opacity: submitting ? 0.7 : 1 }}>
                {submitting ? "Mengirim Laporan..." : "Kirim Laporan Progres"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
