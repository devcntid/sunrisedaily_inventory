import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { generateBarcode } from '@/lib/queries/items';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') {
    return NextResponse.json({ success: false, message: 'Forbidden', data: null }, { status: 403 });
  }

  const { id } = await params;
  const barcode = await generateBarcode(Number(id));
  return NextResponse.json({ success: true, message: 'Barcode berhasil dibuat', data: { barcode } });
}
