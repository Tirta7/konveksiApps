"use client";
import React, { useEffect, useState, useMemo } from "react";
import {
  Search,
  Printer,
  CheckCircle2,
  Clock,
  Plus,
  QrCode,
  FileText,
  Activity,
  Zap,
  Scissors,
  Droplets,
  ExternalLink,
  ChevronRight,
  Eye,
  Filter,
  Layers,
  ArrowRight,
  Calendar,
  Phone,
  Package,
  Check,
  AlertCircle,
  X,
  Sparkles,
  Building2,
  RefreshCw
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

function formatTgl(str: string) {
  if (!str) return "-";
  return new Date(str).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export default function DaftarSPKPage() {
  const [list, setList] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Semua");
  const [vendorFilter, setVendorFilter] = useState("Semua");
  const [sortBy, setSortBy] = useState<"terbaru" | "terlama" | "qty">("terbaru");

  // Detail Modal State
  const [selectedPoId, setSelectedPoId] = useState<number | null>(null);
  const [detailData, setDetailData] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const loadData = async () => {
    try {
      const [resPO, resVendors] = await Promise.all([
        fetch("/api/po-produksi?_t=" + Date.now()),
        fetch("/api/vendors?_t=" + Date.now())
      ]);
      const poData = await resPO.json();
      const vendorData = await resVendors.json();
      setList(Array.isArray(poData) ? poData : []);
      setVendors(Array.isArray(vendorData) ? vendorData : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    loadData(); 
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, []);

  // Real-time sync: auto-refresh when another admin makes a change
  useEffect(() => {
    const handler = () => loadData();
    window.addEventListener("konveksi-sync", handler);
    return () => window.removeEventListener("konveksi-sync", handler);
  }, []);

  // Open Detail Modal & Fetch Deep PO Info
  const openDetail = async (poId: number) => {
    setSelectedPoId(poId);
    setLoadingDetail(true);
    setDetailData(null);
    try {
      const res = await fetch(`/api/po-detail?poId=${poId}&_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        setDetailData(data);
      } else {
        toast.error("Gagal memuat detail PO");
      }
    } catch {
      toast.error("Terjadi kesalahan memuat detail PO");
    } finally {
      setLoadingDetail(false);
    }
  };

  const getVendor = (id: number) => {
    return vendors.find(v => v.id === id);
  };

  const getVendorName = (id: number) => {
    const v = getVendor(id);
    return v ? v.nama : `Vendor #${id}`;
  };

  // KPIs
  const totalPO = list.length;
  const totalQtyPcs = list.reduce((sum, po) => sum + (Number(po.jumlahTerbit) || 0), 0);
  const prosesCount = list.filter(po => {
    const pct = Math.round((po.totalDiambil / po.jumlahTerbit) * 100);
    return po.status !== "Closed" && (pct > 0 || (po.totalDilaporkan || 0) > 0);
  }).length;
  const pendingCount = list.filter(po => {
    const pct = Math.round((po.totalDiambil / po.jumlahTerbit) * 100);
    return po.status !== "Closed" && pct === 0 && !(po.totalDilaporkan > 0);
  }).length;
  const selesaiCount = list.filter(po => po.status === "Closed" || po.status === "Selesai").length;

  // Filter & Sort
  const filtered = useMemo(() => {
    return list.filter(po => {
      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const vName = getVendorName(po.vendorId).toLowerCase();
        const matchPo = (po.noPo || "").toLowerCase().includes(q);
        const matchModel = (po.model || "").toLowerCase().includes(q);
        const matchCatatan = (po.catatan || "").toLowerCase().includes(q);
        const matchVendor = vName.includes(q);
        if (!matchPo && !matchModel && !matchCatatan && !matchVendor) return false;
      }

      // Status
      const isClosed = po.status === "Closed" || po.status === "Selesai";
      const pct = Math.round((po.totalDiambil / po.jumlahTerbit) * 100);
      const isPending = !isClosed && pct === 0 && !(po.totalDilaporkan > 0);
      const isProses = !isClosed && !isPending;

      if (statusFilter === "Proses" && !isProses) return false;
      if (statusFilter === "Pending" && !isPending) return false;
      if (statusFilter === "Selesai" && !isClosed) return false;

      // Vendor
      if (vendorFilter !== "Semua" && String(po.vendorId) !== String(vendorFilter)) return false;

      return true;
    }).sort((a, b) => {
      if (sortBy === "terlama") return new Date(a.tanggalTerbit).getTime() - new Date(b.tanggalTerbit).getTime();
      if (sortBy === "qty") return (b.jumlahTerbit || 0) - (a.jumlahTerbit || 0);
      return new Date(b.tanggalTerbit).getTime() - new Date(a.tanggalTerbit).getTime();
    });
  }, [list, search, statusFilter, vendorFilter, sortBy, vendors]);

  return (
    <div style={{ padding: "32px 32px 48px 32px", background: "var(--bg-app)", minHeight: "100%", overflowY: "auto", overflowX: "hidden" }}>
      
      {/* ─── PAGE HEADER ─────────────────────────────────────────────────── */}
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <h1 className="page-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
              Daftar PO Produksi
            </h1>
            <span style={{ background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)", color: "white", fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 800, letterSpacing: 0.5 }}>
              LEDGER & SPK
            </span>
          </div>
          <p className="page-subtitle" style={{ margin: 0 }}>
            Seluruh riwayat Purchase Order yang diterbitkan ke CMT, status pengerjaan, tracking barcode, dan alur downstream.
          </p>
        </div>

        {/* QUICK SHORTCUT HUBS */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/buat-spk" className="btn btn-primary" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 800, boxShadow: "0 4px 14px rgba(37,99,235,0.3)" }}>
            <Plus size={16} /> Buat PO Baru
          </Link>
          <Link href="/barcode-produksi" className="btn btn-secondary" style={{ background: "white", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <QrCode size={14} color="#2563EB" /> Barcode Produksi
          </Link>
          <Link href="/dashboard-cmt" className="btn btn-secondary" style={{ background: "white", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <Activity size={14} color="#7C3AED" /> Dashboard CMT
          </Link>
          <Link href="/alur-produksi" className="btn btn-secondary" style={{ background: "white", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <Zap size={14} color="#D97706" /> Alur Produksi
          </Link>
          <Link href="/pemotongan-kain" className="btn btn-secondary" style={{ background: "white", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <Scissors size={14} color="#059669" /> Pemotongan Kain
          </Link>
        </div>
      </div>

      {/* ─── STAT KPI SUMMARY CARDS ─────────────────────────────────────────── */}
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        {/* Card 1 */}
        <div className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span className="stat-label">Total PO Diterbitkan</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#EFF6FF", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FileText size={18} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#0F172A", lineHeight: 1 }}>{totalPO}</div>
            <span style={{ fontSize: 12, color: "#64748B" }}>PO terdaftar</span>
          </div>
          <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>
            Total alokasi: <strong style={{ color: "#0F172A" }}>{totalQtyPcs.toLocaleString()} pcs</strong>
          </div>
        </div>

        {/* Card 2 */}
        <div className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span className="stat-label">Sedang Diproses (Aktif)</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#F0F9FF", color: "#0284C7", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Zap size={18} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#0284C7", lineHeight: 1 }}>{prosesCount}</div>
            <span style={{ fontSize: 12, color: "#64748B" }}>PO berjalan</span>
          </div>
          <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>
            Sedang dikerjakan CMT / Washing
          </div>
        </div>

        {/* Card 3 */}
        <div className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span className="stat-label">Menunggu Pengerjaan</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#FFFBEB", color: "#D97706", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Clock size={18} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#D97706", lineHeight: 1 }}>{pendingCount}</div>
            <span style={{ fontSize: 12, color: "#64748B" }}>PO belum lapor</span>
          </div>
          <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>
            Menunggu laporan awal dari penjahit
          </div>
        </div>

        {/* Card 4 */}
        <div className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span className="stat-label">PO Selesai / Rampung</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#059669", lineHeight: 1 }}>{selesaiCount}</div>
            <span style={{ fontSize: 12, color: "#64748B" }}>PO selesai</span>
          </div>
          <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>
            {totalPO > 0 ? Math.round((selesaiCount / totalPO) * 100) : 0}% rasio penyelesaian
          </div>
        </div>
      </div>

      {/* ─── MAIN TABLE CARD & TOOLBAR ─────────────────────────────────────── */}
      <div className="card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
        
        {/* TOOLBAR */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-color)", background: "#F8FAFC", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          
          {/* Search bar */}
          <div className="search-wrapper" style={{ minWidth: 280, flex: 1, maxWidth: 420 }}>
            <Search className="search-icon" size={16} />
            <input
              type="text"
              placeholder="Cari No PO, Model, Vendor CMT, atau Catatan..."
              className="search-input"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: "100%", fontSize: 13 }}
            />
            {search && (
              <button onClick={() => setSearch("")} style={{ border: "none", background: "none", cursor: "pointer", color: "#94A3B8", padding: 4 }}>
                <X size={14} />
              </button>
            )}
          </div>

          {/* Status Filter Pills */}
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B", marginRight: 2 }}>Status:</span>
            {[
              { key: "Semua", label: "Semua", count: totalPO },
              { key: "Proses", label: "Proses", count: prosesCount },
              { key: "Pending", label: "Pending", count: pendingCount },
              { key: "Selesai", label: "Selesai", count: selesaiCount },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                  border: "none",
                  cursor: "pointer",
                  background: statusFilter === tab.key ? "#0F172A" : "#FFFFFF",
                  color: statusFilter === tab.key ? "white" : "#64748B",
                  boxShadow: statusFilter === tab.key ? "0 2px 6px rgba(15,23,42,0.2)" : "0 1px 2px rgba(0,0,0,0.05)",
                  transition: "all 0.15s"
                }}
              >
                {tab.label}
                <span style={{ marginLeft: 5, opacity: 0.8, fontSize: 11 }}>({tab.count})</span>
              </button>
            ))}
          </div>

          {/* Vendor Filter */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select
              value={vendorFilter}
              onChange={e => setVendorFilter(e.target.value)}
              style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 12, fontWeight: 600, background: "white", color: "#334155", outline: "none", cursor: "pointer" }}
            >
              <option value="Semua">Semua Vendor CMT</option>
              {vendors.filter(v => v.tipe === "cmt").map(v => (
                <option key={v.id} value={v.id}>{v.nama}</option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 12, fontWeight: 600, background: "white", color: "#334155", outline: "none", cursor: "pointer" }}
            >
              <option value="terbaru">Urutkan: Terbaru</option>
              <option value="terlama">Urutkan: Terlama</option>
              <option value="qty">Urutkan: Qty Terbanyak</option>
            </select>
          </div>
        </div>

        {/* TABLE VIEW */}
        <div style={{ overflowX: "auto" }}>
          {loading ? (
            <div style={{ padding: 60, textAlign: "center", color: "#64748B" }}>
              <RefreshCw size={32} className="spin" style={{ margin: "0 auto 12px", color: "#2563EB" }} />
              <div style={{ fontWeight: 700 }}>Memuat daftar PO Produksi...</div>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 60, textAlign: "center" }}>
              <Package size={48} style={{ color: "#CBD5E1", margin: "0 auto 16px" }} />
              <h3 style={{ margin: 0, color: "var(--text-primary)", fontWeight: 800 }}>Belum ada PO yang sesuai</h3>
              <p style={{ marginTop: 6, fontSize: 13, color: "var(--text-secondary)" }}>
                {search || statusFilter !== "Semua" || vendorFilter !== "Semua"
                  ? "Coba sesuaikan kata kunci pencarian atau reset filter."
                  : "PO yang diterbitkan ke vendor CMT akan tampil di sini."}
              </p>
              {(search || statusFilter !== "Semua" || vendorFilter !== "Semua") && (
                <button
                  onClick={() => { setSearch(""); setStatusFilter("Semua"); setVendorFilter("Semua"); }}
                  className="btn btn-secondary"
                  style={{ marginTop: 14, background: "white" }}
                >
                  Reset Semua Filter
                </button>
              )}
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F1F5F9", borderBottom: "1px solid #E2E8F0", textAlign: "left", fontSize: 12, color: "#475569" }}>
                  <th style={{ padding: "14px 20px" }}>NO. PO</th>
                  <th style={{ padding: "14px 16px" }}>MODEL & UKURAN</th>
                  <th style={{ padding: "14px 16px" }}>VENDOR / CMT</th>
                  <th style={{ padding: "14px 16px" }}>TGL TERBIT</th>
                  <th style={{ padding: "14px 20px" }}>STATUS & PROGRES LEDGER</th>
                  <th style={{ padding: "14px 20px", textAlign: "center" }}>AKSI TERHUBUNG</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(po => {
                  const pct = Math.round((po.totalDiambil / po.jumlahTerbit) * 100);
                  const isClosed = po.status === "Closed" || po.status === "Selesai";
                  const isPending = !isClosed && pct === 0 && !(po.totalDilaporkan > 0);
                  const vendor = getVendor(po.vendorId);

                  return (
                    <tr
                      key={po.id}
                      style={{ borderBottom: "1px solid #F1F5F9", transition: "background 0.15s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
                      onMouseLeave={e => e.currentTarget.style.background = "white"}
                    >
                      {/* NO. PO */}
                      <td style={{ padding: "16px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: "#EFF6FF", border: "1px solid #BFDBFE", display: "flex", alignItems: "center", justifyContent: "center", color: "#1D4ED8", fontWeight: 900, fontSize: 14 }}>
                            {po.noPo?.split("-")[0] || "PO"}
                          </div>
                          <div>
                            <button
                              onClick={() => openDetail(po.id)}
                              style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", fontWeight: 900, fontFamily: "monospace", fontSize: 15, color: "#1D4ED8", display: "flex", alignItems: "center", gap: 4 }}
                              title="Klik untuk melihat detail lengkap PO"
                            >
                              {po.noPo} <ChevronRight size={13} style={{ opacity: 0.6 }} />
                            </button>
                            <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>ID #{po.id}</div>
                          </div>
                        </div>
                      </td>

                      {/* MODEL & SIZE BREAKDOWN */}
                      <td style={{ padding: "16px 16px" }}>
                        <div style={{ fontWeight: 800, color: "#0F172A", fontSize: 14 }}>{po.model}</div>
                        <div style={{ fontSize: 12, color: "#2563EB", fontWeight: 700, marginTop: 2 }}>
                          Total: {po.jumlahTerbit} pcs
                        </div>
                        {/* Size badges */}
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                          {(po.sizeBreakdown || []).slice(0, 5).map((s: any, idx: number) => (
                            <span key={idx} style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "#F1F5F9", color: "#475569", border: "1px solid #E2E8F0" }}>
                              {s.size}:{s.jumlah}
                            </span>
                          ))}
                          {(po.sizeBreakdown || []).length > 5 && (
                            <span style={{ fontSize: 10, color: "#94A3B8" }}>+{(po.sizeBreakdown || []).length - 5}</span>
                          )}
                        </div>
                      </td>

                      {/* VENDOR CMT */}
                      <td style={{ padding: "16px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#EFF6FF", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800 }}>
                            {getVendorName(po.vendorId).charAt(0)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, color: "#0F172A", fontSize: 13 }}>
                              {getVendorName(po.vendorId)}
                            </div>
                            <div style={{ fontSize: 11, color: "#64748B", display: "flex", gap: 6, alignItems: "center", marginTop: 2 }}>
                              <a
                                href={`/cmt/${po.vendorId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: "#2563EB", textDecoration: "none", fontWeight: 600, display: "flex", alignItems: "center", gap: 3 }}
                              >
                                <ExternalLink size={10} /> Portal CMT
                              </a>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* TGL TERBIT */}
                      <td style={{ padding: "16px 16px" }}>
                        <div style={{ color: "#334155", fontWeight: 600, fontSize: 13 }}>{formatTgl(po.tanggalTerbit)}</div>
                        {po.target_selesai && (
                          <div style={{ fontSize: 10, color: "#D97706", fontWeight: 700, marginTop: 4, display: "flex", alignItems: "center", gap: 3 }}>
                            <Calendar size={10} /> Target: {formatTgl(po.target_selesai)}
                          </div>
                        )}
                      </td>

                      {/* STATUS & MULTI-STAGE PROGRESS BAR */}
                      <td style={{ padding: "16px 20px", minWidth: 260 }}>
                        {isClosed ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div className="badge success" style={{ background: "#D1FAE5", color: "#065F46", padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <CheckCircle2 size={13} /> Selesai / Closed
                            </div>
                            <span style={{ fontSize: 11, color: "#059669", fontWeight: 700 }}>100% tuntas</span>
                          </div>
                        ) : isPending ? (
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                              <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 20, background: "#FEF3C7", color: "#92400E", border: "1px solid #FCD34D", display: "inline-flex", alignItems: "center", gap: 4 }}>
                                <Clock size={11} /> Pending
                              </span>
                              <span style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8" }}>Belum dikerjakan</span>
                            </div>
                            <div style={{ width: "100%", background: "#E2E8F0", height: 6, borderRadius: 99 }}>
                              <div style={{ background: "#F59E0B", height: "100%", width: "0%" }} />
                            </div>
                          </div>
                        ) : (
                          <div>
                            {/* Stage Badges */}
                            <div style={{ display: "flex", gap: 5, marginBottom: 6, flexWrap: "wrap", alignItems: "center" }}>
                              <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 10, background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE", display: "inline-flex", alignItems: "center", gap: 3 }}>
                                <Zap size={10} /> Proses
                              </span>
                              {(po.totalDilaporkan || 0) > 0 && (
                                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10, background: "#FEF3C7", color: "#92400E" }}>
                                  {po.totalDilaporkan} dilaporkan
                                </span>
                              )}
                              {(po.totalDisetujui || 0) > 0 && (
                                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10, background: "#DCFCE7", color: "#166534" }}>
                                  {po.totalDisetujui} disetujui
                                </span>
                              )}
                              {(po.washingKirim || 0) > 0 && (
                                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10, background: (po.washingACC || 0) > 0 ? "#CFFAFE" : "#E0F2FE", color: (po.washingACC || 0) > 0 ? "#0E7490" : "#0369A1" }}>
                                  {po.washingACC > 0 ? `${po.washingACC} washing selesai` : `${po.washingKirim} di washing`}
                                </span>
                              )}
                            </div>

                            {/* Multi-stage Progress Bar */}
                            <div style={{ width: "100%", background: "#E2E8F0", height: 8, borderRadius: 99, overflow: "hidden", position: "relative" }}>
                              {/* Washing ACC (Cyan) */}
                              <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${Math.min(po.pctWashingACC || 0, 100)}%`, background: "#06B6D4", borderRadius: 99 }} />
                              {/* Washing Proses (Light Cyan) */}
                              <div style={{ position: "absolute", left: `${po.pctWashingACC || 0}%`, top: 0, height: "100%", width: `${Math.min((po.pctWashing || 0) - (po.pctWashingACC || 0), 100)}%`, background: "#A5F3FC", borderRadius: 99 }} />
                              {/* CMT Approved (Green) */}
                              <div style={{ position: "absolute", left: `${po.pctWashing || 0}%`, top: 0, height: "100%", width: `${Math.min(Math.max((po.pctDisetujui || 0) - (po.pctWashing || 0), 0), 100)}%`, background: "#10B981", borderRadius: 99 }} />
                              {/* CMT Pending Report (Amber) */}
                              <div style={{ position: "absolute", left: `${Math.max(po.pctDisetujui || 0, po.pctWashing || 0)}%`, top: 0, height: "100%", width: `${Math.min(Math.max((po.pctCmt || 0) - Math.max(po.pctDisetujui || 0, po.pctWashing || 0), 0), 100)}%`, background: "#F59E0B", borderRadius: 99 }} />
                            </div>

                            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                              <div style={{ fontSize: 10, color: "#64748B" }}>{po.totalDilaporkan || 0} / {po.jumlahTerbit} pcs</div>
                              <div style={{ fontSize: 10, fontWeight: 700, color: "#1E293B" }}>
                                {(po.pctWashingACC || 0) > 0 ? `${po.pctWashingACC}% washing` : `${po.pctCmt || 0}% progres`}
                              </div>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* AKSI TERHUBUNG */}
                      <td style={{ padding: "16px 20px", textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "center", alignItems: "center" }}>
                          
                          {/* DETAIL BUTTON */}
                          <button
                            onClick={() => openDetail(po.id)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: "6px 10px", fontSize: 11, background: "white", display: "inline-flex", alignItems: "center", gap: 4 }}
                            title="Buka rincian lengkap & riwayat perjalanan PO"
                          >
                            <Eye size={13} color="#2563EB" /> Detail
                          </button>

                          {/* BARCODE BUTTON */}
                          <Link
                            href={`/barcode-produksi?po=${encodeURIComponent(po.noPo)}`}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: "6px 10px", fontSize: 11, background: "white", display: "inline-flex", alignItems: "center", gap: 4 }}
                            title="Cetak & pantau barcode bundle produksi"
                          >
                            <QrCode size={13} color="#7C3AED" /> Barcode
                          </Link>

                          {/* CETAK PO BUTTON */}
                          <Link
                            href={`/cetak-po/${po.id}`}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: "6px 10px", fontSize: 11, background: "white", display: "inline-flex", alignItems: "center", gap: 4 }}
                            title="Cetak Surat Jalan PO (Dot Matrix & PDF)"
                          >
                            <Printer size={13} color="#059669" /> Cetak
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ─── MODAL DETAIL PO PRODUKSI (DEEP CONNECTIVITY) ───────────────────── */}
      {selectedPoId && (
        <div className="modal-overlay" onClick={() => setSelectedPoId(null)} style={{ zIndex: 1000 }}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 760, maxHeight: "90vh", display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
            
            {/* Modal Header */}
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #E2E8F0", background: "linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "#2563EB", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 16 }}>
                  PO
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#0F172A", fontFamily: "monospace" }}>
                      {detailData ? detailData.noPo : `PO #${selectedPoId}`}
                    </h2>
                    {detailData && (
                      <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 12, background: detailData.status === "Closed" ? "#D1FAE5" : "#EFF6FF", color: detailData.status === "Closed" ? "#065F46" : "#1D4ED8" }}>
                        {detailData.status}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
                    Model: <strong>{detailData?.model || "—"}</strong> · Terbit: {formatTgl(detailData?.tanggalTerbit)}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedPoId(null)}
                style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: "50%", width: 36, height: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B" }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
              {loadingDetail ? (
                <div style={{ padding: 40, textAlign: "center", color: "#64748B" }}>
                  <RefreshCw size={28} className="spin" style={{ margin: "0 auto 10px", color: "#2563EB" }} />
                  <div>Memuat data lengkap PO...</div>
                </div>
              ) : !detailData ? (
                <div style={{ textAlign: "center", padding: 30, color: "#EF4444" }}>Gagal memuat rincian data PO</div>
              ) : (
                <>
                  {/* SUMMARY CARDS IN MODAL */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                    <div style={{ background: "#F8FAFC", padding: 14, borderRadius: 12, border: "1px solid #E2E8F0" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Vendor Penjahit</div>
                      <div style={{ fontWeight: 800, fontSize: 14, color: "#0F172A", marginTop: 4 }}>
                        {detailData.vendorCMT?.nama || "—"}
                      </div>
                      <a
                        href={`/cmt/${detailData.vendorCMT?.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 11, color: "#2563EB", fontWeight: 700, textDecoration: "underline", display: "inline-flex", alignItems: "center", gap: 3, marginTop: 4 }}
                      >
                        <ExternalLink size={10} /> Buka Portal
                      </a>
                    </div>

                    <div style={{ background: "#F8FAFC", padding: 14, borderRadius: 12, border: "1px solid #E2E8F0" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Total Quantity</div>
                      <div style={{ fontWeight: 900, fontSize: 18, color: "#2563EB", marginTop: 2 }}>
                        {detailData.jumlahTerbit} <span style={{ fontSize: 12, fontWeight: 600, color: "#64748B" }}>pcs</span>
                      </div>
                      <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                        Dilaporkan: <strong style={{ color: "#10B981" }}>{detailData.stats?.totalDilaporkan || 0} pcs</strong>
                      </div>
                    </div>

                    <div style={{ background: "#F8FAFC", padding: 14, borderRadius: 12, border: "1px solid #E2E8F0" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Asal Stok Potongan</div>
                      <div style={{ fontWeight: 800, fontSize: 13, color: "#0F172A", marginTop: 4 }}>
                        {detailData.pemotongan?.nama_barang || "Potongan Kain"}
                      </div>
                      <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                        Tukang: <strong>{detailData.pemotongan?.tukang?.nama || "—"} ({detailData.pemotongan?.tukang?.kode || "—"})</strong>
                      </div>
                    </div>
                  </div>

                  {/* SIZE BREAKDOWN TABLE */}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                      <Layers size={14} color="#2563EB" /> Alokasi Ukuran & Progres Jahit
                    </div>
                    <div style={{ border: "1px solid #E2E8F0", borderRadius: 10, overflow: "hidden" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: "#F1F5F9", textAlign: "left", color: "#475569" }}>
                            <th style={{ padding: "8px 14px" }}>Size</th>
                            <th style={{ padding: "8px 14px", textAlign: "center" }}>Target Terbit</th>
                            <th style={{ padding: "8px 14px", textAlign: "center" }}>Dilaporkan CMT</th>
                            <th style={{ padding: "8px 14px", textAlign: "center" }}>Status Selesai</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(detailData.sizeBreakdown || []).map((s: any, idx: number) => {
                            // Find reported count for this size
                            const reported = (detailData.cmtRecords || []).reduce((sum: number, rec: any) => {
                              const it = (rec.items || []).find((i: any) => i.size === s.size);
                              return sum + (it ? Number(it.jumlah || 0) : 0);
                            }, 0);
                            const done = reported >= s.jumlah;

                            return (
                              <tr key={idx} style={{ borderBottom: "1px solid #F1F5F9" }}>
                                <td style={{ padding: "8px 14px", fontWeight: 800, color: "#0F172A" }}>{s.size}</td>
                                <td style={{ padding: "8px 14px", textAlign: "center", fontWeight: 700 }}>{s.jumlah} pcs</td>
                                <td style={{ padding: "8px 14px", textAlign: "center", color: reported > 0 ? "#10B981" : "#94A3B8", fontWeight: 700 }}>
                                  {reported} pcs
                                </td>
                                <td style={{ padding: "8px 14px", textAlign: "center" }}>
                                  {done ? (
                                    <span style={{ fontSize: 10, background: "#D1FAE5", color: "#065F46", padding: "2px 8px", borderRadius: 6, fontWeight: 700 }}>
                                      Lengkap
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: 10, background: "#FEF3C7", color: "#92400E", padding: "2px 8px", borderRadius: 6, fontWeight: 700 }}>
                                      Kurang {Math.max(0, s.jumlah - reported)} pcs
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* DOWNSTREAM / WASHING TRANSFERS */}
                  {(detailData.transfers || []).length > 0 && (
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                        <Droplets size={14} color="#0891B2" /> Riwayat Transfer Downstream (Washing / Gudang)
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {detailData.transfers.map((tf: any) => (
                          <div key={tf.id} style={{ background: "#F8FAFC", padding: 12, borderRadius: 10, border: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: 13, color: "#0F172A" }}>
                                Ke: {tf.vendor_ke_nama} ({tf.ke?.toUpperCase()})
                              </div>
                              <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                                Tanggal: {formatTgl(tf.tanggal_kirim)} · Catatan: {tf.catatan || "—"}
                              </div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontWeight: 900, color: "#0891B2", fontSize: 14 }}>{tf.jumlah_kirim} pcs</div>
                              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: tf.status === "Diterima" || tf.status === "Diverifikasi" ? "#D1FAE5" : "#E0F2FE", color: tf.status === "Diterima" || tf.status === "Diverifikasi" ? "#065F46" : "#0369A1" }}>
                                {tf.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* CATATAN PO */}
                  {detailData.catatan && (
                    <div style={{ background: "#F8FAFC", padding: 12, borderRadius: 10, border: "1px solid #E2E8F0", fontSize: 12 }}>
                      <strong style={{ color: "#334155" }}>Catatan Tambahan PO:</strong> {detailData.catatan}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer with Direct Connected Navigation */}
            <div style={{ padding: "16px 24px", borderTop: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", gap: 8 }}>
                {detailData && (
                  <>
                    <Link
                      href={`/cetak-po/${detailData.id}`}
                      className="btn btn-secondary"
                      style={{ fontSize: 12, background: "white", display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      <Printer size={14} color="#059669" /> Cetak Surat Jalan
                    </Link>
                    <Link
                      href={`/barcode-produksi?po=${encodeURIComponent(detailData.noPo)}`}
                      className="btn btn-secondary"
                      style={{ fontSize: 12, background: "white", display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      <QrCode size={14} color="#7C3AED" /> Cetak Barcode
                    </Link>
                    <Link
                      href="/dashboard-cmt"
                      className="btn btn-secondary"
                      style={{ fontSize: 12, background: "white", display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      <Activity size={14} color="#2563EB" /> Dashboard CMT
                    </Link>
                  </>
                )}
              </div>

              <button onClick={() => setSelectedPoId(null)} className="btn btn-secondary" style={{ background: "white" }}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
