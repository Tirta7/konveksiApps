const fs = require('fs');
let code = fs.readFileSync("src/app/cmt/[id]/page.tsx", "utf8");
console.log(code.includes("pemotongan.nama_barang"));
console.log(code.includes("pemotonganReady"));