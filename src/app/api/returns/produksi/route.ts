export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";
import { emitEvent } from "@/lib/realtime-hub";

export async function GET(req: NextRequest) {
  try {
    const data = readData();
    const { searchParams } = new URL(req.url);
    const vendorId = searchParams.get("vendor_id");
    const statusFilter = searchParams.get("status");

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

      // 4. Cari Vendor penanggung jawab terkait
      const vId = r.vendor_id || nota?.vendor_id || po?.vendorId;
      const vendor = (data.vendors || []).find((v: any) => String(v.id) === String(vId));

      // 5. Cek Transfer pengerjaan ulang (rework) jika ada
      const activeTransfer = r.transfer_id
        ? (data.produksi_transfers || []).find((t: any) => Number(t.id) === Number(r.transfer_id))
        : null;

      const noPo = r.noPo || nota?.noPo || po?.noPo || (poId ? `PO #${poId}` : "-");
      const model = r.model || nota?.model || po?.model || pemotongan?.model || pemotongan?.nama_barang || "Produk Jeans";
      const vendorNama = r.vendor_nama || nota?.vendor_nama || vendor?.nama || "Vendor";
      const vendorTipe = vendor?.tipe || (r.ke_tahap === "washing" ? "washing" : "cmt");
      const jumlah = Number(r.jumlah || nota?.jumlah_reject || 0);
      const kodeBatch = r.kode_batch || noPo;
      const jenisKain = r.jenis_kain || pemotongan?.nama_barang || model;
      const keBerapaKali = Number(r.ke_berapa_kali || r.keBerapaKali || 1);

      // Sinkronisasi status pengerjaan rework dari transfer
      let status = r.status || "menunggu-spk-retur";
      if (activeTransfer) {
        if (activeTransfer.status === "Selesai" || activeTransfer.status === "Diterima") {
          status = "selesai";
        } else if (activeTransfer.status === "Proses" || activeTransfer.status === "Dikerjakan") {
          status = "diproses-ulang";
        }
      }
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
        vendor_id: vId,
        vendor_tipe: vendorTipe,
        jumlah,
        sizeBreakdown: r.sizeBreakdown || nota?.sizeBreakdown || [],
        rincian_reject: nota?.rincian_reject || [],
        ke_berapa_kali: keBerapaKali,
        status,
        transfer_id: r.transfer_id || null,
        transfer_status: activeTransfer?.status || null,
        transfer_progress: activeTransfer?.jumlah_selesai || 0,
        status_klaim: nota?.status_klaim,
        metode_pembayaran: nota?.metode_pembayaran,
        nominal_dibayar: nota?.nominal_dibayar,
        total_klaim: nota?.total_klaim,
        catatan_penyelesaian: nota?.catatan_penyelesaian,
      };
    });

    let filtered = list;
    if (vendorId) {
      filtered = filtered.filter((r: any) => String(r.vendor_id) === String(vendorId));
    }
    if (statusFilter && statusFilter !== "semua") {
      filtered = filtered.filter((r: any) => r.status === statusFilter);
    }

    return NextResponse.json(filtered.reverse());
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = readData();
    if (!data.retur_produksi) data.retur_produksi = [];
    if (!data.produksi_transfers) data.produksi_transfers = [];

    const {
      action,
      id,
      po_id,
      vendor_id,
      ke_tahap,
      jumlah,
      sizeBreakdown,
      alasan,
      catatan,
      target_selesai,
      status_baru,
      buat_nota_klaim,
      estimasi_kerugian
    } = body;

    // ─────────────────────────────────────────────────────────────
    // 1. ACTION: CATAT TIKET RETUR / REWORK BARU (DARI QC FINISHING / GUDANG)
    // ─────────────────────────────────────────────────────────────
    if (action === "catat_retur_baru") {
      if (!po_id || !vendor_id || !jumlah) {
        return NextResponse.json({ error: "PO, Vendor, dan Jumlah cacat wajib diisi" }, { status: 400 });
      }

      const po = (data.po_produksi || []).find((p: any) => Number(p.id) === Number(po_id));
      const vendor = (data.vendors || []).find((v: any) => Number(v.id) === Number(vendor_id));
      const targetTahap = ke_tahap || (vendor?.tipe === "washing" ? "washing" : "cmt");
      const returId = nextId(data, "retur_produksi" as any);
      const noNota = `NOT-RET-${Date.now().toString().slice(-6)}`;

      const newRetur = {
        id: returId,
        no_nota: noNota,
        po_id: Number(po_id),
        noPo: po?.noPo || `PO #${po_id}`,
        model: po?.model || "Produk",
        vendor_id: Number(vendor_id),
        vendor_nama: vendor?.nama || "Vendor",
        ke_tahap: targetTahap,
        jumlah: Number(jumlah),
        sizeBreakdown: sizeBreakdown || [],
        alasan: alasan || "Cacat / Jahitan Lepas / Perlu Rework",
        catatan: catatan || "",
        status: "menunggu-spk-retur",
        ke_berapa_kali: 1,
        tanggal: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      data.retur_produksi.push(newRetur);

      // Jika user memilih buat nota klaim ganti rugi sekaligus
      if (buat_nota_klaim) {
        if (!data.nota_reject_vendor) data.nota_reject_vendor = [];
        data.nota_reject_vendor.push({
          id: nextId(data, "nota_reject_vendor" as any),
          no_nota: noNota,
          vendor_id: Number(vendor_id),
          vendor_nama: vendor?.nama || "Vendor",
          po_id: Number(po_id),
          noPo: po?.noPo || `PO #${po_id}`,
          model: po?.model || "Produk",
          jumlah_reject: Number(jumlah),
          sizeBreakdown: sizeBreakdown || [],
          alasan_reject: alasan || "Barang Reject",
          total_klaim: Number(estimasi_kerugian || 0),
          status_klaim: "Belum Lunas",
          tanggal: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        });
      }

      writeData(data);
      emitEvent("retur_produksi_created", { retur: newRetur });
      emitEvent("konveksi-sync", { source: "retur_produksi" });

      return NextResponse.json({
        success: true,
        message: `Tiket retur cacat (${jumlah} pcs) berhasil dicatat untuk ${vendor?.nama}`,
        retur: newRetur,
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 2. ACTION: TERBITKAN SPK REWORK KE VENDOR (CMT ATAU WASHING)
    // ─────────────────────────────────────────────────────────────
    const idx = data.retur_produksi.findIndex((r: any) => String(r.id) === String(id));
    if (idx === -1) {
      return NextResponse.json({ error: "Data retur tidak ditemukan" }, { status: 404 });
    }

    const item = data.retur_produksi[idx];

    if (action === "buat_spk_retur") {
      const targetVendorId = vendor_id ? Number(vendor_id) : item.vendor_id;
      const vendor = (data.vendors || []).find((v: any) => Number(v.id) === targetVendorId);
      const targetVendorNama = vendor?.nama || item.vendor_nama || "Mitra";
      const jmlKirim = Number(jumlah || item.jumlah || 1);
      const nextCounter = (Number(item.ke_berapa_kali) || 1) + 1;
      const targetTahap = ke_tahap || item.ke_tahap || (vendor?.tipe === "washing" ? "washing" : "cmt");

      const transferId = nextId(data, "produksi_transfers" as any);
      const poObj = (data.po_produksi || []).find((p: any) => Number(p.id) === Number(item.po_id));

      const newTransfer = {
        id: transferId,
        po_id: Number(item.po_id || 1),
        noPo: item.noPo || poObj?.noPo || "SJ-01",
        dari: "gudang",
        ke: targetTahap,
        vendor_id: targetVendorId,
        vendor_nama: targetVendorNama,
        jumlah_kirim: jmlKirim,
        sizeBreakdown: item.sizeBreakdown || [],
        status: "Dikerjakan",
        is_rework: true,
        rework_count: nextCounter,
        alasan_retur: item.alasan || "Perbaikan Cacat Produksi",
        catatan: catatan || `[SPK PERBAIKAN / REWORK KE-${nextCounter}] ${item.alasan || "Perbaikan QC"}. Target: ${target_selesai || "Segera"}`,
        tanggal_kirim: new Date().toISOString(),
        target_selesai: target_selesai || null,
        createdAt: new Date().toISOString(),
      };
      data.produksi_transfers.push(newTransfer);

      // Perbarui status retur produksi
      item.status = "diproses-ulang";
      item.ke_berapa_kali = nextCounter;
      item.transfer_id = transferId;
      item.vendor_id = targetVendorId;
      item.vendor_nama = targetVendorNama;
      item.ke_tahap = targetTahap;
      item.updated_at = new Date().toISOString();

      data.retur_produksi[idx] = item;
      writeData(data);

      emitEvent("spk_rework_created", { transfer: newTransfer, retur: item });
      emitEvent("konveksi-sync", { source: "spk_rework" });

      return NextResponse.json({
        success: true,
        message: `SPK Rework / Perbaikan berhasil diterbitkan ke ${targetVendorNama} (${jmlKirim} pcs). Muncul di portal kerjaan mitra.`,
        transfer: newTransfer,
        retur: item,
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 3. ACTION: SELESAIKAN REWORK & MASUKKAN KEMBALI KE GUDANG JADI
    // ─────────────────────────────────────────────────────────────
    if (action === "selesaikan_rework") {
      item.status = "selesai";
      item.updated_at = new Date().toISOString();
      item.tanggal_selesai = new Date().toISOString();

      // Tandai transfer terkait selesai jika ada
      if (item.transfer_id) {
        const tIdx = data.produksi_transfers.findIndex((t: any) => Number(t.id) === Number(item.transfer_id));
        if (tIdx !== -1) {
          data.produksi_transfers[tIdx].status = "Selesai";
          data.produksi_transfers[tIdx].tanggal_selesai = new Date().toISOString();
        }
      }

      data.retur_produksi[idx] = item;
      writeData(data);

      emitEvent("rework_completed", { retur: item });
      emitEvent("konveksi-sync", { source: "rework_completed" });

      return NextResponse.json({
        success: true,
        message: `Perbaikan produk ${item.noPo} selesai & siap masuk gudang kembali!`,
        retur: item,
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 4. ACTION: UBAH STATUS BIASA
    // ─────────────────────────────────────────────────────────────
    if (action === "ubah_status" && status_baru) {
      item.status = status_baru;
      item.updated_at = new Date().toISOString();
      data.retur_produksi[idx] = item;
      writeData(data);

      emitEvent("retur_status_updated", { id: item.id, status: status_baru });
      emitEvent("konveksi-sync", { source: "retur_status_updated" });

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
