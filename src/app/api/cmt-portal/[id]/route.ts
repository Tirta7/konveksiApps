import { NextResponse } from "next/server";
import { readData } from "@/lib/data-store";

// GET portal data for a specific CMT vendor
export async function GET(req: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  const data = readData();
  const params = await Promise.resolve(context.params);
  const vendorId = Number(params.id);

  const vendor = (data.vendors || []).find((v: any) => v.id === vendorId);
  if (!vendor) {
    return NextResponse.json({ error: "CMT tidak ditemukan" }, { status: 404 });
  }

  // PO aktif: po_produksi yang masih berjalan
  const activePO = (data.po_produksi || [])
    .filter((po: any) => po.vendorId === vendorId && po.status !== "Selesai")
    .map((po: any) => {
      const pengambilans = (data.po_pengambilan || []).filter((p: any) => p.poId === po.id);
      const totalDiambil = pengambilans.reduce((sum: number, p: any) => sum + (p.jumlahDiambil || 0), 0);
      const pct = po.jumlahTerbit > 0 ? Math.round((totalDiambil / po.jumlahTerbit) * 100) : 0;
      
      // Compute per-size progress from verified cmt_progres records
      const sizeProgress: Record<string, number> = {};
      const progresRecords = (data.cmt_progres || []).filter((p: any) => 
        p.po_id === po.id && (p.status === "Diverifikasi" || p.status === "selesai" || p.status === "Diterima")
      );
      for (const rec of progresRecords) {
        for (const item of (rec.items || [])) {
          sizeProgress[item.size] = (sizeProgress[item.size] || 0) + Number(item.jumlah || 0);
        }
      }
      // Also count from pending reports (Menunggu/Pending, not Ditolak or Diterima)
      const pendingProgres = (data.cmt_progres || []).filter((p: any) => 
        p.po_id === po.id && p.vendor_id === vendorId && 
        (p.status === "Menunggu" || p.status === "Pending")
      );
      const pendingSizeProgress: Record<string, number> = {};
      for (const rec of pendingProgres) {
        for (const item of (rec.items || [])) {
          pendingSizeProgress[item.size] = (pendingSizeProgress[item.size] || 0) + Number(item.jumlah || 0);
        }
      }
      
      return {
        ...po,
        no_po: po.noPo,          // alias for frontend
        jumlah_terbit: po.jumlahTerbit,
        totalDiambil,
        pct,
        sizeProgress,
        pendingSizeProgress,
        progres: (data.spk_progres || []).filter((p: any) => p.po_id === po.id)
      };
    });

  // Riwayat selesai
  const historiPO = (data.po_produksi || [])
    .filter((po: any) => po.vendorId === vendorId && po.status === "Selesai")
    .map((po: any) => {
      const pengambilans = (data.po_pengambilan || []).filter((p: any) => p.poId === po.id);
      const totalDiambil = pengambilans.reduce((sum: number, p: any) => sum + (p.jumlahDiambil || 0), 0);
      return { ...po, no_po: po.noPo, jumlah_terbit: po.jumlahTerbit, totalDiambil };
    })
    .slice().reverse().slice(0, 20);

  // Gaji / Tagihan
  const gaji = (data.gaji_cmt || [])
    .filter((g: any) => g.cmtId === vendorId)
    .slice().reverse();

  const totalTertunggak = gaji.filter((g: any) => g.status !== "Lunas")
    .reduce((sum: number, g: any) => sum + (Number(g.total) - Number(g.dibayar || 0)), 0);

  // Requests dari CMT ini
  const requests = (data.cmt_requests || [])
    .filter((r: any) => r.vendor_id === vendorId)
    .map((r: any) => {
      // Cross-reference pemotongan kain
      const pemo = r.pemotongan_id
        ? (data.pemotongan_kain || []).find((p: any) => p.id === r.pemotongan_id)
        : null;
      return {
        ...r,
        pemotongan: pemo ? {
          id: pemo.id,
          nama_barang: pemo.nama_barang,
          model: pemo.model,
          total_pcs: pemo.total_pcs,
          sisa_total: pemo.sizeBreakdown.reduce((s: number, x: any) => s + (x.sisa || 0), 0),
          sizeBreakdown: pemo.sizeBreakdown,
        } : null
      };
    })
    .slice().reverse();

  // Pemotongan kain yang masih ada sisa (untuk dipilih saat request)
  const pemotonganReady = (data.pemotongan_kain || [])
    .filter((p: any) => p.status !== "Draft" && p.sizeBreakdown.some((s: any) => (s.sisa || 0) > 0))
    .map((p: any) => ({
      id: p.id,
      tanggal: p.tanggal,
      nama_barang: p.nama_barang,
      model: p.model,
      total_pcs: p.total_pcs,
      sisa_total: p.sizeBreakdown.reduce((s: number, x: any) => s + (x.sisa || 0), 0),
      sizeBreakdown: p.sizeBreakdown,
    }))
    .sort((a: any, b: any) => b.sisa_total - a.sisa_total); // yang terbanyak sisa di atas

  return NextResponse.json({
    vendor,
    activePO,
    historiPO,
    gaji,
    totalTertunggak,
    requests,
    pemotonganReady, // NEW: stok kain siap untuk dipilih CMT
  });
}

