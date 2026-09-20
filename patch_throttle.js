const fs = require('fs');

// 1. UPDATE API vendor-types
let apiCode = fs.readFileSync('src/app/api/vendor-types/route.ts', 'utf8');

apiCode = apiCode.replace(/perlu_gaji: true, createdAt/g, 'perlu_gaji: true, perlu_throttle: true, createdAt');
apiCode = apiCode.replace(/perlu_gaji: false, createdAt/g, 'perlu_gaji: false, perlu_throttle: false, createdAt');

apiCode = apiCode.replace(
  'const { nama, slug, emoji, perlu_portal, portal_path, perlu_gaji } = body;',
  'const { nama, slug, emoji, perlu_portal, portal_path, perlu_gaji, perlu_throttle } = body;'
);
apiCode = apiCode.replace(
  'perlu_gaji: !!perlu_gaji, createdAt:',
  'perlu_gaji: !!perlu_gaji, perlu_throttle: !!perlu_throttle, createdAt:'
);
fs.writeFileSync('src/app/api/vendor-types/route.ts', apiCode, 'utf8');

// 2. UPDATE UI atur-vendor
let uiCode = fs.readFileSync('src/app/(owner)/atur-vendor/page.tsx', 'utf8');

// 2a. emptyType
uiCode = uiCode.replace(
  'perlu_gaji: false };',
  'perlu_gaji: false, perlu_throttle: false };'
);

// 2b. Add Toggle for perlu_throttle in Tipe Vendor Modal
const throttleToggle = `                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", background: "rgba(241, 245, 249, 0.5)", borderRadius: "var(--radius-md)" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6 }}>
                        <Settings2 size={16} /> Gunakan Throttle (Batas Request)?
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                        Vendor wajib menyelesaikan persentase progres sebelum menarik kerjaan baru.
                      </div>
                    </div>
                    <label className="toggle-switch">
                      <input type="checkbox" checked={typeForm.perlu_throttle} onChange={e => setTypeForm(f => ({ ...f, perlu_throttle: e.target.checked }))} />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>`;

uiCode = uiCode.replace(
  'vendor wajib input upah/gaji per pcs?\n                      </div>\n                    </div>\n                    <label className="toggle-switch">\n                      <input type="checkbox" checked={typeForm.perlu_gaji} onChange={e => setTypeForm(f => ({ ...f, perlu_gaji: e.target.checked }))} />\n                      <span className="toggle-slider"></span>\n                    </label>\n                  </div>',
  'vendor wajib input upah/gaji per pcs?\n                      </div>\n                    </div>\n                    <label className="toggle-switch">\n                      <input type="checkbox" checked={typeForm.perlu_gaji} onChange={e => setTypeForm(f => ({ ...f, perlu_gaji: e.target.checked }))} />\n                      <span className="toggle-slider"></span>\n                    </label>\n                  </div>\n' + throttleToggle
);

// 2c. Change condition for showing throttle in Edit Vendor Modal
uiCode = uiCode.replace(
  '{vendorForm.tipe === "cmt" && (',
  '{getTipeInfo(vendorForm.tipe)?.perlu_throttle && ('
);

// 2d. Replace "CMT" text inside the throttle div with dynamic vendor name
uiCode = uiCode.replace(
  'CMT harus mencapai persentase ini sebelum bisa request kain baru',
  '{getTipeInfo(vendorForm.tipe)?.nama || "Vendor"} harus mencapai persentase ini sebelum bisa request kerjaan baru'
);
uiCode = uiCode.replace(
  '" CMT bebas request kapan saja tanpa syarat."',
  '` ${getTipeInfo(vendorForm.tipe)?.nama || "Vendor"} bebas request kapan saja tanpa syarat.`'
);
uiCode = uiCode.replace(
  'Ringan: CMT baru bisa request setelah',
  'Ringan: ${getTipeInfo(vendorForm.tipe)?.nama || "Vendor"} baru bisa request setelah'
);
uiCode = uiCode.replace(
  'Sedang: CMT baru bisa request setelah',
  'Sedang: ${getTipeInfo(vendorForm.tipe)?.nama || "Vendor"} baru bisa request setelah'
);
uiCode = uiCode.replace(
  'Ketat: CMT baru bisa request setelah',
  'Ketat: ${getTipeInfo(vendorForm.tipe)?.nama || "Vendor"} baru bisa request setelah'
);


fs.writeFileSync('src/app/(owner)/atur-vendor/page.tsx', uiCode, 'utf8');
