"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Warehouse,
  Send,
  CheckCheck,
  ChevronRight,
  RefreshCw,
  Package,
  AlertTriangle,
  Truck,
  Search,
  Clock,
  X,
  ArrowDownToLine,
  History,
  Inbox,
  MessageCircle,
  Workflow,
  Calendar
} from "lucide-react";
import { toast } from "sonner";

// ─── Helpers ────────────────────────────────────────────────────────────
const normalizeStage = (slug?: string) => {
  const s = (slug || "").toLowerCase();
  if (s.includes("wash") || s.includes("cuci")) return "washing";
  if (s.includes("jahit") || s.includes("cmt")) return "cmt";
  if (s.includes("potong")) return "potong";
  if (s.includes("benang")) return "bersih_benang";
  if (s.includes("qc") || s.includes("gudang")) return "gudang";
  if (s.includes("pack") || s.includes("finishing")) return "finishing";
  return s;
};

const FALLBACK_LABEL: Record<string, string> = {
  cmt: "Penjahit (CMT)",
  gudang: "Gudang Produksi",
  washing: "Washing",
  bersih_benang: "Bersih Benang",
  finishing: "Packing / Finishing",
  potong: "Potong",
  siap_jual: "Siap Jual"
};
const FALLBACK_COLOR: Record<string, string> = {
  cmt: "#EF4444",
  gudang: "#6366F1",
  washing: "#F59E0B",
  bersih_benang: "#059669",
  finishing: "#8B5CF6",
  potong: "#3B82F6"
};

const sumQty = (arr?: any[]) => (arr || []).reduce((s, x) => s + Number(x?.jumlah || 0), 0);

function fmtDate(str?: string) {
  if (!str) return "-";
  return new Date(str).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}
function daysSince(str?: string) {
  if (!str) return 0;
  const d = new Date(str); d.setHours(0, 0, 0, 0);
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((t.getTime() - d.getTime()) / 86400000));
}
function daysLate(target?: string) {
  if (!target) return 0;
  const d = new Date(target); d.setHours(0, 0, 0, 0);
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((t.getTime() - d.getTime()) / 86400000));
}
function waLink(phone?: string, text = "") {
  if (!phone) return "";
  let c = String(phone).replace(/[^0-9]/g, "");
  if (c.startsWith("0")) c = "62" + c.slice(1);
  else if (c.startsWith("8")) c = "62" + c;
  return `https://wa.me/${c}?text=${encodeURIComponent(text)}`;
}

type TabKey = "masuk" | "stok" | "vendor" | "riwayat";

export default function GudangProduksiPage() {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [poList, setPoList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("masuk");
  const [search, setSearch] = useState("");

  const [terimaModal, setTerimaModal] = useState<any | null>(null);
  const [terimaForm, setTerimaForm] = useState<{ sizeBreakdown: any[]; catatan: string }>({ sizeBreakdown: [], catatan: "" });
  const [kirimModal, setKirimModal] = useState<any | null>(null);
  const [kirimForm, setKirimForm] = useState<{ ke: string; vendor_id: string; target_selesai: string; catatan: string; sizeBreakdown: any[] }>({ ke: "", vendor_id: "", target_selesai: "", catatan: "", sizeBreakdown: [] });
  const [tarikModal, setTarikModal] = useState<any | null>(null);
  const [tarikForm, setTarikForm] = useState<{ sizeBreakdown: any[]; catatan: string }>({ sizeBreakdown: [], catatan: "" });
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async (silent = true) => {
    if (!silent) setRefreshing(true);
    try {
      const [t, v, s, p] = await Promise.all([
        fetch("/api/produksi-transfer?_t=" + Date.now()).then(r => r.json()).catch(() => []),
        fetch("/api/vendors?_t=" + Date.now()).then(r => r.json()).catch(() => []),
        fetch("/api/pipeline-stages?_t=" + Date.now()).then(r => r.json()).catch(() => []),
        fetch("/api/po-produksi?_t=" + Date.now()).then(r => r.json()).catch(() => [])
      ]);
      setTransfers(Array.isArray(t) ? t : []);
      setVendors(Array.isArray(v) ? v.filter((x: any) => x.aktif !== false) : []);
      setStages(Array.isArray(s) ? s.filter((x: any) => x.aktif).sort((a: any, b: any) => a.urutan - b.urutan) : []);
      setPoList(Array.isArray(p) ? p : []);
    } catch {
      toast.error("Gagal memuat data gudang produksi");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData(true);
    const handler = () => fetchData(true); // silent refresh via SSE, tanpa kedip
    window.addEventListener("konveksi-sync", handler);
    return () => window.removeEventListener("konveksi-sync", handler);
  }, [fetchData]);

  // ─── Stage helpers ───────────────────────────────────────────────────
  const gudangStage = useMemo(() => stages.find(s => normalizeStage(s.slug) === "gudang"), [stages]);
  const gudangSlug = gudangStage?.slug || "gudang";
  const isGudang = (slug?: string) => normalizeStage(slug) === "gudang";

  const stageLabel = (slug?: string) => {
    const st = stages.find(s => s.slug === slug);
    if (st) return st.nama;
    return FALLBACK_LABEL[normalizeStage(slug)] || slug || "-";
  };
  const stageColor = (slug?: string) => {
    const st = stages.find(s => s.slug === slug) || stages.find(s => normalizeStage(s.slug) === normalizeStage(slug));
    return st?.warna || FALLBACK_COLOR[normalizeStage(slug)] || "#64748B";
  };
  const vendorById = (id?: any) => vendors.find(v => String(v.id) === String(id));
  const poById = (id?: any) => poList.find(p => String(p.id) === String(id));

  // Tahap tujuan dari gudang = tahap aktif selain potong, cmt, gudang
  const kirimTargets = useMemo(
    () => stages.filter(s => !["potong", "cmt", "gudang"].includes(normalizeStage(s.slug))),
    [stages]
  );
  const vendorsForStage = (slug: string) => {
    const st = stages.find(s => s.slug === slug);
    const tipe = (st?.vendor_tipe || "").toLowerCase();
    const norm = normalizeStage(slug);
    const list = vendors.filter(v => {
      const vt = (v.tipe || "").toLowerCase();
      return (tipe && vt === tipe) || normalizeStage(vt) === norm;
    });
    return list;
  };

  // ─── Derived lists ───────────────────────────────────────────────────
  const masuk = useMemo(() => transfers.filter(t => isGudang(t.ke) && t.status !== "Diverifikasi"), [transfers, stages]);
  const stok = useMemo(() => transfers.filter(t => isGudang(t.ke) && t.status === "Diverifikasi" && !t.is_forwarded), [transfers, stages]);
  const diVendor = useMemo(
    () => transfers.filter(t =>
      !isGudang(t.ke) &&
      Number(t.jumlah_kirim) > 0 &&
      !t.is_forwarded &&
      !["Diverifikasi", "Ditarik Penuh", "Kembali ke Gudang", "Selesai"].includes(t.status)
    ),
    [transfers, stages]
  );

  const q = search.toLowerCase().trim();
  const matchSearch = (t: any) => {
    if (!q) return true;
    const v = vendorById(t.vendor_id)?.nama || t.vendor_nama || "";
    return [t.noPo, t.model, v, stageLabel(t.dari), stageLabel(t.ke)].join(" ").toLowerCase().includes(q);
  };

  const pcsMasuk = masuk.reduce((s, t) => s + Number(t.jumlah_kirim || 0), 0);
  const pcsStok = stok.reduce((s, t) => s + Number(t.jumlah_diterima ?? t.jumlah_kirim ?? 0), 0);
  const pcsVendor = diVendor.reduce((s, t) => s + Number(t.jumlah_kirim || 0), 0);
  const vendorLateCount = diVendor.filter(t => daysLate(t.target_selesai || poById(t.po_id)?.target_selesai) > 0).length;

  // ─── Actions ─────────────────────────────────────────────────────────
  const openTerima = (t: any) => {
    setTerimaModal(t);
    setTerimaForm({
      sizeBreakdown: (t.sizeBreakdown || []).map((s: any) => ({ size: s.size, dikirim: Number(s.jumlah || 0), jumlah: Number(s.jumlah || 0) })),
      catatan: ""
    });
  };
  const submitTerima = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!terimaModal) return;
    const total = sumQty(terimaForm.sizeBreakdown);
    const fallbackTotal = terimaForm.sizeBreakdown.length === 0 ? Number(terimaModal.jumlah_kirim || 0) : total;
    if (fallbackTotal <= 0) return toast.error("Jumlah diterima harus lebih dari 0");
    setSubmitting(true);
    try {
      const res = await fetch("/api/produksi-transfer", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: terimaModal.id,
          jumlah_diterima: fallbackTotal,
          sizeBreakdown_diterima: terimaForm.sizeBreakdown.map(s => ({ size: s.size, jumlah: Number(s.jumlah || 0) })),
          catatan_terima: terimaForm.catatan
        })
      });
      if (!res.ok) throw new Error("Gagal verifikasi barang");
      toast.success(`${terimaModal.noPo}: ${fallbackTotal} pcs diverifikasi masuk Gudang`);
      setTerimaModal(null);
      fetchData(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openKirim = (t: any) => {
    const first = kirimTargets[0]?.slug || "";
    const d = new Date(); d.setDate(d.getDate() + 7);
    setKirimModal(t);
    setKirimForm({
      ke: first,
      vendor_id: "",
      target_selesai: d.toISOString().split("T")[0],
      catatan: "",
      sizeBreakdown: (t.sizeBreakdown_diterima || t.sizeBreakdown || []).map((s: any) => ({ size: s.size, max: Number(s.jumlah || 0), jumlah: Number(s.jumlah || 0) }))
    });
  };
  const submitKirim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kirimModal || !kirimForm.ke) return toast.error("Pilih tahap tujuan");
    const over = kirimForm.sizeBreakdown.find(s => Number(s.jumlah) > Number(s.max));
    if (over) return toast.error(`Size ${over.size} melebihi stok gudang (${over.max} pcs)`);
    const total = kirimForm.sizeBreakdown.length ? sumQty(kirimForm.sizeBreakdown) : Number(kirimModal.jumlah_diterima || 0);
    if (total <= 0) return toast.error("Masukkan jumlah yang akan dikirim");
    const st = stages.find(s => s.slug === kirimForm.ke);
    if (st?.butuh_vendor && !kirimForm.vendor_id) return toast.error(`Tahap ${st.nama} wajib memilih vendor`);
    setSubmitting(true);
    try {
      const res = await fetch("/api/produksi-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          po_id: kirimModal.po_id,
          dari: gudangSlug,
          ke: kirimForm.ke,
          vendor_id: kirimForm.vendor_id || null,
          target_selesai: kirimForm.target_selesai || null,
          jumlah_kirim: total,
          sizeBreakdown: kirimForm.sizeBreakdown.filter(s => Number(s.jumlah) > 0).map(s => ({ size: s.size, jumlah: Number(s.jumlah) })),
          catatan: kirimForm.catatan,
          transfer_id_asal: kirimModal.id
        })
      });
      if (!res.ok) throw new Error("Gagal mengirim barang");
      toast.success(`${total} pcs dikirim ke ${stageLabel(kirimForm.ke)}`);
      setKirimModal(null);
      fetchData(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openTarik = (t: any) => {
    setTarikModal(t);
    setTarikForm({
      sizeBreakdown: (t.sizeBreakdown || []).map((s: any) => ({ size: s.size, max: Number(s.jumlah || 0), jumlah: Number(s.jumlah || 0) })),
      catatan: ""
    });
  };
  const submitTarik = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tarikModal) return;
    const over = tarikForm.sizeBreakdown.find(s => Number(s.jumlah) > Number(s.max));
    if (over) return toast.error(`Size ${over.size} melebihi jumlah di vendor (${over.max} pcs)`);
    const total = tarikForm.sizeBreakdown.length ? sumQty(tarikForm.sizeBreakdown) : Number(tarikModal.jumlah_kirim || 0);
    if (total <= 0) return toast.error("Jumlah tarik harus lebih dari 0");
    setSubmitting(true);
    try {
      const res = await fetch("/api/produksi-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          po_id: tarikModal.po_id,
          dari: tarikModal.ke,
          ke: gudangSlug,
          vendor_id: tarikModal.vendor_id || null,
          jumlah_kirim: total,
          sizeBreakdown: tarikForm.sizeBreakdown.filter(s => Number(s.jumlah) > 0).map(s => ({ size: s.size, jumlah: Number(s.jumlah) })),
          catatan: tarikForm.catatan || `Ditarik dari ${vendorById(tarikModal.vendor_id)?.nama || stageLabel(tarikModal.ke)}`,
          transfer_id_asal: tarikModal.id
        })
      });
      if (!res.ok) throw new Error("Gagal menarik barang");
      toast.success(`${total} pcs ditarik ke Gudang — silakan verifikasi di tab Barang Masuk`);
      setTarikModal(null);
      setActiveTab("masuk");
      fetchData(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── UI primitives ───────────────────────────────────────────────────
  const StageChip = ({ slug }: { slug?: string }) => {
    const c = stageColor(slug);
    return (
      <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 800, background: c + "15", color: c, border: `1px solid ${c}40`, whiteSpace: "nowrap" }}>
        {stageLabel(slug)}
      </span>
    );
  };
  const SizeChips = ({ list, tone = "#334155" }: { list?: any[]; tone?: string }) =>
    list && list.length > 0 ? (
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
        {list.map((s: any, i: number) => (
          <span key={i} style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", color: tone, padding: "3px 9px", borderRadius: 6, fontSize: 11.5, fontWeight: 800 }}>
            {s.size}: {s.jumlah}
          </span>
        ))}
      </div>
    ) : null;
  const Empty = ({ icon: Icon, title, sub }: any) => (
    <div style={{ textAlign: "center", padding: "56px 24px", background: "#FFFFFF", borderRadius: 16, border: "1.5px dashed #E2E8F0" }}>
      <Icon size={36} color="#CBD5E1" style={{ margin: "0 auto 10px", display: "block" }} />
      <div style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>{title}</div>
      {sub && <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 4 }}>{sub}</div>}
    </div>
  );
  const cardStyle: React.CSSProperties = { background: "#FFFFFF", borderRadius: 16, border: "1px solid #E2E8F0", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden", display: "flex", flexDirection: "column" };
  const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #CBD5E1", fontSize: 13.5, outline: "none", background: "#FFFFFF", color: "#0F172A", boxSizing: "border-box" };
  const labelStyle: React.CSSProperties = { display: "block", fontSize: 12.5, fontWeight: 800, color: "#334155", marginBottom: 8 };

  if (loading) {
    return (
      <div style={{ background: "#F1F5F9", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <RefreshCw size={22} color="#2563EB" style={{ animation: "spin 1s linear infinite" }} />
        <div style={{ color: "#475569", fontSize: 14, fontWeight: 700 }}>Memuat data gudang produksi...</div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const TABS: { key: TabKey; label: string; icon: any; count: number; color: string }[] = [
    { key: "masuk", label: "Barang Masuk", icon: Inbox, count: masuk.length, color: "#DC2626" },
    { key: "stok", label: "Stok Gudang & Kirim", icon: Package, count: stok.length, color: "#059669" },
    { key: "vendor", label: "Di Vendor / Proses Luar", icon: Truck, count: diVendor.length, color: "#D97706" },
    { key: "riwayat", label: "Semua Riwayat", icon: History, count: transfers.length, color: "#64748B" }
  ];

  const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 360px), 1fr))", gap: 16 };

  return (
    <div style={{ padding: "28px 32px 48px 32px", background: "#F1F5F9", minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .gp-card { transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
        .gp-card:hover { transform: translateY(-3px); box-shadow: 0 10px 24px rgba(0,0,0,0.08) !important; }
        .gp-tab:hover { background: #F1F5F9 !important; }
      `}</style>

      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14, marginBottom: 18 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: "linear-gradient(135deg, #4338CA 0%, #6366F1 100%)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(99,102,241,0.3)" }}>
              <Warehouse size={20} color="#FFFFFF" />
            </div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#0F172A", letterSpacing: "-0.02em" }}>Gudang Produksi</h1>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#4338CA", background: "#EEF2FF", border: "1px solid #C7D2FE", padding: "2px 8px", borderRadius: 6 }}>
              Real-Time
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "#64748B" }}>
            Pusat penerimaan, verifikasi stok, dan pengiriman barang antar tahap produksi (Washing, Bersih Benang, Packing).
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/alur-produksi" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: "1px solid #CBD5E1", background: "#FFFFFF", color: "#475569", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>
            <Workflow size={14} /> Alur Produksi
          </Link>
          <Link href="/dashboard-cmt" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: "1px solid #CBD5E1", background: "#FFFFFF", color: "#475569", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>
            <Truck size={14} /> Dashboard CMT
          </Link>
          <button onClick={() => fetchData(false)} disabled={refreshing} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 18px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #1E40AF 0%, #2563EB 100%)", color: "#FFFFFF", fontSize: 13, fontWeight: 800, cursor: "pointer", boxShadow: "0 2px 8px rgba(37,99,235,0.25)", opacity: refreshing ? 0.7 : 1 }}>
            <RefreshCw size={15} style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 20 }}>
        {[
          { key: "masuk", label: "Perlu Verifikasi", value: masuk.length, unit: "transfer", sub: `${pcsMasuk.toLocaleString("id-ID")} pcs menunggu dicek`, color: "#DC2626", bg: "#FEF2F2", icon: Inbox },
          { key: "stok", label: "Stok di Gudang", value: pcsStok, unit: "pcs", sub: `${stok.length} lot siap dikirim`, color: "#059669", bg: "#ECFDF5", icon: Package },
          { key: "vendor", label: "Di Vendor Luar", value: pcsVendor, unit: "pcs", sub: vendorLateCount > 0 ? `${vendorLateCount} pengiriman lewat target` : `${diVendor.length} pengiriman aktif`, color: "#D97706", bg: "#FFFBEB", icon: Truck },
          { key: "riwayat", label: "Total Transfer", value: transfers.length, unit: "riwayat", sub: "Seluruh perpindahan barang", color: "#4338CA", bg: "#EEF2FF", icon: History }
        ].map(k => (
          <button key={k.key} onClick={() => setActiveTab(k.key as TabKey)} className="gp-card" style={{ textAlign: "left", background: "#FFFFFF", borderRadius: 14, padding: "16px 20px", border: activeTab === k.key ? `1.5px solid ${k.color}` : "1px solid #E2E8F0", boxShadow: "0 2px 6px rgba(0,0,0,0.02)", cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>{k.label}</span>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: k.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <k.icon size={15} color={k.color} />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: k.color }}>
              {k.value.toLocaleString("id-ID")} <span style={{ fontSize: 12, fontWeight: 700, color: "#94A3B8" }}>{k.unit}</span>
            </div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: k.key === "vendor" && vendorLateCount > 0 ? "#DC2626" : "#64748B", marginTop: 2 }}>{k.sub}</div>
          </button>
        ))}
      </div>

      {/* TABS + SEARCH */}
      <div style={{ background: "#FFFFFF", borderRadius: 14, border: "1px solid #E2E8F0", padding: 10, marginBottom: 18, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {TABS.map(t => {
            const active = activeTab === t.key;
            return (
              <button key={t.key} className={active ? "" : "gp-tab"} onClick={() => setActiveTab(t.key)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 10, border: active ? "1px solid #BFDBFE" : "1px solid transparent", background: active ? "#EFF6FF" : "transparent", color: active ? "#1D4ED8" : "#475569", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>
                <t.icon size={14} />
                {t.label}
                <span style={{ minWidth: 20, height: 20, padding: "0 6px", borderRadius: 10, fontSize: 10.5, fontWeight: 900, display: "inline-flex", alignItems: "center", justifyContent: "center", background: t.count > 0 && t.key !== "riwayat" ? t.color : "#E2E8F0", color: t.count > 0 && t.key !== "riwayat" ? "#FFFFFF" : "#64748B" }}>
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>
        <div style={{ position: "relative", flex: "1 1 240px", maxWidth: 340 }}>
          <Search size={15} color="#94A3B8" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari No PO, model, vendor..." style={{ ...inputStyle, paddingLeft: 36 }} />
        </div>
      </div>

      {/* TAB: BARANG MASUK */}
      {activeTab === "masuk" && (
        masuk.filter(matchSearch).length === 0 ? (
          <Empty icon={CheckCheck} title="Tidak ada barang masuk yang perlu diverifikasi" sub={diVendor.length > 0 ? `Ada ${diVendor.length} pengiriman di vendor luar — tarik ke gudang dari tab "Di Vendor / Proses Luar".` : "Semua barang yang masuk sudah diverifikasi."} />
        ) : (
          <div style={gridStyle}>
            {masuk.filter(matchSearch).map(t => (
              <div key={t.id} className="gp-card" style={{ ...cardStyle, border: "1.5px solid #FECACA" }}>
                <div style={{ background: "linear-gradient(90deg, #991B1B 0%, #DC2626 100%)", color: "#FFFFFF", padding: "7px 16px", fontSize: 11, fontWeight: 800, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}><AlertTriangle size={13} /> MENUNGGU VERIFIKASI GUDANG</span>
                  <span style={{ opacity: 0.9 }}>{daysSince(t.tanggal_kirim)} hari</span>
                </div>
                <div style={{ padding: "16px 18px", flex: 1, display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                    <StageChip slug={t.dari} /> <ChevronRight size={14} color="#94A3B8" /> <StageChip slug={t.ke} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 900, fontFamily: "monospace", color: "#1D4ED8", background: "#EFF6FF", border: "1px solid #BFDBFE", padding: "2px 8px", borderRadius: 6 }}>{t.noPo}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{t.model}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#64748B", marginTop: 6 }}>
                    Dikirim {fmtDate(t.tanggal_kirim)} · <b style={{ color: "#D97706" }}>{Number(t.jumlah_kirim).toLocaleString("id-ID")} pcs</b>
                    {t.catatan ? <> · <i>{t.catatan}</i></> : null}
                  </div>
                  <SizeChips list={t.sizeBreakdown} />
                  <div style={{ marginTop: "auto", paddingTop: 14, borderTop: "1px solid #F1F5F9", display: "flex", justifyContent: "flex-end" }}>
                    <button onClick={() => openTerima(t)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #047857 0%, #10B981 100%)", color: "#FFFFFF", fontSize: 12.5, fontWeight: 800, cursor: "pointer", boxShadow: "0 2px 6px rgba(16,185,129,0.25)" }}>
                      <CheckCheck size={14} /> Verifikasi Terima
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* TAB: STOK GUDANG */}
      {activeTab === "stok" && (
        stok.filter(matchSearch).length === 0 ? (
          <Empty icon={Package} title="Belum ada stok di gudang yang siap dikirim" sub="Verifikasi barang masuk terlebih dahulu, lalu kirim ke tahap berikutnya dari sini." />
        ) : (
          <div style={gridStyle}>
            {stok.filter(matchSearch).map(t => {
              const qty = Number(t.jumlah_diterima ?? t.jumlah_kirim ?? 0);
              const selisih = Number(t.jumlah_kirim || 0) - qty;
              return (
                <div key={t.id} className="gp-card" style={cardStyle}>
                  <div style={{ height: 4, background: "#10B981" }} />
                  <div style={{ padding: "16px 18px", flex: 1, display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 15, fontWeight: 900, fontFamily: "monospace", color: "#1D4ED8", background: "#EFF6FF", border: "1px solid #BFDBFE", padding: "2px 8px", borderRadius: 6 }}>{t.noPo}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{t.model}</span>
                        </div>
                        <div style={{ fontSize: 12, color: "#64748B", marginTop: 6 }}>
                          Asal: <b>{stageLabel(t.dari)}</b> · Diterima {fmtDate(t.tanggal_terima)}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color: "#059669", lineHeight: 1 }}>{qty.toLocaleString("id-ID")}</div>
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: "#94A3B8" }}>pcs di gudang</div>
                      </div>
                    </div>
                    {selisih !== 0 && (
                      <div style={{ marginTop: 10, fontSize: 11.5, fontWeight: 700, color: selisih > 0 ? "#B91C1C" : "#1D4ED8", background: selisih > 0 ? "#FEF2F2" : "#EFF6FF", border: `1px solid ${selisih > 0 ? "#FECACA" : "#BFDBFE"}`, padding: "6px 10px", borderRadius: 8 }}>
                        {selisih > 0 ? `Kurang ${selisih} pcs dari jumlah kiriman (${t.jumlah_kirim} pcs)` : `Lebih ${Math.abs(selisih)} pcs dari jumlah kiriman`}
                      </div>
                    )}
                    <SizeChips list={t.sizeBreakdown_diterima || t.sizeBreakdown} tone="#047857" />
                    {t.catatan_terima && <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 8 }}>Catatan: {t.catatan_terima}</div>}
                    <div style={{ marginTop: "auto", paddingTop: 14, borderTop: "1px solid #F1F5F9", display: "flex", justifyContent: "flex-end" }}>
                      <button onClick={() => openKirim(t)} disabled={kirimTargets.length === 0} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #1E40AF 0%, #2563EB 100%)", color: "#FFFFFF", fontSize: 12.5, fontWeight: 800, cursor: "pointer", boxShadow: "0 2px 6px rgba(37,99,235,0.2)" }}>
                        <Send size={13} /> Kirim ke Tahap Berikutnya
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* TAB: DI VENDOR */}
      {activeTab === "vendor" && (
        diVendor.filter(matchSearch).length === 0 ? (
          <Empty icon={Truck} title="Tidak ada barang yang sedang berada di vendor luar" sub="Barang yang dikirim ke Washing / Bersih Benang / Packing akan tampil di sini." />
        ) : (
          <div style={gridStyle}>
            {diVendor.filter(matchSearch).map(t => {
              const v = vendorById(t.vendor_id);
              const target = t.target_selesai || poById(t.po_id)?.target_selesai;
              const late = daysLate(target);
              const lama = daysSince(t.tanggal_kirim);
              return (
                <div key={t.id} className="gp-card" style={{ ...cardStyle, border: late > 0 ? "1.5px solid #FECACA" : "1px solid #E2E8F0" }}>
                  {target ? (
                    late > 0 ? (
                      <div style={{ background: "linear-gradient(90deg, #991B1B 0%, #DC2626 100%)", color: "#FFFFFF", padding: "7px 16px", fontSize: 11, fontWeight: 800, display: "flex", justifyContent: "space-between" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><AlertTriangle size={13} /> MELEBIHI TARGET ({late} HARI)</span>
                        <span style={{ opacity: 0.9 }}>Target {fmtDate(target)}</span>
                      </div>
                    ) : (
                      <div style={{ background: "#F0FDF4", borderBottom: "1px solid #BBF7D0", color: "#166534", padding: "7px 16px", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                        <Calendar size={13} /> Target selesai {fmtDate(target)}
                      </div>
                    )
                  ) : null}
                  <div style={{ padding: "16px 18px", flex: 1, display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 15, fontWeight: 900, fontFamily: "monospace", color: "#1D4ED8", background: "#EFF6FF", border: "1px solid #BFDBFE", padding: "2px 8px", borderRadius: 6 }}>{t.noPo}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{t.model}</span>
                        </div>
                        <StageChip slug={t.ke} />
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color: "#D97706", lineHeight: 1 }}>{Number(t.jumlah_kirim).toLocaleString("id-ID")}</div>
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: "#94A3B8" }}>pcs di vendor</div>
                      </div>
                    </div>

                    <div style={{ marginTop: 12, background: "#0F172A", borderRadius: 12, padding: "10px 12px", color: "#F8FAFC", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 900 }}>{v?.nama || t.vendor_nama || "Tanpa vendor"}</div>
                        <div style={{ fontSize: 10.5, color: "#94A3B8", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                          <Clock size={11} /> Dikirim {fmtDate(t.tanggal_kirim)} · {lama} hari di vendor · Status: {t.status}
                        </div>
                      </div>
                      {v?.kontak && (
                        <a href={waLink(v.kontak, `Halo ${v.nama}, kami dari Gudang Produksi ingin menanyakan progres ${t.noPo} (${t.model}) sebanyak ${t.jumlah_kirim} pcs yang dikirim ${fmtDate(t.tanggal_kirim)}${late > 0 ? ` — sudah lewat target ${late} hari` : ""}. Kapan bisa kami tarik kembali ke gudang? Terima kasih.`)} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 9px", borderRadius: 6, background: "#065F46", border: "1px solid #059669", color: "#A7F3D0", fontSize: 11, fontWeight: 800, textDecoration: "none" }}>
                          <MessageCircle size={12} /> WA Tagih
                        </a>
                      )}
                    </div>

                    <SizeChips list={t.sizeBreakdown} />

                    <div style={{ marginTop: "auto", paddingTop: 14, borderTop: "1px solid #F1F5F9", display: "flex", justifyContent: "flex-end" }}>
                      <button onClick={() => openTarik(t)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #B45309 0%, #F59E0B 100%)", color: "#FFFFFF", fontSize: 12.5, fontWeight: 800, cursor: "pointer", boxShadow: "0 2px 6px rgba(245,158,11,0.25)" }}>
                        <ArrowDownToLine size={14} /> Tarik ke Gudang
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* TAB: RIWAYAT */}
      {activeTab === "riwayat" && (
        transfers.filter(matchSearch).length === 0 ? (
          <Empty icon={History} title="Belum ada riwayat transfer" />
        ) : (
          <div style={{ background: "#FFFFFF", borderRadius: 14, border: "1px solid #E2E8F0", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
                <thead>
                  <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                    {["Tanggal", "No PO", "Alur", "Vendor", "Jumlah", "Status"].map(h => (
                      <th key={h} style={{ padding: "11px 16px", textAlign: h === "Jumlah" ? "right" : "left", fontSize: 11.5, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.03em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transfers.filter(matchSearch).map(t => {
                    const st = t.status || "-";
                    const sc = st === "Diverifikasi" ? ["#ECFDF5", "#047857"] : st === "Kirim" ? ["#FFFBEB", "#B45309"] : st === "Kembali ke Gudang" ? ["#EEF2FF", "#4338CA"] : st === "Ditarik Penuh" ? ["#F1F5F9", "#64748B"] : ["#EFF6FF", "#1D4ED8"];
                    return (
                      <tr key={t.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                        <td style={{ padding: "12px 16px", fontSize: 12.5, color: "#475569", whiteSpace: "nowrap" }}>{fmtDate(t.tanggal_kirim)}</td>
                        <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 800, color: "#0F172A", whiteSpace: "nowrap" }}>{t.noPo} <span style={{ fontWeight: 600, color: "#94A3B8" }}>· {t.model}</span></td>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}><StageChip slug={t.dari} /><ChevronRight size={13} color="#94A3B8" /><StageChip slug={t.ke} /></div>
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: 12.5, color: "#334155" }}>{vendorById(t.vendor_id)?.nama || (t.vendor_nama !== "-" ? t.vendor_nama : "—")}</td>
                        <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 900, color: "#0F172A", textAlign: "right", whiteSpace: "nowrap" }}>
                          {Number(t.jumlah_kirim || 0).toLocaleString("id-ID")} pcs
                          {t.jumlah_diterima != null && Number(t.jumlah_diterima) !== Number(t.jumlah_kirim) && (
                            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#059669" }}>diterima {t.jumlah_diterima}</div>
                          )}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 800, background: sc[0], color: sc[1], whiteSpace: "nowrap" }}>{st}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* ─── MODAL: VERIFIKASI TERIMA ─── */}
      {terimaModal && (
        <Modal title="Verifikasi Terima Barang" subtitle={`${terimaModal.noPo} · ${terimaModal.model} · dari ${stageLabel(terimaModal.dari)}`} icon={CheckCheck} color="#059669" onClose={() => setTerimaModal(null)}>
          <form onSubmit={submitTerima} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={labelStyle}>Jumlah fisik yang diterima per size</label>
              {terimaForm.sizeBreakdown.length === 0 ? (
                <div style={{ fontSize: 12.5, color: "#64748B", background: "#F8FAFC", padding: 12, borderRadius: 10 }}>Tidak ada rincian size — akan dicatat {terimaModal.jumlah_kirim} pcs.</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
                  {terimaForm.sizeBreakdown.map((s, idx) => {
                    const diff = Number(s.jumlah || 0) - Number(s.dikirim || 0);
                    return (
                      <div key={s.size} style={{ border: `1px solid ${diff !== 0 ? "#FCA5A5" : "#E2E8F0"}`, borderRadius: 10, padding: 10, background: "#F8FAFC" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 900, color: "#0F172A", marginBottom: 6 }}>
                          <span>{s.size}</span><span style={{ color: "#94A3B8", fontWeight: 700 }}>kirim {s.dikirim}</span>
                        </div>
                        <input type="number" min={0} value={s.jumlah} onChange={e => { const f = [...terimaForm.sizeBreakdown]; f[idx] = { ...f[idx], jumlah: e.target.value === "" ? "" : Number(e.target.value) }; setTerimaForm({ ...terimaForm, sizeBreakdown: f }); }} style={{ ...inputStyle, fontWeight: 800, fontSize: 15 }} />
                        {diff !== 0 && <div style={{ fontSize: 10.5, fontWeight: 800, color: "#DC2626", marginTop: 4 }}>{diff > 0 ? `+${diff}` : diff} selisih</div>}
                      </div>
                    );
                  })}
                </div>
              )}
              <div style={{ marginTop: 10, fontSize: 12.5, fontWeight: 800, color: "#0F172A" }}>
                Total diterima: {(terimaForm.sizeBreakdown.length ? sumQty(terimaForm.sizeBreakdown) : terimaModal.jumlah_kirim).toLocaleString("id-ID")} / {Number(terimaModal.jumlah_kirim).toLocaleString("id-ID")} pcs
              </div>
            </div>
            <div>
              <label style={labelStyle}>Catatan</label>
              <input value={terimaForm.catatan} onChange={e => setTerimaForm({ ...terimaForm, catatan: e.target.value })} placeholder="Opsional, mis. 2 pcs cacat jahitan" style={inputStyle} />
            </div>
            <ModalActions onCancel={() => setTerimaModal(null)} submitting={submitting} label="Konfirmasi Diterima" color="#10B981" />
          </form>
        </Modal>
      )}

      {/* ─── MODAL: KIRIM KE TAHAP ─── */}
      {kirimModal && (
        <Modal title="Kirim ke Tahap Produksi" subtitle={`${kirimModal.noPo} · ${kirimModal.model} · stok ${kirimModal.jumlah_diterima ?? kirimModal.jumlah_kirim} pcs`} icon={Send} color="#2563EB" onClose={() => setKirimModal(null)}>
          <form onSubmit={submitKirim} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={labelStyle}>Tahap tujuan</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {kirimTargets.map(st => {
                  const active = kirimForm.ke === st.slug;
                  return (
                    <button key={st.slug} type="button" onClick={() => setKirimForm({ ...kirimForm, ke: st.slug, vendor_id: "" })} style={{ padding: "8px 14px", borderRadius: 10, border: `1.5px solid ${active ? st.warna : "#E2E8F0"}`, background: active ? st.warna + "15" : "#FFFFFF", color: active ? st.warna : "#475569", fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}>
                      {st.nama}
                    </button>
                  );
                })}
              </div>
            </div>
            {kirimForm.ke && (() => {
              const st = stages.find(s => s.slug === kirimForm.ke);
              const list = vendorsForStage(kirimForm.ke);
              return (
                <div>
                  <label style={labelStyle}>Vendor / Tim {st?.butuh_vendor ? <span style={{ color: "#DC2626" }}>*</span> : <span style={{ color: "#94A3B8", fontWeight: 600 }}>(opsional)</span>}</label>
                  <select value={kirimForm.vendor_id} onChange={e => setKirimForm({ ...kirimForm, vendor_id: e.target.value })} style={inputStyle}>
                    <option value="">— Pilih vendor —</option>
                    {(list.length ? list : vendors).map(v => {
                      const aktif = diVendor.filter(t => String(t.vendor_id) === String(v.id));
                      const pcs = aktif.reduce((s, t) => s + Number(t.jumlah_kirim || 0), 0);
                      return <option key={v.id} value={v.id}>{v.nama}{pcs > 0 ? ` — masih memegang ${pcs} pcs` : " — kosong"}</option>;
                    })}
                  </select>
                  {list.length === 0 && <div style={{ fontSize: 11.5, color: "#B45309", marginTop: 6 }}>Belum ada vendor bertipe "{st?.vendor_tipe || "-"}", menampilkan semua vendor.</div>}
                </div>
              );
            })()}
            <div>
              <label style={labelStyle}>Target selesai</label>
              <input type="date" value={kirimForm.target_selesai} onChange={e => setKirimForm({ ...kirimForm, target_selesai: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Jumlah dikirim per size</label>
              {kirimForm.sizeBreakdown.length === 0 ? (
                <div style={{ fontSize: 12.5, color: "#64748B", background: "#F8FAFC", padding: 12, borderRadius: 10 }}>Tidak ada rincian size — seluruh stok akan dikirim.</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8 }}>
                  {kirimForm.sizeBreakdown.map((s, idx) => (
                    <div key={s.size} style={{ border: `1px solid ${Number(s.jumlah) > Number(s.max) ? "#FCA5A5" : "#E2E8F0"}`, borderRadius: 10, padding: 10, background: "#F8FAFC" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 900, color: "#0F172A", marginBottom: 6 }}>
                        <span>{s.size}</span><span style={{ color: "#94A3B8", fontWeight: 700 }}>maks {s.max}</span>
                      </div>
                      <input type="number" min={0} max={s.max} value={s.jumlah} onChange={e => { const f = [...kirimForm.sizeBreakdown]; f[idx] = { ...f[idx], jumlah: e.target.value === "" ? "" : Number(e.target.value) }; setKirimForm({ ...kirimForm, sizeBreakdown: f }); }} style={{ ...inputStyle, fontWeight: 800, fontSize: 15 }} />
                    </div>
                  ))}
                </div>
              )}
              {kirimForm.sizeBreakdown.length > 0 && <div style={{ marginTop: 10, fontSize: 12.5, fontWeight: 800, color: "#0F172A" }}>Total kirim: {sumQty(kirimForm.sizeBreakdown).toLocaleString("id-ID")} pcs</div>}
            </div>
            <div>
              <label style={labelStyle}>Catatan</label>
              <input value={kirimForm.catatan} onChange={e => setKirimForm({ ...kirimForm, catatan: e.target.value })} placeholder="Opsional" style={inputStyle} />
            </div>
            <ModalActions onCancel={() => setKirimModal(null)} submitting={submitting} label="Kirim Sekarang" color="#2563EB" />
          </form>
        </Modal>
      )}

      {/* ─── MODAL: TARIK KE GUDANG ─── */}
      {tarikModal && (
        <Modal title="Tarik Barang ke Gudang" subtitle={`${tarikModal.noPo} · dari ${vendorById(tarikModal.vendor_id)?.nama || stageLabel(tarikModal.ke)} · ${tarikModal.jumlah_kirim} pcs`} icon={ArrowDownToLine} color="#D97706" onClose={() => setTarikModal(null)}>
          <form onSubmit={submitTarik} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 12.5, color: "#92400E", background: "#FFFBEB", border: "1px solid #FDE68A", padding: "10px 12px", borderRadius: 10 }}>
              Barang yang ditarik akan masuk ke tab <b>Barang Masuk</b> dan perlu diverifikasi jumlah fisiknya sebelum menjadi stok gudang.
            </div>
            <div>
              <label style={labelStyle}>Jumlah ditarik per size</label>
              {tarikForm.sizeBreakdown.length === 0 ? (
                <div style={{ fontSize: 12.5, color: "#64748B", background: "#F8FAFC", padding: 12, borderRadius: 10 }}>Tidak ada rincian size — seluruh {tarikModal.jumlah_kirim} pcs akan ditarik.</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8 }}>
                  {tarikForm.sizeBreakdown.map((s, idx) => (
                    <div key={s.size} style={{ border: `1px solid ${Number(s.jumlah) > Number(s.max) ? "#FCA5A5" : "#E2E8F0"}`, borderRadius: 10, padding: 10, background: "#F8FAFC" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 900, color: "#0F172A", marginBottom: 6 }}>
                        <span>{s.size}</span><span style={{ color: "#94A3B8", fontWeight: 700 }}>maks {s.max}</span>
                      </div>
                      <input type="number" min={0} max={s.max} value={s.jumlah} onChange={e => { const f = [...tarikForm.sizeBreakdown]; f[idx] = { ...f[idx], jumlah: e.target.value === "" ? "" : Number(e.target.value) }; setTarikForm({ ...tarikForm, sizeBreakdown: f }); }} style={{ ...inputStyle, fontWeight: 800, fontSize: 15 }} />
                    </div>
                  ))}
                </div>
              )}
              {tarikForm.sizeBreakdown.length > 0 && <div style={{ marginTop: 10, fontSize: 12.5, fontWeight: 800, color: "#0F172A" }}>Total tarik: {sumQty(tarikForm.sizeBreakdown).toLocaleString("id-ID")} pcs</div>}
            </div>
            <div>
              <label style={labelStyle}>Catatan</label>
              <input value={tarikForm.catatan} onChange={e => setTarikForm({ ...tarikForm, catatan: e.target.value })} placeholder="Opsional" style={inputStyle} />
            </div>
            <ModalActions onCancel={() => setTarikModal(null)} submitting={submitting} label="Tarik ke Gudang" color="#D97706" />
          </form>
        </Modal>
      )}
    </div>
  );
}

// ─── Shared modal shell (konsisten dengan modal Alur Produksi) ───────────
function Modal({ title, subtitle, icon: Icon, color, onClose, children }: any) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
      <div style={{ background: "#FFFFFF", width: "100%", maxWidth: 600, maxHeight: "92vh", borderRadius: 16, overflow: "hidden", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 22px", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: color + "15", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon size={17} color={color} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ fontSize: 15, fontWeight: 900, color: "#0F172A", margin: 0 }}>{title}</h3>
              <div style={{ fontSize: 12, color: "#64748B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{subtitle}</div>
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: 22, overflowY: "auto" }}>{children}</div>
      </div>
    </div>
  );
}

function ModalActions({ onCancel, submitting, label, color }: any) {
  return (
    <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
      <button type="button" onClick={onCancel} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "1px solid #CBD5E1", background: "#FFFFFF", color: "#475569", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
        Batal
      </button>
      <button type="submit" disabled={submitting} style={{ flex: 2, padding: "11px", borderRadius: 10, border: "none", background: color, color: "#FFFFFF", fontWeight: 800, fontSize: 13, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}>
        {submitting ? "Menyimpan..." : label}
      </button>
    </div>
  );
}
