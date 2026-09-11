'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { TransferStatusBadge } from '@/components/shared/TransferStatusBadge';
import { Plus, Search, Trash2, ArrowRight, ArrowLeftRight, Clock, AlertCircle, PackageCheck, Truck, Download, Send } from 'lucide-react';

interface Transfer {
  id: number;
  transfer_number: string;
  from_outlet_id: number | null;
  from_outlet_name: string | null;
  to_outlet_id: number;
  to_outlet_name: string;
  requested_by: number | null;
  requested_by_name: string | null;
  approved_by: number | null;
  approved_by_name: string | null;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';
  notes: string | null;
  rejection_reason: string | null;
  total_cost: number;
  created_at: string;
  approved_at: string | null;
  received_at: string | null;
  item_count?: number;
}

interface TransferItem {
  id: number;
  transfer_id: number;
  item_id: number;
  item_name: string;
  category_name?: string;
  requested_qty: number;
  received_qty: number;
  unit: string;
  cost_per_unit: number;
  subtotal_cost: number;
  smallest_unit?: string;
  purchase_unit?: string;
  conversion_ratio?: number;
}

interface CatalogItem {
  id: number;
  name: string;
  category_name?: string;
  purchase_unit: string;
  smallest_unit: string;
  conversion_ratio: number;
  current_average_price: number;
  last_purchase_price: number;
}

export default function OutletTransfersPage() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [userOutletId, setUserOutletId] = useState<number | null>(null);

  // Role Tab State: 'ALL' (Semua) | 'PENERIMA' (Penerima) | 'PENGIRIM' (Pengirim)
  const [activeRoleTab, setActiveRoleTab] = useState<'ALL' | 'PENERIMA' | 'PENGIRIM'>('ALL');

  // Filters & Pagination
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const ITEMS_PER_PAGE = 20;

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [requestNotes, setRequestNotes] = useState('');
  const [itemsToRequest, setItemsToRequest] = useState<{
    item_id: number;
    item_name: string;
    category_name?: string;
    qty: number | string;
    unit: string;
    smallest_unit: string;
    purchase_unit: string;
    conversion_ratio: number;
  }[]>([]);
  const [selectedItemToAdd, setSelectedItemToAdd] = useState<string>('');
  const [itemSearchInput, setItemSearchInput] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Detail Modal State
  const [selectedTransfer, setSelectedTransfer] = useState<{
    transfer: Transfer;
    items: TransferItem[];
  } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Fetch current user's outlet session
  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.data?.outlet_id) {
          setUserOutletId(Number(data.data.outlet_id));
        }
      })
      .catch(() => {});
  }, []);

  // Fetch catalog items for request creation
  const fetchCatalogItems = useCallback(async () => {
    setLoadingItems(true);
    try {
      const res = await fetch('/api/items?active_only=true&parent_only=true');
      const data = await res.json();
      if (data.success) {
        setCatalogItems(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching catalog items:', err);
    } finally {
      setLoadingItems(false);
    }
  }, []);

  useEffect(() => {
    if (showCreateModal && catalogItems.length === 0) {
      fetchCatalogItems();
    }
  }, [showCreateModal, catalogItems.length, fetchCatalogItems]);

  const fetchTransfers = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const res = await fetch('/api/outlet/transfers');
      const data = await res.json();
      if (data.success) {
        setTransfers(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching transfers:', err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransfers(false);
    const interval = setInterval(() => {
      fetchTransfers(true);
    }, 10000);

    const handleFocus = () => fetchTransfers(true);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchTransfers]);

  const handleAddItem = (itemIdParam?: string) => {
    const targetIdStr = itemIdParam || selectedItemToAdd;
    if (!targetIdStr) return;

    const item = catalogItems.find(s => String(s.id) === String(targetIdStr));
    if (!item) {
      setFormError('Barang tidak ditemukan dalam katalog.');
      return;
    }

    if (itemsToRequest.some(i => String(i.item_id) === String(item.id))) {
      setFormError(`Item "${item.name}" sudah ada dalam daftar.`);
      return;
    }

    setItemsToRequest(prev => [
      ...prev,
      {
        item_id: Number(item.id),
        item_name: item.name,
        category_name: item.category_name,
        qty: 1,
        unit: item.purchase_unit || item.smallest_unit,
        smallest_unit: item.smallest_unit,
        purchase_unit: item.purchase_unit,
        conversion_ratio: Number(item.conversion_ratio) || 1,
      }
    ]);
    setSelectedItemToAdd('');
    setItemSearchInput('');
    setFormError(null);
  };

  const handleRemoveItem = (itemId: number | string) => {
    setItemsToRequest(prev => prev.filter(i => String(i.item_id) !== String(itemId)));
  };

  const handleItemQtyChange = (itemId: number | string, newQty: number | string) => {
    setItemsToRequest(prev => prev.map(i => {
      if (String(i.item_id) === String(itemId)) {
        return { ...i, qty: newQty };
      }
      return i;
    }));
  };

  const handleItemUnitChange = (itemId: number | string, newUnit: string) => {
    setItemsToRequest(prev => prev.map(i => {
      if (String(i.item_id) === String(itemId)) {
        return { ...i, unit: newUnit };
      }
      return i;
    }));
  };

  const handleSubmitCreateTransfer = async () => {
    if (itemsToRequest.length === 0) {
      setFormError('Minimal harus memilih 1 barang untuk dimutasikan.');
      return;
    }

    const invalidItem = itemsToRequest.find(i => (parseFloat(String(i.qty)) || 0) <= 0);
    if (invalidItem) {
      setFormError(`Jumlah yang diminta untuk "${invalidItem.item_name}" harus lebih dari 0.`);
      return;
    }

    if (!requestNotes.trim()) {
      setFormError('Silakan isi alasan / kebutuhan permohonan mutasi.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch('/api/outlet/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_outlet_id: userOutletId,
          notes: requestNotes,
          items: itemsToRequest.map(i => ({
            item_id: i.item_id,
            qty: parseFloat(String(i.qty)) || 0,
            unit: i.unit,
          })),
        }),
      });

      const result = await res.json();
      if (!result.success) {
        setFormError(result.message || 'Gagal membuat permohonan mutasi.');
        return;
      }

      setShowCreateModal(false);
      setItemsToRequest([]);
      setRequestNotes('');
      setSelectedItemToAdd('');
      setItemSearchInput('');
      fetchTransfers();
    } catch (err) {
      console.error('Error submitting transfer:', err);
      setFormError('Terjadi kesalahan koneksi server.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewTransfer = async (t: Transfer) => {
    setSelectedTransfer({ transfer: t, items: [] });
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/outlet/transfers/${t.id}`);
      const data = await res.json();
      if (data.success && data.data) {
        setSelectedTransfer(data.data);
      }
    } catch (err) {
      console.error('Error fetching transfer detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Counts for Tabs
  const counts = useMemo(() => {
    const total = transfers.length;
    const receiver = transfers.filter(t => t.to_outlet_id === userOutletId).length;
    const sender = transfers.filter(t => t.from_outlet_id === userOutletId).length;
    return { total, receiver, sender };
  }, [transfers, userOutletId]);

  // Filter transfers by Role Tab, Status, and Search Query
  const filteredTransfers = useMemo(() => {
    return transfers.filter(t => {
      // Role Tab Filter: 'ALL' | 'PENERIMA' | 'PENGIRIM'
      if (activeRoleTab === 'PENERIMA' && t.to_outlet_id !== userOutletId) return false;
      if (activeRoleTab === 'PENGIRIM' && t.from_outlet_id !== userOutletId) return false;

      // Status filter
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesNumber = t.transfer_number.toLowerCase().includes(q);
        const matchesFrom = (t.from_outlet_name || '').toLowerCase().includes(q);
        const matchesTo = (t.to_outlet_name || '').toLowerCase().includes(q);
        const matchesNotes = (t.notes || '').toLowerCase().includes(q);
        if (!matchesNumber && !matchesFrom && !matchesTo && !matchesNotes) return false;
      }

      return true;
    });
  }, [transfers, activeRoleTab, statusFilter, searchQuery, userOutletId]);

  // Filtered Catalog Items for Picker
  const filteredCatalog = useMemo(() => {
    if (!itemSearchInput.trim()) return catalogItems;
    const q = itemSearchInput.toLowerCase();
    return catalogItems.filter(i =>
      i.name.toLowerCase().includes(q) || (i.category_name || '').toLowerCase().includes(q)
    );
  }, [catalogItems, itemSearchInput]);

  return (
    <section className="screen">
      <div className="card">
        {/* Card Header & 3-Role Tabs */}
        <div style={{ borderBottom: '1px solid var(--border)' }}>
          <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Mutasi Antar Outlet</h3>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)' }}>
                Daftar permohonan mutasi barang antar outlet cabang.
              </p>
            </div>
          </div>

          {/* 3-Role Tabs: Semua | Penerima | Pengirim */}
          <div style={{ display: 'flex', padding: '0 20px', gap: 8 }}>
            <button
              type="button"
              onClick={() => {
                setActiveRoleTab('ALL');
                setCurrentPage(1);
              }}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: activeRoleTab === 'ALL' ? '2px solid var(--primary)' : '2px solid transparent',
                padding: '12px 14px',
                fontSize: 13,
                fontWeight: activeRoleTab === 'ALL' ? 700 : 500,
                color: activeRoleTab === 'ALL' ? 'var(--primary)' : 'var(--muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              Semua
              <span style={{
                background: activeRoleTab === 'ALL' ? '#e8f5e9' : '#f1f5f9',
                color: activeRoleTab === 'ALL' ? '#016e3f' : '#64748b',
                borderRadius: 99,
                fontSize: 11,
                fontWeight: 700,
                padding: '1px 6px',
              }}>
                {counts.total}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveRoleTab('PENERIMA');
                setCurrentPage(1);
              }}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: activeRoleTab === 'PENERIMA' ? '2px solid var(--primary)' : '2px solid transparent',
                padding: '12px 14px',
                fontSize: 13,
                fontWeight: activeRoleTab === 'PENERIMA' ? 700 : 500,
                color: activeRoleTab === 'PENERIMA' ? 'var(--primary)' : 'var(--muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Download size={15} />
              Penerima (Mutasi Masuk)
              <span style={{
                background: activeRoleTab === 'PENERIMA' ? '#dbeafe' : '#f1f5f9',
                color: activeRoleTab === 'PENERIMA' ? '#2563eb' : '#64748b',
                borderRadius: 99,
                fontSize: 11,
                fontWeight: 700,
                padding: '1px 6px',
              }}>
                {counts.receiver}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveRoleTab('PENGIRIM');
                setCurrentPage(1);
              }}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: activeRoleTab === 'PENGIRIM' ? '2px solid var(--primary)' : '2px solid transparent',
                padding: '12px 14px',
                fontSize: 13,
                fontWeight: activeRoleTab === 'PENGIRIM' ? 700 : 500,
                color: activeRoleTab === 'PENGIRIM' ? 'var(--primary)' : 'var(--muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Send size={15} />
              Pengirim (Mutasi Keluar)
              <span style={{
                background: activeRoleTab === 'PENGIRIM' ? '#fef3c7' : '#f1f5f9',
                color: activeRoleTab === 'PENGIRIM' ? '#d97706' : '#64748b',
                borderRadius: 99,
                fontSize: 11,
                fontWeight: 700,
                padding: '1px 6px',
              }}>
                {counts.sender}
              </span>
            </button>
          </div>
        </div>

        {/* Action Toolbar */}
        <div style={{ background: '#f0fdf4', borderBottom: '1px solid #bbf7d0', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setItemsToRequest([]);
                setRequestNotes('');
                setSelectedItemToAdd('');
                setItemSearchInput('');
                setFormError(null);
                setShowCreateModal(true);
              }}
            >
              <Plus size={15} style={{ marginRight: 6 }} />
              Buat Permintaan Mutasi
            </Button>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: 220 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Cari nomor / outlet / catatan..."
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                style={{
                  width: '100%',
                  padding: '6px 12px 6px 30px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  fontSize: 13,
                  outline: 'none',
                  boxSizing: 'border-box',
                  background: '#ffffff'
                }}
              />
            </div>

            <Select
              value={statusFilter}
              onChange={val => {
                setStatusFilter(String(val));
                setCurrentPage(1);
              }}
              options={[
                { value: 'ALL', label: 'Semua Status' },
                { value: 'PENDING_APPROVAL', label: 'Menunggu Alokasi' },
                { value: 'APPROVED', label: 'Disetujui / Dikirim' },
                { value: 'COMPLETED', label: 'Selesai' },
                { value: 'REJECTED', label: 'Ditolak' },
              ]}
              style={{ width: 165 }}
              inputStyle={{ height: 32, background: '#ffffff' }}
            />
          </div>
        </div>

        {/* Table Content */}
        <div className="card-body flush">
          {loading ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Memuat data mutasi...</div>
          ) : filteredTransfers.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
              </svg>
              <h4>Tidak ada data mutasi</h4>
              <p>
                {searchQuery || statusFilter !== 'ALL'
                  ? 'Tidak ada mutasi yang sesuai dengan filter pencarian.'
                  : activeRoleTab === 'PENERIMA'
                  ? 'Belum ada permohonan mutasi masuk untuk outlet ini.'
                  : activeRoleTab === 'PENGIRIM'
                  ? 'Belum ada tugas pengiriman mutasi keluar dari outlet ini.'
                  : 'Anda belum memiliki riwayat mutasi antar outlet.'}
              </p>
            </div>
          ) : (
            <>
              <Table>
                <thead>
                  <tr>
                    <th>No. Mutasi</th>
                    <th>Tanggal</th>
                    <th>Outlet Pengirim</th>
                    <th>Outlet Penerima</th>
                    <th>Alasan / Kebutuhan</th>
                    <th className="center">Total Barang</th>
                    <th className="center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransfers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map(t => {
                    return (
                      <tr
                        key={t.id}
                        onClick={() => handleViewTransfer(t)}
                        style={{ cursor: 'pointer' }}
                        className="hover-row"
                      >
                        <td className="font-mono text-primary font-bold">
                          {t.transfer_number}
                        </td>
                        <td>
                          {new Date(t.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td>
                          {t.from_outlet_name ? (
                            <span style={{ fontWeight: 600, color: '#1e293b' }}>{t.from_outlet_name}</span>
                          ) : t.status === 'REJECTED' || t.status === 'CANCELLED' ? (
                            <span className="muted" style={{ fontSize: 12 }}>-</span>
                          ) : (
                            <span style={{ fontSize: 11, color: '#d97706', background: '#fef3c7', padding: '2px 8px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                              <Clock size={11} /> Menunggu Alokasi
                            </span>
                          )}
                        </td>
                        <td>
                          <span style={{ fontWeight: 600, color: '#1e293b' }}>{t.to_outlet_name}</span>
                        </td>
                        <td className="muted" style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.notes || '-'}
                        </td>
                        <td className="center num font-bold">
                          {t.item_count || 1}
                        </td>
                        <td className="center">
                          <TransferStatusBadge status={t.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>

              {filteredTransfers.length > ITEMS_PER_PAGE && (
                <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)' }}>
                  <div className="muted" style={{ fontSize: 13 }}>
                    Menampilkan {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredTransfers.length)} dari {filteredTransfers.length}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Button size="sm" variant="outline" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Seb</Button>
                    <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px', fontSize: 13, fontWeight: 600 }}>
                      Halaman {currentPage} dari {Math.ceil(filteredTransfers.length / ITEMS_PER_PAGE)}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredTransfers.length / ITEMS_PER_PAGE), p + 1))} disabled={currentPage === Math.ceil(filteredTransfers.length / ITEMS_PER_PAGE)}>Lanjut</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal 1: Detail Mutasi */}
      <Modal
        isOpen={!!selectedTransfer}
        onClose={() => setSelectedTransfer(null)}
        title={`Detail Mutasi - ${selectedTransfer?.transfer.transfer_number || ''}`}
        maxWidth={850}
      >
        <div className="modal-body" style={{ padding: '16px 20px' }}>
          {selectedTransfer && (
            <>
              {/* Status & Timeline Info Banner */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, padding: '12px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 16 }}>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block', fontWeight: 600 }}>TANGGAL PENGAJUAN</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                    {new Date(selectedTransfer.transfer.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block', fontWeight: 600 }}>OUTLET PENGIRIM (SUMBER)</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: selectedTransfer.transfer.from_outlet_name ? '#016e3f' : '#d97706' }}>
                    {selectedTransfer.transfer.from_outlet_name || 'Menunggu Alokasi Admin'}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block', fontWeight: 600 }}>OUTLET PENERIMA (TUJUAN)</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                    {selectedTransfer.transfer.to_outlet_name}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block', fontWeight: 600 }}>STATUS MUTASI</span>
                  <div style={{ marginTop: 2 }}>
                    <TransferStatusBadge status={selectedTransfer.transfer.status} />
                  </div>
                </div>
              </div>

              {/* Catatan / Alasan Permohonan */}
              {selectedTransfer.transfer.notes && (
                <div style={{ marginBottom: 16, padding: '10px 14px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 2 }}>
                    ALASAN / KEBUTUHAN MENDESAK:
                  </span>
                  <p style={{ margin: 0, fontSize: 13, color: '#334155' }}>
                    {selectedTransfer.transfer.notes}
                  </p>
                </div>
              )}

              {/* Banner jika DITOLAK */}
              {selectedTransfer.transfer.status === 'REJECTED' && (
                <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
                  <AlertCircle size={20} color="#dc2626" style={{ flexShrink: 0 }} />
                  <div>
                    <strong style={{ color: '#991b1b', fontSize: 13, display: 'block' }}>Permohonan Mutasi Ditolak</strong>
                    <span style={{ fontSize: 13, color: '#b91c1c' }}>
                      Alasan: {selectedTransfer.transfer.rejection_reason || 'Tidak ada alasan spesifik.'}
                    </span>
                  </div>
                </div>
              )}

              {/* Banner Panduan Penerimaan Barang jika status APPROVED untuk Outlet Penerima */}
              {selectedTransfer.transfer.status === 'APPROVED' && selectedTransfer.transfer.to_outlet_id === userOutletId && (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '14px 16px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <PackageCheck size={22} color="#2563eb" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <strong style={{ color: '#1e40af', fontSize: 13, display: 'block', marginBottom: 2 }}>
                      Barang Telah Disetujui & Dikirim oleh Outlet Asal
                    </strong>
                    <p style={{ margin: '0 0 8px', fontSize: 13, color: '#1e3a8a', lineHeight: 1.4 }}>
                      Untuk verifikasi fisik barang dan konfirmasi penerimaan, silakan buka menu <strong>Penerimaan Barang</strong> pada tab <em>Mutasi Antar Outlet</em>.
                    </p>
                    <Link href="/outlet/receive-goods">
                      <Button size="sm" variant="primary" style={{ height: 28, fontSize: 12 }}>
                        Buka Menu Penerimaan Barang <ArrowRight size={13} style={{ marginLeft: 4 }} />
                      </Button>
                    </Link>
                  </div>
                </div>
              )}

              {/* Items Table */}
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                {loadingDetail ? (
                  <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>Memuat detail barang...</div>
                ) : selectedTransfer.items.length === 0 ? (
                  <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>Data barang tidak ditemukan.</div>
                ) : (
                  <Table>
                    <thead>
                      <tr>
                        <th>Barang</th>
                        <th>Kategori</th>
                        <th className="right">Jumlah Diminta</th>
                        <th className="center">Satuan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTransfer.items.map(item => (
                        <tr key={item.id}>
                          <td className="font-bold">{item.item_name}</td>
                          <td className="muted" style={{ textTransform: 'capitalize' }}>
                            {item.category_name?.toLowerCase() || '-'}
                          </td>
                          <td className="right font-bold num text-primary">
                            {parseFloat(Number(item.requested_qty).toFixed(3)).toLocaleString('id-ID')}
                          </td>
                          <td className="center muted font-bold">
                            {item.unit}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Modal 2: Buat Permintaan Mutasi */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Buat Permintaan Mutasi Antar Outlet"
        maxWidth={750}
      >
        <div className="modal-body" style={{ padding: '16px 20px' }}>
          {formError && (
            <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 6, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 16 }}>
              {formError}
            </div>
          )}

          {/* Pilih Barang dari Katalog */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>
              Pilih Barang dari Katalog:
            </label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <Select
                  value={selectedItemToAdd}
                  onChange={val => {
                    setSelectedItemToAdd(String(val));
                    setFormError(null);
                  }}
                  searchable={true}
                  placeholder={loadingItems ? 'Memuat katalog barang...' : '-- Ketik atau Cari & Pilih Barang yang Ingin Dimutasikan --'}
                  options={catalogItems
                    .filter(it => !itemsToRequest.some(req => String(req.item_id) === String(it.id)))
                    .map(it => ({
                      value: String(it.id),
                      label: `${it.name} (${it.category_name || 'Umum'}) – Satuan: ${it.purchase_unit || it.smallest_unit}`
                    }))}
                  style={{ width: '100%' }}
                  inputStyle={{ height: 38, fontSize: 13 }}
                />
              </div>
              <Button
                type="button"
                variant="primary"
                onClick={() => handleAddItem()}
                disabled={!selectedItemToAdd}
                style={{
                  height: 38,
                  padding: '0 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                  fontWeight: 600,
                  fontSize: 13
                }}
              >
                <Plus size={16} /> Tambah Barang
              </Button>
            </div>
          </div>

          {/* Daftar Barang yang Diminta */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>
              Daftar Barang yang Diminta:
            </label>

            {itemsToRequest.length === 0 ? (
              <div style={{ padding: '24px 16px', border: '1px dashed #cbd5e1', borderRadius: 8, textAlign: 'center', color: '#64748b', fontSize: 13, background: '#f8fafc' }}>
                Pilih barang di atas untuk menambahkan ke dalam daftar permohonan mutasi.
              </div>
            ) : (
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <Table>
                  <thead>
                    <tr>
                      <th>Nama Barang</th>
                      <th style={{ width: 140 }}>Jumlah Diminta</th>
                      <th style={{ width: 120 }}>Satuan</th>
                      <th className="center" style={{ width: 60 }}>Hapus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemsToRequest.map(item => (
                      <tr key={item.item_id}>
                        <td className="font-bold">{item.item_name}</td>
                        <td>
                          <Input
                            type="number"
                            min="0.1"
                            step="any"
                            value={item.qty}
                            onChange={e => handleItemQtyChange(item.item_id, e.target.value)}
                            style={{ height: 32, fontSize: 13, fontWeight: 700 }}
                          />
                        </td>
                        <td>
                          <select
                            value={item.unit}
                            onChange={e => handleItemUnitChange(item.item_id, e.target.value)}
                            style={{
                              width: '100%',
                              height: 32,
                              borderRadius: 6,
                              border: '1px solid #cbd5e1',
                              fontSize: 12,
                              padding: '0 6px',
                              background: '#ffffff'
                            }}
                          >
                            {item.purchase_unit && <option value={item.purchase_unit}>{item.purchase_unit}</option>}
                            {item.smallest_unit && item.smallest_unit !== item.purchase_unit && (
                              <option value={item.smallest_unit}>{item.smallest_unit}</option>
                            )}
                          </select>
                        </td>
                        <td className="center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.item_id)}
                            style={{ background: 'transparent', border: 'none', color: '#dc2626', cursor: 'pointer', padding: 4 }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </div>

          {/* Alasan / Catatan Mendesak */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>
              Alasan Permohonan / Kebutuhan Mendesak: <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <textarea
              rows={3}
              placeholder="Contoh: Stok sirup vanila habis mendadak karena lonjakan pesanan, butuh pasokan darurat dari cabang terdekat."
              value={requestNotes}
              onChange={e => setRequestNotes(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit'
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid #e2e8f0', paddingTop: 14 }}>
            <Button
              variant="outline"
              onClick={() => setShowCreateModal(false)}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmitCreateTransfer}
              disabled={submitting || itemsToRequest.length === 0}
            >
              {submitting ? 'Mengirimkan...' : 'Kirim Permohonan Mutasi'}
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
