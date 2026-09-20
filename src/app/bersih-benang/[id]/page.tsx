// @ts-nocheck
"use client";
import React, { use, useEffect, useState, useCallback } from "react";
import { Scissors, X } from "lucide-react";
import { toast } from "sonner";

export default function PortalPage({ params }) {
  const { id } = use(params);
  const [transfers, setTransfers] = useState([]);
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(null);
  const [form, setForm] = useState([]);
  const [catatan, setCatatan] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fetchData = useCallback(async () => {
    try {
      const [resT, resV] = await Promise.all([
        fetch("/api/produksi-transfer?ke=benang&_t=" + Date.now()),
        fetch("/api/vendors/" + id + "?_t=" + Date.now())
      ]);
      const tData = await resT.json();
      const vData = await resV.json();
      setTransfers((Array.isArray(tData) ? tData : []).filter(t => String(t.vendor_id) === id));
      setVendor(vData);
    } catch (e) {} finally { setLoading(false); }
  }, [id]);
  useEffect(() => { fetchData(); const i = setInterval(fetchData, 3000); return () => clearInterval(i); }, [fetchData]);
  const aktif = transfers.filter(t => t.status === "Kirim");
  const openLapor = (t) => { setShowModal(t); setForm((t.sizeBreakdown||[]).map(s=>({size:s.size,jumlah:""}))); setCatatan(""); };
  const submitLapor = async (e) => {
    e.preventDefault(); if (!showModal) return;
    const items = form.filter(f => Number(f.jumlah) > 0);
    if (!items.length) { toast.error("Masukkan jumlah minimal 1 size"); return; }
    const total = items.reduce((s,x) => s+Number(x.jumlah),0);
    setSubmitting(true);
    try {
      const res = await fetch("/api/produksi-transfer", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({po_id:showModal.po_id,dari:"benang",ke:"gudang",vendor_id:id,jumlah_kirim:total,sizeBreakdown:items,catatan}) });
      if (!res.ok) throw new Error("Gagal kirim laporan");
      toast.success("Laporan selesai dikirim ke Gudang Produksi!");
      setShowModal(null); fetchData();
    } catch (ex) { toast.error(ex.message); } finally { setSubmitting(false); }
  };
  // Real-time sync: auto-refresh when another admin makes a change
  useEffect(() => {
    const handler = () => fetchData();
    window.addEventListener("konveksi-sync", handler);
    return () => window.removeEventListener("konveksi-sync", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <div style={{background:"#0F172A",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",color:"white"}}>Memuat...</div>;
  return (
    <div style={{position:"fixed",inset:0,overflowY:"auto",background:"#0F172A"}}>
      <div style={{background:"#1E293B",padding:"24px 28px",borderBottom:"1px solid #334155",display:"flex",alignItems:"center",gap:16}}>
        <div style={{background:"#F59E0B",width:48,height:48,borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <Scissors size={24} color="white" />
        </div>
        <div>
          <h1 style={{margin:0,color:"white",fontSize:20,fontWeight:800}}>Portal Bersih Benang &mdash; {vendor?.nama||"..."}</h1>
          <p style={{margin:0,color:"#64748B",fontSize:13}}>Lapor hasil ke Gudang Produksi</p>
        </div>
        <div style={{marginLeft:"auto",background:"#0F172A",borderRadius:12,padding:"10px 18px",textAlign:"center"}}>
          <div style={{fontSize:20,fontWeight:900,color:"#EF4444"}}>{aktif.length}</div>
          <div style={{fontSize:11,color:"#64748B"}}>Sedang Diproses</div>
        </div>
      </div>
      <div style={{padding:28}}>
        {aktif.length===0 ? (
          <div style={{background:"#1E293B",borderRadius:16,padding:40,textAlign:"center"}}>
            <div style={{color:"#64748B",fontWeight:700}}>Belum ada pakaian yang dikirim ke tahap Bersih Benang</div>
          </div>
        ) : aktif.map(t => (
          <div key={t.id} style={{background:"#1E293B",borderRadius:16,padding:20,marginBottom:12,border:"1px solid #334155"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16,flexWrap:"wrap"}}>
              <div>
                <div style={{fontSize:17,fontWeight:800,color:"white"}}>{t.noPo} &mdash; {t.model}</div>
                <div style={{fontSize:13,color:"#64748B",marginTop:4}}>Masuk: {new Date(t.tanggal_kirim).toLocaleDateString("id-ID")} &middot; <b style={{color:"#F59E0B"}}>{t.jumlah_kirim} pcs</b></div>
                <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}>
                  {(t.sizeBreakdown||[]).map((s,i)=><span key={i} style={{background:"#0F172A",color:"white",padding:"4px 10px",borderRadius:6,fontSize:12,fontWeight:700}}>{s.size}: {s.jumlah} pcs</span>)}
                </div>
              </div>
              <button onClick={()=>openLapor(t)} style={{background:"#F59E0B",color:"white",padding:"10px 18px",borderRadius:10,border:"none",fontWeight:800,cursor:"pointer",fontSize:13}}>Lapor Selesai</button>
            </div>
          </div>
        ))}
      </div>
      {showModal && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:20}}>
          <div style={{background:"#1E293B",borderRadius:20,width:"100%",maxWidth:480,border:"1px solid #334155"}}>
            <div style={{padding:"20px 24px",borderBottom:"1px solid #334155",display:"flex",justifyContent:"space-between",background:"#0F172A",borderRadius:"20px 20px 0 0"}}>
              <div><h3 style={{margin:0,color:"white",fontWeight:800}}>Lapor Selesai</h3><div style={{fontSize:13,color:"#64748B"}}>{showModal.noPo} &mdash; {showModal.model}</div></div>
              <button onClick={()=>setShowModal(null)} style={{background:"transparent",border:"none",color:"#64748B",cursor:"pointer"}}><X size={24}/></button>
            </div>
            <form onSubmit={submitLapor} style={{padding:24}}>
              <label style={{display:"block",color:"#94A3B8",fontSize:13,fontWeight:700,marginBottom:12}}>Jumlah Selesai per Size:</label>
              <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
                {form.map((f,idx)=>(
                  <div key={f.size} style={{display:"flex",alignItems:"center",gap:12,background:"#0F172A",padding:12,borderRadius:12}}>
                    <div style={{background:"#1E293B",color:"white",width:40,height:40,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800}}>{f.size}</div>
                    <input type="number" min="0" placeholder="0" value={f.jumlah} onChange={e=>{const nf=[...form];nf[idx].jumlah=Number(e.target.value);setForm(nf);}} style={{flex:1,background:"transparent",border:"none",color:"white",fontSize:18,fontWeight:700,outline:"none"}} />
                    <span style={{fontSize:12,color:"#64748B"}}>/ {showModal.sizeBreakdown?.find(s=>s.size===f.size)?.jumlah||0} pcs</span>
                  </div>
                ))}
              </div>
              <textarea placeholder="Catatan (opsional)" rows={2} value={catatan} onChange={e=>setCatatan(e.target.value)} style={{width:"100%",background:"#0F172A",border:"1px solid #334155",color:"white",borderRadius:10,padding:"10px 14px",outline:"none",fontSize:14,marginBottom:20,resize:"none"}} />
              <button type="submit" disabled={submitting} style={{width:"100%",background:"#F59E0B",color:"white",padding:15,borderRadius:12,border:"none",fontWeight:800,fontSize:15,cursor:"pointer"}}>{submitting?"Mengirim...":"Kirim Laporan ke Gudang"}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
