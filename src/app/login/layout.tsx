import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Masuk — KonveksiApps",
  description: "Login aplikasi tracking produksi & penjualan jeans.",
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
