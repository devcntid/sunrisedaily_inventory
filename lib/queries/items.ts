import { query, withTransaction } from '@/lib/db';
import type { PoolClient } from 'pg';

export interface Item {
  id: number;
  name: string;
  category_id: number;
  category_name?: string;
  barcode?: string;
  purchase_unit: string;
  package_unit?: string;
  package_qty?: number;
  smallest_unit: string;
  conversion_ratio: number;
  is_split_allowed?: boolean;
  min_order_qty?: number;
  order_multiple?: number;
  minimum_threshold: number;
  target_stock: number;
  threshold_type: string;
  computed_threshold_cache?: number;
  is_perishable: boolean;
  is_active: boolean;
  current_average_price: number;
  /** Harga beli terakhir per satuan terkecil (diupdate saat penerimaan barang/PO selesai) */
  last_purchase_price: number;
  created_at: string;
  updated_at: string;
  is_hpp?: boolean;
  ingredient_id?: number;
  ingredient_name?: string;
  parent_id?: number | null;
  has_children?: boolean;
  is_global?: boolean;
  venue_ids?: number[];
}

export async function getItems(opts?: { categoryId?: string; search?: string; activeOnly?: boolean; parentOnly?: boolean; venueId?: number; parentId?: number }) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (opts?.activeOnly !== false) {
    conditions.push(`i.is_active = TRUE`);
  }
  if (opts?.categoryId) {
    conditions.push(`i.category_id = $${i++}`);
    params.push(Number(opts.categoryId));
  }
  if (opts?.search) {
    conditions.push(`i.name ILIKE $${i++}`);
    params.push(`%${opts.search}%`);
  }
  // parentOnly: hanya tampilkan Induk (bukan Brand / Anak)
  if (opts?.parentOnly) {
    conditions.push(`i.parent_id IS NULL`);
  }
  if (opts?.venueId) {
    conditions.push(`(i.is_global = TRUE OR EXISTS(SELECT 1 FROM item_venues iv WHERE iv.item_id = i.id AND iv.venue_id = $${i++}))`);
    params.push(opts.venueId);
  }
  if (opts?.parentId) {
    conditions.push(`i.parent_id = $${i++}`);
    params.push(Number(opts.parentId));
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await query<Item & { current_stock?: number }>(
    `SELECT i.*, c.name AS category_name,
            COALESCE((SELECT ending_balance FROM inventory_logs WHERE item_id = i.id ORDER BY created_at DESC LIMIT 1), 0) AS current_stock,
            (i.ingredient_id IS NOT NULL OR ing_by_item.id IS NOT NULL) AS is_hpp,
            COALESCE(ing_by_id.name, ing_by_item.name) AS ingredient_name,
            EXISTS(SELECT 1 FROM items child WHERE child.parent_id = i.id) AS has_children,
            COALESCE((SELECT json_agg(venue_id ORDER BY venue_id) FILTER (WHERE venue_id IS NOT NULL) FROM item_venues WHERE item_id = i.id), '[]'::json) AS venue_ids
     FROM items i
     LEFT JOIN categories c ON c.id = i.category_id
     LEFT JOIN ingredients ing_by_id ON ing_by_id.id = i.ingredient_id
     LEFT JOIN ingredients ing_by_item ON ing_by_item.item_id = i.id
     ${where}
     ORDER BY COALESCE(i.parent_id, i.id), i.parent_id IS NOT NULL, i.name`,
    params
  );
  return result.rows;
}

export async function getItemById(id: number) {
  const result = await query<Item & { current_stock?: number; is_hpp?: boolean; ingredient_name?: string }>(
    `SELECT i.*, c.name AS category_name,
            COALESCE((SELECT ending_balance FROM inventory_logs WHERE item_id = i.id ORDER BY created_at DESC LIMIT 1), 0) AS current_stock,
            (i.ingredient_id IS NOT NULL OR ing_by_item.id IS NOT NULL) AS is_hpp,
            COALESCE(ing_by_id.name, ing_by_item.name) AS ingredient_name,
            EXISTS(SELECT 1 FROM items child WHERE child.parent_id = i.id) AS has_children,
            COALESCE((SELECT json_agg(venue_id ORDER BY venue_id) FILTER (WHERE venue_id IS NOT NULL) FROM item_venues WHERE item_id = i.id), '[]'::json) AS venue_ids
     FROM items i
     LEFT JOIN categories c ON c.id = i.category_id
     LEFT JOIN ingredients ing_by_id ON ing_by_id.id = i.ingredient_id
     LEFT JOIN ingredients ing_by_item ON ing_by_item.item_id = i.id
     WHERE i.id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function createItem(data: {
  name: string;
  category_id: number;
  purchase_unit: string;
  smallest_unit: string;
  conversion_ratio: number;
  minimum_threshold: number;
  target_stock?: number;
  threshold_type: string;
  is_perishable: boolean;
  barcode?: string;
  current_average_price?: number;
  last_purchase_price?: number;
  ingredient_id?: number | null;
  is_split_allowed?: boolean;
  min_order_qty?: number;
  order_multiple?: number;
  parent_id?: number | null;
  is_global?: boolean;
  venue_ids?: number[];
}) {
  return withTransaction(async (client) => {
    const result = await client.query<Item>(
      `INSERT INTO items (name, category_id, purchase_unit, smallest_unit, conversion_ratio, minimum_threshold, target_stock, threshold_type, is_perishable, barcode, current_average_price, last_purchase_price, ingredient_id, is_split_allowed, min_order_qty, order_multiple, parent_id, is_global)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING *`,
      [
        data.name, data.category_id, data.purchase_unit, data.smallest_unit, data.conversion_ratio,
        data.minimum_threshold, data.target_stock ?? 0, data.threshold_type, data.is_perishable,
        data.barcode ?? null, data.current_average_price ?? 0, data.last_purchase_price ?? data.current_average_price ?? 0,
        data.ingredient_id ?? null,
        data.is_split_allowed ?? false,
        data.min_order_qty ?? 1,
        data.order_multiple ?? 1,
        data.parent_id ?? null,
        data.is_global ?? true
      ]
    );
    const item = result.rows[0];

    if (data.venue_ids && data.venue_ids.length > 0) {
      for (const vid of data.venue_ids) {
        await client.query(`INSERT INTO item_venues (item_id, venue_id) VALUES ($1, $2)`, [item.id, vid]);
      }
    }
    return item;
  });
}

export async function createItemWithBrands(
  parentData: Parameters<typeof createItem>[0],
  brands: Array<{ name: string; barcode: string; purchase_price: number; conversion_ratio: number; purchase_unit?: string; is_active?: boolean }>
) {
  return withTransaction(async (client) => {
    // 1. Create Parent
    const parentRes = await client.query(
      `INSERT INTO items (name, category_id, purchase_unit, smallest_unit, conversion_ratio, minimum_threshold, target_stock, threshold_type, is_perishable, barcode, current_average_price, last_purchase_price, ingredient_id, is_split_allowed, min_order_qty, order_multiple, parent_id, is_global)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NULL,$17) RETURNING id`,
      [
        parentData.name, parentData.category_id, parentData.purchase_unit, parentData.smallest_unit, parentData.conversion_ratio,
        parentData.minimum_threshold, parentData.target_stock ?? 0, parentData.threshold_type, parentData.is_perishable,
        parentData.barcode, parentData.current_average_price, parentData.current_average_price,
        parentData.ingredient_id ?? null,
        parentData.is_split_allowed ?? false,
        parentData.min_order_qty ?? 1,
        parentData.order_multiple ?? 1,
        parentData.is_global ?? true
      ]
    );
    const parentId = parentRes.rows[0].id;

    if (parentData.venue_ids && parentData.venue_ids.length > 0) {
      for (const vid of parentData.venue_ids) {
        await client.query(`INSERT INTO item_venues (item_id, venue_id) VALUES ($1, $2)`, [parentId, vid]);
      }
    }

    // 2. Create Brands
    for (const brand of brands) {
      const brandRes = await client.query(
        `INSERT INTO items (name, category_id, purchase_unit, smallest_unit, conversion_ratio, minimum_threshold, target_stock, threshold_type, is_perishable, barcode, current_average_price, last_purchase_price, ingredient_id, is_split_allowed, min_order_qty, order_multiple, parent_id, is_active, is_global)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING id`,
        [
          brand.name, parentData.category_id, brand.purchase_unit || parentData.purchase_unit, parentData.smallest_unit, brand.conversion_ratio,
          parentData.minimum_threshold, parentData.target_stock ?? 0, parentData.threshold_type, parentData.is_perishable,
          brand.barcode, brand.purchase_price, brand.purchase_price,
          parentData.ingredient_id ?? null,
          parentData.is_split_allowed ?? false,
          parentData.min_order_qty ?? 1,
          parentData.order_multiple ?? 1,
          parentId,
          brand.is_active ?? true,
          parentData.is_global ?? true
        ]
      );
      const childId = brandRes.rows[0].id;
      if (parentData.venue_ids && parentData.venue_ids.length > 0) {
        for (const vid of parentData.venue_ids) {
          await client.query(`INSERT INTO item_venues (item_id, venue_id) VALUES ($1, $2)`, [childId, vid]);
        }
      }
    }
    return { id: parentId };
  });
}

export async function updateItem(id: number, data: Partial<{
  name: string;
  category_id: number;
  purchase_unit: string;
  smallest_unit: string;
  conversion_ratio: number;
  minimum_threshold: number;
  target_stock: number;
  threshold_type: string;
  is_perishable: boolean;
  is_active: boolean;
  barcode: string;
  current_average_price: number;
  last_purchase_price: number;
  ingredient_id: number | null;
  is_split_allowed: boolean;
  min_order_qty: number;
  order_multiple: number;
  is_global: boolean;
  venue_ids?: number[];
  brands?: Array<{
    id?: string;
    name: string;
    barcode: string;
    purchase_price: number;
    conversion_ratio: number;
    purchase_unit?: string;
    is_active?: boolean;
  }>;
}>) {
  const ALLOWED_COLUMNS = [
    'name', 'category_id', 'purchase_unit', 'smallest_unit', 'conversion_ratio',
    'minimum_threshold', 'target_stock', 'threshold_type', 'is_perishable',
    'is_active', 'barcode', 'current_average_price', 'last_purchase_price',
    'ingredient_id', 'is_split_allowed', 'min_order_qty', 'order_multiple',
    'package_unit', 'package_qty', 'package_inner_size', 'is_global'
  ];
  const fields = Object.keys(data).filter(key => ALLOWED_COLUMNS.includes(key) && (data as Record<string, unknown>)[key] !== undefined);
  const sets = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
  const values = fields.map(f => (data as Record<string, unknown>)[f]);

  return withTransaction(async (client) => {
    // 1. Ambil nilai smallest_unit lama sebelum diupdate
    const oldItemRes = await client.query(
      `SELECT smallest_unit, ingredient_id FROM items WHERE id = $1`,
      [id]
    );
    const oldItem = oldItemRes.rows[0];
    const oldSmallestUnit = oldItem?.smallest_unit ?? null;
    const newSmallestUnit = data.smallest_unit ?? null;

    // 2. Update item utama
    let updatedItem = oldItem as Item;
    if (fields.length > 0) {
      const result = await client.query<Item>(
        `UPDATE items SET ${sets}, updated_at = now() WHERE id = $1 RETURNING *`,
        [id, ...values]
      );
      updatedItem = result.rows[0] ?? null;
    }

    if (data.venue_ids !== undefined) {
      await client.query(`DELETE FROM item_venues WHERE item_id = $1`, [id]);
      // Dedup untuk mencegah 23505 jika frontend kirim nilai duplikat
      const uniqueVenueIds = [...new Set(data.venue_ids.map((v: number | string) => Number(v)))].filter(v => v > 0);
      for (const vid of uniqueVenueIds) {
        await client.query(
          `INSERT INTO item_venues (item_id, venue_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [id, vid]
        );
      }
    }

    // 3. Sinkronisasi recipe_ingredients.unit jika smallest_unit berubah
    // Ini memastikan unit di resep HPP selalu mengikuti perubahan satuan terkecil barang.
    if (
      newSmallestUnit &&
      oldSmallestUnit &&
      newSmallestUnit !== oldSmallestUnit
    ) {
      // Cari ingredient yang terhubung ke item ini (via ingredient_id di items, atau via item_id di ingredients)
      await client.query(
        `UPDATE recipe_ingredients ri
         SET unit = $1
         FROM ingredients ing
         WHERE ri.ingredient_id = ing.id
           AND (
             ing.item_id = $2
             OR ing.id = (SELECT ingredient_id FROM items WHERE id = $2)
           )
           AND ri.unit = $3`,
        [newSmallestUnit, id, oldSmallestUnit]
      );

      // Juga update default_unit di tabel ingredients jika ada link
      await client.query(
        `UPDATE ingredients SET default_unit = $1
         WHERE item_id = $2
           AND (default_unit = $3 OR default_unit IS NULL)`,
        [newSmallestUnit, id, oldSmallestUnit]
      );
    }

    // 4. Update, Insert, or Delete Brands
    if (data.brands !== undefined && updatedItem) {
      // Dapatkan semua brand yang sudah ada
      const existingBrandsRes = await client.query(`SELECT id FROM items WHERE parent_id = $1`, [id]);
      const existingBrandIds = existingBrandsRes.rows.map(r => r.id);
      
      const incomingBrandIds = data.brands.map(b => b.id ? Number(b.id) : null).filter(Boolean) as number[];
      
      // Hapus brand yang tidak ada di payload (dihapus dari form)
      for (const existingId of existingBrandIds) {
        if (!incomingBrandIds.includes(existingId)) {
          try {
            await client.query(`SAVEPOINT delete_brand_${existingId}`);
            await client.query(`DELETE FROM price_history WHERE item_id = $1`, [existingId]);
            await client.query(`DELETE FROM item_venues WHERE item_id = $1`, [existingId]);
            await client.query(`DELETE FROM items WHERE id = $1`, [existingId]);
            await client.query(`RELEASE SAVEPOINT delete_brand_${existingId}`);
          } catch (e: any) {
            await client.query(`ROLLBACK TO SAVEPOINT delete_brand_${existingId}`);
            if (e.code === '23503') {
              // Otomatis nonaktifkan (soft-delete) jika tidak bisa dihapus karena sudah ada transaksi
              await client.query(`UPDATE items SET is_active = false, updated_at = now() WHERE id = $1`, [existingId]);
            } else {
              throw e;
            }
          }
        }
      }

      if (data.brands.length > 0) {
        for (const brand of data.brands) {
          if (brand.id) {
            await client.query(
              `UPDATE items SET name=$1, barcode=$2, current_average_price=$3, last_purchase_price=$3, conversion_ratio=$4, purchase_unit=$5, is_active=$6, updated_at=now() WHERE id=$7`,
              [brand.name, brand.barcode || null, brand.purchase_price, brand.conversion_ratio, brand.purchase_unit || updatedItem.purchase_unit, brand.is_active ?? true, Number(brand.id)]
            );
          } else {
            const newBrandRes = await client.query(
              `INSERT INTO items (name, category_id, purchase_unit, smallest_unit, conversion_ratio, minimum_threshold, target_stock, threshold_type, is_perishable, barcode, current_average_price, last_purchase_price, ingredient_id, is_split_allowed, min_order_qty, order_multiple, parent_id, is_active, is_global)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING id`,
              [
                brand.name, updatedItem.category_id, brand.purchase_unit || updatedItem.purchase_unit, updatedItem.smallest_unit, brand.conversion_ratio,
                updatedItem.minimum_threshold, updatedItem.target_stock, updatedItem.threshold_type, updatedItem.is_perishable,
                brand.barcode || null, brand.purchase_price, brand.purchase_price,
                updatedItem.ingredient_id,
                updatedItem.is_split_allowed,
                updatedItem.min_order_qty,
                updatedItem.order_multiple,
                id,
                brand.is_active ?? true,
                updatedItem.is_global
              ]
            );
            const childId = newBrandRes.rows[0].id;
            
            // Re-apply venues for the new brand if the parent has specific venues
            if (!updatedItem.is_global && data.venue_ids && data.venue_ids.length > 0) {
              const uniqueVenueIds = [...new Set(data.venue_ids.map((v: number | string) => Number(v)))].filter(v => v > 0);
              for (const vid of uniqueVenueIds) {
                await client.query(
                  `INSERT INTO item_venues (item_id, venue_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                  [childId, vid]
                );
              }
            }
          }
        }
      }
    }

    return updatedItem;
  });
}

export async function deleteItem(id: number): Promise<boolean> {
  // 1. Validasi HPP (Mencegah penghapusan jika terdaftar sebagai resep)
  const hppCheck = await query(
    `SELECT ingredient_id IS NOT NULL AS is_hpp FROM items WHERE id = $1`,
    [id]
  );
  if (hppCheck.rows[0]?.is_hpp) {
    throw new Error('Penghapusan ditolak: Barang ini masih terdaftar secara aktif sebagai bahan resep di modul HPP.');
  }

  // 2. Gunakan transaction untuk membersihkan price_history (auto-generated)
  // Tabel transaksional (seperti PO, log inventori) dibiarkan; jika item pernah dipakai,
  // Foreign Key di database akan memicu error 23503 sehingga gagal dihapus.
  try {
    return await withTransaction(async (client) => {
      await client.query(`DELETE FROM price_history WHERE item_id = $1`, [id]);
      const result = await client.query(`DELETE FROM items WHERE id = $1`, [id]);
      return (result.rowCount ?? 0) > 0;
    });
  } catch (e: any) {
    if (e.code === '23503') {
      throw new Error('Barang sudah dipakai ditransaksi. Silakan ubah ke Nonaktif.');
    }
    throw e;
  }
}

export async function generateBarcode(id: number): Promise<string> {
  const padded = String(id).padStart(6, '0');
  const code = `ERC${padded}`;
  await query(`UPDATE items SET barcode = $1, updated_at = now() WHERE id = $2`, [code, id]);
  return code;
}

export async function getCurrentStock(itemId: number, client?: PoolClient): Promise<number> {
  const q = client ? client.query.bind(client) : query;
  const result = await q(
    `SELECT ending_balance FROM inventory_logs WHERE item_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [itemId]
  );
  return Number(result.rows[0]?.ending_balance ?? 0);
}

export async function bulkUpdateItemVenues(itemIds: number[], isGlobal?: boolean | null, venueIds?: number[] | null): Promise<void> {
  if (!itemIds || itemIds.length === 0) return;

  await withTransaction(async (client) => {
    // 1. Update is_global if provided
    if (typeof isGlobal === 'boolean') {
      await client.query(`UPDATE items SET is_global = $1, updated_at = now() WHERE id = ANY($2::int[])`, [isGlobal, itemIds]);
    }

    // 2. Update venue mappings if provided
    if (Array.isArray(venueIds)) {
      await client.query(`DELETE FROM item_venues WHERE item_id = ANY($1::int[])`, [itemIds]);
      
      if (venueIds.length > 0) {
        // Build efficient bulk insert: (item1, venue1), (item1, venue2), (item2, venue1), ...
        // Using UNNEST with two parallel arrays
        const insertItemIds: number[] = [];
        const insertVenueIds: number[] = [];
        for (const item_id of itemIds) {
          for (const venue_id of venueIds) {
            insertItemIds.push(item_id);
            insertVenueIds.push(venue_id);
          }
        }
        
        await client.query(
          `INSERT INTO item_venues (item_id, venue_id) SELECT * FROM UNNEST($1::int[], $2::int[])`,
          [insertItemIds, insertVenueIds]
        );
      }
    }
  });
}
