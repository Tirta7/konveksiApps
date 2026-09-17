"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { RefreshCw, MapPin } from "lucide-react";

function fmtDT(str?: string) {
  if (!str) return "-";
  const d = new Date(str);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) +
    " " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}
function fmtWaktu(d: Date) {
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

type StepStatus = "selesai" | "berjalan" | "menunggu" | "reject";

function StepNode({ status, order, isLast }: { status: StepStatus; order: number; isLast: boolean }) {
  const bg = status === "selesai" ? "#10B981" : status === "berjalan" ? "#3B82F6" : status === "reject" ? "#EF4444" : "#F1F5F9";
  const border = status === "selesai" ? "#059669" : status === "berjalan" ? "#2563EB" : status === "reject" ? "#DC2626" : "#CBD5E1";
  const textColor = status === "menunggu" ? "#94A3B8" : "white";
  const lineColor = status === "selesai" ? "#10B981" : "#E2E8F0";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 44 }}>
      <div style={{
        width: 44, height: 44, borderRadius: "50%",
        background: bg, border: `3px solid ${border}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 900, fontSize: 15, color: textColor,
        boxShadow: status === "berjalan" ? "0 0 0 6px rgba(59,130,246,0.18)" : "0 2px 8px rgba(0,0,0,0.1)",
        zIndex: 2, flexShrink: 0, transition: "all 0.3s",
        animation: status === "berjalan" ? "nodePulse 2s ease-in-out infinite" : "none",
      }}>
        {status === "selesai" ? (
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path d="M4 10l4 4 8-8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ) : status === "reject" ? "✕" : order}
      </div>
      {!isLast && (
        <div style={{
          width: 3, flex: 1, minHeight: 24,
          background: lineColor, borderRadius: 2, margin: "4px 0",
          transition: "background 0.5s",
        }} />
      )}
    </div>
  );
}

function StepCard({ step, isLast }: { step: any; isLast: boolean }) {
  const status: StepStatus = step.status ?? "menunggu";
  const isDone = status === "selesai";
  const isActive = status === "berjalan";
  const isReject = status === "reject";
  const isCounting = isActive && !!step.mulai_hitung_waktu && !step.terima_waktu;
  const isReceived = isActive && !!step.terima_waktu;

  const borderColor = isDone ? "#10B981" : isActive ? "#3B82F6" : isReject ? "#EF4444" : "#E2E8F0";
  const bgColor = isDone ? "#F0FDF4" : isActive ? "#EFF6FF" : isReject ? "#FEF2F2" : "#FAFAFA";
  const statusLabel = isDone ? "Selesai" : isCounting ? "Menghitung" : isReceived ? "Dikerjakan" : isActive ? "Menunggu Konfirmasi" : isReject ? "Reject" : "Menunggu";
  const statusBg = isDone ? "#DCFCE7" : isCounting ? "#FEF3C7" : isActive ? "#DBEAFE" : isReject ? "#FEE2E2" : "#F1F5F9";
  const statusTxt = isDone ? "#065F46" : isCounting ? "#92400E" : isActive ? "#1E40AF" : isReject ? "#991B1B" : "#94A3B8";
  const icon = isDone ? "✅" : isCounting ? "🔢" : isActive ? "⚙️" : isReject ? "❌" : "⏳";

  return (
    <div style={{
      flex: 1, background: bgColor, border: `2px solid ${borderColor}`,
      borderRadius: 16, padding: "16px 18px",
      marginBottom: isLast ? 0 : 12,
      boxShadow: isActive ? "0 4px 20px rgba(59,130,246,0.12)" : "0 1px 4px rgba(0,0,0,0.04)",
      transition: "all 0.3s",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 }}>
            Step {step.step_order} &bull; {step.vendor_nama}
          </div>
          <div style={{ fontSize: 17, fontWeight: 900, color: "#0F172A", lineHeight: 1.2 }}>
            {step.jenis_pekerjaan}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: statusBg, color: statusTxt, borderRadius: 99, padding: "3px 11px", fontSize: 11, fontWeight: 800 }}>
            {icon} {statusLabel}
          </div>
          <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 3, fontWeight: 600 }}>{step.jumlah_barang} pcs</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12, padding: "9px 12px", background: "rgba(255,255,255,0.7)", borderRadius: 10, color: "#64748B" }}>
        <span>🕐 <strong style={{ color: "#334155" }}>Mulai:</strong> {step.mulai_waktu ? fmtDT(step.mulai_waktu) : <span style={{ color: "#CBD5E1" }}>Belum</span>}</span>
        {step.terima_waktu && (
          <span>📦 <strong style={{ color: "#334155" }}>Terima:</strong> {fmtDT(step.terima_waktu)}
            {step.jumlah_diterima !== undefined && (
              <span style={{ color: (step.selisih_terima ?? 0) !== 0 ? "#EF4444" : "#10B981", fontWeight: 700, marginLeft: 4 }}>
                ({step.jumlah_diterima}pcs{(step.selisih_terima ?? 0) !== 0 ? ` ⚠️${Math.abs(step.selisih_terima)}` : ""})
              </span>
            )}
          </span>
        )}
        {step.selesai_waktu
          ? <span>✅ <strong style={{ color: "#065F46" }}>Selesai:</strong> {fmtDT(step.selesai_waktu)}</span>
          : isActive && (
            <span style={{ fontWeight: 700, color: "#3B82F6", display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#3B82F6", display: "inline-block", animation: "nodePulse 1.5s infinite" }} />
              Berjalan...
            </span>
          )
        }
      </div>
      {step.catatan && (
        <div style={{ marginTop: 8, padding: "7px 11px", background: "#FFF7ED", borderRadius: 8, fontSize: 12, color: "#92400E", borderLeft: "3px solid #F59E0B" }}>
          📝 {step.catatan}
        </div>
      )}
    </div>
  );
}

function CircularProgress({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? done / total : 0;
  const r = 26, cx = 34, cy = 34;
  const circ = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: 68, height: 68, flexShrink: 0 }}>
      <svg width="68" height="68">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E2E8F0" strokeWidth={5} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#10B981" strokeWidth={5}
          strokeDasharray={`${circ * pct} ${circ}`}
          strokeDashoffset={circ * 0.25}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontWeight: 900, fontSize: 18, color: "#0F172A", lineHeight: 1 }}>{done}</div>
        <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700 }}>/{total}</div>
      </div>
    </div>
  );
}

export default function PetaPerjalananPage() {
  const [batches, setBatches] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [pulse, setPulse] = useState(false);
  const prevRef = useRef<string>("");
  const selIdRef = useRef<number | null>(null);

  // Lock parent scroll — make this page fully fixed
  useEffect(() => {
    const el = document.querySelector(".app-content") as HTMLElement;
    if (el) { el.style.overflow = "hidden"; el.style.padding = "0"; el.style.height = "100vh"; }
    return () => {
      if (el) { el.style.overflow = ""; el.style.padding = ""; el.style.height = ""; }
    };
  }, []);

  const loadBatches = useCallback(async () => {
    try {
      const res = await fetch("/api/batches", { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const d = await res.json();
      const serial = JSON.stringify(d);
      if (serial !== prevRef.current) {
        setPulse(true); setTimeout(() => setPulse(false), 600);
        prevRef.current = serial; setBatches(d);
        if (selIdRef.current) {
          const upd = d.find((b: any) => b.id === selIdRef.current);
          if (upd) setSelected(upd);
        }
      }
    } catch (err) {
      console.error("Error loadBatches:", err);
    } finally {
      setLastUpdated(new Date());
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (id: number) => {
    try {
      const res = await fetch(`/api/tracking?batchId=${id}`, { cache: "no-store" });
      setDetail(await res.json());
    } catch (err) {
      console.error("Error loadDetail:", err);
    }
  }, []);

  useEffect(() => { loadBatches(); const t = setInterval(loadBatches, 5000); return () => clearInterval(t); }, [loadBatches]);
  useEffect(() => {
    if (!selected) return;
    selIdRef.current = selected.id; loadDetail(selected.id);
    const t = setInterval(() => loadDetail(selected.id), 5000); return () => clearInterval(t);
  }, [selected?.id, loadDetail]);

  const done = (b: any) => (b.steps ?? []).filter((s: any) => s.status === "selesai").length;
  const tot = (b: any) => (b.steps ?? []).length;
  const SM: Record<string, { label: string; color: string; dot: string }> = {
    "dalam-proses": { label: "Dalam Proses", color: "#1E40AF", dot: "#3B82F6" },
    gudang: { label: "Di Gudang", color: "#065F46", dot: "#10B981" },
    reject: { label: "Reject", color: "#991B1B", dot: "#EF4444" },
    "bahan-mentah": { label: "Bahan Mentah", color: "#92400E", dot: "#F59E0B" },
  };

  return (
    <>
      <style>{`
        @keyframes nodePulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.65;transform:scale(0.93)}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        .bl:hover{background:#F8FAFC!important}
        .bl.sel{background:#EFF6FF!important;border-color:#3B82F6!important}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:99px}
      `}</style>

      <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#F1F5F9" }}>

        {/* ── LEFT: Batch List ── */}
        <div style={{ width: 264, flexShrink: 0, display: "flex", flexDirection: "column", background: "white", borderRight: "1px solid #E2E8F0" }}>
          {/* Header */}
          <div style={{ padding: "18px 16px 12px", borderBottom: "1px solid #F1F5F9", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
              <MapPin size={16} color="#3B82F6" />
              <span style={{ fontWeight: 900, fontSize: 15, color: "#0F172A" }}>Peta Perjalanan</span>
            </div>
            <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 10 }}>Lacak posisi batch secara realtime</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5, background: "#DCFCE7", color: "#065F46", fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 99 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#10B981", display: "inline-block", animation: "nodePulse 2s infinite" }} /> LIVE
              </span>
              <span style={{ fontSize: 10, color: "#94A3B8", display: "flex", alignItems: "center", gap: 3 }}>
                <RefreshCw size={9} style={{ animation: pulse ? "spin 0.5s linear" : "none" }} />
                {lastUpdated ? fmtWaktu(lastUpdated) : "--:--:--"}
              </span>
            </div>
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px" }}>
            {loading
              ? <div style={{ textAlign: "center", padding: 40, color: "#94A3B8", fontSize: 13 }}>⏳ Memuat...</div>
              : batches.length === 0
                ? <div style={{ textAlign: "center", padding: 40, color: "#94A3B8" }}><div style={{ fontSize: 28, marginBottom: 8 }}>📦</div><div style={{ fontSize: 12 }}>Belum ada batch</div></div>
                : batches.map(b => {
                  const sm = SM[b.status] ?? SM["dalam-proses"];
                  const isSel = selected?.id === b.id;
                  return (
                    <button key={b.id} className={`bl${isSel ? " sel" : ""}`}
                      onClick={() => setSelected(b)}
                      style={{ width: "100%", textAlign: "left", padding: "11px 13px", borderRadius: 10, border: `2px solid ${isSel ? "#3B82F6" : "#F1F5F9"}`, background: isSel ? "#EFF6FF" : "white", cursor: "pointer", marginBottom: 5, transition: "all 0.15s", display: "block" }}>
                      <div style={{ fontWeight: 800, fontSize: 12, color: "#0F172A", marginBottom: 1 }}>{b.kode_batch}</div>
                      <div style={{ fontSize: 10, color: "#94A3B8", marginBottom: 5 }}>{b.jenis_kain}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: sm.dot, display: "inline-block" }} />
                          <span style={{ fontSize: 10, fontWeight: 700, color: sm.color }}>{sm.label}</span>
                        </div>
                        {tot(b) > 0 && <span style={{ fontSize: 10, color: "#94A3B8", fontWeight: 600 }}>{done(b)}/{tot(b)}</span>}
                      </div>
                      {tot(b) > 0 && (
                        <div style={{ display: "flex", gap: 2, marginTop: 6 }}>
                          {(b.steps ?? []).map((s: any, i: number) => (
                            <div key={i} style={{ flex: 1, height: 3, borderRadius: 99, background: s.status === "selesai" ? "#10B981" : s.status === "berjalan" ? "#3B82F6" : "#E2E8F0", transition: "background 0.4s" }} />
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })
            }
          </div>
        </div>

        {/* ── RIGHT: Detail ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {!selected ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, color: "#94A3B8" }}>
              <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <MapPin size={32} color="#CBD5E1" />
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontWeight: 700, fontSize: 17, color: "#334155", marginBottom: 5 }}>Pilih Batch</div>
                <div style={{ fontSize: 13, color: "#94A3B8" }}>Klik batch di panel kiri untuk melihat jalur perjalanan</div>
              </div>
            </div>
          ) : (
            <>
              {/* Sticky header */}
              <div style={{ padding: "16px 24px", background: "white", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", gap: 18, flexShrink: 0 }}>
                <CircularProgress done={done(selected)} total={tot(selected)} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 900, fontSize: 20, color: "#0F172A" }}>{selected.kode_batch}</span>
                    {selected.is_retur && <span style={{ fontSize: 10, background: "#FEF3C7", color: "#92400E", borderRadius: 99, padding: "2px 9px", fontWeight: 800 }}>🔄 RETUR</span>}
                    <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 11px", borderRadius: 99, background: selected.route_selesai ? "#DCFCE7" : selected.status === "reject" ? "#FEE2E2" : "#DBEAFE", color: selected.route_selesai ? "#065F46" : selected.status === "reject" ? "#991B1B" : "#1E40AF" }}>
                      {selected.route_selesai ? "✅ Selesai — Di Gudang" : selected.status === "reject" ? "❌ REJECT" : `⚙️ Step ${selected.current_step}/${tot(selected)} berjalan`}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "#64748B", marginBottom: 8 }}>
                    {selected.jenis_kain}{selected.jumlah_pcs ? ` · ${selected.jumlah_pcs} pcs` : ""}{selected.jumlah_meter ? ` · ${selected.jumlah_meter}m` : ""}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, height: 7, background: "#E2E8F0", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 99, background: "linear-gradient(90deg,#3B82F6,#10B981)", width: `${tot(selected) > 0 ? (done(selected) / tot(selected)) * 100 : 0}%`, transition: "width 0.6s ease" }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B", whiteSpace: "nowrap" }}>{done(selected)}/{tot(selected)} selesai</span>
                  </div>
                </div>
              </div>

              {/* Scrollable body */}
              <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
                <div style={{ display: "grid", gridTemplateColumns: (selected.steps?.length ?? 0) > 0 ? "1fr 320px" : "1fr", gap: 20, alignItems: "start" }}>

                  {/* Route stepper */}
                  {(selected.steps?.length ?? 0) > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>Jalur Produksi</div>
                      {selected.steps.map((s: any, i: number) => (
                        <div key={i} style={{ display: "flex", gap: 14, alignItems: "stretch" }}>
                          <StepNode status={s.status} order={s.step_order} isLast={i === selected.steps.length - 1} />
                          <div style={{ flex: 1, paddingBottom: i < selected.steps.length - 1 ? 8 : 0, display: "flex", flexDirection: "column" }}>
                            <StepCard step={s} isLast={i === selected.steps.length - 1} />
                            {i < selected.steps.length - 1 && <div style={{ flex: 1, minHeight: 8 }} />}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Activity log */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>Riwayat Aktivitas</div>
                    <div style={{ background: "white", borderRadius: 14, border: "1px solid #E2E8F0", overflow: "hidden" }}>
                      {!detail?.logs?.length
                        ? <div style={{ padding: "28px 16px", textAlign: "center", color: "#94A3B8", fontSize: 12 }}>📋 Belum ada riwayat</div>
                        : <div style={{ padding: "14px 16px" }}>
                          {(detail.logs as any[]).slice().reverse().map((log: any, i: number, arr: any[]) => (
                            <div key={i} style={{ display: "flex", gap: 10, paddingBottom: i < arr.length - 1 ? 12 : 0 }}>
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#3B82F6", marginTop: 4 }} />
                                {i < arr.length - 1 && <div style={{ width: 1, flex: 1, background: "#E2E8F0", marginTop: 3 }} />}
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, fontSize: 12, color: "#1E293B", lineHeight: 1.4 }}>{log.keterangan}</div>
                                {log.vendor_nama && <div style={{ fontSize: 10, color: "#64748B", marginTop: 1 }}>📍 {log.vendor_nama}</div>}
                                <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 1 }}>{fmtDT(log.waktu)}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      }
                    </div>
                  </div>

                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
