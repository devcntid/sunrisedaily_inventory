import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getMenuDetail, updateMenuPrice, deleteMenu } from '@/lib/queries/hpp';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN_PUSAT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const menuId = parseInt(id, 10);

    const result = await getMenuDetail(menuId);
    if (!result) return NextResponse.json({ error: 'Menu not found' }, { status: 404 });

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error('Error fetching menu detail:', err);
    return NextResponse.json({ error: (err instanceof Error ? err.message : 'Unknown error') }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN_PUSAT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const menuId = parseInt(id, 10);
    const { sale_price } = await req.json();

    if (typeof sale_price !== 'number') {
      return NextResponse.json({ error: 'Invalid sale_price' }, { status: 400 });
    }

    await updateMenuPrice(menuId, sale_price);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Error updating master menu price:', err);
    return NextResponse.json({ error: (err instanceof Error ? err.message : 'Unknown error') }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN_PUSAT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const menuId = parseInt(id, 10);

    await deleteMenu(menuId);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Error deleting menu:', err);
    return NextResponse.json({ error: (err instanceof Error ? err.message : 'Unknown error') }, { status: 500 });
  }
}
