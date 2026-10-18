"use client";
import React, { useState, useEffect, useMemo } from "react";
import {
  Store,
  Plus,
  Edit2,
  Trash2,
  X,
  Search,
  RefreshCw,
  Phone,
  MessageSquare,
  MapPin,
  Package,
  Layers,
  DollarSign,
  AlertCircle,
  LayoutGrid,
  List,
  Save,
  Truck
} from "lucide-react";
import { toast } from "sonner";

export default function SupplierPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    nama_supplier: "",
    kontak: "",
    alamat: "",
    jenis_material: ""
  });

  const fetchData = async () => {
    try {
      const res = await fetch("/api/supplier?_t=" + Date.now());
      const json = await res.json();
      setData(Array.isArray(json) ? json : []);
    } catch (err) {
      toast.error("Gagal mengambil data supplier");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Real-time sync: refresh data when another admin makes changes
  useEffect(() => {
    const handler = () => fetchData();
    window.addEventListener("konveksi-sync", handler);
    return () => window.removeEventListener("konveksi-sync", handler);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nama_supplier.trim() || !formData.kontak.trim()) {
      toast.error("Nama supplier dan kontak wajib diisi.");
      return;
    }

    setIsSubmitting(true);
    try {
      const isEdit = editingId !== null;
      const res = await fetch("/api/supplier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, id: editingId })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal menyimpan");
      }

      toast.success(isEdit ? "Data supplier berhasil diperbarui" : "Supplier baru berhasil ditambahkan");
      setShowModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number, nama: string) => {
    if (!confirm(`Yakin ingin menghapus supplier "${nama}"?`)) return;
    try {
      const res = await fetch(`/api/supplier?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal menghapus");
      }
      toast.success("Supplier berhasil dihapus");
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const openAdd = () => {
    setEditingId(null);
    setFormData({ nama_supplier: "", kontak: "", alamat: "", jenis_material: "" });
    setShowModal(true);
  };

  const openEdit = (item: any) => {
    setEditingId(item.id);
    setFormData({
      nama_supplier: item.nama_supplier || "",
      kontak: item.kontak || "",
      alamat: item.alamat || "",
      jenis_material: item.jenis_material || ""
    });
    setShowModal(true);
  };

  // Filtered suppliers
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const q = searchQuery.toLowerCase();
    return data.filter((item) =>
      (item.nama_supplier || "").toLowerCase().includes(q) ||
      (item.uid || "").toLowerCase().includes(q) ||
      (item.jenis_material || "").toLowerCase().includes(q) ||
      (item.alamat || "").toLowerCase().includes(q) ||
      (item.kontak || "").toLowerCase().includes(q)
    );
  }, [data, searchQuery]);

  // Aggregate stats
  const stats = useMemo(() => {
    const totalSupplier = data.length;
    const totalHutang = data.reduce((s, item) => s + (Number(item.total_hutang) || 0), 0);
    const supplierKain = data.filter((item) => (item.jenis_material || "").toLowerCase().includes("kain") || (item.jenis_material || "").toLowerCase().includes("mk")).length;
    const supplierAksesoris = totalSupplier - supplierKain;

    return { totalSupplier, totalHutang, supplierKain, supplierAksesoris };
  }, [data]);

  return (
    <div style={{ padding: "28px 32px 48px 32px", background: "#F1F5F9", minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .sup-card-hover { transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
        .sup-card-hover:hover { transform: translateY(-3px); box-shadow: 0 10px 24px rgba(0,0,0,0.08) !important; }
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
                <Store size={20} color="#FFFFFF" />
              </div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#0F172A", letterSpacing: "-0.02em" }}>
                Data Supplier & Pemasok Bahan Baku
              </h1>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "#64748B" }}>
              Kelola master vendor pemasok kain denim roll, benang jahit, kancing, resleting, dan material produksi.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
              <Plus size={16} /> Tambah Supplier
            </button>
          </div>
        </div>

        {/* 4 KPI SUMMARY CARDS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
          {/* Card 1: Total Supplier */}
          <div style={{ background: "#FFFFFF", borderRadius: 14, padding: "16px 20px", border: "1px solid #E2E8F0", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>Total Pemasok Aktif</span>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Store size={15} color="#2563EB" />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#0F172A" }}>
              {stats.totalSupplier} <span style={{ fontSize: 13, fontWeight: 600, color: "#64748B" }}>Mitra</span>
            </div>
            <div style={{ fontSize: 11, color: "#2563EB", fontWeight: 700, marginTop: 4 }}>
              Pemasok resmi terverifikasi
            </div>
          </div>

          {/* Card 2: Supplier Kain Denim */}
          <div style={{ background: "#FFFFFF", borderRadius: 14, padding: "16px 20px", border: "1px solid #E2E8F0", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>Pemasok Kain Denim</span>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "#F0F9FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Layers size={15} color="#0284C7" />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#0369A1" }}>
              {stats.supplierKain} <span style={{ fontSize: 13, fontWeight: 600, color: "#64748B" }}>Vendor</span>
            </div>
            <div style={{ fontSize: 11, color: "#0284C7", fontWeight: 700, marginTop: 4 }}>
              Kain roll denim & twill
            </div>
          </div>

          {/* Card 3: Aksesoris & Pendukung */}
          <div style={{ background: "#FFFFFF", borderRadius: 14, padding: "16px 20px", border: "1px solid #E2E8F0", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>Aksesoris & Benang</span>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "#FAF5FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Package size={15} color="#7C3AED" />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#6D28D9" }}>
              {stats.supplierAksesoris} <span style={{ fontSize: 13, fontWeight: 600, color: "#64748B" }}>Vendor</span>
            </div>
            <div style={{ fontSize: 11, color: "#7C3AED", fontWeight: 700, marginTop: 4 }}>
              Kancing, resleting, benang
            </div>
          </div>

          {/* Card 4: Total Hutang Dagang */}
          <div style={{ background: "#FFFFFF", borderRadius: 14, padding: "16px 20px", border: "1px solid #E2E8F0", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>Total Hutang Dagang</span>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: stats.totalHutang > 0 ? "#FEF2F2" : "#ECFDF5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <DollarSign size={15} color={stats.totalHutang > 0 ? "#DC2626" : "#059669"} />
              </div>
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: stats.totalHutang > 0 ? "#DC2626" : "#059669" }}>
              Rp {stats.totalHutang.toLocaleString("id-ID")}
            </div>
            <div style={{ fontSize: 11, color: stats.totalHutang > 0 ? "#DC2626" : "#059669", fontWeight: 700, marginTop: 4 }}>
              {stats.totalHutang > 0 ? "Tagihan tempo berjalan" : "Semua lunas"}
            </div>
          </div>
        </div>
      </div>

      {/* FILTER & TOOLBAR */}
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
        marginBottom: 20
      }}>
        {/* Search */}
        <div style={{ position: "relative", minWidth: 260, flex: "0 1 340px" }}>
          <Search size={14} color="#94A3B8" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
          <input
            type="text"
            placeholder="Cari nama supplier, UID, material, alamat..."
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

        {/* View Toggle (Grid / Table) */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ display: "flex", background: "#F1F5F9", padding: 3, borderRadius: 8 }}>
            <button
              onClick={() => setViewMode("cards")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 10px",
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
                background: viewMode === "cards" ? "#FFFFFF" : "transparent",
                color: viewMode === "cards" ? "#1E40AF" : "#64748B",
                fontWeight: viewMode === "cards" ? 800 : 600,
                fontSize: 12,
                boxShadow: viewMode === "cards" ? "0 1px 3px rgba(0,0,0,0.08)" : "none"
              }}
            >
              <LayoutGrid size={14} /> Kartu
            </button>
            <button
              onClick={() => setViewMode("table")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 10px",
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
                background: viewMode === "table" ? "#FFFFFF" : "transparent",
                color: viewMode === "table" ? "#1E40AF" : "#64748B",
                fontWeight: viewMode === "table" ? 800 : 600,
                fontSize: 12,
                boxShadow: viewMode === "table" ? "0 1px 3px rgba(0,0,0,0.08)" : "none"
              }}
            >
              <List size={14} /> Tabel
            </button>
          </div>
        </div>
      </div>

      {/* CONTENT: CARDS OR TABLE */}
      {loading && data.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#64748B" }}>
          <RefreshCw size={24} color="#2563EB" style={{ animation: "spin 1s linear infinite", marginBottom: 10 }} />
          <div style={{ fontSize: 15, fontWeight: 700 }}>Memuat daftar supplier...</div>
        </div>
      ) : filteredData.length === 0 ? (
        <div style={{
          textAlign: "center",
          padding: "60px 20px",
          background: "#FFFFFF",
          borderRadius: 16,
          border: "1.5px dashed #CBD5E1",
          color: "#64748B"
        }}>
          <Store size={32} color="#94A3B8" style={{ marginBottom: 8 }} />
          <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A" }}>Tidak ada data supplier</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            {searchQuery ? "Tidak ditemukan hasil yang cocok dengan pencarian Anda." : "Klik tombol '+ Tambah Supplier' untuk mendaftarkan mitra pemasok."}
          </div>
        </div>
      ) : viewMode === "cards" ? (
        /* GRID CARDS VIEW */
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
          gap: 18
        }}>
          {filteredData.map((item) => {
            const hasHutang = Number(item.total_hutang || 0) > 0;

            return (
              <div
                key={item.id}
                className="sup-card-hover"
                style={{
                  background: "#FFFFFF",
                  borderRadius: 16,
                  border: "1px solid #E2E8F0",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column"
                }}
              >
                {/* Header */}
                <div style={{
                  background: "linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)",
                  padding: "16px 20px",
                  color: "#FFFFFF",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      padding: "4px 8px",
                      borderRadius: 8,
                      background: "rgba(255,255,255,0.2)",
                      backdropFilter: "blur(4px)",
                      border: "1px solid rgba(255,255,255,0.3)",
                      fontSize: 12,
                      fontWeight: 900,
                      fontFamily: "monospace",
                      color: "#FFFFFF"
                    }}>
                      {item.uid}
                    </div>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 900, color: "#FFFFFF" }}>
                        {item.nama_supplier}
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", fontWeight: 600, marginTop: 2 }}>
                        {item.jenis_material}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => openEdit(item)}
                      title="Edit Data"
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        border: "none",
                        background: "rgba(255,255,255,0.2)",
                        color: "#FFFFFF",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id, item.nama_supplier)}
                      title="Hapus"
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        border: "none",
                        background: "rgba(239,68,68,0.35)",
                        color: "#FFFFFF",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Body */}
                <div style={{ padding: "16px 20px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    {/* Contact & WhatsApp */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569" }}>
                        <Phone size={13} color="#64748B" />
                        <span>{item.kontak || "Tanpa Kontak"}</span>
                      </div>

                      {item.kontak && (
                        <a
                          href={`https://wa.me/62${item.kontak.replace(/^0/, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            background: "#ECFDF5",
                            color: "#059669",
                            padding: "3px 9px",
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 800,
                            border: "1px solid #A7F3D0",
                            textDecoration: "none",
                            display: "flex",
                            alignItems: "center",
                            gap: 4
                          }}
                        >
                          <MessageSquare size={11} /> Chat WA
                        </a>
                      )}
                    </div>

                    {/* Address */}
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12, color: "#64748B", marginBottom: 14 }}>
                      <MapPin size={13} color="#94A3B8" style={{ marginTop: 2, flexShrink: 0 }} />
                      <span>{item.alamat || "—"}</span>
                    </div>
                  </div>

                  {/* Hutang strip */}
                  <div style={{
                    background: hasHutang ? "#FEF2F2" : "#F0FDF4",
                    border: `1px solid ${hasHutang ? "#FECACA" : "#BBF7D0"}`,
                    borderRadius: 10,
                    padding: "10px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: hasHutang ? "#991B1B" : "#166534", textTransform: "uppercase" }}>
                        Status Hutang Pembelian
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 900, color: hasHutang ? "#DC2626" : "#15803D", marginTop: 1 }}>
                        Rp {(item.total_hutang || 0).toLocaleString("id-ID")}
                      </div>
                    </div>
                    <span style={{
                      background: hasHutang ? "#FEE2E2" : "#DCFCE7",
                      color: hasHutang ? "#991B1B" : "#166534",
                      fontSize: 10,
                      fontWeight: 800,
                      padding: "3px 8px",
                      borderRadius: 6
                    }}>
                      {hasHutang ? "Ada Tagihan" : "Lunas"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div style={{
          background: "#FFFFFF",
          borderRadius: 14,
          border: "1px solid #E2E8F0",
          overflow: "hidden",
          boxShadow: "0 2px 6px rgba(0,0,0,0.02)"
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1.5px solid #E2E8F0", color: "#64748B", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>
                <th style={{ padding: "12px 18px", width: 110 }}>UID</th>
                <th style={{ padding: "12px 18px" }}>Nama Supplier</th>
                <th style={{ padding: "12px 18px" }}>Kontak WhatsApp</th>
                <th style={{ padding: "12px 18px" }}>Jenis Material</th>
                <th style={{ padding: "12px 18px" }}>Alamat</th>
                <th style={{ padding: "12px 18px", textAlign: "right" }}>Total Hutang</th>
                <th style={{ padding: "12px 18px", textAlign: "right" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((item, idx) => (
                <tr
                  key={item.id}
                  style={{
                    borderBottom: "1px solid #F1F5F9",
                    background: idx % 2 === 0 ? "#FFFFFF" : "#FAFAFC"
                  }}
                >
                  <td style={{ padding: "12px 18px" }}>
                    <span style={{
                      background: "#EFF6FF",
                      color: "#1D4ED8",
                      fontFamily: "monospace",
                      fontWeight: 900,
                      fontSize: 12,
                      padding: "3px 8px",
                      borderRadius: 6,
                      border: "1px solid #BFDBFE"
                    }}>
                      {item.uid}
                    </span>
                  </td>
                  <td style={{ padding: "12px 18px", fontWeight: 800, color: "#0F172A" }}>
                    {item.nama_supplier}
                  </td>
                  <td style={{ padding: "12px 18px" }}>
                    {item.kontak ? (
                      <a
                        href={`https://wa.me/62${item.kontak.replace(/^0/, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#059669", fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
                      >
                        <MessageSquare size={13} /> {item.kontak}
                      </a>
                    ) : (
                      <span style={{ color: "#94A3B8" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "12px 18px" }}>
                    <span style={{
                      background: "#F1F5F9",
                      color: "#334155",
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "3px 8px",
                      borderRadius: 6,
                      border: "1px solid #CBD5E1"
                    }}>
                      {item.jenis_material}
                    </span>
                  </td>
                  <td style={{ padding: "12px 18px", color: "#64748B" }}>
                    {item.alamat || "—"}
                  </td>
                  <td style={{
                    padding: "12px 18px",
                    textAlign: "right",
                    fontWeight: 900,
                    color: Number(item.total_hutang || 0) > 0 ? "#DC2626" : "#059669"
                  }}>
                    Rp {(item.total_hutang || 0).toLocaleString("id-ID")}
                  </td>
                  <td style={{ padding: "12px 18px", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button
                        onClick={() => openEdit(item)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 6,
                          border: "1px solid #CBD5E1",
                          background: "#FFFFFF",
                          color: "#475569",
                          cursor: "pointer"
                        }}
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id, item.nama_supplier)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 6,
                          border: "1px solid #FECACA",
                          background: "#FEF2F2",
                          color: "#DC2626",
                          cursor: "pointer"
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODERN MODAL DIALOG */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 18,
              maxWidth: 500,
              width: "100%",
              padding: "24px 26px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
              border: "1px solid #E2E8F0"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: "#EFF6FF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <Store size={18} color="#2563EB" />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#0F172A" }}>
                    {editingId ? "Edit Data Supplier" : "Tambah Supplier Baru"}
                  </h2>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748B" }}>
                    Pemasok kain denim, benang, dan bahan baku
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: "#F1F5F9", border: "none", width: 30, height: 30, borderRadius: "50%", cursor: "pointer", color: "#64748B", fontWeight: 800 }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Nama Supplier */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                    Nama Supplier / Toko Bahan <span style={{ color: "#EF4444" }}>*</span>
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="Contoh: Toko Kain Mulia Denim"
                    value={formData.nama_supplier}
                    onChange={(e) => setFormData({ ...formData, nama_supplier: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1.5px solid #CBD5E1",
                      fontSize: 13,
                      boxSizing: "border-box"
                    }}
                  />
                </div>

                {/* Kontak WhatsApp */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                    Kontak WhatsApp / No. HP <span style={{ color: "#EF4444" }}>*</span>
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="Contoh: 08123456789"
                    value={formData.kontak}
                    onChange={(e) => setFormData({ ...formData, kontak: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1.5px solid #CBD5E1",
                      fontSize: 13,
                      boxSizing: "border-box"
                    }}
                  />
                </div>

                {/* Jenis Material */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                    Jenis Material Pasokan
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Kain Denim Roll, Benang Obras, Kancing Logam"
                    value={formData.jenis_material}
                    onChange={(e) => setFormData({ ...formData, jenis_material: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1.5px solid #CBD5E1",
                      fontSize: 13,
                      boxSizing: "border-box"
                    }}
                  />
                </div>

                {/* Alamat */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                    Alamat Lengkap / Kota
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Contoh: Jl. Pekalongan Raya No. 45"
                    value={formData.alamat}
                    onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1.5px solid #CBD5E1",
                      fontSize: 13,
                      boxSizing: "border-box",
                      resize: "none"
                    }}
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    padding: "9px 16px",
                    borderRadius: 8,
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
                    borderRadius: 8,
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
                  <Save size={14} />
                  <span>{isSubmitting ? "Menyimpan..." : "Simpan Data"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
