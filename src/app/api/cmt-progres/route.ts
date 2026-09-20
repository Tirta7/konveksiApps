import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";

export async function GET(req: NextRequest) {
  const data = readData();
  if (!data.cmt_progres) data.cmt_progres = [];
  const { searchParams } = new URL(req.url);
  const vendorId = searchParams.get("vendor_id");
  const status = searchParams.get("status");
  let list = data.cmt_progres;
  if (vendorId) list = list.filter((p: any) => String(p.vendor_id) === vendorId);
  if (status) list = list.filter((p: any) => p.status === status);
  const withInfo = list.map((p: any) => {
    const vendor = (data.vendors || []).find((v: any) => v.id === p.vendor_id);
    const po = (data.po_produksi || []).find((po: any) => po.id === p.po_id);
    return { ...p, vendor_nama: vendor?.nama || "Unknown", noPo: po?.noPo || "-", model: po?.model || "-" };
  }).reverse();
  return NextResponse.json(withInfo);
}

export async function POST(req: NextRequest) {
  const data = readData();
  if (!data.cmt_progres) data.cmt_progres = [];
  const body = await req.json();
  const { po_id, vendor_id, items, catatan } = body;
  if (!po_id || !vendor_id || !items?.length) return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
  const totalJumlah = items.reduce((sum: number, i: any) => sum + Number(i.jumlah), 0);
  const newId = nextId(data, "cmt_progres" as any);

  // Update barcode_item: mark N items per size as "cmt" (in progress at CMT)
  if (data.barcode_item) {
    for (const item of items) {
      const { size, jumlah } = item;
      let updated = 0;
      for (let i = 0; i < data.barcode_item.length && updated < Number(jumlah); i++) {
        const b = data.barcode_item[i];
        if (String(b.poId) === String(po_id) && b.size === size && b.status === "potong") {
          data.barcode_item[i].status = "cmt";
          updated++;
        }
      }
    }
  }

  data.cmt_progres.push({ id: newId, po_id: Number(po_id), vendor_id: Number(vendor_id), items, totalJumlah, catatan: catatan || "", status: "Menunggu", createdAt: new Date().toISOString() });
  writeData(data);
  return NextResponse.json({ success: true, id: newId });
}

export async function PATCH(req: NextRequest) {
  const data = readData();
  if (!data.cmt_progres) data.cmt_progres = [];
  if (!data.po_pengambilan) data.po_pengambilan = [];
  const body = await req.json();
  const { id, action } = body;
  const idx = data.cmt_progres.findIndex((p: any) => String(p.id) === String(id));
  if (idx === -1) return NextResponse.json({ error: "Laporan tidak ditemukan" }, { status: 404 });
  const laporan = data.cmt_progres[idx];

  // TOLAK: revert barcode status back to potong
  if (action === "tolak") {
    if (laporan.status === "Diterima") return NextResponse.json({ error: "Laporan sudah diterima, tidak bisa ditolak" }, { status: 400 });
    // Revert barcode_item: cmt → potong
    if (data.barcode_item) {
      for (const item of (laporan.items || [])) {
        const { size, jumlah } = item;
        let reverted = 0;
        for (let i = 0; i < data.barcode_item.length && reverted < Number(jumlah); i++) {
          const b = data.barcode_item[i];
          if (String(b.poId) === String(laporan.po_id) && b.size === size && b.status === "cmt") {
            data.barcode_item[i].status = "potong";
            reverted++;
          }
        }
      }
    }
    data.cmt_progres[idx].status = "Ditolak";
    data.cmt_progres[idx].ditolakPada = new Date().toISOString();
    writeData(data);
    return NextResponse.json({ success: true });
  }

  // TERIMA (default action)
  if (laporan.status === "Diterima") return NextResponse.json({ error: "Laporan sudah diterima" }, { status: 400 });
  data.cmt_progres[idx].status = "Diterima";
  data.cmt_progres[idx].diterimaPada = new Date().toISOString();

  // Update barcode_item: move from "cmt" → "gudang" for accepted items per size
  if (data.barcode_item) {
    for (const item of (laporan.items || [])) {
      const { size, jumlah } = item;
      let updated = 0;
      for (let i = 0; i < data.barcode_item.length && updated < Number(jumlah); i++) {
        const b = data.barcode_item[i];
        if (String(b.poId) === String(laporan.po_id) && b.size === size && (b.status === "cmt" || b.status === "potong")) {
          data.barcode_item[i].status = "gudang";
          updated++;
        }
      }
    }
  }

  // Create po_pengambilan record
  const pengambilanId = nextId(data, "po_pengambilan");
  data.po_pengambilan.push({ id: pengambilanId, poId: laporan.po_id, jumlahDiambil: laporan.totalJumlah, items: laporan.items, tanggal: new Date().toISOString(), keterangan: `Laporan progres — ${laporan.catatan || ""}`.trim(), laporanId: laporan.id });
  // Create produksi_transfer: cmt -> gudang (status Kirim, gudang perlu verifikasi)
  if (!data.produksi_transfers) data.produksi_transfers = [];
  const transferId = nextId(data, "produksi_transfers" as any);
  data.produksi_transfers.push({
    id: transferId,
    po_id: laporan.po_id,
    dari: "cmt",
    ke: "gudang",
    vendor_id: laporan.vendor_id,
    jumlah_kirim: laporan.totalJumlah,
    jumlah_diterima: null,
    sizeBreakdown: laporan.items,
    sizeBreakdown_diterima: null,
    catatan: laporan.catatan || "",
    status: "Kirim",
    tanggal_kirim: new Date().toISOString(),
    tanggal_terima: null
  });
  writeData(data);
  return NextResponse.json({ success: true });
}

