const fs = require('fs');
let code = fs.readFileSync('src/app/api/cmt-progres/route.ts', 'utf8');

// The block to replace starts around "Update barcode_item status"
const targetBlock = `  // Update barcode_item status
  if (data.barcode_item) {
    for (const item of (laporan.items || [])) {
      const { size, jumlah } = item;
      let updated = 0;
      for (let i = 0; i < data.barcode_item.length && updated < Number(jumlah); i++) {
        const b = data.barcode_item[i];
        if (String(b.poId) === String(laporan.po_id) && b.size === size && (b.status === "cmt" || b.status === "potong")) {
          // kalau ada distribusi, status barcode bisa di update di handler tahap berikutnya. Sementara set ke 'gudang' atau 'washing'
          data.barcode_item[i].status = distribusi ? (distribusi[0]?.ke || "gudang") : "gudang";
          updated++;
        }
      }
    }
  }

  // Create po_pengambilan record (historical trace)
  if (!data.po_pengambilan) data.po_pengambilan = [];
  const pengambilanId = nextId(data, "po_pengambilan");
  data.po_pengambilan.push({ id: pengambilanId, poId: laporan.po_id, jumlahDiambil: laporan.totalJumlah, items: laporan.items, tanggal: new Date().toISOString(), keterangan: \`Laporan progres ACC. \${laporan.catatan || ""}\`.trim(), laporanId: laporan.id });

  if (!data.produksi_transfers) data.produksi_transfers = [];

  // Jika ada array distribusi, pecah ke beberapa vendor
  if (distribusi && Array.isArray(distribusi) && distribusi.length > 0) {
    for (const dist of distribusi) {
      data.produksi_transfers.push({
        id: nextId(data, "produksi_transfers" as any),
        po_id: laporan.po_id,
        dari: "jahit", // laporan CMT berasal dari Jahit
        ke: dist.ke, // misalnya "washing" atau "finishing"
        vendor_id: dist.vendor_id || null,
        jumlah_kirim: dist.jumlah,
        sizeBreakdown: dist.sizeBreakdown || [],
        target_selesai: dist.target_selesai || null,
        catatan: \`Distribusi ACC Jahit -> \${dist.ke}\`,
        status: "Proses", // Langsung proses di tahap berikutnya
        tanggal_kirim: new Date().toISOString(),
      });
    }

    // UPDATE po_pipeline if exists (auto cascade next stage)
    if (data.po_pipeline) {
      const pIdx = data.po_pipeline.findIndex((p:any) => String(p.po_id) === String(laporan.po_id));
      if (pIdx !== -1) {
        // We know jahit is done (or partially done), and we are sending to next stage.
        // For partial, we just ensure the next stage is "Proses".
        const nextStageSlug = distribusi[0].ke; // e.g. 'washing'
        const stages = data.po_pipeline[pIdx].stages;
        const nIdx = stages.findIndex((s:any) => s.slug === nextStageSlug);
        if (nIdx !== -1 && stages[nIdx].status === "Menunggu") {
          stages[nIdx].status = "Proses";
        }
      }
    }
  } else {
    // Legacy behavior: kirim ke gudang
    data.produksi_transfers.push({
      id: nextId(data, "produksi_transfers" as any),
      po_id: laporan.po_id,
      dari: "cmt",
      ke: "gudang",
      vendor_id: laporan.vendor_id,
      jumlah_kirim: laporan.totalJumlah,
      sizeBreakdown: laporan.items || [],
      catatan: "",
      status: "Kirim",
      tanggal_kirim: new Date().toISOString(),
    });
  }`;

const newBlock = `
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
  data.po_pengambilan.push({ id: pengambilanId, poId: laporan.po_id, jumlahDiambil: laporan.totalJumlah, items: laporan.items, tanggal: new Date().toISOString(), keterangan: \`Laporan progres ACC. \${laporan.catatan || ""}\`.trim(), laporanId: laporan.id });

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
        catatan: \`Distribusi ACC \${currentStageSlug} -> \${dist.ke}\`,
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
  }`;

if (code.includes('Legacy behavior: kirim ke gudang')) {
    code = code.replace(targetBlock, newBlock);
    fs.writeFileSync('src/app/api/cmt-progres/route.ts', code, 'utf8');
    console.log("Successfully patched api/cmt-progres/route.ts");
} else {
    console.log("Could not find the target block to replace.");
}
