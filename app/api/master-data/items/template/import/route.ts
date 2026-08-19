import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { upsertItems, type ValidatedItemRow } from '@/lib/queries/item_template';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { data } = body;

    if (!data || !Array.isArray(data)) {
      return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 });
    }

    const rows: ValidatedItemRow[] = data
      .filter((d: { isValid?: boolean; name?: string; category_id?: number }) => d.isValid !== false && d.name && d.category_id)
      .map((d: Record<string, unknown>) => ({
        item_id: d.item_id ? Number(d.item_id) : null,
        name: String(d.name),
        category_id: Number(d.category_id),
        category_name: String(d.category_name ?? ''),
        purchase_unit: String(d.purchase_unit),
        smallest_unit: String(d.smallest_unit),
        conversion_ratio: Number(d.conversion_ratio ?? 1),
        minimum_threshold: Number(d.minimum_threshold ?? 0),
        threshold_type: String(d.threshold_type ?? 'ABSOLUT'),
        target_stock: Number(d.target_stock ?? 0),
        current_average_price: Number(d.current_average_price ?? 0),
        barcode: d.barcode ? String(d.barcode) : null,
        status: String(d.status ?? 'AKTIF'),
        is_perishable: Boolean(d.is_perishable),
      }));

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Tidak ada baris valid untuk diimpor' }, { status: 400 });
    }

    await upsertItems(rows);

    return NextResponse.json({
      success: true,
      message: 'Data barang berhasil di-import',
    });
  } catch (error: unknown) {
    console.error('Error importing item template:', error);
    const pgError = error as { code?: string; message?: string };
    if (pgError.code === '23505') {
      return NextResponse.json(
        { error: 'Gagal import: nama atau barcode duplikat.' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
