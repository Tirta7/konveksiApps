/**
 * VOC ML - Middleware Pengunci Lisensi & Machine ID
 * 
 * Melindungi aplikasi Konveksi Apps berbasis Machine ID hardware klien.
 * Jika lisensi belum diaktivasi dari dashboard VOC ML pusat, rute diblokir
 * dengan HTTP 403 dan Layar Merah (Red Lock Screen).
 */
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { checkLicense } from '../client-sdk/vocml-client.js';

const DATA_DIR = process.env.DATA_DIR || process.cwd();

// Fungsi membaca Machine ID asli dari hardware komputer (Mac / Windows / Linux)
function getHardwareMachineId() {
  if (process.env.VOCML_MACHINE_ID && process.env.VOCML_MACHINE_ID.trim()) {
    return process.env.VOCML_MACHINE_ID.trim();
  }
  try {
    if (process.platform === 'darwin') {
      const uuid = execSync("ioreg -d2 -c IOPlatformExpertDevice | awk -F\\\" '/IOPlatformUUID/{print $(NF-1)}'", { encoding: 'utf8' }).trim();
      if (uuid) {
        const hex = crypto.createHash("sha256").update(uuid.toUpperCase()).digest("hex").toUpperCase();
        return `MID-${hex.substring(0, 4)}-${hex.substring(4, 8)}-${hex.substring(8, 12)}`;
      }
    } else if (process.platform === 'win32') {
      const uuid = execSync("powershell -NoProfile -Command \"(Get-CimInstance Win32_ComputerSystemProduct).UUID\"", { encoding: 'utf8' }).trim();
      if (uuid) {
        const hex = crypto.createHash("sha256").update(uuid.toUpperCase()).digest("hex").toUpperCase();
        return `MID-${hex.substring(0, 4)}-${hex.substring(4, 8)}-${hex.substring(8, 12)}`;
      }
    }
  } catch (e) {}
  return 'MID-2201-35AE-22B8';
}

const activeMachineId = getHardwareMachineId();

// Konfigurasi Lisensi VOC ML
export const VOCML_CONFIG = {
  serverUrl: process.env.VOCML_SERVER_URL || 'https://vocml.vocpos.id',
  product: process.env.VOCML_PRODUCT || 'pos',
  storeName: process.env.STORE_NAME || 'Laptop Developer (Tirta)',
  machineId: activeMachineId,
  publicKeyPem: process.env.VOCML_PUBLIC_KEY || `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEADenKScMcRxd/GFPnwHLg026Y3mKWNmtyUR1KPQgLTFI=
-----END PUBLIC KEY-----`,
  cacheFile: process.env.VOCML_CACHE_FILE || path.join(DATA_DIR, 'license-cache.json'),
  appVersion: '1.0.0',
  // Lisensi AKTIF (hanya dinonaktifkan jika secara eksplisit diset VOCML_DISABLED=true)
  disabled: process.env.VOCML_DISABLED === 'true' || process.env.VOCML_DISABLED === '1'
};

// Status lisensi dalam memori
export let licenseStatus = {
  allowed: VOCML_CONFIG.disabled ? true : false,
  status: VOCML_CONFIG.disabled ? 'disabled' : 'checking',
  reason: VOCML_CONFIG.disabled ? 'Lisensi Dinonaktifkan' : 'Sedang memeriksa lisensi ke server otentikasi...',
  machineId: activeMachineId,
  storeName: VOCML_CONFIG.storeName,
  serverUrl: VOCML_CONFIG.serverUrl,
  product: VOCML_CONFIG.product,
  productName: 'Sistem Manajemen Garment & Konveksi Enterprise',
  appVersion: VOCML_CONFIG.appVersion || '1.0.0',
  expiresAt: null,
  licenseKey: null,
  lastChecked: null,
  disabled: VOCML_CONFIG.disabled
};

let pollTimer = null;

// Fungsi verifikasi lisensi ke server VOC ML
export async function runLicenseVerification() {
  if (VOCML_CONFIG.disabled) {
    licenseStatus.allowed = true;
    licenseStatus.status = 'disabled';
    licenseStatus.reason = 'Lisensi Dinonaktifkan (VOCML_DISABLED=true)';
    licenseStatus.lastChecked = new Date().toISOString();
    return;
  }

  // Jika Machine ID belum diisi sama sekali
  if (!VOCML_CONFIG.machineId) {
    licenseStatus = {
      ...licenseStatus,
      allowed: false,
      status: 'unconfigured',
      reason: 'VOCML_MACHINE_ID belum diatur pada file .env',
      machineId: 'TIDAK TERDETEKSI (Jalankan INSTALL.bat)',
      lastChecked: new Date().toISOString()
    };
    scheduleNextCheck(5 * 1000);
    return;
  }

  try {
    const res = await checkLicense(VOCML_CONFIG);
    licenseStatus = {
      allowed: res.allowed,
      status: res.status || (res.allowed ? 'active' : 'pending'),
      reason: res.reason || (res.allowed ? 'Aktif & Terverifikasi' : 'Lisensi Belum Sah / Belum Diaktifkan'),
      machineId: res.machineId || VOCML_CONFIG.machineId,
      storeName: VOCML_CONFIG.storeName,
      serverUrl: VOCML_CONFIG.serverUrl,
      product: VOCML_CONFIG.product,
      productName: 'Sistem Manajemen Garment & Konveksi Enterprise',
      appVersion: VOCML_CONFIG.appVersion || '1.0.0',
      expiresAt: res.expiresAt || null,
      licenseKey: res.licenseKey || null,
      lastChecked: new Date().toISOString(),
      disabled: false
    };

    if (res.allowed) {
      scheduleNextCheck(15 * 1000); // 15 Detik (Responsif Realtime)
    } else {
      console.warn(`[VOCML] 🔒 APLIKASI TERKUNCI: ${licenseStatus.reason}. Cek ulang dalam 5 detik...`);
      scheduleNextCheck(5 * 1000); // 5 Detik
    }
  } catch (err) {
    licenseStatus = {
      ...licenseStatus,
      allowed: false,
      status: 'offline',
      reason: `Gagal terhubung ke server lisensi: ${err.message}`,
      lastChecked: new Date().toISOString()
    };
    scheduleNextCheck(5 * 1000);
  }
}

function scheduleNextCheck(delayMs) {
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = setTimeout(runLicenseVerification, delayMs);
}

// Mulai cek lisensi saat server diinisialisasi
runLicenseVerification();

// HTML Layar Merah (Aplikasi Terkunci / Red Lock Screen)
export function renderLockedScreenHTML(status) {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Aplikasi Terkunci - Lisensi Diperlukan</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    body { background: #450a0a; color: #fff; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { background: #7f1d1d; border: 2px solid #ef4444; border-radius: 20px; max-width: 580px; width: 100%; padding: 36px; box-shadow: 0 25px 60px -15px rgba(0,0,0,0.7); text-align: center; }
    .icon-badge { display: inline-flex; align-items: center; justify-content: center; width: 84px; height: 84px; background: rgba(239, 68, 68, 0.2); border: 2px solid #ef4444; border-radius: 50%; font-size: 42px; margin-bottom: 20px; animation: pulse-ring 2s infinite; }
    @keyframes pulse-ring { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); } 70% { transform: scale(1); box-shadow: 0 0 0 16px rgba(239, 68, 68, 0); } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }
    h1 { font-size: 26px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; color: #fee2e2; }
    p.desc { font-size: 14.5px; color: #fca5a5; margin-bottom: 24px; line-height: 1.55; }
    .info-box { background: rgba(0,0,0,0.35); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 12px; padding: 18px 20px; margin-bottom: 24px; text-align: left; font-size: 13.5px; }
    .info-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px dashed rgba(254, 202, 202, 0.15); padding-bottom: 8px; }
    .info-row:last-child { margin-bottom: 0; border-bottom: none; padding-bottom: 0; }
    .label { color: #fca5a5; font-weight: 600; font-size: 12.5px; text-transform: uppercase; letter-spacing: 0.04em; }
    .value { color: #fff; font-weight: 800; font-size: 13.5px; text-align: right; }
    .value.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; background: rgba(0,0,0,0.5); padding: 4px 8px; border-radius: 6px; border: 1px solid #991b1b; color: #fef08a; letter-spacing: 0.05em; font-size: 12.5px; word-break: break-all; }
    .instructions { background: rgba(254, 240, 138, 0.1); border: 1px solid rgba(254, 240, 138, 0.3); border-radius: 10px; padding: 12px 16px; margin-bottom: 24px; text-align: left; font-size: 12.5px; color: #fef08a; line-height: 1.5; }
    .instructions strong { color: #fff; }
    .pulse-dot { display: inline-block; width: 9px; height: 9px; background: #22c55e; border-radius: 50%; margin-right: 7px; animation: blink 1.2s infinite; }
    @keyframes blink { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.3; transform: scale(0.8); } }
    .footer { font-size: 12px; color: #fca5a5; display: flex; align-items: center; justify-content: center; }
  </style>
  <script>
    // Refresh otomatis setiap 5 detik agar langsung masuk begitu lisensi diaktifkan
    setTimeout(function() {
      window.location.reload();
    }, 5000);
  </script>
</head>
<body>
  <div class="card">
    <div class="icon-badge">🔒</div>
    <h1>Aplikasi Terkunci</h1>
    <p class="desc">Aplikasi ini membutuhkan lisensi aktif dari server otentikasi resmi. Halaman ini akan terbuka secara otomatis segera setelah lisensi disetujui.</p>
    
    <div class="info-box">
      <div class="info-row">
        <span class="label">Outlet / Toko:</span>
        <span class="value">${status.storeName || 'Cabang Utama'}</span>
      </div>
      <div class="info-row">
        <span class="label">Status Lisensi:</span>
        <span class="value" style="color: #fca5a5;">${status.reason}</span>
      </div>
      <div class="info-row">
        <span class="label">Machine ID:</span>
        <span class="value mono">${status.machineId}</span>
      </div>
    </div>

    <div class="instructions">
      ${status.reason === 'Menunggu aktivasi lisensi' ? `
        💡 <strong>Status: Menunggu Konfirmasi Lisensi</strong><br>
        Machine ID ini telah didaftarkan ke server otentikasi.<br>
        Silakan hubungi administrator / penyedia sistem Anda untuk aktivasi lisensi. Halaman ini akan terbuka otomatis dalam 5 detik setelah disetujui.
      ` : `
        💡 <strong>Informasi Administrator:</strong><br>
        ${status.reason}. Pastikan komputer terhubung ke internet untuk validasi lisensi.
      `}
    </div>

    <div class="footer">
      <span class="pulse-dot"></span>
      <span>Memeriksa status aktivasi otomatis setiap 5 detik...</span>
    </div>
  </div>
</body>
</html>`;
}

/**
 * License Guard untuk Node HTTP Server / Next.js
 * Mengembalikan true jika request diizinkan, atau false jika request diblokir (sudah dikirim 403).
 */
export function checkRequestAllowed(req, res) {
  const url = req.url || '';
  
  // Rute aman yang selalu diizinkan (health check, lisensi info, static assets)
  if (
    url === '/api/health' ||
    url === '/api/license-status' ||
    url.startsWith('/_next/static/') ||
    url.startsWith('/_next/image') ||
    url === '/favicon.ico'
  ) {
    // Tangani endpoint status lisensi langsung (tanpa mengekspos internal server URL)
    if (url.startsWith('/api/license-status')) {
      const getPublicStatus = () => {
        const { serverUrl, ...safe } = licenseStatus;
        return safe;
      };
      if (url.includes('refresh=1') || req.method === 'POST') {
        runLicenseVerification().finally(() => {
          try {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(getPublicStatus()));
          } catch {}
        });
        return false;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(getPublicStatus()));
      return false; // selesai ditangani
    }
    return true;
  }

  // Jika lisensi TIDAK aktif, kirim Layar Merah 403
  if (!licenseStatus.allowed) {
    res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(renderLockedScreenHTML(licenseStatus));
    return false;
  }

  return true;
}
