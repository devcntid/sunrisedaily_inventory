'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Table } from '@/components/ui/Table';
import { Input } from '@/components/ui/Input';
import { Toast } from '@/components/ui/Toast';
import { ChevronLeft, Plus, Trash2, Send } from 'lucide-react';

type EstimationRow = {
  ingredient_id: number;
  ingredient_name: string;
  item_id: number | null;
  item_name: string | null;
  category_name: string | null;
  total_raw_qty: number;
  default_unit: string | null;
  
  // UI States
  suggested_qty: number; // raw + 10% buffer
  final_qty: number; // editable by user
  selected: boolean;
};

export default function ProcurementEstimationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';
  
  const [outletId, setOutletId] = useState<number | null>(null);

  const [data, setData] = useState<EstimationRow[]>([]);
  const [allMasterItems, setAllMasterItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', type: 'info' as 'success'|'error'|'info' });
  
  // For additional items (Sapu, Sabun, etc)
  const [additionalItems, setAdditionalItems] = useState<{ id: string; item_id: number | null; name: string; qty: number; unit: string }[]>([]);
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data?.outlet_id) setOutletId(d.data.outlet_id);
      })
      .catch(err => console.error('Error fetching session:', err));
  }, []);

  useEffect(() => {
    if (dateFrom && dateTo && outletId) {
      loadData();
    }
  }, [dateFrom, dateTo, outletId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [resEstimation, resItems] = await Promise.all([
        fetch(`/api/sales-transactions/estimation?outlet_id=${outletId}&dateFrom=${dateFrom}&dateTo=${dateTo}`),
        fetch('/api/items')
      ]);
      
      const jsonEst = await resEstimation.json();
      const jsonItems = await resItems.json();

      if (jsonItems.success) {
        setAllMasterItems(jsonItems.data);
      }

      if (jsonEst.success) {
        // Prepare data with buffer and selection state
        const enriched = jsonEst.data.map((item: any) => {
          const buffered = Math.ceil(Number(item.total_raw_qty || item.suggested_qty || 0) * 1.10); // +10% buffer
          return {
            ...item,
            suggested_qty: buffered,
            final_qty: buffered,
            selected: item.item_id !== null // Select by default if it has mapping to Item
          };
        });
        setData(enriched);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleQtyChange = (ingredientId: number, val: string) => {
    const num = parseFloat(val) || 0;
    setData(prev => prev.map(r => r.ingredient_id === ingredientId ? { ...r, final_qty: num } : r));
  };

  const handleToggleSelect = (ingredientId: number) => {
    setData(prev => prev.map(r => r.ingredient_id === ingredientId ? { ...r, selected: !r.selected } : r));
  };
  
  const handleToggleAll = (checked: boolean) => {
    setData(prev => prev.map(r => ({ ...r, selected: checked && r.item_id !== null })));
  };

  const handleAddAdditional = () => {
    setAdditionalItems([
      ...additionalItems, 
      { id: Math.random().toString(), item_id: null, name: '', qty: 1, unit: 'pcs' }
    ]);
  };

  const getAvailableItems = () => {
    const usedIds = new Set(data.map((d: any) => Number(d.item_id)).filter(Boolean));
    const additionalUsedIds = new Set(additionalItems.map((a: any) => Number(a.item_id)).filter(Boolean));
    return allMasterItems.filter((item: any) => !usedIds.has(Number(item.id)) && !additionalUsedIds.has(Number(item.id)));
  };

  const handleSubmit = async () => {
    const selectedData = data.filter(d => d.selected && d.item_id && d.final_qty > 0);
    const validAdditional = additionalItems.filter(a => a.name.trim() !== '' && a.qty > 0);
    
    if (selectedData.length === 0 && validAdditional.length === 0) {
      setToast({ open: true, message: 'Pilih minimal 1 barang untuk direquest.', type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      // Create order draft (Request to Central)
      // Note: This matches the structure expected by POST /api/orders
      
      const itemsPayload = [
        ...selectedData.map((d: any) => {
          const itemMaster = allMasterItems.find((i: any) => i.id === d.item_id);
          const ratio = Number(itemMaster?.conversion_ratio || 1) || 1;
          return {
            item_id: d.item_id,
            qty_request: Number(d.final_qty) / ratio,
            additional_notes: 'Sales Estimation Buffer +10%'
          };
        }),
        ...validAdditional.map(a => ({
          item_id: a.item_id || null, 
          qty_request: a.qty,
          additional_notes: a.item_id ? '' : `Manual Item: ${a.name} (${a.unit})`
        }))
      ];

      // Delivery date tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const payload = {
        outlet_id: outletId,
        delivery_date: tomorrow.toISOString().split('T')[0],
        items: itemsPayload
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Gagal membuat request');
      
      setToast({ open: true, message: 'Draft Request Pengadaan berhasil dibuat!', type: 'success' });
      setTimeout(() => {
        router.push('/outlet/requests');
      }, 1500);
      
    } catch (err: unknown) {
      setToast({ open: true, message: (err instanceof Error ? err.message : 'Unknown error'), type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const allSelected = data.length > 0 && data.every(d => d.selected || d.item_id === null);

  return (
    <section className="screen" style={{ paddingBottom: 100 }}>
      <Toast isOpen={toast.open} message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, open: false })} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button className="btn" onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', padding: '8px 12px' }}>
          <ChevronLeft size={18} /> Back
        </button>
        <div>
          <h2 style={{ margin: 0 }}>Procurement Estimation</h2>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            Berdasarkan penjualan dari <b>{dateFrom}</b> s.d. <b>{dateTo}</b>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-head" style={{ padding: '12px 16px' }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>Bahan Baku Utama (+10% Buffer)</h3>
        </div>
        <div className="card-body flush" style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }} className="muted">Menghitung bahan baku...</div>
          ) : data.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }} className="muted">Tidak ada data kebutuhan bahan baku.</div>
          ) : (
            <Table>
              <thead>
                <tr style={{ fontSize: 12 }}>
                  <th style={{ width: 40, textAlign: 'center' }}>
                    <input type="checkbox" style={{ width: 14, height: 14, accentColor: '#016e3f', cursor: 'pointer' }} checked={allSelected} onChange={e => handleToggleAll(e.target.checked)} />
                  </th>
                  <th>Bahan Baku (Resep)</th>
                  <th>Item Gudang (Fisik)</th>
                  <th className="right">Kebutuhan Murni</th>
                  <th className="right" style={{ width: 140 }}>Estimasi Request</th>
                </tr>
              </thead>
              <tbody style={{ fontSize: 13 }}>
                {data.map(row => (
                  <tr key={row.ingredient_id} style={{ opacity: row.item_id ? 1 : 0.6 }}>
                    <td style={{ textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        style={{ width: 14, height: 14, accentColor: '#016e3f', cursor: 'pointer' }}
                        checked={row.selected} 
                        onChange={() => handleToggleSelect(row.ingredient_id)}
                        disabled={row.item_id === null}
                      />
                    </td>
                    <td style={{ fontWeight: 600 }}>{row.ingredient_name}</td>
                    <td>
                      {row.item_name ? (
                        <div>
                          <div style={{ color: 'var(--foreground)', fontWeight: 600 }}>{row.item_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{row.category_name}</div>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: '#dc2626', background: '#fef2f2', padding: '2px 6px', borderRadius: 4, fontWeight: 500 }}>
                          ⚠️ Belum terhubung ke Data Barang
                        </span>
                      )}
                    </td>
                    <td className="right muted">
                      {row.total_raw_qty.toLocaleString('id-ID', { maximumFractionDigits: 2 })} <span style={{ fontSize: 11 }}>{row.default_unit}</span>
                    </td>
                    <td className="right">
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'flex-end',
                        background: row.selected ? '#fff' : '#f8fafc',
                        border: `1px solid ${row.selected ? '#94a3b8' : 'transparent'}`,
                        borderRadius: 6,
                        padding: '2px 8px',
                        width: 120,
                        marginLeft: 'auto',
                        transition: 'all 0.2s'
                      }}>
                        <input 
                          type="text" 
                          style={{ 
                            width: '100%', 
                            border: 'none', 
                            outline: 'none', 
                            textAlign: 'right', 
                            fontWeight: 700, 
                            fontSize: 13,
                            background: 'transparent',
                            color: row.selected ? 'var(--foreground)' : 'var(--muted)'
                          }} 
                          value={row.final_qty}
                          onChange={e => handleQtyChange(row.ingredient_id, e.target.value.replace(/[^0-9.]/g, ''))}
                          onWheel={e => (e.target as HTMLInputElement).blur()}
                          disabled={!row.selected}
                        />
                        <span style={{ fontSize: 11, color: row.selected ? 'var(--muted)' : '#cbd5e1', marginLeft: 6, fontWeight: 600 }}>
                          {row.default_unit}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15 }}>Item Tambahan (Operasional)</h3>
            <div className="muted" style={{ fontSize: 12, marginTop: 2, fontWeight: 400 }}>Barang yang tidak masuk resep (Sapu, Sabun, Plastik)</div>
          </div>
          <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: 12, display: 'flex', gap: 4, alignItems: 'center' }} onClick={handleAddAdditional}>
            <Plus size={14} /> Tambah Manual
          </button>
        </div>
        <div className="card-body flush" style={{ overflow: 'visible' }}>
          {additionalItems.length === 0 ? (
             <div style={{ padding: 24, textAlign: 'center', fontSize: 13 }} className="muted">Klik Tambah Manual jika butuh barang tambahan.</div>
          ) : (
            <Table responsive={false}>
              <thead>
                <tr style={{ fontSize: 12 }}>
                  <th>Nama Barang</th>
                  <th style={{ width: 120 }}>Qty</th>
                  <th style={{ width: 120 }}>Satuan</th>
                  <th style={{ width: 60 }}></th>
                </tr>
              </thead>
              <tbody style={{ fontSize: 13 }}>
                {additionalItems.map(item => (
                  <tr key={item.id}>
                    <td style={{ padding: '4px 12px' }}>
                      <div style={{ position: 'relative' }}>
                        <input 
                          className="input" 
                          placeholder="Ketik nama barang..." 
                          style={{ width: '100%', background: '#f8fafc', padding: '4px 8px', fontSize: 13, borderColor: item.item_id ? '#016e3f' : 'var(--border)' }} 
                          value={item.name} 
                          onFocus={() => setActiveDropdownId(item.id)}
                          onBlur={() => setTimeout(() => setActiveDropdownId(null), 200)}
                          onChange={e => {
                            const newArr = [...additionalItems];
                            const target = newArr.find(a => a.id === item.id)!;
                            target.name = e.target.value;
                            target.item_id = null; // Clear item_id if user types manually
                            setAdditionalItems(newArr);
                          }} 
                        />
                        {activeDropdownId === item.id && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid var(--border)', zIndex: 9999, maxHeight: 250, overflowY: 'auto', borderRadius: '4px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -2px rgb(0 0 0 / 0.05)' }}>
                            {getAvailableItems().filter((i: any) => String(i.name || '').toLowerCase().includes(String(item.name || '').toLowerCase())).length === 0 ? (
                              <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--muted)' }}>Barang tidak ditemukan (Tetap bisa kirim teks ini).</div>
                            ) : (
                              getAvailableItems().filter((i: any) => String(i.name || '').toLowerCase().includes(String(item.name || '').toLowerCase())).map((filteredItem: any) => (
                                <div 
                                  key={filteredItem.id}
                                  style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}
                                  onClick={() => {
                                    const newArr = [...additionalItems];
                                    const target = newArr.find(a => a.id === item.id)!;
                                    target.name = filteredItem.name;
                                    target.item_id = filteredItem.id;
                                    target.unit = filteredItem.purchase_unit;
                                    setAdditionalItems(newArr);
                                    setActiveDropdownId(null);
                                  }}
                                >
                                  <div style={{ fontWeight: 600 }}>{filteredItem.name}</div>
                                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{filteredItem.category_name}</div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '4px 12px' }}>
                        <input type="text" className="input" style={{ width: '100%', background: '#f8fafc', textAlign: 'center', padding: '4px 8px', fontSize: 13 }} value={item.qty} onChange={e => {
                        const newArr = [...additionalItems];
                        const val = e.target.value.replace(/[^0-9.]/g, '');
                        newArr.find(a => a.id === item.id)!.qty = val ? Number(val) : 0;
                        setAdditionalItems(newArr);
                      }} onWheel={e => (e.target as HTMLInputElement).blur()} />
                    </td>
                    <td style={{ padding: '4px 12px' }}>
                      <input className="input" placeholder="pcs" style={{ width: '100%', background: '#f8fafc', textAlign: 'center', padding: '4px 8px', fontSize: 13 }} value={item.unit} onChange={e => {
                        const newArr = [...additionalItems];
                        newArr.find(a => a.id === item.id)!.unit = e.target.value;
                        setAdditionalItems(newArr);
                      }} />
                    </td>
                    <td className="right" style={{ padding: '4px 12px' }}>
                      <button className="btn" style={{ padding: 4, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca' }} onClick={() => {
                        setAdditionalItems(additionalItems.filter(a => a.id !== item.id));
                      }}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </div>

      {/* Floating Save Button */}
      <div style={{ position: 'fixed', bottom: 0, left: 240, right: 0, background: '#fff', borderTop: '1px solid var(--border)', padding: '16px 32px', display: 'flex', justifyContent: 'flex-end', zIndex: 100, boxShadow: '0 -4px 6px -1px rgb(0 0 0 / 0.05)' }}>
        <button 
          className="btn btn-primary" 
          style={{ padding: '10px 24px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }} 
          onClick={handleSubmit} 
          disabled={submitting}
        >
          <Send size={18} />
          {submitting ? 'Mengirim...' : 'Kirim Request ke Pusat'}
        </button>
      </div>

    </section>
  );
}
