"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Tags, 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  Search, 
  RotateCcw, 
  Scissors, 
  Package, 
  Users, 
  DollarSign, 
  Eye, 
  ArrowUpRight, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  FileText,
  SlidersHorizontal,
  ChevronRight,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function KategoriPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [detailModal, setDetailModal] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [filterUsage, setFilterUsage] = useState<"all" | "in_production" | "has_tarif" | "no_production">("all");
  const [sortBy, setSortBy] = useState<"newest" | "name_asc" | "name_desc" | "most_pcs" | "highest_tarif">("newest");
  
  const [formData, setFormData] = useState({
    nama: "",
    deskripsi: ""
  });

  const presetSuggestions = [
    "PECAH POLA",
    "GOMBRONG",
    "TULANG",
    "REGULAR FIT",
    "SLIM FIT",
    "CARGO JEANS",
    "JAKET DENIM",
    "KORSET DENIM",
    "KULOT JEANS"
  ];

  const fetchData = async () => {
    try {
      const res = await fetch("/api/kategori");
      const json = await res.json();
      setData(Array.isArray(json) ? json : []);
    } catch (err) {
      toast.error("Gagal mengambil data kategori");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Real-time sync: refresh data when another admin makes changes
  useEffect(() => {
    const handleSync = () => fetchData();
    window.addEventListener("konveksi-sync", handleSync);
    return () => window.removeEventListener("konveksi-sync", handleSync);
  }, []);

  // Aggregate KPI Stats
  const stats = useMemo(() => {
    const totalKategori = data.length;
    const totalPcs = data.reduce((sum, item) => sum + (Number(item.total_pcs_potong) || 0), 0);
    const totalPemotongan = data.reduce((sum, item) => sum + (Number(item.total_pemotongan) || 0), 0);
    const withTarif = data.filter(item => (item.vendor_tarifs || []).length > 0).length;
    
    const allTarifs = data.flatMap(item => (item.vendor_tarifs || []).map((vt: any) => vt.tarif)).filter(Boolean);
    const avgTarifOverall = allTarifs.length > 0 
      ? Math.round(allTarifs.reduce((s, t) => s + t, 0) / allTarifs.length) 
      : 0;

    return {
      totalKategori,
      totalPcs,
      totalPemotongan,
      withTarif,
      avgTarifOverall
    };
  }, [data]);

  // Filtered & Sorted list
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      // Search query
      const q = searchQuery.toLowerCase().trim();
      const matchQuery = !q || (
        (item.nama || "").toLowerCase().includes(q) ||
        (item.uid || "").toLowerCase().includes(q) ||
        (item.deskripsi || "").toLowerCase().includes(q)
      );

      // Usage filter
      let matchUsage = true;
      if (filterUsage === "in_production") {
        matchUsage = (item.total_pemotongan || 0) > 0;
      } else if (filterUsage === "has_tarif") {
        matchUsage = (item.vendor_tarifs || []).length > 0;
      } else if (filterUsage === "no_production") {
        matchUsage = (item.total_pemotongan || 0) === 0;
      }

      return matchQuery && matchUsage;
    }).sort((a, b) => {
      if (sortBy === "name_asc") return (a.nama || "").localeCompare(b.nama || "");
      if (sortBy === "name_desc") return (b.nama || "").localeCompare(a.nama || "");
      if (sortBy === "most_pcs") return (Number(b.total_pcs_potong) || 0) - (Number(a.total_pcs_potong) || 0);
      if (sortBy === "highest_tarif") return (Number(b.avg_tarif_cmt) || 0) - (Number(a.avg_tarif_cmt) || 0);
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [data, searchQuery, filterUsage, sortBy]);

  const hasActiveFilters = searchQuery !== "" || filterUsage !== "all" || sortBy !== "newest";

  const resetFilters = () => {
    setSearchQuery("");
    setFilterUsage("all");
    setSortBy("newest");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nama.trim()) {
      toast.error("Nama kategori / model pola wajib diisi");
      return;
    }

    setIsSubmitting(true);
    try {
      const isEdit = editingId !== null;
      const url = "/api/kategori";
      const method = isEdit ? "PUT" : "POST";
      const body = JSON.stringify({ 
        id: editingId, 
        nama: formData.nama.trim(), 
        deskripsi: formData.deskripsi.trim() 
      });

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Terjadi kesalahan saat menyimpan kategori");
      }

      toast.success(isEdit ? "Kategori pola berhasil diperbarui" : "Kategori pola baru berhasil ditambahkan");
      setShowModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number, nama: string) => {
    if (!confirm(`Peringatan: Yakin ingin menghapus kategori "${nama}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      const res = await fetch(`/api/kategori?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal menghapus kategori");
      }
      toast.success(`Kategori "${nama}" berhasil dihapus`);
      fetchData();
      if (detailModal?.id === id) setDetailModal(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const openAdd = () => {
    setEditingId(null);
    setFormData({ nama: "", deskripsi: "" });
    setShowModal(true);
  };

  const openEdit = (item: any) => {
    setEditingId(item.id);
    setFormData({ nama: item.nama || "", deskripsi: item.deskripsi || "" });
    setShowModal(true);
  };

  return (
    <div style={{ padding: "28px 32px", background: "#F1F5F9", minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .kat-card-hover { transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
        .kat-card-hover:hover { transform: translateY(-3px); box-shadow: 0 10px 24px rgba(0,0,0,0.08) !important; }
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
                <Tags size={20} color="#FFFFFF" />
              </div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#0F172A", letterSpacing: "-0.02em" }}>
                Kategori Produk & Model Pola Pakaian
              </h1>
              <span style={{ fontSize: 11, fontWeight: 800, background: "rgba(37,99,235,0.1)", color: "#2563EB", padding: "4px 10px", borderRadius: 20 }}>
                Data Master Produk
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "#64748B" }}>
              Kelola master kategori produk, klasifikasi model pola celana jeans, integrasi upah potong & tarif CMT vendor.
            </p>
          </div>

          {/* QUICK NAVIGATION & ACTIONS */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Link 
              href="/barang" 
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
              <Package size={14} color="#64748B" /> Data Barang Jadi
            </Link>
            <Link 
              href="/atur-vendor" 
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
              <Users size={14} color="#64748B" /> Atur Tarif Vendor CMT
            </Link>
            <Link 
              href="/pemotongan-kain" 
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
              <Scissors size={14} color="#64748B" /> Pemotongan Kain
            </Link>
            <button
              onClick={openAdd}
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
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(37,99,235,0.25)"
              }}
            >
              <Plus size={16} /> Tambah Kategori
            </button>
          </div>
        </div>

        {/* 4 KPI SUMMARY STAT CARDS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          {/* Card 1: Total Kategori */}
          <div className="kat-card-hover" style={{ background: "#FFFFFF", borderRadius: 14, padding: "16px 20px", border: "1px solid #E2E8F0", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>Total Kategori Terdaftar</span>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Tags size={15} color="#2563EB" />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", letterSpacing: "-0.02em" }}>
              {stats.totalKategori} <span style={{ fontSize: 13, fontWeight: 600, color: "#64748B" }}>Model Pola</span>
            </div>
            <div style={{ fontSize: 11, color: "#2563EB", fontWeight: 700, marginTop: 4 }}>
              Klasifikasi desain & model produk
            </div>
          </div>

          {/* Card 2: Total Produksi Terkait */}
          <div className="kat-card-hover" style={{ background: "#FFFFFF", borderRadius: 14, padding: "16px 20px", border: "1px solid #E2E8F0", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>Total Produksi SPK Terkait</span>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "#ECFDF5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Scissors size={15} color="#059669" />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#065F46", letterSpacing: "-0.02em" }}>
              {stats.totalPcs.toLocaleString("id-ID")} <span style={{ fontSize: 13, fontWeight: 600, color: "#64748B" }}>Pcs</span>
            </div>
            <div style={{ fontSize: 11, color: "#059669", fontWeight: 700, marginTop: 4 }}>
              Dari {stats.totalPemotongan} batch pemotongan kain
            </div>
          </div>

          {/* Card 3: Konfigurasi Tarif CMT */}
          <div className="kat-card-hover" style={{ background: "#FFFFFF", borderRadius: 14, padding: "16px 20px", border: "1px solid #E2E8F0", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>Integrasi Tarif Vendor CMT</span>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "#FAF5FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Users size={15} color="#7C3AED" />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#6D28D9", letterSpacing: "-0.02em" }}>
              {stats.withTarif} <span style={{ fontSize: 13, fontWeight: 600, color: "#64748B" }}>Kategori Terhubung</span>
            </div>
            <div style={{ fontSize: 11, color: "#7C3AED", fontWeight: 700, marginTop: 4 }}>
              Memiliki tarif khusus upah jahit vendor
            </div>
          </div>

          {/* Card 4: Rata-Rata Tarif Ongkos CMT */}
          <div className="kat-card-hover" style={{ background: "#FFFFFF", borderRadius: 14, padding: "16px 20px", border: "1px solid #E2E8F0", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>Rata-rata Ongkos Jahit</span>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "#FFFBEB", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <DollarSign size={15} color="#D97706" />
              </div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#B45309", letterSpacing: "-0.02em" }}>
              Rp {stats.avgTarifOverall.toLocaleString("id-ID")} <span style={{ fontSize: 12, fontWeight: 600, color: "#64748B" }}>/ pcs</span>
            </div>
            <div style={{ fontSize: 11, color: "#D97706", fontWeight: 700, marginTop: 4 }}>
              Benchmark upah jahit pola konveksi
            </div>
          </div>
        </div>
      </div>

      {/* SEARCH TOOLBAR & MULTI-FILTER SECTION */}
      <div style={{ background: "#FFFFFF", borderRadius: 14, padding: "14px 18px", border: "1px solid #E2E8F0", marginBottom: 20, boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          
          {/* SEARCH INPUT */}
          <div style={{ position: "relative", flex: "1 1 280px", minWidth: 260 }}>
            <Search size={16} color="#94A3B8" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
            <input 
              type="text"
              placeholder="Cari kode UID (KTG-...), nama pola, deskripsi..."
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
            
            {/* USAGE FILTER PILLS */}
            <div style={{ display: "flex", background: "#F1F5F9", padding: 3, borderRadius: 10, gap: 2 }}>
              <button
                onClick={() => setFilterUsage("all")}
                style={{
                  padding: "6px 12px",
                  fontSize: 12,
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  fontWeight: filterUsage === "all" ? 800 : 600,
                  background: filterUsage === "all" ? "#FFFFFF" : "transparent",
                  color: filterUsage === "all" ? "#2563EB" : "#64748B",
                  boxShadow: filterUsage === "all" ? "0 1px 3px rgba(0,0,0,0.08)" : "none"
                }}
              >
                Semua ({data.length})
              </button>
              <button
                onClick={() => setFilterUsage("in_production")}
                style={{
                  padding: "6px 12px",
                  fontSize: 12,
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  fontWeight: filterUsage === "in_production" ? 800 : 600,
                  background: filterUsage === "in_production" ? "#FFFFFF" : "transparent",
                  color: filterUsage === "in_production" ? "#059669" : "#64748B",
                  boxShadow: filterUsage === "in_production" ? "0 1px 3px rgba(0,0,0,0.08)" : "none"
                }}
              >
                Ada Produksi
              </button>
              <button
                onClick={() => setFilterUsage("has_tarif")}
                style={{
                  padding: "6px 12px",
                  fontSize: 12,
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  fontWeight: filterUsage === "has_tarif" ? 800 : 600,
                  background: filterUsage === "has_tarif" ? "#FFFFFF" : "transparent",
                  color: filterUsage === "has_tarif" ? "#7C3AED" : "#64748B",
                  boxShadow: filterUsage === "has_tarif" ? "0 1px 3px rgba(0,0,0,0.08)" : "none"
                }}
              >
                Ada Tarif CMT
              </button>
              <button
                onClick={() => setFilterUsage("no_production")}
                style={{
                  padding: "6px 12px",
                  fontSize: 12,
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  fontWeight: filterUsage === "no_production" ? 800 : 600,
                  background: filterUsage === "no_production" ? "#FFFFFF" : "transparent",
                  color: filterUsage === "no_production" ? "#475569" : "#64748B",
                  boxShadow: filterUsage === "no_production" ? "0 1px 3px rgba(0,0,0,0.08)" : "none"
                }}
              >
                Belum Produksi
              </button>
            </div>

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
              <option value="newest">Terbaru Dibuat</option>
              <option value="name_asc">Nama (A - Z)</option>
              <option value="name_desc">Nama (Z - A)</option>
              <option value="most_pcs">Produksi Terbanyak (Pcs)</option>
              <option value="highest_tarif">Tarif CMT Tertinggi</option>
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

      {/* TABLE DAFTAR KATEGORI PRODUK */}
      <div style={{ background: "#FFFFFF", borderRadius: 14, border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1.5px solid #E2E8F0" }}>
                <th style={{ padding: "12px 18px", fontSize: 11, fontWeight: 800, color: "#64748B", letterSpacing: "0.05em", textTransform: "uppercase" }}>UID & TANGGAL</th>
                <th style={{ padding: "12px 18px", fontSize: 11, fontWeight: 800, color: "#64748B", letterSpacing: "0.05em", textTransform: "uppercase" }}>NAMA KATEGORI / MODEL POLA</th>
                <th style={{ padding: "12px 18px", fontSize: 11, fontWeight: 800, color: "#64748B", letterSpacing: "0.05em", textTransform: "uppercase" }}>DESKRIPSI & SPESIFIKASI</th>
                <th style={{ padding: "12px 18px", fontSize: 11, fontWeight: 800, color: "#64748B", letterSpacing: "0.05em", textTransform: "uppercase", textAlign: "center" }}>TOTAL PRODUKSI (PCS)</th>
                <th style={{ padding: "12px 18px", fontSize: 11, fontWeight: 800, color: "#64748B", letterSpacing: "0.05em", textTransform: "uppercase", textAlign: "center" }}>TARIF CMT VENDOR</th>
                <th style={{ padding: "12px 18px", fontSize: 11, fontWeight: 800, color: "#64748B", letterSpacing: "0.05em", textTransform: "uppercase", textAlign: "right", minWidth: 150 }}>AKSI</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: 48, textAlign: "center", color: "#64748B" }}>
                    <div style={{ display: "inline-block", width: 24, height: 24, border: "3px solid #E2E8F0", borderTopColor: "#2563EB", borderRadius: "50%", animation: "spin 0.8s linear infinite", marginBottom: 8 }} />
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Memuat data master kategori...</div>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 48, textAlign: "center", color: "#64748B" }}>
                    <Tags size={32} color="#CBD5E1" style={{ margin: "0 auto 8px" }} />
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>Tidak ada kategori yang cocok</div>
                    <div style={{ fontSize: 12.5, color: "#94A3B8", marginTop: 2 }}>
                      {searchQuery || filterUsage !== "all" 
                        ? "Coba sesuaikan kata kunci pencarian atau reset filter."
                        : "Klik tombol '+ Tambah Kategori' untuk membuat model pola produk pertama."}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredData.map((item) => {
                  const hasTarif = (item.vendor_tarifs || []).length > 0;
                  const hasProduction = (item.total_pemotongan || 0) > 0;

                  return (
                    <tr 
                      key={item.id} 
                      style={{ borderBottom: "1px solid #E2E8F0", transition: "background 0.15s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      {/* UID & TANGGAL */}
                      <td style={{ padding: "14px 18px", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                          <span style={{ 
                            fontSize: 12, 
                            fontWeight: 900, 
                            fontFamily: "monospace", 
                            color: "#1D4ED8", 
                            background: "#EFF6FF", 
                            border: "1px solid #BFDBFE",
                            padding: "2px 8px", 
                            borderRadius: 6 
                          }}>
                            {item.uid || `KTG-${item.id}`}
                          </span>
                        </div>
                        <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 3 }}>
                          {item.createdAt ? new Date(item.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-"}
                        </div>
                      </td>

                      {/* NAMA KATEGORI */}
                      <td style={{ padding: "14px 18px", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontWeight: 800, fontSize: 14, color: "#0F172A" }}>
                            {item.nama}
                          </span>
                          {hasProduction && (
                            <span style={{ fontSize: 10.5, fontWeight: 800, background: "#ECFDF5", color: "#059669", border: "1px solid #A7F3D0", padding: "1px 6px", borderRadius: 4 }}>
                              Aktif SPK
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>
                          ID Sistem: #{item.id} &bull; {item.total_barang || 0} Barang Jadi
                        </div>
                      </td>

                      {/* DESKRIPSI */}
                      <td style={{ padding: "14px 18px", verticalAlign: "middle" }}>
                        {item.deskripsi ? (
                          <div style={{ fontSize: 12.5, color: "#334155", maxWidth: 300, lineHeight: 1.4 }}>
                            {item.deskripsi}
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: "#94A3B8", fontStyle: "italic" }}>
                            Tidak ada deskripsi spesifik
                          </span>
                        )}
                      </td>

                      {/* TOTAL PRODUKSI */}
                      <td style={{ padding: "14px 18px", textAlign: "center", verticalAlign: "middle" }}>
                        {hasProduction ? (
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 900, color: "#059669" }}>
                              {Number(item.total_pcs_potong).toLocaleString("id-ID")} <span style={{ fontSize: 11, fontWeight: 600 }}>pcs</span>
                            </div>
                            <div style={{ fontSize: 11, color: "#64748B", marginTop: 1 }}>
                              {item.total_pemotongan} Batch Pemotongan
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: 11.5, color: "#94A3B8", background: "#F1F5F9", padding: "2px 8px", borderRadius: 6 }}>
                            Belum Ada SPK
                          </span>
                        )}
                      </td>

                      {/* TARIF CMT VENDOR */}
                      <td style={{ padding: "14px 18px", textAlign: "center", verticalAlign: "middle" }}>
                        {hasTarif ? (
                          <button
                            onClick={() => setDetailModal(item)}
                            style={{
                              background: "#FAF5FF",
                              color: "#6D28D9",
                              border: "1px solid #E9D5FF",
                              padding: "4px 10px",
                              borderRadius: 10,
                              cursor: "pointer",
                              textAlign: "center"
                            }}
                            title="Klik untuk melihat rincian tarif tiap vendor CMT"
                          >
                            <div style={{ fontSize: 13, fontWeight: 900 }}>
                              Rp {Number(item.avg_tarif_cmt).toLocaleString("id-ID")} <span style={{ fontSize: 10, fontWeight: 600 }}>/ pcs</span>
                            </div>
                            <div style={{ fontSize: 10.5, color: "#7C3AED", fontWeight: 700 }}>
                              {item.vendor_tarifs.length} Vendor CMT &bull; Lihat
                            </div>
                          </button>
                        ) : (
                          <Link
                            href="/atur-vendor"
                            style={{
                              fontSize: 11,
                              color: "#2563EB",
                              background: "#EFF6FF",
                              border: "1px solid #BFDBFE",
                              padding: "4px 8px",
                              borderRadius: 6,
                              textDecoration: "none",
                              fontWeight: 700,
                              display: "inline-block"
                            }}
                          >
                            + Atur Tarif CMT
                          </Link>
                        )}
                      </td>

                      {/* AKSI */}
                      <td style={{ padding: "14px 18px", textAlign: "right", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
                          <button 
                            onClick={() => setDetailModal(item)}
                            style={{ 
                              padding: "6px 10px", 
                              fontSize: 12, 
                              display: "inline-flex", 
                              alignItems: "center", 
                              gap: 4, 
                              fontWeight: 700,
                              borderRadius: 8,
                              border: "1px solid #CBD5E1",
                              background: "#FFFFFF",
                              color: "#334155",
                              cursor: "pointer"
                            }}
                            title="Lihat Detail & Integrasi Pola"
                          >
                            <Eye size={13} color="#2563EB" /> Detail
                          </button>

                          <button 
                            onClick={() => openEdit(item)}
                            style={{ 
                              padding: "6px 10px", 
                              fontSize: 12, 
                              display: "inline-flex", 
                              alignItems: "center", 
                              gap: 4, 
                              fontWeight: 700,
                              borderRadius: 8,
                              border: "1px solid #BFDBFE",
                              background: "#EFF6FF",
                              color: "#1D4ED8",
                              cursor: "pointer"
                            }}
                            title="Edit Kategori / Model Pola"
                          >
                            <Edit2 size={13} />
                          </button>

                          <button 
                            onClick={() => handleDelete(item.id, item.nama)} 
                            style={{ 
                              padding: "6px 10px", 
                              background: "#FEF2F2", 
                              color: "#EF4444", 
                              borderRadius: 8, 
                              border: "1px solid #FEE2E2", 
                              cursor: "pointer", 
                              display: "inline-flex", 
                              alignItems: "center", 
                              justifyContent: "center" 
                            }} 
                            title="Hapus Kategori"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DETAIL KATEGORI & INTEGRASI POLA */}
      {detailModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div style={{ background: "white", width: "100%", maxWidth: 600, borderRadius: 18, overflow: "hidden", boxShadow: "0 25px 60px rgba(0,0,0,0.3)", display: "flex", flexDirection: "column", maxHeight: "90vh" }}>
            
            {/* MODAL HEADER */}
            <div style={{ padding: "18px 24px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#F8FAFC" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563EB" }}>
                  <Tags size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: "#0F172A" }}>
                    Detail Kategori: {detailModal.nama}
                  </h3>
                  <div style={{ fontSize: 12, color: "#64748B" }}>UID: {detailModal.uid} &bull; ID: #{detailModal.id}</div>
                </div>
              </div>
              <button onClick={() => setDetailModal(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B" }}>
                <X size={18} />
              </button>
            </div>

            {/* MODAL BODY */}
            <div style={{ padding: 24, overflowY: "auto", display: "flex", flexDirection: "column", gap: 18 }}>
              {/* DESKRIPSI CARD */}
              <div style={{ background: "#F8FAFC", padding: "14px 18px", borderRadius: 10, border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>Deskripsi & Karakteristik Model Pola</div>
                <div style={{ fontSize: 13, color: "#0F172A", marginTop: 4, lineHeight: 1.4 }}>
                  {detailModal.deskripsi || "Belum ada catatan deskripsi untuk kategori model pola ini."}
                </div>
              </div>

              {/* INTEGRASI PRODUKSI */}
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", margin: "0 0 8px", display: "flex", alignItems: "center", gap: 6 }}>
                  <Scissors size={14} color="#059669" /> Riwayat Produksi SPK
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ background: "#ECFDF5", padding: "12px 16px", borderRadius: 10, border: "1px solid #A7F3D0" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#065F46" }}>Total Pcs Diterbitkan</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: "#065F46", marginTop: 2 }}>
                      {Number(detailModal.total_pcs_potong || 0).toLocaleString("id-ID")} Pcs
                    </div>
                  </div>
                  <div style={{ background: "#EFF6FF", padding: "12px 16px", borderRadius: 10, border: "1px solid #BFDBFE" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#1D4ED8" }}>Batch Pemotongan Kain</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: "#1D4ED8", marginTop: 2 }}>
                      {detailModal.total_pemotongan || 0} Batch SPK
                    </div>
                  </div>
                </div>
              </div>

              {/* DAFTAR TARIF CMT VENDOR */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                    <DollarSign size={14} color="#7C3AED" /> Tarif Khusus CMT per Vendor
                  </h4>
                  <Link 
                    href="/atur-vendor" 
                    style={{ fontSize: 11.5, color: "#2563EB", fontWeight: 700, textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}
                  >
                    Kelola di Atur Vendor <ChevronRight size={12} />
                  </Link>
                </div>

                {(!detailModal.vendor_tarifs || detailModal.vendor_tarifs.length === 0) ? (
                  <div style={{ padding: "16px", background: "#FAF5FF", borderRadius: 10, border: "1px dashed #D8B4FE", textAlign: "center", color: "#6B21A8", fontSize: 12.5 }}>
                    Belum ada tarif khusus vendor CMT yang dikonfigurasi untuk model pola <strong>{detailModal.nama}</strong>.
                    <div style={{ marginTop: 6 }}>
                      <Link href="/atur-vendor" style={{ color: "#7C3AED", fontWeight: 800, textDecoration: "underline" }}>
                        Buka Menu Atur Vendor untuk Menentukan Tarif
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div style={{ border: "1px solid #E2E8F0", borderRadius: 10, overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                      <thead>
                        <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", textAlign: "left" }}>
                          <th style={{ padding: "8px 12px", color: "#64748B", fontWeight: 700 }}>Nama Vendor</th>
                          <th style={{ padding: "8px 12px", color: "#64748B", fontWeight: 700 }}>Tipe Vendor</th>
                          <th style={{ padding: "8px 12px", color: "#64748B", fontWeight: 700, textAlign: "right" }}>Tarif Jahit / Pcs</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailModal.vendor_tarifs.map((vt: any, i: number) => (
                          <tr key={i} style={{ borderBottom: i === detailModal.vendor_tarifs.length - 1 ? "none" : "1px solid #E2E8F0" }}>
                            <td style={{ padding: "9px 12px", fontWeight: 700, color: "#0F172A" }}>
                              {vt.vendor_nama}
                            </td>
                            <td style={{ padding: "9px 12px", color: "#64748B", textTransform: "uppercase", fontSize: 11, fontWeight: 700 }}>
                              {vt.tipe || "CMT"}
                            </td>
                            <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 800, color: "#7C3AED" }}>
                              Rp {Number(vt.tarif).toLocaleString("id-ID")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* MODAL FOOTER */}
            <div style={{ padding: "16px 24px", borderTop: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#F8FAFC" }}>
              <button 
                onClick={() => setDetailModal(null)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 10,
                  border: "1px solid #CBD5E1",
                  background: "#FFFFFF",
                  color: "#475569",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                Tutup
              </button>

              <button 
                onClick={() => {
                  const item = detailModal;
                  setDetailModal(null);
                  openEdit(item);
                }}
                style={{
                  padding: "8px 18px",
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
                <Edit2 size={14} /> Edit Kategori Ini
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH / EDIT KATEGORI */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div style={{ background: "white", width: "100%", maxWidth: 540, borderRadius: 18, overflow: "hidden", boxShadow: "0 25px 60px rgba(0,0,0,0.3)", display: "flex", flexDirection: "column" }}>
            
            {/* MODAL HEADER */}
            <div style={{ padding: "18px 24px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(135deg, #F8FAFC, #EFF6FF)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "#DBEAFE", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563EB" }}>
                  <Tags size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: "#0F172A" }}>
                    {editingId ? "Edit Kategori Produk / Model Pola" : "Tambah Kategori Baru"}
                  </h3>
                  <div style={{ fontSize: 12, color: "#64748B" }}>
                    {editingId ? "Perbarui nama dan deskripsi pola model pakaian" : "Daftarkan nama kategori pola produk baru ke sistem"}
                  </div>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B" }}>
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
                {/* NAMA KATEGORI */}
                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                    Nama Kategori / Model Pola <span style={{ color: "#EF4444" }}>*</span>
                  </label>
                  <input 
                    type="text" 
                    value={formData.nama}
                    onChange={e => setFormData({ ...formData, nama: e.target.value.toUpperCase() })}
                    placeholder="Contoh: PECAH POLA, GOMBRONG, REGULAR FIT..."
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #CBD5E1", fontSize: 13.5, outline: "none", boxSizing: "border-box", fontWeight: 700 }}
                    required
                  />
                  
                  {/* PRESET CHIPS */}
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 11, color: "#64748B", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
                      <Sparkles size={11} color="#2563EB" /> Rekomendasi nama model pola jeans:
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {presetSuggestions.map((p, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setFormData({ ...formData, nama: p })}
                          style={{
                            fontSize: 11,
                            padding: "3px 8px",
                            borderRadius: 6,
                            border: "1px solid #E2E8F0",
                            background: formData.nama === p ? "#EFF6FF" : "#F8FAFC",
                            color: formData.nama === p ? "#1D4ED8" : "#475569",
                            cursor: "pointer",
                            fontWeight: formData.nama === p ? 800 : 600
                          }}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* DESKRIPSI */}
                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                    Deskripsi / Spesifikasi Pola
                  </label>
                  <textarea 
                    value={formData.deskripsi}
                    onChange={e => setFormData({ ...formData, deskripsi: e.target.value })}
                    placeholder="Contoh: Pola celana model baggy gombrong, saku depan miring, konsumsi kain rata-rata 130-140 cm..."
                    rows={3}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #CBD5E1", fontSize: 13, outline: "none", resize: "none", boxSizing: "border-box" }}
                  />
                  <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 4 }}>
                    *Nama kategori pola ini akan otomatis terhubung ke formulir <strong>Pemotongan Kain</strong> dan tabel <strong>Tarif Vendor CMT</strong>.
                  </div>
                </div>
              </div>

              {/* MODAL FOOTER */}
              <div style={{ padding: "16px 24px", borderTop: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#F8FAFC" }}>
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  style={{
                    padding: "9px 18px",
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
                    padding: "10px 24px",
                    borderRadius: 10,
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
                  <CheckCircle2 size={16} /> {isSubmitting ? "Menyimpan..." : (editingId ? "Simpan Perubahan" : "Tambahkan Kategori")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
