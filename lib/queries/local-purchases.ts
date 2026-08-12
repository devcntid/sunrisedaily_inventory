import { query, withTransaction } from '@/lib/db';
import { PoolClient } from 'pg';

export interface LocalPurchaseItem {
  item_id: number;
  qty: number;
  price_per_unit: number;
  subtotal: number;
}

export async function createLocalPurchase(
  outletId: number,
  purchaseDate: string,
  receiptUrl: string,
  totalAmount: number,
  items: LocalPurchaseItem[]
) {
  return withTransaction(async (client: PoolClient) => {
    // 1. Insert local purchase
    const purchaseRes = await client.query(
      `INSERT INTO outlet_local_purchases (outlet_id, purchase_date, receipt_url, total_amount)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [outletId, purchaseDate, receiptUrl, totalAmount]
    );
    const purchaseId = purchaseRes.rows[0].id;

    for (const item of items) {
      // Get conversion ratio
      const itemRes = await client.query(`SELECT conversion_ratio FROM items WHERE id = $1`, [item.item_id]);
      const conversionRatio = Number(itemRes.rows[0]?.conversion_ratio || 1);
      const stockAdded = item.qty * conversionRatio;

      // 2. Insert items
      await client.query(
        `INSERT INTO outlet_local_purchase_items (purchase_id, item_id, qty, price_per_unit, subtotal)
         VALUES ($1, $2, $3, $4, $5)`,
        [purchaseId, item.item_id, item.qty, item.price_per_unit, item.subtotal]
      );

      // 3. Get current physical stock to calculate ending balance and HPP
      const stockRes = await client.query(
        `SELECT current_balance FROM outlet_stocks WHERE outlet_id = $1 AND item_id = $2`,
        [outletId, item.item_id]
      );
      const currentQty = stockRes.rows.length > 0 ? Number(stockRes.rows[0].current_balance) : 0;
      const newQty = currentQty + stockAdded;

      // 4. Upsert into outlet_stocks
      await client.query(
        `INSERT INTO outlet_stocks (outlet_id, item_id, current_balance, updated_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         ON CONFLICT (outlet_id, item_id) DO UPDATE SET current_balance = EXCLUDED.current_balance, updated_at = EXCLUDED.updated_at`,
        [outletId, item.item_id, newQty]
      );

      // 5. Log movement into outlet_inventory_logs
      await client.query(
        `INSERT INTO outlet_inventory_logs (outlet_id, item_id, movement_type, qty_change, ending_balance, reference_type, reference_id)
         VALUES ($1, $2, 'LOCAL_PURCHASE', $3, $4, 'OUTLET_LOCAL_PURCHASE', $5)`,
        [outletId, item.item_id, stockAdded, newQty, purchaseId]
      );

      // 6. Recalculate Global HPP (items.current_average_price)
      const globalStockRes = await client.query(
        `SELECT 
           COALESCE((SELECT ending_balance FROM inventory_logs WHERE item_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1), 0) +
           COALESCE((SELECT SUM(current_balance) FROM outlet_stocks WHERE item_id = $1), 0) AS total_stock`,
        [item.item_id]
      );
      const totalStock = Number(globalStockRes.rows[0]?.total_stock || 0);
      const oldStock = Math.max(0, totalStock - stockAdded);

      const hppRes = await client.query(
        `SELECT current_average_price FROM items WHERE id = $1 FOR UPDATE`,
        [item.item_id]
      );
      const currentAvg = Number(hppRes.rows[0]?.current_average_price || 0);

      // Price per unit for HPP calculation should be based on the smallest unit
      const pricePerSmallestUnit = item.price_per_unit / conversionRatio;
      const newAvg = totalStock === 0 ? 0 : ((oldStock * currentAvg) + (stockAdded * pricePerSmallestUnit)) / totalStock;

      await client.query(
        `UPDATE items SET current_average_price = $1, last_purchase_price = $2, updated_at = NOW() WHERE id = $3`,
        [newAvg, pricePerSmallestUnit, item.item_id]
      );

      // If it's a brand (has parent), update the parent's HPP as well
      const parentCheck = await client.query(`SELECT parent_id FROM items WHERE id = $1`, [item.item_id]);
      const parentId = parentCheck.rows[0]?.parent_id;
      if (parentId) {
        // Fetch parent global stock
        const parentStockRes = await client.query(
          `SELECT 
             COALESCE((SELECT ending_balance FROM inventory_logs WHERE item_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1), 0) +
             COALESCE((SELECT SUM(current_balance) FROM outlet_stocks WHERE item_id = $1), 0) AS total_stock`,
          [parentId]
        );
        const parentTotalStock = Number(parentStockRes.rows[0]?.total_stock || 0);
        const parentOldStock = Math.max(0, parentTotalStock - stockAdded);

        const parentHppRes = await client.query(`SELECT current_average_price FROM items WHERE id = $1 FOR UPDATE`, [parentId]);
        const parentCurrentAvg = Number(parentHppRes.rows[0]?.current_average_price || 0);
        
        const parentNewAvg = parentTotalStock === 0 ? 0 : ((parentOldStock * parentCurrentAvg) + (stockAdded * pricePerSmallestUnit)) / parentTotalStock;

        await client.query(
          `UPDATE items SET current_average_price = $1, last_purchase_price = $2, updated_at = NOW() WHERE id = $3`,
          [parentNewAvg, pricePerSmallestUnit, parentId]
        );
      }
    }

    // 7. Sync Menus HPP
    const itemIdsToSync = new Set<number>();
    for (const i of items) {
       itemIdsToSync.add(i.item_id);
       const pc = await client.query(`SELECT parent_id FROM items WHERE id = $1`, [i.item_id]);
       if (pc.rows[0]?.parent_id) itemIdsToSync.add(pc.rows[0].parent_id);
    }
    const itemIds = Array.from(itemIdsToSync);

    if (itemIds.length > 0) {
      await client.query(`
        UPDATE recipe_ingredients ri
        SET cost_per_unit = COALESCE(it.current_average_price, i.standard_cost_per_unit),
            extension = ri.quantity * COALESCE(it.current_average_price, i.standard_cost_per_unit)
        FROM ingredients i
        LEFT JOIN items it ON i.item_id = it.id
        WHERE ri.ingredient_id = i.id AND i.item_id = ANY($1::int[])
      `, [itemIds]);

      await client.query(`
        WITH recipe_totals AS (
          SELECT recipe_id, SUM(extension) as total_cost FROM recipe_ingredients GROUP BY recipe_id
        )
        UPDATE recipes r
        SET total_cost = rt.total_cost
        FROM recipe_totals rt WHERE r.id = rt.recipe_id AND r.id IN (
          SELECT recipe_id FROM recipe_ingredients ri 
          JOIN ingredients i ON ri.ingredient_id = i.id 
          WHERE i.item_id = ANY($1::int[])
        )
      `, [itemIds]);

      await client.query(`
        WITH recipe_totals AS (
          SELECT recipe_id, SUM(extension) as total_cost FROM recipe_ingredients GROUP BY recipe_id
        )
        UPDATE menus m
        SET hpp = r.total_cost / NULLIF(r.yield, 0),
            hpp_ratio = (r.total_cost / NULLIF(r.yield, 0)) / NULLIF(m.sale_price, 0)
        FROM recipes r
        JOIN recipe_totals rt ON r.id = rt.recipe_id
        WHERE m.id = r.menu_id AND r.id IN (
          SELECT recipe_id FROM recipe_ingredients ri 
          JOIN ingredients i ON ri.ingredient_id = i.id 
          WHERE i.item_id = ANY($1::int[])
        )
      `, [itemIds]);
    }

    return purchaseId;
  });
}

export async function getLocalPurchases(outletId?: number, date?: string) {
  let sql = `
    SELECT 
      p.id, p.outlet_id, o.name as outlet_name, p.purchase_date, p.receipt_url, p.total_amount, p.created_at,
      json_agg(
        json_build_object(
          'id', pi.id,
          'item_id', pi.item_id,
          'item_name', i.name,
          'qty', pi.qty,
          'price_per_unit', pi.price_per_unit,
          'subtotal', pi.subtotal
        )
      ) as items
    FROM outlet_local_purchases p
    JOIN outlets o ON p.outlet_id = o.id
    LEFT JOIN outlet_local_purchase_items pi ON p.id = pi.purchase_id
    LEFT JOIN items i ON pi.item_id = i.id
  `;
  const params: any[] = [];
  const conditions: string[] = [];
  let paramIdx = 1;

  if (outletId) {
    conditions.push(`p.outlet_id = $${paramIdx++}`);
    params.push(outletId);
  }
  
  if (date) {
    conditions.push(`p.purchase_date = $${paramIdx++}`);
    params.push(date);
  }

  if (conditions.length > 0) {
    sql += ` WHERE ` + conditions.join(' AND ');
  }

  sql += `
    GROUP BY p.id, o.name 
    ORDER BY p.purchase_date DESC, p.created_at DESC
  `;

  const res = await query(sql, params);
  return res.rows;
}

export async function getUnreadLocalPurchaseCount(): Promise<number> {
  const res = await query(`SELECT COUNT(*) as count FROM outlet_local_purchases WHERE is_read_by_central = false`);
  return parseInt(res.rows[0].count, 10);
}

export async function markAllLocalPurchasesRead(): Promise<void> {
  await query(`UPDATE outlet_local_purchases SET is_read_by_central = true WHERE is_read_by_central = false`);
}

