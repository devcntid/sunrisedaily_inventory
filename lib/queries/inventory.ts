import { query, withTransaction } from '@/lib/db';
import type { PoolClient } from 'pg';
import { checkAndCreateAlert } from './alerts';
import { autoFulfillPendingRequests } from './orders';

export interface InventoryLog {
  id: number;
  item_id: number;
  item_name?: string;
  movement_type: string;
  qty_change: number;
  ending_balance: number;
  reference_type: string;
  reference_id?: number;
  created_at: string;
}

export interface PriceHistory {
  id: number;
  item_id: number;
  item_name?: string;
  vendor_id?: number;
  vendor_name?: string;
  purchase_date: string;
  purchase_qty: number;
  unit_purchase_price: number;
  new_average_price: number;
  purchase_order_item_id?: number;
  created_at: string;
}

export async function receiveGoods(input: {
  item_id: number;
  qty: number;
  vendor_id: number;
  unit_purchase_price: number;
  purchase_order_item_id?: number;
}) {
  const { item_id, qty, vendor_id, unit_purchase_price, purchase_order_item_id } = input;

  return withTransaction(async (client) => {
    // 1. Get current average price & stock (row lock to secure against race conditions)
    const current = await client.query(
      `SELECT current_average_price, conversion_ratio,
              (SELECT ending_balance FROM inventory_logs WHERE item_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1) AS last_balance
       FROM items WHERE id = $1 FOR UPDATE`,
      [item_id]
    );

    const oldAvg = parseFloat(current.rows[0]?.current_average_price ?? '0');
    const oldBalance = parseFloat(current.rows[0]?.last_balance ?? '0');
    const ratio = parseFloat(current.rows[0]?.conversion_ratio || 1);

    const actualQty = qty * ratio;
    const actualUnitPrice = unit_purchase_price / ratio;

    // 2. Calculate Moving Average (abaikan stok negatif dalam perhitungan rata-rata tertimbang)
    const effectiveOldBalance = oldBalance > 0 ? oldBalance : 0;
    const effectiveNewBalance = effectiveOldBalance + actualQty;
    const oldValue = oldAvg * effectiveOldBalance;
    const newValue = actualUnitPrice * actualQty;
    const newAvgPrice = effectiveNewBalance > 0 ? (oldValue + newValue) / effectiveNewBalance : actualUnitPrice;
    const newBalance = oldBalance + actualQty;

    // 3. Update price cache in items
    await client.query(
      `UPDATE items SET current_average_price = $1, updated_at = now() WHERE id = $2`,
      [newAvgPrice, item_id]
    );

    // 4. Insert stock mutation log
    await client.query(
      `INSERT INTO inventory_logs (item_id, movement_type, qty_change, ending_balance, reference_type, reference_id)
       VALUES ($1, 'IN', $2, $3, 'RECEIPT', $4)`,
      [item_id, actualQty, newBalance, input.purchase_order_item_id || null]
    );

    // Auto fulfill pending outlet requests if stock arrived
    await autoFulfillPendingRequests(client, item_id, newBalance);

    // Check reorder point to resolve any open alerts
    await checkAndCreateAlert(item_id, newBalance, client);

    // 5. Insert price history
    await client.query(
      `INSERT INTO price_history (item_id, vendor_id, purchase_date, purchase_qty, unit_purchase_price, new_average_price, purchase_order_item_id)
       VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6)`,
      [item_id, vendor_id, actualQty, actualUnitPrice, newAvgPrice, purchase_order_item_id ?? null]
    );

    return { newAvgPrice, newBalance };
  });
}

export async function getInventoryCard(itemId: number, limit = 50, offset = 0) {
  const result = await query(
    `SELECT il.*, i.name AS item_name,
            dn.id AS do_id, dn.delivery_note_number AS do_number,
            po.id AS po_id, po.po_number AS po_number
     FROM inventory_logs il
     LEFT JOIN items i ON i.id = il.item_id
     LEFT JOIN delivery_note_items dni ON (il.reference_type = 'BARCODE_SCAN' OR il.reference_type = 'BULK_SHIP') AND il.reference_id = dni.id
     LEFT JOIN delivery_notes dn ON dn.id = dni.delivery_note_id
     LEFT JOIN goods_receipts gr ON il.reference_type = 'RECEIPT' AND il.reference_id = gr.id
     LEFT JOIN purchase_orders po ON po.id = gr.purchase_order_id
     WHERE il.item_id = $1
     ORDER BY il.created_at DESC
     LIMIT $2 OFFSET $3`,
    [itemId, limit, offset]
  );
  return result.rows;
}

export async function getPriceHistory(opts?: { itemId?: number; vendorId?: number; limit?: number }) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  if (opts?.itemId) { conditions.push(`ph.item_id = $${i++}`); params.push(opts.itemId); }
  if (opts?.vendorId) { conditions.push(`ph.vendor_id = $${i++}`); params.push(opts.vendorId); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitClause = opts?.limit ? `LIMIT $${i++}` : 'LIMIT 100';
  if (opts?.limit) params.push(opts.limit);

  const result = await query<any>(
    `SELECT ph.*, i.name AS item_name, i.purchase_unit, v.name AS vendor_name
     FROM price_history ph
     LEFT JOIN items i ON i.id = ph.item_id
     LEFT JOIN vendors v ON v.id = ph.vendor_id
     ${where}
     ORDER BY ph.purchase_date DESC, ph.created_at DESC
     ${limitClause}`,
    params
  );
  return result.rows;
}

export async function outboundStock(input: {
  item_id: number;
  qty: number;
  reference_type: string;
  reference_id?: number;
  distribution_price?: number;
}, client?: PoolClient) {
  const doQuery = client ? client.query.bind(client) : query;

  const balanceRes = await doQuery(
    `SELECT ending_balance FROM inventory_logs WHERE item_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1`,
    [input.item_id]
  );
  const currentBalance = parseFloat(balanceRes.rows[0]?.ending_balance ?? '0');
  const newBalance = currentBalance - input.qty;

  await doQuery(
    `INSERT INTO inventory_logs (item_id, movement_type, qty_change, ending_balance, reference_type, reference_id)
     VALUES ($1, 'OUT', $2, $3, $4, $5)`,
    [input.item_id, -input.qty, newBalance, input.reference_type, input.reference_id ?? null]
  );

  // Check reorder point
  await checkAndCreateAlert(input.item_id, newBalance, client);

  return newBalance;
}

export async function adjustStock(input: {
  item_id: number;
  qty_change: number; // positive = surplus, negative = shortage
  reference_id: number;
  client: PoolClient;
}) {
  const { item_id, qty_change, reference_id, client } = input;

  const balanceRes = await client.query(
    `SELECT ending_balance FROM inventory_logs WHERE item_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1`,
    [item_id]
  );
  const currentBalance = parseFloat(balanceRes.rows[0]?.ending_balance ?? '0');
  const newBalance = currentBalance + qty_change;

  await client.query(
    `INSERT INTO inventory_logs (item_id, movement_type, qty_change, ending_balance, reference_type, reference_id)
     VALUES ($1, 'ADJ', $2, $3, 'OPNAME_ADJUSTMENT', $4)`,
    [item_id, qty_change, newBalance, reference_id]
  );

  if (qty_change < 0) {
    await checkAndCreateAlert(item_id, newBalance, client);
  } else if (qty_change > 0) {
    try {
      await autoFulfillPendingRequests(client, item_id, newBalance);
    } catch (err) {
      console.error('Error autoFulfillPendingRequests in adjustStock:', err);
    }
    await checkAndCreateAlert(item_id, newBalance, client);
  }

  return newBalance;
}

export async function getInventoryReport(month: number, year: number) {
  const result = await query(
    `SELECT 
       i.name AS item_name,
       c.name AS category_name,
       SUM(CASE WHEN il.movement_type = 'IN' THEN il.qty_change ELSE 0 END) AS total_in_qty,
       SUM(CASE WHEN il.movement_type = 'OUT' AND il.reference_type IN ('BARCODE_SCAN', 'BULK_SHIP', 'ATOMIC_TRANSFER', 'PUBLIC_SCAN_OUT') THEN ABS(il.qty_change) ELSE 0 END) AS total_distribution_qty,
       SUM(CASE WHEN il.movement_type = 'ADJ' THEN il.qty_change ELSE 0 END) AS total_adj_qty,
       i.current_average_price,
       (SELECT ending_balance FROM inventory_logs WHERE item_id = i.id ORDER BY created_at DESC, id DESC LIMIT 1) AS current_balance
     FROM inventory_logs il
     LEFT JOIN items i ON i.id = il.item_id
     LEFT JOIN categories c ON c.id = i.category_id
     WHERE EXTRACT(MONTH FROM il.created_at) = $1
       AND EXTRACT(YEAR FROM il.created_at) = $2
     GROUP BY i.id, i.name, c.name, i.current_average_price
     ORDER BY c.name, i.name`,
    [month, year]
  );
  return result.rows;
}

// BUG-06 Fix: Gunakan JOIN ke items alih-alih correlated subquery per-baris.
// Versi lama menjalankan satu subquery `SELECT current_average_price FROM items WHERE id = item_id`
// untuk setiap baris di inventory_logs (N+1 query). Sekarang single query dengan JOIN.
export async function getInventoryValueTrend(currentTotalValue: number) {
  const res = await query(
    `SELECT 
       DATE(il.created_at) as date,
       SUM(il.qty_change * i.current_average_price) as daily_value_change,
       SUM(CASE WHEN il.movement_type = 'OUT' THEN ABS(il.qty_change) * i.current_average_price ELSE 0 END) as daily_outbound_value
     FROM inventory_logs il
     JOIN items i ON i.id = il.item_id
     WHERE il.created_at >= CURRENT_DATE - INTERVAL '6 days'
     GROUP BY DATE(il.created_at)
     ORDER BY date ASC`
  );

  const changesByDate: Record<string, { change: number, outbound: number }> = {};
  for (const row of res.rows) {
    const d = new Date(row.date);
    const dateStr = d.toISOString().split('T')[0];
    changesByDate[dateStr] = {
      change: parseFloat(row.daily_value_change || '0'),
      outbound: parseFloat(row.daily_outbound_value || '0'),
    };
  }

  const trend = [];
  let runningValue = currentTotalValue;

  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    
    trend.unshift({
      date: dateStr,
      value: runningValue,
      outboundValue: changesByDate[dateStr]?.outbound || 0,
    });
    
    const todaysChange = changesByDate[dateStr]?.change || 0;
    runningValue -= todaysChange;
  }


  return trend;
}

/**
 * Menetapkan saldo awal stok gudang pusat (Opening Balance).
 * Setiap item akan mendapatkan satu log OB yang menyesuaikan saldo ke angka
 * yang diberikan pengguna (input dalam satuan kemasan, dikonversi ke satuan terkecil).
 * Jika saldo sudah sama dengan target, tidak ada log yang dibuat.
 */
export async function setOpeningBalance(
  items: Array<{ item_id: number; actual_qty: number }>
): Promise<{ processed: number; skipped: number }> {
  return withTransaction(async (client) => {
    // Filter valid items
    const validItems = items.filter(
      i => !isNaN(Number(i.item_id)) && !isNaN(Number(i.actual_qty)) && Number(i.actual_qty) > 0
    );
    if (validItems.length === 0) return { processed: 0, skipped: items.length };

    const itemIds = validItems.map(i => Number(i.item_id));

    // Fetch conversion_ratio untuk semua item sekaligus (bulk)
    const itemDataRes = await client.query(
      `SELECT id, conversion_ratio FROM items WHERE id = ANY($1::int[])`,
      [itemIds]
    );
    const itemDataMap = new Map<number, number>();
    for (const row of itemDataRes.rows) {
      itemDataMap.set(Number(row.id), parseFloat(row.conversion_ratio || '1'));
    }

    // Fetch saldo terakhir di inventory_logs untuk semua item sekaligus (bulk)
    const lastBalRes = await client.query(
      `SELECT DISTINCT ON (item_id) item_id, ending_balance
       FROM inventory_logs WHERE item_id = ANY($1::int[])
       ORDER BY item_id, created_at DESC, id DESC`,
      [itemIds]
    );
    const balanceMap = new Map<number, number>();
    for (const row of lastBalRes.rows) {
      balanceMap.set(Number(row.item_id), parseFloat(row.ending_balance));
    }

    // Hitung qty_change per item
    const log_itemIds: number[] = [];
    const log_movTypes: string[] = [];
    const log_qtyChanges: number[] = [];
    const log_endingBals: number[] = [];

    let skipped = 0;
    for (const item of validItems) {
      const id = Number(item.item_id);
      const ratio = itemDataMap.get(id) ?? 1;
      const qty_in_smallest = Number(item.actual_qty) * ratio;
      const existingStock = balanceMap.get(id) ?? 0;
      const qty_change = qty_in_smallest - existingStock;

      if (qty_change === 0) { skipped++; continue; }

      log_itemIds.push(id);
      log_movTypes.push(qty_change > 0 ? 'IN' : 'OUT');
      log_qtyChanges.push(qty_change);
      log_endingBals.push(qty_in_smallest);
    }

    // Bulk INSERT semua log sekaligus (satu query, bukan N query per item)
    if (log_itemIds.length > 0) {
      await client.query(
        `INSERT INTO inventory_logs (item_id, movement_type, qty_change, ending_balance, reference_type, reference_id)
         SELECT u.item_id, u.mov, u.qty_change, u.ending_bal, 'OB', NULL
         FROM UNNEST($1::int[], $2::varchar[], $3::numeric[], $4::numeric[]) AS u(item_id, mov, qty_change, ending_bal)`,
        [log_itemIds, log_movTypes, log_qtyChanges, log_endingBals]
      );
    }

    return { processed: log_itemIds.length, skipped };
  });
}

export async function getCombinedStockReport(search: string | null) {
  let sql = `
    SELECT 
      i.id, i.name as item_name, c.name as category_name, i.category_id,
      i.smallest_unit, i.purchase_unit, i.conversion_ratio, i.minimum_threshold,
      COALESCE((SELECT ending_balance FROM inventory_logs il WHERE il.item_id = i.id ORDER BY il.created_at DESC, id DESC LIMIT 1), 0)::numeric AS central_stock,
      COALESCE((SELECT SUM(current_balance) FROM outlet_stocks os WHERE os.item_id = i.id), 0)::numeric AS outlet_stock,
      COALESCE((SELECT jsonb_object_agg(os.outlet_id::text, os.current_balance) FROM outlet_stocks os WHERE os.item_id = i.id), '{}'::jsonb) AS outlet_stocks_map,
      i.current_average_price
    FROM items i
    LEFT JOIN categories c ON c.id = i.category_id
    WHERE i.is_active = TRUE
    AND i.parent_id IS NULL  -- Hanya tampilkan Induk; stok Brand sudah tercatat di Induk
  `;
  
  const params: any[] = [];
  if (search) {
    params.push(`%${search}%`);
    sql += ` AND i.name ILIKE $1`;
  }
  
  sql += ` ORDER BY i.name ASC`;
  
  const res = await query(sql, params);
  return res.rows;
}

export async function getActiveOutlets(): Promise<{ id: number; name: string }[]> {
  const res = await query(`SELECT id, name FROM outlets ORDER BY name ASC`);
  return res.rows as { id: number; name: string }[];
}

