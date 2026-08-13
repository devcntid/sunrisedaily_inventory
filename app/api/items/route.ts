export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getItems, createItem, generateBarcode, createItemWithBrands } from '@/lib/queries/items';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized', data: null }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const items = await getItems({
    categoryId: searchParams.get('category_id') ?? undefined,
    search: searchParams.get('search') ?? undefined,
    activeOnly: searchParams.get('active_only') !== 'false',
    parentOnly: searchParams.get('parent_only') === 'true', // Hanya Induk (untuk monitoring stok & opname)
    parentId: searchParams.has('parent_id') ? Number(searchParams.get('parent_id')) : undefined,
  });
  return NextResponse.json({ success: true, message: 'OK', data: items });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') {
    return NextResponse.json({ success: false, message: 'Forbidden', data: null }, { status: 403 });
  }

  const body = await req.json();
  const { name, category_id, purchase_unit, smallest_unit, conversion_ratio, minimum_threshold, target_stock, threshold_type, is_perishable, current_average_price, ingredient_id } = body;

  if (!name || !String(name).trim() || !category_id || !purchase_unit || !smallest_unit) {
    return NextResponse.json({ success: false, message: 'Field wajib tidak lengkap', data: null }, { status: 400 });
  }

  try {
    const itemData = {
      name, category_id: Number(category_id), purchase_unit, smallest_unit,
      conversion_ratio: Number(conversion_ratio ?? 1),
      minimum_threshold: Number(minimum_threshold ?? 0),
      target_stock: Number(target_stock ?? 0),
      threshold_type: threshold_type ?? 'ABSOLUT',
      is_perishable: is_perishable === true || is_perishable === 'true',
      barcode: body.barcode ? String(body.barcode) : undefined,
      current_average_price: Number(current_average_price ?? 0),
      ingredient_id: ingredient_id ? Number(ingredient_id) : null,
      is_split_allowed: body.is_split_allowed === true || body.is_split_allowed === 'true',
      min_order_qty: Number(body.min_order_qty ?? 1),
      order_multiple: Number(body.order_multiple ?? 1),
      is_global: body.is_global !== false && body.is_global !== 'false', // default true
      venue_ids: Array.isArray(body.venue_ids) ? body.venue_ids.map(Number) : [],
    };

    let item;
    if (body.brands && Array.isArray(body.brands) && body.brands.length > 0) {
      item = await createItemWithBrands(itemData, body.brands);
    } else {
      item = await createItem(itemData);

      // Auto-generate barcode if no brands and no barcode
      if (!item.barcode) {
        await generateBarcode(item.id);
        item.barcode = `ERC${String(item.id).padStart(6, '0')}`;
      }
    }

    return NextResponse.json({ success: true, message: 'Item berhasil ditambahkan', data: item }, { status: 201 });
  } catch (error: unknown) {
    const pgError = error as { code?: string; message?: string };
    if (pgError.code === '23505') {
      return NextResponse.json({ success: false, message: 'Gagal menambahkan: Barcode sudah digunakan oleh barang lain.', data: null }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: 'Gagal menambahkan: ' + (error instanceof Error ? error.message : 'Unknown error'), data: null }, { status: 500 });
  }
}
