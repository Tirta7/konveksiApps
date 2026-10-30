export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { readData, writeData } from "@/lib/data-store";
import {
  lookupRetur,
  getOrder,
  processRetur,
  updateBanding,
  moveReturToStock,
  disposeRetur,
  deleteRetur,
  unlockReturInspection,
  getActiveReturLocks,
} from "@/lib/marketplace";
import { getSessionFromRequest } from "@/lib/auth";
import { emitEvent } from "@/lib/realtime-hub";

// GET ?code=BARCODE&user=XXX → info pcs untuk retur + lock (atau deteksi Order ID / Resi)
// GET ?action=unlock&code=XXX&user=XXX → lepas lock
// GET ?order_id=XXX          → detail pesanan (bisa dicari lewat Order ID, Resi Kirim, atau Resi Retur)
// GET                        → daftar retur, ringkasan, daftar belum selesai, daftar sudah selesai
export async function GET(req: NextRequest) {
  try {
    const data: any = readData();
    const sp = new URL(req.url).searchParams;
    const session = getSessionFromRequest(req);
    const currentUser = sp.get("user") || session?.nama || "Staf Gudang";

    const action = sp.get("action");
    if (action === "unlock") {
      const code = sp.get("code");
      if (code) unlockReturInspection(code, currentUser);
      return NextResponse.json({ success: true });
    }

    const code = sp.get("code");
    if (code) {
      const info = lookupRetur(data, code, currentUser);
      if (info.ok) {
        emitEvent("retur_inspecting", { code: info.kode, user: currentUser, at: Date.now() });
      }
      return NextResponse.json(info);
    }

    const oid = sp.get("order_id");
    if (oid) {
      const o = getOrder(data, oid);
      return o
        ? NextResponse.json(o)
        : NextResponse.json(
            {
              error: `Order ID atau No. Resi "${oid}" tidak ditemukan. Pastikan CSV pesanan / retur sudah diupload atau toko marketplace sudah disinkronkan.`,
            },
            { status: 404 }
          );
    }

    const list: any[] = data.retur_marketplace || [];
    const returOnline: any[] = data.retur_online || [];

    // Filter yang sudah terselesaikan
    // 1. retur fisik yang sudah masuk kembali ke stok
    // 2. retur banding yang sudah selesai (disetujui/ditolak)
    const selesaiFisik = list.filter(
      (r: any) =>
        r.status === "Kembali ke Stok" ||
        r.status === "Dipindah ke Stok" ||
        r.status === "Banding Disetujui" ||
        r.status === "Banding Ditolak"
    );

    // Filter yang belum terselesaikan
    // 1. Paket retur marketplace yang belum (atau baru sebagian) diverifikasi fisiknya
    const pendingPaket = returOnline.filter(
      (r: any) => !r.status || r.status === "Menunggu Gudang" || String(r.status).startsWith("Sebagian")
    );
    // 2. Retur fisik yang tidak sesuai dan sedang dalam proses banding (belum cair / belum tuntas)
    const pendingBanding = list.filter((r: any) => r.status === "Perlu Diajukan" || r.status === "Diajukan Banding");

    const banding = list.filter((r: any) => r.kondisi === "tidak_sesuai");
    const summary = {
      total: list.length,
      kembali_stok: list.filter((r: any) => r.status === "Kembali ke Stok" || r.status === "Dipindah ke Stok").length,
      perlu_diajukan: banding.filter((r: any) => r.status === "Perlu Diajukan").length,
      diajukan: banding.filter((r: any) => r.status === "Diajukan Banding").length,
      disetujui: banding.filter((r: any) => r.status === "Banding Disetujui").length,
      ditolak: banding.filter((r: any) => r.status === "Banding Ditolak").length,
      nilai_klaim_terbuka: banding
        .filter((r: any) => r.status === "Perlu Diajukan" || r.status === "Diajukan Banding")
        .reduce((s: number, r: any) => s + Number(r.nilai_klaim || 0), 0),
      dana_diterima: banding.reduce((s: number, r: any) => s + Number(r.dana_diterima || 0), 0),
      belum_terselesaikan: pendingPaket.length + pendingBanding.length,
      sudah_terselesaikan: selesaiFisik.length,
    };

    return NextResponse.json({
      list,
      summary,
      belum_terselesaikan: {
        total: pendingPaket.length + pendingBanding.length,
        paket_pending: pendingPaket,
        banding_pending: pendingBanding,
      },
      sudah_terselesaikan: {
        total: selesaiFisik.length,
        items: selesaiFisik,
      },
      active_locks: getActiveReturLocks(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST { action:"proses", kode?, order_id?, kondisi, jenis_masalah?, catatan?, nilai_klaim?, resi_retur?, bukti_foto?, link_bukti?, petugas? }
// POST { action:"banding", id, status?, dana_diterima?, nilai_klaim?, catatan?, bukti_foto?, link_bukti? }
// POST { action:"ke_stok", id, catatan? }
// POST { action:"tindak_lanjut", id, tindak_lanjut:"reject_grade_b"|"write_off", catatan? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data: any = readData();
    const session = getSessionFromRequest(req);
    const petugas = body.petugas || session?.nama || "Staf Gudang";
    const now = new Date().toISOString();
    let result: any;

    if (body.action === "banding") {
      result = updateBanding(data, body.id, {
        status: body.status,
        dana_diterima: body.dana_diterima,
        nilai_klaim: body.nilai_klaim,
        catatan: body.catatan,
        bukti_foto: body.bukti_foto,
        link_bukti: body.link_bukti,
        now,
      });
      emitEvent("retur_banding_updated", {
        id: body.id,
        status: result.status,
        dana_diterima: result.dana_diterima,
        petugas,
      });
    } else if (body.action === "ke_stok") {
      result = moveReturToStock(data, body.id, now, body.catatan);
      emitEvent("retur_ke_stok", { id: body.id, no_retur: result.no_retur, kode: result.kode_barcode, petugas });
    } else if (body.action === "tindak_lanjut") {
      if (body.tindak_lanjut !== "reject_grade_b" && body.tindak_lanjut !== "write_off") {
        return NextResponse.json({ error: "Pilih tindak lanjut: reject_grade_b atau write_off" }, { status: 400 });
      }
      result = disposeRetur(data, body.id, now, body.tindak_lanjut, body.catatan);
      emitEvent("retur_banding_updated", {
        id: body.id,
        status: result.status,
        tindak_lanjut_fisik: result.tindak_lanjut_fisik,
        petugas,
      });
    } else {
      if (body.kondisi !== "sesuai" && body.kondisi !== "tidak_sesuai") {
        return NextResponse.json({ error: "Pilih kondisi barang: sesuai atau tidak sesuai" }, { status: 400 });
      }
      result = processRetur(data, {
        kode: body.kode || null,
        order_id: body.order_id || null,
        kondisi: body.kondisi,
        jenis_masalah: body.jenis_masalah,
        catatan: body.catatan,
        nilai_klaim: body.nilai_klaim,
        resi_retur: body.resi_retur,
        bukti_foto: body.bukti_foto || null,
        link_bukti: body.link_bukti || null,
        petugas,
        now,
      });

      // Broadcast real-time ke semua pegawai yang sedang membuka web retur online
      emitEvent("retur_processed", {
        no_retur: result.no_retur,
        kode: result.kode_barcode,
        nama_barang: result.nama_barang,
        size: result.size,
        kondisi: result.kondisi,
        status: result.status,
        petugas: result.petugas,
        order_id: result.order_id,
        at: now,
      });
    }

    writeData(data);
    return NextResponse.json({ success: true, retur: result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

// DELETE ?id= → hapus retur salah input (pcs kembali berstatus terjual, stok & status retur_online dikoreksi)
export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    const data: any = readData();
    const r = deleteRetur(data, id);
    writeData(data);
    emitEvent("retur_deleted", { id, no_retur: r?.no_retur });
    return NextResponse.json({ success: true, retur: r });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
