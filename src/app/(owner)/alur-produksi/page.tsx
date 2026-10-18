"use client";

import React, { useEffect, useState, useMemo } from "react";
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
  MessageCircle
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

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

  // Modals
  const [statusModal, setStatusModal] = useState<{ po_id: number; stage_id: number; stageName: string; currentStatus: string; noPo: string } | null>(null);
  const [transferModal, setTransferModal] = useState<{ po: any; currentStage: any } | null>(null);
  const [transferForm, setTransferForm] = useState({
    ke_slug: "",
    vendor_id: "",
    jumlah_kirim: "",
    target_selesai: "",
    catatan: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [riskAck, setRiskAck] = useState(false);
  const [showAllVendors, setShowAllVendors] = useState(false);
  const [expandedVendorId, setExpandedVendorId] = useState<number | null>(null);

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
      const [s, pp, po, v, cp, tf] = await Promise.all([
        fetch("/api/pipeline-stages?_t=" + Date.now()).then(r => r.json()).catch(() => []),
        fetch("/api/po-pipeline?_t=" + Date.now()).then(r => r.json()).catch(() => []),
        fetch("/api/po-produksi?_t=" + Date.now()).then(r => r.json()).catch(() => []),
        fetch("/api/vendors?_t=" + Date.now()).then(r => r.json()).catch(() => []),
        fetch("/api/cmt-progres?_t=" + Date.now()).then(r => r.json()).catch(() => []),
        fetch("/api/produksi-transfer?_t=" + Date.now()).then(r => r.json()).catch(() => []),
      ]);
      const sorted = Array.isArray(s) ? s.filter((x: any) => x.aktif).sort((a: any, b: any) => a.urutan - b.urutan) : [];
      setStages(sorted);
      if (sorted.length > 0 && !activeStage) setActiveStage(sorted[0].id);
      setPoPipelines(Array.isArray(pp) ? pp : []);
      setPoProduksi(Array.isArray(po) ? po : []);
      setVendors(Array.isArray(v) ? v : []);
      setCmtProgres(Array.isArray(cp) ? cp : []);
      setTransfers(Array.isArray(tf) ? tf : []);
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
    window.addEventListener("konveksi-sync", handleSync);
    return () => window.removeEventListener("konveksi-sync", handleSync);
  }, []);

  const getPO = (id: number) => poProduksi.find(p => p.id === id);
  const getVendorName = (id?: number) => vendors.find(v => v.id === id)?.nama || "—";

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
        const records = cmtProgres.filter(p => p.po_id === poId);
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
    return relevantTf.map(t => ({
      vendor_id: t.vendor_id,
      vendor_nama: getVendorName(t.vendor_id),
      target_selesai: t.target_selesai,
      qty_total: t.jumlah_kirim,
      qty_lapor: t.jumlah_diterima || 0,
      qty_acc: t.status === "Diterima" ? t.jumlah_kirim : 0,
      type: "transfer",
      status: t.status
    }));
  };

  // Live status summary for a PO (CMT, Washing, per size)
  const getPoLiveStatus = (po: any) => {
    if (!po) return null;
    const vendorObj = vendors.find(v => v.id === po.vendorId) || po.vendor || null;
    const vendorNama = vendorObj?.nama || getVendorName(po.vendorId);
    const vendorKode = vendorObj?.kodeVendor || (po.vendorId ? "CMT-" + String(po.vendorId).padStart(3, "0") : "");
    const vendorKontak = vendorObj?.kontak || "";

    const totalTarget = Number(po.jumlahTerbit) || 0;
    const records = cmtProgres.filter(p => p.po_id === po.id);
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

    return {
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
      totalWashKirim
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

  // Vendor Workload & Capacity Analysis (Kapasitas & Status Barang Belum Selesai)
  const getVendorWorkload = (vendorId: number) => {
    const vendor = vendors.find(v => v.id === vendorId);
    if (!vendor) return null;

    // PO jahit yang ditugaskan langsung ke vendor ini (CMT)
    const activePOs = poProduksi.filter(p => p.vendorId === vendorId && !p.cmt_selesai && p.status !== "Selesai" && p.status !== "Pipeline Selesai" && p.status !== "Closed");
    // Transfer ke vendor ini yang masih dikerjakan (washing, benang, dll)
    const activeTransfers = transfers.filter(t => t.vendor_id === vendorId && (t.status === "Proses" || t.status === "Dikerjakan"));

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
        status: lapor > acc ? "Menunggu ACC laporan" : acc > 0 ? "Sedang dijahit" : "Belum ada laporan progres",
      });
    }

    for (const t of activeTransfers) {
      if (activePOs.find(p => p.id === t.po_id) && stageVendorType(t.ke) === "cmt") continue;
      const po = getPO(t.po_id);
      const diterima = Number(t.jumlah_diterima || 0);
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
        dilaporPcs: diterima,
        sisaPcs: sisa,
        progressPct: t.jumlah_kirim > 0 ? Math.round((diterima / t.jumlah_kirim) * 100) : 0,
        target_selesai: targetDate,
        isOverdue: isOverdue(targetDate),
        overdueDays: overdueDays(targetDate),
        sisaHari: targetDate ? remainingDays(targetDate) : null,
        status: t.status === "Kirim" ? "Dikirim, belum dikonfirmasi vendor" : t.status === "Dikerjakan" ? "Sedang dikerjakan" : (t.status || "Proses"),
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
      if (filterStatus !== "all" && rawStatus !== filterStatus) return false;

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
  const openTransferModal = (po: any, currentStage: any) => {
    // Determine next stage
    const curUrutan = currentStage?.urutan || 1;
    const nextSt = stages.find(s => s.urutan > curUrutan && s.aktif);

    // Compute default target date (7 days from now, or PO deadline if available)
    const defDate = new Date();
    defDate.setDate(defDate.getDate() + 7);
    const defDateStr = defDate.toISOString().split("T")[0];
    const initialTargetDate = po.target_selesai ? String(po.target_selesai).split("T")[0] : defDateStr;

    setRiskAck(false);
    setShowAllVendors(false);
    setExpandedVendorId(null);
    setTransferModal({ po, currentStage });
    setTransferForm({
      ke_slug: nextSt?.slug || "",
      vendor_id: "",
      jumlah_kirim: String(po.jumlahTerbit || ""),
      target_selesai: initialTargetDate,
      catatan: ""
    });
  };

  // Submit Transfer to Next Stage
  const handleSubmitTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferModal || !transferForm.ke_slug || !transferForm.jumlah_kirim) {
      toast.error("Harap lengkapi tujuan tahap dan jumlah kirim");
      return;
    }
    if (Number(transferForm.jumlah_kirim) > Number(transferModal.po.jumlahTerbit || 0)) {
      toast.error(`Jumlah kirim melebihi kuota PO (${transferModal.po.jumlahTerbit} pcs)`);
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
          dari: transferModal.currentStage?.slug || "potong_bahan",
          ke: transferForm.ke_slug,
          vendor_id: transferForm.vendor_id ? Number(transferForm.vendor_id) : null,
          target_selesai: transferForm.target_selesai || null,
          jumlah_kirim: Number(transferForm.jumlah_kirim),
          catatan: transferForm.catatan
        })
      });

      if (res.ok) {
        toast.success(`Berhasil mendistribusikan ${transferForm.jumlah_kirim} pcs ke tahap berikutnya!`);
        setTransferModal(null);
        fetchAll();
      } else {
        const err = await res.json();
        toast.error(err.error || "Gagal melakukan transfer barang");
      }
    } catch {
      toast.error("Terjadi kesalahan sistem saat transfer barang");
    } finally {
      setIsSubmitting(false);
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
                          <span style={{ fontSize: 10.5, fontWeight: 800, color: sc.text }}>{sc.label}</span>
                          <Edit3 size={10} style={{ opacity: 0.6 }} />
                        </button>
                      </div>

                      <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginTop: 6, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span>Model: <strong style={{ color: "#0F172A" }}>{po.model}</strong></span>
                        <span style={{ color: "#94A3B8" }}>&bull;</span>
                        <span style={{ color: "#2563EB", fontWeight: 800 }}>Total {po.jumlahTerbit.toLocaleString("id-ID")} pcs</span>
                        {liveStatus && (
                          <span style={{ 
                            background: liveStatus.sisaPcs > 0 ? "#FEF3C7" : "#DCFCE7", 
                            color: liveStatus.sisaPcs > 0 ? "#92400E" : "#166534", 
                            border: liveStatus.sisaPcs > 0 ? "1px solid #FDE68A" : "1px solid #BBF7D0", 
                            padding: "1px 7px", 
                            borderRadius: 4, 
                            fontSize: 10.5, 
                            fontWeight: 800 
                          }}>
                            {liveStatus.sisaPcs > 0 ? `Sisa: ${liveStatus.sisaPcs.toLocaleString("id-ID")} pcs` : "Lengkap (100%)"}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Radial Progress Gauge */}
                    {liveStatus && (
                      <div style={{ flexShrink: 0 }}>
                        <RadialProgress pct={liveStatus.pct} size={54} stroke={5} color="#2563EB" />
                      </div>
                    )}
                  </div>

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
                          <div style={{ width: 30, height: 30, borderRadius: 8, background: "#1E293B", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Building2 size={16} color="#38BDF8" />
                          </div>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontSize: 13, fontWeight: 900, color: "#FFFFFF" }}>{liveStatus.vendorNama}</span>
                              {liveStatus.vendorKode && (
                                <span style={{ fontSize: 9.5, fontWeight: 800, color: "#38BDF8", background: "#0369A130", border: "1px solid #0284C750", padding: "1px 5px", borderRadius: 4 }}>
                                  {liveStatus.vendorKode}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 10.5, color: "#94A3B8" }}>
                              Mitra CMT Jahit {liveStatus.vendorKontak ? `• 0${liveStatus.vendorKontak.replace(/^0+/, '')}` : ""}
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

                  {/* Context: Initial Cutting Done & Assigned Info */}
                  {isInitialCutting && (
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
                  )}

                  {/* Context: Forwarded to Washing (Transfers) */}
                  {(() => {
                    const validWash = (liveStatus?.washTransfers || []).filter((tf: any) => Number(tf.jumlah_kirim) > 0 && tf.status !== "Ditarik Penuh");
                    if (validWash.length === 0) return null;
                    const totalWash = validWash.reduce((s: number, t: any) => s + Number(t.jumlah_kirim || 0), 0);

                    return (
                      <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, padding: "9px 12px", marginBottom: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 800, color: "#0F172A" }}>
                            <Droplets size={13} color="#2563EB" />
                            <span>Dialihkan ke Pos Washing</span>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 800, color: "#2563EB" }}>
                            {totalWash.toLocaleString("id-ID")} pcs
                          </span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {validWash.map((tf: any, i: number) => (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "#475569", background: "#FFFFFF", padding: "4px 8px", borderRadius: 6, border: "1px solid #E2E8F0" }}>
                              <span>&bull; {getVendorName(tf.vendor_id)}</span>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <strong style={{ color: "#0F172A" }}>{tf.jumlah_kirim} pcs</strong>
                                <span style={{ fontSize: 9.5, padding: "1px 5px", borderRadius: 4, background: tf.status === "Dikerjakan" ? "#EFF6FF" : "#F1F5F9", color: tf.status === "Dikerjakan" ? "#1D4ED8" : "#64748B", fontWeight: 700 }}>
                                  {tf.status}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
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
                              <span style={{ fontWeight: 700, color: d.status === "Dikerjakan" ? "#2563EB" : "#10B981" }}>{d.status}</span>
                            </div>
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

              return (
                <form onSubmit={handleSubmitTransfer} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
                  <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, overflowY: "auto", flex: 1, minHeight: 0 }}>
                    
                    {/* Target Stage Select */}
                    <div>
                      <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                        Pilih Pos Tujuan Pengiriman <span style={{ color: "#EF4444" }}>*</span>
                      </label>
                      <select
                        required
                        style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #CBD5E1", fontSize: 13, outline: "none", background: "#FFFFFF", color: "#0F172A" }}
                        value={transferForm.ke_slug}
                        onChange={e => setTransferForm({ ...transferForm, ke_slug: e.target.value })}
                      >
                        <option value="">-- Pilih Pos Tahap Selanjutnya --</option>
                        {stages.filter(s => s.urutan > (transferModal.currentStage?.urutan || 0)).map(s => (
                          <option key={s.id} value={s.slug}>Pos #{s.urutan}: {s.nama} ({s.slug})</option>
                        ))}
                      </select>
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
                                      </div>
                                      <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                                        <span style={{ fontSize: 10.5, fontWeight: 800, padding: "2px 7px", borderRadius: 5, background: c.chip, color: c.fg }}>{c.icon} {w.capacityLabel}</span>
                                        <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: "#F8FAFC", color: "#334155", border: "1px solid #E2E8F0" }}>{w.totalActivePO} pekerjaan aktif</span>
                                        <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: "#F8FAFC", color: w.totalPcsUnfinished ? "#B91C1C" : "#166534", border: "1px solid #E2E8F0" }}>{w.totalPcsUnfinished.toLocaleString("id-ID")} pcs belum selesai</span>
                                        {w.hasOverdue && (
                                          <span style={{ fontSize: 10.5, fontWeight: 800, padding: "2px 7px", borderRadius: 5, background: "#FEE2E2", color: "#DC2626", border: "1px solid #FCA5A5" }}>🚨 {w.overdueCount} terlambat · maks +{w.maxOverdueDays} hr</span>
                                        )}
                                      </div>
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

                    {/* Jumlah Kirim */}
                    <div>
                      <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                        Jumlah Barang Dikirim (Pcs) <span style={{ color: "#EF4444" }}>*</span>
                      </label>
                      <input
                        required
                        type="number"
                        min="1"
                        placeholder="e.g. 500"
                        style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #CBD5E1", fontSize: 13, outline: "none", boxSizing: "border-box", fontWeight: 800, color: "#2563EB" }}
                        value={transferForm.jumlah_kirim}
                        onChange={e => setTransferForm({ ...transferForm, jumlah_kirim: e.target.value })}
                      />
                      <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>
                        Maksimum kuota PO ini: {transferModal.po.jumlahTerbit} pcs
                      </div>
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
    </div>
  );
}