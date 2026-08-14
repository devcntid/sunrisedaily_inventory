import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const outletId = searchParams.get('outlet_id');
  const deliveryDate = searchParams.get('date');

  if (!outletId || !deliveryDate) {
    return NextResponse.json({ success: false, message: 'outlet_id and date are required' }, { status: 400 });
  }

  try {
    const res = await query(
      `SELECT delivery_note_number, status FROM delivery_notes 
       WHERE outlet_id = $1 AND delivery_date = $2 
       AND status IN ('DRAFT', 'DIKIRIM')
       LIMIT 1`,
      [outletId, deliveryDate]
    );

    if (res.rowCount && res.rowCount > 0) {
      return NextResponse.json({ 
        success: true, 
        hasDuplicate: true, 
        existingNote: res.rows[0]
      });
    }

    return NextResponse.json({ success: true, hasDuplicate: false });
  } catch (err: unknown) {
    console.error('Error checking duplicate DO:', err);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
