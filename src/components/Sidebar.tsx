"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, MapPin, FilePlus, FileText, Warehouse,
  ShoppingCart, Store, RotateCcw, RefreshCw, BarChart2, Users,
  ClipboardList, Package, Settings, ScanBarcode, Factory,
  ChevronLeft, ChevronRight
} from "lucide-react";

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
  { label: "Barcode Produksi",     href: "/barcode-produksi", icon: ScanBarcode },
  { label: "Gudang Produksi",      href: "/gudang-produksi",  icon: Factory },
  { label: "Laporan SPK",          href: "/laporan-spk",      icon: ClipboardList },
  { label: "Daftar Bundle",        href: "/barang-jadi",      icon: Package },
  { label: "Retur Produksi",       href: "/retur-produksi",   icon: RotateCcw },

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


export default function Sidebar({ 
  isCollapsed = false, 
  toggleSidebar 
}: { 
  isCollapsed?: boolean;
  toggleSidebar?: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside className="app-sidebar">
      <div className="sidebar-logo">
        <div>
          <div className="sidebar-logo-title">👖 KonveksiApps</div>
          <div className="sidebar-logo-sub">Sistem Tracking Produksi Jeans</div>
        </div>
        {toggleSidebar && (
          <button onClick={toggleSidebar} className="toggle-btn" title="Toggle Sidebar">
            {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        )}
      </div>

      <nav className="sidebar-nav">
        {MENU.map((item: any, idx: number) => {
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
              className={`sidebar-menu-item${isActive ? " active" : ""}`}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        {isCollapsed ? "v1" : "v1.0 · KonveksiApps"}
      </div>
    </aside>
  );
}
