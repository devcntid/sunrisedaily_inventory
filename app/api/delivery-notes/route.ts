import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDeliveryNotes, createDeliveryNote } from '@/lib/queries/delivery-notes';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized', data: null }, { status: 401 });
  
  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get('page') || '1');
  const limit = Number(searchParams.get('limit') || '20');
  const offset = (page - 1) * limit;

  const notes = await getDeliveryNotes({
    outletId: session.role === 'ADMIN_OUTLET' ? session.outletId! : (searchParams.get('outlet_id') ? Number(searchParams.get('outlet_id')) : undefined),
    status: searchParams.get('status') ?? undefined,
    orderId: searchParams.get('order_id') ? Number(searchParams.get('order_id')) : undefined,
    search: searchParams.get('search') ?? undefined,
    limit,
    offset
  });

  return NextResponse.json({ success: true, message: 'OK', data: notes.data, total: notes.total, page, limit });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') return NextResponse.json({ success: false, message: 'Forbidden', data: null }, { status: 403 });
  const body = await req.json();
  const dn = await createDeliveryNote(body);
  return NextResponse.json({ success: true, message: 'Surat Jalan berhasil dibuat', data: dn }, { status: 201 });
}
