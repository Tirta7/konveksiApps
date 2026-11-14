/**
 * VOC ML - Middleware Pengunci Lisensi, Auto-Billing QRIS & Machine ID
 * 
 * Melindungi aplikasi Konveksi Apps berbasis Machine ID hardware klien.
 * Mengintegrasikan sistem lisensi resmi VOC ML (Pilar 1 - 8).
 */
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const DATA_DIR = process.env.DATA_DIR || process.cwd();

// Fungsi membaca Machine ID asli dari hardware komputer (Mac / Windows / Linux)
export function getHardwareMachineId() {
  if (process.env.VOCML_MACHINE_ID && process.env.VOCML_MACHINE_ID.trim()) {
    return process.env.VOCML_MACHINE_ID.trim().toUpperCase();
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
    } else if (process.platform === 'linux') {
      const id = fs.readFileSync('/etc/machine-id', 'utf8').trim();
      if (id) {
        const hex = crypto.createHash("sha256").update(id.toUpperCase()).digest("hex").toUpperCase();
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
  product: process.env.VOCML_PRODUCT || 'konveksi',
  storeName: process.env.STORE_NAME || 'Konveksi ERP',
  machineId: activeMachineId,
  publicKeyPem: process.env.VOCML_PUBLIC_KEY || `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEADenKScMcRxd/GFPnwHLg026Y3mKWNmtyUR1KPQgLTFI=
-----END PUBLIC KEY-----`,
  cacheFile: process.env.VOCML_CACHE_FILE || path.join(DATA_DIR, 'license-cache.json'),
  appVersion: '1.0.0',
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
  productName: 'Konveksi ERP',
  appVersion: VOCML_CONFIG.appVersion || '1.0.0',
  expiresAt: null,
  remainingDays: null,
  licenseKey: null,
  lastChecked: null,
  disabled: VOCML_CONFIG.disabled,
  trial: null,
  billing: null,
  messages: []
};

let pollTimer = null;
let lastBroadcastPaymentTime = null;

try {
  const initialCache = readCache();
  if (initialCache?.data?.last_payment?.created_at) {
    lastBroadcastPaymentTime = initialCache.data.last_payment.created_at;
  }
} catch {}

const ALLOWED_SET = new Set(['active', 'expiring', 'trial']);

/** Verifikasi token Ed25519 server */
function verifyServerToken(token, publicKeyPem) {
  try {
    const [data, sig] = String(token).split('.');
    if (!data || !sig) return null;
    const ok = crypto.verify(null, Buffer.from(data), crypto.createPublicKey(publicKeyPem), Buffer.from(sig, 'base64url'));
    return ok ? JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) : null;
  } catch {
    return null;
  }
}

function readCache() {
  try {
    if (fs.existsSync(/*turbopackIgnore: true*/ VOCML_CONFIG.cacheFile)) {
      return JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ VOCML_CONFIG.cacheFile, 'utf8'));
    }
  } catch {}
  return null;
}

function writeCache(data) {
  try {
    fs.writeFileSync(/*turbopackIgnore: true*/ VOCML_CONFIG.cacheFile, JSON.stringify(data, null, 2), 'utf8');
  } catch {}
}

async function requestServerCheck(prod) {
  const base = VOCML_CONFIG.serverUrl.replace(/\/$/, '');
  const qs = new URLSearchParams({
    machine_id: VOCML_CONFIG.machineId,
    product: prod,
    app_version: VOCML_CONFIG.appVersion
  });

  let res = await fetch(`${base}/api/v1/check?${qs.toString()}`, {
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(8000),
    cache: 'no-store'
  });

  if (res.status === 404) {
    res = await fetch(`${base}/api/v1/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        machine_id: VOCML_CONFIG.machineId,
        product: prod,
        store_name: VOCML_CONFIG.storeName,
        app_version: VOCML_CONFIG.appVersion
      }),
      signal: AbortSignal.timeout(8000)
    });
  }

  const json = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, json };
}

async function fetchBroadcastMessages(prod) {
  try {
    const base = VOCML_CONFIG.serverUrl.replace(/\/$/, '');
    const qs = new URLSearchParams({
      machine_id: VOCML_CONFIG.machineId,
      product: prod
    });
    const res = await fetch(`${base}/api/v1/messages?${qs.toString()}`, {
      signal: AbortSignal.timeout(5000),
      cache: 'no-store'
    });
    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data.messages) ? data.messages : [];
    }
  } catch {}
  return [];
}

// Fungsi verifikasi lisensi ke server VOC ML
export async function runLicenseVerification() {
  if (VOCML_CONFIG.disabled) {
    licenseStatus.allowed = true;
    licenseStatus.status = 'disabled';
    licenseStatus.reason = 'Lisensi Dinonaktifkan (VOCML_DISABLED=true)';
    licenseStatus.lastChecked = new Date().toISOString();
    return licenseStatus;
  }

  try {
    let chosenProduct = VOCML_CONFIG.product;
    let check = await requestServerCheck(chosenProduct);

    // Fallback jika server remote belum mendukung enum 'konveksi'
    if (!check.ok && check.json?.error && String(check.json.error).includes('product harus salah satu')) {
      chosenProduct = 'pos';
      check = await requestServerCheck(chosenProduct);
    }

    if (!check.ok) {
      throw new Error(check.json?.error || `HTTP ${check.status}`);
    }

    const body = check.json;
    const msgs = await fetchBroadcastMessages(chosenProduct);

    // Deteksi event pembayaran baru masuk (hanya broadcast 1x per transaksi baru)
    const newPaymentTime = body.last_payment?.created_at;
    const isNewPayment = !!(
      newPaymentTime &&
      lastBroadcastPaymentTime &&
      newPaymentTime !== lastBroadcastPaymentTime
    );
    if (newPaymentTime) {
      lastBroadcastPaymentTime = newPaymentTime;
    }

    // Simpan cache offline
    writeCache({
      token: body.token,
      data: body,
      product: chosenProduct,
      checkedAt: Date.now()
    });

    const currentStatus = body.status || 'pending';
    const isAllowed = ALLOWED_SET.has(currentStatus);

    licenseStatus = {
      allowed: isAllowed,
      status: currentStatus,
      reason: body.lock_reason || (isAllowed ? 'Aktif & Terverifikasi' : 'Menunggu aktivasi lisensi'),
      machineId: body.machine_id || VOCML_CONFIG.machineId,
      storeName: body.store_name || VOCML_CONFIG.storeName,
      serverUrl: VOCML_CONFIG.serverUrl,
      product: chosenProduct,
      productName: 'Konveksi ERP',
      appVersion: VOCML_CONFIG.appVersion || '1.0.0',
      expiresAt: body.expires_at || null,
      remainingDays: body.remaining_days ?? body.days_left ?? null,
      licenseKey: body.license_key || null,
      lastChecked: new Date().toISOString(),
      disabled: false,
      trial: body.trial || null,
      billing: body.billing || null,
      lastPayment: body.last_payment || null,
      messages: msgs || []
    };

    // Broadcast ke browser WebSocket jika ada pembayaran baru masuk (1x saja)
    if (isNewPayment && globalThis.__rtHub?.sinks) {
      console.log(`[VOCML] 🎉 PEMBAYARAN BERHASIL DITERIMA: ${body.last_payment?.action || ''}`);
      for (const sink of globalThis.__rtHub.sinks) {
        try {
          sink("rt", {
            event: "license:payment_success",
            data: {
              lastPayment: body.last_payment,
              expiresAt: body.expires_at,
              remainingDays: body.remaining_days,
              ts: Date.now()
            }
          });
        } catch {}
      }
    }

    if (licenseStatus.allowed) {
      scheduleNextCheck(15 * 1000); // 15 detik untuk sync berkala
    } else {
      scheduleNextCheck(3 * 1000);
    }
  } catch (err) {
    // Mode Offline (Pilar 8)
    const cache = readCache();
    if (cache && cache.token) {
      const payload = verifyServerToken(cache.token, VOCML_CONFIG.publicKeyPem);
      if (payload && payload.machine_id === VOCML_CONFIG.machineId) {
        const graceDays = payload.grace_days || 5;
        const graceMs = graceDays * 86400000;
        const withinGrace = (Date.now() - (cache.checkedAt || 0)) <= graceMs;

        if (ALLOWED_SET.has(payload.status) && withinGrace) {
          licenseStatus = {
            allowed: true,
            status: payload.status,
            reason: `Aktif (Mode Offline - Toleransi ${graceDays} Hari)`,
            machineId: VOCML_CONFIG.machineId,
            storeName: VOCML_CONFIG.storeName,
            serverUrl: VOCML_CONFIG.serverUrl,
            product: cache.product || VOCML_CONFIG.product,
            productName: 'Konveksi ERP',
            appVersion: VOCML_CONFIG.appVersion || '1.0.0',
            expiresAt: payload.expires_at || null,
            remainingDays: payload.remaining_days || null,
            licenseKey: payload.license_key || null,
            lastChecked: new Date(cache.checkedAt || Date.now()).toISOString(),
            disabled: false,
            trial: cache.data?.trial || null,
            billing: cache.data?.billing || null,
            messages: []
          };
          scheduleNextCheck(30 * 1000);
          return licenseStatus;
        }
      }
    }

    licenseStatus = {
      ...licenseStatus,
      allowed: false,
      status: 'offline',
      reason: `Gagal terhubung ke server lisensi: ${err.message}`,
      lastChecked: new Date().toISOString()
    };
    scheduleNextCheck(5 * 1000);
  }

  return licenseStatus;
}

function scheduleNextCheck(delayMs) {
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = setTimeout(runLicenseVerification, delayMs);
}

// Inisialisasi saat server startup
runLicenseVerification();

// Koneksi realtime SSE server-side ke VOC ML untuk auto-detect event renew / unlock seketika
function startServerSseListener() {
  if (VOCML_CONFIG.disabled) return;
  const base = VOCML_CONFIG.serverUrl.replace(/\/$/, '');
  const mid = VOCML_CONFIG.machineId;
  const prod = VOCML_CONFIG.product || 'pos';
  const qs = new URLSearchParams({ machine_id: mid, product: prod });

  async function connectStream() {
    try {
      const res = await fetch(`${base}/api/v1/stream?${qs.toString()}`, {
        headers: { Accept: 'text/event-stream' }
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const blocks = buf.split('\n\n');
        buf = blocks.pop() || '';
        for (const block of blocks) {
          if (!block.trim() || block.startsWith(':')) continue;
          let eventName = 'message';
          for (const line of block.split('\n')) {
            if (line.startsWith('event:')) eventName = line.slice(6).trim();
          }
          if (eventName === 'renew' || eventName === 'unlock' || eventName === 'message' || eventName === 'payment') {
            await runLicenseVerification();
          }
        }
      }
    } catch {
      setTimeout(connectStream, 10000);
    }
  }

  connectStream();
}

startServerSseListener();

// HTML Layar Kunci Red Lock Screen (Fallback server level jika diblokir sebelum browser load React)
export function renderLockedScreenHTML(status) {
  const billing = status.billing;
  const packages = billing?.packages || [];
  const defaultPkg = packages[0];
  const qrisUrl = defaultPkg?.qris_image_url || billing?.qris_image_url || '';
  const amountText = defaultPkg?.amount_text || billing?.amount_text || 'Rp 450.000';

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Aplikasi Terkunci - Lisensi Diperlukan | Konveksi ERP</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    body { background: #0f172a; color: #f8fafc; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 18px; max-width: 780px; width: 100%; padding: 32px; box-shadow: 0 25px 60px rgba(0,0,0,0.5); }
    .grid { display: grid; grid-template-columns: 1fr 1.2fr; gap: 24px; margin-top: 20px; }
    @media(max-width: 680px) { .grid { grid-template-columns: 1fr; } }
    .badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 999px; font-size: 12px; font-weight: 700; }
    h1 { font-size: 22px; font-weight: 800; margin: 12px 0 6px; color: #fff; }
    p.desc { font-size: 13px; color: #94a3b8; line-height: 1.5; }
    .qris-box { background: #0f172a; border: 1px solid #334155; border-radius: 14px; padding: 18px; display: flex; flex-direction: column; align-items: center; text-align: center; }
    .qris-img-container { background: #fff; padding: 10px; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); margin-bottom: 12px; }
    .qris-img { width: 180px; height: 180px; object-fit: contain; display: block; }
    .total-label { font-size: 11px; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em; }
    .total-val { font-size: 22px; font-weight: 800; color: #38bdf8; font-family: ui-monospace, monospace; margin: 4px 0; }
    .pkg-list { display: flex; flex-direction: column; gap: 10px; }
    .pkg-item { padding: 12px 14px; background: #0f172a; border: 1px solid #334155; border-radius: 10px; cursor: pointer; transition: all 0.2s; display: flex; justify-content: space-between; align-items: center; }
    .pkg-item:hover, .pkg-item.active { border-color: #38bdf8; background: rgba(56, 189, 248, 0.08); }
    .pkg-name { font-size: 13px; font-weight: 700; color: #fff; }
    .pkg-price { font-size: 14px; font-weight: 800; color: #38bdf8; font-family: ui-monospace, monospace; }
    .btn-pay { width: 100%; margin-top: 16px; padding: 12px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #fff; border: none; border-radius: 10px; font-weight: 800; font-size: 13px; cursor: pointer; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); }
    .mid-box { margin-top: 16px; padding: 10px 14px; background: rgba(0,0,0,0.3); border-radius: 8px; font-size: 12px; color: #94a3b8; display: flex; justify-content: space-between; font-family: ui-monospace, monospace; }
    .pulse { width: 8px; height: 8px; background: #10b981; border-radius: 50%; display: inline-block; animation: blink 1.5s infinite; margin-right: 6px; }
    @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
  </style>
  <script>
    function selectPackage(el, url, amount) {
      document.querySelectorAll('.pkg-item').forEach(p => p.classList.remove('active'));
      el.classList.add('active');
      document.getElementById('qris-img').src = url;
      document.getElementById('total-amount').innerText = amount;
    }
    // Fast polling untuk auto-unlock seketika
    setInterval(async function() {
      try {
        const res = await fetch('/api/license-status?refresh=1');
        if (res.ok) {
          const d = await res.json();
          if (d.allowed) {
            window.location.reload();
          }
        }
      } catch(e) {}
    }, 3000);
  </script>
</head>
<body>
  <div class="card">
    <div class="badge">🔒 LISENSI DIPERLUKAN</div>
    <h1>Konveksi ERP — Akses Terkunci</h1>
    <p class="desc">Aplikasi ini membutuhkan lisensi aktif untuk melanjutkan operasional. Silakan scan QRIS dinamis di bawah untuk perpanjangan seketika.</p>

    <div class="grid">
      <!-- Kolom Kiri: QRIS Tunggal -->
      <div class="qris-box">
        <div class="qris-img-container">
          <img id="qris-img" src="${qrisUrl}" alt="QRIS Dinamis VOC ML" class="qris-img" />
        </div>
        <div class="total-label">TOTAL TAGIHAN</div>
        <div id="total-amount" class="total-val">${amountText}</div>
        <div style="font-size: 11px; color: #64748B;">QRIS • ${billing?.merchant_name || 'Virtual Operation Control'}</div>
        <button class="btn-pay" onclick="window.location.reload()">✅ Saya Sudah Bayar</button>
      </div>

      <!-- Kolom Kanan: Pilihan Paket -->
      <div>
        <div style="font-size: 12px; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: 10px;">PILIHAN PAKET LISENSI</div>
        <div class="pkg-list">
          ${packages.map((pkg, idx) => `
            <div class="pkg-item ${idx === 0 ? 'active' : ''}" onclick="selectPackage(this, '${pkg.qris_image_url}', '${pkg.amount_text}')">
              <div>
                <div class="pkg-name">${pkg.name} (${pkg.label || pkg.days + ' Hari'})</div>
                <div style="font-size: 11px; color: #64748b;">${pkg.promo_badge ? '⭐ ' + pkg.promo_badge : 'Resmi VOC ML'}</div>
              </div>
              <div class="pkg-price">${pkg.amount_text}</div>
            </div>
          `).join('')}
        </div>
        <div class="mid-box">
          <span>MACHINE ID:</span>
          <span style="color: #38bdf8;">${status.machineId}</span>
        </div>
        <div style="margin-top: 12px; font-size: 11px; color: #94a3b8; display: flex; align-items: center;">
          <span class="pulse"></span> Menunggu deteksi pembayaran seketika...
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * License Guard untuk Node HTTP Server / Next.js
 */
export function checkRequestAllowed(req, res) {
  const url = req.url || '';
  
  // Rute aman yang selalu diizinkan
  if (
    url === '/api/health' ||
    url.startsWith('/api/license') ||
    url.startsWith('/api/license-status') ||
    url.startsWith('/_next/static/') ||
    url.startsWith('/_next/image') ||
    url === '/favicon.ico'
  ) {
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
      return false;
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
