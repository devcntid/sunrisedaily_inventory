import { query, withTransaction } from '@/lib/db';

export interface PurchaseOrder {
  id: number;
  po_number: string;
  vendor_id: number;
  vendor_name?: string;
  vendor_reference?: string;
  order_date: string;
  order_deadline?: string;
  confirmation_required: boolean;
  confirmation_days_before?: number;
  destination_outlet_id?: number;
  destination_outlet_name?: string;
  status: string;
  payment_terms?: string;
  incoterm?: string;
  internal_notes?: string;
  buyer_id: number;
  buyer_name?: string;
  stock_alert_id?: number;
  is_favorite: boolean;
  currency: string;
  subtotal: number;
  total_tax: number;
  total: number;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export async function getPurchaseOrders(opts?: { status?: string; vendorId?: number }) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  if (opts?.status) { conditions.push(`po.status = $${i++}`); params.push(opts.status); }
  if (opts?.vendorId) { conditions.push(`po.vendor_id = $${i++}`); params.push(opts.vendorId); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query<PurchaseOrder>(
    `SELECT po.*, v.name AS vendor_name, u.name AS buyer_name, o.name AS destination_outlet_name
     FROM purchase_orders po
     LEFT JOIN vendors v ON v.id = po.vendor_id
     LEFT JOIN users u ON u.id = po.buyer_id
     LEFT JOIN outlets o ON o.id = po.destination_outlet_id
     ${where}
     ORDER BY po.created_at DESC`,
    params
  );
  return result.rows;
}

export async function getPurchaseOrderById(id: number) {
  const poRes = await query<PurchaseOrder>(
    `SELECT po.*, v.name AS vendor_name, u.name AS buyer_name, o.name AS destination_outlet_name
     FROM purchase_orders po
     LEFT JOIN vendors v ON v.id = po.vendor_id
     LEFT JOIN users u ON u.id = po.buyer_id
     LEFT JOIN outlets o ON o.id = po.destination_outlet_id
     WHERE po.id = $1`,
    [id]
  );
  const po = poRes.rows[0] ?? null;
  if (!po) return null;

  const itemsRes = await query(
    `SELECT poi.*, i.name AS item_name, i.purchase_unit, i.smallest_unit, i.parent_id,
            COALESCE((SELECT SUM(qty_received) FROM goods_receipt_items WHERE purchase_order_item_id = poi.id), 0) as total_received
     FROM purchase_order_items poi
     LEFT JOIN items i ON i.id = poi.item_id
     WHERE poi.purchase_order_id = $1
     ORDER BY poi.sort_order, poi.id`,
    [id]
  );
  return { ...po, items: itemsRes.rows };
}

// BUG-08 Fix: Gunakan bounded retry (max 10 percobaan) bukan infinite while loop.
export async function generatePoNumber(): Promise<string> {
  const year = new Date().getFullYear();

  for (let attempt = 0; attempt < 10; attempt++) {
    const random4 = Math.floor(1000 + Math.random() * 9000);
    const poNumber = `PO-${year}${random4}`;

    const res = await query(`SELECT id FROM purchase_orders WHERE po_number = $1`, [poNumber]);
    if (res.rows.length === 0) return poNumber;
  }

  // Fallback: gunakan timestamp unik
  return `PO-${year}${Date.now().toString().slice(-6)}`;
}

export async function createPurchaseOrder(data: {
  vendor_id: number;
  vendor_reference?: string;
  order_date?: string;
  order_deadline?: string;
  confirmation_required?: boolean;
  confirmation_days_before?: number;
  destination_outlet_id?: number;
  deliver_to?: string;
  payment_terms?: string;
  incoterm?: string;
  internal_notes?: string;
  buyer_id: number;
  stock_alert_id?: number;
  currency?: string;
  created_by: number;
  items: Array<{
    line_type: string;
    item_id?: number;
    description?: string;
    qty?: number;
    package_qty?: number;
    package_unit?: string;
    unit_price?: number;
    tax_percent?: number;
    disc_percent?: number;
    purchase_unit?: string;
    package_inner_size?: number;
    conversion_ratio?: number;
    sort_order?: number;
  }>;
}) {
  return withTransaction(async (client) => {
    const poNumber = await generatePoNumber();

    const poRes = await client.query(
      `INSERT INTO purchase_orders (po_number, vendor_id, vendor_reference, order_date, order_deadline,
         confirmation_required, confirmation_days_before, destination_outlet_id, deliver_to, payment_terms, incoterm,
         internal_notes, buyer_id, stock_alert_id, currency, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [poNumber, data.vendor_id, data.vendor_reference || null, data.order_date || null, data.order_deadline || null,
       data.confirmation_required ?? true,
       data.confirmation_days_before || null, data.destination_outlet_id || null, data.deliver_to || null,
       data.payment_terms || null, data.incoterm || '— Not set —', data.internal_notes || null,
       data.buyer_id, data.stock_alert_id || null, data.currency || 'IDR', data.created_by]
    );
    const po = poRes.rows[0];

    let subtotal = 0;
    let totalTax = 0;
    
    if (data.items.length > 0) {
      const poIds: number[] = [];
      const lineTypes: string[] = [];
      const itemIds: (number | null)[] = [];
      const descriptions: (string | null)[] = [];
      const qtys: (number | null)[] = [];
      const packageQtys: (number | null)[] = [];
      const packageUnits: (string | null)[] = [];
      const purchaseUnits: (string | null)[] = [];
      const packageInnerSizes: (number | null)[] = [];
      const conversionRatios: (number | null)[] = [];
      const unitPrices: (number | null)[] = [];
      const taxPercents: number[] = [];
      const discountPercents: number[] = [];
      const subtotals: number[] = [];
      const sortOrders: number[] = [];

      for (let idx = 0; idx < data.items.length; idx++) {
        const item = data.items[idx];
        const q = item.qty ?? null;
        const up = item.unit_price ?? null;
        const d = item.disc_percent ?? 0;
        const t = item.tax_percent ?? 0;
        const lineSubtotal = ((q || 0) * (up || 0)) * (1 - d / 100);
        
        subtotal += lineSubtotal;
        totalTax += lineSubtotal * (t / 100);

        poIds.push(po.id);
        lineTypes.push(item.line_type);
        itemIds.push(item.item_id ?? null);
        descriptions.push(item.description ?? null);
        qtys.push(item.qty ?? null);
        packageQtys.push(item.package_qty ?? null);
        packageUnits.push(item.package_unit ?? null);
        purchaseUnits.push(item.purchase_unit ?? null);
        packageInnerSizes.push(item.package_inner_size ?? null);
        conversionRatios.push(item.conversion_ratio ?? null);
        unitPrices.push(item.unit_price ?? null);
        taxPercents.push(item.tax_percent ?? 0);
        discountPercents.push(item.disc_percent ?? 0);
        subtotals.push(lineSubtotal);
        sortOrders.push(item.sort_order ?? idx);
      }

      await client.query(
        `INSERT INTO purchase_order_items (purchase_order_id, line_type, item_id, description, qty, package_qty, package_unit, purchase_unit, package_inner_size, conversion_ratio, unit_price, tax_percent, discount_percent, subtotal, sort_order)
         SELECT * FROM UNNEST ($1::int[], $2::varchar[], $3::int[], $4::text[], $5::numeric[], $6::numeric[], $7::varchar[], $8::varchar[], $9::numeric[], $10::numeric[], $11::numeric[], $12::numeric[], $13::numeric[], $14::numeric[], $15::int[])`,
        [poIds, lineTypes, itemIds, descriptions, qtys, packageQtys, packageUnits, purchaseUnits, packageInnerSizes, conversionRatios, unitPrices, taxPercents, discountPercents, subtotals, sortOrders]
      );
    }

    const total = subtotal + totalTax;
    await client.query(
      `UPDATE purchase_orders SET subtotal = $1, total_tax = $2, total = $3 WHERE id = $4`,
      [subtotal, totalTax, total, po.id]
    );

    return { ...po, subtotal, total_tax: totalTax, total };
  });
}

export async function updatePurchaseOrder(id: number, data: Parameters<typeof createPurchaseOrder>[0]) {
  return withTransaction(async (client) => {
    // Pastikan status PO masih RFQ (draft)
    const { rows: checkRows } = await client.query(`SELECT status FROM purchase_orders WHERE id = $1`, [id]);
    if (checkRows.length === 0) throw new Error('PO tidak ditemukan');
    if (checkRows[0].status !== 'RFQ') {
      throw new Error('Data PO tidak dapat diubah karena statusnya sudah ' + checkRows[0].status);
    }

    const poRes = await client.query(
      `UPDATE purchase_orders SET vendor_id = $1, vendor_reference = $2, order_date = $3, order_deadline = $4,
         confirmation_required = $5, confirmation_days_before = $6, destination_outlet_id = $7, deliver_to = $8, payment_terms = $9, incoterm = $10,
         internal_notes = $11, updated_at = now()
       WHERE id = $12 RETURNING *`,
      [data.vendor_id, data.vendor_reference || null, data.order_date || null, data.order_deadline || null,
       data.confirmation_required ?? true,
       data.confirmation_days_before || null, data.destination_outlet_id || null, data.deliver_to || null,
       data.payment_terms || null, data.incoterm || '— Not set —', data.internal_notes || null, id]
    );
    const po = poRes.rows[0];

    // Clear existing items
    await client.query(`DELETE FROM purchase_order_items WHERE purchase_order_id = $1`, [id]);

    let subtotal = 0;
    let totalTax = 0;

    if (data.items.length > 0) {
      const poIds: number[] = [];
      const lineTypes: string[] = [];
      const itemIds: (number | null)[] = [];
      const descriptions: (string | null)[] = [];
      const qtys: (number | null)[] = [];
      const packageQtys: (number | null)[] = [];
      const packageUnits: (string | null)[] = [];
      const purchaseUnits: (string | null)[] = [];
      const packageInnerSizes: (number | null)[] = [];
      const conversionRatios: (number | null)[] = [];
      const unitPrices: (number | null)[] = [];
      const taxPercents: number[] = [];
      const discountPercents: number[] = [];
      const subtotals: number[] = [];
      const sortOrders: number[] = [];

      for (let idx = 0; idx < data.items.length; idx++) {
        const item = data.items[idx];
        const q = item.qty ?? null;
        const up = item.unit_price ?? null;
        const d = item.disc_percent ?? 0;
        const t = item.tax_percent ?? 0;
        const lineSubtotal = ((q || 0) * (up || 0)) * (1 - d / 100);
        
        subtotal += lineSubtotal;
        totalTax += lineSubtotal * (t / 100);

        poIds.push(id);
        lineTypes.push(item.line_type);
        itemIds.push(item.item_id ?? null);
        descriptions.push(item.description ?? null);
        qtys.push(item.qty ?? null);
        packageQtys.push(item.package_qty ?? null);
        packageUnits.push(item.package_unit ?? null);
        purchaseUnits.push(item.purchase_unit ?? null);
        packageInnerSizes.push(item.package_inner_size ?? null);
        conversionRatios.push(item.conversion_ratio ?? null);
        unitPrices.push(item.unit_price ?? null);
        taxPercents.push(item.tax_percent ?? 0);
        discountPercents.push(item.disc_percent ?? 0);
        subtotals.push(lineSubtotal);
        sortOrders.push(item.sort_order ?? idx);
      }

      await client.query(
        `INSERT INTO purchase_order_items (purchase_order_id, line_type, item_id, description, qty, package_qty, package_unit, purchase_unit, package_inner_size, conversion_ratio, unit_price, tax_percent, discount_percent, subtotal, sort_order)
         SELECT * FROM UNNEST ($1::int[], $2::varchar[], $3::int[], $4::text[], $5::numeric[], $6::numeric[], $7::varchar[], $8::varchar[], $9::numeric[], $10::numeric[], $11::numeric[], $12::numeric[], $13::numeric[], $14::numeric[], $15::int[])`,
        [poIds, lineTypes, itemIds, descriptions, qtys, packageQtys, packageUnits, purchaseUnits, packageInnerSizes, conversionRatios, unitPrices, taxPercents, discountPercents, subtotals, sortOrders]
      );
    }

    const total = subtotal + totalTax;
    await client.query(
      `UPDATE purchase_orders SET subtotal = $1, total_tax = $2, total = $3 WHERE id = $4`,
      [subtotal, totalTax, total, id]
    );

    return { ...po, subtotal, total_tax: totalTax, total };
  });
}

export async function updatePurchaseOrderStatus(id: number, status: string, userId: number = 1) {
  return withTransaction(async (client) => {
    const { rows: poRows } = await client.query(`SELECT status, destination_outlet_id, po_number FROM purchase_orders WHERE id = $1`, [id]);
    const po = poRows[0];
    if (!po) throw new Error('PO tidak ditemukan');

    if (po.status === 'SELESAI' && status === 'SELESAI') return po;

    const result = await client.query(
      `UPDATE purchase_orders SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [status, id]
    );

    if (status === 'DIBATALKAN') {
      // Revert stock alerts if this PO was supposed to resolve them
      await client.query(
        `UPDATE stock_alerts SET is_resolved = FALSE, reference_po_id = NULL WHERE reference_po_id = $1`,
        [id]
      );
    }

    if (status === 'SELESAI') {
      const { rows: items } = await client.query(
        `SELECT poi.item_id, poi.qty, poi.unit_price, COALESCE(poi.conversion_ratio, i.conversion_ratio) as conversion_ratio
         FROM purchase_order_items poi
         JOIN items i ON i.id = poi.item_id
         WHERE poi.purchase_order_id = $1 AND poi.line_type = 'PRODUK'`,
        [id]
      );

      for (const item of items) {
        if (!item.item_id) continue;
        const ratio = Number(item.conversion_ratio) || 1;
        const qtyPurchased = Number(item.qty) || 0;
        const unitPricePurchased = Number(item.unit_price) || 0;
        
        const addedQty = qtyPurchased * ratio;
        const newUnitPrice = unitPricePurchased / ratio; 

        // 1. Temukan Induk (Effective ID)
        const { rows: parentInfo } = await client.query(
          `SELECT COALESCE(parent_id, id) AS effective_id FROM items WHERE id = $1`, [item.item_id]
        );
        const effectiveId = parentInfo[0]?.effective_id || item.item_id;

        // 2. Dapatkan Sisa Fisik Gabungan Induk
        const { rows: stockInfo } = await client.query(
          `SELECT COALESCE(SUM(qty_change), 0) as current_stock 
           FROM inventory_logs 
           WHERE item_id = $1 OR item_id IN (SELECT id FROM items WHERE parent_id = $1)`,
          [effectiveId]
        );
        const currentStock = Number(stockInfo[0].current_stock) || 0;

        // 3. Dapatkan HPP Induk Lama
        const { rows: hppInfo } = await client.query(
          `SELECT current_average_price FROM items WHERE id = $1`, [effectiveId]
        );
        const currentAvg = Number(hppInfo[0]?.current_average_price) || 0;
        
        // 4. Hitung True Moving Average (Induk)
        const effectiveOldStock = currentStock > 0 ? currentStock : 0;
        const totalNewStock = effectiveOldStock + addedQty;
        const oldValue = currentAvg * effectiveOldStock;
        const newValue = newUnitPrice * addedQty;
        const newAvgPrice = totalNewStock > 0 ? (oldValue + newValue) / totalNewStock : newUnitPrice;

        // 5. Catat IN ke Log Induk
        await client.query(
          `INSERT INTO inventory_logs 
           (item_id, movement_type, qty_change, ending_balance, reference_type, reference_id)
           VALUES ($1, 'IN', $2, $3, 'PURCHASE', $4)`,
          [effectiveId, addedQty, currentStock + addedQty, id]
        );

        // 6. Update HPP Induk
        await client.query(
          `UPDATE items 
           SET current_average_price = $1, 
               last_purchase_price = $2,
               updated_at = now() 
           WHERE id = $3`,
          [newAvgPrice, newUnitPrice, effectiveId]
        );

        // 7. Update visual harga Beli Terakhir untuk Brand tersebut
        if (effectiveId !== item.item_id) {
           await client.query(
             `UPDATE items 
              SET current_average_price = $1, 
                  last_purchase_price = $1,
                  updated_at = now() 
              WHERE id = $2`,
             [newUnitPrice, item.item_id]
           );
        }
      }
      
      const updatedItemIds = items.map(i => Number(i.item_id)).filter(id => !isNaN(id) && id > 0);
      if (updatedItemIds.length > 0) {
        const { syncMenuHppByItems } = await import('@/lib/queries/hpp');
        await syncMenuHppByItems(client, updatedItemIds);
      }
    }

    return result.rows[0];
  });
}

export async function getPurchaseOrderSuggestions() {
  const result = await query(`
    WITH item_balances AS (
      SELECT 
        i.id as item_id, 
        i.name as item_name, 
        c.name as category_name,
        i.smallest_unit, 
        i.minimum_threshold,
        COALESCE((
          SELECT ending_balance 
          FROM inventory_logs 
          WHERE item_id = i.id 
          ORDER BY created_at DESC 
          LIMIT 1
        ), 0) as current_balance
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      WHERE i.is_active = TRUE AND i.parent_id IS NULL
    )
    SELECT * 
    FROM item_balances
    WHERE current_balance <= COALESCE(minimum_threshold, 0)
    ORDER BY current_balance ASC, item_name ASC;
  `);
  return result.rows;
}
