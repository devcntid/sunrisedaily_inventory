import { query, withTransaction } from '@/lib/db';



export type SalesSummaryRow = {
  menu_id: bigint;
  display_name: string;
  category_name: string;
  sale_price: number;
  total_qty: number;
  total_revenue: number;
};

export type SalesHistoryRow = {
  transaction_id: string;
  created_at: Date;
  receipt_number: string | null;
  payment_type: string | null;
  payment_type_label: string | null;
  collected_by: string | null;
  served_by: string | null;
  total_items: number;
  total_revenue: number;
};

export type IngredientRequirementRow = {
  ingredient_id: bigint;
  ingredient_name: string;
  item_id: bigint | null;
  item_name: string | null;
  category_name: string | null;
  total_raw_qty: number;
  default_unit: string | null;
};

/**
 * Mendapatkan matriks penjualan produk per outlet.
 * Hasilnya: { menu_id, menu_name, category_name, sale_price, outlets: { [outlet_id]: qty }, total_qty }
 */
export async function getProductSalesMatrix(dateFrom: string, dateTo: string, categoryId?: number, search?: string) {
  let queryStr = `
    SELECT 
      m.id AS menu_id,
      m.name AS menu_name,
      c.name AS category_name,
      m.sale_price,
      st.outlet_id,
      SUM(sti.qty)::int AS total_qty
    FROM sales_transaction_items sti
    JOIN sales_transactions st ON st.id = sti.sales_transaction_id
    JOIN menus m ON m.id = sti.menu_id
    LEFT JOIN menu_categories c ON c.id = m.category_id
    WHERE DATE(st.transaction_date) >= $1 AND DATE(st.transaction_date) <= $2
  `;
  const params: unknown[] = [dateFrom, dateTo];
  let paramIndex = 3;

  if (categoryId) {
    queryStr += ` AND m.category_id = $${paramIndex}`;
    params.push(categoryId);
    paramIndex++;
  }

  if (search) {
    queryStr += ` AND m.name ILIKE $${paramIndex}`;
    params.push(`%${search}%`);
    paramIndex++;
  }

  queryStr += ` GROUP BY m.id, m.name, c.name, m.sale_price, st.outlet_id`;

  const res = await query(queryStr, params);

  // Transform data in memory
  const map = new Map<number, any>();
  for (const row of res.rows) {
    const mId = Number(row.menu_id);
    if (!map.has(mId)) {
      map.set(mId, {
        menu_id: mId,
        menu_name: row.menu_name,
        category_name: row.category_name,
        sale_price: Number(row.sale_price),
        outlets: {},
        total_qty: 0
      });
    }
    const record = map.get(mId)!;
    const qty = Number(row.total_qty);
    record.outlets[row.outlet_id] = qty;
    record.total_qty += qty;
  }

  return Array.from(map.values()).sort((a, b) => b.total_qty - a.total_qty);
}

/**
 * Mendapatkan ringkasan penjualan (Summary) per menu dalam rentang tanggal tertentu
 * Hanya menampilkan menu yang terjual di rentang tersebut.
 */
export async function getSalesSummary(outletId: number, dateFrom: string, dateTo: string): Promise<SalesSummaryRow[]> {
  const res = await query<SalesSummaryRow>(`
    SELECT 
      m.id AS menu_id,
      COALESCE(m.display_name, m.name, mti.item_name) AS display_name,
      COALESCE(c.name, mti.category_name) AS category_name,
      mti.price AS sale_price,
      SUM(mti.quantity)::numeric AS total_qty,
      SUM(mti.gross_sales)::numeric AS total_revenue
    FROM moka_transaction_items mti
    JOIN moka_transactions mt ON mt.id = mti.transaction_id
    LEFT JOIN menus m ON m.name = mti.item_name
    LEFT JOIN menu_categories c ON c.id = m.category_id
    WHERE mt.outlet_id = $1
      AND mt.created_at AT TIME ZONE 'Asia/Jakarta' >= $2::DATE 
      AND mt.created_at AT TIME ZONE 'Asia/Jakarta' < ($3::DATE + INTERVAL '1 day')
    GROUP BY m.id, mti.category_name, c.name, m.display_name, m.name, mti.item_name, mti.price
    ORDER BY total_revenue DESC
  `, [outletId, dateFrom, dateTo]);
  return res.rows;
}

/**
 * Mendapatkan riwayat detail per item transaksi di outlet dalam rentang tanggal.
 */
export async function getSalesHistory(outletId: number, dateFrom: string, dateTo: string): Promise<SalesHistoryRow[]> {
  const queryStr = `
    SELECT 
      MAX(mt.id) AS transaction_id,
      MAX(mt.created_at) AS created_at,
      mt.payment_no AS receipt_number,
      MAX(mt.payment_type) AS payment_type,
      MAX(mt.payment_type_label) AS payment_type_label,
      MAX(mt.collected_by) AS collected_by,
      MAX(mt.served_by) AS served_by,
      SUM(mti.quantity)::numeric AS total_items,
      MAX(mt.total_collected)::numeric AS total_revenue
    FROM moka_transactions mt
    LEFT JOIN moka_transaction_items mti ON mti.transaction_id = mt.id
    WHERE mt.outlet_id = $1
      AND mt.created_at AT TIME ZONE 'Asia/Jakarta' >= $2::DATE
      AND mt.created_at AT TIME ZONE 'Asia/Jakarta' < ($3::DATE + INTERVAL '1 day')
    GROUP BY mt.payment_no
    ORDER BY MAX(mt.created_at) DESC
  `;
  const res = await query<SalesHistoryRow>(queryStr, [outletId, dateFrom, dateTo]);
  return res.rows;
}

export type TransactionDetailHeader = {
  id: string;
  payment_no: string | null;
  payment_type: string | null;
  payment_type_label: string | null;
  total_collected: number;
  subtotal: number;
  discounts: number;
  gratuities: number;
  taxes: number;
  tendered: number;
  change_amount: number;
  transaction_date: string | null;
  transaction_time: string | null;
  collected_by: string | null;
  served_by: string | null;
  outlet_name: string | null;
  is_refunded: boolean;
  created_at: Date;
};

export type TransactionDetailItem = {
  uuid: string;
  item_name: string;
  item_variant_name: string | null;
  category_name: string | null;
  quantity: number;
  price: number;
  gross_sales: number;
  net_sales: number;
};

export async function getTransactionDetail(transactionId: string) {
  const headerRes = await query<TransactionDetailHeader>(`
    SELECT 
      t.id, t.payment_no, t.payment_type, t.payment_type_label,
      t.total_collected::numeric AS total_collected,
      t.subtotal::numeric AS subtotal,
      t.discounts::numeric AS discounts,
      t.gratuities::numeric AS gratuities,
      t.taxes::numeric AS taxes,
      t.tendered::numeric AS tendered,
      t.change_amount::numeric AS change_amount,
      t.transaction_date, t.transaction_time,
      t.collected_by, t.served_by, COALESCE(o.name, t.outlet_name) AS outlet_name,
      t.is_refunded, t.created_at
    FROM moka_transactions t
    LEFT JOIN outlets o ON o.id = t.outlet_id
    WHERE t.id = $1
  `, [transactionId]);

  if (headerRes.rows.length === 0) return null;

  const itemsRes = await query<TransactionDetailItem>(`
    SELECT 
      uuid, item_name, item_variant_name, category_name,
      quantity::numeric AS quantity, price::numeric AS price,
      gross_sales::numeric AS gross_sales, net_sales::numeric AS net_sales
    FROM moka_transaction_items
    WHERE transaction_id = $1
    ORDER BY uuid ASC
  `, [transactionId]);

  return {
    header: headerRes.rows[0],
    items: itemsRes.rows
  };
}

/**
 * Menghitung kebutuhan bahan baku berdasarkan sales.
 * Alur: Sales Menu -> Recipe -> Recipe Ingredients -> Ingredients -> Items
 */
export async function getSalesIngredientRequirements(outletId: number, dateFrom: string, dateTo: string): Promise<IngredientRequirementRow[]> {
  // 1. Ambil summary menu terjual
  const sales = await getSalesSummary(outletId, dateFrom, dateTo);
  if (sales.length === 0) return [];

  const menuIds = sales.map(s => Number(s.menu_id));

  // 2. Ambil komposisi resep untuk semua menu yang terjual
  const res = await query(`
    SELECT 
      r.menu_id,
      ri.ingredient_id,
      i.name AS ingredient_name,
      i.default_unit,
      ri.quantity AS qty_per_recipe,
      r.yield AS recipe_yield,
      it.id AS item_id,
      it.name AS item_name,
      cat.name AS category_name
    FROM recipes r
    JOIN recipe_ingredients ri ON ri.recipe_id = r.id
    JOIN ingredients i ON i.id = ri.ingredient_id
    LEFT JOIN items it ON (it.ingredient_id = i.id OR it.id = i.item_id)
    LEFT JOIN categories cat ON cat.id = it.category_id
    WHERE r.menu_id = ANY($1::bigint[])
  `, [menuIds]);

  const recipeData = res.rows;

  // 3. Kalkulasi: (Qty Menu Terjual / Recipe Yield) * Qty Ingredient
  const reqMap = new Map<number, IngredientRequirementRow>();

  for (const s of sales) {
    const menuId = Number(s.menu_id);
    const qtySold = Number(s.total_qty);

    // Cari bahan baku untuk menu ini
    const ingredientsForMenu = recipeData.filter(r => Number(r.menu_id) === menuId);

    for (const ing of ingredientsForMenu) {
      const ingId = Number(ing.ingredient_id);
      const yieldFactor = Number(ing.recipe_yield) || 1;
      const rawQtyNeeded = (qtySold / yieldFactor) * Number(ing.qty_per_recipe);

      if (!reqMap.has(ingId)) {
        reqMap.set(ingId, {
          ingredient_id: BigInt(ingId),
          ingredient_name: ing.ingredient_name,
          item_id: ing.item_id ? BigInt(ing.item_id) : null,
          item_name: ing.item_name,
          category_name: ing.category_name,
          total_raw_qty: 0,
          default_unit: ing.default_unit
        });
      }

      reqMap.get(ingId)!.total_raw_qty += rawQtyNeeded;
    }
  }

  // Convert map ke array dan filter yang tidak punya item (karena request ke Gudang butuh Item ID)
  return Array.from(reqMap.values()).sort((a, b) => b.total_raw_qty - a.total_raw_qty);
}

export async function getSalesEstimationData(outletId: number) {
  // 1. Get all mapped Moka Items (Variants) for this outlet and their recipes
  const mokaItemsRes = await query(`
    SELECT 
      mv.id as moka_item_id,
      CASE WHEN mv.name = 'Regular' OR mv.name IS NULL THEN mi.name ELSE mi.name || ' - ' || mv.name END as moka_item_name,
      mv.internal_recipe_id,
      r.yield_unit
    FROM moka_item_variants mv
    JOIN moka_items mi ON mv.item_id = mi.id
    LEFT JOIN recipes r ON r.id = mv.internal_recipe_id
    WHERE mi.outlet_id = $1 AND mv.internal_recipe_id IS NOT NULL
    ORDER BY moka_item_name
  `, [outletId]);

  const mokaItems = mokaItemsRes.rows;
  if (mokaItems.length === 0) return { mokaItems: [], ingredients: [], stockMap: {} };

  // 2. Get all recipe ingredients for the mapped recipes, joining with ingredients to get item_id
  const recipeIds = [...new Set(mokaItems.map(m => m.internal_recipe_id))];
  const ingredientsRes = await query(`
    SELECT 
      ri.recipe_id,
      ri.ingredient_id,
      ing.item_id,
      ri.quantity,
      i.name as ingredient_name,
      i.smallest_unit
    FROM recipe_ingredients ri
    JOIN ingredients ing ON ing.id = ri.ingredient_id
    LEFT JOIN items i ON i.id = ing.item_id
    WHERE ri.recipe_id = ANY($1::int[])
  `, [recipeIds]);

  const ingredients = ingredientsRes.rows;

  // 3. Get current stock for these inventory items at this outlet
  const itemIds = [...new Set(ingredients.map(i => i.item_id).filter(Boolean))];
  const stockRes = await query(`
    SELECT 
      item_id,
      COALESCE(current_balance, 0)::numeric AS current_balance
    FROM outlet_stocks
    WHERE outlet_id = $1 AND item_id = ANY($2::int[])
  `, [outletId, itemIds.length > 0 ? itemIds : [-1]]);

  const stockMap: Record<number, number> = {};
  for (const row of stockRes.rows) {
    stockMap[Number(row.item_id)] = Number(row.current_balance);
  }

  return {
    mokaItems,
    ingredients,
    stockMap
  };
}
