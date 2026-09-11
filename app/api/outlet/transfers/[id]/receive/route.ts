export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { completeOutletTransfer, getOutletTransferDetail } from '@/lib/queries/outlet-transfers';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const transferId = Number(id);

    if (isNaN(transferId)) {
      return NextResponse.json({ success: false, message: 'ID mutasi tidak valid.' }, { status: 400 });
    }

    const { transfer } = await getOutletTransferDetail(transferId);
    if (!transfer) {
      return NextResponse.json({ success: false, message: 'Data mutasi tidak ditemukan.' }, { status: 404 });
    }

    // Only destination outlet (or central admin) can confirm receipt
    if (session.role === 'ADMIN_OUTLET' && session.outletId) {
      if (Number(transfer.to_outlet_id) !== Number(session.outletId)) {
        return NextResponse.json({ success: false, message: 'Hanya outlet penerima yang berhak mengonfirmasi penerimaan barang.' }, { status: 403 });
      }
    }

    let receiptData;
    try {
      const body = await request.json();
      if (body && typeof body === 'object') {
        receiptData = {
          received_items: body.received_items,
          proof_image_url: body.proof_image_url,
        };
      }
    } catch {
      // Body might be empty, which is fine
    }

    await completeOutletTransfer(transferId, receiptData);

    return NextResponse.json({
      success: true,
      message: 'Penerimaan barang mutasi berhasil dikonfirmasi. Stok dan HPP telah disinkronkan.',
    });
  } catch (error: unknown) {
    console.error('Error completing transfer:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Gagal menyelesaikan mutasi.' },
      { status: 500 }
    );
  }
}
