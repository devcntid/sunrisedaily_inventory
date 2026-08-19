'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Plus, Trash2, Save, ArrowLeft, FileText } from 'lucide-react';
import { Toast } from '@/components/ui/Toast';

export default function CreateDirectPurchasePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [toast, setToast] = useState({ open: false, message: '', type: 'info' as 'success'|'error'|'info' });

  const [lines, setLines] = useState([
    { item_id: '', brand_id: '', note: '', shop_name: '', qty: '', unit_price: '', unit_type: 'purchase' }
  ]);

  const [pendingSessions, setPendingSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [loadedSessionIds, setLoadedSessionIds] = useState<string[]>([]);

  const formatIDR = (val: string | number) => {
    if (val === '' || val === null || val === undefined) return '';
    const num = typeof val === 'number' ? val : Number(String(val).replace(/\D/g, ''));
    if (isNaN(num) || num === 0) return '';
    return num.toLocaleString('id-ID');
  };

  useEffect(() => {
    fetch('/api/items?active_only=true')
      .then(r => r.json())
      .then(d => {
        if (d.success) setItems(d.data || []);
      });

    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('pendingMarketPurchases');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setPendingSessions(parsed);
          }
        } catch (e) {
        }
      }
    }
  }, []);

  const parentItems = items.filter(i => i.parent_id === null);

  const handleSelectSession = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    if (!sessionId) return;

    const session = pendingSessions.find(s => s.id === sessionId);
    if (session && session.items && session.items.length > 0) {
      const newLines = session.items.map((p: any) => {
        const itemObj = items.find(i => String(i.id) === String(p.item_id));
        let uType = 'purchase';
        if (itemObj && itemObj.smallest_unit && String(itemObj.smallest_unit).toLowerCase() === String(p.unit).toLowerCase()) {
          uType = 'smallest';
        }

        return {
          item_id: String(p.item_id),
          brand_id: p.brand_id ? String(p.brand_id) : '',
          note: '',
          shop_name: '',
          qty: String(p.qty),
          unit_price: '',
          unit_type: uType
        };
      });

      setLines(newLines);
      if (!loadedSessionIds.includes(sessionId)) {
        setLoadedSessionIds([...loadedSessionIds, sessionId]);
      }
    }
  };

  const handleAddLine = () => {
    setLines([...lines, { item_id: '', brand_id: '', note: '', shop_name: '', qty: '', unit_price: '', unit_type: 'purchase' }]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length === 1) {
      setLines([{ item_id: '', brand_id: '', note: '', shop_name: '', qty: '', unit_price: '', unit_type: 'purchase' }]);
    } else {
      setLines(lines.filter((_, i) => i !== index));
    }
  };

  const handleChangeLine = (index: number, field: string, value: string) => {
    const newLines = [...lines];
    (newLines[index] as any)[field] = value;
    setLines(newLines);
  };

  const handleDismissPendingItems = (sessionId: string) => {
    if (typeof window !== 'undefined') {
      const remaining = pendingSessions.filter(s => s.id !== sessionId);
      if (remaining.length > 0) {
        localStorage.setItem('pendingMarketPurchases', JSON.stringify(remaining));
        setPendingSessions(remaining);
        if (selectedSessionId === sessionId) {
          setSelectedSessionId('');
        }
      } else {
        localStorage.removeItem('pendingMarketPurchases');
        setPendingSessions([]);
        setSelectedSessionId('');
      }
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const validLines = lines.filter(l => l.item_id && Number(l.qty) > 0 && Number(l.unit_price) >= 0);
      if (validLines.length === 0) {
        setToast({ open: true, message: 'Harap isi minimal 1 baris barang belanjaan', type: 'error' });
        return;
      }

      let total_amount = 0;
      const payloadItems = validLines.map(l => {
        const pItem = items.find(i => String(i.id) === String(l.item_id));
        const activeItem = l.brand_id ? items.find(i => String(i.id) === String(l.brand_id)) : pItem;
        const subtotal = Number(l.qty) * Number(l.unit_price);
        total_amount += subtotal;

        const isSmallest = l.unit_type === 'smallest';
        const conversion_ratio = activeItem?.conversion_ratio || 1;
        const smallest_qty = isSmallest ? Number(l.qty) : (Number(l.qty) * conversion_ratio);

        const shopNameWithNote = l.note ? `${l.shop_name || 'Toko Pasar'} (${l.note})` : (l.shop_name || 'Toko Pasar');

        return {
          item_id: Number(l.item_id),
          brand_id: l.brand_id ? Number(l.brand_id) : null,
          shop_name: shopNameWithNote,
          qty: Number(l.qty),
          unit: isSmallest ? (activeItem?.smallest_unit || '') : (activeItem?.purchase_unit || ''),
          unit_price: Number(l.unit_price),
          subtotal,
          smallest_qty
        };
      });

      const res = await fetch('/api/direct-purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receipt_number: `NOTA-${Date.now().toString().slice(-6)}`,
          notes: 'Belanja Pasar',
          total_amount,
          items: payloadItems
        })
      });

      if (res.ok) {
        if (typeof window !== 'undefined' && loadedSessionIds.length > 0) {
          const stored = localStorage.getItem('pendingMarketPurchases');
          if (stored) {
            try {
              let parsed = JSON.parse(stored);
              if (Array.isArray(parsed)) {
                parsed = parsed.filter(s => !loadedSessionIds.includes(s.id));
                if (parsed.length > 0) {
                  localStorage.setItem('pendingMarketPurchases', JSON.stringify(parsed));
                } else {
                  localStorage.removeItem('pendingMarketPurchases');
                }
              }
            } catch (e) {}
          }
        }
        router.push('/direct-purchases');
      } else {
        const text = await res.text();
        setToast({ open: true, message: 'Gagal menyimpan: ' + text, type: 'error' });
      }
    } catch (e: any) {
      setToast({ open: true, message: 'Terjadi kesalahan sistem', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const total_amount = lines.reduce((acc, line) => acc + (Number(line.qty) || 0) * (Number(line.unit_price) || 0), 0);

  return (
    <section className="screen">
      <div className="card">
        {/* HEADER BARIS */}
        <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Button variant="outline" size="sm" onClick={() => router.back()} style={{ padding: '2px 6px', height: 24 }}>
                <ArrowLeft size={13} />
              </Button>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Catat Belanja Pasar</h3>
            </div>
            <p className="muted" style={{ margin: 0, marginTop: 4, fontSize: 13 }}>
              Catat pengeluaran tunai & rincian barang belanjaan pasar langsung.
            </p>
          </div>
        </div>

        <div className="card-body" style={{ padding: '16px 24px' }}>
          {/* BANNER DROPDOWN PO COMPACT */}
          {pendingSessions.length > 0 && (
            <div style={{ marginBottom: 20, padding: '10px 16px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
              <select
                className="input"
                style={{ width: '100%', maxWidth: 150, borderColor: '#bbf7d0', backgroundColor: '#ffffff', fontSize: 12, padding: '4px 10px', height: 32 }}
                value={selectedSessionId}
                onChange={(e) => handleSelectSession(e.target.value)}
              >
                <option value="">Pilih Data Cetak PO</option>
                {pendingSessions.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.timestamp}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* HEADER TABEL DENGAN TOMBOL TAMBAH BARIS & SIMPAN */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: '#1e293b' }}>
              Daftar Belanjaan ({lines.length} Baris)
            </h2>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <Button 
                variant="outline" 
                onClick={handleAddLine} 
                size="sm"
                style={{ height: 24, fontSize: 11, padding: '0 8px', color: 'var(--primary)', borderColor: 'var(--primary)' }}
              >
                <Plus size={12} style={{ marginRight: 4 }} /> Tambah Baris
              </Button>
              <Button 
                variant="primary" 
                onClick={handleSubmit} 
                disabled={loading} 
                size="sm"
                style={{ height: 24, padding: '0 10px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <Save size={12} /> {loading ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </div>
          </div>

          {/* TABEL */}
          <div className="table-responsive" style={{ marginBottom: 16 }}>
            <table className="data-table" style={{ width: '100%', margin: 0 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ width: '22%', padding: '10px 12px', textAlign: 'left', fontSize: 11 }}>BAHAN</th>
                  <th style={{ width: '15%', padding: '10px 12px', textAlign: 'left', fontSize: 11 }}>CATATAN</th>
                  <th style={{ width: '15%', padding: '10px 12px', textAlign: 'left', fontSize: 11 }}>NAMA TOKO</th>
                  <th style={{ width: '13%', padding: '10px 12px', textAlign: 'left', fontSize: 11 }}>JUMLAH</th>
                  <th style={{ width: '15%', padding: '10px 12px', textAlign: 'left', fontSize: 11 }}>HARGA SATUAN</th>
                  <th style={{ width: '17%', padding: '10px 12px', textAlign: 'right', fontSize: 11, whiteSpace: 'nowrap' }}>SUBTOTAL</th>
                  <th style={{ width: '3%', padding: '10px 8px' }}></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => {
                  const selectedItem = items.find(i => String(i.id) === String(line.item_id));
                  const subtotal = (Number(line.qty) || 0) * (Number(line.unit_price) || 0);

                  return (
                    <tr key={line.item_id ? `line-${line.item_id}-${idx}` : `line-${idx}`} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 12px' }}>
                        <Select 
                          value={line.item_id}
                          onChange={val => {
                            handleChangeLine(idx, 'item_id', String(val));
                            handleChangeLine(idx, 'brand_id', '');
                          }}
                          options={[
                            { value: '', label: 'Pilih Bahan...' },
                            ...parentItems.map(i => ({ value: i.id, label: i.name }))
                          ]}
                          style={{ width: '100%', height: 32, fontSize: 12 }}
                          searchable
                        />
                        {(() => {
                           const itemBrands = items.filter(i => String(i.parent_id) === String(line.item_id));
                           if (itemBrands.length > 0) {
                             return (
                               <div style={{ marginTop: 8 }}>
                                 <Select 
                                   value={line.brand_id || ''}
                                   onChange={val => handleChangeLine(idx, 'brand_id', String(val))}
                                   options={[
                                     { value: '', label: 'Pilih Varian/Brand...' },
                                     ...itemBrands.map(i => ({ value: i.id, label: i.name }))
                                   ]}
                                   style={{ width: '100%', height: 32, fontSize: 12 }}
                                   searchable
                                 />
                               </div>
                             );
                           }
                           return null;
                        })()}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <input 
                          type="text" 
                          className="input" 
                          placeholder="Merk/Catatan..."
                          value={line.note || ''}
                          onChange={e => handleChangeLine(idx, 'note', e.target.value)}
                          style={{ width: '100%', fontSize: 12, height: 32, padding: '4px 8px' }}
                        />
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <input 
                          type="text" 
                          className="input" 
                          placeholder="Nama Toko..."
                          value={line.shop_name}
                          onChange={e => handleChangeLine(idx, 'shop_name', e.target.value)}
                          style={{ width: '100%', fontSize: 12, height: 32, padding: '4px 8px' }}
                        />
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input 
                            type="number" 
                            className="input right" 
                            min="0"
                            placeholder="0"
                            value={line.qty}
                            onChange={e => handleChangeLine(idx, 'qty', e.target.value)}
                            style={{ width: 60, fontSize: 12, height: 32, padding: '4px 6px' }}
                          />
                          {(() => {
                            const activeItem = line.brand_id ? items.find(i => String(i.id) === String(line.brand_id)) : selectedItem;
                            if (activeItem) {
                              return (
                                <Select 
                                  value={line.unit_type || 'purchase'}
                                  onChange={val => handleChangeLine(idx, 'unit_type', String(val))}
                                  options={
                                    activeItem.purchase_unit !== activeItem.smallest_unit ? [
                                      { value: 'purchase', label: activeItem.purchase_unit },
                                      { value: 'smallest', label: activeItem.smallest_unit }
                                    ] : [
                                      { value: 'purchase', label: activeItem.purchase_unit }
                                    ]
                                  }
                                  style={{ width: 75, height: 32, fontSize: 12 }}
                                />
                              );
                            }
                            return <span className="muted" style={{ fontSize: 12 }}>-</span>;
                          })()}
                        </div>
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input 
                            type="text" 
                            className="input right" 
                            placeholder="Rp 0"
                            value={line.unit_price ? `${formatIDR(line.unit_price)}` : ''}
                            onChange={e => {
                              const cleanVal = e.target.value.replace(/\D/g, '');
                              handleChangeLine(idx, 'unit_price', cleanVal);
                            }}
                            style={{ width: '100%', fontSize: 12, height: 32, padding: '4px 6px' }}
                          />
                        </div>
                      </td>
                      <td className="right font-bold" style={{ padding: '8px 12px', fontSize: 12, whiteSpace: 'nowrap' }}>
                        Rp {subtotal.toLocaleString('id-ID')}
                      </td>
                      <td className="center" style={{ padding: '8px 4px' }}>
                        <button 
                          className="btn-icon danger" 
                          onClick={() => handleRemoveLine(idx)}
                          title="Hapus"
                          style={{ padding: 4, height: 26, width: 26 }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* FOOTER BARIS RINGKAS (TOTAL NOMINAL) */}
          <div style={{ paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="muted" style={{ fontSize: 13 }}>Total Nominal ({lines.length} items):</span>
              <span className="font-bold text-primary" style={{ fontSize: 17 }}>Rp {total_amount.toLocaleString('id-ID')}</span>
            </div>
          </div>

        </div>
      </div>
      
      <Toast isOpen={toast.open} type={toast.type} message={toast.message} onClose={() => setToast({ ...toast, open: false })} />
    </section>
  );
}
