import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { upsertOutletItemSetting } from '@/lib/queries/outlet-inventory';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.outletId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { itemId, minimumThreshold } = await request.json();

    if (!itemId) {
      return NextResponse.json({ error: 'Missing item ID' }, { status: 400 });
    }

    await upsertOutletItemSetting({
      outlet_id: session.outletId,
      item_id: Number(itemId),
      minimum_threshold: minimumThreshold ?? null,
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}
