'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import { ArrowLeftRight, Plus, CheckCircle, XCircle, Clock, Eye, AlertCircle, Trash2, Search, Building } from 'lucide-react';

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

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  PENDING_APPROVAL: { label: 'Pending Alokasi', color: '#d97706', bg: '#fef3c7', border: '#fde68a' },
  APPROVED: { label: 'Disetujui', color: '#2563eb', bg: '#dbeafe', border: '#bfdbfe' },
  COMPLETED: { label: 'Selesai', color: '#16a34a', bg: '#dcfce7', border: '#bbf7d0' },
  REJECTED: { label: 'Ditolak', color: '#dc2626', bg: '#fee2e2', border: '#fecaca' },
  CANCELLED: { label: 'Dibatalkan', color: '#64748b', bg: '#f1f5f9', border: '#e2e8f0' },
};

function formatRupiah(num: number): string {
  return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
}

export default function OutletTransfersPage() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [userOutletId, setUserOutletId] = useState<number | null>(null);

  // Filters & Pagination
  const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing' | 'all'>('incoming');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(20);

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [requestNotes, setRequestNotes] = useState('');
  const [itemsToRequest, setItemsToRequest] = useState<{
    item_id: number;
    item_name: string;
    qty: number | string;
    unit: string;
    smallest_unit: string;
    purchase_unit: string;
    conversion_ratio: number;
    unit_cost: number;
  }[]>([]);
  const [selectedItemToAdd, setSelectedItemToAdd] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Detail Modal State
  const [selectedTransfer, setSelectedTransfer] = useState<{
    transfer: Transfer;
    items: TransferItem[];
  } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Confirmation dialogs
  const [confirmReceive, setConfirmReceive] = useState<Transfer | null>(null);
  const [processingReceive, setProcessingReceive] = useState(false);

  // Fetch session to determine current user's outlet
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

    // Auto-refresh interval (silent polling setiap 5 detik)
    const interval = setInterval(() => {
      fetchTransfers(true);
    }, 5000);

    const handleFocus = () => {
      fetchTransfers(true);
    };
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
        qty: 1,
        unit: item.purchase_unit || item.smallest_unit,
        smallest_unit: item.smallest_unit,
        purchase_unit: item.purchase_unit,
        conversion_ratio: Number(item.conversion_ratio) || 1,
        unit_cost: Number(item.current_average_price || item.last_purchase_price) || 0,
      }
    ]);
    setSelectedItemToAdd('');
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

  const calculateItemSubtotal = (it: typeof itemsToRequest[0]) => {
    const isPurchase = it.unit.toLowerCase() === (it.purchase_unit || '').toLowerCase();
    const convRatio = Number(it.conversion_ratio) || 1;
    const cost = isPurchase ? (it.unit_cost * convRatio) : it.unit_cost;
    const numericQty = parseFloat(String(it.qty)) || 0;
    return numericQty * cost;
  };

  const totalEstimatedCost = useMemo(() => {
    return itemsToRequest.reduce((sum, item) => sum + calculateItemSubtotal(item), 0);
  }, [itemsToRequest]);

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
      setFormError('Silakan isi alasan/kebutuhan mendesak.');
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
      fetchTransfers();
    } catch (err) {
      console.error('Error submitting transfer:', err);
      setFormError('Terjadi kesalahan koneksi server.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenDetail = async (t: Transfer) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/outlet/transfers/${t.id}`);
      const data = await res.json();
      if (data.success) {
        setSelectedTransfer(data.data);
      }
    } catch (err) {
      console.error('Error fetching transfer detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleConfirmReceive = async () => {
    if (!confirmReceive) return;
    setProcessingReceive(true);

    try {
      const res = await fetch(`/api/outlet/transfers/${confirmReceive.id}/receive`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        setConfirmReceive(null);
        if (selectedTransfer && selectedTransfer.transfer.id === confirmReceive.id) {
          setSelectedTransfer(null);
        }
        fetchTransfers();
      } else {
        alert(data.message || 'Gagal mengonfirmasi penerimaan barang.');
      }
    } catch (err) {
      console.error('Error receiving transfer:', err);
      alert('Terjadi kesalahan server saat konfirmasi penerimaan barang.');
    } finally {
      setProcessingReceive(false);
    }
  };

  // Stats
  const stats = useMemo(() => {
    const incomingReqs = transfers.filter(t => t.to_outlet_id === userOutletId);
    const outgoingReqs = transfers.filter(t => t.from_outlet_id === userOutletId);
    const pending = transfers.filter(t => t.status === 'PENDING_APPROVAL').length;
    const readyToReceive = transfers.filter(t => t.status === 'APPROVED' && t.to_outlet_id === userOutletId).length;
    const completed = transfers.filter(t => t.status === 'COMPLETED').length;

    return {
      incomingCount: incomingReqs.length,
      outgoingCount: outgoingReqs.length,
      pending,
      readyToReceive,
      completed,
    };
  }, [transfers, userOutletId]);

  // Filtered transfers
  const filteredTransfers = useMemo(() => {
    return transfers.filter(t => {
      // Tab filter
      if (activeTab === 'incoming' && t.to_outlet_id !== userOutletId) return false;
      if (activeTab === 'outgoing' && t.from_outlet_id !== userOutletId) return false;

      // Status filter
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesNumber = t.transfer_number.toLowerCase().includes(q);
        const matchesFrom = (t.from_outlet_name || '').toLowerCase().includes(q);
        const matchesTo = t.to_outlet_name.toLowerCase().includes(q);
        const matchesNotes = (t.notes || '').toLowerCase().includes(q);
        if (!matchesNumber && !matchesFrom && !matchesTo && !matchesNotes) return false;
      }

      return true;
    });
  }, [transfers, activeTab, statusFilter, searchQuery, userOutletId]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, statusFilter, searchQuery]);

  const totalPages = Math.ceil(filteredTransfers.length / itemsPerPage);
  const paginatedTransfers = useMemo(() => {
    return filteredTransfers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredTransfers, currentPage, itemsPerPage]);

  return (
    <section className="screen">
      {/* Header Info Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 8, background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={22} />
          </div>
          <div>
            <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, display: 'block' }}>Menunggu Alokasi</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: stats.pending > 0 ? '#d97706' : '#1e293b' }}>
              {stats.pending} Permohonan
            </span>
          </div>
        </div>

        <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 8, background: '#dbeafe', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowLeftRight size={22} />
          </div>
          <div>
            <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, display: 'block' }}>Siap Diterima</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: stats.readyToReceive > 0 ? '#2563eb' : '#1e293b' }}>
              {stats.readyToReceive} Pengiriman
            </span>
          </div>
        </div>

        <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 8, background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle size={22} />
          </div>
          <div>
            <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, display: 'block' }}>Selesai Diterima</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#16a34a' }}>
              {stats.completed} Mutasi
            </span>
          </div>
        </div>

        <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 8, background: '#f8fafc', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0' }}>
            <Building size={22} />
          </div>
          <div>
            <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, display: 'block' }}>Total Mutasi</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#1e293b' }}>
              {transfers.length} Riwayat
            </span>
          </div>
        </div>
      </div>

      {/* Main Card */}
      <div className="card">
        {/* Navigation Tabs & Toolbar */}
        <div style={{ borderBottom: '1px solid var(--border)', padding: '0 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 24 }}>
            <button
              onClick={() => setActiveTab('incoming')}
              style={{
                padding: '14px 4px',
                fontSize: 14,
                fontWeight: activeTab === 'incoming' ? 700 : 500,
                color: activeTab === 'incoming' ? '#016e3f' : '#64748b',
                border: 'none',
                borderBottom: activeTab === 'incoming' ? '2px solid #016e3f' : '2px solid transparent',
                background: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              Permohonan Kami (Barang Masuk)
              <span style={{
                background: activeTab === 'incoming' ? '#e8f5e9' : '#f1f5f9',
                color: activeTab === 'incoming' ? '#016e3f' : '#64748b',
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 12,
                fontWeight: 700,
              }}>
                {transfers.filter(t => t.to_outlet_id === userOutletId).length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('outgoing')}
              style={{
                padding: '14px 4px',
                fontSize: 14,
                fontWeight: activeTab === 'outgoing' ? 700 : 500,
                color: activeTab === 'outgoing' ? '#016e3f' : '#64748b',
                border: 'none',
                borderBottom: activeTab === 'outgoing' ? '2px solid #016e3f' : '2px solid transparent',
                background: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              Diminta Mengirimkan (Barang Keluar)
              <span style={{
                background: activeTab === 'outgoing' ? '#e8f5e9' : '#f1f5f9',
                color: activeTab === 'outgoing' ? '#016e3f' : '#64748b',
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 12,
                fontWeight: 700,
              }}>
                {transfers.filter(t => t.from_outlet_id === userOutletId).length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('all')}
              style={{
                padding: '14px 4px',
                fontSize: 14,
                fontWeight: activeTab === 'all' ? 700 : 500,
                color: activeTab === 'all' ? '#016e3f' : '#64748b',
                border: 'none',
                borderBottom: activeTab === 'all' ? '2px solid #016e3f' : '2px solid transparent',
                background: 'transparent',
                cursor: 'pointer',
              }}
            >
              Semua Riwayat
            </button>
          </div>

          <div style={{ display: 'flex', gap: 10, padding: '8px 0', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: 220 }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Cari nomor mutasi..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 12px 6px 32px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  fontSize: 13,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <Select
              value={statusFilter}
              onChange={val => setStatusFilter(String(val))}
              options={[
                { value: 'ALL', label: 'Semua Status' },
                { value: 'PENDING_APPROVAL', label: 'Pending Alokasi' },
                { value: 'APPROVED', label: 'Disetujui' },
                { value: 'COMPLETED', label: 'Selesai' },
                { value: 'REJECTED', label: 'Ditolak' },
              ]}
              style={{ width: 145 }}
              inputStyle={{ height: 34 }}
            />

            <Select
              value={itemsPerPage.toString()}
              onChange={val => {
                setItemsPerPage(Number(val));
                setCurrentPage(1);
              }}
              options={[
                { value: '20', label: '20' },
                { value: '50', label: '50' },
                { value: '100', label: '100' }
              ]}
              style={{ width: 75 }}
              inputStyle={{ height: 34 }}
            />

            <button
              onClick={() => {
                setItemsToRequest([]);
                setRequestNotes('');
                setSelectedItemToAdd('');
                setFormError(null);
                setShowCreateModal(true);
              }}
              style={{
                padding: '0 16px',
                height: 34,
                borderRadius: 6,
                background: '#016e3f',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 4px rgba(1,110,63,0.15)',
                transition: 'all 0.15s ease',
              }}
            >
              <Plus size={16} /> Buat Request Mutasi
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="card-body flush">
          {loading ? (
            <div style={{ padding: 50, textAlign: 'center', color: 'var(--muted)' }}>
              Memuat data mutasi antar outlet...
            </div>
          ) : filteredTransfers.length === 0 ? (
            <div className="empty-state" style={{ padding: '60px 20px', textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: '#94a3b8' }}>
                <ArrowLeftRight size={24} />
              </div>
              <h4 style={{ margin: '0 0 6px', color: '#334155' }}>Belum Ada Data Mutasi</h4>
              <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
                {activeTab === 'incoming'
                  ? 'Belum ada request mutasi barang yang diajukan oleh outlet ini.'
                  : activeTab === 'outgoing'
                  ? 'Belum ada permohonan mutasi yang ditugaskan ke outlet ini untuk dikirim.'
                  : 'Tidak ditemukan data mutasi dengan filter yang dipilih.'}
              </p>
            </div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>No. Mutasi</th>
                  <th>Tanggal</th>
                  <th>Posisi Outlet</th>
                  <th>Outlet Pengirim</th>
                  <th>Outlet Pemohon</th>
                  <th className="center">Total Item</th>
                  <th className="right">Est. Nilai HPP</th>
                  <th className="center">Status</th>
                  <th className="center" style={{ width: 100 }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTransfers.map(t => {
                  const isReceiver = t.to_outlet_id === userOutletId;
                  const isSender = t.from_outlet_id === userOutletId;
                  const statusInfo = STATUS_CONFIG[t.status] || { label: t.status, color: '#64748b', bg: '#f1f5f9', border: '#e2e8f0' };
                  const canReceive = isReceiver && t.status === 'APPROVED';

                  return (
                    <tr key={t.id} className="hover-row">
                      <td style={{ fontWeight: 700, color: '#016e3f', fontFamily: 'monospace' }}>
                        {t.transfer_number}
                      </td>
                      <td style={{ fontSize: 13, color: '#475569' }}>
                        {new Date(t.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td>
                        {isReceiver ? (
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '2px 8px', borderRadius: 4 }}>
                            Outlet Penerima
                          </span>
                        ) : isSender ? (
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#d97706', background: '#fffbeb', padding: '2px 8px', borderRadius: 4 }}>
                            Outlet Pengirim
                          </span>
                        ) : (
                          <span style={{ fontSize: 12, color: '#64748b' }}>Lainnya</span>
                        )}
                      </td>
                      <td style={{ fontWeight: 600, color: '#1e293b' }}>
                        {t.from_outlet_name ? (
                          t.from_outlet_name
                        ) : t.status === 'REJECTED' || t.status === 'CANCELLED' ? (
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: 4 }}>
                            Batal Dialokasikan
                          </span>
                        ) : (
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Clock size={12} /> Menunggu Alokasi Admin
                          </span>
                        )}
                      </td>
                      <td style={{ fontWeight: 600, color: '#1e293b' }}>
                        {t.to_outlet_name}
                      </td>
                      <td className="center" style={{ fontWeight: 600 }}>
                        {t.item_count || 1} item
                      </td>
                      <td className="right" style={{ fontWeight: 600, color: '#0f172a' }}>
                        {formatRupiah(t.total_cost)}
                      </td>
                      <td className="center">
                        <span style={{
                          display: 'inline-block',
                          fontSize: 11,
                          fontWeight: 700,
                          color: statusInfo.color,
                          background: statusInfo.bg,
                          border: `1px solid ${statusInfo.border}`,
                          padding: '2px 8px',
                          borderRadius: 6,
                        }}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="center">
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
                          <button
                            onClick={() => handleOpenDetail(t)}
                            title="Lihat Detail Mutasi"
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 6,
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              color: '#334155',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <Eye size={16} />
                          </button>

                          {canReceive && (
                            <button
                              onClick={() => setConfirmReceive(t)}
                              title="Konfirmasi Terima Barang"
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 6,
                                border: '1px solid #86efac',
                                background: '#f0fdf4',
                                color: '#16a34a',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <CheckCircle size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: 16, padding: '0 24px 24px 24px' }}>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredTransfers.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>
      </div>

      {/* CREATE TRANSFER MODAL (OUTLET REQUEST-ONLY) */}
      {showCreateModal && (
        <Modal
          isOpen={showCreateModal}
          onClose={() => {
            if (!submitting) {
              setShowCreateModal(false);
              setFormError(null);
            }
          }}
          title="Buat Request Mutasi Barang (Kebutuhan Mendesak)"
          maxWidth={800}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '4px 0' }}>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#166534', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Building size={18} style={{ flexShrink: 0 }} />
              <span>
                Cukup pilih barang yang dibutuhkan dan jumlahnya. <strong>Admin Pusat</strong> akan memeriksa ketersediaan stok di semua cabang dan menentukan outlet pengirim terbaik.
              </span>
            </div>

            {/* Item Selection from Catalog */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                  Pilih Barang yang Dibutuhkan
                </span>
                {loadingItems && (
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#016e3f' }}>Memuat katalog barang...</span>
                )}
              </div>

              {/* Add item input row with Tambah Barang button */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <div style={{ flex: 1 }}>
                  <Select
                    value={selectedItemToAdd}
                    onChange={val => {
                      const valStr = String(val);
                      setSelectedItemToAdd(valStr);
                      setFormError(null);
                    }}
                    options={catalogItems.map(item => ({
                      value: String(item.id),
                      label: `${item.name} (${item.purchase_unit || item.smallest_unit})`
                    }))}
                    placeholder={loadingItems ? 'Sedang memuat katalog...' : '+ Cari dan pilih barang yang dibutuhkan...'}
                    searchable={true}
                    disabled={loadingItems || catalogItems.length === 0}
                    style={{ width: '100%' }}
                    inputStyle={{
                      height: 42,
                      minHeight: 42,
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid #cbd5e1',
                      fontSize: 14,
                      color: '#0f172a',
                      background: '#ffffff',
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleAddItem()}
                  disabled={!selectedItemToAdd}
                  style={{
                    padding: '0 20px',
                    height: 42,
                    borderRadius: 8,
                    background: selectedItemToAdd ? '#016e3f' : '#94a3b8',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: selectedItemToAdd ? 'pointer' : 'not-allowed',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    whiteSpace: 'nowrap',
                    boxShadow: selectedItemToAdd ? '0 1px 2px rgba(1, 110, 63, 0.2)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Plus size={16} /> Tambah Barang
                </button>
              </div>

              {/* Table of selected items */}
              {itemsToRequest.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: '#64748b', fontSize: 13, background: '#ffffff', border: '1px dashed #cbd5e1', borderRadius: 8 }}>
                  <div style={{ marginBottom: 4, fontWeight: 600, color: '#334155' }}>Belum ada barang yang dipilih</div>
                  <span>Pilih barang dari pencarian di atas untuk memasukkan ke dalam daftar permohonan mutasi.</span>
                </div>
              ) : (
                <div style={{ overflowX: 'auto', background: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                        <th style={{ padding: '10px 14px', fontWeight: 700 }}>Nama Barang</th>
                        <th style={{ padding: '10px 14px', fontWeight: 700, width: 120 }}>Jumlah Diminta</th>
                        <th style={{ padding: '10px 14px', fontWeight: 700, width: 140 }}>Satuan</th>
                        <th style={{ padding: '10px 14px', fontWeight: 700, textAlign: 'right' }}>Est. Nilai Modal</th>
                        <th style={{ padding: '10px 14px', width: 44, textAlign: 'center' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemsToRequest.map(it => {
                        const subtotal = calculateItemSubtotal(it);
                        return (
                          <tr key={it.item_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>
                              {it.item_name}
                            </td>
                            <td style={{ padding: '8px 10px' }}>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                placeholder="0"
                                value={it.qty}
                                onChange={e => handleItemQtyChange(it.item_id, e.target.value)}
                                style={{
                                  width: '100%',
                                  height: 36,
                                  padding: '6px 10px',
                                  borderRadius: 6,
                                  border: '1px solid #cbd5e1',
                                  fontSize: 13,
                                  fontWeight: 600,
                                  color: '#0f172a',
                                  boxSizing: 'border-box',
                                }}
                              />
                            </td>
                            <td style={{ padding: '8px 10px' }}>
                              <select
                                value={it.unit}
                                onChange={e => handleItemUnitChange(it.item_id, e.target.value)}
                                style={{
                                  width: '100%',
                                  height: 36,
                                  padding: '6px 10px',
                                  borderRadius: 6,
                                  border: '1px solid #cbd5e1',
                                  fontSize: 13,
                                  color: '#0f172a',
                                  boxSizing: 'border-box',
                                  background: '#ffffff',
                                }}
                              >
                                {it.purchase_unit && (
                                  <option value={it.purchase_unit}>{it.purchase_unit}</option>
                                )}
                                <option value={it.smallest_unit}>{it.smallest_unit}</option>
                              </select>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                              {formatRupiah(subtotal)}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              <button
                                onClick={() => handleRemoveItem(it.item_id)}
                                title="Hapus item"
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                  padding: 4,
                                }}
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                        <td colSpan={3} style={{ padding: '10px 14px', textAlign: 'right' }}>
                          Total Estimasi Nilai Mutasi:
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: '#016e3f', fontSize: 14 }}>
                          {formatRupiah(totalEstimatedCost)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Step 3: Urgent Reason Notes */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
                Alasan / Catatan Kebutuhan Mendesak <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <textarea
                value={requestNotes}
                onChange={e => setRequestNotes(e.target.value)}
                placeholder="Contoh: Lonjakan pesanan pagi ini, stok susu habis mendadak dan butuh pinjaman dari outlet terdekat..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: 13,
                  color: '#0f172a',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>

            {/* Modal Actions */}
            <div style={{ marginTop: 10, paddingTop: 14, borderTop: '1px solid #e2e8f0' }}>
              {formError && (
                <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 13, display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
                  <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <strong style={{ display: 'block', marginBottom: 2 }}>Data Belum Sesuai</strong>
                    <span>{formError}</span>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={submitting}
                  style={{
                    padding: '9px 16px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#475569',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSubmitCreateTransfer}
                  disabled={submitting}
                  style={{
                    padding: '9px 20px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#016e3f',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: '0 1px 2px rgba(1, 110, 63, 0.2)',
                  }}
                >
                  {submitting ? 'Mengirim...' : 'Kirim Permohonan Mutasi'}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* DETAIL MODAL */}
      {selectedTransfer && (
        <Modal
          isOpen={Boolean(selectedTransfer)}
          onClose={() => setSelectedTransfer(null)}
          title={`Detail Mutasi: ${selectedTransfer.transfer.transfer_number}`}
          maxWidth={750}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Summary Card */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>Outlet Pengirim:</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
                  {selectedTransfer.transfer.from_outlet_name || (
                    selectedTransfer.transfer.status === 'REJECTED' || selectedTransfer.transfer.status === 'CANCELLED' ? (
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Batal Dialokasikan</span>
                    ) : (
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Menunggu Alokasi Admin</span>
                    )
                  )}
                </span>
              </div>
              <div>
                <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>Outlet Pemohon:</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{selectedTransfer.transfer.to_outlet_name}</span>
              </div>
              <div>
                <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>Diajukan Oleh:</span>
                <span style={{ fontSize: 13, color: '#334155' }}>
                  {selectedTransfer.transfer.requested_by_name || '-'} ({new Date(selectedTransfer.transfer.created_at).toLocaleString('id-ID')})
                </span>
              </div>
              <div>
                <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>Status Mutasi:</span>
                <span style={{
                  display: 'inline-block',
                  fontSize: 11,
                  fontWeight: 700,
                  color: STATUS_CONFIG[selectedTransfer.transfer.status]?.color || '#64748b',
                  background: STATUS_CONFIG[selectedTransfer.transfer.status]?.bg || '#f1f5f9',
                  border: `1px solid ${STATUS_CONFIG[selectedTransfer.transfer.status]?.border || '#e2e8f0'}`,
                  padding: '2px 8px',
                  borderRadius: 6,
                  marginTop: 2,
                }}>
                  {STATUS_CONFIG[selectedTransfer.transfer.status]?.label || selectedTransfer.transfer.status}
                </span>
              </div>
              {selectedTransfer.transfer.notes && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>Alasan / Catatan Mendesak:</span>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#334155', fontStyle: 'italic', background: '#ffffff', padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                    "{selectedTransfer.transfer.notes}"
                  </p>
                </div>
              )}
              {selectedTransfer.transfer.rejection_reason && (
                <div style={{ gridColumn: '1 / -1', background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 12px', borderRadius: 6 }}>
                  <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 700, display: 'block' }}>Alasan Penolakan:</span>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#991b1b' }}>
                    {selectedTransfer.transfer.rejection_reason}
                  </p>
                </div>
              )}
            </div>

            {/* Items Table */}
            <div>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8 }}>Rincian Barang yang Dimutasikan</h4>
              <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                      <th style={{ padding: '10px 14px', fontWeight: 700 }}>Nama Item</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700, textAlign: 'center' }}>Jumlah Diminta</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700, textAlign: 'center' }}>Satuan</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700, textAlign: 'right' }}>Harga Modal</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700, textAlign: 'right' }}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTransfer.items.map((it, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>{it.item_name}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>{it.requested_qty}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', color: '#64748b' }}>{it.unit}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>{formatRupiah(it.cost_per_unit)}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{formatRupiah(it.subtotal_cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                      <td colSpan={4} style={{ padding: '10px 14px', textAlign: 'right' }}>Total Estimasi Nilai Mutasi:</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: '#016e3f' }}>{formatRupiah(selectedTransfer.transfer.total_cost)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
              <button
                onClick={() => setSelectedTransfer(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Tutup
              </button>
              {selectedTransfer.transfer.status === 'APPROVED' && selectedTransfer.transfer.to_outlet_id === userOutletId && (
                <button
                  onClick={() => {
                    setConfirmReceive(selectedTransfer.transfer);
                  }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#16a34a',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <CheckCircle size={16} /> Konfirmasi Terima Barang
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* CONFIRM RECEIVE DIALOG */}
      {confirmReceive && (
        <ConfirmDialog
          open={Boolean(confirmReceive)}
          onCancel={() => setConfirmReceive(null)}
          onConfirm={handleConfirmReceive}
          title="Konfirmasi Penerimaan Barang Mutasi"
          message={`Apakah Anda yakin telah menerima fisik barang mutasi (${confirmReceive.transfer_number}) dari ${confirmReceive.from_outlet_name || 'outlet pengirim'}? Stok outlet Anda akan bertambah dan stok outlet asal akan terpotong secara otomatis.`}
          confirmText="Ya, Saya Sudah Terima"
          loading={processingReceive}
        />
      )}
    </section>
  );
}
