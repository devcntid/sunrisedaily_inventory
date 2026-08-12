import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { bulkUpdateItemVenues } from '@/lib/queries/items';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') {
    return NextResponse.json({ success: false, message: 'Forbidden', data: null }, { status: 403 });
  }

  const body = await req.json();
  const { item_ids, venue_ids, is_global } = body;

  if (!Array.isArray(item_ids) || item_ids.length === 0) {
    return NextResponse.json({ success: false, message: 'Harap pilih minimal 1 barang', data: null }, { status: 400 });
  }

  if (is_global === undefined && !Array.isArray(venue_ids)) {
    return NextResponse.json({ success: false, message: 'Parameter tidak valid', data: null }, { status: 400 });
  }

  try {
    await bulkUpdateItemVenues(item_ids, is_global, venue_ids);

    return NextResponse.json({ success: true, message: 'Berhasil mengupdate akses venue barang secara massal', data: null });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, message: 'Gagal mengupdate: ' + (error instanceof Error ? error.message : 'Unknown error'), data: null }, { status: 500 });
  }
}
