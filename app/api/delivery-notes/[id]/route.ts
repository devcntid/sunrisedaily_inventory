import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDeliveryNoteById } from '@/lib/queries/delivery-notes';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized', data: null }, { status: 401 });
  const { id } = await params;
  const dn = await getDeliveryNoteById(Number(id));
  if (!dn) return NextResponse.json({ success: false, message: 'Surat Jalan tidak ditemukan', data: null }, { status: 404 });
  return NextResponse.json({ success: true, message: 'OK', data: dn });
}
