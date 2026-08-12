import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getInventoryCard } from '@/lib/queries/inventory';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized', data: null }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const itemId = searchParams.get('item_id');
  if (!itemId) return NextResponse.json({ success: false, message: 'item_id wajib', data: null }, { status: 400 });
  const rows = await getInventoryCard(Number(itemId), Number(searchParams.get('limit') ?? 100), Number(searchParams.get('offset') ?? 0));
  return NextResponse.json({ success: true, message: 'OK', data: rows });
}
