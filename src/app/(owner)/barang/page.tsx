"use client";

import { useState, useEffect, useMemo, useCallback, Fragment } from "react";
import { Plus, Edit2, Trash2, X, Barcode, Search, Package, Boxes, Wallet, TrendingUp, ShoppingBag, Info, ChevronDown, ChevronUp, ChevronRight, Factory, PenLine, Store, Globe, Truck, AlertTriangle, RefreshCw, CloudUpload, ExternalLink, Layers, ShieldAlert, CheckSquare, Square, ArrowRight, ArrowLeft, Lock, Check } from "lucide-react";
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
  const [variantModalItem, setVariantModalItem] = useState<any | null>(null);

  // State Verifikasi Bertingkat Pengiriman Stok Marketplace
  const [confirmSyncData, setConfirmSyncData] = useState<{ item?: any; isAll?: boolean } | null>(null);
  const [confirmStep, setConfirmStep] = useState<1 | 2>(1);
  const [agreeCheckbox, setAgreeCheckbox] = useState(false);
  const [confirmWord, setConfirmWord] = useState("");

  const [formData, setFormData] = useState({
    kategori_id: "",
    nama_barang: "",
    warna: "",
    kode: "",
    harga_beli: "",
    harga_jual: "",
    stok: "",
    sizes_stock: {} as Record<string, any>,
  });
  const [pullingCatalog, setPullingCatalog] = useState(false);
  const [syncingStock, setSyncingStock] = useState(false);

  const handlePullCatalog = async () => {
    setPullingCatalog(true);
    try {
      const res = await fetch("/api/marketplace/sync-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pull_products" }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || json.error || "Gagal menarik produk dari marketplace");
      toast.success(json.message);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPullingCatalog(false);
    }
  };

  const openPushConfirm = (targetIdOrItem?: any) => {
    let targetItem: any = null;
    let isAll = false;

    if (typeof targetIdOrItem === "number") {
      targetItem = data.find((b) => b.id === targetIdOrItem);
    } else if (targetIdOrItem && typeof targetIdOrItem === "object") {
      targetItem = targetIdOrItem;
    } else {
      isAll = true;
    }

    setConfirmSyncData({ item: targetItem, isAll });
    setConfirmStep(1);
    setAgreeCheckbox(false);
    setConfirmWord("");
  };

  const executePushStock = async () => {
    if (!confirmSyncData) return;
    const targetId = confirmSyncData.isAll ? undefined : confirmSyncData.item?.id;

    setSyncingStock(true);
    try {
      const res = await fetch("/api/marketplace/sync-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "push_stock", barang_id: targetId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || json.error || "Gagal mengirim stok ke marketplace");
      toast.success(json.message);
      setConfirmSyncData(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSyncingStock(false);
    }
  };

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
    setFormData({
      kategori_id: "",
      nama_barang: "",
      warna: "",
      kode: "",
      harga_beli: "",
      harga_jual: "",
      stok: "",
      sizes_stock: { "XS": "", "S": "", "M": "", "L": "", "XL": "", "XXL": "", "XXXL": "" },
    });
    setShowModal(true);
  };
  const openEdit = (item: any) => {
    setEditingId(item.id);
    setEditingLinked(!!item.stok_dari_gudang && (item.lots?.length > 0));

    // Siapkan sizes_stock dari item.sizes atau item.sizes_stock
    const szStock: Record<string, any> = {};
    if (item.sizes && Array.isArray(item.sizes) && item.sizes.length > 0) {
      for (const s of item.sizes) {
        szStock[s.size] = item.sizes_stock?.[s.size] ?? (s.jumlah > 0 ? s.jumlah : "");
      }
    } else if (item.sizes_stock && typeof item.sizes_stock === "object") {
      for (const [k, v] of Object.entries(item.sizes_stock)) {
        szStock[k] = v;
      }
    } else {
      ["XS", "S", "M", "L", "XL", "XXL", "XXXL"].forEach((s) => (szStock[s] = ""));
    }

    setFormData({
      kategori_id: String(item.kategori_id || ""),
      nama_barang: item.nama_barang,
      warna: item.warna || "",
      kode: item.kode || "",
      harga_beli: item.harga_beli ? String(item.harga_beli) : "",
      harga_jual: item.harga_jual ? String(item.harga_jual) : "",
      stok: item.stok ? String(item.stok) : "",
      sizes_stock: szStock,
    });
    setShowModal(true);
  };
  const toggle = (id: number) => setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.filter((b) =>
      (fKategori === "semua" || String(b.kategori_id) === fKategori) &&
      (fSumber === "semua" || b.sumber === fSumber) &&
      (!s || [b.nama_barang, b.warna, b.kode, b.uid, b.kategori_nama].some((v) => String(v || "").toLowerCase().includes(s)))
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
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            disabled={pullingCatalog || syncingStock}
            onClick={handlePullCatalog}
            title="Tarik produk & SKU dari Shopee / TikTok yang terhubung"
            style={{
              background: "#EEF2FF",
              color: "#4F46E5",
              border: "1px solid #C7D2FE",
              padding: "9px 14px",
              borderRadius: 8,
              fontWeight: 700,
              cursor: pullingCatalog || syncingStock ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
              opacity: pullingCatalog || syncingStock ? 0.7 : 1,
            }}
          >
            <RefreshCw size={14} className={pullingCatalog ? "animate-spin" : ""} />
            {pullingCatalog ? "Menarik..." : "Tarik SKU Marketplace"}
          </button>
          <button
            type="button"
            disabled={pullingCatalog || syncingStock || !data.length}
            onClick={() => openPushConfirm()}
            title="Kirim jumlah stok gudang saat ini ke Shopee & TikTok (dengan verifikasi keamanan)"
            style={{
              background: "#ECFDF5",
              color: "#059669",
              border: "1px solid #A7F3D0",
              padding: "9px 14px",
              borderRadius: 8,
              fontWeight: 700,
              cursor: pullingCatalog || syncingStock || !data.length ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
              opacity: pullingCatalog || syncingStock || !data.length ? 0.7 : 1,
            }}
          >
            <CloudUpload size={14} className={syncingStock ? "animate-spin" : ""} />
            {syncingStock ? "Mengirim..." : "Kirim Stok ke Marketplace"}
          </button>
          <button id="btn-tambah-barang" onClick={openAdd} style={{ background: "#2563EB", color: "white", padding: "9px 16px", borderRadius: 8, fontWeight: 700, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, boxShadow: "0 2px 6px rgba(37,99,235,0.25)" }}>
            <Plus size={16} /> Tambah Barang
          </button>
        </div>
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
                <tr><td colSpan={8} style={{ padding: 32, textAlign: "center", color: "#64748B" }}>Memuat data...</td></tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 48, textAlign: "center" }}>
                    {data.length ? (
                      <div style={{ color: "#64748B", fontSize: 14 }}>Tidak ada barang yang cocok dengan filter pencarian</div>
                    ) : (
                      <div style={{ maxWidth: 520, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                        <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#EFF6FF", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <ShoppingBag size={30} />
                        </div>
                        <div>
                          <div style={{ fontSize: 17, fontWeight: 900, color: "#0F172A", marginBottom: 6 }}>Belum Ada Data Barang</div>
                          <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.6 }}>
                            Toko online Anda sudah aktif menjual di marketplace? Anda bisa <b>menarik katalog produk &amp; SKU otomatis</b> dari toko Shopee / TikTok yang terhubung, atau menambahkan barang secara manual.
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap", justifyContent: "center" }}>
                          <button
                            type="button"
                            onClick={handlePullCatalog}
                            disabled={pullingCatalog}
                            style={{
                              background: "linear-gradient(135deg, #2563EB, #1D4ED8)",
                              color: "white",
                              padding: "10px 18px",
                              borderRadius: 8,
                              fontWeight: 800,
                              fontSize: 13,
                              border: "none",
                              cursor: pullingCatalog ? "not-allowed" : "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              boxShadow: "0 4px 12px rgba(37,99,235,0.25)"
                            }}
                          >
                            <RefreshCw size={15} className={pullingCatalog ? "animate-spin" : ""} />
                            {pullingCatalog ? "Sedang Menarik Produk..." : "📥 Tarik Produk & SKU dari Marketplace"}
                          </button>
                          <button
                            type="button"
                            onClick={openAdd}
                            style={{
                              background: "#F8FAFC",
                              color: "#334155",
                              padding: "10px 16px",
                              borderRadius: 8,
                              fontWeight: 700,
                              fontSize: 13,
                              border: "1px solid #CBD5E1",
                              cursor: "pointer"
                            }}
                          >
                            + Tambah Barang Manual
                          </button>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
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
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{item.nama_barang}</span>
                          {item.warna && (
                            <span style={{ fontSize: 10.5, fontWeight: 800, color: "#2563EB", background: "#EFF6FF", border: "1px solid #BFDBFE", padding: "1px 6px", borderRadius: 5 }}>
                              {item.warna}
                            </span>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4, flexWrap: "wrap" }}>
                          <span style={{ fontFamily: "monospace", fontSize: 12, color: "#64748B", fontWeight: 700 }}>{item.kode || item.uid}</span>
                          {item.sumber === "produksi"
                            ? <span title="Stok dari Gudang & Stok (produksi)" style={{ display: "inline-flex", gap: 3, alignItems: "center", fontSize: 10, fontWeight: 800, color: "#0369A1", background: "#E0F2FE", padding: "2px 6px", borderRadius: 5 }}><Factory size={10} /> PRODUKSI</span>
                            : <span title="Stok diisi manual" style={{ display: "inline-flex", gap: 3, alignItems: "center", fontSize: 10, fontWeight: 800, color: "#6B21A8", background: "#F3E8FF", padding: "2px 6px", borderRadius: 5 }}><PenLine size={10} /> MANUAL</span>}
                          {item.marketplace_mappings?.length > 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setVariantModalItem(item);
                              }}
                              title="Klik untuk membuka popup rincian varian, ukuran & SKU marketplace"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                fontSize: 10,
                                fontWeight: 800,
                                color: "#047857",
                                background: "#ECFDF5",
                                border: "1px solid #A7F3D0",
                                padding: "2px 7px",
                                borderRadius: 5,
                                cursor: "pointer",
                              }}
                            >
                              🛒 Marketplace ({item.marketplace_mappings.length} varian)
                              <ExternalLink size={10} style={{ opacity: 0.7 }} />
                            </button>
                          )}
                        </div>
                        {item.marketplace_mappings?.length > 0 && (
                          <div style={{ display: "flex", gap: 3.5, alignItems: "center", marginTop: 5, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 9.5, color: "#94A3B8", fontWeight: 700 }}>Varian:</span>
                            {item.marketplace_mappings.map((m: any, idx: number) => {
                              const vName = m.variation_name || (m.seller_sku ? m.seller_sku.split("-").pop() : `${idx + 1}`);
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setVariantModalItem(item);
                                  }}
                                  title={`Varian: ${vName}\nSKU Toko: ${m.seller_sku || m.raw_sku || "-"}\nKlik untuk lihat detail`}
                                  style={{
                                    fontSize: 9.5,
                                    fontWeight: 700,
                                    padding: "1px 5px",
                                    borderRadius: 4,
                                    background: "#F8FAFC",
                                    border: "1px solid #CBD5E1",
                                    color: "#334155",
                                    cursor: "pointer",
                                  }}
                                >
                                  {vName}
                                </button>
                              );
                            })}
                          </div>
                        )}
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
                            <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>{(item.terjual_total ?? item.barcode?.terjual ?? 0)} pcs <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600 }}>({(item.laku_pct ?? lakuPct)}% laku)</span></div>
                            <div style={{ height: 5, background: "#F1F5F9", borderRadius: 99, overflow: "hidden", margin: "4px 0" }}><div style={{ width: `${(item.laku_pct ?? lakuPct)}%`, height: "100%", background: "linear-gradient(90deg,#EC4899,#8B5CF6)" }} /></div>
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
                          {item.marketplace_mappings?.length > 0 && (
                            <button className="brg-act" onClick={() => openPushConfirm(item)} title="Kirim / update stok barang ini ke Shopee & TikTok (dengan verifikasi keamanan)" style={{ padding: "6px 8px", background: "#ECFDF5", color: "#059669", borderRadius: 6, border: "1px solid #A7F3D0", cursor: "pointer", display: "flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700 }}><CloudUpload size={13} /> Sync Stok</button>
                          )}
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

                          {/* Detail Varian Marketplace Terhubung */}
                          {item.marketplace_mappings?.length > 0 && (
                            <div style={{ marginTop: 12, background: "white", border: "1px solid #BBF7D0", borderRadius: 12, padding: "12px 16px", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <span style={{ fontSize: 13, fontWeight: 800, color: "#065F46", display: "inline-flex", alignItems: "center", gap: 6 }}>
                                    🛒 Pemetaan Varian Marketplace Terhubung ({item.marketplace_mappings.length} Varian)
                                  </span>
                                  <span style={{ fontSize: 11, color: "#047857", background: "#ECFDF5", border: "1px solid #A7F3D0", padding: "2px 8px", borderRadius: 6, fontWeight: 700 }}>
                                    {item.marketplace_mappings[0]?.shop_name || "Shopee (lavaira.id)"}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => openPushConfirm(item)}
                                  style={{
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    color: "#059669",
                                    background: "#ECFDF5",
                                    border: "1px solid #A7F3D0",
                                    borderRadius: 6,
                                    padding: "4px 10px",
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4
                                  }}
                                >
                                  <CloudUpload size={13} /> Kirim Stok Varian ke Marketplace
                                </button>
                              </div>

                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(185px, 1fr))", gap: 8 }}>
                                {item.marketplace_mappings.map((m: any, idx: number) => {
                                  const vName = m.variation_name || (m.seller_sku ? m.seller_sku.split("-").pop() : `Varian ${idx + 1}`);
                                  const matchSize = item.sizes?.find((s: any) =>
                                    s.size.toLowerCase() === vName.toLowerCase() ||
                                    (m.seller_sku && m.seller_sku.toLowerCase().endsWith("-" + s.size.toLowerCase()))
                                  );
                                  const curStock = matchSize ? matchSize.jumlah : item.stok;
                                  return (
                                    <div key={idx} style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: "8px 10px" }}>
                                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <span style={{ fontWeight: 800, fontSize: 13, color: "#0F172A" }}>
                                          {vName}
                                        </span>
                                        <span style={{ fontSize: 9.5, fontWeight: 800, color: "#059669", background: "#D1FAE5", padding: "1px 6px", borderRadius: 4 }}>
                                          {m.platform ? m.platform.toUpperCase() : "SHOPEE"}
                                        </span>
                                      </div>
                                      <div style={{ fontSize: 10.5, fontFamily: "monospace", color: "#64748B", marginTop: 4, wordBreak: "break-all" }}>
                                        {m.seller_sku || m.raw_sku || "-"}
                                      </div>
                                      <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", fontSize: 11, borderTop: "1px dashed #E2E8F0", paddingTop: 4 }}>
                                        <span style={{ color: "#64748B" }}>
                                          Stok ERP: <b style={{ color: curStock > 0 ? "#059669" : "#EF4444" }}>{curStock} pcs</b>
                                        </span>
                                        {matchSize?.terjual != null && (
                                          <span style={{ color: "#8B5CF6", fontWeight: 700 }}>Laku: {matchSize.terjual}</span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
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
              <div>
                <label style={lbl}>Model Warna / Target Washing (Opsional)</label>
                <input type="text" value={formData.warna} onChange={(e) => setFormData({ ...formData, warna: e.target.value })} placeholder="Contoh: Retro Fold, Raw Denim, Medium Blue" style={inp} />
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                  {["Retro Fold", "Raw Denim Fold", "Medium Blue", "Snow Black", "Light Blue", "Biowash"].map((w) => (
                    <button key={w} type="button" onClick={() => setFormData({ ...formData, warna: w })} style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 5, border: "1px solid #CBD5E1", background: formData.warna === w ? "#2563EB" : "#F8FAFC", color: formData.warna === w ? "white" : "#475569", cursor: "pointer" }}>
                      {w}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={lbl}>Kode Induk / SKU Prefix (Shopee / TikTok)</label>
                <input
                  type="text"
                  value={formData.kode}
                  onChange={(e) => setFormData({ ...formData, kode: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })}
                  placeholder="Contoh: BURDIL-RETRO, BURDIL-RAW, TBJ-0002"
                  style={inp}
                />
                <div style={{ fontSize: 11, color: "#64748B", marginTop: 4, lineHeight: 1.4 }}>
                  💡 SKU per size otomatis: <b style={{ color: "#2563EB" }}>{formData.kode ? `${formData.kode}-[SIZE]` : "[KODE]-[SIZE]"}</b> (contoh: <code style={{ background: "#EEF2FF", padding: "1px 5px", borderRadius: 4 }}>{formData.kode || "BURDIL-RETRO"}-M</code>).
                  <br />
                  <b>Multi-Toko Online:</b> Cukup samakan <b>Seller SKU</b> di 4-5 toko online Shopee/TikTok Anda dengan format SKU ini agar pesanan dari semua toko otomatis sinkron memotong stok gudang yang sama.
                </div>
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
                {editingLinked ? (
                  <div>
                    <label style={lbl}>Stok</label>
                    <div style={{ fontSize: 12, color: "#0369A1", background: "#E0F2FE", borderRadius: 8, padding: "10px 12px", lineHeight: 1.5 }}>
                      <Factory size={12} /> Barang produksi dengan mutasi aktif — stok mengikuti <b>Gudang &amp; Stok</b> dan scan penjualan.
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <label style={{ ...lbl, marginBottom: 0 }}>Total Stok Tersedia (pcs)</label>
                      {formData.sizes_stock && Object.keys(formData.sizes_stock).length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const keys = Object.keys(formData.sizes_stock);
                            const tot = Number(formData.stok) || 0;
                            if (keys.length > 0 && tot > 0) {
                              const each = Math.floor(tot / keys.length);
                              const rem = tot - each * keys.length;
                              const updated: Record<string, number> = {};
                              keys.forEach((k, idx) => {
                                updated[k] = each + (idx === 0 ? rem : 0);
                              });
                              setFormData({ ...formData, sizes_stock: updated });
                            }
                          }}
                          style={{ fontSize: 11, fontWeight: 700, color: "#2563EB", background: "#EFF6FF", border: "1px solid #BFDBFE", padding: "3px 8px", borderRadius: 6, cursor: "pointer" }}
                        >
                          ⚡ Bagi Rata ke Setiap Size
                        </button>
                      )}
                    </div>
                    <input
                      type="number"
                      value={formData.stok}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setFormData({ ...formData, stok: e.target.value })}
                      placeholder="0"
                      min="0"
                      style={inp}
                    />
                    <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>
                      💡 Masukkan jumlah stok fisik gudang atau ketersediaan toko online (misal: 9.304 pcs).
                    </div>

                    {formData.sizes_stock && Object.keys(formData.sizes_stock).length > 0 && (
                      <div style={{ marginTop: 12, background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, padding: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#1E293B" }}>
                            Rincian Stok per Size (Opsional / Fleksibel)
                          </span>
                          <span style={{ fontSize: 10.5, color: "#64748B" }}>
                            Bisa diisi spesifik per size (misal S: 9304)
                          </span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(70px, 1fr))", gap: 8 }}>
                          {Object.keys(formData.sizes_stock).map((sz) => (
                            <div key={sz} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                              <span style={{ fontSize: 11, fontWeight: 800, color: "#475569", textAlign: "center" }}>{sz}</span>
                              <input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={formData.sizes_stock[sz] ?? ""}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const updated = { ...formData.sizes_stock, [sz]: val === "" ? "" : Number(val) };
                                  const sum = Object.values(updated).reduce((acc: number, v: any) => acc + (Number(v) || 0), 0);
                                  setFormData({
                                    ...formData,
                                    sizes_stock: updated,
                                    stok: String(sum),
                                  });
                                }}
                                style={{
                                  width: "100%",
                                  padding: "6px 4px",
                                  textAlign: "center",
                                  borderRadius: 6,
                                  border: "1px solid #CBD5E1",
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: "#0F172A",
                                  boxSizing: "border-box",
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
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

      {/* Modal Detail Varian Marketplace */}
      {variantModalItem && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 110 }}>
          <div style={{ background: "white", width: "100%", maxWidth: 660, margin: "16px", borderRadius: 16, overflow: "hidden", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}>
            <div style={{ padding: "18px 24px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "flex-start", background: "#F8FAFC" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: 0 }}>
                    🛒 Detail Varian Terhubung di Marketplace
                  </h3>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#059669", background: "#ECFDF5", border: "1px solid #A7F3D0", padding: "2px 8px", borderRadius: 6 }}>
                    {variantModalItem.marketplace_mappings?.length || 0} Varian Aktif
                  </span>
                </div>
                <div style={{ fontSize: 12.5, color: "#64748B", marginTop: 4, fontWeight: 600 }}>
                  {variantModalItem.nama_barang} &bull; <span style={{ fontFamily: "monospace", color: "#3B82F6" }}>{variantModalItem.kode || variantModalItem.uid}</span>
                </div>
              </div>
              <button onClick={() => setVariantModalItem(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: "20px 24px", maxHeight: "65vh", overflowY: "auto" }}>
              <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#1E40AF", lineHeight: 1.5 }}>
                ℹ️ Varian ini terhubung secara langsung dengan katalog toko <b>Shopee & TikTok (lavaira.id)</b>. Saat customer checkout pesanan di marketplace, sistem ERP akan memotong stok varian ukuran dan kode SKU yang cocok di bawah ini:
              </div>

              <div style={{ border: "1px solid #E2E8F0", borderRadius: 10, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", color: "#475569", fontSize: 11, textTransform: "uppercase" }}>
                      <th style={{ padding: "10px 12px", textAlign: "left" }}>Varian / Ukuran</th>
                      <th style={{ padding: "10px 12px", textAlign: "left" }}>Seller SKU (Marketplace)</th>
                      <th style={{ padding: "10px 12px", textAlign: "center" }}>Toko</th>
                      <th style={{ padding: "10px 12px", textAlign: "right" }}>Stok ERP</th>
                      <th style={{ padding: "10px 12px", textAlign: "right" }}>Terjual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(variantModalItem.marketplace_mappings || []).map((m: any, idx: number) => {
                      const vName = m.variation_name || (m.seller_sku ? m.seller_sku.split("-").pop() : `Varian ${idx + 1}`);
                      const matchSize = variantModalItem.sizes?.find((s: any) =>
                        s.size.toLowerCase() === vName.toLowerCase() ||
                        (m.seller_sku && m.seller_sku.toLowerCase().endsWith("-" + s.size.toLowerCase()))
                      );
                      const curStock = matchSize ? matchSize.jumlah : variantModalItem.stok;
                      const sold = matchSize ? matchSize.terjual : 0;
                      return (
                        <tr key={idx} style={{ borderBottom: idx < variantModalItem.marketplace_mappings.length - 1 ? "1px solid #F1F5F9" : "none" }}>
                          <td style={{ padding: "10px 12px", fontWeight: 800, color: "#0F172A" }}>
                            <span style={{ background: "#F1F5F9", border: "1px solid #CBD5E1", padding: "2px 8px", borderRadius: 6 }}>
                              {vName}
                            </span>
                          </td>
                          <td style={{ padding: "10px 12px", fontFamily: "monospace", color: "#475569", fontSize: 11.5 }}>
                            {m.seller_sku || m.raw_sku || "-"}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "center" }}>
                            <span style={{ fontSize: 10, fontWeight: 800, color: "#047857", background: "#ECFDF5", border: "1px solid #A7F3D0", padding: "2px 6px", borderRadius: 4 }}>
                              {m.platform ? m.platform.toUpperCase() : "SHOPEE"}
                            </span>
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 800, color: curStock > 0 ? "#059669" : "#EF4444" }}>
                            {curStock} pcs
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: sold > 0 ? "#8B5CF6" : "#94A3B8" }}>
                            {sold} pcs
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ padding: "14px 24px", borderTop: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                type="button"
                onClick={() => {
                  const itm = variantModalItem;
                  setVariantModalItem(null);
                  openPushConfirm(itm);
                }}
                style={{
                  padding: "8px 14px",
                  background: "#ECFDF5",
                  color: "#059669",
                  border: "1px solid #A7F3D0",
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6
                }}
              >
                <CloudUpload size={14} /> Sinkronkan Stok ke Marketplace
              </button>
              <button
                type="button"
                onClick={() => setVariantModalItem(null)}
                style={{ padding: "8px 20px", background: "#2563EB", color: "white", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Verifikasi Bertingkat Pengiriman Stok Marketplace */}
      {confirmSyncData && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.65)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 120 }}>
          <div style={{ background: "white", width: "100%", maxWidth: 640, margin: "16px", borderRadius: 16, overflow: "hidden", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.3)" }}>
            
            {/* Header Wizard Step Indicator */}
            <div style={{ padding: "14px 24px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                {/* Step 1 Pill */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: "50%",
                    background: confirmStep === 1 ? "#2563EB" : "#10B981",
                    color: "white", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 800
                  }}>
                    {confirmStep > 1 ? "✓" : "1"}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: confirmStep === 1 ? "#0F172A" : "#64748B" }}>
                    Tahap 1: Review Data
                  </span>
                </div>

                <div style={{ width: 28, height: 2, background: confirmStep >= 2 ? "#10B981" : "#CBD5E1" }} />

                {/* Step 2 Pill */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: "50%",
                    background: confirmStep === 2 ? "#DC2626" : "#E2E8F0",
                    color: confirmStep === 2 ? "white" : "#64748B",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 800
                  }}>
                    2
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: confirmStep === 2 ? "#0F172A" : "#94A3B8" }}>
                    Tahap 2: Kunci Keamanan
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setConfirmSyncData(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "20px 24px", maxHeight: "65vh", overflowY: "auto" }}>
              {confirmStep === 1 ? (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ background: "#FEF3C7", color: "#B45309", padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <AlertTriangle size={13} /> TINJAUAN PERUBAHAN STOK
                    </span>
                    <span style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>
                      Toko: <b>Shopee (lavaira.id)</b>
                    </span>
                  </div>

                  <h3 style={{ fontSize: 17, fontWeight: 800, color: "#0F172A", margin: "4px 0 12px" }}>
                    {confirmSyncData.isAll ? "Sinkronisasi Seluruh Katalog Barang ke Toko Online" : confirmSyncData.item?.nama_barang}
                  </h3>

                  <div style={{ background: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: 10, padding: "12px 14px", marginBottom: 16, fontSize: 12.5, color: "#92400E", lineHeight: 1.5 }}>
                    ⚠️ <b>Peringatan Dampak:</b> Menekan tombol kirim akan <b>menimpa (overwrite)</b> kuota stok yang tampil bagi pembeli di marketplace saat ini dengan data stok ERP. Jika stok fisik gudang 0 pcs, produk akan otomatis menjadi <b>Habis (Sold Out)</b>.
                  </div>

                  <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                    Daftar Stok yang Akan Dikirim:
                  </div>

                  <div style={{ border: "1px solid #E2E8F0", borderRadius: 10, overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", color: "#475569", textTransform: "uppercase", fontSize: 10.5 }}>
                          <th style={{ padding: "8px 10px", textAlign: "left" }}>Varian</th>
                          <th style={{ padding: "8px 10px", textAlign: "left" }}>Seller SKU</th>
                          <th style={{ padding: "8px 10px", textAlign: "right" }}>Stok ERP</th>
                          <th style={{ padding: "8px 10px", textAlign: "left" }}>Status Toko Online</th>
                        </tr>
                      </thead>
                      <tbody>
                        {confirmSyncData.isAll ? (
                          data.filter((b) => b.marketplace_mappings?.length > 0).map((b) => (
                            <tr key={b.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                              <td style={{ padding: "8px 10px", fontWeight: 700 }}>{b.nama_barang}</td>
                              <td style={{ padding: "8px 10px", fontFamily: "monospace", color: "#64748B" }}>{b.kode}</td>
                              <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 800, color: b.stok > 0 ? "#059669" : "#EF4444" }}>{b.stok} pcs</td>
                              <td style={{ padding: "8px 10px" }}>
                                <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 4, background: b.stok > 0 ? "#DCFCE7" : "#FEE2E2", color: b.stok > 0 ? "#15803D" : "#B91C1C" }}>
                                  {b.stok > 0 ? `Tersedia (${b.stok} pcs)` : "Habis di Toko"}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          (confirmSyncData.item?.marketplace_mappings || []).map((m: any, idx: number) => {
                            const vName = m.variation_name || (m.seller_sku ? m.seller_sku.split("-").pop() : `Varian ${idx + 1}`);
                            const matchSize = confirmSyncData.item?.sizes?.find((s: any) =>
                              s.size.toLowerCase() === vName.toLowerCase() ||
                              (m.seller_sku && m.seller_sku.toLowerCase().endsWith("-" + s.size.toLowerCase()))
                            );
                            const curStock = matchSize ? matchSize.jumlah : confirmSyncData.item?.stok || 0;
                            return (
                              <tr key={idx} style={{ borderBottom: "1px solid #F1F5F9" }}>
                                <td style={{ padding: "8px 10px", fontWeight: 800, color: "#0F172A" }}>
                                  <span style={{ background: "#F1F5F9", border: "1px solid #CBD5E1", padding: "1px 6px", borderRadius: 4 }}>
                                    {vName}
                                  </span>
                                </td>
                                <td style={{ padding: "8px 10px", fontFamily: "monospace", color: "#64748B", fontSize: 11 }}>
                                  {m.seller_sku || m.raw_sku || "-"}
                                </td>
                                <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 800, color: curStock > 0 ? "#059669" : "#EF4444" }}>
                                  {curStock} pcs
                                </td>
                                <td style={{ padding: "8px 10px" }}>
                                  <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 4, background: curStock > 0 ? "#DCFCE7" : "#FEE2E2", color: curStock > 0 ? "#15803D" : "#B91C1C" }}>
                                    {curStock > 0 ? `Tersedia (${curStock} pcs)` : "Habis di Toko"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* Step 2: Konfirmasi Keamanan Tingkat Lanjut */
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <span style={{ background: "#FEE2E2", color: "#DC2626", padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <ShieldAlert size={14} /> PENGUNCI KEAMANAN AKTIF
                    </span>
                  </div>

                  <h3 style={{ fontSize: 17, fontWeight: 800, color: "#991B1B", margin: "4px 0 12px" }}>
                    Verifikasi Akhir Sebelum Mengirim ke Toko
                  </h3>

                  <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "12px 14px", marginBottom: 18, fontSize: 12.5, color: "#991B1B", lineHeight: 1.5 }}>
                    🔒 Untuk memastikan Anda <b>tidak salah klik tanpa sengaja</b>, selesaikan 2 syarat verifikasi keamanan di bawah ini sebelum data dikirim ke Shopee/TikTok:
                  </div>

                  {/* Syarat 1: Checkbox Persetujuan */}
                  <div
                    onClick={() => setAgreeCheckbox(!agreeCheckbox)}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      padding: "12px 14px",
                      borderRadius: 10,
                      border: agreeCheckbox ? "2px solid #2563EB" : "1px solid #CBD5E1",
                      background: agreeCheckbox ? "#EFF6FF" : "#F8FAFC",
                      cursor: "pointer",
                      marginBottom: 14,
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ marginTop: 2, color: agreeCheckbox ? "#2563EB" : "#94A3B8" }}>
                      {agreeCheckbox ? <CheckSquare size={18} /> : <Square size={18} />}
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "#1E293B", lineHeight: 1.4 }}>
                      Saya telah memeriksa ketersediaan fisik stok di gudang dan menyetujui pembaruan kuota stok toko online secara langsung.
                    </div>
                  </div>

                  {/* Syarat 2: Ketik Kata Konfirmasi */}
                  <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, padding: "12px 14px" }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                      Ketik kata <span style={{ color: "#DC2626", fontWeight: 900, background: "#FEE2E2", padding: "1px 6px", borderRadius: 4 }}>KIRIM</span> di bawah untuk membuka kunci tombol:
                    </label>
                    <input
                      type="text"
                      value={confirmWord}
                      onChange={(e) => setConfirmWord(e.target.value.toUpperCase())}
                      placeholder="Ketik KIRIM disini"
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        fontSize: 14,
                        fontWeight: 800,
                        letterSpacing: 2,
                        borderRadius: 8,
                        border: confirmWord.trim().toUpperCase() === "KIRIM" ? "2px solid #059669" : "1px solid #CBD5E1",
                        background: "white",
                        boxSizing: "border-box",
                        textAlign: "center",
                        outline: "none",
                      }}
                    />
                    {confirmWord.trim().toUpperCase() === "KIRIM" ? (
                      <div style={{ fontSize: 11.5, color: "#059669", fontWeight: 700, marginTop: 5, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                        ✓ Kunci terbuka. Tombol kirim siap dijalankan.
                      </div>
                    ) : (
                      <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 4, textAlign: "center" }}>
                        Harap ketik kata KIRIM dengan huruf besar.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div style={{ padding: "14px 24px", borderTop: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              {confirmStep === 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => setConfirmSyncData(null)}
                    style={{ padding: "8px 16px", background: "#F1F5F9", color: "#475569", borderRadius: 8, border: "1px solid #CBD5E1", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmStep(2)}
                    style={{
                      padding: "9px 18px",
                      background: "#2563EB",
                      color: "white",
                      borderRadius: 8,
                      border: "none",
                      fontWeight: 700,
                      fontSize: 12.5,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    Lanjut ke Verifikasi Keamanan <ArrowRight size={14} />
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setConfirmStep(1)}
                    style={{
                      padding: "8px 16px",
                      background: "#F1F5F9",
                      color: "#475569",
                      borderRadius: 8,
                      border: "1px solid #CBD5E1",
                      fontWeight: 700,
                      fontSize: 12.5,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <ArrowLeft size={14} /> Kembali ke Review
                  </button>
                  <button
                    type="button"
                    disabled={!agreeCheckbox || confirmWord.trim().toUpperCase() !== "KIRIM" || syncingStock}
                    onClick={executePushStock}
                    style={{
                      padding: "10px 20px",
                      background: !agreeCheckbox || confirmWord.trim().toUpperCase() !== "KIRIM" || syncingStock ? "#E2E8F0" : "#DC2626",
                      color: !agreeCheckbox || confirmWord.trim().toUpperCase() !== "KIRIM" || syncingStock ? "#94A3B8" : "white",
                      borderRadius: 8,
                      border: "none",
                      fontWeight: 800,
                      fontSize: 13,
                      cursor: !agreeCheckbox || confirmWord.trim().toUpperCase() !== "KIRIM" || syncingStock ? "not-allowed" : "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      boxShadow: !agreeCheckbox || confirmWord.trim().toUpperCase() !== "KIRIM" ? "none" : "0 4px 6px -1px rgba(220,38,38,0.3)",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <CloudUpload size={15} />
                    {syncingStock ? "Sedang Mengirim ke Toko..." : "🚀 Ya, Kirim Stok ke Marketplace"}
                  </button>
                </>
              )}
            </div>

          </div>
        </div>
      )}

      {barcodeItem && (
        <BarangBarcodeModal barang={barcodeItem} onClose={() => { setBarcodeItem(null); fetchData(); }} />
      )}
    </div>
  );
}
