"use client";
import React, { useEffect, useState, useRef } from "react";
import { CreditCard, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function HutangPage() {
  const [data, setData] = useState<any[]>([]);
  const _bgRefresh = useRef(false);
  const [loading, setLoading] = useState(true);
  
  const [showPay, setShowPay] = useState(false);
  const [payForm, setPayForm] = useState({ id: 0, po_uid: "", sisa: 0, bayar_amount: "" });

  const fetchData = async () => {
    if (!_bgRefresh.current) setLoading(true);
    try {
      const res = await fetch("/api/hutang");
      const json = await res.json();
      setData(json);
    } catch (e) {
      toast.error("Gagal mengambil data hutang");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openPay = (item: any) => {
    const sisa = item.total_tagihan - item.jumlah_dibayar;
    setPayForm({ id: item.id, po_uid: item.po_uid, sisa, bayar_amount: "" });
    setShowPay(true);
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Number(payForm.bayar_amount) <= 0) return toast.error("Jumlah bayar tidak valid");
    if (Number(payForm.bayar_amount) > payForm.sisa) return toast.error("Jumlah bayar melebihi sisa hutang!");

    try {
      const res = await fetch("/api/hutang", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: payForm.id, bayar_amount: payForm.bayar_amount })
      });
      if (res.ok) {
        toast.success("Pembayaran berhasil dicatat");
        setShowPay(false);
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || "Gagal mencatat pembayaran");
      }
    } catch (e) {
      toast.error("Terjadi kesalahan sistem");
    }
  };

  const totalHutangAktif = data.filter(d => d.status === "Belum Lunas").reduce((sum, item) => sum + (item.total_tagihan - item.jumlah_dibayar), 0);

  // Real-time sync: refresh data when another admin makes changes
  useEffect(() => {
    window.addEventListener("konveksi-sync", fetchData);
    return () => window.removeEventListener("konveksi-sync", fetchData);
  }, [fetchData]);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#F1F5F9", overflow: "hidden" }}>
      <div style={{ padding: "24px 32px", background: "white", borderBottom: "1px solid #E2E8F0", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", marginBottom: 4 }}>Buku Hutang Pembelian</h1>
          <p style={{ fontSize: 13, color: "#64748B" }}>Pantau tagihan pembelian kain yang belum lunas (Tempo)</p>
        </div>
        <div style={{ background: "#FEF2F2", color: "#EF4444", padding: "12px 24px", borderRadius: 12, border: "1px solid #FCA5A5" }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>Total Hutang Berjalan</div>
          <div style={{ fontSize: 24, fontWeight: 900 }}>Rp {totalHutangAktif.toLocaleString("id-ID")}</div>
        </div>
      </div>
      
      <div style={{ flex: 1, padding: "24px 32px", overflowY: "auto" }}>
        {showPay && (
          <div className="card" style={{ marginBottom: 24, border: "2px solid var(--color-primary)" }}>
            <div className="card-header" style={{ display: "flex", justifyContent: "space-between", background: "#EFF6FF" }}>
              <h2 className="card-title" style={{ color: "var(--color-primary)" }}>Bayar Tagihan PO: {payForm.po_uid}</h2>
            </div>
            <form onSubmit={handlePay} style={{ padding: 24 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label className="label">Sisa Hutang</label>
                  <div style={{ fontSize: 20, fontWeight: 800, padding: "8px 0", color: "#EF4444" }}>Rp {payForm.sisa.toLocaleString("id-ID")}</div>
                </div>
                <div>
                  <label className="label">Nominal Bayar (Rp)</label>
                  <input type="number" required className="form-control" style={{ fontSize: 18, fontWeight: 700 }} value={payForm.bayar_amount} onChange={e => setPayForm({...payForm, bayar_amount: e.target.value})} placeholder="0" />
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                <button type="button" onClick={() => setShowPay(false)} className="btn btn-secondary" style={{ flex: 1 }}>Batal</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <CreditCard size={18} /> Cicil / Lunas Pembayaran
                </button>
              </div>
            </form>
          </div>
        )}

        <div style={{ background: "white", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 13, color: "#64748B", fontWeight: 600 }}>TANGGAL / PO</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 13, color: "#64748B", fontWeight: 600 }}>SUPPLIER</th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontSize: 13, color: "#64748B", fontWeight: 600 }}>TOTAL TAGIHAN</th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontSize: 13, color: "#64748B", fontWeight: 600 }}>SUDAH DIBAYAR</th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontSize: 13, color: "#64748B", fontWeight: 600 }}>SISA HUTANG</th>
                <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 13, color: "#64748B", fontWeight: 600 }}>STATUS</th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontSize: 13, color: "#64748B", fontWeight: 600 }}>AKSI</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: 20, textAlign: "center", color: "#64748B" }}>Memuat data...</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 20, textAlign: "center", color: "#64748B" }}>Belum ada data hutang</td></tr>
              ) : (
                data.map((item, idx) => {
                  const sisa = item.total_tagihan - item.jumlah_dibayar;
                  return (
                    <tr key={item.id} style={{ borderBottom: idx === data.length - 1 ? "none" : "1px solid #E2E8F0" }}>
                      <td style={{ padding: "16px", fontSize: 14, color: "#64748B" }}>
                        <div style={{ fontWeight: 600, color: "#0F172A" }}>{item.po_uid}</div>
                        <div style={{ fontSize: 12, marginTop: 4 }}>{item.tanggal}</div>
                      </td>
                      <td style={{ padding: "16px", fontSize: 14, fontWeight: 600, color: "#0F172A" }}>{item.supplier_nama}</td>
                      <td style={{ padding: "16px", fontSize: 14, color: "#0F172A", textAlign: "right" }}>Rp {item.total_tagihan.toLocaleString("id-ID")}</td>
                      <td style={{ padding: "16px", fontSize: 14, color: "#10B981", textAlign: "right" }}>Rp {item.jumlah_dibayar.toLocaleString("id-ID")}</td>
                      <td style={{ padding: "16px", fontSize: 14, color: sisa > 0 ? "#EF4444" : "#64748B", fontWeight: 700, textAlign: "right" }}>
                        Rp {sisa.toLocaleString("id-ID")}
                      </td>
                      <td style={{ padding: "16px", textAlign: "center" }}>
                        {item.status === "Lunas" ? (
                          <div style={{ background: "#D1FAE5", color: "#059669", padding: "4px 8px", borderRadius: 20, fontSize: 12, fontWeight: 700, display: "inline-block" }}>LUNAS</div>
                        ) : (
                          <div style={{ background: "#FEE2E2", color: "#DC2626", padding: "4px 8px", borderRadius: 20, fontSize: 12, fontWeight: 700, display: "inline-block" }}>BELUM LUNAS</div>
                        )}
                      </td>
                      <td style={{ padding: "16px", textAlign: "right" }}>
                        {item.status !== "Lunas" ? (
                          <button onClick={() => openPay(item)} style={{ background: "#2563EB", color: "white", padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer" }}>
                            Bayar
                          </button>
                        ) : (
                          <CheckCircle2 color="#059669" style={{ margin: "0 auto" }} />
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

