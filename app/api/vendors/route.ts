import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getVendors, createVendor, updateVendor, deleteVendor } from '@/lib/queries/master';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized', data: null }, { status: 401 });
  const vendors = await getVendors();
  return NextResponse.json({ success: true, message: 'OK', data: vendors });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') return NextResponse.json({ success: false, message: 'Forbidden', data: null }, { status: 403 });
  try {
    const body = await req.json();
    const vendor = await createVendor({ 
      name: body.name, 
      type: body.type,
      email: body.email, 
      phone: body.phone, 
      address: body.address,
      street: body.street,
      street2: body.street2,
      city: body.city,
      state: body.state,
      zip: body.zip,
      country: body.country,
      contact_person: body.contact_person,
      logo_url: body.logo_url,
      tax_id: body.tax_id,
      website: body.website,
      is_active: body.is_active
    });
    return NextResponse.json({ success: true, message: 'Vendor berhasil ditambahkan', data: vendor }, { status: 201 });
  } catch (err: unknown) {
    console.error('Create Vendor Error:', err);
    return NextResponse.json({ success: false, message: (err instanceof Error ? err.message : 'Unknown error') || 'Terjadi kesalahan internal' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') return NextResponse.json({ success: false, message: 'Forbidden', data: null }, { status: 403 });
  try {
    const body = await req.json();
    const vendor = await updateVendor(Number(body.id), { 
      name: body.name, 
      type: body.type,
      email: body.email, 
      phone: body.phone, 
      address: body.address,
      street: body.street,
      street2: body.street2,
      city: body.city,
      state: body.state,
      zip: body.zip,
      country: body.country,
      contact_person: body.contact_person,
      logo_url: body.logo_url,
      tax_id: body.tax_id,
      website: body.website,
      is_active: body.is_active
    });
    return NextResponse.json({ success: true, message: 'Vendor berhasil diperbarui', data: vendor });
  } catch (err: unknown) {
    console.error('Update Vendor Error:', err);
    return NextResponse.json({ success: false, message: (err instanceof Error ? err.message : 'Unknown error') || 'Terjadi kesalahan internal' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') return NextResponse.json({ success: false, message: 'Forbidden', data: null }, { status: 403 });
  const { searchParams } = new URL(req.url);
  await deleteVendor(Number(searchParams.get('id')));
  return NextResponse.json({ success: true, message: 'Vendor berhasil dihapus', data: null });
}
