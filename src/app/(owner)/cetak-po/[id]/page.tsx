"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Printer, ArrowLeft, Layers, Zap } from "lucide-react";

export default function CetakPOPage() {
  const { id } = useParams();
  const router = useRouter();
  const [po, setPo] = useState<any>(null);
  const [vendor, setVendor] = useState<any>(null);
  const [pemotongan, setPemotongan] = useState<any>(null);
  const [activePly, setActivePly] = useState<"ncr" | "1" | "2" | "3" | "all">("ncr");
  const [density, setDensity] = useState<"extra" | "normal">("extra");
  const [pengaturan, setPengaturan] = useState<any>({
    nama_usaha: "KONVEKSI APPS | JEANS PRODUCTION",
    tagline: "Sistem Tracking Produksi Jeans",
    alamat: "Jl. Industri Konveksi No. 88",
    telepon: "(022) 555-8899",
    email: "info@konveksiapps.com",
    divisi: "Divisi Produksi & Sewing (CMT)",
    catatan_surat_jalan: "Potongan kain dan aksesoris pendukung di atas telah diperiksa, dihitung, dan diserahkan dalam kondisi lengkap untuk proses jahit.",
    jabatan_penyerah: "Bagian Gudang & Potongan",
    jabatan_penerima: "Vendor CMT / Penjahit",
    jabatan_penyetuju: "Admin Produksi / Supervisor"
  });

  useEffect(() => {
    async function loadData() {
      try {
        const [poRes, vRes, pRes, sRes] = await Promise.all([
          fetch("/api/po-produksi"),
          fetch("/api/vendors"),
          fetch("/api/pemotongan").catch(() => null),
          fetch("/api/pengaturan").catch(() => null)
        ]);

        const poList = await poRes.json();
        const vList = await vRes.json();
        const pList = pRes && pRes.ok ? await pRes.json() : [];

        if (sRes && sRes.ok) {
          const sData = await sRes.json();
          setPengaturan((prev: any) => ({ ...prev, ...sData }));
        }

        const foundPo = (poList || []).find((p: any) => String(p.id) === String(id));
        if (foundPo) {
          setPo(foundPo);
          setVendor((vList || []).find((v: any) => String(v.id) === String(foundPo.vendorId)));
          if (foundPo.pemotongan_id && Array.isArray(pList)) {
            const foundPemo = pList.find((pm: any) => String(pm.id) === String(foundPo.pemotongan_id));
            setPemotongan(foundPemo || null);
          }
        } else {
          setPo({ notFound: true });
        }
      } catch (err) {
        setPo({ notFound: true });
      }
    }
    loadData();
  }, [id]);

  if (!po) {
    return (
      <div style={{ padding: 60, textAlign: "center", fontFamily: "monospace", fontSize: 15 }}>
        Memuat Dokumen Nota PO (Dot Matrix)...
      </div>
    );
  }

  if (po.notFound) {
    return (
      <div style={{ padding: 60, textAlign: "center", color: "#DC2626", fontFamily: "monospace" }}>
        Data PO Produksi #{id} tidak ditemukan.
        <div style={{ marginTop: 16 }}>
          <button className="btn" onClick={() => router.back()}>Kembali</button>
        </div>
      </div>
    );
  }

  const totalPcs = (po.sizeBreakdown || []).reduce((sum: number, b: any) => sum + (Number(b.jumlah) || 0), 0);
  const targetSelesai = po.target_selesai || pemotongan?.target_selesai || null;
  const durasiHari = po.tanggalTerbit && targetSelesai
    ? Math.max(1, Math.ceil((new Date(targetSelesai).getTime() - new Date(po.tanggalTerbit).getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  // Ply configurations for 3-ply continuous paper
  const plyConfig = {
    "1": { label: "LEMBAR 1: ASLI", warna: "PUTIH", tujuan: "Arsip Kantor / Admin Produksi", badgeColor: "#0F172A", borderStyle: "solid" },
    "2": { label: "LEMBAR 2: MERAH (DUPLIKAT)", warna: "MERAH / PINK", tujuan: "Pihak Penerima (Vendor CMT / Jahit)", badgeColor: "#DC2626", borderStyle: "dashed" },
    "3": { label: "LEMBAR 3: KUNING (TRIPLIKAT)", warna: "KUNING", tujuan: "Gudang Produksi / Finishing / QC", badgeColor: "#D97706", borderStyle: "dashed" }
  };

  const isExtra = density === "extra";

  const renderSinglePly = (plyNumber: "1" | "2" | "3" | "ncr", isMulti = false) => {
    const isNCR = plyNumber === "ncr";
    const ply = plyConfig[plyNumber === "ncr" ? "1" : plyNumber];

    return (
      <div
        key={plyNumber}
        className="dotmatrix-sheet"
        style={{
          width: "100%",
          maxWidth: 820,
          boxSizing: "border-box",
          background: "white",
          color: "#000",
          fontFamily: "'Courier New', Courier, 'Lucida Console', Monaco, monospace",
          fontSize: isExtra ? 9.5 : 10.5,
          lineHeight: isExtra ? 1.2 : 1.3,
          padding: isExtra ? "12px 16px" : "16px 20px",
          border: "1px dashed #334155",
          marginBottom: isMulti ? 20 : 0,
          pageBreakAfter: isMulti && plyNumber !== "3" ? "always" : "auto",
          boxShadow: isMulti ? "0 4px 6px rgba(0,0,0,0.05)" : "none",
          overflow: "hidden"
        }}
      >
        {/* TOP HEADER */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          borderBottom: "1.5px solid #000",
          paddingBottom: isExtra ? 4 : 6,
          marginBottom: isExtra ? 5 : 8,
          boxSizing: "border-box"
        }}>
          <div>
            <div style={{ fontSize: isExtra ? 13.5 : 14.5, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", whiteSpace: "nowrap" }}>
              {pengaturan.nama_usaha || "KONVEKSI APPS | JEANS PRODUCTION"}
            </div>
            <div style={{ fontSize: isExtra ? 9 : 10, color: "#222", marginTop: 2, whiteSpace: "nowrap" }}>
              {pengaturan.alamat || "Jl. Industri Konveksi No. 88"}
              {pengaturan.telepon ? ` | Telp: ${pengaturan.telepon}` : ""}
              {` | Divisi Produksi & Sewing (CMT)`}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            {/* KOTAK DISTRIBUSI NCR 3-PLY (KOMPAK KHAS CONTINUOUS FORM) */}
            <div style={{
              border: "1px solid #000",
              padding: "3px 6px",
              fontSize: 8.5,
              textAlign: "left",
              background: "#FFF",
              lineHeight: 1.25,
              boxSizing: "border-box"
            }}>
              <div style={{ fontWeight: 700, textDecoration: "underline", marginBottom: 2, fontSize: 8.5, whiteSpace: "nowrap" }}>
                DISTRIBUSI RANGKAP (3-PLY NCR):
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontWeight: 700, whiteSpace: "nowrap" }}>
                <span style={{ fontSize: 9.5, fontFamily: "monospace" }}>({plyNumber === "1" ? "✓" : " "})</span>
                <span><strong>PUTIH</strong> : Arsip Kantor / Admin</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontWeight: 700, whiteSpace: "nowrap" }}>
                <span style={{ fontSize: 9.5, fontFamily: "monospace" }}>({plyNumber === "2" ? "✓" : " "})</span>
                <span><strong>MERAH</strong> : Vendor CMT / Jahit</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontWeight: 700, whiteSpace: "nowrap" }}>
                <span style={{ fontSize: 9.5, fontFamily: "monospace" }}>({plyNumber === "3" ? "✓" : " "})</span>
                <span><strong>KUNING</strong>: Gudang / Finishing / QC</span>
              </div>
            </div>
            <div style={{ fontSize: 7.5, marginTop: 2, color: "#475569", fontStyle: "italic", textAlign: "right", whiteSpace: "nowrap" }}>
              * Beri tanda (✓) / lingkari manual
            </div>
          </div>
        </div>

        {/* DOCUMENT TITLE & INFO */}
        <div style={{ textAlign: "center", margin: isExtra ? "3px 0 5px 0" : "5px 0 7px 0" }}>
          <div style={{ fontSize: isExtra ? 12.5 : 13.5, fontWeight: 700, textDecoration: "underline", letterSpacing: 0.5, whiteSpace: "nowrap" }}>
            SURAT PERINTAH KERJA (SPK) JAHIT & PURCHASE ORDER (PO)
          </div>
          <div style={{ fontSize: isExtra ? 9.5 : 10.5, fontWeight: 700, marginTop: 2, whiteSpace: "nowrap" }}>
            NOMOR PO: {po.noPo}
          </div>
        </div>

        {/* METADATA GRID: 4-COLUMN FIXED TABLE (LUANG & BEBAS TABRAKAN) */}
        <div style={{
          border: "1px solid #000",
          padding: isExtra ? "4px 8px" : "6px 10px",
          marginBottom: isExtra ? 5 : 8,
          boxSizing: "border-box",
          overflow: "hidden"
        }}>
          <table style={{ width: "100%", tableLayout: "fixed", fontSize: isExtra ? 9 : 9.5, borderCollapse: "collapse" }}>
            <colgroup>
              <col style={{ width: "24%" }} />
              <col style={{ width: "26%" }} />
              <col style={{ width: "24%" }} />
              <col style={{ width: "26%" }} />
            </colgroup>
            <tbody>
              <tr>
                <td style={{ whiteSpace: "nowrap", padding: "1.5px 6px 1.5px 0", fontWeight: 700 }}>Tgl Terbit PO</td>
                <td style={{ whiteSpace: "nowrap", padding: "1.5px 8px 1.5px 0" }}>: {po.tanggalTerbit ? new Date(po.tanggalTerbit).toLocaleDateString("id-ID") : "-"}</td>
                <td style={{ whiteSpace: "nowrap", padding: "1.5px 6px 1.5px 0", fontWeight: 700 }}>Vendor CMT (Jahit)</td>
                <td style={{ whiteSpace: "nowrap", padding: "1.5px 0" }}>: <strong>{vendor?.nama || "-"}</strong> {vendor?.kodeVendor ? `[${vendor.kodeVendor}]` : ""}</td>
              </tr>
              <tr>
                <td style={{ whiteSpace: "nowrap", padding: "1.5px 6px 1.5px 0", fontWeight: 700 }}>Target Selesai</td>
                <td style={{ whiteSpace: "nowrap", padding: "1.5px 8px 1.5px 0" }}>: {targetSelesai ? new Date(targetSelesai).toLocaleDateString("id-ID") : "-"} {durasiHari ? `(${durasiHari} Hari)` : ""}</td>
                <td style={{ whiteSpace: "nowrap", padding: "1.5px 6px 1.5px 0", fontWeight: 700 }}>Kontak / Telp</td>
                <td style={{ whiteSpace: "nowrap", padding: "1.5px 0" }}>: {vendor?.telepon || vendor?.kontak || "-"}</td>
              </tr>
              <tr>
                <td style={{ whiteSpace: "nowrap", padding: "1.5px 6px 1.5px 0", fontWeight: 700 }}>Spesifikasi Model</td>
                <td style={{ whiteSpace: "nowrap", padding: "1.5px 8px 1.5px 0" }}>: <strong>{po.model}</strong></td>
                <td style={{ whiteSpace: "nowrap", padding: "1.5px 6px 1.5px 0", fontWeight: 700 }}>Alamat Vendor</td>
                <td style={{ whiteSpace: "nowrap", padding: "1.5px 0", overflow: "hidden", textOverflow: "ellipsis" }}>: {vendor?.alamat || "-"}</td>
              </tr>
              <tr>
                <td style={{ whiteSpace: "nowrap", padding: "1.5px 6px 1.5px 0", fontWeight: 700 }}>Total Order Jahit</td>
                <td style={{ whiteSpace: "nowrap", padding: "1.5px 8px 1.5px 0" }}>: <strong>{totalPcs} PCS</strong></td>
                <td style={{ whiteSpace: "nowrap", padding: "1.5px 6px 1.5px 0", fontWeight: 700 }}>Asal Bahan / Lot</td>
                <td style={{ whiteSpace: "nowrap", padding: "1.5px 0" }}>: {pemotongan ? `PO-POT-${String(pemotongan.id).padStart(4, "0")} (${pemotongan.nama_barang || "Bahan Utama"})` : "Pemotongan Kain"}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* SECTION 1: SPESIFIKASI TEKNIS JAHITAN & BENANG / RESLETING */}
        <div style={{ marginBottom: isExtra ? 5 : 8, border: "1px solid #000", boxSizing: "border-box", overflow: "hidden" }}>
          <div style={{
            background: "#F1F5F9",
            padding: isExtra ? "3px 8px" : "4px 10px",
            fontWeight: 700,
            borderBottom: "1px solid #000",
            fontSize: isExtra ? 9 : 10,
            display: "flex",
            justifyContent: "space-between"
          }}>
            <span style={{ whiteSpace: "nowrap" }}>[A] SPESIFIKASI TEKNIS JAHITAN & AKSESORIS</span>
            <span style={{ fontWeight: "normal", fontSize: 8, whiteSpace: "nowrap" }}>Wajib dipatuhi oleh Vendor CMT</span>
          </div>
          <div style={{ padding: isExtra ? "3px 8px" : "5px 10px" }}>
            <table style={{ width: "100%", tableLayout: "fixed", fontSize: isExtra ? 9 : 9.5, borderCollapse: "collapse" }}>
              <colgroup>
                <col style={{ width: "24%" }} />
                <col style={{ width: "76%" }} />
              </colgroup>
              <tbody>
                <tr>
                  <td style={{ whiteSpace: "nowrap", padding: "1.5px 6px 1.5px 0", fontWeight: 700 }}>Jenis Jahitan</td>
                  <td style={{ padding: "1.5px 0", wordBreak: "break-word" }}>: <strong>{pemotongan?.jenis_jahitan || "Rantai (Chainstitch), Obras 5 Benang, Make-up Standard Jeans, Double Stitch, Bartack"}</strong></td>
                </tr>
                <tr>
                  <td style={{ whiteSpace: "nowrap", padding: "1.5px 6px 1.5px 0", fontWeight: 700 }}>Type / Warna Benang</td>
                  <td style={{ padding: "1.5px 0", wordBreak: "break-word" }}>: <strong>{pemotongan?.tipe_benang || "Benang Astra Jeans 20/2 (Gold Jeans / Kuning Emas)"}</strong></td>
                </tr>
                <tr>
                  <td style={{ whiteSpace: "nowrap", padding: "1.5px 6px 1.5px 0", fontWeight: 700 }}>Type Resleting</td>
                  <td style={{ padding: "1.5px 0", wordBreak: "break-word" }}>: <strong>{pemotongan?.tipe_resleting || "Resleting YKK Metal Brass No. 5 (Gigi Kuningan)"}</strong></td>
                </tr>
                {(pemotongan?.catatan_jahitan || po.catatan) && (
                  <tr>
                    <td style={{ whiteSpace: "nowrap", padding: "1.5px 6px 1.5px 0", fontWeight: 700, verticalAlign: "top" }}>Catatan Pengerjaan</td>
                    <td style={{ padding: "1.5px 0", verticalAlign: "top", wordBreak: "break-word" }}>: {po.catatan || pemotongan?.catatan_jahitan}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 2: RINCIAN ALOKASI POTONGAN PER SIZE & BUNDLE */}
        <div style={{ marginBottom: isExtra ? 5 : 8, border: "1px solid #000", boxSizing: "border-box", overflow: "hidden" }}>
          <div style={{
            background: "#F1F5F9",
            padding: isExtra ? "3px 8px" : "4px 10px",
            fontWeight: 700,
            borderBottom: "1px solid #000",
            fontSize: isExtra ? 9 : 10,
            display: "flex",
            justifyContent: "space-between"
          }}>
            <span style={{ whiteSpace: "nowrap" }}>[B] RINCIAN POTONGAN KAIN & TARGET JAHIT (SIZE BREAKDOWN)</span>
            <span style={{ whiteSpace: "nowrap" }}>TOTAL: {totalPcs} PCS</span>
          </div>
          <table style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse", fontSize: isExtra ? 8.5 : 9, textAlign: "center" }}>
            <colgroup>
              <col style={{ width: "5%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "45%" }} />
              <col style={{ width: "16%" }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: "1px solid #000", background: "#F8FAFC" }}>
                <th style={{ borderRight: "1px solid #000", padding: "2px 6px", whiteSpace: "nowrap" }}>NO</th>
                <th style={{ borderRight: "1px solid #000", padding: "2px 6px", textAlign: "left", whiteSpace: "nowrap" }}>UKURAN (SIZE)</th>
                <th style={{ borderRight: "1px solid #000", padding: "2px 6px", whiteSpace: "nowrap" }}>JUMLAH (PCS)</th>
                <th style={{ borderRight: "1px solid #000", padding: "2px 8px", textAlign: "left", whiteSpace: "nowrap" }}>RINCIAN IKAT / BUNDLE</th>
                <th style={{ padding: "2px 6px", textAlign: "left", whiteSpace: "nowrap" }}>CHECK CMT</th>
              </tr>
            </thead>
            <tbody>
              {(po.sizeBreakdown || []).map((s: any, idx: number) => {
                const qty = Number(s.jumlah) || 0;
                const perBundle = pemotongan?.isi_per_bundle || 20; // default 1 kodi (20 pcs)
                const fullBundles = Math.floor(qty / perBundle);
                const remainder = qty % perBundle;

                let bundleText = "-";
                if (qty > 0) {
                  if (remainder === 0) {
                    bundleText = `${fullBundles} Ikat (@${perBundle} pcs)`;
                  } else if (fullBundles === 0) {
                    bundleText = `1 Ikat (@${remainder} pcs)`;
                  } else {
                    bundleText = `${fullBundles} Ikat (@${perBundle}) + 1 Ikat (@${remainder})`;
                  }
                }

                return (
                  <tr key={idx} style={{ borderBottom: "1px dotted #CBD5E1" }}>
                    <td style={{ borderRight: "1px solid #000", padding: "2px 6px", whiteSpace: "nowrap" }}>{idx + 1}</td>
                    <td style={{ borderRight: "1px solid #000", padding: "2px 6px", textAlign: "left", fontWeight: 700, whiteSpace: "nowrap" }}>SIZE {s.size}</td>
                    <td style={{ borderRight: "1px solid #000", padding: "2px 6px", fontWeight: 700, whiteSpace: "nowrap" }}>{s.jumlah} pcs</td>
                    <td style={{ borderRight: "1px solid #000", padding: "2px 8px", textAlign: "left", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden" }}>
                      {bundleText}
                    </td>
                    <td style={{ padding: "2px 6px", textAlign: "left", color: "#333", fontSize: 8, whiteSpace: "nowrap", overflow: "hidden" }}>
                      [✓] Lengkap
                    </td>
                  </tr>
                );
              })}
              <tr style={{ borderTop: "1.5px solid #000", fontWeight: 700, background: "#F1F5F9" }}>
                <td colSpan={2} style={{ borderRight: "1px solid #000", padding: "3px 8px", textAlign: "right", whiteSpace: "nowrap" }}>TOTAL KESELURUHAN:</td>
                <td style={{ borderRight: "1px solid #000", padding: "3px 6px", fontSize: isExtra ? 9.5 : 10.5, whiteSpace: "nowrap" }}>{totalPcs} PCS</td>
                <td colSpan={2} style={{ padding: "3px 8px", textAlign: "left", fontSize: 8.5, whiteSpace: "nowrap" }}>Siap rakit / jahit oleh Vendor CMT</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* SECTION 3: SURAT JALAN BAHAN PENDUKUNG & AKSESORIS KELUAR */}
        <div style={{ marginBottom: isExtra ? 5 : 8, border: "1px solid #000", boxSizing: "border-box", overflow: "hidden" }}>
          <div style={{
            background: "#F1F5F9",
            padding: isExtra ? "3px 8px" : "4px 10px",
            fontWeight: 700,
            borderBottom: "1px solid #000",
            fontSize: isExtra ? 9 : 10,
            display: "flex",
            justifyContent: "space-between"
          }}>
            <span style={{ whiteSpace: "nowrap" }}>[C] SURAT JALAN BAHAN PENDUKUNG & AKSESORIS KELUAR</span>
            <span style={{ fontSize: 8, fontWeight: "normal", whiteSpace: "nowrap" }}>Diserahkan bersama potongan kain</span>
          </div>
          {pemotongan?.item_pendukung_used && pemotongan.item_pendukung_used.length > 0 ? (
            <table style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse", fontSize: isExtra ? 8.5 : 9 }}>
              <colgroup>
                <col style={{ width: "5%" }} />
                <col style={{ width: "38%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "20%" }} />
              </colgroup>
              <thead>
                <tr style={{ borderBottom: "1px solid #000", background: "#F8FAFC", textAlign: "left" }}>
                  <th style={{ borderRight: "1px solid #000", padding: "2px 6px", textAlign: "center", whiteSpace: "nowrap" }}>NO</th>
                  <th style={{ borderRight: "1px solid #000", padding: "2px 8px", whiteSpace: "nowrap" }}>NAMA ITEM & AKSESORIS</th>
                  <th style={{ borderRight: "1px solid #000", padding: "2px 6px", whiteSpace: "nowrap" }}>KATEGORI</th>
                  <th style={{ borderRight: "1px solid #000", padding: "2px 6px", textAlign: "right", whiteSpace: "nowrap" }}>JUMLAH</th>
                  <th style={{ borderRight: "1px solid #000", padding: "2px 6px", whiteSpace: "nowrap" }}>SATUAN</th>
                  <th style={{ padding: "2px 8px", whiteSpace: "nowrap" }}>CHECK CMT</th>
                </tr>
              </thead>
              <tbody>
                {pemotongan.item_pendukung_used.map((it: any, idx: number) => (
                  <tr key={idx} style={{ borderBottom: "1px dotted #CBD5E1" }}>
                    <td style={{ borderRight: "1px solid #000", padding: "2px 6px", textAlign: "center", whiteSpace: "nowrap" }}>{idx + 1}</td>
                    <td style={{ borderRight: "1px solid #000", padding: "2px 8px", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden" }}>{it.nama_item}</td>
                    <td style={{ borderRight: "1px solid #000", padding: "2px 6px", whiteSpace: "nowrap" }}>{it.kategori}</td>
                    <td style={{ borderRight: "1px solid #000", padding: "2px 6px", textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>{it.qty}</td>
                    <td style={{ borderRight: "1px solid #000", padding: "2px 6px", whiteSpace: "nowrap" }}>{it.satuan}</td>
                    <td style={{ padding: "2px 8px", color: "#333", fontSize: 8, whiteSpace: "nowrap" }}>[✓] Sesuai Fisik</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: "4px 8px", fontSize: 8.5, color: "#64748B", fontStyle: "italic" }}>
              Bahan pendukung dan aksesoris disediakan langsung oleh Gudang atau menggunakan stok mandiri vendor sesuai kesepakatan SPK.
            </div>
          )}
        </div>

        {/* TANDA TANGAN 3 PIHAK (JARAK BERSIH - TIDAK MENABRAK GARIS) */}
        <div style={{ border: "1px solid #000", padding: isExtra ? "5px 10px" : "7px 12px", marginTop: isExtra ? 4 : 6, boxSizing: "border-box", overflow: "hidden" }}>
          <div style={{ fontSize: 8, textAlign: "center", marginBottom: isExtra ? 4 : 6, color: "#333", fontStyle: "italic", whiteSpace: "nowrap" }}>
            *{pengaturan.catatan_surat_jalan || "Potongan kain dan bahan pendukung di atas telah diperiksa dan diserahkan dalam kondisi lengkap dan tepat jumlah."}*
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", textAlign: "center", gap: 10, boxSizing: "border-box" }}>
            <div>
              <div style={{ fontSize: 8.5, fontWeight: 700, whiteSpace: "nowrap" }}>DISERAHKAN OLEH:</div>
              <div style={{ fontSize: 7.5, color: "#475569", whiteSpace: "nowrap" }}>({pengaturan.jabatan_penyerah || "Gudang & Potongan"})</div>
              <div style={{ height: isExtra ? 26 : 34 }}></div>
              <div style={{ borderBottom: "1px solid #000", width: "70%", margin: "0 auto 5px auto" }}></div>
              <div style={{ fontSize: 8.5, fontWeight: 700, whiteSpace: "nowrap" }}>( .................... )</div>
            </div>
            <div>
              <div style={{ fontSize: 8.5, fontWeight: 700, whiteSpace: "nowrap" }}>DITERIMA / CMT JAHIT:</div>
              <div style={{ fontSize: 7.5, color: "#475569", whiteSpace: "nowrap" }}>({vendor?.nama || "Vendor CMT"})</div>
              <div style={{ height: isExtra ? 26 : 34 }}></div>
              <div style={{ borderBottom: "1px solid #000", width: "70%", margin: "0 auto 5px auto" }}></div>
              <div style={{ fontSize: 8.5, fontWeight: 700, whiteSpace: "nowrap" }}>( {vendor?.nama || "...................."} )</div>
            </div>
            <div>
              <div style={{ fontSize: 8.5, fontWeight: 700, whiteSpace: "nowrap" }}>DIKETAHUI / SETUJU:</div>
              <div style={{ fontSize: 7.5, color: "#475569", whiteSpace: "nowrap" }}>({pengaturan.jabatan_penyetuju || "Admin Produksi"})</div>
              <div style={{ height: isExtra ? 26 : 34 }}></div>
              <div style={{ borderBottom: "1px solid #000", width: "70%", margin: "0 auto 5px auto" }}></div>
              <div style={{ fontSize: 8.5, fontWeight: 700, whiteSpace: "nowrap" }}>( .................... )</div>
            </div>
          </div>
        </div>

        {/* FOOTER NOTICE FOR CONTINUOUS FORM */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 7.5,
          color: "#475569",
          marginTop: 4,
          borderTop: "1px dotted #94A3B8",
          paddingTop: 3,
          boxSizing: "border-box"
        }}>
          <div style={{ whiteSpace: "nowrap" }}>Dicetak: {new Date().toLocaleString("id-ID")} | System: KonveksiApps Production Core</div>
          <div style={{ whiteSpace: "nowrap" }}>Continuous Form 3-Ply Ready | {isNCR ? "1x Cetak Tembus Otomatis (Putih/Merah/Kuning)" : `Lembar: ${ply.label}`}</div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ background: "#E2E8F0", minHeight: "100vh", padding: "18px 14px", display: "flex", flexDirection: "column", alignItems: "center" }}>
      {/* PRINT STYLES KHUSUS PRINTER DOT MATRIX & KERTAS CONTINUOUS FORM */}
      <style>{`
        @page {
          size: auto;
          margin: 3mm 4mm 3mm 4mm;
        }
        @media print {
          html, body {
            background: #FFFFFF !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * {
            visibility: hidden;
          }
          .print-container, .print-container * {
            visibility: visible;
          }
          .print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          .dotmatrix-sheet {
            box-shadow: none !important;
            margin: 0 !important;
            padding: 4px 8px !important;
            border: 1px solid #000 !important;
            width: 100% !important;
            max-width: 100% !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            font-size: 9px !important;
            line-height: 1.18 !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
          }
          .dotmatrix-sheet table {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            table-layout: fixed !important;
            width: 100% !important;
          }
        }
      `}</style>

      {/* TOP CONTROL BAR (NO PRINT) */}
      <div className="no-print" style={{ width: "100%", maxWidth: 820, marginBottom: 12, background: "white", padding: "12px 16px", borderRadius: 10, boxShadow: "0 4px 10px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <button
            onClick={() => router.back()}
            className="btn"
            style={{ background: "#F1F5F9", color: "#334155", display: "flex", alignItems: "center", gap: 6, fontWeight: 600, fontSize: 13 }}
          >
            <ArrowLeft size={16} /> Kembali
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, background: "#ECFDF5", color: "#065F46", padding: "4px 8px", borderRadius: 6, fontWeight: 700, border: "1px solid #A7F3D0" }}>
              ✓ Format Dot Matrix & Continuous Form
            </span>
            <button
              onClick={() => window.print()}
              className="btn btn-primary"
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 18px", fontWeight: 800, fontSize: 13, background: "#059669", borderColor: "#059669", boxShadow: "0 2px 8px rgba(5,150,105,0.25)" }}
            >
              <Printer size={16} /> Cetak ke Printer Dot Matrix
            </button>
          </div>
        </div>

        {/* EDUKASI CARA KERJA PRINTER DOT MATRIX & KERTAS NCR 3-PLY */}
        <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "8px 12px", display: "flex", alignItems: "flex-start", gap: 8 }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>💡</span>
          <div style={{ fontSize: 11, color: "#166534", lineHeight: 1.4 }}>
            <strong>Format Cetak Kertas Continuous Form NCR 3-Ply Telah Disesuaikan:</strong> Desain berbasis teks monospaced dengan border kontras tinggi, rincian ikat/bundle rapi (@20 pcs), serta pemisahan tanda tangan 3 pihak sehingga seluruh cetakan bersih, tajam, dan tidak bertabrakan dengan garis tabel pada printer dot matrix (Epson LX/LQ Series).
          </div>
        </div>

        {/* CONTROLS: DENSITY & MODE FORMAT */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, borderTop: "1px solid #E2E8F0", paddingTop: 8 }}>
          {/* DENSITY TOGGLE */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", display: "flex", alignItems: "center", gap: 4 }}>
              <Zap size={14} color="#F59E0B" /> Kepadatan:
            </span>
            <div style={{ display: "flex", background: "#F1F5F9", padding: 2, borderRadius: 6, gap: 2 }}>
              <button
                onClick={() => setDensity("extra")}
                style={{
                  padding: "4px 8px",
                  borderRadius: 4,
                  border: "none",
                  fontSize: 10.5,
                  fontWeight: 800,
                  cursor: "pointer",
                  background: density === "extra" ? "#0F172A" : "transparent",
                  color: density === "extra" ? "white" : "#475569"
                }}
              >
                ⚡ Ekstra Padat (1 Lembar Pas)
              </button>
              <button
                onClick={() => setDensity("normal")}
                style={{
                  padding: "4px 8px",
                  borderRadius: 4,
                  border: "none",
                  fontSize: 10.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  background: density === "normal" ? "#0F172A" : "transparent",
                  color: density === "normal" ? "white" : "#475569"
                }}
              >
                📄 Standar Padat
              </button>
            </div>
          </div>

          {/* PLY SELECTOR */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", display: "flex", alignItems: "center", gap: 4 }}>
              <Layers size={14} /> Rangkap:
            </span>
            <div style={{ display: "flex", background: "#F1F5F9", padding: 2, borderRadius: 6, gap: 2, flexWrap: "wrap" }}>
              <button
                onClick={() => setActivePly("ncr")}
                style={{
                  padding: "4px 8px",
                  borderRadius: 4,
                  border: "none",
                  fontSize: 10.5,
                  fontWeight: 800,
                  cursor: "pointer",
                  background: activePly === "ncr" ? "#059669" : "transparent",
                  color: activePly === "ncr" ? "white" : "#475569"
                }}
              >
                ⭐ 3-Ply NCR (1x Tembus)
              </button>
              <button
                onClick={() => setActivePly("1")}
                style={{
                  padding: "4px 7px",
                  borderRadius: 4,
                  border: "none",
                  fontSize: 10.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  background: activePly === "1" ? "#334155" : "transparent",
                  color: activePly === "1" ? "white" : "#64748B"
                }}
              >
                Putih
              </button>
              <button
                onClick={() => setActivePly("2")}
                style={{
                  padding: "4px 7px",
                  borderRadius: 4,
                  border: "none",
                  fontSize: 10.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  background: activePly === "2" ? "#DC2626" : "transparent",
                  color: activePly === "2" ? "white" : "#64748B"
                }}
              >
                Merah
              </button>
              <button
                onClick={() => setActivePly("3")}
                style={{
                  padding: "4px 7px",
                  borderRadius: 4,
                  border: "none",
                  fontSize: 10.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  background: activePly === "3" ? "#D97706" : "transparent",
                  color: activePly === "3" ? "white" : "#64748B"
                }}
              >
                Kuning
              </button>
              <button
                onClick={() => setActivePly("all")}
                style={{
                  padding: "4px 7px",
                  borderRadius: 4,
                  border: "none",
                  fontSize: 10.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  background: activePly === "all" ? "#2563EB" : "transparent",
                  color: activePly === "all" ? "white" : "#64748B"
                }}
              >
                Semua HVS
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* PRINTABLE CONTAINER */}
      <div className="print-container" style={{ width: "100%", maxWidth: 820 }}>
        {activePly === "all" ? (
          <>
            {renderSinglePly("1", true)}
            {renderSinglePly("2", true)}
            {renderSinglePly("3", true)}
          </>
        ) : (
          renderSinglePly(activePly)
        )}
      </div>
    </div>
  );
}
