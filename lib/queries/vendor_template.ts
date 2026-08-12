import { query, withTransaction } from '@/lib/db';

export interface ValidatedVendorRow {
  vendor_id?: number | null;
  vendor_type: string; // INDIVIDU / PERUSAHAAN (or Company)
  vendor_name: string;
  status: string; // AKTIF / NONAKTIF
  phone: string | null;
  email: string | null;
  contact_person: string | null;
  website: string | null;
  address_1: string | null;
  address_2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: string | null;
  npwp: string | null;
}

export async function getTemplateVendors() {
  const result = await query(`
    SELECT 
      id as vendor_id,
      name as vendor_name,
      type as vendor_type,
      is_active,
      phone,
      email,
      contact_person,
      website,
      address as address_1,
      street2 as address_2,
      city,
      state as province,
      zip as postal_code,
      country,
      tax_id as npwp
    FROM vendors
    ORDER BY id ASC
  `);
  return result.rows;
}

export async function upsertVendors(rows: ValidatedVendorRow[]) {
  await withTransaction(async (client) => {
    for (const row of rows) {
      const type = row.vendor_type === 'INDIVIDU' ? 'Individual' : 'Company';
      const is_active = row.status === 'AKTIF';

      if (row.vendor_id) {
        // UPDATE
        // Kolom kosong pada file tidak menghapus data lama (default to current DB value or COALESCE)
        // Kita build query dinamis untuk update
        
        let updateFields = [];
        let values: any[] = [];
        let i = 1;

        updateFields.push(`name = $${i++}`); values.push(row.vendor_name);
        updateFields.push(`type = $${i++}`); values.push(type);
        updateFields.push(`is_active = $${i++}`); values.push(is_active);

        if (row.phone !== null && row.phone !== '') { updateFields.push(`phone = $${i++}`); values.push(row.phone); }
        if (row.email !== null && row.email !== '') { updateFields.push(`email = $${i++}`); values.push(row.email); }
        if (row.contact_person !== null && row.contact_person !== '') { updateFields.push(`contact_person = $${i++}`); values.push(row.contact_person); }
        if (row.website !== null && row.website !== '') { updateFields.push(`website = $${i++}`); values.push(row.website); }
        if (row.address_1 !== null && row.address_1 !== '') { updateFields.push(`address = $${i++}`); values.push(row.address_1); }
        if (row.address_2 !== null && row.address_2 !== '') { updateFields.push(`street2 = $${i++}`); values.push(row.address_2); }
        if (row.city !== null && row.city !== '') { updateFields.push(`city = $${i++}`); values.push(row.city); }
        if (row.province !== null && row.province !== '') { updateFields.push(`state = $${i++}`); values.push(row.province); }
        if (row.postal_code !== null && row.postal_code !== '') { updateFields.push(`zip = $${i++}`); values.push(row.postal_code); }
        if (row.country !== null && row.country !== '') { updateFields.push(`country = $${i++}`); values.push(row.country); }
        if (row.npwp !== null && row.npwp !== '') { updateFields.push(`tax_id = $${i++}`); values.push(row.npwp); }

        values.push(row.vendor_id);
        const queryStr = `UPDATE vendors SET ${updateFields.join(', ')} WHERE id = $${i}`;

        await client.query(queryStr, values);
      } else {
        // INSERT
        await client.query(
          `INSERT INTO vendors (
            name, type, is_active, phone, email, contact_person, website, 
            address, street2, city, state, zip, country, tax_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [
            row.vendor_name, type, is_active, row.phone || null, row.email || null, row.contact_person || null, 
            row.website || null, row.address_1 || null, row.address_2 || null, row.city || null, 
            row.province || null, row.postal_code || null, row.country || null, row.npwp || null
          ]
        );
      }
    }
  });
}
