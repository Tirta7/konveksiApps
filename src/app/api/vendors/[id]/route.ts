import { NextResponse } from "next/server";
import { readData } from "@/lib/data-store";

export async function GET(req: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  const data = readData();
  const params = await Promise.resolve(context.params);
  const vendor = (data.vendors || []).find((v: any) => String(v.id) === String(params.id));
  if (!vendor) return NextResponse.json({ error: "Vendor tidak ditemukan" }, { status: 404 });
  return NextResponse.json(vendor);
}