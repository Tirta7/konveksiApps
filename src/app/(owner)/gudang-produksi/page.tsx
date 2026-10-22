"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { transferStatusInfo } from "@/lib/transfer-status";
import {
  Warehouse,
  Send,
  CheckCheck,
  ChevronRight,
  RefreshCw,
  Package,
  AlertTriangle,
  Truck,
  Search,
  Clock,
  X,
  ArrowDownToLine,
  History,
  Inbox,
  MessageCircle,
  Workflow,
  Calendar,
  Printer,
  FileText,
  AlertOctagon,
  CheckCircle2,
  DollarSign,
  Check,
  Download,
  Share2,
  Layers,
  UserCheck,
  Scissors,
  Shirt,
  Sparkles,
  PackagePlus,
  RotateCcw,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import NotaRejectModal from "@/components/NotaRejectModal";

// ─── Helpers ────────────────────────────────────────────────────────────
const normalizeStage = (slug?: string) => {
  const s = (slug || "").toLowerCase();
  if (s.includes("wash") || s.includes("cuci")) return "washing";
  if (s.includes("jahit") || s.includes("cmt")) return "cmt";
  if (s.includes("potong")) return "potong";
  if (s.includes("benang")) return "bersih_benang";
  if (s.includes("qc") || s.includes("gudang")) return "gudang";
  if (s.includes("pack") || s.includes("finishing")) return "finishing";
  return s;
};

const FALLBACK_LABEL: Record<string, string> = {
  cmt: "Penjahit (CMT)",
  gudang: "Gudang Produksi",
  washing: "Washing",
  bersih_benang: "Bersih Benang",
  finishing: "Packing / Finishing",
  potong: "Potong",
  siap_jual: "Siap Jual"
};
const FALLBACK_COLOR: Record<string, string> = {
  cmt: "#EF4444",
  gudang: "#6366F1",
  washing: "#F59E0B",
  bersih_benang: "#059669",
  finishing: "#8B5CF6",
  potong: "#3B82F6"
};

const sumQty = (arr?: any[]) => (arr || []).reduce((s, x) => s + Number(x?.jumlah || 0), 0);

function fmtDate(str?: string) {
  if (!str) return "-";
  return new Date(str).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}
function daysSince(str?: string) {
  if (!str) return 0;
  const d = new Date(str); d.setHours(0, 0, 0, 0);
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((t.getTime() - d.getTime()) / 86400000));
}
function daysLate(target?: string) {
  if (!target) return 0;
  const d = new Date(target); d.setHours(0, 0, 0, 0);
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((t.getTime() - d.getTime()) / 86400000));
}
function waLink(phone?: string, text = "") {
  if (!phone) return "";
  let c = String(phone).replace(/[^0-9]/g, "");
  if (c.startsWith("0")) c = "62" + c.slice(1);
  else if (c.startsWith("8")) c = "62" + c;
  return `https://wa.me/${c}?text=${encodeURIComponent(text)}`;
}

type TabKey = "masuk" | "stok" | "vendor" | "nota" | "riwayat";

export default function GudangProduksiPage() {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [poList, setPoList] = useState<any[]>([]);
  const [notaList, setNotaList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("masuk");
  const [search, setSearch] = useState("");

  const [terimaModal, setTerimaModal] = useState<any | null>(null);
  const [terimaForm, setTerimaForm] = useState<{ sizeBreakdown: any[]; catatan: string }>({ sizeBreakdown: [], catatan: "" });
  const [klaimForm, setKlaimForm] = useState<{ buatNota: boolean; vendor_id: string; alasan_reject: string; biaya_per_pcs: number; tindakan_klaim: string }>({
    buatNota: true,
    vendor_id: "",
    alasan_reject: "Cacat jahitan / obras lepas / loncat",
    biaya_per_pcs: 25000,
    tindakan_klaim: "potong_tagihan"
  });
  const [notaModal, setNotaModal] = useState<any | null>(null);
  const [poDetailData, setPoDetailData] = useState<any | null>(null);
  const [loadingPoDetail, setLoadingPoDetail] = useState(false);
  const [surplusTindakan, setSurplusTindakan] = useState<"terima_semua" | "retur_kelebihan">("terima_semua");
  const [selisihMode, setSelisihMode] = useState<"retur_perbaikan" | "reject_permanen">("retur_perbaikan");
  const [returForm, setReturForm] = useState<{
    alasan: string;
    vendor_id: string;
    catatan: string;
  }>({
    alasan: "Cacat ringan / perlu dikerjakan ulang",
    vendor_id: "",
    catatan: ""
  });

  const [kirimModal, setKirimModal] = useState<any | null>(null);
  const [kirimForm, setKirimForm] = useState<{ ke: string; vendor_id: string; target_selesai: string; catatan: string; sizeBreakdown: any[] }>({ ke: "", vendor_id: "", target_selesai: "", catatan: "", sizeBreakdown: [] });
  const [tarikModal, setTarikModal] = useState<any | null>(null);
  const [tarikForm, setTarikForm] = useState<{ sizeBreakdown: any[]; catatan: string }>({ sizeBreakdown: [], catatan: "" });
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async (silent = true) => {
    if (!silent) setRefreshing(true);
    try {
      const [t, v, s, p, nr] = await Promise.all([
        fetch("/api/produksi-transfer?_t=" + Date.now()).then(r => r.json()).catch(() => []),
        fetch("/api/vendors?_t=" + Date.now()).then(r => r.json()).catch(() => []),
        fetch("/api/pipeline-stages?_t=" + Date.now()).then(r => r.json()).catch(() => []),
        fetch("/api/po-produksi?_t=" + Date.now()).then(r => r.json()).catch(() => []),
        fetch("/api/nota-reject?_t=" + Date.now()).then(r => r.json()).catch(() => [])
      ]);
      setTransfers(Array.isArray(t) ? t : []);
      setVendors(Array.isArray(v) ? v.filter((x: any) => x.aktif !== false) : []);
      setStages(Array.isArray(s) ? s.filter((x: any) => x.aktif).sort((a: any, b: any) => a.urutan - b.urutan) : []);
      setPoList(Array.isArray(p) ? p : []);
      setNotaList(Array.isArray(nr) ? nr : []);
    } catch {
      toast.error("Gagal memuat data gudang produksi");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData(true);
    const handler = () => fetchData(true); // silent refresh via SSE, tanpa kedip
    window.addEventListener("konveksi-sync", handler);
    return () => window.removeEventListener("konveksi-sync", handler);
  }, [fetchData]);

  // ─── Stage helpers ───────────────────────────────────────────────────
  const gudangStage = useMemo(() => stages.find(s => normalizeStage(s.slug) === "gudang"), [stages]);
  const gudangSlug = gudangStage?.slug || "gudang";
  const isGudang = (slug?: string) => normalizeStage(slug) === "gudang";

  const stageLabel = (slug?: string) => {
    const st = stages.find(s => s.slug === slug);
    if (st) return st.nama;
    return FALLBACK_LABEL[normalizeStage(slug)] || slug || "-";
  };
  const stageColor = (slug?: string) => {
    const st = stages.find(s => s.slug === slug) || stages.find(s => normalizeStage(s.slug) === normalizeStage(slug));
    return st?.warna || FALLBACK_COLOR[normalizeStage(slug)] || "#64748B";
  };
  const vendorById = (id?: any) => vendors.find(v => String(v.id) === String(id));
  const poById = (id?: any) => poList.find(p => String(p.id) === String(id));

  // Tahap tujuan dari gudang = tahap aktif selain potong, cmt, gudang
  const kirimTargets = useMemo(
    () => stages.filter(s => !["potong", "cmt", "gudang"].includes(normalizeStage(s.slug))),
    [stages]
  );
  const vendorsForStage = (slug: string) => {
    const st = stages.find(s => s.slug === slug);
    const tipe = (st?.vendor_tipe || "").toLowerCase();
    const norm = normalizeStage(slug);
    const list = vendors.filter(v => {
      const vt = (v.tipe || "").toLowerCase();
      return (tipe && vt === tipe) || normalizeStage(vt) === norm;
    });
    return list;
  };

  // ─── Derived lists ───────────────────────────────────────────────────
  const masuk = useMemo(() => transfers.filter(t => isGudang(t.ke) && t.status !== "Diverifikasi"), [transfers, stages]);
  const stok = useMemo(() => transfers.filter(t => isGudang(t.ke) && t.status === "Diverifikasi" && !t.is_forwarded), [transfers, stages]);
  const diVendor = useMemo(
    () => transfers.filter(t =>
      !isGudang(t.ke) &&
      Number(t.jumlah_kirim) > 0 &&
      !t.is_forwarded &&
      !["Diverifikasi", "Ditarik Penuh", "Kembali ke Gudang", "Selesai"].includes(t.status)
    ),
    [transfers, stages]
  );

  const q = search.toLowerCase().trim();
  const matchSearch = (t: any) => {
    if (!q) return true;
    const v = vendorById(t.vendor_id)?.nama || t.vendor_nama || "";
    return [t.noPo, t.model, v, stageLabel(t.dari), stageLabel(t.ke)].join(" ").toLowerCase().includes(q);
  };

  const pcsMasuk = masuk.reduce((s, t) => s + Number(t.jumlah_kirim || 0), 0);
  const pcsStok = stok.reduce((s, t) => s + Number(t.jumlah_diterima ?? t.jumlah_kirim ?? 0), 0);
  const pcsVendor = diVendor.reduce((s, t) => s + Number(t.jumlah_kirim || 0), 0);
  const vendorLateCount = diVendor.filter(t => daysLate(t.target_selesai || poById(t.po_id)?.target_selesai) > 0).length;

  // ─── Actions ─────────────────────────────────────────────────────────
  const openTerima = (t: any) => {
    setTerimaModal(t);
    setTerimaForm({
      sizeBreakdown: (t.sizeBreakdown || []).map((s: any) => ({ size: s.size, dikirim: Number(s.jumlah || 0), jumlah: Number(s.jumlah || 0) })),
      catatan: ""
    });

    const stageNorm = normalizeStage(t.dari);
    let defaultAlasan = "Barang reject / cacat produksi";
    let defaultBiaya = 25000;
    if (stageNorm.includes("benang")) {
      defaultAlasan = "Kain tersayat / tergunting saat bersih benang";
      defaultBiaya = 20000;
    } else if (stageNorm.includes("wash")) {
      defaultAlasan = "Cacat washing / noda cucian / warna belang";
      defaultBiaya = 25000;
    } else if (stageNorm.includes("cmt") || stageNorm.includes("jahit")) {
      defaultAlasan = "Cacat jahitan / obras lepas / loncat";
      defaultBiaya = 35000;
    } else if (stageNorm.includes("finish") || stageNorm.includes("pack")) {
      defaultAlasan = "Cacat kancing / rivet robek / cacat finishing";
      defaultBiaya = 25000;
    }

    setKlaimForm({
      buatNota: true,
      vendor_id: String(t.dari_vendor_id || t.vendor_id || ""),
      alasan_reject: defaultAlasan,
      biaya_per_pcs: defaultBiaya,
      tindakan_klaim: "potong_tagihan"
    });
    setSurplusTindakan("terima_semua");
    setSelisihMode("retur_perbaikan");
    setReturForm({
      alasan: stageNorm.includes("wash")
        ? "Warna washing kurang rata / belum matang (perlu cuci ulang)"
        : stageNorm.includes("cmt") || stageNorm.includes("jahit")
        ? "Cacat jahitan / obras lepas / loncat (perlu jahit ulang)"
        : "Barang cacat pengerjaan - perlu dikerjakan ulang",
      vendor_id: String(t.dari_vendor_id || t.vendor_id || ""),
      catatan: ""
    });

    setPoDetailData(null);
    if (t.po_id) {
      setLoadingPoDetail(true);
      fetch(`/api/po-detail?poId=${t.po_id}`)
        .then(r => r.json())
        .then(res => {
          setPoDetailData(Array.isArray(res) ? res[0] : res);
        })
        .catch(() => {})
        .finally(() => setLoadingPoDetail(false));
    }
  };

  const getPoActors = useCallback((modal: any, detail: any) => {
    if (!modal) return [];
    const po = poById(modal.po_id) || detail;
    const poTfs = transfers.filter(x => Number(x.po_id) === Number(modal.po_id));
    const actors: Array<{
      id: string;
      pos: string;
      posLabel: string;
      posColor: string;
      nama: string;
      sub: string;
      vendor_id: number | null;
      isCurrent: boolean;
      pcs: number;
      status: string;
      alasanDefault: string;
      biayaDefault: number;
      icon: any;
    }> = [];

    // 1. Potong / Cutting
    const pem = detail?.pemotongan;
    const tk = pem?.tukang;
    actors.push({
      id: "actor-potong",
      pos: "potong_bahan",
      posLabel: "Potong (Cutting)",
      posColor: "#2563EB",
      nama: tk?.nama ? `Tukang Potong: ${tk.nama} (${tk.kode || "SJ"})` : "Divisi Pemotongan Kain",
      sub: pem?.nama_barang ? `Kain: ${pem.nama_barang} ${pem.kain?.warna ? `(${pem.kain.warna})` : ""}` : "Pemotongan Pola",
      vendor_id: null,
      isCurrent: normalizeStage(modal.dari) === "potong",
      pcs: Number(pem?.total_pcs || po?.jumlahTerbit || modal.jumlah_kirim || 0),
      status: "Selesai Dipotong",
      alasanDefault: "Cacat potong kain / pola tidak simetris / cacat serat",
      biayaDefault: 20000,
      icon: Scissors,
    });

    // 2. CMT / Penjahit
    const cmtVendor = vendorById(po?.vendorId) || (detail?.vendorCMT ? detail.vendorCMT : null);
    if (cmtVendor) {
      actors.push({
        id: `actor-cmt-${cmtVendor.id}`,
        pos: "penjahit_kain",
        posLabel: "CMT (Penjahit)",
        posColor: "#DC2626",
        nama: cmtVendor.nama,
        sub: `Mitra Penjahit SPK ${po?.noPo || modal.noPo}`,
        vendor_id: Number(cmtVendor.id),
        isCurrent: normalizeStage(modal.dari).includes("cmt") || normalizeStage(modal.dari).includes("jahit"),
        pcs: Number(po?.jumlahTerbit || modal.jumlah_kirim || 0),
        status: po?.cmt_status || "Selesai",
        alasanDefault: "Cacat jahitan / obras lepas / loncat",
        biayaDefault: 35000,
        icon: Shirt,
      });
    }

    // 3. Downstream & Transfers: Washing, Bersih Benang, Finishing, dll
    if (detail?.cmtRecords) {
      detail.cmtRecords.forEach((rec: any) => {
        if (rec.vendor_id && Number(rec.vendor_id) !== Number(po?.vendorId)) {
          const vObj = vendorById(rec.vendor_id);
          const vName = vObj?.nama || rec.vendor_nama || `Vendor #${rec.vendor_id}`;
          const existing = actors.find(a => String(a.vendor_id) === String(rec.vendor_id));
          if (!existing) {
            actors.push({
              id: `actor-rec-${rec.vendor_id}`,
              pos: "vendor_proses",
              posLabel: vObj?.tipe ? vObj.tipe.toUpperCase() : "PROSES VENDOR",
              posColor: "#D97706",
              nama: vName,
              sub: `Pengerjaan ${rec.totalJumlah || modal.jumlah_kirim} pcs`,
              vendor_id: Number(rec.vendor_id),
              isCurrent: String(rec.vendor_id) === String(modal.vendor_id || modal.dari_vendor_id),
              pcs: Number(rec.totalJumlah || 0),
              status: rec.status || "Selesai",
              alasanDefault: "Cacat washing / noda cucian / warna belang",
              biayaDefault: 25000,
              icon: Package,
            });
          }
        }
      });
    }

    poTfs.forEach(tf => {
      const vId = tf.vendor_id || tf.dari_vendor_id;
      if (!vId) return;
      const vObj = vendorById(vId);
      const vName = vObj?.nama || tf.vendor_ke_nama || `Vendor #${vId}`;
      const stgNorm = normalizeStage(isGudang(tf.dari) ? tf.ke : tf.dari);

      const existing = actors.find(a => String(a.vendor_id) === String(vId));
      if (!existing) {
        let alasan = "Barang reject / cacat pengerjaan vendor";
        let biaya = 25000;
        let posCol = "#475569";
        if (stgNorm.includes("wash")) {
          alasan = "Cacat washing / noda cucian / warna belang";
          biaya = 25000;
          posCol = "#D97706";
        } else if (stgNorm.includes("benang")) {
          alasan = "Kain tersayat / tergunting saat bersih benang";
          biaya = 20000;
          posCol = "#059669";
        } else if (stgNorm.includes("finish") || stgNorm.includes("pack")) {
          alasan = "Cacat kancing / rivet robek / cacat finishing";
          biaya = 25000;
          posCol = "#7C3AED";
        }

        actors.push({
          id: `actor-tf-${vId}-${stgNorm}`,
          pos: stgNorm,
          posLabel: stageLabel(stgNorm),
          posColor: posCol,
          nama: vName,
          sub: tf.catatan ? tf.catatan.slice(0, 45) : `Transfer ${tf.jumlah_kirim || 0} pcs`,
          vendor_id: Number(vId),
          isCurrent: (String(vId) === String(modal.vendor_id) || String(vId) === String(modal.dari_vendor_id)),
          pcs: Number(tf.jumlah_kirim_awal || tf.jumlah_kirim || 0),
          status: tf.status || "Diproses",
          alasanDefault: alasan,
          biayaDefault: biaya,
          icon: Package,
        });
      } else {
        if (String(vId) === String(modal.vendor_id || modal.dari_vendor_id)) {
          existing.isCurrent = true;
        }
      }
    });

    const curVId = modal.vendor_id || modal.dari_vendor_id;
    if (curVId && !actors.some(a => String(a.vendor_id) === String(curVId))) {
      const curV = vendorById(curVId);
      if (curV) {
        actors.push({
          id: `actor-cur-${curV.id}`,
          pos: modal.dari,
          posLabel: stageLabel(modal.dari),
          posColor: stageColor(modal.dari),
          nama: curV.nama,
          sub: `Vendor Pengirim Saat Ini (${stageLabel(modal.dari)})`,
          vendor_id: Number(curV.id),
          isCurrent: true,
          pcs: Number(modal.jumlah_kirim || 0),
          status: "Pengirim",
          alasanDefault: klaimForm.alasan_reject,
          biayaDefault: klaimForm.biaya_per_pcs,
          icon: Package,
        });
      }
    }

    return actors;
  }, [poById, transfers, vendorById, stageLabel, stageColor, klaimForm.alasan_reject, klaimForm.biaya_per_pcs]);

  const submitTerima = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!terimaModal) return;
    const total = sumQty(terimaForm.sizeBreakdown);
    const fallbackTotal = terimaForm.sizeBreakdown.length === 0 ? Number(terimaModal.jumlah_kirim || 0) : total;
    const isFullRework = fallbackTotal <= 0 && selisihMode === "retur_perbaikan";
    if (fallbackTotal <= 0 && !isFullRework) {
      return toast.error("Jumlah diterima harus lebih dari 0 (atau gunakan Retur Seluruhnya untuk perbaikan)");
    }

    const totalKirim = Number(terimaModal.jumlah_kirim || 0);
    const selisih = Math.max(0, totalKirim - fallbackTotal);
    const surplus = Math.max(0, fallbackTotal - totalKirim);

    // Sanity check jika kelebihan fisik besar (mencegah typo fatal misal 1009 pcs)
    if (surplus > 50) {
      const ok = window.confirm(
        `Perhatian: Terdeteksi kelebihan fisik sangat besar (+${surplus.toLocaleString("id-ID")} pcs).\nTotal fisik diinput: ${fallbackTotal.toLocaleString("id-ID")} pcs (Surat Jalan: ${totalKirim.toLocaleString("id-ID")} pcs).\n\nApakah Anda yakin angka fisik ini sudah benar dan BUKAN salah ketik?`
      );
      if (!ok) return;
    }

    const rincianReject = terimaForm.sizeBreakdown
      .filter((s: any) => Number(s.dikirim || 0) > Number(s.jumlah || 0))
      .map((s: any) => ({
        size: s.size,
        dikirim: Number(s.dikirim || 0),
        diterima: Number(s.jumlah || 0),
        reject: Number(s.dikirim || 0) - Number(s.jumlah || 0)
      }));

    const currentV = vendorById(terimaModal.vendor_id || terimaModal.dari_vendor_id);
    const targetVendorId = klaimForm.vendor_id || currentV?.id || terimaModal.dari_vendor_id || terimaModal.vendor_id || null;
    const vKlaim = vendorById(targetVendorId) || currentV;

    let finalJumlahDiterima = fallbackTotal;
    let finalSizeBreakdown = terimaForm.sizeBreakdown.map(s => ({ size: s.size, jumlah: Number(s.jumlah || 0) }));
    let autoCatatan = terimaForm.catatan || "";

    if (surplus > 0) {
      if (surplusTindakan === "retur_kelebihan") {
        finalJumlahDiterima = totalKirim;
        finalSizeBreakdown = terimaForm.sizeBreakdown.map(s => ({
          size: s.size,
          jumlah: Math.min(Number(s.dikirim || 0), Number(s.jumlah || 0))
        }));
        const surplusMsg = `[SURPLUS RETUR] Diterima ${totalKirim} pcs sesuai SPK. Kelebihan fisik +${surplus} pcs dipisahkan / diretur ke vendor (${vKlaim?.nama || "Vendor"}).`;
        autoCatatan = autoCatatan ? `${autoCatatan} · ${surplusMsg}` : surplusMsg;
      } else {
        const surplusMsg = `[SURPLUS DITERIMA] Total diterima ${fallbackTotal} pcs (+${surplus} pcs surplus dari SPK ${totalKirim} pcs).`;
        autoCatatan = autoCatatan ? `${autoCatatan} · ${surplusMsg}` : surplusMsg;
      }
    }

    const returPayload = (selisih > 0 && selisihMode === "retur_perbaikan") ? {
      jumlah_retur: selisih,
      sizeBreakdown_retur: rincianReject.length > 0
        ? rincianReject.map(r => ({ size: r.size, jumlah: r.reject }))
        : (terimaModal.sizeBreakdown || []).map((s: any) => ({ size: s.size, jumlah: Number(s.jumlah || 0) })),
      alasan_retur: returForm.alasan,
      vendor_id: returForm.vendor_id || vKlaim?.id || null,
      vendor_nama: vendorById(returForm.vendor_id || vKlaim?.id)?.nama || terimaModal.vendor_nama || "Vendor",
      catatan: returForm.catatan || autoCatatan
    } : null;

    const klaimPayload = (selisih > 0 && selisihMode === "reject_permanen" && klaimForm.buatNota) ? {
      jumlah_reject: selisih,
      rincian_reject: rincianReject,
      vendor_id: vKlaim?.id || targetVendorId || null,
      vendor_nama: vKlaim?.nama || terimaModal.vendor_nama || "Vendor",
      pos_tahap: terimaModal.dari,
      noPo: terimaModal.noPo,
      model: terimaModal.model,
      tukang_potong: poDetailData?.pemotongan?.tukang?.nama || null,
      nama_kain: poDetailData?.pemotongan?.kain?.nama_kain || poDetailData?.pemotongan?.nama_barang || null,
      alasan_reject: klaimForm.alasan_reject,
      biaya_per_pcs: Number(klaimForm.biaya_per_pcs || 0),
      total_klaim: selisih * Number(klaimForm.biaya_per_pcs || 0),
      tindakan_klaim: klaimForm.tindakan_klaim
    } : null;

    setSubmitting(true);
    try {
      const res = await fetch("/api/produksi-transfer", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: terimaModal.id,
          jumlah_diterima: finalJumlahDiterima,
          sizeBreakdown_diterima: finalSizeBreakdown,
          catatan_terima: autoCatatan,
          klaim_reject: klaimPayload,
          retur_perbaikan: returPayload
        })
      });
      if (!res.ok) throw new Error("Gagal verifikasi barang");
      const out = await res.json().catch(() => ({}));
      if (returPayload) {
        if (finalJumlahDiterima <= 0) {
          toast.warning(`${terimaModal.noPo}: Seluruh ${selisih} pcs dicatat Retur Perbaikan ke ${returPayload.vendor_nama}!`, { duration: 6000 });
        } else {
          toast.success(`${terimaModal.noPo}: ${finalJumlahDiterima} pcs masuk Gudang & ${selisih} pcs Retur Perbaikan ke ${returPayload.vendor_nama}!`, { duration: 6000 });
        }
      } else if (surplus > 0 && surplusTindakan === "retur_kelebihan") {
        toast.success(`${terimaModal.noPo}: ${totalKirim} pcs diverifikasi masuk Gudang, ${surplus} pcs kelebihan diretur`);
      } else {
        toast.success(`${terimaModal.noPo}: ${finalJumlahDiterima} pcs diverifikasi masuk Gudang`);
      }

      if (out.nota_reject) {
        setNotaModal(out.nota_reject);
        setNotaList(prev => [out.nota_reject, ...prev.filter(n => n.id !== out.nota_reject.id)]);
        toast.warning(`Nota Reject & Klaim #${out.nota_reject.no_nota} diterbitkan (${selisih} pcs)!`, { duration: 6000 });
      }

      setTerimaModal(null);
      fetchData(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openKirim = (t: any) => {
    const first = kirimTargets[0]?.slug || "";
    const d = new Date(); d.setDate(d.getDate() + 7);
    setKirimModal(t);
    setKirimForm({
      ke: first,
      vendor_id: "",
      target_selesai: d.toISOString().split("T")[0],
      catatan: "",
      sizeBreakdown: (t.sizeBreakdown_diterima || t.sizeBreakdown || []).map((s: any) => ({ size: s.size, max: Number(s.jumlah || 0), jumlah: Number(s.jumlah || 0) }))
    });
  };
  const submitKirim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kirimModal || !kirimForm.ke) return toast.error("Pilih tahap tujuan");
    const over = kirimForm.sizeBreakdown.find(s => Number(s.jumlah) > Number(s.max));
    if (over) return toast.error(`Size ${over.size} melebihi stok gudang (${over.max} pcs)`);
    const total = kirimForm.sizeBreakdown.length ? sumQty(kirimForm.sizeBreakdown) : Number(kirimModal.jumlah_diterima || 0);
    if (total <= 0) return toast.error("Masukkan jumlah yang akan dikirim");
    const st = stages.find(s => s.slug === kirimForm.ke);
    if (st?.butuh_vendor && !kirimForm.vendor_id) return toast.error(`Tahap ${st.nama} wajib memilih vendor`);
    setSubmitting(true);
    try {
      const res = await fetch("/api/produksi-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          po_id: kirimModal.po_id,
          dari: gudangSlug,
          ke: kirimForm.ke,
          vendor_id: kirimForm.vendor_id || null,
          target_selesai: kirimForm.target_selesai || null,
          jumlah_kirim: total,
          sizeBreakdown: kirimForm.sizeBreakdown.filter(s => Number(s.jumlah) > 0).map(s => ({ size: s.size, jumlah: Number(s.jumlah) })),
          catatan: kirimForm.catatan,
          transfer_id_asal: kirimModal.id
        })
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Gagal mengirim barang"); }
      toast.success(`${total} pcs dikirim ke ${stageLabel(kirimForm.ke)}`);
      setKirimModal(null);
      fetchData(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openTarik = (t: any) => {
    setTarikModal(t);
    setTarikForm({
      sizeBreakdown: (t.sisa_sizes || t.sizeBreakdown || []).map((s: any) => ({ size: s.size, max: Number(s.jumlah || 0), jumlah: Number(s.jumlah || 0) })),
      catatan: ""
    });
  };
  const submitTarik = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tarikModal) return;
    const over = tarikForm.sizeBreakdown.find(s => Number(s.jumlah) > Number(s.max));
    if (over) return toast.error(`Size ${over.size} melebihi jumlah di vendor (${over.max} pcs)`);
    const total = tarikForm.sizeBreakdown.length ? sumQty(tarikForm.sizeBreakdown) : Number(tarikModal.jumlah_kirim || 0);
    if (total <= 0) return toast.error("Jumlah tarik harus lebih dari 0");
    setSubmitting(true);
    try {
      const res = await fetch("/api/produksi-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          po_id: tarikModal.po_id,
          dari: tarikModal.ke,
          ke: gudangSlug,
          vendor_id: tarikModal.vendor_id || null,
          jumlah_kirim: total,
          sizeBreakdown: tarikForm.sizeBreakdown.filter(s => Number(s.jumlah) > 0).map(s => ({ size: s.size, jumlah: Number(s.jumlah) })),
          catatan: tarikForm.catatan || `Ditarik dari ${vendorById(tarikModal.vendor_id)?.nama || stageLabel(tarikModal.ke)}`,
          transfer_id_asal: tarikModal.id
        })
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Gagal menarik barang"); }
      toast.success(`${total} pcs ditarik ke Gudang — silakan verifikasi di tab Barang Masuk`);
      setTarikModal(null);
      setActiveTab("masuk");
      fetchData(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Barang di Gudang Produksi yang tidak perlu proses lanjutan → beri nama & simpan sebagai barang jadi
  // (form penerimaan di Gudang & Stok: bisa sebagian, pecah nama barang, dan catat reject)
  const masukStokJadi = (t: any) => {
    window.location.href = `/gudang?terima=${t.id}`;
  };

  // ─── UI primitives ───────────────────────────────────────────────────
  const StageChip = ({ slug }: { slug?: string }) => {
    const c = stageColor(slug);
    return (
      <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 800, background: c + "15", color: c, border: `1px solid ${c}40`, whiteSpace: "nowrap" }}>
        {stageLabel(slug)}
      </span>
    );
  };
  const SizeChips = ({ list, tone = "#334155" }: { list?: any[]; tone?: string }) =>
    list && list.length > 0 ? (
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
        {list.map((s: any, i: number) => (
          <span key={i} style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", color: tone, padding: "3px 9px", borderRadius: 6, fontSize: 11.5, fontWeight: 800 }}>
            {s.size}: {s.jumlah}
          </span>
        ))}
      </div>
    ) : null;
  const Empty = ({ icon: Icon, title, sub }: any) => (
    <div style={{ textAlign: "center", padding: "56px 24px", background: "#FFFFFF", borderRadius: 16, border: "1.5px dashed #E2E8F0" }}>
      <Icon size={36} color="#CBD5E1" style={{ margin: "0 auto 10px", display: "block" }} />
      <div style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>{title}</div>
      {sub && <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 4 }}>{sub}</div>}
    </div>
  );
  const cardStyle: React.CSSProperties = { background: "#FFFFFF", borderRadius: 16, border: "1px solid #E2E8F0", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden", display: "flex", flexDirection: "column" };
  const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #CBD5E1", fontSize: 13.5, outline: "none", background: "#FFFFFF", color: "#0F172A", boxSizing: "border-box" };
  const labelStyle: React.CSSProperties = { display: "block", fontSize: 12.5, fontWeight: 800, color: "#334155", marginBottom: 8 };

  if (loading) {
    return (
      <div style={{ background: "#F1F5F9", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <RefreshCw size={22} color="#2563EB" style={{ animation: "spin 1s linear infinite" }} />
        <div style={{ color: "#475569", fontSize: 14, fontWeight: 700 }}>Memuat data gudang produksi...</div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const TABS: { key: TabKey; label: string; icon: any; count: number; color: string }[] = [
    { key: "masuk", label: "Barang Masuk", icon: Inbox, count: masuk.length, color: "#DC2626" },
    { key: "stok", label: "Stok Gudang & Kirim", icon: Package, count: stok.length, color: "#059669" },
    { key: "vendor", label: "Di Vendor / Proses Luar", icon: Truck, count: diVendor.length, color: "#D97706" },
    { key: "nota", label: "Nota Reject & Klaim", icon: AlertOctagon, count: notaList.length, color: "#DC2626" },
    { key: "riwayat", label: "Semua Riwayat", icon: History, count: transfers.length, color: "#64748B" }
  ];

  const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 360px), 1fr))", gap: 16 };

  return (
    <div style={{ padding: "28px 32px 48px 32px", background: "#F1F5F9", minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .gp-card { transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
        .gp-card:hover { transform: translateY(-3px); box-shadow: 0 10px 24px rgba(0,0,0,0.08) !important; }
        .gp-tab:hover { background: #F1F5F9 !important; }
        @media print {
          body * { visibility: hidden !important; }
          #printable-nota, #printable-nota * { visibility: visible !important; }
          #printable-nota { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; margin: 0 !important; padding: 24px !important; box-shadow: none !important; }
        }
      `}</style>

      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14, marginBottom: 18 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: "linear-gradient(135deg, #4338CA 0%, #6366F1 100%)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(99,102,241,0.3)" }}>
              <Warehouse size={20} color="#FFFFFF" />
            </div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#0F172A", letterSpacing: "-0.02em" }}>Gudang Produksi</h1>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#4338CA", background: "#EEF2FF", border: "1px solid #C7D2FE", padding: "2px 8px", borderRadius: 6 }}>
              Real-Time
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "#64748B" }}>
            Pusat penerimaan, verifikasi stok, dan pengiriman barang antar tahap produksi (Washing, Bersih Benang, Packing).
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/alur-produksi" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: "1px solid #CBD5E1", background: "#FFFFFF", color: "#475569", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>
            <Workflow size={14} /> Alur Produksi
          </Link>
          <Link href="/dashboard-cmt" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: "1px solid #CBD5E1", background: "#FFFFFF", color: "#475569", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>
            <Truck size={14} /> Dashboard CMT
          </Link>
          <button onClick={() => fetchData(false)} disabled={refreshing} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 18px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #1E40AF 0%, #2563EB 100%)", color: "#FFFFFF", fontSize: 13, fontWeight: 800, cursor: "pointer", boxShadow: "0 2px 8px rgba(37,99,235,0.25)", opacity: refreshing ? 0.7 : 1 }}>
            <RefreshCw size={15} style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 20 }}>
        {[
          { key: "masuk", label: "Perlu Verifikasi", value: masuk.length, unit: "transfer", sub: `${pcsMasuk.toLocaleString("id-ID")} pcs menunggu dicek`, color: "#DC2626", bg: "#FEF2F2", icon: Inbox },
          { key: "stok", label: "Stok di Gudang", value: pcsStok, unit: "pcs", sub: `${stok.length} lot siap dikirim`, color: "#059669", bg: "#ECFDF5", icon: Package },
          { key: "vendor", label: "Di Vendor Luar", value: pcsVendor, unit: "pcs", sub: vendorLateCount > 0 ? `${vendorLateCount} pengiriman lewat target` : `${diVendor.length} pengiriman aktif`, color: "#D97706", bg: "#FFFBEB", icon: Truck },
          { key: "riwayat", label: "Total Transfer", value: transfers.length, unit: "riwayat", sub: "Seluruh perpindahan barang", color: "#4338CA", bg: "#EEF2FF", icon: History }
        ].map(k => (
          <button key={k.key} onClick={() => setActiveTab(k.key as TabKey)} className="gp-card" style={{ textAlign: "left", background: "#FFFFFF", borderRadius: 14, padding: "16px 20px", border: activeTab === k.key ? `1.5px solid ${k.color}` : "1px solid #E2E8F0", boxShadow: "0 2px 6px rgba(0,0,0,0.02)", cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>{k.label}</span>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: k.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <k.icon size={15} color={k.color} />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: k.color }}>
              {k.value.toLocaleString("id-ID")} <span style={{ fontSize: 12, fontWeight: 700, color: "#94A3B8" }}>{k.unit}</span>
            </div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: k.key === "vendor" && vendorLateCount > 0 ? "#DC2626" : "#64748B", marginTop: 2 }}>{k.sub}</div>
          </button>
        ))}
      </div>

      {/* TABS + SEARCH */}
      <div style={{ background: "#FFFFFF", borderRadius: 14, border: "1px solid #E2E8F0", padding: 10, marginBottom: 18, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {TABS.map(t => {
            const active = activeTab === t.key;
            return (
              <button key={t.key} className={active ? "" : "gp-tab"} onClick={() => setActiveTab(t.key)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 10, border: active ? "1px solid #BFDBFE" : "1px solid transparent", background: active ? "#EFF6FF" : "transparent", color: active ? "#1D4ED8" : "#475569", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>
                <t.icon size={14} />
                {t.label}
                <span style={{ minWidth: 20, height: 20, padding: "0 6px", borderRadius: 10, fontSize: 10.5, fontWeight: 900, display: "inline-flex", alignItems: "center", justifyContent: "center", background: t.count > 0 && t.key !== "riwayat" ? t.color : "#E2E8F0", color: t.count > 0 && t.key !== "riwayat" ? "#FFFFFF" : "#64748B" }}>
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>
        <div style={{ position: "relative", flex: "1 1 240px", maxWidth: 340 }}>
          <Search size={15} color="#94A3B8" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari No PO, model, vendor..." style={{ ...inputStyle, paddingLeft: 36 }} />
        </div>
      </div>

      {/* TAB: BARANG MASUK */}
      {activeTab === "masuk" && (
        masuk.filter(matchSearch).length === 0 ? (
          <Empty icon={CheckCheck} title="Tidak ada barang masuk yang perlu diverifikasi" sub={diVendor.length > 0 ? `Ada ${diVendor.length} pengiriman di vendor luar — tarik ke gudang dari tab "Di Vendor / Proses Luar".` : "Semua barang yang masuk sudah diverifikasi."} />
        ) : (
          <div style={gridStyle}>
            {masuk.filter(matchSearch).map(t => (
              <div key={t.id} className="gp-card" style={{ ...cardStyle, border: "1.5px solid #FECACA" }}>
                <div style={{ background: "linear-gradient(90deg, #991B1B 0%, #DC2626 100%)", color: "#FFFFFF", padding: "7px 16px", fontSize: 11, fontWeight: 800, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}><AlertTriangle size={13} /> MENUNGGU VERIFIKASI GUDANG</span>
                  <span style={{ opacity: 0.9 }}>{daysSince(t.tanggal_kirim)} hari</span>
                </div>
                <div style={{ padding: "16px 18px", flex: 1, display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                    <StageChip slug={t.dari} /> <ChevronRight size={14} color="#94A3B8" /> <StageChip slug={t.ke} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 900, fontFamily: "monospace", color: "#1D4ED8", background: "#EFF6FF", border: "1px solid #BFDBFE", padding: "2px 8px", borderRadius: 6 }}>{t.noPo}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{t.model}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#64748B", marginTop: 6 }}>
                    Dikirim {fmtDate(t.tanggal_kirim)} · <b style={{ color: "#D97706" }}>{Number(t.jumlah_kirim).toLocaleString("id-ID")} pcs</b>
                    {t.catatan ? <> · <i>{t.catatan}</i></> : null}
                  </div>
                  <SizeChips list={t.sizeBreakdown} />
                  <div style={{ marginTop: "auto", paddingTop: 14, borderTop: "1px solid #F1F5F9", display: "flex", justifyContent: "flex-end" }}>
                    <button onClick={() => openTerima(t)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #047857 0%, #10B981 100%)", color: "#FFFFFF", fontSize: 12.5, fontWeight: 800, cursor: "pointer", boxShadow: "0 2px 6px rgba(16,185,129,0.25)" }}>
                      <CheckCheck size={14} /> Verifikasi Terima
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* TAB: STOK GUDANG */}
      {activeTab === "stok" && (
        stok.filter(matchSearch).length === 0 ? (
          <Empty icon={Package} title="Belum ada stok di gudang yang siap dikirim" sub="Verifikasi barang masuk terlebih dahulu, lalu kirim ke tahap berikutnya dari sini." />
        ) : (
          <div style={gridStyle}>
            {stok.filter(matchSearch).map(t => {
              const qty = Number(t.jumlah_diterima ?? t.jumlah_kirim ?? 0);
              const selisih = Number(t.jumlah_kirim || 0) - qty;
              return (
                <div key={t.id} className="gp-card" style={cardStyle}>
                  <div style={{ height: 4, background: "#10B981" }} />
                  <div style={{ padding: "16px 18px", flex: 1, display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 15, fontWeight: 900, fontFamily: "monospace", color: "#1D4ED8", background: "#EFF6FF", border: "1px solid #BFDBFE", padding: "2px 8px", borderRadius: 6 }}>{t.noPo}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{t.model}</span>
                        </div>
                        <div style={{ fontSize: 12, color: "#64748B", marginTop: 6 }}>
                          Asal: <b>{stageLabel(t.dari)}</b> · Diterima {fmtDate(t.tanggal_terima)}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color: "#059669", lineHeight: 1 }}>{qty.toLocaleString("id-ID")}</div>
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: "#94A3B8" }}>pcs di gudang</div>
                      </div>
                    </div>
                    {selisih !== 0 && (
                      <div style={{ marginTop: 10, fontSize: 11.5, fontWeight: 700, color: selisih > 0 ? "#B91C1C" : "#1D4ED8", background: selisih > 0 ? "#FEF2F2" : "#EFF6FF", border: `1px solid ${selisih > 0 ? "#FECACA" : "#BFDBFE"}`, padding: "6px 10px", borderRadius: 8 }}>
                        {selisih > 0 ? `Kurang ${selisih} pcs dari jumlah kiriman (${t.jumlah_kirim} pcs)` : `Lebih ${Math.abs(selisih)} pcs dari jumlah kiriman`}
                      </div>
                    )}
                    <SizeChips list={t.sizeBreakdown_diterima || t.sizeBreakdown} tone="#047857" />
                    {t.catatan_terima && <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 8 }}>Catatan: {t.catatan_terima}</div>}
                    <div style={{ marginTop: "auto", paddingTop: 14, borderTop: "1px solid #F1F5F9", display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                      <button onClick={() => masukStokJadi(t)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1px solid #A7F3D0", background: "#ECFDF5", color: "#047857", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>
                        <ArrowDownToLine size={13} /> Masuk Gudang &amp; Stok
                      </button>
                      <button onClick={() => openKirim(t)} disabled={kirimTargets.length === 0} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #1E40AF 0%, #2563EB 100%)", color: "#FFFFFF", fontSize: 12.5, fontWeight: 800, cursor: "pointer", boxShadow: "0 2px 6px rgba(37,99,235,0.2)" }}>
                        <Send size={13} /> Kirim ke Tahap Berikutnya
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* TAB: DI VENDOR */}
      {activeTab === "vendor" && (
        diVendor.filter(matchSearch).length === 0 ? (
          <Empty icon={Truck} title="Tidak ada barang yang sedang berada di vendor luar" sub="Barang yang dikirim ke Washing / Bersih Benang / Packing akan tampil di sini." />
        ) : (
          <div style={gridStyle}>
            {diVendor.filter(matchSearch).map(t => {
              const v = vendorById(t.vendor_id);
              const target = t.target_selesai || poById(t.po_id)?.target_selesai;
              const late = daysLate(target);
              const lama = daysSince(t.tanggal_kirim);
              return (
                <div key={t.id} className="gp-card" style={{ ...cardStyle, border: late > 0 ? "1.5px solid #FECACA" : "1px solid #E2E8F0" }}>
                  {target ? (
                    late > 0 ? (
                      <div style={{ background: "linear-gradient(90deg, #991B1B 0%, #DC2626 100%)", color: "#FFFFFF", padding: "7px 16px", fontSize: 11, fontWeight: 800, display: "flex", justifyContent: "space-between" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><AlertTriangle size={13} /> MELEBIHI TARGET ({late} HARI)</span>
                        <span style={{ opacity: 0.9 }}>Target {fmtDate(target)}</span>
                      </div>
                    ) : (
                      <div style={{ background: "#F0FDF4", borderBottom: "1px solid #BBF7D0", color: "#166534", padding: "7px 16px", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                        <Calendar size={13} /> Target selesai {fmtDate(target)}
                      </div>
                    )
                  ) : null}
                  <div style={{ padding: "16px 18px", flex: 1, display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 15, fontWeight: 900, fontFamily: "monospace", color: "#1D4ED8", background: "#EFF6FF", border: "1px solid #BFDBFE", padding: "2px 8px", borderRadius: 6 }}>{t.noPo}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{t.model}</span>
                        </div>
                        <StageChip slug={t.ke} />
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color: "#D97706", lineHeight: 1 }}>{Number(t.jumlah_kirim).toLocaleString("id-ID")}</div>
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: "#94A3B8" }}>pcs di vendor</div>
                      </div>
                    </div>

                    <div style={{ marginTop: 12, background: "#0F172A", borderRadius: 12, padding: "10px 12px", color: "#F8FAFC", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 900 }}>{v?.nama || t.vendor_nama || "Tanpa vendor"}</div>
                        <div style={{ fontSize: 10.5, color: "#94A3B8", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                          <Clock size={11} /> Dikirim {fmtDate(t.tanggal_kirim)} · {lama} hari di vendor · Status: {t.status}
                        </div>
                      </div>
                      {v?.kontak && (
                        <a href={waLink(v.kontak, `Halo ${v.nama}, kami dari Gudang Produksi ingin menanyakan progres ${t.noPo} (${t.model}) sebanyak ${t.jumlah_kirim} pcs yang dikirim ${fmtDate(t.tanggal_kirim)}${late > 0 ? ` — sudah lewat target ${late} hari` : ""}. Kapan bisa kami tarik kembali ke gudang? Terima kasih.`)} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 9px", borderRadius: 6, background: "#065F46", border: "1px solid #059669", color: "#A7F3D0", fontSize: 11, fontWeight: 800, textDecoration: "none" }}>
                          <MessageCircle size={12} /> WA Tagih
                        </a>
                      )}
                    </div>

                    <SizeChips list={t.sizeBreakdown} />

                    <div style={{ marginTop: "auto", paddingTop: 14, borderTop: "1px solid #F1F5F9", display: "flex", justifyContent: "flex-end" }}>
                      <button onClick={() => openTarik(t)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #B45309 0%, #F59E0B 100%)", color: "#FFFFFF", fontSize: 12.5, fontWeight: 800, cursor: "pointer", boxShadow: "0 2px 6px rgba(245,158,11,0.25)" }}>
                        <ArrowDownToLine size={14} /> Tarik ke Gudang
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* TAB: RIWAYAT */}
      {activeTab === "riwayat" && (
        transfers.filter(matchSearch).length === 0 ? (
          <Empty icon={History} title="Belum ada riwayat transfer" />
        ) : (
          <div style={{ background: "#FFFFFF", borderRadius: 14, border: "1px solid #E2E8F0", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
                <thead>
                  <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                    {["Tanggal", "No PO", "Alur", "Vendor", "Jumlah", "Status"].map(h => (
                      <th key={h} style={{ padding: "11px 16px", textAlign: h === "Jumlah" ? "right" : "left", fontSize: 11.5, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.03em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transfers.filter(matchSearch).map(t => {
                    const vInfo = t.vendor_id != null ? transferStatusInfo(t) : null;
                    const st = vInfo ? vInfo.label : (t.status || "-");
                    const sc = vInfo ? [vInfo.bg, vInfo.color] : st === "Diverifikasi" ? ["#ECFDF5", "#047857"] : st === "Kirim" ? ["#FFFBEB", "#B45309"] : st === "Kembali ke Gudang" ? ["#EEF2FF", "#4338CA"] : st === "Ditarik Penuh" ? ["#F1F5F9", "#64748B"] : ["#EFF6FF", "#1D4ED8"];
                    return (
                      <tr key={t.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                        <td style={{ padding: "12px 16px", fontSize: 12.5, color: "#475569", whiteSpace: "nowrap" }}>{fmtDate(t.tanggal_kirim)}</td>
                        <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 800, color: "#0F172A", whiteSpace: "nowrap" }}>{t.noPo} <span style={{ fontWeight: 600, color: "#94A3B8" }}>· {t.model}</span></td>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}><StageChip slug={t.dari} /><ChevronRight size={13} color="#94A3B8" /><StageChip slug={t.ke} /></div>
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: 12.5, color: "#334155" }}>{vendorById(t.vendor_id)?.nama || (t.vendor_nama !== "-" ? t.vendor_nama : "—")}</td>
                        <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 900, color: "#0F172A", textAlign: "right", whiteSpace: "nowrap" }}>
                          {Number(t.jumlah_kirim || 0).toLocaleString("id-ID")} pcs
                          {t.jumlah_diterima != null && Number(t.jumlah_diterima) !== Number(t.jumlah_kirim) && (
                            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#059669" }}>diterima {t.jumlah_diterima}</div>
                          )}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 800, background: sc[0], color: sc[1], whiteSpace: "nowrap" }}>{st}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* TAB: NOTA REJECT & KLAIM */}
      {activeTab === "nota" && (
        notaList.length === 0 ? (
          <Empty icon={AlertOctagon} title="Belum ada Nota Reject & Klaim" sub="Nota reject otomatis dibuat jika terdapat selisih kurang/rusak saat verifikasi penerimaan barang." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 360px), 1fr))", gap: 14 }}>
              {notaList.map(n => (
                <div key={n.id} className="gp-card" style={{ ...cardStyle, border: "1.5px solid #FECACA" }}>
                  <div style={{ background: n.status_klaim === "Lunas" || n.status_klaim === "Selesai" ? "linear-gradient(90deg, #15803D 0%, #16A34A 100%)" : "linear-gradient(90deg, #991B1B 0%, #DC2626 100%)", color: "#FFFFFF", padding: "8px 16px", fontSize: 11.5, fontWeight: 900, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}><AlertOctagon size={14} /> {n.no_nota}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 4, background: "rgba(255,255,255,0.25)", color: "#FFFFFF" }}>
                        {n.status_klaim === "Lunas" || n.status_klaim === "Selesai" ? "✓ LUNAS" : "⏳ DIAJUKAN"}
                      </span>
                      <span style={{ opacity: 0.9 }}>{fmtDate(n.tanggal_klaim)}</span>
                    </div>
                  </div>
                  <div style={{ padding: "16px 18px", flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <span style={{ fontSize: 14, fontWeight: 900, fontFamily: "monospace", color: "#1D4ED8", background: "#EFF6FF", border: "1px solid #BFDBFE", padding: "2px 8px", borderRadius: 6 }}>{n.noPo}</span>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", marginTop: 4 }}>{n.model}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 20, fontWeight: 900, color: "#DC2626" }}>{n.jumlah_reject} pcs</div>
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: "#94A3B8" }}>reject / kurang</div>
                      </div>
                    </div>

                    <div style={{ background: "#F8FAFC", borderRadius: 8, padding: "8px 12px", border: "1px solid #E2E8F0", fontSize: 12 }}>
                      <div style={{ color: "#64748B" }}>Vendor: <strong style={{ color: "#0F172A" }}>{n.vendor_nama}</strong> ({stageLabel(n.pos_asal)})</div>
                      <div style={{ color: "#B45309", marginTop: 3 }}>Alasan: <em>{n.alasan_reject}</em></div>
                      {n.rincian_reject && n.rincian_reject.length > 0 && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                          {n.rincian_reject.map((r: any, idx: number) => (
                            <span key={idx} style={{ fontSize: 10.5, fontWeight: 800, color: "#DC2626", background: "#FEE2E2", border: "1px solid #FCA5A5", padding: "1px 6px", borderRadius: 4 }}>
                              {r.size}: -{r.reject} pcs
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #F1F5F9", paddingTop: 10 }}>
                      <div>
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: "#64748B" }}>Total Nilai Klaim:</div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: "#DC2626" }}>Rp {Number(n.total_klaim || 0).toLocaleString("id-ID")}</div>
                      </div>
                      <button
                        onClick={() => setNotaModal(n)}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, border: "none", background: "#0F172A", color: "#FFFFFF", fontSize: 12, fontWeight: 800, cursor: "pointer" }}
                      >
                        <FileText size={13} /> Pratinjau / Cetak
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* ─── MODAL: VERIFIKASI TERIMA ─── */}
      {terimaModal && (() => {
        const totalKirim = Number(terimaModal.jumlah_kirim || 0);
        const totalTerima = terimaForm.sizeBreakdown.length ? sumQty(terimaForm.sizeBreakdown) : totalKirim;
        const diffTotal = Math.max(0, totalKirim - totalTerima);
        const surplusTotal = Math.max(0, totalTerima - totalKirim);
        const currentV = vendorById(terimaModal.vendor_id || terimaModal.dari_vendor_id);
        const po = poById(terimaModal.po_id);
        const cmtV = vendorById(po?.vendorId);
        const targetV = vendorById(klaimForm.vendor_id) || currentV;
        const actors = getPoActors(terimaModal, poDetailData);

        return (
          <Modal title="Verifikasi Terima Barang" subtitle={`${terimaModal.noPo} · ${terimaModal.model} · dari ${stageLabel(terimaModal.dari)}`} icon={CheckCheck} color="#059669" onClose={() => setTerimaModal(null)}>
            <form onSubmit={submitTerima} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 6 }}>
                  <label style={{ ...labelStyle, margin: 0 }}>Jumlah fisik yang diterima per size</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setTerimaForm({
                          ...terimaForm,
                          sizeBreakdown: (terimaModal.sizeBreakdown || []).map((s: any) => ({
                            size: s.size,
                            dikirim: Number(s.jumlah || 0),
                            jumlah: 0
                          }))
                        });
                        setSelisihMode("retur_perbaikan");
                        toast.warning(`Seluruh ${totalKirim} pcs ditandai untuk Retur Perbaikan (Cuci/Jahit Ulang)`);
                      }}
                      style={{
                        background: "#FFFBEB",
                        border: "1px solid #FCD34D",
                        color: "#B45309",
                        padding: "3px 8px",
                        borderRadius: 6,
                        fontSize: 10.5,
                        fontWeight: 800,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4
                      }}
                    >
                      <RotateCcw size={11} /> Retur Seluruhnya ({totalKirim} pcs)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTerimaForm({
                          ...terimaForm,
                          sizeBreakdown: (terimaModal.sizeBreakdown || []).map((s: any) => ({
                            size: s.size,
                            dikirim: Number(s.jumlah || 0),
                            jumlah: Number(s.jumlah || 0)
                          }))
                        });
                        toast.info(`Kuantiti fisik di-reset penuh ${totalKirim} pcs`);
                      }}
                      style={{
                        background: "#F0FDF4",
                        border: "1px solid #BBF7D0",
                        color: "#166534",
                        padding: "3px 8px",
                        borderRadius: 6,
                        fontSize: 10.5,
                        fontWeight: 800,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4
                      }}
                    >
                      <Check size={11} /> Terima Penuh ({totalKirim} pcs)
                    </button>
                  </div>
                </div>
                {terimaForm.sizeBreakdown.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: "#64748B", background: "#F8FAFC", padding: 12, borderRadius: 10 }}>Tidak ada rincian size — akan dicatat {terimaModal.jumlah_kirim} pcs.</div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
                    {terimaForm.sizeBreakdown.map((s, idx) => {
                      const diff = Number(s.jumlah || 0) - Number(s.dikirim || 0);
                      const isKurang = diff < 0;
                      const isLebih = diff > 0;
                      return (
                        <div
                          key={s.size}
                          style={{
                            border: `1px solid ${isKurang ? "#FCA5A5" : isLebih ? "#93C5FD" : "#E2E8F0"}`,
                            borderRadius: 10,
                            padding: 10,
                            background: isKurang ? "#FEF2F2" : isLebih ? "#EFF6FF" : "#F8FAFC"
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 900, color: "#0F172A", marginBottom: 6 }}>
                            <span>{s.size}</span>
                            <span style={{ color: "#94A3B8", fontWeight: 700 }}>kirim {s.dikirim}</span>
                          </div>
                          <input
                            type="number"
                            min={0}
                            placeholder="0"
                            value={s.jumlah === 0 ? "" : s.jumlah}
                            onFocus={e => e.target.select()}
                            onChange={e => {
                              const f = [...terimaForm.sizeBreakdown];
                              f[idx] = { ...f[idx], jumlah: e.target.value === "" ? 0 : Number(e.target.value) };
                              setTerimaForm({ ...terimaForm, sizeBreakdown: f });
                            }}
                            style={{
                              ...inputStyle,
                              fontWeight: 800,
                              fontSize: 15,
                              borderColor: isKurang ? "#F87171" : isLebih ? "#60A5FA" : "#CBD5E1",
                              color: isKurang ? "#DC2626" : isLebih ? "#1D4ED8" : "#0F172A"
                            }}
                          />
                          {isKurang && (
                            <div style={{ fontSize: 10.5, fontWeight: 800, color: "#DC2626", marginTop: 4 }}>
                              {diff} pcs kurang
                            </div>
                          )}
                          {isLebih && (
                            <div style={{ fontSize: 10.5, fontWeight: 800, color: "#2563EB", marginTop: 4 }}>
                              +{diff} pcs lebih (surplus)
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: "#0F172A" }}>
                    Total diterima: <strong style={{ color: surplusTotal > 0 ? "#1D4ED8" : diffTotal > 0 ? "#DC2626" : "#0F172A" }}>{totalTerima.toLocaleString("id-ID")}</strong> / {totalKirim.toLocaleString("id-ID")} pcs
                  </div>
                  {surplusTotal > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setTerimaForm({
                          ...terimaForm,
                          sizeBreakdown: (terimaModal.sizeBreakdown || []).map((s: any) => ({
                            size: s.size,
                            dikirim: Number(s.jumlah || 0),
                            jumlah: Number(s.jumlah || 0)
                          }))
                        });
                        toast.info(`Kuantiti fisik di-reset ke ${totalKirim} pcs (sesuai surat jalan kirim)`);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "4px 10px",
                        borderRadius: 6,
                        border: "1px solid #BFDBFE",
                        background: "#EFF6FF",
                        color: "#1D4ED8",
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: "pointer"
                      }}
                    >
                      <RotateCcw size={12} /> Koreksi Typo (Reset ke {totalKirim} pcs)
                    </button>
                  )}
                </div>
              </div>

              {/* ─── PILIHAN TINDAKAN UNTUK SELISIH KURANG (RETUR PERBAIKAN VS REJECT) ─── */}
              {diffTotal > 0 && (
                <div style={{ background: selisihMode === "retur_perbaikan" ? "#FFFBEB" : "#FEF2F2", border: `1.5px solid ${selisihMode === "retur_perbaikan" ? "#FCD34D" : "#FCA5A5"}`, borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: selisihMode === "retur_perbaikan" ? "#FEF3C7" : "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {selisihMode === "retur_perbaikan" ? <RotateCcw size={18} color="#D97706" /> : <AlertTriangle size={18} color="#DC2626" />}
                      </div>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 900, color: selisihMode === "retur_perbaikan" ? "#92400E" : "#991B1B" }}>
                          Terdeteksi Selisih Kurang: {diffTotal} pcs
                        </div>
                        <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                          Kirim: <strong>{totalKirim} pcs</strong> ➔ Diterima lolos QC: <strong>{totalTerima} pcs</strong> · Sisa bermasalah: <strong style={{ color: "#DC2626" }}>{diffTotal} pcs</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2 PILIHAN AKSI UTAMA: RETUR PERBAIKAN vs REJECT PERMANEN */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ fontSize: 11, fontWeight: 800, color: "#475569" }}>
                      Pilih Tindakan untuk Sisa {diffTotal} pcs Ini:
                    </label>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      {/* OPSI 1: RETUR PERBAIKAN (REWORK) */}
                      <div
                        onClick={() => setSelisihMode("retur_perbaikan")}
                        style={{
                          border: selisihMode === "retur_perbaikan" ? "2px solid #D97706" : "1px solid #CBD5E1",
                          background: selisihMode === "retur_perbaikan" ? "#FEF3C7" : "#FFFFFF",
                          borderRadius: 10,
                          padding: "10px 12px",
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                          position: "relative"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 11.5, fontWeight: 900, color: "#92400E", display: "flex", alignItems: "center", gap: 5 }}>
                            🔄 Retur Perbaikan / Rework
                          </span>
                          <span style={{ fontSize: 9.5, fontWeight: 800, background: "#D97706", color: "white", padding: "1px 6px", borderRadius: 4 }}>
                            Recommended
                          </span>
                        </div>
                        <div style={{ fontSize: 10.5, color: "#78350F", lineHeight: 1.4, marginTop: 2 }}>
                          Barang dikembalikan ke vendor untuk dikerjakan/dicuci ulang. <strong>Tidak ada denda reject</strong> dan stok tetap aktif di produksi.
                        </div>
                      </div>

                      {/* OPSI 2: REJECT PERMANEN (KLAIM) */}
                      <div
                        onClick={() => setSelisihMode("reject_permanen")}
                        style={{
                          border: selisihMode === "reject_permanen" ? "2px solid #DC2626" : "1px solid #CBD5E1",
                          background: selisihMode === "reject_permanen" ? "#FEE2E2" : "#FFFFFF",
                          borderRadius: 10,
                          padding: "10px 12px",
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                          position: "relative"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 11.5, fontWeight: 900, color: "#991B1B", display: "flex", alignItems: "center", gap: 5 }}>
                            🛑 Tutup Reject Permanen
                          </span>
                          <span style={{ fontSize: 9.5, fontWeight: 800, background: "#DC2626", color: "white", padding: "1px 6px", borderRadius: 4 }}>
                            Barang Rusak Mati
                          </span>
                        </div>
                        <div style={{ fontSize: 10.5, color: "#7F1D1D", lineHeight: 1.4, marginTop: 2 }}>
                          Barang rusak parah / hilang di vendor. <strong>Stok dipotong</strong> dan diterbitkan <strong>Nota Klaim Ganti Rugi (REJ-...)</strong>.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* FORM KHUSUS OPSI 1: RETUR PERBAIKAN */}
                  {selisihMode === "retur_perbaikan" && (
                    <div style={{ background: "#FFFFFF", borderRadius: 10, padding: "12px 14px", border: "1px solid #FCD34D", display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 900, color: "#92400E", display: "flex", alignItems: "center", gap: 6 }}>
                        <RotateCcw size={14} color="#D97706" />
                        <span>Form Pengembalian Perbaikan ke Vendor ({diffTotal} pcs)</span>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 800, color: "#475569", display: "block", marginBottom: 3 }}>
                            Alasan Retur / Perbaikan:
                          </label>
                          <select
                            value={returForm.alasan}
                            onChange={e => setReturForm({ ...returForm, alasan: e.target.value })}
                            style={{ ...inputStyle, padding: "7px 10px", fontSize: 12, fontWeight: 600 }}
                          >
                            <option value="Warna washing kurang rata / belum matang (perlu cuci ulang)">Warna washing kurang rata / belum matang (cuci ulang)</option>
                            <option value="Cacat jahitan / obras lepas / loncat (perlu jahit ulang)">Cacat jahitan / obras lepas / loncat (jahit ulang)</option>
                            <option value="Saku / aksesoris miring (perlu bongkar & jahit ulang)">Saku / aksesoris miring (bongkar & jahit ulang)</option>
                            <option value="Noda kotor yang masih bisa dicuci ulang">Noda kotor yang masih bisa dicuci ulang</option>
                            <option value="Kancing / rivet lepas / salah posisi (perlu pasang ulang)">Kancing / rivet lepas / salah pasang</option>
                            <option value="Benang masih berantakan / belum rapi">Benang masih berantakan / belum rapi</option>
                            <option value="Lainnya">Lainnya (Tulis detail di Catatan)</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ fontSize: 11, fontWeight: 800, color: "#475569", display: "block", marginBottom: 3 }}>
                            Vendor yang Ditugaskan Memperbaiki:
                          </label>
                          <select
                            value={returForm.vendor_id || String(currentV?.id || "")}
                            onChange={e => setReturForm({ ...returForm, vendor_id: e.target.value })}
                            style={{ ...inputStyle, padding: "7px 10px", fontSize: 12, fontWeight: 700 }}
                          >
                            {currentV && (
                              <option value={String(currentV.id)}>
                                {currentV.nama} (Vendor Pengirim Saat Ini)
                              </option>
                            )}
                            {cmtV && String(cmtV.id) !== String(currentV?.id) && (
                              <option value={String(cmtV.id)}>
                                {cmtV.nama} (Vendor CMT / Jahit)
                              </option>
                            )}
                            <optgroup label="Alihkan ke Vendor Lain">
                              {vendors.filter(vn => String(vn.id) !== String(currentV?.id)).map(vn => (
                                <option key={vn.id} value={String(vn.id)}>
                                  {vn.nama} ({vn.tipe || "Vendor"})
                                </option>
                              ))}
                            </optgroup>
                          </select>
                        </div>
                      </div>

                      <div style={{ background: "#FFFBEB", border: "1px dashed #D97706", borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "#92400E" }}>
                        ℹ️ <strong>Alur Sistem:</strong> {totalTerima > 0 ? <>Sebanyak <strong>{totalTerima} pcs</strong> akan masuk ke stok Gudang (Selesai). Sisa </> : ""}<strong>{diffTotal} pcs</strong> akan dibuatkan baris pengerjaan baru berlabel <strong>"Retur Perbaikan"</strong> agar vendor mengerjakan ulang.
                      </div>
                    </div>
                  )}

                  {/* FORM KHUSUS OPSI 2: REJECT PERMANEN (KLAIM) */}
                  {selisihMode === "reject_permanen" && (
                    <div style={{ background: "#FFFFFF", borderRadius: 10, padding: "14px", border: "1px solid #FECACA", display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12, fontWeight: 900, color: "#991B1B" }}>
                          Klaim Ganti Rugi Barang Rusak Permanen
                        </span>
                        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 800, color: "#991B1B", cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={klaimForm.buatNota}
                            onChange={e => setKlaimForm({ ...klaimForm, buatNota: e.target.checked })}
                            style={{ width: 14, height: 14, accentColor: "#DC2626" }}
                          />
                          Terbitkan Nota Reject
                        </label>
                      </div>
                      
                      {/* ─── DAFTAR LENGKAP PIHAK YANG MENGERJAKAN PO INI (1-CLICK KLAIM) ─── */}
                      <div style={{ background: "#F8FAFC", border: "1.5px solid #E2E8F0", borderRadius: 10, padding: "12px", display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 900, color: "#0F172A" }}>
                            <Layers size={15} color="#2563EB" />
                            <span>Pihak yang Mengerjakan PO Ini ({terimaModal.noPo} · {terimaModal.model})</span>
                          </div>
                          <span style={{ fontSize: 10.5, color: "#64748B", fontWeight: 700 }}>
                            Klik pada salah satu pihak di bawah untuk langsung memilih klaim 👇
                          </span>
                        </div>

                        {/* Quick Spec Pills */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, fontSize: 11, background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 7, padding: "6px 10px" }}>
                          <span style={{ color: "#1E40AF" }}>
                            📦 <strong>Kain:</strong> {poDetailData?.pemotongan?.kain?.nama_kain || poDetailData?.pemotongan?.nama_barang || "Denim"} {poDetailData?.pemotongan?.kain?.warna ? `(${poDetailData.pemotongan.kain.warna})` : ""}
                          </span>
                          <span style={{ color: "#1E40AF" }}>
                            ✂️ <strong>Potong:</strong> {poDetailData?.pemotongan?.tukang?.nama ? `${poDetailData.pemotongan.tukang.nama} (Kode ${poDetailData.pemotongan.tukang.kode || "SJ"})` : "Tim Potong Internal"}
                          </span>
                          <span style={{ color: "#1E40AF" }}>
                            📊 <strong>Total SPK:</strong> {(poDetailData?.jumlahTerbit || po?.jumlahTerbit || terimaModal.jumlah_kirim).toLocaleString("id-ID")} pcs
                          </span>
                        </div>

                        {/* Interactive Actor Cards */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8, marginTop: 2 }}>
                          {actors.map(act => {
                            const isSelected = act.vendor_id !== null && String(klaimForm.vendor_id) === String(act.vendor_id);
                            const IconCmp = act.icon || Package;

                            return (
                              <div
                                key={act.id}
                                onClick={() => {
                                  if (act.vendor_id !== null) {
                                    setKlaimForm(prev => ({
                                      ...prev,
                                      vendor_id: String(act.vendor_id),
                                      alasan_reject: act.alasanDefault,
                                      biaya_per_pcs: act.biayaDefault,
                                      buatNota: true
                                    }));
                                    toast.success(`Vendor klaim dipilih: ${act.nama}`);
                                  } else {
                                    toast.info("Pemotongan adalah tim internal potong");
                                  }
                                }}
                                style={{
                                  cursor: act.vendor_id !== null ? "pointer" : "default",
                                  border: isSelected ? "2px solid #DC2626" : "1px solid #CBD5E1",
                                  background: isSelected ? "#FEF2F2" : "#FFFFFF",
                                  borderRadius: 8,
                                  padding: "9px 11px",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 4,
                                  position: "relative",
                                  transition: "all 0.15s ease",
                                  boxShadow: isSelected ? "0 4px 10px rgba(220, 38, 38, 0.15)" : "none"
                                }}
                              >
                                {isSelected && (
                                  <div style={{ position: "absolute", top: -7, right: 6, background: "#DC2626", color: "#FFFFFF", fontSize: 9, fontWeight: 900, padding: "1px 6px", borderRadius: 8, display: "flex", alignItems: "center", gap: 3 }}>
                                    <Check size={10} /> DITAGIH KLAIM
                                  </div>
                                )}
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <span style={{ fontSize: 9.5, fontWeight: 900, padding: "2px 6px", borderRadius: 4, background: `${act.posColor}15`, color: act.posColor, display: "flex", alignItems: "center", gap: 4 }}>
                                    <IconCmp size={11} /> {act.posLabel}
                                  </span>
                                  {act.isCurrent && (
                                    <span style={{ fontSize: 8.5, fontWeight: 900, color: "#059669", background: "#ECFDF5", padding: "1px 5px", borderRadius: 4, border: "1px solid #A7F3D0" }}>
                                      Pengirim Saat Ini
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: 12.5, fontWeight: 900, color: "#0F172A", marginTop: 1 }}>
                                  {act.nama}
                                </div>
                                <div style={{ fontSize: 10, color: "#64748B" }}>
                                  {act.sub}
                                </div>
                                <div style={{ fontSize: 10, color: "#475569", display: "flex", justifyContent: "space-between", marginTop: 1, borderTop: "1px dashed #E2E8F0", paddingTop: 3 }}>
                                  <span>{act.pcs} pcs</span>
                                  <span style={{ color: "#059669", fontWeight: 700 }}>{act.status}</span>
                                </div>

                                {act.vendor_id !== null ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setKlaimForm(prev => ({
                                        ...prev,
                                        vendor_id: String(act.vendor_id),
                                        alasan_reject: act.alasanDefault,
                                        biaya_per_pcs: act.biayaDefault,
                                        buatNota: true
                                      }));
                                      toast.success(`Vendor klaim dipilih: ${act.nama}`);
                                    }}
                                    style={{
                                      marginTop: 4,
                                      padding: "4px 8px",
                                      borderRadius: 6,
                                      border: isSelected ? "1px solid #DC2626" : "1px solid #BFDBFE",
                                      background: isSelected ? "#DC2626" : "#EFF6FF",
                                      color: isSelected ? "#FFFFFF" : "#1D4ED8",
                                      fontSize: 10,
                                      fontWeight: 800,
                                      cursor: "pointer",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      gap: 4
                                    }}
                                  >
                                    {isSelected ? (
                                      <>
                                        <Check size={11} /> Vendor Terpilih Untuk Klaim
                                      </>
                                    ) : (
                                      <>
                                        <UserCheck size={11} /> Pilih Vendor Ini
                                      </>
                                    )}
                                  </button>
                                ) : (
                                  <div style={{ marginTop: 2, fontSize: 9.5, color: "#94A3B8", fontStyle: "italic", textAlign: "center" }}>
                                    Internal Produksi
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Dropdown Vendor Selector: Bisa ke vendor pos saat ini ATAU CMT sebelumnya ATAU Lainnya */}
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 800, color: "#475569", display: "block", marginBottom: 3 }}>
                          Vendor yang Bertanggung Jawab / Ditagih Klaim:
                        </label>
                        <select
                          value={klaimForm.vendor_id}
                          onChange={e => {
                            const val = e.target.value;
                            const matchedActor = actors.find(a => String(a.vendor_id) === val);
                            setKlaimForm(prev => ({
                              ...prev,
                              vendor_id: val,
                              alasan_reject: matchedActor?.alasanDefault || prev.alasan_reject,
                              biaya_per_pcs: matchedActor?.biayaDefault || prev.biaya_per_pcs
                            }));
                          }}
                          style={{ ...inputStyle, padding: "7px 10px", fontSize: 12, fontWeight: 700 }}
                        >
                          {currentV && (
                            <option value={String(currentV.id)}>
                              {currentV.nama} (Vendor Pos {stageLabel(terimaModal.dari)})
                            </option>
                          )}
                          {cmtV && String(cmtV.id) !== String(currentV?.id) && (
                            <option value={String(cmtV.id)}>
                              {cmtV.nama} (Vendor CMT / Penjahit PO ini)
                            </option>
                          )}
                          <optgroup label="Pilih Vendor Lainnya">
                            {vendors
                              .filter(vn => String(vn.id) !== String(currentV?.id) && String(vn.id) !== String(cmtV?.id))
                              .map(vn => (
                                <option key={vn.id} value={String(vn.id)}>
                                  {vn.nama} ({vn.tipe || "Vendor"})
                                </option>
                              ))}
                          </optgroup>
                        </select>
                        <div style={{ fontSize: 10.5, color: "#64748B", marginTop: 4 }}>
                          💡 <em>Tips:</em> Jika barang diterima dari <strong>{stageLabel(terimaModal.dari)}</strong> tapi reject akibat cacat jahitan/obras, Anda bisa mengalihkan klaim ke <strong>Vendor CMT / Penjahit</strong>.
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 8 }}>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 800, color: "#475569", display: "block", marginBottom: 3 }}>
                            Alasan Kerusakan / Reject
                          </label>
                          <select
                            value={klaimForm.alasan_reject}
                            onChange={e => setKlaimForm({ ...klaimForm, alasan_reject: e.target.value })}
                            style={{ ...inputStyle, padding: "6px 8px", fontSize: 12 }}
                          >
                            <optgroup label="✂️ Pos Bersih Benang">
                              <option value="Kain tersayat / tergunting saat bersih benang">Kain tersayat / tergunting saat potong benang</option>
                              <option value="Noda oli / kotoran saat buang benang">Noda oli / kotoran saat buang benang</option>
                              <option value="Sisa benang tidak dibersihkan / berantakan">Sisa benang tidak dibersihkan / berantakan</option>
                            </optgroup>
                            <optgroup label="🧵 Pos CMT / Jahit">
                              <option value="Cacat jahitan / obras lepas / loncat">Cacat jahitan / obras lepas / loncat</option>
                              <option value="Cacat ukuran / pola tidak sesuai SPK">Cacat ukuran / pola tidak sesuai SPK</option>
                              <option value="Kain bolong / robek terkena jarum jahit">Kain bolong / robek terkena jarum jahit</option>
                              <option value="Saku / variasi miring / salah pasang">Saku / variasi miring / salah pasang</option>
                            </optgroup>
                            <optgroup label="🧺 Pos Washing / Laundry">
                              <option value="Cacat washing / noda cucian / warna belang">Cacat washing / noda cucian / warna belang</option>
                              <option value="Kain rapuh / sobek berlebih efek stone wash">Kain rapuh / sobek berlebih efek stone wash</option>
                              <option value="Resleting / kancing rusak saat washing">Resleting / kancing rusak saat washing</option>
                            </optgroup>
                            <optgroup label="📦 Pos Finishing & Packing">
                              <option value="Cacat kancing / rivet robek / salah pasang">Cacat kancing / rivet robek / salah pasang</option>
                              <option value="Kain mengkilap / gosong bekas setrika">Kain mengkilap / gosong bekas setrika</option>
                              <option value="Aksesoris / hangtag / barcode rusak">Aksesoris / hangtag / barcode rusak</option>
                            </optgroup>
                            <optgroup label="⚠️ Umum & Bahan Baku">
                              <option value="Barang hilang / kuantiti kurang dari vendor">Barang hilang / kuantiti kurang dari vendor</option>
                              <option value="Cacat bahan kain bawaan (bolong / cacat tenun)">Cacat bahan kain bawaan (bolong / cacat tenun)</option>
                              <option value="Lainnya">Lainnya (Tulis detail di Catatan)</option>
                            </optgroup>
                          </select>
                        </div>

                        <div>
                          <label style={{ fontSize: 11, fontWeight: 800, color: "#475569", display: "block", marginBottom: 3 }}>
                            Estimasi Ganti Rugi / Pcs (Rp)
                          </label>
                          <input
                            type="number"
                            min={0}
                            step={1000}
                            value={klaimForm.biaya_per_pcs}
                            onChange={e => setKlaimForm({ ...klaimForm, biaya_per_pcs: Number(e.target.value) })}
                            style={{ ...inputStyle, padding: "6px 8px", fontSize: 12, fontWeight: 800, color: "#DC2626" }}
                          />
                          {/* Quick amount shortcuts */}
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                            {[
                              { label: "Ongkos Cuci", val: 20000 },
                              { label: "Ongkos Jahit", val: 35000 },
                              { label: "HPP Kain", val: 45000 },
                              { label: "Ganti Full", val: 75000 }
                            ].map(pill => (
                              <button
                                key={pill.label}
                                type="button"
                                onClick={() => setKlaimForm(prev => ({ ...prev, biaya_per_pcs: pill.val }))}
                                style={{
                                  border: klaimForm.biaya_per_pcs === pill.val ? "1px solid #DC2626" : "1px solid #E2E8F0",
                                  background: klaimForm.biaya_per_pcs === pill.val ? "#FEE2E2" : "#F8FAFC",
                                  color: klaimForm.biaya_per_pcs === pill.val ? "#991B1B" : "#475569",
                                  borderRadius: 5,
                                  padding: "2px 6px",
                                  fontSize: 9.5,
                                  fontWeight: 800,
                                  cursor: "pointer"
                                }}
                              >
                                {pill.label} ({pill.val / 1000}k)
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 8, alignItems: "center" }}>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 800, color: "#475569", display: "block", marginBottom: 3 }}>
                            Tindakan Klaim
                          </label>
                          <select
                            value={klaimForm.tindakan_klaim}
                            onChange={e => setKlaimForm({ ...klaimForm, tindakan_klaim: e.target.value })}
                            style={{ ...inputStyle, padding: "6px 8px", fontSize: 12 }}
                          >
                            <option value="potong_tagihan">Potong dari Tagihan / Ongkos Vendor</option>
                            <option value="ganti_barang">Vendor Wajib Ganti Barang Baru</option>
                            <option value="tagih_tunai">Klaim Ganti Rugi Tunai / Transfer</option>
                          </select>
                        </div>

                        <div style={{ background: "#FEF2F2", border: "1px dashed #F87171", borderRadius: 8, padding: "6px 10px", textAlign: "right" }}>
                          <div style={{ fontSize: 10.5, fontWeight: 700, color: "#991B1B" }}>Total Nilai Klaim ({diffTotal} pcs):</div>
                          <div style={{ fontSize: 16, fontWeight: 900, color: "#DC2626" }}>
                            Rp {(diffTotal * Number(klaimForm.biaya_per_pcs || 0)).toLocaleString("id-ID")}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ─── SURPLUS / KELEBIHAN BARANG SECTION ─── */}
              {surplusTotal > 0 && (
                <div style={{ background: "#EFF6FF", border: "1.5px solid #93C5FD", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: "#DBEAFE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <PackagePlus size={20} color="#1D4ED8" />
                      </div>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 900, color: "#1E40AF" }}>
                          Terdeteksi Kelebihan Barang (Surplus): +{surplusTotal.toLocaleString("id-ID")} pcs
                        </div>
                        <div style={{ fontSize: 11.5, color: "#3B82F6", marginTop: 2 }}>
                          Kirim surat jalan: <strong>{totalKirim} pcs</strong> ➔ Diterima fisik: <strong style={{ color: "#1E40AF" }}>{totalTerima.toLocaleString("id-ID")} pcs</strong>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setTerimaForm({
                          ...terimaForm,
                          sizeBreakdown: (terimaModal.sizeBreakdown || []).map((s: any) => ({
                            size: s.size,
                            dikirim: Number(s.jumlah || 0),
                            jumlah: Number(s.jumlah || 0)
                          }))
                        });
                        toast.info("Kuantiti fisik dikembalikan sesuai surat jalan kirim");
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "5px 10px",
                        borderRadius: 7,
                        border: "1px solid #BFDBFE",
                        background: "#FFFFFF",
                        color: "#1D4ED8",
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: "pointer"
                      }}
                    >
                      <RotateCcw size={13} /> Koreksi Typo (Reset ke {totalKirim} pcs)
                    </button>
                  </div>

                  {/* Warning jika selisih sangat besar (seperti contoh +909 pcs) */}
                  {surplusTotal > 50 && (
                    <div style={{ background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: 8, padding: "8px 12px", fontSize: 11.5, color: "#92400E", display: "flex", alignItems: "center", gap: 8 }}>
                      <AlertTriangle size={16} color="#D97706" style={{ flexShrink: 0 }} />
                      <span>
                        <strong>Perhatian:</strong> Kelebihan fisik sangat tinggi (+{surplusTotal.toLocaleString("id-ID")} pcs). Mohon teliti memeriksa apakah terjadi salah ketik angka (misal ingin input 100 terketik 1009).
                      </span>
                    </div>
                  )}

                  {/* Pilihan Tindakan Surplus */}
                  <div style={{ background: "#FFFFFF", borderRadius: 9, padding: "10px 12px", border: "1px solid #BFDBFE", display: "flex", flexDirection: "column", gap: 8 }}>
                    <label style={{ fontSize: 11, fontWeight: 800, color: "#475569", display: "block" }}>
                      Pilih Perlakuan untuk Kelebihan +{surplusTotal.toLocaleString("id-ID")} pcs Ini:
                    </label>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <label style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 8,
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: surplusTindakan === "terima_semua" ? "2px solid #2563EB" : "1px solid #E2E8F0",
                        background: surplusTindakan === "terima_semua" ? "#EFF6FF" : "#F8FAFC",
                        cursor: "pointer"
                      }}>
                        <input
                          type="radio"
                          name="surplus_tindakan"
                          checked={surplusTindakan === "terima_semua"}
                          onChange={() => setSurplusTindakan("terima_semua")}
                          style={{ marginTop: 2, accentColor: "#2563EB" }}
                        />
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 800, color: "#0F172A" }}>
                            Terima Semua Sebagai Surplus (+{surplusTotal.toLocaleString("id-ID")} pcs)
                          </div>
                          <div style={{ fontSize: 10.5, color: "#64748B", marginTop: 2 }}>
                            Stok gudang bertambah penuh ({totalTerima.toLocaleString("id-ID")} pcs). Cocok jika ada kelebihan pengerjaan nyata / sisa potongan kain yang sengaja dijahitkan.
                          </div>
                        </div>
                      </label>

                      <label style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 8,
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: surplusTindakan === "retur_kelebihan" ? "2px solid #D97706" : "1px solid #E2E8F0",
                        background: surplusTindakan === "retur_kelebihan" ? "#FFFBEB" : "#F8FAFC",
                        cursor: "pointer"
                      }}>
                        <input
                          type="radio"
                          name="surplus_tindakan"
                          checked={surplusTindakan === "retur_kelebihan"}
                          onChange={() => setSurplusTindakan("retur_kelebihan")}
                          style={{ marginTop: 2, accentColor: "#D97706" }}
                        />
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 800, color: "#0F172A" }}>
                            Terima Sesuai SPK ({totalKirim} pcs), Retur Sisanya
                          </div>
                          <div style={{ fontSize: 10.5, color: "#64748B", marginTop: 2 }}>
                            Hanya {totalKirim} pcs masuk stok gudang. Sisa +{surplusTotal.toLocaleString("id-ID")} pcs ditandai barang nyasar untuk dikembalikan ke vendor.
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label style={labelStyle}>Catatan</label>
                <input value={terimaForm.catatan} onChange={e => setTerimaForm({ ...terimaForm, catatan: e.target.value })} placeholder="Opsional, mis. 3 pcs cacat noda washing" style={inputStyle} />
              </div>
              <ModalActions
                onCancel={() => setTerimaModal(null)}
                submitting={submitting}
                label={
                  diffTotal > 0
                    ? selisihMode === "retur_perbaikan"
                      ? totalTerima <= 0
                        ? `🔄 Konfirmasi Retur Seluruhnya (${diffTotal} pcs) untuk Perbaikan`
                        : `✅ Terima ${totalTerima} pcs & 🔄 Retur ${diffTotal} pcs Perbaikan`
                      : klaimForm.buatNota
                      ? `🛑 Terima ${totalTerima} pcs & Terbitkan Nota Reject (${diffTotal} pcs)`
                      : `Konfirmasi Diterima (${totalTerima} pcs)`
                    : surplusTotal > 0
                    ? surplusTindakan === "retur_kelebihan"
                      ? `Konfirmasi Terima Sesuai SPK (${totalKirim} pcs)`
                      : `Konfirmasi Terima (+${surplusTotal.toLocaleString("id-ID")} pcs Surplus)`
                    : "Konfirmasi Diterima"
                }
                color={
                  diffTotal > 0
                    ? selisihMode === "retur_perbaikan"
                      ? "#D97706"
                      : klaimForm.buatNota
                      ? "#DC2626"
                      : "#2563EB"
                    : surplusTotal > 0
                    ? surplusTindakan === "retur_kelebihan"
                      ? "#D97706"
                      : "#2563EB"
                    : "#10B981"
                }
              />
            </form>
          </Modal>
        );
      })()}

      {/* ─── MODAL: NOTA REJECT & KLAIM GANTI RUGI RESMI (PRINTABLE) ─── */}
      <NotaRejectModal
        nota={notaModal}
        onClose={() => setNotaModal(null)}
        vendorKontak={vendorById(notaModal?.vendor_id)?.kontak || vendorById(notaModal?.vendor_id)?.telepon}
        onSettled={(updated) => {
          setNotaList(prev => prev.map(x => x.id === updated.id ? updated : x));
          fetchData(true);
        }}
        onCancelReject={(deleted) => {
          setNotaList(prev => prev.filter(x => x.id !== deleted.id));
          setNotaModal(null);
          fetchData(true);
        }}
      />

      {/* ─── MODAL: KIRIM KE TAHAP ─── */}
      {kirimModal && (
        <Modal title="Kirim ke Tahap Produksi" subtitle={`${kirimModal.noPo} · ${kirimModal.model} · stok ${kirimModal.jumlah_diterima ?? kirimModal.jumlah_kirim} pcs`} icon={Send} color="#2563EB" onClose={() => setKirimModal(null)}>
          <form onSubmit={submitKirim} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={labelStyle}>Tahap tujuan</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {kirimTargets.map(st => {
                  const active = kirimForm.ke === st.slug;
                  return (
                    <button key={st.slug} type="button" onClick={() => setKirimForm({ ...kirimForm, ke: st.slug, vendor_id: "" })} style={{ padding: "8px 14px", borderRadius: 10, border: `1.5px solid ${active ? st.warna : "#E2E8F0"}`, background: active ? st.warna + "15" : "#FFFFFF", color: active ? st.warna : "#475569", fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}>
                      {st.nama}
                    </button>
                  );
                })}
              </div>
            </div>
            {kirimForm.ke && (() => {
              const st = stages.find(s => s.slug === kirimForm.ke);
              const list = vendorsForStage(kirimForm.ke);
              return (
                <div>
                  <label style={labelStyle}>Vendor / Tim {st?.butuh_vendor ? <span style={{ color: "#DC2626" }}>*</span> : <span style={{ color: "#94A3B8", fontWeight: 600 }}>(opsional)</span>}</label>
                  <select value={kirimForm.vendor_id} onChange={e => setKirimForm({ ...kirimForm, vendor_id: e.target.value })} style={inputStyle}>
                    <option value="">— Pilih vendor —</option>
                    {(list.length ? list : vendors).map(v => {
                      const aktif = diVendor.filter(t => String(t.vendor_id) === String(v.id));
                      const pcs = aktif.reduce((s, t) => s + Number(t.jumlah_kirim || 0), 0);
                      return <option key={v.id} value={v.id}>{v.nama}{pcs > 0 ? ` — masih memegang ${pcs} pcs` : " — kosong"}</option>;
                    })}
                  </select>
                  {list.length === 0 && <div style={{ fontSize: 11.5, color: "#B45309", marginTop: 6 }}>Belum ada vendor bertipe "{st?.vendor_tipe || "-"}", menampilkan semua vendor.</div>}
                </div>
              );
            })()}
            <div>
              <label style={labelStyle}>Target selesai</label>
              <input type="date" value={kirimForm.target_selesai} onChange={e => setKirimForm({ ...kirimForm, target_selesai: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Jumlah dikirim per size</label>
              {kirimForm.sizeBreakdown.length === 0 ? (
                <div style={{ fontSize: 12.5, color: "#64748B", background: "#F8FAFC", padding: 12, borderRadius: 10 }}>Tidak ada rincian size — seluruh stok akan dikirim.</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8 }}>
                  {kirimForm.sizeBreakdown.map((s, idx) => (
                    <div key={s.size} style={{ border: `1px solid ${Number(s.jumlah) > Number(s.max) ? "#FCA5A5" : "#E2E8F0"}`, borderRadius: 10, padding: 10, background: "#F8FAFC" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 900, color: "#0F172A", marginBottom: 6 }}>
                        <span>{s.size}</span><span style={{ color: "#94A3B8", fontWeight: 700 }}>maks {s.max}</span>
                      </div>
                      <input type="number" min={0} max={s.max} value={s.jumlah} onChange={e => { const f = [...kirimForm.sizeBreakdown]; f[idx] = { ...f[idx], jumlah: e.target.value === "" ? "" : Number(e.target.value) }; setKirimForm({ ...kirimForm, sizeBreakdown: f }); }} style={{ ...inputStyle, fontWeight: 800, fontSize: 15 }} />
                    </div>
                  ))}
                </div>
              )}
              {kirimForm.sizeBreakdown.length > 0 && <div style={{ marginTop: 10, fontSize: 12.5, fontWeight: 800, color: "#0F172A" }}>Total kirim: {sumQty(kirimForm.sizeBreakdown).toLocaleString("id-ID")} pcs</div>}
            </div>
            <div>
              <label style={labelStyle}>Catatan</label>
              <input value={kirimForm.catatan} onChange={e => setKirimForm({ ...kirimForm, catatan: e.target.value })} placeholder="Opsional" style={inputStyle} />
            </div>
            <ModalActions onCancel={() => setKirimModal(null)} submitting={submitting} label="Kirim Sekarang" color="#2563EB" />
          </form>
        </Modal>
      )}

      {/* ─── MODAL: TARIK KE GUDANG ─── */}
      {tarikModal && (
        <Modal title="Tarik Barang ke Gudang" subtitle={`${tarikModal.noPo} · dari ${vendorById(tarikModal.vendor_id)?.nama || stageLabel(tarikModal.ke)} · ${tarikModal.jumlah_kirim} pcs`} icon={ArrowDownToLine} color="#D97706" onClose={() => setTarikModal(null)}>
          <form onSubmit={submitTarik} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 12, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 7 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ background: "#D97706", color: "white", padding: "2px 7px", borderRadius: 5, fontSize: 10.5, fontWeight: 900, textTransform: "uppercase" }}>
                    Aksi: Tarik Fisik Barang
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#92400E" }}>
                    Barang Masih Ada & Tetap Jadi Stok Aktif
                  </span>
                </div>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11.5, color: "#92400E", display: "flex", flexDirection: "column", gap: 3, lineHeight: 1.4 }}>
                <li>
                  <strong>Tujuan:</strong> Mengambil kembali fisik barang dari vendor ke pabrik (untuk dicek QC, retur perbaikan cuci/jahit ulang di pabrik, atau dialihkan ke vendor lain).
                </li>
                <li>
                  <strong>Status Stok:</strong> <u>Stok barang tidak hilang</u> dan <strong>TIDAK dikenakan denda reject</strong>. Barang akan masuk ke tab <b>Barang Masuk</b> untuk verifikasi fisik sebelum dialokasikan lagi.
                </li>
                <li>
                  <strong>Bukan untuk Barang Rusak / Hilang:</strong> Jika barang rusak permanen (sobek/bolong) atau hilang di vendor, <strong>JANGAN ditarik</strong>. Gunakan menu <strong>Gudang & Stok → Masih di Vendor → Tutup Sisa Reject</strong> agar diterbitkan Nota Klaim Ganti Rugi.
                </li>
              </ul>
            </div>
            <div>
              <label style={labelStyle}>Jumlah ditarik per size</label>
              {tarikForm.sizeBreakdown.length === 0 ? (
                <div style={{ fontSize: 12.5, color: "#64748B", background: "#F8FAFC", padding: 12, borderRadius: 10 }}>Tidak ada rincian size — seluruh {tarikModal.jumlah_kirim} pcs akan ditarik.</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8 }}>
                  {tarikForm.sizeBreakdown.map((s, idx) => (
                    <div key={s.size} style={{ border: `1px solid ${Number(s.jumlah) > Number(s.max) ? "#FCA5A5" : "#E2E8F0"}`, borderRadius: 10, padding: 10, background: "#F8FAFC" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 900, color: "#0F172A", marginBottom: 6 }}>
                        <span>{s.size}</span><span style={{ color: "#94A3B8", fontWeight: 700 }}>maks {s.max}</span>
                      </div>
                      <input type="number" min={0} max={s.max} value={s.jumlah} onChange={e => { const f = [...tarikForm.sizeBreakdown]; f[idx] = { ...f[idx], jumlah: e.target.value === "" ? "" : Number(e.target.value) }; setTarikForm({ ...tarikForm, sizeBreakdown: f }); }} style={{ ...inputStyle, fontWeight: 800, fontSize: 15 }} />
                    </div>
                  ))}
                </div>
              )}
              {tarikForm.sizeBreakdown.length > 0 && <div style={{ marginTop: 10, fontSize: 12.5, fontWeight: 800, color: "#0F172A" }}>Total tarik: {sumQty(tarikForm.sizeBreakdown).toLocaleString("id-ID")} pcs</div>}
            </div>
            <div>
              <label style={labelStyle}>Catatan</label>
              <input value={tarikForm.catatan} onChange={e => setTarikForm({ ...tarikForm, catatan: e.target.value })} placeholder="Opsional" style={inputStyle} />
            </div>
            <ModalActions onCancel={() => setTarikModal(null)} submitting={submitting} label="Tarik ke Gudang" color="#D97706" />
          </form>
        </Modal>
      )}
    </div>
  );
}

// ─── Shared modal shell (konsisten dengan modal Alur Produksi) ───────────
function Modal({ title, subtitle, icon: Icon, color, onClose, children }: any) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
      <div style={{ background: "#FFFFFF", width: "100%", maxWidth: 600, maxHeight: "92vh", borderRadius: 16, overflow: "hidden", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 22px", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: color + "15", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon size={17} color={color} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ fontSize: 15, fontWeight: 900, color: "#0F172A", margin: 0 }}>{title}</h3>
              <div style={{ fontSize: 12, color: "#64748B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{subtitle}</div>
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: 22, overflowY: "auto" }}>{children}</div>
      </div>
    </div>
  );
}

function ModalActions({ onCancel, submitting, label, color }: any) {
  return (
    <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
      <button type="button" onClick={onCancel} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "1px solid #CBD5E1", background: "#FFFFFF", color: "#475569", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
        Batal
      </button>
      <button type="submit" disabled={submitting} style={{ flex: 2, padding: "11px", borderRadius: 10, border: "none", background: color, color: "#FFFFFF", fontWeight: 800, fontSize: 13, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}>
        {submitting ? "Menyimpan..." : label}
      </button>
    </div>
  );
}
