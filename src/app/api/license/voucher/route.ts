import { NextResponse } from 'next/server';
import { claimVoucherCode, queryLicenseServer } from '@/lib/vocml-license';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const code = String(body.code || '').trim();
    if (!code) {
      return NextResponse.json({ ok: false, error: 'Kode voucher wajib diisi' }, { status: 400 });
    }

    const result = await claimVoucherCode({ code });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error || 'Voucher tidak valid' }, { status: 400 });
    }

    // Refresh status lisensi setelah voucher sukses
    const refreshed = await queryLicenseServer({ timeoutMs: 5000 });

    return NextResponse.json({
      ok: true,
      message: result.message || 'Voucher berhasil diklaim dan lisensi aktif!',
      license: refreshed
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || 'Gagal memproses klaim voucher' },
      { status: 500 }
    );
  }
}
