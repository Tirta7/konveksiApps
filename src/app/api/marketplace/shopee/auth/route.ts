export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { appUrl } from "@/lib/marketplace-api/common";
import { shopeeAuthorizeUrl, shopeeConfig } from "@/lib/marketplace-api/shopee";

export async function GET() {
  try {
    const conf = shopeeConfig();
    if (!conf.ready) {
      return NextResponse.json({ error: "Kunci API Shopee belum disetel di .env (SHOPEE_PARTNER_ID / SHOPEE_PARTNER_KEY)" }, { status: 400 });
    }
    const base = appUrl() || "https://vr.vocpos.id";
    const redirectUrl = `${base}/api/marketplace/shopee/callback`;
    const url = shopeeAuthorizeUrl(redirectUrl);
    return NextResponse.json({ url });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
