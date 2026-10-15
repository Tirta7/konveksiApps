"use client";
import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  Scissors,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Search,
  RefreshCw,
  Phone,
  MessageSquare,
  Layers,
  FileText,
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle,
  Hash,
  LayoutGrid,
  List
} from "lucide-react";
import { toast } from "sonner";

export default function AturTukangPotongPage() {
  const [data, setData] = useState<any[]>([]);
  const _bgRefresh = useRef(false);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    id: 0,
    nama: "",
    kode: "",
    kontak: ""
  });

  const fetchData = async () => {
    if (!_bgRefresh.current) setLoading(true);
    try {
      const res = await fetch("/api/tukang-potong?_t=" + Date.now());
      const json = await res.json();
      setData(Array.isArray(json) ? json : []);
    } catch (e) {
      toast.error("Gagal mengambil data tukang potong");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Real-time sync: refresh data when another admin makes changes
  useEffect(() => {
    const handler = () => {
      _bgRefresh.current = true;
      fetchData();
      setTimeout(() => { _bgRefresh.current = false; }, 500);
    };
    window.addEventListener("konveksi-sync", handler);
    return () => window.removeEventListener("konveksi-sync", handler);
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nama.trim() || !form.kode.trim()) {
      toast.error("Nama dan Kode Prefix wajib diisi.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/tukang-potong", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const resJson = await res.json();
      if (res.ok) {
        toast.success(form.id ? "Data tukang potong berhasil diperbarui" : "Tukang potong baru berhasil ditambahkan");
        setShowModal(false);
        fetchData();
      } else {
        toast.error(resJson.error || "Gagal menyimpan data.");
      }
    } catch (e) {
      toast.error("Terjadi kesalahan koneksi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number, nama: string) => {
    if (!confirm(`Yakin ingin menghapus tukang potong "${nama}"?`)) return;
    try {
      const res = await fetch(`/api/tukang-potong?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Tukang potong berhasil dihapus");
        fetchData();
      } else {
        toast.error("Gagal menghapus tukang potong.");
      }
    } catch (e) {
      toast.error("Terjadi kesalahan koneksi.");
    }
  };

  const openAdd = () => {
    setForm({ id: 0, nama: "", kode: "", kontak: "" });
    setShowModal(true);
  };

  const openEdit = (item: any) => {
    setForm({
      id: item.id,
      nama: item.nama || "",
      kode: item.kode || "",
      kontak: item.kontak || ""
    });
    setShowModal(true);
  };

  // Filtered list
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const q = searchQuery.toLowerCase();
    return data.filter((item) =>
      (item.nama || "").toLowerCase().includes(q) ||
      (item.kode || "").toLowerCase().includes(q) ||
      (item.kontak || "").toLowerCase().includes(q)
    );
  }, [data, searchQuery]);

  // Aggregated totals
  const stats = useMemo(() => {
    const totalTukang = data.length;
    const totalSpk = data.reduce((s, t) => s + (t.total_spk || 0), 0);
    const totalMeter = data.reduce((s, t) => s + (t.total_meter || 0), 0);
    const totalPcs = data.reduce((s, t) => s + (t.total_pcs || 0), 0);
    return { totalTukang, totalSpk, totalMeter, totalPcs };
  }, [data]);

  return (
    <div style={{ padding: "28px 32px", background: "#F1F5F9", minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .cutter-card { transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
        .cutter-card:hover { transform: translateY(-3px); box-shadow: 0 10px 24px rgba(0,0,0,0.08) !important; }
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
                <Scissors size={20} color="#FFFFFF" />
              </div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#0F172A", letterSpacing: "-0.02em" }}>
                Atur Tukang Potong & Meja Kain
              </h1>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "#64748B" }}>
              Kelola master tim potong kain, lokasi meja potong, dan kode unik prefix penomoran PO/SPK (misal: SJ, GH).
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
              <Plus size={16} /> Tambah Tukang Potong
            </button>
          </div>
        </div>

        {/* 4 STATS OVERVIEW CARDS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
          {/* Card 1 */}
          <div style={{ background: "#FFFFFF", borderRadius: 14, padding: "16px 20px", border: "1px solid #E2E8F0", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>Tim / Meja Potong</span>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Scissors size={15} color="#2563EB" />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#0F172A" }}>
              {stats.totalTukang} <span style={{ fontSize: 13, fontWeight: 600, color: "#64748B" }}>Meja</span>
            </div>
            <div style={{ fontSize: 11, color: "#2563EB", fontWeight: 700, marginTop: 4 }}>
              Prefix aktif terdaftar
            </div>
          </div>

          {/* Card 2 */}
          <div style={{ background: "#FFFFFF", borderRadius: 14, padding: "16px 20px", border: "1px solid #E2E8F0", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>Total SPK Pemotongan</span>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "#FFFBEB", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <FileText size={15} color="#D97706" />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#B45309" }}>
              {stats.totalSpk} <span style={{ fontSize: 13, fontWeight: 600, color: "#64748B" }}>Batch</span>
            </div>
            <div style={{ fontSize: 11, color: "#D97706", fontWeight: 700, marginTop: 4 }}>
              Tercatat di sistem
            </div>
          </div>

          {/* Card 3 */}
          <div style={{ background: "#FFFFFF", borderRadius: 14, padding: "16px 20px", border: "1px solid #E2E8F0", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>Bahan Terpotong</span>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "#F0FDF4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <SlidersHorizontal size={15} color="#16A34A" />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#15803D" }}>
              {stats.totalMeter.toLocaleString("id-ID")} <span style={{ fontSize: 13, fontWeight: 600, color: "#64748B" }}>meter</span>
            </div>
            <div style={{ fontSize: 11, color: "#16A34A", fontWeight: 700, marginTop: 4 }}>
              Kain roll denim terpakai
            </div>
          </div>

          {/* Card 4 */}
          <div style={{ background: "#FFFFFF", borderRadius: 14, padding: "16px 20px", border: "1px solid #E2E8F0", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>Hasil Potongan Celana</span>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "#FAF5FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Layers size={15} color="#7C3AED" />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#6D28D9" }}>
              {stats.totalPcs.toLocaleString("id-ID")} <span style={{ fontSize: 13, fontWeight: 600, color: "#64748B" }}>pcs</span>
            </div>
            <div style={{ fontSize: 11, color: "#7C3AED", fontWeight: 700, marginTop: 4 }}>
              Siap masuk jalur CMT
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
        <div style={{ position: "relative", minWidth: 260, flex: "0 1 320px" }}>
          <Search size={14} color="#94A3B8" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
          <input
            type="text"
            placeholder="Cari tukang potong, meja, kode prefix..."
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
          <div style={{ fontSize: 15, fontWeight: 700 }}>Memuat daftar tukang potong...</div>
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
          <Scissors size={32} color="#94A3B8" style={{ marginBottom: 8 }} />
          <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A" }}>Tidak ada data tukang potong</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            {searchQuery ? "Tidak ditemukan hasil yang cocok dengan pencarian Anda." : "Klik tombol '+ Tambah Tukang Potong' untuk mendaftarkan tim meja potong."}
          </div>
        </div>
      ) : viewMode === "cards" ? (
        /* GRID CARDS VIEW */
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
          gap: 18
        }}>
          {filteredData.map((item) => (
            <div
              key={item.id}
              className="cutter-card"
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
              {/* Card Header with denim accent */}
              <div style={{
                background: "linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)",
                padding: "16px 20px",
                color: "#FFFFFF",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {/* Monospace Prefix badge */}
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.2)",
                    backdropFilter: "blur(4px)",
                    border: "1px solid rgba(255,255,255,0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 900,
                    fontSize: 18,
                    fontFamily: "monospace",
                    color: "#FFFFFF"
                  }}>
                    {item.kode}
                  </div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#FFFFFF" }}>
                      {item.nama}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", fontWeight: 600, marginTop: 2 }}>
                      Format No. PO: <strong style={{ color: "#BFDBFE", fontFamily: "monospace" }}>{item.kode}-01</strong>
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
                    onClick={() => handleDelete(item.id, item.nama)}
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

              {/* Card Body */}
              <div style={{ padding: "16px 20px", flex: 1 }}>
                {/* Contact strip */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
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

                {/* 3 Metric counters */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 8,
                  background: "#F8FAFC",
                  borderRadius: 10,
                  padding: "10px",
                  border: "1px solid #E2E8F0"
                }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 9, color: "#64748B", fontWeight: 700, textTransform: "uppercase" }}>Total SPK</div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: "#0F172A", marginTop: 2 }}>
                      {item.total_spk || 0}
                    </div>
                  </div>
                  <div style={{ textAlign: "center", borderLeft: "1px solid #E2E8F0", borderRight: "1px solid #E2E8F0" }}>
                    <div style={{ fontSize: 9, color: "#64748B", fontWeight: 700, textTransform: "uppercase" }}>Meter Kain</div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: "#2563EB", marginTop: 2 }}>
                      {item.total_meter || 0}m
                    </div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 9, color: "#64748B", fontWeight: 700, textTransform: "uppercase" }}>Pcs Jadi</div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: "#059669", marginTop: 2 }}>
                      {item.total_pcs || 0}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
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
                <th style={{ padding: "12px 18px", width: 100 }}>Prefix PO</th>
                <th style={{ padding: "12px 18px" }}>Nama / Lokasi Meja</th>
                <th style={{ padding: "12px 18px" }}>Kontak WhatsApp</th>
                <th style={{ padding: "12px 18px" }}>Contoh Nomor PO</th>
                <th style={{ padding: "12px 18px", textAlign: "center" }}>Total SPK</th>
                <th style={{ padding: "12px 18px", textAlign: "right" }}>Kain Terpotong</th>
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
                      fontSize: 13,
                      padding: "3px 9px",
                      borderRadius: 6,
                      border: "1px solid #BFDBFE"
                    }}>
                      {item.kode}
                    </span>
                  </td>
                  <td style={{ padding: "12px 18px", fontWeight: 800, color: "#0F172A" }}>
                    {item.nama}
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
                  <td style={{ padding: "12px 18px", fontFamily: "monospace", color: "#64748B", fontWeight: 600 }}>
                    {item.kode}-01, {item.kode}-02...
                  </td>
                  <td style={{ padding: "12px 18px", textAlign: "center", fontWeight: 800, color: "#0F172A" }}>
                    {item.total_spk || 0} SPK
                  </td>
                  <td style={{ padding: "12px 18px", textAlign: "right", fontWeight: 800, color: "#2563EB" }}>
                    {item.total_meter || 0} meter ({item.total_pcs || 0} pcs)
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
                        onClick={() => handleDelete(item.id, item.nama)}
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
              maxWidth: 520,
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
                  <Scissors size={18} color="#2563EB" />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#0F172A" }}>
                    {form.id ? "Edit Tukang Potong" : "Tambah Tukang Potong Baru"}
                  </h2>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748B" }}>
                    Atur nama tim meja potong dan kode prefix nomor PO
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

            <form onSubmit={handleSave}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Nama / Lokasi Meja */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                    Nama Tukang / Lokasi Meja Potong <span style={{ color: "#EF4444" }}>*</span>
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="Contoh: DORO atau NGAMPON"
                    value={form.nama}
                    onChange={(e) => setForm({ ...form, nama: e.target.value })}
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

                {/* Kode Prefix PO */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                    Kode Prefix Penomoran PO <span style={{ color: "#EF4444" }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      required
                      type="text"
                      maxLength={4}
                      placeholder="Contoh: SJ atau GH"
                      value={form.kode}
                      onChange={(e) => setForm({ ...form, kode: e.target.value.toUpperCase() })}
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: 8,
                        border: "1.5px solid #CBD5E1",
                        fontSize: 14,
                        fontFamily: "monospace",
                        fontWeight: 800,
                        letterSpacing: 1,
                        boxSizing: "border-box"
                      }}
                    />
                  </div>

                  {/* Live PO Prefix Preview Box */}
                  <div style={{
                    marginTop: 6,
                    padding: "8px 12px",
                    background: "#F8FAFC",
                    border: "1px dashed #CBD5E1",
                    borderRadius: 8,
                    fontSize: 11,
                    color: "#475569"
                  }}>
                    <span>Format nomor PO otomatis: </span>
                    <strong style={{ color: "#2563EB", fontFamily: "monospace" }}>
                      {form.kode ? `${form.kode}-01, ${form.kode}-02...` : "PREFIX-01"}
                    </strong>
                  </div>
                </div>

                {/* Kontak WhatsApp */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                    Kontak WhatsApp / No. HP
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: 08999945216"
                    value={form.kontak}
                    onChange={(e) => setForm({ ...form, kontak: e.target.value })}
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
