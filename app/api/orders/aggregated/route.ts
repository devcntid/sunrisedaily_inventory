import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getAggregatedRequestsByProduct } from '@/lib/queries/orders';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') {
    return NextResponse.json({ success: false, message: 'Forbidden', data: null }, { status: 403 });
  }

  try {
    const status = req.nextUrl.searchParams.get('status') || undefined;
    const startDate = req.nextUrl.searchParams.get('start_date') || undefined;
    const endDate = req.nextUrl.searchParams.get('end_date') || undefined;

    const data = await getAggregatedRequestsByProduct({ status, startDate, endDate });
    return NextResponse.json({ success: true, message: 'OK', data });
  } catch (error: unknown) {
    console.error('Aggregated requests error:', error);
    return NextResponse.json({ success: false, message: (error instanceof Error ? error.message : 'Unknown error'), data: null }, { status: 500 });
  }
}
