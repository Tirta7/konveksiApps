import { NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";

export async function GET() {
  const data = readData();
  
  // Join dengan data tukang potong
  const pemotongan = (data.pemotongan_kain || []).map((p: any) => {
    const tp = (data.tukang_potong || []).find((t: any) => t.id === p.tukang_potong_id);
    return {
      ...p,
      tukang_potong_nama: tp ? tp.nama : "Unknown",
      tukang_potong_kode: tp ? tp.kode : "??",
    };
  }).reverse();

  return NextResponse.json(pemotongan);
}

export async function POST(req: Request) {
  const data = readData();
  if (!data.pemotongan_kain) data.pemotongan_kain = [];
  
  const body = await req.json();
  const { tanggal, nama_barang, meter_kain, pemakaian_cm, tukang_potong_id, model, total_pcs, sizeBreakdown } = body;

  if (!tanggal || !nama_barang || !tukang_potong_id || !model || !total_pcs || !sizeBreakdown) {
    return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
  }

  const finalStatus = body.status || "Selesai";

  const newId = nextId(data, "pemotongan_kain" as any);
  const newPemotongan = {
    id: newId,
    tanggal,
    nama_barang,
    meter_kain: Number(meter_kain) || 0,
    pemakaian_cm: Number(pemakaian_cm) || 0,
    tukang_potong_id: Number(tukang_potong_id),
    model,
    total_pcs: Number(total_pcs),
    sizeBreakdown, // e.g. [{ size: 'M', jumlah: 100, sisa: 100 }]
    status: finalStatus,
    selectedRolls: body.selectedRolls || [],
    createdAt: new Date().toISOString()
  };
  
  // Set initial 'sisa' available pieces for each size for PO generation
  newPemotongan.sizeBreakdown = sizeBreakdown.map((s: any) => ({
    ...s,
    sisa: Number(s.jumlah)
  }));

  // Kurangi stok kain mentah di data_kain (hanya jika bukan Draft)
  if (finalStatus !== "Draft" && data.data_kain) {
    const kainIndex = data.data_kain.findIndex((k:any) => k.nama_kain === nama_barang);
    if (kainIndex !== -1) {
      data.data_kain[kainIndex].stok_meter -= Number(meter_kain);
      if (data.data_kain[kainIndex].stok_meter < 0) data.data_kain[kainIndex].stok_meter = 0;

      // Hapus roll spesifik yang dipilih dari array rolls
      const selectedRolls = body.selectedRolls || [];
      if (selectedRolls.length > 0 && data.data_kain[kainIndex].rolls) {
        let currentRolls = [...data.data_kain[kainIndex].rolls];
        for (const sr of selectedRolls) {
          // Cari roll yang match di gudang (berdasarkan id) lalu hapus
          const rIndex = currentRolls.findIndex(r => r.id === sr.id);
          if (rIndex !== -1) {
            currentRolls.splice(rIndex, 1);
          }
        }
        data.data_kain[kainIndex].rolls = currentRolls;
      }
    }
  }

  data.pemotongan_kain.push(newPemotongan);
  writeData(data);
  return NextResponse.json({ success: true, id: newId });
}
