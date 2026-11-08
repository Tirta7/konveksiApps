"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  HandCoins, CreditCard, Plus, Search, Store, AlertTriangle, CheckCircle2,
  Clock, Trash2, History, X, RefreshCw, Building2, ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";

const rp = (n: number) => `Rp ${Math.round(Number(n || 0)).toLocaleString("id-ID")}`;
const fmtTgl = (s?: string) => {
  if (!s) return "-";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
};

export default function PiutangPage() {
  const [tab, setTab] = useState<"grosir" | "escrow">("grosir");
  const [data, setData] = useState<any>({
    summary: { totalPiutang: 0, totalGrosir: 0, totalEscrow: 0, fakturBelumLunas: 0, fakturJatuhTempo: 0, pesananEscrow: 0 },
    grosir: [],
    escrowPerToko: [],
    escrowOrders: [],
    pelangganList: [],
  });
  const [loading, setLoading] = useState(true);
  const silentRef = useRef(false);

  // Filter & Search
  const [statusFilter, setStatusFilter] = useState<"semua" | "aktif" | "overdue" | "lunas">("semua");
  const [shopFilter, setShopFilter] = useState<string>("semua");
  const [search, setSearch] = useState("");

  // Modal Bayar Cicilan
  const [payItem, setPayItem] = useState<any | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMetode, setPayMetode] = useState("Transfer BCA / Bank");
  const [payCatatan, setPayCatatan] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Modal Tambah Piutang Baru
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    pelanggan_id: "",
    pelanggan_nama: "",
    pelanggan_kota: "",
    total_tagihan: "",
    jumlah_dibayar: "",
    jatuh_tempo: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
    catatan: "",
  });

  // Modal Riwayat Cicilan
  const [historyItem, setHistoryItem] = useState<any | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent && !silentRef.current) setLoading(true);
    try {
      const res = await fetch("/api/piutang", { cache: "no-store" });
      const json = await res.json();
      if (res.ok) setData(json);
    } catch {
      if (!silent) toast.error("Gagal memuat data piutang");
    } finally {
      setLoading(false);
      silentRef.current = true;
    }
  }, []);

  useEffect(() => {
    fetchData();
    const onSync = () => fetchData(true);
    window.addEventListener("konveksi-sync", onSync);
    return () => window.removeEventListener("konveksi-sync", onSync);
  }, [fetchData]);

  const filteredGrosir = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data.grosir || []).filter((item: any) => {
      if (statusFilter === "aktif" && item.sisa <= 0) return false;
      if (statusFilter === "overdue" && !item.is_overdue) return false;
      if (statusFilter === "lunas" && item.sisa > 0) return false;
      if (q) {
        return [item.no_faktur, item.pelanggan_nama, item.pelanggan_kota, item.catatan]
          .some((v) => String(v || "").toLowerCase().includes(q));
      }
      return true;
    });
  }, [data.grosir, statusFilter, search]);

  const filteredEscrow = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data.escrowOrders || []).filter((o: any) => {
      const key = o.shop_key || `mp:${o.marketplace}`;
      if (shopFilter !== "semua" && key !== shopFilter) return false;
      if (q) {
        return [o.order_id, o.buyer_username, o.shop_name, o.marketplace, o.tracking_id]
          .some((v) => String(v || "").toLowerCase().includes(q));
      }
      return true;
    });
  }, [data.escrowOrders, shopFilter, search]);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payItem) return;
    const nom = Number(payAmount);
    if (!nom || nom <= 0) return toast.error("Nominal bayar tidak valid");
    if (nom > payItem.sisa) return toast.error("Nominal melebihi sisa piutang");
    setSubmitting(true);
    try {
      const res = await fetch("/api/piutang", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: payItem.id, bayar_amount: nom, metode: payMetode, catatan: payCatatan }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal mencatat pembayaran");
      toast.success(`Pembayaran ${rp(nom)} berhasil dicatat!`);
      setPayItem(null);
      setPayAmount("");
      setPayCatatan("");
      fetchData(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!Number(addForm.total_tagihan)) return toast.error("Total tagihan wajib diisi");
    if (!addForm.pelanggan_id && !addForm.pelanggan_nama.trim()) return toast.error("Pilih atau isi nama pelanggan");
    setSubmitting(true);
    try {
      const res = await fetch("/api/piutang", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menambah piutang");
      toast.success(`Faktur piutang ${json.record.no_faktur} berhasil ditambahkan`);
      setShowAdd(false);
      setAddForm({
        pelanggan_id: "",
        pelanggan_nama: "",
        pelanggan_kota: "",
        total_tagihan: "",
        jumlah_dibayar: "",
        jatuh_tempo: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
        catatan: "",
      });
      fetchData(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (item: any) => {
    if (!confirm(`Hapus faktur piutang ${item.no_faktur} (${item.pelanggan_nama})?`)) return;
    try {
      const res = await fetch(`/api/piutang?id=${item.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Gagal menghapus");
      toast.success("Faktur piutang dihapus");
      fetchData(true);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const s = data.summary || {};

  return (
    <>
      <style>{`
        html, body { overflow: hidden; height: 100%; }
        .app-content { overflow: hidden !important; height: 100vh !important; padding-bottom: 0 !important; }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", height: "100vh", maxHeight: "100vh", background: "#F1F5F9", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "14px 28px", background: "white", borderBottom: "1px solid #E2E8F0", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, background: "linear-gradient(135deg,#0EA5E9,#2563EB)", color: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <HandCoins size={20} />
            </div>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 900, color: "#0F172A", margin: 0 }}>Buku Piutang & Escrow Multi-Toko</h1>
              <p style={{ fontSize: 12, color: "#64748B", margin: 0 }}>Pantau tagihan tempo pelanggan grosir & dana pesanan marketplace yang belum cair secara real-time</p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={() => fetchData()}
              style={{ padding: "8px 12px", background: "white", border: "1px solid #CBD5E1", borderRadius: 9, fontSize: 12, fontWeight: 700, color: "#334155", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <RefreshCw size={13} /> Segarkan
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              style={{ padding: "9px 16px", background: "#2563EB", color: "white", border: "none", borderRadius: 9, fontSize: 12.5, fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, boxShadow: "0 2px 8px rgba(37,99,235,0.25)" }}
            >
              <Plus size={15} /> Catat Piutang Grosir
            </button>
          </div>
        </div>

        {/* 4 KPI Cards */}
        <div style={{ padding: "12px 28px 0", display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12, flexShrink: 0 }}>
          <div style={{ background: "white", borderRadius: 12, padding: "12px 16px", border: "1px solid #BAE6FD", borderLeft: "4px solid #0EA5E9" }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: "#0369A1", textTransform: "uppercase" }}>Total Seluruh Piutang</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#0F172A", marginTop: 2 }}>{rp(s.totalPiutang)}</div>
            <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>Grosir + Escrow semua toko online</div>
          </div>

          <div style={{ background: "white", borderRadius: 12, padding: "12px 16px", border: "1px solid #E2E8F0", borderLeft: "4px solid #6366F1" }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: "#4338CA", textTransform: "uppercase" }}>Piutang Pelanggan Grosir</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#4338CA", marginTop: 2 }}>{rp(s.totalGrosir)}</div>
            <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>{s.fakturBelumLunas || 0} faktur aktif · {s.fakturJatuhTempo || 0} jatuh tempo</div>
          </div>

          <div style={{ background: "white", borderRadius: 12, padding: "12px 16px", border: "1px solid #FED7AA", borderLeft: "4px solid #F97316" }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: "#C2410C", textTransform: "uppercase" }}>Escrow Marketplace (Belum Cair)</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#EA580C", marginTop: 2 }}>{rp(s.totalEscrow)}</div>
            <div style={{ fontSize: 11, color: "#9A3412", marginTop: 2 }}>{s.pesananEscrow || 0} pesanan dari {(data.escrowPerToko || []).length} toko</div>
          </div>

          <div style={{ background: "white", borderRadius: 12, padding: "12px 16px", border: "1px solid #E2E8F0", borderLeft: "4px solid #10B981" }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: "#047857", textTransform: "uppercase" }}>Toko Online Terintegrasi</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#065F46", marginTop: 2 }}>{(data.escrowPerToko || []).length} Toko</div>
            <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>Rekonsiliasi terpusat 1 pintu ERP</div>
          </div>
        </div>

        {/* Tabs & Filter Bar */}
        <div style={{ padding: "10px 28px 0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", flexShrink: 0 }}>
          <div style={{ display: "flex", background: "#E2E8F0", padding: 3, borderRadius: 10, gap: 4 }}>
            <button
              type="button"
              onClick={() => setTab("grosir")}
              style={{
                padding: "7px 14px", borderRadius: 8, border: "none", fontSize: 12.5, fontWeight: 800, cursor: "pointer",
                background: tab === "grosir" ? "white" : "transparent",
                color: tab === "grosir" ? "#0F172A" : "#475569",
                display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              <Building2 size={14} /> Piutang Pelanggan Grosir ({(data.grosir || []).length})
            </button>
            <button
              type="button"
              onClick={() => setTab("escrow")}
              style={{
                padding: "7px 14px", borderRadius: 8, border: "none", fontSize: 12.5, fontWeight: 800, cursor: "pointer",
                background: tab === "escrow" ? "white" : "transparent",
                color: tab === "escrow" ? "#0F172A" : "#475569",
                display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              <Store size={14} /> Escrow Marketplace Multi-Toko ({s.pesananEscrow || 0})
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {tab === "grosir" ? (
              <div style={{ display: "flex", gap: 4 }}>
                {[
                  { k: "semua", l: "Semua" },
                  { k: "aktif", l: "Belum Lunas" },
                  { k: "overdue", l: "Lewat Jatuh Tempo" },
                  { k: "lunas", l: "Lunas" },
                ].map((f) => (
                  <button
                    key={f.k}
                    type="button"
                    onClick={() => setStatusFilter(f.k as any)}
                    style={{
                      padding: "6px 11px", borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: "pointer",
                      border: statusFilter === f.k ? "1px solid #2563EB" : "1px solid #CBD5E1",
                      background: statusFilter === f.k ? "#EFF6FF" : "white",
                      color: statusFilter === f.k ? "#1D4ED8" : "#475569",
                    }}
                  >
                    {f.l}
                  </button>
                ))}
              </div>
            ) : (
              <select
                value={shopFilter}
                onChange={(e) => setShopFilter(e.target.value)}
                style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #CBD5E1", background: "white", fontSize: 12, fontWeight: 700, color: "#0F172A" }}
              >
                <option value="semua">Semua Toko Online ({(data.escrowPerToko || []).length})</option>
                {(data.escrowPerToko || []).map((t: any) => (
                  <option key={t.shop_key} value={t.shop_key}>
                    {t.shop_name} ({t.marketplace}) — {rp(t.total_escrow)}
                  </option>
                ))}
              </select>
            )}

            <div style={{ display: "flex", alignItems: "center", background: "white", border: "1px solid #CBD5E1", borderRadius: 8, padding: "0 10px", minWidth: 220 }}>
              <Search size={14} color="#94A3B8" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tab === "grosir" ? "Cari faktur, nama toko/pelanggan..." : "Cari Order ID, resi, toko..."}
                style={{ padding: "6px 8px", border: "none", outline: "none", fontSize: 12, width: "100%" }}
              />
            </div>
          </div>
        </div>

        {/* Main Table Area (Internal Scroll Only) */}
        <div style={{ flex: 1, minHeight: 0, padding: "10px 28px 14px", display: "flex", flexDirection: "column", gap: 10, overflow: "hidden" }}>
          {tab === "escrow" && (data.escrowPerToko || []).length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, flexShrink: 0 }}>
              {(data.escrowPerToko || []).map((t: any) => (
                <div
                  key={t.shop_key}
                  onClick={() => setShopFilter(shopFilter === t.shop_key ? "semua" : t.shop_key)}
                  style={{
                    background: "white", borderRadius: 11, padding: "10px 14px", cursor: "pointer",
                    border: shopFilter === t.shop_key ? "2px solid #2563EB" : "1px solid #E2E8F0",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 4, background: /shopee/i.test(t.marketplace) ? "#FFEDD5" : "#F1F5F9", color: /shopee/i.test(t.marketplace) ? "#C2410C" : "#0F172A" }}>
                        {t.marketplace}
                      </span>
                      <b style={{ fontSize: 13, color: "#0F172A" }}>{t.shop_name}</b>
                    </div>
                    <div style={{ fontSize: 11, color: "#64748B", marginTop: 3 }}>
                      {t.pesanan} order ({t.pcs} pcs) · Dikirim {rp(t.dikirim)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 14, fontWeight: 900, color: "#EA580C" }}>{rp(t.total_escrow)}</div>
                    <div style={{ fontSize: 10, color: "#059669", fontWeight: 700 }}>Siap cair: {rp(t.selesai)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ flex: 1, minHeight: 0, background: "white", borderRadius: 14, border: "1px solid #E2E8F0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
              {tab === "grosir" ? (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ position: "sticky", top: 0, background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", zIndex: 2, color: "#64748B", fontSize: 11, textTransform: "uppercase" }}>
                      <th style={{ padding: "11px 14px", textAlign: "left" }}>No. Faktur & Tanggal</th>
                      <th style={{ padding: "11px 14px", textAlign: "left" }}>Pelanggan / Toko Grosir</th>
                      <th style={{ padding: "11px 14px", textAlign: "left" }}>Jatuh Tempo</th>
                      <th style={{ padding: "11px 14px", textAlign: "right" }}>Total Tagihan</th>
                      <th style={{ padding: "11px 14px", textAlign: "right" }}>Sudah Dibayar</th>
                      <th style={{ padding: "11px 14px", textAlign: "right" }}>Sisa Piutang</th>
                      <th style={{ padding: "11px 14px", textAlign: "center" }}>Status</th>
                      <th style={{ padding: "11px 14px", textAlign: "right" }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={8} style={{ padding: 32, textAlign: "center", color: "#64748B" }}>Memuat data piutang...</td></tr>
                    ) : filteredGrosir.length === 0 ? (
                      <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>Belum ada faktur piutang grosir pada filter ini.</td></tr>
                    ) : (
                      filteredGrosir.map((item: any) => (
                        <tr key={item.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                          <td style={{ padding: "11px 14px" }}>
                            <div style={{ fontWeight: 800, color: "#0F172A", fontFamily: "monospace" }}>{item.no_faktur}</div>
                            <div style={{ fontSize: 11, color: "#64748B" }}>{fmtTgl(item.tanggal)}</div>
                          </td>
                          <td style={{ padding: "11px 14px" }}>
                            <div style={{ fontWeight: 800, color: "#0F172A" }}>{item.pelanggan_nama}</div>
                            <div style={{ fontSize: 11, color: "#64748B" }}>{[item.pelanggan_kota, item.catatan].filter(Boolean).join(" · ") || "-"}</div>
                          </td>
                          <td style={{ padding: "11px 14px" }}>
                            <div style={{ fontWeight: 700, color: item.is_overdue ? "#DC2626" : "#334155" }}>{fmtTgl(item.jatuh_tempo)}</div>
                            {item.is_overdue && (
                              <span style={{ fontSize: 10, fontWeight: 800, color: "#DC2626", background: "#FEE2E2", padding: "1px 6px", borderRadius: 4 }}>
                                Lewat {item.lewat_hari} hari
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "11px 14px", textAlign: "right", fontWeight: 700 }}>{rp(item.total_tagihan)}</td>
                          <td style={{ padding: "11px 14px", textAlign: "right", fontWeight: 700, color: "#059669" }}>{rp(item.jumlah_dibayar)}</td>
                          <td style={{ padding: "11px 14px", textAlign: "right", fontWeight: 900, color: item.sisa > 0 ? "#DC2626" : "#64748B" }}>{rp(item.sisa)}</td>
                          <td style={{ padding: "11px 14px", textAlign: "center" }}>
                            <span style={{
                              fontSize: 10.5, fontWeight: 800, padding: "3px 9px", borderRadius: 99,
                              background: item.sisa <= 0 ? "#DCFCE7" : item.jumlah_dibayar > 0 ? "#FEF3C7" : "#FEE2E2",
                              color: item.sisa <= 0 ? "#166534" : item.jumlah_dibayar > 0 ? "#92400E" : "#B91C1C",
                            }}>
                              {item.status}
                            </span>
                          </td>
                          <td style={{ padding: "11px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                            <div style={{ display: "inline-flex", gap: 6 }}>
                              {item.sisa > 0 && (
                                <button
                                  type="button"
                                  onClick={() => { setPayItem(item); setPayAmount(String(item.sisa)); }}
                                  style={{ padding: "5px 10px", background: "#2563EB", color: "white", border: "none", borderRadius: 6, fontSize: 11.5, fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
                                >
                                  <CreditCard size={12} /> Terima Bayar
                                </button>
                              )}
                              {(item.riwayat_bayar || []).length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setHistoryItem(item)}
                                  style={{ padding: "5px 8px", background: "#F1F5F9", color: "#334155", border: "1px solid #CBD5E1", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                                  title="Riwayat Pembayaran"
                                >
                                  <History size={12} />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDelete(item)}
                                style={{ padding: "5px 8px", background: "#FEF2F2", color: "#DC2626", border: "none", borderRadius: 6, cursor: "pointer" }}
                                title="Hapus"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ position: "sticky", top: 0, background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", zIndex: 2, color: "#64748B", fontSize: 11, textTransform: "uppercase" }}>
                      <th style={{ padding: "11px 14px", textAlign: "left" }}>Order ID & Waktu</th>
                      <th style={{ padding: "11px 14px", textAlign: "left" }}>Toko Online & Platform</th>
                      <th style={{ padding: "11px 14px", textAlign: "left" }}>Pembeli & Kurir</th>
                      <th style={{ padding: "11px 14px", textAlign: "center" }}>Status Pesanan</th>
                      <th style={{ padding: "11px 14px", textAlign: "right" }}>Qty</th>
                      <th style={{ padding: "11px 14px", textAlign: "right" }}>Nominal Escrow</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEscrow.length === 0 ? (
                      <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>Tidak ada pesanan escrow pada filter ini.</td></tr>
                    ) : (
                      filteredEscrow.map((o: any) => (
                        <tr key={o.order_id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                          <td style={{ padding: "10px 14px" }}>
                            <div style={{ fontWeight: 800, fontFamily: "monospace", color: "#0F172A" }}>{o.order_id}</div>
                            <div style={{ fontSize: 11, color: "#64748B" }}>{o.tanggal_pesanan}</div>
                          </td>
                          <td style={{ padding: "10px 14px" }}>
                            <span style={{ fontSize: 10.5, fontWeight: 800, padding: "2px 7px", borderRadius: 5, background: /shopee/i.test(o.marketplace) ? "#FFEDD5" : "#E0F2FE", color: /shopee/i.test(o.marketplace) ? "#C2410C" : "#0369A1", marginRight: 6 }}>
                              {o.marketplace}
                            </span>
                            <b style={{ color: "#0F172A" }}>{o.shop_name}</b>
                          </td>
                          <td style={{ padding: "10px 14px" }}>
                            <div style={{ fontWeight: 700, color: "#334155" }}>@{o.buyer_username}</div>
                            <div style={{ fontSize: 11, color: "#64748B" }}>{o.shipping_provider} · {o.tracking_id || "Belum ada resi"}</div>
                          </td>
                          <td style={{ padding: "10px 14px", textAlign: "center" }}>
                            <span style={{
                              fontSize: 10.5, fontWeight: 800, padding: "3px 9px", borderRadius: 99,
                              background: /selesai/i.test(o.status) ? "#DCFCE7" : "#FEF3C7",
                              color: /selesai/i.test(o.status) ? "#166534" : "#92400E",
                            }}>
                              {o.status}
                            </span>
                          </td>
                          <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700 }}>{o.total_qty} pcs</td>
                          <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 900, color: "#EA580C" }}>{rp(o.total_amount)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Terima Pembayaran Cicilan */}
      {payItem && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <form onSubmit={handlePay} style={{ background: "white", width: "100%", maxWidth: 440, borderRadius: 16, padding: 22, boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ fontSize: 16, fontWeight: 900, color: "#0F172A", margin: 0 }}>Terima Pembayaran Piutang</h3>
              <button type="button" onClick={() => setPayItem(null)} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={18} /></button>
            </div>
            <div style={{ background: "#F8FAFC", padding: 12, borderRadius: 10, marginBottom: 14, fontSize: 12.5 }}>
              <div>Faktur: <b>{payItem.no_faktur}</b> · {payItem.pelanggan_nama}</div>
              <div style={{ marginTop: 4 }}>Sisa Piutang: <b style={{ color: "#DC2626", fontSize: 15 }}>{rp(payItem.sisa)}</b></div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: "#475569" }}>Nominal Diterima (Rp) *</label>
                <input type="number" required value={payAmount} onChange={(e) => setPayAmount(e.target.value)} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 15, fontWeight: 800, marginTop: 4 }} />
              </div>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: "#475569" }}>Metode Penerimaan</label>
                <select value={payMetode} onChange={(e) => setPayMetode(e.target.value)} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13, marginTop: 4 }}>
                  <option>Transfer BCA / Bank</option>
                  <option>Tunai / Kas Toko</option>
                  <option>Giro / Cek</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: "#475569" }}>Catatan</label>
                <input value={payCatatan} onChange={(e) => setPayCatatan(e.target.value)} placeholder="Opsional..." style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13, marginTop: 4 }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
              <button type="button" onClick={() => setPayItem(null)} style={{ flex: 1, padding: 10, borderRadius: 9, border: "1px solid #CBD5E1", background: "white", fontWeight: 700, cursor: "pointer" }}>Batal</button>
              <button type="submit" disabled={submitting} style={{ flex: 1, padding: 10, borderRadius: 9, border: "none", background: "#2563EB", color: "white", fontWeight: 800, cursor: "pointer" }}>
                {submitting ? "Menyimpan..." : "Simpan Pembayaran"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Tambah Piutang Baru */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <form onSubmit={handleCreate} style={{ background: "white", width: "100%", maxWidth: 480, borderRadius: 16, padding: 22, boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ fontSize: 16, fontWeight: 900, color: "#0F172A", margin: 0 }}>Catat Tagihan Piutang Grosir</h3>
              <button type="button" onClick={() => setShowAdd(false)} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={18} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: "#475569" }}>Pilih dari Data Pelanggan</label>
                <select
                  value={addForm.pelanggan_id}
                  onChange={(e) => {
                    const id = e.target.value;
                    const found = (data.pelangganList || []).find((c: any) => String(c.id) === id);
                    setAddForm((f) => ({
                      ...f,
                      pelanggan_id: id,
                      pelanggan_nama: found ? found.nama : f.pelanggan_nama,
                      pelanggan_kota: found ? found.kota || "" : f.pelanggan_kota,
                    }));
                  }}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13, marginTop: 4 }}
                >
                  <option value="">— Atau ketik nama pelanggan baru di bawah —</option>
                  {(data.pelangganList || []).map((c: any) => (
                    <option key={c.id} value={c.id}>{c.nama} ({c.kota || "-"})</option>
                  ))}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: "#475569" }}>Nama Pelanggan / Toko *</label>
                  <input required value={addForm.pelanggan_nama} onChange={(e) => setAddForm({ ...addForm, pelanggan_nama: e.target.value })} placeholder="Contoh: Toko Bintang Tanah Abang" style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13, marginTop: 4 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: "#475569" }}>Kota</label>
                  <input value={addForm.pelanggan_kota} onChange={(e) => setAddForm({ ...addForm, pelanggan_kota: e.target.value })} placeholder="Jakarta / Surabaya" style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13, marginTop: 4 }} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: "#475569" }}>Total Tagihan (Rp) *</label>
                  <input type="number" required value={addForm.total_tagihan} onChange={(e) => setAddForm({ ...addForm, total_tagihan: e.target.value })} placeholder="0" style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 14, fontWeight: 800, marginTop: 4 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: "#475569" }}>DP / Dibayar Awal (Rp)</label>
                  <input type="number" value={addForm.jumlah_dibayar} onChange={(e) => setAddForm({ ...addForm, jumlah_dibayar: e.target.value })} placeholder="0" style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 14, marginTop: 4 }} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 8 }}>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: "#475569" }}>Jatuh Tempo</label>
                  <input type="date" value={addForm.jatuh_tempo} onChange={(e) => setAddForm({ ...addForm, jatuh_tempo: e.target.value })} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13, marginTop: 4 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: "#475569" }}>Catatan Barang / Seri</label>
                  <input value={addForm.catatan} onChange={(e) => setAddForm({ ...addForm, catatan: e.target.value })} placeholder="Contoh: 10 lusin Retro Fold" style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13, marginTop: 4 }} />
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
              <button type="button" onClick={() => setShowAdd(false)} style={{ flex: 1, padding: 10, borderRadius: 9, border: "1px solid #CBD5E1", background: "white", fontWeight: 700, cursor: "pointer" }}>Batal</button>
              <button type="submit" disabled={submitting} style={{ flex: 1, padding: 10, borderRadius: 9, border: "none", background: "#2563EB", color: "white", fontWeight: 800, cursor: "pointer" }}>
                {submitting ? "Menyimpan..." : "Simpan Faktur Piutang"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Riwayat Pembayaran */}
      {historyItem && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "white", width: "100%", maxWidth: 440, borderRadius: 16, padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ fontSize: 15, fontWeight: 900, margin: 0 }}>Riwayat Cicilan · {historyItem.no_faktur}</h3>
              <button type="button" onClick={() => setHistoryItem(null)} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={18} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 280, overflowY: "auto" }}>
              {(historyItem.riwayat_bayar || []).map((r: any, i: number) => (
                <div key={i} style={{ padding: 10, borderRadius: 9, background: "#F8FAFC", border: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{r.metode || "Pembayaran"}</div>
                    <div style={{ fontSize: 11, color: "#64748B" }}>{fmtTgl(r.tanggal)}{r.catatan ? ` · ${r.catatan}` : ""}</div>
                  </div>
                  <b style={{ color: "#059669" }}>{rp(r.nominal)}</b>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
