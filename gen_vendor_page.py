import os

code = """
"use client";
import React, { useEffect, useState } from "react";
import { Plus, X, Pencil, Check, Factory, Settings2, Globe, Banknote } from "lucide-react";
import { toast } from "sonner";

const emptyVendor = { nama: "", tipe: "", jenis_default: "", kontak: "", wajib_hitung_ulang: false, hargaPerPcs: 0 };
const emptyType = { nama: "", slug: "", emoji: "package", perlu_portal: false, portal_path: "", perlu_gaji: false };

export default function AturVendorPage() {
  const [vendors, setVendors] = useState([]);
  const [vendorTypes, setVendorTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showVendorForm, setShowVendorForm] = useState(false);
  const [editVendorId, setEditVendorId] = useState(null);
  const [vendorForm, setVendorForm] = useState({ ...emptyVendor });
  const [savingVendor, setSavingVendor] = useState(false);
  const [showTipeForm, setShowTipeForm] = useState(false);
  const [editTipeId, setEditTipeId] = useState(null);
  const [tipeForm, setTipeForm] = useState({ ...emptyType });
  const [savingTipe, setSavingTipe] = useState(false);
  const [activeTab, setActiveTab] = useState("vendor");

  const load = async () => {
    setLoading(true);
    try {
      const [rv, rt] = await Promise.all([
        fetch("/api/vendors?_t=" + Date.now()).then(r => r.json()),
        fetch("/api/vendor-types?_t=" + Date.now()).then(r => r.json()),
      ]);
      setVendors(Array.isArray(rv) ? rv : []);
      setVendorTypes(Array.isArray(rt) ? rt : []);
    } catch { toast.error("Gagal memuat data"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const getTipeInfo = (slug) => vendorTypes.find(t => t.slug === slug);

  const openAddVendor = () => { setEditVendorId(null); setVendorForm({ ...emptyVendor, tipe: vendorTypes[0]?.slug || "" }); setShowVendorForm(true); };
  const openEditVendor = (v) => { setEditVendorId(v.id); setVendorForm({ nama: v.nama, tipe: v.tipe||"", jenis_default: v.jenis_default||"", kontak: v.kontak||"", wajib_hitung_ulang: !!v.wajib_hitung_ulang, hargaPerPcs: v.hargaPerPcs||0 }); setShowVendorForm(true); };
  const handleSaveVendor = async (e) => {
    e.preventDefault(); if (!vendorForm.nama) return;
    setSavingVendor(true);
    try {
      const method = editVendorId ? "PATCH" : "POST";
      const body = editVendorId ? { id: editVendorId, ...vendorForm } : vendorForm;
      const res = await fetch("/api/vendors", { method, headers: {"Content-Type":"application/json"}, body: JSON.stringify(body) });
      if (!res.ok) throw new Error("Gagal menyimpan");
      toast.success(editVendorId ? "Vendor diperbarui!" : "Vendor baru ditambahkan!");
      setShowVendorForm(false); load();
    } catch (err) { toast.error(err.message); }
    finally { setSavingVendor(false); }
  };
  const handleToggleAktif = async (v) => {
    await fetch("/api/vendors", { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ id:v.id, aktif:!v.aktif }) });
    load();
  };

  const openAddTipe = () => { setEditTipeId(null); setTipeForm({ ...emptyType }); setShowTipeForm(true); };
  const openEditTipe = (t) => { setEditTipeId(t.id); setTipeForm({ nama:t.nama, slug:t.slug, emoji:t.emoji, perlu_portal:!!t.perlu_portal, portal_path:t.portal_path||"", perlu_gaji:!!t.perlu_gaji }); setShowTipeForm(true); };
  const handleSaveTipe = async (e) => {
    e.preventDefault(); if (!tipeForm.nama || !tipeForm.slug) return;
    setSavingTipe(true);
    try {
      const method = editTipeId ? "PATCH" : "POST";
      const body = editTipeId ? { id: editTipeId, ...tipeForm } : tipeForm;
      const res = await fetch("/api/vendor-types", { method, headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");
      toast.success(editTipeId ? "Tipe diperbarui!" : "Tipe baru ditambahkan!");
      setShowTipeForm(false); load();
    } catch (err) { toast.error(err.message); }
    finally { setSavingTipe(false); }
  };
  const handleDeleteTipe = async (id) => {
    if (!confirm("Hapus tipe vendor ini?")) return;
    const res = await fetch("/api/vendor-types?id=" + id, { method: "DELETE" });
    if (res.ok) { toast.success("Tipe dihapus"); load(); }
    else toast.error("Gagal menghapus");
  };

  const aktif = vendors.filter(v => v.aktif);
  const nonaktif = vendors.filter(v => !v.aktif);
  const groupedByTipe = aktif.reduce((acc, v) => { const k = v.tipe || "lainnya"; if (!acc[k]) acc[k]=[]; acc[k].push(v); return acc; }, {});
  const portalLink = (ti, id) => { if (!ti?.perlu_portal || !ti?.portal_path) return null; if (ti.slug==="cmt") return "/cmt/"+id; return ti.portal_path+"/"+id; };

  const Toggle = ({ value, onChange, colorOn = "#2563EB" }) => (
    <button type="button" onClick={onChange} style={{ width:44, height:24, borderRadius:12, border:"none", background: value ? colorOn : "#CBD5E1", cursor:"pointer", position:"relative", transition:"background 0.2s", flexShrink:0 }}>
      <div style={{ position:"absolute", top:2, left: value ? 22 : 2, width:20, height:20, borderRadius:"50%", background:"white", transition:"left 0.2s" }} />
    </button>
  );

  return (
    <>
      <div style={{ display:"flex", flexDirection:"column", height:"100%", background:"var(--bg-app)", overflow:"hidden" }}>
        <div style={{ padding:"20px 32px", background:"white", borderBottom:"1px solid #E2E8F0" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <h1 style={{ fontSize:24, fontWeight:900, color:"#0F172A", margin:0 }}>Atur Vendor Produksi</h1>
              <p style={{ fontSize:14, color:"#64748B", margin:"4px 0 0 0" }}>Manajemen direktori vendor dan kategori tipe produksi</p>
            </div>
            <div style={{ display:"flex", gap:12 }}>
              <button onClick={() => { setActiveTab("tipe"); openAddTipe(); }} style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 18px", borderRadius:12, border:"1.5px solid #6366F1", background:"white", color:"#6366F1", fontWeight:700, cursor:"pointer" }}>
                <Settings2 size={16} /> Tambah Tipe Vendor
              </button>
              <button onClick={openAddVendor} style={{ background:"linear-gradient(135deg,#2563EB,#1D4ED8)", border:"none", boxShadow:"0 4px 10px rgba(37,99,235,0.2)", display:"flex", alignItems:"center", gap:8, padding:"10px 18px", borderRadius:12, fontWeight:700, color:"white", cursor:"pointer" }}>
                <Plus size={16} /> Tambah Vendor
              </button>
            </div>
          </div>
          <div style={{ display:"flex", gap:4, marginTop:20 }}>
            {["vendor","tipe"].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding:"10px 20px", border:"none", background:"transparent", cursor:"pointer", fontWeight:700, fontSize:14, borderBottom: activeTab===tab ? "3px solid #2563EB" : "3px solid transparent", color: activeTab===tab ? "#2563EB" : "#64748B" }}>
                {tab==="vendor" ? Daftar Vendor () : Tipe Vendor ()}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:"28px 32px" }}>
          {activeTab==="vendor" && (
            <div>
              {loading ? <div style={{textAlign:"center",padding:40,color:"#64748B"}}>Memuat...</div> : aktif.length===0 ? (
                <div style={{background:"white",borderRadius:20,padding:60,textAlign:"center",border:"1px solid #E2E8F0"}}>
                  <div style={{fontSize:48,marginBottom:16}}>🏭</div>
                  <div style={{fontSize:18,fontWeight:800,color:"#0F172A"}}>Belum ada vendor aktif</div>
                </div>
              ) : (
                <div style={{display:"flex",flexDirection:"column",gap:40}}>
                  {Object.entries(groupedByTipe).map(([slug, vlist]) => {
                    const ti = getTipeInfo(slug);
                    return (
                      <div key={slug}>
                        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
                          <div style={{fontSize:22}}>{ti?.emoji || "📦"}</div>
                          <h3 style={{fontSize:18,fontWeight:800,color:"#475569",margin:0}}>Vendor {ti?.nama || slug}</h3>
                          <span style={{background:"#F1F5F9",color:"#64748B",padding:"4px 12px",borderRadius:20,fontSize:12,fontWeight:800}}>{vlist.length}</span>
                          {ti?.perlu_portal && <span style={{background:"#EFF6FF",color:"#2563EB",padding:"4px 10px",borderRadius:6,fontSize:11,fontWeight:700}}>🌐 Ada Portal</span>}
                          {ti?.perlu_gaji && <span style={{background:"#F0FDF4",color:"#16A34A",padding:"4px 10px",borderRadius:6,fontSize:11,fontWeight:700}}>💰 Pencatatan Gaji</span>}
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:20}}>
                          {vlist.map(v => {
                            const pLink = portalLink(ti, v.id);
                            return (
                              <div key={v.id} style={{background:"white",borderRadius:14,border:"1px solid #E2E8F0",padding:22}}>
                                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                                  <div>
                                    <div style={{fontWeight:800,fontSize:17,color:"#0F172A",marginBottom:4}}>{v.nama}</div>
                                    <div style={{fontSize:11,color:"#94A3B8",fontFamily:"monospace"}}>ID: {v.kodeVendor}</div>
                                  </div>
                                  <div style={{display:"flex",gap:8}}>
                                    <button onClick={() => openEditVendor(v)} style={{width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",background:"white",border:"1px solid #E2E8F0",borderRadius:8,cursor:"pointer"}}><Pencil size={14}/></button>
                                    <button onClick={() => handleToggleAktif(v)} style={{width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",background:"#FEF2F2",border:"1px solid #FECACA",color:"#EF4444",borderRadius:8,cursor:"pointer"}}><X size={14}/></button>
                                  </div>
                                </div>
                                <div style={{borderTop:"1px solid #F1F5F9",paddingTop:14}}>
                                  <div style={{fontSize:10,fontWeight:700,color:"#94A3B8",letterSpacing:"0.5px",textTransform:"uppercase",marginBottom:8}}>Info & Pengaturan</div>
                                  <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:14}}>
                                    {v.jenis_default && <span style={{background:"#F1F5F9",color:"#475569",padding:"3px 10px",borderRadius:5,fontSize:12,fontWeight:600}}>{v.jenis_default}</span>}
                                    <span style={{background:v.wajib_hitung_ulang?"#FEF2F2":"#F0FDF4",color:v.wajib_hitung_ulang?"#DC2626":"#16A34A",padding:"3px 10px",borderRadius:5,fontSize:12,fontWeight:600}}>{v.wajib_hitung_ulang?"Wajib Hitung":"Cepat (Bypass)"}</span>
                                    {ti?.perlu_gaji && v.hargaPerPcs>0 && <span style={{background:"#EFF6FF",color:"#1D4ED8",padding:"3px 10px",borderRadius:5,fontSize:12,fontWeight:700}}>Rp {v.hargaPerPcs.toLocaleString("id-ID")}/pcs</span>}
                                  </div>
                                  <div style={{display:"flex",gap:10}}>
                                    {v.kontak ? (
                                      <a href={"https://wa.me/62"+v.kontak.replace(/^0/,"")} target="_blank" rel="noreferrer" style={{flex:1,padding:"8px",background:"white",border:"1px solid #10B981",color:"#10B981",textDecoration:"none",fontSize:13,fontWeight:700,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>Chat WA</a>
                                    ) : (
                                      <div style={{flex:1,padding:"8px",background:"#F8FAFC",color:"#94A3B8",fontSize:12,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center"}}>Tanpa No HP</div>
                                    )}
                                    {pLink && <a href={pLink} target="_blank" rel="noreferrer" style={{padding:"8px 14px",background:"white",color:"#2563EB",border:"1px solid #2563EB",textDecoration:"none",fontSize:13,fontWeight:700,borderRadius:8,display:"flex",alignItems:"center",gap:6}}>Portal</a>}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {nonaktif.length > 0 && (
                <div style={{marginTop:40}}>
                  <h2 style={{fontSize:18,fontWeight:800,color:"#64748B",marginBottom:16}}>Vendor Nonaktif ({nonaktif.length})</h2>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
                    {nonaktif.map(v => (
                      <div key={v.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 18px",background:"white",border:"1px solid #E2E8F0",borderRadius:10,opacity:0.65}}>
                        <div style={{fontWeight:700,color:"#334155"}}>{v.nama}</div>
                        <button onClick={() => handleToggleAktif(v)} style={{background:"white",border:"1px solid #E2E8F0",color:"#475569",padding:"7px 14px",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}><Check size={14}/> Aktifkan</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab==="tipe" && (
            <div>
              <div style={{background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:12,padding:"14px 20px",marginBottom:24,fontSize:13,color:"#1E40AF",fontWeight:600}}>
                Tipe Vendor menentukan kategori, apakah memiliki portal akses sendiri, dan apakah perlu pencatatan gaji/biaya.
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:20}}>
                {vendorTypes.map(t => (
                  <div key={t.id} style={{background:"white",borderRadius:14,border:"1px solid #E2E8F0",padding:22}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                      <div style={{display:"flex",alignItems:"center",gap:12}}>
                        <div style={{fontSize:28}}>{t.emoji}</div>
                        <div>
                          <div style={{fontWeight:800,fontSize:17,color:"#0F172A"}}>{t.nama}</div>
                          <code style={{fontSize:11,color:"#64748B",background:"#F8FAFC",padding:"2px 8px",borderRadius:4}}>slug: {t.slug}</code>
                        </div>
                      </div>
                      <div style={{display:"flex",gap:8}}>
                        <button onClick={() => openEditTipe(t)} style={{width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",background:"white",border:"1px solid #E2E8F0",borderRadius:8,cursor:"pointer"}}><Pencil size={14}/></button>
                        <button onClick={() => handleDeleteTipe(t.id)} style={{width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",background:"#FEF2F2",border:"1px solid #FECACA",color:"#EF4444",borderRadius:8,cursor:"pointer"}}><X size={14}/></button>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",background:t.perlu_portal?"#EFF6FF":"#F8FAFC",borderRadius:7,fontSize:12,fontWeight:700,color:t.perlu_portal?"#1D4ED8":"#94A3B8"}}>
                        <Globe size={12}/> {t.perlu_portal ? ("Portal: "+t.portal_path+"/[id]") : "Tanpa Portal"}
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",background:t.perlu_gaji?"#F0FDF4":"#F8FAFC",borderRadius:7,fontSize:12,fontWeight:700,color:t.perlu_gaji?"#16A34A":"#94A3B8"}}>
                        <Banknote size={12}/> {t.perlu_gaji ? "Ada Pencatatan Gaji" : "Tanpa Gaji"}
                      </div>
                    </div>
                    <div style={{fontSize:12,color:"#94A3B8"}}>Vendor aktif dengan tipe ini: <b style={{color:"#475569"}}>{aktif.filter(v => v.tipe===t.slug).length}</b></div>
                  </div>
                ))}
                <button onClick={openAddTipe} style={{border:"2px dashed #CBD5E1",borderRadius:14,padding:22,background:"transparent",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10,color:"#64748B",minHeight:150}}>
                  <Plus size={28}/><span style={{fontWeight:700}}>Tambah Tipe Baru</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showVendorForm && (
        <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.65)",backdropFilter:"blur(4px)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:"white",borderRadius:20,width:"100%",maxWidth:520,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
            <div style={{padding:"22px 28px",borderBottom:"1px solid #E2E8F0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:40,height:40,borderRadius:12,background:"#EFF6FF",display:"flex",alignItems:"center",justifyContent:"center"}}><Factory size={20} color="#2563EB"/></div>
                <h2 style={{margin:0,fontWeight:800,fontSize:18,color:"#0F172A"}}>{editVendorId ? "Edit Vendor" : "Tambah Vendor Baru"}</h2>
              </div>
              <button onClick={() => setShowVendorForm(false)} style={{background:"#F1F5F9",border:"none",width:32,height:32,borderRadius:"50%",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><X size={16}/></button>
            </div>
            <form onSubmit={handleSaveVendor} style={{padding:28}}>
              <div style={{marginBottom:18}}>
                <label style={{display:"block",fontWeight:700,fontSize:13,color:"#475569",marginBottom:6}}>Nama Vendor / Pabrik *</label>
                <input className="form-control" value={vendorForm.nama} onChange={e => setVendorForm(f => ({...f,nama:e.target.value}))} placeholder="Contoh: CMT Jahit A" required/>
              </div>
              <div style={{marginBottom:18}}>
                <label style={{display:"block",fontWeight:700,fontSize:13,color:"#475569",marginBottom:6}}>Tipe Vendor / Peran *</label>
                <select className="form-control" value={vendorForm.tipe} onChange={e => setVendorForm(f => ({...f,tipe:e.target.value}))} required>
                  <option value="">Pilih Tipe...</option>
                  {vendorTypes.map(t => <option key={t.slug} value={t.slug}>{t.emoji} {t.nama}</option>)}
                </select>
                {vendorForm.tipe && (() => { const ti = getTipeInfo(vendorForm.tipe); if (!ti) return null; return (
                  <div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}>
                    <span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:5,background:ti.perlu_portal?"#EFF6FF":"#F8FAFC",color:ti.perlu_portal?"#1D4ED8":"#94A3B8"}}>{ti.perlu_portal ? "Punya Portal Akses" : "Tanpa Portal"}</span>
                    <span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:5,background:ti.perlu_gaji?"#F0FDF4":"#F8FAFC",color:ti.perlu_gaji?"#16A34A":"#94A3B8"}}>{ti.perlu_gaji ? "Perlu Pencatatan Gaji" : "Tanpa Gaji"}</span>
                  </div>
                ); })()}
              </div>
              <div style={{marginBottom:18}}>
                <label style={{display:"block",fontWeight:700,fontSize:13,color:"#475569",marginBottom:6}}>Keahlian / Jenis Pekerjaan</label>
                <input className="form-control" value={vendorForm.jenis_default} onChange={e => setVendorForm(f => ({...f,jenis_default:e.target.value}))} placeholder="Contoh: Jahit, Sablon, dll"/>
              </div>
              <div style={{marginBottom:18}}>
                <label style={{display:"block",fontWeight:700,fontSize:13,color:"#475569",marginBottom:6}}>Kontak WhatsApp</label>
                <div style={{display:"flex",border:"1px solid #E2E8F0",borderRadius:8,overflow:"hidden"}}>
                  <div style={{padding:"10px 14px",background:"#F8FAFC",fontWeight:700,fontSize:13,color:"#64748B",borderRight:"1px solid #E2E8F0"}}>+62</div>
                  <input style={{flex:1,padding:"10px 14px",border:"none",outline:"none",fontSize:14}} value={vendorForm.kontak} onChange={e => setVendorForm(f => ({...f,kontak:e.target.value}))} placeholder="81234567890"/>
                </div>
              </div>
              {getTipeInfo(vendorForm.tipe)?.perlu_gaji && (
                <div style={{marginBottom:18}}>
                  <label style={{display:"block",fontWeight:700,fontSize:13,color:"#475569",marginBottom:6}}>Gaji / Ongkos per Pcs (Rp)</label>
                  <div style={{display:"flex",border:"1px solid #E2E8F0",borderRadius:8,overflow:"hidden"}}>
                    <div style={{padding:"10px 14px",background:"#F8FAFC",fontWeight:700,fontSize:13,color:"#64748B",borderRight:"1px solid #E2E8F0"}}>Rp</div>
                    <input type="number" style={{flex:1,padding:"10px 14px",border:"none",outline:"none",fontSize:14}} value={vendorForm.hargaPerPcs||""} onChange={e => setVendorForm(f => ({...f,hargaPerPcs:parseInt(e.target.value)||0}))} placeholder="5000"/>
                  </div>
                </div>
              )}
              <div style={{marginBottom:24,padding:"14px 16px",background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:10}}>
                <label style={{display:"block",fontSize:13,fontWeight:800,color:"#0F172A",marginBottom:6}}>Proses Scan QR SPK</label>
                <div style={{display:"flex",gap:10}}>
                  {[{val:true,label:"Wajib Hitung"},{val:false,label:"Langsung Saja"}].map(opt => (
                    <label key={String(opt.val)} style={{flex:1,cursor:"pointer",display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:vendorForm.wajib_hitung_ulang===opt.val?"#EFF6FF":"white",border:"1px solid "+(vendorForm.wajib_hitung_ulang===opt.val?"#2563EB":"#E2E8F0"),borderRadius:8}}>
                      <input type="radio" checked={vendorForm.wajib_hitung_ulang===opt.val} onChange={() => setVendorForm(f => ({...f,wajib_hitung_ulang:opt.val}))} style={{accentColor:"#2563EB"}}/>
                      <span style={{fontSize:12,fontWeight:700,color:vendorForm.wajib_hitung_ulang===opt.val?"#1D4ED8":"#64748B"}}>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div style={{display:"flex",gap:12}}>
                <button type="button" onClick={() => setShowVendorForm(false)} style={{flex:1,padding:14,borderRadius:12,border:"1px solid #E2E8F0",background:"white",fontWeight:700,cursor:"pointer",color:"#64748B"}}>Batal</button>
                <button type="submit" disabled={savingVendor||!vendorForm.nama} style={{flex:2,padding:14,borderRadius:12,border:"none",background:"#2563EB",color:"white",fontWeight:800,cursor:"pointer",fontSize:15}}>
                  {savingVendor ? "Menyimpan..." : editVendorId ? "Simpan Perubahan" : "Simpan Vendor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTipeForm && (
        <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.65)",backdropFilter:"blur(4px)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:"white",borderRadius:20,width:"100%",maxWidth:500,boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
            <div style={{padding:"22px 28px",borderBottom:"1px solid #E2E8F0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:40,height:40,borderRadius:12,background:"#F3F0FF",display:"flex",alignItems:"center",justifyContent:"center"}}><Settings2 size={20} color="#6366F1"/></div>
                <h2 style={{margin:0,fontWeight:800,fontSize:18,color:"#0F172A"}}>{editTipeId ? "Edit Tipe" : "Tambah Tipe Vendor Baru"}</h2>
              </div>
              <button onClick={() => setShowTipeForm(false)} style={{background:"#F1F5F9",border:"none",width:32,height:32,borderRadius:"50%",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><X size={16}/></button>
            </div>
            <form onSubmit={handleSaveTipe} style={{padding:28}}>
              <div style={{display:"flex",gap:12,marginBottom:18}}>
                <div style={{width:80}}>
                  <label style={{display:"block",fontWeight:700,fontSize:13,color:"#475569",marginBottom:6}}>Emoji</label>
                  <input className="form-control" value={tipeForm.emoji} onChange={e => setTipeForm(f => ({...f,emoji:e.target.value}))} placeholder="📦" style={{textAlign:"center",fontSize:20}}/>
                </div>
                <div style={{flex:1}}>
                  <label style={{display:"block",fontWeight:700,fontSize:13,color:"#475569",marginBottom:6}}>Nama Tipe *</label>
                  <input className="form-control" value={tipeForm.nama} onChange={e => setTipeForm(f => ({...f,nama:e.target.value}))} placeholder="Contoh: QC / Finishing" required/>
                </div>
              </div>
              <div style={{marginBottom:18}}>
                <label style={{display:"block",fontWeight:700,fontSize:13,color:"#475569",marginBottom:6}}>Slug (Kode Unik) *</label>
                <input className="form-control" value={tipeForm.slug} onChange={e => setTipeForm(f => ({...f,slug:e.target.value.toLowerCase().replace(/\s+/g,"_")}))} placeholder="Contoh: qc_finishing" required/>
                <div style={{fontSize:11,color:"#64748B",marginTop:5}}>Huruf kecil tanpa spasi. Digunakan sebagai pengenal internal tipe vendor.</div>
              </div>
              <div style={{marginBottom:18,padding:"14px 16px",background:"#F8FAFC",borderRadius:12,border:"1px solid #E2E8F0"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div>
                    <div style={{fontWeight:800,fontSize:14,color:"#0F172A",display:"flex",alignItems:"center",gap:8}}><Globe size={16}/> Perlu Portal Akses?</div>
                    <div style={{fontSize:12,color:"#64748B",marginTop:3}}>Apakah vendor tipe ini memiliki halaman portal sendiri (link khusus yang diberikan ke vendor)?</div>
                  </div>
                  <button type="button" onClick={() => setTipeForm(f => ({...f,perlu_portal:!f.perlu_portal}))} style={{width:44,height:24,borderRadius:12,border:"none",background:tipeForm.perlu_portal?"#2563EB":"#CBD5E1",cursor:"pointer",position:"relative",transition:"background 0.2s",flexShrink:0}}>
                    <div style={{position:"absolute",top:2,left:tipeForm.perlu_portal?22:2,width:20,height:20,borderRadius:"50%",background:"white",transition:"left 0.2s"}}/>
                  </button>
                </div>
                {tipeForm.perlu_portal && (
                  <div>
                    <label style={{display:"block",fontWeight:700,fontSize:12,color:"#475569",marginBottom:5}}>Path Portal (tanpa /[id])</label>
                    <input className="form-control" value={tipeForm.portal_path} onChange={e => setTipeForm(f => ({...f,portal_path:e.target.value}))} placeholder="Contoh: /washing"/>
                    <div style={{fontSize:11,color:"#64748B",marginTop:4}}>Portal akan diakses di: <code>{tipeForm.portal_path||"/..."}/[vendor_id]</code></div>
                  </div>
                )}
              </div>
              <div style={{marginBottom:24,padding:"14px 16px",background:"#F8FAFC",borderRadius:12,border:"1px solid #E2E8F0"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontWeight:800,fontSize:14,color:"#0F172A",display:"flex",alignItems:"center",gap:8}}><Banknote size={16}/> Perlu Pencatatan Gaji/Biaya?</div>
                    <div style={{fontSize:12,color:"#64748B",marginTop:3}}>Apakah vendor ini dibayar per pcs dan perlu direkap ongkosnya di sistem?</div>
                  </div>
                  <button type="button" onClick={() => setTipeForm(f => ({...f,perlu_gaji:!f.perlu_gaji}))} style={{width:44,height:24,borderRadius:12,border:"none",background:tipeForm.perlu_gaji?"#16A34A":"#CBD5E1",cursor:"pointer",position:"relative",transition:"background 0.2s",flexShrink:0}}>
                    <div style={{position:"absolute",top:2,left:tipeForm.perlu_gaji?22:2,width:20,height:20,borderRadius:"50%",background:"white",transition:"left 0.2s"}}/>
                  </button>
                </div>
              </div>
              <div style={{display:"flex",gap:12}}>
                <button type="button" onClick={() => setShowTipeForm(false)} style={{flex:1,padding:14,borderRadius:12,border:"1px solid #E2E8F0",background:"white",fontWeight:700,cursor:"pointer",color:"#64748B"}}>Batal</button>
                <button type="submit" disabled={savingTipe||!tipeForm.nama||!tipeForm.slug} style={{flex:2,padding:14,borderRadius:12,border:"none",background:"#6366F1",color:"white",fontWeight:800,cursor:"pointer",fontSize:15}}>
                  {savingTipe ? "Menyimpan..." : editTipeId ? "Simpan Perubahan" : "Simpan Tipe Vendor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
""".strip()

out = os.path.join(r'src', 'app', '(owner)', 'atur-vendor', 'page.tsx')
with open(out, 'w', encoding='utf-8') as f:
    f.write(code)
print(f"Written {len(code)} chars to {out}")