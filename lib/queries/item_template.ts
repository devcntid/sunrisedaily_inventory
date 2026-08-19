import { query, withTransaction } from '@/lib/db';
import { PURCHASE_UNITS, SMALLEST_UNITS, normalizeUnit } from '@/lib/constants/units';

export interface ValidatedItemRow {
  item_id?: number | null;
  name: string;
  category_id: number;
  category_name: string;
  purchase_unit: string;
  smallest_unit: string;
  conversion_ratio: number;
  minimum_threshold: number;
  threshold_type: string;
  target_stock: number;
  current_average_price: number;
  barcode: string | null;
  status: string; // AKTIF / NONAKTIF
  is_perishable: boolean;
}

export async function getTemplateItems() {
  const result = await query(`
    SELECT
      i.id AS item_id,
      i.name AS nama_barang,
      c.name AS kategori,
      i.purchase_unit AS satuan_beli,
      i.smallest_unit AS satuan_terkecil,
      i.conversion_ratio AS rasio_konversi,
      i.minimum_threshold AS batas_minimum,
      i.threshold_type AS tipe_batas,
      i.target_stock AS stok_target,
      i.current_average_price AS harga_rata,
      i.barcode,
      CASE WHEN i.is_active THEN 'AKTIF' ELSE 'NONAKTIF' END AS status,
      CASE WHEN i.is_perishable THEN 'YA' ELSE 'TIDAK' END AS is_perishable
    FROM items i
    JOIN categories c ON c.id = i.category_id
    WHERE i.parent_id IS NULL
    ORDER BY i.id ASC
  `);
  return result.rows;
}

export async function getTemplateCategories() {
  const result = await query(`SELECT id, name FROM categories ORDER BY name ASC`);
  return result.rows as Array<{ id: number; name: string }>;
}

export async function getExistingItemLookup() {
  const result = await query(`
    SELECT id, name, barcode, parent_id
    FROM items
  `);
  return result.rows as Array<{
    id: number;
    name: string;
    barcode: string | null;
    parent_id: number | null;
  }>;
}

function parseYesNo(raw: string | undefined | null): boolean {
  const v = String(raw ?? '').trim().toUpperCase();
  return v === 'YA' || v === 'YES' || v === 'TRUE' || v === '1';
}

function parseNumber(raw: unknown, fallback: number): number {
  if (raw === null || raw === undefined || raw === '') return fallback;
  const n = Number(String(raw).replace(',', '.').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : fallback;
}

export type ItemPreviewRow = ValidatedItemRow & {
  row_index: number;
  action: 'INSERT' | 'UPDATE';
  isValid: boolean;
  errorMessage: string;
};

export async function buildItemPreviewRows(rawData: Record<string, unknown>[]): Promise<{
  rows: ItemPreviewRow[];
  summary: { total: number; valid: number; error: number; insert: number; update: number };
}> {
  const [categories, existing, templateItems] = await Promise.all([
    getTemplateCategories(),
    getExistingItemLookup(),
    getTemplateItems(),
  ]);

  const categoryByName = new Map(
    categories.map((c) => [c.name.trim().toLowerCase(), c])
  );
  const existingById = new Map(existing.map((i) => [Number(i.id), i]));
  const nameOwners = new Map<string, number>(); // lower name -> item id
  const barcodeOwners = new Map<string, number>(); // barcode -> item id

  for (const item of existing) {
    nameOwners.set(item.name.trim().toLowerCase(), Number(item.id));
    if (item.barcode) barcodeOwners.set(String(item.barcode).trim(), Number(item.id));
  }

  const purchaseAllowed = new Set<string>([
    ...PURCHASE_UNITS.map((u) => u.toLowerCase()),
    ...templateItems.map((r) => String(r.satuan_beli || '').toLowerCase()).filter(Boolean),
  ]);
  const smallestAllowed = new Set<string>([
    ...SMALLEST_UNITS.map((u) => u.toLowerCase()),
    ...templateItems.map((r) => String(r.satuan_terkecil || '').toLowerCase()).filter(Boolean),
  ]);

  const resolvePurchase = (raw: string): string | null => {
    const normalized = normalizeUnit(raw);
    if (!normalized) return null;
    if (purchaseAllowed.has(normalized.toLowerCase())) {
      return PURCHASE_UNITS.find((u) => u.toLowerCase() === normalized.toLowerCase()) || normalized;
    }
    return null;
  };
  const resolveSmallest = (raw: string): string | null => {
    const normalized = normalizeUnit(raw);
    if (!normalized) return null;
    if (smallestAllowed.has(normalized.toLowerCase())) {
      return SMALLEST_UNITS.find((u) => u.toLowerCase() === normalized.toLowerCase()) || normalized;
    }
    return null;
  };

  // Track names/barcodes within the file itself
  const fileNames = new Map<string, number>();
  const fileBarcodes = new Map<string, number>();

  const rows: ItemPreviewRow[] = [];
  let validCount = 0;
  let errorCount = 0;
  let insertCount = 0;
  let updateCount = 0;

  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    let isValid = true;
    let errorMessage = '';

    let item_id: number | null = null;
    if (row.id_barang !== undefined && row.id_barang !== null && String(row.id_barang).trim() !== '') {
      item_id = Number(row.id_barang);
    }

    const name = String(row.nama_barang ?? '').trim();
    const categoryName = String(row.kategori ?? '').trim();
    const purchaseRaw = String(row.satuan_beli ?? '').trim();
    const smallestRaw = String(row.satuan_terkecil ?? '').trim();
    const thresholdType = String(row.tipe_batas ?? 'ABSOLUT').trim().toUpperCase() || 'ABSOLUT';
    const status = String(row.status ?? 'AKTIF').trim().toUpperCase() || 'AKTIF';
    const barcodeRaw = String(row.barcode ?? '').trim();
    const barcode = barcodeRaw || null;

    // Skip empty / example rows
    if (!item_id && (!name || name.toLowerCase().startsWith('contoh:'))) continue;

    let action: 'INSERT' | 'UPDATE' = 'INSERT';
    if (item_id !== null) {
      if (Number.isNaN(item_id) || !existingById.has(item_id)) {
        action = 'INSERT';
        item_id = null;
      } else {
        const existingItem = existingById.get(item_id)!;
        if (existingItem.parent_id) {
          isValid = false;
          errorMessage += 'ID milik brand/anak, hanya induk yang diizinkan. ';
        } else {
          action = 'UPDATE';
        }
      }
    }

    if (!name) {
      isValid = false;
      errorMessage += 'Nama barang wajib diisi. ';
    }

    const category = categoryByName.get(categoryName.toLowerCase());
    if (!category) {
      isValid = false;
      errorMessage += 'Kategori tidak ditemukan. ';
    }

    const purchase_unit = resolvePurchase(purchaseRaw);
    if (!purchase_unit) {
      isValid = false;
      errorMessage += 'Satuan beli tidak valid. ';
    }

    const smallest_unit = resolveSmallest(smallestRaw);
    if (!smallest_unit) {
      isValid = false;
      errorMessage += 'Satuan terkecil tidak valid. ';
    }

    if (thresholdType !== 'ABSOLUT' && thresholdType !== 'PERSENTASE') {
      isValid = false;
      errorMessage += 'Tipe batas harus ABSOLUT atau PERSENTASE. ';
    }

    if (status !== 'AKTIF' && status !== 'NONAKTIF') {
      isValid = false;
      errorMessage += 'Status harus AKTIF atau NONAKTIF. ';
    }

    // Unique name within file
    if (name) {
      const key = name.toLowerCase();
      const prevRow = fileNames.get(key);
      if (prevRow) {
        isValid = false;
        errorMessage += `Nama duplikat di file (baris ${prevRow}). `;
      } else {
        fileNames.set(key, i + 2);
      }

      const ownerId = nameOwners.get(key);
      if (ownerId && (action === 'INSERT' || ownerId !== item_id)) {
        isValid = false;
        errorMessage += 'Nama barang sudah dipakai item lain. ';
      }
    }

    // Unique barcode within file + DB
    if (barcode) {
      const prevRow = fileBarcodes.get(barcode);
      if (prevRow) {
        isValid = false;
        errorMessage += `Barcode duplikat di file (baris ${prevRow}). `;
      } else {
        fileBarcodes.set(barcode, i + 2);
      }

      const ownerId = barcodeOwners.get(barcode);
      if (ownerId && (action === 'INSERT' || ownerId !== item_id)) {
        isValid = false;
        errorMessage += 'Barcode sudah dipakai item lain. ';
      }
    }

    const conversion_ratio = parseNumber(row.rasio_konversi, 1);
    const minimum_threshold = parseNumber(row.batas_minimum, 0);
    const target_stock = parseNumber(row.stok_target, 0);
    const current_average_price = parseNumber(row.harga_rata, 0);
    const is_perishable = parseYesNo(String(row.is_perishable ?? 'TIDAK'));

    if (conversion_ratio <= 0) {
      isValid = false;
      errorMessage += 'Rasio konversi harus > 0. ';
    }

    if (isValid) {
      validCount++;
      if (action === 'INSERT') insertCount++;
      if (action === 'UPDATE') updateCount++;
    } else {
      errorCount++;
    }

    rows.push({
      row_index: i + 2,
      item_id,
      action,
      name,
      category_id: category?.id ?? 0,
      category_name: categoryName,
      purchase_unit: purchase_unit || purchaseRaw,
      smallest_unit: smallest_unit || smallestRaw,
      conversion_ratio,
      minimum_threshold,
      threshold_type: thresholdType,
      target_stock,
      current_average_price,
      barcode,
      status,
      is_perishable,
      isValid,
      errorMessage: errorMessage.trim(),
    });
  }

  return {
    rows,
    summary: {
      total: rows.length,
      valid: validCount,
      error: errorCount,
      insert: insertCount,
      update: updateCount,
    },
  };
}

export async function upsertItems(rows: ValidatedItemRow[]) {
  await withTransaction(async (client) => {
    for (const row of rows) {
      const is_active = row.status === 'AKTIF';

      if (row.item_id) {
        await client.query(
          `UPDATE items SET
             name = $1,
             category_id = $2,
             purchase_unit = $3,
             smallest_unit = $4,
             conversion_ratio = $5,
             minimum_threshold = $6,
             threshold_type = $7,
             target_stock = $8,
             current_average_price = $9,
             barcode = COALESCE(NULLIF($10, ''), barcode),
             is_active = $11,
             is_perishable = $12,
             updated_at = now()
           WHERE id = $13 AND parent_id IS NULL`,
          [
            row.name,
            row.category_id,
            row.purchase_unit,
            row.smallest_unit,
            row.conversion_ratio,
            row.minimum_threshold,
            row.threshold_type,
            row.target_stock,
            row.current_average_price,
            row.barcode,
            is_active,
            row.is_perishable,
            row.item_id,
          ]
        );
      } else {
        const insertRes = await client.query<{ id: number; barcode: string | null }>(
          `INSERT INTO items (
             name, category_id, purchase_unit, smallest_unit, conversion_ratio,
             minimum_threshold, target_stock, threshold_type, is_perishable,
             barcode, current_average_price, last_purchase_price, is_active, is_global
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11,$12,true)
           RETURNING id, barcode`,
          [
            row.name,
            row.category_id,
            row.purchase_unit,
            row.smallest_unit,
            row.conversion_ratio,
            row.minimum_threshold,
            row.target_stock,
            row.threshold_type,
            row.is_perishable,
            row.barcode,
            row.current_average_price,
            is_active,
          ]
        );

        const created = insertRes.rows[0];
        if (created && !created.barcode) {
          const padded = String(created.id).padStart(6, '0');
          const code = `ERC${padded}`;
          await client.query(
            `UPDATE items SET barcode = $1, updated_at = now() WHERE id = $2`,
            [code, created.id]
          );
        }
      }
    }
  });
}
