"use client";
import { useEffect, useState, useMemo } from "react";
import {
  AlertTriangle,
  Undo2,
  Ban,
  CheckCircle,
  Factory,
  RefreshCw,
  Eye,
  Sparkles,
  X,
  Check,
  Clock,
  ChevronRight,
  Store,
  FileText,
  Copy,
  Layers,
  Shirt,
  DollarSign
} from "lucide-react";
import { toast } from "sonner";

function formatTgl(str: string) {
  if (!str) return "-";
  return new Date(str).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ReturProduksiPage() {
  const [list, setList] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<"semua" | "menunggu" | "proses" | "selesai">("semua");

  // Modal Terbitkan SPK Cuci Ulang
  const [spkModalOpen, setSpkModalOpen] = useState(false);
  const [selectedReturForSpk, setSelectedReturForSpk] = useState<any | null>(null);
  const [targetVendorId, setTargetVendorId] = useState<string>("");
  const [jumlahCuci, setJumlahCuci] = useState<number>(0);
  const [catatanCuci, setCatatanCuci] = useState<string>("");
  const [targetSelesai, setTargetSelesai] = useState<string>("");
  const [submittingSpk, setSubmittingSpk] = useState(false);

  // Modal Detail Nota & Cacat
  const [selectedDetail, setSelectedDetail] = useState<any | null>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/returns/produksi")
      .then((r) => r.json())
      .then((d) => {
        setList(Array.isArray(d) ? d : []);
        setLoading(false);
      })
      .catch(() => {
        toast.error("Gagal memuat data retur produksi");
        setLoading(false);
      });
  };

  const loadVendors = () => {
    fetch("/api/vendors")
      .then((r) => r.json())
      .then((d) => {
        const vList = Array.isArray(d) ? d : [];
        setVendors(vList);
      })
      .catch(() => {});
  };

  useEffect(() => {
    load();
    loadVendors();
  }, []);

  // Real-time sync: auto-refresh when changes occur
  useEffect(() => {
    const handler = () => load();
    window.addEventListener("konveksi-sync", handler);
    return () => window.removeEventListener("konveksi-sync", handler);
  }, []);

  const openSpkModal = (r: any) => {
    setSelectedReturForSpk(r);
    setTargetVendorId(String(r.vendor_id || vendors[0]?.id || ""));
    setJumlahCuci(Number(r.jumlah || 1));
    const targetNama = r.vendor_nama || "Vendor";
    setCatatanCuci(`[SPK RETUR PERBAIKAN KE-${(Number(r.ke_berapa_kali) || 1) + 1}] Cacat: ${r.alasan || "Barang reject / cacat produksi"}. Mohon diperbaiki dengan teliti.`);
    // Default target 3 hari ke depan
    const d = new Date();
    d.setDate(d.getDate() + 3);
    setTargetSelesai(d.toISOString().split("T")[0]);
    setSpkModalOpen(true);
  };

  const handleKirimSpkRetur = async () => {
    if (!selectedReturForSpk) return;
    if (!targetVendorId) {
      toast.error("Pilih vendor penanggung jawab terlebih dahulu");
      return;
    }
    if (jumlahCuci <= 0) {
      toast.error("Jumlah pengerjaan ulang harus lebih dari 0");
      return;
    }

    setSubmittingSpk(true);
    try {
      const vendorObj = vendors.find((v) => String(v.id) === String(targetVendorId));
      const targetTahap = vendorObj?.tipe === "washing" ? "washing" : "cmt";

      const res = await fetch("/api/returns/produksi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "buat_spk_retur",
          id: selectedReturForSpk.id,
          vendor_id: targetVendorId,
          ke_tahap: targetTahap,
          jumlah: jumlahCuci,
          catatan: catatanCuci,
          target_selesai: targetSelesai,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menerbitkan SPK Retur");

      toast.success(json.message || "SPK Rework berhasil diterbitkan!");
      setSpkModalOpen(false);
      setSelectedReturForSpk(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmittingSpk(false);
    }
  };

  const handleUbahStatus = async (id: any, status_baru: string) => {
    const label = status_baru === "selesai" ? "Tandai retur ini Selesai (Lolos Cuci)?" : "Tandai retur ini sebagai Reject Permanen (Afval)?";
    if (!confirm(label)) return;

    try {
      const res = await fetch("/api/returns/produksi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ubah_status",
          id,
          status_baru,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal mengubah status");
      toast.success(json.message || "Status berhasil diperbarui");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const filteredList = useMemo(() => {
    return list.filter((r) => {
      if (filterTab === "menunggu") return r.status === "menunggu-spk-retur";
      if (filterTab === "proses") return r.status === "diproses-ulang";
      if (filterTab === "selesai") return r.status === "selesai" || r.status === "reject-permanen";
      return true;
    });
  }, [list, filterTab]);

  const countMenunggu = list.filter((r) => r.status === "menunggu-spk-retur").length;
  const countProses = list.filter((r) => r.status === "diproses-ulang").length;
  const countSelesai = list.filter((r) => r.status === "selesai" || r.status === "reject-permanen").length;

  return (
    <>
      <style>{`
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 99px; }
        .table-row-hover:hover { background: #F8FAFC; }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#F1F5F9", overflow: "hidden" }}>
        
        {/* Fixed Header */}
        <div style={{ padding: "20px 32px", background: "white", borderBottom: "1px solid #E2E8F0", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", marginBottom: 4, display: "flex", alignItems: "center", gap: 10 }}>
              <Undo2 size={24} color="#D97706" /> Retur Produksi (Washing / Cuci Ulang)
            </h1>
            <p style={{ fontSize: 13, color: "#64748B", margin: 0 }}>
              Manajemen batch & PO celana yang dikembalikan karena cacat pada saat QC Washing / Gudang.
            </p>
          </div>

          <button
            type="button"
            onClick={load}
            disabled={loading}
            style={{
              padding: "9px 16px",
              background: "#F8FAFC",
              border: "1px solid #CBD5E1",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              color: "#334155",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6
            }}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh Data
          </button>
        </div>

        {/* Scrollable Content */}
        <div style={{ flex: 1, padding: "24px 32px", display: "flex", flexDirection: "column", gap: 18, overflowY: "auto" }}>
          
          {/* Info Banner Aturan Cuci Ulang */}
          <div style={{ padding: "16px 20px", background: "#FFFBEB", borderRadius: 16, border: "1px solid #FDE68A", flexShrink: 0, display: "flex", gap: 14 }}>
            <div style={{ color: "#D97706", marginTop: 2 }}><AlertTriangle size={22} /></div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 13.5, color: "#92400E", marginBottom: 4 }}>Aturan Resmi Cuci Ulang (Retur Produksi):</div>
              <ul style={{ paddingLeft: 18, fontSize: 12.5, color: "#B45309", margin: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                <li>Setiap batch yang cacat washing boleh dicuci ulang <strong>maksimal 2 kali</strong>.</li>
                <li>Pada kesempatan ke-2, sistem otomatis memberi penanda <strong>Kesempatan Terakhir</strong>.</li>
                <li>Jika sudah 2x dan masih cacat, barang ditandai <strong>Reject Permanen</strong> dan dapat diklaim ganti rugi ke vendor.</li>
              </ul>
            </div>
          </div>

          {/* KPI Cards Summary */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            <div style={{ background: "white", padding: "16px 20px", borderRadius: 16, border: "1px solid #E2E8F0", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "#EFF6FF", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Layers size={22} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>Total Retur</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#0F172A" }}>{list.length} Batch</div>
              </div>
            </div>

            <div style={{ background: "white", padding: "16px 20px", borderRadius: 16, border: "1px solid #E2E8F0", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "#FEF3C7", color: "#D97706", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Clock size={22} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>Menunggu SPK Retur</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#D97706" }}>{countMenunggu} Batch</div>
              </div>
            </div>

            <div style={{ background: "white", padding: "16px 20px", borderRadius: 16, border: "1px solid #E2E8F0", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "#EFF6FF", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <RefreshCw size={22} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>Sedang Cuci Ulang</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#2563EB" }}>{countProses} Batch</div>
              </div>
            </div>

            <div style={{ background: "white", padding: "16px 20px", borderRadius: 16, border: "1px solid #E2E8F0", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CheckCircle size={22} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>Selesai / Lunas Klaim</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#059669" }}>{countSelesai} Batch</div>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div style={{ background: "white", borderRadius: 20, border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column" }}>
            
            {/* Table Toolbar & Tabs */}
            <div style={{ padding: "14px 24px", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Factory size={18} color="#D97706" />
                <h2 style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", margin: 0 }}>Daftar Antrean Retur Produksi</h2>
              </div>

              {/* Filter Tabs */}
              <div style={{ display: "flex", gap: 4, background: "#E2E8F0", padding: 3, borderRadius: 10 }}>
                {[
                  { key: "semua", label: `Semua (${list.length})` },
                  { key: "menunggu", label: `Menunggu (${countMenunggu})` },
                  { key: "proses", label: `Sedang Cuci (${countProses})` },
                  { key: "selesai", label: `Selesai (${countSelesai})` },
                ].map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setFilterTab(t.key as any)}
                    style={{
                      padding: "5px 12px",
                      borderRadius: 7,
                      fontSize: 12,
                      fontWeight: 700,
                      border: "none",
                      cursor: "pointer",
                      background: filterTab === t.key ? "white" : "transparent",
                      color: filterTab === t.key ? "#0F172A" : "#64748B",
                      boxShadow: filterTab === t.key ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                      transition: "all 0.15s ease"
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            
            <div style={{ overflowX: "auto" }}>
              {loading ? (
                <div style={{ padding: 60, textAlign: "center", color: "#94A3B8", fontWeight: 600 }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 12px" }} />
                  Memuat data retur produksi...
                </div>
              ) : filteredList.length === 0 ? (
                <div style={{ padding: 60, textAlign: "center", color: "#94A3B8" }}>
                  <CheckCircle size={36} color="#10B981" style={{ margin: "0 auto 12px" }} />
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", marginBottom: 4 }}>Tidak ada antrean retur pada filter ini</div>
                  <div style={{ fontSize: 13 }}>Semua batch produksi saat ini berjalan lancar.</div>
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead>
                    <tr style={{ background: "#F1F5F9" }}>
                      <th style={{ padding: "14px 20px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "2px solid #E2E8F0" }}>Informasi PO & Produk</th>
                      <th style={{ padding: "14px 20px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "2px solid #E2E8F0" }}>Vendor & Jumlah</th>
                      <th style={{ padding: "14px 20px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "2px solid #E2E8F0" }}>Alasan Retur / Cacat</th>
                      <th style={{ padding: "14px 20px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "2px solid #E2E8F0", textAlign: "center" }}>Counter Cuci</th>
                      <th style={{ padding: "14px 20px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "2px solid #E2E8F0", textAlign: "center" }}>Status</th>
                      <th style={{ padding: "14px 20px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "2px solid #E2E8F0", textAlign: "right" }}>Tindakan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredList.map((r) => {
                      const isMaxReached = r.ke_berapa_kali >= 2;
                      const isRejectPerm = r.status === "reject-permanen";
                      const isSelesai = r.status === "selesai";
                      const isDiproses = r.status === "diproses-ulang";

                      let statusBg = "#FEF3C7";
                      let statusColor = "#92400E";
                      let statusText = "Menunggu SPK Retur";
                      let statusIcon = <AlertTriangle size={13} />;

                      if (isRejectPerm) {
                        statusBg = "#FEF2F2";
                        statusColor = "#991B1B";
                        statusText = "Reject Permanen";
                        statusIcon = <Ban size={13} />;
                      } else if (isDiproses) {
                        statusBg = "#EFF6FF";
                        statusColor = "#1E40AF";
                        statusText = "Diproses Ulang (Washing)";
                        statusIcon = <RefreshCw size={13} />;
                      } else if (isSelesai) {
                        statusBg = "#DCFCE7";
                        statusColor = "#065F46";
                        statusText = r.status_klaim === "Lunas" ? "Selesai (Ganti Rugi Lunas)" : "Selesai Cuci";
                        statusIcon = <CheckCircle size={13} />;
                      }

                      return (
                        <tr key={r.id} className="table-row-hover" style={{ borderBottom: "1px solid #F1F5F9" }}>
                          
                          {/* Info PO & Produk */}
                          <td style={{ padding: "16px 20px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                              <span style={{ fontWeight: 900, fontSize: 13, color: "#0F172A", background: "#F1F5F9", padding: "2px 8px", borderRadius: 6, border: "1px solid #CBD5E1", fontFamily: "monospace" }}>
                                {r.noPo || `PO #${r.po_id || 1}`}
                              </span>
                              {r.no_nota && r.no_nota !== "-" && (
                                <span style={{ fontSize: 11, fontWeight: 700, color: "#DC2626", background: "#FEF2F2", border: "1px solid #FECACA", padding: "1px 6px", borderRadius: 4 }}>
                                  #{r.no_nota}
                                </span>
                              )}
                            </div>
                            <div style={{ fontWeight: 800, fontSize: 13.5, color: "#1E293B", marginBottom: 2 }}>
                              {r.model || r.jenis_kain || "PECAH POLA"}
                            </div>
                            <div style={{ fontSize: 11.5, color: "#64748B" }}>
                              Tgl Retur: {formatTgl(r.tanggal)}
                            </div>
                          </td>
                          
                          {/* Vendor & Jumlah */}
                          <td style={{ padding: "16px 20px" }}>
                            <div style={{ fontWeight: 800, fontSize: 13, color: "#0F172A", display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                              <Store size={14} color="#3B82F6" /> {r.vendor_nama || "PRADANA LAUNDRY"}
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 900, color: "#D97706" }}>
                              {r.jumlah || 0} pcs
                            </div>
                            {Array.isArray(r.rincian_reject) && r.rincian_reject.length > 0 && (
                              <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                                Size: {r.rincian_reject.map((x: any) => `${x.size} (${x.jumlah} pcs)`).join(", ")}
                              </div>
                            )}
                          </td>

                          {/* Alasan Retur */}
                          <td style={{ padding: "16px 20px", fontSize: 12.5, color: "#334155", maxWidth: 220 }}>
                            <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", padding: "8px 12px", borderRadius: 8, fontStyle: "italic", lineHeight: 1.4 }}>
                              "{r.alasan || "Barang Kotor dan cacat"}"
                            </div>
                          </td>
                          
                          {/* Counter Cuci Ulang */}
                          <td style={{ padding: "16px 20px", textAlign: "center" }}>
                            <div style={{ fontWeight: 900, fontSize: 20, color: isMaxReached ? "#EF4444" : "#F59E0B" }}>
                              {r.ke_berapa_kali || 1} <span style={{ fontSize: 12, color: "#94A3B8" }}>/ 2</span>
                            </div>
                            {isMaxReached && !isRejectPerm && (
                              <div style={{ color: "#EF4444", fontWeight: 800, fontSize: 10, marginTop: 4, textTransform: "uppercase" }}>
                                ⚠️ Kesempatan Terakhir
                              </div>
                            )}
                            {isRejectPerm && (
                              <div style={{ color: "#991B1B", fontWeight: 800, fontSize: 10, marginTop: 4, textTransform: "uppercase" }}>
                                ⛔ Limit Tercapai
                              </div>
                            )}
                          </td>
                          
                          {/* Status */}
                          <td style={{ padding: "16px 20px", textAlign: "center" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: statusBg, color: statusColor, padding: "5px 12px", borderRadius: 8, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>
                              {statusIcon} {statusText}
                            </span>
                            {r.nominal_dibayar > 0 && (
                              <div style={{ fontSize: 11, fontWeight: 700, color: "#059669", marginTop: 4 }}>
                                Rp {Number(r.nominal_dibayar).toLocaleString("id-ID")}
                              </div>
                            )}
                          </td>
                          
                          {/* Tindakan */}
                          <td style={{ padding: "16px 20px", textAlign: "right" }}>
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, flexWrap: "wrap" }}>
                              
                              <button
                                type="button"
                                onClick={() => setSelectedDetail(r)}
                                style={{
                                  padding: "7px 11px",
                                  borderRadius: 8,
                                  background: "#F8FAFC",
                                  color: "#334155",
                                  border: "1px solid #CBD5E1",
                                  fontSize: 12,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 5
                                }}
                                title="Lihat detail lengkap nota cacat"
                              >
                                <Eye size={13} /> Rincian
                              </button>

                              {r.status === "menunggu-spk-retur" && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openSpkModal(r)}
                                    style={{
                                      padding: "7px 12px",
                                      borderRadius: 8,
                                      background: "#3B82F6",
                                      color: "white",
                                      border: "none",
                                      fontSize: 12,
                                      fontWeight: 800,
                                      cursor: "pointer",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 5,
                                      boxShadow: "0 2px 8px rgba(59,130,246,0.3)"
                                    }}
                                  >
                                    <Undo2 size={13} /> Buat SPK Retur
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleUbahStatus(r.id, "selesai")}
                                    style={{
                                      padding: "7px 10px",
                                      borderRadius: 8,
                                      background: "#10B981",
                                      color: "white",
                                      border: "none",
                                      fontSize: 12,
                                      fontWeight: 700,
                                      cursor: "pointer",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 4
                                    }}
                                    title="Tandai masalah retur ini sudah selesai / terselesaikan"
                                  >
                                    <Check size={13} /> Selesai
                                  </button>
                                </>
                              )}

                              {isDiproses && (
                                <button
                                  type="button"
                                  onClick={() => handleUbahStatus(r.id, "selesai")}
                                  style={{
                                    padding: "7px 12px",
                                    borderRadius: 8,
                                    background: "#10B981",
                                    color: "white",
                                    border: "none",
                                    fontSize: 12,
                                    fontWeight: 800,
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 5
                                  }}
                                >
                                  <CheckCircle size={13} /> Selesai Cuci
                                </button>
                              )}

                              {isMaxReached && !isRejectPerm && !isSelesai && (
                                <button
                                  type="button"
                                  onClick={() => handleUbahStatus(r.id, "reject-permanen")}
                                  style={{
                                    padding: "7px 10px",
                                    borderRadius: 8,
                                    background: "#FEF2F2",
                                    color: "#DC2626",
                                    border: "1px solid #FECACA",
                                    fontSize: 12,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4
                                  }}
                                  title="Tandai sebagai Reject Permanen (tidak bisa cuci ulang lagi)"
                                >
                                  <Ban size={13} /> Reject Permanen
                                </button>
                              )}

                            </div>
                          </td>

                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Modal 1: Form Buat SPK Retur (Kirim Cuci Ulang ke Vendor) */}
        {spkModalOpen && selectedReturForSpk && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.65)",
              backdropFilter: "blur(4px)",
              zIndex: 9999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20
            }}
            onClick={() => setSpkModalOpen(false)}
          >
            <div
              style={{
                background: "white",
                borderRadius: 20,
                width: "100%",
                maxWidth: 540,
                boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden"
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ padding: "18px 24px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 900, color: "#0F172A", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                    <Undo2 size={18} color="#3B82F6" /> Terbitkan SPK Cuci Ulang (Retur Washing)
                  </h3>
                  <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
                    Kirim kembali barang cacat ke vendor washing untuk cuci perbaikan.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSpkModalOpen(false)}
                  style={{ background: "#F1F5F9", border: "none", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#64748B" }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
                
                {/* Ringkasan Barang Retur */}
                <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 12, padding: "12px 16px", fontSize: 12.5 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ color: "#92400E", fontWeight: 700 }}>Nomor PO:</span>
                    <span style={{ fontWeight: 900, color: "#0F172A", fontFamily: "monospace" }}>{selectedReturForSpk.noPo}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ color: "#92400E", fontWeight: 700 }}>Model Celana:</span>
                    <span style={{ fontWeight: 800, color: "#0F172A" }}>{selectedReturForSpk.model}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ color: "#92400E", fontWeight: 700 }}>Alasan Cacat:</span>
                    <span style={{ fontWeight: 700, color: "#B45309" }}>{selectedReturForSpk.alasan}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#92400E", fontWeight: 700 }}>Cuci Ulang Ke:</span>
                    <span style={{ fontWeight: 900, color: "#DC2626" }}>{(Number(selectedReturForSpk.ke_berapa_kali) || 1) + 1} dari batas 2 kali</span>
                  </div>
                </div>

                {/* Form Pilihan Vendor */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 800, color: "#0F172A", marginBottom: 6, display: "block" }}>
                    Pilih Vendor Mitra Penanggung Jawab (CMT / Washing):
                  </label>
                  <select
                    value={targetVendorId}
                    onChange={(e) => setTargetVendorId(e.target.value)}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #CBD5E1", fontSize: 13, fontWeight: 700, color: "#0F172A", background: "white" }}
                  >
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.nama} {v.tipe ? `(${String(v.tipe).toUpperCase()})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Form Jumlah Pcs */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 800, color: "#0F172A", marginBottom: 6, display: "block" }}>
                      Jumlah Cuci Ulang (pcs):
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={jumlahCuci}
                      onChange={(e) => setJumlahCuci(Number(e.target.value))}
                      style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #CBD5E1", fontSize: 13, fontWeight: 800, color: "#0F172A" }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 800, color: "#0F172A", marginBottom: 6, display: "block" }}>
                      Target Selesai:
                    </label>
                    <input
                      type="date"
                      value={targetSelesai}
                      onChange={(e) => setTargetSelesai(e.target.value)}
                      style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #CBD5E1", fontSize: 13, fontWeight: 700, color: "#0F172A" }}
                    />
                  </div>
                </div>

                {/* Form Catatan Khusus Rework */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 800, color: "#0F172A", marginBottom: 6, display: "block" }}>
                    Instruksi Khusus untuk Vendor (CMT / Washing):
                  </label>
                  <textarea
                    rows={3}
                    value={catatanCuci}
                    onChange={(e) => setCatatanCuci(e.target.value)}
                    placeholder="Contoh: Jahit ulang sambungan saku, cuci ulang noda kotor..."
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #CBD5E1", fontSize: 12.5, color: "#0F172A", resize: "none" }}
                  />
                </div>

              </div>

              <div style={{ padding: "14px 24px", background: "#F8FAFC", borderTop: "1px solid #E2E8F0", display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setSpkModalOpen(false)}
                  disabled={submittingSpk}
                  style={{ padding: "9px 18px", background: "white", color: "#64748B", border: "1px solid #CBD5E1", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={handleKirimSpkRetur}
                  disabled={submittingSpk}
                  style={{
                    padding: "9px 20px",
                    background: "#3B82F6",
                    color: "white",
                    border: "none",
                    borderRadius: 10,
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: submittingSpk ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    boxShadow: "0 2px 8px rgba(59,130,246,0.3)"
                  }}
                >
                  <Sparkles size={15} /> {submittingSpk ? "Menerbitkan..." : "Terbitkan SPK Rework / Perbaikan"}
                </button>
              </div>

            </div>
          </div>
        )}

        {/* Modal 2: Detail Rincian Nota Cacat & Status Klaim */}
        {selectedDetail && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.65)",
              backdropFilter: "blur(4px)",
              zIndex: 9999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20
            }}
            onClick={() => setSelectedDetail(null)}
          >
            <div
              style={{
                background: "white",
                borderRadius: 20,
                width: "100%",
                maxWidth: 580,
                boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden"
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ padding: "18px 24px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 900, color: "#0F172A", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                    <FileText size={18} color="#D97706" /> Rincian Cacat & Status Retur Produksi
                  </h3>
                  <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
                    Nota: #{selectedDetail.no_nota || selectedDetail.id} &bull; PO {selectedDetail.noPo}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDetail(null)}
                  style={{ background: "#F1F5F9", border: "none", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#64748B" }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
                
                {/* Status Box */}
                <div style={{
                  background: selectedDetail.status === "selesai" ? "#ECFDF5" : selectedDetail.status === "reject-permanen" ? "#FEF2F2" : "#FFFBEB",
                  border: selectedDetail.status === "selesai" ? "1px solid #A7F3D0" : selectedDetail.status === "reject-permanen" ? "1px solid #FECACA" : "1px solid #FDE68A",
                  borderRadius: 14,
                  padding: 16
                }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: selectedDetail.status === "selesai" ? "#047857" : selectedDetail.status === "reject-permanen" ? "#991B1B" : "#92400E", textTransform: "uppercase", marginBottom: 4 }}>
                    Status Saat Ini:
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: selectedDetail.status === "selesai" ? "#065F46" : selectedDetail.status === "reject-permanen" ? "#7F1D1D" : "#78350F" }}>
                    {selectedDetail.status === "selesai" ? (
                      selectedDetail.status_klaim === "Lunas" ? "Selesai (Ganti Rugi Lunas)" : "Selesai Cuci Ulang"
                    ) : selectedDetail.status === "diproses-ulang" ? (
                      "Sedang Dikerjakan Ulang di Washing"
                    ) : selectedDetail.status === "reject-permanen" ? (
                      "Reject Permanen (Batas 2x Cuci Tercapai)"
                    ) : (
                      "Menunggu SPK Cuci Ulang"
                    )}
                  </div>
                  {selectedDetail.catatan_penyelesaian && (
                    <div style={{ fontSize: 12, color: "#065F46", marginTop: 4 }}>
                      Catatan: {selectedDetail.catatan_penyelesaian}
                    </div>
                  )}
                </div>

                {/* Detail Tabel Data */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 12.5 }}>
                  <div style={{ background: "#F8FAFC", padding: 12, borderRadius: 10, border: "1px solid #E2E8F0" }}>
                    <div style={{ color: "#64748B", fontSize: 11 }}>Nomor PO Produksi:</div>
                    <div style={{ fontWeight: 900, color: "#0F172A", fontSize: 14, fontFamily: "monospace" }}>{selectedDetail.noPo}</div>
                  </div>

                  <div style={{ background: "#F8FAFC", padding: 12, borderRadius: 10, border: "1px solid #E2E8F0" }}>
                    <div style={{ color: "#64748B", fontSize: 11 }}>Model Celana:</div>
                    <div style={{ fontWeight: 800, color: "#0F172A", fontSize: 13.5 }}>{selectedDetail.model}</div>
                  </div>

                  <div style={{ background: "#F8FAFC", padding: 12, borderRadius: 10, border: "1px solid #E2E8F0" }}>
                    <div style={{ color: "#64748B", fontSize: 11 }}>Vendor Penanggung Jawab:</div>
                    <div style={{ fontWeight: 800, color: "#2563EB", fontSize: 13 }}>{selectedDetail.vendor_nama}</div>
                  </div>

                  <div style={{ background: "#F8FAFC", padding: 12, borderRadius: 10, border: "1px solid #E2E8F0" }}>
                    <div style={{ color: "#64748B", fontSize: 11 }}>Jumlah Barang Cacat:</div>
                    <div style={{ fontWeight: 900, color: "#DC2626", fontSize: 14 }}>{selectedDetail.jumlah} pcs</div>
                  </div>
                </div>

                {/* Alasan Cacat */}
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 800, color: "#64748B", textTransform: "uppercase", marginBottom: 4 }}>
                    Keterangan Alasan Retur / Cacat:
                  </div>
                  <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "12px 14px", fontSize: 13, color: "#991B1B", fontWeight: 700 }}>
                    "{selectedDetail.alasan}"
                  </div>
                </div>

                {/* Klaim Ganti Rugi jika ada */}
                {selectedDetail.nominal_dibayar > 0 && (
                  <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 12, padding: "12px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "#166534", textTransform: "uppercase" }}>Klaim Ganti Rugi:</div>
                        <div style={{ fontSize: 12, color: "#15803D" }}>Metode: {selectedDetail.metode_pembayaran || "Tunai"}</div>
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: "#15803D" }}>
                        Rp {Number(selectedDetail.nominal_dibayar).toLocaleString("id-ID")} (LUNAS)
                      </div>
                    </div>
                  </div>
                )}

              </div>

              <div style={{ padding: "14px 24px", background: "#F8FAFC", borderTop: "1px solid #E2E8F0", display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setSelectedDetail(null)}
                  style={{ padding: "8px 20px", background: "#64748B", color: "white", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                >
                  Tutup
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </>
  );
}
