const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(process.cwd(), "konveksi-data.json");
const now = new Date().toISOString();

const data = {
  vendors: [
    { id: 1, nama: "Vendor Potong A", tipe: "vendor", jenis_pekerjaan: "Potong", aktif: true },
    { id: 2, nama: "CMT Jahit B", tipe: "cmt", jenis_pekerjaan: "Jahit", aktif: true, hargaPerPcs: 15000 },
    { id: 3, nama: "Washing C", tipe: "vendor", jenis_pekerjaan: "Washing", aktif: true }
  ],
  batches: [
    {
      id: 1,
      kodeBatch: "BATCH-2024-001",
      jenisKain: "Denim 12oz",
      jumlahMeter: 100,
      jumlahPcs: 200,
      sizeBreakdown: [],
      status: "dalam-proses",
      currentStep: 1,
      token: "dummy-batch-token-1",
      isRetur: false,
      createdAt: now
    }
  ],
  bundles: [
    { id: 1, kodeBundel: "BATCH-2024-001-BDL-1", batchId: 1, jumlahPcs: 50, status: "dikerjakan", returCount: 0, currentVendorId: 1 },
    { id: 2, kodeBundel: "BATCH-2024-001-BDL-2", batchId: 1, jumlahPcs: 50, status: "menunggu", returCount: 0 },
    { id: 3, kodeBundel: "BATCH-2024-001-BDL-3", batchId: 1, jumlahPcs: 50, status: "menunggu", returCount: 0 },
    { id: 4, kodeBundel: "BATCH-2024-001-BDL-4", batchId: 1, jumlahPcs: 50, status: "menunggu", returCount: 0 }
  ],
  spk: [
    {
      id: 1,
      noSpk: "SPK-BATCH-2024-001-1",
      batchId: 1,
      stepOrder: 1,
      vendorId: 1,
      jenisPekerjaan: "Potong",
      targetJumlah: 200,
      jumlahSelesai: 0,
      token: "dummy-spk-token-1",
      status: "berjalan",
      tanggalTerbit: now
    },
    {
      id: 2,
      noSpk: "SPK-BATCH-2024-001-2",
      batchId: 1,
      stepOrder: 2,
      vendorId: 2,
      jenisPekerjaan: "Jahit",
      targetJumlah: 200,
      jumlahSelesai: 0,
      token: "dummy-spk-token-2",
      status: "menunggu",
      tanggalTerbit: now
    }
  ],
  spk_progres: [],
  gaji_cmt: [],
  tracking_logs: [
    { id: 1, batchId: 1, aksi: "mulai-produksi", keterangan: "Route produksi dimulai.", waktu: now }
  ],
  stock: [],
  stock_movements: [],
  purchase_orders: [],
  retail_sales: [],
  retur_produksi: [],
  retur_online: [],
  kategori_produk: [],
  data_barang: [],
  data_supplier: [],
  _counters: {
    batches: 1,
    bundles: 4,
    spk: 2,
    vendors: 3,
    tracking_logs: 1
  }
};

fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
console.log("Seeded konveksi-data.json");
