const fs = require('fs');
let code = fs.readFileSync('src/app/(owner)/buat-spk/page.tsx', 'utf8');

const modalJSX = `
      {/* Downstream Modal */}
      {downstreamModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", padding: 24, borderRadius: 16, width: 450, maxWidth: "90%" }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 18 }}>ACC Pekerjaan {downstreamModal.vendor_nama}</h3>
            <p style={{ margin: "0 0 16px", fontSize: 14, color: "#64748B" }}>
              Request: <strong>{downstreamModal.total_request} pcs</strong><br/>
              Dari PO: <strong>{downstreamModal.pemotongan?.nama_barang} ({downstreamModal.pemotongan?.model})</strong><br/>
              Sisa di Standby Pool: <strong>{downstreamModal.pemotongan?.sisa_total} pcs</strong>
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

if (!code.includes('Downstream Modal')) {
    const lines = code.split('\n');
    let inserted = false;
    for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].includes('  );')) {
            lines.splice(i, 0, modalJSX);
            inserted = true;
            break;
        }
    }
    if (inserted) {
        fs.writeFileSync('src/app/(owner)/buat-spk/page.tsx', lines.join('\n'), 'utf8');
        console.log("Modal injected!");
    }
} else {
    console.log("Already has modal.");
}
