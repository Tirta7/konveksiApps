import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";

// GET: list all salary records, optionally filtered by cmtId
export async function GET(req: NextRequest) {
  try {
    const data = readData();
    const { searchParams } = new URL(req.url);
    const cmtId = searchParams.get("cmtId");

    let list = data.gaji_cmt || [];
    if (cmtId) {
      list = list.filter((g: any) => String(g.cmtId) === String(cmtId));
    }

    // Attach vendor info and PO info
    const enriched = list.map((g: any) => {
      const vendor = (data.vendors || []).find((v: any) => String(v.id) === String(g.cmtId));
      const po = (data.po_produksi || []).find((p: any) => String(p.id) === String(g.poId));
      return {
        ...g,
        vendor_nama: vendor ? vendor.nama : (g.vendor_nama || `Vendor #${g.cmtId}`),
        vendor_kode: vendor ? vendor.kodeVendor : "-",
        noPo: po ? po.noPo : (g.noPo || "-"),
        model: po ? po.model : (g.model || "-"),
        status: g.status || "Lunas",
        metode: g.metode || "Transfer Bank"
      };
    }).reverse();

    return NextResponse.json(enriched);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST: Record new salary payment / payout
export async function POST(req: NextRequest) {
  try {
    const data = readData();
    if (!data.gaji_cmt) data.gaji_cmt = [];

    const body = await req.json();
    const { cmtId, poId, jumlahPcs, totalGaji, metode, catatan, status, tanggal } = body;

    if (!cmtId || !totalGaji) {
      return NextResponse.json({ error: "cmtId dan totalGaji wajib diisi" }, { status: 400 });
    }

    const id = nextId(data, "gaji_cmt" as any);
    const now = tanggal || new Date().toISOString();

    const parsedCmtId = !isNaN(Number(cmtId)) ? Number(cmtId) : cmtId;
    const parsedPoId = poId ? (!isNaN(Number(poId)) ? Number(poId) : poId) : null;

    const newRecord = {
      id,
      cmtId: parsedCmtId,
      poId: parsedPoId,
      jumlahPcs: Number(jumlahPcs || 0),
      totalGaji: Number(totalGaji),
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
    const data = readData();
    if (!data.gaji_cmt) data.gaji_cmt = [];

    const body = await req.json();
    const { id, status, metode, catatan, totalGaji } = body;

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
