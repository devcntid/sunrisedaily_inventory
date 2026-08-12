import { NextRequest, NextResponse } from 'next/server';
import { getHppMenus, getHppVenues, getHppCategories, getHppVsSale } from '@/lib/queries/hpp';
import { getOutletHppMenus, getOutletHppCategories, getOutletHppVenues } from '@/lib/queries/outlet-menus';
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tab = searchParams.get('tab') ?? 'menus'; // menus | margin
  const categoryId = searchParams.get('category_id');
  const marginFlag = searchParams.get('margin_flag');
  const search = searchParams.get('search') ?? undefined;
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const limit = parseInt(searchParams.get('limit') ?? '50', 10);
  const offset = (page - 1) * limit;

  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const isOutlet = session?.role === 'ADMIN_OUTLET' && session.outletId;

    if (tab === 'margin') {
      const data = await getHppVsSale({
        marginFlag: marginFlag ?? undefined,
        category: categoryId ? categoryId : undefined,
      });
      return NextResponse.json({ data });
    }

    const menusPromise = isOutlet 
      ? getOutletHppMenus(session.outletId as number, {
          categoryName: categoryId ? categoryId : undefined,
          marginFlag: marginFlag ?? undefined,
          search,
          limit,
          offset,
        })
      : getHppMenus({
          categoryId: categoryId ? Number(categoryId) : undefined,
          marginFlag: marginFlag ?? undefined,
          search,
          limit,
          offset,
        });

    const [menusResult, venues, rawCategories] = await Promise.all([
      menusPromise,
      isOutlet ? getOutletHppVenues(session.outletId as number) : getHppVenues(),
      isOutlet ? getOutletHppCategories(session.outletId as number) : getHppCategories(),
    ]);

    const categories = isOutlet ? rawCategories : rawCategories.map((c: any) => ({ id: c.id, name: c.name }));

    return NextResponse.json({
      data: menusResult.data,
      total: menusResult.total,
      page,
      limit,
      venues,
      categories,
    });
  } catch (err) {
    console.error('[GET /api/hpp] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
