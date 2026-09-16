/**
 * db-raw.ts — Menggunakan node:sqlite (built-in Node.js 22+)
 * Tidak butuh instalasi native module apapun.
 */
import path from "path";

// Node.js 22 built-in SQLite (experimental, enabled by default di 22.5+)
const { DatabaseSync } = require("node:sqlite");

const DB_PATH = path.join(process.cwd(), "konveksi.db");

export function openDb() {
  const db = new DatabaseSync(DB_PATH);
  initTables(db);
  return db;
}

function initTables(db: any) {
  db.exec(`
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
  seedIfEmpty(db);
}

function seedIfEmpty(db: any) {
  const row = db.prepare("SELECT COUNT(*) AS c FROM vendors").get() as any;
  if (row.c > 0) return;
  const now = new Date().toISOString();

  db.prepare(`INSERT INTO vendors (nama, jenis_pekerjaan, kontak, created_at) VALUES (?,?,?,?)`).run("Vendor A — Mitra Jaya", "potong-jahit", "081234567001", now);
  db.prepare(`INSERT INTO vendors (nama, jenis_pekerjaan, kontak, created_at) VALUES (?,?,?,?)`).run("Vendor B — Laundry Prima", "washing", "081234567002", now);
  db.prepare(`INSERT INTO vendors (nama, jenis_pekerjaan, kontak, created_at) VALUES (?,?,?,?)`).run("Vendor C — Finishing Mandiri", "finishing-qc-packing", "081234567003", now);

  const kategoriList = ["Slim Fit","Regular Fit","Bootcut","Skinny","Wide Leg","Mom Jeans","Straight Cut","Cargo Jeans"];
  for (const k of kategoriList) {
    db.prepare(`INSERT INTO stock (kategori, stok_saat_ini, updated_at) VALUES (?,0,?)`).run(k, now);
  }

  const b1 = db.prepare(`INSERT INTO batches (kode_batch, jenis_kain, jumlah_meter, jumlah_pcs, status, vendor_saat_ini, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)`).run("BATCH-2024-001","Denim Biru 12oz",150,300,"washing",2,now,now);
  const b2 = db.prepare(`INSERT INTO batches (kode_batch, jenis_kain, jumlah_meter, jumlah_pcs, status, vendor_saat_ini, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)`).run("BATCH-2024-002","Denim Hitam 14oz",200,400,"finishing-qc",3,now,now);
  const b3 = db.prepare(`INSERT INTO batches (kode_batch, jenis_kain, jumlah_meter, jumlah_pcs, status, vendor_saat_ini, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)`).run("BATCH-2024-003","Denim Abu 11oz",100,200,"gudang",null,now,now);

  const stok: [string, number][] = [["Slim Fit",45],["Regular Fit",60],["Bootcut",30],["Skinny",35],["Wide Leg",30]];
  for (const [k, j] of stok) {
    db.prepare(`UPDATE stock SET stok_saat_ini=stok_saat_ini+?,updated_at=? WHERE kategori=?`).run(j, now, k);
    db.prepare(`INSERT INTO stock_movements (tanggal,jenis,kategori,jumlah,keterangan,referensi_id,referensi_tipe) VALUES (?,?,?,?,?,?,?)`).run(now,"masuk",k,j,`Produksi BATCH-2024-003`,String(b3.lastInsertRowid),"spk");
  }

  db.prepare(`INSERT INTO tracking_logs (batch_id,vendor_id,aksi,keterangan,waktu) VALUES (?,?,?,?,?)`).run(b1.lastInsertRowid,1,"masuk-vendor","SPK Potong & Jahit diterima",now);
  db.prepare(`INSERT INTO tracking_logs (batch_id,vendor_id,aksi,keterangan,waktu) VALUES (?,?,?,?,?)`).run(b1.lastInsertRowid,1,"selesai-vendor","Selesai potong & jahit",now);
  db.prepare(`INSERT INTO tracking_logs (batch_id,vendor_id,aksi,keterangan,waktu) VALUES (?,?,?,?,?)`).run(b1.lastInsertRowid,2,"masuk-vendor","SPK Washing diterima",now);

  const poKat=["Slim Fit","Regular Fit","Skinny","Bootcut","Wide Leg"];
  const poJml=[50,80,40,35,30];
  const poStat=["terkirim","terkirim","siap-kirim","diproses","baru"];
  const poDates=["2024-09-20","2024-09-22","2024-09-25","2024-09-28","2024-10-01"];
  for (let i=0;i<5;i++) {
    db.prepare(`INSERT INTO purchase_orders (no_po,kategori,jumlah,tanggal_kirim,tanggal_po,status) VALUES (?,?,?,?,?,?)`).run(`PO-2024-00${i+1}`,poKat[i],poJml[i],poDates[i],now,poStat[i]);
  }

  const retailData: [string,number][] = [["Slim Fit",12],["Regular Fit",18],["Mom Jeans",8],["Straight Cut",15],["Slim Fit",10],["Skinny",9]];
  retailData.forEach(([k,j],i)=>{
    const d=new Date(); d.setDate(d.getDate()-i);
    db.prepare(`INSERT INTO retail_sales (tanggal,kategori,jumlah) VALUES (?,?,?)`).run(d.toISOString().split("T")[0],k,j);
  });
}
