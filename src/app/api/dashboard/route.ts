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

      return {
        id: po.id,
        noPo: po.noPo,
        model: po.model,
        jumlahTerbit: po.jumlahTerbit,
        tanggalTerbit: po.tanggalTerbit,
        vendor_nama: vendor?.nama || "",
        vendor_tipe: vendor?.tipe || "",
        pemotongan_nama_barang: pemotongan?.nama_barang || null,
        totalDilaporkan,
        totalDisetujui,
        totalWashing,
        totalWashingDone,
        totalDiGudang,
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

    // Vendor aktif dengan PO
    const vendorAktifIds = new Set(po_produksi.filter((po: any) => {
      const g = gudangLedger[po.id] || 0;
      return g < po.jumlahTerbit;
    }).map((po: any) => po.vendorId));
    const vendorList = vendors
      .filter((v: any) => vendorAktifIds.has(v.id))
      .map((v: any) => {
        const poVendor = po_produksi.filter((po: any) => po.vendorId === v.id);
        return { id: v.id, nama: v.nama, tipe: v.tipe, jenis_pekerjaan: v.jenis_pekerjaan, jumlahPO: poVendor.length };
      });

    return NextResponse.json({
      // Legacy compat
      batchAktif: poAktif,
      totalStok: totalDiGudangSemua,
      spkMenunggu: poList.filter((p: any) => p.stage === "menunggu").length,
      terlaris: poList[0]?.model || "",
      batches: [],
      spkList: [],
      // New fields
      poAktif,
      poSelesai,
      totalPCS,
      totalDiGudang: totalDiGudangSemua,
      poList: poList.slice(0, 10),
      vendorList,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
