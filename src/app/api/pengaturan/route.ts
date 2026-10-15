import { NextResponse } from "next/server";
import { readData, writeData } from "@/lib/data-store";
import { broadcast } from "@/lib/sse";

export const dynamic = "force-dynamic";

const defaultSettings = {
  nama_usaha: "KONVEKSI APPS | JEANS PRODUCTION",
  tagline: "Sistem Tracking Produksi Jeans",
  alamat: "Jl. Industri Konveksi No. 88",
  telepon: "(022) 555-8899",
  email: "info@konveksiapps.com",
  divisi: "Divisi Cutting & Bahan",
  logo_url: "/icons/icon-192.png",
  catatan_surat_jalan: "Barang/kain & bahan pendukung di atas telah diperiksa dan diserahkan dalam kondisi lengkap dan tepat jumlah.",
  jabatan_penyerah: "Bagian Gudang & Bahan",
  jabatan_penerima: "Tukang Potong / Cutting",
  jabatan_penyetuju: "Admin Produksi / Supervisor"
};

export async function GET() {
  const data = readData();
  const settings = {
    ...defaultSettings,
    ...(data.pengaturan_sistem || {})
  };
  return NextResponse.json(settings);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = readData();

    const updated = {
      ...defaultSettings,
      ...(data.pengaturan_sistem || {}),
      nama_usaha: body.nama_usaha?.trim() || defaultSettings.nama_usaha,
      tagline: body.tagline?.trim() || "",
      alamat: body.alamat?.trim() || "",
      telepon: body.telepon?.trim() || "",
      email: body.email?.trim() || "",
      divisi: body.divisi?.trim() || defaultSettings.divisi,
      logo_url: body.logo_url !== undefined ? body.logo_url : (data.pengaturan_sistem?.logo_url || defaultSettings.logo_url),
      catatan_surat_jalan: body.catatan_surat_jalan?.trim() || defaultSettings.catatan_surat_jalan,
      jabatan_penyerah: body.jabatan_penyerah?.trim() || defaultSettings.jabatan_penyerah,
      jabatan_penerima: body.jabatan_penerima?.trim() || defaultSettings.jabatan_penerima,
      jabatan_penyetuju: body.jabatan_penyetuju?.trim() || defaultSettings.jabatan_penyetuju,
      updated_at: new Date().toISOString()
    };

    data.pengaturan_sistem = updated;
    writeData(data);
    broadcast("pengaturan:updated", updated);

    return NextResponse.json({ success: true, settings: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Gagal menyimpan pengaturan" }, { status: 500 });
  }
}
