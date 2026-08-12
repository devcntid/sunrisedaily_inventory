import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createDirectPurchase, getDirectPurchases, DirectPurchaseInput } from '@/lib/queries/direct_purchases';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return new NextResponse('Unauthorized', { status: 401 });

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date') || undefined;
    const endDate = searchParams.get('end_date') || undefined;

    const data = await getDirectPurchases({ startDate, endDate });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching direct purchases:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) return new NextResponse('Unauthorized', { status: 401 });

    const body = await request.json();
    
    if (!body.items || body.items.length === 0) {
      return new NextResponse('Items cannot be empty', { status: 400 });
    }

    const payload: DirectPurchaseInput = {
      receipt_number: body.receipt_number,
      notes: body.notes,
      created_by: session.userId,
      total_amount: body.total_amount,
      items: body.items.map((i: any) => ({
        item_id: Number(i.item_id),
        brand_id: i.brand_id ? Number(i.brand_id) : null,
        shop_name: String(i.shop_name),
        qty: Number(i.qty),
        unit: String(i.unit),
        unit_price: Number(i.unit_price),
        subtotal: Number(i.subtotal),
        smallest_qty: Number(i.smallest_qty)
      }))
    };

    const id = await createDirectPurchase(payload);
    return NextResponse.json({ id });
  } catch (error: any) {
    console.error('Error creating direct purchase:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
