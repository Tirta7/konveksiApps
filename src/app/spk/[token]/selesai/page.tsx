"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function VendorSelesaiPage() {
  const params = useParams();
  const token = params.token as string;
  const [spk, setSpk] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [showQCOptions, setShowQCOptions] = useState(false);
  const [qcResult, setQcResult] = useState<"lolos" | "gagal" | null>(null);

  useEffect(() => {
    fetch(`/api/spk/${token}`).then(r => r.json()).then(d => {
      if (d.error) setError(d.error);
      else setSpk(d);
      setLoading(false);
    });
  }, [token]);

  const isFinishing = spk?.jenis_pekerjaan === "Finishing, QC & Packing";

  const handleSelesai = async (aksi: string = "selesai") => {
    setSubmitting(true);
    const res = await fetch(`/api/spk/${token}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aksi }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (data.success || data.status) {
      setConfirmed(true);
      if (aksi === "qc-gagal") setQcResult("gagal");
      else setQcResult("lolos");
    }
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F1F5F9", fontFamily: "Inter,sans-serif" }}>
      <div style={{ textAlign: "center" }}><div style={{ fontSize: 48 }}>⏳</div><p style={{ fontSize: 20, color: "#64748B", marginTop: 12 }}>Memuat...</p></div>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F1F5F9", padding: 20, fontFamily: "Inter,sans-serif" }}>
      <div style={{ background: "white", borderRadius: 16, padding: 40, maxWidth: 480, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 56 }}>🚫</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginTop: 16 }}>Link Tidak Valid</h1>
        <p style={{ color: "#64748B", fontSize: 16, marginTop: 8 }}>{error}</p>
      </div>
    </div>
  );

  if (confirmed) return (
    <div style={{ minHeight: "100vh", background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "Inter,sans-serif" }}>
      <div style={{ background: "white", borderRadius: 20, padding: 40, maxWidth: 480, width: "100%", textAlign: "center", boxShadow: "0 4px 24px rgba(0,0,0,0.1)" }}>
        {qcResult === "gagal" ? (
          <>
            <div style={{ fontSize: 72 }}>⚠️</div>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: "16px 0 8px", color: "#1E293B" }}>QC Gagal Dicatat</h1>
            <p style={{ color: "#64748B", fontSize: 18 }}>Barang akan dikembalikan ke washing. Admin akan menerbitkan SPK retur.</p>
          </>
        ) : (
          <>
            <div style={{ fontSize: 72 }}>✅</div>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: "16px 0 8px", color: "#1E293B" }}>Barang Berhasil Dikirim!</h1>
            <p style={{ color: "#64748B", fontSize: 18 }}>Pekerjaan untuk SPK <strong>{spk?.no_spk}</strong> selesai. Terima kasih!</p>
          </>
        )}
        <div style={{ marginTop: 24, padding: 16, background: "#F8FAFC", borderRadius: 12, fontSize: 14, color: "#94A3B8" }}>
          Status sudah diperbarui secara otomatis di sistem admin.
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F1F5F9", padding: 20, fontFamily: "Inter,sans-serif" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 24, paddingTop: 20 }}>
          <div style={{ fontSize: 14, color: "#64748B", marginBottom: 4 }}>👖 KonveksiApps</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#1E293B" }}>Konfirmasi Pekerjaan Selesai</h1>
        </div>

        {/* Status Dikerjakan */}
        <div style={{ background: "#DBEAFE", borderRadius: 16, padding: 24, marginBottom: 16, textAlign: "center", border: "2px solid #3B82F6" }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>⚙️</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#1E40AF" }}>Sedang Dikerjakan</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#1E293B", marginTop: 4 }}>{spk.no_spk}</div>
        </div>

        {/* Detail */}
        <div style={{ background: "white", borderRadius: 16, padding: 24, marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "grid", gap: 14 }}>
            {[
              { label: "Jenis Pekerjaan", value: spk.jenis_pekerjaan },
              { label: "Jumlah Barang", value: `${spk.jumlah_barang} pcs` },
              { label: "Batch Kain", value: spk.kode_batch },
            ].map(item => (
              <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, borderBottom: "1px solid #E2E8F0" }}>
                <span style={{ fontSize: 15, color: "#64748B", fontWeight: 600 }}>{item.label}</span>
                <span style={{ fontSize: 17, fontWeight: 800, color: "#1E293B" }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* QC Options jika Finishing */}
        {isFinishing && !showQCOptions && (
          <button onClick={() => setShowQCOptions(true)} disabled={submitting}
            style={{ width: "100%", background: "#10B981", color: "white", border: "none", borderRadius: 16, padding: "22px 24px", fontSize: 22, fontWeight: 900, cursor: "pointer", marginBottom: 12 }}>
            ✅ Laporkan Hasil QC
          </button>
        )}

        {isFinishing && showQCOptions && (
          <div style={{ background: "white", borderRadius: 16, padding: 24, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16, textAlign: "center" }}>Hasil QC Bagaimana?</h2>
            <button onClick={() => handleSelesai("selesai")} disabled={submitting}
              style={{ width: "100%", background: "#10B981", color: "white", border: "none", borderRadius: 12, padding: "18px 24px", fontSize: 20, fontWeight: 800, cursor: "pointer", marginBottom: 10 }}>
              ✅ QC Lolos — Masuk Gudang
            </button>
            <button onClick={() => handleSelesai("qc-gagal")} disabled={submitting}
              style={{ width: "100%", background: "#EF4444", color: "white", border: "none", borderRadius: 12, padding: "18px 24px", fontSize: 20, fontWeight: 800, cursor: "pointer" }}>
              ❌ QC Gagal — Ada Cacat Washing
            </button>
          </div>
        )}

        {!isFinishing && (
          <button onClick={() => handleSelesai("selesai")} disabled={submitting}
            style={{ width: "100%", background: submitting ? "#94A3B8" : "#10B981", color: "white", border: "none", borderRadius: 16, padding: "22px 24px", fontSize: 22, fontWeight: 900, cursor: submitting ? "not-allowed" : "pointer", marginBottom: 12 }}>
            {submitting ? "⏳ Memproses..." : "✅ Selesai & Kirim ke Vendor Berikutnya"}
          </button>
        )}

        <p style={{ textAlign: "center", fontSize: 13, color: "#94A3B8" }}>
          Tekan tombol setelah pekerjaan benar-benar selesai dan barang siap dikirim
        </p>
      </div>
    </div>
  );
}
