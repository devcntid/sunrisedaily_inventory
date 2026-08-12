import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPurchaseOrders, createPurchaseOrder } from '@/lib/queries/purchase-orders';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') return NextResponse.json({ success: false, message: 'Forbidden', data: null }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const pos = await getPurchaseOrders({
    status: searchParams.get('status') ?? undefined,
    vendorId: searchParams.get('vendor_id') ? Number(searchParams.get('vendor_id')) : undefined,
  });
  return NextResponse.json({ success: true, message: 'OK', data: pos });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') return NextResponse.json({ success: false, message: 'Forbidden', data: null }, { status: 403 });
  const body = await req.json();
  try {
    const po = await createPurchaseOrder({
      ...body,
      buyer_id: session.userId,
      created_by: session.userId,
    });
    return NextResponse.json({ success: true, message: 'Purchase Order berhasil dibuat', data: po }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, message: (error instanceof Error ? error.message : 'Unknown error') || 'Internal Server Error', data: null }, { status: 500 });
  }
}
