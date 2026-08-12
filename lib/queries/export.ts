import { query } from '../db';

export async function getExportMasterData() {
  const [itemsRes, ingredientsRes, outletsRes, vendorsRes] = await Promise.all([
    query('SELECT * FROM items ORDER BY id ASC'),
    query('SELECT * FROM ingredients ORDER BY id ASC'),
    query('SELECT * FROM outlets ORDER BY id ASC'),
    query('SELECT * FROM vendors ORDER BY id ASC')
  ]);

  return {
    items: itemsRes.rows,
    ingredients: ingredientsRes.rows,
    outlets: outletsRes.rows,
    vendors: vendorsRes.rows
  };
}
