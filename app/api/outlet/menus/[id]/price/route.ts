import { NextResponse } from 'next/server';
import { upsertOutletMenuPrice } from '@/lib/queries/outlet-menus';
import { getSession } from '@/lib/auth';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN_OUTLET' || !session.outletId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const menuId = parseInt(id, 10);
    const body = await req.json();
    const salePrice = parseFloat(body.sale_price);

    if (isNaN(salePrice) || salePrice < 0) {
      return NextResponse.json({ error: 'Invalid price' }, { status: 400 });
    }

    // Upsert the price override
    await upsertOutletMenuPrice(session.outletId, menuId, salePrice);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Error overriding menu price:', err);
    return NextResponse.json({ error: (err instanceof Error ? err.message : 'Unknown error') }, { status: 500 });
  }
}
