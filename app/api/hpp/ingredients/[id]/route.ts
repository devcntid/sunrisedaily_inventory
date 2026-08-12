import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { updateIngredient, deleteIngredient } from '@/lib/queries/hpp';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const resolvedParams = await params;
  try {
    const id = parseInt(resolvedParams.id, 10);
    const data = await request.json();
    await updateIngredient(id, data);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error(`[PUT /api/hpp/ingredients/${resolvedParams.id}] Error:`, err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const resolvedParams = await params;
  try {
    const id = parseInt(resolvedParams.id, 10);
    await deleteIngredient(id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error(`[DELETE /api/hpp/ingredients/${resolvedParams.id}] Error:`, err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
