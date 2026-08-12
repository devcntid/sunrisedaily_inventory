import { NextRequest, NextResponse } from 'next/server';
import { getHppRecipes, getHppKitchenSummary, createRecipe } from '@/lib/queries/hpp';
import { getOutletHppRecipes, getOutletHppKitchenSummary } from '@/lib/queries/outlet-menus';
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const venueId = searchParams.get('venue_id');
  const search = searchParams.get('search') ?? undefined;
  const tab = searchParams.get('tab') ?? 'list';
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const limit = parseInt(searchParams.get('limit') ?? '50', 10);
  const offset = (page - 1) * limit;

  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const isOutlet = session?.role === 'ADMIN_OUTLET' && session.outletId;

    if (tab === 'kitchen') {
      const data = isOutlet ? await getOutletHppKitchenSummary(session.outletId as number) : await getHppKitchenSummary();
      return NextResponse.json({ data });
    }

    const result = isOutlet
      ? await getOutletHppRecipes(session.outletId as number, {
          venueId: venueId ? parseInt(venueId) : undefined,
          search,
          limit,
          offset,
        })
      : await getHppRecipes({
          venueId: venueId ? parseInt(venueId) : undefined,
          search,
          limit,
          offset,
        });

    return NextResponse.json({
      data: result.data,
      total: result.total,
      page,
      limit,
    });
  } catch (err) {
    console.error('[GET /api/hpp/recipes] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const data = await request.json();
    const recipeId = await createRecipe(data);
    return NextResponse.json({ success: true, recipeId });
  } catch (err: unknown) {
    console.error('[POST /api/hpp/recipes] Error:', err);
    return NextResponse.json({ error: (err instanceof Error ? err.message : 'Unknown error') }, { status: 500 });
  }
}
