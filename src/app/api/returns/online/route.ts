import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";

export async function GET() {
  const data = readData();
  return NextResponse.json(data.retur_online || []);
}

export async function POST(req: NextRequest) {
  try {
    const data = readData();
    const body = await req.json();
    
    // Body is expected to be an array of parsed objects from CSV
    if (!Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid data format. Expected an array." }, { status: 400 });
    }

    if (!data.retur_online) {
      data.retur_online = [];
    }

    let addedCount = 0;

    for (const item of body) {
      // Check if order_id already exists to prevent duplicates
      const exists = data.retur_online.find(r => r.order_id === item.order_id);
      if (!exists) {
        // Cross-reference with penjualan_online to get missing details (TikTok Return CSV lacks them)
        const salesOrder = data.penjualan_online?.find(s => s.order_id === item.order_id);
        
        data.retur_online.push({
          id: nextId(data, "retur_online"),
          order_id: item.order_id,
          product_name: item.product_name,
          variation: item.variation,
          return_quantity: Number(item.return_quantity) || 1,
          return_type: item.return_type || "Cancel",
          alasan: item.alasan || "Dibatalkan",
          status: "Menunggu Gudang",
          tanggal_batal: item.tanggal_batal || new Date().toISOString(),
          buyer_username: item.buyer_username,
          recipient: item.recipient !== "-" ? item.recipient : (salesOrder?.recipient || "-"),
          phone: item.phone !== "-" ? item.phone : (salesOrder?.phone || "-"),
          address: item.address !== "-" ? item.address : (salesOrder?.address || "-"),
          tracking_id: item.tracking_id !== "-" ? item.tracking_id : (salesOrder?.tracking_id || "-"),
          shipping_provider: item.shipping_provider !== "-" ? item.shipping_provider : (salesOrder?.shipping_provider || "-"),
          order_amount: item.order_amount,
          payment_method: item.payment_method !== "-" ? item.payment_method : (salesOrder?.payment_method || "-"),
          seller_sku: item.seller_sku,
          buyer_note: item.buyer_note
        });
        addedCount++;
      } else {
        // Update existing record with the newly extracted details if it already exists, avoiding overwriting with "-"
        if (item.buyer_username && item.buyer_username !== "-") exists.buyer_username = item.buyer_username;
        if (item.recipient && item.recipient !== "-") exists.recipient = item.recipient;
        if (item.phone && item.phone !== "-") exists.phone = item.phone;
        if (item.address && item.address !== "-") exists.address = item.address;
        if (item.tracking_id && item.tracking_id !== "-") exists.tracking_id = item.tracking_id;
        if (item.shipping_provider && item.shipping_provider !== "-") exists.shipping_provider = item.shipping_provider;
        if (item.order_amount && item.order_amount !== "-") exists.order_amount = item.order_amount;
        if (item.payment_method && item.payment_method !== "-") exists.payment_method = item.payment_method;
        if (item.seller_sku && item.seller_sku !== "-") exists.seller_sku = item.seller_sku;
        if (item.alasan && item.alasan !== "-") exists.alasan = item.alasan;
        if (item.return_type && item.return_type !== "-") exists.return_type = item.return_type;
        if (item.buyer_note && item.buyer_note !== "-") exists.buyer_note = item.buyer_note;

        // Try falling back to sales orders one more time just in case
        const salesOrder = data.penjualan_online?.find(s => s.order_id === item.order_id);
        if (salesOrder) {
          if (!exists.recipient || exists.recipient === "-") exists.recipient = salesOrder.recipient;
          if (!exists.phone || exists.phone === "-") exists.phone = salesOrder.phone;
          if (!exists.address || exists.address === "-") exists.address = salesOrder.address;
          if (!exists.shipping_provider || exists.shipping_provider === "-") exists.shipping_provider = salesOrder.shipping_provider;
          if (!exists.payment_method || exists.payment_method === "-") exists.payment_method = salesOrder.payment_method;
        }
      }
    }

    writeData(data);
    return NextResponse.json({ success: true, added: addedCount, total: data.retur_online.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const data = readData();
    const body = await req.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ error: "ID and status are required" }, { status: 400 });
    }

    const index = data.retur_online.findIndex(r => r.id === id);
    if (index === -1) {
      return NextResponse.json({ error: "Retur not found" }, { status: 404 });
    }

    data.retur_online[index].status = status;
    if (status === "Masuk Gudang" || status === "Hilang") {
      data.retur_online[index].tanggal_masuk = new Date().toISOString();
    }

    writeData(data);
    return NextResponse.json(data.retur_online[index]);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
