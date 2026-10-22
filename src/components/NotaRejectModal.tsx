"use client";

import React, { useState, useEffect } from "react";
import { X, AlertOctagon, Printer, MessageCircle, CheckCircle2, DollarSign, FileText, ChevronDown, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export interface NotaRejectData {
  id: number | string;
  no_nota: string;
  transfer_id?: number | null;
  po_id?: number | string;
  noPo?: string;
  model?: string;
  vendor_id?: number | string | null;
  vendor_nama?: string;
  vendor_kontak?: string;
  pos_asal?: string;
  pos_tujuan?: string;
  jumlah_kirim?: number;
  jumlah_diterima?: number;
  jumlah_reject: number;
  rincian_reject?: Array<{ size: string; jumlah?: number; reject?: number; dikirim?: number; diterima?: number; alasan?: string }>;
  tukang_potong?: string | null;
  nama_kain?: string | null;
  alasan_reject?: string;
  biaya_per_pcs?: number;
  total_klaim?: number;
  tindakan_klaim?: string;
  status_klaim?: string;
  metode_pembayaran?: string;
  nominal_dibayar?: number;
  catatan_penyelesaian?: string;
  tanggal_selesai?: string;
  tanggal_klaim: string;
  catatan?: string;
  nama_usaha?: string;
}

interface Props {
  nota: NotaRejectData | null;
  onClose: () => void;
  vendorKontak?: string;
  onSettled?: (updatedNota: NotaRejectData) => void;
  onCancelReject?: (cancelledNota: NotaRejectData) => void;
  /** Mode lihat saja (portal vendor): pelunasan & pembatalan reject hanya untuk admin. */
  readOnly?: boolean;
}

type PreviewLayout = "modern" | "complex" | "simple";

export default function NotaRejectModal({ nota, onClose, vendorKontak, onSettled, onCancelReject, readOnly = false }: Props) {
  const [localNota, setLocalNota] = useState<NotaRejectData | null>(nota);
  const [showPayForm, setShowPayForm] = useState(false);
  const [submittingPay, setSubmittingPay] = useState(false);
  const [submittingCancel, setSubmittingCancel] = useState(false);
  const [payMetode, setPayMetode] = useState("Tunai");
  const [payNominal, setPayNominal] = useState<number>(0);
  const [payCatatan, setPayCatatan] = useState("");
  
  // Layout preview & print selector
  const [activePreview, setActivePreview] = useState<PreviewLayout>("modern");
  const [showPrintMenu, setShowPrintMenu] = useState(false);

  useEffect(() => {
    setLocalNota(nota);
    if (nota) {
      setPayNominal(Number(nota.total_klaim || 0));
      setPayMetode(
        nota.tindakan_klaim === "bayar_tunai"
          ? "Tunai"
          : nota.tindakan_klaim === "ganti_barang"
          ? "Ganti Barang"
          : "potong_tagihan"
      );
      setPayCatatan("");
      setShowPayForm(false);
    }
  }, [nota]);

  if (!localNota) return null;

  const isLunas = localNota.status_klaim === "Lunas" || localNota.status_klaim === "Selesai";

  const fmtDate = (iso?: string) => {
    if (!iso) return "-";
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  };

  const fmtDateTime = (iso?: string) => {
    if (!iso) return "-";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return `${d.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" })} ${d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`;
  };

  const stageLabel = (slug?: string) => {
    if (!slug) return "-";
    const map: Record<string, string> = {
      potong: "Potong Kain",
      cmt: "CMT / Jahit",
      washing: "Washing / Laundry",
      washing_pakaian: "Washing",
      benang: "Bersih Benang",
      finishing: "QC & Finishing",
      packing: "Packing",
      gudang: "Gudang Produksi",
      qc_bahan: "Gudang QC",
    };
    return map[slug] || slug.toUpperCase();
  };

  const hp = vendorKontak || localNota.vendor_kontak || "";
  const cleanHp = hp.replace(/\D/g, "").replace(/^0/, "62");

  // ==========================================
  // GENERATE HTML UNTUK PRINT (ISOLATED DOM)
  // Anti-Blank: Menjamin cetak tidak pernah putih/kosong
  // ==========================================

  // 1. Layout Kompleks (Continuous Form 80-Kolom / Khas Epson LX-310 / LQ-310)
  const generateComplexDotMatrixHtml = (data: NotaRejectData) => {
    const isPaid = data.status_klaim === "Lunas" || data.status_klaim === "Selesai";
    const rows = (data.rincian_reject && data.rincian_reject.length > 0)
      ? data.rincian_reject
      : [{ size: "ALL", dikirim: data.jumlah_kirim ?? data.jumlah_reject, diterima: data.jumlah_diterima ?? 0, reject: data.jumlah_reject }];

    const tableRows = rows.map((r: any, idx: number) => {
      const sizeStr = `Size ${r.size || "-"}`.padEnd(20, " ");
      const kirimStr = (r.dikirim != null ? `${r.dikirim} pcs` : "-").padStart(12, " ");
      const terimaStr = (r.diterima != null ? `${r.diterima} pcs` : "-").padStart(14, " ");
      const rejectStr = `${r.reject ?? r.jumlah ?? 0} pcs`.padStart(15, " ");
      const noStr = `${idx + 1}`.padEnd(4, " ");
      return `| ${noStr}| ${sizeStr}| ${kirimStr}| ${terimaStr}| ${rejectStr} |`;
    }).join("\n");

    const totalRejectFormatted = `${data.jumlah_reject} pcs`.padStart(15, " ");

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Cetak Nota Reject - ${data.no_nota}</title>
  <style>
    @page {
      size: auto;
      margin: 4mm 6mm;
    }
    body {
      margin: 0;
      padding: 0;
      background: #FFFFFF;
      color: #000000;
      font-family: "Courier New", Courier, "Lucida Console", Monaco, monospace;
      font-size: 11px;
      line-height: 1.3;
      -webkit-font-smoothing: antialiased;
    }
    .sheet {
      width: 100%;
      max-width: 800px;
      margin: 0 auto;
      padding: 6px 10px;
      box-sizing: border-box;
    }
    .header-title {
      font-size: 15px;
      font-weight: bold;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .header-sub {
      font-size: 10px;
      margin-top: 1px;
    }
    .ncr-box {
      border: 1px solid #000;
      padding: 4px 8px;
      font-size: 9.5px;
      line-height: 1.25;
      display: inline-block;
      text-align: left;
    }
    .pre-text {
      white-space: pre-wrap;
      font-family: inherit;
      font-size: 11px;
      margin: 0;
      line-height: 1.25;
    }
    .lunas-stamp {
      border: 2px solid #000;
      padding: 4px 10px;
      font-weight: bold;
      font-size: 12px;
      display: inline-block;
      margin-top: 6px;
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 6px;">
      <div>
        <div class="header-title">${data.nama_usaha || "TIRTA BINTANG JEANS"}</div>
        <div class="header-sub">Spesialis Denim &amp; Celana Jeans - Divisi Quality Control &amp; Gudang</div>
        <div class="header-sub">Jl. Industri Konveksi No. 88 | Telp: (022) 555-8899</div>
      </div>
      <div style="text-align: right;">
        <div class="ncr-box">
          <div style="font-weight: bold; text-decoration: underline; margin-bottom: 2px;">DISTRIBUSI RANGKAP (3-PLY NCR):</div>
          <div>[X] PUTIH  : Arsip Kantor / Keuangan</div>
          <div>[ ] MERAH  : Perwakilan Vendor</div>
          <div>[ ] KUNING : Arsip Bagian Gudang</div>
        </div>
      </div>
    </div>

    <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
      <div style="font-size: 13px; font-weight: bold;">${isPaid ? "INVOICE LUNAS &amp; BUKTI PELUNASAN KLAIM REJECT" : "BERITA ACARA &amp; NOTA KLAIM REJECT PRODUKSI"}</div>
      <div style="font-size: 12px; font-weight: bold;">NO: ${data.no_nota}</div>
    </div>

    <div style="border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 6px 0; margin-bottom: 8px;">
      <table style="width: 100%; font-size: 11px; font-family: inherit; border-collapse: collapse;">
        <tr>
          <td style="width: 18%; vertical-align: top; font-weight: bold;">Vendor Bertanggung Jawab</td>
          <td style="width: 2%;">:</td>
          <td style="width: 35%; vertical-align: top; font-weight: bold;">${data.vendor_nama || "Vendor"}</td>
          <td style="width: 16%; vertical-align: top; font-weight: bold;">No. SPK / PO</td>
          <td style="width: 2%;">:</td>
          <td style="width: 27%; vertical-align: top; font-weight: bold;">${data.noPo || "-"}</td>
        </tr>
        <tr>
          <td style="vertical-align: top;">Pos / Tahap</td>
          <td>:</td>
          <td style="vertical-align: top;">${stageLabel(data.pos_asal)} &rarr; ${stageLabel(data.pos_tujuan)}</td>
          <td style="vertical-align: top;">Model Celana</td>
          <td>:</td>
          <td style="vertical-align: top;">${data.model || "-"}</td>
        </tr>
        <tr>
          <td style="vertical-align: top;">Tanggal Klaim</td>
          <td>:</td>
          <td style="vertical-align: top;">${fmtDate(data.tanggal_klaim)}</td>
          <td style="vertical-align: top;">Tukang Potong</td>
          <td>:</td>
          <td style="vertical-align: top;">${data.tukang_potong || "-"}</td>
        </tr>
        <tr>
          <td style="vertical-align: top;">Bahan / Kain</td>
          <td>:</td>
          <td style="vertical-align: top;">${data.nama_kain || "-"}</td>
          <td style="vertical-align: top;">Kontak Vendor</td>
          <td>:</td>
          <td style="vertical-align: top;">${data.vendor_kontak || "-"}</td>
        </tr>
      </table>
    </div>

    <div style="margin-bottom: 8px;">
      <div style="font-weight: bold; margin-bottom: 3px;">RINCIAN REJECT / SELISIH POTONGAN:</div>
      <pre class="pre-text">+----+---------------------+-------------+---------------+-----------------+
| NO | UKURAN / RINCIAN    | KIRIM (PCS) | DITERIMA(PCS) | REJECT/KURANG   |
+----+---------------------+-------------+---------------+-----------------+
${tableRows}
+----+---------------------+-------------+---------------+-----------------+
| TOTAL KERUSAKAN / REJECT                               | ${totalRejectFormatted} |
+--------------------------------------------------------+-----------------+</pre>
    </div>

    <div style="border: 1px solid #000; padding: 6px 10px; margin-bottom: 8px;">
      <div style="font-weight: bold; text-decoration: underline; margin-bottom: 4px;">RINCIAN FINANSIAL KLAIM GANTI RUGI VENDOR:</div>
      <table style="width: 100%; font-size: 11px; font-family: inherit; border-collapse: collapse;">
        <tr>
          <td style="width: 32%; vertical-align: top;">Alasan / Kategori Kerusakan</td>
          <td style="width: 2%;">:</td>
          <td style="width: 66%; font-weight: bold;">${data.alasan_reject || "Barang Cacat / Reject di Vendor"}</td>
        </tr>
        <tr>
          <td style="vertical-align: top;">Biaya Ganti Rugi per Pcs</td>
          <td>:</td>
          <td>Rp ${Number(data.biaya_per_pcs || 0).toLocaleString("id-ID")}</td>
        </tr>
        <tr>
          <td style="vertical-align: top; font-weight: bold;">TOTAL KLAIM GANTI RUGI</td>
          <td>:</td>
          <td style="font-size: 13px; font-weight: bold;">Rp ${Number(data.total_klaim || 0).toLocaleString("id-ID")}</td>
        </tr>
        <tr>
          <td style="vertical-align: top;">Ketentuan Pembebanan</td>
          <td>:</td>
          <td>${data.tindakan_klaim === "potong_tagihan" || !data.tindakan_klaim ? "Dipotong langsung dari tagihan invoice vendor berikutnya." : data.tindakan_klaim === "ganti_barang" ? "Vendor wajib mengganti dengan barang/kain baru." : "Ganti rugi dibayarkan secara tunai / transfer bank."}</td>
        </tr>
      </table>
    </div>

    <div style="border: 1px solid #000; padding: 6px 10px; margin-bottom: 12px; background: #FFF;">
      <div style="font-weight: bold; margin-bottom: 2px;">${isPaid ? "RECORD PEMBAYARAN / PELUNASAN KLAIM RESMI:" : "STATUS PELUNASAN KLAIM:"}</div>
      ${isPaid ? `
        <div style="font-weight: bold; font-size: 12px; margin-bottom: 4px;">[ *** INVOICE RESMI - LUNAS / SELESAI DIBAYARKAN *** ]</div>
        <table style="width: 100%; font-size: 11px; font-family: inherit; border-collapse: collapse;">
          <tr>
            <td style="width: 25%;">No. Kwitansi/Ref</td>
            <td style="width: 2%;">:</td>
            <td style="width: 33%; font-weight: bold;">INV-LUNAS-${data.no_nota}</td>
            <td style="width: 20%;">Tanggal Lunas</td>
            <td style="width: 2%;">:</td>
            <td style="width: 18%; font-weight: bold;">${fmtDate(data.tanggal_selesai)}</td>
          </tr>
          <tr>
            <td>Metode Pembayaran</td>
            <td>:</td>
            <td style="font-weight: bold;">${data.metode_pembayaran || "Tunai / Potong Tagihan"}</td>
            <td>Nominal Lunas</td>
            <td>:</td>
            <td style="font-weight: bold; font-size: 12px;">Rp ${Number(data.nominal_dibayar || data.total_klaim || 0).toLocaleString("id-ID")}</td>
          </tr>
          <tr>
            <td>Catatan / Bukti Bayar</td>
            <td>:</td>
            <td colspan="4"><strong>${data.catatan_penyelesaian || "Selesai dibayar"}</strong></td>
          </tr>
        </table>
      ` : `
        <div style="font-weight: bold; font-size: 12px;">[ MENUNGGU PEMBAYARAN / PEMOTONGAN TAGIHAN ]</div>
        <div style="font-size: 10.5px; margin-top: 2px;">Tagihan belum diselesaikan oleh vendor atau belum dipotongkan pada invoice berjalan.</div>
      `}
    </div>

    <div style="display: flex; justify-content: space-around; text-align: center; margin-top: 18px; margin-bottom: 14px;">
      <div>
        <div>Petugas QC &amp; Gudang</div>
        <div style="height: 48px;"></div>
        <div style="border-top: 1px solid #000; padding-top: 3px; min-width: 170px; font-weight: bold;">
          ( Admin QC / Gudang )
        </div>
        <div style="font-size: 9.5px; margin-top: 2px;">Tgl: ___________________</div>
      </div>
      <div>
        <div>Perwakilan Vendor Terkait</div>
        <div style="height: 48px;"></div>
        <div style="border-top: 1px solid #000; padding-top: 3px; min-width: 170px; font-weight: bold;">
          ( ${data.vendor_nama || "Perwakilan Vendor"} )
        </div>
        <div style="font-size: 9.5px; margin-top: 2px;">Tgl: ___________________</div>
      </div>
    </div>

    <div style="border-top: 1px dashed #000; padding-top: 4px; font-size: 9px; display: flex; justify-content: space-between;">
      <div>* Dokumen Berita Acara sah &amp; mengikat untuk penagihan / pemotongan invoice CMT.</div>
      <div>Dicetak: ${fmtDateTime(new Date().toISOString())}</div>
    </div>
  </div>
</body>
</html>`;
  };

  // 2. Layout Simple (Dot Matrix Slip / Struk Ringkas 40-48 Kolom)
  const generateSimpleDotMatrixHtml = (data: NotaRejectData) => {
    const isPaid = data.status_klaim === "Lunas" || data.status_klaim === "Selesai";
    const rows = (data.rincian_reject && data.rincian_reject.length > 0)
      ? data.rincian_reject
      : [{ size: "ALL", dikirim: data.jumlah_kirim ?? data.jumlah_reject, diterima: data.jumlah_diterima ?? 0, reject: data.jumlah_reject }];

    const itemsText = rows.map((r: any) => {
      const label = `Size ${r.size || "-"}`.padEnd(16, " ");
      const val = `${r.reject ?? r.jumlah ?? 0} pcs`.padStart(16, " ");
      return `${label}${val}`;
    }).join("\n");

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Slip Nota Reject - ${data.no_nota}</title>
  <style>
    @page {
      size: auto;
      margin: 2mm 3mm;
    }
    body {
      margin: 0;
      padding: 0;
      background: #FFFFFF;
      color: #000000;
      font-family: "Courier New", Courier, Monaco, monospace;
      font-size: 11px;
      line-height: 1.25;
      -webkit-font-smoothing: antialiased;
    }
    .slip {
      width: 100%;
      max-width: 380px;
      margin: 0 auto;
      padding: 6px 8px;
      box-sizing: border-box;
    }
    .center {
      text-align: center;
    }
    .divider-double {
      border-top: 2px dashed #000;
      margin: 6px 0;
    }
    .divider-single {
      border-top: 1px dashed #000;
      margin: 5px 0;
    }
    .row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 2px;
    }
    .bold {
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="slip">
    <div class="center">
      <div class="bold" style="font-size: 13px; text-transform: uppercase;">${data.nama_usaha || "TIRTA BINTANG JEANS"}</div>
      <div style="font-size: 10px;">DIVISI QC &amp; GUDANG PRODUKSI</div>
      <div style="font-size: 9px;">Telp: (022) 555-8899</div>
      <div class="divider-double"></div>
      <div class="bold" style="font-size: 12px;">${isPaid ? "INVOICE LUNAS - KLAIM REJECT" : "NOTA KLAIM REJECT VENDOR"}</div>
    </div>

    <div class="divider-single"></div>

    <div class="row"><span>No. Nota</span><span class="bold">${data.no_nota}</span></div>
    <div class="row"><span>Tanggal</span><span>${fmtDate(data.tanggal_klaim)}</span></div>
    <div class="row"><span>Vendor</span><span class="bold">${data.vendor_nama || "Vendor"}</span></div>
    <div class="row"><span>SPK / PO</span><span class="bold">${data.noPo || "-"}</span></div>
    <div class="row"><span>Model</span><span>${data.model || "-"}</span></div>
    <div class="row"><span>Pos Kerja</span><span>${stageLabel(data.pos_asal)}</span></div>

    <div class="divider-single"></div>
    <div class="bold" style="margin-bottom: 3px;">RINCIAN BARANG REJECT:</div>
    <pre style="margin: 0; font-family: inherit; font-size: 11px; white-space: pre-wrap;">${itemsText}</pre>

    <div class="divider-single"></div>
    <div class="row bold">
      <span>TOTAL REJECT</span>
      <span>${data.jumlah_reject} pcs</span>
    </div>
    <div class="row">
      <span>Biaya / pcs</span>
      <span>Rp ${Number(data.biaya_per_pcs || 0).toLocaleString("id-ID")}</span>
    </div>
    <div class="row bold" style="font-size: 12px; margin-top: 3px;">
      <span>TOTAL KLAIM</span>
      <span>Rp ${Number(data.total_klaim || 0).toLocaleString("id-ID")}</span>
    </div>
    <div style="font-size: 9.5px; margin-top: 2px;">
      Alasan: ${data.alasan_reject || "Barang cacat produksi"}
    </div>

    <div class="divider-single"></div>
    <div class="row bold">
      <span>STATUS</span>
      <span>${isPaid ? "[ *** LUNAS *** ]" : "[ BELUM LUNAS ]"}</span>
    </div>
    ${isPaid ? `
      <div class="row" style="font-size: 10px;">
        <span>No. Kwitansi</span>
        <span class="bold">INV-${data.no_nota}</span>
      </div>
      <div class="row" style="font-size: 10px;">
        <span>Metode Bayar</span>
        <span>${data.metode_pembayaran || "Tunai"}</span>
      </div>
      <div class="row" style="font-size: 10px;">
        <span>Tgl Pelunasan</span>
        <span>${fmtDate(data.tanggal_selesai)}</span>
      </div>
      <div class="row bold" style="font-size: 11px;">
        <span>Nominal Lunas</span>
        <span>Rp ${Number(data.nominal_dibayar || data.total_klaim || 0).toLocaleString("id-ID")}</span>
      </div>
      ${data.catatan_penyelesaian ? `
        <div style="font-size: 9.5px; margin-top: 1px;">
          Catatan: ${data.catatan_penyelesaian}
        </div>
      ` : ""}
    ` : `
      <div style="font-size: 9.5px; color: #000;">
        Ketentuan: Potong tagihan vendor berikutnya.
      </div>
    `}

    <div class="divider-single"></div>
    <div style="display: flex; justify-content: space-between; text-align: center; margin-top: 14px; font-size: 10px;">
      <div style="width: 45%;">
        <div>Petugas QC</div>
        <div style="height: 38px;"></div>
        <div style="border-top: 1px solid #000; padding-top: 2px;">( Admin QC )</div>
      </div>
      <div style="width: 45%;">
        <div>Vendor</div>
        <div style="height: 38px;"></div>
        <div style="border-top: 1px solid #000; padding-top: 2px;">( ${data.vendor_nama || "Vendor"} )</div>
      </div>
    </div>

    <div class="divider-double"></div>
    <div class="center" style="font-size: 8.5px;">
      Dicetak: ${fmtDateTime(new Date().toISOString())}
    </div>
  </div>
</body>
</html>`;
  };

  // 3. Layout Modern / Laser / Standar (A4 Graphic)
  const generateLaserModernHtml = (data: NotaRejectData) => {
    const isPaid = data.status_klaim === "Lunas" || data.status_klaim === "Selesai";
    const rows = (data.rincian_reject && data.rincian_reject.length > 0)
      ? data.rincian_reject
      : [{ size: "Keseluruhan", dikirim: data.jumlah_kirim ?? data.jumlah_reject, diterima: data.jumlah_diterima ?? 0, reject: data.jumlah_reject }];

    const rowsHtml = rows.map((r: any) => `
      <tr style="border-bottom: 1px solid #E2E8F0;">
        <td style="padding: 9px 12px; font-weight: 700; color: #0F172A;">Size ${r.size}</td>
        <td style="padding: 9px 12px; text-align: right; color: #64748B;">${r.dikirim != null ? `${r.dikirim} pcs` : "-"}</td>
        <td style="padding: 9px 12px; text-align: right; color: #059669; font-weight: 700;">${r.diterima != null ? `${r.diterima} pcs` : "-"}</td>
        <td style="padding: 9px 12px; text-align: right; color: #DC2626; font-weight: 800;">${r.reject ?? r.jumlah ?? 0} pcs</td>
      </tr>
    `).join("");

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Nota Klaim Reject - ${data.no_nota}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm;
    }
    body {
      margin: 0;
      padding: 0;
      background: #FFFFFF;
      color: #0F172A;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 12px;
      line-height: 1.4;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      max-width: 720px;
      margin: 0 auto;
      position: relative;
    }
    .stamp {
      position: absolute;
      top: 10px;
      right: 10px;
      border: 3px solid #16A34A;
      color: #16A34A;
      padding: 6px 16px;
      border-radius: 8px;
      font-weight: 900;
      font-size: 15px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      transform: rotate(-8deg);
      background: rgba(240, 253, 244, 0.95);
      text-align: center;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    ${isPaid ? `
      <div class="stamp">
        <div>✓ LUNAS</div>
        <div style="font-size: 9px; font-weight: 700; letter-spacing: normal; text-transform: none; margin-top: 2px;">
          ${data.metode_pembayaran || "Selesai"} &bull; ${fmtDate(data.tanggal_selesai)}
        </div>
      </div>
    ` : ""}

    <div style="border-bottom: 2.5px solid #0F172A; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start;">
      <div>
        <div style="font-size: 18px; font-weight: 900; color: #0F172A;">${data.nama_usaha || "TIRTA BINTANG JEANS"}</div>
        <div style="font-size: 11px; color: #64748B; margin-top: 2px;">Spesialis Denim &amp; Celana Jeans &bull; Divisi Quality Control &amp; Gudang</div>
        <div style="font-size: 10.5px; color: #94A3B8;">Jl. Industri Konveksi No. 88 &bull; Telp: (022) 555-8899</div>
      </div>
      <div style="text-align: right; padding-right: ${isPaid ? "130px" : "0"};">
        <div style="font-size: 10.5px; font-weight: 800; color: #94A3B8;">NO. NOTA REJECT</div>
        <div style="font-size: 15px; font-weight: 900; color: #DC2626; font-family: monospace;">${data.no_nota}</div>
        <div style="font-size: 11px; color: #64748B; margin-top: 2px;">${fmtDate(data.tanggal_klaim)}</div>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px 14px; margin-bottom: 14px;">
      <div>
        <div style="font-size: 10px; font-weight: 700; color: #94A3B8; text-transform: uppercase;">Vendor Bertanggung Jawab</div>
        <div style="font-size: 13.5px; font-weight: 900; color: #0F172A; margin-top: 2px;">${data.vendor_nama || "Vendor"}</div>
        <div style="font-size: 11px; color: #64748B; margin-top: 1px;">Pos: ${stageLabel(data.pos_asal)} &rarr; ${stageLabel(data.pos_tujuan)}</div>
      </div>
      <div>
        <div style="font-size: 10px; font-weight: 700; color: #94A3B8; text-transform: uppercase;">Surat Perintah Kerja (SPK / PO)</div>
        <div style="font-size: 13.5px; font-weight: 900; color: #2563EB; font-family: monospace; margin-top: 2px;">${data.noPo || "-"}</div>
        <div style="font-size: 11px; color: #475569; margin-top: 1px;">Model: <strong>${data.model || "-"}</strong></div>
      </div>
    </div>

    ${(data.nama_kain || data.tukang_potong) ? `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 6px; padding: 7px 12px; margin-bottom: 14px; font-size: 11px;">
        <div><span style="color: #64748B;">Bahan Kain:</span> <strong style="color: #1E40AF;">${data.nama_kain || "-"}</strong></div>
        <div><span style="color: #64748B;">Tukang Potong:</span> <strong style="color: #1E40AF;">${data.tukang_potong || "-"}</strong></div>
      </div>
    ` : ""}

    <div style="margin-bottom: 16px;">
      <table style="font-size: 11.5px;">
        <thead>
          <tr style="background: #F1F5F9; border-bottom: 2px solid #CBD5E1;">
            <th style="padding: 8px 12px; text-align: left; font-weight: 800; color: #475569;">Size / Rincian</th>
            <th style="padding: 8px 12px; text-align: right; font-weight: 800; color: #475569;">Kirim</th>
            <th style="padding: 8px 12px; text-align: right; font-weight: 800; color: #475569;">Diterima Baik</th>
            <th style="padding: 8px 12px; text-align: right; font-weight: 900; color: #DC2626;">Reject / Selisih</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
        <tfoot>
          <tr style="background: #FEF2F2; border-top: 2px solid #FCA5A5;">
            <td colspan="3" style="padding: 10px 12px; font-weight: 800; color: #991B1B;">
              TOTAL REJECT / KERUSAKAN:
            </td>
            <td style="padding: 10px 12px; text-align: right; font-weight: 900; font-size: 14px; color: #DC2626;">
              ${data.jumlah_reject} pcs
            </td>
          </tr>
        </tfoot>
      </table>
    </div>

    <div style="background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 8px; padding: 12px 14px; margin-bottom: 16px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
        <span style="font-size: 11.5px; font-weight: 700; color: #92400E;">Alasan / Kategori Kerusakan:</span>
        <span style="font-size: 11.5px; font-weight: 800; color: #B45309;">${data.alasan_reject || "Reject di Vendor"}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
        <span style="font-size: 11.5px; font-weight: 700; color: #92400E;">Biaya Ganti Rugi per Pcs:</span>
        <span style="font-size: 11.5px; font-weight: 800; color: #0F172A;">Rp ${Number(data.biaya_per_pcs || 0).toLocaleString("id-ID")}</span>
      </div>
      <div style="display: flex; justify-content: space-between; border-top: 1px dashed #F59E0B; padding-top: 8px;">
        <span style="font-size: 12.5px; font-weight: 900; color: #92400E;">TOTAL KLAIM GANTI RUGI VENDOR:</span>
        <span style="font-size: 16px; font-weight: 900; color: #DC2626;">Rp ${Number(data.total_klaim || 0).toLocaleString("id-ID")}</span>
      </div>
      <div style="font-size: 10.5px; color: #78350F; margin-top: 6px; font-style: italic;">
        Ketentuan: ${data.tindakan_klaim === "potong_tagihan" || !data.tindakan_klaim ? "Dipotong langsung dari tagihan invoice vendor berikutnya." : data.tindakan_klaim === "ganti_barang" ? "Pihak vendor wajib mengganti bahan/barang baru." : "Klaim ganti rugi dibayarkan tunai/transfer oleh vendor."}
      </div>
    </div>

    ${isPaid ? `
      <div style="background: #F0FDF4; border: 1.5px solid #86EFAC; border-radius: 8px; padding: 12px 14px; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #86EFAC; padding-bottom: 6px; margin-bottom: 6px;">
          <span style="font-size: 12px; font-weight: 900; color: #166534;">BUKTI PEMBAYARAN / RECORD PELUNASAN KLAIM RESMI</span>
          <span style="font-size: 11px; font-weight: 800; color: #15803D; background: #DCFCE7; padding: 2px 8px; border-radius: 4px;">✓ LUNAS</span>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11.5px;">
          <div><span style="color: #64748B;">No. Kwitansi:</span> <strong>INV-LUNAS-${data.no_nota}</strong></div>
          <div><span style="color: #64748B;">Tanggal Lunas:</span> <strong>${fmtDate(data.tanggal_selesai)}</strong></div>
          <div><span style="color: #64748B;">Metode Pembayaran:</span> <strong>${data.metode_pembayaran || "Tunai"}</strong></div>
          <div><span style="color: #64748B;">Nominal Diterima:</span> <strong style="color: #166534; font-size: 13px;">Rp ${Number(data.nominal_dibayar || data.total_klaim || 0).toLocaleString("id-ID")}</strong></div>
          <div style="grid-column: span 2;"><span style="color: #64748B;">Catatan / Referensi:</span> <strong>${data.catatan_penyelesaian || "Selesai dibayarkan"}</strong></div>
        </div>
      </div>
    ` : ""}

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 28px; text-align: center; font-size: 11.5px;">
      <div>
        <div style="color: #64748B; margin-bottom: 48px;">${isPaid ? "Penerima / Petugas QC &amp; Gudang" : "Petugas QC &amp; Gudang"}</div>
        <div style="font-weight: 800; color: #0F172A; border-top: 1px solid #CBD5E1; padding-top: 4px; display: inline-block; min-width: 170px;">
          ( Admin QC / Gudang )
        </div>
      </div>
      <div>
        <div style="color: #64748B; margin-bottom: 48px;">${isPaid ? "Penyetor / Perwakilan Vendor" : "Perwakilan Vendor Terkait"}</div>
        <div style="font-weight: 800; color: #0F172A; border-top: 1px solid #CBD5E1; padding-top: 4px; display: inline-block; min-width: 170px;">
          ( ${data.vendor_nama || "Vendor"} )
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
  };

  // Execution Engine Print (Bebas Blank / Zero Fail)
  const executePrint = (layout: PreviewLayout) => {
    let htmlContent = "";
    if (layout === "complex") {
      htmlContent = generateComplexDotMatrixHtml(localNota);
    } else if (layout === "simple") {
      htmlContent = generateSimpleDotMatrixHtml(localNota);
    } else {
      htmlContent = generateLaserModernHtml(localNota);
    }

    // Buat invisible iframe untuk memicu print tanpa merusak modal dan tanpa popup blocker
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    iframe.style.zIndex = "-9999";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) {
      // Fallback window.open jika iframe tidak diizinkan
      const win = window.open("", "_blank", "width=850,height=900");
      if (win) {
        win.document.write(htmlContent);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 300);
      }
      return;
    }

    doc.open();
    doc.write(htmlContent);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error("Print error:", err);
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 2000);
      }
    }, 350);
  };

  const handleSendWA = () => {
    const msg =
      `*BERITA ACARA & NOTA KLAIM REJECT PRODUKSI*\n` +
      `*${localNota.nama_usaha || "TIRTA BINTANG JEANS"}*\n` +
      `---------------------------------------\n` +
      `No. Nota: *${localNota.no_nota}*\n` +
      `Status: *${isLunas ? "LUNAS / SELESAI DIBAYARKAN" : "MENUNGGU PEMBAYARAN"}*\n` +
      `Tanggal: ${fmtDate(localNota.tanggal_klaim)}\n` +
      `Vendor: *${localNota.vendor_nama || "Vendor"}*\n` +
      `PO / SPK: *${localNota.noPo || "-"}* (${localNota.model || "-"})\n` +
      `---------------------------------------\n` +
      `• Jumlah Dikirim: ${localNota.jumlah_kirim ?? localNota.jumlah_reject} pcs\n` +
      `• Diterima Baik: ${localNota.jumlah_diterima ?? 0} pcs\n` +
      `• *Reject / Selisih: ${localNota.jumlah_reject} pcs*\n` +
      (localNota.rincian_reject?.length
        ? `• Rincian Size: ${localNota.rincian_reject.map((r: any) => `${r.size}: ${r.jumlah ?? r.reject ?? 0} pcs`).join(", ")}\n`
        : "") +
      `• Alasan: ${localNota.alasan_reject || "-"}\n` +
      `• *TOTAL KLAIM GANTI RUGI: Rp ${Number(localNota.total_klaim || 0).toLocaleString("id-ID")}*\n` +
      `• Ketentuan: ${localNota.tindakan_klaim === "potong_tagihan" ? "Dipotong langsung dari tagihan invoice vendor berikutnya" : localNota.tindakan_klaim === "ganti_barang" ? "Vendor mengganti barang baru" : "Ganti rugi tunai / transfer"}\n` +
      (isLunas ? `\n*KLAIM INI SUDAH LUNAS / SELESAI DIBAYARKAN*\nMetode: ${localNota.metode_pembayaran || "-"}\nTanggal: ${fmtDate(localNota.tanggal_selesai)}\nCatatan: ${localNota.catatan_penyelesaian || "-"}\n` : "") +
      `---------------------------------------\n` +
      `Terima kasih atas kerja samanya.`;

    if (cleanHp) {
      window.open(`https://wa.me/${cleanHp}?text=${encodeURIComponent(msg)}`, "_blank");
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
    }
  };

  const handleSettleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingPay(true);
    try {
      const res = await fetch("/api/nota-reject", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: localNota.id,
          status_klaim: "Lunas",
          metode_pembayaran: payMetode,
          nominal_dibayar: Number(payNominal) || Number(localNota.total_klaim || 0),
          catatan_penyelesaian: payCatatan.trim() || `Selesai dibayar via ${payMetode}`,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Gagal mencatat pelunasan klaim");
      setLocalNota(d);
      setShowPayForm(false);
      toast.success(`Nota Klaim #${localNota.no_nota} berhasil ditandai LUNAS!`);
      if (onSettled) onSettled(d);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmittingPay(false);
    }
  };

  const handleCancelReject = async () => {
    const isPaid = localNota.status_klaim === "Lunas" || localNota.status_klaim === "Selesai";
    const confirmed = window.confirm(
      `Yakin ingin MEMBATALKAN pengajuan reject #${localNota.no_nota}?\n\n` +
      `• Sisa ${localNota.jumlah_reject} pcs akan DIKEMBALIKAN ke status pengerjaan vendor (${localNota.vendor_nama || "Vendor"}).\n` +
      `• Tagihan ganti rugi Rp ${Number(localNota.total_klaim || 0).toLocaleString("id-ID")} akan dibatalkan/dihapus.\n` +
      (isPaid ? `• PERHATIAN: Status saat ini sudah LUNAS. Pembatalan juga akan menghapus riwayat potongan/pembayaran!\n` : "") +
      `• Dokumen Berita Acara & Nota Reject ini akan dihapus dari sistem.`
    );
    if (!confirmed) return;

    setSubmittingCancel(true);
    try {
      const res = await fetch(`/api/nota-reject?id=${localNota.id}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Gagal membatalkan pengajuan reject");
      toast.success(d.message || "Pengajuan reject berhasil dibatalkan!");
      if (onCancelReject) onCancelReject(d.deleted_nota || localNota);
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmittingCancel(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 16 }}>
      <div style={{ background: "#FFFFFF", borderRadius: 16, width: "100%", maxWidth: 740, maxHeight: "94vh", display: "flex", flexDirection: "column", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)", position: "relative", overflow: "hidden" }}>
        
        {/* Header bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 900, color: "#DC2626" }}>
            <AlertOctagon size={18} />
            <span>NOTA KLAIM &amp; BERITA ACARA REJECT VENDOR</span>
          </div>
          <button type="button" onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#64748B" }}>
            <X size={18} />
          </button>
        </div>

        {/* Status Pembayaran / Pelunasan Bar */}
        <div style={{ padding: "10px 20px", background: isLunas ? "#F0FDF4" : "#FFFBEB", borderBottom: `1px solid ${isLunas ? "#BBF7D0" : "#FDE68A"}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {isLunas ? (
                <>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#16A34A", color: "#FFFFFF", fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 6 }}>
                    <CheckCircle2 size={13} /> KLAIM LUNAS / SELESAI
                  </span>
                  <span style={{ fontSize: 11.5, color: "#166534" }}>
                    Metode: <strong>{localNota.metode_pembayaran || "Tunai"}</strong>
                    {localNota.nominal_dibayar ? ` (Rp ${Number(localNota.nominal_dibayar).toLocaleString("id-ID")})` : ""}
                    {localNota.catatan_penyelesaian ? ` &bull; ${localNota.catatan_penyelesaian}` : ""}
                  </span>
                </>
              ) : (
                <>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#DC2626", color: "#FFFFFF", fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 6 }}>
                    <AlertOctagon size={13} /> BELUM DIBAYAR / DIAJUKAN
                  </span>
                  <span style={{ fontSize: 11.5, color: "#92400E" }}>
                    Total tagihan klaim: <strong>Rp {Number(localNota.total_klaim || 0).toLocaleString("id-ID")}</strong>
                  </span>
                </>
              )}
            </div>

            {!readOnly && !isLunas && !showPayForm && (
              <button
                type="button"
                onClick={() => setShowPayForm(true)}
                style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#059669", color: "#FFFFFF", border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 11.5, fontWeight: 800, cursor: "pointer", boxShadow: "0 1px 3px rgba(5,150,105,0.2)" }}
              >
                <DollarSign size={13} /> Catat Pembayaran / Pelunasan
              </button>
            )}
          </div>

          {/* Form Pelunasan */}
          {!readOnly && showPayForm && !isLunas && (
            <form onSubmit={handleSettleClaim} style={{ marginTop: 10, background: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#0F172A", marginBottom: 8 }}>
                Form Konfirmasi Pembayaran / Pemotongan Tagihan Ganti Rugi
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#475569", display: "block", marginBottom: 3 }}>Metode Pembayaran</label>
                  <select
                    className="gs-input"
                    value={payMetode}
                    onChange={(e) => setPayMetode(e.target.value)}
                    style={{ fontSize: 12, width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #CBD5E1" }}
                  >
                    <option value="Tunai">Ganti Rugi Tunai (Cash)</option>
                    <option value="Transfer Bank">Transfer Bank</option>
                    <option value="potong_tagihan">Potong Tagihan Vendor</option>
                    <option value="Ganti Barang">Vendor Ganti Barang Baru</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#475569", display: "block", marginBottom: 3 }}>Nominal Diterima / Dipotong (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    value={payNominal}
                    onChange={(e) => setPayNominal(Number(e.target.value) || 0)}
                    style={{ fontSize: 12, width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #CBD5E1", boxSizing: "border-box" }}
                  />
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#475569", display: "block", marginBottom: 3 }}>Catatan / Referensi Bukti Bayar</label>
                <input
                  type="text"
                  placeholder="Misal: Diterima tunai di kantor / Potong tagihan invoice CMT washing"
                  value={payCatatan}
                  onChange={(e) => setPayCatatan(e.target.value)}
                  style={{ fontSize: 12, width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #CBD5E1", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowPayForm(false)}
                  style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #CBD5E1", background: "#FFFFFF", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingPay}
                  style={{ padding: "5px 14px", borderRadius: 6, border: "none", background: "#16A34A", color: "#FFFFFF", fontSize: 11.5, fontWeight: 800, cursor: "pointer" }}
                >
                  {submittingPay ? "Menyimpan..." : "Simpan & Tandai Lunas"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Tab Switcher: Pilih Format Tampilan & Layout Cetak */}
        <div style={{ padding: "8px 20px", background: "#F1F5F9", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: "#475569", marginRight: 4 }}>Mode Tampilan:</span>
            
            <button
              type="button"
              onClick={() => setActivePreview("modern")}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                fontSize: 11.5,
                fontWeight: 700,
                border: activePreview === "modern" ? "1.5px solid #2563EB" : "1px solid #CBD5E1",
                background: activePreview === "modern" ? "#EFF6FF" : "#FFFFFF",
                color: activePreview === "modern" ? "#1D4ED8" : "#475569",
                cursor: "pointer"
              }}
            >
              📄 Modern (A4 / Laser)
            </button>

            <button
              type="button"
              onClick={() => setActivePreview("complex")}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                fontSize: 11.5,
                fontWeight: 700,
                border: activePreview === "complex" ? "1.5px solid #0F172A" : "1px solid #CBD5E1",
                background: activePreview === "complex" ? "#0F172A" : "#FFFFFF",
                color: activePreview === "complex" ? "#FFFFFF" : "#475569",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4
              }}
            >
              🖨️ Dot Matrix (Kompleks)
            </button>

            <button
              type="button"
              onClick={() => setActivePreview("simple")}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                fontSize: 11.5,
                fontWeight: 700,
                border: activePreview === "simple" ? "1.5px solid #D97706" : "1px solid #CBD5E1",
                background: activePreview === "simple" ? "#FFFBEB" : "#FFFFFF",
                color: activePreview === "simple" ? "#B45309" : "#475569",
                cursor: "pointer"
              }}
            >
              ⚡ Dot Matrix (Simple Slip)
            </button>
          </div>

          <div style={{ fontSize: 10.5, color: "#64748B" }}>
            {activePreview === "complex" && "Continuous Form 80-Kolom / 3-Ply NCR"}
            {activePreview === "simple" && "Slip Ringkas 40-Kolom / Struk Cepat"}
            {activePreview === "modern" && "Format Grafis Lengkap Berwarna"}
          </div>
        </div>

        {/* Scrollable Preview Area */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", background: activePreview === "modern" ? "#FFFFFF" : "#F8FAFC" }}>
          
          {/* 1. PREVIEW: MODERN A4 */}
          {activePreview === "modern" && (
            <div style={{ position: "relative" }}>
              {isLunas && (
                <div style={{
                  position: "absolute",
                  top: 24,
                  right: 24,
                  border: "3.5px solid #16A34A",
                  color: "#16A34A",
                  padding: "6px 16px",
                  borderRadius: 8,
                  fontWeight: 900,
                  fontSize: 15,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  transform: "rotate(-10deg)",
                  boxShadow: "0 0 0 3px rgba(22,163,74,0.15)",
                  background: "rgba(240, 253, 244, 0.95)",
                  textAlign: "center",
                  pointerEvents: "none",
                  zIndex: 10,
                }}>
                  <div>✓ LUNAS</div>
                  <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "normal", textTransform: "none", marginTop: 2, color: "#15803D" }}>
                    {localNota.metode_pembayaran || "Selesai"} &bull; {fmtDate(localNota.tanggal_selesai)}
                  </div>
                </div>
              )}

              {/* Kop Surat Konveksi */}
              <div style={{ borderBottom: "2px solid #0F172A", paddingBottom: 12, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#0F172A", letterSpacing: "0.03em" }}>{localNota.nama_usaha || "TIRTA BINTANG JEANS"}</div>
                  <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>Spesialis Denim &amp; Celana Jeans &bull; Divisi Quality Control &amp; Gudang</div>
                  <div style={{ fontSize: 10.5, color: "#94A3B8" }}>Jl. Industri Konveksi No. 88 &bull; Telp: (022) 555-8899</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10.5, fontWeight: 800, color: "#94A3B8" }}>NO. NOTA REJECT</div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: "#DC2626", fontFamily: "monospace" }}>{localNota.no_nota}</div>
                  <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>{fmtDate(localNota.tanggal_klaim)}</div>
                </div>
              </div>

              {/* Vendor & PO Details */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: "12px 14px", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>Vendor Bertanggung Jawab</div>
                  <div style={{ fontSize: 13.5, fontWeight: 900, color: "#0F172A", marginTop: 2 }}>{localNota.vendor_nama || "Vendor"}</div>
                  <div style={{ fontSize: 11, color: "#64748B", marginTop: 1 }}>Pos: {stageLabel(localNota.pos_asal)} &rarr; {stageLabel(localNota.pos_tujuan)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>Surat Perintah Kerja (SPK / PO)</div>
                  <div style={{ fontSize: 13.5, fontWeight: 900, color: "#2563EB", fontFamily: "monospace", marginTop: 2 }}>{localNota.noPo || "-"}</div>
                  <div style={{ fontSize: 11, color: "#475569", marginTop: 1 }}>Model: <strong>{localNota.model || "-"}</strong></div>
                </div>
              </div>

              {/* Detail Kain & Tukang Potong */}
              {(localNota.nama_kain || localNota.tukang_potong) && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 6, padding: "7px 12px", marginBottom: 14, fontSize: 11.5 }}>
                  <div>
                    <span style={{ color: "#64748B" }}>Bahan Kain:</span>{" "}
                    <strong style={{ color: "#1E40AF" }}>{localNota.nama_kain || "-"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748B" }}>Tukang Potong:</span>{" "}
                    <strong style={{ color: "#1E40AF" }}>{localNota.tukang_potong || "-"}</strong>
                  </div>
                </div>
              )}

              {/* Rincian Reject Table */}
              <div style={{ marginBottom: 16 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#F1F5F9", borderBottom: "1.5px solid #CBD5E1" }}>
                      <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 800, color: "#475569" }}>Size / Rincian</th>
                      <th style={{ padding: "8px 10px", textAlign: "right", fontWeight: 800, color: "#475569" }}>Kirim</th>
                      <th style={{ padding: "8px 10px", textAlign: "right", fontWeight: 800, color: "#475569" }}>Diterima Baik</th>
                      <th style={{ padding: "8px 10px", textAlign: "right", fontWeight: 900, color: "#DC2626" }}>Reject / Kurang</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(localNota.rincian_reject || []).length > 0 ? (
                      localNota.rincian_reject!.map((r: any, idx: number) => (
                        <tr key={idx} style={{ borderBottom: "1px solid #E2E8F0" }}>
                          <td style={{ padding: "8px 10px", fontWeight: 900, color: "#0F172A" }}>Size {r.size}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", color: "#64748B" }}>{r.dikirim != null ? `${r.dikirim} pcs` : "-"}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", color: "#059669", fontWeight: 800 }}>{r.diterima != null ? `${r.diterima} pcs` : "-"}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", color: "#DC2626", fontWeight: 900 }}>{r.reject ?? r.jumlah ?? 0} pcs</td>
                        </tr>
                      ))
                    ) : (
                      <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                        <td style={{ padding: "8px 10px", fontWeight: 900, color: "#0F172A" }}>Total Keseluruhan</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#64748B" }}>{localNota.jumlah_kirim ?? localNota.jumlah_reject} pcs</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#059669", fontWeight: 800 }}>{localNota.jumlah_diterima ?? 0} pcs</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#DC2626", fontWeight: 900 }}>{localNota.jumlah_reject} pcs</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "#FEF2F2", borderTop: "2px solid #FCA5A5" }}>
                      <td colSpan={3} style={{ padding: "10px", fontWeight: 800, color: "#991B1B" }}>
                        TOTAL REJECT / KERUSAKAN:
                      </td>
                      <td style={{ padding: "10px", textAlign: "right", fontWeight: 900, fontSize: 15, color: "#DC2626" }}>
                        {localNota.jumlah_reject} pcs
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Rincian Klaim Finansial */}
              <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "12px 14px", marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#92400E" }}>Alasan / Kategori Kerusakan:</span>
                  <span style={{ fontSize: 12, fontWeight: 900, color: "#B45309" }}>{localNota.alasan_reject || "Reject di Vendor"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#92400E" }}>Biaya Ganti Rugi per Pcs:</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#0F172A" }}>Rp {Number(localNota.biaya_per_pcs || 0).toLocaleString("id-ID")}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px dashed #F59E0B", paddingTop: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 900, color: "#92400E" }}>TOTAL KLAIM GANTI RUGI VENDOR:</span>
                  <span style={{ fontSize: 17, fontWeight: 900, color: "#DC2626" }}>Rp {Number(localNota.total_klaim || 0).toLocaleString("id-ID")}</span>
                </div>
                <div style={{ fontSize: 11, color: "#78350F", marginTop: 6, fontStyle: "italic" }}>
                  Ketentuan: {localNota.tindakan_klaim === "potong_tagihan" || !localNota.tindakan_klaim ? "Dipotong langsung dari tagihan invoice vendor berikutnya." : localNota.tindakan_klaim === "ganti_barang" ? "Pihak vendor wajib mengganti bahan/barang baru." : "Klaim ganti rugi dibayarkan tunai/transfer oleh vendor."}
                </div>
              </div>

              {/* Signatures */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 20, textAlign: "center", fontSize: 11.5 }}>
                <div>
                  <div style={{ color: "#64748B", marginBottom: 40 }}>Petugas QC &amp; Gudang</div>
                  <div style={{ fontWeight: 800, color: "#0F172A", borderTop: "1px solid #CBD5E1", paddingTop: 4, display: "inline-block", minWidth: 160 }}>
                    ( Admin QC / Gudang )
                  </div>
                </div>
                <div>
                  <div style={{ color: "#64748B", marginBottom: 40 }}>Perwakilan Vendor Terkait</div>
                  <div style={{ fontWeight: 800, color: "#0F172A", borderTop: "1px solid #CBD5E1", paddingTop: 4, display: "inline-block", minWidth: 160 }}>
                    ( {localNota.vendor_nama || "Vendor"} )
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. PREVIEW: DOT MATRIX KOMPLEKS (Continuous Form 80-Kolom) */}
          {activePreview === "complex" && (
            <div style={{
              background: "#FFFFFF",
              border: "1px solid #000000",
              padding: "16px 20px",
              fontFamily: "'Courier New', Courier, Monaco, monospace",
              color: "#000000",
              fontSize: 12,
              lineHeight: 1.3,
              boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)"
            }}>
              {/* Header Monospace */}
              <div style={{ borderBottom: "2px solid #000000", paddingBottom: 8, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: "bold", textTransform: "uppercase" }}>{localNota.nama_usaha || "TIRTA BINTANG JEANS"}</div>
                  <div style={{ fontSize: 11 }}>Spesialis Denim &amp; Celana Jeans - Divisi QC &amp; Gudang</div>
                  <div style={{ fontSize: 10 }}>Jl. Industri Konveksi No. 88 | Telp: (022) 555-8899</div>
                </div>
                <div style={{ border: "1px solid #000", padding: "4px 8px", fontSize: 10, lineHeight: 1.25, textAlign: "left" }}>
                  <div style={{ fontWeight: "bold", textDecoration: "underline" }}>DISTRIBUSI RANGKAP (3-PLY NCR):</div>
                  <div>[X] PUTIH  : Arsip Kantor / Keuangan</div>
                  <div>[ ] MERAH  : Perwakilan Vendor</div>
                  <div>[ ] KUNING : Arsip Bagian Gudang</div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: 13, marginBottom: 6 }}>
                <div>BERITA ACARA &amp; NOTA KLAIM REJECT PRODUKSI</div>
                <div>NO: {localNota.no_nota}</div>
              </div>

              <div style={{ borderTop: "1px solid #000", borderBottom: "1px solid #000", padding: "6px 0", marginBottom: 8, fontSize: 11.5 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    <tr>
                      <td style={{ width: "24%", fontWeight: "bold" }}>Vendor Bertanggung Jawab</td>
                      <td style={{ width: "2%" }}>:</td>
                      <td style={{ width: "36%", fontWeight: "bold" }}>{localNota.vendor_nama || "Vendor"}</td>
                      <td style={{ width: "16%", fontWeight: "bold" }}>No. SPK / PO</td>
                      <td style={{ width: "2%" }}>:</td>
                      <td style={{ width: "20%", fontWeight: "bold" }}>{localNota.noPo || "-"}</td>
                    </tr>
                    <tr>
                      <td>Pos / Tahap</td>
                      <td>:</td>
                      <td>{stageLabel(localNota.pos_asal)} &rarr; {stageLabel(localNota.pos_tujuan)}</td>
                      <td>Model Celana</td>
                      <td>:</td>
                      <td>{localNota.model || "-"}</td>
                    </tr>
                    <tr>
                      <td>Tanggal Klaim</td>
                      <td>:</td>
                      <td>{fmtDate(localNota.tanggal_klaim)}</td>
                      <td>Tukang Potong</td>
                      <td>:</td>
                      <td>{localNota.tukang_potong || "-"}</td>
                    </tr>
                    <tr>
                      <td>Bahan / Kain</td>
                      <td>:</td>
                      <td>{localNota.nama_kain || "-"}</td>
                      <td>Kontak Vendor</td>
                      <td>:</td>
                      <td>{localNota.vendor_kontak || "-"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Monospace ASCII Table Grid */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontWeight: "bold", marginBottom: 4 }}>RINCIAN REJECT / SELISIH POTONGAN:</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, border: "1px solid #000" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #000", background: "#F1F5F9" }}>
                      <th style={{ borderRight: "1px solid #000", padding: "4px 8px", textAlign: "left", width: "8%" }}>NO</th>
                      <th style={{ borderRight: "1px solid #000", padding: "4px 8px", textAlign: "left" }}>UKURAN / RINCIAN</th>
                      <th style={{ borderRight: "1px solid #000", padding: "4px 8px", textAlign: "right", width: "20%" }}>KIRIM</th>
                      <th style={{ borderRight: "1px solid #000", padding: "4px 8px", textAlign: "right", width: "20%" }}>DITERIMA</th>
                      <th style={{ padding: "4px 8px", textAlign: "right", width: "22%" }}>REJECT / KURANG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(localNota.rincian_reject && localNota.rincian_reject.length > 0) ? (
                      localNota.rincian_reject.map((r: any, idx: number) => (
                        <tr key={idx} style={{ borderBottom: "1px solid #000" }}>
                          <td style={{ borderRight: "1px solid #000", padding: "4px 8px" }}>{idx + 1}</td>
                          <td style={{ borderRight: "1px solid #000", padding: "4px 8px", fontWeight: "bold" }}>Size {r.size}</td>
                          <td style={{ borderRight: "1px solid #000", padding: "4px 8px", textAlign: "right" }}>{r.dikirim != null ? `${r.dikirim} pcs` : "-"}</td>
                          <td style={{ borderRight: "1px solid #000", padding: "4px 8px", textAlign: "right" }}>{r.diterima != null ? `${r.diterima} pcs` : "-"}</td>
                          <td style={{ padding: "4px 8px", textAlign: "right", fontWeight: "bold" }}>{r.reject ?? r.jumlah ?? 0} pcs</td>
                        </tr>
                      ))
                    ) : (
                      <tr style={{ borderBottom: "1px solid #000" }}>
                        <td style={{ borderRight: "1px solid #000", padding: "4px 8px" }}>1</td>
                        <td style={{ borderRight: "1px solid #000", padding: "4px 8px", fontWeight: "bold" }}>Total Keseluruhan</td>
                        <td style={{ borderRight: "1px solid #000", padding: "4px 8px", textAlign: "right" }}>{localNota.jumlah_kirim ?? localNota.jumlah_reject} pcs</td>
                        <td style={{ borderRight: "1px solid #000", padding: "4px 8px", textAlign: "right" }}>{localNota.jumlah_diterima ?? 0} pcs</td>
                        <td style={{ padding: "4px 8px", textAlign: "right", fontWeight: "bold" }}>{localNota.jumlah_reject} pcs</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: "bold", background: "#F8FAFC" }}>
                      <td colSpan={4} style={{ borderRight: "1px solid #000", padding: "6px 8px" }}>TOTAL KERUSAKAN / REJECT:</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", fontSize: 13 }}>{localNota.jumlah_reject} pcs</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Monospace Finansial Box */}
              <div style={{ border: "1px solid #000", padding: "6px 10px", marginBottom: 8, fontSize: 11.5 }}>
                <div style={{ fontWeight: "bold", textDecoration: "underline", marginBottom: 3 }}>RINCIAN FINANSIAL KLAIM GANTI RUGI VENDOR:</div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Alasan / Kategori Kerusakan</span>
                  <span style={{ fontWeight: "bold" }}>{localNota.alasan_reject || "Barang Cacat / Reject di Vendor"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Biaya Ganti Rugi per Pcs</span>
                  <span>Rp {Number(localNota.biaya_per_pcs || 0).toLocaleString("id-ID")}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed #000", paddingTop: 4, marginTop: 4, fontWeight: "bold", fontSize: 13 }}>
                  <span>TOTAL KLAIM GANTI RUGI VENDOR</span>
                  <span>Rp {Number(localNota.total_klaim || 0).toLocaleString("id-ID")}</span>
                </div>
                <div style={{ fontSize: 10.5, marginTop: 4 }}>
                  Ketentuan: {localNota.tindakan_klaim === "potong_tagihan" || !localNota.tindakan_klaim ? "Dipotong langsung dari tagihan invoice vendor berikutnya." : localNota.tindakan_klaim === "ganti_barang" ? "Vendor wajib mengganti dengan barang/kain baru." : "Ganti rugi dibayarkan secara tunai / transfer bank."}
                </div>
              </div>

              {/* Monospace Status Box */}
              <div style={{ border: "1px solid #000", padding: "6px 10px", marginBottom: 12, fontSize: 11.5 }}>
                <div style={{ fontWeight: "bold", marginBottom: 2 }}>STATUS PELUNASAN KLAIM:</div>
                {isLunas ? (
                  <>
                    <div style={{ fontWeight: "bold", fontSize: 12 }}>[ *** LUNAS / SELESAI DIBAYARKAN *** ]</div>
                    <div style={{ fontSize: 10.5, marginTop: 2 }}>
                      Metode: <strong>{localNota.metode_pembayaran || "Tunai"}</strong>
                      {localNota.nominal_dibayar ? ` &bull; Nominal: Rp ${Number(localNota.nominal_dibayar).toLocaleString("id-ID")}` : ""}
                      &bull; Tanggal: {fmtDate(localNota.tanggal_selesai)}
                    </div>
                    {localNota.catatan_penyelesaian && <div style={{ fontSize: 10.5, marginTop: 1 }}>Catatan: {localNota.catatan_penyelesaian}</div>}
                  </>
                ) : (
                  <>
                    <div style={{ fontWeight: "bold", fontSize: 12 }}>[ MENUNGGU PEMBAYARAN / PEMOTONGAN TAGIHAN ]</div>
                    <div style={{ fontSize: 10.5, marginTop: 2 }}>Klaim ini akan memotong tagihan invoice CMT vendor bersangkutan.</div>
                  </>
                )}
              </div>

              {/* Tanda Tangan */}
              <div style={{ display: "flex", justifyContent: "space-around", textAlign: "center", marginTop: 16, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 11 }}>Petugas QC &amp; Gudang</div>
                  <div style={{ height: 42 }}></div>
                  <div style={{ borderTop: "1px solid #000", paddingTop: 2, minWidth: 160, fontWeight: "bold", fontSize: 11 }}>
                    ( Admin QC / Gudang )
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11 }}>Perwakilan Vendor Terkait</div>
                  <div style={{ height: 42 }}></div>
                  <div style={{ borderTop: "1px solid #000", paddingTop: 2, minWidth: 160, fontWeight: "bold", fontSize: 11 }}>
                    ( {localNota.vendor_nama || "Vendor"} )
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. PREVIEW: DOT MATRIX SIMPLE (Slip Ringkas 40-Kolom) */}
          {activePreview === "simple" && (
            <div style={{
              background: "#FFFFFF",
              border: "1px dashed #000000",
              maxWidth: 380,
              margin: "0 auto",
              padding: "14px 16px",
              fontFamily: "'Courier New', Courier, Monaco, monospace",
              color: "#000000",
              fontSize: 11.5,
              lineHeight: 1.25,
              boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)"
            }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontWeight: "bold", fontSize: 13, textTransform: "uppercase" }}>{localNota.nama_usaha || "TIRTA BINTANG JEANS"}</div>
                <div style={{ fontSize: 10 }}>DIVISI QC &amp; GUDANG PRODUKSI</div>
                <div style={{ fontSize: 9 }}>Telp: (022) 555-8899</div>
                <div style={{ borderTop: "2px dashed #000", margin: "6px 0" }}></div>
                <div style={{ fontWeight: "bold", fontSize: 12 }}>NOTA KLAIM REJECT VENDOR</div>
                <div style={{ borderTop: "1px dashed #000", margin: "5px 0" }}></div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                <span>No. Nota</span><span style={{ fontWeight: "bold" }}>{localNota.no_nota}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                <span>Tanggal</span><span>{fmtDate(localNota.tanggal_klaim)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                <span>Vendor</span><span style={{ fontWeight: "bold" }}>{localNota.vendor_nama || "Vendor"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                <span>SPK / PO</span><span style={{ fontWeight: "bold" }}>{localNota.noPo || "-"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                <span>Model</span><span>{localNota.model || "-"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                <span>Pos Kerja</span><span>{stageLabel(localNota.pos_asal)}</span>
              </div>

              <div style={{ borderTop: "1px dashed #000", margin: "5px 0" }}></div>
              <div style={{ fontWeight: "bold", marginBottom: 3 }}>RINCIAN BARANG REJECT:</div>
              {(localNota.rincian_reject && localNota.rincian_reject.length > 0) ? (
                localNota.rincian_reject.map((r: any, idx: number) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", marginBottom: 1 }}>
                    <span>Size {r.size}</span>
                    <span style={{ fontWeight: "bold" }}>{r.reject ?? r.jumlah ?? 0} pcs</span>
                  </div>
                ))
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Total Reject</span>
                  <span style={{ fontWeight: "bold" }}>{localNota.jumlah_reject} pcs</span>
                </div>
              )}

              <div style={{ borderTop: "1px dashed #000", margin: "5px 0" }}></div>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
                <span>TOTAL REJECT</span>
                <span>{localNota.jumlah_reject} pcs</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Biaya / pcs</span>
                <span>Rp {Number(localNota.biaya_per_pcs || 0).toLocaleString("id-ID")}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: 13, marginTop: 3 }}>
                <span>TOTAL KLAIM</span>
                <span>Rp {Number(localNota.total_klaim || 0).toLocaleString("id-ID")}</span>
              </div>
              <div style={{ fontSize: 9.5, marginTop: 2 }}>
                Alasan: {localNota.alasan_reject || "Barang cacat produksi"}
              </div>

              <div style={{ borderTop: "1px dashed #000", margin: "5px 0" }}></div>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
                <span>STATUS</span>
                <span>{isLunas ? "[ LUNAS ]" : "[ BELUM LUNAS ]"}</span>
              </div>
              {isLunas ? (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
                    <span>Metode</span>
                    <span>{localNota.metode_pembayaran || "Tunai"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
                    <span>Tgl Bayar</span>
                    <span>{fmtDate(localNota.tanggal_selesai)}</span>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 9.5 }}>Ketentuan: Potong tagihan berikutnya.</div>
              )}

              <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }}></div>
              <div style={{ display: "flex", justifyContent: "space-between", textAlign: "center", marginTop: 12, fontSize: 10 }}>
                <div style={{ width: "45%" }}>
                  <div>Petugas QC</div>
                  <div style={{ height: 32 }}></div>
                  <div style={{ borderTop: "1px solid #000", paddingTop: 2 }}>( Admin QC )</div>
                </div>
                <div style={{ width: "45%" }}>
                  <div>Vendor</div>
                  <div style={{ height: 32 }}></div>
                  <div style={{ borderTop: "1px solid #000", paddingTop: 2 }}>( {localNota.vendor_nama || "Vendor"} )</div>
                </div>
              </div>

              <div style={{ borderTop: "2px dashed #000", margin: "6px 0" }}></div>
              <div style={{ textAlign: "center", fontSize: 8.5 }}>
                Dicetak: {fmtDateTime(new Date().toISOString())}
              </div>
            </div>
          )}

        </div>

        {/* Modal Actions Footer */}
        <div style={{ padding: "14px 20px", borderTop: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #CBD5E1", background: "#FFFFFF", color: "#475569", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}
            >
              Tutup
            </button>

            {!readOnly && (
            <button
              type="button"
              disabled={submittingCancel}
              onClick={handleCancelReject}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid #FECACA",
                background: "#FEF2F2",
                color: "#DC2626",
                fontWeight: 800,
                fontSize: 12,
                cursor: submittingCancel ? "not-allowed" : "pointer",
                boxShadow: "0 1px 2px rgba(220,38,38,0.06)"
              }}
              title="Batalkan pengajuan reject ini dan kembalikan sisa barang ke vendor"
            >
              <RotateCcw size={14} /> {submittingCancel ? "Membatalkan..." : "Batalkan Pengajuan Reject"}
            </button>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, position: "relative" }}>
            <button
              type="button"
              onClick={handleSendWA}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 15px", borderRadius: 8, border: "none", background: "#16A34A", color: "#FFFFFF", fontWeight: 800, fontSize: 12.5, cursor: "pointer", boxShadow: "0 2px 6px rgba(22,163,74,0.3)" }}
            >
              <MessageCircle size={15} /> WhatsApp
            </button>

            {/* Split / Direct Print Buttons */}
            <button
              type="button"
              onClick={() => executePrint("complex")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 8,
                border: "none",
                background: isLunas ? "#166534" : "#0F172A",
                color: "#FFFFFF",
                fontWeight: 800,
                fontSize: 12.5,
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(15,23,42,0.3)"
              }}
              title={isLunas ? "Cetak Invoice Lunas format Continuous Form 80-Kolom" : "Cetak format Continuous Form 80-Kolom untuk Printer Dot Matrix (Epson LX/LQ)"}
            >
              <Printer size={15} /> {isLunas ? "Cetak Invoice Lunas (Kompleks)" : "Cetak Dot Matrix (Kompleks)"}
            </button>

            <button
              type="button"
              onClick={() => executePrint("simple")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "8px 13px",
                borderRadius: 8,
                border: "1px solid #D97706",
                background: "#FFFBEB",
                color: "#B45309",
                fontWeight: 800,
                fontSize: 12.5,
                cursor: "pointer"
              }}
              title={isLunas ? "Cetak Kuitansi Lunas format Struk Kasir / Mini Dot Matrix" : "Cetak format Slip Ringkas Kasir / Struk Cepat Dot Matrix"}
            >
              ⚡ {isLunas ? "Kuitansi Lunas (Simple)" : "Dot Matrix (Simple)"}
            </button>

            <button
              type="button"
              onClick={() => executePrint("modern")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "8px 13px",
                borderRadius: 8,
                border: isLunas ? "1.5px solid #86EFAC" : "1px solid #CBD5E1",
                background: isLunas ? "#F0FDF4" : "#FFFFFF",
                color: isLunas ? "#166534" : "#1E293B",
                fontWeight: 800,
                fontSize: 12.5,
                cursor: "pointer"
              }}
              title="Cetak format Grafis Berwarna untuk Printer Laser / A4 / Simpan PDF"
            >
              📄 {isLunas ? "Invoice Lunas (Laser / PDF)" : "Laser / PDF"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
