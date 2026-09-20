"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";

export default function CetakPOPage() {
  const { id } = useParams();
  const router = useRouter();
  const [po, setPo] = useState<any>(null);
  const [vendor, setVendor] = useState<any>(null);

  useEffect(() => {
    async function load() {
      const [poRes, vRes] = await Promise.all([
        fetch("/api/po-produksi"),
        fetch("/api/vendors")
      ]);
      const poList = await poRes.json();
      const vList = await vRes.json();
      
      const foundPo = poList.find((p: any) => String(p.id) === String(id));
      if (foundPo) {
        setPo(foundPo);
        setVendor(vList.find((v: any) => String(v.id) === String(foundPo.vendorId)));
      } else {
        setPo({ notFound: true });
      }
    }
    load();
  }, [id]);

  if (!po) return <div style={{ padding: 40, textAlign: "center" }}>Memuat Nota PO...</div>;
  if (po.notFound) return <div style={{ padding: 40, textAlign: "center", color: "red", fontWeight: "bold" }}>Data PO tidak ditemukan.</div>;

  const totalPcs = po.sizeBreakdown.reduce((sum: number, b: any) => sum + b.jumlah, 0);

  return (
    <div style={{ background: "#E2E8F0", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 20px" }}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>
      
      <div className="no-print" style={{ width: "100%", maxWidth: 800, display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <button className="btn" style={{ background: "white", color: "#475569" }} onClick={() => router.back()}>
          <ArrowLeft size={18} /> Kembali
        </button>
        <button className="btn btn-primary" onClick={() => window.print()}>
          <Printer size={18} /> Cetak Nota PO
        </button>
      </div>

      {/* A4 Paper Size container */}
      <div className="print-area" style={{ width: "100%", maxWidth: 800, background: "white", padding: 40, boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "2px solid #000", paddingBottom: 20, marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, textTransform: "uppercase" }}>PURCHASE ORDER (PO)</h1>
            <div style={{ fontSize: 14, color: "#475569", marginTop: 4 }}>NOTA KERJA CMT / JAHIT</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, fontFamily: "monospace" }}>{po.noPo}</h2>
            <div style={{ fontSize: 14, color: "#475569" }}>Tgl: {new Date(po.tanggalTerbit).toLocaleDateString("id-ID")}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 40, marginBottom: 30 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", marginBottom: 4 }}>Diterbitkan Oleh:</div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>KonveksiApps Pusat</div>
            <div style={{ fontSize: 14, color: "#475569" }}>Divisi Produksi</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", marginBottom: 4 }}>Diberikan Kepada (CMT):</div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{vendor?.nama || "-"}</div>
            <div style={{ fontSize: 14, color: "#475569" }}>Telp: {vendor?.telepon || "-"}</div>
            <div style={{ fontSize: 14, color: "#475569" }}>{vendor?.alamat || "-"}</div>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", marginBottom: 4 }}>Spesifikasi Model:</div>
          <div style={{ fontSize: 18, fontWeight: 900 }}>{po.model}</div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 30 }}>
          <thead>
            <tr>
              <th style={{ borderBottom: "1px solid #000", borderTop: "1px solid #000", padding: "10px 0", textAlign: "left", fontSize: 14 }}>UKURAN (SIZE)</th>
              <th style={{ borderBottom: "1px solid #000", borderTop: "1px solid #000", padding: "10px 0", textAlign: "right", fontSize: 14 }}>JUMLAH (PCS)</th>
            </tr>
          </thead>
          <tbody>
            {po.sizeBreakdown.map((b: any, i: number) => (
              <tr key={i}>
                <td style={{ borderBottom: "1px solid #E2E8F0", padding: "10px 0", fontSize: 14, fontWeight: 700 }}>{b.size}</td>
                <td style={{ borderBottom: "1px solid #E2E8F0", padding: "10px 0", textAlign: "right", fontSize: 14, fontWeight: 800 }}>{b.jumlah}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ paddingTop: 10, fontSize: 16, fontWeight: 900 }}>TOTAL KESELURUHAN</td>
              <td style={{ paddingTop: 10, textAlign: "right", fontSize: 18, fontWeight: 900 }}>{totalPcs} pcs</td>
            </tr>
          </tfoot>
        </table>

        {po.catatan && (
          <div style={{ background: "#F1F5F9", padding: 16, borderRadius: 8, marginBottom: 40 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 4 }}>CATATAN TAMBAHAN:</div>
            <div style={{ fontSize: 14 }}>{po.catatan}</div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 60 }}>
          <div style={{ textAlign: "center", width: 200 }}>
            <div style={{ fontSize: 12, color: "#475569", marginBottom: 60 }}>Pihak Penyerah (Konveksi)</div>
            <div style={{ borderBottom: "1px solid #000", marginBottom: 4 }}></div>
            <div style={{ fontSize: 12, fontWeight: 700 }}>Admin Produksi</div>
          </div>
          <div style={{ textAlign: "center", width: 200 }}>
            <div style={{ fontSize: 12, color: "#475569", marginBottom: 60 }}>Pihak Penerima (CMT)</div>
            <div style={{ borderBottom: "1px solid #000", marginBottom: 4 }}></div>
            <div style={{ fontSize: 12, fontWeight: 700 }}>{vendor?.nama || "Ttd CMT"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
