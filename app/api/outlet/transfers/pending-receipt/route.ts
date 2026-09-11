export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getApprovedTransfersForReceiving } from '@/lib/queries/outlet-transfers';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    let outletId: number | undefined;

    if (session.outletId) {
      outletId = Number(session.outletId);
    } else if (session.role === 'ADMIN_OUTLET') {
      outletId = Number(session.outletId);
    } else {
      const qOutletId = searchParams.get('outlet_id');
      if (qOutletId) outletId = Number(qOutletId);
    }

    const data = await getApprovedTransfersForReceiving(outletId);

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error('Error fetching pending receipt transfers:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
