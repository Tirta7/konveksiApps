import { NextRequest, NextResponse } from "next/server";
import { readData } from "@/lib/data-store";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const data = readData();

  const batch = data.batches.find(b => b.id === Number(batchId));
  if (!batch) return NextResponse.json({ error: "Batch tidak ditemukan" }, { status: 404 });

  const steps = data.batch_steps
    .filter(s => s.batch_id === batch.id)
    .sort((a, b) => a.step_order - b.step_order)
    .map(s => {
      const vendor = data.vendors.find(v => v.id === s.vendor_id);
      const totalCacat = (s as any).total_cacat ?? 0;
      const defectDetail = (s as any).defect_detail ?? [];
      const jumlahDiterima = (s as any).jumlah_diterima;
      const selisihTerima = (s as any).selisih_terima ?? 0;
      return {
        ...s,
        vendor_nama: vendor?.nama ?? "-",
        total_cacat: totalCacat,
        defect_detail: defectDetail,
        jumlah_diterima: jumlahDiterima,
        selisih_terima: selisihTerima,
      };
    });

  const retur = data.retur_produksi.filter(r => r.batch_id === batch.id);
  const logs = data.tracking_logs
    .filter(l => l.batch_id === batch.id)
    .sort((a, b) => new Date(a.waktu).getTime() - new Date(b.waktu).getTime());

  // Hitung rekap
  const jumlahAwal = batch.jumlah_pcs ?? 0;
  const totalCacatAll = steps.reduce((s, st) => s + (st.total_cacat ?? 0), 0);
  const jumlahFinal = jumlahAwal - totalCacatAll;

  // Size breakdown dengan cacat terakumulasi
  const sizeBreakdown = (batch as any).size_breakdown ?? [];

  return NextResponse.json({
    batch: {
      ...batch,
      size_breakdown: sizeBreakdown,
    },
    steps,
    retur,
    logs,
    rekap: {
      jumlah_awal: jumlahAwal,
      total_cacat: totalCacatAll,
      jumlah_final: Math.max(0, jumlahFinal),
      ada_cacat: totalCacatAll > 0,
      selesai: batch.route_selesai,
      status: batch.status,
    },
  });
}
