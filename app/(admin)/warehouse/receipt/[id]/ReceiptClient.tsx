'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { Toast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface POItem {
  id: number;
  item_id: number;
  description: string;
  qty: number;
  unit_price: number;
  total_received?: number;
  purchase_unit?: string;
}

interface PO {
  id: number;
  po_number: string;
  vendor_name: string;
  order_date?: string;
  order_deadline?: string;
  destination_outlet_name?: string;
  status: string;
  items: POItem[];
}

export default function ReceiptClient({ poId }: { poId: number }) {
  const router = useRouter();
  const [po, setPo] = useState<PO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [receivedQtys, setReceivedQtys] = useState<Record<number, string>>({});
  const [deliveryNote, setDeliveryNote] = useState('');
  const [receiptDate, setReceiptDate] = useState(() => {
    const tzOffset = (new Date()).getTimezoneOffset() * 60000;
    return (new Date(Date.now() - tzOffset)).toISOString().split('T')[0];
  });
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as 'success' | 'error' });

  useEffect(() => {
    fetch(`/api/purchase-orders/${poId}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setPo(d.data);
          const initialQtys: Record<number, string> = {};
          d.data.items.forEach((item: any) => {
            if (item.line_type === 'PRODUK') {
              initialQtys[item.id] = '';
            }
          });
          setReceivedQtys(initialQtys);
        } else {
          setError(d.message);
        }
      })
      .finally(() => setLoading(false));
  }, [poId]);

  const handleQtyChange = (id: number, value: string) => {
    // Allow digits, single comma or dot for decimals
    if (value === '' || /^[0-9]+([.,][0-9]*)?$/.test(value)) {
      // We store the raw string the user types to allow '4.' or '4,5' naturally
      setReceivedQtys(prev => ({ ...prev, [id]: value }));
    }
  };

  const handleApproveAll = () => {
    if (!po) return;
    const newQtys = { ...receivedQtys };
    po.items.forEach(item => {
      if (item.item_id) {
        const remaining = item.qty - (Number(item.total_received) || 0);
        if (remaining > 0) {
          newQtys[item.id] = String(remaining);
        }
      }
    });
    setReceivedQtys(newQtys);
  };

  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [pendingPayload, setPendingPayload] = useState<any>(null);

  async function submitReceipt(payload: any) {
    setSaving(true);
    setError('');
    
    try {
      const res = await fetch('/api/warehouse/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.message);
      
      setToast({ isOpen: true, message: 'Penerimaan barang berhasil!', type: 'success' });
      setShowConfirm(false);
      setSaving(false);
      
      router.refresh();
      setTimeout(() => {
        router.push('/warehouse');
      }, 1000);
    } catch (err: unknown) {
      setToast({ isOpen: true, message: err instanceof Error ? err.message : 'Unknown error', type: 'error' });
      setSaving(false);
    }
  }

  function handleValidate() {
    if (!po) return;
    
    let hasShortfall = false;
    let hasExcess = false;
    let totalReceived = 0;
    const itemsPayload = [];
    
    for (const item of po.items) {
      if (item.item_id) {
        const rawStr = receivedQtys[item.id] || '';
        // Convert comma to dot for parsing
        const rQty = Number(rawStr.replace(/,/g, '.')) || 0;
        
        const receivedSoFar = Number(item.total_received) || 0;
        const remainingQty = item.qty - receivedSoFar;
        
        totalReceived += rQty;
        // Hanya yang diinput rQty lebih besar dari 0 yang akan divalidasi kekurangan/kelebihannya
        if (rQty > 0) {
          if (rQty < remainingQty) hasShortfall = true;
          if (rQty > remainingQty) hasExcess = true;
        } else if (remainingQty > 0) {
          // Jika ada sisa barang yang tidak diinput sama sekali di sesi ini, berarti shortfall
          hasShortfall = true;
        }
        
        if (rQty > 0) {
          itemsPayload.push({
            purchase_order_item_id: item.id,
            item_id: item.item_id,
            qty_received: rQty
          });
        }
      }
    }
    
    if (totalReceived === 0) {
      setToast({ isOpen: true, message: 'Belum ada barang yang diterima. Isi kuantitas minimal 1.', type: 'error' });
      return;
    }

    const payload = {
      purchase_order_id: po.id,
      vendor_delivery_note: deliveryNote,
      received_date: receiptDate,
      items: itemsPayload
    };
    
    let msg = '';
    if (hasExcess && hasShortfall) {
      msg = 'Jumlah barang tidak sesuai pesanan (kurang dan berlebih). Lanjutkan?';
    } else if (hasExcess) {
      msg = 'Terdapat barang yang melebihi pesanan. Lanjutkan?';
    } else if (hasShortfall) {
      msg = 'Ada barang belum lengkap (otomatis masuk Backorder). Lanjutkan?';
    }

    if (msg) {
      setConfirmMessage(msg);
      setPendingPayload(payload);
      setShowConfirm(true);
      return;
    }
    
    submitReceipt(payload);
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Memuat data PO...</div>;
  if (error && !po) return (
    <div className="empty-state" style={{ marginTop: 40 }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <h4 style={{ color: '#dc2626' }}>Terjadi Kesalahan</h4>
      <p>{error}</p>
    </div>
  );
  if (!po) return null;

  return (
    <section className="screen">
      <Toast 
        isOpen={toast.isOpen} 
        message={toast.message} 
        type={toast.type} 
        onClose={() => setToast({ ...toast, isOpen: false })} 
      />

      <div className="card">
        <div className="card-head" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={() => router.back()} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--primary)', fontWeight: 600, alignSelf: 'flex-start', padding: 0, fontSize: 14 }}>&larr; Kembali</button>
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--primary)' }}>Penerimaan: {po.po_number}</h3>
          </div>
          <button 
            className="btn btn-primary"
            onClick={handleValidate}
            disabled={saving}
            style={{ fontWeight: 600, padding: '8px 24px' }}
          >
            {saving ? 'Menyimpan...' : 'Validasi Penerimaan'}
          </button>
        </div>
        
        <div className="card-body flush" style={{ padding: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24, marginBottom: 32 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Vendor</label>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{po.vendor_name}</div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Tgl. Pemesanan</label>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{po.order_date ? new Date(po.order_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Batas Tiba</label>
              <div style={{ fontWeight: 600, fontSize: 14, color: po.order_deadline && new Date(po.order_deadline) < new Date() ? 'red' : 'inherit' }}>{po.order_deadline ? new Date(po.order_deadline).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Tujuan Kirim</label>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{po.destination_outlet_name || 'Gudang Pusat'}</div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Tgl. Tiba (Diterima)</label>
              <input 
                className="input"
                type="date" 
                value={receiptDate}
                onChange={e => setReceiptDate(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', fontSize: 14 }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>No. Surat Jalan Vendor</label>
              <input 
                className="input"
                type="text" 
                value={deliveryNote}
                onChange={e => setDeliveryNote(e.target.value)}
                placeholder="e.g. SJ-12345"
                style={{ width: '100%', padding: '6px 10px', fontSize: 14 }}
              />
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: '#1e293b' }}>Daftar Barang</h4>
            <button className="btn btn-sm btn-outline" style={{ color: 'var(--primary)', border: '1px solid var(--primary)', fontWeight: 600, background: '#fff' }} onClick={handleApproveAll}>
              Terima Semua (Sesuai PO)
            </button>
          </div>
          
          <div className="table-responsive">
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ padding: '8px 12px', fontSize: 11, color: '#64748b', textAlign: 'left' }}>PRODUK</th>
                  <th style={{ padding: '8px 12px', fontSize: 11, color: '#64748b', textAlign: 'right', width: 100 }}>DIPESAN</th>
                  <th style={{ padding: '8px 12px', fontSize: 11, color: '#64748b', textAlign: 'right', width: 120 }}>SUDAH DITERIMA</th>
                  <th style={{ padding: '8px 12px', fontSize: 11, color: '#64748b', textAlign: 'right', width: 120 }}>SISA (BACKORDER)</th>
                  <th style={{ padding: '8px 12px', fontSize: 11, color: '#64748b', textAlign: 'right', width: 150 }}>DITERIMA KALI INI</th>
                </tr>
              </thead>
              <tbody>
                {po.items.filter(i => i.item_id).map(item => {
                  const receivedSoFar = Number(item.total_received) || 0;
                  const remainingQty = item.qty - receivedSoFar;
                  return (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: '#334155', fontSize: 13 }}>
                      {item.description}
                      {receivedSoFar > 0 && remainingQty > 0 && (
                        <div style={{ fontSize: 10, color: '#b45309', marginTop: 2, fontWeight: 500 }}>
                          Menunggu pengiriman sisa barang.
                        </div>
                      )}
                    </td>
                    <td className="right" style={{ padding: '8px 12px', color: '#64748b', fontWeight: 500, fontSize: 13 }}>
                      {Number(item.qty).toLocaleString('id-ID')} <span className="muted" style={{ fontSize: 11 }}>{item.purchase_unit || 'pcs'}</span>
                    </td>
                    <td className="right" style={{ padding: '8px 12px', color: '#0f766e', fontWeight: 600, fontSize: 13 }}>
                      {receivedSoFar.toLocaleString('id-ID')} <span className="muted" style={{ fontSize: 11 }}>{item.purchase_unit || 'pcs'}</span>
                    </td>
                    <td className="right" style={{ padding: '8px 12px', color: '#b45309', fontWeight: 600, fontSize: 13 }}>
                      {remainingQty.toLocaleString('id-ID')} <span className="muted" style={{ fontSize: 11 }}>{item.purchase_unit || 'pcs'}</span>
                    </td>
                    <td className="right" style={{ padding: '6px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                        <input 
                          type="text"
                          className="input right num font-bold"
                          placeholder="0"
                          value={receivedQtys[item.id] !== undefined ? receivedQtys[item.id] : ''}
                          onChange={e => handleQtyChange(item.id, e.target.value)}
                          onFocus={e => e.target.select()}
                          disabled={remainingQty <= 0}
                          style={{ width: '60px', padding: '4px 8px', fontSize: 13, background: remainingQty <= 0 ? '#f1f5f9' : '#f8fafc', border: '1px solid #cbd5e1', cursor: remainingQty <= 0 ? 'not-allowed' : 'text' }}
                        />
                        <span className="muted" style={{ fontSize: 12, minWidth: 32, textAlign: 'left' }}>{item.purchase_unit || 'pcs'}</span>
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      <ConfirmDialog
        open={showConfirm}
        title="Konfirmasi"
        message={confirmMessage}
        confirmText="Ya, Lanjut"
        cancelText="Batal"
        loading={saving}
        onConfirm={() => {
          if (pendingPayload) submitReceipt(pendingPayload);
        }}
        onCancel={() => setShowConfirm(false)}
      />
    </section>
  );
}
