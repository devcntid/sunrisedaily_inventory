import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getOutletMenus } from '@/lib/queries/outlet-menus';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN_OUTLET' || !session.outletId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const recipes = await getOutletMenus(session.outletId);

    return NextResponse.json({ recipes });
  } catch (error: unknown) {
    console.error('Error fetching outlet menus:', error);
    return NextResponse.json({ error: (error instanceof Error ? error.message : 'Unknown error') }, { status: 500 });
  }
}
