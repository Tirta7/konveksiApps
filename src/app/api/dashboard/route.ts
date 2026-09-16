import { NextResponse } from "next/server";
import { readData } from "@/lib/data-store";

export async function GET() {
  try {
    const data = readData();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

    const batchAktif = data.batches.filter(b => b.status === "dalam-proses").length;
    const totalStok = data.stock.reduce((s, r) => s + r.stok_saat_ini, 0);

    const poLast7 = data.purchase_orders.filter(p => p.tanggal_po >= sevenDaysAgo);
    const poKatCount: Record<string, number> = {};
    poLast7.forEach(p => { poKatCount[p.kategori] = (poKatCount[p.kategori] || 0) + p.jumlah; });
    const terlaris = Object.entries(poKatCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "–";

    // Batch dengan step aktif
    const batches = data.batches.slice().reverse().slice(0, 10).map(b => {
      const steps = data.batch_steps.filter(s => s.batch_id === b.id).sort((a, c) => a.step_order - c.step_order);
      const currentStep = steps.find(s => s.status === "berjalan");
      const vendor = currentStep ? data.vendors.find(v => v.id === currentStep.vendor_id) : null;
      return {
        ...b,
        vendor_nama: vendor?.nama ?? null,
        jenis_pekerjaan_aktif: currentStep?.jenis_pekerjaan ?? null,
        total_steps: steps.length,
        selesai_steps: steps.filter(s => s.status === "selesai").length,
      };
    });

    // SPK = batch dalam proses
    const spkList = data.batches
      .filter(b => b.status === "dalam-proses")
      .slice().reverse().slice(0, 5)
      .map(b => {
        const steps = data.batch_steps.filter(s => s.batch_id === b.id).sort((a, c) => a.step_order - c.step_order);
        const currentStep = steps.find(s => s.status === "berjalan");
        const vendor = currentStep ? data.vendors.find(v => v.id === currentStep.vendor_id) : null;
        return {
          ...b,
          vendor_nama: vendor?.nama ?? "",
          kode_batch: b.kode_batch,
          jenis_pekerjaan: currentStep?.jenis_pekerjaan ?? "",
          status: b.status,
        };
      });

    return NextResponse.json({ batchAktif, totalStok, spkMenunggu: 0, terlaris, batches, spkList });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
