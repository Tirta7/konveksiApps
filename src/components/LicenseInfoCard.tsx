"use client";

import { useState, useEffect } from "react";
import { 
  ShieldCheck, 
  ShieldAlert, 
  Key, 
  Cpu, 
  Server, 
  Calendar, 
  RefreshCw, 
  Copy, 
  Check 
} from "lucide-react";

interface LicenseData {
  allowed: boolean;
  status: string;
  reason: string;
  machineId: string;
  storeName: string;
  serverUrl?: string;
  product?: string;
  productName?: string;
  appVersion?: string;
  expiresAt: string | null;
  licenseKey: string | null;
  lastChecked: string | null;
  disabled?: boolean;
}

export default function LicenseInfoCard() {
  const [data, setData] = useState<LicenseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [showFullKey, setShowFullKey] = useState(false);

  async function fetchLicenseStatus(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    try {
      const url = isRefresh ? "/api/license-status?refresh=1" : "/api/license-status";
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setData(json);
        if (json.allowed === false) {
          window.location.reload();
          return;
        }
      }
    } catch (err) {
      console.error("Gagal mengambil info lisensi:", err);
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchLicenseStatus();
  }, []);

  const handleCopy = (text: string, type: "id" | "key") => {
    navigator.clipboard.writeText(text);
    if (type === "id") {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } else {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  if (loading && !data) {
    return (
      <div style={{ background: "white", borderRadius: 16, border: "1px solid #E2E8F0", padding: 24, boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#64748B" }}>
          <RefreshCw size={18} className="animate-spin" />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Memuat detail lisensi perangkat...</span>
        </div>
      </div>
    );
  }

  const isAllowed = data?.allowed;

  // Hitung sisa hari masa aktif
  let daysLeft: number | null = null;
  if (data?.expiresAt) {
    const exp = new Date(data.expiresAt).getTime();
    const now = Date.now();
    daysLeft = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
  }

  return (
    <div style={{
      background: "white",
      borderRadius: 16,
      border: isAllowed ? "1px solid #BBF7D0" : "1px solid #FECACA",
      boxShadow: "0 4px 14px rgba(0,0,0,0.03)",
      overflow: "hidden"
    }}>
      {/* HEADER SECTION */}
      <div style={{
        background: isAllowed 
          ? "linear-gradient(135deg, #064E3B 0%, #065F46 50%, #047857 100%)" 
          : "linear-gradient(135deg, #7F1D1D 0%, #991B1B 50%, #B91C1C 100%)",
        padding: "20px 24px",
        color: "white",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 14
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "rgba(255,255,255,0.15)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid rgba(255,255,255,0.25)",
            boxShadow: "0 4px 10px rgba(0,0,0,0.15)"
          }}>
            {isAllowed ? <ShieldCheck size={26} color="#4ADE80" /> : <ShieldAlert size={26} color="#F87171" />}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h2 style={{ fontSize: 16, fontWeight: 900, color: "white", margin: 0, letterSpacing: "-0.01em" }}>
                Informasi Lisensi Perangkat
              </h2>
              <span style={{
                fontSize: 10,
                fontWeight: 800,
                background: isAllowed ? "#22C55E" : "#EF4444",
                color: "#FFFFFF",
                padding: "2px 8px",
                borderRadius: 20,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                boxShadow: "0 2px 6px rgba(0,0,0,0.2)"
              }}>
                {isAllowed ? "Resmi & Sah" : "Perlu Aktivasi"}
              </span>
            </div>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", margin: "3px 0 0 0" }}>
              Sistem perlindungan enkripsi hardware & verifikasi lisensi perangkat aktif.
            </p>
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={() => fetchLicenseStatus(true)}
            disabled={refreshing}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.3)",
              color: "white",
              padding: "8px 16px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              cursor: refreshing ? "not-allowed" : "pointer",
              transition: "all 0.2s ease"
            }}
            title="Periksa status lisensi ke server"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Memeriksa..." : "Sinkronkan Lisensi"}
          </button>
        </div>
      </div>

      {/* BODY GRID */}
      <div style={{ padding: 24, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        
        {/* FIELD 1: STATUS AKTIVASI */}
        <div style={{
          background: "#F8FAFC",
          border: "1px solid #E2E8F0",
          borderRadius: 12,
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 6
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Status Lisensi
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: isAllowed ? "#10B981" : "#EF4444",
                display: "inline-block"
              }} />
              <span style={{ fontSize: 12, fontWeight: 800, color: isAllowed ? "#059669" : "#DC2626" }}>
                {data?.reason || (isAllowed ? "Aktif" : "Terkunci")}
              </span>
            </div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#1E293B" }}>
            {isAllowed ? "Aplikasi Berjalan Penuh Tanpa Batasan" : "Menunggu Konfirmasi Aktivasi"}
          </div>
          <div style={{ fontSize: 11, color: "#64748B" }}>
            Pengecekan berkala otomatis setiap 3 jam (dan toleransi proteksi offline).
          </div>
        </div>

        {/* FIELD 2: MACHINE ID (HARDWARE LOCKED) */}
        <div style={{
          background: "#F8FAFC",
          border: "1px solid #E2E8F0",
          borderRadius: 12,
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 6
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 4 }}>
              <Cpu size={13} color="#2563EB" /> Hardware Machine ID
            </span>
            <button
              type="button"
              onClick={() => handleCopy(data?.machineId || "", "id")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                background: copiedId ? "#DCFCE7" : "#FFFFFF",
                border: copiedId ? "1px solid #86EFAC" : "1px solid #CBD5E1",
                color: copiedId ? "#166534" : "#475569",
                borderRadius: 6,
                padding: "2px 8px",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              {copiedId ? <Check size={12} color="#166534" /> : <Copy size={12} />}
              {copiedId ? "Tersalin!" : "Salin ID"}
            </button>
          </div>
          <div>
            <span style={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontSize: 14,
              fontWeight: 800,
              background: "#0F172A",
              color: "#38BDF8",
              padding: "4px 10px",
              borderRadius: 6,
              display: "inline-block",
              letterSpacing: "0.06em"
            }}>
              {data?.machineId || "MID-UNKNOWN"}
            </span>
          </div>
          <div style={{ fontSize: 11, color: "#64748B" }}>
            Terkunci pada serial hardware motherboard komputer ini.
          </div>
        </div>

        {/* FIELD 3: MASA AKTIF & EXPIRED */}
        <div style={{
          background: "#F8FAFC",
          border: "1px solid #E2E8F0",
          borderRadius: 12,
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 6
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 4 }}>
              <Calendar size={13} color="#D97706" /> Masa Aktif Lisensi
            </span>
            {daysLeft !== null && (
              <span style={{
                fontSize: 11,
                fontWeight: 800,
                background: daysLeft > 10 ? "#EFF6FF" : "#FEF3C7",
                color: daysLeft > 10 ? "#2563EB" : "#B45309",
                padding: "2px 8px",
                borderRadius: 6,
                border: daysLeft > 10 ? "1px solid #BFDBFE" : "1px solid #FDE68A"
              }}>
                {daysLeft > 0 ? `${daysLeft} Hari Lagi` : "Kedaluwarsa Hari Ini"}
              </span>
            )}
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#1E293B" }}>
            {data?.expiresAt ? (
              new Date(data.expiresAt).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric"
              })
            ) : (
              "Lisensi Aktif (Masa Uji Coba / Standar)"
            )}
          </div>
          <div style={{ fontSize: 11, color: "#64748B" }}>
            Hubungi administrator / penyedia sistem untuk perpanjangan masa aktif.
          </div>
        </div>

        {/* FIELD 4: SERVER OTENTIKASI & TOKO TERDAFTAR */}
        <div style={{
          background: "#F8FAFC",
          border: "1px solid #E2E8F0",
          borderRadius: 12,
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 6
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 4 }}>
              <Server size={13} color="#059669" /> Server Otentikasi Lisensi
            </span>
            <span style={{
              fontSize: 10,
              fontWeight: 800,
              background: "#ECFDF5",
              color: "#059669",
              padding: "2px 6px",
              borderRadius: 6,
              border: "1px solid #A7F3D0"
            }}>
              ● Terhubung (Online)
            </span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#1E293B" }}>
            Server Otentikasi Cloud Terverifikasi
          </div>
          <div style={{ fontSize: 11, color: "#64748B" }}>
            Outlet Terdaftar: <strong>{data?.storeName || "Konveksi Utama"}</strong> (Edisi: Enterprise)
          </div>
        </div>

      </div>

      {/* FOOTER: LICENSE KEY (OFFLINE TOKEN) */}
      {data?.licenseKey && (
        <div style={{
          borderTop: "1px solid #F1F5F9",
          padding: "16px 24px",
          background: "#FAFBFD",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 260 }}>
            <Key size={16} color="#64748B" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Kunci Lisensi Resmi (Hardware Signed Token)
              </div>
              <div style={{
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontSize: 11,
                color: "#334155",
                background: "#FFFFFF",
                border: "1px solid #CBD5E1",
                borderRadius: 6,
                padding: "4px 8px",
                marginTop: 4,
                wordBreak: "break-all"
              }}>
                {showFullKey ? data.licenseKey : `${data.licenseKey.substring(0, 36)}...`}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => setShowFullKey(!showFullKey)}
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#2563EB",
                background: "white",
                border: "1px solid #BFDBFE",
                padding: "6px 12px",
                borderRadius: 6,
                cursor: "pointer"
              }}
            >
              {showFullKey ? "Sembunyikan" : "Tampilkan Penuh"}
            </button>
            <button
              type="button"
              onClick={() => handleCopy(data.licenseKey || "", "key")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 11,
                fontWeight: 700,
                color: copiedKey ? "#166534" : "#1E293B",
                background: copiedKey ? "#DCFCE7" : "white",
                border: copiedKey ? "1px solid #86EFAC" : "1px solid #CBD5E1",
                padding: "6px 12px",
                borderRadius: 6,
                cursor: "pointer"
              }}
            >
              {copiedKey ? <Check size={13} color="#166534" /> : <Copy size={13} />}
              {copiedKey ? "Tersalin!" : "Salin Kunci"}
            </button>
          </div>
        </div>
      )}

      {/* SYNC INFO TIMESTAMP */}
      <div style={{
        background: "#F1F5F9",
        padding: "8px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: 11,
        color: "#64748B"
      }}>
        <span>Versi Sistem: <strong>v{data?.appVersion || "1.0.0"}</strong> (Production Build)</span>
        <span>
          Terakhir diverifikasi:{" "}
          <strong>
            {data?.lastChecked ? new Date(data.lastChecked).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "-"}
          </strong>
        </span>
      </div>
    </div>
  );
}
