// @ts-nocheck
"use client";
import React, { useEffect, useState, useMemo } from "react";
import {
  Plus,
  X,
  Pencil,
  Settings2,
  Globe,
  Banknote,
  ExternalLink,
  Phone,
  Tag,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  Zap,
  Droplets,
  Scissors,
  Building2,
  Sparkles,
  Layers,
  FileText,
  Activity,
  Check,
  MessageCircle,
  Package,
  RotateCcw
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

const emptyVendor = {
  nama: "",
  tipe: "",
  jenis_default: "",
  kontak: "",
  wajib_hitung_ulang: false,
  hargaPerPcs: 0,
  tarifPotongan: {},
  min_progress_pct: 70
};

const emptyType = {
  nama: "",
  slug: "",
  emoji: "",
  perlu_portal: false,
  portal_path: "",
  perlu_gaji: false,
  perlu_throttle: false
};

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

const defaultTheme = {
  label: "Vendor",
  icon: Building2,
  color: "#64748B",
  bg: "#F8FAFC",
  border: "#E2E8F0",
  badge: "#F1F5F9",
  badgeText: "#334155"
};

const getTheme = (slug: string) => CATEGORY_THEME[slug] || defaultTheme;

const Toggle = ({ value, onChange, colorOn = "#2563EB" }) => (
  <button
    type="button"
    onClick={onChange}
    style={{
      width: 44,
      height: 24,
      borderRadius: 12,
      border: "none",
      background: value ? colorOn : "#CBD5E1",
      cursor: "pointer",
      position: "relative",
      transition: "background 0.2s",
      flexShrink: 0
    }}
  >
    <div
      style={{
        position: "absolute",
        top: 2,
        left: value ? 22 : 2,
        width: 20,
        height: 20,
        borderRadius: "50%",
        background: "white",
        transition: "left 0.2s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
      }}
    />
  </button>
);

export default function AturVendorPage() {
  const [vendors, setVendors] = useState([]);
  const [vendorTypes, setVendorTypes] = useState([]);
  const [kategoriList, setKategoriList] = useState([]);
  const [poList, setPoList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [showVendorForm, setShowVendorForm] = useState(false);
  const [editVendorId, setEditVendorId] = useState(null);
  const [vendorForm, setVendorForm] = useState({ ...emptyVendor });
  const [savingVendor, setSavingVendor] = useState(false);

  const [showTipeForm, setShowTipeForm] = useState(false);
  const [editTipeId, setEditTipeId] = useState(null);
  const [tipeForm, setTipeForm] = useState({ ...emptyType });
  const [savingTipe, setSavingTipe] = useState(false);

  // Navigation & filters
  const [activeTab, setActiveTab] = useState<"vendor" | "tipe">("vendor");
  const [searchQuery, setSearchQuery] = useState("");
  const [tipeFilter, setTipeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("semua");

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [rv, rt, rk, rp] = await Promise.all([
        fetch("/api/vendors?_t=" + Date.now()).then(r => r.json()),
        fetch("/api/vendor-types?_t=" + Date.now()).then(r => r.json()),
        fetch("/api/kategori?_t=" + Date.now()).then(r => r.json()),
        fetch("/api/po-produksi?_t=" + Date.now()).then(r => r.json()),
      ]);
      setVendors(Array.isArray(rv) ? rv : []);
      setVendorTypes(Array.isArray(rt) ? rt : []);
      setKategoriList(Array.isArray(rk) ? rk : []);
      setPoList(Array.isArray(rp) ? rp : []);
    } catch {
      toast.error("Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const h = () => load(true);
    window.addEventListener("konveksi-sync", h);
    return () => window.removeEventListener("konveksi-sync", h);
  }, []);

  const getTipeInfo = (slug: string) => vendorTypes.find(t => t.slug === slug);

  // Active PO lookup per vendor
  const getActivePOCount = (vendorId: number) => {
    return poList.filter((p: any) => p.vendorId === vendorId && !p.cmt_selesai && p.cmt_status !== "Selesai" && p.status !== "Closed" && p.status !== "Selesai").length;
  };

  const openAddVendor = () => {
    setEditVendorId(null);
    setVendorForm({ ...emptyVendor, tipe: vendorTypes[0]?.slug || "cmt" });
    setShowVendorForm(true);
  };

  const openEditVendor = (v: any) => {
    setEditVendorId(v.id);
    setVendorForm({
      nama: v.nama,
      tipe: v.tipe || "",
      jenis_default: v.jenis_default || "",
      kontak: v.kontak || "",
      wajib_hitung_ulang: !!v.wajib_hitung_ulang,
      hargaPerPcs: v.hargaPerPcs || 0,
      tarifPotongan: v.tarifPotongan || {},
      min_progress_pct: v.min_progress_pct ?? 70
    });
    setShowVendorForm(true);
  };

  const handleSaveVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorForm.nama) return;
    setSavingVendor(true);
    try {
      const method = editVendorId ? "PATCH" : "POST";
      const body = editVendorId ? { id: editVendorId, ...vendorForm } : vendorForm;
      const res = await fetch("/api/vendors", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error("Gagal menyimpan");
      toast.success(editVendorId ? "Vendor berhasil diperbarui!" : "Vendor baru berhasil ditambahkan!");
      setShowVendorForm(false);
      load();
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan");
    } finally {
      setSavingVendor(false);
    }
  };

  const handleToggleAktif = async (v: any) => {
    await fetch("/api/vendors", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: v.id, aktif: !v.aktif })
    });
    toast.success(v.aktif ? `Vendor ${v.nama} dinonaktifkan` : `Vendor ${v.nama} diaktifkan kembali`);
    load();
  };

  const openAddTipe = () => {
    setEditTipeId(null);
    setTipeForm({ ...emptyType });
    setShowTipeForm(true);
  };

  const openEditTipe = (t: any) => {
    setEditTipeId(t.id);
    setTipeForm({
      nama: t.nama,
      slug: t.slug,
      emoji: t.emoji,
      perlu_portal: !!t.perlu_portal,
      portal_path: t.portal_path || "",
      perlu_gaji: !!t.perlu_gaji,
      perlu_throttle: !!t.perlu_throttle
    });
    setShowTipeForm(true);
  };

  const handleSaveTipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tipeForm.nama || !tipeForm.slug) return;
    setSavingTipe(true);
    try {
      const method = editTipeId ? "PATCH" : "POST";
      const body = editTipeId ? { id: editTipeId, ...tipeForm } : tipeForm;
      const res = await fetch("/api/vendor-types", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");
      toast.success(editTipeId ? "Tipe vendor diperbarui!" : "Tipe vendor baru ditambahkan!");
      setShowTipeForm(false);
      load();
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan");
    } finally {
      setSavingTipe(false);
    }
  };

  const handleDeleteTipe = async (id: number) => {
    if (!confirm("Hapus tipe vendor ini?")) return;
    const res = await fetch("/api/vendor-types?id=" + id, { method: "DELETE" });
    if (res.ok) {
      toast.success("Tipe vendor berhasil dihapus");
      load();
    } else {
      toast.error("Gagal menghapus tipe vendor");
    }
  };

  // KPIs
  const aktif = vendors.filter(v => v.aktif);
  const nonaktif = vendors.filter(v => !v.aktif);
  const cmtCount = aktif.filter(v => v.tipe === "cmt").length;
  const downstreamCount = aktif.filter(v => v.tipe !== "cmt").length;

  // Filtered Vendor List
  const filteredVendors = useMemo(() => {
    return vendors.filter(v => {
      // Status
      if (statusFilter === "aktif" && !v.aktif) return false;
      if (statusFilter === "nonaktif" && v.aktif) return false;

      // Category / Tipe
      if (tipeFilter !== "all" && (v.tipe || "lainnya") !== tipeFilter) return false;

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNama = (v.nama || "").toLowerCase().includes(q);
        const matchKode = (v.kodeVendor || "").toLowerCase().includes(q);
        const matchKontak = (v.kontak || "").toLowerCase().includes(q);
        const matchJenis = (v.jenis_default || "").toLowerCase().includes(q);
        if (!matchNama && !matchKode && !matchKontak && !matchJenis) return false;
      }
      return true;
    });
  }, [vendors, statusFilter, tipeFilter, searchQuery]);

  // Group active filtered vendors by tipe
  const groupedByTipe = useMemo(() => {
    return filteredVendors.reduce((acc, v) => {
      const k = v.tipe || "lainnya";
      if (!acc[k]) acc[k] = [];
      acc[k].push(v);
      return acc;
    }, {} as Record<string, any[]>);
  }, [filteredVendors]);

  return (
    <div style={{ padding: "32px 32px 48px 32px", background: "var(--bg-app)", minHeight: "100%", overflowY: "auto", overflowX: "hidden" }}>
      
      {/* ─── PAGE HEADER ─────────────────────────────────────────────────── */}
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <h1 className="page-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
              Atur Vendor Produksi
            </h1>
            <span style={{ background: "linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)", color: "white", fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 800, letterSpacing: 0.5 }}>
              DIREKTORI & TARIF
            </span>
          </div>
          <p className="page-subtitle" style={{ margin: 0 }}>
            Manajemen direktori mitra vendor (CMT, Washing, Finishing), pengaturan tarif upah per kategori, dan portal akses.
          </p>
        </div>

        {/* QUICK SHORTCUT HUBS & TOP ACTIONS */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Link href="/dashboard-cmt" className="btn btn-secondary" style={{ background: "white", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <Activity size={14} color="#7C3AED" /> Dashboard CMT
          </Link>
          <Link href="/buat-spk" className="btn btn-secondary" style={{ background: "white", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <Zap size={14} color="#2563EB" /> Buat PO / SPK
          </Link>
          <Link href="/daftar-spk" className="btn btn-secondary" style={{ background: "white", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <FileText size={14} color="#059669" /> Daftar PO
          </Link>

          <button
            onClick={() => { setActiveTab("tipe"); openAddTipe(); }}
            className="btn btn-secondary"
            style={{ background: "white", color: "#4F46E5", border: "1.5px solid #C7D2FE", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700 }}
          >
            <Settings2 size={15} /> + Tipe Vendor
          </button>

          <button
            onClick={openAddVendor}
            className="btn btn-primary"
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 800, boxShadow: "0 4px 12px rgba(37,99,235,0.3)" }}
          >
            <Plus size={16} /> + Tambah Vendor
          </button>
        </div>
      </div>

      {/* ─── STAT KPI SUMMARY CARDS ─────────────────────────────────────────── */}
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        {/* Card 1 */}
        <div className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span className="stat-label">Total Vendor Terdaftar</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#EFF6FF", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Building2 size={18} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#0F172A", lineHeight: 1 }}>{vendors.length}</div>
            <span style={{ fontSize: 12, color: "#64748B" }}>mitra</span>
          </div>
          <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>
            <strong style={{ color: "#10B981" }}>{aktif.length} aktif</strong> · {nonaktif.length} dinonaktifkan
          </div>
        </div>

        {/* Card 2 */}
        <div className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span className="stat-label">Vendor CMT / Penjahit</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#F0FDF4", color: "#16A34A", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Zap size={18} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#2563EB", lineHeight: 1 }}>{cmtCount}</div>
            <span style={{ fontSize: 12, color: "#64748B" }}>penjahit aktif</span>
          </div>
          <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>
            Terhubung portal & pencatatan gaji otomatis
          </div>
        </div>

        {/* Card 3 */}
        <div className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span className="stat-label">Vendor Downstream</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#ECFEFF", color: "#0891B2", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Droplets size={18} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#0891B2", lineHeight: 1 }}>{downstreamCount}</div>
            <span style={{ fontSize: 12, color: "#64748B" }}>laundry & finishing</span>
          </div>
          <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>
            Washing, Bersih Benang, dan QC
          </div>
        </div>

        {/* Card 4 */}
        <div className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span className="stat-label">Kategori / Tipe Vendor</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#F5F3FF", color: "#7C3AED", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Settings2 size={18} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#7C3AED", lineHeight: 1 }}>{vendorTypes.length}</div>
            <span style={{ fontSize: 12, color: "#64748B" }}>kategori</span>
          </div>
          <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>
            {vendorTypes.filter(t => t.perlu_portal).length} kategori memiliki portal akses mandiri
          </div>
        </div>
      </div>

      {/* ─── SEGMENTED NAVIGATION TABS ─────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 6, background: "white", padding: 6, borderRadius: 14, border: "1px solid var(--border-color)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", width: "fit-content" }}>
          {[
            { key: "vendor", label: `Daftar Vendor (${vendors.length})`, icon: Building2 },
            { key: "tipe", label: `Tipe & Kategori Produksi (${vendorTypes.length})`, icon: Settings2 },
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
              </button>
            );
          })}
        </div>

        {activeTab === "vendor" && (
          <div style={{ fontSize: 13, color: "#64748B", display: "flex", alignItems: "center", gap: 6 }}>
            <Sparkles size={14} color="#2563EB" /> Menampilkan {filteredVendors.length} dari {vendors.length} vendor
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 1: DAFTAR VENDOR
         ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "vendor" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 40 }}>
          
          {/* SEARCH & FILTER TOOLBAR */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap", background: "white", padding: "14px 18px", borderRadius: 16, border: "1px solid var(--border-color)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            
            {/* Search Input */}
            <div className="search-wrapper" style={{ minWidth: 280, flex: 1, maxWidth: 420 }}>
              <Search className="search-icon" size={16} />
              <input
                type="text"
                placeholder="Cari nama vendor, ID kode, spesialisasi, atau kontak..."
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

            {/* Category / Tipe Filter Pills */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B", marginRight: 4 }}>Kategori:</span>
              <button
                onClick={() => setTipeFilter("all")}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  border: tipeFilter === "all" ? "1px solid #2563EB" : "1px solid #E2E8F0",
                  background: tipeFilter === "all" ? "#EFF6FF" : "white",
                  color: tipeFilter === "all" ? "#1D4ED8" : "#475569",
                  cursor: "pointer"
                }}
              >
                Semua
              </button>
              {vendorTypes.map(t => (
                <button
                  key={t.slug}
                  onClick={() => setTipeFilter(t.slug)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    border: tipeFilter === t.slug ? "1px solid #2563EB" : "1px solid #E2E8F0",
                    background: tipeFilter === t.slug ? "#EFF6FF" : "white",
                    color: tipeFilter === t.slug ? "#1D4ED8" : "#475569",
                    cursor: "pointer"
                  }}
                >
                  {t.emoji} {t.nama}
                </button>
              ))}
            </div>

            {/* Status Pills */}
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B", marginRight: 4 }}>Status:</span>
              {[
                { key: "semua", label: "Semua", count: vendors.length },
                { key: "aktif", label: "Aktif", count: aktif.length },
                { key: "nonaktif", label: "Nonaktif", count: nonaktif.length },
              ].map(st => (
                <button
                  key={st.key}
                  onClick={() => setStatusFilter(st.key)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                    background: statusFilter === st.key ? "#0F172A" : "#F1F5F9",
                    color: statusFilter === st.key ? "white" : "#64748B"
                  }}
                >
                  {st.label} ({st.count})
                </button>
              ))}
            </div>
          </div>

          {/* VENDOR LIST */}
          {loading ? (
            <div style={{ textAlign: "center", padding: 60, color: "#64748B" }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Memuat direktori vendor...</div>
            </div>
          ) : filteredVendors.length === 0 ? (
            <div style={{ background: "white", borderRadius: 18, padding: 60, textAlign: "center", border: "1px solid #E2E8F0" }}>
              <Building2 size={48} style={{ color: "#CBD5E1", margin: "0 auto 16px" }} />
              <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A" }}>Tidak ada vendor yang cocok</div>
              <p style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>
                Ubah kata kunci pencarian atau reset filter untuk melihat daftar mitra.
              </p>
              <button
                onClick={() => { setSearchQuery(""); setTipeFilter("all"); setStatusFilter("semua"); }}
                className="btn btn-secondary"
                style={{ marginTop: 14, background: "white" }}
              >
                Reset Semua Filter
              </button>
            </div>
          ) : (
            Object.entries(groupedByTipe).map(([slug, vlist]: [string, any[]]) => {
              const ti = getTipeInfo(slug);
              const theme = getTheme(slug);
              const HeaderIcon = theme.icon;

              return (
                <div key={slug} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {/* Category Header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ background: theme.bg, border: `1.5px solid ${theme.border}`, borderRadius: 12, padding: "8px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                      <HeaderIcon size={18} color={theme.color} />
                      <div>
                        <div style={{ fontWeight: 900, fontSize: 14, color: theme.color }}>
                          Vendor {ti?.nama || slug.toUpperCase()}
                        </div>
                        <div style={{ fontSize: 11, color: "#64748B" }}>
                          {vlist.length} vendor terdaftar
                        </div>
                      </div>
                    </div>
                    <div style={{ flex: 1, height: 1.5, background: `linear-gradient(to right, ${theme.border}, transparent)` }} />
                  </div>

                  {/* Cards Grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", gap: 16 }}>
                    {vlist.map(v => {
                      const tarifEntries = Object.entries(v.tarifPotongan || {});
                      const portalHref = ti?.perlu_portal ? (ti.slug === "cmt" ? `/cmt/${v.id}` : (ti.portal_path ? `${ti.portal_path}/${v.id}` : null)) : null;
                      const activePOs = getActivePOCount(v.id);

                      return (
                        <div
                          key={v.id}
                          style={{
                            background: "white",
                            borderRadius: 16,
                            border: "1px solid #E2E8F0",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                            overflow: "hidden",
                            display: "flex",
                            flexDirection: "column",
                            transition: "transform 0.2s, box-shadow 0.2s",
                            opacity: v.aktif ? 1 : 0.65
                          }}
                        >
                          {/* Card Header */}
                          <div style={{ padding: "16px 18px", background: v.aktif ? theme.bg : "#F8FAFC", borderBottom: `1px solid ${v.aktif ? theme.border : "#E2E8F0"}` }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                                <div style={{ width: 42, height: 42, borderRadius: 12, background: "white", border: `2px solid ${theme.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 16, color: theme.color, flexShrink: 0, boxShadow: "0 2px 6px rgba(0,0,0,0.05)" }}>
                                  {v.nama.charAt(0)}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 900, fontSize: 16, color: "#0F172A", display: "flex", alignItems: "center", gap: 6 }}>
                                    {v.nama}
                                    {!v.aktif && (
                                      <span style={{ fontSize: 10, background: "#FEE2E2", color: "#DC2626", padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>
                                        Nonaktif
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: 11, color: "#64748B", fontFamily: "monospace", marginTop: 2 }}>
                                    ID: {v.kodeVendor || `V-${v.id}`}
                                  </div>
                                </div>
                              </div>

                              {/* Edit & Toggle Actions */}
                              <div style={{ display: "flex", gap: 6 }}>
                                <button
                                  onClick={() => openEditVendor(v)}
                                  style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #CBD5E1", background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#475569" }}
                                  title="Edit Vendor"
                                >
                                  <Pencil size={13} />
                                </button>
                                <button
                                  onClick={() => handleToggleAktif(v)}
                                  style={{ width: 30, height: 30, borderRadius: 8, border: v.aktif ? "1px solid #FECACA" : "1px solid #BBF7D0", background: v.aktif ? "#FEF2F2" : "#F0FDF4", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: v.aktif ? "#DC2626" : "#16A34A" }}
                                  title={v.aktif ? "Nonaktifkan" : "Aktifkan Lagi"}
                                >
                                  {v.aktif ? <X size={13} /> : <Check size={13} />}
                                </button>
                              </div>
                            </div>

                            {/* Card Stats Bar */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 14, paddingTop: 10, borderTop: `1px solid ${theme.border}` }}>
                              <div>
                                <div style={{ fontSize: 9, fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>Spesialisasi</div>
                                <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", marginTop: 2 }}>{v.jenis_default || "Standar"}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: 9, fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>Tarif Default</div>
                                <div style={{ fontSize: 13, fontWeight: 800, color: "#059669", marginTop: 2 }}>
                                  Rp {(v.hargaPerPcs || 0).toLocaleString("id-ID")}/pcs
                                </div>
                              </div>
                              <div>
                                <div style={{ fontSize: 9, fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>PO Berjalan</div>
                                <div style={{ fontSize: 13, fontWeight: 800, color: activePOs > 0 ? "#2563EB" : "#94A3B8", marginTop: 2 }}>
                                  {activePOs} PO aktif
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Card Body */}
                          <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
                            {/* Badges */}
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: v.wajib_hitung_ulang ? "#FEF2F2" : "#F0FDF4", color: v.wajib_hitung_ulang ? "#DC2626" : "#16A34A", border: `1px solid ${v.wajib_hitung_ulang ? "#FECACA" : "#BBF7D0"}` }}>
                                {v.wajib_hitung_ulang ? " Wajib Hitung" : " Bypass Cepat"}
                              </span>
                              {ti?.perlu_gaji && (
                                <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE" }}>
                                  Gaji Terintegrasi
                                </span>
                              )}
                              {ti?.perlu_portal && (
                                <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: "#F5F3FF", color: "#7C3AED", border: "1px solid #DDD6FE" }}>
                                  Portal Mandiri
                                </span>
                              )}
                            </div>

                            {/* Tarif Khusus Details */}
                            {tarifEntries.length > 0 && (
                              <div style={{ background: "#FFF7ED", border: "1px solid #FDBA74", borderRadius: 10, padding: "8px 12px" }}>
                                <div style={{ fontSize: 10, fontWeight: 800, color: "#C2410C", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
                                  <Tag size={11} /> Tarif Khusus per Kategori ({tarifEntries.length})
                                </div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                  {tarifEntries.map(([kat, rp]: any) => (
                                    <span key={kat} style={{ background: "#FED7AA", color: "#9A3412", padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
                                      {kat}: Rp {rp.toLocaleString("id-ID")}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Connected Footers */}
                            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: "auto", paddingTop: 8, borderTop: "1px solid #F1F5F9" }}>
                              {v.kontak ? (
                                <a
                                  href={`https://wa.me/62${v.kontak.replace(/^0/, "")}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 12px", background: "#F0FDF4", border: "1px solid #86EFAC", color: "#16A34A", textDecoration: "none", borderRadius: 8, fontSize: 12, fontWeight: 700 }}
                                >
                                  <MessageCircle size={14} /> WhatsApp
                                </a>
                              ) : (
                                <div style={{ flex: 1, textAlign: "center", padding: "8px", background: "#F8FAFC", color: "#94A3B8", borderRadius: 8, fontSize: 11, fontWeight: 600 }}>
                                  Tanpa WhatsApp
                                </div>
                              )}

                              {portalHref && (
                                <a
                                  href={portalHref}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "8px 14px", background: "white", border: "1px solid #93C5FD", color: "#2563EB", textDecoration: "none", borderRadius: 8, fontSize: 12, fontWeight: 700 }}
                                >
                                  <ExternalLink size={13} /> Portal
                                </a>
                              )}

                              {/* DIRECT LINK TO PO LIST OF THIS VENDOR */}
                              <Link
                                href={`/daftar-spk?search=${encodeURIComponent(v.nama)}`}
                                style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "8px 12px", background: "white", border: "1px solid #E2E8F0", color: "#475569", borderRadius: 8, fontSize: 12, fontWeight: 700 }}
                                title="Lihat semua PO vendor ini"
                              >
                                <FileText size={13} />
                              </Link>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 2: TIPE & KATEGORI PRODUKSI
         ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "tipe" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 40 }}>
          <div style={{ background: "#EFF6FF", border: "1.5px solid #BFDBFE", borderRadius: 14, padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#2563EB", color: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Settings2 size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14, color: "#1D4ED8" }}>Struktur Kategori & Alur Produksi</div>
                <div style={{ fontSize: 12, color: "#3B82F6" }}>
                  Tipe vendor mengelompokkan mitra ke dalam tahapan kerja (CMT, Washing, Finishing), portal akses, dan perhitungan upah gaji.
                </div>
              </div>
            </div>
            <button
              onClick={openAddTipe}
              className="btn btn-primary"
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800 }}
            >
              <Plus size={14} /> Tambah Tipe Baru
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
            {vendorTypes.map(t => {
              const theme = getTheme(t.slug);
              const vendorCount = aktif.filter(v => v.tipe === t.slug).length;
              const TypeIcon = theme.icon;

              return (
                <div
                  key={t.id}
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
                  {/* Top Banner */}
                  <div style={{ padding: "16px 20px", background: theme.bg, borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: "white", border: `2px solid ${theme.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                        {t.emoji || <TypeIcon size={20} color={theme.color} />}
                      </div>
                      <div>
                        <div style={{ fontWeight: 900, fontSize: 16, color: "#0F172A" }}>{t.nama}</div>
                        <div style={{ fontSize: 11, fontFamily: "monospace", color: "#64748B", marginTop: 2 }}>slug: {t.slug}</div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => openEditTipe(t)}
                        style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #CBD5E1", background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#475569" }}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteTipe(t.id)}
                        style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #FECACA", background: "#FEF2F2", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#DC2626" }}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Body Properties */}
                  <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#F8FAFC", borderRadius: 8 }}>
                      <div style={{ fontSize: 12, color: "#64748B", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                        <Globe size={14} color="#2563EB" /> Portal Mandiri
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: t.perlu_portal ? "#2563EB" : "#94A3B8" }}>
                        {t.perlu_portal ? `${t.portal_path || "/portal"}/[id]` : "Tidak ada"}
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#F8FAFC", borderRadius: 8 }}>
                      <div style={{ fontSize: 12, color: "#64748B", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                        <Banknote size={14} color="#059669" /> Pencatatan Upah
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: t.perlu_gaji ? "#059669" : "#94A3B8" }}>
                        {t.perlu_gaji ? "Aktif" : "Tidak ada"}
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#F8FAFC", borderRadius: 8 }}>
                      <div style={{ fontSize: 12, color: "#64748B", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                        <Building2 size={14} color="#7C3AED" /> Mitra Aktif
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 900, color: "#0F172A" }}>
                        {vendorCount} vendor
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── MODAL FORM VENDOR (TAMBAH / EDIT) ───────────────────────────────── */}
      {showVendorForm && (
        <div className="modal-overlay" onClick={() => setShowVendorForm(false)} style={{ zIndex: 9999 }}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 560, maxHeight: "92vh", display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
            
            {/* Modal Header */}
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #E2E8F0", background: "linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: "#2563EB", color: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Building2 size={20} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontWeight: 900, fontSize: 17, color: "#0F172A" }}>
                    {editVendorId ? "Edit Data Vendor Mitra" : "Tambah Vendor Mitra Baru"}
                  </h2>
                  <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
                    Konfigurasi spesialisasi, kontak, tarif upah per kategori, dan akses portal.
                  </div>
                </div>
              </div>
              <button onClick={() => setShowVendorForm(false)} style={{ background: "white", border: "1px solid #E2E8F0", width: 34, height: 34, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B" }}>
                <X size={16} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveVendor} style={{ padding: "24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#334155", marginBottom: 6 }}>
                  Nama Vendor / Pabrik Mitra <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <input
                  required
                  className="form-control"
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #CBD5E1", fontSize: 14 }}
                  value={vendorForm.nama}
                  onChange={e => setVendorForm(f => ({ ...f, nama: e.target.value }))}
                  placeholder="Contoh: CMT Gianto / Rani Laundry"
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#334155", marginBottom: 6 }}>
                    Kategori / Tipe Vendor <span style={{ color: "#EF4444" }}>*</span>
                  </label>
                  <select
                    required
                    className="form-control"
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #CBD5E1", fontSize: 14, cursor: "pointer" }}
                    value={vendorForm.tipe}
                    onChange={e => setVendorForm(f => ({ ...f, tipe: e.target.value }))}
                  >
                    <option value="">Pilih Kategori...</option>
                    {vendorTypes.map(t => (
                      <option key={t.slug} value={t.slug}>{t.emoji} {t.nama}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#334155", marginBottom: 6 }}>
                    Keahlian / Spesialisasi
                  </label>
                  <input
                    className="form-control"
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #CBD5E1", fontSize: 14 }}
                    value={vendorForm.jenis_default}
                    onChange={e => setVendorForm(f => ({ ...f, jenis_default: e.target.value }))}
                    placeholder="Contoh: Jahit Jeans, Washing Bio-Bleach"
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#334155", marginBottom: 6 }}>
                  Nomor WhatsApp Aktif
                </label>
                <div style={{ display: "flex", border: "1px solid #CBD5E1", borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ padding: "10px 14px", background: "#F8FAFC", fontWeight: 800, fontSize: 13, color: "#64748B", borderRight: "1px solid #CBD5E1" }}>
                    +62
                  </div>
                  <input
                    style={{ flex: 1, padding: "10px 14px", border: "none", outline: "none", fontSize: 14 }}
                    value={vendorForm.kontak}
                    onChange={e => setVendorForm(f => ({ ...f, kontak: e.target.value }))}
                    placeholder="81234567890"
                  />
                </div>
              </div>

              {/* TARIF UPAH & TARIF KHUSUS */}
              {getTipeInfo(vendorForm.tipe)?.perlu_gaji && (
                <div style={{ border: "1.5px solid #BFDBFE", background: "#EFF6FF", borderRadius: 12, padding: 16 }}>
                  <label style={{ display: "block", fontWeight: 800, fontSize: 13, color: "#1D4ED8", marginBottom: 6 }}>
                    Tarif Upah Standar per Pcs (Rp)
                  </label>
                  <div style={{ display: "flex", border: "1px solid #93C5FD", borderRadius: 10, overflow: "hidden", background: "white" }}>
                    <div style={{ padding: "10px 14px", background: "#DBEAFE", fontWeight: 800, fontSize: 13, color: "#1D4ED8", borderRight: "1px solid #93C5FD" }}>
                      Rp
                    </div>
                    <input
                      type="number"
                      style={{ flex: 1, padding: "10px 14px", border: "none", outline: "none", fontSize: 15, fontWeight: 700 }}
                      value={vendorForm.hargaPerPcs || ""}
                      onChange={e => setVendorForm(f => ({ ...f, hargaPerPcs: parseInt(e.target.value) || 0 }))}
                      placeholder="Contoh: 5000"
                    />
                  </div>

                  {/* Tarif Khusus per Kategori */}
                  <div style={{ marginTop: 12, background: "white", borderRadius: 10, border: "1px solid #BFDBFE", padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <strong style={{ fontSize: 12, color: "#1E40AF" }}>Tarif Khusus per Model/Kategori Produk</strong>
                      <button
                        type="button"
                        onClick={() => setVendorForm(f => ({ ...f, tarifPotongan: { ...(f.tarifPotongan || {}), [Date.now().toString()]: 0 } }))}
                        style={{ padding: "4px 10px", fontSize: 11, background: "#2563EB", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700 }}
                      >
                        + Tambah Kategori
                      </button>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {Object.keys(vendorForm.tarifPotongan || {}).length === 0 && (
                        <div style={{ fontSize: 11, color: "#64748B" }}>
                          Belum ada tarif khusus. Tarif standar akan berlaku untuk seluruh model.
                        </div>
                      )}
                      {Object.entries(vendorForm.tarifPotongan || {}).map(([katKey, harga]: any) => (
                        <div key={katKey} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <select
                            style={{ flex: 1, padding: "8px", border: "1px solid #CBD5E1", borderRadius: 6, fontSize: 13 }}
                            value={kategoriList.some((k: any) => k.nama === katKey) ? katKey : ""}
                            onChange={e => {
                              const newTarif = { ...vendorForm.tarifPotongan };
                              const val = e.target.value;
                              if (val) { newTarif[val] = harga; delete newTarif[katKey]; }
                              setVendorForm(f => ({ ...f, tarifPotongan: newTarif }));
                            }}
                          >
                            <option value="">-- Pilih Model Kategori --</option>
                            {kategoriList.map((k: any) => (
                              <option key={k.nama} value={k.nama}>{k.nama}</option>
                            ))}
                          </select>
                          <div style={{ display: "flex", border: "1px solid #CBD5E1", borderRadius: 6, overflow: "hidden", width: 140 }}>
                            <div style={{ padding: "6px 8px", background: "#F1F5F9", fontSize: 11, fontWeight: 700, color: "#64748B", borderRight: "1px solid #CBD5E1" }}>Rp</div>
                            <input
                              type="number"
                              style={{ flex: 1, padding: "6px 8px", border: "none", outline: "none", fontSize: 13, fontWeight: 700 }}
                              value={harga || ""}
                              onChange={e => {
                                const n = { ...vendorForm.tarifPotongan };
                                n[katKey] = parseInt(e.target.value) || 0;
                                setVendorForm(f => ({ ...f, tarifPotongan: n }));
                              }}
                              placeholder="0"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const n = { ...vendorForm.tarifPotongan };
                              delete n[katKey];
                              setVendorForm(f => ({ ...f, tarifPotongan: n }));
                            }}
                            style={{ width: 30, height: 30, background: "#FEF2F2", color: "#EF4444", border: "1px solid #FECACA", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* BATAS MINIMUM PROGRESS / THROTTLE */}
              {getTipeInfo(vendorForm.tipe)?.perlu_throttle && (
                <div style={{ padding: "14px 16px", background: "#FFFBEB", border: "1.5px solid #FCD34D", borderRadius: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 13, color: "#92400E" }}>
                        Batas Minimum Progres untuk Request Baru
                      </div>
                      <div style={{ fontSize: 11, color: "#B45309" }}>
                        Vendor harus menyelesaikan persentase PO ini sebelum bisa request bahan baru
                      </div>
                    </div>
                    <div style={{ background: "#F59E0B", color: "white", fontWeight: 900, fontSize: 16, padding: "3px 12px", borderRadius: 8 }}>
                      {vendorForm.min_progress_pct ?? 70}%
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={vendorForm.min_progress_pct ?? 70}
                    onChange={e => setVendorForm(f => ({ ...f, min_progress_pct: Number(e.target.value) }))}
                    style={{ width: "100%", accentColor: "#F59E0B" }}
                  />
                </div>
              )}

              {/* METODE SCAN BARCODE */}
              <div style={{ padding: "12px 14px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: "#0F172A", marginBottom: 8 }}>
                  Metode Penerimaan Barcode SPK
                </label>
                <div style={{ display: "flex", gap: 10 }}>
                  {[
                    { val: true, label: "Wajib Hitung Ulang (Ketat)" },
                    { val: false, label: "Bypass Cepat (Langsung)" }
                  ].map(opt => (
                    <label
                      key={String(opt.val)}
                      style={{
                        flex: 1,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 12px",
                        background: vendorForm.wajib_hitung_ulang === opt.val ? "#EFF6FF" : "white",
                        border: `1.5px solid ${vendorForm.wajib_hitung_ulang === opt.val ? "#2563EB" : "#E2E8F0"}`,
                        borderRadius: 8
                      }}
                    >
                      <input
                        type="radio"
                        checked={vendorForm.wajib_hitung_ulang === opt.val}
                        onChange={() => setVendorForm(f => ({ ...f, wajib_hitung_ulang: opt.val }))}
                        style={{ accentColor: "#2563EB" }}
                      />
                      <span style={{ fontSize: 12, fontWeight: 700, color: vendorForm.wajib_hitung_ulang === opt.val ? "#1D4ED8" : "#64748B" }}>
                        {opt.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Submit Buttons */}
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowVendorForm(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: "12px", background: "white" }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingVendor}
                  className="btn btn-primary"
                  style={{ flex: 2, padding: "12px", fontWeight: 800 }}
                >
                  {savingVendor ? "Menyimpan Data..." : editVendorId ? "Simpan Perubahan" : "Daftarkan Vendor Mitra"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL FORM TIPE VENDOR ─────────────────────────────────────────── */}
      {showTipeForm && (
        <div className="modal-overlay" onClick={() => setShowTipeForm(false)} style={{ zIndex: 9999 }}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 500, padding: 0, overflow: "hidden" }}>
            
            {/* Header */}
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #E2E8F0", background: "linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: "#F5F3FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Settings2 size={18} color="#6366F1" />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontWeight: 900, fontSize: 17, color: "#0F172A" }}>
                    {editTipeId ? "Edit Kategori Tipe Vendor" : "Tambah Kategori Tipe Baru"}
                  </h2>
                </div>
              </div>
              <button onClick={() => setShowTipeForm(false)} style={{ background: "white", border: "1px solid #E2E8F0", width: 32, height: 32, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B" }}>
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveTipe} style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ width: 80 }}>
                  <label style={{ display: "block", fontWeight: 700, fontSize: 12, color: "#475569", marginBottom: 6 }}>Emoji</label>
                  <input
                    className="form-control"
                    value={tipeForm.emoji}
                    onChange={e => setTipeForm(f => ({ ...f, emoji: e.target.value }))}
                    style={{ textAlign: "center", fontSize: 22, height: 44 }}
                    maxLength={2}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontWeight: 700, fontSize: 12, color: "#475569", marginBottom: 6 }}>Nama Kategori Tipe *</label>
                  <input
                    required
                    className="form-control"
                    value={tipeForm.nama}
                    onChange={e => setTipeForm(f => ({ ...f, nama: e.target.value }))}
                    placeholder="Contoh: QC / Finishing"
                    style={{ height: 44 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontWeight: 700, fontSize: 12, color: "#475569", marginBottom: 6 }}>Slug Unik *</label>
                <input
                  required
                  className="form-control"
                  value={tipeForm.slug}
                  onChange={e => setTipeForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, "_") }))}
                  placeholder="Contoh: qc_finishing"
                />
              </div>

              <div style={{ padding: "14px", background: "#F8FAFC", borderRadius: 10, border: "1px solid #E2E8F0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13, color: "#0F172A", display: "flex", alignItems: "center", gap: 6 }}>
                      <Globe size={14} color="#2563EB" /> Portal Akses Mandiri
                    </div>
                    <div style={{ fontSize: 11, color: "#64748B" }}>Aktifkan jika vendor ini punya portal login mandiri</div>
                  </div>
                  <Toggle value={tipeForm.perlu_portal} onChange={() => setTipeForm(f => ({ ...f, perlu_portal: !f.perlu_portal }))} />
                </div>
                {tipeForm.perlu_portal && (
                  <div style={{ marginTop: 8 }}>
                    <label style={{ display: "block", fontWeight: 700, fontSize: 11, color: "#475569", marginBottom: 4 }}>Path URL Portal</label>
                    <input className="form-control" value={tipeForm.portal_path} onChange={e => setTipeForm(f => ({ ...f, portal_path: e.target.value }))} placeholder="/washing" />
                  </div>
                )}
              </div>

              <div style={{ padding: "14px", background: "#F8FAFC", borderRadius: 10, border: "1px solid #E2E8F0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13, color: "#0F172A", display: "flex", alignItems: "center", gap: 6 }}>
                      <Banknote size={14} color="#059669" /> Pencatatan Upah / Gaji
                    </div>
                    <div style={{ fontSize: 11, color: "#64748B" }}>Otomatis hitung tagihan/gaji per pcs</div>
                  </div>
                  <Toggle value={tipeForm.perlu_gaji} onChange={() => setTipeForm(f => ({ ...f, perlu_gaji: !f.perlu_gaji }))} colorOn="#16A34A" />
                </div>
              </div>

              <div style={{ padding: "14px", background: "#F8FAFC", borderRadius: 10, border: "1px solid #E2E8F0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13, color: "#0F172A", display: "flex", alignItems: "center", gap: 6 }}>
                      <Settings2 size={14} color="#F59E0B" /> Pembatasan Throttle Request
                    </div>
                    <div style={{ fontSize: 11, color: "#64748B" }}>Wajib capai % progres sebelum minta kain baru</div>
                  </div>
                  <Toggle value={tipeForm.perlu_throttle || false} onChange={() => setTipeForm(f => ({ ...f, perlu_throttle: !f.perlu_throttle }))} colorOn="#F59E0B" />
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button type="button" onClick={() => setShowTipeForm(false)} className="btn btn-secondary" style={{ flex: 1, padding: "12px", background: "white" }}>
                  Batal
                </button>
                <button type="submit" disabled={savingTipe} className="btn btn-primary" style={{ flex: 2, padding: "12px", fontWeight: 800 }}>
                  {savingTipe ? "Menyimpan..." : editTipeId ? "Simpan Perubahan" : "Tambah Tipe Baru"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
