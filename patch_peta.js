const fs = require('fs');
let code = fs.readFileSync('src/app/(owner)/peta-perjalanan/page.tsx', 'utf8');

// The STAGE_CONFIG looks like this:
// const STAGE_CONFIG: Record<string, { label: string; color: string; bg: string; fiIcon: string }> = { ... }

// Find where transfers are rendered
// const cfg = STAGE_CONFIG[t.ke] || STAGE_CONFIG.gudang;
// badge={`${cfg.label}${isDone ? "  Selesai" : "  Dalam Proses"}`}

const replaceTarget = `const cfg = STAGE_CONFIG[t.ke] || STAGE_CONFIG.gudang;`;
const newLogic = `const cfg = STAGE_CONFIG[t.ke] || { label: t.ke.toUpperCase(), color: "#3B82F6", bg: "#EFF6FF", fiIcon: "box-open" };`;

code = code.replace(replaceTarget, newLogic);

// We need to also fix title: `Dikirim ke: ${t.vendor_ke_nama || cfg.label}`
// Wait, if t.vendor_ke_nama is "CMT Gianto", it will say "Dikirim ke: CMT Gianto".
// The user said: "maka tampilannya keterangan bukan 'Dikirim ke: CMT Gianto', Siap melakukan Washing"
// "begitu juga pada saat washing melaporkan selesai maka tampilannya, Siap melakukan bersih benang"
// So the history log title should NOT be "Dikirim ke: Vendor Name". It should be "Dikirim ke tahap Washing", or "Tahap: Washing".

code = code.replace(
  'title={`Dikirim ke: ${t.vendor_ke_nama || cfg.label}`}',
  'title={t.vendor_ke_nama ? `Dikirim ke: ${t.vendor_ke_nama} (${cfg.label})` : `Siap melakukan ${cfg.label}`}'
);

fs.writeFileSync('src/app/(owner)/peta-perjalanan/page.tsx', code, 'utf8');