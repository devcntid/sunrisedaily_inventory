import { NextRequest, NextResponse } from 'next/server';
import { upsertVendors, ValidatedVendorRow } from '@/lib/queries/vendor_template';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { data } = body;

    if (!data || !Array.isArray(data)) {
      return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 });
    }

    const rows: ValidatedVendorRow[] = data.map((d: any) => ({
      vendor_id: d.vendor_id ? Number(d.vendor_id) : null,
      vendor_type: String(d.vendor_type),
      vendor_name: String(d.vendor_name),
      status: String(d.status),
      phone: d.phone,
      email: d.email,
      contact_person: d.contact_person,
      website: d.website,
      address_1: d.address_1,
      address_2: d.address_2,
      city: d.city,
      province: d.province,
      postal_code: d.postal_code,
      country: d.country,
      npwp: d.npwp
    }));

    // Filter out completely invalid rows 
    const validRows = rows.filter(r => r.vendor_name && (r.vendor_type === 'INDIVIDU' || r.vendor_type === 'PERUSAHAAN'));

    await upsertVendors(validRows);

    return NextResponse.json({
      success: true,
      message: 'Data vendor berhasil di-import'
    });
  } catch (error: any) {
    console.error('Error importing vendor template:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
