import { query } from '@/lib/db';
import type { HppMenu, HppRecipe } from './hpp';

export async function getOutletMenus(outletId: number) {
  // Get venues assigned to this outlet
  const venues = await query('SELECT venue_id FROM outlet_venues WHERE outlet_id = $1', [outletId]);
  if (!venues.rows || venues.rows.length === 0) {
    return [];
  }
  const venueIds = venues.rows.map(r => r.venue_id);

  const recipes = await query(`
    SELECT r.id, r.name, r.yield, r.yield_unit, r.subtotal, r.total_cost, r.sale_price,
           v.name as venue_name, mc.name as category_name
    FROM recipes r
    JOIN venues v ON v.id = r.venue_id
    LEFT JOIN menus m ON m.id = r.menu_id
    LEFT JOIN menu_categories mc ON mc.id = m.category_id
    WHERE r.venue_id = ANY($1)
    ORDER BY v.name ASC, r.name ASC
  `, [venueIds]);

  return recipes.rows;
}

export async function upsertOutletMenuPrice(outletId: number, menuId: number, salePrice: number) {
  await query(`
    INSERT INTO outlet_menu_prices (outlet_id, menu_id, sale_price)
    VALUES ($1, $2, $3)
    ON CONFLICT (outlet_id, menu_id) 
    DO UPDATE SET sale_price = EXCLUDED.sale_price
  `, [outletId, menuId, salePrice]);
}

export async function getOutletMenuDetail(outletId: number, menuId: number) {
  const venuesRes = await query(`SELECT venue_id FROM outlet_venues WHERE outlet_id = $1`, [outletId]);
  const venueIds = venuesRes.rows.map(r => r.venue_id);
  if (!venueIds.length) return null;

  const menuRes = await query(`
    SELECT 
      m.id, m.name, m.variant, m.display_name, m.sale_price AS master_price, m.hpp,
      COALESCE(omp.sale_price, m.sale_price) AS sale_price,
      (omp.sale_price IS NOT NULL) AS is_overridden
    FROM menus m
    LEFT JOIN outlet_menu_prices omp ON omp.menu_id = m.id AND omp.outlet_id = $1
    WHERE m.id = $2
  `, [outletId, menuId]);

  const menu = menuRes.rows[0];
  if (!menu) return null;

  const ingredientsRes = await query(`
    SELECT 
      ri.id, ri.quantity AS qty, ri.unit, 
      ri.cost_per_unit, ri.extension AS cost,
      i.name AS ingredient_name,
      r.id AS recipe_id, r.name AS recipe_name
    FROM recipe_ingredients ri
    JOIN recipes r ON r.id = ri.recipe_id
    JOIN ingredients i ON i.id = ri.ingredient_id
    WHERE r.menu_id = $1 AND r.venue_id = ANY($2)
    ORDER BY ri.sort_order, i.name
  `, [menuId, venueIds]);

  return {
    menu,
    ingredients: ingredientsRes.rows
  };
}

export async function getOutletHppStats(outletId: number) {
  const venuesRes = await query(`SELECT venue_id FROM outlet_venues WHERE outlet_id = $1`, [outletId]);
  const venueIds = venuesRes.rows.map(r => r.venue_id);
  
  if (!venueIds.length) {
    return { totalMenus: 0, totalIngredients: 0, totalRecipes: 0, byVenue: [], marginBreakdown: [] };
  }
  
  const vList = venueIds.join(',');

  const [menus, recipes, byVenue, margin] = await Promise.all([
    query<{ cnt: number }>(`
      SELECT COUNT(DISTINCT m.id)::int AS cnt 
      FROM menus m
      JOIN recipes r ON r.menu_id = m.id
      WHERE r.venue_id IN (${vList})
        AND EXISTS (SELECT 1 FROM moka_items mi WHERE mi.outlet_id = $1 AND mi.name = m.name AND mi.is_deleted IS NOT TRUE)
    `, [outletId]),
    query<{ cnt: number }>(`SELECT COUNT(*)::int AS cnt FROM recipes WHERE venue_id IN (${vList})`),
    query<{ venue: string; count: number }>(`
      SELECT v.id, v.name AS venue, COUNT(DISTINCT r.id)::int AS count
      FROM venues v
      JOIN recipes r ON r.venue_id = v.id
      JOIN menus m ON m.id = r.menu_id
      WHERE v.id IN (${vList})
        AND EXISTS (SELECT 1 FROM moka_items mi WHERE mi.outlet_id = $1 AND mi.name = m.name AND mi.is_deleted IS NOT TRUE)
      GROUP BY v.id, v.name ORDER BY v.id
    `, [outletId]),
    query<{ flag: string; count: number }>(`
      SELECT 
        CASE
          WHEN COALESCE(omp.sale_price, m.sale_price) > 0 THEN
            CASE
              WHEN (m.hpp / COALESCE(omp.sale_price, m.sale_price)) < 0.35 THEN 'GREEN'
              WHEN (m.hpp / COALESCE(omp.sale_price, m.sale_price)) < 0.50 THEN 'YELLOW'
              ELSE 'RED'
            END
          ELSE
            CASE
              WHEN m.hpp_ratio < 0.35 THEN 'GREEN'
              WHEN m.hpp_ratio < 0.50 THEN 'YELLOW'
              ELSE 'RED'
            END
        END AS flag,
        COUNT(DISTINCT m.id)::int AS count
      FROM menus m
      JOIN recipes r ON r.menu_id = m.id
      LEFT JOIN outlet_menu_prices omp ON omp.menu_id = m.id AND omp.outlet_id = $1
      WHERE r.venue_id IN (${vList})
        AND EXISTS (SELECT 1 FROM moka_items mi WHERE mi.outlet_id = $1 AND mi.name = m.name AND mi.is_deleted IS NOT TRUE)
      GROUP BY flag
    `, [outletId]),
  ]);

  // For ingredients, just an approximation of ingredients used in these recipes
  const ingredients = await query<{ cnt: number }>(`
    SELECT COUNT(DISTINCT ri.ingredient_id)::int AS cnt
    FROM recipe_ingredients ri
    JOIN recipes r ON r.id = ri.recipe_id
    JOIN menus m ON m.id = r.menu_id
    WHERE r.venue_id IN (${vList})
      AND EXISTS (SELECT 1 FROM moka_items mi WHERE mi.outlet_id = $1 AND mi.name = m.name AND mi.is_deleted IS NOT TRUE)
  `, [outletId]);

  return {
    totalMenus: menus.rows[0]?.cnt ?? 0,
    totalIngredients: ingredients.rows[0]?.cnt ?? 0,
    totalRecipes: recipes.rows[0]?.cnt ?? 0,
    byVenue: byVenue.rows,
    marginBreakdown: margin.rows,
  };
}

export async function getOutletHppCategories(outletId: number) {
  const venuesRes = await query(`SELECT venue_id FROM outlet_venues WHERE outlet_id = $1`, [outletId]);
  const venueIds = venuesRes.rows.map(r => r.venue_id);
  if (!venueIds.length) return [];
  
  const outletRes = await query(`SELECT name FROM outlets WHERE id = $1`, [outletId]);
  const outletName = outletRes.rows[0]?.name || '';

  const res = await query(`
    SELECT DISTINCT 
      COALESCE(c.name, mi.category_name) AS id, 
      COALESCE(c.name, mi.category_name) AS name
    FROM menus m
    JOIN recipes r ON r.menu_id = m.id
    JOIN (SELECT DISTINCT name, category_name, outlet_id FROM moka_items WHERE is_deleted IS NOT TRUE) mi 
      ON mi.name = m.name AND mi.outlet_id = $2
    LEFT JOIN menu_categories c ON c.id = m.category_id
    WHERE r.venue_id = ANY($1)
      ${!outletName.toLowerCase().includes('cafetaria') ? `AND COALESCE(c.name, mi.category_name) NOT ILIKE '%cafetaria%'` : ''}
      AND COALESCE(c.name, mi.category_name) IS NOT NULL
    ORDER BY COALESCE(c.name, mi.category_name)
  `, [venueIds, outletId]);
  
  return res.rows;
}

export async function getOutletHppVenues(outletId: number) {
  const venuesRes = await query(`SELECT venue_id FROM outlet_venues WHERE outlet_id = $1`, [outletId]);
  const venueIds = venuesRes.rows.map(r => r.venue_id);
  if (!venueIds.length) return [];

  const res = await query(`
    SELECT id, name FROM venues WHERE id = ANY($1) ORDER BY name
  `, [venueIds]);
  
  return res.rows;
}

export async function getOutletHppMenus(outletId: number, opts?: { categoryName?: string; marginFlag?: string; search?: string; limit?: number; offset?: number }) {
  const outletRes = await query(`SELECT name FROM outlets WHERE id = $1`, [outletId]);
  const outletName = outletRes.rows[0]?.name || '';

  const venuesRes = await query(`SELECT venue_id FROM outlet_venues WHERE outlet_id = $1`, [outletId]);
  const venueIds = venuesRes.rows.map(r => r.venue_id);
  if (!venueIds.length) return { data: [], total: 0 };
  
  const params: unknown[] = [outletId, venueIds]; // $1 = outletId, $2 = venueIds
  const conditions: string[] = [
    `r.venue_id = ANY($2)`
  ];
  
  if (!outletName.toLowerCase().includes('cafetaria')) {
    conditions.push(`COALESCE(c.name, mi.category_name) NOT ILIKE '%cafetaria%'`);
  }
  
  let idx = 3;

  if (opts?.categoryName) {
    conditions.push(`COALESCE(c.name, mi.category_name) = $${idx++}`);
    params.push(opts.categoryName);
  }
  if (opts?.marginFlag) {
    conditions.push(`
      CASE
        WHEN m.hpp_ratio < 0.35 THEN 'GREEN'
        WHEN m.hpp_ratio < 0.50 THEN 'YELLOW'
        ELSE 'RED'
      END = $${idx++}
    `);
    params.push(opts.marginFlag);
  }
  if (opts?.search) {
    conditions.push(`(m.display_name ILIKE $${idx} OR m.name ILIKE $${idx})`);
    params.push(`%${opts.search}%`);
    idx++;
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;

  const countRes = await query<{ cnt: number }>(`
    SELECT COUNT(DISTINCT m.id)::int AS cnt
    FROM menus m
    JOIN recipes r ON r.menu_id = m.id
    JOIN (SELECT DISTINCT name, category_name, outlet_id FROM moka_items WHERE is_deleted IS NOT TRUE) mi 
      ON mi.name = m.name AND mi.outlet_id = $1
    LEFT JOIN menu_categories c ON c.id = m.category_id
    LEFT JOIN outlet_menu_prices omp ON omp.menu_id = m.id AND omp.outlet_id = $1
    ${where}
  `, params);

    const dataRes = await query<HppMenu & { is_overridden?: boolean }>(`
      SELECT DISTINCT ON (COALESCE(c.name, mi.category_name), m.name, m.variant, m.id)
        m.id, m.category_id, COALESCE(c.name, mi.category_name) AS category_name, m.name, m.variant, m.display_name,
        COALESCE(omp.sale_price, m.sale_price) AS sale_price,
        m.hpp,
        CASE
          WHEN COALESCE(omp.sale_price, m.sale_price) > 0 THEN (m.hpp / COALESCE(omp.sale_price, m.sale_price))
          ELSE m.hpp_ratio
        END AS hpp_ratio,
        m.notes,
        CASE
          WHEN COALESCE(omp.sale_price, m.sale_price) > 0 THEN
            CASE
              WHEN (m.hpp / COALESCE(omp.sale_price, m.sale_price)) < 0.35 THEN 'GREEN'
              WHEN (m.hpp / COALESCE(omp.sale_price, m.sale_price)) < 0.50 THEN 'YELLOW'
              ELSE 'RED'
            END
          ELSE
            CASE
              WHEN m.hpp_ratio IS NULL THEN NULL
              WHEN m.hpp_ratio < 0.35 THEN 'GREEN'
              WHEN m.hpp_ratio < 0.50 THEN 'YELLOW'
              ELSE 'RED'
            END
        END AS margin_flag,
        (omp.sale_price IS NOT NULL) AS is_overridden
      FROM menus m
      JOIN recipes r ON r.menu_id = m.id
      JOIN (SELECT DISTINCT name, category_name, outlet_id FROM moka_items WHERE is_deleted IS NOT TRUE) mi 
        ON mi.name = m.name AND mi.outlet_id = $1
      LEFT JOIN menu_categories c ON c.id = m.category_id
      LEFT JOIN outlet_menu_prices omp ON omp.menu_id = m.id AND omp.outlet_id = $1
      ${where}
      ORDER BY COALESCE(c.name, mi.category_name), m.name, m.variant, m.id
      LIMIT $${idx} OFFSET $${idx + 1}
    `, [...params, limit, offset]);

  return { data: dataRes.rows, total: countRes.rows[0]?.cnt ?? 0 };
}

export async function getOutletHppRecipes(outletId: number, opts?: { search?: string; venueId?: number; limit?: number; offset?: number }) {
  const venuesRes = await query(`SELECT venue_id FROM outlet_venues WHERE outlet_id = $1`, [outletId]);
  let venueIds = venuesRes.rows.map(r => r.venue_id);
  if (!venueIds.length) return { data: [], total: 0 };
  
  // If venueId is provided, filter it further to ensure it belongs to the outlet
  if (opts?.venueId) {
    if (venueIds.includes(opts.venueId)) {
      venueIds = [opts.venueId];
    } else {
      return { data: [], total: 0 }; // Not allowed
    }
  }

  const params: unknown[] = [venueIds, outletId];
  const conditions: string[] = [
    `r.venue_id = ANY($1)`,
    `EXISTS (
      SELECT 1 FROM menus m
      JOIN moka_items mi ON mi.name = m.name
      WHERE m.id = r.menu_id 
        AND mi.outlet_id = $2 
        AND mi.is_deleted IS NOT TRUE
    )`
  ];
  let idx = 3;

  if (opts?.search) {
    conditions.push(`r.name ILIKE $${idx++}`);
    params.push(`%${opts.search}%`);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;

  const countRes = await query<{ cnt: number }>(`
    SELECT COUNT(*)::int AS cnt FROM recipes r ${where}
  `, params);

  const dataRes = await query<HppRecipe>(`
    SELECT 
      r.id, r.venue_id, v.name AS venue_name,
      r.menu_id, r.name,
      r.yield, r.yield_unit, r.subtotal, r.x_factor_pct,
      r.total_cost, r.sale_price
    FROM recipes r
    JOIN venues v ON v.id = r.venue_id
    ${where}
    ORDER BY r.name
    LIMIT $${idx} OFFSET $${idx + 1}
  `, [...params, limit, offset]);

  return { data: dataRes.rows, total: countRes.rows[0]?.cnt ?? 0 };
}

export async function getOutletHppKitchenSummary(outletId: number) {
  const venuesRes = await query(`SELECT venue_id FROM outlet_venues WHERE outlet_id = $1`, [outletId]);
  const venueIds = venuesRes.rows.map(r => r.venue_id);
  if (!venueIds.length) return [];
  
  const res = await query(`
    SELECT DISTINCT
      k.recipe_name, k.yield_amount, k.yield_unit,
      k.sale_price, k.raw_cost, k.total_cost_with_xfactor,
      k.cost_per_unit_yield, k.hpp_ratio_pct
    FROM v_kitchen_hpp_summary k
    JOIN recipes r ON r.name = k.recipe_name
    WHERE r.venue_id = ANY($1)
      AND EXISTS (
        SELECT 1 FROM menus m
        JOIN moka_items mi ON mi.name = m.name
        WHERE m.id = r.menu_id 
          AND mi.outlet_id = $2 
          AND mi.is_deleted IS NOT TRUE
      )
    ORDER BY k.hpp_ratio_pct DESC NULLS LAST
  `, [venueIds, outletId]);
  
  return res.rows;
}
