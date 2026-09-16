import { NextRequest, NextResponse } from "next/server";
import { readData } from "@/lib/data-store";

export async function GET(req: NextRequest) {
  const data = readData();
  const { searchParams } = new URL(req.url);
  const periode = searchParams.get("periode") || "minggu";
  const days = periode === "bulan" ? 30 : 7;
  const sinceDate = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString().split("T")[0];

  const map: Record<string, { kategori: string; total_po: number; total_retail: number; total: number }> = {};

  data.purchase_orders
    .filter(p => p.tanggal_po.split("T")[0] >= sinceDate)
    .forEach(p => {
      if (!map[p.kategori]) map[p.kategori] = { kategori: p.kategori, total_po: 0, total_retail: 0, total: 0 };
      map[p.kategori].total_po += p.jumlah;
      map[p.kategori].total += p.jumlah;
    });

  data.retail_sales
    .filter(s => s.tanggal >= sinceDate)
    .forEach(s => {
      if (!map[s.kategori]) map[s.kategori] = { kategori: s.kategori, total_po: 0, total_retail: 0, total: 0 };
      map[s.kategori].total_retail += s.jumlah;
      map[s.kategori].total += s.jumlah;
    });

  return NextResponse.json(Object.values(map).sort((a, b) => b.total - a.total));
}
