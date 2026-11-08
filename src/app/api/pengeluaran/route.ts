export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";

export const KATEGORI_OPEX = [
  "Iklan & Ads Marketplace (Shopee/TikTok Ads)",
  "Plastik, Polymailer & Lakban Packing",
  "Listrik, Air & Internet Workshop",
  "Gaji Admin, Gudang & Operasional",
  "Solar / Gas Boiler & Bahan Cuci",
  "Servis & Sparepart Mesin Jahit",
  "Ekspedisi & Kargo Bahan",
  "Biaya Operasional Lainnya",
];

export async function GET() {
  try {
    const data: any = readData();
    const list = Array.isArray(data.biaya_operasional) ? data.biaya_operasional : [];
    const sorted = [...list].sort(
      (a: any, b: any) => new Date(b.tanggal || b.createdAt || 0).getTime() - new Date(a.tanggal || a.createdAt || 0).getTime()
    );
    return NextResponse.json(sorted);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data: any = readData();
    if (!Array.isArray(data.biaya_operasional)) data.biaya_operasional = [];

    const nominal = Number(String(body.nominal ?? body.jumlah ?? 0).replace(/[^0-9.-]/g, ""));
    if (!nominal || nominal <= 0) {
      return NextResponse.json({ error: "Nominal pengeluaran harus lebih dari 0" }, { status: 400 });
    }

    const kategori = String(body.kategori || "Biaya Operasional Lainnya").trim();
    const keterangan = String(body.keterangan || "").trim();
    const metode = String(body.metode || "Transfer / Kas").trim();
    const toko = String(body.toko || "Semua Toko / Umum").trim();
    const tanggal = body.tanggal || new Date().toISOString().split("T")[0];

    const item = {
      id: nextId(data, "biaya_operasional" as any),
      tanggal,
      kategori,
      keterangan: keterangan || kategori,
      nominal,
      metode,
      toko,
      createdAt: new Date().toISOString(),
    };

    data.biaya_operasional.push(item);
    writeData(data);
    return NextResponse.json({ success: true, item });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const id = Number(sp.get("id"));
    if (!id) return NextResponse.json({ error: "ID wajib diisi" }, { status: 400 });

    const data: any = readData();
    if (!Array.isArray(data.biaya_operasional)) data.biaya_operasional = [];
    const idx = data.biaya_operasional.findIndex((x: any) => Number(x.id) === id);
    if (idx === -1) return NextResponse.json({ error: "Data tidak ditemukan" }, { status: 404 });

    data.biaya_operasional.splice(idx, 1);
    writeData(data);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
