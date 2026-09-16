import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";

export async function GET() {
  const data = readData();
  return NextResponse.json({ stock: data.stock, movements: data.stock_movements.slice().reverse().slice(0, 50) });
}

export async function POST(req: NextRequest) {
  const data = readData();
  const { kategori, jumlah, jenis, keterangan, referensiId, referensiTipe } = await req.json();
  const now = new Date().toISOString();
  const stk = data.stock.find(s => s.kategori === kategori);
  if (stk) {
    stk.stok_saat_ini = jenis === "masuk" ? stk.stok_saat_ini + Number(jumlah) : Math.max(0, stk.stok_saat_ini - Number(jumlah));
    stk.updated_at = now;
  }
  data.stock_movements.push({ id: nextId(data, "stock_movements"), tanggal: now, jenis, kategori, jumlah: Number(jumlah), keterangan, referensi_id: referensiId, referensi_tipe: referensiTipe });
  writeData(data);
  return NextResponse.json({ success: true });
}
