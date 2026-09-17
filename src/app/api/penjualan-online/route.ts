import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";

export async function GET() {
  const data = readData();
  return NextResponse.json(data.penjualan_online || []);
}

export async function POST(req: NextRequest) {
  try {
    const data = readData();
    const body = await req.json();
    
    if (!Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid data format. Expected an array." }, { status: 400 });
    }

    if (!data.penjualan_online) {
      data.penjualan_online = [];
    }

    let addedCount = 0;
    let deductedCount = 0;

    for (const item of body) {
      // Check if order_id already exists to prevent duplicates
      const exists = data.penjualan_online.find(r => r.order_id === item.order_id);
      
      if (!exists) {
        data.penjualan_online.push({
          id: nextId(data, "penjualan_online"),
          order_id: item.order_id,
          status: item.status,
          product_name: item.product_name,
          variation: item.variation,
          quantity: Number(item.quantity) || 1,
          order_amount: Number(item.order_amount) || 0,
          seller_sku: item.seller_sku || "Unknown SKU",
          buyer_username: item.buyer_username || "-",
          recipient: item.recipient || "-",
          tanggal_pesanan: item.tanggal_pesanan || new Date().toISOString(),
          tanggal_diimpor: new Date().toISOString(),
          jatuh_tempo: item.jatuh_tempo || "",
          tipe_pesanan: item.tipe_pesanan || "Normal",
          phone: item.phone,
          address: item.address,
          city: item.city,
          province: item.province,
          tracking_id: item.tracking_id,
          shipping_provider: item.shipping_provider,
          payment_method: item.payment_method,
        });
        addedCount++;

        // Deduct stock if status is "Selesai" or "Dikirim" (or anything meaning successfully processed sales)
        // We will exclude "Dibatalkan" or "Cancel" from stock deduction.
        const isCanceled = item.status?.toLowerCase().includes("batal") || item.status?.toLowerCase().includes("cancel");
        if (!isCanceled) {
          const qty = Number(item.quantity) || 1;
          const sku = item.seller_sku || "Unknown SKU";
          
          // Find the stock category matching the Seller SKU (or create it if it doesn't exist)
          let stockItem = data.stock.find(s => s.kategori === sku);
          if (!stockItem) {
            stockItem = {
              id: nextId(data, "stock"),
              kategori: sku,
              stok_saat_ini: 0,
              updated_at: new Date().toISOString(),
            };
            data.stock.push(stockItem);
          }
          
          // Deduct stock
          stockItem.stok_saat_ini -= qty;
          stockItem.updated_at = new Date().toISOString();

          // Add to stock_movements
          data.stock_movements.push({
            id: nextId(data, "stock_movements"),
            tanggal: new Date().toISOString(),
            jenis: "keluar",
            kategori: sku,
            jumlah: qty,
            keterangan: `Penjualan Online TikTok: ${item.order_id}`,
            referensi_tipe: "penjualan_online",
            referensi_id: item.order_id,
          });

          deductedCount++;
        }
      } else {
        if (item.phone) exists.phone = item.phone;
        if (item.address) exists.address = item.address;
        if (item.city) exists.city = item.city;
        if (item.province) exists.province = item.province;
        if (item.tracking_id) exists.tracking_id = item.tracking_id;
        if (item.shipping_provider) exists.shipping_provider = item.shipping_provider;
        if (item.payment_method) exists.payment_method = item.payment_method;
        if (item.tipe_pesanan) exists.tipe_pesanan = item.tipe_pesanan;
        if (item.jatuh_tempo) exists.jatuh_tempo = item.jatuh_tempo;
      }
    }

    writeData(data);
    return NextResponse.json({ success: true, added: addedCount, deducted: deductedCount, total: data.penjualan_online.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
