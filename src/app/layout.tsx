import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KonveksiApps — Sistem Tracking Produksi Jeans",
  description: "Sistem tracking produksi dan penjualan konveksi jeans secara real-time",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
