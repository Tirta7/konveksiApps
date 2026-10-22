export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { readData } from "@/lib/data-store";
import { getSessionFromRequest } from "@/lib/auth";

// GET → sesi aktif + apakah aplikasi butuh setup akun Owner pertama
export async function GET(req: NextRequest) {
  const data: any = readData();
  const needsSetup = !(data.users || []).some((u: any) => u.role === "owner");
  const s = getSessionFromRequest(req);
  if (!s) return NextResponse.json({ session: null, needsSetup });
  let extra: any = {};
  if (s.t === "user") {
    const u = (data.users || []).find((x: any) => Number(x.id) === Number(s.id));
    extra = { username: u?.username };
  } else {
    const v = (data.vendors || []).find((x: any) => Number(x.id) === Number(s.id));
    extra = { tipe: v?.tipe, kodeVendor: v?.kodeVendor };
  }
  return NextResponse.json({ session: { t: s.t, id: s.id, role: s.role, nama: s.nama, ...extra }, needsSetup });
}
