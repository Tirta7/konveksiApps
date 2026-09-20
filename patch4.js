const fs = require('fs');
const { writeFileSync } = fs;

// 1. cmt-progres (PATCH support)
let cmt = fs.readFileSync('src/app/api/cmt-progres/route.ts', 'utf8');
if (!cmt.includes('export const PATCH = POST;')) {
    cmt += '\nexport const PATCH = POST;\n';
    writeFileSync('src/app/api/cmt-progres/route.ts', cmt, 'utf8');
}

// 2. penjualan-online (POST support)
let po = fs.readFileSync('src/app/api/penjualan-online/route.ts', 'utf8');
if (!po.includes('export async function POST')) {
    po = po.replace('import { readData } from "@/lib/data-store";', 'import { readData, writeData, nextId } from "@/lib/data-store";');
    po += `
export async function POST(req: Request) {
  try {
    const data = readData();
    if (!data.penjualan_online) data.penjualan_online = [];
    const body = await req.json();
    const id = nextId(data, "penjualan_online");
    const newSale = { id, ...body, tanggal: new Date().toISOString(), status: "Packing" };
    data.penjualan_online.push(newSale);
    
    // Potong stok siap_jual
    if (data.barcode_item) {
        let deducted = 0;
        for (let i = 0; i < data.barcode_item.length && deducted < (Number(body.jumlah) || 1); i++) {
            if (data.barcode_item[i].status === "siap_jual") {
                data.barcode_item[i].status = "terjual";
                deducted++;
            }
        }
    }
    
    writeData(data);
    return NextResponse.json(newSale);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
`;
    writeFileSync('src/app/api/penjualan-online/route.ts', po, 'utf8');
}

// 3. retail (POST support)
let ret = fs.readFileSync('src/app/api/retail/route.ts', 'utf8');
if (!ret.includes('export async function POST')) {
    ret = ret.replace('import { readData } from "@/lib/data-store";', 'import { readData, writeData, nextId } from "@/lib/data-store";');
    ret += `
export async function POST(req: Request) {
  try {
    const data = readData();
    if (!data.retail_sales) data.retail_sales = [];
    const body = await req.json();
    const id = nextId(data, "retail_sales");
    const newSale = { id, ...body, tanggal: new Date().toISOString() };
    data.retail_sales.push(newSale);
    
    // Potong stok siap_jual
    if (data.barcode_item) {
        let deducted = 0;
        for (let i = 0; i < data.barcode_item.length && deducted < (Number(body.jumlah) || 1); i++) {
            if (data.barcode_item[i].status === "siap_jual") {
                data.barcode_item[i].status = "terjual";
                deducted++;
            }
        }
    }
    
    writeData(data);
    return NextResponse.json(newSale);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
`;
    writeFileSync('src/app/api/retail/route.ts', ret, 'utf8');
}