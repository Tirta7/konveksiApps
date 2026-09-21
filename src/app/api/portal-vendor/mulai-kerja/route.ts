import { NextRequest, NextResponse } from "next/server";
import { readData, writeData } from "@/lib/data-store";

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, is_transfer, action, vendor_tipe, po_id } = body;

    if (!id || !action || !vendor_tipe || !po_id) {
      return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
    }

    const data = readData();

    let targetSizeBreakdown = null;

    if (is_transfer) {
      const idx = data.produksi_transfers.findIndex((t: any) => String(t.id) === String(id));
      if (idx === -1) return NextResponse.json({ error: "Data transfer tidak ditemukan" }, { status: 404 });

      targetSizeBreakdown = data.produksi_transfers[idx].sizeBreakdown;

      if (action === "mulai") {
        data.produksi_transfers[idx].status = "Dikerjakan";
      } else if (action === "batal") {
        data.produksi_transfers[idx].status = "Proses"; // Kembalikan ke Proses
      }
    } else {
      const idx = data.po_produksi.findIndex((p: any) => String(p.id) === String(id));
      if (idx === -1) return NextResponse.json({ error: "Data PO tidak ditemukan" }, { status: 404 });

      if (action === "mulai") {
        data.po_produksi[idx].status = "Dikerjakan";
      } else if (action === "batal") {
        data.po_produksi[idx].status = "Proses";
      }
    }

    // Update barcode_item status
    if (data.barcode_item) {
      const targetStatusBefore = vendor_tipe; // e.g., "washing", "cmt"
      const targetStatusAfter = `${vendor_tipe}_dikerjakan`; // e.g., "washing_dikerjakan", "cmt_dikerjakan"

      let updatedCount: Record<string, number> = {};

      for (const b of data.barcode_item) {
        if (String(b.poId) === String(po_id)) {
          
          // If we have size breakdown (downstream), check if we still need to update this size
          if (targetSizeBreakdown) {
            const sizeLimitObj = targetSizeBreakdown.find((s: any) => s.size === b.size);
            if (!sizeLimitObj) continue; // Skip if this size is not in the transfer
            const limit = Number(sizeLimitObj.jumlah || sizeLimitObj.max || 0);
            const currentUpdated = updatedCount[b.size] || 0;
            if (currentUpdated >= limit) continue; // Already updated enough of this size
          }

          // Normalizer for CMT
          const isCMT = vendor_tipe === "cmt" || vendor_tipe === "jahit";
          const currentIsCmt = b.status === "cmt" || b.status === "potong";
          const currentIsCmtDikerjakan = b.status === "cmt_dikerjakan" || b.status === "jahit_dikerjakan";
          
          // Downstream might still be in "gudang" or "standby" due to missing status update during ACC Request
          const isDownstreamBefore = b.status === targetStatusBefore || b.status === "gudang" || b.status === "standby";

          if (action === "mulai") {
            if (isCMT && currentIsCmt) {
              b.status = "cmt_dikerjakan";
              updatedCount[b.size] = (updatedCount[b.size] || 0) + 1;
            } else if (!isCMT && isDownstreamBefore) {
              b.status = targetStatusAfter;
              updatedCount[b.size] = (updatedCount[b.size] || 0) + 1;
            }
          } else if (action === "batal") {
            if (isCMT && currentIsCmtDikerjakan) {
              b.status = "cmt"; // Default back to "cmt"
              updatedCount[b.size] = (updatedCount[b.size] || 0) + 1;
            } else if (!isCMT && b.status === targetStatusAfter) {
              b.status = targetStatusBefore;
              updatedCount[b.size] = (updatedCount[b.size] || 0) + 1;
            }
          }
        }
      }
    }

    writeData(data);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
