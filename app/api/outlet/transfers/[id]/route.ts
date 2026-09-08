export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getOutletTransferDetail } from '@/lib/queries/outlet-transfers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const transferId = Number(id);

    if (isNaN(transferId)) {
      return NextResponse.json({ success: false, message: 'ID mutasi tidak valid.' }, { status: 400 });
    }

    const data = await getOutletTransferDetail(transferId);

    if (!data.transfer) {
      return NextResponse.json({ success: false, message: 'Data mutasi tidak ditemukan.' }, { status: 404 });
    }

    // If role is ADMIN_OUTLET, ensure user belongs to from_outlet or to_outlet
    if (session.role === 'ADMIN_OUTLET' && session.outletId) {
      const userOutletId = Number(session.outletId);
      if (data.transfer.from_outlet_id !== userOutletId && data.transfer.to_outlet_id !== userOutletId) {
        return NextResponse.json({ success: false, message: 'Akses ditolak.' }, { status: 403 });
      }
    }

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error('Error fetching transfer detail:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
