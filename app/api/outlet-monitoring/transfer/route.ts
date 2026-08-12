import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { directTransferStockToOutlet, approveAllPendingDOsForOutlet, approveAllPendingDOsAllOutlets } from '@/lib/queries/outlet-monitoring';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { outlet_id, items, notes, approve_all_pending, approve_all_outlets } = body;

    if (approve_all_outlets) {
      const resAll = await approveAllPendingDOsAllOutlets(session.userId);
      if (resAll.count === 0) {
        return NextResponse.json({
          success: false,
          message: 'Tidak ada pengiriman yang sedang berjalan untuk semua outlet saat ini.'
        }, { status: 400 });
      }
      return NextResponse.json({
        success: true,
        message: `Berhasil memproses ${resAll.count} pengiriman di ${resAll.outlets_count} outlet sekaligus! Stok Pusat berkurang & Stok Outlet bertambah.`,
        data: resAll
      });
    }

    if (!outlet_id) {
      return NextResponse.json({ success: false, message: 'Outlet tujuan harus dipilih' }, { status: 400 });
    }

    let approvedDoCount = 0;
    if (approve_all_pending) {
      const resPending = await approveAllPendingDOsForOutlet(Number(outlet_id), session.userId);
      approvedDoCount = resPending.count;
    }

    let transferResult = null;
    if (Array.isArray(items) && items.length > 0) {
      transferResult = await directTransferStockToOutlet(Number(outlet_id), items, session.userId, notes);
    }

    if (approvedDoCount === 0 && (!Array.isArray(items) || items.length === 0)) {
      return NextResponse.json({ success: false, message: 'Tidak ada pengiriman yang sedang berjalan ke outlet ini dan daftar barang kosong.' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: approvedDoCount > 0
        ? `Berhasil memproses ${approvedDoCount} Surat Jalan tertunda & transfer stok ke outlet!`
        : 'Berhasil memproses Transfer Stok Langsung ke Outlet (1 Paket)',
      data: { approved_dos: approvedDoCount, transfer: transferResult }
    });
  } catch (error: unknown) {
    console.error('Direct transfer stock error:', error);
    return NextResponse.json({
      success: false,
      message: (error instanceof Error ? error.message : 'Unknown error') || 'Server error'
    }, { status: 500 });
  }
}
