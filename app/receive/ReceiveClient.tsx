'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Table } from '@/components/ui/Table';
import { AlertTriangle, CheckCircle, Camera } from 'lucide-react';

export default function PublicReceiveClient() {
  const searchParams = useSearchParams();
  const code = searchParams.get('kode') || '';

  interface DeliveryNoteItem {
    id: number;
    order_item_id: number;
    item_name: string;
    purchase_unit: string;
    conversion_ratio: string | number;
    qty_shipped: number;
  }

  interface DeliveryNote {
    delivery_note_number: string;
    outlet_name: string;
    delivery_date: string;
    status: string;
    items: DeliveryNoteItem[];
  }

  interface ReceiveItem {
    delivery_note_item_id: number;
    order_item_id: number;
    item_name: string;
    purchase_unit: string;
    ratio: number;
    qty_shipped_display: number;
    qty_received_display: number;
    receive_notes: string;
    has_issue?: boolean;
    qty_issue?: number;
    issue_reason?: string;
    issue_photo?: File;
    issue_photo_preview?: string;
  }

  const [dn, setDn] = useState<DeliveryNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [recipientName, setRecipientName] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [items, setItems] = useState<ReceiveItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState(false);
  const [requireBarcode, setRequireBarcode] = useState(true);

  useEffect(() => {
    if (!code) {
      setError('Kode Surat Jalan tidak valid.');
      setLoading(false);
      return;
    }
    fetch(`/api/public/receive-delivery?kode=${encodeURIComponent(code)}`)
      .then(res => res.json())
      .then(data => {
        if (!data.success) throw new Error(data.message);
        setDn(data.dn);
        if (data.requireBarcode !== undefined) {
          setRequireBarcode(data.requireBarcode);
        }
        setItems(data.dn.items.map((item: DeliveryNoteItem) => {
          const ratio = Number(item.conversion_ratio) || 1;
          return {
            delivery_note_item_id: item.id,
            order_item_id: item.order_item_id,
            item_name: item.item_name,
            purchase_unit: item.purchase_unit,
            ratio: ratio,
            qty_shipped_display: item.qty_shipped / ratio,
            qty_received_display: item.qty_shipped / ratio,
            receive_notes: '',
          };
        }));
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [code]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Ukuran foto terlalu besar. Maksimal 5 MB.');
      e.target.value = '';
      return;
    }
    setPhoto(file);
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleQtyChange = (orderItemId: number, value: number) => {
    setItems(prev => prev.map(i => i.order_item_id === orderItemId ? { ...i, qty_received_display: value } : i));
  };

  const handleNotesChange = (orderItemId: number, value: string) => {
    setItems(prev => prev.map(i => i.order_item_id === orderItemId ? { ...i, receive_notes: value } : i));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (!recipientName.trim()) { setSubmitError('Nama penerima wajib diisi.'); return; }
    if (!photo) { setSubmitError('Foto bukti penerimaan wajib diunggah.'); return; }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('recipient_name', recipientName);
      formData.append('photo', photo);
      formData.append('items', JSON.stringify(items.map(i => ({
        delivery_note_item_id: i.delivery_note_item_id,
        order_item_id: i.order_item_id,
        qty_received: i.qty_received_display,
        receive_notes: i.receive_notes,
        has_issue: i.has_issue,
        qty_issue: i.qty_issue,
        issue_reason: i.issue_reason,
      }))));

      items.forEach((item, index) => {
        if (item.issue_photo) {
          formData.append(`issue_photo_${index}`, item.issue_photo);
        }
      });

      const res = await fetch(`/api/public/receive-delivery?kode=${encodeURIComponent(code)}`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Gagal memproses penerimaan.');
      setSuccess(true);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setSubmitError(err.message);
      } else {
        setSubmitError('An unknown error occurred');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Render States ----

  if (loading) return (
    <div style={{ height: '100vh', overflowY: 'auto', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Albert Sans, sans-serif' }}>
      <p style={{ color: '#64748b' }}>Memuat data Surat Jalan...</p>
    </div>
  );

  if (error) return (
    <div style={{ height: '100vh', overflowY: 'auto', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Albert Sans, sans-serif', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 10, padding: 24, textAlign: 'center', maxWidth: 360, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>Tidak Ditemukan</h3>
        <p style={{ color: '#64748b', margin: 0, fontSize: 13 }}>{error}</p>
      </div>
    </div>
  );

  if (success) return (
    <div style={{ height: '100vh', overflowY: 'auto', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Albert Sans, sans-serif', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 10, padding: 32, textAlign: 'center', maxWidth: 360, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h2 style={{ margin: '0 0 8px', color: '#166534', fontSize: 18 }}>Penerimaan Berhasil!</h2>
        <p style={{ color: '#64748b', margin: '0 0 6px', fontSize: 13 }}>Terima kasih telah mengkonfirmasi penerimaan barang.</p>
        <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>Anda boleh menutup halaman ini.</p>
      </div>
    </div>
  );

  if (dn && dn.status !== 'DIKIRIM' && dn.status !== 'DRAFT') return (
    <div style={{ height: '100vh', overflowY: 'auto', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Albert Sans, sans-serif', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 10, padding: 24, textAlign: 'center', maxWidth: 360, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>Tidak Dapat Diproses</h3>
        <p style={{ color: '#64748b', margin: 0, fontSize: 13 }}>Surat Jalan ini sudah berstatus <strong>{dn.status}</strong> dan tidak perlu dikonfirmasi lagi.</p>
      </div>
    </div>
  );

  return (
    <div style={{ height: '100vh', overflowY: 'auto', background: '#f1f5f9', fontFamily: 'Albert Sans, sans-serif', paddingBottom: 24 }}>
      <div style={{ maxWidth: 480, margin: '0 auto', background: '#fff', borderRadius: '0 0 10px 10px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        
        {/* Header - compact */}
        <div style={{ background: '#016e3f', padding: '12px 16px', color: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Konfirmasi Penerimaan</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>{dn?.delivery_note_number}</div>
          </div>
        </div>

        {/* Info Surat Jalan */}
        <div style={{ padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <div style={{ color: '#64748b', fontSize: 11, marginBottom: 2 }}>Tujuan</div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{dn?.outlet_name}</div>
          </div>
          <div>
            <div style={{ color: '#64748b', fontSize: 11, marginBottom: 2 }}>Tanggal Kirim</div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{dn ? new Date(dn.delivery_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}</div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: 16 }}>
          {submitError && (
            <div style={{ background: '#fee2e2', color: '#991b1b', padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontSize: 13 }}>
              {submitError}
            </div>
          )}

          {/* Nama Penerima */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 5, fontSize: 13 }}>
              Nama Penerima <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <Input
              type="text"
              placeholder="Masukkan nama Anda..."
              value={recipientName}
              onChange={e => setRecipientName(e.target.value)}
              disabled={submitting}
              required
            />
          </div>

          {/* Foto Bukti */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 5, fontSize: 13 }}>
              Foto Bukti {requireBarcode && <span style={{ color: '#dc2626' }}>*</span>}
              {!requireBarcode && <span style={{ color: '#64748b', fontWeight: 'normal', marginLeft: 4 }}>(Opsional)</span>}
            </label>
            <label htmlFor="photo-input" style={{ display: 'block', border: '1.5px dashed #cbd5e1', borderRadius: 8, padding: 10, textAlign: 'center', cursor: 'pointer', background: photoPreview ? '#f0fdf4' : '#f8fafc' }}>
              {photoPreview ? (
                <img src={photoPreview} alt="Preview" style={{ maxWidth: '100%', maxHeight: 120, borderRadius: 6, objectFit: 'cover' }} />
              ) : (
                <>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 4px', display: 'block' }}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  <p style={{ color: '#64748b', margin: '0 0 2px', fontWeight: 600, fontSize: 13 }}>Ketuk untuk ambil foto</p>
                  <p style={{ color: '#94a3b8', margin: 0, fontSize: 11 }}>Gunakan kamera HP Anda</p>
                </>
              )}
            </label>
            <input id="photo-input" type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} style={{ display: 'none' }} />
          </div>

          {/* Daftar Barang */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13, borderTop: '1px solid #e2e8f0', paddingTop: 12, color: '#374151' }}>Daftar Barang</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((item, index) => (
                <div key={item.order_item_id} style={{ border: `1px solid ${item.has_issue ? '#fca5a5' : '#e2e8f0'}`, borderRadius: 8, padding: 12, background: 'white', marginBottom: 12, boxShadow: item.has_issue ? '0 0 0 1px #fef2f2' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{item.item_name}</span>
                    <span style={{ color: '#64748b', fontSize: 13 }}>Total: {item.qty_shipped_display} {item.purchase_unit}</span>
                  </div>
                  
                  <div style={{ display: 'flex', gap: 8, marginBottom: item.has_issue ? 12 : 0 }}>
                    <button 
                      type="button"
                      onClick={() => setItems(prev => prev.map(i => i.order_item_id === item.order_item_id ? { ...i, has_issue: false, qty_received_display: i.qty_shipped_display, qty_issue: undefined, issue_reason: undefined, issue_photo: undefined, issue_photo_preview: undefined } : i))}
                      style={{ flex: 1, background: item.has_issue ? 'white' : '#f1f5f9', border: `1px solid ${item.has_issue ? '#cbd5e1' : '#94a3b8'}`, borderRadius: 6, padding: 8, color: item.has_issue ? '#94a3b8' : '#334155', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: item.has_issue ? 400 : 600 }}>
                      {!item.has_issue && <CheckCircle size={14} color="#16a34a" />}
                      {item.has_issue ? 'Semua Baik' : 'Semua Diterima Baik'}
                    </button>
                    <button 
                      type="button"
                      onClick={() => setItems(prev => prev.map(i => i.order_item_id === item.order_item_id ? { ...i, has_issue: true } : i))}
                      style={{ flex: 1, background: item.has_issue ? '#fef2f2' : 'white', border: `1px solid ${item.has_issue ? '#f87171' : '#cbd5e1'}`, borderRadius: 6, padding: 8, color: item.has_issue ? '#b91c1c' : '#94a3b8', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: item.has_issue ? 600 : 400 }}>
                      <AlertTriangle size={14} color={item.has_issue ? "#b91c1c" : "#94a3b8"} />
                      Ada Masalah
                    </button>
                  </div>

                  {item.has_issue && (
                    <div style={{ background: '#fef2f2', padding: 12, borderRadius: 6 }}>
                      <label style={{ fontSize: 12, color: '#991b1b', fontWeight: 700, display: 'block', marginBottom: 4 }}>Jumlah Rusak / Kurang:</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
                        <Input
                          type="number" step="0.01" min="0.01" max={item.qty_shipped_display}
                          value={item.qty_issue || ''}
                          onChange={e => setItems(prev => prev.map(i => i.order_item_id === item.order_item_id ? { ...i, qty_issue: parseFloat(e.target.value) || 0, qty_received_display: i.qty_shipped_display - (parseFloat(e.target.value) || 0) } : i))}
                          disabled={submitting} required
                          style={{ borderColor: '#fca5a5', background: 'white', flex: 1 }}
                        />
                        <span style={{ fontSize: 12, color: '#991b1b' }}>{item.purchase_unit}</span>
                      </div>
                      
                      <label style={{ fontSize: 12, color: '#991b1b', fontWeight: 700, display: 'block', marginBottom: 4 }}>Alasan / Catatan:</label>
                      <select 
                        value={item.issue_reason || ''}
                        onChange={e => setItems(prev => prev.map(i => i.order_item_id === item.order_item_id ? { ...i, issue_reason: e.target.value } : i))}
                        disabled={submitting} required
                        style={{ width: '100%', padding: '8px 12px', border: '1px solid #fca5a5', borderRadius: 6, marginBottom: 8, background: 'white', fontSize: 13, color: '#1e293b' }}>
                        <option value="">-- Pilih Alasan --</option>
                        <option value="Pecah di perjalanan">Pecah di perjalanan</option>
                        <option value="Kemasan bocor/rusak">Kemasan bocor/rusak</option>
                        <option value="Barang kurang dari DO">Barang kurang dari DO</option>
                        <option value="Basi / Tidak layak">Basi / Tidak layak</option>
                        <option value="Lainnya">Lainnya...</option>
                      </select>
                      
                      <label style={{ fontSize: 12, color: '#991b1b', fontWeight: 700, display: 'block', marginBottom: 4 }}>Upload Foto Bukti:</label>
                      <label htmlFor={`issue-photo-${item.order_item_id}`} style={{ border: '1px dashed #f87171', padding: 12, textAlign: 'center', borderRadius: 4, background: 'white', color: '#ef4444', fontSize: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
                        {item.issue_photo_preview ? (
                          <img src={item.issue_photo_preview} alt="Preview" style={{ maxWidth: '100%', maxHeight: 100, borderRadius: 4, objectFit: 'cover' }} />
                        ) : (
                          <>
                            <Camera size={18} style={{ marginBottom: 4 }} />
                            <span>Ambil Foto (Wajib)</span>
                          </>
                        )}
                      </label>
                      <input 
                        id={`issue-photo-${item.order_item_id}`} type="file" accept="image/*" capture="environment" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 5 * 1024 * 1024) {
                            alert('Ukuran foto terlalu besar. Maksimal 5 MB.');
                            e.target.value = '';
                            return;
                          }
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setItems(prev => prev.map(i => i.order_item_id === item.order_item_id ? { ...i, issue_photo: file, issue_photo_preview: reader.result as string } : i));
                          };
                          reader.readAsDataURL(file);
                        }} 
                        style={{ display: 'none' }} 
                        required={!item.issue_photo}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            disabled={submitting}
            style={{ width: '100%', display: 'flex', justifyContent: 'center', fontSize: 14, padding: '11px 16px' }}
          >
            {submitting ? 'Menyimpan...' : '✓ Terima Barang Sekarang'}
          </Button>
        </form>
      </div>
    </div>
  );
}
