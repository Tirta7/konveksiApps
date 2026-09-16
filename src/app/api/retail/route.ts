import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";

export async function GET() {
  const data = readData();
  const today = new Date().toISOString().split("T")[0];
  const todayTotal = data.retail_sales.filter(s => s.tanggal === today).reduce((sum, s) => sum + s.jumlah, 0);
  return NextResponse.json({ list: data.retail_sales.slice().reverse(), todayTotal });
}

export async function POST(req: NextRequest) {
  const data = readData();
  const { kategori, jumlah, tanggal, catatan } = await req.json();
  const now = new Date().toISOString();
  const tgl = tanggal || now.split("T")[0];
  data.retail_sales.push({ id: nextId(data, "retail_sales"), tanggal: tgl, kategori, jumlah: Number(jumlah), catatan });
  const stk = data.stock.find(s => s.kategori === kategori);
  if (stk) { stk.stok_saat_ini = Math.max(0, stk.stok_saat_ini - Number(jumlah)); stk.updated_at = now; }
  data.stock_movements.push({ id: nextId(data, "stock_movements"), tanggal: now, jenis: "keluar", kategori, jumlah: Number(jumlah), keterangan: "Penjualan retail offline", referensi_tipe: "retail" });
  writeData(data);
  return NextResponse.json({ success: true });
}
