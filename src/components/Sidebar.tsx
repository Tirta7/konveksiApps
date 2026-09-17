"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, MapPin, FilePlus, FileText, Warehouse,
  ShoppingCart, Store, RotateCcw, RefreshCw, BarChart2, Users,
  ClipboardList, Package, Settings
} from "lucide-react";

const MENU = [
  { label: "Dashboard",            href: "/dashboard",        icon: LayoutDashboard },
  { label: "Peta Perjalanan Kain", href: "/peta-perjalanan",  icon: MapPin },
  
  { divider: "DATA MASTER" },
  { label: "Kategori Produk",      href: "/kategori",         icon: ClipboardList },
  { label: "Data Barang",          href: "/barang",           icon: Package },
  { label: "Data Pelanggan",       href: "/pelanggan",        icon: Users },
  { label: "Data Supplier",        href: "/supplier",         icon: Store },
  { label: "Atur Vendor",          href: "/atur-vendor",      icon: Users },
  
  { divider: "PRODUKSI (SPK)" },
  { label: "Buat SPK",             href: "/buat-spk",         icon: FilePlus },
  { label: "Daftar SPK",           href: "/daftar-spk",       icon: FileText },
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


export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="app-sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-title">👖 KonveksiApps</div>
        <div className="sidebar-logo-sub">Sistem Tracking Produksi Jeans</div>
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
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        v1.0 · KonveksiApps
      </div>
    </aside>
  );
}
