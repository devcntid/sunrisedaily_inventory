import { NextResponse } from 'next/server';
import { getHppStats } from '@/lib/queries/hpp';
import { getOutletHppStats } from '@/lib/queries/outlet-menus';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (session.role === 'ADMIN_OUTLET' && session.outletId) {
      const stats = await getOutletHppStats(session.outletId);
      return NextResponse.json(stats);
    }

    const stats = await getHppStats();
    return NextResponse.json(stats);
  } catch (err) {
    console.error('[GET /api/hpp/stats] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

