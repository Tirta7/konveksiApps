const fs = require('fs');
const file = 'konveksi-data.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

// Delete transfer id 10
data.produksi_transfers = data.produksi_transfers.filter(t => t.id !== 10);

// Set is_forwarded = true on transfer id 8
const t8 = data.produksi_transfers.find(t => t.id === 8);
if (t8) {
  t8.is_forwarded = true;
}

fs.writeFileSync(file, JSON.stringify(data, null, 2));
console.log('Fixed data for duplicate transfer');
