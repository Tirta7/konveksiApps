export const dynamic = "force-dynamic";
﻿import { NextResponse } from "next/server";
import { readData } from "@/lib/data-store";

export async function GET() {
  try {
    const data = readData();
    return NextResponse.json(data.retur_produksi || []);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
