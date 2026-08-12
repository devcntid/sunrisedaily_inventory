import { query } from '@/lib/db';

// --- Outlets ---
export async function getOutlets() {
  const result = await query(`
    SELECT o.*, v.name as venue_name 
    FROM outlets o 
    LEFT JOIN venues v ON o.venue_id = v.id 
    ORDER BY o.type, o.name
  `);
  return result.rows;
}
export async function getOutletsWithBusiness() {
  const result = await query(`
    SELECT o.id, o.name as outlet_name, 'Sunrise Daily' as business_name
    FROM outlets o
    ORDER BY o.name
  `);
  
  const grouped: Record<string, { id: number; name: string }[]> = {};
  for (const row of result.rows) {
      const bName = row.business_name || 'Unknown Business';
      if (!grouped[bName]) grouped[bName] = [];
      grouped[bName].push({ id: row.id, name: row.outlet_name });
  }
  return grouped;
}

export async function getActiveStoreOutlets() {
  const result = await query(`SELECT id FROM outlets WHERE type = 'STORE' AND is_active = TRUE`);
  return result.rows;
}

export async function createOutlet(data: { name: string; type: string; address?: string; street?: string; street2?: string; city?: string; state?: string; zip?: string; country?: string; pic_name?: string; email?: string; phone?: string; map_location?: string; is_active?: boolean; venue_id?: number | null }) {
  const result = await query(
    `INSERT INTO outlets (name, type, address, street, street2, city, state, zip, country, pic_name, email, phone, map_location, is_active, venue_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`, 
    [data.name, data.type, data.address ?? null, data.street ?? null, data.street2 ?? null, data.city ?? null, data.state ?? null, data.zip ?? null, data.country ?? null, data.pic_name ?? null, data.email ?? null, data.phone ?? null, data.map_location ?? null, data.is_active ?? true, data.venue_id ?? null]
  );
  return result.rows[0];
}

export async function updateOutlet(id: number, data: Record<string, unknown>) {
  const fields = Object.keys(data).map((f, i) => `${f} = $${i + 2}`).join(', ');
  const values = Object.values(data);
  const result = await query(
    `UPDATE outlets SET ${fields} WHERE id = $1 RETURNING *`,
    [id, ...values]
  );
  return result.rows[0];
}

export async function getOutletMokaBusinessId(outletId: number) {
  const result = await query('SELECT moka_business_id FROM outlets WHERE id = $1', [outletId]);
  return result.rows[0]?.moka_business_id ?? null;
}

export async function updateOutletMokaBusinessId(outletId: number, businessId: string) {
  await query('UPDATE outlets SET moka_business_id = $1 WHERE id = $2', [businessId, outletId]);
}

export async function deleteOutlet(id: number) {
  await query(`DELETE FROM outlets WHERE id = $1`, [id]);
}

// --- Vendors ---
export async function getVendors() {
  const result = await query(`SELECT * FROM vendors ORDER BY name`);
  return result.rows;
}

export async function createVendor(data: { name: string; type?: string; email?: string; phone?: string; address?: string; street?: string; street2?: string; city?: string; state?: string; zip?: string; country?: string; contact_person?: string; logo_url?: string; tax_id?: string; website?: string; is_active?: boolean }) {
  const result = await query(
    `INSERT INTO vendors (name, type, email, phone, address, street, street2, city, state, zip, country, contact_person, logo_url, tax_id, website, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
    [data.name, data.type ?? 'Company', data.email ?? null, data.phone ?? null, data.address ?? null, data.street ?? null, data.street2 ?? null, data.city ?? null, data.state ?? null, data.zip ?? null, data.country ?? null, data.contact_person ?? null, data.logo_url ?? null, data.tax_id ?? null, data.website ?? null, data.is_active ?? true]
  );
  return result.rows[0];
}

export async function updateVendor(id: number, data: Record<string, unknown>) {
  const fields = Object.keys(data).map((f, i) => `${f} = $${i + 2}`).join(', ');
  const values = Object.values(data);
  const result = await query(
    `UPDATE vendors SET ${fields} WHERE id = $1 RETURNING *`, [id, ...values]
  );
  return result.rows[0] ?? null;
}

export async function deleteVendor(id: number) {
  await query(`DELETE FROM vendors WHERE id = $1`, [id]);
}

export async function getVendorHistory(vendorId: number) {
  const result = await query(
    `SELECT 
       po.id as po_id,
       po.po_number,
       po.order_date,
       po.status,
       i.name AS item_name,
       poi.description,
       poi.qty,
       poi.unit_price,
       poi.subtotal
     FROM purchase_orders po
     JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
     LEFT JOIN items i ON i.id = poi.item_id
     WHERE po.vendor_id = $1
     ORDER BY po.order_date DESC, po.id DESC`,
    [vendorId]
  );
  return result.rows;
}

// --- Categories ---
export async function getCategories() {
  const result = await query(`SELECT * FROM categories ORDER BY name`);
  return result.rows;
}

export async function createCategory(data: { name: string }) {
  const result = await query(
    `INSERT INTO categories (name) VALUES ($1) RETURNING *`, [data.name]
  );
  return result.rows[0];
}

export async function updateCategory(id: number, data: { name: string }) {
  const result = await query(
    `UPDATE categories SET name = $1 WHERE id = $2 RETURNING *`, [data.name, id]
  );
  return result.rows[0] ?? null;
}

export async function deleteCategory(id: number) {
  await query(`DELETE FROM categories WHERE id = $1`, [id]);
}

// --- Venues ---
export async function getVenues() {
  const result = await query(`SELECT * FROM venues ORDER BY name`);
  return result.rows;
}

export async function createVenue(name: string) {
  const result = await query(`INSERT INTO venues (name) VALUES ($1) RETURNING *`, [name]);
  return result.rows[0];
}

export async function updateVenue(id: number, name: string) {
  const result = await query(`UPDATE venues SET name = $1 WHERE id = $2 RETURNING *`, [name, id]);
  return result.rows[0];
}

export async function deleteVenue(id: number) {
  await query(`DELETE FROM venues WHERE id = $1`, [id]);
}
