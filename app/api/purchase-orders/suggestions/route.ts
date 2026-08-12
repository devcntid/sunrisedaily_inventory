import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPurchaseOrderSuggestions } from '@/lib/queries/purchase-orders';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') return NextResponse.json({ success: false, message: 'Forbidden', data: null }, { status: 403 });

  // Ambil semua barang aktif yang stok saat ininya <= minimum_threshold
  // Kita hitung current_balance dari inventory_logs, jika tidak ada log maka 0
  const result = await getPurchaseOrderSuggestions();

  return NextResponse.json({ success: true, message: 'OK', data: result });
}
