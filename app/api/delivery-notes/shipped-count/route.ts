import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getShippedDeliveryNoteCount } from '@/lib/queries/delivery-notes';
import { getPendingReceivingTransfersCount } from '@/lib/queries/outlet-transfers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized', count: 0 }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const since = searchParams.get('since');
    const paramOutletId = searchParams.get('outlet_id');

    const outletId = session.role === 'ADMIN_OUTLET' ? session.outletId : (paramOutletId ? Number(paramOutletId) : undefined);
    if (!outletId) {
      return NextResponse.json({ success: true, count: 0 });
    }

    const [notesCount, transfersCount] = await Promise.all([
      getShippedDeliveryNoteCount(outletId, since),
      getPendingReceivingTransfersCount(outletId, since),
    ]);

    const totalCount = (notesCount || 0) + (transfersCount || 0);

    return NextResponse.json({
      success: true,
      count: totalCount,
      notes_count: notesCount,
      transfers_count: transfersCount,
    });
  } catch (error) {
    console.error('Failed to fetch shipped count:', error);
    return NextResponse.json({ success: false, message: 'Server error', count: 0 }, { status: 500 });
  }
}
