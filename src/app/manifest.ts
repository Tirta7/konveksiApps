import { MetadataRoute } from "next";
import { readData } from "@/lib/data-store";

export default function manifest(): MetadataRoute.Manifest {
  let name = "KonveksiApps — Sistem Tracking Produksi Jeans";
  let short_name = "KonveksiApps";
  try {
    const data = readData();
    const s = data.pengaturan_sistem;
    if (s?.nama_usaha) {
      name = s.tagline ? `${s.nama_usaha} — ${s.tagline}` : s.nama_usaha;
      short_name = s.nama_usaha.split("|")[0].trim() || s.nama_usaha;
    }
  } catch {}

  return {
    name,
    short_name,
    description: "Sistem ERP Tracking Produksi Jeans & Konveksi",
    start_url: "/",
    id: "/",
    display: "standalone",
    background_color: "#0F172A",
    theme_color: "#1E3A8A",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
