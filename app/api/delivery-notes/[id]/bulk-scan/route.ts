import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { bulkRecordScan } from '@/lib/queries/delivery-notes';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized', data: null }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const scan_type = body.scanType || body.scan_type;

  if (!['OUT', 'IN'].includes(scan_type)) {
    return NextResponse.json({ success: false, message: 'scan_type harus OUT atau IN', data: null }, { status: 400 });
  }

  // OUT scan = central warehouse only
  if (scan_type === 'OUT' && session.role !== 'ADMIN_PUSAT') {
    return NextResponse.json({ success: false, message: 'Scan OUT (Kirim) hanya dapat dilakukan oleh Admin Pusat', data: null }, { status: 403 });
  }

  // IN scan = outlet only (or central kitchen depending on business rules, but usually outlet)
  // We allow ADMIN_PUSAT as well to help testing/support.
  if (scan_type === 'IN' && session.role !== 'ADMIN_OUTLET' && session.role !== 'ADMIN_PUSAT') {
    return NextResponse.json({ success: false, message: 'Scan IN (Terima) hanya dapat dilakukan oleh Admin Outlet', data: null }, { status: 403 });
  }

  try {
    const result = await bulkRecordScan({
      delivery_note_id: Number(id),
      scan_type,
      scanned_by: session.userId,
    });

    return NextResponse.json({ success: true, message: `Berhasil validasi massal (${result.processed_count} item)`, data: result });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, message: (e instanceof Error ? e.message : 'Unknown error') || 'Gagal validasi massal', data: null }, { status: 500 });
  }
}
