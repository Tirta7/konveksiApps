export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";
import { groupOrders } from "@/lib/marketplace";

const num = (v: any) => {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return isFinite(n) ? n : 0;
};

function isBatal(r: any) {
  const s = String(r?.status || "").toLowerCase();
  return Boolean(r?.dibatalkan || s.includes("batal") || s.includes("cancel"));
}

/**
 * Sinkronkan koleksi `piutang_grosir` dengan `data_pelanggan`:
 * - Jika ada pelanggan di `data_pelanggan` yang memiliki `piutang > 0` namun belum punya
 *   faktur aktif di `piutang_grosir`, buatkan entri faktur saldo awal secara otomatis.
 * - Setiap perubahan pada `piutang_grosir` juga memperbarui total `piutang` di `data_pelanggan`.
 */
function syncCustomerReceivables(data: any): boolean {
  if (!Array.isArray(data.piutang_grosir)) data.piutang_grosir = [];
  if (!Array.isArray(data.data_pelanggan)) data.data_pelanggan = [];
  let changed = false;

  for (const cust of data.data_pelanggan) {
    const existingForCust = data.piutang_grosir.filter((p: any) => Number(p.pelanggan_id) === Number(cust.id));
    const activeSum = existingForCust.reduce((s: number, p: any) => s + Math.max(0, num(p.total_tagihan) - num(p.jumlah_dibayar)), 0);
    if (existingForCust.length === 0 && num(cust.piutang) > 0) {
      data.piutang_grosir.push({
        id: nextId(data, "piutang_grosir" as any),
        no_faktur: `INV-SALDO-${String(cust.id).padStart(3, "0")}`,
        tanggal: new Date().toISOString().split("T")[0],
        jatuh_tempo: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
        pelanggan_id: cust.id,
        pelanggan_nama: cust.nama,
        pelanggan_kota: cust.kota || "",
        pelanggan_kontak: cust.kontak || "",
        total_tagihan: num(cust.piutang),
        jumlah_dibayar: 0,
        status: "Belum Lunas",
        catatan: "Saldo piutang berjalan pelanggan grosir",
        riwayat_bayar: [],
        createdAt: new Date().toISOString(),
      });
      changed = true;
    } else if (existingForCust.length > 0 && num(cust.piutang) !== activeSum) {
      cust.piutang = activeSum;
      changed = true;
    }
  }
  return changed;
}

export async function GET() {
  try {
    const data: any = readData();
    const synced = syncCustomerReceivables(data);
    if (synced) writeData(data);

    const pelangganMap = new Map<number, any>((data.data_pelanggan || []).map((c: any) => [Number(c.id), c]));

    const piutangGrosir = (data.piutang_grosir || [])
      .map((p: any) => {
        const cust = pelangganMap.get(Number(p.pelanggan_id));
        const total = num(p.total_tagihan);
        const dibayar = num(p.jumlah_dibayar);
        const sisa = Math.max(0, total - dibayar);
        const jt = p.jatuh_tempo ? new Date(p.jatuh_tempo) : null;
        const lewatHari = jt && sisa > 0 ? Math.floor((Date.now() - jt.getTime()) / 86400000) : 0;
        return {
          ...p,
          pelanggan_nama: cust?.nama || p.pelanggan_nama || "Pelanggan Grosir",
          pelanggan_kota: cust?.kota || p.pelanggan_kota || "",
          pelanggan_kontak: cust?.kontak || p.pelanggan_kontak || "",
          total_tagihan: total,
          jumlah_dibayar: dibayar,
          sisa,
          status: sisa <= 0 ? "Lunas" : dibayar > 0 ? "Dicicil" : "Belum Lunas",
          is_overdue: lewatHari > 0,
          lewat_hari: Math.max(0, lewatHari),
        };
      })
      .sort((a: any, b: any) => b.sisa - a.sisa || new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    // ── Piutang Escrow Marketplace (Multi-Toko) ──
    const settlements: any[] = data.settlement_online || [];
    const settleByOrder = new Map<string, any>();
    for (const s of settlements) settleByOrder.set(String(s.order_id), s);

    const grouped = Object.values(groupOrders(data)) as any[];
    const escrowOrders = grouped
      .filter((o) => (o.items || []).length > 0 && !isBatal(o) && !/retur|return/i.test(String(o.status || "")))
      .filter((o) => {
        const s = settleByOrder.get(String(o.order_id));
        return !(s && num(s.penyelesaian_pembayaran) > 0);
      })
      .map((o) => ({
        order_id: o.order_id,
        marketplace: o.marketplace || "Marketplace",
        shop_key: o.shop_key || "",
        shop_name: o.shop_name || o.marketplace || "Toko Online",
        platform: o.platform || "",
        tanggal_pesanan: o.tanggal_pesanan,
        buyer_username: o.buyer_username || o.recipient || "-",
        status: o.status || "Dikirim",
        tracking_id: o.tracking_id || "-",
        shipping_provider: o.shipping_provider || "-",
        total_qty: num(o.total_qty),
        total_amount: num(o.total_amount),
      }));

    // Kelompokkan escrow per Toko Online
    const perTokoMap: Record<string, any> = {};
    for (const o of escrowOrders) {
      const k = o.shop_key || `mp:${o.marketplace}`;
      const entry = (perTokoMap[k] ||= {
        shop_key: k,
        shop_name: o.shop_name || o.marketplace,
        marketplace: o.marketplace,
        platform: o.platform,
        pesanan: 0,
        pcs: 0,
        dikirim: 0,
        selesai: 0,
        total_escrow: 0,
      });
      entry.pesanan += 1;
      entry.pcs += o.total_qty;
      entry.total_escrow += o.total_amount;
      if (/selesai|completed/i.test(String(o.status))) entry.selesai += o.total_amount;
      else entry.dikirim += o.total_amount;
    }

    const totalGrosir = piutangGrosir.reduce((s: number, p: any) => s + p.sisa, 0);
    const totalEscrow = escrowOrders.reduce((s: number, o: any) => s + o.total_amount, 0);

    return NextResponse.json({
      summary: {
        totalPiutang: totalGrosir + totalEscrow,
        totalGrosir,
        totalEscrow,
        fakturBelumLunas: piutangGrosir.filter((p: any) => p.sisa > 0).length,
        fakturJatuhTempo: piutangGrosir.filter((p: any) => p.is_overdue).length,
        pesananEscrow: escrowOrders.length,
      },
      grosir: piutangGrosir,
      escrowPerToko: Object.values(perTokoMap).sort((a: any, b: any) => b.total_escrow - a.total_escrow),
      escrowOrders: escrowOrders.slice(0, 100),
      pelangganList: data.data_pelanggan || [],
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST → Buat faktur piutang pelanggan grosir baru
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data: any = readData();
    if (!Array.isArray(data.piutang_grosir)) data.piutang_grosir = [];
    if (!Array.isArray(data.data_pelanggan)) data.data_pelanggan = [];

    const totalTagihan = num(body.total_tagihan);
    const dibayarAwal = Math.min(totalTagihan, Math.max(0, num(body.jumlah_dibayar)));
    if (totalTagihan <= 0) {
      return NextResponse.json({ error: "Total tagihan harus lebih dari 0" }, { status: 400 });
    }

    let cust = data.data_pelanggan.find((c: any) => Number(c.id) === Number(body.pelanggan_id));
    const namaPelanggan = cust?.nama || String(body.pelanggan_nama || "").trim();
    if (!namaPelanggan) {
      return NextResponse.json({ error: "Nama pelanggan wajib diisi" }, { status: 400 });
    }

    const id = nextId(data, "piutang_grosir" as any);
    const today = new Date().toISOString().split("T")[0];
    const defaultJt = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];
    const sisa = Math.max(0, totalTagihan - dibayarAwal);

    const record = {
      id,
      no_faktur: body.no_faktur || `INV-${today.replace(/-/g, "")}-${String(id).padStart(3, "0")}`,
      tanggal: body.tanggal || today,
      jatuh_tempo: body.jatuh_tempo || defaultJt,
      pelanggan_id: cust?.id || null,
      pelanggan_nama: namaPelanggan,
      pelanggan_kota: cust?.kota || body.pelanggan_kota || "",
      pelanggan_kontak: cust?.kontak || body.pelanggan_kontak || "",
      total_tagihan: totalTagihan,
      jumlah_dibayar: dibayarAwal,
      status: sisa <= 0 ? "Lunas" : dibayarAwal > 0 ? "Dicicil" : "Belum Lunas",
      catatan: body.catatan || "",
      riwayat_bayar:
        dibayarAwal > 0
          ? [{ tanggal: new Date().toISOString(), nominal: dibayarAwal, metode: body.metode || "DP Awal", catatan: "Pembayaran awal" }]
          : [],
      createdAt: new Date().toISOString(),
    };

    data.piutang_grosir.push(record);
    syncCustomerReceivables(data);
    writeData(data);
    return NextResponse.json({ success: true, record });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PUT → Catat pembayaran cicilan / pelunasan piutang
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const data: any = readData();
    if (!Array.isArray(data.piutang_grosir)) data.piutang_grosir = [];

    const id = Number(body.id);
    const bayar = num(body.bayar_amount);
    if (!id || bayar <= 0) {
      return NextResponse.json({ error: "Nominal pembayaran tidak valid" }, { status: 400 });
    }

    const idx = data.piutang_grosir.findIndex((p: any) => Number(p.id) === id);
    if (idx === -1) return NextResponse.json({ error: "Data piutang tidak ditemukan" }, { status: 404 });

    const p = data.piutang_grosir[idx];
    const sisaLama = Math.max(0, num(p.total_tagihan) - num(p.jumlah_dibayar));
    const nominalValid = Math.min(sisaLama, bayar);

    p.jumlah_dibayar = num(p.jumlah_dibayar) + nominalValid;
    const sisaBaru = Math.max(0, num(p.total_tagihan) - p.jumlah_dibayar);
    p.status = sisaBaru <= 0 ? "Lunas" : "Dicicil";

    if (!Array.isArray(p.riwayat_bayar)) p.riwayat_bayar = [];
    p.riwayat_bayar.push({
      tanggal: new Date().toISOString(),
      nominal: nominalValid,
      metode: body.metode || "Transfer Bank",
      catatan: body.catatan || "",
    });

    syncCustomerReceivables(data);
    writeData(data);
    return NextResponse.json({ success: true, sisa: sisaBaru, record: p });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const id = Number(sp.get("id"));
    if (!id) return NextResponse.json({ error: "ID wajib diisi" }, { status: 400 });

    const data: any = readData();
    if (!Array.isArray(data.piutang_grosir)) data.piutang_grosir = [];
    const idx = data.piutang_grosir.findIndex((p: any) => Number(p.id) === id);
    if (idx === -1) return NextResponse.json({ error: "Data tidak ditemukan" }, { status: 404 });

    data.piutang_grosir.splice(idx, 1);
    syncCustomerReceivables(data);
    writeData(data);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
