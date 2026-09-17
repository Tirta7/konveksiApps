import { NextResponse } from "next/server";
import { readData } from "@/lib/data-store";

export async function GET() {
  try {
    const data = readData();
    const poSales = (data.penjualan_online || []).filter(p => p.tipe_pesanan === 'Pre-order' && !p.status.toLowerCase().includes('batal') && !p.status.toLowerCase().includes('cancel'));

    // Group by base product name (excluding variation)
    // Actually in the CSV:
    // Product Name: LAVAIRA ID - Highwaist Jeans Straight Fold...
    // Variation: RETRO FOLD, L BB 49 -54 KG
    // The base name we want is just the first part of Variation, e.g. "RETRO FOLD" or "RAW DENIM FOLD"
    
    const summary: Record<string, { model: string, total_qty: number, sizes: Record<string, number> }> = {};
    
    poSales.forEach(sale => {
      // Example variation: "RETRO FOLD, L BB 49 -54 KG" or "RAW DENIM FOLD, M BB 44 - 48 KG"
      const variation = sale.variation || "";
      const parts = variation.split(",");
      const model = parts[0]?.trim() || "Unknown Model";
      let size = "Unknown Size";
      if (parts.length > 1) {
        // e.g. " L BB 49 -54 KG" -> extract just "L"
        const sizePart = parts[1].trim().split(" ")[0]; // takes "L"
        size = sizePart;
      }
      
      const qty = parseInt(String(sale.quantity)) || 1;
      
      if (!summary[model]) {
        summary[model] = { model, total_qty: 0, sizes: {} };
      }
      
      summary[model].total_qty += qty;
      summary[model].sizes[size] = (summary[model].sizes[size] || 0) + qty;
    });

    return NextResponse.json(Object.values(summary));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
