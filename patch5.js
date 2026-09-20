const fs = require('fs');

let po = fs.readFileSync('src/app/api/penjualan-online/route.ts', 'utf8');
po = po.replace(/data\.penjualan_online/g, '(data as any).penjualan_online');
fs.writeFileSync('src/app/api/penjualan-online/route.ts', po, 'utf8');

let ret = fs.readFileSync('src/app/api/retail/route.ts', 'utf8');
ret = ret.replace(/data\.retail_sales/g, '(data as any).retail_sales');
fs.writeFileSync('src/app/api/retail/route.ts', ret, 'utf8');