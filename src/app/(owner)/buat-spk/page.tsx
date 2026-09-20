"use client";
import React, { useEffect, useState, useRef } from "react";
import { Plus, Trash2, CheckCircle2, QrCode, FileText, ChevronRight, Inbox, ExternalLink, CheckCheck, X } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function BuatPOProduksi() {
  const [activeTab, setActiveTab] = useState<"manual" | "request" | "laporan" | "washing">("manual");
  const _bgRefresh = useRef(false);
  const [vendors, setVendors] = useState<any[]>([]);
  const [pemotonganList, setPemotonganList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [cmtRequests, setCmtRequests] = useState<any[]>([]);
  const [processRequest, setProcessRequest] = useState<any>(null);
  const [rejectRequest, setRejectRequest] = useState<any>(null); // For Reject Modal
  const [rejectReason, setRejectReason] = useState("");
  const [requestFilter, setRequestFilter] = useState("Semua");
  const [cmtProgres, setCmtProgres] = useState<any[]>([]);
  const [washingTransfers, setWashingTransfers] = useState<any[]>([]);
  const [downstreamModal, setDownstreamModal] = useState<any | null>(null);
  const [downstreamForm, setDownstreamForm] = useState<{size: string, max: number, jumlah: number|""}[]>([]);
  const [isSubmittingDownstream, setIsSubmittingDownstream] = useState(false);

  const [form, setForm] = useState({
    pemotonganId: "",
    vendorId: "",
    catatan: ""
  });
  
  const [sizeBreakdown, setSizeBreakdown] = useState<{size:string; jumlah:number; maxSisa:number}[]>([]);

  const fetchAll = () => {
    fetch("/api/vendors?_t=" + Date.now())
      .then(res => res.json())
      .then(data => setVendors(data.filter((v:any) => v.tipe === "cmt" && v.aktif)));
      
    fetch("/api/pemotongan?_t=" + Date.now())
      .then(res => res.json())
      .then(data => {
        const available = data.filter((p:any) => p.status !== "Draft" && p.sizeBreakdown.some((s:any) => s.sisa > 0));
        setPemotonganList(available);
      });

    fetch("/api/cmt-request?_t=" + Date.now())
      .then(res => res.json())
      .then(data => setCmtRequests(Array.isArray(data) ? data : []));
      
    fetch("/api/cmt-progres?_t=" + Date.now())
      .then(res => res.json())
      .then(data => setCmtProgres(Array.isArray(data) ? data : []));

    fetch("/api/produksi-transfer?ke=washing&_t=" + Date.now())
      .then(res => res.json())
      .then(data => setWashingTransfers(Array.isArray(data) ? data : []));
  };

  useEffect(() => { 
    fetchAll(); 
    const interval = setInterval(fetchAll, 2000);
    return () => clearInterval(interval);
  }, []);

  const selectedPemotongan = pemotonganList.find(p => String(p.id) === form.pemotonganId);

  // Helper: distribute qty evenly across available sizes
  const distributeEvenly = (pemo: any, targetQty: number) => {
    if (!pemo) return [];
    const sizes = pemo.sizeBreakdown.filter((s: any) => s.sisa > 0);
    const numSizes = sizes.length;
    if (numSizes === 0) return pemo.sizeBreakdown.map((s: any) => ({ size: s.size, jumlah: 0, maxSisa: s.sisa }));
    const perSize = Math.floor(targetQty / numSizes);
    let remainder = targetQty - (perSize * numSizes);
    return pemo.sizeBreakdown.map((s: any) => {
      if (s.sisa <= 0) return { size: s.size, jumlah: 0, maxSisa: s.sisa };
      const extra = remainder > 0 ? 1 : 0;
      remainder -= extra;
      const qty = Math.min(perSize + extra, s.sisa);
      return { size: s.size, jumlah: qty, maxSisa: s.sisa };
    });
  };

  const handlePemotonganChange = (id: string) => {
    setForm(prev => ({ ...prev, pemotonganId: id }));
    const p = pemotonganList.find((x: any) => String(x.id) === id);
    if (p) {
      if (processRequest) {
        // Auto-distribute evenly based on request
        setSizeBreakdown(distributeEvenly(p, Number(processRequest.total_request)));
      } else {
        setSizeBreakdown(p.sizeBreakdown.map((s: any) => ({ size: s.size, jumlah: 0, maxSisa: s.sisa })));
      }
    } else {
      setSizeBreakdown([]);
    }
  };

  const totalPcs = sizeBreakdown.reduce((sum, item) => sum + (Number(item.jumlah) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.pemotonganId || !form.vendorId || totalPcs === 0) {
      alert("Harap pilih Potongan, Vendor CMT, dan minimal 1 Size.");
      return;
    }

    if (!_bgRefresh.current) setLoading(true);
    try {
      const res = await fetch("/api/po-produksi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          jumlahTerbit: totalPcs,
          sizeBreakdown: sizeBreakdown.filter(s => s.jumlah > 0)
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // If this PO fulfills a request, update the request status
      if (processRequest) {
        const newDipenuhi = (processRequest.total_dipenuhi || 0) + totalPcs;
        const newStatus = newDipenuhi >= processRequest.total_request ? "Selesai" : "Terpenuhi Sebagian";
        
        await fetch("/api/cmt-request", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: processRequest.id,
            status: newStatus,
            total_dipenuhi: newDipenuhi
          })
        });
      }

      setResult(data);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTerimaLaporan = async (id: string) => {
    try {
      const res = await fetch("/api/cmt-progres", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "terima" })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Laporan berhasil diterima & masuk ke stok pengambilan!");
      fetchAll();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleTolakLaporan = async (id: string) => {
    if (!confirm("Tolak laporan ini? Status CMT akan dikembalikan ke normal.")) return;
    try {
      const res = await fetch("/api/cmt-progres", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "tolak" })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Laporan ditolak. Status barcode dikembalikan.");
      fetchAll();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDownstreamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!downstreamModal) return;
    
    const items = downstreamForm.filter(p => Number(p.jumlah) > 0);
    const totalReq = items.reduce((s, i) => s + Number(i.jumlah), 0);
    
    if (items.length === 0) {
      toast.error("Isi setidaknya 1 size.");
      return;
    }
    
    for (const item of items) {
      if (Number(item.jumlah) > item.max) {
        toast.error(`Size ${item.size} melebihi sisa yang ada di Standby Pool (${item.max})`);
        return;
      }
    }
    
    if (totalReq > Number(downstreamModal.total_request)) {
      toast.error(`Total yang di-ACC (${totalReq}) melebihi request (${downstreamModal.total_request})`);
      return;
    }

    setIsSubmittingDownstream(true);
    try {
      const res = await fetch("/api/tarik-barang/acc-downstream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: downstreamModal.id,
          transfer_id: downstreamModal.pemotongan.transfer_id,
          vendor_id: downstreamModal.vendor_id,
          sizeBreakdown: items,
        })
      });
      if (!res.ok) {
         const data = await res.json();
         throw new Error(data.error || "Gagal");
      }
      toast.success("Berhasil menugaskan ke vendor!");
      setDownstreamModal(null);
      fetchAll();
    } catch(err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmittingDownstream(false);
    }
  };

  if (result) {
    return (
      <div style={{ padding: "32px", display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100%" }}>
        <div className="card" style={{ maxWidth: 600, textAlign: "center", padding: "40px" }}>
          <div style={{ display: "inline-flex", justifyContent: "center", alignItems: "center", width: 64, height: 64, borderRadius: "50%", background: "var(--color-success-bg)", color: "var(--color-success)", marginBottom: 24 }}>
            <CheckCircle2 size={32} />
          </div>
          <h1 style={{ fontSize: "var(--font-size-2xl)", fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>PO Produksi Berhasil Diterbitkan!</h1>
          <p style={{ color: "var(--text-secondary)", marginBottom: 32 }}>
            PO <strong style={{ color: "var(--text-primary)" }}>{result.noPo}</strong> sejumlah <strong style={{ color: "var(--text-primary)" }}>{result.jumlahTerbit} pcs</strong> telah masuk ke Ledger CMT.
            Sistem otomatis men-generate <strong style={{ color: "var(--text-primary)" }}>{result.jumlahTerbit} buah barcode</strong>.
          </p>

          <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
            <Link href="/dashboard-cmt" className="btn btn-secondary">
              Lihat di Dashboard CMT
            </Link>
            <Link href="/barcode-produksi" className="btn btn-primary" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <QrCode size={18} /> Cetak Barcode
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Real-time sync: refresh data when another admin makes changes
  useEffect(() => {
    window.addEventListener("konveksi-sync", fetchAll);
    return () => window.removeEventListener("konveksi-sync", fetchAll);
  }, [fetchAll]);
  return (
    <div style={{ height: "100%", overflowY: "auto", overflowX: "hidden" }}>
      <div style={{ padding: "32px", animation: "fadeIn 0.4s ease-out" }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 900, color: "#0F172A", letterSpacing: "-0.5px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
              Buat PO Produksi <span style={{ background: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)", color: "white", fontSize: 12, padding: "4px 10px", borderRadius: 20, fontWeight: 700, letterSpacing: 0 }}>SPK BARU</span>
            </h1>
            <p style={{ fontSize: 15, color: "#64748B" }}>Alokasikan potongan kain dari Tukang Potong ke CMT untuk mulai dijahit.</p>
          </div>
          {/* Tab Navigation */}
          <div style={{ display: "flex", gap: 4, background: "white", border: "1px solid #E2E8F0", borderRadius: 14, padding: 5, flexWrap: "wrap", flexShrink: 0 }}>
            {([
              { key: "manual",  icon: "fi-rr-document",  label: "SPK Manual",      badge: 0, badgeColor: "" },
              { key: "request", icon: "fi-rr-inbox",     label: "Request",          badge: cmtRequests.filter((r: any) => r.status === "Pending").length, badgeColor: "#EF4444" },
              { key: "laporan", icon: "fi-rr-check-circle", label: "Laporan CMT",  badge: cmtProgres.filter((r: any) => r.status === "Menunggu" || r.status === "Pending").length, badgeColor: "#F59E0B" },
              { key: "washing", icon: "fi-rr-water",     label: "Laporan Washing",  badge: washingTransfers.filter((r: any) => r.status === "Kirim").length, badgeColor: "#06B6D4" },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                style={{ padding: "9px 18px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, background: activeTab === tab.key ? "#0F172A" : "transparent", color: activeTab === tab.key ? "white" : "#64748B", transition: "all 0.2s", display: "flex", alignItems: "center", gap: 7, position: "relative", whiteSpace: "nowrap" }}
              >
                <i className={`fi ${tab.icon}`} style={{ fontSize: 14 }} />
                {tab.label}
                {tab.badge > 0 && (
                  <span style={{ background: tab.badgeColor, color: "white", borderRadius: "50%", minWidth: 20, height: 20, fontSize: 10, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Info Banner: dari request CMT */}
      {activeTab === "manual" && processRequest && (
        <div style={{ background: "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)", border: "1.5px solid #3B82F6", borderRadius: 14, padding: "14px 20px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ background: "#3B82F6", color: "white", width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>✦</div>
            <div>
              <div style={{ fontWeight: 800, color: "#1D4ED8", fontSize: 14 }}>Auto-fill dari Request: {processRequest.vendor_nama}</div>
              <div style={{ fontSize: 13, color: "#3B82F6" }}>
                Target: <strong>{processRequest.total_request} pcs</strong> · Breakdown sudah diisi rata antar size. Sesuaikan jika perlu sebelum terbitkan PO.
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button
              onClick={() => {
                if (selectedPemotongan) {
                  setSizeBreakdown(distributeEvenly(selectedPemotongan, Number(processRequest.total_request)));
                }
              }}
              style={{ background: "#3B82F6", color: "white", border: "none", padding: "8px 14px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 13 }}
            >
              <i className="fi fi-rr-refresh" style={{ fontSize: 12 }} /> Rata Ulang
            </button>
            <button
              onClick={() => { setProcessRequest(null); }}
              style={{ background: "white", color: "#64748B", border: "1px solid #CBD5E1", padding: "8px 12px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 13 }}
            >
              <i className="fi fi-rr-trash" style={{ fontSize: 12 }} /> Hapus
            </button>
          </div>
        </div>
      )}

      {/* TAB: Antrean Request CMT */}
      {activeTab === "request" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 40 }}>

          {/* FILTER BARS */}
          <div style={{ display: "flex", gap: 8 }}>
            {["Semua", "Pending", "Selesai/Dilayani", "Ditolak"].map(f => (
              <button
                key={f}
                onClick={() => setRequestFilter(f)}
                style={{
                  padding: "7px 16px", borderRadius: 20, fontSize: 13, fontWeight: 700, border: "none",
                  cursor: "pointer",
                  background: requestFilter === f ? "#0F172A" : "#E2E8F0",
                  color: requestFilter === f ? "white" : "#64748B"
                }}
              >
                {f}
                {f === "Pending" && cmtRequests.filter((r: any) => r.status === "Pending").length > 0 && (
                  <span style={{ marginLeft: 6, background: "#EF4444", color: "white", borderRadius: 20, fontSize: 10, padding: "1px 6px", fontWeight: 900 }}>
                    {cmtRequests.filter((r: any) => r.status === "Pending").length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {(() => {
            const filtered = cmtRequests.filter((r: any) => {
              if (requestFilter === "Semua") return true;
              if (requestFilter === "Selesai/Dilayani") return r.status === "Selesai" || r.status === "Terpenuhi Sebagian";
              return r.status === requestFilter;
            });

            if (filtered.length === 0) return (
              <div style={{ background: "white", borderRadius: 18, padding: 60, textAlign: "center", border: "1px solid #E2E8F0" }}>
                <Inbox size={44} style={{ color: "#CBD5E1", margin: "0 auto 14px" }} />
                <div style={{ fontSize: 16, fontWeight: 700, color: "#64748B" }}>Tidak ada Request {requestFilter !== "Semua" ? requestFilter : ""}</div>
              </div>
            );

            // Group by vendor type
            const GROUPS: Record<string, { label: string; icon: string; color: string; bg: string; border: string; items: any[] }> = {
              cmt:       { label: "Vendor CMT / Penjahit", icon: "fi-sr-needle", color: "#1D4ED8", bg: "#EFF6FF", border: "#BFDBFE", items: [] },
              washing:   { label: "Vendor Washing / Laundry", icon: "fi-sr-water", color: "#0E7490", bg: "#ECFEFF", border: "#A5F3FC", items: [] },
              benang:    { label: "Vendor Bersih Benang", icon: "fi-sr-scissors", color: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE", items: [] },
              finishing: { label: "Vendor Finishing / QC", icon: "fi-sr-badge-check", color: "#059669", bg: "#ECFDF5", border: "#6EE7B7", items: [] },
              lainnya:   { label: "Vendor Lainnya", icon: "fi-sr-box-open", color: "#64748B", bg: "#F8FAFC", border: "#E2E8F0", items: [] },
            };

            for (const r of filtered) {
              const v = vendors.find((v: any) => v.id === r.vendor_id);
              const tipe = v?.tipe || "lainnya";
              (GROUPS[tipe] || GROUPS["lainnya"]).items.push(r);
            }

            const STATUS_CFG: Record<string, { badge: string; badgeText: string; borderL: string }> = {
              "Pending":            { badge: "#DBEAFE", badgeText: "#1D4ED8", borderL: "#3B82F6" },
              "Terpenuhi Sebagian": { badge: "#FEF3C7", badgeText: "#B45309", borderL: "#F59E0B" },
              "Selesai":            { badge: "#D1FAE5", badgeText: "#065F46", borderL: "#10B981" },
              "Ditolak":            { badge: "#FEE2E2", badgeText: "#991B1B", borderL: "#EF4444" },
            };

            return ["cmt", "washing", "benang", "finishing", "lainnya"].map(tipe => {
              const g = GROUPS[tipe];
              if (g.items.length === 0) return null;
              const pendingCount = g.items.filter(r => r.status === "Pending").length;

              return (
                <div key={tipe}>
                  {/* Section Header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                    <div style={{ background: g.bg, border: `1.5px solid ${g.border}`, borderRadius: 12, padding: "8px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                      <i className={`fi ${g.icon}`} style={{ fontSize: 18, color: g.color }} />
                      <div>
                        <div style={{ fontWeight: 900, fontSize: 14, color: g.color }}>{g.label}</div>
                        <div style={{ fontSize: 11, color: "#64748B" }}>
                          {g.items.length} request
                          {pendingCount > 0 && <span style={{ marginLeft: 6, background: "#EF4444", color: "white", borderRadius: 20, fontSize: 10, padding: "1px 6px", fontWeight: 900 }}>{pendingCount} menunggu</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{ flex: 1, height: 1.5, background: `linear-gradient(to right, ${g.border}, transparent)` }} />
                  </div>

                  {/* Cards Grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                    {g.items.map((r: any) => {
                      const sc = STATUS_CFG[r.status] || STATUS_CFG["Pending"];
                      const isPending = r.status === "Pending" || r.status === "Terpenuhi Sebagian";
                      const isDitolak = r.status === "Ditolak";
                      const pct = r.total_request > 0 ? Math.round(((r.total_dipenuhi || 0) / r.total_request) * 100) : 0;
                      const sisaKurang = Math.max(0, r.total_request - (r.total_dipenuhi || 0));

                      return (
                        <div key={r.id} style={{ background: "white", borderRadius: 16, border: `1px solid ${isPending ? sc.borderL : "#E2E8F0"}`, boxShadow: isPending ? `0 0 0 3px ${sc.badge}` : "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden", display: "flex", flexDirection: "column" }}>

                          {/* Card Header */}
                          <div style={{ padding: "14px 18px", background: isPending ? g.bg : "#F8FAFC", borderBottom: `1px solid ${isPending ? g.border : "#E2E8F0"}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                              <div style={{ width: 38, height: 38, borderRadius: 10, background: sc.badge, border: `2px solid ${sc.borderL}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 15, color: sc.badgeText, flexShrink: 0 }}>
                                {r.vendor_nama?.charAt(0) || "?"}
                              </div>
                              <div>
                                <div style={{ fontWeight: 800, fontSize: 14, color: "#0F172A" }}>{r.vendor_nama}</div>
                                <div style={{ fontSize: 11, color: "#64748B", display: "flex", gap: 5, alignItems: "center" }}>
                                  <i className="fi fi-rr-clock" style={{ fontSize: 10 }} />
                                  {new Date(r.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                                  &nbsp;·&nbsp;
                                  {new Date(r.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                                  &nbsp;· #{r.id}
                                </div>
                              </div>
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 20, background: sc.badge, color: sc.badgeText, border: `1px solid ${sc.borderL}`, flexShrink: 0 }}>
                              {r.status}
                            </span>
                          </div>

                          {/* Stats Row */}
                          <div style={{ padding: "12px 18px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, borderBottom: "1px solid #F1F5F9" }}>
                            {[
                              { label: "REQUEST", val: r.total_request, color: "#0F172A" },
                              { label: "DIPENUHI", val: r.total_dipenuhi || 0, color: r.total_dipenuhi > 0 ? "#10B981" : "#CBD5E1" },
                              { label: "SISA", val: sisaKurang, color: sisaKurang > 0 ? "#F59E0B" : "#10B981" },
                            ].map(s => (
                              <div key={s.label} style={{ textAlign: "center" }}>
                                <div style={{ fontSize: 9, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase" }}>{s.label}</div>
                                <div style={{ fontSize: 20, fontWeight: 900, color: s.color, lineHeight: 1.2 }}>{s.val}<span style={{ fontSize: 10, color: "#94A3B8", fontWeight: 600 }}> pcs</span></div>
                              </div>
                            ))}
                          </div>

                          {/* Progress bar */}
                          {!isDitolak && (
                            <div style={{ padding: "8px 18px 0", borderBottom: "1px solid #F1F5F9" }}>
                              <div style={{ width: "100%", background: "#E2E8F0", height: 5, borderRadius: 99, overflow: "hidden", marginBottom: 4 }}>
                                <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: pct >= 100 ? "#10B981" : pct > 50 ? "#3B82F6" : "#F59E0B", borderRadius: 99, transition: "width 0.5s" }} />
                              </div>
                              <div style={{ fontSize: 10, color: "#94A3B8", textAlign: "right", paddingBottom: 8, fontWeight: 600 }}>{pct}% terpenuhi</div>
                            </div>
                          )}

                          {/* Pemotongan Kain Cross-Ref */}
                          {r.pemotongan ? (
                            <div style={{ padding: "10px 18px", background: "#F0FDF4", borderBottom: "1px solid #D1FAE5" }}>
                              <div style={{ fontSize: 10, fontWeight: 800, color: "#16A34A", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
                                <i className="fi fi-rr-layers" style={{ fontSize: 10 }} /> KAIN DIMINTA
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: 12, color: "#0F172A" }}>{r.pemotongan.nama_barang}</div>
                                  <div style={{ fontSize: 10, color: "#64748B" }}>Model: {r.pemotongan.model}</div>
                                </div>
                                <div style={{ fontWeight: 900, fontSize: 15, color: "#16A34A" }}>{r.pemotongan.sisa_total}<span style={{ fontSize: 10, color: "#64748B", fontWeight: 600 }}> sisa</span></div>
                              </div>
                              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                                {(r.pemotongan.sizeBreakdown || []).map((s: any) => (
                                  <span key={s.size} style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 5, background: s.sisa > 0 ? "#DCFCE7" : "#F1F5F9", color: s.sisa > 0 ? "#16A34A" : "#94A3B8", border: `1px solid ${s.sisa > 0 ? "#86EFAC" : "#E2E8F0"}` }}>
                                    {s.size}:{s.sisa}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div style={{ padding: "8px 18px", background: "#FFFBEB", borderBottom: "1px solid #FDE68A", fontSize: 10, color: "#92400E", display: "flex", alignItems: "center", gap: 4 }}>
                              <i className="fi fi-rr-info" style={{ fontSize: 10 }} /> Belum pilih kain - Admin tentukan saat proses
                            </div>
                          )}

                          {/* Catatan / Alasan Tolak */}
                          {(r.catatan || (isDitolak && r.alasan_tolak)) && (
                            <div style={{ padding: "8px 18px", borderBottom: "1px solid #F1F5F9", display: "flex", flexDirection: "column", gap: 4 }}>
                              {r.catatan && (
                                <div style={{ fontSize: 11, color: "#475569", display: "flex", gap: 5 }}>
                                  <i className="fi fi-rr-comment-alt" style={{ fontSize: 11, color: "#94A3B8", flexShrink: 0 }} />
                                  {r.catatan}
                                </div>
                              )}
                              {isDitolak && r.alasan_tolak && (
                                <div style={{ fontSize: 11, color: "#991B1B", display: "flex", gap: 5 }}>
                                  <i className="fi fi-rr-cross-circle" style={{ fontSize: 11, flexShrink: 0 }} />
                                  <span style={{ fontWeight: 700 }}>Ditolak:</span> {r.alasan_tolak}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Footer Actions */}
                          <div style={{ padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
                            <a href={`/cmt/${r.vendor_id}`} target="_blank" style={{ fontSize: 11, color: "#64748B", textDecoration: "none", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                              <ExternalLink size={12} /> Portal
                            </a>
                            {isPending && (
                              <div style={{ display: "flex", gap: 6 }}>
                                <button
                                  onClick={() => { setRejectRequest(r); setRejectReason(""); }}
                                  style={{ background: "#FEE2E2", color: "#991B1B", border: "1px solid #FECACA", padding: "6px 12px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}
                                >
                                  <X size={13} /> Tolak
                                </button>
                                <button
                                  onClick={() => {
                                    if (r.pemotongan?.is_transfer) {
                                      setDownstreamModal(r);
                                      const breakdown = r.pemotongan.sizeBreakdown || [];
                                      setDownstreamForm(breakdown.map((s:any) => ({
                                        size: s.size,
                                        max: Number(s.sisa || s.jumlah || 0),
                                        jumlah: ""
                                      })));
                                      return;
                                    }
                                    const targetQty = Number(r.total_request);
                                    let bestPemo = pemotonganList[0];
                                    if (pemotonganList.length > 1) {
                                      bestPemo = pemotonganList.reduce((best: any, p: any) => {
                                        const ts = p.sizeBreakdown.reduce((s: number, x: any) => s + (x.sisa || 0), 0);
                                        const bs = best.sizeBreakdown.reduce((s: number, x: any) => s + (x.sisa || 0), 0);
                                        return ts > bs ? p : best;
                                      });
                                    }
                                    // Prefer pemotongan yang dipilih CMT
                                    if (r.pemotongan_id) {
                                      const cmtPemo = pemotonganList.find((p: any) => p.id === r.pemotongan_id);
                                      if (cmtPemo) bestPemo = cmtPemo;
                                    }
                                    setProcessRequest(r);
                                    setForm({ pemotonganId: bestPemo ? String(bestPemo.id) : "", vendorId: String(r.vendor_id), catatan: `Pemenuhan request ${r.total_request} pcs dari ${r.vendor_nama}` });
                                    if (bestPemo) {
                                      const sizes = bestPemo.sizeBreakdown.filter((s: any) => s.sisa > 0);
                                      const numSizes = sizes.length;
                                      if (numSizes > 0) {
                                        const perSize = Math.floor(targetQty / numSizes);
                                        let rem = targetQty - (perSize * numSizes);
                                        const nb = bestPemo.sizeBreakdown.map((s: any) => {
                                          if (s.sisa <= 0) return { size: s.size, jumlah: 0, maxSisa: s.sisa };
                                          const extra = rem > 0 ? 1 : 0; rem -= extra;
                                          return { size: s.size, jumlah: Math.min(perSize + extra, s.sisa), maxSisa: s.sisa };
                                        });
                                        setSizeBreakdown(nb);
                                      }
                                    }
                                    setActiveTab("manual");
                                  }}
                                  style={{ background: "linear-gradient(135deg, #2563EB, #1D4ED8)", color: "white", border: "none", padding: "6px 14px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 4, boxShadow: "0 3px 8px rgba(37,99,235,0.3)" }}
                                >
                                  <CheckCheck size={13} /> Proses
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* TAB: Laporan Progres */}
      {/* TAB: Laporan CMT */}
      {activeTab === "laporan" && (() => {
        if (cmtProgres.length === 0) return (
          <div style={{ background: "white", borderRadius: 18, padding: 60, textAlign: "center", border: "1px solid #E2E8F0", marginBottom: 40 }}>
            <i className="fi fi-rr-check-circle" style={{ fontSize: 44, color: "#CBD5E1", display: "block", marginBottom: 14 }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: "#64748B" }}>Belum ada Laporan Progres dari Vendor CMT</div>
          </div>
        );

        // Group by vendor
        const vendorGroups: Record<string, { nama: string; items: any[] }> = {};
        for (const lp of cmtProgres) {
          const key = String(lp.vendor_id || lp.vendor_nama);
          if (!vendorGroups[key]) vendorGroups[key] = { nama: lp.vendor_nama, items: [] };
          vendorGroups[key].items.push(lp);
        }

        // Status config
        const statusCfg: Record<string, { badge: string; text: string; border: string }> = {
          "Menunggu": { badge: "#FEF3C7", text: "#92400E", border: "#FCD34D" },
          "Pending":  { badge: "#FEF3C7", text: "#92400E", border: "#FCD34D" },
          "Diterima": { badge: "#D1FAE5", text: "#065F46", border: "#6EE7B7" },
          "Ditolak":  { badge: "#FEE2E2", text: "#991B1B", border: "#FCA5A5" },
        };

        const pendingCount = cmtProgres.filter((r: any) => r.status === "Menunggu" || r.status === "Pending").length;

        return (
          <div style={{ marginBottom: 40 }}>
            {/* Section Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div style={{ background: "#ECFDF5", border: "1.5px solid #6EE7B7", borderRadius: 12, padding: "8px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                <i className="fi fi-sr-badge-check" style={{ fontSize: 18, color: "#059669" }} />
                <div>
                  <div style={{ fontWeight: 900, fontSize: 14, color: "#059669" }}>Laporan Progres CMT</div>
                  <div style={{ fontSize: 11, color: "#64748B" }}>
                    {cmtProgres.length} laporan
                    {pendingCount > 0 && <span style={{ marginLeft: 6, background: "#F59E0B", color: "white", borderRadius: 20, fontSize: 10, padding: "1px 6px", fontWeight: 900 }}>{pendingCount} menunggu ACC</span>}
                  </div>
                </div>
              </div>
              <div style={{ flex: 1, height: 1.5, background: "linear-gradient(to right, #6EE7B7, transparent)" }} />
            </div>

            {/* Cards Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
              {cmtProgres.map((lp: any) => {
                const sc = statusCfg[lp.status] || { badge: "#F1F5F9", text: "#64748B", border: "#E2E8F0" };
                const isPending = lp.status === "Menunggu" || lp.status === "Pending";
                return (
                  <div key={lp.id} style={{ background: "white", borderRadius: 16, border: `1px solid ${isPending ? sc.border : "#E2E8F0"}`, boxShadow: isPending ? `0 0 0 3px ${sc.badge}` : "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden", display: "flex", flexDirection: "column" }}>

                    {/* Card Header */}
                    <div style={{ padding: "14px 18px", background: isPending ? "#FFFBEB" : "#F8FAFC", borderBottom: `1px solid ${isPending ? "#FDE68A" : "#E2E8F0"}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: sc.badge, border: `2px solid ${sc.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 15, color: sc.text, flexShrink: 0 }}>
                          {lp.vendor_nama?.charAt(0) || "?"}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 14, color: "#0F172A" }}>{lp.vendor_nama}</div>
                          <div style={{ fontSize: 11, color: "#64748B", display: "flex", gap: 5, alignItems: "center" }}>
                            <i className="fi fi-rr-clock" style={{ fontSize: 10 }} />
                            {new Date(lp.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                            &nbsp;·&nbsp;
                            {new Date(lp.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 20, background: sc.badge, color: sc.text, border: `1px solid ${sc.border}`, flexShrink: 0 }}>
                        {isPending ? "Menunggu" : lp.status}
                      </span>
                    </div>

                    {/* PO & Stats */}
                    <div style={{ padding: "12px 18px", borderBottom: "1px solid #F1F5F9" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 10 }}>
                        <div style={{ background: "#F8FAFC", borderRadius: 10, padding: "8px 12px" }}>
                          <div style={{ fontSize: 9, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase" }}>PO / Model</div>
                          <div style={{ fontWeight: 900, fontSize: 14, color: "#0F172A" }}>{lp.noPo}</div>
                          <div style={{ fontSize: 11, color: "#64748B" }}>{lp.model}</div>
                        </div>
                        <div style={{ background: "#F0FDF4", borderRadius: 10, padding: "8px 12px" }}>
                          <div style={{ fontSize: 9, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase" }}>Total Selesai</div>
                          <div style={{ fontWeight: 900, fontSize: 22, color: "#10B981", lineHeight: 1.2 }}>{lp.totalJumlah}<span style={{ fontSize: 10, color: "#94A3B8" }}> pcs</span></div>
                        </div>
                      </div>
                      {/* Size breakdown */}
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        {(lp.items || []).map((it: any, i: number) => (
                          <span key={i} style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE" }}>
                            {it.size}: {it.jumlah}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Catatan */}
                    {lp.catatan && (
                      <div style={{ padding: "8px 18px", borderBottom: "1px solid #F1F5F9", fontSize: 11, color: "#475569", display: "flex", gap: 5 }}>
                        <i className="fi fi-rr-comment-alt" style={{ fontSize: 11, color: "#94A3B8", flexShrink: 0 }} />
                        {lp.catatan}
                      </div>
                    )}

                    {/* Footer Actions */}
                    <div style={{ padding: "10px 16px", display: "flex", justifyContent: isPending ? "flex-end" : "flex-start", alignItems: "center", marginTop: "auto" }}>
                      {isPending ? (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => handleTolakLaporan(lp.id)} style={{ background: "#FEE2E2", color: "#991B1B", border: "1px solid #FECACA", padding: "6px 12px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                            <X size={13} /> Tolak
                          </button>
                          <button onClick={() => handleTerimaLaporan(lp.id)} style={{ background: "linear-gradient(135deg, #10B981, #059669)", color: "white", border: "none", padding: "6px 14px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 4, boxShadow: "0 3px 8px rgba(16,185,129,0.3)" }}>
                            <CheckCheck size={13} /> ACC Terima
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: lp.status === "Diterima" ? "#10B981" : "#EF4444", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                          <i className={`fi ${lp.status === "Diterima" ? "fi-rr-check" : "fi-rr-cross-circle"}`} style={{ fontSize: 11 }} />
                          {lp.status === "Diterima" ? "Sudah di-ACC" : "Ditolak"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}


      {/* TAB: Laporan Washing */}
      {activeTab === "washing" && (() => {
        if (washingTransfers.length === 0) return (
          <div style={{ background: "white", borderRadius: 18, padding: 60, textAlign: "center", border: "1px solid #E2E8F0", marginBottom: 40 }}>
            <i className="fi fi-sr-water" style={{ fontSize: 44, color: "#A5F3FC", display: "block", marginBottom: 14 }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: "#64748B" }}>Belum ada laporan dari Vendor Washing</div>
          </div>
        );

        const pendingCount = washingTransfers.filter((r: any) => r.status === "Kirim").length;

        return (
          <div style={{ marginBottom: 40 }}>
            {/* Section Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div style={{ background: "#ECFEFF", border: "1.5px solid #A5F3FC", borderRadius: 12, padding: "8px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                <i className="fi fi-sr-water" style={{ fontSize: 18, color: "#0E7490" }} />
                <div>
                  <div style={{ fontWeight: 900, fontSize: 14, color: "#0E7490" }}>Laporan Vendor Washing / Laundry</div>
                  <div style={{ fontSize: 11, color: "#64748B" }}>
                    {washingTransfers.length} laporan
                    {pendingCount > 0 && <span style={{ marginLeft: 6, background: "#06B6D4", color: "white", borderRadius: 20, fontSize: 10, padding: "1px 6px", fontWeight: 900 }}>{pendingCount} dalam proses</span>}
                  </div>
                </div>
              </div>
              <div style={{ flex: 1, height: 1.5, background: "linear-gradient(to right, #A5F3FC, transparent)" }} />
            </div>

            {/* Cards Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
              {washingTransfers.map((wt: any) => {
                const isPending = wt.status === "Kirim";
                return (
                  <div key={wt.id} style={{ background: "white", borderRadius: 16, border: `1px solid ${isPending ? "#A5F3FC" : "#E2E8F0"}`, boxShadow: isPending ? "0 0 0 3px #ECFEFF" : "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden", display: "flex", flexDirection: "column" }}>

                    {/* Card Header */}
                    <div style={{ padding: "14px 18px", background: isPending ? "#ECFEFF" : "#F8FAFC", borderBottom: `1px solid ${isPending ? "#A5F3FC" : "#E2E8F0"}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: isPending ? "#E0F2FE" : "#D1FAE5", border: `2px solid ${isPending ? "#7DD3FC" : "#6EE7B7"}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 15, color: isPending ? "#0369A1" : "#065F46", flexShrink: 0 }}>
                          {wt.vendor_nama?.charAt(0) || "?"}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 14, color: "#0F172A" }}>{wt.vendor_nama}</div>
                          <div style={{ fontSize: 11, color: "#64748B", display: "flex", gap: 5, alignItems: "center" }}>
                            <i className="fi fi-rr-clock" style={{ fontSize: 10 }} />
                            {new Date(wt.tanggal_kirim).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                          </div>
                        </div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 20, background: isPending ? "#E0F2FE" : "#D1FAE5", color: isPending ? "#0369A1" : "#065F46", border: `1px solid ${isPending ? "#7DD3FC" : "#6EE7B7"}`, flexShrink: 0 }}>
                        {isPending ? "Dalam Proses" : "Selesai"}
                      </span>
                    </div>

                    {/* PO & Stats */}
                    <div style={{ padding: "12px 18px", borderBottom: "1px solid #F1F5F9" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 10 }}>
                        <div style={{ background: "#F8FAFC", borderRadius: 10, padding: "8px 12px" }}>
                          <div style={{ fontSize: 9, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase" }}>PO / Model</div>
                          <div style={{ fontWeight: 900, fontSize: 14, color: "#0F172A" }}>{wt.noPo}</div>
                          <div style={{ fontSize: 11, color: "#64748B" }}>{wt.model}</div>
                        </div>
                        <div style={{ background: "#F0F9FF", borderRadius: 10, padding: "8px 12px" }}>
                          <div style={{ fontSize: 9, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase" }}>Total Dikirim</div>
                          <div style={{ fontWeight: 900, fontSize: 22, color: "#06B6D4", lineHeight: 1.2 }}>{wt.jumlah_kirim}<span style={{ fontSize: 10, color: "#94A3B8" }}> pcs</span></div>
                        </div>
                      </div>
                      {/* Size breakdown */}
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        {(wt.sizeBreakdown || []).map((it: any, i: number) => (
                          <span key={i} style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: "#E0F2FE", color: "#0369A1", border: "1px solid #7DD3FC" }}>
                            {it.size}: {it.jumlah}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Catatan */}
                    {wt.catatan && (
                      <div style={{ padding: "8px 18px", borderBottom: "1px solid #F1F5F9", fontSize: 11, color: "#475569", display: "flex", gap: 5 }}>
                        <i className="fi fi-rr-comment-alt" style={{ fontSize: 11, color: "#94A3B8", flexShrink: 0 }} />
                        {wt.catatan}
                      </div>
                    )}

                    {/* Footer Actions */}
                    <div style={{ padding: "10px 16px", display: "flex", justifyContent: isPending ? "flex-end" : "flex-start", alignItems: "center", marginTop: "auto" }}>
                      {isPending ? (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            onClick={async () => {
                              if (!confirm("Tolak laporan washing ini?")) return;
                              const res = await fetch("/api/produksi-transfer", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: wt.id, jumlah_diterima: 0, catatan_terima: "DITOLAK" }) });
                              if (res.ok) { toast.success("Laporan ditolak"); fetchAll(); } else { toast.error("Gagal menolak"); }
                            }}
                            style={{ background: "#FEE2E2", color: "#991B1B", border: "1px solid #FECACA", padding: "6px 12px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}
                          >
                            <X size={13} /> Tolak
                          </button>
                          <button
                            onClick={async () => {
                              const res = await fetch("/api/produksi-transfer", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: wt.id, jumlah_diterima: wt.jumlah_kirim, sizeBreakdown_diterima: wt.sizeBreakdown, catatan_terima: "ACC oleh Admin" }) });
                              if (res.ok) { toast.success("Laporan Washing di-ACC!"); fetchAll(); } else { toast.error("Gagal ACC"); }
                            }}
                            style={{ background: "linear-gradient(135deg, #06B6D4, #0E7490)", color: "white", border: "none", padding: "6px 14px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 4, boxShadow: "0 3px 8px rgba(6,182,212,0.3)" }}
                          >
                            <CheckCheck size={13} /> ACC Selesai
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: "#10B981", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                          <i className="fi fi-rr-check" style={{ fontSize: 11 }} /> Sudah Diverifikasi
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}



      {rejectRequest && (
        <div className="modal-overlay" onClick={() => setRejectRequest(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Tolak Request</h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: 16, fontSize: 14 }}>
              Masukkan alasan penolakan untuk request sejumlah <strong>{rejectRequest.total_request} pcs</strong> dari <strong>{rejectRequest.vendor_nama}</strong>.
            </p>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!rejectReason.trim()) return alert("Alasan tolak wajib diisi.");
              try {
                const res = await fetch("/api/cmt-request", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id: rejectRequest.id, status: "Ditolak", alasan_tolak: rejectReason })
                });
                if (res.ok) {
                  toast.success("Request berhasil ditolak");
                  setRejectRequest(null);
                  fetchAll();
                }
              } catch (e) {
                console.error(e);
              }
            }}>
              <textarea 
                required
                className="form-control" 
                placeholder="Misal: Stok kain potongan sedang kosong..." 
                rows={4}
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
              />
              <div className="modal-footer" style={{ marginTop: 24 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setRejectRequest(null)}>Batal</button>
                <button type="submit" className="btn" style={{ background: "#EF4444", color: "white" }}>Tolak Request</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === "manual" && (
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Section 1 */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{ background: "#EFF6FF", border: "1.5px solid #93C5FD", borderRadius: 12, padding: "8px 16px", display: "flex", alignItems: "center", gap: 10 }}>
              <i className="fi fi-rr-document" style={{ fontSize: 18, color: "#2563EB" }} />
              <div>
                <div style={{ fontWeight: 900, fontSize: 14, color: "#2563EB" }}>Langkah 1: Sumber & Tujuan</div>
                <div style={{ fontSize: 11, color: "#64748B" }}>Pilih stok potongan dan vendor</div>
              </div>
            </div>
            <div style={{ flex: 1, height: 1.5, background: "linear-gradient(to right, #93C5FD, transparent)" }} />
          </div>
          
          <div style={{ background: "white", borderRadius: 16, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", border: "1px solid #E2E8F0" }}>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 8 }}>Ambil Dari Stok Potongan <span style={{ color: "#EF4444" }}>*</span></label>
              <select 
                required 
                style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: "2px solid #E2E8F0", fontSize: 15, fontWeight: 600, color: "#0F172A", background: "#F8FAFC", outline: "none", transition: "border 0.2s", cursor: "pointer" }}
                value={form.pemotonganId} 
                onChange={e => handlePemotonganChange(e.target.value)}
                onFocus={e => e.target.style.border = "2px solid #3B82F6"}
                onBlur={e => e.target.style.border = "2px solid #E2E8F0"}
              >
                <option value="">-- Pilih Stok Hasil Potong --</option>
                {pemotonganList.map(p => {
                  const totalSisa = p.sizeBreakdown.reduce((sum:number, s:any) => sum + s.sisa, 0);
                  return (
                    <option key={p.id} value={p.id}>
                      {p.tukang_potong_nama} ({p.tukang_potong_kode}) - Model: {p.model} - Sisa: {totalSisa} pcs
                    </option>
                  );
                })}
              </select>
              <div style={{ fontSize: 12, color: "#64748B", marginTop: 8, display: "flex", alignItems: "center", gap: 6, fontWeight: 500 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: selectedPemotongan ? "#10B981" : "#CBD5E1" }}></div>
                No PO Otomatis: <span style={{ fontWeight: 700, color: selectedPemotongan ? "#0F172A" : "#94A3B8" }}>{selectedPemotongan ? `${selectedPemotongan.tukang_potong_kode}-...` : "Menunggu Pilihan"}</span>
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 8 }}>Vendor / CMT Tujuan <span style={{ color: "#EF4444" }}>*</span></label>
              <select 
                required 
                style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: "2px solid #E2E8F0", fontSize: 15, fontWeight: 600, color: "#0F172A", background: "#F8FAFC", outline: "none", transition: "border 0.2s", cursor: "pointer" }}
                value={form.vendorId} 
                onChange={e => setForm({...form, vendorId: e.target.value})}
                onFocus={e => e.target.style.border = "2px solid #3B82F6"}
                onBlur={e => e.target.style.border = "2px solid #E2E8F0"}
              >
                <option value="">-- Pilih CMT --</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>{v.nama} ({v.jenis_pekerjaan})</option>
                ))}
              </select>
            </div>
            
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 8 }}>Catatan (Opsional)</label>
              <input 
                type="text" 
                placeholder="Misal: Tolong dijahit dengan benang warna merah..."
                style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: "2px solid #E2E8F0", fontSize: 15, color: "#0F172A", background: "#F8FAFC", outline: "none", transition: "border 0.2s" }}
                value={form.catatan} 
                onChange={e => setForm({...form, catatan: e.target.value})} 
                onFocus={e => e.target.style.border = "2px solid #3B82F6"}
                onBlur={e => e.target.style.border = "2px solid #E2E8F0"}
              />
            </div>
          </div>
          </div>
        </div>

        {/* Section 2 */}
        <div style={{ opacity: selectedPemotongan ? 1 : 0.6, pointerEvents: selectedPemotongan ? "auto" : "none", transition: "all 0.3s ease" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{ background: "#ECFDF5", border: "1.5px solid #6EE7B7", borderRadius: 12, padding: "8px 16px", display: "flex", alignItems: "center", gap: 10 }}>
              <i className="fi fi-rr-apps" style={{ fontSize: 18, color: "#059669" }} />
              <div>
                <div style={{ fontWeight: 900, fontSize: 14, color: "#059669" }}>Langkah 2: Breakdown Ukuran</div>
                <div style={{ fontSize: 11, color: "#64748B" }}>Tentukan kuantitas untuk tiap size</div>
              </div>
            </div>
            <div style={{ flex: 1, height: 1.5, background: "linear-gradient(to right, #6EE7B7, transparent)" }} />
            <div style={{ background: totalPcs > 0 ? "#10B981" : "#F1F5F9", color: totalPcs > 0 ? "white" : "#64748B", padding: "6px 14px", borderRadius: 20, fontWeight: 700, fontSize: 13, boxShadow: totalPcs > 0 ? "0 4px 10px rgba(16, 185, 129, 0.3)" : "none", transition: "all 0.3s", display: "flex", gap: 6, alignItems: "center" }}>
              Total: <span style={{ fontWeight: 900, fontSize: 14 }}>{totalPcs} pcs</span>
            </div>
          </div>

          <div style={{ background: "white", borderRadius: 16, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", border: "1px solid #E2E8F0" }}>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 20, marginBottom: 16 }}>
            {sizeBreakdown.map((item, idx) => (
              <div key={idx} style={{ 
                border: item.jumlah > 0 ? "2px solid #3B82F6" : "2px solid #F1F5F9", 
                borderRadius: 16, 
                padding: "20px 16px", 
                background: item.jumlah > 0 ? "#EFF6FF" : "#FFFFFF", 
                boxShadow: item.jumlah > 0 ? "0 10px 15px -3px rgba(59, 130, 246, 0.15)" : "0 4px 6px -1px rgba(0,0,0,0.02)",
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                display: "flex", 
                flexDirection: "column", 
                alignItems: "center",
                gap: 12,
                transform: item.jumlah > 0 ? "translateY(-2px)" : "none"
              }}>
                <div style={{ background: item.jumlah > 0 ? "#3B82F6" : "#F8FAFC", color: item.jumlah > 0 ? "white" : "#334155", width: 56, height: 56, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 20, transition: "all 0.2s", border: item.jumlah > 0 ? "none" : "1px solid #E2E8F0", boxShadow: item.jumlah > 0 ? "0 4px 10px rgba(59,130,246,0.4)" : "none" }}>
                  {item.size}
                </div>
                <div style={{ fontSize: 12, textAlign: "center", color: item.jumlah > 0 ? "#2563EB" : "#64748B", fontWeight: 700, background: item.jumlah > 0 ? "#DBEAFE" : "#F1F5F9", padding: "4px 10px", borderRadius: 12 }}>
                  Sisa: {item.maxSisa}
                </div>
                <input 
                  type="number" 
                  min="0" 
                  max={item.maxSisa}
                  style={{ textAlign: "center", padding: "10px 12px", width: "100%", borderRadius: 10, border: item.jumlah > 0 ? "1px solid #93C5FD" : "1px solid #E2E8F0", fontSize: 16, fontWeight: 700, color: "#0F172A", outline: "none", transition: "all 0.2s" }}
                  value={item.jumlah === 0 ? '' : item.jumlah} 
                  onChange={e => {
                    const val = parseInt(e.target.value) || 0;
                    if (val > item.maxSisa) return toast.error(`Maksimal sisa stok untuk size ${item.size} adalah ${item.maxSisa}`);
                    const newB = [...sizeBreakdown];
                    newB[idx].jumlah = val;
                    setSizeBreakdown(newB);
                  }} 
                  onFocus={e => e.target.style.border = "1px solid #3B82F6"}
                  onBlur={e => e.target.style.border = item.jumlah > 0 ? "1px solid #93C5FD" : "1px solid #E2E8F0"}
                  placeholder="0" 
                />
              </div>
            ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12, marginBottom: 40 }}>
          <button 
            type="submit" 
            disabled={loading || totalPcs === 0 || !selectedPemotongan} 
            style={{ 
              padding: "16px 32px", 
              fontSize: 16, 
              fontWeight: 800, 
              background: (loading || totalPcs === 0 || !selectedPemotongan) ? "#94A3B8" : "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)", 
              color: "white", 
              borderRadius: 14, 
              border: "none", 
              cursor: (loading || totalPcs === 0 || !selectedPemotongan) ? "not-allowed" : "pointer",
              boxShadow: (loading || totalPcs === 0 || !selectedPemotongan) ? "none" : "0 10px 20px -5px rgba(37, 99, 235, 0.4)",
              display: "flex",
              alignItems: "center",
              gap: 12,
              transition: "all 0.2s"
            }}
          >
            {loading ? "Memproses..." : "Terbitkan PO & Barcode"} <ChevronRight size={20} />
          </button>
        </div>
        </form>
      </div>
      )}
      {/* Downstream Modal */}
      {downstreamModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", padding: 24, borderRadius: 16, width: 450, maxWidth: "90%" }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 18 }}>ACC Pekerjaan {downstreamModal.vendor_nama}</h3>
            <p style={{ margin: "0 0 16px", fontSize: 14, color: "#64748B" }}>
              Request: <strong>{downstreamModal.total_request} pcs</strong><br/>
              Dari PO: <strong>{downstreamModal.pemotongan?.nama_barang} ({downstreamModal.pemotongan?.model})</strong><br/>
              Sisa di Standby Pool: <strong>{downstreamModal.pemotongan?.sisa_total} pcs</strong>
            </p>
            <form onSubmit={handleDownstreamSubmit}>
              <div style={{ maxHeight: 300, overflowY: "auto", marginBottom: 16 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#F1F5F9", textAlign: "left", fontSize: 13 }}>
                      <th style={{ padding: 8 }}>Size</th>
                      <th style={{ padding: 8 }}>Tersedia</th>
                      <th style={{ padding: 8 }}>ACC (Pcs)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {downstreamForm.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid #E2E8F0" }}>
                        <td style={{ padding: 8, fontWeight: "bold" }}>{item.size}</td>
                        <td style={{ padding: 8 }}>{item.max}</td>
                        <td style={{ padding: 8 }}>
                          <input 
                            type="number" 
                            min="0"
                            max={item.max}
                            value={item.jumlah}
                            onChange={(e) => {
                              const val = e.target.value;
                              const newF = [...downstreamForm];
                              newF[idx].jumlah = val === "" ? "" : Number(val);
                              setDownstreamForm(newF);
                            }}
                            style={{ width: 80, padding: 6, borderRadius: 6, border: "1px solid #CBD5E1" }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button type="button" onClick={() => setDownstreamModal(null)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #CBD5E1", background: "white", cursor: "pointer" }}>Batal</button>
                <button type="submit" disabled={isSubmittingDownstream} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#3B82F6", color: "white", fontWeight: "bold", cursor: "pointer" }}>
                  {isSubmittingDownstream ? "Memproses..." : "Tugaskan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

