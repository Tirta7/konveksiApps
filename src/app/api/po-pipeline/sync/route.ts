import { NextResponse } from "next/server";
import { readData, writeData } from "@/lib/data-store";
import { reconcileProduction } from "@/lib/po-lifecycle";

/**
 * POST /api/po-pipeline/sync
 * Rekonsiliasi manual (tombol "Sync Ulang Pipeline").
 * Logika sama persis dengan auto-reconcile yang berjalan di setiap penyimpanan data
 * (lihat lib/po-lifecycle.ts) — hanya menulis jika ada perubahan.
 */
export async function POST() {
  const data = readData();
  if (!data.pipeline_stages || data.pipeline_stages.filter((s: any) => s.aktif).length === 0) {
    return NextResponse.json({ synced: 0, message: "Tidak ada stage aktif" });
  }

  let directChanged = false;
  // Pastikan transfer yang ditutup reject 100% berstatus "Reject" (bukan Selesai)
  for (const t of (data.produksi_transfers || [])) {
    const isRejectTotal = Number(t.jumlah_reject || 0) >= Number(t.jumlah_kirim || 0) && Number(t.jumlah_kirim || 0) > 0;
    if (isRejectTotal && t.status !== "Reject") {
      t.status = "Reject";
      directChanged = true;
    }
  }

  const before = JSON.stringify(data.po_pipeline || []);
  const changed = reconcileProduction(data) || directChanged;
  const synced = changed ? 1 : 0;
  if (changed) writeData(data);

  return NextResponse.json({
    synced,
    pipeline_changed: before !== JSON.stringify(data.po_pipeline || []),
    total_po: data.po_produksi?.length || 0,
    total_pipeline: data.po_pipeline?.length || 0,
  });
}