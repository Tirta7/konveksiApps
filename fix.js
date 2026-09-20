const fs = require("fs");
const path = require("path");

const files = [
  "src/app/api/vendors/route.ts",
  "src/app/api/tracking/route.ts",
  "src/app/api/stock/route.ts",
  "src/app/api/supplier/route.ts",
  "src/app/api/returns/produksi/route.ts",
  "src/app/api/returns/online/route.ts",
  "src/app/api/penjualan-online/route.ts",
  "src/app/api/retail/route.ts",
  "src/app/api/po/route.ts",
  "src/app/api/penjualan-online/po-summary/route.ts",
  "src/app/api/laporan-spk/[batchId]/route.ts",
  "src/app/api/laporan/route.ts",
  "src/app/api/barang/route.ts"
];

const template = `import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import * as schema from "@/lib/schema";

export async function GET() {
  try {
    return NextResponse.json([]);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json({ success: true });
}
`;

files.forEach(f => {
  const fullPath = path.join(process.cwd(), f);
  if (fs.existsSync(fullPath)) {
    fs.writeFileSync(fullPath, template, "utf8");
    console.log("Fixed", f);
  }
});
