import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getStockCountHeaderById } from '@/lib/queries/opname';

export async function GET(req: NextRequest, { params }: { params: Promise<{ headerId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized', data: null }, { status: 401 });
  
  const { headerId } = await params;
  
  const header = await getStockCountHeaderById(Number(headerId));
  
  if (!header) return NextResponse.json({ success: false, message: 'Not found', data: null }, { status: 404 });
  
  return NextResponse.json({ success: true, message: 'OK', data: header });
}
