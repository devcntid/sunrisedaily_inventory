import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPriceHistory } from '@/lib/queries/inventory';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') return NextResponse.json({ success: false, message: 'Forbidden', data: null }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const rows = await getPriceHistory({
    itemId: searchParams.get('item_id') ? Number(searchParams.get('item_id')) : undefined,
    vendorId: searchParams.get('vendor_id') ? Number(searchParams.get('vendor_id')) : undefined,
    limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 100,
  });
  return NextResponse.json({ success: true, message: 'OK', data: rows });
}
