export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getItemById, updateItem, deleteItem } from '@/lib/queries/items';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized', data: null }, { status: 401 });

  const { id } = await params;
  const item = await getItemById(Number(id));
  if (!item) return NextResponse.json({ success: false, message: 'Item tidak ditemukan', data: null }, { status: 404 });
  return NextResponse.json({ success: true, message: 'OK', data: item });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') {
    return NextResponse.json({ success: false, message: 'Forbidden', data: null }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  if ('name' in body && (!body.name || !String(body.name).trim())) {
    return NextResponse.json({ success: false, message: 'Nama barang tidak boleh kosong', data: null }, { status: 400 });
  }

  if (body.barcode === '') {
    body.barcode = null;
  }
  if ('ingredient_id' in body) {
    body.ingredient_id = body.ingredient_id ? Number(body.ingredient_id) : null;
  }
  if ('category_id' in body && body.category_id) body.category_id = Number(body.category_id);
  if ('conversion_ratio' in body && body.conversion_ratio) body.conversion_ratio = Number(body.conversion_ratio);
  if ('minimum_threshold' in body && body.minimum_threshold !== undefined) body.minimum_threshold = Number(body.minimum_threshold);
  if ('target_stock' in body && body.target_stock !== undefined) body.target_stock = Number(body.target_stock);
  if ('current_average_price' in body && body.current_average_price !== undefined) body.current_average_price = Number(body.current_average_price);
  if ('min_order_qty' in body && body.min_order_qty !== undefined) body.min_order_qty = Number(body.min_order_qty);
  if ('order_multiple' in body && body.order_multiple !== undefined) body.order_multiple = Number(body.order_multiple);
  if ('is_perishable' in body) body.is_perishable = body.is_perishable === true || body.is_perishable === 'true';
  if ('is_active' in body) body.is_active = body.is_active === true || body.is_active === 'true';
  if ('is_split_allowed' in body) body.is_split_allowed = body.is_split_allowed === true || body.is_split_allowed === 'true';
  if ('is_global' in body) body.is_global = body.is_global === true || body.is_global === 'true';
  // Pastikan venue_ids berisi number, bukan string
  if ('venue_ids' in body && Array.isArray(body.venue_ids)) {
    body.venue_ids = body.venue_ids.map((id: string | number) => Number(id));
  }

  try {
    const item = await updateItem(Number(id), body);
    if (!item) return NextResponse.json({ success: false, message: 'Item tidak ditemukan', data: null }, { status: 404 });
    return NextResponse.json({ success: true, message: 'Item berhasil diperbarui', data: item });
  } catch (error: unknown) {
    const pgError = error as { code?: string; message?: string; constraint?: string };
    if (pgError.code === '23505') {
      if (pgError.constraint === 'items_name_key') {
        return NextResponse.json({ success: false, message: 'Gagal menyimpan: Nama barang sudah digunakan oleh barang lain.', data: null }, { status: 400 });
      }
      return NextResponse.json({ success: false, message: 'Gagal menyimpan: Barcode atau entitas sudah digunakan (' + pgError.constraint + ').', data: null }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: 'Gagal memperbarui: ' + (error instanceof Error ? error.message : 'Unknown error'), data: null }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') {
    return NextResponse.json({ success: false, message: 'Forbidden', data: null }, { status: 403 });
  }

  const { id } = await params;
  try {
    await deleteItem(Number(id));
    return NextResponse.json({ success: true, message: 'Item berhasil dihapus permanen', data: null });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, message: 'Gagal menghapus: ' + (error instanceof Error ? error.message : 'Unknown error'), data: null }, { status: 400 });
  }
}
