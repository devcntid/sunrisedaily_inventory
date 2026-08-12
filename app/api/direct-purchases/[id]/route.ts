import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDirectPurchaseDetails } from '@/lib/queries/direct_purchases';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return new NextResponse('Unauthorized', { status: 401 });

    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id, 10);
    if (isNaN(id)) {
      return new NextResponse('Invalid ID', { status: 400 });
    }

    const details = await getDirectPurchaseDetails(id);
    if (!details) {
      return new NextResponse('Not found', { status: 404 });
    }

    return NextResponse.json({ success: true, data: details });
  } catch (error: any) {
    console.error('Error fetching direct purchase details:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
