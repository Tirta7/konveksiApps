export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { syncMarketplaceReviews } from "@/lib/marketplace-api/sync";

export async function POST() {
  try {
    const res = await syncMarketplaceReviews();
    return NextResponse.json(res);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Gagal sinkron ulasan marketplace" }, { status: 500 });
  }
}

