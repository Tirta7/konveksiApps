"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  CheckCircle2, 
  Sparkles, 
  QrCode, 
  Copy, 
  Check, 
  RefreshCw, 
  X, 
  Tag, 
  ShieldCheck, 
  Lock, 
  AlertCircle,
  ExternalLink
} from "lucide-react";
import { toast } from "sonner";

interface PackageItem {
  id: string;
  name: string;
  label?: string;
  days: number;
  amount: number;
  amount_text: string;
  promo_badge?: string;
  promoBadge?: string;
  is_promo?: boolean;
  qris_image_url: string;
}

interface BillingData {
  amount: number;
  amount_text: string;
  merchant_name?: string;
  merchant_city?: string;
  qris_image_url: string;
  packages: PackageItem[];
  unique_code?: number;
}

interface LicenseData {
  allowed: boolean;
  status: string;
  reason?: string;
  machineId: string;
  storeName: string;
  product: string;
  expiresAt: string | null;
  remainingDays?: number | null;
  lastPayment?: {
    action?: string;
    amount?: number;
    package_name?: string;
    created_at?: string;
    expires_at?: string;
  } | null;
  trial?: {
    enabled: boolean;
    quota: number;
    used: number;
    remaining: number;
    is_trial: boolean;
  } | null;
  billing?: BillingData | null;
}

/**
 * Pilar 4: Efek Suara Lonceng Pembayaran "Ding!" (Web Audio API Synthesizer)
 * Bekerja 100% tanpa file eksternal di semua browser.
 */
function playPaymentChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const now = ctx.currentTime;
    // Nada 1: D5 (587.33 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.35, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.8);

    // Nada 2: A5 (880.00 Hz) - Chime Bell
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880.0, now + 0.12);
    gain2.gain.setValueAtTime(0.4, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 1.2);
  } catch {}
}

export default function VocmlLicenseModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [licenseData, setLicenseData] = useState<LicenseData | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<PackageItem | null>(null);
  const [voucherCode, setVoucherCode] = useState("");
  const [isClaiming, setIsClaiming] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{
    pkgName: string;
    amountText: string;
    expiresAt: string;
  } | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  const prevStatusRef = useRef<string | null>(null);

  // Ambil data lisensi saat ini
  async function fetchLicense(isRefresh = false) {
    if (isRefresh) setIsChecking(true);
    try {
      const url = isRefresh ? "/api/license-status?refresh=1" : "/api/license-status";
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setLicenseData(json);

        // Set default selected package jika belum ada
        if (json?.billing?.packages && json.billing.packages.length > 0) {
          setSelectedPackage((prev) => prev || json.billing.packages[0]);
        }

        // Cek perubahan status atau deteksi pembayaran baru masuk (Pilar 4)
        const payment = json.lastPayment;
        const lastCelebrated = localStorage.getItem("vocml_celebrated_payment");
        if (payment?.created_at && payment.created_at !== lastCelebrated) {
          localStorage.setItem("vocml_celebrated_payment", payment.created_at);
          triggerSuccessCelebration({
            pkgName: payment.package_name || selectedPackage?.name || "Paket Langganan",
            amountText: payment.amount ? `Rp ${Number(payment.amount).toLocaleString("id-ID")}` : (selectedPackage?.amount_text || json.billing?.amount_text || "Lunas"),
            expiresAt: payment.expires_at || json.expiresAt || "Aktif",
          });
        } else if (prevStatusRef.current && prevStatusRef.current !== "active" && json.status === "active") {
          triggerSuccessCelebration({
            pkgName: selectedPackage?.name || "Paket Langganan",
            amountText: selectedPackage?.amount_text || json.billing?.amount_text || "Lunas",
            expiresAt: json.expiresAt || "Aktif",
          });
        }
        prevStatusRef.current = json.status;

        // Jika lisensi diblokir, otomatis buka modal
        if (json.allowed === false && !isOpen && !showSuccessModal) {
          setIsOpen(true);
        }
      }
    } catch (err) {
      console.error("[VOCML] Gagal memuat status lisensi:", err);
    } finally {
      if (isRefresh) setIsChecking(false);
    }
  }

  // Buka perayaan sukses bayar (Hanya 1x per pembayaran baru, toast ber-ID tunggal bebas spam)
  function triggerSuccessCelebration(info: { pkgName: string; amountText: string; expiresAt: string }) {
    playPaymentChime();
    setSuccessInfo(info);
    setShowSuccessModal(true);
    setIsOpen(false);
    toast.success("🎉 Pembayaran Lisensi Berhasil Diverifikasi!", {
      id: "vocml-payment-alert",
      description: `Paket ${info.pkgName} aktif hingga ${info.expiresAt}.`,
      duration: 7000,
    });
  }

  // Listeners global event & startup check
  useEffect(() => {
    fetchLicense();

    const handleOpenModal = () => {
      fetchLicense(true);
      setIsOpen(true);
    };

    const handlePaymentCelebration = (e: any) => {
      const d = e.detail;
      const payment = d?.lastPayment;
      triggerSuccessCelebration({
        pkgName: payment?.package_name || selectedPackage?.name || "Paket Langganan",
        amountText: payment?.amount ? `Rp ${Number(payment.amount).toLocaleString("id-ID")}` : (selectedPackage?.amount_text || "Lunas"),
        expiresAt: payment?.expires_at || d?.expiresAt || "Aktif",
      });
    };

    window.addEventListener("open-license-modal", handleOpenModal);
    window.addEventListener("vocml-payment-celebration", handlePaymentCelebration);
    return () => {
      window.removeEventListener("open-license-modal", handleOpenModal);
      window.removeEventListener("vocml-payment-celebration", handlePaymentCelebration);
    };
  }, []);

  // Pilar 4: Fast-polling / SSE listener saat modal terbuka (deteksi bayar seketika)
  useEffect(() => {
    if (!isOpen) return;

    let sseController: AbortController | null = null;
    const mid = licenseData?.machineId;
    const prod = licenseData?.product || "konveksi";

    // 1. Coba sambungkan SSE ke VOC ML stream
    if (mid) {
      try {
        sseController = new AbortController();
        const streamUrl = `https://vocml.vocpos.id/api/v1/stream?machine_id=${encodeURIComponent(mid)}&product=${encodeURIComponent(prod)}`;
        const es = new EventSource(streamUrl);
        es.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data?.event === "renew" || data?.status === "active") {
              fetchLicense(true);
            }
          } catch {}
        };
        es.onerror = () => {
          es.close();
        };
      } catch {}
    }

    // 2. Fast-polling 1.5 detik selama modal terbuka dengan refresh=1 langsung ke VOC ML (Responsif seketika)
    const pollInterval = setInterval(() => {
      fetchLicense(true);
    }, 1500);

    return () => {
      clearInterval(pollInterval);
      if (sseController) sseController.abort();
    };
  }, [isOpen, licenseData?.machineId]);

  // Tombol "Saya Sudah Bayar" (Pilar 5)
  async function handleManualCheck() {
    setIsChecking(true);
    try {
      const res = await fetch("/api/license-status?refresh=1", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setLicenseData(json);
        if (json.status === "active") {
          const payment = json.lastPayment;
          if (payment?.created_at) {
            localStorage.setItem("vocml_celebrated_payment", payment.created_at);
          }
          triggerSuccessCelebration({
            pkgName: payment?.package_name || selectedPackage?.name || "Paket Langganan",
            amountText: payment?.amount ? `Rp ${Number(payment.amount).toLocaleString("id-ID")}` : (selectedPackage?.amount_text || json.billing?.amount_text || "Lunas"),
            expiresAt: payment?.expires_at || json.expiresAt || "Aktif",
          });
        } else {
          toast.info("⏳ Pembayaran sedang diverifikasi oleh server QRIS. Tunggu beberapa detik...");
        }
      }
    } catch {
      toast.error("Gagal memeriksa ke server lisensi");
    } finally {
      setIsChecking(false);
    }
  }

  // Klaim Kode Voucher Promo (Pilar 5)
  async function handleClaimVoucher(e: React.FormEvent) {
    e.preventDefault();
    if (!voucherCode.trim()) {
      toast.error("Silakan masukkan kode voucher terlebih dahulu");
      return;
    }
    setIsClaiming(true);
    try {
      const res = await fetch("/api/license/voucher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: voucherCode.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        toast.success(data.message || "Voucher Berhasil Diklaim!");
        setVoucherCode("");
        triggerSuccessCelebration({
          pkgName: "Voucher Promosi",
          amountText: "Gratis / Promo",
          expiresAt: data.license?.expiresAt || "Aktif",
        });
      } else {
        toast.error(data.error || "Kode voucher tidak valid atau sudah kadaluarsa");
      }
    } catch {
      toast.error("Terjadi kesalahan saat memvalidasi voucher");
    } finally {
      setIsClaiming(false);
    }
  }

  const handleCopyMid = () => {
    if (licenseData?.machineId) {
      navigator.clipboard.writeText(licenseData.machineId);
      setCopiedId(true);
      toast.success("Machine ID disalin!");
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  // Jangan render apapun jika modal tidak terbuka dan modal sukses tidak aktif
  if (!isOpen && !showSuccessModal) return null;

  const billing = licenseData?.billing;
  const packages = billing?.packages || [];
  const currentQrisUrl = selectedPackage?.qris_image_url || billing?.qris_image_url;
  const currentTotalText = selectedPackage?.amount_text || billing?.amount_text || "Rp 0";
  const trialInfo = licenseData?.trial;
  const isTrial = licenseData?.status === "trial" || trialInfo?.is_trial;

  return (
    <>
      {/* ======================================================== */}
      {/* PILAR 4: MODAL PERAYAAN SUKSES PEMBAYARAN (AUTO-SUCCESS) */}
      {/* ======================================================== */}
      {showSuccessModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          zIndex: 99999,
          background: "rgba(15, 23, 42, 0.85)",
          backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16
        }}>
          <div style={{
            background: "#1E293B",
            border: "2px solid #10B981",
            borderRadius: 20,
            maxWidth: 480,
            width: "100%",
            padding: 32,
            textAlign: "center",
            boxShadow: "0 25px 60px -15px rgba(16, 185, 129, 0.4)",
            animation: "scaleUp 0.3s ease-out"
          }}>
            {/* Sparkling checkmark */}
            <div style={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: "rgba(16, 185, 129, 0.15)",
              border: "2px solid #10B981",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 18px",
              boxShadow: "0 0 25px rgba(16, 185, 129, 0.5)"
            }}>
              <CheckCircle2 size={46} color="#10B981" />
            </div>

            <div style={{
              display: "inline-block",
              padding: "4px 12px",
              borderRadius: 999,
              background: "rgba(16, 185, 129, 0.2)",
              color: "#34D399",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              marginBottom: 8
            }}>
              ✨ PEMBAYARAN QRIS BERHASIL DITERIMA
            </div>

            <h2 style={{ fontSize: 22, fontWeight: 900, color: "#FFFFFF", marginBottom: 8 }}>
              Lisensi Berhasil Diaktifkan!
            </h2>
            <p style={{ fontSize: 13, color: "#94A3B8", marginBottom: 24, lineHeight: 1.5 }}>
              Terima kasih! Pembayaran Anda telah terverifikasi oleh server VOC ML. Seluruh menu operasional Konveksi ERP telah terbuka penuh.
            </p>

            <div style={{
              background: "#0F172A",
              border: "1px solid #334155",
              borderRadius: 14,
              padding: 16,
              textAlign: "left",
              marginBottom: 24
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
                <span style={{ color: "#94A3B8" }}>Paket Baru</span>
                <strong style={{ color: "#F8FAFC" }}>{successInfo?.pkgName || "Paket Langganan"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
                <span style={{ color: "#94A3B8" }}>Nominal Lunas</span>
                <strong style={{ color: "#38BDF8", fontFamily: "monospace" }}>{successInfo?.amountText || "Lunas"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "#94A3B8" }}>Berlaku Sampai</span>
                <strong style={{ color: "#10B981" }}>{successInfo?.expiresAt || "Aktif"}</strong>
              </div>
            </div>

            <button
              onClick={() => {
                setShowSuccessModal(false);
                window.location.reload();
              }}
              style={{
                width: "100%",
                padding: "14px",
                background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                color: "#FFFFFF",
                border: "none",
                borderRadius: 12,
                fontWeight: 800,
                fontSize: 14,
                cursor: "pointer",
                boxShadow: "0 4px 15px rgba(16, 185, 129, 0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8
              }}
            >
              <Check size={18} /> ✅ Selesai & Lanjutkan
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* PILAR 3: MODAL DAFTAR PAKET & QRIS DINAMIS (1 GAMBAR TUNGGAL) */}
      {/* ======================================================== */}
      {isOpen && (
        <div style={{
          position: "fixed",
          inset: 0,
          zIndex: 99990,
          background: "rgba(15, 23, 42, 0.8)",
          backdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16
        }}>
          <div style={{
            background: "#1E293B",
            border: "1px solid #334155",
            borderRadius: 20,
            maxWidth: 880,
            width: "100%",
            maxHeight: "92vh",
            overflowY: "auto",
            boxShadow: "0 25px 60px rgba(0,0,0,0.6)",
            color: "#F8FAFC"
          }}>
            {/* Header Modal */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "20px 24px",
              borderBottom: "1px solid #334155"
            }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <ShieldCheck size={20} color="#38BDF8" />
                  <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: "#FFFFFF" }}>
                    Daftar Paket Lisensi & Perpanjangan
                  </h3>
                  {licenseData?.status && (
                    <span style={{
                      padding: "2px 8px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      background: licenseData.allowed ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
                      color: licenseData.allowed ? "#34D399" : "#F87171"
                    }}>
                      {licenseData.status}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 12, color: "#94A3B8", margin: "4px 0 0" }}>
                  Konveksi ERP • {licenseData?.storeName || "Toko"}
                </p>
              </div>

              {/* Tombol Tutup (Hanya boleh ditutup jika akses allowed = true) */}
              {licenseData?.allowed ? (
                <button
                  onClick={() => setIsOpen(false)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#94A3B8",
                    cursor: "pointer",
                    padding: 6,
                    borderRadius: 8
                  }}
                >
                  <X size={20} />
                </button>
              ) : (
                <div style={{ fontSize: 11, color: "#EF4444", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                  <Lock size={12} /> Lisensi Diperlukan
                </div>
              )}
            </div>

            {/* Trial Info Banner (Jika dalam masa Trial) */}
            {isTrial && trialInfo && (
              <div style={{
                margin: "16px 24px 0",
                padding: "12px 16px",
                background: "rgba(245, 158, 11, 0.12)",
                border: "1px solid rgba(245, 158, 11, 0.3)",
                borderRadius: 12,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 8
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Sparkles size={16} color="#F59E0B" />
                  <span style={{ fontSize: 13, color: "#FDE68A", fontWeight: 600 }}>
                    Mode Trial Aktif: Sisa Kuota Transaksi <strong>{trialInfo.remaining}</strong> dari {trialInfo.quota} SPK
                  </span>
                </div>
                <span style={{ fontSize: 11, color: "#F59E0B", fontWeight: 700 }}>
                  Tiap terbit SPK memotong 1 kuota
                </span>
              </div>
            )}

            {/* Body 2 Kolom (Sesuai Pilar 3) */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 24,
              padding: 24
            }}>
              {/* ======================================================== */}
              {/* KOLOM KIRI: PENAMPIL QRIS TUNGGAL (ATURAN: 1 GAMBAR TUNGGAL) */}
              {/* ======================================================== */}
              <div style={{
                background: "rgba(15, 23, 42, 0.6)",
                borderRadius: 16,
                border: "1px solid rgba(51, 65, 85, 0.6)",
                padding: 20,
                display: "flex",
                flexDirection: "column",
                alignItems: "center"
              }}>
                {/* 1 GAMBAR TUNGGAL DARI URL SERVER (BEBAS GAMBAR GANDA & BEBAS QRCodeCanvas) */}
                <div style={{
                  padding: 12,
                  background: "#FFFFFF",
                  borderRadius: 12,
                  boxShadow: "0 8px 20px rgba(0, 0, 0, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 224,
                  minWidth: 224
                }}>
                  {currentQrisUrl ? (
                    <img 
                      src={currentQrisUrl} 
                      alt="QRIS Pembayaran Dinamis" 
                      style={{ width: 208, height: 208, objectFit: "contain", display: "block" }}
                      loading="eager"
                    />
                  ) : (
                    <div style={{ width: 208, height: 208, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#64748B" }}>
                      <RefreshCw size={24} className="animate-spin" />
                      <span style={{ fontSize: 11, marginTop: 8 }}>Memuat QRIS...</span>
                    </div>
                  )}
                </div>

                {/* Total Tagihan & Detail QRIS */}
                <div style={{ marginTop: 14, textAlign: "center", width: "100%" }}>
                  <p style={{ fontSize: 11, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, margin: 0 }}>
                    TOTAL TAGIHAN
                  </p>
                  <p style={{ fontSize: 26, fontWeight: 900, color: "#38BDF8", fontFamily: "ui-monospace, monospace", margin: "4px 0" }}>
                    {currentTotalText}
                  </p>
                  <p style={{ fontSize: 11, color: "#94A3B8", margin: 0 }}>
                    QRIS Dinamis • {billing?.merchant_name || "Virtual Operation Control"}
                  </p>
                </div>

                {/* Tombol "Saya Sudah Bayar" (Pilar 5) */}
                <button
                  onClick={handleManualCheck}
                  disabled={isChecking}
                  style={{
                    width: "100%",
                    marginTop: 16,
                    padding: "12px",
                    background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: 10,
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: isChecking ? "wait" : "pointer",
                    boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8
                  }}
                >
                  <RefreshCw size={15} className={isChecking ? "animate-spin" : ""} />
                  {isChecking ? "Memeriksa Pembayaran..." : "✅ Saya Sudah Bayar"}
                </button>

                {/* Machine ID Info Box */}
                <div style={{
                  width: "100%",
                  marginTop: 14,
                  padding: "8px 12px",
                  background: "rgba(0, 0, 0, 0.3)",
                  borderRadius: 8,
                  border: "1px solid #334155",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 11
                }}>
                  <span style={{ color: "#94A3B8" }}>MID:</span>
                  <span style={{ fontFamily: "monospace", color: "#38BDF8", fontWeight: 700 }}>
                    {licenseData?.machineId || "MID-DETECTING"}
                  </span>
                  <button
                    onClick={handleCopyMid}
                    style={{ background: "transparent", border: "none", color: "#94A3B8", cursor: "pointer", padding: 2 }}
                    title="Salin Machine ID"
                  >
                    {copiedId ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              {/* ======================================================== */}
              {/* KOLOM KANAN: PILIHAN PAKET LISENSI & KLAIM VOUCHER */}
              {/* ======================================================== */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
                    PILIHAN PAKET LISENSI
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {packages.length === 0 ? (
                      <div style={{ padding: 16, background: "rgba(0,0,0,0.2)", borderRadius: 10, textAlign: "center", color: "#64748B", fontSize: 13 }}>
                        Memuat daftar paket dari server...
                      </div>
                    ) : (
                      packages.map((pkg) => {
                        const isSelected = selectedPackage?.id === pkg.id;
                        return (
                          <div
                            key={pkg.id}
                            onClick={() => setSelectedPackage(pkg)}
                            style={{
                              padding: "12px 14px",
                              borderRadius: 12,
                              border: isSelected ? "2px solid #38BDF8" : "1px solid #334155",
                              background: isSelected ? "rgba(56, 189, 248, 0.1)" : "#0F172A",
                              cursor: "pointer",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              transition: "all 0.15s ease"
                            }}
                          >
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontWeight: 800, fontSize: 13, color: "#FFFFFF" }}>
                                  {pkg.name}
                                </span>
                                {(pkg.promo_badge || pkg.promoBadge) && (
                                  <span style={{
                                    fontSize: 10,
                                    fontWeight: 800,
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                    background: "#F59E0B",
                                    color: "#0F172A"
                                  }}>
                                    {pkg.promo_badge || pkg.promoBadge}
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: 11, color: "#64748B" }}>
                                Durasi: {pkg.label || `${pkg.days} Hari`}
                              </span>
                            </div>

                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: 14, fontWeight: 900, color: "#38BDF8", fontFamily: "ui-monospace, monospace" }}>
                                {pkg.amount_text}
                              </div>
                              {isSelected && (
                                <span style={{ fontSize: 10, color: "#10B981", fontWeight: 700 }}>
                                  ● Terpilih
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Klaim Kode Voucher Promo (Pilar 5) */}
                <div style={{
                  padding: 14,
                  background: "rgba(15, 23, 42, 0.5)",
                  border: "1px solid #334155",
                  borderRadius: 12
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <Tag size={13} color="#F59E0B" /> KLAIM KODE VOUCHER PROMO
                  </div>
                  <form onSubmit={handleClaimVoucher} style={{ display: "flex", gap: 8 }}>
                    <input
                      type="text"
                      placeholder="Masukkan kode voucher..."
                      value={voucherCode}
                      onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                      style={{
                        flex: 1,
                        padding: "8px 12px",
                        background: "#0F172A",
                        border: "1px solid #334155",
                        borderRadius: 8,
                        color: "#FFFFFF",
                        fontSize: 12,
                        textTransform: "uppercase",
                        outline: "none"
                      }}
                    />
                    <button
                      type="submit"
                      disabled={isClaiming || !voucherCode.trim()}
                      style={{
                        padding: "8px 16px",
                        background: "#2563EB",
                        color: "#FFFFFF",
                        border: "none",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: isClaiming ? "wait" : "pointer"
                      }}
                    >
                      {isClaiming ? "Mengecek..." : "Klaim"}
                    </button>
                  </form>
                </div>

                {/* Petunjuk Pembayaran Otomatis */}
                <div style={{ fontSize: 11, color: "#94A3B8", lineHeight: 1.5, background: "rgba(0,0,0,0.2)", padding: 12, borderRadius: 10 }}>
                  <p style={{ margin: "0 0 4px", fontWeight: 700, color: "#CBD5E1" }}>
                    ⚡ Auto-Unlock Seketika:
                  </p>
                  1. Buka aplikasi BCA, GoPay, OVO, Dana, ShopeePay, atau Mobile Banking.<br />
                  2. Scan QRIS dinamis di sebelah kiri sesuai nominal yang tertera.<br />
                  3. Setelah bayar, sistem akan otomatis terbuka dalam hitungan detik!
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
