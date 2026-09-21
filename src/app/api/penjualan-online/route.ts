export const dynamic = "force-dynamic";
﻿import { NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";

export async function GET() {
  try {
    const data = readData();
    return NextResponse.json((data as any).penjualan_online || []);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const data = readData();
    if (!(data as any).penjualan_online) (data as any).penjualan_online = [];
    const body = await req.json();
    const id = nextId(data, "penjualan_online");
    const newSale = { id, ...body, tanggal: new Date().toISOString(), status: "Packing" };
    (data as any).penjualan_online.push(newSale);
    
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
