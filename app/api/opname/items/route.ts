import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getItemsForOpname } from '@/lib/queries/opname';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized', data: null }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const locationType = searchParams.get('location_type') ?? 'PUSAT';
  const locationIdParam = searchParams.get('location_id');
  const locationId = locationIdParam ? parseInt(locationIdParam, 10) : undefined;
  
  const items = await getItemsForOpname(locationType, locationId);
  return NextResponse.json({ success: true, message: 'OK', data: items });
}
