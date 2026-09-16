import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";

export async function GET() {
  return NextResponse.json(readData().purchase_orders.slice().reverse());
}

export async function POST(req: NextRequest) {
  const data = readData();
  const { kategori, jumlah, tanggalKirim, catatan } = await req.json();
  const now = new Date().toISOString();
  const id = nextId(data, "purchase_orders");
  const noPo = `PO-${new Date().getFullYear()}-${String(id).padStart(3, "0")}`;
  data.purchase_orders.push({ id, no_po: noPo, kategori, jumlah: Number(jumlah), tanggal_kirim: tanggalKirim, tanggal_po: now, status: "baru", catatan });
  const stk = data.stock.find(s => s.kategori === kategori);
  if (stk) { stk.stok_saat_ini = Math.max(0, stk.stok_saat_ini - Number(jumlah)); stk.updated_at = now; }
  data.stock_movements.push({ id: nextId(data, "stock_movements"), tanggal: now, jenis: "keluar", kategori, jumlah: Number(jumlah), keterangan: `PO Online ${noPo}`, referensi_id: String(id), referensi_tipe: "po" });
  writeData(data);
  return NextResponse.json({ id, noPo });
}

export async function PATCH(req: NextRequest) {
  const data = readData();
  const { id, status } = await req.json();
  const po = data.purchase_orders.find(p => p.id === Number(id));
  if (po) { po.status = status; writeData(data); }
  return NextResponse.json({ success: true });
}
