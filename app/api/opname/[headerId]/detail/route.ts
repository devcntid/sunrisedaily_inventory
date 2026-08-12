import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { upsertStockCountDetail, getStockCountDetails } from '@/lib/queries/opname';

export async function GET(req: NextRequest, { params }: { params: Promise<{ headerId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized', data: null }, { status: 401 });
  const { headerId } = await params;
  const details = await getStockCountDetails(Number(headerId));
  return NextResponse.json({ success: true, message: 'OK', data: details });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ headerId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized', data: null }, { status: 401 });
  const { headerId } = await params;
  const body = await req.json();
  const detail = await upsertStockCountDetail({
    header_id: Number(headerId),
    item_id: Number(body.item_id),
    system_balance: Number(body.system_balance),
    actual_physical_qty: Number(body.actual_physical_qty),
    reason_category: body.reason_category ?? undefined,
    reason_notes: body.reason_notes ?? undefined,
  });
  return NextResponse.json({ success: true, message: 'Detail opname disimpan', data: detail });
}
