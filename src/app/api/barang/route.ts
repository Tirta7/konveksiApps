export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";
import { getStockSummary, ensureBarangKode, skuCode } from "@/lib/stock";

const KANAL = ["Retail Offline", "Penjualan Grosir", "Penjualan Online"];

const KNOWN_SIZES = [
  "XXXL/3XL", "XXXL3XL", "3XL", "XXXL", "XXL", "XL", "XS", "S", "M", "L",
  "27", "28", "29", "30", "31", "32", "33", "34", "35", "36", "38", "40"
];

function extractSize(str: string): string {
  for (const sz of KNOWN_SIZES) {
    const reg = new RegExp(`\\b${sz.replace(/\//g, "\\/")}\\b`, "i");
    if (reg.test(str)) return sz === "XXXL/3XL" ? "XXXL" : sz.toUpperCase();
  }
  return "";
}

function normalizeSize(str: string): string {
  const sz = extractSize(str);
  if (!sz) return "";
  const s = sz.toUpperCase().replace(/[\/\s_-]/g, "");
  if (s === "XXXL3XL" || s === "3XL" || s === "XXXL") return "XXXL";
  if (s === "XXL2XL" || s === "2XL" || s === "XXL") return "XXL";
  if (s === "XL1XL" || s === "1XL" || s === "XL") return "XL";
  return sz;
}

function cleanSku(s: string): string {
  return String(s || "").trim().toUpperCase().replace(/\s+/g, "-").replace(/[^A-Z0-9_-]/g, "");
}

const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "27", "28", "29", "30", "31", "32", "33", "34", "35", "36", "38", "40"];
const sizeRank = (s: string) => {
  const i = SIZE_ORDER.indexOf(String(s).toUpperCase());
  return i === -1 ? 99 : i;
};

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
    const onlineOrders = data.penjualan_online || [];

    const list = (data.data_barang || []).map((b: any) => {
      const led = byBarang.get(String(b.id));
      const link = linkedInfo(data, b.id);
      const pcs = pcsAll.filter((x: any) => String(x.barang_id) === String(b.id));
      const terjualPcs = pcs.filter((x: any) => x.status === "terjual");
      const perKanal: Record<string, number> = {};
      for (const k of KANAL) perKanal[k] = 0;
      for (const x of terjualPcs) perKanal[x.terjual_kanal || "Lainnya"] = (perKanal[x.terjual_kanal || "Lainnya"] || 0) + 1;

      // Terjual barcode scan per size
      const terjualSize: Record<string, number> = {};
      for (const x of terjualPcs) terjualSize[x.size] = (terjualSize[x.size] || 0) + 1;

      // Omzet barcode scan
      const barcodeOmzet = sales.reduce((s: number, t: any) =>
        s + (t.items || []).filter((i: any) =>
          String(i.barang_id) === String(b.id) &&
          terjualPcs.some((p: any) => p.kodeBarcode === i.kode && String(p.penjualan_id) === String(t.id))
        ).reduce((a: number, i: any) => a + Number(i.harga || 0), 0),
        0
      );

      // Hitung penjualan dari data online marketplace (Shopee / TikTok)
      const mappedSkus = new Set((b.marketplace_mappings || []).map((m: any) => cleanSku(m.seller_sku || m.raw_sku)));
      const bKode = cleanSku(b.kode);

      let onlineSoldQty = 0;
      let onlineOmzet = 0;
      const onlineSoldBySize: Record<string, number> = {};

      for (const o of onlineOrders) {
        const sSku = cleanSku(o.seller_sku);
        const isMatch =
          mappedSkus.has(sSku) ||
          (bKode && (sSku === bKode || sSku.startsWith(bKode + "-") || sSku.startsWith(bKode)));

        if (isMatch) {
          const qty = Number(o.quantity || 1);
          onlineSoldQty += qty;
          onlineOmzet += Number(o.order_amount || 0);
          const sz = normalizeSize(o.seller_sku) || normalizeSize(o.variation) || "ALL";
          onlineSoldBySize[sz] = (onlineSoldBySize[sz] || 0) + qty;
        }
      }

      const totalTerjual = terjualPcs.length + onlineSoldQty;
      perKanal["Penjualan Online"] = (perKanal["Penjualan Online"] || 0) + onlineSoldQty;
      const omzet = barcodeOmzet + onlineOmzet;

      // Cek apakah ada stok per size kustom yang disimpan di b.sizes_stock
      const customSizesStock = b.sizes_stock && typeof b.sizes_stock === "object" ? b.sizes_stock : null;
      let effectiveStok = Number(b.stok || 0);
      if (customSizesStock && Object.keys(customSizesStock).length > 0) {
        const sumCustom = Object.values(customSizesStock).reduce((acc: number, v: any) => acc + (Number(v) || 0), 0);
        if (sumCustom > 0 || effectiveStok === 0) {
          effectiveStok = sumCustom;
        }
      }

      const totalStok = led ? led.stok_saat_ini : effectiveStok;

      // Susun rincian per size yang selalu terisi
      let sizeRows: { size: string; jumlah: number; sku: string | null; terjual: number; sisa: number; awal: number; laku: number }[] = [];

      if (led && led.sizes && led.sizes.length > 0) {
        sizeRows = led.sizes.map((s: any) => {
          const sold = (terjualSize[s.size] || 0) + (onlineSoldBySize[s.size] || 0);
          const awal = s.jumlah + sold;
          return {
            size: s.size,
            sku: s.sku || (b.kode ? skuCode(b.kode, s.size) : null),
            jumlah: s.jumlah,
            sisa: s.jumlah,
            terjual: sold,
            awal,
            laku: awal > 0 ? Math.round((sold / awal) * 100) : 0,
          };
        });
      } else {
        // Kumpulkan size dari marketplace mapping, penjualan online, atau default jeans
        const sizeSet = new Set<string>();
        for (const m of (b.marketplace_mappings || [])) {
          const sz = normalizeSize(m.seller_sku) || normalizeSize(m.variation_name);
          if (sz) sizeSet.add(sz);
        }
        for (const sz of Object.keys(onlineSoldBySize)) {
          const nSz = normalizeSize(sz);
          if (nSz && nSz !== "ALL") sizeSet.add(nSz);
        }
        if (sizeSet.size === 0) {
          ["27", "28", "29", "30", "31", "32"].forEach((s) => sizeSet.add(s));
        }

        const sortedSizes = Array.from(sizeSet).sort((x, y) => sizeRank(x) - sizeRank(y));
        const hasCustomStock = customSizesStock && sortedSizes.some((sz) => customSizesStock[sz] !== undefined);
        const perSizeStock = sortedSizes.length > 0 ? Math.floor(totalStok / sortedSizes.length) : 0;
        let rem = totalStok - (perSizeStock * sortedSizes.length);

        sizeRows = sortedSizes.map((sz, idx) => {
          let curStock = 0;
          if (hasCustomStock && customSizesStock && customSizesStock[sz] !== undefined) {
            curStock = Number(customSizesStock[sz]) || 0;
          } else {
            curStock = perSizeStock + (idx === 0 ? rem : 0);
          }
          const sold = (terjualSize[sz] || 0) + (onlineSoldBySize[sz] || 0);
          const awal = curStock + sold;
          return {
            size: sz,
            sku: b.kode ? skuCode(b.kode, sz) : null,
            jumlah: curStock,
            sisa: curStock,
            terjual: sold,
            awal,
            laku: awal > 0 ? Math.round((sold / awal) * 100) : 0,
          };
        });
      }

      const lakuPct = (totalStok + totalTerjual) > 0 ? Math.round((totalTerjual / (totalStok + totalTerjual)) * 100) : 0;

      return {
        ...b,
        sizes_stock: customSizesStock,
        kategori_nama: kategori.get(String(b.kategori_id)) || null,
        sumber: link.linked ? "produksi" : b.sumber || "produksi",
        stok_dari_gudang: !!led || link.linked,
        stok: totalStok,
        sizes: sizeRows,
        lots: led?.lots || [],
        lastMasuk: led?.lastMasuk || null,
        lastKeluar: led?.lastKeluar || null,
        barcode: {
          total: pcs.filter((x: any) => ["siap_jual", "terjual", "retur_banding", "stok_reject", "rusak_retur"].includes(x.status)).length,
          tersedia: pcs.filter((x: any) => x.status === "siap_jual").length,
          terjual: terjualPcs.length,
          retur_banding: pcs.filter((x: any) => x.status === "retur_banding").length,
          stok_reject: pcs.filter((x: any) => x.status === "stok_reject").length,
        },
        terjual_total: totalTerjual,
        laku_pct: lakuPct,
        terjual_kanal: perKanal,
        omzet,
        retur: returs.filter((r: any) => String(r.barang_id) === String(b.id)).length,
        nilai_modal: totalStok * Number(b.harga_beli || 0),
        nilai_jual: totalStok * Number(b.harga_jual || 0),
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
    const { nama_barang, kategori_id, harga_beli, harga_jual, stok, kode } = body;
    if (!nama_barang) return NextResponse.json({ error: "Nama barang wajib diisi" }, { status: 400 });
    const dup = data.data_barang.find((b: any) => String(b.nama_barang).trim().toLowerCase() === String(nama_barang).trim().toLowerCase());
    if (dup) return NextResponse.json({ error: `Nama barang sudah ada (${dup.kode || dup.uid})` }, { status: 400 });

    let customKode = kode ? String(kode).trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "") : "";
    if (customKode) {
      const dupKode = data.data_barang.find((b: any) => b.kode && b.kode.toUpperCase() === customKode);
      if (dupKode) return NextResponse.json({ error: `Kode SKU "${customKode}" sudah dipakai oleh ${dupKode.nama_barang}` }, { status: 400 });
    }

    const id = nextId(data, "data_barang" as any);
    const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newItem = {
      id, uid: `BRG-${randomStr}`,
      nama_barang, 
      warna: body.warna ? String(body.warna).trim() : "",
      kode: customKode || undefined,
      kategori_id: Number(kategori_id) || 0,
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
    const { id, nama_barang, kategori_id, harga_beli, harga_jual, stok, kode, sizes_stock } = body;
    if (!id) return NextResponse.json({ error: "ID dibutuhkan" }, { status: 400 });
    const idx = data.data_barang.findIndex((b: any) => String(b.id) === String(id));
    if (idx === -1) return NextResponse.json({ error: "Barang tidak ditemukan" }, { status: 404 });
    const link = linkedInfo(data, id);

    let newKode = data.data_barang[idx].kode;
    if (kode !== undefined) {
      const cleaned = String(kode).trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
      if (cleaned) {
        const dupKode = data.data_barang.find((b: any) => String(b.id) !== String(id) && b.kode && b.kode.toUpperCase() === cleaned);
        if (dupKode) return NextResponse.json({ error: `Kode SKU "${cleaned}" sudah dipakai oleh ${dupKode.nama_barang}` }, { status: 400 });
        newKode = cleaned;
      }
    }

    let stokToSave = Number(stok) || 0;
    if (sizes_stock && typeof sizes_stock === "object") {
      const sumSizes = Object.values(sizes_stock).reduce((acc: number, val: any) => acc + (Number(val) || 0), 0);
      if (sumSizes > 0 || stok === undefined || stok === "") {
        stokToSave = sumSizes;
      }
    }

    data.data_barang[idx] = {
      ...data.data_barang[idx],
      nama_barang,
      kode: newKode,
      warna: body.warna !== undefined ? String(body.warna).trim() : (data.data_barang[idx].warna || ""),
      kategori_id: Number(kategori_id) || 0,
      harga_beli: Number(harga_beli) || 0,
      harga_jual: Number(harga_jual) || 0,
      // Barang produksi: stok TIDAK bisa diubah manual jika sudah ada riwayat stock_movements
      ...(link.movements > 0 ? {} : {
        stok: stokToSave,
        sizes_stock: sizes_stock && typeof sizes_stock === "object" ? sizes_stock : data.data_barang[idx].sizes_stock,
      }),
    };

    // Update SKU pada barcode_item yang terhubung jika kode berubah
    if (newKode && data.barcode_item) {
      for (const item of data.barcode_item) {
        if (String(item.barang_id) === String(id)) {
          item.sku = skuCode(newKode, item.size);
        }
      }
    }

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
