import { NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";
import { poolAvailability, OPEN_REQUEST, requestRemaining } from "@/lib/pool-guard";
import { emitEvent } from "@/lib/realtime-hub";
import { getSessionFromRequest } from "@/lib/auth";

// GET: list all requests (admin) or by vendor_id (cmt)
export async function GET(req: Request) {
  const data = readData();
  const { searchParams } = new URL(req.url);
  const sess = getSessionFromRequest(req);
  // Sesi vendor selalu dibatasi ke request miliknya sendiri
  const vendorId = sess?.t === "vendor" ? String(sess.id) : searchParams.get("vendor_id");

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

// POST: Vendor mengajukan permintaan kerjaan
// Validasi atomik terhadap stok saat ini: stok yang baru saja dialokasikan admin / sudah dipesan vendor lain
// tidak bisa diminta lagi (cegah bentrok).
export async function POST(req: Request) {
  const body = await req.json();
  const data = readData();
  if (!data.cmt_requests) data.cmt_requests = [];
  const { vendor_id, total_request, catatan, pemotongan_id, transfer_id } = body;

  const sess = getSessionFromRequest(req);
  if (sess?.t === "vendor" && String(vendor_id) !== String(sess.id)) {
    return NextResponse.json({ error: "Akses ditolak: request harus atas nama akun vendor Anda" }, { status: 403 });
  }

  if (!vendor_id || !total_request || Number(total_request) <= 0) {
    return NextResponse.json({ error: "vendor_id dan total_request wajib diisi" }, { status: 400 });
  }
  const vendor = (data.vendors || []).find((v: any) => String(v.id) === String(vendor_id));
  const qty = Number(total_request);

  let poId: number | null = null;
  if (transfer_id) {
    const t = (data.produksi_transfers || []).find((x: any) => String(x.id) === String(transfer_id));
    if (!t) return NextResponse.json({ code: "POOL_TAKEN", error: "Stok ini sudah tidak tersedia (baru saja dialokasikan admin)." }, { status: 409 });
    poId = t.po_id;
    const avail = poolAvailability(data, t);
    if (avail.total <= 0) {
      return NextResponse.json({
        code: "POOL_TAKEN",
        error: `Stok PO ini baru saja dialokasikan admin${t.last_change ? ` (${t.last_change.desc})` : ""}. Silakan pilih stok lain.`,
        last_change: t.last_change || null,
      }, { status: 409 });
    }
    const mine = avail.reservations.filter(r => String(r.vendor_id) === String(vendor_id));
    if (mine.length) {
      return NextResponse.json({ code: "DUPLICATE", error: `Anda masih punya permintaan ${mine[0].sisa} pcs untuk stok ini yang menunggu admin.` }, { status: 409 });
    }
    if (qty > avail.free) {
      return NextResponse.json({
        code: "INSUFFICIENT",
        error: avail.free > 0
          ? `Stok bebas tinggal ${avail.free} pcs (${avail.reserved} pcs sudah diminta vendor lain).`
          : `Seluruh stok (${avail.total} pcs) sudah diminta vendor lain dan menunggu admin.`,
        free: avail.free,
        total: avail.total,
      }, { status: 409 });
    }
  } else if (pemotongan_id) {
    const p = (data.pemotongan_kain || []).find((x: any) => String(x.id) === String(pemotongan_id));
    if (!p) return NextResponse.json({ code: "POOL_TAKEN", error: "Batch potongan tidak ditemukan" }, { status: 409 });
    const sisa = (p.sizeBreakdown || []).reduce((s: number, x: any) => s + Number(x.sisa || 0), 0);
    const reserved = (data.cmt_requests || [])
      .filter((r: any) => String(r.pemotongan_id) === String(p.id) && OPEN_REQUEST.has(r.status))
      .reduce((s: number, r: any) => s + requestRemaining(r), 0);
    if (qty > Math.max(0, sisa - reserved)) {
      return NextResponse.json({ code: "INSUFFICIENT", error: `Stok potongan bebas tinggal ${Math.max(0, sisa - reserved)} pcs.` }, { status: 409 });
    }
  }

  const newId = nextId(data, "cmt_requests" as any);
  data.cmt_requests.push({
    id: newId,
    vendor_id: Number(vendor_id),
    total_request: qty,
    total_dipenuhi: 0,
    catatan: catatan || "",
    pemotongan_id: pemotongan_id ? Number(pemotongan_id) : null, transfer_id: transfer_id ? Number(transfer_id) : null,
    status: "Pending",
    createdAt: new Date().toISOString()
  });

  writeData(data);
  const po = poId != null ? (data.po_produksi || []).find((p: any) => p.id === poId) : null;
  emitEvent("vendorRequest", {
    id: newId,
    vendor_id: Number(vendor_id),
    vendor_nama: vendor?.nama || "Vendor",
    vendor_tipe: vendor?.tipe || "",
    total: qty,
    transfer_id: transfer_id ? Number(transfer_id) : null,
    po_id: poId,
    no_po: po?.noPo || "",
  });
  return NextResponse.json({ success: true, id: newId });
}


// PUT: Admin or CMT updates request (pemenuhan / penolakan / edit)
export async function PUT(req: Request) {
  const body = await req.json();
  const data = readData();
  const { id, status, total_dipenuhi, alasan_tolak, total_request, catatan } = body;

  const reqIndex = (data.cmt_requests || []).findIndex((r: any) => String(r.id) === String(id));
  if (reqIndex === -1) {
    return NextResponse.json({ error: "Request tidak ditemukan" }, { status: 404 });
  }
  const r = data.cmt_requests[reqIndex];

  // Vendor hanya boleh mengedit jumlah / catatan request miliknya; pemenuhan & penolakan khusus admin
  const sess = getSessionFromRequest(req);
  if (sess?.t === "vendor") {
    if (String(r.vendor_id) !== String(sess.id)) return NextResponse.json({ error: "Akses ditolak: request ini bukan milik Anda" }, { status: 403 });
    if (status !== undefined || total_dipenuhi !== undefined || alasan_tolak !== undefined) {
      return NextResponse.json({ error: "Akses ditolak: pemenuhan / penolakan request hanya oleh admin" }, { status: 403 });
    }
  }

  // Vendor mengedit jumlah: hanya selama masih Pending & belum dipenuhi
  if (total_request !== undefined && (r.status !== "Pending" || Number(r.total_dipenuhi || 0) > 0)) {
    return NextResponse.json({ code: "STALE", error: `Permintaan sudah diproses admin (status: ${r.status}).` }, { status: 409 });
  }
  // Admin menolak permintaan yang sudah selesai/ditolak
  if (status === "Ditolak" && !OPEN_REQUEST.has(r.status)) {
    return NextResponse.json({ code: "STALE", error: `Permintaan sudah berstatus ${r.status}.` }, { status: 409 });
  }

  if (status !== undefined) r.status = status;
  if (total_dipenuhi !== undefined) r.total_dipenuhi = Number(total_dipenuhi);
  if (alasan_tolak !== undefined) r.alasan_tolak = alasan_tolak;
  if (total_request !== undefined) r.total_request = Number(total_request);
  if (catatan !== undefined) r.catatan = catatan;
  if (status !== undefined) r.diproses_at = new Date().toISOString();

  writeData(data);
  if (status !== undefined) emitEvent("requestUpdated", { id: r.id, vendor_id: r.vendor_id, status: r.status, alasan: r.alasan_tolak || "", total_dipenuhi: r.total_dipenuhi });
  return NextResponse.json({ success: true });
}

// DELETE: Batalkan / hapus permohonan (Pending atau Ditolak)
export async function DELETE(req: Request) {
  const data = readData();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "id wajib diisi" }, { status: 400 });
  if (!data.cmt_requests) return NextResponse.json({ success: true });

  const r = data.cmt_requests.find((x: any) => String(x.id) === id);
  if (!r) return NextResponse.json({ success: true });
  const sess = getSessionFromRequest(req);
  if (sess?.t === "vendor" && String(r.vendor_id) !== String(sess.id)) {
    return NextResponse.json({ error: "Akses ditolak: request ini bukan milik Anda" }, { status: 403 });
  }
  if (r.status !== "Pending" && r.status !== "Ditolak") {
    return NextResponse.json({ code: "STALE", error: `Tidak bisa dihapus: permintaan sedang aktif atau sudah selesai (status: ${r.status}).` }, { status: 409 });
  }

  data.cmt_requests = data.cmt_requests.filter((x: any) => String(x.id) !== id);
  writeData(data);
  emitEvent("requestUpdated", { id: r.id, vendor_id: r.vendor_id, status: "Dihapus" });
  return NextResponse.json({ success: true });
}
