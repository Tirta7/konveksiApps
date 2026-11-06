export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { readData, writeData } from "@/lib/data-store";
import { getShops } from "@/lib/marketplace-api/common";
import { importProductsFromMarketplace, pushWarehouseStockToMarketplace } from "@/lib/marketplace-api/stock-sync";

// GET: Status koneksi dan mapping produk marketplace
export async function GET() {
  try {
    const data = readData();
    const shops = getShops(data).map((s) => ({
      key: s.key,
      platform: s.platform,
      shop_name: s.shop_name,
      label: s.label,
      aktif: s.aktif,
      connected_at: s.connected_at,
    }));

    const barangList = data.data_barang || [];
    const mappedCount = barangList.filter((b: any) => (b.marketplace_mappings || []).length > 0).length;

    return NextResponse.json({
      shops,
      total_barang: barangList.length,
      mapped_barang: mappedCount,
      last_stock_push: (data as any)._last_marketplace_stock_push || null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Jalankan aksi tarik produk / kirim stok
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "pull_products");
    const data = readData();

    if (action === "pull_products") {
      const result = await importProductsFromMarketplace(data);
      if (result.success) {
        writeData(data);
      }
      return NextResponse.json(result);
    }

    if (action === "push_stock") {
      const result = await pushWarehouseStockToMarketplace(data, body.barang_id ? Number(body.barang_id) : undefined);
      if (result.success) {
        writeData(data);
      }
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: `Aksi ${action} tidak dikenal` }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
