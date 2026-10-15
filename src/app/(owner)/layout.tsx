"use client";

import { useState, useEffect, useRef } from "react";
import Sidebar from "@/components/Sidebar";
import { Menu } from "lucide-react";

/**
 * Opens ONE SSE connection per browser tab.
 * When server broadcasts "dataChanged", dispatches a window event
 * so any page-level fetchData() listeners refresh automatically.
 */
function useGlobalSync() {
  useEffect(() => {
    let es: EventSource;
    let retryTimeout: ReturnType<typeof setTimeout>;

    function connect() {
      es = new EventSource("/api/events");

      es.addEventListener("dataChanged", () => {
        window.dispatchEvent(new CustomEvent("konveksi-sync"));
      });

      es.onerror = () => {
        es.close();
        retryTimeout = setTimeout(connect, 3000);
      };
    }

    connect();
    return () => {
      clearTimeout(retryTimeout);
      es?.close();
    };
  }, []);
}

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [appName, setAppName] = useState("KonveksiApps");

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
      />
      
      <main className="app-content">
        <header className="mobile-header">
           <div className="mobile-header-logo"> {appName}</div>
           <button className="mobile-toggle-btn" onClick={() => setIsMobileOpen(true)}>
             <Menu size={24} />
           </button>
        </header>
        {children}
      </main>
    </div>
  );
}
