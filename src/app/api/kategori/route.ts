export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";

export async function GET() {
  const data = readData();
  const kategoriList = Array.isArray(data.kategori_produk) ? data.kategori_produk : [];
  const dataBarang = Array.isArray(data.data_barang) ? data.data_barang : [];
  const pemotongan = Array.isArray(data.pemotongan_kain) ? data.pemotongan_kain : [];
  const vendors = Array.isArray(data.vendors) ? data.vendors : [];

  const enriched = kategoriList.map((kat: any) => {
    // Count barang using this category
    const linkedBarang = dataBarang.filter((b: any) => String(b.kategori_id) === String(kat.id) || b.kategori_nama === kat.nama);
    
    // Count pemotongan using this model/pola
    const linkedPotong = pemotongan.filter((p: any) => 
      (p.model || "").toUpperCase().trim() === (kat.nama || "").toUpperCase().trim() ||
      String(p.kategori_id) === String(kat.id)
    );
    const totalPcs = linkedPotong.reduce((sum: number, p: any) => sum + (Number(p.total_pcs) || 0), 0);

    // Find vendor tariffs for this category
    const vendorTarifs: any[] = [];
    vendors.forEach((v: any) => {
      if (v.tarifPotongan && typeof v.tarifPotongan === "object") {
        const key = Object.keys(v.tarifPotongan).find(k => k.toUpperCase().trim() === (kat.nama || "").toUpperCase().trim());
        if (key && v.tarifPotongan[key]) {
          vendorTarifs.push({
            vendor_id: v.id,
            vendor_nama: v.nama,
            tipe: v.tipe,
            tarif: Number(v.tarifPotongan[key])
          });
        }
      }
    });

    const avgTarif = vendorTarifs.length > 0 
      ? Math.round(vendorTarifs.reduce((s, vt) => s + vt.tarif, 0) / vendorTarifs.length)
      : 0;

    return {
      ...kat,
      total_barang: linkedBarang.length,
      total_pemotongan: linkedPotong.length,
      total_pcs_potong: totalPcs,
      vendor_tarifs: vendorTarifs,
      avg_tarif_cmt: avgTarif
    };
  });

  return NextResponse.json(enriched.slice().reverse());
}

export async function POST(req: NextRequest) {
  const data = readData();
  const { nama, deskripsi } = await req.json();
  if (!nama || !nama.trim()) {
    return NextResponse.json({ error: "Nama kategori wajib diisi" }, { status: 400 });
  }

  const id = nextId(data, "kategori_produk");
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  const newKategori = { 
    id, 
    uid: `KTG-${randomStr}`, 
    nama: nama.trim().toUpperCase(), 
    deskripsi: (deskripsi || "").trim(), 
    createdAt: new Date().toISOString() 
  };
  
  if (!Array.isArray(data.kategori_produk)) {
    data.kategori_produk = [];
  }
  data.kategori_produk.push(newKategori);
  writeData(data);
  return NextResponse.json(newKategori);
}

export async function PUT(req: NextRequest) {
  const data = readData();
  const { id, nama, deskripsi } = await req.json();
  if (!id) return NextResponse.json({ error: "ID dibutuhkan" }, { status: 400 });
  
  const idx = data.kategori_produk.findIndex((k: any) => k.id === Number(id));
  if (idx === -1) return NextResponse.json({ error: "Kategori tidak ditemukan" }, { status: 404 });
  
  const oldNama = data.kategori_produk[idx].nama;
  const updatedNama = nama ? nama.trim().toUpperCase() : oldNama;
  
  data.kategori_produk[idx] = { 
    ...data.kategori_produk[idx], 
    nama: updatedNama, 
    deskripsi: deskripsi !== undefined ? deskripsi.trim() : data.kategori_produk[idx].deskripsi 
  };

  // If name changed, optionally update vendor tarifPotongan keys
  if (oldNama && updatedNama && oldNama !== updatedNama && Array.isArray(data.vendors)) {
    data.vendors.forEach((v: any) => {
      if (v.tarifPotongan && v.tarifPotongan[oldNama]) {
        v.tarifPotongan[updatedNama] = v.tarifPotongan[oldNama];
        delete v.tarifPotongan[oldNama];
      }
    });
  }

  writeData(data);
  return NextResponse.json(data.kategori_produk[idx]);
}

export async function DELETE(req: NextRequest) {
  const data = readData();
  let id: number | null = null;

  // Try URL search param first
  const searchId = req.nextUrl.searchParams.get("id");
  if (searchId) {
    id = Number(searchId);
  } else {
    try {
      const body = await req.json();
      if (body?.id) id = Number(body.id);
    } catch {
      // Body not provided or empty
    }
  }

  if (!id) {
    return NextResponse.json({ error: "ID kategori wajib disertakan" }, { status: 400 });
  }

  const target = data.kategori_produk.find((k: any) => k.id === id);
  if (!target) {
    return NextResponse.json({ error: "Kategori tidak ditemukan" }, { status: 404 });
  }

  // Check if used in data_barang
  const isUsedInBarang = (data.data_barang || []).some((b: any) => String(b.kategori_id) === String(id));
  if (isUsedInBarang) {
    return NextResponse.json({ error: "Tidak dapat menghapus: Kategori ini sedang digunakan oleh data barang jadi." }, { status: 400 });
  }

  data.kategori_produk = data.kategori_produk.filter((k: any) => k.id !== id);
  writeData(data);
  return NextResponse.json({ success: true, message: "Kategori berhasil dihapus" });
}
