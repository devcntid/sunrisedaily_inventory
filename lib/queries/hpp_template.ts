import { query, withTransaction } from '@/lib/db';
import type { PoolClient } from 'pg';

// ─── QUERY UNTUK TEMPLATE EXCEL (DOWNLOAD) ─────────────────────────

export async function getTemplateMasterData() {
  const menusRes = await query(`
    SELECT id AS menu_id, name AS nama_menu
    FROM menus
    ORDER BY name
  `);

  const ingredientsRes = await query(`
    SELECT 
      i.id AS bahan_id, 
      COALESCE(it.name, i.name) AS nama_bahan,
      COALESCE(it.smallest_unit, i.default_unit) AS satuan
    FROM ingredients i
    LEFT JOIN items it ON it.id = i.item_id
    ORDER BY nama_bahan
  `);

  const unitsRes = await query(`
    SELECT DISTINCT COALESCE(it.smallest_unit, i.default_unit) AS satuan
    FROM ingredients i
    LEFT JOIN items it ON it.id = i.item_id
    WHERE COALESCE(it.smallest_unit, i.default_unit) IS NOT NULL
    ORDER BY satuan
  `);

  return {
    menus: menusRes.rows,
    ingredients: ingredientsRes.rows,
    units: unitsRes.rows.map((r: any) => r.satuan)
  };
}

export async function getTemplateRecipeData() {
  // Ambil resep aktif (diambil dari salah satu venue saja atau secara umum 
  // karena kita anggap resepnya seragam. Jika belum seragam, kita ambil salah satu 
  // sebagai perwakilan template)
  const res = await query(`
    SELECT DISTINCT ON (m.id, i.id)
      m.id AS menu_id,
      m.name AS nama_menu,
      i.id AS bahan_id,
      COALESCE(it.name, i.name) AS nama_bahan,
      ri.quantity AS takaran,
      COALESCE(it.smallest_unit, i.default_unit, ri.unit) AS satuan
    FROM recipe_ingredients ri
    JOIN recipes r ON r.id = ri.recipe_id
    JOIN menus m ON m.id = r.menu_id
    JOIN ingredients i ON i.id = ri.ingredient_id
    LEFT JOIN items it ON it.id = i.item_id
    ORDER BY m.id, i.id, r.venue_id
  `);
  
  return res.rows;
}

// ─── QUERY UNTUK IMPORT EXCEL (UPLOAD) ─────────────────────────────

export type ValidatedRecipeRow = {
  menu_id: number;
  bahan_id: number;
  takaran: number;
  satuan: string;
};

export async function importMenuRecipesForAllVenues(
  data: ValidatedRecipeRow[]
) {
  return withTransaction(async (client: PoolClient) => {
    // 1. Dapatkan daftar menu_id unik dari data yang diupload
    const menuIds = Array.from(new Set(data.map(d => d.menu_id)));
    if (menuIds.length === 0) return true;

    // 2. Ambil semua recipe_id yang berhubungan dengan menu_id tersebut di SEMUA venue
    const recipesRes = await client.query(`
      SELECT id, menu_id, venue_id
      FROM recipes
      WHERE menu_id = ANY($1::int[])
    `, [menuIds]);
    
    const recipes = recipesRes.rows;

    const recipeIds = recipes.map((r: any) => r.id);

    // 3. Hapus semua recipe_ingredients lama untuk recipe tersebut
    if (recipeIds.length > 0) {
      await client.query(`
        DELETE FROM recipe_ingredients
        WHERE recipe_id = ANY($1::int[])
      `, [recipeIds]);
    }

    // 4. Masukkan data baru. Karena kita ingin seragam untuk semua venue,
    // kita iterasi setiap row resep dari template, lalu insert ke semua recipe_id
    // yang tergabung dalam menu_id tersebut.
    if (recipes.length > 0) {
      const values: string[] = [];
      const queryParams: any[] = [];
      let paramIndex = 1;

      // Grouping data by menu_id
      const dataByMenuId: Record<number, ValidatedRecipeRow[]> = {};
      for (const row of data) {
        if (!dataByMenuId[row.menu_id]) dataByMenuId[row.menu_id] = [];
        dataByMenuId[row.menu_id].push(row);
      }

      for (const recipe of recipes) {
        const ingredientsToInsert = dataByMenuId[recipe.menu_id] || [];
        // sort order
        let sortOrder = 1;
        for (const ing of ingredientsToInsert) {
          values.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, 0)`);
          queryParams.push(
            recipe.id,
            ing.bahan_id,
            ing.takaran,
            ing.satuan,
            sortOrder++
          );
        }
      }

      if (values.length > 0) {
        const queryStr = `
          INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, sort_order, cost_per_unit)
          VALUES ${values.join(', ')}
        `;
        await client.query(queryStr, queryParams);
      }
    }

    return true;
  });
}
