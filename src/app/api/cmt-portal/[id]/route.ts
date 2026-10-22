import { NextResponse } from "next/server";
import { readData } from "@/lib/data-store";
import { getCmtCompletion, getTransferCompletion, cmtReports, transferReports, isVendorTransferActive } from "@/lib/po-lifecycle";
import { isOpenPool, poolMatchesVendorType, poolAvailability, stageLabel } from "@/lib/pool-guard";
import { vendorOwnershipError, publicVendor } from "@/lib/auth";

// GET portal data for a specific CMT vendor
export async function GET(req: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  const data = readData();
  const params = await Promise.resolve(context.params);
  const vendorId = Number(params.id);

  // Vendor hanya boleh membuka portalnya sendiri (owner/admin boleh melihat semua)
  const authErr = vendorOwnershipError(req, vendorId);
  if (authErr) return NextResponse.json({ error: authErr }, { status: 401 });

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
      const pemotongan = (data.pemotongan_kain || []).find((pk: any) => String(pk.id) === String(po.pemotongan_id));
      const tp = pemotongan ? (data.tukang_potong || []).find((t: any) => t.id === pemotongan.tukang_potong_id) : null;
      const base = {
        ...po,
        no_po: po.noPo,          // alias for frontend
        nama_kain: po.nama_kain || pemotongan?.nama_barang || "-",
        jenis_jahitan: po.jenis_jahitan || pemotongan?.jenis_jahitan || "",
        tipe_benang: po.tipe_benang || pemotongan?.tipe_benang || "",
        tipe_resleting: po.tipe_resleting || pemotongan?.tipe_resleting || "",
        catatan_jahitan: po.catatan_jahitan || pemotongan?.catatan_jahitan || "",
        item_pendukung_used: po.item_pendukung_used || pemotongan?.item_pendukung_used || [],
        tukang_potong_nama: tp ? tp.nama : null,
        tukang_potong_kode: tp ? tp.kode : null,
        isi_per_bundle: pemotongan?.isi_per_bundle || 20,
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
      Number(t.vendor_id) === Number(vendorId) && (isVendorTransferActive(t) || t.status === "Selesai")
    );
    for (const t of myTransfers) {
      const po = (data.po_produksi || []).find((p: any) => p.id === t.po_id);
      const pemotongan = po ? (data.pemotongan_kain || []).find((pk: any) => String(pk.id) === String(po.pemotongan_id)) : null;
      const tp = pemotongan ? (data.tukang_potong || []).find((t: any) => t.id === pemotongan.tukang_potong_id) : null;
      const c = getTransferCompletion(data, t, now);
      const reports = transferReports(data, t);
      const originVendorNama = (() => {
        if (t.dari_vendor_id) {
          return (data.vendors || []).find((v: any) => v.id === Number(t.dari_vendor_id))?.nama || "";
        }
        if (t.transfer_id_asal) {
          const originTf = (data.produksi_transfers || []).find((x: any) => x.id === Number(t.transfer_id_asal));
          if (originTf?.vendor_id) {
            return (data.vendors || []).find((v: any) => v.id === Number(originTf.vendor_id))?.nama || "";
          }
        }
        if (po?.vendorId) {
          return (data.vendors || []).find((v: any) => v.id === Number(po.vendorId))?.nama || "";
        }
        return "";
      })();

      const base = {
        id: t.id,
        transfer_id: t.id,
        po_id: t.po_id,
        is_transfer: true,
        no_po: po ? po.noPo : "Unknown",
        noPo: po ? po.noPo : "Unknown",
        model: po ? po.model : "Unknown",
        nama_kain: po?.nama_kain || pemotongan?.nama_barang || "-",
        catatan: t.catatan || "",
        catatan_pengiriman: t.catatan || "",
        asal_tahap: t.dari || "",
        asal_vendor: originVendorNama,
        ke_tahap: t.ke || "",
        jenis_jahitan: po?.jenis_jahitan || pemotongan?.jenis_jahitan || "",
        tipe_benang: po?.tipe_benang || pemotongan?.tipe_benang || "",
        tipe_resleting: po?.tipe_resleting || pemotongan?.tipe_resleting || "",
        catatan_jahitan: po?.catatan_jahitan || pemotongan?.catatan_jahitan || "",
        item_pendukung_used: po?.item_pendukung_used || pemotongan?.item_pendukung_used || [],
        tukang_potong_nama: tp ? tp.nama : null,
        tukang_potong_kode: tp ? tp.kode : null,
        jumlah_terbit: c.jumlah,       // Total yang wajib dilaporkan vendor (dikirim − reject)
        jumlah_kirim: t.jumlah_kirim,
        jumlah_reject: Number(t.jumlah_reject || 0),
        totalDiambil: c.approved,      // Hanya yang sudah Diterima/ACC admin
        totalPending: c.pending,
        pct: c.jumlah > 0 ? Math.round((c.approved / c.jumlah) * 100) : 0,
        sizeBreakdown: (t.sizeBreakdown || []).map((s: any) => ({
          size: s.size,
          jumlah: Number(s.jumlah || s.max || 0),
          sisa: Number(s.jumlah || s.max || 0), // alias for display
        })),
        sizeProgress: sumSizes(reports.filter(isApproved)),
        pendingSizeProgress: sumSizes(reports.filter(isPending)),
        progres: [],
        transfer_status: t.status,
        is_rework: !!t.is_rework || t.status === "Retur Perbaikan",
        rework_count: t.rework_count || 1,
        alasan_retur: t.alasan_retur || "",
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

  // ── Helper Tarif Pcs Vendor ──
  const resolveTarif = (modelName?: string, customRate?: number) => {
    if (customRate && Number(customRate) > 0) return Number(customRate);
    if (modelName && vendor.tarifPotongan && vendor.tarifPotongan[modelName]) {
      return Number(vendor.tarifPotongan[modelName]);
    }
    return Number(vendor.hargaPerPcs || 5000);
  };

  // ── Realtime Hak Gaji Per Pekerjaan / PO ──
  const allVendorJobs = [...historiPO, ...activePO];

  const rincianGajiPerPo = allVendorJobs.map((job: any) => {
    const poId = job.po_id || job.id;
    const noPo = job.no_po || job.noPo || "PO";
    const model = job.model || "Umum";
    const targetPcs = Number(job.jumlah_terbit ?? job.jumlahTerbit ?? 0);
    const pcsSelesai = Number(job.totalDiambil || 0); // yang sudah di-ACC admin
    const pcsPending = Number(job.totalPending || 0); // menunggu ACC
    const tarifPerPcs = resolveTarif(model, job.hargaPerPcs);
    const subtotalHak = pcsSelesai * tarifPerPcs;
    const subtotalPending = pcsPending * tarifPerPcs;
    const estimasiTotal = targetPcs * tarifPerPcs;

    // Cek pembayaran tercatat di gaji_cmt untuk PO ini
    const poPayments = (data.gaji_cmt || []).filter(
      (g: any) => Number(g.cmtId) === Number(vendorId) && String(g.poId) === String(poId)
    );
    const paidForPo = poPayments.reduce(
      (sum: number, g: any) => sum + Number(g.dibayar ?? (g.status === "Lunas" ? (g.totalGaji || g.total || 0) : 0)),
      0
    );
    const sisaHak = Math.max(0, subtotalHak - paidForPo);

    let statusBayar = "Belum Ada Pcs";
    if (subtotalHak > 0) {
      if (paidForPo >= subtotalHak) {
        statusBayar = "Lunas";
      } else if (paidForPo > 0) {
        statusBayar = "Sebagian Dibayar";
      } else {
        statusBayar = job.tanggalSelesai || pcsSelesai >= targetPcs ? "Siap Cair" : "Akumulasi Berjalan";
      }
    }

    return {
      poId,
      jobId: job.id,
      noPo,
      model,
      targetPcs,
      pcsSelesai,
      pcsPending,
      tarifPerPcs,
      subtotalHak,
      subtotalPending,
      estimasiTotal,
      dibayar: paidForPo,
      sisaHak,
      statusBayar,
      isDone: !!job.tanggalSelesai || (targetPcs > 0 && pcsSelesai >= targetPcs),
      tanggalSelesai: job.tanggalSelesai || null,
      reportedAt: job.reportedAt || null,
    };
  });

  // ── Official Payout Slips dari data.gaji_cmt ──
  const officialSlips = (data.gaji_cmt || [])
    .filter((g: any) => Number(g.cmtId) === Number(vendorId))
    .map((g: any) => {
      const amt = Number(g.totalGaji ?? g.total ?? 0);
      const isLunas = g.status === "Lunas";
      const dibayar = Number(g.dibayar ?? (isLunas ? amt : 0));
      const sisaTagihan = Math.max(0, amt - dibayar);
      const matchedJob = allVendorJobs.find(
        (j: any) => String(j.id) === String(g.poId) || String(j.po_id) === String(g.poId)
      );
      const noPo = matchedJob ? (matchedJob.no_po || matchedJob.noPo) : (g.noPo || "-");
      const model = matchedJob ? matchedJob.model : (g.model || "-");

      return {
        ...g,
        id: g.id,
        isOfficial: true,
        isRealtime: false,
        noPo,
        model,
        total: amt,
        totalGaji: amt,
        dibayar,
        sisaTagihan,
        status: g.status || "Lunas",
        metode: g.metode || "Transfer Bank",
        keterangan: g.catatan || (matchedJob ? `Pembayaran Upah SPK ${noPo} (${model})` : `Slip Pembayaran #${g.id}`),
        tanggal: g.tanggal || new Date().toISOString(),
      };
    });

  // ── Unbilled Realtime Slips (Upah dari PO yang sudah dikerjakan tapi belum ada slip resmi gaji_cmt) ──
  const unbilledSlips = rincianGajiPerPo
    .filter((r: any) => r.pcsSelesai > 0 && r.sisaHak > 0 && !officialSlips.some((o: any) => String(o.poId) === String(r.poId)))
    .map((r: any) => ({
      id: `rt-po-${r.poId}`,
      poId: r.poId,
      noPo: r.noPo,
      model: r.model,
      isOfficial: false,
      isRealtime: true,
      keterangan: `Upah SPK ${r.noPo} (${r.model}) - ${r.pcsSelesai.toLocaleString("id-ID")} pcs`,
      jumlahPcs: r.pcsSelesai,
      targetPcs: r.targetPcs,
      tarifPerPcs: r.tarifPerPcs,
      total: r.subtotalHak,
      totalGaji: r.subtotalHak,
      dibayar: r.dibayar,
      sisaTagihan: r.sisaHak,
      status: r.isDone ? "Siap Cair" : "Akumulasi Berjalan",
      metode: "Transfer Bank",
      tanggal: r.tanggalSelesai || r.reportedAt || new Date().toISOString(),
      catatan: `${r.pcsSelesai.toLocaleString("id-ID")} pcs diverifikasi × Rp ${r.tarifPerPcs.toLocaleString("id-ID")}/pcs`,
    }));

  // Gabungkan semua slip gaji (slip resmi + slip real-time berjalan)
  const gaji = [...officialSlips, ...unbilledSlips].sort(
    (a: any, b: any) => new Date(b.tanggal || 0).getTime() - new Date(a.tanggal || 0).getTime()
  );

  // ── Ringkasan Akumulasi Hak & Hutang Gaji ──
  const totalHakGaji = rincianGajiPerPo.reduce((sum: number, r: any) => sum + r.subtotalHak, 0);
  const totalPendingGaji = rincianGajiPerPo.reduce((sum: number, r: any) => sum + r.subtotalPending, 0);
  const totalSudahDibayar = officialSlips.reduce((sum: number, g: any) => sum + Number(g.dibayar || 0), 0);
  const sisaHakGaji = Math.max(0, totalHakGaji - totalSudahDibayar);
  const totalTertunggak = sisaHakGaji;

  const ringkasanGaji = {
    totalHakGaji,
    totalPendingGaji,
    totalSudahDibayar,
    sisaHakGaji,
    totalTertunggak,
    totalPcsSelesai: rincianGajiPerPo.reduce((sum: number, r: any) => sum + r.pcsSelesai, 0),
    totalPcsPending: rincianGajiPerPo.reduce((sum: number, r: any) => sum + r.pcsPending, 0),
    tarifDasar: vendor.hargaPerPcs || 5000,
    tarifPotongan: vendor.tarifPotongan || {},
  };

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
    const standby = (data.produksi_transfers || []).filter((t: any) => isOpenPool(t) && poolMatchesVendorType(data, t, vendor.tipe));
    pemotonganReady = standby.map((t: any) => {
      const po = (data.po_produksi || []).find((x: any) => x.id === t.po_id);
      const avail = poolAvailability(data, t);
      const dariVendor = t.dari_vendor_id != null ? (data.vendors || []).find((v: any) => v.id === t.dari_vendor_id) : null;
      return {
        id: t.id,
        is_transfer: true,
        po_id: t.po_id,
        tanggal: t.tanggal_kirim,
        target_selesai: null,
        nama_barang: po ? po.noPo : "Unknown",
        model: po ? po.model : "Unknown",
        total_pcs: avail.total,
        sisa_total: avail.free,
        sisa_asli: avail.total,
        sizeBreakdown: avail.sizes,
        dari_tahap: stageLabel(data, t.dari),
        dari_vendor: dariVendor?.nama || null,
        last_change: t.last_change || null,
        rev: Number(t.rev || 0),
        pending_requests: avail.reservations.map((r) => ({ vendor_id: r.vendor_id, vendor_nama: r.vendor_nama, total_request: r.sisa, is_mine: String(r.vendor_id) === String(vendor.id) }))
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

  // Tagihan & Nota Reject Vendor
  const nota_reject = (data.nota_reject_vendor || []).filter(
    (n: any) =>
      String(n.vendor_id) === String(vendorId) ||
      (n.vendor_nama && vendor.nama && n.vendor_nama.trim().toLowerCase() === vendor.nama.trim().toLowerCase())
  );
  const totalKlaimReject = nota_reject.reduce((s: number, n: any) => s + Number(n.total_klaim || 0), 0);
  const totalKlaimLunas = nota_reject
    .filter((n: any) => n.status_klaim === "Lunas" || n.status_klaim === "Selesai")
    .reduce((s: number, n: any) => s + Number(n.nominal_dibayar || n.total_klaim || 0), 0);
  const totalKlaimTertunggak = Math.max(0, totalKlaimReject - totalKlaimLunas);

  return NextResponse.json({
    vendor: publicVendor(vendor),
    activePO,
    historiPO,
    gaji,
    totalTertunggak,
    ringkasanGaji,
    rincianGajiPerPo,
    requests,
    pemotonganReady,
    canRequest,
    blockInfo,
    kinerja,
    cmt_progres,
    nota_reject,
    totalKlaimReject,
    totalKlaimLunas,
    totalKlaimTertunggak,
  });
}
