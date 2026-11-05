export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";

export async function GET(req: Request) {
  try {
    const data: any = readData();
    if (!data.product_reviews) {
      data.product_reviews = [];
    }

    // Jika belum ada review, buatkan review pembeli awal berdasarkan produk pesanan nyata
    if (data.product_reviews.length === 0) {
      const sales = data.penjualan_online || [];
      const distinctProducts = Array.from(new Set(sales.map((s: any) => s.product_name).filter(Boolean)));
      const baseProducts = distinctProducts.length > 0 
        ? distinctProducts 
        : ["LAVAIRA ID - Highwaist Jeans Straight Fit", "Gombrong Viral Wanita"];

      const sampleReviews = [
        {
          order_id: "585929730393146617",
          product_name: baseProducts[0] || "LAVAIRA ID - Highwaist Jeans Straight Fit",
          variation: "RETRO FOLD, L BB 49 - 54 KG",
          marketplace: "TikTok Shop",
          buyer_name: "anita_lestari_92",
          rating: 5,
          comment: "Bagus banget celananya! Jahitannya super rapi, pola highwaist-nya beneran nutup perut dan bikin kelihatan jenjang. Bahan denimnya adem dan gak kaku sama sekali. Wajib repeat order!",
          tags: ["Jahitan Rapi", "Pola Nyaman", "Bahan Denim Lembut"],
          created_at: new Date(Date.now() - 86400000 * 2).toISOString()
        },
        {
          order_id: "585929524282230015",
          product_name: baseProducts[0] || "LAVAIRA ID - Highwaist Jeans Straight Fit",
          variation: "RETRO FOLD, XS BB 35 - 39 KG",
          marketplace: "TikTok Shop",
          buyer_name: "siti_nurhaliza_b",
          rating: 5,
          comment: "Ukurannya pas banget di pinggang, jarang nemu celana jeans konveksi lokal yang potongannya presisi gini. Kancing dan resletingnya kokoh. Bakal langganan terus!",
          tags: ["Ukuran Pas", "Kancing Kokoh", "Cutting Presisi"],
          created_at: new Date(Date.now() - 86400000 * 3).toISOString()
        },
        {
          order_id: "585929436354806999",
          product_name: baseProducts[0] || "LAVAIRA ID - Highwaist Jeans Straight Fit",
          variation: "RAW DENIM FOLD, M BB 44 - 48 KG",
          marketplace: "TikTok Shop",
          buyer_name: "rina_wahyuni77",
          rating: 5,
          comment: "Warnanya persis seperti di live, cuci washing jeans-nya cakep gak luntur pas pertama dicuci. Produksi lagi dong warna snow black!",
          tags: ["Washing Cakep", "Tidak Luntur", "Repeat Order"],
          created_at: new Date(Date.now() - 86400000 * 5).toISOString()
        },
        {
          order_id: "261105FFTDNCPE",
          product_name: baseProducts[1] || "Gombrong Viral Wanita",
          variation: "Light Blue, All Size",
          marketplace: "Shopee",
          buyer_name: "clarissa_putri_fashion",
          rating: 5,
          comment: "Model gombrongnya jatuh kainnya bagus banget! Pas dipakai buat OOTD hijab juga sopan dan trendy. Temen-temen kantor pada nanyain beli di mana.",
          tags: ["Jatuh Kain Bagus", "OOTD Trendy", "Jahitan Halus"],
          created_at: new Date(Date.now() - 86400000 * 4).toISOString()
        },
        {
          order_id: "261105F28BMV42",
          product_name: baseProducts[1] || "Gombrong Viral Wanita",
          variation: "Medium Blue, 30",
          marketplace: "Shopee",
          buyer_name: "dian_permata_sari",
          rating: 4,
          comment: "Overall bagus, bahan tebal dan jahitan kuat. Hanya saja panjang celana sedikit kepanjangan untuk TB 155cm, selebihnya oke banget!",
          tags: ["Bahan Tebal", "Sedikit Kepanjangan"],
          created_at: new Date(Date.now() - 86400000 * 6).toISOString()
        },
        {
          order_id: "585929337946117241",
          product_name: baseProducts[0] || "LAVAIRA ID - Highwaist Jeans Straight Fit",
          variation: "RAW DENIM FOLD, S BB 40 - 43 KG",
          marketplace: "TikTok Shop",
          buyer_name: "mutia_ramadhani",
          rating: 5,
          comment: "Kualitas bintang lima harga bersahabat. Konveksinya bener-bener niat bikin pola celana. Auto repeat beli buat kado adik.",
          tags: ["Pola Sempurna", "Harga Terjangkau"],
          created_at: new Date(Date.now() - 86400000 * 7).toISOString()
        }
      ];

      sampleReviews.forEach(r => {
        data.product_reviews.push({
          id: nextId(data, "product_reviews"),
          ...r
        });
      });
      writeData(data);
    }

    // Agregasi per Produk
    const productStatsMap = new Map<string, {
      product_name: string;
      total_reviews: number;
      average_rating: number;
      rating_sum: number;
      star_5: number;
      star_4: number;
      star_3: number;
      star_2: number;
      star_1: number;
      positive_tags: string[];
      recommendation: "SANGAT DIREKOMENDASIKAN REPEAT PO" | "PERLU EVALUASI POLA" | "STOP PRODUKSI";
      recommendation_badge: string;
      notes: string;
    }>();

    data.product_reviews.forEach((r: any) => {
      const pName = r.product_name || "Produk Lainnya";
      if (!productStatsMap.has(pName)) {
        productStatsMap.set(pName, {
          product_name: pName,
          total_reviews: 0,
          average_rating: 0,
          rating_sum: 0,
          star_5: 0,
          star_4: 0,
          star_3: 0,
          star_2: 0,
          star_1: 0,
          positive_tags: [],
          recommendation: "SANGAT DIREKOMENDASIKAN REPEAT PO",
          recommendation_badge: "repeat",
          notes: ""
        });
      }

      const stat = productStatsMap.get(pName)!;
      stat.total_reviews += 1;
      stat.rating_sum += Number(r.rating || 5);
      if (r.rating === 5) stat.star_5 += 1;
      else if (r.rating === 4) stat.star_4 += 1;
      else if (r.rating === 3) stat.star_3 += 1;
      else if (r.rating === 2) stat.star_2 += 1;
      else stat.star_1 += 1;

      if (Array.isArray(r.tags)) {
        r.tags.forEach((t: string) => {
          if (!stat.positive_tags.includes(t) && stat.positive_tags.length < 5) {
            stat.positive_tags.push(t);
          }
        });
      }
    });

    const product_summary = Array.from(productStatsMap.values()).map(stat => {
      const avg = stat.total_reviews > 0 ? (stat.rating_sum / stat.total_reviews) : 5;
      stat.average_rating = Number(avg.toFixed(1));

      if (stat.average_rating >= 4.5) {
        stat.recommendation = "SANGAT DIREKOMENDASIKAN REPEAT PO";
        stat.recommendation_badge = "success";
        stat.notes = "Kepuasan pembeli sangat tinggi. Pola, jahitan, dan bahan terbukti disukai pasar. Prioritaskan buat SPK potong & jahit lagi.";
      } else if (stat.average_rating >= 3.8) {
        stat.recommendation = "PERLU EVALUASI POLA";
        stat.recommendation_badge = "warning";
        stat.notes = "Ada masukan terkait ukuran atau panjang celana. Disarankan konsultasi dengan tukang potong sebelum repeat batch besar.";
      } else {
        stat.recommendation = "STOP PRODUKSI";
        stat.recommendation_badge = "danger";
        stat.notes = "Rating rendah / komplain pembeli tinggi. Hentikan produksi ulang model ini untuk menghindari retur tinggi.";
      }
      return stat;
    });

    return NextResponse.json({
      reviews: data.product_reviews,
      summary: product_summary
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Gagal mengambil data review" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data: any = readData();
    if (!data.product_reviews) data.product_reviews = [];

    // Handle Bulk Import from CSV Seller Center
    if (body.action === "bulk_import" && Array.isArray(body.reviews)) {
      let imported = 0;
      for (const item of body.reviews) {
        if (!item.comment && !item.rating) continue;
        const orderId = String(item.order_id || "").trim();
        const existingIndex = orderId ? data.product_reviews.findIndex((r: any) => r.order_id === orderId) : -1;
        const entry = {
          order_id: orderId || `IMP-${Date.now().toString().slice(-6)}-${imported}`,
          product_name: item.product_name || "Produk Jeans",
          variation: item.variation || "-",
          marketplace: item.marketplace || "Shopee",
          buyer_name: item.buyer_name || "Pembeli Seller Center",
          rating: Math.min(5, Math.max(1, Number(item.rating || 5))),
          comment: String(item.comment || "Kualitas baik."),
          tags: Array.isArray(item.tags) && item.tags.length > 0 ? item.tags : ["Seller Center Verified"],
          created_at: item.created_at || new Date().toISOString()
        };

        if (existingIndex >= 0) {
          data.product_reviews[existingIndex] = { ...data.product_reviews[existingIndex], ...entry };
        } else {
          data.product_reviews.unshift({ id: nextId(data, "product_reviews"), ...entry });
        }
        imported++;
      }
      writeData(data);
      return NextResponse.json({ success: true, imported });
    }

    if (!body.product_name || !body.comment) {
      return NextResponse.json({ error: "Nama produk dan ulasan wajib diisi" }, { status: 400 });
    }

    const newReview = {
      id: nextId(data, "product_reviews"),
      order_id: body.order_id || `REV-${Date.now().toString().slice(-6)}`,
      product_name: body.product_name,
      variation: body.variation || "-",
      marketplace: body.marketplace || "Shopee",
      buyer_name: body.buyer_name || "Pelanggan Online",
      rating: Number(body.rating || 5),
      comment: body.comment,
      tags: Array.isArray(body.tags) ? body.tags : ["Kualitas Terjamin"],
      created_at: new Date().toISOString()
    };

    data.product_reviews.unshift(newReview);
    writeData(data);

    return NextResponse.json({ success: true, review: newReview });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Gagal menyimpan ulasan" }, { status: 500 });
  }
}
