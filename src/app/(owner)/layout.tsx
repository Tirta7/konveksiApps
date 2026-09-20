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

  // Start global real-time sync for all pages under this layout
  useGlobalSync();

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
           <div className="mobile-header-logo"> KonveksiApps</div>
           <button className="mobile-toggle-btn" onClick={() => setIsMobileOpen(true)}>
             <Menu size={24} />
           </button>
        </header>
        {children}
      </main>
    </div>
  );
}
