const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgIcon = `
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#1E3A8A" />
      <stop offset="50%" stop-color="#1E40AF" />
      <stop offset="100%" stop-color="#0F172A" />
    </linearGradient>
    <linearGradient id="goldGrad" x1="0" y1="0" x2="300" y2="300" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FDE047" />
      <stop offset="100%" stop-color="#D97706" />
    </linearGradient>
    <filter id="shadow" x="-10" y="-10" width="532" height="532" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000" flood-opacity="0.35"/>
    </filter>
  </defs>

  <!-- Background rounded rect -->
  <rect width="512" height="512" rx="112" fill="url(#bgGrad)" />

  <!-- Stitch border effect (like denim jeans stitches) -->
  <rect x="28" y="28" width="456" height="456" rx="90" fill="none" stroke="#F59E0B" stroke-width="4.5" stroke-dasharray="14 10" stroke-linecap="round" opacity="0.85" />
  <rect x="36" y="36" width="440" height="440" rx="82" fill="none" stroke="#F59E0B" stroke-width="2.5" stroke-dasharray="14 10" stroke-linecap="round" opacity="0.45" />

  <!-- Center Icon: Denim Pocket & Scissors & Needle -->
  <g filter="url(#shadow)" transform="translate(96, 86)">
    <!-- Denim Pocket Shape -->
    <path d="M 40 40 L 280 40 L 280 180 Q 280 280 160 320 Q 40 280 40 180 Z" fill="#2563EB" stroke="#60A5FA" stroke-width="6" />
    
    <!-- Pocket Arc Stitch (classic jeans arcuate) -->
    <path d="M 65 100 Q 160 170 255 100" fill="none" stroke="#FBBF24" stroke-width="5" stroke-dasharray="8 6" stroke-linecap="round" />
    <path d="M 65 120 Q 160 190 255 120" fill="none" stroke="#FBBF24" stroke-width="5" stroke-dasharray="8 6" stroke-linecap="round" />

    <!-- Copper / Brass Rivets at top corners -->
    <circle cx="58" cy="56" r="10" fill="url(#goldGrad)" stroke="#78350F" stroke-width="2" />
    <circle cx="58" cy="56" r="4" fill="#78350F" />
    <circle cx="262" cy="56" r="10" fill="url(#goldGrad)" stroke="#78350F" stroke-width="2" />
    <circle cx="262" cy="56" r="4" fill="#78350F" />

    <!-- Center Letter K or Golden Needle & Scissors Motif -->
    <!-- Stylized Golden Monogram 'K' (Konveksi) -->
    <text x="160" y="240" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="110" fill="#FFFFFF" text-anchor="middle" letter-spacing="1">K</text>
    <path d="M 160 135 L 160 155" stroke="#FDE047" stroke-width="8" stroke-linecap="round" />
  </g>

  <!-- Golden Stars badge bottom -->
  <circle cx="256" cy="435" r="6" fill="#F59E0B" />
  <circle cx="230" cy="435" r="4" fill="#F59E0B" opacity="0.6" />
  <circle cx="282" cy="435" r="4" fill="#F59E0B" opacity="0.6" />
</svg>
`;

async function run() {
  const iconBuffer = Buffer.from(svgIcon);
  const outDir = path.join(__dirname, '..', 'public', 'icons');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(path.join(outDir, 'icon.svg'), svgIcon);

  await sharp(iconBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(outDir, 'icon-512.png'));
  console.log('Created icon-512.png');

  await sharp(iconBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(outDir, 'icon-192.png'));
  console.log('Created icon-192.png');

  await sharp(iconBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(outDir, 'icon-maskable-512.png'));
  console.log('Created icon-maskable-512.png');

  await sharp(iconBuffer)
    .resize(64, 64)
    .png()
    .toFile(path.join(__dirname, '..', 'public', 'favicon.png'));
  console.log('Created favicon.png');
}

run().catch(console.error);
