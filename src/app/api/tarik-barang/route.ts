import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";

export async function POST(req: NextRequest) {
  try {
    const data = readData();
    const body = await req.json();
    const { poId, dari_vendor_id, ke_vendor_id, jumlah, catatan, sizeBreakdown } = body;

    if (!poId || !dari_vendor_id || !ke_vendor_id || !jumlah) {
      return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
    }

    const jml = Number(jumlah);
    if (isNaN(jml) || jml <= 0) {
      return NextResponse.json({ error: "Jumlah tidak valid" }, { status: 400 });
    }

    // Hitung saldo saat ini dari vendor sumber
    const ledgersForPO = data.po_ledgers.filter((l: any) => String(l.poId) === String(poId));
    let saldoSumber = 0;

    for (const l of ledgersForPO) {
      if (String(l.ke_vendor_id) === String(dari_vendor_id)) {
        saldoSumber += Number(l.jumlah);
      }
      if (String(l.dari_vendor_id) === String(dari_vendor_id) || String(l.dari) === String(dari_vendor_id)) {
        saldoSumber -= Number(l.jumlah);
      }
    }

    if (saldoSumber < jml) {
      return NextResponse.json({ error: `Saldo tidak mencukupi. Sisa saat ini: ${saldoSumber} pcs` }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Catat di Ledger (saldo)
    data.po_ledgers.push({
      id: nextId(data, "po_ledgers"),
      poId,
      dari_vendor_id: String(dari_vendor_id),
      ke_vendor_id: String(ke_vendor_id),
      jumlah: jml,
      tanggal: now,
      catatan: catatan || ""
    });

    // Jika tujuan adalah vendor (bukan GUDANG), buat produksi_transfer agar portal vendor melihat jobnya
    if (ke_vendor_id !== "GUDANG") {
      if (!data.produksi_transfers) data.produksi_transfers = [];

      // Tentukan stage berdasarkan tipe vendor
      
      const dariVendor = (data.vendors || []).find((v: any) => String(v.id) === String(dari_vendor_id));
      const dariTipe = dariVendor?.tipe || "cmt";

      let keTipe = "vendor";
      let keVendorIdNum = null;

      if (ke_vendor_id === "STANDBY") {
        const dariVendor = (data.vendors || []).find((v: any) => String(v.id) === String(dari_vendor_id));
        const stages = (data.pipeline_stages || []).sort((a: any,b: any) => a.urutan - b.urutan);
        const myIdx = stages.findIndex((s: any) => s.slug === (dariVendor?.tipe || "cmt"));
        if (myIdx >= 0 && myIdx < stages.length - 1) {
            keTipe = stages[myIdx + 1].slug;
        } else {
            keTipe = "washing"; // fallback
        }
      } else {
        const keVendor = (data.vendors || []).find((v: any) => String(v.id) === String(ke_vendor_id));
        keTipe = keVendor?.tipe || "vendor";
        keVendorIdNum = Number(ke_vendor_id);
      }


      // Build sizeBreakdown: gunakan dari frontend jika ada, fallback ke po.sizeBreakdown
      let breakdown = [];
      if (sizeBreakdown && typeof sizeBreakdown === "object" && !Array.isArray(sizeBreakdown)) {
        // format: { S: 50, M: 100, L: 30 }
        breakdown = Object.entries(sizeBreakdown).map(([size, jumlah]) => ({ size, jumlah }));
      } else if (Array.isArray(sizeBreakdown) && sizeBreakdown.length > 0) {
        breakdown = sizeBreakdown;
      } else {
        // Fallback: gunakan sizeBreakdown dari po_produksi jika ada
        const po = (data.po_produksi || []).find((p: any) => String(p.id) === String(poId));
        breakdown = (po?.sizeBreakdown || []).map((s: any) => ({ size: s.size, jumlah: s.jumlah }));
      }

      const transfer = {
        id: nextId(data, "produksi_transfers" as any),
        po_id: Number(poId),
        dari: dariTipe,
        ke: keTipe,
        vendor_id: keVendorIdNum,
        dari_vendor_id: Number(dari_vendor_id),
        jumlah_kirim: jml,
        jumlah_diterima: null,
        sizeBreakdown: breakdown,
        sizeBreakdown_diterima: null,
        catatan: catatan || "",
        status: "Kirim",
        tanggal_kirim: now,
        tanggal_terima: null
      };
      data.produksi_transfers.push(transfer);

      // Update barcode: gudang  washing (untuk washing)
      if (keTipe === "washing" && data.barcode_item) {
        const po = (data.po_produksi || []).find((p: any) => String(p.id) === String(poId));
        let updated = 0;
        for (let i = 0; i < data.barcode_item.length && updated < jml; i++) {
          const b = data.barcode_item[i];
          if (String(b.poId) === String(poId) && (b.status === "gudang" || b.status === "potong" || b.status === "cmt")) {
            data.barcode_item[i].status = "washing";
            updated++;
          }
        }
      }
    }

    writeData(data);
    return NextResponse.json({ success: true, message: "Berhasil ditarik" });

  } catch (error) {
    console.error("Error Tarik Barang:", error);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}

