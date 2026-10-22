/**
 * PO Lifecycle — satu sumber kebenaran untuk status pengerjaan & keterlambatan vendor.
 *
 * Aturan (dipakai SEMUA endpoint: dashboard, portal vendor, alur produksi, atur vendor):
 *  - Target selesai PO  = po.target_selesai || pemotongan.target_selesai
 *  - Toleransi 1 hari setelah target, lalu dihitung +1 hari terlambat per hari.
 *  - Hitungan keterlambatan BERHENTI saat vendor sudah melaporkan seluruh jumlah
 *    (tanggal laporan terakhir yang menggenapi jumlah). Jika laporan ditolak, hitungan lanjut lagi.
 *  - Setelah seluruh jumlah di-ACC admin → pekerjaan vendor "Selesai":
 *      po.cmt_status = "Selesai", po.cmt_selesai_at, po.cmt_terlambat_hari (dibekukan), po.cmt_tepat_waktu
 *    PO pindah ke Riwayat Kinerja vendor, throttle/penalti hilang, vendor bisa minta kerjaan lagi.
 *  - Vendor lanjutan (washing, finishing, dll) memakai aturan yang sama per produksi_transfer.
 */

import { transferTargetStage, isGudangStage } from "@/lib/stage-resolve";

const DAY_MS = 24 * 60 * 60 * 1000;
const APPROVED = new Set(["Diterima", "Diverifikasi", "selesai"]);
const PENDING = new Set(["Menunggu", "Pending"]);
export const REPORT_APPROVED = APPROVED;
export const REPORT_PENDING = PENDING;
const ACTIVE_TRANSFER = new Set(["Kirim", "Dikirim", "Proses", "Dikerjakan", "Pending", "Diterima"]);

export function startOfDay(d: Date | string): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Hari keterlambatan terhadap target (toleransi 1 hari) pada tanggal `at`. */
export function lateDaysAt(target: string | null | undefined, at: Date | string = new Date()): number {
  if (!target) return 0;
  const grace = startOfDay(target);
  if (isNaN(grace.getTime())) return 0;
  grace.setDate(grace.getDate() + 1);
  const t = startOfDay(at);
  return t > grace ? Math.floor((t.getTime() - grace.getTime()) / DAY_MS) : 0;
}

const qtyOf = (r: any): number => {
  const items = r?.items || [];
  if (items.length) return items.reduce((s: number, i: any) => s + Number(i.jumlah || 0), 0);
  return Number(r?.totalJumlah || 0);
};

const byCreated = (a: any, b: any) =>
  new Date(a.createdAt || a.diterimaPada || 0).getTime() - new Date(b.createdAt || b.diterimaPada || 0).getTime();

/** Cari laporan yang menggenapi jumlah target (kumulatif urut waktu lapor). */
function reachingRecord(records: any[], target: number): any | null {
  if (target <= 0) return null;
  let cum = 0;
  for (const r of [...records].sort(byCreated)) {
    cum += qtyOf(r);
    if (cum >= target) return r;
  }
  return null;
}

export function getPoTarget(data: any, po: any): string | null {
  if (po?.target_selesai) return po.target_selesai;
  const pemo = (data.pemotongan_kain || []).find((p: any) => String(p.id) === String(po?.pemotongan_id));
  return pemo?.target_selesai || null;
}

/** Laporan jahit milik CMT pemegang PO (tidak termasuk laporan vendor lanjutan/washing). */
export function cmtReports(data: any, po: any): any[] {
  return (data.cmt_progres || []).filter((p: any) =>
    String(p.po_id) === String(po.id) &&
    !p.transfer_id &&
    (po.vendorId == null || String(p.vendor_id) === String(po.vendorId))
  );
}

/** Laporan vendor lanjutan untuk satu transfer. */
export function transferReports(data: any, t: any): any[] {
  return (data.cmt_progres || []).filter((p: any) => p.transfer_id != null && String(p.transfer_id) === String(t.id));
}

export interface Completion {
  target: string | null;
  jumlah: number;
  approved: number;
  pending: number;
  sisa: number;
  /** Seluruh jumlah sudah di-ACC admin */
  done: boolean;
  /** Seluruh jumlah sudah dilaporkan vendor (sebagian mungkin masih menunggu ACC) */
  fullyReported: boolean;
  /** Belum selesai, tapi semua sudah dilaporkan → tinggal ACC admin */
  waitingAcc: boolean;
  reportedAt: string | null;
  selesaiAt: string | null;
  /** Hari terlambat (live jika masih berjalan; beku saat semua dilaporkan/selesai) */
  lateDays: number;
  /** Masih berjalan & hitungan keterlambatan masih bertambah */
  isOverdue: boolean;
  finishedLate: boolean;
  onTime: boolean;
}

function computeCompletion(
  records: any[],
  jumlah: number,
  target: string | null,
  stored: { selesaiAt?: string | null; lateDays?: number | null; forcedDone?: boolean },
  now: Date
): Completion {
  const approvedRecs = records.filter((r) => APPROVED.has(r.status));
  const pendingRecs = records.filter((r) => PENDING.has(r.status));
  const approved = approvedRecs.reduce((s, r) => s + qtyOf(r), 0);
  const pending = pendingRecs.reduce((s, r) => s + qtyOf(r), 0);
  const done = !!stored.forcedDone || (jumlah > 0 && approved >= jumlah);

  const reach = reachingRecord(done ? approvedRecs : [...approvedRecs, ...pendingRecs], jumlah);
  const reportedAt: string | null = reach ? (reach.createdAt || reach.diterimaPada || null) : null;
  const fullyReported = done || !!reach;

  let selesaiAt: string | null = stored.selesaiAt || null;
  if (done && !selesaiAt) {
    const accReach = reachingRecord([...approvedRecs].sort((a, b) =>
      new Date(a.diterimaPada || a.createdAt || 0).getTime() - new Date(b.diterimaPada || b.createdAt || 0).getTime()
    ), jumlah);
    selesaiAt = accReach?.diterimaPada || accReach?.createdAt || now.toISOString();
  }

  let lateDays: number;
  if (done && typeof stored.lateDays === "number") lateDays = stored.lateDays;
  else lateDays = lateDaysAt(target, reportedAt || selesaiAt || now);

  return {
    target,
    jumlah,
    approved,
    pending,
    sisa: Math.max(0, jumlah - approved),
    done,
    fullyReported,
    waitingAcc: !done && fullyReported,
    reportedAt,
    selesaiAt: done ? selesaiAt : null,
    lateDays,
    isOverdue: !fullyReported && lateDays > 0,
    finishedLate: done && lateDays > 0,
    onTime: done && lateDays === 0,
  };
}

/** Status pengerjaan CMT (jahit) untuk satu PO. */
export function getCmtCompletion(data: any, po: any, now: Date = new Date()): Completion {
  return computeCompletion(
    cmtReports(data, po),
    Number(po.jumlahTerbit || 0),
    getPoTarget(data, po),
    {
      selesaiAt: po.cmt_selesai_at,
      lateDays: po.cmt_terlambat_hari,
      forcedDone: po.cmt_status === "Selesai",
    },
    now
  );
}

/** Status pengerjaan vendor lanjutan (washing/finishing/dll) untuk satu transfer. */
export function getTransferCompletion(data: any, t: any, now: Date = new Date()): Completion {
  // Barang yang dinyatakan reject oleh admin tidak perlu dilaporkan vendor lagi
  const reject = Number(t.jumlah_reject || 0);
  const jumlah = Math.max(0, Number(t.jumlah_kirim || 0) - reject);
  return computeCompletion(
    transferReports(data, t),
    jumlah,
    // Vendor lanjutan hanya dinilai dari target transfer-nya sendiri (bukan target CMT/PO)
    t.target_selesai || null,
    {
      selesaiAt: t.selesai_at,
      lateDays: t.terlambat_hari,
      forcedDone: t.status === "Selesai" || (jumlah <= 0 && reject > 0),
    },
    now
  );
}

export function isVendorTransferActive(t: any): boolean {
  return t?.vendor_id != null && ACTIVE_TRANSFER.has(t.status);
}

/**
 * Rekonsiliasi otomatis — idempotent, dipanggil setiap kali data disimpan.
 * Menandai pekerjaan vendor yang sudah tuntas & menyinkronkan pipeline PO.
 * Mengembalikan true jika ada perubahan.
 */
export function reconcileProduction(data: any, now: Date = new Date()): boolean {
  let changed = false;

  // 1. CMT selesai → bekukan keterlambatan & tandai selesai
  for (const po of (data.po_produksi || [])) {
    if (!po.vendorId || po.cmt_status === "Selesai") continue;
    const c = getCmtCompletion(data, po, now);
    if (c.done) {
      po.cmt_status = "Selesai";
      po.cmt_selesai_at = c.selesaiAt || now.toISOString();
      po.cmt_terlambat_hari = c.lateDays;
      po.cmt_tepat_waktu = c.lateDays === 0;
      changed = true;
    }
  }

  // 2. Vendor lanjutan selesai → transfer ditutup
  for (const t of (data.produksi_transfers || [])) {
    if (!isVendorTransferActive(t)) continue;
    const c = getTransferCompletion(data, t, now);
    if (c.done) {
      const isRejectTotal = Number(t.jumlah_reject || 0) >= Number(t.jumlah_kirim || 0) && Number(t.jumlah_kirim || 0) > 0;
      t.status = isRejectTotal ? "Reject" : "Selesai";
      t.selesai_at = c.selesaiAt || now.toISOString();
      t.terlambat_hari = c.lateDays;
      t.tepat_waktu = c.lateDays === 0;
      changed = true;
    }
  }

  // 3. Pipeline per PO
  if (syncPipelines(data, now) > 0) changed = true;

  return changed;
}

/** Hitung ulang tahapan pipeline setiap PO. Hanya mengubah entry yang benar-benar berubah. */
export function syncPipelines(data: any, now: Date = new Date()): number {
  if (!data.po_pipeline) data.po_pipeline = [];
  const activeStages = (data.pipeline_stages || [])
    .filter((s: any) => s.aktif)
    .sort((a: any, b: any) => a.urutan - b.urutan);
  if (activeStages.length === 0) return 0;

  const transfersByPo: Record<string, any[]> = {};
  for (const t of (data.produksi_transfers || [])) {
    (transfersByPo[t.po_id] ||= []).push(t);
  }

  const today = now.toISOString().split("T")[0];
  let synced = 0;

  for (const po of (data.po_produksi || [])) {
    const poTargetSelesai = getPoTarget(data, po);
    const cmt = getCmtCompletion(data, po, now);
    const cmtReported = cmt.approved + cmt.pending;
    const jahitProses = cmtReported > 0 || !!po.vendorId;
    const poTransfers = transfersByPo[po.id] || [];

    // Barang yang benar-benar sudah masuk Gudang & Stok / reject (sumber: stock_movements)
    let masukStok = 0, rejectStok = 0, lastMoveAt: string | null = null;
    for (const m of (data.stock_movements || [])) {
      if (String(m.po_id) !== String(po.id)) continue;
      if (m.jenis === "masuk") masukStok += Number(m.jumlah || 0);
      else if (m.jenis === "reject") rejectStok += Number(m.jumlah || 0);
      else continue;
      const at = m.tanggal || m.createdAt || null;
      if (at && (!lastMoveAt || at > lastMoveAt)) lastMoveAt = at;
    }
    const terbit = Number(po.jumlahTerbit || 0);
    const poTuntas = terbit > 0 && masukStok + rejectStok >= terbit;

    const existingIndex = data.po_pipeline.findIndex((pp: any) => pp.po_id === po.id);
    const existingStages = existingIndex !== -1 ? (data.po_pipeline[existingIndex].stages || []) : [];

    const stages = activeStages.map((s: any) => {
      const slugLower = (s.slug || "").toLowerCase();
      const isJahit = slugLower.includes("jahit") || slugLower.includes("cmt");
      const isPotong = slugLower.includes("potong");
      const isWash = slugLower.includes("wash") || slugLower.includes("cuci");
      const prev = existingStages.find((es: any) => es.stage_id === s.id);

      let status = "Menunggu";
      let selesai_tgl: string | null = null;
      let vendor_id: number | null = null;
      let target_selesai = poTargetSelesai;
      let catatan = "";
      let terlambat_hari = 0;

      if (isPotong) {
        status = "Selesai";
        selesai_tgl = po.tanggalTerbit ? po.tanggalTerbit.split("T")[0] : null;
        catatan = "Pemotongan kain selesai & SPK diterbitkan";
      } else if (isJahit) {
        vendor_id = po.vendorId || null;
        status = cmt.done ? "Selesai" : po.status === "Dikerjakan" ? "Dikerjakan" : jahitProses ? "Proses" : "Menunggu";
        if (cmt.done) selesai_tgl = (cmt.selesaiAt || "").split("T")[0] || prev?.selesai_tgl || today;
        terlambat_hari = cmt.lateDays;
        catatan = po.catatan || "";
      } else if (isGudangStage(s)) {
        // Tahap Gudang: status mengikuti barang yang sudah masuk stok (bukan jumlah transfer)
        const stageTfs = poTransfers.filter((t: any) => transferTargetStage(activeStages, t)?.id === s.id);
        if (poTuntas) {
          status = "Selesai";
          selesai_tgl = prev?.selesai_tgl || (lastMoveAt || "").split("T")[0] || today;
        } else if (masukStok > 0 || stageTfs.some((t: any) => !t.is_forwarded && Number(t.jumlah_kirim || 0) > 0)) {
          status = "Proses";
        }
        catatan = [
          masukStok > 0 ? `${masukStok} pcs masuk stok` : "",
          rejectStok > 0 ? `${rejectStok} pcs reject` : "",
          terbit > 0 && !poTuntas ? `${Math.max(0, terbit - masukStok - rejectStok)} pcs belum masuk` : "",
        ].filter(Boolean).join(" · ");
      } else {
        const stageTfs = poTransfers.filter((t: any) => transferTargetStage(activeStages, t)?.id === s.id);
        const vendorTfs = stageTfs.filter((t: any) => t.vendor_id != null);
        const totalKirim = stageTfs.reduce((sum: number, t: any) => sum + (Number(t.jumlah_kirim) || 0), 0);
        // Pakai jumlah diterima awal (sebelum dipindah bertahap ke Gudang & Stok)
        const totalTerima = vendorTfs.reduce((sum: number, t: any) => sum + (Number(t.jumlah_diterima_awal ?? t.jumlah_diterima) || 0), 0);
        let approved = 0;
        let rejected = 0;
        let maxLate = 0;
        let lastSelesai: string | null = null;
        for (const t of vendorTfs) {
          const c = getTransferCompletion(data, t, now);
          approved += c.approved;
          rejected += Number(t.jumlah_reject || 0);
          maxLate = Math.max(maxLate, c.lateDays);
          if (c.selesaiAt && (!lastSelesai || c.selesaiAt > lastSelesai)) lastSelesai = c.selesaiAt;
        }
        const lastTf = vendorTfs[vendorTfs.length - 1] || stageTfs[stageTfs.length - 1];
        vendor_id = lastTf?.vendor_id || null;
        target_selesai = lastTf?.target_selesai || poTargetSelesai;
        terlambat_hari = maxLate;

        const doneQty = Math.max(approved + rejected, totalTerima);
        if (stageTfs.length === 0 && poTuntas) {
          // PO sudah tuntas masuk stok tanpa melewati tahap ini
          status = "Selesai";
          catatan = "Dilewati — PO tidak melalui tahap ini";
        } else if (po.jumlahTerbit > 0 && doneQty >= po.jumlahTerbit) {
          status = "Selesai";
          selesai_tgl = prev?.selesai_tgl || (lastSelesai || "").split("T")[0] || today;
        } else if (vendorTfs.some((t: any) => t.status === "Dikerjakan")) {
          status = "Dikerjakan";
        } else if (totalKirim > 0 || vendorTfs.length > 0) {
          status = "Proses";
        }
        if (vendorTfs.length > 0) catatan = `${vendorTfs.length} pengiriman ke vendor`;
        else if (stageTfs.some((t: any) => !t.is_forwarded && t.status !== "Ditarik Penuh" && Number(t.jumlah_kirim || 0) > 0)) catatan = "Standby — belum dikirim ke vendor";
      }

      if (prev && prev.manual_status) {
        status = prev.status;
        selesai_tgl = prev.selesai_tgl;
        if (prev.vendor_id) vendor_id = prev.vendor_id;
        if (prev.target_selesai) target_selesai = prev.target_selesai;
      }

      return {
        stage_id: s.id,
        slug: s.slug,
        nama: s.nama,
        warna: s.warna,
        opsional: s.opsional,
        aktif: true,
        vendor_id,
        target_selesai,
        status,
        selesai_tgl,
        catatan,
        terlambat_hari,
        ...(prev?.manual_status ? { manual_status: true } : {}),
      };
    });

    const prevEntry = existingIndex !== -1 ? data.po_pipeline[existingIndex] : null;
    if (!prevEntry || JSON.stringify(prevEntry.stages) !== JSON.stringify(stages)) {
      const entry = { po_id: po.id, stages, updatedAt: now.toISOString(), auto_synced: true };
      if (existingIndex !== -1) data.po_pipeline[existingIndex] = entry;
      else data.po_pipeline.push(entry);
      synced++;
    }
  }
  return synced;
}
