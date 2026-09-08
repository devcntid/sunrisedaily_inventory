export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { rejectOutletTransfer } from '@/lib/queries/outlet-transfers';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') {
    return NextResponse.json({ success: false, message: 'Hanya Admin Pusat yang berhak menolak mutasi.' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const transferId = Number(id);

    if (isNaN(transferId)) {
      return NextResponse.json({ success: false, message: 'ID mutasi tidak valid.' }, { status: 400 });
    }

    const body = await request.json();
    const reason = body.reason?.trim() || 'Ditolak oleh Admin Pusat';

    const rejected = await rejectOutletTransfer(transferId, Number(session.userId), reason);

    if (!rejected) {
      return NextResponse.json({ success: false, message: 'Gagal menolak mutasi. Pastikan status masih menunggu persetujuan.' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Mutasi antar outlet ditolak.' });
  } catch (error: unknown) {
    console.error('Error rejecting transfer:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
