import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getActiveRequestedItemIds } from '@/lib/queries/orders';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !session.outletId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const activeItemIds = await getActiveRequestedItemIds(session.outletId);

    return NextResponse.json({ success: true, data: activeItemIds });
  } catch (err: unknown) {
    console.error('Error fetching active requested items:', err);
    return NextResponse.json({ success: false, message: (err instanceof Error ? err.message : 'Unknown error') }, { status: 500 });
  }
}
