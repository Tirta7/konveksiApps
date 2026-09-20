"use client";
import { useEffect, useState } from "react";
import { Search, Printer, CheckCircle, Clock } from "lucide-react";
import Link from "next/link";

function formatTgl(str: string) {

  if (!str) return "-";
  return new Date(str).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export default function DaftarSPKPage() {
  const [list, setList] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadData = async () => {
    try {
      const [resPO, resVendors] = await Promise.all([
        fetch("/api/po-produksi"),
        fetch("/api/vendors")
      ]);
      const poData = await resPO.json();
      const vendorData = await resVendors.json();
      setList(poData);
      setVendors(vendorData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    loadData(); 
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, []);

  const getVendorName = (id: number) => {
    const v = vendors.find(v => v.id === id);
    return v ? v.nama : "Unknown";
  };

  const filtered = list.filter(po => {
    return !search || po.noPo.toLowerCase().includes(search.toLowerCase()) || po.model.toLowerCase().includes(search.toLowerCase());
  });

  // Real-time sync: auto-refresh when another admin makes a change
  useEffect(() => {
    const handler = () => loadData();
    window.addEventListener("konveksi-sync", handler);
    return () => window.removeEventListener("konveksi-sync", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div style={{ padding: 32, display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-app)" }}>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 className="page-title">Daftar PO Produksi</h1>
          <p className="page-subtitle">Seluruh riwayat Purchase Order yang diterbitkan ke CMT.</p>
        </div>
        <Link href="/buat-spk" className="btn btn-primary">
          + Buat PO Baru
        </Link>
      </div>

      <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
        {/* Toolbar */}
        <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-color)", background: "#F8FAFC" }}>
          <div className="search-bar" style={{ margin: 0 }}>
            <div className="search-wrapper">
              <Search className="search-icon" />
              <input type="text" placeholder="Cari No PO atau Model..." className="search-input" value={search} onChange={e => setSearch(e.target.value)} style={{ width: "100%" }} />
            </div>
          </div>
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading ? (
            <div className="empty-state"> Memuat data...</div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div style={{ fontSize: 48, marginBottom: 16 }}></div>
              <h3 style={{ margin: 0, color: "var(--text-primary)" }}>Belum ada PO</h3>
              <p style={{ marginTop: 8 }}>PO yang diterbitkan akan tampil di sini.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>No. PO</th>
                  <th>Model</th>
                  <th>Vendor / CMT</th>
                  <th>Tgl Terbit</th>
                  <th>Status Ledger</th>
                  <th style={{ textAlign: "center" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(po => {
                  const pct = Math.round((po.totalDiambil / po.jumlahTerbit) * 100);
                  const isClosed = po.status === "Closed";
                  return (
                    <tr key={po.id}>
                      <td>
                        <div style={{ fontWeight: 800, fontFamily: "monospace", color: "var(--text-primary)" }}>{po.noPo}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{po.model}</div>
                        <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-secondary)", marginTop: 4 }}>Tot: {po.jumlahTerbit} pcs</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{getVendorName(po.vendorId)}</div>
                      </td>
                      <td>
                        <div style={{ color: "var(--text-secondary)" }}>{formatTgl(po.tanggalTerbit)}</div>
                      </td>
                      <td>
                        {isClosed ? (
                          <div className="badge success">
                            <CheckCircle size={14} /> Selesai
                          </div>
                        ) : pct === 0 && !(po.totalDilaporkan > 0) ? (
                          <div>
                            <div className="badge warning" style={{ marginBottom: 6 }}>
                              <Clock size={14} /> Pending
                            </div>
                            <div style={{ width: "100%", background: "#E2E8F0", height: 6, borderRadius: 3 }}>
                              <div style={{ background: "#F59E0B", height: "100%", width: "0%" }} />
                            </div>
                            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", marginTop: 4, textAlign: "right" }}>Belum dikerjakan</div>
                          </div>
                        ) : (
                          <div>
                            {/* Stage badges */}
                            <div style={{ display: "flex", gap: 5, marginBottom: 6, flexWrap: "wrap" }}>
                              <div className="badge info"><Clock size={12} /> Proses</div>
                              {(po.totalDilaporkan || 0) > 0 && (
                                <div style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10, background: "#FEF3C7", color: "#92400E" }}>
                                   {po.totalDilaporkan} dilaporkan
                                </div>
                              )}
                              {(po.totalDisetujui || 0) > 0 && (
                                <div style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10, background: "#DCFCE7", color: "#166534" }}>
                                   {po.totalDisetujui} disetujui
                                </div>
                              )}
                              {(po.washingKirim || 0) > 0 && (
                                <div style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10, background: (po.washingACC || 0) > 0 ? "#CFFAFE" : "#E0F2FE", color: (po.washingACC || 0) > 0 ? "#0E7490" : "#0369A1" }}>
                                   {po.washingACC > 0 ? `${po.washingACC} washing ` : `${po.washingKirim} di washing`}
                                </div>
                              )}
                            </div>
                            {/* Multi-stage progress bar: CMT  Washing */}
                            <div style={{ width: "100%", background: "#E2E8F0", height: 8, borderRadius: 4, overflow: "hidden", position: "relative" }}>
                              {/* Layer 1: washing ACC (cyan) */}
                              <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${Math.min(po.pctWashingACC || 0, 100)}%`, background: "#06B6D4", borderRadius: 4 }} />
                              {/* Layer 2: washing proses (light cyan) */}
                              <div style={{ position: "absolute", left: `${po.pctWashingACC || 0}%`, top: 0, height: "100%", width: `${Math.min((po.pctWashing || 0) - (po.pctWashingACC || 0), 100)}%`, background: "#A5F3FC", borderRadius: 4 }} />
                              {/* Layer 3: CMT approved/disetujui (green) */}
                              <div style={{ position: "absolute", left: `${po.pctWashing || 0}%`, top: 0, height: "100%", width: `${Math.min(Math.max((po.pctDisetujui || 0) - (po.pctWashing || 0), 0), 100)}%`, background: "#10B981", borderRadius: 4 }} />
                              {/* Layer 4: CMT reported pending (yellow) */}
                              <div style={{ position: "absolute", left: `${Math.max(po.pctDisetujui || 0, po.pctWashing || 0)}%`, top: 0, height: "100%", width: `${Math.min(Math.max((po.pctCmt || 0) - Math.max(po.pctDisetujui || 0, po.pctWashing || 0), 0), 100)}%`, background: "#F59E0B", borderRadius: 4 }} />
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                              <div style={{ fontSize: 10, color: "#64748B" }}>{po.totalDilaporkan || 0} / {po.jumlahTerbit} pcs</div>
                              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)" }}>
                                {(po.pctWashingACC || 0) > 0 ? `${po.pctWashingACC}% washing selesai` : `${po.pctCmt || 0}% dilaporkan`}
                              </div>
                            </div>
                          </div>
                        )}
                      </td>

                      <td style={{ textAlign: "center" }}>
                        <Link href={`/cetak-po/${po.id}`} className="btn btn-secondary btn-sm" title="Cetak Nota PO">
                          <Printer size={16} /> Cetak
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
