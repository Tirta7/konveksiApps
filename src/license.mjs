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

    const previousAllowed = licenseStatus.allowed;
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

    // Jika lisensi dikunci (allowed === false), broadcast seketika via WebSocket ke browser
    if (!isAllowed && globalThis.__rtHub?.sinks) {
      console.warn(`[VOCML] 🔒 APLIKASI DIKUNCI DARI PUSAT: ${licenseStatus.reason}`);
      for (const sink of globalThis.__rtHub.sinks) {
        try {
          sink("rt", {
            event: "license:locked",
            data: {
              status: currentStatus,
              reason: licenseStatus.reason,
              machineId: licenseStatus.machineId,
              storeName: licenseStatus.storeName,
              billing: licenseStatus.billing,
              ts: Date.now()
            }
          });
        } catch {}
      }
    } else if (isAllowed && previousAllowed === false && globalThis.__rtHub?.sinks) {
      console.log(`[VOCML] 🔓 APLIKASI DIBUKA KEMBALI DARI PUSAT`);
      for (const sink of globalThis.__rtHub.sinks) {
        try {
          sink("rt", {
            event: "license:unlocked",
            data: {
              status: currentStatus,
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

// Koneksi realtime SSE server-side ke VOC ML untuk auto-detect event lock / unlock / renew seketika
function startServerSseListener() {
  if (VOCML_CONFIG.disabled) return;
  const base = VOCML_CONFIG.serverUrl.replace(/\/$/, '');
  const mid = VOCML_CONFIG.machineId;

  async function connectStream() {
    let chosenProduct = VOCML_CONFIG.product;
    try {
      let qs = new URLSearchParams({ machine_id: mid, product: chosenProduct });
      let res = await fetch(`${base}/api/v1/stream?${qs.toString()}`, {
        headers: { Accept: 'text/event-stream' }
      });

      // Fallback transparan jika server remote belum mendukung enum 'konveksi'
      if (!res.ok && res.status === 400) {
        chosenProduct = 'pos';
        qs = new URLSearchParams({ machine_id: mid, product: chosenProduct });
        res = await fetch(`${base}/api/v1/stream?${qs.toString()}`, {
          headers: { Accept: 'text/event-stream' }
        });
      }

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      console.log(`[VOCML] ✅ Stream realtime terhubung ke server VOC ML (product: ${chosenProduct})`);
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
          // Abaikan hanya handshake awal / ping rutin
          if (eventName === 'connected' || eventName === 'ping') continue;

          console.log(`[VOCML] ⚡ Event realtime diterima dari server VOC ML: "${eventName}"`);
          await runLicenseVerification();
        }
      }
    } catch (err) {
      console.warn(`[VOCML] Stream putus (${err.message}), reconnect dalam 3 detik...`);
      setTimeout(connectStream, 3000);
    }
  }

  connectStream();
}

startServerSseListener();

// HTML Layar Kunci Red Lock Screen (Diselaraskan 100% identik dengan VocmlLicenseModal React)
export function renderLockedScreenHTML(status) {
  const billing = status.billing;
  const packages = billing?.packages || [];
  const defaultPkg = packages[0];
  const qrisUrl = defaultPkg?.qris_image_url || billing?.qris_image_url || '';
  const amountText = defaultPkg?.amount_text || billing?.amount_text || 'Rp 0';
  const mid = status.machineId || 'MID-UNKNOWN';
  const store = status.storeName || 'Konveksi ERP';

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daftar Paket Lisensi & Perpanjangan | Konveksi ERP</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    body { background: #0b1120; color: #f8fafc; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 16px; }
    .modal-card { background: #1e293b; border: 1px solid #334155; border-radius: 20px; max-width: 880px; width: 100%; box-shadow: 0 25px 60px rgba(0,0,0,0.6); overflow: hidden; animation: fadeIn 0.2s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
    .header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid #334155; }
    .header-title-box { display: flex; align-items: center; gap: 8px; }
    .header-title { font-size: 18px; font-weight: 800; color: #ffffff; margin: 0; }
    .header-sub { font-size: 12px; color: #94a3b8; margin-top: 4px; }
    .badge-locked { padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; background: rgba(239, 68, 68, 0.2); color: #f87171; }
    .lock-alert-text { font-size: 11px; color: #ef4444; font-weight: 700; display: flex; align-items: center; gap: 4px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; padding: 24px; }
    @media(max-width: 680px) { .grid { grid-template-columns: 1fr; } }
    .qris-panel { background: rgba(15, 23, 42, 0.6); border-radius: 16px; border: 1px solid rgba(51, 65, 85, 0.6); padding: 20px; display: flex; flex-direction: column; align-items: center; }
    .qris-img-box { padding: 12px; background: #ffffff; border-radius: 12px; box-shadow: 0 8px 20px rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center; min-height: 224px; min-width: 224px; margin-bottom: 14px; }
    .qris-img { width: 208px; height: 208px; object-fit: contain; display: block; }
    .total-label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; margin: 0; text-align: center; }
    .total-val { font-size: 26px; font-weight: 900; color: #38bdf8; font-family: ui-monospace, SFMono-Regular, monospace; margin: 4px 0; text-align: center; }
    .merchant-label { font-size: 11px; color: #94a3b8; margin: 0; text-align: center; }
    .btn-pay { width: 100%; margin-top: 16px; padding: 12px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; border: none; border-radius: 10px; font-weight: 800; font-size: 13px; cursor: pointer; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); display: flex; align-items: center; justify-content: center; gap: 8px; transition: opacity 0.15s; }
    .btn-pay:active { transform: scale(0.99); }
    .mid-box { width: 100%; margin-top: 14px; padding: 8px 12px; background: rgba(0, 0, 0, 0.3); border-radius: 8px; border: 1px solid #334155; display: flex; align-items: center; justify-content: space-between; font-size: 11px; }
    .mid-text { font-family: ui-monospace, monospace; color: #38bdf8; font-weight: 700; }
    .pkg-title { font-size: 12px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 10px; }
    .pkg-list { display: flex; flex-direction: column; gap: 8px; }
    .pkg-card { padding: 12px 14px; border-radius: 12px; border: 1px solid #334155; background: #0f172a; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: all 0.15s ease; }
    .pkg-card.active { border: 2px solid #38bdf8; background: rgba(56, 189, 248, 0.1); }
    .pkg-name { font-weight: 800; font-size: 13px; color: #ffffff; }
    .pkg-badge { font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px; background: #f59e0b; color: #0f172a; margin-left: 6px; }
    .pkg-sub { font-size: 11px; color: #64748b; margin-top: 2px; }
    .pkg-amount { font-size: 14px; font-weight: 900; color: #38bdf8; font-family: ui-monospace, monospace; text-align: right; }
    .voucher-box { margin-top: 16px; padding: 14px; background: rgba(15, 23, 42, 0.5); border: 1px solid #334155; border-radius: 12px; }
    .voucher-title { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
    .voucher-form { display: flex; gap: 8px; }
    .voucher-input { flex: 1; padding: 8px 12px; background: #0f172a; border: 1px solid #334155; border-radius: 8px; color: #ffffff; font-size: 12px; text-transform: uppercase; outline: none; }
    .voucher-btn { padding: 8px 16px; background: #2563eb; color: #ffffff; border: none; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; }
    .help-box { margin-top: 14px; font-size: 11px; color: #94a3b8; line-height: 1.5; background: rgba(0,0,0,0.2); padding: 12px; border-radius: 10px; }
    .copy-btn { background: transparent; border: none; color: #94a3b8; cursor: pointer; padding: 2px; font-size: 11px; }
  </style>
  <script>
    function selectPackage(el, url, amount) {
      document.querySelectorAll('.pkg-card').forEach(p => p.classList.remove('active'));
      el.classList.add('active');
      document.getElementById('qris-img').src = url;
      document.getElementById('total-amount').innerText = amount;
    }
    function copyMid() {
      navigator.clipboard.writeText('${mid}');
      const el = document.getElementById('copy-label');
      el.innerText = 'Tersalin!';
      setTimeout(() => { el.innerText = 'Salin'; }, 2000);
    }
    async function checkStatusNow() {
      const btn = document.getElementById('btn-pay-now');
      btn.innerText = '⏳ Memeriksa...';
      try {
        const res = await fetch('/api/license-status?refresh=1');
        if (res.ok) {
          const d = await res.json();
          if (d.allowed) {
            window.location.reload();
            return;
          }
        }
      } catch(e) {}
      setTimeout(() => { btn.innerText = '✅ Saya Sudah Bayar'; }, 1000);
    }
    async function claimVoucher(e) {
      e.preventDefault();
      const code = document.getElementById('voucher-code').value.trim();
      if (!code) return;
      const btn = document.getElementById('voucher-btn');
      btn.innerText = '...';
      try {
        const res = await fetch('/api/license/voucher', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code })
        });
        const d = await res.json();
        if (res.ok && d.ok) {
          alert('Voucher Berhasil Diklaim!');
          window.location.reload();
        } else {
          alert(d.error || 'Voucher tidak valid');
        }
      } catch(e) {
        alert('Gagal klaim voucher');
      } finally {
        btn.innerText = 'Klaim';
      }
    }
    // Fast-polling 1.5 detik ke server dengan refresh=1 untuk unlock seketika
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
    }, 1500);
  </script>
</head>
<body>
  <div class="modal-card">
    <div class="header">
      <div>
        <div class="header-title-box">
          <span style="color: #38bdf8; font-size: 18px;">🛡️</span>
          <h3 class="header-title">Daftar Paket Lisensi & Perpanjangan</h3>
          <span class="badge-locked">LOCKED</span>
        </div>
        <div class="header-sub">${store} • ${store}</div>
      </div>
      <div class="lock-alert-text">🔒 Lisensi Diperlukan</div>
    </div>

    <div class="grid">
      <!-- Kolom Kiri: Penampil QRIS Tunggal -->
      <div class="qris-panel">
        <div class="qris-img-box">
          <img id="qris-img" src="${qrisUrl}" alt="QRIS Pembayaran Dinamis" class="qris-img" />
        </div>
        <p class="total-label">TOTAL TAGIHAN</p>
        <p id="total-amount" class="total-val">${amountText}</p>
        <p class="merchant-label">QRIS Dinamis • ${billing?.merchant_name || 'Virtual Operation Control'}</p>
        
        <button id="btn-pay-now" class="btn-pay" onclick="checkStatusNow()">
          ✅ Saya Sudah Bayar
        </button>

        <div class="mid-box">
          <span style="color: #94a3b8;">MID:</span>
          <span class="mid-text">${mid}</span>
          <button class="copy-btn" onclick="copyMid()"><span id="copy-label">Salin</span></button>
        </div>
      </div>

      <!-- Kolom Kanan: Pilihan Paket & Klaim Voucher -->
      <div>
        <div class="pkg-title">PILIHAN PAKET LISENSI</div>
        <div class="pkg-list">
          ${packages.map((pkg, idx) => `
            <div class="pkg-card ${idx === 0 ? 'active' : ''}" onclick="selectPackage(this, '${pkg.qris_image_url}', '${pkg.amount_text}')">
              <div>
                <div style="display: flex; align-items: center;">
                  <span class="pkg-name">${pkg.name}</span>
                  ${pkg.promo_badge || pkg.promoBadge ? `<span class="pkg-badge">${pkg.promo_badge || pkg.promoBadge}</span>` : ''}
                </div>
                <div class="pkg-sub">Durasi: ${pkg.label || pkg.days + ' Hari'}</div>
              </div>
              <div class="pkg-amount">${pkg.amount_text}</div>
            </div>
          `).join('')}
        </div>

        <div class="voucher-box">
          <div class="voucher-title">🏷️ KLAIM KODE VOUCHER PROMO</div>
          <form class="voucher-form" onsubmit="claimVoucher(event)">
            <input type="text" id="voucher-code" class="voucher-input" placeholder="Masukkan kode voucher..." />
            <button type="submit" id="voucher-btn" class="voucher-btn">Klaim</button>
          </form>
        </div>

        <div class="help-box">
          <strong style="color: #cbd5e1;">⚡ Auto-Unlock Seketika:</strong><br />
          1. Buka aplikasi BCA, GoPay, OVO, Dana, ShopeePay, atau Mobile Banking.<br />
          2. Scan QRIS dinamis di sebelah kiri sesuai nominal yang tertera.<br />
          3. Setelah bayar, sistem akan otomatis terbuka dalam hitungan detik!
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
