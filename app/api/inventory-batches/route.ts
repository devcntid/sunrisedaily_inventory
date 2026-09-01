import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getItemBatches, createInventoryBatch, deleteInventoryBatch } from '@/lib/queries/inventory_batches';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, message: 'Unauthorized', data: null }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const itemId = searchParams.get('item_id');

  if (!itemId) {
    return NextResponse.json({ success: false, message: 'item_id diperlukan', data: null }, { status: 400 });
  }

  try {
    const batches = await getItemBatches(Number(itemId));
    return NextResponse.json({ success: true, data: batches });
  } catch (error) {
    console.error('Error fetching inventory batches:', error);
    return NextResponse.json({ success: false, message: 'Gagal memuat batch', data: null }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, message: 'Unauthorized', data: null }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { item_id, expired_date, qty_received, qty_remaining, batch_number } = body;

    if (!item_id || !expired_date || !qty_received) {
      return NextResponse.json({ success: false, message: 'Item, Expired Date, dan Qty wajib diisi', data: null }, { status: 400 });
    }

    const batch = await createInventoryBatch({
      item_id: Number(item_id),
      expired_date,
      qty_received: Number(qty_received),
      qty_remaining: qty_remaining !== undefined ? Number(qty_remaining) : Number(qty_received),
      batch_number: batch_number || `INITIAL-BATCH-${Date.now()}`
    });

    return NextResponse.json({ success: true, message: 'Batch berhasil ditambahkan', data: batch });
  } catch (error) {
    console.error('Error creating inventory batch:', error);
    return NextResponse.json({ success: false, message: 'Gagal menambahkan batch', data: null }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, message: 'Unauthorized', data: null }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ success: false, message: 'ID batch diperlukan', data: null }, { status: 400 });
  }

  try {
    await deleteInventoryBatch(Number(id));
    return NextResponse.json({ success: true, message: 'Batch berhasil dihapus' });
  } catch (error) {
    console.error('Error deleting inventory batch:', error);
    return NextResponse.json({ success: false, message: 'Gagal menghapus batch', data: null }, { status: 500 });
  }
}
