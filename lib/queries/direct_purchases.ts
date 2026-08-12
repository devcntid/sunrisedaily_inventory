import { query, withTransaction } from '@/lib/db';
import { PoolClient } from 'pg';
import { syncMenuHppByItems } from './hpp';

export interface DirectPurchaseInput {
  receipt_number?: string;
  notes?: string;
  created_by: number;
  total_amount: number;
  items: {
    item_id: number;
    brand_id?: number | null;
    shop_name: string;
    qty: number;
    unit: string;
    unit_price: number;
    subtotal: number;
    smallest_qty: number; // for inventory
  }[];
}

export async function createDirectPurchase(input: DirectPurchaseInput) {
  return withTransaction(async (client: PoolClient) => {
    // 1. Insert Direct Purchase
    const dpRes = await client.query(
      `INSERT INTO direct_purchases (receipt_number, notes, created_by, total_amount) 
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [input.receipt_number || null, input.notes || null, input.created_by, input.total_amount]
    );
    const dpId = dpRes.rows[0].id;

    // 2. Insert Items & Update Inventory
    const stockMap = new Map<number, number>();
    const upd_itemIds: number[] = [];

    for (const item of input.items) {
      await client.query(
        `INSERT INTO direct_purchase_items 
         (direct_purchase_id, item_id, brand_id, shop_name, qty, unit, unit_price, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [dpId, item.item_id, item.brand_id || null, item.shop_name, item.qty, item.unit, item.unit_price, item.subtotal]
      );

      // 1. Fetch current stock
      const effectiveItemId = item.brand_id ? item.brand_id : item.item_id;
      let currentStock = stockMap.get(effectiveItemId);
      if (currentStock === undefined) {
        // FIX RACE CONDITION: Lock items before calculating new balance
        await client.query(`SELECT id FROM items WHERE id = $1 FOR UPDATE`, [effectiveItemId]);

        const stockRes = await client.query(
          `SELECT ending_balance FROM inventory_logs WHERE item_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1`,
          [effectiveItemId]
        );
        currentStock = stockRes.rows.length > 0 ? parseFloat(stockRes.rows[0].ending_balance || '0') : 0;
      }
      
      // 2. Fetch current average price
      const itemRes = await client.query(`SELECT current_average_price FROM items WHERE id = $1`, [effectiveItemId]);
      const currentAvgPrice = itemRes.rows.length > 0 ? parseFloat(itemRes.rows[0].current_average_price || '0') : 0;

      // 3. Calculate new Weighted Moving Average (WMA)
      const purchasePricePerSmallestUnit = item.unit_price / (item.smallest_qty / item.qty);
      let newAvgPrice = purchasePricePerSmallestUnit;

      if (currentStock > 0 && currentAvgPrice > 0) {
         const totalCurrentValue = currentStock * currentAvgPrice;
         const totalNewValue = item.smallest_qty * purchasePricePerSmallestUnit;
         newAvgPrice = (totalCurrentValue + totalNewValue) / (currentStock + item.smallest_qty);
      }

      // 4. Update items table
      await client.query(
        `UPDATE items 
         SET 
           last_purchase_price = $1,
           current_average_price = $2
         WHERE id = $3`,
        [purchasePricePerSmallestUnit, newAvgPrice, effectiveItemId]
      );
      upd_itemIds.push(effectiveItemId);

      if (item.brand_id) {

        // Fetch parent's global stock
        const parentStockRes = await client.query(
          `SELECT 
             COALESCE((SELECT ending_balance FROM inventory_logs WHERE item_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1), 0) +
             COALESCE((SELECT SUM(current_balance) FROM outlet_stocks WHERE item_id = $1), 0) AS total_stock`,
          [item.item_id]
        );
        const parentTotalStock = Number(parentStockRes.rows[0]?.total_stock || 0);
        const parentOldStock = Math.max(0, parentTotalStock - item.smallest_qty);

        // Fetch parent's current average price
        const parentHppRes = await client.query(`SELECT current_average_price FROM items WHERE id = $1 FOR UPDATE`, [item.item_id]);
        const parentCurrentAvg = Number(parentHppRes.rows[0]?.current_average_price || 0);

        // Calculate and update parent WMA
        const parentNewAvg = parentTotalStock === 0 ? 0 : ((parentOldStock * parentCurrentAvg) + (item.smallest_qty * purchasePricePerSmallestUnit)) / parentTotalStock;
        await client.query(
          `UPDATE items SET current_average_price = $1, last_purchase_price = $2, updated_at = NOW() WHERE id = $3`,
          [parentNewAvg, purchasePricePerSmallestUnit, item.item_id]
        );
        upd_itemIds.push(item.item_id);
      }

      // 6. Update inventory_logs (Source of Truth for Stock)
      const newStock = currentStock + item.smallest_qty;
      stockMap.set(effectiveItemId, newStock);

      await client.query(
        `INSERT INTO inventory_logs (item_id, movement_type, qty_change, ending_balance, reference_type, reference_id)
         VALUES ($1, 'IN', $2, $3, 'DIRECT_PURCHASE', $4)`,
        [effectiveItemId, item.smallest_qty, newStock, dpId]
      );
    }

    if (upd_itemIds.length > 0) {
      await syncMenuHppByItems(client, upd_itemIds);
    }

    return dpId;
  });
}

export async function getDirectPurchases(params: { startDate?: string; endDate?: string } = {}) {
  let queryText = `
    SELECT dp.*, u.name as created_by_name,
      (SELECT COUNT(*) FROM direct_purchase_items WHERE direct_purchase_id = dp.id) as item_count
    FROM direct_purchases dp
    LEFT JOIN users u ON dp.created_by = u.id
    WHERE 1=1
  `;
  const values: any[] = [];
  let paramIdx = 1;

  if (params.startDate) {
    queryText += ` AND DATE(dp.purchase_date) >= $${paramIdx}`;
    values.push(params.startDate);
    paramIdx++;
  }
  if (params.endDate) {
    queryText += ` AND DATE(dp.purchase_date) <= $${paramIdx}`;
    values.push(params.endDate);
    paramIdx++;
  }

  queryText += ` ORDER BY dp.purchase_date DESC`;

  const res = await query(queryText, values);
  return res.rows;
}

export async function getDirectPurchaseDetails(id: number) {
  const dpRes = await query(
    `SELECT dp.*, u.name as created_by_name
     FROM direct_purchases dp
     LEFT JOIN users u ON dp.created_by = u.id
     WHERE dp.id = $1`,
    [id]
  );
  if (dpRes.rows.length === 0) return null;

  const itemsRes = await query(
    `SELECT dpi.*, i.name as item_name, b.name as brand_name, i.smallest_unit
     FROM direct_purchase_items dpi
     JOIN items i ON dpi.item_id = i.id
     LEFT JOIN items b ON dpi.brand_id = b.id
     WHERE dpi.direct_purchase_id = $1`,
    [id]
  );

  return {
    ...dpRes.rows[0],
    items: itemsRes.rows
  };
}
