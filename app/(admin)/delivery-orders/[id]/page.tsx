'use client';
import { useState, useEffect, useCallback, useRef, use } from 'react';

import Link from 'next/link';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Toast } from '@/components/ui/Toast';
import { FullScreenLoader } from '@/components/ui/FullScreenLoader';
import { FileText, Printer } from 'lucide-react';
import bwipjs from 'bwip-js';

interface DeliveryNoteItem {
  id: number;
  item_id: number;
  item_name: string;
  qty_shipped: string | number;
  qty_received?: string | number | null;
  conversion_ratio?: string | number | null;
  purchase_unit: string;
  smallest_unit: string;
  unique_barcode?: string | null;
  barcode?: string | null;
  scanned_out_at?: string | null;
  scanned_in_at?: string | null;
  additional_notes?: string;
  keterangan?: string;
  receive_notes?: string;
  discrepancy_reason?: string;
  price_at_shipment?: string | number;
}

interface DeliveryNote {
  id: number;
  delivery_note_number: string;
  status: string;
  order_id: number;
  order_number?: string;
  delivery_date: string;
  driver_name: string;
  proof_image_url?: string;
  items: DeliveryNoteItem[];
  outlet_name: string;
  recipient_name?: string;
  created_at: string;
}

const QrCodeRender = ({ text, size = 44 }: { text: string, size?: number }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvasRef.current && text) {
      try {
        bwipjs.toCanvas(canvasRef.current, {
          bcid: 'qrcode',
          text: text,
          scale: 3,
          includetext: false,
        });
      } catch (e) {
      }
    }
  }, [text]);
  return <canvas ref={canvasRef} style={{ width: size, height: size, borderRadius: 4, display: 'block' }} title={text} />;
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#16a34a' : 'var(--primary)', padding: 4, display: 'flex', alignItems: 'center', transition: 'color 0.2s' }}
      title="Copy tracking code"
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
      )}
    </button>
  );
}

export default function DeliveryOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [dn, setDn] = useState<DeliveryNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanMessage, setScanMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [confirmBulk, setConfirmBulk] = useState<{ open: boolean; type: 'OUT' | 'IN' | null }>({ open: false, type: null });
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [toastInfo, setToastInfo] = useState<{ show: boolean, msg: string, type: 'success' | 'error' | 'info' }>({ show: false, msg: '', type: 'info' });
  const [confirmShipAll, setConfirmShipAll] = useState(false);
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState(false);
  const [requireBarcode, setRequireBarcode] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const dnStatusRef = useRef<string | null>(null);

  const fetchDn = useCallback(async () => {
    setLoading(true);
    const [res, setRes] = await Promise.all([
      fetch(`/api/delivery-notes/${id}`),
      fetch('/api/settings')
    ]);
    if (res.ok) {
      const data = await res.json();
      setDn(data.data);
      dnStatusRef.current = data.data?.status ?? null;
    }
    if (setRes.ok) {
      const setData = await setRes.json();
      setRequireBarcode(setData.data?.require_barcode_scan !== 'false');
    }
    setLoading(false);
  }, [id]);

  // Silent refresh tanpa loading spinner — untuk polling real-time
  const fetchDnSilent = useCallback(async () => {
    try {
      const res = await fetch(`/api/delivery-notes/${id}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setDn(data.data);
        dnStatusRef.current = data.data?.status ?? null;
      }
    } catch { /* abaikan error polling */ }
  }, [id]);

  useEffect(() => { fetchDn(); }, [fetchDn]);

  // Polling real-time: refresh setiap 3 detik dan saat tab kembali aktif
  // Berhenti otomatis jika DO sudah final (DITERIMA)
  useEffect(() => {
    const interval = setInterval(() => {
      if (dnStatusRef.current !== 'DITERIMA') fetchDnSilent();
    }, 3000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && dnStatusRef.current !== 'DITERIMA') {
        fetchDnSilent();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchDnSilent]);

  // Keep focus on input for physical barcode scanner guns
  useEffect(() => {
    if (dn && dn.status !== 'DITERIMA') {
      inputRef.current?.focus();
    }
  }, [dn]);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dn) return;
    const inputTrimmed = barcodeInput.trim();
    if (inputTrimmed === dn.delivery_note_number) {
      setConfirmBulk({ open: true, type: 'OUT' });
      setBarcodeInput('');
      return;
    }

    // Find the item matching this barcode that hasn't been scanned OUT yet
    const targetItem = dn.items.find((i: DeliveryNoteItem) => (i.unique_barcode === inputTrimmed || i.barcode === inputTrimmed) && !i.scanned_out_at);

    if (!targetItem) {
      const alreadyScanned = dn.items.find((i: DeliveryNoteItem) => (i.unique_barcode === barcodeInput.trim() || i.barcode === barcodeInput.trim()) && i.scanned_out_at);
      if (alreadyScanned) {
        setScanMessage({ type: 'error', text: `Barang dengan barcode ${barcodeInput} sudah di-scan OUT.` });
      } else {
        setScanMessage({ type: 'error', text: `Barcode ${barcodeInput} tidak ditemukan dalam Surat Jalan ini.` });
      }
      setBarcodeInput('');
      return;
    }

    setScanning(true);
    setScanMessage(null);
    try {
      const res = await fetch(`/api/delivery-notes/${targetItem.id}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delivery_note_item_id: targetItem.id,
          item_id: targetItem.item_id,
          barcode_scanned: barcodeInput.trim(),
          scan_type: 'OUT',
          scanned_by: 1, // Central Admin ID
          device_info: 'Web Admin'
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      setScanMessage({ type: 'success', text: `Berhasil scan OUT: ${targetItem.item_name}` });
      await fetchDn(); // Refresh list to update scanned status
    } catch (err: unknown) {
      setScanMessage({ type: 'error', text: (err instanceof Error ? err.message : 'Unknown error') });
    } finally {
      setScanning(false);
      setBarcodeInput('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleBulkScan = async () => {
    if (!confirmBulk.type) return;
    const scanType = confirmBulk.type;

    setScanning(true);
    setScanMessage(null);
    try {
      const res = await fetch(`/api/delivery-notes/${id}/bulk-scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanType: scanType })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      setScanMessage({ type: 'success', text: data.message });
      await fetchDn();
      setConfirmBulk({ open: false, type: null });
    } catch (err: unknown) {
      setScanMessage({ type: 'error', text: (err instanceof Error ? err.message : 'Unknown error') });
    } finally {
      setScanning(false);
    }
  };
  const handleShipAll = async () => {
    setConfirmShipAll(false);
    setScanning(true);
    try {
      const res = await fetch(`/api/delivery-notes/${id}/ship-all`, { method: 'POST' });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      setScanMessage({ type: 'success', text: data.message });
      await fetchDn();
    } catch (err: unknown) {
      setScanMessage({ type: 'error', text: (err instanceof Error ? err.message : 'Unknown error') });
    } finally {
      setScanning(false);
    }
  };

  const handleApproveAndTransfer = async () => {
    setConfirmApprove(false);
    setScanning(true);
    setScanMessage(null);
    try {
      const res = await fetch(`/api/delivery-notes/${id}/approve-transfer`, { method: 'POST' });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      setScanMessage({ type: 'success', text: data.message });
      await fetchDn();
    } catch (err: unknown) {
      setScanMessage({ type: 'error', text: (err instanceof Error ? err.message : 'Unknown error') });
    } finally {
      setScanning(false);
    }
  };

  const handleCancel = async () => {
    setScanning(true);
    try {
      const res = await fetch(`/api/delivery-notes/${id}/cancel`, { method: 'POST' });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      await fetchDn();
      setConfirmCancel(false);
      setToastInfo({ show: true, msg: 'Surat jalan dibatalkan', type: 'success' });
    } catch (err: unknown) {
      setToastInfo({ show: true, msg: (err instanceof Error ? err.message : 'Unknown error'), type: 'error' });
    } finally {
      setScanning(false);
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Memuat Surat Jalan...</div>;
  if (!dn) return <div style={{ padding: 40, textAlign: 'center' }}>Surat Jalan tidak ditemukan.</div>;

  const totalItems = dn.items.length;
  const scannedOutItems = dn.items.filter((i: DeliveryNoteItem) => i.scanned_out_at).length;
  const isFullyScannedOut = scannedOutItems === totalItems && totalItems > 0;

  return (
    <>
      {toastInfo.show && <Toast isOpen={true} message={toastInfo.msg} type={toastInfo.type} onClose={() => setToastInfo({ ...toastInfo, show: false })} />}
      <FullScreenLoader open={scanning} label="Mohon tunggu sebentar, data sedang diproses." />

      <section className="screen">
        <div className="card">
        <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: 24 }}>{dn.delivery_note_number}</h3>
              <div style={{ marginTop: 8, display: 'flex', gap: 12, alignItems: 'center' }}>
                <Badge variant={dn.status === 'DITERIMA' ? 'green' : dn.status === 'DIKIRIM' ? 'blue' : dn.status === 'DIBATALKAN' ? 'red' : 'gray'}>
                  {dn.status === 'DIBATALKAN' ? 'Dibatalkan' :
                    dn.status === 'DITERIMA' ? 'Diterima' :
                      dn.status === 'DIKIRIM' ? 'Dikirim' :
                        dn.status === 'DRAFT' ? 'Draft' : dn.status}
                </Badge>
                <span className="muted">Ke: {dn.outlet_name}</span>
                {dn.order_number && (
                  <>
                    <span className="muted">&bull;</span>
                    <span className="muted">PO: {dn.order_number}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/delivery-orders">
              <Button variant="outline" size="sm">Kembali</Button>
            </Link>
            {dn.status === 'DRAFT' && (
              <Button variant="outline" size="sm" onClick={() => setConfirmCancel(true)} disabled={scanning} style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                Batalkan
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={() => window.open(`/api/delivery-notes/${id}/pdf`, '_blank')} style={{ display: 'flex', alignItems: 'center' }}>
              <Printer size={14} style={{ marginRight: 6 }} />
              Cetak PDF
            </Button>
          </div>
        </div>

        <div className="card-body flush">
          {dn.status === 'DRAFT' && (
            <div style={{ padding: 24, background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
              {!requireBarcode ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ marginBottom: 4 }}>Pengiriman Langsung</h4>
                    <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>Scan barcode dinonaktifkan. Anda bisa langsung mengirim pesanan.</p>
                  </div>
                  <Button variant="primary" onClick={() => setConfirmShipAll(true)} disabled={scanning} style={{ padding: '0 24px', height: 40 }}>
                    {scanning ? 'Memproses...' : 'Kirim Semua Barang'}
                  </Button>
                </div>
              ) : (
                <>
                  <h4 style={{ marginBottom: 12 }}>Pemindai Barcode (OUT)</h4>
                  <form onSubmit={handleScan} style={{ display: 'flex', gap: 12, maxWidth: 600 }}>
                    <Input
                      ref={inputRef}
                      type="text"
                      placeholder="Pindai barcode di sini..."
                      value={barcodeInput}
                      onChange={e => setBarcodeInput(e.target.value)}
                      disabled={scanning}
                      autoFocus
                    />
                    <Button type="submit" variant="primary" disabled={scanning || !barcodeInput.trim()}>
                      Pindai Manual
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setConfirmBulk({ open: true, type: 'OUT' })} disabled={scanning} style={{ color: 'var(--primary)', borderColor: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="13 17 18 12 13 7"></polyline><polyline points="6 17 11 12 6 7"></polyline></svg>
                      Validasi Semua
                    </Button>
                  </form>
                  <p className="muted" style={{ fontSize: 12, marginTop: 12, marginBottom: 0 }}>Pastikan kursor berada di kotak input saat menggunakan mesin scanner fisik.</p>
                </>
              )}
            </div>
          )}

          {dn.status === 'DIKIRIM' && (
            <div style={{ padding: 24, background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
              <h4 style={{ marginBottom: 12 }}>Konfirmasi Penerimaan Barang</h4>
              <div style={{ padding: '12px 16px', background: '#ecfdf5', color: '#065f46', borderRadius: 6, fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8, flexShrink: 0 }}><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                <span><strong>Status: DIKIRIM.</strong> Tekan tombol di bawah untuk menyetujui penerimaan. Stok Pusat akan berkurang dan stok Outlet akan bertambah otomatis.</span>
              </div>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Button 
                  type="button" 
                  variant="primary" 
                  onClick={() => setConfirmApprove(true)} 
                  disabled={scanning} 
                  style={{ display: 'flex', alignItems: 'center', background: '#016e3f', color: '#fff', border: 'none', fontWeight: 600 }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8 }}>
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                  {scanning ? 'Memproses...' : 'Terima Semua Barang'}
                </Button>
              </div>
            </div>
          )}

          <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24, borderBottom: '1px solid var(--border)' }}>
            <div>
              <p className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Referensi Pesanan (PO)</p>
              <div className="font-bold">
                {dn.order_number || (dn.order_id ? `PO-${new Date(dn.created_at).getFullYear()}-${String(dn.order_id).padStart(5, '0')}` : '-')}
              </div>
            </div>
            <div>
              <p className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Outlet Tujuan</p>
              <div className="font-bold">{dn.outlet_name}</div>
            </div>
            <div>
              <p className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Tanggal Pengiriman</p>
              <div className="font-bold">{new Date(dn.delivery_date).toLocaleDateString('id-ID')}</div>
            </div>
            <div>
              <p className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Nama Pengirim</p>
              <div className="font-bold">{dn.driver_name || '-'}</div>
            </div>
            <div>
              <p className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Diterima Oleh</p>
              <div className="font-bold">{dn.recipient_name || '-'}</div>
            </div>
            {dn.proof_image_url && (
              <div>
                <p className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Bukti Penerimaan</p>
                <button type="button" onClick={() => setViewingPhoto(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 13, color: 'var(--primary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                  Lihat Foto
                </button>
              </div>
            )}
            <div>
              <p className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Kode Pelacakan</p>
              <div className="font-bold font-mono" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {dn.delivery_note_number}
                <CopyButton text={dn.delivery_note_number} />
              </div>
            </div>
          </div>

          <Table>
            <thead>
              <tr>
                <th>BARANG</th>
                <th>CATATAN</th>
                <th className="right">DIKIRIM</th>
                <th className="right">DITERIMA</th>
                <th className="right">HARGA/UNIT</th>
                <th className="right">TOTAL BIAYA</th>
                <th className="center">SCAN OUT</th>
                <th className="center">SCAN IN</th>
              </tr>
            </thead>
            <tbody>
              {dn.items.map((item: DeliveryNoteItem) => (
                <tr key={item.id}>
                  <td className="font-bold">
                    {item.item_name}
                  </td>
                  <td>
                    {item.additional_notes && <div style={{ fontSize: 12, marginBottom: 4 }}><span className="muted"></span> {item.additional_notes}</div>}
                    {item.keterangan && <div style={{ fontSize: 12, marginBottom: 4 }}><span className="muted">SJ:</span> {item.keterangan}</div>}
                    {item.receive_notes && <div style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 600 }}><span className="muted">Penerima:</span> {item.receive_notes}</div>}
                    {item.discrepancy_reason && <div style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 600 }}><span className="muted">Selisih:</span> {item.discrepancy_reason}</div>}
                    {!item.additional_notes && !item.keterangan && !item.receive_notes && !item.discrepancy_reason && <span className="muted italic" style={{ fontSize: 13 }}>-</span>}
                  </td>
                  <td className="right font-bold num">
                    {parseFloat((Number(item.qty_shipped) / (Number(item.conversion_ratio) || 1)).toFixed(3)).toLocaleString('id-ID')} {item.purchase_unit}
                  </td>
                  <td className="right font-bold num" style={{ color: item.qty_received != null && item.qty_received !== item.qty_shipped ? 'var(--danger)' : 'inherit' }}>
                    {item.qty_received != null ? (
                      <>{parseFloat((Number(item.qty_received) / (Number(item.conversion_ratio) || 1)).toFixed(3)).toLocaleString('id-ID')} {item.purchase_unit}</>
                    ) : (
                      <span className="muted">-</span>
                    )}
                  </td>
                  <td className="right font-bold num">
                    Rp {Math.round(Number(item.price_at_shipment || 0) * (Number(item.conversion_ratio) || 1)).toLocaleString('id-ID')}
                  </td>
                  <td className="right font-bold num" style={{ color: 'var(--primary)' }}>
                    Rp {Math.round((Number(item.qty_shipped) / (Number(item.conversion_ratio) || 1)) * (Number(item.price_at_shipment || 0) * (Number(item.conversion_ratio) || 1))).toLocaleString('id-ID')}
                  </td>
                  <td className="center">
                    {item.scanned_out_at ? (
                      <span style={{ color: 'var(--primary)', fontWeight: 600, fontSize: 13, display: 'inline-flex', alignItems: 'center' }}>
                        {new Date(item.scanned_out_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    ) : (
                      <span className="muted">-</span>
                    )}
                  </td>
                  <td className="center">
                    {item.scanned_in_at ? (
                      <span style={{ color: 'var(--primary)', fontWeight: 600, fontSize: 13, display: 'inline-flex', alignItems: 'center' }}>
                        {new Date(item.scanned_in_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    ) : (
                      <span className="muted" style={{ fontSize: 13 }}>-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </div>

      <ConfirmDialog
        open={confirmBulk.open}
        title={confirmBulk.type === 'OUT' ? 'Validasi Pengiriman' : 'Validasi Penerimaan'}
        message={`Apakah Anda yakin ingin melakukan Validasi Massal?`}
        onConfirm={handleBulkScan}
        onCancel={() => setConfirmBulk({ open: false, type: null })}
        loading={scanning}
      />

      <ConfirmDialog
        open={confirmCancel}
        title="Batalkan Surat Jalan"
        message="Apakah Anda yakin ingin membatalkan Surat Jalan ini?"
        danger={true}
        onConfirm={handleCancel}
        onCancel={() => setConfirmCancel(false)}
        loading={scanning}
      />

      <ConfirmDialog
        open={confirmShipAll}
        title="Pengiriman Langsung"
        message="Apakah Anda yakin ingin langsung mengirim?"
        onConfirm={handleShipAll}
        onCancel={() => setConfirmShipAll(false)}
        loading={scanning}
      />

      <ConfirmDialog
        open={confirmApprove}
        title="Approve & Transfer Stok"
        message="Setujui pengiriman barang ke outlet ini?"
        onConfirm={handleApproveAndTransfer}
        onCancel={() => setConfirmApprove(false)}
        loading={scanning}
      />

      <Toast
        isOpen={!!scanMessage}
        message={scanMessage?.text || ''}
        type={scanMessage?.type || 'info'}
        onClose={() => setScanMessage(null)}
      />

      {/* Inline Photo Viewer Overlay */}
      {viewingPhoto && dn.proof_image_url && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: 'rgba(0,0,0,0.92)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <button
            onClick={() => setViewingPhoto(false)}
            style={{
              position: 'absolute', top: 20, left: 20,
              background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8,
              color: '#fff', cursor: 'pointer', padding: '8px 16px',
              fontSize: 14, display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
            Kembali
          </button>
          <img
            src={dn.proof_image_url}
            alt="Proof of delivery"
            style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
          />
        </div>
      )}
    </section>
    </>
  );
}
