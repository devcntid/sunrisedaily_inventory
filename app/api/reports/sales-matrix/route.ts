import { NextResponse } from 'next/server';
import { getProductSalesMatrix } from '@/lib/queries/sales-transactions';
import { getOutlets } from '@/lib/queries/master';
import { getMenuCategories } from '@/lib/queries/hpp';
import { getSession } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN_PUSAT') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const categoryId = searchParams.get('categoryId') ? parseInt(searchParams.get('categoryId') as string) : undefined;
    const search = searchParams.get('search') || undefined;

    if (!dateFrom || !dateTo) {
      return NextResponse.json({ success: false, message: 'Date range is required' }, { status: 400 });
    }

    const [matrix, outlets, categoriesRes] = await Promise.all([
      getProductSalesMatrix(dateFrom, dateTo, categoryId, search),
      getOutlets(),
      getMenuCategories(),
    ]);

    // Format the columns based on outlets
    const outletColumns = outlets
      .filter((o) => o.type !== 'CENTRAL_KITCHEN' && o.type !== 'SUPPLIER')
      .map((o) => ({ id: o.id, name: o.name }));

    return NextResponse.json({
      success: true,
      data: {
        matrix,
        outletColumns,
        categories: categoriesRes,
      },
    });
  } catch (error: unknown) {
    console.error('Error fetching product sales matrix:', error);
    return NextResponse.json({ success: false, message: (error instanceof Error ? error.message : 'Unknown error') }, { status: 500 });
  }
}
