'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import { MasterDataTabs } from '@/components/ui/MasterDataTabs';
import { Toggle } from '@/components/ui/Toggle';
import { Toast } from '@/components/ui/Toast';
import { Select } from '@/components/ui/Select';
import { HelpCircle, Info, Tag, Package, DollarSign, CheckCircle2, AlertCircle, AlertTriangle, RotateCcw, Trash2 } from 'lucide-react';
import { PURCHASE_UNITS, SMALLEST_UNITS, normalizeUnit } from '@/lib/constants/units';

interface Item {
  id: number; name: string; category_id: number; category_name: string; barcode?: string;
  purchase_unit: string; smallest_unit: string; conversion_ratio: number;
  minimum_threshold: number; target_stock: number; threshold_type: string; is_perishable: boolean;
  is_active: boolean; current_average_price: number; last_purchase_price?: number; current_stock?: number;
  is_hpp?: boolean;
  ingredient_id?: number | null;
  ingredient_name?: string;
  is_split_allowed?: boolean;
  min_order_qty?: number;
  order_multiple?: number;
  parent_id?: number | null;
  has_children?: boolean;
  is_global?: boolean;
  venue_ids?: number[];
}
interface BrandForm { id?: string; name: string; barcode: string; purchase_unit: string; purchase_price: string; conversion_ratio: string; current_average_price?: number; last_purchase_price?: number; is_active?: boolean; }
interface Category { id: number; name: string; }
interface Ingredient { id: number; name: string; unit?: string; }
interface Venue { id: number; name: string; }

const fmtCurrency = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

/** @deprecated Gunakan normalizeUnit dari lib/constants/units.ts */
export function normalizeUnitAlias(u: string | null | undefined): string {
  return normalizeUnit(u);
}

/**
 * Gabung satuan baku + satuan dinamis dari DB, deduplikasi berdasarkan canonical form.
 * Satuan baku selalu muncul di urutan atas.
 */
function getUniqueUnits(defaultUnits: readonly string[], dynamicUnits: (string | null | undefined)[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const u of [...defaultUnits, ...dynamicUnits]) {
    if (!u) continue;
    const canonical = normalizeUnit(u);
    const lower = canonical.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      result.push(canonical);
    }
  }
  return result.map(u => ({ value: u, label: u }));
}

function formatNumberInput(val: string | number): string {
  if (!val && val !== 0) return '';
  const str = String(val);
  if (str.endsWith('.')) {
    return Number(str.slice(0, -1)).toLocaleString('id-ID') + ',';
  }
  const parts = str.split('.');
  if (parts.length === 2) {
    return Number(parts[0]).toLocaleString('id-ID') + ',' + parts[1];
  }
  return Number(str).toLocaleString('id-ID', { maximumFractionDigits: 5 });
}

function parseNumberInput(val: string): string {
  return val.replace(/\./g, '').replace(',', '.');
}

function getStockStatus(item: Item): 'MERAH' | 'MENIPIS' | 'AMAN' {
  const stock = Number(item.current_stock || 0);
  const min = Number(item.minimum_threshold || 0);
  const target = Number(item.target_stock || 0);

  if (stock <= min) return 'MERAH';
  if (target > 0) {
    if (stock <= target) return 'MENIPIS';
    return 'AMAN';
  }
  if (stock <= min * 1.5) return 'MENIPIS';
  return 'AMAN';
}

function InfoTooltip({ text, align = 'right', width = 230 }: { text: string; align?: 'left' | 'right' | 'center'; width?: number }) {
  const [hover, setHover] = useState(false);
  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: 6, cursor: 'help' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <HelpCircle size={15} color="#64748b" />
      {hover && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          ...(align === 'left' ? { left: 0 } : align === 'center' ? { left: '50%', transform: 'translateX(-50%)' } : { right: 0 }),
          marginBottom: 6,
          background: '#ffffff',
          color: '#1e293b',
          border: '1px solid #cbd5e1',
          fontSize: 11.5,
          fontWeight: 500,
          padding: '10px 12px',
          borderRadius: 8,
          width,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          zIndex: 9999,
          lineHeight: 1.4,
          textAlign: 'left',
          pointerEvents: 'none'
        }}>
          {text}
          <div style={{
            position: 'absolute',
            top: '100%',
            ...(align === 'left' ? { left: 6 } : align === 'center' ? { left: '50%', transform: 'translateX(-50%)' } : { right: 6 }),
            borderWidth: '5px',
            borderStyle: 'solid',
            borderColor: '#ffffff transparent transparent transparent'
          }} />
        </div>
      )}
    </span>
  );
}

export default function ItemsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [filterPerishable, setFilterPerishable] = useState('');
  const [filterStockStatus, setFilterStockStatus] = useState('');

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [form, setForm] = useState({ name: '', barcode: '', category_id: '', purchase_unit: '', package_inner_size: '', smallest_unit: '', conversion_ratio: '1', minimum_threshold: '10', target_stock: '20', threshold_type: 'ABSOLUT', is_perishable: false, is_active: true, purchase_price: '0', has_conversion: false, ingredient_id: '', is_split_allowed: false, min_order_qty: '1', order_multiple: '1', has_brands: false, is_global: true, venue_ids: [] as number[] });
  const [brands, setBrands] = useState<BrandForm[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toastInfo, setToastInfo] = useState<{ show: boolean, msg: string, type: 'success' | 'error' | 'info' }>({ show: false, msg: '', type: 'info' });
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);

  // Price History Modal
  const [priceHistoryItem, setPriceHistoryItem] = useState<Item | null>(null);
  const [priceHistoryData, setPriceHistoryData] = useState<any[]>([]);
  const [loadingPriceHistory, setLoadingPriceHistory] = useState(false);
  const [priceHistoryStartDate, setPriceHistoryStartDate] = useState('');
  const [priceHistoryEndDate, setPriceHistoryEndDate] = useState('');

  async function openPriceHistory(item: Item) {
    setPriceHistoryItem(item);
    setLoadingPriceHistory(true);
    try {
      const res = await fetch(`/api/price-history?item_id=${item.id}&limit=50`);
      const data = await res.json();
      setPriceHistoryData(data.data ?? []);
    } catch (err) {
      setToastInfo({ show: true, msg: 'Gagal memuat riwayat harga', type: 'error' });
    } finally {
      setLoadingPriceHistory(false);
    }
  }

  // Stock Card
  const [confirmDelete, setConfirmDelete] = useState<Item | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Bulk Edit
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkForm, setBulkForm] = useState({ is_global: true, venue_ids: [] as number[] });
  const [bulkSaving, setBulkSaving] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ active_only: 'false' });
    if (search) params.set('search', search);
    if (catFilter) params.set('category_id', catFilter);
    const res = await fetch(`/api/items?${params}`);
    const data = await res.json();
    setItems(data.data ?? []);
    setLoading(false);
  }, [search, catFilter]);

  // Reset to page 1 only when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, catFilter, filterPerishable, filterStockStatus]);

  useEffect(() => {
    fetch('/api/categories').then(r => r.json()).then(d => setCategories(d.data ?? []));
    fetch('/api/settings/venues').then(r => r.json()).then(d => setVenues(d.data ?? []));
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // Auto-fill and lock Reporting Unit when has_brands is true
  useEffect(() => {
    if (form.has_brands && form.smallest_unit) {
      let autoPurchaseUnit = '';
      let autoConversionRatio = '1';

      if (form.smallest_unit.toLowerCase() === 'ml') {
        autoPurchaseUnit = 'Liter';
        autoConversionRatio = '1000';
      } else if (form.smallest_unit.toLowerCase() === 'gr') {
        autoPurchaseUnit = 'Kg';
        autoConversionRatio = '1000';
      } else {
        autoPurchaseUnit = form.smallest_unit; // Pcs -> Pcs, dll
        autoConversionRatio = '1';
      }

      // Update form state if it's different to prevent infinite loops
      if (form.purchase_unit !== autoPurchaseUnit || form.conversion_ratio !== autoConversionRatio) {
        setForm(f => ({
          ...f,
          purchase_unit: autoPurchaseUnit,
          conversion_ratio: autoConversionRatio
        }));
      }
    }
  }, [form.smallest_unit, form.has_brands]);

  function openAdd() {
    setEditing(null);
    setForm({ name: '', barcode: '', category_id: '', purchase_unit: '', package_inner_size: '', smallest_unit: '', conversion_ratio: '1', minimum_threshold: '10', target_stock: '20', threshold_type: 'ABSOLUT', is_perishable: false, is_active: true, purchase_price: '0', has_conversion: false, ingredient_id: '', is_split_allowed: false, min_order_qty: '1', order_multiple: '1', has_brands: false, is_global: true, venue_ids: [] });
    setBrands([]);
    setError('');
    setShowModal(true);
  }

  function openEdit(item: Item) {
    setEditing(item);
    const hasConv = item.purchase_unit !== item.smallest_unit || Number(item.conversion_ratio) > 1;
    const hasBrands = items.some(i => i.parent_id === item.id) || !!item.has_children;
    setForm({
      name: item.name, barcode: item.barcode || `ERC${String(item.id).padStart(6, '0')}`, category_id: String(item.category_id ?? ''),
      purchase_unit: normalizeUnit(item.purchase_unit), package_inner_size: '',
      smallest_unit: normalizeUnit(item.smallest_unit), conversion_ratio: String(Number(item.conversion_ratio)),
      // Untuk barang dengan brand: threshold disimpan langsung dalam satuan terkecil (ml), tidak perlu dibagi
      // Untuk barang tanpa brand: threshold di-display dalam satuan beli (purchase_unit)
      minimum_threshold: String(hasBrands ? Number(item.minimum_threshold) : Number(item.minimum_threshold) / (hasConv ? Number(item.conversion_ratio || 1) : 1)),
      target_stock: String(Number(item.target_stock ?? 0) / (hasConv ? Number(item.conversion_ratio || 1) : 1)),
      threshold_type: item.threshold_type,
      is_perishable: item.is_perishable, is_active: item.is_active,
      purchase_price: String(Math.round(Number(item.current_average_price ?? 0) * Number(item.conversion_ratio || 1))),
      has_conversion: hasConv,
      ingredient_id: item.ingredient_id ? String(item.ingredient_id) : '',
      is_split_allowed: item.is_split_allowed ?? false,
      min_order_qty: String(Number(item.min_order_qty ?? 1)),
      order_multiple: String(Number(item.order_multiple ?? 1)),
      has_brands: hasBrands,
      is_global: item.is_global ?? true,
      // Postgres json_agg mengembalikan venue_id sebagai string, pastikan dikonversi ke number & filter nilai 0/null
      venue_ids: (item.venue_ids || []).map((id: number | string) => Number(id)).filter((id: number) => id > 0)
    });
    let childBrands = items.filter(i => i.parent_id === item.id).map(child => ({
      id: String(child.id),
      name: child.name,
      barcode: child.barcode || `ERC${String(child.id).padStart(6, '0')}`,
      purchase_unit: child.purchase_unit || '',
      purchase_price: String(Math.round(Number(child.current_average_price ?? 0) * Number(child.conversion_ratio || 1))),
      conversion_ratio: String(child.conversion_ratio),
      current_average_price: child.current_average_price,
      last_purchase_price: child.last_purchase_price,
      is_active: child.is_active
    }));
    setBrands(childBrands);
    setForm(f => ({ ...f, has_brands: childBrands.length > 0 || !!item.has_children }));

    if (item.has_children) {
      fetch(`/api/items?parent_id=${item.id}&active_only=false`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data && data.data.length > 0) {
            setBrands(data.data.map((child: any) => ({
              id: String(child.id),
              name: child.name,
              barcode: child.barcode || `ERC${String(child.id).padStart(6, '0')}`,
              purchase_unit: child.purchase_unit || '',
              purchase_price: String(Math.round(Number(child.current_average_price ?? 0) * Number(child.conversion_ratio || 1))),
              conversion_ratio: String(child.conversion_ratio),
              current_average_price: child.current_average_price,
              last_purchase_price: child.last_purchase_price,
              is_active: child.is_active
            })));
            setForm(f => ({ ...f, has_brands: true }));
          }
        });
    }

    setError('');
    setShowModal(true);
  }

  // Generate SKU Function
  function autoGenerateSKU(itemName: string, parentName: string, index: number) {
    if (!itemName && !parentName) return '';
    const sourceName = (itemName || parentName).trim().toUpperCase();
    if (sourceName.length === 0) return '';
    const firstLetter = sourceName.charAt(0);
    const lastLetter = sourceName.charAt(sourceName.length - 1);

    // Find max ID logically (we'll just use a randomish/timestamp if we don't know the exact next DB id)
    // A better approach for UI preview is random or just index based
    const suffix = (1000 + items.length + index + 1).toString();
    return `${firstLetter}${lastLetter}-${suffix}`;
  }

  async function handleSave() {
    if (!form.name || !form.category_id || (!form.has_brands && !form.purchase_unit) || !form.smallest_unit) {
      setToastInfo({ show: true, msg: form.has_brands ? 'Nama, kategori, dan satuan terkecil wajib diisi' : 'Nama, kategori, satuan beli, dan satuan terkecil wajib diisi', type: 'error' });
      return;
    }
    setSaving(true);
    try {
      const url = editing ? `/api/items/${editing.id}` : '/api/items';
      const method = editing ? 'PATCH' : 'POST';
      const { package_inner_size, has_conversion, purchase_price, ...cleanForm } = form;

      const finalRatio = Number(form.conversion_ratio) || 1;
      const finalSmallestUnit = form.smallest_unit;
      const finalAvgPrice = form.has_brands ? 0 : (Number(purchase_price) / finalRatio);
      const finalPurchaseUnit = form.purchase_unit;

      // Untuk barang dengan brand: user input langsung dalam satuan terkecil (ml), tidak perlu dikalikan
      // Untuk barang tanpa brand: kalikan input (dalam purchase_unit) dengan conversion_ratio
      const minThresholdSmall = form.has_brands ? Number(form.minimum_threshold) : Number(form.minimum_threshold) * finalRatio;
      const targetStockSmall = 0; // Target Stok dihapus dari UI

      // Validasi: cegah numeric overflow di kolom DB (kolom NUMERIC di PostgreSQL maks ~99 juta)
      const MAX_SAFE_VALUE = 99_999_999;
      if (minThresholdSmall > MAX_SAFE_VALUE) {
        setToastInfo({
          show: true,
          msg: `Nilai terlalu besar setelah konversi ke ${finalSmallestUnit}: ${minThresholdSmall.toLocaleString('id-ID')} ${finalSmallestUnit}. Silakan kurangi angka Batas Minimum.`,
          type: 'error'
        });
        return;
      }

      const payload = {
        ...cleanForm,
        category_id: Number(form.category_id),
        purchase_unit: finalPurchaseUnit,
        smallest_unit: finalSmallestUnit,
        conversion_ratio: finalRatio,
        minimum_threshold: minThresholdSmall,
        target_stock: targetStockSmall,
        current_average_price: finalAvgPrice,
        ingredient_id: form.ingredient_id ? Number(form.ingredient_id) : null,
        is_split_allowed: Boolean(form.is_split_allowed),
        min_order_qty: Number(form.min_order_qty || 1),
        order_multiple: Number(form.order_multiple || 1),
        is_global: form.is_global,
        venue_ids: form.is_global ? [] : form.venue_ids,
        brands: brands.filter(b => b.name).map(b => {
          const brandRatio = Number(b.conversion_ratio) || 1;
          return {
            id: b.id,
            name: b.name,
            barcode: b.barcode,
            purchase_unit: b.purchase_unit || form.purchase_unit,
            purchase_price: Number(b.purchase_price || 0) / brandRatio,
            conversion_ratio: brandRatio,
            is_active: b.is_active ?? true
          };
        })
      };
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      let data;
      try {
        data = await res.json();
      } catch (err) {
        setToastInfo({ show: true, msg: 'Terjadi kesalahan server saat menyimpan data.', type: 'error' });
        return;
      }
      if (!data.success) { setToastInfo({ show: true, msg: data.message, type: 'error' }); return; }
      setShowModal(false);
      fetchItems();
    } finally { setSaving(false); }
  }


  async function handleDelete() {
    if (!confirmDelete) return;
    const item = confirmDelete;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/items/${item.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) {
        setToastInfo({ show: true, msg: data.message, type: 'error' });
      } else {
        setToastInfo({ show: true, msg: data.message, type: 'success' });
        setBrands(prev => prev.filter(b => b.id !== String(item.id)));
      }
    } catch (err) {
      setToastInfo({ show: true, msg: 'Gagal menghubungi server', type: 'error' });
    } finally {
      setIsDeleting(false);
      setConfirmDelete(null);
      fetchItems();
    }
  }

  async function handleBulkSave() {
    setBulkSaving(true);
    try {
      const payload = {
        item_ids: selectedItems,
        is_global: bulkForm.is_global,
        venue_ids: bulkForm.is_global ? [] : bulkForm.venue_ids
      };
      const res = await fetch('/api/items/bulk-venue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!data.success) {
        setToastInfo({ show: true, msg: data.message, type: 'error' });
      } else {
        setToastInfo({ show: true, msg: data.message, type: 'success' });
        setShowBulkModal(false);
        setSelectedItems([]);
        fetchItems();
      }
    } catch (err) {
      setToastInfo({ show: true, msg: 'Gagal menghubungi server', type: 'error' });
    } finally {
      setBulkSaving(false);
    }
  }



  const filteredItems = items.filter(item => {
    if (filterPerishable === 'PERISHABLE' && !item.is_perishable) return false;
    if (filterPerishable === 'DURABLE' && item.is_perishable) return false;
    if (filterStockStatus && getStockStatus(item) !== filterStockStatus) return false;
    // Sembunyikan varian/brand dari tabel utama agar tidak panjang
    if (item.parent_id) return false;
    return true;
  });

  const paginatedItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

  const matchingExistingItems = items
    .filter(i => i.name.toLowerCase().includes(form.name.trim().toLowerCase()))
    .slice(0, 8);

  const stokMerahCount = items.filter(i => getStockStatus(i) === 'MERAH').length;
  const stokMenipisCount = items.filter(i => getStockStatus(i) === 'MENIPIS').length;

  return (
    <section className="screen">
      <div className="card">
        <MasterDataTabs activeTab="items" />
        <div className="card-body flush">
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, background: '#ffffff' }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                className="input"
                placeholder="Cari nama barang atau SKU..."
                style={{ width: '220px', height: 34 }}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <Select
                value={catFilter}
                onChange={val => setCatFilter(String(val))}
                options={[
                  { value: '', label: 'Semua Kategori' },
                  ...categories.map(c => ({ value: String(c.id), label: c.name }))
                ]}
                style={{ width: 155 }}
                inputStyle={{ height: 34 }}
              />
              <Select
                value={filterPerishable}
                onChange={val => setFilterPerishable(String(val))}
                options={[
                  { value: '', label: 'Semua Sifat' },
                  { value: 'PERISHABLE', label: 'Cepat Basi' },
                  { value: 'DURABLE', label: 'Tahan Lama' }
                ]}
                style={{ width: 125 }}
                inputStyle={{ height: 34 }}
              />
              <Select
                value={filterStockStatus}
                onChange={val => setFilterStockStatus(String(val))}
                options={[
                  { value: '', label: 'Semua Stok' },
                  { value: 'MERAH', label: stokMerahCount > 0 ? `Stok Merah (${stokMerahCount})` : 'Stok Merah' },
                  { value: 'MENIPIS', label: stokMenipisCount > 0 ? `Stok Menipis (${stokMenipisCount})` : 'Stok Menipis' },
                  { value: 'AMAN', label: 'Stok Aman' }
                ]}
                style={{ width: 145 }}
                inputStyle={{ height: 34 }}
              />
              <Select
                value={String(itemsPerPage)}
                onChange={(val: any) => { setItemsPerPage(Number(val)); setCurrentPage(1); }}
                options={[
                  { value: '20', label: '20' },
                  { value: '50', label: '50' },
                  { value: '100', label: '100' }
                ]}
                style={{ width: 75 }}
                inputStyle={{ height: 34 }}
              />
              {(search || catFilter || filterPerishable || filterStockStatus) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setCatFilter('');
                    setFilterPerishable('');
                    setFilterStockStatus('');
                  }}
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#dc2626',
                    cursor: 'pointer',
                    padding: '0 10px',
                    borderRadius: 6,
                    height: 34,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Reset Filter"
                >
                  <RotateCcw size={16} />
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {selectedItems.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => { setBulkForm({ is_global: true, venue_ids: [] }); setShowBulkModal(true); }} style={{ height: 34 }}>Edit Venue Massal ({selectedItems.length})</Button>
              )}
              <Button variant="primary" size="sm" onClick={openAdd} style={{ height: 34 }}>+ Tambah Barang</Button>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Memuat data...</div>
          ) : items.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>
              <h4>Belum ada barang</h4>
              <p>Tambahkan barang baru untuk memulai</p>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <Table>
                  <thead>
                    <tr>
                      <th style={{ width: 40, textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={paginatedItems.length > 0 && paginatedItems.every(i => selectedItems.includes(i.id))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const newSelected = new Set([...selectedItems, ...paginatedItems.map(i => i.id)]);
                              setSelectedItems(Array.from(newSelected));
                            } else {
                              const pageIds = new Set(paginatedItems.map(i => i.id));
                              setSelectedItems(selectedItems.filter(id => !pageIds.has(id)));
                            }
                          }}
                        />
                      </th>
                      <th style={{ width: 100 }}>Kode</th>
                      <th style={{ width: 300 }}>Barang</th>
                      <th style={{ width: 140 }}>Satuan (Beli / Ecer)</th>
                      <th className="center" style={{ width: 80 }}>Rasio</th>
                      <th className="right" style={{ width: 120 }}>Rata Harga</th>
                      <th></th>
                      <th className="right" style={{ width: 100 }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map(item => {
                      const isChild = !!item.parent_id;
                      const isParent = !item.parent_id && item.has_children;
                      return (
                        <tr key={item.id} style={{ background: isParent ? '#f8fafc' : '#fff' }}>
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={selectedItems.includes(item.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedItems([...selectedItems, item.id]);
                                } else {
                                  setSelectedItems(selectedItems.filter(id => id !== item.id));
                                }
                              }}
                            />
                          </td>
                          <td className="font-mono text-muted">
                            {isChild && <span style={{ color: '#cbd5e1', marginRight: 4 }}>↳</span>}
                            {item.barcode || `ERC${String(item.id).padStart(6, '0')}`}
                          </td>
                          <td style={{ paddingLeft: isChild ? 24 : 12 }}>
                            <div className="font-bold" style={{ display: 'flex', alignItems: 'center', gap: 6, color: isParent ? '#475569' : 'inherit' }}>
                              {item.name}
                              {item.is_hpp && (
                                <span style={{ fontSize: 9, background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: 4, fontWeight: 700, letterSpacing: 0.5 }}>HPP / RESEP</span>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                              {!item.is_active && <span style={{ fontSize: 10, background: '#f1f5f9', color: '#64748b', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>NONAKTIF</span>}
                              {item.is_perishable && <span style={{ fontSize: 10, color: '#d97706', fontWeight: 600 }}>CEPAT BASI</span>}
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span className="font-bold">{item.purchase_unit}</span>
                              <span className="muted" style={{ fontSize: 12 }}>/ {item.smallest_unit}</span>
                            </div>
                          </td>
                          <td className="center num muted">{Math.round(Number(item.conversion_ratio)).toLocaleString('id-ID')}</td>
                          <td className="right num">
                            {fmtCurrency((item.current_average_price || 0) * (Number(item.conversion_ratio) || 1)).replace(',00', '')}
                            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>per {item.purchase_unit}</div>
                          </td>
                          <td></td>
                          <td className="right">
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', whiteSpace: 'nowrap' }}>
                              <Button size="sm" onClick={(e) => { e.stopPropagation(); openEdit(item); }} title={isParent ? "Edit Induk" : "Edit Barang"} style={{ background: 'var(--blue-light)', color: 'var(--blue)', border: '1px solid #bcdcf3' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                              </Button>
                              <Button size="sm" onClick={(e) => { e.stopPropagation(); openPriceHistory(item); }} title="Lihat Riwayat Harga" style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
                              </Button>
                              <Button size="sm" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }} onClick={(e) => { e.stopPropagation(); setConfirmDelete(item); }} title="Hapus Barang">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </Table>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: 16, padding: '0 24px 24px 24px' }}>
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={filteredItems.length}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                />
              </div>
            </>
          )}
        </div>
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Edit Barang' : 'Tambah Barang Baru'}
        maxWidth={1024}
        closeOnOutsideClick={false}
        footer={
          <>
            <Button variant="outline" onClick={() => setShowModal(false)}>Batal</Button>
            <Button variant="primary" onClick={handleSave} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan Barang'}</Button>
          </>
        }
      >
        <div style={{ padding: '0px' }}>
          {!form.has_brands && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              {editing?.last_purchase_price != null && Number(editing.last_purchase_price) > 0 && (
                <div style={{ padding: '10px 14px', background: '#dcfce7', border: '1px solid #bbf7d0', color: '#166534', borderRadius: 6, display: 'inline-flex', alignItems: 'center', fontWeight: 600, fontSize: 13 }}>
                   Beli Terakhir: {fmtCurrency(Number(editing.last_purchase_price))} / {editing.smallest_unit}
                </div>
              )}
              {editing?.current_average_price != null && Number(editing.current_average_price) > 0 && (
                <div style={{ padding: '10px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', borderRadius: 6, display: 'inline-flex', alignItems: 'center', fontWeight: 600, fontSize: 13 }}>
                   HPP Saat Ini: {fmtCurrency(Number(editing.current_average_price))} / {editing.smallest_unit}
                </div>
              )}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 290px', gap: '24px' }}>

            {/* LEFT COLUMN: Main Inputs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1.4, position: 'relative' }}>
                  <Input
                    label="Nama Barang"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    onFocus={() => setShowNameSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowNameSuggestions(false), 200)}
                    placeholder="buat nama barang baru"
                  />
                  {showNameSuggestions && matchingExistingItems.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: '#ffffff',
                      border: '1px solid var(--border)',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                      zIndex: 99999,
                      maxHeight: 220,
                      overflowY: 'auto',
                      borderRadius: '6px',
                      marginTop: '4px'
                    }}>
                      {matchingExistingItems.map(item => (
                        <div
                          key={item.id}
                          style={{
                            padding: '10px 14px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            color: '#12201a',
                            background: '#ffffff',
                            borderBottom: '1px solid #f1f5f9',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'}
                          onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setForm(f => ({ ...f, name: item.name }));
                            setShowNameSuggestions(false);
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, color: '#12201a' }}>{item.name}</div>
                            {item.barcode && <div style={{ fontSize: '11px', color: '#65786f' }}>SKU: {item.barcode}</div>}
                          </div>
                          <span style={{ fontSize: '11px', color: '#475569', background: '#f1f5f9', padding: '3px 8px', borderRadius: '4px', fontWeight: 600 }}>
                            Sudah ada
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ flex: 0.9 }}>
                  <Input
                    label="SKU"
                    value={form.barcode || ''}
                    onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))}
                    placeholder="Otomatis jika dikosongkan"
                  />
                </div>
                <div className="form-group" style={{ flex: 1.8, marginBottom: 0 }}>
                  <label className="req">Kategori</label>
                  <Select
                    value={form.category_id}
                    onChange={val => setForm(f => ({ ...f, category_id: String(val) }))}
                    options={[
                      { value: '', label: 'Pilih kategori...' },
                      ...categories.map(c => ({ value: String(c.id), label: c.name }))
                    ]}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label className="req">Satuan Dasar (Terkecil)</label>
                  <Select
                    searchable
                    creatable
                    value={form.smallest_unit}
                    onChange={val => setForm(f => ({ ...f, smallest_unit: String(val) }))}
                    placeholder="Pilih atau cari..."
                    options={[
                      { value: '', label: 'Pilih...' },
                      ...getUniqueUnits(SMALLEST_UNITS, items.map(i => i.smallest_unit))
                    ]}
                  />
                </div>

                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label className="req">{form.has_brands ? 'Satuan Pelaporan Stok' : 'Satuan Beli (Terbesar)'}</label>
                  <Select
                    searchable
                    creatable
                    disabled={form.has_brands}
                    value={form.purchase_unit}
                    onChange={val => setForm(f => ({ ...f, purchase_unit: String(val) }))}
                    placeholder="Pilih atau cari..."
                    options={[
                      { value: '', label: 'Pilih...' },
                      ...getUniqueUnits(PURCHASE_UNITS, items.map(i => i.purchase_unit))
                    ]}
                  />
                </div>
                  
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                    <label className="req" style={{ marginBottom: 0 }}>Isi per 1 {form.purchase_unit || (form.has_brands ? 'Satuan Pelaporan' : 'Satuan Beli')}</label>
                    <InfoTooltip
                      align="left"
                      width={280}
                      text={
                        form.has_brands
                          ? `Karena barang ini punya merek-merek dengan kemasan yang berbeda (contoh: Dus, Galon, dll), tentukan satuan penengah untuk merangkum total stok fisik Anda (misal: 1 Liter = 1000 ml).`
                          : (Number(form.purchase_price) > 0 && Number(form.conversion_ratio) > 0
                              ? `1 ${form.purchase_unit} = ${form.conversion_ratio} ${form.smallest_unit} • Harga HPP (Moving Avg): ${fmtCurrency(Number(form.purchase_price) / Number(form.conversion_ratio))} per ${form.smallest_unit}${editing?.last_purchase_price != null && Number(editing.last_purchase_price) > 0
                                ? ` • Beli Terakhir: ${fmtCurrency(Number(editing.last_purchase_price))} per ${editing.smallest_unit}`
                                : ''
                              }`
                              : 'Masukkan angka konversi dari satuan beli (contoh: 1 Kg berisi 1000 gr).')
                      }
                    />
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="input"
                      type="text"
                      value={formatNumberInput(form.conversion_ratio)}
                      onChange={e => {
                        const raw = parseNumberInput(e.target.value);
                        if (/^\d*\.?\d*$/.test(raw)) setForm(f => ({ ...f, conversion_ratio: raw }));
                      }}
                      style={{ paddingRight: 60 }}
                    />
                    <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--muted)' }}>{form.smallest_unit}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                    <label style={{ marginBottom: 0 }}>Batas Minimum {form.has_brands ? (form.smallest_unit ? `(${form.smallest_unit})` : '') : (form.purchase_unit ? `(${form.purchase_unit})` : '')}</label>
                    <InfoTooltip align="left" width={230} text={`Peringatan stok kritis di gudang. Jika stok mencapai angka ini, sistem akan memberikan tanda 'Stok Rendah'.`} />
                  </div>
                  <input
                    className="input"
                    type="text"
                    value={formatNumberInput(form.minimum_threshold)}
                    onChange={e => {
                      const raw = parseNumberInput(e.target.value);
                      if (/^\d*\.?\d*$/.test(raw)) setForm(f => ({ ...f, minimum_threshold: raw }));
                    }}
                  />
                </div>

                {!form.has_brands && (
                  <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label>Harga Beli per {form.purchase_unit || 'Satuan'} (Rp)</label>
                    <input className="input" type="text" placeholder="0" value={form.purchase_price === '0' || !form.purchase_price ? '' : Number(form.purchase_price).toLocaleString('id-ID')} onChange={e => {
                      const raw = e.target.value.replace(/\./g, '');
                      if (/^\d*$/.test(raw)) setForm(f => ({ ...f, purchase_price: raw }));
                    }} onFocus={e => e.target.select()} />
                  </div>
                )}
                
                {form.has_brands && <div style={{ flex: 1 }} />}
              </div>

              {!form.has_brands && Number(form.purchase_price) > 0 && Number(form.conversion_ratio) > 0 && (
                <div style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  color: '#15803d',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 4,
                  marginBottom: 4
                }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>Keterangan Harga HPP per {form.smallest_unit || 'Satuan Terkecil'}:</span>{' '}
                    {form.has_conversion && Number(form.conversion_ratio) > 1 ? (
                      <>
                        1 {form.purchase_unit || 'Satuan'} ({fmtCurrency(Number(form.purchase_price))}) : {Number(form.conversion_ratio).toLocaleString('id-ID')} {form.smallest_unit || 'Satuan'} ={' '}
                        <strong style={{ fontSize: '14px', color: '#166534' }}>
                          {fmtCurrency(Number(form.purchase_price) / Number(form.conversion_ratio))} / {form.smallest_unit || 'satuan'}
                        </strong>
                      </>
                    ) : (
                      <strong style={{ fontSize: '14px', color: '#166534' }}>
                        {fmtCurrency(Number(form.purchase_price))} / {form.smallest_unit || form.purchase_unit || 'satuan'}
                      </strong>
                    )}
                  </div>
                </div>
              )}


            </div>

            {/* RIGHT COLUMN: Settings & Toggles */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: '#f8fafc', padding: '18px 16px', borderRadius: 8, border: '1px solid #e2e8f0', alignSelf: 'start' }}>
              <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #cbd5e1', paddingBottom: 8 }}>
                Pengaturan & Aturan
              </h4>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Punya Brand / Varian?</span>
                  <InfoTooltip text="Aktifkan jika barang ini memiliki banyak merk dengan harga atau barcode berbeda (Misal: Air Galon Aqua & Le Minerale)." />
                </div>
                <Toggle size="sm" checked={form.has_brands} onChange={c => setForm(f => ({ ...f, has_brands: c }))} />
              </div>

              <div style={{ borderTop: '1px dashed #cbd5e1', margin: '4px 0' }} />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>Barang Cepat Basi</span>
                  <InfoTooltip text="Aktifkan untuk barang perishable / mudah rusak agar sistem memberi prioritas stok & peringatan." />
                </div>
                <Toggle size="sm" checked={form.is_perishable} onChange={c => setForm(f => ({ ...f, is_perishable: c }))} />
              </div>

              <div style={{ borderTop: '1px dashed #cbd5e1', margin: '4px 0' }} />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Barang Global</span>
                  <InfoTooltip text="Jika aktif, barang tersedia untuk seluruh outlet/venue. Jika nonaktif, Anda harus memilih venue (brand/lingkungan) yang berhak memakai barang ini." />
                </div>
                <Toggle size="sm" checked={form.is_global} onChange={c => setForm(f => ({ ...f, is_global: c, venue_ids: c ? [] : f.venue_ids }))} />
              </div>

              {!form.is_global && venues.length > 0 && (
                <div style={{ background: '#ffffff', padding: '10px', borderRadius: 6, border: '1px solid #e2e8f0', marginTop: 4 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 8 }}>PILIH VENUE / LINGKUNGAN</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {venues.map(v => {
                      const vid = Number(v.id); // pg mengembalikan BIGINT sebagai string, konversi ke number
                      return (
                        <label key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
                          <input
                            type="checkbox"
                            checked={form.venue_ids.includes(vid)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setForm(f => ({ ...f, venue_ids: [...f.venue_ids.filter(id => id !== vid), vid] }));
                              } else {
                                setForm(f => ({ ...f, venue_ids: f.venue_ids.filter(id => id !== vid) }));
                              }
                            }}
                          />
                          {v.name}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ borderTop: '1px dashed #cbd5e1', margin: '4px 0' }} />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: form.is_active ? 'var(--primary)' : 'var(--muted)' }}>
                    {form.is_active ? 'Barang Aktif' : 'Nonaktif'}
                  </span>
                  <InfoTooltip text="Barang aktif dapat dipesan oleh outlet. Nonaktifkan untuk menyembunyikan sementara." />
                </div>
                <Toggle size="sm" checked={form.is_active} onChange={c => setForm(f => ({ ...f, is_active: c }))} />
              </div>
            </div>
          </div>

          {/* BRANDS SECTION MOVED OUTSIDE GRID TO SPAN FULL WIDTH */}
          {form.has_brands && (
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '16px', marginTop: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: brands.length > 0 ? 12 : 0 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)' }}>
                  Daftar Brand / Varian
                </span>
                <Button variant="outline" size="sm" onClick={() => setBrands([...brands, { name: '', barcode: '', purchase_unit: form.purchase_unit || '', purchase_price: form.purchase_price, conversion_ratio: form.conversion_ratio || '1', is_active: true }])} style={{ padding: '6px 12px', fontSize: 12 }}>
                  + Tambah Brand
                </Button>
              </div>
              {brands.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {brands.map((brand, i) => (
                    <div key={brand.id ?? brand.barcode ?? `brand-${i}`} style={{ paddingBottom: 16, borderBottom: i === brands.length - 1 ? 'none' : '1px dashed #cbd5e1' }}>
                      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        <div className="form-group" style={{ marginBottom: 0, flex: '2 1 200px' }}>
                          {i === 0 && <label className="form-label" style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>Nama Brand *</label>}
                          <input className="input" placeholder="Susu Diamond" value={brand.name} disabled={brand.is_active === false} onChange={e => {
                            const newBrands = [...brands];
                            newBrands[i].name = e.target.value;
                            if (!newBrands[i].barcode) newBrands[i].barcode = autoGenerateSKU(e.target.value, form.name, i);
                            setBrands(newBrands);
                          }} style={{ fontSize: 13, padding: '8px 12px' }} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0, flex: '1 1 140px' }}>
                          {i === 0 && <label className="form-label" style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>SKU / Barcode</label>}
                          <input className="input" placeholder="Auto" value={brand.barcode} disabled={brand.is_active === false} onChange={e => {
                            const newBrands = [...brands];
                            newBrands[i].barcode = e.target.value;
                            setBrands(newBrands);
                          }} style={{ fontSize: 13, padding: '8px 12px' }} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0, flex: '1 1 120px' }}>
                          {i === 0 && <label className="form-label" style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>Satuan Beli</label>}
                          <select className="input" value={brand.purchase_unit} disabled={brand.is_active === false} onChange={e => {
                            const newBrands = [...brands];
                            newBrands[i].purchase_unit = e.target.value;
                            setBrands(newBrands);
                          }} style={{ fontSize: 13, padding: '8px 12px' }}>
                            <option value="">-- Pilih --</option>
                            {PURCHASE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0, flex: '1 1 100px' }}>
                          {i === 0 && <label className="form-label" style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>Isi/Satuan</label>}
                          <input className="input" placeholder="12" value={brand.conversion_ratio ? formatNumberInput(Number(brand.conversion_ratio)) : ''} disabled={brand.is_active === false} onChange={e => {
                            const raw = parseNumberInput(e.target.value);
                            if (/^\d*\.?\d*$/.test(raw)) {
                              const newBrands = [...brands];
                              newBrands[i].conversion_ratio = raw;
                              setBrands(newBrands);
                            }
                          }} style={{ fontSize: 13, padding: '8px 12px' }} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0, flex: '1.5 1 160px' }}>
                          {i === 0 && <label className="form-label" style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>Harga Beli (Rp)</label>}
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input className="input" type="text" value={brand.purchase_price ? formatNumberInput(Math.round(Number(brand.purchase_price))) : ''} disabled={brand.is_active === false} onChange={e => {
                              const raw = parseNumberInput(e.target.value);
                              if (/^\d*$/.test(raw)) {
                                const newBrands = [...brands];
                                newBrands[i].purchase_price = raw;
                                setBrands(newBrands);
                              }
                            }} style={{ fontSize: 13, padding: '8px 12px' }} />
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className="btn-icon danger" onClick={() => {
                                if (brands.length === 1) {
                                  setBrands([{ name: '', barcode: '', purchase_unit: '', purchase_price: '', conversion_ratio: '1', is_active: true }]);
                                  return;
                                }
                                const newBrands = [...brands];
                                newBrands.splice(i, 1);
                                setBrands(newBrands);
                              }} title="Hapus Brand" style={{ padding: 8, height: 36, width: 36 }}>
                                <Trash2 size={16} />
                              </button>
                              <div style={{ padding: '0 4px', height: 36, display: 'flex', alignItems: 'center' }}>
                                <Toggle 
                                  checked={brand.is_active !== false} 
                                  onChange={(checked) => {
                                    const newBrands = [...brands];
                                    newBrands[i].is_active = checked;
                                    setBrands(newBrands);
                                  }} 
                                  size="sm"
                                  title={brand.is_active !== false ? "Nonaktifkan Brand" : "Aktifkan Brand"}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      {brand.id && (
                        <div style={{ marginTop: 10, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          {brand.last_purchase_price != null && Number(brand.last_purchase_price) > 0 && (
                            <span style={{ fontSize: 12, background: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: 6, fontWeight: 600 }}>
                              Beli Terakhir: {fmtCurrency(Number(brand.last_purchase_price) * Number(brand.conversion_ratio || 1))} / {brand.purchase_unit || 'Satuan'}
                            </span>
                          )}
                          {brand.current_average_price != null && Number(brand.current_average_price) > 0 && (
                            <span style={{ fontSize: 12, background: '#eff6ff', color: '#1d4ed8', padding: '4px 10px', borderRadius: 6, fontWeight: 600 }}>
                              HPP Saat Ini: {fmtCurrency(Number(brand.current_average_price) * Number(brand.conversion_ratio || 1))} / {brand.purchase_unit || 'Satuan'}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Hapus Barang"
        message={`Apakah Anda yakin ingin menghapus barang ${confirmDelete?.name}?`}
        confirmText={isDeleting ? 'Menghapus...' : 'Ya, Hapus Barang'}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        danger={true}
        loading={isDeleting}
      />

      <Modal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        title="Edit Venue Massal"
        maxWidth={500}
        footer={
          <>
            <Button variant="outline" onClick={() => setShowBulkModal(false)}>Batal</Button>
            <Button variant="primary" onClick={handleBulkSave} disabled={bulkSaving}>{bulkSaving ? 'Menyimpan...' : 'Simpan Perubahan'}</Button>
          </>
        }
      >
        <div style={{ padding: '0px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
            Anda akan mengubah hak akses venue untuk <strong>{selectedItems.length} barang</strong> sekaligus.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '12px 16px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Barang Global</span>
              <InfoTooltip text="Jika aktif, barang tersedia untuk seluruh outlet/venue." />
            </div>
            <Toggle size="sm" checked={bulkForm.is_global} onChange={c => setBulkForm(f => ({ ...f, is_global: c, venue_ids: c ? [] : f.venue_ids }))} />
          </div>

          {!bulkForm.is_global && venues.length > 0 && (
            <div style={{ background: '#ffffff', padding: '12px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 8 }}>PILIH VENUE / LINGKUNGAN</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {venues.map(v => {
                  const vid = Number(v.id); // pg BIGINT dikembalikan sebagai string
                  return (
                    <label key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                      <input
                        type="checkbox"
                        checked={bulkForm.venue_ids.includes(vid)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setBulkForm(f => ({ ...f, venue_ids: [...f.venue_ids.filter(id => id !== vid), vid] }));
                          } else {
                            setBulkForm(f => ({ ...f, venue_ids: f.venue_ids.filter(id => id !== vid) }));
                          }
                        }}
                      />
                      {v.name}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={!!priceHistoryItem}
        onClose={() => { setPriceHistoryItem(null); setPriceHistoryData([]); setPriceHistoryStartDate(''); setPriceHistoryEndDate(''); }}
        title={`Riwayat Harga — ${priceHistoryItem?.name}`}
        maxWidth={900}
      >
        <div style={{ padding: 0 }}>
          <div style={{ padding: '16px', background: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}></span>
            <input type="date" className="input" style={{ width: 140, height: 34 }} value={priceHistoryStartDate} onChange={e => setPriceHistoryStartDate(e.target.value)} />
            <span style={{ color: 'var(--muted)' }}>—</span>
            <input type="date" className="input" style={{ width: 140, height: 34 }} value={priceHistoryEndDate} onChange={e => setPriceHistoryEndDate(e.target.value)} />
            {(priceHistoryStartDate || priceHistoryEndDate) && (
              <button type="button" onClick={() => { setPriceHistoryStartDate(''); setPriceHistoryEndDate(''); }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Reset</button>
            )}
          </div>
          <div className="card-body flush">
            {loadingPriceHistory ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Memuat riwayat harga...</div>
            ) : priceHistoryData.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Belum ada riwayat harga untuk barang ini.</div>
            ) : (
              <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <Table style={{ margin: 0 }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: '#f1f5f9' }}>
                    <tr>
                      <th>Tanggal</th>
                      <th>Vendor</th>
                      <th className="right">Jml Diterima</th>
                      <th className="right">Harga Beli</th>
                      <th className="right">MA Baru</th>
                    </tr>
                  </thead>
                  <tbody>
                    {priceHistoryData.filter((h: any) => {
                      if (!priceHistoryStartDate && !priceHistoryEndDate) return true;
                      const d = new Date(h.purchase_date).getTime();
                      const start = priceHistoryStartDate ? new Date(priceHistoryStartDate).getTime() : 0;
                      const end = priceHistoryEndDate ? new Date(priceHistoryEndDate + 'T23:59:59').getTime() : Infinity;
                      return d >= start && d <= end;
                    }).map((h: any) => (
                      <tr key={h.id}>
                        <td>
                          {new Date(String(h.purchase_date)).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                          <div className="muted font-mono" style={{ fontSize: 11 }}>{h.purchase_order_item_id ? `PO: ${h.purchase_order_item_id}` : 'Manual'}</div>
                        </td>
                        <td>{h.vendor_name || '-'}</td>
                        <td className="right font-bold num">{Number(h.purchase_qty).toLocaleString('id-ID', { maximumFractionDigits: 2 })} <span className="muted">{h.purchase_unit}</span></td>
                        <td className="right font-mono" style={{ color: '#016e3f', fontWeight: 600 }}>
                          Rp {Number(h.unit_purchase_price).toLocaleString('id-ID')}
                        </td>
                        <td className="right font-mono" style={{ color: '#f59e0b', fontWeight: 600 }}>
                          Rp {Number(h.new_average_price).toLocaleString('id-ID')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </Modal>

      <Toast
        isOpen={toastInfo.show}
        message={toastInfo.msg}
        type={toastInfo.type}
        onClose={() => setToastInfo({ ...toastInfo, show: false })}
      />
    </section>
  );
}
