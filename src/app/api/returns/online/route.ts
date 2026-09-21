export const dynamic = "force-dynamic";
﻿import { NextResponse } from "next/server";
import { readData, writeData } from "@/lib/data-store";

export async function GET() {
  try {
    const data = readData();
    return NextResponse.json(data.retur_online || []);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const data = readData();
    const body = await req.json();
    const { id, status } = body;

    if (!id || !status) return NextResponse.json({ error: "id dan status wajib diisi" }, { status: 400 });

    if (!data.retur_online) data.retur_online = [];
    const idx = data.retur_online.findIndex((r: any) => r.id === id);
    if (idx === -1) return NextResponse.json({ error: "Data tidak ditemukan" }, { status: 404 });

    data.retur_online[idx] = { ...data.retur_online[idx], status };
    writeData(data);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const data = readData();
    const body = await req.json();
    if (!data.retur_online) data.retur_online = [];

    const rows = Array.isArray(body) ? body : [body];
    data.retur_online.push(...rows);
    writeData(data);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
