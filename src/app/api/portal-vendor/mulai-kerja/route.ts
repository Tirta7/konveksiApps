import { NextRequest, NextResponse } from "next/server";
import { readData, writeData } from "@/lib/data-store";
import { emitEvent } from "@/lib/realtime-hub";
import { vendorOwnershipError } from "@/lib/auth";

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, is_transfer, action, vendor_tipe, po_id } = body;

    if (!id || !action || !vendor_tipe || !po_id) {
      return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
    }

    const data = readData();

    // Otorisasi sebelum data diubah: vendor hanya boleh menyentuh pekerjaannya sendiri
    {
      const ownerVendorId = is_transfer
        ? (data.produksi_transfers || []).find((t: any) => String(t.id) === String(id))?.vendor_id
        : (data.po_produksi || []).find((p: any) => String(p.id) === String(id))?.vendorId;
      const authErr = vendorOwnershipError(req, ownerVendorId);
      if (authErr) return NextResponse.json({ error: authErr }, { status: 403 });
    }

    let targetSizeBreakdown = null;
    let vendor_id: any = null;
    let vendor_nama: string = "";
    let no_po: string = "";
    const nowIso = new Date().toISOString();

    if (is_transfer) {
      const idx = data.produksi_transfers.findIndex((t: any) => String(t.id) === String(id));
      if (idx === -1) return NextResponse.json({ error: "Data transfer tidak ditemukan" }, { status: 404 });

      const tf = data.produksi_transfers[idx];
      targetSizeBreakdown = tf.sizeBreakdown;
      vendor_id = tf.vendor_id;
      const v = data.vendors?.find((vend: any) => String(vend.id) === String(vendor_id));
      vendor_nama = v?.nama || "Vendor";
      const poObj = data.po_produksi?.find((p: any) => String(p.id) === String(po_id));
      no_po = poObj?.noPo || tf.no_po || `PO #${po_id}`;

      if (action === "mulai") {
        tf.status = "Dikerjakan";
        tf.mulai_kerja_at = nowIso;
      } else if (action === "batal") {
        tf.status = "Proses"; // Kembalikan ke Proses
        tf.mulai_kerja_at = null;
      }
    } else {
      const idx = data.po_produksi.findIndex((p: any) => String(p.id) === String(id));
      if (idx === -1) return NextResponse.json({ error: "Data PO tidak ditemukan" }, { status: 404 });

      const po = data.po_produksi[idx];
      vendor_id = po.vendorId;
      const v = data.vendors?.find((vend: any) => String(vend.id) === String(vendor_id));
      vendor_nama = v?.nama || "Vendor";
      no_po = po.noPo || `PO #${po.id}`;

      if (action === "mulai") {
        po.status = "Dikerjakan";
        po.mulai_kerja_at = nowIso;
      } else if (action === "batal") {
        po.status = "Proses";
        po.mulai_kerja_at = null;
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

    // Emit event realtime to all connected clients
    emitEvent("vendorWorking", {
      action,
      vendor_id,
      vendor_nama,
      po_id,
      no_po,
      vendor_tipe,
      is_transfer: !!is_transfer,
      mulai_kerja_at: action === "mulai" ? nowIso : null
    });

    return NextResponse.json({ 
      success: true, 
      status: action === "mulai" ? "Dikerjakan" : "Proses",
      mulai_kerja_at: action === "mulai" ? nowIso : null
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
