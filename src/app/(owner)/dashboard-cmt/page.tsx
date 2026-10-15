"use client";
import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Users,
  Package,
  Zap,
  Droplets,
  Scissors,
  CheckCircle2,
  Clock,
  ArrowRight,
  ExternalLink,
  Search,
  RefreshCw,
  Layers,
  MessageSquare,
  Building2,
  AlertCircle,
  Truck,
  Check,
  Sparkles,
  DollarSign
} from "lucide-react";

function formatRp(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

const CATEGORY_THEME: Record<string, {
  label: string;
  icon: any;
  color: string;
  gradFrom: string;
  gradTo: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}> = {
  cmt: {
    label: "Vendor CMT / Penjahit",
    icon: Zap,
    color: "#2563EB",
    gradFrom: "#1E3A8A",
    gradTo: "#2563EB",
    badgeBg: "#EFF6FF",
    badgeText: "#1D4ED8",
    badgeBorder: "#BFDBFE"
  },
  washing: {
    label: "Vendor Washing / Laundry",
    icon: Droplets,
    color: "#0284C7",
    gradFrom: "#0C4A6E",
    gradTo: "#0284C7",
    badgeBg: "#F0F9FF",
    badgeText: "#0369A1",
    badgeBorder: "#BAE6FD"
  },
  benang: {
    label: "Vendor Bersih Benang",
    icon: Scissors,
    color: "#7C3AED",
    gradFrom: "#4C1D95",
    gradTo: "#7C3AED",
    badgeBg: "#FAF5FF",
    badgeText: "#6D28D9",
    badgeBorder: "#E9D5FF"
  },
  finishing: {
    label: "Vendor Finishing / QC",
    icon: CheckCircle2,
    color: "#059669",
    gradFrom: "#064E3B",
    gradTo: "#059669",
    badgeBg: "#ECFDF5",
    badgeText: "#047857",
    badgeBorder: "#A7F3D0"
  },
  lainnya: {
    label: "Vendor Lainnya",
    icon: Building2,
    color: "#475569",
    gradFrom: "#1E293B",
    gradTo: "#475569",
    badgeBg: "#F8FAFC",
    badgeText: "#334155",
    badgeBorder: "#E2E8F0"
  }
};

export default function DashboardCMTPage() {
  const [vendorLedgers, setVendorLedgers] = useState<any[]>([]);
  const [allVendors, setAllVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pulse, setPulse] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [activePo, setActivePo] = useState<any>(null);
  const [tarikForm, setTarikForm] = useState({ ke_vendor_id: "", catatan: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    try {
      const res = await fetch("/api/dashboard-ledger?_t=" + Date.now());
      const data = await res.json();
      setVendorLedgers(data.vendorLedgers || []);
      setAllVendors(data.allVendors || []);
      setPulse(true);
      setTimeout(() => setPulse(false), 500);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = () => loadData();
    window.addEventListener("konveksi-sync", handler);
    return () => window.removeEventListener("konveksi-sync", handler);
  }, []);

  const handleTarikBarang = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePo || !tarikForm.ke_vendor_id) return;
    const jumlahTarik = activePo.po.totalDisetujui || 0;
    if (jumlahTarik === 0) {
      alert("Belum ada laporan jahitan yang di-ACC mandor.");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/tarik-barang", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          poId: activePo.po.id,
          dari_vendor_id: activePo.dari_vendor_id,
          ke_vendor_id: tarikForm.ke_vendor_id,
          jumlah: jumlahTarik,
          sizeBreakdown: activePo.po.sizeProgress,
          catatan: tarikForm.catatan
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      alert(`Berhasil menarik ${jumlahTarik} pcs dari PO ${activePo.po.noPo}`);
      setActivePo(null);
      setTarikForm({ ke_vendor_id: "", catatan: "" });
      loadData();
    } catch (err: any) {
      alert(err.message || "Gagal melakukan penarikan barang.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Grouping and filtering
  const filteredVendors = useMemo(() => {
    return vendorLedgers.filter((v) => {
      // Category filter
      if (selectedCategory !== "all") {
        const tipe = v.tipe || "lainnya";
        if (selectedCategory === "cmt" && tipe !== "cmt") return false;
        if (selectedCategory === "washing" && tipe !== "washing") return false;
        if (selectedCategory === "benang" && tipe !== "benang") return false;
        if (selectedCategory === "finishing" && tipe !== "finishing") return false;
        if (selectedCategory === "lainnya" && (tipe === "cmt" || tipe === "washing" || tipe === "benang" || tipe === "finishing")) return false;
      }

      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchName = (v.nama || "").toLowerCase().includes(q);
      const matchCode = (v.kodeVendor || "").toLowerCase().includes(q);
      const matchPo = (v.poList || []).some((p: any) =>
        (p.noPo || "").toLowerCase().includes(q) || (p.model || "").toLowerCase().includes(q)
      );

      return matchName || matchCode || matchPo;
    });
  }, [vendorLedgers, selectedCategory, searchQuery]);

  // Global KPIs
  const globalStats = useMemo(() => {
    let totalFisik = 0;
    let totalPoAktif = 0;
    let totalSiapTarik = 0;
    let totalPending = 0;

    vendorLedgers.forEach((v) => {
      totalFisik += v.totalSisa || 0;
      (v.poList || []).forEach((p: any) => {
        totalPoAktif += 1;
        totalSiapTarik += p.totalDisetujui || 0;
        totalPending += p.totalPending || 0;
      });
    });

    return { totalFisik, totalPoAktif, totalSiapTarik, totalPending };
  }, [vendorLedgers]);

  // Group vendors by type
  const groupedVendors = useMemo(() => {
    const map: Record<string, any[]> = {
      cmt: [],
      washing: [],
      benang: [],
      finishing: [],
      lainnya: []
    };

    filteredVendors.forEach((v) => {
      const t = v.tipe && map[v.tipe] ? v.tipe : "lainnya";
      map[t].push(v);
    });

    return map;
  }, [filteredVendors]);

  return (
    <div style={{ padding: "26px 32px", background: "#F1F5F9", minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse2 { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(0.92); } }
        .vendor-card-hover { transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
        .vendor-card-hover:hover { transform: translateY(-3px); box-shadow: 0 12px 28px rgba(0,0,0,0.08) !important; }
        .tab-btn-pill { transition: all 0.15s ease; }
        .tab-btn-pill:hover { background: #E2E8F0 !important; color: #0F172A !important; }
      `}</style>

      {/* HEADER & QUICK KPI STRIP */}
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
                <Users size={20} color="#FFFFFF" />
              </div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#0F172A", letterSpacing: "-0.02em" }}>
                Dashboard CMT & Mitra Produksi
              </h1>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "#64748B" }}>
              Pantau saldo fisik potongan di tangan vendor, progress pengerjaan, dan mutasi antar pos produksi secara real-time.
            </p>
          </div>

          {/* Sync status */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "#ECFDF5",
              color: "#059669",
              fontSize: 11,
              fontWeight: 800,
              padding: "4px 10px",
              borderRadius: 20,
              border: "1px solid #A7F3D0"
            }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10B981", animation: "pulse2 1.8s infinite" }} />
              LIVE LEDGER
            </span>
            <button
              onClick={loadData}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 14px",
                borderRadius: 10,
                border: "1.5px solid #CBD5E1",
                background: "#FFFFFF",
                color: "#475569",
                fontWeight: 700,
                fontSize: 12,
                cursor: "pointer"
              }}
            >
              <RefreshCw size={13} style={{ animation: pulse ? "spin 0.6s linear" : "none" }} />
              <span>Sinkron Ulang</span>
            </button>
          </div>
        </div>

        {/* 4 HIGHLIGHT KPI CARDS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          {/* Card 1: Total Fisik */}
          <div style={{ background: "#FFFFFF", borderRadius: 14, padding: "16px 20px", border: "1px solid #E2E8F0", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>Fisik di Luar (Semua Vendor)</span>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Package size={15} color="#2563EB" />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", letterSpacing: "-0.02em" }}>
              {globalStats.totalFisik.toLocaleString("id-ID")} <span style={{ fontSize: 13, fontWeight: 600, color: "#64748B" }}>pcs</span>
            </div>
            <div style={{ fontSize: 11, color: "#2563EB", fontWeight: 700, marginTop: 4 }}>
              Tersebar di {vendorLedgers.filter(v => v.totalSisa > 0).length} mitra aktif
            </div>
          </div>

          {/* Card 2: PO Aktif Berjalan */}
          <div style={{ background: "#FFFFFF", borderRadius: 14, padding: "16px 20px", border: "1px solid #E2E8F0", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>PO Dalam Pengerjaan</span>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "#FFFBEB", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Zap size={15} color="#D97706" />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#B45309", letterSpacing: "-0.02em" }}>
              {globalStats.totalPoAktif} <span style={{ fontSize: 13, fontWeight: 600, color: "#64748B" }}>PO</span>
            </div>
            <div style={{ fontSize: 11, color: "#D97706", fontWeight: 700, marginTop: 4 }}>
              Proses penjahitan & washing
            </div>
          </div>

          {/* Card 3: Siap Ditarik / Di-ACC */}
          <div style={{ background: "#FFFFFF", borderRadius: 14, padding: "16px 20px", border: "1px solid #E2E8F0", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>Sudah Di-ACC (Siap Tarik)</span>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "#F0FDF4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CheckCircle2 size={15} color="#16A34A" />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#15803D", letterSpacing: "-0.02em" }}>
              {globalStats.totalSiapTarik.toLocaleString("id-ID")} <span style={{ fontSize: 13, fontWeight: 600, color: "#64748B" }}>pcs</span>
            </div>
            <div style={{ fontSize: 11, color: "#16A34A", fontWeight: 700, marginTop: 4 }}>
              Siap dipindahkan ke washing / gudang
            </div>
          </div>

          {/* Card 4: Menunggu Verifikasi */}
          <div style={{ background: "#FFFFFF", borderRadius: 14, padding: "16px 20px", border: "1px solid #E2E8F0", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>Menunggu Verifikasi Mandor</span>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "#FAF5FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Clock size={15} color="#7C3AED" />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#6D28D9", letterSpacing: "-0.02em" }}>
              {globalStats.totalPending.toLocaleString("id-ID")} <span style={{ fontSize: 13, fontWeight: 600, color: "#64748B" }}>pcs</span>
            </div>
            <div style={{ fontSize: 11, color: "#7C3AED", fontWeight: 700, marginTop: 4 }}>
              Laporan pengerjaan baru masuk
            </div>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH CONTROLS */}
      <div style={{
        background: "#FFFFFF",
        borderRadius: 14,
        padding: "12px 18px",
        border: "1px solid #E2E8F0",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
        marginBottom: 24
      }}>
        {/* Category Pill Tabs */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            { id: "all", label: "Semua Mitra", count: vendorLedgers.length },
            { id: "cmt", label: "CMT / Jahit", count: vendorLedgers.filter(v => v.tipe === "cmt").length },
            { id: "washing", label: "Washing / Laundry", count: vendorLedgers.filter(v => v.tipe === "washing").length },
            { id: "benang", label: "Bersih Benang", count: vendorLedgers.filter(v => v.tipe === "benang").length },
            { id: "finishing", label: "QC & Finishing", count: vendorLedgers.filter(v => v.tipe === "finishing").length }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedCategory(tab.id)}
              className="tab-btn-pill"
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: selectedCategory === tab.id ? 800 : 600,
                border: "none",
                cursor: "pointer",
                background: selectedCategory === tab.id ? "#1E40AF" : "#F1F5F9",
                color: selectedCategory === tab.id ? "#FFFFFF" : "#475569"
              }}
            >
              {tab.label} <span style={{ opacity: 0.7, fontSize: 11 }}>({tab.count})</span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div style={{ position: "relative", minWidth: 260, flex: "0 1 300px" }}>
          <Search size={14} color="#94A3B8" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
          <input
            type="text"
            placeholder="Cari nama vendor, kode, atau PO..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "7px 10px 7px 32px",
              borderRadius: 8,
              border: "1px solid #CBD5E1",
              background: "#F8FAFC",
              fontSize: 12,
              color: "#0F172A",
              outline: "none",
              boxSizing: "border-box"
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                fontSize: 11,
                color: "#94A3B8",
                cursor: "pointer"
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* VENDOR CARDS GRID BY CATEGORY */}
      {loading && vendorLedgers.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#64748B" }}>
          <RefreshCw size={24} color="#2563EB" style={{ animation: "spin 1s linear infinite", marginBottom: 10 }} />
          <div style={{ fontSize: 15, fontWeight: 700 }}>Memuat data ledger vendor...</div>
        </div>
      ) : filteredVendors.length === 0 ? (
        <div style={{
          textAlign: "center",
          padding: "60px 20px",
          background: "#FFFFFF",
          borderRadius: 16,
          border: "1.5px dashed #CBD5E1",
          color: "#64748B"
        }}>
          <AlertCircle size={32} color="#94A3B8" style={{ marginBottom: 8 }} />
          <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A" }}>Tidak ada mitra yang cocok</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Coba sesuaikan kata kunci pencarian atau tab kategori vendor.</div>
        </div>
      ) : (
        ["cmt", "washing", "benang", "finishing", "lainnya"].map((catKey) => {
          const vendorsInGroup = groupedVendors[catKey] || [];
          if (vendorsInGroup.length === 0) return null;
          const theme = CATEGORY_THEME[catKey] || CATEGORY_THEME.lainnya;
          const CategoryIcon = theme.icon;
          const totalPcsCat = vendorsInGroup.reduce((s, v) => s + (v.totalSisa || 0), 0);

          return (
            <div key={catKey} style={{ marginBottom: 36 }}>
              {/* Category Section Header */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 14px",
                  borderRadius: 10,
                  background: theme.badgeBg,
                  border: `1.5px solid ${theme.badgeBorder}`,
                  color: theme.badgeText
                }}>
                  <CategoryIcon size={16} />
                  <span style={{ fontWeight: 900, fontSize: 13 }}>{theme.label}</span>
                  <span style={{
                    background: "rgba(255,255,255,0.7)",
                    padding: "1px 6px",
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 800
                  }}>
                    {vendorsInGroup.length} Vendor • {totalPcsCat} pcs di tangan
                  </span>
                </div>
                <div style={{ flex: 1, height: 1, background: "#CBD5E1" }} />
              </div>

              {/* Grid of Cards */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))",
                gap: 20
              }}>
                {vendorsInGroup.map((v: any) => {
                  const totalPO = v.poList.length;
                  const totalDisetujuiAll = v.poList.reduce((s: number, p: any) => s + (p.totalDisetujui || 0), 0);
                  const totalPendingAll = v.poList.reduce((s: number, p: any) => s + (p.totalPending || 0), 0);
                  const gajiInfo = v.hargaPerPcs > 0 ? formatRp(v.hargaPerPcs) + "/pcs" : null;
                  const tarifKhusus = v.tarifPotongan ? Object.keys(v.tarifPotongan).length : 0;
                  const portalHref = v.tipe === "cmt" ? `/cmt/${v.id}` : v.tipe === "washing" ? `/washing/${v.id}` : v.tipe === "benang" ? `/bersih-benang/${v.id}` : v.tipe === "finishing" ? `/finishing/${v.id}` : null;

                  return (
                    <div
                      key={v.id}
                      className="vendor-card-hover"
                      style={{
                        background: "#FFFFFF",
                        borderRadius: 16,
                        border: "1px solid #E2E8F0",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column"
                      }}
                    >
                      {/* Card Gradient Banner */}
                      <div style={{
                        background: `linear-gradient(135deg, ${theme.gradFrom} 0%, ${theme.gradTo} 100%)`,
                        padding: "18px 20px 16px",
                        color: "#FFFFFF"
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                          <div>
                            <div style={{ fontSize: 18, fontWeight: 900, color: "#FFFFFF", letterSpacing: "-0.01em" }}>
                              {v.nama}
                            </div>
                            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", fontWeight: 600, marginTop: 2 }}>
                              {v.jenis_default || v.tipe?.toUpperCase() || "MITRA"} • Kode: {v.kodeVendor || `VND-${v.id}`}
                            </div>
                          </div>

                          {/* Large Saldo Fisik */}
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.65)", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>
                              Fisik di Tangan
                            </div>
                            <div style={{ fontSize: 26, fontWeight: 900, color: "#FFFFFF", lineHeight: 1 }}>
                              {v.totalSisa} <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>pcs</span>
                            </div>
                          </div>
                        </div>

                        {/* 4 Metrics Strip */}
                        <div style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(4, 1fr)",
                          gap: 6,
                          background: "rgba(0,0,0,0.18)",
                          borderRadius: 10,
                          padding: "8px 10px",
                          backdropFilter: "blur(4px)"
                        }}>
                          <div>
                            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", fontWeight: 700, textTransform: "uppercase" }}>PO Aktif</div>
                            <div style={{ fontSize: 13, fontWeight: 900, color: "#FFFFFF" }}>{totalPO} PO</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", fontWeight: 700, textTransform: "uppercase" }}>Di-ACC</div>
                            <div style={{ fontSize: 13, fontWeight: 900, color: "#A7F3D0" }}>{totalDisetujuiAll}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", fontWeight: 700, textTransform: "uppercase" }}>Pending</div>
                            <div style={{ fontSize: 13, fontWeight: 900, color: "#FDE68A" }}>{totalPendingAll}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", fontWeight: 700, textTransform: "uppercase" }}>Tarif</div>
                            <div style={{ fontSize: 11, fontWeight: 800, color: "#FFFFFF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {gajiInfo || "—"}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action & Metadata Toolbar */}
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        flexWrap: "wrap",
                        padding: "10px 16px",
                        background: "#F8FAFC",
                        borderBottom: "1px solid #E2E8F0"
                      }}>
                        <span style={{
                          background: v.wajib_hitung_ulang ? "#FEF2F2" : "#ECFDF5",
                          color: v.wajib_hitung_ulang ? "#DC2626" : "#059669",
                          padding: "2px 8px",
                          borderRadius: 6,
                          fontSize: 10,
                          fontWeight: 800,
                          border: `1px solid ${v.wajib_hitung_ulang ? "#FECACA" : "#A7F3D0"}`
                        }}>
                          {v.wajib_hitung_ulang ? "Wajib Hitung Ulang" : "Bypass Cepat"}
                        </span>

                        {tarifKhusus > 0 && (
                          <span style={{
                            background: "#FFF7ED",
                            color: "#C2410C",
                            padding: "2px 8px",
                            borderRadius: 6,
                            fontSize: 10,
                            fontWeight: 800,
                            border: "1px solid #FDBA74"
                          }}>
                            +{tarifKhusus} Tarif Khusus
                          </span>
                        )}

                        {v.kontak && (
                          <a
                            href={`https://wa.me/62${v.kontak.replace(/^0/, "")}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              marginLeft: "auto",
                              background: "#F0FDF4",
                              color: "#16A34A",
                              padding: "3px 8px",
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 800,
                              border: "1px solid #86EFAC",
                              textDecoration: "none",
                              display: "flex",
                              alignItems: "center",
                              gap: 4
                            }}
                          >
                            <MessageSquare size={11} /> WA
                          </a>
                        )}

                        {portalHref && (
                          <a
                            href={portalHref}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              background: "#EFF6FF",
                              color: "#2563EB",
                              padding: "3px 8px",
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 800,
                              border: "1px solid #BFDBFE",
                              textDecoration: "none",
                              display: "flex",
                              alignItems: "center",
                              gap: 4
                            }}
                          >
                            <ExternalLink size={10} /> Portal Mitra
                          </a>
                        )}
                      </div>

                      {/* PO List Inside Vendor */}
                      <div style={{ padding: "14px 16px", flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                          <Layers size={12} color="#94A3B8" /> Rincian PO Aktif
                        </div>

                        {v.poList.length === 0 ? (
                          <div style={{ textAlign: "center", padding: "24px 10px", color: "#94A3B8" }}>
                            <Package size={24} color="#CBD5E1" style={{ marginBottom: 6 }} />
                            <div style={{ fontSize: 12, fontWeight: 600 }}>Tidak ada saldo PO aktif di vendor ini</div>
                          </div>
                        ) : (
                          v.poList.map((po: any) => {
                            const pctOk = po.pctDisetujui || 0;
                            const pctPend = Math.max(0, Math.min((po.pctDilaporkan || 0) - pctOk, 100 - pctOk));
                            const sisaJahit = Math.max(0, po.jumlahTerbit - (po.totalDisetujui || 0));
                            const readyToPull = (po.totalDisetujui || 0) > 0;

                            return (
                              <div
                                key={po.id}
                                style={{
                                  background: po.saldo_di_vendor > 0 ? "#F8FAFC" : "#FFFFFF",
                                  border: "1px solid #E2E8F0",
                                  borderRadius: 12,
                                  padding: "12px 14px",
                                  marginBottom: 10
                                }}
                              >
                                {/* PO Header */}
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                                  <div>
                                    <div style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 4,
                                      background: "#EFF6FF",
                                      color: "#1D4ED8",
                                      fontSize: 11,
                                      fontWeight: 900,
                                      padding: "2px 7px",
                                      borderRadius: 6,
                                      fontFamily: "monospace"
                                    }}>
                                      {po.noPo}
                                    </div>
                                    <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", marginTop: 2 }}>
                                      {po.model}
                                    </div>
                                    <div style={{ fontSize: 11, color: "#64748B", marginTop: 1 }}>
                                      Target {po.jumlahTerbit} pcs • Sisa {sisaJahit} pcs
                                    </div>
                                  </div>

                                  <div style={{ textAlign: "right" }}>
                                    <span style={{
                                      background: po.saldo_di_vendor > 0 ? "#2563EB" : "#ECFDF5",
                                      color: po.saldo_di_vendor > 0 ? "#FFFFFF" : "#059669",
                                      fontSize: 11,
                                      fontWeight: 800,
                                      padding: "3px 9px",
                                      borderRadius: 8,
                                      border: po.saldo_di_vendor > 0 ? "none" : "1px solid #A7F3D0"
                                    }}>
                                      {po.saldo_di_vendor > 0 ? `Fisik: ${po.saldo_di_vendor} pcs` : "Nol Saldo"}
                                    </span>
                                  </div>
                                </div>

                                {/* Progress Bar */}
                                {(pctOk > 0 || pctPend > 0) && (
                                  <div style={{ margin: "8px 0" }}>
                                    <div style={{ height: 6, borderRadius: 3, background: "#E2E8F0", position: "relative", overflow: "hidden" }}>
                                      <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${Math.min(pctOk, 100)}%`, background: "#10B981", borderRadius: 3 }} />
                                      <div style={{ position: "absolute", left: `${pctOk}%`, top: 0, height: "100%", width: `${pctPend}%`, background: "#F59E0B", borderRadius: 3 }} />
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginTop: 4, color: "#64748B" }}>
                                      <span style={{ color: "#15803D", fontWeight: 700 }}>{po.totalDisetujui} ACC</span>
                                      {po.totalPending > 0 && <span style={{ color: "#B45309", fontWeight: 700 }}>{po.totalPending} pending</span>}
                                      <span style={{ color: "#2563EB", fontWeight: 800 }}>{pctOk}% selesai</span>
                                    </div>
                                  </div>
                                )}

                                {/* Size Breakdown chips */}
                                {po.sizeBreakdown?.length > 0 && (
                                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
                                    {po.sizeBreakdown.map((s: any) => {
                                      const done = po.sizeProgress?.[s.size] || 0;
                                      const isDone = done >= s.jumlah;
                                      return (
                                        <span
                                          key={s.size}
                                          style={{
                                            fontSize: 10,
                                            fontWeight: 700,
                                            padding: "2px 7px",
                                            borderRadius: 6,
                                            background: isDone ? "#ECFDF5" : done > 0 ? "#EFF6FF" : "#F1F5F9",
                                            color: isDone ? "#065F46" : done > 0 ? "#1D4ED8" : "#64748B",
                                            border: `1px solid ${isDone ? "#A7F3D0" : done > 0 ? "#BFDBFE" : "#E2E8F0"}`
                                          }}
                                        >
                                          {s.size}: {done}/{s.jumlah}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}

                                {/* Action: Tarik Barang */}
                                {po.saldo_di_vendor > 0 && (
                                  <div style={{ marginTop: 10 }}>
                                    {readyToPull ? (
                                      <button
                                        onClick={() => setActivePo({ po, dari_vendor_id: v.id, vendor_nama: v.nama })}
                                        style={{
                                          width: "100%",
                                          padding: "8px 12px",
                                          background: "linear-gradient(135deg, #1E40AF 0%, #2563EB 100%)",
                                          color: "#FFFFFF",
                                          border: "none",
                                          borderRadius: 8,
                                          fontSize: 12,
                                          fontWeight: 800,
                                          cursor: "pointer",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          gap: 6,
                                          boxShadow: "0 2px 6px rgba(37,99,235,0.2)"
                                        }}
                                      >
                                        <ArrowRight size={14} /> Tarik {po.totalDisetujui} pcs (Siap Pindah)
                                      </button>
                                    ) : (
                                      <div style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: 6,
                                        padding: "7px 12px",
                                        borderRadius: 8,
                                        background: "#F1F5F9",
                                        color: "#64748B",
                                        fontSize: 11,
                                        fontWeight: 700,
                                        border: "1px dashed #CBD5E1"
                                      }}>
                                        <Clock size={12} color="#94A3B8" />
                                        <span>Menunggu Laporan Jahitan Di-ACC ({po.totalPending > 0 ? `${po.totalPending} pending ACC` : "0 pcs"})</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      {/* MODERN MODAL TARIK BARANG */}
      {activePo && (() => {
        const sp = activePo.po.sizeProgress || {};
        const sizeKeys = Object.keys(sp).filter((k) => sp[k] > 0);
        const jumlahTarik = activePo.po.totalDisetujui || 0;

        return (
          <div style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16
          }} onClick={() => setActivePo(null)}>
            <div style={{
              background: "#FFFFFF",
              borderRadius: 18,
              maxWidth: 540,
              width: "100%",
              padding: "24px 26px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
              border: "1px solid #E2E8F0"
            }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#0F172A" }}>
                    Tarik Barang Antar Pos: {activePo.po.noPo}
                  </h2>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748B" }}>
                    Dari Vendor: <strong style={{ color: "#0F172A" }}>{activePo.vendor_nama}</strong> • Model: {activePo.po.model}
                  </p>
                </div>
                <button
                  onClick={() => setActivePo(null)}
                  style={{ background: "#F1F5F9", border: "none", width: 32, height: 32, borderRadius: "50%", cursor: "pointer", color: "#64748B", fontWeight: 800 }}
                >
                  ✕
                </button>
              </div>

              {/* Verified Pcs Box */}
              <div style={{
                background: "#ECFDF5",
                border: "1.5px solid #A7F3D0",
                borderRadius: 12,
                padding: "14px 16px",
                marginBottom: 18
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#065F46" }}>
                    Hasil Verifikasi Mandor (Siap Tarik)
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 900, color: "#047857" }}>
                    {jumlahTarik} pcs
                  </span>
                </div>

                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {sizeKeys.map((s) => (
                    <span
                      key={s}
                      style={{
                        background: "#FFFFFF",
                        color: "#065F46",
                        fontSize: 11,
                        fontWeight: 800,
                        padding: "3px 9px",
                        borderRadius: 6,
                        border: "1px solid #6EE7B7"
                      }}
                    >
                      {s}: {sp[s]} pcs
                    </span>
                  ))}
                </div>
              </div>

              <form onSubmit={handleTarikBarang}>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                    Pilih Tujuan Pemindahan (Gudang / Vendor Lanjutan)
                  </label>
                  <select
                    required
                    value={tarikForm.ke_vendor_id}
                    onChange={(e) => setTarikForm({ ...tarikForm, ke_vendor_id: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1.5px solid #CBD5E1",
                      fontSize: 13,
                      color: "#0F172A",
                      background: "#FFFFFF",
                      outline: "none"
                    }}
                  >
                    <option value="">-- Pilih Pos / Vendor Tujuan --</option>
                    <option value="GUDANG" style={{ fontWeight: "bold", color: "#059669" }}>
                      🏢 MASUK GUDANG PRODUKSI (SELESAI JADI)
                    </option>
                    <option value="STANDBY" style={{ fontWeight: "bold", color: "#2563EB" }}>
                      📦 LEMPAR KE STANDBY POOL (ANTREAN VENDOR)
                    </option>
                    <optgroup label="Vendor Eksternal Lanjutan">
                      {allVendors
                        .filter((v) => String(v.id) !== String(activePo.dari_vendor_id))
                        .map((v: any) => (
                          <option key={v.id} value={v.id}>
                            {v.nama} — ({v.jenis_pekerjaan || v.tipe?.toUpperCase() || "Vendor"})
                          </option>
                        ))}
                    </optgroup>
                  </select>
                </div>

                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                    Catatan / No. Surat Jalan (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Dibawa supir motor batch 1"
                    value={tarikForm.catatan}
                    onChange={(e) => setTarikForm({ ...tarikForm, catatan: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 10,
                      border: "1.5px solid #CBD5E1",
                      fontSize: 13,
                      boxSizing: "border-box"
                    }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setActivePo(null)}
                    style={{
                      padding: "9px 16px",
                      borderRadius: 10,
                      border: "1px solid #CBD5E1",
                      background: "#FFFFFF",
                      color: "#475569",
                      fontSize: 13,
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
                      borderRadius: 10,
                      border: "none",
                      background: "linear-gradient(135deg, #1E40AF 0%, #2563EB 100%)",
                      color: "#FFFFFF",
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6
                    }}
                  >
                    <Truck size={14} />
                    <span>{isSubmitting ? "Memproses..." : `Tarik ${jumlahTarik} pcs`}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
