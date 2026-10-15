export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";
import { broadcast } from "@/lib/sse";

// Default starter customers for Tirta Bintang Jeans if empty
const DEFAULT_PELANGGAN = [
  {
    id: 1,
    uid: "CUST-001",
    nama: "Toko Bintang Busana (Tanah Abang)",
    tipe: "Grosir / Toko Pasar",
    kontak: "081288992211",
    alamat: "Pasar Tanah Abang Blok A Lt. 1 No. 45, Jakarta Pusat",
    kota: "Jakarta",
    ekspedisi: "Baraka / MPS Express",
    total_order: 14,
    total_pembelian: 185000000,
    piutang: 0,
    catatan: "Langganan jeans pria slim fit & cutbray. Termin tempo 14 hari."
  },
  {
    id: 2,
    uid: "CUST-002",
    nama: "Distro Indigo Denim Lab",
    tipe: "Distro / Brand Clothing",
    kontak: "087755443322",
    alamat: "Jl. Trunojoyo No. 24, Bandung",
    kota: "Bandung",
    ekspedisi: "J&T Cargo / Indah Logistik",
    total_order: 8,
    total_pembelian: 96000000,
    piutang: 12500000,
    catatan: "Spesialis raw denim 14oz & selvedge accent. Kualitas QC Grade A."
  },
  {
    id: 3,
    uid: "CUST-003",
    nama: "Kurnia Jeans Grosir Surabaya",
    tipe: "Grosir / Toko Pasar",
    kontak: "081399887766",
    alamat: "Pusat Grosir Surabaya (PGS) Lt. 2 Blok B No. 10",
    kota: "Surabaya",
    ekspedisi: "Karyati / Dakota",
    total_order: 19,
    total_pembelian: 240000000,
    piutang: 0,
    catatan: "Order rutin 50 lusin per bulan model standard denim & cargo jeans."
  }
];

export async function GET() {
  try {
    const data = readData();
    if (!data.data_pelanggan || data.data_pelanggan.length === 0) {
      data.data_pelanggan = DEFAULT_PELANGGAN;
      writeData(data);
    }
    return NextResponse.json(data.data_pelanggan || []);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const data = readData();
    if (!data.data_pelanggan) data.data_pelanggan = [];

    const body = await req.json();
    const { id, nama, tipe, kontak, alamat, kota, ekspedisi, piutang, catatan } = body;

    if (!nama || !nama.trim()) {
      return NextResponse.json({ error: "Nama pelanggan / toko wajib diisi." }, { status: 400 });
    }

    if (id) {
      // Edit
      const index = data.data_pelanggan.findIndex((p: any) => p.id === id);
      if (index === -1) return NextResponse.json({ error: "Pelanggan tidak ditemukan." }, { status: 404 });

      data.data_pelanggan[index] = {
        ...data.data_pelanggan[index],
        nama: nama.trim(),
        tipe: tipe || "Grosir / Toko Pasar",
        kontak: (kontak || "").trim(),
        alamat: (alamat || "").trim(),
        kota: (kota || "").trim(),
        ekspedisi: (ekspedisi || "").trim(),
        piutang: Number(piutang || 0),
        catatan: (catatan || "").trim()
      };
    } else {
      // Create
      const newId = nextId(data, "data_pelanggan" as any);
      const uid = `CUST-${String(newId).padStart(3, "0")}`;

      data.data_pelanggan.unshift({
        id: newId,
        uid,
        nama: nama.trim(),
        tipe: tipe || "Grosir / Toko Pasar",
        kontak: (kontak || "").trim(),
        alamat: (alamat || "").trim(),
        kota: (kota || "").trim(),
        ekspedisi: (ekspedisi || "").trim(),
        total_order: 0,
        total_pembelian: 0,
        piutang: Number(piutang || 0),
        catatan: (catatan || "").trim(),
        createdAt: new Date().toISOString()
      });
    }

    writeData(data);
    try { broadcast("pelanggan:updated", data.data_pelanggan); } catch {}

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const data = readData();
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));

    if (!id) return NextResponse.json({ error: "ID pelanggan dibutuhkan." }, { status: 400 });

    if (data.data_pelanggan) {
      data.data_pelanggan = data.data_pelanggan.filter((p: any) => p.id !== id);
      writeData(data);
      try { broadcast("pelanggan:updated", data.data_pelanggan); } catch {}
    }
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
