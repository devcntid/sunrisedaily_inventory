import { NextResponse } from 'next/server';
import { markAllLocalPurchasesRead } from '@/lib/queries/local-purchases';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN_PUSAT') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    await markAllLocalPurchasesRead();
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json({ success: false, message: (err instanceof Error ? err.message : 'Unknown error') }, { status: 500 });
  }
}
