export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getAvailableTransferStock } from '@/lib/queries/outlet-transfers';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const sourceOutletId = searchParams.get('source_outlet_id');

    if (!sourceOutletId) {
      return NextResponse.json({ success: false, message: 'Source outlet ID is required.' }, { status: 400 });
    }

    const items = await getAvailableTransferStock(Number(sourceOutletId));
    return NextResponse.json({ success: true, data: items });
  } catch (error: unknown) {
    console.error('Error fetching available transfer stock:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
