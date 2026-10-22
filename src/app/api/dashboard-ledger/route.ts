import { NextResponse } from "next/server";
import { readData } from "@/lib/data-store";
import { getCmtCompletion } from "@/lib/po-lifecycle";
import { getVendorWip } from "@/lib/stock";

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

  // 3. Saldo barang yang MASIH FISIK di vendor per PO.
  //    Sumber riil (sama dengan Dashboard & Gudang):
  //     - CMT pemegang PO : jumlah terbit − laporan yang sudah di-ACC
  //     - Vendor lanjutan : sisa transfer aktif (kirim − setoran ACC − reject), lib/stock getVendorWip
  //    po_ledgers tidak dipakai lagi karena ACC / penarikan / nota reject tercatat ganda sehingga saldo meleset.
  const poBalances: Record<string, Record<string, number>> = {};
  const addBal = (poId: any, vendorId: any, n: number) => {
    if (vendorId == null || n <= 0) return;
    const k = String(poId);
    (poBalances[k] ||= {})[String(vendorId)] = (poBalances[k][String(vendorId)] || 0) + n;
  };
  for (const po of (data.po_produksi || [])) {
    if (!po.vendorId) continue;
    const c = getCmtCompletion(data, po);
    if (!c.done) addBal(po.id, po.vendorId, c.sisa);
  }
  for (const w of getVendorWip(data)) addBal(w.po_id, w.vendor_id, Number(w.sisa || 0));

  // 4. Build cmt_progres lookup per PO
  const cmtProgresByPo: Record<string, any[]> = {};
  for (const rec of (data.cmt_progres || [])) {
    const key = String(rec.po_id);
    if (!cmtProgresByPo[key]) cmtProgresByPo[key] = [];
    cmtProgresByPo[key].push(rec);
  }

  // 5. Masukkan saldo yang > 0 ke masing-masing vendor (statistik laporan hanya milik vendor tsb)
  const sumItems = (r: any) => (r.items || []).reduce((s2: number, i: any) => s2 + Number(i.jumlah || 0), 0);
  for (const poId in poBalances) {
    const po = data.po_produksi.find((p: any) => String(p.id) === String(poId));
    if (!po) continue;

    for (const vendorId in poBalances[poId]) {
      const saldo = poBalances[poId][vendorId];
      if (saldo <= 0) continue;
      const vIndex = (vendorLedgers as any[]).findIndex((v: any) => String(v.id) === String(vendorId));
      if (vIndex === -1) continue;

      const progresRecords = (cmtProgresByPo[poId] || []).filter((r: any) => String(r.vendor_id) === String(vendorId));
      const approvedRecords = progresRecords.filter((p: any) => p.status === "Diterima" || p.status === "Diverifikasi");
      const pendingRecords = progresRecords.filter((p: any) => p.status === "Menunggu" || p.status === "Pending");

      const sizeProgress: Record<string, number> = {};
      const sizePending: Record<string, number> = {};
      for (const rec of approvedRecords) for (const item of (rec.items || [])) sizeProgress[item.size] = (sizeProgress[item.size] || 0) + Number(item.jumlah || 0);
      for (const rec of pendingRecords) for (const item of (rec.items || [])) sizePending[item.size] = (sizePending[item.size] || 0) + Number(item.jumlah || 0);

      const totalDisetujui = approvedRecords.reduce((s: number, r: any) => s + sumItems(r), 0);
      const totalPending = pendingRecords.reduce((s: number, r: any) => s + sumItems(r), 0);
      const totalDilaporkan = totalDisetujui + totalPending;
      // Jatah vendor: CMT = jumlah PO; vendor lanjutan = total yang dikirim ke vendor tsb (dikurangi reject)
      const isCmt = String(po.vendorId) === String(vendorId);
      const jatah = isCmt
        ? Number(po.jumlahTerbit || 0)
        : (data.produksi_transfers || [])
            .filter((t: any) => String(t.po_id) === String(po.id) && String(t.vendor_id) === String(vendorId) && t.status !== "Ditolak")
            .reduce((s: number, t: any) => s + Math.max(0, Number(t.jumlah_kirim || 0) - Number(t.jumlah_reject || 0)), 0);
      const pctDisetujui = jatah > 0 ? Math.min(100, Math.round((totalDisetujui / jatah) * 100)) : 0;
      const pctDilaporkan = jatah > 0 ? Math.min(100, Math.round((totalDilaporkan / jatah) * 100)) : 0;

      const laporanCicilan = progresRecords.map((r: any) => {
        const vendor = (data.vendors || []).find((v: any) => v.id === r.vendor_id);
        return { ...r, vendor_nama: vendor?.nama || "Unknown" };
      }).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      (vendorLedgers as any[])[vIndex].poList.push({
        ...po,
        saldo_di_vendor: saldo,
        jatah_vendor: jatah,
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

  // Sort poList inside each vendor
  (vendorLedgers as any[]).forEach((v: any) => {
    v.poList.sort((a: any, b: any) => b.id - a.id);
  });

  return NextResponse.json({
    vendorLedgers,
    allVendors: vendors
  });
}
