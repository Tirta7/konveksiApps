import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    // Dynamic import to avoid bundling issues in edge/serverless if applicable
    const { licenseStatus, runLicenseVerification } = await import('@/license.mjs');
    const { searchParams } = new URL(request.url);
    if (searchParams.get('refresh') === '1') {
      await runLicenseVerification();
    }
    const { serverUrl, ...safe } = licenseStatus;
    return NextResponse.json(safe);
  } catch (e: any) {
    return NextResponse.json({
      allowed: false,
      status: 'offline',
      reason: e?.message || 'Gagal memuat status lisensi',
      machineId: process.env.VOCML_MACHINE_ID || 'MID-2201-35AE-22B8'
    });
  }
}

export async function POST() {
  try {
    const { licenseStatus, runLicenseVerification } = await import('@/license.mjs');
    await runLicenseVerification();
    const { serverUrl, ...safe } = licenseStatus;
    return NextResponse.json(safe);
  } catch (e: any) {
    return NextResponse.json({
      allowed: false,
      status: 'offline',
      reason: e?.message || 'Gagal menyinkronkan lisensi',
      machineId: process.env.VOCML_MACHINE_ID || 'MID-2201-35AE-22B8'
    }, { status: 500 });
  }
}
