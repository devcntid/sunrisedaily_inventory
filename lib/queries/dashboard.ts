import { query } from '@/lib/db';

export async function getDashboardStats(role: string, outletId: number | null) {
  try {
    const [ordersRes, poRes, itemsRes, alertsRes, stockValRes] = await Promise.all([
      query(
        role === 'ADMIN_PUSAT'
          ? `SELECT status, COUNT(*)::int AS cnt FROM orders GROUP BY status`
          : `SELECT status, COUNT(*)::int AS cnt FROM orders WHERE outlet_id = $1 GROUP BY status`,
        role === 'ADMIN_PUSAT' ? [] : [outletId]
      ),
      role === 'ADMIN_PUSAT' 
        ? query(`SELECT COUNT(*)::int AS cnt FROM purchase_orders WHERE status IN ('RFQ', 'RFQ_TERKIRIM')`) 
        : Promise.resolve({ rows: [{ cnt: 0 }] }),
      query(`SELECT COUNT(*)::int AS cnt FROM items WHERE is_active = TRUE`),
      role === 'ADMIN_PUSAT' ? query(`SELECT COUNT(*)::int AS cnt FROM stock_alerts WHERE is_resolved = FALSE`) : Promise.resolve({ rows: [{ cnt: 0 }] }),
      role === 'ADMIN_PUSAT' ? query(`SELECT COALESCE(SUM(i.current_average_price * il.ending_balance), 0)::numeric AS total_value FROM items i LEFT JOIN LATERAL (SELECT ending_balance FROM inventory_logs WHERE item_id = i.id ORDER BY created_at DESC LIMIT 1) il ON true WHERE i.is_active = TRUE`) : Promise.resolve({ rows: [{ total_value: 0 }] }),
    ]);

    const statusMap: Record<string, number> = {};
    for (const row of ordersRes.rows) {
      statusMap[row.status] = row.cnt;
    }

    return {
      ordersPending: statusMap['PENDING'] ?? 0,
      ordersProcessing: statusMap['PROCESSING'] ?? 0,
      ordersShipped: statusMap['SHIPPED'] ?? 0,
      ordersCompleted: statusMap['COMPLETED'] ?? 0,
      vendorOrdersPending: poRes.rows[0]?.cnt ?? 0,
      totalItems: itemsRes.rows[0]?.cnt ?? 0,
      unresolvedAlerts: alertsRes.rows[0]?.cnt ?? 0,
      stockValue: parseFloat(stockValRes.rows[0]?.total_value ?? '0'),
    };
  } catch {
    return { ordersPending: 0, ordersProcessing: 0, ordersShipped: 0, ordersCompleted: 0, vendorOrdersPending: 0, totalItems: 0, unresolvedAlerts: 0, stockValue: 0 };
  }
}

export async function getRecentOrders(role: string, outletId: number | null) {
  try {
    const result = await query(
      role === 'ADMIN_PUSAT'
        ? `SELECT o.id, o.status, o.order_date, o.delivery_date, outlet.name AS outlet_name, u.name AS created_by_name
           FROM orders o
           LEFT JOIN outlets outlet ON outlet.id = o.outlet_id
           LEFT JOIN users u ON u.id = o.created_by
           ORDER BY o.created_at DESC LIMIT 5`
        : `SELECT o.id, o.status, o.order_date, o.delivery_date, outlet.name AS outlet_name, u.name AS created_by_name
           FROM orders o
           LEFT JOIN outlets outlet ON outlet.id = o.outlet_id
           LEFT JOIN users u ON u.id = o.created_by
           WHERE o.outlet_id = $1
           ORDER BY o.created_at DESC LIMIT 5`,
      role === 'ADMIN_PUSAT' ? [] : [outletId]
    );
    return result.rows;
  } catch { return []; }
}

export async function getRecentAlerts() {
  try {
    const result = await query(
      `SELECT sa.*, i.name AS item_name, i.smallest_unit,
              (SELECT ending_balance FROM inventory_logs WHERE item_id = i.id ORDER BY created_at DESC LIMIT 1) AS current_balance
       FROM stock_alerts sa
       LEFT JOIN items i ON i.id = sa.item_id
       WHERE sa.is_resolved = FALSE
       ORDER BY sa.created_at DESC LIMIT 5`
    );
    return result.rows;
  } catch { return []; }
}

export async function getIncomingPOs() {
  try {
    const result = await query(
      `SELECT po.id, po.po_number, v.name as vendor_name, po.order_deadline, po.status 
       FROM purchase_orders po 
       LEFT JOIN vendors v ON v.id = po.vendor_id 
       WHERE po.status IN ('RFQ', 'RFQ_TERKIRIM') 
       ORDER BY po.order_deadline ASC NULLS LAST LIMIT 5`
    );
    return result.rows;
  } catch { return []; }
}

export async function getFastMovingItems() {
  try {
    const result = await query(
      `SELECT i.name, i.smallest_unit, SUM(ABS(il.qty_change)) as total_out
       FROM inventory_logs il
       JOIN items i ON i.id = il.item_id
       WHERE il.movement_type = 'OUT' AND il.created_at >= CURRENT_DATE - INTERVAL '7 days'
       GROUP BY i.id, i.name, i.smallest_unit
       ORDER BY total_out DESC
       LIMIT 5`
    );
    return result.rows;
  } catch { return []; }
}

export async function getGrossProfitAnalytics() {
  try {
    const result = await query(
      `SELECT 
         o.name AS outlet_name,
         SUM(mis.gross_sales) AS revenue,
         SUM(mis.cogs) AS cogs
       FROM moka_item_sales mis
       JOIN outlets o ON o.id = mis.outlet_id
       WHERE mis.period_start >= CURRENT_DATE - INTERVAL '7 days'
       GROUP BY o.id, o.name
       ORDER BY revenue DESC`
    );
    return result.rows.map(row => {
      const revenue = parseFloat(row.revenue ?? '0');
      const cogs = parseFloat(row.cogs ?? '0');
      const marginPct = revenue > 0 ? ((revenue - cogs) / revenue) * 100 : 0;
      return {
        outletName: row.outlet_name,
        revenue,
        cogs,
        marginPct: Math.round(marginPct)
      };
    });
  } catch { return []; }
}

export async function getPendingIssues() {
  try {
    const result = await query(
      `SELECT i.id, dn.dn_number, o.name as outlet_name, i.issue_type, i.status, i.created_at
       FROM delivery_note_issues i
       JOIN delivery_notes dn ON dn.id = i.delivery_note_id
       JOIN outlets o ON o.id = dn.destination_outlet_id
       WHERE i.status = 'PENDING'
       ORDER BY i.created_at DESC LIMIT 5`
    );
    return result.rows;
  } catch { return []; }
}

export async function getOutletIssues(outletId: number | null) {
  if (!outletId) return [];
  try {
    const result = await query(
      `SELECT i.id, dn.dn_number, i.issue_type, i.status, i.created_at
       FROM delivery_note_issues i
       JOIN delivery_notes dn ON dn.id = i.delivery_note_id
       WHERE dn.destination_outlet_id = $1
       ORDER BY i.created_at DESC LIMIT 5`,
      [outletId]
    );
    return result.rows;
  } catch { return []; }
}

export async function getOutletLowStock(outletId: number | null) {
  if (!outletId) return [];
  try {
    const result = await query(
      `SELECT i.id, i.name, i.smallest_unit, 
              COALESCE(os.current_balance, 0)::numeric AS current_balance, 
              ois.minimum_threshold
       FROM items i
       JOIN outlet_item_settings ois ON ois.item_id = i.id AND ois.outlet_id = $1
       LEFT JOIN outlet_stocks os ON os.item_id = i.id AND os.outlet_id = $1
       WHERE i.is_active = TRUE AND COALESCE(os.current_balance, 0) <= ois.minimum_threshold
       ORDER BY current_balance ASC LIMIT 5`,
      [outletId]
    );
    return result.rows;
  } catch { return []; }
}

export async function getOutletOrderTrend(outletId: number | null) {
  if (!outletId) return [];
  try {
    const result = await query(
      `WITH dates AS (
         SELECT generate_series(
           CURRENT_DATE - INTERVAL '6 days', 
           CURRENT_DATE, 
           '1 day'::interval
         )::date AS dt
       )
       SELECT to_char(d.dt, 'DD Mon') as labelDate, 
              COALESCE(COUNT(o.id), 0)::int as count
       FROM dates d
       LEFT JOIN orders o ON DATE(o.created_at) = d.dt AND o.outlet_id = $1
       GROUP BY d.dt
       ORDER BY d.dt ASC`,
      [outletId]
    );
    return result.rows.map(r => ({ labelDate: r.labeldate, value: r.count }));
  } catch { return []; }
}
