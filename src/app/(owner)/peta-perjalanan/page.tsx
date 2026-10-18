"use client";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  MapPin,
  Search,
  RefreshCw,
  Scissors,
  Zap,
  Droplets,
  CheckCircle2,
  Package,
  Clock,
  ArrowRight,
  ArrowLeft,
  Calendar,
  User,
  Layers,
  FileText,
  ExternalLink,
  Printer,
  Sparkles,
  Box,
  ChevronRight,
  SlidersHorizontal,
  Check,
  Building2,
  AlertCircle,
  Truck,
  Filter
} from "lucide-react";

// Format date helpers
function fmtDate(str?: string) {
  if (!str) return "-";
  return new Date(str).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
}

function fmtDT(str?: string) {
  if (!str) return "-";
  const d = new Date(str);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) +
    " · " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function fmtWaktu(d: Date) {
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function PetaPerjalananPage() {
  const [poList, setPoList] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [pulse, setPulse] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Load stages configuration
  const loadStages = useCallback(async () => {
    try {
      const res = await fetch("/api/pipeline-stages?_t=" + Date.now());
      const data = await res.json();
      if (Array.isArray(data)) {
        setStages(data.filter((s: any) => s.aktif).sort((a: any, b: any) => a.urutan - b.urutan));
      }
    } catch {}
  }, []);

  // Load PO summary list
  const loadList = useCallback(async () => {
    try {
      const res = await fetch("/api/po-detail?_t=" + Date.now());
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];
      setPoList(arr);
      // Auto-select first PO if none selected yet on desktop
      if (!selectedPoId && arr.length > 0 && typeof window !== "undefined" && window.innerWidth > 768) {
        setSelectedPoId(String(arr[0].id));
      }
      setPulse(true);
      setTimeout(() => setPulse(false), 600);
    } catch {}
    finally {
      setLastUpdated(new Date());
      setLoading(false);
    }
  }, [selectedPoId]);

  // Load PO full detail
  const loadDetail = useCallback(async (poId: string, isBackground = false) => {
    if (!isBackground) setDetailLoading(true);
    try {
      const res = await fetch(`/api/po-detail?poId=${poId}&_t=` + Date.now());
      const data = await res.json();
      setDetail(data);
    } catch {}
    finally {
      if (!isBackground) setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStages();
    loadList();
    const t = setInterval(() => { if (!document.hidden) loadList(); }, 30000);
    return () => clearInterval(t);
  }, [loadList, loadStages]);

  useEffect(() => {
    if (selectedPoId) {
      loadDetail(selectedPoId);
      const t = setInterval(() => { if (!document.hidden) loadDetail(selectedPoId, true); }, 30000);
      return () => clearInterval(t);
    }
  }, [selectedPoId, loadDetail]);

  // Realtime: refresh list + open detail silently whenever data changes on the server
  useEffect(() => {
    const handler = () => {
      loadList();
      if (selectedPoId) loadDetail(selectedPoId, true);
    };
    window.addEventListener("konveksi-sync", handler);
    return () => window.removeEventListener("konveksi-sync", handler);
  }, [loadList, loadDetail, selectedPoId]);

  // Filtered POs
  const filteredPo = useMemo(() => {
    return poList.filter((po) => {
      // Status filter
      if (filterStatus === "selesai" && (po.stats?.totalDiGudang || 0) < po.jumlahTerbit) return false;
      if (filterStatus === "proses" && (po.stats?.totalDiGudang || 0) >= po.jumlahTerbit) return false;

      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchNoPo = (po.noPo || "").toLowerCase().includes(q);
      const matchModel = (po.model || "").toLowerCase().includes(q);
      const matchKain = (po.pemotongan?.nama_barang || "").toLowerCase().includes(q);
      const matchTukang = (po.pemotongan?.tukang?.nama || "").toLowerCase().includes(q);
      const matchVendor = (po.vendorCMT?.nama || "").toLowerCase().includes(q);

      return matchNoPo || matchModel || matchKain || matchTukang || matchVendor;
    });
  }, [poList, filterStatus, searchQuery]);

  const getStageStatusInfo = (po: any) => {
    if (!po?.stats) return { label: "Menunggu", color: "#64748B", bg: "#F1F5F9", border: "#CBD5E1" };
    if (po.stats.totalDiGudang >= po.jumlahTerbit) {
      return { label: "Selesai di Gudang", color: "#059669", bg: "#ECFDF5", border: "#A7F3D0" };
    }
    if (po.stats.totalWashing > 0 && po.stats.totalWashingDone < po.stats.totalWashing) {
      return { label: "Sedang Washing", color: "#0284C7", bg: "#F0F9FF", border: "#BAE6FD" };
    }
    if (po.stats.totalWashingDone > 0) {
      return { label: "Selesai Cuci / Finishing", color: "#0D9488", bg: "#F0FDFA", border: "#99F6E4" };
    }
    if (po.stats.totalDisetujui > 0) {
      return { label: "Siap Tarik (CMT ACC)", color: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0" };
    }
    if (po.stats.totalDilaporkan > 0) {
      return { label: "Proses Jahit (CMT)", color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" };
    }
    return { label: "Potong Selesai (Menunggu)", color: "#475569", bg: "#F8FAFC", border: "#E2E8F0" };
  };

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#F8FAFC", fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @keyframes pulse2 { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(0.92); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .po-item-hover:hover { background: #F1F5F9 !important; border-color: #CBD5E1 !important; transform: translateY(-1px); }
        .active-po-card { background: #FFFFFF !important; border-color: #2563EB !important; box-shadow: 0 4px 12px rgba(37,99,235,0.12) !important; }
        .journey-step-box { transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
        .journey-step-box:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.06); }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 99px; }
        ::-webkit-scrollbar-thumb:hover { background: #94A3B8; }
      `}</style>

      {/* LEFT PANEL: DAFTAR PO */}
      <div style={{
        width: 320,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        background: "#FFFFFF",
        borderRight: "1px solid #E2E8F0",
        zIndex: 10
      }}>
        {/* Header Left */}
        <div style={{ padding: "18px 16px 14px", borderBottom: "1px solid #E2E8F0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: "linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 6px rgba(37,99,235,0.25)"
              }}>
                <MapPin size={17} color="#FFFFFF" />
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: "#0F172A", letterSpacing: "-0.01em" }}>
                  Peta Perjalanan Kain
                </h1>
                <span style={{ fontSize: 11, color: "#64748B" }}>Tracking Posisi & Alur Produksi</span>
              </div>
            </div>

            {/* LIVE & Sync indicator */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                background: "#ECFDF5",
                color: "#059669",
                fontSize: 10,
                fontWeight: 800,
                padding: "3px 8px",
                borderRadius: 12,
                border: "1px solid #A7F3D0"
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981", animation: "pulse2 1.8s infinite" }} />
                LIVE
              </span>
              <button
                onClick={loadList}
                title="Refresh Data"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: pulse ? "#2563EB" : "#94A3B8",
                  padding: 4,
                  display: "flex",
                  alignItems: "center"
                }}
              >
                <RefreshCw size={13} style={{ animation: pulse ? "spin 0.6s linear" : "none" }} />
              </button>
            </div>
          </div>

          {/* Search Box */}
          <div style={{ position: "relative", marginTop: 12, marginBottom: 8 }}>
            <Search size={14} color="#94A3B8" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text"
              placeholder="Cari No PO, model, kain, vendor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "7px 10px 7px 30px",
                borderRadius: 8,
                border: "1px solid #E2E8F0",
                background: "#F8FAFC",
                fontSize: 12,
                color: "#0F172A",
                outline: "none",
                boxSizing: "border-box",
                transition: "border-color 0.15s"
              }}
              onFocus={(e) => (e.target.style.borderColor = "#3B82F6")}
              onBlur={(e) => (e.target.style.borderColor = "#E2E8F0")}
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

          {/* Tab Filter */}
          <div style={{ display: "flex", gap: 4, background: "#F1F5F9", padding: 3, borderRadius: 8 }}>
            {[
              { id: "all", label: "Semua" },
              { id: "proses", label: "Proses" },
              { id: "selesai", label: "Selesai" }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterStatus(tab.id)}
                style={{
                  flex: 1,
                  padding: "5px 0",
                  fontSize: 11,
                  fontWeight: filterStatus === tab.id ? 800 : 600,
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  background: filterStatus === tab.id ? "#FFFFFF" : "transparent",
                  color: filterStatus === tab.id ? "#1E40AF" : "#64748B",
                  boxShadow: filterStatus === tab.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  transition: "all 0.15s"
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* PO List Cards */}
        <div style={{ flex: 1, overflowY: "auto", padding: "10px" }}>
          {loading && poList.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 10px", color: "#94A3B8", fontSize: 13 }}>
              <RefreshCw size={18} color="#3B82F6" style={{ animation: "spin 1s linear infinite", marginBottom: 8 }} />
              <div>Memuat data perjalanan kain...</div>
            </div>
          ) : filteredPo.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 10px", color: "#94A3B8", fontSize: 13 }}>
              <Filter size={24} color="#CBD5E1" style={{ marginBottom: 8 }} />
              <div style={{ fontWeight: 600, color: "#64748B" }}>Tidak ada PO yang cocok</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>Coba ubah kata kunci pencarian atau tab filter</div>
            </div>
          ) : (
            filteredPo.map((po) => {
              const isSel = selectedPoId === String(po.id);
              const st = getStageStatusInfo(po);
              const pctGudang = po.stats?.pctGudang || 0;
              const pctCMT = po.stats?.pctCMT || 0;

              return (
                <button
                  key={po.id}
                  onClick={() => setSelectedPoId(String(po.id))}
                  className={`po-item-hover ${isSel ? "active-po-card" : ""}`}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    marginBottom: 8,
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: `1.5px solid ${isSel ? "#2563EB" : "#E2E8F0"}`,
                    background: isSel ? "#FFFFFF" : "#F8FAFC",
                    cursor: "pointer",
                    position: "relative",
                    transition: "all 0.15s ease",
                    boxSizing: "border-box"
                  }}
                >
                  {/* Left active marker */}
                  {isSel && (
                    <div style={{
                      position: "absolute",
                      left: 0,
                      top: 10,
                      bottom: 10,
                      width: 4,
                      borderRadius: "0 4px 4px 0",
                      background: "#2563EB"
                    }} />
                  )}

                  {/* Top: PO Code & Status */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                    <span style={{ fontWeight: 900, fontSize: 13, color: isSel ? "#1E40AF" : "#0F172A", fontFamily: "monospace" }}>
                      {po.noPo}
                    </span>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: "2px 7px",
                      borderRadius: 10,
                      background: st.bg,
                      color: st.color,
                      border: `1px solid ${st.border}`
                    }}>
                      {st.label}
                    </span>
                  </div>

                  {/* Model & Qty */}
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#1E293B", marginBottom: 4 }}>
                    {po.model}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748B", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    <Box size={12} color="#94A3B8" />
                    <span>Total {po.jumlahTerbit} pcs</span>
                    {po.vendorCMT && (
                      <>
                        <span>•</span>
                        <span style={{ color: "#3B82F6", fontWeight: 600 }}>{po.vendorCMT.nama}</span>
                      </>
                    )}
                  </div>

                  {/* Fabric tag if available */}
                  {po.pemotongan && (
                    <div style={{
                      fontSize: 10,
                      color: "#64748B",
                      background: isSel ? "#EFF6FF" : "#EDF2F7",
                      padding: "3px 7px",
                      borderRadius: 6,
                      marginBottom: 8,
                      display: "flex",
                      alignItems: "center",
                      gap: 5
                    }}>
                      <Scissors size={10} color="#475569" />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {po.pemotongan.nama_barang} • Tukang: {po.pemotongan.tukang?.nama || "-"}
                      </span>
                    </div>
                  )}

                  {/* Dual Multi-progress bar */}
                  <div style={{ width: "100%", background: "#E2E8F0", height: 5, borderRadius: 3, overflow: "hidden", position: "relative" }}>
                    {/* Gudang progress (green) */}
                    <div style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      height: "100%",
                      width: `${Math.min(pctGudang, 100)}%`,
                      background: "#10B981",
                      borderRadius: 3,
                      zIndex: 2
                    }} />
                    {/* CMT progress (amber/blue) */}
                    <div style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      height: "100%",
                      width: `${Math.min(pctCMT, 100)}%`,
                      background: "#F59E0B",
                      borderRadius: 3,
                      zIndex: 1
                    }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#94A3B8", marginTop: 4 }}>
                    <span>Jahit: <strong style={{ color: "#D97706" }}>{pctCMT}%</strong></span>
                    <span>Gudang: <strong style={{ color: "#059669" }}>{pctGudang}%</strong></span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT PANEL: DETAIL PERJALANAN KAIN */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#F1F5F9" }}>
        {!selectedPoId ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, color: "#94A3B8" }}>
            <div style={{
              width: 76,
              height: 76,
              borderRadius: 24,
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <MapPin size={34} color="#94A3B8" />
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#334155" }}>Pilih PO di Panel Kiri</div>
            <p style={{ margin: 0, fontSize: 13, color: "#64748B", maxWidth: 360, textAlign: "center" }}>
              Pilih salah satu nomor PO untuk meninjau asal-usul bahan baku, pemotongan, tracking antar vendor, dan riwayat perjalanan lengkap.
            </p>
          </div>
        ) : detailLoading ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B", fontSize: 14, gap: 10 }}>
            <RefreshCw size={20} color="#2563EB" style={{ animation: "spin 1s linear infinite" }} />
            <span>Memuat rincian alur perjalanan kain...</span>
          </div>
        ) : !detail ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#EF4444", fontSize: 14 }}>
            <AlertCircle size={20} style={{ marginRight: 8 }} />
            <span>Gagal memuat rincian PO. Silakan coba lagi.</span>
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: "auto" }}>
            {/* SUB-HEADER / ACTIONS BAR */}
            <div style={{
              background: "#FFFFFF",
              borderBottom: "1px solid #E2E8F0",
              padding: "12px 28px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              position: "sticky",
              top: 0,
              zIndex: 9
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>
                  Tracking Posisi Lot:
                </span>
                <span style={{
                  fontSize: 12,
                  fontWeight: 900,
                  color: "#1E40AF",
                  background: "#EFF6FF",
                  padding: "3px 10px",
                  borderRadius: 8,
                  border: "1px solid #BFDBFE"
                }}>
                  {detail.noPo}
                </span>
                <span style={{ fontSize: 12, color: "#94A3B8" }}>•</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>{detail.model}</span>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Link
                  href="/alur-produksi"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: "1px solid #E2E8F0",
                    background: "#FFFFFF",
                    color: "#334155",
                    fontSize: 12,
                    fontWeight: 700,
                    textDecoration: "none",
                    transition: "all 0.15s"
                  }}
                >
                  <ExternalLink size={13} color="#64748B" />
                  <span>Alur Produksi</span>
                </Link>

                {detail.id && (
                  <Link
                    href={`/cetak-po-potongan/${detail.id}`}
                    target="_blank"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: "1px solid #DBEAFE",
                      background: "#EFF6FF",
                      color: "#1D4ED8",
                      fontSize: 12,
                      fontWeight: 700,
                      textDecoration: "none",
                      transition: "all 0.15s"
                    }}
                  >
                    <Printer size={13} color="#2563EB" />
                    <span>Cetak SPK Potong</span>
                  </Link>
                )}
              </div>
            </div>

            {/* HERO SNAPSHOT CARD */}
            <div style={{
              background: "#FFFFFF",
              borderBottom: "1px solid #E2E8F0",
              padding: "24px 28px"
            }}>
              <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
                {/* Circular Progress Meter */}
                <div style={{ position: "relative", width: 92, height: 92, flexShrink: 0 }}>
                  <svg style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
                    <circle cx="46" cy="46" r="38" stroke="#E2E8F0" strokeWidth="8" fill="transparent" />
                    <circle
                      cx="46"
                      cy="46"
                      r="38"
                      stroke={detail.stats.totalDiGudang >= detail.jumlahTerbit ? "#10B981" : "#2563EB"}
                      strokeWidth="8"
                      fill="transparent"
                      strokeDasharray={2 * Math.PI * 38}
                      strokeDashoffset={(2 * Math.PI * 38) * (1 - Math.min((detail.stats.totalDiGudang / (detail.jumlahTerbit || 1)), 1))}
                      strokeLinecap="round"
                      style={{ transition: "stroke-dashoffset 0.8s ease" }}
                    />
                  </svg>
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontWeight: 900, fontSize: 17, color: "#0F172A", lineHeight: 1 }}>
                      {detail.stats.pctGudang}%
                    </span>
                    <span style={{ fontSize: 10, color: "#64748B", fontWeight: 700, marginTop: 2 }}>Gudang</span>
                  </div>
                </div>

                {/* Identity & Quantities */}
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#0F172A", fontFamily: "monospace", letterSpacing: "-0.02em" }}>
                      {detail.noPo}
                    </h2>
                    {detail.stats.totalDiGudang >= detail.jumlahTerbit ? (
                      <span style={{
                        background: "#ECFDF5",
                        color: "#059669",
                        fontWeight: 900,
                        fontSize: 11,
                        padding: "3px 10px",
                        borderRadius: 20,
                        border: "1px solid #A7F3D0",
                        display: "flex",
                        alignItems: "center",
                        gap: 5
                      }}>
                        <CheckCircle2 size={13} color="#10B981" /> SELESAI PENUH
                      </span>
                    ) : (
                      <span style={{
                        background: "#EFF6FF",
                        color: "#1D4ED8",
                        fontWeight: 800,
                        fontSize: 11,
                        padding: "3px 10px",
                        borderRadius: 20,
                        border: "1px solid #BFDBFE"
                      }}>
                        PRODUKSI AKTIF
                      </span>
                    )}
                  </div>

                  <div style={{ color: "#475569", fontWeight: 600, fontSize: 13, marginBottom: 12 }}>
                    Model: <strong style={{ color: "#0F172A" }}>{detail.model}</strong> • Terbit: {fmtDT(detail.tanggalTerbit)} • Total: <strong style={{ color: "#2563EB" }}>{detail.jumlahTerbit} pcs</strong>
                  </div>

                  {/* Size Distribution Badges */}
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 }}>
                      Breakdown Ukuran Terbit:
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {(detail.sizeBreakdown || []).map((s: any) => (
                        <div
                          key={s.size}
                          style={{
                            background: "#F8FAFC",
                            color: "#1E293B",
                            fontWeight: 800,
                            fontSize: 11,
                            padding: "4px 9px",
                            borderRadius: 8,
                            border: "1px solid #E2E8F0",
                            display: "flex",
                            alignItems: "center",
                            gap: 5
                          }}
                        >
                          <span style={{ color: "#2563EB" }}>{s.size}:</span>
                          <span>{s.jumlah} pcs</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 4 Stat KPI Metric Boxes */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: 10,
                  minWidth: 320,
                  maxWidth: 420
                }}>
                  {/* CMT Reported */}
                  <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 12, padding: "10px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      <Zap size={14} color="#D97706" />
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#92400E" }}>CMT Jahit</span>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 900, color: "#B45309" }}>
                      {detail.stats.totalDilaporkan} pcs
                    </div>
                    <div style={{ fontSize: 10, color: "#D97706", fontWeight: 700 }}>
                      {detail.stats.pctCMT}% dari total
                    </div>
                  </div>

                  {/* Admin Verified */}
                  <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 12, padding: "10px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      <CheckCircle2 size={14} color="#16A34A" />
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#166534" }}>Di-ACC Mandor</span>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 900, color: "#15803D" }}>
                      {detail.stats.totalDisetujui} pcs
                    </div>
                    <div style={{ fontSize: 10, color: "#16A34A", fontWeight: 700 }}>
                      {detail.stats.pctDisetujui}% siap transfer
                    </div>
                  </div>

                  {/* Washing Progress */}
                  <div style={{ background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: 12, padding: "10px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      <Droplets size={14} color="#0284C7" />
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#0369A1" }}>Washing Jeans</span>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 900, color: "#0284C7" }}>
                      {detail.stats.totalWashingDone} / {detail.stats.totalWashing || 0}
                    </div>
                    <div style={{ fontSize: 10, color: "#0284C7", fontWeight: 700 }}>
                      {detail.stats.totalWashing > 0 ? `${detail.stats.pctWashing}% terkirim` : "Belum di-wash"}
                    </div>
                  </div>

                  {/* Gudang Jadi */}
                  <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 12, padding: "10px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      <Package size={14} color="#059669" />
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#065F46" }}>Gudang Jadi</span>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 900, color: "#047857" }}>
                      {detail.stats.totalDiGudang} pcs
                    </div>
                    <div style={{ fontSize: 10, color: "#059669", fontWeight: 700 }}>
                      {detail.stats.pctGudang}% produk beres
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* VISUAL JOURNEY STEPPER PIPELINE */}
            <div style={{ margin: "20px 28px 0" }}>
              <div style={{
                background: "#FFFFFF",
                borderRadius: 16,
                border: "1px solid #E2E8F0",
                padding: "20px 22px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.03)"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: "#EFF6FF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}>
                      <Truck size={15} color="#2563EB" />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: "#0F172A" }}>
                        Alur Posisi Fisik Kain (Journey Stepper)
                      </h3>
                      <span style={{ fontSize: 11, color: "#64748B" }}>
                        Status perjalanan kain dari bahan mentah hingga jadi celana jeans di gudang
                      </span>
                    </div>
                  </div>
                </div>

                {/* 6 Step Interactive Visual Pipeline */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
                  {/* STEP 1: POTONG KAIN */}
                  <div className="journey-step-box" style={{
                    background: "#F0FDF4",
                    border: "1.5px solid #BBF7D0",
                    borderRadius: 12,
                    padding: "12px 14px",
                    position: "relative"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{
                        width: 32,
                        height: 32,
                        borderRadius: 10,
                        background: "#DCFCE7",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}>
                        <Scissors size={16} color="#16A34A" />
                      </div>
                      <span style={{ background: "#DCFCE7", color: "#166534", fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 8 }}>
                        ✓ SELESAI
                      </span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>1. Pemotongan</div>
                    <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                      {detail.pemotongan?.tukang?.nama || "Tukang Potong"}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#16A34A", marginTop: 6 }}>
                      {detail.pemotongan?.total_pcs || detail.jumlahTerbit} pcs terpotong
                    </div>
                  </div>

                  {/* STEP 2: CMT / JAHIT */}
                  {(() => {
                    const isDone = detail.stats.totalDisetujui >= detail.jumlahTerbit;
                    const isProses = detail.stats.totalDilaporkan > 0;
                    return (
                      <div className="journey-step-box" style={{
                        background: isDone ? "#F0FDF4" : isProses ? "#FFFBEB" : "#F8FAFC",
                        border: `1.5px solid ${isDone ? "#BBF7D0" : isProses ? "#FDE68A" : "#E2E8F0"}`,
                        borderRadius: 12,
                        padding: "12px 14px",
                        position: "relative"
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <div style={{
                            width: 32,
                            height: 32,
                            borderRadius: 10,
                            background: isDone ? "#DCFCE7" : isProses ? "#FEF3C7" : "#F1F5F9",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                          }}>
                            <Zap size={16} color={isDone ? "#16A34A" : isProses ? "#D97706" : "#94A3B8"} />
                          </div>
                          <span style={{
                            background: isDone ? "#DCFCE7" : isProses ? "#FEF3C7" : "#F1F5F9",
                            color: isDone ? "#166534" : isProses ? "#92400E" : "#64748B",
                            fontSize: 9,
                            fontWeight: 800,
                            padding: "2px 7px",
                            borderRadius: 8
                          }}>
                            {isDone ? "✓ SELESAI" : isProses ? "SEDANG JAHIT" : "MENUNGGU"}
                          </span>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>2. Penjahitan (CMT)</div>
                        <div style={{ fontSize: 11, color: "#64748B", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {detail.vendorCMT?.nama || "Vendor CMT"}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: isDone ? "#16A34A" : isProses ? "#D97706" : "#64748B", marginTop: 6 }}>
                          {detail.stats.totalDisetujui} / {detail.jumlahTerbit} pcs di-ACC
                        </div>
                      </div>
                    );
                  })()}

                  {/* STEP 3: WASHING JEANS */}
                  {(() => {
                    const isDone = detail.stats.totalWashingDone > 0 && detail.stats.totalWashingDone >= detail.stats.totalWashing;
                    const isProses = detail.stats.totalWashing > 0;
                    return (
                      <div className="journey-step-box" style={{
                        background: isDone ? "#F0FDF4" : isProses ? "#F0F9FF" : "#F8FAFC",
                        border: `1.5px solid ${isDone ? "#BBF7D0" : isProses ? "#BAE6FD" : "#E2E8F0"}`,
                        borderRadius: 12,
                        padding: "12px 14px",
                        position: "relative"
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <div style={{
                            width: 32,
                            height: 32,
                            borderRadius: 10,
                            background: isDone ? "#DCFCE7" : isProses ? "#E0F2FE" : "#F1F5F9",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                          }}>
                            <Droplets size={16} color={isDone ? "#16A34A" : isProses ? "#0284C7" : "#94A3B8"} />
                          </div>
                          <span style={{
                            background: isDone ? "#DCFCE7" : isProses ? "#E0F2FE" : "#F1F5F9",
                            color: isDone ? "#166534" : isProses ? "#0369A1" : "#64748B",
                            fontSize: 9,
                            fontWeight: 800,
                            padding: "2px 7px",
                            borderRadius: 8
                          }}>
                            {isDone ? "✓ SELESAI" : isProses ? "WASHING" : "ANTREAN"}
                          </span>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>3. Washing Denim</div>
                        <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                          {detail.transfers?.find((t: any) => t.ke === "washing")?.vendor_ke_nama || "Vendor Laundry"}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: isDone ? "#16A34A" : isProses ? "#0284C7" : "#64748B", marginTop: 6 }}>
                          {detail.stats.totalWashingDone} / {detail.stats.totalWashing || 0} pcs cuci
                        </div>
                      </div>
                    );
                  })()}

                  {/* STEP 4: BERSIH BENANG & FINISHING */}
                  {(() => {
                    const finishingTransfer = detail.transfers?.find((t: any) => t.ke === "bersih_benang" || t.ke === "benang" || t.ke === "finishing");
                    const isDone = finishingTransfer?.status === "Diverifikasi";
                    const isProses = Boolean(finishingTransfer);
                    return (
                      <div className="journey-step-box" style={{
                        background: isDone ? "#F0FDF4" : isProses ? "#FAF5FF" : "#F8FAFC",
                        border: `1.5px solid ${isDone ? "#BBF7D0" : isProses ? "#E9D5FF" : "#E2E8F0"}`,
                        borderRadius: 12,
                        padding: "12px 14px",
                        position: "relative"
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <div style={{
                            width: 32,
                            height: 32,
                            borderRadius: 10,
                            background: isDone ? "#DCFCE7" : isProses ? "#F3E8FF" : "#F1F5F9",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                          }}>
                            <Sparkles size={16} color={isDone ? "#16A34A" : isProses ? "#9333EA" : "#94A3B8"} />
                          </div>
                          <span style={{
                            background: isDone ? "#DCFCE7" : isProses ? "#F3E8FF" : "#F1F5F9",
                            color: isDone ? "#166534" : isProses ? "#7E22CE" : "#64748B",
                            fontSize: 9,
                            fontWeight: 800,
                            padding: "2px 7px",
                            borderRadius: 8
                          }}>
                            {isDone ? "✓ SELESAI" : isProses ? "FINISHING" : "ANTREAN"}
                          </span>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>4. Bersih Benang</div>
                        <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                          {finishingTransfer?.vendor_ke_nama || "Kancing & Buang Benang"}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: isDone ? "#16A34A" : isProses ? "#9333EA" : "#64748B", marginTop: 6 }}>
                          {finishingTransfer ? `${finishingTransfer.jumlah_kirim} pcs pengerjaan` : "Menunggu washing"}
                        </div>
                      </div>
                    );
                  })()}

                  {/* STEP 5: QC GUDANG */}
                  {(() => {
                    const isDone = detail.stats.totalDiGudang > 0;
                    return (
                      <div className="journey-step-box" style={{
                        background: isDone ? "#F0FDF4" : "#F8FAFC",
                        border: `1.5px solid ${isDone ? "#BBF7D0" : "#E2E8F0"}`,
                        borderRadius: 12,
                        padding: "12px 14px",
                        position: "relative"
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <div style={{
                            width: 32,
                            height: 32,
                            borderRadius: 10,
                            background: isDone ? "#DCFCE7" : "#F1F5F9",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                          }}>
                            <CheckCircle2 size={16} color={isDone ? "#16A34A" : "#94A3B8"} />
                          </div>
                          <span style={{
                            background: isDone ? "#DCFCE7" : "#F1F5F9",
                            color: isDone ? "#166534" : "#64748B",
                            fontSize: 9,
                            fontWeight: 800,
                            padding: "2px 7px",
                            borderRadius: 8
                          }}>
                            {isDone ? "✓ QC PASS" : "PENDING"}
                          </span>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>5. Quality Control</div>
                        <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>Pemeriksaan Mutu Jeans</div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: isDone ? "#16A34A" : "#64748B", marginTop: 6 }}>
                          {isDone ? "Lolos sortir gudang" : "Menanti barang masuk"}
                        </div>
                      </div>
                    );
                  })()}

                  {/* STEP 6: GUDANG JADI */}
                  {(() => {
                    const isAllDone = detail.stats.totalDiGudang >= detail.jumlahTerbit;
                    return (
                      <div className="journey-step-box" style={{
                        background: isAllDone ? "#ECFDF5" : detail.stats.totalDiGudang > 0 ? "#EFF6FF" : "#F8FAFC",
                        border: `1.5px solid ${isAllDone ? "#6EE7B7" : detail.stats.totalDiGudang > 0 ? "#BFDBFE" : "#E2E8F0"}`,
                        borderRadius: 12,
                        padding: "12px 14px",
                        position: "relative"
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <div style={{
                            width: 32,
                            height: 32,
                            borderRadius: 10,
                            background: isAllDone ? "#D1FAE5" : detail.stats.totalDiGudang > 0 ? "#DBEAFE" : "#F1F5F9",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                          }}>
                            <Package size={16} color={isAllDone ? "#059669" : detail.stats.totalDiGudang > 0 ? "#2563EB" : "#94A3B8"} />
                          </div>
                          <span style={{
                            background: isAllDone ? "#D1FAE5" : detail.stats.totalDiGudang > 0 ? "#DBEAFE" : "#F1F5F9",
                            color: isAllDone ? "#065F46" : detail.stats.totalDiGudang > 0 ? "#1E40AF" : "#64748B",
                            fontSize: 9,
                            fontWeight: 800,
                            padding: "2px 7px",
                            borderRadius: 8
                          }}>
                            {isAllDone ? "100% GUDANG" : `${detail.stats.pctGudang}%`}
                          </span>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>6. Gudang Barang Jadi</div>
                        <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>Stok Siap Jual</div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: isAllDone ? "#059669" : "#2563EB", marginTop: 6 }}>
                          {detail.stats.totalDiGudang} pcs masuk
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* ASAL USUL BAHAN BAKU & PEMOTONGAN KAIN */}
            {detail.pemotongan && (
              <div style={{ margin: "20px 28px 0" }}>
                <div style={{
                  background: "#FFFFFF",
                  borderRadius: 16,
                  border: "1px solid #E2E8F0",
                  overflow: "hidden",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.03)"
                }}>
                  {/* Clean Denim Blue Header */}
                  <div style={{
                    background: "linear-gradient(90deg, #1E3A8A 0%, #2563EB 100%)",
                    padding: "14px 22px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: "rgba(255,255,255,0.18)",
                        backdropFilter: "blur(4px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}>
                        <Layers size={17} color="#FFFFFF" />
                      </div>
                      <div>
                        <div style={{ fontWeight: 900, fontSize: 14, color: "#FFFFFF", letterSpacing: "-0.01em" }}>
                          Asal-Usul Bahan Baku & Pemotongan Kain
                        </div>
                        <div style={{ fontSize: 11, color: "#BFDBFE" }}>
                          Spesifikasi roll kain, efisiensi meja potong, dan surat perintah potong
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{
                        background: "rgba(255,255,255,0.2)",
                        color: "#FFFFFF",
                        fontSize: 11,
                        fontWeight: 800,
                        padding: "3px 10px",
                        borderRadius: 20
                      }}>
                        SPK Potong #{detail.pemotongan.id}
                      </span>
                    </div>
                  </div>

                  {/* Body Content 5-Column Grid */}
                  <div style={{
                    padding: "20px 22px",
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 16,
                    borderBottom: "1px solid #F1F5F9"
                  }}>
                    {/* 1. KODE & JENIS KAIN */}
                    <div style={{ background: "#F8FAFC", padding: "12px 14px", borderRadius: 12, border: "1px solid #E2E8F0" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <Box size={14} color="#2563EB" />
                        <span style={{ fontSize: 10, fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>
                          Kode & Lot Bahan
                        </span>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 900, color: "#0F172A", wordBreak: "break-word" }}>
                        {detail.pemotongan.nama_barang}
                      </div>
                      <div style={{ fontSize: 11, color: "#475569", marginTop: 4, fontWeight: 600 }}>
                        {[detail.pemotongan.kain?.jenis, detail.pemotongan.kain?.warna].filter(Boolean).join(" • ") || "Denim Standar"}
                      </div>
                    </div>

                    {/* 2. TANGGAL POTONG */}
                    <div style={{ background: "#F8FAFC", padding: "12px 14px", borderRadius: 12, border: "1px solid #E2E8F0" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <Calendar size={14} color="#059669" />
                        <span style={{ fontSize: 10, fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>
                          Waktu Pemotongan
                        </span>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>
                        {fmtDate(detail.pemotongan.tanggal)}
                      </div>
                      <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>
                        Dicatat: {fmtDT(detail.pemotongan.createdAt)}
                      </div>
                    </div>

                    {/* 3. TUKANG POTONG */}
                    <div style={{ background: "#F8FAFC", padding: "12px 14px", borderRadius: 12, border: "1px solid #E2E8F0" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <Scissors size={14} color="#8B5CF6" />
                        <span style={{ fontSize: 10, fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>
                          Tukang Potong (Meja)
                        </span>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>
                        {detail.pemotongan.tukang?.nama || "—"}
                      </div>
                      <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>
                        {detail.pemotongan.tukang?.kode ? `Kode: ${detail.pemotongan.tukang.kode}` : "Meja Internal"}
                      </div>
                    </div>

                    {/* 4. EFISIENSI KAIN */}
                    <div style={{ background: "#F8FAFC", padding: "12px 14px", borderRadius: 12, border: "1px solid #E2E8F0" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <SlidersHorizontal size={14} color="#D97706" />
                        <span style={{ fontSize: 10, fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>
                          Efisiensi & Meter Kain
                        </span>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 900, color: "#0F172A" }}>
                        {detail.pemotongan.meter_kain} meter
                      </div>
                      <div style={{ fontSize: 11, color: "#D97706", fontWeight: 700, marginTop: 4 }}>
                        {detail.pemotongan.pemakaian_cm} cm/pcs • Total {detail.pemotongan.total_pcs} pcs
                      </div>
                    </div>

                    {/* 5. VENDOR TUJUAN AWAL */}
                    <div style={{ background: "#F8FAFC", padding: "12px 14px", borderRadius: 12, border: "1px solid #E2E8F0" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <Building2 size={14} color="#0284C7" />
                        <span style={{ fontSize: 10, fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>
                          Vendor CMT Awal
                        </span>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#0284C7" }}>
                        {detail.vendorCMT?.nama || "—"}
                      </div>
                      <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>
                        Tipe: {detail.vendorCMT?.jenis_pekerjaan || detail.vendorCMT?.tipe || "CMT Denim"}
                      </div>
                    </div>
                  </div>

                  {/* Size Distribution & Sisa Potongan */}
                  <div style={{ padding: "14px 22px", background: "#F8FAFC", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Layers size={14} color="#64748B" />
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>
                        Hasil Meja Potong per Ukuran:
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1 }}>
                      {(detail.pemotongan.sizeBreakdown || []).map((s: any) => {
                        const sisa = Number(s.sisa || 0);
                        return (
                          <div
                            key={s.size}
                            style={{
                              background: "#FFFFFF",
                              border: `1px solid ${sisa > 0 ? "#86EFAC" : "#E2E8F0"}`,
                              borderRadius: 8,
                              padding: "3px 9px",
                              fontSize: 11,
                              display: "flex",
                              alignItems: "center",
                              gap: 6
                            }}
                          >
                            <span style={{ fontWeight: 800, color: "#0F172A" }}>{s.size}:</span>
                            <span style={{ fontWeight: 700, color: "#2563EB" }}>{s.jumlah} pcs</span>
                            {sisa > 0 ? (
                              <span style={{ background: "#DCFCE7", color: "#166534", fontSize: 9, fontWeight: 800, padding: "1px 5px", borderRadius: 4 }}>
                                +{sisa} sisa
                              </span>
                            ) : (
                              <span style={{ color: "#94A3B8", fontSize: 10 }}>terbit semua</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TIMELINE RIWAYAT PERJALANAN LENGKAP */}
            <div style={{ margin: "24px 28px 40px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    width: 26,
                    height: 26,
                    borderRadius: 8,
                    background: "#EFF6FF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    <Clock size={14} color="#2563EB" />
                  </div>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: "#0F172A", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Riwayat Perjalanan Lengkap (Log Fisik)
                  </h3>
                </div>
                <span style={{ fontSize: 12, color: "#64748B" }}>
                  Diurutkan kronologis dari awal terbit
                </span>
              </div>

              {/* Vertical Timeline container */}
              <div style={{ position: "relative" }}>
                {/* Connecting track line */}
                <div style={{
                  position: "absolute",
                  top: 24,
                  bottom: 24,
                  left: 20,
                  width: 2,
                  background: "#CBD5E1",
                  borderRadius: 2
                }} />

                {/* Event 0: Penerbitan PO */}
                <TimelineEventNode
                  icon={<FileText size={17} color="#2563EB" />}
                  iconBg="#EFF6FF"
                  iconBorder="#BFDBFE"
                  badgeText="Penerbitan PO Produksi"
                  badgeBg="#EFF6FF"
                  badgeColor="#1E40AF"
                  time={fmtDT(detail.tanggalTerbit)}
                  title={`Surat Perintah Kerja (PO ${detail.noPo}) Diterbitkan`}
                  subtitle={`Model: ${detail.model} • Vendor Jahit Utama: ${detail.vendorCMT?.nama || "-"} • Target: ${detail.jumlahTerbit} pcs`}
                  extraNote={detail.catatan}
                  sizes={detail.sizeBreakdown}
                  totalPcs={detail.jumlahTerbit}
                />

                {/* CMT In-Progress Active marker */}
                {detail.status === "Dikerjakan" && (
                  <TimelineEventNode
                    icon={<Zap size={17} color="#D97706" />}
                    iconBg="#FFFBEB"
                    iconBorder="#FDE68A"
                    badgeText="CMT Sedang Berjalan"
                    badgeBg="#FEF3C7"
                    badgeColor="#92400E"
                    time="Sedang Pengerjaan"
                    title={`Vendor ${detail.vendorCMT?.nama || "CMT"} Sedang Menjahit Bahan`}
                    subtitle={`Menunggu laporan batch potongan yang selesai dirakit`}
                  />
                )}

                {/* CMT Progress Reports */}
                {(detail.cmtRecords || []).map((rec: any) => {
                  const isACC = rec.status === "Diverifikasi" || rec.status === "Diterima";
                  const totalRec = (rec.items || []).reduce((s: number, i: any) => s + Number(i.jumlah || 0), 0);

                  return (
                    <TimelineEventNode
                      key={`cmt-${rec.id}`}
                      icon={<CheckCircle2 size={17} color={isACC ? "#16A34A" : "#D97706"} />}
                      iconBg={isACC ? "#F0FDF4" : "#FFFBEB"}
                      iconBorder={isACC ? "#86EFAC" : "#FDE68A"}
                      badgeText={isACC ? "Laporan CMT — Di-ACC" : "Laporan CMT — Menunggu ACC"}
                      badgeBg={isACC ? "#DCFCE7" : "#FEF3C7"}
                      badgeColor={isACC ? "#166534" : "#92400E"}
                      time={fmtDT(rec.createdAt)}
                      title={`${rec.vendor_nama} melaporkan ${totalRec} pcs siap tarik`}
                      subtitle={isACC ? (
                        <span>Di-ACC oleh Mandor / Admin {rec.diterimaPada ? `(${fmtDT(rec.diterimaPada)})` : ""}</span>
                      ) : "Menunggu verifikasi fisik oleh mandor produksi"}
                      extraNote={rec.catatan}
                      sizes={rec.items?.map((i: any) => ({ size: i.size, jumlah: i.jumlah }))}
                      totalPcs={totalRec}
                    />
                  );
                })}

                {/* Produksi Transfers (Washing, Finishing, etc) */}
                {(detail.transfers || []).map((t: any) => {
                  const isWashing = t.ke === "washing";
                  const isDone = t.status === "Diverifikasi" || t.status === "Diterima";

                  return (
                    <TimelineEventNode
                      key={`tr-${t.id}`}
                      icon={isWashing ? <Droplets size={17} color={isDone ? "#16A34A" : "#0284C7"} /> : <Truck size={17} color="#2563EB" />}
                      iconBg={isDone ? "#F0FDF4" : isWashing ? "#F0F9FF" : "#EFF6FF"}
                      iconBorder={isDone ? "#86EFAC" : isWashing ? "#BAE6FD" : "#BFDBFE"}
                      badgeText={isWashing ? `Transfer Washing ${isDone ? "— Selesai" : "— Kirim"}` : `Transfer ${t.ke.toUpperCase()}`}
                      badgeBg={isDone ? "#DCFCE7" : isWashing ? "#E0F2FE" : "#DBEAFE"}
                      badgeColor={isDone ? "#166534" : isWashing ? "#0369A1" : "#1E40AF"}
                      time={fmtDT(t.tanggal_kirim)}
                      title={`Pengiriman ke Vendor: ${t.vendor_ke_nama || t.ke}`}
                      subtitle={isDone ? `Barang selesai dikerjakan & diverifikasi (${t.jumlah_diterima || t.jumlah_kirim} pcs)` : `Status: ${t.status || "Dalam Proses"} (${t.jumlah_kirim} pcs)`}
                      extraNote={t.catatan}
                      sizes={t.sizeBreakdown}
                      totalPcs={t.jumlah_kirim}
                    />
                  );
                })}

                {/* Ledgers (Perpindahan Gudang / Mutasi) */}
                {(detail.ledgers || [])
                  .filter((l: any) => l.dari !== "SISTEM" && l.dari_vendor_id !== "SISTEM")
                  .map((l: any) => {
                    const isGudang = l.ke_vendor_id === "GUDANG";

                    return (
                      <TimelineEventNode
                        key={`l-${l.id}`}
                        icon={isGudang ? <Package size={17} color="#16A34A" /> : <ArrowRight size={17} color="#2563EB" />}
                        iconBg={isGudang ? "#F0FDF4" : "#EFF6FF"}
                        iconBorder={isGudang ? "#86EFAC" : "#BFDBFE"}
                        badgeText={isGudang ? "Masuk Gudang Jadi" : "Tarik Barang"}
                        badgeBg={isGudang ? "#DCFCE7" : "#DBEAFE"}
                        badgeColor={isGudang ? "#166534" : "#1E40AF"}
                        time={fmtDT(l.tanggal)}
                        title={isGudang ? `Barang Masuk Gudang: ${l.jumlah} pcs` : `Dipindah ke: ${l.ke_nama}`}
                        subtitle={`Asal pengirim: ${l.dari_nama}`}
                        extraNote={l.catatan}
                        totalPcs={l.jumlah}
                      />
                    );
                  })}

                {/* Empty Activity State */}
                {detail.cmtRecords?.length === 0 && detail.transfers?.length === 0 && (
                  <div style={{
                    marginLeft: 54,
                    padding: "20px 24px",
                    background: "#FFFFFF",
                    borderRadius: 14,
                    border: "1.5px dashed #CBD5E1",
                    color: "#64748B",
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                    gap: 12
                  }}>
                    <Clock size={18} color="#94A3B8" />
                    <div>
                      <strong style={{ color: "#0F172A", display: "block" }}>Belum Ada Aktivitas Lanjutan</strong>
                      <span>Kain telah dipotong dan diserahkan ke vendor jahit ({detail.vendorCMT?.nama || "CMT"}). Menunggu laporan pengerjaan pertama.</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// MODERN TIMELINE EVENT COMPONENT
function TimelineEventNode({
  icon,
  iconBg,
  iconBorder,
  badgeText,
  badgeBg,
  badgeColor,
  time,
  title,
  subtitle,
  extraNote,
  sizes,
  totalPcs
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconBorder: string;
  badgeText: string;
  badgeBg: string;
  badgeColor: string;
  time: string;
  title: string;
  subtitle?: React.ReactNode;
  extraNote?: string;
  sizes?: { size: string; jumlah: number | string }[];
  totalPcs?: number;
}) {
  return (
    <div style={{ display: "flex", gap: 16, marginBottom: 18, position: "relative" }}>
      {/* Node Icon Circle */}
      <div style={{ position: "relative", zIndex: 2, flexShrink: 0 }}>
        <div style={{
          width: 42,
          height: 42,
          borderRadius: "50%",
          background: iconBg,
          border: `2px solid ${iconBorder}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 0 0 5px #F8FAFC"
        }}>
          {icon}
        </div>
      </div>

      {/* Event Details Card */}
      <div style={{
        flex: 1,
        background: "#FFFFFF",
        borderRadius: 14,
        padding: "16px 20px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
        border: "1px solid #E2E8F0",
        transition: "transform 0.15s ease, box-shadow 0.15s ease"
      }}>
        {/* Top: Time & Badges */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
          <div>
            <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600, display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
              <Clock size={12} color="#94A3B8" />
              <span>{time}</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 900, color: "#0F172A", lineHeight: 1.3 }}>
              {title}
            </div>
            {subtitle && (
              <div style={{ fontSize: 12, color: "#475569", marginTop: 3 }}>
                {subtitle}
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{
              background: badgeBg,
              color: badgeColor,
              fontSize: 10,
              fontWeight: 800,
              padding: "3px 10px",
              borderRadius: 20,
              whiteSpace: "nowrap"
            }}>
              {badgeText}
            </span>
            {totalPcs !== undefined && (
              <span style={{
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                color: "#0F172A",
                fontWeight: 900,
                fontSize: 12,
                padding: "3px 9px",
                borderRadius: 20
              }}>
                {totalPcs} pcs
              </span>
            )}
          </div>
        </div>

        {/* Size breakdown chips */}
        {sizes && sizes.length > 0 && (
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
            {sizes.map((s: any, i: number) => (
              <span
                key={i}
                style={{
                  background: "#F1F5F9",
                  border: "1px solid #E2E8F0",
                  color: "#334155",
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 6
                }}
              >
                {s.size}: <strong style={{ color: "#0F172A" }}>{s.jumlah} pcs</strong>
              </span>
            ))}
          </div>
        )}

        {/* Note / Catatan */}
        {extraNote && (
          <div style={{
            marginTop: 10,
            background: "#F8FAFC",
            border: "1px dashed #CBD5E1",
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 12,
            color: "#475569"
          }}>
            <span style={{ fontWeight: 700, color: "#64748B", marginRight: 6 }}>Catatan:</span>
            {extraNote}
          </div>
        )}
      </div>
    </div>
  );
}
