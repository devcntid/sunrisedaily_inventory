import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDeliveryNoteIssues } from '@/lib/queries/delivery-notes';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const status = req.nextUrl.searchParams.get('status') || undefined;
    const issues = await getDeliveryNoteIssues(status);
    return NextResponse.json(issues);
  } catch (error: unknown) {
    return NextResponse.json({ error: (error instanceof Error ? error.message : 'Unknown error') }, { status: 500 });
  }
}
