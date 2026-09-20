// @ts-nocheck
"use client";
import React, { useEffect, useState, useCallback } from "react";
import { Warehouse, Send, CheckCheck, ChevronRight, RefreshCw, Package, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const STAGE_LABELS: Record<string, string> = {
  cmt: "Penjahit (CMT)", gudang: "Gudang Produksi",
  washing: "Washing", benang: "Bersih Benang",
  finishing: "QC / Finishing", siap_jual: "Siap Jual",
};
const STAGE_COLORS: Record<string, string> = {
  cmt: "#8B5CF6", gudang: "#3B82F6", washing: "#06B6D4",
  benang: "#F59E0B", finishing: "#10B981", siap_jual: "#22C55E",
};

export default function GudangProduksiPage() {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showKirimModal, setShowKirimModal] = useState<any | null>(null);
  const [showTerimaModal, setShowTerimaModal] = useState<any | null>(null);
  const [kirimForm, setKirimForm] = useState({ ke: "", vendor_id: "", catatan: "", sizeBreakdown: [] as any[] });
  const [terimaForm, setTerimaForm] = useState({ sizeBreakdown: [] as any[], catatan: "" });
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"masuk" | "kirim" | "semua">("masuk");

  const fetchData = useCallback(async () => {
    try {
      const [resT, resV] = await Promise.all([
        fetch("/api/produksi-transfer?_t=" + Date.now()),
        fetch("/api/vendors?_t=" + Date.now())
      ]);
      const tData = await resT.json();
      const vData = await resV.json();
      setTransfers(Array.isArray(tData) ? tData : []);
      setVendors(Array.isArray(vData) ? vData.filter((v: any) => v.aktif) : []);
    } catch { toast.error("Gagal memuat data"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 3000); return () => clearInterval(i); }, [fetchData]);

  // Real-time sync: instant refresh when another admin makes a change
  useEffect(() => {
    const handler = () => fetchData();
    window.addEventListener("konveksi-sync", handler);
    return () => window.removeEventListener("konveksi-sync", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const masuk = transfers.filter(t => t.ke === "gudang" && t.status !== "Diverifikasi");
  const siapKirim = transfers.filter(t => t.ke === "gudang" && t.status === "Diverifikasi" && !t.is_forwarded);
  const keluar = transfers.filter(t => t.dari === "gudang");
  const pending = transfers.filter(t => t.ke !== "gudang" && t.dari === "gudang" && t.status !== "Diverifikasi");

  const handleVerifikasi = async (transfer: any) => {
    setShowTerimaModal(transfer);
    setTerimaForm({ sizeBreakdown: (transfer.sizeBreakdown || []).map((s: any) => ({ size: s.size, jumlah: s.jumlah || "" })), catatan: "" });
  };

  const submitVerifikasi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showTerimaModal) return;
    setSubmitting(true);
    try {
      const totalDiterima = terimaForm.sizeBreakdown.reduce((s: number, x: any) => s + Number(x.jumlah || 0), 0);
      const res = await fetch("/api/produksi-transfer", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: showTerimaModal.id, jumlah_diterima: totalDiterima, sizeBreakdown_diterima: terimaForm.sizeBreakdown, catatan_terima: terimaForm.catatan })
      });
      if (!res.ok) throw new Error("Gagal verifikasi");
      toast.success("Barang berhasil diverifikasi masuk ke Gudang!");
      setShowTerimaModal(null);
      fetchData();
    } catch (e: any) { toast.error(e.message); }
    finally { setSubmitting(false); }
  };

  const openKirimModal = (transfer: any) => {
    setShowKirimModal(transfer);
    setKirimForm({ ke: "washing", vendor_id: "", catatan: "", sizeBreakdown: (transfer.sizeBreakdown_diterima || transfer.sizeBreakdown || []).map((s: any) => ({ size: s.size, jumlah: s.jumlah || "" })) });
  };

  const submitKirim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showKirimModal || !kirimForm.ke) return;
    setSubmitting(true);
    try {
      const totalKirim = kirimForm.sizeBreakdown.reduce((s: number, x: any) => s + Number(x.jumlah || 0), 0);
      if (totalKirim <= 0) throw new Error("Masukkan jumlah yang akan dikirim");
      const res = await fetch("/api/produksi-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ po_id: showKirimModal.po_id, dari: "gudang", ke: kirimForm.ke, vendor_id: kirimForm.vendor_id || null, jumlah_kirim: totalKirim, sizeBreakdown: kirimForm.sizeBreakdown.filter((s: any) => Number(s.jumlah) > 0), catatan: kirimForm.catatan, transfer_id_asal: showKirimModal.id })
      });
      if (!res.ok) throw new Error("Gagal mengirim");
      toast.success(`Berhasil dikirim ke ${STAGE_LABELS[kirimForm.ke]}!`);
      setShowKirimModal(null);
      fetchData();
    } catch (e: any) { toast.error(e.message); }
    finally { setSubmitting(false); }
  };

  const tipeVendorForStage: Record<string, string[]> = { washing: ["washing"], benang: ["benang", "bersih_benang"], finishing: ["finishing", "qc_finishing"] };
  const vendorForKe = (ke: string) => vendors.filter(v => (tipeVendorForStage[ke] || []).includes(v.tipe));

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0F172A", color: "white", fontSize: 18 }}>⏳ Memuat Gudang Produksi...</div>;

  return (
    <div style={{ minHeight: "100vh", background: "#0F172A", padding: 0 }}>
      {/* Header */}
      <div style={{ background: "#1E293B", padding: "24px 32px", borderBottom: "1px solid #334155" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ background: "#3B82F6", width: 50, height: 50, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Warehouse size={26} color="white" />
          </div>
          <div>
            <h1 style={{ margin: 0, color: "white", fontSize: 22, fontWeight: 800 }}>Portal Gudang Produksi</h1>
            <p style={{ margin: 0, color: "#64748B", fontSize: 13 }}>Pusat penerimaan & pengiriman barang antar tahap produksi</p>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 16 }}>
            <div style={{ background: "#0F172A", borderRadius: 12, padding: "12px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#EF4444" }}>{masuk.length}</div>
              <div style={{ fontSize: 11, color: "#64748B" }}>Perlu Verifikasi</div>
            </div>
            <div style={{ background: "#0F172A", borderRadius: 12, padding: "12px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#10B981" }}>{siapKirim.length}</div>
              <div style={{ fontSize: 11, color: "#64748B" }}>Siap Dikirim</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: 32 }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {(["masuk", "kirim", "semua"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: "10px 20px", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, background: activeTab === tab ? "#3B82F6" : "#1E293B", color: activeTab === tab ? "white" : "#64748B", position: "relative", transition: "all 0.2s" }}>
              {tab === "masuk" ? "⬇️ Barang Masuk" : tab === "kirim" ? "⬆️ Kirim ke Proses" : "📋 Semua Riwayat"}
              {tab === "masuk" && masuk.length > 0 && <span style={{ position: "absolute", top: -6, right: -6, background: "#EF4444", color: "white", borderRadius: "50%", width: 20, height: 20, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>{masuk.length}</span>}
            </button>
          ))}
        </div>

        {/* TAB: Barang Masuk (perlu verifikasi) */}
        {activeTab === "masuk" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {masuk.length === 0 ? (
              <div style={{ background: "#1E293B", borderRadius: 16, padding: 60, textAlign: "center" }}>
                <CheckCheck size={48} style={{ color: "#334155", margin: "0 auto 16px", display: "block" }} />
                <div style={{ color: "#64748B", fontWeight: 700 }}>Tidak ada barang masuk yang perlu diverifikasi</div>
              </div>
            ) : masuk.map((t: any) => (
              <div key={t.id} style={{ background: "#1E293B", borderRadius: 16, padding: 24, border: "2px solid #EF4444" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <span style={{ padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: STAGE_COLORS[t.dari] + "33", color: STAGE_COLORS[t.dari] }}>{STAGE_LABELS[t.dari] || t.dari}</span>
                      <ChevronRight size={16} color="#64748B" />
                      <span style={{ padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: "#3B82F633", color: "#3B82F6" }}>Gudang Produksi</span>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "white" }}>{t.noPo} — {t.model}</div>
                    <div style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>Dari: {t.vendor_nama} · {new Date(t.tanggal_kirim).toLocaleDateString("id-ID")} · <b style={{ color: "#F59E0B" }}>{t.jumlah_kirim} pcs</b></div>
                    <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                      {(t.sizeBreakdown || []).map((s: any, i: number) => <span key={i} style={{ background: "#0F172A", color: "white", padding: "4px 10px", borderRadius: 6, fontSize: 13, fontWeight: 700 }}>{s.size}: {s.jumlah} pcs</span>)}
                    </div>
                  </div>
                  <button onClick={() => handleVerifikasi(t)} style={{ background: "#10B981", color: "white", padding: "12px 20px", borderRadius: 12, border: "none", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                    <CheckCheck size={18} /> Verifikasi Terima
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB: Kirim ke Proses */}
        {activeTab === "kirim" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {siapKirim.length === 0 ? (
              <div style={{ background: "#1E293B", borderRadius: 16, padding: 60, textAlign: "center" }}>
                <Package size={48} style={{ color: "#334155", margin: "0 auto 16px", display: "block" }} />
                <div style={{ color: "#64748B", fontWeight: 700 }}>Tidak ada barang di gudang yang siap dikirim</div>
                <div style={{ color: "#475569", fontSize: 13, marginTop: 8 }}>Verifikasi barang masuk terlebih dahulu</div>
              </div>
            ) : siapKirim.map((t: any) => (
              <div key={t.id} style={{ background: "#1E293B", borderRadius: 16, padding: 24, border: "1px solid #334155" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "white" }}>{t.noPo} — {t.model}</div>
                    <div style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>Dari: {STAGE_LABELS[t.dari]} · Diterima: <b style={{ color: "#10B981" }}>{t.jumlah_diterima} pcs</b></div>
                    <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                      {(t.sizeBreakdown_diterima || t.sizeBreakdown || []).map((s: any, i: number) => <span key={i} style={{ background: "#0F172A", color: "white", padding: "4px 10px", borderRadius: 6, fontSize: 13, fontWeight: 700 }}>{s.size}: {s.jumlah} pcs</span>)}
                    </div>
                  </div>
                  <button onClick={() => openKirimModal(t)} style={{ background: "#F59E0B", color: "white", padding: "12px 20px", borderRadius: 12, border: "none", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                    <Send size={18} /> Kirim ke Proses
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB: Semua Riwayat */}
        {activeTab === "semua" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {transfers.length === 0 ? <div style={{ color: "#64748B", textAlign: "center", padding: 40 }}>Belum ada riwayat transfer</div> : transfers.map((t: any) => (
              <div key={t.id} style={{ background: "#1E293B", borderRadius: 12, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: STAGE_COLORS[t.dari] || "white" }}>{STAGE_LABELS[t.dari] || t.dari}</span>
                    <ChevronRight size={14} color="#64748B" />
                    <span style={{ fontSize: 13, fontWeight: 700, color: STAGE_COLORS[t.ke] || "white" }}>{STAGE_LABELS[t.ke] || t.ke}</span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "white" }}>{t.noPo} · {t.jumlah_kirim} pcs</div>
                  <div style={{ fontSize: 12, color: "#64748B" }}>{new Date(t.tanggal_kirim).toLocaleDateString("id-ID")}</div>
                </div>
                <span style={{ padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: t.status === "Diverifikasi" ? "#D1FAE5" : t.status === "Kirim" ? "#FEF3C7" : "#DBEAFE", color: t.status === "Diverifikasi" ? "#065F46" : t.status === "Kirim" ? "#92400E" : "#1E40AF" }}>
                  {t.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Verifikasi Terima */}
      {showTerimaModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
          <div style={{ background: "#1E293B", borderRadius: 20, width: "100%", maxWidth: 500, border: "1px solid #334155" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #334155", background: "#0F172A", borderRadius: "20px 20px 0 0" }}>
              <h3 style={{ margin: 0, color: "white", fontWeight: 800 }}>Verifikasi Terima Barang</h3>
              <div style={{ fontSize: 13, color: "#64748B" }}>Konfirmasi jumlah yang benar-benar masuk ke Gudang</div>
            </div>
            <form onSubmit={submitVerifikasi} style={{ padding: 24 }}>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", color: "#94A3B8", fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Jumlah yang Diterima per Size:</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {terimaForm.sizeBreakdown.map((s, idx) => (
                    <div key={s.size} style={{ display: "flex", alignItems: "center", gap: 12, background: "#0F172A", padding: 12, borderRadius: 12 }}>
                      <div style={{ background: "#1E293B", color: "white", width: 40, height: 40, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>{s.size}</div>
                      <input type="number" min="0" placeholder="0" value={s.jumlah} onChange={e => { const f = [...terimaForm.sizeBreakdown]; f[idx].jumlah = Number(e.target.value); setTerimaForm({ ...terimaForm, sizeBreakdown: f }); }} style={{ flex: 1, background: "transparent", border: "none", color: "white", fontSize: 18, fontWeight: 700, outline: "none" }} />
                      <div style={{ fontSize: 12, color: "#64748B" }}>Laporan: {showTerimaModal.sizeBreakdown?.find((x: any) => x.size === s.size)?.jumlah || 0} pcs</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", color: "#94A3B8", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Catatan</label>
                <input type="text" placeholder="Opsional..." value={terimaForm.catatan} onChange={e => setTerimaForm({ ...terimaForm, catatan: e.target.value })} style={{ width: "100%", background: "#0F172A", border: "1px solid #334155", color: "white", padding: "12px 16px", borderRadius: 10, outline: "none", fontSize: 14 }} />
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <button type="button" onClick={() => setShowTerimaModal(null)} style={{ flex: 1, background: "#0F172A", color: "#64748B", padding: 14, borderRadius: 12, border: "1px solid #334155", fontWeight: 700, cursor: "pointer" }}>Batal</button>
                <button type="submit" disabled={submitting} style={{ flex: 2, background: "#10B981", color: "white", padding: 14, borderRadius: 12, border: "none", fontWeight: 800, cursor: "pointer" }}>
                  {submitting ? "Menyimpan..." : "✅ Konfirmasi Diterima"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Kirim ke Proses */}
      {showKirimModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
          <div style={{ background: "#1E293B", borderRadius: 20, width: "100%", maxWidth: 520, border: "1px solid #334155", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #334155", background: "#0F172A", borderRadius: "20px 20px 0 0" }}>
              <h3 style={{ margin: 0, color: "white", fontWeight: 800 }}>Kirim ke Tahap Produksi</h3>
              <div style={{ fontSize: 13, color: "#64748B" }}>{showKirimModal.noPo} — {showKirimModal.model}</div>
            </div>
            <form onSubmit={submitKirim} style={{ padding: 24 }}>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", color: "#94A3B8", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Kirim ke Tahap:</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {["washing", "benang", "finishing"].map(stage => (
                    <button key={stage} type="button" onClick={() => setKirimForm({ ...kirimForm, ke: stage, vendor_id: "" })} style={{ padding: "8px 16px", borderRadius: 8, border: `2px solid ${kirimForm.ke === stage ? STAGE_COLORS[stage] : "#334155"}`, background: kirimForm.ke === stage ? STAGE_COLORS[stage] + "22" : "#0F172A", color: kirimForm.ke === stage ? STAGE_COLORS[stage] : "#64748B", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                      {STAGE_LABELS[stage]}
                    </button>
                  ))}
                </div>
              </div>
              {kirimForm.ke && (
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", color: "#94A3B8", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Vendor / Tim:</label>
                  <select value={kirimForm.vendor_id} onChange={e => setKirimForm({ ...kirimForm, vendor_id: e.target.value })} style={{ width: "100%", background: "#0F172A", border: "1px solid #334155", color: "white", padding: "12px 16px", borderRadius: 10, outline: "none", fontSize: 14 }}>
                    <option value="">— Pilih Vendor —</option>
                    {vendorForKe(kirimForm.ke).map((v: any) => <option key={v.id} value={v.id}>{v.nama}</option>)}
                    {vendorForKe(kirimForm.ke).length === 0 && <option disabled>Tidak ada vendor terdaftar untuk tahap ini</option>}
                  </select>
                </div>
              )}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", color: "#94A3B8", fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Jumlah yang Dikirim per Size:</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {kirimForm.sizeBreakdown.map((s: any, idx: number) => (
                    <div key={s.size} style={{ display: "flex", alignItems: "center", gap: 12, background: "#0F172A", padding: 12, borderRadius: 12 }}>
                      <div style={{ background: "#1E293B", color: "white", width: 40, height: 40, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>{s.size}</div>
                      <input type="number" min="0" placeholder="0" value={s.jumlah} onChange={e => { const f = [...kirimForm.sizeBreakdown]; f[idx].jumlah = Number(e.target.value); setKirimForm({ ...kirimForm, sizeBreakdown: f }); }} style={{ flex: 1, background: "transparent", border: "none", color: "white", fontSize: 18, fontWeight: 700, outline: "none" }} />
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", color: "#94A3B8", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Catatan</label>
                <input type="text" placeholder="Opsional..." value={kirimForm.catatan} onChange={e => setKirimForm({ ...kirimForm, catatan: e.target.value })} style={{ width: "100%", background: "#0F172A", border: "1px solid #334155", color: "white", padding: "12px 16px", borderRadius: 10, outline: "none", fontSize: 14 }} />
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <button type="button" onClick={() => setShowKirimModal(null)} style={{ flex: 1, background: "#0F172A", color: "#64748B", padding: 14, borderRadius: 12, border: "1px solid #334155", fontWeight: 700, cursor: "pointer" }}>Batal</button>
                <button type="submit" disabled={submitting} style={{ flex: 2, background: "#F59E0B", color: "white", padding: 14, borderRadius: 12, border: "none", fontWeight: 800, cursor: "pointer" }}>
                  {submitting ? "Mengirim..." : "📦 Kirim Sekarang"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
