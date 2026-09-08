export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createDirectOutletTransfer } from '@/lib/queries/outlet-transfers';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') {
    return NextResponse.json({ success: false, message: 'Hanya Admin Pusat yang berhak membuat mutasi langsung.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { from_outlet_id, to_outlet_id, notes, items } = body;

    if (!from_outlet_id || !to_outlet_id) {
      return NextResponse.json(
        { success: false, message: 'Outlet asal dan outlet tujuan wajib ditentukan.' },
        { status: 400 }
      );
    }

    if (Number(from_outlet_id) === Number(to_outlet_id)) {
      return NextResponse.json(
        { success: false, message: 'Outlet asal dan outlet tujuan tidak boleh sama.' },
        { status: 400 }
      );
    }

    if (!items || items.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Minimal harus memilih 1 barang.' },
        { status: 400 }
      );
    }

    const transferId = await createDirectOutletTransfer({
      from_outlet_id: Number(from_outlet_id),
      to_outlet_id: Number(to_outlet_id),
      created_by: Number(session.userId),
      notes,
      items,
    });

    return NextResponse.json({
      success: true,
      message: 'Mutasi langsung berhasil dibuat dan disetujui.',
      transfer_id: transferId,
    });
  } catch (error: unknown) {
    console.error('Error creating direct transfer:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Gagal membuat mutasi langsung.' },
      { status: 400 }
    );
  }
}
