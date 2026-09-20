const fs = require('fs');
let content = fs.readFileSync('src/app/(owner)/buat-spk/page.tsx', 'utf8');

// 1. Add states
const stateInjection = `  const [poPipelines, setPoPipelines] = useState<any[]>([]);
  const [distribusiModal, setDistribusiModal] = useState<any>(null);
`;
content = content.replace('const [loading, setLoading] = useState(true);', stateInjection + '  const [loading, setLoading] = useState(true);');

// 2. Add po-pipeline fetch
const fetchInjection = `        const resPip = await fetch("/api/po-pipeline?_t=" + Date.now());
        const dataPip = await resPip.json();
        setPoPipelines(Array.isArray(dataPip) ? dataPip : []);
`;
content = content.replace('setStages(Array.isArray(dataStages) ? dataStages : []);', 'setStages(Array.isArray(dataStages) ? dataStages : []);\n' + fetchInjection);

// 3. Replace handleTerimaLaporan
const oldHandleTerima = `  const handleTerimaLaporan = async (id: string) => {
    try {
      const res = await fetch("/api/cmt-progres", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "terima" })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Laporan berhasil diterima & masuk ke stok pengambilan!");
      fetchAll();
    } catch (err: any) {
      alert(err.message);
    }
  };`;

const newHandleTerima = `  const submitTerimaLaporan = async (id: string, distribusi: any[] = []) => {
    try {
      const res = await fetch("/api/cmt-progres", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "terima", distribusi })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal");
      toast.success("Laporan berhasil diterima!");
      setDistribusiModal(null);
      fetchAll();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleTerimaLaporan = (id: string) => {
    const lp = cmtProgres.find((p:any) => p.id === id);
    if (!lp) return;
    
    const pIdx = poPipelines.findIndex((p: any) => p.po_id === lp.po_id);
    let nextStage = null;
    if (pIdx !== -1) {
       const stages = poPipelines[pIdx].stages;
       const currentIdx = stages.findIndex((s:any) => s.slug === "jahit" || s.slug === "jahit_kain");
       if (currentIdx !== -1 && currentIdx < stages.length - 1) {
          for (let i = currentIdx + 1; i < stages.length; i++) {
             if (stages[i].aktif) { nextStage = stages[i]; break; }
          }
       }
    }
    
    if (!nextStage) {
       submitTerimaLaporan(id, []);
       return;
    }
    
    setDistribusiModal({
       laporanId: lp.id,
       po_id: lp.po_id,
       items: lp.items,
       nextStage,
       totalAvailable: lp.totalJumlah,
       form: [
          { id: Date.now(), vendor_id: "", target_selesai: "", sizeBreakdown: JSON.parse(JSON.stringify(lp.items)).map((i:any)=>({...i, jumlah:0})) }
       ]
    });
  };`;

content = content.replace(oldHandleTerima, newHandleTerima);

// 4. Inject Modal JSX at the end before last closing tags
const modalJSX = `
      {distribusiModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.6)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding: 20 }}>
          <div style={{ background:"white", width: "100%", maxWidth: 700, maxHeight:"90vh", borderRadius: 20, display:"flex", flexDirection:"column", overflow:"hidden", boxShadow:"0 20px 60px rgba(0,0,0,0.2)" }}>
            
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center", background:"#F8FAFC" }}>
              <div>
                <h2 style={{ margin:0, fontSize:18, fontWeight:800, color:"#0F172A" }}>Distribusi ke: {distribusiModal.nextStage.nama}</h2>
                <p style={{ margin:"4px 0 0", fontSize:13, color:"#64748B" }}>Pecah alokasi {distribusiModal.totalAvailable} pcs dari Jahit</p>
              </div>
              <button onClick={() => setDistribusiModal(null)} style={{ background:"none", border:"none", cursor:"pointer", color:"#94A3B8" }}><X size={20}/></button>
            </div>

            <div style={{ flex:1, overflowY:"auto", padding:24 }}>
              <div style={{ display:"flex", gap:12, marginBottom: 24, padding: "12px 16px", background:"#EFF6FF", borderRadius: 12, border:"1px solid #BFDBFE" }}>
                <span style={{ fontSize:14, color:"#1E3A8A", fontWeight:700 }}>Total Tersedia:</span>
                {distribusiModal.items.map((it:any) => (
                  <span key={it.size} style={{ fontSize:13, color:"#2563EB", fontWeight:600 }}>{it.size}: {it.jumlah}</span>
                ))}
              </div>

              {distribusiModal.form.map((f:any, index:number) => (
                <div key={f.id} style={{ background:"white", border:"1.5px solid #E2E8F0", borderRadius: 16, padding: 20, marginBottom: 16, position: "relative" }}>
                  <div style={{ position:"absolute", top: -10, left: 16, background:"white", padding:"0 8px", fontSize:12, fontWeight:800, color:"#64748B" }}>
                    Distribusi {index + 1}
                  </div>
                  {distribusiModal.form.length > 1 && (
                    <button onClick={() => {
                      const newForm = [...distribusiModal.form];
                      newForm.splice(index, 1);
                      setDistribusiModal({...distribusiModal, form: newForm});
                    }} style={{ position:"absolute", top: 12, right: 12, background:"#FEF2F2", color:"#DC2626", border:"none", borderRadius: 8, padding: 6, cursor:"pointer" }}><X size={14}/></button>
                  )}

                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap: 16, marginBottom: 16, marginTop: 4 }}>
                    <div>
                      <label style={{ fontSize:11, fontWeight:700, color:"#64748B", marginBottom: 6, display:"block", textTransform:"uppercase" }}>Vendor {distribusiModal.nextStage.nama}</label>
                      <select 
                        value={f.vendor_id} 
                        onChange={(e) => { const newF = [...distribusiModal.form]; newF[index].vendor_id = e.target.value; setDistribusiModal({...distribusiModal, form: newF}); }}
                        style={{ width:"100%", padding:"10px 12px", borderRadius: 10, border:"1.5px solid #E2E8F0", background:"#F8FAFC", fontSize:14, outline:"none", color: f.vendor_id ? "#0F172A" : "#94A3B8" }}
                      >
                        <option value="">-- Pilih Vendor --</option>
                        {vendors.filter((v:any) => !distribusiModal.nextStage.vendor_tipe || v.tipe === distribusiModal.nextStage.vendor_tipe || v.tipe === "lainnya").map((v:any) => (
                          <option key={v.id} value={v.id}>{v.nama}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize:11, fontWeight:700, color:"#64748B", marginBottom: 6, display:"block", textTransform:"uppercase" }}>Target Selesai (Dateline)</label>
                      <input 
                        type="date" 
                        value={f.target_selesai} 
                        onChange={(e) => { const newF = [...distribusiModal.form]; newF[index].target_selesai = e.target.value; setDistribusiModal({...distribusiModal, form: newF}); }}
                        style={{ width:"100%", padding:"10px 12px", borderRadius: 10, border:"1.5px solid #E2E8F0", background:"#F8FAFC", fontSize:14, outline:"none", color:"#0F172A", boxSizing:"border-box" }}
                      />
                    </div>
                  </div>

                  <label style={{ fontSize:11, fontWeight:700, color:"#64748B", marginBottom: 8, display:"block", textTransform:"uppercase" }}>Alokasi Ukuran</label>
                  <div style={{ display:"flex", flexWrap:"wrap", gap: 10 }}>
                    {f.sizeBreakdown.map((sb:any, sIdx:number) => {
                      const limit = distribusiModal.items.find((i:any) => i.size === sb.size)?.jumlah || 0;
                      return (
                        <div key={sb.size} style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius: 10, padding: "8px 12px", display:"flex", alignItems:"center", gap: 8 }}>
                          <span style={{ fontSize:13, fontWeight:800, color:"#0F172A", width: 24 }}>{sb.size}</span>
                          <input 
                            type="number" 
                            min="0"
                            max={limit}
                            value={sb.jumlah === 0 ? "" : sb.jumlah}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              const newF = [...distribusiModal.form];
                              newF[index].sizeBreakdown[sIdx].jumlah = val > limit ? limit : val;
                              setDistribusiModal({...distribusiModal, form: newF});
                            }}
                            style={{ width: 50, padding: "6px 8px", borderRadius: 6, border:"1px solid #CBD5E1", fontSize:14, outline:"none" }}
                            placeholder="0"
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}

              <button 
                onClick={() => setDistribusiModal({...distribusiModal, form: [...distribusiModal.form, { id: Date.now(), vendor_id: "", target_selesai: "", sizeBreakdown: JSON.parse(JSON.stringify(distribusiModal.items)).map((i:any)=>({...i, jumlah:0})) }]})}
                style={{ width:"100%", padding: "14px", borderRadius: 14, border:"1.5px dashed #CBD5E1", background:"#F8FAFC", color:"#64748B", fontWeight:700, fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap: 8 }}
              >
                <Plus size={16}/> Tambah Vendor Tujuan
              </button>
            </div>

            <div style={{ padding: "16px 24px", borderTop: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center", background:"white" }}>
              <button onClick={() => setDistribusiModal(null)} style={{ padding: "12px 24px", borderRadius: 12, border:"1.5px solid #E2E8F0", background:"white", color:"#64748B", fontWeight:700, cursor:"pointer" }}>Batal</button>
              
              <button 
                onClick={() => {
                  // Validasi
                  let err = "";
                  const dis = [];
                  for(let i=0; i<distribusiModal.form.length; i++) {
                    const f = distribusiModal.form[i];
                    const tot = f.sizeBreakdown.reduce((s:any, x:any) => s + x.jumlah, 0);
                    if (tot > 0) {
                      if (!f.vendor_id && distribusiModal.nextStage.butuh_vendor) err = "Vendor tujuan ke-" + (i+1) + " harus dipilih";
                      if (!f.target_selesai) err = "Target selesai tujuan ke-" + (i+1) + " harus diisi";
                      dis.push({
                        ke: distribusiModal.nextStage.slug,
                        vendor_id: f.vendor_id || null,
                        jumlah: tot,
                        sizeBreakdown: f.sizeBreakdown.filter((x:any)=>x.jumlah>0),
                        target_selesai: f.target_selesai
                      });
                    }
                  }
                  if (err) return toast.error(err);
                  if (dis.length === 0) return toast.error("Minimal bagikan 1 barang");
                  
                  // Validasi total tidak melebihi stok
                  for (let it of distribusiModal.items) {
                    let assigned = 0;
                    dis.forEach(d => {
                      assigned += (d.sizeBreakdown.find((x:any) => x.size === it.size)?.jumlah || 0);
                    });
                    if (assigned > it.jumlah) return toast.error("Total size " + it.size + " yang dibagikan melebihi " + it.jumlah);
                  }

                  submitTerimaLaporan(distribusiModal.laporanId, dis);
                }}
                style={{ padding: "12px 24px", borderRadius: 12, border:"none", background:"linear-gradient(135deg, #2563EB, #1D4ED8)", color:"white", fontWeight:700, cursor:"pointer", boxShadow:"0 4px 12px rgba(37,99,235,0.3)" }}
              >
                Konfirmasi & Kirim
              </button>
            </div>
          </div>
        </div>
      )}
`;

content = content.replace('    </div>\n  );\n}\n', modalJSX + '\n    </div>\n  );\n}\n');
fs.writeFileSync('src/app/(owner)/buat-spk/page.tsx', content, 'utf8');