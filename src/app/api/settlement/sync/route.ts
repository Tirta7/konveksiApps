export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { syncMarketplaceSettlements } from "@/lib/marketplace-api/sync";

export async function POST() {
  try {
    const res = await syncMarketplaceSettlements();
    return NextResponse.json(res);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Gagal sinkron settlement" }, { status: 500 });
  }
}
