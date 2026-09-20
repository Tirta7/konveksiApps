import fs from "fs";
import path from "path";
import { broadcast } from "./sse";
import { getCached, setCache, publishChange, isRedisReady } from "./redis";

const DATA_PATH = path.join(process.cwd(), "konveksi-data.json");
const TEMP_PATH = DATA_PATH + ".tmp";

export interface DataStore {
  vendors: any[];
  tukang_potong: any[];
  pemotongan_kain: any[];
  data_kain: any[];
  hutang: any[];
  batches: any[];
  bundles: any[];
  spk: any[];
  spk_progres: any[];
  gaji_cmt: any[];
  tracking_logs: any[];
  stock: any[];
  stock_movements: any[];
  purchase_orders: any[];
  retail_sales: any[];
  retur_produksi: any[];
  retur_online: any[];
  kategori_produk: any[];
  data_barang: any[];
  data_supplier: any[];
  po_produksi: any[];
  po_pengambilan: any[];
  barcode_item: any[];
  cmt_requests: any[];
  cmt_progres: any[];
  vendor_types: any[];
  produksi_transfers: any[];
  po_ledgers: any[];
  pipeline_stages: any[];
  po_pipeline: any[];
  _counters: Record<string, number>;
}

function getInitialData(): DataStore {
  return {
    vendors: [], tukang_potong: [], pemotongan_kain: [], data_kain: [], hutang: [], batches: [], bundles: [], spk: [], spk_progres: [], gaji_cmt: [],
    tracking_logs: [], stock: [], stock_movements: [], purchase_orders: [], retail_sales: [],
    retur_produksi: [], retur_online: [], kategori_produk: [], data_barang: [], data_supplier: [],
    po_produksi: [], po_pengambilan: [], barcode_item: [], cmt_requests: [], cmt_progres: [], vendor_types: [], produksi_transfers: [], po_ledgers: [],
    pipeline_stages: [], po_pipeline: [],
    _counters: {}
  };
}


//  Write Queue (Mutex) 
const g = global as any;
if (!g.__writeQueue) g.__writeQueue = Promise.resolve();

function enqueueWrite(fn: () => void): void {
  g.__writeQueue = g.__writeQueue.then(() => {
    try { fn(); } catch (e) { console.error("[data-store] Write error:", e); }
  });
}

//  Atomic File Write 
function atomicWriteFile(content: string): void {
  fs.writeFileSync(TEMP_PATH, content, "utf-8");
  fs.renameSync(TEMP_PATH, DATA_PATH);
}

//  In-Memory Cache 
// Read order: RAM (< 0.1ms)  Redis (1ms)  File (5-8ms)
// Cleared when writeData() is called from another process via Redis Pub/Sub.
if (!g.__memCache) g.__memCache = null;
const getMemCache = (): DataStore | null => g.__memCache;
const setMemCache = (d: DataStore) => { g.__memCache = d; };
const clearMemCache = () => { g.__memCache = null; };

//  Read 
function readFromFile(): DataStore {
  try {
    if (fs.existsSync(DATA_PATH)) {
      return JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
    }
  } catch (err) {
    console.error("[data-store] Error reading file:", err);
    // Try backup if main file is corrupt
    const backupPath = DATA_PATH + ".bak";
    if (fs.existsSync(backupPath)) {
      try {
        console.log("[data-store] Restoring from backup...");
        return JSON.parse(fs.readFileSync(backupPath, "utf-8"));
      } catch {}
    }
  }
  const init = getInitialData();
  atomicWriteFile(JSON.stringify(init, null, 2));
  return init;
}

/**
 * Read data  in-memory cache first (fastest), then Redis, then file.
 */
export function readData(): DataStore {
  const mem = getMemCache();
  if (mem) return mem;          //  ~0.1ms from RAM
  const data = readFromFile();  //  ~5ms from disk
  setMemCache(data);
  return data;
}

/**
 * Async version  tries Redis cache first (much faster), fallback to file.
 */
export async function readDataAsync(): Promise<DataStore> {
  if (isRedisReady()) {
    try {
      const cached = await getCached();
      if (cached) return JSON.parse(cached);
    } catch {}
  }
  const data = readFromFile();
  setCache(JSON.stringify(data)).catch(() => {});
  return data;
}

/**
 * Write data safely:
 * 1. Queued    concurrent writes serialized, never overlapping
 * 2. Atomic    temprename, no partial writes
 * 3. Backup    keeps .bak copy before each write
 * 4. MemCache  update in-memory instantly
 * 5. Redis     update distributed cache
 * 6. Broadcast  push SSE to all open browsers
 */
export function writeData(data: DataStore): void {
  const jsonStr = JSON.stringify(data, null, 2);

  // Update in-memory cache immediately (so reads after write are instant)
  setMemCache(data);

  enqueueWrite(() => {
    // Backup previous version
    try {
      if (fs.existsSync(DATA_PATH)) fs.copyFileSync(DATA_PATH, DATA_PATH + ".bak");
    } catch {}

    // Atomic write to disk
    atomicWriteFile(jsonStr);

    // Update Redis cache
    setCache(jsonStr).catch(() => {});

    // Notify other processes
    publishChange().catch(() => {});

    // Instant SSE broadcast to all open browsers
    try { broadcast("dataChanged"); } catch {}
  });
}

export function nextId(data: DataStore, table: keyof DataStore["_counters"]): number {
  data._counters[table] = (data._counters[table] || 0) + 1;
  return data._counters[table];
}
