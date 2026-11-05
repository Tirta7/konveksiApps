export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";

export async function GET(req: Request) {
  try {
    const data: any = readData();
    if (!data.product_reviews) {
      data.product_reviews = [];
    }

    // Bersihkan total dan pastikan review dummy tidak pernah muncul
    const dummyNames = new Set([
      "anita_lestari_92",
      "siti_nurhaliza_b",
      "rina_wahyuni77",
      "clarissa_putri_fashion",
      "dian_permata_sari",
      "mutia_ramadhani"
    ]);
    if (Array.isArray(data.product_reviews) && data.product_reviews.some((r: any) => dummyNames.has(r.buyer_name))) {
      data.product_reviews = data.product_reviews.filter((r: any) => !dummyNames.has(r.buyer_name));
      writeData(data);
    }

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
