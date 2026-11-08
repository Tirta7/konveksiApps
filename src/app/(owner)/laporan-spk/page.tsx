"use client";
import React, { useEffect, useState, useMemo } from "react";
import {
  Users,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Package,
  Printer,
  Search,
  DollarSign,
  ExternalLink,
  MessageCircle,
  FileText,
  Activity,
  Layers,
  X,
  CreditCard,
  Building2,
  Trash2,
  Sparkles,
  Receipt,
  AlertCircle,
  Wallet
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

function formatRp(num: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num || 0);
}

const RANK_BADGES = [
  { bg: "#FEF3C7", color: "#92400E", border: "#FCD34D", label: "Juara 1" },
  { bg: "#F1F5F9", color: "#475569", border: "#CBD5E1", label: "Juara 2" },
  { bg: "#FFEDD5", color: "#9A3412", border: "#FDBA74", label: "Juara 3" },
];

function getPortalUrl(v: any) {
  const t = String(v?.tipe || "cmt").toLowerCase();
  if (t === "washing") return `/washing/${v.id}`;
  if (t === "finishing") return `/finishing/${v.id}`;
  if (t === "bersih_benang") return `/bersih-benang/${v.id}`;
  return `/cmt/${v.id}`;
}

export default function LaporanProduksiPage() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [summaries, setSummaries] = useState<any[]>([]);
  const [gajiCmt, setGajiCmt] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [tipeFilter, setTipeFilter] = useState<"semua" | "cmt" | "lanjutan">("cmt");
  const [statusFilter, setStatusFilter] = useState<"semua" | "aktif" | "belum_lunas" | "lunas">("semua");
  const [sortBy, setSortBy] = useState<"pcs" | "gaji" | "sisa" | "nama">("pcs");

  // Modal Pembayaran Gaji
  const [showBayarModal, setShowBayarModal] = useState(false);
  const [bayarForm, setBayarForm] = useState({
    cmtId: "",
    poId: "",
    noPo: "",
    model: "",
    jumlahPcs: "",
    totalGaji: "",
    metode: "Transfer Bank",
    catatan: "",
    status: "Lunas",
    tanggal: new Date().toISOString().split("T")[0]
  });
  const [isSubmittingBayar, setIsSubmittingBayar] = useState(false);

  // Modal Cetak Slip Gaji / Bukti Pembayaran
  const [slipModalData, setSlipModalData] = useState<{ vendor: any; payment?: any } | null>(null);

  const fetchData = async () => {
    try {
      const [resV, resG] = await Promise.all([
        fetch("/api/vendors?_t=" + Date.now()).then(r => r.json()),
        fetch("/api/gaji-cmt?includeRealtime=true&_t=" + Date.now()).then(r => r.json()),
      ]);

      const vList = Array.isArray(resV) ? resV : [];
      setVendors(vList);

      if (resG && Array.isArray(resG.summaries)) {
        setSummaries(resG.summaries);
        setGajiCmt(Array.isArray(resG.official) ? resG.official : []);
      } else if (Array.isArray(resG)) {
        setGajiCmt(resG);
      }
    } catch (e) {
      console.error(e);
      toast.error("Gagal memuat data laporan upah & SPK");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => { if (!document.hidden) fetchData(); }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Real-time sync: refresh data when another admin or vendor makes changes
  useEffect(() => {
    const handler = () => fetchData();
    window.addEventListener("konveksi-sync", handler);
    return () => window.removeEventListener("konveksi-sync", handler);
  }, []);

  // Calculate detailed stats per vendor from unified server summaries
  const { stats, vendorStats } = useMemo(() => {
    let totalPcsAll = 0;
    let totalEstimasiGajiAll = 0;
    let totalGajiDibayarAll = 0;
    let totalSisaGajiAll = 0;
    let topVendor = { nama: "-", pcs: 0, gaji: 0 };

    const filteredVendorsByTipe = vendors.filter(v => {
      const isCmt = v.tipe === "cmt" || v.tipe === "jahit";
      if (tipeFilter === "cmt") return isCmt;
      if (tipeFilter === "lanjutan") return !isCmt;
      return true;
    });

    const computed = filteredVendorsByTipe.map(v => {
      const summary = summaries.find((s: any) => Number(s.vendorId) === Number(v.id));
      const gajiRecords = summary?.officialSlips || gajiCmt.filter(g => Number(g.cmtId) === Number(v.id));
      const categoryBreakdown: Record<string, { pcs: number; gaji: number; tarif: number }> = summary?.categoryBreakdown || {};
      const poBreakdown = (summary?.rincianGajiPerPo || []).map((r: any) => ({
        poId: r.poId,
        jobId: r.jobId,
        noPo: r.noPo,
        model: r.model,
        targetPcs: r.targetPcs,
        pcsSelesai: r.pcsSelesai,
        pcsPending: r.pcsPending,
        tarif: r.tarifPerPcs,
        subtotal: r.subtotalHak,
        dibayar: r.dibayar,
        sisaHak: r.sisaHak,
        statusBayar: r.statusBayar,
        isDone: r.isDone,
      }));

      const totalPcsVendor = Number(summary?.totalPcsSelesai || 0);
      const totalEstimasiGaji = Number(summary?.totalHakGaji || 0);
      const totalGajiDibayar = Number(summary?.totalSudahDibayar || 0);
      const sisaBelumDibayar = Number(summary?.sisaHakGaji || 0);
      const statusPembayaran = summary?.statusPembayaran || (totalEstimasiGaji === 0 ? "Belum Ada Tagihan" : sisaBelumDibayar === 0 ? "Lunas" : totalGajiDibayar > 0 ? "Sebagian Dibayar" : "Belum Dibayar");

      totalPcsAll += totalPcsVendor;
      totalEstimasiGajiAll += totalEstimasiGaji;
      totalGajiDibayarAll += totalGajiDibayar;
      totalSisaGajiAll += sisaBelumDibayar;

      if (totalPcsVendor > topVendor.pcs) {
        topVendor = { nama: v.nama, pcs: totalPcsVendor, gaji: totalEstimasiGaji };
      }

      return {
        ...v,
        totalPcs: totalPcsVendor,
        totalPcsPending: Number(summary?.totalPcsPending || 0),
        estimasiGaji: totalEstimasiGaji,
        gajiDibayar: totalGajiDibayar,
        sisaGaji: sisaBelumDibayar,
        statusPembayaran,
        hasKhusus: v.tarifPotongan && Object.keys(v.tarifPotongan).length > 0,
        categoryBreakdown,
        poBreakdown,
        gajiRecords
      };
    });

    return {
      stats: {
        totalPcsAll,
        totalEstimasiGajiAll,
        totalGajiDibayarAll,
        sisaGajiAll: totalSisaGajiAll,
        topVendor,
        totalCmtActive: filteredVendorsByTipe.length,
        totalBelumLunasCount: computed.filter(c => c.sisaGaji > 0).length,
      },
      vendorStats: computed
    };
  }, [vendors, summaries, gajiCmt, tipeFilter]);

  // Open Bayar Modal for specific vendor (and optional PO)
  const openBayarForVendor = (v: any, poItem?: any) => {
    const defaultNominal = poItem
      ? (poItem.sisaHak > 0 ? poItem.sisaHak : poItem.subtotal)
      : (v.sisaGaji > 0 ? v.sisaGaji : v.estimasiGaji);
    const defaultPcs = poItem
      ? poItem.pcsSelesai
      : v.totalPcs;

    setBayarForm({
      cmtId: String(v.id),
      poId: poItem ? String(poItem.poId) : "",
      noPo: poItem ? String(poItem.noPo || "") : "",
      model: poItem ? String(poItem.model || "") : "",
      jumlahPcs: defaultPcs > 0 ? String(defaultPcs) : "",
      totalGaji: defaultNominal > 0 ? String(defaultNominal) : "",
      metode: "Transfer Bank",
      catatan: poItem
        ? `Pelunasan upah SPK ${poItem.noPo} (${poItem.model}) - ${v.nama}`
        : `Pembayaran upah ${v.tipe === "washing" ? "washing" : "jahit"} untuk ${v.nama}`,
      status: "Lunas",
      tanggal: new Date().toISOString().split("T")[0]
    });
    setShowBayarModal(true);
  };

  // Submit Pembayaran Gaji
  const handleSubmitBayar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bayarForm.cmtId || !bayarForm.totalGaji) {
      return toast.error("Harap pilih Mitra Vendor dan isi Nominal Gaji.");
    }

    setIsSubmittingBayar(true);
    try {
      const res = await fetch("/api/gaji-cmt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bayarForm)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal mencatat pembayaran");
      }
      const created = await res.json();
      toast.success(
        `Pembayaran gaji ${formatRp(Number(bayarForm.totalGaji))} berhasil dicatat! Status portal mitra & dashboard telah diperbarui.`
      );
      setShowBayarModal(false);
      await fetchData();
      // Auto-expand the paid vendor so the user immediately sees the updated status & receipt
      if (bayarForm.cmtId) {
        setExpandedId(Number(bayarForm.cmtId));
      }
      return created;
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmittingBayar(false);
    }
  };

  // Delete / Batal Riwayat Pembayaran Gaji
  const handleDeleteGaji = async (gajiId: number) => {
    if (!confirm("Hapus catatan pembayaran upah ini? Status tagihan di Portal CMT dan Buku Hutang akan disesuaikan kembali.")) return;
    try {
      const res = await fetch(`/api/gaji-cmt?id=${gajiId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Catatan pembayaran gaji dihapus & saldo tagihan diperbarui");
        fetchData();
      } else {
        toast.error("Gagal menghapus");
      }
    } catch {
      toast.error("Terjadi kesalahan sistem");
    }
  };

  // Filter & Search
  const filteredVendorStats = useMemo(() => {
    return vendorStats.filter(v => {
      if (statusFilter === "aktif" && v.totalPcs === 0) return false;
      if (statusFilter === "belum_lunas" && v.sisaGaji <= 0) return false;
      if (statusFilter === "lunas" && (v.estimasiGaji === 0 || v.sisaGaji > 0)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNama = (v.nama || "").toLowerCase().includes(q);
        const matchKode = (v.kodeVendor || "").toLowerCase().includes(q);
        const matchKontak = (v.kontak || "").toLowerCase().includes(q);
        const matchModel = Object.keys(v.categoryBreakdown).some(k => k.toLowerCase().includes(q));
        const matchPo = (v.poBreakdown || []).some((p: any) => String(p.noPo || "").toLowerCase().includes(q));
        if (!matchNama && !matchKode && !matchKontak && !matchModel && !matchPo) return false;
      }
      return true;
    }).sort((a, b) => {
      if (sortBy === "gaji") return b.estimasiGaji - a.estimasiGaji;
      if (sortBy === "sisa") return b.sisaGaji - a.sisaGaji;
      if (sortBy === "nama") return a.nama.localeCompare(b.nama);
      return b.totalPcs - a.totalPcs;
    });
  }, [vendorStats, statusFilter, searchQuery, sortBy]);

  // Selected vendor inside Modal Bayar
  const selectedModalVendor = useMemo(
    () => vendorStats.find(x => String(x.id) === String(bayarForm.cmtId)) || null,
    [vendorStats, bayarForm.cmtId]
  );

  return (
    <div style={{ padding: 32, background: "var(--bg-app)", minHeight: "100%", overflowY: "auto", overflowX: "hidden" }}>
      
      {/* ─── PAGE HEADER ─────────────────────────────────────────────────── */}
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <h1 className="page-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
              Laporan Produksi & Penggajian Mitra
            </h1>
            <span style={{ background: "linear-gradient(135deg, #10B981 0%, #059669 100%)", color: "white", fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 800, letterSpacing: 0.5 }}>
              LIVE SYNC PORTAL & DASHBOARD
            </span>
          </div>
          <p className="page-subtitle" style={{ margin: 0 }}>
            Rekapitulasi output terverifikasi (ACC), rincian hak upah per SPK, pencairan gaji real-time ke Portal CMT/Washing, dan sinkronisasi Buku Hutang.
          </p>
        </div>

        {/* QUICK SHORTCUT HUBS & ACTIONS */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button
            onClick={() => {
              const firstUnpaid = vendorStats.find(v => v.sisaGaji > 0) || vendorStats[0];
              if (firstUnpaid) {
                openBayarForVendor(firstUnpaid);
              } else {
                setShowBayarModal(true);
              }
            }}
            className="btn btn-primary"
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 800, background: "linear-gradient(135deg, #10B981 0%, #059669 100%)", boxShadow: "0 4px 12px rgba(16,185,129,0.3)" }}
          >
            <CreditCard size={15} /> + Catat Pembayaran Gaji
          </button>

          <Link href="/hutang" className="btn btn-secondary" style={{ background: "white", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <Wallet size={14} color="#DC2626" /> Buku Hutang
          </Link>
          <Link href="/dashboard-cmt" className="btn btn-secondary" style={{ background: "white", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <Activity size={14} color="#7C3AED" /> Dashboard CMT
          </Link>
          <Link href="/daftar-spk" className="btn btn-secondary" style={{ background: "white", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <FileText size={14} color="#2563EB" /> Daftar PO / SPK
          </Link>
          <button
            onClick={() => window.print()}
            className="btn btn-secondary"
            style={{ background: "white", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
            title="Cetak Halaman Laporan"
          >
            <Printer size={14} /> Cetak Rekap
          </button>
        </div>
      </div>

      {/* ─── 4 STAT KPI SUMMARY CARDS ─────────────────────────────────────────── */}
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        {/* Card 1 */}
        <div className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span className="stat-label">Total Pcs Diselesaikan</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#EFF6FF", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#2563EB", lineHeight: 1 }}>{stats.totalPcsAll.toLocaleString("id-ID")}</div>
            <span style={{ fontSize: 12, color: "#64748B" }}>pcs selesai</span>
          </div>
          <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>
            Output resmi yang sudah diverifikasi / ACC Admin
          </div>
        </div>

        {/* Card 2 */}
        <div className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span className="stat-label">Total Hak Upah vs Dibayar</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <DollarSign size={18} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#059669", lineHeight: 1 }}>{formatRp(stats.totalEstimasiGajiAll)}</div>
          </div>
          <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>
            Sudah dicairkan: <strong style={{ color: "#2563EB" }}>{formatRp(stats.totalGajiDibayarAll)}</strong>
          </div>
        </div>

        {/* Card 3: Sisa Tagihan Upah (Hutang Upah) */}
        <div className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span className="stat-label">Sisa Hutang Upah (Belum Cair)</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: stats.sisaGajiAll > 0 ? "#FEF2F2" : "#ECFDF5", color: stats.sisaGajiAll > 0 ? "#DC2626" : "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Wallet size={18} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: stats.sisaGajiAll > 0 ? "#DC2626" : "#059669", lineHeight: 1 }}>
              {formatRp(stats.sisaGajiAll)}
            </div>
          </div>
          <div style={{ fontSize: 11, color: stats.sisaGajiAll > 0 ? "#B91C1C" : "#059669", fontWeight: 700, marginTop: 4 }}>
            {stats.sisaGajiAll > 0
              ? `${stats.totalBelumLunasCount} mitra menunggu pencairan upah`
              : "✓ Seluruh upah mitra telah lunas"}
          </div>
        </div>

        {/* Card 4 */}
        <div className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span className="stat-label">Mitra Paling Produktif</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#FEF3C7", color: "#D97706", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Sparkles size={18} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#0F172A", lineHeight: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {stats.topVendor.nama}
            </div>
          </div>
          <div style={{ fontSize: 11, color: "#16A34A", fontWeight: 700, marginTop: 4 }}>
            {stats.topVendor.pcs.toLocaleString("id-ID")} pcs ({formatRp(stats.topVendor.gaji)})
          </div>
        </div>
      </div>

      {/* ─── TOOLBAR PENCARIAN & FILTER ───────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap", background: "white", padding: "14px 18px", borderRadius: 16, border: "1px solid var(--border-color)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", marginBottom: 20 }}>
        
        {/* Search */}
        <div className="search-wrapper" style={{ minWidth: 260, flex: 1, maxWidth: 360 }}>
          <Search className="search-icon" size={16} />
          <input
            type="text"
            placeholder="Cari vendor, No. PO, model, atau ID..."
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

        {/* Tipe Mitra Filter */}
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B", marginRight: 2 }}>Kategori Mitra:</span>
          {[
            { key: "cmt", label: "CMT / Jahit" },
            { key: "lanjutan", label: "Washing & Lanjutan" },
            { key: "semua", label: "Semua Mitra" },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setTipeFilter(f.key as any)}
              style={{
                padding: "6px 12px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                background: tipeFilter === f.key ? "#2563EB" : "#F1F5F9",
                color: tipeFilter === f.key ? "white" : "#64748B",
                transition: "all 0.15s"
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Status Pembayaran Filter */}
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B", marginRight: 2 }}>Status Upah:</span>
          {[
            { key: "semua", label: "Semua" },
            { key: "belum_lunas", label: "Belum Lunas" },
            { key: "lunas", label: "Sudah Lunas" },
            { key: "aktif", label: "Ada Output" },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key as any)}
              style={{
                padding: "6px 12px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                background: statusFilter === f.key ? "#0F172A" : "#F1F5F9",
                color: statusFilter === f.key ? "white" : "#64748B",
                transition: "all 0.15s"
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 12, fontWeight: 600, background: "white", color: "#334155", outline: "none", cursor: "pointer" }}
          >
            <option value="pcs">Urutkan: Output Terbanyak</option>
            <option value="sisa">Urutkan: Sisa Tagihan Tertinggi</option>
            <option value="gaji">Urutkan: Total Upah Tertinggi</option>
            <option value="nama">Urutkan: Nama A - Z</option>
          </select>
        </div>
      </div>

      {/* ─── DAFTAR KARTU ACCORDION VENDOR CMT ─────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#64748B", background: "white", borderRadius: 16, border: "1px solid #E2E8F0" }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Menyusun data kinerja dan rekapitulasi gaji...</div>
          </div>
        ) : filteredVendorStats.length === 0 ? (
          <div style={{ background: "white", borderRadius: 16, padding: 60, textAlign: "center", border: "1px solid #E2E8F0" }}>
            <Package size={48} style={{ color: "#CBD5E1", margin: "0 auto 16px" }} />
            <h3 style={{ margin: 0, color: "#0F172A", fontWeight: 800 }}>Belum ada data mitra yang sesuai filter</h3>
            <p style={{ marginTop: 6, fontSize: 13, color: "#64748B" }}>
              Ubah filter kategori mitra atau status upah di atas untuk melihat daftar lengkap.
            </p>
          </div>
        ) : (
          filteredVendorStats.map((v, i) => {
            const rankBadge = RANK_BADGES[i] || { bg: "#F8FAFC", color: "#64748B", border: "#E2E8F0", label: `#${i + 1}` };
            const isOpen = expandedId === v.id;
            const categoryEntries = Object.entries(v.categoryBreakdown) as [string, { pcs: number; gaji: number; tarif: number }][];
            const isLunas = v.estimasiGaji > 0 && v.sisaGaji === 0;
            const isSebagian = v.gajiDibayar > 0 && v.sisaGaji > 0;

            return (
              <div
                key={v.id}
                style={{
                  background: "white",
                  borderRadius: 16,
                  border: isLunas ? "1.5px solid #86EFAC" : v.sisaGaji > 0 ? "1.5px solid #FDE68A" : "1px solid #E2E8F0",
                  boxShadow: isOpen ? "0 8px 24px rgba(0,0,0,0.06)" : "0 2px 8px rgba(0,0,0,0.03)",
                  overflow: "hidden",
                  transition: "all 0.2s"
                }}
              >
                {/* Header Row */}
                <div
                  onClick={() => setExpandedId(isOpen ? null : v.id)}
                  style={{
                    padding: "18px 22px",
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    cursor: "pointer",
                    background: isOpen ? "#F8FAFC" : "white",
                    borderBottom: isOpen ? "1px solid #E2E8F0" : "none",
                    flexWrap: "wrap"
                  }}
                >
                  {/* Rank Badge */}
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: rankBadge.bg, color: rankBadge.color, border: `1.5px solid ${rankBadge.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 14, flexShrink: 0 }}>
                    #{i + 1}
                  </div>

                  {/* Vendor Info */}
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 900, fontSize: 16, color: "#0F172A" }}>{v.nama}</span>
                      <span style={{ fontSize: 11, fontFamily: "monospace", color: "#64748B" }}>ID: {v.kodeVendor || `CMT-${v.id}`}</span>
                      {/* Payment Status Badge */}
                      {v.estimasiGaji > 0 && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            padding: "2px 8px",
                            borderRadius: 999,
                            background: isLunas ? "#DCFCE7" : isSebagian ? "#FEF3C7" : "#FEE2E2",
                            color: isLunas ? "#166534" : isSebagian ? "#92400E" : "#991B1B",
                            border: `1px solid ${isLunas ? "#86EFAC" : isSebagian ? "#FDE68A" : "#FECACA"}`
                          }}
                        >
                          {isLunas ? "✓ LUNAS DICAIRKAN" : isSebagian ? "⏳ SEBAGIAN DIBAYAR" : "⚠️ BELUM DIBAYAR"}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748B", marginTop: 3, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ textTransform: "capitalize", fontWeight: 600 }}>{v.jenis_default || v.tipe || "Jahit"}</span>
                      <span>·</span>
                      {v.hasKhusus ? (
                        <span style={{ color: "#C2410C", fontWeight: 700, background: "#FFF7ED", padding: "1px 6px", borderRadius: 4, border: "1px solid #FDBA74" }}>
                          Tarif Dinamis per Kategori ({Object.keys(v.tarifPotongan || {}).length} Model)
                        </span>
                      ) : (
                        <span style={{ fontWeight: 600 }}>Rp {(v.hargaPerPcs || 0).toLocaleString("id-ID")}/pcs</span>
                      )}
                    </div>
                  </div>

                  {/* Summary Metric Chips */}
                  <div style={{ display: "flex", gap: 20, alignItems: "center", flexShrink: 0, flexWrap: "wrap" }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase" }}>Total Output</div>
                      <div style={{ fontSize: 17, fontWeight: 900, color: "#2563EB", lineHeight: 1.2 }}>
                        {v.totalPcs.toLocaleString("id-ID")} <span style={{ fontSize: 11, color: "#94A3B8" }}>pcs</span>
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase" }}>Total Hak Upah</div>
                      <div style={{ fontSize: 17, fontWeight: 900, color: "#0F172A", lineHeight: 1.2 }}>
                        {formatRp(v.estimasiGaji)}
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase" }}>Sudah Dibayar</div>
                      <div style={{ fontSize: 17, fontWeight: 900, color: "#059669", lineHeight: 1.2 }}>
                        {formatRp(v.gajiDibayar)}
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase" }}>Sisa Tagihan</div>
                      <div style={{ fontSize: 17, fontWeight: 900, color: v.sisaGaji > 0 ? "#DC2626" : "#10B981", lineHeight: 1.2 }}>
                        {v.sisaGaji > 0 ? formatRp(v.sisaGaji) : "Rp 0 (Lunas)"}
                      </div>
                    </div>

                    <div style={{ color: "#94A3B8", display: "flex", alignItems: "center" }}>
                      {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isOpen && (
                  <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
                    
                    {/* Action Bar for this vendor */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, background: "#F8FAFC", padding: "12px 16px", borderRadius: 12, border: "1px solid #E2E8F0" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        {v.sisaGaji > 0 ? (
                          <button
                            onClick={() => openBayarForVendor(v)}
                            className="btn btn-primary"
                            style={{ padding: "7px 14px", fontSize: 12, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg, #10B981, #059669)" }}
                          >
                            <CreditCard size={13} /> Bayar Sisa Upah ({formatRp(v.sisaGaji)})
                          </button>
                        ) : v.estimasiGaji > 0 ? (
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                            <span style={{ background: "#DCFCE7", color: "#166534", border: "1px solid #86EFAC", padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 6 }}>
                              <CheckCircle2 size={14} /> Seluruh Upah {v.nama} Sudah Lunas ({formatRp(v.gajiDibayar)})
                            </span>
                            <button
                              onClick={() => openBayarForVendor(v)}
                              className="btn btn-secondary"
                              style={{ padding: "6px 10px", fontSize: 11, fontWeight: 700, background: "white" }}
                            >
                              + Catat Payout Tambahan
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => openBayarForVendor(v)}
                            className="btn btn-primary"
                            style={{ padding: "6px 14px", fontSize: 12, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg, #10B981, #059669)" }}
                          >
                            <CreditCard size={13} /> Catat Pembayaran ke {v.nama}
                          </button>
                        )}

                        <button
                          onClick={() => setSlipModalData({ vendor: v })}
                          className="btn btn-secondary"
                          style={{ padding: "6px 14px", fontSize: 12, fontWeight: 700, background: "white", display: "inline-flex", alignItems: "center", gap: 6 }}
                        >
                          <Receipt size={13} color="#2563EB" /> Cetak Slip Gaji Rekap
                        </button>
                      </div>

                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        {v.kontak && (
                          <a
                            href={`https://wa.me/62${v.kontak.replace(/^0/, "")}`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-secondary"
                            style={{ padding: "6px 12px", fontSize: 12, background: "white", color: "#16A34A", display: "inline-flex", alignItems: "center", gap: 5 }}
                          >
                            <MessageCircle size={13} /> Chat WA
                          </a>
                        )}
                        <a
                          href={getPortalUrl(v)}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-secondary"
                          style={{ padding: "6px 12px", fontSize: 12, background: "white", color: "#2563EB", display: "inline-flex", alignItems: "center", gap: 5 }}
                        >
                          <ExternalLink size={13} /> Buka Portal Mitra
                        </a>
                        <Link
                          href={`/daftar-spk?search=${encodeURIComponent(v.nama)}`}
                          className="btn btn-secondary"
                          style={{ padding: "6px 12px", fontSize: 12, background: "white", display: "inline-flex", alignItems: "center", gap: 5 }}
                        >
                          <FileText size={13} /> Lihat Semua PO
                        </Link>
                      </div>
                    </div>

                    {/* SECTION 1: RINCIAN PER MODEL / KATEGORI */}
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                        <Layers size={15} color="#2563EB" /> Rincian Upah per Model / Kategori Produk
                      </div>
                      <div style={{ border: "1px solid #E2E8F0", borderRadius: 10, overflow: "hidden" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                          <thead>
                            <tr style={{ background: "#F1F5F9", textAlign: "left", color: "#475569" }}>
                              <th style={{ padding: "10px 14px" }}>Model Produk</th>
                              <th style={{ padding: "10px 14px", textAlign: "right" }}>Tarif Satuan</th>
                              <th style={{ padding: "10px 14px", textAlign: "right" }}>Output Selesai (ACC)</th>
                              <th style={{ padding: "10px 14px", textAlign: "right" }}>Subtotal Hak Upah</th>
                            </tr>
                          </thead>
                          <tbody>
                            {categoryEntries.length === 0 ? (
                              <tr>
                                <td colSpan={4} style={{ textAlign: "center", color: "#94A3B8", padding: 20 }}>
                                  Belum ada riwayat pengerjaan yang diverifikasi selesai
                                </td>
                              </tr>
                            ) : (
                              categoryEntries.map(([kat, b]) => (
                                <tr key={kat} style={{ borderBottom: "1px solid #F1F5F9" }}>
                                  <td style={{ padding: "10px 14px", fontWeight: 700 }}>
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#EFF6FF", color: "#1D4ED8", padding: "2px 8px", borderRadius: 6, fontSize: 12 }}>
                                      <Package size={12} /> {kat}
                                    </span>
                                  </td>
                                  <td style={{ padding: "10px 14px", textAlign: "right", color: "#64748B", fontWeight: 600 }}>
                                    {formatRp(b.tarif)}/pcs
                                  </td>
                                  <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 800, color: "#2563EB" }}>
                                    {b.pcs.toLocaleString("id-ID")} pcs
                                  </td>
                                  <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 800, color: "#059669" }}>
                                    {formatRp(b.gaji)}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                          {categoryEntries.length > 0 && (
                            <tfoot>
                              <tr style={{ background: "#F0FDF4", borderTop: "2px solid #16A34A" }}>
                                <td colSpan={2} style={{ padding: "10px 14px", fontWeight: 800, color: "#166534" }}>
                                  TOTAL HAK UPAH TERVERIFIKASI
                                </td>
                                <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 900, color: "#166534", fontSize: 14 }}>
                                  {v.totalPcs.toLocaleString("id-ID")} pcs
                                </td>
                                <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 900, color: "#166534", fontSize: 15 }}>
                                  {formatRp(v.estimasiGaji)}
                                </td>
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </div>
                    </div>

                    {/* SECTION 2: RINCIAN PER PO PRODUKSI */}
                    {v.poBreakdown.length > 0 && (
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                          <FileText size={15} color="#7C3AED" /> Status Upah & Pengerjaan per SPK / PO Produksi
                        </div>
                        <div style={{ border: "1px solid #E2E8F0", borderRadius: 10, overflow: "hidden" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                            <thead>
                              <tr style={{ background: "#F1F5F9", textAlign: "left", color: "#475569" }}>
                                <th style={{ padding: "8px 12px" }}>No. PO</th>
                                <th style={{ padding: "8px 12px" }}>Model</th>
                                <th style={{ padding: "8px 12px", textAlign: "right" }}>Target Terbit</th>
                                <th style={{ padding: "8px 12px", textAlign: "right" }}>Pcs Selesai (ACC)</th>
                                <th style={{ padding: "8px 12px", textAlign: "right" }}>Tarif</th>
                                <th style={{ padding: "8px 12px", textAlign: "right" }}>Hak Upah</th>
                                <th style={{ padding: "8px 12px", textAlign: "right" }}>Sudah Dibayar</th>
                                <th style={{ padding: "8px 12px", textAlign: "right" }}>Sisa Upah</th>
                                <th style={{ padding: "8px 12px", textAlign: "center" }}>Status Bayar</th>
                                <th style={{ padding: "8px 12px", textAlign: "center" }}>Aksi</th>
                              </tr>
                            </thead>
                            <tbody>
                              {v.poBreakdown.map((item: any, idx: number) => {
                                const poLunas = item.statusBayar === "Lunas";
                                const poSebagian = item.statusBayar === "Sebagian Dibayar";
                                return (
                                  <tr key={idx} style={{ borderBottom: "1px solid #F1F5F9" }}>
                                    <td style={{ padding: "8px 12px", fontWeight: 900, fontFamily: "monospace", color: "#1D4ED8" }}>
                                      {item.noPo}
                                    </td>
                                    <td style={{ padding: "8px 12px", fontWeight: 700 }}>{item.model}</td>
                                    <td style={{ padding: "8px 12px", textAlign: "right" }}>{item.targetPcs.toLocaleString("id-ID")} pcs</td>
                                    <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 800, color: "#2563EB" }}>
                                      {item.pcsSelesai.toLocaleString("id-ID")} pcs
                                    </td>
                                    <td style={{ padding: "8px 12px", textAlign: "right" }}>{formatRp(item.tarif)}</td>
                                    <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 800, color: "#0F172A" }}>
                                      {formatRp(item.subtotal)}
                                    </td>
                                    <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 800, color: "#059669" }}>
                                      {formatRp(item.dibayar || 0)}
                                    </td>
                                    <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 800, color: item.sisaHak > 0 ? "#DC2626" : "#10B981" }}>
                                      {formatRp(item.sisaHak || 0)}
                                    </td>
                                    <td style={{ padding: "8px 12px", textAlign: "center" }}>
                                      <span
                                        style={{
                                          fontSize: 10,
                                          fontWeight: 800,
                                          padding: "2px 8px",
                                          borderRadius: 6,
                                          background: poLunas ? "#DCFCE7" : poSebagian ? "#FEF3C7" : item.subtotal > 0 ? "#FEE2E2" : "#F1F5F9",
                                          color: poLunas ? "#166534" : poSebagian ? "#92400E" : item.subtotal > 0 ? "#991B1B" : "#64748B",
                                        }}
                                      >
                                        {item.statusBayar}
                                      </span>
                                    </td>
                                    <td style={{ padding: "8px 12px", textAlign: "center" }}>
                                      <div style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                                        {item.sisaHak > 0 && (
                                          <button
                                            onClick={() => openBayarForVendor(v, item)}
                                            style={{
                                              background: "#10B981",
                                              color: "white",
                                              border: "none",
                                              borderRadius: 6,
                                              padding: "3px 8px",
                                              fontSize: 10.5,
                                              fontWeight: 800,
                                              cursor: "pointer"
                                            }}
                                          >
                                            Bayar PO Ini
                                          </button>
                                        )}
                                        <Link
                                          href={`/daftar-spk?search=${encodeURIComponent(item.noPo)}`}
                                          style={{ color: "#2563EB", fontWeight: 700, textDecoration: "underline", fontSize: 11 }}
                                        >
                                          Buka PO →
                                        </Link>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* SECTION 3: RIWAYAT PENCAIRAN & PEMBAYARAN GAJI */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", display: "flex", alignItems: "center", gap: 6 }}>
                          <CreditCard size={15} color="#059669" /> Riwayat Pencairan / Pembayaran Gaji Terverifikasi
                        </div>
                        <button
                          onClick={() => openBayarForVendor(v)}
                          style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", color: "#1D4ED8", padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                        >
                          + Catat Payout
                        </button>
                      </div>

                      {v.gajiRecords.length === 0 ? (
                        <div style={{ padding: 14, textAlign: "center", color: "#64748B", background: "#F8FAFC", borderRadius: 10, border: "1px dashed #CBD5E1", fontSize: 12 }}>
                          Belum ada catatan pencairan gaji yang tersimpan. Klik <strong>"+ Catat Payout"</strong> saat honor telah ditransfer.
                        </div>
                      ) : (
                        <div style={{ border: "1px solid #E2E8F0", borderRadius: 10, overflow: "hidden" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                            <thead>
                              <tr style={{ background: "#F1F5F9", textAlign: "left", color: "#475569" }}>
                                <th style={{ padding: "8px 12px" }}>Tanggal</th>
                                <th style={{ padding: "8px 12px" }}>No. PO / Ref</th>
                                <th style={{ padding: "8px 12px" }}>Metode & Catatan</th>
                                <th style={{ padding: "8px 12px", textAlign: "right" }}>Jumlah Pcs</th>
                                <th style={{ padding: "8px 12px", textAlign: "right" }}>Total Dibayar</th>
                                <th style={{ padding: "8px 12px", textAlign: "center" }}>Status</th>
                                <th style={{ padding: "8px 12px", textAlign: "center" }}>Aksi</th>
                              </tr>
                            </thead>
                            <tbody>
                              {v.gajiRecords.map((g: any, gi: number) => (
                                <tr key={gi} style={{ borderBottom: "1px solid #F1F5F9" }}>
                                  <td style={{ padding: "8px 12px", color: "#334155" }}>
                                    {new Date(g.tanggal).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                                  </td>
                                  <td style={{ padding: "8px 12px", fontFamily: "monospace", color: "#1D4ED8", fontWeight: 700 }}>
                                    {g.noPo && g.noPo !== "-" ? g.noPo : (g.poId ? `PO #${g.poId}` : "Semua PO (FIFO)")}
                                  </td>
                                  <td style={{ padding: "8px 12px" }}>
                                    <div style={{ fontWeight: 700, color: "#0F172A" }}>{g.metode || "Transfer Bank"}</div>
                                    {g.catatan && <div style={{ fontSize: 11, color: "#64748B" }}>{g.catatan}</div>}
                                  </td>
                                  <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700 }}>
                                    {(g.jumlahPcs || 0).toLocaleString("id-ID")} pcs
                                  </td>
                                  <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 800, color: "#059669" }}>
                                    {formatRp(g.dibayar ?? g.totalGaji)}
                                  </td>
                                  <td style={{ padding: "8px 12px", textAlign: "center" }}>
                                    <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#D1FAE5", color: "#065F46", fontWeight: 700 }}>
                                      {g.status || "Lunas"}
                                    </span>
                                  </td>
                                  <td style={{ padding: "8px 12px", textAlign: "center" }}>
                                    <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                                      <button
                                        onClick={() => setSlipModalData({ vendor: v, payment: g })}
                                        style={{ border: "1px solid #CBD5E1", background: "white", cursor: "pointer", color: "#2563EB", padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}
                                        title="Cetak bukti pencairan ini"
                                      >
                                        <Printer size={11} /> Bukti
                                      </button>
                                      <button
                                        onClick={() => handleDeleteGaji(g.id)}
                                        style={{ border: "none", background: "none", cursor: "pointer", color: "#DC2626", padding: 2 }}
                                        title="Hapus riwayat payout ini"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr style={{ background: "#EFF6FF", borderTop: "1px solid #BFDBFE" }}>
                                <td colSpan={4} style={{ padding: "10px 12px", fontWeight: 800, color: "#1E40AF" }}>
                                  TOTAL GAJI TERCATAT DICAIRKAN ({v.sisaGaji > 0 ? `Sisa Belum Cair: ${formatRp(v.sisaGaji)}` : "LUNAS 100%"})
                                </td>
                                <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 900, color: "#1E40AF", fontSize: 14 }}>
                                  {formatRp(v.gajiDibayar)}
                                </td>
                                <td colSpan={2}></td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ─── GRAND TOTAL BAR ──────────────────────────────────────────────── */}
      {vendorStats.length > 0 && (
        <div style={{ background: "white", border: "2px solid #10B981", borderRadius: 16, padding: "20px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 4px 14px rgba(16,185,129,0.15)", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16, color: "#065F46", display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={20} color="#10B981" /> REKAPITULASI TOTAL SELURUH UPAH MITRA
            </div>
            <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
              Sinkron otomatis dengan Portal Mitra, Buku Hutang, dan Laporan Keuangan Dashboard.
            </div>
          </div>

          <div style={{ display: "flex", gap: 28, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Total Output Selesai</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#2563EB", lineHeight: 1.1 }}>
                {stats.totalPcsAll.toLocaleString("id-ID")} <span style={{ fontSize: 12, color: "#94A3B8" }}>pcs</span>
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Total Hak Upah</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#0F172A", lineHeight: 1.1 }}>
                {formatRp(stats.totalEstimasiGajiAll)}
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Sudah Dibayar</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#059669", lineHeight: 1.1 }}>
                {formatRp(stats.totalGajiDibayarAll)}
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Sisa Tagihan Upah</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: stats.sisaGajiAll > 0 ? "#DC2626" : "#10B981", lineHeight: 1.1 }}>
                {formatRp(stats.sisaGajiAll)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL CATAT PEMBAYARAN GAJI (CRUD POST) ────────────────────────── */}
      {showBayarModal && (
        <div className="modal-overlay" onClick={() => setShowBayarModal(false)} style={{ zIndex: 9999 }}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 560, padding: 0, overflow: "hidden" }}>
            
            {/* Header */}
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #E2E8F0", background: "linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: "#10B981", color: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <CreditCard size={20} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontWeight: 900, fontSize: 17, color: "#065F46" }}>
                    Catat Pembayaran Upah / Gaji Mitra
                  </h2>
                  <div style={{ fontSize: 12, color: "#047857", marginTop: 2 }}>
                    Otomatis memperbarui status Lunas di Portal Mitra, Buku Hutang, dan Dashboard Keuangan.
                  </div>
                </div>
              </div>
              <button onClick={() => setShowBayarModal(false)} style={{ background: "white", border: "1px solid #CBD5E1", width: 32, height: 32, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B" }}>
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitBayar} style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#334155", marginBottom: 6 }}>
                  Pilih Mitra Vendor <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <select
                  required
                  className="form-control"
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #CBD5E1", fontSize: 14, cursor: "pointer" }}
                  value={bayarForm.cmtId}
                  onChange={e => {
                    const cmtId = e.target.value;
                    const v = vendorStats.find(x => String(x.id) === String(cmtId));
                    setBayarForm(f => ({
                      ...f,
                      cmtId,
                      poId: "",
                      noPo: "",
                      model: "",
                      totalGaji: v ? String(v.sisaGaji > 0 ? v.sisaGaji : v.estimasiGaji) : f.totalGaji,
                      jumlahPcs: v ? String(v.totalPcs) : f.jumlahPcs,
                      catatan: v ? `Pembayaran upah untuk ${v.nama}` : f.catatan
                    }));
                  }}
                >
                  <option value="">-- Pilih Mitra Vendor --</option>
                  {vendorStats.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.nama} {v.kodeVendor ? `(${v.kodeVendor})` : ""} — Sisa Tagihan: {formatRp(v.sisaGaji)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Live Summary Banner for Selected Vendor */}
              {selectedModalVendor && (
                <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12, padding: "12px 14px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, fontSize: 12 }}>
                  <div>
                    <div style={{ color: "#64748B", fontSize: 11 }}>Total Hak Upah</div>
                    <div style={{ fontWeight: 800, color: "#0F172A", marginTop: 2 }}>{formatRp(selectedModalVendor.estimasiGaji)}</div>
                  </div>
                  <div>
                    <div style={{ color: "#64748B", fontSize: 11 }}>Sudah Dibayar</div>
                    <div style={{ fontWeight: 800, color: "#059669", marginTop: 2 }}>{formatRp(selectedModalVendor.gajiDibayar)}</div>
                  </div>
                  <div>
                    <div style={{ color: "#64748B", fontSize: 11 }}>Sisa Belum Cair</div>
                    <div style={{ fontWeight: 900, color: selectedModalVendor.sisaGaji > 0 ? "#DC2626" : "#10B981", marginTop: 2 }}>
                      {formatRp(selectedModalVendor.sisaGaji)}
                    </div>
                  </div>
                </div>
              )}

              {/* Alokasi PO / SPK Dropdown */}
              {selectedModalVendor && selectedModalVendor.poBreakdown.length > 0 && (
                <div>
                  <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#334155", marginBottom: 6 }}>
                    Alokasi ke SPK / PO Produksi
                  </label>
                  <select
                    className="form-control"
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #CBD5E1", fontSize: 13, cursor: "pointer" }}
                    value={bayarForm.poId}
                    onChange={e => {
                      const poId = e.target.value;
                      if (!poId) {
                        setBayarForm(f => ({
                          ...f,
                          poId: "",
                          noPo: "",
                          model: "",
                          totalGaji: String(selectedModalVendor.sisaGaji > 0 ? selectedModalVendor.sisaGaji : selectedModalVendor.estimasiGaji),
                          jumlahPcs: String(selectedModalVendor.totalPcs),
                          catatan: `Pembayaran upah untuk ${selectedModalVendor.nama}`
                        }));
                      } else {
                        const po = selectedModalVendor.poBreakdown.find((p: any) => String(p.poId) === String(poId));
                        if (po) {
                          setBayarForm(f => ({
                            ...f,
                            poId: String(po.poId),
                            noPo: po.noPo,
                            model: po.model,
                            totalGaji: String(po.sisaHak > 0 ? po.sisaHak : po.subtotal),
                            jumlahPcs: String(po.pcsSelesai),
                            catatan: `Pelunasan upah SPK ${po.noPo} (${po.model}) - ${selectedModalVendor.nama}`
                          }));
                        }
                      }
                    }}
                  >
                    <option value="">Otomatis Semua PO Belum Lunas (Alokasi FIFO)</option>
                    {selectedModalVendor.poBreakdown.map((po: any) => (
                      <option key={po.poId} value={po.poId}>
                        SPK {po.noPo} ({po.model}) — {po.pcsSelesai} pcs — Sisa: {formatRp(po.sisaHak)} ({po.statusBayar})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#334155", marginBottom: 6 }}>
                    Nominal Pembayaran (Rp) <span style={{ color: "#EF4444" }}>*</span>
                  </label>
                  <div style={{ display: "flex", border: "1px solid #CBD5E1", borderRadius: 10, overflow: "hidden" }}>
                    <div style={{ padding: "10px 12px", background: "#F1F5F9", fontWeight: 800, fontSize: 13, color: "#475569", borderRight: "1px solid #CBD5E1" }}>
                      Rp
                    </div>
                    <input
                      required
                      type="number"
                      style={{ flex: 1, padding: "10px 12px", border: "none", outline: "none", fontSize: 14, fontWeight: 700 }}
                      value={bayarForm.totalGaji}
                      onChange={e => setBayarForm(f => ({ ...f, totalGaji: e.target.value }))}
                      placeholder="Contoh: 5400000"
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#334155", marginBottom: 6 }}>
                    Jumlah Pcs Diselesaikan
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #CBD5E1", fontSize: 14, fontWeight: 700 }}
                    value={bayarForm.jumlahPcs}
                    onChange={e => setBayarForm(f => ({ ...f, jumlahPcs: e.target.value }))}
                    placeholder="Contoh: 500"
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#334155", marginBottom: 6 }}>
                    Metode Pembayaran
                  </label>
                  <select
                    className="form-control"
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #CBD5E1", fontSize: 14 }}
                    value={bayarForm.metode}
                    onChange={e => setBayarForm(f => ({ ...f, metode: e.target.value }))}
                  >
                    <option value="Transfer Bank">Transfer Bank (BCA/Mandiri/BRI)</option>
                    <option value="Tunai / Kas">Tunai / Kas Kantor</option>
                    <option value="Kasbon / DP">Potongan Kasbon / Uang Muka</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#334155", marginBottom: 6 }}>
                    Tanggal Pembayaran
                  </label>
                  <input
                    type="date"
                    className="form-control"
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #CBD5E1", fontSize: 14 }}
                    value={bayarForm.tanggal}
                    onChange={e => setBayarForm(f => ({ ...f, tanggal: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#334155", marginBottom: 6 }}>
                  Catatan / Bukti Referensi
                </label>
                <input
                  className="form-control"
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #CBD5E1", fontSize: 13 }}
                  value={bayarForm.catatan}
                  onChange={e => setBayarForm(f => ({ ...f, catatan: e.target.value }))}
                  placeholder="Misal: Transfer via BCA No. Ref 894562..."
                />
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowBayarModal(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: "12px", background: "white" }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingBayar}
                  className="btn btn-primary"
                  style={{ flex: 2, padding: "12px", fontWeight: 800, background: "linear-gradient(135deg, #10B981, #059669)" }}
                >
                  {isSubmittingBayar ? "Menyimpan Pembayaran..." : "Simpan Pembayaran Gaji"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL CETAK SLIP GAJI RESMI / BUKTI PENCAIRAN ─────────────────── */}
      {slipModalData && (
        <div className="modal-overlay" onClick={() => setSlipModalData(null)} style={{ zIndex: 9999 }}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 680, padding: 0, overflow: "hidden" }}>
            
            {/* Header */}
            <div className="no-print" style={{ padding: "18px 24px", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#0F172A", display: "flex", alignItems: "center", gap: 8 }}>
                <Receipt size={18} color="#2563EB" />
                {slipModalData.payment ? "Bukti Pencairan Upah Resmi" : "Slip Rekapitulasi Gaji & Upah Mitra"}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => window.print()}
                  className="btn btn-primary"
                  style={{ padding: "6px 14px", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}
                >
                  <Printer size={14} /> Cetak Slip
                </button>
                <button onClick={() => setSlipModalData(null)} style={{ background: "white", border: "1px solid #CBD5E1", width: 32, height: 32, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Printable Slip Content */}
            <div style={{ padding: "32px", background: "white", color: "#0F172A" }}>
              {/* Slip Kop */}
              <div style={{ borderBottom: "2px solid #0F172A", paddingBottom: 16, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, letterSpacing: -0.5 }}>PLAY&apos;S JEANS / TIRTA BINTANG</h3>
                  <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>Spesialis Denim & Celana Jeans Konveksi</div>
                  <div style={{ fontSize: 11, color: "#64748B" }}>Divisi Penggajian & Pembayaran Mitra Produksi</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 14, fontWeight: 900, color: "#2563EB" }}>
                    {slipModalData.payment ? `BUKTI TRANSFER UPAH #${slipModalData.payment.id}` : "SLIP UPAH PRODUKSI MITRA"}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                    Tanggal: {new Date(slipModalData.payment?.tanggal || Date.now()).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                  </div>
                </div>
              </div>

              {/* Vendor Info */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, background: "#F8FAFC", padding: 14, borderRadius: 10, marginBottom: 20, fontSize: 12 }}>
                <div>
                  <div style={{ color: "#64748B" }}>Nama Penerima:</div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: "#0F172A", marginTop: 2 }}>{slipModalData.vendor.nama}</div>
                  <div style={{ color: "#64748B", marginTop: 2 }}>Kode: {slipModalData.vendor.kodeVendor || `CMT-${slipModalData.vendor.id}`}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: "#64748B" }}>Status Pembayaran:</div>
                  <div style={{ fontWeight: 800, color: slipModalData.vendor.sisaGaji === 0 ? "#059669" : "#D97706", marginTop: 2 }}>
                    {slipModalData.payment ? "LUNAS DICAIRKAN" : slipModalData.vendor.statusPembayaran}
                  </div>
                  <div style={{ color: "#64748B", marginTop: 2 }}>Kontak: {slipModalData.vendor.kontak || "—"}</div>
                </div>
              </div>

              {slipModalData.payment ? (
                /* Single Payment Receipt Table */
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 20 }}>
                  <thead>
                    <tr style={{ borderBottom: "1.5px solid #CBD5E1", textAlign: "left", color: "#475569" }}>
                      <th style={{ padding: "8px 6px" }}>Keterangan Pencairan</th>
                      <th style={{ padding: "8px 6px" }}>No. PO / SPK</th>
                      <th style={{ padding: "8px 6px" }}>Metode</th>
                      <th style={{ padding: "8px 6px", textAlign: "right" }}>Volume</th>
                      <th style={{ padding: "8px 6px", textAlign: "right" }}>Nominal Dibayar</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <td style={{ padding: "10px 6px", fontWeight: 700 }}>{slipModalData.payment.catatan || "Pembayaran Upah Produksi"}</td>
                      <td style={{ padding: "10px 6px", fontFamily: "monospace", fontWeight: 700 }}>{slipModalData.payment.noPo || "Semua PO"}</td>
                      <td style={{ padding: "10px 6px" }}>{slipModalData.payment.metode || "Transfer Bank"}</td>
                      <td style={{ padding: "10px 6px", textAlign: "right", fontWeight: 800 }}>{(slipModalData.payment.jumlahPcs || 0).toLocaleString("id-ID")} pcs</td>
                      <td style={{ padding: "10px 6px", textAlign: "right", fontWeight: 900, color: "#059669", fontSize: 14 }}>
                        {formatRp(slipModalData.payment.dibayar ?? slipModalData.payment.totalGaji)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                /* Full Vendor Salary Recap Table */
                <>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 16 }}>
                    <thead>
                      <tr style={{ borderBottom: "1.5px solid #CBD5E1", textAlign: "left", color: "#475569" }}>
                        <th style={{ padding: "8px 6px" }}>No. SPK / Model</th>
                        <th style={{ padding: "8px 6px", textAlign: "right" }}>Tarif Satuan</th>
                        <th style={{ padding: "8px 6px", textAlign: "right" }}>Volume ACC</th>
                        <th style={{ padding: "8px 6px", textAlign: "right" }}>Hak Upah</th>
                        <th style={{ padding: "8px 6px", textAlign: "right" }}>Sudah Dibayar</th>
                        <th style={{ padding: "8px 6px", textAlign: "right" }}>Sisa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(slipModalData.vendor.poBreakdown || []).map((po: any) => (
                        <tr key={po.poId} style={{ borderBottom: "1px solid #F1F5F9" }}>
                          <td style={{ padding: "8px 6px", fontWeight: 700 }}>SPK {po.noPo} — {po.model}</td>
                          <td style={{ padding: "8px 6px", textAlign: "right" }}>{formatRp(po.tarif)}</td>
                          <td style={{ padding: "8px 6px", textAlign: "right", fontWeight: 800 }}>{po.pcsSelesai.toLocaleString("id-ID")} pcs</td>
                          <td style={{ padding: "8px 6px", textAlign: "right", fontWeight: 800 }}>{formatRp(po.subtotal)}</td>
                          <td style={{ padding: "8px 6px", textAlign: "right", fontWeight: 800, color: "#059669" }}>{formatRp(po.dibayar || 0)}</td>
                          <td style={{ padding: "8px 6px", textAlign: "right", fontWeight: 800, color: po.sisaHak > 0 ? "#DC2626" : "#10B981" }}>{formatRp(po.sisaHak || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: "2px solid #0F172A" }}>
                        <td colSpan={2} style={{ padding: "10px 6px", fontWeight: 900 }}>TOTAL AKUMULASI UPAH</td>
                        <td style={{ padding: "10px 6px", textAlign: "right", fontWeight: 900, color: "#2563EB" }}>
                          {slipModalData.vendor.totalPcs.toLocaleString("id-ID")} pcs
                        </td>
                        <td style={{ padding: "10px 6px", textAlign: "right", fontWeight: 900 }}>
                          {formatRp(slipModalData.vendor.estimasiGaji)}
                        </td>
                        <td style={{ padding: "10px 6px", textAlign: "right", fontWeight: 900, color: "#059669" }}>
                          {formatRp(slipModalData.vendor.gajiDibayar)}
                        </td>
                        <td style={{ padding: "10px 6px", textAlign: "right", fontWeight: 900, color: slipModalData.vendor.sisaGaji > 0 ? "#DC2626" : "#059669" }}>
                          {formatRp(slipModalData.vendor.sisaGaji)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </>
              )}

              {/* Signatures */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 30, marginTop: 36, textAlign: "center", fontSize: 12 }}>
                <div>
                  <div style={{ color: "#64748B", marginBottom: 48 }}>Penerima / Mitra Produksi,</div>
                  <div style={{ fontWeight: 800, borderTop: "1px solid #CBD5E1", paddingTop: 4, width: 180, margin: "0 auto" }}>
                    {slipModalData.vendor.nama}
                  </div>
                </div>
                <div>
                  <div style={{ color: "#64748B", marginBottom: 48 }}>Administrasi Keuangan,</div>
                  <div style={{ fontWeight: 800, borderTop: "1px solid #CBD5E1", paddingTop: 4, width: 180, margin: "0 auto" }}>
                    Play&apos;s Jeans / Tirta Bintang
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
