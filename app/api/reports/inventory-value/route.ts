import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getInventoryReport } from '@/lib/queries/inventory';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') return NextResponse.json({ success: false, message: 'Forbidden', data: null }, { status: 403 });
  
  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') ? Number(searchParams.get('month')) : new Date().getMonth() + 1;
  const year = searchParams.get('year') ? Number(searchParams.get('year')) : new Date().getFullYear();
  
  const rows = await getInventoryReport(month, year);
  return NextResponse.json({ success: true, message: 'OK', data: rows });
}
