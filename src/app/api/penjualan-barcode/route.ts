export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";
import { lookupBarcodeForSale, sellByBarcodes, cancelBarcodeSale, cancelBarcodeLine, getBarangBarcodes } from "@/lib/barcode-sales";

// GET ?code=KODE        → cek 1 barcode (untuk keranjang scan)
// GET ?barang_id=ID     → semua pcs barang + ringkasan per size (Data Barang → Barcode)
// GET ?kanal=Retail...  → riwayat transaksi scan (opsional filter kanal)
export async function GET(req: NextRequest) {
  try {
    const data = readData();
    const sp = new URL(req.url).searchParams;
    const code = sp.get("code");
    if (code) return NextResponse.json(lookupBarcodeForSale(data, code));
    const barangId = sp.get("barang_id");
    if (barangId) return NextResponse.json(getBarangBarcodes(data, barangId));
    const kanal = sp.get("kanal");
    const list = ((data as any).penjualan_barcode || []).filter((s: any) => !kanal || s.kanal === kanal);
    return NextResponse.json(list);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST { codes:[], kanal, pelanggan?, pelanggan_id?, metode_pembayaran?, dibayar_awal?, jatuh_tempo?, catatan?, harga?:{kode:harga} } → simpan penjualan
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data: any = readData();
    const kanal = String(body.kanal || "").trim();
    if (!kanal) return NextResponse.json({ error: "Kanal penjualan wajib diisi" }, { status: 400 });
    const nowIso = new Date().toISOString();
    const sale: any = sellByBarcodes(data, body.codes || [], {
      kanal,
      pelanggan: body.pelanggan,
      catatan: body.catatan,
      harga: body.harga,
      order_id: body.order_id ? String(body.order_id).trim() : undefined,
      now: nowIso,
    });
    sale.metode_pembayaran = body.metode_pembayaran || "Lunas";

    // Jika transaksi Tempo / Piutang → otomatis buat entri Buku Piutang
    if (body.metode_pembayaran === "Tempo" && Number(sale.total || 0) > 0) {
      if (!Array.isArray(data.piutang_grosir)) data.piutang_grosir = [];
      if (!Array.isArray(data.data_pelanggan)) data.data_pelanggan = [];
      const totalTagihan = Number(sale.total || 0);
      const dibayarAwal = Math.min(totalTagihan, Math.max(0, Number(body.dibayar_awal || 0)));
      const sisa = Math.max(0, totalTagihan - dibayarAwal);
      sale.dibayar = dibayarAwal;
      sale.sisa_piutang = sisa;

      const cust = body.pelanggan_id
        ? data.data_pelanggan.find((c: any) => Number(c.id) === Number(body.pelanggan_id))
        : data.data_pelanggan.find((c: any) => String(c.nama || "").toLowerCase() === String(body.pelanggan || "").trim().toLowerCase());

      if (sisa > 0) {
        const pid = nextId(data, "piutang_grosir" as any);
        const defaultJt = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];
        data.piutang_grosir.push({
          id: pid,
          penjualan_id: sale.id,
          no_faktur: sale.no_transaksi,
          tanggal: nowIso.split("T")[0],
          jatuh_tempo: body.jatuh_tempo || defaultJt,
          pelanggan_id: cust?.id || null,
          pelanggan_nama: cust?.nama || body.pelanggan || "Pelanggan Grosir",
          pelanggan_kota: cust?.kota || "",
          pelanggan_kontak: cust?.kontak || "",
          total_tagihan: totalTagihan,
          jumlah_dibayar: dibayarAwal,
          status: dibayarAwal > 0 ? "Dicicil" : "Belum Lunas",
          catatan: `${kanal} (${sale.jumlah} pcs)${body.catatan ? ` · ${body.catatan}` : ""}`,
          riwayat_bayar:
            dibayarAwal > 0
              ? [{ tanggal: nowIso, nominal: dibayarAwal, metode: "DP Awal", catatan: "DP saat transaksi" }]
              : [],
          createdAt: nowIso,
        });
        if (cust) {
          cust.piutang = Number(cust.piutang || 0) + sisa;
          cust.total_order = Number(cust.total_order || 0) + 1;
          cust.total_pembelian = Number(cust.total_pembelian || 0) + totalTagihan;
        }
      }
    }

    writeData(data);
    return NextResponse.json({ success: true, sale });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, details: e.details || null }, { status: 400 });
  }
}

// DELETE ?id=ID → batalkan transaksi (pcs kembali tersedia, stok kembali)
// DELETE ?kode=KODE&alasan=... → batalkan SATU pcs saja (salah scan / kelebihan scan)
export async function DELETE(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const kode = sp.get("kode");
    const data: any = readData();
    if (kode) {
      const res = cancelBarcodeLine(data, kode, { alasan: sp.get("alasan") || "", now: new Date().toISOString() });
      writeData(data);
      return NextResponse.json({ success: true, ...res });
    }
    const id = sp.get("id");
    const sale = cancelBarcodeSale(data, id);
    if (Array.isArray(data.piutang_grosir) && sale) {
      const idx = data.piutang_grosir.findIndex((p: any) => Number(p.penjualan_id) === Number(sale.id) || p.no_faktur === sale.no_transaksi);
      if (idx !== -1) {
        const removed = data.piutang_grosir.splice(idx, 1)[0];
        if (removed?.pelanggan_id && Array.isArray(data.data_pelanggan)) {
          const cust = data.data_pelanggan.find((c: any) => Number(c.id) === Number(removed.pelanggan_id));
          if (cust) {
            const sisa = Math.max(0, Number(removed.total_tagihan || 0) - Number(removed.jumlah_dibayar || 0));
            cust.piutang = Math.max(0, Number(cust.piutang || 0) - sisa);
          }
        }
      }
    }
    writeData(data);
    return NextResponse.json({ success: true, sale });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
