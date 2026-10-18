/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "api.qrserver.com" },
    ],
  },
  // Izinkan akses dev server dari semua perangkat di jaringan LAN (HP, tablet, dll).
  // Tanpa ini, Next.js memblokir file JS sehingga halaman tidak ter-hydrate
  // dan berhenti di "Memuat Dashboard...".
  allowedDevOrigins: ['localhost', '192.168.18.144', '192.168.*.*', '10.*.*.*'],
};

module.exports = nextConfig;
