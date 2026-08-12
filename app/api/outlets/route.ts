import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getOutlets, createOutlet, updateOutlet, deleteOutlet } from '@/lib/queries/master';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized', data: null }, { status: 401 });
  
  const outlets = await getOutlets();
  return NextResponse.json({ success: true, message: 'OK', data: outlets });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') return NextResponse.json({ success: false, message: 'Forbidden', data: null }, { status: 403 });
  try {
    const body = await req.json();
    const outlet = await createOutlet({ 
      name: body.name, 
      type: body.type,
      address: body.address,
      street: body.street,
      street2: body.street2,
      city: body.city,
      state: body.state,
      zip: body.zip,
      country: body.country,
      pic_name: body.pic_name,
      email: body.email,
      phone: body.phone,
      map_location: body.map_location,
      is_active: body.is_active,
      venue_id: body.venue_id ? Number(body.venue_id) : null,
    });
    return NextResponse.json({ success: true, message: 'Outlet berhasil ditambahkan', data: outlet }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, message: (err instanceof Error ? err.message : 'Unknown error') || 'Error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') return NextResponse.json({ success: false, message: 'Forbidden', data: null }, { status: 403 });
  try {
    const body = await req.json();
    const outlet = await updateOutlet(Number(body.id), { 
      name: body.name, 
      type: body.type,
      address: body.address,
      street: body.street,
      street2: body.street2,
      city: body.city,
      state: body.state,
      zip: body.zip,
      country: body.country,
      pic_name: body.pic_name,
      email: body.email,
      phone: body.phone,
      map_location: body.map_location,
      is_active: body.is_active,
      // venue_id: null jika dikosongkan, number jika dipilih
      venue_id: body.venue_id ? Number(body.venue_id) : null,
    });
    return NextResponse.json({ success: true, message: 'Outlet berhasil diperbarui', data: outlet });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, message: (err instanceof Error ? err.message : 'Unknown error') || 'Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') return NextResponse.json({ success: false, message: 'Forbidden', data: null }, { status: 403 });
  const { searchParams } = new URL(req.url);
  await deleteOutlet(Number(searchParams.get('id')));
  return NextResponse.json({ success: true, message: 'Outlet berhasil dihapus', data: null });
}
