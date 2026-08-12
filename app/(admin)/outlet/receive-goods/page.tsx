'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { PackageMinus, ShieldAlert, FileQuestion } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Toast } from '@/components/ui/Toast';
import { Select } from '@/components/ui/Select';

interface DeliveryNote {
  id: number; delivery_note_number: string; status: string;
  order_id: number; delivery_date: string; driver_name: string;
  proof_image_url?: string;
}

interface DeliveryNoteItem {
  id: number;
  item_id: number;
  item_name: string;
  qty_shipped: string | number;
  qty_received?: string | number | null;
  smallest_unit: string;
  scanned_in_at?: string | null;
  unique_barcode?: string | null;
  barcode?: string | null;
  discrepancy_reason?: string | null;
}

function getDisplayFormat(qty: number, unit: string) {
  const u = (unit || '').trim().toLowerCase();
  if (['g', 'gr', 'gram'].includes(u) && qty >= 1000) return { unit: 'kg', mult: 1000, value: qty / 1000 };
  if (['ml', 'milliliter'].includes(u) && qty >= 1000) return { unit: 'Liter', mult: 1000, value: qty / 1000 };
  return { unit, mult: 1, value: qty };
}

export default function ReceiveGoodsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const scanParam = searchParams.get('scan');
  const [initialScanHandled, setInitialScanHandled] = useState(false);

  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanModal, setScanModal] = useState<DeliveryNote | null>(null);

  const [toast, setToast] = useState<{ isOpen: boolean; message: string; type: 'success' | 'error' | 'info' }>({ isOpen: false, message: '', type: 'info' });
  const [itemsList, setItemsList] = useState<DeliveryNoteItem[]>([]);

  // Row states
  const [qtys, setQtys] = useState<Record<number, number | ''>>({});
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const [discNotes, setDiscNotes] = useState<Record<number, string>>({});
  const [discCategories, setDiscCategories] = useState<Record<number, string>>({});

  // Finalization states
  const [processing, setProcessing] = useState(false);
  const [proofImage, setProofImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handlePhotoChange(file: File | undefined) {
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      setToast({ isOpen: true, message: 'Ukuran foto terlalu besar. Maksimal 5 MB.', type: 'error' });
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    
    setProofImage(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  const [requireBarcode, setRequireBarcode] = useState(true);

  const fetchNotes = useCallback(async (isQuiet = false) => {
    if (!isQuiet) setLoading(true);
    try {
      const [res, setRes] = await Promise.all([
        fetch(`/api/delivery-notes`, { cache: 'no-store' }),
        fetch('/api/settings', { cache: 'no-store' })
      ]);
      if (res.ok) {
        const data = await res.json();
        const allowed = (data.data ?? []).filter((d: DeliveryNote) => d.status === 'DIKIRIM' || d.status === 'DITERIMA' || d.status === 'DRAFT');
        setDeliveryNotes(allowed);
      }

      if (setRes.ok) {
        const setData = await setRes.json();
        setRequireBarcode(setData.data?.require_barcode_scan !== 'false');
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (!isQuiet) setLoading(false);
    }
  }, []);

  useEffect(() => { 
    fetchNotes(false);
    const interval = setInterval(() => {
      fetchNotes(true);
    }, 3000);
    const handleFocus = () => {
      fetchNotes(true);
    };
    window.addEventListener('focus', handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchNotes]);

  useEffect(() => {
    if (deliveryNotes.length > 0 && scanParam && !initialScanHandled) {
      const dn = deliveryNotes.find(d => d.delivery_note_number === scanParam);
      if (dn) {
        openScan(dn);
      } else {
        setToast({ isOpen: true, message: `Surat Jalan ${scanParam} tidak ditemukan atau bukan berstatus DIKIRIM.`, type: 'error' });
      }
      setInitialScanHandled(true);
      // Remove query param from url
      router.replace('/outlet/receive-goods');
    }
  }, [deliveryNotes, scanParam, initialScanHandled, router]);

  async function openScan(dn: DeliveryNote) {
    if (dn.status === 'DRAFT') {
      setToast({ isOpen: true, message: 'Surat Jalan ini masih disiapkan oleh Pusat dan belum dikirim. Silakan tunggu statusnya menjadi DIKIRIM.', type: 'info' });
      return;
    }

    setScanModal(dn);
    setToast({ ...toast, isOpen: false });
    setProofImage(null);
    setPreviewUrl(dn.proof_image_url || null);
    setQtys({});
    setReasons({});
    setDiscNotes({});
    setDiscCategories({});

    const res = await fetch(`/api/delivery-notes/${dn.id}`);
    const data = await res.json();
    setItemsList(data.data?.items ?? []);
  }

  async function handleCompleteReceipt(e: React.FormEvent) {
    e.preventDefault();
    if (!scanModal) return;

    if (requireBarcode && !proofImage && !previewUrl) {
      setToast({ isOpen: true, message: 'Foto bukti penerimaan wajib diunggah.', type: 'error' });
      return;
    }

    // Validate inputs
    for (const item of itemsList) {
      if (item.scanned_in_at) continue;

      const inputQty = qtys[item.id];
      if (inputQty === undefined || inputQty === '' || inputQty < 0) {
        setToast({ isOpen: true, message: `Harap masukkan Kuantitas Aktual untuk ${item.item_name}.`, type: 'error' });
        return;
      }

      const shippedFmt = getDisplayFormat(Number(item.qty_shipped), item.smallest_unit);
      const actualQtyReceivedBase = Number(inputQty) * shippedFmt.mult;
      const isDiscrepancy = actualQtyReceivedBase !== Number(item.qty_shipped);
      const categoryStr = discCategories[item.id] || '';
      const notesStr = discNotes[item.id] || '';

      if (isDiscrepancy) {
        if (!categoryStr) {
          setToast({ isOpen: true, message: `Jenis masalah wajib dipilih untuk ${item.item_name}.`, type: 'error' });
          return;
        }
        if (categoryStr === 'Lainnya' && !notesStr.trim()) {
          setToast({ isOpen: true, message: `Alasan selisih wajib diisi untuk ${item.item_name} jika memilih 'Lainnya'.`, type: 'error' });
          return;
        }
      }
    }

    setProcessing(true);
    setToast({ ...toast, isOpen: false });
    try {
      const itemsToScan = itemsList
        .filter(item => !item.scanned_in_at)
        .map(item => {
          const inputQty = qtys[item.id];
          const shippedFmt = getDisplayFormat(Number(item.qty_shipped), item.smallest_unit);
          const actualQtyReceivedBase = Number(inputQty) * shippedFmt.mult;
          const isDiscrepancy = actualQtyReceivedBase !== Number(item.qty_shipped);
          const notesStr = discNotes[item.id] || '';

          return {
            delivery_note_item_id: item.id,
            qty_received: actualQtyReceivedBase,
            discrepancy_reason: isDiscrepancy ? (discCategories[item.id] === 'Lainnya' ? notesStr.trim() : discCategories[item.id]) : undefined,
          };
        });

      if (itemsToScan.length > 0) {
        const res = await fetch(`/api/delivery-notes/${scanModal.id}/bulk-scan-in`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: itemsToScan }),
        });
        const data = await res.json();
        if (!data.success) {
          throw new Error(`Gagal menyimpan data scan: ${data.message}`);
        }
      }

      let uploadedUrl = '';
      // Upload photo
      if (proofImage) {
        const formData = new FormData();
        formData.append('file', proofImage);
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
        const uploadData = await uploadRes.json();
        if (!uploadData.success) {
          throw new Error('Gagal mengupload foto bukti.');
        }
        uploadedUrl = uploadData.url;
      }

      // Finalize the DO
      const confirmRes = await fetch(`/api/delivery-notes/${scanModal.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proof_image_url: uploadedUrl }),
      });
      const confirmData = await confirmRes.json();
      if (!confirmData.success) {
        setToast({ isOpen: true, message: `Error menyelesaikan: ${confirmData.message}`, type: 'error' });
        return;
      }

      setScanModal(null);
      setToast({ isOpen: true, message: 'Surat Jalan diterima dan diselesaikan!', type: 'success' });
      fetchNotes();
    } catch (e: unknown) {
      if (e instanceof Error) {
        setToast({ isOpen: true, message: e.message, type: 'error' });
      } else {
        setToast({ isOpen: true, message: 'An unknown error occurred', type: 'error' });
      }
    } finally {
      setProcessing(false);
    }
  }

  const allScannedIn = itemsList.length > 0 && itemsList.every(i => i.scanned_in_at);

  const handleFillAll = () => {
    const newQtys = { ...qtys };
    itemsList.forEach(item => {
      if (!item.scanned_in_at) {
        const shippedFmt = getDisplayFormat(Number(item.qty_shipped), item.smallest_unit);
        newQtys[item.id] = shippedFmt.value;
      }
    });
    setQtys(newQtys);
  };

  return (
    <section className="screen">
      <div className="card">
        <div className="card-head">
          <div>
            <h3>Terima Barang (Scan IN)</h3>
          </div>
        </div>
        <div className="card-body flush">
          {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Memuat Surat Jalan...</div> : deliveryNotes.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 3h15v13H1z M16 8h4l3 3v5h-7V8z" /></svg>
              <h4>Belum ada pengiriman</h4>
              <p>Belum ada Surat Jalan dengan status DIKIRIM untuk outlet Anda</p>
            </div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>No. Surat Jalan</th>
                  <th>No. Ref PO</th>
                  <th>Tanggal Kirim</th>
                  <th>Sopir</th>
                  <th className="center">Status</th>
                </tr>
              </thead>
              <tbody>
                {deliveryNotes.map(dn => (
                  <tr key={dn.id} onClick={() => openScan(dn)} className="hover-row" style={{ cursor: 'pointer' }}>
                    <td className="font-mono text-primary font-bold">{dn.delivery_note_number}</td>
                    <td className="font-mono font-bold">
                      {dn.order_id 
                        ? `PO-${new Date(dn.delivery_date).getFullYear()}-${String(dn.order_id).padStart(5, '0')}`
                        : `PO-${new Date(dn.delivery_date).getFullYear()}-DIR${String(dn.id).padStart(3, '0')}`}
                    </td>
                    <td>{new Date(dn.delivery_date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td className="muted">{dn.driver_name || '-'}</td>
                    <td className="center">
                      <Badge variant={dn.status === 'DITERIMA' ? 'green' : dn.status === 'DRAFT' ? 'gray' : 'amber'}>
                        {dn.status === 'DITERIMA' ? 'Diterima' : dn.status === 'DIKIRIM' ? 'Dikirim' : dn.status === 'DRAFT' ? 'Diproses Pusat' : dn.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </div>

      <Modal isOpen={!!scanModal} onClose={() => setScanModal(null)} title={`Terima Barang - ${scanModal?.delivery_note_number}`} maxWidth={900}>
        <div className="modal-body" style={{ padding: '16px 20px' }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h5 style={{ margin: 0, color: 'var(--primary)', fontSize: 16 }}>Verifikasi Barang</h5>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {scanModal?.status !== 'DITERIMA' && (
                  <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} style={{ whiteSpace: 'nowrap' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                    {proofImage || previewUrl ? 'Ubah Foto' : 'Unggah Foto'}
                  </Button>
                )}
                {scanModal?.status !== 'DITERIMA' && (
                  <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" capture="environment" onChange={e => handlePhotoChange(e.target.files?.[0])} />
                )}
                {previewUrl && (
                  <img
                    src={previewUrl}
                    alt="Proof"
                    onClick={() => setViewingPhoto(true)}
                    style={{ height: 40, width: 40, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)', cursor: 'zoom-in' }}
                  />
                )}
                {scanModal?.status === 'DITERIMA' && previewUrl && (
                  <span className="muted" style={{ fontSize: 13, marginLeft: 8 }}>Bukti Pengiriman</span>
                )}
              </div>

              {!allScannedIn && scanModal?.status !== 'DITERIMA' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Button variant="outline" type="button" onClick={handleFillAll} disabled={processing} style={{ whiteSpace: 'nowrap', border: '1px solid var(--border)' }}>
                    Terima Semua Sesuai DO
                  </Button>
                  <form onSubmit={handleCompleteReceipt} style={{ display: 'flex', alignItems: 'center' }}>
                    <Button variant="primary" type="submit" disabled={processing || (requireBarcode && !proofImage && !previewUrl)}>
                      {processing ? 'Menyelesaikan...' : 'Selesaikan Penerimaan'}
                    </Button>
                  </form>
                </div>
              )}
            </div>
          </div>

          <div style={{ border: '1px solid var(--border)', borderRadius: 8, marginBottom: 24, overflowX: 'auto' }}>
            <Table>
              <thead><tr><th>Data Barang</th><th className="center">Jml Dikirim</th><th>Jml Aktual Diterima</th><th>Selisih (Jika Ada)</th><th className="center">Status</th></tr></thead>
              <tbody>
                {itemsList.map(item => {
                  const shippedFmt = getDisplayFormat(Number(item.qty_shipped), item.smallest_unit);
                  const isScanned = !!item.scanned_in_at;

                  if (isScanned) {
                    const received = item.qty_received != null ? getDisplayFormat(Number(item.qty_received), item.smallest_unit) : null;
                    return (
                      <tr key={item.id}>
                        <td className="font-bold">
                          {item.item_name}
                        </td>
                        <td className="center num">{shippedFmt.value.toLocaleString('en-US', { maximumFractionDigits: 3 })} {shippedFmt.unit}</td>
                        <td className="center num font-bold" style={{ color: item.qty_received != null && Number(item.qty_received) !== Number(item.qty_shipped) ? 'var(--danger)' : 'inherit' }}>
                          {received != null ? `${received.value.toLocaleString('en-US', { maximumFractionDigits: 3 })} ${received.unit}` : '-'}
                        </td>
                        <td>
                          {item.discrepancy_reason ? (
                            <div style={{ fontSize: 12, color: 'var(--danger)', lineHeight: 1.3 }}>
                              {item.discrepancy_reason}
                            </div>
                          ) : (
                            <span className="muted" style={{ fontSize: 12 }}>-</span>
                          )}
                        </td>
                        <td className="center">
                          <Badge variant="green">✓ Diterima</Badge>
                        </td>
                      </tr>
                    );
                  }

                  const inputQty = qtys[item.id] !== undefined ? qtys[item.id] : '';
                  const isDiscrepancy = inputQty !== '' && Number(inputQty) !== shippedFmt.value;

                  return (
                    <tr key={item.id}>
                      <td style={{ verticalAlign: 'top', paddingTop: 16 }}>
                        <div className="font-bold">{item.item_name}</div>
                      </td>
                      <td className="center num" style={{ verticalAlign: 'top', paddingTop: 16 }}>
                        {shippedFmt.value.toLocaleString('en-US', { maximumFractionDigits: 3 })} {shippedFmt.unit}
                      </td>
                      <td style={{ verticalAlign: 'top', paddingTop: 12, paddingBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Input
                            type="number"
                            step="any"
                            min={0}
                            placeholder="Jml"
                            value={inputQty}
                            onChange={e => setQtys({ ...qtys, [item.id]: e.target.value === '' ? '' : Number(e.target.value) })}
                            style={{ width: 100, fontSize: 13, padding: '6px 10px' }}
                          />
                          <span style={{ fontSize: 13 }}>{shippedFmt.unit}</span>
                        </div>
                      </td>
                      <td style={{ verticalAlign: 'top', paddingTop: 12, paddingBottom: 16 }}>
                        {isDiscrepancy ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 220 }}>
                            <Select
                              value={discCategories[item.id] || ''}
                              onChange={val => setDiscCategories({ ...discCategories, [item.id]: String(val) })}
                              options={[
                                { value: 'Barang Kurang / Hilang', label: 'Barang Kurang / Hilang' },
                                { value: 'Barang Rusak / Cacat', label: 'Barang Rusak / Cacat' },
                                { value: 'Lainnya', label: 'Lainnya' }
                              ]}
                              placeholder="Pilih alasan..."
                              inputStyle={{ height: 32, padding: '6px 10px', fontSize: 13 }}
                            />

                            {discCategories[item.id] === 'Lainnya' && (
                              <Input
                                value={discNotes[item.id] || ''}
                                onChange={e => setDiscNotes({ ...discNotes, [item.id]: e.target.value })}
                                placeholder="Ketik detail alasan..."
                                style={{ fontSize: 12, padding: '6px 10px', width: '100%', height: 32 }}
                              />
                            )}
                          </div>
                        ) : (
                          <span className="muted" style={{ fontSize: 12, marginTop: 4, display: 'inline-block' }}>-</span>
                        )}
                      </td>
                      <td className="center" style={{ verticalAlign: 'top', paddingTop: 16 }}>
                        <Badge variant="gray">Menunggu Scan</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>

        </div>
      </Modal>

      {/* Inline Photo Viewer Overlay */}
      {viewingPhoto && previewUrl && (
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
            src={previewUrl}
            alt="Proof of delivery"
            style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
          />
        </div>
      )}

      <Toast
        isOpen={toast.isOpen}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, isOpen: false })}
      />
    </section>
  );
}
