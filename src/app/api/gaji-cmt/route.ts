import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";
import { computeVendorSalarySummary } from "@/lib/vendor-salary";
import { emitEvent } from "@/lib/realtime-hub";

export const dynamic = "force-dynamic";

// GET: list all salary records, optionally filtered by cmtId, with optional real-time calculation
export async function GET(req: NextRequest) {
  try {
    const data = readData();
    const { searchParams } = new URL(req.url);
    const cmtId = searchParams.get("cmtId");
    const includeRealtime =
      searchParams.get("includeRealtime") === "true" || searchParams.get("summary") === "true";

    let list = data.gaji_cmt || [];
    if (cmtId) {
      list = list.filter((g: any) => String(g.cmtId) === String(cmtId));
    }

    // Attach vendor info and PO info
    const enriched = list
      .map((g: any) => {
        const vendor = (data.vendors || []).find((v: any) => String(v.id) === String(g.cmtId));
        const targetPoId = g.poId ?? g.po_id;
        const po = (data.po_produksi || []).find((p: any) => String(p.id) === String(targetPoId));
        const rawAmt = Number(g.totalGaji ?? g.total ?? 0);
        const isPotongKlaim = g.metode === "potong_klaim" || rawAmt < 0;
        const amt = Math.abs(rawAmt);
        const isLunas = (g.status || "Lunas") === "Lunas";
        const dibayar = isPotongKlaim ? amt : Number(g.dibayar ?? (isLunas ? amt : 0));
        return {
          ...g,
          poId: targetPoId || null,
          isPotongKlaim,
          total: amt,
          totalGaji: isPotongKlaim ? -amt : amt,
          dibayar,
          sisaTagihan: Math.max(0, amt - dibayar),
          vendor_nama: vendor ? vendor.nama : g.vendor_nama || `Vendor #${g.cmtId}`,
          vendor_kode: vendor ? vendor.kodeVendor : "-",
          vendor_tipe: vendor ? vendor.tipe : "cmt",
          noPo: po ? po.noPo : g.noPo || "-",
          model: po ? po.model : g.model || "-",
          status: g.status || "Lunas",
          metode: isPotongKlaim ? "Potong Tagihan Klaim" : g.metode || "Transfer Bank",
        };
      })
      .sort((a: any, b: any) => new Date(b.tanggal || 0).getTime() - new Date(a.tanggal || 0).getTime());

    if (includeRealtime) {
      const vendors = cmtId
        ? (data.vendors || []).filter((v: any) => String(v.id) === String(cmtId))
        : (data.vendors || []);

      const vendorSummaries = vendors.map((v: any) => computeVendorSalarySummary(data, v));

      return NextResponse.json({
        list: enriched,
        summaries: vendorSummaries,
        summary: cmtId ? vendorSummaries[0] || null : null,
      });
    }

    return NextResponse.json(enriched);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST: Record new salary payment / payout
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = readData();
    if (!data.gaji_cmt) data.gaji_cmt = [];

    const { cmtId, poId, jumlahPcs, totalGaji, dibayar, metode, catatan, status, tanggal } = body;

    if (!cmtId || !totalGaji) {
      return NextResponse.json({ error: "cmtId dan totalGaji wajib diisi" }, { status: 400 });
    }

    const parsedCmtId = !isNaN(Number(cmtId)) ? Number(cmtId) : cmtId;
    const vendor = (data.vendors || []).find((v: any) => String(v.id) === String(parsedCmtId));
    let parsedPoId = poId ? (!isNaN(Number(poId)) ? Number(poId) : poId) : null;
    let resolvedNoPo = body.noPo || "";
    let resolvedModel = body.model || "";
    let resolvedPcs = Number(jumlahPcs || 0);

    // Jika poId tidak dipilih manual, cek apakah ada PO yang belum lunas milik vendor ini
    if (!parsedPoId && vendor) {
      const summary = computeVendorSalarySummary(data, vendor);
      const unpaidJobs = summary.rincianGajiPerPo.filter((j) => j.sisaHak > 0);
      if (unpaidJobs.length === 1) {
        parsedPoId = unpaidJobs[0].poId;
        resolvedNoPo = unpaidJobs[0].noPo;
        resolvedModel = unpaidJobs[0].model;
        if (!resolvedPcs) resolvedPcs = unpaidJobs[0].pcsSelesai;
      } else if (unpaidJobs.length > 1) {
        resolvedNoPo = unpaidJobs.map((j) => j.noPo).join(", ");
        resolvedModel = Array.from(new Set(unpaidJobs.map((j) => j.model))).join(", ");
        if (!resolvedPcs) resolvedPcs = unpaidJobs.reduce((s, j) => s + j.pcsSelesai, 0);
      }
    } else if (parsedPoId) {
      const po = (data.po_produksi || []).find((p: any) => String(p.id) === String(parsedPoId));
      if (po) {
        resolvedNoPo = po.noPo || resolvedNoPo;
        resolvedModel = po.model || resolvedModel;
      }
    }

    const id = nextId(data, "gaji_cmt" as any);
    const now = tanggal ? new Date(tanggal).toISOString() : new Date().toISOString();
    const isLunas = (status || "Lunas") === "Lunas";
    const paidAmt = dibayar !== undefined ? Number(dibayar) : isLunas ? Number(totalGaji) : 0;

    const newRecord = {
      id,
      cmtId: parsedCmtId,
      poId: parsedPoId,
      noPo: resolvedNoPo || "-",
      model: resolvedModel || "-",
      vendor_nama: vendor?.nama || `Vendor #${parsedCmtId}`,
      jumlahPcs: resolvedPcs,
      totalGaji: Number(totalGaji),
      dibayar: paidAmt,
      metode: metode || "Transfer Bank",
      catatan: catatan || `Pembayaran upah ${vendor?.nama || "Vendor"}${resolvedNoPo ? ` (${resolvedNoPo})` : ""}`,
      status: status || "Lunas",
      tanggal: now,
    };

    data.gaji_cmt.push(newRecord);
    writeData(data);

    emitEvent("salaryPaid", {
      id,
      vendor_id: Number(parsedCmtId),
      vendor_nama: vendor?.nama || "Vendor",
      po_id: parsedPoId,
      no_po: resolvedNoPo,
      total: Number(totalGaji),
      dibayar: paidAmt,
      metode: newRecord.metode,
      status: newRecord.status,
    });

    return NextResponse.json(newRecord);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PATCH: Update status, payment method, or notes
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const data = readData();
    if (!data.gaji_cmt) data.gaji_cmt = [];

    const { id, status, metode, catatan, totalGaji, dibayar } = body;

    if (!id) {
      return NextResponse.json({ error: "id wajib diisi" }, { status: 400 });
    }

    const idx = data.gaji_cmt.findIndex((g: any) => String(g.id) === String(id));
    if (idx === -1) {
      return NextResponse.json({ error: "Data gaji tidak ditemukan" }, { status: 404 });
    }

    if (status !== undefined) data.gaji_cmt[idx].status = status;
    if (metode !== undefined) data.gaji_cmt[idx].metode = metode;
    if (catatan !== undefined) data.gaji_cmt[idx].catatan = catatan;
    if (totalGaji !== undefined) data.gaji_cmt[idx].totalGaji = Number(totalGaji);
    if (dibayar !== undefined) data.gaji_cmt[idx].dibayar = Number(dibayar);
    else if (status === "Lunas" && data.gaji_cmt[idx].dibayar === undefined) {
      data.gaji_cmt[idx].dibayar = Number(data.gaji_cmt[idx].totalGaji || 0);
    }

    writeData(data);
    emitEvent("salaryUpdated", {
      id: data.gaji_cmt[idx].id,
      vendor_id: Number(data.gaji_cmt[idx].cmtId),
      status: data.gaji_cmt[idx].status,
    });
    return NextResponse.json(data.gaji_cmt[idx]);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE: Cancel or delete payout record
export async function DELETE(req: NextRequest) {
  try {
    const data = readData();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id wajib diisi" }, { status: 400 });
    }

    if (!data.gaji_cmt) return NextResponse.json({ success: true });

    const existing = data.gaji_cmt.find((g: any) => String(g.id) === String(id));
    data.gaji_cmt = data.gaji_cmt.filter((g: any) => String(g.id) !== String(id));
    writeData(data);

    if (existing) {
      emitEvent("salaryDeleted", {
        id: existing.id,
        vendor_id: Number(existing.cmtId),
      });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
