"use client";
import { useEffect, useState } from "react";
import { Search, Printer, QrCode, Filter } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  "menunggu-diterima": "Menunggu Diterima",
  "diterima": "Diterima",
  "selesai-dikerjakan": "Selesai Dikerjakan",
  "dikirim": "Dikirim",
};

const STATUS_STYLE: Record<string, { bg: string; color: string; dot: string }> = {
  "menunggu-diterima": { bg: "#FEF3C7", color: "#D97706", dot: "#F59E0B" },
  "diterima": { bg: "#DBEAFE", color: "#1D4ED8", dot: "#3B82F6" },
  "selesai-dikerjakan": { bg: "#D1FAE5", color: "#047857", dot: "#10B981" },
  "dikirim": { bg: "#D1FAE5", color: "#047857", dot: "#10B981" },
};

function formatTgl(str: string) {
  if (!str) return "-";
  return new Date(str).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export default function DaftarSPKPage() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterVendor, setFilterVendor] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showQrModal, setShowQrModal] = useState<any>(null);
  const [qrBaseUrl, setQrBaseUrl] = useState("");

  // Removed hacky useEffect for global layout

  useEffect(() => {
    if (typeof window !== "undefined") {
      setQrBaseUrl(window.location.origin);
    }
  }, []);

  useEffect(() => {
    fetch("/api/spk").then(r => r.json()).then(d => { setList(d); setLoading(false); });
  }, []);

  const vendors = [...new Set(list.map(s => s.vendor_nama))];

  const filtered = list.filter(s => {
    const matchSearch = !search || s.no_spk.toLowerCase().includes(search.toLowerCase()) || s.kode_batch.toLowerCase().includes(search.toLowerCase());
    const matchVendor = !filterVendor || s.vendor_nama === filterVendor;
    const matchStatus = !filterStatus || s.status === filterStatus;
    return matchSearch && matchVendor && matchStatus;
  });

  const handlePrint = (s: any) => {
    const url = `${window.location.origin}/spk/${s.token}`;
    window.open(url, "_blank");
  };

  const printBoardingPass = (b: any, baseUrl: string) => {
    const spkUrl = `${baseUrl}/spk/${b.token}`;
    const totalPcs = (b.size_breakdown ?? []).reduce((s: number, x: any) => s + (x.jumlah ?? 0), 0) || b.jumlah_pcs || 0;
    const totalCacat = (b.size_breakdown ?? []).reduce((s: number, x: any) => s + (x.cacat ?? 0), 0);
    const vendorRoute = b.steps?.map((st: any) => st.vendor_nama.split(" — ")[0]).join(" → ") || "-";
    const pekerjaanRoute = b.steps?.map((st: any) => st.jenis_pekerjaan).join(" → ") || "-";
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(spkUrl)}`;
    const tgl = formatTgl(b.created_at);
    const sizeText = (b.size_breakdown ?? []).map((sz: any) => `${sz.size}: ${sz.jumlah} pcs${(sz.cacat??0)>0?` (${sz.cacat} cacat)`:""}`).join("  |  ") || "-";
    const catatanRoute = b.catatan_route || "";
    const lastDeadline = b.steps?.[b.steps.length - 1]?.deadline;
    const stepNotes = (b.steps ?? []).filter((st: any) => st.catatan).map((st: any) =>
      `<div style="margin-bottom:4px;"><span style="font-weight:700;">${st.jenis_pekerjaan}:</span> ${st.catatan}</div>`
    ).join("");
    const stepDeadlines = (b.steps ?? []).map((st: any, i: number) =>
      `<tr>
        <td style="padding:4px 8px 4px 0;font-size:11px;font-weight:700;white-space:nowrap;">${i+1}. ${st.jenis_pekerjaan}</td>
        <td style="padding:4px 8px;font-size:11px;color:#555;">${st.vendor_nama?.split(" — ")[0] ?? "-"}</td>
        <td style="padding:4px 0 4px 8px;font-size:11px;font-weight:700;text-align:right;white-space:nowrap;">${st.deadline ? formatTgl(st.deadline) : "-"}</td>
      </tr>`
    ).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Label — ${b.kode_batch}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; background:#fff; color:#000; padding:20px; }
  .label { border: 2px solid #000; max-width: 440px; margin: 0 auto; }
  .header { border-bottom: 2px solid #000; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; }
  .batch { font-size: 26px; font-weight: 900; letter-spacing: -0.5px; font-family: monospace; }
  .badge { font-size: 10px; font-weight: 700; border: 2px solid #000; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 1px; }
  .body { padding: 12px 16px; }
  .row { display: flex; border-bottom: 1px solid #ccc; padding: 7px 0; align-items: baseline; gap: 8px; }
  .row:last-child { border-bottom: none; }
  .key { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #555; width: 110px; flex-shrink: 0; }
  .val { font-size: 13px; font-weight: 700; flex: 1; }
  .divider { border-top: 2px dashed #000; margin: 12px 0 0; }
  .qr-section { padding: 14px 16px 16px; display: flex; gap: 16px; align-items: center; }
  .qr-info { flex: 1; }
  .qr-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #555; margin-bottom: 5px; }
  .qr-url { font-size: 9px; font-family: monospace; word-break: break-all; color: #000; line-height: 1.5; }
  .total-box { text-align: center; border: 2px solid #000; padding: 6px 14px; }
  .total-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
  .total-num { font-size: 36px; font-weight: 900; line-height: 1; }
  @media print { body { padding: 0; } }
</style>
</head><body>
<div class="label">
  <div class="header">
    <div>
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#555;margin-bottom:3px;">SPK Bundle${b.is_retur?" · RETUR":""}</div>
      <div class="batch">${b.kode_batch}</div>
    </div>
    <div class="total-box">
      <div class="total-label">Total Pcs</div>
      <div class="total-num">${totalPcs - totalCacat}</div>
      ${totalCacat > 0 ? `<div style="font-size:10px;font-weight:700;">⚠ ${totalCacat} cacat</div>` : ""}
    </div>
  </div>
  <div class="body">
    <div class="row"><span class="key">Jenis Kain</span><span class="val">${b.jenis_kain || "-"}</span></div>
    ${b.jumlah_meter ? `<div class="row"><span class="key">Jumlah Bahan</span><span class="val">${b.jumlah_meter} meter</span></div>` : ""}
    <div class="row"><span class="key">Ukuran</span><span class="val">${sizeText}</span></div>
    <div class="row"><span class="key">Vendor</span><span class="val">${vendorRoute}</span></div>
    <div class="row"><span class="key">Pekerjaan</span><span class="val">${pekerjaanRoute}</span></div>
    ${stepDeadlines ? `<div class="row" style="align-items:flex-start;"><span class="key">Deadline<br>per Vendor</span><div class="val"><table style="width:100%;border-collapse:collapse;">${stepDeadlines}</table></div></div>` : ""}
    <div class="row"><span class="key">Tgl. Buat</span><span class="val">${tgl}</span></div>
    ${lastDeadline ? `<div class="row"><span class="key" style="color:#000;">Deadline</span><span class="val" style="font-size:14px;font-weight:900;">${formatTgl(lastDeadline)}</span></div>` : ""}
    <div class="row"><span class="key">Status</span><span class="val">${b.route_selesai ? "Selesai — Di Gudang" : `Step ${b.current_step} sedang berjalan`}</span></div>
    ${catatanRoute ? `<div class="row"><span class="key">Catatan</span><span class="val" style="font-weight:400;font-style:italic;">${catatanRoute}</span></div>` : ""}
    ${stepNotes ? `<div class="row" style="align-items:flex-start;"><span class="key">Catatan Step</span><div class="val" style="font-size:12px;font-weight:400;line-height:1.6;">${stepNotes}</div></div>` : ""}
  </div>
  <div class="divider"></div>
  <div class="qr-section">
    <div class="qr-info">
      <div class="qr-label">Scan QR → Akses Halaman Vendor</div>
      <div class="qr-url">${spkUrl}</div>
    </div>
    <img src="${qrUrl}" width="130" height="130" style="flex-shrink:0;border:1px solid #ddd;padding:4px;" />
  </div>
</div>
<script>window.onload=function(){setTimeout(function(){window.print();window.close();},900);}<\/script>
</body></html>`;

    const w = window.open("", "_blank", "width=500,height=680");
    if (w) { w.document.write(html); w.document.close(); }
  };


  return (
    <>
      <style>{`
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 99px; }
        .table-row-hover:hover { background: #F8FAFC; }
      `}</style>
      
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#F1F5F9", overflow: "hidden" }}>
        
        {/* Header Fixed */}
        <div style={{ padding: "24px 32px", background: "white", borderBottom: "1px solid #E2E8F0", flexShrink: 0 }}>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", marginBottom: 4 }}>Daftar SPK</h1>
          <p style={{ fontSize: 13, color: "#64748B" }}>Semua Surat Perintah Kerja yang diterbitkan dan dipantau QR Code-nya</p>
        </div>

        {/* Action Bar Fixed */}
        <div style={{ padding: "16px 32px", background: "white", borderBottom: "1px solid #E2E8F0", flexShrink: 0, display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", background: "#F8FAFC", border: "1px solid #CBD5E1", borderRadius: 10, padding: "0 14px", transition: "border-color 0.2s" }} onFocus={e => e.currentTarget.style.borderColor = "#3B82F6"} onBlur={e => e.currentTarget.style.borderColor = "#CBD5E1"}>
            <Search size={18} color="#94A3B8" />
            <input 
              style={{ flex: 1, padding: "10px 12px", background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#0F172A" }} 
              placeholder="Cari kode batch atau SPK..." 
              value={search} onChange={e => setSearch(e.target.value)} 
            />
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#F8FAFC", border: "1px solid #CBD5E1", borderRadius: 10, padding: "8px 12px" }}>
              <Filter size={16} color="#64748B" />
              <select style={{ background: "transparent", border: "none", outline: "none", fontSize: 13, fontWeight: 600, color: "#334155", paddingRight: 8 }} value={filterVendor} onChange={e => setFilterVendor(e.target.value)}>
                <option value="">Semua Vendor</option>
                {vendors.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#F8FAFC", border: "1px solid #CBD5E1", borderRadius: 10, padding: "8px 12px" }}>
              <Filter size={16} color="#64748B" />
              <select style={{ background: "transparent", border: "none", outline: "none", fontSize: 13, fontWeight: 600, color: "#334155", paddingRight: 8 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="">Semua Status</option>
                <option value="menunggu-diterima">Menunggu Diterima</option>
                <option value="diterima">Diterima</option>
                <option value="selesai-dikerjakan">Selesai Dikerjakan</option>
                <option value="dikirim">Dikirim</option>
              </select>
            </div>
          </div>
        </div>

        {/* Scrollable Table Area */}
        <div style={{ flex: 1, padding: "24px 32px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ flex: 1, background: "white", borderRadius: 20, border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column" }}>
            
            {loading ? (
              <div style={{ padding: 60, textAlign: "center", color: "#94A3B8" }}>⏳ Memuat data SPK...</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 60, textAlign: "center", color: "#94A3B8" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", marginBottom: 4 }}>Belum ada SPK</div>
                <div style={{ fontSize: 13 }}>SPK yang diterbitkan akan muncul di sini</div>
              </div>
            ) : (
              <div style={{ overflow: "auto", flex: 1 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                    <tr style={{ background: "#F8FAFC" }}>
                      <th style={{ padding: "14px 20px", fontSize: 12, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "2px solid #E2E8F0" }}>No. SPK / Batch</th>
                      <th style={{ padding: "14px 20px", fontSize: 12, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "2px solid #E2E8F0" }}>Info Kain</th>
                      <th style={{ padding: "14px 20px", fontSize: 12, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "2px solid #E2E8F0" }}>Route Vendor</th>
                      <th style={{ padding: "14px 20px", fontSize: 12, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "2px solid #E2E8F0" }}>Tgl & Deadline</th>
                      <th style={{ padding: "14px 20px", fontSize: 12, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "2px solid #E2E8F0" }}>Status Terakhir</th>
                      <th style={{ padding: "14px 20px", fontSize: 12, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, textAlign: "center", borderBottom: "2px solid #E2E8F0" }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(s => {
                      const vendorRoute = s.steps?.map((st: any) => st.vendor_nama.split(" — ")[0]).join(" → ") || "-";
                      const pekerjaanRoute = s.steps?.map((st: any) => st.jenis_pekerjaan).join(" → ") || "-";
                      const lastDeadline = s.steps?.[s.steps.length - 1]?.deadline;
                      const style = STATUS_STYLE[s.status] || STATUS_STYLE["menunggu-diterima"];

                      return (
                        <tr key={s.id} className="table-row-hover" style={{ borderBottom: "1px solid #F1F5F9", transition: "background 0.2s" }}>
                          <td style={{ padding: "16px 20px" }}>
                            <div style={{ fontWeight: 800, fontSize: 14, color: "#0F172A", fontFamily: "monospace", display: "flex", alignItems: "center", gap: 8 }}>
                              {s.kode_batch}
                              {s.is_retur && <span style={{ padding: "2px 6px", background: "#FEE2E2", color: "#B91C1C", borderRadius: 4, fontSize: 10, fontWeight: 900 }}>RETUR</span>}
                            </div>
                            <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 4, fontFamily: "monospace" }}>{s.no_spk}</div>
                          </td>
                          <td style={{ padding: "16px 20px" }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: "#334155" }}>{s.jenis_kain}</div>
                            <div style={{ fontSize: 12, color: "#64748B", marginTop: 4, fontWeight: 600 }}>{s.jumlah_pcs} pcs</div>
                          </td>
                          <td style={{ padding: "16px 20px", maxWidth: 220 }}>
                            <div style={{ fontWeight: 600, fontSize: 12, color: "#0F172A", lineHeight: 1.5 }}>{vendorRoute}</div>
                            <div style={{ fontSize: 11, color: "#64748B", marginTop: 4, lineHeight: 1.4 }}>⚙️ {pekerjaanRoute}</div>
                          </td>
                          <td style={{ padding: "16px 20px" }}>
                            <div style={{ fontSize: 12, color: "#334155", display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{color: "#94A3B8"}}>Buat:</span> <strong>{formatTgl(s.created_at)}</strong>
                            </div>
                            {lastDeadline && (
                              <div style={{ fontSize: 12, color: "#EF4444", display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                                <span>Deadline:</span> <strong>{formatTgl(lastDeadline)}</strong>
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "16px 20px" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", background: style.bg, color: style.color, borderRadius: 99, fontSize: 11, fontWeight: 800 }}>
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: style.dot, display: "inline-block" }} />
                              {STATUS_LABEL[s.status] ?? s.status}
                            </span>
                          </td>
                          <td style={{ padding: "16px 20px", display: "flex", gap: 8, justifyContent: "center" }}>
                            <button onClick={() => setShowQrModal(s)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: "#F1F5F9", color: "#3B82F6", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "background 0.2s" }} onMouseOver={e => e.currentTarget.style.background = "#DBEAFE"} onMouseOut={e => e.currentTarget.style.background = "#F1F5F9"}>
                              <QrCode size={14} /> QR
                            </button>
                            <button onClick={() => handlePrint(s)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: "white", color: "#475569", border: "1px solid #CBD5E1", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "background 0.2s" }} onMouseOver={e => e.currentTarget.style.background = "#F8FAFC"} onMouseOut={e => e.currentTarget.style.background = "white"}>
                              <Printer size={14} /> Cetak
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          
          <div style={{ marginTop: 16, fontSize: 12, fontWeight: 600, color: "#94A3B8", textAlign: "right", paddingRight: 8 }}>
            Menampilkan {filtered.length} dari {list.length} SPK
          </div>
        </div>
      </div>

      {showQrModal && (() => {
        const b = showQrModal;
        const spkUrl = `${qrBaseUrl}/spk/${b.token}`;
        const totalPcs = (b.size_breakdown ?? []).reduce((s: number, x: any) => s + (x.jumlah ?? 0), 0) || b.jumlah_pcs || 0;
        const totalCacat = (b.size_breakdown ?? []).reduce((s: number, x: any) => s + (x.cacat ?? 0), 0);
        const vendorRoute = b.steps?.map((st: any) => st.vendor_nama.split(" — ")[0]).join(" → ") || "-";
        const pekerjaanRoute = b.steps?.map((st: any) => st.jenis_pekerjaan).join(" → ") || "-";
        return (
          <div className="no-print" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setShowQrModal(null)}>
            <div style={{ background: "white", borderRadius: 24, position: "relative", width: "100%", maxWidth: 420, boxShadow: "0 32px 64px rgba(0,0,0,0.3)", overflow: "hidden" }} onClick={e => e.stopPropagation()}>

              <button onClick={() => setShowQrModal(null)} className="no-print" style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", zIndex: 10, color: "white", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s" }} onMouseOver={e=>e.currentTarget.style.background="rgba(255,255,255,0.3)"} onMouseOut={e=>e.currentTarget.style.background="rgba(255,255,255,0.2)"}>✕</button>

              <div id="boarding-pass-print" style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E3A8A 100%)", padding: "28px 28px 24px", color: "white" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.6, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>SPK Bundle</div>
                    <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.5, fontFamily: "monospace" }}>{b.kode_batch}</div>
                    {b.is_retur && <div style={{ fontSize: 11, background: "#EF4444", color: "white", borderRadius: 6, padding: "3px 10px", display: "inline-block", marginTop: 6, fontWeight: 800, letterSpacing: 0.5 }}>🔄 RETUR</div>}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, opacity: 0.6, fontWeight: 800, letterSpacing: 1 }}>TOTAL PCS</div>
                    <div style={{ fontSize: 32, fontWeight: 900, color: "#34D399" }}>{totalPcs - totalCacat}</div>
                    {totalCacat > 0 && <div style={{ fontSize: 12, color: "#FCA5A5", fontWeight: 700, marginTop: 4 }}>⚠️ {totalCacat} cacat</div>}
                  </div>
                </div>

                <div style={{ background: "rgba(255,255,255,0.12)", borderRadius: 12, padding: "12px 16px", marginBottom: 16 }}>
                  <div style={{ fontSize: 11, opacity: 0.6, fontWeight: 800, letterSpacing: 1, marginBottom: 4 }}>BAHAN / JENIS KAIN</div>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>{b.jenis_kain || "-"}</div>
                  {b.jumlah_meter && <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4, fontWeight: 600 }}>📐 {b.jumlah_meter} meter bahan</div>}
                </div>

                {(b.size_breakdown ?? []).length > 0 && (
                  <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 12, padding: "12px 16px", marginBottom: 16 }}>
                    <div style={{ fontSize: 11, opacity: 0.6, fontWeight: 800, letterSpacing: 1, marginBottom: 10 }}>UKURAN & JUMLAH</div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {b.size_breakdown.map((sz: any) => (
                        <div key={sz.size} style={{ background: "rgba(255,255,255,0.15)", borderRadius: 10, padding: "8px 14px", textAlign: "center", minWidth: 60 }}>
                          <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 800 }}>{sz.size}</div>
                          <div style={{ fontSize: 20, fontWeight: 900, margin: "2px 0" }}>{sz.jumlah}</div>
                          {(sz.cacat ?? 0) > 0 && <div style={{ fontSize: 11, color: "#FCA5A5", fontWeight: 700 }}>-{sz.cacat}⚠️</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 12, padding: "12px 16px" }}>
                  <div style={{ fontSize: 11, opacity: 0.6, fontWeight: 800, letterSpacing: 1, marginBottom: 8 }}>ROUTE PRODUKSI</div>
                  <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.5 }}>👥 {vendorRoute}</div>
                  <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6, lineHeight: 1.4 }}>⚙️ {pekerjaanRoute}</div>
                </div>
              </div>

              <div style={{ background: "white", position: "relative", height: 28, display: "flex", alignItems: "center" }}>
                <div style={{ position: "absolute", left: -16, width: 32, height: 32, borderRadius: "50%", background: "#F1F5F9" }} />
                <div style={{ flex: 1, borderTop: "2px dashed #CBD5E1", margin: "0 24px" }} />
                <div style={{ position: "absolute", right: -16, width: 32, height: 32, borderRadius: "50%", background: "#F1F5F9" }} />
              </div>

              <div style={{ padding: "16px 28px 24px", display: "flex", gap: 20, alignItems: "center" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Scan untuk akses vendor</div>
                  <div style={{ fontSize: 12, color: "#475569", wordBreak: "break-all", fontFamily: "monospace", lineHeight: 1.5, marginBottom: 12 }}>{spkUrl}</div>
                  <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>📅 Dibuat: {formatTgl(b.created_at)}</div>
                  <div style={{ fontSize: 11, color: b.route_selesai ? "#059669" : "#D97706", fontWeight: 800, marginTop: 6 }}>
                    {b.route_selesai ? "✅ Selesai — Di Gudang" : `⚙️ Step ${b.current_step}/${b.steps?.length ?? "?"} berjalan`}
                  </div>
                </div>
                <div style={{ flexShrink: 0, background: "white", border: "2px solid #E2E8F0", borderRadius: 16, padding: 10, boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(spkUrl)}`} alt="QR" style={{ display: "block", width: 140, height: 140 }} />
                </div>
              </div>

              <div className="no-print" style={{ padding: "0 28px 28px", display: "flex", gap: 12 }}>
                <button style={{ flex: 1, padding: "14px", background: "#F1F5F9", color: "#334155", border: "none", borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: "pointer", transition: "background 0.2s" }} onMouseOver={e=>e.currentTarget.style.background="#E2E8F0"} onMouseOut={e=>e.currentTarget.style.background="#F1F5F9"} onClick={() => navigator.clipboard.writeText(spkUrl).then(() => alert("Link disalin!"))}>
                  📋 Salin Link
                </button>
                <button style={{ flex: 1, padding: "14px", background: "#3B82F6", color: "white", border: "none", borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 12px rgba(59,130,246,0.3)", transition: "opacity 0.2s" }} onMouseOver={e=>e.currentTarget.style.opacity="0.9"} onMouseOut={e=>e.currentTarget.style.opacity="1"} onClick={() => printBoardingPass(b, qrBaseUrl)}>
                  🖨️ Cetak Label
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #boarding-pass-print, #boarding-pass-print * { visibility: visible !important; }
          #boarding-pass-print { position: fixed !important; top: 0; left: 0; width: 100vw !important; background: white !important; color: black !important; padding: 20px !important; }
          .no-print { display: none !important; }
        }
      `}</style>
    </>
  );
}
