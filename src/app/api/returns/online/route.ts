import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";

export async function GET() {
  const data = readData();
  const list = data.retur_online.map(r => ({ ...r, no_po: data.purchase_orders.find(p => p.id === r.po_id)?.no_po }));
  return NextResponse.json(list.reverse());
}

export async function POST(req: NextRequest) {
  const data = readData();
  const { poId, alasan, jumlah, kondisi, catatan } = await req.json();
  const now = new Date().toISOString();
  const id = nextId(data, "retur_online");
  const noRetur = `RTR-${new Date().getFullYear()}-${String(id).padStart(3, "0")}`;
  const status = kondisi === "bisa-dijual" ? "masuk-gudang" : "ditolak";
  data.retur_online.push({ id, no_retur: noRetur, po_id: poId ? Number(poId) : undefined, alasan, jumlah: Number(jumlah), kondisi, status, tanggal: now, catatan });

  if (kondisi === "bisa-dijual" && poId) {
    const po = data.purchase_orders.find(p => p.id === Number(poId));
    if (po) {
      const stk = data.stock.find(s => s.kategori === po.kategori);
      if (stk) { stk.stok_saat_ini += Number(jumlah); stk.updated_at = now; }
      data.stock_movements.push({ id: nextId(data, "stock_movements"), tanggal: now, jenis: "masuk", kategori: po.kategori, jumlah: Number(jumlah), keterangan: `Retur Online ${noRetur}`, referensi_id: noRetur, referensi_tipe: "retur" });
    }
  }
  writeData(data);
  return NextResponse.json({ success: true, noRetur });
}
