import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { receiveGoods } from '@/lib/queries/inventory';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') {
    return NextResponse.json({ success: false, message: 'Forbidden', data: null }, { status: 403 });
  }

  const body = await req.json();
  const { item_id, qty, vendor_id, unit_purchase_price, purchase_order_item_id } = body;

  if (!item_id || !qty || !vendor_id || !unit_purchase_price) {
    return NextResponse.json({ success: false, message: 'Data tidak lengkap', data: null }, { status: 400 });
  }

  const result = await receiveGoods({
    item_id: Number(item_id),
    qty: Number(qty),
    vendor_id: Number(vendor_id),
    unit_purchase_price: Number(unit_purchase_price),
    purchase_order_item_id: purchase_order_item_id ? Number(purchase_order_item_id) : undefined,
  });

  return NextResponse.json({ success: true, message: 'Penerimaan barang berhasil dicatat. Harga rata-rata diperbarui.', data: result });
}
