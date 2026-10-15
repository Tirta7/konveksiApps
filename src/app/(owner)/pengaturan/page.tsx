"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  Printer, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  Layers, 
  ExternalLink,
  Sparkles,
  Upload,
  Image as ImageIcon,
  Trash2,
  Smartphone,
  Globe,
  Download,
  Info
} from "lucide-react";

export default function PengaturanPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    nama_usaha: "KONVEKSI APPS | JEANS PRODUCTION",
    tagline: "Sistem Tracking Produksi Jeans",
    alamat: "Jl. Industri Konveksi No. 88",
    telepon: "(022) 555-8899",
    email: "info@konveksiapps.com",
    divisi: "Divisi Cutting & Bahan",
    logo_url: "/icons/icon-192.png",
    catatan_surat_jalan: "Barang/kain & bahan pendukung di atas telah diperiksa dan diserahkan dalam kondisi lengkap dan tepat jumlah.",
    jabatan_penyerah: "Bagian Gudang & Bahan",
    jabatan_penerima: "Tukang Potong / Cutting",
    jabatan_penyetuju: "Admin Produksi / Supervisor"
  });

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/pengaturan");
        if (res.ok) {
          const data = await res.json();
          setForm(prev => ({
            ...prev,
            ...data
          }));
        }
      } catch (err) {
        console.error("Gagal memuat pengaturan:", err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 4 * 1024 * 1024) {
      alert("Ukuran gambar terlalu besar. Maksimal 4 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setForm(prev => ({ ...prev, logo_url: result }));
        // Live preview on favicon immediately
        let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
        if (link) link.href = result;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResetDefaultLogo = () => {
    setForm(prev => ({ ...prev, logo_url: "/icons/icon-192.png" }));
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (link) link.href = "/icons/icon-192.png";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    setErrorMsg("");

    try {
      const res = await fetch("/api/pengaturan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSaveSuccess(true);
        if (form.nama_usaha) {
          const newTitle = form.tagline ? `${form.nama_usaha} — ${form.tagline}` : form.nama_usaha;
          document.title = newTitle;
        }
        if (form.logo_url) {
          let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
          if (link) link.href = form.logo_url;
        }
        window.dispatchEvent(new CustomEvent("pengaturan-changed"));
        window.dispatchEvent(new CustomEvent("konveksi-sync"));
        setTimeout(() => setSaveSuccess(false), 4500);
      } else {
        setErrorMsg(data.error || "Gagal menyimpan perubahan");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan jaringan");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: "center", color: "#64748B", fontSize: 15 }}>
        Memuat data pengaturan sistem...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#F8FAFC", overflow: "hidden" }}>
      
      {/* HEADER BAR */}
      <div style={{ padding: "20px 32px", background: "white", borderBottom: "1px solid #E2E8F0", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "#EFF6FF", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Building2 size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: "#0F172A", margin: 0 }}>
                Pengaturan Sistem & Identitas Cetak
              </h1>
              <p style={{ fontSize: 13, color: "#64748B", margin: "2px 0 0 0" }}>
                Atur nama konveksi, logo brand, alamat workshop, dan integrasi aplikasi PWA (Layar Utama HP / Desktop).
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="btn btn-primary"
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 22px", fontWeight: 800, fontSize: 13, background: "#2563EB", cursor: saving ? "not-allowed" : "pointer" }}
          >
            <Save size={16} /> {saving ? "Menyimpan..." : "Simpan Pengaturan"}
          </button>
        </div>
      </div>

      {/* TOAST / ALERTS */}
      {saveSuccess && (
        <div style={{ background: "#ECFDF5", borderBottom: "1px solid #A7F3D0", padding: "12px 32px", display: "flex", alignItems: "center", gap: 10, color: "#065F46", fontSize: 13, fontWeight: 700, animation: "fadeIn 0.3s ease" }}>
          <CheckCircle2 size={18} color="#059669" />
          Pengaturan berhasil disimpan! Logo, judul tab browser, sidebar, dan kop cetak otomatis diperbarui.
        </div>
      )}

      {errorMsg && (
        <div style={{ background: "#FEF2F2", borderBottom: "1px solid #FECACA", padding: "12px 32px", display: "flex", alignItems: "center", gap: 10, color: "#991B1B", fontSize: 13, fontWeight: 700 }}>
          <AlertCircle size={18} color="#DC2626" />
          {errorMsg}
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <div style={{ flex: 1, padding: "24px 32px", overflowY: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 28, maxWidth: 1500, margin: "0 auto", alignItems: "start" }}>
          
          {/* COLUMN 1: FORM PENGATURAN */}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            
            {/* CARD 0: UPLOAD LOGO & BRAND ICON */}
            <div style={{ background: "white", borderRadius: 16, border: "1px solid #E2E8F0", padding: 24, boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 16, borderBottom: "1px solid #F1F5F9", marginBottom: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <ImageIcon size={18} color="#2563EB" />
                  <h2 style={{ fontSize: 15, fontWeight: 800, color: "#1E293B", margin: 0 }}>
                    1. Logo Brand & Ikon Aplikasi (Favicon & PWA)
                  </h2>
                </div>
                <span style={{ fontSize: 11, background: "#EFF6FF", color: "#2563EB", fontWeight: 700, padding: "2px 8px", borderRadius: 6, border: "1px solid #BFDBFE" }}>
                  Tab Browser & Layar Utama HP
                </span>
              </div>

              <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
                
                {/* PREVIEW BOX */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <div style={{ 
                    width: 104, 
                    height: 104, 
                    borderRadius: 20, 
                    background: "#0F172A", 
                    border: "2px dashed #94A3B8", 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center",
                    overflow: "hidden",
                    boxShadow: "0 4px 12px rgba(15,23,42,0.15)",
                    position: "relative"
                  }}>
                    <img 
                      src={form.logo_url || "/icons/icon-192.png"} 
                      alt="Logo Usaha" 
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = "/icons/icon-192.png";
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 10, color: "#64748B", fontWeight: 700 }}>
                    Ukuran Rekomendasi 1:1
                  </span>
                </div>

                {/* UPLOAD CONTROLS & LIVE SIMULATION BADGES */}
                <div style={{ flex: 1, minWidth: 260 }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png, image/jpeg, image/svg+xml, image/webp"
                    style={{ display: "none" }}
                    onChange={handleLogoUpload}
                  />

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="btn btn-primary"
                      style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "8px 16px", fontWeight: 700 }}
                    >
                      <Upload size={15} /> Upload Logo Baru
                    </button>

                    <button
                      type="button"
                      onClick={handleResetDefaultLogo}
                      className="btn btn-secondary"
                      style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "8px 14px", fontWeight: 600 }}
                    >
                      Pakai Ikon Jeans Bawaan
                    </button>
                  </div>

                  <div style={{ fontSize: 11, color: "#64748B", lineHeight: 1.5 }}>
                    Mendukung format <strong>PNG, JPG, SVG, WebP</strong> (Maksimal 4 MB). Logo ini langsung terpasang pada:
                  </div>

                  {/* MINI BADGES */}
                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#F1F5F9", padding: "4px 8px", borderRadius: 6, fontSize: 11, border: "1px solid #E2E8F0" }}>
                      <Globe size={13} color="#2563EB" />
                      <span><strong>Ikon Tab Browser</strong> (Favicon)</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#F1F5F9", padding: "4px 8px", borderRadius: 6, fontSize: 11, border: "1px solid #E2E8F0" }}>
                      <Building2 size={13} color="#059669" />
                      <span><strong>Logo Sidebar</strong> Aplikasi</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#F1F5F9", padding: "4px 8px", borderRadius: 6, fontSize: 11, border: "1px solid #E2E8F0" }}>
                      <Smartphone size={13} color="#D97706" />
                      <span><strong>Ikon Layar HP</strong> (PWA Homescreen)</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* CARD 1: IDENTITAS PERUSAHAAN / APLIKASI */}
            <div style={{ background: "white", borderRadius: 16, border: "1px solid #E2E8F0", padding: 24, boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 16, borderBottom: "1px solid #F1F5F9", marginBottom: 18 }}>
                <Building2 size={18} color="#2563EB" />
                <h2 style={{ fontSize: 15, fontWeight: 800, color: "#1E293B", margin: 0 }}>
                  2. Identitas Usaha & Nama Aplikasi
                </h2>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                    Nama Usaha / Konveksi (Judul Tab & Kop Surat) <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="Contoh: TIRTA BINTANG JEANS"
                    value={form.nama_usaha}
                    onChange={e => setForm({ ...form, nama_usaha: e.target.value })}
                    style={{ fontSize: 13, fontWeight: 800 }}
                  />
                  <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>
                    Otomatis menjadi judul pada tab browser dan kop utama huruf tebal pada surat jalan/SPK potong.
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div>
                    <label className="form-label" style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                      Tagline / Subtitle Aplikasi
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Contoh: Spesialis Denim & Celana Jeans"
                      value={form.tagline}
                      onChange={e => setForm({ ...form, tagline: e.target.value })}
                      style={{ fontSize: 12 }}
                    />
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                      Divisi / Bagian pada Kop Surat
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Contoh: Divisi Cutting & Bahan"
                      value={form.divisi}
                      onChange={e => setForm({ ...form, divisi: e.target.value })}
                      style={{ fontSize: 12 }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 2: KONTAK & ALAMAT WORKSHOP */}
            <div style={{ background: "white", borderRadius: 16, border: "1px solid #E2E8F0", padding: 24, boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 16, borderBottom: "1px solid #F1F5F9", marginBottom: 18 }}>
                <MapPin size={18} color="#059669" />
                <h2 style={{ fontSize: 15, fontWeight: 800, color: "#1E293B", margin: 0 }}>
                  3. Alamat & Kontak Workshop (Tercetak di Surat)
                </h2>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                    Alamat Lengkap Workshop / Pabrik <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <textarea
                    rows={2}
                    required
                    className="form-control"
                    placeholder="Contoh: Jl. Cigondewah Raya No. 45, Bandung"
                    value={form.alamat}
                    onChange={e => setForm({ ...form, alamat: e.target.value })}
                    style={{ fontSize: 12, lineHeight: 1.4 }}
                  />
                  <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>
                    Dicetak langsung di bawah nama konveksi pada baris header dot matrix.
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div>
                    <label className="form-label" style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                      No. Telepon / WhatsApp
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Contoh: 0812-9876-5432"
                        value={form.telepon}
                        onChange={e => setForm({ ...form, telepon: e.target.value })}
                        style={{ fontSize: 12 }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                      Email Usaha (Opsional)
                    </label>
                    <input
                      type="email"
                      className="form-control"
                      placeholder="Contoh: info@konveksiapps.com"
                      value={form.email}
                      onChange={e => setForm({ ...form, email: e.target.value })}
                      style={{ fontSize: 12 }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 3: FORMAT FOOTER & TANDA TANGAN */}
            <div style={{ background: "white", borderRadius: 16, border: "1px solid #E2E8F0", padding: 24, boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 16, borderBottom: "1px solid #F1F5F9", marginBottom: 18 }}>
                <FileText size={18} color="#D97706" />
                <h2 style={{ fontSize: 15, fontWeight: 800, color: "#1E293B", margin: 0 }}>
                  4. Format Surat Jalan & Tanda Tangan
                </h2>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                    Catatan Pernyataan Serah Terima
                  </label>
                  <textarea
                    rows={2}
                    className="form-control"
                    placeholder="Kalimat peringatan serah terima barang di atas tanda tangan..."
                    value={form.catatan_surat_jalan}
                    onChange={e => setForm({ ...form, catatan_surat_jalan: e.target.value })}
                    style={{ fontSize: 12, fontStyle: "italic", lineHeight: 1.4 }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <div>
                    <label className="form-label" style={{ fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                      Pihak 1 (Menyerahkan)
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={form.jabatan_penyerah}
                      onChange={e => setForm({ ...form, jabatan_penyerah: e.target.value })}
                      style={{ fontSize: 11, padding: "7px 10px" }}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                      Pihak 2 (Penerima)
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={form.jabatan_penerima}
                      onChange={e => setForm({ ...form, jabatan_penerima: e.target.value })}
                      style={{ fontSize: 11, padding: "7px 10px" }}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                      Pihak 3 (Menyetujui)
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={form.jabatan_penyetuju}
                      onChange={e => setForm({ ...form, jabatan_penyetuju: e.target.value })}
                      style={{ fontSize: 11, padding: "7px 10px" }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* SUBMIT BUTTON ROW */}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary"
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 32px", fontWeight: 800, fontSize: 14, background: "#2563EB" }}
              >
                <Save size={18} /> {saving ? "Menyimpan Data..." : "Simpan Semua Pengaturan"}
              </button>
            </div>
          </form>

          {/* COLUMN 2: LIVE PREVIEW & PWA STATUS */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20, position: "sticky", top: 24 }}>
            
            {/* PWA & HOMESCREEN STATUS CARD */}
            <div style={{ background: "linear-gradient(135deg, #1E293B, #0F172A)", borderRadius: 16, padding: 20, color: "white", boxShadow: "0 4px 14px rgba(15,23,42,0.15)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Smartphone size={20} color="#38BDF8" />
                  <h3 style={{ fontSize: 14, fontWeight: 800, color: "white", margin: 0 }}>
                    Aplikasi PWA (Homescreen Ready)
                  </h3>
                </div>
                <span style={{ fontSize: 10, background: "rgba(16,185,129,0.2)", color: "#34D399", fontWeight: 800, padding: "2px 8px", borderRadius: 6, border: "1px solid rgba(16,185,129,0.4)" }}>
                  ✅ Aktif & Siap Install
                </span>
              </div>

              <p style={{ fontSize: 12, color: "#94A3B8", margin: "0 0 14px 0", lineHeight: 1.5 }}>
                Aplikasi ini sudah berstandar <strong>PWA (Progressive Web App)</strong>. Anda dan staf bisa meng-install langsung ke <strong>Android, iPhone, iPad, Windows, dan Mac</strong> tanpa download dari PlayStore.
              </p>

              <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 10, padding: "10px 12px", fontSize: 11, color: "#CBD5E1", display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                <div>✨ Buka fullscreen tanpa URL bar browser seperti aplikasi native.</div>
                <div>✨ Ikon di homescreen menggunakan logo yang Anda upload.</div>
                <div>✨ Tetap bisa diakses secara cepat dan offline caching.</div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => {
                    const prompt = (window as any).__deferredPwaPrompt;
                    if (prompt) {
                      prompt.prompt();
                    } else {
                      alert("Petunjuk Install:\n- Google Chrome / Edge: Klik tombol install di address bar atas.\n- Android: Ketuk menu titik tiga (⋮) > Tambahkan ke Layar Utama.\n- iPhone/Safari: Ketuk Share > Tambah ke Layar Utama.");
                    }
                  }}
                  className="btn btn-primary"
                  style={{ flex: 1, padding: "8px 14px", fontSize: 12, fontWeight: 700, background: "#2563EB", border: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  <Download size={15} /> Tes Install ke Homescreen
                </button>
              </div>
            </div>

            {/* LIVE PREVIEW KOP CETAKAN PRINTER DOT MATRIX */}
            <div style={{ background: "white", borderRadius: 16, border: "1px solid #E2E8F0", padding: 22, boxShadow: "0 4px 14px rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Printer size={18} color="#0F172A" />
                  <h3 style={{ fontSize: 14, fontWeight: 800, color: "#0F172A", margin: 0 }}>
                    Live Preview Kop Cetak (Dot Matrix)
                  </h3>
                </div>
                <span style={{ fontSize: 10, background: "#EFF6FF", color: "#2563EB", fontWeight: 800, padding: "3px 8px", borderRadius: 6, border: "1px solid #BFDBFE" }}>
                  Continuous Form 3-Ply
                </span>
              </div>

              <p style={{ fontSize: 12, color: "#64748B", margin: "0 0 16px 0", lineHeight: 1.4 }}>
                Format di bawah ini adalah simulasi tampilan nyata saat dicetak ke printer dot matrix menggunakan continuous paper:
              </p>

              {/* SIMULATED DOT MATRIX SHEET */}
              <div style={{ 
                background: "#FAFBFD", 
                border: "1.5px dashed #475569", 
                padding: "20px 22px", 
                fontFamily: "'Courier New', Courier, monospace", 
                fontSize: 11, 
                lineHeight: 1.35, 
                color: "#000",
                boxShadow: "inset 0 1px 3px rgba(0,0,0,0.03)"
              }}>
                
                {/* PREVIEW KOP HEADER */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #000", paddingBottom: 8, marginBottom: 10 }}>
                  <div style={{ maxWidth: "62%" }}>
                    <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: 0.5, textTransform: "uppercase" }}>
                      {form.nama_usaha || "NAMA KONVEKSI BELUM DIISI"}
                    </div>
                    <div style={{ fontSize: 10, color: "#222", marginTop: 3 }}>
                      {form.alamat || "Alamat workshop belum diisi"} {form.telepon ? `| Telp: ${form.telepon}` : ""} {form.divisi ? `| ${form.divisi}` : ""}
                    </div>
                  </div>

                  <div style={{ textAlign: "right", minWidth: 190 }}>
                    <div style={{ border: "1px solid #000", padding: "4px 6px", fontSize: 8.5, textAlign: "left", background: "white", lineHeight: 1.35 }}>
                      <div style={{ fontWeight: 900, textDecoration: "underline", marginBottom: 2 }}>
                        DISTRIBUSI RANGKAP:
                      </div>
                      <div>( ) <strong>PUTIH</strong> : Arsip Kantor</div>
                      <div>( ) <strong>MERAH</strong> : CMT Jahit</div>
                      <div>( ) <strong>KUNING</strong>: Gudang Bahan</div>
                    </div>
                  </div>
                </div>

                {/* PREVIEW JUDUL DOKUMEN */}
                <div style={{ textAlign: "center", margin: "10px 0" }}>
                  <div style={{ fontSize: 12, fontWeight: 900, textDecoration: "underline" }}>
                    SURAT PERINTAH KERJA (SPK) POTONG & SURAT JALAN BAHAN
                  </div>
                  <div style={{ fontSize: 9.5, fontWeight: 700, marginTop: 1 }}>
                    NOMOR: PO-POT-0003
                  </div>
                </div>

                {/* SIMULATED TABLE BODY */}
                <div style={{ border: "1px solid #000", padding: "6px 8px", fontSize: 10, marginBottom: 10, background: "white" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Tgl Kirim: 2026-10-15</span>
                    <span>Bahan: MK 1299 SST (7 Roll)</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                    <span>Tukang Potong: NGAMPON</span>
                    <span>Total Target: 840 PCS</span>
                  </div>
                </div>

                {/* PREVIEW CATATAN FOOTER */}
                <div style={{ border: "1px solid #000", padding: "8px 10px", fontSize: 9.5, textAlign: "center", fontStyle: "italic", background: "white" }}>
                  "{form.catatan_surat_jalan || "-"}"
                </div>

                {/* PREVIEW TANDA TANGAN */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", textAlign: "center", fontSize: 9, marginTop: 8, gap: 6 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>DISERAHKAN:</div>
                    <div style={{ color: "#555", fontSize: 8 }}>({form.jabatan_penyerah})</div>
                    <div style={{ height: 26 }}></div>
                    <div style={{ borderBottom: "1px solid #000", width: "75%", margin: "0 auto 2px auto" }}></div>
                    <div>( ............ )</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700 }}>DITERIMA:</div>
                    <div style={{ color: "#555", fontSize: 8 }}>({form.jabatan_penerima})</div>
                    <div style={{ height: 26 }}></div>
                    <div style={{ borderBottom: "1px solid #000", width: "75%", margin: "0 auto 2px auto" }}></div>
                    <div>( NGAMPON )</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700 }}>DISETUJUI:</div>
                    <div style={{ color: "#555", fontSize: 8 }}>({form.jabatan_penyetuju})</div>
                    <div style={{ height: 26 }}></div>
                    <div style={{ borderBottom: "1px solid #000", width: "75%", margin: "0 auto 2px auto" }}></div>
                    <div>( ............ )</div>
                  </div>
                </div>

              </div>

              {/* QUICK LINK TO REAL PRINT */}
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "#64748B" }}>
                  Sudah menyimpan logo & identitas?
                </span>
                <Link
                  href="/pemotongan-kain"
                  className="btn btn-secondary"
                  style={{ fontSize: 11, fontWeight: 700, padding: "6px 12px", display: "flex", alignItems: "center", gap: 6 }}
                >
                  Lihat Pemotongan Kain <ExternalLink size={13} />
                </Link>
              </div>

            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
