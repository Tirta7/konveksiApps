import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";

export async function POST(req: NextRequest) {
  const data = readData();
  const body = await req.json();
  const { action, id, distribusi } = body;

  if (!data.cmt_progres) return NextResponse.json({ error: "Belum ada progres" }, { status: 404 });
  const idx = data.cmt_progres.findIndex((p: any) => String(p.id) === String(id));
  if (idx === -1) return NextResponse.json({ error: "Laporan tidak ditemukan" }, { status: 404 });

  const laporan = data.cmt_progres[idx];

  // TOLAK
  if (action === "reject") {
    if (laporan.status !== "Menunggu" && laporan.status !== "Pending") return NextResponse.json({ error: "Hanya laporan pending yang bisa ditolak" }, { status: 400 });
    
    // Kembalikan barcode jika sebelumnya di-set "cmt"
    if (data.barcode_item) {
      for (const item of (laporan.items || [])) {
        const { size, jumlah } = item;
        let reverted = 0;
        for (let i = 0; i < data.barcode_item.length && reverted < Number(jumlah); i++) {
          const b = data.barcode_item[i];
          if (String(b.poId) === String(laporan.po_id) && b.size === size && b.status === "cmt") {
            data.barcode_item[i].status = "potong";
            reverted++;
          }
        }
      }
    }
    data.cmt_progres[idx].status = "Ditolak";
    data.cmt_progres[idx].ditolakPada = new Date().toISOString();
    writeData(data);
    return NextResponse.json({ success: true });
  }

  // TERIMA (ACC)
  if (laporan.status === "Diterima") return NextResponse.json({ error: "Laporan sudah diterima" }, { status: 400 });
  data.cmt_progres[idx].status = "Diterima";
  data.cmt_progres[idx].diterimaPada = new Date().toISOString();


  // 1. Tentukan Stage Saat Ini dan Stage Berikutnya
  const vendor = (data.vendors || []).find((v: any) => String(v.id) === String(laporan.vendor_id));
  const currentStageSlug = vendor?.tipe || "cmt";
  
  const stages = (data.pipeline_stages || []).sort((a: any, b: any) => a.urutan - b.urutan);
  const currentIdx = stages.findIndex((s: any) => s.slug === currentStageSlug);
  let nextStageSlug = "gudang";
  if (currentIdx >= 0 && currentIdx < stages.length - 1) {
      nextStageSlug = stages[currentIdx + 1].slug;
  }

  // Update barcode_item status
  if (data.barcode_item) {
    for (const item of (laporan.items || [])) {
      const { size, jumlah } = item;
      let updated = 0;
      for (let i = 0; i < data.barcode_item.length && updated < Number(jumlah); i++) {
        const b = data.barcode_item[i];
        if (String(b.poId) === String(laporan.po_id) && b.size === size && (b.status === currentStageSlug || b.status === "cmt" || b.status === "potong")) {
          data.barcode_item[i].status = distribusi ? (distribusi[0]?.ke || nextStageSlug) : nextStageSlug;
          updated++;
        }
      }
    }
  }

  // Create po_pengambilan record (historical trace)
  if (!data.po_pengambilan) data.po_pengambilan = [];
  const pengambilanId = nextId(data, "po_pengambilan");
  data.po_pengambilan.push({ id: pengambilanId, poId: laporan.po_id, jumlahDiambil: laporan.totalJumlah, items: laporan.items, tanggal: new Date().toISOString(), keterangan: `Laporan progres ACC. ${laporan.catatan || ""}`.trim(), laporanId: laporan.id });

  if (!data.produksi_transfers) data.produksi_transfers = [];
  if (!data.po_ledgers) data.po_ledgers = [];

  // Jika ada array distribusi, pecah ke beberapa vendor
  if (distribusi && Array.isArray(distribusi) && distribusi.length > 0) {
    for (const dist of distribusi) {
      data.produksi_transfers.push({
        id: nextId(data, "produksi_transfers" as any),
        po_id: laporan.po_id,
        dari: currentStageSlug, 
        ke: dist.ke, 
        vendor_id: dist.vendor_id || null,
        jumlah_kirim: dist.jumlah,
        sizeBreakdown: dist.sizeBreakdown || [],
        target_selesai: dist.target_selesai || null,
        catatan: `Distribusi ACC ${currentStageSlug} -> ${dist.ke}`,
        status: "Proses", 
        tanggal_kirim: new Date().toISOString(),
      });
      
      data.po_ledgers.push({
        id: nextId(data, "po_ledgers"),
        poId: laporan.po_id,
        dari_vendor_id: String(laporan.vendor_id),
        ke_vendor_id: dist.vendor_id ? String(dist.vendor_id) : "STANDBY",
        jumlah: dist.jumlah,
        tanggal: new Date().toISOString(),
        catatan: "ACC Progres Otomatis (Distribusi Khusus)"
      });
    }

    // UPDATE po_pipeline if exists (auto cascade next stage)
    if (data.po_pipeline) {
      const pIdx = data.po_pipeline.findIndex((p:any) => String(p.po_id) === String(laporan.po_id));
      if (pIdx !== -1) {
        const nextStage = distribusi[0].ke;
        const pStages = data.po_pipeline[pIdx].stages;
        const nIdx = pStages.findIndex((s:any) => s.slug === nextStage);
        if (nIdx !== -1 && pStages[nIdx].status === "Menunggu") {
          pStages[nIdx].status = "Proses";
        }
      }
    }
  } else {
    // OTOMATIS KE STANDBY POOL TAHAP BERIKUTNYA
    data.produksi_transfers.push({
      id: nextId(data, "produksi_transfers" as any),
      po_id: laporan.po_id,
      dari: currentStageSlug,
      ke: nextStageSlug,
      vendor_id: null, // STANDBY POOL
      dari_vendor_id: laporan.vendor_id,
      jumlah_kirim: laporan.totalJumlah,
      sizeBreakdown: laporan.items || [],
      catatan: "Otomatis dari ACC Progres",
      status: nextStageSlug === "gudang" ? "Selesai" : "Pending",
      tanggal_kirim: new Date().toISOString(),
    });
    
    data.po_ledgers.push({
      id: nextId(data, "po_ledgers"),
      poId: laporan.po_id,
      dari_vendor_id: String(laporan.vendor_id),
      ke_vendor_id: nextStageSlug === "gudang" ? "GUDANG" : "STANDBY",
      jumlah: laporan.totalJumlah,
      tanggal: new Date().toISOString(),
      catatan: "ACC Progres Otomatis ke Standby Pool"
    });
    
    // UPDATE po_pipeline if exists (auto cascade next stage)
    if (data.po_pipeline) {
      const pIdx = data.po_pipeline.findIndex((p:any) => String(p.po_id) === String(laporan.po_id));
      if (pIdx !== -1) {
        const pStages = data.po_pipeline[pIdx].stages;
        const nIdx = pStages.findIndex((s:any) => s.slug === nextStageSlug);
        if (nIdx !== -1 && pStages[nIdx].status === "Menunggu") {
          pStages[nIdx].status = "Proses";
        }
      }
    }
  }

  writeData(data);
  return NextResponse.json({ success: true, status: "Diterima" });
}

export async function GET(req: NextRequest) {
  const data = readData();
  const { searchParams } = new URL(req.url);
  const poId = searchParams.get("po_id");
  let res = data.cmt_progres || [];
  if (poId) res = res.filter((x:any) => String(x.po_id) === String(poId));
  return NextResponse.json(res.reverse());
}
export const PATCH = POST;
