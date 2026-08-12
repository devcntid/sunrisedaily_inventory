import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getOrders, createOrder, getActiveRequestedItemIds } from '@/lib/queries/orders';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized', data: null }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const orders = await getOrders({
    outletId: session.role === 'ADMIN_OUTLET' ? session.outletId! : (searchParams.get('outlet_id') ? Number(searchParams.get('outlet_id')) : undefined),
    status: searchParams.get('status') ?? undefined,
    startDate: searchParams.get('start_date') ?? undefined,
    endDate: searchParams.get('end_date') ?? undefined,
    limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
    offset: searchParams.get('offset') ? Number(searchParams.get('offset')) : undefined,
  });
  return NextResponse.json({ success: true, message: 'OK', data: orders });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_OUTLET') {
    return NextResponse.json({ success: false, message: 'Hanya Admin Outlet yang dapat membuat permintaan', data: null }, { status: 403 });
  }

  const body = await req.json();
  const { order_date, delivery_date, items } = body;

  if (!delivery_date || !items?.length) {
    return NextResponse.json({ success: false, message: 'Data tidak lengkap', data: null }, { status: 400 });
  }

  // Double-check validation against active items to prevent bypass
  try {
    const activeIds = await getActiveRequestedItemIds(session.outletId!);
    const duplicateItems = items.filter((i: { item_id: string | number }) => activeIds.includes(Number(i.item_id)));


    if (duplicateItems.length > 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'Beberapa barang masih dalam pesanan aktif (belum selesai). Hapus dari daftar sebelum melanjutkan.', 
        data: null 
      }, { status: 400 });
    }
  } catch (err) {
    console.error('Error validating active items:', err);
  }

  const order = await createOrder({
    outlet_id: session.outletId!,
    order_date: order_date ?? new Date().toISOString().split('T')[0],
    delivery_date,
    created_by: session.userId,
    items,
  });

  return NextResponse.json({ success: true, message: 'Permintaan berhasil dibuat', data: order }, { status: 201 });
}
