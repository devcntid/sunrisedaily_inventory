export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getOutletTransfers, createOutletTransferRequest } from '@/lib/queries/outlet-transfers';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || undefined;
    const outletIdParam = searchParams.get('outlet_id');

    // If user is tied to an outlet (ADMIN_OUTLET or has outletId), strictly filter to only their outlet
    let outletId: number | undefined;
    if (session.outletId) {
      outletId = Number(session.outletId);
    } else if (session.role === 'ADMIN_OUTLET') {
      outletId = Number(session.outletId);
    } else if (outletIdParam) {
      outletId = Number(outletIdParam);
    }

    const data = await getOutletTransfers({
      outletId,
      status,
      search,
    });

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error('Error fetching outlet transfers:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { from_outlet_id, to_outlet_id, notes, items } = body;

    // Determine target outlet ID (if ADMIN_OUTLET, to_outlet_id is their own outlet)
    let finalToOutletId = Number(to_outlet_id);
    if (session.role === 'ADMIN_OUTLET' && session.outletId) {
      finalToOutletId = Number(session.outletId);
    }

    if (!finalToOutletId) {
      return NextResponse.json(
        { success: false, message: 'Outlet tujuan wajib ditentukan.' },
        { status: 400 }
      );
    }

    if (from_outlet_id && Number(from_outlet_id) === Number(finalToOutletId)) {
      return NextResponse.json(
        { success: false, message: 'Outlet asal dan outlet tujuan tidak boleh sama.' },
        { status: 400 }
      );
    }

    const transferId = await createOutletTransferRequest({
      from_outlet_id: from_outlet_id ? Number(from_outlet_id) : null,
      to_outlet_id: finalToOutletId,
      requested_by: Number(session.userId),
      notes,
      items: items || [],
    });

    return NextResponse.json({
      success: true,
      message: 'Permohonan mutasi berhasil diajukan.',
      transfer_id: transferId,
    });
  } catch (error: unknown) {
    console.error('Error creating transfer request:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Gagal mengajukan mutasi.' },
      { status: 400 }
    );
  }
}
