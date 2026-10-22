export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { makeState } from "@/lib/marketplace-api/common";
import { tiktokAuthorizeUrl, tiktokConfig } from "@/lib/marketplace-api/tiktok";

export async function GET() {
  try {
    const conf = tiktokConfig();
    if (!conf.ready) {
      return NextResponse.json({ error: "Kunci API TikTok Shop belum disetel di .env" }, { status: 400 });
    }
    const state = makeState("tiktok");
    const url = tiktokAuthorizeUrl(state);
    return NextResponse.json({ url });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
