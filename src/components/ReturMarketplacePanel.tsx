"use client";
/**
 * Retur Marketplace berbasis scan barcode per pcs.
 *  - Tab "scan"    : paket retur datang → scan barcode / cari Order ID → pilih kondisi.
 *                    SESUAI → kembali ke stok gudang. TIDAK SESUAI → ditampung untuk banding.
 *  - Tab "banding" : daftar retur tidak sesuai, update status banding & dana yang dikembalikan marketplace.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ScanLine, CheckCircle2, AlertTriangle, PackageCheck, PackageX, User, Truck, MapPin, Receipt, Info, Copy, Trash2, Undo2, Search, Scale, Wallet, Clock, XCircle, PackageOpen } from "lucide-react";
import { toast } from "sonner";

const JENIS_MASALAH = ["Rusak / Cacat", "Barang tertukar / bukan milik kita", "Bekas pakai / kotor / bau", "Tidak lengkap / kurang", "Paket kosong", "Lainnya"];
const STATUS_BANDING = ["Perlu Diajukan", "Diajukan Banding", "Banding Disetujui", "Banding Ditolak"];
const rp = (n: number) => `Rp ${Number(n || 0).toLocaleString("id-ID")}`;
const tgl = (s?: string | null) => (s ? new Date(s).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-");
const statusColor: Record<string, [string, string]> = {
  "Kembali ke Stok": ["#DBEAFE", "#1D4ED8"],
  "Dipindah ke Stok": ["#DBEAFE", "#1D4ED8"],
  "Perlu Diajukan": ["#FEE2E2", "#B91C1C"],
  "Diajukan Banding": ["#FEF3C7", "#B45309"],
  "Banding Disetujui": ["#DCFCE7", "#047857"],
  "Banding Ditolak": ["#F1F5F9", "#475569"],
};
const Badge = ({ s }: { s: string }) => <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 99, background: statusColor[s]?.[0] || "#F1F5F9", color: statusColor[s]?.[1] || "#475569", whiteSpace: "nowrap" }}>{s}</span>;

export default function ReturMarketplacePanel({ tab }: { tab: "scan" | "banding" }) {
  const [list, setList] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const load = async () => {
    const d = await fetch(`/api/retur-marketplace?_t=${Date.now()}`).then((r) => r.json()).catch(() => null);
    if (d?.list) { setList(d.list); setSummary(d.summary); }
  };
  useEffect(() => { load(); }, []);
  return tab === "scan" ? <ScanRetur list={list} reload={load} /> : <BandingList list={list} summary={summary} reload={load} />;
}

/* ───────────────────────── SCAN RETUR ───────────────────────── */
function ScanRetur({ list, reload }: { list: any[]; reload: () => void }) {
  const [mode, setMode] = useState<"barcode" | "order">("barcode");
  const [code, setCode] = useState("");
  const [info, setInfo] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [orderQ, setOrderQ] = useState("");
  const [order, setOrder] = useState<any | null>(null);
  const [kondisi, setKondisi] = useState<"sesuai" | "tidak_sesuai" | null>(null);
  const [jenis, setJenis] = useState(JENIS_MASALAH[0]);
  const [catatan, setCatatan] = useState("");
  const [klaim, setKlaim] = useState<string>("");
  const [resiRetur, setResiRetur] = useState("");
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, [mode]);

  const reset = () => { setInfo(null); setErr(null); setKondisi(null); setCatatan(""); setKlaim(""); setJenis(JENIS_MASALAH[0]); setCode(""); setTimeout(() => ref.current?.focus(), 50); };

  const scan = async (raw: string) => {
    const k = raw.trim().toUpperCase();
    if (!k) return;
    setErr(null); setInfo(null); setKondisi(null);
    const r = await fetch(`/api/retur-marketplace?code=${encodeURIComponent(k)}`).then((x) => x.json());
    setCode(k);
    if (!r.ok) { setErr(r.error); toast.error(r.error); return; }
    setInfo(r);
    setKlaim(String(r.harga || ""));
  };
  const findOrder = async (q: string) => {
    if (!q.trim()) return;
    const res = await fetch(`/api/retur-marketplace?order_id=${encodeURIComponent(q.trim())}`);
    const j = await res.json();
    if (!res.ok) { setOrder(null); toast.error(j.error); return; }
    setOrder(j);
    setResiRetur(j.retur_request?.[0]?.resi_retur && j.retur_request[0].resi_retur !== "-" ? j.retur_request[0].resi_retur : "");
  };

  const submit = async (noBarcode = false) => {
    if (!noBarcode && !info) return toast.error("Scan barcode barang retur terlebih dahulu");
    const k = noBarcode ? "tidak_sesuai" : kondisi;
    if (!k) return toast.error("Pilih kondisi barang: SESUAI atau TIDAK SESUAI");
    setSaving(true);
    try {
      const res = await fetch("/api/retur-marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "proses", kode: noBarcode ? null : info.kode, order_id: noBarcode ? order?.order_id : info?.order_id, kondisi: k, jenis_masalah: jenis, catatan, nilai_klaim: Number(klaim || 0), resi_retur: resiRetur }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      toast.success(k === "sesuai" ? `${j.retur.no_retur}: ${j.retur.kode_barcode} kembali ke stok gudang` : `${j.retur.no_retur}: dicatat untuk banding marketplace`);
      reset();
      if (mode === "order" && order) findOrder(order.order_id);
      reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const card: React.CSSProperties = { background: "white", borderRadius: 14, border: "1px solid #E2E8F0", padding: 18 };
  const inp: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13, outline: "none" };
  const recent = list.slice(0, 12);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 10, background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 12, padding: "12px 14px", fontSize: 12, color: "#1E3A8A", lineHeight: 1.6 }}>
        <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <b>Alur retur:</b> paket retur datang → <b>scan barcode</b> pada hangtag → sistem menampilkan Order ID, pembeli, resi & tanggal kirim → periksa fisik barang lalu pilih:
          <br />✅ <b>SESUAI & layak jual</b> → pcs otomatis <b>kembali ke stok</b> (stok Data Barang bertambah).
          <br />⚠️ <b>TIDAK SESUAI / rusak / tertukar</b> → <b>tidak masuk stok</b>, ditampung di tab <b>Banding Marketplace</b> untuk pengajuan pengembalian dana.
          <br />Jika barang yang datang <b>tidak punya barcode kita</b> (tertukar / paket kosong), gunakan mode <b>Cari Order ID</b>.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr)", gap: 16 }}>
        <div style={{ ...card, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", background: "#F1F5F9", borderRadius: 10, padding: 4, alignSelf: "flex-start" }}>
            {([["barcode", "Scan Barcode Retur", ScanLine], ["order", "Cari Order ID (tanpa barcode)", Search]] as const).map(([k, l, I]) => (
              <button key={k} onClick={() => { setMode(k); reset(); }} style={{ padding: "7px 12px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, background: mode === k ? "white" : "transparent", color: mode === k ? "#0F172A" : "#64748B", boxShadow: mode === k ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }}><I size={14} /> {l}</button>
            ))}
          </div>

          {mode === "barcode" ? (
            <form onSubmit={(e) => { e.preventDefault(); scan(code); }} style={{ display: "flex", gap: 8 }}>
              <div style={{ position: "relative", flex: 1 }}>
                <ScanLine size={18} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#D97706" }} />
                <input id="scan-retur-input" ref={ref} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Scan barcode pcs yang diretur lalu Enter…" autoComplete="off" style={{ ...inp, paddingLeft: 38, height: 46, fontSize: 15, fontFamily: "monospace", border: "2px solid #F59E0B" }} />
              </div>
              <button type="submit" style={{ padding: "0 18px", background: "#F59E0B", color: "white", border: "none", borderRadius: 8, fontWeight: 800, cursor: "pointer" }}>Cek</button>
            </form>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); findOrder(orderQ); }} style={{ display: "flex", gap: 8 }}>
              <input id="retur-order-input" ref={ref} value={orderQ} onChange={(e) => setOrderQ(e.target.value)} placeholder="Ketik Order ID pesanan marketplace…" style={{ ...inp, height: 46, fontFamily: "monospace", fontSize: 14 }} />
              <button type="submit" style={{ padding: "0 18px", background: "#0F172A", color: "white", border: "none", borderRadius: 8, fontWeight: 800, cursor: "pointer" }}>Cari</button>
            </form>
          )}

          {err && <div style={{ display: "flex", gap: 8, padding: "10px 12px", borderRadius: 8, background: "#FEF2F2", color: "#B91C1C", fontSize: 12, fontWeight: 600 }}><AlertTriangle size={15} style={{ flexShrink: 0 }} /> {err}</div>}

          {mode === "order" && order && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <OrderCard o={order} />
              <div style={{ fontSize: 12, fontWeight: 800, color: "#475569" }}>Barcode yang dikirim di pesanan ini (klik untuk proses retur pcs tersebut):</div>
              {order.barcodes?.length ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {order.barcodes.map((b: any) => (
                    <button key={b.kode} disabled={b.status !== "terjual"} onClick={() => { setMode("barcode"); scan(b.kode); }} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #E2E8F0", background: b.status === "terjual" ? "white" : "#F8FAFC", cursor: b.status === "terjual" ? "pointer" : "not-allowed", fontSize: 12, textAlign: "left" }}>
                      <b style={{ fontFamily: "monospace" }}>{b.kode}</b> <span style={{ color: "#64748B" }}>· {b.size}</span>
                      {b.status !== "terjual" && <div style={{ fontSize: 10, color: "#B45309" }}>{b.status === "retur_stok" ? "sudah diretur → stok" : "sudah diretur → banding"}</div>}
                    </button>
                  ))}
                </div>
              ) : <div style={{ fontSize: 12, color: "#94A3B8" }}>Belum ada barcode yang di-scan saat pengiriman pesanan ini.</div>}
              <div style={{ borderTop: "1px dashed #CBD5E1", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#B91C1C", display: "flex", alignItems: "center", gap: 6 }}><PackageX size={15} /> Barang datang TANPA barcode kita (tertukar / paket kosong)</div>
                <MasalahForm jenis={jenis} setJenis={setJenis} catatan={catatan} setCatatan={setCatatan} klaim={klaim} setKlaim={setKlaim} resi={resiRetur} setResi={setResiRetur} inp={inp} />
                <button disabled={saving} onClick={() => submit(true)} style={{ padding: 12, borderRadius: 10, border: "none", background: "linear-gradient(135deg,#EF4444,#F59E0B)", color: "white", fontWeight: 800, cursor: "pointer" }}>Catat untuk Banding (tanpa barcode)</button>
              </div>
            </div>
          )}

          {info && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#F8FAFC", borderRadius: 10, padding: 12 }}>
                <div>
                  <div style={{ fontFamily: "monospace", fontWeight: 900, fontSize: 15 }}>{info.kode}</div>
                  <div style={{ fontSize: 12, color: "#475569" }}>{info.nama_barang} · Size <b>{info.size}</b></div>
                </div>
                <div style={{ textAlign: "right", fontSize: 12, color: "#64748B" }}>
                  Terjual {tgl(info.penjualan?.tanggal)}<br /><b>{info.penjualan?.no_transaksi}</b> · {info.penjualan?.kanal} · {rp(info.harga)}
                </div>
              </div>
              {info.order ? <OrderCard o={info.order} /> : <div style={{ fontSize: 12, color: "#B45309", background: "#FFFBEB", borderRadius: 8, padding: 10 }}>Pcs ini terjual tanpa Order ID (kanal {info.penjualan?.kanal || "-"}{info.penjualan?.pelanggan ? ` · ${info.penjualan.pelanggan}` : ""}).</div>}

              <div style={{ fontSize: 12, fontWeight: 800, color: "#475569" }}>Hasil pemeriksaan fisik barang:</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <button id="retur-sesuai" onClick={() => setKondisi("sesuai")} style={{ padding: 14, borderRadius: 12, cursor: "pointer", textAlign: "left", border: `2px solid ${kondisi === "sesuai" ? "#10B981" : "#E2E8F0"}`, background: kondisi === "sesuai" ? "#ECFDF5" : "white" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 900, color: "#047857" }}><PackageCheck size={18} /> SESUAI & Layak Jual</div>
                  <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>Barang benar milik kita, kondisi baik → kembali ke stok gudang.</div>
                </button>
                <button id="retur-tidak-sesuai" onClick={() => setKondisi("tidak_sesuai")} style={{ padding: 14, borderRadius: 12, cursor: "pointer", textAlign: "left", border: `2px solid ${kondisi === "tidak_sesuai" ? "#EF4444" : "#E2E8F0"}`, background: kondisi === "tidak_sesuai" ? "#FEF2F2" : "white" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 900, color: "#B91C1C" }}><PackageX size={18} /> TIDAK SESUAI / Rusak</div>
                  <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>Rusak, kotor, tidak lengkap → tidak masuk stok, ajukan banding ke marketplace.</div>
                </button>
              </div>
              {kondisi === "tidak_sesuai" && <MasalahForm jenis={jenis} setJenis={setJenis} catatan={catatan} setCatatan={setCatatan} klaim={klaim} setKlaim={setKlaim} resi={resiRetur} setResi={setResiRetur} inp={inp} />}
              {kondisi === "sesuai" && <input value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Catatan (opsional)" style={inp} />}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={reset} style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: "#F1F5F9", color: "#475569", fontWeight: 700, cursor: "pointer" }}>Batal</button>
                <button id="retur-simpan" disabled={!kondisi || saving} onClick={() => submit(false)} style={{ flex: 2, padding: 12, borderRadius: 10, border: "none", fontWeight: 800, color: "white", cursor: kondisi ? "pointer" : "not-allowed", background: !kondisi ? "#CBD5E1" : kondisi === "sesuai" ? "linear-gradient(135deg,#10B981,#059669)" : "linear-gradient(135deg,#EF4444,#F59E0B)" }}>
                  {saving ? "Menyimpan…" : kondisi === "sesuai" ? "Kembalikan ke Stok Gudang" : kondisi === "tidak_sesuai" ? "Simpan ke Daftar Banding" : "Pilih kondisi barang"}
                </button>
              </div>
            </div>
          )}
          {!info && !err && mode === "barcode" && <div style={{ padding: 30, textAlign: "center", color: "#94A3B8", fontSize: 13, border: "2px dashed #E2E8F0", borderRadius: 10 }}>Scan barcode barang retur untuk melihat detail pesanannya</div>}
        </div>

        <div style={card}>
          <div style={{ fontWeight: 800, color: "#0F172A", marginBottom: 10 }}>Retur Terakhir Diproses</div>
          {recent.length === 0 ? <div style={{ fontSize: 12, color: "#94A3B8" }}>Belum ada retur.</div> : recent.map((r) => (
            <div key={r.id} style={{ padding: "8px 0", borderTop: "1px solid #F1F5F9", fontSize: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><b style={{ fontFamily: "monospace" }}>{r.no_retur}</b><Badge s={r.status} /></div>
              <div style={{ color: "#475569" }}>{r.kode_barcode || "tanpa barcode"} · {r.nama_barang}{r.size ? ` · ${r.size}` : ""}</div>
              <div style={{ color: "#94A3B8", fontSize: 11 }}>{r.order_id ? `Order ${r.order_id} · ` : ""}{r.pembeli?.recipient || ""} · {tgl(r.tanggal)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MasalahForm({ jenis, setJenis, catatan, setCatatan, klaim, setKlaim, resi, setResi, inp }: any) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {JENIS_MASALAH.map((j) => (
          <button key={j} type="button" onClick={() => setJenis(j)} style={{ padding: "5px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700, cursor: "pointer", border: `1px solid ${jenis === j ? "#EF4444" : "#FECACA"}`, background: jenis === j ? "#EF4444" : "white", color: jenis === j ? "white" : "#B91C1C" }}>{j}</button>
        ))}
      </div>
      <textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Detail kondisi barang untuk bukti banding (mis. sobek di jahitan kiri, noda, label dilepas…)" rows={2} style={{ ...inp, resize: "vertical" }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div><div style={{ fontSize: 11, fontWeight: 700, color: "#7F1D1D", marginBottom: 4 }}>Nilai klaim ke marketplace (Rp)</div><input type="number" min={0} value={klaim} placeholder="0" onFocus={(e) => e.target.select()} onChange={(e) => setKlaim(e.target.value)} style={inp} /></div>
        <div><div style={{ fontSize: 11, fontWeight: 700, color: "#7F1D1D", marginBottom: 4 }}>No. resi retur (opsional)</div><input value={resi} onChange={(e) => setResi(e.target.value)} placeholder="Resi paket retur" style={inp} /></div>
      </div>
    </div>
  );
}

function OrderCard({ o }: { o: any }) {
  return (
    <div style={{ border: "1px solid #FDE68A", background: "#FFFBEB", borderRadius: 12, padding: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 12 }}>
      <div style={{ gridColumn: "span 2", display: "flex", justifyContent: "space-between" }}>
        <div><span style={{ fontSize: 10, fontWeight: 800, color: "#B45309", textTransform: "uppercase" }}>{o.marketplace}</span> <b style={{ fontFamily: "monospace", fontSize: 14 }}>{o.order_id}</b></div>
        <span style={{ color: "#64748B" }}>Pesan: {o.tanggal_pesanan || "-"}</span>
      </div>
      <div><div style={{ color: "#92400E", display: "flex", gap: 4, alignItems: "center" }}><User size={12} /> Pembeli</div><b>{o.recipient || "-"}</b><div style={{ color: "#64748B" }}>@{o.buyer_username || "-"} · {o.phone || "-"}</div></div>
      <div><div style={{ color: "#92400E", display: "flex", gap: 4, alignItems: "center" }}><Truck size={12} /> Resi kirim</div><b>{o.shipping_provider || "-"}</b><div style={{ fontFamily: "monospace" }}>{o.tracking_id || "-"}</div></div>
      <div style={{ gridColumn: "span 2" }}><div style={{ color: "#92400E", display: "flex", gap: 4, alignItems: "center" }}><MapPin size={12} /> Alamat</div>{[o.address, o.city, o.province].filter(Boolean).join(", ") || "-"}</div>
      <div style={{ gridColumn: "span 2", borderTop: "1px dashed #FCD34D", paddingTop: 6 }}>
        {(o.items || []).map((i: any, k: number) => <div key={k} style={{ display: "flex", justifyContent: "space-between" }}><span>{i.variation || i.product_name}</span><b>×{i.quantity}</b></div>)}
      </div>
      {o.retur_request?.length > 0 && (
        <div style={{ gridColumn: "span 2", background: "white", borderRadius: 8, padding: 8 }}>
          <b style={{ color: "#B91C1C" }}>Pengajuan retur pembeli:</b> {o.retur_request.map((r: any) => `${r.return_type} — ${r.alasan}`).join("; ")}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── BANDING ───────────────────────── */
function BandingList({ list, summary, reload }: { list: any[]; summary: any; reload: () => void }) {
  const [filter, setFilter] = useState<string>("Aktif");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Record<string, { dana?: string }>>({});
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return list
      .filter((r) => filter === "Semua" ? true : filter === "Aktif" ? r.status === "Perlu Diajukan" || r.status === "Diajukan Banding" : filter === "Kembali ke Stok" ? r.kondisi === "sesuai" || r.status === "Dipindah ke Stok" : r.status === filter)
      .filter((r) => !s || [r.no_retur, r.order_id, r.kode_barcode, r.nama_barang, r.pembeli?.recipient].some((v) => String(v || "").toLowerCase().includes(s)));
  }, [list, filter, q]);

  const post = async (body: any, ok: string) => {
    const res = await fetch("/api/retur-marketplace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await res.json();
    if (!res.ok) return toast.error(j.error);
    toast.success(ok);
    reload();
  };
  const del = async (r: any) => {
    if (!confirm(`Hapus ${r.no_retur}? Pcs ${r.kode_barcode || ""} kembali berstatus TERJUAL seperti sebelum retur.`)) return;
    const res = await fetch(`/api/retur-marketplace?id=${r.id}`, { method: "DELETE" });
    const j = await res.json();
    if (!res.ok) return toast.error(j.error);
    toast.success(`${r.no_retur} dihapus`);
    reload();
  };
  const copy = (r: any) => {
    const t = [`Pengajuan Banding Retur`, `Order ID: ${r.order_id || "-"}`, `Marketplace: ${r.marketplace || "-"}`, `Pembeli: ${r.pembeli?.recipient || "-"} ${r.pembeli?.buyer_username ? "(@" + r.pembeli.buyer_username + ")" : ""}`, `Resi kirim: ${r.pembeli?.tracking_id || "-"}`, `Resi retur: ${r.resi_retur || "-"}`, `Barang: ${r.nama_barang}${r.size ? " size " + r.size : ""}`, `Barcode dikirim: ${r.kode_barcode || "-"} (terjual ${r.tanggal_jual ? new Date(r.tanggal_jual).toLocaleDateString("id-ID") : "-"})`, `Masalah: ${r.jenis_masalah}`, `Keterangan: ${r.catatan || "-"}`, `Nilai klaim: ${rp(r.nilai_klaim)}`].join("\n");
    navigator.clipboard.writeText(t).then(() => toast.success("Ringkasan banding disalin — tempel di form banding marketplace"));
  };

  const cards = [
    { l: "Perlu Diajukan", v: summary?.perlu_diajukan ?? 0, c: "#B91C1C", bg: "#FEF2F2", I: AlertTriangle, f: "Perlu Diajukan" },
    { l: "Sedang Banding", v: summary?.diajukan ?? 0, c: "#B45309", bg: "#FFFBEB", I: Clock, f: "Diajukan Banding" },
    { l: "Disetujui", v: summary?.disetujui ?? 0, c: "#047857", bg: "#ECFDF5", I: CheckCircle2, f: "Banding Disetujui" },
    { l: "Ditolak", v: summary?.ditolak ?? 0, c: "#475569", bg: "#F1F5F9", I: XCircle, f: "Banding Ditolak" },
    { l: "Kembali ke Stok", v: summary?.kembali_stok ?? 0, c: "#1D4ED8", bg: "#EFF6FF", I: PackageCheck, f: "Kembali ke Stok" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr) 1.3fr", gap: 12 }}>
        {cards.map(({ l, v, c, bg, I, f }) => (
          <button key={l} onClick={() => setFilter(f)} style={{ textAlign: "left", background: "white", border: `1px solid ${filter === f ? c : "#E2E8F0"}`, borderRadius: 14, padding: 14, cursor: "pointer" }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: bg, color: c, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}><I size={17} /></div>
            <div style={{ fontSize: 22, fontWeight: 900, color: c }}>{v}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B" }}>{l}</div>
          </button>
        ))}
        <div style={{ background: "linear-gradient(135deg,#0F172A,#334155)", color: "white", borderRadius: 14, padding: 14 }}>
          <div style={{ fontSize: 11, opacity: 0.7, display: "flex", gap: 6, alignItems: "center" }}><Scale size={13} /> Klaim belum cair</div>
          <div style={{ fontSize: 18, fontWeight: 900 }}>{rp(summary?.nilai_klaim_terbuka)}</div>
          <div style={{ fontSize: 11, opacity: 0.7, display: "flex", gap: 6, alignItems: "center", marginTop: 6 }}><Wallet size={13} /> Dana sudah kembali</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#6EE7B7" }}>{rp(summary?.dana_diterima)}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", background: "white", border: "1px solid #CBD5E1", borderRadius: 10, padding: "0 12px", flex: 1, maxWidth: 380 }}>
          <Search size={16} color="#94A3B8" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari No. Retur, Order ID, barcode, pembeli…" style={{ flex: 1, border: "none", outline: "none", padding: "10px", fontSize: 13 }} />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #CBD5E1", fontSize: 13, fontWeight: 700 }}>
          {["Aktif", "Semua", ...STATUS_BANDING, "Kembali ke Stok"].map((s) => <option key={s} value={s}>{s === "Aktif" ? "Banding aktif (perlu tindakan)" : s}</option>)}
        </select>
      </div>

      <div style={{ background: "white", borderRadius: 14, border: "1px solid #E2E8F0", overflow: "hidden" }}>
        {rows.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontSize: 13 }}><PackageOpen size={36} style={{ marginBottom: 8 }} /><div>Tidak ada data retur untuk filter ini.</div></div> : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr style={{ background: "#F8FAFC", color: "#64748B", fontSize: 11, textAlign: "left" }}>
              <th style={{ padding: "10px 12px" }}>NO. RETUR / ORDER</th><th style={{ padding: "10px 12px" }}>PEMBELI</th><th style={{ padding: "10px 12px" }}>BARANG</th><th style={{ padding: "10px 12px" }}>MASALAH</th><th style={{ padding: "10px 12px", textAlign: "right" }}>KLAIM / DANA</th><th style={{ padding: "10px 12px" }}>STATUS</th><th style={{ padding: "10px 12px", textAlign: "right" }}>AKSI</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => {
                const isBanding = r.kondisi === "tidak_sesuai" && r.status !== "Dipindah ke Stok";
                return (
                  <tr key={r.id} style={{ borderTop: "1px solid #F1F5F9", verticalAlign: "top" }}>
                    <td style={{ padding: "10px 12px" }}><b style={{ fontFamily: "monospace" }}>{r.no_retur}</b><div style={{ color: "#64748B", fontFamily: "monospace" }}>{r.order_id ? `Order ${r.order_id}` : "Tanpa Order ID"}</div><div style={{ color: "#94A3B8", fontSize: 11 }}>{r.marketplace} · {tgl(r.tanggal)}</div></td>
                    <td style={{ padding: "10px 12px" }}><b>{r.pembeli?.recipient || "-"}</b>{r.pembeli?.buyer_username && <div style={{ color: "#64748B" }}>@{r.pembeli.buyer_username}</div>}<div style={{ color: "#94A3B8", fontSize: 11 }}>{r.pembeli?.kota || ""}</div>{r.resi_retur && <div style={{ fontSize: 11, display: "flex", gap: 4, alignItems: "center" }}><Receipt size={11} /> {r.resi_retur}</div>}</td>
                    <td style={{ padding: "10px 12px" }}><div style={{ fontWeight: 700 }}>{r.nama_barang}</div><div style={{ color: "#64748B" }}>{r.kode_barcode ? <span style={{ fontFamily: "monospace" }}>{r.kode_barcode}</span> : "tanpa barcode"}{r.size ? ` · ${r.size}` : ""}</div>{r.no_transaksi && <div style={{ color: "#94A3B8", fontSize: 11 }}>{r.no_transaksi}</div>}</td>
                    <td style={{ padding: "10px 12px", maxWidth: 220 }}>{r.kondisi === "sesuai" ? <span style={{ color: "#047857", fontWeight: 700 }}>Sesuai, layak jual</span> : <><b style={{ color: "#B91C1C" }}>{r.jenis_masalah}</b><div style={{ color: "#64748B" }}>{r.catatan}</div></>}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      {isBanding ? (<>
                        <div style={{ fontWeight: 800 }}>{rp(r.nilai_klaim)}</div>
                        <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", marginTop: 4 }}>
                          <input type="number" min={0} placeholder={r.dana_diterima ? String(r.dana_diterima) : "Dana cair"} value={edit[r.id]?.dana ?? ""} onFocus={(e) => e.target.select()} onChange={(e) => setEdit({ ...edit, [r.id]: { dana: e.target.value } })} style={{ width: 90, padding: "4px 6px", border: "1px solid #E2E8F0", borderRadius: 6, fontSize: 11, textAlign: "right" }} />
                          <button title="Simpan dana yang dikembalikan marketplace" onClick={() => { const v = Number(edit[r.id]?.dana || 0); post({ action: "banding", id: r.id, dana_diterima: v, status: v > 0 ? "Banding Disetujui" : undefined }, "Dana diterima dicatat"); setEdit({ ...edit, [r.id]: {} }); }} style={{ padding: "4px 6px", borderRadius: 6, border: "none", background: "#10B981", color: "white", cursor: "pointer" }}><Wallet size={12} /></button>
                        </div>
                        {r.dana_diterima > 0 && <div style={{ color: "#047857", fontWeight: 700, fontSize: 11, marginTop: 2 }}>Cair {rp(r.dana_diterima)}</div>}
                      </>) : <span style={{ color: "#94A3B8" }}>-</span>}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {isBanding ? (
                        <select value={r.status} onChange={(e) => post({ action: "banding", id: r.id, status: e.target.value }, `Status diubah: ${e.target.value}`)} style={{ padding: "5px 6px", borderRadius: 8, border: `1px solid ${statusColor[r.status]?.[1] || "#CBD5E1"}`, background: statusColor[r.status]?.[0], color: statusColor[r.status]?.[1], fontSize: 11, fontWeight: 800 }}>
                          {STATUS_BANDING.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      ) : <Badge s={r.status} />}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                        {isBanding && <button title="Salin ringkasan untuk form banding" onClick={() => copy(r)} style={{ padding: 6, borderRadius: 6, border: "none", background: "#EEF2FF", color: "#4F46E5", cursor: "pointer" }}><Copy size={13} /></button>}
                        {isBanding && r.kode_barcode && <button title="Barang ternyata masih layak jual → masukkan ke stok" onClick={() => confirm(`Masukkan ${r.kode_barcode} ke stok gudang?`) && post({ action: "ke_stok", id: r.id }, `${r.kode_barcode} dipindah ke stok`)} style={{ padding: 6, borderRadius: 6, border: "none", background: "#EFF6FF", color: "#1D4ED8", cursor: "pointer" }}><Undo2 size={13} /></button>}
                        <button title="Hapus (salah input)" onClick={() => del(r)} style={{ padding: 6, borderRadius: 6, border: "none", background: "#FEF2F2", color: "#DC2626", cursor: "pointer" }}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <div style={{ fontSize: 11, color: "#64748B", lineHeight: 1.6 }}>
        <b>Keterangan aksi:</b> <Copy size={11} /> salin ringkasan bukti untuk form banding marketplace · <Undo2 size={11} /> barang ternyata masih layak (mis. setelah dicuci/diperbaiki) → masuk stok · <Trash2 size={11} /> hapus data salah input (pcs kembali berstatus terjual).
        Mengisi <b>dana cair</b> otomatis menandai status <b>Banding Disetujui</b>.
      </div>
    </div>
  );
}
