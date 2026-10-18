import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "sonner";

import { readData } from "@/lib/data-store";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#1E3A8A",
};

export async function generateMetadata(): Promise<Metadata> {
  try {
    const data = readData();
    const s = data.pengaturan_sistem;
    const title = s?.nama_usaha 
      ? (s.tagline ? `${s.nama_usaha} — ${s.tagline}` : s.nama_usaha)
      : "KonveksiApps — Sistem Tracking Produksi Jeans";
    const description = s?.tagline || "Sistem tracking produksi dan penjualan konveksi jeans secara real-time";
    const logoUrl = s?.logo_url || "/icons/icon-192.png";

    return {
      title,
      description,
      manifest: "/manifest.webmanifest",
      icons: {
        icon: logoUrl,
        shortcut: logoUrl,
        apple: "/icons/icon-192.png",
      },
      appleWebApp: {
        capable: true,
        statusBarStyle: "black-translucent",
        title: s?.nama_usaha ? s.nama_usaha.split("|")[0].trim() : "KonveksiApps",
      },
    };
  } catch {
    return {
      title: "KonveksiApps — Sistem Tracking Produksi Jeans",
      description: "Sistem tracking produksi dan penjualan konveksi jeans secara real-time",
      manifest: "/manifest.webmanifest",
      icons: {
        icon: "/icons/icon-192.png",
        apple: "/icons/icon-192.png",
      },
    };
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#FFFFFF" />
        <link rel="stylesheet" href="https://cdn-uicons.flaticon.com/2.6.0/uicons-regular-rounded/css/uicons-regular-rounded.css" />
        <link rel="stylesheet" href="https://cdn-uicons.flaticon.com/2.6.0/uicons-solid-rounded/css/uicons-solid-rounded.css" />
        <link rel="stylesheet" href="https://cdn-uicons.flaticon.com/2.6.0/uicons-bold-rounded/css/uicons-bold-rounded.css" />
      </head>
      <body>
        {children}
        <Toaster position="top-right" richColors />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Prevent iOS Safari rubber-band overscroll when at top boundary
              (function() {
                var startY = 0;
                window.addEventListener('touchstart', function(e) {
                  if (e.touches && e.touches.length === 1) {
                    startY = e.touches[0].clientY;
                  }
                }, { passive: true });

                window.addEventListener('touchmove', function(e) {
                  if (!e.touches || e.touches.length !== 1) return;
                  var currentY = e.touches[0].clientY;
                  var deltaY = currentY - startY;

                  // Check if touch target is within an active inner scrollable element
                  var target = e.target;
                  var hasScrollableParent = false;
                  while (target && target !== document.body && target !== document.documentElement) {
                    if (target.scrollHeight > target.clientHeight && (target.scrollTop > 0 || (deltaY < 0 && target.scrollTop + target.clientHeight < target.scrollHeight))) {
                      hasScrollableParent = true;
                      break;
                    }
                    target = target.parentElement;
                  }
                  if (hasScrollableParent) return;

                  var scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
                  // If already at top and pulling DOWN, cancel bounce firmly
                  if (scrollTop <= 0 && deltaY > 0) {
                    if (e.cancelable) {
                      e.preventDefault();
                    }
                  }
                }, { passive: false });
              })();

              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(
                    function(registration) {
                      console.log('[PWA] ServiceWorker registered with scope:', registration.scope);
                    },
                    function(err) {
                      console.log('[PWA] ServiceWorker registration failed:', err);
                    }
                  );
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
