CREATE TABLE `batches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kode_batch` text NOT NULL,
	`jenis_kain` text NOT NULL,
	`jumlah_meter` real,
	`jumlah_pcs` integer,
	`size_breakdown` text,
	`status` text DEFAULT 'bahan-mentah' NOT NULL,
	`current_step` integer DEFAULT 0 NOT NULL,
	`token` text NOT NULL,
	`route_selesai` integer DEFAULT false NOT NULL,
	`is_retur` integer DEFAULT false NOT NULL,
	`parent_batch_id` integer,
	`created_at` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `batches_kode_batch_unique` ON `batches` (`kode_batch`);--> statement-breakpoint
CREATE UNIQUE INDEX `batches_token_unique` ON `batches` (`token`);--> statement-breakpoint
CREATE TABLE `bundles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kode_bundel` text NOT NULL,
	`batch_id` integer NOT NULL,
	`jumlah_pcs` integer NOT NULL,
	`status` text DEFAULT 'menunggu' NOT NULL,
	`qr_code` text,
	`current_vendor_id` integer,
	`retur_count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`current_vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bundles_kode_bundel_unique` ON `bundles` (`kode_bundel`);--> statement-breakpoint
CREATE TABLE `data_barang` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uid` text NOT NULL,
	`kategori_id` integer NOT NULL,
	`nama_barang` text NOT NULL,
	`harga_beli` integer NOT NULL,
	`harga_jual` integer NOT NULL,
	`stok` integer NOT NULL,
	`created_at` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`kategori_id`) REFERENCES `kategori_produk`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `data_barang_uid_unique` ON `data_barang` (`uid`);--> statement-breakpoint
CREATE TABLE `data_supplier` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uid` text NOT NULL,
	`nama_supplier` text NOT NULL,
	`kontak` text NOT NULL,
	`alamat` text NOT NULL,
	`jenis_material` text NOT NULL,
	`created_at` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `data_supplier_uid_unique` ON `data_supplier` (`uid`);--> statement-breakpoint
CREATE TABLE `gaji_cmt` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cmt_id` integer NOT NULL,
	`spk_id` integer NOT NULL,
	`jumlah_pcs` integer NOT NULL,
	`total_gaji` integer NOT NULL,
	`tanggal` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`cmt_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`spk_id`) REFERENCES `spk`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `kategori_produk` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uid` text NOT NULL,
	`nama` text NOT NULL,
	`deskripsi` text,
	`created_at` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `kategori_produk_uid_unique` ON `kategori_produk` (`uid`);--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`no_po` text NOT NULL,
	`kategori` text NOT NULL,
	`jumlah` integer NOT NULL,
	`tanggal_kirim` text NOT NULL,
	`tanggal_po` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'baru' NOT NULL,
	`catatan` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_orders_no_po_unique` ON `purchase_orders` (`no_po`);--> statement-breakpoint
CREATE TABLE `retail_sales` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tanggal` text DEFAULT '' NOT NULL,
	`kategori` text NOT NULL,
	`jumlah` integer NOT NULL,
	`catatan` text
);
--> statement-breakpoint
CREATE TABLE `retur_online` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`no_retur` text NOT NULL,
	`po_id` integer,
	`alasan` text NOT NULL,
	`jumlah` integer NOT NULL,
	`kondisi` text NOT NULL,
	`status` text DEFAULT 'diproses' NOT NULL,
	`tanggal` text DEFAULT '' NOT NULL,
	`catatan` text,
	FOREIGN KEY (`po_id`) REFERENCES `purchase_orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `retur_online_no_retur_unique` ON `retur_online` (`no_retur`);--> statement-breakpoint
CREATE TABLE `retur_produksi` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`batch_id` integer NOT NULL,
	`bundle_id` integer,
	`alasan` text NOT NULL,
	`ke_berapa_kali` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'menunggu-spk-retur' NOT NULL,
	`tanggal` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bundle_id`) REFERENCES `bundles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `spk` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`no_spk` text NOT NULL,
	`batch_id` integer NOT NULL,
	`step_order` integer DEFAULT 1 NOT NULL,
	`vendor_id` integer NOT NULL,
	`jenis_pekerjaan` text NOT NULL,
	`target_jumlah` integer NOT NULL,
	`jumlah_selesai` integer DEFAULT 0 NOT NULL,
	`deadline` text,
	`catatan` text,
	`token` text NOT NULL,
	`status` text DEFAULT 'menunggu' NOT NULL,
	`tanggal_terbit` text DEFAULT '' NOT NULL,
	`tanggal_diterima` text,
	`tanggal_selesai` text,
	`is_retur` integer DEFAULT false NOT NULL,
	`retur_ke` integer DEFAULT 0,
	FOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `spk_no_spk_unique` ON `spk` (`no_spk`);--> statement-breakpoint
CREATE UNIQUE INDEX `spk_token_unique` ON `spk` (`token`);--> statement-breakpoint
CREATE TABLE `spk_progres` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`spk_id` integer NOT NULL,
	`bundle_id` integer NOT NULL,
	`jumlah_selesai` integer NOT NULL,
	`tanggal` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`spk_id`) REFERENCES `spk`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bundle_id`) REFERENCES `bundles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `stock` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kategori` text NOT NULL,
	`stok_saat_ini` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stock_kategori_unique` ON `stock` (`kategori`);--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tanggal` text DEFAULT '' NOT NULL,
	`jenis` text NOT NULL,
	`kategori` text NOT NULL,
	`jumlah` integer NOT NULL,
	`keterangan` text,
	`referensi_id` text,
	`referensi_tipe` text
);
--> statement-breakpoint
CREATE TABLE `tracking_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`batch_id` integer NOT NULL,
	`spk_id` integer,
	`bundle_id` integer,
	`vendor_id` integer,
	`aksi` text NOT NULL,
	`keterangan` text,
	`waktu` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`spk_id`) REFERENCES `spk`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bundle_id`) REFERENCES `bundles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `vendors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nama` text NOT NULL,
	`nama_pic` text,
	`tipe` text DEFAULT 'vendor' NOT NULL,
	`jenis_pekerjaan` text NOT NULL,
	`kontak` text,
	`harga_per_pcs` integer,
	`aktif` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT '' NOT NULL
);
