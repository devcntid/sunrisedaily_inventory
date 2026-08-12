import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPurchaseOrderById, updatePurchaseOrderStatus } from '@/lib/queries/purchase-orders';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') return NextResponse.json({ success: false, message: 'Forbidden', data: null }, { status: 403 });
  const { id } = await params;
  const po = await getPurchaseOrderById(Number(id));
  if (!po) return NextResponse.json({ success: false, message: 'PO tidak ditemukan', data: null }, { status: 404 });
  return NextResponse.json({ success: true, message: 'OK', data: po });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') return NextResponse.json({ success: false, message: 'Forbidden', data: null }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const po = await updatePurchaseOrderStatus(Number(id), body.status, session.userId || 1);
  return NextResponse.json({ success: true, message: 'Status PO diperbarui', data: po });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') return NextResponse.json({ success: false, message: 'Forbidden', data: null }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const { updatePurchaseOrder } = await import('@/lib/queries/purchase-orders');
  try {
    const po = await updatePurchaseOrder(Number(id), body);
    return NextResponse.json({ success: true, message: 'PO diperbarui', data: po });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, message: (error instanceof Error ? error.message : 'Unknown error'), data: null }, { status: 500 });
  }
}
