export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";

// Data awal jika belum ada item pendukung
const DEFAULT_ITEMS = [
  {
    nama: "Benang Astra Jeans 20/2",
    kategori: "Benang",
    tipe: "20/2 Tebal",
    warna: "Gold Jeans (Kuning Emas)",
    satuan: "Cones",
    stok: 35,
    harga_beli: 28000,
    catatan: "Benang jahit utama untuk keliling & variasi jeans"
  },
  {
    nama: "Benang Astra Jeans 20/3",
    kategori: "Benang",
    tipe: "20/3 Ekstra Kuat",
    warna: "Navy / Indigo",
    satuan: "Cones",
    stok: 24,
    harga_beli: 31000,
    catatan: "Benang make-up & obras 3 benang"
  },
  {
    nama: "Resleting YKK Metal Brass No. 5",
    kategori: "Resleting",
    tipe: "Gigi Kuningan 5\"",
    warna: "Bakar / Antik",
    satuan: "Pcs",
    stok: 1200,
    harga_beli: 3500,
    catatan: "Resleting jeans standar pria / wanita"
  },
  {
    nama: "Resleting YKK Nylon Coil No. 4",
    kategori: "Resleting",
    tipe: "Coil Gigi Halus 6\"",
    warna: "Hitam",
    satuan: "Pcs",
    stok: 850,
    harga_beli: 2200,
    catatan: "Untuk saku dalam / chino pants"
  },
  {
    nama: "Kancing Logam Jeans 17mm",
    kategori: "Kancing",
    tipe: "Donut Button Laurel Leaf",
    warna: "Antique Brass",
    satuan: "Pcs",
    stok: 3000,
    harga_beli: 650,
    catatan: "Kancing pinggang utama celana jeans"
  },
  {
    nama: "Rivet Saku Tembaga 9mm",
    kategori: "Rivet",
    tipe: "Nipple Rivet",
    warna: "Copper / Tembaga",
    satuan: "Pcs",
    stok: 5000,
    harga_beli: 250,
    catatan: "Rivet sudut kantong depan & coin pocket"
  }
];

export async function GET() {
  const data = readData();
  if (!data.item_pendukung || data.item_pendukung.length === 0) {
    if (!data.item_pendukung) data.item_pendukung = [];
    // Seed default items
    for (const def of DEFAULT_ITEMS) {
      const newId = nextId(data, "item_pendukung" as any);
      data.item_pendukung.push({
        id: newId,
        ...def,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    writeData(data);
  }

  // Join supplier nama if supplier_id present
  const items = (data.item_pendukung || []).map((it: any) => {
    const sup = (data.data_supplier || []).find((s: any) => s.id === it.supplier_id);
    return {
      ...it,
      supplier_nama: sup ? sup.nama_supplier : (it.supplier_nama || "-")
    };
  });

  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const data = readData();
  if (!data.item_pendukung) data.item_pendukung = [];

  const body = await req.json();
  const { id, nama, kategori, tipe, warna, satuan, stok, harga_beli, supplier_id, catatan } = body;

  if (!nama || !kategori) {
    return NextResponse.json({ error: "Nama item dan Kategori wajib diisi" }, { status: 400 });
  }

  if (id) {
    // Edit existing
    const idx = data.item_pendukung.findIndex((i: any) => i.id === Number(id));
    if (idx === -1) return NextResponse.json({ error: "Item tidak ditemukan" }, { status: 404 });

    data.item_pendukung[idx] = {
      ...data.item_pendukung[idx],
      nama,
      kategori,
      tipe: tipe || "",
      warna: warna || "",
      satuan: satuan || "Pcs",
      stok: Number(stok) !== undefined && !isNaN(Number(stok)) ? Number(stok) : data.item_pendukung[idx].stok,
      harga_beli: Number(harga_beli) || 0,
      supplier_id: supplier_id ? Number(supplier_id) : null,
      catatan: catatan || "",
      updatedAt: new Date().toISOString()
    };
  } else {
    // Tambah baru
    const newId = nextId(data, "item_pendukung" as any);
    data.item_pendukung.push({
      id: newId,
      nama,
      kategori,
      tipe: tipe || "",
      warna: warna || "",
      satuan: satuan || "Pcs",
      stok: Number(stok) || 0,
      harga_beli: Number(harga_beli) || 0,
      supplier_id: supplier_id ? Number(supplier_id) : null,
      catatan: catatan || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  writeData(data);
  return NextResponse.json({ success: true });
}

// Quick Restock / Penambahan Pembelian Stok Langsung
export async function PATCH(req: Request) {
  const data = readData();
  if (!data.item_pendukung) data.item_pendukung = [];

  const body = await req.json();
  const { id, tambah_stok, harga_beli_baru, catatan } = body;

  const idx = data.item_pendukung.findIndex((i: any) => i.id === Number(id));
  if (idx === -1) return NextResponse.json({ error: "Item tidak ditemukan" }, { status: 404 });

  const item = data.item_pendukung[idx];
  const qty = Number(tambah_stok) || 0;
  if (qty <= 0) return NextResponse.json({ error: "Jumlah tambah stok harus lebih dari 0" }, { status: 400 });

  const oldStok = Number(item.stok) || 0;
  const oldHarga = Number(item.harga_beli) || 0;
  const newStok = oldStok + qty;

  // Hitung rata-rata harga jika diisi
  if (harga_beli_baru && Number(harga_beli_baru) > 0) {
    const newHarga = Number(harga_beli_baru);
    const avg = newStok > 0 ? ((oldStok * oldHarga) + (qty * newHarga)) / newStok : newHarga;
    item.harga_beli = Math.round(avg);
  }

  item.stok = newStok;
  item.updatedAt = new Date().toISOString();

  // Catat riwayat pembelian jika ada supplier
  if (body.supplier_id) {
    item.supplier_id = Number(body.supplier_id);
  }

  writeData(data);
  return NextResponse.json({ success: true, item });
}

export async function DELETE(req: Request) {
  const data = readData();
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));

  if (!id) return NextResponse.json({ error: "ID dibutuhkan" }, { status: 400 });

  if (data.item_pendukung) {
    data.item_pendukung = data.item_pendukung.filter((i: any) => i.id !== id);
    writeData(data);
  }
  return NextResponse.json({ success: true });
}
