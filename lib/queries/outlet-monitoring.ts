import { query, withTransaction } from '../db';
import { approveAndTransferDeliveryNote } from './delivery-notes';

export interface OutletMonitoringOutlet {
  id: number;
  name: string;
  venue_id?: number | null;
  last_request_date: string | null;
  last_do_date: string | null;
  last_sales_sync: string | null;
}

export interface OutletMonitoringItem {
  id: number;
  name: string;
  barcode: string | null;
  category_id: number;
  purchase_unit: string;
  smallest_unit: string;
  conversion_ratio: string;
  minimum_threshold: string;
  is_active: boolean;
  is_global?: boolean;
  venue_ids?: number[];
  central_stock: string | number;
  current_average_price: string | number;
}

export interface OutletMonitoringCategory {
  id: number;
  name: string;
}

export interface OutletStockMatrixCell {
  in_smallest: number;
  in_package: number;
  out_smallest: number;
  out_package: number;
  cups_sold: number;
  unit_consumed: number;   // total bahan terpakai (satuan terkecil), berdasarkan resep × cups_sold
  // Opname: data stok fisik dari sesi opname terakhir (LOCKED)
  opname_qty: number;          // qty fisik saat opname terakhir (satuan terkecil)
  opname_qty_package: number;  // qty fisik saat opname (satuan kemasan)
  opname_date: string | null;  // tanggal opname terakhir, untuk tooltip
  has_opname: boolean;         // apakah ada data opname untuk item ini
  in_since_opname: number;     // total IN setelah opname terakhir (satuan terkecil)
  out_since_opname: number;    // total OUT setelah opname terakhir (satuan terkecil)
  stock_smallest: number;
  stock_package: number;
  is_applicable?: boolean;
}

export interface ConsumedMaterial {
  item_id: number;
  item_name: string;
  smallest_unit: string;
  purchase_unit: string;
  conversion_ratio: number;
  total_consumed_smallest: number;
  consumed_display: string;
}

export interface SoldProduct {
  name: string;
  category_name: string;
  item_sold: number;
  net_sales: number;
}

export interface OutletConsumptionSummary {
  outlet_id: number;
  last_do_date: string | null;
  last_request_date: string | null;
  total_revenue: number;
  total_qty_sold: number;
  consumed_materials: ConsumedMaterial[];
  sold_products: SoldProduct[];
  period_start_date: string;
}

/**
 * Mengambil data pemantauan stok outlet secara lengkap, termasuk waktu aktivitas terakhir per outlet.
 */
export async function getOutletMonitoringData() {
  const [outletsRes, itemsRes, outletStocksRes, inRes, outRes, cupsRes, catRes, opnameRes] = await Promise.all([
    query<OutletMonitoringOutlet>(`
      SELECT 
        o.id, 
        o.name,
        o.venue_id,
        (SELECT MAX(created_at) FROM orders WHERE outlet_id = o.id) AS last_request_date,
        (SELECT COALESCE(MAX(delivery_date), MAX(created_at)::date) FROM delivery_notes WHERE outlet_id = o.id AND status != 'DIBATALKAN') AS last_do_date,
        (SELECT MAX(period_end) FROM moka_item_sales WHERE outlet_id = o.id) AS last_sales_sync
      FROM outlets o
      WHERE o.type = 'STORE'
      ORDER BY o.name ASC
    `),
    query<OutletMonitoringItem>(`
      SELECT 
        i.id, 
        i.name, 
        i.barcode,
        i.category_id,
        i.purchase_unit, 
        i.smallest_unit,
        i.conversion_ratio,
        i.minimum_threshold,
        i.is_active,
        i.is_global,
        (SELECT json_agg(iv.venue_id) FROM item_venues iv WHERE iv.item_id = i.id) AS venue_ids,
        COALESCE((
          SELECT ending_balance 
          FROM inventory_logs 
          WHERE item_id = i.id 
          ORDER BY created_at DESC 
          LIMIT 1
        ), 0) AS central_stock,
        COALESCE(i.current_average_price, 0) AS current_average_price
      FROM items i
      WHERE i.is_active = TRUE
      AND i.parent_id IS NULL
      ORDER BY i.name ASC
    `),
    query<{ item_id: number; outlet_id: number; current_balance: string }>(`
      SELECT item_id, outlet_id, current_balance FROM outlet_stocks
    `),
    // Total IN hari ini per item per outlet (ditampilkan di kolom IN Terkecil/Kemasan)
    query<{ item_id: number; outlet_id: number; total_in: string }>(`
      SELECT item_id, outlet_id, COALESCE(SUM(qty_change), 0) AS total_in 
      FROM outlet_inventory_logs 
      WHERE qty_change > 0 
        AND movement_type != 'ADJ'
        AND (created_at AT TIME ZONE 'Asia/Jakarta')::date = (now() AT TIME ZONE 'Asia/Jakarta')::date
      GROUP BY item_id, outlet_id
    `),
    // Total OUT hari ini per item per outlet (ditampilkan di kolom OUT Terkecil/Kemasan)
    query<{ item_id: number; outlet_id: number; total_out: string }>(`
      SELECT item_id, outlet_id, COALESCE(ABS(SUM(qty_change)), 0) AS total_out 
      FROM outlet_inventory_logs 
      WHERE qty_change < 0 
        AND movement_type != 'ADJ'
        AND (created_at AT TIME ZONE 'Asia/Jakarta')::date = (now() AT TIME ZONE 'Asia/Jakarta')::date
      GROUP BY item_id, outlet_id
    `),
    query<{ item_id: number; outlet_id: number; cups_sold: string; unit_consumed: string }>(`
      SELECT 
        i.id AS item_id,
        mis.outlet_id,
        COALESCE(SUM(mis.item_sold - COALESCE(mis.item_refunded, 0)), 0) AS cups_sold,
        COALESCE(SUM((mis.item_sold - COALESCE(mis.item_refunded, 0)) * ri.quantity), 0) AS unit_consumed
      FROM moka_item_sales mis
      -- Hanya ambil periode sinkronisasi yang paling terakhir (sync_date terbaru) per outlet
      INNER JOIN (
        SELECT DISTINCT ON (outlet_id) outlet_id, period_start, period_end
        FROM moka_item_sales
        WHERE (sync_date AT TIME ZONE 'Asia/Jakarta')::date = (now() AT TIME ZONE 'Asia/Jakarta')::date
        ORDER BY outlet_id, sync_date DESC
      ) latest ON mis.outlet_id = latest.outlet_id 
              AND mis.period_start = latest.period_start 
              AND mis.period_end = latest.period_end
      JOIN menus m ON (
        -- 1. Exact match nama atau display_name
        LOWER(TRIM(mis.name)) = LOWER(TRIM(m.name))
        OR (m.display_name IS NOT NULL AND m.display_name <> '' AND LOWER(TRIM(mis.name)) = LOWER(TRIM(m.display_name)))
        -- 2. Fuzzy match untuk varian yang disisipi kata (seperti 'Caffe Latte - Arabica Hot Medium'):
        --    Harus cocok nama dasar DI DEPAN dan varian DI BELAKANG agar tidak menduplikasi ke semua varian
        OR (
          m.name IS NOT NULL AND m.name <> ''
          AND m.variant IS NOT NULL AND m.variant <> ''
          AND LOWER(TRIM(mis.name)) LIKE LOWER(TRIM(m.name)) || ' %'
          AND LOWER(TRIM(mis.name)) LIKE '%' || LOWER(TRIM(m.variant))
        )
      )
      JOIN recipes r ON r.menu_id = m.id
      JOIN recipe_ingredients ri ON ri.recipe_id = r.id
      JOIN ingredients ing ON ing.id = ri.ingredient_id
      JOIN items i ON (i.id = ing.item_id OR i.ingredient_id = ing.id)
      GROUP BY i.id, mis.outlet_id
    `),
    query<OutletMonitoringCategory>(`SELECT id, name FROM categories ORDER BY name ASC`),
    // Stok fisik dari sesi opname terakhir (LOCKED) per item per outlet.
    // DISTINCT ON memastikan hanya satu baris per (outlet_id, item_id): yang paling baru.
    query<{
      outlet_id: number;
      item_id: number;
      opname_qty: string;
      locked_at: string;
      in_since: string;  // total IN sejak opname terakhir
      out_since: string; // total OUT sejak opname terakhir
    }>(`
      SELECT
        last_opname.outlet_id,
        last_opname.item_id,
        last_opname.opname_qty,
        last_opname.locked_at,
        -- Total IN sejak waktu opname terakhir dikunci
        COALESCE((
          SELECT SUM(oll.qty_change)
          FROM outlet_inventory_logs oll
          WHERE oll.outlet_id = last_opname.outlet_id
            AND oll.item_id  = last_opname.item_id
            AND oll.qty_change > 0
            AND oll.movement_type != 'ADJ'
            AND oll.created_at > last_opname.locked_at
        ), 0) AS in_since,
        -- Total OUT (absolut) sejak waktu opname terakhir dikunci
        COALESCE((
          SELECT ABS(SUM(oll.qty_change))
          FROM outlet_inventory_logs oll
          WHERE oll.outlet_id = last_opname.outlet_id
            AND oll.item_id  = last_opname.item_id
            AND oll.qty_change < 0
            AND oll.movement_type != 'ADJ'
            AND oll.created_at > last_opname.locked_at
        ), 0) AS out_since
      FROM (
        SELECT DISTINCT ON (sch.location_id, scd.item_id)
          sch.location_id AS outlet_id,
          scd.item_id,
          scd.actual_physical_qty AS opname_qty,
          sch.updated_at AS locked_at
        FROM stock_count_headers sch
        JOIN stock_count_details scd ON scd.header_id = sch.id
        WHERE sch.location_type = 'OUTLET'
          AND sch.status = 'LOCKED'
        ORDER BY sch.location_id, scd.item_id, sch.count_date DESC, sch.updated_at DESC
      ) AS last_opname
    `)
  ]);

  const inMap: Record<number, Record<number, number>> = {};
  const outMap: Record<number, Record<number, number>> = {};
  const cupsMap: Record<number, Record<number, number>> = {};
  const unitConsumedMap: Record<number, Record<number, number>> = {};
  const balMap: Record<number, Record<number, number>> = {};
  // opnameMap[item_id][outlet_id] = { opname_qty, locked_at, in_since, out_since }
  const opnameMap: Record<number, Record<number, { opname_qty: number; locked_at: string; in_since: number; out_since: number }>> = {};

  for (const r of inRes.rows) {
    if (!inMap[r.item_id]) inMap[r.item_id] = {};
    inMap[r.item_id][r.outlet_id] = parseFloat(r.total_in || '0');
  }
  for (const r of outRes.rows) {
    if (!outMap[r.item_id]) outMap[r.item_id] = {};
    outMap[r.item_id][r.outlet_id] = parseFloat(r.total_out || '0');
  }
  for (const r of cupsRes.rows) {
    if (!cupsMap[r.item_id]) cupsMap[r.item_id] = {};
    cupsMap[r.item_id][r.outlet_id] = parseFloat(r.cups_sold || '0');
    if (!unitConsumedMap[r.item_id]) unitConsumedMap[r.item_id] = {};
    unitConsumedMap[r.item_id][r.outlet_id] = parseFloat(r.unit_consumed || '0');
  }
  for (const r of outletStocksRes.rows) {
    if (!balMap[r.item_id]) balMap[r.item_id] = {};
    balMap[r.item_id][r.outlet_id] = parseFloat(r.current_balance || '0');
  }
  for (const r of opnameRes.rows) {
    if (!opnameMap[r.item_id]) opnameMap[r.item_id] = {};
    opnameMap[r.item_id][r.outlet_id] = {
      opname_qty: parseFloat(r.opname_qty || '0'),
      locked_at: r.locked_at,
      in_since: parseFloat(r.in_since || '0'),
      out_since: parseFloat(r.out_since || '0'),
    };
  }

  const stockMatrix: Record<number, Record<number, OutletStockMatrixCell>> = {};
  for (const item of itemsRes.rows) {
    const ratio = Number(item.conversion_ratio) || 1;
    stockMatrix[item.id] = {};
    for (const o of outletsRes.rows) {
      const inSmall = inMap[item.id]?.[o.id] || 0;
      const outSmall = outMap[item.id]?.[o.id] || 0;
      const cups = cupsMap[item.id]?.[o.id] || 0;
      const unitConsumed = unitConsumedMap[item.id]?.[o.id] || 0;

      const opnameData = opnameMap[item.id]?.[o.id] ?? null;

      const hasHistory = (balMap[item.id] && o.id in balMap[item.id]) || (inMap[item.id] && o.id in inMap[item.id]) || (outMap[item.id] && o.id in outMap[item.id]) || opnameData !== null;
      let isApplicable = true;
      if (item.is_global === false) {
        if (!item.venue_ids || !o.venue_id || !item.venue_ids.map(Number).includes(Number(o.venue_id))) {
          isApplicable = hasHistory;
        }
      }

      let balSmall: number;
      let opnameQty = 0;
      let opnameDate: string | null = null;
      let hasOpname = false;
      let inSince = 0;
      let outSince = 0;

      if (opnameData) {
        // Jika ada opname terakhir:
        opnameQty = opnameData.opname_qty;
        opnameDate = opnameData.locked_at;
        hasOpname = true;
        inSince = opnameData.in_since;
        outSince = opnameData.out_since;
      }
      
      // LIVE STOCK selalu menggunakan current_balance dari outlet_stocks agar sinkron 100% dengan tampilan outlet
      balSmall = balMap[item.id]?.[o.id] ?? 0;

      stockMatrix[item.id][o.id] = {
        in_smallest: inSmall,
        in_package: inSmall / ratio,
        out_smallest: outSmall,
        out_package: outSmall / ratio,
        cups_sold: cups,
        unit_consumed: unitConsumed,
        opname_qty: opnameQty,
        opname_qty_package: opnameQty / ratio,
        opname_date: opnameDate,
        has_opname: hasOpname,
        in_since_opname: inSince,
        out_since_opname: outSince,
        stock_smallest: balSmall,
        stock_package: balSmall / ratio,
        is_applicable: isApplicable,
      };
    }
  }

  return {
    outlets: outletsRes.rows,
    items: itemsRes.rows,
    stockMatrix,
    categories: catRes.rows
  };
}

/**
 * Mengambil ringkasan konsumsi bahan baku dan penjualan sejak tanggal pengiriman/pengadaan terakhir untuk sebuah outlet.
 */
export async function getOutletConsumptionSinceLastRestock(outletId: number): Promise<OutletConsumptionSummary> {
  // 1. Cari tanggal pengiriman terakhir (DO) ke outlet ini
  const doRes = await query<{ last_do_date: string | null }>(`
    SELECT MAX(delivery_date) AS last_do_date
    FROM delivery_notes
    WHERE outlet_id = $1 AND status != 'DIBATALKAN'
  `, [outletId]);

  const reqRes = await query<{ last_request_date: string | null }>(`
    SELECT MAX(created_at) AS last_request_date
    FROM orders
    WHERE outlet_id = $1
  `, [outletId]);

  const lastDoDate = doRes.rows[0]?.last_do_date || null;
  const lastRequestDate = reqRes.rows[0]?.last_request_date || null;

  // Tentukan tanggal acuan penghitungan (jika belum pernah DO, gunakan 30 hari ke belakang)
  let sinceDateStr: string;
  if (lastDoDate) {
    const d = new Date(lastDoDate);
    sinceDateStr = d.toISOString().split('T')[0];
  } else {
    const d = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    sinceDateStr = d.toISOString().split('T')[0];
  }

  // 2. Hitung total penjualan dari tabel moka_item_sales sejak tanggal acuan
  const salesRes = await query<{ total_revenue: string; total_qty: string }>(`
    SELECT 
      COALESCE(SUM(net_sales), 0) AS total_revenue,
      COALESCE(SUM(item_sold), 0) AS total_qty
    FROM moka_item_sales
    WHERE outlet_id = $1 AND period_start >= $2
  `, [outletId, sinceDateStr]);

  const totalRevenue = parseFloat(salesRes.rows[0]?.total_revenue || '0');
  const totalQtySold = parseFloat(salesRes.rows[0]?.total_qty || '0');

  // 3. Ambil daftar bahan baku yang dihabiskan dari tabel outlet_inventory_logs (movement_type = 'SALES')
  // sejak tanggal acuan
  const consumedRes = await query<{
    item_id: number;
    item_name: string;
    smallest_unit: string;
    purchase_unit: string;
    conversion_ratio: string;
    total_consumed_smallest: string;
  }>(`
    SELECT 
      i.id AS item_id,
      i.name AS item_name,
      i.smallest_unit,
      i.purchase_unit,
      i.conversion_ratio,
      COALESCE(ABS(SUM(il.qty_change)), 0) AS total_consumed_smallest
    FROM outlet_inventory_logs il
    JOIN items i ON i.id = il.item_id
    WHERE il.outlet_id = $1 
      AND il.movement_type = 'SALES'
      AND il.created_at >= $2::timestamp
    GROUP BY i.id, i.name, i.smallest_unit, i.purchase_unit, i.conversion_ratio
    HAVING ABS(SUM(il.qty_change)) > 0
    ORDER BY total_consumed_smallest DESC
    LIMIT 20
  `, [outletId, `${sinceDateStr} 00:00:00`]);

  const consumed_materials: ConsumedMaterial[] = consumedRes.rows.map(row => {
    const totalSmallest = parseFloat(row.total_consumed_smallest || '0');
    const ratio = parseFloat(row.conversion_ratio || '1') || 1;
    let displayStr = '';

    if (ratio > 1 && row.purchase_unit && row.purchase_unit !== row.smallest_unit) {
      const inPurchase = parseFloat((totalSmallest / ratio).toFixed(1));
      displayStr = `${inPurchase} ${row.purchase_unit}`;
    } else {
      displayStr = `${totalSmallest} ${row.smallest_unit || ''}`;
    }

    return {
      item_id: row.item_id,
      item_name: row.item_name,
      smallest_unit: row.smallest_unit || '',
      purchase_unit: row.purchase_unit || '',
      conversion_ratio: ratio,
      total_consumed_smallest: totalSmallest,
      consumed_display: displayStr
    };
  });

  // 4. Ambil daftar produk yang terjual dari moka_item_sales sejak tanggal acuan
  const soldProductsRes = await query<{
    name: string;
    category_name: string;
    item_sold: string;
    net_sales: string;
  }>(`
    SELECT 
      name,
      COALESCE(category_name, 'Lainnya') AS category_name,
      COALESCE(SUM(item_sold), 0) AS item_sold,
      COALESCE(SUM(net_sales), 0) AS net_sales
    FROM moka_item_sales
    WHERE outlet_id = $1 AND period_start >= $2
    GROUP BY name, category_name
    HAVING COALESCE(SUM(item_sold), 0) > 0
    ORDER BY SUM(item_sold) DESC
    LIMIT 50
  `, [outletId, sinceDateStr]);

  const sold_products: SoldProduct[] = soldProductsRes.rows.map(row => ({
    name: row.name,
    category_name: row.category_name,
    item_sold: parseInt(row.item_sold || '0', 10),
    net_sales: parseFloat(row.net_sales || '0'),
  }));

  return {
    outlet_id: outletId,
    last_do_date: lastDoDate,
    last_request_date: lastRequestDate,
    total_revenue: totalRevenue,
    total_qty_sold: totalQtySold,
    consumed_materials,
    sold_products,
    period_start_date: sinceDateStr
  };
}

/**
 * Transfer stok langsung 1-Paket dari Gudang Pusat ke Gudang Outlet (Tanpa 2 Kondisi Terpisah).
 * Memotong inventory_logs (OUT) di gudang pusat dan menambah outlet_stocks / outlet_inventory_logs (IN) secara atomic.
 */
export async function directTransferStockToOutlet(
  outletId: number,
  items: { item_id: number; qty: number }[],
  adminId: number,
  notes?: string
) {
  return withTransaction(async (client) => {
    if (!items || items.length === 0) {
      throw new Error('Daftar barang tidak boleh kosong');
    }

    // 1. Verifikasi outlet
    const outletRes = await client.query(
      `SELECT id, name FROM outlets WHERE id = $1 AND type = 'STORE'`,
      [outletId]
    );
    if (outletRes.rows.length === 0) {
      throw new Error('Outlet tidak ditemukan');
    }

    for (const item of items) {
      const qty = Number(item.qty) || 0;
      if (qty <= 0) continue;

      // STEP 1: Potong stok dari Gudang Pusat (inventory_logs)
      const balRes = await client.query(
        `SELECT ending_balance FROM inventory_logs WHERE item_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [item.item_id]
      );
      const centralOldBalance = parseFloat(balRes.rows[0]?.ending_balance ?? '0');
      const centralNewBalance = centralOldBalance - qty;

      await client.query(
        `INSERT INTO inventory_logs (item_id, movement_type, qty_change, ending_balance, reference_type, reference_id)
         VALUES ($1, 'OUT', $2, $3, 'DIRECT_TRANSFER', $4)`,
        [item.item_id, -qty, centralNewBalance, outletId]
      );

      // STEP 2: Tambahkan stok ke Gudang Outlet (outlet_stocks & outlet_inventory_logs)
      const stockRes = await client.query(
        `SELECT current_balance FROM outlet_stocks WHERE outlet_id = $1 AND item_id = $2 FOR UPDATE`,
        [outletId, item.item_id]
      );

      let outletOldBalance = 0;
      if (stockRes.rows.length > 0) {
        outletOldBalance = parseFloat(stockRes.rows[0].current_balance);
        const outletNewBalance = outletOldBalance + qty;
        await client.query(
          `UPDATE outlet_stocks SET current_balance = $1, updated_at = NOW() WHERE outlet_id = $2 AND item_id = $3`,
          [outletNewBalance, outletId, item.item_id]
        );
      } else {
        await client.query(
          `INSERT INTO outlet_stocks (outlet_id, item_id, current_balance, updated_at) VALUES ($1, $2, $3, NOW())`,
          [outletId, item.item_id, qty]
        );
      }

      const outletLogBalance = outletOldBalance + qty;
      await client.query(
        `INSERT INTO outlet_inventory_logs (outlet_id, item_id, movement_type, qty_change, ending_balance, reference_type, reference_id)
         VALUES ($1, $2, 'IN', $3, $4, 'DIRECT_TRANSFER', $5)`,
        [outletId, item.item_id, qty, outletLogBalance, adminId]
      );
    }

    return { success: true };
  });
}

export async function getPendingDOsForOutlet(outletId: number) {
  const res = await query<{
    id: number;
    do_number: string;
    status: string;
    created_at: string;
    notes: string;
    items_count: string;
  }>(`
    SELECT 
      dn.id, 
      dn.delivery_note_number AS do_number, 
      dn.status, 
      dn.created_at, 
      COALESCE(dn.notes, '') AS notes,
      (SELECT COUNT(*) FROM delivery_note_items dni WHERE dni.delivery_note_id = dn.id)::TEXT AS items_count
    FROM delivery_notes dn
    WHERE dn.outlet_id = $1 AND dn.status = 'DIKIRIM'
    ORDER BY dn.created_at ASC
  `, [outletId]);
  return res.rows;
}

export async function approveAllPendingDOsForOutlet(outletId: number, adminId: number) {
  const pending = await getPendingDOsForOutlet(outletId);
  let count = 0;
  for (const dn of pending) {
    await approveAndTransferDeliveryNote(dn.id, adminId);
    count++;
  }
  return { success: true, count };
}

export async function approveAllPendingDOsAllOutlets(adminId: number) {
  const res = await query<{
    id: number;
    do_number: string;
    outlet_id: number;
  }>(`
    SELECT id, delivery_note_number AS do_number, outlet_id
    FROM delivery_notes
    WHERE status = 'DIKIRIM'
    ORDER BY created_at ASC
  `);

  let count = 0;
  const outletIds = new Set<number>();
  for (const dn of res.rows) {
    await approveAndTransferDeliveryNote(dn.id, adminId);
    count++;
    outletIds.add(dn.outlet_id);
  }
  return { success: true, count, outlets_count: outletIds.size };
}

