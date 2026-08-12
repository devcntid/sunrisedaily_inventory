import { NextRequest, NextResponse } from 'next/server';
import { resolveDeliveryNoteIssue } from '@/lib/queries/delivery-notes';
import { getSession } from '@/lib/auth';

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const user = await getSession();
    if (!user || user.role !== 'ADMIN_PUSAT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, notes } = await req.json();
    if (action !== 'REPLACE' && action !== 'WRITE_OFF') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const result = await resolveDeliveryNoteIssue(Number(params.id), action, user.userId, notes || '');
    
    return NextResponse.json({ success: true, new_dn_id: result?.new_dn_id });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error instanceof Error ? error.message : 'Unknown error') }, { status: 500 });
  }
}
