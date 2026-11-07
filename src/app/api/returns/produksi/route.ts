export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";

export async function GET() {
  try {
    const data = readData();
    const list = (data.retur_produksi || []).map((r: any) => {
      // 1. Cari PO terkait
      const poId = r.po_id || r.poId || r.batchId || r.batch_id;
      const po = (data.po_produksi || []).find((p: any) => String(p.id) === String(poId));
      
      // 2. Cari Nota Reject terkait jika ada
      const nota = (data.nota_reject_vendor || []).find(
        (n: any) => (r.no_nota && n.no_nota === r.no_nota) || (r.id && String(n.id) === String(r.id))
      );

      // 3. Cari Pemotongan terkait jika ada
      const pemotongan = po?.pemotongan_id 
        ? (data.pemotongan_kain || []).find((p: any) => String(p.id) === String(po.pemotongan_id)) 
        : null;

      // 4. Cari Vendor terkait
      const vendorId = r.vendor_id || nota?.vendor_id || po?.vendorId;
      const vendor = (data.vendors || []).find((v: any) => String(v.id) === String(vendorId));

      const noPo = r.noPo || nota?.noPo || po?.noPo || (poId ? `PO #${poId}` : "-");
      const model = r.model || nota?.model || po?.model || pemotongan?.model || pemotongan?.nama_barang || "Produk Jeans";
      const vendorNama = r.vendor_nama || nota?.vendor_nama || vendor?.nama || "PRADANA LAUNDRY";
      const jumlah = Number(r.jumlah || nota?.jumlah_reject || 0);
      const kodeBatch = r.kode_batch || noPo;
      const jenisKain = r.jenis_kain || pemotongan?.nama_barang || model;
      const keBerapaKali = Number(r.ke_berapa_kali || r.keBerapaKali || 1);

      // Status penyelesaian jika sudah ada nota klaim lunas
      let status = r.status || "menunggu-spk-retur";
      if (nota?.status_klaim === "Lunas" && nota?.metode_pembayaran) {
        status = "selesai";
      }

      return {
        ...r,
        no_nota: r.no_nota || nota?.no_nota || "-",
        po_id: poId,
        batch_id: poId,
        batchId: poId,
        noPo,
        model,
        kode_batch: kodeBatch,
        jenis_kain: jenisKain,
        vendor_nama: vendorNama,
        vendor_id: vendorId,
        jumlah,
        rincian_reject: nota?.rincian_reject || [],
        ke_berapa_kali: keBerapaKali,
        status,
        status_klaim: nota?.status_klaim,
        metode_pembayaran: nota?.metode_pembayaran,
        nominal_dibayar: nota?.nominal_dibayar,
        total_klaim: nota?.total_klaim,
        catatan_penyelesaian: nota?.catatan_penyelesaian
      };
    });

    return NextResponse.json(list);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = readData();
    if (!data.retur_produksi) data.retur_produksi = [];

    const { action, id, vendor_id, jumlah, catatan, target_selesai, status_baru } = body;
    const idx = data.retur_produksi.findIndex((r: any) => String(r.id) === String(id));
    if (idx === -1) {
      return NextResponse.json({ error: "Data retur tidak ditemukan" }, { status: 404 });
    }

    const item = data.retur_produksi[idx];

    if (action === "buat_spk_retur") {
      const vendor = (data.vendors || []).find((v: any) => String(v.id) === String(vendor_id));
      const targetVendorNama = vendor?.nama || item.vendor_nama || "Washing";
      const jmlKirim = Number(jumlah || item.jumlah || 1);
      const nextCounter = (Number(item.ke_berapa_kali) || 1) + 1;

      // Buat transfer produksi ke washing sebagai rework
      if (!data.produksi_transfers) data.produksi_transfers = [];
      const transferId = nextId(data, "produksi_transfers" as any);
      
      const newTransfer = {
        id: transferId,
        po_id: item.po_id || item.batchId || 1,
        noPo: item.noPo || "SJ-01",
        dari: "gudang",
        ke: "washing",
        vendor_id: Number(vendor_id),
        vendor_nama: targetVendorNama,
        jumlah_kirim: jmlKirim,
        status: "Dikerjakan",
        is_rework: true,
        rework_count: nextCounter,
        alasan_retur: item.alasan || "Cuci Ulang QC",
        catatan: catatan || `[SPK RETUR CUCI KE-${nextCounter}] ${item.alasan || "Perbaikan QC Washing"}`,
        tanggal_kirim: new Date().toISOString(),
        target_selesai: target_selesai || null,
        createdAt: new Date().toISOString(),
      };
      data.produksi_transfers.push(newTransfer);

      // Perbarui status retur produksi
      item.status = "diproses-ulang";
      item.ke_berapa_kali = nextCounter;
      item.transfer_id = transferId;
      item.vendor_nama = targetVendorNama;
      item.updated_at = new Date().toISOString();

      data.retur_produksi[idx] = item;
      writeData(data);

      return NextResponse.json({
        success: true,
        message: `SPK Cuci Ulang berhasil diterbitkan ke ${targetVendorNama} (${jmlKirim} pcs)`,
        transfer: newTransfer,
        retur: item,
      });
    }

    if (action === "ubah_status" && status_baru) {
      item.status = status_baru;
      item.updated_at = new Date().toISOString();
      data.retur_produksi[idx] = item;
      writeData(data);

      return NextResponse.json({
        success: true,
        message: `Status retur berhasil diperbarui ke '${status_baru}'`,
        retur: item,
      });
    }

    return NextResponse.json({ error: "Aksi tidak dikenal" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Gagal memproses aksi retur" }, { status: 500 });
  }
}
