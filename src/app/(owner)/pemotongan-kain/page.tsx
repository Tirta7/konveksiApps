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
  Check,
  AlertCircle
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
  const [filterStatus, setFilterStatus] = useState<"all" | "ready" | "done" | "draft" | "belum_terbit" | "sudah_terbit">("all");
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
    const interval = setInterval(() => { if (!document.hidden) fetchData(); }, 30000);
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

  const handleSelectAllRolls = () => {
    if (!availableRolls.length) return;
    const totalMeter = availableRolls.reduce((sum, r) => sum + (Number(r.meter) || 0), 0);
    const roundedTotal = Math.round(totalMeter * 1000) / 1000;
    setForm({ ...form, selectedRolls: [...availableRolls], meter_kain: roundedTotal });
  };

  const handleClearAllRolls = () => {
    setForm({ ...form, selectedRolls: [], meter_kain: 0 });
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

  const benangPresets = [
    "Benang Astra Jeans 20/2 (Gold / Kuning Emas)",
    "Benang Astra Jeans 20/2 (Navy Senada)",
    "Benang Astra Jeans 20/2 (Hitam Pekat)",
    "Benang Astra Jeans 20/3 (Gold Heavy)",
    "Spun 40/2 (Senada Kain)"
  ];

  const resletingPresets = [
    "Resleting YKK Metal Brass No. 5 (Gigi Kuningan 5\")",
    "Resleting YKK Gigi Bakar No. 5 (Antique 5\")",
    "Resleting YKK Nylon Coil No. 5 (5\")",
    "Kancing Jeans Saja (Tanpa Zipper)"
  ];

  const applySizePreset = (preset: "jeans" | "standard" | "anak") => {
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
    } else if (preset === "anak") {
      setForm(prev => ({
        ...prev,
        sizeBreakdown: [
          { size: "4", jumlah: "" },
          { size: "6", jumlah: "" },
          { size: "8", jumlah: "" },
          { size: "10", jumlah: "" },
          { size: "12", jumlah: "" }
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
    // Sisa siap terbit: hanya batch yang BUKAN Draft (karena Draft belum terbit / belum dipotong final)
    const totalSisaReady = data.filter(d => d.status !== "Draft").reduce((sum, d) => {
      const sisa = (d.sizeBreakdown || []).reduce((sSum: number, s: any) => sSum + (s.sisa !== undefined ? s.sisa : (Number(s.jumlah) || 0)), 0);
      return sum + sisa;
    }, 0);
    const totalDraftPcs = data.filter(d => d.status === "Draft").reduce((sum, d) => sum + (Number(d.total_pcs) || 0), 0);
    const draftCount = data.filter(d => d.status === "Draft").length;
    const selesaiCount = data.filter(d => d.status !== "Draft").length;

    // PO Issuance Calculations
    const totalIssuedPcs = data.reduce((sum, d) => {
      return sum + ((d.distribusi || []).reduce((pSum: number, po: any) => pSum + (Number(po.jumlahTerbit) || 0), 0));
    }, 0);
    const belumTerbitCount = data.filter(d => (d.distribusi || []).length === 0 && d.status !== "Draft").length;
    const sudahTerbitCount = data.filter(d => (d.distribusi || []).length > 0).length;

    return {
      totalPcsTerpotong,
      totalMeterKain,
      totalRolls,
      totalBatch,
      totalSisaReady,
      totalDraftPcs,
      draftCount,
      selesaiCount,
      totalIssuedPcs,
      belumTerbitCount,
      sudahTerbitCount
    };
  }, [data]);

  // Filtered & Sorted Data
  const filteredData = useMemo(() => {
    return data.filter(item => {
      const sisa = (item.sizeBreakdown || []).reduce((sum: number, s: any) => sum + (s.sisa !== undefined ? s.sisa : (Number(s.jumlah) || 0)), 0);
      const q = searchQuery.toLowerCase().trim();
      const docNo = `po-pot-${String(item.id).padStart(4, "0")}`;
      
      const matchPo = (item.distribusi || []).some((po: any) => 
        (po.noPo || "").toLowerCase().includes(q) ||
        (po.vendor_nama || "").toLowerCase().includes(q)
      );

      const matchQuery = !q || (
        docNo.includes(q) ||
        String(item.id).includes(q) ||
        (item.nama_barang || "").toLowerCase().includes(q) ||
        (item.model || "").toLowerCase().includes(q) ||
        (item.tukang_potong_nama || "").toLowerCase().includes(q) ||
        (item.tukang_potong_kode || "").toLowerCase().includes(q) ||
        (item.tipe_benang || "").toLowerCase().includes(q) ||
        (item.tipe_resleting || "").toLowerCase().includes(q) ||
        (item.tanggal || "").toLowerCase().includes(q) ||
        matchPo
      );

      const matchTukang = filterTukang === "all" || String(item.tukang_potong_id) === String(filterTukang);

      let matchStatus = true;
      if (filterStatus === "draft") {
        matchStatus = item.status === "Draft";
      } else if (filterStatus === "ready") {
        matchStatus = sisa > 0 && item.status !== "Draft";
      } else if (filterStatus === "done") {
        matchStatus = sisa <= 0 && item.status !== "Draft";
      } else if (filterStatus === "belum_terbit") {
        matchStatus = (item.distribusi || []).length === 0 && item.status !== "Draft";
      } else if (filterStatus === "sudah_terbit") {
        matchStatus = (item.distribusi || []).length > 0;
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
    <div style={{ padding: "32px 32px 48px 32px", background: "var(--bg-app)", minHeight: "100%", overflowY: "auto" }}>
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
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
            <strong style={{ color: "#059669" }}>{stats.totalIssuedPcs.toLocaleString("id-ID")} pcs</strong> sudah terbit PO • <strong style={{ color: "#2563EB" }}>{stats.totalSisaReady.toLocaleString("id-ID")} pcs</strong> siap PO
            {stats.totalDraftPcs > 0 && <span style={{ color: "#D97706" }}> • {stats.totalDraftPcs.toLocaleString("id-ID")} pcs draft</span>}
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
            <span style={{ color: "#059669", fontWeight: 700 }}>{stats.sudahTerbitCount} Ada PO</span> • <span style={{ color: "#2563EB", fontWeight: 700 }}>{stats.belumTerbitCount} Belum Ada PO</span> • {stats.draftCount} Draft
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
            Tersedia untuk SPK Jahit / CMT {stats.totalDraftPcs > 0 ? `(${stats.totalDraftPcs.toLocaleString("id-ID")} pcs masih draft)` : ""}
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
            <div style={{ display: "flex", background: "var(--bg-app)", padding: 3, borderRadius: 8, gap: 2, flexWrap: "wrap" }}>
              <button
                onClick={() => setFilterStatus("all")}
                className={`btn ${filterStatus === "all" ? "btn-primary" : ""}`}
                style={{ padding: "6px 12px", fontSize: 12, borderRadius: 6, height: 34, ...(filterStatus !== "all" ? { background: "transparent", border: "none", color: "var(--text-secondary)" } : {}) }}
              >
                Semua ({data.length})
              </button>
              <button
                onClick={() => setFilterStatus("belum_terbit")}
                className={`btn ${filterStatus === "belum_terbit" ? "btn-primary" : ""}`}
                style={{ padding: "6px 12px", fontSize: 12, borderRadius: 6, height: 34, ...(filterStatus !== "belum_terbit" ? { background: "transparent", border: "none", color: "var(--text-secondary)" } : {}) }}
              >
                Belum Terbit PO ({stats.belumTerbitCount})
              </button>
              <button
                onClick={() => setFilterStatus("sudah_terbit")}
                className={`btn ${filterStatus === "sudah_terbit" ? "btn-primary" : ""}`}
                style={{ padding: "6px 12px", fontSize: 12, borderRadius: 6, height: 34, ...(filterStatus !== "sudah_terbit" ? { background: "transparent", border: "none", color: "var(--text-secondary)" } : {}) }}
              >
                Sudah Ada PO ({stats.sudahTerbitCount})
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
        <div className="card" style={{ overflowX: "auto" }}>
          <table className="table" style={{ width: "100%", borderCollapse: "collapse", minWidth: 1080 }}>
            <thead>
              <tr style={{ background: "var(--bg-app)", borderBottom: "1px solid var(--border-color)" }}>
                <th style={{ padding: "14px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>NO & TANGGAL</th>
                <th style={{ padding: "14px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>TUKANG POTONG</th>
                <th style={{ padding: "14px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>KAIN & MODEL</th>
                <th style={{ padding: "14px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>SPESIFIKASI JAHITAN & AKSESORIS</th>
                <th style={{ padding: "14px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>HASIL POTONGAN (STOCK)</th>
                <th style={{ padding: "14px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", minWidth: 200 }}>STATUS PENERBITAN PO</th>
                <th style={{ padding: "14px 16px", textAlign: "right", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", minWidth: 230 }}>AKSI</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map(item => {
                const sisa = (item.sizeBreakdown || []).reduce((sum:number, s:any) => sum + (s.sisa !== undefined ? s.sisa : (Number(s.jumlah) || 0)), 0);
                const isHabis = sisa <= 0 && item.status !== "Draft";
                const aksesorisCount = (item.item_pendukung_used || []).length;
                const docNo = `PO-POT-${String(item.id).padStart(4, "0")}`;
                const poList = item.distribusi || [];
                const poCount = poList.length;
                const totalPcsTerbit = poList.reduce((sum: number, d: any) => sum + (Number(d.jumlahTerbit) || 0), 0);

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

                      {/* STATUS PENERBITAN PO */}
                      <td style={{ padding: "14px 16px" }}>
                        {item.status === "Draft" ? (
                          <div>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 800, background: "#FEF3C7", color: "#B45309", border: "1px solid #FDE68A" }}>
                              <Clock size={12} /> Belum Terbit PO (Draft)
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.3 }}>
                              SPK potong masih draft. Simpan permanen untuk terbitkan PO.
                            </div>
                          </div>
                        ) : poCount === 0 ? (
                          <div>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 800, background: "#F1F5F9", color: "#475569", border: "1px solid #E2E8F0" }}>
                              <AlertCircle size={12} color="#64748B" /> Belum Diterbitkan PO
                            </div>
                            <div style={{ fontSize: 11, color: "#2563EB", fontWeight: 700, marginTop: 4, lineHeight: 1.3 }}>
                              Utuh 100% ({sisa.toLocaleString("id-ID")} pcs)
                            </div>
                            <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 1 }}>
                              Siap dialokasikan ke CMT
                            </div>
                          </div>
                        ) : sisa > 0 ? (
                          <div>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 800, background: "#F5F3FF", color: "#6D28D9", border: "1px solid #DDD6FE" }}>
                              <CheckCircle2 size={12} color="#7C3AED" /> Sebagian Terbit ({poCount} PO)
                            </div>
                            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-primary)", marginTop: 4 }}>
                              Terbit: <span style={{ color: "#7C3AED" }}>{totalPcsTerbit.toLocaleString("id-ID")} pcs</span> • Sisa: <span style={{ color: "#2563EB" }}>{sisa.toLocaleString("id-ID")} pcs</span>
                            </div>
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                              {poList.map((po: any, pIdx: number) => (
                                <Link
                                  key={pIdx}
                                  href="/daftar-spk"
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ 
                                    fontSize: 10, 
                                    fontWeight: 800, 
                                    background: "#EDE9FE", 
                                    color: "#5B21B6", 
                                    padding: "2px 6px", 
                                    borderRadius: 4, 
                                    textDecoration: "none",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 3
                                  }}
                                  title={`No PO: ${po.noPo} - CMT: ${po.vendor_nama} (${po.jumlahTerbit} pcs)`}
                                >
                                  <span>{po.noPo}</span>
                                  <span style={{ opacity: 0.75 }}>({po.jumlahTerbit} pcs)</span>
                                </Link>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 800, background: "#ECFDF5", color: "#065F46", border: "1px solid #A7F3D0" }}>
                              <CheckCircle2 size={12} color="#059669" /> Sudah Terbit Penuh ({poCount} PO)
                            </div>
                            <div style={{ fontSize: 11, fontWeight: 800, color: "#059669", marginTop: 4 }}>
                              Semua {item.total_pcs.toLocaleString("id-ID")} pcs terbit ke CMT
                            </div>
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                              {poList.map((po: any, pIdx: number) => (
                                <Link
                                  key={pIdx}
                                  href="/daftar-spk"
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ 
                                    fontSize: 10, 
                                    fontWeight: 800, 
                                    background: "#D1FAE5", 
                                    color: "#047857", 
                                    padding: "2px 6px", 
                                    borderRadius: 4, 
                                    textDecoration: "none",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 3
                                  }}
                                  title={`No PO: ${po.noPo} - CMT: ${po.vendor_nama} (${po.jumlahTerbit} pcs)`}
                                >
                                  <span>{po.noPo}</span>
                                  <span style={{ opacity: 0.75 }}>({po.jumlahTerbit} pcs)</span>
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}
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
                              title={poCount > 0 ? "Terbitkan PO Tambahan untuk sisa potongan" : "Terbitkan SPK Jahit ke CMT"}
                            >
                              <ArrowUpRight size={14} /> {poCount > 0 ? "+ PO Sisa" : "Buat PO"}
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
                        <td colSpan={7} style={{ padding: "16px 20px" }}>
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
                  <td colSpan={7} style={{ textAlign: "center", padding: 48, color: "var(--text-secondary)" }}>
                    Tidak ada data pemotongan kain yang cocok dengan pencarian / filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL INPUT / EDIT HASIL POTONGAN & SPK POTONG (MODERN WORKSPACE) */}
      {showForm && (() => {
        const modalMeterKain = Number(form.meter_kain) || 0;
        const modalEstimasiCm = Number(form.pemakaian_cm) || 0;
        const modalKonsumsiAktualCm = totalPcs > 0 ? (modalMeterKain * 100) / totalPcs : 0;
        const modalPotensiPcsTeoritis = modalEstimasiCm > 0 ? Math.floor((modalMeterKain * 100) / modalEstimasiCm) : 0;
        const modalSelisihOutput = totalPcs - modalPotensiPcsTeoritis;

        const modalRasioEfisiensi = modalEstimasiCm > 0 && modalKonsumsiAktualCm > 0 
          ? (modalKonsumsiAktualCm / modalEstimasiCm) * 100 
          : 100;

        let efisiensiLabel = "Normal / Standar";
        let efisiensiColor = "#2563EB";
        let efisiensiBg = "#EFF6FF";
        let efisiensiBorder = "#BFDBFE";
        let efisiensiDesc = "Konsumsi kain sesuai dengan estimasi pola konveksi.";

        if (modalEstimasiCm > 0 && modalKonsumsiAktualCm > 0) {
          if (modalRasioEfisiensi < 98) {
            efisiensiLabel = "Sangat Hemat Kain";
            efisiensiColor = "#059669";
            efisiensiBg = "#ECFDF5";
            efisiensiBorder = "#A7F3D0";
            efisiensiDesc = `Realisasi ${modalKonsumsiAktualCm.toFixed(1)} cm/pcs lebih hemat daripada target pola ${modalEstimasiCm} cm/pcs.`;
          } else if (modalRasioEfisiensi <= 112) {
            efisiensiLabel = "Standar & Optimal";
            efisiensiColor = "#2563EB";
            efisiensiBg = "#EFF6FF";
            efisiensiBorder = "#BFDBFE";
            efisiensiDesc = `Realisasi ${modalKonsumsiAktualCm.toFixed(1)} cm/pcs sangat presisi mendekati target pola ${modalEstimasiCm} cm/pcs.`;
          } else if (modalRasioEfisiensi <= 135) {
            efisiensiLabel = "Pola Rumit / Variasi Pecah Pola";
            efisiensiColor = "#D97706";
            efisiensiBg = "#FFFBEB";
            efisiensiBorder = "#FDE68A";
            efisiensiDesc = `Realisasi ${modalKonsumsiAktualCm.toFixed(1)} cm/pcs wajar untuk pola bertingkat, variasi saku, & limbah perca.`;
          } else {
            efisiensiLabel = "Konsumsi Tinggi (Perlu Review)";
            efisiensiColor = "#DC2626";
            efisiensiBg = "#FEF2F2";
            efisiensiBorder = "#FECACA";
            efisiensiDesc = `Konsumsi ${modalKonsumsiAktualCm.toFixed(1)} cm/pcs melebihi estimasi standar (+${(modalRasioEfisiensi - 100).toFixed(0)}%). Cek susunan mal potong.`;
          }
        }

        const modalIsiPerBundle = Number(form.isi_per_bundle) || 20;
        const modalTotalBundle = Math.floor(totalPcs / modalIsiPerBundle);
        const modalSisaBundlePcs = totalPcs % modalIsiPerBundle;
        const modalSelectedTukang = tukangPotong.find(tp => String(tp.id) === String(form.tukang_potong_id));

        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "16px" }}>
            <div style={{ background: "white", width: "98vw", maxWidth: 1600, borderRadius: 20, overflow: "hidden", boxShadow: "0 25px 80px rgba(0,0,0,0.35)", display: "flex", flexDirection: "column", maxHeight: "95vh" }}>
              
              {/* MODAL HEADER */}
              <div style={{ padding: "18px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)", color: "white" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", boxShadow: "0 4px 14px rgba(37,99,235,0.45)" }}>
                    <Scissors size={22} />
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <h2 style={{ color: "white", margin: 0, fontSize: 18, fontWeight: 900, letterSpacing: "-0.3px" }}>
                        {form.id ? "Edit Data Pemotongan & SPK Potong" : "Form Order Pemotongan Kain & Alokasi Bahan (SPK Potong)"}
                      </h2>
                      <span style={{ background: "rgba(59, 130, 246, 0.25)", color: "#93C5FD", padding: "2px 9px", borderRadius: 6, fontSize: 11, fontWeight: 800, letterSpacing: "0.5px" }}>
                        {form.id ? `PO-POT-${String(form.id).padStart(4, "0")}` : "DRAFT BARU"}
                      </span>
                      <span style={{ 
                        background: submitStatus === "Draft" ? "rgba(245, 158, 11, 0.25)" : "rgba(16, 185, 129, 0.25)", 
                        color: submitStatus === "Draft" ? "#FCD34D" : "#6EE7B7", 
                        padding: "2px 9px", 
                        borderRadius: 6, 
                        fontSize: 10, 
                        fontWeight: 800 
                      }}>
                        {submitStatus === "Draft" ? "STATUS: DRAFT" : "STATUS: SIAP JAHIT"}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>
                      Konfigurasi alokasi kain roll gudang, spesifikasi jahitan & benang/resleting, target hasil potongan, dan bahan pendukung.
                    </div>
                  </div>
                </div>

                {/* HEADER METRICS STRIP & CLOSE BUTTON */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255, 255, 255, 0.08)", backdropFilter: "blur(10px)", borderRadius: 10, padding: "6px 14px" }}>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>
                      Roll: <strong style={{ color: "white" }}>{form.selectedRolls.length}</strong>
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.2)" }}>|</div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>
                      Kain: <strong style={{ color: "#60A5FA" }}>{form.meter_kain.toLocaleString("id-ID")}m</strong>
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.2)" }}>|</div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>
                      Target: <strong style={{ color: "#34D399" }}>{totalPcs.toLocaleString("id-ID")} pcs</strong>
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.2)" }}>|</div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>
                      Bundle: <strong style={{ color: "#FBBF24" }}>{modalTotalBundle} Ikat</strong>
                    </div>
                    {modalKonsumsiAktualCm > 0 && (
                      <>
                        <div style={{ color: "rgba(255,255,255,0.2)" }}>|</div>
                        <div style={{ fontSize: 11, color: "#94A3B8" }}>
                          Aktual: <strong style={{ color: "#F472B6" }}>{modalKonsumsiAktualCm.toFixed(1)} cm</strong>
                        </div>
                      </>
                    )}
                  </div>

                  <button 
                    type="button" 
                    onClick={() => setShowForm(false)} 
                    style={{ background: "rgba(255, 255, 255, 0.1)", border: "none", width: 34, height: 34, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "white", transition: "all 0.2s" }}
                    onMouseOver={e => e.currentTarget.style.background = "rgba(255, 255, 255, 0.25)"}
                    onMouseOut={e => e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* MODAL BODY (BORDERLESS BALANCED 3-COLUMNS WORKSPACE) */}
              <div style={{ overflowY: "auto", flex: 1, padding: "20px 28px", background: "#F1F5F9" }}>
                <form id="form-pemotongan" onSubmit={handleSave}>
                  <div style={{ display: "grid", gridTemplateColumns: "1.08fr 1fr 1.15fr", gap: 20, alignItems: "start" }}>
                    
                    {/* KOLOM 1: INFORMASI ORDER & ALOKASI KAIN */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                      
                      {/* CARD 1: DOKUMEN & TUKANG POTONG */}
                      <div style={{ background: "white", padding: "20px 22px", borderRadius: 16, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.04)" }}>
                        <div style={{ fontSize: 12, fontWeight: 900, color: "#1E293B", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#2563EB" }}></span>
                            1. Informasi Dokumen & Penanggung Jawab
                          </div>
                          <span style={{ fontSize: 10, background: "#EFF6FF", color: "#2563EB", padding: "2px 8px", borderRadius: 6, fontWeight: 700 }}>
                            Langkah 1/6
                          </span>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                          <div>
                            <label className="label" style={{ fontWeight: 700, fontSize: 11, marginBottom: 5, color: "#475569" }}>
                              Tanggal Kirim / Potong <span style={{ color: "#EF4444" }}>*</span>
                            </label>
                            <input 
                              required 
                              type="date" 
                              className="form-control" 
                              style={{ padding: "8px 12px", fontSize: 12, borderRadius: 8, border: "1px solid #CBD5E1" }}
                              value={form.tanggal} 
                              onChange={e => setForm({...form, tanggal: e.target.value})} 
                            />
                          </div>
                          <div>
                            <label className="label" style={{ fontWeight: 700, fontSize: 11, marginBottom: 5, color: "#475569", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <span>Target Selesai Jahit</span>
                              <span style={{ fontSize: 9, background: "#FEF3C7", color: "#92400E", padding: "1px 5px", borderRadius: 4, fontWeight: 800 }}>Wajib</span>
                            </label>
                            <input 
                              required 
                              type="date" 
                              className="form-control" 
                              style={{ padding: "8px 12px", fontSize: 12, borderRadius: 8, border: form.target_selesai ? "1.5px solid #10B981" : "1px solid #CBD5E1" }} 
                              value={form.target_selesai} 
                              onChange={e => setForm({...form, target_selesai: e.target.value})} 
                              min={form.tanggal} 
                            />
                          </div>
                        </div>

                        {form.tanggal && form.target_selesai && (
                          <div style={{ fontSize: 11, color: "#059669", marginBottom: 12, fontWeight: 700, background: "#ECFDF5", padding: "8px 12px", borderRadius: 8, border: "none", display: "flex", alignItems: "center", gap: 6 }}>
                            <Clock size={13} />
                            Estimasi Durasi Pengerjaan: {Math.ceil((new Date(form.target_selesai).getTime() - new Date(form.tanggal).getTime()) / (1000*60*60*24))} Hari Kerja
                          </div>
                        )}

                        <div style={{ marginBottom: 12 }}>
                          <label className="label" style={{ fontWeight: 700, fontSize: 11, marginBottom: 5, color: "#475569" }}>
                            Tukang Potong Penanggung Jawab <span style={{ color: "#EF4444" }}>*</span>
                          </label>
                          <select 
                            required 
                            className="form-control" 
                            style={{ padding: "8px 12px", fontSize: 12, borderRadius: 8, border: "1px solid #CBD5E1" }}
                            value={form.tukang_potong_id} 
                            onChange={e => setForm({...form, tukang_potong_id: e.target.value})}
                          >
                            <option value="">-- Pilih Tukang Potong --</option>
                            {tukangPotong.map(tp => (
                              <option key={tp.id} value={tp.id}>{tp.nama} (Kode: {tp.kode})</option>
                            ))}
                          </select>

                          {modalSelectedTukang && (
                            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#F8FAFC", border: "none", borderRadius: 8, padding: "8px 12px", marginTop: 6 }}>
                              <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#2563EB", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900 }}>
                                {modalSelectedTukang.kode || "TP"}
                              </div>
                              <div style={{ fontSize: 11, color: "#334155", display: "flex", alignItems: "center", gap: 8 }}>
                                <strong style={{ color: "#0F172A" }}>{modalSelectedTukang.nama}</strong>
                                <span style={{ color: "#64748B" }}>· Kode: <strong style={{ color: "#2563EB" }}>{modalSelectedTukang.kode}</strong></span>
                                <span style={{ fontSize: 9, background: "#DCFCE7", color: "#166534", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>Aktif Potong</span>
                              </div>
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="label" style={{ fontWeight: 700, fontSize: 11, marginBottom: 5, color: "#475569" }}>
                            Model Pola / Kategori Produk <span style={{ color: "#EF4444" }}>*</span>
                          </label>
                          <select 
                            required 
                            className="form-control" 
                            style={{ padding: "8px 12px", fontSize: 12, borderRadius: 8, border: "1px solid #CBD5E1" }}
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

                      {/* CARD 2: ALOKASI KAIN MENTAH & ROLL SELECTION */}
                      <div style={{ background: "white", padding: "20px 22px", borderRadius: 16, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.04)" }}>
                        <div style={{ fontSize: 12, fontWeight: 900, color: "#1E293B", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#0284C7" }}></span>
                            2. Alokasi Kain Mentah dari Gudang
                          </div>
                          <span style={{ fontSize: 10, background: "#E0F2FE", color: "#0284C7", padding: "2px 8px", borderRadius: 6, fontWeight: 700 }}>
                            Langkah 2/6
                          </span>
                        </div>

                        <div style={{ marginBottom: 12 }}>
                          <label className="label" style={{ fontWeight: 700, fontSize: 11, marginBottom: 5, color: "#475569" }}>
                            Pilih Kain Mentah <span style={{ color: "#EF4444" }}>*</span>
                          </label>
                          <select 
                            required 
                            className="form-control" 
                            style={{ padding: "8px 12px", fontSize: 12, borderRadius: 8, border: "1px solid #CBD5E1" }}
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

                        {/* ROLL SELECTION CHIPS & QUICK ACTIONS */}
                        {form.nama_barang && (
                          <div style={{ background: "#F8FAFC", padding: 12, borderRadius: 12, border: "none", marginBottom: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
                              <span style={{ fontSize: 11, fontWeight: 800, color: "#334155" }}>
                                Roll Kain Dipotong ({form.selectedRolls.length} Roll · {form.meter_kain}m):
                              </span>
                              <div style={{ display: "flex", gap: 6 }}>
                                <button
                                  type="button"
                                  onClick={handleSelectAllRolls}
                                  style={{ background: "#EFF6FF", border: "none", color: "#2563EB", padding: "4px 9px", borderRadius: 6, fontSize: 10, fontWeight: 800, cursor: "pointer" }}
                                >
                                  Pilih Semua
                                </button>
                                <button
                                  type="button"
                                  onClick={handleClearAllRolls}
                                  style={{ background: "#E2E8F0", border: "none", color: "#475569", padding: "4px 9px", borderRadius: 6, fontSize: 10, fontWeight: 800, cursor: "pointer" }}
                                >
                                  Kosongkan
                                </button>
                              </div>
                            </div>

                            {availableRolls.length > 0 ? (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 150, overflowY: "auto", padding: 2 }}>
                                {availableRolls.map((roll, i) => {
                                  const isSelected = form.selectedRolls.some(r => r.id === roll.id);
                                  const rollMeter = typeof roll === 'object' ? (roll.meter || 0) : (roll || 0);
                                  return (
                                    <button
                                      key={roll.id || i}
                                      type="button"
                                      onClick={() => handleRollToggle(roll)}
                                      style={{
                                        padding: "6px 10px",
                                        borderRadius: 8,
                                        border: "none",
                                        background: isSelected ? "#2563EB" : "#FFFFFF",
                                        color: isSelected ? "#FFFFFF" : "#475569",
                                        fontSize: 11,
                                        fontWeight: isSelected ? 800 : 600,
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 6,
                                        boxShadow: isSelected ? "0 2px 6px rgba(37,99,235,0.3)" : "0 1px 3px rgba(0,0,0,0.06)",
                                        transition: "all 0.15s"
                                      }}
                                      title={`ID Roll: ${roll.id || `Roll-${i+1}`}`}
                                    >
                                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: isSelected ? "#FFFFFF" : "#94A3B8" }}></span>
                                      Roll #{i + 1} · {rollMeter}m
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <div style={{ fontSize: 11, color: "#DC2626", fontStyle: "italic", padding: "4px 0" }}>
                                Perhatian: Tidak ada rincian roll terdaftar pada kain ini.
                              </div>
                            )}
                          </div>
                        )}

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          <div>
                            <label className="label" style={{ fontWeight: 700, fontSize: 11, marginBottom: 4, color: "#475569" }}>
                              Panjang Kain Terpakai (m)
                            </label>
                            <input 
                              required 
                              type="number" 
                              step="0.01" 
                              className="form-control" 
                              style={{ padding: "8px 12px", fontSize: 13, borderRadius: 8, fontWeight: 900, color: "#2563EB", border: "1px solid #CBD5E1" }} 
                              value={form.meter_kain || ""} 
                              onChange={e => setForm({...form, meter_kain: Number(e.target.value)})} 
                            />
                          </div>
                          <div>
                            <label className="label" style={{ fontWeight: 700, fontSize: 11, marginBottom: 4, color: "#475569" }}>
                              Estimasi Konsumsi (cm/pcs)
                            </label>
                            <input 
                              type="number" 
                              className="form-control" 
                              style={{ padding: "8px 12px", fontSize: 12, borderRadius: 8, border: "1px solid #CBD5E1" }} 
                              value={form.pemakaian_cm} 
                              onChange={e => setForm({...form, pemakaian_cm: e.target.value})} 
                              placeholder="Contoh: 120" 
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* KOLOM 2: SPESIFIKASI JAHITAN & AKSESORIS */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                      
                      {/* CARD 3: SPESIFIKASI TEKNIS JAHITAN & BENANG */}
                      <div style={{ background: "white", padding: "20px 22px", borderRadius: 16, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.04)" }}>
                        <div style={{ fontSize: 12, fontWeight: 900, color: "#1E293B", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#6366F1" }}></span>
                            3. Spesifikasi Teknis Jahitan & Benang
                          </div>
                          <span style={{ fontSize: 10, background: "#EEF2FF", color: "#6366F1", padding: "2px 8px", borderRadius: 6, fontWeight: 700 }}>
                            Langkah 3/6
                          </span>
                        </div>

                        {/* JENIS JAHITAN */}
                        <div style={{ marginBottom: 12 }}>
                          <label className="label" style={{ fontWeight: 700, fontSize: 11, marginBottom: 5, color: "#475569" }}>
                            Jenis Jahitan yang Digunakan
                          </label>
                          <input 
                            type="text" 
                            className="form-control" 
                            style={{ padding: "8px 12px", fontSize: 12, borderRadius: 8, marginBottom: 6, border: "1px solid #CBD5E1" }} 
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
                                  borderRadius: 6,
                                  border: "none",
                                  background: "#F1F5F9",
                                  cursor: "pointer",
                                  color: "#475569",
                                  fontWeight: 600
                                }}
                              >
                                + {j}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* TIPE BENANG */}
                        <div style={{ marginBottom: 12 }}>
                          <label className="label" style={{ fontWeight: 700, fontSize: 11, marginBottom: 5, color: "#475569" }}>
                            Type / Warna Benang
                          </label>
                          <input 
                            type="text" 
                            className="form-control" 
                            style={{ padding: "8px 12px", fontSize: 12, borderRadius: 8, marginBottom: 6, border: "1px solid #CBD5E1" }} 
                            value={form.tipe_benang} 
                            onChange={e => setForm({...form, tipe_benang: e.target.value})} 
                            placeholder="Contoh: Astra Jeans 20/2 - Kuning Emas (Gold) / Navy" 
                          />
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {benangPresets.map((b, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setForm({ ...form, tipe_benang: b })}
                                style={{
                                  fontSize: 10,
                                  padding: "3px 8px",
                                  borderRadius: 6,
                                  border: "none",
                                  background: "#F1F5F9",
                                  cursor: "pointer",
                                  color: "#475569",
                                  fontWeight: 600
                                }}
                              >
                                + {b.replace("Benang Astra ", "").replace(" (Gold Heavy)", "")}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* TIPE RESLETING */}
                        <div style={{ marginBottom: 12 }}>
                          <label className="label" style={{ fontWeight: 700, fontSize: 11, marginBottom: 5, color: "#475569" }}>
                            Type Resleting
                          </label>
                          <input 
                            type="text" 
                            className="form-control" 
                            style={{ padding: "8px 12px", fontSize: 12, borderRadius: 8, marginBottom: 6, border: "1px solid #CBD5E1" }} 
                            value={form.tipe_resleting} 
                            onChange={e => setForm({...form, tipe_resleting: e.target.value})} 
                            placeholder="Contoh: YKK Metal Brass Gigi Kuningan 5 Inci" 
                          />
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {resletingPresets.map((r, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setForm({ ...form, tipe_resleting: r })}
                                style={{
                                  fontSize: 10,
                                  padding: "3px 8px",
                                  borderRadius: 6,
                                  border: "none",
                                  background: "#F1F5F9",
                                  cursor: "pointer",
                                  color: "#475569",
                                  fontWeight: 600
                                }}
                              >
                                + {r.replace("Resleting ", "")}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* CATATAN JAHIT */}
                        <div>
                          <label className="label" style={{ fontWeight: 700, fontSize: 11, marginBottom: 5, color: "#475569" }}>
                            Catatan Khusus Penjahitan
                          </label>
                          <textarea 
                            className="form-control" 
                            rows={2} 
                            style={{ padding: "8px 12px", fontSize: 12, borderRadius: 8, border: "1px solid #CBD5E1" }} 
                            value={form.catatan_jahitan} 
                            onChange={e => setForm({...form, catatan_jahitan: e.target.value})} 
                            placeholder="Catatan untuk operator potong & CMT..."
                          />
                        </div>
                      </div>

                      {/* CARD 4: ALOKASI BAHAN PENDUKUNG & AKSESORIS */}
                      <div style={{ background: "white", padding: "20px 22px", borderRadius: 16, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.04)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                          <div style={{ fontSize: 12, fontWeight: 900, color: "#1E293B", textTransform: "uppercase", letterSpacing: 0.6, display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981" }}></span>
                            4. Bahan Pendukung (Surat Jalan Gudang)
                          </div>
                          <button
                            type="button"
                            onClick={handleAddItemPendukung}
                            className="btn btn-secondary"
                            style={{ fontSize: 11, padding: "4px 9px", borderRadius: 6, display: "flex", alignItems: "center", gap: 4, background: "#ECFDF5", color: "#059669", border: "none", fontWeight: 700 }}
                          >
                            <Plus size={12} /> Tambah Item
                          </button>
                        </div>

                        {form.item_pendukung_used.length > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {form.item_pendukung_used.map((it, idx) => (
                              <div key={idx} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 28px", gap: 6, alignItems: "center", background: "#F8FAFC", padding: "7px 10px", borderRadius: 8, border: "none" }}>
                                <select
                                  className="form-control"
                                  style={{ fontSize: 11, padding: "5px 6px", border: "1px solid #CBD5E1" }}
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
                                    style={{ fontSize: 11, padding: "5px 6px", width: "100%", border: "1px solid #CBD5E1" }}
                                    value={it.qty}
                                    onChange={e => handleItemPendukungChange(idx, "qty", e.target.value)}
                                  />
                                  <span style={{ fontSize: 10, color: "#64748B", minWidth: 26 }}>{it.satuan}</span>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleRemoveItemPendukung(idx)}
                                  style={{ background: "none", border: "none", color: "#DC2626", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                                >
                                  <X size={15} />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: 11, color: "#64748B", fontStyle: "italic", textAlign: "center", padding: "12px 0", background: "#F8FAFC", borderRadius: 8 }}>
                            Belum ada bahan pendukung yang ditambahkan.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* KOLOM 3: TARGET SIZE BREAKDOWN, SMART YIELD & BUNDLE MATRIX */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                      
                      {/* CARD 5: SIZE BREAKDOWN */}
                      <div style={{ background: "white", padding: "20px 22px", borderRadius: 16, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.04)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 6 }}>
                          <div style={{ fontSize: 12, fontWeight: 900, color: "#1E293B", textTransform: "uppercase", letterSpacing: 0.6, display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#F59E0B" }}></span>
                            5. Target Hasil Potong (Size Breakdown)
                          </div>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button
                              type="button"
                              onClick={() => applySizePreset("jeans")}
                              style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, border: "none", background: "#EFF6FF", cursor: "pointer", color: "#2563EB", fontWeight: 800 }}
                            >
                              Jeans 28-36
                            </button>
                            <button
                              type="button"
                              onClick={() => applySizePreset("standard")}
                              style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, border: "none", background: "#F1F5F9", cursor: "pointer", color: "#475569", fontWeight: 800 }}
                            >
                              S-XXL
                            </button>
                            <button
                              type="button"
                              onClick={() => applySizePreset("anak")}
                              style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, border: "none", background: "#ECFDF5", cursor: "pointer", color: "#059669", fontWeight: 800 }}
                            >
                              Anak 4-12
                            </button>
                          </div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10, maxHeight: 200, overflowY: "auto", paddingRight: 4 }}>
                          {form.sizeBreakdown.map((row, idx) => (
                            <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr 28px", gap: 6, alignItems: "center" }}>
                              <input
                                type="text"
                                className="form-control"
                                placeholder="Size"
                                style={{ padding: "6px 8px", fontSize: 12, fontWeight: 800, textAlign: "center", borderRadius: 6, border: "1px solid #CBD5E1" }}
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
                                  style={{ padding: "6px 8px", fontSize: 12, fontWeight: 800, borderRadius: 6, border: "1px solid #CBD5E1" }}
                                  value={row.jumlah}
                                  onChange={e => {
                                    const updated = [...form.sizeBreakdown];
                                    updated[idx].jumlah = e.target.value;
                                    setForm({ ...form, sizeBreakdown: updated });
                                  }}
                                />
                                <span style={{ fontSize: 11, color: "#64748B", minWidth: 24 }}>pcs</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = form.sizeBreakdown.filter((_, i) => i !== idx);
                                  setForm({ ...form, sizeBreakdown: updated });
                                }}
                                style={{ background: "none", border: "none", color: "#DC2626", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                              >
                                <X size={15} />
                              </button>
                            </div>
                          ))}
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 12 }}>
                          <button
                            type="button"
                            onClick={() => setForm({ ...form, sizeBreakdown: [...form.sizeBreakdown, { size: "", jumlah: "" }] })}
                            className="btn btn-secondary"
                            style={{ fontSize: 11, padding: "5px 10px", borderRadius: 6, display: "flex", alignItems: "center", gap: 4, border: "none", background: "#F1F5F9" }}
                          >
                            <Plus size={12} /> Tambah Baris
                          </button>

                          <div style={{ background: "#F1F5F9", padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 800, color: "#0F172A" }}>
                            Subtotal Rincian Ukuran: <span style={{ color: "#059669" }}>{totalPcs.toLocaleString("id-ID")} pcs</span>
                          </div>
                        </div>

                        {/* ISI PER BUNDLE */}
                        <div style={{ background: "#F8FAFC", padding: "10px 14px", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                          <label className="label" style={{ fontWeight: 700, fontSize: 11, color: "#475569", margin: 0 }}>
                            Isi Per Ikat / Bundle (Kodi):
                          </label>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <input
                              type="number"
                              className="form-control"
                              style={{ padding: "4px 8px", fontSize: 11, width: 70, textAlign: "center", borderRadius: 6, border: "1px solid #CBD5E1" }}
                              value={form.isi_per_bundle}
                              onChange={e => setForm({ ...form, isi_per_bundle: Number(e.target.value) || 20 })}
                              placeholder="20"
                            />
                            <span style={{ fontSize: 10, color: "#64748B" }}>pcs/ikat</span>
                          </div>
                        </div>
                      </div>

                      {/* CARD 6: ANALISIS EFISIENSI KAIN (SMART YIELD) & BUNDLE MATRIX */}
                      <div style={{ background: "white", padding: "20px 22px", borderRadius: 16, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.04)" }}>
                        <div style={{ fontSize: 12, fontWeight: 900, color: "#1E293B", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#8B5CF6" }}></span>
                            6. Analisis Efisiensi Kain & Bundle
                          </div>
                          <span style={{ fontSize: 10, background: "#F5F3FF", color: "#8B5CF6", padding: "2px 8px", borderRadius: 6, fontWeight: 700 }}>
                            Langkah 6/6
                          </span>
                        </div>

                        {/* SMART METRICS GRID (2x2) WITH CLEAR FORMULA EXPLANATIONS */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                          <div style={{ background: "#F8FAFC", padding: "10px 12px", borderRadius: 10 }}>
                            <div style={{ fontSize: 10, color: "#64748B", fontWeight: 600 }}>Konsumsi Aktual</div>
                            <div style={{ fontSize: 14, fontWeight: 900, color: "#0F172A", marginTop: 2 }}>
                              {modalKonsumsiAktualCm > 0 ? `${modalKonsumsiAktualCm.toFixed(1)} cm` : "-"}
                              <span style={{ fontSize: 10, fontWeight: 500, color: "#64748B", marginLeft: 4 }}>/ pcs</span>
                            </div>
                            <div style={{ fontSize: 9, color: "#94A3B8", marginTop: 2 }}>
                              Kain {modalMeterKain}m ÷ {totalPcs} pcs
                            </div>
                          </div>
                          
                          <div style={{ background: "#F8FAFC", padding: "10px 12px", borderRadius: 10 }}>
                            <div style={{ fontSize: 10, color: "#64748B", fontWeight: 600 }}>Target Pola Standar</div>
                            <div style={{ fontSize: 14, fontWeight: 900, color: "#2563EB", marginTop: 2 }}>
                              {modalEstimasiCm > 0 ? `${modalEstimasiCm} cm` : "-"}
                              <span style={{ fontSize: 10, fontWeight: 500, color: "#64748B", marginLeft: 4 }}>/ pcs</span>
                            </div>
                            <div style={{ fontSize: 9, color: "#94A3B8", marginTop: 2 }}>
                              Estimasi pola potong
                            </div>
                          </div>

                          <div style={{ background: "#F8FAFC", padding: "10px 12px", borderRadius: 10 }}>
                            <div style={{ fontSize: 10, color: "#64748B", fontWeight: 600 }}>Potensi Teoritis Kain</div>
                            <div style={{ fontSize: 14, fontWeight: 900, color: "#0F172A", marginTop: 2 }}>
                              {modalPotensiPcsTeoritis > 0 ? `${modalPotensiPcsTeoritis.toLocaleString("id-ID")} pcs` : "-"}
                            </div>
                            <div style={{ fontSize: 9, color: "#94A3B8", marginTop: 2 }}>
                              Kain {modalMeterKain}m ÷ {modalEstimasiCm || 120}cm
                            </div>
                          </div>

                          <div style={{ background: "#F8FAFC", padding: "10px 12px", borderRadius: 10 }}>
                            <div style={{ fontSize: 10, color: "#059669", fontWeight: 700 }}>Target Ukuran (Langkah 5)</div>
                            <div style={{ fontSize: 14, fontWeight: 900, color: "#059669", marginTop: 2 }}>
                              {totalPcs.toLocaleString("id-ID")} pcs
                              {modalPotensiPcsTeoritis > 0 && (
                                <span style={{ fontSize: 9, fontWeight: 700, color: modalSelisihOutput >= 0 ? "#059669" : "#D97706", marginLeft: 4 }}>
                                  ({modalSelisihOutput >= 0 ? `+${modalSelisihOutput}` : modalSelisihOutput})
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 9, color: "#059669", marginTop: 2, fontWeight: 600 }}>
                              Total rincian S s/d XXL
                            </div>
                          </div>
                        </div>

                        {/* HEALTH BADGE */}
                        <div style={{ background: efisiensiBg, borderRadius: 10, padding: "8px 12px", marginBottom: 10 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: efisiensiColor }}>
                              {efisiensiLabel}
                            </span>
                            {modalEstimasiCm > 0 && modalKonsumsiAktualCm > 0 && (
                              <span style={{ fontSize: 10, fontWeight: 700, color: efisiensiColor }}>
                                {modalRasioEfisiensi.toFixed(0)}% Efisiensi
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 10, color: "#475569", lineHeight: 1.4 }}>
                            {efisiensiDesc}
                          </div>
                        </div>

                        {/* BUNDLE / KODI BREAKDOWN MATRIX */}
                        <div style={{ background: "#F8FAFC", borderRadius: 10, padding: "10px 12px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                            <span style={{ fontSize: 10, fontWeight: 800, color: "#334155", textTransform: "uppercase" }}>
                              Rincian Ikat / Bendel (@{modalIsiPerBundle} pcs)
                            </span>
                            <span style={{ fontSize: 10, fontWeight: 800, color: "#2563EB" }}>
                              Total: {modalTotalBundle} Ikat {modalSisaBundlePcs > 0 ? `+ ${modalSisaBundlePcs} pcs` : ""}
                            </span>
                          </div>

                          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                            {form.sizeBreakdown.filter(s => Number(s.jumlah) > 0).map((s, idx) => {
                              const bCount = Math.floor(Number(s.jumlah) / modalIsiPerBundle);
                              const bSisa = Number(s.jumlah) % modalIsiPerBundle;
                              return (
                                <span key={idx} style={{ fontSize: 10, background: "white", borderRadius: 6, padding: "3px 8px", color: "#334155", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                                  <strong>{s.size}</strong>: {bCount} Ikat {bSisa > 0 ? `(+${bSisa})` : ""}
                                </span>
                              );
                            })}
                            {form.sizeBreakdown.filter(s => Number(s.jumlah) > 0).length === 0 && (
                              <span style={{ fontSize: 10, color: "#94A3B8", fontStyle: "italic" }}>
                                Masukkan jumlah pcs pada breakdown ukuran di atas.
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                </form>
              </div>

              {/* MODAL FOOTER */}
              <div style={{ padding: "14px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "white" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button 
                    type="button" 
                    onClick={() => setShowForm(false)} 
                    className="btn btn-secondary"
                    style={{ padding: "9px 18px", fontSize: 12, fontWeight: 700, border: "none", background: "#F1F5F9" }}
                  >
                    Batal
                  </button>
                  <div style={{ fontSize: 11, color: "#64748B" }}>
                    Status: <strong style={{ color: submitStatus === "Draft" ? "#D97706" : "#059669" }}>
                      {submitStatus === "Draft" ? "DRAFT (Belum Diterbitkan ke CMT)" : "SELESAI (Siap Terbitkan SPK Jahit)"}
                    </strong>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    type="submit"
                    form="form-pemotongan"
                    className="btn btn-secondary"
                    onClick={() => setSubmitStatus("Draft")}
                    style={{ padding: "9px 16px", fontSize: 12, fontWeight: 700, border: "none", background: "#F1F5F9" }}
                  >
                    Simpan Draft Saja
                  </button>
                  <button
                    type="submit"
                    form="form-pemotongan"
                    className="btn btn-primary"
                    onClick={() => setSubmitStatus("Selesai")}
                    style={{ padding: "9px 22px", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", gap: 8, background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)", boxShadow: "0 2px 8px rgba(37,99,235,0.3)", border: "none" }}
                  >
                    <Save size={15} /> Simpan Data Potongan & Terbitkan SPK
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
