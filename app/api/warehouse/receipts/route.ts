import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createGoodsReceipt } from '@/lib/queries/warehouse-receipts';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized', data: null }, { status: 401 });
  
  try {
    const body = await req.json();
    const receipt = await createGoodsReceipt({
      purchase_order_id: body.purchase_order_id,
      vendor_delivery_note: body.vendor_delivery_note,
      received_by: session.userId,
      received_date: body.received_date,
      items: body.items,
    });
    
    return NextResponse.json({ success: true, message: 'Penerimaan berhasil', data: receipt });
  } catch (error: unknown) {
    console.error('Goods Receipt Error:', error);
    return NextResponse.json({ success: false, message: (error instanceof Error ? error.message : 'Unknown error') || 'Terjadi kesalahan server', data: null }, { status: 500 });
  }
}
