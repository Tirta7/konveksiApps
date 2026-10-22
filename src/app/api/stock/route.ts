export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";
import {
  getStockInbound, getStockSummary, getAvailableSizes, ensureBarangKode, skuCode, resolveScan, skuPrefix,
  getVendorWip, getPoStockProgress, holdingOf, deductHolding, markBarcodes, recordReject, vendorRemaining,
  toSizeMap, stageName,
  type SizeQty,
} from "@/lib/stock";

const sumQty = (arr?: SizeQty[]) => (arr || []).reduce((s, x) => s + Number(x?.jumlah || 0), 0);
const cleanItems = (items: any[]): SizeQty[] =>
  (items || []).map((i: any) => ({ size: String(i.size), jumlah: Math.max(0, Math.floor(Number(i.jumlah) || 0)) })).filter((i) => i.jumlah > 0);

// GET: ringkasan stok barang jadi, riwayat, antrean barang siap masuk (sisa per setoran), barang masih di vendor,
//      rekap per PO, daftar barang (SKU).   ?scan=KODE → cari barang dari barcode SKU / induk / produksi
export async function GET(req: NextRequest) {
  try {
    const data = readData();
    const scan = new URL(req.url).searchParams.get("scan");
    if (scan) {
      const r = resolveScan(data, scan);
      return r ? NextResponse.json(r) : NextResponse.json({ error: "Barcode tidak dikenal" }, { status: 404 });
    }
    const notas = data.nota_reject_vendor || [];
    const movements = [...(data.stock_movements || [])]
      .map((m: any) => {
        if (m.jenis === "reject") {
          const matchedNota = notas.find(
            (n: any) =>
              (m.no_nota && n.no_nota === m.no_nota) ||
              (m.nota_id && String(n.id) === String(m.nota_id)) ||
              (m.transfer_id != null && String(n.transfer_id) === String(m.transfer_id))
          );
          if (matchedNota) {
            return {
              ...m,
              nota_id: matchedNota.id,
              no_nota: matchedNota.no_nota,
              status_klaim: matchedNota.status_klaim || "Diajukan",
              biaya_per_pcs: matchedNota.biaya_per_pcs || 0,
              total_klaim: matchedNota.total_klaim || 0,
              tindakan_klaim: matchedNota.tindakan_klaim || "potong_tagihan",
              metode_pembayaran: matchedNota.metode_pembayaran || null,
              nominal_dibayar: matchedNota.nominal_dibayar || null,
              catatan_penyelesaian: matchedNota.catatan_penyelesaian || null,
              tanggal_selesai: matchedNota.tanggal_selesai || null,
              vendor_id: matchedNota.vendor_id || null,
              vendor_nama: matchedNota.vendor_nama || m.sumber || null,
            };
          }
        }
        return m;
      })
      .sort((a: any, b: any) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());

    const barang = (data.data_barang || []).map((b: any) => ({
      id: b.id, kode: b.kode || null, nama_barang: b.nama_barang, kategori_id: b.kategori_id,
      kategori: (data.kategori_produk || []).find((k: any) => String(k.id) === String(b.kategori_id))?.nama || null,
      harga_jual: b.harga_jual || 0,
    }));
    const inbound = getStockInbound(data);
    const di_vendor = getVendorWip(data);
    return NextResponse.json({
      stock: getStockSummary(data),
      movements,
      inbound,
      di_vendor,
      po_progress: getPoStockProgress(data, inbound, di_vendor),
      barang,
      prefix: skuPrefix(data),
      nama_usaha: data.pengaturan_sistem?.nama_usaha || "",
      nota_reject: notas,
      vendors: (data.vendors || []).map((v: any) => ({
        id: v.id,
        nama: v.nama,
        tipe: v.tipe,
        kontak: v.kontak || v.telepon || "",
        tarif: v.tarif || 0,
      })),
      po_list: (data.po_produksi || []).map((p: any) => ({
        id: p.id,
        noPo: p.noPo,
        model: p.model,
        vendorId: p.vendorId || p.vendor_id || null,
        vendorNama: p.vendorNama || p.vendor_nama || null,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/** Cari / buat barang jadi berdasarkan alokasi. */
function resolveBarang(data: any, alloc: any, kategoriNama: string): any {
  if (!data.data_barang) data.data_barang = [];
  if (alloc.barang_id != null && alloc.barang_id !== "") {
    const b = data.data_barang.find((x: any) => String(x.id) === String(alloc.barang_id));
    if (!b) throw new Error("Barang yang dipilih tidak ditemukan");
    ensureBarangKode(data, b);
    return b;
  }
  const nama = String(alloc.nama_baru || "").trim();
  if (!nama) throw new Error("Pilih barang atau isi nama barang baru");
  const existing = data.data_barang.find((x: any) => String(x.nama_barang).trim().toLowerCase() === nama.toLowerCase());
  if (existing) { ensureBarangKode(data, existing); return existing; }
  const kat = (data.kategori_produk || []).find((k: any) => String(k.nama).toLowerCase() === String(kategoriNama).toLowerCase());
  const id = nextId(data, "data_barang" as any);
  const b: any = {
    id,
    uid: `BRG-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    nama_barang: nama,
    kategori_id: alloc.kategori_id ? Number(alloc.kategori_id) : (kat?.id || 0),
    harga_beli: 0,
    harga_jual: Number(alloc.harga_jual) || 0,
    stok: 0,
    sumber: "produksi",
    createdAt: new Date().toISOString(),
  };
  ensureBarangKode(data, b);
  data.data_barang.push(b);
  return b;
}

// POST: { action: "terima" | "reject_vendor" | "keluar", ... }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = readData();
    if (!data.stock_movements) data.stock_movements = [];
    const now = new Date().toISOString();

    // ── Terima (sebagian/semua) barang selesai proses → beri nama barang → masuk stok ──
    // body: { transfer_id, alokasi: [{ barang_id? | nama_baru, kategori_id?, harga_jual?, items:[{size,jumlah}] }],
    //         reject_items?: [{size,jumlah}], alasan_reject?, sisa_reject?: boolean, catatan }
    // Sisa yang tidak diisi TETAP di antrean (setoran berikutnya / diterima nanti), kecuali sisa_reject = true.
    if (body.action === "terima") {
      const { transfer_id, catatan } = body;
      const inbound = getStockInbound(data).find((x) => String(x.transfer_id) === String(transfer_id));
      const t = (data.produksi_transfers || []).find((x: any) => String(x.id) === String(transfer_id));
      const holding = t ? holdingOf(data, t) : null;
      if (!inbound || !t || !holding) return NextResponse.json({ error: "Barang tidak ditemukan di antrean / sudah masuk stok semua" }, { status: 404 });

      // Kompatibilitas: tanpa alokasi dan tanpa reject → satu alokasi memakai nama kategori, semua sisa
      const alokasiRaw: any[] = Array.isArray(body.alokasi)
        ? body.alokasi
        : (cleanItems(body.reject_items).length > 0
          ? []
          : [{ nama_baru: body.nama_barang || inbound.kategori, items: body.items || inbound.sizes }]);
      const alokasi = alokasiRaw.map((a) => ({ ...a, items: cleanItems(a.items) })).filter((a) => a.items.length > 0);
      let rejectItems = cleanItems(body.reject_items);

      const hasSizes = inbound.sizes.length > 0;
      const maxBySize = toSizeMap(inbound.sizes);
      const usedBySize: Record<string, number> = {};
      for (const a of alokasi) for (const it of a.items) usedBySize[it.size] = (usedBySize[it.size] || 0) + it.jumlah;
      for (const it of rejectItems) usedBySize[it.size] = (usedBySize[it.size] || 0) + it.jumlah;

      // Sisa dianggap reject (opsional)
      if (body.sisa_reject && hasSizes) {
        const extra: SizeQty[] = [];
        for (const [size, max] of Object.entries(maxBySize)) {
          const left = max - (usedBySize[size] || 0);
          if (left > 0) { extra.push({ size, jumlah: left }); usedBySize[size] = max; }
        }
        const rm = toSizeMap(rejectItems);
        for (const e of extra) rm[e.size] = (rm[e.size] || 0) + e.jumlah;
        rejectItems = Object.entries(rm).filter(([, j]) => j > 0).map(([size, jumlah]) => ({ size, jumlah }));
      }

      if (hasSizes) {
        for (const [size, j] of Object.entries(usedBySize)) {
          if (j > (maxBySize[size] || 0)) return NextResponse.json({ error: `Size ${size} melebihi sisa barang selesai (${maxBySize[size] || 0} pcs)` }, { status: 400 });
        }
      }
      const totalMasuk = alokasi.reduce((s, a) => s + sumQty(a.items), 0);
      const totalReject = sumQty(rejectItems);
      if (totalMasuk + totalReject <= 0) return NextResponse.json({ error: "Isi jumlah masuk stok atau reject minimal 1 pcs" }, { status: 400 });
      if (totalMasuk + totalReject > inbound.jumlah) return NextResponse.json({ error: `Jumlah melebihi sisa barang selesai (${inbound.jumlah} pcs)` }, { status: 400 });
      const sisa = inbound.jumlah - totalMasuk - totalReject;

      const sumber = `${inbound.tahap}${inbound.vendor_nama && inbound.vendor_nama !== "-" ? ` · ${inbound.vendor_nama}` : ""}`;
      const movementIds: number[] = [];
      for (const a of alokasi) {
        const barang = resolveBarang(data, a, inbound.kategori);
        const kode = barang.kode as string;
        const items = a.items.map((it: SizeQty) => ({ ...it, sku: skuCode(kode, it.size) }));
        const jumlah = sumQty(items);
        const mid = nextId(data, "stock_movements");
        movementIds.push(mid);
        data.stock_movements.push({
          id: mid,
          tanggal: now,
          jenis: "masuk",
          barang_id: barang.id,
          kode,
          nama_barang: barang.nama_barang,
          kategori: inbound.kategori,
          po_id: inbound.po_id,
          noPo: inbound.noPo,
          items,
          jumlah,
          sumber,
          transfer_id: inbound.transfer_id,
          keterangan: [
            catatan,
            alokasi.length > 1 ? `Dipecah ${alokasi.length} barang` : "",
            totalReject > 0 ? `Reject ${totalReject} pcs` : "",
            sisa > 0 ? `Sisa ${sisa} pcs menyusul` : "",
          ].filter(Boolean).join(" · ") || `Selesai proses ${inbound.tahap}`,
        });
        // Tautkan barcode produksi → SKU barang jadi, status siap_jual
        for (const it of items) {
          markBarcodes(data, inbound.po_id, [it], inbound.tahap_slug, (b) => {
            b.status = "siap_jual"; b.stockAt = now; b.barang_id = barang.id; b.sku = it.sku;
          }, "done");
        }
      }

      let rejectId: number | null = null;
      let rejectNota: any = null;
      if (totalReject > 0) {
        const rejVendorId = body.reject_vendor_id != null && body.reject_vendor_id !== "" ? body.reject_vendor_id : inbound.vendor_id;
        const targetVendor = (data.vendors || []).find((v: any) => String(v.id) === String(rejVendorId));
        const biayaPerPcs = body.biaya_per_pcs != null ? Number(body.biaya_per_pcs) : undefined;
        const totalKlaim = body.total_klaim != null ? Number(body.total_klaim) : (biayaPerPcs != null ? totalReject * biayaPerPcs : undefined);

        const rejRes = recordReject(data, {
          po_id: inbound.po_id,
          items: rejectItems,
          sumber: targetVendor?.nama || inbound.vendor_nama || sumber,
          tahap_slug: inbound.tahap_slug,
          transfer_id: inbound.transfer_id,
          vendor_id: rejVendorId,
          vendor_nama: targetVendor?.nama || inbound.vendor_nama,
          ledger_from: inbound.ledger_from,
          keterangan: body.alasan_reject || (body.sisa_reject ? "Sisa dinyatakan reject saat terima gudang" : "Reject saat terima gudang"),
          now,
          biaya_per_pcs: biayaPerPcs,
          total_klaim: totalKlaim,
          tindakan_klaim: body.tindakan_klaim || "potong_tagihan",
        });
        rejectId = rejRes?.movement_id ?? null;
        rejectNota = rejRes?.nota ?? null;
      }

      // Kurangi sisa di holding; tutup jika habis
      deductHolding(t, holding.kind, usedBySize, totalMasuk + totalReject);
      t.stocked_qty = Number(t.stocked_qty || 0) + totalMasuk;
      t.reject_qty = Number(t.reject_qty || 0) + totalReject;
      t.stocked_at = now;
      (t.stock_log ||= []).push({ tanggal: now, masuk: totalMasuk, reject: totalReject, movement_ids: movementIds, reject_id: rejectId });
      const habis = !holdingOf(data, t);
      if (habis) { t.stocked = true; t.is_forwarded = true; }

      if (totalMasuk > 0) {
        if (!data.po_ledgers) data.po_ledgers = [];
        data.po_ledgers.push({
          id: nextId(data, "po_ledgers"),
          poId: Number(inbound.po_id),
          dari_vendor_id: inbound.ledger_from,
          ke_vendor_id: "GUDANG_JADI",
          jumlah: totalMasuk,
          tanggal: now,
          catatan: `Masuk Gudang & Stok (${inbound.tahap})`,
        });
      }

      writeData(data);
      return NextResponse.json({ success: true, jumlah: totalMasuk, reject: totalReject, sisa: habis ? 0 : sisa, movement_ids: movementIds, nota_reject: rejectNota });
    }

    // ── Tutup sisa pekerjaan di vendor sebagai reject ──────────────────
    // body: { transfer_id, items:[{size,jumlah}], alasan }
    if (body.action === "reject_vendor") {
      const t = (data.produksi_transfers || []).find((x: any) => String(x.id) === String(body.transfer_id));
      if (!t || t.vendor_id == null) return NextResponse.json({ error: "Pekerjaan vendor tidak ditemukan" }, { status: 404 });
      const r = vendorRemaining(data, t);
      const items = cleanItems(body.items);
      const total = sumQty(items);
      if (total <= 0) return NextResponse.json({ error: "Isi jumlah reject per size" }, { status: 400 });
      if (r.bisa_tutup.length) {
        const max = toSizeMap(r.bisa_tutup);
        const over = items.find((i) => i.jumlah > (max[i.size] || 0));
        if (over) return NextResponse.json({ error: `Size ${over.size} maksimal ${max[over.size] || 0} pcs (sisa di vendor yang belum dilaporkan)` }, { status: 400 });
      } else if (total > r.bisa_tutup_total) {
        return NextResponse.json({ error: `Maksimal ${r.bisa_tutup_total} pcs` }, { status: 400 });
      }
      const vendor = (data.vendors || []).find((v: any) => String(v.id) === String(t.vendor_id));
      const rejRes = recordReject(data, {
        po_id: t.po_id,
        items,
        sumber: `${stageName(data, t.ke)} · ${vendor?.nama || "-"}`,
        tahap_slug: t.ke,
        transfer_id: t.id,
        vendor_id: t.vendor_id,
        ledger_from: String(t.vendor_id),
        keterangan: body.alasan || "Reject / hilang di vendor",
        now,
        biaya_per_pcs: body.biaya_per_pcs != null ? Number(body.biaya_per_pcs) : undefined,
        tindakan_klaim: body.tindakan_klaim || "potong_tagihan",
      });
      const rm = toSizeMap(t.reject_items);
      for (const it of items) rm[it.size] = (rm[it.size] || 0) + it.jumlah;
      t.reject_items = Object.entries(rm).map(([size, jumlah]) => ({ size, jumlah }));
      t.jumlah_reject = Number(t.jumlah_reject || 0) + total;
      (t.reject_log ||= []).push({ tanggal: now, items, jumlah: total, alasan: body.alasan || "" });

      // Semua sisa sudah disetor / reject → pekerjaan vendor selesai
      const after = vendorRemaining(data, t);
      const selesai = after.total <= 0 && after.pending <= 0;
      if (selesai) {
        t.status = "Selesai";
        t.selesai_at = t.selesai_at || now;
        t.terlambat_hari = after.lateDays;
        t.tepat_waktu = after.lateDays === 0;
      }
      writeData(data);
      return NextResponse.json({ success: true, jumlah: total, selesai, sisa: after.total, nota_reject: rejRes?.nota || null });
    }

    // ── Barang keluar dari Gudang & Stok ──────────────────────────────
    // body: { key, items:[{size,jumlah}], tujuan, keterangan }
    if (body.action === "keluar") {
      const { tujuan, keterangan } = body;
      const key: string = body.key || (body.kategori ? `k:${body.kategori}` : "");
      const items = cleanItems(body.items);
      const row = getStockSummary(data).find((r) => r.key === key);
      if (!row || items.length === 0) return NextResponse.json({ error: "Pilih barang & isi jumlah per size" }, { status: 400 });
      const avail = getAvailableSizes(data, key);
      const over = items.find((i) => i.jumlah > (avail[i.size] || 0));
      if (over) return NextResponse.json({ error: `Stok size ${over.size} tidak cukup (tersedia ${avail[over.size] || 0} pcs)` }, { status: 400 });

      const withSku = items.map((it) => ({ ...it, sku: row.kode ? skuCode(row.kode, it.size) : undefined }));
      data.stock_movements.push({
        id: nextId(data, "stock_movements"),
        tanggal: now,
        jenis: "keluar",
        barang_id: row.barang_id ?? undefined,
        kode: row.kode ?? undefined,
        nama_barang: row.nama_barang,
        kategori: row.kategori,
        items: withSku,
        jumlah: sumQty(items),
        sumber: tujuan || "Keluar Manual",
        keterangan: keterangan || "",
      });

      if (data.barcode_item) {
        const legacyPoIds = new Set((data.po_produksi || []).filter((p: any) => p.model === row.kategori).map((p: any) => String(p.id)));
        for (const it of items) {
          let n = 0;
          for (const b of data.barcode_item) {
            if (n >= it.jumlah) break;
            const match = row.barang_id != null ? String(b.barang_id) === String(row.barang_id) : legacyPoIds.has(String(b.poId));
            if (b.status === "siap_jual" && b.size === it.size && match) { b.status = "terjual"; b.keluarAt = now; n++; }
          }
        }
      }

      writeData(data);
      return NextResponse.json({ success: true, jumlah: sumQty(items) });
    }

    return NextResponse.json({ error: "Aksi tidak dikenal" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
