import { NextRequest, NextResponse } from "next/server";
import { presenceList, setPresence } from "@/lib/realtime-hub";

export const dynamic = "force-dynamic";

// GET: daftar presence aktif (siapa sedang membuka form pembagian / permintaan)
export async function GET() {
  return NextResponse.json(presenceList());
}

// POST: fallback presence saat WebSocket tidak tersedia ({ key, info | null })
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!body?.key) return NextResponse.json({ error: "key wajib" }, { status: 400 });
  setPresence(String(body.key), body.info || null);
  return NextResponse.json({ ok: true });
}
