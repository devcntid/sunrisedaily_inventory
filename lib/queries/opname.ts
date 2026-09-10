import { query, withTransaction } from '@/lib/db';
import { adjustStock } from './inventory';

export interface StockCountHeader {
  id: number;
  location_type: string;
  location_id?: number;
  location_name?: string;
  count_date: string;
  pic_id: number;
  pic_name?: string;
  status: string;
  total_value: number;
  general_notes?: string;
  created_at: string;
  updated_at: string;
}

export async function getStockCountHeaders(opts?: { locationType?: string; locationId?: number; status?: string }) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  if (opts?.locationType) { conditions.push(`sch.location_type = $${i++}`); params.push(opts.locationType); }
  if (opts?.locationId) { conditions.push(`sch.location_id = $${i++}`); params.push(opts.locationId); }
  if (opts?.status) { conditions.push(`sch.status = $${i++}`); params.push(opts.status); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query<StockCountHeader>(
    `SELECT sch.*, o.name AS location_name, u.name AS pic_name,
            COALESCE((
              SELECT SUM(scd.variance * COALESCE(i.current_average_price, 0))
              FROM stock_count_details scd
              LEFT JOIN items i ON i.id = scd.item_id
              WHERE scd.header_id = sch.id
            ), sch.total_value, 0)::numeric AS total_value
     FROM stock_count_headers sch
     LEFT JOIN outlets o ON o.id = sch.location_id
     LEFT JOIN users u ON u.id = sch.pic_id
     ${where}
     ORDER BY sch.count_date DESC, sch.created_at DESC`,
    params
  );
  return result.rows;
}

export async function getStockCountHeaderById(id: number) {
  const result = await query(
    `SELECT sch.*, o.name AS location_name, u.name AS pic_name,
            COALESCE((
              SELECT SUM(scd.variance * COALESCE(i.current_average_price, 0))
              FROM stock_count_details scd
              LEFT JOIN items i ON i.id = scd.item_id
              WHERE scd.header_id = sch.id
            ), sch.total_value, 0)::numeric AS total_value
     FROM stock_count_headers sch
     LEFT JOIN outlets o ON o.id = sch.location_id
     LEFT JOIN users u ON u.id = sch.pic_id
     WHERE sch.id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function getStockCountDetails(headerId: number) {
  const result = await query(
    `SELECT scd.*, i.name AS item_name, c.name AS category_name, i.smallest_unit, i.purchase_unit, i.conversion_ratio, i.current_average_price
     FROM stock_count_details scd
     LEFT JOIN items i ON i.id = scd.item_id
     LEFT JOIN categories c ON c.id = i.category_id
     WHERE scd.header_id = $1
     ORDER BY c.name, i.name`,
    [headerId]
  );
  return result.rows;
}

export async function createStockCountSession(data: {
  location_type: string;
  location_id?: number;
  count_date: string;
  pic_id: number;
  general_notes?: string;
}) {
  const result = await query(
    `INSERT INTO stock_count_headers (location_type, location_id, count_date, pic_id, general_notes)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [data.location_type, data.location_id ?? null, data.count_date, data.pic_id, data.general_notes ?? null]
  );
  return result.rows[0];
}

export async function upsertStockCountDetail(data: {
  header_id: number;
  item_id: number;
  system_balance: number;
  actual_physical_qty: number;
  reason_category?: string;
  reason_notes?: string;
}) {
  const variance = data.actual_physical_qty - data.system_balance;

  // Get current avg price for monetary value
  const priceRes = await query(`SELECT current_average_price FROM items WHERE id = $1`, [data.item_id]);
  const avgPrice = parseFloat(priceRes.rows[0]?.current_average_price ?? '0');
  const valueAmount = variance * avgPrice;

  const result = await query(
    `INSERT INTO stock_count_details (header_id, item_id, system_balance, actual_physical_qty, variance, reason_category, reason_notes, value_amount)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (header_id, item_id)
     DO UPDATE SET actual_physical_qty = EXCLUDED.actual_physical_qty, variance = EXCLUDED.variance,
                   reason_category = EXCLUDED.reason_category, reason_notes = EXCLUDED.reason_notes,
                   value_amount = EXCLUDED.value_amount
     RETURNING *`,
    [data.header_id, data.item_id, data.system_balance, data.actual_physical_qty, variance,
     data.reason_category ?? null, data.reason_notes ?? null, valueAmount]
  );
  return result.rows[0];
}

export async function lockStockCount(headerId: number) {
  return withTransaction(async (client) => {
    const headerRes = await client.query(`SELECT * FROM stock_count_headers WHERE id = $1 FOR UPDATE`, [headerId]);
    const header = headerRes.rows[0];
    if (!header) throw new Error('Stock count session not found');
    if (header.status === 'LOCKED') throw new Error('Already locked');

    const locationType = header.location_type;

    const detailsRes = await client.query(
      `SELECT * FROM stock_count_details WHERE header_id = $1`, [headerId]
    );

    let totalValue = 0;

    for (const detail of detailsRes.rows) {
      const variance = parseFloat(detail.variance ?? '0');
      if (variance !== 0) {
        if (locationType === 'PUSAT') {
          // Create ADJ mutation in inventory_logs
          await adjustStock({
            item_id: detail.item_id,
            qty_change: variance,
            reference_id: headerId,
            client,
          });
        } else if (locationType === 'OUTLET' && header.location_id) {
          // Update outlet_stocks menggunakan selisih (variance), persis seperti opname pusat
          const updateRes = await client.query(`
            INSERT INTO outlet_stocks (outlet_id, item_id, current_balance)
            VALUES ($1, $2, $3)
            ON CONFLICT (outlet_id, item_id)
            DO UPDATE SET current_balance = outlet_stocks.current_balance + $4
            RETURNING current_balance
          `, [header.location_id, detail.item_id, detail.actual_physical_qty, variance]);

          const newBalance = updateRes.rows[0].current_balance;

          // Insert log for traceability
          await client.query(`
            INSERT INTO outlet_inventory_logs (outlet_id, item_id, movement_type, qty_change, ending_balance, reference_type, reference_id)
            VALUES ($1, $2, 'ADJ', $3, $4, 'OPNAME_ADJUSTMENT', $5)
          `, [header.location_id, detail.item_id, variance, newBalance, headerId]);
        }
        totalValue += parseFloat(detail.value_amount ?? '0');
      }
    }

    await client.query(
      `UPDATE stock_count_headers SET status = 'LOCKED', total_value = $1, updated_at = now() WHERE id = $2`,
      [totalValue, headerId]
    );

    return { success: true, totalValue };
  });
}

export async function submitStockCount(headerId: number) {
  const result = await query(
    `UPDATE stock_count_headers SET status = 'SUBMITTED', updated_at = now() WHERE id = $1 AND status = 'DRAFT' RETURNING *`,
    [headerId]
  );
  return result.rows[0] ?? null;
}

export async function getItemsForOpname(locationType: string, locationId?: number) {
  if (locationType === 'PUSAT') {
    return query(
      `SELECT i.id AS item_id, i.name AS item_name, i.smallest_unit, c.name AS category_name,
              i.current_average_price, i.purchase_unit, i.conversion_ratio,
              COALESCE((SELECT ending_balance FROM inventory_logs WHERE item_id = i.id ORDER BY created_at DESC LIMIT 1), 0) AS system_balance
       FROM items i
       LEFT JOIN categories c ON c.id = i.category_id
       WHERE i.is_active = TRUE
       AND i.parent_id IS NULL  -- Opname hanya untuk Induk; Brand tidak ditampilkan
       ORDER BY c.name, i.name`
    ).then(r => r.rows);
  } else if (locationType === 'OUTLET' && locationId) {
    return query(
      `SELECT DISTINCT
         i.id AS item_id, i.name AS item_name, i.smallest_unit, i.purchase_unit, i.conversion_ratio, c.name AS category_name,
         i.current_average_price,
         COALESCE(os.current_balance, 0) AS system_balance
       FROM items i
       LEFT JOIN categories c ON c.id = i.category_id
       LEFT JOIN outlet_stocks os ON os.item_id = i.id AND os.outlet_id = $1
       LEFT JOIN outlet_item_settings ois ON ois.item_id = i.id AND ois.outlet_id = $1
       LEFT JOIN ingredients ing ON (ing.id = i.ingredient_id OR ing.item_id = i.id)
       LEFT JOIN recipe_ingredients ri ON ri.ingredient_id = ing.id
       LEFT JOIN recipes r ON r.id = ri.recipe_id
       LEFT JOIN outlet_venues ov ON ov.venue_id = r.venue_id AND ov.outlet_id = $1
       WHERE i.is_active = TRUE
         AND i.parent_id IS NULL
         AND (
           os.outlet_id IS NOT NULL OR 
           ois.outlet_id IS NOT NULL OR 
           ov.outlet_id IS NOT NULL
         )
        ORDER BY c.name, i.name`,
        [locationId]
     ).then(r => r.rows);
   }
   return [];
 }

export async function getTopUsageItemsByOutlet(outletId: number, days: number = 30, limit: number = 10) {
  try {
    const logsRes = await query(
      `SELECT i.id AS item_id, i.name AS item_name, i.smallest_unit, i.purchase_unit, i.conversion_ratio,
              c.name AS category_name, i.current_average_price,
              SUM(ABS(oil.qty_change))::numeric AS total_usage,
              COALESCE(os.current_balance, 0)::numeric AS system_balance
       FROM outlet_inventory_logs oil
       JOIN items i ON i.id = oil.item_id
       LEFT JOIN categories c ON c.id = i.category_id
       LEFT JOIN outlet_stocks os ON os.item_id = i.id AND os.outlet_id = oil.outlet_id
       WHERE oil.outlet_id = $1
         AND (oil.qty_change < 0 OR oil.movement_type IN ('SALES', 'OUT', 'RECIPE_USAGE', 'USAGE', 'ADJ_MINUS'))
         AND oil.created_at >= (CURRENT_DATE - ($2 || ' days')::interval)
         AND i.is_active = TRUE
         AND i.parent_id IS NULL
       GROUP BY i.id, i.name, i.smallest_unit, i.purchase_unit, i.conversion_ratio, c.name, i.current_average_price, os.current_balance
       ORDER BY total_usage DESC
       LIMIT $3`,
      [outletId, days, limit]
    );

    if (logsRes.rows.length >= Math.min(limit, 5)) {
      return logsRes.rows;
    }

    const itemIdsFound = logsRes.rows.map(r => r.item_id);
    const remainingLimit = limit - logsRes.rows.length;

    const fallbackRes = await query(
      `SELECT DISTINCT
         i.id AS item_id, i.name AS item_name, i.smallest_unit, i.purchase_unit, i.conversion_ratio,
         c.name AS category_name, i.current_average_price,
         0::numeric AS total_usage,
         COALESCE(os.current_balance, 0)::numeric AS system_balance
       FROM items i
       LEFT JOIN categories c ON c.id = i.category_id
       LEFT JOIN outlet_stocks os ON os.item_id = i.id AND os.outlet_id = $1
       LEFT JOIN outlet_item_settings ois ON ois.item_id = i.id AND ois.outlet_id = $1
       WHERE i.is_active = TRUE
         AND i.parent_id IS NULL
         AND (os.outlet_id IS NOT NULL OR ois.outlet_id IS NOT NULL)
         ${itemIdsFound.length > 0 ? `AND i.id NOT IN (${itemIdsFound.map((_, idx) => `$${idx + 2}`).join(',')})` : ''}
       ORDER BY system_balance DESC, i.name ASC
       LIMIT $${itemIdsFound.length + 2}`,
      itemIdsFound.length > 0 ? [outletId, ...itemIdsFound, remainingLimit] : [outletId, remainingLimit]
    );

    return [...logsRes.rows, ...fallbackRes.rows];
  } catch (err) {
    console.error('Error fetching top usage items for opname:', err);
    return [];
  }
}

