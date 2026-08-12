import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getVendorHistory } from '@/lib/queries/master';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized', data: null }, { status: 401 });
  
  const { searchParams } = new URL(req.url);
  const vendorId = searchParams.get('id');
  if (!vendorId) return NextResponse.json({ success: false, message: 'Vendor ID is required' }, { status: 400 });

  try {
    const history = await getVendorHistory(Number(vendorId));
    return NextResponse.json({ success: true, message: 'OK', data: history });
  } catch (err: unknown) {
    console.error('Get Vendor History Error:', err);
    return NextResponse.json({ success: false, message: (err instanceof Error ? err.message : 'Unknown error') || 'Internal Error' }, { status: 500 });
  }
}
