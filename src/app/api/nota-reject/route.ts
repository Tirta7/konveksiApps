import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";
import { restoreHolding, unmarkBarcodes } from "@/lib/stock";

export async function GET(req: NextRequest) {
  try {
    const data = readData();
    const list = data.nota_reject_vendor || [];
    return NextResponse.json(list);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Gagal memuat nota reject" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const data = readData();
    if (!data.nota_reject_vendor) data.nota_reject_vendor = [];

    const { id, status_klaim, catatan_penyelesaian, metode_pembayaran, nominal_dibayar } = body;
    const idx = data.nota_reject_vendor.findIndex((n: any) => String(n.id) === String(id));
    if (idx === -1) return NextResponse.json({ error: "Nota reject tidak ditemukan" }, { status: 404 });

    const item = data.nota_reject_vendor[idx];
    if (status_klaim) item.status_klaim = status_klaim;
    if (catatan_penyelesaian !== undefined) item.catatan_penyelesaian = catatan_penyelesaian;
    if (metode_pembayaran !== undefined) item.metode_pembayaran = metode_pembayaran;
    if (nominal_dibayar !== undefined) item.nominal_dibayar = Number(nominal_dibayar);
    item.tanggal_selesai = new Date().toISOString();
    item.updated_at = new Date().toISOString();

    // Jika metode penyelesaian adalah potong tagihan, catat potongan pada ledger tagihan vendor
    if (metode_pembayaran === "potong_tagihan" && item.vendor_id != null && (nominal_dibayar || item.total_klaim)) {
      if (!data.gaji_cmt) data.gaji_cmt = [];
      const potId = nextId(data, "gaji_cmt" as any);
      data.gaji_cmt.push({
        id: potId,
        cmtId: Number(item.vendor_id),
        po_id: item.po_id,
        noPo: item.noPo || "-",
        totalGaji: -Math.abs(Number(nominal_dibayar || item.total_klaim || 0)),
        dibayar: 0,
        status: "Lunas",
        metode: "potong_klaim",
        catatan: `Potongan Klaim #${item.no_nota}: ${item.alasan_reject} (${item.jumlah_reject} pcs)`,
        tanggal: item.tanggal_selesai,
      });
    }

    data.nota_reject_vendor[idx] = item;
    writeData(data);

    return NextResponse.json(item);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Gagal update nota reject" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const noNota = searchParams.get("no_nota");

    if (!id && !noNota) {
      return NextResponse.json({ error: "ID atau No Nota wajib disertakan" }, { status: 400 });
    }

    const data = readData();
    if (!data.nota_reject_vendor) data.nota_reject_vendor = [];

    const idx = data.nota_reject_vendor.findIndex(
      (n: any) => (id && String(n.id) === String(id)) || (noNota && n.no_nota === noNota)
    );

    if (idx === -1) {
      return NextResponse.json({ error: "Nota reject tidak ditemukan" }, { status: 404 });
    }

    const nota = data.nota_reject_vendor[idx];

    // 1. Revert data transfer vendor & kembalikan holding ke antrean Gudang & Stok
    if (nota.transfer_id != null && Array.isArray(data.produksi_transfers)) {
      const t = data.produksi_transfers.find((x: any) => String(x.id) === String(nota.transfer_id));
      if (t) {
        // Kembalikan sisa kuota ke holding transfer agar muncul kembali di antrean Gudang & Stok
        const restoredSizes = (nota.rincian_reject && nota.rincian_reject.length > 0)
          ? nota.rincian_reject
          : [{ size: "ALL", jumlah: Number(nota.jumlah_reject || 0) }];
        restoreHolding(t, restoredSizes, Number(nota.jumlah_reject || 0));

        // Kurangi jumlah reject yang tercatat
        t.jumlah_reject = Math.max(0, Number(t.jumlah_reject || 0) - Number(nota.jumlah_reject || 0));

        // Revert rincian reject per size
        if (Array.isArray(t.reject_items) && Array.isArray(nota.rincian_reject)) {
          const rm: Record<string, number> = {};
          for (const it of t.reject_items) rm[it.size] = Number(it.jumlah || 0);
          for (const it of nota.rincian_reject) {
            const sz = it.size;
            const qty = Number(it.jumlah ?? it.reject ?? 0);
            rm[sz] = Math.max(0, (rm[sz] || 0) - qty);
          }
          t.reject_items = Object.entries(rm)
            .filter(([_, qty]) => qty > 0)
            .map(([size, jumlah]) => ({ size, jumlah }));
        }

        if (String(t.nota_reject_id) === String(nota.id) || t.no_nota_reject === nota.no_nota) {
          delete t.nota_reject_id;
          delete t.no_nota_reject;
        }

        if (Array.isArray(t.stock_log)) {
          t.stock_log = t.stock_log.map((l: any) =>
            (l.reject_id && String(l.reject_id) === String(nota.id)) || l.reject === nota.jumlah_reject
              ? { ...l, reject: 0 }
              : l
          );
        }

        if (Array.isArray(t.reject_log)) {
          t.reject_log = t.reject_log.filter(
            (l: any) => !(l.jumlah === nota.jumlah_reject && (l.alasan === nota.alasan_reject || l.tanggal === nota.tanggal_klaim))
          );
        }
      }
    }

    // 2. Kembalikan barcode items yang ditandai reject ke status aktif
    if (nota.po_id != null) {
      const barcodeSizes = (nota.rincian_reject && nota.rincian_reject.length > 0)
        ? nota.rincian_reject
        : [{ size: "ALL", jumlah: Number(nota.jumlah_reject || 0) }];
      unmarkBarcodes(data, nota.po_id, barcodeSizes, "gudang", nota.no_nota);
    }

    // 3. Hapus mutasi stok (stock_movements) jenis reject yang terkait
    if (Array.isArray(data.stock_movements)) {
      data.stock_movements = data.stock_movements.filter(
        (m: any) =>
          !(
            (m.nota_id && String(m.nota_id) === String(nota.id)) ||
            (m.no_nota && m.no_nota === nota.no_nota) ||
            (m.jenis === "reject" && nota.transfer_id != null && String(m.transfer_id) === String(nota.transfer_id) && m.jumlah === nota.jumlah_reject)
          )
      );
    }

    // 4. Hapus catatan retur_produksi jika ada
    if (Array.isArray(data.retur_produksi)) {
      data.retur_produksi = data.retur_produksi.filter(
        (r: any) => r.no_nota !== nota.no_nota && String(r.id) !== String(nota.id)
      );
    }

    // 5. Batalkan potongan tagihan vendor di gaji_cmt jika ada
    if (Array.isArray(data.gaji_cmt)) {
      data.gaji_cmt = data.gaji_cmt.filter(
        (g: any) => !(g.catatan && g.catatan.includes(nota.no_nota))
      );
    }

    // 6. Hapus nota dari daftar nota_reject_vendor
    data.nota_reject_vendor.splice(idx, 1);

    writeData(data);

    return NextResponse.json({
      success: true,
      message: `Pengajuan reject #${nota.no_nota} berhasil dibatalkan. Sisa barang (${nota.jumlah_reject} pcs) telah dikembalikan ke antrean Gudang & Stok.`,
      deleted_nota: nota,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Gagal membatalkan nota reject" }, { status: 500 });
  }
}

