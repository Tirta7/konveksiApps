const fs = require('fs');
const file = 'konveksi-data.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

// Delete transfer id 2 and 3 (the duplicates sent via Tarik Barang)
data.produksi_transfers = data.produksi_transfers.filter(t => t.id !== 2 && t.id !== 3);

// Set is_forwarded = true on transfer id 1 (the incoming transfer to Gudang)
const t1 = data.produksi_transfers.find(t => t.id === 1);
if (t1) {
  t1.is_forwarded = true;
}

fs.writeFileSync(file, JSON.stringify(data, null, 2));
console.log('Fixed PO GH-02 data');
