"use client";
import React, { useEffect, useState, useMemo } from "react";
import { 
  Printer, 
  Search, 
  Tag, 
  Activity, 
  Layers, 
  Copy, 
  Check, 
  FileText, 
  Kanban, 
  Package, 
  QrCode, 
  ArrowUpRight, 
  X, 
  Eye, 
  ExternalLink,
  SlidersHorizontal,
  CheckCircle2,
  Clock,
  Sparkles
} from "lucide-react";
import Barcode from "react-barcode";
import { toast } from "sonner";
import Link from "next/link";

export default function BarcodeProduksiPage() {
  const [barcodes, setBarcodes] = useState<any[]>([]);
  const [pipelineStages, setPipelineStages] = useState<any[]>([]);
  const [poList, setPoList] = useState<{id: string; noPo: string; total: number; model?: string; vendor_nama?: string; status?: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPoId, setSelectedPoId] = useState<string>("");
  const [selectedBarcode, setSelectedBarcode] = useState<any | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Filters & View state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSizeFilter, setSelectedSizeFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [printSizeTarget, setPrintSizeTarget] = useState<string | null>(null);

  // Status display config
  const getStatusInfo = (status: string) => {
    if (status === "siap_jual") return { label: "SIAP CETAK / SELESAI", color: "#10B981", border: "#10B981", bg: "#ECFDF5", opacity: 1, clickable: true };
    if (status === "gudang") return { label: "GUDANG", color: "#3B82F6", border: "#3B82F6", bg: "#EFF6FF", opacity: 1, clickable: false };
    if (status === "potong" || status === "cmt") return { label: "SEDANG DIJAHIT", color: "#8B5CF6", border: "#8B5CF6", bg: "#F5F3FF", opacity: 1, clickable: false };
    if (status === "washing") return { label: "DIKIRIM: WASHING", color: "#F59E0B", border: "#F59E0B", bg: "#FFFBEB", opacity: 1, clickable: false };
    
    if (status && status.endsWith("_dikerjakan")) {
      const baseStatus = status.replace("_dikerjakan", "");
      if (baseStatus === "cmt" || baseStatus === "potong") return { label: "DIKERJAKAN: JAHIT (CMT)", color: "#9333EA", border: "#9333EA", bg: "#FAF5FF", opacity: 1, clickable: false };
      if (baseStatus === "washing") return { label: "DIKERJAKAN: WASHING", color: "#D97706", border: "#D97706", bg: "#FEF3C7", opacity: 1, clickable: false };
      
      const stage = pipelineStages.find(s => s.slug === baseStatus);
      if (stage) return { label: `DIKERJAKAN: ${stage.nama.toUpperCase()}`, color: stage.warna || "#06B6D4", border: stage.warna || "#06B6D4", bg: "#ECFEFF", opacity: 1, clickable: false };
    }
    
    // Dynamic stages
    const stage = pipelineStages.find(s => s.slug === status);
    if (stage) return { label: `TAHAP: ${stage.nama.toUpperCase()}`, color: stage.warna || "#06B6D4", border: stage.warna || "#06B6D4", bg: "#ECFEFF", opacity: 1, clickable: false };
    
    return { label: `${(status || "PROSES").toUpperCase()}`, color: "#64748B", border: "#CBD5E1", bg: "#F8FAFC", opacity: 0.9, clickable: false };
  };

  const fetchData = async () => {
    try {
      const [resStages, resBarcode, resPo] = await Promise.all([
        fetch("/api/pipeline-stages").then(r => r.json()),
        fetch("/api/barcode").then(r => r.json()),
        fetch("/api/po-produksi").then(r => r.json()).catch(() => [])
      ]);

      setPipelineStages(Array.isArray(resStages) ? resStages : []);
      const barcodeData = Array.isArray(resBarcode) ? resBarcode : [];
      setBarcodes(barcodeData);

      const poDetailsMap = new Map((Array.isArray(resPo) ? resPo : []).map((p: any) => [String(p.id), p]));

      const poMap = new Map<string, {id: string; noPo: string; total: number; model?: string; vendor_nama?: string; status?: string}>();
      barcodeData.forEach((b: any) => {
        const key = String(b.poId);
        if (!poMap.has(key)) {
          const detail = poDetailsMap.get(key);
          poMap.set(key, { 
            id: key, 
            noPo: b.noPo, 
            total: 0,
            model: detail ? detail.model : b.model,
            vendor_nama: detail ? detail.vendor_nama : undefined,
            status: detail ? detail.status : undefined
          });
        }
        poMap.get(key)!.total++;
      });

      const list = Array.from(poMap.values());
      setPoList(list);
      setSelectedPoId(prev => {
        if (!prev && list.length > 0) return list[0].id;
        return prev;
      });
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = () => fetchData();
    window.addEventListener("konveksi-sync", handler);
    return () => window.removeEventListener("konveksi-sync", handler);
  }, []);

  // Print handlers
  const handlePrint = (sizeTarget?: string) => {
    setPrintSizeTarget(sizeTarget || null);
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

  useEffect(() => {
    const afterPrint = () => {
      setSelectedBarcode(null);
      setPrintSizeTarget(null);
      document.body.classList.remove('printing-single');
    };
    window.addEventListener("afterprint", afterPrint);
    return () => window.removeEventListener("afterprint", afterPrint);
  }, []);

  const handleCopyCode = (code: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Kode barcode disalin: ${code}`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const filteredBarcodes = useMemo(() => {
    return barcodes.filter(b => {
      const matchPo = String(b.poId) === selectedPoId;
      if (!matchPo) return false;

      const q = searchQuery.toLowerCase().trim();
      const matchQuery = !q || (
        (b.kodeBarcode || "").toLowerCase().includes(q) ||
        (b.size || "").toLowerCase().includes(q) ||
        (b.model || "").toLowerCase().includes(q)
      );

      const matchSize = selectedSizeFilter === "all" || String(b.size).toLowerCase() === selectedSizeFilter.toLowerCase();

      return matchQuery && matchSize;
    });
  }, [barcodes, selectedPoId, searchQuery, selectedSizeFilter]);

  const selectedPoInfo = poList.find(p => p.id === selectedPoId);

  // Group barcodes by size for sectioning
  const groupedBySize = useMemo(() => {
    return filteredBarcodes.reduce((acc, b) => {
      if (!acc[b.size]) acc[b.size] = [];
      acc[b.size].push(b);
      return acc;
    }, {} as Record<string, any[]>);
  }, [filteredBarcodes]);

  const allSizesInSelectedPo = useMemo(() => {
    const allForPo = barcodes.filter(b => String(b.poId) === selectedPoId);
    const set = new Set<string>();
    allForPo.forEach(b => set.add(b.size));
    return Array.from(set);
  }, [barcodes, selectedPoId]);

  const sizeList = Object.keys(groupedBySize);

  // Stage summary
  const stageSummary = useMemo(() => {
    const map = new Map<string, { label: string; color: string; count: number }>();
    filteredBarcodes.forEach(b => {
      const si = getStatusInfo(b.status);
      if (!map.has(b.status)) {
        map.set(b.status, { label: si.label, color: si.color, count: 0 });
      }
      map.get(b.status)!.count++;
    });
    return Array.from(map.values());
  }, [filteredBarcodes]);

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "var(--text-secondary)" }}>
        Memuat Data Barcode Tracking...
      </div>
    );
  }

  return (
    <div style={{ padding: "32px 32px 48px 32px", background: "var(--bg-app)", minHeight: "100%", overflowY: "auto" }}>
      {/* PRINT STYLES */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; display: block !important; background: white !important; padding: 0 !important; }
          .barcode-grid { display: grid !important; grid-template-columns: repeat(3, 1fr) !important; gap: 8px !important; }
          .no-print { display: none !important; }
          .barcode-card { border: 1.5px solid #000 !important; box-shadow: none !important; margin-bottom: 0 !important; page-break-inside: avoid; }
          .size-section { page-break-inside: avoid; margin-bottom: 16px; }
          .print-header { display: block !important; text-align: center; font-weight: bold; font-size: 16px; margin-bottom: 8px; border-bottom: 2px solid #000; padding-bottom: 4px; }
          .size-header { display: block !important; font-weight: bold; font-size: 14px; margin-top: 10px; margin-bottom: 8px; text-decoration: underline; }
          
          body:not(.printing-single) .hide-on-normal-print { display: none !important; }
          .hide-on-single-print { display: none !important; }
          
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
        
        @page { size: auto; }
        @page single-sticker { size: 5cm 3cm; margin: 0; }
        @media print {
          body.printing-single { page: single-sticker; }
        }

        .print-header { display: none; }
        .size-header { display: none; }
      `}</style>

      {/* PAGE HEADER */}
      <div className="page-header no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <h1 className="page-title" style={{ margin: 0 }}>Data Barcode Item (Tracking Produksi)</h1>
            <span style={{ fontSize: 11, fontWeight: 800, background: "rgba(37,99,235,0.1)", color: "#2563EB", padding: "3px 10px", borderRadius: 20 }}>
              Auto-Generated Piece Tracking (Code-128)
            </span>
          </div>
          <p className="page-subtitle" style={{ margin: 0 }}>
            Barcode stiker unik per piece pakaian untuk scan alur produksi, perpindahan antar tahapan, dan distribusi ke CMT.
          </p>
        </div>

        {/* QUICK NAVIGATION HUB & ACTION */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Link 
            href="/daftar-spk" 
            className="btn btn-secondary"
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, textDecoration: "none" }}
          >
            <FileText size={16} /> Daftar PO / SPK
          </Link>
          <Link 
            href="/alur-produksi" 
            className="btn btn-secondary"
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, textDecoration: "none" }}
          >
            <Kanban size={16} /> Alur Produksi
          </Link>
          <Link 
            href="/daftar-bundle" 
            className="btn btn-secondary"
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, textDecoration: "none" }}
          >
            <Package size={16} /> Daftar Bundle
          </Link>

          <button 
            className="btn btn-primary" 
            onClick={() => handlePrint()} 
            disabled={!selectedPoId || filteredBarcodes.length === 0}
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: "10px 18px", fontWeight: 800 }}
          >
            <Printer size={16} /> Cetak Barcode PO Ini
          </button>
        </div>
      </div>

      {/* 4 STAT SUMMARY KPI CARDS */}
      <div className="stat-grid no-print" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)" }}>Total Barcode PO Ini</span>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(37, 99, 235, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563EB" }}>
              <BarcodeIcon size={20} />
            </div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "var(--text-primary)", letterSpacing: "-0.5px" }}>
            {filteredBarcodes.length.toLocaleString("id-ID")} <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>pcs</span>
          </div>
          <div style={{ fontSize: 12, color: "#2563EB", marginTop: 4, fontWeight: 700 }}>
            PO: {selectedPoInfo?.noPo || "-"} • {selectedPoInfo?.model || "Model Jeans"}
          </div>
        </div>

        <div className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)" }}>Varian Ukuran (Size)</span>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(139, 92, 246, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#8B5CF6" }}>
              <Tag size={20} />
            </div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "var(--text-primary)", letterSpacing: "-0.5px" }}>
            {allSizesInSelectedPo.length} <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>Size</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
            {allSizesInSelectedPo.length > 0 ? allSizesInSelectedPo.join(", ") : "-"}
          </div>
        </div>

        <div className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)" }}>Status Tahap Produksi</span>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(16, 185, 129, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#10B981" }}>
              <Activity size={20} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "var(--text-primary)", letterSpacing: "-0.5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {stageSummary.length > 0 ? stageSummary[0].label : "SEDANG DIJAHIT"}
          </div>
          <div style={{ fontSize: 12, color: "#059669", marginTop: 4, fontWeight: 600 }}>
            {stageSummary.map(s => `${s.count} pcs ${s.label}`).join(" • ") || "Posisi tracking aktif"}
          </div>
        </div>

        <div className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)" }}>Total Semua Barcode Sistem</span>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(245, 158, 11, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#F59E0B" }}>
              <Layers size={20} />
            </div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#D97706", letterSpacing: "-0.5px" }}>
            {barcodes.length.toLocaleString("id-ID")} <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>pcs</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
            Terdaftar di {poList.length} PO Produksi
          </div>
        </div>
      </div>

      {/* PO SELECTOR & FILTER TOOLBAR */}
      <div className="card no-print" style={{ marginBottom: 20, padding: "16px 20px" }}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          
          {/* PO SELECTOR */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "1 1 340px", minWidth: 280 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
              PILIH PO PRODUKSI:
            </span>
            <select 
              className="form-control"
              style={{ height: 40, borderRadius: 8, fontSize: 13, fontWeight: 800, color: "#2563EB", cursor: "pointer", flex: 1 }} 
              value={selectedPoId} 
              onChange={e => {
                setSelectedPoId(e.target.value);
                setSelectedSizeFilter("all");
              }}
            >
              {poList.length === 0 && <option value="">Belum ada PO Produksi</option>}
              {poList.map(po => (
                <option key={po.id} value={po.id}>
                  {po.noPo} — {po.model || "Jeans"} ({po.total} pcs)
                </option>
              ))}
            </select>
          </div>

          {/* SEARCH INPUT */}
          <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}>
            <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input 
              type="text"
              className="form-control"
              placeholder="Cari kode barcode (SJ-02-...), ukuran..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: 36, height: 40, borderRadius: 8, fontSize: 12.5 }}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* VIEW MODE TOGGLE */}
          <div style={{ display: "flex", background: "var(--bg-app)", padding: 3, borderRadius: 8, gap: 2 }}>
            <button
              onClick={() => setViewMode("grid")}
              className={`btn ${viewMode === "grid" ? "btn-primary" : ""}`}
              style={{ padding: "6px 12px", fontSize: 12, borderRadius: 6, height: 34, ...(viewMode !== "grid" ? { background: "transparent", border: "none", color: "var(--text-secondary)" } : {}) }}
            >
              🎴 Grid Stiker
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`btn ${viewMode === "table" ? "btn-primary" : ""}`}
              style={{ padding: "6px 12px", fontSize: 12, borderRadius: 6, height: 34, ...(viewMode !== "table" ? { background: "transparent", border: "none", color: "var(--text-secondary)" } : {}) }}
            >
              📋 Tabel Rekap
            </button>
          </div>
        </div>

        {/* SIZE PILLS FILTER */}
        {allSizesInSelectedPo.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border-color)", flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>
              Filter Ukuran:
            </span>
            <button
              onClick={() => setSelectedSizeFilter("all")}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                border: selectedSizeFilter === "all" ? "1px solid #2563EB" : "1px solid var(--border-color)",
                background: selectedSizeFilter === "all" ? "#EFF6FF" : "white",
                color: selectedSizeFilter === "all" ? "#1D4ED8" : "var(--text-primary)",
                fontSize: 11.5,
                fontWeight: selectedSizeFilter === "all" ? 800 : 600,
                cursor: "pointer"
              }}
            >
              Semua Ukuran ({filteredBarcodes.length})
            </button>
            {allSizesInSelectedPo.map(sz => {
              const count = barcodes.filter(b => String(b.poId) === selectedPoId && b.size === sz).length;
              const isSelected = selectedSizeFilter.toLowerCase() === sz.toLowerCase();
              return (
                <button
                  key={sz}
                  onClick={() => setSelectedSizeFilter(sz)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    border: isSelected ? "1px solid #2563EB" : "1px solid var(--border-color)",
                    background: isSelected ? "#EFF6FF" : "white",
                    color: isSelected ? "#1D4ED8" : "var(--text-primary)",
                    fontSize: 11.5,
                    fontWeight: isSelected ? 800 : 600,
                    cursor: "pointer"
                  }}
                >
                  Size {sz} ({count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* PRINTABLE CONTAINER / MAIN VIEW */}
      <div className={selectedBarcode ? "hide-on-single-print" : "print-area"}>
        {poList.length === 0 ? (
          <div className="card no-print" style={{ padding: 48, textAlign: "center", color: "var(--text-secondary)" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📦</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>Belum ada data Barcode</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Silakan terbitkan PO Produksi baru untuk menghasilkan barcode otomatis.</div>
            <div style={{ marginTop: 16 }}>
              <Link href="/buat-spk" className="btn btn-primary" style={{ textDecoration: "none" }}>
                + Buat PO Produksi
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: 40, background: "white", padding: 24, borderRadius: "var(--radius-lg)", border: "1px solid var(--border-color)" }}>
            
            {/* SUB-HEADER / LEGEND (NO PRINT) */}
            <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid var(--border-color)", flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className="badge info" style={{ fontSize: 15, padding: "5px 12px" }}>PO: {selectedPoInfo?.noPo}</span>
                <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 600 }}>
                  Model: <strong style={{ color: "var(--text-primary)" }}>{selectedPoInfo?.model || "Standard"}</strong> • Total: <strong style={{ color: "#2563EB" }}>{filteredBarcodes.length} pcs</strong>
                </span>
              </div>

              {/* Status Legend */}
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                {stageSummary.map(data => (
                  <div key={data.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: data.color, flexShrink: 0 }} />
                    {data.label} ({data.count})
                  </div>
                ))}
              </div>
            </div>

            <div className="print-header">KUMPULAN BARCODE - PO: {selectedPoInfo?.noPo} ({selectedPoInfo?.model})</div>

            {/* VIEW MODE 1: GRID KARTU STIKER */}
            {viewMode === "grid" ? (
              <div>
                {sizeList.map(sz => {
                  const itemsInSize = groupedBySize[sz] || [];
                  const isFilteredOut = printSizeTarget && printSizeTarget !== sz;
                  if (isFilteredOut) return null;

                  return (
                    <div key={sz} className="size-section" style={{ marginBottom: 28 }}>
                      {/* SIZE SUB-HEADER WITH CETAK KHUSUS SIZE INI */}
                      <div className="no-print" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, marginTop: sizeList.indexOf(sz) > 0 ? 24 : 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ padding: "4px 12px", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 6, fontWeight: 900, fontSize: 13, color: "#1D4ED8" }}>
                            Size {sz}
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>
                            {itemsInSize.length} pcs pakaian
                          </span>
                        </div>

                        <button
                          onClick={() => handlePrint(sz)}
                          className="btn btn-secondary"
                          style={{ fontSize: 11.5, padding: "4px 10px", borderRadius: 6, display: "flex", alignItems: "center", gap: 4, fontWeight: 700 }}
                          title={`Cetak hanya stiker Size ${sz}`}
                        >
                          <Printer size={13} /> Cetak Khusus Size {sz}
                        </button>
                      </div>

                      <div className="size-header">Ukuran: {sz} ({itemsInSize.length} pcs)</div>
                      
                      {/* BARCODE STICKER GRID */}
                      <div className="barcode-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(225px, 1fr))", gap: 12 }}>
                        {itemsInSize.map((b: any) => {
                          const isReady = b.status === "siap_jual";
                          const si = getStatusInfo(b.status);
                          const isCopied = copiedCode === b.kodeBarcode;

                          return (
                            <div
                              key={b.id}
                              onClick={() => setSelectedBarcode(b)}
                              className="card barcode-card"
                              style={{
                                display: "flex", 
                                flexDirection: "column", 
                                padding: "10px 12px",
                                background: "white",
                                border: `${isReady ? "2px" : "1.5px"} solid ${si.border}`,
                                borderRadius: 6, 
                                width: "100%", 
                                margin: "0 auto",
                                cursor: "pointer",
                                opacity: si.opacity,
                                position: "relative",
                                transition: "all 0.15s ease",
                                boxShadow: "0 1px 4px rgba(0,0,0,0.04)"
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = "translateY(-2px)";
                                e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = "translateY(0)";
                                e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)";
                              }}
                            >
                              {/* Status Badge */}
                              <div style={{ position: "absolute", top: 4, right: 4, background: si.color, color: "white", fontSize: 8.5, fontWeight: 800, padding: "2px 6px", borderRadius: 4 }}>
                                {si.label}
                              </div>
                              
                              {/* Top Section */}
                              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, marginTop: 12 }}>
                                {/* Size Square */}
                                <div style={{ border: "2px solid #000", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900, color: "#000", flexShrink: 0 }}>
                                  {b.size}
                                </div>
                                
                                {/* Text Info */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 1, color: "#000", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {b.model || "JEANS"}
                                  </div>
                                  <div style={{ fontSize: 8.5, fontWeight: 700, textTransform: "uppercase", color: "#333", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    SIZE {b.size} / {b.kodeBarcode}
                                  </div>
                                </div>
                              </div>

                              {/* Divider line */}
                              <div style={{ width: "100%", height: 1.5, background: "#000", marginBottom: 6 }}></div>

                              {/* Barcode Section */}
                              <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
                                <Barcode 
                                  value={b.kodeBarcode} 
                                  width={1.2} 
                                  height={34} 
                                  displayValue={true} 
                                  fontSize={10.5} 
                                  fontOptions="bold"
                                  margin={0} 
                                  background="transparent" 
                                  lineColor="#000"
                                />
                              </div>

                              {/* Card Action footer (No-print) */}
                              <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, paddingTop: 4, borderTop: "1px dashed #E2E8F0" }}>
                                <button
                                  type="button"
                                  onClick={(e) => handleCopyCode(b.kodeBarcode, e)}
                                  style={{ background: "none", border: "none", fontSize: 10, color: isCopied ? "#059669" : "#64748B", cursor: "pointer", display: "flex", alignItems: "center", gap: 3, fontWeight: 700, padding: 0 }}
                                  title="Salin kode barcode"
                                >
                                  {isCopied ? <Check size={11} /> : <Copy size={11} />} {isCopied ? "Tersalin" : "Salin Kode"}
                                </button>
                                <span style={{ fontSize: 9.5, color: "#2563EB", fontWeight: 700, display: "flex", alignItems: "center", gap: 2 }}>
                                  <Eye size={10} /> Detail
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* VIEW MODE 2: TABEL REKAPITULASI BARCODE */
              <div style={{ overflowX: "auto" }}>
                <table className="table" style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--bg-app)", borderBottom: "1px solid var(--border-color)" }}>
                      <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 12 }}>NO</th>
                      <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 12 }}>KODE BARCODE</th>
                      <th style={{ padding: "10px 12px", textAlign: "center", fontSize: 12 }}>SIZE</th>
                      <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 12 }}>MODEL / ITEM</th>
                      <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 12 }}>STATUS TAHAPAN</th>
                      <th style={{ padding: "10px 12px", textAlign: "center", fontSize: 12 }}>BARCODE VISUAL</th>
                      <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 12 }}>AKSI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBarcodes.map((b: any, idx: number) => {
                      const si = getStatusInfo(b.status);
                      const isCopied = copiedCode === b.kodeBarcode;
                      return (
                        <tr 
                          key={b.id} 
                          onClick={() => setSelectedBarcode(b)}
                          style={{ borderBottom: "1px solid var(--border-color)", cursor: "pointer" }}
                        >
                          <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-secondary)" }}>{idx + 1}</td>
                          <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 900, fontFamily: "monospace", color: "#2563EB" }}>
                            {b.kodeBarcode}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "center" }}>
                            <span style={{ padding: "2px 8px", background: "var(--bg-app)", border: "1px solid var(--border-color)", borderRadius: 4, fontWeight: 900, fontSize: 12 }}>
                              {b.size}
                            </span>
                          </td>
                          <td style={{ padding: "10px 12px", fontSize: 12, fontWeight: 700 }}>
                            {b.model || "Jeans"}
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <span style={{ fontSize: 10, fontWeight: 800, color: si.color, background: si.bg, border: `1px solid ${si.border}`, padding: "2px 8px", borderRadius: 4 }}>
                              {si.label}
                            </span>
                          </td>
                          <td style={{ padding: "6px 12px", textAlign: "center" }}>
                            <div style={{ display: "inline-block", background: "white", padding: 2 }}>
                              <Barcode 
                                value={b.kodeBarcode} 
                                width={1} 
                                height={24} 
                                displayValue={false} 
                                margin={0} 
                              />
                            </div>
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right" }}>
                            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }} onClick={e => e.stopPropagation()}>
                              <button
                                onClick={(e) => handleCopyCode(b.kodeBarcode, e)}
                                className="btn btn-secondary"
                                style={{ padding: "4px 8px", fontSize: 11 }}
                                title="Salin kode"
                              >
                                {isCopied ? <Check size={12} color="#059669" /> : <Copy size={12} />}
                              </button>
                              <button
                                onClick={() => setSelectedBarcode(b)}
                                className="btn btn-primary"
                                style={{ padding: "4px 10px", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}
                              >
                                <Printer size={12} /> Cetak
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL POPUP CETAK SATUAN / DETAIL STIKER */}
      {selectedBarcode && (
        <div className="modal-overlay hide-on-normal-print">
          <div className="modal-box" style={{ maxWidth: 440, padding: 0, overflow: "hidden", borderRadius: "var(--radius-lg)", boxShadow: "0 25px 80px rgba(0,0,0,0.3)" }}>
            <div className="modal-header-section" style={{ padding: "18px 24px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#F8FAFC" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563EB" }}>
                  <Printer size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: "var(--text-primary)" }}>Preview Stiker Barcode</h3>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Format Label Thermal Standard (5 x 3 cm)</div>
                </div>
              </div>
              <button onClick={() => setSelectedBarcode(null)} style={{ background: "transparent", border: "none", fontSize: 22, cursor: "pointer", color: "var(--text-secondary)" }}>&times;</button>
            </div>
            
            <div style={{ padding: 24, display: "flex", flexDirection: "column", alignItems: "center", background: "#F1F5F9" }}>
              
              {/* TARGET AREA CETAK SATUAN */}
              <div className="print-single-area" style={{ width: "100%", display: "flex", justifyContent: "center" }}>
                <div className="card barcode-card print-target-card" style={{ display: "flex", flexDirection: "column", padding: "14px 18px", background: "white", border: "2px solid #000", borderRadius: 0, width: "100%", maxWidth: 360, margin: "0 auto", boxSizing: "border-box" }}>
                  <div style={{ display: "flex", gap: "4%", alignItems: "center", marginBottom: "3%" }}>
                    <div className="print-size-box" style={{ border: "3px solid #000", width: 48, height: 48, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 900, color: "#000", flexShrink: 0 }}>
                      {selectedBarcode.size}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="print-model-text" style={{ fontSize: 18, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2, color: "#000", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {selectedBarcode.model || "JEANS"}
                      </div>
                      <div className="print-detail-text" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#000", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        SIZE {selectedBarcode.size} / {selectedBarcode.kodeBarcode} / GREY
                      </div>
                    </div>
                  </div>

                  <div className="print-divider" style={{ width: "100%", height: 2, background: "#000", marginBottom: "3%" }}></div>

                  <div className="print-barcode-svg" style={{ display: "flex", justifyContent: "center", width: "100%" }}>
                    <Barcode 
                      value={selectedBarcode.kodeBarcode} 
                      width={1.4} 
                      height={42} 
                      displayValue={true} 
                      fontSize={13} 
                      fontOptions="bold"
                      margin={0} 
                      background="transparent" 
                      lineColor="#000"
                    />
                  </div>
                </div>
              </div>

              {/* INFORMASI TAMBAHAN (NO-PRINT) */}
              <div className="no-print" style={{ width: "100%", marginTop: 16, background: "white", padding: "12px 16px", borderRadius: 10, border: "1px solid var(--border-color)", fontSize: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ color: "var(--text-secondary)" }}>Kode Barcode:</span>
                  <span style={{ fontWeight: 900, fontFamily: "monospace", color: "#2563EB" }}>{selectedBarcode.kodeBarcode}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ color: "var(--text-secondary)" }}>PO Induk:</span>
                  <span style={{ fontWeight: 700 }}>{selectedBarcode.noPo}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Status Tracking:</span>
                  <span style={{ fontWeight: 800, color: getStatusInfo(selectedBarcode.status).color }}>
                    {getStatusInfo(selectedBarcode.status).label}
                  </span>
                </div>
              </div>
            </div>

            {/* MODAL FOOTER */}
            <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#F8FAFC" }}>
              <button 
                type="button"
                className="btn btn-secondary" 
                onClick={(e) => handleCopyCode(selectedBarcode.kodeBarcode, e)}
                style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700 }}
              >
                <Copy size={14} /> Salin Kode
              </button>

              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-secondary" onClick={() => setSelectedBarcode(null)} style={{ fontSize: 13 }}>
                  Tutup
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={handlePrintSingle}
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 800 }}
                >
                  <Printer size={16} /> Cetak Stiker 5x3 cm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Internal Barcode icon helper
function BarcodeIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5v14" />
      <path d="M8 5v14" />
      <path d="M12 5v14" />
      <path d="M17 5v14" />
      <path d="M21 5v14" />
    </svg>
  );
}
