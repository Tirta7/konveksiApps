export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { checkState, saveShop } from "@/lib/marketplace-api/common";
import { tiktokExchangeCode, tiktokAuthorizedShops } from "@/lib/marketplace-api/tiktok";
import { readData, writeData } from "@/lib/data-store";
import { syncShop } from "@/lib/marketplace-api/sync";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = "/pengaturan";
  url.searchParams.set("tab", "marketplace");

  const sp = req.nextUrl.searchParams;
  const code = sp.get("code") || sp.get("auth_code");
  const state = sp.get("state");

  if (!code) {
    url.searchParams.set("error", "Kode otorisasi dari TikTok Shop tidak ditemukan");
    return NextResponse.redirect(url);
  }

  if (!checkState(state, "tiktok")) {
    url.searchParams.set("error", "Sesi otorisasi TikTok Shop tidak valid atau sudah kedaluwarsa. Silakan ulangi.");
    return NextResponse.redirect(url);
  }

  try {
    const tokenData = await tiktokExchangeCode(code);
    const accessToken = tokenData.access_token;
    const accessExpire = Date.now() + Number(tokenData.access_token_expire_in || 86400) * 1000;
    const refreshToken = tokenData.refresh_token;
    const refreshExpire = Date.now() + Number(tokenData.refresh_token_expire_in || 2592000) * 1000;
    const openId = tokenData.open_id || "";
    const sellerName = tokenData.seller_name || "TikTok Seller";

    const shops = await tiktokAuthorizedShops(accessToken);
    const data: any = readData();

    if (!shops || shops.length === 0) {
      // Fallback jika daftar toko belum muncul dari API
      const shopRec = saveShop(data, {
        platform: "tiktok",
        shop_id: openId || "default",
        shop_name: sellerName,
        label: "TikTok Shop",
        open_id: openId,
        access_token: accessToken,
        access_expire: accessExpire,
        refresh_token: refreshToken,
        refresh_expire: refreshExpire,
      });
      writeData(data);
      syncShop(shopRec.key, { days: 3 }).catch(() => {});
    } else {
      for (const s of shops) {
        const shopId = String(s.id || s.code || openId);
        const shopName = s.name || sellerName;
        // Jika toko memiliki indikasi Tokopedia, beri label Tokopedia
        const isTokopedia = /tokopedia/i.test(s.name || "") || /tokopedia/i.test(s.type || "");
        const shopRec = saveShop(data, {
          platform: "tiktok",
          shop_id: shopId,
          shop_name: shopName,
          label: isTokopedia ? "Tokopedia" : "TikTok Shop",
          region: s.region,
          shop_cipher: s.cipher,
          open_id: openId,
          access_token: accessToken,
          access_expire: accessExpire,
          refresh_token: refreshToken,
          refresh_expire: refreshExpire,
        });
        writeData(data);
        syncShop(shopRec.key, { days: 3 }).catch(() => {});
      }
    }

    url.searchParams.set("sukses", "tiktok");
    return NextResponse.redirect(url);
  } catch (e: any) {
    url.searchParams.set("error", `Gagal menghubungkan TikTok Shop: ${e.message}`);
    return NextResponse.redirect(url);
  }
}
