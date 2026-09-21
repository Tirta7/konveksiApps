export const dynamic = "force-dynamic";
﻿import { NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";

export async function GET() {
  const data = readData();
  const pembelian = (data.purchase_orders || []).map((p: any) => {
    const sup = (data.data_supplier || []).find((s: any) => s.id === p.supplier_id);
    return {
      ...p,
      supplier_nama: sup ? sup.nama_supplier : "Unknown"
    };
  }).reverse();
  return NextResponse.json(pembelian);
}

export async function POST(req: Request) {
  const data = readData();
  if (!data.purchase_orders) data.purchase_orders = [];
  if (!data.hutang) data.hutang = [];
  if (!data.data_kain) data.data_kain = [];
  
  const body = await req.json();
  const { tanggal, supplier_id, status, metode_pembayaran, catatan, items } = body;

  if (!tanggal || !supplier_id || !items || items.length === 0) {
    return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
  }

  const newId = nextId(data, "purchase_orders" as any);
  const uid = `POK-${String(newId).padStart(4, '0')}`;
  
  let totalBelanja = 0;
  for (const item of items) {
    totalBelanja += Number(item.subtotal) || 0;
  }

  const newPO = {
    id: newId,
    uid,
    tanggal,
    supplier_id: Number(supplier_id),
    status,
    metode_pembayaran,
    catatan: catatan || "",
    items, // includes roll_details
    total: totalBelanja,
    createdAt: new Date().toISOString()
  };

  data.purchase_orders.push(newPO);

  if (status === "Diterima") {
    processStockAddition(data, items, newPO.uid);
  }

  if (metode_pembayaran === "Tempo" || metode_pembayaran === "Hutang") {
    const hutangId = nextId(data, "hutang" as any);
    data.hutang.push({
      id: hutangId,
      po_id: newPO.id,
      po_uid: newPO.uid,
      tanggal,
      supplier_id: Number(supplier_id),
      total_tagihan: totalBelanja,
      jumlah_dibayar: 0,
      status: "Belum Lunas",
      createdAt: new Date().toISOString()
    });
  }

  writeData(data);
  return NextResponse.json({ success: true, id: newId });
}

export async function PUT(req: Request) {
  const data = readData();
  const body = await req.json();
  const { id, status } = body;

  const idx = data.purchase_orders.findIndex((p:any) => p.id === id);
  if (idx === -1) return NextResponse.json({ error: "PO tidak ditemukan" }, { status: 404 });

  const po = data.purchase_orders[idx];

  // If status changed to Diterima (and wasn't before)
  if (po.status !== "Diterima" && status === "Diterima") {
    processStockAddition(data, po.items, po.uid);
  } 
  // If status changed from Diterima to something else (Undo receiving)
  else if (po.status === "Diterima" && status !== "Diterima") {
    processStockReduction(data, po.items, po.uid);
  }

  po.status = status;
  writeData(data);
  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  const data = readData();
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));

  const idx = data.purchase_orders.findIndex((p:any) => p.id === id);
  if (idx === -1) return NextResponse.json({ error: "PO tidak ditemukan" }, { status: 404 });

  const po = data.purchase_orders[idx];

  // Rollback stock if it was already Diterima
  if (po.status === "Diterima") {
    processStockReduction(data, po.items, po.uid);
  }

  // Hapus tagihan hutang jika ada
  if (data.hutang) {
    data.hutang = data.hutang.filter((h:any) => h.po_id !== po.id);
  }

  data.purchase_orders.splice(idx, 1);
  writeData(data);
  return NextResponse.json({ success: true });
}


// --- Helper Functions for Stock ---

function processStockAddition(data: any, items: any[], poUid: string) {
  if (!data.data_kain) data.data_kain = [];
  
  for (const item of items) {
    let kainIndex = data.data_kain.findIndex((k:any) => k.nama_kain === item.nama_kain && k.warna === item.warna);
    
    // Convert roll_details strings to objects with po_uid attached and a unique ID
    const newRollObjects = (item.roll_details || []).map((meter: string) => ({
      id: `R-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      meter: Number(meter),
      po_uid: poUid,
      date_added: new Date().toISOString()
    }));

    if (kainIndex !== -1) {
      const kain = data.data_kain[kainIndex];
      const oldStok = kain.stok_meter || 0;
      const oldHarga = kain.harga_beli || 0;
      const newStok = oldStok + Number(item.meter);
      const avgHarga = newStok > 0 ? ((oldStok * oldHarga) + (Number(item.meter) * Number(item.harga_meter))) / newStok : 0;
      
      kain.stok_meter = newStok;
      kain.harga_beli = avgHarga;
      kain.rolls = [...(kain.rolls || []), ...newRollObjects];
      
    } else {
      const newKainId = nextId(data, "data_kain" as any);
      data.data_kain.push({
        id: newKainId,
        nama_kain: item.nama_kain,
        warna: item.warna || "",
        stok_meter: Number(item.meter) || 0,
        harga_beli: Number(item.harga_meter) || 0,
        rolls: newRollObjects
      });
    }
  }
}

function processStockReduction(data: any, items: any[], poUid: string) {
  if (!data.data_kain) return;
  for (const item of items) {
    let kainIndex = data.data_kain.findIndex((k:any) => k.nama_kain === item.nama_kain && k.warna === item.warna);
    if (kainIndex !== -1) {
      const kain = data.data_kain[kainIndex];
      
      // Reduce meter
      kain.stok_meter -= Number(item.meter);
      if (kain.stok_meter < 0) kain.stok_meter = 0;
      
      // Remove rolls that match the PO UID
      if (kain.rolls) {
        kain.rolls = kain.rolls.filter((r:any) => r.po_uid !== poUid);
      }
    }
  }
}
