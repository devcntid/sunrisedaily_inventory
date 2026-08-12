import { NextRequest, NextResponse } from 'next/server';

import { getSalesSummary, getSalesHistory } from '@/lib/queries/sales-transactions';
import { getLastSyncTime } from '@/lib/queries/moka_transactions';
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN_OUTLET' || !session.outletId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const outletId = session.outletId;
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    if (!dateFrom || !dateTo) {
      return NextResponse.json({ error: 'Missing date parameters' }, { status: 400 });
    }

    const data = await getSalesSummary(Number(outletId), dateFrom, dateTo);
    const history = await getSalesHistory(Number(outletId), dateFrom, dateTo);
    
    // Get last sync time for the outlet
    const lastSync = await getLastSyncTime(Number(outletId));

    return NextResponse.json({ success: true, data, history, lastSync });
  } catch (error: unknown) {
    console.error('[GET /api/sales-transactions/summary] Error:', error);
    return NextResponse.json({ success: false, error: (error instanceof Error ? error.message : 'Unknown error') }, { status: 500 });
  }
}
