import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Portal Gudang Retur | TIRTA BINTANG JEANS",
  description: "Portal Khusus Pengecekan & Verifikasi Retur Barang Online (Shopee / TikTok Shop)",
};

export default function PortalReturLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100dvh", background: "#F1F5F9", color: "#0F172A", width: "100%", display: "flex", flexDirection: "column" }}>
      {children}
    </div>
  );
}
