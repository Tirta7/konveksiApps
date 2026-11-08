export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { readData, writeData } from "@/lib/data-store";
import { computeAllVendorsSalarySummary } from "@/lib/vendor-salary";

export async function GET(req: NextRequest) {
  const data = readData();
  const { searchParams } = new URL(req.url);
  const includeUpah = searchParams.get("includeUpah") === "true";

  // Join dengan data supplier
  const hutangSupplier = (data.hutang || []).map((h: any) => {
    const sup = (data.data_supplier || []).find((s: any) => s.id === h.supplier_id);
    const total = Number(h.total_tagihan || 0);
    const dibayar = Number(h.jumlah_dibayar || 0);
    return {
      ...h,
      supplier_nama: sup ? sup.nama_supplier : "Unknown",
      sisa: Math.max(0, total - dibayar),
    };
  }).reverse();

  if (!includeUpah) {
    return NextResponse.json(hutangSupplier);
  }

  const vendorSummaries = computeAllVendorsSalarySummary(data);
  const hutangUpah = vendorSummaries
    .filter((s: any) => s.totalHakGaji > 0 || s.totalSudahDibayar > 0)
    .map((s: any) => ({
      vendorId: s.vendorId,
      kodeVendor: s.kodeVendor,
      namaVendor: s.vendorNama,
      tipeVendor: s.tipe,
      totalPcsSelesai: s.totalPcsSelesai,
      totalTagihan: s.totalHakGaji,
      jumlahDibayar: s.totalSudahDibayar,
      sisaHutang: s.sisaHakGaji,
      status: s.statusPembayaran,
      rincianGajiPerPo: s.rincianGajiPerPo,
      officialSlips: s.officialSlips,
    }));

  const sisaSupplier = hutangSupplier.reduce((sum: number, h: any) => sum + Number(h.sisa || 0), 0);
  const sisaUpah = hutangUpah.reduce((sum: number, u: any) => sum + Number(u.sisaHutang || 0), 0);
  const dibayarSupplier = hutangSupplier.reduce((sum: number, h: any) => sum + Number(h.jumlah_dibayar || 0), 0);
  const dibayarUpah = hutangUpah.reduce((sum: number, u: any) => sum + Number(u.jumlahDibayar || 0), 0);

  return NextResponse.json({
    hutangSupplier,
    hutangUpah,
    ringkasan: {
      sisaSupplier,
      sisaUpah,
      totalSisaHutang: sisaSupplier + sisaUpah,
      dibayarSupplier,
      dibayarUpah,
      totalSudahDibayar: dibayarSupplier + dibayarUpah,
    },
  });
}

export async function PUT(req: Request) {
  const body = await req.json();
  const data = readData();
  const { id, bayar_amount } = body;

  if (!id || !bayar_amount) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const index = data.hutang.findIndex((h: any) => h.id === id);
  if (index === -1) return NextResponse.json({ error: "Hutang tidak ditemukan" }, { status: 404 });

  const h = data.hutang[index];
  h.jumlah_dibayar += Number(bayar_amount);

  if (h.jumlah_dibayar >= h.total_tagihan) {
    h.status = "Lunas";
    h.jumlah_dibayar = h.total_tagihan; // cap at total
  } else {
    h.status = "Belum Lunas";
  }

  writeData(data);
  return NextResponse.json({ success: true, sisa: h.total_tagihan - h.jumlah_dibayar });
}
