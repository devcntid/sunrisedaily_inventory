import { query } from "@/lib/db";

export async function getMokaCatalog(outletId?: string, search?: string, status?: string) {
    let sql = `
        SELECT 
            i.id as item_id,
            i.name as item_name,
            i.category_name,
            v.internal_recipe_id,
            v.id as variant_id,
            v.name as variant_name,
            v.price,
            v.cogs,
            v.sku,
            v.in_stock,
            (SELECT name FROM recipes r WHERE r.id = v.internal_recipe_id) as mapped_recipe_name,
            (SELECT COUNT(*)::int FROM recipe_ingredients ri WHERE ri.recipe_id = v.internal_recipe_id) as ingredient_count,
            o.name as outlet_name
        FROM moka_item_variants v
        JOIN moka_items i ON v.item_id = i.id
        LEFT JOIN outlets o ON i.outlet_id = o.id
        WHERE 1=1
    `;
    const params: unknown[] = [];
    let paramCount = 1;

    if (outletId) {
        sql += ` AND i.outlet_id = $${paramCount}`;
        params.push(outletId);
        paramCount++;
    }

    if (search) {
        sql += ` AND i.name ILIKE $${paramCount}`;
        params.push(`%${search}%`);
        paramCount++;
    }

    if (status === 'ready') {
        sql += ` AND v.internal_recipe_id IS NOT NULL AND (SELECT COUNT(*) FROM recipe_ingredients ri WHERE ri.recipe_id = v.internal_recipe_id) > 0`;
    } else if (status === 'no_ingredients') {
        sql += ` AND v.internal_recipe_id IS NOT NULL AND (SELECT COUNT(*) FROM recipe_ingredients ri WHERE ri.recipe_id = v.internal_recipe_id) = 0`;
    } else if (status === 'unmapped') {
        sql += ` AND v.internal_recipe_id IS NULL`;
    } else if (status === 'mapped') {
        sql += ` AND v.internal_recipe_id IS NOT NULL`;
    }

    sql += ` ORDER BY i.category_name, i.name, v.name`;

    const res = await query(sql, params);
    return res.rows;
}

export async function getMokaCatalogStats(outletId?: string): Promise<{
    total_items: number;
    ready_items: number;
    no_ingredient_items: number;
    unmapped_items: number;
}> {
    let sql = `
        SELECT 
            COUNT(DISTINCT v.id)::int as total_items,
            COUNT(DISTINCT CASE WHEN v.internal_recipe_id IS NOT NULL AND (SELECT COUNT(*) FROM recipe_ingredients ri WHERE ri.recipe_id = v.internal_recipe_id) > 0 THEN v.id END)::int as ready_items,
            COUNT(DISTINCT CASE WHEN v.internal_recipe_id IS NOT NULL AND (SELECT COUNT(*) FROM recipe_ingredients ri WHERE ri.recipe_id = v.internal_recipe_id) = 0 THEN v.id END)::int as no_ingredient_items,
            COUNT(DISTINCT CASE WHEN v.internal_recipe_id IS NULL THEN v.id END)::int as unmapped_items
        FROM moka_item_variants v
        JOIN moka_items i ON v.item_id = i.id
        WHERE 1=1
    `;
    const params: unknown[] = [];
    if (outletId) {
        sql += ` AND i.outlet_id = $1`;
        params.push(outletId);
    }

    const res = await query(sql, params);
    const row = res.rows[0];
    return {
        total_items: Number(row?.total_items || 0),
        ready_items: Number(row?.ready_items || 0),
        no_ingredient_items: Number(row?.no_ingredient_items || 0),
        unmapped_items: Number(row?.unmapped_items || 0),
    };
}

export async function getOutletsWithBusiness() {
    const res = await query(`
        SELECT o.id, o.name as outlet_name, 'Sunrise Daily' as business_name
        FROM outlets o
        ORDER BY o.name
    `);
    
    const grouped: Record<string, Record<string, unknown>[]> = {};
    for (const row of res.rows) {
        const bName = row.business_name || 'Unknown Business';
        if (!grouped[bName]) grouped[bName] = [];
        grouped[bName].push({ id: row.id, name: row.outlet_name });
    }
    return grouped;
}

export async function getRecipesForMapping() {
    const recipesRes = await query(`
        SELECT 
            r.id, 
            r.name,
            (SELECT COUNT(*)::int FROM recipe_ingredients ri WHERE ri.recipe_id = r.id) as ingredient_count
        FROM recipes r
        ORDER BY r.name ASC
    `);
    return recipesRes.rows;
}
