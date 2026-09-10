import { query } from '@/lib/db';

export async function getDashboardStats(
  role: string,
  outletId: number | null,
  startDate?: string,
  endDate?: string
) {
  try {
    const hasDateRange = Boolean(startDate && endDate);

    let ordersQuery = '';
    let ordersParams: unknown[] = [];

    if (hasDateRange) {
      if (role === 'ADMIN_PUSAT') {
        ordersQuery = `SELECT status, COUNT(*)::int AS cnt FROM orders WHERE created_at >= $1::date AND created_at < ($2::date + INTERVAL '1 day') GROUP BY status`;
        ordersParams = [startDate, endDate];
      } else {
        ordersQuery = `SELECT status, COUNT(*)::int AS cnt FROM orders WHERE outlet_id = $1 AND created_at >= $2::date AND created_at < ($3::date + INTERVAL '1 day') GROUP BY status`;
        ordersParams = [outletId, startDate, endDate];
      }
    } else {
      if (role === 'ADMIN_PUSAT') {
        ordersQuery = `SELECT status, COUNT(*)::int AS cnt FROM orders GROUP BY status`;
        ordersParams = [];
      } else {
        ordersQuery = `SELECT status, COUNT(*)::int AS cnt FROM orders WHERE outlet_id = $1 GROUP BY status`;
        ordersParams = [outletId];
      }
    }

    const [ordersRes, poRes, itemsRes, alertsRes, stockValRes] = await Promise.all([
      query(ordersQuery, ordersParams),
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

export async function getRecentOrders(
  role: string,
  outletId: number | null,
  startDate?: string,
  endDate?: string
) {
  try {
    const hasDateRange = Boolean(startDate && endDate);

    let sql = '';
    let params: unknown[] = [];

    if (hasDateRange) {
      if (role === 'ADMIN_PUSAT') {
        sql = `SELECT o.id, o.status, o.order_date, o.delivery_date, outlet.name AS outlet_name, u.name AS created_by_name
               FROM orders o
               LEFT JOIN outlets outlet ON outlet.id = o.outlet_id
               LEFT JOIN users u ON u.id = o.created_by
               WHERE o.created_at >= $1::date AND o.created_at < ($2::date + INTERVAL '1 day')
               ORDER BY o.created_at DESC LIMIT 10`;
        params = [startDate, endDate];
      } else {
        sql = `SELECT o.id, o.status, o.order_date, o.delivery_date, outlet.name AS outlet_name, u.name AS created_by_name
               FROM orders o
               LEFT JOIN outlets outlet ON outlet.id = o.outlet_id
               LEFT JOIN users u ON u.id = o.created_by
               WHERE o.outlet_id = $1 AND o.created_at >= $2::date AND o.created_at < ($3::date + INTERVAL '1 day')
               ORDER BY o.created_at DESC LIMIT 10`;
        params = [outletId, startDate, endDate];
      }
    } else {
      if (role === 'ADMIN_PUSAT') {
        sql = `SELECT o.id, o.status, o.order_date, o.delivery_date, outlet.name AS outlet_name, u.name AS created_by_name
               FROM orders o
               LEFT JOIN outlets outlet ON outlet.id = o.outlet_id
               LEFT JOIN users u ON u.id = o.created_by
               ORDER BY o.created_at DESC LIMIT 5`;
        params = [];
      } else {
        sql = `SELECT o.id, o.status, o.order_date, o.delivery_date, outlet.name AS outlet_name, u.name AS created_by_name
               FROM orders o
               LEFT JOIN outlets outlet ON outlet.id = o.outlet_id
               LEFT JOIN users u ON u.id = o.created_by
               WHERE o.outlet_id = $1
               ORDER BY o.created_at DESC LIMIT 5`;
        params = [outletId];
      }
    }

    const result = await query(sql, params);
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

export async function getFastMovingItems(startDate?: string, endDate?: string) {
  try {
    const hasDateRange = Boolean(startDate && endDate);
    let sql = '';
    let params: unknown[] = [];

    if (hasDateRange) {
      sql = `SELECT i.name, i.smallest_unit, SUM(ABS(il.qty_change)) as total_out
             FROM inventory_logs il
             JOIN items i ON i.id = il.item_id
             WHERE il.movement_type = 'OUT' AND il.created_at >= $1::date AND il.created_at < ($2::date + INTERVAL '1 day')
             GROUP BY i.id, i.name, i.smallest_unit
             ORDER BY total_out DESC
             LIMIT 5`;
      params = [startDate, endDate];
    } else {
      sql = `SELECT i.name, i.smallest_unit, SUM(ABS(il.qty_change)) as total_out
             FROM inventory_logs il
             JOIN items i ON i.id = il.item_id
             WHERE il.movement_type = 'OUT' AND il.created_at >= CURRENT_DATE - INTERVAL '7 days'
             GROUP BY i.id, i.name, i.smallest_unit
             ORDER BY total_out DESC
             LIMIT 5`;
      params = [];
    }

    const result = await query(sql, params);
    return result.rows;
  } catch { return []; }
}

export async function getGrossProfitAnalytics(startDate?: string, endDate?: string) {
  try {
    const hasDateRange = Boolean(startDate && endDate);
    let sql = '';
    let params: unknown[] = [];

    if (hasDateRange) {
      sql = `SELECT 
               o.name AS outlet_name,
               COALESCE(SUM(mis.gross_sales), 0) AS revenue,
               COALESCE(SUM(mis.cogs), 0) AS cogs
             FROM outlets o
             LEFT JOIN moka_item_sales mis 
               ON mis.outlet_id = o.id 
               AND mis.period_start >= $1::date 
               AND mis.period_start <= $2::date
             WHERE o.is_active = TRUE AND o.type = 'STORE'
             GROUP BY o.id, o.name
             ORDER BY revenue DESC, o.name ASC`;
      params = [startDate, endDate];
    } else {
      sql = `SELECT 
               o.name AS outlet_name,
               COALESCE(SUM(mis.gross_sales), 0) AS revenue,
               COALESCE(SUM(mis.cogs), 0) AS cogs
             FROM outlets o
             LEFT JOIN moka_item_sales mis 
               ON mis.outlet_id = o.id 
               AND mis.period_start >= CURRENT_DATE - INTERVAL '7 days'
             WHERE o.is_active = TRUE AND o.type = 'STORE'
             GROUP BY o.id, o.name
             ORDER BY revenue DESC, o.name ASC`;
      params = [];
    }

    const result = await query(sql, params);
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
      `SELECT i.id, dn.delivery_note_number AS dn_number, o.name AS outlet_name, i.reason AS issue_type, i.status, i.reported_at AS created_at
       FROM delivery_note_issues i
       JOIN delivery_note_items dni ON i.delivery_note_item_id = dni.id
       JOIN delivery_notes dn ON dni.delivery_note_id = dn.id
       JOIN outlets o ON o.id = dn.outlet_id
       WHERE i.status = 'PENDING'
       ORDER BY i.reported_at DESC LIMIT 5`
    );
    return result.rows;
  } catch { return []; }
}

export async function getOutletIssues(outletId: number | null) {
  if (!outletId) return [];
  try {
    const result = await query(
      `SELECT i.id, dn.delivery_note_number AS dn_number, i.reason AS issue_type, i.status, i.reported_at AS created_at
       FROM delivery_note_issues i
       JOIN delivery_note_items dni ON i.delivery_note_item_id = dni.id
       JOIN delivery_notes dn ON dni.delivery_note_id = dn.id
       WHERE dn.outlet_id = $1
       ORDER BY i.reported_at DESC LIMIT 5`,
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

export async function getOutletOrderTrend(outletId: number | null, startDate?: string, endDate?: string) {
  if (!outletId) return [];
  try {
    const hasDateRange = Boolean(startDate && endDate);
    let sql = '';
    let params: unknown[] = [];

    if (hasDateRange) {
      sql = `WITH dates AS (
               SELECT generate_series(
                 $2::date, 
                 $3::date, 
                 '1 day'::interval
               )::date AS dt
             )
             SELECT to_char(d.dt, 'DD Mon') as labelDate, 
                    COALESCE(COUNT(o.id), 0)::int as count
             FROM dates d
             LEFT JOIN orders o ON DATE(o.created_at) = d.dt AND o.outlet_id = $1
             GROUP BY d.dt
             ORDER BY d.dt ASC`;
      params = [outletId, startDate, endDate];
    } else {
      sql = `WITH dates AS (
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
             ORDER BY d.dt ASC`;
      params = [outletId];
    }

    const result = await query(sql, params);
    return result.rows.map(r => ({ labelDate: r.labeldate, value: r.count }));
  } catch { return []; }
}

