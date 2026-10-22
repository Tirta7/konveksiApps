"use client";
import { Boxes } from "lucide-react";
import ScanJualPanel from "@/components/ScanJualPanel";

export default function PenjualanGrosirPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#F1F5F9", overflow: "hidden" }}>
      <div style={{ padding: "24px 32px", background: "white", borderBottom: "1px solid #E2E8F0", flexShrink: 0, display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,#6366F1,#8B5CF6)", color: "white", display: "flex", alignItems: "center", justifyContent: "center" }}><Boxes size={22} /></div>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", marginBottom: 4 }}>Penjualan Grosir</h1>
          <p style={{ fontSize: 13, color: "#64748B" }}>Scan barcode per pcs untuk transaksi grosir / partai besar — stok Data Barang berkurang otomatis</p>
        </div>
      </div>
      <div style={{ flex: 1, padding: "24px 32px", overflowY: "auto" }}>
        <ScanJualPanel kanal="Penjualan Grosir" accent="#6366F1" pelangganLabel="Nama Reseller / Toko" />
      </div>
    </div>
  );
}
