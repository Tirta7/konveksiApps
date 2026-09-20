import { NextResponse } from "next/server";
import { readData } from "@/lib/data-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = readData();
  
  // 1. Ambil semua vendor yang aktif
  const vendors = data.vendors.filter((v: any) => v.aktif);
  
  // 2. Siapkan wadah untuk setiap vendor
  const vendorLedgers = vendors.map((v: any) => ({
    ...v,
    poList: [],
    totalSisa: 0
  }));

  // 3. Proses po_ledgers untuk menghitung saldo tiap PO per vendor
  const poBalances: Record<string, Record<string, number>> = {};
  
  const ledgers = data.po_ledgers || [];
  for (const l of ledgers) {
    if (!poBalances[l.poId]) poBalances[l.poId] = {};
    if (l.ke_vendor_id && l.ke_vendor_id !== "GUDANG") {
      poBalances[l.poId][l.ke_vendor_id] = (poBalances[l.poId][l.ke_vendor_id] || 0) + Number(l.jumlah);
    }
    if (l.dari_vendor_id && l.dari_vendor_id !== "SISTEM") {
      poBalances[l.poId][l.dari_vendor_id] = (poBalances[l.poId][l.dari_vendor_id] || 0) - Number(l.jumlah);
    }
  }

  // 4. Build cmt_progres lookup per PO
  const cmtProgresByPo: Record<string, any[]> = {};
  for (const rec of (data.cmt_progres || [])) {
    const key = String(rec.po_id);
    if (!cmtProgresByPo[key]) cmtProgresByPo[key] = [];
    cmtProgresByPo[key].push(rec);
  }

  // 5. Masukkan saldo yang > 0 ke masing-masing vendor
  for (const poId in poBalances) {
    const po = data.po_produksi.find((p: any) => String(p.id) === String(poId));
    if (!po) continue;

    // Aggregate cmt_progres cicilan for this PO
    const progresRecords = cmtProgresByPo[poId] || [];
    const approvedRecords = progresRecords.filter((p: any) => p.status === "Diterima" || p.status === "Diverifikasi");
    const pendingRecords = progresRecords.filter((p: any) => p.status === "Menunggu" || p.status === "Pending");

    const sizeProgress: Record<string, number> = {};
    const sizePending: Record<string, number> = {};
    for (const rec of approvedRecords) {
      for (const item of (rec.items || [])) {
        sizeProgress[item.size] = (sizeProgress[item.size] || 0) + Number(item.jumlah || 0);
      }
    }
    for (const rec of pendingRecords) {
      for (const item of (rec.items || [])) {
        sizePending[item.size] = (sizePending[item.size] || 0) + Number(item.jumlah || 0);
      }
    }

    const totalDisetujui = approvedRecords.reduce((sum: number, r: any) =>
      sum + (r.items || []).reduce((s2: number, i: any) => s2 + Number(i.jumlah || 0), 0), 0);
    const totalPending = pendingRecords.reduce((sum: number, r: any) =>
      sum + (r.items || []).reduce((s2: number, i: any) => s2 + Number(i.jumlah || 0), 0), 0);
    const totalDilaporkan = totalDisetujui + totalPending;
    const pctDisetujui = po.jumlahTerbit > 0 ? Math.round((totalDisetujui / po.jumlahTerbit) * 100) : 0;
    const pctDilaporkan = po.jumlahTerbit > 0 ? Math.round((totalDilaporkan / po.jumlahTerbit) * 100) : 0;

    // Laporan cicilan: list of cmt_progres with vendor info
    const laporanCicilan = progresRecords.map((r: any) => {
      const vendor = (data.vendors || []).find((v: any) => v.id === r.vendor_id);
      return { ...r, vendor_nama: vendor?.nama || "Unknown" };
    }).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    for (const vendorId in poBalances[poId]) {
      const saldo = poBalances[poId][vendorId];
      if (saldo > 0) {
        const vIndex = (vendorLedgers as any[]).findIndex((v: any) => String(v.id) === String(vendorId));
        if (vIndex !== -1) {
          (vendorLedgers as any[])[vIndex].poList.push({
            ...po,
            saldo_di_vendor: saldo,
            sizeProgress,
            sizePending,
            totalDisetujui,
            totalPending,
            totalDilaporkan,
            pctDisetujui,
            pctDilaporkan,
            laporanCicilan,
          });
          (vendorLedgers as any[])[vIndex].totalSisa += saldo;
        }
      }
    }
  }

  // Sort poList inside each vendor
  (vendorLedgers as any[]).forEach((v: any) => {
    v.poList.sort((a: any, b: any) => b.id - a.id);
  });

  return NextResponse.json({
    vendorLedgers,
    allVendors: vendors
  });
}
