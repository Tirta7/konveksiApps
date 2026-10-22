"use client";
/**
 * Panel penjualan berbasis scan barcode per pcs (barcode produksi, contoh SJ-02-XL-001).
 * Dipakai bersama oleh Retail Offline, Penjualan Grosir, dan Penjualan Online.
 * Setiap pcs yang disimpan → status "terjual" + stok Data Barang berkurang otomatis.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ScanLine, Trash2, ShoppingCart, CheckCircle2, AlertTriangle, History, Info, Undo2, Package, MapPin, Truck, User, Search } from "lucide-react";
import { toast } from "sonner";

type Item = { kode: string; size: string; barang_id: number; nama_barang: string; sku: string; harga_jual: number; noPo: string; harga: number };
type Sale = { id: number; no_transaksi: string; tanggal: string; kanal: string; pelanggan: string; catatan: string; jumlah: number; total: number; items: any[] };

const rp = (n: number) => `Rp ${Number(n || 0).toLocaleString("id-ID")}`;
const fmtWaktu = (s: string) => new Date(s).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export default function ScanJualPanel({ kanal, accent = "#2563EB", pelangganLabel = "Nama Pelanggan", onSaved, orderMode = false, initialOrderId }: { kanal: string; accent?: string; pelangganLabel?: string; onSaved?: () => void; orderMode?: boolean; initialOrderId?: string }) {
  const [code, setCode] = useState("");
  const [cart, setCart] = useState<Item[]>([]);
  const [lastMsg, setLastMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pelanggan, setPelanggan] = useState("");
  const [catatan, setCatatan] = useState("");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<Sale[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  // Mode pesanan marketplace (Order ID dari CSV)
  const [orders, setOrders] = useState<any[]>([]);
  const [orderQ, setOrderQ] = useState(initialOrderId || "");
  const [order, setOrder] = useState<any | null>(null);
  const [showOrderList, setShowOrderList] = useState(false);

  const loadOrders = async () => {
    if (!orderMode) return;
    try {
      const d = await fetch(`/api/penjualan-online?grouped=1&_t=${Date.now()}`).then((r) => r.json());
      setOrders(Array.isArray(d) ? d : []);
    } catch { /* abaikan */ }
  };
  const pickOrder = async (oid: string) => {
    setShowOrderList(false);
    if (!oid.trim()) { setOrder(null); return; }
    const res = await fetch(`/api/penjualan-online?order_id=${encodeURIComponent(oid.trim())}&_t=${Date.now()}`);
    const j = await res.json();
    if (!res.ok) { setOrder(null); toast.error(j.error); return; }
    setOrder(j);
    setOrderQ(j.order_id);
    setPelanggan(`${j.recipient || ""}${j.buyer_username ? ` (@${j.buyer_username})` : ""}`.trim());
    if (j.status_kemas === "Sudah Discan") toast.warning(`Order ${j.order_id} sudah discan lengkap (${j.scanned_qty}/${j.total_qty} pcs)`);
    setTimeout(() => inputRef.current?.focus(), 50);
  };
  useEffect(() => { loadOrders(); if (initialOrderId) pickOrder(initialOrderId); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [orderMode, initialOrderId]);
  const orderMatches = useMemo(() => {
    const q = orderQ.trim().toLowerCase();
    return orders
      .filter((o) => !q || [o.order_id, o.recipient, o.buyer_username, o.tracking_id, ...o.items.map((i: any) => i.product_name)].some((v) => String(v || "").toLowerCase().includes(q)))
      .sort((a, b) => (a.status_kemas === "Sudah Discan" ? 1 : 0) - (b.status_kemas === "Sudah Discan" ? 1 : 0))
      .slice(0, 30);
  }, [orders, orderQ]);

  const loadHistory = async () => {
    try {
      const d = await fetch(`/api/penjualan-barcode?kanal=${encodeURIComponent(kanal)}&_t=${Date.now()}`).then((r) => r.json());
      setHistory(Array.isArray(d) ? d : []);
    } catch { /* abaikan */ }
  };
  useEffect(() => { loadHistory(); inputRef.current?.focus(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [kanal]);

  const scan = async (raw: string) => {
    const kode = raw.trim().toUpperCase();
    setCode("");
    if (!kode) return;
    if (cart.some((c) => c.kode === kode)) {
      setLastMsg({ ok: false, text: `${kode} sudah ada di keranjang` });
      toast.warning(`${kode} sudah di-scan`);
      return;
    }
    try {
      const r = await fetch(`/api/penjualan-barcode?code=${encodeURIComponent(kode)}`).then((x) => x.json());
      if (!r.ok) {
        setLastMsg({ ok: false, text: `${kode}: ${r.error}` });
        toast.error(r.error);
        return;
      }
      setCart((c) => [{ ...r, harga: r.harga_jual }, ...c]);
      setLastMsg({ ok: true, text: `${r.nama_barang} · Size ${r.size} (${kode}) ditambahkan` });
    } catch {
      toast.error("Gagal cek barcode");
    } finally {
      inputRef.current?.focus();
    }
  };

  const grouped = useMemo(() => {
    const g: Record<string, { nama: string; sizes: Record<string, number>; total: number; subtotal: number }> = {};
    for (const c of cart) {
      const x = (g[c.barang_id] ||= { nama: c.nama_barang, sizes: {}, total: 0, subtotal: 0 });
      x.sizes[c.size] = (x.sizes[c.size] || 0) + 1;
      x.total++;
      x.subtotal += Number(c.harga || 0);
    }
    return Object.values(g);
  }, [cart]);
  const total = cart.reduce((s, c) => s + Number(c.harga || 0), 0);

  const save = async () => {
    if (!cart.length) return toast.error("Belum ada barang yang di-scan");
    if (orderMode && !order) return toast.error("Pilih Order ID pesanan terlebih dahulu agar barang keluar jelas tujuannya");
    if (orderMode && order && order.scanned_qty + cart.length > order.total_qty && !confirm(`Jumlah pcs (${order.scanned_qty + cart.length}) melebihi jumlah pesanan (${order.total_qty}). Tetap simpan?`)) return;
    setSaving(true);
    try {
      const harga: Record<string, number> = {};
      cart.forEach((c) => (harga[c.kode] = Number(c.harga || 0)));
      const res = await fetch("/api/penjualan-barcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codes: cart.map((c) => c.kode), kanal, pelanggan, catatan, harga, order_id: orderMode ? order?.order_id : undefined }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Gagal menyimpan");
      toast.success(`${j.sale.no_transaksi} tersimpan${j.sale.order_id ? ` · Order ${j.sale.order_id}` : ""} · ${j.sale.jumlah} pcs · stok Data Barang berkurang`);
      setCart([]); setPelanggan(""); setCatatan(""); setLastMsg(null);
      if (orderMode) { setOrder(null); setOrderQ(""); loadOrders(); }
      loadHistory();
      onSaved?.();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
      inputRef.current?.focus();
    }
  };

  const cancelSale = async (s: Sale) => {
    if (!confirm(`Batalkan ${s.no_transaksi}? ${s.jumlah} pcs akan kembali ke stok (status Tersedia).`)) return;
    const res = await fetch(`/api/penjualan-barcode?id=${s.id}`, { method: "DELETE" });
    const j = await res.json();
    if (!res.ok) return toast.error(j.error || "Gagal membatalkan");
    toast.success(`${s.no_transaksi} dibatalkan, stok dikembalikan`);
    loadHistory();
    loadOrders();
    onSaved?.();
  };

  const card: React.CSSProperties = { background: "white", borderRadius: 14, border: "1px solid #E2E8F0", padding: 18 };
  const inp: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13, outline: "none" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 12, padding: "12px 14px", fontSize: 12, color: "#1E3A8A", lineHeight: 1.6 }}>
        <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <b>Cara kerja scan:</b> arahkan scanner ke barcode hangtag per pcs (contoh <code>SJ-02-XL-001</code>). Hanya pcs yang <b>sudah masuk Gudang &amp; Stok</b> yang bisa dijual.
          Setelah <b>Simpan Penjualan</b>, pcs berstatus <b>Terjual ({kanal})</b> dan stok di <b>Data Barang</b> otomatis berkurang. Batalkan transaksi untuk mengembalikan stok.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.6fr) minmax(0,1fr)", gap: 16 }}>
        {/* Kiri: scan + keranjang */}
        <div style={{ ...card, display: "flex", flexDirection: "column", gap: 14 }}>
          {orderMode && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 800, color: "#475569" }}>1. Pilih Order ID Pesanan <span style={{ color: "#EF4444" }}>*</span> <span style={{ fontWeight: 500, color: "#94A3B8" }}>(dari Upload Pesanan CSV)</span></label>
              <div style={{ position: "relative" }}>
                <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }} />
                <input
                  id="order-id-input"
                  value={orderQ}
                  onChange={(e) => { setOrderQ(e.target.value); setShowOrderList(true); if (order) setOrder(null); }}
                  onFocus={() => setShowOrderList(true)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); pickOrder(orderMatches[0]?.order_id || orderQ); } }}
                  placeholder="Ketik / scan Order ID, nama penerima, atau no. resi…"
                  autoComplete="off"
                  style={{ ...inp, paddingLeft: 36, fontFamily: "monospace", fontSize: 14 }}
                />
                {showOrderList && !order && orderMatches.length > 0 && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: "white", border: "1px solid #E2E8F0", borderRadius: 10, boxShadow: "0 12px 24px rgba(0,0,0,0.12)", maxHeight: 260, overflowY: "auto", zIndex: 30 }}>
                    {orderMatches.map((o) => (
                      <button key={o.order_id} type="button" onMouseDown={(e) => { e.preventDefault(); pickOrder(o.order_id); }}
                        style={{ display: "flex", width: "100%", justifyContent: "space-between", gap: 10, padding: "9px 12px", border: "none", borderBottom: "1px solid #F1F5F9", background: "white", cursor: "pointer", textAlign: "left" }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 12, color: "#0F172A" }}>{o.order_id} <span style={{ fontFamily: "inherit", fontWeight: 600, color: "#64748B" }}>· {o.recipient || o.buyer_username}</span></div>
                          <div style={{ fontSize: 11, color: "#94A3B8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.items.map((i: any) => `${i.variation || i.product_name} ×${i.quantity}`).join(", ")}</div>
                        </div>
                        <span style={{ flexShrink: 0, alignSelf: "center", fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 99, background: o.status_kemas === "Sudah Discan" ? "#DCFCE7" : o.status_kemas === "Sebagian Discan" ? "#FEF3C7" : "#F1F5F9", color: o.status_kemas === "Sudah Discan" ? "#047857" : o.status_kemas === "Sebagian Discan" ? "#B45309" : "#475569" }}>{o.scanned_qty}/{o.total_qty} pcs</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {orders.length === 0 && <div style={{ fontSize: 11, color: "#B45309" }}>Belum ada data pesanan. Upload CSV pesanan dari dashboard marketplace terlebih dahulu.</div>}
              {order && (
                <div style={{ border: `1px solid ${accent}40`, background: `${accent}08`, borderRadius: 12, padding: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 12 }}>
                  <div style={{ gridColumn: "span 2", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div><span style={{ fontSize: 10, fontWeight: 800, color: accent, textTransform: "uppercase" }}>{order.marketplace}</span> <b style={{ fontFamily: "monospace", fontSize: 14 }}>{order.order_id}</b></div>
                    <span style={{ fontSize: 11, fontWeight: 800 }}>Discan: <span style={{ color: order.scanned_qty + cart.length >= order.total_qty ? "#047857" : "#B45309" }}>{order.scanned_qty + cart.length}/{order.total_qty} pcs</span></span>
                  </div>
                  <div><div style={{ color: "#64748B", display: "flex", gap: 4, alignItems: "center" }}><User size={12} /> Penerima</div><b>{order.recipient || "-"}</b><div style={{ color: "#64748B" }}>@{order.buyer_username || "-"} · {order.phone || "-"}</div></div>
                  <div><div style={{ color: "#64748B", display: "flex", gap: 4, alignItems: "center" }}><Truck size={12} /> Kurir & Resi</div><b>{order.shipping_provider || "-"}</b><div style={{ fontFamily: "monospace" }}>{order.tracking_id || "Resi belum ada"}</div></div>
                  <div style={{ gridColumn: "span 2" }}><div style={{ color: "#64748B", display: "flex", gap: 4, alignItems: "center" }}><MapPin size={12} /> Alamat</div>{[order.address, order.city, order.province].filter(Boolean).join(", ") || "-"}</div>
                  <div style={{ gridColumn: "span 2", borderTop: "1px dashed #CBD5E1", paddingTop: 8 }}>
                    <div style={{ color: "#64748B", display: "flex", gap: 4, alignItems: "center", marginBottom: 4 }}><Package size={12} /> Produk dipesan</div>
                    {order.items.map((i: any, idx: number) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.variation || "-"} <span style={{ color: "#94A3B8" }}>· {i.seller_sku || i.product_name}</span></span><b>×{i.quantity}</b></div>
                    ))}
                    {order.barcodes?.length > 0 && <div style={{ marginTop: 6, color: "#047857" }}>Sudah dikirim: {order.barcodes.map((b: any) => b.kode).join(", ")}</div>}
                  </div>
                </div>
              )}
              <label style={{ fontSize: 12, fontWeight: 800, color: "#475569" }}>2. Scan barcode pcs yang dikemas</label>
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); scan(code); }} style={{ display: "flex", gap: 8 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <ScanLine size={18} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: accent }} />
              <input
                id={`scan-input-${kanal.replace(/\s+/g, "-").toLowerCase()}`}
                ref={inputRef}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Scan / ketik barcode per pcs lalu Enter…"
                autoComplete="off"
                style={{ ...inp, paddingLeft: 38, fontSize: 15, fontFamily: "monospace", border: `2px solid ${accent}`, height: 46 }}
              />
            </div>
            <button type="submit" style={{ padding: "0 18px", background: accent, color: "white", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>Tambah</button>
          </form>
          {lastMsg && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: lastMsg.ok ? "#ECFDF5" : "#FEF2F2", color: lastMsg.ok ? "#047857" : "#B91C1C" }}>
              {lastMsg.ok ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />} {lastMsg.text}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontWeight: 800, color: "#0F172A", display: "flex", alignItems: "center", gap: 8 }}><ShoppingCart size={17} /> Keranjang ({cart.length} pcs)</div>
            {cart.length > 0 && <button onClick={() => setCart([])} style={{ background: "none", border: "none", color: "#EF4444", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Kosongkan</button>}
          </div>

          {cart.length === 0 ? (
            <div style={{ padding: 30, textAlign: "center", color: "#94A3B8", fontSize: 13, border: "2px dashed #E2E8F0", borderRadius: 10 }}>Belum ada pcs di-scan</div>
          ) : (
            <div style={{ maxHeight: 340, overflowY: "auto", border: "1px solid #F1F5F9", borderRadius: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr style={{ background: "#F8FAFC", color: "#64748B", fontSize: 11, textAlign: "left" }}>
                  <th style={{ padding: "8px 10px" }}>BARCODE</th><th style={{ padding: "8px 10px" }}>BARANG</th><th style={{ padding: "8px 10px" }}>SIZE</th><th style={{ padding: "8px 10px", textAlign: "right" }}>HARGA</th><th />
                </tr></thead>
                <tbody>
                  {cart.map((c) => (
                    <tr key={c.kode} style={{ borderTop: "1px solid #F1F5F9" }}>
                      <td style={{ padding: "8px 10px", fontFamily: "monospace", fontSize: 12 }}>{c.kode}<div style={{ fontSize: 10, color: "#94A3B8" }}>{c.noPo}</div></td>
                      <td style={{ padding: "8px 10px", fontWeight: 600 }}>{c.nama_barang}</td>
                      <td style={{ padding: "8px 10px" }}><span style={{ background: "#EEF2FF", color: "#4338CA", padding: "2px 8px", borderRadius: 6, fontWeight: 700, fontSize: 11 }}>{c.size}</span></td>
                      <td style={{ padding: "8px 10px", textAlign: "right" }}>
                        <input type="number" min={0} value={c.harga === 0 ? "" : c.harga} placeholder="0" onFocus={(e) => e.target.select()}
                          onChange={(e) => setCart((cs) => cs.map((x) => (x.kode === c.kode ? { ...x, harga: Number(e.target.value || 0) } : x)))}
                          style={{ width: 100, padding: "4px 6px", border: "1px solid #E2E8F0", borderRadius: 6, textAlign: "right", fontSize: 12 }} />
                      </td>
                      <td style={{ padding: "8px 6px" }}><button onClick={() => setCart((cs) => cs.filter((x) => x.kode !== c.kode))} style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer" }}><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Kanan: ringkasan + simpan */}
        <div style={{ ...card, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontWeight: 800, color: "#0F172A" }}>Ringkasan Transaksi</div>
          {grouped.length === 0 ? <div style={{ fontSize: 12, color: "#94A3B8" }}>Ringkasan per barang & size muncul di sini.</div> : grouped.map((g) => (
            <div key={g.nama} style={{ background: "#F8FAFC", borderRadius: 10, padding: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700 }}><span>{g.nama}</span><span>{g.total} pcs</span></div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                {Object.entries(g.sizes).map(([s, n]) => <span key={s} style={{ fontSize: 11, background: "white", border: "1px solid #E2E8F0", padding: "2px 7px", borderRadius: 6 }}>{s}: <b>{n}</b></span>)}
              </div>
              <div style={{ textAlign: "right", fontSize: 12, color: "#475569", marginTop: 4 }}>{rp(g.subtotal)}</div>
            </div>
          ))}
          <input value={pelanggan} onChange={(e) => setPelanggan(e.target.value)} placeholder={pelangganLabel + " (opsional)"} style={inp} />
          <input value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Catatan (opsional)" style={inp} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px dashed #CBD5E1", paddingTop: 10 }}>
            <span style={{ fontSize: 13, color: "#64748B" }}>Total</span>
            <span style={{ fontSize: 22, fontWeight: 900, color: "#0F172A" }}>{rp(total)}</span>
          </div>
          <button id={`simpan-penjualan-${kanal.replace(/\s+/g, "-").toLowerCase()}`} onClick={save} disabled={saving || !cart.length}
            style={{ padding: 13, background: cart.length ? `linear-gradient(135deg, ${accent}, #7C3AED)` : "#CBD5E1", color: "white", border: "none", borderRadius: 10, fontWeight: 800, cursor: cart.length ? "pointer" : "not-allowed" }}>
            {saving ? "Menyimpan…" : `Simpan Penjualan (${cart.length} pcs)`}
          </button>
        </div>
      </div>

      {/* Riwayat */}
      <div style={card}>
        <div style={{ fontWeight: 800, color: "#0F172A", display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}><History size={17} /> Riwayat Penjualan Scan — {kanal}</div>
        {history.length === 0 ? <div style={{ fontSize: 12, color: "#94A3B8" }}>Belum ada transaksi.</div> : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ background: "#F8FAFC", color: "#64748B", fontSize: 11, textAlign: "left" }}>
              <th style={{ padding: "8px 10px" }}>NO TRANSAKSI</th><th style={{ padding: "8px 10px" }}>WAKTU</th><th style={{ padding: "8px 10px" }}>PELANGGAN</th><th style={{ padding: "8px 10px" }}>RINCIAN</th><th style={{ padding: "8px 10px", textAlign: "right" }}>TOTAL</th><th />
            </tr></thead>
            <tbody>
              {history.map((s) => {
                const per: Record<string, number> = {};
                s.items.forEach((i: any) => { const k = `${i.nama_barang} ${i.size}`; per[k] = (per[k] || 0) + 1; });
                return (
                  <tr key={s.id} style={{ borderTop: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "8px 10px", fontFamily: "monospace", fontWeight: 700 }}>{s.no_transaksi}</td>
                    <td style={{ padding: "8px 10px", color: "#64748B" }}>{fmtWaktu(s.tanggal)}</td>
                    <td style={{ padding: "8px 10px" }}>{s.pelanggan || "-"}{(s as any).order_id && <div style={{ fontSize: 10, fontFamily: "monospace", color: accent, fontWeight: 700 }}>Order {(s as any).order_id}</div>}</td>
                    <td style={{ padding: "8px 10px", fontSize: 12, color: "#475569" }}>{Object.entries(per).map(([k, n]) => `${k} ×${n}`).join(", ")}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700 }}>{rp(s.total)}<div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 500 }}>{s.jumlah} pcs</div></td>
                    <td style={{ padding: "8px 6px", textAlign: "right" }}>
                      <button onClick={() => cancelSale(s)} title="Batalkan — stok kembali" style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#FEF2F2", color: "#DC2626", border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}><Undo2 size={12} /> Batal</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
