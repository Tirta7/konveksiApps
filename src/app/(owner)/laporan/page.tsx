"use client";
import { useEffect, useState, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from "recharts";
import { BarChart2, TrendingUp, Store, ShoppingBag, UploadCloud, DollarSign, Wallet, FileX, CreditCard, ChevronRight, Calculator, PieChart } from "lucide-react";
import Papa from "papaparse";
import { toast } from "sonner";

const COLORS = ["#3B82F6","#10B981","#F59E0B","#EF4444","#8B5CF6","#EC4899","#14B8A6","#F97316"];

export default function LaporanPage() {
  const [data, setData] = useState<any[]>([]);
  const _bgRefresh = useRef(false);
  const [keuanganData, setKeuanganData] = useState<{sales: any[], retur: any[], settlement: any[]}>({sales: [], retur: [], settlement: []});
  const [periode, setPeriode] = useState<"minggu" | "bulan">("minggu");
  const [activeTab, setActiveTab] = useState<"produk" | "keuangan">("keuangan");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const fetchData = async () => {
    if (!_bgRefresh.current) setLoading(true);
    try {
      const r1 = await fetch(`/api/laporan?periode=${periode}`);
      const d1 = await r1.json();
      setData(d1);

      // Fetch all data for financial reconciliation
      const [rSales, rRetur, rSettlement] = await Promise.all([
        fetch("/api/penjualan-online"),
        fetch("/api/returns/online"),
        fetch("/api/settlement/online")
      ]);
      const dSales = await rSales.json();
      const dRetur = await rRetur.json();
      const dSettlement = await rSettlement.json();
      setKeuanganData({
        sales: Array.isArray(dSales) ? dSales : (dSales.penjualan_online || []),
        retur: Array.isArray(dRetur) ? dRetur : (dRetur.retur_online || []),
        settlement: dSettlement.settlement_online || []
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [periode]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as any[];
        
        // Filter rows that are actual orders/refunds with Order ID
        const validRows = rows.filter(r => r["ID pesanan terkait"] || r["ID Pesanan/Penyesuaian"]);

        if (validRows.length === 0) {
          toast.error("Format file tidak sesuai. Pastikan Anda mengunggah file Settlement Keuangan TikTok.");
          setUploading(false);
          return;
        }

        const formatted = validRows.map(row => {
          return {
            order_id: row["ID pesanan terkait"] || row["ID Pesanan/Penyesuaian"],
            jenis_transaksi: row["Jenis transaksi"] || "Pesanan",
            pendapatan_kotor: row["Total Pendapatan"] ? row["Total Pendapatan"].replace(/\D/g, '') : 0,
            biaya_komisi: row["Biaya komisi platform"] ? row["Biaya komisi platform"].replace(/[^\d-]/g, '') : 0,
            biaya_afiliasi: row["Komisi Afiliasi"] ? row["Komisi Afiliasi"].replace(/[^\d-]/g, '') : 0,
            biaya_ongkir: row["Ongkir yang ditanggung penjual"] ? row["Ongkir yang ditanggung penjual"].replace(/[^\d-]/g, '') : 0,
            biaya_lainnya: row["Total Biaya"] ? row["Total Biaya"].replace(/[^\d-]/g, '') : 0,
            penyelesaian_pembayaran: row["Jumlah penyelesaian pembayaran"] ? row["Jumlah penyelesaian pembayaran"].replace(/\D/g, '') : 0,
            tanggal_pembayaran: row["Waktu pembayaran pesanan"] || row["Waktu pemesanan"]
          };
        });

        try {
          const res = await fetch("/api/settlement/online", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formatted)
          });
          const json = await res.json();
          if (res.ok) {
            toast.success(`Berhasil memproses ${json.added + json.updated} baris data keuangan.`);
            fetchData();
          } else {
            toast.error(json.error || "Gagal menyimpan data");
          }
        } catch (err) {
          toast.error("Terjadi kesalahan saat mengupload data");
        } finally {
          setUploading(false);
          if (e.target) e.target.value = "";
        }
      }
    });
  };

  // Kalkulasi Rekonsiliasi Keuangan
  // Map settlement records per order_id
  const settlementMap = new Map<string, any>();
  keuanganData.settlement.forEach(s => {
    if (!settlementMap.has(s.order_id)) {
      settlementMap.set(s.order_id, { ...s });
    } else {
      // Aggregate values if multiple adjustments exist for same order
      const existing = settlementMap.get(s.order_id);
      existing.penyelesaian_pembayaran += s.penyelesaian_pembayaran;
      existing.biaya_komisi += s.biaya_komisi;
      existing.biaya_afiliasi += s.biaya_afiliasi;
      existing.biaya_lainnya += s.biaya_lainnya;
    }
  });

  // Map retur records
  const returMap = new Map<string, any>();
  keuanganData.retur.forEach(r => returMap.set(r.order_id, r));

  // Build unified order table
  const unifiedOrders = keuanganData.sales
    .filter(sale => sale.order_id && !sale.order_id.includes("Platform unique"))
    .map(sale => {
    const isRetur = returMap.has(sale.order_id);
    const returData = isRetur ? returMap.get(sale.order_id) : null;
    const settleData = settlementMap.get(sale.order_id);

    const omzetKotor = sale.order_amount;
    const labaBersih = settleData ? settleData.penyelesaian_pembayaran : (isRetur ? 0 : omzetKotor); // Default to omzet kotor if not settled, but 0 if retur
    const potongan = settleData ? Math.abs(settleData.biaya_lainnya || settleData.biaya_komisi || 0) : 0;
    
    return {
      order_id: sale.order_id,
      product: sale.product_name,
      variation: sale.variation,
      tanggal: sale.tanggal_pesanan,
      isRetur,
      statusRetur: returData?.return_type || "",
      omzetKotor,
      labaBersih,
      potongan,
      settleData
    };
  }).sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());

  const totalOmzetKotor = unifiedOrders.reduce((s, o) => s + o.omzetKotor, 0);
  const totalLabaBersih = unifiedOrders.reduce((s, o) => s + (o.isRetur ? 0 : o.labaBersih), 0);
  const totalPotongan = unifiedOrders.reduce((s, o) => s + o.potongan, 0);
  const totalReturLoss = unifiedOrders.reduce((s, o) => s + (o.isRetur ? o.omzetKotor : 0), 0);

  const totalPO = data.reduce((s, d) => s + (d.total_po ?? 0), 0);
  const totalRetail = data.reduce((s, d) => s + (d.total_retail ?? 0), 0);
  const totalAll = totalPO + totalRetail;

  // Real-time sync: refresh data when another admin makes changes
  useEffect(() => {
    window.addEventListener("konveksi-sync", fetchData);
    return () => window.removeEventListener("konveksi-sync", fetchData);
  }, [fetchData]);
  return (
    <>
      <style>{`
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 99px; }
        .table-row-hover:hover { background: #F8FAFC; }
      `}</style>
      
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#F1F5F9", overflow: "hidden" }}>
        
        {/* Fixed Header */}
        <div style={{ padding: "24px 32px", background: "white", borderBottom: "1px solid #E2E8F0", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", marginBottom: 4 }}>Laporan Penjualan</h1>
            <p style={{ fontSize: 13, color: "#64748B" }}>Analisis pesanan, retur, dan rekonsiliasi pencairan dana</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {activeTab === "keuangan" && (
              <label style={{ background: "#2563EB", color: "white", padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 6, cursor: uploading ? "not-allowed" : "pointer", opacity: uploading ? 0.7 : 1, transition: "background 0.2s" }}>
                <UploadCloud size={18} />
                {uploading ? "Memproses..." : "Upload Settlement TikTok (CSV)"}
                <input type="file" accept=".csv" onChange={handleFileUpload} disabled={uploading} style={{ display: "none" }} />
              </label>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ padding: "0 32px", background: "white", borderBottom: "1px solid #E2E8F0", display: "flex", gap: 32, flexShrink: 0 }}>
          <div 
            onClick={() => setActiveTab("keuangan")}
            style={{ padding: "16px 0", cursor: "pointer", borderBottom: activeTab === "keuangan" ? "3px solid #2563EB" : "3px solid transparent", color: activeTab === "keuangan" ? "#2563EB" : "#64748B", fontWeight: 800, fontSize: 14, display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s" }}
          >
            <Calculator size={18}/> Rekonsiliasi Keuangan
          </div>
          <div 
            onClick={() => setActiveTab("produk")}
            style={{ padding: "16px 0", cursor: "pointer", borderBottom: activeTab === "produk" ? "3px solid #2563EB" : "3px solid transparent", color: activeTab === "produk" ? "#2563EB" : "#64748B", fontWeight: 800, fontSize: 14, display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s" }}
          >
            <PieChart size={18}/> Analisis Kategori
          </div>
        </div>

        {/* Scrollable Area */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
          
          {activeTab === "keuangan" ? (
            <>
              {/* Financial Dashboard */}
              <div style={{ display: "flex", gap: 24, marginBottom: 24, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200, background: "white", borderRadius: 24, padding: 24, border: "1px solid #E2E8F0", boxShadow: "0 4px 20px rgba(0,0,0,0.02)", display: "flex", alignItems: "center", gap: 20 }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#EFF6FF", color: "#3B82F6", display: "flex", alignItems: "center", justifyContent: "center" }}><ShoppingBag size={28} /></div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Omzet Kotor</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", lineHeight: 1 }}>Rp {totalOmzetKotor.toLocaleString("id-ID")}</div>
                  </div>
                </div>
                
                <div style={{ flex: 1, minWidth: 200, background: "white", borderRadius: 24, padding: 24, border: "1px solid #E2E8F0", boxShadow: "0 4px 20px rgba(0,0,0,0.02)", display: "flex", alignItems: "center", gap: 20 }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#FEF2F2", color: "#EF4444", display: "flex", alignItems: "center", justifyContent: "center" }}><FileX size={28} /></div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Kerugian Batal/Retur</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: "#EF4444", lineHeight: 1 }}>-Rp {totalReturLoss.toLocaleString("id-ID")}</div>
                  </div>
                </div>
                
                <div style={{ flex: 1, minWidth: 200, background: "white", borderRadius: 24, padding: 24, border: "1px solid #E2E8F0", boxShadow: "0 4px 20px rgba(0,0,0,0.02)", display: "flex", alignItems: "center", gap: 20 }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#FFFBEB", color: "#F59E0B", display: "flex", alignItems: "center", justifyContent: "center" }}><CreditCard size={28} /></div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Potongan Platform</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: "#F59E0B", lineHeight: 1 }}>-Rp {totalPotongan.toLocaleString("id-ID")}</div>
                  </div>
                </div>

                <div style={{ flex: 1, minWidth: 200, background: "white", borderRadius: 24, padding: 24, border: "2px solid #10B981", boxShadow: "0 4px 20px rgba(16,185,129,0.1)", display: "flex", alignItems: "center", gap: 20 }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#ECFDF5", color: "#10B981", display: "flex", alignItems: "center", justifyContent: "center" }}><Wallet size={28} /></div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Pencairan Bersih</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: "#10B981", lineHeight: 1 }}>Rp {totalLabaBersih.toLocaleString("id-ID")}</div>
                  </div>
                </div>
              </div>

              {/* Table */}
              <div style={{ background: "white", borderRadius: 24, border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
                <div style={{ padding: "20px 24px", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <h2 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: 0, marginBottom: 4 }}>Detail Rekonsiliasi Per Pesanan</h2>
                    <p style={{ fontSize: 12, color: "#64748B", margin: 0 }}>Hubungan data antara Penjualan, Retur, dan Settlement Keuangan</p>
                  </div>
                </div>
                <div style={{ overflowX: "auto", maxHeight: "calc(100vh - 350px)" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                    <thead style={{ background: "#F1F5F9", position: "sticky", top: 0, zIndex: 10, boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                      <tr>
                        <th style={{ padding: "12px 24px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", borderBottom: "2px solid #E2E8F0" }}>Order ID & Produk</th>
                        <th style={{ padding: "12px 24px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", borderBottom: "2px solid #E2E8F0" }}>Status Penjualan</th>
                        <th style={{ padding: "12px 24px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", borderBottom: "2px solid #E2E8F0", textAlign: "right" }}>Omzet Kotor</th>
                        <th style={{ padding: "12px 24px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", borderBottom: "2px solid #E2E8F0", textAlign: "right" }}>Potongan (Platform)</th>
                        <th style={{ padding: "12px 24px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", borderBottom: "2px solid #E2E8F0", textAlign: "right" }}>Total Pencairan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontWeight: 600 }}> Memuat data rekonsiliasi...</td></tr>
                      ) : unifiedOrders.length === 0 ? (
                        <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>Belum ada data penjualan atau settlement.</td></tr>
                      ) : (
                        unifiedOrders.slice(0, 100).map((o, i) => (
                          <tr key={i} className="table-row-hover" style={{ borderBottom: "1px solid #F1F5F9", background: o.isRetur ? "#FEF2F2" : "transparent" }}>
                            <td style={{ padding: "16px 24px", maxWidth: 300 }}>
                              <div style={{ fontWeight: 800, fontSize: 13, color: "#0F172A", fontFamily: "monospace" }}>{o.order_id}</div>
                              <div style={{ fontSize: 12, color: "#64748B", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.product} - {o.variation}</div>
                            </td>
                            <td style={{ padding: "16px 24px" }}>
                              {o.isRetur ? (
                                <span style={{ padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 800, background: "#FECACA", color: "#991B1B" }}>RETUR / BATAL</span>
                              ) : (
                                <span style={{ padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 800, background: "#D1FAE5", color: "#065F46" }}>SELESAI</span>
                              )}
                            </td>
                            <td style={{ padding: "16px 24px", textAlign: "right", fontWeight: 700, color: "#334155", fontSize: 14 }}>
                              Rp {o.omzetKotor.toLocaleString("id-ID")}
                            </td>
                            <td style={{ padding: "16px 24px", textAlign: "right", fontWeight: o.potongan > 0 ? 800 : 500, color: o.potongan > 0 ? "#F59E0B" : "#94A3B8", fontSize: 14 }}>
                              {o.potongan > 0 ? `-Rp ${o.potongan.toLocaleString("id-ID")}` : "Belum Settlement"}
                            </td>
                            <td style={{ padding: "16px 24px", textAlign: "right", fontWeight: 900, color: o.isRetur ? "#EF4444" : "#10B981", fontSize: 16 }}>
                              Rp {(o.isRetur ? 0 : o.labaBersih).toLocaleString("id-ID")}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Product Analytics Tab (Old Page) */}
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
                <div style={{ display: "flex", background: "white", border: "1px solid #E2E8F0", padding: 4, borderRadius: 12 }}>
                  <button style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 800, border: "none", cursor: "pointer", transition: "all 0.2s", background: periode === "minggu" ? "#F1F5F9" : "transparent", color: periode === "minggu" ? "#0F172A" : "#64748B" }} onClick={() => setPeriode("minggu")}>Minggu Ini</button>
                  <button style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 800, border: "none", cursor: "pointer", transition: "all 0.2s", background: periode === "bulan" ? "#F1F5F9" : "transparent", color: periode === "bulan" ? "#0F172A" : "#64748B" }} onClick={() => setPeriode("bulan")}>Bulan Ini</button>
                </div>
              </div>

              <div style={{ display: "flex", gap: 24, marginBottom: 24, flexWrap: "wrap" }}>
                {/* Stat Cards */}
                <div style={{ flex: 1, minWidth: 200, background: "white", borderRadius: 24, padding: 24, border: "1px solid #E2E8F0", boxShadow: "0 4px 20px rgba(0,0,0,0.02)", display: "flex", alignItems: "center", gap: 20 }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#F3F4F6", color: "#4B5563", display: "flex", alignItems: "center", justifyContent: "center" }}><TrendingUp size={28} /></div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Total Penjualan</div>
                    <div style={{ fontSize: 32, fontWeight: 900, color: "#1F2937", lineHeight: 1 }}>{totalAll} <span style={{fontSize: 14, color:"#94A3B8"}}>pcs</span></div>
                  </div>
                </div>
                
                <div style={{ flex: 1, minWidth: 200, background: "white", borderRadius: 24, padding: 24, border: "1px solid #E2E8F0", boxShadow: "0 4px 20px rgba(0,0,0,0.02)", display: "flex", alignItems: "center", gap: 20 }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#EFF6FF", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center" }}><ShoppingBag size={28} /></div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>PO Online</div>
                    <div style={{ fontSize: 32, fontWeight: 900, color: "#2563EB", lineHeight: 1 }}>{totalPO} <span style={{fontSize: 14, color:"#94A3B8"}}>pcs</span></div>
                  </div>
                </div>
                
                <div style={{ flex: 1, minWidth: 200, background: "white", borderRadius: 24, padding: 24, border: "1px solid #E2E8F0", boxShadow: "0 4px 20px rgba(0,0,0,0.02)", display: "flex", alignItems: "center", gap: 20 }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}><Store size={28} /></div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Retail Offline</div>
                    <div style={{ fontSize: 32, fontWeight: 900, color: "#059669", lineHeight: 1 }}>{totalRetail} <span style={{fontSize: 14, color:"#94A3B8"}}>pcs</span></div>
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
                
                {/* Grafik */}
                <div style={{ background: "white", borderRadius: 24, border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
                  <div style={{ padding: "20px 24px", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", alignItems: "center", gap: 10 }}>
                    <BarChart2 size={20} color="#3B82F6" />
                    <h2 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: 0 }}>Grafik Perbandingan Penjualan</h2>
                  </div>
                  <div style={{ padding: 24 }}>
                    {loading ? (
                      <div style={{ height: 320, display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", fontWeight: 600 }}> Memuat grafik...</div>
                    ) : data.length === 0 ? (
                      <div style={{ height: 320, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#94A3B8" }}>
                        <div style={{ fontSize: 48, marginBottom: 16 }}></div>
                        <div style={{ fontWeight: 800, color: "#0F172A" }}>Belum ada data penjualan</div>
                        <div style={{ fontSize: 13, marginTop: 4 }}>Data akan muncul di sini setelah ada PO / retail</div>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={320}>
                        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                          <XAxis dataKey="kategori" tick={{ fontSize: 12, fill: "#64748B", fontWeight: 600 }} angle={-25} textAnchor="end" interval={0} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 12, fill: "#64748B", fontWeight: 600 }} axisLine={false} tickLine={false} />
                          <RechartsTooltip 
                            formatter={(v: any, name: any) => [`${v} pcs`, name === "total_po" ? "PO Online" : name === "total_retail" ? "Retail Offline" : "Total"]}
                            labelStyle={{ fontWeight: 800, color: "#0F172A", marginBottom: 4 }} 
                            contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 10px 30px rgba(0,0,0,0.1)", padding: "12px 16px" }} 
                          />
                          <Bar dataKey="total_po" name="PO Online" stackId="a" fill="#3B82F6" radius={[0,0,0,0]} barSize={32} />
                          <Bar dataKey="total_retail" name="Retail" stackId="a" fill="#10B981" radius={[8,8,0,0]} barSize={32} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Tabel Peringkat */}
                <div style={{ background: "white", borderRadius: 24, border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column", height: 418 }}>
                  <div style={{ padding: "20px 24px", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC" }}>
                    <h2 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: 0, marginBottom: 4 }}>Peringkat Kategori Terlaris</h2>
                    <p style={{ fontSize: 12, color: "#64748B", margin: 0 }}>Rekomendasi untuk penentuan batch produksi berikutnya</p>
                  </div>
                  <div style={{ flex: 1, overflowY: "auto" }}>
                    {loading ? (
                      <div style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontWeight: 600 }}> Memuat peringkat...</div>
                    ) : data.length === 0 ? (
                      <div style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>Belum ada data.</div>
                    ) : (
                      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                        <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                          <tr style={{ background: "#F1F5F9" }}>
                            <th style={{ padding: "12px 20px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", borderBottom: "2px solid #E2E8F0" }}>Rank</th>
                            <th style={{ padding: "12px 20px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", borderBottom: "2px solid #E2E8F0" }}>Kategori</th>
                            <th style={{ padding: "12px 20px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", borderBottom: "2px solid #E2E8F0" }}>PO</th>
                            <th style={{ padding: "12px 20px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", borderBottom: "2px solid #E2E8F0" }}>Retail</th>
                            <th style={{ padding: "12px 20px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", borderBottom: "2px solid #E2E8F0" }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.map((d, i) => (
                            <tr key={d.kategori} className="table-row-hover" style={{ background: i === 0 ? "#FFFBEB" : "transparent", borderBottom: "1px solid #F1F5F9" }}>
                              <td style={{ padding: "16px 20px", fontWeight: 900, fontSize: 18, color: i === 0 ? "#D97706" : i === 1 ? "#94A3B8" : i === 2 ? "#B45309" : "#CBD5E1" }}>
                                {i === 0 ? "" : i === 1 ? "" : i === 2 ? "" : `#${i + 1}`}
                              </td>
                              <td style={{ padding: "16px 20px", fontWeight: 800, fontSize: 14, color: "#0F172A" }}>{d.kategori}</td>
                              <td style={{ padding: "16px 20px", fontWeight: 700, color: "#3B82F6", fontSize: 13 }}>{d.total_po ?? 0}</td>
                              <td style={{ padding: "16px 20px", fontWeight: 700, color: "#10B981", fontSize: 13 }}>{d.total_retail ?? 0}</td>
                              <td style={{ padding: "16px 20px", fontWeight: 900, color: "#0F172A", fontSize: 16 }}>{d.total}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

      </div>
    </>
  );
}

