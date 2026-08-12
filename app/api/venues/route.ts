import { NextResponse } from 'next/server';
import { getVenues, createVenue, updateVenue, deleteVenue } from '@/lib/queries/master';

export async function GET() {
  try {
    const venues = await getVenues();
    return NextResponse.json({ success: true, data: venues });
  } catch (error: any) {
    console.error('Failed to get venues', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.name) {
      return NextResponse.json({ success: false, message: 'Name is required' }, { status: 400 });
    }
    const venue = await createVenue(body.name);
    return NextResponse.json({ success: true, data: venue });
  } catch (error: any) {
    if (error.code === '23505') { // unique violation
      return NextResponse.json({ success: false, message: 'Nama venue sudah digunakan' }, { status: 400 });
    }
    console.error('Failed to create venue', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    if (!body.id || !body.name) {
      return NextResponse.json({ success: false, message: 'ID and Name are required' }, { status: 400 });
    }
    const venue = await updateVenue(body.id, body.name);
    return NextResponse.json({ success: true, data: venue });
  } catch (error: any) {
    if (error.code === '23505') { // unique violation
      return NextResponse.json({ success: false, message: 'Nama venue sudah digunakan' }, { status: 400 });
    }
    console.error('Failed to update venue', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, message: 'ID required' }, { status: 400 });
    await deleteVenue(Number(id));
    return NextResponse.json({ success: true, message: 'Venue deleted' });
  } catch (error: any) {
    console.error('Failed to delete venue', error);
    return NextResponse.json({ success: false, message: 'Gagal menghapus venue, pastikan tidak ada data yang terkait' }, { status: 500 });
  }
}
