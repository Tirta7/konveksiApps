import { NextRequest, NextResponse } from "next/server";
import { readData } from "@/lib/data-store";

export async function GET(req: NextRequest) {
  const data = readData();
  const { searchParams } = new URL(req.url);
  const batchId = Number(searchParams.get("batchId"));
  if (!batchId) return NextResponse.json({ error: "batchId required" }, { status: 400 });

  const batch = data.batches.find(b => b.id === batchId);
  if (!batch) return NextResponse.json({ error: "Batch tidak ditemukan" }, { status: 404 });

  const logs = data.tracking_logs
    .filter(t => t.batch_id === batchId)
    .sort((a, b) => a.waktu.localeCompare(b.waktu))
    .map(t => ({
      ...t,
      vendor_nama: data.vendors.find(v => v.id === t.vendor_id)?.nama ?? "",
    }));

  const returList = data.retur_produksi.filter(r => r.batch_id === batchId);

  return NextResponse.json({ batch: { ...batch, vendor_nama: data.vendors.find(v => v.id === batch.vendor_saat_ini)?.nama }, logs, returList });
}
