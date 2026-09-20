import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";

export async function POST(req: NextRequest) {
  try {
    const data = readData();
    const body = await req.json();
    const { request_id, transfer_id, sizeBreakdown, vendor_id, catatan } = body;

    if (!request_id || !transfer_id || !sizeBreakdown || !vendor_id) {
      return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
    }

    const reqIndex = data.cmt_requests.findIndex((r: any) => String(r.id) === String(request_id));
    if (reqIndex === -1) {
      return NextResponse.json({ error: "Request tidak ditemukan" }, { status: 404 });
    }

    const transferIndex = data.produksi_transfers.findIndex((t: any) => String(t.id) === String(transfer_id));
    if (transferIndex === -1) {
      return NextResponse.json({ error: "Data Standby Pool tidak ditemukan" }, { status: 404 });
    }

    const t = data.produksi_transfers[transferIndex];
    const requestedTotal = sizeBreakdown.reduce((sum: number, b: any) => sum + Number(b.jumlah || 0), 0);

    if (requestedTotal > t.jumlah_kirim) {
      return NextResponse.json({ error: "Jumlah melebihi stok yang tersedia di Standby Pool" }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Deduct from existing Standby Pool (transfer)
    t.jumlah_kirim -= requestedTotal;
    
    // Deduct size breakdown
    for (const alloc of sizeBreakdown) {
      const sbIndex = (t.sizeBreakdown || []).findIndex((s: any) => s.size === alloc.size || s.size === alloc.size); // handle possible case issues?
      if (sbIndex !== -1) {
        t.sizeBreakdown[sbIndex].jumlah -= Number(alloc.jumlah);
      }
    }

    // Filter out 0 sizes
    t.sizeBreakdown = (t.sizeBreakdown || []).filter((s: any) => s.jumlah > 0);

    // If Standby pool is empty, we can mark it as Finished/Empty or just leave it with 0
    if (t.jumlah_kirim === 0) {
      t.status = "Ditarik Penuh";
    }

    // Create NEW produksi_transfer for the vendor
    const newTransfer = {
      id: nextId(data, "produksi_transfers" as any),
      po_id: t.po_id,
      dari: t.dari,
      ke: t.ke,
      vendor_id: Number(vendor_id),
      dari_vendor_id: t.dari_vendor_id,
      jumlah_kirim: requestedTotal,
      sizeBreakdown: sizeBreakdown,
      catatan: catatan || "ACC Request",
      status: "Proses", // Sedang dikerjakan oleh vendor
      tanggal_kirim: now,
    };
    data.produksi_transfers.push(newTransfer);

    // Create po_ledgers entry (Deduct from STANDBY, add to VENDOR)
    if (!data.po_ledgers) data.po_ledgers = [];
    data.po_ledgers.push({
      id: nextId(data, "po_ledgers"),
      poId: t.po_id,
      dari_vendor_id: "STANDBY",
      ke_vendor_id: String(vendor_id),
      jumlah: requestedTotal,
      tanggal: now,
      catatan: `ACC Request Lanjutan PO #${t.po_id}`
    });

    // Update Request status
    data.cmt_requests[reqIndex].status = "Selesai";
    data.cmt_requests[reqIndex].total_dipenuhi = requestedTotal;
    data.cmt_requests[reqIndex].catatan = "Di-ACC otomatis dari Standby Pool";

    writeData(data);
    return NextResponse.json({ success: true, message: "Pekerjaan berhasil ditugaskan ke vendor." });

  } catch (error) {
    console.error("Error ACC Downstream:", error);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}