import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { cancelDeliveryNote } from '@/lib/queries/delivery-notes';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized', data: null }, { status: 401 });

  const { id } = await params;

  if (session.role !== 'ADMIN_PUSAT') {
    return NextResponse.json({ success: false, message: 'Forbidden', data: null }, { status: 403 });
  }

  try {
    const result = await cancelDeliveryNote(Number(id));
    return NextResponse.json({ success: true, message: 'Delivery Order has been canceled', data: result });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, message: (e instanceof Error ? e.message : 'Unknown error') || 'Failed to cancel', data: null }, { status: 500 });
  }
}
