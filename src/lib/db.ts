import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";

// Database file disimpan di root project
const DB_PATH = path.join(process.cwd(), "konveksi.db");

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!_db) {
    const sqlite = new Database(DB_PATH);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    _db = drizzle(sqlite, { schema });
    initDb(sqlite);
  }
  return _db;
}

function initDb(sqlite: Database.Database) {
  // Create all tables
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS vendors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama TEXT NOT NULL,
      jenis_pekerjaan TEXT NOT NULL,
      kontak TEXT,
      created_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kode_batch TEXT NOT NULL UNIQUE,
      jenis_kain TEXT NOT NULL,
      jumlah_meter REAL,
      jumlah_pcs INTEGER,
      status TEXT NOT NULL DEFAULT 'bahan-mentah',
      vendor_saat_ini INTEGER REFERENCES vendors(id),
      created_at TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS bundles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kode_bundel TEXT NOT NULL UNIQUE,
      batch_id INTEGER NOT NULL REFERENCES batches(id),
      jumlah_pcs INTEGER NOT NULL DEFAULT 0,
      qr_code TEXT,
      status TEXT NOT NULL DEFAULT 'menunggu',
      created_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS spk (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      no_spk TEXT NOT NULL UNIQUE,
      batch_id INTEGER NOT NULL REFERENCES batches(id),
      vendor_id INTEGER NOT NULL REFERENCES vendors(id),
      jenis_pekerjaan TEXT NOT NULL,
      jumlah_barang INTEGER NOT NULL,
      deadline TEXT NOT NULL,
      catatan TEXT,
      token TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'menunggu-diterima',
      tanggal_terbit TEXT NOT NULL DEFAULT '',
      tanggal_diterima TEXT,
      tanggal_selesai TEXT,
      is_retur INTEGER NOT NULL DEFAULT 0,
      retur_ke INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS spk_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      spk_id INTEGER NOT NULL REFERENCES spk(id),
      aksi TEXT NOT NULL,
      waktu TEXT NOT NULL DEFAULT '',
      catatan TEXT
    );

    CREATE TABLE IF NOT EXISTS tracking_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL REFERENCES batches(id),
      spk_id INTEGER REFERENCES spk(id),
      vendor_id INTEGER REFERENCES vendors(id),
      aksi TEXT NOT NULL,
      keterangan TEXT,
      waktu TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS stock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kategori TEXT NOT NULL UNIQUE,
      stok_saat_ini INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tanggal TEXT NOT NULL DEFAULT '',
      jenis TEXT NOT NULL,
      kategori TEXT NOT NULL,
      jumlah INTEGER NOT NULL,
      keterangan TEXT,
      referensi_id TEXT,
      referensi_tipe TEXT
    );

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      no_po TEXT NOT NULL UNIQUE,
      kategori TEXT NOT NULL,
      jumlah INTEGER NOT NULL,
      tanggal_kirim TEXT NOT NULL,
      tanggal_po TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'baru',
      catatan TEXT
    );

    CREATE TABLE IF NOT EXISTS retail_sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tanggal TEXT NOT NULL,
      kategori TEXT NOT NULL,
      jumlah INTEGER NOT NULL,
      catatan TEXT
    );

    CREATE TABLE IF NOT EXISTS retur_produksi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL REFERENCES batches(id),
      alasan TEXT NOT NULL,
      ke_berapa_kali INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'menunggu-spk-retur',
      tanggal TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS retur_online (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      no_retur TEXT NOT NULL UNIQUE,
      po_id INTEGER REFERENCES purchase_orders(id),
      alasan TEXT NOT NULL,
      jumlah INTEGER NOT NULL,
      kondisi TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'diproses',
      tanggal TEXT NOT NULL DEFAULT '',
      catatan TEXT
    );
  `);

  // Seed initial data jika belum ada
  seedIfEmpty(sqlite);
}

function seedIfEmpty(sqlite: Database.Database) {
  const vendorCount = (sqlite.prepare("SELECT COUNT(*) as cnt FROM vendors").get() as { cnt: number }).cnt;
  if (vendorCount > 0) return;

  const now = new Date().toISOString();

  // Seed vendors
  sqlite.prepare(`INSERT INTO vendors (nama, jenis_pekerjaan, kontak, created_at) VALUES (?, ?, ?, ?)`).run("Vendor A — Mitra Jaya", "potong-jahit", "081234567001", now);
  sqlite.prepare(`INSERT INTO vendors (nama, jenis_pekerjaan, kontak, created_at) VALUES (?, ?, ?, ?)`).run("Vendor B — Laundry Prima", "washing", "081234567002", now);
  sqlite.prepare(`INSERT INTO vendors (nama, jenis_pekerjaan, kontak, created_at) VALUES (?, ?, ?, ?)`).run("Vendor C — Finishing Mandiri", "finishing-qc-packing", "081234567003", now);

  // Seed stock categories
  const kategoriList = [
    "Slim Fit", "Regular Fit", "Bootcut", "Skinny",
    "Wide Leg", "Mom Jeans", "Straight Cut", "Cargo Jeans"
  ];
  for (const k of kategoriList) {
    sqlite.prepare(`INSERT INTO stock (kategori, stok_saat_ini, updated_at) VALUES (?, 0, ?)`).run(k, now);
  }

  // Seed demo batches
  const batch1Id = (sqlite.prepare(`INSERT INTO batches (kode_batch, jenis_kain, jumlah_meter, jumlah_pcs, status, vendor_saat_ini, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run("BATCH-2024-001", "Denim Biru 12oz", 150, 300, "washing", 2, now, now)).lastInsertRowid;
  const batch2Id = (sqlite.prepare(`INSERT INTO batches (kode_batch, jenis_kain, jumlah_meter, jumlah_pcs, status, vendor_saat_ini, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run("BATCH-2024-002", "Denim Hitam 14oz", 200, 400, "finishing-qc", 3, now, now)).lastInsertRowid;
  const batch3Id = (sqlite.prepare(`INSERT INTO batches (kode_batch, jenis_kain, jumlah_meter, jumlah_pcs, status, vendor_saat_ini, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run("BATCH-2024-003", "Denim Abu 11oz", 100, 200, "gudang", null, now, now)).lastInsertRowid;

  // Seed stock movements for batch 3 (already in gudang)
  const stokData = [
    ["Slim Fit", 45], ["Regular Fit", 60], ["Bootcut", 30],
    ["Skinny", 35], ["Wide Leg", 30]
  ];
  for (const [kat, jml] of stokData) {
    sqlite.prepare(`UPDATE stock SET stok_saat_ini = stok_saat_ini + ?, updated_at = ? WHERE kategori = ?`).run(jml, now, kat);
    sqlite.prepare(`INSERT INTO stock_movements (tanggal, jenis, kategori, jumlah, keterangan, referensi_id, referensi_tipe) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(now, "masuk", kat, jml, "Produksi BATCH-2024-003 selesai QC", `${batch3Id}`, "spk");
  }

  // Seed tracking logs for batch 1
  sqlite.prepare(`INSERT INTO tracking_logs (batch_id, vendor_id, aksi, keterangan, waktu) VALUES (?, ?, ?, ?, ?)`).run(batch1Id, 1, "masuk-vendor", "SPK Potong & Jahit diterima", now);
  sqlite.prepare(`INSERT INTO tracking_logs (batch_id, vendor_id, aksi, keterangan, waktu) VALUES (?, ?, ?, ?, ?)`).run(batch1Id, 1, "selesai-vendor", "Selesai potong & jahit", now);
  sqlite.prepare(`INSERT INTO tracking_logs (batch_id, vendor_id, aksi, keterangan, waktu) VALUES (?, ?, ?, ?, ?)`).run(batch1Id, 2, "masuk-vendor", "SPK Washing diterima", now);

  // Seed PO online
  const poDates = ["2024-09-20", "2024-09-22", "2024-09-25", "2024-09-28", "2024-10-01"];
  const poKat = ["Slim Fit", "Regular Fit", "Skinny", "Bootcut", "Wide Leg"];
  const poJml = [50, 80, 40, 35, 30];
  const poStatus = ["terkirim", "terkirim", "siap-kirim", "diproses", "baru"];
  for (let i = 0; i < 5; i++) {
    sqlite.prepare(`INSERT INTO purchase_orders (no_po, kategori, jumlah, tanggal_kirim, tanggal_po, status) VALUES (?, ?, ?, ?, ?, ?)`).run(`PO-2024-00${i + 1}`, poKat[i], poJml[i], poDates[i], now, poStatus[i]);
  }

  // Seed retail sales
  const retailData = [
    ["Slim Fit", 12], ["Regular Fit", 18], ["Mom Jeans", 8],
    ["Straight Cut", 15], ["Slim Fit", 10], ["Skinny", 9],
  ];
  retailData.forEach(([kat, jml], i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    sqlite.prepare(`INSERT INTO retail_sales (tanggal, kategori, jumlah) VALUES (?, ?, ?)`).run(d.toISOString().split("T")[0], kat, jml);
  });
}
