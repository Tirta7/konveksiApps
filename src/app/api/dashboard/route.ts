import { NextResponse } from "next/server";
import { readData } from "@/lib/data-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = readData();
    const po_produksi = data.po_produksi || [];
    const vendors = data.vendors || [];
    const cmt_progres = data.cmt_progres || [];
    const produksi_transfers = data.produksi_transfers || [];
    const pemotongan_kain = data.pemotongan_kain || [];

    // PO Aktif = PO yang belum selesai (saldo masuk gudang < jumlahTerbit)
    // Hitung stok di gudang via po_ledgers
    const po_ledgers = data.po_ledgers || [];
    const gudangLedger: Record<string, number> = {};
    for (const l of po_ledgers) {
      if (l.ke_vendor_id === "GUDANG") {
        gudangLedger[l.poId] = (gudangLedger[l.poId] || 0) + Number(l.jumlah || 0);
      }
    }

    // Enrich po_produksi dengan progress
    const poList = po_produksi.map((po: any) => {
      const vendor = vendors.find((v: any) => v.id === po.vendorId);
      const pemotongan = pemotongan_kain.find((p: any) => p.id === po.pemotongan_id);

      // CMT Progress
      const cmtRecords = cmt_progres.filter((p: any) => String(p.po_id) === String(po.id));
      const approvedCMT = cmtRecords.filter((p: any) => p.status === "Diverifikasi" || p.status === "Diterima");
      const totalDilaporkan = cmtRecords.reduce((s: number, r: any) =>
        s + (r.items || []).reduce((s2: number, i: any) => s2 + Number(i.jumlah || 0), 0), 0);
      const totalDisetujui = approvedCMT.reduce((s: number, r: any) =>
        s + (r.items || []).reduce((s2: number, i: any) => s2 + Number(i.jumlah || 0), 0), 0);

      // Washing
      const washingT = produksi_transfers.filter((t: any) => String(t.po_id) === String(po.id) && t.ke === "washing");
      const totalWashing = washingT.reduce((s: number, t: any) => s + (t.jumlah_kirim || 0), 0);
      const totalWashingDone = washingT.filter((t: any) => t.status === "Diverifikasi")
        .reduce((s: number, t: any) => s + (t.jumlah_diterima || t.jumlah_kirim || 0), 0);

      // Gudang
      const totalDiGudang = gudangLedger[po.id] || 0;

      const pctCMT = po.jumlahTerbit > 0 ? Math.round((totalDilaporkan / po.jumlahTerbit) * 100) : 0;
      const pctDisetujui = po.jumlahTerbit > 0 ? Math.round((totalDisetujui / po.jumlahTerbit) * 100) : 0;
      const pctGudang = po.jumlahTerbit > 0 ? Math.round((totalDiGudang / po.jumlahTerbit) * 100) : 0;

      let stage = "menunggu";
      if (totalDiGudang >= po.jumlahTerbit) stage = "selesai";
      else if (totalWashing > 0 && totalWashingDone < totalWashing) stage = "washing";
      else if (totalWashingDone > 0) stage = "selesai-washing";
      else if (totalDisetujui > 0) stage = "siap-tarik";
      else if (totalDilaporkan > 0) stage = "dijahit";

      // Target Selesai & Overdue Check
      const targetSelesai = po.target_selesai || pemotongan?.target_selesai || null;
      let overdueDays = 0;
      let isOverdue = false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (targetSelesai && stage !== "selesai") {
        const targetDate = new Date(targetSelesai);
        targetDate.setHours(0, 0, 0, 0);
        const graceDate = new Date(targetDate);
        graceDate.setDate(graceDate.getDate() + 1); // 1 hari toleransi
        if (today > graceDate) {
          overdueDays = Math.floor((today.getTime() - graceDate.getTime()) / (1000 * 60 * 60 * 24));
          isOverdue = true;
        }
      }

      return {
        id: po.id,
        noPo: po.noPo,
        model: po.model,
        jumlahTerbit: po.jumlahTerbit,
        tanggalTerbit: po.tanggalTerbit,
        vendorId: po.vendorId,
        vendor_nama: vendor?.nama || "",
        vendor_tipe: vendor?.tipe || "",
        vendor_kontak: vendor?.kontak || vendor?.no_hp || "",
        pemotongan_id: po.pemotongan_id,
        pemotongan_nama_barang: pemotongan?.nama_barang || null,
        target_selesai: targetSelesai,
        overdueDays,
        isOverdue,
        totalDilaporkan,
        totalDisetujui,
        totalWashing,
        totalWashingDone,
        totalDiGudang,
        sisaPcs: Math.max(0, po.jumlahTerbit - totalDiGudang),
        pctCMT,
        pctDisetujui,
        pctGudang,
        stage,
        sizeBreakdown: po.sizeBreakdown || [],
      };
    });

    // Statistik ringkasan
    const poAktif = poList.filter((p: any) => p.stage !== "selesai").length;
    const poSelesai = poList.filter((p: any) => p.stage === "selesai").length;
    const totalDiGudangSemua = poList.reduce((s: any, p: any) => s + p.totalDiGudang, 0);
    const totalPCS = poList.reduce((s: any, p: any) => s + p.jumlahTerbit, 0);

    // Keterlambatan PO & Vendor
    const overdueList = poList
      .filter((p: any) => p.isOverdue)
      .sort((a: any, b: any) => b.overdueDays - a.overdueDays);
    const totalPoTerlambat = overdueList.length;

    // Vendor aktif dengan PO & status keterlambatan
    const vendorAktifIds = new Set(po_produksi.filter((po: any) => {
      const g = gudangLedger[po.id] || 0;
      return g < po.jumlahTerbit;
    }).map((po: any) => po.vendorId));

    const vendorList = vendors
      .filter((v: any) => vendorAktifIds.has(v.id))
      .map((v: any) => {
        const poVendor = poList.filter((po: any) => po.vendorId === v.id && po.stage !== "selesai");
        const vendorOverdue = poVendor.filter((po: any) => po.isOverdue);
        const maxOverdue = vendorOverdue.reduce((max: number, p: any) => Math.max(max, p.overdueDays), 0);
        return { 
          id: v.id, 
          nama: v.nama, 
          tipe: v.tipe, 
          jenis_pekerjaan: v.jenis_pekerjaan, 
          kontak: v.kontak || v.no_hp || "",
          jumlahPO: poVendor.length,
          hasOverdue: vendorOverdue.length > 0,
          overdueCount: vendorOverdue.length,
          maxOverdueDays: maxOverdue,
          overduePoNames: vendorOverdue.map((p: any) => p.noPo)
        };
      });

    return NextResponse.json({
      // Legacy compat
      batchAktif: poAktif,
      totalStok: totalDiGudangSemua,
      spkMenunggu: poList.filter((p: any) => p.stage === "menunggu").length,
      terlaris: poList[0]?.model || "",
      batches: [],
      spkList: [],
      // Metrics & Alerts
      poAktif,
      poSelesai,
      totalPCS,
      totalDiGudang: totalDiGudangSemua,
      totalPoTerlambat,
      overdueList,
      poList: poList.slice(0, 15),
      vendorList,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
