import { NextResponse } from "next/server";
import { readData } from "@/lib/data-store";
import { isOpenPool } from "@/lib/pool-guard";
import { REPORT_PENDING } from "@/lib/po-lifecycle";
import { transferSourceStage, transferTargetStage, stageDisplayName } from "@/lib/stage-resolve";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = readData();
  const notifs: any[] = [];

  // 1. Permohonan Kerja Vendor (Requests Pending / Sebagian)
  const pendingRequests = (data.cmt_requests || [])
    .filter((r: any) => r.status === "Pending" || r.status === "Sebagian");

  for (const r of pendingRequests) {
    const vendor = (data.vendors || []).find((v: any) => v.id === r.vendor_id);
    let targetDesc = "Kain Potongan";
    let poNo = "";
    if (r.transfer_id) {
      const tf = (data.produksi_transfers || []).find((t: any) => String(t.id) === String(r.transfer_id));
      const po = tf ? (data.po_produksi || []).find((p: any) => p.id === tf.po_id) : null;
      if (po) poNo = po.noPo;
      targetDesc = tf ? `Stok hasil ${transferSourceStage(data.pipeline_stages, tf)?.nama || stageDisplayName(data.pipeline_stages, tf.dari)}${po ? ` (${po.noPo})` : ""}` : "Stok Transfer";
    } else if (r.pemotongan_id) {
      const pem = (data.pemotongan_kain || []).find((p: any) => String(p.id) === String(r.pemotongan_id));
      targetDesc = pem ? `Potongan Kain ${pem.nama_barang || pem.model || ""}` : "Potongan Kain";
    }

    notifs.push({
      id: `req-${r.id}`,
      rawId: r.id,
      type: "vendor_request",
      title: `${vendor?.nama || "Vendor"} Meminta Kerjaan`,
      desc: `Meminta ${r.total_request || 0} pcs untuk ${targetDesc}`,
      detail: r.catatan ? `"${r.catatan}"` : undefined,
      badge: "Perlu Tindakan",
      badgeColor: "#EF4444",
      timestamp: r.createdAt || new Date().toISOString(),
      url: `/buat-spk?tab=request&reqId=${r.id}`,
      vendor_nama: vendor?.nama || "Vendor",
      jumlah: r.total_request,
      urgency: "high"
    });
  }

  // 2. Laporan Progres Vendor Menunggu ACC
  // Status laporan baru = "Menunggu" (lihat POST /api/cmt-progres) — pakai set yang sama dengan po-lifecycle
  const pendingReports = (data.cmt_progres || [])
    .filter((p: any) => REPORT_PENDING.has(p.status) || p.status === "Menunggu ACC");

  for (const pr of pendingReports) {
    const vendor = (data.vendors || []).find((v: any) => v.id === pr.vendor_id);
    const po = (data.po_produksi || []).find((p: any) => p.id === pr.po_id);
    const sumJumlah = (pr.items || []).reduce((s: number, i: any) => s + Number(i.jumlah || 0), 0) || pr.totalJumlah || 0;

    notifs.push({
      id: `prog-${pr.id}`,
      rawId: pr.id,
      type: "lapor_progres",
      title: `Laporan Setor: ${vendor?.nama || "Vendor"}`,
      desc: `Melaporkan ${sumJumlah} pcs selesai${po ? ` (${po.noPo})` : ""}`,
      detail: pr.catatan ? `"${pr.catatan}"` : undefined,
      badge: "Menunggu ACC",
      badgeColor: "#F59E0B",
      timestamp: pr.tanggal || pr.createdAt || new Date().toISOString(),
      url: `/alur-produksi?po=${pr.po_id || ""}`,
      vendor_nama: vendor?.nama || "Vendor",
      jumlah: sumJumlah,
      urgency: "high"
    });
  }

  // 3. Standby Pool / Hasil Tahap Selesai Siap Kirim ke Pos Berikutnya
  const openPools = (data.produksi_transfers || [])
    .filter((t: any) => isOpenPool(t) && Number(t.jumlah_kirim || 0) > 0);

  for (const t of openPools) {
    const po = (data.po_produksi || []).find((p: any) => p.id === t.po_id);
    const asalVendor = t.dari_vendor_id ? (data.vendors || []).find((v: any) => v.id === t.dari_vendor_id)?.nama : null;
    const stageName = transferSourceStage(data.pipeline_stages, t)?.nama || stageDisplayName(data.pipeline_stages, t.dari);
    const tujuan = transferTargetStage(data.pipeline_stages, t)?.nama;

    notifs.push({
      id: `pool-${t.id}`,
      rawId: t.id,
      type: "standby_pool",
      title: `Siap Kirim: Hasil ${stageName}${asalVendor ? ` (${asalVendor})` : ""}`,
      desc: `${t.jumlah_kirim} pcs selesai di-ACC, siap dialokasikan${tujuan ? ` ke ${tujuan}` : " ke pos tujuan"}`,
      detail: po ? `PO: ${po.noPo} (${po.model})` : undefined,
      badge: "Siap Kirim",
      badgeColor: "#10B981",
      timestamp: t.tanggal_kirim || new Date().toISOString(),
      url: `/alur-produksi?po=${t.po_id}&sumber=${t.id}`,
      jumlah: t.jumlah_kirim,
      urgency: "medium"
    });
  }

  // 4. Potongan Kain Siap Jahit
  const readyCuts = (data.pemotongan_kain || [])
    .filter((p: any) => (p.status === "Selesai" || p.status === "SELESAI") && Number(p.sisa_potongan || 0) > 0)
    .slice(0, 5);

  for (const c of readyCuts) {
    notifs.push({
      id: `cut-${c.id}`,
      rawId: c.id,
      type: "potongan_siap",
      title: `Kain Selesai Potong: ${c.nama_barang || c.model || "Batch"}`,
      desc: `Tersedia ${c.sisa_potongan} pcs siap dibuatkan SPK / dibagikan ke CMT`,
      badge: "Siap Jahit",
      badgeColor: "#6366F1",
      timestamp: c.tanggal || new Date().toISOString(),
      url: `/buat-spk?tab=manual&cutId=${c.id}`,
      jumlah: c.sisa_potongan,
      urgency: "normal"
    });
  }

  // 5. Vendor Aktif Mengerjakan (Realtime) — CMT yang belum selesai + vendor lanjutan yang sedang mengerjakan
  const activeWorking = (data.po_produksi || [])
    .filter((p: any) => p.status === "Dikerjakan" && p.mulai_kerja_at && p.cmt_status !== "Selesai")
    .slice(0, 5);

  for (const p of activeWorking) {
    const vendor = (data.vendors || []).find((v: any) => v.id === p.vendorId);
    notifs.push({
      id: `work-po-${p.id}`,
      rawId: p.id,
      type: "vendor_working",
      title: `Sedang Dikerjakan: ${vendor?.nama || "CMT"}`,
      desc: `${vendor?.nama || "Vendor"} mulai memproses SPK ${p.noPo} (${p.model})`,
      detail: `Total ${p.jumlahTerbit} pcs · Status berjalan live`,
      badge: "Dikerjakan",
      badgeColor: "#10B981",
      timestamp: p.mulai_kerja_at || new Date().toISOString(),
      url: `/alur-produksi?po=${p.id}`,
      jumlah: p.jumlahTerbit,
      urgency: "normal"
    });
  }

  const activeTransfers = (data.produksi_transfers || [])
    .filter((t: any) => t.vendor_id != null && t.status === "Dikerjakan" && !t.is_forwarded)
    .slice(0, 5);
  for (const t of activeTransfers) {
    const vendor = (data.vendors || []).find((v: any) => v.id === t.vendor_id);
    const po = (data.po_produksi || []).find((p: any) => p.id === t.po_id);
    const tahap = transferTargetStage(data.pipeline_stages, t)?.nama || stageDisplayName(data.pipeline_stages, t.ke);
    notifs.push({
      id: `work-tf-${t.id}`,
      rawId: t.id,
      type: "vendor_working",
      title: `Sedang Dikerjakan: ${vendor?.nama || "Vendor"}`,
      desc: `${vendor?.nama || "Vendor"} memproses ${tahap} ${po ? `${po.noPo} (${po.model})` : ""}`.trim(),
      detail: `${t.jumlah_kirim} pcs · Status berjalan live`,
      badge: "Dikerjakan",
      badgeColor: "#10B981",
      timestamp: t.mulai_kerja_at || t.tanggal_kirim || new Date().toISOString(),
      url: `/alur-produksi?po=${t.po_id}`,
      jumlah: t.jumlah_kirim,
      urgency: "normal"
    });
  }

  // Sort by timestamp descending
  notifs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const counts = {
    requests: pendingRequests.length,
    reports: pendingReports.length,
    pools: openPools.length,
    cuts: readyCuts.length,
    working: activeWorking.length + activeTransfers.length,
    total: notifs.length,
    actionRequired: pendingRequests.length + pendingReports.length
  };

  return NextResponse.json({
    notifications: notifs,
    counts,
    timestamp: new Date().toISOString()
  });
}
