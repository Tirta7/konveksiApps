import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = readData();
  
  const currentSpk = data.spk.find(s => s.token === token);
  if (!currentSpk) return NextResponse.json({ error: "Link tidak valid atau sudah tidak aktif." }, { status: 404 });

  const batch = data.batches.find(b => b.id === currentSpk.batchId);
  const vendor = data.vendors.find(v => v.id === currentSpk.vendorId);

  return NextResponse.json({ spk: currentSpk, batch, vendor });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { aksi, bundleId, jumlahSelesai, catatanVendor, defectDetail } = await req.json();
  const data = readData();

  const currentSpk = data.spk.find(s => s.token === token);
  if (!currentSpk) return NextResponse.json({ error: "Link tidak valid." }, { status: 404 });
  if (currentSpk.status === "selesai" || currentSpk.status === "reject") return NextResponse.json({ error: "SPK ini sudah selesai atau ditolak." }, { status: 400 });

  const vendor = data.vendors.find(v => v.id === currentSpk.vendorId);
  const now = new Date().toISOString();

  if (aksi === "terima") {
    if (!bundleId) return NextResponse.json({ error: "Bundle ID diperlukan" }, { status: 400 });
    
    const bundle = data.bundles.find(b => b.id === Number(bundleId));
    if (bundle) {
      bundle.currentVendorId = currentSpk.vendorId;
      bundle.status = "dikerjakan";
    }

    data.tracking_logs.push({
      id: nextId(data, "tracking_logs"), batchId: currentSpk.batchId, spkId: currentSpk.id,
      bundleId: Number(bundleId), vendorId: currentSpk.vendorId, aksi: "terima-barang",
      keterangan: `Bundle ${bundleId} diterima oleh ${vendor?.nama || ''}`, waktu: now
    });

    if (currentSpk.status === "menunggu") {
      currentSpk.status = "berjalan";
      currentSpk.tanggalDiterima = now;
    }

    writeData(data);
    return NextResponse.json({ success: true, status: "diterima" });
  }
  
  if (aksi === "selesai") {
    if (!bundleId || !jumlahSelesai) return NextResponse.json({ error: "Bundle ID & Jumlah diperlukan" }, { status: 400 });

    const newSelesai = currentSpk.jumlahSelesai + Number(jumlahSelesai);
    if (newSelesai > currentSpk.targetJumlah) {
      return NextResponse.json({ error: `Melebihi target. Sisa: ${currentSpk.targetJumlah - currentSpk.jumlahSelesai}` }, { status: 400 });
    }

    data.spk_progres.push({
      id: nextId(data, "spk_progres"), spkId: currentSpk.id, bundleId: Number(bundleId),
      jumlahSelesai: Number(jumlahSelesai), tanggal: now
    });

    const isSelesaiSemua = newSelesai >= currentSpk.targetJumlah;
    currentSpk.jumlahSelesai = newSelesai;
    currentSpk.status = isSelesaiSemua ? "selesai" : "sebagian-selesai";
    if (isSelesaiSemua) {
      currentSpk.tanggalSelesai = now;
      currentSpk.catatan = catatanVendor || currentSpk.catatan;
    }

    if (vendor?.tipe === "cmt") {
      const batch = data.batches.find((b: any) => b.id === currentSpk.batchId);
      const kategori = batch?.jenisKain || "";
      let tarif = vendor.hargaPerPcs || 0;
      if (vendor.tarifPotongan && vendor.tarifPotongan[kategori]) {
        tarif = vendor.tarifPotongan[kategori];
      }
      
      if (tarif > 0) {
        data.gaji_cmt.push({
          id: nextId(data, "gaji_cmt"), cmtId: vendor.id, spkId: currentSpk.id,
          jumlahPcs: Number(jumlahSelesai), totalGaji: Number(jumlahSelesai) * tarif, tanggal: now
        });
      }
    }

    const bundle = data.bundles.find(b => b.id === Number(bundleId));
    if (bundle) bundle.status = "menunggu-selanjutnya";

    data.tracking_logs.push({
      id: nextId(data, "tracking_logs"), batchId: currentSpk.batchId, spkId: currentSpk.id,
      bundleId: Number(bundleId), vendorId: currentSpk.vendorId, aksi: "selesai-parsial",
      keterangan: `Bundle ${bundleId} selesai (${jumlahSelesai} pcs)`, waktu: now
    });

    writeData(data);
    return NextResponse.json({ success: true, status: currentSpk.status });
  }

  if (aksi === "qc-gagal") {
    if (!bundleId) return NextResponse.json({ error: "Bundle ID diperlukan" }, { status: 400 });
    
    const bundle = data.bundles.find(b => b.id === Number(bundleId));
    if (!bundle) return NextResponse.json({ error: "Bundle tidak ditemukan" }, { status: 404 });

    if (bundle.returCount >= 2) {
      bundle.status = "reject";
      data.retur_produksi.push({
        id: nextId(data, "retur_produksi"), batchId: currentSpk.batchId, bundleId: bundle.id,
        alasan: defectDetail || "Cacat berulang melebihi batas 2x", keBerapaKali: bundle.returCount + 1,
        status: "reject-permanen", tanggal: now
      });
      writeData(data);
      return NextResponse.json({ success: true, status: "reject-permanen" });
    }

    bundle.returCount += 1;
    bundle.status = "retur-washing";

    data.retur_produksi.push({
      id: nextId(data, "retur_produksi"), batchId: currentSpk.batchId, bundleId: bundle.id,
      alasan: defectDetail || "Cacat QC", keBerapaKali: bundle.returCount, status: "menunggu-spk-retur", tanggal: now
    });

    writeData(data);
    return NextResponse.json({ success: true, status: "qc-gagal", returKe: bundle.returCount });
  }

  return NextResponse.json({ error: "Aksi tidak dikenal" }, { status: 400 });
}
