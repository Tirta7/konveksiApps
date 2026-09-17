/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "api.qrserver.com" },
    ],
  },
  allowedDevOrigins: ['192.168.1.36', 'localhost', '192.168.1.19'],
};

module.exports = nextConfig;
