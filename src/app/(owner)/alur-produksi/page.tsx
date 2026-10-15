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
  Check
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
    catatan: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const doSync = async () => {
    setSyncing(true);
    try { 
      await fetch("/api/po-pipeline/sync", { method: "POST" }); 
    } catch {}
    setSyncing(false);
  };

  const fetchAll = async () => {
    setLoading(true);
    await doSync();
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
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchAll(); 
  }, []);

  const getPO = (id: number) => poProduksi.find(p => p.id === id);
  const getVendorName = (id?: number) => vendors.find(v => v.id === id)?.nama || "—";

  // Active Stage Object
  const activeStageObj = useMemo(() => {
    return stages.find(s => s.id === activeStage);
  }, [stages, activeStage]);

  // Distributions for a stage & PO
  const getActiveDistributions = (poId: number, stageSlug?: string) => {
    const sLower = (stageSlug || "").toLowerCase();
    const isJahitStage = sLower.includes("jahit") || sLower.includes("cmt");
    if (isJahitStage) {
      const po = getPO(poId);
      if (!po) return [];
      const records = cmtProgres.filter(p => p.po_id === poId);
      const lapor = records.reduce((s, r) => s + (r.items || []).reduce((ss: number, i: any) => ss + Number(i.jumlah || 0), 0), 0);
      const acc = records.filter(p => p.status === "Diverifikasi" || p.status === "Diterima")
                         .reduce((s, r) => s + (r.items || []).reduce((ss: number, i: any) => ss + Number(i.jumlah || 0), 0), 0);
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
    const forwarded = transfers.filter(t => t.po_id === poId && t.ke === stageObj.slug).reduce((s, t) => s + Number(t.jumlah_kirim), 0);
    return Math.max(0, po.jumlahTerbit - forwarded);
  };

  const posForStage = (stageId: number) =>
    poPipelines
      .filter(pip => pip.stages?.find((s: any) => s.stage_id === stageId && s.aktif))
      .map(pip => ({ ...pip, stageEntry: pip.stages.find((s: any) => s.stage_id === stageId) }));

  const countFor = (stageId: number, status: string) =>
    posForStage(stageId).filter(p => (p.stageEntry?.status || "Menunggu") === status).length;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const isOverdue = (t?: string) => t ? new Date(t) < today : false;
  const overdueDays = (t?: string) => {
    if (!t) return 0;
    const diff = today.getTime() - new Date(t).setHours(0,0,0,0);
    return Math.ceil(diff / (1000*60*60*24));
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

    setTransferModal({ po, currentStage });
    setTransferForm({
      ke_slug: nextSt?.slug || "",
      vendor_id: "",
      jumlah_kirim: String(po.jumlahTerbit || ""),
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
    <div style={{ padding: "28px 32px", background: "#F1F5F9", minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
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
              onClick={fetchAll}
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

            return (
              <div 
                key={po_id} 
                className="flow-card-hover"
                style={{ 
                  background: "white", 
                  borderRadius: 16, 
                  border: "1px solid #E2E8F0", 
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)", 
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column"
                }}
              >
                {/* Top Colored Indicator Bar */}
                <div style={{ height: 4, background: rawStatus === "Proses" ? (activeStageObj?.warna || "#2563EB") : rawStatus === "Selesai" ? "#10B981" : "#E2E8F0" }} />
                
                <div style={{ padding: "18px 20px", flex: 1, display: "flex", flexDirection: "column" }}>

                  {/* Card Header: No PO, Model & Status Badge */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginTop: 4 }}>
                        Model: {po.model} &bull; <span style={{ color: "#2563EB" }}>Total {po.jumlahTerbit.toLocaleString("id-ID")} pcs</span>
                      </div>
                    </div>

                    <button
                      onClick={() => setStatusModal({
                        po_id,
                        stage_id: activeStageObj.id,
                        stageName: activeStageObj.nama,
                        currentStatus: rawStatus,
                        noPo: po.noPo
                      })}
                      style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        gap: 5, 
                        padding: "4px 10px", 
                        borderRadius: 20, 
                        background: sc.bg, 
                        border: `1px solid ${sc.border}`,
                        cursor: "pointer"
                      }}
                      title="Klik untuk mengubah status pengerjaan"
                    >
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: sc.dot }} />
                      <span style={{ fontSize: 11, fontWeight: 800, color: sc.text }}>{sc.label}</span>
                      <Edit3 size={11} style={{ opacity: 0.6, marginLeft: 2 }} />
                    </button>
                  </div>

                  {/* Context: Initial Cutting Ready Info */}
                  {isInitialCutting && (
                    <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10, padding: "10px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: "#DCFCE7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Scissors size={15} color="#16A34A" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#166534" }}>
                          Kain Siap Diproses / Sudah Dipotong
                        </div>
                        <div style={{ fontSize: 11, color: "#475569" }}>
                          Total {po.jumlahTerbit} pcs siap didistribusikan ke CMT Penjahit.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tertandon Warning (Only for subsequent stages if pending) */}
                  {!isInitialCutting && tertandon > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#FEF2F2", borderRadius: 10, border: "1px solid #FECACA", marginBottom: 12 }}>
                      <AlertTriangle size={15} color="#DC2626" />
                      <span style={{ fontSize: 12, color: "#991B1B", fontWeight: 700 }}>
                        {tertandon} pcs masih menunggu ditransfer ke pos ini
                      </span>
                    </div>
                  )}

                  {/* Distributions / Vendor Processing Breakdown */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                    {dists.length === 0 ? (
                      <div style={{ fontSize: 12, color: "#64748B", textAlign: "center", padding: "14px 10px", background: "#F8FAFC", borderRadius: 10, border: "1px dashed #CBD5E1" }}>
                        Belum ada vendor / transfer di tahap ini.
                      </div>
                    ) : (
                      dists.map((d, i) => {
                        const overdue = isOverdue(d.target_selesai) && rawStatus !== "Selesai";
                        const days = overdueDays(d.target_selesai);
                        const pct = d.qty_total > 0 ? Math.round((d.qty_acc / d.qty_total) * 100) : 0;

                        return (
                          <div key={i} style={{ background: "#F8FAFC", border: overdue ? "1.5px solid #FECACA" : "1px solid #E2E8F0", borderRadius: 10, padding: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <User size={13} color="#64748B" />
                                <span style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>{d.vendor_nama}</span>
                              </div>
                              <div style={{ fontSize: 12, fontWeight: 900, color: activeStageObj?.warna || "#2563EB" }}>
                                {d.qty_total.toLocaleString("id-ID")} pcs
                              </div>
                            </div>
                            
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "#64748B" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 4, color: overdue ? "#DC2626" : "#64748B" }}>
                                <Calendar size={12} />
                                <span>{d.target_selesai ? new Date(d.target_selesai).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "Tanpa Dateline"}</span>
                                {overdue && <span style={{ fontWeight: 800, color: "#DC2626" }}>({days} hari lewat!)</span>}
                              </div>
                              <div style={{ fontWeight: 700, color: pct === 100 ? "#059669" : "#334155" }}>
                                {pct}% Selesai (ACC)
                              </div>
                            </div>

                            {/* Progress bar */}
                            <div style={{ height: 6, background: "#E2E8F0", borderRadius: 3, overflow: "hidden", marginTop: 8 }}>
                              <div style={{ width: pct + "%", height: "100%", background: pct === 100 ? "#10B981" : activeStageObj?.warna || "#2563EB", transition: "width 0.4s" }} />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Card Action Buttons */}
                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #F1F5F9", display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center" }}>
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
          <div style={{ background: "white", width: "100%", maxWidth: 540, borderRadius: 18, overflow: "hidden", boxShadow: "0 25px 60px rgba(0,0,0,0.3)", display: "flex", flexDirection: "column" }}>
            
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
            <form onSubmit={handleSubmitTransfer}>
              <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
                
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

                {/* Vendor Select */}
                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                    Pilih Vendor Mitra Penerima
                  </label>
                  <select
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #CBD5E1", fontSize: 13, outline: "none", background: "#FFFFFF", color: "#0F172A" }}
                    value={transferForm.vendor_id}
                    onChange={e => setTransferForm({ ...transferForm, vendor_id: e.target.value })}
                  >
                    <option value="">-- Pilih Vendor (Opsional / Internal) --</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>{v.nama} ({v.tipe || "Vendor"})</option>
                    ))}
                  </select>
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
          </div>
        </div>
      )}
    </div>
  );
}