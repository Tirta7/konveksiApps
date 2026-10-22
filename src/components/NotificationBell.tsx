"use client";

import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Bell,
  Inbox,
  ClipboardCheck,
  Package,
  Scissors,
  CheckCheck,
  ChevronRight,
  ExternalLink,
  Sparkles,
  X,
  Zap,
  Clock
} from "lucide-react";

export interface NotificationItem {
  id: string;
  rawId?: number;
  type: "vendor_request" | "lapor_progres" | "standby_pool" | "potongan_siap";
  title: string;
  desc: string;
  detail?: string;
  badge: string;
  badgeColor: string;
  timestamp: string;
  url: string;
  vendor_nama?: string;
  jumlah?: number;
  urgency: "high" | "medium" | "normal";
}

interface NotificationCounts {
  requests: number;
  reports: number;
  pools: number;
  cuts: number;
  total: number;
  actionRequired: number;
}

function timeAgo(dateStr: string) {
  try {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return "Baru saja";
    if (diff < 3600) return `${Math.floor(diff / 60)} mnt lalu`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
    return new Date(dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

export default function NotificationBell({
  isCollapsed = false,
  align = "left"
}: {
  isCollapsed?: boolean;
  align?: "left" | "right";
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [counts, setCounts] = useState<NotificationCounts>({ requests: 0, reports: 0, pools: 0, cuts: 0, total: 0, actionRequired: 0 });
  const [readIds, setReadIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<"semua" | "requests" | "reports" | "pools">("semua");
  const [ringing, setRinging] = useState(false);

  const btnRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem("konveksi_read_notifs");
      if (stored) setReadIds(JSON.parse(stored));
    } catch {}
  }, []);

  const fetchNotifs = async (animateRing = false) => {
    try {
      const res = await fetch("/api/notifikasi?_t=" + Date.now());
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications || []);
      setCounts(data.counts || { requests: 0, reports: 0, pools: 0, cuts: 0, total: 0, actionRequired: 0 });
      if (animateRing) {
        setRinging(true);
        setTimeout(() => setRinging(false), 2000);
      }
    } catch {}
  };

  useEffect(() => {
    fetchNotifs();

    const handleSync = () => fetchNotifs(false);
    const handleRt = (e: any) => {
      const evt = e.detail?.event;
      if (["vendorRequest", "progressReported", "poolAllocated", "requestUpdated", "vendorWorking"].includes(evt)) {
        fetchNotifs(true);
      }
    };

    window.addEventListener("konveksi-sync", handleSync);
    window.addEventListener("konveksi-rt", handleRt);
    const interval = setInterval(() => fetchNotifs(false), 30000);

    return () => {
      window.removeEventListener("konveksi-sync", handleSync);
      window.removeEventListener("konveksi-rt", handleRt);
      clearInterval(interval);
    };
  }, []);

  // Update floating coordinates when opened or window resized
  const updateCoords = () => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const isMobile = window.innerWidth < 768;

    if (isMobile) {
      setCoords({
        top: rect.bottom + 8,
        left: 12
      });
    } else {
      // Desktop: place popover right next to the sidebar (or button) without clipping
      const sidebarRight = isCollapsed ? 80 : 260;
      const left = Math.min(window.innerWidth - 440, Math.max(sidebarRight + 12, rect.right + 12));
      const top = Math.max(16, Math.min(rect.top, window.innerHeight - 560));
      setCoords({ top, left });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      window.addEventListener("resize", updateCoords);
      window.addEventListener("scroll", updateCoords, true);
    }
    return () => {
      window.removeEventListener("resize", updateCoords);
      window.removeEventListener("scroll", updateCoords, true);
    };
  }, [isOpen, isCollapsed]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current && !popoverRef.current.contains(target) &&
        btnRef.current && !btnRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const markAllAsRead = () => {
    const allIds = notifications.map(n => n.id);
    setReadIds(allIds);
    try {
      localStorage.setItem("konveksi_read_notifs", JSON.stringify(allIds));
    } catch {}
  };

  const handleItemClick = (item: NotificationItem) => {
    if (!readIds.includes(item.id)) {
      const updated = [...readIds, item.id];
      setReadIds(updated);
      try {
        localStorage.setItem("konveksi_read_notifs", JSON.stringify(updated));
      } catch {}
    }
    setIsOpen(false);
    router.push(item.url);
  };

  const unreadItems = notifications.filter(n => !readIds.includes(n.id));
  const unreadCount = unreadItems.length;

  const filteredItems = notifications.filter(n => {
    if (filter === "requests") return n.type === "vendor_request";
    if (filter === "reports") return n.type === "lapor_progres";
    if (filter === "pools") return n.type === "standby_pool";
    return true;
  });

  const getIcon = (type: NotificationItem["type"]) => {
    switch (type) {
      case "vendor_request":
        return <Inbox size={17} color="#60A5FA" />;
      case "lapor_progres":
        return <ClipboardCheck size={17} color="#FBBF24" />;
      case "standby_pool":
        return <Package size={17} color="#34D399" />;
      case "potongan_siap":
        return <Scissors size={17} color="#A78BFA" />;
    }
  };

  const getIconBg = (type: NotificationItem["type"]) => {
    switch (type) {
      case "vendor_request":
        return "rgba(59, 130, 246, 0.2)";
      case "lapor_progres":
        return "rgba(245, 158, 11, 0.2)";
      case "standby_pool":
        return "rgba(16, 185, 129, 0.2)";
      case "potongan_siap":
        return "rgba(139, 92, 246, 0.2)";
    }
  };

  const popoverContent = (
    <div
      ref={popoverRef}
      style={{
        position: "fixed",
        top: coords ? coords.top : 16,
        left: coords ? coords.left : 272,
        width: 420,
        maxWidth: "calc(100vw - 24px)",
        maxHeight: "85vh",
        background: "rgba(15, 23, 42, 0.96)",
        backdropFilter: "blur(20px)",
        borderRadius: 18,
        border: "1.5px solid rgba(255, 255, 255, 0.12)",
        boxShadow: "0 25px 60px -10px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.08)",
        zIndex: 99999,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        animation: "fadeIn 0.18s cubic-bezier(0.16, 1, 0.3, 1)"
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          background: "linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.95))",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              background: "linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(37, 99, 235, 0.15))",
              border: "1px solid rgba(59, 130, 246, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#60A5FA"
            }}
          >
            <Bell size={17} />
          </div>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 900, color: "#FFFFFF", display: "flex", alignItems: "center", gap: 8 }}>
              Notifikasi Masuk
              {unreadCount > 0 && (
                <span
                  style={{
                    fontSize: 10.5,
                    background: counts.actionRequired > 0 ? "#EF4444" : "#3B82F6",
                    color: "#FFF",
                    padding: "2px 7px",
                    borderRadius: 10,
                    fontWeight: 800,
                    boxShadow: "0 2px 6px rgba(0,0,0,0.3)"
                  }}
                >
                  {unreadCount} baru
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>
              {counts.actionRequired > 0 ? `${counts.actionRequired} pekerjaan butuh tindakan Anda` : "Aktivitas terbaru alur konveksi"}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              title="Tandai semua sudah dibaca"
              style={{
                background: "rgba(56, 189, 248, 0.1)",
                border: "1px solid rgba(56, 189, 248, 0.3)",
                color: "#38BDF8",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 9px",
                borderRadius: 7,
                transition: "all 0.15s"
              }}
            >
              <CheckCheck size={14} /> Tandai Dibaca
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            style={{
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#94A3B8",
              cursor: "pointer",
              padding: "6px",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div
        style={{
          display: "flex",
          gap: 6,
          padding: "10px 16px",
          background: "rgba(10, 15, 29, 0.6)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
          overflowX: "auto"
        }}
      >
        {[
          { id: "semua", label: `Semua (${notifications.length})` },
          { id: "requests", label: `Permohonan (${counts.requests})`, alert: counts.requests > 0 },
          { id: "reports", label: `Laporan (${counts.reports})`, alert: counts.reports > 0 },
          { id: "pools", label: `Siap Kirim (${counts.pools})` }
        ].map((tab: any) => {
          const active = filter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: active ? "1px solid #3B82F6" : "1px solid rgba(255, 255, 255, 0.08)",
                background: active ? "linear-gradient(135deg, #2563EB, #1D4ED8)" : "rgba(30, 41, 59, 0.6)",
                color: active ? "#FFFFFF" : (tab.alert ? "#FCA5A5" : "#94A3B8"),
                fontSize: 11.5,
                fontWeight: active ? 800 : 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: 5,
                transition: "all 0.15s"
              }}
            >
              {tab.alert && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#EF4444" }} />}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Notification List */}
      <div style={{ maxHeight: 380, overflowY: "auto", display: "flex", flexDirection: "column", padding: "8px 10px", gap: 6 }}>
        {filteredItems.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "#64748B" }}>
            <Sparkles size={32} color="#475569" style={{ margin: "0 auto 10px" }} />
            <div style={{ fontSize: 13.5, fontWeight: 800, color: "#E2E8F0" }}>Tidak ada notifikasi</div>
            <div style={{ fontSize: 12, marginTop: 3 }}>Semua pekerjaan &amp; antrean sudah tertangani dengan baik!</div>
          </div>
        ) : (
          filteredItems.map(item => {
            const isRead = readIds.includes(item.id);
            return (
              <div
                key={item.id}
                onClick={() => handleItemClick(item)}
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: isRead ? "1px solid rgba(255, 255, 255, 0.05)" : "1.5px solid rgba(59, 130, 246, 0.35)",
                  cursor: "pointer",
                  background: isRead ? "rgba(30, 41, 59, 0.4)" : "rgba(30, 58, 110, 0.25)",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  transition: "all 0.15s ease",
                  position: "relative"
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(51, 65, 85, 0.6)";
                  (e.currentTarget as HTMLElement).style.transform = "translateX(2px)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = isRead ? "rgba(30, 41, 59, 0.4)" : "rgba(30, 58, 110, 0.25)";
                  (e.currentTarget as HTMLElement).style.transform = "none";
                }}
              >
                {/* Icon */}
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: getIconBg(item.type),
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: 2
                  }}
                >
                  {getIcon(item.type)}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: isRead ? 700 : 900, color: isRead ? "#E2E8F0" : "#FFFFFF" }}>
                      {item.title}
                    </span>
                    <span style={{ fontSize: 10.5, color: "#94A3B8", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 3 }}>
                      <Clock size={11} /> {timeAgo(item.timestamp)}
                    </span>
                  </div>

                  <div style={{ fontSize: 12, color: "#CBD5E1", marginTop: 3, lineHeight: 1.45 }}>
                    {item.desc}
                  </div>

                  {item.detail && (
                    <div style={{ fontSize: 11, color: "#94A3B8", fontStyle: "italic", marginTop: 3, background: "rgba(0,0,0,0.2)", padding: "3px 8px", borderRadius: 6 }}>
                      {item.detail}
                    </div>
                  )}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 800,
                        padding: "2px 8px",
                        borderRadius: 6,
                        background: item.badgeColor + "25",
                        color: item.badgeColor,
                        border: `1px solid ${item.badgeColor}55`
                      }}
                    >
                      {item.badge}
                    </span>
                    <span style={{ fontSize: 11.5, color: "#38BDF8", fontWeight: 800, display: "flex", alignItems: "center", gap: 3 }}>
                      Buka Fitur <ChevronRight size={13} />
                    </span>
                  </div>
                </div>

                {!isRead && (
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: item.urgency === "high" ? "#EF4444" : "#3B82F6",
                      boxShadow: `0 0 8px ${item.urgency === "high" ? "#EF4444" : "#3B82F6"}`,
                      flexShrink: 0,
                      marginTop: 4
                    }}
                  />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "12px 18px",
          background: "rgba(10, 15, 29, 0.9)",
          borderTop: "1px solid rgba(255, 255, 255, 0.08)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 11.5,
          color: "#94A3B8"
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10B981", display: "inline-block", boxShadow: "0 0 6px #10B981" }} />
          Realtime WebSocket Aktif
        </span>
        <button
          type="button"
          onClick={() => { setIsOpen(false); router.push("/alur-produksi"); }}
          style={{ background: "none", border: "none", color: "#60A5FA", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
        >
          Ke Alur Produksi <ExternalLink size={12} />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* BELL BUTTON */}
      <button
        ref={btnRef}
        type="button"
        id="btn-notifikasi-lonceng"
        onClick={() => setIsOpen(!isOpen)}
        title="Notifikasi Terbaru & Antrean Masuk"
        style={{
          position: "relative",
          width: 36,
          height: 36,
          borderRadius: 9,
          border: isOpen ? "1.5px solid #3B82F6" : "1px solid rgba(255, 255, 255, 0.15)",
          background: isOpen ? "rgba(59, 130, 246, 0.25)" : "rgba(30, 41, 59, 0.8)",
          color: unreadCount > 0 ? "#F8FAFC" : "#94A3B8",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          boxShadow: unreadCount > 0 ? "0 0 12px rgba(59, 130, 246, 0.4)" : "none",
          flexShrink: 0
        }}
      >
        <Bell
          size={18}
          style={{
            animation: ringing ? "spin 0.4s ease infinite" : "none",
            color: counts.actionRequired > 0 ? "#F87171" : (unreadCount > 0 ? "#60A5FA" : "inherit")
          }}
        />

        {/* Counter Badge */}
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              minWidth: 18,
              height: 18,
              padding: "0 4px",
              borderRadius: 9,
              background: counts.actionRequired > 0 ? "linear-gradient(135deg, #EF4444, #DC2626)" : "linear-gradient(135deg, #3B82F6, #2563EB)",
              color: "#FFFFFF",
              fontSize: 10,
              fontWeight: 900,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 6px rgba(0, 0, 0, 0.4)",
              border: "1.5px solid #0F172A",
              animation: counts.actionRequired > 0 ? "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" : "none"
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* PORTAL POPOVER: Rendered to document.body so it is NEVER clipped by sidebar overflow-x */}
      {isOpen && mounted && typeof document !== "undefined" && createPortal(popoverContent, document.body)}
    </>
  );
}
