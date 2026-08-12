import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUnresolvedAlertCount } from '@/lib/queries/alerts';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') {
    return NextResponse.json({ success: false, message: 'Forbidden', count: 0 }, { status: 403 });
  }

  const count = await getUnresolvedAlertCount();
  return NextResponse.json({ success: true, count });
}
