export default function PlaceholderPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#F1F5F9", overflow: "hidden" }}>
      <div style={{ padding: "24px 32px", background: "white", borderBottom: "1px solid #E2E8F0", flexShrink: 0 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", marginBottom: 4 }}>Pembelian (PO)</h1>
        <p style={{ fontSize: 13, color: "#64748B" }}>Catat pembelian bahan baku dari supplier</p>
      </div>
      <div style={{ flex: 1, padding: "24px 32px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ background: "white", borderRadius: 16, border: "1px dashed #CBD5E1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 60, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>???</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", marginBottom: 8 }}>Modul Dalam Pengembangan</div>
          <div style={{ fontSize: 14, color: "#64748B", maxWidth: 400 }}>Halaman ini telah disiapkan untuk ekspansi sistem ERP KonveksiApps. Integrasi database akan segera dilakukan.</div>
        </div>
      </div>
    </div>
  );
}
