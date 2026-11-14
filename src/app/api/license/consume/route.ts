import { NextResponse } from 'next/server';
import { consumeTrialQuota } from '@/lib/vocml-license';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const quantity = Number(body.quantity) || 1;
    const result = await consumeTrialQuota({ quantity });

    if (!result.ok && result.status === 403) {
      return NextResponse.json(
        {
          ok: false,
          allowed: false,
          error: result.message || 'Kuota transaksi Anda telah habis! Silakan perpanjang lisensi untuk melanjutkan operasional.',
          remaining: 0
        },
        { status: 403 }
      );
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || 'Gagal memproses kuota lisensi' },
      { status: 500 }
    );
  }
}
