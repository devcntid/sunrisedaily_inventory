import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getAlerts, resolveAlert } from '@/lib/queries/alerts';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') return NextResponse.json({ success: false, message: 'Forbidden', data: null }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const resolved = searchParams.get('resolved');
  const alerts = await getAlerts({ resolved: resolved === 'true' ? true : resolved === 'false' ? false : false });
  return NextResponse.json({ success: true, message: 'OK', data: alerts });
}
