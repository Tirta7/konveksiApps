"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  TrendingUp, TrendingDown, Package, Layers, Activity, Inbox, RefreshCw, Search, X,
  ArrowDownToLine, ArrowUpFromLine, CheckCheck, AlertTriangle, Clock, Boxes, Printer, Truck, Ban, FileText, RotateCcw,
  DollarSign, CheckCircle2, Info,
} from "lucide-react";
import NotaRejectModal from "@/components/NotaRejectModal";

type SizeQty = { size: string; jumlah: number };
type Alokasi = { mode: "baru" | "lama"; barang_id: string; nama_baru: string; harga_jual: string; items: SizeQty[] };
type TabKey = "masuk" | "vendor" | "stok" | "reject" | "riwayat";
type GudangData = { stock: any[]; movements: any[]; inbound: any[]; di_vendor: any[]; po_progress: any[]; barang: any[]; prefix: string; vendors?: any[]; po_list?: any[] };

const TUJUAN_KELUAR = ["Penjualan Grosir", "Penjualan Online", "Retail Offline", "Retur ke Produksi", "Sample / Promosi", "Lainnya"];
const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "27", "28", "29", "30", "31", "32", "33", "34", "35", "36", "38", "40"];
const sortSizes = (list: SizeQty[]) =>
  [...(list || [])].sort((a, b) => {
    const ia = SIZE_ORDER.indexOf(a.size), ib = SIZE_ORDER.indexOf(b.size);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.size.localeCompare(b.size);
  });
const sumQty = (arr?: SizeQty[]) => (arr || []).reduce((s, x) => s + Number(x?.jumlah || 0), 0);
const fmt = (n: number) => Number(n || 0).toLocaleString("id-ID");

function formatTgl(str?: string, withTime = false) {
  if (!str) return "-";
  return new Date(str).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) });
}

export default function GudangPage() {
  const [data, setData] = useState<GudangData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<TabKey>("masuk");
  const [search, setSearch] = useState("");
  const [jenisFilter, setJenisFilter] = useState<"semua" | "masuk" | "keluar" | "reject">("semua");

  const [terimaModal, setTerimaModal] = useState<any | null>(null);
  const [terimaForm, setTerimaForm] = useState<{
    alokasi: Alokasi[];
    catatan: string;
    reject: SizeQty[];
    alasan_reject: string;
    reject_vendor_id: string;
    biaya_per_pcs: number;
    tindakan_klaim: string;
    sisa_mode: "tetap" | "reject";
  }>({
    alokasi: [],
    catatan: "",
    reject: [],
    alasan_reject: "",
    reject_vendor_id: "",
    biaya_per_pcs: 0,
    tindakan_klaim: "potong_tagihan",
    sisa_mode: "tetap",
  });
  const [printReady, setPrintReady] = useState<{ ids: number[]; total: number; reject: number; sisa: number } | null>(null);
  const [keluarModal, setKeluarModal] = useState<any | null>(null);
  const [keluarForm, setKeluarForm] = useState<{ items: (SizeQty & { max: number })[]; tujuan: string; keterangan: string }>({ items: [], tujuan: TUJUAN_KELUAR[0], keterangan: "" });
  const [rejectModal, setRejectModal] = useState<any | null>(null);
  const [rejectForm, setRejectForm] = useState<{ items: (SizeQty & { max: number })[]; alasan: string; biaya_per_pcs: number; tindakan_klaim: string }>({ items: [], alasan: "", biaya_per_pcs: 0, tindakan_klaim: "potong_tagihan" });
  const [notaModal, setNotaModal] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const d = await fetch("/api/stock?_t=" + Date.now()).then((r) => r.json());
      setData({
        stock: d.stock || [],
        movements: d.movements || [],
        inbound: d.inbound || [],
        di_vendor: d.di_vendor || [],
        po_progress: d.po_progress || [],
        barang: d.barang || [],
        prefix: d.prefix || "BRG",
        vendors: d.vendors || [],
        po_list: d.po_list || [],
      });
    } catch {
      toast.error("Gagal memuat data gudang");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const handler = () => fetchData();
    window.addEventListener("konveksi-sync", handler);
    return () => window.removeEventListener("konveksi-sync", handler);
  }, [fetchData]);

  // Deep link dari Gudang Produksi (?terima=ID) → langsung buka form terima.
  // Jika antrean kosong saat pertama dibuka, langsung tampilkan stok.
  useEffect(() => {
    if (loading || !data) return;
    const id = new URLSearchParams(window.location.search).get("terima");
    if (id) {
      const r = data.inbound.find((x) => String(x.transfer_id) === id);
      setTab("masuk");
      if (r) openTerima(r);
      else toast.info("Barang tersebut sudah masuk stok / tidak ada di antrean");
      window.history.replaceState(null, "", "/gudang");
      return;
    }
    if (data.inbound.length === 0 && tab === "masuk") setTab(data.di_vendor.length ? "vendor" : "stok");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const stock = data?.stock || [];
  const movements = data?.movements || [];
  const inbound = data?.inbound || [];
  const diVendor = data?.di_vendor || [];
  const barangList = data?.barang || [];
  const poProg = useMemo(() => {
    const m: Record<string, any> = {};
    for (const p of data?.po_progress || []) m[String(p.po_id)] = p;
    return m;
  }, [data]);
  const rejectMov = useMemo(() => movements.filter((m) => m.jenis === "reject"), [movements]);

  const weekAgo = Date.now() - 7 * 86400000;
  const totalStok = stock.reduce((s, r) => s + Number(r.stok_saat_ini || 0), 0);
  const pcsAntrean = inbound.reduce((s, r) => s + Number(r.jumlah || 0), 0);
  const pcsDiVendor = diVendor.reduce((s, r) => s + Number(r.sisa || 0), 0);
  const totalReject = rejectMov.reduce((s, m) => s + Number(m.jumlah || 0), 0);
  const masukMingguIni = movements.filter((m) => m.jenis === "masuk" && new Date(m.tanggal).getTime() >= weekAgo).reduce((s, m) => s + m.jumlah, 0);
  const keluarMingguIni = movements.filter((m) => m.jenis === "keluar" && new Date(m.tanggal).getTime() >= weekAgo).reduce((s, m) => s + m.jumlah, 0);

  const q = search.toLowerCase().trim();
  const filteredInbound = useMemo(() => inbound.filter((r) => !q || [r.noPo, r.model, r.tahap, r.vendor_nama].join(" ").toLowerCase().includes(q)), [inbound, q]);
  const filteredVendor = useMemo(() => diVendor.filter((r) => !q || [r.noPo, r.model, r.tahap, r.vendor_nama].join(" ").toLowerCase().includes(q)), [diVendor, q]);
  const filteredReject = useMemo(() => rejectMov.filter((m) => !q || [m.noPo, m.kategori, m.sumber, m.keterangan].join(" ").toLowerCase().includes(q)), [rejectMov, q]);
  const rejectStats = useMemo(() => {
    const list = filteredReject;
    const totalPcs = list.reduce((s: number, m: any) => s + Number(m.jumlah || 0), 0);
    const totalNilaiKlaim = list.reduce((s: number, m: any) => s + Number(m.total_klaim || 0), 0);
    const totalLunas = list
      .filter((m: any) => m.status_klaim === "Lunas" || m.status_klaim === "Selesai")
      .reduce((s: number, m: any) => s + Number(m.nominal_dibayar || m.total_klaim || 0), 0);
    const totalBelumLunas = Math.max(0, totalNilaiKlaim - totalLunas);
    const totalLunasCount = list.filter((m: any) => m.status_klaim === "Lunas" || m.status_klaim === "Selesai").length;
    const totalBelumCount = list.length - totalLunasCount;
    return { totalPcs, totalNilaiKlaim, totalLunas, totalBelumLunas, totalLunasCount, totalBelumCount };
  }, [filteredReject]);
  const filteredStock = useMemo(() => stock.filter((r) => !q || [r.nama_barang, r.kode, r.kategori, ...(r.lots || []).map((l: any) => l.noPo)].join(" ").toLowerCase().includes(q)), [stock, q]);
  const filteredMov = useMemo(
    () => movements.filter((m) => (jenisFilter === "semua" || m.jenis === jenisFilter) && (!q || [m.nama_barang, m.kode, m.kategori, m.noPo, m.sumber, m.keterangan].join(" ").toLowerCase().includes(q))),
    [movements, jenisFilter, q]
  );

  // ─── Actions ─────────────────────────────────────────────────────────
  // Barang yang sudah pernah dibuat dari PO yang sama (setoran sebelumnya) → setoran susulan otomatis menyambung
  const barangDariPo = (poId: any) => {
    const m = movements.find((x: any) => x.jenis === "masuk" && String(x.po_id) === String(poId) && x.barang_id != null);
    return m ? barangList.find((b: any) => String(b.id) === String(m.barang_id)) || null : null;
  };
  const newAlokasi = (r: any, full: boolean, linked?: any): Alokasi => ({
    mode: linked ? "lama" : "baru",
    barang_id: linked ? String(linked.id) : "",
    nama_baru: "",
    harga_jual: "",
    items: sortSizes(r.sizes || []).map((s: SizeQty) => ({ size: s.size, jumlah: full ? s.jumlah : 0 })),
  });
  const openTerima = (r: any) => {
    setTerimaModal(r);
    setPrintReady(null);
    const currentPo = (data?.po_list || []).find((p: any) => String(p.id) === String(r.po_id));
    const defaultVendorId = r.vendor_id != null ? String(r.vendor_id) : (currentPo?.vendorId ? String(currentPo.vendorId) : "");
    const vendorObj = (data?.vendors || []).find((v: any) => String(v.id) === defaultVendorId);
    const defaultBiaya = Number(vendorObj?.tarif || 0) || 35000;

    setTerimaForm({
      alokasi: [newAlokasi(r, true, barangDariPo(r.po_id))],
      catatan: "",
      reject: sortSizes(r.sizes || []).map((s: SizeQty) => ({ size: s.size, jumlah: 0 })),
      alasan_reject: "Ada Noda Membandel dan bekas sobek cacat",
      reject_vendor_id: defaultVendorId,
      biaya_per_pcs: defaultBiaya,
      tindakan_klaim: "potong_tagihan",
      sisa_mode: "tetap",
    });
  };
  const maxBySize = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of terimaModal?.sizes || []) m[s.size] = (m[s.size] || 0) + Number(s.jumlah || 0);
    return m;
  }, [terimaModal]);
  const usedBySize = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of terimaForm.alokasi) for (const it of a.items) m[it.size] = (m[it.size] || 0) + (Number(it.jumlah) || 0);
    for (const it of terimaForm.reject) m[it.size] = (m[it.size] || 0) + (Number(it.jumlah) || 0);
    return m;
  }, [terimaForm.alokasi, terimaForm.reject]);
  const updateAlokasi = (i: number, patch: Partial<Alokasi>) =>
    setTerimaForm((f) => ({ ...f, alokasi: f.alokasi.map((a, j) => (j === i ? { ...a, ...patch } : a)) }));
  const updateAlokasiQty = (i: number, size: string, jumlah: number) =>
    setTerimaForm((f) => ({ ...f, alokasi: f.alokasi.map((a, j) => (j === i ? { ...a, items: a.items.map((it) => (it.size === size ? { ...it, jumlah } : it)) } : a)) }));
  const updateRejectQty = (size: string, jumlah: number) => {
    setTerimaForm((f) => {
      const newReject = f.reject.map((it) => (it.size === size ? { ...it, jumlah } : it));
      let newAlokasi = f.alokasi;
      if (f.alokasi.length === 1) {
        const maxForSize = maxBySize[size] || 0;
        const targetBarangQty = Math.max(0, maxForSize - jumlah);
        newAlokasi = [
          {
            ...f.alokasi[0],
            items: f.alokasi[0].items.map((it) =>
              it.size === size ? { ...it, jumlah: targetBarangQty } : it
            ),
          },
        ];
      }
      return { ...f, reject: newReject, alokasi: newAlokasi };
    });
  };

  const submitTerima = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!terimaModal) return;
    for (const [size, used] of Object.entries(usedBySize)) {
      if (used > (maxBySize[size] || 0)) return toast.error(`Size ${size} melebihi sisa barang selesai (${maxBySize[size] || 0} pcs)`);
    }
    const aktif = terimaForm.alokasi.filter((a) => sumQty(a.items) > 0);
    const rejectTotal = sumQty(terimaForm.reject);
    if (aktif.length === 0 && rejectTotal === 0 && terimaForm.sisa_mode !== "reject") return toast.error("Isi jumlah masuk stok atau reject per size");
    const kosong = aktif.find((a) => (a.mode === "lama" ? !a.barang_id : !a.nama_baru.trim()));
    if (kosong) return toast.error("Setiap alokasi wajib punya nama barang");
    if ((rejectTotal > 0 || terimaForm.sisa_mode === "reject") && !terimaForm.alasan_reject.trim()) return toast.error("Isi alasan reject (mis. noda, sobek, salah jahit)");
    setSubmitting(true);
    try {
      const totalMasuk = aktif.reduce((s, a) => s + sumQty(a.items), 0);
      const totalRejInput = sumQty(terimaForm.reject);
      const sisaPcs = Math.max(0, terimaModal.jumlah - totalMasuk - totalRejInput);
      const totalRejEffective = totalRejInput + (terimaForm.sisa_mode === "reject" ? sisaPcs : 0);
      const totalKlaim = totalRejEffective * (Number(terimaForm.biaya_per_pcs) || 0);

      const res = await fetch("/api/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "terima",
          transfer_id: terimaModal.transfer_id,
          catatan: terimaForm.catatan,
          alokasi: aktif.map((a) => ({
            barang_id: a.mode === "lama" ? a.barang_id : undefined,
            nama_baru: a.mode === "baru" ? a.nama_baru.trim() : undefined,
            harga_jual: a.mode === "baru" ? Number(a.harga_jual) || 0 : undefined,
            items: a.items.map((it) => ({ size: it.size, jumlah: Number(it.jumlah) || 0 })),
          })),
          reject_items: terimaForm.reject.map((it) => ({ size: it.size, jumlah: Number(it.jumlah) || 0 })),
          alasan_reject: terimaForm.alasan_reject.trim(),
          reject_vendor_id: terimaForm.reject_vendor_id || undefined,
          biaya_per_pcs: Number(terimaForm.biaya_per_pcs) || 0,
          total_klaim: totalKlaim,
          tindakan_klaim: terimaForm.tindakan_klaim || "potong_tagihan",
          sisa_reject: terimaForm.sisa_mode === "reject",
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Gagal memasukkan ke stok");
      toast.success(`${terimaModal.noPo}: ${fmt(d.jumlah)} pcs masuk stok${d.reject ? ` · ${fmt(d.reject)} reject` : ""}${d.sisa ? ` · sisa ${fmt(d.sisa)} pcs tetap di antrean` : ""}`);
      if (d.nota_reject) {
        setNotaModal(d.nota_reject);
      }
      setPrintReady({ ids: d.movement_ids || [], total: d.jumlah, reject: d.reject || 0, sisa: d.sisa || 0 });
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openRejectVendor = (r: any) => {
    setRejectModal(r);
    setRejectForm({
      items: sortSizes(r.bisa_tutup || []).map((s: SizeQty) => ({ size: s.size, jumlah: 0, max: s.jumlah })),
      alasan: "",
      biaya_per_pcs: 0,
      tindakan_klaim: "potong_tagihan",
    });
  };
  const submitRejectVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModal) return;
    const over = rejectForm.items.find((i) => Number(i.jumlah) > i.max);
    if (over) return toast.error(`Size ${over.size} maksimal ${over.max} pcs`);
    const total = sumQty(rejectForm.items);
    if (total <= 0) return toast.error("Isi jumlah reject per size");
    if (!rejectForm.alasan.trim()) return toast.error("Isi alasan reject");
    setSubmitting(true);
    try {
      const res = await fetch("/api/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject_vendor",
          transfer_id: rejectModal.transfer_id,
          items: rejectForm.items.map((i) => ({ size: i.size, jumlah: Number(i.jumlah) || 0 })),
          alasan: rejectForm.alasan.trim(),
          biaya_per_pcs: Number(rejectForm.biaya_per_pcs) || 0,
          tindakan_klaim: rejectForm.tindakan_klaim || "potong_tagihan",
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Gagal mencatat reject");
      toast.success(`${fmt(d.jumlah)} pcs dicatat reject${d.selesai ? " — pekerjaan vendor selesai" : ` · sisa di vendor ${fmt(d.sisa)} pcs`}`);
      setRejectModal(null);
      if (d.nota_reject) {
        setNotaModal(d.nota_reject);
      }
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openKeluar = (r: any) => {
    setKeluarModal(r);
    setKeluarForm({ items: sortSizes(r.sizes || []).filter((s: SizeQty) => s.jumlah > 0).map((s: SizeQty) => ({ size: s.size, jumlah: 0, max: s.jumlah })), tujuan: TUJUAN_KELUAR[0], keterangan: "" });
  };
  const submitKeluar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keluarModal) return;
    const over = keluarForm.items.find((i) => Number(i.jumlah) > i.max);
    if (over) return toast.error(`Stok size ${over.size} hanya ${over.max} pcs`);
    const total = sumQty(keluarForm.items);
    if (total <= 0) return toast.error("Isi jumlah barang keluar");
    setSubmitting(true);
    try {
      const res = await fetch("/api/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "keluar",
          key: keluarModal.key,
          items: keluarForm.items.map((i) => ({ size: i.size, jumlah: Number(i.jumlah) || 0 })),
          tujuan: keluarForm.tujuan,
          keterangan: keluarForm.keterangan,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Gagal mencatat barang keluar");
      toast.success(`${fmt(d.jumlah)} pcs ${keluarModal.nama_barang} keluar (${keluarForm.tujuan})`);
      setKeluarModal(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── UI primitives ───────────────────────────────────────────────────
  const SizeChips = ({ list, tone = "#334155", bg = "#F8FAFC", border = "#E2E8F0" }: { list?: SizeQty[]; tone?: string; bg?: string; border?: string }) =>
    list && list.length > 0 ? (
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        {sortSizes(list).map((s, i) => (
          <span key={i} style={{ background: bg, border: `1px solid ${border}`, color: tone, padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 800 }}>
            {s.size}: {fmt(s.jumlah)}
          </span>
        ))}
      </div>
    ) : null;

  const Empty = ({ icon: Icon, title, desc }: { icon: any; title: string; desc?: string }) => (
    <div style={{ background: "white", borderRadius: 18, border: "1px dashed #CBD5E1", padding: "56px 24px", textAlign: "center" }}>
      <Icon size={42} style={{ color: "#CBD5E1", margin: "0 auto 12px" }} />
      <div style={{ fontSize: 15, fontWeight: 800, color: "#475569" }}>{title}</div>
      {desc && <div style={{ fontSize: 12.5, color: "#94A3B8", marginTop: 6, maxWidth: 460, marginInline: "auto", lineHeight: 1.5 }}>{desc}</div>}
    </div>
  );

  const StatCard = ({ icon: Icon, label, value, color, bg, prefix = "" }: any) => (
    <div className="gs-stat" style={{ background: "white", borderRadius: 16, border: "1px solid #E2E8F0", padding: 18, display: "flex", alignItems: "center", gap: 14, boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
      <div style={{ width: 46, height: 46, borderRadius: "50%", background: bg, color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon size={22} /></div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 23, fontWeight: 900, color, lineHeight: 1 }}>{prefix}{fmt(value)} <span style={{ fontSize: 13, color: "#94A3B8", fontWeight: 700 }}>pcs</span></div>
      </div>
    </div>
  );

  const thStyle: React.CSSProperties = { padding: "12px 18px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", borderBottom: "2px solid #E2E8F0", textAlign: "left", whiteSpace: "nowrap" };
  const tdStyle: React.CSSProperties = { padding: "14px 18px", fontSize: 13, verticalAlign: "top" };

  const tabs: { key: TabKey; label: string; icon: any; badge?: number }[] = [
    { key: "masuk", label: "Siap Masuk Gudang", icon: Inbox, badge: inbound.length },
    { key: "vendor", label: "Masih di Vendor", icon: Truck, badge: diVendor.length },
    { key: "stok", label: "Stok Barang Jadi", icon: Layers },
    { key: "reject", label: "Barang Reject", icon: Ban, badge: rejectMov.length },
    { key: "riwayat", label: "Riwayat Pergerakan", icon: Activity },
  ];

  // Rekap per PO: masuk gudang · antre · di vendor · reject
  const PoProgress = ({ poId }: { poId: any }) => {
    const p = poProg[String(poId)];
    if (!p) return null;
    const total = Math.max(p.terbit || 0, p.masuk + p.antre + p.di_vendor + p.reject) || 1;
    const seg = (v: number, c: string) => (v > 0 ? <div style={{ width: `${(v / total) * 100}%`, background: c }} /> : null);
    return (
      <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 9, padding: "7px 10px" }}>
        <div style={{ display: "flex", height: 6, borderRadius: 99, overflow: "hidden", background: "#E2E8F0", marginBottom: 6 }}>
          {seg(p.masuk, "#10B981")}{seg(p.antre, "#F59E0B")}{seg(p.di_vendor, "#3B82F6")}{seg(p.reject, "#EF4444")}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 10px", fontSize: 10.5, fontWeight: 700, color: "#475569" }}>
          <span style={{ color: "#047857" }}>● Masuk gudang {fmt(p.masuk)}</span>
          <span style={{ color: "#B45309" }}>● Antre {fmt(p.antre)}</span>
          <span style={{ color: "#1D4ED8" }}>● Di vendor {fmt(p.di_vendor)}</span>
          <span style={{ color: "#B91C1C" }}>● Reject {fmt(p.reject)}</span>
          {p.terbit > 0 && <span style={{ color: "#94A3B8" }}>dari {fmt(p.terbit)} pcs PO</span>}
        </div>
      </div>
    );
  };

  return (
    <>
      <style>{`
        .gs-row:hover { background: #F8FAFC; }
        .gs-card { transition: transform .18s ease, box-shadow .18s ease; }
        .gs-card:hover { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(15,23,42,0.08) !important; }
        .gs-stat { transition: transform .18s ease; }
        .gs-stat:hover { transform: translateY(-2px); }
        .gs-input { width: 100%; padding: 8px 10px; border-radius: 8px; border: 1px solid #CBD5E1; font-size: 13px; font-weight: 700; outline: none; box-sizing: border-box; }
        .gs-input:focus { border-color: #2563EB; box-shadow: 0 0 0 3px rgba(37,99,235,0.12); }
        @keyframes gs-spin { to { transform: rotate(360deg); } }
        @media (max-width: 900px) { .gs-stats { grid-template-columns: repeat(2, 1fr) !important; } }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", minHeight: "100%", background: "#F1F5F9" }}>
        {/* Header */}
        <div style={{ padding: "22px 32px", background: "white", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", margin: 0 }}>Gudang &amp; Stok</h1>
            <p style={{ fontSize: 13, color: "#64748B", margin: "4px 0 0" }}>
              Penyimpanan barang jadi yang sudah selesai diproses oleh vendor lanjutan (washing, bersih benang, packing, dll).
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Link href="/gudang-produksi" style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid #E2E8F0", background: "white", color: "#334155", fontSize: 12.5, fontWeight: 800, textDecoration: "none" }}>
              Gudang Produksi →
            </Link>
            <button onClick={() => fetchData(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 10, border: "1px solid #E2E8F0", background: "white", color: "#334155", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>
              <RefreshCw size={14} style={refreshing ? { animation: "gs-spin 0.8s linear infinite" } : undefined} /> Muat Ulang
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="gs-stats" style={{ padding: "20px 32px 0", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          <StatCard icon={Package} label="Total Stok Barang Jadi" value={totalStok} color="#1D4ED8" bg="#DBEAFE" />
          <StatCard icon={Inbox} label="Siap Masuk Gudang" value={pcsAntrean} color="#B45309" bg="#FEF3C7" />
          <StatCard icon={Truck} label="Masih di Vendor" value={pcsDiVendor} color="#0369A1" bg="#E0F2FE" />
          <StatCard icon={TrendingUp} label="Masuk (7 Hari)" value={masukMingguIni} color="#059669" bg="#DCFCE7" prefix="+" />
          <StatCard icon={TrendingDown} label="Keluar (7 Hari)" value={keluarMingguIni} color="#DC2626" bg="#FEE2E2" prefix="-" />
          <StatCard icon={Ban} label="Total Reject" value={totalReject} color="#B91C1C" bg="#FEF2F2" />
        </div>

        {/* Tabs + search */}
        <div style={{ padding: "18px 32px 0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 4, background: "white", padding: 4, borderRadius: 12, border: "1px solid #E2E8F0", flexWrap: "wrap" }}>
            {tabs.map((t) => {
              const active = tab === t.key;
              return (
                <button key={t.key} id={`tab-${t.key}`} onClick={() => setTab(t.key)} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 800, background: active ? "#0F172A" : "transparent", color: active ? "white" : "#475569", transition: "all .15s" }}>
                  <t.icon size={14} /> {t.label}
                  {!!t.badge && <span style={{ background: active ? "#F59E0B" : "#FEF3C7", color: active ? "white" : "#B45309", borderRadius: 99, padding: "1px 7px", fontSize: 10.5, fontWeight: 900 }}>{t.badge}</span>}
                </button>
              );
            })}
          </div>
          <div style={{ position: "relative", minWidth: 260 }}>
            <Search size={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari no PO, model, vendor..." className="gs-input" style={{ paddingLeft: 32, fontWeight: 600 }} />
          </div>
        </div>

        <div style={{ padding: "16px 32px 32px", flex: 1 }}>
          {loading ? (
            <div style={{ padding: 60, textAlign: "center", color: "#94A3B8" }}>Memuat data gudang...</div>
          ) : tab === "masuk" ? (
            /* ── TAB: SIAP MASUK GUDANG ─────────────────────────────── */
            filteredInbound.length === 0 ? (
              <Empty icon={Inbox} title="Belum ada barang selesai proses" desc="Barang otomatis muncul di sini setiap kali setoran vendor lanjutan (washing, bersih benang, packing) di-ACC — walau baru sebagian — atau barang diverifikasi di Gudang Produksi. Sisa yang masih dikerjakan bisa dilihat di tab Masih di Vendor." />
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
                {filteredInbound.map((r) => (
                  <div key={r.transfer_id} className="gs-card" style={{ background: "white", borderRadius: 16, border: "1px solid #E2E8F0", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
                    <div style={{ height: 4, background: r.is_final ? "linear-gradient(90deg,#10B981,#059669)" : "linear-gradient(90deg,#F59E0B,#D97706)" }} />
                    <div style={{ padding: "16px 18px", flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 14, fontWeight: 900, fontFamily: "monospace", color: "#1D4ED8", background: "#EFF6FF", border: "1px solid #BFDBFE", padding: "2px 8px", borderRadius: 6 }}>{r.noPo}</span>
                            <span style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>{r.model}</span>
                          </div>
                          <div style={{ fontSize: 12, color: "#64748B", marginTop: 6 }}>
                            Selesai <b style={{ color: "#334155" }}>{r.tahap}</b> · {r.vendor_nama}
                          </div>
                          <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                            <Clock size={11} /> {formatTgl(r.selesai_at)}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 24, fontWeight: 900, color: "#059669", lineHeight: 1 }}>{fmt(r.jumlah)}</div>
                          <div style={{ fontSize: 10.5, fontWeight: 700, color: "#94A3B8" }}>{r.jumlah_awal > r.jumlah ? `sisa dari ${fmt(r.jumlah_awal)} pcs` : "pcs selesai"}</div>
                        </div>
                      </div>
                      <SizeChips list={r.sizes} tone="#047857" bg="#ECFDF5" border="#A7F3D0" />
                      {(r.sudah_masuk > 0 || r.sudah_reject > 0) && (
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#475569" }}>
                          Setoran ini sudah diproses: <span style={{ color: "#047857" }}>{fmt(r.sudah_masuk)} masuk stok</span>
                          {r.sudah_reject > 0 && <span style={{ color: "#B91C1C" }}> · {fmt(r.sudah_reject)} reject</span>}
                        </div>
                      )}
                      <PoProgress poId={r.po_id} />
                      {r.is_final ? (
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: "#047857", background: "#ECFDF5", border: "1px solid #A7F3D0", padding: "6px 10px", borderRadius: 8, display: "flex", gap: 6, alignItems: "center" }}>
                          <CheckCheck size={13} /> Tahap terakhir — siap disimpan sebagai barang jadi
                        </div>
                      ) : (
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: "#B45309", background: "#FFFBEB", border: "1px solid #FDE68A", padding: "6px 10px", borderRadius: 8, display: "flex", gap: 6, alignItems: "flex-start", lineHeight: 1.4 }}>
                          <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                          <span>Masih ada tahap: <b>{r.tahap_berikutnya.join(" → ")}</b>. Masukkan ke stok hanya jika tahap tsb tidak diperlukan.</span>
                        </div>
                      )}
                      <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid #F1F5F9", display: "flex", justifyContent: "flex-end" }}>
                        <button id={`btn-terima-${r.transfer_id}`} onClick={() => openTerima(r)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#059669,#047857)", color: "white", fontSize: 12.5, fontWeight: 800, cursor: "pointer", boxShadow: "0 3px 10px rgba(5,150,105,0.25)" }}>
                          <ArrowDownToLine size={14} /> Terima ke Stok
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : tab === "vendor" ? (
            /* ── TAB: MASIH DI VENDOR ──────────────────────────────── */
            filteredVendor.length === 0 ? (
              <Empty icon={Truck} title="Tidak ada barang yang masih di vendor" desc="Semua pekerjaan vendor lanjutan sudah disetor penuh atau ditutup." />
            ) : (
              <div style={{ background: "white", borderRadius: 18, border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
                <div style={{ padding: "12px 18px", fontSize: 12, color: "#334155", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", lineHeight: 1.5, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontWeight: 800, color: "#0F172A", display: "flex", alignItems: "center", gap: 6 }}>
                    <Info size={15} color="#2563EB" />
                    Panduan Perlakuan Sisa Pekerjaan di Vendor:
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
                    <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8, padding: "8px 12px", fontSize: 11.5, color: "#1E40AF" }}>
                      <strong>📥 Ingin Mengambil Fisik Barang / Alihkan ke Vendor Lain?</strong><br />
                      Buka menu <b>Gudang Produksi</b> lalu klik <b>Tarik ke Gudang</b>. Fisik barang tetap menjadi aset produksi aktif dan siap dialokasikan ulang.
                    </div>
                    <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "8px 12px", fontSize: 11.5, color: "#991B1B" }}>
                      <strong>🛑 Barang Rusak Fatal / Cacat Parah / Hilang di Vendor?</strong><br />
                      Klik tombol <b>Tutup Sisa → Reject</b> di tabel bawah. Sistem memotong sisa pekerjaan, memindahkan ke Gudang Reject, dan otomatis menerbitkan <b>Nota Klaim Ganti Rugi (REJ-...)</b>.
                    </div>
                  </div>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
                    <thead>
                      <tr style={{ background: "#F8FAFC" }}>
                        <th style={thStyle}>PO / Tahap</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>Dikirim</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>Sudah Setor</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>Menunggu ACC</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>Reject</th>
                        <th style={thStyle}>Sisa di Vendor</th>
                        <th style={thStyle}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredVendor.map((r) => (
                        <tr key={r.transfer_id} className="gs-row" style={{ borderBottom: "1px solid #F1F5F9" }}>
                          <td style={tdStyle}>
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <span style={{ fontSize: 12, fontWeight: 900, fontFamily: "monospace", color: "#1D4ED8" }}>{r.noPo}</span>
                              <span style={{ fontWeight: 800, color: "#0F172A" }}>{r.model}</span>
                            </div>
                            <div style={{ fontSize: 12, color: "#64748B", marginTop: 3 }}><b style={{ color: "#334155" }}>{r.tahap}</b> · {r.vendor_nama}</div>
                            <div style={{ fontSize: 11, color: r.lateDays > 0 ? "#DC2626" : "#94A3B8", marginTop: 2, fontWeight: r.lateDays > 0 ? 800 : 500 }}>
                              Kirim {formatTgl(r.tanggal_kirim)}{r.target_selesai ? ` · target ${formatTgl(r.target_selesai)}` : ""}{r.lateDays > 0 ? ` · terlambat ${r.lateDays} hari` : ""}
                            </div>
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800 }}>{fmt(r.jumlah_kirim)}</td>
                          <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800, color: "#047857" }}>{fmt(r.approved)}</td>
                          <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800, color: r.pending ? "#6D28D9" : "#CBD5E1" }}>{fmt(r.pending)}</td>
                          <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800, color: r.reject ? "#B91C1C" : "#CBD5E1" }}>{fmt(r.reject)}</td>
                          <td style={tdStyle}>
                            <div style={{ fontSize: 16, fontWeight: 900, color: "#0369A1", marginBottom: 4 }}>{fmt(r.sisa)} pcs</div>
                            <SizeChips list={r.sizes} tone="#0369A1" bg="#F0F9FF" border="#BAE6FD" />
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right" }}>
                            <button onClick={() => openRejectVendor(r)} disabled={r.bisa_tutup_total <= 0} title={r.bisa_tutup_total <= 0 ? "Sisa sedang menunggu ACC laporan vendor" : undefined}
                              style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 8, border: "1px solid #FECACA", background: r.bisa_tutup_total <= 0 ? "#F8FAFC" : "#FEF2F2", color: r.bisa_tutup_total <= 0 ? "#CBD5E1" : "#B91C1C", fontSize: 12, fontWeight: 800, cursor: r.bisa_tutup_total <= 0 ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
                              <Ban size={13} /> Tutup Sisa → Reject
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          ) : tab === "reject" ? (
            /* ── TAB: BARANG REJECT ────────────────────────────────── */
            filteredReject.length === 0 ? (
              <Empty icon={Ban} title="Belum ada barang reject" desc="Reject dicatat saat menerima barang ke gudang atau saat menutup sisa pekerjaan di vendor. Barang reject tidak menambah stok." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* 4 Summary Stat Cards untuk Klaim & Pembayaran Barang Reject */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                  <div style={{ background: "white", borderRadius: 14, padding: "14px 18px", border: "1px solid #E2E8F0", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Total Barang Reject</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "#DC2626", marginTop: 4 }}>
                      {fmt(rejectStats.totalPcs)} <span style={{ fontSize: 12, fontWeight: 700, color: "#94A3B8" }}>pcs</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>{filteredReject.length} transaksi tercatat</div>
                  </div>

                  <div style={{ background: "white", borderRadius: 14, padding: "14px 18px", border: "1px solid #E2E8F0", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Total Nilai Tagihan Klaim</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "#0F172A", marginTop: 4 }}>
                      Rp {fmt(rejectStats.totalNilaiKlaim)}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>Ganti rugi vendor</div>
                  </div>

                  <div style={{ background: "#F0FDF4", borderRadius: 14, padding: "14px 18px", border: "1px solid #BBF7D0", boxShadow: "0 2px 8px rgba(22,163,74,0.05)" }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#166534", textTransform: "uppercase" }}>Klaim Sudah Lunas</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "#16A34A", marginTop: 4 }}>
                      Rp {fmt(rejectStats.totalLunas)}
                    </div>
                    <div style={{ fontSize: 11, color: "#15803D", marginTop: 2 }}>{rejectStats.totalLunasCount} nota sudah terselesaikan</div>
                  </div>

                  <div style={{ background: rejectStats.totalBelumLunas > 0 ? "#FEF2F2" : "#F8FAFC", borderRadius: 14, padding: "14px 18px", border: `1px solid ${rejectStats.totalBelumLunas > 0 ? "#FECACA" : "#E2E8F0"}`, boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: rejectStats.totalBelumLunas > 0 ? "#991B1B" : "#64748B", textTransform: "uppercase" }}>Sisa Menunggu Pelunasan</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: rejectStats.totalBelumLunas > 0 ? "#DC2626" : "#64748B", marginTop: 4 }}>
                      Rp {fmt(rejectStats.totalBelumLunas)}
                    </div>
                    <div style={{ fontSize: 11, color: rejectStats.totalBelumLunas > 0 ? "#B91C1C" : "#94A3B8", marginTop: 2 }}>{rejectStats.totalBelumCount} nota belum dipotong/dibayar</div>
                  </div>
                </div>

                <div style={{ background: "white", borderRadius: 18, border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
                  <div style={{ padding: "12px 18px", borderBottom: "1px solid #E2E8F0", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "#475569", marginRight: 4 }}>Filter Ringkasan SPK:</span>
                    {(data?.po_progress || []).filter((p: any) => p.reject > 0).map((p: any) => (
                      <span key={p.po_id} style={{ fontSize: 11.5, fontWeight: 800, color: "#B91C1C", background: "#FEF2F2", border: "1px solid #FECACA", padding: "4px 10px", borderRadius: 8 }}>
                        {p.noPo} · {p.model}: {fmt(p.reject)} pcs{p.terbit ? ` (${((p.reject / p.terbit) * 100).toFixed(1)}%)` : ""}
                      </span>
                    ))}
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 920 }}>
                      <thead>
                        <tr style={{ background: "#F8FAFC" }}>
                          <th style={thStyle}>Tanggal</th>
                          <th style={thStyle}>PO / Model &amp; Nota</th>
                          <th style={thStyle}>Rincian Size</th>
                          <th style={{ ...thStyle, textAlign: "right" }}>Jumlah</th>
                          <th style={thStyle}>Asal (Tahap · Vendor)</th>
                          <th style={thStyle}>Alasan</th>
                          <th style={thStyle}>Status &amp; Record Pembayaran</th>
                          <th style={{ ...thStyle, textAlign: "center" }}>Nota / Invoice &amp; Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredReject.map((m) => {
                          const isLunas = m.status_klaim === "Lunas" || m.status_klaim === "Selesai";
                          return (
                            <tr key={m.id} className="gs-row" style={{ borderBottom: "1px solid #F1F5F9" }}>
                              <td style={{ ...tdStyle, fontSize: 12, color: "#475569", whiteSpace: "nowrap" }}>{formatTgl(m.tanggal, true)}</td>
                              <td style={tdStyle}>
                                <div style={{ fontWeight: 900, fontFamily: "monospace", fontSize: 12, color: "#1D4ED8" }}>{m.noPo}</div>
                                <div style={{ fontWeight: 700, color: "#334155" }}>{m.kategori}</div>
                                {m.no_nota && (
                                  <span style={{ display: "inline-block", marginTop: 3, fontSize: 10.5, fontWeight: 800, color: isLunas ? "#16A34A" : "#DC2626", background: isLunas ? "#F0FDF4" : "#FEF2F2", border: `1px solid ${isLunas ? "#BBF7D0" : "#FECACA"}`, padding: "1px 6px", borderRadius: 4 }}>
                                    Nota: {m.no_nota}
                                  </span>
                                )}
                              </td>
                              <td style={tdStyle}><SizeChips list={m.items} tone="#B91C1C" bg="#FEF2F2" border="#FECACA" /></td>
                              <td style={{ ...tdStyle, textAlign: "right", fontSize: 15, fontWeight: 900, color: "#B91C1C" }}>{fmt(m.jumlah)}</td>
                              <td style={{ ...tdStyle, fontSize: 12, fontWeight: 700, color: "#334155" }}>{m.sumber || "-"}</td>
                              <td style={{ ...tdStyle, fontSize: 12, color: "#64748B" }}>{m.keterangan || "-"}</td>
                              
                              {/* Kolom Status & Record Pembayaran */}
                              <td style={tdStyle}>
                                {isLunas ? (
                                  <div>
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#DCFCE7", color: "#166534", padding: "2px 7px", borderRadius: 5, fontWeight: 900, fontSize: 10.5 }}>
                                      ✓ LUNAS
                                    </span>
                                    <div style={{ fontWeight: 800, fontSize: 12, color: "#166534", marginTop: 2 }}>
                                      Rp {fmt(m.nominal_dibayar || m.total_klaim)}
                                    </div>
                                    <div style={{ fontSize: 10.5, color: "#475569" }}>
                                      {m.metode_pembayaran || "Tunai"} &bull; {formatTgl(m.tanggal_selesai)}
                                    </div>
                                    {m.catatan_penyelesaian && (
                                      <div style={{ fontSize: 10, color: "#64748B", marginTop: 1, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={m.catatan_penyelesaian}>
                                        Ref: {m.catatan_penyelesaian}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div>
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#FEF2F2", color: "#DC2626", padding: "2px 7px", borderRadius: 5, fontWeight: 900, fontSize: 10.5 }}>
                                      BELUM DIBAYAR
                                    </span>
                                    <div style={{ fontWeight: 800, fontSize: 12, color: "#DC2626", marginTop: 2 }}>
                                      Tagihan: Rp {fmt(m.total_klaim || 0)}
                                    </div>
                                    <div style={{ fontSize: 10.5, color: "#B45309" }}>
                                      {m.tindakan_klaim === "potong_tagihan" ? "Potong Tagihan" : m.tindakan_klaim === "ganti_barang" ? "Ganti Barang" : "Tunai / Transfer"}
                                    </div>
                                  </div>
                                )}
                              </td>

                              <td style={{ ...tdStyle, textAlign: "center" }}>
                                <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        const list = await fetch("/api/nota-reject?_t=" + Date.now()).then((r) => r.json());
                                        const found = (Array.isArray(list) ? list : []).find(
                                          (n: any) => n.no_nota === m.no_nota || String(n.id) === String(m.nota_id) || (m.transfer_id != null && String(n.transfer_id) === String(m.transfer_id))
                                        );
                                        if (found) {
                                          setNotaModal(found);
                                        } else {
                                          setNotaModal({
                                            id: m.nota_id || m.id,
                                            no_nota: m.no_nota || `REJ-${m.id}`,
                                            po_id: m.po_id,
                                            noPo: m.noPo,
                                            model: m.kategori,
                                            vendor_nama: m.sumber,
                                            pos_asal: m.tahap_slug,
                                            pos_tujuan: "Gudang & Stok",
                                            jumlah_reject: m.jumlah,
                                            rincian_reject: m.items,
                                            alasan_reject: m.keterangan,
                                            tanggal_klaim: m.tanggal,
                                            biaya_per_pcs: m.biaya_per_pcs || 0,
                                            total_klaim: m.total_klaim || 0,
                                            tindakan_klaim: m.tindakan_klaim || "potong_tagihan",
                                            status_klaim: m.status_klaim || "Diajukan",
                                            metode_pembayaran: m.metode_pembayaran || null,
                                            nominal_dibayar: m.nominal_dibayar || null,
                                            catatan_penyelesaian: m.catatan_penyelesaian || null,
                                            tanggal_selesai: m.tanggal_selesai || null,
                                          });
                                        }
                                      } catch {
                                        toast.error("Gagal memuat nota klaim");
                                      }
                                    }}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 5,
                                      padding: "5px 10px",
                                      borderRadius: 7,
                                      border: `1px solid ${isLunas ? "#86EFAC" : "#DC2626"}`,
                                      background: isLunas ? "#F0FDF4" : "#FEF2F2",
                                      color: isLunas ? "#166534" : "#DC2626",
                                      fontSize: 11,
                                      fontWeight: 800,
                                      cursor: "pointer",
                                      whiteSpace: "nowrap"
                                    }}
                                  >
                                    <FileText size={12} /> {isLunas ? "Cetak Invoice Lunas" : "Cetak / Lihat Nota"}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const confirmed = window.confirm(
                                        `Batalkan pengajuan reject untuk ${m.noPo || "PO ini"} (${m.jumlah} pcs)?\n\n` +
                                        `• Barang (${m.jumlah} pcs) akan DIKEMBALIKAN ke status pengerjaan vendor ${m.sumber || ""}.\n` +
                                        `• Tagihan klaim ganti rugi vendor akan dibatalkan/dihapus.\n` +
                                        `• Riwayat mutasi reject akan dibersihkan.`
                                      );
                                      if (!confirmed) return;
                                      try {
                                        const param = m.nota_id ? `id=${m.nota_id}` : m.no_nota ? `no_nota=${encodeURIComponent(m.no_nota)}` : `id=${m.id}`;
                                        const res = await fetch(`/api/nota-reject?${param}`, { method: "DELETE" });
                                        const d = await res.json();
                                        if (!res.ok) throw new Error(d.error || "Gagal membatalkan reject");
                                        toast.success(d.message || "Reject berhasil dibatalkan dan sisa barang dikembalikan ke vendor!");
                                        fetchData();
                                      } catch (err: any) {
                                        toast.error(err.message);
                                      }
                                    }}
                                    style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 9px", borderRadius: 7, border: "1px solid #CBD5E1", background: "#FFFFFF", color: "#64748B", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
                                    title="Batalkan pengajuan reject ini dan kembalikan barang ke vendor"
                                  >
                                    <RotateCcw size={11} /> Batalkan
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )
          ) : tab === "stok" ? (
            /* ── TAB: STOK BARANG JADI ──────────────────────────────── */
            filteredStock.length === 0 ? (
              <Empty icon={Boxes} title="Gudang masih kosong" desc="Terima barang dari tab Siap Masuk Gudang untuk mulai mencatat stok barang jadi." />
            ) : (
              <div style={{ background: "white", borderRadius: 18, border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
                    <thead>
                      <tr style={{ background: "#F8FAFC" }}>
                        <th style={thStyle}>Barang Jadi / SKU</th>
                        <th style={thStyle}>Stok per Size</th>
                        <th style={thStyle}>Asal Lot PO</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>Total</th>
                        <th style={thStyle}>Status</th>
                        <th style={thStyle}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStock.map((s) => {
                        const v = Number(s.stok_saat_ini || 0);
                        const [color, bg, label] = v <= 0 ? ["#DC2626", "#FEF2F2", "Habis"] : v < 20 ? ["#B45309", "#FEF3C7", "Hampir Habis"] : ["#047857", "#DCFCE7", "Aman"];
                        return (
                          <tr key={s.key} className="gs-row" style={{ borderBottom: "1px solid #F1F5F9" }}>
                            <td style={tdStyle}>
                              <div style={{ fontWeight: 900, color: "#0F172A" }}>{s.nama_barang}</div>
                              <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4, flexWrap: "wrap" }}>
                                {s.kode ? (
                                  <span style={{ fontSize: 11, fontWeight: 900, fontFamily: "monospace", color: "#7C3AED", background: "#F5F3FF", border: "1px solid #DDD6FE", padding: "1px 7px", borderRadius: 6 }}>{s.kode}</span>
                                ) : (
                                  <span style={{ fontSize: 10.5, fontWeight: 800, color: "#B45309", background: "#FFFBEB", padding: "1px 7px", borderRadius: 6 }}>Belum bernama</span>
                                )}
                                <span style={{ fontSize: 11, color: "#64748B" }}>{s.kategori}</span>
                              </div>
                              <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 3 }}>Masuk terakhir: {formatTgl(s.lastMasuk)}</div>
                            </td>
                            <td style={tdStyle}>
                              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                                {sortSizes(s.sizes.filter((x: SizeQty) => x.jumlah > 0)).map((x: any) => (
                                  <span key={x.size} title={x.sku || undefined} style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", color: "#1D4ED8", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 800 }}>
                                    {x.size}: {fmt(x.jumlah)}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td style={tdStyle}>
                              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                {(s.lots || []).map((l: any) => (
                                  <span key={l.po_id} style={{ fontSize: 11, fontWeight: 700, color: "#475569", background: "#F1F5F9", padding: "2px 7px", borderRadius: 6, fontFamily: "monospace" }}>{l.noPo} · {fmt(l.jumlah)}</span>
                                ))}
                              </div>
                            </td>
                            <td style={{ ...tdStyle, textAlign: "right", fontSize: 17, fontWeight: 900, color: v <= 0 ? "#DC2626" : "#0F172A" }}>{fmt(v)}</td>
                            <td style={tdStyle}><span style={{ background: bg, color, padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 800, whiteSpace: "nowrap" }}>{label}</span></td>
                            <td style={{ ...tdStyle, textAlign: "right" }}>
                              <div style={{ display: "inline-flex", gap: 6 }}>
                                {s.barang_id != null && v > 0 && (
                                  <Link href={`/cetak-label?barang=${s.barang_id}`} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 8, border: "1px solid #DDD6FE", background: "#F5F3FF", color: "#6D28D9", fontSize: 12, fontWeight: 800, textDecoration: "none", whiteSpace: "nowrap" }}>
                                    <Printer size={13} /> Label
                                  </Link>
                                )}
                                <button onClick={() => openKeluar(s)} disabled={v <= 0} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 8, border: "1px solid #FECACA", background: v <= 0 ? "#F8FAFC" : "#FEF2F2", color: v <= 0 ? "#CBD5E1" : "#B91C1C", fontSize: 12, fontWeight: 800, cursor: v <= 0 ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
                                  <ArrowUpFromLine size={13} /> Keluar
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          ) : (
            /* ── TAB: RIWAYAT ───────────────────────────────────────── */
            <div style={{ background: "white", borderRadius: 18, border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
              <div style={{ padding: "12px 18px", borderBottom: "1px solid #E2E8F0", display: "flex", gap: 6 }}>
                {(["semua", "masuk", "keluar", "reject"] as const).map((j) => (
                  <button key={j} onClick={() => setJenisFilter(j)} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12, fontWeight: 800, cursor: "pointer", textTransform: "capitalize", background: jenisFilter === j ? "#0F172A" : "white", color: jenisFilter === j ? "white" : "#475569" }}>{j}</button>
                ))}
              </div>
              {filteredMov.length === 0 ? (
                <div style={{ padding: 48, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>Belum ada pergerakan stok dicatat.</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
                    <thead>
                      <tr style={{ background: "#F8FAFC" }}>
                        <th style={thStyle}>Tanggal</th>
                        <th style={thStyle}>Jenis &amp; Kategori</th>
                        <th style={thStyle}>Rincian Size</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>Jumlah</th>
                        <th style={thStyle}>Sumber / Tujuan</th>
                        <th style={thStyle}>Keterangan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMov.map((m) => {
                        const isMasuk = m.jenis === "masuk";
                        const isReject = m.jenis === "reject";
                        const [jbg, jc, jl] = isMasuk ? ["#DCFCE7", "#047857", "Masuk"] : isReject ? ["#FFEDD5", "#C2410C", "Reject"] : ["#FEE2E2", "#B91C1C", "Keluar"];
                        return (
                          <tr key={m.id} className="gs-row" style={{ borderBottom: "1px solid #F1F5F9" }}>
                            <td style={{ ...tdStyle, fontSize: 12, color: "#475569", fontWeight: 600, whiteSpace: "nowrap" }}>{formatTgl(m.tanggal, true)}</td>
                            <td style={tdStyle}>
                              <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 6, background: jbg, color: jc, fontSize: 10, fontWeight: 900, textTransform: "uppercase", marginBottom: 4 }}>{jl}</span>
                              <div style={{ fontWeight: 800, color: "#1E293B" }}>{m.nama_barang || m.kategori}</div>
                              <div style={{ fontSize: 11, color: "#64748B", fontFamily: "monospace" }}>
                                {[m.kode, m.noPo].filter(Boolean).join(" · ")}
                              </div>
                              {isMasuk && m.barang_id != null && (
                                <Link href={`/cetak-label?mov=${m.id}`} style={{ fontSize: 11, fontWeight: 800, color: "#6D28D9", textDecoration: "underline" }}>Cetak label</Link>
                              )}
                            </td>
                            <td style={tdStyle}><SizeChips list={m.items} /></td>
                            <td style={{ ...tdStyle, textAlign: "right", fontSize: 15, fontWeight: 900, color: jc, whiteSpace: "nowrap" }} title={isReject ? "Tidak memengaruhi stok" : undefined}>{isMasuk ? "+" : isReject ? "×" : "-"}{fmt(m.jumlah)}</td>
                            <td style={{ ...tdStyle, fontSize: 12, color: "#334155", fontWeight: 700 }}>{m.sumber || "-"}</td>
                            <td style={{ ...tdStyle, fontSize: 12, color: "#64748B" }}>{m.keterangan || "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── MODAL TERIMA KE STOK ────────────────────────────────────── */}
      {terimaModal && (
        <div className="modal-overlay" onClick={() => !submitting && setTerimaModal(null)} style={{ zIndex: 1000 }}>
          <form className="modal-box" onClick={(e) => e.stopPropagation()} onSubmit={submitTerima} style={{ maxWidth: 640, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div>
                <h2 className="modal-title" style={{ margin: 0 }}>Terima ke Gudang &amp; Stok</h2>
                <div style={{ fontSize: 12, color: "#64748B", marginTop: 3 }}>
                  {terimaModal.noPo} · {terimaModal.model} — selesai {terimaModal.tahap} ({terimaModal.vendor_nama}) · sisa <b>{fmt(terimaModal.jumlah)}</b>{terimaModal.jumlah_awal > terimaModal.jumlah ? ` dari ${fmt(terimaModal.jumlah_awal)}` : ""} pcs
                </div>
              </div>
              <button type="button" onClick={() => setTerimaModal(null)} style={{ border: "none", background: "#F1F5F9", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={16} /></button>
            </div>

            {printReady ? (
              /* ── Sukses: tawarkan cetak label ── */
              <div style={{ textAlign: "center", padding: "18px 6px 6px" }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#DCFCE7", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}><CheckCheck size={28} /></div>
                <div style={{ fontSize: 16, fontWeight: 900, color: "#0F172A" }}>{fmt(printReady.total)} pcs tersimpan di Gudang &amp; Stok</div>
                {(printReady.reject > 0 || printReady.sisa > 0) && (
                  <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 8, flexWrap: "wrap" }}>
                    {printReady.reject > 0 && <span style={{ fontSize: 12, fontWeight: 800, color: "#B91C1C", background: "#FEF2F2", padding: "3px 10px", borderRadius: 8 }}>{fmt(printReady.reject)} pcs dicatat reject</span>}
                    {printReady.sisa > 0 && <span style={{ fontSize: 12, fontWeight: 800, color: "#B45309", background: "#FFFBEB", padding: "3px 10px", borderRadius: 8 }}>Sisa {fmt(printReady.sisa)} pcs tetap di antrean</span>}
                  </div>
                )}
                {printReady.ids.length > 0 && <div style={{ fontSize: 12.5, color: "#64748B", marginTop: 6 }}>Kode SKU per size sudah dibuat. Cetak label barcode untuk ditempel di hangtag.</div>}
                <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 18 }}>
                  <button type="button" onClick={() => setTerimaModal(null)} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid #E2E8F0", background: "white", color: "#334155", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>{printReady.ids.length > 0 ? "Nanti Saja" : "Tutup"}</button>
                  {printReady.ids.length > 0 && (
                    <Link href={`/cetak-label?mov=${printReady.ids.join(",")}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 10, background: "linear-gradient(135deg,#7C3AED,#6D28D9)", color: "white", fontSize: 13, fontWeight: 800, textDecoration: "none", boxShadow: "0 3px 10px rgba(124,58,237,0.3)" }}>
                      <Printer size={15} /> Cetak Label Barcode
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 12, color: "#475569", background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 10, padding: "8px 12px", marginBottom: 12, lineHeight: 1.5 }}>
                  <b>Beri nama barang jadi.</b> Pilih barang yang sudah ada (stok bertambah di SKU yang sama) atau buat nama baru — kode SKU per size dibuat otomatis (contoh <span style={{ fontFamily: "monospace", fontWeight: 800 }}>{data?.prefix || "BRG"}-0001-XS</span>).
                </div>

                {(() => {
                  const linked = barangDariPo(terimaModal.po_id);
                  if (!linked) return null;
                  return (
                    <div style={{ fontSize: 12, color: "#065F46", background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 10, padding: "8px 12px", marginBottom: 12, lineHeight: 1.5, display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <CheckCircle2 size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                      <div>
                        <b>Setoran susulan {terimaModal.noPo}</b> — PO ini sudah punya barang jadi <b>{linked.kode ? `${linked.kode} · ` : ""}{linked.nama_barang}</b>. Otomatis dipilih <b>Barang Lama</b>, jadi stok &amp; barcode pcs ini langsung menyambung ke SKU yang sama di Data Barang.
                      </div>
                    </div>
                  );
                })()}

                {terimaForm.alokasi.map((a, i) => {
                  const subtotal = sumQty(a.items);
                  return (
                    <div key={i} style={{ border: "1px solid #E2E8F0", borderRadius: 12, padding: 12, marginBottom: 10, background: "#FCFCFD" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 900, color: "#0F172A" }}>Barang #{i + 1}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ display: "flex", background: "#F1F5F9", borderRadius: 8, padding: 2 }}>
                            {(["baru", "lama"] as const).map((mode) => (
                              <button key={mode} type="button" onClick={() => updateAlokasi(i, { mode })} style={{ padding: "4px 10px", borderRadius: 6, border: "none", fontSize: 11, fontWeight: 800, cursor: "pointer", background: a.mode === mode ? "#0F172A" : "transparent", color: a.mode === mode ? "white" : "#475569" }}>
                                {mode === "baru" ? "Nama Baru" : "Barang Lama"}
                              </button>
                            ))}
                          </div>
                          {terimaForm.alokasi.length > 1 && (
                            <button type="button" onClick={() => setTerimaForm((f) => ({ ...f, alokasi: f.alokasi.filter((_, j) => j !== i) }))} style={{ border: "none", background: "#FEE2E2", color: "#B91C1C", borderRadius: 6, width: 26, height: 26, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={13} /></button>
                          )}
                        </div>
                      </div>

                      {a.mode === "baru" ? (
                        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8, marginBottom: 10 }}>
                          <input className="gs-input" placeholder={`Nama barang jadi, mis. ${terimaModal.model} Biru Wash`} value={a.nama_baru} onChange={(e) => updateAlokasi(i, { nama_baru: e.target.value })} />
                          <input className="gs-input" type="number" min={0} placeholder="Harga jual (opsional)" value={a.harga_jual} onChange={(e) => updateAlokasi(i, { harga_jual: e.target.value })} />
                        </div>
                      ) : (
                        <select className="gs-input" style={{ marginBottom: 10 }} value={a.barang_id} onChange={(e) => updateAlokasi(i, { barang_id: e.target.value })}>
                          <option value="">— Pilih barang —</option>
                          {barangList.map((b: any) => (
                            <option key={b.id} value={b.id}>{b.kode ? `${b.kode} · ` : ""}{b.nama_barang}{b.kategori ? ` (${b.kategori})` : ""}</option>
                          ))}
                        </select>
                      )}

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 6 }}>
                        {a.items.map((it) => {
                          const sisa = (maxBySize[it.size] || 0) - (usedBySize[it.size] || 0);
                          const over = sisa < 0;
                          return (
                            <label key={it.size} style={{ background: "white", border: `1px solid ${over ? "#FCA5A5" : "#E2E8F0"}`, borderRadius: 9, padding: "6px 8px" }}>
                              <div style={{ fontSize: 11, fontWeight: 900, color: "#0F172A", display: "flex", justifyContent: "space-between" }}>
                                <span>{it.size}</span>
                                <span style={{ color: over ? "#DC2626" : "#94A3B8", fontWeight: 700 }}>sisa {sisa}</span>
                              </div>
                              <input
                                type="number"
                                min={0}
                                placeholder="0"
                                className="gs-input"
                                style={{ marginTop: 3, padding: "6px 8px" }}
                                value={it.jumlah === 0 ? "" : it.jumlah}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => updateAlokasiQty(i, it.size, e.target.value === "" ? 0 : Math.max(0, Number(e.target.value) || 0))}
                              />
                            </label>
                          );
                        })}
                      </div>
                      <div style={{ fontSize: 11.5, color: "#475569", marginTop: 6, textAlign: "right" }}>Subtotal: <b>{fmt(subtotal)} pcs</b></div>
                    </div>
                  );
                })}

                <button type="button" onClick={() => setTerimaForm((f) => ({ ...f, alokasi: [...f.alokasi, newAlokasi(terimaModal, false)] }))} style={{ width: "100%", padding: "9px", borderRadius: 10, border: "1px dashed #A78BFA", background: "#FAF5FF", color: "#6D28D9", fontSize: 12.5, fontWeight: 800, cursor: "pointer", marginBottom: 12 }}>
                  + Pecah ke barang lain (beda warna / wash)
                </button>

                {/* Reject per size & Konsep Klaim Vendor Lengkap */}
                {(() => {
                  const totalRejInput = sumQty(terimaForm.reject);
                  const totalMasukCurr = terimaForm.alokasi.reduce((s, a) => s + sumQty(a.items), 0);
                  const sisaCurr = Math.max(0, terimaModal.jumlah - totalMasukCurr - totalRejInput);
                  const hasReject = totalRejInput > 0 || (sisaCurr > 0 && terimaForm.sisa_mode === "reject");
                  const effectiveRej = totalRejInput + (terimaForm.sisa_mode === "reject" ? sisaCurr : 0);

                  const currentPo = (data?.po_list || []).find((p: any) => String(p.id) === String(terimaModal.po_id));
                  const cmtVendor = currentPo?.vendorId ? (data?.vendors || []).find((v: any) => String(v.id) === String(currentPo.vendorId)) : null;
                  const currentVendor = terimaModal.vendor_id ? (data?.vendors || []).find((v: any) => String(v.id) === String(terimaModal.vendor_id)) : null;

                  return (
                    <div style={{ border: `1.5px solid ${hasReject ? "#F87171" : "#FECACA"}`, borderRadius: 12, padding: 12, marginBottom: 12, background: hasReject ? "#FFF5F5" : "#FFFBFB" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 900, color: "#B91C1C", display: "flex", alignItems: "center", gap: 6 }}>
                          <Ban size={13} /> Barang Reject (tidak masuk stok)
                        </div>
                        <span style={{ fontSize: 10.5, color: "#991B1B", fontWeight: 700, background: "#FEE2E2", border: "1px solid #FCA5A5", padding: "2px 8px", borderRadius: 6 }}>
                          🛡️ Otomatis potong stok barang jadi &amp; terbit Nota Klaim
                        </span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 6 }}>
                        {terimaForm.reject.map((it) => (
                          <label key={it.size} style={{ background: "white", border: "1px solid #FECACA", borderRadius: 9, padding: "6px 8px" }}>
                            <div style={{ fontSize: 11, fontWeight: 900, color: "#7F1D1D" }}>{it.size}</div>
                            <input
                              type="number"
                              min={0}
                              placeholder="0"
                              className="gs-input"
                              style={{ marginTop: 3, padding: "6px 8px", color: it.jumlah > 0 ? "#DC2626" : "#64748B", fontWeight: 800 }}
                              value={it.jumlah === 0 ? "" : it.jumlah}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => updateRejectQty(it.size, e.target.value === "" ? 0 : Math.max(0, Number(e.target.value) || 0))}
                            />
                          </label>
                        ))}
                      </div>

                      {hasReject && (
                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed #FCA5A5", display: "flex", flexDirection: "column", gap: 10 }}>
                          {/* 1. Pilih Vendor Penanggung Jawab */}
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 800, color: "#7F1D1D", display: "block", marginBottom: 4 }}>
                              Vendor Bertanggung Jawab (Dibebankan Tagihan Klaim)
                            </label>
                            <select
                              value={terimaForm.reject_vendor_id}
                              onChange={(e) => {
                                const vid = e.target.value;
                                const vn = (data?.vendors || []).find((v: any) => String(v.id) === vid);
                                setTerimaForm((f) => ({
                                  ...f,
                                  reject_vendor_id: vid,
                                  biaya_per_pcs: vn?.tarif ? Number(vn.tarif) : f.biaya_per_pcs,
                                }));
                              }}
                              className="gs-input"
                              style={{ fontWeight: 700, fontSize: 12.5 }}
                            >
                              {currentVendor && (
                                <option value={String(currentVendor.id)}>
                                  {currentVendor.nama} (Pos Pengirim: {terimaModal.vendor_nama || "Vendor Terakhir"})
                                </option>
                              )}
                              {cmtVendor && String(cmtVendor.id) !== String(currentVendor?.id) && (
                                <option value={String(cmtVendor.id)}>
                                  {cmtVendor.nama} (Vendor CMT / Penjahit PO ini)
                                </option>
                              )}
                              <optgroup label="Pilih Vendor Lainnya">
                                {(data?.vendors || [])
                                  .filter((vn: any) => String(vn.id) !== String(currentVendor?.id) && String(vn.id) !== String(cmtVendor?.id))
                                  .map((vn: any) => (
                                    <option key={vn.id} value={String(vn.id)}>
                                      {vn.nama} ({vn.tipe || "Vendor"})
                                    </option>
                                  ))}
                              </optgroup>
                            </select>
                            <div style={{ fontSize: 10.5, color: "#64748B", marginTop: 3 }}>
                              💡 <em>Tips:</em> Jika barang diterima dari <strong>{terimaModal.vendor_nama || "vendor ini"}</strong> tapi reject akibat cacat jahit/pola, alihkan klaim ke <strong>Vendor CMT / Penjahit</strong>.
                            </div>
                          </div>

                          {/* 2. Alasan Kerusakan & Estimasi Biaya Ganti Rugi */}
                          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 8 }}>
                            <div>
                              <label style={{ fontSize: 11, fontWeight: 800, color: "#7F1D1D", display: "block", marginBottom: 3 }}>
                                Kategori Kerusakan / Reject
                              </label>
                              <select
                                value={terimaForm.alasan_reject}
                                onChange={(e) => setTerimaForm((f) => ({ ...f, alasan_reject: e.target.value }))}
                                className="gs-input"
                                style={{ fontSize: 12, padding: "6px 8px" }}
                              >
                                <optgroup label="⚠️ Kerusakan Fisik & Noda">
                                  <option value="Ada Noda Membandel dan bekas sobek cacat">Ada Noda Membandel dan bekas sobek cacat</option>
                                  <option value="Kain bolong / tersayat benda tajam">Kain bolong / tersayat benda tajam</option>
                                  <option value="Cacat bahan kain bawaan (bolong / cacat tenun)">Cacat bahan kain bawaan (bolong / cacat tenun)</option>
                                </optgroup>
                                <optgroup label="🧵 Pos CMT / Jahit">
                                  <option value="Cacat jahitan / obras lepas / loncat">Cacat jahitan / obras lepas / loncat</option>
                                  <option value="Cacat ukuran / pola tidak sesuai SPK">Cacat ukuran / pola tidak sesuai SPK</option>
                                  <option value="Saku / variasi miring / salah pasang">Saku / variasi miring / salah pasang</option>
                                </optgroup>
                                <optgroup label="🧺 Pos Washing / Laundry">
                                  <option value="Cacat washing / noda cucian / warna belang">Cacat washing / noda cucian / warna belang</option>
                                  <option value="Kain rapuh / sobek berlebih efek stone wash">Kain rapuh / sobek berlebih efek stone wash</option>
                                  <option value="Resleting / kancing rusak saat washing">Resleting / kancing rusak saat washing</option>
                                </optgroup>
                                <optgroup label="✂️ Pos Bersih Benang">
                                  <option value="Kain tersayat / tergunting saat potong benang">Kain tersayat / tergunting saat potong benang</option>
                                  <option value="Noda oli / kotoran saat buang benang">Noda oli / kotoran saat buang benang</option>
                                </optgroup>
                                <optgroup label="📦 Pos Finishing & Packing">
                                  <option value="Cacat kancing / rivet robek / salah pasang">Cacat kancing / rivet robek / salah pasang</option>
                                  <option value="Kain mengkilap / gosong bekas setrika">Kain mengkilap / gosong bekas setrika</option>
                                </optgroup>
                                <optgroup label="Lainnya">
                                  <option value="Lainnya (Ketik detail di bawah)">Lainnya (Ketik detail di bawah)</option>
                                </optgroup>
                              </select>
                            </div>

                            <div>
                              <label style={{ fontSize: 11, fontWeight: 800, color: "#7F1D1D", display: "block", marginBottom: 3 }}>
                                Estimasi Ganti Rugi / Pcs (Rp)
                              </label>
                              <input
                                type="number"
                                min={0}
                                step={1000}
                                placeholder="0"
                                className="gs-input"
                                style={{ padding: "6px 8px", fontSize: 12, fontWeight: 800, color: "#DC2626" }}
                                value={terimaForm.biaya_per_pcs === 0 ? "" : terimaForm.biaya_per_pcs}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => setTerimaForm((f) => ({ ...f, biaya_per_pcs: e.target.value === "" ? 0 : Math.max(0, Number(e.target.value) || 0) }))}
                              />
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 4 }}>
                                {[
                                  { label: "Cuci", val: 20000 },
                                  { label: "Jahit", val: 35000 },
                                  { label: "Kain", val: 45000 },
                                  { label: "Full", val: 75000 },
                                ].map((pill) => (
                                  <button
                                    key={pill.label}
                                    type="button"
                                    onClick={() => setTerimaForm((f) => ({ ...f, biaya_per_pcs: pill.val }))}
                                    style={{
                                      border: terimaForm.biaya_per_pcs === pill.val ? "1px solid #DC2626" : "1px solid #FECACA",
                                      background: terimaForm.biaya_per_pcs === pill.val ? "#FEE2E2" : "#FFFFFF",
                                      color: terimaForm.biaya_per_pcs === pill.val ? "#991B1B" : "#7F1D1D",
                                      borderRadius: 5,
                                      padding: "1px 5px",
                                      fontSize: 9.5,
                                      fontWeight: 800,
                                      cursor: "pointer",
                                    }}
                                  >
                                    {pill.label} ({pill.val / 1000}k)
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Catatan alasan kustom jika diperlukan */}
                          <input
                            className="gs-input"
                            style={{ fontSize: 12, fontWeight: 500 }}
                            placeholder="Detail keterangan / catatan kerusakan barang reject..."
                            value={terimaForm.alasan_reject}
                            onChange={(e) => setTerimaForm((f) => ({ ...f, alasan_reject: e.target.value }))}
                          />

                          {/* 3. Tindakan Klaim & Total Nilai Tagihan */}
                          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 8, alignItems: "center" }}>
                            <div>
                              <label style={{ fontSize: 11, fontWeight: 800, color: "#7F1D1D", display: "block", marginBottom: 3 }}>
                                Tindakan Klaim
                              </label>
                              <select
                                value={terimaForm.tindakan_klaim}
                                onChange={(e) => setTerimaForm((f) => ({ ...f, tindakan_klaim: e.target.value }))}
                                className="gs-input"
                                style={{ padding: "6px 8px", fontSize: 12 }}
                              >
                                <option value="potong_tagihan">Potong dari Tagihan / Ongkos Vendor</option>
                                <option value="ganti_barang">Vendor Wajib Ganti Barang Baru</option>
                                <option value="bayar_tunai">Klaim Ganti Rugi Tunai / Transfer</option>
                              </select>
                            </div>

                            <div style={{ background: "#FEF2F2", border: "1.5px dashed #F87171", borderRadius: 8, padding: "6px 10px", textAlign: "right" }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: "#991B1B" }}>
                                Total Tagihan Klaim ({effectiveRej} pcs):
                              </div>
                              <div style={{ fontSize: 16, fontWeight: 900, color: "#DC2626" }}>
                                Rp {fmt(effectiveRej * Number(terimaForm.biaya_per_pcs || 0))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <textarea className="gs-input" rows={2} placeholder="Catatan (opsional)" value={terimaForm.catatan} onChange={(e) => setTerimaForm((f) => ({ ...f, catatan: e.target.value }))} style={{ fontWeight: 500, resize: "vertical" }} />
                {(() => {
                  const totalMasuk = terimaForm.alokasi.reduce((s, a) => s + sumQty(a.items), 0);
                  const totalRej = sumQty(terimaForm.reject);
                  const sisa = Math.max(0, terimaModal.jumlah - totalMasuk - totalRej);
                  return (
                    <>
                      {sisa > 0 && (
                        <div style={{ marginTop: 12, border: "1px solid #FDE68A", background: "#FFFBEB", borderRadius: 10, padding: "10px 12px" }}>
                          <div style={{ fontSize: 12.5, fontWeight: 800, color: "#92400E", marginBottom: 6 }}>Masih ada sisa {fmt(sisa)} pcs — mau diapakan?</div>
                          {([
                            ["tetap", "Tetap di antrean (diterima menyusul / setelah dicek)"],
                            ["reject", "Anggap reject semua (dicatat ke Barang Reject)"],
                          ] as const).map(([v, label]) => (
                            <label key={v} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#334155", fontWeight: 600, cursor: "pointer", padding: "2px 0" }}>
                              <input type="radio" name="sisa_mode" checked={terimaForm.sisa_mode === v} onChange={() => setTerimaForm((f) => ({ ...f, sisa_mode: v }))} /> {label}
                            </label>
                          ))}
                        </div>
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, gap: 10, flexWrap: "wrap" }}>
                        <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>
                          Masuk stok: <b style={{ color: "#059669", fontSize: 16 }}>{fmt(totalMasuk)}</b> / {fmt(terimaModal.jumlah)} pcs
                          {(totalRej > 0 || (sisa > 0 && terimaForm.sisa_mode === "reject")) && (
                            <span style={{ color: "#B91C1C", fontWeight: 700 }}> · reject {fmt(totalRej + (terimaForm.sisa_mode === "reject" ? sisa : 0))}</span>
                          )}
                          {sisa > 0 && terimaForm.sisa_mode === "tetap" && <span style={{ color: "#B45309", fontWeight: 700 }}> · sisa {fmt(sisa)} menyusul</span>}
                        </div>
                        <button type="submit" disabled={submitting} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#059669,#047857)", color: "white", fontSize: 13, fontWeight: 800, cursor: "pointer", opacity: submitting ? 0.7 : 1 }}>
                          <CheckCheck size={15} /> {submitting ? "Menyimpan..." : totalMasuk > 0 ? "Simpan & Buat SKU" : "Simpan Reject"}
                        </button>
                      </div>
                    </>
                  );
                })()}
              </>
            )}
          </form>
        </div>
      )}

      {/* ── MODAL TUTUP SISA VENDOR → REJECT ──────────────────────── */}
      {rejectModal && (
        <div className="modal-overlay" onClick={() => !submitting && setRejectModal(null)} style={{ zIndex: 1000 }}>
          <form className="modal-box" onClick={(e) => e.stopPropagation()} onSubmit={submitRejectVendor} style={{ maxWidth: 520 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div>
                <h2 className="modal-title" style={{ margin: 0 }}>Tutup Sisa di Vendor → Reject</h2>
                <div style={{ fontSize: 12, color: "#64748B", marginTop: 3 }}>
                  {rejectModal.noPo} · {rejectModal.tahap} · {rejectModal.vendor_nama} — sisa {fmt(rejectModal.sisa)} pcs
                  {rejectModal.pending > 0 ? ` (${fmt(rejectModal.pending)} pcs menunggu ACC tidak bisa di-reject)` : ""}
                </div>
              </div>
              <button type="button" onClick={() => setRejectModal(null)} style={{ border: "none", background: "#F1F5F9", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={16} /></button>
            </div>
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "12px 14px", marginBottom: 14, display: "flex", flexDirection: "column", gap: 7 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ background: "#DC2626", color: "white", padding: "2px 7px", borderRadius: 5, fontSize: 10.5, fontWeight: 900, textTransform: "uppercase" }}>
                  Aksi: Tutup Sisa → Reject
                </span>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#991B1B" }}>
                  Barang Rusak Fatal / Cacat Parah / Hilang di Vendor
                </span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11.5, color: "#991B1B", display: "flex", flexDirection: "column", gap: 3, lineHeight: 1.4 }}>
                <li>
                  <strong>Tujuan:</strong> Digunakan <u>HANYA</u> jika sisa barang <strong>rusak permanen</strong> (sobek, bolong, terbakar, luntur) atau <strong>hilang</strong> sehingga tidak bisa disetor lagi.
                </li>
                <li>
                  <strong>Dampak Sistem:</strong> Pcs ini <strong>dihapus dari antrean produksi</strong>, masuk ke <em>Gudang Reject</em>, dan otomatis diterbitkan <strong>Nota Klaim Ganti Rugi (REJ-...)</strong> untuk memotong tagihan vendor.
                </li>
                <li>
                  <strong>Bukan untuk Barang Mau Diperbaiki / Dialihkan:</strong> Jika barang masih bisa diperbaiki (re-wash / rework) atau ingin dikerjakan vendor lain, <strong>JANGAN di-reject</strong>! Buka menu <em>Gudang Produksi</em> lalu gunakan tombol <strong>Tarik ke Gudang</strong> agar stok tetap utuh.
                </li>
              </ul>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
              <button type="button" onClick={() => setRejectForm((f) => ({ ...f, items: f.items.map((i) => ({ ...i, jumlah: i.max })) }))} style={{ fontSize: 11.5, fontWeight: 800, color: "#B91C1C", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Isi semua sisa</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8, marginBottom: 12 }}>
              {rejectForm.items.map((it, i) => (
                <label key={it.size} style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, padding: "8px 10px" }}>
                  <div style={{ fontSize: 11, fontWeight: 900, color: "#0F172A", display: "flex", justifyContent: "space-between" }}><span>{it.size}</span><span style={{ color: "#94A3B8", fontWeight: 700 }}>maks {it.max}</span></div>
                  <input
                    type="number"
                    min={0}
                    max={it.max}
                    placeholder="0"
                    className="gs-input"
                    style={{ marginTop: 4 }}
                    value={it.jumlah === 0 ? "" : it.jumlah}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setRejectForm((f) => ({ ...f, items: f.items.map((x, j) => (j === i ? { ...x, jumlah: e.target.value === "" ? 0 : Math.max(0, Number(e.target.value) || 0) } : x)) }))}
                  />
                </label>
              ))}
            </div>
            <input className="gs-input" style={{ fontWeight: 500 }} placeholder="Alasan, mis. sobek saat washing / hilang di vendor" value={rejectForm.alasan} onChange={(e) => setRejectForm((f) => ({ ...f, alasan: e.target.value }))} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 800, color: "#475569", display: "block", marginBottom: 4 }}>Biaya Klaim / pcs (Rp)</label>
                <input
                  type="number"
                  min={0}
                  className="gs-input"
                  placeholder="Misal 5000"
                  value={rejectForm.biaya_per_pcs || ""}
                  onChange={(e) => setRejectForm((f) => ({ ...f, biaya_per_pcs: Math.max(0, Number(e.target.value) || 0) }))}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 800, color: "#475569", display: "block", marginBottom: 4 }}>Tindakan Klaim</label>
                <select
                  className="gs-input"
                  value={rejectForm.tindakan_klaim || "potong_tagihan"}
                  onChange={(e) => setRejectForm((f) => ({ ...f, tindakan_klaim: e.target.value }))}
                >
                  <option value="potong_tagihan">Potong Tagihan Vendor</option>
                  <option value="ganti_barang">Vendor Ganti Barang</option>
                  <option value="bayar_tunai">Ganti Rugi Tunai</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
              <div style={{ fontSize: 12.5, color: "#475569" }}>
                Total reject: <b style={{ color: "#B91C1C", fontSize: 16 }}>{fmt(sumQty(rejectForm.items))}</b> pcs
                {rejectForm.biaya_per_pcs > 0 && (
                  <span style={{ marginLeft: 6, color: "#92400E", fontWeight: 700 }}>
                    (Klaim: Rp {fmt(sumQty(rejectForm.items) * rejectForm.biaya_per_pcs)})
                  </span>
                )}
              </div>
              <button type="submit" disabled={submitting} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#DC2626,#B91C1C)", color: "white", fontSize: 13, fontWeight: 800, cursor: "pointer", opacity: submitting ? 0.7 : 1 }}>
                <Ban size={15} /> {submitting ? "Menyimpan..." : "Catat Reject & Terbitkan Nota"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── MODAL BARANG KELUAR ─────────────────────────────────────── */}
      {keluarModal && (
        <div className="modal-overlay" onClick={() => !submitting && setKeluarModal(null)} style={{ zIndex: 1000 }}>
          <form className="modal-box" onClick={(e) => e.stopPropagation()} onSubmit={submitKeluar} style={{ maxWidth: 520 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div>
                <h2 className="modal-title" style={{ margin: 0 }}>Barang Keluar</h2>
                <div style={{ fontSize: 12, color: "#64748B", marginTop: 3 }}>{keluarModal.nama_barang}{keluarModal.kode ? ` (${keluarModal.kode})` : ""} — stok {fmt(keluarModal.stok_saat_ini)} pcs</div>
              </div>
              <button type="button" onClick={() => setKeluarModal(null)} style={{ border: "none", background: "#F1F5F9", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={16} /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 6, marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 800, color: "#475569" }}>Tujuan</label>
              <select className="gs-input" value={keluarForm.tujuan} onChange={(e) => setKeluarForm((f) => ({ ...f, tujuan: e.target.value }))}>
                {TUJUAN_KELUAR.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 8 }}>Jumlah keluar per size</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8, marginBottom: 12 }}>
              {keluarForm.items.map((it, i) => (
                <label key={it.size} style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, padding: "8px 10px" }}>
                  <div style={{ fontSize: 11, fontWeight: 900, color: "#0F172A", display: "flex", justifyContent: "space-between" }}><span>{it.size}</span><span style={{ color: "#94A3B8", fontWeight: 700 }}>stok {it.max}</span></div>
                  <input
                    type="number"
                    min={0}
                    max={it.max}
                    placeholder="0"
                    className="gs-input"
                    style={{ marginTop: 4 }}
                    value={it.jumlah === 0 ? "" : it.jumlah}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setKeluarForm((f) => ({ ...f, items: f.items.map((x, j) => (j === i ? { ...x, jumlah: e.target.value === "" ? 0 : Math.max(0, Number(e.target.value) || 0) } : x)) }))}
                  />
                </label>
              ))}
            </div>
            <textarea className="gs-input" rows={2} placeholder="Keterangan (no nota, nama pelanggan, dll)" value={keluarForm.keterangan} onChange={(e) => setKeluarForm((f) => ({ ...f, keterangan: e.target.value }))} style={{ fontWeight: 500, resize: "vertical" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
              <div style={{ fontSize: 13, color: "#475569" }}>Total keluar: <b style={{ color: "#DC2626", fontSize: 16 }}>{fmt(sumQty(keluarForm.items))}</b> pcs</div>
              <button type="submit" disabled={submitting} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#DC2626,#B91C1C)", color: "white", fontSize: 13, fontWeight: 800, cursor: "pointer", opacity: submitting ? 0.7 : 1 }}>
                <ArrowUpFromLine size={15} /> {submitting ? "Menyimpan..." : "Catat Keluar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── MODAL INVOICE NOTA REJECT RESMI ────────────────────────── */}
      <NotaRejectModal
        nota={notaModal}
        onClose={() => setNotaModal(null)}
        onSettled={() => fetchData()}
        onCancelReject={() => {
          setNotaModal(null);
          fetchData();
        }}
      />
    </>
  );
}
