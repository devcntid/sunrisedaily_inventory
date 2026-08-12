import { query, withTransaction } from '../db';

/**
 * outlet_inventory_logs.movement_type valid values (not documented in DB — tracked here):
 *   'IN'    — Penerimaan barang dari Delivery Order (processPublicReceive)
 *   'ADJ'   — Penyesuaian dari Stock Opname Outlet (lockStockCount OUTLET)
 *   'SALES' — Pemotongan otomatis dari penjualan Moka POS (deductOutletStockFromSales)
 *
 * outlet_inventory_logs.reference_type valid values:
 *   'PUBLIC_RECEIVE'    — Konfirmasi penerimaan DO oleh outlet
 *   'OPNAME_ADJUSTMENT' — Penyesuaian dari stock opname outlet
 *   'MOKA_SALES'        — Pemotongan bahan dari transaksi Moka POS
 */

export type OutletStockRow = {
  item_id: number;
  item_name: string;
  category_name: string;
  current_balance: number;
  purchase_unit: string;
  smallest_unit: string;
  minimum_threshold: number | null;
  target_stock: number;
  barcode: string | null;
  incoming_balance?: number;
  conversion_ratio?: number;
  has_stock_history?: boolean;
  is_custom_threshold?: boolean;
};

export async function getOutletStocks(outletId: number): Promise<OutletStockRow[]> {
  // WARN-03 Fix: Gunakan LATERAL JOIN + agregasi inline untuk menghitung incoming_balance
  // alih-alih correlated subquery per baris yang berjalan N kali (sekali per item).
  const result = await query<OutletStockRow>(`
    SELECT DISTINCT
      i.id AS item_id,
      i.name AS item_name,
      c.name AS category_name,
      i.purchase_unit,
      i.smallest_unit,
      i.conversion_ratio,
      i.barcode,
      i.target_stock,
      COALESCE(os.current_balance, 0)::numeric AS current_balance,
      (os.outlet_id IS NOT NULL) AS has_stock_history,
      (ois.minimum_threshold IS NOT NULL) AS is_custom_threshold,
      COALESCE(ois.minimum_threshold, i.minimum_threshold) AS minimum_threshold,
      COALESCE(agg_in.incoming_balance, 0)::numeric AS incoming_balance
    FROM items i
    LEFT JOIN categories c ON c.id = i.category_id
    LEFT JOIN outlet_stocks os ON os.item_id = i.id AND os.outlet_id = $1
    LEFT JOIN outlet_item_settings ois ON ois.item_id = i.id AND ois.outlet_id = $1
    LEFT JOIN ingredients ing ON (ing.id = i.ingredient_id OR ing.item_id = i.id)
    LEFT JOIN recipe_ingredients ri ON ri.ingredient_id = ing.id
    LEFT JOIN recipes r ON r.id = ri.recipe_id
    LEFT JOIN outlet_venues ov ON ov.venue_id = r.venue_id AND ov.outlet_id = $1
    -- Join untuk filter item non-global berdasarkan venue outlet
    LEFT JOIN outlets out_venue ON out_venue.id = $1
    LEFT JOIN item_venues iv ON iv.item_id = i.id AND iv.venue_id = out_venue.venue_id
    -- WARN-03 Fix: JOIN ke subquery agregat (bukan correlated subquery per-baris)
    LEFT JOIN (
      SELECT oi.item_id, SUM(COALESCE(oi.approved_smallest_qty, oi.smallest_unit_qty)) AS incoming_balance
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.outlet_id = $1
        AND oi.item_status IN ('PROSES_BELANJA', 'READY_DI_GUDANG', 'DIKIRIM')
        AND o.status NOT IN ('COMPLETED', 'DIBATALKAN')
      GROUP BY oi.item_id
    ) agg_in ON agg_in.item_id = i.id
    WHERE i.is_active = true
      AND i.parent_id IS NULL -- Outlet hanya melihat stok Induk
      AND (
        -- Item global: tampil untuk semua outlet
        i.is_global = TRUE
        -- Item non-global: hanya tampil jika venue outlet cocok dengan item_venues
        OR iv.item_id IS NOT NULL
        -- Sudah pernah ada stok di outlet ini (tetap tampilkan meski venue berubah)
        OR os.outlet_id IS NOT NULL
        OR ois.outlet_id IS NOT NULL
        OR ov.outlet_id IS NOT NULL
      )
    ORDER BY c.name, i.name
  `, [outletId]);
  return result.rows;
}


export async function deductOutletStockFromSales(outletId: number, dateStr: string) {
  // dateStr format: YYYY-MM-DD
  return withTransaction(async (client) => {
    // Find all transactions for this outlet on this date that haven't been deducted
    const trxRes = await client.query(`
      SELECT id 
      FROM moka_transactions
      WHERE outlet_id = $1 
        AND created_at AT TIME ZONE 'Asia/Jakarta' >= $2::DATE 
        AND created_at AT TIME ZONE 'Asia/Jakarta' < ($2::DATE + INTERVAL '1 day')
        AND is_stock_deducted = false
    `, [outletId, dateStr]);

    if (trxRes.rows.length === 0) return { count: 0, itemsDeducted: 0, ingredientsDeducted: 0 };
    
    const trxIds = trxRes.rows.map(r => r.id);

    // Get aggregated sold items that HAVE been mapped
    const itemsRes = await client.query(`
      SELECT 
        miv.internal_recipe_id, 
        MAX(mti.item_name) as item_name,
        SUM(mti.quantity) as total_qty
      FROM moka_transaction_items mti
      JOIN moka_item_variants miv ON miv.id = mti.item_variant_id
      WHERE mti.transaction_id = ANY($1)
        AND miv.internal_recipe_id IS NOT NULL
      GROUP BY miv.internal_recipe_id
    `, [trxIds]);

    let totalIngredientsDeducted = 0;
    const unmatchedMenus: string[] = [];

    for (const item of itemsRes.rows) {
      const qtySold = Number(item.total_qty);
      if (qtySold <= 0) continue;

      // Tarik bahan-bahan langsung dari resep yang sudah ditautkan di Katalog Moka
      const ingRes = await client.query(`
        SELECT i.id as ingredient_id, SUM(ri.quantity) as quantity
        FROM recipe_ingredients ri
        JOIN ingredients ing ON ing.id = ri.ingredient_id
        JOIN items i ON (i.id = ing.item_id OR i.ingredient_id = ing.id)
        WHERE ri.recipe_id = $1
        GROUP BY i.id
      `, [item.internal_recipe_id]);

      if (ingRes.rows.length === 0) {
        unmatchedMenus.push(item.item_name);
      }

      for (const ing of ingRes.rows) {
        const qtyToDeduct = Number(ing.quantity) * qtySold;
        
        // Ensure record in outlet_stocks exists
        await client.query(`
          INSERT INTO outlet_stocks (outlet_id, item_id, current_balance)
          VALUES ($1, $2, 0)
          ON CONFLICT (outlet_id, item_id) DO NOTHING
        `, [outletId, ing.ingredient_id]);

        // Lock and deduct
        const stockRes = await client.query(`
          UPDATE outlet_stocks
          SET current_balance = current_balance - $3, updated_at = NOW()
          WHERE outlet_id = $1 AND item_id = $2
          RETURNING current_balance
        `, [outletId, ing.ingredient_id, qtyToDeduct]);

        const newBalance = stockRes.rows[0].current_balance;

        // Log deduction
        await client.query(`
          INSERT INTO outlet_inventory_logs 
          (outlet_id, item_id, movement_type, qty_change, ending_balance, reference_type)
          VALUES ($1, $2, 'SALES', $3, $4, 'MOKA_SALES')
        `, [outletId, ing.ingredient_id, -qtyToDeduct, newBalance]);
        
        totalIngredientsDeducted++;
      }
    }

    // Mark as deducted
    await client.query(`
      UPDATE moka_transactions
      SET is_stock_deducted = true
      WHERE id = ANY($1)
    `, [trxIds]);

    return { 
      count: trxIds.length, 
      itemsDeducted: itemsRes.rows.length,
      ingredientsDeducted: totalIngredientsDeducted,
      unmatchedMenus
    };
  });
}


/**
 * Upsert minimum threshold untuk satu item di satu outlet.
 * Digunakan oleh Admin Outlet untuk mengatur batas stok minimal per item.
 */
export async function upsertOutletItemSetting(data: {
  outlet_id: number;
  item_id: number;
  minimum_threshold: number | null;
}): Promise<void> {
  await query(
    `INSERT INTO outlet_item_settings (outlet_id, item_id, minimum_threshold, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (outlet_id, item_id) DO UPDATE
     SET minimum_threshold = EXCLUDED.minimum_threshold,
         updated_at = NOW()`,
    [data.outlet_id, data.item_id, data.minimum_threshold]
  );
}
