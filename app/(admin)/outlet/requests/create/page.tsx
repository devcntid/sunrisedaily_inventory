'use client';
import { useState, useEffect } from 'react';
import { Toast } from '@/components/ui/Toast';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Select } from '@/components/ui/Select';
import { ItemSelectWithBrand } from '@/components/shared/ItemSelectWithBrand';
import { ChevronLeft } from 'lucide-react';

interface Item {
  id: number;
  name: string;
  category_name: string;
  purchase_unit: string;
  smallest_unit: string;
  conversion_ratio: number;
  is_split_allowed?: boolean;
  min_order_qty?: number;
  order_multiple?: number;
}

interface RequestLine {
  id: number;
  item_id: number | null;
  name: string;
  uom: string;
  qty: string;
  note: string;
  smallest_unit: string;
  purchase_unit: string;
  ratio: number;
  kebutuhan_bersih_small?: number;
  excess_small?: number;
  is_split_allowed?: boolean;
  min_order_qty?: number;
  order_multiple?: number;
}

function calculateSuggestedOrder(
  kebutuhanBersihSmall: number,
  ratio: number,
  isSplitAllowed: boolean = false,
  minOrderQty: number = 1,
  orderMultiple: number = 1
) {
  const rawLarge = kebutuhanBersihSmall / (ratio || 1);
  let roundedLarge = isSplitAllowed ? rawLarge : Math.ceil(rawLarge);
  if (roundedLarge < minOrderQty) {
    roundedLarge = minOrderQty;
  }
  const multiple = orderMultiple > 0 ? orderMultiple : 1;
  const remainder = roundedLarge % multiple;
  if (remainder > 1e-6) {
    roundedLarge += (multiple - remainder);
  }
  roundedLarge = Math.round(roundedLarge * 100) / 100;
  const totalSmallest = Math.round(roundedLarge * (ratio || 1));
  const excessSmall = totalSmallest - kebutuhanBersihSmall;
  return { suggestedLarge: roundedLarge, totalSmallest, excessSmall };
}

export default function CreateRequestPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [cart, setCart] = useState<RequestLine[]>([{
    id: 1,
    item_id: null,
    name: '',
    uom: '',
    qty: '',
    note: '',
    smallest_unit: '',
    purchase_unit: '',
    ratio: 1
  }]);
  const [activeItemIds, setActiveItemIds] = useState<number[]>([]);
  const [toast, setToast] = useState({ open: false, message: '', type: 'info' as 'success'|'error'|'info' });

  const [orderDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [bulkAddQty, setBulkAddQty] = useState('5');
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [itemsRes, activeRes, invRes] = await Promise.all([
          fetch('/api/items?parent_only=true'),
          fetch('/api/outlet/active-requests'),
          fetch('/api/outlet/inventory')
        ]);
        
        const [itemsJson, activeJson, invJson] = await Promise.all([
          itemsRes.json(),
          activeRes.json(),
          invRes.json()
        ]);
        
        const itemsList = itemsJson.data ?? [];
        setItems(itemsList);

        const activeItemsSet = new Set(activeJson.success ? activeJson.data : []);
        setActiveItemIds(Array.from(activeItemsSet) as number[]);

        if (invJson.success && invJson.data) {
          const activeSet = new Set(activeJson.success ? activeJson.data : []);

          const lowStockItems = invJson.data
            .filter((d: any) => {
              if (d.minimum_threshold === null) return false;
              // Jika item sudah ada di order aktif (belum SELESAI/DIBATALKAN), skip
              if (activeSet.has(d.item_id)) return false;
              const currentBalance = Number(d.current_balance || 0);
              const incomingBalance = Number(d.incoming_balance || 0);
              const effectiveBalance = currentBalance + incomingBalance;
              return effectiveBalance <= d.minimum_threshold;
            })
            .map((d: any, index: number) => {
              const currentBalance = Number(d.current_balance || 0);
              const incomingBalance = Number(d.incoming_balance || 0);
              const effectiveBalance = currentBalance + incomingBalance;
              const minThreshold = Number(d.minimum_threshold || 0);

              // Hitung kebutuhan untuk mencapai batas minimum outlet (bukan target master data).
              // target_stock dari master bisa sangat besar (satuan pcs), sehingga tidak cocok
              // untuk menentukan jumlah order per-outlet.
              // Rumus: order cukup untuk kembali ke minimum_threshold + sedikit buffer (min threshold itu sendiri).
              let shortageSmall = minThreshold - effectiveBalance;
              if (shortageSmall <= 0) shortageSmall = minThreshold;
              
              const matchedMaster = itemsList.find((i: { id: number, item_name?: string, name?: string }) => i.id === d.item_id);
              if (!matchedMaster) return null;

              const ratio = Number(matchedMaster.conversion_ratio) || 1;
              const calc = calculateSuggestedOrder(
                shortageSmall,
                ratio,
                matchedMaster.is_split_allowed,
                Number(matchedMaster.min_order_qty || 1),
                Number(matchedMaster.order_multiple || 1)
              );

              return {
                id: Date.now() + index,
                item_id: d.item_id,
                name: d.item_name || matchedMaster.name,
                uom: matchedMaster.purchase_unit,
                smallest_unit: d.smallest_unit || matchedMaster.smallest_unit,
                purchase_unit: matchedMaster.purchase_unit,
                ratio: ratio, 
                qty: calc.suggestedLarge.toString(),
                kebutuhan_bersih_small: shortageSmall,
                excess_small: calc.excessSmall,
                note: ''
              };
            })
            .filter(Boolean);

          if (lowStockItems.length > 0) {
             setCart(lowStockItems);
             setToast({ open: true, message: `${lowStockItems.length} item stok rendah otomatis ditambahkan`, type: 'info' });
          }
        }
      } catch (e) {
         console.error(e);
      }
    };
    fetchAll();

    const d = new Date();
    d.setDate(d.getDate() + 3);
    setDeliveryDate(d.toISOString().split('T')[0]);
  }, []);

  const addEmptyRow = () => {
    setCart([{
      id: Date.now(),
      item_id: null,
      name: '',
      uom: '',
      smallest_unit: '',
      purchase_unit: '',
      ratio: 1,
      qty: '',
      note: ''
    }, ...cart]);
  };

  const updateCartItemSelect = (rowId: number, selectedItemId: string) => {
    const item = items.find(i => String(i.id) === selectedItemId);
    if (!item) return;

    setCart(cart.map(c => c.id === rowId ? {
      ...c,
      item_id: item.id,
      name: item.name,
      uom: item.purchase_unit,
      smallest_unit: item.smallest_unit,
      purchase_unit: item.purchase_unit,
      ratio: item.conversion_ratio,
      is_split_allowed: item.is_split_allowed,
      min_order_qty: Number(item.min_order_qty || 1),
      order_multiple: Number(item.order_multiple || 1)
    } : c));
  };

  const updateCartQty = (id: number, val: string) => {
    const numericVal = val.replace(/[^0-9.]/g, '');
    setCart(cart.map(c => c.id === id ? { ...c, qty: numericVal } : c));
  };

  const updateCartNote = (id: number, val: string) => {
    setCart(cart.map(c => c.id === id ? { ...c, note: val } : c));
  };

  const updateCartUnit = (id: number, val: string) => {
    setCart(cart.map(c => c.id === id ? { ...c, uom: val } : c));
  };

  const removeCartItem = (id: number) => {
    setCart(cart.filter(c => c.id !== id));
  };

  async function handleSubmit() {
    if (!deliveryDate) { setToast({ open: true, message: 'Tanggal pengiriman wajib diisi.', type: 'error' }); return; }
    if (!cart.length) { setToast({ open: true, message: 'Keranjang kosong.', type: 'error' }); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_date: orderDate,
          delivery_date: deliveryDate,
          items: cart.filter(l => l.item_id !== null && parseFloat(l.qty) > 0).map(l => {
            const floatQty = parseFloat(l.qty) || 0;
            // The qty is already guaranteed to be in purchase_unit and rounded
            return { item_id: l.item_id, qty_request: floatQty, additional_notes: l.note };
          }),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setToast({ open: true, message: data.message || 'Gagal mengirim permintaan', type: 'error' }); return; }
      router.push('/outlet/requests');
    } catch (err: unknown) {
      setToast({ open: true, message: (err instanceof Error ? err.message : 'Unknown error'), type: 'error' });
    } finally {
      setSubmitting(false);
      setShowConfirm(false);
    }
  }

  return (
    <section className="screen">
      <Toast isOpen={toast.open} message={toast.message} type={toast.type} duration={toast.type === 'error' ? 6000 : 4000} onClose={() => setToast({...toast, open: false})} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button className="btn" onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', padding: '8px 12px' }}>
          <ChevronLeft size={18} /> Kembali
        </button>
        <div>
          <h2 style={{ margin: 0 }}>Buat Permintaan Manual</h2>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            Buat permintaan pembelian secara manual atau tinjau saran item stok rendah otomatis.
          </div>
        </div>
      </div>

      <div className="card" style={{ overflow: 'visible' }}>

        <div className="card-body" style={{ minHeight: 500 }}>
          <div className="form-grid" style={{ marginBottom: 30, maxWidth: 600 }}>
            <div className="form-group">
              <label>Tanggal Order</label>
              <Input type="date" value={orderDate} disabled style={{ width: 160 }} />
            </div>
            <div className="form-group">
              <label>Estimasi Kirim</label>
              <Input
                type="date"
                value={deliveryDate}
                min={orderDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                onKeyDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  try { (e.target as HTMLInputElement).showPicker(); } catch (err) { }
                }}
                style={{ width: 160 }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h4 style={{ margin: 0 }}>Barang ({cart.length})</h4>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', height: '32px' }}>
                <input
                  type="number"
                  className="input num"
                  style={{ width: '50px', padding: '4px 8px', borderRight: 'none', borderTopRightRadius: 0, borderBottomRightRadius: 0, fontSize: 13, height: '32px' }}
                  value={bulkAddQty}
                  onChange={(e) => setBulkAddQty(e.target.value)}
                  placeholder="Qty"
                />
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ borderRadius: 0, height: '32px', fontWeight: 600, background: '#fff', color: '#ef4444', border: '1px solid #ef4444', borderRight: 'none', padding: '0 12px' }}
                  onClick={() => {
                    const val = Number(bulkAddQty) || 0;
                    if (val === 0) return;
                    setCart(c => c.map(line => {
                      if (line.item_id) {
                        const currentQty = Number(line.qty) || 0;
                        return { ...line, qty: String(Math.max(0, currentQty - val)) };
                      }
                      return line;
                    }));
                  }}
                >
                  -
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, height: '32px', fontWeight: 600, background: 'var(--primary)', color: '#fff', border: '1px solid var(--primary)', padding: '0 12px' }}
                  onClick={() => {
                    const val = Number(bulkAddQty) || 0;
                    if (val === 0) return;
                    setCart(c => c.map(line => {
                      if (line.item_id) {
                        const currentQty = Number(line.qty) || 0;
                        return { ...line, qty: String(currentQty + val) };
                      }
                      return line;
                    }));
                  }}
                >
                  +
                </button>
              </div>
              <div style={{ width: '1px', height: '24px', background: '#cbd5e1', margin: '0 4px' }}></div>
              <Button variant="outline" size="sm" onClick={() => setCart([])} style={{ borderColor: '#fca5a5', color: '#ef4444', background: '#fef2f2' }} disabled={cart.length === 0}>
                Bersihkan Semua
              </Button>
              <Button variant="outline" size="sm" onClick={addEmptyRow} style={{ borderColor: '#86efac', background: '#f0fdf4' }}>
                + Tambah Barang
              </Button>
              <Button variant="primary" size="sm" onClick={() => setShowConfirm(true)} disabled={submitting || cart.length === 0}>
                {submitting ? 'Mengirim...' : 'Kirim Permintaan'}
              </Button>
            </div>
          </div>

          <Table responsive={false}>
            <thead>
              <tr>
                <th>Nama Barang</th>
                <th className="right" style={{ width: 120 }}>Jml Diminta</th>
                <th>Satuan Pembelian</th>
                <th className="muted" style={{ width: 180 }}>Pratinjau Konversi</th>
                <th>Catatan</th>
                <th className="center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {cart.map(c => (
                <tr key={c.id}>
                  <td className={c.item_id ? "font-bold" : ""}>
                    {!c.item_id ? (
                      <ItemSelectWithBrand
                        value={c.item_id || ''}
                        onChange={val => updateCartItemSelect(c.id, String(val))}
                        items={items as any}
                        placeholder="Pilih Barang..."
                        style={{ width: '100%', maxWidth: 300 }}
                      />
                    ) : c.name}
                  </td>
                  <td>
                    <input type="number" min={c.min_order_qty || 1} step={c.is_split_allowed ? "any" : "1"} className="input right" value={c.qty} onChange={(e) => updateCartQty(c.id, e.target.value)} onWheel={(e) => (e.target as HTMLInputElement).blur()} style={{ height: 32, width: '100%', minWidth: 60 }} placeholder="0" />
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--foreground)' }}>
                    {c.item_id ? c.purchase_unit : '-'}
                  </td>
                  <td className="muted" style={{ fontSize: 13 }}>
                    {c.item_id ? (
                      <div>
                        <div>≈ {Number((parseFloat(c.qty || '0') * c.ratio).toFixed(2)).toLocaleString('id-ID')} {c.smallest_unit}</div>
                        {c.kebutuhan_bersih_small !== undefined && (
                          <div style={{ fontSize: 11, color: '#059669', marginTop: 2 }}>
                            Kebutuhan: {c.kebutuhan_bersih_small} {c.smallest_unit}
                            {Number(c.excess_small) > 0 && (
                              <span style={{ marginLeft: 6, background: '#dbeafe', color: '#1e40af', padding: '1px 5px', borderRadius: 4 }}>
                                +{c.excess_small} {c.smallest_unit}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ) : '-'}
                  </td>
                  <td>
                     <Input type="text" value={c.note} onChange={e => updateCartNote(c.id, e.target.value)} placeholder="Catatan (Opsional)" style={{ height: 32, minWidth: 150 }} />
                  </td>
                  <td className="center">
                    <Button size="sm" onClick={() => removeCartItem(c.id)} title="Delete" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                    </Button>
                  </td>
                </tr>
              ))}
              {cart.length === 0 && (
                <tr><td colSpan={6} className="center muted" style={{ padding: 40 }}>Keranjang Anda kosong. Klik "+ Tambah Barang" untuk menambahkan barang.</td></tr>
              )}
            </tbody>
          </Table>


        </div>
      </div>

      <ConfirmDialog
        open={showConfirm}
        title="Kirim Permintaan Pembelian"
        message={`Apakah Anda yakin ingin mengirim permintaan ini dengan ${cart.length} barang?`}
        onCancel={() => setShowConfirm(false)}
        onConfirm={handleSubmit}
        loading={submitting}
        confirmText="Ya, Kirim"
        cancelText="Batal"
      />
    </section>
  );
}
