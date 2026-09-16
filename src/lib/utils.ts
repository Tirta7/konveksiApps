import { v4 as uuidv4 } from "uuid";

// Generate token unik untuk SPK
export function generateToken(): string {
  return uuidv4();
}

// Generate nomor SPK
export function generateNoSpk(count: number): string {
  const year = new Date().getFullYear();
  const num = String(count + 1).padStart(3, "0");
  return `SPK-${year}-${num}`;
}

// Generate nomor batch
export function generateNoBatch(count: number): string {
  const year = new Date().getFullYear();
  const num = String(count + 1).padStart(3, "0");
  return `BATCH-${year}-${num}`;
}

// Generate nomor PO
export function generateNoPo(count: number): string {
  const year = new Date().getFullYear();
  const num = String(count + 1).padStart(3, "0");
  return `PO-${year}-${num}`;
}

// Generate nomor retur online
export function generateNoRetur(count: number): string {
  const year = new Date().getFullYear();
  const num = String(count + 1).padStart(3, "0");
  return `RTR-${year}-${num}`;
}

// Generate kode bundel
export function generateKodeBundel(batchKode: string, urutan: number): string {
  return `${batchKode}-BDL${String(urutan).padStart(2, "0")}`;
}

// Format tanggal Indonesia
export function formatTanggal(dateStr: string): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// Format tanggal + jam
export function formatTanggalJam(dateStr: string): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Sekarang (ISO string)
export function now(): string {
  return new Date().toISOString();
}

// Status label Indonesia
export const statusLabel: Record<string, string> = {
  "bahan-mentah": "Bahan Mentah",
  "potong-jahit": "Potong & Jahit",
  "washing": "Washing",
  "finishing-qc": "Finishing & QC",
  "gudang": "Di Gudang",
  "reject": "Ditolak/Reject",
  "menunggu-diterima": "Menunggu Diterima",
  "diterima": "Diterima",
  "selesai-dikerjakan": "Selesai Dikerjakan",
  "dikirim": "Dikirim",
  "baru": "Baru",
  "diproses": "Diproses",
  "siap-kirim": "Siap Kirim",
  "terkirim": "Terkirim",
  "masuk-gudang": "Masuk Gudang",
  "ditolak": "Ditolak",
  "menunggu-spk-retur": "Menunggu SPK Retur",
  "diproses-ulang": "Diproses Ulang",
  "selesai": "Selesai",
  "reject-permanen": "Reject Permanen",
};

// Status warna
export const statusColor: Record<string, string> = {
  "bahan-mentah": "warning",
  "potong-jahit": "info",
  "washing": "info",
  "finishing-qc": "info",
  "gudang": "success",
  "reject": "danger",
  "menunggu-diterima": "warning",
  "diterima": "info",
  "selesai-dikerjakan": "success",
  "dikirim": "success",
  "baru": "warning",
  "diproses": "info",
  "siap-kirim": "info",
  "terkirim": "success",
  "masuk-gudang": "success",
  "ditolak": "danger",
  "menunggu-spk-retur": "warning",
  "diproses-ulang": "info",
  "selesai": "success",
  "reject-permanen": "danger",
};

// Jenis pekerjaan per vendor
export const jenisPekerjaanMap: Record<string, string> = {
  "potong-jahit": "Potong & Jahit",
  "washing": "Washing / Laundry",
  "finishing-qc-packing": "Finishing, QC & Packing",
};

// Semua kategori jeans
export const KATEGORI_JEANS = [
  "Slim Fit", "Regular Fit", "Bootcut", "Skinny",
  "Wide Leg", "Mom Jeans", "Straight Cut", "Cargo Jeans"
];

// Menu sidebar
export const SIDEBAR_MENU = [
  { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
  { label: "Peta Perjalanan Kain", href: "/peta-perjalanan", icon: "MapPin" },
  { label: "Buat SPK", href: "/buat-spk", icon: "FilePlus" },
  { label: "Daftar SPK", href: "/daftar-spk", icon: "FileText" },
  { label: "Gudang & Stok", href: "/gudang", icon: "Warehouse" },
  { label: "PO Online", href: "/po-online", icon: "ShoppingCart" },
  { label: "Retail Offline", href: "/retail-offline", icon: "Store" },
  { label: "Retur Produksi", href: "/retur-produksi", icon: "RotateCcw" },
  { label: "Retur Online", href: "/retur-online", icon: "RefreshCw" },
  { label: "Laporan Penjualan", href: "/laporan", icon: "BarChart2" },
];
