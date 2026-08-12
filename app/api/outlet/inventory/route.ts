import { NextRequest, NextResponse } from 'next/server';
import { getOutletStocks } from '@/lib/queries/outlet-inventory';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.outletId) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const data = await getOutletStocks(session.outletId);
    
    // Fix numeric parsing from PG
    const serializedData = data.map(d => ({
      ...d,
      current_balance: Number(d.current_balance),
      target_stock: Number(d.target_stock ?? 0),
      minimum_threshold: d.minimum_threshold ? Number(d.minimum_threshold) : null
    }));

    return NextResponse.json({ success: true, data: serializedData });
  } catch (error: unknown) {
    console.error('[GET /api/outlet/inventory] Error:', error);
    return NextResponse.json({ success: false, message: (error instanceof Error ? error.message : 'Unknown error') }, { status: 500 });
  }
}
