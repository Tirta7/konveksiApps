"use client";
/**
 * Cetak label hangtag barang jadi (barcode per pcs) di jendela terpisah.
 * Khusus untuk printer thermal / roll Zebra ZD230 dengan rol kertas 1 kolom memanjang.
 * Mendukung mode 40×30 mm (Landscape) dan mode 30×40 mm (Portrait Hangtag).
 */
// @ts-ignore — jsbarcode tidak menyediakan type definitions
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";

export type LabelPcs = {
  kode: string;
  nama_barang: string;
  size: string;
  sku?: string | null;
  harga_jual?: number;
  noPo?: string;
};

export type PrintLabelOptions = {
  namaUsaha?: string;
  ukuran?: "40x30" | "50x30" | "30x40";
  showNama?: boolean;
  showSize?: boolean;
  showSku?: boolean;
  showHarga?: boolean;
  showQr?: boolean;
};

function qrSvg(code: string): string {
  let res = "";
  try {
    (QRCode as any).toString(code, { type: "svg", margin: 0 }, (err: any, svg: string) => {
      if (!err && svg) {
        res = svg.replace("<svg ", '<svg width="100%" height="100%" style="width:100%;height:100%;display:block;" ');
      }
    });
  } catch {}
  return res || `<div style="font:700 10px monospace">${code}</div>`;
}

function barcodeSvg(code: string, mode: "40x30" | "30x40" | "50x30" = "40x30"): string {
  if (typeof document === "undefined") {
    return `<div style="font:700 10px monospace">${code}</div>`;
  }
  try {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const is30 = mode === "30x40";
    const is50 = mode === "50x30";

    (JsBarcode as any)(svg, code, {
      format: "CODE128",
      width: is30 ? 1.15 : is50 ? 1.6 : 1.35,
      height: is30 ? 22 : is50 ? 38 : 28,
      displayValue: true,
      fontSize: is30 ? 8.5 : is50 ? 11 : 9.5,
      margin: 0,
      textMargin: is30 ? 3 : 5,
      font: "Arial, Helvetica, sans-serif"
    });
    return svg.outerHTML;
  } catch {
    return `<div style="font:700 10px monospace">${code}</div>`;
  }
}

const esc = (s: any): string =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

export function printBarangLabels(labels: LabelPcs[], opts: PrintLabelOptions = {}): boolean {
  if (typeof window === "undefined" || !labels.length) {
    return false;
  }

  const win = window.open("", "_blank", "width=960,height=840");
  if (!win) {
    return false;
  }

  const titleText = esc(opts.namaUsaha || "Label Hangtag");
  const is30Initial = opts.ukuran === "30x40";
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const cards40Html = labels
    .map(
      (l, idx) => {
        const namaLen = (l.nama_barang || "").length;
        const fontClass = namaLen > 34 ? "nm-vlong" : namaLen > 18 ? "nm-long" : "nm-normal";
        const szLen = (l.size || "").length;
        const szClass = szLen > 3 ? "sz-long" : "sz-normal";

        return `
    <div class="print-sheet sheet-40x30 ${is30Initial ? "sheet-hidden" : ""}" ${is30Initial ? 'style="display:none;"' : ""}>
      <div class="lbl lbl-40" data-index="${idx + 1}">
        <div class="top el-top">
          <span class="nm el-nama ${fontClass}" title="${esc(l.nama_barang)}">${esc(l.nama_barang)}</span>
          <span class="sz el-size ${szClass}">${esc(l.size)}</span>
        </div>
        <div class="bc el-bc">${barcodeSvg(l.kode, "40x30")}</div>
        <div class="qr el-qr" style="display:none;">
          <div class="qr-svg-wrap">${qrSvg(l.kode)}</div>
          <div class="qr-code-txt">${esc(l.kode)}</div>
        </div>
        <div class="bot el-bot">
          <span class="sku el-sku">${esc(l.sku || l.noPo || "")}</span>
          ${l.harga_jual ? `<b class="price el-harga">Rp ${Number(l.harga_jual).toLocaleString("id-ID")}</b>` : ""}
        </div>
      </div>
    </div>`;
      }
    )
    .join("");

  const cards30Html = labels
    .map(
      (l, idx) => `
    <div class="print-sheet sheet-30x40 ${!is30Initial ? "sheet-hidden" : ""}" ${!is30Initial ? 'style="display:none;"' : ""}>
      <div class="lbl lbl-30" data-index="${idx + 1}">
        <div class="top-30 el-top">
          <div class="nm-30 el-nama" title="${esc(l.nama_barang)}">${esc(l.nama_barang)}</div>
          <span class="sz-30 el-size">${esc(l.size)}</span>
        </div>
        <div class="bc-30 el-bc">${barcodeSvg(l.kode, "30x40")}</div>
        <div class="qr-30 el-qr" style="display:none;">
          <div class="qr-svg-wrap-30">${qrSvg(l.kode)}</div>
          <div class="qr-code-txt-30">${esc(l.kode)}</div>
        </div>
        <div class="bot-30 el-bot">
          <div class="sku-30 el-sku">${esc(l.sku || l.noPo || "")}</div>
          ${l.harga_jual ? `<div class="price-30 el-harga">Rp ${Number(l.harga_jual).toLocaleString("id-ID")}</div>` : ""}
        </div>
      </div>
    </div>`
    )
    .join("");

  const htmlDoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  ${origin ? `<base href="${origin}/">` : ""}
  <title>Label Barang Jadi — ${labels.length} label (Zebra ZD230)</title>
  <style id="print-page-style">
    @page { 
      size: ${is30Initial ? "30mm 40mm" : "40mm 30mm"}; 
      margin: 0mm !important; 
    }
  </style>
  <style>
    * { box-sizing: border-box; }
    html, body { 
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; 
      margin: 0; 
      padding: 0; 
      color: #000; 
      background: #F1F5F9; 
    }
    
    /* Top Action Bar (Hanya tampil di layar preview) */
    .bar { 
      padding: 12px 18px; 
      background: #0F172A; 
      color: #FFFFFF; 
      border-bottom: 1px solid #1E293B; 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      flex-wrap: wrap; 
      gap: 12px; 
      position: sticky; 
      top: 0; 
      z-index: 100; 
      box-shadow: 0 4px 14px rgba(0,0,0,0.15); 
    }
    .bar-info { display: flex; align-items: center; gap: 10px; font-size: 13px; }
    .bar-title { font-weight: 800; font-size: 14.5px; }
    .badge-count {
      background: #2563EB;
      color: white;
      font-weight: 800;
      padding: 3px 9px;
      border-radius: 12px;
      font-size: 12px;
    }
    .bar-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    
    .btn-direct-zebra {
      padding: 9px 18px;
      font-weight: 800;
      font-size: 13px;
      border: 1px solid #16A34A;
      background: linear-gradient(135deg, #16A34A, #15803D);
      color: #FFFFFF;
      border-radius: 8px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 3px 10px rgba(22,163,74,0.35);
      transition: all 0.15s;
    }
    .btn-direct-zebra:hover { background: linear-gradient(135deg, #15803D, #166534); transform: translateY(-1px); }
    .btn-direct-zebra:active { transform: translateY(0); }

    .btn-toggle-mode {
      padding: 8px 14px;
      font-weight: 800;
      font-size: 12.5px;
      border: 1px solid #38BDF8;
      background: #0284C7;
      color: #FFFFFF;
      border-radius: 8px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background 0.15s;
    }
    .btn-toggle-mode:hover { background: #0369A1; }

    .btn-rotate {
      padding: 8px 14px;
      font-weight: 700;
      font-size: 12.5px;
      border: 1px solid #475569;
      background: #1E293B;
      color: #F8FAFC;
      border-radius: 8px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .btn-rotate:hover { background: #334155; }

    .bar button.btn-print { 
      padding: 8px 16px; 
      font-weight: 700; 
      font-size: 12.5px; 
      border: 1px solid #64748B; 
      background: #334155; 
      color: #F8FAFC; 
      border-radius: 8px; 
      cursor: pointer; 
      display: inline-flex; 
      align-items: center; 
      gap: 6px; 
      transition: background 0.15s; 
    }
    .bar button.btn-print:hover { background: #475569; }

    /* Tips Banner */
    .tip-banner {
      background: #EFF6FF;
      border-bottom: 1px solid #BFDBFE;
      padding: 8px 18px;
      font-size: 12px;
      color: #1E40AF;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .tip-banner b { color: #1D4ED8; }

    /* Elemen Aktif Filter Bar */
    .opts-bar {
      background: #1E293B;
      border-bottom: 1px solid #334155;
      padding: 7px 18px;
      font-size: 12px;
      color: #F8FAFC;
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }
    .opts-bar label {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      cursor: pointer;
      font-weight: 700;
    }

    /* Screen Preview Container */
    .roll-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 24px 16px 60px;
    }
    .roll-hint {
      font-size: 12px;
      color: #64748B;
      margin-bottom: 12px;
      font-weight: 600;
    }
    .grid { 
      display: flex; 
      flex-direction: column; 
      align-items: center; 
      gap: 8px; 
      padding: 14px; 
      background: #CBD5E1; 
      border-radius: 12px; 
      border: 2px dashed #94A3B8; 
      width: fit-content; 
    }

    /* Print Sheet: 40x30 mm */
    .sheet-40x30 {
      width: 40mm;
      height: 30mm;
      min-width: 40mm;
      min-height: 30mm;
      max-width: 40mm;
      max-height: 30mm;
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: #fff;
      border-radius: 4px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.06);
    }
    .lbl.lbl-40 { 
      width: 100%; 
      height: 100%; 
      background: #fff; 
      padding: 4.5mm 2.2mm 2.5mm; 
      display: flex; 
      flex-direction: column; 
      justify-content: space-between; 
      overflow: hidden; 
      box-sizing: border-box; 
    }
    .lbl.lbl-40 .top { 
      display: flex; 
      justify-content: space-between; 
      align-items: flex-start; 
      gap: 1.5mm; 
      width: 100%; 
      min-height: 5.5mm;
    }
    .lbl.lbl-40 .nm { 
      font-weight: 900; 
      line-height: 1.12; 
      word-break: break-word;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      flex: 1;
      text-align: left;
      text-transform: uppercase;
    }
    .lbl.lbl-40 .nm-normal { font-size: 8.2pt; }
    .lbl.lbl-40 .nm-long { font-size: 7pt; line-height: 1.08; }
    .lbl.lbl-40 .nm-vlong { font-size: 6pt; line-height: 1.04; }

    .lbl.lbl-40 .sz { 
      font-weight: 900; 
      border: 1.8px solid #000; 
      border-radius: 2px; 
      line-height: 1; 
      flex-shrink: 0; 
      display: inline-flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      box-sizing: border-box;
      margin-top: 0.2mm;
      text-transform: uppercase;
    }
    .lbl.lbl-40 .sz-normal { font-size: 10.5pt; padding: 0.4mm 2mm; min-width: 6.5mm; height: 4.4mm; }
    .lbl.lbl-40 .sz-long { font-size: 8.5pt; padding: 0.3mm 1.5mm; min-width: 8mm; height: 4.4mm; }

    .lbl.lbl-40 .bc { 
      text-align: center; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      width: 100%; 
      flex: 1;
      min-height: 14mm; 
      overflow: hidden; 
      margin: 0.2mm 0;
    }
    .lbl.lbl-40 .bc svg { 
      width: auto; 
      max-width: 35mm; 
      height: 100%; 
      max-height: 15mm; 
      display: block; 
      margin: 0 auto; 
    }
    .lbl.lbl-40 .qr {
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
      flex: 1;
      overflow: hidden;
      margin: 0.2mm 0;
    }
    .lbl.lbl-40 .qr .qr-svg-wrap {
      width: 16.5mm;
      height: 16.5mm;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: all 0.15s ease;
    }
    .lbl.lbl-40 .qr .qr-svg-wrap svg {
      width: 100%;
      height: 100%;
      display: block;
    }
    .lbl.lbl-40 .qr .qr-code-txt {
      font-family: monospace;
      font-size: 7.2pt;
      font-weight: 800;
      margin-top: 1mm;
      letter-spacing: 0.2px;
      text-align: center;
      line-height: 1;
    }

    /* Posisi Dinamis Fleksibel ketika Sebagian Elemen Mati */
    .lbl.lbl-40.no-top:not(.code-only) .qr .qr-svg-wrap,
    .lbl.lbl-40.no-bot:not(.code-only) .qr .qr-svg-wrap {
      width: 18.5mm;
      height: 18.5mm;
    }
    .lbl.lbl-40.no-top:not(.code-only) .qr .qr-code-txt,
    .lbl.lbl-40.no-bot:not(.code-only) .qr .qr-code-txt {
      font-size: 8pt;
      margin-top: 1.2mm;
    }

    /* FULL QR PAS DI TENGAH HALAMAN (Ketika Nama, Size, SKU, dan Harga Mati) */
    .lbl.lbl-40.code-only {
      padding: 1.5mm 2mm !important;
      justify-content: center !important;
      align-items: center !important;
    }
    .lbl.lbl-40.code-only .qr {
      flex: 1;
      width: 100%;
      height: 100%;
      margin: 0 !important;
      justify-content: center !important;
    }
    .lbl.lbl-40.code-only .qr .qr-svg-wrap {
      width: 22.5mm !important;
      height: 22.5mm !important;
      max-width: 22.5mm !important;
      max-height: 22.5mm !important;
    }
    .lbl.lbl-40.code-only .qr .qr-code-txt {
      font-size: 9.5pt !important;
      margin-top: 1.6mm !important;
      letter-spacing: 0.3px !important;
    }
    .lbl.lbl-40.code-only .bc svg {
      max-height: 22mm !important;
    }
    .lbl.lbl-40 .bot { 
      display: flex; 
      justify-content: space-between; 
      align-items: baseline; 
      font-size: 7.2pt; 
      line-height: 1.1; 
      width: 100%;
    }
    .lbl.lbl-40 .bot .sku { 
      font-family: monospace; 
      font-weight: 800; 
      max-width: 20mm; 
      overflow: hidden; 
      text-overflow: ellipsis; 
      white-space: nowrap; 
    }
    .lbl.lbl-40 .bot .price { 
      font-size: 9.8pt; 
      font-weight: 900; 
      white-space: nowrap; 
    }

    /* Print Sheet: 30x40 mm (Portrait Hangtag Khusus Zebra) */
    .sheet-30x40 {
      width: 30mm;
      height: 40mm;
      min-width: 30mm;
      min-height: 40mm;
      max-width: 30mm;
      max-height: 40mm;
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: #fff;
      border-radius: 4px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.06);
    }
    .lbl.lbl-30 {
      width: 100%;
      height: 100%;
      background: #fff;
      padding: 1.2mm 1.5mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
      box-sizing: border-box;
      text-align: center;
    }
    .top-30 {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1mm;
      width: 100%;
    }
    .nm-30 {
      font-size: 6.5pt;
      font-weight: 800;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 20mm;
      text-align: left;
      line-height: 1.1;
    }
    .sz-30 {
      font-size: 9pt;
      font-weight: 900;
      border: 1.4px solid #000;
      padding: 0 1.4mm;
      border-radius: 2px;
      line-height: 1;
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 4mm;
    }
    .bc-30 {
      text-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 19mm;
      overflow: hidden;
      margin: 1mm 0;
    }
    .bc-30 svg {
      width: 100%;
      max-width: 27mm;
      height: 100%;
      max-height: 19mm;
      display: block;
      margin: 0 auto;
    }
    .lbl.lbl-30 .bc-30 {
      text-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      flex: 1;
      overflow: hidden;
      margin: 0.5mm 0;
    }
    .lbl.lbl-30 .qr-30 {
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
      flex: 1;
      overflow: hidden;
      margin: 0.5mm 0;
    }
    .lbl.lbl-30 .qr-30 .qr-svg-wrap-30 {
      width: 15mm;
      height: 15mm;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: all 0.15s ease;
    }
    .lbl.lbl-30 .qr-30 .qr-svg-wrap-30 svg {
      width: 100%;
      height: 100%;
      display: block;
    }
    .lbl.lbl-30 .qr-30 .qr-code-txt-30 {
      font-family: monospace;
      font-size: 7pt;
      font-weight: 800;
      margin-top: 0.5mm;
      letter-spacing: 0.2px;
      text-align: center;
      line-height: 1;
    }

    /* FULL QR PAS DI TENGAH (30x40 mm Portrait) */
    .lbl.lbl-30.code-only {
      padding: 2mm 1.5mm !important;
      justify-content: center !important;
      align-items: center !important;
    }
    .lbl.lbl-30.code-only .qr-30 {
      flex: 1;
      width: 100%;
      height: 100%;
      margin: 0 !important;
      justify-content: center !important;
    }
    .lbl.lbl-30.code-only .qr-30 .qr-svg-wrap-30 {
      width: 24mm !important;
      height: 24mm !important;
      max-width: 24mm !important;
      max-height: 24mm !important;
    }
    .lbl.lbl-30.code-only .qr-30 .qr-code-txt-30 {
      font-size: 9pt !important;
      margin-top: 1mm !important;
      letter-spacing: 0.4px !important;
    }
    .bot-30 {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      font-size: 6pt;
      line-height: 1;
      width: 100%;
    }
    .sku-30 {
      font-family: monospace;
      font-weight: 700;
      font-size: 5.8pt;
      max-width: 13mm;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .price-30 {
      font-size: 7.2pt;
      font-weight: 900;
      white-space: nowrap;
    }

    /* Hide inactive sheet */
    .sheet-hidden { display: none !important; }

    /* ==================================================================== */
    /* ATURAN CETAK KHUSUS ZEBRA ZD230                                      */
    /* ==================================================================== */
    @media print {
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      html, body { 
        background: #fff !important; 
        margin: 0 !important; 
        padding: 0 !important; 
        width: 100% !important; 
        height: auto !important; 
        overflow: visible !important; 
      }
      /* Sembunyikan semua toolbar, banner tips, roll hint, dan elemen aktif di cetak dialog */
      .bar, .tip-banner, .roll-hint, .opts-bar, .no-print, .sheet-hidden { 
        display: none !important; 
      }
      .roll-container {
        padding: 0 !important;
        margin: 0 !important;
        display: block !important;
        width: 100% !important;
      }
      .grid { 
        display: block !important; 
        padding: 0 !important; 
        margin: 0 !important; 
        border: none !important; 
        background: transparent !important; 
        width: 100% !important; 
      }
      .print-sheet.sheet-hidden {
        display: none !important;
      }
      .sheet-40x30:not(.sheet-hidden) { 
        width: 40mm !important;
        height: 30mm !important;
        min-width: 40mm !important;
        min-height: 30mm !important;
        max-width: 40mm !important;
        max-height: 30mm !important;
        display: block !important;
        border: none !important; 
        border-radius: 0 !important; 
        box-shadow: none !important; 
        margin: 0 !important; 
        padding: 0 !important; 
        box-sizing: border-box !important; 
        page-break-after: always !important; 
        break-after: page !important; 
        page-break-inside: avoid !important; 
        break-inside: avoid !important; 
        overflow: hidden !important; 
      }
      .sheet-30x40:not(.sheet-hidden) { 
        width: 30mm !important;
        height: 40mm !important;
        min-width: 30mm !important;
        min-height: 40mm !important;
        max-width: 30mm !important;
        max-height: 40mm !important;
        display: block !important;
        border: none !important; 
        border-radius: 0 !important; 
        box-shadow: none !important; 
        margin: 0 !important; 
        padding: 0 !important; 
        box-sizing: border-box !important; 
        page-break-after: always !important; 
        break-after: page !important; 
        page-break-inside: avoid !important; 
        break-inside: avoid !important; 
        overflow: hidden !important; 
      }
      .print-sheet:not(.sheet-hidden):last-child {
        page-break-after: auto !important;
        break-after: auto !important;
      }
      .lbl.lbl-40 { 
        width: 40mm !important;
        height: 30mm !important;
        max-width: 40mm !important;
        max-height: 30mm !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: space-between !important;
        border: none !important; 
        box-shadow: none !important; 
        margin: 0 !important; 
        box-sizing: border-box !important; 
        padding: 4.5mm 2.2mm 2.5mm 2.2mm !important;
        overflow: hidden !important; 
      }
      .lbl.lbl-40.code-only {
        padding: 2mm !important;
        justify-content: center !important;
        align-items: center !important;
      }
      .lbl.lbl-30 { 
        width: 30mm !important;
        height: 40mm !important;
        max-width: 30mm !important;
        max-height: 40mm !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: space-between !important;
        border: none !important; 
        box-shadow: none !important; 
        margin: 0 !important; 
        box-sizing: border-box !important; 
        padding: 2mm 1.5mm !important;
        overflow: hidden !important; 
      }
      .lbl.lbl-30.code-only {
        padding: 2mm !important;
        justify-content: center !important;
        align-items: center !important;
      }
      .el-qr[style*="display: none"], .el-bc[style*="display: none"] {
        display: none !important;
      }
      .lbl .qr, .lbl-30 .qr-30 {
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
      }
      .lbl .qr .qr-svg-wrap {
        width: 16.5mm !important;
        height: 16.5mm !important;
      }
      .lbl.code-only .qr .qr-svg-wrap {
        width: 22.5mm !important;
        height: 22.5mm !important;
      }
      .qr-svg-wrap svg, .qr-svg-wrap-30 svg {
        width: 100% !important;
        height: 100% !important;
        display: block !important;
      }
    }
  </style>
  <script>
    var currentMode = "${is30Initial ? "30x40" : "40x30"}";
    var currentRotation = 0;
    window.__LABELS_DATA__ = ${JSON.stringify(labels)};

    function doDirectZebra() {
      var btn = document.getElementById("btn-direct-zebra-text");
      if (btn) btn.innerText = "⏳ Mengirim ke Zebra...";
      var showNama = document.getElementById("chk-nama") ? document.getElementById("chk-nama").checked : true;
      var showSize = document.getElementById("chk-size") ? document.getElementById("chk-size").checked : true;
      var showSku = document.getElementById("chk-sku") ? document.getElementById("chk-sku").checked : true;
      var showHarga = document.getElementById("chk-harga") ? document.getElementById("chk-harga").checked : true;
      var showQr = document.getElementById("chk-qr") ? document.getElementById("chk-qr").checked : false;

      fetch("/api/print-zebra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          labels: window.__LABELS_DATA__,
          format: currentMode,
          options: {
            showNama: showNama,
            showSize: showSize,
            showSku: showSku,
            showHarga: showHarga,
            useQr: showQr,
            rotate180: currentRotation === 180,
          }
        }),
      })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data.ok) {
          alert("✅ " + data.message + "\\nPrinter akan mencetak sekarang.");
        } else {
          alert("❌ " + (data.error || "Gagal mencetak"));
        }
      })
      .catch(function(err) {
        alert("❌ Error koneksi ke Zebra: " + err.message);
      })
      .finally(function() {
        if (btn) btn.innerText = "⚡ Cetak Langsung Zebra (1-Klik ZPL)";
      });
    }

    function applyElementVisibility() {
      var showNama = document.getElementById("chk-nama") ? document.getElementById("chk-nama").checked : true;
      var showSize = document.getElementById("chk-size") ? document.getElementById("chk-size").checked : true;
      var showSku = document.getElementById("chk-sku") ? document.getElementById("chk-sku").checked : true;
      var showHarga = document.getElementById("chk-harga") ? document.getElementById("chk-harga").checked : true;
      var showQr = document.getElementById("chk-qr") ? document.getElementById("chk-qr").checked : false;

      document.querySelectorAll(".el-nama").forEach(function(el) { el.style.display = showNama ? "" : "none"; });
      document.querySelectorAll(".el-size").forEach(function(el) { el.style.display = showSize ? "" : "none"; });
      document.querySelectorAll(".el-top").forEach(function(el) { el.style.display = (showNama || showSize) ? "flex" : "none"; });

      document.querySelectorAll(".el-sku").forEach(function(el) { el.style.display = showSku ? "" : "none"; });
      document.querySelectorAll(".el-harga").forEach(function(el) { el.style.display = showHarga ? "" : "none"; });
      document.querySelectorAll(".el-bot").forEach(function(el) { el.style.display = (showSku || showHarga) ? "flex" : "none"; });

      // Toggle barcode vs QR code
      document.querySelectorAll(".el-bc").forEach(function(el) { el.style.display = showQr ? "none" : "flex"; });
      document.querySelectorAll(".el-qr").forEach(function(el) { el.style.display = showQr ? "flex" : "none"; });

      var hasTop = showNama || showSize;
      var hasBot = showSku || showHarga;
      var onlyCode = !hasTop && !hasBot;

      document.querySelectorAll(".lbl-40, .lbl-30").forEach(function(card) {
        if (onlyCode) {
          card.style.justifyContent = "center";
          card.classList.add("code-only");
        } else {
          card.style.justifyContent = "space-between";
          card.classList.remove("code-only");
        }
        card.classList.toggle("no-top", !hasTop);
        card.classList.toggle("no-bot", !hasBot);
      });

      var hint = document.getElementById("opts-hint");
      if (hint) {
        if (onlyCode) {
          hint.innerText = showQr ? "✨ Full QR Code tepat di tengah halaman stiker" : "✨ Full Barcode tepat di tengah halaman stiker";
        } else {
          hint.innerText = showQr ? "📱 Mode QR Code aktif dengan layout dinamis proporsional" : "(Hanya elemen yang dicentang yang akan dicetak)";
        }
      }
    }

    function setMode(mode) {
      currentMode = mode;
      var styleTag = document.getElementById("print-page-style");
      var sheets40 = document.querySelectorAll(".sheet-40x30");
      var sheets30 = document.querySelectorAll(".sheet-30x40");
      var btnMode = document.getElementById("btn-mode-text");

      if (mode === "30x40") {
        if (styleTag) styleTag.innerHTML = "@page { size: 30mm 40mm; margin: 0mm !important; }";
        sheets40.forEach(function(s) { s.classList.add("sheet-hidden"); s.style.display = "none"; });
        sheets30.forEach(function(s) { s.classList.remove("sheet-hidden"); s.style.display = "block"; });
        if (btnMode) btnMode.innerText = "📐 Format: 30×40 mm (Tegak / Portrait)";
      } else {
        if (styleTag) styleTag.innerHTML = "@page { size: 40mm 30mm; margin: 0mm !important; }";
        sheets40.forEach(function(s) { s.classList.remove("sheet-hidden"); s.style.display = "block"; });
        sheets30.forEach(function(s) { s.classList.add("sheet-hidden"); s.style.display = "none"; });
        if (btnMode) btnMode.innerText = "📐 Format: 40×30 mm (Mendatar / Landscape)";
      }
      applyRotation();
    }

    function toggleMode() {
      setMode(currentMode === "40x30" ? "30x40" : "40x30");
    }

    function toggleRotation() {
      currentRotation = (currentRotation + 90) % 360;
      applyRotation();
    }

    function applyRotation() {
      var activeSheets = document.querySelectorAll(currentMode === "30x40" ? ".sheet-30x40" : ".sheet-40x30");
      activeSheets.forEach(function(s) {
        var card = s.querySelector(".lbl");
        if (card) {
          if (currentRotation === 90) {
            card.style.transform = "rotate(90deg)";
            card.style.transformOrigin = "center center";
          } else if (currentRotation === 180) {
            card.style.transform = "rotate(180deg)";
            card.style.transformOrigin = "center center";
          } else if (currentRotation === 270) {
            card.style.transform = "rotate(270deg)";
            card.style.transformOrigin = "center center";
          } else {
            card.style.transform = "none";
          }
        }
      });
      var btnRot = document.getElementById("btn-rot-text");
      if (btnRot) btnRot.innerText = "🔄 Putar: " + currentRotation + "°";
    }

    function doPrint() {
      window.print();
    }

    setTimeout(applyElementVisibility, 30);
  </script>
</head>
<body>
  <div class="bar">
    <div class="bar-info">
      <span class="bar-title">🏷️ ${titleText}</span>
      <span style="color:#94A3B8;">|</span>
      <span class="badge-count">${labels.length} pcs label</span>
      <span style="color:#94A3B8;">|</span>
      <span style="color:#38BDF8; font-weight:700;">Zebra ZD230</span>
    </div>
    <div class="bar-actions">
      <button class="btn-direct-zebra" onclick="doDirectZebra()"><span id="btn-direct-zebra-text">⚡ Cetak Langsung Zebra (1-Klik ZPL)</span></button>
      <button class="btn-toggle-mode" onclick="toggleMode()"><span id="btn-mode-text">📐 Format: 40×30 mm (Mendatar)</span></button>
      <button class="btn-rotate" onclick="toggleRotation()"><span id="btn-rot-text">🔄 Putar: 0°</span></button>
      <button class="btn-print" onclick="doPrint()">🖨️ Dialog Browser</button>
    </div>
  </div>

  <div class="tip-banner">
    <div>⚠️ <b>Paling Praktis & Presisi:</b> Gunakan tombol hijau <b>⚡ Cetak Langsung Zebra (1-Klik ZPL)</b> — langsung mencetak horizontal pas di tengah tanpa dialog printer.</div>
    <div>💡 <b>Jika via Dialog Browser:</b> Di Setelan Lain ➔ Ukuran Kertas: pilih <b>40×30 mm</b> (LABEL HANTAG) · Margin: <b>Tidak ada (None)</b>.</div>
  </div>

  <div class="opts-bar">
    <span style="font-weight:800; color:#38BDF8; display:flex; align-items:center; gap:5px;">⚙️ Elemen Aktif:</span>
    <label><input type="checkbox" id="chk-nama" ${opts.showNama !== false ? "checked" : ""} onchange="applyElementVisibility()"> Nama Barang</label>
    <label><input type="checkbox" id="chk-size" ${opts.showSize !== false ? "checked" : ""} onchange="applyElementVisibility()"> Ukuran Size</label>
    <label><input type="checkbox" id="chk-sku" ${opts.showSku !== false ? "checked" : ""} onchange="applyElementVisibility()"> Kode SKU / TBJ</label>
    <label><input type="checkbox" id="chk-harga" ${opts.showHarga !== false ? "checked" : ""} onchange="applyElementVisibility()"> Harga Jual</label>
    <label style="color:#38BDF8;"><input type="checkbox" id="chk-qr" ${opts.showQr === true ? "checked" : ""} onchange="applyElementVisibility()"> 📱 QR Code</label>
    <span id="opts-hint" style="color:#94A3B8; font-size:11.5px; margin-left:auto; font-style:italic;">(Hanya elemen yang dicentang yang akan dicetak)</span>
  </div>

  <div class="roll-container">
    <div class="roll-hint">⬇️ Rol Label Memanjang (1 Kolom ke Bawah) — Total: <b>${labels.length}</b> Lembar Stiker</div>
    <div class="grid" id="labels-container">
      ${cards40Html}
      ${cards30Html}
    </div>
  </div>
</body>
</html>`;

  win.document.write(htmlDoc);
  win.document.close();
  return true;
}
