import { query } from '@/lib/db';
import type { PoolClient } from 'pg';

export async function checkAndCreateAlert(
  itemId: number,
  currentBalance: number,
  client?: PoolClient
) {
  const doQuery = client ? client.query.bind(client) : query;

  // Get item threshold settings
  const itemRes = await doQuery(
    `SELECT minimum_threshold, threshold_type, computed_threshold_cache FROM items WHERE id = $1`,
    [itemId]
  );
  const item = itemRes.rows[0];
  if (!item) return;

  let threshold = parseFloat(item.minimum_threshold ?? '0');

  if (item.threshold_type === 'PERSENTASE') {
    if (item.computed_threshold_cache) {
      threshold = parseFloat(item.computed_threshold_cache);
    } else {
      // Calculate from last 3 months avg distribution
      const avgRes = await doQuery(
        `SELECT COALESCE(SUM(ABS(qty_change)) / 3.0, 0) AS avg_monthly
         FROM inventory_logs
         WHERE item_id = $1 AND movement_type = 'OUT' AND reference_type = 'ORDER'
           AND created_at >= now() - INTERVAL '3 months'`,
        [itemId]
      );
      const avgMonthly = parseFloat(avgRes.rows[0]?.avg_monthly ?? '0');
      threshold = (parseFloat(item.minimum_threshold) / 100) * avgMonthly;
    }
  }

  if (currentBalance > threshold) {
    await doQuery(`UPDATE stock_alerts SET is_resolved = TRUE WHERE item_id = $1 AND is_resolved = FALSE`, [itemId]);
    return;
  }

  // Check if alert already open
  const existingRes = await doQuery(
    `SELECT id FROM stock_alerts WHERE item_id = $1 AND is_resolved = FALSE LIMIT 1`,
    [itemId]
  );
  if (existingRes.rows.length > 0) return;

  // Create alert
  await doQuery(
    `INSERT INTO stock_alerts (item_id, balance_at_alert, threshold_at_alert) VALUES ($1, $2, $3)`,
    [itemId, currentBalance, threshold]
  );
}

export async function checkAndCreateAlertBulk(triggerActions: {itemId: number, newStock: number}[], client?: PoolClient) {
  if (triggerActions.length === 0) return;
  const doQuery = client ? client.query.bind(client) : query;
  
  const itemIds = triggerActions.map(t => t.itemId);

  const itemRes = await doQuery(`
    SELECT id, minimum_threshold, threshold_type, computed_threshold_cache 
    FROM items 
    WHERE id = ANY($1::int[])
    AND parent_id IS NULL  -- Hanya proses alert untuk Induk, bukan Brand
  `, [itemIds]);

  // IMPORTANT: PostgreSQL returns all IDs as strings. Cast to Number so that Map lookups
  // with numeric keys (from triggerActions) work correctly.
  const itemsMap = new Map(itemRes.rows.map((r: any) => [Number(r.id), r]));

  // Also get existing unresolved alerts
  const existingRes = await doQuery(`
    SELECT id, item_id FROM stock_alerts WHERE item_id = ANY($1::int[]) AND is_resolved = FALSE
  `, [itemIds]);
  const existingAlertsMap = new Map(existingRes.rows.map((r: any) => [Number(r.item_id), r.id]));

  const alertsToResolve: number[] = [];
  const alertsToInsert: {itemId: number, balance: number, threshold: number}[] = [];

  // We need avg monthly for PERSENTASE type items that don't have cache. Let's do it in bulk.
  const itemsNeedsAvg = itemRes.rows.filter((r: any) => r.threshold_type === 'PERSENTASE' && !r.computed_threshold_cache).map((r: any) => r.id);
  const avgMap = new Map<number, number>();
  if (itemsNeedsAvg.length > 0) {
    const avgRes = await doQuery(`
      SELECT item_id, COALESCE(SUM(ABS(qty_change)) / 3.0, 0) AS avg_monthly
      FROM inventory_logs
      WHERE item_id = ANY($1::int[]) AND movement_type = 'OUT' AND reference_type = 'ORDER'
        AND created_at >= now() - INTERVAL '3 months'
      GROUP BY item_id
    `, [itemsNeedsAvg]);
    for (const row of avgRes.rows) {
      avgMap.set(Number(row.item_id), parseFloat(row.avg_monthly));
    }
  }

  for (const t of triggerActions) {
    const item = itemsMap.get(t.itemId);
    if (!item) continue;
    
    let threshold = parseFloat(item.minimum_threshold ?? '0');
    if (item.threshold_type === 'PERSENTASE') {
      if (item.computed_threshold_cache) {
        threshold = parseFloat(item.computed_threshold_cache);
      } else {
        const avgMonthly = avgMap.get(t.itemId) || 0;
        threshold = (parseFloat(item.minimum_threshold) / 100) * avgMonthly;
      }
    }

    if (t.newStock > threshold) {
      // should resolve
      if (existingAlertsMap.has(t.itemId)) {
        alertsToResolve.push(t.itemId);
      }
    } else {
      // should alert
      if (!existingAlertsMap.has(t.itemId)) {
        alertsToInsert.push({ itemId: t.itemId, balance: t.newStock, threshold });
      }
    }
  }

  if (alertsToResolve.length > 0) {
    await doQuery(`UPDATE stock_alerts SET is_resolved = TRUE WHERE item_id = ANY($1::int[]) AND is_resolved = FALSE`, [alertsToResolve]);
  }

  if (alertsToInsert.length > 0) {
    const insItemIds = alertsToInsert.map(a => a.itemId);
    const insBalances = alertsToInsert.map(a => a.balance);
    const insThresholds = alertsToInsert.map(a => a.threshold);
    
    await doQuery(`
      INSERT INTO stock_alerts (item_id, balance_at_alert, threshold_at_alert)
      SELECT * FROM UNNEST($1::int[], $2::numeric[], $3::numeric[])
    `, [insItemIds, insBalances, insThresholds]);
  }
}

export async function getAlerts(opts?: { resolved?: boolean }) {
  const where = opts?.resolved !== undefined ? `WHERE sa.is_resolved = $1` : `WHERE sa.is_resolved = FALSE`;
  const params = opts?.resolved !== undefined ? [opts.resolved] : [];

  const result = await query(
    `SELECT sa.*, i.name AS item_name, i.smallest_unit, i.purchase_unit, i.conversion_ratio, i.minimum_threshold, i.threshold_type,
            i.current_average_price, c.name AS category_name,
            (SELECT ending_balance FROM inventory_logs WHERE item_id = i.id ORDER BY created_at DESC LIMIT 1) AS current_balance
     FROM stock_alerts sa
     LEFT JOIN items i ON i.id = sa.item_id
     LEFT JOIN categories c ON c.id = i.category_id
     ${where}
     AND (i.parent_id IS NULL OR i.id IS NULL)  -- Hanya tampilkan alert untuk Induk, bukan Brand
     ORDER BY sa.created_at DESC`,
    params
  );
  return result.rows;
}

export async function resolveAlert(alertId: number, referencePoId?: number) {
  const result = await query(
    `UPDATE stock_alerts SET is_resolved = TRUE, reference_po_id = $2 WHERE id = $1 RETURNING *`,
    [alertId, referencePoId ?? null]
  );
  return result.rows[0] ?? null;
}

export async function getUnresolvedAlertCount(): Promise<number> {
  const result = await query(
    `SELECT COUNT(*)::int AS cnt FROM stock_alerts WHERE is_resolved = FALSE`
  );
  return result.rows[0]?.cnt ?? 0;
}
