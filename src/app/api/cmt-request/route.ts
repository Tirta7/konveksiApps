import { NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";

// GET: list all requests (admin) or by vendor_id (cmt)
export async function GET(req: Request) {
  const data = readData();
  const { searchParams } = new URL(req.url);
  const vendorId = searchParams.get("vendor_id");

  let requests = data.cmt_requests || [];

  if (vendorId) {
    requests = requests.filter((r: any) => String(r.vendor_id) === vendorId);
  }

  // Attach vendor name + pemotongan cross-reference
  const withNames = requests.map((r: any) => {
    const vendor = (data.vendors || []).find((v: any) => v.id === r.vendor_id);
    const pemo = r.pemotongan_id
      ? (data.pemotongan_kain || []).find((p: any) => p.id === r.pemotongan_id)
      : null;
    const transfer = r.transfer_id
      ? (data.produksi_transfers || []).find((t: any) => t.id === r.transfer_id)
      : null;
      
    let mockPemotongan = null;
    if (pemo) {
      mockPemotongan = {
        id: pemo.id,
        nama_barang: pemo.nama_barang,
        model: pemo.model,
        tanggal: pemo.tanggal,
        total_pcs: pemo.total_pcs,
        sisa_total: (pemo.sizeBreakdown || []).reduce((s: number, x: any) => s + (x.sisa || 0), 0),
        sizeBreakdown: pemo.sizeBreakdown,
        is_transfer: false
      };
    } else if (transfer) {
      const po = (data.po_produksi || []).find((p:any) => p.id === transfer.po_id);
      mockPemotongan = {
        id: transfer.id, // For UI selection
        nama_barang: po ? po.noPo : "Transfer Produksi",
        model: po ? po.model : "Unknown",
        tanggal: transfer.tanggal_kirim,
        total_pcs: transfer.jumlah_kirim,
        // Calculate remaining pieces in the standby pool (in case another request took some)
        // Wait, for Standby pool, jumlah_kirim IS the remaining pieces when it's created or updated.
        sisa_total: transfer.jumlah_kirim, 
        sizeBreakdown: transfer.sizeBreakdown || [],
        is_transfer: true,
        transfer_id: transfer.id,
        po_id: transfer.po_id
      };
    }

    return {
      ...r,
      vendor_nama: vendor?.nama || "Unknown",
      vendor_kode: vendor?.kode || "-",
      vendor_tipe: vendor?.tipe || "cmt",
      pemotongan: mockPemotongan,
    };
  }).reverse();

  return NextResponse.json(withNames);
}

// POST: CMT submits a request
export async function POST(req: Request) {
  const data = readData();
  if (!data.cmt_requests) data.cmt_requests = [];

  const body = await req.json();
  const { vendor_id, total_request, catatan, pemotongan_id, transfer_id } = body;

  if (!vendor_id || !total_request) {
    return NextResponse.json({ error: "vendor_id dan total_request wajib diisi" }, { status: 400 });
  }

  const newId = nextId(data, "cmt_requests" as any);
  data.cmt_requests.push({
    id: newId,
    vendor_id: Number(vendor_id),
    total_request: Number(total_request),
    total_dipenuhi: 0,
    catatan: catatan || "",
    pemotongan_id: pemotongan_id ? Number(pemotongan_id) : null, transfer_id: transfer_id ? Number(transfer_id) : null,
    status: "Pending",
    createdAt: new Date().toISOString()
  });

  writeData(data);
  return NextResponse.json({ success: true, id: newId });
}


// PUT: Admin or CMT updates request (pemenuhan / penolakan / edit)
export async function PUT(req: Request) {
  const data = readData();
  const body = await req.json();
  const { id, status, total_dipenuhi, alasan_tolak, total_request, catatan } = body;

  const reqIndex = data.cmt_requests.findIndex((r: any) => String(r.id) === String(id));
  if (reqIndex === -1) {
    return NextResponse.json({ error: "Request tidak ditemukan" }, { status: 404 });
  }

  if (status !== undefined) data.cmt_requests[reqIndex].status = status;
  if (total_dipenuhi !== undefined) data.cmt_requests[reqIndex].total_dipenuhi = Number(total_dipenuhi);
  if (alasan_tolak !== undefined) data.cmt_requests[reqIndex].alasan_tolak = alasan_tolak;
  
  // CMT edits
  if (total_request !== undefined) data.cmt_requests[reqIndex].total_request = Number(total_request);
  if (catatan !== undefined) data.cmt_requests[reqIndex].catatan = catatan;

  writeData(data);
  return NextResponse.json({ success: true });
}

// DELETE: CMT cancels/deletes request
export async function DELETE(req: Request) {
  const data = readData();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "id wajib diisi" }, { status: 400 });

  if (!data.cmt_requests) return NextResponse.json({ success: true });

  data.cmt_requests = data.cmt_requests.filter((r: any) => String(r.id) !== id);
  writeData(data);
  return NextResponse.json({ success: true });
}
