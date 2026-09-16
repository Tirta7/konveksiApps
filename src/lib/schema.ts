// Drizzle ORM Schema — KonveksiApps
// Semua tabel SQLite didefinisikan di sini

import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// ─── VENDORS ────────────────────────────────────────────────────────────────
export const vendors = sqliteTable("vendors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nama: text("nama").notNull(),
  jenisPekerjaan: text("jenis_pekerjaan").notNull(), // potong-jahit | washing | finishing-qc-packing
  kontak: text("kontak"),
  createdAt: text("created_at").notNull().default(""),
});

// ─── BATCH KAIN ─────────────────────────────────────────────────────────────
export const batches = sqliteTable("batches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kodeB: text("kode_batch").notNull().unique(), // e.g. BATCH-2024-001
  jenisCain: text("jenis_kain").notNull(),
  jumlahMeter: real("jumlah_meter"),
  jumlahPcs: integer("jumlah_pcs"),
  // Status: bahan-mentah | potong-jahit | washing | finishing-qc | gudang | reject
  status: text("status").notNull().default("bahan-mentah"),
  vendorSaatIni: integer("vendor_saat_ini").references(() => vendors.id),
  createdAt: text("created_at").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(""),
});

// ─── BUNDEL ─────────────────────────────────────────────────────────────────
export const bundles = sqliteTable("bundles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kodeBundel: text("kode_bundel").notNull().unique(), // e.g. BDL-001-001
  batchId: integer("batch_id").notNull().references(() => batches.id),
  jumlahPcs: integer("jumlah_pcs").notNull().default(0),
  qrCode: text("qr_code"), // base64 QR code image
  // Status: menunggu | potong-jahit | washing | finishing-qc | gudang | reject
  status: text("status").notNull().default("menunggu"),
  createdAt: text("created_at").notNull().default(""),
});

// ─── SPK (Surat Perintah Kerja) ──────────────────────────────────────────────
export const spk = sqliteTable("spk", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  noSpk: text("no_spk").notNull().unique(), // e.g. SPK-2024-001
  batchId: integer("batch_id").notNull().references(() => batches.id),
  vendorId: integer("vendor_id").notNull().references(() => vendors.id),
  jenisPekerjaan: text("jenis_pekerjaan").notNull(),
  jumlahBarang: integer("jumlah_barang").notNull(),
  deadline: text("deadline").notNull(),
  catatan: text("catatan"),
  token: text("token").notNull().unique(), // UUID unik per SPK
  // Status: menunggu-diterima | diterima | selesai-dikerjakan | dikirim
  status: text("status").notNull().default("menunggu-diterima"),
  tanggalTerbit: text("tanggal_terbit").notNull().default(""),
  tanggalDiterima: text("tanggal_diterima"),
  tanggalSelesai: text("tanggal_selesai"),
  // Apakah ini SPK retur washing
  isRetur: integer("is_retur", { mode: "boolean" }).notNull().default(false),
  returKe: integer("retur_ke").default(0), // 1 atau 2
});

// ─── SPK LOGS ───────────────────────────────────────────────────────────────
export const spkLogs = sqliteTable("spk_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  spkId: integer("spk_id").notNull().references(() => spk.id),
  aksi: text("aksi").notNull(), // terbit | diterima | selesai | dikirim
  waktu: text("waktu").notNull().default(""),
  catatan: text("catatan"),
});

// ─── TRACKING LOGS (Riwayat Perjalanan Batch) ────────────────────────────────
export const trackingLogs = sqliteTable("tracking_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  batchId: integer("batch_id").notNull().references(() => batches.id),
  spkId: integer("spk_id").references(() => spk.id),
  vendorId: integer("vendor_id").references(() => vendors.id),
  aksi: text("aksi").notNull(), // masuk-vendor | selesai-vendor | masuk-gudang | reject
  keterangan: text("keterangan"),
  waktu: text("waktu").notNull().default(""),
});

// ─── STOK GUDANG ────────────────────────────────────────────────────────────
export const stock = sqliteTable("stock", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kategori: text("kategori").notNull().unique(),
  stokSaatIni: integer("stok_saat_ini").notNull().default(0),
  updatedAt: text("updated_at").notNull().default(""),
});

// ─── PERGERAKAN STOK ────────────────────────────────────────────────────────
export const stockMovements = sqliteTable("stock_movements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tanggal: text("tanggal").notNull().default(""),
  jenis: text("jenis").notNull(), // masuk | keluar
  kategori: text("kategori").notNull(),
  jumlah: integer("jumlah").notNull(),
  keterangan: text("keterangan"),
  referensiId: text("referensi_id"), // PO ID, SPK ID, dll
  referensiTipe: text("referensi_tipe"), // po | spk | retail | retur
});

// ─── PURCHASE ORDERS (Online) ────────────────────────────────────────────────
export const purchaseOrders = sqliteTable("purchase_orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  noPo: text("no_po").notNull().unique(),
  kategori: text("kategori").notNull(),
  jumlah: integer("jumlah").notNull(),
  tanggalKirim: text("tanggal_kirim").notNull(),
  tanggalPo: text("tanggal_po").notNull().default(""),
  // Status: baru | diproses | siap-kirim | terkirim
  status: text("status").notNull().default("baru"),
  catatan: text("catatan"),
});

// ─── PENJUALAN RETAIL OFFLINE ────────────────────────────────────────────────
export const retailSales = sqliteTable("retail_sales", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tanggal: text("tanggal").notNull(),
  kategori: text("kategori").notNull(),
  jumlah: integer("jumlah").notNull(),
  catatan: text("catatan"),
});

// ─── RETUR PRODUKSI (QC Gagal) ───────────────────────────────────────────────
export const returProduksi = sqliteTable("retur_produksi", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  batchId: integer("batch_id").notNull().references(() => batches.id),
  alasan: text("alasan").notNull(),
  keBerapaKali: integer("ke_berapa_kali").notNull().default(1), // 1 atau 2
  // Status: menunggu-spk-retur | diproses-ulang | selesai | reject-permanen
  status: text("status").notNull().default("menunggu-spk-retur"),
  tanggal: text("tanggal").notNull().default(""),
});

// ─── RETUR ONLINE (Dari Pembeli) ─────────────────────────────────────────────
export const returOnline = sqliteTable("retur_online", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  noRetur: text("no_retur").notNull().unique(),
  poId: integer("po_id").references(() => purchaseOrders.id),
  alasan: text("alasan").notNull(), // rusak | salah-ukuran | tidak-sesuai | lainnya
  jumlah: integer("jumlah").notNull(),
  kondisi: text("kondisi").notNull(), // bisa-dijual | rusak
  // Status: masuk-gudang | ditolak | diproses
  status: text("status").notNull().default("diproses"),
  tanggal: text("tanggal").notNull().default(""),
  catatan: text("catatan"),
});
