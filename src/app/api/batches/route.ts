import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";

export async function GET() {
  const data = readData();
  const list = data.batches.slice().reverse().map(b => {
    const steps = data.batch_steps.filter(s => s.batch_id === b.id).sort((a, c) => a.step_order - c.step_order);
    const currentStep = steps.find(s => s.status === "berjalan");
    const vendor = currentStep ? data.vendors.find(v => v.id === currentStep.vendor_id) : null;
    return {
      ...b,
      steps: steps.map(s => ({ ...s, vendor_nama: data.vendors.find(v => v.id === s.vendor_id)?.nama ?? "" })),
      vendor_nama: vendor?.nama ?? null,
      jenis_pekerjaan_aktif: currentStep?.jenis_pekerjaan ?? null,
    };
  });
  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  const data = readData();
  const { jenisCain, jumlahMeter, jumlahPcs } = await req.json();
  const now = new Date().toISOString();
  const id = nextId(data, "batches");
  const kodeBatch = `BATCH-${new Date().getFullYear()}-${String(id).padStart(3, "0")}`;
  const token = require("crypto").randomUUID();
  data.batches.push({ id, kode_batch: kodeBatch, jenis_kain: jenisCain, jumlah_meter: jumlahMeter, jumlah_pcs: jumlahPcs, status: "bahan-mentah", current_step: 0, token, route_selesai: false, created_at: now, updated_at: now });
  writeData(data);
  return NextResponse.json({ id, kodeBatch, token });
}
