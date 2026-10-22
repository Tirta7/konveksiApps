"use client";

import React, { useEffect, useState, useMemo } from "react";
import { transferStatusInfo } from "@/lib/transfer-status";
import { transferTargetStage, transferSourceStage, isGudangStage } from "@/lib/stage-resolve";
import { 
  Scissors, 
  Zap, 
  Droplets, 
  Filter, 
  Star, 
  Package, 
  CheckCircle, 
  ChevronRight, 
  RefreshCw, 
  AlertTriangle, 
  Calendar, 
  User, 
  Search, 
  RotateCcw, 
  ArrowRight, 
  Clock, 
  Layers, 
  FileText, 
  Truck, 
  Edit3, 
  CheckCircle2, 
  Send, 
  Eye, 
  X,
  Workflow,
  Sparkles,
  Building2,
  Check,
  ExternalLink,
  MessageCircle,
  Play,
  AlertOctagon
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import NotaRejectModal from "@/components/NotaRejectModal";
import { setPresence, subscribePresence, type PresenceEntry } from "@/lib/realtime-client";

const STAGE_ICON: Record<string, any> = {
  potong_kain: Scissors, potong_bahan: Scissors, potong: Scissors,
  jahit_kain: Zap, penjahit_kain: Zap, jahit: Zap, cmt: Zap,
  bersih_benang: Filter,
  wahing_pakaian: Droplets, washing_pakaian: Droplets, washing: Droplets, cuci: Droplets,
  finishing: Star, finishing_bahan: Star, packing: Package,
  qc_gudang: CheckCircle, qc_bahan: CheckCircle, qc: CheckCircle, gudang: Package,
};

const getIcon = (slug?: string) => {
  if (!slug) return Package;
  if (STAGE_ICON[slug]) return STAGE_ICON[slug];
  const s = slug.toLowerCase();
  if (s.includes("potong")) return Scissors;
  if (s.includes("jahit") || s.includes("cmt")) return Zap;
  if (s.includes("wash") || s.includes("cuci")) return Droplets;
  if (s.includes("benang")) return Filter;
  if (s.includes("qc")) return CheckCircle;
  return Package;
};

const STATUS_STYLE: Record<string, { bg: string; border: string; dot: string; text: string; label: string }> = {
  Menunggu:  { bg: "#F1F5F9", border: "#CBD5E1", dot: "#94A3B8", text: "#64748B", label: "Menunggu" },
  Proses:    { bg: "#EFF6FF", border: "#BFDBFE", dot: "#2563EB", text: "#1D4ED8", label: "Sedang Proses" },
  Dikerjakan: { bg: "#ECFDF5", border: "#A7F3D0", dot: "#10B981", text: "#059669", label: "Sedang Dikerjakan" },
  "Sedang Dikerjakan": { bg: "#ECFDF5", border: "#A7F3D0", dot: "#10B981", text: "#059669", label: "Sedang Dikerjakan" },
  "Menunggu ACC": { bg: "#FFFBEB", border: "#FCD34D", dot: "#F59E0B", text: "#B45309", label: "Menunggu ACC Admin" },
  Selesai:   { bg: "#ECFDF5", border: "#A7F3D0", dot: "#10B981", text: "#059669", label: "Selesai" },
  Terlambat: { bg: "#FEF2F2", border: "#FECACA", dot: "#EF4444", text: "#DC2626", label: "Terlambat" },
};


// Normalized stage slug helper
const normalizeStage = (slug?: string) => {
  const s = (slug || "").toLowerCase();
  if (s.includes("wash") || s.includes("cuci")) return "washing";
  if (s.includes("jahit") || s.includes("cmt")) return "cmt";
  if (s.includes("potong")) return "potong";
  if (s.includes("benang")) return "bersih_benang";
  if (s.includes("qc") || s.includes("gudang")) return "gudang";
  if (s.includes("pack") || s.includes("finishing")) return "finishing";
  return s;
};

const getStageDisplayName = (slug?: string) => {
  const norm = normalizeStage(slug);
  if (norm === "washing") return "Washing";
  if (norm === "cmt") return "Jahit";
  if (norm === "potong") return "Potong";
  if (norm === "bersih_benang") return "Bersih Benang";
  if (norm === "gudang") return "Gudang";
  if (norm === "finishing") return "Packing";
  return slug || "Pos";
};

// Radial Progress component matching vendor portal
function RadialProgress({
  pct,
  size = 54,
  stroke = 5,
  color = "#2563EB"
}: {
  pct: number;
  size?: number;
  stroke?: number;
  color?: string;
}) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const filled = circ * (1 - Math.min(Math.max(pct, 0), 100) / 100);
  const isComplete = pct >= 100;
  const c = isComplete ? "#10B981" : color;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E2E8F0" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={c}
          strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={filled}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: size <= 56 ? 11 : 13,
          fontWeight: 900,
          color: isComplete ? "#059669" : "#0F172A"
        }}
      >
        {pct}%
      </div>
    </div>
  );
}

export default function AlurProduksiPage() {
  const [stages, setStages] = useState<any[]>([]);
  // Nama/tahap transfer via resolver bersama (slug vs vendor_tipe tidak tertukar)
  const tfStageName = (t: any) => transferTargetStage(stages, t)?.nama || getStageDisplayName(t?.ke);
  const tfSourceName = (t: any) => transferSourceStage(stages, t)?.nama || getStageDisplayName(t?.dari);
  const tfIsGudang = (t: any) => isGudangStage(transferTargetStage(stages, t)) || normalizeStage(t?.ke) === "gudang" || t?.ke === "qc_bahan" || t?.ke === "siap_jual";
  const [poPipelines, setPoPipelines] = useState<any[]>([]);
  const [poProduksi, setPoProduksi] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [cmtProgres, setCmtProgres] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeStage, setActiveStage] = useState<number | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "Proses" | "Menunggu" | "Selesai">("all");
  const [filterVendor, setFilterVendor] = useState("all");
  const [sortBy, setSortBy] = useState<"no_po" | "most_qty" | "nearest_deadline">("no_po");
  const [cmtRequests, setCmtRequests] = useState<any[]>([]);

  // Modals
  const [statusModal, setStatusModal] = useState<{ po_id: number; stage_id: number; stageName: string; currentStatus: string; noPo: string } | null>(null);
  const [transferModal, setTransferModal] = useState<{ po: any; currentStage: any } | null>(null);
  const [transferForm, setTransferForm] = useState({
    ke_slug: "",
    vendor_id: "",
    jumlah_kirim: "",
    target_selesai: "",
    catatan: "",
    sumber_id: "" as string,              // id transfer asal ("po" = kuota PO langsung)
    sizes: {} as Record<string, string>,  // rincian per size yang dikirim
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [riskAck, setRiskAck] = useState(false);
  const [showAllVendors, setShowAllVendors] = useState(false);
  const [expandedVendorId, setExpandedVendorId] = useState<number | null>(null);
  // Realtime anti-bentrok
  const [conflict, setConflict] = useState<any | null>(null);       // respon 409 dari server (STALE / RESERVED)
  const [presenceList, setPresenceList] = useState<PresenceEntry[]>([]);
  const [liveNotice, setLiveNotice] = useState<{ text: string; tone: "warn" | "info"; at: number } | null>(null);
  const [notaRejectModal, setNotaRejectModal] = useState<any | null>(null);

  const handleOpenNotaReject = async (tf: any) => {
    try {
      const res = await fetch("/api/nota-reject");
      if (!res.ok) return;
      const json = await res.json();
      const list = json.data || [];
      const found = list.find((n: any) => n.no_nota === tf.no_nota_reject || String(n.transfer_id) === String(tf.id));
      if (found) {
        setNotaRejectModal(found);
      } else {
        toast.info(`Nota reject: ${tf.no_nota_reject || "Belum ada rincian"}`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try { 
      const res = await fetch("/api/po-pipeline/sync", { method: "POST" }); 
      if (res.ok) {
        toast.success("Pipeline berhasil disinkronkan!");
        await fetchAll(true);
      } else {
        toast.error("Gagal menyinkronkan pipeline");
      }
    } catch {
      toast.error("Terjadi kesalahan saat sinkronisasi");
    } finally {
      setSyncing(false);
    }
  };

  const fetchAll = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const [s, pp, po, v, cp, tf, cr] = await Promise.all([
        fetch("/api/pipeline-stages?_t=" + Date.now()).then(r => r.json()).catch(() => []),
        fetch("/api/po-pipeline?_t=" + Date.now()).then(r => r.json()).catch(() => []),
        fetch("/api/po-produksi?_t=" + Date.now()).then(r => r.json()).catch(() => []),
        fetch("/api/vendors?_t=" + Date.now()).then(r => r.json()).catch(() => []),
        fetch("/api/cmt-progres?_t=" + Date.now()).then(r => r.json()).catch(() => []),
        fetch("/api/produksi-transfer?_t=" + Date.now()).then(r => r.json()).catch(() => []),
        fetch("/api/cmt-request?_t=" + Date.now()).then(r => r.json()).catch(() => []),
      ]);
      const sorted = Array.isArray(s) ? s.filter((x: any) => x.aktif).sort((a: any, b: any) => a.urutan - b.urutan) : [];
      setStages(sorted);
      if (sorted.length > 0 && !activeStage) setActiveStage(sorted[0].id);
      setPoPipelines(Array.isArray(pp) ? pp : []);
      setPoProduksi(Array.isArray(po) ? po : []);
      setVendors(Array.isArray(v) ? v : []);
      setCmtProgres(Array.isArray(cp) ? cp : []);
      setTransfers(Array.isArray(tf) ? tf : []);
      setCmtRequests(Array.isArray(cr) ? cr : []);
    } catch (e) {
      toast.error("Gagal memuat data alur produksi");
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => { 
    fetchAll(false); 
    const handleSync = () => { 
      fetchAll(true); // Silent background reload, no blinking!
    };
    const handleRt = (e: any) => {
      const evt = e.detail?.event;
      if (["vendorWorking", "progressReported", "poolAllocated", "vendorRequest", "requestUpdated"].includes(evt)) {
        fetchAll(true);
      }
    };
    window.addEventListener("konveksi-sync", handleSync);
    window.addEventListener("konveksi-rt", handleRt);
    const unsubPresence = subscribePresence(setPresenceList);
    return () => { 
      window.removeEventListener("konveksi-sync", handleSync); 
      window.removeEventListener("konveksi-rt", handleRt); 
      unsubPresence(); 
    };
  }, []);

  // Auto-open transfer modal from notification link (e.g. ?po=1&sumber=6)
  useEffect(() => {
    if (poProduksi.length === 0 || stages.length === 0) return;
    try {
      const p = new URLSearchParams(window.location.search);
      const poParam = p.get("po");
      const sumberParam = p.get("sumber");
      const vendorParam = p.get("vendor");
      if (poParam) {
        const targetPo = poProduksi.find((x: any) => String(x.id) === String(poParam));
        if (targetPo) {
          const st = stages.find((s: any) => s.slug === targetPo.currentStage) || stages[0];
          openTransferModal(targetPo, st, sumberParam || undefined, vendorParam || undefined);
          window.history.replaceState({}, "", "/alur-produksi");
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poProduksi.length, stages.length]);

  // Presence: beri tahu vendor bahwa admin sedang membagikan stok PO ini
  const modalPoId = transferModal?.po?.id ?? null;
  const modalNoPo = transferModal?.po?.noPo ?? "";
  useEffect(() => {
    if (modalPoId == null) return;
    const key = `kirim:${modalPoId}`;
    const tid = transferForm.sumber_id && transferForm.sumber_id !== "po" ? Number(transferForm.sumber_id) : null;
    setPresence(key, { key, role: "admin", name: "Admin", action: "kirim", po_id: modalPoId, transfer_id: tid, label: `Admin sedang membagikan stok ${modalNoPo}` });
    return () => setPresence(key, null);
  }, [modalPoId, modalNoPo, transferForm.sumber_id]);

  // Event realtime (WebSocket) yang menyangkut PO di modal → refresh + tampilkan peringatan
  useEffect(() => {
    if (modalPoId == null) { setLiveNotice(null); setConflict(null); return; }
    const onRt = (e: any) => {
      const { event, data } = e.detail || {};
      if (!data) return;
      const samePo = data.po_id != null ? Number(data.po_id) === Number(modalPoId) : (data.no_po && data.no_po === modalNoPo);
      if (!samePo) return;
      if (event === "vendorRequest") {
        setLiveNotice({ tone: "warn", at: Date.now(), text: `${data.vendor_nama || "Vendor"} BARU SAJA meminta ${data.total || 0} pcs dari stok PO ini. Stok yang bisa dibagikan sudah diperbarui — periksa kembali sebelum mengirim.` });
        fetchAll(true);
      } else if (event === "poolAllocated") {
        setLiveNotice({ tone: "warn", at: Date.now(), text: `${data.by || "Admin lain"} baru saja mengalokasikan ${data.jumlah || 0} pcs ke ${data.ke || "pos lain"}. Sisa stok sumber: ${data.sisa ?? "-"} pcs.` });
        fetchAll(true);
      } else if (event === "progressReported" || event === "requestUpdated") {
        fetchAll(true);
      }
    };
    window.addEventListener("konveksi-rt", onRt);
    return () => window.removeEventListener("konveksi-rt", onRt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalPoId, modalNoPo]);

  const getPO = (id: number) => poProduksi.find(p => p.id === id);
  const getVendorName = (id?: any) => (id != null ? vendors.find(v => String(v.id) === String(id))?.nama : null) || "—";

  // Active Stage Object
  const activeStageObj = useMemo(() => {
    return stages.find(s => s.id === activeStage);
  }, [stages, activeStage]);

  // Distributions for a stage & PO
  const getActiveDistributions = (poId: number, stageSlug?: string) => {
    const sNorm = normalizeStage(stageSlug);
    const isJahitStage = sNorm === "cmt";
    const isPotongStage = sNorm === "potong";
    const po = getPO(poId);
    if (!po) return [];

    if (isJahitStage || isPotongStage) {
      if (po.vendorId) {
        const records = cmtProgres.filter(p => p.po_id === poId && !p.transfer_id);
        const lapor = records.reduce((s, r) => s + (r.items || []).reduce((ss: number, i: any) => ss + Number(i.jumlah || 0), 0), 0) || po.totalDilaporkan || 0;
        const acc = records.filter(p => p.status === "Diverifikasi" || p.status === "Diterima")
                           .reduce((s, r) => s + (r.items || []).reduce((ss: number, i: any) => ss + Number(i.jumlah || 0), 0), 0) || po.totalDisetujui || 0;
        return [{
           vendor_id: po.vendorId, 
           vendor_nama: getVendorName(po.vendorId),
           target_selesai: po.target_selesai,
           qty_total: po.jumlahTerbit,
           qty_lapor: lapor,
           qty_acc: acc,
           type: isJahitStage ? "jahit" : "potong_alokasi",
           status: acc >= po.jumlahTerbit ? "Selesai" : "Proses"
        }];
      }
      return [];
    }
    
    // Other stages: read from transfers matching normalized slug
    const relevantTf = transfers.filter(t => t.po_id === poId && normalizeStage(t.ke) === sNorm);
    return relevantTf.map(t => {
      const info = transferStatusInfo(t);
      return {
        vendor_id: t.vendor_id,
        vendor_nama: t.vendor_id == null ? "Standby (belum ada vendor)" : getVendorName(t.vendor_id),
        target_selesai: t.target_selesai,
        qty_total: t.jumlah_kirim,
        qty_lapor: (t.progress?.approved || 0) + (t.progress?.pending || 0),
        qty_acc: t.progress?.approved || 0,
        type: "transfer",
        status: info.label,
        info,
      };
    });
  };

  // Live status summary for a PO (CMT, Washing, per size)
  const getPoLiveStatus = (po: any) => {
    if (!po) return null;
    const vendorObj = vendors.find(v => v.id === po.vendorId) || po.vendor || null;
    const vendorNama = vendorObj?.nama || getVendorName(po.vendorId);
    const vendorKode = vendorObj?.kodeVendor || (po.vendorId ? "CMT-" + String(po.vendorId).padStart(3, "0") : "");
    const vendorKontak = vendorObj?.kontak || "";

    const totalTarget = Number(po.jumlahTerbit) || 0;
    const records = cmtProgres.filter(p => p.po_id === po.id && !p.transfer_id);
    const totalLapor = records.reduce((s, r) => s + (r.items || []).reduce((ss: number, i: any) => ss + Number(i.jumlah || 0), 0), 0) || po.totalDilaporkan || 0;
    const totalACC = records.filter(p => p.status === "Diverifikasi" || p.status === "Diterima")
                            .reduce((s, r) => s + (r.items || []).reduce((ss: number, i: any) => ss + Number(i.jumlah || 0), 0), 0) || po.totalDisetujui || 0;
    const sisaPcs = Math.max(0, totalTarget - totalLapor);
    const pct = totalTarget > 0 ? Math.round((totalLapor / totalTarget) * 100) : 0;
    const pctACC = totalTarget > 0 ? Math.round((totalACC / totalTarget) * 100) : 0;

    const sizeList = (po.sizeBreakdown || []).map((sb: any) => {
      const sizeName = sb.size;
      const targetQty = Number(sb.jumlah || sb.sisa || 0);
      const accQty = po.sizeProgress?.[sizeName] || 0;
      const pendingQty = po.sizePending?.[sizeName] || 0;
      const sDone = accQty;
      const isComplete = targetQty > 0 && sDone >= targetQty;
      const sPct = targetQty > 0 ? Math.round((sDone / targetQty) * 100) : 0;
      return {
        size: sizeName,
        target: targetQty,
        done: sDone,
        pending: pendingQty,
        pct: sPct,
        isComplete
      };
    });

    const washTransfers = transfers.filter(t => t.po_id === po.id && normalizeStage(t.ke) === "washing");
    const totalWashKirim = washTransfers.reduce((s, t) => s + (Number(t.jumlah_kirim) || 0), 0);

    const isWorking = po.status === "Dikerjakan" || !!po.mulai_kerja_at;
    const hasPendingAcc = records.some((r: any) => r.status === "Menunggu" || r.status === "Pending") || !!po.cmt_menunggu_acc;
    const isDone = totalTarget > 0 && totalACC >= totalTarget && sisaPcs === 0;

    // ── PROGRES NYATA PO (Termasuk Pos Lanjutan: Washing, Gudang, dll) ──
    const forwardedIds = new Set<number>();
    transfers.filter((t: any) => t.po_id === po.id).forEach((t: any) => {
      if (t.transfer_id_asal) forwardedIds.add(Number(t.transfer_id_asal));
      if (t.dari_transfer_id) forwardedIds.add(Number(t.dari_transfer_id));
    });

    const activeDownstream = transfers.filter((t: any) => {
      if (t.po_id !== po.id) return false;
      if (t.status === "Ditarik Penuh") return false;
      if (t.is_forwarded && Number(t.jumlah_kirim || 0) === 0) return false;
      if (forwardedIds.has(Number(t.id))) return false;
      return Number(t.jumlah_kirim || 0) > 0;
    });

    const isRejectTf = (t: any) =>
      t.status === "Reject" ||
      (Number(t.jumlah_reject || 0) > 0 && Number(t.jumlah_reject || 0) >= Number(t.jumlah_kirim || 0)) ||
      (Boolean(t.no_nota_reject) && Number(t.progress?.approved || t.jumlah_diterima || 0) <= 0);

    const isDoneTf = (t: any) =>
      !isRejectTf(t) && (t.status === "Selesai" || t.status === "Diverifikasi" || t.status === "Diterima");

    let effectivePct = pct;
    let effectiveSisa = sisaPcs;
    let effectiveStatus = isDone ? "Selesai" : isWorking ? "Dikerjakan" : "Proses";
    let effectiveLabel = sisaPcs > 0 ? `Sisa Jahit: ${sisaPcs.toLocaleString("id-ID")} pcs` : "Jahit Selesai (100%)";
    let isPipelineFullyDone = isDone && activeDownstream.length === 0;

    if (activeDownstream.length > 0) {
      // Ada pengerjaan pos lanjutan aktif di frontier (tanpa double counting antar pos)
      // Barang di Gudang yang sudah dipindah ke Gudang & Stok mengurangi jumlah_diterima → pakai nilai awal
      const approvedOf = (t: any) => {
        const isGudangTf = tfIsGudang(t);
        if (isGudangTf) return Number(t.jumlah_diterima_awal ?? t.jumlah_diterima ?? t.jumlah_kirim ?? 0);
        return Number(t.progress?.approved ?? t.jumlah_diterima ?? Math.max(0, Number(t.jumlah_kirim || 0) - Number(t.jumlah_reject || 0)));
      };
      const kirimOf = (t: any) => {
        const isGudangTf = tfIsGudang(t);
        return isGudangTf ? Math.max(Number(t.jumlah_kirim || 0), Number(t.jumlah_diterima_awal || 0)) : Number(t.jumlah_kirim || 0);
      };
      const rawKirim = activeDownstream.reduce((s: number, t: any) => s + kirimOf(t), 0);
      // Total PO adalah batas atas — mencegah angka melebihi PO (mis. 1.000 dari PO 500)
      const poBase = totalTarget > 0 ? totalTarget : rawKirim;
      const totalDownstreamKirim = Math.min(rawKirim, poBase);
      const totalDownstreamReject = activeDownstream.reduce((s: number, t: any) => s + (isRejectTf(t) ? Number(t.jumlah_kirim || 0) : Number(t.jumlah_reject || 0)), 0);
      const totalDownstreamSelesai = Math.min(poBase, activeDownstream.filter(isDoneTf).reduce((s: number, t: any) => s + approvedOf(t), 0));
      const totalDownstreamDikerjakan = Math.max(0, totalDownstreamKirim - totalDownstreamSelesai - totalDownstreamReject);
      const belumDikirim = Math.max(0, poBase - totalDownstreamKirim);
      // Persentase selalu terhadap TOTAL PO: 300 selesai dari PO 1.000 = 30%
      const downstreamPct = poBase > 0 ? Math.round((totalDownstreamSelesai / poBase) * 100) : 0;

      // Cari tahap lanjutan yang belum selesai (Dikerjakan / Kirim / Proses)
      const unfinishedTfs = activeDownstream.filter((t: any) => !isDoneTf(t) && !isRejectTf(t));
      if (unfinishedTfs.length > 0 || belumDikirim > 0) {
        effectiveSisa = totalDownstreamDikerjakan + belumDikirim;
        effectiveStatus = unfinishedTfs.some((t: any) => t.status === "Dikerjakan") ? "Dikerjakan" : "Kirim";

        const firstUnfinished = unfinishedTfs[0] || activeDownstream[activeDownstream.length - 1];
        const stageName = tfStageName(firstUnfinished);
        const isKeGudang = tfIsGudang(firstUnfinished);

        if (isKeGudang && unfinishedTfs.length > 0) {
          effectiveLabel = firstUnfinished.holding && firstUnfinished.vendor_id == null && firstUnfinished.status !== "Diverifikasi" && normalizeStage(firstUnfinished.ke) !== "gudang"
            ? `Gudang: Siap Masuk Stok (${totalDownstreamKirim.toLocaleString("id-ID")} pcs)`
            : `Gudang: Menunggu Verifikasi Terima (${totalDownstreamKirim.toLocaleString("id-ID")} pcs)`;
          effectivePct = totalDownstreamSelesai > 0 ? downstreamPct : 90;
        } else {
          const actionLabel = firstUnfinished.status === "Kirim" ? "dikirim" : "dikerjakan";
          const rejectSub = totalDownstreamReject > 0 ? ` (${totalDownstreamReject.toLocaleString("id-ID")} pcs reject)` : "";
          const parts = [`${stageName}: ${totalDownstreamSelesai.toLocaleString("id-ID")}/${poBase.toLocaleString("id-ID")} pcs (${downstreamPct}%)${rejectSub}`];
          if (totalDownstreamDikerjakan > 0) parts.push(`Sisa ${totalDownstreamDikerjakan.toLocaleString("id-ID")} pcs ${actionLabel}`);
          if (belumDikirim > 0) parts.push(`${belumDikirim.toLocaleString("id-ID")} pcs belum dikirim dari pos sebelumnya`);
          effectiveLabel = parts.join(" • ");
          effectivePct = downstreamPct;
        }
        isPipelineFullyDone = false;
      } else {
        // Semua transfer pos lanjutan berstatus Selesai / Diverifikasi
        const hasGudang = activeDownstream.some((t: any) => tfIsGudang(t));
        if (hasGudang) {
          effectivePct = 100;
          effectiveSisa = 0;
          effectiveStatus = "Selesai";
          effectiveLabel = "Lengkap Masuk Gudang (100%)";
          isPipelineFullyDone = true;
        } else {
          const lastTf = activeDownstream[activeDownstream.length - 1];
          const stageName = tfStageName(lastTf);
          effectivePct = downstreamPct;
          effectiveSisa = 0;
          effectiveStatus = "Selesai";
          effectiveLabel = `${stageName} Selesai (100%) • Menunggu Pos Berikutnya`;
          isPipelineFullyDone = false;
        }
      }
    }

    // ── RINCIAN POSISI BARANG (agar jelas barang ada di mana saja) ──
    const poTfs = transfers.filter((t: any) => t.po_id === po.id);
    const masukStok = poTfs.reduce((s: number, t: any) => s + Number(t.stocked_qty || 0), 0);
    let rejectQty = 0;
    const diVendorList: { nama: string; tahap: string; qty: number; status: string }[] = [];
    const menungguList: { tahap: string; qty: number; ket: string }[] = [];
    for (const t of poTfs) {
      if (t.status === "Ditarik Penuh" || t.status === "Ditolak") continue;
      if (isRejectTf(t)) { rejectQty += Number(t.jumlah_reject || t.jumlah_kirim || 0); continue; }
      rejectQty += Number(t.jumlah_reject || 0) + Number(t.reject_qty || 0);
      const kirim = Number(t.jumlah_kirim || 0);
      const isGudangTf = tfIsGudang(t);
      if (t.vendor_id != null) {
        if (t.is_forwarded || !["Kirim", "Proses", "Dikerjakan"].includes(t.status)) continue;
        const qty = Math.max(0, kirim - Number(t.progress?.approved || 0) - Number(t.jumlah_reject || 0));
        if (qty > 0) diVendorList.push({ nama: getVendorName(t.vendor_id), tahap: tfStageName(t), qty, status: t.status === "Kirim" ? "baru dikirim, belum mulai" : "sedang dikerjakan" });
      } else if (!t.is_forwarded) {
        if (isGudangTf) {
          const qty = t.status === "Diverifikasi" ? Number(t.jumlah_diterima ?? kirim) : kirim;
          const ket = t.status === "Diverifikasi"
            ? "sudah dicek, belum dimasukkan ke Gudang & Stok"
            : t.holding ? `hasil ${tfSourceName(t)} — siap dimasukkan ke Gudang & Stok` : "menunggu verifikasi terima";
          if (qty > 0) menungguList.push({ tahap: "Gudang", qty, ket });
        } else if (kirim > 0) {
          menungguList.push({ tahap: tfStageName(t), qty: kirim, ket: `standby — hasil ${tfSourceName(t)} belum dikirim ke vendor ${tfStageName(t)}` });
        }
      }
    }
    const diVendorQty = diVendorList.reduce((s, x) => s + x.qty, 0);
    const menungguQty = menungguList.reduce((s, x) => s + x.qty, 0);
    const terhitung = masukStok + rejectQty + diVendorQty + menungguQty;
    const posisi = {
      total: totalTarget,
      masukStok,
      reject: rejectQty,
      diVendor: diVendorQty,
      diVendorList,
      menunggu: menungguQty,
      menungguList,
      belum: Math.max(0, totalTarget - terhitung),
      selisihLebih: Math.max(0, terhitung - totalTarget),
    };

    return {
      posisi,
      vendorObj,
      vendorNama,
      vendorKode,
      vendorKontak,
      totalTarget,
      totalLapor,
      totalACC,
      sisaPcs,
      pct,
      pctACC,
      sizeList,
      washTransfers,
      totalWashKirim,
      isWorking,
      hasPendingAcc,
      isDone,
      mulaiKerjaAt: po.mulai_kerja_at || null,
      effectivePct,
      effectiveSisa,
      effectiveStatus,
      effectiveLabel,
      isPipelineFullyDone,
      activeDownstream,
      allPoTransfers: transfers.filter((t: any) => t.po_id === po.id && Number(t.jumlah_kirim) > 0 && t.status !== "Ditarik Penuh")
    };
  };

  // Fixed Tertandon calculation (Tahap 1 / Potong tidak ada tahap sebelumnya!)
  const getTertandon = (poId: number, stageObj: any) => {
    if (!stageObj) return 0;
    const po = getPO(poId);
    if (!po) return 0;
    
    // TAHAP 1 (Potong) TIDAK PERNAH TERTANDON DI TAHAP SEBELUMNYA!
    if (stageObj.urutan === 1 || (stageObj.slug || "").toLowerCase().includes("potong")) {
       return 0;
    }

    const sLower = (stageObj.slug || "").toLowerCase();
    const isJahitStage = sLower.includes("jahit") || sLower.includes("cmt");
    if (isJahitStage) {
       // Pada jahit/CMT, jika belum didistribusikan dari potongan
       return 0;
    }

    // Untuk tahap setelah jahit (washing, bersih benang, dll)
    const forwarded = transfers.filter(t => t.po_id === poId && normalizeStage(t.ke) === normalizeStage(stageObj.slug)).reduce((s, t) => s + Number(t.jumlah_kirim), 0);
    return Math.max(0, po.jumlahTerbit - forwarded);
  };

  const posForStage = (stageId: number) =>
    poPipelines
      .filter(pip => pip.stages?.find((s: any) => s.stage_id === stageId && s.aktif))
      .map(pip => ({ ...pip, stageEntry: pip.stages.find((s: any) => s.stage_id === stageId) }));

  const countFor = (stageId: number, status: string) =>
    posForStage(stageId).filter(p => (p.stageEntry?.status || "Menunggu") === status).length;

  function fmtDate(str?: string) {
    if (!str) return "-";
    return new Date(str).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const isOverdue = (t?: string) => {
    if (!t) return false;
    const targetDate = new Date(t);
    targetDate.setHours(0, 0, 0, 0);
    const graceDate = new Date(targetDate);
    graceDate.setDate(graceDate.getDate() + 1); // 1 hari toleransi
    return today > graceDate;
  };
  const overdueDays = (t?: string) => {
    if (!t) return 0;
    const targetDate = new Date(t);
    targetDate.setHours(0, 0, 0, 0);
    const graceDate = new Date(targetDate);
    graceDate.setDate(graceDate.getDate() + 1);
    if (today <= graceDate) return 0;
    const diff = today.getTime() - graceDate.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };
  const remainingDays = (t?: string) => {
    if (!t) return 0;
    const targetDate = new Date(t);
    targetDate.setHours(0, 0, 0, 0);
    const diff = targetDate.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const daysSince = (t?: string) => {
    if (!t) return null;
    const d = new Date(t); d.setHours(0, 0, 0, 0);
    return Math.max(0, Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)));
  };

  // Map pipeline stage slug -> vendor tipe yang cocok
  const stageVendorType = (slug?: string): string | null => {
    const s = (slug || "").toLowerCase();
    if (s.includes("wash") || s.includes("wahing") || s.includes("cuci")) return "washing";
    if (s.includes("jahit") || s.includes("cmt")) return "cmt";
    if (s.includes("benang")) return "benang";
    if (s.includes("finish") || s.includes("qc") || s.includes("pack")) return "finishing";
    return null;
  };
  const stageNameBySlug = (slug?: string) => stages.find(s => s.slug === slug)?.nama || slug || "-";

  // Cocokkan nilai tahap (slug pipeline / vendor tipe seperti "washing", "finishing") ke stage pipeline
  const resolveStage = (v?: string) => {
    if (!v) return null;
    return stages.find(s => s.vendor_tipe && s.vendor_tipe === v)
      || stages.find(s => s.slug === v)
      || stages.find(s => normalizeStage(s.slug) === normalizeStage(v))
      || null;
  };

  // Daftar "barang yang bisa dikirim" untuk 1 PO — tiap sumber jelas asalnya (tahap + vendor) & rincian size
  const getTransferSources = (poId: number) => {
    const out: any[] = [];
    for (const t of transfers) {
      if (t.po_id !== poId) continue;
      let kind = "";
      let sizes: any[] = [];
      let total = 0;
      if (t.holding && t.holding.kind !== "siap_jual") {
        kind = t.holding.kind; sizes = t.holding.sizes || []; total = Number(t.holding.total || 0);
      } else if (t.vendor_id == null && !t.holding && !t.is_forwarded && t.status !== "Ditarik Penuh" && Number(t.jumlah_kirim || 0) > 0 && normalizeStage(t.dari) === "cmt") {
        kind = "pool"; sizes = t.sizeBreakdown || []; total = Number(t.jumlah_kirim || 0);
      } else continue;
      if (total <= 0) continue;
      const isPool = kind === "pool";
      const fromVal = isPool ? t.dari : t.ke;
      const fromStage = resolveStage(fromVal);
      const asalVendorId = isPool ? t.dari_vendor_id : t.vendor_id;
      const asalVendor = asalVendorId != null ? getVendorName(asalVendorId) : null;
      const tujuanStage = isPool ? resolveStage(t.ke) : (fromStage ? stages.find(s => s.urutan > fromStage.urutan) : null);
      const statusText = kind === "gudang"
        ? "Stok Gudang Produksi · sudah diverifikasi"
        : kind === "vendor_acc"
          ? "Selesai · sudah di-ACC admin"
          : `Selesai · di-ACC admin · standby${tujuanStage ? ` untuk ${tujuanStage.nama}` : ""}`;
      out.push({
        id: String(t.id),
        transfer: t,
        kind,
        sizes,
        total,
        fromSlug: fromStage?.slug || fromVal,
        fromNama: kind === "gudang" ? "Gudang Produksi" : (fromStage?.nama || fromVal || "-"),
        fromUrutan: fromStage?.urutan || 0,
        asalVendor,
        asalVendorId,
        dariTransferId: t.dari_transfer_id ?? null,
        tujuanSlug: tujuanStage?.slug || "",
        statusText,
        tanggal: t.tanggal_kirim,
      });
    }
    return out.sort((a, b) => a.fromUrutan - b.fromUrutan || String(a.tanggal).localeCompare(String(b.tanggal)));
  };

  // Barang hasil pekerjaan vendor (transfer) yang sudah siap dikirim lagi
  const getReadyFromJob = (tf: any) => {
    if (tf.vendor_id == null) return [];
    return getTransferSources(tf.po_id).filter(s =>
      s.transfer.id === tf.id ||
      (s.dariTransferId != null ? String(s.dariTransferId) === String(tf.id)
        : (s.kind === "pool" && s.asalVendorId === tf.vendor_id && normalizeStage(s.transfer.dari) === normalizeStage(tf.ke)))
    );
  };

  const sizesToForm = (sizes: any[]) => {
    const m: Record<string, string> = {};
    for (const s of sizes || []) if (Number(s.jumlah) > 0) m[String(s.size)] = String(s.jumlah);
    return m;
  };

  // Vendor Workload & Capacity Analysis (Kapasitas & Status Barang Belum Selesai)
  const getVendorWorkload = (vendorId: number) => {
    const vendor = vendors.find(v => v.id === vendorId);
    if (!vendor) return null;

    // PO jahit yang ditugaskan langsung ke vendor ini (CMT)
    const activePOs = poProduksi.filter(p => p.vendorId === vendorId && !p.cmt_selesai && p.status !== "Selesai" && p.status !== "Pipeline Selesai" && p.status !== "Closed");
    // Transfer ke vendor ini yang masih dikerjakan (washing, benang, dll)
    const activeTransfers = transfers.filter(t => t.vendor_id === vendorId && (t.status === "Proses" || t.status === "Dikerjakan" || t.status === "Kirim"));

    const items: any[] = [];

    for (const po of activePOs) {
      const records = cmtProgres.filter(p => p.po_id === po.id && !p.transfer_id && (!po.vendorId || p.vendor_id === po.vendorId) && p.status !== "Ditolak");
      const sumItems = (arr: any[]) => arr.reduce((s, r) => s + (r.items || []).reduce((ss: number, i: any) => ss + Number(i.jumlah || 0), 0), 0);
      const acc = sumItems(records.filter(p => p.status === "Diverifikasi" || p.status === "Diterima"));
      const lapor = sumItems(records);
      const lastReport = records.map(r => r.tanggal || r.createdAt).filter(Boolean).sort().pop();
      const sisa = Math.max(0, (po.jumlahTerbit || 0) - acc);
      if (sisa <= 0) continue;
      const targetDate = po.target_selesai || null;
      items.push({
        key: `po-${po.id}`,
        poId: po.id,
        noPo: po.noPo,
        model: po.model,
        tahap: "Jahit / CMT",
        tanggal_kirim: po.tanggalTerbit,
        lamaHari: daysSince(po.tanggalTerbit),
        lastReport,
        lastReportDays: daysSince(lastReport),
        totalPcs: po.jumlahTerbit,
        selesaiPcs: acc,
        dilaporPcs: lapor,
        sisaPcs: sisa,
        progressPct: po.jumlahTerbit > 0 ? Math.round((acc / po.jumlahTerbit) * 100) : 0,
        target_selesai: targetDate,
        isOverdue: po.cmt_is_overdue ?? isOverdue(targetDate),
        overdueDays: po.cmt_late_days ?? overdueDays(targetDate),
        sisaHari: targetDate ? remainingDays(targetDate) : null,
        status: lapor > acc ? (lapor >= (po.jumlahTerbit || 0) ? "Menunggu ACC Admin" : `Sebagian Menunggu ACC (${(lapor - acc).toLocaleString("id-ID")} pcs)`) : acc > 0 ? "Sedang dijahit · setor bertahap" : "Sedang dikerjakan · belum ada laporan",
      });
    }

    for (const t of activeTransfers) {
      if (activePOs.find(p => p.id === t.po_id) && stageVendorType(t.ke) === "cmt") continue;
      const po = getPO(t.po_id);
      const diterima = Number(t.progress?.approved ?? t.jumlah_diterima ?? 0);
      const dilapor = diterima + Number(t.progress?.pending || 0);
      const sisa = Math.max(0, (t.jumlah_kirim || 0) - diterima);
      if (sisa <= 0) continue;
      const targetDate = t.target_selesai || po?.target_selesai || null;
      items.push({
        key: `tf-${t.id}`,
        poId: t.po_id,
        noPo: po?.noPo || `PO #${t.po_id}`,
        model: po?.model || "-",
        tahap: stageNameBySlug(t.ke),
        tanggal_kirim: t.tanggal_kirim,
        lamaHari: daysSince(t.tanggal_kirim),
        lastReport: t.tanggal_terima || null,
        lastReportDays: daysSince(t.tanggal_terima),
        totalPcs: t.jumlah_kirim,
        selesaiPcs: diterima,
        dilaporPcs: dilapor,
        sisaPcs: sisa,
        progressPct: t.jumlah_kirim > 0 ? Math.round((diterima / t.jumlah_kirim) * 100) : 0,
        target_selesai: targetDate,
        isOverdue: isOverdue(targetDate),
        overdueDays: overdueDays(targetDate),
        sisaHari: targetDate ? remainingDays(targetDate) : null,
        status: transferStatusInfo(t).label,
      });
    }

    items.sort((a, b) => (b.overdueDays - a.overdueDays) || (b.sisaPcs - a.sisaPcs));

    const totalPcsAssigned = items.reduce((s, i) => s + (i.totalPcs || 0), 0);
    const totalPcsUnfinished = items.reduce((s, i) => s + i.sisaPcs, 0);
    const overdueItems = items.filter(i => i.isOverdue);
    const overdueCount = overdueItems.length;
    const overduePcs = overdueItems.reduce((s, i) => s + i.sisaPcs, 0);
    const hasOverdue = overdueCount > 0;
    const maxOverdueDays = items.reduce((max, p) => Math.max(max, p.overdueDays), 0);
    const avgProgress = items.length ? Math.round(items.reduce((s, i) => s + i.progressPct, 0) / items.length) : 100;
    const nearDeadline = items.filter(i => !i.isOverdue && i.sisaHari !== null && i.sisaHari <= 3).length;

    // Skor kelayakan 0 - 100
    let score = 100;
    score -= overdueCount * 15;
    score -= Math.min(40, maxOverdueDays);
    score -= Math.min(25, Math.floor(totalPcsUnfinished / 80));
    score -= nearDeadline * 5;
    score = Math.max(0, Math.min(100, score));

    let capacityLevel: "safe" | "medium" | "overloaded" = "safe";
    let capacityLabel = "Siap Terima Order";
    let recommendation = "Direkomendasikan";
    const reasons: string[] = [];

    if (hasOverdue) reasons.push(`${overdueCount} pekerjaan lewat target (terparah +${maxOverdueDays} hari, ${overduePcs.toLocaleString("id-ID")} pcs tertahan)`);
    if (nearDeadline > 0) reasons.push(`${nearDeadline} pekerjaan mendekati dateline (≤ 3 hari)`);
    if (totalPcsUnfinished > 0) reasons.push(`Masih memegang ${totalPcsUnfinished.toLocaleString("id-ID")} pcs barang Anda yang belum selesai`);
    const stale = items.filter(i => i.lastReportDays === null || (i.lastReportDays ?? 0) > 7);
    if (stale.length > 0) reasons.push(`${stale.length} pekerjaan tanpa update progres > 7 hari`);

    if (score < 50) {
      capacityLevel = "overloaded"; capacityLabel = "Beban Berat / Bermasalah"; recommendation = "Tidak Disarankan";
    } else if (score < 80 || totalPcsUnfinished > 0) {
      capacityLevel = "medium"; capacityLabel = "Beban Sedang"; recommendation = "Bisa, dengan Catatan";
    }

    const capacityNote = capacityLevel === "safe"
      ? "Vendor tidak memiliki tanggungan barang tertunda dan siap memproses pekerjaan baru."
      : capacityLevel === "medium"
        ? "Vendor masih mampu menerima order, namun pantau progres pekerjaan yang sedang berjalan."
        : "Vendor sedang bermasalah. Selesaikan / tagih pekerjaan yang terlambat sebelum menambah order baru.";

    return {
      vendorId,
      vendorNama: vendor.nama,
      vendorTipe: vendor.tipe,
      kontak: vendor.kontak || vendor.no_hp || "",
      totalActivePO: items.length,
      totalPcsAssigned,
      totalPcsUnfinished,
      hasOverdue,
      overdueCount,
      overduePcs,
      maxOverdueDays,
      avgProgress,
      nearDeadline,
      unfinishedPOs: items,
      score,
      recommendation,
      reasons,
      capacityLevel,
      capacityLabel,
      capacityNote
    };
  };

  const waLink = (phone?: string, text?: string) => {
    if (!phone) return "";
    let c = phone.replace(/[^0-9]/g, "");
    if (c.startsWith("0")) c = "62" + c.slice(1);
    else if (c.startsWith("8")) c = "62" + c;
    return `https://wa.me/${c}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
  };

  // KPI Calculations
  const stats = useMemo(() => {
    const totalActivePO = poProduksi.filter(p => p.status !== "Selesai").length;
    const totalPcs = poProduksi.filter(p => p.status !== "Selesai").reduce((sum, p) => sum + (Number(p.jumlahTerbit) || 0), 0);
    
    const activeStageItems = activeStage ? posForStage(activeStage) : [];
    const activeStagePcs = activeStageItems.reduce((sum, item) => {
      const po = getPO(item.po_id);
      return sum + (Number(po?.jumlahTerbit) || 0);
    }, 0);

    const activeVendors = new Set(
      poProduksi.filter(p => p.vendorId && p.status !== "Selesai").map(p => p.vendorId)
    ).size;

    return {
      totalActivePO,
      totalPcs,
      activeStageCount: activeStageItems.length,
      activeStagePcs,
      activeVendors: activeVendors || vendors.length
    };
  }, [poProduksi, activeStage, poPipelines, vendors]);

  // Filtered & Sorted items for current active stage
  const filteredActivePoItems = useMemo(() => {
    if (!activeStage) return [];
    const items = posForStage(activeStage);

    return items.filter(({ po_id, stageEntry }) => {
      const po = getPO(po_id);
      if (!po) return false;

      const rawStatus = stageEntry?.status || "Menunggu";
      if (filterStatus !== "all") {
        if (filterStatus === "Proses") {
          if (rawStatus !== "Proses" && rawStatus !== "Dikerjakan" && rawStatus !== "Sedang Dikerjakan") return false;
        } else if (rawStatus !== filterStatus) {
          return false;
        }
      }

      if (filterVendor !== "all" && String(po.vendorId) !== String(filterVendor)) return false;

      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const vendorName = getVendorName(po.vendorId).toLowerCase();
        const match = (po.noPo || "").toLowerCase().includes(q) ||
                      (po.model || "").toLowerCase().includes(q) ||
                      vendorName.includes(q);
        if (!match) return false;
      }

      return true;
    }).sort((a, b) => {
      const poA = getPO(a.po_id);
      const poB = getPO(b.po_id);
      if (!poA || !poB) return 0;

      if (sortBy === "most_qty") return (Number(poB.jumlahTerbit) || 0) - (Number(poA.jumlahTerbit) || 0);
      if (sortBy === "nearest_deadline") {
        const dA = poA.target_selesai ? new Date(poA.target_selesai).getTime() : 9999999999999;
        const dB = poB.target_selesai ? new Date(poB.target_selesai).getTime() : 9999999999999;
        return dA - dB;
      }
      return (poA.noPo || "").localeCompare(poB.noPo || "");
    });
  }, [activeStage, poPipelines, poProduksi, searchQuery, filterStatus, filterVendor, sortBy]);

  const hasActiveFilters = searchQuery !== "" || filterStatus !== "all" || filterVendor !== "all" || sortBy !== "no_po";

  const resetFilters = () => {
    setSearchQuery("");
    setFilterStatus("all");
    setFilterVendor("all");
    setSortBy("no_po");
  };

  // Submit Update Status for Stage
  const handleSaveStatus = async (newStatus: string) => {
    if (!statusModal) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/po-pipeline", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          po_id: statusModal.po_id,
          stage_id: statusModal.stage_id,
          updates: { 
            status: newStatus,
            selesai_tgl: newStatus === "Selesai" ? new Date().toISOString() : null
          }
        })
      });

      if (res.ok) {
        toast.success(`Status ${statusModal.stageName} untuk PO ${statusModal.noPo} diubah ke: ${newStatus}`);
        setStatusModal(null);
        fetchAll();
      } else {
        const err = await res.json();
        toast.error(err.error || "Gagal mengubah status");
      }
    } catch {
      toast.error("Terjadi kesalahan sistem");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Transfer Modal
  const openTransferModal = (po: any, currentStage: any, sumberId?: string, initialVendorId?: string) => {
    // Determine next stage
    const curUrutan = currentStage?.urutan || 1;
    const nextSt = stages.find(s => s.urutan > curUrutan && s.aktif);

    // Compute default target date (7 days from now, or PO deadline if available)
    const defDate = new Date();
    defDate.setDate(defDate.getDate() + 7);
    const defDateStr = defDate.toISOString().split("T")[0];
    const initialTargetDate = po.target_selesai ? String(po.target_selesai).split("T")[0] : defDateStr;

    // Sumber barang: dipilih eksplisit, atau otomatis jika hanya ada 1 sumber
    const sources = getTransferSources(po.id);
    let src = sumberId ? sources.find(s => s.id === String(sumberId)) : (sources.length === 1 ? sources[0] : null);
    
    // Jika diarahkan dari vendor request (mis. dari Buat SPK), cari sumber yang bersangkutan
    if (!src && initialVendorId) {
      const vReq = cmtRequests.find((r: any) => r.po_id === po.id && String(r.vendor_id) === String(initialVendorId) && (r.status === "Pending" || r.status === "Sebagian"));
      if (vReq && vReq.transfer_id) {
        src = sources.find(s => s.id === String(vReq.transfer_id)) || null;
      }
      if (!src && sources.length > 0) src = sources[0];
    }
    const legacy = sources.length === 0;

    setRiskAck(false);
    setShowAllVendors(false);
    setExpandedVendorId(null);
    setTransferModal({ po, currentStage });
    setTransferForm({
      ke_slug: src ? (src.tujuanSlug || "") : legacy ? (nextSt?.slug || "") : "",
      vendor_id: initialVendorId ? String(initialVendorId) : "",
      jumlah_kirim: src ? String(src.total) : legacy ? String(po.jumlahTerbit || "") : "",
      target_selesai: initialTargetDate,
      catatan: "",
      sumber_id: src ? src.id : legacy ? "po" : "",
      sizes: src ? sizesToForm(src.sizes) : legacy ? sizesToForm(po.sizeBreakdown || []) : {},
    });
  };

  const pickTransferSource = (src: any) => {
    setConflict(null);
    setTransferForm(f => ({
      ...f,
      sumber_id: src.id,
      ke_slug: src.tujuanSlug || f.ke_slug,
      vendor_id: "",
      sizes: sizesToForm(src.sizes),
      jumlah_kirim: String(src.total),
    }));
  };

  // Submit Transfer to Next Stage
  const handleSubmitTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitTransfer();
  };

  const submitTransfer = async (resolveRequests?: "tolak") => {
    if (!transferModal) return;
    const sources = getTransferSources(transferModal.po.id);
    const src = sources.find(s => s.id === transferForm.sumber_id) || null;
    const isLegacy = transferForm.sumber_id === "po";
    if (!src && !isLegacy) {
      toast.error("Pilih dulu barang mana yang akan dikirim");
      return;
    }
    if (!transferForm.ke_slug) {
      toast.error("Pilih pos tujuan pengiriman");
      return;
    }
    const maxSizes: any[] = src ? src.sizes : (transferModal.po.sizeBreakdown || []);
    const hasSizes = maxSizes.length > 0;
    const sizeBreakdown = hasSizes
      ? Object.entries(transferForm.sizes).map(([size, j]) => ({ size, jumlah: Number(j) || 0 })).filter(s => s.jumlah > 0)
      : [];
    const jumlah = hasSizes ? sizeBreakdown.reduce((s, x) => s + x.jumlah, 0) : Number(transferForm.jumlah_kirim || 0);
    if (jumlah <= 0) {
      toast.error("Isi jumlah yang dikirim");
      return;
    }
    if (hasSizes) {
      for (const s of sizeBreakdown) {
        const max = Number(maxSizes.find((m: any) => String(m.size) === s.size)?.jumlah || 0);
        if (s.jumlah > max) { toast.error(`Size ${s.size} maksimal ${max} pcs`); return; }
      }
    }
    const maxTotal = src ? src.total : Number(transferModal.po.jumlahTerbit || 0);
    if (jumlah > maxTotal) {
      toast.error(`Jumlah kirim melebihi barang yang tersedia (${maxTotal} pcs)`);
      return;
    }
    if (transferForm.vendor_id) {
      const wl = getVendorWorkload(Number(transferForm.vendor_id));
      if (wl && wl.capacityLevel === "overloaded" && !riskAck) {
        toast.error(`${wl.vendorNama} sedang bermasalah (${wl.overdueCount} pekerjaan terlambat). Centang konfirmasi risiko untuk tetap mengirim.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/produksi-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          po_id: transferModal.po.id,
          dari: src ? src.fromSlug : (transferModal.currentStage?.slug || "potong_bahan"),
          ke: transferForm.ke_slug,
          vendor_id: transferForm.vendor_id ? Number(transferForm.vendor_id) : null,
          target_selesai: transferForm.target_selesai || null,
          jumlah_kirim: jumlah,
          sizeBreakdown,
          transfer_id_asal: src ? Number(src.id) : undefined,
          // Optimistic lock: stok yang sedang dilihat admin. Jika berubah (vendor minta / admin lain kirim) → 409
          expected_total: src ? src.total : undefined,
          resolve_requests: resolveRequests,
          actor: "Admin",
          catatan: transferForm.catatan || (src ? `Hasil ${src.fromNama}${src.asalVendor ? ` (${src.asalVendor})` : ""} → ${stageNameBySlug(transferForm.ke_slug)}` : "")
        })
      });

      if (res.ok) {
        const out = await res.json().catch(() => ({}));
        const upd: any[] = out.requests_updated || [];
        const fulfilled = upd.filter(u => u.status !== "Ditolak").length;
        const rejected = upd.filter(u => u.status === "Ditolak").length;
        toast.success(`Berhasil mengirim ${jumlah} pcs${src ? ` hasil ${src.fromNama}${src.asalVendor ? ` (${src.asalVendor})` : ""}` : ""} ke ${stageNameBySlug(transferForm.ke_slug)}!`, {
          description: [fulfilled ? `${fulfilled} permintaan vendor otomatis terpenuhi` : "", rejected ? `${rejected} permintaan vendor ditolak & vendor sudah diberi tahu` : ""].filter(Boolean).join(" · ") || undefined,
        });
        setConflict(null);
        setTransferModal(null);
        fetchAll();
      } else {
        const err = await res.json().catch(() => ({}));
        if (res.status === 409 && (err.code === "STALE" || err.code === "RESERVED")) {
          setConflict(err);
          fetchAll(true); // ambil stok terbaru
          toast.warning(err.code === "RESERVED" ? "Bentrok dengan permintaan vendor" : "Stok sudah berubah", { description: err.error });
        } else {
          toast.error(err.error || "Gagal melakukan transfer barang");
        }
      }
    } catch {
      toast.error("Terjadi kesalahan sistem saat transfer barang");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifikasiGudang = async (tf: any) => {
    try {
      const res = await fetch("/api/produksi-transfer", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: tf.id,
          jumlah_diterima: Number(tf.jumlah_kirim || 0),
          sizeBreakdown_diterima: tf.sizeBreakdown,
          catatan_terima: "Diverifikasi langsung dari Alur Produksi"
        })
      });
      if (!res.ok) throw new Error("Gagal verifikasi barang masuk gudang");
      toast.success(`${tf.noPo || "PO"}: ${Number(tf.jumlah_kirim || 0).toLocaleString("id-ID")} pcs diverifikasi masuk Gudang!`);
      fetchAll(true);
    } catch (e: any) {
      toast.error(e.message || "Gagal verifikasi barang");
    }
  };

  if (loading) {
    return (
      <div style={{ background: "#F1F5F9", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <RefreshCw size={22} color="#2563EB" style={{ animation: "spin 1s linear infinite" }} />
        <div style={{ color: "#475569", fontSize: 14, fontWeight: 700 }}>Menyinkronkan data pipeline produksi...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: "28px 32px 48px 32px", background: "#F1F5F9", minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .flow-card-hover { transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
        .flow-card-hover:hover { transform: translateY(-3px); box-shadow: 0 10px 24px rgba(0,0,0,0.08) !important; }
      `}</style>

      {/* HEADER SECTION */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14, marginBottom: 18 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <div style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                background: "linear-gradient(135deg, #1E40AF 0%, #2563EB 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 8px rgba(37,99,235,0.25)"
              }}>
                <Workflow size={20} color="#FFFFFF" />
              </div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#0F172A", letterSpacing: "-0.02em" }}>
                Alur Produksi (Monitoring Pipeline SPK)
              </h1>
              <span style={{ fontSize: 11, fontWeight: 800, background: "rgba(37,99,235,0.1)", color: "#2563EB", padding: "4px 10px", borderRadius: 20 }}>
                Real-Time Tracking
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "#64748B" }}>
              Pantau real-time pergerakan barang antar tahap produksi: Potong, Jahit (CMT), Washing, Bersih Benang, hingga Packing & Gudang.
            </p>
          </div>

          {/* QUICK NAVIGATION & ACTIONS */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Link 
              href="/daftar-spk" 
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 10,
                border: "1px solid #CBD5E1",
                background: "#FFFFFF",
                color: "#475569",
                fontSize: 12.5,
                fontWeight: 700,
                textDecoration: "none",
                boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
              }}
            >
              <FileText size={14} color="#64748B" /> Daftar SPK
            </Link>
            <Link 
              href="/dashboard-cmt" 
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 10,
                border: "1px solid #CBD5E1",
                background: "#FFFFFF",
                color: "#475569",
                fontSize: 12.5,
                fontWeight: 700,
                textDecoration: "none",
                boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
              }}
            >
              <Zap size={14} color="#64748B" /> Dashboard CMT
            </Link>
            <Link 
              href="/peta-perjalanan" 
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 10,
                border: "1px solid #CBD5E1",
                background: "#FFFFFF",
                color: "#475569",
                fontSize: 12.5,
                fontWeight: 700,
                textDecoration: "none",
                boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
              }}
            >
              <Layers size={14} color="#64748B" /> Peta Perjalanan
            </Link>
            <Link 
              href="/alur-produksi-settings" 
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 10,
                border: "1px solid #CBD5E1",
                background: "#FFFFFF",
                color: "#475569",
                fontSize: 12.5,
                fontWeight: 700,
                textDecoration: "none",
                boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
              }}
            >
              <Workflow size={14} color="#64748B" /> Pengaturan Alur
            </Link>
            <button
              onClick={handleManualSync}
              disabled={syncing}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "9px 18px",
                borderRadius: 10,
                border: "none",
                background: "linear-gradient(135deg, #1E40AF 0%, #2563EB 100%)",
                color: "#FFFFFF",
                fontSize: 13,
                fontWeight: 800,
                cursor: syncing ? "not-allowed" : "pointer",
                boxShadow: "0 2px 8px rgba(37,99,235,0.25)",
                opacity: syncing ? 0.7 : 1
              }}
            >
              <RefreshCw size={15} style={{ animation: syncing ? "spin 1s linear infinite" : "none" }} />
              {syncing ? "Menyinkronkan..." : "Sync Ulang Pipeline"}
            </button>
          </div>
        </div>

        {/* 4 KPI SUMMARY STAT CARDS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          {/* Card 1: Total SPK Berjalan */}
          <div className="flow-card-hover" style={{ background: "#FFFFFF", borderRadius: 14, padding: "16px 20px", border: "1px solid #E2E8F0", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>Total SPK Berjalan</span>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Package size={15} color="#2563EB" />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", letterSpacing: "-0.02em" }}>
              {stats.totalActivePO} <span style={{ fontSize: 13, fontWeight: 600, color: "#64748B" }}>SPK Aktif</span>
            </div>
            <div style={{ fontSize: 11, color: "#2563EB", fontWeight: 700, marginTop: 4 }}>
              Total {stats.totalPcs.toLocaleString("id-ID")} pcs sedang diproduksi
            </div>
          </div>

          {/* Card 2: Tahap Aktif */}
          <div className="flow-card-hover" style={{ background: "#FFFFFF", borderRadius: 14, padding: "16px 20px", border: "1px solid #E2E8F0", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>Tahap: {activeStageObj?.nama || "Pilih"}</span>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "#ECFDF5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CheckCircle2 size={15} color="#059669" />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#065F46", letterSpacing: "-0.02em" }}>
              {stats.activeStageCount} <span style={{ fontSize: 13, fontWeight: 600, color: "#64748B" }}>SPK Antrean</span>
            </div>
            <div style={{ fontSize: 11, color: "#059669", fontWeight: 700, marginTop: 4 }}>
              {stats.activeStagePcs.toLocaleString("id-ID")} pcs berada di tahap ini
            </div>
          </div>

          {/* Card 3: Vendor Aktif */}
          <div className="flow-card-hover" style={{ background: "#FFFFFF", borderRadius: 14, padding: "16px 20px", border: "1px solid #E2E8F0", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>Mitra Vendor Terlibat</span>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "#FAF5FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Building2 size={15} color="#7C3AED" />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#6D28D9", letterSpacing: "-0.02em" }}>
              {stats.activeVendors} <span style={{ fontSize: 13, fontWeight: 600, color: "#64748B" }}>Vendor Mitra</span>
            </div>
            <div style={{ fontSize: 11, color: "#7C3AED", fontWeight: 700, marginTop: 4 }}>
              CMT, Washing, & Finishing terhubung
            </div>
          </div>

          {/* Card 4: Alur Pipeline Status */}
          <div className="flow-card-hover" style={{ background: "#FFFFFF", borderRadius: 14, padding: "16px 20px", border: "1px solid #E2E8F0", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>Total Rantai Tahap</span>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "#FFFBEB", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Workflow size={15} color="#D97706" />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#B45309", letterSpacing: "-0.02em" }}>
              {stages.length} <span style={{ fontSize: 13, fontWeight: 600, color: "#64748B" }}>Pos Tahap</span>
            </div>
            <div style={{ fontSize: 11, color: "#D97706", fontWeight: 700, marginTop: 4 }}>
              Alur produksi terkonfigurasi aktif
            </div>
          </div>
        </div>
      </div>

      {/* PIPELINE FLOW STEPPER (TABS) */}
      <div style={{ background: "#FFFFFF", borderRadius: 14, border: "1px solid #E2E8F0", marginBottom: 20, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
        <div style={{ padding: "14px 20px 0", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Tahapan Rantai Produksi (Pilih untuk melihat detail barang):
          </div>
          <div style={{ fontSize: 12, color: "#94A3B8" }}>
            Klik pos untuk berpindah monitoring
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "stretch", overflowX: "auto", padding: "12px 16px", gap: 6 }}>
          {stages.map((stage, idx) => {
            const isActive = activeStage === stage.id;
            const IconComponent = getIcon(stage.slug);
            const total = posForStage(stage.id).length;
            const selesai = countFor(stage.id, "Selesai");
            const proses = countFor(stage.id, "Proses");
            const pct = total > 0 ? Math.round((selesai / total) * 100) : 0;
            const badgeColor = proses > 0 ? "#2563EB" : selesai === total && total > 0 ? "#10B981" : "#F59E0B";

            return (
              <React.Fragment key={stage.id}>
                <button 
                  onClick={() => setActiveStage(stage.id)}
                  style={{ 
                    padding: "12px 18px", 
                    border: isActive ? `2px solid ${stage.warna}` : "1.5px solid #E2E8F0", 
                    borderRadius: 12,
                    background: isActive ? `${stage.warna}10` : "#FFFFFF", 
                    cursor: "pointer", 
                    display: "flex", 
                    flexDirection: "column", 
                    alignItems: "center", 
                    gap: 8, 
                    minWidth: 120, 
                    flexShrink: 0, 
                    transition: "all 0.2s",
                    boxShadow: isActive ? `0 4px 14px ${stage.warna}25` : "none"
                  }}
                >
                  <div style={{ 
                    width: 44, 
                    height: 44, 
                    borderRadius: 12, 
                    background: isActive ? stage.warna : "#F8FAFC", 
                    border: `1.5px solid ${isActive ? stage.warna : "#CBD5E1"}`, 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center", 
                    position: "relative" 
                  }}>
                    <IconComponent size={20} color={isActive ? "white" : stage.warna} />
                    {total > 0 && (
                      <div style={{ 
                        position: "absolute", 
                        top: -6, 
                        right: -6, 
                        background: badgeColor, 
                        color: "white", 
                        fontSize: 10, 
                        fontWeight: 900, 
                        width: 20, 
                        height: 20, 
                        borderRadius: "50%", 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "center", 
                        border: "2px solid white" 
                      }}>
                        {total}
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: isActive ? "#0F172A" : "#475569", whiteSpace: "nowrap" }}>
                      {stage.nama}
                    </div>
                    <div style={{ fontSize: 10.5, color: "#94A3B8", marginTop: 1 }}>
                      Pos #{stage.urutan}
                    </div>
                  </div>

                  {total > 0 && (
                    <div style={{ width: "100%", height: 3, background: "#E2E8F0", borderRadius: 2, overflow: "hidden", marginTop: 2 }}>
                      <div style={{ width: pct + "%", height: "100%", background: stage.warna, transition: "width 0.4s" }} />
                    </div>
                  )}
                </button>

                {idx < stages.length - 1 && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: "0 2px" }}>
                    <ChevronRight size={16} color="#CBD5E1" />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* STAGE CONTEXT BANNER */}
      {activeStageObj && (
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "space-between", 
          gap: 14, 
          marginBottom: 18, 
          padding: "14px 20px", 
          borderRadius: 14, 
          background: "#FFFFFF", 
          border: `1.5px solid ${activeStageObj.warna}30`, 
          boxShadow: "0 2px 6px rgba(0,0,0,0.02)" 
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: `${activeStageObj.warna}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {React.createElement(getIcon(activeStageObj.slug), { size: 19, color: activeStageObj.warna })}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontWeight: 900, fontSize: 16, color: "#0F172A" }}>
                  Tahap: {activeStageObj.nama}
                </span>
                <span style={{ fontSize: 11, fontWeight: 800, background: `${activeStageObj.warna}15`, color: activeStageObj.warna, padding: "2px 8px", borderRadius: 6 }}>
                  Urutan #{activeStageObj.urutan}
                </span>
              </div>
              <div style={{ fontSize: 12.5, color: "#64748B", marginTop: 2 }}>
                {activeStageObj.deskripsi || "Pantau dan kelola pengerjaan serta distribusi barang pada pos ini."}
              </div>
            </div>
          </div>

          <div style={{ fontSize: 12, color: "#475569", fontWeight: 700, background: "#F8FAFC", padding: "6px 12px", borderRadius: 8, border: "1px solid #E2E8F0" }}>
            {filteredActivePoItems.length} SPK dalam Tahap Ini
          </div>
        </div>
      )}

      {/* SEARCH TOOLBAR & MULTI-FILTER SECTION */}
      <div style={{ background: "#FFFFFF", borderRadius: 14, padding: "14px 18px", border: "1px solid #E2E8F0", marginBottom: 20, boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          
          {/* SEARCH INPUT */}
          <div style={{ position: "relative", flex: "1 1 280px", minWidth: 260 }}>
            <Search size={16} color="#94A3B8" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
            <input 
              type="text"
              placeholder="Cari No SPK (SJ-01...), model pola, nama vendor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "9px 14px 9px 40px",
                borderRadius: 10,
                border: "1.5px solid #E2E8F0",
                fontSize: 13,
                outline: "none",
                background: "#F8FAFC",
                color: "#0F172A",
                boxSizing: "border-box"
              }}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* FILTER CONTROLS */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            
            {/* STATUS FILTER PILLS */}
            <div style={{ display: "flex", background: "#F1F5F9", padding: 3, borderRadius: 10, gap: 2 }}>
              <button
                onClick={() => setFilterStatus("all")}
                style={{
                  padding: "6px 12px",
                  fontSize: 12,
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  fontWeight: filterStatus === "all" ? 800 : 600,
                  background: filterStatus === "all" ? "#FFFFFF" : "transparent",
                  color: filterStatus === "all" ? "#2563EB" : "#64748B",
                  boxShadow: filterStatus === "all" ? "0 1px 3px rgba(0,0,0,0.08)" : "none"
                }}
              >
                Semua Status
              </button>
              <button
                onClick={() => setFilterStatus("Proses")}
                style={{
                  padding: "6px 12px",
                  fontSize: 12,
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  fontWeight: filterStatus === "Proses" ? 800 : 600,
                  background: filterStatus === "Proses" ? "#FFFFFF" : "transparent",
                  color: filterStatus === "Proses" ? "#2563EB" : "#64748B",
                  boxShadow: filterStatus === "Proses" ? "0 1px 3px rgba(0,0,0,0.08)" : "none"
                }}
              >
                Sedang Proses
              </button>
              <button
                onClick={() => setFilterStatus("Menunggu")}
                style={{
                  padding: "6px 12px",
                  fontSize: 12,
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  fontWeight: filterStatus === "Menunggu" ? 800 : 600,
                  background: filterStatus === "Menunggu" ? "#FFFFFF" : "transparent",
                  color: filterStatus === "Menunggu" ? "#475569" : "#64748B",
                  boxShadow: filterStatus === "Menunggu" ? "0 1px 3px rgba(0,0,0,0.08)" : "none"
                }}
              >
                Menunggu
              </button>
              <button
                onClick={() => setFilterStatus("Selesai")}
                style={{
                  padding: "6px 12px",
                  fontSize: 12,
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  fontWeight: filterStatus === "Selesai" ? 800 : 600,
                  background: filterStatus === "Selesai" ? "#FFFFFF" : "transparent",
                  color: filterStatus === "Selesai" ? "#059669" : "#64748B",
                  boxShadow: filterStatus === "Selesai" ? "0 1px 3px rgba(0,0,0,0.08)" : "none"
                }}
              >
                Selesai
              </button>
            </div>

            {/* VENDOR SELECT */}
            <select
              value={filterVendor}
              onChange={(e) => setFilterVendor(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1.5px solid #E2E8F0",
                fontSize: 12.5,
                background: "#F8FAFC",
                color: "#0F172A",
                fontWeight: 600,
                cursor: "pointer",
                outline: "none"
              }}
            >
              <option value="all">Semua Vendor</option>
              {vendors.map(v => (
                <option key={v.id} value={v.id}>{v.nama}</option>
              ))}
            </select>

            {/* SORT SELECT */}
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1.5px solid #E2E8F0",
                fontSize: 12.5,
                background: "#F8FAFC",
                color: "#0F172A",
                fontWeight: 600,
                cursor: "pointer",
                outline: "none"
              }}
            >
              <option value="no_po">Nomor PO (SJ)</option>
              <option value="most_qty">Jumlah Pcs Terbanyak</option>
              <option value="nearest_deadline">Target Selesai Terdekat</option>
            </select>

            {/* RESET BUTTON */}
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px dashed #CBD5E1",
                  background: "#F8FAFC",
                  color: "#64748B",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer"
                }}
                title="Reset semua filter pencarian"
              >
                <RotateCcw size={13} /> Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* PO CARDS GRID */}
      {filteredActivePoItems.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 24px", background: "white", borderRadius: 16, border: "1.5px dashed #E2E8F0" }}>
          <Workflow size={36} color="#CBD5E1" style={{ margin: "0 auto 10px" }} />
          <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: 0 }}>
            Tidak ada order di tahap {activeStageObj?.nama}
          </h3>
          <p style={{ color: "#94A3B8", margin: "4px 0 0", fontSize: 13 }}>
            {searchQuery || filterStatus !== "all" || filterVendor !== "all" 
              ? "Coba ubah kata kunci pencarian atau reset filter."
              : "Semua order telah dipindahkan ke tahap selanjutnya atau belum dialirkan ke pos ini."}
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: 16 }}>
          {filteredActivePoItems.map(({ po_id, stageEntry }) => {
            const po = getPO(po_id);
            if (!po) return null;
            const rawStatus = stageEntry?.status || "Menunggu";
            const sc = STATUS_STYLE[rawStatus] || STATUS_STYLE.Menunggu;
            const dists = getActiveDistributions(po_id, activeStageObj?.slug);
            const tertandon = getTertandon(po_id, activeStageObj);
            const isInitialCutting = activeStageObj?.urutan === 1 || (activeStageObj?.slug || "").toLowerCase().includes("potong");
            const isJahitStage = normalizeStage(activeStageObj?.slug) === "cmt";
            const liveStatus = getPoLiveStatus(po);

            const isCmtLens = isJahitStage || isInitialCutting;
            const distTarget = dists.find(d => d.target_selesai)?.target_selesai || null;
            // Tahap CMT/potong → target PO; tahap lanjutan → target transfer vendor tahap itu
            const poTargetDate = isCmtLens ? (po.target_selesai || distTarget || null) : (distTarget || null);
            const isOverdueOverall = isOverdue(poTargetDate);
            const poLateDays = overdueDays(poTargetDate);
            const poDaysLeft = remainingDays(poTargetDate);
            const isPoComplete = po.status === "Closed" || po.status === "Pipeline Selesai" || (liveStatus?.sisaPcs === 0 && rawStatus === "Selesai");
            // CMT sudah selesai / sudah lapor penuh → hitungan terlambat berhenti (dibekukan)
            const cmtFinished = isCmtLens && (po.cmt_selesai || po.cmt_menunggu_acc);
            const cmtFinalLate = Number(po.cmt_terlambat_hari || 0);
            const isPoLate = !cmtFinished && (isCmtLens && typeof po.cmt_is_overdue === "boolean"
              ? po.cmt_is_overdue
              : (isOverdueOverall || poDaysLeft < 0)) && !isPoComplete;
            const displayLateDays = isCmtLens && typeof po.cmt_late_days === "number" && po.cmt_late_days > 0
              ? po.cmt_late_days
              : (poLateDays > 0 ? poLateDays : Math.abs(poDaysLeft));

            return (
              <div 
                key={po_id} 
                className="flow-card-hover"
                style={{ 
                  background: "white", 
                  borderRadius: 16, 
                  border: isPoLate ? "1.5px solid #FECACA" : "1px solid #E2E8F0", 
                  boxShadow: isPoLate ? "0 4px 14px rgba(220,38,38,0.08)" : "0 2px 8px rgba(0,0,0,0.04)", 
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column"
                }}
              >
                {/* Overdue Alert Banner or Target Date Bar (Concept from CMT Portal) */}
                {poTargetDate ? (
                  cmtFinished ? (
                    <div style={{
                      background: cmtFinalLate > 0 ? "#FFF7ED" : "#F0FDF4",
                      borderBottom: `1px solid ${cmtFinalLate > 0 ? "#FED7AA" : "#BBF7D0"}`,
                      color: cmtFinalLate > 0 ? "#9A3412" : "#166534",
                      padding: "7px 16px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      flexWrap: "wrap",
                      fontSize: 11,
                      fontWeight: 700
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <CheckCircle2 size={13} color={cmtFinalLate > 0 ? "#EA580C" : "#16A34A"} />
                        <span>
                          {po.cmt_selesai ? "CMT SELESAI" : "CMT LAPOR PENUH • MENUNGGU ACC"}
                          {po.cmt_selesai_at ? ` • ${fmtDate(po.cmt_selesai_at)}` : ""}
                        </span>
                        <span style={{ opacity: 0.8, fontWeight: 600 }}>• Target: {fmtDate(poTargetDate)}</span>
                      </div>
                      <span style={{
                        background: cmtFinalLate > 0 ? "#FFEDD5" : "#DCFCE7",
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontWeight: 800
                      }}>
                        {cmtFinalLate > 0 ? `Terlambat ${cmtFinalLate} hari (dibekukan)` : "Tepat waktu"}
                      </span>
                    </div>
                  ) : isPoLate ? (
                    <div style={{
                      background: "linear-gradient(90deg, #991B1B 0%, #DC2626 100%)",
                      color: "#FFFFFF",
                      padding: "8px 16px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: "0.02em"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <AlertTriangle size={14} color="#FECACA" />
                        <span>PO MELEBIHI TARGET SELESAI ({displayLateDays} HARI)</span>
                        <span style={{ opacity: 0.85, fontWeight: 600 }}>• Target: {fmtDate(poTargetDate)}</span>
                      </div>
                      <span style={{
                        background: "rgba(0,0,0,0.35)",
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 10.5,
                        color: "#FEE2E2",
                        border: "1px solid rgba(254,202,202,0.4)"
                      }}>
                        -{displayLateDays}% Throttle
                      </span>
                    </div>
                  ) : (
                    <div style={{
                      background: "#F0FDF4",
                      borderBottom: "1px solid #BBF7D0",
                      color: "#166534",
                      padding: "7px 16px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: 11,
                      fontWeight: 700
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Calendar size={13} color="#16A34A" />
                        <span>Dateline Target: {fmtDate(poTargetDate)}</span>
                      </div>
                      <span style={{ background: "#DCFCE7", padding: "2px 8px", borderRadius: 4, color: "#15803D", fontWeight: 800 }}>
                        ⏳ Sisa {Math.max(0, poDaysLeft)} Hari
                      </span>
                    </div>
                  )
                ) : null}
                
                <div style={{ padding: "16px 18px", flex: 1, display: "flex", flexDirection: "column" }}>

                  {/* Card Header: No PO, Model & Status Badge & Radial Progress */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div style={{ flex: 1, paddingRight: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ 
                          fontSize: 15, 
                          fontWeight: 900, 
                          fontFamily: "monospace", 
                          color: "#1D4ED8", 
                          background: "#EFF6FF", 
                          border: "1px solid #BFDBFE",
                          padding: "2px 8px", 
                          borderRadius: 6 
                        }}>
                          {po.noPo}
                        </span>
                        <span style={{ fontSize: 11, color: "#94A3B8", background: "#F1F5F9", padding: "2px 6px", borderRadius: 4 }}>
                          ID:#{po.id}
                        </span>
                        
                        <button
                          onClick={() => setStatusModal({
                            po_id,
                            stage_id: activeStageObj.id,
                            stageName: activeStageObj.nama,
                            currentStatus: rawStatus,
                            noPo: po.noPo
                          })}
                          style={{ 
                            display: "inline-flex", 
                            alignItems: "center", 
                            gap: 4, 
                            padding: "3px 8px", 
                            borderRadius: 12, 
                            background: sc.bg, 
                            border: `1px solid ${sc.border}`,
                            cursor: "pointer"
                          }}
                          title="Klik untuk mengubah status pos ini"
                        >
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: sc.dot }} />
                          <span style={{ fontSize: 10.5, fontWeight: 800, color: sc.text }}>{activeStageObj?.nama}: {sc.label}</span>
                          <Edit3 size={10} style={{ opacity: 0.6 }} />
                        </button>

                        {/* Overall PO Active Work Status Chip */}
                        {liveStatus && !liveStatus.isPipelineFullyDone && (
                          <span style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            padding: "3px 8px",
                            borderRadius: 12,
                            background: liveStatus.effectiveStatus === "Dikerjakan" ? "#FEF3C7" : "#EFF6FF",
                            border: liveStatus.effectiveStatus === "Dikerjakan" ? "1px solid #FCD34D" : "1px solid #BFDBFE",
                            color: liveStatus.effectiveStatus === "Dikerjakan" ? "#92400E" : "#1D4ED8",
                            fontSize: 10.5,
                            fontWeight: 800
                          }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: liveStatus.effectiveStatus === "Dikerjakan" ? "#F59E0B" : "#3B82F6" }} />
                            {liveStatus.effectiveStatus === "Dikerjakan" ? "Sedang Dikerjakan" : "Dalam Proses"}
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginTop: 6, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span>Model: <strong style={{ color: "#0F172A" }}>{po.model}</strong></span>
                        <span style={{ color: "#94A3B8" }}>&bull;</span>
                        <span style={{ color: "#2563EB", fontWeight: 800 }}>Total {po.jumlahTerbit.toLocaleString("id-ID")} pcs</span>
                        {liveStatus && (
                          <span style={{ 
                            background: liveStatus.isPipelineFullyDone ? "#DCFCE7" : liveStatus.effectiveStatus === "Dikerjakan" ? "#FEF3C7" : "#EFF6FF", 
                            color: liveStatus.isPipelineFullyDone ? "#166534" : liveStatus.effectiveStatus === "Dikerjakan" ? "#92400E" : "#1D4ED8", 
                            border: liveStatus.isPipelineFullyDone ? "1px solid #BBF7D0" : liveStatus.effectiveStatus === "Dikerjakan" ? "1px solid #FDE68A" : "1px solid #BFDBFE", 
                            padding: "2px 8px", 
                            borderRadius: 5, 
                            fontSize: 11, 
                            fontWeight: 800 
                          }}>
                            {liveStatus.effectiveLabel}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Radial Progress Gauge (Mencerminkan Progres Sebenarnya) */}
                    {liveStatus && (
                      <div style={{ flexShrink: 0 }} title={`Progres Nyata: ${liveStatus.effectivePct}%`}>
                        <RadialProgress 
                          pct={liveStatus.effectivePct} 
                          size={54} 
                          stroke={5} 
                          color={liveStatus.isPipelineFullyDone ? "#10B981" : liveStatus.effectiveStatus === "Dikerjakan" ? "#F59E0B" : "#2563EB"} 
                        />
                      </div>
                    )}
                  </div>

                  {/* RINCIAN POSISI BARANG — penjelasan agar tidak bingung membaca angka */}
                  {liveStatus?.posisi && liveStatus.posisi.total > 0 && (() => {
                    const p = liveStatus.posisi;
                    const fmtN = (n: number) => n.toLocaleString("id-ID");
                    const pctOf = (n: number) => (p.total > 0 ? Math.min(100, (n / p.total) * 100) : 0);
                    const rows = [
                      { key: "stok", label: "Masuk Gudang & Stok", qty: p.masukStok, color: "#10B981", bg: "#ECFDF5", ket: "Barang jadi yang sudah siap dijual (sudah punya SKU)." },
                      { key: "menunggu", label: "Menunggu Tindak Lanjut", qty: p.menunggu, color: "#3B82F6", bg: "#EFF6FF", ket: "Sudah selesai di pos sebelumnya, belum dikirim ke vendor berikutnya / belum dimasukkan stok." },
                      { key: "vendor", label: "Sedang di Vendor", qty: p.diVendor, color: "#F59E0B", bg: "#FFFBEB", ket: "Masih dikerjakan vendor (washing, bersih benang, dll) dan belum disetor." },
                      { key: "belum", label: "Masih di CMT / Belum Dikirim", qty: p.belum, color: "#94A3B8", bg: "#F8FAFC", ket: "Belum keluar dari penjahit (CMT) atau belum dikirim ke pos lanjutan." },
                      { key: "reject", label: "Reject (tidak dihitung stok)", qty: p.reject, color: "#EF4444", bg: "#FEF2F2", ket: "Barang cacat yang sudah dibuatkan Nota Reject / klaim ke vendor." },
                    ];
                    return (
                      <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 12, padding: "10px 12px", marginBottom: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <span style={{ fontSize: 11.5, fontWeight: 900, color: "#0F172A" }}>📍 Posisi Barang Saat Ini</span>
                          <span style={{ fontSize: 10.5, fontWeight: 800, color: "#475569" }}>Total PO: {fmtN(p.total)} pcs</span>
                        </div>
                        {/* Bar komposisi */}
                        <div style={{ display: "flex", height: 8, borderRadius: 6, overflow: "hidden", background: "#F1F5F9", marginBottom: 8 }}>
                          {rows.filter(r => r.qty > 0).map(r => (
                            <div key={r.key} title={`${r.label}: ${fmtN(r.qty)} pcs`} style={{ width: `${pctOf(r.qty)}%`, background: r.color }} />
                          ))}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {rows.filter(r => r.qty > 0 || r.key === "stok").map(r => (
                            <div key={r.key} style={{ background: r.bg, borderRadius: 7, padding: "5px 8px" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 800, color: "#0F172A" }}>
                                  <span style={{ width: 8, height: 8, borderRadius: 2, background: r.color, flexShrink: 0 }} />
                                  {r.label}
                                </span>
                                <span style={{ fontSize: 11.5, fontWeight: 900, color: "#0F172A", whiteSpace: "nowrap" }}>
                                  {fmtN(r.qty)} pcs <span style={{ fontSize: 9.5, color: "#64748B", fontWeight: 700 }}>({Math.round(pctOf(r.qty))}%)</span>
                                </span>
                              </div>
                              <div style={{ fontSize: 9.5, color: "#64748B", marginTop: 1, paddingLeft: 14 }}>{r.ket}</div>
                              {r.key === "vendor" && p.diVendorList.length > 0 && (
                                <div style={{ paddingLeft: 14, marginTop: 2 }}>
                                  {p.diVendorList.map((v: any, i: number) => (
                                    <div key={i} style={{ fontSize: 10, color: "#92400E", fontWeight: 700 }}>• {v.nama} ({v.tahap}): {fmtN(v.qty)} pcs — {v.status}</div>
                                  ))}
                                </div>
                              )}
                              {r.key === "menunggu" && p.menungguList.length > 0 && (
                                <div style={{ paddingLeft: 14, marginTop: 2 }}>
                                  {p.menungguList.map((m: any, i: number) => (
                                    <div key={i} style={{ fontSize: 10, color: "#1D4ED8", fontWeight: 700 }}>• {m.tahap}: {fmtN(m.qty)} pcs — {m.ket}</div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        {p.selisihLebih > 0 && (
                          <div style={{ marginTop: 6, fontSize: 10, fontWeight: 800, color: "#B91C1C", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6, padding: "4px 8px" }}>
                            ⚠️ Jumlah tercatat melebihi total PO sebanyak {fmtN(p.selisihLebih)} pcs — kemungkinan ada kiriman ganda, mohon cek riwayat pengiriman.
                          </div>
                        )}
                        <div style={{ marginTop: 6, fontSize: 9.5, color: "#64748B", lineHeight: 1.45, borderTop: "1px dashed #E2E8F0", paddingTop: 5 }}>
                          💡 <b>Cara membaca:</b> semua angka adalah bagian dari total PO ({fmtN(p.total)} pcs), sehingga jika dijumlahkan hasilnya sama dengan total PO.
                          Persentase pada lingkaran kanan atas = barang yang sudah <b>selesai di pos terakhir</b> dibanding total PO.
                        </div>
                      </div>
                    );
                  })()}

                  {/* ACTIVE CMT / VENDOR PANEL (Consistent with CMT Portal Concept) */}
                  {liveStatus && liveStatus.vendorNama && (
                    <div style={{
                      background: "#0F172A",
                      borderRadius: 12,
                      padding: "12px 14px",
                      marginBottom: 10,
                      border: "1px solid #1E293B",
                      color: "#F8FAFC"
                    }}>
                      {/* Vendor Identity Row */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: "#1E293B", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <Building2 size={16} color="#38BDF8" />
                          </div>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 13, fontWeight: 900, color: "#FFFFFF" }}>{liveStatus.vendorNama}</span>
                              {liveStatus.vendorKode && (
                                <span style={{ fontSize: 9.5, fontWeight: 800, color: "#38BDF8", background: "#0369A130", border: "1px solid #0284C750", padding: "1px 5px", borderRadius: 4 }}>
                                  {liveStatus.vendorKode}
                                </span>
                              )}

                              {/* REALTIME WORK STATUS BADGE (Sesuaikan dengan konsep Vendor Portal) */}
                              {po.status === "Dikerjakan" ? (
                                <span style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 5,
                                  padding: "2px 7px",
                                  borderRadius: 5,
                                  background: "#064E3B",
                                  border: "1px solid #059669",
                                  color: "#34D399",
                                  fontSize: 9.5,
                                  fontWeight: 800,
                                  letterSpacing: "0.02em"
                                }}>
                                  <span style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: "50%",
                                    background: "#10B981",
                                    boxShadow: "0 0 6px #10B981"
                                  }} />
                                  SEDANG DIKERJAKAN
                                </span>
                              ) : liveStatus.hasPendingAcc ? (
                                <span style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 5,
                                  padding: "2px 7px",
                                  borderRadius: 5,
                                  background: "#78350F60",
                                  border: "1px solid #D97706",
                                  color: "#FCD34D",
                                  fontSize: 9.5,
                                  fontWeight: 800
                                }}>
                                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#F59E0B" }} />
                                  MENUNGGU ACC ADMIN
                                </span>
                              ) : liveStatus.isDone ? (
                                <span style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  padding: "2px 7px",
                                  borderRadius: 5,
                                  background: "#065F4640",
                                  border: "1px solid #10B98160",
                                  color: "#6EE7B7",
                                  fontSize: 9.5,
                                  fontWeight: 800
                                }}>
                                  ✓ SELESAI
                                </span>
                              ) : (
                                <span style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  padding: "2px 7px",
                                  borderRadius: 5,
                                  background: "#1E293B",
                                  border: "1px solid #334155",
                                  color: "#94A3B8",
                                  fontSize: 9.5,
                                  fontWeight: 700
                                }}>
                                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#64748B" }} />
                                  BELUM DIMULAI
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 10.5, color: "#94A3B8", display: "flex", alignItems: "center", gap: 6, marginTop: 2, flexWrap: "wrap" }}>
                              <span>Mitra CMT Jahit {liveStatus.vendorKontak ? `• 0${liveStatus.vendorKontak.replace(/^0+/, '')}` : ""}</span>
                              {po.status === "Dikerjakan" && po.mulai_kerja_at && (
                                <span style={{ color: "#34D399", fontSize: 9.5, fontWeight: 700 }}>
                                  • Mulai pk {new Date(po.mulai_kerja_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Quick Vendor Action Links */}
                        <div style={{ display: "flex", gap: 5 }}>
                          {po.vendorId && (
                            <Link
                              href={`/cmt/${po.vendorId}`}
                              target="_blank"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "4px 8px",
                                borderRadius: 6,
                                background: "#1E293B",
                                border: "1px solid #334155",
                                color: "#38BDF8",
                                fontSize: 10.5,
                                fontWeight: 800,
                                textDecoration: "none"
                              }}
                              title="Buka portal live CMT ini di tab baru"
                            >
                              <ExternalLink size={11} /> Portal CMT
                            </Link>
                          )}
                          {liveStatus.vendorKontak && (
                            <a
                              href={waLink(
                                liveStatus.vendorKontak,
                                `Halo ${liveStatus.vendorNama}, kami konfirmasi pengerjaan SPK ${po.noPo} (${po.model}). Dari total ${po.jumlahTerbit} pcs, telah dilaporkan ${liveStatus.totalLapor} pcs (ACC ${liveStatus.totalACC} pcs), sisa ${liveStatus.sisaPcs} pcs. Target dateline: ${fmtDate(poTargetDate)}${isPoLate ? ` (Terlambat ${poLateDays} hari!)` : ''}. Mohon informasinya, terima kasih.`
                              )}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "4px 8px",
                                borderRadius: 6,
                                background: "#065F46",
                                border: "1px solid #059669",
                                color: "#A7F3D0",
                                fontSize: 10.5,
                                fontWeight: 800,
                                textDecoration: "none"
                              }}
                              title="Kirim pesan penagihan via WhatsApp"
                            >
                              <MessageCircle size={11} /> WA
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Progress Bar (Diserahkan / Dilaporkan) */}
                      <div style={{ background: "#1E293B", borderRadius: 8, padding: "8px 10px", marginBottom: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                          <span style={{ fontSize: 9.5, color: "#94A3B8", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                            Progres Diserahkan
                          </span>
                          <span style={{ fontSize: 11.5, fontWeight: 900, color: liveStatus.pct >= 100 ? "#10B981" : "#38BDF8" }}>
                            {liveStatus.totalLapor.toLocaleString("id-ID")} / {liveStatus.totalTarget.toLocaleString("id-ID")} pcs ({liveStatus.pct}%)
                          </span>
                        </div>
                        <div style={{ width: "100%", background: "#0F172A", height: 7, borderRadius: 4, overflow: "hidden" }}>
                          <div
                            style={{
                              background: liveStatus.pct >= 100 ? "#10B981" : "linear-gradient(90deg, #3B82F6 0%, #8B5CF6 100%)",
                              height: "100%",
                              width: `${Math.min(liveStatus.pct, 100)}%`,
                              borderRadius: 4,
                              transition: "width 0.6s ease"
                            }}
                          />
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#94A3B8", marginTop: 4 }}>
                          <span style={{ color: "#34D399", fontWeight: 700 }}>✓ {liveStatus.totalACC} pcs Diverifikasi (ACC)</span>
                          <span style={{ color: liveStatus.sisaPcs > 0 ? "#FCA5A5" : "#94A3B8", fontWeight: 700 }}>
                            {liveStatus.sisaPcs > 0 ? `📦 ${liveStatus.sisaPcs} pcs Belum Diserahkan` : "Selesai"}
                          </span>
                        </div>
                      </div>

                      {/* Rincian per Size Breakdown (Matching CMT Portal Screenshot) */}
                      {liveStatus.sizeList && liveStatus.sizeList.length > 0 && (
                        <div>
                          <div style={{ fontSize: 9.5, color: "#64748B", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 }}>
                            Rincian per Size:
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(liveStatus.sizeList.length, 5)}, 1fr)`, gap: 5 }}>
                            {liveStatus.sizeList.map((s: any, idx: number) => (
                              <div
                                key={idx}
                                style={{
                                  background: "#1E293B",
                                  padding: "6px 4px",
                                  borderRadius: 6,
                                  border: s.isComplete ? "1px solid #10B981" : s.pending > 0 ? "1px solid #F59E0B" : "1px solid #334155",
                                  textAlign: "center"
                                }}
                              >
                                <div style={{ fontSize: 11, fontWeight: 900, color: "#FFFFFF" }}>{s.size}</div>
                                <div style={{ fontSize: 10, fontWeight: 800, color: s.isComplete ? "#10B981" : "#94A3B8", marginTop: 1 }}>
                                  {s.done}/{s.target}
                                </div>
                                {s.pending > 0 && (
                                  <div style={{ fontSize: 8.5, fontWeight: 800, color: "#F59E0B" }}>+{s.pending}</div>
                                )}
                                <div style={{ width: "100%", background: "#0F172A", height: 3, borderRadius: 2, marginTop: 3, overflow: "hidden" }}>
                                  <div style={{ width: `${Math.min(s.pct, 100)}%`, height: "100%", background: s.isComplete ? "#10B981" : "#38BDF8" }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Context: Realtime Working Banner OR Initial Cutting Done */}
                  {po.status === "Dikerjakan" ? (
                    <div style={{
                      background: "#F0FDF4",
                      border: "1.5px solid #86EFAC",
                      borderRadius: 10,
                      padding: "9px 12px",
                      marginBottom: 10,
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      boxShadow: "0 1px 4px rgba(16,185,129,0.08)"
                    }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: "#DCFCE7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Play size={14} color="#16A34A" />
                      </div>
                      <div style={{ flex: 1, fontSize: 11.5 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 800, color: "#166534" }}>
                          <span>Sedang Dikerjakan oleh {liveStatus?.vendorNama || "CMT"}</span>
                          <span style={{
                            fontSize: 9,
                            fontWeight: 900,
                            background: "#16A34A",
                            color: "#FFFFFF",
                            padding: "1px 6px",
                            borderRadius: 4,
                            letterSpacing: "0.03em"
                          }}>
                            REALTIME
                          </span>
                        </div>
                        <div style={{ color: "#374151", marginTop: 2 }}>
                          Vendor telah mengonfirmasi <strong>Mulai Mengerjakan</strong> di Portal Vendor.
                          {po.mulai_kerja_at ? ` Waktu mulai: pk ${new Date(po.mulai_kerja_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB.` : " Progres pengerjaan berjalan live."}
                        </div>
                      </div>
                    </div>
                  ) : isInitialCutting ? (
                    <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10, padding: "9px 12px", marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: "#DCFCE7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Scissors size={15} color="#16A34A" />
                      </div>
                      <div style={{ flex: 1, fontSize: 11.5 }}>
                        <div style={{ fontWeight: 800, color: "#166534" }}>
                          Kain Selesai Dipotong & Sudah Dialokasikan
                        </div>
                        <div style={{ color: "#475569", marginTop: 1 }}>
                          Total {po.jumlahTerbit.toLocaleString("id-ID")} pcs telah dipotong dan diserahkan ke <strong>{liveStatus?.vendorNama || "CMT"}</strong> untuk proses jahit.
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* Context: Forwarded Downstream Transfers (Washing, Gudang, dll) */}
                  {(() => {
                    const allTfs = (liveStatus?.allPoTransfers || []).filter((tf: any) => Number(tf.jumlah_kirim) > 0 && tf.status !== "Ditarik Penuh");
                    if (allTfs.length === 0) return null;

                    // Kelompokkan transfer berdasarkan pos tujuan (washing, gudang, dll)
                    const stageGroups: Record<string, any[]> = {};
                    allTfs.forEach((tf: any) => {
                      const st = tfIsGudang(tf) ? "gudang" : normalizeStage(tf.ke);
                      if (!stageGroups[st]) stageGroups[st] = [];
                      stageGroups[st].push(tf);
                    });

                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
                        {Object.entries(stageGroups).map(([stKey, tfs]) => {
                          const isWashing = stKey === "washing";
                          const isGudang = stKey === "gudang" || stKey === "qc_bahan";
                          const stageTitle = isWashing ? "Dialihkan ke Pos Washing" : isGudang ? "Dialihkan ke Gudang Produksi" : `Dialihkan ke Pos ${tfStageName(tfs[0])}`;
                          const totalStagePcs = tfs.reduce((s: number, t: any) => s + Number(t.jumlah_kirim || 0), 0);
                          const headerColor = isWashing ? "#2563EB" : isGudang ? "#6366F1" : "#059669";
                          const HeaderIcon = isWashing ? Droplets : isGudang ? Package : Truck;

                          return (
                            <div key={stKey} style={{ background: isGudang ? "#EEF2FF" : "#F8FAFC", border: `1px solid ${isGudang ? "#C7D2FE" : "#E2E8F0"}`, borderRadius: 10, padding: "9px 12px" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 800, color: "#0F172A" }}>
                                  <HeaderIcon size={14} color={headerColor} />
                                  <span>{stageTitle}</span>
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 800, color: headerColor }}>
                                  {totalStagePcs.toLocaleString("id-ID")} pcs
                                </span>
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                                {tfs.map((tf: any, i: number) => {
                                  const info = transferStatusInfo(tf);
                                  const ready = tf.vendor_id == null
                                    ? getTransferSources(po.id).filter(s => s.id === String(tf.id))
                                    : getReadyFromJob(tf);
                                  const readyTotal = ready.reduce((s, r) => s + r.total, 0);
                                  const isReject = tf.status === "Reject" || (Number(tf.jumlah_reject || 0) >= Number(tf.jumlah_kirim || 0) && Number(tf.jumlah_kirim || 0) > 0) || (Boolean(tf.no_nota_reject) && Number(tf.progress?.approved || 0) <= 0);
                                  const isRework = !isReject && (tf.status === "Retur Perbaikan" || tf.is_rework || String(tf.status || "").toLowerCase().includes("retur"));
                                  const isGudangTf = isGudang || normalizeStage(tf.ke) === "gudang" || tf.ke === "qc_bahan";
                                  const isMenungguVerifikasi = !isReject && !isRework && isGudangTf && (tf.status === "Kirim" || tf.status === "Pending");
                                  const isSudahVerifikasi = !isReject && !isRework && isGudangTf && (tf.status === "Diverifikasi" || tf.status === "Selesai");

                                  return (
                                    <div key={i} title={info.hint} style={{ 
                                      display: "flex", 
                                      justifyContent: "space-between", 
                                      alignItems: "center", 
                                      fontSize: 11, 
                                      color: "#475569", 
                                      background: isReject ? "#FFFBFB" : isRework ? "#FFFBEB" : "#FFFFFF", 
                                      padding: "6px 8px", 
                                      borderRadius: 6, 
                                      border: `1.5px solid ${isReject ? "#FCA5A5" : isRework ? "#FCD34D" : isMenungguVerifikasi ? "#FCD34D" : "#E2E8F0"}`, 
                                      gap: 6,
                                      flexWrap: "wrap"
                                    }}>
                                      <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                                          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            &bull;{" "}
                                            {tf.vendor_id != null ? (
                                              <>
                                                <strong style={{ color: isReject ? "#991B1B" : isRework ? "#92400E" : "#0F172A", fontWeight: 800 }}>{getVendorName(tf.vendor_id)}</strong>
                                                {tf.catatan && !["ACC Request", "Otomatis dari ACC Progres"].includes(tf.catatan) && !isRework && !isReject && (
                                                  <span style={{ color: "#64748B", fontSize: 10, marginLeft: 5 }}>({tf.catatan})</span>
                                                )}
                                              </>
                                            ) : tf.catatan ? (
                                              <span style={{ color: "#475569" }}>{tf.catatan}</span>
                                            ) : (
                                              <em style={{ color: "#B45309" }}>Standby (belum ada vendor)</em>
                                            )}
                                          </span>
                                        </div>
                                        {isReject && (
                                          <div style={{ fontSize: 10, color: "#DC2626", fontWeight: 700, display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                                            <span>🛑 Barang Rusak / Reject{tf.reject_log?.[0]?.alasan ? `: ${tf.reject_log[0].alasan}` : tf.alasan_reject ? `: ${tf.alasan_reject}` : ""} · Diterbitkan Nota Klaim Ganti Rugi</span>
                                          </div>
                                        )}
                                        {isRework && (
                                          <div style={{ fontSize: 10, color: "#B45309", fontWeight: 700, display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                                            <span>⚠️ Perbaikan / Rework{tf.alasan_retur ? `: ${tf.alasan_retur}` : tf.catatan ? `: ${tf.catatan}` : ""}</span>
                                          </div>
                                        )}
                                      </div>
                                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                                        <strong style={{ color: isReject ? "#DC2626" : isRework ? "#92400E" : "#0F172A" }}>{Number(tf.jumlah_kirim || 0).toLocaleString("id-ID")} pcs</strong>
                                        
                                        {/* Status Chip */}
                                        {isReject ? (
                                          <span
                                            onClick={(e) => {
                                              if (tf.no_nota_reject) {
                                                e.stopPropagation();
                                                handleOpenNotaReject(tf);
                                              }
                                            }}
                                            style={{ 
                                              fontSize: 9.5, 
                                              padding: "2px 7px", 
                                              borderRadius: 4, 
                                              background: "#FEF2F2", 
                                              color: "#991B1B", 
                                              border: "1px solid #F87171", 
                                              fontWeight: 800, 
                                              whiteSpace: "nowrap",
                                              display: "inline-flex",
                                              alignItems: "center",
                                              gap: 4,
                                              cursor: tf.no_nota_reject ? "pointer" : "default"
                                            }}
                                            title={tf.no_nota_reject ? `Klik untuk melihat / cetak Nota Klaim ${tf.no_nota_reject}` : "Barang Rusak Permanen / Reject"}
                                          >
                                            <AlertOctagon size={10} color="#DC2626" />
                                            Reject {tf.no_nota_reject ? `(${tf.no_nota_reject})` : ""}
                                          </span>
                                        ) : (
                                          <span style={{ 
                                            fontSize: 9.5, 
                                            padding: "2px 7px", 
                                            borderRadius: 4, 
                                            background: isRework ? "#FEF3C7" : isMenungguVerifikasi ? "#FEF3C7" : isSudahVerifikasi ? "#DCFCE7" : info.bg, 
                                            color: isRework ? "#92400E" : isMenungguVerifikasi ? "#92400E" : isSudahVerifikasi ? "#166534" : info.color, 
                                            border: `1px solid ${isRework ? "#F59E0B" : isMenungguVerifikasi ? "#FCD34D" : isSudahVerifikasi ? "#BBF7D0" : info.border}`, 
                                            fontWeight: 800, 
                                            whiteSpace: "nowrap",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: 4
                                          }}>
                                            {isRework ? (
                                              <>
                                                <RotateCcw size={10} color="#D97706" />
                                                Retur Perbaikan {tf.rework_count && tf.rework_count > 1 ? `(Ke-${tf.rework_count})` : ""}
                                              </>
                                            ) : isMenungguVerifikasi ? (
                                              <>
                                                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#F59E0B" }} />
                                                Menunggu Verifikasi Gudang
                                              </>
                                            ) : isSudahVerifikasi ? (
                                              <>
                                                <Check size={10} color="#166534" />
                                                Masuk Gudang (Selesai)
                                              </>
                                            ) : (
                                              <>
                                                {tf.status === "Dikerjakan" && <span style={{ width: 5, height: 5, borderRadius: "50%", background: info.color }} />}
                                                {info.short}
                                              </>
                                            )}
                                          </span>
                                        )}

                                        {/* Tombol Langsung Verifikasi Terima di Gudang */}
                                        {isMenungguVerifikasi && (
                                          <button
                                            type="button"
                                            id={`verif-gudang-${tf.id}`}
                                            title="Verifikasi terima barang ini masuk ke stok Gudang"
                                            onClick={() => handleVerifikasiGudang(tf)}
                                            style={{
                                              fontSize: 9.5,
                                              fontWeight: 800,
                                              padding: "3px 8px",
                                              borderRadius: 5,
                                              border: "none",
                                              background: "linear-gradient(135deg, #059669 0%, #10B981 100%)",
                                              color: "#FFFFFF",
                                              cursor: "pointer",
                                              whiteSpace: "nowrap",
                                              display: "inline-flex",
                                              alignItems: "center",
                                              gap: 4,
                                              boxShadow: "0 1px 3px rgba(16,185,129,0.3)"
                                            }}
                                          >
                                            <CheckCircle2 size={11} /> Verifikasi Terima
                                          </button>
                                        )}

                                        {/* Forward button if ready */}
                                        {!isReject && readyTotal > 0 && (
                                          <button
                                            type="button"
                                            id={`kirim-hasil-${tf.id}`}
                                            title={`Kirim ${readyTotal} pcs hasil ${tf.vendor_id == null ? "standby" : getVendorName(tf.vendor_id)} ke pos berikutnya`}
                                            onClick={() => openTransferModal(po, activeStageObj, ready[0].id)}
                                            style={{ fontSize: 9.5, fontWeight: 800, padding: "2px 7px", borderRadius: 4, border: "none", background: "#2563EB", color: "#fff", cursor: "pointer", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 3 }}
                                          >
                                            <Send size={9} /> Kirim {readyTotal}
                                          </button>
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
                    );
                  })()}

                  {/* Stage-specific Distributions (e.g. at Washing stage) */}
                  {!isInitialCutting && !isJahitStage && (
                    <div style={{ marginBottom: 10 }}>
                      {dists.length === 0 ? (
                        <div style={{ fontSize: 11.5, color: "#64748B", textAlign: "center", padding: "12px 10px", background: "#F8FAFC", borderRadius: 10, border: "1px dashed #CBD5E1" }}>
                          Belum ada transfer pengiriman di tahap ini
                        </div>
                      ) : (
                        dists.map((d, i) => (
                          <div key={i} style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, padding: 10, marginBottom: 6 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                              <span style={{ fontSize: 12.5, fontWeight: 800, color: "#0F172A" }}>{d.vendor_nama}</span>
                              <span style={{ fontSize: 12, fontWeight: 900, color: "#2563EB" }}>{d.qty_total} pcs</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748B" }}>
                              <span>Target: {fmtDate(d.target_selesai)}</span>
                              <span style={{ 
                                fontWeight: 700, 
                                color: (d as any).info?.color || (d.status === "Selesai" ? "#10B981" : d.status === "Dikerjakan" ? "#2563EB" : "#2563EB"),
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4
                              }}>
                                {d.status === "Dikerjakan" && (
                                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#2563EB" }} />
                                )}
                                {d.status === "Dikerjakan" ? "Sedang Dikerjakan" : d.status}
                              </span>
                            </div>
                            {(d as any).info?.hint && (
                              <div style={{ fontSize: 10.5, color: "#64748B", marginTop: 3 }}>{(d as any).info.hint}</div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Tertandon Warning (Only for subsequent stages if pending) */}
                  {!isInitialCutting && tertandon > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#FEF2F2", borderRadius: 10, border: "1px solid #FECACA", marginBottom: 10 }}>
                      <AlertTriangle size={14} color="#DC2626" />
                      <span style={{ fontSize: 11.5, color: "#991B1B", fontWeight: 700 }}>
                        {tertandon} pcs masih menunggu ditransfer ke pos ini
                      </span>
                    </div>
                  )}

                  {/* Card Action Buttons */}
                  <div style={{ marginTop: "auto", paddingTop: 14, borderTop: "1px solid #F1F5F9", display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center" }}>
                    <Link
                      href={`/cetak-po/${po.id}`}
                      style={{
                        padding: "7px 12px",
                        fontSize: 12,
                        borderRadius: 8,
                        border: "1px solid #CBD5E1",
                        background: "#FFFFFF",
                        color: "#475569",
                        textDecoration: "none",
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4
                      }}
                      title="Lihat Dokumen Nota SPK"
                    >
                      <Eye size={13} color="#2563EB" /> SPK
                    </Link>

                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => openTransferModal(po, activeStageObj)}
                        style={{
                          padding: "7px 14px",
                          fontSize: 12,
                          borderRadius: 8,
                          border: "none",
                          background: "linear-gradient(135deg, #1E40AF 0%, #2563EB 100%)",
                          color: "#FFFFFF",
                          fontWeight: 800,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          boxShadow: "0 2px 6px rgba(37,99,235,0.2)"
                        }}
                      >
                        <Send size={13} /> Kirim ke Pos Berikutnya
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* BOTTOM COMFORT SPACER & STATUS BAR */}
      <div style={{
        marginTop: 24,
        padding: "16px 22px",
        background: "#FFFFFF",
        borderRadius: 14,
        border: "1px solid #E2E8F0",
        boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 14,
        color: "#64748B",
        fontSize: 12
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#10B981", boxShadow: "0 0 0 3px #DCFCE7" }} />
          <span>Pipeline produksi aktif &bull; Menampilkan <strong>{filteredActivePoItems.length} SPK</strong> dalam tahap <strong>{activeStageObj?.nama}</strong></span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 12 }}>
            Total Produksi: <strong style={{ color: "#0F172A" }}>{filteredActivePoItems.reduce((s, p) => s + (getPO(p.po_id)?.jumlahTerbit || 0), 0).toLocaleString("id-ID")} pcs</strong>
          </span>
          <button
            onClick={() => document.querySelector(".app-content")?.scrollTo({ top: 0, behavior: "smooth" })}
            style={{
              background: "#F8FAFC",
              border: "1px solid #CBD5E1",
              borderRadius: 8,
              padding: "6px 14px",
              fontSize: 11.5,
              fontWeight: 800,
              color: "#334155",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              transition: "all 0.2s"
            }}
          >
            ↑ Kembali ke Atas
          </button>
        </div>
      </div>

      {/* MODAL UPDATE STATUS TAHAP */}
      {statusModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div style={{ background: "white", width: "100%", maxWidth: 440, borderRadius: 16, overflow: "hidden", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}>
            <div style={{ padding: "18px 24px", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563EB" }}>
                  <Edit3 size={16} />
                </div>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 900, color: "#0F172A", margin: 0 }}>
                    Ubah Status: {statusModal.stageName}
                  </h3>
                  <div style={{ fontSize: 12, color: "#64748B" }}>PO: {statusModal.noPo}</div>
                </div>
              </div>
              <button onClick={() => setStatusModal(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B" }}>
                <X size={18} />
              </button>
            </div>
            
            <div style={{ padding: 24 }}>
              <label style={{ display: "block", fontWeight: 700, fontSize: 12.5, color: "#334155", marginBottom: 10 }}>
                Pilih Status Pengerjaan Pos Ini:
              </label>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { value: "Menunggu", label: "Menunggu Antrean", desc: "Barang belum dikerjakan / masih menunggu vendor." },
                  { value: "Proses", label: "Sedang Berlangsung (Proses)", desc: "Pekerja / Vendor sedang aktif memproses barang." },
                  { value: "Selesai", label: "Selesai di Pos Ini", desc: "Tahap ini selesai & otomatis memajukan antrean ke pos berikutnya." }
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSaveStatus(opt.value)}
                    disabled={isSubmitting}
                    style={{
                      textAlign: "left",
                      padding: "12px 14px",
                      borderRadius: 10,
                      border: statusModal.currentStatus === opt.value ? "2px solid #2563EB" : "1px solid #E2E8F0",
                      background: statusModal.currentStatus === opt.value ? "#EFF6FF" : "#FFFFFF",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between"
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>{opt.label}</div>
                      <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 2 }}>{opt.desc}</div>
                    </div>
                    {statusModal.currentStatus === opt.value && (
                      <Check size={16} color="#2563EB" />
                    )}
                  </button>
                ))}
              </div>

              <div style={{ marginTop: 20, textAlign: "right" }}>
                <button
                  type="button"
                  onClick={() => setStatusModal(null)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "1px solid #CBD5E1",
                    background: "#FFFFFF",
                    color: "#475569",
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TRANSFER BARANG KE POS BERIKUTNYA */}
      {transferModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div style={{ background: "white", width: "100%", maxWidth: 720, maxHeight: "92vh", borderRadius: 18, overflow: "hidden", boxShadow: "0 25px 60px rgba(0,0,0,0.3)", display: "flex", flexDirection: "column" }}>
            
            {/* Modal Header */}
            <div style={{ padding: "18px 24px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(135deg, #F8FAFC, #EFF6FF)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "#DBEAFE", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563EB" }}>
                  <Send size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: "#0F172A" }}>
                    Kirim Barang ke Pos Berikutnya
                  </h3>
                  <div style={{ fontSize: 12, color: "#64748B" }}>PO: {transferModal.po.noPo} ({transferModal.po.model})</div>
                </div>
              </div>
              <button onClick={() => setTransferModal(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B" }}>
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            {(() => {
              const selectedVendorWorkload = transferForm.vendor_id ? getVendorWorkload(Number(transferForm.vendor_id)) : null;
              const tfSources = getTransferSources(transferModal.po.id);
              const tfSrc = tfSources.find(s => s.id === transferForm.sumber_id) || null;
              const tfLegacy = transferForm.sumber_id === "po";
              const tfMaxSizes: any[] = tfSrc ? tfSrc.sizes : tfLegacy ? (transferModal.po.sizeBreakdown || []) : [];
              const tfTotal = tfMaxSizes.length
                ? Object.values(transferForm.sizes).reduce((s, v) => s + (Number(v) || 0), 0)
                : Number(transferForm.jumlah_kirim || 0);
              const tfMaxTotal = tfSrc ? tfSrc.total : Number(transferModal.po.jumlahTerbit || 0);
              const minUrutan = tfSrc ? tfSrc.fromUrutan : (transferModal.currentStage?.urutan || 0);

              return (
                <form onSubmit={handleSubmitTransfer} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
                  <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, overflowY: "auto", flex: 1, minHeight: 0 }}>

                    {/* LIVE REALTIME NOTICE (saat modal sedang terbuka) */}
                    {liveNotice && (
                      <div style={{
                        padding: "12px 14px",
                        borderRadius: 10,
                        background: liveNotice.tone === "warn" ? "#FEF3C7" : "#EFF6FF",
                        border: `1.5px solid ${liveNotice.tone === "warn" ? "#F59E0B" : "#3B82F6"}`,
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                      }}>
                        <Zap size={18} color={liveNotice.tone === "warn" ? "#D97706" : "#2563EB"} style={{ flexShrink: 0, marginTop: 1 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 800, color: liveNotice.tone === "warn" ? "#92400E" : "#1E40AF" }}>
                            ⚡ Peringatan Realtime (Aktivitas Bersamaan)
                          </div>
                          <div style={{ fontSize: 11.5, color: liveNotice.tone === "warn" ? "#78350F" : "#1E3A8A", marginTop: 2, lineHeight: 1.45 }}>
                            {liveNotice.text}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setLiveNotice(null)}
                          style={{ background: "none", border: "none", color: "#92400E", cursor: "pointer", fontSize: 11, fontWeight: 700 }}
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    {/* CONFLICT / RACE-CONDITION RESOLUTION PANEL (HTTP 409) */}
                    {conflict && conflict.code === "RESERVED" && (
                      <div style={{
                        padding: "16px",
                        borderRadius: 12,
                        background: "#FEF2F2",
                        border: "2px solid #EF4444",
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                        boxShadow: "0 4px 12px rgba(239, 68, 68, 0.15)"
                      }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                          <AlertTriangle size={22} color="#DC2626" style={{ flexShrink: 0, marginTop: 2 }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 900, color: "#991B1B" }}>
                              ⚠️ Bentrok Data Terdeteksi: Vendor Sedang Meminta Stok Ini!
                            </div>
                            <div style={{ fontSize: 12, color: "#7F1D1D", marginTop: 4, lineHeight: 1.5 }}>
                              {conflict.error}
                            </div>
                            {conflict.reservations && conflict.reservations.length > 0 && (
                              <div style={{ marginTop: 8, padding: "8px 10px", background: "#FFF", borderRadius: 8, border: "1px solid #FECACA" }}>
                                <div style={{ fontSize: 11, fontWeight: 800, color: "#991B1B", marginBottom: 4 }}>Daftar Permohonan Vendor yang Masuk:</div>
                                {conflict.reservations.map((r: any) => (
                                  <div key={r.id} style={{ fontSize: 11.5, color: "#475569", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 0" }}>
                                    <span style={{ fontWeight: 700, color: "#0F172A" }}>• {r.vendor_nama}</span>
                                    <span style={{ fontWeight: 800, color: "#DC2626" }}>{r.sisa} pcs (Pending)</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div style={{ fontSize: 11.5, color: "#475569", marginTop: 6 }}>
                              Stok bebas tanpa menabrak antrean: <b>{conflict.free} pcs</b>. Silakan pilih solusi:
                            </div>
                          </div>
                        </div>

                        {/* Action buttons for resolution */}
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end", paddingTop: 4 }}>
                          {conflict.reservations && conflict.reservations.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const first = conflict.reservations[0];
                                setTransferForm(prev => ({
                                  ...prev,
                                  vendor_id: String(first.vendor_id),
                                  jumlah_kirim: String(first.sisa)
                                }));
                                setConflict(null);
                                toast.info(`Vendor diubah ke ${first.vendor_nama} (${first.sisa} pcs) untuk memenuhi permintaannya. Klik "Kirimkan Barang" untuk konfirmasi.`);
                              }}
                              style={{
                                padding: "7px 12px",
                                borderRadius: 7,
                                border: "1px solid #059669",
                                background: "#10B981",
                                color: "#FFF",
                                fontSize: 11.5,
                                fontWeight: 800,
                                cursor: "pointer"
                              }}
                            >
                              ✓ Penuhi Permintaan {conflict.reservations[0].vendor_nama}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => submitTransfer("tolak")}
                            style={{
                              padding: "7px 12px",
                              borderRadius: 7,
                              border: "1px solid #DC2626",
                              background: "#EF4444",
                              color: "#FFF",
                              fontSize: 11.5,
                              fontWeight: 800,
                              cursor: "pointer"
                            }}
                          >
                            ✕ Tolak Permintaan Vendor &amp; Tetap Kirim
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (conflict.free > 0 && tfSrc) {
                                setTransferForm(prev => ({ ...prev, jumlah_kirim: String(conflict.free) }));
                              }
                              setConflict(null);
                            }}
                            style={{
                              padding: "7px 12px",
                              borderRadius: 7,
                              border: "1px solid #CBD5E1",
                              background: "#FFF",
                              color: "#475569",
                              fontSize: 11.5,
                              fontWeight: 700,
                              cursor: "pointer"
                            }}
                          >
                            Sesuaikan Stok Bebas ({conflict.free} pcs)
                          </button>
                        </div>
                      </div>
                    )}

                    {/* CONFLICT STALE PANEL (Stok sudah berkurang) */}
                    {conflict && conflict.code === "STALE" && (
                      <div style={{
                        padding: "14px 16px",
                        borderRadius: 12,
                        background: "#FFFBEB",
                        border: "1.5px solid #F59E0B",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10
                      }}>
                        <Clock size={20} color="#D97706" style={{ flexShrink: 0, marginTop: 2 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: "#92400E" }}>
                            Stok Sumber Sudah Berubah di Sistem
                          </div>
                          <div style={{ fontSize: 11.5, color: "#78350F", marginTop: 2 }}>
                            {conflict.error}
                            {conflict.last_change ? (
                              <div style={{ marginTop: 4, fontWeight: 600 }}>
                                Terakhir diubah: <i>{conflict.last_change.desc}</i> oleh <b>{conflict.last_change.by}</b>
                              </div>
                            ) : null}
                          </div>
                          <div style={{ marginTop: 8 }}>
                            <button
                              type="button"
                              onClick={() => {
                                if (conflict.current_sizes && conflict.current_sizes.length) {
                                  setTransferForm(prev => ({
                                    ...prev,
                                    sizes: sizesToForm(conflict.current_sizes),
                                    jumlah_kirim: String(conflict.current_total)
                                  }));
                                } else {
                                  setTransferForm(prev => ({ ...prev, jumlah_kirim: String(conflict.current_total || 0) }));
                                }
                                setConflict(null);
                              }}
                              style={{
                                padding: "6px 12px",
                                borderRadius: 6,
                                border: "none",
                                background: "#D97706",
                                color: "#FFF",
                                fontSize: 11.5,
                                fontWeight: 800,
                                cursor: "pointer"
                              }}
                            >
                              Gunakan Stok Terkini ({conflict.current_total ?? 0} pcs)
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* STEP 1: Pilih barang yang dikirim */}
                    <div>
                      <label style={{ display: "block", fontSize: 12.5, fontWeight: 800, color: "#334155", marginBottom: 4 }}>
                        1. Barang Mana yang Dikirim? <span style={{ color: "#EF4444" }}>*</span>
                      </label>
                      <div style={{ fontSize: 11, color: "#64748B", marginBottom: 8 }}>
                        Pilih hasil pekerjaan yang sudah selesai &amp; di-ACC. Asal tahap, vendor dan rincian size akan ikut tercatat.
                      </div>
                      {tfSources.length === 0 ? (
                        <div style={{ padding: "10px 12px", borderRadius: 10, background: "#F8FAFC", border: "1px dashed #CBD5E1", fontSize: 12, color: "#475569" }}>
                          Belum ada hasil tahap yang selesai &amp; di-ACC untuk PO ini. Pengiriman akan diambil dari <b>kuota PO / hasil potong</b> ({transferModal.po.jumlahTerbit} pcs).
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {tfSources.map(s => {
                            const active = transferForm.sumber_id === s.id;
                            const resList = (s.transfer && s.transfer.reservations) || [];
                            const activeVendorPresence = presenceList.filter(
                              p => p.role === "vendor" && (String(p.transfer_id) === String(s.id) || (p.po_id != null && Number(p.po_id) === Number(transferModal.po.id)))
                            );

                            return (
                              <button
                                type="button"
                                key={s.id}
                                id={`sumber-${s.id}`}
                                onClick={() => pickTransferSource(s)}
                                style={{
                                  textAlign: "left",
                                  cursor: "pointer",
                                  padding: "12px 14px",
                                  borderRadius: 10,
                                  border: active ? "2px solid #2563EB" : (resList.length > 0 ? "1.5px solid #FCD34D" : "1px solid #E2E8F0"),
                                  background: active ? "#EFF6FF" : (resList.length > 0 ? "#FFFDF5" : "#FFFFFF"),
                                  display: "flex",
                                  gap: 10,
                                  alignItems: "flex-start",
                                  transition: "all .15s"
                                }}
                              >
                                <span style={{ width: 16, height: 16, borderRadius: "50%", border: active ? "5px solid #2563EB" : "2px solid #CBD5E1", flexShrink: 0, marginTop: 2, background: "#fff" }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                                    <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>
                                      Hasil {s.fromNama}{s.asalVendor ? <> · <span style={{ color: "#2563EB" }}>{s.asalVendor}</span></> : null}
                                    </div>
                                    <div style={{ fontSize: 14, fontWeight: 900, color: "#059669", whiteSpace: "nowrap" }}>{s.total.toLocaleString("id-ID")} pcs</div>
                                  </div>
                                  <div style={{ fontSize: 11, color: "#047857", fontWeight: 600, marginTop: 2 }}>✓ {s.statusText}</div>

                                  {/* Peringatan Permintaan Vendor yang sedang Pending pada sumber ini */}
                                  {resList.length > 0 && (
                                    <div style={{
                                      marginTop: 6,
                                      padding: "4px 8px",
                                      borderRadius: 6,
                                      background: "#FEF3C7",
                                      border: "1px solid #FDE68A",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 6,
                                      fontSize: 10.5,
                                      color: "#92400E",
                                      fontWeight: 700
                                    }}>
                                      <span>⚠️ Permintaan Aktif:</span>
                                      <span>{resList.map((r: any) => `${r.vendor_nama} (${r.sisa} pcs)`).join(", ")}</span>
                                    </div>
                                  )}

                                  {/* Indikator Presence Vendor sedang aktif membuka form permintaan */}
                                  {activeVendorPresence.length > 0 && (
                                    <div style={{
                                      marginTop: 4,
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 5,
                                      fontSize: 10.5,
                                      color: "#2563EB",
                                      fontWeight: 700
                                    }}>
                                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#2563EB", display: "inline-block", animation: "ping 1s cubic-bezier(0, 0, 0.2, 1) infinite" }} />
                                      <span>Live: {activeVendorPresence.map(p => p.name || "Vendor").join(", ")} sedang aktif pada PO ini</span>
                                    </div>
                                  )}

                                  {s.sizes.length > 0 && (
                                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                                      {s.sizes.map((z: any) => (
                                        <span key={z.size} style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 5, background: "#F1F5F9", color: "#334155", border: "1px solid #E2E8F0" }}>{z.size}: {z.jumlah}</span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {(tfSrc || tfLegacy) && (<>
                    {/* Target Stage Select */}
                    <div>
                      <label style={{ display: "block", fontSize: 12.5, fontWeight: 800, color: "#334155", marginBottom: 6 }}>
                        2. Kirim ke Pos Tujuan <span style={{ color: "#EF4444" }}>*</span>
                      </label>
                      <select
                        required
                        style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #CBD5E1", fontSize: 13, outline: "none", background: "#FFFFFF", color: "#0F172A" }}
                        value={transferForm.ke_slug}
                        onChange={e => setTransferForm({ ...transferForm, ke_slug: e.target.value })}
                      >
                        <option value="">-- Pilih Pos Tahap Selanjutnya --</option>
                        {stages.filter(s => s.urutan > minUrutan).map(s => (
                          <option key={s.id} value={s.slug}>Pos #{s.urutan}: {s.nama} ({s.slug})</option>
                        ))}
                      </select>
                      {tfSrc && transferForm.ke_slug && (
                        <div style={{ fontSize: 11, color: "#1E40AF", marginTop: 6, background: "#EFF6FF", padding: "6px 10px", borderRadius: 8, border: "1px solid #BFDBFE" }}>
                          Ringkasan: <b>{tfTotal.toLocaleString("id-ID")} pcs</b> hasil <b>{tfSrc.fromNama}</b>{tfSrc.asalVendor ? <> dari <b>{tfSrc.asalVendor}</b></> : null} → <b>{stageNameBySlug(transferForm.ke_slug)}</b>
                        </div>
                      )}
                    </div>

                    {/* ===== VENDOR PICKER: DETAIL KAPASITAS, TUNGGAKAN & KETERLAMBATAN ===== */}
                    {(() => {
                      const targetType = stageVendorType(transferForm.ke_slug);
                      const targetStageName = stageNameBySlug(transferForm.ke_slug);
                      const allWl = vendors
                        .map(v => getVendorWorkload(v.id))
                        .filter(Boolean) as any[];
                      const matching = targetType ? allWl.filter(w => (w.vendorTipe || "").toLowerCase() === targetType) : allWl;
                      const others = targetType ? allWl.filter(w => (w.vendorTipe || "").toLowerCase() !== targetType) : [];
                      const sortWl = (a: any, b: any) => b.score - a.score;
                      matching.sort(sortWl); others.sort(sortWl);
                      const list = showAllVendors ? [...matching, ...others] : matching;
                      const bestId = matching.length ? matching[0].vendorId : null;
                      const problemCount = matching.filter(w => w.hasOverdue).length;

                      const lvl = (w: any) => w.capacityLevel === "safe"
                        ? { bg: "#F0FDF4", bd: "#86EFAC", fg: "#166534", chip: "#DCFCE7", dot: "#16A34A", icon: "🟢" }
                        : w.capacityLevel === "medium"
                          ? { bg: "#FFFBEB", bd: "#FCD34D", fg: "#92400E", chip: "#FEF3C7", dot: "#D97706", icon: "🟡" }
                          : { bg: "#FEF2F2", bd: "#FCA5A5", fg: "#991B1B", chip: "#FEE2E2", dot: "#DC2626", icon: "🔴" };

                      return (
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
                            <div>
                              <label style={{ fontSize: 12.5, fontWeight: 800, color: "#334155", display: "block" }}>
                                Pilih Vendor Mitra Penerima
                              </label>
                              <span style={{ fontSize: 11, color: "#64748B" }}>
                                {targetType
                                  ? <>Menampilkan vendor <b>{targetType.toUpperCase()}</b> yang cocok untuk tahap <b>{targetStageName}</b> — diurutkan dari yang paling layak</>
                                  : "Diurutkan dari vendor dengan skor kelayakan tertinggi"}
                              </span>
                            </div>
                            {others.length > 0 && (
                              <button type="button" onClick={() => setShowAllVendors(!showAllVendors)}
                                style={{ fontSize: 11, fontWeight: 700, color: "#2563EB", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 6, padding: "4px 8px", cursor: "pointer" }}>
                                {showAllVendors ? "Hanya vendor yang cocok" : `+ Tampilkan ${others.length} vendor lain`}
                              </button>
                            )}
                          </div>

                          {/* Ringkasan masalah vendor di tahap ini */}
                          {problemCount > 0 && (
                            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "9px 12px", marginBottom: 10 }}>
                              <AlertTriangle size={16} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
                              <div style={{ fontSize: 11.5, color: "#7F1D1D", lineHeight: 1.45 }}>
                                <b>{problemCount} dari {matching.length} vendor {targetType ? targetType : ""}</b> sedang memiliki pekerjaan yang <b>terlambat</b>. Periksa rincian tunggakan di bawah sebelum memilih agar barang tidak semakin menumpuk.
                              </div>
                            </div>
                          )}

                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {/* Opsi internal */}
                            <button type="button" onClick={() => { setTransferForm({ ...transferForm, vendor_id: "" }); setRiskAck(false); }}
                              style={{ textAlign: "left", padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                                border: !transferForm.vendor_id ? "2px solid #2563EB" : "1px solid #E2E8F0",
                                background: !transferForm.vendor_id ? "#EFF6FF" : "#FFFFFF", display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${!transferForm.vendor_id ? "#2563EB" : "#CBD5E1"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {!transferForm.vendor_id && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2563EB" }} />}
                              </div>
                              <div>
                                <div style={{ fontSize: 12.5, fontWeight: 800, color: "#0F172A" }}>Internal / Tanpa Vendor</div>
                                <div style={{ fontSize: 11, color: "#64748B" }}>Dikerjakan tim sendiri (gudang / produksi internal)</div>
                              </div>
                            </button>

                            {list.length === 0 && (
                              <div style={{ fontSize: 12, color: "#64748B", textAlign: "center", padding: 14, border: "1px dashed #CBD5E1", borderRadius: 10 }}>
                                Belum ada vendor bertipe <b>{targetType}</b>. Klik "Tampilkan vendor lain" atau tambahkan di menu Atur Vendor.
                              </div>
                            )}

                            {list.map((w: any) => {
                              const c = lvl(w);
                              const selected = String(transferForm.vendor_id) === String(w.vendorId);
                              const expanded = selected || expandedVendorId === w.vendorId;
                              const isMatch = !targetType || (w.vendorTipe || "").toLowerCase() === targetType;
                              const overdueList = w.unfinishedPOs.filter((u: any) => u.isOverdue);
                              const waText = overdueList.length
                                ? `Halo ${w.vendorNama}, mohon update progres pekerjaan berikut yang sudah melewati target:\n` +
                                  overdueList.map((u: any) => `- ${u.noPo} (${u.model}) sisa ${u.sisaPcs} pcs, target ${fmtDate(u.target_selesai)} (+${u.overdueDays} hari)`).join("\n") +
                                  `\nKapan bisa diselesaikan? Terima kasih.`
                                : `Halo ${w.vendorNama}, kami berencana mengirim barang baru. Apakah kapasitas Anda tersedia?`;
                              const wa = waLink(w.kontak, waText);

                              return (
                                <div key={w.vendorId} style={{ borderRadius: 12, border: selected ? `2px solid ${c.dot}` : `1px solid ${w.hasOverdue ? "#FECACA" : "#E2E8F0"}`, background: selected ? c.bg : "#FFFFFF", overflow: "hidden", boxShadow: selected ? `0 4px 14px ${c.dot}22` : "none" }}>
                                  {/* Header vendor (klik untuk pilih) */}
                                  <div role="button" onClick={() => { setTransferForm({ ...transferForm, vendor_id: String(w.vendorId) }); setRiskAck(false); }}
                                    style={{ padding: "10px 12px", cursor: "pointer", display: "flex", gap: 10, alignItems: "flex-start" }}>
                                    <div style={{ width: 16, height: 16, marginTop: 2, borderRadius: "50%", border: `2px solid ${selected ? c.dot : "#CBD5E1"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                      {selected && <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.dot }} />}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                        <span style={{ fontSize: 13, fontWeight: 900, color: "#0F172A" }}>{w.vendorNama}</span>
                                        <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "#F1F5F9", color: "#475569", textTransform: "uppercase" }}>{w.vendorTipe}</span>
                                        {!isMatch && <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "#FFF7ED", color: "#C2410C" }}>Bukan tipe {targetType}</span>}
                                        {w.vendorId === bestId && w.capacityLevel !== "overloaded" && (
                                          <span style={{ fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 4, background: "#DBEAFE", color: "#1D4ED8" }}>⭐ Paling Layak</span>
                                        )}
                                        {(() => {
                                          const vReq = cmtRequests.find((r: any) => r.po_id === transferModal?.po?.id && r.vendor_id === w.vendorId && (r.status === "Pending" || r.status === "Sebagian"));
                                          if (!vReq) return null;
                                          const sisaReq = Math.max(0, Number(vReq.total_request || 0) - Number(vReq.total_dipenuhi || 0));
                                          return (
                                            <span style={{ fontSize: 10, fontWeight: 800, padding: "1px 7px", borderRadius: 4, background: "#FEF3C7", color: "#92400E", border: "1px solid #FCD34D" }}>
                                              📥 Meminta Pekerjaan Ini ({sisaReq} pcs)
                                            </span>
                                          );
                                        })()}
                                      </div>
                                      <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                                        <span style={{ fontSize: 10.5, fontWeight: 800, padding: "2px 7px", borderRadius: 5, background: c.chip, color: c.fg }}>{c.icon} {w.capacityLabel}</span>
                                        <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: "#F8FAFC", color: "#334155", border: "1px solid #E2E8F0" }}>{w.totalActivePO} pekerjaan aktif</span>
                                        <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: "#F8FAFC", color: w.totalPcsUnfinished ? "#B91C1C" : "#166534", border: "1px solid #E2E8F0" }}>{w.totalPcsUnfinished.toLocaleString("id-ID")} pcs belum selesai</span>
                                        {w.hasOverdue && (
                                          <span style={{ fontSize: 10.5, fontWeight: 800, padding: "2px 7px", borderRadius: 5, background: "#FEE2E2", color: "#DC2626", border: "1px solid #FCA5A5" }}>🚨 {w.overdueCount} terlambat · maks +{w.maxOverdueDays} hr</span>
                                        )}
                                      </div>
                                      {selected && (() => {
                                        const vReq = cmtRequests.find((r: any) => r.po_id === transferModal?.po?.id && r.vendor_id === w.vendorId && (r.status === "Pending" || r.status === "Sebagian"));
                                        if (!vReq) return null;
                                        const sisaReq = Math.max(0, Number(vReq.total_request || 0) - Number(vReq.total_dipenuhi || 0));
                                        return (
                                          <div style={{ marginTop: 6, fontSize: 11, color: "#166534", background: "#F0FDF4", padding: "4px 8px", borderRadius: 6, border: "1px solid #BBF7D0", fontWeight: 700 }}>
                                            ✓ Memilih vendor ini otomatis memenuhi permohonan <strong>{w.vendorNama} ({sisaReq} pcs)</strong> dan meneruskan alur produksi.
                                          </div>
                                        );
                                      })()}
                                    </div>
                                    {/* Skor */}
                                    <div style={{ textAlign: "center", flexShrink: 0 }}>
                                      <div style={{ width: 46, height: 46, borderRadius: "50%", background: `conic-gradient(${c.dot} ${w.score * 3.6}deg, #E2E8F0 0deg)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, color: c.fg }}>{w.score}</div>
                                      </div>
                                      <div style={{ fontSize: 9, fontWeight: 700, color: c.fg, marginTop: 2, maxWidth: 70, lineHeight: 1.1 }}>{w.recommendation}</div>
                                    </div>
                                  </div>

                                  {/* Toggle rincian untuk vendor yang belum dipilih */}
                                  {!selected && w.totalActivePO > 0 && (
                                    <button type="button" onClick={() => setExpandedVendorId(expandedVendorId === w.vendorId ? null : w.vendorId)}
                                      style={{ width: "100%", border: "none", borderTop: "1px solid #F1F5F9", background: "#FAFAFA", padding: "5px", fontSize: 11, fontWeight: 700, color: "#475569", cursor: "pointer" }}>
                                      {expanded ? "Sembunyikan rincian ▲" : `Lihat rincian ${w.totalActivePO} pekerjaan ▼`}
                                    </button>
                                  )}

                                  {/* Rincian lengkap */}
                                  {expanded && (
                                    <div style={{ borderTop: `1px solid ${c.bd}`, background: "#FFFFFF", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                                      {/* Alasan / temuan */}
                                      {w.reasons.length > 0 ? (
                                        <div style={{ background: c.bg, border: `1px solid ${c.bd}`, borderRadius: 8, padding: "8px 10px" }}>
                                          <div style={{ fontSize: 11, fontWeight: 800, color: c.fg, marginBottom: 4 }}>Temuan Analisis:</div>
                                          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11.5, color: "#334155", lineHeight: 1.5 }}>
                                            {w.reasons.map((r: string, i: number) => <li key={i}>{r}</li>)}
                                          </ul>
                                          <div style={{ fontSize: 11, color: c.fg, marginTop: 4, fontStyle: "italic" }}>{w.capacityNote}</div>
                                        </div>
                                      ) : (
                                        <div style={{ display: "flex", gap: 8, alignItems: "center", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "#166534", fontWeight: 700 }}>
                                          <CheckCircle2 size={15} /> Tidak ada barang Anda yang tertahan di vendor ini. Siap menerima order baru.
                                        </div>
                                      )}

                                      {/* Ringkasan angka */}
                                      {w.totalActivePO > 0 && (
                                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, textAlign: "center" }}>
                                          {[
                                            { l: "Total Dipegang", v: `${w.totalPcsAssigned.toLocaleString("id-ID")} pcs`, col: "#0F172A" },
                                            { l: "Belum Selesai", v: `${w.totalPcsUnfinished.toLocaleString("id-ID")} pcs`, col: "#B91C1C" },
                                            { l: "Tertahan Lewat Target", v: `${w.overduePcs.toLocaleString("id-ID")} pcs`, col: w.overduePcs ? "#DC2626" : "#16A34A" },
                                            { l: "Rata² Progres", v: `${w.avgProgress}%`, col: "#2563EB" },
                                          ].map((m, i) => (
                                            <div key={i} style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: "6px 4px" }}>
                                              <div style={{ fontSize: 9.5, color: "#64748B", fontWeight: 700 }}>{m.l}</div>
                                              <div style={{ fontSize: 12.5, fontWeight: 900, color: m.col, marginTop: 1 }}>{m.v}</div>
                                            </div>
                                          ))}
                                        </div>
                                      )}

                                      {/* Daftar pekerjaan per PO */}
                                      {w.unfinishedPOs.map((u: any) => (
                                        <div key={u.key} style={{ border: `1px solid ${u.isOverdue ? "#FCA5A5" : "#E2E8F0"}`, borderLeft: `4px solid ${u.isOverdue ? "#DC2626" : (u.sisaHari !== null && u.sisaHari <= 3) ? "#F59E0B" : "#3B82F6"}`, borderRadius: 8, padding: "8px 10px", background: u.isOverdue ? "#FFFBFB" : "#FFFFFF" }}>
                                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                                            <div style={{ minWidth: 0 }}>
                                              <div style={{ fontSize: 12, fontWeight: 900, color: "#0F172A" }}>
                                                <span style={{ fontFamily: "monospace", color: "#1D4ED8" }}>{u.noPo}</span> · {u.model}
                                              </div>
                                              <div style={{ fontSize: 10.5, color: "#64748B", marginTop: 1 }}>
                                                Tahap: <b>{u.tahap}</b> · Status: <b>{u.status}</b>
                                              </div>
                                            </div>
                                            {u.isOverdue ? (
                                              <span style={{ fontSize: 10, fontWeight: 900, color: "#FFFFFF", background: "#DC2626", padding: "2px 7px", borderRadius: 4, whiteSpace: "nowrap" }}>TERLAMBAT +{u.overdueDays} HARI</span>
                                            ) : u.sisaHari !== null ? (
                                              <span style={{ fontSize: 10, fontWeight: 800, color: u.sisaHari <= 3 ? "#92400E" : "#166534", background: u.sisaHari <= 3 ? "#FEF3C7" : "#DCFCE7", padding: "2px 7px", borderRadius: 4, whiteSpace: "nowrap" }}>{u.sisaHari <= 0 ? "Jatuh tempo hari ini" : `Sisa ${u.sisaHari} hari`}</span>
                                            ) : (
                                              <span style={{ fontSize: 10, fontWeight: 700, color: "#64748B", background: "#F1F5F9", padding: "2px 7px", borderRadius: 4 }}>Tanpa dateline</span>
                                            )}
                                          </div>

                                          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginTop: 6, fontSize: 10.5, color: "#475569" }}>
                                            <div>📦 Dikirim: <b>{fmtDate(u.tanggal_kirim)}</b>{u.lamaHari !== null && <> ({u.lamaHari} hr lalu)</>}</div>
                                            <div>🎯 Target: <b style={{ color: u.isOverdue ? "#DC2626" : "#0F172A" }}>{fmtDate(u.target_selesai)}</b></div>
                                            <div>🕒 Update: <b style={{ color: (u.lastReportDays === null || u.lastReportDays > 7) ? "#DC2626" : "#0F172A" }}>{u.lastReport ? `${u.lastReportDays} hr lalu` : "Belum pernah"}</b></div>
                                          </div>

                                          <div style={{ marginTop: 6 }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, marginBottom: 3 }}>
                                              <span style={{ color: "#475569" }}>Selesai <b>{u.selesaiPcs}</b>{u.dilaporPcs > u.selesaiPcs && <> (+{u.dilaporPcs - u.selesaiPcs} menunggu ACC)</>} / {u.totalPcs} pcs</span>
                                              <span style={{ fontWeight: 800, color: u.isOverdue ? "#DC2626" : "#0F172A" }}>Sisa {u.sisaPcs} pcs · {u.progressPct}%</span>
                                            </div>
                                            <div style={{ height: 6, background: "#E2E8F0", borderRadius: 3, overflow: "hidden", position: "relative" }}>
                                              <div style={{ position: "absolute", inset: 0, width: `${Math.min(100, u.totalPcs ? (u.dilaporPcs / u.totalPcs) * 100 : 0)}%`, background: "#FCD34D" }} />
                                              <div style={{ position: "absolute", inset: 0, width: `${u.progressPct}%`, background: u.isOverdue ? "#EF4444" : "#10B981" }} />
                                            </div>
                                          </div>
                                        </div>
                                      ))}

                                      {/* Aksi cepat */}
                                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                                        <Link href={`/cmt/${w.vendorId}`} target="_blank" style={{ fontSize: 11, fontWeight: 700, color: "#1D4ED8", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 6, padding: "5px 10px", textDecoration: "none" }}>
                                          Buka Portal Vendor ↗
                                        </Link>
                                        {wa ? (
                                          <a href={wa} target="_blank" rel="noreferrer" style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF", background: "#16A34A", borderRadius: 6, padding: "5px 10px", textDecoration: "none" }}>
                                            {overdueList.length ? `Tagih ${overdueList.length} PO Terlambat via WA` : "Tanya Kapasitas via WA"}
                                          </a>
                                        ) : (
                                          <span style={{ fontSize: 11, color: "#94A3B8", padding: "5px 4px" }}>No. WA belum diisi</span>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Konfirmasi risiko jika vendor bermasalah */}
                          {selectedVendorWorkload && selectedVendorWorkload.capacityLevel === "overloaded" && (
                            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 10, background: "#FEF2F2", border: "1.5px solid #FCA5A5", borderRadius: 10, padding: "10px 12px", cursor: "pointer" }}>
                              <input type="checkbox" checked={riskAck} onChange={e => setRiskAck(e.target.checked)} style={{ marginTop: 2, accentColor: "#DC2626" }} />
                              <span style={{ fontSize: 11.5, color: "#7F1D1D", lineHeight: 1.45 }}>
                                Saya memahami <b>{selectedVendorWorkload.vendorNama}</b> masih memiliki <b>{selectedVendorWorkload.overdueCount} pekerjaan terlambat</b> ({selectedVendorWorkload.overduePcs.toLocaleString("id-ID")} pcs) dan tetap ingin mengirim barang ke vendor ini.
                              </span>
                            </label>
                          )}
                        </div>
                      );
                    })()}

                    {/* Target Selesai / Dateline di Pos Tujuan */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <label style={{ fontSize: 12.5, fontWeight: 700, color: "#334155" }}>
                          Target Selesai / Dateline di Pos Tujuan <span style={{ color: "#EF4444" }}>*</span>
                        </label>
                        <div style={{ display: "flex", gap: 4 }}>
                          {[3, 5, 7, 14].map(days => (
                            <button
                              type="button"
                              key={days}
                              onClick={() => {
                                const d = new Date();
                                d.setDate(d.getDate() + days);
                                setTransferForm({ ...transferForm, target_selesai: d.toISOString().split("T")[0] });
                              }}
                              style={{
                                fontSize: 10.5,
                                fontWeight: 700,
                                padding: "2px 7px",
                                borderRadius: 4,
                                border: "1px solid #CBD5E1",
                                background: "#F8FAFC",
                                color: "#475569",
                                cursor: "pointer"
                              }}
                            >
                              +{days} Hari
                            </button>
                          ))}
                        </div>
                      </div>
                      <input
                        required
                        type="date"
                        style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #CBD5E1", fontSize: 13, outline: "none", boxSizing: "border-box", fontWeight: 700, color: "#0F172A" }}
                        value={transferForm.target_selesai}
                        onChange={e => setTransferForm({ ...transferForm, target_selesai: e.target.value })}
                      />
                      <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>
                        Batas waktu pengerjaan ini akan dipantau real-time pada pipeline & dashboard.
                      </div>
                    </div>

                    {/* Jumlah Kirim per Size */}
                    <div>
                      <label style={{ display: "block", fontSize: 12.5, fontWeight: 800, color: "#334155", marginBottom: 6 }}>
                        3. Jumlah yang Dikirim {tfMaxSizes.length ? "per Size" : "(Pcs)"} <span style={{ color: "#EF4444" }}>*</span>
                      </label>
                      {tfMaxSizes.length > 0 ? (
                        <>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 8 }}>
                            {tfMaxSizes.map((z: any) => {
                              const max = Number(z.jumlah || 0);
                              const val = transferForm.sizes[String(z.size)] ?? "";
                              const over = Number(val) > max;
                              return (
                                <div key={z.size} style={{ border: `1.5px solid ${over ? "#EF4444" : "#CBD5E1"}`, borderRadius: 8, padding: "6px 8px", background: "#FFFFFF" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 800, color: "#0F172A" }}>
                                    <span>{z.size}</span><span style={{ color: "#94A3B8", fontWeight: 700 }}>maks {max}</span>
                                  </div>
                                  <input
                                    id={`kirim-size-${z.size}`}
                                    type="number"
                                    min="0"
                                    max={max}
                                    value={val}
                                    onChange={e => setTransferForm({ ...transferForm, sizes: { ...transferForm.sizes, [String(z.size)]: e.target.value } })}
                                    style={{ width: "100%", border: "none", outline: "none", fontSize: 15, fontWeight: 900, color: over ? "#DC2626" : "#2563EB", padding: "2px 0", boxSizing: "border-box" }}
                                  />
                                </div>
                              );
                            })}
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, fontSize: 11.5 }}>
                            <span style={{ color: "#64748B" }}>
                              Total dikirim: <b style={{ color: tfTotal > tfMaxTotal ? "#DC2626" : "#0F172A" }}>{tfTotal.toLocaleString("id-ID")}</b> / {tfMaxTotal.toLocaleString("id-ID")} pcs tersedia
                              {tfSrc && tfTotal < tfMaxTotal && tfTotal > 0 && <> · sisa {(tfMaxTotal - tfTotal).toLocaleString("id-ID")} pcs tetap standby</>}
                            </span>
                            <span style={{ display: "flex", gap: 6 }}>
                              <button type="button" onClick={() => setTransferForm({ ...transferForm, sizes: sizesToForm(tfMaxSizes) })} style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 4, border: "1px solid #CBD5E1", background: "#F8FAFC", color: "#475569", cursor: "pointer" }}>Semua</button>
                              <button type="button" onClick={() => setTransferForm({ ...transferForm, sizes: {} })} style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 4, border: "1px solid #CBD5E1", background: "#F8FAFC", color: "#475569", cursor: "pointer" }}>Kosongkan</button>
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <input
                            required
                            type="number"
                            min="1"
                            max={tfMaxTotal}
                            placeholder="e.g. 500"
                            style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #CBD5E1", fontSize: 13, outline: "none", boxSizing: "border-box", fontWeight: 800, color: "#2563EB" }}
                            value={transferForm.jumlah_kirim}
                            onChange={e => setTransferForm({ ...transferForm, jumlah_kirim: e.target.value })}
                          />
                          <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>
                            Maksimum tersedia: {tfMaxTotal} pcs
                          </div>
                        </>
                      )}
                    </div>

                    {/* Catatan */}
                    <div>
                      <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                        Catatan Pengiriman / Surat Jalan
                      </label>
                      <textarea
                        rows={2}
                        placeholder="e.g. Diantar supir truk pukul 14:00, target selesai hari Jumat..."
                        style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1.5px solid #CBD5E1", fontSize: 12.5, outline: "none", resize: "none", boxSizing: "border-box" }}
                        value={transferForm.catatan}
                        onChange={e => setTransferForm({ ...transferForm, catatan: e.target.value })}
                      />
                    </div>
                    </>)}
                  </div>

                  {/* Modal Footer */}
                  <div style={{ padding: "16px 24px", borderTop: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#F8FAFC" }}>
                    <button
                      type="button"
                      onClick={() => setTransferModal(null)}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 8,
                        border: "1px solid #CBD5E1",
                        background: "#FFFFFF",
                        color: "#475569",
                        fontSize: 12.5,
                        fontWeight: 700,
                        cursor: "pointer"
                      }}
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      style={{
                        padding: "9px 20px",
                        borderRadius: 8,
                        border: "none",
                        background: "linear-gradient(135deg, #1E40AF 0%, #2563EB 100%)",
                        color: "#FFFFFF",
                        fontSize: 13,
                        fontWeight: 800,
                        cursor: isSubmitting ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        boxShadow: "0 2px 8px rgba(37,99,235,0.25)",
                        opacity: isSubmitting ? 0.7 : 1
                      }}
                    >
                      <Send size={14} /> {isSubmitting ? "Mengirim..." : "Kirimkan Barang"}
                    </button>
                  </div>
                </form>
              );
            })()}
          </div>
        </div>
      )}

      {/* Modal Nota Reject & Klaim Vendor */}
      {notaRejectModal && (
        <NotaRejectModal
          nota={notaRejectModal}
          onClose={() => setNotaRejectModal(null)}
          vendorKontak={vendors.find((v: any) => v.id === notaRejectModal.vendor_id)?.kontak}
          onSettled={() => {
            fetchAll(true);
            setNotaRejectModal(null);
          }}
          onCancelReject={() => {
            fetchAll(true);
            setNotaRejectModal(null);
          }}
        />
      )}
    </div>
  );
}