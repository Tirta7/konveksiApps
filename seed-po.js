const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");

const DATA_PATH = path.join(process.cwd(), "konveksi-data.json");
const now = new Date().toISOString();

async function run() {
  const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));

  // Seed PO Produksi (Ledger Master)
  data.po_produksi = [
    {
      id: 1,
      noPo: "GH-02",
      model: "Gombrong XS-XXL",
      sizeBreakdown: [
        { size: "XS", jumlah: 4 },
        { size: "S", jumlah: 100 },
        { size: "M", jumlah: 150 },
        { size: "L", jumlah: 150 },
        { size: "XL", jumlah: 88 }
      ],
      jumlahTerbit: 492,
      vendorId: 2, // CMT Jahit B (Gianto)
      status: "Open",
      catatan: "PO Dummy 1",
      tanggalTerbit: now
    },
    {
      id: 2,
      noPo: "GH-07",
      model: "Slim Fit M-L",
      sizeBreakdown: [
        { size: "M", jumlah: 60 },
        { size: "L", jumlah: 60 }
      ],
      jumlahTerbit: 120,
      vendorId: 2, // CMT Jahit B (Gianto)
      status: "Open",
      catatan: "PO Dummy 2",
      tanggalTerbit: now
    },
    {
      id: 3,
      noPo: "GH-14",
      model: "Reguler Fit S-XL",
      sizeBreakdown: [
        { size: "S", jumlah: 100 },
        { size: "M", jumlah: 200 },
        { size: "L", jumlah: 200 }
      ],
      jumlahTerbit: 500,
      vendorId: 2, // CMT Jahit B (Gianto)
      status: "Open",
      catatan: "PO Dummy 3",
      tanggalTerbit: now
    }
  ];

  // Seed PO Pengambilan (Ledger Transaction)
  data.po_pengambilan = [
    {
      id: 1, poId: 1, jumlahDiambil: 250, penerima: "CMT Washing A", catatan: "Pengambilan tahap 1", tanggalAmbil: now
    },
    {
      id: 2, poId: 1, jumlahDiambil: 242, penerima: "CMT Washing A", catatan: "Pengambilan tahap 2", tanggalAmbil: now
    }
  ];

  // Seed Barcode Items for GH-02 (just a few for demo)
  data.barcode_item = [];
  let barcodeCounter = 1;
  for (let i = 1; i <= 10; i++) {
    const kb = `GH-02-M-00${i}`;
    data.barcode_item.push({
      id: barcodeCounter++,
      poId: 1,
      kodeBarcode: kb,
      size: "M",
      qrCode: await QRCode.toDataURL(kb),
      status: "potong",
      createdAt: now
    });
  }

  // Generate Gaji CMT based on pengambilan
  data.gaji_cmt = [
    { id: 1, cmtId: 2, poId: 1, jumlahPcs: 250, totalGaji: 250 * 15000, tanggal: now },
    { id: 2, cmtId: 2, poId: 1, jumlahPcs: 242, totalGaji: 242 * 15000, tanggal: now }
  ];

  data._counters.po_produksi = 3;
  data._counters.po_pengambilan = 2;
  data._counters.barcode_item = 10;
  data._counters.gaji_cmt = 2;

  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
  console.log("Seeded PO Ledger & Barcodes!");
}

run();
