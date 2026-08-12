import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { updateOrderItemStatus } from '@/lib/queries/orders';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ orderItemId: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') {
    return NextResponse.json({ success: false, message: 'Forbidden', data: null }, { status: 403 });
  }

  const { orderItemId } = await params;
  const body = await req.json();
  const updated = await updateOrderItemStatus(Number(orderItemId), body);
  if (!updated) return NextResponse.json({ success: false, message: 'Item tidak ditemukan', data: null }, { status: 404 });
  return NextResponse.json({ success: true, message: 'Status berhasil diperbarui', data: updated });
}
