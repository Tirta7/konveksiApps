"use client";
import React, { useEffect, useState, useMemo } from "react";
import {
  BarChart2,
  Users,
  TrendingUp,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Package,
  Plus,
  Printer,
  Search,
  Filter,
  DollarSign,
  Calendar,
  ExternalLink,
  MessageCircle,
  FileText,
  Activity,
  Layers,
  ArrowRight,
  Clock,
  Check,
  X,
  CreditCard,
  Building2,
  Trash2,
  Zap,
  Sparkles,
  Receipt
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

export default function LaporanProduksiPage() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [pengambilans, setPengambilans] = useState<any[]>([]);
  const [gajiCmt, setGajiCmt] = useState<any[]>([]);
  const [poList, setPoList] = useState<any[]>([]);
  const [cmtProgres, setCmtProgres] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("semua");
  const [sortBy, setSortBy] = useState<"pcs" | "gaji" | "nama">("pcs");

  // Modal Pembayaran Gaji
  const [showBayarModal, setShowBayarModal] = useState(false);
  const [bayarForm, setBayarForm] = useState({
    cmtId: "",
    poId: "",
    jumlahPcs: "",
    totalGaji: "",
    metode: "Transfer Bank",
    catatan: "",
    status: "Lunas",
    tanggal: new Date().toISOString().split("T")[0]
  });
  const [isSubmittingBayar, setIsSubmittingBayar] = useState(false);

  // Modal Cetak Slip Gaji
  const [slipModalVendor, setSlipModalVendor] = useState<any | null>(null);

  const fetchData = async () => {
    try {
      const [resV, resP, resG, resPo, resCp] = await Promise.all([
        fetch("/api/vendors?_t=" + Date.now()).then(r => r.json()),
        fetch("/api/po-pengambilan?_t=" + Date.now()).then(r => r.json()),
        fetch("/api/gaji-cmt?_t=" + Date.now()).then(r => r.json()),
        fetch("/api/po-produksi?_t=" + Date.now()).then(r => r.json()),
        fetch("/api/cmt-progres?_t=" + Date.now()).then(r => r.json()),
      ]);

      const vList = Array.isArray(resV) ? resV.filter((v: any) => v.tipe === "cmt") : [];
      setVendors(vList);
      setPengambilans(Array.isArray(resP) ? resP : []);
      setGajiCmt(Array.isArray(resG) ? resG : []);
      setPoList(Array.isArray(resPo) ? resPo : []);
      setCmtProgres(Array.isArray(resCp) ? resCp : []);
    } catch (e) {
      console.error(e);
      toast.error("Gagal memuat data laporan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => { if (!document.hidden) fetchData(); }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Real-time sync: refresh data when another admin makes changes
  useEffect(() => {
    const handler = () => fetchData();
    window.addEventListener("konveksi-sync", handler);
    return () => window.removeEventListener("konveksi-sync", handler);
  }, []);

  // Open Bayar Modal for specific vendor
  const openBayarForVendor = (v: any) => {
    setBayarForm({
      cmtId: String(v.id),
      poId: "",
      jumlahPcs: "",
      totalGaji: "",
      metode: "Transfer Bank",
      catatan: `Pembayaran upah jahit untuk ${v.nama}`,
      status: "Lunas",
      tanggal: new Date().toISOString().split("T")[0]
    });
    setShowBayarModal(true);
  };

  // Submit Pembayaran Gaji
  const handleSubmitBayar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bayarForm.cmtId || !bayarForm.totalGaji) {
      return toast.error("Harap pilih Vendor CMT dan isi Nominal Gaji.");
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
      toast.success("Pembayaran gaji berhasil dicatat!");
      setShowBayarModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmittingBayar(false);
    }
  };

  // Delete / Batal Riwayat Pembayaran Gaji
  const handleDeleteGaji = async (gajiId: number) => {
    if (!confirm("Hapus catatan pembayaran upah ini?")) return;
    try {
      const res = await fetch(`/api/gaji-cmt?id=${gajiId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Catatan pembayaran gaji dihapus");
        fetchData();
      } else {
        toast.error("Gagal menghapus");
      }
    } catch {
      toast.error("Terjadi kesalahan sistem");
    }
  };

  // Calculate detailed stats per vendor
  const { stats, vendorStats } = useMemo(() => {
    let totalPcsAll = 0;
    let totalEstimasiGajiAll = 0;
    let totalGajiDibayarAll = 0;
    let topVendor = { nama: "-", pcs: 0, gaji: 0 };

    const computed = vendors.map(v => {
      // 1. Pengambilan real-time
      const pByVendor = pengambilans.filter(p => p.po?.vendorId === v.id);
      // 2. Gaji real records
      const gajiRecords = gajiCmt.filter(g => Number(g.cmtId) === Number(v.id));
      // 3. POs assigned to this vendor
      const vendorPOs = poList.filter(p => Number(p.vendorId) === Number(v.id));
      // 4. Progress reported by CMT
      const progressRecords = cmtProgres.filter(p => Number(p.vendor_id) === Number(v.id));

      // Calculate breakdown per category / model
      const categoryBreakdown: Record<string, { pcs: number; gaji: number; tarif: number }> = {};
      
      // Calculate from pengambilans
      pByVendor.forEach(p => {
        const kat = p.po?.model || p.po?.kategori || "Umum";
        let tarif = v.hargaPerPcs || 0;
        if (v.tarifPotongan && v.tarifPotongan[kat]) {
          tarif = v.tarifPotongan[kat];
        }
        if (!categoryBreakdown[kat]) {
          categoryBreakdown[kat] = { pcs: 0, gaji: 0, tarif };
        }
        categoryBreakdown[kat].pcs += (p.jumlahDiambil || 0);
        categoryBreakdown[kat].gaji += (p.jumlahDiambil || 0) * tarif;
      });

      // Calculate PO level progress
      const poBreakdown = vendorPOs.map(po => {
        const pengByPo = pByVendor.filter(p => p.poId === po.id);
        const pcsAmbil = pengByPo.reduce((s, p) => s + (p.jumlahDiambil || 0), 0);
        const progByPo = progressRecords.filter(p => p.po_id === po.id);
        const pcsLapor = progByPo.reduce((s, p) => s + (p.totalJumlah || 0), 0);

        const kat = po.model || "Umum";
        let tarif = v.hargaPerPcs || 0;
        if (v.tarifPotongan && v.tarifPotongan[kat]) {
          tarif = v.tarifPotongan[kat];
        }

        const effectivePcs = pcsAmbil > 0 ? pcsAmbil : pcsLapor;
        const subtotal = effectivePcs * tarif;

        return {
          poId: po.id,
          noPo: po.noPo,
          model: po.model,
          targetPcs: po.jumlahTerbit,
          pcsSelesai: effectivePcs,
          tarif,
          subtotal,
          status: po.status
        };
      });

      const totalPcsVendor = Object.values(categoryBreakdown).reduce((s, b) => s + b.pcs, 0);
      const totalEstimasiGaji = Object.values(categoryBreakdown).reduce((s, b) => s + b.gaji, 0);
      const totalGajiDibayar = gajiRecords.reduce((s, g) => s + Number(g.totalGaji || 0), 0);
      const sisaBelumDibayar = Math.max(0, totalEstimasiGaji - totalGajiDibayar);

      totalPcsAll += totalPcsVendor;
      totalEstimasiGajiAll += totalEstimasiGaji;
      totalGajiDibayarAll += totalGajiDibayar;

      if (totalPcsVendor > topVendor.pcs) {
        topVendor = { nama: v.nama, pcs: totalPcsVendor, gaji: totalEstimasiGaji };
      }

      return {
        ...v,
        totalPcs: totalPcsVendor,
        estimasiGaji: totalEstimasiGaji,
        gajiDibayar: totalGajiDibayar,
        sisaGaji: sisaBelumDibayar,
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
        sisaGajiAll: Math.max(0, totalEstimasiGajiAll - totalGajiDibayarAll),
        topVendor,
        totalCmtActive: vendors.length
      },
      vendorStats: computed
    };
  }, [vendors, pengambilans, gajiCmt, poList, cmtProgres]);

  // Filter & Search
  const filteredVendorStats = useMemo(() => {
    return vendorStats.filter(v => {
      // Status
      if (statusFilter === "aktif" && v.totalPcs === 0) return false;
      if (statusFilter === "kosong" && v.totalPcs > 0) return false;

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNama = (v.nama || "").toLowerCase().includes(q);
        const matchKode = (v.kodeVendor || "").toLowerCase().includes(q);
        const matchKontak = (v.kontak || "").toLowerCase().includes(q);
        const matchModel = Object.keys(v.categoryBreakdown).some(k => k.toLowerCase().includes(q));
        if (!matchNama && !matchKode && !matchKontak && !matchModel) return false;
      }
      return true;
    }).sort((a, b) => {
      if (sortBy === "gaji") return b.estimasiGaji - a.estimasiGaji;
      if (sortBy === "nama") return a.nama.localeCompare(b.nama);
      return b.totalPcs - a.totalPcs;
    });
  }, [vendorStats, statusFilter, searchQuery, sortBy]);

  return (
    <div style={{ padding: 32, background: "var(--bg-app)", minHeight: "100%", overflowY: "auto", overflowX: "hidden" }}>
      
      {/* ─── PAGE HEADER ─────────────────────────────────────────────────── */}
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <h1 className="page-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
              Laporan Produksi & Kinerja CMT
            </h1>
            <span style={{ background: "linear-gradient(135deg, #10B981 0%, #059669 100%)", color: "white", fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 800, letterSpacing: 0.5 }}>
              REKAP UPAH & OUTPUT
            </span>
          </div>
          <p className="page-subtitle" style={{ margin: 0 }}>
            Detail rekapitulasi output jahit, perhitungan estimasi upah, riwayat pencairan gaji, dan performa produktivitas mitra CMT.
          </p>
        </div>

        {/* QUICK SHORTCUT HUBS & ACTIONS */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button
            onClick={() => {
              setBayarForm({
                cmtId: vendors[0]?.id ? String(vendors[0].id) : "",
                poId: "",
                jumlahPcs: "",
                totalGaji: "",
                metode: "Transfer Bank",
                catatan: "",
                status: "Lunas",
                tanggal: new Date().toISOString().split("T")[0]
              });
              setShowBayarModal(true);
            }}
            className="btn btn-primary"
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 800, background: "linear-gradient(135deg, #10B981 0%, #059669 100%)", boxShadow: "0 4px 12px rgba(16,185,129,0.3)" }}
          >
            <CreditCard size={15} /> + Catat Pembayaran Gaji
          </button>

          <Link href="/dashboard-cmt" className="btn btn-secondary" style={{ background: "white", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <Activity size={14} color="#7C3AED" /> Dashboard CMT
          </Link>
          <Link href="/daftar-spk" className="btn btn-secondary" style={{ background: "white", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <FileText size={14} color="#2563EB" /> Daftar PO / SPK
          </Link>
          <Link href="/atur-vendor" className="btn btn-secondary" style={{ background: "white", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <Building2 size={14} color="#475569" /> Atur Vendor
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
            <div style={{ fontSize: 28, fontWeight: 900, color: "#2563EB", lineHeight: 1 }}>{stats.totalPcsAll.toLocaleString()}</div>
            <span style={{ fontSize: 12, color: "#64748B" }}>pcs selesai</span>
          </div>
          <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>
            Output jahit resmi yang sudah di-ACC
          </div>
        </div>

        {/* Card 2 */}
        <div className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span className="stat-label">Akumulasi Upah / Gaji CMT</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <DollarSign size={18} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#059669", lineHeight: 1 }}>{formatRp(stats.totalEstimasiGajiAll)}</div>
          </div>
          <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>
            Tercatat dibayar: <strong style={{ color: "#2563EB" }}>{formatRp(stats.totalGajiDibayarAll)}</strong>
          </div>
        </div>

        {/* Card 3 */}
        <div className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span className="stat-label">Mitra CMT Aktif</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#FFF7ED", color: "#EA580C", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Users size={18} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#EA580C", lineHeight: 1 }}>{stats.totalCmtActive}</div>
            <span style={{ fontSize: 12, color: "#64748B" }}>mitra penjahit</span>
          </div>
          <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>
            Memiliki tarif per pcs & akun portal
          </div>
        </div>

        {/* Card 4 */}
        <div className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span className="stat-label">CMT Paling Produktif</span>
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
            {stats.topVendor.pcs.toLocaleString()} pcs ({formatRp(stats.topVendor.gaji)})
          </div>
        </div>
      </div>

      {/* ─── TOOLBAR PENCARIAN & FILTER ───────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap", background: "white", padding: "14px 18px", borderRadius: 16, border: "1px solid var(--border-color)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", marginBottom: 20 }}>
        
        {/* Search */}
        <div className="search-wrapper" style={{ minWidth: 280, flex: 1, maxWidth: 420 }}>
          <Search className="search-icon" size={16} />
          <input
            type="text"
            placeholder="Cari nama vendor CMT, model, atau ID..."
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

        {/* Status Filter */}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B", marginRight: 2 }}>Status Kerja:</span>
          {[
            { key: "semua", label: "Semua CMT" },
            { key: "aktif", label: "Ada Output" },
            { key: "kosong", label: "Belum Ada Output" },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
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
            <option value="gaji">Urutkan: Estimasi Gaji Tertinggi</option>
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
            <h3 style={{ margin: 0, color: "#0F172A", fontWeight: 800 }}>Belum ada data kinerja CMT</h3>
            <p style={{ marginTop: 6, fontSize: 13, color: "#64748B" }}>
              Silakan terbitkan PO Produksi ke CMT dan catat pengambilan hasil jahit.
            </p>
          </div>
        ) : (
          filteredVendorStats.map((v, i) => {
            const rankBadge = RANK_BADGES[i] || { bg: "#F8FAFC", color: "#64748B", border: "#E2E8F0", label: `#${i + 1}` };
            const isOpen = expandedId === v.id;
            const categoryEntries = Object.entries(v.categoryBreakdown) as [string, { pcs: number; gaji: number; tarif: number }][];

            return (
              <div
                key={v.id}
                style={{
                  background: "white",
                  borderRadius: 16,
                  border: "1px solid #E2E8F0",
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
                    borderBottom: isOpen ? "1px solid #E2E8F0" : "none"
                  }}
                >
                  {/* Rank Badge */}
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: rankBadge.bg, color: rankBadge.color, border: `1.5px solid ${rankBadge.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 14, flexShrink: 0 }}>
                    #{i + 1}
                  </div>

                  {/* Vendor Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 900, fontSize: 16, color: "#0F172A" }}>{v.nama}</span>
                      <span style={{ fontSize: 11, fontFamily: "monospace", color: "#64748B" }}>ID: {v.kodeVendor || `CMT-${v.id}`}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#64748B", marginTop: 3, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span>{v.jenis_default || "Jahit Jeans"}</span>
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
                  <div style={{ display: "flex", gap: 24, alignItems: "center", flexShrink: 0 }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase" }}>Total Output</div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: "#2563EB", lineHeight: 1.2 }}>
                        {v.totalPcs.toLocaleString()} <span style={{ fontSize: 11, color: "#94A3B8" }}>pcs</span>
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase" }}>Estimasi Upah</div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: "#10B981", lineHeight: 1.2 }}>
                        {formatRp(v.estimasiGaji)}
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
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <button
                          onClick={() => openBayarForVendor(v)}
                          className="btn btn-primary"
                          style={{ padding: "6px 14px", fontSize: 12, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg, #10B981, #059669)" }}
                        >
                          <CreditCard size={13} /> Bayar Gaji ke {v.nama}
                        </button>
                        <button
                          onClick={() => setSlipModalVendor(v)}
                          className="btn btn-secondary"
                          style={{ padding: "6px 14px", fontSize: 12, fontWeight: 700, background: "white", display: "inline-flex", alignItems: "center", gap: 6 }}
                        >
                          <Receipt size={13} color="#2563EB" /> Cetak Slip Gaji
                        </button>
                      </div>

                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
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
                          href={`/cmt/${v.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-secondary"
                          style={{ padding: "6px 12px", fontSize: 12, background: "white", color: "#2563EB", display: "inline-flex", alignItems: "center", gap: 5 }}
                        >
                          <ExternalLink size={13} /> Portal CMT
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
                              <th style={{ padding: "10px 14px", textAlign: "right" }}>Output Selesai</th>
                              <th style={{ padding: "10px 14px", textAlign: "right" }}>Subtotal Gaji</th>
                            </tr>
                          </thead>
                          <tbody>
                            {categoryEntries.length === 0 ? (
                              <tr>
                                <td colSpan={4} style={{ textAlign: "center", color: "#94A3B8", padding: 20 }}>
                                  Belum ada riwayat pengerjaan jahit yang diselesaikan
                                </td>
                              </tr>
                            ) : (
                              categoryEntries.map(([kat, b], idx) => (
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
                                    {b.pcs.toLocaleString()} pcs
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
                                  TOTAL ESTIMASI GAJI
                                </td>
                                <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 900, color: "#166534", fontSize: 14 }}>
                                  {v.totalPcs.toLocaleString()} pcs
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
                          <FileText size={15} color="#7C3AED" /> Pengerjaan PO Produksi Terkait
                        </div>
                        <div style={{ border: "1px solid #E2E8F0", borderRadius: 10, overflow: "hidden" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                            <thead>
                              <tr style={{ background: "#F1F5F9", textAlign: "left", color: "#475569" }}>
                                <th style={{ padding: "8px 12px" }}>No. PO</th>
                                <th style={{ padding: "8px 12px" }}>Model</th>
                                <th style={{ padding: "8px 12px", textAlign: "right" }}>Target Terbit</th>
                                <th style={{ padding: "8px 12px", textAlign: "right" }}>Pcs Selesai</th>
                                <th style={{ padding: "8px 12px", textAlign: "right" }}>Tarif</th>
                                <th style={{ padding: "8px 12px", textAlign: "right" }}>Estimasi Upah</th>
                                <th style={{ padding: "8px 12px", textAlign: "center" }}>Aksi</th>
                              </tr>
                            </thead>
                            <tbody>
                              {v.poBreakdown.map((item: any, idx: number) => (
                                <tr key={idx} style={{ borderBottom: "1px solid #F1F5F9" }}>
                                  <td style={{ padding: "8px 12px", fontWeight: 900, fontFamily: "monospace", color: "#1D4ED8" }}>
                                    {item.noPo}
                                  </td>
                                  <td style={{ padding: "8px 12px", fontWeight: 700 }}>{item.model}</td>
                                  <td style={{ padding: "8px 12px", textAlign: "right" }}>{item.targetPcs} pcs</td>
                                  <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 800, color: "#2563EB" }}>
                                    {item.pcsSelesai} pcs
                                  </td>
                                  <td style={{ padding: "8px 12px", textAlign: "right" }}>{formatRp(item.tarif)}</td>
                                  <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 800, color: "#059669" }}>
                                    {formatRp(item.subtotal)}
                                  </td>
                                  <td style={{ padding: "8px 12px", textAlign: "center" }}>
                                    <Link
                                      href={`/daftar-spk?search=${encodeURIComponent(item.noPo)}`}
                                      style={{ color: "#2563EB", fontWeight: 700, textDecoration: "underline", fontSize: 11 }}
                                    >
                                      Buka PO →
                                    </Link>
                                  </td>
                                </tr>
                              ))}
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
                                <th style={{ padding: "8px 12px" }}>Metode</th>
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
                                    {g.noPo || (g.poId ? `PO #${g.poId}` : "—")}
                                  </td>
                                  <td style={{ padding: "8px 12px" }}>{g.metode || "Transfer Bank"}</td>
                                  <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700 }}>
                                    {(g.jumlahPcs || 0).toLocaleString()} pcs
                                  </td>
                                  <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 800, color: "#059669" }}>
                                    {formatRp(g.totalGaji)}
                                  </td>
                                  <td style={{ padding: "8px 12px", textAlign: "center" }}>
                                    <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#D1FAE5", color: "#065F46", fontWeight: 700 }}>
                                      {g.status || "Lunas"}
                                    </span>
                                  </td>
                                  <td style={{ padding: "8px 12px", textAlign: "center" }}>
                                    <button
                                      onClick={() => handleDeleteGaji(g.id)}
                                      style={{ border: "none", background: "none", cursor: "pointer", color: "#DC2626", padding: 2 }}
                                      title="Hapus riwayat payout ini"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr style={{ background: "#EFF6FF", borderTop: "1px solid #BFDBFE" }}>
                                <td colSpan={4} style={{ padding: "10px 12px", fontWeight: 800, color: "#1E40AF" }}>
                                  TOTAL GAJI TERCATAT DICAIRKAN
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
              <CheckCircle2 size={20} color="#10B981" /> REKAPITULASI TOTAL SELURUH UPAH CMT
            </div>
            <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
              Dihitung dari seluruh alokasi output potongan jahit yang telah diselesaikan.
            </div>
          </div>

          <div style={{ display: "flex", gap: 32, alignItems: "center" }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Total Output Selesai</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#2563EB", lineHeight: 1.1 }}>
                {stats.totalPcsAll.toLocaleString()} <span style={{ fontSize: 12, color: "#94A3B8" }}>pcs</span>
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Total Estimasi Upah</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#059669", lineHeight: 1.1 }}>
                {formatRp(stats.totalEstimasiGajiAll)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL CATAT PEMBAYARAN GAJI (CRUD POST) ────────────────────────── */}
      {showBayarModal && (
        <div className="modal-overlay" onClick={() => setShowBayarModal(false)} style={{ zIndex: 9999 }}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 520, padding: 0, overflow: "hidden" }}>
            
            {/* Header */}
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #E2E8F0", background: "linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: "#10B981", color: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <CreditCard size={20} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontWeight: 900, fontSize: 17, color: "#065F46" }}>
                    Catat Pembayaran Upah / Gaji CMT
                  </h2>
                  <div style={{ fontSize: 12, color: "#047857", marginTop: 2 }}>
                    Pencatatan realisasi transfer atau pembayaran honor jahit vendor.
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
                  Pilih Mitra CMT <span style={{ color: "#EF4444" }}>*</span>
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
                      totalGaji: v ? String(v.sisaGaji > 0 ? v.sisaGaji : v.estimasiGaji) : f.totalGaji,
                      jumlahPcs: v ? String(v.totalPcs) : f.jumlahPcs
                    }));
                  }}
                >
                  <option value="">-- Pilih Vendor CMT --</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.nama} {v.kodeVendor ? `(${v.kodeVendor})` : ""}
                    </option>
                  ))}
                </select>
              </div>

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
                      placeholder="Contoh: 4000000"
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
                    placeholder="Contoh: 800"
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

      {/* ─── MODAL CETAK SLIP GAJI RESMI ────────────────────────────────────── */}
      {slipModalVendor && (
        <div className="modal-overlay" onClick={() => setSlipModalVendor(null)} style={{ zIndex: 9999 }}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 640, padding: 0, overflow: "hidden" }}>
            
            {/* Header */}
            <div className="no-print" style={{ padding: "18px 24px", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#0F172A", display: "flex", alignItems: "center", gap: 8 }}>
                <Receipt size={18} color="#2563EB" /> Pratinjau Slip Gaji Resmi CMT
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => window.print()}
                  className="btn btn-primary"
                  style={{ padding: "6px 14px", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}
                >
                  <Printer size={14} /> Cetak Slip
                </button>
                <button onClick={() => setSlipModalVendor(null)} style={{ background: "white", border: "1px solid #CBD5E1", width: 32, height: 32, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Printable Slip Content */}
            <div style={{ padding: "32px", background: "white", color: "#0F172A" }}>
              {/* Slip Kop */}
              <div style={{ borderBottom: "2px solid #0F172A", paddingBottom: 16, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, letterSpacing: -0.5 }}>TIRTA BINTANG JEANS</h3>
                  <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>Spesialis Denim & Celana Jeans Konveksi</div>
                  <div style={{ fontSize: 11, color: "#64748B" }}>Divisi Penggajian & Pembayaran CMT</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 14, fontWeight: 900, color: "#2563EB" }}>SLIP UPAH JAHIT CMT</div>
                  <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>Tanggal: {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</div>
                </div>
              </div>

              {/* Vendor Info */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, background: "#F8FAFC", padding: 14, borderRadius: 10, marginBottom: 20, fontSize: 12 }}>
                <div>
                  <div style={{ color: "#64748B" }}>Nama Penerima:</div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: "#0F172A", marginTop: 2 }}>{slipModalVendor.nama}</div>
                  <div style={{ color: "#64748B", marginTop: 2 }}>Kode: {slipModalVendor.kodeVendor || `CMT-${slipModalVendor.id}`}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: "#64748B" }}>Status Pekerjaan:</div>
                  <div style={{ fontWeight: 800, color: "#059669", marginTop: 2 }}>Terverifikasi Selesai</div>
                  <div style={{ color: "#64748B", marginTop: 2 }}>Kontak: {slipModalVendor.kontak || "—"}</div>
                </div>
              </div>

              {/* Items Table */}
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 20 }}>
                <thead>
                  <tr style={{ borderBottom: "1.5px solid #CBD5E1", textAlign: "left", color: "#475569" }}>
                    <th style={{ padding: "8px 6px" }}>Rincian Pekerjaan / Model</th>
                    <th style={{ padding: "8px 6px", textAlign: "right" }}>Tarif Satuan</th>
                    <th style={{ padding: "8px 6px", textAlign: "right" }}>Volume (Pcs)</th>
                    <th style={{ padding: "8px 6px", textAlign: "right" }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(slipModalVendor.categoryBreakdown).map(([kat, b]: any) => (
                    <tr key={kat} style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <td style={{ padding: "8px 6px", fontWeight: 700 }}>{kat}</td>
                      <td style={{ padding: "8px 6px", textAlign: "right" }}>{formatRp(b.tarif)}</td>
                      <td style={{ padding: "8px 6px", textAlign: "right", fontWeight: 800 }}>{b.pcs} pcs</td>
                      <td style={{ padding: "8px 6px", textAlign: "right", fontWeight: 800 }}>{formatRp(b.gaji)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid #0F172A" }}>
                    <td colSpan={2} style={{ padding: "10px 6px", fontWeight: 900 }}>TOTAL PENERIMAAN UPAH</td>
                    <td style={{ padding: "10px 6px", textAlign: "right", fontWeight: 900, color: "#2563EB" }}>
                      {slipModalVendor.totalPcs} pcs
                    </td>
                    <td style={{ padding: "10px 6px", textAlign: "right", fontWeight: 900, fontSize: 14, color: "#059669" }}>
                      {formatRp(slipModalVendor.estimasiGaji)}
                    </td>
                  </tr>
                </tfoot>
              </table>

              {/* Signatures */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 30, marginTop: 40, textAlign: "center", fontSize: 12 }}>
                <div>
                  <div style={{ color: "#64748B", marginBottom: 50 }}>Penerima / Mitra CMT,</div>
                  <div style={{ fontWeight: 800, borderTop: "1px solid #CBD5E1", paddingTop: 4, width: 180, margin: "0 auto" }}>
                    {slipModalVendor.nama}
                  </div>
                </div>
                <div>
                  <div style={{ color: "#64748B", marginBottom: 50 }}>Administrasi Keuangan,</div>
                  <div style={{ fontWeight: 800, borderTop: "1px solid #CBD5E1", paddingTop: 4, width: 180, margin: "0 auto" }}>
                    Tirta Bintang Jeans
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
