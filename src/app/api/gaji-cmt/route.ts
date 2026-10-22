import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";

// GET: list all salary records, optionally filtered by cmtId, with optional real-time calculation
export async function GET(req: NextRequest) {
  try {
    const data = readData();
    const { searchParams } = new URL(req.url);
    const cmtId = searchParams.get("cmtId");
    const includeRealtime = searchParams.get("includeRealtime") === "true" || searchParams.get("summary") === "true";

    let list = data.gaji_cmt || [];
    if (cmtId) {
      list = list.filter((g: any) => String(g.cmtId) === String(cmtId));
    }

    // Attach vendor info and PO info
    const enriched = list.map((g: any) => {
      const vendor = (data.vendors || []).find((v: any) => String(v.id) === String(g.cmtId));
      const po = (data.po_produksi || []).find((p: any) => String(p.id) === String(g.poId));
      const amt = Number(g.totalGaji ?? g.total ?? 0);
      const isLunas = g.status === "Lunas";
      const dibayar = Number(g.dibayar ?? (isLunas ? amt : 0));
      return {
        ...g,
        total: amt,
        totalGaji: amt,
        dibayar,
        sisaTagihan: Math.max(0, amt - dibayar),
        vendor_nama: vendor ? vendor.nama : (g.vendor_nama || `Vendor #${g.cmtId}`),
        vendor_kode: vendor ? vendor.kodeVendor : "-",
        noPo: po ? po.noPo : (g.noPo || "-"),
        model: po ? po.model : (g.model || "-"),
        status: g.status || "Lunas",
        metode: g.metode || "Transfer Bank"
      };
    }).reverse();

    if (includeRealtime) {
      // Calculate real-time earned wages
      const vendors = cmtId
        ? (data.vendors || []).filter((v: any) => String(v.id) === String(cmtId))
        : (data.vendors || []);

      const vendorSummaries = vendors.map((v: any) => {
        const vPos = (data.po_produksi || []).filter((p: any) => String(p.vendorId) === String(v.id));
        const vGaji = (data.gaji_cmt || []).filter((g: any) => String(g.cmtId) === String(v.id));

        let totalPcs = 0;
        let totalHakGaji = 0;
        const poDetails: any[] = [];

        for (const po of vPos) {
          const reports = (data.cmt_progres || []).filter(
            (p: any) => String(p.po_id) === String(po.id) && (po.vendorId == null || String(p.vendor_id) === String(po.vendorId))
          );
          const approvedPcs = reports
            .filter((r: any) => r.status === "Diterima" || r.status === "Diverifikasi" || r.status === "selesai")
            .reduce((s: number, r: any) => s + (r.items?.reduce((is: number, i: any) => is + Number(i.jumlah || 0), 0) || Number(r.totalJumlah || 0)), 0);

          let tarif = Number(po.hargaPerPcs || (v.tarifPotongan && v.tarifPotongan[po.model]) || v.hargaPerPcs || 5000);
          const subtotal = approvedPcs * tarif;
          totalPcs += approvedPcs;
          totalHakGaji += subtotal;

          const paidForPo = vGaji
            .filter((g: any) => String(g.poId) === String(po.id))
            .reduce((s: number, g: any) => s + Number(g.dibayar ?? (g.status === "Lunas" ? (g.totalGaji || g.total || 0) : 0)), 0);

          poDetails.push({
            poId: po.id,
            noPo: po.noPo,
            model: po.model,
            targetPcs: po.jumlahTerbit,
            pcsSelesai: approvedPcs,
            tarif,
            subtotal,
            dibayar: paidForPo,
            sisa: Math.max(0, subtotal - paidForPo),
            statusBayar: subtotal === 0 ? "Belum Ada Pcs" : (paidForPo >= subtotal ? "Lunas" : (paidForPo > 0 ? "Sebagian" : "Siap Cair"))
          });
        }

        const totalDibayar = vGaji.reduce(
          (s: number, g: any) => s + Number(g.dibayar ?? (g.status === "Lunas" ? (g.totalGaji || g.total || 0) : 0)),
          0
        );
        const sisaHak = Math.max(0, totalHakGaji - totalDibayar);

        return {
          vendorId: v.id,
          vendorNama: v.nama,
          kodeVendor: v.kodeVendor || "-",
          tarifDasar: v.hargaPerPcs || 5000,
          tarifPotongan: v.tarifPotongan || {},
          totalPcs,
          totalHakGaji,
          totalDibayar,
          sisaHak,
          poDetails
        };
      });

      return NextResponse.json({
        list: enriched,
        summaries: vendorSummaries,
        summary: cmtId ? vendorSummaries[0] || null : null
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

    const id = nextId(data, "gaji_cmt" as any);
    const now = tanggal || new Date().toISOString();

    const parsedCmtId = !isNaN(Number(cmtId)) ? Number(cmtId) : cmtId;
    const parsedPoId = poId ? (!isNaN(Number(poId)) ? Number(poId) : poId) : null;
    const isLunas = (status || "Lunas") === "Lunas";
    const paidAmt = dibayar !== undefined ? Number(dibayar) : (isLunas ? Number(totalGaji) : 0);

    const newRecord = {
      id,
      cmtId: parsedCmtId,
      poId: parsedPoId,
      jumlahPcs: Number(jumlahPcs || 0),
      totalGaji: Number(totalGaji),
      dibayar: paidAmt,
      metode: metode || "Transfer Bank",
      catatan: catatan || "",
      status: status || "Lunas",
      tanggal: now
    };

    data.gaji_cmt.push(newRecord);
    writeData(data);

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

    data.gaji_cmt = data.gaji_cmt.filter((g: any) => String(g.id) !== String(id));
    writeData(data);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
