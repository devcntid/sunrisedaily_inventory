import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { recordScan } from '@/lib/queries/delivery-notes';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized', data: null }, { status: 401 });

  const body = await req.json();
  const { delivery_note_item_id, item_id, barcode_scanned, scan_type, device_info, qty_received, discrepancy_reason, discrepancy_notes } = body;

  if (!delivery_note_item_id || !item_id || !barcode_scanned || !scan_type) {
    return NextResponse.json({ success: false, message: 'Data scan tidak lengkap', data: null }, { status: 400 });
  }

  if (!['OUT', 'IN'].includes(scan_type)) {
    return NextResponse.json({ success: false, message: 'scan_type harus OUT atau IN', data: null }, { status: 400 });
  }

  // OUT scan = central warehouse only; IN scan = outlet only
  if (scan_type === 'OUT' && session.role !== 'ADMIN_PUSAT') {
    return NextResponse.json({ success: false, message: 'Scan OUT hanya dapat dilakukan oleh Admin Pusat', data: null }, { status: 403 });
  }

  try {
    const result = await recordScan({
      delivery_note_item_id: Number(delivery_note_item_id),
      item_id: Number(item_id),
      barcode_scanned,
      scan_type,
      scanned_by: session.userId,
      device_info,
      qty_received: qty_received ? Number(qty_received) : undefined,
      discrepancy_reason,
      discrepancy_notes,
    });

    return NextResponse.json({ success: true, message: `Scan ${scan_type} recorded successfully`, data: result });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, message: (error instanceof Error ? error.message : 'Unknown error') }, { status: 400 });
  }
}
