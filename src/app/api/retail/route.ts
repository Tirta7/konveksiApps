export const dynamic = "force-dynamic";
﻿import { NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";

export async function GET() {
  try {
    const data = readData();
    return NextResponse.json((data as any).retail_sales || []);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = readData();
    if (!(data as any).retail_sales) (data as any).retail_sales = [];
    const id = nextId(data, "retail_sales");
    const newSale = { id, ...body, tanggal: new Date().toISOString() };
    (data as any).retail_sales.push(newSale);
    
    // Catatan: stok per pcs dipotong lewat scan barcode (/api/penjualan-barcode),
    // bukan menandai barcode secara acak — agar pcs yang terjual tercatat tepat.
    
    writeData(data);
    return NextResponse.json(newSale);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
