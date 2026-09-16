/**
 * data-store.ts — JSON file-based database (updated with dynamic vendor routes)
 */
import fs from "fs";
import path from "path";

const DATA_PATH = path.join(process.cwd(), "konveksi-data.json");

export interface DataStore {
  vendors: Vendor[];
  batches: Batch[];
  batch_steps: BatchStep[];     // Urutan vendor per batch
  tracking_logs: TrackingLog[];
  stock: Stock[];
  stock_movements: StockMovement[];
  purchase_orders: PurchaseOrder[];
  retail_sales: RetailSale[];
  retur_produksi: ReturProduksi[];
  retur_online: ReturOnline[];
  _counters: Record<string, number>;
}

export interface Vendor {
  id: number;
  nama: string;
  jenis_default: string;   // default jenis pekerjaan
  kontak: string;
  aktif: boolean;
  created_at: string;
}

export interface SizeBreakdown {
  size: string;       // "S", "M", "L", "XL", "XXL", "30", dst (dinamis)
  jumlah: number;     // jumlah pcs untuk size ini
  cacat: number;      // total cacat terakumulasi selama produksi
}

export interface Batch {
  id: number;
  kode_batch: string;
  jenis_kain: string;
  jumlah_meter?: number;
  jumlah_pcs?: number;
  size_breakdown: SizeBreakdown[]; // breakdown per size (dinamis)
  status: string;                 // bahan-mentah | dalam-proses | gudang | reject
  current_step: number;           // step ke berapa yang sedang berjalan (0 = belum mulai)
  token: string;                  // SATU token persistent untuk seluruh batch
  route_selesai: boolean;
  catatan_route?: string;
  is_retur?: boolean;             // true jika ini SPK retur
  parent_batch_id?: number;       // batch asal yang cacatnya diretur
  created_at: string;
  updated_at: string;
}

export interface BatchStep {
  id: number;
  batch_id: number;
  step_order: number;             // 1, 2, 3, ...
  vendor_id: number;
  jenis_pekerjaan: string;        // bisa custom per step
  jumlah_barang: number;
  deadline?: string;
  catatan?: string;
  status: "menunggu" | "berjalan" | "selesai" | "reject";
  mulai_waktu?: string;
  terima_waktu?: string;    // saat vendor konfirmasi terima barang
  selesai_waktu?: string;
  qc_result?: "lolos" | "gagal";
  // Detail cacat per size (diisi saat QC gagal)
  defect_detail?: {
    size: string;
    jumlah_cacat: number;
    alasan: string;
    waktu: string;
  }[];
  total_cacat?: number;     // total pcs cacat di step ini
}

export interface TrackingLog {
  id: number;
  batch_id: number;
  step_id?: number;
  vendor_id?: number;
  aksi: string;
  keterangan?: string;
  waktu: string;
}

export interface Stock {
  id: number;
  kategori: string;
  stok_saat_ini: number;
  updated_at: string;
}

export interface StockMovement {
  id: number;
  tanggal: string;
  jenis: string;
  kategori: string;
  jumlah: number;
  keterangan?: string;
  referensi_id?: string;
  referensi_tipe?: string;
}

export interface PurchaseOrder {
  id: number;
  no_po: string;
  kategori: string;
  jumlah: number;
  tanggal_kirim: string;
  tanggal_po: string;
  status: string;
  catatan?: string;
}

export interface RetailSale {
  id: number;
  tanggal: string;
  kategori: string;
  jumlah: number;
  catatan?: string;
}

export interface ReturProduksi {
  id: number;
  batch_id: number;           // batch asal yang ada cacatnya
  step_id?: number;
  alasan: string;
  ke_berapa_kali: number;
  status: string;
  tanggal: string;
  spk_batch_id?: number;      // batch SPK retur yang dibuat (hasil buat-spk?retur=1)
  size_detail?: {             // detail per size yang diretur
    size: string;
    jumlah_retur: number;
  }[];
}

export interface ReturOnline {
  id: number;
  no_retur: string;
  po_id?: number;
  alasan: string;
  jumlah: number;
  kondisi: string;
  status: string;
  tanggal: string;
  catatan?: string;
}

function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function getInitialData(): DataStore {
  const now = new Date().toISOString();
  const today = now.split("T")[0];
  const tok1 = uuid(), tok2 = uuid(), tok3 = uuid();

  return {
    _counters: { vendors: 3, batches: 3, batch_steps: 5, tracking_logs: 3, stock: 8, stock_movements: 5, purchase_orders: 5, retail_sales: 6, retur_produksi: 0, retur_online: 0 },
    vendors: [
      { id: 1, nama: "Vendor A — Mitra Jaya", jenis_default: "Potong & Jahit", kontak: "081234567001", aktif: true, created_at: now },
      { id: 2, nama: "Vendor B — Laundry Prima", jenis_default: "Washing / Laundry", kontak: "081234567002", aktif: true, created_at: now },
      { id: 3, nama: "Vendor C — Finishing Mandiri", jenis_default: "Finishing, QC & Packing", kontak: "081234567003", aktif: true, created_at: now },
    ],
    batches: [
      { id: 1, kode_batch: "BATCH-2024-001", jenis_kain: "Denim Biru 12oz", jumlah_meter: 150, jumlah_pcs: 300, size_breakdown: [{ size: "L", jumlah: 150, cacat: 3 }, { size: "XL", jumlah: 150, cacat: 2 }], status: "dalam-proses", current_step: 2, token: tok1, route_selesai: false, created_at: now, updated_at: now },
      { id: 2, kode_batch: "BATCH-2024-002", jenis_kain: "Denim Hitam 14oz", jumlah_meter: 200, jumlah_pcs: 400, size_breakdown: [{ size: "L", jumlah: 200, cacat: 0 }, { size: "XL", jumlah: 200, cacat: 0 }], status: "dalam-proses", current_step: 3, token: tok2, route_selesai: false, created_at: now, updated_at: now },
      { id: 3, kode_batch: "BATCH-2024-003", jenis_kain: "Denim Abu 11oz", jumlah_meter: 100, jumlah_pcs: 200, size_breakdown: [{ size: "L", jumlah: 130, cacat: 0 }, { size: "XL", jumlah: 70, cacat: 0 }], status: "gudang", current_step: 3, token: tok3, route_selesai: true, created_at: now, updated_at: now },
    ],
    batch_steps: [
      // BATCH-001: step 1 selesai, step 2 berjalan, step 3 menunggu
      { id: 1, batch_id: 1, step_order: 1, vendor_id: 1, jenis_pekerjaan: "Potong & Jahit", jumlah_barang: 300, status: "selesai", mulai_waktu: now, selesai_waktu: now },
      { id: 2, batch_id: 1, step_order: 2, vendor_id: 2, jenis_pekerjaan: "Washing / Laundry", jumlah_barang: 300, status: "berjalan", mulai_waktu: now },
      { id: 3, batch_id: 1, step_order: 3, vendor_id: 3, jenis_pekerjaan: "Finishing, QC & Packing", jumlah_barang: 300, status: "menunggu" },
      // BATCH-002: 3 step, step 3 berjalan
      { id: 4, batch_id: 2, step_order: 1, vendor_id: 1, jenis_pekerjaan: "Potong & Jahit", jumlah_barang: 400, status: "selesai", mulai_waktu: now, selesai_waktu: now },
      { id: 5, batch_id: 2, step_order: 2, vendor_id: 2, jenis_pekerjaan: "Washing / Laundry", jumlah_barang: 400, status: "selesai", mulai_waktu: now, selesai_waktu: now },
      // batch 2 step 3 akan di-generate nanti
    ],
    tracking_logs: [
      { id: 1, batch_id: 1, vendor_id: 1, aksi: "selesai-step", keterangan: "Potong & Jahit selesai oleh Vendor A", waktu: now },
      { id: 2, batch_id: 1, vendor_id: 2, aksi: "mulai-step", keterangan: "Washing dimulai oleh Vendor B", waktu: now },
      { id: 3, batch_id: 2, vendor_id: 2, aksi: "selesai-step", keterangan: "Washing selesai", waktu: now },
    ],
    stock: [
      { id: 1, kategori: "Slim Fit", stok_saat_ini: 45, updated_at: now },
      { id: 2, kategori: "Regular Fit", stok_saat_ini: 60, updated_at: now },
      { id: 3, kategori: "Bootcut", stok_saat_ini: 30, updated_at: now },
      { id: 4, kategori: "Skinny", stok_saat_ini: 35, updated_at: now },
      { id: 5, kategori: "Wide Leg", stok_saat_ini: 30, updated_at: now },
      { id: 6, kategori: "Mom Jeans", stok_saat_ini: 0, updated_at: now },
      { id: 7, kategori: "Straight Cut", stok_saat_ini: 0, updated_at: now },
      { id: 8, kategori: "Cargo Jeans", stok_saat_ini: 0, updated_at: now },
    ],
    stock_movements: [
      { id: 1, tanggal: now, jenis: "masuk", kategori: "Slim Fit", jumlah: 45, keterangan: "Produksi BATCH-2024-003", referensi_tipe: "batch" },
      { id: 2, tanggal: now, jenis: "masuk", kategori: "Regular Fit", jumlah: 60, keterangan: "Produksi BATCH-2024-003", referensi_tipe: "batch" },
      { id: 3, tanggal: now, jenis: "masuk", kategori: "Bootcut", jumlah: 30, keterangan: "Produksi BATCH-2024-003", referensi_tipe: "batch" },
      { id: 4, tanggal: now, jenis: "masuk", kategori: "Skinny", jumlah: 35, keterangan: "Produksi BATCH-2024-003", referensi_tipe: "batch" },
      { id: 5, tanggal: now, jenis: "masuk", kategori: "Wide Leg", jumlah: 30, keterangan: "Produksi BATCH-2024-003", referensi_tipe: "batch" },
    ],
    purchase_orders: [
      { id: 1, no_po: "PO-2024-001", kategori: "Slim Fit", jumlah: 50, tanggal_kirim: "2024-09-20", tanggal_po: now, status: "terkirim" },
      { id: 2, no_po: "PO-2024-002", kategori: "Regular Fit", jumlah: 80, tanggal_kirim: "2024-09-22", tanggal_po: now, status: "terkirim" },
      { id: 3, no_po: "PO-2024-003", kategori: "Skinny", jumlah: 40, tanggal_kirim: "2024-09-25", tanggal_po: now, status: "siap-kirim" },
      { id: 4, no_po: "PO-2024-004", kategori: "Bootcut", jumlah: 35, tanggal_kirim: "2024-09-28", tanggal_po: now, status: "diproses" },
      { id: 5, no_po: "PO-2024-005", kategori: "Wide Leg", jumlah: 30, tanggal_kirim: "2024-10-01", tanggal_po: now, status: "baru" },
    ],
    retail_sales: [
      { id: 1, tanggal: today, kategori: "Slim Fit", jumlah: 12 },
      { id: 2, tanggal: today, kategori: "Regular Fit", jumlah: 18 },
      { id: 3, tanggal: today, kategori: "Mom Jeans", jumlah: 8 },
      { id: 4, tanggal: today, kategori: "Straight Cut", jumlah: 15 },
      { id: 5, tanggal: today, kategori: "Slim Fit", jumlah: 10 },
      { id: 6, tanggal: today, kategori: "Skinny", jumlah: 9 },
    ],
    retur_produksi: [
      { id: 1, batch_id: 1, step_id: 1, alasan: "Size L: 3 pcs (Jahitan lepas), Size XL: 2 pcs (Kotor)", ke_berapa_kali: 1, status: "menunggu-spk-retur", tanggal: now }
    ],
    retur_online: [],
  };
}

let _cache: DataStore | null = null;

export function readData(): DataStore {
  if (_cache) return _cache;
  try {
    if (fs.existsSync(DATA_PATH)) {
      _cache = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
      return _cache!;
    }
  } catch { /* ignore */ }
  _cache = getInitialData();
  writeData(_cache);
  return _cache;
}

export function writeData(data: DataStore): void {
  _cache = data;
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
}

export function nextId(data: DataStore, table: keyof DataStore["_counters"]): number {
  data._counters[table] = (data._counters[table] || 0) + 1;
  return data._counters[table];
}

export function genToken(): string { return uuid(); }

/** Ambil step yang sedang aktif untuk sebuah batch */
export function getCurrentStep(data: DataStore, batchId: number): BatchStep | undefined {
  const batch = data.batches.find(b => b.id === batchId);
  if (!batch) return undefined;
  return data.batch_steps.find(s => s.batch_id === batchId && s.step_order === batch.current_step && s.status === "berjalan");
}
