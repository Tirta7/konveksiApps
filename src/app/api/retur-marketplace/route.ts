export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { readData, writeData } from "@/lib/data-store";
import { lookupRetur, getOrder, processRetur, updateBanding, moveReturToStock, deleteRetur } from "@/lib/marketplace";

// GET ?code=BARCODE   → info pcs untuk retur (penjualan, Order ID, pembeli, resi)
// GET ?order_id=XXX   → detail pesanan + barcode yang dikirim di pesanan itu
// GET                 → daftar retur + ringkasan banding
export async function GET(req: NextRequest) {
  try {
    const data: any = readData();
    const sp = new URL(req.url).searchParams;
    const code = sp.get("code");
    if (code) return NextResponse.json(lookupRetur(data, code));
    const oid = sp.get("order_id");
    if (oid) {
      const o = getOrder(data, oid);
      return o ? NextResponse.json(o) : NextResponse.json({ error: `Order ID ${oid} tidak ditemukan. Pastikan CSV pesanan sudah diupload di menu Penjualan Online.` }, { status: 404 });
    }
    const list = data.retur_marketplace || [];
    const banding = list.filter((r: any) => r.kondisi === "tidak_sesuai");
    const summary = {
      total: list.length,
      kembali_stok: list.filter((r: any) => r.status === "Kembali ke Stok" || r.status === "Dipindah ke Stok").length,
      perlu_diajukan: banding.filter((r: any) => r.status === "Perlu Diajukan").length,
      diajukan: banding.filter((r: any) => r.status === "Diajukan Banding").length,
      disetujui: banding.filter((r: any) => r.status === "Banding Disetujui").length,
      ditolak: banding.filter((r: any) => r.status === "Banding Ditolak").length,
      nilai_klaim_terbuka: banding.filter((r: any) => r.status === "Perlu Diajukan" || r.status === "Diajukan Banding").reduce((s: number, r: any) => s + Number(r.nilai_klaim || 0), 0),
      dana_diterima: banding.reduce((s: number, r: any) => s + Number(r.dana_diterima || 0), 0),
    };
    return NextResponse.json({ list, summary });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST { action:"proses", kode?, order_id?, kondisi, jenis_masalah?, catatan?, nilai_klaim?, resi_retur? }
// POST { action:"banding", id, status?, dana_diterima?, nilai_klaim?, catatan? }
// POST { action:"ke_stok", id, catatan? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data: any = readData();
    const now = new Date().toISOString();
    let result: any;
    if (body.action === "banding") result = updateBanding(data, body.id, { status: body.status, dana_diterima: body.dana_diterima, nilai_klaim: body.nilai_klaim, catatan: body.catatan, now });
    else if (body.action === "ke_stok") result = moveReturToStock(data, body.id, now, body.catatan);
    else {
      if (body.kondisi !== "sesuai" && body.kondisi !== "tidak_sesuai") return NextResponse.json({ error: "Pilih kondisi barang: sesuai atau tidak sesuai" }, { status: 400 });
      result = processRetur(data, { kode: body.kode || null, order_id: body.order_id || null, kondisi: body.kondisi, jenis_masalah: body.jenis_masalah, catatan: body.catatan, nilai_klaim: body.nilai_klaim, resi_retur: body.resi_retur, now });
    }
    writeData(data);
    return NextResponse.json({ success: true, retur: result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

// DELETE ?id= → hapus retur salah input (pcs kembali berstatus terjual, stok dikoreksi)
export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    const data: any = readData();
    const r = deleteRetur(data, id);
    writeData(data);
    return NextResponse.json({ success: true, retur: r });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
