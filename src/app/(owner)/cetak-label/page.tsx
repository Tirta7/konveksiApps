"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Barcode from "react-barcode";
import { ArrowLeft, Printer, Tag } from "lucide-react";

type LabelGroup = {
  kode: string;
  nama_barang: string;
  noPo?: string;
  sizes: { size: string; jumlah: number; sku: string }[];
};

type Label = { sku: string; nama: string; size: string; parent: boolean; total?: number; noPo?: string };

const MAX_LABELS = 2000;

function CetakLabelInner() {
  const router = useRouter();
  const params = useSearchParams();
  const movParam = params.get("mov");
  const barangParam = params.get("barang");

  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<LabelGroup[]>([]);
  const [namaUsaha, setNamaUsaha] = useState("");
  const [perPcs, setPerPcs] = useState(true);
  const [withParent, setWithParent] = useState(true);
  const [labelW, setLabelW] = useState(50);
  const [labelH, setLabelH] = useState(30);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/stock");
        const d = await res.json();
        setNamaUsaha(d.nama_usaha || "");
        const out: LabelGroup[] = [];
        if (movParam) {
          const ids = movParam.split(",").map((s) => s.trim()).filter(Boolean);
          for (const m of d.movements || []) {
            if (!ids.includes(String(m.id)) || m.jenis !== "masuk") continue;
            out.push({
              kode: m.kode || "",
              nama_barang: m.nama_barang || m.kategori || "-",
              noPo: m.noPo,
              sizes: (m.items || []).map((it: any) => ({
                size: it.size,
                jumlah: Number(it.jumlah) || 0,
                sku: it.sku || (m.kode ? `${m.kode}-${it.size}` : it.size),
              })),
            });
          }
        } else if (barangParam) {
          const row = (d.stock || []).find(
            (r: any) => String(r.barang_id) === String(barangParam) || String(r.key) === String(barangParam)
          );
          if (row) {
            out.push({
              kode: row.kode || "",
              nama_barang: row.nama_barang || row.kategori || "-",
              sizes: (row.sizes || [])
                .filter((s: any) => Number(s.jumlah) > 0)
                .map((s: any) => ({ size: s.size, jumlah: Number(s.jumlah) || 0, sku: s.sku || `${row.kode}-${s.size}` })),
            });
          }
        }
        setGroups(out);
      } finally {
        setLoading(false);
      }
    })();
  }, [movParam, barangParam]);

  const labels = useMemo<Label[]>(() => {
    const list: Label[] = [];
    for (const g of groups) {
      const total = g.sizes.reduce((s, x) => s + x.jumlah, 0);
      if (withParent && g.kode) list.push({ sku: g.kode, nama: g.nama_barang, size: "ALL", parent: true, total, noPo: g.noPo });
      for (const s of g.sizes) {
        const n = perPcs ? s.jumlah : 1;
        for (let i = 0; i < n && list.length < MAX_LABELS; i++) {
          list.push({ sku: s.sku, nama: g.nama_barang, size: s.size, parent: false });
        }
      }
    }
    return list.slice(0, MAX_LABELS);
  }, [groups, perPcs, withParent]);

  const totalPcs = groups.reduce((s, g) => s + g.sizes.reduce((a, x) => a + x.jumlah, 0), 0);
  const truncated = perPcs && totalPcs + (withParent ? groups.length : 0) > MAX_LABELS;

  const btn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1px solid #CBD5E1", background: "white", fontWeight: 700, fontSize: 13, cursor: "pointer" };

  return (
    <div style={{ background: "#E2E8F0", minHeight: "100vh", padding: "18px 14px", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <style>{`
        @page { size: auto; margin: 4mm; }
        @media print {
          html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
          body * { visibility: hidden; }
          .print-container, .print-container * { visibility: visible; }
          .print-container { position: absolute; left: 0; top: 0; width: 100% !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; background: #fff !important; }
          .no-print { display: none !important; }
          .sku-label { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      {/* KONTROL (NO PRINT) */}
      <div className="no-print" style={{ width: "100%", maxWidth: 900, background: "white", borderRadius: 12, padding: "14px 16px", boxShadow: "0 4px 10px rgba(0,0,0,0.06)", marginBottom: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button id="btn-label-kembali" style={btn} onClick={() => router.push("/gudang")}><ArrowLeft size={15} /> Kembali</button>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}><Tag size={15} /> Cetak Label Barcode Barang Jadi</div>
              <div style={{ fontSize: 12, color: "#64748B" }}>{groups.length} barang · {totalPcs} pcs · {labels.length} label</div>
            </div>
          </div>
          <button id="btn-label-print" disabled={labels.length === 0} onClick={() => window.print()} style={{ ...btn, background: "#2563EB", color: "white", border: "none" }}>
            <Printer size={15} /> Cetak Label
          </button>
        </div>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 13, alignItems: "center" }}>
          <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
            <input id="chk-label-perpcs" type="checkbox" checked={perPcs} onChange={(e) => setPerPcs(e.target.checked)} />
            Jumlah label = jumlah pcs (matikan → 1 label per size)
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
            <input id="chk-label-parent" type="checkbox" checked={withParent} onChange={(e) => setWithParent(e.target.checked)} />
            Sertakan label induk (total semua size)
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            Ukuran
            <select id="sel-label-size" value={`${labelW}x${labelH}`} onChange={(e) => { const [w, h] = e.target.value.split("x").map(Number); setLabelW(w); setLabelH(h); }} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #CBD5E1" }}>
              <option value="50x30">50 × 30 mm</option>
              <option value="40x30">40 × 30 mm</option>
              <option value="33x15">33 × 15 mm</option>
              <option value="60x40">60 × 40 mm</option>
            </select>
          </label>
        </div>
        {truncated && (
          <div style={{ fontSize: 12, color: "#B45309", background: "#FEF3C7", padding: "6px 10px", borderRadius: 6 }}>
            Label dibatasi {MAX_LABELS} lembar per cetak. Matikan opsi &quot;jumlah label = jumlah pcs&quot; atau cetak per barang.
          </div>
        )}
        {groups.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {groups.map((g, i) => (
              <div key={i} style={{ fontSize: 12, border: "1px solid #E2E8F0", borderRadius: 8, padding: "6px 10px" }}>
                <b>{g.nama_barang}</b> <span style={{ color: "#2563EB", fontFamily: "monospace" }}>{g.kode}</span>
                <div style={{ color: "#64748B" }}>{g.sizes.map((s) => `${s.size}:${s.jumlah}`).join(" · ")}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AREA LABEL */}
      <div className="print-container" style={{ width: "100%", maxWidth: 900, background: "white", borderRadius: 12, padding: 12, boxShadow: "0 4px 10px rgba(0,0,0,0.06)" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#64748B" }}>Memuat label...</div>
        ) : labels.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#64748B" }}>Tidak ada data label. Buka dari halaman Gudang &amp; Stok.</div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "2mm" }}>
            {labels.map((l, i) => {
              const small = labelH <= 15;
              return (
                <div key={i} className="sku-label" style={{
                  width: `${labelW}mm`, height: `${labelH}mm`, boxSizing: "border-box", border: l.parent ? "1.5px solid #000" : "1px dashed #94A3B8",
                  padding: "1mm 1.5mm", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", overflow: "hidden",
                  fontFamily: "Arial, sans-serif", color: "#000", background: l.parent ? "#F1F5F9" : "#fff",
                }}>
                  {!small && (
                    <div style={{ width: "100%", display: "flex", justifyContent: "space-between", fontSize: 6.5, fontWeight: 700, lineHeight: 1.1 }}>
                      <span style={{ overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", maxWidth: "70%" }}>{namaUsaha || "BARANG JADI"}</span>
                      <span>{l.parent ? "INDUK" : ""}</span>
                    </div>
                  )}
                  <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 4, lineHeight: 1.1 }}>
                    <span style={{ fontSize: small ? 6.5 : 8, fontWeight: 800, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{l.nama}</span>
                    <span style={{ fontSize: small ? 8 : 11, fontWeight: 900 }}>{l.parent ? `${l.total} pcs` : l.size}</span>
                  </div>
                  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", width: "100%", overflow: "hidden" }}>
                    <Barcode value={l.sku} format="CODE128" width={labelW >= 50 ? 1.3 : 1} height={Math.max(14, (labelH - (small ? 7 : 13)) * 3.2)} fontSize={small ? 8 : 10} margin={0} displayValue background="transparent" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CetakLabelPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center" }}>Memuat...</div>}>
      <CetakLabelInner />
    </Suspense>
  );
}
