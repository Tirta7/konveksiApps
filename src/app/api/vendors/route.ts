import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";

export async function GET() {
  try {
    const data = readData();
    let needsSave = false;
    
    // Migrasi data lama jika tidak ada kodeVendor
    const vendors = data.vendors.map((v: any) => {
      if (!v.kodeVendor) {
        v.kodeVendor = `VND-${v.nama.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()}`;
        needsSave = true;
      }
      return v;
    });
    
    if (needsSave) {
      writeData(data);
    }
    
    return NextResponse.json(vendors || []);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = readData();
    const body = await req.json();
    const newId = nextId(data, "vendors");
    
    // Generate kode berdasarkan nama
    const rawKode = `VND-${body.nama.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()}`;
    let kodeVendor = rawKode;
    let count = 1;
    while (data.vendors.some((v: any) => v.kodeVendor === kodeVendor)) {
      kodeVendor = `${rawKode}-${count}`;
      count++;
    }

    const newVendor = {
      id: newId,
      nama: body.nama,
      kodeVendor: kodeVendor,
      jenis_default: body.jenis_default || "",
      kontak: body.kontak || "",
      wajib_hitung_ulang: body.wajib_hitung_ulang || false,
      hargaPerPcs: body.hargaPerPcs || 0,
      tarifPotongan: body.tarifPotongan || {},
      aktif: true,
      tipe: body.tipe || "cmt"
    };

    data.vendors.push(newVendor);
    writeData(data);
    return NextResponse.json(newVendor);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const data = readData();
    const body = await req.json();
    const { id, ...updates } = body;
    
    const idx = data.vendors.findIndex((v: any) => v.id === id);
    if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (updates.nama) {
      // Regenerate kode if name changes
      const rawKode = `VND-${updates.nama.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()}`;
      let kodeVendor = rawKode;
      let count = 1;
      while (data.vendors.some((v: any) => v.kodeVendor === kodeVendor && v.id !== id)) {
        kodeVendor = `${rawKode}-${count}`;
        count++;
      }
      updates.kodeVendor = kodeVendor;
    }

    data.vendors[idx] = { ...data.vendors[idx], ...updates };
    writeData(data);
    return NextResponse.json(data.vendors[idx]);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
