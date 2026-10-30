export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { execFile, execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import QRCode from "qrcode";

type LabelItem = {
  kode: string;
  nama_barang: string;
  size: string;
  sku?: string | null;
  harga_jual?: number;
  noPo?: string;
};

function getQrDimensions(code: string, mag: number) {
  let size = 21;
  try {
    const qr = (QRCode as any).create(code, { errorCorrectionLevel: "Q" });
    if (qr && qr.modules && qr.modules.size) {
      size = qr.modules.size;
    }
  } catch {}
  // Zebra Model 2 otomatis menambahkan 4 modul quiet zone di setiap sisi (total 8 modul)
  const totalModules = size + 8;
  const dots = totalModules * mag;
  return { modules: totalModules, dots };
}

function findZebraPrinter(): string {
  try {
    const output = execSync("lpstat -p", { encoding: "utf8" });
    const lines = output.split("\n");
    for (const line of lines) {
      const match = line.match(/^printer\s+([^\s]+)/i);
      if (match && match[1]) {
        const pName = match[1];
        if (/zebra|zd230|ztc/i.test(pName)) {
          return pName;
        }
      }
    }
  } catch {}
  return "Zebra_Technologies_ZTC_ZD230_203dpi_ZPL";
}

/**
 * Menghitung parameter barcode Code 128 (Modul 2 Dots - Tebal & Tegas)
 * Lebar barcode disesuaikan sedikit lebih ramping (~32-34mm) agar tidak over/tumpah
 * ke tepi kanan stiker 40mm, dengan margin simetris kiri-kanan yang aman (~3mm),
 * dan garis barcode tetap tebal 2 dots (0.25mm) agar 100% mudah discan.
 */
function getCenteredBarcode128(code: string) {
  // Karakter barcode menggunakan kode alphanumeric padat agar hemat ruang (272 dots)
  // Cocok dengan normalisasi scan barcode di app (barcode-sales.ts)
  const cleanCode = code.replace(/[^A-Z0-9]/g, "");
  // Code 128 Subset B: Start (11) + Data (11 * N) + Check (11) + Stop (13) + Term (2) = 37 + N*11
  const modules = cleanCode.length * 11 + 37;
  const barcodeWidth = modules * 2; // Modul 2 dots (0.25mm tebal & tajam)
  const startX = Math.max(10, Math.round((320 - barcodeWidth) / 2));
  return { startX, barcodeWidth, cleanCode };
}

/**
 * Generate ZPL untuk label hangtag 40x30 mm (203 dpi)
 * Ukuran fisik: 320 dots lebar × 240 dots tinggi.
 * Mendukung opsi seleksi dinamis:
 * - showNama: cetak nama barang
 * - showSize: cetak kotak & ukuran size
 * - showSku: cetak kode SKU / TBJ-0002-XS
 * - showHarga: cetak harga jual
 * - useQr: gunakan 2D QR Code sebagai pengganti 1D Barcode
 * - rotate180: balik arah 180 derajat
 * Jika semua dinonaktifkan, otomatis mencetak HANYA barcode / QR code (posisi pas di tengah, gap aman, tidak bertabrakan).
 */
function generateZpl40x30(
  labels: LabelItem[],
  opts: {
    showNama?: boolean;
    showSize?: boolean;
    showSku?: boolean;
    showHarga?: boolean;
    useQr?: boolean;
    rotate180?: boolean;
  } = {}
): string {
  const showNama = opts.showNama !== false;
  const showSize = opts.showSize !== false;
  const showSku = opts.showSku !== false;
  const showHarga = opts.showHarga !== false;
  const useQr = opts.useQr === true;
  const rotate180 = opts.rotate180 === true;
  const hasTop = showNama || showSize;
  const hasBottom = showSku || showHarga;

  return labels
    .map((l) => {
      const rawNama = (l.nama_barang || "HANGTAG").replace(/[\^~]/g, "").trim().toUpperCase();
      const size = (l.size || "").replace(/[\^~]/g, "").trim().toUpperCase();
      const kode = (l.kode || "").replace(/[\^~]/g, "").trim();
      const sku = (l.sku || l.noPo || "").replace(/[\^~]/g, "").trim().slice(0, 16);
      const harga = l.harga_jual ? `Rp ${Number(l.harga_jual).toLocaleString("id-ID")}` : "";

      // 1. Tentukan ukuran elemen atas (Nama Barang & Kotak Size)
      const sizeLen = Math.max(1, size.length);
      const sizeBoxW = sizeLen <= 2 ? 48 : sizeLen <= 3 ? 58 : Math.min(85, sizeLen * 13 + 20);
      const sizeBoxH = 26;
      const sizeBoxX = 320 - 12 - sizeBoxW;
      const sizeFontH = sizeLen <= 2 ? 22 : sizeLen <= 3 ? 19 : 16;
      const sizeFontW = sizeLen <= 2 ? 20 : sizeLen <= 3 ? 17 : 14;

      const titleW = showSize ? sizeBoxX - 16 : 296;
      let titleFontH = 19;
      let titleFontW = 17;
      let maxLines = 1;
      let topH = 26;

      if (rawNama.length > 30) {
        titleFontH = 14;
        titleFontW = 12;
        maxLines = 2;
        topH = 28;
      } else if (rawNama.length > 18) {
        titleFontH = 16;
        titleFontW = 14;
        maxLines = 2;
        topH = 28;
      }

      // 2. Barcode 1D / QR Code 2D & Teks Kode
      // Perhitungan koordinat presisi, proporsional, tebal, dan simetris di tengah kertas 40x30 mm (320x240 dots)
      // Top margin dibuat ekstra lega (~4.5mm / 36 dots) agar teks Nama Barang dan Kotak Size TIDAK mepet sama sekali ke tepi atas label roll
      const sizeBoxY = 36;
      const titleY = maxLines === 2 ? 34 : 39;
      const sizeTextY = sizeBoxY + Math.max(1, Math.round((sizeBoxH - sizeFontH) / 2));
      let codeX = 102;
      let codeY = 60;
      let textY = 168;
      let textFontH = 16;
      let textFontW = 14;
      let qrMag = 4;
      let bcH = 50;
      let skuY = 202;
      let priceY = 196;
      let cleanCode = "";

      if (useQr) {
        if (!hasTop && !hasBottom) {
          // 1. HANYA QR CODE SAJA: Sangat besar (Mag 6 = 118 dots / 14.8mm), tepat simetris di tengah absolut
          qrMag = 6;
          codeX = 72;
          codeY = 24;
          textY = 186;
          textFontH = 22;
          textFontW = 18;
        } else if (hasTop && !hasBottom) {
          // 2. Hanya Top aktif (Nama & Size) + QR Code
          qrMag = 5;
          codeX = 88;
          codeY = 70;
          textY = 180;
          textFontH = 18;
          textFontW = 15;
        } else if (!hasTop && hasBottom) {
          // 3. Hanya Bottom aktif (SKU & Harga) + QR Code
          qrMag = 5;
          codeX = 88;
          codeY = 30;
          textY = 146;
          skuY = 202;
          priceY = 196;
          textFontH = 18;
          textFontW = 15;
        } else {
          // 4. SEMUA ELEMEN AKTIF (Nama + Size + QR + SKU + Harga):
          // QR Code Mag 4 proporsional dengan margin atas sangat lega (36 dots = 4.5mm)
          qrMag = 4;
          codeX = 102;
          codeY = 60;
          textY = 168;
          skuY = 202;
          priceY = 196;
          textFontH = 16;
          textFontW = 14;
        }
      } else {
        // Barcode 1D Code 128
        const bcCalc = getCenteredBarcode128(kode);
        cleanCode = bcCalc.cleanCode;
        codeX = bcCalc.startX;

        if (!hasTop && !hasBottom) {
          // HANYA BARCODE SAJA: Barcode tinggi 95 dots, pas di tengah vertikal dan horizontal
          bcH = 95;
          codeY = 56;
          textY = 168;
          textFontH = 22;
          textFontW = 18;
        } else if (hasTop && !hasBottom) {
          bcH = 75;
          codeY = 82;
          textY = 170;
          textFontH = 18;
          textFontW = 15;
        } else if (!hasTop && hasBottom) {
          bcH = 80;
          codeY = 36;
          textY = 130;
          skuY = 202;
          priceY = 196;
          textFontH = 18;
          textFontW = 15;
        } else {
          // Semua aktif: Barcode 50 dots proporsional & seimbang, margin atas sangat lega (36 dots = 4.5mm)
          bcH = 50;
          codeY = 88;
          textY = 146;
          skuY = 202;
          priceY = 196;
          textFontH = 16;
          textFontW = 14;
        }
      }

      // Bangun string ZPL per bagian
      // PENTING: ^BY2,2,10 mereset default register barcode height printer Zebra agar TIDAK bocor/menggeser ^BQ QR code
      let zpl = `^XA
~SD25
^PR2,2
^PW320
^LL240
^MMT
^BY2,2,10
${rotate180 ? "^POI" : "^PON"}
^LH0,0\n`;

      if (showNama) {
        zpl += `^FO12,${titleY}^A0N,${titleFontH},${titleFontW}^FB${titleW},${maxLines},-1,L,0^FD${rawNama}^FS\n`;
      }
      if (showSize && size) {
        zpl += `^FO${sizeBoxX},${sizeBoxY}^GB${sizeBoxW},${sizeBoxH},2^FS\n`;
        zpl += `^FO${sizeBoxX},${sizeTextY}^A0N,${sizeFontH},${sizeFontW}^FB${sizeBoxW},1,0,C,0^FD${size}^FS\n`;
      }

      // Barcode / QR Code & Teks Kode
      if (useQr) {
        // Explicit ^BY2,2,10 sebelum ^BQ agar firmware Zebra tidak menambahkan vertical offset dari barcode 1D sebelumnya
        zpl += `^BY2,2,10\n`;
        zpl += `^FO${codeX},${codeY}^BQN,2,${qrMag}^FDQA,${kode}^FS\n`;
        zpl += `^FO0,${textY}^A0N,${textFontH},${textFontW}^FB320,1,0,C,0^FD${kode}^FS\n`;
      } else {
        // Barcode 1D Code 128 dengan mode Automatic (A) dan parameter height langsung di ^BC
        zpl += `^FO${codeX},${codeY}^BY2,2,10^BCN,${bcH},N,N,N,A^FD${cleanCode}^FS\n`;
        zpl += `^FO0,${textY}^A0N,${textFontH},${textFontW}^FB320,1,0,C,0^FD${kode}^FS\n`;
      }

      if (showSku && sku) {
        zpl += `^FO12,${skuY}^A0N,20,17^FD${sku}^FS\n`;
      }
      if (showHarga && harga) {
        zpl += `^FO120,${priceY}^A0N,34,32^FB188,1,0,R,0^FD${harga}^FS\n`;
      }

      zpl += `^XZ`;
      return zpl;
    })
    .join("\n");
}

/**
 * Generate ZPL untuk label hangtag 30x40 mm (Tegak / Portrait)
 */
function generateZpl30x40(
  labels: LabelItem[],
  opts: {
    showNama?: boolean;
    showSize?: boolean;
    showSku?: boolean;
    showHarga?: boolean;
    useQr?: boolean;
    rotate180?: boolean;
  } = {}
): string {
  const showNama = opts.showNama !== false;
  const showSize = opts.showSize !== false;
  const showSku = opts.showSku !== false;
  const showHarga = opts.showHarga !== false;
  const useQr = opts.useQr === true;
  const rotate180 = opts.rotate180 === true;

  return labels
    .map((l) => {
      const nama = (l.nama_barang || "HANGTAG").replace(/[\^~]/g, "").slice(0, 24);
      const size = (l.size || "").replace(/[\^~]/g, "").slice(0, 5);
      const kode = (l.kode || "").replace(/[\^~]/g, "");
      const sku = (l.sku || l.noPo || "").replace(/[\^~]/g, "").slice(0, 16);
      const harga = l.harga_jual ? `Rp ${Number(l.harga_jual).toLocaleString("id-ID")}` : "";

      const hasTop = showNama || (showSize && !!size);
      const hasBottom = (showSku && !!sku) || (showHarga && !!harga);

      let zpl = `^XA
~SD25
^PR2,2
^PW240
^LL320
^MMT
^BY1,2,10
${rotate180 ? "^POI" : "^PON"}
^LH0,0\n`;

      if (showNama) {
        zpl += `^FO10,20^A0N,20,18^FB${showSize ? 155 : 220},2,0,L,0^FD${nama}^FS\n`;
      }
      if (showSize && size) {
        zpl += `^FO170,18^GB58,28,2^FS\n`;
        zpl += `^FO170,21^A0N,24,22^FB58,1,0,C,0^FD${size}^FS\n`;
      }

      if (useQr) {
        zpl += `^BY1,2,10\n`;
        if (!hasTop && !hasBottom) {
          // FULL QR PAS DI TENGAH
          const qrMag = 4;
          const dims = getQrDimensions(kode, qrMag);
          const qrX = Math.max(10, Math.round((240 - dims.dots) / 2));
          const topMargin = Math.floor((320 - (dims.dots + 14 + 22)) / 2);
          zpl += `^FO${qrX},${topMargin}^BQN,2,${qrMag}^FDQA,${kode}^FS\n`;
          zpl += `^FO0,${topMargin + dims.dots + 14}^A0N,22,18^FB240,1,0,C,0^FD${kode}^FS\n`;
        } else if (!hasTop && hasBottom) {
          const qrMag = 4;
          const dims = getQrDimensions(kode, qrMag);
          const qrX = Math.max(10, Math.round((240 - dims.dots) / 2));
          zpl += `^FO${qrX},25^BQN,2,${qrMag}^FDQA,${kode}^FS\n`;
          zpl += `^FO0,${25 + dims.dots + 12}^A0N,20,16^FB240,1,0,C,0^FD${kode}^FS\n`;
        } else if (hasTop && !hasBottom) {
          const qrMag = 4;
          const dims = getQrDimensions(kode, qrMag);
          const qrX = Math.max(10, Math.round((240 - dims.dots) / 2));
          zpl += `^FO${qrX},55^BQN,2,${qrMag}^FDQA,${kode}^FS\n`;
          zpl += `^FO0,${55 + dims.dots + 12}^A0N,20,16^FB240,1,0,C,0^FD${kode}^FS\n`;
        } else {
          // Semua aktif
          const qrMag = 3;
          const dims = getQrDimensions(kode, qrMag);
          const qrX = Math.max(10, Math.round((240 - dims.dots) / 2));
          zpl += `^FO${qrX},48^BQN,2,${qrMag}^FDQA,${kode}^FS\n`;
          zpl += `^FO0,${48 + dims.dots + 12}^A0N,18,15^FB240,1,0,C,0^FD${kode}^FS\n`;
        }
      } else {
        if (!hasTop && !hasBottom) {
          // Full Barcode pas di tengah
          zpl += `^FO15,75^BY1,2,10^BCN,110,N,N,N,A^FD${kode}^FS\n`;
          zpl += `^FO0,200^A0N,24,20^FB240,1,0,C,0^FD${kode}^FS\n`;
        } else {
          zpl += `^FO15,48^BY1,2,10^BCN,95,N,N,N,A^FD${kode}^FS\n`;
          zpl += `^FO0,158^A0N,22,18^FB240,1,0,C,0^FD${kode}^FS\n`;
        }
      }

      if (showSku && sku) {
        zpl += `^FO10,205^A0N,20,18^FD${sku}^FS\n`;
      }
      if (showHarga && harga) {
        zpl += `^FO10,245^A0N,34,30^FB220,1,0,C,0^FD${harga}^FS\n`;
      }

      zpl += `^XZ`;
      return zpl;
    })
    .join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const labels: LabelItem[] = Array.isArray(body.labels) ? body.labels : [];
    const format = body.format === "30x40" ? "30x40" : "40x30";

    if (!labels.length) {
      return NextResponse.json({ ok: false, error: "Tidak ada label yang dikirim" }, { status: 400 });
    }

    const printerName = body.printerName || findZebraPrinter();
    const printOptions = body.options || {};
    const zplData = format === "30x40" 
      ? generateZpl30x40(labels, printOptions) 
      : generateZpl40x30(labels, printOptions);

    const tmpFile = path.join(os.tmpdir(), `zebra_job_${Date.now()}.zpl`);
    fs.writeFileSync(tmpFile, zplData, "utf8");

    return new Promise<NextResponse>((resolve) => {
      execFile("/usr/bin/lp", ["-d", printerName, "-o", "raw", tmpFile], (err, stdout, stderr) => {
        try {
          fs.unlinkSync(tmpFile);
        } catch {}

        if (err) {
          console.error("Zebra direct print error:", err, stderr);
          return resolve(
            NextResponse.json(
              {
                ok: false,
                error: `Gagal mencetak ke printer "${printerName}": ${err.message || stderr}`,
                printerName
              },
              { status: 500 }
            )
          );
        }

        resolve(
          NextResponse.json({
            ok: true,
            success: true,
            message: `Berhasil mengirim ${labels.length} label langsung ke Zebra ZD230!`,
            printerName,
            format,
            total: labels.length
          })
        );
      });
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Internal server error" }, { status: 500 });
  }
}

