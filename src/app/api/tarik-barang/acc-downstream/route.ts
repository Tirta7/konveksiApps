import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";
import { toSizeMap, deductHolding } from "@/lib/stock";
import { poolAvailability, isOpenPool, OPEN_REQUEST, requestRemaining, markSourceChange } from "@/lib/pool-guard";
import { emitEvent } from "@/lib/realtime-hub";

/**
 * POST /api/tarik-barang/acc-downstream
 * Admin meng-ACC permintaan vendor lanjutan (Washing, Finishing, dst) dari Standby Pool.
 * Validasi atomik: permintaan masih terbuka, pool masih ada isinya, per-size cukup,
 * dan tidak memakan stok yang sudah dipesan vendor lain.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = readData(); // baca setelah body → data terbaru
    const { request_id, transfer_id, sizeBreakdown, vendor_id, catatan, actor } = body;

    if (!request_id || !transfer_id || !Array.isArray(sizeBreakdown) || !vendor_id) {
      return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
    }

    const cmtReq = (data.cmt_requests || []).find((r: any) => String(r.id) === String(request_id));
    if (!cmtReq) return NextResponse.json({ code: "STALE", error: "Permintaan tidak ditemukan (mungkin dibatalkan vendor)." }, { status: 409 });
    if (!OPEN_REQUEST.has(cmtReq.status)) {
      return NextResponse.json({ code: "STALE", error: `Permintaan ini sudah diproses (status: ${cmtReq.status}).` }, { status: 409 });
    }
    if (String(cmtReq.vendor_id) !== String(vendor_id)) {
      return NextResponse.json({ error: "Vendor tidak sesuai dengan permintaan" }, { status: 400 });
    }

    const t = (data.produksi_transfers || []).find((x: any) => String(x.id) === String(transfer_id));
    if (!t || !isOpenPool(t)) {
      return NextResponse.json({
        code: "POOL_TAKEN",
        error: `Stok standby ini sudah habis / sudah dialokasikan${t?.last_change ? ` (${t.last_change.desc} oleh ${t.last_change.by})` : ""}.`,
        last_change: t?.last_change || null,
      }, { status: 409 });
    }

    const clean = sizeBreakdown
      .map((b: any) => ({ size: String(b.size), jumlah: Number(b.jumlah || 0) }))
      .filter((b: any) => b.jumlah > 0);
    const requestedTotal = clean.reduce((sum: number, b: any) => sum + b.jumlah, 0);
    if (requestedTotal <= 0) return NextResponse.json({ error: "Jumlah alokasi harus lebih dari 0" }, { status: 400 });

    const sisaReq = requestRemaining(cmtReq);
    if (requestedTotal > sisaReq) {
      return NextResponse.json({ error: `Melebihi sisa permintaan vendor (${sisaReq} pcs)` }, { status: 400 });
    }

    // Stok bebas = isi pool − permintaan vendor LAIN yang masih menunggu
    const avail = poolAvailability(data, t, cmtReq.id);
    if (requestedTotal > avail.total) {
      return NextResponse.json({ code: "STALE", error: `Stok standby sekarang tinggal ${avail.total} pcs.`, current_total: avail.total, current_sizes: avail.sizes }, { status: 409 });
    }
    const pm = toSizeMap(avail.sizes);
    const over = avail.sizes.length ? clean.find((b: any) => b.jumlah > (pm[b.size] || 0)) : null;
    if (over) return NextResponse.json({ code: "STALE", error: `Size ${over.size} tinggal ${pm[over.size] || 0} pcs.`, current_sizes: avail.sizes }, { status: 409 });

    const now = new Date().toISOString();

    // ── Tulis (sinkron, atomik) ──
    const used = toSizeMap(clean);
    deductHolding(t, "pool", used, requestedTotal);
    t.forwarded_qty = Number(t.forwarded_qty || 0) + requestedTotal;
    if (Number(t.jumlah_kirim || 0) <= 0) t.status = "Ditarik Penuh";
    const vendor = (data.vendors || []).find((v: any) => String(v.id) === String(vendor_id));
    markSourceChange(t, `${requestedTotal} pcs di-ACC untuk ${vendor?.nama || "vendor"}`, actor || "Admin");

    const newTransfer = {
      id: nextId(data, "produksi_transfers" as any),
      po_id: t.po_id,
      dari: t.dari,
      ke: t.ke,
      vendor_id: Number(vendor_id),
      dari_vendor_id: t.dari_vendor_id,
      transfer_id_asal: t.id,
      jumlah_kirim: requestedTotal,
      sizeBreakdown: clean,
      catatan: catatan || "ACC Request",
      status: "Proses",
      tanggal_kirim: now,
    };
    data.produksi_transfers.push(newTransfer);

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

    const newDipenuhi = Number(cmtReq.total_dipenuhi || 0) + requestedTotal;
    const totalRequest = Number(cmtReq.total_request || 0);
    cmtReq.total_dipenuhi = newDipenuhi;
    cmtReq.diproses_at = now;
    if (newDipenuhi >= totalRequest) {
      cmtReq.status = "Selesai";
      cmtReq.catatan = "Di-ACC otomatis dari Standby Pool";
    } else {
      cmtReq.status = "Sebagian";
      cmtReq.catatan = `Di-ACC sebagian: ${newDipenuhi}/${totalRequest} pcs. Sisa ${totalRequest - newDipenuhi} pcs menunggu stok.`;
    }

    writeData(data);

    const po = (data.po_produksi || []).find((p: any) => p.id === t.po_id);
    emitEvent("requestUpdated", { id: cmtReq.id, vendor_id: cmtReq.vendor_id, status: cmtReq.status, total_dipenuhi: newDipenuhi, no_po: po?.noPo || "" });
    emitEvent("poolAllocated", { transfer_id: t.id, po_id: t.po_id, no_po: po?.noPo || "", jumlah: requestedTotal, sisa: t.jumlah_kirim, ke: vendor?.nama || "vendor", vendor_id: Number(vendor_id), by: actor || "Admin" });

    return NextResponse.json({ success: true, message: "Pekerjaan berhasil ditugaskan ke vendor." });
  } catch (error) {
    console.error("Error ACC Downstream:", error);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}