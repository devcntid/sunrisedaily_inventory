import { query } from '@/lib/db';

export interface DistributionHistoryDO {
  delivery_note_id: number;
  delivery_note_number: string;
  delivery_date: string;
  outlet_id: number;
  outlet_name: string;
  total_value: number;
  total_qty: number;
}

export async function getDistributionHistory(startDate: string, endDate: string): Promise<DistributionHistoryDO[]> {
  const sql = `
    SELECT
      dn.id AS delivery_note_id,
      dn.delivery_note_number,
      dn.delivery_date,
      o.id AS outlet_id,
      o.name AS outlet_name,
      COALESCE(SUM(COALESCE(dni.qty_received, dni.qty_shipped) * dni.price_at_shipment), 0) AS total_value,
      COUNT(dni.id)::int AS total_qty
    FROM outlets o
    LEFT JOIN delivery_notes dn 
      ON dn.outlet_id = o.id 
      AND dn.status = 'DITERIMA' 
      AND DATE(dn.delivery_date) >= $1 AND DATE(dn.delivery_date) <= $2
    LEFT JOIN delivery_note_items dni ON dn.id = dni.delivery_note_id
    GROUP BY o.id, o.name, dn.id, dn.delivery_note_number, dn.delivery_date
    ORDER BY o.name ASC, dn.delivery_date DESC
  `;
  
  const res = await query<DistributionHistoryDO>(sql, [startDate, endDate]);
  return res.rows.map(row => ({
    ...row,
    total_value: Number(row.total_value),
    total_qty: Number(row.total_qty)
  }));
}
