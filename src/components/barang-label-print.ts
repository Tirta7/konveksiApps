"use client";
/**
 * Cetak label hangtag barang jadi (barcode per pcs) di jendela terpisah.
 * Label berisi: nama barang, size, SKU, harga, dan barcode Code-128 kode pcs (contoh SJ-02-XL-001).
 */
// @ts-ignore — jsbarcode tidak menyediakan type definitions
import JsBarcode from "jsbarcode";

export type LabelPcs = { kode: string; nama_barang: string; size: string; sku?: string | null; harga_jual?: number; noPo?: string };

function barcodeSvg(code: string): string {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  try {
    (JsBarcode as any)(svg, code, { format: "CODE128", width: 1.6, height: 42, displayValue: true, fontSize: 12, margin: 0, textMargin: 2 });
  } catch {
    return `<div style="font:700 11px monospace">${code}</div>`;
  }
  return svg.outerHTML;
}

const esc = (s: any) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

export function printBarangLabels(labels: LabelPcs[], opts: { namaUsaha?: string; ukuran?: "50x30" | "40x30" } = {}) {
  if (!labels.length) return false;
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return false;
  const [lw, lh] = (opts.ukuran || "50x30").split("x").map(Number);
  const items = labels
    .map(
      (l) => `
      <div class="lbl">
        <div class="top"><span class="nm">${esc(l.nama_barang)}</span><span class="sz">${esc(l.size)}</span></div>
        <div class="bc">${barcodeSvg(l.kode)}</div>
        <div class="bot"><span>${esc(l.sku || "")}</span>${l.harga_jual ? `<b>Rp ${Number(l.harga_jual).toLocaleString("id-ID")}</b>` : ""}</div>
      </div>`
    )
    .join("");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Label Barang (${labels.length} pcs)</title>
  <style>
    @page { margin: 6mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; margin: 0; color: #000; }
    .bar { padding: 10px 14px; background: #F1F5F9; border-bottom: 1px solid #CBD5E1; display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
    .bar button { padding: 8px 16px; font-weight: 700; border: none; background: #2563EB; color: #fff; border-radius: 6px; cursor: pointer; }
    .grid { display: flex; flex-wrap: wrap; gap: 2mm; padding: 4mm; }
    .lbl { width: ${lw}mm; height: ${lh}mm; border: 1px dashed #94A3B8; padding: 1.5mm 2mm; display: flex; flex-direction: column; justify-content: space-between; page-break-inside: avoid; overflow: hidden; }
    .top { display: flex; justify-content: space-between; align-items: center; gap: 2mm; }
    .nm { font-size: 8.5pt; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sz { font-size: 10pt; font-weight: 900; border: 1.5px solid #000; padding: 0 1.5mm; border-radius: 1mm; }
    .bc { text-align: center; }
    .bc svg { max-width: 100%; height: auto; max-height: ${Math.max(10, lh - 13)}mm; }
    .bot { display: flex; justify-content: space-between; font-size: 7pt; }
    .bot b { font-size: 8pt; }
    @media print { .bar { display: none; } .lbl { border-color: transparent; } .grid { padding: 0; } }
  </style></head><body>
  <div class="bar"><span><b>${esc(opts.namaUsaha || "Label Barang Jadi")}</b> — ${labels.length} label (${lw}×${lh} mm)</span><button onclick="window.print()">🖨️ Cetak</button></div>
  <div class="grid">${items}</div>
  </body></html>`);
  w.document.close();
  setTimeout(() => { try { w.focus(); w.print(); } catch {} }, 400);
  return true;
}
