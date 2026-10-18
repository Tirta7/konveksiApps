"use client";
import React, { useEffect, useState, useMemo } from "react";
import { 
  Plus, 
  Scissors, 
  Save, 
  X, 
  Trash2, 
  Printer, 
  Package, 
  ChevronRight, 
  AlertTriangle, 
  Layers, 
  Search, 
  FileText, 
  UserCheck, 
  CheckCircle2, 
  Clock, 
  ArrowUpRight,
  Sparkles,
  RefreshCw,
  Eye,
  Check
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function PemotonganKainPage() {
  const [data, setData] = useState<any[]>([]);
  const [tukangPotong, setTukangPotong] = useState<any[]>([]);
  const [dataKainList, setDataKainList] = useState<any[]>([]);
  const [kategoriList, setKategoriList] = useState<any[]>([]);
  const [itemPendukungList, setItemPendukungList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTukang, setFilterTukang] = useState("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "ready" | "done" | "draft">("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "most_pcs" | "most_meter">("newest");
  
  const [submitStatus, setSubmitStatus] = useState("Selesai");
  const [form, setForm] = useState<{
    id?: number;
    tanggal: string;
    nama_barang: string;
    meter_kain: number;
    pemakaian_cm: string;
    tukang_potong_id: string;
    model: string;
    selectedRolls: any[];
    sizeBreakdown: any[];
    target_selesai: string;
    jenis_jahitan: string;
    tipe_benang: string;
    tipe_resleting: string;
    catatan_jahitan: string;
    isi_per_bundle: number;
    item_pendukung_used: { item_id: number; nama_item: string; kategori: string; qty: number | ""; satuan: string }[];
  }>({ 
    tanggal: new Date().toISOString().split("T")[0], 
    nama_barang: "", 
    meter_kain: 0, 
    pemakaian_cm: "", 
    tukang_potong_id: "", 
    model: "",
    selectedRolls: [],
    sizeBreakdown: [{ size: "M", jumlah: "" }],
    target_selesai: "",
    jenis_jahitan: "",
    tipe_benang: "",
    tipe_resleting: "",
    catatan_jahitan: "",
    isi_per_bundle: 20,
    item_pendukung_used: []
  });

  const fetchData = async () => {
    try {
      const [resPemotongan, resTukang, resKain, resKategori, resPendukung] = await Promise.all([
        fetch("/api/pemotongan").then(r => r.json()),
        fetch("/api/tukang-potong").then(r => r.json()),
        fetch("/api/kain").then(r => r.json()),
        fetch("/api/kategori").then(r => r.json()),
        fetch("/api/item-pendukung").then(r => r.json())
      ]);
      setData(Array.isArray(resPemotongan) ? resPemotongan : []);
      setTukangPotong(Array.isArray(resTukang) ? resTukang : []);
      setDataKainList(Array.isArray(resKain) ? resKain : []);
      setKategoriList(Array.isArray(resKategori) ? resKategori : []);
      setItemPendukungList(Array.isArray(resPendukung) ? resPendukung : []);
    } catch (e) {
      toast.error("Gagal mengambil data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, []);

  const totalPcs = form.sizeBreakdown.reduce((sum, item) => sum + (Number(item.jumlah) || 0), 0);

  // Derive available rolls based on selected kain
  const selectedKainData = dataKainList.find(k => k.nama_kain === form.nama_barang);
  let availableRolls = selectedKainData?.rolls ? [...selectedKainData.rolls] : [];
  
  // Ensure previously selected rolls (from DB) are visible even if removed from data_kain
  if (form.selectedRolls && form.selectedRolls.length > 0) {
    const existingIds = availableRolls.map((r:any) => r.id);
    const toAdd = form.selectedRolls.filter((r:any) => !existingIds.includes(r.id));
    availableRolls = [...availableRolls, ...toAdd];
  }

  const handleRollToggle = (roll: any) => {
    const isSelected = form.selectedRolls.some(r => r.id === roll.id);
    let newSelected;
    if (isSelected) {
      newSelected = form.selectedRolls.filter(r => r.id !== roll.id);
    } else {
      newSelected = [...form.selectedRolls, roll];
    }
    
    const totalMeter = newSelected.reduce((sum, r) => sum + r.meter, 0);
    const roundedTotal = Math.round(totalMeter * 1000) / 1000;
    setForm({ ...form, selectedRolls: newSelected, meter_kain: roundedTotal });
  };

  const handleAddItemPendukung = () => {
    if (itemPendukungList.length === 0) {
      return toast.error("Belum ada data item pendukung di Data Kain & Gudang");
    }
    const defaultItem = itemPendukungList[0];
    setForm({
      ...form,
      item_pendukung_used: [
        ...form.item_pendukung_used,
        {
          item_id: defaultItem.id,
          nama_item: defaultItem.nama,
          kategori: defaultItem.kategori,
          qty: "",
          satuan: defaultItem.satuan || "Pcs"
        }
      ]
    });
  };

  const handleItemPendukungChange = (index: number, field: string, value: any) => {
    const updated = [...form.item_pendukung_used];
    if (field === "item_id") {
      const selected = itemPendukungList.find(it => it.id === Number(value));
      if (selected) {
        updated[index] = {
          ...updated[index],
          item_id: selected.id,
          nama_item: selected.nama,
          kategori: selected.kategori,
          satuan: selected.satuan || "Pcs"
        };
      }
    } else {
      (updated[index] as any)[field] = value;
    }
    setForm({ ...form, item_pendukung_used: updated });
  };

  const handleRemoveItemPendukung = (index: number) => {
    const updated = form.item_pendukung_used.filter((_, i) => i !== index);
    setForm({ ...form, item_pendukung_used: updated });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalPcs <= 0) return toast.error("Total potongan tidak valid");
    if (form.meter_kain <= 0) return toast.error("Total kain (meter) tidak valid. Harap pilih minimal 1 Roll kain.");
    
    try {
      const payload = { 
        ...form, 
        total_pcs: totalPcs, 
        status: submitStatus,
        item_pendukung_used: form.item_pendukung_used.filter(it => Number(it.qty) > 0)
      };
      const url = form.id ? `/api/pemotongan/${form.id}` : "/api/pemotongan";
      const method = form.id ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        toast.success("Data pemotongan berhasil disimpan!");
        setShowForm(false);
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || "Gagal menyimpan");
      }
    } catch (e) {
      toast.error("Terjadi kesalahan");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Yakin ingin menghapus data pemotongan ini? (Stok kain dan aksesoris akan dikembalikan)")) return;
    try {
      const res = await fetch(`/api/pemotongan/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Data pemotongan berhasil dihapus, stok dikembalikan");
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || "Gagal menghapus");
      }
    } catch (e) {
      toast.error("Terjadi kesalahan");
    }
  };

  // Real-time sync: refresh data when another admin makes changes
  useEffect(() => {
    const handleSync = () => fetchData();
    window.addEventListener("konveksi-sync", handleSync);
    return () => window.removeEventListener("konveksi-sync", handleSync);
  }, []);

  const jahitanPresets = [
    "Rantai (Chainstitch)", "Obras 5 Benang", "Make-up Jeans", "Double Stitch", "Bartack", "Jarum 1", "Overdeck"
  ];

  const applySizePreset = (preset: "jeans" | "standard") => {
    if (preset === "jeans") {
      setForm(prev => ({
        ...prev,
        sizeBreakdown: [
          { size: "28", jumlah: "" },
          { size: "29", jumlah: "" },
          { size: "30", jumlah: "" },
          { size: "31", jumlah: "" },
          { size: "32", jumlah: "" },
          { size: "33", jumlah: "" },
          { size: "34", jumlah: "" },
          { size: "36", jumlah: "" }
        ]
      }));
    } else {
      setForm(prev => ({
        ...prev,
        sizeBreakdown: [
          { size: "S", jumlah: "" },
          { size: "M", jumlah: "" },
          { size: "L", jumlah: "" },
          { size: "XL", jumlah: "" },
          { size: "XXL", jumlah: "" }
        ]
      }));
    }
  };

  // KPI Calculations
  const stats = useMemo(() => {
    const totalPcsTerpotong = data.reduce((sum, d) => sum + (Number(d.total_pcs) || 0), 0);
    const totalMeterKain = data.reduce((sum, d) => sum + (Number(d.meter_kain) || 0), 0);
    const totalRolls = data.reduce((sum, d) => sum + (d.selectedRolls ? d.selectedRolls.length : 0), 0);
    const totalBatch = data.length;
    const totalSisaReady = data.reduce((sum, d) => {
      const sisa = (d.sizeBreakdown || []).reduce((sSum: number, s: any) => sSum + (s.sisa !== undefined ? s.sisa : (Number(s.jumlah) || 0)), 0);
      return sum + sisa;
    }, 0);
    const draftCount = data.filter(d => d.status === "Draft").length;
    const selesaiCount = data.filter(d => d.status !== "Draft").length;

    return {
      totalPcsTerpotong,
      totalMeterKain,
      totalRolls,
      totalBatch,
      totalSisaReady,
      draftCount,
      selesaiCount
    };
  }, [data]);

  // Filtered & Sorted Data
  const filteredData = useMemo(() => {
    return data.filter(item => {
      const sisa = (item.sizeBreakdown || []).reduce((sum: number, s: any) => sum + (s.sisa !== undefined ? s.sisa : (Number(s.jumlah) || 0)), 0);
      const q = searchQuery.toLowerCase().trim();
      const docNo = `po-pot-${String(item.id).padStart(4, "0")}`;
      
      const matchQuery = !q || (
        docNo.includes(q) ||
        String(item.id).includes(q) ||
        (item.nama_barang || "").toLowerCase().includes(q) ||
        (item.model || "").toLowerCase().includes(q) ||
        (item.tukang_potong_nama || "").toLowerCase().includes(q) ||
        (item.tukang_potong_kode || "").toLowerCase().includes(q) ||
        (item.tipe_benang || "").toLowerCase().includes(q) ||
        (item.tipe_resleting || "").toLowerCase().includes(q) ||
        (item.tanggal || "").toLowerCase().includes(q)
      );

      const matchTukang = filterTukang === "all" || String(item.tukang_potong_id) === String(filterTukang);

      let matchStatus = true;
      if (filterStatus === "draft") {
        matchStatus = item.status === "Draft";
      } else if (filterStatus === "ready") {
        matchStatus = sisa > 0 && item.status !== "Draft";
      } else if (filterStatus === "done") {
        matchStatus = sisa <= 0 && item.status !== "Draft";
      }

      return matchQuery && matchTukang && matchStatus;
    }).sort((a, b) => {
      if (sortBy === "oldest") return new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime();
      if (sortBy === "most_pcs") return (Number(b.total_pcs) || 0) - (Number(a.total_pcs) || 0);
      if (sortBy === "most_meter") return (Number(b.meter_kain) || 0) - (Number(a.meter_kain) || 0);
      return new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime();
    });
  }, [data, searchQuery, filterTukang, filterStatus, sortBy]);

  return (
    <div style={{ padding: "32px 32px 140px 32px", background: "var(--bg-app)", minHeight: "100%", overflowY: "auto" }}>
      {/* PAGE HEADER */}
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <h1 className="page-title" style={{ margin: 0 }}>Pemotongan Kain & SPK Potong</h1>
            <span style={{ fontSize: 11, fontWeight: 800, background: "rgba(37,99,235,0.1)", color: "#2563EB", padding: "3px 10px", borderRadius: 20 }}>
              Divisi Cutting & Spreading Core
            </span>
          </div>
          <p className="page-subtitle" style={{ margin: 0 }}>
            Catat hasil potong roll kain gudang, spesifikasi jahitan & aksesoris, serta alokasi ke PO Produksi CMT.
          </p>
        </div>

        {/* QUICK NAVIGATION HUB & ACTION */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Link 
            href="/data-kain" 
            className="btn btn-secondary"
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, textDecoration: "none" }}
          >
            <Layers size={16} /> Data Kain & Roll
          </Link>
          <Link 
            href="/atur-tukang-potong" 
            className="btn btn-secondary"
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, textDecoration: "none" }}
          >
            <UserCheck size={16} /> Atur Tukang Potong
          </Link>
          <Link 
            href="/buat-spk" 
            className="btn btn-secondary"
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, textDecoration: "none" }}
          >
            <ArrowUpRight size={16} /> Buat PO Jahit
          </Link>
          <button 
            className="btn btn-primary" 
            onClick={() => { 
              setForm({ 
                id: undefined, 
                tanggal: new Date().toISOString().split("T")[0], 
                nama_barang: "", 
                meter_kain: 0, 
                pemakaian_cm: "", 
                tukang_potong_id: "", 
                model: "", 
                selectedRolls: [], 
                sizeBreakdown: [{ size: "M", jumlah: "" }], 
                target_selesai: "",
                jenis_jahitan: "",
                tipe_benang: "",
                tipe_resleting: "",
                catatan_jahitan: "",
                isi_per_bundle: 20,
                item_pendukung_used: []
              }); 
              setShowForm(true); 
            }}
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: "10px 18px", fontWeight: 800 }}
          >
            <Plus size={18} /> Catat Potongan Baru
          </button>
        </div>
      </div>

      {/* 4 STAT SUMMARY KPI CARDS */}
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)" }}>Total Pcs Terpotong</span>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(37, 99, 235, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563EB" }}>
              <Scissors size={20} />
            </div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "var(--text-primary)", letterSpacing: "-0.5px" }}>
            {stats.totalPcsTerpotong.toLocaleString("id-ID")} <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>pcs</span>
          </div>
          <div style={{ fontSize: 12, color: "#059669", marginTop: 4, fontWeight: 600 }}>
            {stats.totalSisaReady.toLocaleString("id-ID")} pcs siap diterbitkan ke SPK Jahit
          </div>
        </div>

        <div className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)" }}>Kain Roll Terpakai</span>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(16, 185, 129, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#10B981" }}>
              <Layers size={20} />
            </div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "var(--text-primary)", letterSpacing: "-0.5px" }}>
            {stats.totalMeterKain.toLocaleString("id-ID", { maximumFractionDigits: 1 })} <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>m</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
            Dari total {stats.totalRolls} roll kain mentah gudang
          </div>
        </div>

        <div className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)" }}>Batch SPK Potong</span>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(139, 92, 246, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#8B5CF6" }}>
              <FileText size={20} />
            </div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "var(--text-primary)", letterSpacing: "-0.5px" }}>
            {stats.totalBatch} <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>batch</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
            {stats.selesaiCount} Terbit SPK • {stats.draftCount} Draft
          </div>
        </div>

        <div className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)" }}>Sisa Stok Siap Jahit</span>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(245, 158, 11, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#F59E0B" }}>
              <Package size={20} />
            </div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#D97706", letterSpacing: "-0.5px" }}>
            {stats.totalSisaReady.toLocaleString("id-ID")} <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>pcs</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
            Tersedia untuk SPK Jahit / CMT
          </div>
        </div>
      </div>

      {/* TOOLBAR SEARCH & FILTERS */}
      <div className="card" style={{ marginBottom: 20, padding: "16px 20px" }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          {/* SEARCH INPUT */}
          <div style={{ position: "relative", flex: "1 1 300px", minWidth: 260 }}>
            <Search size={17} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input 
              type="text"
              className="form-control"
              placeholder="Cari No SPK (PO-POT-...), kain, model, tukang potong..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: 42, height: 40, borderRadius: 8, fontSize: 13 }}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* FILTER CONTROLS */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {/* TUKANG POTONG SELECT */}
            <select
              className="form-control"
              value={filterTukang}
              onChange={(e) => setFilterTukang(e.target.value)}
              style={{ height: 40, borderRadius: 8, fontSize: 13, minWidth: 160 }}
            >
              <option value="all">Semua Tukang Potong</option>
              {tukangPotong.map(tp => (
                <option key={tp.id} value={tp.id}>{tp.nama} (Kode: {tp.kode})</option>
              ))}
            </select>

            {/* STATUS FILTER PILLS */}
            <div style={{ display: "flex", background: "var(--bg-app)", padding: 3, borderRadius: 8, gap: 2 }}>
              <button
                onClick={() => setFilterStatus("all")}
                className={`btn ${filterStatus === "all" ? "btn-primary" : ""}`}
                style={{ padding: "6px 12px", fontSize: 12, borderRadius: 6, height: 34, ...(filterStatus !== "all" ? { background: "transparent", border: "none", color: "var(--text-secondary)" } : {}) }}
              >
                Semua ({data.length})
              </button>
              <button
                onClick={() => setFilterStatus("ready")}
                className={`btn ${filterStatus === "ready" ? "btn-primary" : ""}`}
                style={{ padding: "6px 12px", fontSize: 12, borderRadius: 6, height: 34, ...(filterStatus !== "ready" ? { background: "transparent", border: "none", color: "var(--text-secondary)" } : {}) }}
              >
                Siap Jahit ({data.filter(d => (d.sizeBreakdown || []).reduce((sum: number, s: any) => sum + (s.sisa !== undefined ? s.sisa : (Number(s.jumlah) || 0)), 0) > 0 && d.status !== "Draft").length})
              </button>
              <button
                onClick={() => setFilterStatus("done")}
                className={`btn ${filterStatus === "done" ? "btn-primary" : ""}`}
                style={{ padding: "6px 12px", fontSize: 12, borderRadius: 6, height: 34, ...(filterStatus !== "done" ? { background: "transparent", border: "none", color: "var(--text-secondary)" } : {}) }}
              >
                Selesai Dibagi
              </button>
              <button
                onClick={() => setFilterStatus("draft")}
                className={`btn ${filterStatus === "draft" ? "btn-primary" : ""}`}
                style={{ padding: "6px 12px", fontSize: 12, borderRadius: 6, height: 34, ...(filterStatus !== "draft" ? { background: "transparent", border: "none", color: "var(--text-secondary)" } : {}) }}
              >
                Draft ({stats.draftCount})
              </button>
            </div>

            {/* SORT SELECT */}
            <select
              className="form-control"
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              style={{ height: 40, borderRadius: 8, fontSize: 13, minWidth: 150 }}
            >
              <option value="newest">Terbaru (Tanggal)</option>
              <option value="oldest">Terlama</option>
              <option value="most_pcs">Pcs Terbanyak</option>
              <option value="most_meter">Meter Terbanyak</option>
            </select>
          </div>
        </div>
      </div>

      {/* TABLE DAFTAR PEMOTONGAN KAIN */}
      {loading ? (
        <div className="card" style={{ padding: 48, textAlign: "center", color: "var(--text-secondary)" }}>
          Memuat data pemotongan kain...
        </div>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          <table className="table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--bg-app)", borderBottom: "1px solid var(--border-color)" }}>
                <th style={{ padding: "14px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>NO & TANGGAL</th>
                <th style={{ padding: "14px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>TUKANG POTONG</th>
                <th style={{ padding: "14px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>KAIN & MODEL</th>
                <th style={{ padding: "14px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>SPESIFIKASI JAHITAN & AKSESORIS</th>
                <th style={{ padding: "14px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>HASIL POTONGAN (STOCK)</th>
                <th style={{ padding: "14px 16px", textAlign: "right", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", minWidth: 260 }}>AKSI</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map(item => {
                const sisa = (item.sizeBreakdown || []).reduce((sum:number, s:any) => sum + (s.sisa !== undefined ? s.sisa : (Number(s.jumlah) || 0)), 0);
                const isHabis = sisa <= 0 && item.status !== "Draft";
                const aksesorisCount = (item.item_pendukung_used || []).length;
                const docNo = `PO-POT-${String(item.id).padStart(4, "0")}`;

                return (
                  <React.Fragment key={item.id}>
                    <tr 
                      onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                      style={{ 
                        opacity: isHabis ? 0.75 : 1, 
                        cursor: "pointer",
                        background: expandedId === item.id ? "rgba(37, 99, 235, 0.04)" : "transparent",
                        transition: "all 0.15s ease",
                        borderBottom: "1px solid var(--border-color)"
                      }}
                    >
                      {/* NO & TANGGAL */}
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, fontFamily: "monospace", background: "#F1F5F9", color: "#334155", padding: "2px 6px", borderRadius: 4 }}>
                            {docNo}
                          </span>
                        </div>
                        <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: 13 }}>{item.tanggal}</div>
                        {item.target_selesai && (
                          <div style={{ fontSize: 11, color: "#059669", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                            <Clock size={11} /> Target: {item.target_selesai}
                          </div>
                        )}
                      </td>

                      {/* TUKANG POTONG */}
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: 14 }}>{item.tukang_potong_nama}</div>
                        <div style={{ display: "inline-block", fontSize: 10, fontWeight: 800, background: "#EFF6FF", color: "#2563EB", border: "1px solid #DBEAFE", padding: "2px 8px", borderRadius: 4, marginTop: 4 }}>
                          Kode: {item.tukang_potong_kode}
                        </div>
                      </td>

                      {/* KAIN & MODEL */}
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{item.nama_barang}</div>
                        <div style={{ marginTop: 2, color: "#0F172A", fontWeight: 800, fontSize: 13 }}>
                          Pola: <span style={{ color: "#2563EB" }}>{item.model}</span>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                          {Number(item.meter_kain).toFixed(2)}m • {(item.selectedRolls || []).length} Roll ({item.pemakaian_cm || 0} cm/pcs)
                        </div>
                      </td>

                      {/* SPESIFIKASI JAHITAN */}
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontSize: 12 }}>
                          {item.jenis_jahitan ? (
                            <div style={{ color: "var(--text-primary)" }}><strong>Jahit:</strong> {item.jenis_jahitan}</div>
                          ) : (
                            <div style={{ color: "var(--text-muted)" }}>Jahit: Standar</div>
                          )}
                          {item.tipe_benang && (
                            <div style={{ color: "#4F46E5", marginTop: 2 }}><strong>Benang:</strong> {item.tipe_benang}</div>
                          )}
                          {item.tipe_resleting && (
                            <div style={{ color: "#0284C7", marginTop: 2 }}><strong>Resleting:</strong> {item.tipe_resleting}</div>
                          )}
                          {aksesorisCount > 0 && (
                            <div style={{ marginTop: 4 }}>
                              <span style={{ fontSize: 10, background: "#ECFDF5", color: "#059669", border: "1px solid #A7F3D0", padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>
                                {aksesorisCount} Bahan Pendukung Terpakai
                              </span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* HASIL POTONGAN STOCK */}
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ fontWeight: 900, fontSize: 17, color: "var(--color-primary)" }}>
                            {item.total_pcs} <span style={{ fontSize: 12, fontWeight: 600 }}>pcs</span>
                          </div>
                          {item.status === "Draft" ? (
                            <span style={{ fontSize: 10, fontWeight: 800, background: "#FEF3C7", color: "#B45309", padding: "2px 8px", borderRadius: 12, border: "1px solid #FDE68A" }}>
                              Draft
                            </span>
                          ) : isHabis ? (
                            <span style={{ fontSize: 10, fontWeight: 800, background: "#ECFDF5", color: "#059669", padding: "2px 8px", borderRadius: 12, border: "1px solid #A7F3D0" }}>
                              Selesai Dibagi
                            </span>
                          ) : (
                            <span style={{ fontSize: 10, fontWeight: 800, background: "#EFF6FF", color: "#1D4ED8", padding: "2px 8px", borderRadius: 12, border: "1px solid #BFDBFE" }}>
                              Sisa: {sisa} pcs
                            </span>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                          {(item.sizeBreakdown || []).map((s:any, idx:number) => (
                            <div key={idx} style={{ padding: "2px 6px", background: "var(--bg-app)", borderRadius: 4, fontSize: 11, fontWeight: 700, border: "1px solid var(--border-color)" }}>
                              {s.size}: <span style={{ color: "#2563EB" }}>{s.jumlah}</span>
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* AKSI */}
                      <td style={{ padding: "14px 16px", textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }} onClick={(e) => e.stopPropagation()}>
                          {/* CETAK PO DOT MATRIX 3-PLY */}
                          <Link 
                            href={`/cetak-po-potongan/${item.id}`}
                            className="btn btn-secondary"
                            style={{ 
                              padding: "6px 10px", 
                              fontSize: 12, 
                              background: "#EFF6FF", 
                              color: "#2563EB", 
                              border: "1px solid #BFDBFE",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              textDecoration: "none",
                              fontWeight: 700,
                              borderRadius: 6
                            }}
                            title="Cetak SPK Potong Dot Matrix 3-Ply"
                          >
                            <Printer size={14} /> Cetak (3-Ply)
                          </Link>

                          {/* SHORTCUT BUAT PO JAHIT DARI SISA POTONGAN */}
                          {sisa > 0 && item.status !== "Draft" && (
                            <Link 
                              href={`/buat-spk`}
                              className="btn btn-secondary"
                              style={{ 
                                padding: "6px 10px", 
                                fontSize: 12, 
                                background: "#ECFDF5", 
                                color: "#065F46", 
                                border: "1px solid #A7F3D0",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                textDecoration: "none",
                                fontWeight: 700,
                                borderRadius: 6
                              }}
                              title="Terbitkan SPK Jahit ke CMT"
                            >
                              <ArrowUpRight size={14} /> Buat PO
                            </Link>
                          )}

                          {/* EDIT */}
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: "6px 10px", fontSize: 12, borderRadius: 6, fontWeight: 700 }} 
                            onClick={() => {
                              setForm({
                                id: item.id,
                                tanggal: item.tanggal,
                                nama_barang: item.nama_barang,
                                meter_kain: item.meter_kain,
                                pemakaian_cm: item.pemakaian_cm,
                                tukang_potong_id: String(item.tukang_potong_id),
                                model: item.model,
                                selectedRolls: item.selectedRolls || [],
                                sizeBreakdown: item.sizeBreakdown || [{ size: "M", jumlah: "" }],
                                target_selesai: item.target_selesai || "",
                                jenis_jahitan: item.jenis_jahitan || "",
                                tipe_benang: item.tipe_benang || "",
                                tipe_resleting: item.tipe_resleting || "",
                                catatan_jahitan: item.catatan_jahitan || "",
                                isi_per_bundle: item.isi_per_bundle || 20,
                                item_pendukung_used: item.item_pendukung_used || []
                              });
                              setSubmitStatus(item.status || "Selesai");
                              setShowForm(true);
                            }}
                          >
                            Edit
                          </button>

                          {/* HAPUS */}
                          <button 
                            className="btn" 
                            style={{ 
                              padding: "6px 10px", 
                              fontSize: 12, 
                              borderRadius: 6,
                              background: sisa < item.total_pcs ? "#F1F5F9" : "#FEE2E2", 
                              color: sisa < item.total_pcs ? "#94A3B8" : "#991B1B",
                              cursor: sisa < item.total_pcs ? "not-allowed" : "pointer",
                              border: "none",
                              fontWeight: 700
                            }} 
                            onClick={() => {
                              if (sisa < item.total_pcs) {
                                alert("TIDAK DIIZINKAN: Sebagian/seluruh potongan kain ini sudah didistribusikan ke CMT (Sudah ada PO).");
                                return;
                              }
                              handleDelete(item.id);
                            }}
                            title={sisa < item.total_pcs ? "Tidak dapat dihapus karena sudah ada PO" : "Hapus pemotongan"}
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                    
                    {/* EXPANDED ROW UNTUK DETAIL HISTORI & AKSESORIS */}
                    {expandedId === item.id && (
                      <tr style={{ background: "var(--bg-app)" }}>
                        <td colSpan={6} style={{ padding: "16px 20px" }}>
                          <div style={{ background: "white", borderRadius: 12, padding: "20px 24px", border: "1px solid var(--border-color)", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                            
                            {/* RINCIAN ROLL KAIN TERPAKAI */}
                            <div style={{ marginBottom: 16, borderBottom: "1px solid var(--border-color)", paddingBottom: 14 }}>
                              <h4 style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                                <Layers size={16} color="#2563EB" /> Rincian Roll Kain yang Dipotong:
                              </h4>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                {(item.selectedRolls || []).map((r: any, idx: number) => (
                                  <div key={idx} style={{ background: "var(--bg-app)", border: "1px solid var(--border-color)", borderRadius: 6, padding: "6px 10px", fontSize: 11 }}>
                                    <span style={{ fontWeight: 800, color: "#2563EB" }}>Roll #{r.id || idx+1}</span>: {Number(r.meter).toFixed(2)} Meter
                                  </div>
                                ))}
                                {(item.selectedRolls || []).length === 0 && (
                                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Data roll spesifik tidak tercatat (manual meter).</span>
                                )}
                              </div>
                            </div>

                            {/* RINCIAN BAHAN PENDUKUNG */}
                            {item.item_pendukung_used && item.item_pendukung_used.length > 0 && (
                              <div style={{ marginBottom: 16, borderBottom: "1px solid var(--border-color)", paddingBottom: 14 }}>
                                <h4 style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                                  <Package size={16} color="#059669" /> Bahan Pendukung / Aksesoris yang Dikeluarkan dari Gudang:
                                </h4>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                  {item.item_pendukung_used.map((it: any, idx: number) => (
                                    <div key={idx} style={{ background: "var(--bg-app)", border: "1px solid var(--border-color)", borderRadius: 6, padding: "6px 10px", fontSize: 12 }}>
                                      <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{it.nama_item}</div>
                                      <div style={{ color: "#059669", fontWeight: 800, marginTop: 2 }}>
                                        {it.qty} {it.satuan} <span style={{ color: "var(--text-secondary)", fontWeight: "normal" }}>({it.kategori})</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* HISTORI DISTRIBUSI KE CMT */}
                            <h4 style={{ marginBottom: 10, fontSize: 13, fontWeight: 800, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6 }}>
                              <CheckCircle2 size={16} color="#10B981" /> Histori Distribusi ke CMT / SPK Jahit
                            </h4>
                            {item.distribusi && item.distribusi.length > 0 ? (
                              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                                <thead>
                                  <tr style={{ borderBottom: "1px solid var(--border-color)", textAlign: "left", color: "var(--text-secondary)" }}>
                                    <th style={{ padding: "8px 12px" }}>No PO (Induk)</th>
                                    <th style={{ padding: "8px 12px" }}>Tanggal Terbit</th>
                                    <th style={{ padding: "8px 12px" }}>CMT Tujuan</th>
                                    <th style={{ padding: "8px 12px" }}>Total (pcs)</th>
                                    <th style={{ padding: "8px 12px" }}>Rincian Size</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {item.distribusi.map((d: any, idx: number) => (
                                    <tr key={idx} style={{ borderBottom: "1px solid var(--border-color)" }}>
                                      <td style={{ padding: "10px 12px" }}>
                                        <Link href="/daftar-spk" style={{ fontWeight: 800, color: "#2563EB", textDecoration: "none" }}>
                                          {d.noPo}
                                        </Link>
                                      </td>
                                      <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>
                                        {d.tanggal ? new Date(d.tanggal).toLocaleDateString("id-ID") : "-"}
                                      </td>
                                      <td style={{ padding: "10px 12px", color: "var(--text-primary)", fontWeight: 700 }}>{d.vendor_nama}</td>
                                      <td style={{ padding: "10px 12px", color: "#10B981", fontWeight: 800 }}>{d.jumlahTerbit} pcs</td>
                                      <td style={{ padding: "10px 12px" }}>
                                        {(d.sizeBreakdown || []).map((s:any, i:number) => (
                                          <span key={i} style={{ marginRight: 6, background: "#EFF6FF", color: "#1D4ED8", padding: "2px 6px", borderRadius: 4, fontWeight: 700, fontSize: 11 }}>
                                            {s.size}: {s.jumlah}
                                          </span>
                                        ))}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Belum ada PO Produksi yang mengambil stok kain ini.</div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: 48, color: "var(--text-secondary)" }}>
                    Tidak ada data pemotongan kain yang cocok dengan pencarian / filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL INPUT HASIL POTONGAN (3-COLUMNS WORKSPACE) */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "20px 16px" }}>
          <div style={{ background: "white", width: "97vw", maxWidth: 1560, borderRadius: 20, overflow: "hidden", boxShadow: "0 25px 80px rgba(0,0,0,0.35)", display: "flex", flexDirection: "column", maxHeight: "94vh" }}>
            
            {/* MODAL HEADER */}
            <div style={{ padding: "20px 32px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(135deg, #F8FAFC, #EFF6FF)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "#DBEAFE", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563EB", boxShadow: "0 2px 6px rgba(37,99,235,0.15)" }}>
                  <Scissors size={24} />
                </div>
                <div>
                  <h2 style={{ color: "#0F172A", margin: 0, fontSize: 20, fontWeight: 900 }}>
                    {form.id ? "Edit Data Pemotongan & SPK Potong" : "Form Order Pemotongan Kain & Alokasi Bahan (SPK Potong)"}
                  </h2>
                  <div style={{ fontSize: 13, color: "#64748B", marginTop: 3 }}>
                    Konfigurasi alokasi kain roll gudang, spesifikasi jahitan & benang/resleting, target hasil potongan, dan bahan pendukung.
                  </div>
                </div>
              </div>

              {/* HEADER BADGES & CLOSE */}
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ display: "flex", gap: 8, background: "white", padding: "6px 14px", borderRadius: 10, border: "1px solid #E2E8F0" }}>
                  <div style={{ fontSize: 12, color: "#64748B" }}>
                    Total Roll: <strong style={{ color: "#0F172A" }}>{form.selectedRolls.length}</strong>
                  </div>
                  <div style={{ color: "#CBD5E1" }}>|</div>
                  <div style={{ fontSize: 12, color: "#64748B" }}>
                    Meter: <strong style={{ color: "#2563EB" }}>{form.meter_kain}m</strong>
                  </div>
                  <div style={{ color: "#CBD5E1" }}>|</div>
                  <div style={{ fontSize: 12, color: "#64748B" }}>
                    Target: <strong style={{ color: "#059669" }}>{totalPcs} pcs</strong>
                  </div>
                </div>

                <button 
                  type="button" 
                  onClick={() => setShowForm(false)} 
                  style={{ background: "white", border: "1px solid #E2E8F0", width: 36, height: 36, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B", transition: "all 0.2s" }}
                  onMouseOver={e => e.currentTarget.style.background = "#F1F5F9"}
                  onMouseOut={e => e.currentTarget.style.background = "white"}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* MODAL BODY (3-COLUMNS WORKSPACE) */}
            <div style={{ overflowY: "auto", flex: 1, padding: "26px 32px" }}>
              <form id="form-pemotongan" onSubmit={handleSave}>
                <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr 1.25fr", gap: 26, alignItems: "start" }}>
                  
                  {/* KOLOM 1: INFORMASI ORDER & ALOKASI KAIN */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    <div style={{ background: "#F8FAFC", padding: "20px 22px", borderRadius: 14, border: "1px solid #E2E8F0" }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#1E293B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#2563EB" }}></span>
                        1. Informasi Order & Tukang Potong
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                        <div>
                          <label className="label" style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>
                            Tanggal Kirim / Potong <span style={{ color: "#EF4444" }}>*</span>
                          </label>
                          <input 
                            required 
                            type="date" 
                            className="form-control" 
                            style={{ padding: "10px 14px", fontSize: 13, borderRadius: 8 }}
                            value={form.tanggal} 
                            onChange={e => setForm({...form, tanggal: e.target.value})} 
                          />
                        </div>
                        <div>
                          <label className="label" style={{ fontWeight: 700, fontSize: 12, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                            Target Selesai Jahit
                            <span style={{ fontSize: 9, background: "#FEF3C7", color: "#92400E", padding: "1px 5px", borderRadius: 6, fontWeight: 800 }}>Wajib</span>
                          </label>
                          <input 
                            required 
                            type="date" 
                            className="form-control" 
                            style={{ padding: "10px 14px", fontSize: 13, borderRadius: 8, borderColor: form.target_selesai ? "#10B981" : "#CBD5E1" }} 
                            value={form.target_selesai} 
                            onChange={e => setForm({...form, target_selesai: e.target.value})} 
                            min={form.tanggal} 
                          />
                        </div>
                      </div>

                      {form.tanggal && form.target_selesai && (
                        <div style={{ fontSize: 11, color: "#059669", marginBottom: 14, fontWeight: 700, background: "#ECFDF5", padding: "6px 10px", borderRadius: 6, border: "1px solid #A7F3D0" }}>
                          Estimasi Durasi Pengerjaan: {Math.ceil((new Date(form.target_selesai).getTime() - new Date(form.tanggal).getTime()) / (1000*60*60*24))} Hari Kerja
                        </div>
                      )}

                      <div style={{ marginBottom: 14 }}>
                        <label className="label" style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>
                          Tukang Potong Penanggung Jawab <span style={{ color: "#EF4444" }}>*</span>
                        </label>
                        <select 
                          required 
                          className="form-control" 
                          style={{ padding: "10px 14px", fontSize: 13, borderRadius: 8 }}
                          value={form.tukang_potong_id} 
                          onChange={e => setForm({...form, tukang_potong_id: e.target.value})}
                        >
                          <option value="">-- Pilih Tukang Potong --</option>
                          {tukangPotong.map(tp => (
                            <option key={tp.id} value={tp.id}>{tp.nama} (Kode: {tp.kode})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="label" style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>
                          Model Pola / Kategori Produk <span style={{ color: "#EF4444" }}>*</span>
                        </label>
                        <select 
                          required 
                          className="form-control" 
                          style={{ padding: "10px 14px", fontSize: 13, borderRadius: 8 }}
                          value={form.model} 
                          onChange={e => setForm({...form, model: e.target.value})}
                        >
                          <option value="">-- Pilih Model Pola --</option>
                          {kategoriList.map(k => (
                            <option key={k.id} value={k.nama}>{k.nama}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* ALOKASI KAIN MENTAH & ROLL SELECTION */}
                    <div style={{ background: "#F8FAFC", padding: "20px 22px", borderRadius: 14, border: "1px solid #E2E8F0" }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#1E293B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#0284C7" }}></span>
                        2. Alokasi Kain Mentah dari Gudang
                      </div>

                      <div style={{ marginBottom: 14 }}>
                        <label className="label" style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>
                          Pilih Kain Mentah <span style={{ color: "#EF4444" }}>*</span>
                        </label>
                        <select 
                          required 
                          className="form-control" 
                          style={{ padding: "10px 14px", fontSize: 13, borderRadius: 8 }}
                          value={form.nama_barang} 
                          onChange={e => setForm({...form, nama_barang: e.target.value, selectedRolls: [], meter_kain: 0})}
                        >
                          <option value="">-- Pilih Kain Mentah di Gudang --</option>
                          {dataKainList.map(k => (
                            <option key={k.id} value={k.nama_kain}>
                              {k.nama_kain} ({k.warna || "-"}) | Sisa: {Number(k.stok_meter).toFixed(2)} m ({(k.rolls || []).length} Roll)
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* ROLL SELECTION CHIPS */}
                      {form.nama_barang && (
                        <div style={{ background: "white", padding: 14, borderRadius: 10, border: "1px solid #CBD5E1", marginBottom: 14 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                            <span style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>
                              Pilih Roll yang Dipotong ({form.selectedRolls.length} terpilih):
                            </span>
                            <span style={{ fontSize: 11, color: "#64748B" }}>Klik untuk pilih/lepas</span>
                          </div>

                          {availableRolls.length > 0 ? (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, maxHeight: 180, overflowY: "auto", padding: 4 }}>
                              {availableRolls.map(roll => {
                                const isSelected = form.selectedRolls.some(r => r.id === roll.id);
                                return (
                                  <button
                                    key={roll.id}
                                    type="button"
                                    onClick={() => handleRollToggle(roll)}
                                    style={{
                                      padding: "6px 10px",
                                      borderRadius: 6,
                                      border: isSelected ? "2px solid #2563EB" : "1px solid #CBD5E1",
                                      background: isSelected ? "#EFF6FF" : "#F8FAFC",
                                      color: isSelected ? "#1D4ED8" : "#475569",
                                      fontSize: 11,
                                      fontWeight: isSelected ? 800 : 600,
                                      cursor: "pointer",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 6
                                    }}
                                  >
                                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: isSelected ? "#2563EB" : "#94A3B8" }}></span>
                                    Roll #{roll.id}: {roll.meter}m
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div style={{ fontSize: 12, color: "#DC2626", fontStyle: "italic", padding: "8px 0" }}>
                              Perhatian: Tidak ada roll terdaftar pada kain ini di Gudang.
                            </div>
                          )}
                        </div>
                      )}

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div>
                          <label className="label" style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>
                            Panjang Kain Terpakai (m)
                          </label>
                          <input 
                            required 
                            type="number" 
                            step="0.01" 
                            className="form-control" 
                            style={{ padding: "10px 14px", fontSize: 13, borderRadius: 8, fontWeight: 800, color: "#2563EB" }} 
                            value={form.meter_kain || ""} 
                            onChange={e => setForm({...form, meter_kain: Number(e.target.value)})} 
                          />
                        </div>
                        <div>
                          <label className="label" style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>
                            Estimasi Konsumsi (cm/pcs)
                          </label>
                          <input 
                            type="number" 
                            className="form-control" 
                            style={{ padding: "10px 14px", fontSize: 13, borderRadius: 8 }} 
                            value={form.pemakaian_cm} 
                            onChange={e => setForm({...form, pemakaian_cm: e.target.value})} 
                            placeholder="Contoh: 120" 
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* KOLOM 2: SPESIFIKASI JAHITAN & AKSESORIS */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    <div style={{ background: "#F8FAFC", padding: "20px 22px", borderRadius: 14, border: "1px solid #E2E8F0" }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#1E293B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4F46E5" }}></span>
                        3. Spesifikasi Teknis Jahitan & Benang
                      </div>

                      {/* JENIS JAHITAN */}
                      <div style={{ marginBottom: 14 }}>
                        <label className="label" style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>
                          Jenis Jahitan yang Digunakan
                        </label>
                        <input 
                          type="text" 
                          className="form-control" 
                          style={{ padding: "10px 14px", fontSize: 13, borderRadius: 8, marginBottom: 6 }} 
                          value={form.jenis_jahitan} 
                          onChange={e => setForm({...form, jenis_jahitan: e.target.value})} 
                          placeholder="Pilih preset di bawah atau ketik..." 
                        />
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {jahitanPresets.map((j, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                const current = form.jenis_jahitan ? form.jenis_jahitan.split(", ").map(s => s.trim()) : [];
                                if (!current.includes(j)) {
                                  setForm({ ...form, jenis_jahitan: current.length ? `${form.jenis_jahitan}, ${j}` : j });
                                }
                              }}
                              style={{
                                fontSize: 10,
                                padding: "3px 8px",
                                borderRadius: 4,
                                border: "1px solid #CBD5E1",
                                background: "white",
                                cursor: "pointer",
                                color: "#475569"
                              }}
                            >
                              + {j}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* TIPE BENANG */}
                      <div style={{ marginBottom: 14 }}>
                        <label className="label" style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>
                          Type / Warna Benang
                        </label>
                        <input 
                          type="text" 
                          className="form-control" 
                          style={{ padding: "10px 14px", fontSize: 13, borderRadius: 8 }} 
                          value={form.tipe_benang} 
                          onChange={e => setForm({...form, tipe_benang: e.target.value})} 
                          placeholder="Contoh: Astra Jeans 20/2 - Kuning Emas (Gold) / Navy" 
                        />
                      </div>

                      {/* TIPE RESLETING */}
                      <div style={{ marginBottom: 14 }}>
                        <label className="label" style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>
                          Type Resleting
                        </label>
                        <input 
                          type="text" 
                          className="form-control" 
                          style={{ padding: "10px 14px", fontSize: 13, borderRadius: 8 }} 
                          value={form.tipe_resleting} 
                          onChange={e => setForm({...form, tipe_resleting: e.target.value})} 
                          placeholder="Contoh: YKK Metal Brass Gigi Tembaga Bakar 5 Inci" 
                        />
                      </div>

                      {/* CATATAN JAHIT */}
                      <div>
                        <label className="label" style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>
                          Catatan Khusus Penjahitan
                        </label>
                        <textarea 
                          className="form-control" 
                          rows={3} 
                          style={{ padding: "10px 14px", fontSize: 13, borderRadius: 8 }} 
                          value={form.catatan_jahitan} 
                          onChange={e => setForm({...form, catatan_jahitan: e.target.value})} 
                          placeholder="Catatan untuk operator potong & CMT..."
                        />
                      </div>
                    </div>

                    {/* ALOKASI BAHAN PENDUKUNG & AKSESORIS */}
                    <div style={{ background: "#F8FAFC", padding: "20px 22px", borderRadius: 14, border: "1px solid #E2E8F0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#1E293B", textTransform: "uppercase", letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981" }}></span>
                          4. Bahan Pendukung (Surat Jalan)
                        </div>
                        <button
                          type="button"
                          onClick={handleAddItemPendukung}
                          className="btn btn-secondary"
                          style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, display: "flex", alignItems: "center", gap: 4 }}
                        >
                          <Plus size={12} /> Tambah Item
                        </button>
                      </div>

                      {form.item_pendukung_used.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {form.item_pendukung_used.map((it, idx) => (
                            <div key={idx} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 32px", gap: 8, alignItems: "center", background: "white", padding: "8px 10px", borderRadius: 8, border: "1px solid #E2E8F0" }}>
                              <select
                                className="form-control"
                                style={{ fontSize: 12, padding: "6px 8px" }}
                                value={it.item_id}
                                onChange={e => handleItemPendukungChange(idx, "item_id", e.target.value)}
                              >
                                {itemPendukungList.map(item => (
                                  <option key={item.id} value={item.id}>
                                    {item.nama} (Stok: {item.stok} {item.satuan})
                                  </option>
                                ))}
                              </select>

                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <input
                                  type="number"
                                  className="form-control"
                                  placeholder="Jml"
                                  style={{ fontSize: 12, padding: "6px 8px", width: "100%" }}
                                  value={it.qty}
                                  onChange={e => handleItemPendukungChange(idx, "qty", e.target.value)}
                                />
                                <span style={{ fontSize: 11, color: "#64748B", minWidth: 28 }}>{it.satuan}</span>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleRemoveItemPendukung(idx)}
                                style={{ background: "none", border: "none", color: "#DC2626", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: "#64748B", fontStyle: "italic", textAlign: "center", padding: "12px 0" }}>
                          Belum ada bahan pendukung yang ditambahkan.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* KOLOM 3: TARGET SIZE BREAKDOWN & BUNDLE PRESETS */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    <div style={{ background: "#F8FAFC", padding: "20px 22px", borderRadius: 14, border: "1px solid #E2E8F0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#1E293B", textTransform: "uppercase", letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#F59E0B" }}></span>
                          5. Target Hasil Potong (Size Breakdown)
                        </div>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button
                            type="button"
                            onClick={() => applySizePreset("jeans")}
                            style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, border: "1px solid #CBD5E1", background: "white", cursor: "pointer", color: "#2563EB", fontWeight: 700 }}
                          >
                            Jeans (28-36)
                          </button>
                          <button
                            type="button"
                            onClick={() => applySizePreset("standard")}
                            style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, border: "1px solid #CBD5E1", background: "white", cursor: "pointer", color: "#475569", fontWeight: 700 }}
                          >
                            S-XXL
                          </button>
                        </div>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                        {form.sizeBreakdown.map((row, idx) => (
                          <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr 32px", gap: 8, alignItems: "center" }}>
                            <input
                              type="text"
                              className="form-control"
                              placeholder="Size"
                              style={{ padding: "8px 10px", fontSize: 12, fontWeight: 800, textAlign: "center" }}
                              value={row.size}
                              onChange={e => {
                                const updated = [...form.sizeBreakdown];
                                updated[idx].size = e.target.value;
                                setForm({ ...form, sizeBreakdown: updated });
                              }}
                            />
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <input
                                type="number"
                                className="form-control"
                                placeholder="Jumlah Pcs"
                                style={{ padding: "8px 10px", fontSize: 12, fontWeight: 800 }}
                                value={row.jumlah}
                                onChange={e => {
                                  const updated = [...form.sizeBreakdown];
                                  updated[idx].jumlah = e.target.value;
                                  setForm({ ...form, sizeBreakdown: updated });
                                }}
                              />
                              <span style={{ fontSize: 11, color: "#64748B" }}>pcs</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = form.sizeBreakdown.filter((_, i) => i !== idx);
                                setForm({ ...form, sizeBreakdown: updated });
                              }}
                              style={{ background: "none", border: "none", color: "#DC2626", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => setForm({ ...form, sizeBreakdown: [...form.sizeBreakdown, { size: "", jumlah: "" }] })}
                        className="btn btn-secondary"
                        style={{ width: "100%", fontSize: 11, padding: "6px 12px", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 16 }}
                      >
                        <Plus size={12} /> Tambah Baris Ukuran
                      </button>

                      {/* ISI PER BUNDLE */}
                      <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: 14 }}>
                        <label className="label" style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>
                          Isi Standar Per Ikat / Bundle (Kodi)
                        </label>
                        <input
                          type="number"
                          className="form-control"
                          style={{ padding: "8px 12px", fontSize: 12 }}
                          value={form.isi_per_bundle}
                          onChange={e => setForm({ ...form, isi_per_bundle: Number(e.target.value) || 20 })}
                          placeholder="Default: 20 pcs (1 Kodi)"
                        />
                        <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>
                          Digunakan untuk perhitungan jumlah bendel & surat jalan potong dot matrix.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </div>

            {/* MODAL FOOTER */}
            <div style={{ padding: "16px 32px", borderTop: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#F8FAFC" }}>
              <button 
                type="button" 
                onClick={() => setShowForm(false)} 
                className="btn btn-secondary"
                style={{ padding: "10px 20px", fontSize: 13, fontWeight: 700 }}
              >
                Batal
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  type="submit"
                  form="form-pemotongan"
                  className="btn btn-secondary"
                  onClick={() => setSubmitStatus("Draft")}
                  style={{ padding: "10px 18px", fontSize: 13, fontWeight: 700, border: "1px solid #CBD5E1" }}
                >
                  Simpan Draft Saja
                </button>
                <button
                  type="submit"
                  form="form-pemotongan"
                  className="btn btn-primary"
                  onClick={() => setSubmitStatus("Selesai")}
                  style={{ padding: "10px 24px", fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}
                >
                  <Save size={16} /> Simpan Data Potongan & Terbitkan SPK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
