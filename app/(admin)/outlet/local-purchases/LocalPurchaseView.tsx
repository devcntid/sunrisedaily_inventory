'use client';
import { useState, useEffect } from 'react';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Toast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { FileText, Plus, Trash2, ExternalLink, X } from 'lucide-react';

interface LocalPurchaseItem {
  item_id: number;
  qty: number;
  price_per_unit: number;
  subtotal: number;
}

interface MasterItem {
  id: number;
  name: string;
  smallest_unit: string;
  purchase_unit: string;
  conversion_ratio: number;
}

interface LocalPurchase {
  id: number;
  outlet_id: number;
  outlet_name: string;
  purchase_date: string;
  receipt_url: string;
  total_amount: number;
  items: {
    id: number;
    item_id: number;
    item_name: string;
    qty: number;
    price_per_unit: number;
    subtotal: number;
  }[];
}

export function LocalPurchaseView({ role, outletId }: { role: 'ADMIN_PUSAT' | 'ADMIN_OUTLET', outletId?: number }) {
  const [purchases, setPurchases] = useState<LocalPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [purchaseDate, setPurchaseDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [items, setItems] = useState<LocalPurchaseItem[]>([]);
  
  const [masterItems, setMasterItems] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', type: 'success' as 'success'|'error' });
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  
  useEffect(() => {
    fetchPurchases();
    if (role === 'ADMIN_OUTLET') {
      fetch('/api/items?active_only=true&parent_only=true')
        .then(r => r.json())
        .then(d => setMasterItems(d.data || []));
    }
  }, []);

  const fetchPurchases = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/outlets/local-purchases${outletId ? `?outlet_id=${outletId}` : ''}`);
      const data = await res.json();
      if (data.success) {
        setPurchases(data.data);
      }
    } catch (err) {
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => {
    setItems([...items, { item_id: 0, qty: 1, price_per_unit: 0, subtotal: 0 }]);
  };

  const handleUpdateItem = (index: number, field: keyof LocalPurchaseItem, value: number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === 'qty' || field === 'price_per_unit') {
      newItems[index].subtotal = newItems[index].qty * newItems[index].price_per_unit;
    }
    setItems(newItems);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setToast({ open: true, message: 'Foto bukti/nota wajib diupload!', type: 'error' });
      return;
    }
    if (items.length === 0) {
      setToast({ open: true, message: 'Minimal harus ada 1 barang yang dibeli!', type: 'error' });
      return;
    }
    if (items.some(i => i.item_id === 0)) {
      setToast({ open: true, message: 'Ada baris yang belum dipilih barangnya!', type: 'error' });
      return;
    }
    if (items.some(i => !i.qty || i.qty <= 0)) {
      setToast({ open: true, message: 'Jumlah barang tidak boleh kosong atau 0!', type: 'error' });
      return;
    }
    if (items.some(i => !i.price_per_unit || i.price_per_unit <= 0)) {
      setToast({ open: true, message: 'Harga satuan tidak boleh kosong atau 0!', type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);
      const formData = new FormData();
      // Automatically use today's date in local timezone
      const today = new Date();
      const localDateStr = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      
      formData.append('purchase_date', localDateStr);
      formData.append('total_amount', totalAmount.toString());
      if (outletId) formData.append('outlet_id', outletId.toString());
      formData.append('items', JSON.stringify(items));
      formData.append('file', file);

      const res = await fetch('/api/outlets/local-purchases', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (data.success) {
        setToast({ open: true, message: 'Belanja lokal berhasil dicatat!', type: 'success' });
        setIsFormOpen(false);
        setPurchaseDate('');
        setFile(null);
        setItems([]);
        fetchPurchases();
      } else {
        throw new Error(data.message);
      }
    } catch (err: any) {
      setToast({ open: true, message: err.message || 'Terjadi kesalahan', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const formatRupiah = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <p style={{ color: '#64748b' }}>
          Daftar belanja stok secara mandiri oleh outlet.
        </p>
        {role === 'ADMIN_OUTLET' && (
          <Button onClick={() => {
            setItems([{ item_id: 0, qty: 1, price_per_unit: 0, subtotal: 0 }]);
            setFile(null);
            setPurchaseDate('');
            setIsFormOpen(true);
          }} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Plus size={16} /> Catat Belanja Lokal
          </Button>
        )}
      </div>

      <Table>
        <thead>
          <tr>
            <th>Tanggal Belanja</th>
            {role === 'ADMIN_PUSAT' && <th>Outlet</th>}
            <th>Total Nominal</th>
            <th>Rincian Barang</th>
            <th className="center">Bukti Nota</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={5} className="center">Memuat data...</td></tr>
          ) : purchases.length === 0 ? (
            <tr><td colSpan={5} className="center">Belum ada riwayat belanja lokal.</td></tr>
          ) : purchases.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(p => (
            <tr key={p.id}>
              <td>{new Date(p.purchase_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
              {role === 'ADMIN_PUSAT' && <td>{p.outlet_name}</td>}
              <td className="font-bold text-green-700">{formatRupiah(p.total_amount)}</td>
              <td>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {p.items?.map((item: any) => (
                    <div key={item.id} style={{ fontSize: 13 }}>
                      {item.qty}x {item.item_name} @ {formatRupiah(item.price_per_unit)}
                    </div>
                  ))}
                </div>
              </td>
              <td className="center">
                <button 
                  type="button"
                  onClick={() => setPreviewImage(p.receipt_url)} 
                  className="btn btn-outline" 
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '4px 10px' }}
                >
                  <ExternalLink size={14} /> Lihat Nota
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      
      {purchases.length > itemsPerPage && (
        <div style={{ marginTop: 20 }}>
          <Pagination 
            currentPage={currentPage}
            totalPages={Math.ceil(purchases.length / itemsPerPage)}
            totalItems={purchases.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      <Modal isOpen={isFormOpen} onClose={() => !submitting && setIsFormOpen(false)} title="Catat Belanja Lokal" maxWidth={850}>
        <form onSubmit={handleSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
            <div>
              <label className="form-label">Foto Nota</label>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <input 
                  key={isFormOpen ? 'open' : 'closed'}
                  type="file" 
                  accept="image/*,application/pdf"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f && f.size > 5 * 1024 * 1024) { // 5MB limit
                      setToast({ open: true, message: 'Ukuran file terlalu besar. Maksimal 5MB.', type: 'error' });
                      e.target.value = '';
                      setFile(null);
                      return;
                    }
                    setFile(f || null);
                  }}
                  style={{ flex: 1, padding: '7px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13 }}
                />
                {file && file.type.startsWith('image/') && (
                  <div 
                    style={{ width: 40, height: 40, borderRadius: 6, border: '1px solid #e2e8f0', overflow: 'hidden', cursor: 'pointer', flexShrink: 0, backgroundColor: '#f8fafc' }}
                    onClick={() => setPreviewImage(URL.createObjectURL(file))}
                    title="Lihat Detail Foto"
                  >
                    <img src={URL.createObjectURL(file)} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Daftar Barang</label>
              <Button type="button" onClick={handleAddItem} variant="outline" style={{ padding: '4px 12px', fontSize: 13 }}>+ Tambah Barang</Button>
            </div>
            

              <Table>
                <thead>
                  <tr>
                    <th>Nama Barang</th>
                    <th style={{ width: 100 }}>Jumlah</th>
                    <th style={{ width: 80 }}>Satuan</th>
                    <th style={{ width: 160 }}>Harga Satuan (Rp)</th>
                    <th style={{ width: 50 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.item_id ? `local-item-${item.item_id}-${index}` : `local-item-${index}`}>
                      <td style={{ padding: '8px 12px' }}>
                        <Select
                          searchable
                          placeholder="Pilih Barang..."
                          value={item.item_id || ''}
                          onChange={(val) => handleUpdateItem(index, 'item_id', Number(val))}
                          options={masterItems.map((m: any) => ({ value: m.id, label: m.name }))}
                        />
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <Input 
                          type="number" 
                          min="0.1" 
                          step="any"
                          value={item.qty || ''} 
                          onKeyDown={(e) => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
                          onChange={e => handleUpdateItem(index, 'qty', Number(e.target.value))} 
                        />
                      </td>
                      <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                        <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>
                          {item.item_id ? masterItems.find(m => Number(m.id) === item.item_id)?.purchase_unit || '-' : '-'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Input 
                            type="text" 
                            value={item.price_per_unit ? item.price_per_unit.toLocaleString('id-ID') : ''} 
                            onChange={e => {
                              const rawValue = e.target.value.replace(/\D/g, '');
                              handleUpdateItem(index, 'price_per_unit', Number(rawValue));
                            }} 
                          />
                        </div>
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <button type="button" onClick={() => handleRemoveItem(index)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={4} className="center" style={{ padding: '16px', color: '#64748b' }}>Belum ada item ditambahkan.</td>
                    </tr>
                  )}
                </tbody>
              </Table>

          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: 20, marginTop: 4 }}>  
            <div>
              {items.length > 0 && (
                <div style={{ textAlign: 'left', fontWeight: 'bold', fontSize: 16 }}>
                  Total: {formatRupiah(items.reduce((s, i) => s + i.subtotal, 0))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)} disabled={submitting}>Batal</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Menyimpan...' : 'Simpan Pembelian'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Fullscreen Image Preview Overlay */}
      {previewImage && (
        <div 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center' }} 
          onClick={() => setPreviewImage(null)}
        >
          <img src={previewImage} alt="Full Preview" style={{ maxWidth: 800, width: '90%', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }} onClick={e => e.stopPropagation()} />
          <button 
            onClick={() => setPreviewImage(null)} 
            style={{ position: 'absolute', top: 20, right: 20, background: 'white', border: 'none', borderRadius: '50%', width: 40, height: 40, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            title="Tutup (Kembali)"
          >
            <X size={20} color="#0f172a" />
          </button>
        </div>
      )}

      <Toast 
        isOpen={toast.open} 
        type={toast.type}
        message={toast.message} 
        onClose={() => setToast({ ...toast, open: false })} 
      />
    </div>
  );
}
