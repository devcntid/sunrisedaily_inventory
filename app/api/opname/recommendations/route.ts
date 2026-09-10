import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getTopUsageItemsByOutlet } from '@/lib/queries/opname';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized', data: null }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const outletIdParam = searchParams.get('outlet_id');
  
  const outletId = outletIdParam ? parseInt(outletIdParam, 10) : (session.outletId ?? null);
  if (!outletId) {
    return NextResponse.json({ success: false, message: 'Outlet ID is required', data: [] }, { status: 400 });
  }

  const days = searchParams.get('days') ? parseInt(searchParams.get('days')!, 10) : 30;
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 10;

  const items = await getTopUsageItemsByOutlet(outletId, days, limit);
  return NextResponse.json({ success: true, message: 'OK', data: items });
}
