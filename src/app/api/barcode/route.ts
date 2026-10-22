export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { readData } from "@/lib/data-store";

export async function GET() {
  try {
    const data = readData();
    if (!data.barcode_item) return NextResponse.json([]);

    // Compute effective barcode status from cmt_progres records dynamically
    // This handles historical data where barcode.status wasn't updated
    const approvedByKey: Record<string, number> = {};  // "poId-size" -> count approved
    const pendingByKey: Record<string, number> = {};   // "poId-size" -> count pending

    for (const rec of (data.cmt_progres || [])) {
      // Laporan vendor lanjutan (washing dll) punya transfer_id — bukan laporan jahit CMT
      if (rec.transfer_id) continue;
      const isApproved = rec.status === "Diterima" || rec.status === "Diverifikasi";
      const isPending = rec.status === "Menunggu" || rec.status === "Pending";
      for (const item of (rec.items || [])) {
        const key = `${rec.po_id}-${item.size}`;
        if (isApproved) approvedByKey[key] = (approvedByKey[key] || 0) + Number(item.jumlah || 0);
        else if (isPending) pendingByKey[key] = (pendingByKey[key] || 0) + Number(item.jumlah || 0);
      }
    }

    // Group barcodes by poId+size to assign statuses sequentially
    const groups: Record<string, any[]> = {};
    for (const b of data.barcode_item) {
      const key = `${b.poId}-${b.size}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(b);
    }

    // Status yang sudah "lebih maju" (masuk stok, terjual, retur, reject) tidak boleh ditimpa
    const FINAL = ["siap_jual", "terjual", "retur_banding", "reject", "washing", "benang", "finishing"];
    const isAdvanced = (s: string) => FINAL.includes(s) || String(s || "").endsWith("_dikerjakan");

    // For each group, assign effective status based on counts
    const effectiveStatus: Record<number, string> = {};
    for (const [key, items] of Object.entries(groups)) {
      const approved = approvedByKey[key] || 0;
      const pending = pendingByKey[key] || 0;
      // Sort by id so assignment is deterministic
      const sorted = [...items].sort((a, b) => a.id - b.id);
      let i = 0;
      // First `approved` barcodes → gudang (or better if already advanced)
      for (; i < sorted.length && i < approved; i++) {
        const stored = sorted[i].status;
        effectiveStatus[sorted[i].id] = isAdvanced(stored) ? stored : "gudang";
      }
      // Next `pending` barcodes  cmt
      for (; i < sorted.length && i < approved + pending; i++) {
        const stored = sorted[i].status;
        effectiveStatus[sorted[i].id] = isAdvanced(stored) || stored === "gudang" ? stored : "cmt";
      }
      // Rest  use stored status
      for (; i < sorted.length; i++) {
        effectiveStatus[sorted[i].id] = sorted[i].status;
      }
    }

    const poMap = new Map(data.po_produksi.map((p: any) => [p.id, p]));
    const barangMap = new Map((data.data_barang || []).map((x: any) => [String(x.id), x]));
    const saleMap = new Map(((data as any).penjualan_barcode || []).map((s: any) => [String(s.id), s]));
    
    const list = data.barcode_item.map((b: any) => {
      const po = poMap.get(b.poId);
      const barang: any = b.barang_id != null ? barangMap.get(String(b.barang_id)) : null;
      const sale: any = b.penjualan_id != null ? saleMap.get(String(b.penjualan_id)) : null;
      const line = sale?.items?.find((it: any) => String(it.kode).toUpperCase() === String(b.kodeBarcode).toUpperCase());
      return {
        ...b,
        status: effectiveStatus[b.id] || b.status,
        noPo: po ? po.noPo : "Unknown",
        model: po ? po.model : "Unknown",
        tanggalTerbit: po ? po.tanggalTerbit : null,
        statusPo: po ? po.status : "Unknown",
        nama_barang: barang?.nama_barang || null,
        kode_barang: barang?.kode || null,
        pelanggan: sale?.pelanggan || null,
        harga_terjual: line?.harga ?? null,
      };
    }).reverse();
      
    return NextResponse.json(list);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
