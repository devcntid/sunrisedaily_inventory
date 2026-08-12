import { NextRequest, NextResponse } from 'next/server';
import { getTransactionDetail } from '@/lib/queries/sales-transactions';
import { getSession } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: 'Missing transaction ID' }, { status: 400 });
    }

    const detail = await getTransactionDetail(id);
    if (!detail) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: detail });
  } catch (error: unknown) {
    console.error('[GET /api/sales-transactions/detail/[id]] Error:', error);
    return NextResponse.json({ success: false, error: (error instanceof Error ? error.message : 'Unknown error') }, { status: 500 });
  }
}
