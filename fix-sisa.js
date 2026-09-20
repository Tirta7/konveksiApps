const fs = require('fs');

const dataFile = 'konveksi-data.json';
const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

// Reset all sisa to jumlah first
data.pemotongan_kain.forEach(p => {
  p.sizeBreakdown.forEach(s => {
    s.sisa = Number(s.jumlah) || 0;
  });
});

// Subtract based on po_produksi
(data.po_produksi || []).forEach(po => {
  const pemo = data.pemotongan_kain.find(p => p.id === po.pemotongan_id);
  if (pemo) {
    (po.sizeBreakdown || []).forEach(poSize => {
      const sIndex = pemo.sizeBreakdown.findIndex(s => s.size === poSize.size);
      if (sIndex !== -1) {
        pemo.sizeBreakdown[sIndex].sisa -= Number(poSize.jumlah);
        if (pemo.sizeBreakdown[sIndex].sisa < 0) {
          pemo.sizeBreakdown[sIndex].sisa = 0;
        }
      }
    });
  }
});

fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
console.log('Fixed sisa for all pemotongan_kain');
