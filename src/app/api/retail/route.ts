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
    const data = readData();
    if (!(data as any).retail_sales) (data as any).retail_sales = [];
    const body = await req.json();
    const id = nextId(data, "retail_sales");
    const newSale = { id, ...body, tanggal: new Date().toISOString() };
    (data as any).retail_sales.push(newSale);
    
    // Potong stok siap_jual
    if (data.barcode_item) {
        let deducted = 0;
        for (let i = 0; i < data.barcode_item.length && deducted < (Number(body.jumlah) || 1); i++) {
            if (data.barcode_item[i].status === "siap_jual") {
                data.barcode_item[i].status = "terjual";
                deducted++;
            }
        }
    }
    
    writeData(data);
    return NextResponse.json(newSale);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
