import { NextResponse } from "next/server";
import { readData, writeData } from "@/lib/data-store";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const body = await req.json();
  const data = readData();
  if (!data.pemotongan_kain) data.pemotongan_kain = [];
  
  const { id: rawId } = await params;
  const id = Number(rawId);
  const index = data.pemotongan_kain.findIndex((p: any) => p.id === id);
  
  if (index === -1) {
    return NextResponse.json({ error: "Data tidak ditemukan" }, { status: 404 });
  }

  const existingData = data.pemotongan_kain[index];
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

  // Handle stock changes for item pendukung
  if (data.item_pendukung) {
    const isOldSelesai = existingData.status !== "Draft";
    const isNewSelesai = finalStatus !== "Draft";

    // Revert old item pendukung stock if previously Selesai
    if (isOldSelesai && Array.isArray(existingData.item_pendukung_used)) {
      for (const oldItem of existingData.item_pendukung_used) {
        const itIdx = data.item_pendukung.findIndex((ip: any) => ip.id === Number(oldItem.item_id));
        if (itIdx !== -1) {
          data.item_pendukung[itIdx].stok = (Number(data.item_pendukung[itIdx].stok) || 0) + (Number(oldItem.qty) || 0);
        }
      }
    }

    // Deduct new item pendukung stock if new status is Selesai
    if (isNewSelesai && Array.isArray(body.item_pendukung_used)) {
      for (const newItem of body.item_pendukung_used) {
        const itIdx = data.item_pendukung.findIndex((ip: any) => ip.id === Number(newItem.item_id));
        if (itIdx !== -1) {
          data.item_pendukung[itIdx].stok = Math.max(0, (Number(data.item_pendukung[itIdx].stok) || 0) - (Number(newItem.qty) || 0));
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
    jenis_jahitan: body.jenis_jahitan !== undefined ? body.jenis_jahitan : (existingData.jenis_jahitan || ""),
    tipe_benang: body.tipe_benang !== undefined ? body.tipe_benang : (existingData.tipe_benang || ""),
    tipe_resleting: body.tipe_resleting !== undefined ? body.tipe_resleting : (existingData.tipe_resleting || ""),
    catatan_jahitan: body.catatan_jahitan !== undefined ? body.catatan_jahitan : (existingData.catatan_jahitan || ""),
    item_pendukung_used: body.item_pendukung_used !== undefined ? body.item_pendukung_used : (existingData.item_pendukung_used || []),
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
    selectedRolls: body.selectedRolls || [],
    isi_per_bundle: body.isi_per_bundle !== undefined ? Number(body.isi_per_bundle) : (existingData.isi_per_bundle || 20)
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
  if (existingData.status !== "Draft") {
    // Restore kain
    if (data.data_kain) {
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

    // Restore item pendukung stock
    if (data.item_pendukung && Array.isArray(existingData.item_pendukung_used)) {
      for (const itemUsed of existingData.item_pendukung_used) {
        const itIdx = data.item_pendukung.findIndex((ip: any) => ip.id === Number(itemUsed.item_id));
        if (itIdx !== -1) {
          data.item_pendukung[itIdx].stok = (Number(data.item_pendukung[itIdx].stok) || 0) + (Number(itemUsed.qty) || 0);
        }
      }
    }
  }

  // Remove data
  data.pemotongan_kain.splice(index, 1);
  writeData(data);
  
  return NextResponse.json({ success: true });
}
