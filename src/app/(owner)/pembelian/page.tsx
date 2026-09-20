"use client";
import React, { useEffect, useState, useRef } from "react";
import { Package, Trash2, Edit, X } from "lucide-react";
import { toast } from "sonner";

export default function PembelianPage() {
  const [data, setData] = useState<any[]>([]);
  const _bgRefresh = useRef(false);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!_bgRefresh.current) setLoading(true);
    try {
      const res = await fetch("/api/pembelian");
      const json = await res.json();
      setData(json);
    } catch (e) {
      toast.error("Gagal mengambil data pembelian");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const [statusModal, setStatusModal] = useState<{ id: number, currentStatus: string, nextStatus: string } | null>(null);
  const [viewRolls, setViewRolls] = useState<{ itemName: string, rolls: any[] } | null>(null);

  const handleUpdateStatusClick = (id: number, currentStatus: string) => {
    setStatusModal({ id, currentStatus, nextStatus: currentStatus });
  };

  const submitUpdateStatus = async () => {
    if (!statusModal) return;
    const { id, currentStatus, nextStatus } = statusModal;
    
    if (nextStatus === currentStatus) {
      setStatusModal(null);
      return;
    }

    try {
      const res = await fetch("/api/pembelian", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: nextStatus })
      });
      if (res.ok) {
        toast.success(`Status PO berhasil dirubah menjadi ${nextStatus}`);
        setStatusModal(null);
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || "Gagal mengubah status");
      }
    } catch (e) {
      toast.error("Terjadi kesalahan");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Peringatan: Menghapus PO ini akan membatalkan seluruh transaksi, menarik stok kain (jika sudah Diterima), dan menghapus tagihan hutang terkait. Lanjutkan?")) return;
    
    try {
      const res = await fetch(`/api/pembelian?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("PO berhasil dihapus / dibatalkan");
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || "Gagal membatalkan PO");
      }
    } catch (e) {
      toast.error("Terjadi kesalahan sistem");
    }
  };

  // Real-time sync: refresh data when another admin makes changes
  useEffect(() => {
    window.addEventListener("konveksi-sync", fetchData);
    return () => window.removeEventListener("konveksi-sync", fetchData);
  }, [fetchData]);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#F1F5F9", overflow: "hidden" }}>
      <div style={{ padding: "24px 32px", background: "white", borderBottom: "1px solid #E2E8F0", flexShrink: 0 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", marginBottom: 4 }}>Riwayat Pembelian (PO)</h1>
        <p style={{ fontSize: 13, color: "#64748B" }}>Kelola dan pantau status barang yang Anda pesan dari Supplier.</p>
      </div>
      
      <div style={{ flex: 1, padding: "24px 32px", overflowY: "auto" }}>
        <div style={{ background: "white", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 13, color: "#64748B", fontWeight: 600 }}>TANGGAL / PO</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 13, color: "#64748B", fontWeight: 600 }}>SUPPLIER</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 13, color: "#64748B", fontWeight: 600 }}>ITEMS (KAIN)</th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontSize: 13, color: "#64748B", fontWeight: 600 }}>TOTAL NILAI (RP)</th>
                <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 13, color: "#64748B", fontWeight: 600 }}>PEMBAYARAN</th>
                <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 13, color: "#64748B", fontWeight: 600 }}>STATUS PENGIRIMAN</th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontSize: 13, color: "#64748B", fontWeight: 600 }}>AKSI</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: 20, textAlign: "center", color: "#64748B" }}>Memuat data...</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 20, textAlign: "center", color: "#64748B" }}>Belum ada riwayat pembelian. (Buat dari menu Data Kain)</td></tr>
              ) : (
                data.map((item, idx) => (
                  <tr key={item.id} style={{ borderBottom: idx === data.length - 1 ? "none" : "1px solid #E2E8F0" }}>
                    <td style={{ padding: "16px", fontSize: 14, color: "#64748B" }}>
                      <div style={{ fontWeight: 600, color: "#0F172A", fontFamily: "monospace", fontSize: 15 }}>{item.uid}</div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>{item.tanggal}</div>
                    </td>
                    <td style={{ padding: "16px", fontSize: 14, fontWeight: 600, color: "#0F172A" }}>{item.supplier_nama}</td>
                    <td style={{ padding: "16px", fontSize: 13, color: "#475569" }}>
                      <ul style={{ margin: 0, paddingLeft: 16 }}>
                        {item.items.map((i:any, n:number) => (
                          <li key={n} style={{ marginBottom: 4 }}>
                            {i.nama_kain} ({i.warna}) - {i.meter}m
                            {i.roll_details && i.roll_details.length > 0 && (
                              <button 
                                onClick={() => setViewRolls({ itemName: `${i.nama_kain} (${i.warna})`, rolls: i.roll_details })}
                                style={{ marginLeft: 8, background: "#EFF6FF", color: "#3B82F6", border: "none", padding: "2px 6px", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 700 }}
                              >
                                Lihat Roll
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td style={{ padding: "16px", fontSize: 14, fontWeight: 700, color: "#0F172A", textAlign: "right" }}>
                      Rp {(item.total || 0).toLocaleString("id-ID")}
                    </td>
                    <td style={{ padding: "16px", textAlign: "center" }}>
                      <span style={{ 
                        background: item.metode_pembayaran === "Tempo" || item.metode_pembayaran === "Hutang" ? "#FEF2F2" : "#EFF6FF", 
                        color: item.metode_pembayaran === "Tempo" || item.metode_pembayaran === "Hutang" ? "#EF4444" : "#2563EB", 
                        padding: "4px 8px", borderRadius: 6, fontSize: 12, fontWeight: 600 
                      }}>
                        {item.metode_pembayaran}
                      </span>
                    </td>
                    <td style={{ padding: "16px", textAlign: "center" }}>
                      <div 
                        onClick={() => handleUpdateStatusClick(item.id, item.status)}
                        style={{ 
                          background: item.status === "Diterima" ? "#D1FAE5" : item.status === "Dikirim" ? "#FEF3C7" : "#F1F5F9", 
                          color: item.status === "Diterima" ? "#059669" : item.status === "Dikirim" ? "#D97706" : "#475569", 
                          padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, display: "inline-block",
                          cursor: "pointer", border: "1px solid transparent"
                        }}
                        title="Klik untuk mengubah status"
                      >
                        {item.status} <Edit size={12} style={{ marginLeft: 4, verticalAlign: "middle" }} />
                      </div>
                    </td>
                    <td style={{ padding: "16px", textAlign: "right" }}>
                      <button onClick={() => handleDelete(item.id)} style={{ padding: 6, background: "#FEF2F2", color: "#EF4444", borderRadius: 6, border: "none", cursor: "pointer" }} title="Batal / Hapus Nota">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL UPDATE STATUS */}
      {statusModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "white", width: 400, borderRadius: 16, overflow: "hidden", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC" }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", margin: 0 }}>Ubah Status Pengiriman</h2>
            </div>
            <div style={{ padding: 24 }}>
              <label className="label">Pilih Status Baru</label>
              <select 
                className="form-control" 
                value={statusModal.nextStatus}
                onChange={e => setStatusModal({ ...statusModal, nextStatus: e.target.value })}
              >
                <option value="PO">PO / Pesan</option>
                <option value="Dikirim">Dalam Pengiriman</option>
                <option value="Diterima">Diterima (Masuk Gudang)</option>
              </select>
              <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "flex-end" }}>
                <button className="btn btn-secondary" onClick={() => setStatusModal(null)}>Batal</button>
                <button className="btn btn-primary" onClick={submitUpdateStatus}>Simpan Status</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL LIHAT DETAIL ROLL */}
      {viewRolls && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 20 }}>
          <div style={{ background: "white", width: "100%", maxWidth: 640, borderRadius: 20, overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,0.25)", display: "flex", flexDirection: "column", maxHeight: "90vh" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(135deg, #1E293B, #0F172A)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Package size={20} color="#38BDF8" />
                </div>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 900, color: "white", margin: 0 }}>Rincian Roll</h2>
                  <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 2 }}>{viewRolls.itemName}</div>
                </div>
              </div>
              <button onClick={() => setViewRolls(null)} style={{ background: "rgba(255,255,255,0.1)", border: "none", width: 32, height: 32, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "white", transition: "background 0.2s" }} onMouseOver={e => e.currentTarget.style.background = "rgba(255,255,255,0.2)"} onMouseOut={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}>
                <X size={16} />
              </button>
            </div>
            
            <div style={{ padding: 24, overflowY: "auto", background: "#F8FAFC" }}>
              {(!viewRolls.rolls || viewRolls.rolls.length === 0) ? (
                <div style={{ textAlign: "center", color: "#64748B", padding: "40px 20px" }}>
                  <Package size={32} color="#CBD5E1" style={{ margin: "0 auto 12px" }} />
                  <div style={{ fontSize: 15, fontWeight: 700 }}>Tidak ada rincian roll</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>Data roll tidak tersedia untuk item ini.</div>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, background: "white", padding: "12px 16px", borderRadius: 12, border: "1px solid #E2E8F0" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 13, color: "#64748B", fontWeight: 600 }}>Total Roll:</span>
                      <span style={{ fontSize: 15, fontWeight: 900, color: "#0F172A", background: "#F1F5F9", padding: "4px 10px", borderRadius: 8 }}>{viewRolls.rolls.length}</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 13, color: "#64748B", fontWeight: 600 }}>Total Meter:</span>
                      <span style={{ fontSize: 15, fontWeight: 900, color: "#059669", background: "#D1FAE5", padding: "4px 10px", borderRadius: 8 }}>
                        {viewRolls.rolls.reduce((sum, r) => sum + Number(typeof r === 'object' ? (r.meter || 0) : (r || 0)), 0)} <span style={{ fontSize: 12, color: "#047857" }}>m</span>
                      </span>
                    </div>
                  </div>
                  
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 12 }}>
                    {viewRolls.rolls.map((r: any, i: number) => {
                      const meter = typeof r === 'object' ? (r.meter || 0) : (r || 0);
                      return (
                        <div key={i} style={{ 
                          background: "white", 
                          borderRadius: 12, 
                          textAlign: "center", 
                          border: "1px solid #E2E8F0",
                          boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
                          overflow: "hidden",
                          transition: "transform 0.2s, box-shadow 0.2s"
                        }}
                        onMouseOver={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 16px rgba(0,0,0,0.06)"; }}
                        onMouseOut={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.02)"; }}
                        >
                          <div style={{ background: "#F1F5F9", padding: "6px 0", fontSize: 11, color: "#64748B", fontWeight: 800, borderBottom: "1px solid #E2E8F0", letterSpacing: 0.5 }}>
                            ROLL {i+1}
                          </div>
                          <div style={{ padding: "16px 10px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                            <div style={{ fontSize: 20, fontWeight: 900, color: "#0F172A", lineHeight: 1 }}>
                              {meter} <span style={{ fontSize: 12, fontWeight: 600, color: "#94A3B8", marginLeft: 2 }}>m</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

