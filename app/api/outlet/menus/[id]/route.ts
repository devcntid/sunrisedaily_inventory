import { NextResponse } from 'next/server';
import { getOutletMenuDetail } from '@/lib/queries/outlet-menus';
import { getSession } from '@/lib/auth';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN_OUTLET' || !session.outletId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const menuId = parseInt(id, 10);
    const outletId = session.outletId;

    const result = await getOutletMenuDetail(outletId, menuId);
    if (!result) {
      return NextResponse.json({ error: 'Menu not found or not accessible for this outlet' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error('Error fetching menu detail:', err);
    return NextResponse.json({ error: (err instanceof Error ? err.message : 'Unknown error') }, { status: 500 });
  }
}
