const fs = require('fs');
const data = JSON.parse(fs.readFileSync('konveksi-data.json'));

let changed = false;

if (data.produksi_transfers) {
  for (const t of data.produksi_transfers) {
    if (t.ke === 'gudang') {
      t.ke = 'washing';
      changed = true;
    }
  }
}

if (data.barcode_item) {
  for (const b of data.barcode_item) {
    if (b.status === 'gudang') {
      b.status = 'washing';
      changed = true;
    }
  }
}

if (changed) {
  fs.writeFileSync('konveksi-data.json', JSON.stringify(data, null, 2));
  console.log('Fixed data from gudang to washing');
}
