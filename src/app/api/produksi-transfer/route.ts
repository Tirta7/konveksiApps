import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";
import { getTransferCompletion } from "@/lib/po-lifecycle";
import { holdingOf, deductHolding, vendorRemaining, toSizeMap, normalizeStage, recordReject } from "@/lib/stock";
import { poolAvailability, isOpenPool, sourceStock, markSourceChange, stageLabel, reservationsFor, type Reservation } from "@/lib/pool-guard";
import { emitEvent, presenceFor } from "@/lib/realtime-hub";

// GET: list transfers, optionally filter by po_id or tahap_ke
export async function GET(req: NextRequest) {
  const data = readData();
  if (!data.produksi_transfers) data.produksi_transfers = [];
  const { searchParams } = new URL(req.url);
  const poId = searchParams.get("po_id");
  const dari = searchParams.get("dari");
  const ke = searchParams.get("ke");
  let list = data.produksi_transfers;
  if (poId) list = list.filter((t: any) => String(t.po_id) === poId);
  if (dari) list = list.filter((t: any) => t.dari === dari);
  if (ke) list = list.filter((t: any) => t.ke === ke);
  // Enrich with vendor name + po info
  const enriched = list.map((t: any) => {
    const po = (data.po_produksi || []).find((p: any) => p.id === t.po_id);
    const vendor = (data.vendors || []).find((v: any) => v.id === t.vendor_id);
    // Progres laporan vendor (hanya relevan untuk transfer yang sudah punya vendor)
    let progress: any = null;
    let sisa_sizes: any[] | undefined;
    if (t.vendor_id != null) {
      const c = getTransferCompletion(data, t);
      const r = vendorRemaining(data, t);
      progress = { jumlah: c.jumlah, approved: c.approved, pending: c.pending, sisa: c.sisa, done: c.done, waitingAcc: c.waitingAcc, lateDays: c.lateDays, reject: Number(t.jumlah_reject || 0) };
      sisa_sizes = r.bisa_tutup; // sisa di vendor yang belum dilaporkan (boleh ditarik / di-reject)
    }
    const h = holdingOf(data, t);
    const isSource = !!h || isOpenPool(t);
    const reservations = isSource ? reservationsFor(data, t.id) : [];
    return { ...t, noPo: po?.noPo || "-", model: po?.model || "-", vendor_nama: vendor?.nama || "-", progress, sisa_sizes, holding: h ? { kind: h.kind, total: h.total, sizes: h.sizes } : null, reservations, rev: Number(t.rev || 0) };
  }).reverse();
  return NextResponse.json(enriched);
}

// POST: create a new transfer (e.g. Gudang kirim ke Washing)
// Semua validasi (termasuk cek bentrok dengan permintaan vendor) dilakukan SEBELUM data diubah,
// dan tidak ada `await` di antara baca → validasi → tulis, sehingga operasi ini atomik.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const data = readData(); // baca SETELAH body diterima → selalu data terbaru
  if (!data.produksi_transfers) data.produksi_transfers = [];
  const { po_id, dari, ke, vendor_id, jumlah_kirim, sizeBreakdown, catatan, transfer_id_asal, target_selesai, expected_total, resolve_requests, actor } = body;
  if (!po_id || !dari || !ke || !jumlah_kirim) return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });

  const usedTotal = Number(jumlah_kirim);
  const used = toSizeMap(sizeBreakdown || []);
  const keLower = String(ke).toLowerCase();
  const isKeGudang = keLower === "gudang" || keLower.includes("gudang") || keLower.includes("qc");
  const nowIso = new Date().toISOString();
  const actorName = actor || "Admin";

  // ── 1. VALIDASI (belum ada perubahan data) ──
  let origin: any = null;
  let mode: "holding" | "cmt_pool" | "vendor_active" | "legacy" | null = null;
  let holding: ReturnType<typeof holdingOf> = null;
  let toReject: Reservation[] = [];
  let toFulfil: Reservation[] = [];

  if (transfer_id_asal) {
    origin = data.produksi_transfers.find((t: any) => String(t.id) === String(transfer_id_asal));
    if (!origin) return NextResponse.json({ error: "Sumber barang tidak ditemukan (mungkin sudah dihapus)", code: "STALE" }, { status: 409 });
    if (String(origin.po_id) !== String(po_id)) return NextResponse.json({ error: "Sumber barang bukan milik PO ini" }, { status: 400 });

    holding = holdingOf(data, origin);
    const vendorActive = origin.vendor_id != null && ["Kirim", "Proses", "Dikerjakan"].includes(origin.status) && !origin.is_forwarded;
    if (holding) mode = "holding";
    else if (origin.vendor_id == null && normalizeStage(origin.dari) === "cmt" && isOpenPool(origin)) mode = "cmt_pool";
    else if (vendorActive) mode = "vendor_active";
    else mode = "legacy";

    if (mode === "holding" || mode === "cmt_pool") {
      const avail = poolAvailability(data, origin);
      // Optimistic lock: stok yang dilihat admin harus sama dengan stok sekarang
      if ((expected_total != null && Number(expected_total) !== avail.total) || usedTotal > avail.total) {
        return NextResponse.json({
          code: "STALE",
          error: `Stok sumber sudah berubah: sekarang tersisa ${avail.total} pcs${expected_total != null ? ` (sebelumnya ${expected_total} pcs)` : ""}.`,
          current_total: avail.total,
          current_sizes: avail.sizes,
          last_change: origin.last_change || null,
          reservations: avail.reservations,
        }, { status: 409 });
      }
      const am = toSizeMap(avail.sizes);
      const over = avail.sizes.length ? Object.entries(used).find(([s, j]) => j > (am[s] || 0)) : null;
      if (over) return NextResponse.json({ code: "STALE", error: `Size ${over[0]} tinggal ${am[over[0]] || 0} pcs`, current_total: avail.total, current_sizes: avail.sizes, last_change: origin.last_change || null }, { status: 409 });

      // Bentrok dengan permintaan vendor yang masih menunggu
      if (avail.reservations.length) {
        const targetVid = vendor_id ? Number(vendor_id) : null;
        const own = avail.reservations.filter(r => targetVid != null && r.vendor_id === targetVid);
        const others = avail.reservations.filter(r => !(targetVid != null && r.vendor_id === targetVid));
        const othersReserved = others.reduce((s, r) => s + r.sisa, 0);
        const freeForThis = Math.max(0, avail.total - othersReserved);
        if (usedTotal > freeForThis) {
          if (resolve_requests !== "tolak") {
            return NextResponse.json({
              code: "RESERVED",
              error: `${others.map(r => `${r.vendor_nama} (${r.sisa} pcs)`).join(", ")} sedang meminta stok ini. Stok bebas hanya ${freeForThis} pcs.`,
              total: avail.total,
              free: freeForThis,
              reservations: others,
              presence: presenceFor(p => p.transfer_id != null && String(p.transfer_id) === String(origin.id) && p.role === "vendor"),
            }, { status: 409 });
          }
          // Admin memilih tetap kirim → tolak permintaan terbaru lebih dulu sampai stok cukup
          let need = usedTotal - freeForThis;
          for (const r of [...others].reverse()) {
            if (need <= 0) break;
            toReject.push(r);
            need -= r.sisa;
          }
        }
        toFulfil = own; // Kirim ke vendor yang sedang meminta → otomatis memenuhi permintaannya
      }
    } else if (mode === "vendor_active") {
      const r = vendorRemaining(data, origin);
      if (usedTotal > r.bisa_tutup_total) return NextResponse.json({ code: "STALE", error: `Maksimal ${r.bisa_tutup_total} pcs (sisa di vendor yang belum dilaporkan)` }, { status: 409 });
      const bm = toSizeMap(r.bisa_tutup);
      const over = r.bisa_tutup.length ? Object.entries(used).find(([s, j]) => j > (bm[s] || 0)) : null;
      if (over) return NextResponse.json({ code: "STALE", error: `Size ${over[0]} maksimal ${bm[over[0]] || 0} pcs` }, { status: 409 });
    }
  } else {
    // Tanpa sumber (langsung dari PO): jangan sampai total barang yang dilepas melebihi jumlah PO
    const po = (data.po_produksi || []).find((p: any) => String(p.id) === String(po_id));
    const poTotal = Number(po?.jumlahTerbit || 0);
    const sudahDilepas = data.produksi_transfers
      .filter((t: any) => String(t.po_id) === String(po_id) && !t.transfer_id_asal && !t.dari_transfer_id && !t.dari_laporan_id && t.status !== "Ditolak" && t.status !== "Dibatalkan" && (!t.dari || ["cmt", "potong"].includes(normalizeStage(t.dari))))
      .reduce((s: number, t: any) => s + Number(t.jumlah_kirim_awal ?? t.jumlah_kirim ?? 0), 0);
    const sisaPo = Math.max(0, poTotal - sudahDilepas);
    if (poTotal > 0 && usedTotal > sisaPo) {
      return NextResponse.json({
        code: "STALE",
        error: sisaPo === 0
          ? `Seluruh ${poTotal} pcs PO ini sudah dikirim ke pos lanjutan. Pilih sumber barang dari pos yang sedang memegang barang (mis. hasil Washing / Gudang).`
          : `Jumlah melebihi sisa PO yang belum dikirim (${sisaPo} dari ${poTotal} pcs).`,
        current_total: sisaPo,
      }, { status: 409 });
    }
  }

  // ── 2. TULIS (sinkron, tanpa await) ──
  const id = nextId(data, "produksi_transfers" as any);
  const transfer: any = {
    id, po_id: Number(po_id),
    dari, ke,
    vendor_id: vendor_id ? Number(vendor_id) : null,
    target_selesai: target_selesai || null,
    jumlah_kirim: usedTotal,
    jumlah_diterima: null,
    sizeBreakdown: sizeBreakdown || [],
    sizeBreakdown_diterima: null,
    catatan: catatan || "",
    status: "Kirim",   // Kirim | Diterima | Diverifikasi
    tanggal_kirim: nowIso,
    tanggal_terima: null,
    transfer_id_asal: transfer_id_asal ? Number(transfer_id_asal) : null,
    dari_vendor_id: origin ? (origin.vendor_id ?? origin.dari_vendor_id ?? null) : null,
  };
  data.produksi_transfers.push(transfer);

  // Sync with po_pipeline if exists
  if (data.po_pipeline) {
    const pEntry = data.po_pipeline.find((p: any) => p.po_id === Number(po_id));
    if (pEntry && Array.isArray(pEntry.stages)) {
      const fromStage = pEntry.stages.find((s: any) => s.slug === dari);
      if (fromStage) {
        fromStage.status = "Selesai";
        fromStage.selesai_tgl = nowIso.split("T")[0];
      }
      const toStage = pEntry.stages.find((s: any) => s.slug === ke);
      if (toStage) {
        toStage.status = "Proses";
        if (vendor_id) toStage.vendor_id = Number(vendor_id);
        if (target_selesai) toStage.target_selesai = target_selesai;
      }
      pEntry.updatedAt = nowIso;
    }
  }

  // Kurangi sumber sebesar yang dipindah (mendukung pemindahan bertahap)
  const originVendorId: any = origin ? origin.vendor_id : null;
  const targetLabel = vendor_id ? ((data.vendors || []).find((v: any) => v.id === Number(vendor_id))?.nama || "vendor") : stageLabel(data, ke);
  if (origin) {
    if (mode === "holding" && holding) {
      deductHolding(origin, holding.kind, used, usedTotal);
      origin.forwarded_qty = Number(origin.forwarded_qty || 0) + usedTotal;
      if (!holdingOf(data, origin)) origin.is_forwarded = true;
      markSourceChange(origin, `${usedTotal} pcs dikirim ke ${targetLabel}`, actorName);
    } else if (mode === "cmt_pool") {
      deductHolding(origin, "pool", used, usedTotal);
      origin.forwarded_qty = Number(origin.forwarded_qty || 0) + usedTotal;
      if (Number(origin.jumlah_kirim || 0) <= 0) origin.status = "Ditarik Penuh";
      markSourceChange(origin, `${usedTotal} pcs dikirim ke ${targetLabel}`, actorName);
    } else if (mode === "vendor_active") {
      if (origin.jumlah_kirim_awal == null) {
        origin.jumlah_kirim_awal = Number(origin.jumlah_kirim || 0);
        origin.sizeBreakdown_awal = JSON.parse(JSON.stringify(origin.sizeBreakdown || []));
      }
      origin.sizeBreakdown = (origin.sizeBreakdown || [])
        .map((s: any) => ({ ...s, jumlah: Math.max(0, Number(s.jumlah || 0) - (used[String(s.size)] || 0)) }))
        .filter((s: any) => s.jumlah > 0);
      origin.jumlah_kirim = Math.max(0, Number(origin.jumlah_kirim || 0) - usedTotal);
      origin.ditarik_qty = Number(origin.ditarik_qty || 0) + usedTotal;
      const after = vendorRemaining(data, origin);
      if (after.total <= 0 && after.pending <= 0) {
        if (after.approved > 0) {
          origin.status = "Selesai";
          origin.selesai_at = origin.selesai_at || nowIso;
          origin.terlambat_hari = after.lateDays;
          origin.tepat_waktu = after.lateDays === 0;
        } else {
          origin.is_forwarded = true;
          if (isKeGudang) { origin.status = "Kembali ke Gudang"; origin.tanggal_kembali = nowIso; }
        }
      }
      markSourceChange(origin, `${usedTotal} pcs ditarik dari vendor`, actorName);
    } else {
      origin.is_forwarded = true;
      if (isKeGudang && origin.status !== "Diverifikasi") {
        origin.status = "Kembali ke Gudang";
        origin.tanggal_kembali = nowIso;
      }
    }
  }

  // Permintaan vendor: penuhi milik vendor tujuan, tolak yang dipilih admin
  const reqUpdates: any[] = [];
  if (toFulfil.length) {
    let left = usedTotal;
    for (const r of toFulfil) {
      if (left <= 0) break;
      const rq = (data.cmt_requests || []).find((x: any) => x.id === r.id);
      if (!rq) continue;
      const give = Math.min(left, r.sisa);
      rq.total_dipenuhi = Number(rq.total_dipenuhi || 0) + give;
      rq.status = rq.total_dipenuhi >= Number(rq.total_request || 0) ? "Selesai" : "Sebagian";
      rq.catatan = `Dipenuhi admin via Kirim ke Pos Berikutnya (${rq.total_dipenuhi}/${rq.total_request} pcs)`;
      rq.diproses_at = nowIso;
      left -= give;
      reqUpdates.push({ id: rq.id, vendor_id: rq.vendor_id, status: rq.status, total_dipenuhi: rq.total_dipenuhi });
    }
  }
  for (const r of toReject) {
    const rq = (data.cmt_requests || []).find((x: any) => x.id === r.id);
    if (!rq) continue;
    rq.status = "Ditolak";
    rq.alasan_tolak = `Stok sudah dialokasikan admin ke ${targetLabel} (${usedTotal} pcs) pada ${new Date(nowIso).toLocaleString("id-ID")}`;
    rq.diproses_at = nowIso;
    reqUpdates.push({ id: rq.id, vendor_id: rq.vendor_id, status: "Ditolak", alasan: rq.alasan_tolak });
  }

  // Sync to po_ledgers so Dashboard CMT reflects the physical balance
  if (!data.po_ledgers) data.po_ledgers = [];
  data.po_ledgers.push(
    isKeGudang
      ? {
          id: nextId(data, "po_ledgers"),
          poId: Number(po_id),
          dari_vendor_id: originVendorId ? String(originVendorId) : "SISTEM",
          ke_vendor_id: "GUDANG",
          jumlah: usedTotal,
          tanggal: nowIso,
          catatan: catatan || `Ditarik dari ${dari} kembali ke Gudang`
        }
      : {
          id: nextId(data, "po_ledgers"),
          poId: Number(po_id),
          dari_vendor_id: "GUDANG",
          ke_vendor_id: vendor_id ? String(vendor_id) : "GUDANG",
          jumlah: usedTotal,
          tanggal: nowIso,
          catatan: catatan || `Dikirim dari ${dari} ke ${ke}`
        }
  );

  // Sync barcode status if moving to washing, benang, finishing
  if (data.barcode_item && !isKeGudang) {
    let updated = 0;
    for (let i = 0; i < data.barcode_item.length && updated < usedTotal; i++) {
      const b = data.barcode_item[i];
      if (String(b.poId) === String(po_id) && ["gudang", "siap_jual"].includes(b.status)) {
        b.status = ke === "bersih_benang" ? "benang" : (ke === "qc" ? "finishing" : ke);
        updated++;
      }
    }
  }
  writeData(data);

  // ── 3. NOTIFIKASI REALTIME ──
  const po = (data.po_produksi || []).find((p: any) => p.id === Number(po_id));
  if (origin) {
    emitEvent("poolAllocated", {
      transfer_id: origin.id,
      po_id: Number(po_id),
      no_po: po?.noPo || "",
      jumlah: usedTotal,
      sisa: sourceStock(data, origin).total,
      ke: targetLabel,
      vendor_id: vendor_id ? Number(vendor_id) : null,
      by: actorName,
    });
  }
  for (const u of reqUpdates) emitEvent("requestUpdated", { ...u, no_po: po?.noPo || "" });

  return NextResponse.json({ ...transfer, requests_updated: reqUpdates });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const data = readData();
  if (!data.produksi_transfers) data.produksi_transfers = [];
  const { id, jumlah_diterima, sizeBreakdown_diterima, catatan_terima, klaim_reject, retur_perbaikan } = body;
  const idx = data.produksi_transfers.findIndex((t: any) => String(t.id) === String(id));
  if (idx === -1) return NextResponse.json({ error: "Transfer tidak ditemukan" }, { status: 404 });
  const t = data.produksi_transfers[idx];
  const nowIso = new Date().toISOString();

  // ── 1. JIKA ADA RETUR PERBAIKAN (REWORK) ──
  let reworkTransferObj: any = null;
  if (retur_perbaikan && Number(retur_perbaikan.jumlah_retur) > 0) {
    const jmlRetur = Number(retur_perbaikan.jumlah_retur);
    const jmlDiterima = Number(jumlah_diterima || 0);
    const targetVid = retur_perbaikan.vendor_id || t.dari_vendor_id || t.vendor_id;
    const targetVnama = retur_perbaikan.vendor_nama || t.vendor_nama;
    const rCount = (Number(t.rework_count) || 0) + 1;

    // Catat ke antrean retur_produksi
    if (!data.retur_produksi) data.retur_produksi = [];
    data.retur_produksi.push({
      id: nextId(data, "retur_produksi" as any),
      transfer_id: t.id,
      po_id: t.po_id,
      noPo: t.noPo || "-",
      vendor_id: targetVid,
      vendor_nama: targetVnama,
      tahap: t.dari,
      jumlah: jmlRetur,
      alasan: retur_perbaikan.alasan_retur || "Perbaikan QC Gudang",
      ke_berapa_kali: rCount,
      status: "diproses-ulang",
      tanggal: nowIso,
    });

    if (jmlDiterima <= 0) {
      // 100% Barang dikembalikan untuk perbaikan (Full Rework)
      t.status = "Retur Perbaikan";
      t.is_rework = true;
      t.rework_count = rCount;
      t.alasan_retur = retur_perbaikan.alasan_retur || "Perbaikan QC Gudang";
      t.catatan = `[RETUR PERBAIKAN KE-${rCount}] ${t.alasan_retur}`;
      t.jumlah_diterima = 0;
      t.tanggal_retur = nowIso;
      reworkTransferObj = t;
    } else {
      // Sebagian diterima (masuk gudang), sebagian diretur perbaikan
      t.jumlah_diterima = jmlDiterima;
      t.sizeBreakdown_diterima = sizeBreakdown_diterima || t.sizeBreakdown;
      t.catatan_terima = catatan_terima || "";
      t.status = "Diverifikasi";
      t.tanggal_terima = nowIso;
      t.jumlah_retur = jmlRetur;
      t.alasan_retur = retur_perbaikan.alasan_retur || "Perbaikan QC Gudang";

      // Buat transfer baru untuk sisa barang yang diretur perbaikan ke vendor
      const newTfId = nextId(data, "produksi_transfers");
      reworkTransferObj = {
        id: newTfId,
        po_id: t.po_id,
        dari: "gudang",
        ke: t.dari, // kembali ke tahap asal, misal washing
        vendor_id: targetVid,
        vendor_nama: targetVnama,
        jumlah_kirim: jmlRetur,
        sizeBreakdown: retur_perbaikan.sizeBreakdown_retur || [],
        status: "Retur Perbaikan",
        is_rework: true,
        rework_origin_id: t.id,
        rework_count: rCount,
        catatan: `[RETUR PERBAIKAN KE-${rCount}] ${retur_perbaikan.alasan_retur || "Perbaikan QC Gudang"} (Asal #${t.id})`,
        tanggal_kirim: nowIso,
      };
      data.produksi_transfers.push(reworkTransferObj);
    }
  } else {
    // Verifikasi biasa / tanpa retur perbaikan
    t.jumlah_diterima = Number(jumlah_diterima);
    t.sizeBreakdown_diterima = sizeBreakdown_diterima || t.sizeBreakdown;
    t.catatan_terima = catatan_terima || "";
    t.status = "Diverifikasi";
    t.tanggal_terima = nowIso;
  }

  // ── 2. JIKA ADA KLAIM REJECT PERMANEN ──
  let notaObj: any = null;
  if (klaim_reject && Number(klaim_reject.jumlah_reject) > 0) {
    const rawRincian = Array.isArray(klaim_reject.rincian_reject) ? klaim_reject.rincian_reject : [];
    const rejectItems = rawRincian.length > 0
      ? rawRincian.map((r: any) => ({ size: String(r.size || "ALL"), jumlah: Number(r.jumlah || 0) }))
      : [{ size: "ALL", jumlah: Number(klaim_reject.jumlah_reject) }];

    const rejRes = recordReject(data, {
      po_id: t.po_id,
      items: rejectItems,
      sumber: `${t.dari} · ${klaim_reject.vendor_nama || "Vendor"}`,
      tahap_slug: t.dari,
      transfer_id: t.id,
      vendor_id: klaim_reject.vendor_id || t.dari_vendor_id || t.vendor_id,
      vendor_nama: klaim_reject.vendor_nama,
      ledger_from: String(klaim_reject.vendor_id || t.dari_vendor_id || t.vendor_id || "VENDOR"),
      keterangan: klaim_reject.alasan_reject || "Cacat produksi saat QC penerimaan gudang",
      now: nowIso,
      biaya_per_pcs: Number(klaim_reject.biaya_per_pcs || 0),
      total_klaim: Number(klaim_reject.total_klaim || 0),
      tindakan_klaim: klaim_reject.tindakan_klaim || "potong_tagihan",
      tukang_potong: klaim_reject.tukang_potong || null,
      nama_kain: klaim_reject.nama_kain || null,
      pos_asal: t.dari,
      pos_tujuan: t.ke,
      jumlah_kirim: Number(t.jumlah_kirim || 0),
      jumlah_diterima: Number(jumlah_diterima || 0),
    });

    if (rejRes) {
      notaObj = rejRes.nota;
      t.nota_reject_id = rejRes.nota_id;
      t.no_nota_reject = rejRes.no_nota;
      t.jumlah_reject = Number(klaim_reject.jumlah_reject || 0);
    }
  }

  data.produksi_transfers[idx] = t;
  writeData(data);
  return NextResponse.json({ ...t, nota_reject: notaObj, rework_transfer: reworkTransferObj });
}
