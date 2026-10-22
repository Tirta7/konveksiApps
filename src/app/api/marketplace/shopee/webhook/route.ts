export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { appUrl } from "@/lib/marketplace-api/common";
import { verifyShopeePush } from "@/lib/marketplace-api/shopee";
import { syncOrderIds } from "@/lib/marketplace-api/sync";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");

    const base = appUrl() || "https://vr.vocpos.id";
    const pushUrl = `${base}/api/marketplace/shopee/webhook`;

    // Verifikasi tanda tangan push Shopee
    const isValid = verifyShopeePush(pushUrl, rawBody, authHeader);
    if (!isValid) {
      return NextResponse.json({ error: "invalid_signature", message: "Tanda tangan push tidak valid" }, { status: 401 });
    }

    let payload: any = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 0, message: "ok" });
    }

    // Shopee push code: 3 = order status update, 4 = order tracking update
    const shopId = String(payload.shop_id || "");
    const orderSn = payload.data?.ordersn || payload.data?.order_sn;

    if (shopId && orderSn) {
      syncOrderIds("shopee", shopId, [String(orderSn)]).catch((err) => {
        console.error("[shopee-webhook] Error sync order:", err);
      });
    }

    return NextResponse.json({ error: 0, message: "success" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
