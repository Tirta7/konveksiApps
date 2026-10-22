"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { 
  Store, 
  RefreshCw, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Trash2, 
  Power, 
  Clock, 
  ShieldCheck,
  ShoppingBag
} from "lucide-react";

interface Shop {
  key: string;
  platform: "tiktok" | "shopee";
  shop_id: string;
  shop_name: string;
  label: string;
  region?: string;
  aktif: boolean;
  connected_at: string;
  token_valid_until?: string | null;
  perlu_hubungkan_ulang?: boolean;
  last_sync_run?: string | null;
  last_result?: {
    added: number;
    updated: number;
    skipped: number;
    cancelledScanned: number;
    orders: number;
  } | null;
  last_error?: string | null;
}

interface ConfigStatus {
  app_url: string;
  tiktok: { configured: boolean };
  shopee: { configured: boolean; sandbox?: boolean };
  urls: {
    app_url: string;
    tiktok_redirect: string;
    tiktok_webhook: string;
    shopee_redirect: string;
    shopee_webhook: string;
  };
}

export default function MarketplaceManagement() {
  const [config, setConfig] = useState<ConfigStatus | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingKey, setSyncingKey] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);

  const fetchStatus = async () => {
    try {
      const [resCfg, resShops] = await Promise.all([
        fetch("/api/marketplace/config"),
        fetch("/api/marketplace/shops"),
      ]);
      if (resCfg.ok) setConfig(await resCfg.json());
      if (resShops.ok) setShops(await resShops.json());
    } catch {
      toast.error("Gagal memuat status marketplace");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} disalin ke clipboard!`);
  };

  const handleConnect = async (platform: "tiktok" | "shopee") => {
    try {
      const res = await fetch(`/api/marketplace/${platform}/auth`);
      const json = await res.json();
      if (!res.ok || !json.url) {
        throw new Error(json.error || "Gagal membuat link otorisasi");
      }
      window.location.href = json.url;
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleSync = async (key?: string) => {
    if (key) setSyncingKey(key);
    else setSyncingAll(true);

    try {
      const res = await fetch("/api/marketplace/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(key ? { key } : {}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal sinkron");

      if (key && json.result) {
        const r = json.result;
        toast.success(
          `Sinkron selesai: ${r.added || 0} baru, ${r.updated || 0} diperbarui` +
            (r.cancelledScanned ? ` (PERINGATAN: ${r.cancelledScanned} pesanan batal memiliki scan)` : "")
        );
      } else {
        toast.success("Sinkronisasi semua toko selesai");
      }
      fetchStatus();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSyncingKey(null);
      setSyncingAll(false);
    }
  };

  const handleToggleAktif = async (shop: Shop) => {
    try {
      const res = await fetch("/api/marketplace/shops", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: shop.key, aktif: !shop.aktif }),
      });
      if (!res.ok) throw new Error("Gagal memperbarui status toko");
      toast.success(`Toko ${shop.shop_name} ${!shop.aktif ? "diaktifkan" : "dinonaktifkan"}`);
      fetchStatus();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (shop: Shop) => {
    if (!confirm(`Yakin ingin memutuskan hubungan toko "${shop.shop_name}"? Token otorisasi akan dihapus.`)) return;
    try {
      const res = await fetch(`/api/marketplace/shops?key=${encodeURIComponent(shop.key)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menghapus toko");
      toast.success(json.message || "Toko berhasil diputuskan");
      fetchStatus();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div style={{ background: "white", borderRadius: 16, border: "1px solid #E2E8F0", padding: 24, marginTop: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ background: "linear-gradient(135deg, #FF0050, #00F2FE)", padding: 8, borderRadius: 10, color: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Store size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", margin: 0 }}>Integrasi Marketplace Langsung</h2>
              <p style={{ fontSize: 13, color: "#64748B", margin: "2px 0 0" }}>
                Hubungkan pesanan dari TikTok Shop, Tokopedia, dan Shopee langsung via API resmi tanpa perlu bolak-balik ekspor CSV.
              </p>
            </div>
          </div>
        </div>

        {shops.length > 0 && (
          <button
            onClick={() => handleSync()}
            disabled={syncingAll}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "#3B82F6",
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 700,
              cursor: syncingAll ? "not-allowed" : "pointer",
              opacity: syncingAll ? 0.7 : 1,
            }}
          >
            <RefreshCw size={15} className={syncingAll ? "animate-spin" : ""} />
            {syncingAll ? "Menyinkronkan..." : "Sinkron Semua Toko"}
          </button>
        )}
      </div>

      {/* Grid Status Kredensial API */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* TikTok / Tokopedia Card */}
        <div style={{ background: "#F8FAFC", borderRadius: 12, border: "1px solid #E2E8F0", padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>TikTok Shop & Tokopedia</span>
              <span style={{ fontSize: 10, fontWeight: 700, background: "#0F172A", color: "white", padding: "2px 6px", borderRadius: 4 }}>Partner API</span>
            </div>
            {config?.tiktok.configured ? (
              <span style={{ fontSize: 11, fontWeight: 700, color: "#10B981", display: "inline-flex", alignItems: "center", gap: 4 }}>
                <CheckCircle2 size={13} /> Kunci API Siap
              </span>
            ) : (
              <span style={{ fontSize: 11, fontWeight: 700, color: "#F59E0B", display: "inline-flex", alignItems: "center", gap: 4 }}>
                <AlertCircle size={13} /> Belum di .env
              </span>
            )}
          </div>
          <p style={{ fontSize: 12, color: "#64748B", margin: "0 0 12px" }}>
            Toko Tokopedia kini dikelola satu pintu lewat TikTok Shop Partner Center.
          </p>
          <button
            onClick={() => handleConnect("tiktok")}
            disabled={!config?.tiktok.configured}
            style={{
              width: "100%",
              background: config?.tiktok.configured ? "linear-gradient(135deg, #0F172A, #334155)" : "#E2E8F0",
              color: config?.tiktok.configured ? "white" : "#94A3B8",
              border: "none",
              borderRadius: 8,
              padding: "9px 14px",
              fontSize: 13,
              fontWeight: 700,
              cursor: config?.tiktok.configured ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <ExternalLink size={15} /> Hubungkan Toko TikTok / Tokopedia
          </button>
        </div>

        {/* Shopee Card */}
        <div style={{ background: "#F8FAFC", borderRadius: 12, border: "1px solid #E2E8F0", padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>Shopee</span>
              <span style={{ fontSize: 10, fontWeight: 700, background: "#EE4D2D", color: "white", padding: "2px 6px", borderRadius: 4 }}>
                {config?.shopee.sandbox ? "Sandbox" : "Open Platform v2"}
              </span>
            </div>
            {config?.shopee.configured ? (
              <span style={{ fontSize: 11, fontWeight: 700, color: "#10B981", display: "inline-flex", alignItems: "center", gap: 4 }}>
                <CheckCircle2 size={13} /> Kunci API Siap
              </span>
            ) : (
              <span style={{ fontSize: 11, fontWeight: 700, color: "#F59E0B", display: "inline-flex", alignItems: "center", gap: 4 }}>
                <AlertCircle size={13} /> Belum di .env
              </span>
            )}
          </div>
          <p style={{ fontSize: 12, color: "#64748B", margin: "0 0 12px" }}>
            Integrasi Shopee via Open Platform (Seller In-House System). Token otomatis refresh.
          </p>
          <button
            onClick={() => handleConnect("shopee")}
            disabled={!config?.shopee.configured}
            style={{
              width: "100%",
              background: config?.shopee.configured ? "#EE4D2D" : "#E2E8F0",
              color: config?.shopee.configured ? "white" : "#94A3B8",
              border: "none",
              borderRadius: 8,
              padding: "9px 14px",
              fontSize: 13,
              fontWeight: 700,
              cursor: config?.shopee.configured ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <ExternalLink size={15} /> Hubungkan Toko Shopee
          </button>
        </div>
      </div>

      {/* Daftar Toko Terhubung */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: "#0F172A", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
          <ShoppingBag size={16} /> Toko yang Terhubung ({shops.length})
        </h3>

        {shops.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", background: "#F8FAFC", borderRadius: 12, border: "1px dashed #CBD5E1" }}>
            <p style={{ fontSize: 13, color: "#64748B", margin: 0 }}>
              Belum ada toko yang terhubung. Pastikan API key sudah diisi di <code>.env</code> lalu klik tombol "Hubungkan Toko" di atas.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {shops.map((s) => {
              const isSyncing = syncingKey === s.key || syncingAll;
              return (
                <div
                  key={s.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: 16,
                    borderRadius: 12,
                    border: "1px solid #E2E8F0",
                    background: s.aktif ? "white" : "#F8FAFC",
                    opacity: s.aktif ? 1 : 0.7,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div
                      style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        fontWeight: 800,
                        fontSize: 12,
                        background:
                          s.platform === "shopee"
                            ? "#FFEDD5"
                            : s.label === "Tokopedia"
                            ? "#DCFCE7"
                            : "#F1F5F9",
                        color:
                          s.platform === "shopee"
                            ? "#C2410C"
                            : s.label === "Tokopedia"
                            ? "#15803D"
                            : "#0F172A",
                      }}
                    >
                      {s.label}
                    </div>

                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>{s.shop_name}</span>
                        <span style={{ fontSize: 11, color: "#94A3B8" }}>ID: {s.shop_id}</span>
                        {s.perlu_hubungkan_ulang && (
                          <span style={{ fontSize: 10, fontWeight: 700, background: "#FEE2E2", color: "#DC2626", padding: "1px 6px", borderRadius: 4 }}>
                            Perlu Hubungkan Ulang
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4, fontSize: 12, color: "#64748B" }}>
                        <span>
                          <Clock size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
                          Sinkron terakhir: {s.last_sync_run ? new Date(s.last_sync_run).toLocaleString("id-ID") : "Belum pernah"}
                        </span>
                        {s.last_result && (
                          <span style={{ color: "#059669", fontWeight: 600 }}>
                            ({s.last_result.added} pesanan baru, {s.last_result.updated} diperbarui)
                          </span>
                        )}
                        {s.last_result?.cancelledScanned ? (
                          <span style={{ color: "#DC2626", fontWeight: 700 }}>
                            ⚠️ {s.last_result.cancelledScanned} order batal sudah ter-scan
                          </span>
                        ) : null}
                        {s.last_error && (
                          <span style={{ color: "#DC2626" }}>Error: {s.last_error}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      onClick={() => handleSync(s.key)}
                      disabled={isSyncing || !s.aktif}
                      title="Sinkronkan pesanan toko ini sekarang"
                      style={{
                        background: "#F1F5F9",
                        border: "1px solid #CBD5E1",
                        color: "#0F172A",
                        padding: "6px 12px",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: isSyncing || !s.aktif ? "not-allowed" : "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <RefreshCw size={13} className={isSyncing ? "animate-spin" : ""} />
                      {isSyncing ? "Sinkron..." : "Sinkronkan"}
                    </button>

                    <button
                      onClick={() => handleToggleAktif(s)}
                      title={s.aktif ? "Nonaktifkan sementara" : "Aktifkan toko"}
                      style={{
                        background: s.aktif ? "#F0FDF4" : "#FEF2F2",
                        border: `1px solid ${s.aktif ? "#BBF7D0" : "#FECACA"}`,
                        color: s.aktif ? "#16A34A" : "#DC2626",
                        padding: "6px 10px",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Power size={13} />
                      {s.aktif ? "Aktif" : "Nonaktif"}
                    </button>

                    <button
                      onClick={() => handleDelete(s)}
                      title="Putus hubungan toko"
                      style={{
                        background: "transparent",
                        border: "1px solid #E2E8F0",
                        color: "#94A3B8",
                        padding: "6px 8px",
                        borderRadius: 8,
                        cursor: "pointer",
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Box Konfigurasi URL untuk didaftarkan ke Portal Marketplace */}
      <div style={{ background: "#F8FAFC", borderRadius: 12, border: "1px solid #E2E8F0", padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <ShieldCheck size={16} color="#059669" />
          <h4 style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", margin: 0 }}>
            URL Pendaftaran Developer Marketplace
          </h4>
        </div>
        <p style={{ fontSize: 12, color: "#64748B", margin: "0 0 12px" }}>
          Salin alamat URL HTTPS berikut untuk dimasukkan ke form pendaftaran aplikasi di <strong>TikTok Shop Partner Center</strong> dan <strong>Shopee Open Platform</strong>:
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "white", padding: "8px 12px", borderRadius: 8, border: "1px solid #E2E8F0" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#334155", width: 220 }}>TikTok / Tokopedia Redirect URL:</span>
            <code style={{ fontSize: 11, color: "#0F172A", background: "#F1F5F9", padding: "3px 8px", borderRadius: 4, flex: 1, margin: "0 10px" }}>
              {config?.urls.tiktok_redirect || "https://vr.vocpos.id/api/marketplace/tiktok/callback"}
            </code>
            <button onClick={() => handleCopy(config?.urls.tiktok_redirect || "https://vr.vocpos.id/api/marketplace/tiktok/callback", "TikTok Redirect URL")} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B" }}>
              <Copy size={14} />
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "white", padding: "8px 12px", borderRadius: 8, border: "1px solid #E2E8F0" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#334155", width: 220 }}>TikTok / Tokopedia Webhook URL:</span>
            <code style={{ fontSize: 11, color: "#0F172A", background: "#F1F5F9", padding: "3px 8px", borderRadius: 4, flex: 1, margin: "0 10px" }}>
              {config?.urls.tiktok_webhook || "https://vr.vocpos.id/api/marketplace/tiktok/webhook"}
            </code>
            <button onClick={() => handleCopy(config?.urls.tiktok_webhook || "https://vr.vocpos.id/api/marketplace/tiktok/webhook", "TikTok Webhook URL")} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B" }}>
              <Copy size={14} />
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "white", padding: "8px 12px", borderRadius: 8, border: "1px solid #E2E8F0" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#334155", width: 220 }}>Shopee Redirect URL:</span>
            <code style={{ fontSize: 11, color: "#0F172A", background: "#F1F5F9", padding: "3px 8px", borderRadius: 4, flex: 1, margin: "0 10px" }}>
              {config?.urls.shopee_redirect || "https://vr.vocpos.id/api/marketplace/shopee/callback"}
            </code>
            <button onClick={() => handleCopy(config?.urls.shopee_redirect || "https://vr.vocpos.id/api/marketplace/shopee/callback", "Shopee Redirect URL")} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B" }}>
              <Copy size={14} />
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "white", padding: "8px 12px", borderRadius: 8, border: "1px solid #E2E8F0" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#334155", width: 220 }}>Shopee Push URL (Webhook):</span>
            <code style={{ fontSize: 11, color: "#0F172A", background: "#F1F5F9", padding: "3px 8px", borderRadius: 4, flex: 1, margin: "0 10px" }}>
              {config?.urls.shopee_webhook || "https://vr.vocpos.id/api/marketplace/shopee/webhook"}
            </code>
            <button onClick={() => handleCopy(config?.urls.shopee_webhook || "https://vr.vocpos.id/api/marketplace/shopee/webhook", "Shopee Push URL")} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B" }}>
              <Copy size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
