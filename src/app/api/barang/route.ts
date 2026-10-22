export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";
import { getStockSummary, ensureBarangKode } from "@/lib/stock";

const KANAL = ["Retail Offline", "Penjualan Grosir", "Penjualan Online"];

/** Apakah barang sudah punya jejak di ledger / barcode (stoknya dikelola Gudang & Stok). */
function linkedInfo(data: any, id: any) {
  const movements = (data.stock_movements || []).filter((m: any) => String(m.barang_id) === String(id)).length;
  const barcodes = (data.barcode_item || []).filter((b: any) => String(b.barang_id) === String(id)).length;
  return { movements, barcodes, linked: movements > 0 || barcodes > 0 };
}

export async function GET() {
  try {
    const data: any = readData();
    // Stok barang jadi produksi mengikuti ledger Gudang & Stok (per size)
    const summary = getStockSummary(data);
    const byBarang = new Map(summary.filter((r) => r.barang_id != null).map((r) => [String(r.barang_id), r]));
    const kategori = new Map((data.kategori_produk || []).map((k: any) => [String(k.id), k.nama]));
    const pcsAll = data.barcode_item || [];
    const sales = data.penjualan_barcode || [];
    const returs = data.retur_marketplace || [];

    const list = (data.data_barang || []).map((b: any) => {
      const led = byBarang.get(String(b.id));
      const link = linkedInfo(data, b.id);
      const pcs = pcsAll.filter((x: any) => String(x.barang_id) === String(b.id));
      const terjualPcs = pcs.filter((x: any) => x.status === "terjual");
      const perKanal: Record<string, number> = {};
      for (const k of KANAL) perKanal[k] = 0;
      for (const x of terjualPcs) perKanal[x.terjual_kanal || "Lainnya"] = (perKanal[x.terjual_kanal || "Lainnya"] || 0) + 1;
      // terjual per size
      const terjualSize: Record<string, number> = {};
      for (const x of terjualPcs) terjualSize[x.size] = (terjualSize[x.size] || 0) + 1;
      const omzet = sales.reduce((s: number, t: any) => s + (t.items || []).filter((i: any) => String(i.barang_id) === String(b.id) && terjualPcs.some((p: any) => p.kodeBarcode === i.kode && String(p.penjualan_id) === String(t.id))).reduce((a: number, i: any) => a + Number(i.harga || 0), 0), 0);
      const stok = led ? led.stok_saat_ini : Number(b.stok || 0);
      return {
        ...b,
        kategori_nama: kategori.get(String(b.kategori_id)) || null,
        sumber: link.linked ? "produksi" : b.sumber || "manual",
        stok_dari_gudang: !!led || link.linked,
        stok,
        sizes: led ? led.sizes.map((s) => ({ ...s, terjual: terjualSize[s.size] || 0 })) : [],
        lots: led?.lots || [],
        lastMasuk: led?.lastMasuk || null,
        lastKeluar: led?.lastKeluar || null,
        barcode: {
          total: pcs.filter((x: any) => ["siap_jual", "terjual", "retur_banding"].includes(x.status)).length,
          tersedia: pcs.filter((x: any) => x.status === "siap_jual").length,
          terjual: terjualPcs.length,
          retur_banding: pcs.filter((x: any) => x.status === "retur_banding").length,
        },
        terjual_kanal: perKanal,
        omzet,
        retur: returs.filter((r: any) => String(r.barang_id) === String(b.id)).length,
        nilai_modal: stok * Number(b.harga_beli || 0),
        nilai_jual: stok * Number(b.harga_jual || 0),
        bisa_dihapus: !link.linked,
      };
    });
    return NextResponse.json(list);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = readData();
    if (!data.data_barang) data.data_barang = [];
    const { nama_barang, kategori_id, harga_beli, harga_jual, stok } = body;
    if (!nama_barang) return NextResponse.json({ error: "Nama barang wajib diisi" }, { status: 400 });
    const dup = data.data_barang.find((b: any) => String(b.nama_barang).trim().toLowerCase() === String(nama_barang).trim().toLowerCase());
    if (dup) return NextResponse.json({ error: `Nama barang sudah ada (${dup.kode || dup.uid})` }, { status: 400 });
    const id = nextId(data, "data_barang" as any);
    const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newItem = {
      id, uid: `BRG-${randomStr}`,
      nama_barang, kategori_id: Number(kategori_id) || 0,
      harga_beli: Number(harga_beli) || 0,
      harga_jual: Number(harga_jual) || 0,
      // stok manual hanya untuk barang non-produksi (tanpa barcode); barang produksi stoknya dari Gudang & Stok
      stok: Number(stok) || 0,
      sumber: "manual",
      createdAt: new Date().toISOString()
    };
    ensureBarangKode(data, newItem);
    data.data_barang.push(newItem);
    writeData(data);
    return NextResponse.json(newItem);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const data = readData();
    if (!data.data_barang) data.data_barang = [];
    const { id, nama_barang, kategori_id, harga_beli, harga_jual, stok } = body;
    if (!id) return NextResponse.json({ error: "ID dibutuhkan" }, { status: 400 });
    const idx = data.data_barang.findIndex((b: any) => String(b.id) === String(id));
    if (idx === -1) return NextResponse.json({ error: "Barang tidak ditemukan" }, { status: 404 });
    const link = linkedInfo(data, id);
    data.data_barang[idx] = {
      ...data.data_barang[idx],
      nama_barang, kategori_id: Number(kategori_id) || 0,
      harga_beli: Number(harga_beli) || 0,
      harga_jual: Number(harga_jual) || 0,
      // Barang produksi: stok TIDAK bisa diubah manual (mengikuti ledger Gudang & Stok + scan penjualan)
      ...(link.linked ? {} : { stok: Number(stok) || 0 }),
    };
    writeData(data);
    return NextResponse.json(data.data_barang[idx]);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const data = readData();
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));
    if (!id) return NextResponse.json({ error: "ID dibutuhkan" }, { status: 400 });
    const link = linkedInfo(data, id);
    if (link.linked) return NextResponse.json({ error: `Barang ini sudah terhubung dengan ${link.barcodes} barcode & ${link.movements} riwayat stok (produksi/penjualan), sehingga tidak bisa dihapus agar riwayat tidak hilang.` }, { status: 400 });
    data.data_barang = (data.data_barang || []).filter((b: any) => b.id !== id);
    writeData(data);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
