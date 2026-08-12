import { NextResponse } from 'next/server';
import { getLocalPurchases, createLocalPurchase } from '@/lib/queries/local-purchases';
import { getSession } from '@/lib/auth';
import { put } from '@vercel/blob';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const filterOutlet = searchParams.get('outlet_id');
    const filterDate = searchParams.get('date') || undefined;
    
    // If outlet admin, force their own outlet_id
    const outletId = session.role === 'ADMIN_OUTLET' ? (session.outletId || undefined) : (filterOutlet ? Number(filterOutlet) : undefined);

    const data = await getLocalPurchases(outletId, filterDate);
    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json({ success: false, message: (err instanceof Error ? err.message : 'Unknown error') }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const formData = await request.formData();
    const purchase_date = formData.get('purchase_date') as string;
    const total_amount = Number(formData.get('total_amount'));
    const itemsStr = formData.get('items') as string;
    let outletId = session.role === 'ADMIN_OUTLET' ? session.outletId : Number(formData.get('outlet_id'));
    
    if (!outletId) return NextResponse.json({ success: false, message: 'Outlet ID required' }, { status: 400 });
    if (!purchase_date) return NextResponse.json({ success: false, message: 'Purchase date required' }, { status: 400 });
    
    const items = JSON.parse(itemsStr);
    if (!items || items.length === 0) return NextResponse.json({ success: false, message: 'Items required' }, { status: 400 });

    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ success: false, message: 'Receipt file required' }, { status: 400 });

    // Upload to Vercel Blob
    const blob = await put(`receipts/${Date.now()}-${file.name}`, file, {
      access: 'public',
    });

    const purchaseId = await createLocalPurchase(outletId, purchase_date, blob.url, total_amount, items);

    return NextResponse.json({ success: true, purchaseId });
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json({ success: false, message: (err instanceof Error ? err.message : 'Unknown error') }, { status: 500 });
  }
}
