export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { readData, writeData } from "@/lib/data-store";
import { syncMarketplaceCategories } from "@/lib/marketplace-api/category-sync";

export async function POST() {
  try {
    const data = readData();
    const result = await syncMarketplaceCategories(data);
    if (result.success) {
      writeData(data);
    }
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
