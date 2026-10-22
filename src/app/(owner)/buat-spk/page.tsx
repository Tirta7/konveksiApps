"use client";
import React, { useEffect, useState, useRef, useMemo } from "react";
import { transferStatusInfo } from "@/lib/transfer-status";
import {
  Plus,
  Trash2,
  CheckCircle2,
  QrCode,
  FileText,
  ChevronRight,
  Inbox,
  ExternalLink,
  CheckCheck,
  X,
  Search,
  Filter,
  Scissors,
  Zap,
  Droplets,
  Building2,
  Sparkles,
  Clock,
  ArrowRight,
  ArrowUpRight,
  Eye,
  Printer,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  Layers,
  Send,
  Package,
  RotateCcw,
  Check,
  Activity,
  Layers3,
  Workflow,
  Users,
  ShieldAlert,
  ShieldCheck
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

// Styling & thematic color config per vendor type
const CATEGORY_THEME: Record<string, {
  label: string;
  icon: any;
  color: string;
  bg: string;
  border: string;
  badge: string;
  badgeText: string;
}> = {
  cmt: {
    label: "Vendor CMT / Penjahit",
    icon: Zap,
    color: "#2563EB",
    bg: "#EFF6FF",
    border: "#BFDBFE",
    badge: "#DBEAFE",
    badgeText: "#1D4ED8"
  },
  washing: {
    label: "Vendor Washing / Laundry",
    icon: Droplets,
    color: "#0891B2",
    bg: "#ECFEFF",
    border: "#A5F3FC",
    badge: "#CFFAFE",
    badgeText: "#0E7490"
  },
  benang: {
    label: "Vendor Bersih Benang",
    icon: Scissors,
    color: "#7C3AED",
    bg: "#F5F3FF",
    border: "#DDD6FE",
    badge: "#EDE9FE",
    badgeText: "#6D28D9"
  },
  finishing: {
    label: "Vendor Finishing / QC",
    icon: CheckCircle2,
    color: "#059669",
    bg: "#ECFDF5",
    border: "#A7F3D0",
    badge: "#D1FAE5",
    badgeText: "#047857"
  },
  lainnya: {
    label: "Vendor Lainnya",
    icon: Building2,
    color: "#64748B",
    bg: "#F8FAFC",
    border: "#E2E8F0",
    badge: "#F1F5F9",
    badgeText: "#334155"
  }
};

const STATUS_CONFIG: Record<string, { badge: string; badgeText: string; border: string; label: string }> = {
  "Pending":            { badge: "#DBEAFE", badgeText: "#1D4ED8", border: "#3B82F6", label: "Menunggu ACC" },
  "Sebagian":           { badge: "#FEF3C7", badgeText: "#B45309", border: "#F59E0B", label: "Terpenuhi Sebagian" },
  "Terpenuhi Sebagian": { badge: "#FEF3C7", badgeText: "#B45309", border: "#F59E0B", label: "Terpenuhi Sebagian" },
  "Selesai":            { badge: "#D1FAE5", badgeText: "#065F46", border: "#10B981", label: "Selesai / Terpenuhi" },
  "Ditolak":            { badge: "#FEE2E2", badgeText: "#991B1B", border: "#EF4444", label: "Ditolak" }
};

// Status tahap washing — mengikuti siklus produksi_transfer (lihat lib/po-lifecycle.ts):
//  Pending (tanpa vendor) → Standby Pool, menunggu vendor washing request
//  Kirim / Proses         → Sudah dikirim ke vendor, belum mulai dikerjakan
//  Dikerjakan             → Vendor sedang mencuci (progres dari laporan vendor)
//  waitingAcc             → Seluruh jumlah sudah dilaporkan, menunggu ACC admin
//  Selesai / Diverifikasi → Selesai cuci
type WashingState = { key: string; label: string; color: string; bg: string; border: string; hint: string };
const getWashingState = (wt: any): WashingState => {
  const info = transferStatusInfo(wt);
  const base = { label: info.label, color: info.color, bg: info.bg, border: info.border, hint: info.hint };
  switch (info.key) {
    case "kembali": return { key: "gudang", ...base };
    case "selesai":
    case "siap_gudang": return { key: "selesai", ...base, label: info.key === "selesai" ? "Selesai Cuci" : info.label };
    case "standby": return { key: "standby", ...base, hint: "Diterima dari tahap sebelumnya, menunggu request vendor washing" };
    case "menunggu_acc":
    case "sebagian_acc": return { key: "acc", ...base };
    case "setor_bertahap":
    case "dikerjakan": return { key: "proses", ...base };
    case "ditolak": return { key: "gudang", ...base };
    default: return { key: "dikirim", ...base };
  }
};
// Transfer standby yang sudah habis ditarik ke vendor tidak perlu ditampilkan lagi
const isVisibleWashing = (wt: any) => wt.status !== "Ditarik Penuh" && !(wt.vendor_id == null && Number(wt.jumlah_kirim || 0) <= 0);

export default function BuatPOProduksi() {
  const [activeTab, setActiveTab] = useState<"request" | "manual" | "laporan" | "washing">("manual");
  const _bgRefresh = useRef(false);
  
  // Data States
  const [allVendors, setAllVendors] = useState<any[]>([]);
  const [cmtVendors, setCmtVendors] = useState<any[]>([]);
  const [pemotonganList, setPemotonganList] = useState<any[]>([]);
  const [cmtRequests, setCmtRequests] = useState<any[]>([]);
  const [cmtProgres, setCmtProgres] = useState<any[]>([]);
  const [allTransfers, setAllTransfers] = useState<any[]>([]);
  const [washingTransfers, setWashingTransfers] = useState<any[]>([]);
  const [poProduksi, setPoProduksi] = useState<any[]>([]);
  const [expandedVendorId, setExpandedVendorId] = useState<number | null>(null);
  const [showAllVendors, setShowAllVendors] = useState<boolean>(false);
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  
  // Request Processing & Modals
  const [processRequest, setProcessRequest] = useState<any>(null);
  const [rejectRequest, setRejectRequest] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [deleteRequest, setDeleteRequest] = useState<any | null>(null);
  const [detailModal, setDetailModal] = useState<any | null>(null);
  const [downstreamModal, setDownstreamModal] = useState<any | null>(null);
  const [downstreamForm, setDownstreamForm] = useState<{size: string, max: number, jumlah: number|""}[]>([]);
  const [isSubmittingDownstream, setIsSubmittingDownstream] = useState(false);

  // Filters & Search
  const [requestFilter, setRequestFilter] = useState("Semua");
  const [tipeFilter, setTipeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Form Buat PO Manual
  const [form, setForm] = useState({
    pemotonganId: "",
    vendorId: "",
    catatan: "",
    target_selesai: ""
  });
  const [sizeBreakdown, setSizeBreakdown] = useState<{size: string; jumlah: number; maxSisa: number}[]>([]);

  // Fetch all related master and transaction data
  const fetchAll = () => {
    fetch("/api/vendors?_t=" + Date.now())
      .then(res => res.json())
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        setAllVendors(list);
        setCmtVendors(list.filter((v: any) => v.tipe === "cmt" && v.aktif));
      })
      .catch(() => {});
      
    fetch("/api/pemotongan?_t=" + Date.now())
      .then(res => res.json())
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        const available = list.filter((p: any) => p.status !== "Draft" && p.sizeBreakdown?.some((s: any) => s.sisa > 0));
        setPemotonganList(available);
      })
      .catch(() => {});

    fetch("/api/cmt-request?_t=" + Date.now())
      .then(res => res.json())
      .then(data => setCmtRequests(Array.isArray(data) ? data : []))
      .catch(() => {});
      
    fetch("/api/cmt-progres?_t=" + Date.now())
      .then(res => res.json())
      .then(data => setCmtProgres(Array.isArray(data) ? data : []))
      .catch(() => {});

    fetch("/api/produksi-transfer?_t=" + Date.now())
      .then(res => res.json())
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        setAllTransfers(list);
        setWashingTransfers(list.filter((t: any) => t.ke === "washing"));
      })
      .catch(() => {});

    fetch("/api/po-produksi?_t=" + Date.now())
      .then(res => res.json())
      .then(data => setPoProduksi(Array.isArray(data) ? data : []))
      .catch(() => {});
  };

  useEffect(() => { 
    fetchAll(); 
    try {
      const sp = new URLSearchParams(window.location.search);
      const tab = sp.get("tab");
      if (tab === "request" || tab === "manual" || tab === "laporan" || tab === "washing") {
        setActiveTab(tab);
      }
      const reqId = sp.get("reqId");
      if (reqId) {
        setTimeout(() => {
          const el = document.getElementById(`req-${reqId}`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.style.outline = "3px solid #3B82F6";
            setTimeout(() => { el.style.outline = "none"; }, 3000);
          }
        }, 600);
      }
    } catch {}
    const interval = setInterval(() => { if (!document.hidden) fetchAll(); }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Real-time sync: refresh data when another admin makes changes
  useEffect(() => {
    const handler = () => fetchAll();
    window.addEventListener("konveksi-sync", handler);
    return () => window.removeEventListener("konveksi-sync", handler);
  }, []);

  const selectedPemotongan = pemotonganList.find(p => String(p.id) === String(form.pemotonganId));
  const selectedVendor = cmtVendors.find(v => String(v.id) === String(form.vendorId));

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
  const waLink = (phone?: string, text?: string) => {
    if (!phone) return "";
    let c = phone.replace(/[^0-9]/g, "");
    if (c.startsWith("0")) c = "62" + c.slice(1);
    else if (c.startsWith("8")) c = "62" + c;
    return `https://wa.me/${c}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
  };

  // Vendor Workload & Capacity Analysis (Kapasitas & Status Barang Belum Selesai)
  const getVendorWorkload = (vendorId: number) => {
    const vendor = allVendors.find(v => v.id === vendorId);
    if (!vendor) return null;

    // PO jahit yang ditugaskan langsung ke vendor ini (CMT)
    const activePOs = poProduksi.filter(p => p.vendorId === vendorId && !p.cmt_selesai && p.status !== "Selesai" && p.status !== "Pipeline Selesai" && p.status !== "Closed");
    // Transfer ke vendor ini yang masih dikerjakan (washing, benang, dll)
    const activeTransfers = allTransfers.filter(t => t.vendor_id === vendorId && (t.status === "Proses" || t.status === "Dikerjakan" || t.status === "Kirim"));

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
      if (activePOs.find(p => p.id === t.po_id) && t.dari === "cmt") continue;
      const po = poProduksi.find(p => p.id === t.po_id);
      const diterima = Number(t.progress?.approved ?? t.jumlah_diterima ?? 0);
      const dilapor = diterima + Number(t.progress?.pending || 0);
      const sisa = Math.max(0, (t.jumlah_kirim || 0) - diterima);
      if (sisa <= 0) continue;
      const targetDate = t.target_selesai || po?.target_selesai || null;
      items.push({
        key: `tf-${t.id}`,
        poId: t.po_id,
        noPo: po?.noPo || t.noPo || `PO #${t.po_id}`,
        model: po?.model || t.model || "-",
        tahap: t.ke ? t.ke.toUpperCase() : "Transfer",
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
        status: t.status,
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
      hargaPerPcs: vendor.hargaPerPcs || 0,
      kodeVendor: vendor.kodeVendor || `V-${vendor.id}`,
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

  // Pre-computed CMT workloads for SPK KPI dashboard
  const cmtWorkloads = useMemo(() => {
    return cmtVendors.map(v => getVendorWorkload(v.id)).filter(Boolean) as any[];
  }, [cmtVendors, allVendors, poProduksi, allTransfers, cmtProgres]);

  const vendorProblemCount = useMemo(() => {
    return cmtWorkloads.filter(w => w.hasOverdue).length;
  }, [cmtWorkloads]);

  const vendorSafeCount = useMemo(() => {
    return cmtWorkloads.filter(w => w.capacityLevel === "safe").length;
  }, [cmtWorkloads]);

  // Helper: Get vendor type safely
  const getVendorTipe = (vendorId: number | string, fallbackTipe?: string) => {
    const v = allVendors.find(x => String(x.id) === String(vendorId));
    return v?.tipe || fallbackTipe || "cmt";
  };

  // Helper: Portal link
  const getVendorPortalUrl = (vId: number | string, tipe: string) => {
    if (tipe === "washing") return `/washing/${vId}`;
    if (tipe === "benang") return `/bersih-benang/${vId}`;
    if (tipe === "finishing") return `/finishing/${vId}`;
    return `/cmt/${vId}`;
  };

  // Helper: distribute qty evenly across available sizes
  const distributeEvenly = (pemo: any, targetQty: number) => {
    if (!pemo || !pemo.sizeBreakdown) return [];
    const sizes = pemo.sizeBreakdown.filter((s: any) => s.sisa > 0);
    const numSizes = sizes.length;
    if (numSizes === 0) return pemo.sizeBreakdown.map((s: any) => ({ size: s.size, jumlah: 0, maxSisa: s.sisa }));
    const perSize = Math.floor(targetQty / numSizes);
    let remainder = targetQty - (perSize * numSizes);
    return pemo.sizeBreakdown.map((s: any) => {
      if (s.sisa <= 0) return { size: s.size, jumlah: 0, maxSisa: s.sisa };
      const extra = remainder > 0 ? 1 : 0;
      remainder -= extra;
      const qty = Math.min(perSize + extra, s.sisa);
      return { size: s.size, jumlah: qty, maxSisa: s.sisa };
    });
  };

  const handlePemotonganChange = (id: string) => {
    setForm(prev => ({ ...prev, pemotonganId: id }));
    const p = pemotonganList.find((x: any) => String(x.id) === String(id));
    if (p) {
      if (processRequest) {
        setSizeBreakdown(distributeEvenly(p, Number(processRequest.total_request)));
      } else {
        setSizeBreakdown(p.sizeBreakdown.map((s: any) => ({ size: s.size, jumlah: 0, maxSisa: s.sisa })));
      }
    } else {
      setSizeBreakdown([]);
    }
  };

  const totalPcs = sizeBreakdown.reduce((sum, item) => sum + (Number(item.jumlah) || 0), 0);
  const totalSisaPotongan = pemotonganList.reduce((sum, p) => sum + (p.sizeBreakdown || []).reduce((s: number, x: any) => s + (x.sisa || 0), 0), 0);
  const totalDimintaPcs = cmtRequests.reduce((sum, r) => sum + (Number(r.total_request) || 0), 0);
  const totalDipenuhiPcs = cmtRequests.reduce((sum, r) => sum + (Number(r.total_dipenuhi) || 0), 0);
  const pendingRequestCount = cmtRequests.filter((r: any) => r.status === "Pending" || r.status === "Sebagian").length;
  const pendingCmtLaporCount = cmtProgres.filter((r: any) => r.status === "Menunggu" || r.status === "Pending").length;
  const pendingWashingCount = washingTransfers.filter((r: any) => isVisibleWashing(r) && ["acc", "dikirim"].includes(getWashingState(r).key)).length;

  // Handle PO Creation
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.pemotonganId || !form.vendorId || totalPcs === 0) {
      toast.error("Harap pilih Potongan Kain, Vendor CMT, dan minimal 1 Size.");
      return;
    }

    if (!_bgRefresh.current) setLoading(true);
    try {
      const res = await fetch("/api/po-produksi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          jumlahTerbit: totalPcs,
          sizeBreakdown: sizeBreakdown.filter(s => s.jumlah > 0)
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // If this PO fulfills a request, update the request status
      if (processRequest) {
        const newDipenuhi = (processRequest.total_dipenuhi || 0) + totalPcs;
        const newStatus = newDipenuhi >= processRequest.total_request ? "Selesai" : "Terpenuhi Sebagian";
        
        await fetch("/api/cmt-request", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: processRequest.id,
            status: newStatus,
            total_dipenuhi: newDipenuhi
          })
        });
      }

      toast.success("PO Produksi & Barcode Berhasil Diterbitkan!");
      setResult(data);
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Gagal menerbitkan PO");
    } finally {
      setLoading(false);
    }
  };

  // Re-open / Re-process rejected or partially fulfilled request
  const handleReopenRequest = async (r: any) => {
    try {
      const res = await fetch("/api/cmt-request", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: r.id,
          status: "Pending",
          alasan_tolak: ""
        })
      });
      if (res.ok) {
        toast.success(`Request dari ${r.vendor_nama} dibuka kembali ke status Pending`);
        fetchAll();
      }
    } catch {
      toast.error("Gagal membuka kembali request");
    }
  };

  // Handle Laporan Progres CMT ACC
  const handleTerimaLaporan = async (id: string) => {
    try {
      const res = await fetch("/api/cmt-progres", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "terima" })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.pekerjaanSelesai) {
        toast.success(
          data.terlambatHari > 0
            ? `Laporan di-ACC. Pekerjaan vendor SELESAI (terlambat ${data.terlambatHari} hari — tercatat di riwayat kinerja, penalti dicabut).`
            : "Laporan di-ACC. Pekerjaan vendor SELESAI tepat waktu!"
        );
      } else {
        toast.success(`Laporan berhasil diverifikasi & masuk ke stok siap tarik!${data.sisa != null ? ` Sisa ${data.sisa} pcs.` : ""}`);
      }
      fetchAll();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleTolakLaporan = async (id: string) => {
    if (!confirm("Tolak laporan ini? Status CMT akan dikembalikan.")) return;
    try {
      const res = await fetch("/api/cmt-progres", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "tolak" })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Laporan ditolak. Status barcode dikembalikan.");
      fetchAll();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // Handle Downstream Job Assign (Washing, etc.)
  const handleDownstreamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!downstreamModal) return;
    
    const items = downstreamForm.filter(p => Number(p.jumlah) > 0);
    const totalReq = items.reduce((s, i) => s + Number(i.jumlah), 0);
    
    if (items.length === 0) {
      toast.error("Isi setidaknya 1 size.");
      return;
    }
    
    for (const item of items) {
      if (Number(item.jumlah) > item.max) {
        toast.error(`Size ${item.size} melebihi sisa yang ada di Standby Pool (${item.max})`);
        return;
      }
    }
    
    if (totalReq > Number(downstreamModal.total_request)) {
      toast.error(`Total yang di-ACC (${totalReq}) melebihi request (${downstreamModal.total_request})`);
      return;
    }

    setIsSubmittingDownstream(true);
    try {
      const res = await fetch("/api/tarik-barang/acc-downstream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: downstreamModal.id,
          transfer_id: downstreamModal.pemotongan.transfer_id,
          vendor_id: downstreamModal.vendor_id,
          sizeBreakdown: items,
        })
      });
      if (!res.ok) {
         const data = await res.json().catch(() => ({}));
         fetchAll();
         throw new Error(data.error || "Gagal menugaskan downstream");
      }
      toast.success("Berhasil menugaskan pekerjaan ke vendor!");
      setDownstreamModal(null);
      fetchAll();
    } catch(err: any) {
      toast.error(err.message || "Gagal menugaskan downstream");
    } finally {
      setIsSubmittingDownstream(false);
    }
  };

  // Filter requests
  const filteredRequests = useMemo(() => {
    return cmtRequests.filter((r: any) => {
      const vTipe = getVendorTipe(r.vendor_id, r.vendor_tipe);
      if (tipeFilter !== "all" && vTipe !== tipeFilter) return false;

      if (requestFilter === "Pending" && !(r.status === "Pending" || r.status === "Sebagian")) return false;
      if (requestFilter === "Selesai/Dilayani" && !(r.status === "Selesai" || r.status === "Terpenuhi Sebagian")) return false;
      if (requestFilter === "Ditolak" && r.status !== "Ditolak") return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (r.vendor_nama || "").toLowerCase().includes(q);
        const matchCatatan = (r.catatan || "").toLowerCase().includes(q);
        const matchAlasan = (r.alasan_tolak || "").toLowerCase().includes(q);
        const matchModel = (r.pemotongan?.model || "").toLowerCase().includes(q);
        const matchBarang = (r.pemotongan?.nama_barang || "").toLowerCase().includes(q);
        const matchId = String(r.id).includes(q);
        if (!matchName && !matchCatatan && !matchAlasan && !matchModel && !matchBarang && !matchId) return false;
      }
      return true;
    });
  }, [cmtRequests, tipeFilter, requestFilter, searchQuery, allVendors]);

  // Find linked PO for request
  const findLinkedPO = (r: any) => {
    if (r.pemotongan?.is_transfer && r.pemotongan?.po_id) {
      return poProduksi.find((p: any) => p.id === r.pemotongan.po_id);
    }
    return poProduksi.find((p: any) => 
      p.vendorId === r.vendor_id && 
      (p.pemotongan_id === r.pemotongan_id || p.model === r.pemotongan?.model || (p.catatan && p.catatan.includes(r.vendor_nama)))
    );
  };

  // SUCCESS SCREEN AFTER ISSUING PO
  if (result) {
    return (
      <div style={{ padding: "32px 32px 48px 32px", background: "var(--bg-app)", minHeight: "100%", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <div className="card" style={{ maxWidth: 680, width: "100%", textAlign: "center", padding: "40px 36px", boxShadow: "0 20px 40px rgba(0,0,0,0.08)", borderRadius: 20 }}>
          <div style={{ display: "inline-flex", justifyContent: "center", alignItems: "center", width: 72, height: 72, borderRadius: "50%", background: "var(--color-success-bg)", color: "var(--color-success)", marginBottom: 20, boxShadow: "0 8px 20px rgba(16,185,129,0.2)" }}>
            <CheckCircle2 size={38} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: "var(--text-primary)", marginBottom: 8, letterSpacing: "-0.5px" }}>
            PO Produksi & Barcode Berhasil Diterbitkan!
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
            Nomor PO <strong style={{ color: "#2563EB", fontFamily: "monospace", fontSize: 16 }}>{result.noPo}</strong> untuk model <strong style={{ color: "#0F172A" }}>{result.model}</strong> sejumlah <strong style={{ color: "#10B981" }}>{result.jumlahTerbit} pcs</strong> telah resmi dicatat ke Ledger Produksi & CMT.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, background: "#F8FAFC", padding: 16, borderRadius: 14, border: "1px solid #E2E8F0", marginBottom: 28 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>No. PO</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#0F172A", marginTop: 4, fontFamily: "monospace" }}>{result.noPo}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Total Quantity</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#10B981", marginTop: 4 }}>{result.jumlahTerbit} pcs</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Barcode Dibuat</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#2563EB", marginTop: 4 }}>{result.jumlahTerbit} buah</div>
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10, marginBottom: 16 }}>
            <Link href={`/cetak-po/${result.id}`} className="btn btn-secondary" style={{ display: "flex", alignItems: "center", gap: 8, background: "white" }}>
              <Printer size={16} /> Cetak Surat Jalan PO
            </Link>
            <Link href="/barcode-produksi" className="btn btn-primary" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <QrCode size={16} /> Cetak Barcode Bundle
            </Link>
            <Link href="/dashboard-cmt" className="btn btn-secondary" style={{ display: "flex", alignItems: "center", gap: 8, background: "white" }}>
              <Activity size={16} /> Dashboard CMT
            </Link>
            <Link href="/daftar-spk" className="btn btn-secondary" style={{ display: "flex", alignItems: "center", gap: 8, background: "white" }}>
              <FileText size={16} /> Daftar PO / SPK
            </Link>
          </div>

          <button
            onClick={() => {
              setResult(null);
              setProcessRequest(null);
              setForm({ pemotonganId: "", vendorId: "", catatan: "", target_selesai: "" });
              setSizeBreakdown([]);
              setActiveTab("manual");
            }}
            style={{ background: "none", border: "none", color: "#2563EB", fontSize: 13, fontWeight: 800, cursor: "pointer", marginTop: 8 }}
          >
            ← Terbitkan SPK Lainnya / Form Baru
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      padding: activeTab === "manual" ? "12px 20px" : "32px 32px 48px 32px",
      background: "var(--bg-app)",
      height: activeTab === "manual" ? "100vh" : "auto",
      maxHeight: activeTab === "manual" ? "100vh" : "none",
      boxSizing: "border-box",
      display: activeTab === "manual" ? "flex" : "block",
      flexDirection: "column",
      overflow: activeTab === "manual" ? "hidden" : "auto",
      gap: activeTab === "manual" ? 10 : 0
    }}>
      
      {/* ─── SLIM TOP TOOLBAR (KHUSUS MODE BUAT SPK STUDIO - TANPA HEADER BESAR & BEBAS SCROLL) ─── */}
      {activeTab === "manual" && (
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "6px 12px",
          background: "white",
          borderRadius: 12,
          border: "1px solid var(--border-color)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
          flexShrink: 0
        }}>
          {/* Left: Studio Title & Quick Indicators */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
              color: "white",
              padding: "5px 12px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              gap: 6,
              letterSpacing: 0.3
            }}>
              <Zap size={14} /> BUAT SPK PRODUKSI
            </div>
            <div style={{ height: 18, width: 1, background: "#E2E8F0" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#64748B" }}>
              <span>Stok Potongan: <strong style={{ color: "#059669" }}>{totalSisaPotongan.toLocaleString()} pcs</strong></span>
              <span>·</span>
              <span>Mitra CMT: <strong style={{ color: "#2563EB" }}>{cmtVendors.length} mitra</strong></span>
              <span>·</span>
              <span style={{ color: vendorProblemCount > 0 ? "#DC2626" : "#16A34A", fontWeight: 700 }}>
                {vendorProblemCount > 0 ? `⚠️ ${vendorProblemCount} vendor overdue` : "🟢 Semua CMT aman"}
              </span>
            </div>
          </div>

          {/* Right: Switcher to other tabs & quick link */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              type="button"
              onClick={() => setActiveTab("manual")}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "none",
                fontSize: 12,
                fontWeight: 800,
                background: "#0F172A",
                color: "white",
                display: "flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer"
              }}
            >
              <Plus size={13} /> + Buat SPK
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("request")}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid #E2E8F0",
                fontSize: 12,
                fontWeight: 700,
                background: "#F8FAFC",
                color: "#475569",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6
              }}
            >
              <Inbox size={13} /> Antrean Request
              {pendingRequestCount > 0 && (
                <span style={{ background: "#EF4444", color: "white", borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 900 }}>
                  {pendingRequestCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("laporan")}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid #E2E8F0",
                fontSize: 12,
                fontWeight: 700,
                background: "#F8FAFC",
                color: "#475569",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6
              }}
            >
              <CheckCircle2 size={13} /> Laporan CMT
              {pendingCmtLaporCount > 0 && (
                <span style={{ background: "#F59E0B", color: "white", borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 900 }}>
                  {pendingCmtLaporCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("washing")}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid #E2E8F0",
                fontSize: 12,
                fontWeight: 700,
                background: "#F8FAFC",
                color: "#475569",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6
              }}
            >
              <Droplets size={13} /> Washing
              {pendingWashingCount > 0 && (
                <span style={{ background: "#06B6D4", color: "white", borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 900 }}>
                  {pendingWashingCount}
                </span>
              )}
            </button>
            <div style={{ height: 18, width: 1, background: "#E2E8F0" }} />
            <Link
              href="/daftar-spk"
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                color: "#2563EB",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: 4
              }}
            >
              <FileText size={13} /> Daftar SPK ↗
            </Link>
          </div>
        </div>
      )}

      {/* ─── TAMPILAN HEADER BESAR & STAT KPI (HANYA MUNCUL DI TAB REQUEST / LAPORAN / WASHING) ─── */}
      {activeTab !== "manual" && (
        <>
          {/* PAGE HEADER */}
          <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <h1 className="page-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
                  Penerbitan SPK & PO Produksi
                </h1>
                <span style={{ background: "linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)", color: "white", fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 800, letterSpacing: 0.5 }}>
                  KHUSUS CMT
                </span>
              </div>
              <p className="page-subtitle" style={{ margin: 0 }}>
                Pusat penerbitan Surat Perintah Kerja (SPK) untuk alokasi kain potongan ke mitra penjahit CMT, breakdown ukuran, dan cetak barcode bundle.
              </p>
            </div>

            {/* QUICK SHORTCUT HUBS */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link href="/pemotongan-kain" className="btn btn-secondary" style={{ background: "white", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <Scissors size={14} color="#059669" /> Stok Potongan ({totalSisaPotongan.toLocaleString()} pcs)
              </Link>
              <Link href="/daftar-spk" className="btn btn-secondary" style={{ background: "white", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <FileText size={14} color="#2563EB" /> Daftar PO / SPK ({poProduksi.length})
              </Link>
              <Link href="/dashboard-cmt" className="btn btn-secondary" style={{ background: "white", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <Activity size={14} color="#7C3AED" /> Dashboard CMT
              </Link>
              <Link href="/alur-produksi" className="btn btn-secondary" style={{ background: "white", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <Zap size={14} color="#D97706" /> Alur Produksi
              </Link>
            </div>
          </div>

          {/* STAT KPI SUMMARY CARDS */}
          <div className="stat-grid" style={{ marginBottom: 24 }}>
            {/* Card 1: Stok Potongan Siap Jahit */}
            <div className="stat-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span className="stat-label">Stok Potongan Siap Jahit</span>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Scissors size={18} />
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#059669", lineHeight: 1 }}>{totalSisaPotongan.toLocaleString()}</div>
                <span style={{ fontSize: 12, color: "#64748B" }}>pcs siap</span>
              </div>
              <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>
                Dari <strong style={{ color: "#0F172A" }}>{pemotonganList.length}</strong> batch pemotongan kain
              </div>
            </div>

            {/* Card 2: Mitra CMT Penjahit Aktif */}
            <div className="stat-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span className="stat-label">Mitra CMT Penjahit</span>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "#EFF6FF", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Users size={18} />
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#0F172A", lineHeight: 1 }}>{cmtVendors.length}</div>
                <span style={{ fontSize: 12, color: "#64748B" }}>mitra aktif</span>
              </div>
              <div style={{ fontSize: 11, color: "#166534", marginTop: 4 }}>
                <strong style={{ color: "#16A34A" }}>{vendorSafeCount} mitra</strong> kapasitas aman & siap order
              </div>
            </div>

            {/* Card 3: Evaluasi Beban CMT */}
            <div className="stat-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span className="stat-label">Status Beban CMT</span>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: vendorProblemCount > 0 ? "#FEF2F2" : "#F0FDF4", color: vendorProblemCount > 0 ? "#DC2626" : "#16A34A", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {vendorProblemCount > 0 ? <ShieldAlert size={18} /> : <ShieldCheck size={18} />}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <div style={{ fontSize: 24, fontWeight: 900, color: vendorProblemCount > 0 ? "#DC2626" : "#16A34A", lineHeight: 1 }}>
                  {vendorProblemCount > 0 ? `${vendorProblemCount} Vendor Kritis` : "Kapasitas Bersih"}
                </div>
              </div>
              <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>
                {vendorProblemCount > 0 ? (
                  <span style={{ color: "#DC2626", fontWeight: 700 }}>Ada keterlambatan · cek sebelum alokasi</span>
                ) : (
                  <span>Semua vendor bebas tunggakan kritis</span>
                )}
              </div>
            </div>

            {/* Card 4: PO Produksi Berjalan */}
            <div className="stat-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span className="stat-label">PO Produksi Berjalan</span>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "#F5F3FF", color: "#7C3AED", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Zap size={18} />
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#0F172A", lineHeight: 1 }}>{poProduksi.length}</div>
                <span style={{ fontSize: 12, color: "#64748B" }}>PO terbit</span>
              </div>
              <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>
                {pendingCmtLaporCount > 0 ? (
                  <span style={{ color: "#D97706", fontWeight: 700 }}>{pendingCmtLaporCount} laporan menanti verifikasi</span>
                ) : (
                  <span>Tracking jahitan berjalan optimal</span>
                )}
              </div>
            </div>
          </div>

          {/* BILAH 4 TAB FITUR OPERASIONAL SPK & CMT */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", gap: 6, background: "white", padding: 6, borderRadius: 14, border: "1px solid var(--border-color)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", width: "fit-content" }}>
              {[
                { key: "manual",  label: "+ Buat SPK Baru (Inti)", icon: Plus, badge: 0, badgeColor: "" },
                { key: "request", label: "Antrean Request Vendor", icon: Inbox, badge: pendingRequestCount, badgeColor: "#EF4444" },
                { key: "laporan", label: "Laporan Progres CMT",     icon: CheckCircle2, badge: pendingCmtLaporCount, badgeColor: "#F59E0B" },
                { key: "washing", label: "Laporan Washing",         icon: Droplets, badge: pendingWashingCount, badgeColor: "#06B6D4" },
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as any)}
                    style={{
                      padding: "10px 18px",
                      borderRadius: 10,
                      border: "none",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 700,
                      background: isActive ? "#0F172A" : "transparent",
                      color: isActive ? "white" : "var(--text-secondary)",
                      transition: "all 0.2s ease",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      boxShadow: isActive ? "0 4px 12px rgba(15,23,42,0.25)" : "none"
                    }}
                  >
                    <Icon size={16} />
                    {tab.label}
                    {tab.badge > 0 && (
                      <span style={{
                        background: tab.badgeColor,
                        color: "white",
                        borderRadius: 20,
                        minWidth: 18,
                        height: 18,
                        fontSize: 10,
                        fontWeight: 900,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "0 5px"
                      }}>
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Tab Right Helper */}
            {activeTab === "request" && (
              <div style={{ fontSize: 13, color: "#64748B", display: "flex", alignItems: "center", gap: 6 }}>
                <Sparkles size={14} color="#2563EB" /> Menampilkan {filteredRequests.length} dari {cmtRequests.length} request vendor
              </div>
            )}
            {activeTab === "laporan" && (
              <div style={{ fontSize: 13, color: "#64748B", display: "flex", alignItems: "center", gap: 6 }}>
                <Activity size={14} color="#F59E0B" /> {pendingCmtLaporCount} laporan jahit menanti verifikasi admin
              </div>
            )}
            {activeTab === "washing" && (
              <div style={{ fontSize: 13, color: "#64748B", display: "flex", alignItems: "center", gap: 6 }}>
                <Droplets size={14} color="#06B6D4" /> {washingTransfers.length} alur transfer washing
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── BANNER NOTIFIKASI AUTO-FILL DARI REQUEST (COMPACT) ─────────────── */}
      {activeTab === "manual" && processRequest && (
        <div style={{ background: "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)", border: "1.5px solid #3B82F6", borderRadius: 12, padding: "8px 14px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, boxShadow: "0 2px 8px rgba(37,99,235,0.08)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ background: "#2563EB", color: "white", width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Zap size={15} />
            </div>
            <div>
              <div style={{ fontWeight: 800, color: "#1D4ED8", fontSize: 13 }}>
                Sedang Memproses Request #{processRequest.id} dari {processRequest.vendor_nama} (Target: {processRequest.total_request} pcs)
              </div>
              <div style={{ fontSize: 11, color: "#1E40AF" }}>
                Size breakdown otomatis diisi merata. Silakan sesuaikan kuantitas atau klik Rata Ulang.
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button
              onClick={() => {
                if (selectedPemotongan) {
                  setSizeBreakdown(distributeEvenly(selectedPemotongan, Number(processRequest.total_request)));
                  toast.success("Breakdown diratakan ulang sesuai sisa stok");
                }
              }}
              style={{ background: "#2563EB", color: "white", border: "none", padding: "6px 10px", borderRadius: 6, fontWeight: 700, cursor: "pointer", fontSize: 11.5, display: "flex", alignItems: "center", gap: 4 }}
            >
              <RefreshCw size={11} /> Rata Ulang
            </button>
            <button
              onClick={() => { setProcessRequest(null); toast.info("Mode auto-fill dibatalkan"); }}
              style={{ background: "white", color: "#64748B", border: "1px solid #CBD5E1", padding: "6px 10px", borderRadius: 6, fontWeight: 700, cursor: "pointer", fontSize: 11.5 }}
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 1: ANTREAN REQUEST VENDOR
         ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "request" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 40 }}>
          
          {/* PANDUAN INTEGRASI ALUR KERJA (Mencegah kerancuan antara Buat SPK vs Alur Produksi) */}
          <div style={{
            background: "linear-gradient(135deg, #EFF6FF 0%, #F0FDF4 100%)",
            border: "1px solid #BFDBFE",
            borderRadius: 14,
            padding: "12px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 280 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "#DBEAFE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Workflow size={20} color="#2563EB" />
              </div>
              <div style={{ fontSize: 12.5, color: "#1E293B", lineHeight: 1.45 }}>
                <div style={{ fontWeight: 800, color: "#1D4ED8", marginBottom: 2 }}>
                  💡 Panduan Alur Penerusan & Distribusi Pekerjaan
                </div>
                <div>
                  <strong>• Kain Potongan → CMT (Penjahit):</strong> Buat SPK baru di tab ini melalui tombol <strong>Buat SPK CMT</strong>.<br />
                  <strong>• Jahit → Washing → Pos Lanjutan:</strong> Diteruskan secara terpusat melalui fitur <strong style={{ color: "#2563EB" }}>Alur Produksi</strong> (tombol <strong>"Kirim ke Pos Berikutnya"</strong>).
                </div>
              </div>
            </div>
            <Link
              href="/alur-produksi"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                background: "#2563EB",
                color: "#FFFFFF",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 800,
                textDecoration: "none",
                boxShadow: "0 2px 6px rgba(37,99,235,0.25)",
                whiteSpace: "nowrap"
              }}
            >
              Buka Alur Produksi →
            </Link>
          </div>

          {/* SEARCH & FILTER BAR */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap", background: "white", padding: "14px 18px", borderRadius: 16, border: "1px solid var(--border-color)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            
            {/* Search Input */}
            <div className="search-wrapper" style={{ minWidth: 280, flex: 1, maxWidth: 450 }}>
              <Search className="search-icon" size={16} />
              <input
                type="text"
                placeholder="Cari nama vendor, model, kain, atau ID..."
                className="search-input"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: "100%", fontSize: 13 }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} style={{ border: "none", background: "none", cursor: "pointer", color: "#94A3B8", padding: 4 }}>
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Vendor Category Filter Pills */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B", marginRight: 4 }}>Kategori:</span>
              {[
                { key: "all", label: "Semua" },
                { key: "cmt", label: "CMT / Penjahit" },
                { key: "washing", label: "Washing / Laundry" },
                { key: "benang", label: "Bersih Benang" },
                { key: "finishing", label: "Finishing / QC" },
              ].map(cat => (
                <button
                  key={cat.key}
                  onClick={() => setTipeFilter(cat.key)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    border: tipeFilter === cat.key ? "1px solid #2563EB" : "1px solid #E2E8F0",
                    background: tipeFilter === cat.key ? "#EFF6FF" : "white",
                    color: tipeFilter === cat.key ? "#1D4ED8" : "#475569",
                    cursor: "pointer",
                    transition: "all 0.15s"
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Status Filter Pills */}
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B", marginRight: 4 }}>Status:</span>
              {["Semua", "Pending", "Selesai/Dilayani", "Ditolak"].map(f => (
                <button
                  key={f}
                  onClick={() => setRequestFilter(f)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                    background: requestFilter === f ? "#0F172A" : "#F1F5F9",
                    color: requestFilter === f ? "white" : "#64748B",
                    transition: "all 0.15s"
                  }}
                >
                  {f === "Pending" ? "Menunggu ACC" : f}
                  {f === "Pending" && pendingRequestCount > 0 && (
                    <span style={{ marginLeft: 6, background: "#EF4444", color: "white", borderRadius: 20, fontSize: 10, padding: "1px 6px", fontWeight: 900 }}>
                      {pendingRequestCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* EMPTY STATE */}
          {filteredRequests.length === 0 ? (
            <div style={{ background: "white", borderRadius: 18, padding: 60, textAlign: "center", border: "1px solid #E2E8F0" }}>
              <Inbox size={48} style={{ color: "#CBD5E1", margin: "0 auto 16px" }} />
              <div style={{ fontSize: 16, fontWeight: 800, color: "#1E293B" }}>Tidak ada request yang sesuai kriteria</div>
              <p style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>
                Silakan ubah filter kategori atau kata kunci pencarian Anda.
              </p>
              {(searchQuery || tipeFilter !== "all" || requestFilter !== "Semua") && (
                <button
                  onClick={() => { setSearchQuery(""); setTipeFilter("all"); setRequestFilter("Semua"); }}
                  className="btn btn-secondary"
                  style={{ marginTop: 14, background: "#F8FAFC" }}
                >
                  Reset Semua Filter
                </button>
              )}
            </div>
          ) : (
            /* GROUP BY CATEGORY */
            (() => {
              const GROUPS: Record<string, { key: string; label: string; icon: any; color: string; bg: string; border: string; items: any[] }> = {
                cmt:       { key: "cmt", label: "Vendor CMT / Penjahit", icon: Zap, color: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE", items: [] },
                washing:   { key: "washing", label: "Vendor Washing / Laundry", icon: Droplets, color: "#0891B2", bg: "#ECFEFF", border: "#A5F3FC", items: [] },
                benang:    { key: "benang", label: "Vendor Bersih Benang", icon: Scissors, color: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE", items: [] },
                finishing: { key: "finishing", label: "Vendor Finishing / QC", icon: CheckCircle2, color: "#059669", bg: "#ECFDF5", border: "#A7F3D0", items: [] },
                lainnya:   { key: "lainnya", label: "Vendor Lainnya", icon: Building2, color: "#64748B", bg: "#F8FAFC", border: "#E2E8F0", items: [] },
              };

              for (const r of filteredRequests) {
                const tipe = getVendorTipe(r.vendor_id, r.vendor_tipe);
                (GROUPS[tipe] || GROUPS["lainnya"]).items.push(r);
              }

              return ["cmt", "washing", "benang", "finishing", "lainnya"].map(tipe => {
                const g = GROUPS[tipe];
                if (g.items.length === 0) return null;
                const pendingCount = g.items.filter(r => r.status === "Pending" || r.status === "Sebagian").length;
                const GroupIcon = g.icon;

                return (
                  <div key={tipe} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {/* SECTION HEADER */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ background: g.bg, border: `1.5px solid ${g.border}`, borderRadius: 12, padding: "8px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                        <GroupIcon size={18} color={g.color} />
                        <div>
                          <div style={{ fontWeight: 900, fontSize: 14, color: g.color }}>{g.label}</div>
                          <div style={{ fontSize: 11, color: "#64748B" }}>
                            {g.items.length} request terdata
                            {pendingCount > 0 && (
                              <span style={{ marginLeft: 6, background: "#EF4444", color: "white", borderRadius: 20, fontSize: 10, padding: "1px 6px", fontWeight: 900 }}>
                                {pendingCount} menunggu tindakan
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div style={{ flex: 1, height: 1.5, background: `linear-gradient(to right, ${g.border}, transparent)` }} />
                    </div>

                    {/* CARDS GRID */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
                      {g.items.map((r: any) => {
                        const sc = STATUS_CONFIG[r.status] || STATUS_CONFIG["Pending"];
                        const isPending = r.status === "Pending" || r.status === "Sebagian" || r.status === "Terpenuhi Sebagian";
                        const isDitolak = r.status === "Ditolak";
                        const isSelesai = r.status === "Selesai" || r.status === "Terpenuhi Sebagian";
                        const pct = r.total_request > 0 ? Math.round(((r.total_dipenuhi || 0) / r.total_request) * 100) : 0;
                        const sisaKurang = Math.max(0, r.total_request - (r.total_dipenuhi || 0));
                        const matchedPo = findLinkedPO(r);
                        const portalUrl = getVendorPortalUrl(r.vendor_id, tipe);

                        return (
                          <div
                            key={r.id}
                            id={`req-${r.id}`}
                            style={{
                              background: "white",
                              borderRadius: 16,
                              border: isPending ? `1.5px solid ${sc.border}` : "1px solid #E2E8F0",
                              boxShadow: isPending ? "0 4px 16px rgba(59, 130, 246, 0.12)" : "0 2px 8px rgba(0,0,0,0.04)",
                              overflow: "hidden",
                              display: "flex",
                              flexDirection: "column",
                              transition: "transform 0.2s, box-shadow 0.2s"
                            }}
                          >
                            {/* CARD TOP HEADER */}
                            <div style={{ padding: "14px 18px", background: isPending ? g.bg : "#F8FAFC", borderBottom: `1px solid ${isPending ? g.border : "#E2E8F0"}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                                <div style={{ width: 40, height: 40, borderRadius: 12, background: isPending ? "white" : sc.badge, border: `2px solid ${sc.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 16, color: sc.badgeText, flexShrink: 0, boxShadow: "0 2px 6px rgba(0,0,0,0.05)" }}>
                                  {r.vendor_nama?.charAt(0) || "?"}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 800, fontSize: 15, color: "#0F172A", display: "flex", alignItems: "center", gap: 6 }}>
                                    {r.vendor_nama}
                                  </div>
                                  <div style={{ fontSize: 11, color: "#64748B", display: "flex", gap: 5, alignItems: "center", marginTop: 2 }}>
                                    <Clock size={11} />
                                    {new Date(r.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                                    &nbsp;·&nbsp;
                                    {new Date(r.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                                    &nbsp;· #{r.id}
                                  </div>
                                </div>
                              </div>

                              <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 20, background: sc.badge, color: sc.badgeText, border: `1px solid ${sc.border}`, flexShrink: 0 }}>
                                {r.status}
                              </span>
                            </div>

                            {/* STATS ROW (REQUEST, DIPENUHI, SISA) */}
                            <div style={{ padding: "12px 18px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, borderBottom: "1px solid #F1F5F9" }}>
                              {[
                                { label: "REQUEST", val: r.total_request, color: "#0F172A" },
                                { label: "DIPENUHI", val: r.total_dipenuhi || 0, color: r.total_dipenuhi > 0 ? "#10B981" : "#94A3B8" },
                                { label: "SISA", val: sisaKurang, color: sisaKurang > 0 ? "#F59E0B" : "#10B981" },
                              ].map(s => (
                                <div key={s.label} style={{ textAlign: "center" }}>
                                  <div style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase" }}>{s.label}</div>
                                  <div style={{ fontSize: 18, fontWeight: 900, color: s.color, lineHeight: 1.2 }}>
                                    {s.val}<span style={{ fontSize: 10, color: "#94A3B8", fontWeight: 600 }}> pcs</span>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* PROGRESS BAR */}
                            {!isDitolak && (
                              <div style={{ padding: "8px 18px 0", borderBottom: "1px solid #F1F5F9" }}>
                                <div style={{ width: "100%", background: "#E2E8F0", height: 6, borderRadius: 99, overflow: "hidden", marginBottom: 4 }}>
                                  <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: pct >= 100 ? "#10B981" : pct > 50 ? "#3B82F6" : "#F59E0B", borderRadius: 99, transition: "width 0.4s ease" }} />
                                </div>
                                <div style={{ fontSize: 10, color: "#64748B", textAlign: "right", paddingBottom: 6, fontWeight: 700 }}>
                                  {pct}% terpenuhi
                                </div>
                              </div>
                            )}

                            {/* FABRIC / PEMOTONGAN CROSS-REFERENCE */}
                            {r.pemotongan ? (
                              <div style={{ padding: "10px 18px", background: "#F0FDF4", borderBottom: "1px solid #D1FAE5" }}>
                                <div style={{ fontSize: 10, fontWeight: 800, color: "#16A34A", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
                                  <Layers size={12} /> KAIN / BAHAN DIMINTA
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <div>
                                    <div style={{ fontWeight: 800, fontSize: 13, color: "#0F172A" }}>{r.pemotongan.nama_barang}</div>
                                    <div style={{ fontSize: 11, color: "#64748B" }}>Model: <strong>{r.pemotongan.model}</strong></div>
                                  </div>
                                  <div style={{ textAlign: "right" }}>
                                    <div style={{ fontWeight: 900, fontSize: 15, color: "#16A34A" }}>
                                      {r.pemotongan.sisa_total}<span style={{ fontSize: 10, color: "#64748B", fontWeight: 600 }}> sisa</span>
                                    </div>
                                    <div style={{ fontSize: 9, color: "#64748B" }}>di pool/potongan</div>
                                  </div>
                                </div>
                                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                                  {(r.pemotongan.sizeBreakdown || []).map((s: any) => (
                                    <span key={s.size} style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 5, background: s.sisa > 0 || s.jumlah > 0 ? "#DCFCE7" : "#F1F5F9", color: s.sisa > 0 || s.jumlah > 0 ? "#16A34A" : "#94A3B8", border: `1px solid ${s.sisa > 0 || s.jumlah > 0 ? "#86EFAC" : "#E2E8F0"}` }}>
                                      {s.size}:{s.sisa !== undefined ? s.sisa : s.jumlah}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div style={{ padding: "10px 18px", background: "#FFFBEB", borderBottom: "1px solid #FDE68A", fontSize: 11, color: "#92400E", display: "flex", alignItems: "center", gap: 6 }}>
                                <AlertCircle size={14} /> Belum pilih kain spesifik — Admin tentukan saat proses
                              </div>
                            )}

                            {/* LINKED PO BADGE IF FULFILLED */}
                            {matchedPo && (
                              <div style={{ padding: "8px 18px", background: "#EFF6FF", borderBottom: "1px solid #DBEAFE", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11 }}>
                                <span style={{ color: "#1D4ED8", fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                                  <FileText size={12} /> Terhubung dg PO: <strong style={{ fontFamily: "monospace" }}>{matchedPo.noPo}</strong>
                                </span>
                                <Link
                                  href={`/alur-produksi?po=${matchedPo.id}`}
                                  style={{ color: "#2563EB", fontWeight: 800, textDecoration: "underline", fontSize: 10 }}
                                >
                                  Lihat di Alur Produksi →
                                </Link>
                              </div>
                            )}

                            {/* NOTICE FOR DOWNSTREAM (WASHING / FINISHING) REQUESTS */}
                            {(r.pemotongan?.is_transfer || r.transfer_id) && (
                              <div style={{ padding: "8px 18px", background: "#F0FDF4", borderBottom: "1px solid #BBF7D0", display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "#166534" }}>
                                <Workflow size={14} color="#16A34A" style={{ flexShrink: 0 }} />
                                <div>
                                  <strong>Pos Lanjutan ({r.vendor_kategori?.toUpperCase() || 'WASHING'}):</strong> Alirkan barang melalui <strong>Alur Produksi</strong> ("Kirim ke Pos Berikutnya").
                                </div>
                              </div>
                            )}

                            {/* NOTES OR REJECTION REASON */}
                            {(r.catatan || (isDitolak && r.alasan_tolak)) && (
                              <div style={{ padding: "10px 18px", borderBottom: "1px solid #F1F5F9", display: "flex", flexDirection: "column", gap: 4 }}>
                                {r.catatan && (
                                  <div style={{ fontSize: 11, color: "#475569", display: "flex", gap: 6 }}>
                                    <span style={{ color: "#94A3B8", fontWeight: 700 }}>Catatan:</span>
                                    <span>{r.catatan}</span>
                                  </div>
                                )}
                                {isDitolak && r.alasan_tolak && (
                                  <div style={{ fontSize: 11, color: "#991B1B", background: "#FEE2E2", padding: "6px 10px", borderRadius: 6, display: "flex", gap: 6, alignItems: "center" }}>
                                    <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                                    <span><strong>Alasan Tolak:</strong> {r.alasan_tolak}</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* FOOTER ACTIONS - CONNECTED TO ALL RELEVANT WORKFLOWS */}
                            {/* FOOTER ACTIONS - CONNECTED TO ALL RELEVANT WORKFLOWS */}
                            <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10, marginTop: "auto", background: "#FAFAFA", borderTop: "1px solid #F1F5F9" }}>
                              {/* Meta / Links row */}
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                  <a
                                    href={portalUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ fontSize: 11, color: "#64748B", textDecoration: "none", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}
                                    title="Buka portal login vendor"
                                  >
                                    <ExternalLink size={12} /> Portal
                                  </a>
                                  <span style={{ color: "#CBD5E1", fontSize: 12 }}>·</span>
                                  <button
                                    onClick={() => setDetailModal(r)}
                                    style={{ background: "none", border: "none", color: "#2563EB", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 3, padding: 0 }}
                                  >
                                    <Eye size={12} /> Detail
                                  </button>
                                </div>
                                <span style={{ fontSize: 10.5, color: "#94A3B8", fontWeight: 700 }}>#{r.id}</span>
                              </div>

                              {/* CONDITIONAL ACTION BUTTONS BASED ON STATUS */}
                              {isPending ? (
                                (r.pemotongan?.is_transfer || r.transfer_id) ? (
                                  /* POS LANJUTAN (WASHING / FINISHING / BERSIH BENANG) */
                                  <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
                                    <Link
                                      href={`/alur-produksi?po=${r.po_id || r.pemotongan?.po_id || ''}&sumber=${r.transfer_id || r.pemotongan?.transfer_id || ''}&vendor=${r.vendor_id}`}
                                      style={{
                                        background: "linear-gradient(135deg, #2563EB, #1D4ED8)",
                                        color: "white",
                                        padding: "8px 14px",
                                        borderRadius: 8,
                                        fontWeight: 800,
                                        fontSize: 12,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: 6,
                                        textDecoration: "none",
                                        boxShadow: "0 2px 6px rgba(37,99,235,0.25)",
                                        width: "100%",
                                        textAlign: "center"
                                      }}
                                      title="Buka Alur Produksi untuk mengalirkan barang ke vendor ini"
                                    >
                                      <Send size={13} /> Kirim di Alur Produksi →
                                    </Link>

                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, width: "100%" }}>
                                      <button
                                        type="button"
                                        onClick={() => { setRejectRequest(r); setRejectReason(""); }}
                                        style={{
                                          background: "#FFF1F2",
                                          color: "#BE123C",
                                          border: "1px solid #FECDD3",
                                          padding: "7px 10px",
                                          borderRadius: 8,
                                          fontWeight: 700,
                                          cursor: "pointer",
                                          fontSize: 11.5,
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          gap: 4,
                                          width: "100%"
                                        }}
                                      >
                                        <X size={13} /> Tolak
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setDownstreamModal(r);
                                          const breakdown = r.pemotongan?.sizeBreakdown || [];
                                          const alreadyDipenuhi = Number(r.total_dipenuhi || 0);
                                          const targetQty = Math.max(0, Number(r.total_request) - alreadyDipenuhi);
                                          
                                          const availableSizes = breakdown.filter((s:any) => Number(s.sisa || s.jumlah || 0) > 0);
                                          const numSizes = availableSizes.length;
                                          
                                          let perSize = 0;
                                          let remainder = 0;
                                          if (numSizes > 0 && targetQty > 0) {
                                            perSize = Math.floor(targetQty / numSizes);
                                            remainder = targetQty - (perSize * numSizes);
                                          }

                                          setDownstreamForm(breakdown.map((s:any) => {
                                            const max = Number(s.sisa || s.jumlah || 0);
                                            if (max <= 0) return { size: s.size, max, jumlah: "" };
                                            const extra = remainder > 0 ? 1 : 0;
                                            if (remainder > 0) remainder--;
                                            const qty = Math.min(perSize + extra, max);
                                            return { size: s.size, max, jumlah: qty > 0 ? qty : "" };
                                          }));
                                        }}
                                        style={{
                                          background: "#F0FDF4",
                                          color: "#166534",
                                          border: "1px solid #BBF7D0",
                                          padding: "7px 10px",
                                          borderRadius: 8,
                                          fontWeight: 700,
                                          cursor: "pointer",
                                          fontSize: 11.5,
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          gap: 4,
                                          width: "100%"
                                        }}
                                        title="Alokasikan cepat langsung dari halaman ini"
                                      >
                                        <CheckCheck size={13} /> ACC Cepat
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  /* FOR CMT (POTONGAN KAIN) */
                                  <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8, width: "100%" }}>
                                    <button
                                      type="button"
                                      onClick={() => { setRejectRequest(r); setRejectReason(""); }}
                                      style={{
                                        background: "#FFF1F2",
                                        color: "#BE123C",
                                        border: "1px solid #FECDD3",
                                        padding: "8px 10px",
                                        borderRadius: 8,
                                        fontWeight: 700,
                                        cursor: "pointer",
                                        fontSize: 11.5,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: 4,
                                        width: "100%"
                                      }}
                                    >
                                      <X size={13} /> Tolak
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const targetQty = Number(r.total_request);
                                        let bestPemo = pemotonganList[0];
                                        if (pemotonganList.length > 1) {
                                          bestPemo = pemotonganList.reduce((best: any, p: any) => {
                                            const ts = p.sizeBreakdown.reduce((s: number, x: any) => s + (x.sisa || 0), 0);
                                            const bs = best.sizeBreakdown.reduce((s: number, x: any) => s + (x.sisa || 0), 0);
                                            return ts > bs ? p : best;
                                          });
                                        }
                                        if (r.pemotongan_id) {
                                          const cmtPemo = pemotonganList.find((p: any) => p.id === r.pemotongan_id);
                                          if (cmtPemo) bestPemo = cmtPemo;
                                        }
                                        setProcessRequest(r);
                                        setForm({
                                          pemotonganId: bestPemo ? String(bestPemo.id) : "",
                                          vendorId: String(r.vendor_id),
                                          catatan: `Pemenuhan request #${r.id} (${r.total_request} pcs) dari ${r.vendor_nama}`,
                                          target_selesai: ""
                                        });
                                        if (bestPemo) {
                                          setSizeBreakdown(distributeEvenly(bestPemo, targetQty));
                                        }
                                        setActiveTab("manual");
                                      }}
                                      style={{
                                        background: "linear-gradient(135deg, #2563EB, #1D4ED8)",
                                        color: "white",
                                        border: "none",
                                        padding: "8px 12px",
                                        borderRadius: 8,
                                        fontWeight: 800,
                                        cursor: "pointer",
                                        fontSize: 12,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: 5,
                                        boxShadow: "0 2px 6px rgba(37,99,235,0.25)",
                                        width: "100%"
                                      }}
                                    >
                                      <CheckCheck size={14} /> Buat SPK CMT
                                    </button>
                                  </div>
                                )
                              ) : isDitolak ? (
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, width: "100%" }}>
                                  <button
                                    onClick={() => handleReopenRequest(r)}
                                    style={{ background: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE", padding: "6px 10px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 11.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
                                  >
                                    <RotateCcw size={12} /> Buka Kembali
                                  </button>
                                  <button
                                    onClick={() => setDeleteRequest(r)}
                                    style={{ background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", padding: "6px 10px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 11.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, transition: "all 0.15s" }}
                                    title="Hapus permohonan yang ditolak ini"
                                  >
                                    <Trash2 size={12} /> Hapus
                                  </button>
                                </div>
                              ) : (
                                /* Status Selesai / Terpenuhi */
                                <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                                  {matchedPo ? (
                                    <Link
                                      href={`/daftar-spk?search=${encodeURIComponent(matchedPo.noPo)}`}
                                      className="btn btn-secondary"
                                      style={{ padding: "5px 10px", fontSize: 11, fontWeight: 700, background: "white", display: "flex", alignItems: "center", gap: 4 }}
                                    >
                                      <FileText size={12} /> Lihat PO
                                    </Link>
                                  ) : (
                                    <Link
                                      href={`/dashboard-cmt`}
                                      className="btn btn-secondary"
                                      style={{ padding: "5px 10px", fontSize: 11, fontWeight: 700, background: "white", display: "flex", alignItems: "center", gap: 4 }}
                                    >
                                      <Activity size={12} /> Ledger CMT
                                    </Link>
                                  )}
                                  <span style={{ fontSize: 11, color: "#10B981", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 3, padding: "4px 8px", background: "#D1FAE5", borderRadius: 6 }}>
                                    <Check size={12} /> Selesai
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              });
            })()
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 2: STUDIO BUAT SPK PRODUKSI (FULL SCREEN WORKSPACE - 0 PAGE SCROLL)
         ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "manual" && (
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <form onSubmit={handleSubmit} style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {/* 2-COLUMN STUDIO WORKSPACE */}
            <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "1.05fr 1.35fr", gap: 12 }}>
              
              {/* ─── KOLOM KIRI: SUMBER BAHAN & BREAKDOWN UKURAN ─── */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 0, overflowY: "auto", paddingRight: 4 }}>
                
                {/* CARD 1: SUMBER BAHAN POTONGAN & JADWAL */}
                <div style={{ background: "white", borderRadius: 14, padding: "14px 16px", border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.03)", flexShrink: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: "#EFF6FF", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Scissors size={15} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 13, color: "#1E293B" }}>1. Sumber Bahan Potongan</div>
                        <div style={{ fontSize: 11, color: "#64748B" }}>Pilih batch hasil potong & target jahit</div>
                      </div>
                    </div>
                    <Link href="/pemotongan-kain" style={{ fontSize: 11, color: "#2563EB", fontWeight: 700, textDecoration: "underline" }}>
                      + Catat Baru ↗
                    </Link>
                  </div>

                  {/* Select Pemotongan */}
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                      Ambil Dari Stok Potongan <span style={{ color: "#EF4444" }}>*</span>
                    </label>
                    <select
                      required
                      style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #CBD5E1", fontSize: 13, fontWeight: 600, color: "#0F172A", background: "#F8FAFC", outline: "none", cursor: "pointer" }}
                      value={form.pemotonganId}
                      onChange={e => handlePemotonganChange(e.target.value)}
                    >
                      <option value="">-- Pilih Stok Potongan Siap Jahit --</option>
                      {pemotonganList.map(p => {
                        const totalSisa = (p.sizeBreakdown || []).reduce((sum: number, s: any) => sum + (s.sisa || 0), 0);
                        return (
                          <option key={p.id} value={p.id}>
                            {p.tukang_potong_nama} ({p.tukang_potong_kode}) - {p.model} (Sisa: {totalSisa} pcs)
                          </option>
                        );
                      })}
                    </select>

                    {/* Preview Selected */}
                    {selectedPemotongan ? (
                      <div style={{ marginTop: 8, padding: "8px 12px", background: "#F0FDF4", borderRadius: 8, border: "1px solid #BBF7D0", fontSize: 11.5 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontWeight: 800, color: "#166534" }}>Kain: {selectedPemotongan.nama_barang}</span>
                          <span style={{ background: "#DCFCE7", color: "#166534", padding: "1px 7px", borderRadius: 4, fontWeight: 800 }}>
                            Sisa: {(selectedPemotongan.sizeBreakdown || []).reduce((s:number, x:any)=>s+(x.sisa||0),0)} pcs
                          </span>
                        </div>
                        <div style={{ color: "#475569", marginTop: 2 }}>
                          Model: <strong>{selectedPemotongan.model}</strong> · Tukang Potong: <strong>{selectedPemotongan.tukang_potong_nama} ({selectedPemotongan.tukang_potong_kode})</strong>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 4 }}>
                        Pilih stok potongan yang memiliki sisa kuantitas untuk dialokasikan ke CMT.
                      </div>
                    )}
                  </div>

                  {/* Target & Catatan 2-Col */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                        Target Selesai Jahit
                      </label>
                      <input
                        type="date"
                        style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1.5px solid #CBD5E1", fontSize: 12, color: "#0F172A", background: "#F8FAFC", outline: "none" }}
                        value={form.target_selesai}
                        onChange={e => setForm({ ...form, target_selesai: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                        Instruksi Jahitan (Opsional)
                      </label>
                      <input
                        type="text"
                        placeholder="Misal: Jahit benang emas jeans..."
                        style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1.5px solid #CBD5E1", fontSize: 12, color: "#0F172A", background: "#F8FAFC", outline: "none" }}
                        value={form.catatan}
                        onChange={e => setForm({ ...form, catatan: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* CARD 2: ALOKASI & BREAKDOWN UKURAN */}
                <div style={{
                  background: "white",
                  borderRadius: 14,
                  padding: "14px 16px",
                  border: "1px solid #E2E8F0",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  opacity: selectedPemotongan ? 1 : 0.65,
                  pointerEvents: selectedPemotongan ? "auto" : "none",
                  transition: "opacity 0.2s"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Layers3 size={15} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 13, color: "#1E293B" }}>2. Breakdown Ukuran</div>
                        <div style={{ fontSize: 11, color: "#64748B" }}>Tentukan kuantitas potong yang diserahkan</div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {selectedPemotongan && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              const allSisa = selectedPemotongan.sizeBreakdown.map((s:any) => ({ size: s.size, jumlah: s.sisa, maxSisa: s.sisa }));
                              setSizeBreakdown(allSisa);
                              toast.success("Diisi penuh sesuai sisa stok");
                            }}
                            style={{ background: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE", padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                          >
                            Penuh
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSizeBreakdown(selectedPemotongan.sizeBreakdown.map((s:any) => ({ size: s.size, jumlah: 0, maxSisa: s.sisa })));
                            }}
                            style={{ background: "#F1F5F9", color: "#64748B", border: "1px solid #E2E8F0", padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                          >
                            Reset 0
                          </button>
                        </>
                      )}
                      <span style={{
                        background: totalPcs > 0 ? "#10B981" : "#F1F5F9",
                        color: totalPcs > 0 ? "white" : "#64748B",
                        padding: "4px 10px",
                        borderRadius: 14,
                        fontWeight: 800,
                        fontSize: 12
                      }}>
                        {totalPcs} pcs
                      </span>
                    </div>
                  </div>

                  {!selectedPemotongan ? (
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "30px 10px", color: "#94A3B8", textAlign: "center" }}>
                      <AlertCircle size={28} style={{ color: "#CBD5E1", marginBottom: 6 }} />
                      <div style={{ fontWeight: 700, fontSize: 12.5 }}>Pilih Stok Potongan di atas terlebih dahulu</div>
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(105px, 1fr))", gap: 8 }}>
                      {sizeBreakdown.map((item, idx) => (
                        <div
                          key={idx}
                          style={{
                            border: item.jumlah > 0 ? "2px solid #3B82F6" : "1.5px solid #F1F5F9",
                            borderRadius: 10,
                            padding: "8px 8px",
                            background: item.jumlah > 0 ? "#EFF6FF" : "#F8FAFC",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 4,
                            transition: "all 0.15s"
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", padding: "0 2px" }}>
                            <span style={{ fontWeight: 900, fontSize: 13, color: item.jumlah > 0 ? "#1D4ED8" : "#0F172A" }}>
                              {item.size}
                            </span>
                            <span style={{ fontSize: 10, color: "#64748B", fontWeight: 700 }}>
                              sisa: {item.maxSisa}
                            </span>
                          </div>
                          <input
                            type="number"
                            min="0"
                            max={item.maxSisa}
                            style={{
                              textAlign: "center",
                              padding: "6px 4px",
                              width: "100%",
                              borderRadius: 6,
                              border: item.jumlah > 0 ? "1px solid #93C5FD" : "1px solid #CBD5E1",
                              fontSize: 14,
                              fontWeight: 800,
                              color: "#0F172A",
                              outline: "none",
                              background: "white"
                            }}
                            value={item.jumlah === 0 ? "" : item.jumlah}
                            onChange={e => {
                              const val = parseInt(e.target.value) || 0;
                              if (val > item.maxSisa) return toast.error(`Maksimal sisa stok untuk size ${item.size} adalah ${item.maxSisa}`);
                              const newB = [...sizeBreakdown];
                              newB[idx].jumlah = val;
                              setSizeBreakdown(newB);
                            }}
                            placeholder="0"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ─── KOLOM KANAN: VENDOR CMT PICKER (ANALISIS KAPASITAS & BEBAN) ─── */}
              <div style={{
                background: "white",
                borderRadius: 14,
                padding: "14px 16px",
                border: "1px solid #E2E8F0",
                boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
                overflow: "hidden"
              }}>
                {(() => {
                  const allWl = allVendors
                    .map(v => getVendorWorkload(v.id))
                    .filter(Boolean) as any[];
                  const matching = allWl.filter(w => (w.vendorTipe || "").toLowerCase() === "cmt");
                  const others = allWl.filter(w => (w.vendorTipe || "").toLowerCase() !== "cmt");
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
                    <>
                      {/* VENDOR PICKER HEADER */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexShrink: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 8, background: "#EFF6FF", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Users size={15} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 13, color: "#1E293B" }}>
                              3. Pilih Mitra CMT Penjahit Tujuan <span style={{ color: "#EF4444" }}>*</span>
                            </div>
                            <div style={{ fontSize: 11, color: "#64748B" }}>
                              Diurutkan dari beban teraman & skor kelayakan tertinggi
                            </div>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {others.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setShowAllVendors(!showAllVendors)}
                              style={{ fontSize: 11, fontWeight: 700, color: "#2563EB", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 6, padding: "4px 8px", cursor: "pointer" }}
                            >
                              {showAllVendors ? "Hanya CMT" : `+ ${others.length} vendor lain`}
                            </button>
                          )}
                          <Link href="/atur-vendor" style={{ fontSize: 11, color: "#2563EB", fontWeight: 700, textDecoration: "underline" }}>
                            Atur Vendor ↗
                          </Link>
                        </div>
                      </div>

                      {/* Overdue Alert Strip */}
                      {problemCount > 0 && (
                        <div style={{ display: "flex", gap: 8, alignItems: "center", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "6px 10px", marginBottom: 8, flexShrink: 0 }}>
                          <AlertTriangle size={15} color="#DC2626" style={{ flexShrink: 0 }} />
                          <div style={{ fontSize: 11, color: "#7F1D1D", lineHeight: 1.3 }}>
                            <b>{problemCount} dari {matching.length} vendor CMT</b> memiliki pekerjaan <b>terlambat</b>. Periksa rincian tunggakan sebelum alokasi.
                          </div>
                        </div>
                      )}

                      {/* VENDOR LIST SCROLLABLE AREA */}
                      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, paddingRight: 4 }}>
                        {list.length === 0 && (
                          <div style={{ fontSize: 12, color: "#64748B", textAlign: "center", padding: 30, border: "1px dashed #CBD5E1", borderRadius: 10 }}>
                            Belum ada vendor CMT jahit yang terdaftar atau aktif.
                          </div>
                        )}

                        {list.map((w: any) => {
                          const c = lvl(w);
                          const selected = String(form.vendorId) === String(w.vendorId);
                          const expanded = selected || expandedVendorId === w.vendorId;
                          const isMatch = (w.vendorTipe || "").toLowerCase() === "cmt";
                          const overdueList = w.unfinishedPOs.filter((u: any) => u.isOverdue);
                          const waText = overdueList.length
                            ? `Halo ${w.vendorNama}, mohon update progres pekerjaan berikut yang sudah melewati target:\n` +
                              overdueList.map((u: any) => `- ${u.noPo} (${u.model}) sisa ${u.sisaPcs} pcs, target ${fmtDate(u.target_selesai)} (+${u.overdueDays} hari)`).join("\n") +
                              `\nKapan bisa diselesaikan? Terima kasih.`
                            : `Halo ${w.vendorNama}, kami berencana menerbitkan PO jahit baru. Apakah kapasitas Anda tersedia?`;
                          const wa = waLink(w.kontak, waText);
                          const vReq = cmtRequests.find((r: any) => String(r.vendor_id) === String(w.vendorId) && (r.status === "Pending" || r.status === "Sebagian"));

                          return (
                            <div
                              key={w.vendorId}
                              style={{
                                borderRadius: 10,
                                border: selected ? `2px solid ${c.dot}` : `1px solid ${w.hasOverdue ? "#FECACA" : "#E2E8F0"}`,
                                background: selected ? c.bg : "#FFFFFF",
                                overflow: "hidden",
                                boxShadow: selected ? `0 2px 8px ${c.dot}22` : "none",
                                transition: "all 0.15s ease",
                                flexShrink: 0
                              }}
                            >
                              {/* Header Vendor Card */}
                              <div
                                role="button"
                                onClick={() => setForm(prev => ({ ...prev, vendorId: String(w.vendorId) }))}
                                style={{ padding: "10px 12px", cursor: "pointer", display: "flex", gap: 10, alignItems: "flex-start" }}
                              >
                                {/* Radio Circle */}
                                <div style={{ width: 16, height: 16, marginTop: 2, borderRadius: "50%", border: `2px solid ${selected ? c.dot : "#CBD5E1"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                  {selected && <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.dot }} />}
                                </div>

                                {/* Info Vendor */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                    <span style={{ fontSize: 13, fontWeight: 900, color: "#0F172A" }}>{w.vendorNama}</span>
                                    <span style={{ fontSize: 9.5, fontWeight: 800, padding: "1px 6px", borderRadius: 4, background: "#EFF6FF", color: "#1D4ED8", textTransform: "uppercase" }}>{w.vendorTipe}</span>
                                    <span style={{ fontSize: 10, color: "#64748B", fontWeight: 600 }}>Kode: {w.kodeVendor}</span>
                                    {w.kontak && <span style={{ fontSize: 10, color: "#64748B" }}>· {w.kontak}</span>}
                                    {!isMatch && (
                                      <span style={{ fontSize: 9.5, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: "#FFF7ED", color: "#C2410C" }}>Bukan CMT</span>
                                    )}
                                    {w.vendorId === bestId && w.capacityLevel !== "overloaded" && (
                                      <span style={{ fontSize: 9.5, fontWeight: 800, padding: "1px 6px", borderRadius: 4, background: "#DBEAFE", color: "#1D4ED8" }}>⭐ Paling Layak</span>
                                    )}
                                    {vReq && (
                                      <span style={{ fontSize: 9.5, fontWeight: 800, padding: "1px 6px", borderRadius: 4, background: "#FEF3C7", color: "#92400E", border: "1px solid #FCD34D" }}>
                                        📥 Req ({Math.max(0, Number(vReq.total_request || 0) - Number(vReq.total_dipenuhi || 0))} pcs)
                                      </span>
                                    )}
                                  </div>

                                  {/* Indikator Beban Kerja Pills */}
                                  <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
                                    <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 4, background: c.chip, color: c.fg }}>{c.icon} {w.capacityLabel}</span>
                                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "#F8FAFC", color: "#334155", border: "1px solid #E2E8F0" }}>{w.totalActivePO} PO aktif</span>
                                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "#F8FAFC", color: w.totalPcsUnfinished ? "#B91C1C" : "#166534", border: "1px solid #E2E8F0" }}>
                                      {w.totalPcsUnfinished.toLocaleString("id-ID")} pcs tertahan
                                    </span>
                                    {w.hasOverdue && (
                                      <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 4, background: "#FEE2E2", color: "#DC2626", border: "1px solid #FCA5A5" }}>
                                        🚨 {w.overdueCount} telat (+{w.maxOverdueDays} hr)
                                      </span>
                                    )}
                                    {w.hargaPerPcs > 0 && (
                                      <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 4, background: "#F8FAFC", color: "#475569", border: "1px solid #E2E8F0" }}>
                                        Rp {w.hargaPerPcs.toLocaleString("id-ID")}/pcs
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Skor Kelayakan */}
                                <div style={{ textAlign: "center", flexShrink: 0 }}>
                                  <div style={{ width: 42, height: 42, borderRadius: "50%", background: `conic-gradient(${c.dot} ${w.score * 3.6}deg, #E2E8F0 0deg)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 900, color: c.fg }}>
                                      {w.score}
                                    </div>
                                  </div>
                                  <div style={{ fontSize: 8.5, fontWeight: 700, color: c.fg, marginTop: 2, maxWidth: 65, lineHeight: 1.1 }}>
                                    {w.recommendation}
                                  </div>
                                </div>
                              </div>

                              {/* Toggle Rincian */}
                              {!selected && w.totalActivePO > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setExpandedVendorId(expandedVendorId === w.vendorId ? null : w.vendorId)}
                                  style={{ width: "100%", border: "none", borderTop: "1px solid #F1F5F9", background: "#FAFAFA", padding: "4px", fontSize: 10.5, fontWeight: 700, color: "#475569", cursor: "pointer" }}
                                >
                                  {expanded ? "Tutup rincian ▲" : `Lihat rincian ${w.totalActivePO} pekerjaan ▼`}
                                </button>
                              )}

                              {/* Panel Rincian Lengkap */}
                              {expanded && (
                                <div style={{ borderTop: `1px solid ${c.bd}`, background: "#FFFFFF", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                                  {/* Temuan Analisis */}
                                  {w.reasons.length > 0 ? (
                                    <div style={{ background: c.bg, border: `1px solid ${c.bd}`, borderRadius: 6, padding: "8px 10px" }}>
                                      <div style={{ fontSize: 11, fontWeight: 800, color: c.fg, marginBottom: 2 }}>Temuan Analisis:</div>
                                      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: "#334155", lineHeight: 1.4 }}>
                                        {w.reasons.map((r: string, i: number) => <li key={i}>{r}</li>)}
                                      </ul>
                                    </div>
                                  ) : (
                                    <div style={{ display: "flex", gap: 6, alignItems: "center", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 6, padding: "8px 10px", fontSize: 11, color: "#166534", fontWeight: 700 }}>
                                      <CheckCircle2 size={14} /> Bebas tunggakan · Kapasitas aman & siap order.
                                    </div>
                                  )}

                                  {/* Mini Metrics */}
                                  {w.totalActivePO > 0 && (
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4, textAlign: "center" }}>
                                      {[
                                        { l: "Dipegang", v: `${w.totalPcsAssigned.toLocaleString("id-ID")} pcs`, col: "#0F172A" },
                                        { l: "Sisa", v: `${w.totalPcsUnfinished.toLocaleString("id-ID")} pcs`, col: "#B91C1C" },
                                        { l: "Lewat Target", v: `${w.overduePcs.toLocaleString("id-ID")} pcs`, col: w.overduePcs ? "#DC2626" : "#16A34A" },
                                        { l: "Rata² Progres", v: `${w.avgProgress}%`, col: "#2563EB" },
                                      ].map((m, i) => (
                                        <div key={i} style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 6, padding: "4px 4px" }}>
                                          <div style={{ fontSize: 9, color: "#64748B", fontWeight: 700 }}>{m.l}</div>
                                          <div style={{ fontSize: 11, fontWeight: 900, color: m.col, marginTop: 1 }}>{m.v}</div>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Daftar PO Ringkas */}
                                  {w.unfinishedPOs.map((u: any) => (
                                    <div key={u.key} style={{ border: `1px solid ${u.isOverdue ? "#FCA5A5" : "#E2E8F0"}`, borderLeft: `3px solid ${u.isOverdue ? "#DC2626" : (u.sisaHari !== null && u.sisaHari <= 3) ? "#F59E0B" : "#3B82F6"}`, borderRadius: 6, padding: "6px 8px", background: u.isOverdue ? "#FFFBFB" : "#FFFFFF" }}>
                                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <div style={{ fontSize: 11.5, fontWeight: 800, color: "#0F172A" }}>
                                          <span style={{ fontFamily: "monospace", color: "#1D4ED8" }}>{u.noPo}</span> · {u.model}
                                        </div>
                                        {u.isOverdue ? (
                                          <span style={{ fontSize: 9.5, fontWeight: 900, color: "#FFFFFF", background: "#DC2626", padding: "1px 6px", borderRadius: 3 }}>
                                            TELAT +${u.overdueDays} HR
                                          </span>
                                        ) : (
                                          <span style={{ fontSize: 9.5, fontWeight: 700, color: "#64748B" }}>
                                            Target: {fmtDate(u.target_selesai)}
                                          </span>
                                        )}
                                      </div>
                                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#64748B", marginTop: 4 }}>
                                        <span>Selesai {u.selesaiPcs} / {u.totalPcs} pcs</span>
                                        <span style={{ fontWeight: 800, color: u.isOverdue ? "#DC2626" : "#0F172A" }}>Sisa {u.sisaPcs} pcs ({u.progressPct}%)</span>
                                      </div>
                                      <div style={{ height: 4, background: "#E2E8F0", borderRadius: 2, overflow: "hidden", marginTop: 3 }}>
                                        <div style={{ width: `${u.progressPct}%`, height: "100%", background: u.isOverdue ? "#EF4444" : "#10B981" }} />
                                      </div>
                                    </div>
                                  ))}

                                  {/* Tombol Portal & WA */}
                                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 2 }}>
                                    <Link
                                      href={`/cmt/${w.vendorId}`}
                                      target="_blank"
                                      style={{ fontSize: 10.5, fontWeight: 700, color: "#1D4ED8", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 4, padding: "4px 8px", textDecoration: "none" }}
                                    >
                                      Portal Vendor ↗
                                    </Link>
                                    {wa && overdueList.length > 0 && (
                                      <a
                                        href={wa}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{ fontSize: 10.5, fontWeight: 700, color: "#FFFFFF", background: "#16A34A", borderRadius: 4, padding: "4px 8px", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
                                      >
                                        Tagih via WA ({overdueList.length})
                                      </a>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* ─── BOTTOM ACTION BAR: SUMMARY & SUBMIT (FULL WIDTH, SLEEK & COMPACT) ─── */}
            <div style={{
              background: "white",
              borderRadius: 12,
              padding: "8px 14px",
              border: "1px solid #E2E8F0",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexShrink: 0,
              gap: 12
            }}>
              {/* Left: Summary Info Badges */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => {
                    setForm({ pemotonganId: "", vendorId: "", catatan: "", target_selesai: "" });
                    setSizeBreakdown([]);
                    setProcessRequest(null);
                    toast.info("Form SPK di-reset");
                  }}
                  style={{ background: "#F1F5F9", color: "#64748B", border: "1px solid #E2E8F0", padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
                >
                  <RotateCcw size={12} /> Reset
                </button>

                <div style={{ height: 16, width: 1, background: "#E2E8F0" }} />

                <div style={{ fontSize: 12, color: "#64748B", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span>
                    Bahan: <strong style={{ color: selectedPemotongan ? "#0F172A" : "#94A3B8" }}>{selectedPemotongan ? `${selectedPemotongan.nama_barang} (${selectedPemotongan.model})` : "Belum dipilih"}</strong>
                  </span>
                  <span>·</span>
                  <span>
                    Mitra CMT: <strong style={{ color: form.vendorId ? "#2563EB" : "#94A3B8" }}>
                      {cmtVendors.find(v => String(v.id) === String(form.vendorId))?.nama || allVendors.find(v => String(v.id) === String(form.vendorId))?.nama || "Belum dipilih"}
                    </strong>
                  </span>
                  <span>·</span>
                  <span>
                    Target: <strong style={{ color: form.target_selesai ? "#0F172A" : "#94A3B8" }}>{form.target_selesai || "Belum diatur"}</strong>
                  </span>
                </div>
              </div>

              {/* Right: Submit Button & Total Badge */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ textAlign: "right", paddingRight: 4 }}>
                  <div style={{ fontSize: 10.5, color: "#64748B", fontWeight: 700 }}>Total Alokasi SPK</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: totalPcs > 0 ? "#10B981" : "#94A3B8", lineHeight: 1 }}>
                    {totalPcs} pcs
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || totalPcs === 0 || !selectedPemotongan || !form.vendorId}
                  style={{
                    padding: "10px 24px",
                    fontSize: 14,
                    fontWeight: 800,
                    background: (loading || totalPcs === 0 || !selectedPemotongan || !form.vendorId)
                      ? "#94A3B8"
                      : "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
                    color: "white",
                    borderRadius: 10,
                    border: "none",
                    cursor: (loading || totalPcs === 0 || !selectedPemotongan || !form.vendorId) ? "not-allowed" : "pointer",
                    boxShadow: (loading || totalPcs === 0 || !selectedPemotongan || !form.vendorId) ? "none" : "0 4px 14px rgba(37, 99, 235, 0.35)",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    transition: "all 0.15s"
                  }}
                >
                  {loading ? "Menerbitkan SPK..." : `Terbitkan SPK (${totalPcs} pcs) & Barcode →`}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 3: LAPORAN PROGRES CMT
         ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "laporan" && (
        <div style={{ marginBottom: 40 }}>
          {cmtProgres.length === 0 ? (
            <div style={{ background: "white", borderRadius: 18, padding: 60, textAlign: "center", border: "1px solid #E2E8F0" }}>
              <CheckCircle2 size={44} style={{ color: "#CBD5E1", margin: "0 auto 14px" }} />
              <div style={{ fontSize: 16, fontWeight: 700, color: "#64748B" }}>Belum ada Laporan Progres dari Vendor CMT</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
              {cmtProgres.map((lp: any) => {
                const isPending = lp.status === "Menunggu" || lp.status === "Pending";
                const isLanjutan = !!lp.transfer_id;
                const tahapNama = isLanjutan ? (lp.tahap_nama || lp.vendor_tipe_label || (lp.vendor_tipe ? String(lp.vendor_tipe).charAt(0).toUpperCase() + String(lp.vendor_tipe).slice(1) : "Vendor Lanjutan")) : "Jahit";
                return (
                  <div key={lp.id} style={{ background: "white", borderRadius: 16, border: `1px solid ${isPending ? "#F59E0B" : "#E2E8F0"}`, boxShadow: isPending ? "0 4px 14px rgba(245,158,11,0.12)" : "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                    
                    {/* Header */}
                    <div style={{ padding: "14px 18px", background: isPending ? "#FFFBEB" : "#F8FAFC", borderBottom: `1px solid ${isPending ? "#FDE68A" : "#E2E8F0"}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: isPending ? "#FEF3C7" : "#D1FAE5", border: `2px solid ${isPending ? "#F59E0B" : "#10B981"}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 15, color: isPending ? "#92400E" : "#065F46" }}>
                          {lp.vendor_nama?.charAt(0) || "?"}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 14, color: "#0F172A" }}>{lp.vendor_nama}</div>
                          <div style={{ fontSize: 11, color: "#64748B", display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
                            <Clock size={11} />
                            {new Date(lp.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                            <span style={{ fontSize: 9.5, fontWeight: 800, padding: "1px 6px", borderRadius: 4, background: isLanjutan ? "#E0F2FE" : "#F1F5F9", color: isLanjutan ? "#0369A1" : "#475569", textTransform: "uppercase" }}>
                              {isLanjutan ? tahapNama : "CMT"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 20, background: isPending ? "#FEF3C7" : "#D1FAE5", color: isPending ? "#92400E" : "#065F46", border: `1px solid ${isPending ? "#FCD34D" : "#6EE7B7"}` }}>
                        {isPending ? "Menunggu ACC Admin" : lp.status === "Diterima" || lp.status === "Diverifikasi" ? "Diterima (ACC)" : lp.status}
                      </span>
                    </div>

                    {/* Content */}
                    <div style={{ padding: "12px 18px", borderBottom: "1px solid #F1F5F9" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                        <div style={{ background: "#F8FAFC", borderRadius: 10, padding: "8px 12px" }}>
                          <div style={{ fontSize: 9, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase" }}>PO / Model</div>
                          <div style={{ fontWeight: 900, fontSize: 14, color: "#0F172A" }}>{lp.noPo}</div>
                          <div style={{ fontSize: 11, color: "#64748B" }}>{lp.model}</div>
                        </div>
                        <div style={{ background: "#F0FDF4", borderRadius: 10, padding: "8px 12px", border: "1px solid #DCFCE7" }}>
                          <div style={{ fontSize: 9, fontWeight: 800, color: "#16A34A", textTransform: "uppercase" }}>Dilaporkan Selesai {tahapNama}</div>
                          <div style={{ fontSize: 18, fontWeight: 900, color: "#10B981" }}>{lp.totalJumlah} pcs</div>
                          <div style={{ fontSize: 10, color: "#64748B" }}>dari {isLanjutan ? "jatah vendor" : "target PO"} {lp.targetJumlah} pcs</div>
                        </div>
                      </div>

                      {/* Sizes */}
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {(lp.items || []).map((it: any, i: number) => (
                          <span key={i} style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE" }}>
                            {it.size}: {it.jumlah}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ padding: "12px 16px", display: "flex", justifyContent: isPending ? "flex-end" : "space-between", alignItems: "center", marginTop: "auto", background: "#FAFAFA" }}>
                      {!isPending && (
                        <Link href={`/daftar-spk?search=${lp.noPo}`} style={{ fontSize: 11, color: "#2563EB", fontWeight: 700, textDecoration: "underline" }}>
                          Lihat PO →
                        </Link>
                      )}
                      {isPending ? (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => handleTolakLaporan(lp.id)} style={{ background: "#FEE2E2", color: "#991B1B", border: "1px solid #FECACA", padding: "6px 12px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                            <X size={13} /> Tolak
                          </button>
                          <button onClick={() => handleTerimaLaporan(lp.id)} style={{ background: "linear-gradient(135deg, #10B981, #059669)", color: "white", border: "none", padding: "6px 14px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 4, boxShadow: "0 3px 8px rgba(16,185,129,0.3)" }}>
                            <CheckCheck size={13} /> ACC Terima
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: lp.status === "Diterima" ? "#10B981" : "#EF4444", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                          <Check size={12} /> {lp.status === "Diterima" ? "Sudah di-ACC" : "Ditolak"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 4: LAPORAN WASHING / LAUNDRY
         ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "washing" && (
        <div style={{ marginBottom: 40 }}>
          {/* BANNER REKOMENDASI ALUR PRODUKSI */}
          <div style={{
            background: "linear-gradient(135deg, #ECFEFF 0%, #EFF6FF 100%)",
            border: "1px solid #A5F3FC",
            borderRadius: 14,
            padding: "12px 18px",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
            flexWrap: "wrap",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 280 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: "#CFFAFE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Droplets size={18} color="#0891B2" />
              </div>
              <div style={{ fontSize: 12.5, color: "#0E7490", lineHeight: 1.45 }}>
                <strong style={{ color: "#0891B2" }}>Pos Washing Terintegrasi di Alur Produksi:</strong> Seluruh pengaliran barang ke washing dan pengiriman hasil cuci ke pos berikutnya (Bersih Benang / Gudang) dapat dikelola secara terpusat melalui fitur <strong>Alur Produksi</strong>.
              </div>
            </div>
            <Link
              href="/alur-produksi"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "7px 14px",
                background: "#0891B2",
                color: "#FFFFFF",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 800,
                textDecoration: "none",
                whiteSpace: "nowrap"
              }}
            >
              Buka di Alur Produksi →
            </Link>
          </div>

          {washingTransfers.filter(isVisibleWashing).length === 0 ? (
            <div style={{ background: "white", borderRadius: 18, padding: 60, textAlign: "center", border: "1px solid #E2E8F0" }}>
              <Droplets size={44} style={{ color: "#A5F3FC", margin: "0 auto 14px" }} />
              <div style={{ fontSize: 16, fontWeight: 700, color: "#64748B" }}>Belum ada laporan dari Vendor Washing</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
              {washingTransfers.filter(isVisibleWashing).map((wt: any) => {
                const st = getWashingState(wt);
                const isDone = st.key === "selesai" || st.key === "gudang";
                const canManualAcc = st.key === "dikirim" || st.key === "proses";
                const prog = wt.progress;
                const progPct = prog && prog.jumlah > 0 ? Math.min(100, Math.round((prog.approved / prog.jumlah) * 100)) : 0;
                const pendPct = prog && prog.jumlah > 0 ? Math.min(100 - progPct, Math.round((prog.pending / prog.jumlah) * 100)) : 0;
                return (
                  <div key={wt.id} style={{ background: "white", borderRadius: 16, border: `1px solid ${isDone ? "#E2E8F0" : st.border}`, boxShadow: isDone ? "0 2px 8px rgba(0,0,0,0.04)" : "0 4px 14px rgba(6,182,212,0.10)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                    
                    {/* Header */}
                    <div style={{ padding: "14px 18px", background: isDone ? "#F8FAFC" : st.bg, borderBottom: `1px solid ${isDone ? "#E2E8F0" : st.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
                        <div style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 10, background: st.bg, border: `2px solid ${st.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 15, color: st.color }}>
                          {wt.vendor_id == null ? <Droplets size={16} /> : (wt.vendor_nama?.charAt(0) || "?")}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: 14, color: "#0F172A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {wt.vendor_id == null ? "Standby Pool Washing" : wt.vendor_nama}
                          </div>
                          <div style={{ fontSize: 11, color: "#64748B", display: "flex", gap: 4, alignItems: "center" }}>
                            <Clock size={11} />
                            {new Date(wt.tanggal_kirim).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                          </div>
                        </div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 20, background: st.bg, color: st.color, border: `1px solid ${st.border}`, whiteSpace: "nowrap" }}>
                        {st.label}
                      </span>
                    </div>

                    {/* Stats */}
                    <div style={{ padding: "12px 18px", borderBottom: "1px solid #F1F5F9" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                        <div style={{ background: "#F8FAFC", borderRadius: 10, padding: "8px 12px" }}>
                          <div style={{ fontSize: 9, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase" }}>PO / Model</div>
                          <div style={{ fontWeight: 900, fontSize: 14, color: "#0F172A" }}>{wt.noPo}</div>
                          <div style={{ fontSize: 11, color: "#64748B" }}>{wt.model}</div>
                        </div>
                        <div style={{ background: "#F0F9FF", borderRadius: 10, padding: "8px 12px" }}>
                          <div style={{ fontSize: 9, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase" }}>{wt.vendor_id == null ? "Siap Diambil" : "Total Dikirim"}</div>
                          <div style={{ fontWeight: 900, fontSize: 20, color: "#0891B2" }}>{wt.jumlah_kirim} pcs</div>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {(wt.sizeBreakdown || []).map((it: any, i: number) => (
                          <span key={i} style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: "#E0F2FE", color: "#0369A1", border: "1px solid #7DD3FC" }}>
                            {it.size}: {it.jumlah}
                          </span>
                        ))}
                      </div>

                      {/* Progres laporan vendor washing */}
                      {prog && !isDone && (
                        <div style={{ marginTop: 10 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, fontWeight: 700, color: "#64748B", marginBottom: 4 }}>
                            <span>Selesai di-ACC: <b style={{ color: "#059669" }}>{prog.approved}</b>{prog.pending > 0 && <> · Menunggu ACC: <b style={{ color: "#7C3AED" }}>{prog.pending}</b></>}</span>
                            <span>{progPct}%</span>
                          </div>
                          <div style={{ height: 6, borderRadius: 99, background: "#F1F5F9", overflow: "hidden", display: "flex" }}>
                            <div style={{ width: `${progPct}%`, background: "linear-gradient(90deg, #10B981, #059669)", transition: "width .4s ease" }} />
                            <div style={{ width: `${pendPct}%`, background: "#C4B5FD", transition: "width .4s ease" }} />
                          </div>
                        </div>
                      )}
                      {!isDone && (
                        <div style={{ marginTop: 8, fontSize: 11, color: st.color, fontWeight: 600 }}>{st.hint}</div>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: "auto", background: "#FAFAFA" }}>
                      <Link href="/alur-produksi" style={{ fontSize: 11, color: "#2563EB", fontWeight: 700, textDecoration: "underline" }}>
                        Alur Produksi →
                      </Link>
                      {st.key === "standby" ? (
                        <button onClick={() => setActiveTab("request")} style={{ background: "#FEF3C7", color: "#B45309", border: "1px solid #FCD34D", padding: "6px 12px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
                          Antrean Request →
                        </button>
                      ) : st.key === "acc" ? (
                        <button onClick={() => setActiveTab("laporan")} style={{ background: "#EDE9FE", color: "#6D28D9", border: "1px solid #C4B5FD", padding: "6px 12px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
                          Cek Laporan →
                        </button>
                      ) : canManualAcc ? (
                        <div style={{ display: "flex", gap: 6 }}>
                          {wt.status === "Kirim" && (
                            <button
                              onClick={async () => {
                                if (!confirm("Tolak pengiriman washing ini?")) return;
                                const res = await fetch("/api/produksi-transfer", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: wt.id, jumlah_diterima: 0, catatan_terima: "DITOLAK" }) });
                                if (res.ok) { toast.success("Pengiriman ditolak"); fetchAll(); } else { toast.error("Gagal menolak"); }
                              }}
                              style={{ background: "#FEE2E2", color: "#991B1B", border: "1px solid #FECACA", padding: "6px 12px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}
                            >
                              <X size={13} /> Tolak
                            </button>
                          )}
                          <button
                            onClick={async () => {
                              if (!confirm(`Tandai ${wt.jumlah_kirim} pcs sudah SELESAI CUCI oleh ${wt.vendor_nama}?`)) return;
                              const res = await fetch("/api/produksi-transfer", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: wt.id, jumlah_diterima: wt.jumlah_kirim, sizeBreakdown_diterima: wt.sizeBreakdown, catatan_terima: "ACC oleh Admin" }) });
                              if (res.ok) { toast.success("Washing ditandai selesai!"); fetchAll(); } else { toast.error("Gagal ACC"); }
                            }}
                            style={{ background: "linear-gradient(135deg, #0891B2, #0E7490)", color: "white", border: "none", padding: "6px 14px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 4, boxShadow: "0 3px 8px rgba(8,145,178,0.3)" }}
                          >
                            <CheckCheck size={13} /> ACC Selesai
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: st.key === "gudang" ? "#4338CA" : "#10B981", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                          <Check size={12} /> {st.key === "gudang" ? "Kembali ke Gudang" : "Sudah Diverifikasi"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── MODAL DETAIL REQUEST ────────────────────────────────────────────── */}
      {detailModal && (
        <div className="modal-overlay" onClick={() => setDetailModal(null)} style={{ zIndex: 1000 }}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h2 className="modal-title" style={{ margin: 0 }}>Detail Permohonan Request #{detailModal.id}</h2>
                <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
                  Diajukan pada {new Date(detailModal.createdAt).toLocaleString("id-ID")}
                </div>
              </div>
              <button onClick={() => setDetailModal(null)} style={{ border: "none", background: "#F1F5F9", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ background: "#F8FAFC", padding: 14, borderRadius: 12, border: "1px solid #E2E8F0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: "#64748B", fontWeight: 700 }}>Nama Vendor</div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: "#0F172A", marginTop: 2 }}>{detailModal.vendor_nama}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#64748B", fontWeight: 700 }}>Status Saat Ini</div>
                  <div style={{ marginTop: 2 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 10px", borderRadius: 20, background: STATUS_CONFIG[detailModal.status]?.badge || "#E2E8F0", color: STATUS_CONFIG[detailModal.status]?.badgeText || "#334155" }}>
                      {detailModal.status}
                    </span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#64748B", fontWeight: 700 }}>Total Diminta</div>
                  <div style={{ fontWeight: 900, fontSize: 16, color: "#0F172A", marginTop: 2 }}>{detailModal.total_request} pcs</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#64748B", fontWeight: 700 }}>Total Dipenuhi</div>
                  <div style={{ fontWeight: 900, fontSize: 16, color: "#10B981", marginTop: 2 }}>{detailModal.total_dipenuhi || 0} pcs</div>
                </div>
              </div>

              {detailModal.pemotongan && (
                <div style={{ background: "#F0FDF4", padding: 14, borderRadius: 12, border: "1px solid #BBF7D0" }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#166534", marginBottom: 6 }}>Bahan Kain Terkait:</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{detailModal.pemotongan.nama_barang}</div>
                  <div style={{ fontSize: 12, color: "#4B5563" }}>Model: {detailModal.pemotongan.model} · Sisa Siap: {detailModal.pemotongan.sisa_total} pcs</div>
                </div>
              )}

              {detailModal.catatan && (
                <div style={{ fontSize: 13, color: "#334155", background: "#F8FAFC", padding: 12, borderRadius: 10, border: "1px solid #E2E8F0" }}>
                  <strong>Catatan Vendor:</strong> {detailModal.catatan}
                </div>
              )}

              {detailModal.alasan_tolak && (
                <div style={{ fontSize: 13, color: "#991B1B", background: "#FEE2E2", padding: 12, borderRadius: 10, border: "1px solid #FECACA" }}>
                  <strong>Alasan Penolakan:</strong> {detailModal.alasan_tolak}
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ marginTop: 20, display: "flex", justifyContent: "space-between" }}>
              <a
                href={getVendorPortalUrl(detailModal.vendor_id, getVendorTipe(detailModal.vendor_id))}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
                style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}
              >
                <ExternalLink size={14} /> Buka Portal Vendor
              </a>
              <button className="btn btn-secondary" onClick={() => setDetailModal(null)}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL REJECT REQUEST ───────────────────────────────────────────── */}
      {rejectRequest && (
        <div className="modal-overlay" onClick={() => setRejectRequest(null)} style={{ zIndex: 1000 }}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h2 className="modal-title">Tolak Request Vendor</h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: 16, fontSize: 14 }}>
              Masukkan alasan penolakan untuk request sejumlah <strong>{rejectRequest.total_request} pcs</strong> dari <strong>{rejectRequest.vendor_nama}</strong>.
            </p>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!rejectReason.trim()) return toast.error("Alasan tolak wajib diisi.");
              try {
                const res = await fetch("/api/cmt-request", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id: rejectRequest.id, status: "Ditolak", alasan_tolak: rejectReason })
                });
                if (res.ok) {
                  toast.success("Request berhasil ditolak");
                  setRejectRequest(null);
                  fetchAll();
                }
              } catch (e) {
                console.error(e);
              }
            }}>
              <textarea 
                required
                className="form-control" 
                placeholder="Misal: Stok kain potongan sedang kosong / antrean mesin sedang penuh..." 
                rows={4}
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                style={{ width: "100%", borderRadius: 10, padding: 12, fontSize: 13 }}
              />
              <div className="modal-footer" style={{ marginTop: 20 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setRejectRequest(null)}>Batal</button>
                <button type="submit" className="btn" style={{ background: "#EF4444", color: "white", fontWeight: 700 }}>Tolak Permohonan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL DELETE REJECTED REQUEST ──────────────────────────────────── */}
      {deleteRequest && (
        <div className="modal-overlay" onClick={() => setDeleteRequest(null)} style={{ zIndex: 1000 }}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 440, borderRadius: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center", color: "#DC2626", flexShrink: 0 }}>
                <Trash2 size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: "#0F172A" }}>Hapus Permohonan Ditolak</h3>
                <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>Permohonan #{deleteRequest.id} · {deleteRequest.vendor_nama}</div>
              </div>
            </div>
            <p style={{ color: "#475569", marginBottom: 20, fontSize: 13, lineHeight: 1.5 }}>
              Apakah Anda yakin ingin menghapus permohonan <strong>{deleteRequest.total_request} pcs</strong> dari <strong>{deleteRequest.vendor_nama}</strong> yang sudah berstatus <em>Ditolak</em> ini? Data ini akan dihapus secara permanen dari antrean.
            </p>
            <div className="modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setDeleteRequest(null)}>Batal</button>
              <button
                type="button"
                className="btn"
                style={{ background: "#DC2626", color: "white", fontWeight: 700, display: "flex", alignItems: "center", gap: 6, boxShadow: "0 2px 8px rgba(220, 38, 38, 0.25)" }}
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/cmt-request?id=${deleteRequest.id}`, { method: "DELETE" });
                    const json = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(json.error || "Gagal menghapus permohonan");
                    toast.success("Permohonan berhasil dihapus!");
                    setDeleteRequest(null);
                    fetchAll();
                  } catch (err: any) {
                    toast.error(err.message || "Gagal menghapus permohonan");
                  }
                }}
              >
                <Trash2 size={14} /> Ya, Hapus Permohonan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── DOWNSTREAM MODAL (WASHING / FINISHING POOL) ─────────────────────── */}
      {downstreamModal && (
        <div className="modal-overlay" onClick={() => setDownstreamModal(null)} style={{ zIndex: 1000 }}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 900 }}>
              Kirimkan ke {downstreamModal.vendor_nama} (Pos Lanjutan)
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "#64748B", lineHeight: 1.5 }}>
              Permohonan: <strong>{downstreamModal.total_request} pcs</strong><br/>
              Dari PO: <strong>{downstreamModal.pemotongan?.nama_barang} ({downstreamModal.pemotongan?.model})</strong><br/>
              Sisa di Standby Pool: <strong>{downstreamModal.pemotongan?.sisa_total} pcs</strong>
            </p>
            <form onSubmit={handleDownstreamSubmit}>
              <div style={{ maxHeight: 260, overflowY: "auto", marginBottom: 16, border: "1px solid #E2E8F0", borderRadius: 10 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#F1F5F9", textAlign: "left", fontSize: 12 }}>
                      <th style={{ padding: 10 }}>Size</th>
                      <th style={{ padding: 10 }}>Tersedia</th>
                      <th style={{ padding: 10 }}>Kirim (Pcs)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {downstreamForm.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid #E2E8F0" }}>
                        <td style={{ padding: 10, fontWeight: "bold" }}>{item.size}</td>
                        <td style={{ padding: 10, color: "#64748B" }}>{item.max}</td>
                        <td style={{ padding: 10 }}>
                          <input 
                            type="number" 
                            min="0"
                            max={item.max}
                            value={item.jumlah}
                            onChange={(e) => {
                              const val = e.target.value;
                              const newF = [...downstreamForm];
                              newF[idx].jumlah = val === "" ? "" : Number(val);
                              setDownstreamForm(newF);
                            }}
                            style={{ width: 80, padding: 6, borderRadius: 6, border: "1px solid #CBD5E1", textAlign: "center", fontWeight: 700 }}
                            placeholder="0"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button type="button" onClick={() => setDownstreamModal(null)} className="btn btn-secondary">
                  Batal
                </button>
                <button type="submit" disabled={isSubmittingDownstream} className="btn btn-primary" style={{ fontWeight: 800 }}>
                  {isSubmittingDownstream ? "Memproses..." : "Kirimkan Barang ke Vendor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
