import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { bulkRecordScan } from '@/lib/queries/delivery-notes';

// Route ini menangani penerimaan barang oleh Outlet (Scan IN).
// bulkRecordScan(IN) hanya mencatat scanned_in_at, qty_received aktual dari user,
// dan discrepancy_reason — TIDAK melakukan transfer stok.
// Transfer stok dilakukan EKSKLUSIF oleh confirmReceipt() setelah foto diupload.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const delivery_note_id = Number(id);
  const body = await req.json();

  if (!body.items || !Array.isArray(body.items)) {
    return NextResponse.json({ success: false, message: 'Invalid data: items array required' }, { status: 400 });
  }

  try {
    const result = await bulkRecordScan({
      delivery_note_id,
      scan_type: 'IN',
      scanned_by: session.userId,
      items: body.items, // BUG-B Fix: teruskan input user (qty_received, discrepancy_reason)
    });

    return NextResponse.json({ message: 'Scan IN recorded successfully', ...result });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, message: (error instanceof Error ? error.message : 'Unknown error') },
      { status: 400 }
    );
  }
}
