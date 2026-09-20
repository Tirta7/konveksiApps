import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";
import crypto from "crypto";

export async function GET() {
  const data = readData();
  return NextResponse.json(data.spk.slice().reverse());
}

export async function POST(req: NextRequest) {
  const data = readData();
  const body = await req.json();
  const { jenis_kain, jumlah_pcs, jumlah_meter, steps, size_breakdown, is_retur, parent_batch_id } = body;
  
  if (!jenis_kain || !steps?.length) return NextResponse.json({ error: "Invalid data" }, { status: 400 });

  const now = new Date().toISOString();
  const batchId = nextId(data, "batches");
  const prefix = is_retur ? "RETUR" : "BATCH";
  const kodeBatch = `${prefix}-${new Date().getFullYear()}-${String(batchId).padStart(3, "0")}`;
  const batchToken = crypto.randomUUID();

  const newBatch = {
    id: batchId, kodeBatch, jenisKain: jenis_kain, jumlahPcs: jumlah_pcs, jumlahMeter: jumlah_meter,
    sizeBreakdown: size_breakdown || [], status: "dalam-proses", currentStep: 1, token: batchToken,
    isRetur: is_retur || false, parentBatchId: parent_batch_id, createdAt: now
  };
  data.batches.push(newBatch);

  const numBundles = Math.ceil((jumlah_pcs || 50) / 50);
  for (let i = 0; i < numBundles; i++) {
    const bId = nextId(data, "bundles");
    data.bundles.push({
      id: bId, kodeBundel: `${kodeBatch}-BDL-${i+1}`, batchId, jumlahPcs: i === numBundles - 1 ? (jumlah_pcs % 50 || 50) : 50,
      status: "menunggu", returCount: 0, qrCode: `http://localhost:3000/bundle/${bId}`
    });
  }

  steps.forEach((s: any, idx: number) => {
    const spkId = nextId(data, "spk");
    data.spk.push({
      id: spkId, noSpk: `SPK-${kodeBatch}-${idx + 1}`, batchId, stepOrder: idx + 1, vendorId: Number(s.vendor_id),
      jenisPekerjaan: s.jenis_pekerjaan, targetJumlah: Number(s.jumlah_barang), jumlahSelesai: 0,
      deadline: s.deadline || null, catatan: s.catatan || "", token: crypto.randomUUID(),
      status: idx === 0 ? "berjalan" : "menunggu", tanggalTerbit: now
    });
  });

  writeData(data);
  const origin = req.headers.get("origin") || "http://localhost:3000";
  return NextResponse.json({ batchId, kodeBatch, token: batchToken, link: `${origin}/spk/${batchToken}` });
}
