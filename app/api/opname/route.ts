import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createStockCountSession, getStockCountHeaders } from '@/lib/queries/opname';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized', data: null }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const rows = await getStockCountHeaders({
    locationType: searchParams.get('location_type') ?? undefined,
    locationId: searchParams.get('location_id') ? Number(searchParams.get('location_id')) : undefined,
  });
  return NextResponse.json({ success: true, message: 'OK', data: rows });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized', data: null }, { status: 401 });
  const body = await req.json();
  const header = await createStockCountSession({
    location_type: body.location_type,
    location_id: body.location_id ?? undefined,
    count_date: body.count_date ?? new Date().toISOString().split('T')[0],
    pic_id: session.userId,
    general_notes: body.general_notes ?? undefined,
  });
  return NextResponse.json({ success: true, message: 'Sesi opname dibuat', data: header }, { status: 201 });
}
