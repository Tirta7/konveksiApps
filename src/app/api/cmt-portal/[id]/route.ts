import { NextResponse } from "next/server";
import { readData } from "@/lib/data-store";

// GET portal data for a specific CMT vendor
export async function GET(req: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  const data = readData();
  const params = await Promise.resolve(context.params);
  const vendorId = Number(params.id);

  const vendor = (data.vendors || []).find((v: any) => v.id === vendorId);
  if (!vendor) {
    return NextResponse.json({ error: "CMT tidak ditemukan" }, { status: 404 });
  }

  // PO aktif: po_produksi atau produksi_transfers yang masih berjalan
  let activePO: any[] = [];
  
  if (vendor.tipe === "cmt" || vendor.tipe === "jahit") {
    activePO = (data.po_produksi || [])
      .filter((po: any) => po.vendorId === vendorId && po.status !== "Selesai")
      .map((po: any) => {
      const pengambilans = (data.po_pengambilan || []).filter((p: any) => p.poId === po.id);
      const totalDiambil = pengambilans.reduce((sum: number, p: any) => sum + (p.jumlahDiambil || 0), 0);
      const pct = po.jumlahTerbit > 0 ? Math.round((totalDiambil / po.jumlahTerbit) * 100) : 0;
      
      // Compute per-size progress from verified cmt_progres records
      const sizeProgress: Record<string, number> = {};
      const progresRecords = (data.cmt_progres || []).filter((p: any) => 
        p.po_id === po.id && (p.status === "Diverifikasi" || p.status === "selesai" || p.status === "Diterima")
      );
      for (const rec of progresRecords) {
        for (const item of (rec.items || [])) {
          sizeProgress[item.size] = (sizeProgress[item.size] || 0) + Number(item.jumlah || 0);
        }
      }
      // Also count from pending reports (Menunggu/Pending, not Ditolak or Diterima)
      const pendingProgres = (data.cmt_progres || []).filter((p: any) => 
        p.po_id === po.id && p.vendor_id === vendorId && 
        (p.status === "Menunggu" || p.status === "Pending")
      );
      const pendingSizeProgress: Record<string, number> = {};
      for (const rec of pendingProgres) {
        for (const item of (rec.items || [])) {
          pendingSizeProgress[item.size] = (pendingSizeProgress[item.size] || 0) + Number(item.jumlah || 0);
        }
      }
      
      return {
        ...po,
        no_po: po.noPo,          // alias for frontend
        jumlah_terbit: po.jumlahTerbit,
        totalDiambil,
        pct,
        sizeProgress,
        pendingSizeProgress,
        progres: (data.spk_progres || []).filter((p: any) => p.po_id === po.id)
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
  }

  // Riwayat selesai
  const historiPO = (data.po_produksi || [])
    .filter((po: any) => po.vendorId === vendorId && po.status === "Selesai")
    .map((po: any) => {
      const pengambilans = (data.po_pengambilan || []).filter((p: any) => p.poId === po.id);
      const totalDiambil = pengambilans.reduce((sum: number, p: any) => sum + (p.jumlahDiambil || 0), 0);
      return { ...po, no_po: po.noPo, jumlah_terbit: po.jumlahTerbit, totalDiambil };
    })
    .slice().reverse().slice(0, 20);

  // Gaji / Tagihan
  const gaji = (data.gaji_cmt || [])
    .filter((g: any) => g.cmtId === vendorId)
    .slice().reverse();

  const totalTertunggak = gaji.filter((g: any) => g.status !== "Lunas")
    .reduce((sum: number, g: any) => sum + (Number(g.total) - Number(g.dibayar || 0)), 0);

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

  // === SMART TRACKING: Hitung progress keseluruhan CMT ini ===
  const allActivePOs = activePO;
  
  let totalJumlahTerbit = 0;
  let totalApprovedDone = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Calculate overdue info per PO
  let maxOverdueDays = 0;
  const overduePoList: { noPo: string; model: string; targetSelesai: string; overdueDays: number }[] = [];

  for (const po of allActivePOs) {
    totalJumlahTerbit += Number(po.jumlahTerbit || 0);
    // Hitung yang sudah di-ACC admin (Diterima/Diverifikasi)
    const approvedRecs = (data.cmt_progres || []).filter((p: any) =>
      (p.transfer_id === po.id || (p.po_id === (po.po_id || po.id) && p.vendor_id === vendorId)) && 
      (p.status === "Diterima" || p.status === "Diverifikasi")
    );
    for (const rec of approvedRecs) {
      for (const item of (rec.items || [])) {
        totalApprovedDone += Number(item.jumlah || 0);
      }
    }

    // Check overdue from pemotongan target_selesai
    if (po.pemotongan_id) {
      const pemo = (data.pemotongan_kain || []).find((p: any) => String(p.id) === String(po.pemotongan_id));
      if (pemo?.target_selesai) {
        const targetDate = new Date(pemo.target_selesai);
        targetDate.setHours(0, 0, 0, 0);
        const graceDate = new Date(targetDate);
        graceDate.setDate(graceDate.getDate() + 1); // 1 day grace
        if (today > graceDate) {
          const overdueDays = Math.floor((today.getTime() - graceDate.getTime()) / (1000 * 60 * 60 * 24));
          maxOverdueDays = Math.max(maxOverdueDays, overdueDays);
          overduePoList.push({
            noPo: po.noPo,
            model: po.model,
            targetSelesai: pemo.target_selesai,
            overdueDays
          });
        }
      }
    }
  }

  const overallPct = totalJumlahTerbit > 0 ? Math.round((totalApprovedDone / totalJumlahTerbit) * 100) : 0;
  const baseMinPct = vendor.min_progress_pct ?? 70;
  // Throttle penalty: min_progress_pct INCREASES by 1% per overdue day (harder to request)
  const throttlePenalty = maxOverdueDays; // 1% per day
  const effectiveMinPct = Math.min(100, baseMinPct + throttlePenalty);
  const hasActivePO = allActivePOs.length > 0;
  
  const canRequest = !hasActivePO || effectiveMinPct === 0 || overallPct >= effectiveMinPct;

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
    neededPcs: !canRequest ? Math.ceil((effectiveMinPct / 100) * totalJumlahTerbit) - totalApprovedDone : 0,
  };

  // Also attach overdue info per active PO
  const activePOWithOverdue = activePO.map((po: any) => {
    const pemo = po.pemotongan_id
      ? (data.pemotongan_kain || []).find((p: any) => String(p.id) === String(po.pemotongan_id))
      : null;
    let overdueDays = 0;
    let isOverdue = false;
    let targetSelesai = pemo?.target_selesai || null;
    if (targetSelesai) {
      const targetDate = new Date(targetSelesai);
      targetDate.setHours(0, 0, 0, 0);
      const graceDate = new Date(targetDate);
      graceDate.setDate(graceDate.getDate() + 1);
      if (today > graceDate) {
        overdueDays = Math.floor((today.getTime() - graceDate.getTime()) / (1000 * 60 * 60 * 24));
        isOverdue = true;
      }
    }
    return { ...po, targetSelesai, overdueDays, isOverdue };
  });

  return NextResponse.json({
    vendor,
    activePO: activePOWithOverdue,
    historiPO,
    gaji,
    totalTertunggak,
    requests,
    pemotonganReady,
    canRequest,
    blockInfo,
  });
}

