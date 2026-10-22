"use client";
import { useEffect, useMemo, useState } from "react";
import { X, Printer, Barcode as BarcodeIcon, CheckCircle2, ShoppingBag, Package, Info, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { printBarangLabels } from "@/components/barang-label-print";

type Pcs = { kode: string; size: string; sku: string | null; status: "siap_jual" | "terjual"; noPo: string; masuk_at: string | null; terjual_at: string | null; terjual_kanal: string | null; no_transaksi: string | null };
type Resp = { pcs: Pcs[]; sizes: { size: string; total: number; tersedia: number; terjual: number }[]; total: number; tersedia: number; terjual: number };

const fmtTgl = (s?: string | null) => (s ? new Date(s).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "-");

export default function BarangBarcodeModal({ barang, onClose }: { barang: any; onClose: () => void }) {
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"siap_jual" | "terjual" | "semua">("siap_jual");
  const [size, setSize] = useState<string>("semua");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const d = await fetch(`/api/penjualan-barcode?barang_id=${barang.id}&_t=${Date.now()}`).then((r) => r.json());
      setData(d);
    } catch {
      toast.error("Gagal memuat barcode barang");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [barang?.id]);

  const list = useMemo(() => {
    const s = q.trim().toUpperCase();
    return (data?.pcs || []).filter((p) => (status === "semua" || p.status === status) && (size === "semua" || p.size === size) && (!s || p.kode.toUpperCase().includes(s)));
  }, [data, status, size, q]);

  const toLabel = (p: Pcs) => ({ kode: p.kode, nama_barang: barang.nama_barang, size: p.size, sku: p.sku, harga_jual: Number(barang.harga_jual || 0), noPo: p.noPo });
  const doPrint = (pcs: Pcs[]) => {
    const avail = pcs.filter((p) => p.status === "siap_jual");
    if (!avail.length) return toast.error("Tidak ada pcs tersedia untuk dicetak");
    if (!printBarangLabels(avail.map(toLabel))) toast.error("Pop-up diblokir browser. Izinkan pop-up untuk mencetak.");
  };

  const toggle = (kode: string) => setSelected((prev) => { const n = new Set(prev); n.has(kode) ? n.delete(kode) : n.add(kode); return n; });
  const visibleAvail = list.filter((p) => p.status === "siap_jual");
  const allVisibleSelected = visibleAvail.length > 0 && visibleAvail.every((p) => selected.has(p.kode));

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: 18, width: "100%", maxWidth: 980, maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 25px 50px rgba(0,0,0,0.25)" }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "#EEF2FF", color: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center" }}><BarcodeIcon size={20} /></div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#0F172A" }}>Barcode per Pcs — {barang.nama_barang}</div>
              <div style={{ fontSize: 12, color: "#64748B" }}>{barang.kode || barang.uid} · Harga jual Rp {Number(barang.harga_jual || 0).toLocaleString("id-ID")}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={load} title="Muat ulang" style={{ border: "1px solid #E2E8F0", background: "white", borderRadius: 8, width: 34, height: 34, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><RefreshCw size={14} /></button>
            <button onClick={onClose} style={{ border: "none", background: "#F1F5F9", borderRadius: "50%", width: 34, height: 34, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={16} /></button>
          </div>
        </div>

        <div style={{ padding: "14px 20px", overflowY: "auto", flex: 1 }}>
          {/* Penjelasan */}
          <div style={{ display: "flex", gap: 8, background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: 10, padding: "9px 12px", fontSize: 11.5, color: "#075985", lineHeight: 1.5, marginBottom: 12 }}>
            <Info size={15} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              Yang tampil di sini <b>hanya pcs yang sudah masuk Gudang &amp; Stok</b> (barcode dari produksi, contoh <code>SJ-02-XL-001</code>). Jika PO baru selesai sebagian, yang muncul juga hanya bagian itu.
              Saat pcs di-<b>scan</b> di Retail Offline / Penjualan Grosir / Penjualan Online, statusnya otomatis menjadi <b>Terjual</b> dan stok di Data Barang berkurang.
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>Memuat barcode...</div>
          ) : !data || data.total === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#64748B", fontSize: 13 }}>
              Belum ada pcs ber-barcode untuk barang ini.<br />Barcode muncul setelah barang dari PO dimasukkan lewat <b>Gudang &amp; Stok → Terima ke Stok</b>.
            </div>
          ) : (
            <>
              {/* Ringkasan */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 12 }}>
                {[
                  { label: "Total Masuk Stok", val: data.total, color: "#2563EB", bg: "#EFF6FF", icon: <Package size={16} />, ket: "pcs yang pernah masuk dari produksi" },
                  { label: "Tersedia (belum terjual)", val: data.tersedia, color: "#059669", bg: "#ECFDF5", icon: <CheckCircle2 size={16} />, ket: "sama dengan stok di Data Barang" },
                  { label: "Sudah Terjual", val: data.terjual, color: "#DC2626", bg: "#FEF2F2", icon: <ShoppingBag size={16} />, ket: "tercatat dari scan penjualan" },
                ].map((c) => (
                  <div key={c.label} style={{ background: c.bg, borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 800, color: c.color }}>{c.icon}{c.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "#0F172A" }}>{c.val.toLocaleString("id-ID")} <span style={{ fontSize: 12, color: "#64748B" }}>pcs</span></div>
                    <div style={{ fontSize: 10.5, color: "#64748B" }}>{c.ket}</div>
                  </div>
                ))}
              </div>

              {/* Per size */}
              <div style={{ border: "1px solid #E2E8F0", borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: "#F8FAFC", color: "#64748B", fontSize: 11, textTransform: "uppercase" }}>
                      <th style={{ padding: "8px 12px", textAlign: "left" }}>Size</th>
                      <th style={{ padding: "8px 12px", textAlign: "right" }}>Masuk</th>
                      <th style={{ padding: "8px 12px", textAlign: "right" }}>Tersedia</th>
                      <th style={{ padding: "8px 12px", textAlign: "right" }}>Terjual</th>
                      <th style={{ padding: "8px 12px", textAlign: "left", width: 160 }}>Laku</th>
                      <th style={{ padding: "8px 12px", textAlign: "right" }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sizes.map((s) => {
                      const pct = s.total ? Math.round((s.terjual / s.total) * 100) : 0;
                      return (
                        <tr key={s.size} style={{ borderTop: "1px solid #F1F5F9" }}>
                          <td style={{ padding: "8px 12px", fontWeight: 900 }}>{s.size}</td>
                          <td style={{ padding: "8px 12px", textAlign: "right" }}>{s.total}</td>
                          <td style={{ padding: "8px 12px", textAlign: "right", color: "#059669", fontWeight: 800 }}>{s.tersedia}</td>
                          <td style={{ padding: "8px 12px", textAlign: "right", color: "#DC2626", fontWeight: 800 }}>{s.terjual}</td>
                          <td style={{ padding: "8px 12px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <div style={{ flex: 1, height: 6, background: "#F1F5F9", borderRadius: 4, overflow: "hidden" }}><div style={{ width: `${pct}%`, height: "100%", background: "#F97316" }} /></div>
                              <span style={{ fontSize: 10.5, fontWeight: 800, color: "#9A3412" }}>{pct}%</span>
                            </div>
                          </td>
                          <td style={{ padding: "8px 12px", textAlign: "right" }}>
                            <button disabled={!s.tersedia} onClick={() => doPrint(data.pcs.filter((p) => p.size === s.size))} style={{ fontSize: 11, fontWeight: 800, padding: "4px 9px", borderRadius: 6, border: "1px solid #C7D2FE", background: s.tersedia ? "#EEF2FF" : "#F8FAFC", color: s.tersedia ? "#4338CA" : "#94A3B8", cursor: s.tersedia ? "pointer" : "not-allowed" }}>
                              <Printer size={11} style={{ verticalAlign: -1 }} /> Cetak {s.tersedia} label
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Filter */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
                {([["siap_jual", `Tersedia (${data.tersedia})`], ["terjual", `Terjual (${data.terjual})`], ["semua", `Semua (${data.total})`]] as const).map(([v, l]) => (
                  <button key={v} onClick={() => setStatus(v)} style={{ fontSize: 11.5, fontWeight: 800, padding: "5px 10px", borderRadius: 7, border: status === v ? "1px solid #0F172A" : "1px solid #E2E8F0", background: status === v ? "#0F172A" : "white", color: status === v ? "white" : "#475569", cursor: "pointer" }}>{l}</button>
                ))}
                <select value={size} onChange={(e) => setSize(e.target.value)} style={{ fontSize: 12, padding: "5px 8px", borderRadius: 7, border: "1px solid #E2E8F0" }}>
                  <option value="semua">Semua size</option>
                  {data.sizes.map((s) => <option key={s.size} value={s.size}>Size {s.size}</option>)}
                </select>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari kode barcode..." style={{ fontSize: 12, padding: "5px 9px", borderRadius: 7, border: "1px solid #E2E8F0", flex: 1, minWidth: 160 }} />
              </div>

              {/* Daftar pcs */}
              <div style={{ border: "1px solid #E2E8F0", borderRadius: 10, maxHeight: 300, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead style={{ position: "sticky", top: 0, background: "#F8FAFC", zIndex: 1 }}>
                    <tr style={{ color: "#64748B", fontSize: 10.5, textTransform: "uppercase" }}>
                      <th style={{ padding: "7px 10px", width: 30 }}>
                        <input type="checkbox" checked={allVisibleSelected} disabled={!visibleAvail.length} onChange={() => setSelected((prev) => { const n = new Set(prev); visibleAvail.forEach((p) => (allVisibleSelected ? n.delete(p.kode) : n.add(p.kode))); return n; })} />
                      </th>
                      <th style={{ padding: "7px 10px", textAlign: "left" }}>Kode Barcode</th>
                      <th style={{ padding: "7px 10px", textAlign: "left" }}>Size</th>
                      <th style={{ padding: "7px 10px", textAlign: "left" }}>Asal PO</th>
                      <th style={{ padding: "7px 10px", textAlign: "left" }}>Masuk Stok</th>
                      <th style={{ padding: "7px 10px", textAlign: "left" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.slice(0, 500).map((p) => (
                      <tr key={p.kode} style={{ borderTop: "1px solid #F1F5F9", background: selected.has(p.kode) ? "#EEF2FF" : undefined }}>
                        <td style={{ padding: "6px 10px", textAlign: "center" }}>
                          <input type="checkbox" disabled={p.status !== "siap_jual"} checked={selected.has(p.kode)} onChange={() => toggle(p.kode)} />
                        </td>
                        <td style={{ padding: "6px 10px", fontFamily: "monospace", fontWeight: 800 }}>{p.kode}</td>
                        <td style={{ padding: "6px 10px", fontWeight: 800 }}>{p.size}</td>
                        <td style={{ padding: "6px 10px" }}>{p.noPo}</td>
                        <td style={{ padding: "6px 10px", color: "#64748B" }}>{fmtTgl(p.masuk_at)}</td>
                        <td style={{ padding: "6px 10px" }}>
                          {p.status === "siap_jual" ? (
                            <span style={{ fontSize: 10.5, fontWeight: 800, color: "#047857", background: "#D1FAE5", padding: "2px 7px", borderRadius: 5 }}>Tersedia</span>
                          ) : (
                            <span style={{ fontSize: 10.5, fontWeight: 800, color: "#B91C1C", background: "#FEE2E2", padding: "2px 7px", borderRadius: 5 }} title={p.no_transaksi || ""}>
                              Terjual · {p.terjual_kanal || "-"} · {fmtTgl(p.terjual_at)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {list.length === 0 && <tr><td colSpan={6} style={{ padding: 20, textAlign: "center", color: "#94A3B8" }}>Tidak ada pcs sesuai filter</td></tr>}
                  </tbody>
                </table>
              </div>
              {list.length > 500 && <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>Menampilkan 500 dari {list.length} pcs — gunakan filter size / cari.</div>}
            </>
          )}
        </div>

        {/* Footer */}
        {data && data.total > 0 && (
          <div style={{ padding: "12px 20px", borderTop: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", background: "#F8FAFC" }}>
            <span style={{ fontSize: 12, color: "#475569" }}>Dipilih: <b>{selected.size}</b> pcs</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button disabled={!selected.size} onClick={() => doPrint((data.pcs || []).filter((p) => selected.has(p.kode)))} style={{ fontSize: 12.5, fontWeight: 800, padding: "8px 14px", borderRadius: 8, border: "1px solid #C7D2FE", background: "white", color: selected.size ? "#4338CA" : "#94A3B8", cursor: selected.size ? "pointer" : "not-allowed" }}>
                <Printer size={13} style={{ verticalAlign: -2 }} /> Cetak Terpilih
              </button>
              <button disabled={!visibleAvail.length} onClick={() => doPrint(visibleAvail)} style={{ fontSize: 12.5, fontWeight: 800, padding: "8px 14px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#6366F1,#4F46E5)", color: "white", cursor: "pointer", opacity: visibleAvail.length ? 1 : 0.5 }}>
                <Printer size={13} style={{ verticalAlign: -2 }} /> Cetak Semua Tersedia ({visibleAvail.length})
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
