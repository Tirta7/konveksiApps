"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, MapPin, FilePlus, FileText, Warehouse,
  ShoppingCart, Store, RotateCcw, RefreshCw, BarChart2, Users,
  ClipboardList, Package, Settings, ScanBarcode, Factory,
  ChevronLeft, ChevronRight, Smartphone, X, CheckCircle2, Download, LogOut
} from "lucide-react";
import NotificationBell from "@/components/NotificationBell";

const MENU = [
  { label: "Dashboard",            href: "/dashboard",        icon: LayoutDashboard },
  { label: "Peta Perjalanan Kain", href: "/peta-perjalanan",  icon: MapPin },
  
  { divider: "DATA MASTER" },
  { label: "Kategori Produk",      href: "/kategori",         icon: ClipboardList },
  { label: "Data Kain",            href: "/data-kain",        icon: Package },
  { label: "Data Barang",          href: "/barang",           icon: Package },
  { label: "Data Pelanggan",       href: "/pelanggan",        icon: Users },
  { label: "Data Supplier",        href: "/supplier",         icon: Store },
  { label: "Atur Vendor CMT",      href: "/atur-vendor",      icon: Users },
  { label: "Atur Tukang Potong",   href: "/atur-tukang-potong", icon: Users },
  { label: "Dashboard CMT",        href: "/dashboard-cmt",    icon: Users },
  
  { divider: "PRODUKSI (PO & SPK)" },
  { label: "Pemotongan Kain",      href: "/pemotongan-kain",  icon: FilePlus },
  { label: "Buat PO / SPK",        href: "/buat-spk",         icon: FilePlus },
  { label: "Daftar PO / SPK",      href: "/daftar-spk",       icon: FileText },
  { label: "Alur Produksi",         href: "/alur-produksi",    icon: Factory },
  { label: "Barcode Produksi",     href: "/barcode-produksi", icon: ScanBarcode },
  { label: "Gudang Produksi",      href: "/gudang-produksi",  icon: Factory },
  { label: "Laporan SPK",          href: "/laporan-spk",      icon: ClipboardList },
  { label: "Daftar Bundle",        href: "/barang-jadi",      icon: Package },
  { label: "Retur Produksi",       href: "/retur-produksi",   icon: RotateCcw },

  { divider: "PENGATURAN SISTEM" },
  { label: "Pengaturan Alur Produksi", href: "/alur-produksi-settings", icon: Settings },

  { divider: "TRANSAKSI & GUDANG" },
  { label: "Gudang & Stok",        href: "/gudang",           icon: Warehouse },
  { label: "Mutasi Stok",          href: "/mutasi-stok",      icon: RefreshCw },
  { label: "Pembelian (PO)",       href: "/pembelian",        icon: ShoppingCart },
  { label: "Penjualan Grosir",     href: "/penjualan",        icon: BarChart2 },
  { label: "Penjualan Online",     href: "/penjualan-online",   icon: ShoppingCart },
  { label: "Retail Offline",       href: "/retail-offline",   icon: Store },
  { label: "Retur Penjualan",      href: "/retur-online",     icon: RotateCcw },
  
  { divider: "KEUANGAN" },
  { label: "Laporan Penjualan",    href: "/laporan",          icon: BarChart2 },
  { label: "Hutang",               href: "/hutang",           icon: ClipboardList },
  { label: "Piutang",              href: "/piutang",          icon: ClipboardList },
  
  { divider: "SISTEM" },
  { label: "Data Karyawan",        href: "/karyawan",         icon: Users },
  { label: "Pengaturan",           href: "/pengaturan",       icon: Settings },
] as const;

/** Menu khusus Owner (sama dengan aturan di src/proxy.ts). */
const OWNER_ONLY_HREFS = new Set(["/laporan", "/hutang", "/piutang", "/karyawan", "/pengaturan"]);


export default function Sidebar({ 
  isCollapsed = false, 
  toggleSidebar,
  onCloseMobile
}: { 
  isCollapsed?: boolean;
  toggleSidebar?: () => void;
  onCloseMobile?: () => void;
}) {
  const pathname = usePathname();
  const [namaUsaha, setNamaUsaha] = useState("KonveksiApps");
  const [subTagline, setSubTagline] = useState("Sistem Tracking Produksi Jeans");
  const [logoUrl, setLogoUrl] = useState("/icons/icon-192.png");
  const [showPwaModal, setShowPwaModal] = useState(false);
  const [me, setMe] = useState<any>(null);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" }).then((r) => r.json()).then((d) => setMe(d?.session || null)).catch(() => {});
  }, []);

  const isOwner = me?.role === "owner";
  // Sembunyikan menu Owner untuk Admin + buang judul grup yang jadi kosong
  const visibleMenu = (() => {
    const items = (MENU as readonly any[]).filter((it) => it.divider || isOwner || !OWNER_ONLY_HREFS.has(it.href));
    return items.filter((it, i) => !it.divider || (items[i + 1] && !items[i + 1].divider));
  })();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.replace("/login");
  };

  const fetchBrandData = () => {
    fetch("/api/pengaturan")
      .then(r => r.json())
      .then(d => {
        if (d?.nama_usaha) {
          const mainPart = d.nama_usaha.split("|")[0].trim();
          setNamaUsaha(mainPart || d.nama_usaha);
        }
        if (d?.tagline) setSubTagline(d.tagline);
        if (d?.logo_url) setLogoUrl(d.logo_url);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchBrandData();
    window.addEventListener("pengaturan-changed", fetchBrandData);
    window.addEventListener("konveksi-sync", fetchBrandData);
    return () => {
      window.removeEventListener("pengaturan-changed", fetchBrandData);
      window.removeEventListener("konveksi-sync", fetchBrandData);
    };
  }, []);

  const handleInstallPWA = async () => {
    const promptEvent = (window as any).__deferredPwaPrompt;
    if (promptEvent) {
      promptEvent.prompt();
      const choiceResult = await promptEvent.userChoice;
      if (choiceResult.outcome === "accepted") {
        (window as any).__deferredPwaPrompt = null;
      }
    } else {
      setShowPwaModal(true);
    }
  };

  return (
    <>
      <aside className="app-sidebar">
        <div className="sidebar-logo" style={isCollapsed ? { display: "flex", flexDirection: "column", alignItems: "center", gap: 10 } : {}}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, overflow: "hidden", flex: isCollapsed ? "initial" : 1, width: isCollapsed ? "100%" : "auto", justifyContent: isCollapsed ? "center" : "flex-start" }}>
            <img 
              src={logoUrl} 
              alt="Logo" 
              style={{ 
                width: 36, 
                height: 36, 
                borderRadius: 9, 
                objectFit: "cover",
                background: "#1E293B",
                border: "1.5px solid rgba(255,255,255,0.2)",
                flexShrink: 0,
                boxShadow: "0 2px 6px rgba(0,0,0,0.25)"
              }} 
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = "/icons/icon-192.png";
              }}
            />
            {!isCollapsed && (
              <div style={{ overflow: "hidden", flex: 1 }}>
                <div className="sidebar-logo-title" style={{ fontSize: namaUsaha.length > 15 ? 14 : 17, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                  {namaUsaha}
                </div>
                <div className="sidebar-logo-sub" style={{ whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                  {subTagline}
                </div>
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {/* ICON LONCENG NOTIFIKASI TERBARU */}
            <NotificationBell isCollapsed={isCollapsed} align="left" />


            {toggleSidebar && (
              <button onClick={toggleSidebar} className="toggle-btn" title="Toggle Sidebar">
                {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
              </button>
            )}
          </div>
        </div>

        <nav className="sidebar-nav">
          {visibleMenu.map((item: any, idx: number) => {
            if (item.divider) return (
              <div key={idx} style={{ padding: "8px 12px 4px", fontSize: 10, fontWeight: 800, color: "#64748B", letterSpacing: 1, textTransform: "uppercase", marginTop: 8 }}>
                {item.divider}
              </div>
            );
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => onCloseMobile?.()}
                className={`sidebar-menu-item${isActive ? " active" : ""}`}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* PWA INSTALL BUTTON & FOOTER */}
        <div className="sidebar-footer" style={{ display: "flex", flexDirection: "column", gap: 8, padding: isCollapsed ? "12px 8px" : "12px 14px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          {me && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: isCollapsed ? 0 : "6px 8px", borderRadius: 10, background: isCollapsed ? "transparent" : "rgba(255,255,255,0.05)", justifyContent: isCollapsed ? "center" : "space-between" }}>
              {!isCollapsed && (
                <div style={{ overflow: "hidden" }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#F1F5F9", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{me.nama}</div>
                  <div style={{ fontSize: 10, color: isOwner ? "#FBBF24" : "#93C5FD", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{isOwner ? "Owner" : "Admin / Gudang"}</div>
                </div>
              )}
              <button id="sidebar-logout" type="button" onClick={handleLogout} title="Keluar" style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)", color: "#FCA5A5", borderRadius: 8, padding: 6, cursor: "pointer", display: "flex" }}>
                <LogOut size={14} />
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={handleInstallPWA}
            style={{
              width: "100%",
              padding: isCollapsed ? "8px 4px" : "8px 12px",
              background: "linear-gradient(135deg, #1E40AF, #2563EB)",
              color: "white",
              border: "1px solid rgba(255,255,255,0.25)",
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 800,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              boxShadow: "0 2px 8px rgba(37,99,235,0.3)"
            }}
            title="Install aplikasi ke Layar Utama / Homescreen"
          >
            <Smartphone size={14} />
            {!isCollapsed && <span>Install ke Homescreen</span>}
          </button>
          <div style={{ fontSize: 10, color: "#94A3B8", textAlign: "center" }}>
            {isCollapsed ? "PWA" : `v1.2 · ${namaUsaha} (PWA Ready)`}
          </div>
        </div>
      </aside>

      {/* MODAL PANDUAN INSTALL PWA */}
      {showPwaModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.75)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999, padding: 16 }}>
          <div style={{ background: "white", borderRadius: 20, maxWidth: 520, width: "100%", padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.3)", position: "relative" }}>
            <button
              onClick={() => setShowPwaModal(false)}
              style={{ position: "absolute", top: 18, right: 18, background: "#F1F5F9", border: "none", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            >
              <X size={16} />
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
              <img src={logoUrl} alt="Logo" style={{ width: 48, height: 48, borderRadius: 12, objectFit: "cover", border: "1px solid #E2E8F0" }} />
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 900, color: "#0F172A", margin: 0 }}>Install {namaUsaha}</h3>
                <p style={{ fontSize: 12, color: "#64748B", margin: "2px 0 0 0" }}>Jadikan aplikasi mandiri di Layar Utama / Desktop tanpa browser bar</p>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 12.5, color: "#334155", background: "#F8FAFC", padding: 16, borderRadius: 12, border: "1px solid #E2E8F0", lineHeight: 1.5 }}>
              <div>
                <strong>💻 Di Google Chrome / Edge (Laptop & PC):</strong>
                <div style={{ color: "#64748B", marginTop: 2 }}>
                  Klik ikon <strong>Install App ⤓</strong> di sisi kanan address bar browser (di samping ikon bintang bookmark), lalu klik <em>"Install"</em>.
                </div>
              </div>

              <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: 8 }}>
                <strong>📱 Di Android (Chrome):</strong>
                <div style={{ color: "#64748B", marginTop: 2 }}>
                  Ketuk menu titik tiga (⋮) di pojok kanan atas browser $\rightarrow$ pilih <strong>"Tambahkan ke Layar Utama"</strong> atau <strong>"Install Aplikasi"</strong>.
                </div>
              </div>

              <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: 8 }}>
                <strong>🍏 Di iPhone / iPad (Safari iOS):</strong>
                <div style={{ color: "#64748B", marginTop: 2 }}>
                  Ketuk tombol <strong>Share 📤</strong> di bagian bawah $\rightarrow$ geser ke bawah dan pilih <strong>"Tambah ke Layar Utama (Add to Home Screen)"</strong>.
                </div>
              </div>
            </div>

            <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setShowPwaModal(false)}
                className="btn btn-primary"
                style={{ padding: "9px 20px", fontSize: 13, fontWeight: 700 }}
              >
                Saya Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
