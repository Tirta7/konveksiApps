"use client";
import React, { useEffect, useState, useRef, useMemo } from "react";
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
  Layers3
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

export default function BuatPOProduksi() {
  const [activeTab, setActiveTab] = useState<"request" | "manual" | "laporan" | "washing">("request");
  const _bgRefresh = useRef(false);
  
  // Data States
  const [allVendors, setAllVendors] = useState<any[]>([]);
  const [cmtVendors, setCmtVendors] = useState<any[]>([]);
  const [pemotonganList, setPemotonganList] = useState<any[]>([]);
  const [cmtRequests, setCmtRequests] = useState<any[]>([]);
  const [cmtProgres, setCmtProgres] = useState<any[]>([]);
  const [washingTransfers, setWashingTransfers] = useState<any[]>([]);
  const [poProduksi, setPoProduksi] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  
  // Request Processing & Modals
  const [processRequest, setProcessRequest] = useState<any>(null);
  const [rejectRequest, setRejectRequest] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState("");
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

    fetch("/api/produksi-transfer?ke=washing&_t=" + Date.now())
      .then(res => res.json())
      .then(data => setWashingTransfers(Array.isArray(data) ? data : []))
      .catch(() => {});

    fetch("/api/po-produksi?_t=" + Date.now())
      .then(res => res.json())
      .then(data => setPoProduksi(Array.isArray(data) ? data : []))
      .catch(() => {});
  };

  useEffect(() => { 
    fetchAll(); 
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
  const pendingWashingCount = washingTransfers.filter((r: any) => r.status === "Kirim").length;

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
         const data = await res.json();
         throw new Error(data.error || "Gagal menugaskan downstream");
      }
      toast.success("Berhasil menugaskan pekerjaan ke vendor!");
      setDownstreamModal(null);
      fetchAll();
    } catch(err: any) {
      toast.error(err.message);
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
              setActiveTab("request");
            }}
            style={{ background: "none", border: "none", color: "#64748B", fontSize: 13, fontWeight: 700, cursor: "pointer", marginTop: 8 }}
          >
            ← Kembali ke Antrean Request / Buat PO Baru
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "32px 32px 48px 32px", background: "var(--bg-app)", minHeight: "100%", overflowY: "auto", overflowX: "hidden" }}>
      
      {/* ─── PAGE HEADER ─────────────────────────────────────────────────── */}
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <h1 className="page-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
              Buat PO Produksi
            </h1>
            <span style={{ background: "linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)", color: "white", fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 800, letterSpacing: 0.5 }}>
              HUB SPK & ORDER
            </span>
          </div>
          <p className="page-subtitle" style={{ margin: 0 }}>
            Kelola request kain dari vendor CMT, alokasikan potongan kain, dan pantau verifikasi laporan progres.
          </p>
        </div>

        {/* QUICK SHORTCUT HUBS */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/pemotongan-kain" className="btn btn-secondary" style={{ background: "white", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <Scissors size={14} color="#059669" /> Stok Potongan ({totalSisaPotongan} pcs)
          </Link>
          <Link href="/daftar-spk" className="btn btn-secondary" style={{ background: "white", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <FileText size={14} color="#2563EB" /> Daftar PO / SPK
          </Link>
          <Link href="/dashboard-cmt" className="btn btn-secondary" style={{ background: "white", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <Activity size={14} color="#7C3AED" /> Dashboard CMT
          </Link>
          <Link href="/alur-produksi" className="btn btn-secondary" style={{ background: "white", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <Zap size={14} color="#D97706" /> Alur Produksi
          </Link>
        </div>
      </div>

      {/* ─── STAT KPI SUMMARY CARDS ─────────────────────────────────────────── */}
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        {/* Card 1 */}
        <div className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span className="stat-label">Total Antrean Request</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#EFF6FF", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Inbox size={18} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#0F172A", lineHeight: 1 }}>{cmtRequests.length}</div>
            <span style={{ fontSize: 12, color: "#64748B" }}>permohonan</span>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            {pendingRequestCount > 0 ? (
              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#FEE2E2", color: "#DC2626" }}>
                {pendingRequestCount} butuh tindakan
              </span>
            ) : (
              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#D1FAE5", color: "#059669" }}>
                Semua terlayani
              </span>
            )}
          </div>
        </div>

        {/* Card 2 */}
        <div className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span className="stat-label">Volume Diminta Vendor</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#F0FDF4", color: "#16A34A", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Sparkles size={18} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#0F172A", lineHeight: 1 }}>{totalDimintaPcs.toLocaleString()}</div>
            <span style={{ fontSize: 12, color: "#64748B" }}>pcs</span>
          </div>
          <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>
            Terpenuhi: <strong style={{ color: "#10B981" }}>{totalDipenuhiPcs.toLocaleString()} pcs</strong> ({totalDimintaPcs > 0 ? Math.round((totalDipenuhiPcs / totalDimintaPcs) * 100) : 0}%)
          </div>
        </div>

        {/* Card 3 */}
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

        {/* Card 4 */}
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
              <span style={{ color: "#D97706", fontWeight: 700 }}>{pendingCmtLaporCount} laporan menanti ACC</span>
            ) : (
              <span>Tracking berjalan optimal</span>
            )}
          </div>
        </div>
      </div>

      {/* ─── MAIN SEGMENTED NAVIGATION TABS ─────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 6, background: "white", padding: 6, borderRadius: 14, border: "1px solid var(--border-color)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", width: "fit-content" }}>
          {[
            { key: "request", label: "Antrean Request Vendor", icon: Inbox, badge: pendingRequestCount, badgeColor: "#EF4444" },
            { key: "manual",  label: "Buat SPK Manual",        icon: Plus,  badge: 0, badgeColor: "" },
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
                  padding: "9px 18px",
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
                  boxShadow: isActive ? "0 4px 12px rgba(15,23,42,0.15)" : "none"
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
      </div>

      {/* ─── BANNER NOTIFIKASI AUTO-FILL DARI REQUEST ────────────────────────── */}
      {activeTab === "manual" && processRequest && (
        <div style={{ background: "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)", border: "1.5px solid #3B82F6", borderRadius: 16, padding: "16px 22px", marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, boxShadow: "0 4px 14px rgba(37,99,235,0.1)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ background: "#2563EB", color: "white", width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0, boxShadow: "0 4px 10px rgba(37,99,235,0.3)" }}>
              <Zap size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 800, color: "#1D4ED8", fontSize: 15 }}>
                Sedang Memproses Request #{processRequest.id} dari {processRequest.vendor_nama}
              </div>
              <div style={{ fontSize: 13, color: "#1E40AF", marginTop: 2 }}>
                Target: <strong>{processRequest.total_request} pcs</strong> · Size breakdown otomatis diisi merata. Silakan periksa atau ubah sebelum diterbitkan.
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button
              onClick={() => {
                if (selectedPemotongan) {
                  setSizeBreakdown(distributeEvenly(selectedPemotongan, Number(processRequest.total_request)));
                  toast.success("Breakdown diratakan ulang sesuai sisa stok");
                }
              }}
              style={{ background: "#2563EB", color: "white", border: "none", padding: "8px 14px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
            >
              <RefreshCw size={13} /> Rata Ulang
            </button>
            <button
              onClick={() => { setProcessRequest(null); toast.info("Mode auto-fill dibatalkan"); }}
              style={{ background: "white", color: "#64748B", border: "1px solid #CBD5E1", padding: "8px 12px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 13 }}
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
        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 40 }}>
          
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
                                  href={`/daftar-spk?search=${encodeURIComponent(matchedPo.noPo)}`}
                                  style={{ color: "#2563EB", fontWeight: 800, textDecoration: "underline", fontSize: 10 }}
                                >
                                  Buka PO →
                                </Link>
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
                            <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", background: "#FAFAFA", borderTop: "1px solid #F1F5F9", flexWrap: "wrap", gap: 8 }}>
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
                                <button
                                  onClick={() => setDetailModal(r)}
                                  style={{ background: "none", border: "none", color: "#2563EB", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}
                                >
                                  <Eye size={12} /> Detail
                                </button>
                              </div>

                              {/* CONDITIONAL ACTION BUTTONS BASED ON STATUS */}
                              {isPending ? (
                                <div style={{ display: "flex", gap: 6 }}>
                                  <button
                                    onClick={() => { setRejectRequest(r); setRejectReason(""); }}
                                    style={{ background: "#FEE2E2", color: "#991B1B", border: "1px solid #FECACA", padding: "6px 12px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}
                                  >
                                    <X size={13} /> Tolak
                                  </button>
                                  <button
                                    onClick={() => {
                                      // If it is a downstream transfer (Washing/Finishing)
                                      if (r.pemotongan?.is_transfer) {
                                        setDownstreamModal(r);
                                        const breakdown = r.pemotongan.sizeBreakdown || [];
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
                                        return;
                                      }

                                      // For standard CMT PO creation
                                      const targetQty = Number(r.total_request);
                                      let bestPemo = pemotonganList[0];
                                      if (pemotonganList.length > 1) {
                                        bestPemo = pemotonganList.reduce((best: any, p: any) => {
                                          const ts = p.sizeBreakdown.reduce((s: number, x: any) => s + (x.sisa || 0), 0);
                                          const bs = best.sizeBreakdown.reduce((s: number, x: any) => s + (x.sisa || 0), 0);
                                          return ts > bs ? p : best;
                                        });
                                      }
                                      // Prefer pemotongan yang diminta CMT
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
                                    style={{ background: "linear-gradient(135deg, #2563EB, #1D4ED8)", color: "white", border: "none", padding: "6px 14px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 5, boxShadow: "0 3px 8px rgba(37,99,235,0.3)" }}
                                  >
                                    <CheckCheck size={14} /> Proses Buat PO
                                  </button>
                                </div>
                              ) : isDitolak ? (
                                <div style={{ display: "flex", gap: 6 }}>
                                  <button
                                    onClick={() => handleReopenRequest(r)}
                                    style={{ background: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE", padding: "5px 12px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}
                                  >
                                    <RotateCcw size={12} /> Buka Kembali
                                  </button>
                                </div>
                              ) : (
                                /* Status Selesai / Terpenuhi */
                                <div style={{ display: "flex", gap: 6 }}>
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
          TAB 2: FORM BUAT SPK MANUAL
         ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "manual" && (
        <div style={{ maxWidth: 940, margin: "0 auto", marginBottom: 40 }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            
            {/* LANGKAH 1: SUMBER POTONGAN & VENDOR CMT */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{ background: "#EFF6FF", border: "1.5px solid #93C5FD", borderRadius: 12, padding: "8px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                  <Scissors size={18} color="#2563EB" />
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 14, color: "#2563EB" }}>Langkah 1: Sumber Bahan & Vendor CMT</div>
                    <div style={{ fontSize: 11, color: "#64748B" }}>Pilih stok hasil potong dari Tukang Potong & tujuan CMT</div>
                  </div>
                </div>
                <div style={{ flex: 1, height: 1.5, background: "linear-gradient(to right, #93C5FD, transparent)" }} />
              </div>

              <div style={{ background: "white", borderRadius: 16, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", border: "1px solid #E2E8F0" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                  
                  {/* Select Pemotongan */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <label style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>
                        Ambil Dari Stok Potongan <span style={{ color: "#EF4444" }}>*</span>
                      </label>
                      <Link href="/pemotongan-kain" style={{ fontSize: 11, color: "#2563EB", fontWeight: 700, textDecoration: "underline" }}>
                        + Catat Baru
                      </Link>
                    </div>
                    <select
                      required
                      style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "2px solid #E2E8F0", fontSize: 14, fontWeight: 600, color: "#0F172A", background: "#F8FAFC", outline: "none", cursor: "pointer" }}
                      value={form.pemotonganId}
                      onChange={e => handlePemotonganChange(e.target.value)}
                    >
                      <option value="">-- Pilih Stok Hasil Potong Siap Jahit --</option>
                      {pemotonganList.map(p => {
                        const totalSisa = (p.sizeBreakdown || []).reduce((sum: number, s: any) => sum + (s.sisa || 0), 0);
                        return (
                          <option key={p.id} value={p.id}>
                            {p.tukang_potong_nama} ({p.tukang_potong_kode}) - Model: {p.model} - Sisa: {totalSisa} pcs
                          </option>
                        );
                      })}
                    </select>

                    {/* Preview Selected Pemotongan */}
                    {selectedPemotongan ? (
                      <div style={{ marginTop: 10, padding: 12, background: "#F0FDF4", borderRadius: 10, border: "1px solid #BBF7D0", fontSize: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontWeight: 800, color: "#166534" }}>Kain: {selectedPemotongan.nama_barang}</span>
                          <span style={{ background: "#DCFCE7", color: "#166534", padding: "2px 8px", borderRadius: 6, fontWeight: 800 }}>
                            Sisa: {(selectedPemotongan.sizeBreakdown || []).reduce((s:number, x:any)=>s+(x.sisa||0),0)} pcs
                          </span>
                        </div>
                        <div style={{ color: "#4B5563", marginTop: 4 }}>
                          Model: <strong>{selectedPemotongan.model}</strong> · Tukang Potong: <strong>{selectedPemotongan.tukang_potong_nama} ({selectedPemotongan.tukang_potong_kode})</strong>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 11, color: "#64748B", marginTop: 6 }}>
                        Pilih stok potongan yang memiliki sisa kuantitas untuk dijahit ke vendor.
                      </div>
                    )}
                  </div>

                  {/* Select CMT Vendor */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <label style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>
                        Vendor / CMT Penjahit Tujuan <span style={{ color: "#EF4444" }}>*</span>
                      </label>
                      <Link href="/atur-vendor" style={{ fontSize: 11, color: "#2563EB", fontWeight: 700, textDecoration: "underline" }}>
                        Atur Vendor
                      </Link>
                    </div>
                    <select
                      required
                      style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "2px solid #E2E8F0", fontSize: 14, fontWeight: 600, color: "#0F172A", background: "#F8FAFC", outline: "none", cursor: "pointer" }}
                      value={form.vendorId}
                      onChange={e => setForm({ ...form, vendorId: e.target.value })}
                    >
                      <option value="">-- Pilih Vendor CMT --</option>
                      {cmtVendors.map(v => (
                        <option key={v.id} value={v.id}>
                          {v.nama} {v.jenis_default ? `(${v.jenis_default})` : ""} {v.kontak ? `· ${v.kontak}` : ""}
                        </option>
                      ))}
                    </select>

                    {selectedVendor ? (
                      <div style={{ marginTop: 10, padding: 12, background: "#EFF6FF", borderRadius: 10, border: "1px solid #BFDBFE", fontSize: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontWeight: 800, color: "#1D4ED8" }}>{selectedVendor.nama}</span>
                          <span style={{ color: "#2563EB", fontWeight: 700 }}>Kode: {selectedVendor.kodeVendor || `V-${selectedVendor.id}`}</span>
                        </div>
                        <div style={{ color: "#4B5563", marginTop: 4 }}>
                          Kontak: <strong>{selectedVendor.kontak || "—"}</strong> · Tarif Default: <strong>Rp {(selectedVendor.hargaPerPcs || 0).toLocaleString()}</strong>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 11, color: "#64748B", marginTop: 6 }}>
                        Vendor penjahit yang akan menerima amanah pengerjaan SPK ini.
                      </div>
                    )}
                  </div>
                </div>

                {/* Catatan & Target Selesai */}
                <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, marginTop: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                      Catatan / Instruksi Jahitan Khusus (Opsional)
                    </label>
                    <input
                      type="text"
                      placeholder="Misal: Jahit pakai benang emas jeans, jarak 8 SPI..."
                      style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "2px solid #E2E8F0", fontSize: 13, color: "#0F172A", background: "#F8FAFC", outline: "none" }}
                      value={form.catatan}
                      onChange={e => setForm({ ...form, catatan: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                      Target Selesai Jahit
                    </label>
                    <input
                      type="date"
                      style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "2px solid #E2E8F0", fontSize: 13, color: "#0F172A", background: "#F8FAFC", outline: "none" }}
                      value={form.target_selesai}
                      onChange={e => setForm({ ...form, target_selesai: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* LANGKAH 2: BREAKDOWN UKURAN */}
            <div style={{ opacity: selectedPemotongan ? 1 : 0.6, pointerEvents: selectedPemotongan ? "auto" : "none", transition: "all 0.3s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{ background: "#ECFDF5", border: "1.5px solid #6EE7B7", borderRadius: 12, padding: "8px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                  <Layers3 size={18} color="#059669" />
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 14, color: "#059669" }}>Langkah 2: Alokasi & Breakdown Ukuran</div>
                    <div style={{ fontSize: 11, color: "#64748B" }}>Tentukan kuantitas potong yang diserahkan untuk masing-masing size</div>
                  </div>
                </div>
                <div style={{ flex: 1, height: 1.5, background: "linear-gradient(to right, #6EE7B7, transparent)" }} />
                
                {/* PRESETS BUTTONS */}
                {selectedPemotongan && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => {
                        const allSisa = selectedPemotongan.sizeBreakdown.map((s:any) => ({ size: s.size, jumlah: s.sisa, maxSisa: s.sisa }));
                        setSizeBreakdown(allSisa);
                        toast.success("Diisi penuh sesuai sisa stok");
                      }}
                      style={{ background: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE", padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                    >
                      Penuhi Semua Sisa
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSizeBreakdown(selectedPemotongan.sizeBreakdown.map((s:any) => ({ size: s.size, jumlah: 0, maxSisa: s.sisa })));
                      }}
                      style={{ background: "#F1F5F9", color: "#64748B", border: "1px solid #E2E8F0", padding: "6px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                    >
                      Reset 0
                    </button>
                  </div>
                )}

                <div style={{ background: totalPcs > 0 ? "#10B981" : "#F1F5F9", color: totalPcs > 0 ? "white" : "#64748B", padding: "7px 16px", borderRadius: 20, fontWeight: 800, fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}>
                  Total Alokasi: <span style={{ fontWeight: 900, fontSize: 15 }}>{totalPcs} pcs</span>
                </div>
              </div>

              <div style={{ background: "white", borderRadius: 16, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", border: "1px solid #E2E8F0" }}>
                {!selectedPemotongan ? (
                  <div style={{ textAlign: "center", padding: 30, color: "#64748B" }}>
                    <AlertCircle size={32} style={{ color: "#CBD5E1", margin: "0 auto 8px" }} />
                    <div style={{ fontWeight: 700, fontSize: 14 }}>Pilih Stok Potongan di Langkah 1 Terlebih Dahulu</div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16 }}>
                    {sizeBreakdown.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          border: item.jumlah > 0 ? "2px solid #3B82F6" : "2px solid #F1F5F9",
                          borderRadius: 14,
                          padding: "16px 14px",
                          background: item.jumlah > 0 ? "#EFF6FF" : "#FFFFFF",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 10,
                          transition: "all 0.2s"
                        }}
                      >
                        <div style={{ background: item.jumlah > 0 ? "#3B82F6" : "#F8FAFC", color: item.jumlah > 0 ? "white" : "#334155", width: 48, height: 48, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 18, border: item.jumlah > 0 ? "none" : "1px solid #E2E8F0" }}>
                          {item.size}
                        </div>
                        <div style={{ fontSize: 11, color: item.jumlah > 0 ? "#1D4ED8" : "#64748B", fontWeight: 700 }}>
                          Sisa Siap: <strong>{item.maxSisa} pcs</strong>
                        </div>
                        <input
                          type="number"
                          min="0"
                          max={item.maxSisa}
                          style={{ textAlign: "center", padding: "8px 10px", width: "100%", borderRadius: 8, border: item.jumlah > 0 ? "1px solid #93C5FD" : "1px solid #CBD5E1", fontSize: 15, fontWeight: 800, color: "#0F172A", outline: "none" }}
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

            {/* SUBMIT BUTTON */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <button
                type="button"
                onClick={() => { setActiveTab("request"); }}
                className="btn btn-secondary"
                style={{ background: "white" }}
              >
                ← Kembali ke Antrean Request
              </button>

              <button
                type="submit"
                disabled={loading || totalPcs === 0 || !selectedPemotongan}
                style={{
                  padding: "14px 32px",
                  fontSize: 15,
                  fontWeight: 800,
                  background: (loading || totalPcs === 0 || !selectedPemotongan) ? "#94A3B8" : "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
                  color: "white",
                  borderRadius: 12,
                  border: "none",
                  cursor: (loading || totalPcs === 0 || !selectedPemotongan) ? "not-allowed" : "pointer",
                  boxShadow: (loading || totalPcs === 0 || !selectedPemotongan) ? "none" : "0 8px 20px rgba(37, 99, 235, 0.35)",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  transition: "all 0.2s"
                }}
              >
                {loading ? "Memproses Pembuatan PO..." : `Terbitkan PO (${totalPcs} pcs) & Barcode`} <ChevronRight size={18} />
              </button>
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
                          <div style={{ fontSize: 11, color: "#64748B", display: "flex", gap: 4, alignItems: "center" }}>
                            <Clock size={11} />
                            {new Date(lp.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                          </div>
                        </div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 20, background: isPending ? "#FEF3C7" : "#D1FAE5", color: isPending ? "#92400E" : "#065F46", border: `1px solid ${isPending ? "#FCD34D" : "#6EE7B7"}` }}>
                        {isPending ? "Menunggu ACC" : lp.status}
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
                          <div style={{ fontSize: 9, fontWeight: 800, color: "#16A34A", textTransform: "uppercase" }}>Total Selesai Jahit</div>
                          <div style={{ fontSize: 18, fontWeight: 900, color: "#10B981" }}>{lp.totalJumlah} pcs</div>
                          <div style={{ fontSize: 10, color: "#64748B" }}>dari target {lp.targetJumlah} pcs</div>
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
          {washingTransfers.length === 0 ? (
            <div style={{ background: "white", borderRadius: 18, padding: 60, textAlign: "center", border: "1px solid #E2E8F0" }}>
              <Droplets size={44} style={{ color: "#A5F3FC", margin: "0 auto 14px" }} />
              <div style={{ fontSize: 16, fontWeight: 700, color: "#64748B" }}>Belum ada laporan dari Vendor Washing</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
              {washingTransfers.map((wt: any) => {
                const isPending = wt.status === "Kirim";
                return (
                  <div key={wt.id} style={{ background: "white", borderRadius: 16, border: `1px solid ${isPending ? "#A5F3FC" : "#E2E8F0"}`, boxShadow: isPending ? "0 4px 14px rgba(6,182,212,0.12)" : "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                    
                    {/* Header */}
                    <div style={{ padding: "14px 18px", background: isPending ? "#ECFEFF" : "#F8FAFC", borderBottom: `1px solid ${isPending ? "#A5F3FC" : "#E2E8F0"}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: isPending ? "#E0F2FE" : "#D1FAE5", border: `2px solid ${isPending ? "#7DD3FC" : "#6EE7B7"}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 15, color: isPending ? "#0369A1" : "#065F46" }}>
                          {wt.vendor_nama?.charAt(0) || "?"}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 14, color: "#0F172A" }}>{wt.vendor_nama}</div>
                          <div style={{ fontSize: 11, color: "#64748B", display: "flex", gap: 4, alignItems: "center" }}>
                            <Clock size={11} />
                            {new Date(wt.tanggal_kirim).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                          </div>
                        </div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 20, background: isPending ? "#E0F2FE" : "#D1FAE5", color: isPending ? "#0369A1" : "#065F46", border: `1px solid ${isPending ? "#7DD3FC" : "#6EE7B7"}` }}>
                        {isPending ? "Dalam Proses Cuci" : "Selesai Cuci"}
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
                          <div style={{ fontSize: 9, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase" }}>Total Dikirim</div>
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
                    </div>

                    {/* Actions */}
                    <div style={{ padding: "12px 16px", display: "flex", justifyContent: isPending ? "flex-end" : "space-between", alignItems: "center", marginTop: "auto", background: "#FAFAFA" }}>
                      {!isPending && (
                        <Link href="/alur-produksi" style={{ fontSize: 11, color: "#2563EB", fontWeight: 700, textDecoration: "underline" }}>
                          Alur Produksi →
                        </Link>
                      )}
                      {isPending ? (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            onClick={async () => {
                              if (!confirm("Tolak laporan washing ini?")) return;
                              const res = await fetch("/api/produksi-transfer", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: wt.id, jumlah_diterima: 0, catatan_terima: "DITOLAK" }) });
                              if (res.ok) { toast.success("Laporan ditolak"); fetchAll(); } else { toast.error("Gagal menolak"); }
                            }}
                            style={{ background: "#FEE2E2", color: "#991B1B", border: "1px solid #FECACA", padding: "6px 12px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}
                          >
                            <X size={13} /> Tolak
                          </button>
                          <button
                            onClick={async () => {
                              const res = await fetch("/api/produksi-transfer", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: wt.id, jumlah_diterima: wt.jumlah_kirim, sizeBreakdown_diterima: wt.sizeBreakdown, catatan_terima: "ACC oleh Admin" }) });
                              if (res.ok) { toast.success("Laporan Washing di-ACC!"); fetchAll(); } else { toast.error("Gagal ACC"); }
                            }}
                            style={{ background: "linear-gradient(135deg, #0891B2, #0E7490)", color: "white", border: "none", padding: "6px 14px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 4, boxShadow: "0 3px 8px rgba(8,145,178,0.3)" }}
                          >
                            <CheckCheck size={13} /> ACC Selesai
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: "#10B981", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                          <Check size={12} /> Sudah Diverifikasi
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

      {/* ─── DOWNSTREAM MODAL (WASHING / FINISHING POOL) ─────────────────────── */}
      {downstreamModal && (
        <div className="modal-overlay" onClick={() => setDownstreamModal(null)} style={{ zIndex: 1000 }}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 900 }}>
              ACC Penugasan {downstreamModal.vendor_nama}
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
                      <th style={{ padding: 10 }}>ACC (Pcs)</th>
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
                  {isSubmittingDownstream ? "Memproses..." : "Tugaskan ke Vendor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
