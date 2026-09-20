const fs = require('fs');
let code = fs.readFileSync('src/app/(owner)/buat-spk/page.tsx', 'utf8');

// 1. Add states
const stateTarget = `const [form, setForm] = useState({`;
const stateInjection = `
  const [downstreamModal, setDownstreamModal] = useState<any | null>(null);
  const [downstreamForm, setDownstreamForm] = useState<{size: string, max: number, jumlah: number|""}[]>([]);
  const [isSubmittingDownstream, setIsSubmittingDownstream] = useState(false);

`;
if (!code.includes('downstreamModal')) {
    code = code.replace(stateTarget, stateInjection + stateTarget);
}

// 2. Add submit handler
const submitHandlerTarget = `  const handleTargetDateChange = (dateStr: string) => {`;
const submitHandlerInjection = `
  const handleDownstreamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!downstreamModal) return;
    
    const items = downstreamForm.filter(p => Number(p.jumlah) > 0);
    const totalReq = items.reduce((s, i) => s + Number(i.jumlah), 0);
    
    if (items.length === 0) {
      toast.error("Isi setidaknya 1 size.");
      return;
    }
    
    for (const item of items) {
      if (Number(item.jumlah) > item.max) {
        toast.error(\`Size \${item.size} melebihi sisa yang ada di Standby Pool (\${item.max})\`);
        return;
      }
    }
    
    if (totalReq > Number(downstreamModal.total_request)) {
      toast.error(\`Total yang di-ACC (\${totalReq}) melebihi request (\${downstreamModal.total_request})\`);
      return;
    }

    setIsSubmittingDownstream(true);
    try {
      const res = await fetch("/api/tarik-barang/acc-downstream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: downstreamModal.id,
          transfer_id: downstreamModal.pemotongan.transfer_id,
          vendor_id: downstreamModal.vendor_id,
          sizeBreakdown: items,
        })
      });
      if (!res.ok) {
         const data = await res.json();
         throw new Error(data.error || "Gagal");
      }
      toast.success("Berhasil menugaskan ke vendor!");
      setDownstreamModal(null);
      fetchRequests(); // reload
    } catch(err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmittingDownstream(false);
    }
  };
`;
if (!code.includes('handleDownstreamSubmit')) {
    code = code.replace(submitHandlerTarget, submitHandlerInjection + submitHandlerTarget);
}

// 3. Update the "Proses" button onClick
const prosesTarget = `const targetQty = Number(r.total_request);`;
const prosesInjection = `
                                    if (r.pemotongan?.is_transfer) {
                                      setDownstreamModal(r);
                                      const breakdown = r.pemotongan.sizeBreakdown || [];
                                      setDownstreamForm(breakdown.map((s:any) => ({
                                        size: s.size,
                                        max: Number(s.sisa || s.jumlah || 0),
                                        jumlah: ""
                                      })));
                                      return;
                                    }
`;
if (!code.includes('if (r.pemotongan?.is_transfer) {')) {
    code = code.replace(prosesTarget, prosesInjection + prosesTarget);
}

// 4. Inject Modal JSX at the end before </div> (the wrapper)
const modalJSX = `
      {/* Downstream Modal */}
      {downstreamModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", padding: 24, borderRadius: 16, width: 450, maxWidth: "90%" }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 18 }}>ACC Pekerjaan \${downstreamModal.vendor_nama}</h3>
            <p style={{ margin: "0 0 16px", fontSize: 14, color: "#64748B" }}>
              Request: <strong>\${downstreamModal.total_request} pcs</strong><br/>
              Dari PO: <strong>\${downstreamModal.pemotongan?.nama_barang} (\${downstreamModal.pemotongan?.model})</strong><br/>
              Sisa di Standby Pool: <strong>\${downstreamModal.pemotongan?.sisa_total} pcs</strong>
            </p>
            <form onSubmit={handleDownstreamSubmit}>
              <div style={{ maxHeight: 300, overflowY: "auto", marginBottom: 16 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#F1F5F9", textAlign: "left", fontSize: 13 }}>
                      <th style={{ padding: 8 }}>Size</th>
                      <th style={{ padding: 8 }}>Tersedia</th>
                      <th style={{ padding: 8 }}>ACC (Pcs)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {downstreamForm.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid #E2E8F0" }}>
                        <td style={{ padding: 8, fontWeight: "bold" }}>{item.size}</td>
                        <td style={{ padding: 8 }}>{item.max}</td>
                        <td style={{ padding: 8 }}>
                          <input 
                            type="number" 
                            min="0"
                            max={item.max}
                            value={item.jumlah}
                            onChange={(e) => {
                              const val = e.target.value;
                              const newF = [...downstreamForm];
                              newF[idx].jumlah = val === "" ? "" : Number(val);
                              setDownstreamForm(newF);
                            }}
                            style={{ width: 80, padding: 6, borderRadius: 6, border: "1px solid #CBD5E1" }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button type="button" onClick={() => setDownstreamModal(null)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #CBD5E1", background: "white", cursor: "pointer" }}>Batal</button>
                <button type="submit" disabled={isSubmittingDownstream} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#3B82F6", color: "white", fontWeight: "bold", cursor: "pointer" }}>
                  {isSubmittingDownstream ? "Memproses..." : "Tugaskan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
`;

const closeWrapper = `    </div>
  );
}`;
if (!code.includes('Downstream Modal')) {
    code = code.replace(closeWrapper, modalJSX + '\n' + closeWrapper);
    fs.writeFileSync('src/app/(owner)/buat-spk/page.tsx', code, 'utf8');
    console.log("Successfully patched buat-spk/page.tsx");
} else {
    console.log("Already patched.");
}
