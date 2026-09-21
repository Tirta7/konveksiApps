const fs = require('fs');
const path = require('path');

const files = [
  'src/app/api/barang/route.ts',
  'src/app/api/barcode/route.ts',
  'src/app/api/batches/route.ts',
  'src/app/api/dashboard/route.ts',
  'src/app/api/dashboard-ledger/route.ts',
  'src/app/api/debug-path/route.ts',
  'src/app/api/hutang/route.ts',
  'src/app/api/kain/route.ts',
  'src/app/api/kategori/route.ts',
  'src/app/api/laporan/route.ts',
  'src/app/api/laporan-spk/[batchId]/route.ts',
  'src/app/api/pembelian/route.ts',
  'src/app/api/pemotongan/route.ts',
  'src/app/api/penjualan-online/po-summary/route.ts',
  'src/app/api/penjualan-online/route.ts',
  'src/app/api/pipeline-stages/route.ts',
  'src/app/api/po/route.ts',
  'src/app/api/po-ledgers/route.ts',
  'src/app/api/po-pengambilan/route.ts',
  'src/app/api/po-produksi/route.ts',
  'src/app/api/retail/route.ts',
  'src/app/api/returns/online/route.ts',
  'src/app/api/returns/produksi/route.ts',
  'src/app/api/settlement/online/route.ts',
  'src/app/api/spk/route.ts',
  'src/app/api/stock/route.ts',
  'src/app/api/supplier/route.ts',
  'src/app/api/sys/ip/route.ts',
  'src/app/api/tracking/route.ts',
  'src/app/api/tukang-potong/route.ts',
  'src/app/api/vendor-types/route.ts',
  'src/app/api/vendors/route.ts'
];

for (const f of files) {
  const p = path.join(__dirname, f);
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, 'utf8');
    if (!content.includes('export const dynamic')) {
      content = 'export const dynamic = "force-dynamic";\n' + content;
      fs.writeFileSync(p, content);
      console.log('Added to', f);
    }
  }
}
