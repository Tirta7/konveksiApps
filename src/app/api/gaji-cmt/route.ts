import { NextRequest, NextResponse } from "next/server";
import { readData } from "@/lib/data-store";

export async function GET(req: NextRequest) {
  try {
    const data = readData();
    const { searchParams } = new URL(req.url);
    const cmtId = searchParams.get("cmtId");

    let list = data.gaji_cmt || [];
    if (cmtId) {
      list = list.filter((g: any) => g.cmtId === Number(cmtId));
    }

    return NextResponse.json(list.slice().reverse());
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
