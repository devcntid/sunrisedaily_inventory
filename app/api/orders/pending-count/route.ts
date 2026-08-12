import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPendingOrderCount } from '@/lib/queries/orders';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') {
    return NextResponse.json({ success: false, message: 'Forbidden', count: 0 }, { status: 403 });
  }

  try {
    const count = await getPendingOrderCount();
    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error('Failed to fetch pending order count:', error);
    return NextResponse.json({ success: false, message: 'Server error', count: 0 }, { status: 500 });
  }
}
