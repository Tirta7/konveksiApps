"use client";
import React, { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import Barcode from "react-barcode";

export default function BarcodeProduksiPage() {
  const [barcodes, setBarcodes] = useState<any[]>([]);
  const [poList, setPoList] = useState<{id: string; noPo: string; total: number}[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPoId, setSelectedPoId] = useState<string>("");
  const [selectedBarcode, setSelectedBarcode] = useState<any | null>(null);

  // Status display config
  const getStatusInfo = (status: string) => {
    switch (status) {
      case "siap_jual":  return { label: "SIAP CETAK",    color: "#22C55E", border: "#22C55E", opacity: 1,    clickable: true };
      case "gudang":     return { label: "GUDANG",        color: "#3B82F6", border: "#3B82F6", opacity: 1,    clickable: false };
      case "benang":     return { label: "BERSIH BENANG", color: "#F59E0B", border: "#F59E0B", opacity: 1,    clickable: false };
      case "washing":    return { label: "WASHING",       color: "#06B6D4", border: "#06B6D4", opacity: 1,    clickable: false };
      case "finishing":  return { label: "FINISHING",     color: "#10B981", border: "#10B981", opacity: 1,    clickable: false };
      case "cmt":        return { label: "JAHIT SELESAI", color: "#8B5CF6", border: "#8B5CF6", opacity: 1,    clickable: false };
      case "potong":     return { label: "PROSES JAHIT",  color: "#64748B", border: "#94A3B8", opacity: 0.9,  clickable: false };
      default:           return { label: "BELUM QC",      color: "#94A3B8", border: "#CBD5E1", opacity: 0.6,  clickable: false };
    }
  };

  const fetchData = () => {
    fetch("/api/barcode")
      .then(r => r.json())
      .then(data => {
        setBarcodes(data);
        const poMap = new Map<string, {id: string; noPo: string; total: number}>();
        data.forEach((b: any) => {
          const key = String(b.poId);
          if (!poMap.has(key)) {
            poMap.set(key, { id: key, noPo: b.noPo, total: 0 });
          }
          poMap.get(key)!.total++;
        });
        const list = Array.from(poMap.values());
        setPoList(list);
        if (list.length > 0 && !selectedPoId) setSelectedPoId(list[0].id);
      })
      .catch(() => { /* server sedang restart, abaikan */ })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPoId]);

  useEffect(() => {
    window.addEventListener("afterprint", () => document.body.classList.remove('printing-single'));
    return () => {};
  }, []);

  // Real-time sync: instant refresh when another admin makes a change
  useEffect(() => {
    const handler = () => fetchData();
    window.addEventListener("konveksi-sync", handler);
    return () => window.removeEventListener("konveksi-sync", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePrint = () => {
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handlePrintSingle = () => {
    document.body.classList.add('printing-single');
    setTimeout(() => {
      window.print();
    }, 100);
  };

  // Listen to print end to reset print target and class
  useEffect(() => {
    const afterPrint = () => {
      setSelectedBarcode(null);
      document.body.classList.remove('printing-single');
    };
    window.addEventListener("afterprint", afterPrint);
    return () => window.removeEventListener("afterprint", afterPrint);
  }, []);


  if (loading) return <div className="empty-state">⏳ Memuat Barcode...</div>;

  const filteredBarcodes = barcodes.filter(b => String(b.poId) === selectedPoId);
  const selectedPoInfo = poList.find(p => p.id === selectedPoId);

  const groupedBySize = filteredBarcodes.reduce((acc, b) => {
    if (!acc[b.size]) acc[b.size] = [];
    acc[b.size].push(b);
    return acc;
  }, {} as any);
  
  const sizeList = Object.keys(groupedBySize);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-app)" }}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; display: block !important; background: white !important; padding: 0 !important; }
          .barcode-grid { display: grid !important; grid-template-columns: repeat(3, 1fr) !important; gap: 10px !important; }
          .no-print { display: none !important; }
          .barcode-card { border: 1px solid #000 !important; box-shadow: none !important; margin-bottom: 0 !important; page-break-inside: avoid; }
          .size-section { page-break-inside: avoid; margin-bottom: 20px; }
          .print-header { display: block !important; text-align: center; font-weight: bold; font-size: 18px; margin-bottom: 10px; border-bottom: 2px solid #000; padding-bottom: 5px; }
          .size-header { display: block !important; font-weight: bold; font-size: 16px; margin-top: 15px; margin-bottom: 10px; text-decoration: underline; }
          
          /* Hide modal during normal "Cetak Semua" print */
          body:not(.printing-single) .hide-on-normal-print { display: none !important; }

          /* Single Print Overrides */
          .hide-on-single-print { display: none !important; }
          
          /* Jika modal sedang aktif, set page khusus stiker 5x3 cm */
          body.printing-single .print-single-area, body.printing-single .print-single-area * { visibility: visible; }
          body.printing-single .print-single-area { 
            position: absolute; left: 0; top: 0; 
            width: 5cm !important; 
            height: 3cm !important; 
            background: white !important; 
            margin: 0 !important; padding: 0 !important; 
            display: flex; align-items: center; justify-content: center;
          }
          
          body.printing-single .print-single-area .print-target-card { width: 4.8cm !important; height: 2.8cm !important; padding: 0.1cm 0.15cm !important; margin: 0 !important; border: 1px solid #000 !important; }
          body.printing-single .print-single-area .print-size-box { width: 0.7cm !important; height: 0.7cm !important; font-size: 10pt !important; border-width: 1px !important; }
          body.printing-single .print-single-area .print-model-text { font-size: 11pt !important; margin-bottom: 0 !important; letter-spacing: 0 !important; }
          body.printing-single .print-single-area .print-detail-text { font-size: 6pt !important; }
          body.printing-single .print-single-area .print-divider { margin-bottom: 2% !important; height: 1px !important; }
          body.printing-single .print-single-area .print-barcode-svg svg { width: 100% !important; height: 1.1cm !important; }
          
          body.printing-single .modal-overlay { background: none; }
          body.printing-single .modal-box { box-shadow: none; padding: 0; margin: 0; }
          body.printing-single .modal-header, body.printing-single .modal-footer { display: none !important; }
        }
        
        @page {
          size: auto;
        }
        
        @page single-sticker {
          size: 5cm 3cm;
          margin: 0;
        }

        @media print {
          body.printing-single {
            page: single-sticker;
          }
        }

        .print-header { display: none; }
        .size-header { display: none; }
      `}</style>
      
      <div className="page-header no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexShrink: 0, padding: 32, paddingBottom: 16 }}>
        <div>
          <h1 className="page-title">Data Barcode Item (Tahap Potong)</h1>
          <p className="page-subtitle">Barcode di-generate otomatis untuk setiap piece pakaian saat PO Produksi diterbitkan.</p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ background: "white", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-color)", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)" }}>Pilih PO:</span>
            <select style={{ border: "none", outline: "none", background: "transparent", fontSize: 14, fontWeight: 800, color: "var(--text-primary)", cursor: "pointer" }} value={selectedPoId} onChange={e => setSelectedPoId(e.target.value)}>
              {poList.length === 0 && <option value="">Belum ada PO</option>}
              {poList.map(po => <option key={po.id} value={po.id}>{po.noPo} ({po.total} pcs)</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={handlePrint} disabled={!selectedPoId}>
            <Printer size={18} /> Cetak Barcode PO Ini
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 32px 32px 32px" }}>
        <div className={selectedBarcode ? "hide-on-single-print" : "print-area"}>
          {poList.length === 0 ? (
            <div className="empty-state no-print">
              <div style={{ fontSize: 40, marginBottom: 12 }}>🖨️</div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>Belum ada barcode</div>
              <div style={{ fontSize: 14 }}>Silakan buat PO Produksi baru untuk menghasilkan barcode otomatis.</div>
            </div>
          ) : (
            <div style={{ marginBottom: 40, background: "white", padding: 24, borderRadius: "var(--radius-lg)", border: "1px solid var(--border-color)" }}>
              <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid var(--border-color)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div className="badge info" style={{ fontSize: 16 }}>PO: {selectedPoInfo?.noPo}</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 600 }}>Total: {filteredBarcodes.length} pcs</div>
                </div>
                {/* Status Legend */}
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  {[
                    { color: "#22C55E", label: "Siap Cetak",     status: "siap_jual" },
                    { color: "#3B82F6", label: "Gudang",         status: "gudang" },
                    { color: "#F59E0B", label: "Bersih Benang",  status: "benang" },
                    { color: "#06B6D4", label: "Washing",        status: "washing" },
                    { color: "#10B981", label: "Finishing",      status: "finishing" },
                    { color: "#8B5CF6", label: "Jahit Selesai",  status: "cmt" },
                    { color: "#64748B", label: "Proses Jahit",   status: "potong" },
                    { color: "#CBD5E1", label: "Belum QC",       status: "__other" },
                  ].map(({ color, label, status }) => {
                    const knownStatuses = ["siap_jual","gudang","cmt","washing","benang","finishing", "potong"];
                    const count = status === "__other"
                      ? filteredBarcodes.filter(b => !knownStatuses.includes(b.status)).length
                      : filteredBarcodes.filter(b => b.status === status).length;
                    if (count === 0) return null;
                    return (
                      <div key={status} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "#475569" }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
                        {label} ({count})
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="print-header">KUMPULAN BARCODE - PO: {selectedPoInfo?.noPo}</div>

              {sizeList.map(sz => (
                <div key={sz} className="size-section">
                  <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, marginTop: sizeList.indexOf(sz) > 0 ? 32 : 0 }}>
                    <div style={{ padding: "4px 10px", background: "#F1F5F9", borderRadius: 6, fontWeight: 800, fontSize: 14, color: "#475569" }}>Size {sz}</div>
                    <div style={{ flex: 1, height: 1, background: "var(--border-color)" }}></div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>{groupedBySize[sz].length} pcs</div>
                  </div>
                  <div className="size-header">Ukuran: {sz} ({groupedBySize[sz].length} pcs)</div>
                  
                  <div className="barcode-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
                    {groupedBySize[sz].map((b: any) => {
                      const isReady = b.status === "siap_jual";
                      const si = getStatusInfo(b.status);
                      return (
                      <div
                        key={b.id}
                        onClick={() => si.clickable ? setSelectedBarcode(b) : null}
                        className="card barcode-card"
                        style={{
                          display: "flex", flexDirection: "column", padding: "10px 12px",
                          background: "white",
                          border: `${isReady ? "2px" : "1.5px"} solid ${si.border}`,
                          borderRadius: 0, width: "100%", margin: "0 auto",
                          cursor: si.clickable ? "pointer" : "default",
                          opacity: si.opacity,
                          position: "relative",
                          transition: "transform 0.2s"
                        }}
                        onMouseEnter={(e) => si.clickable && (e.currentTarget.style.transform = "scale(1.02)")}
                        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                      >
                        {/* Status Badge */}
                        <div style={{ position: "absolute", top: 4, right: 4, background: si.color, color: "white", fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 4 }}>
                          {si.label}
                        </div>
                        
                        {/* Top Section */}
                        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8, marginTop: 14 }}>
                          {/* Size Square */}
                          <div style={{ border: "2px solid #000", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900, color: "#000", flexShrink: 0 }}>
                            {b.size}
                          </div>
                          
                          {/* Text Info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2, color: "#000", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {b.model || "MODEL"}
                            </div>
                            <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: "#000", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              SIZE {b.size} / {b.kodeBarcode} / GREY
                            </div>
                          </div>
                        </div>

                        {/* Divider line */}
                        <div style={{ width: "100%", height: 1.5, background: "#000", marginBottom: 8 }}></div>

                        {/* Barcode Section */}
                        <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
                          <Barcode 
                            value={b.kodeBarcode} 
                            width={1.2} 
                            height={35} 
                            displayValue={true} 
                            fontSize={11} 
                            fontOptions="bold"
                            margin={0} 
                            background="transparent" 
                            lineColor="#000"
                          />
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal Popup Cetak Satuan */}
      {selectedBarcode && (
        <div className="modal-overlay hide-on-normal-print">
          <div className="modal-box" style={{ maxWidth: 400, padding: 0, overflow: "hidden", borderRadius: "var(--radius-lg)" }}>
            <div className="modal-header-section" style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#F8FAFC" }}>
              <h2 className="card-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <Printer size={20} style={{ color: "var(--color-primary)" }} /> Preview Cetak Satuan
              </h2>
              <button onClick={() => setSelectedBarcode(null)} style={{ background: "transparent", border: "none", fontSize: 24, cursor: "pointer", color: "var(--text-secondary)" }}>&times;</button>
            </div>
            
            <div style={{ padding: 32, display: "flex", justifyContent: "center", background: "#F1F5F9" }}>
              {/* Tempat Preview Barcode Tunggal yang juga menjadi target area print */}
              <div className="print-single-area">
                <div className="card barcode-card print-target-card" style={{ display: "flex", flexDirection: "column", padding: "16px 20px", background: "white", border: "2px solid #000", borderRadius: 0, width: "100%", maxWidth: 350, margin: "0 auto", boxSizing: "border-box" }}>
                  <div style={{ display: "flex", gap: "4%", alignItems: "center", marginBottom: "4%" }}>
                    <div className="print-size-box" style={{ border: "3px solid #000", width: 50, height: 50, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 900, color: "#000", flexShrink: 0 }}>
                      {selectedBarcode.size}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="print-model-text" style={{ fontSize: 20, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2, color: "#000", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {selectedBarcode.model || "MODEL"}
                      </div>
                      <div className="print-detail-text" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#000", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        SIZE {selectedBarcode.size} / {selectedBarcode.kodeBarcode} / GREY
                      </div>
                    </div>
                  </div>
                  <div className="print-divider" style={{ width: "100%", height: 2, background: "#000", marginBottom: "4%" }}></div>
                  <div className="print-barcode-svg" style={{ display: "flex", justifyContent: "center", width: "100%" }}>
                    <Barcode 
                      value={selectedBarcode.kodeBarcode} 
                      width={1.5} 
                      height={45} 
                      displayValue={true} 
                      fontSize={14} 
                      fontOptions="bold"
                      margin={0} 
                      background="transparent" 
                      lineColor="#000"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div style={{ padding: "20px 24px", borderTop: "1px solid var(--border-color)", display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => setSelectedBarcode(null)}>Batal</button>
              <button className="btn btn-primary" onClick={handlePrintSingle}>
                <Printer size={16} /> Cetak Stiker Ini
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
