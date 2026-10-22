export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { syncShop, syncAllShops } from "@/lib/marketplace-api/sync";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { key, days, platform } = body;

    if (key) {
      const result = await syncShop(key, { days: days ? Number(days) : undefined });
      return NextResponse.json({ success: true, result });
    }

    const results = await syncAllShops({ days: days ? Number(days) : undefined, platform });
    return NextResponse.json({ success: true, results });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
