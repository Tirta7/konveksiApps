export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { saveShop } from "@/lib/marketplace-api/common";
import { shopeeExchangeCode, shopeeShopInfo } from "@/lib/marketplace-api/shopee";
import { readData, writeData } from "@/lib/data-store";
import { syncShop } from "@/lib/marketplace-api/sync";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = "/pengaturan";
  url.searchParams.set("tab", "marketplace");

  const sp = req.nextUrl.searchParams;
  const code = sp.get("code");
  const shopId = sp.get("shop_id");

  if (!code || !shopId) {
    url.searchParams.set("error", "Kode atau shop_id dari Shopee tidak ditemukan dalam callback");
    return NextResponse.redirect(url);
  }

  try {
    const tokenData = await shopeeExchangeCode(code, shopId);
    const accessToken = tokenData.access_token;
    const accessExpire = Date.now() + Number(tokenData.expire_in || 14400) * 1000; // 4 jam
    const refreshToken = tokenData.refresh_token;
    const refreshExpire = Date.now() + 30 * 86400_000; // 30 hari

    let shopName = `Shopee Shop ${shopId}`;
    let region = "ID";
    try {
      const info = await shopeeShopInfo({ shop_id: shopId, access_token: accessToken });
      if (info.shop_name) shopName = info.shop_name;
      if (info.region) region = info.region;
    } catch (e: any) {
      console.warn("[shopee-callback] Gagal mengambil info detail toko:", e?.message);
    }

    const data: any = readData();
    const shopRec = saveShop(data, {
      platform: "shopee",
      shop_id: String(shopId),
      shop_name: shopName,
      label: "Shopee",
      region,
      access_token: accessToken,
      access_expire: accessExpire,
      refresh_token: refreshToken,
      refresh_expire: refreshExpire,
    });
    writeData(data);

    // Jalankan sinkron awal 3 hari terakhir
    syncShop(shopRec.key, { days: 3 }).catch(() => {});

    url.searchParams.set("sukses", "shopee");
    return NextResponse.redirect(url);
  } catch (e: any) {
    url.searchParams.set("error", `Gagal menghubungkan Shopee: ${e.message}`);
    return NextResponse.redirect(url);
  }
}
