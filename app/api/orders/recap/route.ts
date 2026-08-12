export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getOrderRecap, getOrderById } from '@/lib/queries/orders';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const order_id = searchParams.get('order_id');
  
  if (order_id) {
    const orderData = await getOrderById(Number(order_id));
    return NextResponse.json({ success: true, message: 'OK', data: orderData ? orderData.items : [] });
  }

  const outletId = session.role === 'ADMIN_OUTLET' ? session.outletId! : (searchParams.get('outlet_id') ? Number(searchParams.get('outlet_id')) : undefined);
  const status = searchParams.get('status') ?? undefined;

  const recap = await getOrderRecap({ status, outletId });
  return NextResponse.json({ success: true, message: 'OK', data: recap });
}
