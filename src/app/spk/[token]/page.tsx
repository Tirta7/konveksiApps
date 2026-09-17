"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { Clock, Shirt, CheckCircle2, Loader2, Hourglass, Package, FileText, ClipboardList, AlertTriangle, AlertCircle, PackageCheck, ClipboardCheck, CheckCircle, Search, XCircle, ClipboardX, Link as LinkIcon, ChevronDown } from "lucide-react";

function fmtTgl(str?: string) {
  if (!str) return "-";
  return new Date(str).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
}
function fmtDateTime(str?: string) {
  if (!str) return "-";
  const d = new Date(str);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) + " " +
    d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}
function fmtTime(str?: string) {
  if (!str) return "";
  return new Date(str).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

/** Derive phase from server data — so reload restores to correct state */
function derivePhase(info: any): "scan" | "confirmed" | "done" {
  if (!info) return "scan";
  if (info.routeSelesai) return "done";
  const step = info.currentStep;
  if (!step) return "scan";
  if (step.status === "selesai") return "done";
  if (step.terima_waktu) return "confirmed";  // sudah terima, restore ke confirmed
  return "scan";
}

export default function VendorSPKPage() {
  const { token } = useParams() as { token: string };
  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<"scan" | "confirmed" | "done">("scan");
  const [submitting, setSubmitting] = useState(false);
  const [showQC, setShowQC] = useState(false);
  const [showDefectForm, setShowDefectForm] = useState(false);
  // defect per size: { size: string, jumlah_cacat: number, alasan: string }[]
  const [defectForm, setDefectForm] = useState<{size:string;jumlah_cacat:number;alasan:string}[]>([]);
  const [nextStepInfo, setNextStepInfo] = useState<any>(null);
  const [flashSuccess, setFlashSuccess] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Hitung barang sebelum konfirmasi terima — per size
  type SizeCount = { size: string; jumlah_expected: number; jumlah_diterima: string };
  const [sizeCountForm, setSizeCountForm] = useState<SizeCount[]>([]);
  const [showCountForm, setShowCountForm] = useState(false);
  const [showDetailPopup, setShowDetailPopup] = useState(false);
  const [showScrollIndicator, setShowScrollIndicator] = useState(true);

  // Handle scroll to hide indicator
  useEffect(() => {
    const handleScroll = () => {
      const bottom = Math.ceil(window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight - 50;
      setShowScrollIndicator(!bottom);
    };
    window.addEventListener("scroll", handleScroll);
    // Check initial state
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const load = useCallback(async (silent = false) => {
    try {
      const res = await fetch(`/api/spk/${token}`, { cache: "no-store" });
      const d = await res.json();
      if (d.error) { setError(d.error); setLoading(false); return; }
      setInfo(d);
      setLastUpdated(new Date());
      // Selalu restore phase dari server (agar reload tidak kembali ke awal)
      const derived = derivePhase(d);
      setPhase(p => {
        // Jangan override jika user sudah di "done" akibat klik selesai
        if (p === "done") return "done";
        return derived;
      });
      setLoading(false);
    } catch (e: any) {
      console.error(e);
      setError("Fetch error: " + e.message);
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
    pollRef.current = setInterval(() => load(true), 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [load]);

  useEffect(() => {
    if (showDetailPopup) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [showDetailPopup]);

  const doAction = async (aksi: string, extraPayload?: any) => {
    setSubmitting(true);
    if (pollRef.current) clearInterval(pollRef.current);
    const res = await fetch(`/api/spk/${token}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aksi, ...extraPayload }),
    });
    const data = await res.json();
    setSubmitting(false);
    setFlashSuccess(true);
    setTimeout(() => setFlashSuccess(false), 1000);

    if (aksi === "terima") {
      setPhase("confirmed");
      pollRef.current = setInterval(() => load(true), 4000);
      return;
    }
    if (aksi === "selesai") {
      if (data.status === "step-berikutnya") setNextStepInfo(data.nextStep);
      setPhase("done");
      await load();
      return;
    }
    if (aksi === "qc-gagal") {
      setNextStepInfo({ qcFail: true, returKe: data.returKe, status: data.status, totalCacat: data.totalCacat, defect_detail: data.defect_detail });
      setPhase("done");
      await load();
    }
  };

  // Init defect form dari size_breakdown batch
  // Fallback ke 1 baris "Umum" jika batch lama tidak punya size_breakdown
  const initDefectForm = () => {
    const sizes: any[] = info?.batch?.size_breakdown ?? [];
    if (sizes.length > 0) {
      setDefectForm(sizes.map((s: any) => ({ size: s.size, jumlah_cacat: 0, alasan: "" })));
    } else {
      // Batch lama tanpa size breakdown — fallback freeform
      const totalPcs = info?.batch?.jumlah_pcs ?? 0;
      const stepJumlah = info?.currentStep?.jumlah_barang ?? totalPcs;
      setDefectForm([{ size: `Umum (${stepJumlah} pcs)`, jumlah_cacat: 0, alasan: "" }]);
    }
    setShowDefectForm(true);
  };

  const submitDefect = () => {
    const valid = defectForm.filter(d => d.jumlah_cacat > 0);
    if (valid.length === 0) return alert("Masukkan jumlah cacat minimal 1 pcs.");
    const anyMissingAlasan = valid.some(d => !d.alasan.trim());
    if (anyMissingAlasan) return alert("Isi alasan cacat untuk setiap baris yang ada cacatnya.");
    doAction("qc-gagal", { defect_detail: valid });
  };

  const step = info?.currentStep;
  const isFinishing = step?.jenis_pekerjaan?.toLowerCase().includes("finishing") ||
    step?.jenis_pekerjaan?.toLowerCase().includes("qc") ||
    step?.jenis_pekerjaan?.toLowerCase().includes("packing");

  const pageStyle: React.CSSProperties = {
    minHeight: "100vh",
    background: flashSuccess ? "#D1FAE5" : "#F1F5F9",
    padding: "20px 16px",
    fontFamily: "Inter,system-ui,sans-serif",
    transition: "background 0.3s ease",
    fontSize: 16,
  };

  if (loading) return (
    <div style={{ ...pageStyle, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 52 }}>⏳</div>
        <p style={{ fontSize: 20, color: "#64748B", marginTop: 12, fontWeight: 600 }}>Memuat data...</p>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ ...pageStyle, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "white", borderRadius: 20, padding: 40, maxWidth: 480, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 64 }}>🚫</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, marginTop: 16 }}>Link Tidak Valid</h1>
        <p style={{ color: "#64748B", marginTop: 8, fontSize: 17 }}>{error}</p>
      </div>
    </div>
  );

  // ─── SELESAI / QC FAIL ─────────────────────────────────────────────
  if (phase === "done" || info?.routeSelesai) {
    const isQcFail = nextStepInfo?.qcFail;
    const hasNext = nextStepInfo && !isQcFail;
    const isFullSelesai = !isQcFail && !hasNext;
    const batch = info?.batch;
    const steps: any[] = info?.steps ?? [];

    // Warna tema tiket
    const ticketColor = isQcFail ? "#EF4444" : isFullSelesai ? "#0F172A" : "#1D4ED8";
    const ticketAccent = isQcFail ? "#FCA5A5" : isFullSelesai ? "#10B981" : "#93C5FD";

    // Hitung kode item cacat (khusus QC Gagal)
    const defectCodes: {code: string; alasan: string}[] = [];
    if (isQcFail) {
      const defects: {size: string; jumlah_cacat: number; alasan: string}[] = nextStepInfo.defect_detail ?? [];
      const sbatch = batch?.size_breakdown ?? [];
      for (const d of defects) {
        const sz = sbatch.find((s: any) => s.size === d.size);
        const total = sz?.jumlah ?? 0;
        const start = total - d.jumlah_cacat + 1;
        for (let i = start; i <= total; i++) {
          defectCodes.push({ code: `${batch?.kode_batch}-${d.size}-${String(i).padStart(4,"0")}`, alasan: d.alasan });
        }
      }
    }

    return (
      <div style={{ minHeight: "100vh", background: "#E2E8F0", fontFamily: "Inter,system-ui,sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", overflowX: "hidden", width: "100%" }}>


        {/* ── BOARDING PASS CARD ── */}
        <div style={{ width: "100%", maxWidth: 480, boxShadow: "0 20px 40px rgba(0,0,0,0.18)", animation: "slideDown 0.9s cubic-bezier(0.16,1,0.3,1) both" }}>

          {/* ── TOP SECTION (header tiket) ── */}
          <div style={{ background: `linear-gradient(135deg, ${ticketColor} 0%, ${isQcFail ? "#7F1D1D" : isFullSelesai ? "#1E3A5F" : "#1E40AF"} 100%)`, borderRadius: "0 0 0 0", padding: "22px 20px 18px", color: "white", position: "relative", overflow: "hidden" }}>
            {/* Dekoratif lingkaran */}
            <div style={{ position: "absolute", top: -40, right: -40, width: 130, height: 130, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
            <div style={{ position: "absolute", bottom: -20, left: -20, width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />

            {/* Status badge */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.15)", borderRadius: 99, padding: "5px 14px", marginBottom: 16, fontSize: 12, fontWeight: 800, letterSpacing: 0.5 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: ticketAccent, display: "inline-block" }} />
              {isQcFail ? "QC GAGAL" : isFullSelesai ? "SELESAI • GUDANG" : "STEP SELESAI"}
            </div>

            {/* Kode batch besar */}
            <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: -1, marginBottom: 4 }}>
              {batch?.kode_batch ?? "—"}
            </div>
            <div style={{ fontSize: 14, opacity: 0.75, marginBottom: 20 }}>
              {batch?.jenis_kain} · {batch?.jumlah_pcs ?? 0} pcs
            </div>

            {/* Info row (FROM → TO style) */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.6, letterSpacing: 1, textTransform: "uppercase" }}>Mulai</div>
                <div style={{ fontSize: 18, fontWeight: 900 }}>
                  {steps[0] ? new Date(steps[0].mulai_waktu).toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) : "—"}
                </div>
              </div>
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.3)" }} />
                {steps.map((_: any, i: number) => (
                  <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(255,255,255,0.5)", flexShrink: 0 }} />
                ))}
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.3)" }} />
                <span style={{ fontSize: 18 }}>{isQcFail ? "⚠️" : isFullSelesai ? "🏭" : "✈️"}</span>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.6, letterSpacing: 1, textTransform: "uppercase" }}>Selesai</div>
                <div style={{ fontSize: 18, fontWeight: 900 }}>
                  {isFullSelesai
                    ? (steps[steps.length-1]?.selesai_waktu ? new Date(steps[steps.length-1].selesai_waktu).toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) : "—")
                    : isQcFail ? "CACAT" : "NEXT"}
                </div>
              </div>
            </div>
          </div>

          {/* ── PERFORATED DIVIDER ── */}
          <div style={{ background: "white", position: "relative", height: 28, display: "flex", alignItems: "center" }}>
            {/* Notch kiri */}
            <div style={{ position: "absolute", left: -18, width: 36, height: 36, borderRadius: "50%", background: "#E2E8F0", zIndex: 2 }} />
            {/* Garis putus-putus */}
            <div style={{ flex: 1, borderTop: "2px dashed #CBD5E1", margin: "0 22px" }} />
            {/* Notch kanan */}
            <div style={{ position: "absolute", right: -18, width: 36, height: 36, borderRadius: "50%", background: "#E2E8F0", zIndex: 2 }} />
          </div>

          {/* ── BOTTOM SECTION (detail tiket) ── */}
          <div style={{ background: "white", padding: "4px 18px 20px" }}>

            {/* QC Gagal — kode item merah */}
            {isQcFail && (
              <div style={{ marginBottom: 16, padding: "14px 16px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#991B1B", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  🔴 Kode Item Cacat — {nextStepInfo.totalCacat} pcs
                </div>
                {defectCodes.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
                    {defectCodes.map(({ code, alasan }) => (
                      <span key={code} title={alasan} style={{ fontSize: 11, background: "#EF4444", color: "white", padding: "3px 9px", borderRadius: 5, fontWeight: 700, fontFamily: "monospace" }}>
                        {code}
                      </span>
                    ))}
                  </div>
                )}
                {(nextStepInfo.defect_detail ?? []).filter((d: any) => d.jumlah_cacat > 0).map((d: any, i: number) => (
                  <div key={i} style={{ fontSize: 12, color: "#7F1D1D", marginTop: 2 }}>Size {d.size}: {d.jumlah_cacat} pcs — {d.alasan}</div>
                ))}
              </div>
            )}

            {/* Step berikutnya (hasNext) */}
            {hasNext && (
              <div style={{ marginBottom: 16, padding: "14px 16px", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#1E40AF", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>✈️ Diserahkan ke</div>
                <div style={{ fontWeight: 900, fontSize: 18, color: "#0F172A" }}>{nextStepInfo.vendor_nama}</div>
                <div style={{ fontSize: 14, color: "#3B82F6", marginTop: 2, fontWeight: 600 }}>{nextStepInfo.jenis_pekerjaan}</div>
                <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 6 }}>Scan QR yang sama untuk mulai step berikutnya.</div>
              </div>
            )}

            {/* Tombol Buat SPK Retur dihapus sesuai instruksi agar admin yang buat SPK */}

            {isQcFail && nextStepInfo.status === "reject-permanen" && (
              <div style={{ padding: "14px 16px", background: "#FEF2F2", borderRadius: 12, color: "#991B1B", fontWeight: 700, textAlign: "center", marginBottom: 16 }}>
                🚫 Sudah 2x gagal — Batch REJECT PERMANEN
              </div>
            )}

            {/* Daftar step */}
            <div style={{ fontSize: 11, fontWeight: 800, color: "#94A3B8", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>Riwayat Produksi</div>
            {steps.map((s: any, i: number) => (
              <div key={i} style={{ display: "flex", gap: 12, marginBottom: i < steps.length - 1 ? 12 : 0, padding: "10px 12px", background: s.status === "selesai" ? "#F0FDF4" : "#FAFAFA", borderRadius: 10, border: `1px solid ${s.status === "selesai" ? "#BBF7D0" : "#F1F5F9"}` }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: s.status === "selesai" ? "#10B981" : s.status === "berjalan" ? "#3B82F6" : "#E2E8F0", color: s.status === "menunggu" ? "#94A3B8" : "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 13, flexShrink: 0 }}>
                  {s.status === "selesai" ? "✓" : i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, color: "#0F172A" }}>{s.jenis_pekerjaan}</div>
                  <div style={{ fontSize: 12, color: "#64748B", marginTop: 1 }}>{s.vendor_nama}</div>
                  <div style={{ display: "flex", gap: 10, marginTop: 4, fontSize: 11, color: "#94A3B8", flexWrap: "wrap" }}>
                    {s.mulai_waktu && <span>🕐 {fmtDateTime(s.mulai_waktu)}</span>}
                    {s.selesai_waktu && <span>✅ {fmtDateTime(s.selesai_waktu)}</span>}
                  </div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 6, height: "fit-content", alignSelf: "flex-start", background: s.status === "selesai" ? "#DCFCE7" : "#F1F5F9", color: s.status === "selesai" ? "#065F46" : "#94A3B8" }}>
                  {s.status === "selesai" ? "✅" : "⏳"}
                </div>
              </div>
            ))}
          </div>

          {/* ── BARCODE STRIP (dekoratif) ── */}
          <div style={{ background: "#0F172A", borderRadius: "0 0 24px 24px", padding: "14px 28px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", gap: 2, flex: 1 }}>
              {Array.from({ length: 40 }).map((_, i) => (
                <div key={i} style={{ width: i % 3 === 0 ? 3 : i % 5 === 0 ? 1 : 2, background: "white", height: i % 4 === 0 ? 28 : 20, opacity: 0.7 + Math.random() * 0.3, borderRadius: 1 }} />
              ))}
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 9, color: "#64748B", letterSpacing: 0.5 }}>BATCH ID</div>
              <div style={{ fontSize: 11, color: "white", fontFamily: "monospace", fontWeight: 700 }}>{batch?.id?.toString().padStart(6,"0")}</div>
            </div>
          </div>
        </div>

        <style>{`
          @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
          @keyframes slideDown{
            0%   { transform: translateY(-110%); opacity: 0; }
            30%  { opacity: 0.4; }
            100% { transform: translateY(0);     opacity: 1; }
          }
        `}</style>
      </div>
    );
  }


  // ─── BELUM ADA STEP AKTIF ───────────────────────────────────────────
  if (!step) return (
    <div style={{ ...pageStyle, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "white", borderRadius: 20, padding: 40, maxWidth: 480, width: "100%", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}><Clock size={64} color="#94A3B8" /></div>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "16px 0 8px" }}>Menunggu Dimulai</h1>
        <p style={{ color: "#64748B" }}>Belum ada step aktif. Hubungi admin.</p>
      </div>
    </div>
  );

  // ─── HALAMAN UTAMA VENDOR ───────────────────────────────────────────
  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 500, margin: "0 auto" }}>
        {/* Header & Progress Bar Unified */}
        <div style={{ background: "white", borderRadius: 24, padding: "20px 24px", marginBottom: 14, boxShadow: "0 10px 30px rgba(0,0,0,0.05)" }}>
          {/* Header Internal */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid #F1F5F9" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ background: "#F1F5F9", width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#334155" }}><Shirt size={16} /></div>
              <div style={{ fontSize: 15, fontWeight: 900, color: "#1E293B", letterSpacing: -0.3 }}>
                {phase === "confirmed" ? "Sedang Dikerjakan" : "Tugas Vendor"}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 12, color: "#94A3B8", fontWeight: 700, fontFamily: "monospace" }}>
                {lastUpdated.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
              </div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#DCFCE7", color: "#065F46", fontSize: 10, fontWeight: 800, padding: "4px 8px", borderRadius: 99 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981", animation: "pulse 2s infinite" }} />
                LIVE
              </div>
            </div>
          </div>
          
          {/* Progress */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: 13, fontWeight: 700, color: "#64748B" }}>
            <span>Progress Produksi</span>
            <span style={{ color: "#10B981", fontWeight: 800 }}>{info.selesaiSteps} / {info.totalSteps} selesai</span>
          </div>
          <div style={{ height: 10, background: "#E2E8F0", borderRadius: 99, overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 99, background: "linear-gradient(90deg,#3B82F6,#10B981)", width: `${(info.selesaiSteps / info.totalSteps) * 100}%`, transition: "width 0.6s ease" }} />
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 14, flexWrap: "wrap" }}>
            {info.steps.map((s: any, i: number) => (
              <div key={i} style={{ flex: "1 0 auto", padding: "6px 12px", borderRadius: 10, background: s.status === "selesai" ? "#DCFCE7" : s.status === "berjalan" ? "#DBEAFE" : "#F1F5F9", fontSize: 11, fontWeight: 800, color: s.status === "selesai" ? "#065F46" : s.status === "berjalan" ? "#1E40AF" : "#94A3B8", textAlign: "center", border: s.status === "berjalan" ? "2px solid #3B82F6" : "2px solid transparent", transition: "all 0.4s" }}>
                <div style={{ display: "inline-flex", alignItems: "center", verticalAlign: "middle", marginRight: 4 }}>
                  {s.status === "selesai" ? <CheckCircle2 size={12} /> : s.status === "berjalan" ? <Loader2 size={12} className="animate-spin" /> : <Hourglass size={12} />}
                </div>
                {i + 1}. {s.jenis_pekerjaan.split(" ").slice(0, 2).join(" ")}
                {s.selesai_waktu && <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2, fontWeight: 600 }}>{fmtTime(s.selesai_waktu)}</div>}
              </div>
            ))}
          </div>
        </div>

        {/* Tugas aktif: Boarding Pass Style */}
        <div style={{ background: "white", borderRadius: 24, marginBottom: 14, boxShadow: "0 10px 40px rgba(0,0,0,0.06)", position: "relative", overflow: "hidden" }}>
          
          {/* Top Section */}
          <div style={{ padding: "20px 20px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 1.2 }}>
                Step {step.step_order} / {info.totalSteps}
              </div>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#1D4ED8", background: "#EFF6FF", padding: "4px 8px", borderRadius: 8, letterSpacing: 0.5 }}>
                QTY: {step.jumlah_barang} PCS
              </div>
            </div>
            
            <div style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", letterSpacing: -0.5, lineHeight: 1.1, marginBottom: 8 }}>
              {step.jenis_pekerjaan}
            </div>
            
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 13 }}>
              <span style={{ fontWeight: 800, color: "#334155" }}>{info.batch.kode_batch}</span>
              <span style={{ color: "#CBD5E1" }}>•</span>
              <span style={{ color: "#64748B", fontWeight: 600 }}>{info.batch.jenis_kain}</span>
            </div>
          </div>
          
          {/* Perforation Line (Dashed) */}
          <div style={{ position: "relative", height: 24, display: "flex", alignItems: "center", margin: "0 12px" }}>
            {/* Cutouts */}
            <div style={{ position: "absolute", left: -24, width: 24, height: 24, background: "#F8FAFC", borderRadius: "50%", boxShadow: "inset -2px 0 6px rgba(0,0,0,0.04)" }} />
            <div style={{ position: "absolute", right: -24, width: 24, height: 24, background: "#F8FAFC", borderRadius: "50%", boxShadow: "inset 2px 0 6px rgba(0,0,0,0.04)" }} />
            
            {/* Dashed line */}
            <div style={{ flex: 1, borderTop: "2px dashed #E2E8F0" }} />
          </div>

          {/* Bottom Section */}
          <div style={{ padding: "16px 20px 20px", background: "#FAFAF9" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* Mulai */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", marginBottom: 4, letterSpacing: 0.5 }}>Waktu Mulai</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#334155" }}>
                  {step.mulai_waktu ? fmtDateTime(step.mulai_waktu) : "-"}
                </div>
                {step.terima_waktu && (
                  <div style={{ fontSize: 11, color: "#64748B", marginTop: 4, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><Package size={12} /> Terima: {step.terima_waktu.split("T")[1].substring(0,5)}</div>
                )}
              </div>

              {/* Deadline */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", marginBottom: 4, letterSpacing: 0.5 }}>Deadline</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: step.deadline ? "#EF4444" : "#334155" }}>
                  {step.deadline ? fmtTgl(step.deadline) : "-"}
                </div>
              </div>
            </div>

            {/* Catatan */}
            {step.catatan && (
              <div style={{ marginTop: 16, padding: 12, background: "#FFF7ED", borderRadius: 12, border: "1px solid #FED7AA" }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#92400E", textTransform: "uppercase", marginBottom: 4, letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 4 }}><FileText size={12} /> Catatan Admin</div>
                <div style={{ fontSize: 13, color: "#451A03", lineHeight: 1.5, fontWeight: 600 }}>{step.catatan}</div>
              </div>
            )}
          </div>
        </div>

        {/* ─── INFO SPK DETAIL (selalu tampil) ─── */}
        {(() => {
          let sizes: any[] = info?.batch?.size_breakdown ?? [];
          let previousMissing = false;
          if (info?.previousStep?.size_diterima) {
            sizes = info.previousStep.size_diterima.map((s: any) => ({ size: s.size, jumlah: s.jumlah_diterima }));
            previousMissing = info.previousStep.selisih_terima > 0;
          }
          const expectedQty = sizes.reduce((sum: number, s: any) => sum + s.jumlah, 0) || (step?.jumlah_barang ?? info?.batch?.jumlah_pcs ?? 0);

          if (sizes.length === 0) return null;
            return (
              <>
                <div style={{ position: "relative" }}>
                <button
                  onClick={() => setShowDetailPopup(true)}
                  className="animate-attention"
                  style={{ width: "100%", background: previousMissing ? "#FEF2F2" : "#EEF2FF", border: previousMissing ? "1px solid #FECACA" : "1px solid #C7D2FE", borderRadius: 20, marginBottom: 14, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", textAlign: "left", position: "relative", boxShadow: "0 4px 12px rgba(0,0,0,0.03)", overflow: "hidden" }}
                >
                  {/* Cutouts on the top border */}
                  <div style={{ position: "absolute", top: -12, left: -12, width: 24, height: 24, background: "#F8FAFC", borderRadius: "50%", boxShadow: "inset -2px 0 6px rgba(0,0,0,0.04)" }} />
                  <div style={{ position: "absolute", top: -12, right: -12, width: 24, height: 24, background: "#F8FAFC", borderRadius: "50%", boxShadow: "inset 2px 0 6px rgba(0,0,0,0.04)" }} />

                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: previousMissing ? "#991B1B" : "#3730A3", display: "flex", alignItems: "center", gap: 8 }}>
                      <ClipboardList size={16} /> Detail SPK Batch
                    </div>
                    {previousMissing && (
                      <div style={{ fontSize: 11, color: "#DC2626", marginTop: 4, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}><AlertTriangle size={12} /> Ada barang hilang dari step sebelumnya!</div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <div style={{ background: previousMissing ? "#EF4444" : "#4F46E5", color: "white", padding: "4px 10px", borderRadius: 8, fontSize: 10, fontWeight: 800, animation: "pulse 2s infinite", boxShadow: previousMissing ? "0 4px 12px rgba(239, 68, 68, 0.3)" : "0 4px 12px rgba(79, 70, 229, 0.3)" }}>
                      {previousMissing ? "Cek barang hilang" : "Buka cek ukuran"}
                    </div>
                    <div style={{ fontSize: 13, color: previousMissing ? "#EF4444" : "#4F46E5", fontWeight: 800 }}>Lihat Detail →</div>
                  </div>
                </button>
              </div>

              {showDetailPopup && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setShowDetailPopup(false)}>
                  <style>{`
                    @keyframes slideUpDrawer {
                      from { transform: translateY(100%); }
                      to { transform: translateY(0); }
                    }
                  `}</style>
                  <div 
                    onClick={e => e.stopPropagation()}
                    style={{ background: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: "32px 24px 24px", width: "100%", maxWidth: 600, maxHeight: "85vh", overflowY: "auto", position: "relative", animation: "slideUpDrawer 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards", boxShadow: "0 -10px 40px rgba(0,0,0,0.1)" }}
                  >
                    {/* Handle pill (iOS style) */}
                    <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", width: 40, height: 4, borderRadius: 2, background: "#CBD5E1" }}></div>
                    <button onClick={() => setShowDetailPopup(false)} style={{ position: "absolute", top: 16, right: 16, background: "#F1F5F9", border: "none", borderRadius: "50%", width: 32, height: 32, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B", transition: "0.2s" }}>✕</button>
                    
                    <div style={{ fontWeight: 800, fontSize: 18, color: "#1E293B", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                      <ClipboardList size={20} /> Detail SPK Batch
                    </div>
                    
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20, background: "#F8FAFC", padding: 16, borderRadius: 12 }}>
                      <div>
                        <div style={{ fontSize: 12, color: "#64748B", marginBottom: 2 }}>Jenis Kain</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#1E293B" }}>{info.batch.jenis_kain}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: "#64748B", marginBottom: 2 }}>Kode Batch</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#1E293B" }}>{info.batch.kode_batch}</div>
                      </div>
                      <div style={{ gridColumn: "span 2" }}>
                        <div style={{ fontSize: 12, color: "#64748B", marginBottom: 2 }}>Total Expected</div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: "#1E293B" }}>{expectedQty} pcs</div>
                      </div>
                    </div>

                    {previousMissing && (
                      <div style={{ padding: 16, background: "#FEF2F2", borderRadius: 12, marginBottom: 20, border: "1px solid #FECACA" }}>
                        <div style={{ fontSize: 14, color: "#991B1B", fontWeight: 800, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                          <AlertTriangle size={16} /> Info dari step sebelumnya:
                        </div>
                        <div style={{ fontSize: 13, color: "#991B1B", marginBottom: 10 }}>
                          Step sebelumnya (<strong>{info.previousStep.jenis_pekerjaan}</strong> oleh vendor <strong>{info.previousStep.vendor_nama}</strong>) melaporkan ada barang yang hilang/kurang sebanyak <strong>{info.previousStep.selisih_terima} pcs</strong> saat barang ditransfer.
                        </div>
                        <div style={{ fontSize: 13, color: "#7F1D1D", fontWeight: 700, marginBottom: 4 }}>Detail barang yang hilang:</div>
                        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "#991B1B" }}>
                          {info.previousStep.size_diterima
                            .filter((s: any) => s.selisih > 0)
                            .map((s: any, idx: number) => (
                              <li key={idx} style={{ marginBottom: 4 }}>
                                <strong>Size {s.size}</strong>: Hilang {s.selisih} pcs <span style={{ opacity: 0.7 }}>(dari SPK awal {s.selisih + s.jumlah_diterima} pcs, hanya diterima {s.jumlah_diterima} pcs)</span>
                              </li>
                            ))}
                        </ul>
                        <div style={{ fontSize: 13, color: "#991B1B", marginTop: 10, fontStyle: "italic" }}>
                          Oleh karena itu, target penerimaan barang Anda di step ini telah disesuaikan menjadi {expectedQty} pcs.
                        </div>
                      </div>
                    )}

                    <div style={{ fontWeight: 700, fontSize: 14, color: "#64748B", marginBottom: 10 }}>Breakdown Size:</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {sizes.map((s: any, i: number) => (
                        <div key={i} style={{ background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: 12, padding: "12px", textAlign: "center" }}>
                          <div style={{ fontWeight: 900, fontSize: 16, color: "#0369A1", marginBottom: 2 }}>Size {s.size}</div>
                          <div style={{ fontSize: 14, color: "#64748B", fontWeight: 600 }}>{s.jumlah} pcs</div>
                          {(s.cacat ?? 0) > 0 && <div style={{ fontSize: 12, color: "#EF4444", fontWeight: 700, marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}><AlertCircle size={12} /> {s.cacat} cacat</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          );
        })()}

        {/* ─── ACTION BUTTONS ─── */}
        {phase === "scan" && (() => {
          let sizes: any[] = info?.batch?.size_breakdown ?? [];
          if (info?.previousStep?.size_diterima) {
            sizes = info.previousStep.size_diterima.map((s: any) => ({ size: s.size, jumlah: s.jumlah_diterima }));
          }
          const expectedQty = sizes.reduce((sum: number, s: any) => sum + s.jumlah, 0) || (step?.jumlah_barang ?? 0);

          // Hitung total & selisih dari sizeCountForm
          const totalDiterima = sizeCountForm.reduce((s, r) => s + (parseInt(r.jumlah_diterima) || 0), 0);
          const totalExpected = sizeCountForm.reduce((s, r) => s + r.jumlah_expected, 0);
          const totalSelisih = totalExpected - totalDiterima;
          const allFilled = sizeCountForm.length > 0 && sizeCountForm.every(r => r.jumlah_diterima !== "");
          const hasKurang = totalSelisih > 0;
          const hasLebih = totalSelisih < 0;
          const isMatch = allFilled && totalSelisih === 0;

          const isWajibHitung = step.vendor_wajib_hitung_ulang ?? false;

          if (!showCountForm) {
            return (
              <button onClick={async () => {
                  if (isWajibHitung) {
                    await fetch(`/api/spk/${token}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ aksi: "mulai-hitung" }),
                    });
                    // Init per-size form
                    if (sizes.length > 0) {
                      setSizeCountForm(sizes.map((s: any) => ({ size: s.size, jumlah_expected: s.jumlah, jumlah_diterima: "" })));
                    } else {
                      setSizeCountForm([{ size: "Umum", jumlah_expected: expectedQty, jumlah_diterima: "" }]);
                    }
                    setShowCountForm(true);
                  } else {
                    // Langsung bypass form hitung size
                    let autoSizes = [];
                    if (sizes.length > 0) {
                      autoSizes = sizes.map((s: any) => ({ size: s.size, jumlah_diterima: s.jumlah }));
                    } else {
                      autoSizes = [{ size: "Umum", jumlah_diterima: expectedQty }];
                    }
                    await doAction("terima", { size_diterima: autoSizes, jumlah_diterima: expectedQty, selisih_terima: 0 });
                  }
                }}
                disabled={submitting}
                style={{ width: "100%", background: "#1D4ED8", color: "white", border: "none", borderRadius: 20, padding: "20px", fontSize: 18, fontWeight: 900, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1, marginBottom: 12, boxShadow: "0 6px 20px rgba(29,78,216,0.35)", transition: "all 0.2s", position: "relative", borderTop: "2px dashed rgba(255,255,255,0.3)", overflow: "hidden" }}>
                {/* Cutouts on the top border */}
                <div style={{ position: "absolute", top: -12, left: -12, width: 24, height: 24, background: "#F8FAFC", borderRadius: "50%", boxShadow: "inset -2px 0 6px rgba(0,0,0,0.1)" }} />
                <div style={{ position: "absolute", top: -12, right: -12, width: 24, height: 24, background: "#F8FAFC", borderRadius: "50%", boxShadow: "inset 2px 0 6px rgba(0,0,0,0.1)" }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  {submitting ? "Memproses..." : isWajibHitung ? <><PackageCheck size={20} /> Terima & Hitung Barang</> : <><PackageCheck size={20} /> Konfirmasi Terima Barang</>}
                </div>
              </button>
            );
          }

          return (
            <div style={{ background: "white", borderRadius: 20, padding: 24, boxShadow: "0 4px 16px rgba(0,0,0,0.08)", marginBottom: 12 }}>
              <h2 style={{ fontSize: 18, fontWeight: 900, marginBottom: 4, color: "#1D4ED8", display: "flex", alignItems: "center", gap: 6 }}>
                <ClipboardCheck size={20} /> Hitung Barang per Size
              </h2>
              <p style={{ fontSize: 13, color: "#64748B", marginBottom: 20 }}>
                Hitung fisik setiap size. Total SPK: <strong>{expectedQty} pcs</strong>
              </p>

              {/* Per-size inputs */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                {sizeCountForm.map((row, i) => {
                  const val = parseInt(row.jumlah_diterima) || 0;
                  const sel = row.jumlah_expected - val;
                  const ok = row.jumlah_diterima !== "" && sel === 0;
                  const kurang = row.jumlah_diterima !== "" && sel > 0;
                  const lebih = row.jumlah_diterima !== "" && sel < 0;
                  return (
                    <div key={i} style={{ padding: "14px 16px", borderRadius: 14, border: `2px solid ${ok ? "#86EFAC" : kurang ? "#FECACA" : lebih ? "#FDE68A" : "#E2E8F0"}`, background: ok ? "#F0FDF4" : kurang ? "#FFF8F8" : "#FAFAFA" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                        <div>
                          <div style={{ fontWeight: 900, fontSize: 16, color: "#1E293B" }}>Size {row.size}</div>
                          <div style={{ fontSize: 12, color: "#64748B" }}>SPK: <strong>{row.jumlah_expected} pcs</strong></div>
                        </div>
                        {ok && <span style={{ color: "#065F46", fontWeight: 800, fontSize: 12, background: "#D1FAE5", padding: "4px 8px", borderRadius: 6, flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}><CheckCircle2 size={14} /> Sesuai</span>}
                        {kurang && <span style={{ color: "#991B1B", fontWeight: 800, fontSize: 12, background: "#FEE2E2", padding: "4px 8px", borderRadius: 6, flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}><AlertTriangle size={14} /> Kurang {sel} pcs</span>}
                        {lebih && <span style={{ color: "#92400E", fontWeight: 800, fontSize: 12, background: "#FEF3C7", padding: "4px 8px", borderRadius: 6, flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}><AlertTriangle size={14} /> Lebih {Math.abs(sel)} pcs</span>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <label style={{ fontSize: 13, color: "#64748B", whiteSpace: "nowrap", flexShrink: 0 }}>Diterima:</label>
                        <input type="number" min={0}
                          value={row.jumlah_diterima}
                          onChange={e => setSizeCountForm(prev => prev.map((r, j) => j === i ? { ...r, jumlah_diterima: e.target.value } : r))}
                          placeholder={`${row.jumlah_expected}`}
                          style={{ flex: 1, minWidth: 0, padding: "10px 14px", borderRadius: 10, border: `2px solid ${ok ? "#10B981" : kurang ? "#EF4444" : lebih ? "#F59E0B" : "#CBD5E1"}`, fontSize: 18, fontWeight: 900, outline: "none", textAlign: "center", color: ok ? "#065F46" : kurang ? "#EF4444" : "#1E293B", boxSizing: "border-box" }}
                        />
                        <span style={{ fontSize: 14, color: "#64748B", flexShrink: 0 }}>pcs</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Total summary */}
              {allFilled && (
                <div style={{ marginBottom: 16, padding: "14px 16px", borderRadius: 12,
                  background: isMatch ? "#F0FDF4" : hasKurang ? "#FEF2F2" : "#FFF7ED",
                  border: `1px solid ${isMatch ? "#86EFAC" : hasKurang ? "#FECACA" : "#FDE68A"}` }}>
                  <div style={{ fontSize: 14, fontWeight: 900, color: isMatch ? "#065F46" : hasKurang ? "#991B1B" : "#92400E", display: "flex", alignItems: "center", gap: 6 }}>
                    {isMatch ? <><CheckCircle2 size={16} /> Total sesuai! {totalDiterima} dari {totalExpected} pcs</> :
                     hasKurang ? <><AlertTriangle size={16} /> Total kurang {totalSelisih} pcs — diterima {totalDiterima} dari {totalExpected}</> :
                     <><AlertTriangle size={16} /> Total lebih {Math.abs(totalSelisih)} pcs — diterima {totalDiterima} dari {totalExpected}</>}
                  </div>
                  {hasKurang && <div style={{ fontSize: 12, color: "#B91C1C", marginTop: 4 }}>Selisih akan dicatat dalam laporan SPK.</div>}
                </div>
              )}

              {/* Buttons */}
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={async () => {
                    await fetch(`/api/spk/${token}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ aksi: "batal-hitung" }),
                    });
                    setShowCountForm(false);
                    setSizeCountForm([]);
                  }}
                  style={{ flex: 1, background: "#F1F5F9", color: "#64748B", border: "none", borderRadius: 14, padding: "14px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
                  ← Batal (Periksa Ulang)
                </button>
                <button
                  onClick={() => {
                    if (!allFilled) return alert("Isi jumlah diterima untuk semua size.");
                    const perSize = sizeCountForm.map(r => ({ size: r.size, jumlah_diterima: parseInt(r.jumlah_diterima) || 0, selisih: r.jumlah_expected - (parseInt(r.jumlah_diterima) || 0) }));
                    // Langsung konfirmasi — warning selisih sudah tampil di UI
                    doAction("terima", { jumlah_diterima: totalDiterima, selisih_terima: totalSelisih, size_diterima: perSize });
                  }}
                  disabled={submitting || !allFilled}
                  style={{ flex: 2, background: submitting ? "#93C5FD" : hasKurang ? "#EF4444" : "#1D4ED8", color: "white", border: "none", borderRadius: 14, padding: "14px", fontSize: 16, fontWeight: 900, cursor: submitting || !allFilled ? "not-allowed" : "pointer", boxShadow: "0 4px 12px rgba(29,78,216,0.3)", opacity: !allFilled ? 0.5 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  {submitting ? <><Loader2 size={18} className="animate-spin"/> Memproses...</> : hasKurang ? <><AlertTriangle size={18} /> Konfirmasi (kurang {totalSelisih} pcs)</> : isMatch ? <><PackageCheck size={18} /> Konfirmasi Terima Barang</> : <><AlertTriangle size={18} /> Konfirmasi (lebih {Math.abs(totalSelisih)} pcs)</>}
                </button>
              </div>
            </div>
          );
        })()}

        {phase === "confirmed" && (
          <div>
            {/* Status confirmed */}
            <div style={{ background: "#DCFCE7", borderRadius: 14, padding: 16, marginBottom: 14, border: "2px solid #86EFAC", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ color: "#16A34A", display: "flex" }}><CheckCircle2 size={24} /></div>
              <div>
                <div style={{ fontWeight: 800, color: "#065F46", fontSize: 16 }}>Barang Diterima — Sedang Dikerjakan</div>
                {step.terima_waktu && (
                  <div style={{ fontSize: 13, color: "#16A34A", marginTop: 2 }}>Terima: {fmtDateTime(step.terima_waktu)}</div>
                )}
              </div>
            </div>

            {!isFinishing ? (
              <button onClick={() => doAction("selesai")} disabled={submitting}
                style={{ width: "100%", background: submitting ? "#6EE7B7" : "#10B981", color: "white", border: "none", borderRadius: 20, padding: "20px", fontSize: 18, fontWeight: 900, cursor: submitting ? "not-allowed" : "pointer", boxShadow: "0 6px 20px rgba(16,185,129,0.35)", transition: "all 0.2s", position: "relative", borderTop: "2px dashed rgba(255,255,255,0.4)", overflow: "hidden" }}>
                {/* Cutouts on the top border */}
                <div style={{ position: "absolute", top: -12, left: -12, width: 24, height: 24, background: "#F8FAFC", borderRadius: "50%", boxShadow: "inset -2px 0 6px rgba(0,0,0,0.1)" }} />
                <div style={{ position: "absolute", top: -12, right: -12, width: 24, height: 24, background: "#F8FAFC", borderRadius: "50%", boxShadow: "inset 2px 0 6px rgba(0,0,0,0.1)" }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  {submitting ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle size={20} />}
                  {submitting ? "Memproses..." : "Selesai & Serahkan ke Berikutnya"}
                </div>
              </button>

            ) : !showQC ? (
              <button onClick={() => setShowQC(true)}
                style={{ width: "100%", background: "#10B981", color: "white", border: "none", borderRadius: 20, padding: "20px", fontSize: 18, fontWeight: 900, cursor: "pointer", boxShadow: "0 6px 20px rgba(16,185,129,0.35)", position: "relative", borderTop: "2px dashed rgba(255,255,255,0.4)", overflow: "hidden" }}>
                {/* Cutouts on the top border */}
                <div style={{ position: "absolute", top: -12, left: -12, width: 24, height: 24, background: "#F8FAFC", borderRadius: "50%", boxShadow: "inset -2px 0 6px rgba(0,0,0,0.1)" }} />
                <div style={{ position: "absolute", top: -12, right: -12, width: 24, height: 24, background: "#F8FAFC", borderRadius: "50%", boxShadow: "inset 2px 0 6px rgba(0,0,0,0.1)" }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Search size={20} /> Laporkan Hasil QC</div>
              </button>

            ) : !showDefectForm ? (
              /* Pilih: Lolos atau Gagal */
              <div style={{ background: "white", borderRadius: 20, padding: 24, boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
                <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 18, textAlign: "center" }}>Hasil Pemeriksaan QC?</h2>
                <button onClick={() => doAction("selesai")} disabled={submitting}
                  style={{ width: "100%", background: "#10B981", color: "white", border: "none", borderRadius: 14, padding: "20px", fontSize: 19, fontWeight: 800, cursor: "pointer", marginBottom: 12, boxShadow: "0 4px 12px rgba(16,185,129,0.3)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <CheckCircle2 size={22} /> QC Lolos — Semua OK
                </button>
                <button onClick={initDefectForm} disabled={submitting}
                  style={{ width: "100%", background: "#EF4444", color: "white", border: "none", borderRadius: 14, padding: "20px", fontSize: 19, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 12px rgba(239,68,68,0.3)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <XCircle size={22} /> Ada Cacat — Isi Detail
                </button>
              </div>

            ) : (
              /* Form detail cacat per size */
              <div style={{ background: "white", borderRadius: 20, padding: 24, boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
                <h2 style={{ fontSize: 18, fontWeight: 900, marginBottom: 4, color: "#EF4444", display: "flex", alignItems: "center", gap: 6 }}><ClipboardX size={20} /> Detail Cacat per Size</h2>
                <p style={{ fontSize: 13, color: "#64748B", marginBottom: 20 }}>
                  Isi jumlah item cacat untuk setiap size. Kosongkan (0) jika tidak ada cacat.
                </p>

                {defectForm.map((row, i) => (
                  <div key={i} style={{ marginBottom: 18, padding: "14px 16px", background: "#FFF8F8", borderRadius: 14, border: "1px solid #FECACA" }}>
                    {/* Size label + total */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                      <div style={{ fontWeight: 900, fontSize: 17, color: "#1E293B" }}>Size {row.size}</div>
                      <div style={{ fontSize: 12, color: "#94A3B8" }}>
                        Total SPK: {info?.batch?.size_breakdown?.find((s: any) => s.size === row.size)?.jumlah ?? "?"} pcs
                      </div>
                    </div>

                    {/* Input jumlah cacat */}
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 13, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 4 }}>
                        Jumlah cacat (pcs):
                      </label>
                      <input
                        type="number" min={0}
                        max={info?.batch?.size_breakdown?.find((s: any) => s.size === row.size)?.jumlah ?? 9999}
                        value={row.jumlah_cacat}
                        onChange={e => {
                          const v = Math.max(0, parseInt(e.target.value) || 0);
                          setDefectForm(f => f.map((r, j) => j === i ? { ...r, jumlah_cacat: v } : r));
                        }}
                        style={{ width: "100%", minWidth: 0, padding: "12px 14px", borderRadius: 10, border: "2px solid #FECACA", fontSize: 18, fontWeight: 800, outline: "none", color: row.jumlah_cacat > 0 ? "#EF4444" : "#94A3B8", boxSizing: "border-box" }}
                      />
                    </div>

                    {/* Alasan — hanya tampil jika ada cacat */}
                    {row.jumlah_cacat > 0 && (
                      <div>
                        <label style={{ fontSize: 13, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 4 }}>
                          Alasan cacat: <span style={{ color: "#EF4444" }}>*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="Contoh: Jahitan lepas, warna belang, lubang..."
                          value={row.alasan}
                          onChange={e => setDefectForm(f => f.map((r, j) => j === i ? { ...r, alasan: e.target.value } : r))}
                          style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "2px solid #FECACA", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                        />
                      </div>
                    )}
                  </div>
                ))}

                {/* Ringkasan */}
                {defectForm.some(d => d.jumlah_cacat > 0) && (
                  <div style={{ marginBottom: 16, padding: "12px 16px", background: "#FEF2F2", borderRadius: 12, border: "1px solid #FECACA" }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#991B1B", marginBottom: 6 }}>Ringkasan Cacat:</div>
                    {defectForm.filter(d => d.jumlah_cacat > 0).map((d, i) => (
                      <div key={i} style={{ fontSize: 13, color: "#7F1D1D" }}>
                        Size {d.size}: {d.jumlah_cacat} pcs — {d.alasan || "belum diisi"}
                      </div>
                    ))}
                    <div style={{ fontWeight: 900, fontSize: 16, color: "#EF4444", marginTop: 8, paddingTop: 8, borderTop: "1px solid #FECACA" }}>
                      Total: {defectForm.reduce((s, d) => s + d.jumlah_cacat, 0)} pcs cacat
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setShowDefectForm(false)}
                    style={{ flex: 1, background: "#F1F5F9", color: "#64748B", border: "none", borderRadius: 14, padding: "16px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
                    ← Kembali
                  </button>
                  <button onClick={submitDefect} disabled={submitting || !defectForm.some(d => d.jumlah_cacat > 0)}
                    style={{ flex: 2, background: submitting ? "#FCA5A5" : "#EF4444", color: "white", border: "none", borderRadius: 14, padding: "16px", fontSize: 16, fontWeight: 900, cursor: "pointer", boxShadow: "0 4px 12px rgba(239,68,68,0.3)", opacity: !defectForm.some(d => d.jumlah_cacat > 0) ? 0.5 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    {submitting ? <><Loader2 size={18} className="animate-spin" /> Memproses...</> : <><CheckCircle2 size={18} /> Konfirmasi Laporan Cacat</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}


        <p style={{ textAlign: "center", fontSize: 12, color: "#CBD5E1", marginTop: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
          <LinkIcon size={12} /> Link aktif selama proses berlangsung · Update otomatis tiap 4 detik
        </p>
      </div>

      {/* Scroll Down Indicator */}
      {showScrollIndicator && (phase === "scan" || phase === "confirmed") && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 9999, pointerEvents: "none" }}>
          <div style={{ animation: "bounce 2s infinite" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(30, 41, 59, 0.95)", backdropFilter: "blur(8px)", color: "white", padding: "12px 24px", borderRadius: 99, boxShadow: "0 10px 25px rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: 0.5, whiteSpace: "nowrap" }}>Scroll ke Bawah</span>
              <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: "50%", padding: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ChevronDown size={16} strokeWidth={3} />
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.3 } }
        @keyframes attention {
          0%, 100% { transform: translateX(0); }
          5% { transform: translateX(-2px) rotate(-1deg); }
          10% { transform: translateX(2px) rotate(1deg); }
          15% { transform: translateX(-2px) rotate(-1deg); }
          20% { transform: translateX(1px) rotate(0.5deg); }
          25% { transform: translateX(0); }
        }
        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-10px); }
          60% { transform: translateY(-5px); }
        }
        .animate-attention {
          animation: attention 3s ease-in-out infinite;
        }
        .animate-attention:hover {
          animation: none;
        }
      `}</style>
    </div>
  );
}
