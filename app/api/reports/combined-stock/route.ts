import { NextResponse } from 'next/server';
import { getCombinedStockReport, getActiveOutlets } from '@/lib/queries/inventory';
import { getSession } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN_PUSAT') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    
    const [rows, outlets] = await Promise.all([
      getCombinedStockReport(search),
      getActiveOutlets()
    ]);
    
    return NextResponse.json({ success: true, data: rows, outlets });
  } catch (error: unknown) {
    console.error('Error fetching combined stock:', error);
    return NextResponse.json({ success: false, message: 'Gagal mengambil data report stok gabungan' }, { status: 500 });
  }
}
