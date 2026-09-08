export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getOutletStockComparison } from '@/lib/queries/outlet-transfers';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const itemIdsParam = searchParams.get('item_ids');
    if (!itemIdsParam) {
      return NextResponse.json({ success: true, data: [] });
    }

    const itemIds = itemIdsParam
      .split(',')
      .map(id => Number(id.trim()))
      .filter(id => !isNaN(id) && id > 0);

    const data = await getOutletStockComparison(itemIds);
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error('Error fetching stock comparison:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
