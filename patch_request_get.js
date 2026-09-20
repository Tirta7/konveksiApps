const fs = require('fs');

let api = fs.readFileSync('src/app/api/cmt-request/route.ts', 'utf8');

const targetStr = `  // Attach vendor name + pemotongan cross-reference
  const withNames = requests.map((r: any) => {
    const vendor = (data.vendors || []).find((v: any) => v.id === r.vendor_id);
    const pemo = r.pemotongan_id
      ? (data.pemotongan_kain || []).find((p: any) => p.id === r.pemotongan_id)
      : null;
    return {
      ...r,
      vendor_nama: vendor?.nama || "Unknown",
      vendor_kode: vendor?.kode || "-",
      pemotongan: pemo ? {
        id: pemo.id,
        nama_barang: pemo.nama_barang,
        model: pemo.model,
        tanggal: pemo.tanggal,
        total_pcs: pemo.total_pcs,
        sisa_total: (pemo.sizeBreakdown || []).reduce((s: number, x: any) => s + (x.sisa || 0), 0),
        sizeBreakdown: pemo.sizeBreakdown,
      } : null,
    };
  }).reverse();`;

const newStr = `  // Attach vendor name + pemotongan cross-reference
  const withNames = requests.map((r: any) => {
    const vendor = (data.vendors || []).find((v: any) => v.id === r.vendor_id);
    const pemo = r.pemotongan_id
      ? (data.pemotongan_kain || []).find((p: any) => p.id === r.pemotongan_id)
      : null;
    const transfer = r.transfer_id
      ? (data.produksi_transfers || []).find((t: any) => t.id === r.transfer_id)
      : null;
      
    let mockPemotongan = null;
    if (pemo) {
      mockPemotongan = {
        id: pemo.id,
        nama_barang: pemo.nama_barang,
        model: pemo.model,
        tanggal: pemo.tanggal,
        total_pcs: pemo.total_pcs,
        sisa_total: (pemo.sizeBreakdown || []).reduce((s: number, x: any) => s + (x.sisa || 0), 0),
        sizeBreakdown: pemo.sizeBreakdown,
        is_transfer: false
      };
    } else if (transfer) {
      const po = (data.po_produksi || []).find((p:any) => p.id === transfer.po_id);
      mockPemotongan = {
        id: transfer.id, // For UI selection
        nama_barang: po ? po.noPo : "Transfer Produksi",
        model: po ? po.model : "Unknown",
        tanggal: transfer.tanggal_kirim,
        total_pcs: transfer.jumlah_kirim,
        // Calculate remaining pieces in the standby pool (in case another request took some)
        // Wait, for Standby pool, jumlah_kirim IS the remaining pieces when it's created or updated.
        sisa_total: transfer.jumlah_kirim, 
        sizeBreakdown: transfer.sizeBreakdown || [],
        is_transfer: true,
        transfer_id: transfer.id,
        po_id: transfer.po_id
      };
    }

    return {
      ...r,
      vendor_nama: vendor?.nama || "Unknown",
      vendor_kode: vendor?.kode || "-",
      vendor_tipe: vendor?.tipe || "cmt",
      pemotongan: mockPemotongan,
    };
  }).reverse();`;

if (api.includes('// Attach vendor name + pemotongan cross-reference')) {
    api = api.replace(targetStr, newStr);
    fs.writeFileSync('src/app/api/cmt-request/route.ts', api, 'utf8');
    console.log("Successfully patched api/cmt-request/route.ts GET method");
}