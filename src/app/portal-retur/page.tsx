"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import {
  ScanLine,
  CheckCircle2,
  AlertTriangle,
  PackageCheck,
  PackageX,
  User,
  Truck,
  MapPin,
  Volume2,
  VolumeX,
  Users,
  Radio,
  Search,
  Clock,
  ShieldAlert,
  ArrowRight,
  RotateCcw,
  Sparkles,
  ExternalLink,
  Info,
  Calendar,
  Layers,
  Scale,
  Hash,
  Camera,
} from "lucide-react";
import { toast } from "sonner";
import { compressImageFile } from "@/components/ReturMarketplacePanel";
import {
  subscribeRealtime,
  subscribeRealtimeEvent,
  subscribeRealtimeStatus,
  subscribePresence,
  setPresence,
  type RealtimeStatus,
  type PresenceEntry,
} from "@/lib/realtime-client";

const JENIS_MASALAH = [
  "Rusak / Cacat",
  "Barang tertukar / bukan milik kita",
  "Bekas pakai / kotor / bau",
  "Tidak lengkap / kurang",
  "Paket kosong",
  "Lainnya",
];

const rp = (n: number) => `Rp ${Number(n || 0).toLocaleString("id-ID")}`;
const tgl = (s?: string | null) =>
  s
    ? new Date(s).toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

// Synthesizer Web Audio API bebas unduhan untuk feedback instan scanner
function playScanSound(type: "success" | "error" | "warning") {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "success") {
      // Dua nada ceria (D5 -> A5)
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.28);
    } else if (type === "error") {
      // Suara buzzer tajam peringatan ganda
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      osc.frequency.setValueAtTime(110, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.45);
    } else {
      osc.type = "square";
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    }
  } catch {}
}

export default function PortalReturPage() {
  const [tab, setTab] = useState<"scan" | "belum_selesai" | "sudah_selesai">("scan");
  const [petugas, setPetugas] = useState<string>("Staf Gudang Retur");
  const [isEditingPetugas, setIsEditingPetugas] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Real-time Connection State
  const [rtStatus, setRtStatus] = useState<RealtimeStatus>("connecting");
  const [activeOfficers, setActiveOfficers] = useState<PresenceEntry[]>([]);

  // Data Retur
  const [data, setData] = useState<{
    list: any[];
    summary: any;
    belum_terselesaikan: { total: number; paket_pending: any[]; banding_pending: any[] };
    sudah_terselesaikan: { total: number; items: any[] };
    active_locks?: any[];
  }>({
    list: [],
    summary: null,
    belum_terselesaikan: { total: 0, paket_pending: [], banding_pending: [] },
    sudah_terselesaikan: { total: 0, items: [] },
  });
  const [loading, setLoading] = useState(true);

  // Scanner State
  const [mode, setMode] = useState<"barcode" | "order">("barcode");
  const [code, setCode] = useState("");
  const [orderQ, setOrderQ] = useState("");
  const [info, setInfo] = useState<any | null>(null);
  const [order, setOrder] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [isDoubleScanErr, setIsDoubleScanErr] = useState(false);
  const [kondisi, setKondisi] = useState<"sesuai" | "tidak_sesuai" | null>(null);
  const [jenis, setJenis] = useState(JENIS_MASALAH[0]);
  const [catatan, setCatatan] = useState("");
  const [klaim, setKlaim] = useState("");
  const [resiRetur, setResiRetur] = useState("");
  const [buktiFoto, setBuktiFoto] = useState<string | null>(null);
  const [linkBukti, setLinkBukti] = useState("");
  const [saving, setSaving] = useState(false);

  // Search filter for tables
  const [searchQuery, setSearchQuery] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);

  // Load Saved Staff Name
  useEffect(() => {
    const saved = localStorage.getItem("kv_retur_petugas");
    if (saved) setPetugas(saved);
    else {
      // Ambil dari sesi jika ada
      fetch("/api/auth/me", { cache: "no-store" })
        .then((r) => r.json())
        .then((u) => {
          const nama = u?.session?.nama || u?.nama;
          if (nama) {
            setPetugas(nama);
            localStorage.setItem("kv_retur_petugas", nama);
          }
        })
        .catch(() => {});
    }
  }, []);

  const savePetugasName = (name: string) => {
    const n = name.trim() || "Staf Gudang Retur";
    setPetugas(n);
    localStorage.setItem("kv_retur_petugas", n);
    setIsEditingPetugas(false);
    toast.success(`Identitas petugas diubah ke: ${n}`);
  };

  // Fetch Data
  const fetchData = async () => {
    try {
      const res = await fetch(`/api/retur-marketplace?_t=${Date.now()}`);
      const json = await res.json();
      if (res.ok) {
        setData(json);
      }
    } catch {
      toast.error("Gagal memuat data retur real-time");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Presence & WebSocket Subscription
  useEffect(() => {
    const unStatus = subscribeRealtimeStatus((s) => setRtStatus(s));

    // Umumkan kehadiran petugas di Portal Retur
    const presKey = `portal_retur_${petugas.replace(/\s+/g, "_").toLowerCase()}`;
    setPresence(presKey, {
      key: presKey,
      name: petugas,
      role: "admin",
      action: "retur_scan",
      label: "Gudang Retur Online",
    });

    const unPresence = subscribePresence((list) => {
      const returStaff = (list || []).filter((p) => p.action === "retur_scan" || p.key?.startsWith("portal_retur"));
      setActiveOfficers(returStaff);
    });

    // Dengarkan event dataChanged (sinkronisasi serempak)
    const unSync = subscribeRealtime(() => {
      fetchData();
    });

    // Dengarkan event spesifik (retur selesai / retur sedang di-scan)
    const unEvent = subscribeRealtimeEvent((ev, evData) => {
      if (ev === "retur_processed") {
        fetchData();
        if (evData.petugas !== petugas) {
          toast.info(
            `📦 ${evData.petugas} baru saja memproses: ${evData.kode || "Tanpa Barcode"} (${evData.no_retur} — ${evData.kondisi === "sesuai" ? "Kembali ke Stok" : "Banding"})`
          );
        }
      } else if (
        ev === "retur_online_updated" ||
        ev === "retur_banding_updated" ||
        ev === "retur_ke_stok" ||
        ev === "retur_deleted"
      ) {
        fetchData();
      } else if (ev === "retur_inspecting") {
        if (evData.user !== petugas) {
          // Rekan lain sedang scan barcode ini
          if (code && code.toUpperCase() === evData.code?.toUpperCase()) {
            setErr(`⚠️ PERINGATAN: Rekan ${evData.user} baru saja membuka barcode ${evData.code} di layar lain!`);
            setIsDoubleScanErr(true);
            if (soundEnabled) playScanSound("warning");
          }
        }
      }
    });

    return () => {
      unStatus();
      unPresence();
      unSync();
      unEvent();
      setPresence(presKey, null);
    };
  }, [petugas, code, soundEnabled]);

  // Focus input on mount & mode change
  useEffect(() => {
    if (tab === "scan") {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [tab, mode]);

  const resetScan = () => {
    // Lepas lock jika ada
    if (code) {
      fetch(`/api/retur-marketplace?action=unlock&code=${encodeURIComponent(code)}&user=${encodeURIComponent(petugas)}`).catch(() => {});
    }
    setInfo(null);
    setErr(null);
    setIsDoubleScanErr(false);
    setKondisi(null);
    setCatatan("");
    setKlaim("");
    setBuktiFoto(null);
    setLinkBukti("");
    setJenis(JENIS_MASALAH[0]);
    setCode("");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleScanBarcode = async (raw: string) => {
    const k = raw.trim().toUpperCase();
    if (!k) return;
    setErr(null);
    setIsDoubleScanErr(false);
    setInfo(null);
    setKondisi(null);

    try {
      const res = await fetch(`/api/retur-marketplace?code=${encodeURIComponent(k)}&user=${encodeURIComponent(petugas)}`);
      const json = await res.json();
      setCode(k);

      if (!json.ok) {
        // Jika yang di-scan adalah Nomor Resi Kurir atau Order ID Marketplace, otomatis buka mode Order!
        if (json.isOrderOrResi && json.order) {
          setMode("order");
          setOrderQ(json.matchedOrderId || k);
          setOrder(json.order);
          setKlaim(String(json.order.total_amount || ""));
          setResiRetur(
            json.order.retur_request?.[0]?.resi_retur && json.order.retur_request[0].resi_retur !== "-"
              ? json.order.retur_request[0].resi_retur
              : ""
          );
          setCode("");
          if (soundEnabled) playScanSound("success");
          toast.info(`📦 Membuka pesanan ${json.order.order_id} dari scan resi/order`);
          return;
        }
        setErr(json.error);
        setIsDoubleScanErr(!!json.isDoubleScan || !!json.isLocked);
        if (soundEnabled) playScanSound("error");
        toast.error(json.error);
        return;
      }

      setInfo(json);
      setKlaim(String(json.harga || ""));
      if (json.order?.retur_request?.[0]?.resi_retur && json.order.retur_request[0].resi_retur !== "-") {
        setResiRetur(json.order.retur_request[0].resi_retur);
      }
      if (soundEnabled) playScanSound("success");
    } catch {
      setErr("Gagal menghubungi server untuk verifikasi barcode.");
      if (soundEnabled) playScanSound("error");
    }
  };

  const handleFindOrder = async (q: string) => {
    if (!q.trim()) return;
    try {
      const res = await fetch(`/api/retur-marketplace?order_id=${encodeURIComponent(q.trim())}`);
      const j = await res.json();
      if (!res.ok) {
        setOrder(null);
        toast.error(j.error);
        if (soundEnabled) playScanSound("error");
        return;
      }
      setOrder(j);
      setKlaim(String(j.total_amount || ""));
      setResiRetur(j.retur_request?.[0]?.resi_retur && j.retur_request[0].resi_retur !== "-" ? j.retur_request[0].resi_retur : "");
      if (soundEnabled) playScanSound("success");
    } catch {
      toast.error("Gagal mencari pesanan");
    }
  };

  const handleSubmitRetur = async (noBarcode = false) => {
    if (!noBarcode && !info) {
      toast.error("Scan barcode hangtag terlebih dahulu");
      return;
    }
    const k = noBarcode ? "tidak_sesuai" : kondisi;
    if (!k) {
      toast.error("Pilih kondisi fisik: SESUAI atau TIDAK SESUAI");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/retur-marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "proses",
          kode: noBarcode ? null : info.kode,
          order_id: noBarcode ? order?.order_id : info?.order_id,
          kondisi: k,
          jenis_masalah: jenis,
          catatan,
          nilai_klaim: Number(klaim || 0),
          resi_retur: resiRetur,
          bukti_foto: buktiFoto,
          link_bukti: linkBukti,
          petugas,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);

      if (soundEnabled) playScanSound("success");
      toast.success(
        k === "sesuai"
          ? `✅ ${j.retur.no_retur}: ${j.retur.kode_barcode || "Pcs"} sukses KEMBALI KE STOK GUDANG!`
          : `⚠️ ${j.retur.no_retur}: Dicatat untuk BANDING MARKETPLACE!`
      );

      resetScan();
      if (mode === "order" && order) handleFindOrder(order.order_id);
      fetchData();
    } catch (e: any) {
      if (soundEnabled) playScanSound("error");
      toast.error(e.message || "Gagal memproses retur");
    } finally {
      setSaving(false);
    }
  };

  // Filtered list for "Belum Terselesaikan"
  const pendingPaketList = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const raw = data?.belum_terselesaikan?.paket_pending || [];
    if (!q) return raw;
    return raw.filter(
      (p: any) =>
        p.order_id?.toLowerCase().includes(q) ||
        p.product_name?.toLowerCase().includes(q) ||
        p.recipient?.toLowerCase().includes(q) ||
        p.tracking_id?.toLowerCase().includes(q)
    );
  }, [data, searchQuery]);

  // Filtered list for "Sudah Terselesaikan"
  const selesaiList = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const raw = data?.sudah_terselesaikan?.items || [];
    if (!q) return raw;
    return raw.filter(
      (r: any) =>
        r.no_retur?.toLowerCase().includes(q) ||
        r.order_id?.toLowerCase().includes(q) ||
        r.kode_barcode?.toLowerCase().includes(q) ||
        r.nama_barang?.toLowerCase().includes(q) ||
        r.pembeli?.recipient?.toLowerCase().includes(q) ||
        r.petugas?.toLowerCase().includes(q)
    );
  }, [data, searchQuery]);

  const recentList = (data?.list || []).slice(0, 10);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", background: "#F1F5F9" }}>
      {/* ── TOPBAR KHUSUS PORTAL GUDANG RETUR ── */}
      <header
        style={{
          background: "#0F172A",
          color: "white",
          padding: "12px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          zIndex: 20,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "linear-gradient(135deg, #2563EB, #4F46E5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 10px rgba(37,99,235,0.4)",
            }}
          >
            <ScanLine size={22} color="white" />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h1 style={{ fontSize: 16, fontWeight: 900, letterSpacing: 0.5, margin: 0, color: "white" }}>
                PORTAL GUDANG RETUR
              </h1>
              <span style={{ fontSize: 10, background: "#1E293B", padding: "2px 8px", borderRadius: 99, color: "#94A3B8", fontWeight: 700 }}>
                Tirta Bintang Jeans
              </span>
            </div>
            <div style={{ fontSize: 12, color: "#94A3B8", display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              <Radio size={12} color={rtStatus === "live" ? "#10B981" : "#F59E0B"} style={{ animation: "pulse 1.5s infinite" }} />
              <span style={{ color: rtStatus === "live" ? "#34D399" : "#FBBF24", fontWeight: 700 }}>
                {rtStatus === "live" ? "WebSocket Real-time Aktif" : "Menghubungkan WebSocket..."}
              </span>
              <span>·</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Users size={12} /> {activeOfficers.length || 1} Staf Online di Gudang Retur
              </span>
            </div>
          </div>
        </div>

        {/* Identitas Petugas & Audio & Navigasi */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Petugas Badge */}
          <div
            style={{
              background: "#1E293B",
              padding: "6px 12px",
              borderRadius: 10,
              border: "1px solid #334155",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
            }}
          >
            <User size={14} color="#38BDF8" />
            {isEditingPetugas ? (
              <input
                autoFocus
                defaultValue={petugas}
                onBlur={(e) => savePetugasName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") savePetugasName((e.target as any).value);
                }}
                style={{
                  background: "#0F172A",
                  border: "1px solid #38BDF8",
                  color: "white",
                  padding: "2px 6px",
                  borderRadius: 4,
                  fontSize: 12,
                  outline: "none",
                }}
              />
            ) : (
              <span
                onClick={() => setIsEditingPetugas(true)}
                title="Klik untuk ubah nama petugas"
                style={{ cursor: "pointer", fontWeight: 700, color: "white" }}
              >
                Petugas: <u style={{ textDecorationStyle: "dotted", color: "#38BDF8" }}>{petugas}</u> ✏️
              </span>
            )}
          </div>

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? "Suara scanner aktif (klik untuk bisukan)" : "Suara scanner dibisukan"}
            style={{
              background: soundEnabled ? "#065F46" : "#334155",
              color: soundEnabled ? "#6EE7B7" : "#94A3B8",
              border: "none",
              borderRadius: 8,
              padding: "7px 10px",
              fontSize: 11,
              fontWeight: 800,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            {soundEnabled ? "Audio ON" : "Mute"}
          </button>

          {/* Link ke Dashboard Admin */}
          <a
            href="/retur-online"
            style={{
              background: "#334155",
              color: "white",
              padding: "7px 12px",
              borderRadius: 8,
              textDecoration: "none",
              fontSize: 12,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <ExternalLink size={13} /> Menu Admin
          </a>
        </div>
      </header>

      {/* ── TAB SELECTOR & STATS BAR ── */}
      <div
        style={{
          background: "white",
          borderBottom: "1px solid #CBD5E1",
          padding: "12px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", background: "#F1F5F9", borderRadius: 10, padding: 4, gap: 4 }}>
          <button
            onClick={() => setTab("scan")}
            style={{
              padding: "9px 18px",
              borderRadius: 8,
              border: "none",
              fontSize: 13,
              fontWeight: 800,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: tab === "scan" ? "#0F172A" : "transparent",
              color: tab === "scan" ? "white" : "#64748B",
              boxShadow: tab === "scan" ? "0 2px 8px rgba(0,0,0,0.15)" : "none",
              transition: "all 0.15s",
            }}
          >
            <ScanLine size={16} /> ⚡ Scan Retur Cepat
          </button>

          <button
            onClick={() => setTab("belum_selesai")}
            style={{
              padding: "9px 18px",
              borderRadius: 8,
              border: "none",
              fontSize: 13,
              fontWeight: 800,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: tab === "belum_selesai" ? "#EF4444" : "transparent",
              color: tab === "belum_selesai" ? "white" : "#64748B",
              boxShadow: tab === "belum_selesai" ? "0 2px 8px rgba(239,68,68,0.3)" : "none",
              transition: "all 0.15s",
            }}
          >
            <Clock size={16} /> ⏳ Belum Terselesaikan
            <span
              style={{
                fontSize: 11,
                padding: "2px 7px",
                borderRadius: 99,
                background: tab === "belum_selesai" ? "white" : "#FEE2E2",
                color: tab === "belum_selesai" ? "#B91C1C" : "#EF4444",
                fontWeight: 900,
              }}
            >
              {data?.belum_terselesaikan?.total || 0}
            </span>
          </button>

          <button
            onClick={() => setTab("sudah_selesai")}
            style={{
              padding: "9px 18px",
              borderRadius: 8,
              border: "none",
              fontSize: 13,
              fontWeight: 800,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: tab === "sudah_selesai" ? "#10B981" : "transparent",
              color: tab === "sudah_selesai" ? "white" : "#64748B",
              boxShadow: tab === "sudah_selesai" ? "0 2px 8px rgba(16,185,129,0.3)" : "none",
              transition: "all 0.15s",
            }}
          >
            <CheckCircle2 size={16} /> ✅ Sudah Terselesaikan
            <span
              style={{
                fontSize: 11,
                padding: "2px 7px",
                borderRadius: 99,
                background: tab === "sudah_selesai" ? "white" : "#DCFCE7",
                color: tab === "sudah_selesai" ? "#047857" : "#10B981",
                fontWeight: 900,
              }}
            >
              {data?.sudah_terselesaikan?.total || 0}
            </span>
          </button>
        </div>

        {/* Counter Ringkasan Cepat */}
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "#64748B", fontWeight: 700 }}>KEMBALI KE STOK</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#059669" }}>
              {data?.summary?.kembali_stok || 0} <span style={{ fontSize: 11 }}>pcs</span>
            </div>
          </div>
          <div style={{ width: 1, height: 26, background: "#E2E8F0" }} />
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "#64748B", fontWeight: 700 }}>BANDING AKTIF</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#D97706" }}>
              {(data?.summary?.perlu_diajukan || 0) + (data?.summary?.diajukan || 0)} <span style={{ fontSize: 11 }}>pcs</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── KONTEN UTAMA SESUAI TAB ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
        {/* ============================================================ */}
        {/* TAB 1: SCAN RETUR CEPAT (MULTI-USER REALTIME WEBSOCKET)     */}
        {/* ============================================================ */}
        {tab === "scan" && (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)", gap: 20 }}>
            {/* PANEL KIRI: FORM SCAN & KONDISI */}
            <div
              style={{
                background: "white",
                borderRadius: 16,
                border: "1px solid #CBD5E1",
                padding: 20,
                boxShadow: "0 4px 16px rgba(0,0,0,0.03)",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              {/* Alert Info Anti Double Scan */}
              <div
                style={{
                  background: "#EFF6FF",
                  border: "1px solid #BFDBFE",
                  borderRadius: 10,
                  padding: "10px 14px",
                  fontSize: 12,
                  color: "#1E40AF",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <ShieldAlert size={16} color="#2563EB" style={{ flexShrink: 0 }} />
                <div>
                  <b>Proteksi Real-time WebSocket Aktif:</b> Jika rekan lain sedang memeriksa atau baru saja menyelesaikan barcode yang sama, sistem langsung menolak otomatis (*anti double-scan*).
                </div>
              </div>

              {/* Mode Selector */}
              <div style={{ display: "flex", background: "#F1F5F9", borderRadius: 8, padding: 3, alignSelf: "flex-start" }}>
                <button
                  onClick={() => {
                    setMode("barcode");
                    resetScan();
                  }}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 6,
                    border: "none",
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                    background: mode === "barcode" ? "white" : "transparent",
                    color: mode === "barcode" ? "#0F172A" : "#64748B",
                    boxShadow: mode === "barcode" ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <ScanLine size={14} /> Scan Barcode Hangtag / Resi
                </button>
                <button
                  onClick={() => {
                    setMode("order");
                    resetScan();
                  }}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 6,
                    border: "none",
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                    background: mode === "order" ? "white" : "transparent",
                    color: mode === "order" ? "#0F172A" : "#64748B",
                    boxShadow: mode === "order" ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Search size={14} /> Cari Order ID / Resi (Tanpa Barcode)
                </button>
              </div>

              {/* Input Scan */}
              {mode === "barcode" ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleScanBarcode(code);
                  }}
                  style={{ display: "flex", gap: 10 }}
                >
                  <div style={{ position: "relative", flex: 1 }}>
                    <ScanLine
                      size={20}
                      style={{
                        position: "absolute",
                        left: 14,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "#D97706",
                      }}
                    />
                    <input
                      ref={inputRef}
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="Scan barcode hangtag celana ATAU resi kurir lalu Enter..."
                      autoComplete="off"
                      style={{
                        width: "100%",
                        height: 52,
                        paddingLeft: 44,
                        paddingRight: 14,
                        borderRadius: 12,
                        border: "2px solid #F59E0B",
                        fontSize: 16,
                        fontFamily: "monospace",
                        fontWeight: 700,
                        outline: "none",
                        background: "#FFFBEB",
                      }}
                    />
                  </div>
                  <button
                    type="submit"
                    style={{
                      padding: "0 24px",
                      background: "#F59E0B",
                      color: "white",
                      border: "none",
                      borderRadius: 12,
                      fontWeight: 800,
                      cursor: "pointer",
                      fontSize: 14,
                    }}
                  >
                    Periksa
                  </button>
                </form>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleFindOrder(orderQ);
                  }}
                  style={{ display: "flex", gap: 10 }}
                >
                  <input
                    ref={inputRef}
                    value={orderQ}
                    onChange={(e) => setOrderQ(e.target.value)}
                    placeholder="Ketik / Scan Order ID, Resi Kirim, atau Resi Retur..."
                    style={{
                      flex: 1,
                      height: 50,
                      padding: "0 14px",
                      borderRadius: 12,
                      border: "1px solid #CBD5E1",
                      fontSize: 14,
                      fontFamily: "monospace",
                      outline: "none",
                    }}
                  />
                  <button
                    type="submit"
                    style={{
                      padding: "0 22px",
                      background: "#0F172A",
                      color: "white",
                      border: "none",
                      borderRadius: 12,
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    Cari Order
                  </button>
                </form>
              )}

              {/* Alert Error / Double Scan */}
              {err && (
                <div
                  style={{
                    background: isDoubleScanErr ? "#FEF2F2" : "#FFF1F2",
                    border: isDoubleScanErr ? "2px solid #EF4444" : "1px solid #FCA5A5",
                    borderRadius: 12,
                    padding: 14,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    color: "#991B1B",
                    fontSize: 13,
                    fontWeight: 700,
                    lineHeight: 1.5,
                  }}
                >
                  <AlertTriangle size={20} color="#DC2626" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 2 }}>
                      {isDoubleScanErr ? "PERINGATAN GANDA (DOUBLE SCAN)" : "GAGAL MEMPROSES"}
                    </div>
                    {err}
                  </div>
                </div>
              )}

              {/* Info Hasil Scan Barcode */}
              {info && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div
                    style={{
                      background: "#F8FAFC",
                      borderRadius: 12,
                      border: "1px solid #E2E8F0",
                      padding: 14,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontFamily: "monospace", fontWeight: 900, fontSize: 17, color: "#0F172A" }}>
                        {info.kode}
                      </div>
                      <div style={{ fontSize: 13, color: "#475569", marginTop: 2 }}>
                        {info.nama_barang} · Size <b style={{ color: "#2563EB" }}>{info.size}</b>
                      </div>
                    </div>
                    <div style={{ textAlign: "right", fontSize: 12, color: "#64748B" }}>
                      <div>Terjual: <b>{info.penjualan?.no_transaksi || "-"}</b></div>
                      <div style={{ color: "#059669", fontWeight: 800, fontSize: 13 }}>{rp(info.harga)}</div>
                    </div>
                  </div>

                  {/* Card Order Pembeli */}
                  {info.order ? (
                    <div
                      style={{
                        background: "#FFFBEB",
                        border: "1px solid #FDE68A",
                        borderRadius: 10,
                        padding: 12,
                        fontSize: 12,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontWeight: 800, color: "#B45309" }}>{info.order.marketplace}</span>
                        <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{info.order.order_id}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", color: "#475569" }}>
                        <span>Pembeli: <b>{info.order.recipient}</b> (@{info.order.buyer_username})</span>
                        <span>Resi: <b>{info.order.tracking_id || "-"}</b></span>
                      </div>
                    </div>
                  ) : null}

                  {/* Pemeriksaan Fisik Barang */}
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#334155", marginBottom: 8, textTransform: "uppercase" }}>
                      1. HASIL PEMERIKSAAN FISIK BARANG:
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => setKondisi("sesuai")}
                        style={{
                          padding: 14,
                          borderRadius: 12,
                          cursor: "pointer",
                          textAlign: "left",
                          border: `2px solid ${kondisi === "sesuai" ? "#10B981" : "#E2E8F0"}`,
                          background: kondisi === "sesuai" ? "#ECFDF5" : "white",
                          transition: "all 0.15s",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 900, color: "#047857", fontSize: 13 }}>
                          <PackageCheck size={18} /> SESUAI & LAYAK JUAL
                        </div>
                        <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>
                          Barang benar milik kita, kondisi baik & bersih → <b>Otomatis kembali ke stok gudang</b>.
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setKondisi("tidak_sesuai")}
                        style={{
                          padding: 14,
                          borderRadius: 12,
                          cursor: "pointer",
                          textAlign: "left",
                          border: `2px solid ${kondisi === "tidak_sesuai" ? "#EF4444" : "#E2E8F0"}`,
                          background: kondisi === "tidak_sesuai" ? "#FEF2F2" : "white",
                          transition: "all 0.15s",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 900, color: "#B91C1C", fontSize: 13 }}>
                          <PackageX size={18} /> RUSAK / TIDAK SESUAI
                        </div>
                        <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>
                          Barang cacat/kotor/salah → <b>Tidak masuk stok</b>, ditampung untuk banding ke marketplace.
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Form Jika Tidak Sesuai */}
                  {kondisi === "tidak_sesuai" && (
                    <div
                      style={{
                        background: "#FEF2F2",
                        border: "1px solid #FECACA",
                        borderRadius: 12,
                        padding: 14,
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#991B1B" }}>Pilih Jenis Masalah:</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {JENIS_MASALAH.map((j) => (
                          <button
                            key={j}
                            type="button"
                            onClick={() => setJenis(j)}
                            style={{
                              padding: "6px 12px",
                              borderRadius: 99,
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: "pointer",
                              border: `1px solid ${jenis === j ? "#EF4444" : "#FECACA"}`,
                              background: jenis === j ? "#EF4444" : "white",
                              color: jenis === j ? "white" : "#B91C1C",
                            }}
                          >
                            {j}
                          </button>
                        ))}
                      </div>

                      <textarea
                        value={catatan}
                        onChange={(e) => setCatatan(e.target.value)}
                        placeholder="Detail kecacatan untuk bukti banding marketplace (misal: sobek di saku, noda cat, resleting rusak...)"
                        rows={2}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: "1px solid #CBD5E1",
                          fontSize: 13,
                          outline: "none",
                        }}
                      />

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#991B1B", marginBottom: 4 }}>
                            Nilai Klaim Ganti Rugi (Rp)
                          </div>
                          <input
                            type="number"
                            value={klaim}
                            onChange={(e) => setKlaim(e.target.value)}
                            placeholder="0"
                            style={{
                              width: "100%",
                              padding: "8px 10px",
                              borderRadius: 8,
                              border: "1px solid #CBD5E1",
                              fontSize: 13,
                              outline: "none",
                            }}
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#991B1B", marginBottom: 4 }}>
                            No. Resi Retur (opsional)
                          </div>
                          <input
                            value={resiRetur}
                            onChange={(e) => setResiRetur(e.target.value)}
                            placeholder="Resi kurir pengembalian"
                            style={{
                              width: "100%",
                              padding: "8px 10px",
                              borderRadius: 8,
                              border: "1px solid #CBD5E1",
                              fontSize: 13,
                              outline: "none",
                            }}
                          />
                        </div>
                      </div>

                      {/* Foto Bukti & Link Video */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#991B1B", marginBottom: 4 }}>
                            Foto Bukti Kerusakan / Paket
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <label
                              style={{
                                padding: "8px 12px",
                                background: "white",
                                border: "1px dashed #EF4444",
                                borderRadius: 8,
                                fontSize: 11,
                                fontWeight: 700,
                                color: "#B91C1C",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              <Camera size={14} /> {buktiFoto ? "Ganti Foto" : "Ambil / Pilih Foto"}
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={async (e) => {
                                  const f = e.target.files?.[0];
                                  if (!f) return;
                                  try {
                                    const url = await compressImageFile(f);
                                    setBuktiFoto(url);
                                    toast.success("Foto bukti dilampirkan");
                                  } catch (err: any) {
                                    toast.error(err.message);
                                  }
                                }}
                                style={{ display: "none" }}
                              />
                            </label>
                            {buktiFoto && (
                              <img
                                src={buktiFoto}
                                alt="Bukti"
                                style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 6, border: "1px solid #FCA5A5" }}
                              />
                            )}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#991B1B", marginBottom: 4 }}>
                            Link Video Unboxing (opsional)
                          </div>
                          <input
                            value={linkBukti}
                            onChange={(e) => setLinkBukti(e.target.value)}
                            placeholder="https://drive.google.com/..."
                            style={{
                              width: "100%",
                              padding: "8px 10px",
                              borderRadius: 8,
                              border: "1px solid #CBD5E1",
                              fontSize: 13,
                              outline: "none",
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tombol Simpan */}
                  <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                    <button
                      type="button"
                      onClick={resetScan}
                      style={{
                        flex: 1,
                        padding: "12px",
                        borderRadius: 10,
                        border: "1px solid #CBD5E1",
                        background: "#F8FAFC",
                        color: "#475569",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Batal / Scan Lain
                    </button>
                    <button
                      type="button"
                      disabled={!kondisi || saving}
                      onClick={() => handleSubmitRetur(false)}
                      style={{
                        flex: 2,
                        padding: "12px",
                        borderRadius: 10,
                        border: "none",
                        fontWeight: 800,
                        color: "white",
                        cursor: kondisi && !saving ? "pointer" : "not-allowed",
                        background: !kondisi
                          ? "#CBD5E1"
                          : kondisi === "sesuai"
                          ? "linear-gradient(135deg, #10B981, #059669)"
                          : "linear-gradient(135deg, #EF4444, #DC2626)",
                        boxShadow: kondisi ? "0 4px 14px rgba(0,0,0,0.15)" : "none",
                      }}
                    >
                      {saving
                        ? "Menyimpan ke Sistem..."
                        : kondisi === "sesuai"
                        ? "✅ Kembalikan ke Stok Gudang"
                        : kondisi === "tidak_sesuai"
                        ? "⚠️ Masukkan ke Antrean Banding"
                        : "Pilih kondisi di atas"}
                    </button>
                  </div>
                </div>
              )}

              {/* Mode Order ID: jika paket datang tanpa barcode hangtag */}
              {mode === "order" && order && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: 12 }}>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{order.order_id}</div>
                    <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
                      Pembeli: {order.recipient} · {order.shipping_provider} ({order.tracking_id})
                    </div>
                  </div>

                  <div style={{ fontSize: 12, fontWeight: 800, color: "#475569" }}>
                    Daftar Barcode yang Pernah Dikirim di Pesanan Ini (Klik jika barangnya sesuai):
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {(order.barcodes || []).map((b: any) => (
                      <button
                        key={b.kode}
                        disabled={b.status !== "terjual"}
                        onClick={() => {
                          setMode("barcode");
                          handleScanBarcode(b.kode);
                        }}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: "1px solid #CBD5E1",
                          background: b.status === "terjual" ? "white" : "#F1F5F9",
                          cursor: b.status === "terjual" ? "pointer" : "not-allowed",
                          fontSize: 12,
                          textAlign: "left",
                        }}
                      >
                        <b style={{ fontFamily: "monospace" }}>{b.kode}</b> · Size {b.size}
                        {b.status !== "terjual" && (
                          <div style={{ fontSize: 10, color: "#D97706" }}>
                            {b.status === "siap_jual" || b.status === "retur_stok"
                              ? "Sudah kembali ke stok"
                              : "Sudah masuk banding"}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Tombol Retur Tanpa Barcode (Tertukar / Kosong) */}
                  <div
                    style={{
                      borderTop: "1px dashed #CBD5E1",
                      paddingTop: 12,
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#B91C1C", display: "flex", alignItems: "center", gap: 6 }}>
                      <PackageX size={16} /> Barang Datang TANPA Barcode Kita (Tertukar / Paket Kosong)
                    </div>
                    <textarea
                      value={catatan}
                      onChange={(e) => setCatatan(e.target.value)}
                      placeholder="Jelaskan kondisi (misal: isi paket diganti pakaian merk lain / paket kosong)..."
                      rows={2}
                      style={{ padding: 8, borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 12 }}
                    />
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleSubmitRetur(true)}
                      style={{
                        padding: 12,
                        borderRadius: 10,
                        border: "none",
                        background: "linear-gradient(135deg, #EF4444, #F59E0B)",
                        color: "white",
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      Catat untuk Banding Marketplace (Tanpa Barcode)
                    </button>
                  </div>
                </div>
              )}

              {!info && !err && mode === "barcode" && (
                <div
                  style={{
                    padding: 40,
                    textAlign: "center",
                    border: "2px dashed #CBD5E1",
                    borderRadius: 12,
                    color: "#94A3B8",
                  }}
                >
                  <ScanLine size={36} style={{ marginBottom: 8, opacity: 0.6 }} />
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#475569" }}>
                    Arahkan Barcode Scanner ke Hangtag Celana
                  </div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    Sistem akan memverifikasi riwayat pesanan & mencegah scan dobel secara real-time.
                  </div>
                </div>
              )}
            </div>

            {/* PANEL KANAN: LIVE FEED RETUR TERAKHIR DIPROSES */}
            <div
              style={{
                background: "white",
                borderRadius: 16,
                border: "1px solid #CBD5E1",
                padding: 20,
                boxShadow: "0 4px 16px rgba(0,0,0,0.03)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ fontWeight: 900, color: "#0F172A", fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
                  <Sparkles size={16} color="#2563EB" /> Retur Terakhir Diproses (Live Feed)
                </div>
                <span style={{ fontSize: 11, color: "#059669", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 99, background: "#10B981" }} /> Real-time
                </span>
              </div>

              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                {recentList.length === 0 ? (
                  <div style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
                    Belum ada aktivitas retur hari ini.
                  </div>
                ) : (
                  recentList.map((r) => {
                    const isStok = r.status === "Kembali ke Stok" || r.status === "Dipindah ke Stok";
                    return (
                      <div
                        key={r.id}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 10,
                          background: isStok ? "#F0FDF4" : "#FEF2F2",
                          border: `1px solid ${isStok ? "#BBF7D0" : "#FECACA"}`,
                          fontSize: 12,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontFamily: "monospace", fontWeight: 800, color: "#0F172A" }}>
                            {r.no_retur}
                          </span>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 900,
                              padding: "2px 8px",
                              borderRadius: 99,
                              background: isStok ? "#DCFCE7" : "#FEE2E2",
                              color: isStok ? "#166534" : "#991B1B",
                            }}
                          >
                            {isStok ? "Kembali ke Stok" : r.status}
                          </span>
                        </div>
                        <div style={{ fontWeight: 700, color: "#334155", marginTop: 4 }}>
                          {r.nama_barang} {r.size ? `· Size ${r.size}` : ""}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#64748B", fontSize: 11, marginTop: 4 }}>
                          <span>Barcode: <b style={{ fontFamily: "monospace" }}>{r.kode_barcode || "tanpa barcode"}</b></span>
                          <span>Petugas: <b>{r.petugas || "Staf"}</b> · {tgl(r.tanggal)}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: DAFTAR BARANG YANG BELUM TERSELESAIKAN                */}
        {/* ============================================================ */}
        {tab === "belum_selesai" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Header & Filter Search */}
            <div
              style={{
                background: "white",
                padding: "16px 20px",
                borderRadius: 14,
                border: "1px solid #CBD5E1",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 900, color: "#0F172A", margin: 0 }}>
                  Daftar Retur yang Belum Terselesaikan
                </h2>
                <p style={{ fontSize: 12, color: "#64748B", margin: "4px 0 0" }}>
                  Mencakup paket retur marketplace yang <b>belum selesai di-scan fisiknya di gudang</b> dan barang rusak yang <b>sedang diajukan banding</b>.
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", background: "#F1F5F9", borderRadius: 10, padding: "0 12px", width: 320 }}>
                <Search size={16} color="#94A3B8" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari Order ID, Nama Produk, Resi..."
                  style={{ width: "100%", padding: "10px", border: "none", background: "transparent", outline: "none", fontSize: 13 }}
                />
              </div>
            </div>

            {/* TABEL 1: PAKET RETUR MENUNGGU FISIK DI GUDANG */}
            <div style={{ background: "white", borderRadius: 14, border: "1px solid #CBD5E1", overflow: "hidden" }}>
              <div style={{ padding: "14px 20px", background: "#FEF2F2", borderBottom: "1px solid #FECACA", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 900, color: "#991B1B", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                  <PackageX size={16} /> 1. Paket Retur Menunggu Fisik Datang / Belum Di-scan ({pendingPaketList.length})
                </div>
                <span style={{ fontSize: 11, color: "#B91C1C", fontWeight: 700 }}>
                  Data dari Impor Laporan Marketplace (TikTok/Shopee)
                </span>
              </div>

              {pendingPaketList.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
                  Semua paket retur marketplace yang diimpor sudah berhasil di-scan & diselesaikan! 🎉
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#F8FAFC", color: "#64748B", textAlign: "left", fontSize: 11 }}>
                      <th style={{ padding: "10px 14px" }}>ORDER ID</th>
                      <th style={{ padding: "10px 14px" }}>PRODUK & VARIASI</th>
                      <th style={{ padding: "10px 14px" }}>PEMBELI & RESI RETUR</th>
                      <th style={{ padding: "10px 14px" }}>ALASAN RETUR</th>
                      <th style={{ padding: "10px 14px" }}>STATUS</th>
                      <th style={{ padding: "10px 14px", textAlign: "right" }}>AKSI CEPAT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingPaketList.map((p: any, idx: number) => (
                      <tr key={idx} style={{ borderTop: "1px solid #F1F5F9" }}>
                        <td style={{ padding: "12px 14px" }}>
                          <b style={{ fontFamily: "monospace", color: "#0F172A" }}>{p.order_id}</b>
                          <div style={{ fontSize: 11, color: "#64748B" }}>{p.tanggal_batal || "-"}</div>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ fontWeight: 700, color: "#334155" }}>{p.product_name}</div>
                          <div style={{ fontSize: 11, color: "#2563EB" }}>Variasi: {p.variation || "-"} · Qty: {p.return_quantity || 1}</div>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ fontWeight: 700 }}>{p.recipient || p.buyer_username || "-"}</div>
                          <div style={{ fontSize: 11, color: "#64748B", fontFamily: "monospace" }}>Resi: {p.tracking_id || "-"}</div>
                        </td>
                        <td style={{ padding: "12px 14px", maxWidth: 200 }}>
                          <span style={{ color: "#B91C1C", fontWeight: 700 }}>{p.alasan || p.return_type || "Batal/Retur"}</span>
                          {p.buyer_note && p.buyer_note !== "-" && (
                            <div style={{ fontSize: 11, color: "#64748B", fontStyle: "italic" }}>"{p.buyer_note}"</div>
                          )}
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 99, background: "#FEE2E2", color: "#991B1B" }}>
                            Menunggu Gudang
                          </span>
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "right" }}>
                          <button
                            onClick={() => {
                              setTab("scan");
                              setMode("order");
                              setOrderQ(p.order_id);
                              handleFindOrder(p.order_id);
                            }}
                            style={{
                              padding: "6px 12px",
                              borderRadius: 8,
                              border: "none",
                              background: "#0F172A",
                              color: "white",
                              fontSize: 11,
                              fontWeight: 800,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            ⚡ Proses Sekarang <ArrowRight size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* TABEL 2: RETUR FISIK DALAM PROSES BANDING */}
            <div style={{ background: "white", borderRadius: 14, border: "1px solid #CBD5E1", overflow: "hidden" }}>
              <div style={{ padding: "14px 20px", background: "#FFFBEB", borderBottom: "1px solid #FDE68A", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 900, color: "#92400E", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                  <Scale size={16} /> 2. Retur Fisik Rusak/Tertukar Sedang Dalam Banding Marketplace ({data?.belum_terselesaikan?.banding_pending?.length || 0})
                </div>
                <span style={{ fontSize: 11, color: "#B45309", fontWeight: 700 }}>
                  Menunggu Ganti Rugi / Keputusan Marketplace
                </span>
              </div>

              {(data?.belum_terselesaikan?.banding_pending?.length || 0) === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
                  Tidak ada retur bermasalah yang sedang menggantung di banding!
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#F8FAFC", color: "#64748B", textAlign: "left", fontSize: 11 }}>
                      <th style={{ padding: "10px 14px" }}>NO. RETUR / ORDER</th>
                      <th style={{ padding: "10px 14px" }}>PRODUK & BARCODE</th>
                      <th style={{ padding: "10px 14px" }}>MASALAH FISIK</th>
                      <th style={{ padding: "10px 14px" }}>NILAI KLAIM</th>
                      <th style={{ padding: "10px 14px" }}>STATUS BANDING</th>
                      <th style={{ padding: "10px 14px" }}>PETUGAS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.belum_terselesaikan?.banding_pending || []).map((r: any) => (
                      <tr key={r.id} style={{ borderTop: "1px solid #F1F5F9" }}>
                        <td style={{ padding: "12px 14px" }}>
                          <b style={{ fontFamily: "monospace" }}>{r.no_retur}</b>
                          <div style={{ color: "#64748B", fontSize: 11, fontFamily: "monospace" }}>Order: {r.order_id || "-"}</div>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ fontWeight: 700 }}>{r.nama_barang}</div>
                          <div style={{ color: "#2563EB", fontFamily: "monospace", fontSize: 11 }}>{r.kode_barcode || "tanpa barcode"}</div>
                        </td>
                        <td style={{ padding: "12px 14px", maxWidth: 220 }}>
                          <span style={{ color: "#B91C1C", fontWeight: 800 }}>{r.jenis_masalah}</span>
                          <div style={{ color: "#64748B", fontSize: 11 }}>{r.catatan || "-"}</div>
                        </td>
                        <td style={{ padding: "12px 14px", fontWeight: 800, color: "#0F172A" }}>
                          {rp(r.nilai_klaim)}
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 99, background: "#FEF3C7", color: "#B45309" }}>
                            {r.status}
                          </span>
                        </td>
                        <td style={{ padding: "12px 14px", color: "#64748B" }}>
                          <b>{r.petugas || "Staf"}</b>
                          <div style={{ fontSize: 10 }}>{tgl(r.tanggal)}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: DAFTAR BARANG YANG SUDAH TERSELESAIKAN                */}
        {/* ============================================================ */}
        {tab === "sudah_selesai" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Header & Filter Search */}
            <div
              style={{
                background: "white",
                padding: "16px 20px",
                borderRadius: 14,
                border: "1px solid #CBD5E1",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 900, color: "#0F172A", margin: 0 }}>
                  Riwayat Retur yang Sudah Terselesaikan
                </h2>
                <p style={{ fontSize: 12, color: "#64748B", margin: "4px 0 0" }}>
                  Mencakup semua pcs yang <b>sudah diverifikasi dan masuk kembali ke stok</b>, serta kasus banding yang <b>sudah disetujui/tuntas</b>.
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", background: "#F1F5F9", borderRadius: 10, padding: "0 12px", width: 320 }}>
                <Search size={16} color="#94A3B8" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari No Retur, Barcode, Petugas..."
                  style={{ width: "100%", padding: "10px", border: "none", background: "transparent", outline: "none", fontSize: 13 }}
                />
              </div>
            </div>

            {/* TABEL SUDAH TERSELESAIKAN */}
            <div style={{ background: "white", borderRadius: 14, border: "1px solid #CBD5E1", overflow: "hidden" }}>
              {selesaiList.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
                  Tidak ada data retur yang sesuai dengan pencarian.
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#F8FAFC", color: "#64748B", textAlign: "left", fontSize: 11 }}>
                      <th style={{ padding: "10px 14px" }}>NO. RETUR / ORDER</th>
                      <th style={{ padding: "10px 14px" }}>PRODUK & SIZE</th>
                      <th style={{ padding: "10px 14px" }}>KODE BARCODE</th>
                      <th style={{ padding: "10px 14px" }}>HASIL & STATUS</th>
                      <th style={{ padding: "10px 14px" }}>PETUGAS GUDANG</th>
                      <th style={{ padding: "10px 14px", textAlign: "right" }}>WAKTU SELESAI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selesaiList.map((r: any) => {
                      const isStok = r.status === "Kembali ke Stok" || r.status === "Dipindah ke Stok";
                      return (
                        <tr key={r.id} style={{ borderTop: "1px solid #F1F5F9" }}>
                          <td style={{ padding: "12px 14px" }}>
                            <b style={{ fontFamily: "monospace", color: "#0F172A" }}>{r.no_retur}</b>
                            <div style={{ fontSize: 11, color: "#64748B", fontFamily: "monospace" }}>
                              {r.order_id ? `Order ${r.order_id}` : "Tanpa Order ID"}
                            </div>
                            <div style={{ fontSize: 10, color: "#94A3B8" }}>{r.marketplace}</div>
                          </td>
                          <td style={{ padding: "12px 14px" }}>
                            <div style={{ fontWeight: 700, color: "#334155" }}>{r.nama_barang}</div>
                            {r.size && <div style={{ fontSize: 11, color: "#2563EB" }}>Size: {r.size}</div>}
                          </td>
                          <td style={{ padding: "12px 14px" }}>
                            {r.kode_barcode ? (
                              <span style={{ fontFamily: "monospace", fontWeight: 800, background: "#EFF6FF", color: "#1D4ED8", padding: "3px 8px", borderRadius: 6 }}>
                                {r.kode_barcode}
                              </span>
                            ) : (
                              <span style={{ color: "#94A3B8" }}>Tanpa Barcode</span>
                            )}
                          </td>
                          <td style={{ padding: "12px 14px" }}>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 900,
                                padding: "4px 9px",
                                borderRadius: 99,
                                background: isStok ? "#DCFCE7" : r.status === "Banding Disetujui" ? "#EFF6FF" : "#F1F5F9",
                                color: isStok ? "#166534" : r.status === "Banding Disetujui" ? "#1E40AF" : "#475569",
                              }}
                            >
                              {isStok ? "✅ KEMBALI KE STOK" : r.status}
                            </span>
                            {r.dana_diterima > 0 && (
                              <div style={{ fontSize: 11, color: "#059669", fontWeight: 800, marginTop: 4 }}>
                                Dana Cair: {rp(r.dana_diterima)}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "12px 14px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: "#334155" }}>
                              <User size={13} color="#64748B" /> {r.petugas || "Staf Gudang"}
                            </div>
                          </td>
                          <td style={{ padding: "12px 14px", textAlign: "right", color: "#64748B" }}>
                            {tgl(r.tanggal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
