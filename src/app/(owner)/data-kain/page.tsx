"use client";
import React, { useEffect, useState, useRef } from "react";
import { Plus, Edit2, Trash2, Save, X, ShoppingCart, Eye, Package, Scissors, Sparkles, AlertCircle, ArrowUpRight, Search, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function DataKainPage() {
  const [activeTab, setActiveTab] = useState<"kain" | "pendukung">("kain");
  const [data, setData] = useState<any[]>([]);
  const [itemPendukung, setItemPendukung] = useState<any[]>([]);
  const _bgRefresh = useRef(false);
  const [supplierList, setSupplierList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter & Search untuk Item Pendukung
  const [kategoriFilter, setKategoriFilter] = useState("Semua");
  const [searchPendukung, setSearchPendukung] = useState("");

  // Form Master Kain
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ id: 0, nama_kain: "", warna: "", harga_beli: "" });

  // Form Pembelian Kain Masuk
  const [showBeli, setShowBeli] = useState(false);
  const [beliForm, setBeliForm] = useState({
    tanggal: new Date().toISOString().split("T")[0],
    supplier_id: "",
    metode_pembayaran: "Tempo",
    status: "Diterima",
    catatan: "",
    items: [{ nama_kain: "", warna: "", roll: "", meter: 0, harga_meter: "", subtotal: 0, roll_details: [] as string[] }]
  });

  // Modal Detail Roll Kain
  const [viewRolls, setViewRolls] = useState<any>(null);

  // Form Master Item Pendukung (Tambah / Edit)
  const [showFormPendukung, setShowFormPendukung] = useState(false);
  const [formPendukung, setFormPendukung] = useState({
    id: 0,
    nama: "",
    kategori: "Benang",
    tipe: "",
    warna: "",
    satuan: "Cones",
    stok: "",
    harga_beli: "",
    supplier_id: "",
    catatan: ""
  });

  // Modal Restock / Pembelian Masuk Item Pendukung
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [restockTarget, setRestockTarget] = useState<any>(null);
  const [restockForm, setRestockForm] = useState({
    tambah_stok: "",
    harga_beli_baru: "",
    supplier_id: "",
    catatan: ""
  });

  const fetchData = async () => {
    if (!_bgRefresh.current) setLoading(true);
    try {
      const [resKain, resSup, resPendukung] = await Promise.all([
        fetch("/api/kain").then(r => r.json()),
        fetch("/api/supplier").then(r => r.json()),
        fetch("/api/item-pendukung").then(r => r.json())
      ]);
      setData(Array.isArray(resKain) ? resKain : []);
      setSupplierList(Array.isArray(resSup) ? resSup : []);
      setItemPendukung(Array.isArray(resPendukung) ? resPendukung : []);
    } catch (e) {
      toast.error("Gagal mengambil data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Real-time sync: refresh data when another admin makes changes
  useEffect(() => {
    window.addEventListener("konveksi-sync", fetchData);
    return () => window.removeEventListener("konveksi-sync", fetchData);
  }, [fetchData]);

  // ================= KAIN LOGIC =================
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        stok_meter: 0
      };
      const res = await fetch("/api/kain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        toast.success("Berhasil mendaftarkan kain");
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
    if (!confirm("Yakin ingin menghapus master kain ini?")) return;
    try {
      const res = await fetch(`/api/kain?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Berhasil dihapus");
        fetchData();
      }
    } catch (e) {
      toast.error("Gagal menghapus");
    }
  };

  const openEdit = (item: any) => {
    setForm({ id: item.id, nama_kain: item.nama_kain, warna: item.warna, harga_beli: item.harga_beli });
    setShowForm(true);
  };

  // PEMBELIAN KAIN
  const totalBeli = beliForm.items.reduce((sum, item) => sum + Number(item.subtotal), 0);

  const handleBeliItemChange = (idx: number, field: string, value: string) => {
    const newItems = [...beliForm.items];
    (newItems as any)[idx][field] = value;
    
    if (field === "nama_kain") {
      const existing = data.find(d => d.nama_kain === value);
      if (existing) {
        newItems[idx].warna = existing.warna || "";
        if (existing.harga_beli > 0 && !newItems[idx].harga_meter) {
           newItems[idx].harga_meter = existing.harga_beli.toString();
        }
      }
    }

    if (field === "roll") {
      const numRolls = parseInt(value) || 0;
      if (numRolls > 0 && numRolls <= 100) {
        const currentDetails = newItems[idx].roll_details;
        const newDetails = Array(numRolls).fill("").map((_, i) => currentDetails[i] || "");
        newItems[idx].roll_details = newDetails;
      } else {
        newItems[idx].roll_details = [];
      }
      const total = newItems[idx].roll_details.reduce((sum, val) => {
        const n = Number(String(val).replace(',', '.'));
        return sum + (isNaN(n) ? 0 : n);
      }, 0);
      newItems[idx].meter = Math.round(total * 1000) / 1000;
    }
    
    if (field === "meter") {
      newItems[idx].meter = Number(value.replace(',', '.')) || 0;
    }

    if (field === "meter" || field === "harga_meter" || field === "roll") {
      newItems[idx].subtotal = Number(newItems[idx].meter) * Number(newItems[idx].harga_meter) || 0;
    }
    
    setBeliForm({...beliForm, items: newItems});
  };

  const handleRollDetailChange = (itemIdx: number, rollIdx: number, value: string) => {
    const newItems = [...beliForm.items];
    newItems[itemIdx].roll_details[rollIdx] = value;
    
    const totalMeter = newItems[itemIdx].roll_details.reduce((sum, val) => {
      const n = Number(String(val).replace(',', '.'));
      return sum + (isNaN(n) ? 0 : n);
    }, 0);
    newItems[itemIdx].meter = Math.round(totalMeter * 1000) / 1000;
    newItems[itemIdx].subtotal = newItems[itemIdx].meter * Number(newItems[itemIdx].harga_meter) || 0;
    
    setBeliForm({...beliForm, items: newItems});
  };

  const handleRemoveRollDetail = (itemIdx: number, rollIdx: number) => {
    const newItems = [...beliForm.items];
    newItems[itemIdx].roll_details = newItems[itemIdx].roll_details.filter((_, i) => i !== rollIdx);
    newItems[itemIdx].roll = newItems[itemIdx].roll_details.length.toString();
    
    const totalMeter = newItems[itemIdx].roll_details.reduce((sum, val) => {
      const n = Number(String(val).replace(',', '.'));
      return sum + (isNaN(n) ? 0 : n);
    }, 0);
    newItems[itemIdx].meter = Math.round(totalMeter * 1000) / 1000;
    newItems[itemIdx].subtotal = newItems[itemIdx].meter * Number(newItems[itemIdx].harga_meter) || 0;
    
    setBeliForm({...beliForm, items: newItems});
  };

  const handleSubmitBeli = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!beliForm.supplier_id || beliForm.items.some(i => !i.nama_kain || i.meter === 0 || !i.harga_meter)) {
      return toast.error("Harap lengkapi Supplier, item barang, dan pastikan total meter > 0.");
    }

    try {
      const res = await fetch("/api/pembelian", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(beliForm)
      });
      if (res.ok) {
        toast.success("Pembelian berhasil disimpan!");
        setShowBeli(false);
        fetchData();
        window.location.href = "/pembelian";
      } else {
        const err = await res.json();
        toast.error(err.error || "Gagal memproses pembelian");
      }
    } catch (e) {
      toast.error("Terjadi kesalahan sistem");
    }
  };

  // ================= ITEM PENDUKUNG LOGIC =================
  const handleSavePendukung = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPendukung.nama || !formPendukung.kategori) {
      return toast.error("Nama dan kategori wajib diisi");
    }

    try {
      const res = await fetch("/api/item-pendukung", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formPendukung)
      });
      if (res.ok) {
        toast.success(formPendukung.id ? "Item pendukung berhasil diupdate" : "Item pendukung baru berhasil ditambahkan!");
        setShowFormPendukung(false);
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || "Gagal menyimpan");
      }
    } catch (e) {
      toast.error("Terjadi kesalahan");
    }
  };

  const handleDeletePendukung = async (id: number) => {
    if (!confirm("Yakin ingin menghapus item pendukung ini?")) return;
    try {
      const res = await fetch(`/api/item-pendukung?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Item pendukung berhasil dihapus");
        fetchData();
      }
    } catch (e) {
      toast.error("Gagal menghapus item");
    }
  };

  const handleQuickRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockTarget || !restockForm.tambah_stok || Number(restockForm.tambah_stok) <= 0) {
      return toast.error("Masukkan jumlah stok yang valid");
    }

    try {
      const res = await fetch("/api/item-pendukung", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: restockTarget.id,
          tambah_stok: Number(restockForm.tambah_stok),
          harga_beli_baru: restockForm.harga_beli_baru ? Number(restockForm.harga_beli_baru) : undefined,
          supplier_id: restockForm.supplier_id || undefined,
          catatan: restockForm.catatan
        })
      });

      if (res.ok) {
        toast.success(`Stok ${restockTarget.nama} berhasil ditambah +${restockForm.tambah_stok} ${restockTarget.satuan}!`);
        setShowRestockModal(false);
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || "Gagal menambah stok");
      }
    } catch (e) {
      toast.error("Terjadi kesalahan");
    }
  };

  // Filter list item pendukung
  const filteredPendukung = itemPendukung.filter(it => {
    const matchKat = kategoriFilter === "Semua" || it.kategori.toLowerCase() === kategoriFilter.toLowerCase();
    const matchSearch = !searchPendukung || 
      it.nama.toLowerCase().includes(searchPendukung.toLowerCase()) ||
      (it.tipe && it.tipe.toLowerCase().includes(searchPendukung.toLowerCase())) ||
      (it.warna && it.warna.toLowerCase().includes(searchPendukung.toLowerCase()));
    return matchKat && matchSearch;
  });

  // Kategori badge color mapping
  const getKategoriBadge = (kat: string) => {
    switch (kat) {
      case "Benang":
        return { bg: "#EEF2FF", color: "#4F46E5", border: "#C7D2FE" };
      case "Resleting":
        return { bg: "#F0F9FF", color: "#0284C7", border: "#BAE6FD" };
      case "Kancing":
        return { bg: "#FAF5FF", color: "#9333EA", border: "#E9D5FF" };
      case "Rivet":
        return { bg: "#ECFDF5", color: "#059669", border: "#A7F3D0" };
      case "Label & Hangtag":
        return { bg: "#FFFBEB", color: "#D97706", border: "#FDE68A" };
      default:
        return { bg: "#F1F5F9", color: "#475569", border: "#CBD5E1" };
    }
  };

  const totalKainMeter = data.reduce((sum, k) => sum + (Number(k.stok_meter) || 0), 0);
  const totalKainRoll = data.reduce((sum, k) => sum + ((k.rolls || []).length || 0), 0);
  const kritisCount = itemPendukung.filter(i => (Number(i.stok) || 0) < 10).length;

  return (
    <div style={{ padding: 32, background: "var(--bg-app)", minHeight: "100%" }}>
      {/* HEADER UTAMA */}
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 className="page-title">Data Kain & Gudang Aksesoris</h1>
          <p className="page-subtitle">Kelola stok kain mentah per-roll dan bahan pendukung produksi (benang, resleting, kancing, dll).</p>
        </div>
        
        {/* ACTION BUTTONS HEADER */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {activeTab === "kain" ? (
            <>
              <button 
                className="btn btn-secondary" 
                style={{ background: "white", display: "flex", alignItems: "center", gap: 6 }}
                onClick={() => { setForm({ id: 0, nama_kain: "", warna: "", harga_beli: "" }); setShowForm(true); setShowBeli(false); }}
              >
                <Plus size={16} /> Tambah Master Kain
              </button>
              <button 
                className="btn btn-primary" 
                style={{ display: "flex", alignItems: "center", gap: 6 }}
                onClick={() => { 
                  setBeliForm({
                    tanggal: new Date().toISOString().split("T")[0], supplier_id: "", metode_pembayaran: "Tempo", status: "Diterima", catatan: "",
                    items: [{ nama_kain: "", warna: "", roll: "", meter: 0, harga_meter: "", subtotal: 0, roll_details: [] }]
                  });
                  setShowBeli(true); 
                  setShowForm(false);
                }}
              >
                <ShoppingCart size={16} /> Pembelian Kain Masuk
              </button>
            </>
          ) : (
            <>
              <button 
                className="btn btn-secondary" 
                style={{ background: "white", display: "flex", alignItems: "center", gap: 6 }}
                onClick={() => {
                  setFormPendukung({ id: 0, nama: "", kategori: "Benang", tipe: "", warna: "", satuan: "Cones", stok: "", harga_beli: "", supplier_id: "", catatan: "" });
                  setShowFormPendukung(true);
                }}
              >
                <Plus size={16} /> Tambah Master Aksesoris
              </button>
              <button 
                className="btn btn-primary" 
                style={{ display: "flex", alignItems: "center", gap: 6 }}
                onClick={() => {
                  if (itemPendukung.length > 0) {
                    setRestockTarget(itemPendukung[0]);
                    setRestockForm({ tambah_stok: "", harga_beli_baru: itemPendukung[0].harga_beli || "", supplier_id: itemPendukung[0].supplier_id || "", catatan: "" });
                    setShowRestockModal(true);
                  } else {
                    toast.error("Tambahkan master item terlebih dahulu");
                  }
                }}
              >
                <ArrowUpRight size={16} /> Restock / Beli Dari Supplier
              </button>
            </>
          )}
        </div>
      </div>

      {/* METRIC STATS CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "white", padding: "18px 20px", borderRadius: 16, border: "1px solid #E2E8F0", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
          <div style={{ fontSize: 12, color: "#64748B", fontWeight: 700, textTransform: "uppercase" }}>Total Stok Kain Mentah</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", marginTop: 4 }}>
            {totalKainMeter.toFixed(1)} <span style={{ fontSize: 14, fontWeight: 600, color: "#64748B" }}>Meter</span>
          </div>
          <div style={{ fontSize: 12, color: "#059669", fontWeight: 700, marginTop: 4 }}>
            {totalKainRoll} Roll Aktif di Gudang
          </div>
        </div>

        <div style={{ background: "white", padding: "18px 20px", borderRadius: 16, border: "1px solid #E2E8F0", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
          <div style={{ fontSize: 12, color: "#64748B", fontWeight: 700, textTransform: "uppercase" }}>Varian Item Pendukung</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#2563EB", marginTop: 4 }}>
            {itemPendukung.length} <span style={{ fontSize: 14, fontWeight: 600, color: "#64748B" }}>Item Terdaftar</span>
          </div>
          <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>
            Benang, Resleting, Kancing & Rivet
          </div>
        </div>

        <div style={{ background: "white", padding: "18px 20px", borderRadius: 16, border: "1px solid #E2E8F0", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
          <div style={{ fontSize: 12, color: "#64748B", fontWeight: 700, textTransform: "uppercase" }}>Peringatan Stok Kritis</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: kritisCount > 0 ? "#DC2626" : "#059669", marginTop: 4 }}>
            {kritisCount} <span style={{ fontSize: 14, fontWeight: 600, color: "#64748B" }}>Item</span>
          </div>
          <div style={{ fontSize: 12, color: kritisCount > 0 ? "#DC2626" : "#059669", fontWeight: 600, marginTop: 4 }}>
            {kritisCount > 0 ? "Stok di bawah 10 unit! Segera restock" : "Semua stok aksesoris aman"}
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, borderBottom: "2px solid #E2E8F0", paddingBottom: 2 }}>
        <button
          onClick={() => setActiveTab("kain")}
          style={{
            padding: "10px 20px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "kain" ? "3px solid #2563EB" : "3px solid transparent",
            color: activeTab === "kain" ? "#2563EB" : "#64748B",
            fontWeight: 800,
            fontSize: 15,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            transition: "all 0.2s"
          }}
        >
          <Scissors size={18} />
          Katalog Kain Mentah (Gudang Roll)
          <span style={{ fontSize: 12, background: activeTab === "kain" ? "#EFF6FF" : "#F1F5F9", color: activeTab === "kain" ? "#2563EB" : "#64748B", padding: "2px 8px", borderRadius: 10 }}>
            {data.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("pendukung")}
          style={{
            padding: "10px 20px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "pendukung" ? "3px solid #2563EB" : "3px solid transparent",
            color: activeTab === "pendukung" ? "#2563EB" : "#64748B",
            fontWeight: 800,
            fontSize: 15,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            transition: "all 0.2s"
          }}
        >
          <Package size={18} />
          Bahan Pendukung & Aksesoris (Benang, Resleting, dll)
          <span style={{ fontSize: 12, background: activeTab === "pendukung" ? "#EFF6FF" : "#F1F5F9", color: activeTab === "pendukung" ? "#2563EB" : "#64748B", padding: "2px 8px", borderRadius: 10 }}>
            {itemPendukung.length}
          </span>
        </button>
      </div>

      {/* ========================================================
          TAB 1: KAIN MENTAH (GUDANG ROLL)
         ======================================================== */}
      {activeTab === "kain" && (
        <>
          {/* MODAL LIHAT DETAIL ROLL */}
          {viewRolls && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 20 }}>
              <div style={{ background: "white", width: "100%", maxWidth: 640, borderRadius: 20, overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,0.25)", display: "flex", flexDirection: "column", maxHeight: "90vh" }}>
                <div style={{ padding: "20px 24px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(135deg, #1E293B, #0F172A)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <ShoppingCart size={20} color="#38BDF8" />
                    </div>
                    <div>
                      <h2 style={{ fontSize: 18, fontWeight: 900, color: "white", margin: 0 }}>Rincian Roll Kain</h2>
                      <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 2 }}>{viewRolls.nama_kain} ({viewRolls.warna})</div>
                    </div>
                  </div>
                  <button onClick={() => setViewRolls(null)} style={{ background: "rgba(255,255,255,0.1)", border: "none", width: 32, height: 32, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
                    <X size={16} />
                  </button>
                </div>
                
                <div style={{ padding: 24, overflowY: "auto", background: "#F8FAFC" }}>
                  {(!viewRolls.rolls || viewRolls.rolls.length === 0) ? (
                    <div style={{ textAlign: "center", color: "#64748B", padding: "40px 20px" }}>
                      <ShoppingCart size={32} color="#CBD5E1" style={{ margin: "0 auto 12px" }} />
                      <div style={{ fontSize: 15, fontWeight: 700 }}>Tidak ada rincian roll</div>
                      <div style={{ fontSize: 13, marginTop: 4 }}>Data roll tidak tersedia untuk item ini.</div>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, background: "white", padding: "12px 16px", borderRadius: 12, border: "1px solid #E2E8F0" }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ fontSize: 13, color: "#64748B", fontWeight: 600 }}>Total Roll:</span>
                          <span style={{ fontSize: 15, fontWeight: 900, color: "#0F172A", background: "#F1F5F9", padding: "4px 10px", borderRadius: 8 }}>{viewRolls.rolls.length}</span>
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ fontSize: 13, color: "#64748B", fontWeight: 600 }}>Total Meter:</span>
                          <span style={{ fontSize: 15, fontWeight: 900, color: "#059669", background: "#D1FAE5", padding: "4px 10px", borderRadius: 8 }}>
                            {viewRolls.rolls.reduce((sum: number, r: any) => sum + Number(typeof r === 'object' ? (r.meter || 0) : (r || 0)), 0)} <span style={{ fontSize: 12, color: "#047857" }}>m</span>
                          </span>
                        </div>
                      </div>
                      
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 12 }}>
                        {viewRolls.rolls.map((r: any, i: number) => {
                          const meter = typeof r === 'object' ? (r.meter || 0) : (r || 0);
                          return (
                            <div key={i} style={{ 
                              background: "white", 
                              borderRadius: 12, 
                              textAlign: "center", 
                              border: "1px solid #E2E8F0",
                              boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
                              overflow: "hidden"
                            }}>
                              <div style={{ background: "#F1F5F9", padding: "6px 0", fontSize: 11, color: "#64748B", fontWeight: 800, borderBottom: "1px solid #E2E8F0" }}>
                                ROLL {i+1}
                              </div>
                              <div style={{ padding: "16px 10px" }}>
                                <div style={{ fontSize: 20, fontWeight: 900, color: "#0F172A" }}>
                                  {meter} <span style={{ fontSize: 12, fontWeight: 600, color: "#94A3B8" }}>m</span>
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

          {/* FORM PEMBELIAN KAIN MASUK */}
          {showBeli && (
            <div className="card" style={{ marginBottom: 24, border: "2px solid var(--color-primary)" }}>
              <div className="card-header" style={{ display: "flex", justifyContent: "space-between", background: "#EFF6FF" }}>
                <h2 className="card-title" style={{ color: "var(--color-primary)" }}>Form Pembelian Kain Baru (Barang Masuk)</h2>
                <button className="btn btn-secondary" onClick={() => setShowBeli(false)} style={{ padding: 8 }}><X size={18} /></button>
              </div>
              <form onSubmit={handleSubmitBeli} style={{ padding: 24 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
                  <div>
                    <label className="label">Tanggal</label>
                    <input type="date" required className="form-control" value={beliForm.tanggal} onChange={e => setBeliForm({...beliForm, tanggal: e.target.value})} />
                  </div>
                  <div>
                    <label className="label">Supplier</label>
                    <select required className="form-control" value={beliForm.supplier_id} onChange={e => setBeliForm({...beliForm, supplier_id: e.target.value})}>
                      <option value="">-- Pilih Supplier --</option>
                      {supplierList.map(s => <option key={s.id} value={s.id}>{s.nama_supplier}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Metode Pembayaran</label>
                    <select required className="form-control" value={beliForm.metode_pembayaran} onChange={e => setBeliForm({...beliForm, metode_pembayaran: e.target.value})}>
                      <option value="Tempo">Tempo (Hutang)</option>
                      <option value="Cash">Cash / Lunas</option>
                      <option value="Transfer">Transfer Bank</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Status Penerimaan</label>
                    <select required className="form-control" value={beliForm.status} onChange={e => setBeliForm({...beliForm, status: e.target.value})}>
                      <option value="Diterima">Diterima (Langsung Masuk Gudang)</option>
                      <option value="Dikirim">Dalam Pengiriman</option>
                      <option value="PO">PO / Pesan</option>
                    </select>
                  </div>
                </div>

                <div style={{ background: "#F8FAFC", padding: 16, borderRadius: 8, border: "1px solid var(--border-color)", marginBottom: 16 }}>
                  <label className="label">Detail Item Kain</label>
                  {beliForm.items.map((item, idx) => (
                    <div key={idx} style={{ marginBottom: 16, padding: 16, background: "white", borderRadius: 8, border: "1px solid #E2E8F0", position: "relative" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 80px 100px 150px 150px", gap: 12, alignItems: "flex-end" }}>
                        <div>
                          <label className="label" style={{ fontSize: 11 }}>Nama Kain</label>
                          <datalist id="kain-options">
                            {data.map(k => <option key={k.id} value={k.nama_kain} />)}
                          </datalist>
                          <input required className="form-control" list="kain-options" placeholder="Pilih / Ketik Baru" value={item.nama_kain} onChange={e => handleBeliItemChange(idx, "nama_kain", e.target.value)} />
                        </div>
                        <div>
                          <label className="label" style={{ fontSize: 11 }}>Warna</label>
                          <input className="form-control" placeholder="Warna" value={item.warna} onChange={e => handleBeliItemChange(idx, "warna", e.target.value)} />
                        </div>
                        <div>
                          <label className="label" style={{ fontSize: 11 }}>Jml Roll</label>
                          <input type="number" min="0" max="100" className="form-control" placeholder="0" value={item.roll} onChange={e => handleBeliItemChange(idx, "roll", e.target.value)} />
                        </div>
                        <div>
                          <label className="label" style={{ fontSize: 11 }}>Total (m)</label>
                          <input type="number" step="0.01" readOnly={item.roll_details.length > 0} className="form-control" style={{ background: item.roll_details.length > 0 ? "#F1F5F9" : "white" }} placeholder="Meter" value={item.meter} onChange={e => handleBeliItemChange(idx, "meter", e.target.value)} />
                        </div>
                        <div>
                          <label className="label" style={{ fontSize: 11 }}>Harga/m (Rp)</label>
                          <input type="number" required className="form-control" placeholder="Harga" value={item.harga_meter} onChange={e => handleBeliItemChange(idx, "harga_meter", e.target.value)} />
                        </div>
                        <div>
                          <label className="label" style={{ fontSize: 11 }}>Subtotal (Rp)</label>
                          <div style={{ padding: "10px 12px", background: "#F1F5F9", borderRadius: 8, fontWeight: 700, textAlign: "right", border: "1px solid #CBD5E1" }}>
                            {item.subtotal.toLocaleString("id-ID")}
                          </div>
                        </div>
                        {beliForm.items.length > 1 && (
                          <button type="button" style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", cursor: "pointer", color: "#EF4444" }} onClick={() => setBeliForm({...beliForm, items: beliForm.items.filter((_, i) => i !== idx)})}>
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>

                      {item.roll_details.length > 0 && (
                        <div style={{ marginTop: 16, padding: "12px", background: "#F8FAFC", borderRadius: 8, border: "1px dashed #CBD5E1" }}>
                          <label className="label" style={{ fontSize: 11, marginBottom: 8 }}>Masukkan Panjang Meter per Roll:</label>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {item.roll_details.map((rd, rIdx) => (
                              <div key={rIdx} style={{ display: "flex", alignItems: "center", background: "white", border: "1px solid #E2E8F0", borderRadius: 6, padding: "4px 8px", width: 140 }}>
                                <span style={{ fontSize: 11, color: "#64748B", marginRight: 8, fontWeight: 700 }}>#{rIdx+1}</span>
                                <input 
                                  type="text" 
                                  inputMode="decimal"
                                  placeholder="0" 
                                  value={rd} 
                                  onChange={(e) => handleRollDetailChange(idx, rIdx, e.target.value)}
                                  style={{ border: "none", outline: "none", width: "100%", fontSize: 14, fontWeight: 600 }}
                                  required
                                />
                                <button 
                                  type="button" 
                                  onClick={() => handleRemoveRollDetail(idx, rIdx)}
                                  style={{ background: "none", border: "none", cursor: "pointer", color: "#EF4444", padding: 4 }}
                                  title="Hapus roll ini"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  <button type="button" className="btn btn-secondary" onClick={() => setBeliForm({...beliForm, items: [...beliForm.items, { nama_kain: "", warna: "", roll: "", meter: 0, harga_meter: "", subtotal: 0, roll_details: [] }]})}>
                    + Tambah Item Kain
                  </button>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ flex: 1, marginRight: 24 }}>
                    <input className="form-control" placeholder="Catatan Tambahan..." value={beliForm.catatan} onChange={e => setBeliForm({...beliForm, catatan: e.target.value})} />
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>Total Tagihan: <span style={{ color: "var(--color-primary)" }}>Rp {totalBeli.toLocaleString("id-ID")}</span></div>
                </div>

                <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
                  <button type="submit" className="btn btn-primary" style={{ padding: "12px 24px", fontSize: 16 }}><Save size={18} /> Simpan Pembelian</button>
                </div>
              </form>
            </div>
          )}

          {/* FORM MASTER MANUAL KAIN */}
          {showForm && (
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-header" style={{ display: "flex", justifyContent: "space-between" }}>
                <h2 className="card-title">{form.id ? "Edit Katalog Kain" : "Tambah Katalog Master Kain (Tanpa Stok)"}</h2>
                <button className="btn btn-secondary" onClick={() => setShowForm(false)} style={{ padding: 8 }}><X size={18} /></button>
              </div>
              <form onSubmit={handleSave} style={{ padding: 24 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                  <div>
                    <label className="label">Nama Kain</label>
                    <input required className="form-control" value={form.nama_kain || ""} onChange={e => setForm({...form, nama_kain: e.target.value})} placeholder="Contoh: Denim 12oz Hitam" />
                  </div>
                  <div>
                    <label className="label">Warna / Kode</label>
                    <input className="form-control" value={form.warna || ""} onChange={e => setForm({...form, warna: e.target.value})} placeholder="Contoh: Hitam Pekat" />
                  </div>
                  <div>
                    <label className="label">Harga Beli Standar (Rp/Meter)</label>
                    <input type="number" className="form-control" value={form.harga_beli || ""} onChange={e => setForm({...form, harga_beli: e.target.value})} placeholder="Sebagai referensi saat form PO" />
                  </div>
                </div>
                <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
                  <button type="submit" className="btn btn-primary"><Save size={18} /> Simpan Data</button>
                </div>
              </form>
            </div>
          )}

          {/* TABEL MASTER KAIN */}
          <div className="card">
            <table className="table">
              <thead>
                <tr>
                  <th>Nama Kain</th>
                  <th>Warna / Keterangan</th>
                  <th>Stok Saat Ini (Meter)</th>
                  <th>Harga Rata-Rata (Rp/m)</th>
                  <th style={{ width: 180, textAlign: "right" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {data.map(item => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600, color: "#0F172A" }}>{item.nama_kain}</td>
                    <td>{item.warna || "-"}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div className={`badge ${item.stok_meter > 0 ? "success" : "danger"}`} style={{ fontSize: 14 }}>
                          {Number(item.stok_meter).toFixed(2)} m
                        </div>
                        {item.rolls && item.rolls.length > 0 && (
                          <span style={{ fontSize: 12, color: "#64748B", fontWeight: 700 }}>
                            ({item.rolls.length} Roll)
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>
                        Rp {Number(item.harga_beli || 0).toLocaleString("id-ID")}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <button className="btn btn-secondary" onClick={() => setViewRolls(item)} style={{ padding: "6px 12px", background: "#EFF6FF", color: "#3B82F6", border: "none" }} title="Lihat Detail Roll">
                          <Eye size={16} />
                        </button>
                        <button className="btn btn-secondary" onClick={() => openEdit(item)} style={{ padding: "6px 12px", border: "none" }}>
                          <Edit2 size={16} />
                        </button>
                        <button className="btn btn-danger" onClick={() => handleDelete(item.id)} style={{ padding: "6px 12px", border: "none" }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: 32, color: "var(--text-secondary)" }}>
                      Belum ada data Kain di Gudang.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ========================================================
          TAB 2: BAHAN PENDUKUNG & AKSESORIS (BENANG, RESLETING, DLL)
         ======================================================== */}
      {activeTab === "pendukung" && (
        <>
          {/* SEARCH & CATEGORY FILTER */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
            {/* Category Pills */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", background: "white", padding: 4, borderRadius: 10, border: "1px solid #E2E8F0" }}>
              {["Semua", "Benang", "Resleting", "Kancing", "Rivet", "Label & Hangtag", "Lainnya"].map(kat => (
                <button
                  key={kat}
                  onClick={() => setKategoriFilter(kat)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 8,
                    border: "none",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    background: kategoriFilter === kat ? "#2563EB" : "transparent",
                    color: kategoriFilter === kat ? "white" : "#64748B",
                    transition: "all 0.15s"
                  }}
                >
                  {kat}
                </button>
              ))}
            </div>

            {/* Search Box */}
            <div style={{ display: "flex", alignItems: "center", background: "white", padding: "6px 12px", borderRadius: 8, border: "1px solid #CBD5E1", width: 280 }}>
              <Search size={16} color="#94A3B8" style={{ marginRight: 8 }} />
              <input
                type="text"
                placeholder="Cari benang, resleting, kancing..."
                value={searchPendukung}
                onChange={e => setSearchPendukung(e.target.value)}
                style={{ border: "none", outline: "none", width: "100%", fontSize: 13 }}
              />
              {searchPendukung && (
                <button onClick={() => setSearchPendukung("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}>
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* FORM MASTER ITEM PENDUKUNG (MODAL) */}
          {showFormPendukung && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "24px 16px" }}>
              <div style={{ background: "white", width: "95vw", maxWidth: 920, borderRadius: 20, overflow: "hidden", boxShadow: "0 25px 70px rgba(0,0,0,0.3)", display: "flex", flexDirection: "column", maxHeight: "92vh" }}>
                {/* MODAL HEADER */}
                <div style={{ padding: "22px 32px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(135deg, #F8FAFC, #EFF6FF)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: "#DBEAFE", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563EB", boxShadow: "0 2px 6px rgba(37,99,235,0.15)" }}>
                      <Package size={24} />
                    </div>
                    <div>
                      <h2 style={{ fontSize: 20, fontWeight: 900, color: "#0F172A", margin: 0 }}>
                        {formPendukung.id ? "Edit Item Pendukung & Aksesoris" : "Tambah Master Item Pendukung Baru"}
                      </h2>
                      <div style={{ fontSize: 13, color: "#64748B", marginTop: 3 }}>
                        Kelola spesifikasi benang, resleting, kancing, atau bahan pelengkap produksi
                      </div>
                    </div>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setShowFormPendukung(false)} 
                    style={{ background: "white", border: "1px solid #E2E8F0", width: 36, height: 36, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B", transition: "all 0.2s" }}
                    onMouseOver={e => e.currentTarget.style.background = "#F1F5F9"}
                    onMouseOut={e => e.currentTarget.style.background = "white"}
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* MODAL FORM BODY */}
                <div style={{ overflowY: "auto", flex: 1, padding: "28px 32px" }}>
                  <form id="form-pendukung" onSubmit={handleSavePendukung}>
                    {/* SECTION 1: IDENTITAS ITEM & KATEGORI */}
                    <div style={{ background: "#F8FAFC", padding: "20px 24px", borderRadius: 14, border: "1px solid #E2E8F0", marginBottom: 20 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#1E293B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#2563EB" }}></span>
                        Informasi Utama Item
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr", gap: 20 }}>
                        <div>
                          <label className="label" style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                            Nama Item / Merk <span style={{ color: "#EF4444" }}>*</span>
                          </label>
                          <input 
                            required 
                            className="form-control" 
                            style={{ padding: "12px 16px", fontSize: 14, borderRadius: 10 }}
                            placeholder="Contoh: Benang Astra Jeans 20/2, Resleting YKK Metal Brass 5 Inch" 
                            value={formPendukung.nama} 
                            onChange={e => setFormPendukung({...formPendukung, nama: e.target.value})} 
                          />
                        </div>
                        <div>
                          <label className="label" style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                            Kategori Item <span style={{ color: "#EF4444" }}>*</span>
                          </label>
                          <select 
                            required 
                            className="form-control" 
                            style={{ padding: "12px 16px", fontSize: 14, borderRadius: 10 }}
                            value={formPendukung.kategori} 
                            onChange={e => setFormPendukung({...formPendukung, kategori: e.target.value})}
                          >
                            <option value="Benang">Benang</option>
                            <option value="Resleting">Resleting</option>
                            <option value="Kancing">Kancing</option>
                            <option value="Rivet">Rivet Saku</option>
                            <option value="Label & Hangtag">Label & Hangtag</option>
                            <option value="Lainnya">Lainnya / Bahan Pendukung</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 2: SPESIFIKASI TEKNIS & SATUAN */}
                    <div style={{ background: "#F8FAFC", padding: "20px 24px", borderRadius: 14, border: "1px solid #E2E8F0", marginBottom: 20 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#1E293B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#0284C7" }}></span>
                        Spesifikasi Teknis & Satuan
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.2fr 1fr", gap: 20 }}>
                        <div>
                          <label className="label" style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                            Tipe / Ukuran
                          </label>
                          <input 
                            className="form-control" 
                            style={{ padding: "12px 16px", fontSize: 14, borderRadius: 10 }}
                            placeholder="Contoh: 20/2, Gigi 5 Inci, 17mm" 
                            value={formPendukung.tipe} 
                            onChange={e => setFormPendukung({...formPendukung, tipe: e.target.value})} 
                          />
                        </div>
                        <div>
                          <label className="label" style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                            Warna / Finishing
                          </label>
                          <input 
                            className="form-control" 
                            style={{ padding: "12px 16px", fontSize: 14, borderRadius: 10 }}
                            placeholder="Contoh: Kuning Emas (Gold), Tembaga Bakar" 
                            value={formPendukung.warna} 
                            onChange={e => setFormPendukung({...formPendukung, warna: e.target.value})} 
                          />
                        </div>
                        <div>
                          <label className="label" style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                            Satuan Ukur <span style={{ color: "#EF4444" }}>*</span>
                          </label>
                          <select 
                            className="form-control" 
                            style={{ padding: "12px 16px", fontSize: 14, borderRadius: 10 }}
                            value={formPendukung.satuan} 
                            onChange={e => setFormPendukung({...formPendukung, satuan: e.target.value})}
                          >
                            <option value="Cones">Cones (Gulung)</option>
                            <option value="Pcs">Pcs (Biji/Buah)</option>
                            <option value="Lusin">Lusin (12 pcs)</option>
                            <option value="Gross">Gross (144 pcs)</option>
                            <option value="Roll">Roll</option>
                            <option value="Yard">Yard</option>
                            <option value="Meter">Meter</option>
                            <option value="Pack">Pack</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 3: STOK & HARGA */}
                    <div style={{ background: "#F8FAFC", padding: "20px 24px", borderRadius: 14, border: "1px solid #E2E8F0", marginBottom: 20 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#1E293B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#059669" }}></span>
                        Stok Awal & Harga Beli
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                        <div>
                          <label className="label" style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                            Stok Awal di Gudang ({formPendukung.satuan})
                          </label>
                          <input 
                            type="number" 
                            className="form-control" 
                            style={{ padding: "12px 16px", fontSize: 14, borderRadius: 10 }}
                            placeholder="0" 
                            value={formPendukung.stok} 
                            onChange={e => setFormPendukung({...formPendukung, stok: e.target.value})} 
                          />
                        </div>
                        <div>
                          <label className="label" style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                            Harga Beli Satuan Rata-Rata (Rp)
                          </label>
                          <input 
                            type="number" 
                            className="form-control" 
                            style={{ padding: "12px 16px", fontSize: 14, borderRadius: 10 }}
                            placeholder="Contoh: 28000" 
                            value={formPendukung.harga_beli} 
                            onChange={e => setFormPendukung({...formPendukung, harga_beli: e.target.value})} 
                          />
                        </div>
                      </div>
                    </div>

                    {/* SECTION 4: SUPPLIER & CATATAN */}
                    <div style={{ background: "#F8FAFC", padding: "20px 24px", borderRadius: 14, border: "1px solid #E2E8F0" }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#1E293B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#9333EA" }}></span>
                        Pemasok (Supplier) & Catatan
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 20 }}>
                        <div>
                          <label className="label" style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                            Supplier Langganan
                          </label>
                          <select 
                            className="form-control" 
                            style={{ padding: "12px 16px", fontSize: 14, borderRadius: 10 }}
                            value={formPendukung.supplier_id} 
                            onChange={e => setFormPendukung({...formPendukung, supplier_id: e.target.value})}
                          >
                            <option value="">-- Pilih Supplier --</option>
                            {supplierList.map(s => <option key={s.id} value={s.id}>{s.nama_supplier}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="label" style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                            Catatan Tambahan
                          </label>
                          <input 
                            className="form-control" 
                            style={{ padding: "12px 16px", fontSize: 14, borderRadius: 10 }}
                            placeholder="Contoh: khusus jahitan keliling saku depan, obras warna senada" 
                            value={formPendukung.catatan} 
                            onChange={e => setFormPendukung({...formPendukung, catatan: e.target.value})} 
                          />
                        </div>
                      </div>
                    </div>
                  </form>
                </div>

                {/* MODAL FOOTER */}
                <div style={{ padding: "20px 32px", borderTop: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", justifyContent: "flex-end", gap: 14 }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ padding: "12px 24px", fontSize: 15, borderRadius: 10 }}
                    onClick={() => setShowFormPendukung(false)}
                  >
                    Batal
                  </button>
                  <button 
                    type="submit" 
                    form="form-pendukung"
                    className="btn btn-primary"
                    style={{ padding: "12px 28px", fontSize: 15, borderRadius: 10, display: "flex", alignItems: "center", gap: 8, fontWeight: 800 }}
                  >
                    <Save size={18} /> Simpan Data Aksesoris
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MODAL QUICK RESTOCK / PEMBELIAN DARI SUPPLIER */}
          {showRestockModal && restockTarget && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "24px 16px" }}>
              <div style={{ background: "white", width: "92vw", maxWidth: 660, borderRadius: 20, overflow: "hidden", boxShadow: "0 25px 70px rgba(0,0,0,0.3)", display: "flex", flexDirection: "column", maxHeight: "90vh" }}>
                {/* MODAL HEADER */}
                <div style={{ padding: "20px 28px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#EFF6FF" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 10, background: "#DBEAFE", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563EB" }}>
                      <ArrowUpRight size={22} />
                    </div>
                    <div>
                      <h2 style={{ fontSize: 18, fontWeight: 900, color: "#1E3A8A", margin: 0 }}>Restock Pembelian Masuk</h2>
                      <div style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>Tambah stok item pendukung dari supplier</div>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setShowRestockModal(false)} 
                    style={{ background: "white", border: "1px solid #E2E8F0", width: 34, height: 34, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B" }}
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* MODAL FORM BODY */}
                <form id="form-restock" onSubmit={handleQuickRestockSubmit} style={{ padding: "24px 28px", overflowY: "auto", flex: 1 }}>
                  <div style={{ background: "#F8FAFC", padding: "16px 20px", borderRadius: 12, border: "1px solid #E2E8F0", marginBottom: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A" }}>{restockTarget.nama}</div>
                        <div style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>
                          Tipe: {restockTarget.tipe || "-"} | Warna: {restockTarget.warna || "-"}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", background: "#EFF6FF", padding: "8px 14px", borderRadius: 10, border: "1px solid #BFDBFE" }}>
                        <div style={{ fontSize: 11, color: "#1E40AF", fontWeight: 700, textTransform: "uppercase" }}>Stok Saat Ini</div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: "#2563EB" }}>
                          {restockTarget.stok} <span style={{ fontSize: 13 }}>{restockTarget.satuan}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 18, marginBottom: 18 }}>
                    <div>
                      <label className="label" style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                        Jumlah Tambah Stok ({restockTarget.satuan}) <span style={{ color: "#EF4444" }}>*</span>
                      </label>
                      <input 
                        type="number" 
                        required 
                        min="1" 
                        className="form-control" 
                        style={{ padding: "12px 16px", fontSize: 14, borderRadius: 10, fontWeight: 700 }}
                        placeholder="Contoh: 100" 
                        value={restockForm.tambah_stok} 
                        onChange={e => setRestockForm({...restockForm, tambah_stok: e.target.value})} 
                      />
                    </div>
                    <div>
                      <label className="label" style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                        Harga Beli Satuan Baru (Rp)
                      </label>
                      <input 
                        type="number" 
                        className="form-control" 
                        style={{ padding: "12px 16px", fontSize: 14, borderRadius: 10 }}
                        placeholder={restockTarget.harga_beli ? String(restockTarget.harga_beli) : "0"} 
                        value={restockForm.harga_beli_baru} 
                        onChange={e => setRestockForm({...restockForm, harga_beli_baru: e.target.value})} 
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: 18 }}>
                    <label className="label" style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                      Supplier Pembelian
                    </label>
                    <select 
                      className="form-control" 
                      style={{ padding: "12px 16px", fontSize: 14, borderRadius: 10 }}
                      value={restockForm.supplier_id} 
                      onChange={e => setRestockForm({...restockForm, supplier_id: e.target.value})}
                    >
                      <option value="">-- Pilih Supplier --</option>
                      {supplierList.map(s => <option key={s.id} value={s.id}>{s.nama_supplier}</option>)}
                    </select>
                  </div>

                  <div style={{ marginBottom: 20 }}>
                    <label className="label" style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                      Catatan Nota / Pembelian
                    </label>
                    <input 
                      className="form-control" 
                      style={{ padding: "12px 16px", fontSize: 14, borderRadius: 10 }}
                      placeholder="Nomor faktur / tanggal barang sampai..." 
                      value={restockForm.catatan} 
                      onChange={e => setRestockForm({...restockForm, catatan: e.target.value})} 
                    />
                  </div>

                  {restockForm.tambah_stok && (
                    <div style={{ padding: "14px 18px", background: "#ECFDF5", borderRadius: 10, border: "1px solid #A7F3D0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 14, color: "#065F46", fontWeight: 700 }}>Estimasi Total Stok Baru di Gudang:</span>
                      <span style={{ fontSize: 18, fontWeight: 900, color: "#059669" }}>
                        {(Number(restockTarget.stok) || 0) + Number(restockForm.tambah_stok)} {restockTarget.satuan}
                      </span>
                    </div>
                  )}
                </form>

                {/* MODAL FOOTER */}
                <div style={{ padding: "18px 28px", borderTop: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", justifyContent: "flex-end", gap: 12 }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ padding: "10px 20px", fontSize: 14, borderRadius: 8 }}
                    onClick={() => setShowRestockModal(false)}
                  >
                    Batal
                  </button>
                  <button 
                    type="submit" 
                    form="form-restock"
                    className="btn btn-primary" 
                    style={{ padding: "10px 24px", fontSize: 14, borderRadius: 8, display: "flex", alignItems: "center", gap: 6, fontWeight: 800 }}
                  >
                    <CheckCircle2 size={16} /> Konfirmasi Masuk Stok
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TABEL ITEM PENDUKUNG */}
          <div className="card">
            <table className="table">
              <thead>
                <tr>
                  <th>Nama Item & Kategori</th>
                  <th>Tipe & Warna</th>
                  <th>Satuan</th>
                  <th>Stok Tersedia</th>
                  <th>Harga Beli (Rp)</th>
                  <th>Supplier</th>
                  <th style={{ width: 190, textAlign: "right" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredPendukung.map(item => {
                  const badgeStyle = getKategoriBadge(item.kategori);
                  const stokNum = Number(item.stok) || 0;
                  const isKritis = stokNum < 10;
                  const isHabis = stokNum <= 0;

                  return (
                    <tr key={item.id}>
                      <td>
                        <div style={{ fontWeight: 800, color: "#0F172A", fontSize: 14 }}>{item.nama}</div>
                        <div style={{ marginTop: 4 }}>
                          <span style={{ 
                            fontSize: 10, 
                            fontWeight: 800, 
                            background: badgeStyle.bg, 
                            color: badgeStyle.color, 
                            border: `1px solid ${badgeStyle.border}`, 
                            padding: "2px 8px", 
                            borderRadius: 6,
                            textTransform: "uppercase"
                          }}>
                            {item.kategori}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{item.tipe || "-"}</div>
                        <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>{item.warna || "-"}</div>
                      </td>
                      <td>
                        <span style={{ background: "#F1F5F9", padding: "4px 8px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                          {item.satuan}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ 
                            fontSize: 15, 
                            fontWeight: 900,
                            color: isHabis ? "#DC2626" : isKritis ? "#D97706" : "#059669"
                          }}>
                            {stokNum}
                          </span>
                          {isHabis ? (
                            <span style={{ fontSize: 10, background: "#FEE2E2", color: "#DC2626", padding: "2px 6px", borderRadius: 4, fontWeight: 800 }}>
                              HABIS
                            </span>
                          ) : isKritis ? (
                            <span style={{ fontSize: 10, background: "#FEF3C7", color: "#D97706", padding: "2px 6px", borderRadius: 4, fontWeight: 800 }}>
                              MENIPIS
                            </span>
                          ) : (
                            <span style={{ fontSize: 10, background: "#D1FAE5", color: "#059669", padding: "2px 6px", borderRadius: 4, fontWeight: 800 }}>
                              AMAN
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: "#334155" }}>
                          Rp {Number(item.harga_beli || 0).toLocaleString("id-ID")}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: 12, color: "#475569" }}>
                          {item.supplier_nama || "-"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <button 
                            className="btn btn-secondary" 
                            onClick={() => {
                              setRestockTarget(item);
                              setRestockForm({ tambah_stok: "", harga_beli_baru: item.harga_beli || "", supplier_id: item.supplier_id || "", catatan: "" });
                              setShowRestockModal(true);
                            }}
                            style={{ padding: "6px 10px", fontSize: 12, background: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE" }}
                            title="Restock / Tambah Stok"
                          >
                            + Restock
                          </button>
                          <button 
                            className="btn btn-secondary" 
                            onClick={() => {
                              setFormPendukung({
                                id: item.id,
                                nama: item.nama,
                                kategori: item.kategori,
                                tipe: item.tipe || "",
                                warna: item.warna || "",
                                satuan: item.satuan || "Pcs",
                                stok: String(item.stok || 0),
                                harga_beli: String(item.harga_beli || 0),
                                supplier_id: item.supplier_id ? String(item.supplier_id) : "",
                                catatan: item.catatan || ""
                              });
                              setShowFormPendukung(true);
                            }} 
                            style={{ padding: "6px 8px" }}
                            title="Edit"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button 
                            className="btn btn-danger" 
                            onClick={() => handleDeletePendukung(item.id)} 
                            style={{ padding: "6px 8px" }}
                            title="Hapus"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredPendukung.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>
                      Tidak ada item pendukung yang sesuai. Klik <strong>+ Tambah Master Aksesoris</strong> untuk menambahkan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
