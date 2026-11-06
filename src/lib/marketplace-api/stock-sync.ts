/**
 * Sinkronisasi Dua Arah: Data Barang (Gudang & Stok Konveksi) <-> Marketplace (Shopee & TikTok).
 *
 * 1. importProductsFromMarketplace:
 *    Tarik produk & varian SKU dari toko online yang terhubung ke Data Barang konveksi.
 *    Mencegah user input manual dari awal.
 *
 * 2. pushWarehouseStockToMarketplace:
 *    Kirim stok fisik terkini di gudang konveksi ke seluruh varian di Shopee & TikTok,
 *    sehingga stok marketplace selalu sinkron dengan gudang.
 */

import { nextId } from "@/lib/data-store";
import { getShops, type MarketplaceShop } from "./common";
import { ensureFreshToken } from "./sync";
import { shopeeGetProducts, shopeeUpdateStock } from "./shopee";
import { tiktokGetProducts, tiktokUpdateStock } from "./tiktok";
import { getStockSummary, ensureBarangKode } from "@/lib/stock";

export interface MarketplaceSyncResult {
  success: boolean;
  message: string;
  imported?: number;
  updated?: number;
  details?: any[];
}

/** Tebak warna dari nama variasi atau judul. */
function guessColor(str: string): string {
  const lower = String(str || "").toLowerCase();
  if (lower.includes("retro")) return "Retro Fold";
  if (lower.includes("raw denim") || lower.includes("raw")) return "Raw Denim Fold";
  if (lower.includes("medium blue") || lower.includes("blue")) return "Medium Blue";
  if (lower.includes("snow black") || lower.includes("black") || lower.includes("hitam")) return "Snow Black";
  if (lower.includes("light blue") || lower.includes("light")) return "Light Blue";
  if (lower.includes("biowash")) return "Biowash";
  return "";
}

/** Bersihkan kode SKU agar ramah sistem konveksi. */
function cleanSku(sku: string): string {
  return String(sku || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9_-]/g, "");
}

/**
 * Tarik semua produk dan SKU dari toko marketplace yang terhubung ke Data Barang.
 */
export async function importProductsFromMarketplace(data: any): Promise<MarketplaceSyncResult> {
  const activeShops = getShops(data).filter((s) => s.aktif);
  if (activeShops.length === 0) {
    return {
      success: false,
      message: "Belum ada toko yang terhubung atau aktif di Pengaturan -> Integrasi Marketplace. Hubungkan toko terlebih dahulu.",
    };
  }

  if (!Array.isArray(data.data_barang)) data.data_barang = [];
  if (!Array.isArray(data.kategori_produk) || data.kategori_produk.length === 0) {
    data.kategori_produk = [
      { id: 1, nama: "JEANS WANITA" },
      { id: 2, nama: "JEANS PRIA" },
      { id: 3, nama: "KULOT" },
    ];
  }
  const defaultKatId = data.kategori_produk[0].id;

  let importedCount = 0;
  let updatedCount = 0;
  const logDetails: any[] = [];

  for (const rawShop of activeShops) {
    let shop: MarketplaceShop;
    try {
      shop = await ensureFreshToken(rawShop);
    } catch (e: any) {
      logDetails.push({ shop: rawShop.shop_name, error: e.message });
      continue;
    }

    if (shop.platform === "shopee") {
      const shopeeProds = await shopeeGetProducts(shop);
      for (const p of shopeeProds) {
        // Ambil base SKU atau buat dari nama
        let baseSku = cleanSku(p.item_sku);
        if (!baseSku && p.models?.length > 0) {
          const firstModelSku = cleanSku(p.models[0].model_sku);
          // Bila SKU variasi berbentuk BURDIL-RETRO-M, ambil BURDIL-RETRO
          const parts = firstModelSku.split("-");
          baseSku = parts.length > 1 ? parts.slice(0, -1).join("-") : firstModelSku;
        }
        if (!baseSku) {
          baseSku = cleanSku(p.item_name.slice(0, 15));
        }

        // Cari apakah produk sudah ada di Data Barang (berdasarkan nama atau kode)
        let exist = data.data_barang.find(
          (b: any) =>
            (b.kode && cleanSku(b.kode) === baseSku) ||
            String(b.nama_barang).trim().toLowerCase() === String(p.item_name).trim().toLowerCase()
        );

        const mappings = (p.models && p.models.length > 0 ? p.models : [{ model_id: undefined, model_sku: p.item_sku, stock: p.price }]).map(
          (m: any) => ({
            platform: "shopee",
            shop_key: shop.key,
            shop_name: shop.shop_name,
            item_id: p.item_id,
            model_id: m.model_id,
            seller_sku: cleanSku(m.model_sku || p.item_sku),
            variation_name: m.model_name || "",
          })
        );

        if (exist) {
          // Update mapping toko
          exist.marketplace_mappings = exist.marketplace_mappings || [];
          for (const mapItem of mappings) {
            const mIdx = exist.marketplace_mappings.findIndex(
              (x: any) => x.shop_key === mapItem.shop_key && x.item_id === mapItem.item_id && x.model_id === mapItem.model_id
            );
            if (mIdx !== -1) exist.marketplace_mappings[mIdx] = mapItem;
            else exist.marketplace_mappings.push(mapItem);
          }
          if (!exist.kode && baseSku) exist.kode = baseSku;
          updatedCount++;
          logDetails.push({ action: "updated", nama: exist.nama_barang, kode: exist.kode });
        } else {
          // Buat barang baru
          const newId = nextId(data, "data_barang" as any);
          const newItem = {
            id: newId,
            uid: `BRG-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
            nama_barang: p.item_name,
            kode: baseSku,
            warna: guessColor(p.item_name) || (p.models?.[0]?.model_name ? guessColor(p.models[0].model_name) : ""),
            kategori_id: defaultKatId,
            harga_beli: Math.round(Number(p.price || 100000) * 0.5),
            harga_jual: Number(p.price || 100000),
            stok: 0,
            sumber: "manual",
            createdAt: new Date().toISOString(),
            marketplace_mappings: mappings,
          };
          ensureBarangKode(data, newItem);
          data.data_barang.push(newItem);
          importedCount++;
          logDetails.push({ action: "created", nama: newItem.nama_barang, kode: newItem.kode });
        }
      }
    } else if (shop.platform === "tiktok") {
      const tiktokProds = await tiktokGetProducts(shop);
      for (const p of tiktokProds) {
        let baseSku = "";
        if (p.skus?.length > 0) {
          const firstSku = cleanSku(p.skus[0].seller_sku);
          const parts = firstSku.split("-");
          baseSku = parts.length > 1 ? parts.slice(0, -1).join("-") : firstSku;
        }
        if (!baseSku) baseSku = cleanSku(p.title.slice(0, 15));

        let exist = data.data_barang.find(
          (b: any) =>
            (b.kode && cleanSku(b.kode) === baseSku) ||
            String(b.nama_barang).trim().toLowerCase() === String(p.title).trim().toLowerCase()
        );

        const mappings = (p.skus || []).map((s: any) => ({
          platform: "tiktok",
          shop_key: shop.key,
          shop_name: shop.shop_name,
          product_id: p.product_id,
          sku_id: s.id,
          seller_sku: cleanSku(s.seller_sku),
        }));

        const price = p.skus?.[0]?.price ? Number(p.skus[0].price) : 100000;

        if (exist) {
          exist.marketplace_mappings = exist.marketplace_mappings || [];
          for (const mapItem of mappings) {
            const mIdx = exist.marketplace_mappings.findIndex(
              (x: any) => x.shop_key === mapItem.shop_key && x.sku_id === mapItem.sku_id
            );
            if (mIdx !== -1) exist.marketplace_mappings[mIdx] = mapItem;
            else exist.marketplace_mappings.push(mapItem);
          }
          if (!exist.kode && baseSku) exist.kode = baseSku;
          updatedCount++;
          logDetails.push({ action: "updated", nama: exist.nama_barang, kode: exist.kode });
        } else {
          const newId = nextId(data, "data_barang" as any);
          const newItem = {
            id: newId,
            uid: `BRG-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
            nama_barang: p.title,
            kode: baseSku,
            warna: guessColor(p.title),
            kategori_id: defaultKatId,
            harga_beli: Math.round(price * 0.5),
            harga_jual: price,
            stok: 0,
            sumber: "manual",
            createdAt: new Date().toISOString(),
            marketplace_mappings: mappings,
          };
          ensureBarangKode(data, newItem);
          data.data_barang.push(newItem);
          importedCount++;
          logDetails.push({ action: "created", nama: newItem.nama_barang, kode: newItem.kode });
        }
      }
    }
  }

  return {
    success: true,
    message: `Berhasil sinkronkan katalog: ${importedCount} produk baru ditambahkan ke Data Barang, ${updatedCount} produk diperbarui tautan SKU-nya.`,
    imported: importedCount,
    updated: updatedCount,
    details: logDetails,
  };
}

/**
 * Kirim / update stok dari gudang konveksi ke seluruh toko Shopee & TikTok yang terhubung.
 */
export async function pushWarehouseStockToMarketplace(data: any, targetBarangId?: number): Promise<MarketplaceSyncResult> {
  const activeShops = getShops(data).filter((s) => s.aktif);
  if (activeShops.length === 0) {
    return {
      success: false,
      message: "Belum ada toko yang terhubung atau aktif di Pengaturan -> Integrasi Marketplace.",
    };
  }

  // Hitung stok aktual saat ini dari ledger Gudang & Stok
  const summary = getStockSummary(data);
  const byBarang = new Map(summary.filter((r) => r.barang_id != null).map((r) => [String(r.barang_id), r]));

  const barangList = (data.data_barang || []).filter((b: any) => !targetBarangId || Number(b.id) === Number(targetBarangId));
  if (barangList.length === 0) {
    return { success: false, message: "Tidak ada data barang yang dipilih untuk dikirimkan stoknya." };
  }

  let totalUpdated = 0;
  const results: any[] = [];

  for (const rawShop of activeShops) {
    let shop: MarketplaceShop;
    try {
      shop = await ensureFreshToken(rawShop);
    } catch (e: any) {
      results.push({ shop: rawShop.shop_name, error: e.message });
      continue;
    }

    if (shop.platform === "shopee") {
      const updates: { item_id: number; model_id?: number; stock: number }[] = [];

      for (const b of barangList) {
        const led = byBarang.get(String(b.id));
        const totalStok = led ? led.stok_saat_ini : Number(b.stok || 0);
        const sizes = led?.sizes || [];

        const mappings = (b.marketplace_mappings || []).filter((m: any) => m.platform === "shopee" && m.shop_key === shop.key);
        for (const m of mappings) {
          let targetQty = totalStok;
          // Jika mapping variasi memiliki ukuran tertentu, cocokkan dengan stok size tersebut
          if (m.variation_name && sizes.length > 0) {
            const matchedSize = sizes.find((s) => m.variation_name.toUpperCase().includes(s.size.toUpperCase()));
            if (matchedSize) targetQty = matchedSize.jumlah;
          }
          updates.push({
            item_id: Number(m.item_id),
            model_id: m.model_id ? Number(m.model_id) : undefined,
            stock: targetQty,
          });
        }
      }

      if (updates.length > 0) {
        const res = await shopeeUpdateStock(shop, updates);
        totalUpdated += updates.length;
        results.push({ shop: shop.shop_name, platform: "shopee", count: updates.length, res });
      }
    } else if (shop.platform === "tiktok") {
      const updates: { product_id: string; sku_id: string; stock: number }[] = [];

      for (const b of barangList) {
        const led = byBarang.get(String(b.id));
        const totalStok = led ? led.stok_saat_ini : Number(b.stok || 0);

        const mappings = (b.marketplace_mappings || []).filter((m: any) => m.platform === "tiktok" && m.shop_key === shop.key);
        for (const m of mappings) {
          updates.push({
            product_id: String(m.product_id),
            sku_id: String(m.sku_id),
            stock: totalStok,
          });
        }
      }

      if (updates.length > 0) {
        const res = await tiktokUpdateStock(shop, updates);
        totalUpdated += updates.length;
        results.push({ shop: shop.shop_name, platform: "tiktok", count: updates.length, res });
      }
    }
  }

  // Tandai waktu update terakhir
  data._last_marketplace_stock_push = new Date().toISOString();

  return {
    success: true,
    message: `Berhasil mengirim pembaruan stok ke marketplace untuk ${totalUpdated} item variasi di toko yang terhubung.`,
    updated: totalUpdated,
    details: results,
  };
}
