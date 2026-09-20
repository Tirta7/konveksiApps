"use client";

import { useState, useEffect } from "react";
import { UploadCloud, Search, ShoppingCart, User, FileText, ChevronRight, CreditCard, Box, Calendar, Truck, MapPin, TableIcon, BarChart2, X, Eye, Clock } from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";

export default function PenjualanOnlinePage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterTipe, setFilterTipe] = useState("Semua");
  const [viewMode, setViewMode] = useState<"table" | "summary">("table");
  const [selectedPenjualan, setSelectedPenjualan] = useState<any | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/penjualan-online");
      const json = await res.json();
      setData(json);
    } catch (err) {
      toast.error("Gagal mengambil data penjualan online");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as any[];
        
        // Exclude cancelled/refunded orders. We only want Selesai or Dikirim.
        const filtered = rows.filter(row => {
          const status = (row["Order Status"] || row["Status Pesanan"])?.toLowerCase() || "";
          const cancelType = (row["Cancelation/Return Type"] || row["Alasan Pembatalan"])?.toLowerCase() || "";
          const orderId = row["Order ID"] || row["ID Pesanan"];
          
          if (!orderId || orderId.includes("Platform unique")) return false;
          if (status.includes("batal") || status.includes("cancel") || cancelType.includes("cancel") || cancelType.includes("return")) {
            return false;
          }
          return true;
        });

        if (filtered.length === 0) {
          toast.info("Tidak ditemukan pesanan yang valid (selain batal) di file ini.");
          setUploading(false);
          return;
        }

        const formatted = filtered.map(row => {
          return {
            order_id: row["Order ID"] || row["No. Pesanan"],
            status: row["Order Status"] || row["Status Pesanan"] || "Unknown",
            product_name: row["Product Name"] || row["Nama Produk"],
            variation: row["Variation"] || row["Nama Variasi"],
            quantity: parseInt(row["Quantity"] || row["Jumlah"]) || 1,
            order_amount: row["Order Amount"] || row["Total Harga Produk"] || row["Total Harga Pembeli"],
            seller_sku: row["Seller SKU"] || row["Nomor Referensi SKU"],
            buyer_username: row["Buyer Username"] || row["Username (Pembeli)"],
            recipient: row["Recipient"] || row["Nama Penerima"],
            tanggal_pesanan: row["Created Time"] || row["Waktu Pesanan Dibuat"],
            phone: row["Phone #"] || row["No. Telepon"],
            address: row["Detail Address"] || row["Alamat Lengkap"],
            city: row["Regency and City"] || row["Kota/Kabupaten"],
            province: row["Province"] || row["Provinsi"],
            tracking_id: row["Tracking ID"] || row["No. Resi"],
            shipping_provider: row["Shipping Provider Name"] || row["Opsi Pengiriman"],
            payment_method: row["Payment Method"] || "Transfer",
            tipe_pesanan: row["Normal or Pre-order"] || "Normal",
            jatuh_tempo: row["RTS Time"] || row["RTS SLA"] || row["Ship by Date"] || row["Batas Waktu Pengiriman"] || row["Ship By Date"] || ""
          };
        });

        try {
          const res = await fetch("/api/penjualan-online", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formatted)
          });
          const json = await res.json();
          if (res.ok) {
            toast.success(`Berhasil mengimpor ${json.added} pesanan baru. Memotong stok untuk ${json.deducted} item.`);
            fetchData();
          } else {
            toast.error(json.error || "Gagal menyimpan data");
          }
        } catch (err) {
          toast.error("Terjadi kesalahan saat menyimpan data");
        } finally {
          setUploading(false);
        }
      },
      error: () => {
        toast.error("Gagal membaca file CSV");
        setUploading(false);
      }
    });
  };

  const filteredData = data.filter(d => 
    (!d.order_id || !d.order_id.includes("Platform unique")) &&
    (filterTipe === "Semua" || d.tipe_pesanan === filterTipe || (filterTipe === "Normal" && !d.tipe_pesanan)) &&
    (d.order_id?.toLowerCase().includes(search.toLowerCase()) || 
    d.product_name?.toLowerCase().includes(search.toLowerCase()) ||
    d.buyer_username?.toLowerCase().includes(search.toLowerCase()) ||
    d.seller_sku?.toLowerCase().includes(search.toLowerCase()))
  );

  const totalPesanan = data.length;
  const totalProduk = data.reduce((sum, d) => sum + (d.quantity || 1), 0);
  const totalPendapatan = data.reduce((sum, d) => sum + parseInt(d.order_amount || "0"), 0);

  const productCount: Record<string, number> = {};
  const provinceCount: Record<string, number> = {};
  const courierCount: Record<string, number> = {};

  data.forEach(d => {
    if (d.seller_sku) productCount[d.seller_sku] = (productCount[d.seller_sku] || 0) + (d.quantity || 1);
    if (d.province) provinceCount[d.province] = (provinceCount[d.province] || 0) + 1;
    if (d.shipping_provider) courierCount[d.shipping_provider] = (courierCount[d.shipping_provider] || 0) + 1;
  });

  const getTop = (obj: Record<string, number>) => Object.entries(obj).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";

  const topProduct = getTop(productCount);
  const topProvince = getTop(provinceCount);
  const topProdukList = Object.entries(productCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topProvinsiList = Object.entries(provinceCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topKurirList = Object.entries(courierCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const computeJatuhTempo = (waktuPesanan: string, tipe: string) => {
    if (!waktuPesanan) return "-";
    const parts = waktuPesanan.split(" ");
    if (parts.length !== 2) return "-";
    
    const dateParts = parts[0].split("/");
    const timeParts = parts[1].split(":");
    
    if (dateParts.length !== 3 || timeParts.length !== 3) return "-";
    
    const dateObj = new Date(
      parseInt(dateParts[2]), 
      parseInt(dateParts[1]) - 1, 
      parseInt(dateParts[0]), 
      parseInt(timeParts[0]), 
      parseInt(timeParts[1]), 
      parseInt(timeParts[2])
    );
    
    if (isNaN(dateObj.getTime())) return "-";
    
    const daysToAdd = tipe === "Pre-order" ? 7 : 2;
    dateObj.setDate(dateObj.getDate() + daysToAdd);
    
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(dateObj.getDate())}/${pad(dateObj.getMonth() + 1)}/${dateObj.getFullYear()} ${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}:${pad(dateObj.getSeconds())}`;
  };

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
        
        <div style={{ padding: "24px 32px", background: "white", borderBottom: "1px solid #E2E8F0", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", marginBottom: 4 }}>Penjualan Online</h1>
            <p style={{ fontSize: 13, color: "#64748B" }}>Integrasi laporan CSV pesanan (TikTok, Shopee, dll) untuk memotong stok.</p>
          </div>
          <div>
            <label style={{ background: "#10B981", color: "white", padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 6, cursor: uploading ? "not-allowed" : "pointer", opacity: uploading ? 0.7 : 1, boxShadow: "0 4px 10px rgba(16, 185, 129, 0.2)", transition: "all 0.2s" }}>
              <UploadCloud size={18} />
              {uploading ? "Memproses..." : "Upload Pesanan CSV"}
              <input type="file" accept=".csv" onChange={handleFileUpload} disabled={uploading} style={{ display: "none" }} />
            </label>
          </div>
        </div>

        <div style={{ padding: "16px 32px", background: "white", borderBottom: "1px solid #E2E8F0", flexShrink: 0, display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", background: "#F8FAFC", border: "1px solid #CBD5E1", borderRadius: 10, padding: "0 14px", maxWidth: 400 }}>
            <Search size={18} color="#94A3B8" />
            <input 
              style={{ flex: 1, padding: "10px 12px", background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#0F172A" }} 
              placeholder="Cari Order ID, Pembeli, atau Produk..." 
              value={search} onChange={e => setSearch(e.target.value)} 
            />
          </div>
          <select 
            value={filterTipe} 
            onChange={(e) => setFilterTipe(e.target.value)}
            style={{ padding: "10px 14px", background: "#F8FAFC", border: "1px solid #CBD5E1", borderRadius: 10, fontSize: 13, fontWeight: 700, color: "#334155", outline: "none", cursor: "pointer" }}
          >
            <option value="Semua">Semua Tipe</option>
            <option value="Normal">Normal</option>
            <option value="Pre-order">Pre-order</option>
          </select>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto", background: "#E2E8F0", padding: 4, borderRadius: 10 }}>
            <button onClick={() => setViewMode("table")} style={{ padding: "6px 12px", fontSize: 12, fontWeight: 800, borderRadius: 8, background: viewMode === "table" ? "white" : "transparent", color: viewMode === "table" ? "#0F172A" : "#64748B", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, boxShadow: viewMode === "table" ? "0 2px 4px rgba(0,0,0,0.05)" : "none", transition: "all 0.2s" }}>
              <TableIcon size={14} /> Daftar Data
            </button>
            <button onClick={() => setViewMode("summary")} style={{ padding: "6px 12px", fontSize: 12, fontWeight: 800, borderRadius: 8, background: viewMode === "summary" ? "white" : "transparent", color: viewMode === "summary" ? "#0F172A" : "#64748B", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, boxShadow: viewMode === "summary" ? "0 2px 4px rgba(0,0,0,0.05)" : "none", transition: "all 0.2s" }}>
              <BarChart2 size={14} /> Rekapan
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflow: "hidden", display: "flex", position: "relative" }}>
          {/* Main List Area */}
          <div style={{ flex: 1, padding: "24px 32px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ flex: 1, background: "white", borderRadius: 20, border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column" }}>
            
            {loading ? (
              <div style={{ padding: 60, textAlign: "center", color: "#94A3B8" }}> Memuat data...</div>
            ) : viewMode === "summary" ? (
              <div style={{ padding: "32px", overflow: "auto", flex: 1, background: "#F8FAFC" }}>
                <div style={{ marginBottom: 24 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 900, color: "#0F172A", marginBottom: 6 }}>Rekapan Data Penjualan</h2>
                  <p style={{ fontSize: 13, color: "#64748B" }}>Ringkasan singkat performa penjualan dari seluruh pesanan online.</p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginBottom: 32 }}>
                  <div style={{ background: "white", padding: 24, borderRadius: 16, border: "1px solid #E2E8F0", display: "flex", alignItems: "center", gap: 20, boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}>
                    <div style={{ width: 64, height: 64, borderRadius: 16, background: "#EFF6FF", color: "#3B82F6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <ShoppingCart size={32} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Total Pesanan</div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", display: "flex", alignItems: "baseline", gap: 8 }}>
                        {totalPesanan} <span style={{ fontSize: 14, fontWeight: 700, color: "#94A3B8" }}>invoice</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ background: "white", padding: 24, borderRadius: 16, border: "1px solid #E2E8F0", display: "flex", alignItems: "center", gap: 20, boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}>
                    <div style={{ width: 64, height: 64, borderRadius: 16, background: "#FFFBEB", color: "#F59E0B", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Box size={32} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Produk Terjual</div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", display: "flex", alignItems: "baseline", gap: 8 }}>
                        {totalProduk} <span style={{ fontSize: 14, fontWeight: 700, color: "#94A3B8" }}>pcs</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ background: "white", padding: 24, borderRadius: 16, border: "1px solid #E2E8F0", display: "flex", alignItems: "center", gap: 20, boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}>
                    <div style={{ width: 64, height: 64, borderRadius: 16, background: "#ECFDF5", color: "#10B981", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <CreditCard size={32} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Total Pendapatan</div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: "#0F172A" }}>
                        <span style={{ fontSize: 14, color: "#64748B", marginRight: 4 }}>Rp</span>
                        {totalPendapatan.toLocaleString("id-ID")}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                  {/* Top Produk */}
                  <div style={{ background: "white", borderRadius: 16, border: "1px solid #E2E8F0", overflow: "hidden" }}>
                    <div style={{ padding: "16px 20px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", fontSize: 13, fontWeight: 800, color: "#334155" }}>
                      Produk Paling Banyak Terjual
                    </div>
                    <div style={{ padding: 20 }}>
                      {topProdukList.length === 0 ? <div style={{ color: "#94A3B8", fontSize: 13 }}>Belum ada data</div> : null}
                      {topProdukList.map(([name, count], i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: i === topProdukList.length - 1 ? "none" : "1px dashed #E2E8F0" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", flex: 1, paddingRight: 16 }}>{name}</div>
                          <div style={{ fontSize: 13, fontWeight: 900, color: "#F59E0B" }}>{count}x</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                    {/* Top Provinsi */}
                    <div style={{ background: "white", borderRadius: 16, border: "1px solid #E2E8F0", overflow: "hidden" }}>
                      <div style={{ padding: "16px 20px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", fontSize: 13, fontWeight: 800, color: "#334155" }}>
                        Sebaran Provinsi Pembeli
                      </div>
                      <div style={{ padding: 20 }}>
                        {topProvinsiList.length === 0 ? <div style={{ color: "#94A3B8", fontSize: 13 }}>Belum ada data</div> : null}
                        {topProvinsiList.map(([name, count], i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>{name || "Tidak diketahui"}</div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: "#10B981" }}>{count} order</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Top Kurir */}
                    <div style={{ background: "white", borderRadius: 16, border: "1px solid #E2E8F0", overflow: "hidden" }}>
                      <div style={{ padding: "16px 20px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", fontSize: 13, fontWeight: 800, color: "#334155" }}>
                        Ekspedisi Terpopuler
                      </div>
                      <div style={{ padding: 20 }}>
                        {topKurirList.length === 0 ? <div style={{ color: "#94A3B8", fontSize: 13 }}>Belum ada data</div> : null}
                        {topKurirList.map(([name, count], i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>{name || "Tidak diketahui"}</div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: "#3B82F6" }}>{count} order</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : filteredData.length === 0 ? (
              <div style={{ padding: 60, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <ShoppingCart size={48} color="#CBD5E1" style={{ marginBottom: 16 }} />
                <div style={{ fontSize: 16, fontWeight: 800, color: "#334155", marginBottom: 8 }}>Belum ada data pesanan</div>
                <div style={{ fontSize: 14, color: "#94A3B8", maxWidth: 300, lineHeight: 1.5 }}>Silakan upload laporan CSV dari platform (cth: TikTok) untuk menarik data dan memotong stok gudang.</div>
              </div>
            ) : (
              <div style={{ flex: 1, overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead style={{ position: "sticky", top: 0, zIndex: 10, background: "white" }}>
                    <tr style={{ borderBottom: "2px solid #E2E8F0" }}>
                      <th style={{ padding: "16px 20px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 }}>Order ID & Waktu</th>
                      <th style={{ padding: "16px 20px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 }}>Pembeli</th>
                      <th style={{ padding: "16px 20px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 }}>Produk (Seller SKU)</th>
                      <th style={{ padding: "16px 20px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 }}>Nominal</th>
                      <th style={{ padding: "16px 20px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.slice().reverse().map(d => {
                      const isSelected = selectedPenjualan?.id === d.id;
                      return (
                      <tr key={d.id} className="table-row-hover" onClick={() => setSelectedPenjualan(d)} style={{ borderBottom: "1px solid #F1F5F9", background: isSelected ? "#F8FAFC" : "transparent", cursor: "pointer", transition: "background 0.2s" }}>
                        <td style={{ padding: "16px 20px" }}>
                          <div style={{ fontWeight: 800, fontSize: 13, color: "#0F172A", fontFamily: "monospace", display: "flex", alignItems: "center", gap: 8 }}>
                            {d.order_id}
                          </div>
                          <div style={{ fontSize: 11, color: "#64748B", marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
                            <Calendar size={12}/> Psn: {d.tanggal_pesanan || "-"}
                          </div>
                          <div style={{ fontSize: 11, color: d.tipe_pesanan === "Pre-order" ? "#D97706" : "#64748B", marginTop: 2, display: "flex", alignItems: "center", gap: 4, fontWeight: d.tipe_pesanan === "Pre-order" ? 700 : 400 }}>
                            <Clock size={12}/> SLA: {computeJatuhTempo(d.tanggal_pesanan, d.tipe_pesanan)}
                          </div>
                        </td>
                        <td style={{ padding: "16px 20px", maxWidth: 180 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: "#334155", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.recipient}</div>
                          <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>@{d.buyer_username}</div>
                        </td>
                        <td style={{ padding: "16px 20px", maxWidth: 280 }}>
                          <div style={{ fontWeight: 800, fontSize: 13, color: "#1D4ED8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.seller_sku} <span style={{color: "#0F172A"}}>x{d.quantity}</span></div>
                          <div style={{ fontSize: 12, color: "#64748B", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.variation}</div>
                        </td>
                        <td style={{ padding: "16px 20px" }}>
                          <div style={{ fontWeight: 800, fontSize: 13, color: "#10B981" }}>Rp {parseInt(d.order_amount || "0").toLocaleString("id-ID")}</div>
                        </td>
                        <td style={{ padding: "16px 20px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
                            <span style={{ 
                              padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 800, letterSpacing: 0.5,
                              background: d.status === "Selesai" ? "#DCFCE7" : d.status === "Dikirim" ? "#DBEAFE" : "#F1F5F9",
                              color: d.status === "Selesai" ? "#047857" : d.status === "Dikirim" ? "#1D4ED8" : "#475569"
                            }}>
                              {d.status}
                            </span>
                            {(d.tipe_pesanan === "Pre-order") && (
                              <span style={{ background: "#FEF3C7", color: "#D97706", padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 800, border: "1px solid #FDE68A" }}>PRE-ORDER</span>
                            )}
                            {(!d.tipe_pesanan || d.tipe_pesanan === "Normal") && (
                              <span style={{ background: "#F1F5F9", color: "#64748B", padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, border: "1px solid #E2E8F0" }}>NORMAL</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Detail Drawer */}
        <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 400, background: "white", borderLeft: "1px solid #E2E8F0", boxShadow: "-4px 0 24px rgba(0,0,0,0.05)", transform: selectedPenjualan ? "translateX(0)" : "translateX(100%)", transition: "transform 0.3s cubic-bezier(0.16,1,0.3,1)", display: "flex", flexDirection: "column", zIndex: 20 }}>
          {selectedPenjualan && (
            <>
              <div style={{ padding: "24px", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#10B981", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Detail Pesanan</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#0F172A", fontFamily: "monospace" }}>{selectedPenjualan.order_id}</div>
                </div>
                <button onClick={() => setSelectedPenjualan(null)} style={{ background: "white", border: "1px solid #E2E8F0", width: 32, height: 32, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B" }}>
                  <ChevronRight size={16} />
                </button>
              </div>
              
              <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
                <div style={{ marginBottom: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div style={{ background: "white", padding: 12, borderRadius: 12, border: "1px solid #E2E8F0" }}>
                    <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><Calendar size={12}/> Waktu Pesanan</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginTop: 4 }}>{selectedPenjualan.tanggal_pesanan || "-"}</div>
                  </div>
                  <div style={{ background: selectedPenjualan.tipe_pesanan === "Pre-order" ? "#FFFBEB" : "white", padding: 12, borderRadius: 12, border: selectedPenjualan.tipe_pesanan === "Pre-order" ? "1px solid #FDE68A" : "1px solid #E2E8F0" }}>
                    <div style={{ fontSize: 11, color: selectedPenjualan.tipe_pesanan === "Pre-order" ? "#D97706" : "#64748B", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><Clock size={12}/> Jatuh Tempo / SLA</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: selectedPenjualan.tipe_pesanan === "Pre-order" ? "#92400E" : "#0F172A", marginTop: 4 }}>
                      {computeJatuhTempo(selectedPenjualan.tanggal_pesanan, selectedPenjualan.tipe_pesanan)}
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                    <FileText size={16}/> Informasi Produk
                  </div>
                  <div style={{ background: "#F8FAFC", padding: 16, borderRadius: 12, border: "1px solid #E2E8F0" }}>
                    <div style={{ fontWeight: 800, color: "#0F172A", fontSize: 14, marginBottom: 4 }}>{selectedPenjualan.product_name}</div>
                    <div style={{ color: "#3B82F6", fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{selectedPenjualan.variation}</div>
                    <div style={{ display: "flex", gap: 16, borderTop: "1px dashed #CBD5E1", paddingTop: 12 }}>
                      <div>
                        <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>Quantity</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>{selectedPenjualan.quantity} pcs</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>Seller SKU</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#1D4ED8" }}>{selectedPenjualan.seller_sku}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                    <User size={16}/> Info Pembeli
                  </div>
                  <div style={{ background: "white", padding: 16, borderRadius: 12, border: "1px solid #E2E8F0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>Penerima</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{selectedPenjualan.recipient}</div>
                      <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>{selectedPenjualan.phone || "-"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>Username</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>@{selectedPenjualan.buyer_username}</div>
                    </div>
                    <div style={{ gridColumn: "span 2", borderTop: "1px dashed #E2E8F0", paddingTop: 16 }}>
                      <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>Alamat Pengiriman</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", marginTop: 4 }}>{selectedPenjualan.city}, {selectedPenjualan.province}</div>
                      <div style={{ fontSize: 12, color: "#64748B", marginTop: 2, lineHeight: 1.5 }}>{selectedPenjualan.address}</div>
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                    <Truck size={16}/> Ekspedisi & Resi
                  </div>
                  <div style={{ background: "white", padding: 16, borderRadius: 12, border: "1px solid #E2E8F0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>Kurir</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{selectedPenjualan.shipping_provider || "-"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>No. Resi</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{selectedPenjualan.tracking_id || "-"}</div>
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                    <CreditCard size={16}/> Pembayaran & Status
                  </div>
                  <div style={{ background: "white", padding: 16, borderRadius: 12, border: "1px solid #E2E8F0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>Metode</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#1D4ED8" }}>{selectedPenjualan.payment_method || "-"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>Total Dibayar</div>
                      <div style={{ fontSize: 14, fontWeight: 900, color: "#10B981" }}>Rp {parseInt(selectedPenjualan.order_amount || "0").toLocaleString("id-ID")}</div>
                    </div>
                  </div>
                </div>
                
                <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#991B1B", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                    <Box size={14}/> Potong Stok Gudang
                  </div>
                  <div style={{ fontSize: 12, color: "#B91C1C", lineHeight: 1.5 }}>
                    Stok gudang untuk barang <b>{selectedPenjualan.seller_sku}</b> telah dikurangi sebanyak <b>{selectedPenjualan.quantity} pcs</b> pada {new Date(selectedPenjualan.tanggal_diimpor).toLocaleDateString("id-ID", {dateStyle: "medium"})}.
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      </div>
    </>
  );
}
