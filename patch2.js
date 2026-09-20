const fs = require('fs');
let code = fs.readFileSync('src/app/(owner)/atur-vendor/page.tsx', 'utf8');

// The toggle component is:
// <Toggle value={tipeForm.perlu_gaji} onChange={() => setTipeForm(f => ({ ...f, perlu_gaji: !f.perlu_gaji }))} colorOn="#16A34A" />

const findToggleGaji = `<div style={{ marginBottom: 24, padding: "14px", background: "#F8FAFC", borderRadius: 12, border: "1px solid #E2E8F0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13, color: "#0F172A", display: "flex", alignItems: "center", gap: 6 }}><Banknote size={14} /> Perlu Pencatatan Gaji?</div>
                    <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>Apakah perlu input upah/gaji per pcs?</div>
                  </div>
                  <Toggle value={tipeForm.perlu_gaji} onChange={() => setTipeForm(f => ({ ...f, perlu_gaji: !f.perlu_gaji }))} colorOn="#16A34A" />
                </div>
              </div>`;

const newToggles = `<div style={{ marginBottom: 24, padding: "14px", background: "#F8FAFC", borderRadius: 12, border: "1px solid #E2E8F0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13, color: "#0F172A", display: "flex", alignItems: "center", gap: 6 }}><Banknote size={14} /> Perlu Pencatatan Gaji?</div>
                    <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>Apakah perlu input upah/gaji per pcs?</div>
                  </div>
                  <Toggle value={tipeForm.perlu_gaji} onChange={() => setTipeForm(f => ({ ...f, perlu_gaji: !f.perlu_gaji }))} colorOn="#16A34A" />
                </div>
              </div>

              <div style={{ marginBottom: 24, padding: "14px", background: "#F8FAFC", borderRadius: 12, border: "1px solid #E2E8F0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13, color: "#0F172A", display: "flex", alignItems: "center", gap: 6 }}><Settings2 size={14} /> Gunakan Throttle (Batas Request)?</div>
                    <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>Vendor wajib menyelesaikan persentase progres sebelum menarik kerjaan baru.</div>
                  </div>
                  <Toggle value={tipeForm.perlu_throttle || false} onChange={() => setTipeForm(f => ({ ...f, perlu_throttle: !f.perlu_throttle }))} colorOn="#F59E0B" />
                </div>
              </div>`;

code = code.replace(findToggleGaji, newToggles);
fs.writeFileSync('src/app/(owner)/atur-vendor/page.tsx', code, 'utf8');
