export const dynamic = "force-dynamic";
﻿import { NextResponse } from "next/server";
// Pakai penyimpanan utama (sebelumnya file terpisah src/lib/data.json → data tidak ikut backup & tidak konsisten)
import { readData, writeData, nextId } from "@/lib/data-store";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data: any = readData();
    
    if (!Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid data format. Expected an array." }, { status: 400 });
    }

    if (!data.settlement_online) {
      data.settlement_online = [];
    }

    let addedCount = 0;
    let updatedCount = 0;

    for (const item of body) {
      const exists = data.settlement_online.find((r: any) => r.order_id === item.order_id);
      
      if (!exists) {
        data.settlement_online.push({
          id: nextId(data, "settlement_online"),
          order_id: item.order_id,
          jenis_transaksi: item.jenis_transaksi,
          pendapatan_kotor: Number(item.pendapatan_kotor) || 0,
          biaya_komisi: Number(item.biaya_komisi) || 0,
          biaya_afiliasi: Number(item.biaya_afiliasi) || 0,
          biaya_ongkir: Number(item.biaya_ongkir) || 0,
          biaya_lainnya: Number(item.biaya_lainnya) || 0,
          penyelesaian_pembayaran: Number(item.penyelesaian_pembayaran) || 0,
          tanggal_pembayaran: item.tanggal_pembayaran || new Date().toISOString()
        });
        addedCount++;
      } else {
        // Update if already exists
        exists.pendapatan_kotor = Number(item.pendapatan_kotor) || exists.pendapatan_kotor;
        exists.biaya_komisi = Number(item.biaya_komisi) || exists.biaya_komisi;
        exists.biaya_afiliasi = Number(item.biaya_afiliasi) || exists.biaya_afiliasi;
        exists.biaya_ongkir = Number(item.biaya_ongkir) || exists.biaya_ongkir;
        exists.biaya_lainnya = Number(item.biaya_lainnya) || exists.biaya_lainnya;
        exists.penyelesaian_pembayaran = Number(item.penyelesaian_pembayaran) || exists.penyelesaian_pembayaran;
        exists.tanggal_pembayaran = item.tanggal_pembayaran || exists.tanggal_pembayaran;
        updatedCount++;
      }
    }

    writeData(data);
    return NextResponse.json({ success: true, added: addedCount, updated: updatedCount });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to save settlement data" }, { status: 500 });
  }
}

export async function GET() {
  const data: any = readData();
  return NextResponse.json({ settlement_online: data.settlement_online || [] });
}
