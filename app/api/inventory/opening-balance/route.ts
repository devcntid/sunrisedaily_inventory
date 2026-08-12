import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { setOpeningBalance } from '@/lib/queries/inventory';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { items } = await req.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, message: 'Data stok kosong' }, { status: 400 });
    }

    const result = await setOpeningBalance(items);

    return NextResponse.json({
      success: true,
      message: `Saldo awal berhasil diset: ${result.processed} item diproses, ${result.skipped} item dilewati (tidak ada perubahan).`,
      data: result,
    });
  } catch (err: unknown) {
    console.error('Opening Balance Error:', err);
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Terjadi kesalahan pada server' },
      { status: 500 }
    );
  }
}
