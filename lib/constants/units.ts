/**
 * Daftar satuan baku yang digunakan di seluruh sistem.
 * Gunakan konstanta ini di semua form Select satuan agar konsisten.
 * Hindari string literal langsung — selalu referensikan dari sini.
 */

/** Satuan beli / terbesar (dari Gudang Pusat ke Outlet) */
export const PURCHASE_UNITS = [
  'Kg',
  'gr',
  'Liter',
  'ml',
  'Dus',
  'Karton',
  'Box',
  'Pack',
  'Bal',
  'Galon',
  'Jerigen',
  'Roll',
  'Pcs',
  'Botol',
  'Kaleng',
  'Bks',
  'Lembar',
  'Kotak',
  'Set',
  'Unit',
] as const;

/** Satuan terkecil / ecer (dipakai di Resep HPP & Opname Outlet) */
export const SMALLEST_UNITS = [
  'gr',
  'ml',
  'Pcs',
  'Shoot',
  'Slice',
  'Lembar',
  'Kotak',
  'Botol',
  'Kaleng',
  'Bks',
  'Roll',
  'Kg',
  'Liter',
  'Pack',
] as const;

/**
 * Normalisasi alias satuan ke bentuk kanonik.
 * Contoh: 'g' → 'gr', 'l' → 'Liter', 'pc' → 'Pcs'
 */
export const UNIT_ALIAS_MAP: Record<string, string> = {
  'g': 'gr',
  'gram': 'gr',
  'l': 'Liter',
  'liter': 'Liter',
  'litre': 'Liter',
  'pc': 'Pcs',
  'piece': 'Pcs',
  'pieces': 'Pcs',
  'pcs': 'Pcs',
  'kg': 'Kg',
  'kilogram': 'Kg',
  'ml': 'ml',
  'milliliter': 'ml',
  'box': 'Box',
  'pack': 'Pack',
  'roll': 'Roll',
  'lembar': 'Lembar',
  'botol': 'Botol',
  'kaleng': 'Kaleng',
  'bks': 'Bks',
  'kotak': 'Kotak',
  'set': 'Set',
  'unit': 'Unit',
};

/**
 * Normalkan string satuan ke bentuk kanoniknya.
 * Jika tidak ditemukan alias, kembalikan nilai asli (capitalize pertama).
 */
export function normalizeUnit(raw: string | null | undefined): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();
  return UNIT_ALIAS_MAP[lower] ?? trimmed;
}

/**
 * Hitung konversi dari satuan beli ke satuan terkecil.
 * @param qtyInSmallestUnit - Jumlah dalam satuan terkecil (dari DB)
 * @param conversionRatio - Rasio konversi (contoh: 1000 untuk 1 Kg = 1000 gr)
 * @returns Jumlah dalam satuan beli (untuk tampilan pengguna)
 */
export function convertToLargeUnit(qtyInSmallestUnit: number, conversionRatio: number): number {
  if (!conversionRatio || conversionRatio <= 0) return qtyInSmallestUnit;
  return qtyInSmallestUnit / conversionRatio;
}

/**
 * Hitung konversi dari satuan beli ke satuan terkecil.
 * @param qtyInLargeUnit - Jumlah dalam satuan beli (input pengguna)
 * @param conversionRatio - Rasio konversi (contoh: 1000 untuk 1 Kg = 1000 gr)
 * @returns Jumlah dalam satuan terkecil (untuk disimpan di DB)
 */
export function convertToSmallestUnit(qtyInLargeUnit: number, conversionRatio: number): number {
  if (!conversionRatio || conversionRatio <= 0) return qtyInLargeUnit;
  return qtyInLargeUnit * conversionRatio;
}
