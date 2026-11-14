"use client";

import { useState, useEffect, useRef } from "react";
import Sidebar from "@/components/Sidebar";
import NotificationBell from "@/components/NotificationBell";
import VocmlBroadcastModal from "@/components/VocmlBroadcastModal";
import VocmlLicenseModal from "@/components/VocmlLicenseModal";
import { Menu } from "lucide-react";
import { subscribeRealtime, subscribeRealtimeEvent } from "@/lib/realtime-client";
import { toast } from "sonner";

/**
 * Uses ONE shared realtime connection per browser (WebSocket, fallback SSE — see realtime-client).
 * When server broadcasts "dataChanged", dispatches a window event
 * so any page-level fetchData() listeners refresh automatically.
 * Event aplikasi (permintaan vendor, laporan progres) ditampilkan sebagai notifikasi live.
 */
function useGlobalSync(onLockChange?: (locked: boolean, reason?: string) => void) {
  useEffect(() => {
    const unsubSync = subscribeRealtime(() => {
      window.dispatchEvent(new CustomEvent("konveksi-sync"));
    });
    const unsubEvt = subscribeRealtimeEvent((event, d) => {
      window.dispatchEvent(new CustomEvent("konveksi-rt", { detail: { event, data: d } }));
      if (event === "vendorRequest") {
        toast.info(`📥 ${d?.vendor_nama || "Vendor"} baru saja meminta ${d?.total || 0} pcs${d?.no_po ? ` dari ${d.no_po}` : ""}`, {
          description: "Cek Antrean Request Vendor sebelum membagikan stok PO ini.",
          duration: 8000,
        });
      } else if (event === "progressReported") {
        toast.info(`📝 ${d?.vendor_nama || "Vendor"} melaporkan ${d?.jumlah || 0} pcs selesai${d?.no_po ? ` (${d.no_po})` : ""}`, {
          description: "Menunggu ACC admin.",
          duration: 6000,
        });
      } else if (event === "vendorWorking") {
        if (d?.action === "mulai") {
          toast.success(`⚡ ${d?.vendor_nama || "Vendor"} mulai mengerjakan ${d?.no_po ? `PO ${d.no_po}` : "pekerjaan"}`, {
            description: "Status pengerjaan langsung diperbarui secara realtime di Alur Produksi.",
            duration: 6000,
          });
        } else {
          toast.info(`ℹ️ ${d?.vendor_nama || "Vendor"} membatalkan pengerjaan ${d?.no_po ? `PO ${d.no_po}` : ""}`, {
            duration: 5000,
          });
        }
      } else if (event === "marketplace:order_received" && d?.added > 0) {
        toast.success(`🎉 ${d.added} Pesanan baru masuk dari ${d?.shop || "Marketplace"}!`, {
          description: "Pesanan otomatis masuk ke Penjualan Online.",
          duration: 5000,
        });
      } else if (event === "license:payment_success") {
        toast.success(`🎉 Pembayaran QRIS ${d?.lastPayment?.amount ? `Rp ${Number(d.lastPayment.amount).toLocaleString("id-ID")}` : ""} Berhasil Diterima!`, {
          id: "vocml-payment-alert",
          description: `Paket ${d?.lastPayment?.package_name || "Langganan"} aktif hingga ${d?.expiresAt || "selesai"}.`,
          duration: 7000,
        });
        window.dispatchEvent(new CustomEvent("vocml-payment-celebration", { detail: d }));
      } else if (event === "license:locked") {
        toast.error(`🔒 Aplikasi Dikunci dari Pusat: ${d?.reason || "Lisensi dinonaktifkan"}`, {
          id: "vocml-lock-alert",
          duration: 6000,
        });
        if (onLockChange) onLockChange(true, d?.reason);
        window.dispatchEvent(new CustomEvent("open-license-modal"));
      } else if (event === "license:unlocked") {
        toast.success(`🔓 Lisensi Aktif: Aplikasi telah dibuka kembali dari pusat`, {
          id: "vocml-unlock-alert",
          duration: 5000,
        });
        if (onLockChange) onLockChange(false);
      }
    });

    // Cek status lisensi berkala di background (2 detik)
    const checkLicenseHeartbeat = async () => {
      try {
        const res = await fetch("/api/license-status");
        if (res.ok) {
          const lic = await res.json();
          if (lic && lic.allowed === false) {
            if (onLockChange) onLockChange(true, lic.reason);
            window.dispatchEvent(new CustomEvent("open-license-modal"));
          } else if (lic && lic.allowed === true) {
            if (onLockChange) onLockChange(false);
          }
        }
      } catch {}
    };
    const licInterval = setInterval(checkLicenseHeartbeat, 2000); // 2 Detik responsif

    return () => { 
      unsubSync(); 
      unsubEvt(); 
      clearInterval(licInterval);
    };
  }, [onLockChange]);
}

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [appName, setAppName] = useState("KonveksiApps");
  const [logoUrl, setLogoUrl] = useState("/icons/icon-192.png");
  const [isAppLocked, setIsAppLocked] = useState(false);
  const [lockReason, setLockReason] = useState("");

  const handleLockChange = (locked: boolean, reason?: string) => {
    setIsAppLocked(locked);
    if (reason) setLockReason(reason);
  };

  // Start global real-time sync for all pages under this layout
  useGlobalSync(handleLockChange);

  useEffect(() => {
    function updateTitleAndName() {
      fetch("/api/pengaturan")
        .then(r => r.json())
        .then(d => {
          if (d?.nama_usaha) {
            const shortName = d.nama_usaha.split("|")[0].trim() || d.nama_usaha;
            setAppName(shortName);
            const title = d.tagline ? `${d.nama_usaha} — ${d.tagline}` : d.nama_usaha;
            document.title = title;
          }
          if (d?.logo_url) {
            setLogoUrl(d.logo_url);
            let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
            if (!link) {
              link = document.createElement("link");
              link.rel = "icon";
              document.head.appendChild(link);
            }
            link.href = d.logo_url;
          }
        })
        .catch(() => {});
    }

    updateTitleAndName();

    // Listen for PWA beforeinstallprompt event and store globally for buttons
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      (window as any).__deferredPwaPrompt = e;
      window.dispatchEvent(new CustomEvent("pwa-can-install"));
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    const onSync = () => updateTitleAndName();
    window.addEventListener("konveksi-sync", onSync);
    window.addEventListener("pengaturan-changed", onSync);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("konveksi-sync", onSync);
      window.removeEventListener("pengaturan-changed", onSync);
    };
  }, []);

  if (isAppLocked) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "#0F172A",
        color: "#F8FAFC",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        position: "fixed",
        inset: 0,
        zIndex: 999999
      }}>
        <div style={{
          background: "#1E293B",
          border: "2px solid #EF4444",
          borderRadius: 20,
          maxWidth: 560,
          width: "100%",
          padding: 36,
          textAlign: "center",
          boxShadow: "0 25px 60px rgba(239, 68, 68, 0.25)"
        }}>
          <div style={{
            width: 76,
            height: 76,
            borderRadius: "50%",
            background: "rgba(239, 68, 68, 0.15)",
            border: "2px solid #EF4444",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 18px",
            fontSize: 34
          }}>
            🔒
          </div>
          <div style={{
            display: "inline-block",
            padding: "4px 12px",
            borderRadius: 999,
            background: "rgba(239, 68, 68, 0.2)",
            color: "#F87171",
            fontSize: 11,
            fontWeight: 800,
            textTransform: "uppercase",
            marginBottom: 8
          }}>
            APLIKASI TERKUNCI
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: "#FFFFFF", marginBottom: 8 }}>
            Akses Dinonaktifkan dari Pusat
          </h1>
          <p style={{ fontSize: 13, color: "#94A3B8", marginBottom: 24, lineHeight: 1.55 }}>
            {lockReason || "Aplikasi ini telah dikunci sementara oleh administrator VOC ML. Hubungi penyedia sistem atau selesaikan pembayaran untuk membuka kembali."}
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("open-license-modal"))}
              style={{
                padding: "12px 24px",
                background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
                color: "#FFFFFF",
                border: "none",
                borderRadius: 10,
                fontWeight: 800,
                fontSize: 13,
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(37, 99, 235, 0.4)"
              }}
            >
              💳 Buka Menu Tagihan QRIS
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "12px 20px",
                background: "#334155",
                color: "#F8FAFC",
                border: "none",
                borderRadius: 10,
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer"
              }}
            >
              🔄 Refresh Halaman
            </button>
          </div>
        </div>
        <VocmlLicenseModal />
      </div>
    );
  }

  return (
    <div className={`app-layout ${isCollapsed ? 'sidebar-collapsed' : ''} ${isMobileOpen ? 'mobile-sidebar-open' : ''}`}>
      {/* Overlay for mobile */}
      <div className={`sidebar-overlay ${isMobileOpen ? 'active' : ''}`} onClick={() => setIsMobileOpen(false)}></div>
      
      <Sidebar 
        isCollapsed={isCollapsed} 
        toggleSidebar={() => setIsCollapsed(!isCollapsed)} 
        onCloseMobile={() => setIsMobileOpen(false)}
      />
      
      <main className="app-content">
        <header className="mobile-header">
           <div className="mobile-header-logo">
             <img 
               src={logoUrl} 
               alt="Logo" 
               style={{ width: 28, height: 28, borderRadius: 7, objectFit: "cover", background: "#1E293B", border: "1px solid #CBD5E1" }} 
               onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/icons/icon-192.png"; }}
             />
             <span>{appName}</span>
           </div>
           <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
             <NotificationBell align="right" />
             <button 
               className="mobile-toggle-btn" 
               onClick={() => setIsMobileOpen(true)}
               aria-label="Buka Menu"
             >
               <Menu size={22} />
             </button>
           </div>
        </header>
        <VocmlBroadcastModal />
        <VocmlLicenseModal />
        {children}
      </main>
    </div>
  );
}
