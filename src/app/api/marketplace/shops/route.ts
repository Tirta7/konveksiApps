export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { readData, writeData } from "@/lib/data-store";
import { getShops, publicShop, findShop } from "@/lib/marketplace-api/common";

export async function GET() {
  try {
    const data: any = readData();
    const shops = getShops(data).map(publicShop);
    return NextResponse.json(shops);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { key, aktif, label } = body;
    if (!key) return NextResponse.json({ error: "Key toko wajib diisi" }, { status: 400 });

    const data: any = readData();
    const shop = findShop(data, key);
    if (!shop) return NextResponse.json({ error: "Toko tidak ditemukan" }, { status: 404 });

    if (aktif !== undefined) shop.aktif = !!aktif;
    if (label && typeof label === "string") shop.label = label.trim();

    writeData(data);
    return NextResponse.json({ success: true, shop: publicShop(shop) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const key = sp.get("key");
    if (!key) return NextResponse.json({ error: "Key toko wajib diisi" }, { status: 400 });

    const data: any = readData();
    const list = getShops(data);
    const idx = list.findIndex((s) => s.key === key);
    if (idx === -1) return NextResponse.json({ error: "Toko tidak ditemukan" }, { status: 404 });

    const removed = list.splice(idx, 1)[0];
    writeData(data);
    return NextResponse.json({ success: true, message: `Toko ${removed.shop_name || key} berhasil dihapus` });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
