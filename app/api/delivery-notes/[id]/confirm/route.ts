import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { confirmReceipt } from '@/lib/queries/delivery-notes';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { recipient_name, proof_image_url } = body;

  if (session.role !== 'ADMIN_OUTLET' && session.role !== 'ADMIN_PUSAT') {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  try {
    const result = await confirmReceipt(Number(id), recipient_name || session.name, proof_image_url);
    return NextResponse.json({ success: true, message: 'Receipt confirmed successfully', data: result });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, message: (error instanceof Error ? error.message : 'Unknown error') || 'Server error' }, { status: 500 });
  }
}
