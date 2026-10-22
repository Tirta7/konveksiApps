"use client";

import { useState, useEffect, useRef } from "react";
import Sidebar from "@/components/Sidebar";
import NotificationBell from "@/components/NotificationBell";
import { Menu } from "lucide-react";
import { subscribeRealtime, subscribeRealtimeEvent } from "@/lib/realtime-client";
import { toast } from "sonner";

/**
 * Uses ONE shared realtime connection per browser (WebSocket, fallback SSE — see realtime-client).
 * When server broadcasts "dataChanged", dispatches a window event
 * so any page-level fetchData() listeners refresh automatically.
 * Event aplikasi (permintaan vendor, laporan progres) ditampilkan sebagai notifikasi live.
 */
function useGlobalSync() {
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
      }
    });
    // Cek status lisensi berkala di background (jika dikunci dari pusat, langsung kunci layar browser)
    const checkLicenseHeartbeat = async () => {
      try {
        const res = await fetch("/api/license-status");
        if (res.ok) {
          const lic = await res.json();
          if (lic && lic.allowed === false) {
            window.location.reload();
          }
        }
      } catch {}
    };
    const licInterval = setInterval(checkLicenseHeartbeat, 10000); // 10 Detik

    return () => { 
      unsubSync(); 
      unsubEvt(); 
      clearInterval(licInterval);
    };
  }, []);
}

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [appName, setAppName] = useState("KonveksiApps");
  const [logoUrl, setLogoUrl] = useState("/icons/icon-192.png");

  // Start global real-time sync for all pages under this layout
  useGlobalSync();

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
        {children}
      </main>
    </div>
  );
}
