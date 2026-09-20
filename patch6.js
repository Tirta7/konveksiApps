const fs = require('fs');

// 1. Update dashboard-cmt/page.tsx to add STANDBY option
let page = fs.readFileSync('src/app/(owner)/dashboard-cmt/page.tsx', 'utf8');
const searchOption = '<option value="GUDANG" style={{ fontWeight: "bold" }}> MASUK GUDANG PRODUKSI (SELESAI)</option>';
const replaceOption = searchOption + '\n                      <option value="STANDBY" style={{ fontWeight: "bold", color: "#2563EB" }}> LEMPAR KE STANDBY POOL (BISA DITARIK VENDOR LANJUTAN)</option>';

if (!page.includes('value="STANDBY"')) {
    page = page.replace(searchOption, replaceOption);
    fs.writeFileSync('src/app/(owner)/dashboard-cmt/page.tsx', page, 'utf8');
}

// 2. Update api/tarik-barang/route.ts to handle STANDBY
let route = fs.readFileSync('src/app/api/tarik-barang/route.ts', 'utf8');
if (!route.includes('ke_vendor_id === "STANDBY"')) {
    const routeSearch = 'const keVendor = (data.vendors || []).find((v: any) => String(v.id) === String(ke_vendor_id));';
    const routeReplace = `
      let keTipe = "vendor";
      let keVendorIdNum = null;

      if (ke_vendor_id === "STANDBY") {
        const dariVendor = (data.vendors || []).find((v: any) => String(v.id) === String(dari_vendor_id));
        const stages = (data.pipeline_stages || []).sort((a: any,b: any) => a.urutan - b.urutan);
        const myIdx = stages.findIndex((s: any) => s.slug === (dariVendor?.tipe || "cmt"));
        if (myIdx >= 0 && myIdx < stages.length - 1) {
            keTipe = stages[myIdx + 1].slug;
        } else {
            keTipe = "washing"; // fallback
        }
      } else {
        const keVendor = (data.vendors || []).find((v: any) => String(v.id) === String(ke_vendor_id));
        keTipe = keVendor?.tipe || "vendor";
        keVendorIdNum = Number(ke_vendor_id);
      }
`;
    // We need to replace the old assignment to keTipe and keVendor:
    const toReplaceBlock = `const keVendor = (data.vendors || []).find((v: any) => String(v.id) === String(ke_vendor_id));
      const dariVendor = (data.vendors || []).find((v: any) => String(v.id) === String(dari_vendor_id));
      const keTipe = keVendor?.tipe || "vendor";
      const dariTipe = dariVendor?.tipe || "cmt";`;

    const newBlock = `
      const dariVendor = (data.vendors || []).find((v: any) => String(v.id) === String(dari_vendor_id));
      const dariTipe = dariVendor?.tipe || "cmt";
` + routeReplace;

    route = route.replace(toReplaceBlock, newBlock);

    // also replace `vendor_id: Number(ke_vendor_id)` with `vendor_id: keVendorIdNum`
    route = route.replace('vendor_id: Number(ke_vendor_id),', 'vendor_id: keVendorIdNum,');

    fs.writeFileSync('src/app/api/tarik-barang/route.ts', route, 'utf8');
}
