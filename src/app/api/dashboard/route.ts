import { NextResponse } from "next/server";
import { readData } from "@/lib/data-store";
import { getCmtCompletion, getTransferCompletion, cmtReports, isVendorTransferActive } from "@/lib/po-lifecycle";
import { getStockInbound, getVendorWip, getPoStockProgress, vendorStageSummary } from "@/lib/stock";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = readData();
    const po_produksi = data.po_produksi || [];
    const vendors = data.vendors || [];
    const cmt_progres = data.cmt_progres || [];
    const produksi_transfers = data.produksi_transfers || [];
    const pemotongan_kain = data.pemotongan_kain || [];

    // Posisi barang riil per PO (sumber yang sama dengan Gudang & Alur Produksi):
    //  - masuk  : pcs yang sudah masuk Gudang & Stok (stock_movements "masuk")
    //  - reject : pcs yang di-reject (stock_movements "reject")
    //  - antre  : sudah selesai proses, menunggu diterima gudang
    //  - di_vendor : masih dikerjakan / dikirim ke vendor lanjutan
    // Catatan: po_ledgers GUDANG tidak dipakai lagi karena ACC → gudang dan penarikan
    // kembali ke gudang tercatat dua kali (menyebabkan angka ganda, mis. 1000 dari 500).
    const inbound = getStockInbound(data);
    const wip = getVendorWip(data);
    const progressMap: Record<string, any> = {};
    for (const p of getPoStockProgress(data, inbound, wip)) progressMap[String(p.po_id)] = p;

    const terjualMap: Record<string, number> = {};
    for (const b of (data.barcode_item || [])) {
      if (b.status === "terjual") terjualMap[String(b.poId)] = (terjualMap[String(b.poId)] || 0) + 1;
    }

    // Enrich po_produksi dengan progress
    const poList = po_produksi.map((po: any) => {
      const vendor = vendors.find((v: any) => v.id === po.vendorId);
      const pemotongan = pemotongan_kain.find((p: any) => p.id === po.pemotongan_id);

      // CMT Progress (hanya laporan CMT pemegang PO, bukan laporan washing/vendor lanjutan)
      const cmt = getCmtCompletion(data, po);
      const cmtRecords = cmtReports(data, po).filter((p: any) => p.status !== "Ditolak");
      const totalDilaporkan = cmtRecords.reduce((s: number, r: any) =>
        s + (r.items || []).reduce((s2: number, i: any) => s2 + Number(i.jumlah || 0), 0), 0);
      const totalDisetujui = cmt.approved;

      // Washing (hanya transfer ke vendor washing, pool ACC tidak dihitung)
      const washSum = vendorStageSummary(data, po.id, "washing");
      const totalWashing = washSum.kirim;
      const totalWashingDone = washSum.approved;

      // Posisi barang riil
      const terbit = Number(po.jumlahTerbit || 0);
      const prog = progressMap[String(po.id)] || { masuk: 0, reject: 0, antre: 0, di_vendor: 0 };
      const totalDiGudang = Number(prog.masuk || 0);
      const totalReject = Number(prog.reject || 0);
      const totalAntre = Number(prog.antre || 0);
      const totalDiVendor = Number(prog.di_vendor || 0);
      const totalTerjual = terjualMap[String(po.id)] || 0;
      // Sisa yang belum keluar dari CMT (belum dijahit / belum di-ACC)
      const totalDiCmt = Math.max(0, terbit - totalDiGudang - totalReject - totalAntre - totalDiVendor);

      const vendorPosisi = wip
        .filter((w: any) => String(w.po_id) === String(po.id))
        .map((w: any) => {
          const t = produksi_transfers.find((x: any) => x.id === w.transfer_id);
          const dikerjakan = t?.status === "Dikerjakan" || !!t?.mulai_kerja_at;
          return {
            transfer_id: w.transfer_id,
            vendor_nama: w.vendor_nama,
            tahap: w.tahap,
            jumlah: w.sisa,
            status: dikerjakan ? "dikerjakan" : "dikirim",
            lateDays: w.lateDays || 0,
          };
        });

      const pct = (n: number) => (terbit > 0 ? Math.min(100, Math.round((n / terbit) * 100)) : 0);
      const pctCMT = pct(totalDilaporkan);
      const pctDisetujui = pct(totalDisetujui);
      const pctGudang = pct(totalDiGudang);

      let stage = "menunggu";
      let stageLabel = "";
      if (terbit > 0 && totalDiGudang + totalReject >= terbit) stage = "selesai";
      else if (totalDiVendor > 0) {
        stage = "vendor";
        const tahapSet = Array.from(new Set(vendorPosisi.map((v: any) => v.tahap).filter(Boolean)));
        stageLabel = tahapSet.length ? `Proses ${tahapSet.join(" & ")}` : "Proses Vendor";
      }
      else if (totalAntre > 0) stage = "antre-gudang";
      else if (totalDiGudang > 0) stage = "sebagian-gudang";
      else if (totalDisetujui > 0) stage = "siap-tarik";
      else if (totalDilaporkan > 0) stage = "dijahit";

      // Target Selesai & Overdue Check (aturan terpusat di lib/po-lifecycle)
      //  - isOverdue  : CMT masih mengerjakan & melewati target (hitungan berjalan)
      //  - CMT selesai/terlapor penuh → hitungan berhenti, keterlambatan dibekukan
      const targetSelesai = cmt.target;
      const isOverdue = stage !== "selesai" && cmt.isOverdue;
      const overdueDays = cmt.lateDays;

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
        cmtSelesai: cmt.done,
        cmtSelesaiAt: cmt.selesaiAt,
        cmtMenungguAcc: cmt.waitingAcc,
        cmtTerlambatHari: cmt.done || cmt.waitingAcc ? cmt.lateDays : 0,
        cmtTepatWaktu: cmt.onTime,
        totalDilaporkan,
        totalDisetujui,
        totalWashing,
        totalWashingDone,
        totalDiGudang,
        totalReject,
        totalAntre,
        totalDiVendor,
        totalDiCmt,
        totalTerjual,
        vendorPosisi,
        sisaPcs: Math.max(0, terbit - totalDiGudang - totalReject),
        pctCMT,
        pctDisetujui,
        pctGudang,
        pctReject: pct(totalReject),
        pctAntre: pct(totalAntre),
        pctVendor: pct(totalDiVendor),
        stage,
        stageLabel,
        sizeBreakdown: po.sizeBreakdown || [],
      };
    });

    // Statistik ringkasan
    const poAktif = poList.filter((p: any) => p.stage !== "selesai").length;
    const poSelesai = poList.filter((p: any) => p.stage === "selesai").length;
    const totalDiGudangSemua = poList.reduce((s: any, p: any) => s + p.totalDiGudang, 0);
    const totalPCS = poList.reduce((s: any, p: any) => s + p.jumlahTerbit, 0);

    // Keterlambatan PO & Vendor
    // 1) CMT yang masih mengerjakan & lewat target
    const cmtOverdue = poList
      .filter((p: any) => p.isOverdue)
      .map((p: any) => ({ ...p, alertKey: `po-${p.id}`, tahap: "CMT / Jahit" }));

    // 2) Vendor lanjutan (washing, finishing, dll) yang lewat target transfer-nya
    const downstreamOverdue = produksi_transfers
      .filter((t: any) => isVendorTransferActive(t))
      .map((t: any) => {
        const c = getTransferCompletion(data, t);
        if (!c.isOverdue) return null;
        const po = po_produksi.find((p: any) => p.id === t.po_id);
        const v = vendors.find((x: any) => x.id === t.vendor_id);
        return {
          id: po?.id ?? t.po_id,
          alertKey: `tf-${t.id}`,
          tahap: v?.tipe ? String(v.tipe).replace(/^\w/, (m: string) => m.toUpperCase()) : (t.ke || "Vendor"),
          noPo: po?.noPo || "-",
          model: po?.model || "-",
          vendorId: t.vendor_id,
          vendor_nama: v?.nama || "Vendor",
          vendor_tipe: v?.tipe || t.ke,
          vendor_kontak: v?.kontak || v?.no_hp || "",
          target_selesai: c.target,
          overdueDays: c.lateDays,
          isOverdue: true,
          sisaPcs: c.sisa,
          pctGudang: c.jumlah > 0 ? Math.round((c.approved / c.jumlah) * 100) : 0,
        };
      })
      .filter(Boolean) as any[];

    const overdueList = [...cmtOverdue, ...downstreamOverdue]
      .sort((a: any, b: any) => b.overdueDays - a.overdueDays);
    const totalPoTerlambat = new Set(overdueList.map((o: any) => o.id)).size;

    // Vendor aktif dengan PO & status keterlambatan
    const vendorAktifIds = new Set(poList.filter((po: any) => po.stage !== "selesai").map((po: any) => po.vendorId));

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
