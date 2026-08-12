import { pool } from '../db';

export async function saveShoppingListHistory(
  created_by: number,
  created_by_name: string,
  total_items: number,
  print_data: any
) {
  const result = await pool.query(
    `INSERT INTO shopping_list_histories (created_by, created_by_name, total_items, print_data)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [created_by, created_by_name, total_items, JSON.stringify(print_data)]
  );
  return result.rows[0];
}

export async function getShoppingListHistories() {
  const result = await pool.query(
    `SELECT * FROM shopping_list_histories ORDER BY created_at DESC`
  );
  return result.rows;
}
