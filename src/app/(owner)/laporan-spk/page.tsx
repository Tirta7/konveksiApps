"use client";
import { useEffect, useState } from "react";
import { BarChart2, Users, TrendingUp, CheckCircle, ChevronDown, ChevronUp, Package } from "lucide-react";

function formatRp(num: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num);
}

const RANK_STYLE: any[] = [
  { bg: "#FEF3C7", color: "#92400E" },
  { bg: "#E0E7FF", color: "#3730A3" },
  { bg: "#FFEDD5", color: "#9A3412" },
];

export default function LaporanProduksiPage() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [pengambilans, setPengambilans] = useState<any[]>([]);
  const [gajiCmt, setGajiCmt] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchData = () => {
    async function load() {
      try {
        const [resV, resP, resG] = await Promise.all([
          fetch("/api/vendors"),
          fetch("/api/po-pengambilan"),
          fetch("/api/gaji-cmt"),
        ]);
        const vData = await resV.json();
        const pData = await resP.json();
        const gData = resG.ok ? await resG.json() : [];
        setVendors(vData.filter((v: any) => v.tipe === "cmt"));
        setPengambilans(pData);
        setGajiCmt(Array.isArray(gData) ? gData : []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => {
    const handler = () => fetchData();
    window.addEventListener("konveksi-sync", handler);
    return () => window.removeEventListener("konveksi-sync", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getStats = () => {
    let totalPcs = 0;
    let totalGajiAll = 0;
    let topVendor = { nama: "-", pcs: 0 };

    const vendorStats = vendors.map((v) => {
      const pByVendor = pengambilans.filter((p) => p.po?.vendorId === v.id);
      const gajiByVendor = gajiCmt.filter((g) => g.cmtId === v.id);

      const breakdown: Record<string, { pcs: number; gaji: number; tarif: number }> = {};
      pByVendor.forEach((p) => {
        const kat = p.po?.model || p.po?.kategori || "Umum";
        let tarif = v.hargaPerPcs || 0;
        if (v.tarifPotongan?.[kat]) tarif = v.tarifPotongan[kat];
        if (!breakdown[kat]) breakdown[kat] = { pcs: 0, gaji: 0, tarif };
        breakdown[kat].pcs += p.jumlahDiambil;
        breakdown[kat].gaji += p.jumlahDiambil * tarif;
      });

      const pcs = Object.values(breakdown).reduce((s, b) => s + b.pcs, 0);
      const estimasiGaji = Object.values(breakdown).reduce((s, b) => s + b.gaji, 0);
      const totalGajiReal = gajiByVendor.reduce((s, g) => s + (g.totalGaji || 0), 0);
      const totalPcsReal = gajiByVendor.reduce((s, g) => s + (g.jumlahPcs || 0), 0);

      totalPcs += pcs;
      totalGajiAll += estimasiGaji;
      if (pcs > topVendor.pcs) topVendor = { nama: v.nama, pcs };

      return {
        ...v,
        pcsSelesai: pcs,
        estimasiGaji,
        hasKhusus: v.tarifPotongan && Object.keys(v.tarifPotongan).length > 0,
        breakdown,
        totalGajiReal,
        totalPcsReal,
        gajiByVendor,
      };
    });

    return {
      totalPcs,
      totalGajiAll,
      totalCmtActive: vendors.length,
      topVendor,
      vendorStats: vendorStats.sort((a, b) => b.pcsSelesai - a.pcsSelesai),
    };
  };

  const stats = getStats();

  if (loading) return <div className="empty-state"> Menyusun Laporan...</div>;

  return (
    <>
      <style>{`
        .lspk-wrap { padding: 24px 28px; display: flex; flex-direction: column; min-height: 100%; background: #F1F5F9; overflow-y: auto; }
        .lspk-kpi { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
        .lspk-kpi-card { background: white; border-radius: 14px; border: 1px solid #E2E8F0; padding: 20px; }
        .lspk-kpi-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-bottom: 12px; }
        .lspk-cmt-card { background: white; border-radius: 14px; border: 1px solid #E2E8F0; overflow: hidden; margin-bottom: 16px; transition: box-shadow 0.2s; }
        .lspk-cmt-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.07); }
        .lspk-cmt-header { display: flex; align-items: center; gap: 14px; padding: 18px 20px; cursor: pointer; }
        .lspk-cmt-badge { width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; flex-shrink: 0; }
        .lspk-cmt-info { flex: 1; min-width: 0; }
        .lspk-cmt-name { font-weight: 800; font-size: 15px; color: #0F172A; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .lspk-cmt-sub { font-size: 12px; color: #64748B; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .lspk-cmt-stats { display: flex; gap: 20px; flex-shrink: 0; align-items: center; }
        .lspk-cmt-stat { text-align: right; }
        .lspk-cmt-stat-label { font-size: 10px; color: #94A3B8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 2px; }
        .lspk-cmt-stat-value { font-weight: 900; font-size: 17px; line-height: 1.1; }
        .lspk-detail { border-top: 1px solid #F1F5F9; padding: 0 20px 20px; }
        .lspk-section-title { font-size: 10px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.5px; padding: 16px 0 8px; }
        .lspk-tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
        .lspk-tbl th { padding: 8px 10px; font-weight: 700; color: #475569; border-bottom: 1px solid #E2E8F0; background: #F8FAFC; text-align: left; }
        .lspk-tbl th.r { text-align: right; }
        .lspk-tbl td { padding: 10px 10px; border-bottom: 1px solid #F1F5F9; }
        .lspk-tbl td.r { text-align: right; }
        .lspk-tbl tfoot td { padding: 12px 10px; font-weight: 900; }
        .lspk-total-bar { background: white; border-radius: 14px; border: 2px solid #16A34A; padding: 18px 24px; display: flex; justify-content: space-between; align-items: center; margin-top: 8px; }
        .lspk-total-nums { display: flex; gap: 28px; }

        @media (max-width: 768px) {
          .lspk-wrap { padding: 16px; }
          .lspk-kpi { grid-template-columns: 1fr 1fr; }
          .lspk-kpi-card:last-child { grid-column: span 2; }
          .lspk-cmt-header { padding: 14px 14px; gap: 10px; }
          .lspk-cmt-stats { gap: 12px; }
          .lspk-cmt-stat-value { font-size: 15px; }
          .lspk-detail { padding: 0 14px 16px; }
          .lspk-tbl { font-size: 12px; }
          .lspk-tbl th, .lspk-tbl td { padding: 8px 6px; }
          .lspk-total-bar { flex-direction: column; gap: 12px; align-items: flex-start; padding: 16px; }
          .lspk-total-nums { gap: 20px; }
        }

        @media (max-width: 480px) {
          .lspk-kpi { grid-template-columns: 1fr; }
          .lspk-kpi-card:last-child { grid-column: span 1; }
          .lspk-cmt-stats { gap: 10px; }
          .lspk-cmt-stat:first-child { display: none; }
          .lspk-tbl .hide-mobile { display: none; }
        }
      `}</style>

      <div className="lspk-wrap">
        {/* Page Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: "#0F172A", margin: 0 }}>Laporan Produksi & Kinerja CMT</h1>
          <p style={{ fontSize: 13, color: "#64748B", margin: "4px 0 0 0" }}>Detail gaji, produksi, dan performa setiap mitra CMT.</p>
        </div>

        {/* KPI Cards */}
        <div className="lspk-kpi">
          <div className="lspk-kpi-card">
            <div className="lspk-kpi-icon" style={{ background: "#EFF6FF" }}>
              <CheckCircle size={20} color="#2563EB" />
            </div>
            <div style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>Total Pcs Diselesaikan</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#2563EB", marginTop: 4 }}>
              {stats.totalPcs}<span style={{ fontSize: 12, color: "#94A3B8", marginLeft: 4 }}>pcs</span>
            </div>
          </div>
          <div className="lspk-kpi-card">
            <div className="lspk-kpi-icon" style={{ background: "#FFF7ED" }}>
              <Users size={20} color="#EA580C" />
            </div>
            <div style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>Total CMT Aktif</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#EA580C", marginTop: 4 }}>
              {stats.totalCmtActive}<span style={{ fontSize: 12, color: "#94A3B8", marginLeft: 4 }}>mitra</span>
            </div>
          </div>
          <div className="lspk-kpi-card">
            <div className="lspk-kpi-icon" style={{ background: "#F0FDF4" }}>
              <TrendingUp size={20} color="#16A34A" />
            </div>
            <div style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>CMT Paling Produktif</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#0F172A", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {stats.topVendor.nama}
            </div>
            <div style={{ fontSize: 11, color: "#16A34A", fontWeight: 700 }}>{stats.topVendor.pcs} pcs diselesaikan</div>
          </div>
        </div>

        {/* CMT Cards */}
        {stats.vendorStats.length === 0 ? (
          <div className="lspk-kpi-card" style={{ padding: 48, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}></div>
            <div style={{ fontWeight: 800, color: "#0F172A", marginBottom: 6 }}>Belum ada data CMT</div>
            <div style={{ fontSize: 13, color: "#64748B" }}>Tambahkan vendor bertipe CMT dan buat PO terlebih dahulu.</div>
          </div>
        ) : (
          stats.vendorStats.map((v, i) => {
            const rankStyle = RANK_STYLE[i] || { bg: "#F8FAFC", color: "#94A3B8" };
            const isOpen = expandedId === v.id;
            const breakdownEntries = Object.entries(v.breakdown) as [string, { pcs: number; gaji: number; tarif: number }][];

            return (
              <div key={v.id} className="lspk-cmt-card">
                {/* Header */}
                <div
                  className="lspk-cmt-header"
                  onClick={() => setExpandedId(isOpen ? null : v.id)}
                >
                  <div className="lspk-cmt-badge" style={{ background: rankStyle.bg, color: rankStyle.color }}>
                    #{i + 1}
                  </div>

                  <div className="lspk-cmt-info">
                    <div className="lspk-cmt-name">{v.nama}</div>
                    <div className="lspk-cmt-sub">
                      {v.jenis_default || "CMT"}
                      {" · "}
                      {v.hasKhusus
                        ? <span style={{ color: "#C2410C", fontWeight: 700 }}>Tarif Dinamis per Kategori</span>
                        : <span>Rp {(v.hargaPerPcs || 0).toLocaleString("id-ID")}/pcs</span>
                      }
                    </div>
                  </div>

                  <div className="lspk-cmt-stats">
                    <div className="lspk-cmt-stat">
                      <div className="lspk-cmt-stat-label">Total Pcs</div>
                      <div className="lspk-cmt-stat-value" style={{ color: "#2563EB" }}>
                        {v.pcsSelesai}<span style={{ fontSize: 10, color: "#94A3B8", marginLeft: 2 }}>pcs</span>
                      </div>
                    </div>
                    <div className="lspk-cmt-stat">
                      <div className="lspk-cmt-stat-label">Total Gaji</div>
                      <div className="lspk-cmt-stat-value" style={{ color: "#16A34A" }}>
                        {formatRp(v.estimasiGaji)}
                      </div>
                    </div>
                    <div style={{ color: "#CBD5E1", flexShrink: 0 }}>
                      {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>
                </div>

                {/* Detail */}
                {isOpen && (
                  <div className="lspk-detail">

                    {/* Breakdown per Kategori */}
                    <div className="lspk-section-title">Rincian per Kategori Produk</div>
                    <div style={{ overflowX: "auto" }}>
                      <table className="lspk-tbl">
                        <thead>
                          <tr>
                            <th>Kategori / Model</th>
                            <th className="r hide-mobile">Tarif / Pcs</th>
                            <th className="r">Jumlah Pcs</th>
                            <th className="r">Sub-total Gaji</th>
                          </tr>
                        </thead>
                        <tbody>
                          {breakdownEntries.length === 0 ? (
                            <tr>
                              <td colSpan={4} style={{ textAlign: "center", color: "#94A3B8", padding: 20 }}>
                                Belum ada riwayat pengambilan PO
                              </td>
                            </tr>
                          ) : (
                            breakdownEntries.map(([kat, b], idx) => (
                              <tr key={kat} style={{ background: idx % 2 === 0 ? "white" : "#FAFAFA" }}>
                                <td>
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#EFF6FF", color: "#1D4ED8", padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                                    <Package size={11} /> {kat}
                                  </span>
                                </td>
                                <td className="r hide-mobile" style={{ color: "#64748B", fontWeight: 600 }}>{formatRp(b.tarif)}/pcs</td>
                                <td className="r" style={{ fontWeight: 800, color: "#2563EB" }}>{b.pcs} pcs</td>
                                <td className="r" style={{ fontWeight: 800, color: "#059669" }}>{formatRp(b.gaji)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: "#F0FDF4", borderTop: "2px solid #16A34A" }}>
                            <td colSpan={2} style={{ color: "#15803D" }}>TOTAL</td>
                            <td className="r" style={{ color: "#15803D", fontSize: 15 }}>{v.pcsSelesai} pcs</td>
                            <td className="r" style={{ color: "#15803D", fontSize: 15 }}>{formatRp(v.estimasiGaji)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Riwayat Gaji Real */}
                    {v.gajiByVendor.length > 0 && (
                      <>
                        <div className="lspk-section-title">Riwayat Pencatatan Gaji (Per SPK / PO)</div>
                        <div style={{ overflowX: "auto" }}>
                          <table className="lspk-tbl">
                            <thead>
                              <tr>
                                <th>Tanggal</th>
                                <th className="r">Jumlah Pcs</th>
                                <th className="r">Total Gaji</th>
                              </tr>
                            </thead>
                            <tbody>
                              {v.gajiByVendor.map((g: any, gi: number) => (
                                <tr key={gi}>
                                  <td style={{ color: "#475569" }}>
                                    {new Date(g.tanggal).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                                  </td>
                                  <td className="r" style={{ fontWeight: 700, color: "#2563EB" }}>{g.jumlahPcs} pcs</td>
                                  <td className="r" style={{ fontWeight: 700, color: "#059669" }}>{formatRp(g.totalGaji)}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr style={{ background: "#EFF6FF", borderTop: "1px solid #BFDBFE" }}>
                                <td style={{ color: "#1E40AF" }}>Total Tercatat</td>
                                <td className="r" style={{ color: "#1E40AF" }}>{v.totalPcsReal} pcs</td>
                                <td className="r" style={{ color: "#1E40AF" }}>{formatRp(v.totalGajiReal)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Summary Footer */}
        {stats.vendorStats.length > 0 && (
          <div className="lspk-total-bar">
            <div style={{ fontWeight: 800, fontSize: 15, color: "#15803D" }}>TOTAL SELURUH GAJI CMT</div>
            <div className="lspk-total-nums">
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, color: "#64748B" }}>Total Pcs</div>
                <div style={{ fontWeight: 900, fontSize: 22, color: "#2563EB" }}>
                  {stats.totalPcs}<span style={{ fontSize: 11, color: "#94A3B8", marginLeft: 4 }}>pcs</span>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, color: "#64748B" }}>Total Estimasi Gaji</div>
                <div style={{ fontWeight: 900, fontSize: 22, color: "#16A34A" }}>{formatRp(stats.totalGajiAll)}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
