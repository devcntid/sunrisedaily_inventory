import { query, withTransaction } from '@/lib/db';
import { autoFulfillPendingRequestsBulk } from './orders';
import { checkAndCreateAlertBulk } from './alerts';
import { syncMenuHppByItems } from './hpp';

export interface GoodsReceipt {
  id: number;
  purchase_order_id: number;
  receipt_number: string;
  vendor_delivery_note?: string;
  received_date: string;
  received_by?: number;
  status: string;
  created_at: string;
}

export interface GoodsReceiptItem {
  id: number;
  goods_receipt_id: number;
  purchase_order_item_id: number;
  item_id: number;
  qty_received: number;
}

// BUG-08 Fix: Gunakan bounded retry (max 10 percobaan) bukan infinite while loop.
// Probability collision 1/9000 per try → P(10 collisions berturut) = (1/9000)^10 ≈ 0.
// Jika semua gagal, throw error daripada hang pool dengan koneksi tak terbatas.
export async function generateReceiptNumber(client?: import('pg').PoolClient) {
  const doQuery = client ? client.query.bind(client) : query;
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  for (let attempt = 0; attempt < 10; attempt++) {
    const random4 = Math.floor(1000 + Math.random() * 9000);
    const receiptNumber = `WH/IN/${year}/${month}/${random4}`;

    const res = await doQuery(`SELECT id FROM goods_receipts WHERE receipt_number = $1`, [receiptNumber]);
    if (res.rows.length === 0) return receiptNumber;
  }

  // Fallback: gunakan timestamp unik jika random collision sangat tidak beruntung
  return `WH/IN/${year}/${month}/${Date.now().toString().slice(-6)}`;
}

export async function createGoodsReceipt(data: {
  purchase_order_id: number;
  vendor_delivery_note?: string;
  received_by: number;
  received_date?: string;
  items: {
    purchase_order_item_id: number;
    item_id: number;
    qty_received: number;
  }[];
}) {
  return withTransaction(async (client) => {
    const receiptNumber = await generateReceiptNumber(client);
    
    const receiptRes = await client.query(
      `INSERT INTO goods_receipts (purchase_order_id, receipt_number, vendor_delivery_note, received_by, received_date, status)
       VALUES ($1, $2, $3, $4, COALESCE($5, now()), 'DONE') RETURNING *`,
      [data.purchase_order_id, receiptNumber, data.vendor_delivery_note || null, data.received_by, data.received_date || null]
    );
    const receipt = receiptRes.rows[0];

    // Fetch PO vendor
    const poRes = await client.query(`SELECT vendor_id FROM purchase_orders WHERE id = $1`, [data.purchase_order_id]);
    const vendorId = poRes.rows[0]?.vendor_id;

    if (data.items.length > 0) {
      const poItemIds = data.items.map(i => Number(i.purchase_order_item_id));
      const itemIds = data.items.map(i => Number(i.item_id));

      const poiRes = await client.query(
        `SELECT id, unit_price, conversion_ratio FROM purchase_order_items WHERE id = ANY($1::int[])`,
        [poItemIds]
      );
      const poiMap = new Map<number, typeof poiRes.rows[0]>();
      for (const row of poiRes.rows) poiMap.set(Number(row.id), row);

      // Fetch Brand items + parent_id untuk resolusi Induk
      const itemRes = await client.query(
        `SELECT id, conversion_ratio, current_average_price, parent_id FROM items WHERE id = ANY($1::int[]) FOR UPDATE`,
        [itemIds]
      );
      const itemMap = new Map<number, typeof itemRes.rows[0]>();
      for (const row of itemRes.rows) itemMap.set(Number(row.id), row);

      // Kumpulkan & LOCK Induk yang terlibat (brand dengan parent_id)
      const parentIdsToLock = [...new Set(
        itemRes.rows
          .filter((r: any) => r.parent_id != null)
          .map((r: any) => Number(r.parent_id))
      )];
      const parentItemMap = new Map<number, any>();
      if (parentIdsToLock.length > 0) {
        const parentRes = await client.query(
          `SELECT id, conversion_ratio, current_average_price FROM items WHERE id = ANY($1::int[]) FOR UPDATE`,
          [parentIdsToLock]
        );
        for (const row of parentRes.rows) parentItemMap.set(Number(row.id), row);
      }

      // Effective IDs: jika Brand → pakai parent_id (Induk), jika standalone → pakai dirinya sendiri
      const effectiveIdMap = new Map<number, number>(); // brandItemId -> effectiveItemId
      for (const row of itemRes.rows) {
        const eid = row.parent_id ? Number(row.parent_id) : Number(row.id);
        effectiveIdMap.set(Number(row.id), eid);
      }
      const allEffectiveIds = [...new Set(Array.from(effectiveIdMap.values()))];

      // Ambil stok terakhir berdasarkan Induk (bukan Brand)
      const stockRes = await client.query(
        `SELECT DISTINCT ON (item_id) item_id, ending_balance 
         FROM inventory_logs 
         WHERE item_id = ANY($1::int[]) 
         ORDER BY item_id, created_at DESC`,
        [allEffectiveIds]
      );
      const stockMap = new Map<number, any>();
      for (const row of stockRes.rows) stockMap.set(Number(row.item_id), row);

      const gri_receiptIds: number[] = [];
      const gri_poItemIds: number[] = [];
      const gri_itemIds: number[] = [];
      const gri_qtyReceived: number[] = [];

      const upd_itemIds: number[] = [];
      const upd_newAvgPrices: number[] = [];
      const upd_unitPrices: number[] = [];

      const inv_itemIds: number[] = [];
      const inv_qtyChanges: number[] = [];
      const inv_newStocks: number[] = [];
      const inv_receiptIds: number[] = [];

      const ph_itemIds: number[] = [];
      const ph_vendorIds: (number | null)[] = [];
      const ph_qtyReceived: number[] = [];
      const ph_unitPrices: number[] = [];
      const ph_newAvgPrices: number[] = [];
      const ph_poItemIds: number[] = [];

      const triggerActions: { itemId: number, newStock: number }[] = [];

      for (const item of data.items) {
        const poiData = poiMap.get(Number(item.purchase_order_item_id));
        const unit_price = poiData ? parseFloat(String(poiData.unit_price || '0')) : 0;

        // Ambil rasio dari PO item (snapshot satuan saat PO dibuat).
        const itemData = itemMap.get(Number(item.item_id));
        const masterRatio = itemData ? parseFloat(String(itemData.conversion_ratio || '1')) : 1;
        const poRatioRaw = poiData?.conversion_ratio;
        const ratio = (poRatioRaw !== null && poRatioRaw !== undefined && parseFloat(String(poRatioRaw)) > 0)
          ? parseFloat(String(poRatioRaw))
          : masterRatio;

        // INDUK-BRAND RESOLUTION:
        // Jika item yang diterima adalah Brand (parent_id IS NOT NULL),
        // arahkan STOK dan HARGA ke Induk (parent), bukan ke Brand itu sendiri.
        // goods_receipt_items tetap menyimpan Brand ID untuk audit trail PO.
        const effectiveItemId = effectiveIdMap.get(Number(item.item_id)) ?? Number(item.item_id);
        const effectiveItemData = parentItemMap.get(effectiveItemId) ?? itemData;
        const oldAvg = effectiveItemData ? parseFloat(String(effectiveItemData.current_average_price || '0')) : 0;

        const qtyInSmallestUnit = Number(item.qty_received) * ratio;
        const unitPriceInSmallestUnit = unit_price / ratio;

        // Stok Induk (effectiveItemId) dari inventory_logs
        const stockData = stockMap.get(effectiveItemId);
        const currentStock = stockData ? parseFloat(stockData.ending_balance || '0') : 0;
        const newStock = currentStock + qtyInSmallestUnit;
        
        // Update stockMap agar multi-baris PO ke Induk yang sama tetap sinkron
        if (stockData) {
          stockData.ending_balance = newStock.toString();
        } else {
          stockMap.set(effectiveItemId, { ending_balance: newStock.toString() });
        }

        const effectiveOldStock = currentStock > 0 ? currentStock : 0;
        const effectiveNewStock = effectiveOldStock + qtyInSmallestUnit;
        const oldValue = oldAvg * effectiveOldStock;
        const newValue = unitPriceInSmallestUnit * qtyInSmallestUnit;
        const newAvgPrice = effectiveNewStock > 0 ? (oldValue + newValue) / effectiveNewStock : unitPriceInSmallestUnit;

        // goods_receipt_items: tetap pakai Brand ID (item.item_id) untuk audit trail PO
        gri_receiptIds.push(Number(receipt.id));
        gri_poItemIds.push(Number(item.purchase_order_item_id));
        gri_itemIds.push(Number(item.item_id));
        gri_qtyReceived.push(Number(item.qty_received));

        // Stok, harga, dan price_history → Induk (effectiveItemId)
        upd_itemIds.push(effectiveItemId);
        upd_newAvgPrices.push(newAvgPrice);
        upd_unitPrices.push(unitPriceInSmallestUnit);
        
        // Update harga untuk Brand juga agar auto-fill PO selanjutnya akurat
        if (effectiveItemId !== Number(item.item_id)) {
          upd_itemIds.push(Number(item.item_id));
          upd_newAvgPrices.push(unitPriceInSmallestUnit);
          upd_unitPrices.push(unitPriceInSmallestUnit);
        }

        inv_itemIds.push(effectiveItemId);
        inv_qtyChanges.push(qtyInSmallestUnit);
        inv_newStocks.push(newStock);
        inv_receiptIds.push(Number(receipt.id));

        ph_itemIds.push(effectiveItemId);
        ph_vendorIds.push(vendorId ? Number(vendorId) : null);
        ph_qtyReceived.push(Number(item.qty_received));
        ph_unitPrices.push(unit_price);
        ph_newAvgPrices.push(newAvgPrice);
        ph_poItemIds.push(Number(item.purchase_order_item_id));

        // Alert & auto-fulfill → Induk
        triggerActions.push({ itemId: effectiveItemId, newStock });
      }

      await client.query(
        `INSERT INTO goods_receipt_items (goods_receipt_id, purchase_order_item_id, item_id, qty_received)
         SELECT * FROM UNNEST($1::int[], $2::int[], $3::int[], $4::numeric[])`,
        [gri_receiptIds, gri_poItemIds, gri_itemIds, gri_qtyReceived]
      );

      await client.query(
        `UPDATE items 
         SET current_average_price = u.new_avg, 
             last_purchase_price = u.unit_price, 
             updated_at = now() 
         FROM UNNEST($1::int[], $2::numeric[], $3::numeric[]) AS u(id, new_avg, unit_price)
         WHERE items.id = u.id`,
        [upd_itemIds, upd_newAvgPrices, upd_unitPrices]
      );

      await client.query(
        `INSERT INTO inventory_logs (item_id, movement_type, qty_change, ending_balance, reference_type, reference_id)
         SELECT u.item_id, 'IN', u.qty_change, u.new_stock, 'RECEIPT', u.receipt_id
         FROM UNNEST($1::int[], $2::numeric[], $3::numeric[], $4::int[]) AS u(item_id, qty_change, new_stock, receipt_id)`,
        [inv_itemIds, inv_qtyChanges, inv_newStocks, inv_receiptIds]
      );

      await client.query(
        `INSERT INTO price_history (item_id, vendor_id, purchase_date, purchase_qty, unit_purchase_price, new_average_price, purchase_order_item_id)
         SELECT u.item_id, u.vendor_id, CURRENT_DATE, u.qty_recv, u.unit_price, u.new_avg, u.po_item_id
         FROM UNNEST($1::int[], $2::int[], $3::numeric[], $4::numeric[], $5::numeric[], $6::int[]) AS u(item_id, vendor_id, qty_recv, unit_price, new_avg, po_item_id)`,
        [ph_itemIds, ph_vendorIds, ph_qtyReceived, ph_unitPrices, ph_newAvgPrices, ph_poItemIds]
      );

      // WARN-02 Fix: Jalankan autoFulfillPendingRequestsBulk dan checkAndCreateAlertBulk
      // secara bulk pada client transaksi yang sama.
      if (triggerActions.length > 0) {
        const uniqueTriggers = Array.from(
          new Map(triggerActions.map(t => [t.itemId, t])).values()
        );
        await autoFulfillPendingRequestsBulk(client, uniqueTriggers);
        await checkAndCreateAlertBulk(uniqueTriggers, client);
      }

      if (upd_itemIds.length > 0) {
        await syncMenuHppByItems(client, upd_itemIds);
      }
    }
    
    // Check if PO is fully received
    const poItemsRes = await client.query(
      `SELECT poi.id, poi.qty, COALESCE(SUM(gri.qty_received), 0) as total_received
       FROM purchase_order_items poi
       LEFT JOIN goods_receipt_items gri ON gri.purchase_order_item_id = poi.id
       WHERE poi.purchase_order_id = $1 AND poi.item_id IS NOT NULL
       GROUP BY poi.id, poi.qty`,
      [data.purchase_order_id]
    );
    
    let isFullyReceived = true;
    for (const row of poItemsRes.rows) {
      if (parseFloat(row.total_received) < parseFloat(row.qty)) {
        isFullyReceived = false;
        break;
      }
    }
    
    const newStatus = isFullyReceived ? 'SELESAI' : 'DITERIMA_SEBAGIAN';
    await client.query(`UPDATE purchase_orders SET status = $1, updated_at = now() WHERE id = $2`, [newStatus, data.purchase_order_id]);
    
    return receipt;
  });
}
