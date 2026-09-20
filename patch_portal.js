const fs = require('fs');
let code = fs.readFileSync('src/app/api/cmt-portal/[id]/route.ts', 'utf8');

const targetStr = `  // PO aktif: po_produksi yang masih berjalan
  const activePO = (data.po_produksi || [])
    .filter((po: any) => po.vendorId === vendorId && po.status !== "Selesai")
    .map((po: any) => {`;

const newCode = `  // PO aktif: po_produksi atau produksi_transfers yang masih berjalan
  let activePO: any[] = [];
  
  if (vendor.tipe === "cmt" || vendor.tipe === "jahit") {
    activePO = (data.po_produksi || [])
      .filter((po: any) => po.vendorId === vendorId && po.status !== "Selesai")
      .map((po: any) => {`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, newCode);
} else {
  console.log("Could not find targetStr");
}

const mapEndStr = `        progres: (data.spk_progres || []).filter((p: any) => p.po_id === po.id)
      };
    });`;

const mapEndNewCode = `        progres: (data.spk_progres || []).filter((p: any) => p.po_id === po.id)
      };
    });
  } else {
    // Vendor downstream (Washing, Finishing, dll) mencari active job di produksi_transfers
    activePO = (data.produksi_transfers || [])
      .filter((t: any) => t.vendor_id === vendorId && t.status === "Proses")
      .map((t: any) => {
        const po = (data.po_produksi || []).find((p: any) => p.id === t.po_id);
        
        // Progress record dicari berdasarkan transfer_id (dan po_id as fallback)
        const sizeProgress: Record<string, number> = {};
        const progresRecords = (data.cmt_progres || []).filter((p: any) => 
          (p.transfer_id === t.id || (p.po_id === t.po_id && p.vendor_id === vendorId)) && 
          (p.status === "Diverifikasi" || p.status === "selesai" || p.status === "Diterima")
        );
        for (const rec of progresRecords) {
          for (const item of (rec.items || [])) {
            sizeProgress[item.size] = (sizeProgress[item.size] || 0) + Number(item.jumlah || 0);
          }
        }
        
        const pendingProgres = (data.cmt_progres || []).filter((p: any) => 
          (p.transfer_id === t.id || (p.po_id === t.po_id && p.vendor_id === vendorId)) && 
          (p.status === "Menunggu" || p.status === "Pending")
        );
        const pendingSizeProgress: Record<string, number> = {};
        for (const rec of pendingProgres) {
          for (const item of (rec.items || [])) {
            pendingSizeProgress[item.size] = (pendingSizeProgress[item.size] || 0) + Number(item.jumlah || 0);
          }
        }

        const totalSelesai = Object.values(sizeProgress).reduce((sum, val) => sum + val, 0);
        const pct = t.jumlah_kirim > 0 ? Math.round((totalSelesai / t.jumlah_kirim) * 100) : 0;

        return {
          id: t.id,
          po_id: t.po_id,
          is_transfer: true,
          no_po: po ? po.noPo : "Unknown",
          model: po ? po.model : "Unknown",
          jumlah_terbit: t.jumlah_kirim, // The amount they were assigned
          totalDiambil: t.jumlah_kirim, // For downstream, it's immediately assigned
          pct,
          sizeProgress,
          pendingSizeProgress,
          progres: [] // For downstream maybe not tracked in spk_progres
        };
      });
  }`;

if (code.includes(mapEndStr)) {
  code = code.replace(mapEndStr, mapEndNewCode);
} else {
  console.log("Could not find mapEndStr");
}


const allActiveTarget = `  const allActivePOs = (data.po_produksi || []).filter((po: any) => po.vendorId === vendorId && po.status !== "Selesai");`;
const allActiveNew = `  const allActivePOs = activePO;`;

if (code.includes(allActiveTarget)) {
  code = code.replace(allActiveTarget, allActiveNew);
} else {
  console.log("Could not find allActiveTarget");
}


// In SMART TRACKING, it iterates allActivePOs and does:
// totalJumlahTerbit += Number(po.jumlahTerbit || 0);
// Hitung yang sudah di-ACC admin (Diterima/Diverifikasi)
const overDueTarget = `    // Hitung yang sudah di-ACC admin (Diterima/Diverifikasi)
    const approvedRecs = (data.cmt_progres || []).filter((p: any) =>
      p.po_id === po.id && (p.status === "Diterima" || p.status === "Diverifikasi")
    );`;

const overDueNew = `    // Hitung yang sudah di-ACC admin (Diterima/Diverifikasi)
    const approvedRecs = (data.cmt_progres || []).filter((p: any) =>
      (p.transfer_id === po.id || (p.po_id === (po.po_id || po.id) && p.vendor_id === vendorId)) && 
      (p.status === "Diterima" || p.status === "Diverifikasi")
    );`;

if (code.includes(overDueTarget)) {
  code = code.replace(overDueTarget, overDueNew);
} else {
  console.log("Could not find overDueTarget");
}

fs.writeFileSync('src/app/api/cmt-portal/[id]/route.ts', code, 'utf8');
console.log("Updated api/cmt-portal/[id]/route.ts");