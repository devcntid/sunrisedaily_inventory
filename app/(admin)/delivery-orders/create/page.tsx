'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Toast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { BarcodeScannerModal } from '@/components/ui/BarcodeScannerModal';
import { Select } from '@/components/ui/Select';
import { ItemSelectWithBrand } from '@/components/shared/ItemSelectWithBrand';

interface RawOrderItem {
  order_item_id: number;
  item_id: number;
  item_name: string;
  item_status: string;
  purchase_unit?: string;
  smallest_unit?: string;
  conversion_ratio?: string | number;
  qty_request: number;
  qty_approved?: number | string;
  current_stock?: string | number;
  current_average_price?: number;
  barcode?: string;
}

interface OrderItem extends Omit<RawOrderItem, 'current_stock'> {
  qty_shipped: number | string;
  selected: boolean;
  keterangan: string;
  current_stock: number;
  is_additional?: boolean;
  parent_id?: number | string;
}

export default function CreateDeliveryOrderPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<{ order_id: number; outlet_id: number; outlet_name: string; order_date: string; items: RawOrderItem[] }[]>([]);
  const [outlets, setOutlets] = useState<{ id: number; name: string; venue_id?: number | null }[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [targetOutletId, setTargetOutletId] = useState<string>('');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [isAutoFilled, setIsAutoFilled] = useState(false);

  const [form, setForm] = useState({
    delivery_date: new Date().toISOString().split('T')[0],
    driver_name: '',
  });
  const driverNameRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [error, setError] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [requireBarcode, setRequireBarcode] = useState(true);

  const [allItems, setAllItems] = useState<any[]>([]);
  const [bulkQty, setBulkQty] = useState('1');

  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);
  const [duplicateWarningData, setDuplicateWarningData] = useState<{ existingNote?: any }>({});

  useEffect(() => {
    // Fetch orders that are PROCESSING or READY
    async function fetchOrders() {
      const res = await fetch('/api/orders/recap?status=PROCESSING');
      const data = await res.json();

      // Group items by order to get the orders list, filtering for ones that need shipping
      const uniqueOrders = new Map();
      (data.data ?? []).forEach((item: RawOrderItem & { order_id: number; outlet_id: number; outlet_name: string; order_date: string }) => {
        if (['PROSES_BELANJA', 'READY_DI_GUDANG'].includes(item.item_status)) {
          if (!uniqueOrders.has(item.order_id)) {
            uniqueOrders.set(item.order_id, {
              order_id: item.order_id,
              outlet_id: item.outlet_id,
              outlet_name: item.outlet_name,
              order_date: item.order_date,
              items: []
            });
          }
          uniqueOrders.get(item.order_id).items.push(item);
        }
      });

      setOrders(Array.from(uniqueOrders.values()));
    }
    async function fetchOutlets() {
      const res = await fetch('/api/outlets');
      const data = await res.json();
      setOutlets(data.data ?? []);
    }
    async function fetchSettings() {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setRequireBarcode(data.data?.require_barcode_scan !== 'false');
      }
    }
    async function fetchItems() {
      const res = await fetch('/api/items?active_only=true');
      if (res.ok) {
        const data = await res.json();
        setAllItems(data.data?.filter((i: any) => i.is_active) || []);
      }
    }
    fetchOrders();
    fetchOutlets();
    fetchSettings();
    fetchItems();
  }, []);

  const handleSelectOrder = (id: string) => {
    setSelectedOrderId(id);
    if (!id) {
      setOrderItems([]);
      setTargetOutletId('');
      return;
    }

    if (id === 'DIRECT') {
      setOrderItems([{
        order_item_id: -(Date.now()),
        item_id: 0,
        item_name: '',
        item_status: 'READY_DI_GUDANG',
        smallest_unit: '',
        conversion_ratio: 1,
        qty_request: 0,
        current_average_price: 0,
        barcode: '',
        qty_shipped: 1,
        selected: true,
        keterangan: 'Tambahan dari Pusat',
        current_stock: 0,
        is_additional: true
      }]);
      setTargetOutletId('');
      return;
    }

    const selected = orders.find(o => String(o.order_id) === id);
    if (selected) {
      setTargetOutletId(String(selected.outlet_id));
      setOrderItems(selected.items.map((i: RawOrderItem) => {
        const initialQty = parseFloat(String(i.qty_approved ?? i.qty_request ?? '0'));
        return {
          ...i,
          qty_shipped: String(initialQty).replace('.', ','),
          current_stock: parseFloat(String(i.current_stock ?? '0')),
          selected: i.item_status === 'READY_DI_GUDANG',
          keterangan: ''
        };
      }));
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && !selectedOrderId) {
      const urlParams = new URLSearchParams(window.location.search);
      const qId = urlParams.get('order_id');
      const qOutlet = urlParams.get('outlet_id');
      const qItems = urlParams.get('items');

      if (qId === 'DIRECT') {
        if (qItems && allItems.length > 0) {
           const itemIds = qItems.split(',').map(id => String(id));
           const matchedItems = allItems.filter(i => itemIds.includes(String(i.id)));
           
           if (matchedItems.length > 0) {
             const prefilled = matchedItems.map((itemData, index) => {
                const parentStock = itemData.parent_id ? (allItems.find(i => String(i.id) === String(itemData.parent_id))?.current_stock || 0) : itemData.current_stock;
                const currentStock = parseFloat(String(parentStock)) || 0;
                const ratio = parseFloat(String(itemData.conversion_ratio)) || 1;
                const hasStockForOneUnit = currentStock >= ratio;
                
                return {
                  order_item_id: -(Date.now()) - index,
                  item_id: itemData.id,
                  item_name: itemData.name,
                  item_status: 'READY_DI_GUDANG',
                  purchase_unit: itemData.purchase_unit,
                  smallest_unit: itemData.smallest_unit,
                  conversion_ratio: itemData.conversion_ratio,
                  qty_request: 0,
                  current_average_price: itemData.current_average_price,
                  barcode: itemData.barcode,
                  qty_shipped: hasStockForOneUnit ? 1 : 0,
                  selected: hasStockForOneUnit,
                  keterangan: hasStockForOneUnit ? '' : 'Stok Pusat Kosong',
                  current_stock: currentStock,
                  is_additional: true
                };
             });
             setSelectedOrderId('DIRECT');
             setOrderItems(prefilled);
             if (qOutlet) setTargetOutletId(String(qOutlet));
             setIsAutoFilled(true);
             return;
           }
        }
        
        if (!qItems) {
          handleSelectOrder('DIRECT');
          if (qOutlet) {
            setTargetOutletId(String(qOutlet));
          }
        }
      } else if (qId && orders.length > 0 && orders.some(o => String(o.order_id) === qId)) {
        handleSelectOrder(qId);
      }
    }
  }, [orders, selectedOrderId, allItems]);

  const handleToggleItem = (orderItemId: number | string) => {
    setOrderItems(orderItems.map(i => String(i.order_item_id) === String(orderItemId) ? { ...i, selected: !i.selected } : i));
  };

  const handleAddEmptyRow = () => {
    const tempId = -(Date.now());
    setOrderItems([{
      order_item_id: tempId,
      item_id: 0,
      parent_id: '',
      item_name: '',
      item_status: 'READY_DI_GUDANG',
      smallest_unit: '',
      conversion_ratio: 1,
      qty_request: 0,
      current_average_price: 0,
      barcode: '',
      qty_shipped: 1,
      selected: true,
      keterangan: 'Tambahan dari Pusat',
      current_stock: 0,
      is_additional: true
    }, ...orderItems]);
  };

  const handleSelectParent = (orderItemId: number, parentId: string) => {
    const parentItem = allItems.find(i => String(i.id) === parentId);
    if (!parentItem) return;

    // We no longer require picking a brand (child), just select the parent directly
    handleSelectAdditionalItem(orderItemId, parentId, parentItem.id);
  };

  const handleSelectAdditionalItem = (orderItemId: number, newItemId: string, parentId?: number | string) => {
    const itemData = allItems.find(i => String(i.id) === newItemId);
    if (!itemData) return;

    const exists = orderItems.find(i => String(i.item_id) === newItemId && String(i.order_item_id) !== String(orderItemId));
    if (exists) {
      setError('Barang ini sudah ada di dalam daftar.');
      return;
    }
    setError('');

    setOrderItems(orderItems.map(i => String(i.order_item_id) === String(orderItemId) ? {
      ...i,
      parent_id: parentId || itemData.parent_id || itemData.id,
      item_id: itemData.id,
      item_name: itemData.name,
      purchase_unit: itemData.purchase_unit,
      smallest_unit: itemData.smallest_unit,
      conversion_ratio: itemData.conversion_ratio,
      current_average_price: itemData.current_average_price,
      barcode: itemData.barcode,
      current_stock: parseFloat(String(itemData.parent_id ? (allItems.find(p => String(p.id) === String(itemData.parent_id))?.current_stock || 0) : itemData.current_stock)) || 0
    } : i));
  };

  const handleRemoveAdditionalItem = (orderItemId: number | string) => {
    setOrderItems(orderItems.filter(i => String(i.order_item_id) !== String(orderItemId)));
  };

  const handleQtyChange = (orderItemId: number | string, val: string) => {
    const cleanVal = val.replace(/[^0-9.,]/g, '');
    setOrderItems(orderItems.map(i => String(i.order_item_id) === String(orderItemId) ? { ...i, qty_shipped: cleanVal } : i));
  };

  const handleBarcodeScan = (barcode: string) => {
    const itemIndex = orderItems.findIndex(i => i.barcode === barcode);
    if (itemIndex !== -1) {
      const item = orderItems[itemIndex];
      const newItems = [...orderItems];
      if (!item.selected) {
        newItems[itemIndex] = { ...item, selected: true, qty_shipped: 1 };
      } else {
        newItems[itemIndex] = { ...item, qty_shipped: (parseFloat(String(item.qty_shipped)) || 0) + 1 };
      }
      setOrderItems(newItems);
      // Feedback to user (could add a small toast, but visual update is usually enough)
    } else {
      setError(`Barang dengan barcode ${barcode} tidak ada dalam daftar PO ini.`);
    }
  };

  const handleKeteranganChange = (orderItemId: number | string, val: string) => {
    setOrderItems(orderItems.map(i => String(i.order_item_id) === String(orderItemId) ? { ...i, keterangan: val } : i));
  };

  const parseLocalNumber = (val: string | number) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const str = String(val).trim();
    // Ganti koma jadi titik, hilangkan karakter selain angka dan titik
    const clean = str.replace(',', '.').replace(/[^0-9.]/g, '');
    return parseFloat(clean) || 0;
  };

  const handleSave = async () => {
    const selectedItems = orderItems.filter(i => i.selected && parseLocalNumber(i.qty_shipped) > 0 && i.item_id !== 0);
    if (selectedItems.length === 0) {
      setError('Pilih setidaknya satu barang untuk dikirim.');
      return;
    }

    const overStockItems = selectedItems.filter(i => {
      const ratio = Number(i.conversion_ratio) || 1;
      const roundedStock = parseFloat((i.current_stock / ratio).toFixed(3));
      return parseLocalNumber(i.qty_shipped) > roundedStock;
    });
    if (overStockItems.length > 0) {
      setError(`Terdapat ${overStockItems.length} barang dengan kuantitas melebihi stok yang tersedia. Silakan periksa kembali baris yang berwarna merah pada tabel.`);
      return;
    }

    if (!form.driver_name.trim()) {
      setError('Nama sopir/pengirim wajib diisi.');
      return;
    }

    if (!targetOutletId) {
      setError('Outlet tujuan wajib dipilih.');
      return;
    }

    if (!form.delivery_date) {
      setError('Tanggal pengiriman wajib diisi.');
      return;
    }

    if (selectedOrderId !== 'DIRECT') {
      const orderData = orders.find(o => String(o.order_id) === selectedOrderId);
      if (!orderData) return;
    }

    setSaving(true);
    setError('');

    try {
      // Periksa duplikasi DO hari ini
      const checkRes = await fetch(`/api/delivery-notes/check-today?outlet_id=${targetOutletId}&date=${form.delivery_date}`);
      const checkData = await checkRes.json();
      
      if (!checkRes.ok) {
        throw new Error(checkData.message || 'Gagal memeriksa duplikasi Surat Jalan');
      }

      if (checkData.hasDuplicate) {
        setSaving(false);
        setDuplicateWarningData({ existingNote: checkData.existingNote });
        setShowDuplicateConfirm(true);
        return;
      }
      
      await executeSave(selectedItems);
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : 'Unknown error'));
      setSaving(false);
    }
  };

  const executeSave = async (selectedItems: any[]) => {
    setSaving(true);
    try {
      const payload = {
        order_id: selectedOrderId === 'DIRECT' ? null : Number(selectedOrderId),
        outlet_id: Number(targetOutletId),
        driver_name: driverNameRef.current?.value || form.driver_name || '',
        delivery_date: form.delivery_date,
        items: selectedItems.map(i => ({
          order_item_id: i.order_item_id,
          item_id: i.item_id,
          qty_shipped: parseLocalNumber(i.qty_shipped),
          price_at_shipment: i.current_average_price,
          keterangan: i.keterangan || '',
          is_additional: i.is_additional
        }))
      };

      const res = await fetch('/api/delivery-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      router.push(`/delivery-orders/${data.data.id}`);
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : 'Unknown error'));
      setSaving(false);
    }
  };
  const targetOutlet = outlets.find(o => String(o.id) === targetOutletId);
  const availableItems = allItems.filter(item => {
    if (item.is_global) return true;
    if (!targetOutlet) return true;
    if (item.venue_ids && targetOutlet.venue_id) {
      return item.venue_ids.map(String).includes(String(targetOutlet.venue_id));
    }
    return false;
  });

  return (
    <section className="screen">
      <div className="card" style={{ maxWidth: 1000 }}>
        <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3>Buat Surat Jalan</h3>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Button variant="outline" size="sm" type="button" onClick={() => router.push('/delivery-orders')}>Batal</Button>
            <Button variant="primary" size="sm" onClick={handleSave} disabled={saving || !selectedOrderId || orderItems.filter(i => i.selected).length === 0}>
              {saving ? 'Membuat Surat Jalan...' : 'Buat Surat Jalan'}
            </Button>
          </div>
        </div>

        <ConfirmDialog
          open={showDuplicateConfirm}
          title="Pengiriman Ganda Terdeteksi"
          message={`Sudah ada Surat Jalan untuk outlet ini pada tanggal ${form.delivery_date} (${duplicateWarningData?.existingNote?.delivery_note_number} - Status: ${duplicateWarningData?.existingNote?.status}). Apakah Anda yakin ingin membuat Surat Jalan baru?`}
          onConfirm={() => {
            setShowDuplicateConfirm(false);
            const selectedItems = orderItems.filter(i => i.selected && parseLocalNumber(i.qty_shipped) > 0 && i.item_id !== 0);
            executeSave(selectedItems);
          }}
          onCancel={() => setShowDuplicateConfirm(false)}
          confirmText="Ya, Buat Baru"
          cancelText="Batal"
        />

        <div className="card-body flush" style={{ padding: 24 }}>
          <Toast
            isOpen={!!error}
            message={error}
            type="error"
            onClose={() => setError('')}
          />

          <div className="form-grid" style={{ marginBottom: 32 }}>
            <div className="form-group">
              <label className="req">Sumber Permintaan</label>
              <select 
                className="input" 
                value={selectedOrderId} 
                onChange={e => handleSelectOrder(e.target.value)}
                disabled={isAutoFilled}
                style={{ fontWeight: 600, background: isAutoFilled ? '#f1f5f9' : '#fff' }}
              >
                <option value="">Pilih Permintaan</option>
                <option value="DIRECT">Pengiriman Langsung</option>
                {orders.map(o => (
                  <option key={o.order_id} value={o.order_id}>
                    PO-{new Date(o.order_date).getFullYear()}-{String(o.order_id).padStart(5, '0')}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Kirim Ke (Outlet)</label>
              <select
                className="input"
                value={targetOutletId}
                onChange={(e) => setTargetOutletId(e.target.value)}
                disabled={!selectedOrderId || (selectedOrderId !== 'DIRECT' && !!selectedOrderId) || isAutoFilled}
                style={{ fontWeight: 600, background: (!selectedOrderId || (selectedOrderId !== 'DIRECT' && !!selectedOrderId) || isAutoFilled) ? '#f1f5f9' : '#fff' }}
              >
                <option value="">Pilih Tujuan</option>
                {outlets.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="req">Tanggal Pengiriman</label>
              <Input
                type="date"
                value={form.delivery_date}
                min={new Date().toISOString().split('T')[0]}
                onKeyDown={(e: React.KeyboardEvent) => e.preventDefault()}
                onClick={(e: React.MouseEvent<HTMLInputElement>) => e.currentTarget.showPicker?.()}
                onChange={e => setForm(f => ({ ...f, delivery_date: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="req">Nama Sopir / Pengirim</label>
              <Input type="text" placeholder="Wajib diisi" ref={driverNameRef} defaultValue={form.driver_name} />
            </div>
          </div>

          {selectedOrderId ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h4 style={{ fontWeight: 600, margin: 0 }}>Daftar Barang yang Dikirim</h4>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0, height: '32px', fontWeight: 600, background: '#fff', color: '#ef4444', border: '1px solid #ef4444', borderRight: 'none', padding: '0 16px' }}
                      onClick={() => {
                        const val = Number(bulkQty) || 0;
                        if (val === 0) return;
                        setOrderItems(items => items.map(line => {
                          if (line.selected) {
                            const currentQty = parseLocalNumber(line.qty_shipped);
                            return { ...line, qty_shipped: String(Math.max(0, currentQty - val)) };
                          }
                          return line;
                        }));
                      }}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      className="input num"
                      style={{ width: '50px', padding: '4px 8px', borderRadius: 0, borderRight: 'none', fontSize: 13, height: '32px', textAlign: 'center' }}
                      value={bulkQty}
                      onChange={(e) => setBulkQty(e.target.value)}
                      placeholder="Qty"
                    />
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, height: '32px', fontWeight: 600, background: 'var(--primary)', color: '#fff', border: '1px solid var(--primary)', padding: '0 16px' }}
                      onClick={() => {
                        const val = Number(bulkQty) || 0;
                        if (val === 0) return;
                        setOrderItems(items => items.map(line => {
                          if (line.selected) {
                            const currentQty = parseLocalNumber(line.qty_shipped);
                            return { ...line, qty_shipped: String(currentQty + val) };
                          }
                          return line;
                        }));
                      }}
                    >
                      +
                    </button>
                  </div>
                  <div style={{ width: '1px', background: 'var(--border)', margin: '0 4px' }}></div>
                  <Button variant="outline" size="sm" onClick={handleAddEmptyRow}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, display: 'inline-block', verticalAlign: 'middle' }}>
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    Tambah Barang Lain
                  </Button>
                  {requireBarcode && (
                    <Button variant="outline" size="sm" onClick={() => setIsScannerOpen(true)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6, display: 'inline-block', verticalAlign: 'middle' }}>
                        <path d="M4 7V4h3m10 0h3v3M4 17v3h3m10 0h3v-3M9 12h6M12 9v6" />
                      </svg>
                      Scan Barcode
                    </Button>
                  )}
                </div>
              </div>
              <Table>
                <thead>
                  <tr>
                    <th style={{ width: 40 }} className="center">
                      <input
                        type="checkbox"
                        checked={orderItems.length > 0 && orderItems.every(i => i.selected)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setOrderItems(orderItems.map(i => ({ ...i, selected: checked })));
                        }}
                        style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--primary)' }}
                        title="Pilih Semua Barang"
                      />
                    </th>
                    <th>Barang</th>
                    <th className="center">Jml Diminta</th>
                    <th className="center" style={{ width: 160 }}>Jml Dikirim</th>
                    <th className="center" style={{ width: 150 }}>Stok Tersedia</th>
                    <th className="center" style={{ width: 180 }}>Keterangan</th>
                    <th className="center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orderItems.map(item => {
                    const ratio = parseFloat(String(item.conversion_ratio || '1'));
                    const parsedQty = parseLocalNumber(item.qty_shipped);
                    const roundedStock = parseFloat((item.current_stock / ratio).toFixed(3));
                    const isExceeded = parsedQty > roundedStock;
                    const unitLabel = item.purchase_unit || item.smallest_unit || '';

                    return (
                      <tr
                        key={String(item.order_item_id)}
                        style={{
                          opacity: item.selected ? 1 : 0.6,
                          backgroundColor: item.selected ? (isExceeded ? '#fef2f2' : '#f8fafc') : '#fafafa',
                          transition: 'all 0.2s ease-in-out'
                        }}
                      >
                        <td className="center">
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={() => handleToggleItem(item.order_item_id)}
                            style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--primary)' }}
                          />
                        </td>
                        <td className="font-bold">
                          {item.is_additional ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 200 }}>
                              <ItemSelectWithBrand
                                value={String(item.item_id || '')}
                                onChange={(val) => handleSelectParent(item.order_item_id, String(val))}
                                items={allItems}
                                parentOnly={true}
                              />
                            </div>
                          ) : (
                            <>
                              <div>{item.item_name}</div>
                              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>{unitLabel}</span>
                            </>
                          )}
                        </td>
                        <td className="center num font-bold">
                          {parseFloat(Number(item.qty_request).toFixed(3)).toLocaleString('id-ID')} {unitLabel}
                          {ratio > 1 && (
                            <div className="muted" style={{ fontSize: 11, marginTop: 4, fontWeight: 500 }}>
                              ({(parseFloat(Number(item.qty_request).toFixed(3)) * ratio).toLocaleString('id-ID')} {item.smallest_unit})
                            </div>
                          )}
                        </td>
                        <td className="center">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                            <input
                              type="text"
                              inputMode="decimal"
                              className="input right font-bold num"
                              value={item.qty_shipped}
                              onChange={(e) => handleQtyChange(item.order_item_id, e.target.value)}
                              disabled={!item.selected}
                              style={{
                                width: 90,
                                height: 32,
                                borderColor: item.selected ? (isExceeded ? 'var(--danger)' : 'var(--primary)') : 'var(--border)',
                                background: item.selected ? '#ffffff' : '#f1f5f9',
                                color: isExceeded ? 'var(--danger)' : 'inherit'
                              }}
                            />
                            <span className="muted font-bold" style={{ fontSize: 12, width: 35, textAlign: 'left' }}>{unitLabel}</span>
                          </div>
                          {ratio > 1 && (
                            <div className="muted" style={{ fontSize: 11, marginTop: 4, fontWeight: 500, textAlign: 'center' }}>
                              ({(parsedQty * ratio).toLocaleString('id-ID')} {item.smallest_unit})
                            </div>
                          )}
                        </td>
                        <td className="center num font-bold" style={{ color: isExceeded ? 'var(--danger)' : 'var(--muted)' }}>
                          {roundedStock.toLocaleString('id-ID')} {unitLabel}
                          {ratio > 1 && (
                            <div style={{ fontSize: 11, marginTop: 4, fontWeight: 500, color: isExceeded ? 'var(--danger)' : 'var(--muted)' }}>
                              ({item.current_stock.toLocaleString('id-ID')} {item.smallest_unit})
                            </div>
                          )}
                        </td>
                        <td className="center">
                          <input
                            type="text"
                            className="input"
                            placeholder="Catatan opsional..."
                            value={item.keterangan || ''}
                            onChange={(e) => handleKeteranganChange(item.order_item_id, e.target.value)}
                            disabled={!item.selected}
                            style={{
                              width: '100%',
                              height: 32,
                              borderColor: item.selected ? 'var(--border)' : 'transparent',
                              background: item.selected ? '#ffffff' : '#f1f5f9',
                              fontSize: 12
                            }}
                          />
                        </td>
                        <td className="center">
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                            <Badge variant={item.item_status === 'READY_DI_GUDANG' ? 'green' : 'amber'}>
                              {item.item_status === 'READY_DI_GUDANG' ? 'Tersedia' : 'Proses Belanja'}
                            </Badge>
                            {item.is_additional && (
                              <button
                                type="button"
                                onClick={() => handleRemoveAdditionalItem(item.order_item_id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'flex', padding: 4 }}
                                title="Hapus Barang Tambahan"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6"></polyline>
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {orderItems.length === 0 && (
                    <tr><td colSpan={7} className="center muted" style={{ padding: 32 }}>Tidak ada barang yang bisa dikirim.</td></tr>
                  )}
                </tbody>
              </Table>
            </>
          ) : (
            <div className="muted" style={{ padding: 40, textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 8 }}>
              Silakan pilih permintaan (PO) terlebih dahulu untuk melihat dan memilih barang yang akan dikirim.
            </div>
          )}
        </div>
      </div>

      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleBarcodeScan}
      />
    </section>
  );
}
