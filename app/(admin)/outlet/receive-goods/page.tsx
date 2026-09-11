'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Toast } from '@/components/ui/Toast';
import { Select } from '@/components/ui/Select';
import { ArrowRight, ArrowLeftRight, Truck, CheckCircle2, AlertTriangle, Upload, Eye } from 'lucide-react';

interface DeliveryNote {
  id: number;
  delivery_note_number: string;
  status: string;
  order_id: number;
  delivery_date: string;
  driver_name: string;
  proof_image_url?: string;
}

interface DeliveryNoteItem {
  id: number;
  item_id: number;
  item_name: string;
  qty_shipped: string | number;
  qty_received?: string | number | null;
  smallest_unit: string;
  purchase_unit: string;
  conversion_ratio?: string | number | null;
  scanned_in_at?: string | null;
  unique_barcode?: string | null;
  barcode?: string | null;
  discrepancy_reason?: string | null;
}

interface OutletTransferSummary {
  id: number;
  transfer_number: string;
  from_outlet_id: number | null;
  from_outlet_name: string | null;
  to_outlet_id: number;
  to_outlet_name: string;
  status: string;
  notes: string | null;
  total_cost: number;
  approved_at: string | null;
  created_at: string;
  received_at?: string | null;
  proof_image_url?: string | null;
  requested_by_name: string | null;
  approved_by_name: string | null;
  item_count: number;
}

interface OutletTransferItemDetail {
  id: number;
  transfer_id: number;
  item_id: number;
  item_name: string;
  requested_qty: number;
  received_qty: number;
  unit: string;
  cost_per_unit: number;
  subtotal_cost: number;
  smallest_unit?: string;
  purchase_unit?: string;
  conversion_ratio?: number;
  discrepancy_reason?: string | null;
  issue_photo_url?: string | null;
}

export default function ReceiveGoodsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const scanParam = searchParams.get('scan');
  const [initialScanHandled, setInitialScanHandled] = useState(false);

  // Active Tab: 'CENTRAL_DO' (Surat Jalan Gudang Pusat) vs 'OUTLET_TRANSFER' (Mutasi Antar Outlet)
  const [activeTab, setActiveTab] = useState<'CENTRAL_DO' | 'OUTLET_TRANSFER'>('CENTRAL_DO');

  // Delivery Notes (Central DO) state
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [scanModal, setScanModal] = useState<DeliveryNote | null>(null);
  const [itemsList, setItemsList] = useState<DeliveryNoteItem[]>([]);
  const [qtys, setQtys] = useState<Record<number, number | ''>>({});
  const [discNotes, setDiscNotes] = useState<Record<number, string>>({});
  const [discCategories, setDiscCategories] = useState<Record<number, string>>({});

  // Outlet Transfers state
  const [transfers, setTransfers] = useState<OutletTransferSummary[]>([]);
  const [loadingTransfers, setLoadingTransfers] = useState(true);
  const [transferModal, setTransferModal] = useState<OutletTransferSummary | null>(null);
  const [transferItemsList, setTransferItemsList] = useState<OutletTransferItemDetail[]>([]);
  const [transferQtys, setTransferQtys] = useState<Record<number, number | ''>>({});
  const [transferDiscCategories, setTransferDiscCategories] = useState<Record<number, string>>({});
  const [transferDiscNotes, setTransferDiscNotes] = useState<Record<number, string>>({});

  // General & Upload states
  const [toast, setToast] = useState<{ isOpen: boolean; message: string; type: 'success' | 'error' | 'info' }>({
    isOpen: false,
    message: '',
    type: 'info',
  });
  const [processing, setProcessing] = useState(false);
  const [proofImage, setProofImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState(false);
  const [requireBarcode, setRequireBarcode] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const transferFileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ isOpen: true, message, type });
  };
  const hideToast = () => setToast(prev => ({ ...prev, isOpen: false }));

  function handlePhotoChange(file: File | undefined) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('Ukuran foto terlalu besar. Maksimal 5 MB.', 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (transferFileInputRef.current) transferFileInputRef.current.value = '';
      return;
    }
    setProofImage(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  // Fetch Delivery Notes from Central Warehouse
  const fetchNotes = useCallback(async (isQuiet = false) => {
    if (!isQuiet) setLoadingNotes(true);
    try {
      const [res, setRes] = await Promise.all([
        fetch('/api/delivery-notes', { cache: 'no-store' }),
        fetch('/api/settings', { cache: 'no-store' }),
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
    } catch {
      // ignore
    } finally {
      if (!isQuiet) setLoadingNotes(false);
    }
  }, []);

  // Fetch Approved Transfers for Receiving
  const fetchTransfers = useCallback(async (isQuiet = false) => {
    if (!isQuiet) setLoadingTransfers(true);
    try {
      const res = await fetch('/api/outlet/transfers/pending-receipt', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setTransfers(data.data || []);
      }
    } catch {
      // ignore
    } finally {
      if (!isQuiet) setLoadingTransfers(false);
    }
  }, []);

  useEffect(() => {
    fetchNotes(false);
    fetchTransfers(false);

    const interval = setInterval(() => {
      fetchNotes(true);
      fetchTransfers(true);
    }, 5000);

    const handleFocus = () => {
      fetchNotes(true);
      fetchTransfers(true);
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchNotes, fetchTransfers]);

  // Handle URL barcode scan parameter
  useEffect(() => {
    if (deliveryNotes.length > 0 && scanParam && !initialScanHandled) {
      const dn = deliveryNotes.find(d => d.delivery_note_number === scanParam);
      if (dn) {
        openScan(dn);
      } else {
        showToast(`Surat Jalan ${scanParam} tidak ditemukan.`, 'error');
      }
      setInitialScanHandled(true);
      router.replace('/outlet/receive-goods');
    }
  }, [deliveryNotes, scanParam, initialScanHandled, router]);

  // Central DO receipt modal handlers
  async function openScan(dn: DeliveryNote) {
    if (dn.status === 'DRAFT') {
      showToast('Pesanan masih diproses pusat', 'info');
      return;
    }

    setScanModal(dn);
    hideToast();
    setProofImage(null);
    setPreviewUrl(dn.proof_image_url || null);
    setQtys({});
    setDiscNotes({});
    setDiscCategories({});

    try {
      const res = await fetch(`/api/delivery-notes/${dn.id}`);
      const data = await res.json();
      setItemsList(data.data?.items ?? []);
    } catch {
      showToast('Gagal memuat rincian item surat jalan.', 'error');
    }
  }

  async function handleCompleteReceipt(e: React.FormEvent) {
    e.preventDefault();
    if (!scanModal) return;

    if (requireBarcode && !proofImage && !previewUrl) {
      showToast('Foto bukti penerimaan wajib diunggah.', 'error');
      return;
    }

    // Validate inputs
    for (const item of itemsList) {
      if (item.scanned_in_at) continue;

      const inputQty = qtys[item.id];
      if (inputQty === undefined || inputQty === '' || inputQty < 0) {
        showToast(`Harap masukkan Kuantitas Aktual untuk ${item.item_name}.`, 'error');
        return;
      }

      const conversionRatio = Number(item.conversion_ratio) || 1;
      const actualQtyReceivedBase = Number(inputQty) * conversionRatio;
      const isDiscrepancy = actualQtyReceivedBase !== Number(item.qty_shipped);
      const categoryStr = discCategories[item.id] || '';
      const notesStr = discNotes[item.id] || '';

      if (isDiscrepancy) {
        if (!categoryStr) {
          showToast(`Jenis masalah wajib dipilih untuk ${item.item_name}.`, 'error');
          return;
        }
        if (categoryStr === 'Lainnya' && !notesStr.trim()) {
          showToast(`Alasan selisih wajib diisi untuk ${item.item_name} jika memilih 'Lainnya'.`, 'error');
          return;
        }
      }
    }

    setProcessing(true);
    hideToast();
    try {
      const itemsToScan = itemsList
        .filter(item => !item.scanned_in_at)
        .map(item => {
          const inputQty = qtys[item.id];
          const conversionRatio = Number(item.conversion_ratio) || 1;
          const actualQtyReceivedBase = Number(inputQty) * conversionRatio;
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
      if (proofImage) {
        const formData = new FormData();
        formData.append('file', proofImage);
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
        const uploadData = await uploadRes.json();
        if (!uploadData.success) {
          throw new Error(uploadData.message || 'Gagal mengupload foto bukti.');
        }
        uploadedUrl = uploadData.url;
      }

      const confirmRes = await fetch(`/api/delivery-notes/${scanModal.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proof_image_url: uploadedUrl }),
      });
      const confirmData = await confirmRes.json();
      if (!confirmData.success) {
        showToast(`Error menyelesaikan: ${confirmData.message}`, 'error');
        return;
      }

      setScanModal(null);
      showToast('Surat Jalan diterima dan diselesaikan!', 'success');
      fetchNotes();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Terjadi kesalahan sistem.', 'error');
    } finally {
      setProcessing(false);
    }
  }

  const handleFillAll = () => {
    const newQtys = { ...qtys };
    itemsList.forEach(item => {
      if (!item.scanned_in_at) {
        const conversionRatio = Number(item.conversion_ratio) || 1;
        newQtys[item.id] = Number(item.qty_shipped) / conversionRatio;
      }
    });
    setQtys(newQtys);
  };

  // Outlet Transfer receiving modal handlers
  async function openTransferModal(tr: OutletTransferSummary) {
    setTransferModal(tr);
    hideToast();
    setProofImage(null);
    setPreviewUrl(tr.proof_image_url || null);
    setTransferQtys({});
    setTransferDiscCategories({});
    setTransferDiscNotes({});

    try {
      const res = await fetch(`/api/outlet/transfers/${tr.id}`);
      const data = await res.json();
      if (data.success && data.data?.items) {
        setTransferItemsList(data.data.items);
        if (data.data.transfer?.proof_image_url) {
          setPreviewUrl(data.data.transfer.proof_image_url);
        }
      } else {
        setTransferItemsList([]);
      }
    } catch {
      showToast('Gagal memuat rincian item mutasi.', 'error');
    }
  }

  const handleTransferFillAll = () => {
    const newQtys = { ...transferQtys };
    transferItemsList.forEach(item => {
      newQtys[item.id] = Number(item.requested_qty);
    });
    setTransferQtys(newQtys);
  };

  async function handleCompleteTransferReceipt(e: React.FormEvent) {
    e.preventDefault();
    if (!transferModal) return;

    // Validate inputs
    for (const item of transferItemsList) {
      const inputQty = transferQtys[item.id];
      if (inputQty === undefined || inputQty === '' || inputQty < 0) {
        showToast(`Harap masukkan Jumlah Diterima untuk ${item.item_name}.`, 'error');
        return;
      }

      const receivedQtyNum = Number(inputQty);
      const requestedQtyNum = Number(item.requested_qty);

      if (receivedQtyNum > requestedQtyNum) {
        showToast(`Jumlah diterima untuk ${item.item_name} tidak boleh melebihi jumlah kirim (${requestedQtyNum} ${item.unit}).`, 'error');
        return;
      }

      const isDiscrepancy = receivedQtyNum < requestedQtyNum;
      const categoryStr = transferDiscCategories[item.id] || '';
      const notesStr = transferDiscNotes[item.id] || '';

      if (isDiscrepancy) {
        if (!categoryStr) {
          showToast(`Jenis masalah/alasan selisih wajib dipilih untuk ${item.item_name}.`, 'error');
          return;
        }
        if (categoryStr === 'Lainnya' && !notesStr.trim()) {
          showToast(`Detail alasan wajib diisi untuk ${item.item_name} jika memilih 'Lainnya'.`, 'error');
          return;
        }
      }
    }

    setProcessing(true);
    hideToast();
    try {
      let uploadedUrl = '';
      if (proofImage) {
        const formData = new FormData();
        formData.append('file', proofImage);
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
        const uploadData = await uploadRes.json();
        if (!uploadData.success) {
          throw new Error(uploadData.message || 'Gagal mengunggah foto bukti penerimaan mutasi.');
        }
        uploadedUrl = uploadData.url;
      }

      const receivedItemsPayload = transferItemsList.map(item => {
        const inputQty = Number(transferQtys[item.id]);
        const requestedQtyNum = Number(item.requested_qty);
        const isDiscrepancy = inputQty < requestedQtyNum;
        const categoryStr = transferDiscCategories[item.id] || '';
        const notesStr = transferDiscNotes[item.id] || '';

        const reason = isDiscrepancy
          ? (categoryStr === 'Lainnya' ? notesStr.trim() : categoryStr)
          : undefined;

        return {
          transfer_item_id: item.id,
          item_id: item.item_id,
          received_qty: inputQty,
          issue_reason: reason,
          issue_photo_url: uploadedUrl || undefined,
        };
      });

      const res = await fetch(`/api/outlet/transfers/${transferModal.id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          received_items: receivedItemsPayload,
          proof_image_url: uploadedUrl || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal mengonfirmasi penerimaan mutasi.');
      }

      setTransferModal(null);
      showToast('Penerimaan mutasi barang berhasil dikonfirmasi! Stok dan log telah diperbarui.', 'success');
      fetchTransfers();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Terjadi kesalahan sistem.', 'error');
    } finally {
      setProcessing(false);
    }
  }

  const allScannedIn = itemsList.length > 0 && itemsList.every(i => i.scanned_in_at);
  const pendingNotesCount = deliveryNotes.filter(d => d.status === 'DIKIRIM').length;
  const pendingTransfersCount = transfers.filter(t => t.status === 'APPROVED').length;

  return (
    <section className="screen">
      <div className="card">
        {/* Header with Title and Tabs */}
        <div style={{ borderBottom: '1px solid var(--border)' }}>
          <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Penerimaan Barang</h3>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)' }}>
                Periksa dan terima kiriman dari Gudang Pusat maupun Mutasi Antar Outlet Cabang.
              </p>
            </div>
          </div>

          {/* 2-Tab Navigation */}
          <div style={{ display: 'flex', padding: '0 20px', gap: 8 }}>
            <button
              type="button"
              onClick={() => setActiveTab('CENTRAL_DO')}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'CENTRAL_DO' ? '2px solid var(--primary)' : '2px solid transparent',
                padding: '12px 14px',
                fontSize: 13,
                fontWeight: activeTab === 'CENTRAL_DO' ? 700 : 500,
                color: activeTab === 'CENTRAL_DO' ? 'var(--primary)' : 'var(--muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Truck size={16} />
              <span>Kiriman Gudang Pusat</span>
              {pendingNotesCount > 0 && (
                <span style={{
                  background: '#016e3f',
                  color: '#ffffff',
                  borderRadius: 99,
                  fontSize: 11,
                  fontWeight: 700,
                  minWidth: 18,
                  height: 18,
                  padding: '0 6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1,
                }}>
                  {pendingNotesCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('OUTLET_TRANSFER')}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'OUTLET_TRANSFER' ? '2px solid var(--primary)' : '2px solid transparent',
                padding: '12px 14px',
                fontSize: 13,
                fontWeight: activeTab === 'OUTLET_TRANSFER' ? 700 : 500,
                color: activeTab === 'OUTLET_TRANSFER' ? 'var(--primary)' : 'var(--muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <ArrowLeftRight size={16} />
              <span>Mutasi Antar Outlet</span>
              {pendingTransfersCount > 0 && (
                <span style={{
                  background: '#016e3f',
                  color: '#ffffff',
                  borderRadius: 99,
                  fontSize: 11,
                  fontWeight: 700,
                  minWidth: 18,
                  height: 18,
                  padding: '0 6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1,
                }}>
                  {pendingTransfersCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Tab 1: Kiriman Gudang Pusat */}
        {activeTab === 'CENTRAL_DO' && (
          <div className="card-body flush">
            {loadingNotes ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Memuat Surat Jalan...</div>
            ) : deliveryNotes.length === 0 ? (
              <div className="empty-state" style={{ padding: '48px 20px', textAlign: 'center' }}>
                <Truck size={36} style={{ color: 'var(--muted)', marginBottom: 12, opacity: 0.6 }} />
                <h4 style={{ margin: '0 0 6px' }}>Belum ada pengiriman dari Pusat</h4>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
                  Belum ada Surat Jalan aktif dengan status DIKIRIM untuk outlet Anda.
                </p>
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
                      <td>{new Date(dn.delivery_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
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
        )}

        {/* Tab 2: Mutasi Antar Outlet */}
        {activeTab === 'OUTLET_TRANSFER' && (
          <div className="card-body flush">
            {loadingTransfers ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Memuat data mutasi masuk...</div>
            ) : transfers.length === 0 ? (
              <div className="empty-state" style={{ padding: '48px 20px', textAlign: 'center' }}>
                <ArrowLeftRight size={36} style={{ color: 'var(--muted)', marginBottom: 12, opacity: 0.6 }} />
                <h4 style={{ margin: '0 0 6px' }}>Belum ada mutasi masuk</h4>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
                  Tidak ada kiriman mutasi barang antar outlet yang menunggu penerimaan atau riwayat saat ini.
                </p>
              </div>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>No. Mutasi</th>
                    <th>Dari Outlet</th>
                    <th>Tanggal Kirim</th>
                    <th className="center">Total Barang</th>
                    <th className="center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.map(tr => {
                    const tgl = tr.approved_at || tr.created_at;
                    const isReceived = tr.status === 'COMPLETED';

                    return (
                      <tr key={tr.id} className="hover-row" style={{ cursor: 'pointer' }} onClick={() => openTransferModal(tr)}>
                        <td className="font-mono text-primary font-bold">{tr.transfer_number}</td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{tr.from_outlet_name || 'Outlet Asal'}</div>
                        </td>
                        <td>
                          {tgl ? (
                            new Date(tgl).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
                          ) : (
                            <span style={{ fontSize: 12, color: 'var(--muted)' }}>-</span>
                          )}
                        </td>
                        <td className="center num font-bold">{tr.item_count || 1} jenis</td>
                        <td className="center">
                          <Badge variant={isReceived ? 'green' : 'amber'}>
                            {isReceived ? 'Diterima' : 'Dikirim'}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </div>
        )}
      </div>

      {/* Modal 1: Penerimaan Surat Jalan Gudang Pusat */}
      <Modal
        isOpen={!!scanModal}
        onClose={() => setScanModal(null)}
        title={`Terima Kiriman Pusat - ${scanModal?.delivery_note_number}`}
        maxWidth={900}
        closeOnOutsideClick={false}
      >
        <div className="modal-body" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {scanModal?.status !== 'DITERIMA' && (
                  <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} style={{ whiteSpace: 'nowrap' }}>
                    <Upload size={14} style={{ marginRight: 6 }} />
                    {proofImage || previewUrl ? 'Ubah Foto' : 'Unggah Foto'}
                  </Button>
                )}
                {scanModal?.status !== 'DITERIMA' && (
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept="image/*"
                    capture="environment"
                    onChange={e => handlePhotoChange(e.target.files?.[0])}
                  />
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
                      {processing ? 'Menyelesaikan...' : 'Diterima'}
                    </Button>
                  </form>
                </div>
              )}
            </div>
          </div>

          <div style={{ border: '1px solid var(--border)', borderRadius: 8, marginBottom: 24, overflowX: 'auto' }}>
            <Table>
              <thead>
                <tr>
                  <th>Data Barang</th>
                  <th className="center">Jml Dikirim</th>
                  <th>Jml Diterima</th>
                  <th>Selisih</th>
                  <th className="center">Status</th>
                </tr>
              </thead>
              <tbody>
                {itemsList.map(item => {
                  const conversionRatio = Number(item.conversion_ratio) || 1;
                  const qtyShippedDisplay = Number(item.qty_shipped) / conversionRatio;
                  const unitDisplay = item.purchase_unit || item.smallest_unit;
                  const isScanned = !!item.scanned_in_at;

                  if (isScanned) {
                    const receivedDisplay = item.qty_received != null ? Number(item.qty_received) / conversionRatio : null;
                    return (
                      <tr key={item.id}>
                        <td className="font-bold">{item.item_name}</td>
                        <td className="center num">{qtyShippedDisplay.toLocaleString('id-ID', { maximumFractionDigits: 3 })} {unitDisplay}</td>
                        <td className="center num font-bold" style={{ color: item.qty_received != null && Number(item.qty_received) !== Number(item.qty_shipped) ? 'var(--danger)' : 'inherit' }}>
                          {receivedDisplay != null ? `${receivedDisplay.toLocaleString('id-ID', { maximumFractionDigits: 3 })} ${unitDisplay}` : '-'}
                        </td>
                        <td>
                          {item.discrepancy_reason ? (
                            <div style={{ fontSize: 12, color: 'var(--danger)', lineHeight: 1.3 }}>{item.discrepancy_reason}</div>
                          ) : (
                            <span className="muted" style={{ fontSize: 12 }}>-</span>
                          )}
                        </td>
                        <td className="center">
                          <Badge variant={item.qty_received != null && Number(item.qty_received) !== Number(item.qty_shipped) ? 'amber' : 'green'}>
                            {item.qty_received != null && Number(item.qty_received) !== Number(item.qty_shipped) ? 'Ada Selisih' : 'Selesai'}
                          </Badge>
                        </td>
                      </tr>
                    );
                  }

                  const inputQty = qtys[item.id] !== undefined ? qtys[item.id] : '';

                  return (
                    <tr key={item.id}>
                      <td style={{ verticalAlign: 'top', paddingTop: 16 }}>
                        <div className="font-bold">{item.item_name}</div>
                      </td>
                      <td className="center num" style={{ verticalAlign: 'top', paddingTop: 16 }}>
                        {qtyShippedDisplay.toLocaleString('id-ID', { maximumFractionDigits: 3 })} {unitDisplay}
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
                          <span style={{ fontSize: 13 }}>{unitDisplay}</span>
                        </div>
                      </td>
                      <td style={{ verticalAlign: 'top', paddingTop: 12, paddingBottom: 16 }}>
                        {qtys[item.id] !== undefined && Number(qtys[item.id]) * conversionRatio !== Number(item.qty_shipped) ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 220 }}>
                            <Select
                              value={discCategories[item.id] || ''}
                              onChange={val => setDiscCategories({ ...discCategories, [item.id]: String(val) })}
                              options={[
                                { value: 'Barang Kurang / Hilang', label: 'Barang Kurang / Hilang' },
                                { value: 'Barang Rusak / Cacat', label: 'Barang Rusak / Cacat' },
                                { value: 'Lainnya', label: 'Lainnya' },
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
                        <Badge variant="gray">Belum Diterima</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        </div>
      </Modal>

      {/* Modal 2: Penerimaan / Detail Mutasi Antar Outlet */}
      <Modal
        isOpen={!!transferModal}
        onClose={() => setTransferModal(null)}
        title={transferModal?.status === 'COMPLETED' ? `Detail Penerimaan Mutasi - ${transferModal?.transfer_number}` : `Terima Mutasi Outlet - ${transferModal?.transfer_number}`}
        maxWidth={900}
        closeOnOutsideClick={false}
      >
        <div className="modal-body" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {transferModal?.status !== 'COMPLETED' && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => transferFileInputRef.current?.click()}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    <Upload size={14} style={{ marginRight: 6 }} />
                    {proofImage || previewUrl ? 'Ubah Foto' : 'Unggah Foto'}
                  </Button>
                )}
                {transferModal?.status !== 'COMPLETED' && (
                  <input
                    type="file"
                    ref={transferFileInputRef}
                    style={{ display: 'none' }}
                    accept="image/*"
                    capture="environment"
                    onChange={e => handlePhotoChange(e.target.files?.[0])}
                  />
                )}
                {previewUrl && (
                  <img
                    src={previewUrl}
                    alt="Bukti Mutasi"
                    onClick={() => setViewingPhoto(true)}
                    style={{ height: 40, width: 40, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)', cursor: 'zoom-in' }}
                  />
                )}
                {transferModal?.status === 'COMPLETED' && previewUrl && (
                  <span className="muted" style={{ fontSize: 13, marginLeft: 8 }}>Bukti Penerimaan</span>
                )}
              </div>

              {transferModal?.status !== 'COMPLETED' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Button
                    variant="outline"
                    type="button"
                    onClick={handleTransferFillAll}
                    disabled={processing}
                    style={{ whiteSpace: 'nowrap', border: '1px solid var(--border)' }}
                  >
                    Terima Semua Sesuai Mutasi
                  </Button>
                  <Button
                    variant="primary"
                    type="button"
                    onClick={handleCompleteTransferReceipt}
                    disabled={processing}
                  >
                    {processing ? 'Menyelesaikan...' : 'Diterima'}
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div style={{ border: '1px solid var(--border)', borderRadius: 8, marginBottom: 24, overflowX: 'auto' }}>
            <Table>
              <thead>
                <tr>
                  <th>Data Barang</th>
                  <th className="center">Jml Dikirim</th>
                  <th>Jml Diterima</th>
                  <th>Selisih</th>
                  <th className="center">Status</th>
                </tr>
              </thead>
              <tbody>
                {transferItemsList.map(item => {
                  const isCompleted = transferModal?.status === 'COMPLETED';
                  const requestedQty = Number(item.requested_qty);
                  const receivedQty = Number(item.received_qty);

                  if (isCompleted) {
                    const hasDiscrepancy = receivedQty < requestedQty;
                    return (
                      <tr key={item.id}>
                        <td className="font-bold">{item.item_name}</td>
                        <td className="center num">
                          {requestedQty.toLocaleString('id-ID', { maximumFractionDigits: 3 })} {item.unit}
                        </td>
                        <td className="center num font-bold" style={{ color: hasDiscrepancy ? 'var(--danger)' : 'inherit' }}>
                          {receivedQty.toLocaleString('id-ID', { maximumFractionDigits: 3 })} {item.unit}
                        </td>
                        <td>
                          {item.discrepancy_reason ? (
                            <div style={{ fontSize: 12, color: 'var(--danger)', lineHeight: 1.3 }}>{item.discrepancy_reason}</div>
                          ) : (
                            <span className="muted" style={{ fontSize: 12 }}>-</span>
                          )}
                        </td>
                        <td className="center">
                          <Badge variant={hasDiscrepancy ? 'amber' : 'green'}>
                            {hasDiscrepancy ? 'Ada Selisih' : 'Diterima'}
                          </Badge>
                        </td>
                      </tr>
                    );
                  }

                  const inputQty = transferQtys[item.id] !== undefined ? transferQtys[item.id] : '';
                  const isDiscrepancy = inputQty !== '' && Number(inputQty) !== requestedQty;
                  const isMatching = inputQty !== '' && Number(inputQty) === requestedQty;

                  return (
                    <tr key={item.id}>
                      <td style={{ verticalAlign: 'top', paddingTop: 16 }}>
                        <div className="font-bold">{item.item_name}</div>
                      </td>
                      <td className="center num" style={{ verticalAlign: 'top', paddingTop: 16 }}>
                        {requestedQty.toLocaleString('id-ID', { maximumFractionDigits: 3 })} {item.unit}
                      </td>
                      <td style={{ verticalAlign: 'top', paddingTop: 12, paddingBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Input
                            type="number"
                            step="any"
                            min={0}
                            placeholder="Jml"
                            value={inputQty}
                            onChange={e => setTransferQtys({
                              ...transferQtys,
                              [item.id]: e.target.value === '' ? '' : Number(e.target.value),
                            })}
                            style={{ width: 100, fontSize: 13, padding: '6px 10px' }}
                          />
                          <span style={{ fontSize: 13 }}>{item.unit}</span>
                        </div>
                      </td>
                      <td style={{ verticalAlign: 'top', paddingTop: 12, paddingBottom: 16 }}>
                        {isDiscrepancy ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 220 }}>
                            <Select
                              value={transferDiscCategories[item.id] || ''}
                              onChange={val => setTransferDiscCategories({
                                ...transferDiscCategories,
                                [item.id]: String(val),
                              })}
                              options={[
                                { value: 'Barang Kurang / Hilang', label: 'Barang Kurang / Hilang' },
                                { value: 'Barang Rusak / Cacat', label: 'Barang Rusak / Cacat' },
                                { value: 'Lainnya', label: 'Lainnya' },
                              ]}
                              placeholder="Pilih alasan..."
                              inputStyle={{ height: 32, padding: '6px 10px', fontSize: 13 }}
                            />
                            {transferDiscCategories[item.id] === 'Lainnya' && (
                              <Input
                                value={transferDiscNotes[item.id] || ''}
                                onChange={e => setTransferDiscNotes({
                                  ...transferDiscNotes,
                                  [item.id]: e.target.value,
                                })}
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
                        {inputQty === '' ? (
                          <Badge variant="gray">Belum Diterima</Badge>
                        ) : isDiscrepancy ? (
                          <Badge variant="amber">Ada Selisih</Badge>
                        ) : isMatching ? (
                          <Badge variant="green">Diterima</Badge>
                        ) : (
                          <Badge variant="gray">Sesuai</Badge>
                        )}
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
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(0,0,0,0.92)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <button
            onClick={() => setViewingPhoto(false)}
            style={{
              position: 'absolute',
              top: 20,
              left: 20,
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              cursor: 'pointer',
              padding: '8px 16px',
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
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
        onClose={hideToast}
      />
    </section>
  );
}
