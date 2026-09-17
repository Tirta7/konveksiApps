import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";

/**
 * GET /api/spk/[token]
 * Returns batch info + all steps + current active step.
 * Vendor page uses this to know what to show.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = readData();
  const batch = data.batches.find(b => b.token === token);
  if (!batch) return NextResponse.json({ error: "Link tidak valid atau sudah tidak aktif." }, { status: 404 });

  const steps = data.batch_steps
    .filter(s => s.batch_id === batch.id)
    .sort((a, b) => a.step_order - b.step_order)
    .map(s => ({
      ...s,
      vendor_nama: data.vendors.find(v => v.id === s.vendor_id)?.nama ?? "",
      vendor_kontak: data.vendors.find(v => v.id === s.vendor_id)?.kontak ?? "",
      vendor_wajib_hitung_ulang: data.vendors.find(v => v.id === s.vendor_id)?.wajib_hitung_ulang ?? false,
    }));

  const currentStep = steps.find(s => s.step_order === batch.current_step && s.status === "berjalan") ?? null;
  const previousStep = currentStep ? steps.find(s => s.step_order === currentStep.step_order - 1) ?? null : null;
  const totalSteps = steps.length;
  const selesaiSteps = steps.filter(s => s.status === "selesai").length;

  return NextResponse.json({
    batch: { ...batch },
    steps,
    currentStep,
    previousStep,
    totalSteps,
    selesaiSteps,
    routeSelesai: batch.route_selesai,
  });
}

/**
 * PATCH /api/spk/[token]
 * aksi: "terima" | "selesai" | "qc-gagal"
 * Vendor mengkonfirmasi. Sistem otomatis advance ke step berikutnya.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = readData();
  const { aksi, catatanVendor, defect_detail, jumlah_diterima, selisih_terima, size_diterima } = await req.json();
  // defect_detail: [{ size: "L", jumlah_cacat: 3, alasan: "Jahitan lepas" }, ...]
  // jumlah_diterima: actual count by receiving vendor; selisih_terima: expected - received
  const now = new Date().toISOString();

  const batch = data.batches.find(b => b.token === token);
  if (!batch) return NextResponse.json({ error: "Link tidak valid." }, { status: 404 });
  if (batch.route_selesai) return NextResponse.json({ error: "Proses produksi sudah selesai." }, { status: 400 });

  const steps = data.batch_steps
    .filter(s => s.batch_id === batch.id)
    .sort((a, b) => a.step_order - b.step_order);

  const currentStep = steps.find(s => s.step_order === batch.current_step && s.status === "berjalan");
  if (!currentStep) return NextResponse.json({ error: "Tidak ada step yang sedang berjalan." }, { status: 400 });

  if (aksi === "terima") {
    // Vendor konfirmasi terima barang + hitung fisik barang
    currentStep.terima_waktu = now;
    if (jumlah_diterima !== undefined) {
      (currentStep as any).jumlah_diterima = jumlah_diterima;
      (currentStep as any).selisih_terima = selisih_terima ?? 0;
    }
    if (size_diterima) {
      (currentStep as any).size_diterima = size_diterima;
    }
    const jumlahNote = jumlah_diterima !== undefined
      ? ` — Diterima: ${jumlah_diterima} pcs (seharusnya ${currentStep.jumlah_barang} pcs)${(selisih_terima ?? 0) !== 0 ? `, SELISIH ${Math.abs(selisih_terima)} pcs` : ", sesuai"}`
      : "";
    data.tracking_logs.push({
      id: nextId(data, "tracking_logs"), batch_id: batch.id, step_id: currentStep.id,
      vendor_id: currentStep.vendor_id, aksi: "terima-barang",
      keterangan: `${currentStep.jenis_pekerjaan} — vendor konfirmasi terima barang pukul ${new Date(now).toLocaleTimeString("id-ID")}${jumlahNote}`,
      waktu: now
    });
    // Jika ada selisih kurang, catat sebagai kehilangan barang di laporan
    if ((selisih_terima ?? 0) > 0) {
      data.tracking_logs.push({
        id: nextId(data, "tracking_logs"), batch_id: batch.id, step_id: currentStep.id,
        vendor_id: currentStep.vendor_id, aksi: "selisih-barang",
        keterangan: `⚠️ SELISIH: ${selisih_terima} pcs tidak diterima saat transfer ke step ${currentStep.step_order}`,
        waktu: now
      });
    }
    writeData(data);
    return NextResponse.json({ success: true, status: "diterima", terima_waktu: now, jumlah_diterima, selisih_terima });


  } else if (aksi === "mulai-hitung") {
    // Vendor membuka form hitung — catat waktu mulai hitung untuk Peta Perjalanan
    (currentStep as any).mulai_hitung_waktu = now;
    data.tracking_logs.push({
      id: nextId(data, "tracking_logs"), batch_id: batch.id, step_id: currentStep.id,
      vendor_id: currentStep.vendor_id, aksi: "mulai-hitung",
      keterangan: `${currentStep.jenis_pekerjaan} — barang diterima, sedang dalam proses penghitungan fisik`,
      waktu: now
    });
    writeData(data);
    return NextResponse.json({ success: true, status: "menghitung", mulai_hitung_waktu: now });

  } else if (aksi === "batal-hitung") {
    // Vendor batalkan proses hitung — hapus flag mulai_hitung_waktu
    delete (currentStep as any).mulai_hitung_waktu;
    data.tracking_logs.push({
      id: nextId(data, "tracking_logs"), batch_id: batch.id, step_id: currentStep.id,
      vendor_id: currentStep.vendor_id, aksi: "batal-hitung",
      keterangan: `${currentStep.jenis_pekerjaan} — penghitungan barang dibatalkan, sedang diperiksa ulang`,
      waktu: now
    });
    writeData(data);
    return NextResponse.json({ success: true, status: "batal-hitung" });

  } else if (aksi === "selesai") {
    // Tandai step ini selesai
    currentStep.status = "selesai";
    currentStep.selesai_waktu = now;
    if (catatanVendor) currentStep.catatan = catatanVendor;

    data.tracking_logs.push({ id: nextId(data, "tracking_logs"), batch_id: batch.id, step_id: currentStep.id, vendor_id: currentStep.vendor_id, aksi: "selesai-step", keterangan: `${currentStep.jenis_pekerjaan} selesai`, waktu: now });

    // Cek apakah ada step berikutnya
    const nextStep = steps.find(s => s.step_order === currentStep.step_order + 1);
    if (nextStep) {
      // Aktifkan step berikutnya
      nextStep.status = "berjalan";
      nextStep.mulai_waktu = now;
      batch.current_step = nextStep.step_order;
      batch.updated_at = now;
      data.tracking_logs.push({ id: nextId(data, "tracking_logs"), batch_id: batch.id, step_id: nextStep.id, vendor_id: nextStep.vendor_id, aksi: "mulai-step", keterangan: `Step ${nextStep.step_order}: ${nextStep.jenis_pekerjaan} dimulai`, waktu: now });
      writeData(data);
      return NextResponse.json({ success: true, status: "step-berikutnya", nextStep: { step_order: nextStep.step_order, jenis_pekerjaan: nextStep.jenis_pekerjaan, vendor_nama: data.vendors.find(v => v.id === nextStep.vendor_id)?.nama } });
    } else {
      // Semua step selesai
      batch.route_selesai = true;
      batch.status = "gudang";
      batch.updated_at = now;
      data.tracking_logs.push({ id: nextId(data, "tracking_logs"), batch_id: batch.id, aksi: "route-selesai", keterangan: "Semua proses produksi selesai, barang masuk gudang", waktu: now });

      // Jika ini adalah SPK Retur → update cacat di batch asal
      if ((batch as any).is_retur && (batch as any).parent_batch_id) {
        const parentBatch = data.batches.find(b => b.id === (batch as any).parent_batch_id);
        if (parentBatch && parentBatch.size_breakdown && batch.size_breakdown) {
          // Setiap size di SPK retur = jumlah yang berhasil diperbaiki
          for (const sz of batch.size_breakdown) {
            const parentSz = parentBatch.size_breakdown.find(s => s.size === sz.size);
            if (parentSz) {
              // Kurangi cacat dari batch asal sebesar jumlah yang berhasil diperbaiki
              const fixed = Math.min(sz.jumlah, parentSz.cacat);
              parentSz.cacat = Math.max(0, parentSz.cacat - fixed);
              // Jumlah barang jadi bertambah kembali
              parentSz.jumlah = parentSz.jumlah + fixed;
            }
          }
          parentBatch.updated_at = now;
          data.tracking_logs.push({
            id: nextId(data, "tracking_logs"),
            batch_id: parentBatch.id,
            aksi: "retur-selesai",
            keterangan: `Retur SPK ${batch.kode_batch} selesai — stok cacat dipulihkan`,
            waktu: now,
          });
          // Tandai retur_produksi sebagai selesai
          const returRecord = [...data.retur_produksi]
            .reverse()
            .find(r => r.batch_id === parentBatch.id && (r as any).spk_batch_id === batch.id);
          if (returRecord) {
            returRecord.status = "selesai";
          }
        }
      }

      writeData(data);
      return NextResponse.json({ success: true, status: "semua-selesai" });
    }


  } else if (aksi === "qc-gagal") {
    const totalCacat = (defect_detail as any[] || []).reduce((s: number, d: any) => s + (d.jumlah_cacat || 0), 0);
    const returCount = data.retur_produksi.filter((r: any) => r.batch_id === batch.id).length;

    // Simpan detail cacat ke step
    currentStep.qc_result = "gagal";
    currentStep.defect_detail = (defect_detail || []).map((d: any) => ({ ...d, waktu: now }));
    currentStep.total_cacat = totalCacat;

    // Akumulasi cacat ke size_breakdown batch
    if (batch.size_breakdown && defect_detail) {
      for (const d of defect_detail as any[]) {
        const sz = batch.size_breakdown.find((s: any) => s.size === d.size);
        if (sz) sz.cacat = (sz.cacat || 0) + (d.jumlah_cacat || 0);
      }
    }

    // Catat ke tracking
    const detailStr = (defect_detail as any[] || []).map((d: any) => `${d.size}: ${d.jumlah_cacat} pcs (${d.alasan})`).join(", ");
    data.tracking_logs.push({ id: nextId(data, "tracking_logs"), batch_id: batch.id, step_id: currentStep.id, vendor_id: currentStep.vendor_id, aksi: "qc-gagal", keterangan: `QC gagal step ${currentStep.step_order} — ${detailStr || `${totalCacat} pcs cacat`}`, waktu: now });

    if (returCount >= 2) {
      batch.status = "reject";
      batch.route_selesai = true;
      batch.updated_at = now;
      currentStep.status = "reject";
      data.retur_produksi.push({ id: nextId(data, "retur_produksi"), batch_id: batch.id, step_id: currentStep.id, alasan: detailStr || "Cacat berulang", ke_berapa_kali: returCount + 1, status: "reject-permanen", tanggal: now });
      writeData(data);
      return NextResponse.json({ success: true, status: "reject-permanen", totalCacat });
    }

    data.retur_produksi.push({ id: nextId(data, "retur_produksi"), batch_id: batch.id, step_id: currentStep.id, alasan: detailStr || `${totalCacat} pcs cacat`, ke_berapa_kali: returCount + 1, status: "menunggu-spk-retur", tanggal: now });
    writeData(data);
    return NextResponse.json({ success: true, status: "qc-gagal", returKe: returCount + 1, totalCacat, defect_detail });
  }

  return NextResponse.json({ error: "Aksi tidak dikenal" }, { status: 400 });
}
