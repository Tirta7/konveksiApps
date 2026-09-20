const fs = require("fs");
const path = require("path");

const filesMap = {
  "src/app/api/vendors/route.ts": "vendors",
  "src/app/api/stock/route.ts": "stock",
  "src/app/api/supplier/route.ts": "data_supplier",
  "src/app/api/returns/produksi/route.ts": "retur_produksi",
  "src/app/api/returns/online/route.ts": "retur_online",
  "src/app/api/penjualan-online/route.ts": "penjualan_online",
  "src/app/api/retail/route.ts": "retail_sales",
  "src/app/api/po/route.ts": "purchase_orders",
  "src/app/api/barang/route.ts": "data_barang",
  "src/app/api/tracking/route.ts": "tracking_logs"
};

for (const [file, table] of Object.entries(filesMap)) {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    const template = `import { NextResponse } from "next/server";
import { readData } from "@/lib/data-store";

export async function GET() {
  try {
    const data = readData();
    return NextResponse.json(data.${table} || []);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
`;
    fs.writeFileSync(fullPath, template, "utf8");
    console.log("Fixed", file, "for", table);
  }
}
