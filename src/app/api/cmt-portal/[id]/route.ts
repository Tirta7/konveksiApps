import { NextResponse } from "next/server";
import { readData } from "@/lib/data-store";
import { getCmtCompletion, getTransferCompletion, cmtReports, transferReports, isVendorTransferActive } from "@/lib/po-lifecycle";

// GET portal data for a specific CMT vendor
export async function GET(req: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  const data = readData();
  const params = await Promise.resolve(context.params);
  const vendorId = Number(params.id);

  const vendor = (data.vendors || []).find((v: any) => v.id === vendorId);
  if (!vendor) {
    return NextResponse.json({ error: "CMT tidak ditemukan" }, { status: 404 });
  }

  const now = new Date();
  const sumSizes = (records: any[]) => {
    const out: Record<string, number> = {};
    for (const rec of records) {
      for (const item of (rec.items || [])) {
        out[item.size] = (out[item.size] || 0) + Number(item.jumlah || 0);
      }
    }
    return out;
  };
  const isApproved = (p: any) => p.status === "Diverifikasi" || p.status === "selesai" || p.status === "Diterima";
  const isPending = (p: any) => p.status === "Menunggu" || p.status === "Pending";

  // PO aktif: po_produksi (CMT) atau produksi_transfers (vendor lanjutan) yang masih berjalan
  let activePO: any[] = [];
  let historiPO: any[] = [];
  const isCmtVendor = vendor.tipe === "cmt" || vendor.tipe === "jahit";

  if (isCmtVendor) {
    const myPOs = (data.po_produksi || []).filter((po: any) => po.vendorId === vendorId);
    for (const po of myPOs) {
      const c = getCmtCompletion(data, po, now);
      const reports = cmtReports(data, po);
      const base = {
        ...po,
        no_po: po.noPo,          // alias for frontend
        jumlah_terbit: po.jumlahTerbit,
        totalDiambil: c.approved,
        totalPending: c.pending,
        pct: po.jumlahTerbit > 0 ? Math.round((c.approved / po.jumlahTerbit) * 100) : 0,
        sizeProgress: sumSizes(reports.filter(isApproved)),
        pendingSizeProgress: sumSizes(reports.filter(isPending)),
        progres: (data.spk_progres || []).filter((p: any) => p.po_id === po.id),
        transfer_status: po.status,
        targetSelesai: c.target,
        overdueDays: c.lateDays,
        isOverdue: c.isOverdue,
        waitingAcc: c.waitingAcc,
        reportedAt: c.reportedAt,
      };
      if (c.done) {
        historiPO.push({
          ...base,
          tanggalSelesai: c.selesaiAt,
          terlambatHari: c.lateDays,
          tepatWaktu: c.lateDays === 0,
        });
      } else {
        activePO.push(base);
      }
    }
  } else {
    // Vendor downstream (Washing, Finishing, dll) — job di produksi_transfers
    const myTransfers = (data.produksi_transfers || []).filter((t: any) =>
      t.vendor_id === vendorId && (isVendorTransferActive(t) || t.status === "Selesai")
    );
    for (const t of myTransfers) {
      const po = (data.po_produksi || []).find((p: any) => p.id === t.po_id);
      const c = getTransferCompletion(data, t, now);
      const reports = transferReports(data, t);
      const base = {
        id: t.id,
        po_id: t.po_id,
        is_transfer: true,
        no_po: po ? po.noPo : "Unknown",
        noPo: po ? po.noPo : "Unknown",
        model: po ? po.model : "Unknown",
        jumlah_terbit: t.jumlah_kirim, // Total yang ditugaskan ke vendor ini
        totalDiambil: c.approved,      // Hanya yang sudah Diterima/ACC admin
        totalPending: c.pending,
        pct: t.jumlah_kirim > 0 ? Math.round((c.approved / t.jumlah_kirim) * 100) : 0,
        sizeBreakdown: (t.sizeBreakdown || []).map((s: any) => ({
          size: s.size,
          jumlah: Number(s.jumlah || s.max || 0),
          sisa: Number(s.jumlah || s.max || 0), // alias for display
        })),
        sizeProgress: sumSizes(reports.filter(isApproved)),
        pendingSizeProgress: sumSizes(reports.filter(isPending)),
        progres: [],
        transfer_status: t.status,
        targetSelesai: c.target,
        overdueDays: c.lateDays,
        isOverdue: c.isOverdue,
        waitingAcc: c.waitingAcc,
        reportedAt: c.reportedAt,
      };
      if (c.done) {
        historiPO.push({ ...base, tanggalSelesai: c.selesaiAt, terlambatHari: c.lateDays, tepatWaktu: c.lateDays === 0 });
      } else {
        activePO.push(base);
      }
    }
  }

  // Riwayat selesai (terbaru dulu)
  historiPO = historiPO
    .sort((a: any, b: any) => new Date(b.tanggalSelesai || 0).getTime() - new Date(a.tanggalSelesai || 0).getTime())
    .slice(0, 50);

  // Gaji / Tagihan
  const gaji = (data.gaji_cmt || [])
    .filter((g: any) => g.cmtId === vendorId)
    .map((g: any) => {
      const amt = Number(g.totalGaji ?? g.total ?? 0);
      const dibayar = Number(g.dibayar ?? 0);
      return {
        ...g,
        total: amt,
        totalGaji: amt,
        dibayar,
        sisaTagihan: Math.max(0, amt - dibayar)
      };
    })
    .slice().reverse();

  const totalTertunggak = gaji.filter((g: any) => g.status !== "Lunas")
    .reduce((sum: number, g: any) => sum + (Number(g.total || 0) - Number(g.dibayar || 0)), 0);

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

    // Dinamis: Ambil Kerjaan Standby sesuai Tipe Vendor
  let pemotonganReady = [];
  if (vendor.tipe === "cmt" || vendor.tipe === "jahit") {
    pemotonganReady = (data.pemotongan_kain || [])
      .filter((p: any) => p.status !== "Draft" && p.sizeBreakdown.some((s: any) => (s.sisa || 0) > 0))
      .map((p: any) => {
        const pendingReqsForP = (data.cmt_requests || []).filter((r: any) => String(r.pemotongan_id) === String(p.id) && r.status === "Pending");
        const totalPendingReqPcs = pendingReqsForP.reduce((sum: number, r: any) => sum + (Number(r.total_request) || 0), 0);
        const originalSisaTotal = p.sizeBreakdown.reduce((s: number, x: any) => s + (x.sisa || 0), 0);
        const effectiveSisaTotal = Math.max(0, originalSisaTotal - totalPendingReqPcs);
        return {
          id: p.id,
          tanggal: p.tanggal,
          target_selesai: p.target_selesai || null,
          nama_barang: p.nama_barang,
          model: p.model,
          total_pcs: p.total_pcs,
          sisa_total: effectiveSisaTotal,
          sisa_asli: originalSisaTotal,
          sizeBreakdown: p.sizeBreakdown,
          pending_requests: pendingReqsForP.map((r: any) => {
            const cmt = (data.vendors || []).find((v: any) => v.id === r.vendor_id);
            return { vendor_nama: cmt ? cmt.nama : "Unknown", total_request: r.total_request };
          })
        };
      })
      .filter((p: any) => p.sisa_total > 0 || p.pending_requests.length > 0)
      .sort((a: any, b: any) => b.sisa_total - a.sisa_total);
  } else {
    // Vendor downstream (Washing, Finishing, dll) mencari di produksi_transfers (Standby Pool)
    const standby = (data.produksi_transfers || []).filter((t: any) => t.ke === vendor.tipe && !t.vendor_id);
    pemotonganReady = standby.map((t: any) => {
      const po = (data.po_produksi || []).find((x: any) => x.id === t.po_id);
      const pendingReqsForT = (data.cmt_requests || []).filter((r: any) => String(r.transfer_id) === String(t.id) && r.status === "Pending");
      const totalPendingReqPcs = pendingReqsForT.reduce((sum: number, r: any) => sum + (Number(r.total_request) || 0), 0);
      const originalSisaTotal = t.jumlah_kirim;
      const effectiveSisaTotal = Math.max(0, originalSisaTotal - totalPendingReqPcs);
      return {
        id: t.id,
        is_transfer: true,
        po_id: t.po_id,
        tanggal: t.tanggal_kirim,
        target_selesai: null,
        nama_barang: po ? po.noPo : "Unknown",
        model: po ? po.model : "Unknown",
        total_pcs: originalSisaTotal,
        sisa_total: effectiveSisaTotal,
        sisa_asli: originalSisaTotal,
        sizeBreakdown: t.sizeBreakdown || [],
        pending_requests: pendingReqsForT.map((r: any) => {
          const v = (data.vendors || []).find((v: any) => v.id === r.vendor_id);
          return { vendor_nama: v ? v.nama : "Unknown", total_request: r.total_request };
        })
      };
    }).filter((p: any) => p.sisa_total > 0 || p.pending_requests.length > 0)
      .sort((a: any, b: any) => b.sisa_total - a.sisa_total);
  }

  // === SMART TRACKING: Hitung progress keseluruhan vendor ini ===
  // Hanya pekerjaan yang MASIH BERJALAN. Pekerjaan yang sudah selesai (walau terlambat)
  // tidak lagi menambah penalti — keterlambatannya tercatat permanen di Riwayat Kinerja.
  const allActivePOs = activePO;

  let totalJumlahTerbit = 0;
  let totalApprovedDone = 0;
  let maxOverdueDays = 0;
  const overduePoList: { noPo: string; model: string; targetSelesai: string; overdueDays: number }[] = [];

  for (const po of allActivePOs) {
    totalJumlahTerbit += Number(po.jumlah_terbit ?? po.jumlahTerbit ?? 0);
    totalApprovedDone += Number(po.totalDiambil || 0);
    // Throttle hanya untuk yang hitungan terlambatnya masih berjalan (belum semua dilaporkan)
    if (po.isOverdue) {
      maxOverdueDays = Math.max(maxOverdueDays, po.overdueDays);
      overduePoList.push({
        noPo: po.no_po || po.noPo,
        model: po.model,
        targetSelesai: po.targetSelesai,
        overdueDays: po.overdueDays,
      });
    }
  }

  const overallPct = totalJumlahTerbit > 0 ? Math.round((totalApprovedDone / totalJumlahTerbit) * 100) : 0;
  const baseMinPct = vendor.min_progress_pct ?? 70;
  // Throttle penalty: min_progress_pct INCREASES by 1% per overdue day (harder to request)
  const throttlePenalty = maxOverdueDays; // 1% per day
  const effectiveMinPct = Math.min(100, baseMinPct + throttlePenalty);
  const hasActivePO = allActivePOs.length > 0;

  const canRequest = !hasActivePO || effectiveMinPct === 0 || overallPct >= effectiveMinPct;

  // Ringkasan kinerja ketepatan waktu (dari riwayat selesai)
  const selesaiTepat = historiPO.filter((h: any) => h.tepatWaktu).length;
  const selesaiTerlambat = historiPO.length - selesaiTepat;
  const kinerja = {
    totalSelesai: historiPO.length,
    tepatWaktu: selesaiTepat,
    terlambat: selesaiTerlambat,
    pctTepatWaktu: historiPO.length > 0 ? Math.round((selesaiTepat / historiPO.length) * 100) : 100,
    rataTerlambatHari: selesaiTerlambat > 0
      ? Math.round(historiPO.filter((h: any) => !h.tepatWaktu).reduce((s: number, h: any) => s + (h.terlambatHari || 0), 0) / selesaiTerlambat)
      : 0,
  };

  const blockInfo = {
    blocked: !canRequest,
    overallPct,
    baseMinPct,
    effectiveMinPct,
    throttlePenalty,
    maxOverdueDays,
    overduePoList,
    totalJumlahTerbit,
    totalApprovedDone,
    neededPcs: !canRequest ? Math.max(0, Math.ceil((effectiveMinPct / 100) * totalJumlahTerbit) - totalApprovedDone) : 0,
  };

  const cmt_progres = (data.cmt_progres || [])
    .filter((p: any) => String(p.vendor_id) === String(vendorId))
    .slice().reverse();

  return NextResponse.json({
    vendor,
    activePO,
    historiPO,
    gaji,
    totalTertunggak,
    requests,
    pemotonganReady,
    canRequest,
    blockInfo,
    kinerja,
    cmt_progres
  });
}
