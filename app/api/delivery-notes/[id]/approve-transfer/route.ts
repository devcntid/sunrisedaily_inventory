import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { approveAndTransferDeliveryNote } from '@/lib/queries/delivery-notes';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || (session.role !== 'ADMIN_PUSAT' && session.role !== 'ADMIN_OUTLET')) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const result = await approveAndTransferDeliveryNote(Number(id), session.userId);
    return NextResponse.json({ success: true, message: 'Berhasil melakukan approve & transfer stok ke outlet', data: result });
  } catch (error: unknown) {
    return NextResponse.json({ 
      success: false, 
      message: (error instanceof Error ? error.message : 'Unknown error') || 'Server error' 
    }, { status: 500 });
  }
}
