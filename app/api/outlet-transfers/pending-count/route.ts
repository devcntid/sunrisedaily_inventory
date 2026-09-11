import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPendingTransfersCount } from '@/lib/queries/outlet-transfers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN_PUSAT') {
      return NextResponse.json({ success: false, message: 'Forbidden', count: 0 }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const since = searchParams.get('since');

    const count = await getPendingTransfersCount(since);
    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error('Failed to fetch pending outlet transfers count:', error);
    return NextResponse.json({ success: false, message: 'Server error', count: 0 }, { status: 500 });
  }
}
