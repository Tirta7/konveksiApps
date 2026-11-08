import { getCmtCompletion, getTransferCompletion, isVendorTransferActive } from "@/lib/po-lifecycle";

export interface VendorJobSalary {
  poId: number;
  jobId: number;
  isTransfer: boolean;
  noPo: string;
  model: string;
  targetPcs: number;
  pcsSelesai: number;
  pcsPending: number;
  tarifPerPcs: number;
  subtotalHak: number;
  subtotalPending: number;
  estimasiTotal: number;
  dibayar: number;
  sisaHak: number;
  statusBayar: "Belum Ada Pcs" | "Lunas" | "Sebagian Dibayar" | "Siap Cair" | "Akumulasi Berjalan";
  isDone: boolean;
  tanggalSelesai: string | null;
  reportedAt: string | null;
  statusPo: string;
}

export function resolveVendorTarif(vendor: any, modelName?: string, customRate?: number): number {
  if (customRate && Number(customRate) > 0) return Number(customRate);
  if (modelName && vendor?.tarifPotongan && vendor.tarifPotongan[modelName]) {
    return Number(vendor.tarifPotongan[modelName]);
  }
  return Number(vendor?.hargaPerPcs || 5000);
}

export function computeVendorSalarySummary(data: any, vendor: any, now: Date = new Date()) {
  const vendorId = Number(vendor.id);
  const isCmtVendor = vendor.tipe === "cmt" || vendor.tipe === "jahit" || !vendor.tipe;

  const jobsRaw: Omit<VendorJobSalary, "dibayar" | "sisaHak" | "statusBayar">[] = [];

  if (isCmtVendor) {
    const myPOs = (data.po_produksi || []).filter((po: any) => Number(po.vendorId) === vendorId);
    for (const po of myPOs) {
      const c = getCmtCompletion(data, po, now);
      const model = po.model || "Umum";
      const targetPcs = Number(po.jumlahTerbit || 0);
      const pcsSelesai = Number(c.approved || 0);
      const pcsPending = Number(c.pending || 0);
      const tarifPerPcs = resolveVendorTarif(vendor, model, po.hargaPerPcs);
      const subtotalHak = pcsSelesai * tarifPerPcs;
      const subtotalPending = pcsPending * tarifPerPcs;
      const estimasiTotal = targetPcs * tarifPerPcs;

      jobsRaw.push({
        poId: Number(po.id),
        jobId: Number(po.id),
        isTransfer: false,
        noPo: po.noPo || `PO-${po.id}`,
        model,
        targetPcs,
        pcsSelesai,
        pcsPending,
        tarifPerPcs,
        subtotalHak,
        subtotalPending,
        estimasiTotal,
        isDone: !!c.done,
        tanggalSelesai: c.selesaiAt || null,
        reportedAt: c.reportedAt || null,
        statusPo: c.done ? "Selesai" : po.status || "Dikerjakan",
      });
    }
  } else {
    const myTransfers = (data.produksi_transfers || []).filter(
      (t: any) => Number(t.vendor_id) === vendorId && (isVendorTransferActive(t) || t.status === "Selesai")
    );
    for (const t of myTransfers) {
      const po = (data.po_produksi || []).find((p: any) => Number(p.id) === Number(t.po_id));
      const c = getTransferCompletion(data, t, now);
      const model = po ? po.model : "Umum";
      const targetPcs = Number(c.jumlah || 0);
      const pcsSelesai = Number(c.approved || 0);
      const pcsPending = Number(c.pending || 0);
      const tarifPerPcs = resolveVendorTarif(vendor, model, t.hargaPerPcs);
      const subtotalHak = pcsSelesai * tarifPerPcs;
      const subtotalPending = pcsPending * tarifPerPcs;
      const estimasiTotal = targetPcs * tarifPerPcs;

      jobsRaw.push({
        poId: Number(t.po_id || t.id),
        jobId: Number(t.id),
        isTransfer: true,
        noPo: po ? po.noPo : `TF-${t.id}`,
        model,
        targetPcs,
        pcsSelesai,
        pcsPending,
        tarifPerPcs,
        subtotalHak,
        subtotalPending,
        estimasiTotal,
        isDone: !!c.done,
        tanggalSelesai: c.selesaiAt || null,
        reportedAt: c.reportedAt || null,
        statusPo: c.done ? "Selesai" : t.status || "Dikerjakan",
      });
    }
  }

  // Ambil semua catatan pembayaran gaji_cmt milik vendor ini
  const rawGajiVendor = (data.gaji_cmt || []).filter((g: any) => Number(g.cmtId) === vendorId);

  // Hitung pembayaran per record (mendukung pembayaran tunai/transfer positif & potongan klaim reject)
  const effectivePaidOf = (g: any): number => {
    const rawTotal = Number(g.totalGaji ?? g.total ?? 0);
    if (g.metode === "potong_klaim" || rawTotal < 0) {
      return Math.abs(rawTotal);
    }
    const isLunas = (g.status || "Lunas") === "Lunas";
    return Number(g.dibayar ?? (isLunas ? rawTotal : 0));
  };

  // Alokasi pembayaran ke masing-masing PO/Job:
  // 1) Alokasi langsung ke PO yang cocok (berdasarkan poId / po_id / noPo)
  // 2) Sisa pembayaran atau pembayaran umum (tanpa poId) dialokasikan secara FIFO ke PO yang punya subtotalHak
  const allocatedByJobIdx = new Array(jobsRaw.length).fill(0);
  let unallocatedPool = 0;

  for (const g of rawGajiVendor) {
    const paidAmt = effectivePaidOf(g);
    if (paidAmt <= 0) continue;

    const targetPoId = g.poId ?? g.po_id ?? null;
    const targetNoPo = g.noPo && g.noPo !== "-" ? String(g.noPo).trim().toUpperCase() : null;

    let matchedIdx = -1;
    if (targetPoId != null && String(targetPoId) !== "") {
      matchedIdx = jobsRaw.findIndex(
        (j) => String(j.jobId) === String(targetPoId) || String(j.poId) === String(targetPoId)
      );
    }
    if (matchedIdx === -1 && targetNoPo) {
      matchedIdx = jobsRaw.findIndex((j) => String(j.noPo).trim().toUpperCase() === targetNoPo);
    }

    if (matchedIdx !== -1) {
      const job = jobsRaw[matchedIdx];
      const needed = Math.max(0, job.subtotalHak - allocatedByJobIdx[matchedIdx]);
      const apply = Math.min(paidAmt, needed);
      allocatedByJobIdx[matchedIdx] += apply;
      unallocatedPool += paidAmt - apply;
    } else {
      unallocatedPool += paidAmt;
    }
  }

  // Distribusi FIFO untuk unallocatedPool (urut dari PO yang sudah selesai / lama ke baru)
  const fifoOrder = jobsRaw
    .map((j, idx) => ({ j, idx }))
    .sort((a, b) => {
      if (a.j.isDone !== b.j.isDone) return a.j.isDone ? -1 : 1;
      return a.j.poId - b.j.poId;
    });

  for (const { j, idx } of fifoOrder) {
    if (unallocatedPool <= 0) break;
    const needed = Math.max(0, j.subtotalHak - allocatedByJobIdx[idx]);
    if (needed <= 0) continue;
    const apply = Math.min(unallocatedPool, needed);
    allocatedByJobIdx[idx] += apply;
    unallocatedPool -= apply;
  }

  const rincianGajiPerPo: VendorJobSalary[] = jobsRaw.map((j, idx) => {
    const dibayar = allocatedByJobIdx[idx];
    const sisaHak = Math.max(0, j.subtotalHak - dibayar);
    let statusBayar: VendorJobSalary["statusBayar"] = "Belum Ada Pcs";
    if (j.subtotalHak > 0) {
      if (dibayar >= j.subtotalHak) {
        statusBayar = "Lunas";
      } else if (dibayar > 0) {
        statusBayar = "Sebagian Dibayar";
      } else {
        statusBayar = j.isDone ? "Siap Cair" : "Akumulasi Berjalan";
      }
    }
    return {
      ...j,
      dibayar,
      sisaHak,
      statusBayar,
    };
  });

  // Breakdown per Kategori / Model
  const categoryBreakdown: Record<
    string,
    { pcs: number; gaji: number; dibayar: number; sisa: number; tarif: number }
  > = {};
  for (const r of rincianGajiPerPo) {
    if (r.pcsSelesai <= 0) continue;
    const kat = r.model || "Umum";
    if (!categoryBreakdown[kat]) {
      categoryBreakdown[kat] = { pcs: 0, gaji: 0, dibayar: 0, sisa: 0, tarif: r.tarifPerPcs };
    }
    categoryBreakdown[kat].pcs += r.pcsSelesai;
    categoryBreakdown[kat].gaji += r.subtotalHak;
    categoryBreakdown[kat].dibayar += r.dibayar;
    categoryBreakdown[kat].sisa += r.sisaHak;
  }

  // Enrich official slips (data.gaji_cmt)
  const officialSlips = rawGajiVendor
    .map((g: any) => {
      const rawTotal = Number(g.totalGaji ?? g.total ?? 0);
      const isPotongKlaim = g.metode === "potong_klaim" || rawTotal < 0;
      const amt = Math.abs(rawTotal);
      const dibayar = effectivePaidOf(g);
      const sisaTagihan = Math.max(0, amt - dibayar);
      const targetPoId = g.poId ?? g.po_id;
      const matchedJob = rincianGajiPerPo.find(
        (j) => String(j.jobId) === String(targetPoId) || String(j.poId) === String(targetPoId)
      );
      const noPo = matchedJob ? matchedJob.noPo : g.noPo || "-";
      const model = matchedJob ? matchedJob.model : g.model || "-";

      return {
        ...g,
        id: g.id,
        isOfficial: true,
        isRealtime: false,
        isPotongKlaim,
        poId: targetPoId || null,
        noPo,
        model,
        vendor_nama: vendor.nama,
        vendor_kode: vendor.kodeVendor || `CMT-${vendor.id}`,
        total: amt,
        totalGaji: isPotongKlaim ? -amt : amt,
        dibayar,
        sisaTagihan,
        status: g.status || "Lunas",
        metode: isPotongKlaim ? "Potong Tagihan Klaim" : g.metode || "Transfer Bank",
        keterangan:
          g.catatan ||
          (matchedJob && noPo !== "-"
            ? `Pembayaran Upah SPK ${noPo} (${model})`
            : `Pembayaran Upah ${vendor.nama} #${g.id}`),
        tanggal: g.tanggal || new Date().toISOString(),
      };
    })
    .sort((a: any, b: any) => new Date(b.tanggal || 0).getTime() - new Date(a.tanggal || 0).getTime());

  // Unbilled Realtime Slips: hanya untuk PO yang masih punya sisaHak > 0
  const unbilledSlips = rincianGajiPerPo
    .filter((r) => r.pcsSelesai > 0 && r.sisaHak > 0)
    .map((r) => ({
      id: `rt-po-${r.jobId}`,
      poId: r.poId,
      jobId: r.jobId,
      noPo: r.noPo,
      model: r.model,
      isOfficial: false,
      isRealtime: true,
      keterangan:
        r.dibayar > 0
          ? `Sisa Upah SPK ${r.noPo} (${r.model}) - ${r.pcsSelesai.toLocaleString("id-ID")} pcs`
          : `Upah SPK ${r.noPo} (${r.model}) - ${r.pcsSelesai.toLocaleString("id-ID")} pcs`,
      jumlahPcs: r.pcsSelesai,
      targetPcs: r.targetPcs,
      tarifPerPcs: r.tarifPerPcs,
      total: r.sisaHak,
      totalGaji: r.subtotalHak,
      dibayar: r.dibayar,
      sisaTagihan: r.sisaHak,
      status: r.statusBayar,
      metode: "Transfer Bank",
      tanggal: r.tanggalSelesai || r.reportedAt || new Date().toISOString(),
      catatan:
        r.dibayar > 0
          ? `Hak Rp ${r.subtotalHak.toLocaleString("id-ID")} · Sudah cair Rp ${r.dibayar.toLocaleString("id-ID")} · Sisa Rp ${r.sisaHak.toLocaleString("id-ID")}`
          : `${r.pcsSelesai.toLocaleString("id-ID")} pcs diverifikasi × Rp ${r.tarifPerPcs.toLocaleString("id-ID")}/pcs`,
    }));

  const combinedSlips = [...officialSlips, ...unbilledSlips].sort(
    (a: any, b: any) => new Date(b.tanggal || 0).getTime() - new Date(a.tanggal || 0).getTime()
  );

  const totalPcsSelesai = rincianGajiPerPo.reduce((s, r) => s + r.pcsSelesai, 0);
  const totalPcsPending = rincianGajiPerPo.reduce((s, r) => s + r.pcsPending, 0);
  const totalTargetPcs = rincianGajiPerPo.reduce((s, r) => s + r.targetPcs, 0);
  const totalHakGaji = rincianGajiPerPo.reduce((s, r) => s + r.subtotalHak, 0);
  const totalPendingGaji = rincianGajiPerPo.reduce((s, r) => s + r.subtotalPending, 0);

  const totalPotonganKlaim = officialSlips
    .filter((g: any) => g.isPotongKlaim)
    .reduce((s: number, g: any) => s + Number(g.dibayar || 0), 0);
  const totalTransferDibayar = officialSlips
    .filter((g: any) => !g.isPotongKlaim)
    .reduce((s: number, g: any) => s + Number(g.dibayar || 0), 0);
  const totalSudahDibayar = totalTransferDibayar + totalPotonganKlaim;
  const sisaHakGaji = Math.max(0, totalHakGaji - totalSudahDibayar);
  const kelebihanBayar = Math.max(0, totalSudahDibayar - totalHakGaji);

  const statusPembayaran =
    totalHakGaji === 0 && totalSudahDibayar === 0
      ? "Belum Ada Tagihan"
      : sisaHakGaji <= 0
      ? "Lunas"
      : totalSudahDibayar > 0
      ? "Sebagian Dibayar"
      : "Belum Dibayar";

  return {
    vendorId,
    vendorNama: vendor.nama,
    kodeVendor: vendor.kodeVendor || `CMT-${vendor.id}`,
    tipe: vendor.tipe || "cmt",
    jenisDefault: vendor.jenis_default || "Jahit",
    kontak: vendor.kontak || "",
    tarifDasar: Number(vendor.hargaPerPcs || 5000),
    tarifPotongan: vendor.tarifPotongan || {},
    hasKhusus: Boolean(vendor.tarifPotongan && Object.keys(vendor.tarifPotongan).length > 0),
    totalPcsSelesai,
    totalPcsPending,
    totalTargetPcs,
    totalHakGaji,
    totalPendingGaji,
    totalTransferDibayar,
    totalPotonganKlaim,
    totalSudahDibayar,
    sisaHakGaji,
    kelebihanBayar,
    statusPembayaran,
    rincianGajiPerPo,
    categoryBreakdown,
    officialSlips,
    unbilledSlips,
    combinedSlips,
  };
}

export function computeAllVendorsSalarySummary(data: any, now: Date = new Date()) {
  const vendors = data.vendors || [];
  return vendors.map((v: any) => computeVendorSalarySummary(data, v, now));
}

