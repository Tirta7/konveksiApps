export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";
import { groupOrders, getOrder } from "@/lib/marketplace";
import { cancelBarcodeSale } from "@/lib/barcode-sales";

/** Perbaiki data lama yang tersimpan sebagai {"0":{...},"1":{...}} (bug impor lama). */
function normalize(data: any) {
  const list = data.penjualan_online || [];
  if (!list.some((x: any) => x && x["0"] && typeof x["0"] === "object")) return false;
  const out: any[] = [];
  for (const x of list) {
    if (x && x["0"] && typeof x["0"] === "object") {
      for (const [k, v] of Object.entries(x)) if (/^\d+$/.test(k) && v && typeof v === "object") out.push({ ...(v as any), tanggal_diimpor: x.tanggal });
    } else out.push(x);
  }
  data.penjualan_online = [];
  for (const r of out) data.penjualan_online.push({ ...r, id: nextId(data, "penjualan_online") });
  return true;
}

const lineKey = (r: any) => `${String(r.order_id || "").trim()}|${r.seller_sku || ""}|${r.variation || ""}|${r.product_name || ""}`;

/**
 * Buang baris pesanan ganda (CSV yang sama terupload lebih dari sekali sebelum ada cek duplikat).
 * Ganda = Order ID + SKU + variasi + nama produk sama → yang paling awal dipertahankan.
 * Tanpa ini jumlah pcs per Order ID & omzet terhitung dobel.
 */
function dedupe(data: any) {
  const list = data.penjualan_online || [];
  const seen = new Set<string>();
  const out: any[] = [];
  for (const r of [...list].sort((a: any, b: any) => Number(a.id || 0) - Number(b.id || 0))) {
    const k = lineKey(r);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  if (out.length === list.length) return false;
  data.penjualan_online = out;
  return true;
}

// GET                → baris pesanan (per produk) + info scan per Order ID
// GET ?grouped=1     → daftar pesanan per Order ID
// GET ?order_id=XXX  → detail 1 pesanan (pembeli, alamat, resi, produk, barcode yang dikirim, retur)
export async function GET(req: NextRequest) {
  try {
    const data = readData();
    const n1 = normalize(data);
    const n2 = dedupe(data);
    if (n1 || n2) writeData(data);
    const sp = new URL(req.url).searchParams;
    const oid = sp.get("order_id");
    if (oid) {
      const o = getOrder(data, oid);
      return o ? NextResponse.json(o) : NextResponse.json({ error: `Order ID ${oid} tidak ditemukan di data pesanan CSV` }, { status: 404 });
    }
    const orders = groupOrders(data);
    if (sp.get("grouped")) return NextResponse.json(Object.values(orders));
    const lines = ((data as any).penjualan_online || []).map((r: any) => {
      const o = orders[String(r.order_id || "").trim()];
      return { ...r, marketplace: r.marketplace || o?.marketplace, status_kemas: o?.status_kemas || "Belum Discan", scanned_qty: o?.scanned_qty || 0, order_qty: o?.total_qty || r.quantity, barcodes: o?.barcodes || [], returs: o?.returs || [] };
    });
    return NextResponse.json(lines);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST [ ...baris CSV ] → impor pesanan, baris yang sudah ada (Order ID + SKU + variasi sama) dilewati
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rows: any[] = Array.isArray(body) ? body : [body];
    const data: any = readData();
    normalize(data);
    dedupe(data);
    if (!data.penjualan_online) data.penjualan_online = [];
    const existing = new Set(data.penjualan_online.map(lineKey));
    const now = new Date().toISOString();
    let added = 0, skipped = 0;
    for (const r of rows) {
      if (!r || !String(r.order_id || "").trim()) { skipped++; continue; }
      const k = lineKey(r);
      if (existing.has(k)) { skipped++; continue; }
      existing.add(k);
      data.penjualan_online.push({ ...r, order_id: String(r.order_id).trim(), id: nextId(data, "penjualan_online"), tanggal_diimpor: now });
      added++;
    }
    // Catatan: stok per pcs dipotong lewat scan barcode (/api/penjualan-barcode) yang ditautkan ke Order ID,
    // bukan menandai barcode secara acak — agar pcs yang terjual tercatat tepat.
    writeData(data);
    return NextResponse.json({ success: true, added, skipped });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE ?order_id=XXX → hapus 1 pesanan dari ERP
// DELETE ?action=clear_sandbox → bersihkan seluruh pesanan uji coba (sandbox / local_main.id)
export async function DELETE(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const isClearSandbox = sp.get("action") === "clear_sandbox" || sp.get("clear_sandbox") === "1";

    const data: any = readData();

    if (isClearSandbox) {
      const testOrderIds = new Set<string>();
      (data.penjualan_online || []).forEach((r: any) => {
        const isTest = r.buyer_username === "local_main.id" ||
                       String(r.buyer_username || "").includes("sandbox") ||
                       String(r.marketplace || "").toLowerCase().includes("sandbox") ||
                       /^261105[A-Z0-9]+$/i.test(String(r.order_id || ""));
        if (isTest) testOrderIds.add(String(r.order_id || "").trim());
      });

      // Batalkan barcode jika ada yang discan untuk test order
      const sales = (data.penjualan_barcode || []).filter((s: any) => testOrderIds.has(String(s.order_id || "").trim()));
      for (const sale of sales) {
        try { cancelBarcodeSale(data, sale.id); } catch {}
      }

      data.penjualan_online = (data.penjualan_online || []).filter((r: any) => !testOrderIds.has(String(r.order_id || "").trim()));
      if (Array.isArray(data.settlement_online)) {
        data.settlement_online = data.settlement_online.filter((s: any) => !testOrderIds.has(String(s.order_id || "").trim()));
      }
      writeData(data);
      return NextResponse.json({ success: true, deleted: testOrderIds.size, cleared_orders: Array.from(testOrderIds) });
    }

    const oid = sp.get("order_id");
    if (!oid) return NextResponse.json({ error: "order_id atau action=clear_sandbox wajib diisi" }, { status: 400 });

    // 1. Batalkan transaksi barcode yang tertaut ke order ini (stok kembali ke gudang)
    const sales = (data.penjualan_barcode || []).filter((s: any) => String(s.order_id || "").trim() === oid.trim());
    for (const sale of sales) {
      try { cancelBarcodeSale(data, sale.id); } catch {}
    }

    // 2. Hapus baris pesanan dari penjualan_online
    const initialLen = (data.penjualan_online || []).length;
    data.penjualan_online = (data.penjualan_online || []).filter((r: any) => String(r.order_id || "").trim() !== oid.trim());
    const deletedCount = initialLen - data.penjualan_online.length;

    writeData(data);
    return NextResponse.json({ success: true, deleted: deletedCount, order_id: oid });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
