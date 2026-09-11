'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { TransferStatusBadge } from '@/components/shared/TransferStatusBadge';
import { Plus, Search, Clock, Trash2, AlertCircle, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';

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

interface OutletOption {
  id: number;
  name: string;
}

interface ItemStockComparison {
  item_id: number;
  item_name: string;
  smallest_unit: string;
  purchase_unit: string;
  conversion_ratio: number;
  stocks: {
    outlet_id: number;
    outlet_name: string;
    current_balance: number;
  }[];
}

interface AvailableStockItem {
  item_id: number;
  item_name: string;
  category_name: string;
  current_balance: number;
  purchase_unit: string;
  smallest_unit: string;
  conversion_ratio: number;
  current_average_price: number;
}

function formatRupiah(num: number): string {
  return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
}

export default function CentralOutletTransfersPage() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [outlets, setOutlets] = useState<OutletOption[]>([]);

  // Filters & Pagination
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [outletFilter, setOutletFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const ITEMS_PER_PAGE = 20;

  // Detail Modal State
  const [selectedTransfer, setSelectedTransfer] = useState<{
    transfer: Transfer;
    items: TransferItem[];
  } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Allocation & Approval Modal State
  const [allocatingTransfer, setAllocatingTransfer] = useState<{
    transfer: Transfer;
    items: TransferItem[];
  } | null>(null);
  const [stockComparisons, setStockComparisons] = useState<ItemStockComparison[]>([]);
  const [loadingStockComparison, setLoadingStockComparison] = useState(false);
  const [selectedSourceOutletForApproval, setSelectedSourceOutletForApproval] = useState<string>('');
  const [allocationError, setAllocationError] = useState<string | null>(null);
  const [processingAllocation, setProcessingAllocation] = useState(false);

  // Reject Modal State
  const [rejectingTransfer, setRejectingTransfer] = useState<Transfer | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processingReject, setProcessingReject] = useState(false);

  // Direct Transfer Modal State
  const [showDirectModal, setShowDirectModal] = useState(false);
  const [directFromOutlet, setDirectFromOutlet] = useState<string>('');
  const [directToOutlet, setDirectToOutlet] = useState<string>('');
  const [directAvailableStock, setDirectAvailableStock] = useState<AvailableStockItem[]>([]);
  const [loadingDirectStock, setLoadingDirectStock] = useState(false);
  const [directItems, setDirectItems] = useState<{
    item_id: number;
    item_name: string;
    available_qty: number;
    qty: number | string;
    unit: string;
    smallest_unit: string;
    purchase_unit: string;
    conversion_ratio: number;
    unit_cost: number;
  }[]>([]);
  const [selectedDirectItemToAdd, setSelectedDirectItemToAdd] = useState<string>('');
  const [directNotes, setDirectNotes] = useState('');
  const [directError, setDirectError] = useState<string | null>(null);
  const [processingDirect, setProcessingDirect] = useState(false);

  // Fetch Outlets
  useEffect(() => {
    fetch('/api/outlets')
      .then(res => res.json())
      .then(data => {
        const list = Array.isArray(data) ? data : data.data || [];
        setOutlets(list);
      })
      .catch(() => {});
  }, []);

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

  // Load available stock when source outlet changes in Direct Transfer modal
  useEffect(() => {
    if (!directFromOutlet) {
      setDirectAvailableStock([]);
      setDirectItems([]);
      return;
    }

    setLoadingDirectStock(true);
    setDirectError(null);
    fetch(`/api/outlet/transfers/available-stock?source_outlet_id=${directFromOutlet}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setDirectAvailableStock(data.data || []);
        } else {
          setDirectAvailableStock([]);
        }
      })
      .catch(() => setDirectAvailableStock([]))
      .finally(() => setLoadingDirectStock(false));
  }, [directFromOutlet]);

  const handleOpenDetail = async (t: Transfer) => {
    setSelectedTransfer({ transfer: t, items: [] });
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/outlet/transfers/${t.id}`);
      const data = await res.json();
      if (data.success && data.data) {
        setSelectedTransfer(data.data);
      }
    } catch (err) {
      console.error('Error fetching detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleOpenAllocationModal = async (t: Transfer) => {
    setAllocationError(null);
    setSelectedSourceOutletForApproval(t.from_outlet_id ? String(t.from_outlet_id) : '');
    setLoadingStockComparison(true);

    try {
      const res = await fetch(`/api/outlet/transfers/${t.id}`);
      const data = await res.json();
      if (!data.success || !data.data) {
        alert('Gagal mengambil data mutasi.');
        return;
      }

      const transferDetail = data.data;
      setAllocatingTransfer(transferDetail);

      const itemIds = transferDetail.items.map((i: TransferItem) => i.item_id).join(',');
      if (itemIds) {
        const compRes = await fetch(`/api/outlet/transfers/stock-comparison?item_ids=${itemIds}`);
        const compData = await compRes.json();
        if (compData.success) {
          setStockComparisons(compData.data || []);
        }
      }
    } catch (err) {
      console.error('Error opening allocation modal:', err);
      alert('Terjadi kesalahan saat memuat data stok outlet.');
    } finally {
      setLoadingStockComparison(false);
    }
  };

  const checkOutletSufficiency = useCallback((outletId: number | string) => {
    if (!allocatingTransfer || !allocatingTransfer.items || allocatingTransfer.items.length === 0) {
      return { isSufficient: false, insufficientItems: [] };
    }
    const insufficientItems: { itemName: string; available: number; requested: number; unit: string; smallestUnit: string }[] = [];

    for (const it of allocatingTransfer.items) {
      const comp = stockComparisons.find(c => String(c.item_id) === String(it.item_id));
      const stockItem = comp?.stocks.find(s => String(s.outlet_id) === String(outletId));
      const balance = Number(stockItem?.current_balance || 0);

      const isPurchase = it.unit.trim().toLowerCase() === (it.purchase_unit || '').trim().toLowerCase();
      const isSmallest = it.unit.trim().toLowerCase() === (it.smallest_unit || '').trim().toLowerCase();
      const convRatio = Number(it.conversion_ratio) || 1;
      const requiredSmallest = isPurchase || (!isSmallest && convRatio > 1)
        ? Number(it.requested_qty) * convRatio
        : Number(it.requested_qty);

      if (balance < requiredSmallest) {
        insufficientItems.push({
          itemName: it.item_name,
          available: balance,
          requested: Number(it.requested_qty),
          unit: it.unit,
          smallestUnit: it.smallest_unit || it.unit,
        });
      }
    }

    return {
      isSufficient: insufficientItems.length === 0 && allocatingTransfer.items.length > 0,
      insufficientItems,
    };
  }, [allocatingTransfer, stockComparisons]);

  const handleApproveWithAllocation = async () => {
    if (!allocatingTransfer) return;

    if (!selectedSourceOutletForApproval) {
      setAllocationError('Silakan pilih outlet sumber pengirim.');
      return;
    }

    if (Number(selectedSourceOutletForApproval) === Number(allocatingTransfer.transfer.to_outlet_id)) {
      setAllocationError('Outlet pengirim tidak boleh sama dengan outlet pemohon.');
      return;
    }

    const suffCheck = checkOutletSufficiency(Number(selectedSourceOutletForApproval));
    if (!suffCheck.isSufficient) {
      setAllocationError(
        `Outlet ini tidak dapat dialokasikan karena stok tidak mencukupi untuk item: ${suffCheck.insufficientItems.map(i => `${i.itemName} (Tersedia: ${i.available} ${i.smallestUnit}, Dimohon: ${i.requested} ${i.unit})`).join(', ')}.`
      );
      return;
    }

    setProcessingAllocation(true);
    setAllocationError(null);

    try {
      const res = await fetch(`/api/outlet/transfers/${allocatingTransfer.transfer.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_outlet_id: Number(selectedSourceOutletForApproval),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setAllocatingTransfer(null);
        if (selectedTransfer && selectedTransfer.transfer.id === allocatingTransfer.transfer.id) {
          setSelectedTransfer(null);
        }
        fetchTransfers();
      } else {
        setAllocationError(data.message || 'Gagal menyetujui mutasi.');
      }
    } catch (err) {
      console.error('Error approving transfer:', err);
      setAllocationError('Terjadi kesalahan koneksi server.');
    } finally {
      setProcessingAllocation(false);
    }
  };

  const handleReject = async () => {
    if (!rejectingTransfer) return;
    if (!rejectionReason.trim()) {
      alert('Silakan isi alasan penolakan mutasi.');
      return;
    }

    setProcessingReject(true);
    try {
      const res = await fetch(`/api/outlet/transfers/${rejectingTransfer.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectionReason }),
      });
      const data = await res.json();
      if (data.success) {
        setRejectingTransfer(null);
        setRejectionReason('');
        if (selectedTransfer && selectedTransfer.transfer.id === rejectingTransfer.id) {
          setSelectedTransfer(null);
        }
        fetchTransfers();
      } else {
        alert(data.message || 'Gagal menolak mutasi.');
      }
    } catch (err) {
      console.error('Error rejecting transfer:', err);
      alert('Terjadi kesalahan server saat menolak mutasi.');
    } finally {
      setProcessingReject(false);
    }
  };

  // Direct Transfer Handlers
  const handleAddDirectItem = (itemIdParam?: string) => {
    const targetIdStr = itemIdParam || selectedDirectItemToAdd;
    if (!targetIdStr) return;

    const item = directAvailableStock.find(s => String(s.item_id) === String(targetIdStr));
    if (!item) {
      setDirectError('Barang tidak ditemukan dalam stok outlet asal.');
      return;
    }

    if (directItems.some(i => String(i.item_id) === String(item.item_id))) {
      setDirectError(`Item "${item.item_name}" sudah ada dalam daftar.`);
      return;
    }

    setDirectItems(prev => [
      ...prev,
      {
        item_id: Number(item.item_id),
        item_name: item.item_name,
        available_qty: Number(item.current_balance),
        qty: 1,
        unit: item.purchase_unit || item.smallest_unit,
        smallest_unit: item.smallest_unit,
        purchase_unit: item.purchase_unit,
        conversion_ratio: Number(item.conversion_ratio) || 1,
        unit_cost: Number(item.current_average_price) || 0,
      }
    ]);
    setSelectedDirectItemToAdd('');
    setDirectError(null);
  };

  const handleRemoveDirectItem = (itemId: number | string) => {
    setDirectItems(prev => prev.filter(i => String(i.item_id) !== String(itemId)));
  };

  const handleDirectItemQtyChange = (itemId: number | string, newQty: number | string) => {
    setDirectItems(prev => prev.map(i => {
      if (String(i.item_id) === String(itemId)) {
        return { ...i, qty: newQty };
      }
      return i;
    }));
  };

  const handleDirectItemUnitChange = (itemId: number | string, newUnit: string) => {
    setDirectItems(prev => prev.map(i => {
      if (String(i.item_id) === String(itemId)) {
        return { ...i, unit: newUnit };
      }
      return i;
    }));
  };

  const handleSubmitDirectTransfer = async () => {
    if (!directFromOutlet) {
      setDirectError('Silakan pilih outlet asal.');
      return;
    }
    if (!directToOutlet) {
      setDirectError('Silakan pilih outlet tujuan.');
      return;
    }
    if (directFromOutlet === directToOutlet) {
      setDirectError('Outlet asal dan outlet tujuan tidak boleh sama.');
      return;
    }
    if (directItems.length === 0) {
      setDirectError('Minimal harus memilih 1 barang.');
      return;
    }

    const invalidItem = directItems.find(i => (parseFloat(String(i.qty)) || 0) <= 0);
    if (invalidItem) {
      setDirectError(`Jumlah mutasi untuk "${invalidItem.item_name}" harus lebih dari 0.`);
      return;
    }

    for (const item of directItems) {
      const isPurchase = item.unit.toLowerCase() === (item.purchase_unit || '').toLowerCase();
      const numQty = parseFloat(String(item.qty)) || 0;
      const requiredSmallest = isPurchase ? numQty * item.conversion_ratio : numQty;
      if (requiredSmallest > item.available_qty) {
        setDirectError(`Jumlah mutasi untuk "${item.item_name}" (${item.qty} ${item.unit}) melebihi stok yang tersedia di outlet asal (${item.available_qty} ${item.smallest_unit}).`);
        return;
      }
    }

    setProcessingDirect(true);
    setDirectError(null);

    try {
      const res = await fetch('/api/outlet/transfers/direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_outlet_id: Number(directFromOutlet),
          to_outlet_id: Number(directToOutlet),
          notes: directNotes || 'Mutasi langsung dibuat oleh Admin Pusat',
          items: directItems.map(i => ({
            item_id: i.item_id,
            qty: parseFloat(String(i.qty)) || 0,
            unit: i.unit,
          })),
        }),
      });

      const result = await res.json();
      if (!result.success) {
        setDirectError(result.message || 'Gagal membuat mutasi langsung.');
        return;
      }

      setShowDirectModal(false);
      setDirectItems([]);
      setDirectFromOutlet('');
      setDirectToOutlet('');
      setDirectNotes('');
      fetchTransfers();
    } catch (err) {
      console.error('Error creating direct transfer:', err);
      setDirectError('Terjadi kesalahan server.');
    } finally {
      setProcessingDirect(false);
    }
  };

  // Filtered transfers
  const filteredTransfers = useMemo(() => {
    return transfers.filter(t => {
      // Outlet filter
      if (outletFilter !== 'ALL') {
        const oId = Number(outletFilter);
        if (t.from_outlet_id !== oId && t.to_outlet_id !== oId) return false;
      }

      // Status filter
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesNumber = t.transfer_number.toLowerCase().includes(q);
        const matchesFrom = (t.from_outlet_name || '').toLowerCase().includes(q);
        const matchesTo = (t.to_outlet_name || '').toLowerCase().includes(q);
        const matchesReq = (t.requested_by_name || '').toLowerCase().includes(q);
        const matchesNotes = (t.notes || '').toLowerCase().includes(q);
        if (!matchesNumber && !matchesFrom && !matchesTo && !matchesReq && !matchesNotes) return false;
      }

      return true;
    });
  }, [transfers, outletFilter, statusFilter, searchQuery]);

  return (
    <section className="screen">
      <div className="card">
        {/* Card Head with Clean Title and Integrated Filter Toolbar like Permintaan Outlet */}
        <div className="card-head" style={{ alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ margin: '0 0 12px 0' }}>Mutasi Antar Outlet</h3>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginTop: -4 }}>
            <input
              type="text"
              className="input"
              style={{ width: 220 }}
              placeholder="Cari no. mutasi atau outlet..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />

            <Select
              value={outletFilter}
              onChange={val => {
                setOutletFilter(String(val));
                setCurrentPage(1);
              }}
              options={[
                { value: 'ALL', label: 'Semua Outlet' },
                ...outlets.map(o => ({ value: String(o.id), label: o.name }))
              ]}
              style={{ width: 160 }}
              inputStyle={{ height: 32 }}
            />

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
              style={{ width: 155 }}
              inputStyle={{ height: 32 }}
            />

            <Button
              variant="primary"
              onClick={() => {
                setDirectFromOutlet('');
                setDirectToOutlet('');
                setDirectItems([]);
                setDirectNotes('');
                setDirectError(null);
                setShowDirectModal(true);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 4, height: 32, padding: '0 12px', fontSize: 12 }}
            >
              <Plus size={14} /> Buat Mutasi
            </Button>
          </div>
        </div>

        {/* Table Content (Clean Layout matching Permintaan Outlet) */}
        <div className="card-body flush">
          {loading ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Memuat data mutasi...</div>
          ) : filteredTransfers.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
              </svg>
              <h4>Belum ada data mutasi</h4>
              <p>Tidak ditemukan data permohonan mutasi dengan filter yang dipilih.</p>
            </div>
          ) : (
            <>
              <Table>
                <thead>
                  <tr>
                    <th>No. Mutasi</th>
                    <th>Outlet Pemohon (Tujuan)</th>
                    <th>Outlet Pengirim (Sumber)</th>
                    <th>Dibuat Oleh</th>
                    <th>Tanggal</th>
                    <th className="center">Barang</th>
                    <th className="center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransfers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map(t => (
                    <tr
                      key={t.id}
                      onClick={() => handleOpenDetail(t)}
                      style={{ cursor: 'pointer' }}
                      className="hover:bg-[#e6f3ec] transition-colors"
                    >
                      <td className="font-mono text-primary font-bold">
                        {t.transfer_number}
                      </td>
                      <td className="font-bold">
                        {t.to_outlet_name}
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
                      <td className="muted">
                        {t.requested_by_name?.replace('Coffeelab ', '') || '-'}
                      </td>
                      <td>
                        {new Date(t.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="center num font-bold">
                        {t.item_count || 1}
                      </td>
                      <td className="center">
                        <TransferStatusBadge status={t.status} />
                      </td>
                    </tr>
                  ))}
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

      {/* Modal 1: Detail Mutasi (Aksi Alokasi & Tolak Terintegrasi di Sini) */}
      <Modal
        isOpen={!!selectedTransfer}
        onClose={() => setSelectedTransfer(null)}
        title={`Detail Mutasi - ${selectedTransfer?.transfer.transfer_number || ''}`}
        maxWidth={850}
      >
        <div className="modal-body" style={{ padding: '16px 20px' }}>
          {selectedTransfer && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, padding: '12px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 16 }}>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block', fontWeight: 600 }}>OUTLET PEMOHON (TUJUAN)</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{selectedTransfer.transfer.to_outlet_name}</span>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block', fontWeight: 600 }}>OUTLET PENGIRIM (SUMBER)</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: selectedTransfer.transfer.from_outlet_name ? '#016e3f' : '#d97706' }}>
                    {selectedTransfer.transfer.from_outlet_name || 'Menunggu Alokasi'}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block', fontWeight: 600 }}>PEMOHON</span>
                  <span style={{ fontSize: 13, color: '#334155' }}>{selectedTransfer.transfer.requested_by_name || '-'}</span>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block', fontWeight: 600 }}>STATUS</span>
                  <div style={{ marginTop: 2 }}>
                    <TransferStatusBadge status={selectedTransfer.transfer.status} />
                  </div>
                </div>
              </div>

              {selectedTransfer.transfer.notes && (
                <div style={{ marginBottom: 16, padding: '10px 14px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 2 }}>
                    ALASAN / CATATAN:
                  </span>
                  <p style={{ margin: 0, fontSize: 13, color: '#334155' }}>
                    {selectedTransfer.transfer.notes}
                  </p>
                </div>
              )}

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

              <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
                {loadingDetail ? (
                  <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>Memuat detail barang...</div>
                ) : selectedTransfer.items.length === 0 ? (
                  <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>Data barang kosong.</div>
                ) : (
                  <Table>
                    <thead>
                      <tr>
                        <th>Barang</th>
                        <th>Kategori</th>
                        <th className="right">Jumlah Diminta</th>
                        <th className="center">Satuan</th>
                        <th className="right">HPP Satuan</th>
                        <th className="right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTransfer.items.map(item => (
                        <tr key={item.id}>
                          <td className="font-bold">{item.item_name}</td>
                          <td className="muted" style={{ textTransform: 'capitalize' }}>{item.category_name?.toLowerCase() || '-'}</td>
                          <td className="right font-bold num text-primary">
                            {parseFloat(Number(item.requested_qty).toFixed(3)).toLocaleString('id-ID')}
                          </td>
                          <td className="center muted font-bold">{item.unit}</td>
                          <td className="right num">{formatRupiah(item.cost_per_unit)}</td>
                          <td className="right num font-bold">{formatRupiah(item.subtotal_cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </div>

              {/* Action Buttons in Modal Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: 14 }}>
                <div>
                  {selectedTransfer.transfer.status === 'PENDING_APPROVAL' && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        setRejectingTransfer(selectedTransfer.transfer);
                        setRejectionReason('');
                      }}
                    >
                      <XCircle size={14} style={{ marginRight: 6 }} /> Tolak Mutasi
                    </Button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <Button variant="outline" size="sm" onClick={() => setSelectedTransfer(null)}>
                    Tutup
                  </Button>

                  {selectedTransfer.transfer.status === 'PENDING_APPROVAL' && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleOpenAllocationModal(selectedTransfer.transfer)}
                    >
                      <CheckCircle2 size={14} style={{ marginRight: 6 }} /> Alokasikan & Setujui
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Modal 2: Alokasikan & Setujui Mutasi */}
      <Modal
        isOpen={!!allocatingTransfer}
        onClose={() => setAllocatingTransfer(null)}
        title={`Alokasikan Outlet Pengirim - ${allocatingTransfer?.transfer.transfer_number || ''}`}
        maxWidth={720}
      >
        <div className="modal-body" style={{ padding: '16px 20px' }}>
          {allocatingTransfer && (
            <>
              {allocationError && (
                <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 6, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 16 }}>
                  {allocationError}
                </div>
              )}

              {/* Summary Bar Permintaan */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>OUTLET PEMOHON (TUJUAN):</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{allocatingTransfer.transfer.to_outlet_name}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginRight: 2 }}>BARANG DIMINTA:</span>
                  {allocatingTransfer.items.map(item => (
                    <span
                      key={item.id}
                      style={{
                        fontSize: 12,
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontWeight: 600,
                        color: '#0f172a'
                      }}
                    >
                      {item.item_name}: <strong style={{ color: '#016e3f' }}>{item.requested_qty} {item.unit}</strong>
                    </span>
                  ))}
                </div>
              </div>

              {/* Daftar Stok di Setiap Outlet Cabang (Pilih Outlet Pengirim) */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
                  Pilih Outlet Sumber Pengirim (Live Stok Seluruh Cabang): <span style={{ color: '#dc2626' }}>*</span>
                </label>

                {loadingStockComparison ? (
                  <div style={{ padding: '24px 16px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1' }}>
                    Memuat data live stok seluruh outlet...
                  </div>
                ) : (
                  <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                    <Table>
                      <thead>
                        <tr>
                          <th className="center" style={{ width: 60 }}>Pilih</th>
                          <th>Outlet Cabang</th>
                          <th className="center" style={{ minWidth: 160 }}>Stok Tersedia</th>
                          <th className="center" style={{ width: 120 }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {outlets
                          .filter(o => o.id !== allocatingTransfer.transfer.to_outlet_id)
                          .map(o => {
                            const check = checkOutletSufficiency(o.id);
                            const isSelected = String(o.id) === String(selectedSourceOutletForApproval);

                            return (
                              <tr
                                key={o.id}
                                onClick={() => {
                                  setSelectedSourceOutletForApproval(String(o.id));
                                  setAllocationError(null);
                                }}
                                style={{
                                  cursor: 'pointer',
                                  background: isSelected ? '#f0fdf4' : undefined,
                                  transition: 'background 0.15s ease',
                                }}
                              >
                                <td className="center" style={{ verticalAlign: 'middle' }}>
                                  <input
                                    type="radio"
                                    name="source_outlet_selection"
                                    checked={isSelected}
                                    onChange={() => {
                                      setSelectedSourceOutletForApproval(String(o.id));
                                      setAllocationError(null);
                                    }}
                                    style={{ cursor: 'pointer', accentColor: '#016e3f' }}
                                  />
                                </td>
                                <td style={{ verticalAlign: 'middle' }}>
                                  <span style={{ fontWeight: isSelected ? 800 : 600, color: isSelected ? '#016e3f' : '#1e293b' }}>
                                    {o.name}
                                  </span>
                                </td>
                                <td className="center" style={{ verticalAlign: 'middle' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    {allocatingTransfer.items.map(item => {
                                      const comp = stockComparisons.find(c => String(c.item_id) === String(item.item_id));
                                      const stockVal = comp?.stocks.find(s => s.outlet_id === o.id)?.current_balance || 0;

                                      const convRatio = Number(item.conversion_ratio) || 1;
                                      const isPurchase = item.unit.trim().toLowerCase() === (item.purchase_unit || '').trim().toLowerCase();
                                      const isSmallest = item.unit.trim().toLowerCase() === (item.smallest_unit || '').trim().toLowerCase();
                                      const requiredSmallest = isPurchase || (!isSmallest && convRatio > 1)
                                        ? Number(item.requested_qty) * convRatio
                                        : Number(item.requested_qty);

                                      const isItemEnough = stockVal >= requiredSmallest;

                                      return (
                                        <span
                                          key={item.id}
                                          style={{
                                            fontSize: 12,
                                            fontWeight: 700,
                                            color: isItemEnough ? '#16a34a' : stockVal > 0 ? '#d97706' : '#94a3b8'
                                          }}
                                        >
                                          {allocatingTransfer.items.length > 1 ? `${item.item_name}: ` : ''}
                                          {stockVal} {item.smallest_unit || item.unit}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </td>
                                <td className="center" style={{ verticalAlign: 'middle' }}>
                                  {check.isSufficient ? (
                                    <Badge variant="green">Stok Cukup</Badge>
                                  ) : (
                                    <Badge variant="amber">Stok Kurang</Badge>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </Table>
                  </div>
                )}
              </div>

              {/* Status Alert Terpilih */}
              {selectedSourceOutletForApproval && (() => {
                const check = checkOutletSufficiency(selectedSourceOutletForApproval);
                const selectedOutletName = outlets.find(o => String(o.id) === String(selectedSourceOutletForApproval))?.name;

                if (!check.isSufficient) {
                  return (
                    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '10px 14px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
                      <AlertCircle size={18} color="#d97706" style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: '#92400e' }}>
                        Stok di <strong>{selectedOutletName}</strong> tidak mencukupi untuk memenuhi permintaan mutasi ini.
                      </span>
                    </div>
                  );
                }

                return (
                  <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 6, padding: '10px 14px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
                    <CheckCircle2 size={18} color="#016e3f" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: '#065f46', fontWeight: 600 }}>
                      Stok di <strong>{selectedOutletName}</strong> mencukupi untuk memenuhi seluruh item mutasi.
                    </span>
                  </div>
                );
              })()}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid #e2e8f0', paddingTop: 14 }}>
                <Button variant="outline" onClick={() => setAllocatingTransfer(null)} disabled={processingAllocation}>
                  Batal
                </Button>
                <Button
                  variant="primary"
                  onClick={handleApproveWithAllocation}
                  disabled={
                    processingAllocation ||
                    !selectedSourceOutletForApproval ||
                    !checkOutletSufficiency(selectedSourceOutletForApproval).isSufficient
                  }
                >
                  {processingAllocation ? 'Menyetujui...' : 'Alokasikan & Setujui Mutasi'}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Modal 3: Tolak Mutasi */}
      <Modal
        isOpen={!!rejectingTransfer}
        onClose={() => setRejectingTransfer(null)}
        title={`Tolak Permohonan Mutasi - ${rejectingTransfer?.transfer_number || ''}`}
        maxWidth={500}
      >
        <div className="modal-body" style={{ padding: '16px 20px' }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>
              Alasan Penolakan: <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <textarea
              rows={3}
              placeholder="Tuliskan alasan mengapa mutasi ini ditolak (misal: semua cabang sedang menipis stoknya)..."
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
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

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button variant="outline" onClick={() => setRejectingTransfer(null)} disabled={processingReject}>
              Batal
            </Button>
            <Button
              variant="danger"
              onClick={handleReject}
              disabled={processingReject || !rejectionReason.trim()}
            >
              {processingReject ? 'Menolak...' : 'Konfirmasi Tolak Mutasi'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal 4: Buat Mutasi Langsung */}
      <Modal
        isOpen={showDirectModal}
        onClose={() => setShowDirectModal(false)}
        title="Buat Mutasi Langsung Antar Outlet"
        maxWidth={800}
      >
        <div className="modal-body" style={{ padding: '16px 20px' }}>
          {directError && (
            <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 6, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 16 }}>
              {directError}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>
                Outlet Asal (Pengirim): <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <Select
                value={directFromOutlet}
                onChange={val => setDirectFromOutlet(String(val))}
                options={[
                  { value: '', label: '-- Pilih Outlet Asal --' },
                  ...outlets.map(o => ({ value: String(o.id), label: o.name }))
                ]}
                style={{ width: '100%' }}
                inputStyle={{ height: 36 }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>
                Outlet Tujuan (Penerima): <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <Select
                value={directToOutlet}
                onChange={val => setDirectToOutlet(String(val))}
                options={[
                  { value: '', label: '-- Pilih Outlet Tujuan --' },
                  ...outlets.filter(o => String(o.id) !== String(directFromOutlet)).map(o => ({ value: String(o.id), label: o.name }))
                ]}
                style={{ width: '100%' }}
                inputStyle={{ height: 36 }}
              />
            </div>
          </div>

          {/* Pilih Barang dari Stok Outlet Asal */}
          {directFromOutlet && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>
                Pilih Barang dari Stok Outlet Asal:
              </label>
              <Select
                value={selectedDirectItemToAdd}
                onChange={val => {
                  setSelectedDirectItemToAdd(String(val));
                  handleAddDirectItem(String(val));
                }}
                options={[
                  { value: '', label: loadingDirectStock ? 'Memuat stok...' : '-- Pilih Barang --' },
                  ...directAvailableStock.map(it => ({
                    value: String(it.item_id),
                    label: `${it.item_name} - Sisa Stok: ${it.current_balance} ${it.smallest_unit}`
                  }))
                ]}
                style={{ width: '100%' }}
                inputStyle={{ height: 36 }}
              />
            </div>
          )}

          {/* Daftar Barang Mutasi Langsung */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>
              Daftar Barang yang Dimutasikan:
            </label>

            {directItems.length === 0 ? (
              <div style={{ padding: '24px 16px', border: '1px dashed #cbd5e1', borderRadius: 8, textAlign: 'center', color: '#64748b', fontSize: 13, background: '#f8fafc' }}>
                Pilih outlet asal dan barang di atas untuk menambahkan item mutasi.
              </div>
            ) : (
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <Table>
                  <thead>
                    <tr>
                      <th>Nama Barang</th>
                      <th>Tersedia</th>
                      <th style={{ width: 140 }}>Jumlah Mutasi</th>
                      <th style={{ width: 120 }}>Satuan</th>
                      <th className="center" style={{ width: 60 }}>Hapus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {directItems.map(item => (
                      <tr key={item.item_id}>
                        <td className="font-bold">{item.item_name}</td>
                        <td className="num muted">{item.available_qty} {item.smallest_unit}</td>
                        <td>
                          <Input
                            type="number"
                            min="0.1"
                            step="any"
                            value={item.qty}
                            onChange={e => handleDirectItemQtyChange(item.item_id, e.target.value)}
                            style={{ height: 32, fontSize: 13, fontWeight: 700 }}
                          />
                        </td>
                        <td>
                          <select
                            value={item.unit}
                            onChange={e => handleDirectItemUnitChange(item.item_id, e.target.value)}
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
                            onClick={() => handleRemoveDirectItem(item.item_id)}
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

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>
              Catatan Admin:
            </label>
            <textarea
              rows={2}
              placeholder="Catatan tambahan (opsional)..."
              value={directNotes}
              onChange={e => setDirectNotes(e.target.value)}
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
            <Button variant="outline" onClick={() => setShowDirectModal(false)} disabled={processingDirect}>
              Batal
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmitDirectTransfer}
              disabled={processingDirect || directItems.length === 0}
            >
              {processingDirect ? 'Menyimpan...' : 'Kirim Mutasi Langsung'}
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
