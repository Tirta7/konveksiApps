"use client";

import { useState, useEffect, useMemo, useCallback, Fragment } from "react";
import { Plus, Edit2, Trash2, X, Barcode, Search, Package, Boxes, Wallet, TrendingUp, ShoppingBag, Info, ChevronDown, ChevronUp, ChevronRight, Factory, PenLine, Store, Globe, Truck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import BarangBarcodeModal from "@/components/BarangBarcodeModal";

const rp = (n: number) => `Rp ${Number(n || 0).toLocaleString("id-ID")}`;
const tgl = (s?: string | null) => (s ? new Date(s).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "-");
const KANAL_UI: Record<string, { icon: any; color: string; bg: string; short: string }> = {
  "Retail Offline": { icon: Store, color: "#047857", bg: "#ECFDF5", short: "Retail" },
  "Penjualan Grosir": { icon: Truck, color: "#4F46E5", bg: "#EEF2FF", short: "Grosir" },
  "Penjualan Online": { icon: Globe, color: "#DB2777", bg: "#FDF2F8", short: "Online" },
};

export default function BarangPage() {
  const [data, setData] = useState<any[]>([]);
  const [kategoriList, setKategoriList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingLinked, setEditingLinked] = useState(false);
  const [barcodeItem, setBarcodeItem] = useState<any | null>(null);
  const [q, setQ] = useState("");
  const [fKategori, setFKategori] = useState("semua");
  const [fSumber, setFSumber] = useState("semua");
  const [open, setOpen] = useState<Set<number>>(new Set());

  const [formData, setFormData] = useState({ kategori_id: "", nama_barang: "", harga_beli: "", harga_jual: "", stok: "" });

  const fetchData = useCallback(async () => {
    try {
      const [resBarang, resKategori] = await Promise.all([fetch(`/api/barang?_t=${Date.now()}`), fetch("/api/kategori")]);
      const jsonBarang = await resBarang.json();
      const jsonKategori = await resKategori.json();
      setData(Array.isArray(jsonBarang) ? jsonBarang : []);
      setKategoriList(Array.isArray(jsonKategori) ? jsonKategori : []);
    } catch {
      toast.error("Gagal mengambil data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  // Real-time sync: refresh data when another admin makes changes
  useEffect(() => {
    window.addEventListener("konveksi-sync", fetchData);
    return () => window.removeEventListener("konveksi-sync", fetchData);
  }, [fetchData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.kategori_id || !formData.nama_barang || formData.harga_jual === "") {
      toast.error("Kategori, nama barang, dan harga jual wajib diisi");
      return;
    }
    try {
      const isEdit = editingId !== null;
      const res = await fetch("/api/barang", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, id: editingId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Terjadi kesalahan");
      }
      toast.success(isEdit ? "Barang berhasil diupdate" : "Barang berhasil ditambahkan");
      setShowModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (item: any) => {
    if (!item.bisa_dihapus) {
      toast.error("Barang produksi yang sudah punya barcode / riwayat stok tidak bisa dihapus agar riwayat penjualan tetap utuh.");
      return;
    }
    if (!confirm(`Yakin ingin menghapus ${item.nama_barang}?`)) return;
    try {
      const res = await fetch(`/api/barang?id=${item.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal menghapus");
      }
      toast.success("Barang berhasil dihapus");
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const openAdd = () => {
    setEditingId(null);
    setEditingLinked(false);
    setFormData({ kategori_id: "", nama_barang: "", harga_beli: "", harga_jual: "", stok: "" });
    setShowModal(true);
  };
  const openEdit = (item: any) => {
    setEditingId(item.id);
    setEditingLinked(!!item.stok_dari_gudang);
    setFormData({
      kategori_id: String(item.kategori_id || ""),
      nama_barang: item.nama_barang,
      harga_beli: item.harga_beli ? String(item.harga_beli) : "",
      harga_jual: item.harga_jual ? String(item.harga_jual) : "",
      stok: item.stok ? String(item.stok) : "",
    });
    setShowModal(true);
  };
  const toggle = (id: number) => setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.filter((b) =>
      (fKategori === "semua" || String(b.kategori_id) === fKategori) &&
      (fSumber === "semua" || b.sumber === fSumber) &&
      (!s || [b.nama_barang, b.kode, b.uid, b.kategori_nama].some((v) => String(v || "").toLowerCase().includes(s)))
    );
  }, [data, q, fKategori, fSumber]);

  const tot = useMemo(() => ({
    jenis: data.length,
    stok: data.reduce((a, b) => a + Number(b.stok || 0), 0),
    modal: data.reduce((a, b) => a + Number(b.nilai_modal || 0), 0),
    jual: data.reduce((a, b) => a + Number(b.nilai_jual || 0), 0),
    terjual: data.reduce((a, b) => a + Number(b.barcode?.terjual || 0), 0),
    omzet: data.reduce((a, b) => a + Number(b.omzet || 0), 0),
    tanpaModal: data.filter((b) => !Number(b.harga_beli)).length,
  }), [data]);

  const margin = Number(formData.harga_jual || 0) - Number(formData.harga_beli || 0);
  const th: React.CSSProperties = { padding: "12px 14px", textAlign: "left", fontSize: 11, color: "#64748B", fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", whiteSpace: "nowrap" };
  const inp: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 14, outline: "none", background: "white" };
  const lbl: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 };

  return (
    <div className="brg-page-root">
      <style>{`
        .brg-page-root {
          display: flex;
          flex-direction: column;
          height: 100vh !important;
          max-height: 100vh !important;
          padding-bottom: 0 !important;
          background: #F1F5F9;
          overflow: hidden;
          box-sizing: border-box;
          width: 100%;
        }
        .brg-scroll-area {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 16px 32px 32px 32px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          width: 100%;
          box-sizing: border-box;
        }
        @media (max-width: 768px) {
          .brg-scroll-area {
            padding: 12px 16px 24px 16px;
          }
        }
        .brg-stats-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 12px;
          width: 100%;
        }
        @media (max-width: 1280px) {
          .brg-stats-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        @media (max-width: 820px) {
          .brg-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 540px) {
          .brg-stats-grid {
            grid-template-columns: 1fr;
          }
        }
        .brg-detail-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1.1fr);
          gap: 12px;
          align-items: start;
          width: 100%;
        }
        @media (max-width: 1140px) {
          .brg-detail-grid {
            grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
          }
        }
        @media (max-width: 860px) {
          .brg-detail-grid {
            grid-template-columns: 1fr;
          }
        }
        .brg-scroll-area::-webkit-scrollbar {
          width: 8px;
        }
        .brg-scroll-area::-webkit-scrollbar-track {
          background: #E2E8F0;
          border-radius: 99px;
        }
        .brg-scroll-area::-webkit-scrollbar-thumb {
          background: #94A3B8;
          border-radius: 99px;
        }
        .brg-scroll-area::-webkit-scrollbar-thumb:hover {
          background: #64748B;
        }
        .brg-row:hover{background:#F8FAFC}
        .brg-act:hover{filter:brightness(0.95);transform:translateY(-1px)}
        .brg-act{transition:all .15s}
      `}</style>
      <div style={{ padding: "16px 32px", background: "white", borderBottom: "1px solid #E2E8F0", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 20, width: "100%", boxSizing: "border-box" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: "#0F172A", marginBottom: 2 }}>Data Barang</h1>
          <p style={{ fontSize: 12.5, color: "#64748B" }}>Master barang jadi — stok per size dari Gudang &amp; Stok, barcode per pcs, dan penjualan per kanal</p>
        </div>
        <button id="btn-tambah-barang" onClick={openAdd} style={{ background: "#2563EB", color: "white", padding: "9px 18px", borderRadius: 8, fontWeight: 600, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          <Plus size={16} /> Tambah Barang
        </button>
      </div>

      <div className="brg-scroll-area">
        {/* Ringkasan Responsif */}
        <div className="brg-stats-grid">
          {[
            { l: "Jenis Barang", v: `${tot.jenis}`, sub: "barang jadi terdaftar", I: Package, c: "#2563EB", bg: "#EFF6FF" },
            { l: "Total Stok Gudang", v: `${tot.stok.toLocaleString("id-ID")} pcs`, sub: "siap dijual saat ini", I: Boxes, c: "#059669", bg: "#ECFDF5" },
            { l: "Nilai Stok (Modal)", v: rp(tot.modal), sub: tot.tanpaModal ? `${tot.tanpaModal} barang belum ada HPP` : "stok × harga modal", I: Wallet, c: "#D97706", bg: "#FFFBEB", warn: tot.tanpaModal > 0 },
            { l: "Potensi Omzet", v: rp(tot.jual), sub: "stok × harga jual", I: TrendingUp, c: "#7C3AED", bg: "#F5F3FF" },
            { l: "Terjual (Scan Barcode)", v: `${tot.terjual.toLocaleString("id-ID")} pcs`, sub: rp(tot.omzet), I: ShoppingBag, c: "#DB2777", bg: "#FDF2F8" },
          ].map((c) => (
            <div key={c.l} style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: 12, padding: "12px 14px", display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: c.bg, color: c.c, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><c.I size={18} /></div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B" }}>{c.l}</div>
                <div style={{ fontSize: 17, fontWeight: 900, color: "#0F172A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.v}</div>
                <div style={{ fontSize: 10.5, color: (c as any).warn ? "#B45309" : "#94A3B8", fontWeight: (c as any).warn ? 700 : 500 }}>{c.sub}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 12, padding: "10px 14px", fontSize: 12, color: "#1E3A8A", lineHeight: 1.6, width: "100%", boxSizing: "border-box" }}>
          <Info size={15} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <b>Barang Produksi</b> <Factory size={11} /> stoknya otomatis: <b>bertambah</b> saat diterima di Gudang &amp; Stok, <b>berkurang</b> saat barcode di-scan di Retail / Grosir / Online, dan <b>kembali</b> saat retur sesuai — tidak bisa diubah manual.
            {" "}<b>Barang Manual</b> <PenLine size={11} /> (tanpa barcode) stoknya diisi sendiri. Klik baris untuk melihat rincian per size &amp; asal PO.
          </div>
        </div>

        {/* Filter */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", width: "100%", boxSizing: "border-box" }}>
          <div style={{ display: "flex", alignItems: "center", background: "white", border: "1px solid #CBD5E1", borderRadius: 10, padding: "0 12px", flex: "1 1 240px", maxWidth: 360 }}>
            <Search size={16} color="#94A3B8" />
            <input id="cari-barang" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama, kode, atau kategori…" style={{ flex: 1, border: "none", outline: "none", padding: "10px", fontSize: 13 }} />
          </div>
          <select value={fKategori} onChange={(e) => setFKategori(e.target.value)} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #CBD5E1", fontSize: 13, fontWeight: 600, background: "white" }}>
            <option value="semua">Semua Kategori</option>
            {kategoriList.map((k) => <option key={k.id} value={String(k.id)}>{k.nama}</option>)}
          </select>
          <div style={{ display: "flex", background: "#E2E8F0", borderRadius: 10, padding: 3 }}>
            {[["semua", "Semua"], ["produksi", "Produksi"], ["manual", "Manual"]].map(([v, l]) => (
              <button key={v} onClick={() => setFSumber(v)} style={{ padding: "7px 12px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", background: fSumber === v ? "white" : "transparent", color: fSumber === v ? "#0F172A" : "#64748B" }}>{l}</button>
            ))}
          </div>

          {rows.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (open.size === rows.length) {
                  setOpen(new Set());
                } else {
                  setOpen(new Set(rows.map((r) => r.id)));
                }
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid #CBD5E1",
                background: "white",
                fontSize: 12,
                fontWeight: 700,
                color: "#334155",
                cursor: "pointer",
                transition: "all 0.15s"
              }}
            >
              {open.size === rows.length ? (
                <>
                  <ChevronUp size={14} /> Tutup Semua Detail
                </>
              ) : (
                <>
                  <ChevronDown size={14} /> Buka Semua Detail
                </>
              )}
            </button>
          )}

          <span style={{ marginLeft: "auto", fontSize: 12, color: "#64748B" }}>{rows.length} dari {data.length} barang</span>
        </div>

        {/* Tabel */}
        <div style={{ background: "white", borderRadius: 14, border: "1px solid #E2E8F0", overflowX: "auto", width: "100%", boxSizing: "border-box" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 920 }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                <th style={{ ...th, width: 36 }} />
                <th style={{ ...th, width: "24%", minWidth: 180 }}>Barang</th>
                <th style={{ ...th, width: "12%", minWidth: 110 }}>Kategori</th>
                <th style={{ ...th, width: "16%", minWidth: 150, textAlign: "right" }}>Harga Modal / Jual</th>
                <th style={{ ...th, width: "20%", minWidth: 160 }}>Stok per Size</th>
                <th style={{ ...th, width: "9%", minWidth: 80, textAlign: "right" }}>Stok</th>
                <th style={{ ...th, width: "11%", minWidth: 120 }}>Terjual</th>
                <th style={{ ...th, width: "8%", minWidth: 110, textAlign: "right" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ padding: 24, textAlign: "center", color: "#64748B" }}>Memuat data...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 24, textAlign: "center", color: "#64748B" }}>{data.length ? "Tidak ada barang yang cocok dengan filter" : "Belum ada data barang"}</td></tr>
              ) : rows.map((item) => {
                const isOpen = open.has(item.id);
                const mg = Number(item.harga_jual || 0) - Number(item.harga_beli || 0);
                const mgPct = Number(item.harga_beli) ? Math.round((mg / Number(item.harga_beli)) * 100) : null;
                const lakuPct = item.barcode?.total ? Math.round((item.barcode.terjual / item.barcode.total) * 100) : 0;
                return (
                  <Fragment key={item.id}>
                    <tr className="brg-row" onClick={() => toggle(item.id)} style={{ borderTop: "1px solid #F1F5F9", cursor: "pointer", background: isOpen ? "#F8FAFC" : undefined }}>
                      <td style={{ padding: "14px 0 14px 14px", color: "#94A3B8" }}>{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                      <td style={{ padding: "14px" }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{item.nama_barang}</div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
                          <span style={{ fontFamily: "monospace", fontSize: 12, color: "#64748B" }}>{item.kode || item.uid}</span>
                          {item.sumber === "produksi"
                            ? <span title="Stok dari Gudang & Stok (produksi)" style={{ display: "inline-flex", gap: 3, alignItems: "center", fontSize: 10, fontWeight: 800, color: "#0369A1", background: "#E0F2FE", padding: "2px 6px", borderRadius: 5 }}><Factory size={10} /> PRODUKSI</span>
                            : <span title="Stok diisi manual" style={{ display: "inline-flex", gap: 3, alignItems: "center", fontSize: 10, fontWeight: 800, color: "#6B21A8", background: "#F3E8FF", padding: "2px 6px", borderRadius: 5 }}><PenLine size={10} /> MANUAL</span>}
                        </div>
                      </td>
                      <td style={{ padding: "14px" }}>
                        {item.kategori_nama
                          ? <span style={{ background: "#EFF6FF", color: "#2563EB", padding: "4px 8px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>{item.kategori_nama}</span>
                          : <span style={{ fontSize: 12, color: "#94A3B8" }}>—</span>}
                      </td>
                      <td style={{ padding: "14px", textAlign: "right", fontSize: 13 }}>
                        <div style={{ color: Number(item.harga_beli) ? "#475569" : "#B45309", fontWeight: Number(item.harga_beli) ? 500 : 700 }}>{Number(item.harga_beli) ? rp(item.harga_beli) : "HPP belum diisi"}</div>
                        <div style={{ fontWeight: 800, color: "#0F172A" }}>{rp(item.harga_jual)}</div>
                        {mgPct != null && <div style={{ fontSize: 11, color: mg >= 0 ? "#059669" : "#DC2626", fontWeight: 700 }}>margin {rp(mg)} ({mgPct}%)</div>}
                      </td>
                      <td style={{ padding: "14px" }}>
                        {item.sizes?.length ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {item.sizes.map((s: any) => {
                              const t = s.jumlah + s.terjual;
                              return (
                                <span key={s.size} title={`Sisa ${s.jumlah} pcs dari total awal ${t} pcs masuk (terjual ${s.terjual} pcs)`} style={{ fontSize: 11, padding: "2px 7px", borderRadius: 6, border: "1px solid #E2E8F0", background: s.jumlah > 0 ? "white" : "#FEF2F2", color: s.jumlah > 0 ? "#0F172A" : "#B91C1C" }}>
                                  {s.size} <b>{s.jumlah}</b>{s.terjual > 0 && <span style={{ fontSize: 9.5, color: "#64748B", fontWeight: 700 }}>/{t}</span>}
                                </span>
                              );
                            })}
                          </div>
                        ) : <span style={{ fontSize: 12, color: "#94A3B8" }}>{item.sumber === "manual" ? "tanpa size" : "—"}</span>}
                      </td>
                      <td style={{ padding: "14px", textAlign: "right" }}>
                        <div style={{ fontWeight: 900, fontSize: 15, color: item.stok > 0 ? "#059669" : "#EF4444" }}>{Number(item.stok).toLocaleString("id-ID")} <span style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8" }}>pcs</span></div>
                        {item.barcode?.total > 0 && item.barcode.total !== item.stok && (
                          <div style={{ fontSize: 10.5, color: "#64748B", fontWeight: 600 }}>
                            dari {Number(item.barcode.total).toLocaleString("id-ID")} awal
                          </div>
                        )}
                        {item.barcode?.retur_banding > 0 && <div title="Pcs retur tidak sesuai (tidak masuk stok, dalam proses banding)" style={{ fontSize: 10, color: "#B45309", fontWeight: 700 }}>+{item.barcode.retur_banding} retur banding</div>}
                      </td>
                      <td style={{ padding: "14px" }}>
                        {item.sumber === "produksi" ? (
                          <>
                            <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>{item.barcode?.terjual || 0} pcs <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600 }}>({lakuPct}% laku)</span></div>
                            <div style={{ height: 5, background: "#F1F5F9", borderRadius: 99, overflow: "hidden", margin: "4px 0" }}><div style={{ width: `${lakuPct}%`, height: "100%", background: "linear-gradient(90deg,#EC4899,#8B5CF6)" }} /></div>
                            <div style={{ display: "flex", gap: 4 }}>
                              {Object.entries(KANAL_UI).map(([k, u]) => item.terjual_kanal?.[k] ? (
                                <span key={k} title={k} style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: 10, fontWeight: 800, padding: "1px 5px", borderRadius: 5, background: u.bg, color: u.color }}><u.icon size={10} /> {item.terjual_kanal[k]}</span>
                              ) : null)}
                            </div>
                          </>
                        ) : <span style={{ fontSize: 12, color: "#94A3B8" }}>—</span>}
                      </td>
                      <td style={{ padding: "14px", textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          {item.sumber === "produksi" && (
                            <button className="brg-act" onClick={() => setBarcodeItem(item)} title="Lihat & cetak barcode per pcs (hanya yang sudah masuk stok)" style={{ padding: "6px 10px", background: "#EEF2FF", color: "#4F46E5", borderRadius: 6, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700 }}><Barcode size={15} /> Barcode</button>
                          )}
                          <button className="brg-act" onClick={() => openEdit(item)} title="Edit nama, kategori & harga" style={{ padding: 6, background: "#F1F5F9", color: "#3B82F6", borderRadius: 6, border: "none", cursor: "pointer" }}><Edit2 size={16} /></button>
                          <button className="brg-act" onClick={() => handleDelete(item)} title={item.bisa_dihapus ? "Hapus barang" : "Tidak bisa dihapus: sudah punya barcode / riwayat stok"} style={{ padding: 6, background: item.bisa_dihapus ? "#FEF2F2" : "#F8FAFC", color: item.bisa_dihapus ? "#EF4444" : "#CBD5E1", borderRadius: 6, border: "none", cursor: item.bisa_dihapus ? "pointer" : "not-allowed" }}><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr style={{ background: "#F8FAFC" }}>
                        <td />
                        <td colSpan={7} style={{ padding: "0 14px 16px" }}>
                          {item.sumber === "produksi" ? (
                            <div className="brg-detail-grid">
                              {/* Kolom 1: Tabel Rincian Size & SKU */}
                              <div style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                                  <thead><tr style={{ background: "#F8FAFC", color: "#64748B", fontSize: 10, textTransform: "uppercase" }}>
                                    <th style={{ padding: "6px 8px", textAlign: "left" }}>Size</th>
                                    <th style={{ padding: "6px 8px", textAlign: "left" }}>SKU</th>
                                    <th style={{ padding: "6px 8px", textAlign: "right" }} title="Sisa stok gudang / Total stok awal masuk">Sisa / Awal</th>
                                    <th style={{ padding: "6px 8px", textAlign: "right" }}>Terjual</th>
                                    <th style={{ padding: "6px 8px", textAlign: "left", width: "30%" }}>Laku</th>
                                  </tr></thead>
                                  <tbody>
                                    {item.sizes.map((s: any) => {
                                      const t = s.jumlah + s.terjual;
                                      const p = t ? Math.round((s.terjual / t) * 100) : 0;
                                      return (
                                        <tr key={s.size} style={{ borderTop: "1px solid #F1F5F9" }}>
                                          <td style={{ padding: "5px 8px", fontWeight: 800 }}>{s.size}</td>
                                          <td style={{ padding: "5px 8px", fontFamily: "monospace", color: "#64748B" }}>{s.sku || "-"}</td>
                                          <td style={{ padding: "5px 8px", textAlign: "right", whiteSpace: "nowrap" }} title={`Sisa ${s.jumlah} pcs dari total ${t} pcs stok awal (terjual ${s.terjual} pcs)`}>
                                            <span style={{ fontWeight: 800, color: s.jumlah > 0 ? "#059669" : "#DC2626", fontSize: 12.5 }}>{s.jumlah}</span>
                                            <span style={{ color: "#94A3B8", fontSize: 11, fontWeight: 700 }}> / {t}</span>
                                          </td>
                                          <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 700, color: s.terjual > 0 ? "#8B5CF6" : "#64748B" }}>{s.terjual}</td>
                                          <td style={{ padding: "5px 8px" }}><div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ flex: 1, height: 5, background: "#F1F5F9", borderRadius: 99 }}><div style={{ width: `${p}%`, height: "100%", borderRadius: 99, background: "#8B5CF6" }} /></div><span style={{ fontSize: 10, color: "#64748B", width: 28 }}>{p}%</span></div></td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>

                              {/* Kolom 2: Asal Produksi (PO) */}
                              <div style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: 12, padding: 12, fontSize: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                                <div>
                                  <div style={{ fontWeight: 800, color: "#0F172A", marginBottom: 6, fontSize: 12.5 }}>Asal Produksi (PO)</div>
                                  {item.lots?.length ? item.lots.map((l: any) => (
                                    <div key={l.po_id} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}><span style={{ fontFamily: "monospace", fontWeight: 700, color: "#2563EB" }}>{l.noPo}</span><b>{l.jumlah} pcs masuk</b></div>
                                  )) : <div style={{ color: "#94A3B8" }}>-</div>}
                                </div>
                                <div style={{ borderTop: "1px dashed #E2E8F0", paddingTop: 6, color: "#64748B", fontSize: 11 }}>Masuk: <b>{tgl(item.lastMasuk)}</b> · Keluar: <b>{tgl(item.lastKeluar)}</b></div>
                              </div>

                              {/* Kolom 3: Penjualan per Kanal */}
                              <div style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: 12, padding: 12, fontSize: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                                <div>
                                  <div style={{ fontWeight: 800, color: "#0F172A", marginBottom: 6, fontSize: 12.5 }}>Penjualan per Kanal</div>
                                  {Object.entries(KANAL_UI).map(([k, u]) => (
                                    <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0" }}><span style={{ display: "flex", gap: 6, alignItems: "center", color: u.color, fontWeight: 700 }}><u.icon size={13} /> {k}</span><b>{item.terjual_kanal?.[k] || 0} pcs</b></div>
                                  ))}
                                </div>
                                <div>
                                  <div style={{ borderTop: "1px dashed #E2E8F0", paddingTop: 6, display: "flex", justifyContent: "space-between" }}><span style={{ color: "#64748B" }}>Omzet terjual</span><b style={{ color: "#DB2777" }}>{rp(item.omzet)}</b></div>
                                  {item.retur > 0 && <div style={{ marginTop: 4, color: "#B45309", display: "flex", gap: 4, alignItems: "center", fontSize: 11 }}><AlertTriangle size={12} /> {item.retur} pcs pernah diretur ({item.barcode.retur_banding} masih banding)</div>}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div style={{ fontSize: 12, color: "#64748B", background: "white", border: "1px dashed #CBD5E1", borderRadius: 10, padding: 12 }}>
                              Barang manual — stok <b>{item.stok} pcs</b> diisi lewat tombol Edit. Barang ini tidak memiliki barcode per pcs, sehingga belum bisa dijual lewat scan. Untuk barang hasil produksi, gunakan alur PO → Gudang &amp; Stok.
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "white", width: "100%", maxWidth: 520, margin: "16px", borderRadius: 16, overflow: "hidden", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", margin: 0 }}>{editingId ? "Edit Barang" : "Tambah Barang Manual"}</h2>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B" }}><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              {!editingId && (
                <div style={{ fontSize: 12, color: "#92400E", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "10px 12px", lineHeight: 1.5 }}>
                  Barang hasil produksi <b>otomatis dibuat</b> saat PO diterima di Gudang &amp; Stok (lengkap dengan barcode per pcs). Gunakan form ini hanya untuk barang <b>non-produksi</b> (stok manual, tanpa barcode).
                </div>
              )}
              <div>
                <label style={lbl}>Kategori Produk</label>
                <select value={formData.kategori_id} onChange={(e) => setFormData({ ...formData, kategori_id: e.target.value })} style={inp} required>
                  <option value="">-- Pilih Kategori --</option>
                  {kategoriList.map((k) => <option key={k.id} value={k.id}>{k.nama}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Nama Barang</label>
                <input type="text" value={formData.nama_barang} onChange={(e) => setFormData({ ...formData, nama_barang: e.target.value })} placeholder="Contoh: Jeans Reguler Hitam" style={inp} required />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={lbl}>Harga Modal / HPP (Rp)</label>
                  <input type="number" value={formData.harga_beli} onFocus={(e) => e.target.select()} onChange={(e) => setFormData({ ...formData, harga_beli: e.target.value })} placeholder="0" min="0" style={inp} />
                </div>
                <div>
                  <label style={lbl}>Harga Jual (Rp)</label>
                  <input type="number" value={formData.harga_jual} onFocus={(e) => e.target.select()} onChange={(e) => setFormData({ ...formData, harga_jual: e.target.value })} placeholder="0" min="0" style={inp} required />
                </div>
              </div>
              {Number(formData.harga_jual) > 0 && Number(formData.harga_beli) > 0 && (
                <div style={{ fontSize: 12, fontWeight: 700, color: margin >= 0 ? "#059669" : "#DC2626" }}>Margin per pcs: {rp(margin)} ({Math.round((margin / Number(formData.harga_beli)) * 100)}%)</div>
              )}
              <div>
                <label style={lbl}>Stok</label>
                {editingLinked ? (
                  <div style={{ fontSize: 12, color: "#0369A1", background: "#E0F2FE", borderRadius: 8, padding: "10px 12px", lineHeight: 1.5 }}>
                    <Factory size={12} /> Barang produksi — stok mengikuti <b>Gudang &amp; Stok</b> dan scan penjualan, tidak bisa diubah di sini.
                  </div>
                ) : (
                  <input type="number" value={formData.stok} onFocus={(e) => e.target.select()} onChange={(e) => setFormData({ ...formData, stok: e.target.value })} placeholder="0" min="0" style={inp} />
                )}
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: "12px", background: "#F1F5F9", color: "#475569", borderRadius: 8, border: "none", fontWeight: 600, cursor: "pointer" }}>Batal</button>
                <button type="submit" style={{ flex: 1, padding: "12px", background: "#2563EB", color: "white", borderRadius: 8, border: "none", fontWeight: 600, cursor: "pointer" }}>Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {barcodeItem && (
        <BarangBarcodeModal barang={barcodeItem} onClose={() => { setBarcodeItem(null); fetchData(); }} />
      )}
    </div>
  );
}
