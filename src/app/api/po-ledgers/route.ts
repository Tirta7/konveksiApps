export const dynamic = "force-dynamic";
﻿import { NextResponse } from "next/server";
import { readData } from "@/lib/data-store";

export async function GET() {
  const data = readData();
  return NextResponse.json({
    poLedgers: data.po_ledgers || [],
    vendors: data.vendors || []
  });
}
