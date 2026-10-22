export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { verifyTiktokWebhook } from "@/lib/marketplace-api/tiktok";
import { syncOrderIds } from "@/lib/marketplace-api/sync";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");

    // Verifikasi tanda tangan webhook TikTok Shop
    const isValid = verifyTiktokWebhook(rawBody, authHeader);
    if (!isValid) {
      return NextResponse.json({ code: 40001, message: "Invalid webhook signature" }, { status: 401 });
    }

    let payload: any = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ code: 0, message: "success" });
    }

    // TikTok Shop webhook event
    // Event type: 1 = ORDER_STATUS_CHANGE, 2 = PACKAGE_UPDATE, etc.
    const shopId = String(payload.shop_id || payload.seller_id || "");
    const orderId = payload.data?.order_id || payload.data?.id;

    if (shopId && orderId) {
      // Jalankan sinkron order secara background tanpa menahan respon webhook
      syncOrderIds("tiktok", shopId, [String(orderId)]).catch((err) => {
        console.error("[tiktok-webhook] Error sync order:", err);
      });
    }

    return NextResponse.json({ code: 0, message: "success" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
