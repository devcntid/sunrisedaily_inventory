import { query, withTransaction } from '@/lib/db';

export interface OutletTransfer {
  id: number;
  transfer_number: string;
  from_outlet_id: number | null;
  from_outlet_name: string | null;
  to_outlet_id: number;
  to_outlet_name: string;
  requested_by: number | null;
  requested_by_name: string | null;
  approved_by: number | null;
  approved_by_name: string | null;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';
  notes: string | null;
  rejection_reason: string | null;
  total_cost: number;
  created_at: string;
  approved_at: string | null;
  received_at: string | null;
  proof_image_url?: string | null;
  item_count?: number;
}

export interface OutletTransferItem {
  id: number;
  transfer_id: number;
  item_id: number;
  item_name: string;
  requested_qty: number;
  received_qty: number;
  unit: string;
  cost_per_unit: number;
  subtotal_cost: number;
  smallest_unit?: string;
  purchase_unit?: string;
  conversion_ratio?: number;
  discrepancy_reason?: string | null;
  issue_photo_url?: string | null;
}

export interface AvailableTransferStockItem {
  item_id: number;
  item_name: string;
  category_name: string;
  current_balance: number;
  purchase_unit: string;
  smallest_unit: string;
  conversion_ratio: number;
  current_average_price: number;
}

export interface ItemStockByOutlet {
  item_id: number;
  item_name: string;
  smallest_unit: string;
  purchase_unit: string;
  conversion_ratio: number;
  stocks: {
    outlet_id: number;
    outlet_name: string;
    current_balance: number;
  }[];
}

/**
 * Mendapatkan daftar live stok barang di outlet sumber yang bisa dimutasikan
 */
export async function getAvailableTransferStock(sourceOutletId: number): Promise<AvailableTransferStockItem[]> {
  const result = await query<any>(`
    SELECT 
      i.id AS item_id,
      i.name AS item_name,
      COALESCE(c.name, 'Umum') AS category_name,
      COALESCE(os.current_balance, 0)::numeric AS current_balance,
      i.purchase_unit,
      i.smallest_unit,
      COALESCE(i.conversion_ratio, 1)::numeric AS conversion_ratio,
      COALESCE(NULLIF(i.current_average_price, 0), i.last_purchase_price, 0)::numeric AS current_average_price
    FROM items i
    LEFT JOIN categories c ON c.id = i.category_id
    LEFT JOIN outlet_stocks os ON os.item_id = i.id AND os.outlet_id = $1
    WHERE i.is_active = TRUE
      AND i.parent_id IS NULL
    ORDER BY (COALESCE(os.current_balance, 0) > 0) DESC, i.name ASC
  `, [sourceOutletId]);

  return result.rows.map(r => ({
    item_id: Number(r.item_id),
    item_name: r.item_name,
    category_name: r.category_name,
    current_balance: Number(r.current_balance || 0),
    purchase_unit: r.purchase_unit,
    smallest_unit: r.smallest_unit,
    conversion_ratio: Number(r.conversion_ratio || 1),
    current_average_price: Number(r.current_average_price || 0),
  }));
}

/**
 * Mengambil komparasi live stok barang di seluruh outlet cabang untuk kebutuhan alokasi Admin
 */
export async function getOutletStockComparison(itemIds: number[]): Promise<ItemStockByOutlet[]> {
  if (!itemIds || itemIds.length === 0) return [];

  const itemsRes = await query<any>(`
    SELECT 
      i.id,
      i.name,
      i.smallest_unit,
      i.purchase_unit,
      COALESCE(i.conversion_ratio, 1)::numeric AS conversion_ratio
    FROM items i
    WHERE i.id = ANY($1::bigint[])
    ORDER BY i.name ASC
  `, [itemIds]);

  const outletsRes = await query<any>(`
    SELECT id, name
    FROM outlets
    WHERE is_active = TRUE
    ORDER BY id ASC
  `);

  const stocksRes = await query<any>(`
    SELECT 
      os.item_id,
      os.outlet_id,
      COALESCE(os.current_balance, 0)::numeric AS current_balance
    FROM outlet_stocks os
    WHERE os.item_id = ANY($1::bigint[])
  `, [itemIds]);

  const stockMap: Record<string, number> = {};
  for (const s of stocksRes.rows) {
    stockMap[`${s.item_id}_${s.outlet_id}`] = Number(s.current_balance || 0);
  }

  return itemsRes.rows.map(it => ({
    item_id: Number(it.id),
    item_name: it.name,
    smallest_unit: it.smallest_unit,
    purchase_unit: it.purchase_unit,
    conversion_ratio: Number(it.conversion_ratio || 1),
    stocks: outletsRes.rows.map(o => ({
      outlet_id: Number(o.id),
      outlet_name: o.name,
      current_balance: stockMap[`${it.id}_${o.id}`] || 0,
    })),
  }));
}

/**
 * Mengambil daftar mutasi antar outlet
 */
export async function getOutletTransfers(params?: {
  outletId?: number;
  status?: string;
  search?: string;
}): Promise<OutletTransfer[]> {
  const conditions: string[] = [];
  const queryParams: any[] = [];
  let paramIdx = 1;

  if (params?.outletId) {
    conditions.push(`(t.from_outlet_id = $${paramIdx} OR t.to_outlet_id = $${paramIdx})`);
    queryParams.push(params.outletId);
    paramIdx++;
  }

  if (params?.status) {
    conditions.push(`t.status = $${paramIdx++}`);
    queryParams.push(params.status);
  }

  if (params?.search) {
    conditions.push(`(t.transfer_number ILIKE $${paramIdx} OR ofrom.name ILIKE $${paramIdx} OR oto.name ILIKE $${paramIdx})`);
    queryParams.push(`%${params.search}%`);
    paramIdx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT 
      t.id,
      t.transfer_number,
      t.from_outlet_id,
      ofrom.name AS from_outlet_name,
      t.to_outlet_id,
      oto.name AS to_outlet_name,
      t.requested_by,
      ureq.name AS requested_by_name,
      t.approved_by,
      uapp.name AS approved_by_name,
      t.status,
      t.notes,
      t.rejection_reason,
      t.total_cost::numeric AS total_cost,
      t.created_at,
      t.approved_at,
      t.received_at,
      COUNT(ti.id)::int AS item_count
    FROM outlet_transfers t
    LEFT JOIN outlets ofrom ON ofrom.id = t.from_outlet_id
    JOIN outlets oto ON oto.id = t.to_outlet_id
    LEFT JOIN users ureq ON ureq.id = t.requested_by
    LEFT JOIN users uapp ON uapp.id = t.approved_by
    LEFT JOIN outlet_transfer_items ti ON ti.transfer_id = t.id
    ${whereClause}
    GROUP BY t.id, ofrom.name, oto.name, ureq.name, uapp.name
    ORDER BY t.created_at DESC
  `;

  const result = await query<any>(sql, queryParams);
  return result.rows.map(r => ({
    id: Number(r.id),
    transfer_number: r.transfer_number,
    from_outlet_id: r.from_outlet_id ? Number(r.from_outlet_id) : null,
    from_outlet_name: r.from_outlet_name || null,
    to_outlet_id: Number(r.to_outlet_id),
    to_outlet_name: r.to_outlet_name,
    requested_by: r.requested_by ? Number(r.requested_by) : null,
    requested_by_name: r.requested_by_name,
    approved_by: r.approved_by ? Number(r.approved_by) : null,
    approved_by_name: r.approved_by_name,
    status: r.status,
    notes: r.notes,
    rejection_reason: r.rejection_reason,
    total_cost: Number(r.total_cost || 0),
    created_at: r.created_at,
    approved_at: r.approved_at,
    received_at: r.received_at,
    item_count: Number(r.item_count || 1),
  }));
}

/**
 * Mengambil detail mutasi beserta daftar barangnya
 */
export async function getOutletTransferDetail(transferId: number): Promise<{
  transfer: OutletTransfer | null;
  items: OutletTransferItem[];
}> {
  const headerRes = await query<any>(`
    SELECT 
      t.id,
      t.transfer_number,
      t.from_outlet_id,
      ofrom.name AS from_outlet_name,
      t.to_outlet_id,
      oto.name AS to_outlet_name,
      t.requested_by,
      ureq.name AS requested_by_name,
      t.approved_by,
      uapp.name AS approved_by_name,
      t.status,
      t.notes,
      t.rejection_reason,
      t.total_cost::numeric AS total_cost,
      t.created_at,
      t.approved_at,
      t.received_at,
      t.proof_image_url
    FROM outlet_transfers t
    LEFT JOIN outlets ofrom ON ofrom.id = t.from_outlet_id
    JOIN outlets oto ON oto.id = t.to_outlet_id
    LEFT JOIN users ureq ON ureq.id = t.requested_by
    LEFT JOIN users uapp ON uapp.id = t.approved_by
    WHERE t.id = $1
  `, [transferId]);

  if (headerRes.rows.length === 0) {
    return { transfer: null, items: [] };
  }

  const r = headerRes.rows[0];
  const transfer: OutletTransfer = {
    id: Number(r.id),
    transfer_number: r.transfer_number,
    from_outlet_id: r.from_outlet_id ? Number(r.from_outlet_id) : null,
    from_outlet_name: r.from_outlet_name || null,
    to_outlet_id: Number(r.to_outlet_id),
    to_outlet_name: r.to_outlet_name,
    requested_by: r.requested_by ? Number(r.requested_by) : null,
    requested_by_name: r.requested_by_name,
    approved_by: r.approved_by ? Number(r.approved_by) : null,
    approved_by_name: r.approved_by_name,
    status: r.status,
    notes: r.notes,
    rejection_reason: r.rejection_reason,
    total_cost: Number(r.total_cost || 0),
    created_at: r.created_at,
    approved_at: r.approved_at,
    received_at: r.received_at,
    proof_image_url: r.proof_image_url || null,
  };

  const itemsRes = await query<any>(`
    SELECT 
      ti.id,
      ti.transfer_id,
      ti.item_id,
      i.name AS item_name,
      ti.requested_qty::numeric AS requested_qty,
      ti.received_qty::numeric AS received_qty,
      ti.unit,
      ti.cost_per_unit::numeric AS cost_per_unit,
      ti.subtotal_cost::numeric AS subtotal_cost,
      i.smallest_unit,
      i.purchase_unit,
      COALESCE(i.conversion_ratio, 1)::numeric AS conversion_ratio,
      iss.reason AS discrepancy_reason,
      iss.photo_url AS issue_photo_url
    FROM outlet_transfer_items ti
    JOIN items i ON i.id = ti.item_id
    LEFT JOIN outlet_transfer_issues iss ON iss.transfer_item_id = ti.id
    WHERE ti.transfer_id = $1
    ORDER BY ti.id ASC
  `, [transferId]);

  const items: OutletTransferItem[] = itemsRes.rows.map(it => ({
    id: Number(it.id),
    transfer_id: Number(it.transfer_id),
    item_id: Number(it.item_id),
    item_name: it.item_name,
    requested_qty: Number(it.requested_qty || 0),
    received_qty: Number(it.received_qty || 0),
    unit: it.unit,
    cost_per_unit: Number(it.cost_per_unit || 0),
    subtotal_cost: Number(it.subtotal_cost || 0),
    smallest_unit: it.smallest_unit,
    purchase_unit: it.purchase_unit,
    conversion_ratio: Number(it.conversion_ratio || 1),
    discrepancy_reason: it.discrepancy_reason || null,
    issue_photo_url: it.issue_photo_url || null,
  }));

  return {
    transfer,
    items,
  };
}

/**
 * Membuat permohonan mutasi barang baru oleh outlet (Outlet hanya mengirimkan barang & Qty yang dibutuhkan)
 */
export async function createOutletTransferRequest(data: {
  from_outlet_id?: number | null;
  to_outlet_id: number;
  requested_by: number;
  notes?: string;
  items: {
    item_id: number;
    qty: number;
    unit: string;
  }[];
}): Promise<number> {
  if (data.from_outlet_id && Number(data.from_outlet_id) === Number(data.to_outlet_id)) {
    throw new Error('Outlet asal dan outlet tujuan tidak boleh sama.');
  }

  if (!data.items || data.items.length === 0) {
    throw new Error('Minimal harus ada satu barang yang dimutasikan.');
  }

  return await withTransaction(async (client) => {
    // 1. Generate nomor mutasi (TRF-YYYYMMDD-XXXX)
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const seqRes = await client.query(`
      SELECT COUNT(*) + 1 AS next_seq
      FROM outlet_transfers
      WHERE created_at::date = CURRENT_DATE
    `);
    const seq = String(seqRes.rows[0].next_seq).padStart(4, '0');
    const transferNumber = `TRF-${dateStr}-${seq}`;

    // 2. Hitung total nilai modal
    let grandTotalCost = 0;
    const validatedItems: {
      item_id: number;
      qty: number;
      unit: string;
      cost_per_unit: number;
      subtotal_cost: number;
    }[] = [];

    for (const it of data.items) {
      if (it.qty <= 0) {
        throw new Error(`Jumlah barang untuk item ID ${it.item_id} harus lebih dari 0.`);
      }

      // Ambil data item
      const itemRes = await client.query(`
        SELECT 
          i.id, i.name, i.smallest_unit, i.purchase_unit, i.conversion_ratio,
          COALESCE(NULLIF(i.current_average_price, 0), i.last_purchase_price, 0)::numeric AS unit_price
        FROM items i
        WHERE i.id = $1
      `, [it.item_id]);

      if (itemRes.rows.length === 0) {
        throw new Error(`Item ID ${it.item_id} tidak ditemukan.`);
      }

      const itemInfo = itemRes.rows[0];
      const convRatio = Number(itemInfo.conversion_ratio) || 1;
      const isPurchaseUnit = it.unit.toLowerCase() === (itemInfo.purchase_unit || '').toLowerCase();

      // Biaya modal per satuan yang diminta:
      // unit_price (current_average_price) di DB adalah harga modal per smallest_unit (misal per gram)
      const smallestUnitCost = Number(itemInfo.unit_price) || 0;
      const costPerRequestedUnit = isPurchaseUnit ? (smallestUnitCost * convRatio) : smallestUnitCost;
      const subtotal = it.qty * costPerRequestedUnit;

      grandTotalCost += subtotal;
      validatedItems.push({
        item_id: it.item_id,
        qty: it.qty,
        unit: it.unit,
        cost_per_unit: costPerRequestedUnit,
        subtotal_cost: subtotal,
      });
    }

    // 3. Insert Header (from_outlet_id bisa null jika belum ditentukan Admin)
    const insertHeader = await client.query(`
      INSERT INTO outlet_transfers (
        transfer_number, from_outlet_id, to_outlet_id, requested_by,
        status, notes, total_cost
      ) VALUES ($1, $2, $3, $4, 'PENDING_APPROVAL', $5, $6)
      RETURNING id
    `, [transferNumber, data.from_outlet_id || null, data.to_outlet_id, data.requested_by, data.notes || null, grandTotalCost]);

    const transferId = insertHeader.rows[0].id;

    // 4. Insert Items
    for (const it of validatedItems) {
      await client.query(`
        INSERT INTO outlet_transfer_items (
          transfer_id, item_id, requested_qty, received_qty, unit, cost_per_unit, subtotal_cost
        ) VALUES ($1, $2, $3, $3, $4, $5, $6)
      `, [transferId, it.item_id, it.qty, it.unit, it.cost_per_unit, it.subtotal_cost]);
    }

    return transferId;
  });
}

/**
 * Persetujuan mutasi oleh Admin Pusat dengan alokasi Outlet Sumber Pengirim
 */
export async function approveOutletTransfer(
  transferId: number,
  approvedByUserId: number,
  fromOutletId?: number
): Promise<boolean> {
  return await withTransaction(async (client) => {
    // 1. Ambil data mutasi
    const tRes = await client.query(`
      SELECT id, transfer_number, from_outlet_id, to_outlet_id, status
      FROM outlet_transfers
      WHERE id = $1 FOR UPDATE
    `, [transferId]);

    if (tRes.rows.length === 0) {
      throw new Error('Data mutasi tidak ditemukan.');
    }

    const transfer = tRes.rows[0];
    if (transfer.status !== 'PENDING_APPROVAL') {
      throw new Error(`Mutasi tidak dapat disetujui karena status saat ini adalah "${transfer.status}".`);
    }

    const effectiveFromOutletId = fromOutletId || transfer.from_outlet_id;
    if (!effectiveFromOutletId) {
      throw new Error('Outlet sumber pengirim wajib ditentukan sebelum menyetujui mutasi.');
    }

    if (Number(effectiveFromOutletId) === Number(transfer.to_outlet_id)) {
      throw new Error('Outlet pengirim dan outlet penerima tidak boleh sama.');
    }

    // 2. Validasi stok outlet sumber
    const itemsRes = await client.query(`
      SELECT 
        ti.id, ti.item_id, ti.requested_qty, ti.unit,
        i.name AS item_name, i.smallest_unit, i.purchase_unit, COALESCE(i.conversion_ratio, 1)::numeric AS conversion_ratio,
        COALESCE(os.current_balance, 0)::numeric AS current_balance
      FROM outlet_transfer_items ti
      JOIN items i ON i.id = ti.item_id
      LEFT JOIN outlet_stocks os ON os.item_id = ti.item_id AND os.outlet_id = $1
      WHERE ti.transfer_id = $2
    `, [effectiveFromOutletId, transferId]);

    for (const it of itemsRes.rows) {
      const convRatio = Number(it.conversion_ratio) || 1;
      const isPurchaseUnit = it.unit.toLowerCase() === (it.purchase_unit || '').toLowerCase();
      const requiredSmallestQty = isPurchaseUnit ? Number(it.requested_qty) * convRatio : Number(it.requested_qty);

      if (Number(it.current_balance) < requiredSmallestQty) {
        throw new Error(`Stok barang "${it.item_name}" di outlet pengirim tidak mencukupi (Tersedia: ${it.current_balance} ${it.smallest_unit}, Dimohon: ${requiredSmallestQty} ${it.smallest_unit}). Alokasi mutasi tidak dapat dilakukan.`);
      }
    }

    // 3. Update transfer status and assigned from_outlet_id
    const result = await client.query(`
      UPDATE outlet_transfers
      SET status = 'APPROVED',
          from_outlet_id = $1,
          approved_by = $2,
          approved_at = NOW()
      WHERE id = $3 AND status = 'PENDING_APPROVAL'
    `, [effectiveFromOutletId, approvedByUserId, transferId]);

    return (result.rowCount ?? 0) > 0;
  });
}

/**
 * Pembuatan Mutasi Langsung Antar Outlet oleh Admin Pusat (Direct Transfer)
 */
export async function createDirectOutletTransfer(data: {
  from_outlet_id: number;
  to_outlet_id: number;
  created_by: number;
  notes?: string;
  items: {
    item_id: number;
    qty: number;
    unit: string;
  }[];
}): Promise<number> {
  if (Number(data.from_outlet_id) === Number(data.to_outlet_id)) {
    throw new Error('Outlet asal dan outlet tujuan tidak boleh sama.');
  }

  if (!data.items || data.items.length === 0) {
    throw new Error('Minimal harus ada satu barang yang dimutasikan.');
  }

  return await withTransaction(async (client) => {
    // 1. Generate nomor mutasi
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const seqRes = await client.query(`
      SELECT COUNT(*) + 1 AS next_seq
      FROM outlet_transfers
      WHERE created_at::date = CURRENT_DATE
    `);
    const seq = String(seqRes.rows[0].next_seq).padStart(4, '0');
    const transferNumber = `TRF-${dateStr}-${seq}`;

    // 2. Hitung total nilai modal & validasi stok outlet sumber
    let grandTotalCost = 0;
    const validatedItems: {
      item_id: number;
      qty: number;
      unit: string;
      cost_per_unit: number;
      subtotal_cost: number;
    }[] = [];

    for (const it of data.items) {
      if (it.qty <= 0) {
        throw new Error(`Jumlah barang untuk item ID ${it.item_id} harus lebih dari 0.`);
      }

      const itemRes = await client.query(`
        SELECT 
          i.id, i.name, i.smallest_unit, i.purchase_unit, i.conversion_ratio,
          COALESCE(NULLIF(i.current_average_price, 0), i.last_purchase_price, 0)::numeric AS unit_price,
          COALESCE(os.current_balance, 0)::numeric AS current_balance
        FROM items i
        LEFT JOIN outlet_stocks os ON os.item_id = i.id AND os.outlet_id = $1
        WHERE i.id = $2
      `, [data.from_outlet_id, it.item_id]);

      if (itemRes.rows.length === 0) {
        throw new Error(`Item ID ${it.item_id} tidak ditemukan.`);
      }

      const itemInfo = itemRes.rows[0];
      const convRatio = Number(itemInfo.conversion_ratio) || 1;
      const isPurchaseUnit = it.unit.toLowerCase() === (itemInfo.purchase_unit || '').toLowerCase();
      const requiredSmallestQty = isPurchaseUnit ? it.qty * convRatio : it.qty;

      if (Number(itemInfo.current_balance) < requiredSmallestQty) {
        throw new Error(`Stok "${itemInfo.name}" di outlet asal tidak mencukupi (Tersedia: ${itemInfo.current_balance} ${itemInfo.smallest_unit}, Diminta: ${requiredSmallestQty} ${itemInfo.smallest_unit}).`);
      }

      // Biaya modal per satuan yang diminta:
      // unit_price (current_average_price) di DB adalah harga modal per smallest_unit (misal per gram)
      const smallestUnitCost = Number(itemInfo.unit_price) || 0;
      const costPerRequestedUnit = isPurchaseUnit ? (smallestUnitCost * convRatio) : smallestUnitCost;
      const subtotal = it.qty * costPerRequestedUnit;

      grandTotalCost += subtotal;
      validatedItems.push({
        item_id: it.item_id,
        qty: it.qty,
        unit: it.unit,
        cost_per_unit: costPerRequestedUnit,
        subtotal_cost: subtotal,
      });
    }

    // 3. Insert Header (langsung APPROVED)
    const insertHeader = await client.query(`
      INSERT INTO outlet_transfers (
        transfer_number, from_outlet_id, to_outlet_id, requested_by, approved_by,
        status, notes, total_cost, approved_at
      ) VALUES ($1, $2, $3, $4, $4, 'APPROVED', $5, $6, NOW())
      RETURNING id
    `, [transferNumber, data.from_outlet_id, data.to_outlet_id, data.created_by, data.notes || 'Mutasi langsung dibuat oleh Admin Pusat', grandTotalCost]);

    const transferId = insertHeader.rows[0].id;

    // 4. Insert Items
    for (const it of validatedItems) {
      await client.query(`
        INSERT INTO outlet_transfer_items (
          transfer_id, item_id, requested_qty, received_qty, unit, cost_per_unit, subtotal_cost
        ) VALUES ($1, $2, $3, $3, $4, $5, $6)
      `, [transferId, it.item_id, it.qty, it.unit, it.cost_per_unit, it.subtotal_cost]);
    }

    return transferId;
  });
}

/**
 * Penolakan mutasi oleh Admin Pusat
 */
export async function rejectOutletTransfer(transferId: number, rejectedByUserId: number, reason: string): Promise<boolean> {
  const result = await query(`
    UPDATE outlet_transfers
    SET status = 'REJECTED',
        approved_by = $1,
        approved_at = NOW(),
        rejection_reason = $2
    WHERE id = $3 AND status = 'PENDING_APPROVAL'
  `, [rejectedByUserId, reason, transferId]);

  return (result.rowCount ?? 0) > 0;
}

let _transferIssuesTableChecked = false;
export async function ensureTransferIssuesTable() {
  if (_transferIssuesTableChecked) return;
  try {
    await query(`
      ALTER TABLE outlet_transfers ADD COLUMN IF NOT EXISTS proof_image_url VARCHAR(1024);
      CREATE TABLE IF NOT EXISTS outlet_transfer_issues (
        id BIGSERIAL PRIMARY KEY,
        transfer_id BIGINT NOT NULL REFERENCES outlet_transfers(id) ON DELETE CASCADE,
        transfer_item_id BIGINT NOT NULL REFERENCES outlet_transfer_items(id) ON DELETE CASCADE,
        qty_issue NUMERIC(12,2) NOT NULL,
        reason VARCHAR(255) NOT NULL,
        photo_url VARCHAR(1024),
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        resolved_at TIMESTAMPTZ,
        resolved_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
        resolution_notes VARCHAR(1024)
      );
      CREATE INDEX IF NOT EXISTS idx_outlet_transfer_issues_transfer ON outlet_transfer_issues(transfer_id);
      CREATE INDEX IF NOT EXISTS idx_outlet_transfer_issues_status ON outlet_transfer_issues(status);
    `);
    _transferIssuesTableChecked = true;
  } catch (err) {
    console.error('Error ensuring outlet_transfer_issues table:', err);
  }
}

/**
 * Mengambil daftar mutasi untuk halaman Penerimaan Barang (status APPROVED / dikirim dan COMPLETED / riwayat diterima)
 */
export async function getApprovedTransfersForReceiving(outletId?: number): Promise<any[]> {
  await ensureTransferIssuesTable();
  const conditions = ["ot.status IN ('APPROVED', 'COMPLETED')"];
  const params: any[] = [];
  if (outletId) {
    params.push(outletId);
    conditions.push(`ot.to_outlet_id = $${params.length}`);
  }

  const res = await query<any>(`
    SELECT 
      ot.id,
      ot.transfer_number,
      ot.from_outlet_id,
      from_o.name AS from_outlet_name,
      ot.to_outlet_id,
      to_o.name AS to_outlet_name,
      ot.status,
      ot.notes,
      ot.total_cost,
      ot.approved_at,
      ot.created_at,
      ot.received_at,
      ot.proof_image_url,
      u.name AS requested_by_name,
      appr.name AS approved_by_name,
      COUNT(ti.id)::int AS item_count
    FROM outlet_transfers ot
    JOIN outlets from_o ON from_o.id = ot.from_outlet_id
    JOIN outlets to_o ON to_o.id = ot.to_outlet_id
    LEFT JOIN users u ON u.id = ot.requested_by
    LEFT JOIN users appr ON appr.id = ot.approved_by
    LEFT JOIN outlet_transfer_items ti ON ti.transfer_id = ot.id
    WHERE ${conditions.join(' AND ')}
    GROUP BY ot.id, from_o.name, to_o.name, u.name, appr.name
    ORDER BY 
      CASE WHEN ot.status = 'APPROVED' THEN 0 ELSE 1 END,
      COALESCE(ot.approved_at, ot.created_at) DESC,
      ot.id DESC
  `, params);
  return res.rows;
}

export interface ReceiveTransferItemInput {
  transfer_item_id?: number;
  item_id: number;
  received_qty: number;
  issue_reason?: string;
  issue_photo_url?: string;
}

/**
 * Konfirmasi penerimaan barang oleh Outlet Penerima (Atomic Execution: Potong Asal, Tambah Tujuan, Mutasi HPP & Catat Tiket Masalah jika ada selisih)
 */
export async function completeOutletTransfer(
  transferId: number,
  receiptData?: {
    received_items?: ReceiveTransferItemInput[];
    proof_image_url?: string;
  }
): Promise<boolean> {
  await ensureTransferIssuesTable();
  return await withTransaction(async (client) => {
    // 1. Ambil data transfer
    const tRes = await client.query(`
      SELECT id, transfer_number, from_outlet_id, to_outlet_id, status, total_cost, notes
      FROM outlet_transfers
      WHERE id = $1 FOR UPDATE
    `, [transferId]);

    if (tRes.rows.length === 0) {
      throw new Error('Data mutasi tidak ditemukan.');
    }

    const transfer = tRes.rows[0];
    if (transfer.status !== 'APPROVED') {
      throw new Error(`Mutasi tidak dapat diselesaikan karena status saat ini adalah "${transfer.status}".`);
    }

    if (!transfer.from_outlet_id) {
      throw new Error('Outlet asal belum ditentukan.');
    }

    // 2. Ambil rincian item
    const itemsRes = await client.query(`
      SELECT 
        ti.id, ti.item_id, ti.requested_qty, ti.unit, ti.cost_per_unit,
        i.name AS item_name, i.smallest_unit, i.purchase_unit, COALESCE(i.conversion_ratio, 1)::numeric AS conversion_ratio
      FROM outlet_transfer_items ti
      JOIN items i ON i.id = ti.item_id
      WHERE ti.transfer_id = $1
    `, [transferId]);

    const receiptMap = new Map<number, ReceiveTransferItemInput>();
    if (receiptData?.received_items) {
      for (const it of receiptData.received_items) {
        if (it.transfer_item_id) receiptMap.set(Number(it.transfer_item_id), it);
        else receiptMap.set(Number(it.item_id), it);
      }
    }

    for (const it of itemsRes.rows) {
      const convRatio = Number(it.conversion_ratio) || 1;
      const isPurchaseUnit = it.unit.toLowerCase() === (it.purchase_unit || '').toLowerCase();
      
      const requestedQty = Number(it.requested_qty);
      const itemReceipt = receiptMap.get(Number(it.id)) || receiptMap.get(Number(it.item_id));
      
      const receivedQty = itemReceipt !== undefined ? Math.max(0, Number(itemReceipt.received_qty)) : requestedQty;
      const issueQty = Math.max(0, requestedQty - receivedQty);

      // Update received_qty di tabel outlet_transfer_items
      await client.query(`
        UPDATE outlet_transfer_items
        SET received_qty = $1
        WHERE id = $2
      `, [receivedQty, it.id]);

      // Jika ada selisih (barang kurang / rusak), catat ke tabel outlet_transfer_issues
      if (issueQty > 0) {
        const reason = itemReceipt?.issue_reason || 'Barang Rusak / Hilang saat Pengiriman Mutasi';
        const photoUrl = itemReceipt?.issue_photo_url || receiptData?.proof_image_url || null;

        await client.query(`
          INSERT INTO outlet_transfer_issues (
            transfer_id, transfer_item_id, qty_issue, reason, photo_url, status, reported_at
          ) VALUES ($1, $2, $3, $4, $5, 'PENDING', NOW())
        `, [transferId, it.id, issueQty, reason, photoUrl]);
      }

      const qtySentInSmallest = isPurchaseUnit ? requestedQty * convRatio : requestedQty;
      const qtyReceivedInSmallest = isPurchaseUnit ? receivedQty * convRatio : receivedQty;

      // A. POTONG STOK DI OUTLET ASAL (from_outlet_id) Penuh sesuai yang dikirim
      const fromStockRes = await client.query(`
        SELECT current_balance FROM outlet_stocks
        WHERE outlet_id = $1 AND item_id = $2
        FOR UPDATE
      `, [transfer.from_outlet_id, it.item_id]);

      const fromOldBal = fromStockRes.rows.length > 0 ? Number(fromStockRes.rows[0].current_balance) : 0;
      const fromNewBal = fromOldBal - qtySentInSmallest;

      await client.query(`
        INSERT INTO outlet_stocks (outlet_id, item_id, current_balance, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (outlet_id, item_id)
        DO UPDATE SET current_balance = $3, updated_at = NOW()
      `, [transfer.from_outlet_id, it.item_id, fromNewBal]);

      // Catat log inventori OUT pada outlet asal
      await client.query(`
        INSERT INTO outlet_inventory_logs (
          outlet_id, item_id, movement_type, qty_change, ending_balance, reference_type, reference_id, created_at
        ) VALUES ($1, $2, 'TRANSFER_OUT', $3, $4, 'OUTLET_TRANSFER', $5, NOW())
      `, [transfer.from_outlet_id, it.item_id, -qtySentInSmallest, fromNewBal, transferId]);

      // B. TAMBAH STOK DI OUTLET TUJUAN (to_outlet_id) Sejumlah riil yang diterima
      if (qtyReceivedInSmallest > 0) {
        const toStockRes = await client.query(`
          SELECT current_balance FROM outlet_stocks
          WHERE outlet_id = $1 AND item_id = $2
          FOR UPDATE
        `, [transfer.to_outlet_id, it.item_id]);

        const toOldBal = toStockRes.rows.length > 0 ? Number(toStockRes.rows[0].current_balance) : 0;
        const toNewBal = toOldBal + qtyReceivedInSmallest;

        await client.query(`
          INSERT INTO outlet_stocks (outlet_id, item_id, current_balance, updated_at)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT (outlet_id, item_id)
          DO UPDATE SET current_balance = $3, updated_at = NOW()
        `, [transfer.to_outlet_id, it.item_id, toNewBal]);

        // Catat log inventori IN pada outlet tujuan
        await client.query(`
          INSERT INTO outlet_inventory_logs (
            outlet_id, item_id, movement_type, qty_change, ending_balance, reference_type, reference_id, created_at
          ) VALUES ($1, $2, 'TRANSFER_IN', $3, $4, 'OUTLET_TRANSFER', $5, NOW())
        `, [transfer.to_outlet_id, it.item_id, qtyReceivedInSmallest, toNewBal, transferId]);
      }
    }

    // 3. Update status mutasi menjadi COMPLETED
    await client.query(`
      UPDATE outlet_transfers
      SET status = 'COMPLETED',
          proof_image_url = $2,
          received_at = NOW()
      WHERE id = $1
    `, [transferId, receiptData?.proof_image_url || null]);

    return true;
  });
}

/**
 * Count of pending transfer requests needing Admin approval / allocation
 */
export async function getPendingTransfersCount(since?: string | null): Promise<number> {
  const conditions: string[] = ["status = 'PENDING_APPROVAL'"];
  const params: any[] = [];
  if (since) {
    params.push(new Date(Number(since)).toISOString());
    conditions.push(`created_at > $${params.length}`);
  }
  const sql = `SELECT COUNT(*)::text AS count FROM outlet_transfers WHERE ${conditions.join(' AND ')}`;
  const res = await query<{ count: string }>(sql, params);
  return parseInt(res.rows[0]?.count || '0', 10);
}

/**
 * Count of approved transfers waiting to be received by a specific outlet
 */
export async function getPendingReceivingTransfersCount(outletId: number, since?: string | null): Promise<number> {
  const conditions: string[] = ["status = 'APPROVED'", "to_outlet_id = $1"];
  const params: any[] = [outletId];
  if (since) {
    params.push(new Date(Number(since)).toISOString());
    conditions.push(`approved_at > $${params.length}`);
  }
  const sql = `SELECT COUNT(*)::text AS count FROM outlet_transfers WHERE ${conditions.join(' AND ')}`;
  const res = await query<{ count: string }>(sql, params);
  return parseInt(res.rows[0]?.count || '0', 10);
}

