import { NextResponse } from 'next/server';
import { getUnreadLocalPurchaseCount } from '@/lib/queries/local-purchases';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN_PUSAT') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const count = await getUnreadLocalPurchaseCount();
    return NextResponse.json({ success: true, count });
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json({ success: false, message: (err instanceof Error ? err.message : 'Unknown error') }, { status: 500 });
  }
}
