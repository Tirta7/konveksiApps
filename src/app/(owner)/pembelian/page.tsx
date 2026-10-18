"use client";
import React, { useEffect, useState, useMemo, useRef } from "react";
import { 
  Package, 
  Trash2, 
  Edit, 
  X, 
  Plus, 
  Search, 
  DollarSign, 
  Layers, 
  CreditCard, 
  Truck, 
  Printer, 
  FileText, 
  ArrowUpRight, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Eye,
  SlidersHorizontal,
  ChevronRight,
  ShoppingBag,
  RotateCcw,
  Building2,
  Calendar,
  Phone,
  Check,
  ShoppingCart
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function PembelianPage() {
  const [data, setData] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [dataKainList, setDataKainList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "PO" | "Dikirim" | "Diterima">("all");
  const [filterPayment, setFilterPayment] = useState<"all" | "Cash" | "Tempo">("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "highest" | "most_meter">("newest");

  // Modals
  const [statusModal, setStatusModal] = useState<{ id: number; currentStatus: string; nextStatus: string; uid?: string } | null>(null);
  const [viewRolls, setViewRolls] = useState<{ itemName: string; rolls: any[] } | null>(null);
  const [selectedPoDetail, setSelectedPoDetail] = useState<any | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New PO Form state
  const [form, setForm] = useState<{
    tanggal: string;
    supplier_id: string;
    status: "PO" | "Dikirim" | "Diterima";
    metode_pembayaran: "Cash" | "Transfer" | "Tempo" | "Hutang";
    catatan: string;
    items: {
      nama_kain: string;
      warna: string;
      roll: number | "";
      meter: number | "";
      harga_meter: number | "";
      subtotal: number;
      roll_details_text: string;
    }[];
  }>({
    tanggal: new Date().toISOString().split("T")[0],
    supplier_id: "",
    status: "Diterima",
    metode_pembayaran: "Tempo",
    catatan: "",
    items: [
      {
        nama_kain: "",
        warna: "",
        roll: "",
        meter: "",
        harga_meter: "",
        subtotal: 0,
        roll_details_text: ""
      }
    ]
  });

  const fetchData = async () => {
    try {
      const [resPO, resSup, resKain] = await Promise.all([
        fetch("/api/pembelian").then(r => r.json()),
        fetch("/api/supplier").then(r => r.json()).catch(() => []),
        fetch("/api/kain").then(r => r.json()).catch(() => [])
      ]);
      setData(Array.isArray(resPO) ? resPO : []);
      setSuppliers(Array.isArray(resSup) ? resSup : []);
      setDataKainList(Array.isArray(resKain) ? resKain : []);
    } catch (e) {
      toast.error("Gagal mengambil data pembelian");
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

  // KPI Calculations
  const stats = useMemo(() => {
    const totalNilai = data.reduce((sum, d) => sum + (Number(d.total) || 0), 0);
    const totalMeter = data.reduce((sum, d) => {
      const m = (d.items || []).reduce((iSum: number, it: any) => iSum + (Number(it.meter) || 0), 0);
      return sum + m;
    }, 0);
    const totalRolls = data.reduce((sum, d) => {
      const r = (d.items || []).reduce((rSum: number, it: any) => {
        const rollCount = it.roll_details && it.roll_details.length > 0 ? it.roll_details.length : (Number(it.roll) || 0);
        return rSum + rollCount;
      }, 0);
      return sum + r;
    }, 0);
    const tempoItems = data.filter(d => d.metode_pembayaran === "Tempo" || d.metode_pembayaran === "Hutang");
    const totalTempo = tempoItems.reduce((sum, d) => sum + (Number(d.total) || 0), 0);
    const uniqueSuppliers = new Set(data.map(d => d.supplier_id)).size;

    return {
      totalNilai,
      totalMeter,
      totalRolls,
      totalTempo,
      tempoCount: tempoItems.length,
      supplierCount: uniqueSuppliers || suppliers.length
    };
  }, [data, suppliers]);

  // Filtered & Sorted POs
  const filteredData = useMemo(() => {
    return data.filter(item => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery = !q || (
        (item.uid || "").toLowerCase().includes(q) ||
        (item.supplier_nama || "").toLowerCase().includes(q) ||
        (item.tanggal || "").toLowerCase().includes(q) ||
        (item.catatan || "").toLowerCase().includes(q) ||
        (item.items || []).some((it: any) => 
          (it.nama_kain || "").toLowerCase().includes(q) || 
          (it.warna || "").toLowerCase().includes(q)
        )
      );

      const matchSupplier = filterSupplier === "all" || String(item.supplier_id) === String(filterSupplier);
      
      const matchStatus = filterStatus === "all" || item.status === filterStatus;

      let matchPayment = true;
      if (filterPayment === "Cash") {
        matchPayment = item.metode_pembayaran === "Cash" || item.metode_pembayaran === "Transfer";
      } else if (filterPayment === "Tempo") {
        matchPayment = item.metode_pembayaran === "Tempo" || item.metode_pembayaran === "Hutang";
      }

      return matchQuery && matchSupplier && matchStatus && matchPayment;
    }).sort((a, b) => {
      if (sortBy === "oldest") return new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime();
      if (sortBy === "highest") return (Number(b.total) || 0) - (Number(a.total) || 0);
      if (sortBy === "most_meter") {
        const mA = (a.items || []).reduce((sum: number, it: any) => sum + (Number(it.meter) || 0), 0);
        const mB = (b.items || []).reduce((sum: number, it: any) => sum + (Number(it.meter) || 0), 0);
        return mB - mA;
      }
      return new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime();
    });
  }, [data, searchQuery, filterSupplier, filterStatus, filterPayment, sortBy]);

  const hasActiveFilters = searchQuery !== "" || filterSupplier !== "all" || filterStatus !== "all" || filterPayment !== "all" || sortBy !== "newest";

  const resetFilters = () => {
    setSearchQuery("");
    setFilterSupplier("all");
    setFilterStatus("all");
    setFilterPayment("all");
    setSortBy("newest");
  };

  // Update Status Handler
  const submitUpdateStatus = async () => {
    if (!statusModal) return;
    const { id, currentStatus, nextStatus } = statusModal;
    
    if (nextStatus === currentStatus) {
      setStatusModal(null);
      return;
    }

    try {
      const res = await fetch("/api/pembelian", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: nextStatus })
      });
      if (res.ok) {
        toast.success(`Status PO ${statusModal.uid || ""} berhasil dirubah menjadi: ${nextStatus}`);
        setStatusModal(null);
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || "Gagal mengubah status");
      }
    } catch (e) {
      toast.error("Terjadi kesalahan sistem");
    }
  };

  // Delete Handler
  const handleDelete = async (id: number, uid?: string) => {
    if (!confirm(`Peringatan: Menghapus PO (${uid || `#${id}`}) ini akan membatalkan transaksi, menarik stok kain yang telah masuk gudang, dan membatalkan tagihan hutang terkait. Lanjutkan?`)) return;
    
    try {
      const res = await fetch(`/api/pembelian?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("PO berhasil dihapus & stok kain gudang disinkronkan");
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || "Gagal membatalkan PO");
      }
    } catch (e) {
      toast.error("Terjadi kesalahan sistem");
    }
  };

  // Add Item in New PO
  const handleAddItem = () => {
    setForm(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          nama_kain: "",
          warna: "",
          roll: "",
          meter: "",
          harga_meter: "",
          subtotal: 0,
          roll_details_text: ""
        }
      ]
    }));
  };

  const handleRemoveItem = (index: number) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setForm(prev => {
      const updated = [...prev.items];
      const cur = { ...updated[index], [field]: value };

      if (field === "meter" || field === "harga_meter") {
        const m = field === "meter" ? Number(value) || 0 : Number(cur.meter) || 0;
        const h = field === "harga_meter" ? Number(value) || 0 : Number(cur.harga_meter) || 0;
        cur.subtotal = m * h;
      }

      // Auto-fill warna & harga beli if choosing from existing kain
      if (field === "nama_kain") {
        const found = dataKainList.find(k => k.nama_kain === value);
        if (found) {
          if (found.warna && !cur.warna) cur.warna = found.warna;
          if (found.harga_beli && !cur.harga_meter) {
            cur.harga_meter = found.harga_beli;
            const m = Number(cur.meter) || 0;
            cur.subtotal = m * Number(found.harga_beli);
          }
        }
      }

      updated[index] = cur;
      return { ...prev, items: updated };
    });
  };

  const grandTotalNewPo = useMemo(() => {
    return form.items.reduce((sum, it) => sum + (Number(it.subtotal) || 0), 0);
  }, [form.items]);

  const handleSubmitNewPo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.supplier_id) return toast.error("Silakan pilih Supplier");
    if (form.items.length === 0) return toast.error("Minimal harus ada 1 item kain");
    
    for (let i = 0; i < form.items.length; i++) {
      const it = form.items[i];
      if (!it.nama_kain || !it.meter || !it.harga_meter) {
        return toast.error(`Item #${i + 1}: Nama kain, meter, dan harga/meter wajib diisi`);
      }
    }

    setIsSubmitting(true);
    try {
      // Process roll details
      const processedItems = form.items.map(it => {
        let details: number[] = [];
        if (it.roll_details_text && it.roll_details_text.trim()) {
          details = it.roll_details_text
            .split(/[,;\n]+/)
            .map(s => Number(s.trim()))
            .filter(n => !isNaN(n) && n > 0);
        } else if (it.roll && Number(it.roll) > 0 && it.meter) {
          // Auto split equally if not manually typed
          const count = Number(it.roll);
          const perRoll = Math.round((Number(it.meter) / count) * 10) / 10;
          for (let r = 0; r < count; r++) details.push(perRoll);
        }

        return {
          nama_kain: it.nama_kain,
          warna: it.warna || "Standard",
          roll: it.roll ? Number(it.roll) : (details.length || 1),
          meter: Number(it.meter),
          harga_meter: Number(it.harga_meter),
          subtotal: Number(it.subtotal),
          roll_details: details.map(String)
        };
      });

      const payload = {
        tanggal: form.tanggal,
        supplier_id: Number(form.supplier_id),
        status: form.status,
        metode_pembayaran: form.metode_pembayaran,
        catatan: form.catatan,
        items: processedItems
      };

      const res = await fetch("/api/pembelian", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toast.success("PO Pembelian Kain berhasil diterbitkan & disinkronkan!");
        setShowCreateModal(false);
        // Reset form
        setForm({
          tanggal: new Date().toISOString().split("T")[0],
          supplier_id: "",
          status: "Diterima",
          metode_pembayaran: "Tempo",
          catatan: "",
          items: [{ nama_kain: "", warna: "", roll: "", meter: "", harga_meter: "", subtotal: 0, roll_details_text: "" }]
        });
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || "Gagal menerbitkan PO");
      }
    } catch (e) {
      toast.error("Terjadi kesalahan sistem saat membuat PO");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ padding: "28px 32px 48px 32px", background: "#F1F5F9", minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .po-card-hover { transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
        .po-card-hover:hover { transform: translateY(-3px); box-shadow: 0 10px 24px rgba(0,0,0,0.08) !important; }
        @media print {
          body * { visibility: hidden !important; }
          .print-modal-area, .print-modal-area * { visibility: visible !important; }
          .print-modal-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
          }
          .no-print { display: none !important; }
        }
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
                <ShoppingCart size={20} color="#FFFFFF" />
              </div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#0F172A", letterSpacing: "-0.02em" }}>
                Riwayat Pembelian & PO Kain Supplier
              </h1>
              <span style={{ fontSize: 11, fontWeight: 800, background: "rgba(37,99,235,0.1)", color: "#2563EB", padding: "4px 10px", borderRadius: 20 }}>
                Procurement & Inbound
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "#64748B" }}>
              Kelola pesanan bahan baku kain denim ke supplier, pantau status pengiriman, inspeksi rincian roll, dan penerimaan stok gudang.
            </p>
          </div>

          {/* QUICK NAVIGATION & ACTIONS */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Link 
              href="/supplier" 
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
              <Truck size={14} color="#64748B" /> Data Supplier
            </Link>
            <Link 
              href="/data-kain" 
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
              <Layers size={14} color="#64748B" /> Stok Kain Gudang
            </Link>
            <Link 
              href="/hutang" 
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
              <CreditCard size={14} color="#64748B" /> Buku Hutang
            </Link>
            <button
              onClick={() => setShowCreateModal(true)}
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
              <Plus size={16} /> Buat Pembelian PO Baru
            </button>
          </div>
        </div>

        {/* 4 KPI SUMMARY CARDS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          {/* Card 1: Total Nilai Pembelian */}
          <div className="po-card-hover" style={{ background: "#FFFFFF", borderRadius: 14, padding: "16px 20px", border: "1px solid #E2E8F0", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>Total Nilai Pembelian</span>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ShoppingBag size={15} color="#2563EB" />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", letterSpacing: "-0.02em" }}>
              Rp {stats.totalNilai.toLocaleString("id-ID")}
            </div>
            <div style={{ fontSize: 11, color: "#2563EB", fontWeight: 700, marginTop: 4 }}>
              {data.length} Transaksi PO Pembelian
            </div>
          </div>

          {/* Card 2: Total Kain Dipesan */}
          <div className="po-card-hover" style={{ background: "#FFFFFF", borderRadius: 14, padding: "16px 20px", border: "1px solid #E2E8F0", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>Total Kain Dipesan</span>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "#ECFDF5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Layers size={15} color="#059669" />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#065F46", letterSpacing: "-0.02em" }}>
              {stats.totalMeter.toLocaleString("id-ID", { maximumFractionDigits: 1 })} <span style={{ fontSize: 13, fontWeight: 600, color: "#64748B" }}>meter</span>
            </div>
            <div style={{ fontSize: 11, color: "#059669", fontWeight: 700, marginTop: 4 }}>
              Total {stats.totalRolls} Roll kain masuk gudang
            </div>
          </div>

          {/* Card 3: Pembelian Tempo / Hutang */}
          <div className="po-card-hover" style={{ background: "#FFFFFF", borderRadius: 14, padding: "16px 20px", border: "1px solid #E2E8F0", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>Pembelian Tempo / Hutang</span>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: stats.totalTempo > 0 ? "#FEF2F2" : "#ECFDF5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CreditCard size={15} color={stats.totalTempo > 0 ? "#DC2626" : "#059669"} />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: stats.totalTempo > 0 ? "#DC2626" : "#059669", letterSpacing: "-0.02em" }}>
              Rp {stats.totalTempo.toLocaleString("id-ID")}
            </div>
            <div style={{ fontSize: 11, color: stats.totalTempo > 0 ? "#DC2626" : "#059669", fontWeight: 700, marginTop: 4 }}>
              {stats.tempoCount > 0 ? `${stats.tempoCount} transaksi dalam tagihan tempo` : "Semua PO Lunas Tunai"}
            </div>
          </div>

          {/* Card 4: Supplier Mitra */}
          <div className="po-card-hover" style={{ background: "#FFFFFF", borderRadius: 14, padding: "16px 20px", border: "1px solid #E2E8F0", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>Supplier Mitra Aktif</span>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "#FFFBEB", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Building2 size={15} color="#D97706" />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#B45309", letterSpacing: "-0.02em" }}>
              {stats.supplierCount} <span style={{ fontSize: 13, fontWeight: 600, color: "#64748B" }}>Supplier</span>
            </div>
            <div style={{ fontSize: 11, color: "#D97706", fontWeight: 700, marginTop: 4 }}>
              Mitra pemasok bahan baku denim
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
              placeholder="Cari No PO (POK-...), supplier, jenis kain, warna..."
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
            
            {/* SUPPLIER SELECT */}
            <select
              value={filterSupplier}
              onChange={(e) => setFilterSupplier(e.target.value)}
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
              <option value="all">Semua Supplier</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.nama_supplier}</option>
              ))}
            </select>

            {/* STATUS PENGIRIMAN PILLS */}
            <div style={{ display: "flex", background: "#F1F5F9", padding: 3, borderRadius: 10, gap: 2 }}>
              <button
                onClick={() => setFilterStatus("all")}
                style={{
                  padding: "6px 12px",
                  fontSize: 12,
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  fontWeight: filterStatus === "all" ? 800 : 600,
                  background: filterStatus === "all" ? "#FFFFFF" : "transparent",
                  color: filterStatus === "all" ? "#2563EB" : "#64748B",
                  boxShadow: filterStatus === "all" ? "0 1px 3px rgba(0,0,0,0.08)" : "none"
                }}
              >
                Semua ({data.length})
              </button>
              <button
                onClick={() => setFilterStatus("Diterima")}
                style={{
                  padding: "6px 12px",
                  fontSize: 12,
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  fontWeight: filterStatus === "Diterima" ? 800 : 600,
                  background: filterStatus === "Diterima" ? "#FFFFFF" : "transparent",
                  color: filterStatus === "Diterima" ? "#059669" : "#64748B",
                  boxShadow: filterStatus === "Diterima" ? "0 1px 3px rgba(0,0,0,0.08)" : "none"
                }}
              >
                Diterima
              </button>
              <button
                onClick={() => setFilterStatus("Dikirim")}
                style={{
                  padding: "6px 12px",
                  fontSize: 12,
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  fontWeight: filterStatus === "Dikirim" ? 800 : 600,
                  background: filterStatus === "Dikirim" ? "#FFFFFF" : "transparent",
                  color: filterStatus === "Dikirim" ? "#2563EB" : "#64748B",
                  boxShadow: filterStatus === "Dikirim" ? "0 1px 3px rgba(0,0,0,0.08)" : "none"
                }}
              >
                Dikirim
              </button>
              <button
                onClick={() => setFilterStatus("PO")}
                style={{
                  padding: "6px 12px",
                  fontSize: 12,
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  fontWeight: filterStatus === "PO" ? 800 : 600,
                  background: filterStatus === "PO" ? "#FFFFFF" : "transparent",
                  color: filterStatus === "PO" ? "#D97706" : "#64748B",
                  boxShadow: filterStatus === "PO" ? "0 1px 3px rgba(0,0,0,0.08)" : "none"
                }}
              >
                PO
              </button>
            </div>

            {/* PEMBAYARAN SELECT */}
            <select
              value={filterPayment}
              onChange={(e: any) => setFilterPayment(e.target.value)}
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
              <option value="all">Semua Pembayaran</option>
              <option value="Cash">Cash / Transfer</option>
              <option value="Tempo">Tempo / Hutang</option>
            </select>

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
              <option value="newest">Terbaru (Tanggal)</option>
              <option value="oldest">Terlama</option>
              <option value="highest">Nilai Terbesar (Rp)</option>
              <option value="most_meter">Meter Terbanyak</option>
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

      {/* TABLE DAFTAR PEMBELIAN PO KAIN */}
      <div style={{ background: "#FFFFFF", borderRadius: 14, border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1.5px solid #E2E8F0" }}>
                <th style={{ padding: "12px 18px", fontSize: 11, fontWeight: 800, color: "#64748B", letterSpacing: "0.05em", textTransform: "uppercase" }}>TANGGAL / PO</th>
                <th style={{ padding: "12px 18px", fontSize: 11, fontWeight: 800, color: "#64748B", letterSpacing: "0.05em", textTransform: "uppercase" }}>SUPPLIER</th>
                <th style={{ padding: "12px 18px", fontSize: 11, fontWeight: 800, color: "#64748B", letterSpacing: "0.05em", textTransform: "uppercase" }}>ITEMS (KAIN & ROLL)</th>
                <th style={{ padding: "12px 18px", fontSize: 11, fontWeight: 800, color: "#64748B", letterSpacing: "0.05em", textTransform: "uppercase", textAlign: "right" }}>TOTAL NILAI (RP)</th>
                <th style={{ padding: "12px 18px", fontSize: 11, fontWeight: 800, color: "#64748B", letterSpacing: "0.05em", textTransform: "uppercase", textAlign: "center" }}>PEMBAYARAN</th>
                <th style={{ padding: "12px 18px", fontSize: 11, fontWeight: 800, color: "#64748B", letterSpacing: "0.05em", textTransform: "uppercase", textAlign: "center" }}>STATUS PENGIRIMAN</th>
                <th style={{ padding: "12px 18px", fontSize: 11, fontWeight: 800, color: "#64748B", letterSpacing: "0.05em", textTransform: "uppercase", textAlign: "right", minWidth: 150 }}>AKSI</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: 48, textAlign: "center", color: "#64748B" }}>
                    <div style={{ display: "inline-block", width: 24, height: 24, border: "3px solid #E2E8F0", borderTopColor: "#2563EB", borderRadius: "50%", animation: "spin 0.8s linear infinite", marginBottom: 8 }} />
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Memuat riwayat pembelian PO...</div>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 48, textAlign: "center", color: "#64748B" }}>
                    <ShoppingBag size={32} color="#CBD5E1" style={{ margin: "0 auto 8px" }} />
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>Tidak ada data pembelian PO</div>
                    <div style={{ fontSize: 12.5, color: "#94A3B8", marginTop: 2 }}>
                      {searchQuery || filterSupplier !== "all" || filterStatus !== "all" || filterPayment !== "all" 
                        ? "Coba ubah kata kunci atau reset filter pencarian Anda."
                        : "Klik tombol '+ Buat Pembelian PO Baru' di atas untuk mencatat PO kain pertama."}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredData.map((item) => {
                  const sup = suppliers.find(s => String(s.id) === String(item.supplier_id) || s.nama_supplier === item.supplier_nama);
                  return (
                    <tr 
                      key={item.id} 
                      style={{ borderBottom: "1px solid #E2E8F0", transition: "background 0.15s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      {/* TANGGAL & NO PO */}
                      <td style={{ padding: "14px 18px", verticalAlign: "top" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
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
                            {item.uid || `POK-${String(item.id).padStart(4, '0')}`}
                          </span>
                        </div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: "#334155" }}>
                          {item.tanggal}
                        </div>
                        {item.catatan && (
                          <div style={{ fontSize: 11, color: "#64748B", marginTop: 4, maxWidth: 220, lineHeight: 1.3 }}>
                            {item.catatan}
                          </div>
                        )}
                      </td>

                      {/* SUPPLIER */}
                      <td style={{ padding: "14px 18px", verticalAlign: "top" }}>
                        <div style={{ fontWeight: 800, fontSize: 14, color: "#0F172A" }}>
                          {item.supplier_nama || "Supplier Umum"}
                        </div>
                        {sup?.kontak && (
                          <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                            <Phone size={11} color="#94A3B8" /> {sup.kontak}
                          </div>
                        )}
                        <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>
                          ID: #{item.supplier_id}
                        </div>
                      </td>

                      {/* ITEMS KAIN */}
                      <td style={{ padding: "14px 18px", verticalAlign: "top" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {(item.items || []).map((i: any, n: number) => {
                            const rollCount = i.roll_details && i.roll_details.length > 0 ? i.roll_details.length : (i.roll || 0);
                            return (
                              <div key={n} style={{ fontSize: 12.5, color: "#0F172A", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#2563EB", flexShrink: 0 }} />
                                <strong>{i.nama_kain}</strong>
                                <span style={{ color: "#64748B", fontSize: 11.5 }}>({i.warna || "Standard"})</span>
                                <span style={{ color: "#94A3B8" }}>&bull;</span>
                                <span style={{ fontWeight: 800, color: "#2563EB" }}>
                                  {Number(i.meter).toLocaleString("id-ID")}m
                                </span>
                                {i.roll_details && i.roll_details.length > 0 ? (
                                  <button 
                                    onClick={() => setViewRolls({ itemName: `${i.nama_kain} (${i.warna || "Standard"})`, rolls: i.roll_details })}
                                    style={{ 
                                      background: "#EFF6FF", 
                                      color: "#2563EB", 
                                      border: "1px solid #BFDBFE", 
                                      padding: "2px 8px", 
                                      borderRadius: 6, 
                                      cursor: "pointer", 
                                      fontSize: 11, 
                                      fontWeight: 800,
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 4
                                    }}
                                    title="Lihat rincian panjang tiap roll"
                                  >
                                    <Package size={11} /> Lihat Roll ({rollCount})
                                  </button>
                                ) : (
                                  <span style={{ fontSize: 11, color: "#64748B", background: "#F1F5F9", padding: "1px 6px", borderRadius: 4 }}>
                                    {rollCount} Roll
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </td>

                      {/* TOTAL NILAI */}
                      <td style={{ padding: "14px 18px", textAlign: "right", verticalAlign: "top" }}>
                        <div style={{ fontSize: 15, fontWeight: 900, color: "#0F172A", letterSpacing: "-0.01em" }}>
                          Rp {(item.total || 0).toLocaleString("id-ID")}
                        </div>
                        {item.items && item.items.length === 1 && item.items[0].harga_meter && (
                          <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                            @ Rp {Number(item.items[0].harga_meter).toLocaleString("id-ID")}/m
                          </div>
                        )}
                      </td>

                      {/* PEMBAYARAN */}
                      <td style={{ padding: "14px 18px", textAlign: "center", verticalAlign: "top" }}>
                        <span style={{ 
                          background: item.metode_pembayaran === "Tempo" || item.metode_pembayaran === "Hutang" ? "#FEF2F2" : "#ECFDF5", 
                          color: item.metode_pembayaran === "Tempo" || item.metode_pembayaran === "Hutang" ? "#DC2626" : "#059669", 
                          border: item.metode_pembayaran === "Tempo" || item.metode_pembayaran === "Hutang" ? "1px solid #FECACA" : "1px solid #A7F3D0",
                          padding: "4px 10px", 
                          borderRadius: 8, 
                          fontSize: 11.5, 
                          fontWeight: 800,
                          display: "inline-block"
                        }}>
                          {item.metode_pembayaran}
                        </span>
                      </td>

                      {/* STATUS PENGIRIMAN */}
                      <td style={{ padding: "14px 18px", textAlign: "center", verticalAlign: "top" }}>
                        <button 
                          onClick={() => setStatusModal({ id: item.id, currentStatus: item.status, nextStatus: item.status, uid: item.uid })}
                          style={{ 
                            background: item.status === "Diterima" ? "#ECFDF5" : item.status === "Dikirim" ? "#EFF6FF" : "#FFFBEB", 
                            color: item.status === "Diterima" ? "#065F46" : item.status === "Dikirim" ? "#1E40AF" : "#92400E", 
                            border: item.status === "Diterima" ? "1px solid #A7F3D0" : item.status === "Dikirim" ? "1px solid #BFDBFE" : "1px solid #FDE68A",
                            padding: "5px 12px", 
                            borderRadius: 20, 
                            fontSize: 11.5, 
                            fontWeight: 800,
                            cursor: "pointer", 
                            display: "inline-flex", 
                            alignItems: "center", 
                            gap: 5,
                            boxShadow: "0 1px 2px rgba(0,0,0,0.03)"
                          }}
                          title="Klik untuk mengubah status pengiriman"
                        >
                          {item.status === "Diterima" && <CheckCircle2 size={13} color="#059669" />}
                          {item.status === "Dikirim" && <Truck size={13} color="#2563EB" />}
                          {item.status === "PO" && <Clock size={13} color="#D97706" />}
                          <span>{item.status}</span>
                          <Edit size={11} style={{ opacity: 0.6 }} />
                        </button>
                      </td>

                      {/* AKSI */}
                      <td style={{ padding: "14px 18px", textAlign: "right", verticalAlign: "top" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
                          <button 
                            onClick={() => setSelectedPoDetail(item)}
                            style={{ 
                              padding: "6px 12px", 
                              fontSize: 12, 
                              display: "inline-flex", 
                              alignItems: "center", 
                              gap: 5, 
                              fontWeight: 700,
                              borderRadius: 8,
                              border: "1px solid #CBD5E1",
                              background: "#FFFFFF",
                              color: "#334155",
                              cursor: "pointer"
                            }}
                            title="Lihat Faktur PO & Cetak"
                          >
                            <FileText size={13} color="#2563EB" /> Detail
                          </button>

                          <button 
                            onClick={() => handleDelete(item.id, item.uid)} 
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
                            title="Hapus / Batalkan PO"
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

      {/* MODAL UPDATE STATUS */}
      {statusModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div style={{ background: "white", width: "100%", maxWidth: 440, borderRadius: 16, overflow: "hidden", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}>
            <div style={{ padding: "18px 24px", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563EB" }}>
                  <Edit size={16} />
                </div>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 900, color: "#0F172A", margin: 0 }}>
                    Ubah Status Pengiriman
                  </h3>
                  <div style={{ fontSize: 12, color: "#64748B" }}>PO: {statusModal.uid || `#${statusModal.id}`}</div>
                </div>
              </div>
              <button onClick={() => setStatusModal(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B" }}>
                <X size={18} />
              </button>
            </div>
            
            <div style={{ padding: 24 }}>
              <label style={{ display: "block", fontWeight: 700, fontSize: 12.5, color: "#334155", marginBottom: 8 }}>
                Pilih Status Baru
              </label>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { value: "PO", label: "PO (Baru Dipesan ke Supplier)", desc: "Pesanan baru dikirim ke pabrik, barang belum dalam perjalanan." },
                  { value: "Dikirim", label: "Dalam Pengiriman (On The Way)", desc: "Barang sedang dikirim via ekspedisi / armada truk supplier." },
                  { value: "Diterima", label: "Diterima (Masuk Stok Gudang)", desc: "Kain sudah tiba dan diinspeksi. Stok meter & roll otomatis masuk gudang." }
                ].map(opt => (
                  <label 
                    key={opt.value}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      padding: "12px 14px",
                      borderRadius: 10,
                      border: statusModal.nextStatus === opt.value ? "2px solid #2563EB" : "1px solid #E2E8F0",
                      background: statusModal.nextStatus === opt.value ? "#EFF6FF" : "#FFFFFF",
                      cursor: "pointer",
                      transition: "all 0.15s"
                    }}
                  >
                    <input 
                      type="radio" 
                      name="status"
                      value={opt.value}
                      checked={statusModal.nextStatus === opt.value}
                      onChange={e => setStatusModal({ ...statusModal, nextStatus: e.target.value })}
                      style={{ marginTop: 3 }}
                    />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>{opt.label}</div>
                      <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 2 }}>{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>

              <div style={{ marginTop: 24, display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button 
                  onClick={() => setStatusModal(null)}
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
                  onClick={submitUpdateStatus}
                  style={{
                    padding: "9px 20px",
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
                  Simpan Status
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETAIL NOTA PO / FAKTUR PEMBELIAN (PRINTABLE) */}
      {selectedPoDetail && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div className="print-modal-area" style={{ background: "white", width: "100%", maxWidth: 720, borderRadius: 18, overflow: "hidden", boxShadow: "0 25px 60px rgba(0,0,0,0.3)", display: "flex", flexDirection: "column", maxHeight: "92vh" }}>
            
            {/* MODAL HEADER */}
            <div className="no-print" style={{ padding: "18px 24px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#F8FAFC" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563EB" }}>
                  <FileText size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: "#0F172A" }}>
                    Faktur Dokumen Pembelian ({selectedPoDetail.uid})
                  </h3>
                  <div style={{ fontSize: 12, color: "#64748B" }}>Tgl Order: {selectedPoDetail.tanggal}</div>
                </div>
              </div>
              <button onClick={() => setSelectedPoDetail(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B" }}>
                <X size={18} />
              </button>
            </div>

            {/* PRINTABLE INVOICE CONTENT */}
            <div style={{ padding: "28px 32px", overflowY: "auto", flex: 1 }}>
              {/* COMPANY LETTERHEAD */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #0F172A", paddingBottom: 16, marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: "#0F172A", letterSpacing: "-0.02em" }}>
                    TIRTA BINTANG JEANS
                  </div>
                  <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>
                    Spesialis Produksi Denim, Jeans Celana & Jaket
                  </div>
                  <div style={{ fontSize: 11.5, color: "#64748B" }}>
                    Bandung, Jawa Barat &bull; Telp / WA: 0812-3456-7890
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: 12, fontWeight: 900, background: "#0F172A", color: "#FFFFFF", padding: "4px 10px", borderRadius: 6, letterSpacing: "0.05em" }}>
                    PURCHASE ORDER (PO)
                  </span>
                  <div style={{ fontSize: 14, fontWeight: 900, fontFamily: "monospace", color: "#2563EB", marginTop: 6 }}>
                    {selectedPoDetail.uid}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748B" }}>
                    Tanggal: {selectedPoDetail.tanggal}
                  </div>
                </div>
              </div>

              {/* SUPPLIER & ORDER META */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, background: "#F8FAFC", padding: "14px 18px", borderRadius: 10, border: "1px solid #E2E8F0", marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>KEPADA SUPPLIER:</div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: "#0F172A", marginTop: 3 }}>{selectedPoDetail.supplier_nama}</div>
                  <div style={{ fontSize: 12, color: "#475569" }}>ID Supplier: #{selectedPoDetail.supplier_id}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>SYARAT & KETENTUAN:</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                    <span style={{ padding: "3px 8px", background: "#EFF6FF", color: "#2563EB", borderRadius: 6, fontSize: 11.5, fontWeight: 800 }}>
                      Pembayaran: {selectedPoDetail.metode_pembayaran}
                    </span>
                    <span style={{ padding: "3px 8px", background: selectedPoDetail.status === "Diterima" ? "#ECFDF5" : "#FEF3C7", color: selectedPoDetail.status === "Diterima" ? "#059669" : "#D97706", borderRadius: 6, fontSize: 11.5, fontWeight: 800 }}>
                      Status: {selectedPoDetail.status}
                    </span>
                  </div>
                  {selectedPoDetail.catatan && (
                    <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 6 }}>
                      <strong>Catatan:</strong> {selectedPoDetail.catatan}
                    </div>
                  )}
                </div>
              </div>

              {/* ITEMS TABLE */}
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, marginBottom: 20 }}>
                <thead>
                  <tr style={{ background: "#F1F5F9", borderBottom: "1.5px solid #CBD5E1", textAlign: "left" }}>
                    <th style={{ padding: "10px 12px" }}>No</th>
                    <th style={{ padding: "10px 12px" }}>Jenis Bahan Baku & Warna</th>
                    <th style={{ padding: "10px 12px", textAlign: "center" }}>Roll</th>
                    <th style={{ padding: "10px 12px", textAlign: "right" }}>Total Meter</th>
                    <th style={{ padding: "10px 12px", textAlign: "right" }}>Harga / Meter</th>
                    <th style={{ padding: "10px 12px", textAlign: "right" }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedPoDetail.items || []).map((it: any, i: number) => {
                    const rollCount = it.roll_details && it.roll_details.length > 0 ? it.roll_details.length : (it.roll || 0);
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid #E2E8F0" }}>
                        <td style={{ padding: "10px 12px" }}>{i + 1}</td>
                        <td style={{ padding: "10px 12px", fontWeight: 700, color: "#0F172A" }}>
                          {it.nama_kain} <span style={{ color: "#64748B", fontWeight: 500 }}>({it.warna || "Standard"})</span>
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "center" }}>
                          {rollCount} Roll
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 800, color: "#2563EB" }}>
                          {Number(it.meter).toLocaleString("id-ID")} m
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right" }}>
                          Rp {Number(it.harga_meter).toLocaleString("id-ID")}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 800, color: "#0F172A" }}>
                          Rp {Number(it.subtotal).toLocaleString("id-ID")}
                        </td>
                      </tr>
                    );
                  })}
                  <tr style={{ background: "#F8FAFC", fontWeight: 900, fontSize: 13, borderTop: "2px solid #0F172A" }}>
                    <td colSpan={5} style={{ padding: "12px", textAlign: "right" }}>GRAND TOTAL PEMBELIAN:</td>
                    <td style={{ padding: "12px", textAlign: "right", color: "#0F172A", fontSize: 15 }}>
                      Rp {Number(selectedPoDetail.total).toLocaleString("id-ID")}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* SIGNATURE SECTIONS */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginTop: 36, textAlign: "center" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>Disiapkan Oleh (Purchasing)</div>
                  <div style={{ height: 60 }} />
                  <div style={{ fontSize: 12, fontWeight: 800, borderTop: "1px solid #94A3B8", paddingTop: 4 }}>
                    ( Bagian Pengadaan )
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>Diterima Gudang (Logistik)</div>
                  <div style={{ height: 60 }} />
                  <div style={{ fontSize: 12, fontWeight: 800, borderTop: "1px solid #94A3B8", paddingTop: 4 }}>
                    ( Kepala Gudang Kain )
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>Disetujui Oleh (Owner)</div>
                  <div style={{ height: 60 }} />
                  <div style={{ fontSize: 12, fontWeight: 800, borderTop: "1px solid #94A3B8", paddingTop: 4 }}>
                    ( Tirta Aditya )
                  </div>
                </div>
              </div>
            </div>

            {/* MODAL FOOTER */}
            <div className="no-print" style={{ padding: "16px 24px", borderTop: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#F8FAFC" }}>
              <button 
                onClick={() => setSelectedPoDetail(null)}
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
                onClick={() => window.print()}
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
                  gap: 6,
                  boxShadow: "0 2px 8px rgba(37,99,235,0.25)"
                }}
              >
                <Printer size={15} /> Cetak Faktur PO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL LIHAT DETAIL ROLL */}
      {viewRolls && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 20 }}>
          <div style={{ background: "white", width: "100%", maxWidth: 640, borderRadius: 20, overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,0.25)", display: "flex", flexDirection: "column", maxHeight: "90vh" }}>
            <div style={{ padding: "18px 24px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0F172A" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Package size={18} color="#38BDF8" />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 900, color: "white", margin: 0 }}>Rincian Roll Kain Mentah</h3>
                  <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>{viewRolls.itemName}</div>
                </div>
              </div>
              <button onClick={() => setViewRolls(null)} style={{ background: "rgba(255,255,255,0.1)", border: "none", width: 30, height: 30, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
                <X size={15} />
              </button>
            </div>
            
            <div style={{ padding: 24, overflowY: "auto", background: "#F8FAFC" }}>
              {(!viewRolls.rolls || viewRolls.rolls.length === 0) ? (
                <div style={{ textAlign: "center", color: "#64748B", padding: "30px 20px" }}>
                  <Package size={30} color="#CBD5E1" style={{ margin: "0 auto 10px" }} />
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Tidak ada rincian roll spesifik</div>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, background: "white", padding: "12px 18px", borderRadius: 10, border: "1px solid #E2E8F0" }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
                      <span style={{ color: "#64748B" }}>Total Roll:</span>
                      <strong style={{ color: "#0F172A" }}>{viewRolls.rolls.length} Roll</strong>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
                      <span style={{ color: "#64748B" }}>Total Meter:</span>
                      <strong style={{ color: "#059669" }}>
                        {viewRolls.rolls.reduce((sum, r) => sum + Number(typeof r === 'object' ? (r.meter || 0) : (r || 0)), 0).toLocaleString("id-ID")} m
                      </strong>
                    </div>
                  </div>
                  
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 10 }}>
                    {viewRolls.rolls.map((r: any, i: number) => {
                      const meter = typeof r === 'object' ? (r.meter || 0) : (r || 0);
                      return (
                        <div key={i} style={{ 
                          background: "white", 
                          borderRadius: 10, 
                          textAlign: "center", 
                          border: "1px solid #E2E8F0",
                          overflow: "hidden",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
                        }}>
                          <div style={{ background: "#F1F5F9", padding: "4px 0", fontSize: 10.5, color: "#64748B", fontWeight: 800 }}>
                            ROLL #{i+1}
                          </div>
                          <div style={{ padding: "10px 8px" }}>
                            <div style={{ fontSize: 16, fontWeight: 900, color: "#0F172A", lineHeight: 1 }}>
                              {meter} <span style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8" }}>m</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL BUAT PEMBELIAN PO BARU */}
      {showCreateModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.7)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 20 }}>
          <div style={{ background: "white", width: "95vw", maxWidth: 960, borderRadius: 20, overflow: "hidden", boxShadow: "0 25px 80px rgba(0,0,0,0.35)", display: "flex", flexDirection: "column", maxHeight: "92vh" }}>
            
            {/* MODAL HEADER */}
            <div style={{ padding: "20px 28px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(135deg, #F8FAFC, #EFF6FF)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: 10, background: "#DBEAFE", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563EB" }}>
                  <ShoppingCart size={22} />
                </div>
                <div>
                  <h2 style={{ color: "#0F172A", margin: 0, fontSize: 18, fontWeight: 900 }}>
                    Form Buat Pembelian PO Kain Baru
                  </h2>
                  <div style={{ fontSize: 12.5, color: "#64748B", marginTop: 2 }}>
                    Pemesanan bahan baku kain denim ke supplier mitra & otomatis masuk stok gudang.
                  </div>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowCreateModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* MODAL BODY */}
            <div style={{ padding: "24px 28px", overflowY: "auto", flex: 1 }}>
              <form id="form-new-po" onSubmit={handleSubmitNewPo}>
                
                {/* SUPPLIER & ORDER META */}
                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr", gap: 14, marginBottom: 20, background: "#F8FAFC", padding: "16px 18px", borderRadius: 12, border: "1px solid #E2E8F0" }}>
                  <div>
                    <label style={{ display: "block", fontWeight: 700, fontSize: 12, color: "#334155", marginBottom: 4 }}>
                      Pilih Supplier Mitra <span style={{ color: "#EF4444" }}>*</span>
                    </label>
                    <select
                      required
                      style={{ width: "100%", padding: "9px 12px", fontSize: 13, borderRadius: 8, border: "1.5px solid #CBD5E1", outline: "none", background: "#FFFFFF", color: "#0F172A" }}
                      value={form.supplier_id}
                      onChange={e => setForm({ ...form, supplier_id: e.target.value })}
                    >
                      <option value="">-- Pilih Supplier --</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.nama_supplier} ({s.uid || `SUP-${s.id}`})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontWeight: 700, fontSize: 12, color: "#334155", marginBottom: 4 }}>
                      Tanggal Order <span style={{ color: "#EF4444" }}>*</span>
                    </label>
                    <input 
                      required
                      type="date"
                      style={{ width: "100%", padding: "8px 12px", fontSize: 13, borderRadius: 8, border: "1.5px solid #CBD5E1", outline: "none", background: "#FFFFFF", color: "#0F172A", boxSizing: "border-box" }}
                      value={form.tanggal}
                      onChange={e => setForm({ ...form, tanggal: e.target.value })}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontWeight: 700, fontSize: 12, color: "#334155", marginBottom: 4 }}>
                      Metode Pembayaran
                    </label>
                    <select
                      style={{ width: "100%", padding: "9px 12px", fontSize: 13, borderRadius: 8, border: "1.5px solid #CBD5E1", outline: "none", background: "#FFFFFF", color: "#0F172A" }}
                      value={form.metode_pembayaran}
                      onChange={(e: any) => setForm({ ...form, metode_pembayaran: e.target.value })}
                    >
                      <option value="Tempo">Tempo / Hutang Dagang</option>
                      <option value="Cash">Cash / Tunai</option>
                      <option value="Transfer">Transfer Bank</option>
                      <option value="Hutang">Hutang Jatuh Tempo</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontWeight: 700, fontSize: 12, color: "#334155", marginBottom: 4 }}>
                      Status Pengiriman Awal
                    </label>
                    <select
                      style={{ width: "100%", padding: "9px 12px", fontSize: 13, borderRadius: 8, border: "1.5px solid #CBD5E1", outline: "none", background: "#FFFFFF", color: "#0F172A" }}
                      value={form.status}
                      onChange={(e: any) => setForm({ ...form, status: e.target.value })}
                    >
                      <option value="Diterima">Diterima (Langsung Masuk Stok)</option>
                      <option value="Dikirim">Dalam Pengiriman</option>
                      <option value="PO">PO Dipesan</option>
                    </select>
                  </div>
                </div>

                {/* ITEMS SECTION */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <h3 style={{ fontSize: 13.5, fontWeight: 900, color: "#0F172A", margin: 0, textTransform: "uppercase" }}>
                      Item Bahan Baku Kain yang Dipesan:
                    </h3>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      style={{
                        fontSize: 12,
                        padding: "6px 14px",
                        borderRadius: 8,
                        border: "1px solid #CBD5E1",
                        background: "#FFFFFF",
                        color: "#2563EB",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontWeight: 800,
                        cursor: "pointer"
                      }}
                    >
                      <Plus size={14} /> Tambah Baris Kain
                    </button>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {form.items.map((it, idx) => (
                      <div key={idx} style={{ background: "white", padding: "14px 18px", borderRadius: 12, border: "1.5px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 0.8fr 1fr 1.2fr 1.2fr 34px", gap: 10, alignItems: "center" }}>
                          
                          {/* NAMA KAIN */}
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 3 }}>Nama Kain</label>
                            <input 
                              required
                              type="text"
                              placeholder="e.g. MK 1299 SST"
                              style={{ width: "100%", padding: "8px 10px", fontSize: 12.5, borderRadius: 8, border: "1px solid #CBD5E1", outline: "none", boxSizing: "border-box" }}
                              value={it.nama_kain}
                              onChange={e => handleItemChange(idx, "nama_kain", e.target.value)}
                              list="kain-presets"
                            />
                            <datalist id="kain-presets">
                              {dataKainList.map(k => <option key={k.id} value={k.nama_kain} />)}
                            </datalist>
                          </div>

                          {/* WARNA */}
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 3 }}>Warna</label>
                            <input 
                              type="text"
                              placeholder="e.g. GREY / ABU"
                              style={{ width: "100%", padding: "8px 10px", fontSize: 12.5, borderRadius: 8, border: "1px solid #CBD5E1", outline: "none", boxSizing: "border-box" }}
                              value={it.warna}
                              onChange={e => handleItemChange(idx, "warna", e.target.value)}
                            />
                          </div>

                          {/* ROLL */}
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 3 }}>Jml Roll</label>
                            <input 
                              type="number"
                              placeholder="e.g. 20"
                              style={{ width: "100%", padding: "8px 10px", fontSize: 12.5, borderRadius: 8, border: "1px solid #CBD5E1", outline: "none", textAlign: "center", boxSizing: "border-box" }}
                              value={it.roll}
                              onChange={e => handleItemChange(idx, "roll", e.target.value)}
                            />
                          </div>

                          {/* TOTAL METER */}
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 3 }}>Total Meter</label>
                            <input 
                              required
                              type="number"
                              step="0.01"
                              placeholder="e.g. 2880"
                              style={{ width: "100%", padding: "8px 10px", fontSize: 12.5, borderRadius: 8, border: "1px solid #CBD5E1", outline: "none", fontWeight: 800, color: "#2563EB", boxSizing: "border-box" }}
                              value={it.meter}
                              onChange={e => handleItemChange(idx, "meter", e.target.value)}
                            />
                          </div>

                          {/* HARGA PER METER */}
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 3 }}>Harga / Meter (Rp)</label>
                            <input 
                              required
                              type="number"
                              placeholder="e.g. 17500"
                              style={{ width: "100%", padding: "8px 10px", fontSize: 12.5, borderRadius: 8, border: "1px solid #CBD5E1", outline: "none", boxSizing: "border-box" }}
                              value={it.harga_meter}
                              onChange={e => handleItemChange(idx, "harga_meter", e.target.value)}
                            />
                          </div>

                          {/* SUBTOTAL */}
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 3 }}>Subtotal (Rp)</label>
                            <div style={{ fontSize: 13.5, fontWeight: 900, color: "#0F172A", padding: "7px 0" }}>
                              Rp {(it.subtotal || 0).toLocaleString("id-ID")}
                            </div>
                          </div>

                          {/* DELETE ROW */}
                          <div>
                            <label style={{ display: "block", marginBottom: 3 }}>&nbsp;</label>
                            {form.items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                style={{ background: "none", border: "none", color: "#DC2626", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                              >
                                <X size={18} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* RINCIAN METER PER ROLL (OPTIONAL) */}
                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed #E2E8F0" }}>
                          <input 
                            type="text"
                            placeholder="Rincian meter per roll opsional (pisahkan koma, misal: 144, 144, 140, 146...)"
                            style={{ width: "100%", padding: "7px 12px", fontSize: 11.5, borderRadius: 6, border: "1px solid #E2E8F0", outline: "none", color: "#475569", boxSizing: "border-box", background: "#F8FAFC" }}
                            value={it.roll_details_text}
                            onChange={e => handleItemChange(idx, "roll_details_text", e.target.value)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CATATAN & SUMMARY */}
                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16, background: "#F8FAFC", padding: "16px 20px", borderRadius: 12, border: "1px solid #E2E8F0" }}>
                  <div>
                    <label style={{ display: "block", fontWeight: 700, fontSize: 12, color: "#334155", marginBottom: 4 }}>
                      Catatan Pembelian (No Surat Jalan / Invoice Supplier)
                    </label>
                    <textarea 
                      rows={2}
                      placeholder="e.g. No Surat Jalan Pabrik SJ-9892, jatuh tempo 30 hari..."
                      style={{ width: "100%", padding: "8px 12px", fontSize: 12.5, borderRadius: 8, border: "1px solid #CBD5E1", outline: "none", boxSizing: "border-box" }}
                      value={form.catatan}
                      onChange={e => setForm({ ...form, catatan: e.target.value })}
                    />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-end", textAlign: "right" }}>
                    <div style={{ fontSize: 12, color: "#64748B", fontWeight: 700, textTransform: "uppercase" }}>
                      Total Biaya Pembelian
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 900, color: "#0F172A", marginTop: 2 }}>
                      Rp {grandTotalNewPo.toLocaleString("id-ID")}
                    </div>
                    <div style={{ fontSize: 11, color: "#2563EB", marginTop: 4 }}>
                      *Stok kain & hutang akan otomatis diperbarui sistem
                    </div>
                  </div>
                </div>
              </form>
            </div>

            {/* MODAL FOOTER */}
            <div style={{ padding: "16px 28px", borderTop: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#F8FAFC" }}>
              <button 
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{
                  padding: "8px 18px",
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
                form="form-new-po"
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
                  gap: 8,
                  boxShadow: "0 2px 8px rgba(37,99,235,0.25)",
                  opacity: isSubmitting ? 0.7 : 1
                }}
              >
                <CheckCircle2 size={16} /> {isSubmitting ? "Menyimpan..." : "Simpan & Terbitkan PO Kain"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
