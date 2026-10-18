"use client";

import { useState, useEffect, useRef } from "react";
import Sidebar from "@/components/Sidebar";
import { Menu } from "lucide-react";
import { subscribeRealtime } from "@/lib/realtime-client";

/**
 * Uses ONE shared SSE connection per browser (shared across tabs, see realtime-client).
 * When server broadcasts "dataChanged", dispatches a window event
 * so any page-level fetchData() listeners refresh automatically.
 */
function useGlobalSync() {
  useEffect(() => {
    return subscribeRealtime(() => {
      window.dispatchEvent(new CustomEvent("konveksi-sync"));
    });
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
           <button 
             className="mobile-toggle-btn" 
             onClick={() => setIsMobileOpen(true)}
             aria-label="Buka Menu"
           >
             <Menu size={22} />
           </button>
        </header>
        {children}
      </main>
    </div>
  );
}
