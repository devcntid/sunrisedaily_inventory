import { query, withTransaction } from '@/lib/db';
import type { PoolClient } from 'pg';

export interface Order {
  id: number;
  outlet_id: number;
  outlet_name?: string;
  order_date: string;
  delivery_date: string;
  status: string;
  created_by: number;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
  item_count?: number;
}

export interface OrderItem {
  id: number;
  order_id: number;
  item_id: number;
  item_name?: string;
  category_name?: string;
  purchase_unit?: string;
  smallest_unit?: string;
  conversion_ratio?: number;
  qty_request: number;
  qty_approved?: number;
  approved_smallest_qty?: number;
  additional_notes?: string;
  center_notes?: string;
  smallest_unit_qty?: number;
  fulfillment_status: string;
  distribution_price?: number;
  current_stock?: number;
  created_at: string;
  updated_at: string;
}

export async function getOrders(opts?: { outletId?: number; status?: string; startDate?: string; endDate?: string; limit?: number; offset?: number }) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  if (opts?.outletId) { conditions.push(`o.outlet_id = $${i++}`); params.push(opts.outletId); }
  if (opts?.status) { conditions.push(`o.status = $${i++}`); params.push(opts.status); }
  if (opts?.startDate) { conditions.push(`o.order_date >= $${i++}`); params.push(opts.startDate); }
  if (opts?.endDate) { conditions.push(`o.order_date <= $${i++}`); params.push(opts.endDate); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitClause = opts?.limit ? `LIMIT $${i++} OFFSET $${i++}` : '';
  if (opts?.limit) { params.push(opts.limit); params.push(opts.offset ?? 0); }

  const result = await query<Order>(
    `SELECT o.*, outlet.name AS outlet_name, u.name AS created_by_name,
            COUNT(oi.id)::int AS item_count
     FROM orders o
     LEFT JOIN outlets outlet ON outlet.id = o.outlet_id
     LEFT JOIN users u ON u.id = o.created_by
     LEFT JOIN order_items oi ON oi.order_id = o.id
     ${where}
     GROUP BY o.id, outlet.name, u.name
     ORDER BY o.created_at DESC
     ${limitClause}`,
    params
  );
  return result.rows;
}

export async function getActiveRequestedItemIds(outletId: number) {
  const result = await query(
    `SELECT DISTINCT oi.item_id 
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE o.outlet_id = $1 
       AND o.status NOT IN ('COMPLETED', 'CANCELLED', 'DIBATALKAN')
       AND oi.item_status NOT IN ('SELESAI', 'DIBATALKAN')`,
    [outletId]
  );
  return result.rows.map(r => Number(r.item_id));
}

export async function getPendingOrderCount() {
  // Valid orders.status values: PENDING, PROCESSING, SHIPPED, COMPLETED
  // PROSES_BELANJA is only valid for order_items.item_status, NOT orders.status
  const result = await query<{ count: string }>(
    `SELECT count(*) FROM orders WHERE status IN ('PENDING', 'PROCESSING')`
  );
  return parseInt(result.rows[0]?.count ?? '0', 10);
}


export async function getOrderById(id: number) {
  const orderResult = await query<Order>(
    `SELECT o.*, outlet.name AS outlet_name, u.name AS created_by_name
     FROM orders o
     LEFT JOIN outlets outlet ON outlet.id = o.outlet_id
     LEFT JOIN users u ON u.id = o.created_by
     WHERE o.id = $1`,
    [id]
  );
  const order = orderResult.rows[0] ?? null;
  if (!order) return null;

  const itemsResult = await query<OrderItem>(
    `SELECT oi.*, i.name AS item_name, c.name AS category_name,
            i.purchase_unit, i.smallest_unit, i.conversion_ratio,
            COALESCE((SELECT ending_balance FROM inventory_logs WHERE item_id = i.id ORDER BY created_at DESC, id DESC LIMIT 1), 0) AS current_stock
     FROM order_items oi
     LEFT JOIN items i ON i.id = oi.item_id
     LEFT JOIN categories c ON c.id = i.category_id
     WHERE oi.order_id = $1
     ORDER BY oi.id`,
    [id]
  );
  return { ...order, items: itemsResult.rows };
}

export async function createOrder(data: {
  outlet_id: number;
  order_date: string;
  delivery_date: string;
  created_by: number;
  items: Array<{ item_id: number; qty_request: number; additional_notes?: string }>;
}) {
  return withTransaction(async (client) => {
    const orderResult = await client.query(
      `INSERT INTO orders (outlet_id, order_date, delivery_date, created_by)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [data.outlet_id, data.order_date, data.delivery_date, data.created_by]
    );
    const order = orderResult.rows[0];

    if (data.items.length > 0) {
      const itemIds = data.items.map(i => i.item_id);
      
      const itemDataRes = await client.query(`
        SELECT i.id, i.conversion_ratio, 
          COALESCE((
            SELECT ending_balance FROM inventory_logs WHERE item_id = i.id ORDER BY created_at DESC, id DESC LIMIT 1
          ), 0) as stock
        FROM items i WHERE i.id = ANY($1::int[])
      `, [itemIds]);
      
      const itemDataMap = new Map();
      for (const row of itemDataRes.rows) {
        itemDataMap.set(Number(row.id), {
          ratio: Number(row.conversion_ratio ?? 1),
          stock: Number(row.stock ?? 0)
        });
      }

      const orderIds: number[] = [];
      const _itemIds: number[] = [];
      const qtyRequests: number[] = [];
      const additionalNotes: (string | null)[] = [];
      const smallestUnitQtys: number[] = [];
      const fulfillmentStatuses: string[] = [];
      const itemStatuses: string[] = [];
      const qtyApproveds: number[] = [];
      const approvedSmallestQtys: number[] = [];

      for (const item of data.items) {
        const { ratio, stock } = itemDataMap.get(Number(item.item_id)) || { ratio: 1, stock: 0 };
        const smallest_unit_qty = item.qty_request * ratio;

        let fulfillment_status = 'TIDAK';
        let item_status = 'PROSES_BELANJA';

        if (stock >= smallest_unit_qty) {
          fulfillment_status = 'SANGGUP';
          item_status = 'READY_DI_GUDANG';
        }

        orderIds.push(order.id);
        _itemIds.push(Number(item.item_id));
        qtyRequests.push(Math.max(0.001, item.qty_request));
        additionalNotes.push(item.additional_notes ?? null);
        smallestUnitQtys.push(smallest_unit_qty);
        fulfillmentStatuses.push(fulfillment_status);
        itemStatuses.push(item_status);
        qtyApproveds.push(Math.max(0.001, item.qty_request));
        approvedSmallestQtys.push(smallest_unit_qty);
      }

      await client.query(
        `INSERT INTO order_items (order_id, item_id, qty_request, additional_notes, smallest_unit_qty, fulfillment_status, item_status, qty_approved, approved_smallest_qty)
         SELECT * FROM UNNEST ($1::int[], $2::int[], $3::numeric[], $4::text[], $5::numeric[], $6::varchar[], $7::varchar[], $8::numeric[], $9::numeric[])`,
        [orderIds, _itemIds, qtyRequests, additionalNotes, smallestUnitQtys, fulfillmentStatuses, itemStatuses, qtyApproveds, approvedSmallestQtys]
      );
    }

    await recalculateOrderStatus(order.id, client);
    
    return order;
  });
}

export async function getOrderRecap(opts?: { status?: string; outletId?: number }) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  if (opts?.status) { conditions.push(`o.status = $${i++}`); params.push(opts.status); }
  if (opts?.outletId) { conditions.push(`o.outlet_id = $${i++}`); params.push(opts.outletId); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  // WARN-04 Fix: Ganti correlated subquery per-baris dengan LEFT JOIN ke subquery
  // yang menghitung ending_balance terbaru sekali untuk semua item (DISTINCT ON).
  const result = await query(
    `SELECT o.id AS order_id, o.outlet_id, outlet.name AS outlet_name, o.order_date, o.delivery_date, o.status,
            oi.id AS order_item_id, oi.item_id, i.name AS item_name, i.barcode, i.purchase_unit, i.smallest_unit, i.conversion_ratio,
            oi.qty_request, oi.qty_approved, oi.smallest_unit_qty, oi.approved_smallest_qty, oi.additional_notes, oi.center_notes, oi.fulfillment_status, oi.item_status, oi.distribution_price,
            c.name AS category_name, i.current_average_price,
            COALESCE(latest_bal.ending_balance, 0) AS current_stock
     FROM orders o
     LEFT JOIN outlets outlet ON outlet.id = o.outlet_id
     LEFT JOIN order_items oi ON oi.order_id = o.id
     LEFT JOIN items i ON i.id = oi.item_id
     LEFT JOIN categories c ON c.id = i.category_id
     -- WARN-04 Fix: JOIN ke saldo terbaru per item (bukan correlated subquery per baris)
     LEFT JOIN (
       SELECT DISTINCT ON (item_id) item_id, ending_balance
       FROM inventory_logs
       ORDER BY item_id, created_at DESC, id DESC
     ) latest_bal ON latest_bal.item_id = i.id
     ${where}
     ORDER BY o.created_at DESC, outlet.name, i.name`,
    params
  );
  return result.rows;
}


export async function updateOrderItemStatus(
  orderItemId: number,
  updates: Partial<{ item_status: string; fulfillment_status: string; distribution_price: number; qty_approved: number; approved_smallest_qty: number; center_notes: string }>
) {
  return withTransaction(async (client) => {
    const fields = Object.keys(updates).filter(key => (updates as Record<string, unknown>)[key] !== undefined);
    if (!fields.length) return null;
    const sets = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const values = fields.map(f => (updates as Record<string, unknown>)[f]);
    const result = await client.query(
      `UPDATE order_items SET ${sets}, updated_at = now() WHERE id = $1 RETURNING *`,
      [orderItemId, ...values]
    );
    const item = result.rows[0];
    if (item) await recalculateOrderStatus(item.order_id, client);
    return item;
  });
}

export async function recalculateOrderStatus(orderId: number, client: PoolClient) {
  const itemsRes = await client.query(
    `SELECT item_status FROM order_items WHERE order_id = $1`, [orderId]
  );
  const statuses = itemsRes.rows.map((r: { item_status: string }) => r.item_status);
  if (!statuses.length) return;

  let newStatus = 'PENDING';
  if (statuses.every((s: string) => s === 'SELESAI')) newStatus = 'COMPLETED';
  else if (statuses.every((s: string) => s === 'DIKIRIM' || s === 'SELESAI')) newStatus = 'SHIPPED';
  else if (statuses.some((s: string) => ['PROSES_BELANJA', 'READY_DI_GUDANG', 'DIKIRIM', 'SELESAI'].includes(s))) newStatus = 'PROCESSING';

  await client.query(
    `UPDATE orders SET status = $1, updated_at = now() WHERE id = $2`,
    [newStatus, orderId]
  );
}

export async function autoFulfillPendingRequests(client: PoolClient, itemId: number, currentStock: number) {
  // Ambil semua request Outlet (order_items) yang masih PROSES_BELANJA (atau PENDING), diurutkan dari yang paling lama
  const pendingRes = await client.query(`
    SELECT oi.id, oi.order_id, COALESCE(oi.approved_smallest_qty, oi.smallest_unit_qty) as needed_qty
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE oi.item_id = $1 
      AND oi.item_status IN ('PROSES_BELANJA', 'PENDING')
      AND oi.fulfillment_status != 'SANGGUP'
      AND o.status NOT IN ('COMPLETED', 'CANCELLED', 'DIBATALKAN')
    ORDER BY oi.created_at ASC
  `, [itemId]);

  let availableStock = currentStock;
  const updatedOrderIds = new Set<number>();

  for (const row of pendingRes.rows) {
    const neededQty = parseFloat(row.needed_qty || '0');
    if (!isNaN(neededQty) && neededQty > 0 && availableStock >= neededQty) {
      // Stock cukup untuk fulfill request ini
      await client.query(`
        UPDATE order_items 
        SET fulfillment_status = 'SANGGUP', item_status = 'READY_DI_GUDANG', updated_at = now() 
        WHERE id = $1
      `, [row.id]);
      
      availableStock -= neededQty;
      updatedOrderIds.add(row.order_id);
    }
  }

  for (const orderId of updatedOrderIds) {
    await recalculateOrderStatus(orderId, client);
  }
}

export async function recalculateOrderStatusBulk(orderIds: number[], client: PoolClient) {
  if (!orderIds.length) return;
  const itemsRes = await client.query(
    `SELECT order_id, item_status FROM order_items WHERE order_id = ANY($1::int[])`, 
    [orderIds]
  );
  const orderStatuses = new Map<number, string[]>();
  for (const row of itemsRes.rows) {
    if (!orderStatuses.has(row.order_id)) orderStatuses.set(row.order_id, []);
    orderStatuses.get(row.order_id)!.push(row.item_status);
  }
  
  for (const orderId of orderIds) {
    const statuses = orderStatuses.get(orderId) || [];
    if (!statuses.length) continue;
    let newStatus = 'PENDING';
    if (statuses.every(s => s === 'SELESAI')) newStatus = 'COMPLETED';
    else if (statuses.every(s => s === 'DIKIRIM' || s === 'SELESAI')) newStatus = 'SHIPPED';
    else if (statuses.some(s => ['PROSES_BELANJA', 'READY_DI_GUDANG', 'DIKIRIM', 'SELESAI'].includes(s))) newStatus = 'PROCESSING';
    
    await client.query(
      `UPDATE orders SET status = $1, updated_at = now() WHERE id = $2`,
      [newStatus, orderId]
    );
  }
}

export async function autoFulfillPendingRequestsBulk(client: PoolClient, triggerActions: {itemId: number, newStock: number}[]) {
  if (triggerActions.length === 0) return;
  const itemIds = triggerActions.map(t => t.itemId);
  
  const pendingRes = await client.query(`
    SELECT oi.id, oi.order_id, oi.item_id, COALESCE(oi.approved_smallest_qty, oi.smallest_unit_qty) as needed_qty
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE oi.item_id = ANY($1::int[]) 
      AND oi.item_status IN ('PROSES_BELANJA', 'PENDING')
      AND oi.fulfillment_status != 'SANGGUP'
      AND o.status NOT IN ('COMPLETED', 'CANCELLED', 'DIBATALKAN')
    ORDER BY oi.created_at ASC
  `, [itemIds]);

  const stockMap = new Map<number, number>();
  for (const t of triggerActions) {
    stockMap.set(t.itemId, t.newStock);
  }

  const updatedOrderItemIds: number[] = [];
  const updatedOrderIds = new Set<number>();

  for (const row of pendingRes.rows) {
    const neededQty = parseFloat(row.needed_qty || '0');
    let availableStock = stockMap.get(row.item_id) || 0;
    if (!isNaN(neededQty) && neededQty > 0 && availableStock >= neededQty) {
      updatedOrderItemIds.push(row.id);
      availableStock -= neededQty;
      stockMap.set(row.item_id, availableStock);
      updatedOrderIds.add(row.order_id);
    }
  }

  if (updatedOrderItemIds.length > 0) {
    await client.query(`
      UPDATE order_items 
      SET fulfillment_status = 'SANGGUP', item_status = 'READY_DI_GUDANG', updated_at = now() 
      WHERE id = ANY($1::int[])
    `, [updatedOrderItemIds]);
  }

  if (updatedOrderIds.size > 0) {
    await recalculateOrderStatusBulk(Array.from(updatedOrderIds), client);
  }
}

export async function getAggregatedRequestsByProduct(opts?: { status?: string; startDate?: string; endDate?: string }) {
  const conditions: string[] = ["oi.item_status IN ('PENDING', 'PROSES_BELANJA')"];
  const params: unknown[] = [];
  let i = 1;

  if (opts?.status) {
    conditions.push(`o.status = $${i++}`);
    params.push(opts.status);
  } else {
    conditions.push(`o.status IN ('PENDING', 'PROCESSING')`);
  }

  if (opts?.startDate) {
    conditions.push(`o.order_date >= $${i++}`);
    params.push(opts.startDate);
  }

  if (opts?.endDate) {
    conditions.push(`o.order_date <= $${i++}`);
    params.push(opts.endDate);
  }

  const whereClause = conditions.join(' AND ');

  const result = await query(
    `SELECT
      i.id AS item_id,
      i.name AS item_name,
      i.purchase_unit AS unit,
      i.smallest_unit,
      i.conversion_ratio,
      SUM(COALESCE(oi.qty_approved, oi.qty_request)) AS total_requested,
      COALESCE(latest.ending_balance, 0) AS central_stock,
      JSON_AGG(
        JSON_BUILD_OBJECT(
          'outlet_name', outlet.name,
          'qty', COALESCE(oi.qty_approved, oi.qty_request),
          'order_id', o.id,
          'order_date', o.order_date
        )
      ) AS breakdown
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     JOIN items i ON i.id = oi.item_id
     LEFT JOIN outlets outlet ON outlet.id = o.outlet_id
     LEFT JOIN LATERAL (
       SELECT ending_balance
       FROM inventory_logs
       WHERE item_id = i.id
       ORDER BY created_at DESC, id DESC
       LIMIT 1
     ) latest ON true
     WHERE ${whereClause}
     GROUP BY i.id, i.name, i.purchase_unit, i.smallest_unit, i.conversion_ratio, latest.ending_balance
     ORDER BY i.name ASC`,
    params
  );
  return result.rows;
}
