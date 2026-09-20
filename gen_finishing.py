import os
os.makedirs('src/app/finishing/[id]', exist_ok=True)
content = '''\"use client\";
import React, { use, useEffect, useState, useCallback } from \"react\";
import { CheckCircle2, X, Star } from \"lucide-react\";
import { toast } from \"sonner\";

export default function FinishingPortalPage({ params }) {
  const { id } = use(params);
  const [transfers, setTransfers] = useState([]);
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(null);
  const [form, setForm] = useState([]);
  const [catatan, setCatatan] = useState(\"\");
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [resT, resV] = await Promise.all([
        fetch(\"/api/produksi-transfer?ke=finishing&_t=\" + Date.now()),
        fetch(\"/api/vendors/\" + id + \"?_t=\" + Date.now())
      ]);
      const tData = await resT.json();
      const vData = await resV.json();
      setTransfers((Array.isArray(tData) ? tData : []).filter(t => String(t.vendor_id) === id));
      setVendor(vData);
    } catch (e) {} finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 3000); return () => clearInterval(i); }, [fetchData]);
  const aktif = transfers.filter(t => t.status === \"Kirim\");

  const openQC = (t) => {
    setShowModal(t);
    setForm((t.sizeBreakdown||[]).map(s => ({ size: s.size, jumlah: \"\", max: s.jumlah })));
    setCatatan(\"\");
  };

  const submitQC = async (e) => {
    e.preventDefault(); if (!showModal) return;
    const items = form.filter(f => Number(f.jumlah) > 0);
    if (!items.length) { toast.error(\"Masukkan jumlah yang lulus QC\"); return; }
    setSubmitting(true);
    try {
      const res = await fetch(\"/api/finishing-qc\", {
        method: \"POST\",
        headers: {\"Content-Type\":\"application/json\"},
        body: JSON.stringify({ po_id: showModal.po_id, vendor_id: id, sizeBreakdown: items.map(i=>({size:i.size,jumlah:Number(i.jumlah)})), catatan })
      });
      if (!res.ok) throw new Error(\"Gagal submit QC\");
      const data = await res.json();
      toast.success(data.totalUpdated + \" barcode berhasil diaktifkan untuk dicetak!\");
      setShowModal(null); fetchData();
    } catch (ex) { toast.error(ex.message); } finally { setSubmitting(false); }
  };

  if (loading) return <div style={{background:\"#0F172A\",minHeight:\"100vh\",display:\"flex\",alignItems:\"center\",justifyContent:\"center\",color:\"white\"}}>Memuat...</div>;

  return (
    <div style={{minHeight:\"100vh\",background:\"#0F172A\"}}>
      <div style={{background:\"#1E293B\",padding:\"24px 28px\",borderBottom:\"1px solid #334155\",display:\"flex\",alignItems:\"center\",gap:16}}>
        <div style={{background:\"#10B981\",width:48,height:48,borderRadius:14,display:\"flex\",alignItems:\"center\",justifyContent:\"center\"}}>
          <Star size={24} color=\"white\" />
        </div>
        <div>
          <h1 style={{margin:0,color:\"white\",fontSize:20,fontWeight:800}}>Portal QC / Finishing &mdash; {vendor?.nama||\"...\"}</h1>
          <p style={{margin:0,color:\"#64748B\",fontSize:13}}>Input barang yang sudah lulus QC &rarr; barcode siap cetak</p>
        </div>
        <div style={{marginLeft:\"auto\",background:\"#0F172A\",borderRadius:12,padding:\"10px 18px\",textAlign:\"center\"}}>
          <div style={{fontSize:20,fontWeight:900,color:\"#EF4444\"}}>{aktif.length}</div>
          <div style={{fontSize:11,color:\"#64748B\"}}>Menunggu QC</div>
        </div>
      </div>

      <div style={{padding:28}}>
        <div style={{background:\"#064E3B\",border:\"1px solid #10B981\",borderRadius:14,padding:\"14px 20px\",marginBottom:24,display:\"flex\",gap:12,alignItems:\"center\"}}>
          <CheckCircle2 size={20} color=\"#10B981\" />
          <div style={{color:\"#6EE7B7\",fontSize:13,fontWeight:600}}>
            Setelah Anda input jumlah yang lulus QC, barcode label untuk size tersebut akan berstatus HIJAU (siap cetak) di dashboard Admin.
          </div>
        </div>

        {aktif.length===0 ? (
          <div style={{background:\"#1E293B\",borderRadius:16,padding:40,textAlign:\"center\"}}>
            <div style={{color:\"#64748B\",fontWeight:700}}>Belum ada pakaian yang dikirim untuk QC/Finishing</div>
          </div>
        ) : aktif.map(t => (
          <div key={t.id} style={{background:\"#1E293B\",borderRadius:16,padding:20,marginBottom:12,border:\"2px solid #065F46\"}}>
            <div style={{display:\"flex\",justifyContent:\"space-between\",alignItems:\"flex-start\",gap:16,flexWrap:\"wrap\"}}>
              <div>
                <div style={{fontSize:17,fontWeight:800,color:\"white\"}}>{t.noPo} &mdash; {t.model}</div>
                <div style={{fontSize:13,color:\"#64748B\",marginTop:4}}>Masuk Finishing: {new Date(t.tanggal_kirim).toLocaleDateString(\"id-ID\")} &middot; <b style={{color:\"#F59E0B\"}}>{t.jumlah_kirim} pcs</b></div>
                <div style={{display:\"flex\",gap:8,marginTop:10,flexWrap:\"wrap\"}}>
                  {(t.sizeBreakdown||[]).map((s,i) => <span key={i} style={{background:\"#0F172A\",color:\"white\",padding:\"4px 10px\",borderRadius:6,fontSize:12,fontWeight:700}}>{s.size}: {s.jumlah} pcs</span>)}
                </div>
              </div>
              <button onClick={()=>openQC(t)} style={{background:\"#10B981\",color:\"white\",padding:\"10px 18px\",borderRadius:10,border:\"none\",fontWeight:800,cursor:\"pointer\",fontSize:13,display:\"flex\",alignItems:\"center\",gap:8}}>
                <CheckCircle2 size={16}/> Input Hasil QC
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div style={{position:\"fixed\",inset:0,background:\"rgba(0,0,0,0.85)\",display:\"flex\",alignItems:\"center\",justifyContent:\"center\",zIndex:100,padding:20}}>
          <div style={{background:\"#1E293B\",borderRadius:20,width:\"100%\",maxWidth:500,border:\"1px solid #334155\",maxHeight:\"90vh\",overflowY:\"auto\"}}>
            <div style={{padding:\"20px 24px\",borderBottom:\"1px solid #334155\",display:\"flex\",justifyContent:\"space-between\",background:\"#0F172A\",borderRadius:\"20px 20px 0 0\"}}>
              <div>
                <h3 style={{margin:0,color:\"white\",fontWeight:800}}>Input Hasil QC Finishing</h3>
                <div style={{fontSize:13,color:\"#64748B\"}}>{showModal.noPo} &mdash; {showModal.model}</div>
              </div>
              <button onClick={()=>setShowModal(null)} style={{background:\"transparent\",border:\"none\",color:\"#64748B\",cursor:\"pointer\"}}><X size={24}/></button>
            </div>
            <form onSubmit={submitQC} style={{padding:24}}>
              <div style={{background:\"#052E16\",border:\"1px solid #10B981\",borderRadius:12,padding:\"12px 16px\",marginBottom:20,fontSize:13,color:\"#6EE7B7\"}}>
                Masukkan jumlah pakaian yang <b>LULUS QC</b> per size. Barcode untuk jumlah ini akan otomatis diaktifkan.
              </div>
              <label style={{display:\"block\",color:\"#94A3B8\",fontSize:13,fontWeight:700,marginBottom:12}}>Jumlah Lulus QC per Size:</label>
              <div style={{display:\"flex\",flexDirection:\"column\",gap:10,marginBottom:20}}>
                {form.map((f,idx)=>(
                  <div key={f.size} style={{display:\"flex\",alignItems:\"center\",gap:12,background:\"#0F172A\",padding:12,borderRadius:12}}>
                    <div style={{background:\"#1E293B\",color:\"white\",width:44,height:44,borderRadius:8,display:\"flex\",alignItems:\"center\",justifyContent:\"center\",fontWeight:800,fontSize:16}}>{f.size}</div>
                    <div style={{flex:1}}>
                      <input type=\"number\" min=\"0\" max={f.max} placeholder=\"0\" value={f.jumlah} onChange={e=>{const nf=[...form];nf[idx].jumlah=Number(e.target.value);setForm(nf);}} style={{width:\"100%\",background:\"transparent\",border:\"none\",color:\"white\",fontSize:20,fontWeight:700,outline:\"none\"}} />
                    </div>
                    <div style={{textAlign:\"right\"}}>
                      <div style={{fontSize:12,color:\"#64748B\"}}>Diterima: {f.max} pcs</div>
                      {Number(f.jumlah)>0 && <div style={{fontSize:12,color:\"#EF4444\"}}>Reject: {f.max-Number(f.jumlah)} pcs</div>}
                    </div>
                  </div>
                ))}
              </div>
              <textarea placeholder=\"Catatan QC (opsional)...\" rows={2} value={catatan} onChange={e=>setCatatan(e.target.value)} style={{width:\"100%\",background:\"#0F172A\",border:\"1px solid #334155\",color:\"white\",borderRadius:10,padding:\"10px 14px\",outline:\"none\",fontSize:14,marginBottom:20,resize:\"none\"}} />
              <div style={{background:\"#1A2E1A\",borderRadius:12,padding:\"10px 16px\",marginBottom:20,fontSize:13,color:\"#94A3B8\"}}>
                Total Lulus QC: <b style={{color:\"#10B981\",fontSize:16}}>{form.reduce((s,f)=>s+Number(f.jumlah||0),0)} pcs</b>
              </div>
              <button type=\"submit\" disabled={submitting} style={{width:\"100%\",background:\"#10B981\",color:\"white\",padding:16,borderRadius:12,border:\"none\",fontWeight:800,fontSize:15,cursor:\"pointer\"}}>
                {submitting?\"Memproses...\":\"Simpan Hasil QC & Aktifkan Barcode\"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
'''
with open('src/app/finishing/[id]/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('finishing portal done')
