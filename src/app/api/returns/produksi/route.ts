import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";

export async function GET() {
  const data = readData();
  const list = data.retur_produksi.map(r => ({ ...r, kode_batch: data.batches.find(b => b.id === r.batch_id)?.kode_batch ?? "", jenis_kain: data.batches.find(b => b.id === r.batch_id)?.jenis_kain ?? "" }));
  return NextResponse.json(list.reverse());
}

export async function POST(req: NextRequest) {
  const data = readData();
  const { batchId, alasan } = await req.json();
  const existing = data.retur_produksi.filter(r => r.batch_id === Number(batchId)).length;
  if (existing >= 2) return NextResponse.json({ error: "Sudah mencapai batas maksimal 2x cuci ulang." }, { status: 400 });
  const now = new Date().toISOString();
  data.retur_produksi.push({ id: nextId(data, "retur_produksi"), batch_id: Number(batchId), alasan, ke_berapa_kali: existing + 1, status: "menunggu-spk-retur", tanggal: now });
  writeData(data);
  return NextResponse.json({ success: true });
}
