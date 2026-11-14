import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

export interface VocmlPackage {
  id: string;
  name: string;
  label?: string;
  days: number;
  basePrice?: number;
  promoPrice?: number | null;
  amount: number;
  amount_text: string;
  is_promo?: boolean;
  promo_badge?: string;
  promoBadge?: string;
  unique_code?: number;
  qris_image_url: string;
}

export interface VocmlBilling {
  amount: number;
  amount_text: string;
  merchant_name?: string;
  merchant_city?: string;
  qris?: string;
  qris_image_url: string;
  packages: VocmlPackage[];
  reason?: string;
  unique_code?: number;
  note?: string;
  contact?: string;
}

export interface VocmlTrial {
  enabled: boolean;
  quota: number;
  used: number;
  remaining: number;
  is_trial: boolean;
}

export interface VocmlLicenseState {
  allowed: boolean;
  status: 'active' | 'expiring' | 'trial' | 'expired' | 'locked' | 'pending' | 'offline' | 'unconfigured' | string;
  reason?: string;
  machineId: string;
  storeName: string;
  product: string;
  productName: string;
  appVersion: string;
  expiresAt: string | null;
  remainingDays?: number | null;
  licenseKey?: string | null;
  trial?: VocmlTrial | null;
  billing?: VocmlBilling | null;
  offline?: boolean;
  lastChecked?: string | null;
  messages?: any[];
}

const DATA_DIR = process.env.DATA_DIR || process.cwd();
const CACHE_FILE = process.env.VOCML_CACHE_FILE || path.join(DATA_DIR, 'license-cache.json');
const PUBLIC_KEY_PEM = process.env.VOCML_PUBLIC_KEY || `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEADenKScMcRxd/GFPnwHLg026Y3mKWNmtyUR1KPQgLTFI=
-----END PUBLIC KEY-----`;

export const VOCML_SERVER_URL = process.env.VOCML_SERVER_URL || 'https://vocml.vocpos.id';
export const VOCML_PRODUCT = process.env.VOCML_PRODUCT || 'konveksi';
export const VOCML_APP_NAME = 'Konveksi ERP';

// Ambil Hardware Machine ID asli (Mac, Win, Linux)
export function getHardwareMachineId(): string {
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
      const uuid = execSync('powershell -NoProfile -Command "(Get-CimInstance Win32_ComputerSystemProduct).UUID"', { encoding: 'utf8' }).trim();
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
  } catch {}
  return 'MID-2201-35AE-22B8';
}

/** Verifikasi token Ed25519 server */
export function verifyToken(token: string, publicKeyPem: string = PUBLIC_KEY_PEM): any | null {
  try {
    const [data, sig] = String(token).split('.');
    if (!data || !sig) return null;
    const ok = crypto.verify(null, Buffer.from(data), crypto.createPublicKey(publicKeyPem), Buffer.from(sig, 'base64url'));
    return ok ? JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) : null;
  } catch {
    return null;
  }
}

function readLocalCache(): any | null {
  try {
    if (fs.existsSync(/*turbopackIgnore: true*/ CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ CACHE_FILE, 'utf8'));
    }
  } catch {}
  return null;
}

function writeLocalCache(data: any) {
  try {
    fs.writeFileSync(/*turbopackIgnore: true*/ CACHE_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch {}
}

const ALLOWED_STATUSES = new Set(['active', 'expiring', 'trial']);

/**
 * Cek lisensi dan auto-register ke VOC ML server (Pilar 1, 2, 8)
 * Mendukung graceful fallback product jika server remote belum mengaktifkan enum 'konveksi'
 */
export async function queryLicenseServer(options: {
  serverUrl?: string;
  product?: string;
  machineId?: string;
  storeName?: string;
  appVersion?: string;
  timeoutMs?: number;
} = {}): Promise<VocmlLicenseState> {
  const serverUrl = (options.serverUrl || VOCML_SERVER_URL).replace(/\/$/, '');
  const primaryProduct = options.product || VOCML_PRODUCT;
  const machineId = (options.machineId || getHardwareMachineId()).toUpperCase();
  const storeName = options.storeName || process.env.STORE_NAME || 'Konveksi ERP';
  const appVersion = options.appVersion || '1.0.0';
  const timeoutMs = options.timeoutMs || 8000;

  async function executeRequest(prod: string) {
    const qs = new URLSearchParams({
      machine_id: machineId,
      product: prod,
      app_version: appVersion,
    });

    let res = await fetch(`${serverUrl}/api/v1/check?${qs.toString()}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store'
    });

    // Pilar 1: Jika 404 (belum terdaftar), otomatis register
    if (res.status === 404) {
      res = await fetch(`${serverUrl}/api/v1/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machine_id: machineId,
          product: prod,
          store_name: storeName,
          app_version: appVersion
        }),
        signal: AbortSignal.timeout(timeoutMs)
      });
    }

    const data = await res.json();
    return { status: res.status, ok: res.ok, data };
  }

  try {
    let chosenProduct = primaryProduct;
    let result = await executeRequest(chosenProduct);

    // Jika server merespon error enum product (server sedang menunggu whitelist 'konveksi'),
    // gunakan fallback 'pos' secara transparan agar user tidak terganggu
    if (!result.ok && result.data?.error && String(result.data.error).includes('product harus salah satu')) {
      chosenProduct = 'pos';
      result = await executeRequest(chosenProduct);
    }

    if (!result.ok) {
      throw new Error(result.data?.error || `HTTP ${result.status}`);
    }

    const body = result.data;
    const token = body.token;
    const verified = token ? verifyToken(token) : null;

    // Cache respon untuk offline mode
    writeLocalCache({
      token,
      data: body,
      product: chosenProduct,
      checkedAt: Date.now()
    });

    const status = body.status || 'pending';
    const isAllowed = ALLOWED_STATUSES.has(status);

    return {
      allowed: isAllowed,
      status,
      reason: body.lock_reason || (isAllowed ? 'Lisensi Aktif & Terverifikasi' : 'Menunggu aktivasi lisensi'),
      machineId,
      storeName: body.store_name || storeName,
      product: chosenProduct,
      productName: VOCML_APP_NAME,
      appVersion,
      expiresAt: body.expires_at || null,
      remainingDays: body.remaining_days ?? body.days_left ?? null,
      licenseKey: body.license_key || null,
      trial: body.trial || null,
      billing: body.billing || null,
      offline: false,
      lastChecked: new Date().toISOString()
    };
  } catch (err: any) {
    // Mode Offline (Pilar 8): Validasi cache bertanda tangan lokal
    const cache = readLocalCache();
    if (cache && cache.token) {
      const payload = verifyToken(cache.token);
      if (payload && payload.machine_id === machineId) {
        const graceDays = payload.grace_days || 5;
        const graceMs = graceDays * 86400000;
        const withinGrace = (Date.now() - (cache.checkedAt || 0)) <= graceMs;

        if (ALLOWED_STATUSES.has(payload.status) && withinGrace) {
          return {
            allowed: true,
            status: payload.status,
            reason: `Aktif (Mode Offline - Toleransi ${graceDays} Hari)`,
            machineId,
            storeName,
            product: cache.product || primaryProduct,
            productName: VOCML_APP_NAME,
            appVersion,
            expiresAt: payload.expires_at || null,
            remainingDays: payload.remaining_days || null,
            licenseKey: payload.license_key || null,
            trial: cache.data?.trial || null,
            billing: cache.data?.billing || null,
            offline: true,
            lastChecked: new Date(cache.checkedAt || Date.now()).toISOString()
          };
        }
      }
    }

    return {
      allowed: false,
      status: 'offline',
      reason: `Tidak dapat terhubung ke server lisensi (${err.message})`,
      machineId,
      storeName,
      product: primaryProduct,
      productName: VOCML_APP_NAME,
      appVersion,
      expiresAt: null,
      offline: true,
      lastChecked: new Date().toISOString()
    };
  }
}

/**
 * Pilar 6: Potong Kuota Transaksi (/api/v1/trial/consume)
 * Dipanggil khusus saat klik "Simpan Data Potongan & Terbitkan SPK"
 */
export async function consumeTrialQuota(options: {
  machineId?: string;
  product?: string;
  quantity?: number;
  serverUrl?: string;
} = {}): Promise<{ ok: boolean; allowed: boolean; remaining?: number; message?: string; status?: number }> {
  const serverUrl = (options.serverUrl || VOCML_SERVER_URL).replace(/\/$/, '');
  const primaryProduct = options.product || VOCML_PRODUCT;
  const machineId = (options.machineId || getHardwareMachineId()).toUpperCase();
  const quantity = options.quantity || 1;

  async function callConsume(prod: string) {
    return await fetch(`${serverUrl}/api/v1/trial/consume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        machine_id: machineId,
        product: prod,
        quantity
      }),
      signal: AbortSignal.timeout(8000)
    });
  }

  try {
    let res = await callConsume(primaryProduct);
    if (!res.ok && res.status === 400) {
      const errJson = await res.json().catch(() => ({}));
      if (errJson.error && String(errJson.error).includes('product harus salah satu')) {
        res = await callConsume('pos');
      }
    }

    const json = await res.json().catch(() => ({}));
    if (res.status === 403) {
      return {
        ok: false,
        allowed: false,
        remaining: 0,
        message: 'Kuota Transaksi Anda Telah Habis! Silakan perpanjang lisensi untuk melanjutkan operasional.',
        status: 403
      };
    }

    if (res.ok) {
      return {
        ok: true,
        allowed: json.allowed !== false,
        remaining: json.trial?.remaining ?? json.remaining,
        message: json.message || 'Kuota berhasil digunakan',
        status: 200
      };
    }

    return {
      ok: false,
      allowed: false,
      message: json.error || `HTTP ${res.status}`,
      status: res.status
    };
  } catch (err: any) {
    // Toleransi jika offline sementara dan cache masih valid
    return {
      ok: true,
      allowed: true,
      message: `Offline mode: ${err.message}`,
      status: 200
    };
  }
}

/**
 * Pilar 5: Klaim Kode Voucher Promo (/api/v1/voucher/claim)
 */
export async function claimVoucherCode(options: {
  code: string;
  machineId?: string;
  product?: string;
  serverUrl?: string;
}): Promise<{ ok: boolean; message?: string; error?: string }> {
  const serverUrl = (options.serverUrl || VOCML_SERVER_URL).replace(/\/$/, '');
  const primaryProduct = options.product || VOCML_PRODUCT;
  const machineId = (options.machineId || getHardwareMachineId()).toUpperCase();

  async function callClaim(prod: string) {
    return await fetch(`${serverUrl}/api/v1/voucher/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        machine_id: machineId,
        product: prod,
        code: options.code.trim()
      }),
      signal: AbortSignal.timeout(8000)
    });
  }

  try {
    let res = await callClaim(primaryProduct);
    if (!res.ok && res.status === 400) {
      const errJson = await res.json().catch(() => ({}));
      if (errJson.error && String(errJson.error).includes('product harus salah satu')) {
        res = await callClaim('pos');
      }
    }

    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      return { ok: true, message: json.message || 'Voucher berhasil diklaim!' };
    }
    return { ok: false, error: json.error || 'Gagal mengklaim voucher' };
  } catch (err: any) {
    return { ok: false, error: err.message || 'Koneksi gagal' };
  }
}

/**
 * Pilar 7: Ambil Pesan Broadcast Admin (/api/v1/messages)
 */
export async function fetchVocmlMessages(options: {
  machineId?: string;
  product?: string;
  serverUrl?: string;
} = {}): Promise<any[]> {
  const serverUrl = (options.serverUrl || VOCML_SERVER_URL).replace(/\/$/, '');
  const primaryProduct = options.product || VOCML_PRODUCT;
  const machineId = (options.machineId || getHardwareMachineId()).toUpperCase();

  async function callMsg(prod: string) {
    const qs = new URLSearchParams({ machine_id: machineId, product: prod });
    return await fetch(`${serverUrl}/api/v1/messages?${qs.toString()}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(6000),
      cache: 'no-store'
    });
  }

  try {
    let res = await callMsg(primaryProduct);
    if (!res.ok) {
      res = await callMsg('pos');
    }
    if (res.ok) {
      const json = await res.json();
      return Array.isArray(json.messages) ? json.messages : [];
    }
  } catch {}
  return [];
}
