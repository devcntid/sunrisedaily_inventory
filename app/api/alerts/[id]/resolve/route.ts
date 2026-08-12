import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { resolveAlert } from '@/lib/queries/alerts';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') return NextResponse.json({ success: false, message: 'Forbidden', data: null }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const alert = await resolveAlert(Number(id), body.reference_po_id ?? undefined);
  if (!alert) return NextResponse.json({ success: false, message: 'Alert tidak ditemukan', data: null }, { status: 404 });
  return NextResponse.json({ success: true, message: 'Alert diselesaikan', data: alert });
}
