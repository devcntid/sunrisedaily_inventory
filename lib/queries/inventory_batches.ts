import { query } from '@/lib/db';
import type { PoolClient } from 'pg';

export interface InventoryBatch {
  id: number;
  item_id: number;
  goods_receipt_id?: number | null;
  batch_number?: string | null;
  expired_date: string;
  qty_received: number;
  qty_remaining: number;
  created_at: string;
}

export interface ItemEarliestExpiry {
  item_id: number;
  earliest_expired_date: string;
  active_batch_count: number;
  total_batch_stock: number;
}

/**
  * Tambahkan batch inventaris baru saat penerimaan barang (Goods Receipt / PO)
  */
export async function createInventoryBatch(
  data: {
    item_id: number;
    goods_receipt_id?: number | null;
    batch_number?: string | null;
    expired_date: string;
    qty_received: number;
    qty_remaining?: number;
  },
  client?: PoolClient
) {
  const executor = client ? client.query.bind(client) : query;
  const qtyRemaining = data.qty_remaining ?? data.qty_received;
  
  const res = await executor(
    `INSERT INTO inventory_batches (item_id, goods_receipt_id, batch_number, expired_date, qty_received, qty_remaining)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      data.item_id,
      data.goods_receipt_id ?? null,
      data.batch_number ?? null,
      data.expired_date,
      data.qty_received,
      qtyRemaining
    ]
  );
  return res.rows[0] as InventoryBatch;
}

/**
  * Ambil tanggal kadaluarsa paling awal (earliest expiry) untuk tiap item dari batch aktif (qty_remaining > 0)
  */
export async function getEarliestExpiriesPerItem(itemIds?: number[]): Promise<Record<number, ItemEarliestExpiry>> {
  let sql = `
    SELECT 
      item_id, 
      MIN(expired_date)::text AS earliest_expired_date,
      COUNT(id)::int AS active_batch_count,
      SUM(qty_remaining)::numeric AS total_batch_stock
    FROM inventory_batches
    WHERE qty_remaining > 0
  `;
  const params: unknown[] = [];

  if (itemIds && itemIds.length > 0) {
    sql += ` AND item_id = ANY($1::int[])`;
    params.push(itemIds);
  }

  sql += ` GROUP BY item_id`;

  const res = await query(sql, params);
  const result: Record<number, ItemEarliestExpiry> = {};
  
  for (const row of res.rows) {
    result[Number(row.item_id)] = {
      item_id: Number(row.item_id),
      earliest_expired_date: row.earliest_expired_date,
      active_batch_count: Number(row.active_batch_count),
      total_batch_stock: Number(row.total_batch_stock)
    };
  }

  return result;
}

/**
  * Ambil daftar rincian batch aktif untuk item tertentu (diurutkan berdasarkan expired_date paling dekat)
  */
export async function getItemBatches(itemId: number): Promise<InventoryBatch[]> {
  const res = await query(
    `SELECT 
       id, item_id, goods_receipt_id, batch_number, 
       expired_date::text AS expired_date, 
       qty_received, qty_remaining, created_at
     FROM inventory_batches
     WHERE item_id = $1 AND qty_remaining > 0
     ORDER BY expired_date ASC, created_at ASC`,
    [itemId]
  );
  return res.rows.map(row => ({
    id: Number(row.id),
    item_id: Number(row.item_id),
    goods_receipt_id: row.goods_receipt_id ? Number(row.goods_receipt_id) : null,
    batch_number: row.batch_number ?? null,
    expired_date: String(row.expired_date),
    qty_received: Number(row.qty_received),
    qty_remaining: Number(row.qty_remaining),
    created_at: String(row.created_at)
  }));
}

/**
  * Hapus batch inventaris berdasarkan ID
  */
export async function deleteInventoryBatch(id: number): Promise<boolean> {
  const res = await query(`DELETE FROM inventory_batches WHERE id = $1 RETURNING id`, [id]);
  return (res.rowCount ?? 0) > 0;
}
