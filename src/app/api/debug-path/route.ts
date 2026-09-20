import { NextResponse } from "next/server";
import { readData } from "@/lib/data-store";

export async function GET() {
  const data = readData();
  return NextResponse.json({
    poCount: data.po_produksi?.length,
    vendorCount: data.vendors?.length,
    barcodeCount: data.barcode_item?.length,
    transferCount: data.produksi_transfers?.length,
    sample: data.barcode_item?.filter((b: any) => String(b.poId) === "7").slice(0, 3)
  });
}
