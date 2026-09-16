import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId, genToken } from "@/lib/data-store";

/** GET /api/spk → daftar semua batch dengan steps-nya */
export async function GET() {
  const data = readData();
  const list = data.batches.slice().reverse().map(b => {
    const steps = data.batch_steps
      .filter(s => s.batch_id === b.id)
      .sort((a, c) => a.step_order - c.step_order)
      .map(s => ({ ...s, vendor_nama: data.vendors.find(v => v.id === s.vendor_id)?.nama ?? "" }));
    return { ...b, steps, total_steps: steps.length };
  });
  return NextResponse.json(list);
}

/**
 * POST /api/spk → Buat batch baru dengan route vendor
 * Body: { jenis_kain, jumlah_pcs, jumlah_meter?, catatan_route?,
 *         steps: [{ vendor_id, jenis_pekerjaan, jumlah_barang, deadline?, catatan? }],
 *         is_retur?: boolean, parent_batch_id?: number }
 */
export async function POST(req: NextRequest) {
  const data = readData();
  const body = await req.json();
  const { jenis_kain, jumlah_pcs, jumlah_meter, catatan_route, steps, size_breakdown, is_retur, parent_batch_id } = body;

  if (!jenis_kain || !steps?.length) {
    return NextResponse.json({ error: "jenis_kain dan minimal 1 step wajib diisi" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const batchId = nextId(data, "batches");
  const prefix = is_retur ? "RETUR" : "BATCH";
  const kodeBatch = `${prefix}-${new Date().getFullYear()}-${String(batchId).padStart(3, "0")}`;
  const token = genToken();

  // Buat batch
  data.batches.push({
    id: batchId,
    kode_batch: kodeBatch,
    jenis_kain,
    jumlah_meter: jumlah_meter ?? undefined,
    jumlah_pcs: jumlah_pcs ?? undefined,
    size_breakdown: size_breakdown ?? [],
    status: "dalam-proses",
    current_step: 1,
    token,
    route_selesai: false,
    catatan_route: catatan_route ?? undefined,
    is_retur: is_retur ?? false,
    parent_batch_id: parent_batch_id ?? undefined,
    created_at: now,
    updated_at: now,
  } as any);

  // Buat steps
  steps.forEach((step: any, idx: number) => {
    const stepId = nextId(data, "batch_steps");
    data.batch_steps.push({
      id: stepId,
      batch_id: batchId,
      step_order: idx + 1,
      vendor_id: Number(step.vendor_id),
      jenis_pekerjaan: step.jenis_pekerjaan,
      jumlah_barang: Number(step.jumlah_barang),
      deadline: step.deadline ?? undefined,
      catatan: step.catatan ?? undefined,
      status: idx === 0 ? "berjalan" : "menunggu",
      mulai_waktu: idx === 0 ? now : undefined,
    });
  });

  // Jika SPK Retur: update retur_produksi → tandai spk_batch_id
  if (is_retur && parent_batch_id) {
    // Cari retur yang paling baru (status menunggu-spk-retur) untuk batch ini
    const returRecord = [...data.retur_produksi]
      .reverse()
      .find(r => r.batch_id === Number(parent_batch_id) && r.status === "menunggu-spk-retur");
    if (returRecord) {
      returRecord.spk_batch_id = batchId;
      returRecord.status = "diproses-ulang";
      // Simpan detail size yang diretur (size_breakdown dari form)
      if (size_breakdown?.length) {
        (returRecord as any).size_detail = size_breakdown.map((s: any) => ({
          size: s.size,
          jumlah_retur: s.jumlah,
        }));
      }
    }
    data.tracking_logs.push({
      id: nextId(data, "tracking_logs"),
      batch_id: Number(parent_batch_id),
      aksi: "spk-retur-dibuat",
      keterangan: `SPK Retur dibuat: ${kodeBatch} — memproses ${jumlah_pcs ?? 0} pcs cacat`,
      waktu: now,
    });
  }

  // Log
  const vendor1 = data.vendors.find(v => v.id === Number(steps[0].vendor_id));
  data.tracking_logs.push({ id: nextId(data, "tracking_logs"), batch_id: batchId, vendor_id: Number(steps[0].vendor_id), aksi: "mulai-produksi", keterangan: `${is_retur ? "[RETUR] " : ""}Route produksi dimulai. Step 1: ${steps[0].jenis_pekerjaan} oleh ${vendor1?.nama}`, waktu: now });

  writeData(data);

  const origin = req.headers.get("origin") || "http://localhost:3000";
  return NextResponse.json({ batchId, kodeBatch, token, link: `${origin}/spk/${token}`, is_retur });
}


