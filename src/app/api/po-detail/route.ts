import { NextRequest, NextResponse } from "next/server";
import { readData } from "@/lib/data-store";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const poId = searchParams.get("poId");

  const data = readData();

  const po_produksi = data.po_produksi || [];
  const pemotongan_kain = data.pemotongan_kain || [];
  const data_kain = data.data_kain || [];
  const tukang_potong = data.tukang_potong || [];
  const vendors = data.vendors || [];
  const cmt_progres = data.cmt_progres || [];
  const produksi_transfers = data.produksi_transfers || [];
  const po_ledgers = data.po_ledgers || [];

  const poList = poId
    ? po_produksi.filter((p: any) => String(p.id) === String(poId))
    : po_produksi;

  const result = poList.map((po: any) => {
    // 1. Cross-reference Pemotongan Kain
    const pemotongan = pemotongan_kain.find((p: any) => p.id === po.pemotongan_id);

    // 2. Cross-reference Kain
    const kain = pemotongan
      ? data_kain.find((k: any) => k.nama_kain === pemotongan.nama_barang)
      : null;

    // 3. Cross-reference Tukang Potong
    const tukang = pemotongan
      ? tukang_potong.find((t: any) => t.id === pemotongan.tukang_potong_id)
      : null;

    // 4. Vendor CMT awal
    const vendorCMT = vendors.find((v: any) => v.id === po.vendorId);

    // 5. CMT Progress Records
    const cmtRecords = cmt_progres
      .filter((p: any) => String(p.po_id) === String(po.id))
      .map((rec: any) => {
        const vnd = vendors.find((v: any) => v.id === rec.vendor_id);
        return {
          ...rec,
          vendor_nama: vnd ? vnd.nama : `Vendor #${rec.vendor_id}`,
        };
      })
      .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    // 6. Produksi Transfers (washing, benang, finishing, gudang)
    const transfers = produksi_transfers
      .filter((t: any) => String(t.po_id) === String(po.id))
      .map((t: any) => {
        const vendorKe = vendors.find((v: any) => v.id === t.vendor_id || v.id === t.ke_vendor_id);
        return { ...t, vendor_ke_nama: vendorKe ? vendorKe.nama : t.ke || "Gudang" };
      })
      .sort((a: any, b: any) => new Date(a.tanggal_kirim).getTime() - new Date(b.tanggal_kirim).getTime());

    // 7. PO Ledger records
    const ledgers = po_ledgers
      .filter((l: any) => String(l.poId) === String(po.id))
      .map((l: any) => {
        const vendorKe = l.ke_vendor_id === "GUDANG"
          ? { nama: " Gudang Produksi" }
          : vendors.find((v: any) => String(v.id) === String(l.ke_vendor_id));
        const vendorDari = l.dari_vendor_id === "SISTEM" || l.dari === "SISTEM"
          ? { nama: " Pemotongan Kain (Sistem)" }
          : vendors.find((v: any) => String(v.id) === String(l.dari_vendor_id || l.dari));
        return {
          ...l,
          ke_nama: vendorKe ? vendorKe.nama : l.ke_vendor_id,
          dari_nama: vendorDari ? vendorDari.nama : (l.dari_vendor_id || l.dari),
        };
      })
      .sort((a: any, b: any) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());

    // 8. Compute aggregate stats
    const approvedCMT = cmtRecords.filter((r: any) => r.status === "Diverifikasi" || r.status === "Diterima");
    const pendingCMT = cmtRecords.filter((r: any) => r.status === "Menunggu" || r.status === "Pending");
    const totalDilaporkan = cmtRecords.reduce((s: number, r: any) =>
      s + (r.items || []).reduce((s2: number, i: any) => s2 + Number(i.jumlah || 0), 0), 0);
    const totalDisetujui = approvedCMT.reduce((s: number, r: any) =>
      s + (r.items || []).reduce((s2: number, i: any) => s2 + Number(i.jumlah || 0), 0), 0);
    const totalPending = pendingCMT.reduce((s: number, r: any) =>
      s + (r.items || []).reduce((s2: number, i: any) => s2 + Number(i.jumlah || 0), 0), 0);

    const washingTransfers = transfers.filter((t: any) => t.ke === "washing");
    const totalWashing = washingTransfers.reduce((s: number, t: any) => s + (t.jumlah_kirim || 0), 0);
    const totalWashingDone = washingTransfers
      .filter((t: any) => t.status === "Diverifikasi")
      .reduce((s: number, t: any) => s + (t.jumlah_diterima || t.jumlah_kirim || 0), 0);

    const totalDiGudang = ledgers
      .filter((l: any) => l.ke_vendor_id === "GUDANG")
      .reduce((s: number, l: any) => s + Number(l.jumlah || 0), 0);

    return {
      // PO Info
      id: po.id,
      noPo: po.noPo,
      model: po.model,
      jumlahTerbit: po.jumlahTerbit,
      sizeBreakdown: po.sizeBreakdown,
      status: po.status,
      catatan: po.catatan,
      tanggalTerbit: po.tanggalTerbit,

      // Vendor CMT
      vendorCMT: vendorCMT ? { id: vendorCMT.id, nama: vendorCMT.nama, tipe: vendorCMT.tipe, jenis_pekerjaan: vendorCMT.jenis_pekerjaan } : null,

      // Pemotongan Kain (asal usul bahan)
      pemotongan: pemotongan ? {
        id: pemotongan.id,
        tanggal: pemotongan.tanggal,
        createdAt: pemotongan.createdAt,
        nama_barang: pemotongan.nama_barang,
        meter_kain: pemotongan.meter_kain,
        pemakaian_cm: pemotongan.pemakaian_cm,
        total_pcs: pemotongan.total_pcs,
        sizeBreakdown: pemotongan.sizeBreakdown,
        sisa_sizeBreakdown: pemotongan.sizeBreakdown, // real-time sisa
        // Tukang Potong
        tukang: tukang ? { id: tukang.id, nama: tukang.nama, kode: tukang.kode, kontak: tukang.kontak } : null,
        // Kain
        kain: kain ? { id: kain.id, nama_kain: kain.nama_kain, jenis: kain.jenis, warna: kain.warna } : {
          nama_kain: pemotongan.nama_barang,
        },
      } : null,

      // CMT Progress timeline
      cmtRecords,

      // Transfer (Washing, Benang, Finishing, Gudang)
      transfers,

      // Ledger (Pengambilan per vendor)
      ledgers,

      // Aggregated stats
      stats: {
        totalDilaporkan,
        totalDisetujui,
        totalPending,
        pctCMT: po.jumlahTerbit > 0 ? Math.round((totalDilaporkan / po.jumlahTerbit) * 100) : 0,
        pctDisetujui: po.jumlahTerbit > 0 ? Math.round((totalDisetujui / po.jumlahTerbit) * 100) : 0,
        totalWashing,
        totalWashingDone,
        pctWashing: po.jumlahTerbit > 0 ? Math.round((totalWashing / po.jumlahTerbit) * 100) : 0,
        totalDiGudang,
        pctGudang: po.jumlahTerbit > 0 ? Math.round((totalDiGudang / po.jumlahTerbit) * 100) : 0,
      }
    };
  });

  return NextResponse.json(poId ? (result[0] || null) : result);
}
