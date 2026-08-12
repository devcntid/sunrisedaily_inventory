import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPendingDeliveryNoteIssuesCount } from '@/lib/queries/delivery-notes';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') {
    return NextResponse.json({ count: 0 });
  }

  const { searchParams } = new URL(request.url);
  const since = searchParams.get('since');

  try {
    const count = await getPendingDeliveryNoteIssuesCount(since);
    return NextResponse.json({ count });
  } catch (error) {
    return NextResponse.json({ count: 0 });
  }
}
