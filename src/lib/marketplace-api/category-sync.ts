import { nextId } from "@/lib/data-store";
import { getShops } from "@/lib/marketplace-api/common";
import { ensureFreshToken } from "@/lib/marketplace-api/sync";
import { shopeeGetProducts } from "@/lib/marketplace-api/shopee";
import { tiktokGetProducts } from "@/lib/marketplace-api/tiktok";

export function detectCategoryForProduct(name: string, sku?: string): { nama: string; deskripsi: string } {
  const n = (String(name || "") + " " + String(sku || "")).toUpperCase();
  if (n.includes("STRAIGHT") || n.includes("RETRO FOLD") || n.includes("RAW DENIM FOLD") || n.includes("BURDIL")) {
    return {
      nama: "STRAIGHT FOLD",
      deskripsi: "Model pola Highwaist Jeans Straight Fold (Retro Fold & Raw Denim Fold)",
    };
  }
  if (n.includes("TULANG") || n.includes("BAGGY") || n.includes("LIPAT BESAR") || n.includes("LOOSE JEANS LIPAT")) {
    return {
      nama: "TULANG (BAGGY LIPAT BESAR)",
      deskripsi: "Model pola Baggy Highwaist Loose Jeans Lipat Besar (Medium Blue & Dark Denim)",
    };
  }
  if (n.includes("PECAH POLA") || n.includes("KULOT")) {
    return {
      nama: "PECAH POLA",
      deskripsi: "Model pola Kulot Pecah Pola New & Kulot Viral TikTok",
    };
  }
  if (n.includes("GOMBRONG") || n.includes("WIDE LEG")) {
    return {
      nama: "GOMBRONG",
      deskripsi: "Model pola Celana Jeans Gombrong & Wide Leg",
    };
  }
  // Fallback nama bersih
  const clean = String(name || "")
    .replace(/^LAVAIRA(\.ID|\s+ID)?\s*[-–:]\s*/i, "")
    .split(/\s*[-–]\s*/)[0]
    ?.trim();
  return {
    nama: (clean ? clean.toUpperCase() : "JEANS WANITA"),
    deskripsi: `Kategori & model pola ${clean || "Jeans Wanita"} dari toko online`,
  };
}

export async function syncMarketplaceCategories(data: any): Promise<{
  success: boolean;
  message: string;
  added: number;
  updated: number;
  categories: any[];
}> {
  if (!Array.isArray(data.kategori_produk)) data.kategori_produk = [];
  if (!Array.isArray(data.data_barang)) data.data_barang = [];

  let added = 0;
  let updated = 0;

  // 1. Tarik kategori dari API toko aktif (Shopee / TikTok) jika terhubung
  const activeShops = getShops(data).filter((s) => s.aktif);
  for (const shop of activeShops) {
    try {
      const fresh = await ensureFreshToken(shop);
      if (fresh.platform === "shopee") {
        const prods = await shopeeGetProducts(fresh);
        for (const p of prods) {
          const detected = detectCategoryForProduct(p.item_name, p.item_sku);
          const r = ensureCategoryInStore(data, detected.nama, detected.deskripsi, "shopee");
          if (r.action === "added") added++;
          if (r.action === "updated") updated++;
        }
      } else if (fresh.platform === "tiktok") {
        const prods = await tiktokGetProducts(fresh);
        for (const p of prods) {
          const detected = detectCategoryForProduct(p.title, p.skus?.[0]?.seller_sku);
          const r = ensureCategoryInStore(data, detected.nama, detected.deskripsi, "tiktok");
          if (r.action === "added") added++;
          if (r.action === "updated") updated++;
        }
      }
    } catch (e) {
      console.error("syncMarketplaceCategories shop error:", e);
    }
  }

  // 2. Ambil dari riwayat penjualan_online & data_barang (selalu berjalan sehingga offline/sandbox tetap akurat)
  const allProductNames = new Set<string>();
  for (const o of (data.penjualan_online || [])) {
    if (o.product_name) allProductNames.add(o.product_name);
  }
  for (const b of data.data_barang) {
    if (b.nama_barang) allProductNames.add(b.nama_barang);
  }

  for (const pName of Array.from(allProductNames)) {
    const detected = detectCategoryForProduct(pName);
    const res = ensureCategoryInStore(data, detected.nama, detected.deskripsi, "marketplace");
    if (res.action === "added") added++;
    if (res.action === "updated") updated++;
  }

  // 3. Tautkan setiap barang di data_barang ke kategori_id yang cocok
  for (const b of data.data_barang) {
    const detected = detectCategoryForProduct(b.nama_barang, b.kode);
    const matchCat = data.kategori_produk.find((k: any) => {
      const kn = String(k.nama || "").toUpperCase().trim();
      const dn = String(detected.nama || "").toUpperCase().trim();
      return kn === dn || (dn.includes("TULANG") && kn.includes("TULANG")) || (dn.includes("PECAH POLA") && kn.includes("PECAH POLA")) || (dn.includes("STRAIGHT") && kn.includes("STRAIGHT"));
    });
    if (matchCat) {
      b.kategori_id = matchCat.id;
      b.kategori_nama = matchCat.nama;
    }
  }

  return {
    success: true,
    message: `Berhasil sinkronkan kategori dari toko online: ${added} kategori baru ditambahkan, total ${data.kategori_produk.length} kategori aktif siap dipakai untuk PO.`,
    added,
    updated,
    categories: data.kategori_produk,
  };
}

function ensureCategoryInStore(data: any, nama: string, deskripsi: string, sumber: string) {
  const norm = nama.trim().toUpperCase();
  const exist = data.kategori_produk.find((k: any) => {
    const kn = String(k.nama || "").trim().toUpperCase();
    return kn === norm || 
      (norm.includes("TULANG") && kn.includes("TULANG")) || 
      (norm.includes("PECAH POLA") && kn.includes("PECAH POLA")) ||
      (norm.includes("STRAIGHT") && kn.includes("STRAIGHT"));
  });

  if (exist) {
    if (!exist.sumber) exist.sumber = sumber;
    if (!exist.deskripsi && deskripsi) exist.deskripsi = deskripsi;
    if (norm.includes("TULANG") && !exist.nama.includes("BAGGY")) {
      exist.nama = "TULANG (BAGGY LIPAT BESAR)";
      exist.deskripsi = deskripsi;
    }
    return { action: "updated", id: exist.id };
  }

  const id = nextId(data, "kategori_produk");
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  const newCat = {
    id,
    uid: `KTG-${randomStr}`,
    nama: norm,
    deskripsi: deskripsi || `Kategori produk dari toko online (${sumber})`,
    sumber: sumber,
    createdAt: new Date().toISOString(),
  };
  data.kategori_produk.push(newCat);
  return { action: "added", id };
}

