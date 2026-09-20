import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const vendors = sqliteTable("vendors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nama: text("nama").notNull(),
  namaPic: text("nama_pic"), 
  tipe: text("tipe").notNull().default("vendor"), 
  jenisPekerjaan: text("jenis_pekerjaan").notNull(),
  kontak: text("kontak"),
  hargaPerPcs: integer("harga_per_pcs"), 
  tarifPotongan: text("tarif_potongan", { mode: "json" }),
  aktif: integer("aktif", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(""),
});

export const batches = sqliteTable("batches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kodeBatch: text("kode_batch").notNull().unique(),
  jenisKain: text("jenis_kain").notNull(),
  jumlahMeter: real("jumlah_meter"),
  jumlahPcs: integer("jumlah_pcs"),
  sizeBreakdown: text("size_breakdown", { mode: "json" }), 
  status: text("status").notNull().default("bahan-mentah"),
  currentStep: integer("current_step").notNull().default(0),
  token: text("token").notNull().unique(),
  routeSelesai: integer("route_selesai", { mode: "boolean" }).notNull().default(false),
  isRetur: integer("is_retur", { mode: "boolean" }).notNull().default(false),
  parentBatchId: integer("parent_batch_id"),
  createdAt: text("created_at").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(""),
});

export const bundles = sqliteTable("bundles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kodeBundel: text("kode_bundel").notNull().unique(),
  batchId: integer("batch_id").notNull().references(() => batches.id),
  jumlahPcs: integer("jumlah_pcs").notNull(),
  status: text("status").notNull().default("menunggu"),
  qrCode: text("qr_code"), 
  currentVendorId: integer("current_vendor_id").references(() => vendors.id),
  returCount: integer("retur_count").notNull().default(0), 
  createdAt: text("created_at").notNull().default(""),
});

export const spk = sqliteTable("spk", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  noSpk: text("no_spk").notNull().unique(),
  batchId: integer("batch_id").notNull().references(() => batches.id),
  stepOrder: integer("step_order").notNull().default(1),
  vendorId: integer("vendor_id").notNull().references(() => vendors.id),
  jenisPekerjaan: text("jenis_pekerjaan").notNull(),
  targetJumlah: integer("target_jumlah").notNull(),
  jumlahSelesai: integer("jumlah_selesai").notNull().default(0),
  deadline: text("deadline"),
  catatan: text("catatan"),
  token: text("token").notNull().unique(),
  status: text("status").notNull().default("menunggu"), 
  tanggalTerbit: text("tanggal_terbit").notNull().default(""),
  tanggalDiterima: text("tanggal_diterima"),
  tanggalSelesai: text("tanggal_selesai"),
  isRetur: integer("is_retur", { mode: "boolean" }).notNull().default(false),
  returKe: integer("retur_ke").default(0),
});

export const spkProgres = sqliteTable("spk_progres", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  spkId: integer("spk_id").notNull().references(() => spk.id),
  bundleId: integer("bundle_id").notNull().references(() => bundles.id),
  jumlahSelesai: integer("jumlah_selesai").notNull(),
  tanggal: text("tanggal").notNull().default(""),
});

export const gajiCmt = sqliteTable("gaji_cmt", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cmtId: integer("cmt_id").notNull().references(() => vendors.id),
  spkId: integer("spk_id").notNull().references(() => spk.id),
  jumlahPcs: integer("jumlah_pcs").notNull(),
  totalGaji: integer("total_gaji").notNull(), 
  tanggal: text("tanggal").notNull().default(""),
});

export const trackingLogs = sqliteTable("tracking_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  batchId: integer("batch_id").notNull().references(() => batches.id),
  spkId: integer("spk_id").references(() => spk.id),
  bundleId: integer("bundle_id").references(() => bundles.id),
  vendorId: integer("vendor_id").references(() => vendors.id),
  aksi: text("aksi").notNull(),
  keterangan: text("keterangan"),
  waktu: text("waktu").notNull().default(""),
});

export const stock = sqliteTable("stock", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kategori: text("kategori").notNull().unique(),
  stokSaatIni: integer("stok_saat_ini").notNull().default(0),
  updatedAt: text("updated_at").notNull().default(""),
});

export const stockMovements = sqliteTable("stock_movements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tanggal: text("tanggal").notNull().default(""),
  jenis: text("jenis").notNull(), 
  kategori: text("kategori").notNull(),
  jumlah: integer("jumlah").notNull(),
  keterangan: text("keterangan"),
  referensiId: text("referensi_id"),
  referensiTipe: text("referensi_tipe"),
});

export const purchaseOrders = sqliteTable("purchase_orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  noPo: text("no_po").notNull().unique(),
  kategori: text("kategori").notNull(),
  jumlah: integer("jumlah").notNull(),
  tanggalKirim: text("tanggal_kirim").notNull(),
  tanggalPo: text("tanggal_po").notNull().default(""),
  status: text("status").notNull().default("baru"),
  catatan: text("catatan"),
});

export const retailSales = sqliteTable("retail_sales", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tanggal: text("tanggal").notNull().default(""),
  kategori: text("kategori").notNull(),
  jumlah: integer("jumlah").notNull(),
  catatan: text("catatan"),
});

export const returProduksi = sqliteTable("retur_produksi", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  batchId: integer("batch_id").notNull().references(() => batches.id),
  bundleId: integer("bundle_id").references(() => bundles.id),
  alasan: text("alasan").notNull(),
  keBerapaKali: integer("ke_berapa_kali").notNull().default(1),
  status: text("status").notNull().default("menunggu-spk-retur"),
  tanggal: text("tanggal").notNull().default(""),
});

export const returOnline = sqliteTable("retur_online", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  noRetur: text("no_retur").notNull().unique(),
  poId: integer("po_id").references(() => purchaseOrders.id),
  alasan: text("alasan").notNull(),
  jumlah: integer("jumlah").notNull(),
  kondisi: text("kondisi").notNull(),
  status: text("status").notNull().default("diproses"),
  tanggal: text("tanggal").notNull().default(""),
  catatan: text("catatan"),
});

export const kategoriProduk = sqliteTable("kategori_produk", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  uid: text("uid").notNull().unique(),
  nama: text("nama").notNull(),
  deskripsi: text("deskripsi"),
  createdAt: text("created_at").notNull().default(""),
});

export const dataBarang = sqliteTable("data_barang", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  uid: text("uid").notNull().unique(),
  kategoriId: integer("kategori_id").notNull().references(() => kategoriProduk.id),
  namaBarang: text("nama_barang").notNull(),
  hargaBeli: integer("harga_beli").notNull(),
  hargaJual: integer("harga_jual").notNull(),
  stok: integer("stok").notNull(),
  createdAt: text("created_at").notNull().default(""),
});

export const dataSupplier = sqliteTable("data_supplier", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  uid: text("uid").notNull().unique(),
  namaSupplier: text("nama_supplier").notNull(),
  kontak: text("kontak").notNull(),
  alamat: text("alamat").notNull(),
  jenisMaterial: text("jenis_material").notNull(),
  createdAt: text("created_at").notNull().default(""),
});
