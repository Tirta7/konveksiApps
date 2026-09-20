import { NextResponse } from "next/server";
import { readData, writeData } from "@/lib/data-store";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const data = readData();
  if (!data.pemotongan_kain) data.pemotongan_kain = [];
  
  const { id: rawId } = await params;
  const id = Number(rawId);
  const index = data.pemotongan_kain.findIndex((p: any) => p.id === id);
  
  if (index === -1) {
    return NextResponse.json({ error: "Data tidak ditemukan" }, { status: 404 });
  }

  const existingData = data.pemotongan_kain[index];
  const body = await req.json();
  const { tanggal, nama_barang, meter_kain, pemakaian_cm, tukang_potong_id, model, total_pcs, sizeBreakdown, status } = body;

  const finalStatus = status || existingData.status || "Selesai";
  
  // Handle stock changes
  if (data.data_kain) {
    const isOldSelesai = existingData.status !== "Draft";
    const isNewSelesai = finalStatus !== "Draft";

    // Revert old stock if it was previously Selesai
    if (isOldSelesai) {
      const oldKainIndex = data.data_kain.findIndex((k:any) => k.nama_kain === existingData.nama_barang);
      if (oldKainIndex !== -1) {
        data.data_kain[oldKainIndex].stok_meter += Number(existingData.meter_kain);
        if (existingData.selectedRolls && existingData.selectedRolls.length > 0) {
          if (!data.data_kain[oldKainIndex].rolls) data.data_kain[oldKainIndex].rolls = [];
          data.data_kain[oldKainIndex].rolls.push(...existingData.selectedRolls);
        }
      }
    }

    // Deduct new stock if the new status is Selesai
    if (isNewSelesai) {
      const newKainIndex = data.data_kain.findIndex((k:any) => k.nama_kain === nama_barang);
      if (newKainIndex !== -1) {
        data.data_kain[newKainIndex].stok_meter -= Number(meter_kain);
        if (data.data_kain[newKainIndex].stok_meter < 0) data.data_kain[newKainIndex].stok_meter = 0;

        const selectedRolls = body.selectedRolls || [];
        if (selectedRolls.length > 0 && data.data_kain[newKainIndex].rolls) {
          let currentRolls = [...data.data_kain[newKainIndex].rolls];
          for (const sr of selectedRolls) {
            const rIndex = currentRolls.findIndex((r: any) => r.id === sr.id);
            if (rIndex !== -1) {
              currentRolls.splice(rIndex, 1);
            }
          }
          data.data_kain[newKainIndex].rolls = currentRolls;
        }
      }
    }
  }

  // Validate size breakdown so they don't reduce below what's already taken
  for (const s of sizeBreakdown) {
    const oldS = existingData.sizeBreakdown?.find((old: any) => old.size === s.size);
    const oldJumlah = oldS ? Number(oldS.jumlah) : 0;
    const oldSisa = oldS && oldS.sisa !== undefined ? Number(oldS.sisa) : oldJumlah;
    const distributed = oldJumlah - oldSisa;
    const newJumlah = Number(s.jumlah) || 0;
    
    if (newJumlah < distributed) {
      return NextResponse.json({ 
        error: `Size ${s.size} tidak bisa diubah menjadi ${newJumlah}, karena ${distributed} pcs sudah dialokasikan ke CMT.` 
      }, { status: 400 });
    }
  }

  const updatedPemotongan = {
    ...existingData,
    tanggal,
    target_selesai: body.target_selesai !== undefined ? body.target_selesai : (existingData.target_selesai || null),
    nama_barang,
    meter_kain: Number(meter_kain) || 0,
    pemakaian_cm: Number(pemakaian_cm) || 0,
    tukang_potong_id: Number(tukang_potong_id),
    model,
    total_pcs: Number(total_pcs),
    sizeBreakdown: sizeBreakdown.map((s: any) => {
      const oldS = existingData.sizeBreakdown?.find((old: any) => old.size === s.size);
      const oldJumlah = oldS ? Number(oldS.jumlah) : 0;
      const oldSisa = oldS && oldS.sisa !== undefined ? Number(oldS.sisa) : oldJumlah;
      const distributed = oldJumlah - oldSisa;
      const newJumlah = Number(s.jumlah) || 0;
      
      return {
        ...s,
        sisa: newJumlah - distributed
      };
    }),
    status: finalStatus,
    selectedRolls: body.selectedRolls || []
  };

  data.pemotongan_kain[index] = updatedPemotongan;
  writeData(data);
  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const data = readData();
  
  const { id: rawId } = await params;
  const id = Number(rawId);
  const index = data.pemotongan_kain?.findIndex((p: any) => p.id === id);
  
  if (index === undefined || index === -1) {
    return NextResponse.json({ error: "Data tidak ditemukan" }, { status: 404 });
  }

  const existingData = data.pemotongan_kain[index];

  // Prevent deletion if it has already been distributed to CMTs
  if (data.po_produksi) {
    const isUsed = data.po_produksi.some((po: any) => po.pemotongan_id === id);
    if (isUsed) {
      return NextResponse.json({ error: "Data pemotongan ini tidak bisa dihapus karena sebagian/seluruh potongannya sudah didistribusikan ke CMT (Sudah ada PO)." }, { status: 400 });
    }
  }

  // Restore stock if it was previously Selesai
  if (existingData.status !== "Draft" && data.data_kain) {
    const kainIndex = data.data_kain.findIndex((k:any) => k.nama_kain === existingData.nama_barang);
    if (kainIndex !== -1) {
      data.data_kain[kainIndex].stok_meter += Number(existingData.meter_kain);
      
      // Restore rolls
      if (existingData.selectedRolls && existingData.selectedRolls.length > 0) {
        if (!data.data_kain[kainIndex].rolls) data.data_kain[kainIndex].rolls = [];
        data.data_kain[kainIndex].rolls.push(...existingData.selectedRolls);
      }
    }
  }

  // Remove data
  data.pemotongan_kain.splice(index, 1);
  writeData(data);
  
  return NextResponse.json({ success: true });
}
