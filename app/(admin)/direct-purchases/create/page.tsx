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

  const [form, setForm] = useState({
    receipt_number: '',
    notes: '',
  });

  const [lines, setLines] = useState([
    { item_id: '', brand_id: '', shop_name: '', qty: '', unit_price: '', unit_type: 'purchase' }
  ]);

  const [pendingSessions, setPendingSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [loadedSessionIds, setLoadedSessionIds] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/items?active_only=true')
      .then(r => r.json())
      .then(d => {
        if (d.success) setItems(d.data || []);
      });

    // Cek localStorage untuk pending belanja dari PDF
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('pendingMarketPurchases');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setPendingSessions(parsed);
            setSelectedSessionId(parsed[0].id);
          }
        } catch (e) {
          console.error('Failed to parse pendingMarketPurchases', e);
        }
      }
    }
  }, []);

  const parentItems = items.filter(i => i.parent_id === null);

  const handleAddLine = () => {
    setLines([{ item_id: '', brand_id: '', shop_name: '', qty: '', unit_price: '', unit_type: 'purchase' }, ...lines]);
  };

  const handleRemoveLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleChangeLine = (index: number, field: string, value: string) => {
    const newLines = [...lines];
    (newLines[index] as any)[field] = value;
    if (field === 'item_id') {
      newLines[index].brand_id = ''; // reset brand if item changes
    }
    setLines(newLines);
  };

  const handleLoadPendingItems = () => {
    const session = pendingSessions.find(s => s.id === selectedSessionId);
    if (session && session.items && session.items.length > 0) {
      const newLines = session.items.map((p: any) => {
        // Coba cocokkan dengan unit_type yang benar di items array, atau biarkan default purchase
        const itemObj = items.find(i => String(i.id) === String(p.item_id));
        let uType = 'purchase';
        if (itemObj && itemObj.smallest_unit && String(itemObj.smallest_unit).toLowerCase() === String(p.unit).toLowerCase()) {
          uType = 'smallest';
        }

        return {
          item_id: String(p.item_id),
          brand_id: '',
          shop_name: '',
          qty: String(p.qty),
          unit_price: '',
          unit_type: uType
        };
      });
      
      const validExistingLines = lines.filter(l => l.item_id !== '');
      setLines([...validExistingLines, ...newLines]);
      
      setLoadedSessionIds([...loadedSessionIds, session.id]);
      setToast({ open: true, message: `${session.items.length} barang berhasil dimuat dari Sesi ${session.timestamp}.`, type: 'success' });
    }
  };

  const handleDismissPendingItems = () => {
    if (typeof window !== 'undefined') {
      const remaining = pendingSessions.filter(s => s.id !== selectedSessionId);
      if (remaining.length > 0) {
        localStorage.setItem('pendingMarketPurchases', JSON.stringify(remaining));
        setPendingSessions(remaining);
        setSelectedSessionId(remaining[0].id);
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
      // Validate
      const validLines = lines.filter(l => l.item_id && l.shop_name && Number(l.qty) > 0 && Number(l.unit_price) >= 0);
      if (validLines.length === 0) {
        setToast({ open: true, message: 'Harap isi minimal 1 baris barang belanjaan dengan lengkap', type: 'error' });
        return;
      }

      let total_amount = 0;
      const payloadItems = validLines.map(l => {
        const pItem = items.find(i => String(i.id) === String(l.item_id));
        const bItem = l.brand_id ? items.find(i => String(i.id) === String(l.brand_id)) : null;
        
        const usedItem = bItem || pItem;
        const subtotal = Number(l.qty) * Number(l.unit_price);
        total_amount += subtotal;

        const isSmallest = l.unit_type === 'smallest';
        const conversion_ratio = usedItem?.conversion_ratio || 1;
        const smallest_qty = isSmallest ? Number(l.qty) : (Number(l.qty) * conversion_ratio);

        return {
          item_id: Number(l.item_id),
          brand_id: l.brand_id ? Number(l.brand_id) : null,
          shop_name: l.shop_name,
          qty: Number(l.qty),
          unit: isSmallest ? (usedItem?.smallest_unit || '') : (usedItem?.purchase_unit || ''),
          unit_price: Number(l.unit_price),
          subtotal,
          smallest_qty
        };
      });

      const res = await fetch('/api/direct-purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receipt_number: form.receipt_number,
          notes: form.notes,
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
    <div className="screen">
      <div className="screen-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div className="screen-title" style={{ display: 'flex', alignItems: 'center' }}>
          <Button variant="outline" onClick={() => router.back()} style={{ marginRight: 12, padding: '8px' }}>
            <ArrowLeft size={16} />
          </Button>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Catat Belanja Pasar</h2>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '7fr 3fr', gap: 20, alignItems: 'start' }}>
        
        {/* KOLOM KIRI (70%) - TABEL BELANJA */}
        <div>
          <div className="card">
            <div className="card-head" style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Daftar Barang Belanjaan</h3>
              <span className="muted" style={{ fontSize: 12 }}>{lines.length} Baris</span>
            </div>
            <div className="card-body flush">
              <div className="table-responsive">
                <table className="table" style={{ width: '100%', minWidth: 700 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ minWidth: 220, paddingLeft: 16 }}>BAHAN / PRODUK</th>
                      <th>TOKO</th>
                      <th style={{ width: 120 }}>JUMLAH</th>
                      <th style={{ width: 140 }}>HARGA SATUAN</th>
                      <th style={{ width: 130 }} className="right">SUBTOTAL</th>
                      <th style={{ width: 44 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, idx) => {
                      const availableBrands = items.filter(i => i.parent_id !== null && String(i.parent_id) === String(line.item_id));
                      const selectedItem = items.find(i => String(i.id) === String(line.brand_id || line.item_id));
                      const subtotal = (Number(line.qty) || 0) * (Number(line.unit_price) || 0);

                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '8px 12px 8px 16px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <Select 
                                value={line.item_id}
                                onChange={val => handleChangeLine(idx, 'item_id', String(val))}
                                options={[
                                  { value: '', label: 'Pilih Barang Utama...' },
                                  ...parentItems.map(i => ({ value: i.id, label: i.name }))
                                ]}
                                style={{ width: '100%' }}
                                searchable
                              />
                              {line.item_id && availableBrands.length > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 8 }}>
                                  <span style={{ color: '#94a3b8', fontSize: 14 }}>↳</span>
                                  <div style={{ flex: 1, border: !line.brand_id ? '1px solid #ef4444' : 'none', borderRadius: 6 }}>
                                    <Select 
                                      value={line.brand_id}
                                      onChange={val => handleChangeLine(idx, 'brand_id', String(val))}
                                      options={[
                                        { value: '', label: 'Pilih Merk (Wajib)...' },
                                        ...availableBrands.map(b => ({ value: b.id, label: b.name }))
                                      ]}
                                      style={{ width: '100%' }}
                                      searchable
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <input 
                              type="text" 
                              className="input" 
                              placeholder="Toko A"
                              value={line.shop_name}
                              onChange={e => handleChangeLine(idx, 'shop_name', e.target.value)}
                              style={{ width: '100%', border: '1px solid transparent', backgroundColor: 'transparent' }}
                              onFocus={(e) => e.target.style.border = '1px solid var(--primary)'}
                              onBlur={(e) => e.target.style.border = '1px solid transparent'}
                            />
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <input 
                                type="number" 
                                className="input right" 
                                min="0"
                                value={line.qty}
                                onChange={e => handleChangeLine(idx, 'qty', e.target.value)}
                                style={{ width: 56, padding: '4px 6px', border: '1px solid transparent', backgroundColor: 'transparent' }}
                                onFocus={(e) => e.target.style.border = '1px solid var(--primary)'}
                                onBlur={(e) => e.target.style.border = '1px solid transparent'}
                              />
                              {selectedItem ? (
                                <Select 
                                  value={line.unit_type || 'purchase'}
                                  onChange={val => handleChangeLine(idx, 'unit_type', String(val))}
                                  options={
                                    selectedItem.purchase_unit !== selectedItem.smallest_unit ? [
                                      { value: 'purchase', label: selectedItem.purchase_unit },
                                      { value: 'smallest', label: selectedItem.smallest_unit }
                                    ] : [
                                      { value: 'purchase', label: selectedItem.purchase_unit }
                                    ]
                                  }
                                  style={{ width: 80, border: 'none', backgroundColor: 'transparent', padding: 0 }}
                                />
                              ) : (
                                <span className="muted" style={{ fontSize: 12 }}>-</span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span className="muted" style={{ fontSize: 12 }}>Rp</span>
                              <input 
                                type="number" 
                                className="input right" 
                                min="0"
                                value={line.unit_price}
                                onChange={e => handleChangeLine(idx, 'unit_price', e.target.value)}
                                style={{ flex: 1, border: '1px solid transparent', backgroundColor: 'transparent', padding: '4px' }}
                                onFocus={(e) => e.target.style.border = '1px solid var(--primary)'}
                                onBlur={(e) => e.target.style.border = '1px solid transparent'}
                              />
                            </div>
                          </td>
                          <td className="right font-bold" style={{ padding: '8px 12px', fontSize: 13 }}>
                            Rp {subtotal.toLocaleString('id-ID')}
                          </td>
                          <td className="center" style={{ padding: '8px 12px' }}>
                            {lines.length > 1 && (
                              <button 
                                className="btn-icon danger" 
                                onClick={() => handleRemoveLine(idx)}
                                title="Hapus baris"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: 12, background: '#fafafa', borderTop: '1px solid var(--border)' }}>
                <Button 
                  variant="outline" 
                  onClick={handleAddLine} 
                  size="sm"
                  style={{ width: '100%', borderStyle: 'dashed', borderWidth: 1.5, padding: '8px 0', color: 'var(--primary)', borderColor: 'var(--primary)', fontWeight: 600 }}
                >
                  <Plus size={15} style={{ marginRight: 6 }} /> Tambah Baris Belanjaan
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* KOLOM KANAN (30%) - SIDEBAR STICKY TERSTRUKTUR */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 20 }}>
          
          {/* Smart Import PDF (Sangat Ringkas & Bersih) */}
          {pendingSessions.length > 0 && (
            <div className="card" style={{ border: '1px solid #bbf7d0', backgroundColor: '#f0fdf4' }}>
              <div className="card-body" style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, color: '#166534', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FileText size={15} /> Impor PDF ({pendingSessions.length})
                  </span>
                </div>
                
                <div style={{ display: 'flex', gap: 6 }}>
                  <select 
                    className="input" 
                    style={{ borderColor: '#bbf7d0', flex: 1, backgroundColor: 'white', fontSize: 12, padding: '4px 8px' }}
                    value={selectedSessionId}
                    onChange={(e) => setSelectedSessionId(e.target.value)}
                  >
                    {pendingSessions.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.timestamp} ({s.total_items} item)
                      </option>
                    ))}
                  </select>
                  <Button 
                    variant="primary" 
                    size="sm"
                    onClick={handleLoadPendingItems} 
                    disabled={loadedSessionIds.includes(selectedSessionId)}
                    style={{ backgroundColor: loadedSessionIds.includes(selectedSessionId) ? '#6ee7b7' : '#166534', borderColor: '#166534', fontSize: 12, padding: '4px 10px' }}
                  >
                    {loadedSessionIds.includes(selectedSessionId) ? 'Dimuat' : 'Muat'}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleDismissPendingItems} 
                    style={{ borderColor: '#bbf7d0', color: '#166534', padding: '4px 8px' }}
                    title="Hapus Sesi"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Form Informasi Nota & Ringkasan Total (Disatukan Rapi) */}
          <div className="card">
            <div className="card-head" style={{ padding: '14px 16px' }}>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Informasi Nota</h4>
            </div>
            <div className="card-body" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 4, display: 'block' }}>
                  No. Referensi / Nota <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input 
                  type="text" 
                  className="input" 
                  placeholder="Contoh: NOTA-123"
                  value={form.receipt_number}
                  onChange={e => setForm({ ...form, receipt_number: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 4, display: 'block' }}>
                  Catatan Umum
                </label>
                <input 
                  type="text" 
                  className="input" 
                  placeholder="Contoh: Belanja bahan darurat"
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' }}>
                  <span className="muted" style={{ fontSize: 13 }}>Total Barang:</span>
                  <span className="font-bold" style={{ fontSize: 13 }}>{lines.length} Baris</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
                  <span className="font-bold" style={{ fontSize: 14 }}>Total Nominal:</span>
                  <span className="font-bold text-primary" style={{ fontSize: 20 }}>Rp {total_amount.toLocaleString('id-ID')}</span>
                </div>
                
                <Button 
                  variant="primary" 
                  onClick={handleSubmit} 
                  disabled={loading} 
                  style={{ width: '100%', height: 42, fontSize: 14, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, fontWeight: 700 }}
                >
                  <Save size={18} /> {loading ? 'Menyimpan...' : 'Simpan Belanjaan'}
                </Button>
              </div>
            </div>
          </div>

        </div>
      </div>
      
      <Toast isOpen={toast.open} type={toast.type} message={toast.message} onClose={() => setToast({ ...toast, open: false })} />
    </div>
  );
}

