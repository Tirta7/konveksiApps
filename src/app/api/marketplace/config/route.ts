export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { marketplaceConfigStatus } from "@/lib/marketplace-api/sync";
import { appUrl } from "@/lib/marketplace-api/common";

export async function GET() {
  try {
    const base = appUrl() || "https://vr.vocpos.id";
    const status = marketplaceConfigStatus();
    return NextResponse.json({
      ...status,
      urls: {
        app_url: base,
        tiktok_redirect: `${base}/api/marketplace/tiktok/callback`,
        tiktok_webhook: `${base}/api/marketplace/tiktok/webhook`,
        shopee_redirect: `${base}/api/marketplace/shopee/callback`,
        shopee_webhook: `${base}/api/marketplace/shopee/webhook`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
