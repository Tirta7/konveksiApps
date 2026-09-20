const fs = require('fs');
let code = fs.readFileSync('src/app/(owner)/buat-spk/page.tsx', 'utf8');

const target1 = `<i className="fi fi-rr-layers" style={{ fontSize: 10 }} /> KAIN DIMINTA`;
const target2 = `<div style={{ fontWeight: 900, fontSize: 15, color: "#16A34A" }}>{r.pemotongan.sisa_total}<span style={{ fontSize: 10, color: "#64748B", fontWeight: 600 }}> sisa</span></div>`;
const target3 = `{(r.pemotongan.sizeBreakdown || []).map((s: any) => (
                                  <span key={s.size} style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 5, background: s.sisa > 0 ? "#DCFCE7" : "#F1F5F9", color: s.sisa > 0 ? "#16A34A" : "#94A3B8", border: \`1px solid ${s.sisa > 0 ? "#86EFAC" : "#E2E8F0"}\` }}>
                                    {s.size}:{s.sisa}
                                  </span>
                                ))}`;

const replace1 = `<i className="fi fi-rr-layers" style={{ fontSize: 10 }} /> {r.pemotongan.is_transfer ? "DARI STANDBY POOL" : "KAIN DIMINTA"}`;
const replace2 = `<div style={{ fontWeight: 900, fontSize: 15, color: "#16A34A" }}>{r.pemotongan.sisa_total}<span style={{ fontSize: 10, color: "#64748B", fontWeight: 600 }}> {r.pemotongan.is_transfer ? "ready" : "sisa"}</span></div>`;
const replace3 = `{(r.pemotongan.sizeBreakdown || []).map((s: any) => {
                                  const val = s.sisa !== undefined ? s.sisa : s.jumlah;
                                  return (
                                  <span key={s.size} style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 5, background: val > 0 ? "#DCFCE7" : "#F1F5F9", color: val > 0 ? "#16A34A" : "#94A3B8", border: \`1px solid ${val > 0 ? "#86EFAC" : "#E2E8F0"}\` }}>
                                    {s.size}:{val}
                                  </span>
                                )})}`;

code = code.replace(target1, replace1);
code = code.replace(target2, replace2);
code = code.replace(target3, replace3);

fs.writeFileSync('src/app/(owner)/buat-spk/page.tsx', code, 'utf8');
console.log("Replaced successfully!");