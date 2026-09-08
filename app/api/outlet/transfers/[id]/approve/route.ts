export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { approveOutletTransfer } from '@/lib/queries/outlet-transfers';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') {
    return NextResponse.json({ success: false, message: 'Hanya Admin Pusat yang berhak menyetujui mutasi.' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const transferId = Number(id);

    if (isNaN(transferId)) {
      return NextResponse.json({ success: false, message: 'ID mutasi tidak valid.' }, { status: 400 });
    }

    let fromOutletId: number | undefined;
    try {
      const body = await request.json();
      if (body.from_outlet_id) {
        fromOutletId = Number(body.from_outlet_id);
      }
    } catch {
      // Body might be empty if already allocated
    }

    const approved = await approveOutletTransfer(transferId, Number(session.userId), fromOutletId);

    if (!approved) {
      return NextResponse.json({ success: false, message: 'Gagal menyetujui mutasi. Pastikan status masih menunggu persetujuan.' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Mutasi antar outlet berhasil disetujui.' });
  } catch (error: unknown) {
    console.error('Error approving transfer:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
