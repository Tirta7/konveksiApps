const fs = require('fs');
let code = fs.readFileSync('src/app/(owner)/buat-spk/page.tsx', 'utf8');

const t1 = '<i className="fi fi-rr-layers" style={{ fontSize: 10 }} /> KAIN DIMINTA';
const r1 = '<i className="fi fi-rr-layers" style={{ fontSize: 10 }} /> {r.pemotongan.is_transfer ? "DARI STANDBY POOL" : "KAIN DIMINTA"}';
code = code.replace(t1, r1);

const t2 = '<div style={{ fontWeight: 900, fontSize: 15, color: "#16A34A" }}>{r.pemotongan.sisa_total}<span style={{ fontSize: 10, color: "#64748B", fontWeight: 600 }}> sisa</span></div>';
const r2 = '<div style={{ fontWeight: 900, fontSize: 15, color: "#16A34A" }}>{r.pemotongan.sisa_total}<span style={{ fontSize: 10, color: "#64748B", fontWeight: 600 }}> {r.pemotongan.is_transfer ? "ready" : "sisa"}</span></div>';
code = code.replace(t2, r2);

const t3 = `{(r.pemotongan.sizeBreakdown || []).map((s: any) => (
                                  <span key={s.size} style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 5, background: s.sisa > 0 ? "#DCFCE7" : "#F1F5F9", color: s.sisa > 0 ? "#16A34A" : "#94A3B8", border: \`1px solid \\${s.sisa > 0 ? "#86EFAC" : "#E2E8F0"}\` }}>
                                    {s.size}:{s.sisa}
                                  </span>
                                ))}`;
const r3 = `{(r.pemotongan.sizeBreakdown || []).map((s: any) => {
                                  const val = s.sisa !== undefined ? s.sisa : s.jumlah;
                                  return (
                                  <span key={s.size} style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 5, background: val > 0 ? "#DCFCE7" : "#F1F5F9", color: val > 0 ? "#16A34A" : "#94A3B8", border: \`1px solid \\${val > 0 ? "#86EFAC" : "#E2E8F0"}\` }}>
                                    {s.size}:{val}
                                  </span>
                                )})}`;

code = code.replace(t3, r3);

fs.writeFileSync('src/app/(owner)/buat-spk/page.tsx', code, 'utf8');
console.log("Success");