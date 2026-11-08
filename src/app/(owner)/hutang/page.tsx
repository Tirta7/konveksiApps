"use client";
import React, { useEffect, useState, useRef } from "react";
import { CreditCard, CheckCircle2, Building2, Users, Wallet, ArrowUpRight, Plus, ExternalLink } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

function formatRp(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n || 0);
}

export default function HutangPage() {
  const [activeTab, setActiveTab] = useState<"supplier" | "upah">("supplier");
  const [dataSupplier, setDataSupplier] = useState<any[]>([]);
  const [dataUpah, setDataUpah] = useState<any[]>([]);
  const [ringkasan, setRingkasan] = useState<any>({
    sisaSupplier: 0,
    sisaUpah: 0,
    totalSisaHutang: 0,
    dibayarSupplier: 0,
    dibayarUpah: 0,
    totalSudahDibayar: 0,
  });
  const _bgRefresh = useRef(false);
  const [loading, setLoading] = useState(true);

  // Pay Supplier Modal
  const [showPay, setShowPay] = useState(false);
  const [payForm, setPayForm] = useState({ id: 0, po_uid: "", sisa: 0, bayar_amount: "" });

  // Pay Upah Modal
  const [showPayUpah, setShowPayUpah] = useState(false);
  const [payUpahForm, setPayUpahForm] = useState({
    cmtId: "",
    nama: "",
    sisaHutang: 0,
    totalGaji: "",
    metode: "Transfer Bank",
    catatan: "",
    tanggal: new Date().toISOString().split("T")[0],
  });
  const [isSubmittingUpah, setIsSubmittingUpah] = useState(false);

  const fetchData = async () => {
    if (!_bgRefresh.current) setLoading(true);
    try {
      const res = await fetch("/api/hutang?includeUpah=true&_t=" + Date.now());
      const json = await res.json();
      if (json && json.hutangSupplier) {
        setDataSupplier(json.hutangSupplier || []);
        setDataUpah(json.hutangUpah || []);
        setRingkasan(json.ringkasan || {});
      } else if (Array.isArray(json)) {
        setDataSupplier(json);
      }
    } catch {
      toast.error("Gagal mengambil data hutang");
    } finally {
      setLoading(false);
      _bgRefresh.current = false;
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Real-time sync: refresh data when another admin makes changes
  useEffect(() => {
    const handler = () => {
      _bgRefresh.current = true;
      fetchData();
    };
    window.addEventListener("konveksi-sync", handler);
    return () => window.removeEventListener("konveksi-sync", handler);
  }, []);

  const openPaySupplier = (item: any) => {
    const sisa = item.total_tagihan - item.jumlah_dibayar;
    setPayForm({ id: item.id, po_uid: item.po_uid, sisa, bayar_amount: String(sisa) });
    setShowPay(true);
  };

  const handlePaySupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Number(payForm.bayar_amount) <= 0) return toast.error("Jumlah bayar tidak valid");
    if (Number(payForm.bayar_amount) > payForm.sisa) return toast.error("Jumlah bayar melebihi sisa hutang!");

    try {
      const res = await fetch("/api/hutang", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: payForm.id, bayar_amount: payForm.bayar_amount }),
      });
      if (res.ok) {
        toast.success("Pembayaran hutang supplier berhasil dicatat!");
        setShowPay(false);
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || "Gagal mencatat pembayaran");
      }
    } catch {
      toast.error("Terjadi kesalahan sistem");
    }
  };

  const openPayUpah = (u: any) => {
    setPayUpahForm({
      cmtId: String(u.vendorId),
      nama: u.namaVendor,
      sisaHutang: u.sisaHutang,
      totalGaji: String(u.sisaHutang > 0 ? u.sisaHutang : u.totalTagihan),
      metode: "Transfer Bank",
      catatan: `Pelunasan upah vendor ${u.namaVendor}`,
      tanggal: new Date().toISOString().split("T")[0],
    });
    setShowPayUpah(true);
  };

  const handlePayUpah = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payUpahForm.cmtId || !payUpahForm.totalGaji) {
      return toast.error("Harap isi nominal pembayaran upah.");
    }

    setIsSubmittingUpah(true);
    try {
      const res = await fetch("/api/gaji-cmt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cmtId: payUpahForm.cmtId,
          totalGaji: payUpahForm.totalGaji,
          metode: payUpahForm.metode,
          catatan: payUpahForm.catatan,
          tanggal: payUpahForm.tanggal,
          status: "Lunas",
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal mencatat pembayaran upah");
      }
      toast.success(`Pembayaran upah ${payUpahForm.nama} sebesar ${formatRp(Number(payUpahForm.totalGaji))} berhasil dicairkan! Portal mitra langsung terupdate.`);
      setShowPayUpah(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmittingUpah(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#F1F5F9", overflow: "hidden" }}>
      {/* ─── PAGE HEADER ─────────────────────────────────────────── */}
      <div style={{ padding: "24px 32px", background: "white", borderBottom: "1px solid #E2E8F0", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", margin: 0 }}>Buku Hutang Usaha</h1>
            <span style={{ background: "#EFF6FF", color: "#1D4ED8", fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 20 }}>
              SUPPLIER & MITRA CMT
            </span>
          </div>
          <p style={{ fontSize: 13, color: "#64748B", marginTop: 4, margin: 0 }}>
            Pantau kewajiban hutang tempo pembelian kain dan hutang upah kerja mitra (CMT & Washing).
          </p>
        </div>

        {/* 3 KPI BADGES */}
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ background: "#FEF2F2", color: "#DC2626", padding: "10px 18px", borderRadius: 12, border: "1px solid #FCA5A5" }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>Total Hutang Berjalan</div>
            <div style={{ fontSize: 20, fontWeight: 900 }}>{formatRp(ringkasan.totalSisaHutang)}</div>
          </div>
          <div style={{ background: "#F8FAFC", color: "#475569", padding: "10px 16px", borderRadius: 12, border: "1px solid #CBD5E1" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Hutang Supplier Kain</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A" }}>{formatRp(ringkasan.sisaSupplier)}</div>
          </div>
          <div style={{ background: "#F8FAFC", color: "#475569", padding: "10px 16px", borderRadius: 12, border: "1px solid #CBD5E1" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Hutang Upah Mitra</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: ringkasan.sisaUpah > 0 ? "#DC2626" : "#059669" }}>
              {formatRp(ringkasan.sisaUpah)}
            </div>
          </div>
        </div>
      </div>

      {/* ─── TAB NAVIGATION ──────────────────────────────────────── */}
      <div style={{ background: "white", padding: "0 32px", borderBottom: "1px solid #E2E8F0", display: "flex", gap: 20 }}>
        <button
          onClick={() => setActiveTab("supplier")}
          style={{
            padding: "14px 4px",
            border: "none",
            background: "none",
            fontSize: 14,
            fontWeight: 800,
            cursor: "pointer",
            color: activeTab === "supplier" ? "#2563EB" : "#64748B",
            borderBottom: activeTab === "supplier" ? "2.5px solid #2563EB" : "2.5px solid transparent",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Building2 size={16} /> Hutang Supplier Bahan ({dataSupplier.filter((d: any) => d.status !== "Lunas").length})
        </button>

        <button
          onClick={() => setActiveTab("upah")}
          style={{
            padding: "14px 4px",
            border: "none",
            background: "none",
            fontSize: 14,
            fontWeight: 800,
            cursor: "pointer",
            color: activeTab === "upah" ? "#2563EB" : "#64748B",
            borderBottom: activeTab === "upah" ? "2.5px solid #2563EB" : "2.5px solid transparent",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Users size={16} /> Hutang Upah Mitra / CMT ({dataUpah.filter((u: any) => u.sisaHutang > 0).length})
        </button>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center" }}>
          <Link href="/laporan-spk" style={{ fontSize: 12, fontWeight: 700, color: "#2563EB", display: "inline-flex", alignItems: "center", gap: 4 }}>
            Buka Rekap Upah SPK <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>
      
      <div style={{ flex: 1, padding: "24px 32px", overflowY: "auto" }}>
        {/* MODAL BAYAR SUPPLIER */}
        {showPay && (
          <div className="card" style={{ marginBottom: 24, border: "2px solid var(--color-primary)" }}>
            <div className="card-header" style={{ display: "flex", justifyContent: "space-between", background: "#EFF6FF" }}>
              <h2 className="card-title" style={{ color: "var(--color-primary)" }}>Bayar Tagihan PO Kain: {payForm.po_uid}</h2>
            </div>
            <form onSubmit={handlePaySupplier} style={{ padding: 24 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label className="label">Sisa Hutang</label>
                  <div style={{ fontSize: 20, fontWeight: 800, padding: "8px 0", color: "#EF4444" }}>{formatRp(payForm.sisa)}</div>
                </div>
                <div>
                  <label className="label">Nominal Bayar (Rp)</label>
                  <input type="number" required className="form-control" style={{ fontSize: 18, fontWeight: 700 }} value={payForm.bayar_amount} onChange={e => setPayForm({...payForm, bayar_amount: e.target.value})} placeholder="0" />
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                <button type="button" onClick={() => setShowPay(false)} className="btn btn-secondary" style={{ flex: 1 }}>Batal</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <CreditCard size={18} /> Cicil / Lunas Pembayaran Supplier
                </button>
              </div>
            </form>
          </div>
        )}

        {/* MODAL BAYAR UPAH VENDOR */}
        {showPayUpah && (
          <div className="card" style={{ marginBottom: 24, border: "2px solid #10B981" }}>
            <div className="card-header" style={{ display: "flex", justifyContent: "space-between", background: "#ECFDF5" }}>
              <h2 className="card-title" style={{ color: "#065F46" }}>Bayar Upah Mitra: {payUpahForm.nama}</h2>
            </div>
            <form onSubmit={handlePayUpah} style={{ padding: 24 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label className="label">Sisa Hak Upah Mitra</label>
                  <div style={{ fontSize: 20, fontWeight: 800, padding: "8px 0", color: payUpahForm.sisaHutang > 0 ? "#DC2626" : "#059669" }}>
                    {formatRp(payUpahForm.sisaHutang)}
                  </div>
                </div>
                <div>
                  <label className="label">Nominal Pembayaran (Rp)</label>
                  <input type="number" required className="form-control" style={{ fontSize: 18, fontWeight: 700 }} value={payUpahForm.totalGaji} onChange={e => setPayUpahForm({...payUpahForm, totalGaji: e.target.value})} placeholder="0" />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 14 }}>
                <div>
                  <label className="label">Metode Transfer</label>
                  <select className="form-control" value={payUpahForm.metode} onChange={e => setPayUpahForm({...payUpahForm, metode: e.target.value})}>
                    <option value="Transfer Bank">Transfer Bank (BCA/Mandiri)</option>
                    <option value="Tunai / Kas">Tunai / Kas Kantor</option>
                  </select>
                </div>
                <div>
                  <label className="label">Catatan / Bukti Ref</label>
                  <input className="form-control" value={payUpahForm.catatan} onChange={e => setPayUpahForm({...payUpahForm, catatan: e.target.value})} placeholder="Catatan transfer..." />
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                <button type="button" onClick={() => setShowPayUpah(false)} className="btn btn-secondary" style={{ flex: 1 }}>Batal</button>
                <button type="submit" disabled={isSubmittingUpah} className="btn btn-primary" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#10B981" }}>
                  <CreditCard size={18} /> {isSubmittingUpah ? "Memproses..." : "Cairkan Pembayaran Upah"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ─── TAB 1: SUPPLIER BAHAN ──────────────────────────────── */}
        {activeTab === "supplier" && (
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
                ) : dataSupplier.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: 20, textAlign: "center", color: "#64748B" }}>Belum ada data hutang supplier</td></tr>
                ) : (
                  dataSupplier.map((item, idx) => {
                    const sisa = item.total_tagihan - item.jumlah_dibayar;
                    return (
                      <tr key={item.id} style={{ borderBottom: idx === dataSupplier.length - 1 ? "none" : "1px solid #E2E8F0" }}>
                        <td style={{ padding: "16px", fontSize: 14, color: "#64748B" }}>
                          <div style={{ fontWeight: 600, color: "#0F172A" }}>{item.po_uid}</div>
                          <div style={{ fontSize: 12, marginTop: 4 }}>{item.tanggal}</div>
                        </td>
                        <td style={{ padding: "16px", fontSize: 14, fontWeight: 600, color: "#0F172A" }}>{item.supplier_nama}</td>
                        <td style={{ padding: "16px", fontSize: 14, color: "#0F172A", textAlign: "right" }}>{formatRp(item.total_tagihan)}</td>
                        <td style={{ padding: "16px", fontSize: 14, color: "#10B981", textAlign: "right" }}>{formatRp(item.jumlah_dibayar)}</td>
                        <td style={{ padding: "16px", fontSize: 14, color: sisa > 0 ? "#EF4444" : "#64748B", fontWeight: 700, textAlign: "right" }}>
                          {formatRp(sisa)}
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
                            <button onClick={() => openPaySupplier(item)} style={{ background: "#2563EB", color: "white", padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer" }}>
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
        )}

        {/* ─── TAB 2: UPAH MITRA (CMT & WASHING) ───────────────────── */}
        {activeTab === "upah" && (
          <div style={{ background: "white", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 13, color: "#64748B", fontWeight: 600 }}>MITRA / VENDOR</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 13, color: "#64748B", fontWeight: 600 }}>TIPE & OUTPUT ACC</th>
                  <th style={{ padding: "12px 16px", textAlign: "right", fontSize: 13, color: "#64748B", fontWeight: 600 }}>TOTAL HAK UPAH</th>
                  <th style={{ padding: "12px 16px", textAlign: "right", fontSize: 13, color: "#64748B", fontWeight: 600 }}>SUDAH DICAIRKAN</th>
                  <th style={{ padding: "12px 16px", textAlign: "right", fontSize: 13, color: "#64748B", fontWeight: 600 }}>SISA TAGIHAN UPAH</th>
                  <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 13, color: "#64748B", fontWeight: 600 }}>STATUS</th>
                  <th style={{ padding: "12px 16px", textAlign: "right", fontSize: 13, color: "#64748B", fontWeight: 600 }}>AKSI</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ padding: 20, textAlign: "center", color: "#64748B" }}>Memuat data upah mitra...</td></tr>
                ) : dataUpah.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: 20, textAlign: "center", color: "#64748B" }}>Belum ada data kewajiban upah mitra</td></tr>
                ) : (
                  dataUpah.map((item, idx) => {
                    const isLunas = item.sisaHutang === 0 && item.totalTagihan > 0;
                    return (
                      <tr key={item.vendorId} style={{ borderBottom: idx === dataUpah.length - 1 ? "none" : "1px solid #E2E8F0" }}>
                        <td style={{ padding: "16px", fontSize: 14 }}>
                          <div style={{ fontWeight: 800, color: "#0F172A" }}>{item.namaVendor}</div>
                          <div style={{ fontSize: 11, color: "#64748B", fontFamily: "monospace" }}>{item.kodeVendor || `ID-${item.vendorId}`}</div>
                        </td>
                        <td style={{ padding: "16px", fontSize: 13 }}>
                          <span style={{ textTransform: "uppercase", background: "#F1F5F9", padding: "2px 6px", borderRadius: 4, fontWeight: 700, fontSize: 11 }}>
                            {item.tipeVendor}
                          </span>
                          <div style={{ fontSize: 12, color: "#2563EB", fontWeight: 700, marginTop: 4 }}>
                            {item.totalPcsSelesai.toLocaleString("id-ID")} pcs selesai
                          </div>
                        </td>
                        <td style={{ padding: "16px", fontSize: 14, color: "#0F172A", textAlign: "right", fontWeight: 700 }}>
                          {formatRp(item.totalTagihan)}
                        </td>
                        <td style={{ padding: "16px", fontSize: 14, color: "#10B981", textAlign: "right", fontWeight: 700 }}>
                          {formatRp(item.jumlahDibayar)}
                        </td>
                        <td style={{ padding: "16px", fontSize: 14, color: item.sisaHutang > 0 ? "#DC2626" : "#10B981", fontWeight: 900, textAlign: "right" }}>
                          {formatRp(item.sisaHutang)}
                        </td>
                        <td style={{ padding: "16px", textAlign: "center" }}>
                          <span
                            style={{
                              background: isLunas ? "#DCFCE7" : item.sisaHutang > 0 ? "#FEE2E2" : "#F1F5F9",
                              color: isLunas ? "#166534" : item.sisaHutang > 0 ? "#991B1B" : "#64748B",
                              padding: "4px 8px",
                              borderRadius: 20,
                              fontSize: 11,
                              fontWeight: 800,
                              display: "inline-block",
                            }}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td style={{ padding: "16px", textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                            {item.sisaHutang > 0 ? (
                              <button
                                onClick={() => openPayUpah(item)}
                                style={{ background: "#10B981", color: "white", padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer" }}
                              >
                                Bayar Upah
                              </button>
                            ) : (
                              <CheckCircle2 color="#059669" size={20} />
                            )}
                            <Link
                              href={`/laporan-spk?search=${encodeURIComponent(item.namaVendor)}`}
                              style={{ color: "#2563EB", fontSize: 12, fontWeight: 700, textDecoration: "underline" }}
                            >
                              Rincian
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
