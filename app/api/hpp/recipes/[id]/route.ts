import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getHppRecipeDetail, updateRecipe, deleteRecipe } from '@/lib/queries/hpp';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const resolvedParams = await params;
  try {
    const id = parseInt(resolvedParams.id, 10);
    const data = await getHppRecipeDetail(id);
    if (!data.recipe) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error(`[GET /api/hpp/recipes/${resolvedParams.id}] Error:`, err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const resolvedParams = await params;
  try {
    const id = parseInt(resolvedParams.id, 10);
    const data = await request.json();
    await updateRecipe(id, data);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error(`[PUT /api/hpp/recipes/${resolvedParams.id}] Error:`, err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const resolvedParams = await params;
  try {
    const id = parseInt(resolvedParams.id, 10);
    await deleteRecipe(id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error(`[DELETE /api/hpp/recipes/${resolvedParams.id}] Error:`, err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
