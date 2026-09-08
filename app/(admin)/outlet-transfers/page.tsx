'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import { ArrowLeftRight, Plus, CheckCircle, XCircle, Eye, AlertCircle, Search, Building2, TrendingUp, Clock, Check, AlertTriangle } from 'lucide-react';

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

export default function CentralOutletTransfersPage() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [outlets, setOutlets] = useState<OutletOption[]>([]);

  // Filters & Pagination
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [outletFilter, setOutletFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(20);

  // Detail Modal State
  const [selectedTransfer, setSelectedTransfer] = useState<{
    transfer: Transfer;
    items: TransferItem[];
  } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Allocation & Approval Modal State (Admin selects source outlet)
  const [allocatingTransfer, setAllocatingTransfer] = useState<{
    transfer: Transfer;
    items: TransferItem[];
  } | null>(null);
  const [stockComparisons, setStockComparisons] = useState<ItemStockComparison[]>([]);
  const [loadingStockComparison, setLoadingStockComparison] = useState(false);
  const [selectedSourceOutletForApproval, setSelectedSourceOutletForApproval] = useState<string>('');
  const [allocationError, setAllocationError] = useState<string | null>(null);
  const [processingAllocation, setProcessingAllocation] = useState(false);

  // Reject Action States
  const [rejectingTransfer, setRejectingTransfer] = useState<Transfer | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processingReject, setProcessingReject] = useState(false);

  // Direct Transfer Modal State (Admin creates transfer directly)
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
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/outlet/transfers/${t.id}`);
      const data = await res.json();
      if (data.success) {
        setSelectedTransfer(data.data);
      }
    } catch (err) {
      console.error('Error fetching detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Open Allocation & Approval Modal
  const handleOpenAllocationModal = async (t: Transfer) => {
    setAllocationError(null);
    setSelectedSourceOutletForApproval(t.from_outlet_id ? String(t.from_outlet_id) : '');
    setLoadingStockComparison(true);

    try {
      // 1. Fetch transfer detail
      const res = await fetch(`/api/outlet/transfers/${t.id}`);
      const data = await res.json();
      if (!data.success || !data.data) {
        alert('Gagal mengambil data mutasi.');
        return;
      }

      const transferDetail = data.data;
      setAllocatingTransfer(transferDetail);

      // 2. Fetch stock comparison for all items in this transfer
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

  // Helper to check if an outlet has enough stock for all requested items in the transfer
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

  const selectedOutletSufficiency = useMemo(() => {
    if (!selectedSourceOutletForApproval || !allocatingTransfer) return null;
    return checkOutletSufficiency(selectedSourceOutletForApproval);
  }, [selectedSourceOutletForApproval, allocatingTransfer, checkOutletSufficiency]);

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

    // Validasi stok outlet sumber
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

  // Direct transfer helpers
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

  const calculateDirectSubtotal = (it: typeof directItems[0]) => {
    const isPurchase = it.unit.toLowerCase() === (it.purchase_unit || '').toLowerCase();
    const convRatio = Number(it.conversion_ratio) || 1;
    const cost = isPurchase ? (it.unit_cost * convRatio) : it.unit_cost;
    const numQty = parseFloat(String(it.qty)) || 0;
    return numQty * cost;
  };

  const totalDirectCost = useMemo(() => {
    return directItems.reduce((sum, item) => sum + calculateDirectSubtotal(item), 0);
  }, [directItems]);

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

    // Validasi ketersediaan stok
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

  // Stats
  const stats = useMemo(() => {
    const total = transfers.length;
    const pending = transfers.filter(t => t.status === 'PENDING_APPROVAL').length;
    const approved = transfers.filter(t => t.status === 'APPROVED').length;
    const completed = transfers.filter(t => t.status === 'COMPLETED').length;
    const totalHpp = transfers.filter(t => t.status === 'COMPLETED').reduce((acc, t) => acc + Number(t.total_cost || 0), 0);
    return { total, pending, approved, completed, totalHpp };
  }, [transfers]);

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

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesNumber = t.transfer_number.toLowerCase().includes(q);
        const matchesFrom = (t.from_outlet_name || '').toLowerCase().includes(q);
        const matchesTo = t.to_outlet_name.toLowerCase().includes(q);
        const matchesReq = (t.requested_by_name || '').toLowerCase().includes(q);
        const matchesNotes = (t.notes || '').toLowerCase().includes(q);
        if (!matchesNumber && !matchesFrom && !matchesTo && !matchesReq && !matchesNotes) return false;
      }

      return true;
    });
  }, [transfers, outletFilter, statusFilter, searchQuery]);

  // Reset page on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [outletFilter, statusFilter, searchQuery]);

  const totalPages = Math.ceil(filteredTransfers.length / itemsPerPage);
  const paginatedTransfers = useMemo(() => {
    return filteredTransfers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredTransfers, currentPage, itemsPerPage]);

  return (
    <section className="screen">
      {/* Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 8, background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={22} />
          </div>
          <div>
            <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, display: 'block' }}>Menunggu Alokasi</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: stats.pending > 0 ? '#d97706' : '#1e293b' }}>
              {stats.pending} Request
            </span>
          </div>
        </div>

        <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 8, background: '#dbeafe', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowLeftRight size={22} />
          </div>
          <div>
            <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, display: 'block' }}>Dalam Pengiriman</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#1e293b' }}>
              {stats.approved} Request
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
          <div style={{ width: 44, height: 44, borderRadius: 8, background: '#ecfdf5', color: '#016e3f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={22} />
          </div>
          <div>
            <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, display: 'block' }}>Total Nilai Selesai</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#016e3f' }}>
              {formatRupiah(stats.totalHpp)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Card */}
      <div className="card">
        {/* Table Toolbar */}
        <div style={{ borderBottom: '1px solid var(--border)', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
              Daftar Permohonan & Pengiriman Mutasi Antar Cabang
            </span>
            <span style={{ fontSize: 12, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>
              {filteredTransfers.length} total
            </span>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: 220 }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Cari nomor, outlet, pemohon..."
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
              value={outletFilter}
              onChange={val => setOutletFilter(String(val))}
              options={[
                { value: 'ALL', label: 'Semua Outlet' },
                ...outlets.map(o => ({ value: String(o.id), label: o.name }))
              ]}
              style={{ width: 170 }}
              inputStyle={{ height: 34 }}
            />

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
              style={{ width: 150 }}
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
                setDirectFromOutlet('');
                setDirectToOutlet('');
                setDirectItems([]);
                setDirectNotes('');
                setDirectError(null);
                setShowDirectModal(true);
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
              <Plus size={16} /> Buat Mutasi Langsung
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
              <h4 style={{ margin: '0 0 6px', color: '#334155' }}>Tidak Ada Data Mutasi</h4>
              <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
                Tidak ditemukan permohonan mutasi antar outlet dengan filter yang dipilih.
              </p>
            </div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>No. Mutasi</th>
                  <th>Tanggal</th>
                  <th>Outlet Pemohon (Tujuan)</th>
                  <th>Outlet Sumber (Pengirim)</th>
                  <th>Pemohon</th>
                  <th className="center">Total Item</th>
                  <th className="right">Estimasi Nilai HPP</th>
                  <th className="center">Status</th>
                  <th className="center" style={{ width: 130 }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTransfers.map(t => {
                  const statusInfo = STATUS_CONFIG[t.status] || { label: t.status, color: '#64748b', bg: '#f1f5f9', border: '#e2e8f0' };
                  const isPending = t.status === 'PENDING_APPROVAL';

                  return (
                    <tr key={t.id} className="hover-row">
                      <td style={{ fontWeight: 700, color: '#016e3f', fontFamily: 'monospace' }}>
                        {t.transfer_number}
                      </td>
                      <td style={{ fontSize: 13, color: '#475569' }}>
                        {new Date(t.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td style={{ fontWeight: 600, color: '#1e293b' }}>
                        {t.to_outlet_name}
                      </td>
                      <td style={{ fontWeight: 600, color: '#1e293b' }}>
                        {t.from_outlet_name ? (
                          t.from_outlet_name
                        ) : t.status === 'REJECTED' || t.status === 'CANCELLED' ? (
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '2px 8px', borderRadius: 4, display: 'inline-flex', alignItems: 'center' }}>
                            Batal Dialokasikan
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#d97706', background: '#fef3c7', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Clock size={11} /> Belum Dialokasikan
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: 13, color: '#64748b' }}>
                        {t.requested_by_name || '-'}
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

                          {isPending && (
                            <>
                              <button
                                onClick={() => handleOpenAllocationModal(t)}
                                title="Alokasikan & Setujui Mutasi"
                                style={{
                                  padding: '0 10px',
                                  height: 32,
                                  borderRadius: 6,
                                  border: '1px solid #86efac',
                                  background: '#f0fdf4',
                                  color: '#16a34a',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  fontWeight: 700,
                                  fontSize: 12,
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                <CheckCircle size={15} /> Alokasikan
                              </button>

                              <button
                                onClick={() => {
                                  setRejectingTransfer(t);
                                  setRejectionReason('');
                                }}
                                title="Tolak Mutasi"
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: 6,
                                  border: '1px solid #fca5a5',
                                  background: '#fef2f2',
                                  color: '#dc2626',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                <XCircle size={16} />
                              </button>
                            </>
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

      {/* ALLOCATION & APPROVAL MODAL */}
      {allocatingTransfer && (
        <Modal
          isOpen={Boolean(allocatingTransfer)}
          onClose={() => {
            if (!processingAllocation) {
              setAllocatingTransfer(null);
            }
          }}
          title={`Alokasi & Persetujuan Mutasi: ${allocatingTransfer.transfer.transfer_number}`}
          maxWidth={850}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '4px 0' }}>
            {/* Request Summary Info */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>Outlet Pemohon (Tujuan):</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{allocatingTransfer.transfer.to_outlet_name}</span>
              </div>
              <div>
                <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>Diajukan Oleh:</span>
                <span style={{ fontSize: 13, color: '#334155' }}>
                  {allocatingTransfer.transfer.requested_by_name || '-'} ({new Date(allocatingTransfer.transfer.created_at).toLocaleString('id-ID')})
                </span>
              </div>
              {allocatingTransfer.transfer.notes && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>Alasan / Catatan Mendesak:</span>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#334155', fontStyle: 'italic', background: '#ffffff', padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                    "{allocatingTransfer.transfer.notes}"
                  </p>
                </div>
              )}
            </div>

            {/* Requested Items & Live Stock Comparison Table */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: '#334155', margin: 0 }}>
                  Perbandingan Stok Barang di Cabang Calon Pengirim (Selain Outlet Pemohon)
                </h4>
                {loadingStockComparison && (
                  <span style={{ fontSize: 12, color: '#016e3f', fontWeight: 600 }}>Memuat live stok cabang...</span>
                )}
              </div>

              <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                      <th style={{ padding: '10px 14px', fontWeight: 700 }}>Item yang Diminta</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700, textAlign: 'center' }}>Jumlah Diminta</th>
                      {outlets
                        .filter(o => String(o.id) !== String(allocatingTransfer.transfer.to_outlet_id))
                        .map(o => (
                          <th
                            key={o.id}
                            style={{
                              padding: '10px 14px',
                              fontWeight: 700,
                              textAlign: 'center',
                              background: '#f8fafc',
                              color: '#475569',
                            }}
                          >
                            {o.name.replace(/coffee lab|coffeelab/i, '').trim()}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allocatingTransfer.items.map((it, idx) => {
                      const comp = stockComparisons.find(c => String(c.item_id) === String(it.item_id));
                      const isPurchase = it.unit.trim().toLowerCase() === (it.purchase_unit || '').trim().toLowerCase();
                      const isSmallest = it.unit.trim().toLowerCase() === (it.smallest_unit || '').trim().toLowerCase();
                      const convRatio = Number(it.conversion_ratio) || 1;
                      const requiredSmallest = isPurchase || (!isSmallest && convRatio > 1)
                        ? Number(it.requested_qty) * convRatio
                        : Number(it.requested_qty);

                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>{it.item_name}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#016e3f' }}>
                            {it.requested_qty} {it.unit}
                          </td>
                          {outlets
                            .filter(o => String(o.id) !== String(allocatingTransfer.transfer.to_outlet_id))
                            .map(o => {
                              const stockItem = comp?.stocks.find(s => String(s.outlet_id) === String(o.id));
                              const balance = Number(stockItem?.current_balance || 0);
                              const isEnough = balance >= requiredSmallest;

                              return (
                                <td
                                  key={o.id}
                                  style={{
                                    padding: '10px 14px',
                                    textAlign: 'center',
                                    background: isEnough ? '#f0fdf4' : '#fff',
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: 12,
                                      fontWeight: 700,
                                      color: isEnough ? '#16a34a' : '#dc2626',
                                    }}
                                  >
                                    {balance} {it.smallest_unit || it.unit}
                                  </span>
                                  <div
                                    style={{
                                      fontSize: 11,
                                      marginTop: 3,
                                      fontWeight: 700,
                                      display: 'inline-block',
                                      padding: '2px 8px',
                                      borderRadius: 4,
                                      background: isEnough ? '#dcfce7' : '#fee2e2',
                                      color: isEnough ? '#166534' : '#dc2626',
                                    }}
                                  >
                                    {isEnough ? 'Stok Cukup' : 'Stok Kurang'}
                                  </div>
                                </td>
                              );
                            })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Source Outlet Selector */}
            <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
                Pilih Outlet Sumber (Cabang yang Akan Mengirimkan Barang) <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <Select
                value={selectedSourceOutletForApproval}
                onChange={val => {
                  setSelectedSourceOutletForApproval(String(val));
                  setAllocationError(null);
                }}
                options={[
                  { value: '', label: '-- Pilih Outlet Sumber Pengirim --' },
                  ...outlets
                    .filter(o => String(o.id) !== String(allocatingTransfer.transfer.to_outlet_id))
                    .map(o => {
                      const suff = checkOutletSufficiency(o.id);
                      return {
                        value: String(o.id),
                        label: `${o.name} — (${suff.isSufficient ? 'Stok Cukup' : 'Stok Kurang'})`,
                      };
                    })
                ]}
                placeholder="-- Pilih Outlet Sumber Pengirim --"
                searchable={true}
                style={{ width: '100%' }}
                inputStyle={{ height: 42, fontSize: 14, fontWeight: 600 }}
              />

              {/* Insufficient Stock Alert */}
              {selectedOutletSufficiency && !selectedOutletSufficiency.isSufficient && (
                <div style={{ padding: '12px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 13, marginTop: 12, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <strong style={{ display: 'block', marginBottom: 2 }}>Peringatan: Stok Outlet Tidak Mencukupi</strong>
                    <span>Outlet ini tidak memiliki stok yang cukup untuk memenuhi permohonan mutasi:</span>
                    <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                      {selectedOutletSufficiency.insufficientItems.map((ins, i) => (
                        <li key={i} style={{ marginTop: 2 }}>
                          <strong>{ins.itemName}</strong>: Tersedia <strong>{ins.available} {ins.smallestUnit}</strong> (Dimohon: <strong>{ins.requested} {ins.unit}</strong>)
                        </li>
                      ))}
                    </ul>
                    <span style={{ display: 'block', marginTop: 6, fontSize: 12, color: '#991b1b', fontStyle: 'italic' }}>
                      Permohonan mutasi tidak dapat dialokasikan ke cabang ini karena stok kurang.
                    </span>
                  </div>
                </div>
              )}

              {/* Sufficient Stock Confirmation */}
              {selectedOutletSufficiency && selectedOutletSufficiency.isSufficient && (
                <div style={{ padding: '8px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, color: '#166534', fontSize: 12, marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle size={15} style={{ flexShrink: 0 }} />
                  <span>Stok di outlet ini <strong>mencukupi</strong> untuk memenuhi seluruh barang yang dimohonkan.</span>
                </div>
              )}

              <span style={{ fontSize: 12, color: '#64748b', marginTop: 8, display: 'block' }}>
                Pilih outlet yang memiliki status <strong>(Stok Cukup)</strong> berdasarkan ketersediaan stok cabang.
              </span>
            </div>

            {/* Actions */}
            <div style={{ marginTop: 10, paddingTop: 14, borderTop: '1px solid #e2e8f0' }}>
              {allocationError && (
                <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 13, display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
                  <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <strong style={{ display: 'block', marginBottom: 2 }}>Gagal Mengalokasikan Mutasi</strong>
                    <span>{allocationError}</span>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setAllocatingTransfer(null)}
                  disabled={processingAllocation}
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
                  onClick={handleApproveWithAllocation}
                  disabled={
                    processingAllocation ||
                    loadingStockComparison ||
                    (selectedOutletSufficiency ? !selectedOutletSufficiency.isSufficient : false)
                  }
                  style={{
                    padding: '9px 20px',
                    borderRadius: 6,
                    border: 'none',
                    background:
                      (selectedOutletSufficiency && !selectedOutletSufficiency.isSufficient) ||
                      loadingStockComparison
                        ? '#94a3b8'
                        : '#016e3f',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor:
                      (selectedOutletSufficiency && !selectedOutletSufficiency.isSufficient) ||
                      processingAllocation ||
                      loadingStockComparison
                        ? 'not-allowed'
                        : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: '0 1px 2px rgba(1, 110, 63, 0.2)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {processingAllocation ? 'Menyetujui & Mengalokasikan...' : 'Alokasikan & Setujui Mutasi'}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* DIRECT TRANSFER MODAL (ADMIN CREATES TRANSFER) */}
      {showDirectModal && (
        <Modal
          isOpen={showDirectModal}
          onClose={() => {
            if (!processingDirect) {
              setShowDirectModal(false);
              setDirectError(null);
            }
          }}
          title="Buat Mutasi Langsung Antar Outlet (Admin Pusat)"
          maxWidth={800}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '4px 0' }}>
            {/* Outlet Selection */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
                  Outlet Asal (Sumber Pengirim) <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <Select
                  value={directFromOutlet}
                  onChange={val => {
                    setDirectFromOutlet(String(val));
                    setDirectItems([]);
                    setSelectedDirectItemToAdd('');
                  }}
                  options={[
                    { value: '', label: '-- Pilih Outlet Asal --' },
                    ...outlets.map(o => ({ value: String(o.id), label: o.name }))
                  ]}
                  searchable={true}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
                  Outlet Tujuan (Penerima) <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <Select
                  value={directToOutlet}
                  onChange={val => setDirectToOutlet(String(val))}
                  options={[
                    { value: '', label: '-- Pilih Outlet Tujuan --' },
                    ...outlets
                      .filter(o => String(o.id) !== directFromOutlet)
                      .map(o => ({ value: String(o.id), label: o.name }))
                  ]}
                  searchable={true}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            {/* Item Selection from Source Outlet Stock */}
            {directFromOutlet && (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                    Pilih Barang dari Stok Outlet Asal
                  </span>
                  {loadingDirectStock && (
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#016e3f' }}>Memuat stok outlet asal...</span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                  <div style={{ flex: 1 }}>
                    <Select
                      value={selectedDirectItemToAdd}
                      onChange={val => {
                        const valStr = String(val);
                        setSelectedDirectItemToAdd(valStr);
                        setDirectError(null);
                      }}
                      options={directAvailableStock.map(item => ({
                        value: String(item.item_id),
                        label: `${item.item_name} — (Stok: ${item.current_balance} ${item.smallest_unit})`
                      }))}
                      placeholder={
                        directAvailableStock.length === 0
                          ? (loadingDirectStock ? 'Sedang memuat stok...' : 'Tidak ada data stok di outlet ini')
                          : '+ Cari dan pilih barang dari outlet asal...'
                      }
                      searchable={true}
                      disabled={loadingDirectStock || directAvailableStock.length === 0}
                      style={{ width: '100%' }}
                      inputStyle={{ height: 42, fontSize: 13 }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddDirectItem()}
                    disabled={!selectedDirectItemToAdd}
                    style={{
                      padding: '0 20px',
                      height: 42,
                      borderRadius: 8,
                      background: selectedDirectItemToAdd ? '#016e3f' : '#94a3b8',
                      color: '#ffffff',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: selectedDirectItemToAdd ? 'pointer' : 'not-allowed',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      whiteSpace: 'nowrap',
                      boxShadow: selectedDirectItemToAdd ? '0 1px 2px rgba(1, 110, 63, 0.2)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Plus size={16} /> Tambah Barang
                  </button>
                </div>

                {directItems.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: '#64748b', fontSize: 13, background: '#ffffff', border: '1px dashed #cbd5e1', borderRadius: 8 }}>
                    <div style={{ marginBottom: 4, fontWeight: 600, color: '#334155' }}>Belum ada barang yang dipilih</div>
                    <span>Pilih barang dari dropdown di atas.</span>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto', background: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                          <th style={{ padding: '10px 14px', fontWeight: 700 }}>Nama Barang</th>
                          <th style={{ padding: '10px 14px', fontWeight: 700 }}>Stok Asal</th>
                          <th style={{ padding: '10px 14px', fontWeight: 700, width: 100 }}>Jumlah</th>
                          <th style={{ padding: '10px 14px', fontWeight: 700, width: 130 }}>Satuan</th>
                          <th style={{ padding: '10px 14px', fontWeight: 700, textAlign: 'right' }}>Est. Nilai HPP</th>
                          <th style={{ padding: '10px 14px', width: 44, textAlign: 'center' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {directItems.map(it => {
                          const subtotal = calculateDirectSubtotal(it);
                          return (
                            <tr key={it.item_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>{it.item_name}</td>
                              <td style={{ padding: '10px 14px', color: '#64748b' }}>{it.available_qty} {it.smallest_unit}</td>
                              <td style={{ padding: '8px 10px' }}>
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  placeholder="0"
                                  value={it.qty}
                                  onChange={e => handleDirectItemQtyChange(it.item_id, e.target.value)}
                                  style={{ width: '100%', height: 36, padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 600 }}
                                />
                              </td>
                              <td style={{ padding: '8px 10px' }}>
                                <select
                                  value={it.unit}
                                  onChange={e => handleDirectItemUnitChange(it.item_id, e.target.value)}
                                  style={{ width: '100%', height: 36, padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, background: '#fff' }}
                                >
                                  {it.purchase_unit && <option value={it.purchase_unit}>{it.purchase_unit}</option>}
                                  <option value={it.smallest_unit}>{it.smallest_unit}</option>
                                </select>
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>{formatRupiah(subtotal)}</td>
                              <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                <button onClick={() => handleRemoveDirectItem(it.item_id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                                  <XCircle size={16} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                          <td colSpan={4} style={{ padding: '10px 14px', textAlign: 'right' }}>Total Estimasi Nilai Mutasi:</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', color: '#016e3f' }}>{formatRupiah(totalDirectCost)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
                Catatan Mutasi
              </label>
              <textarea
                value={directNotes}
                onChange={e => setDirectNotes(e.target.value)}
                placeholder="Catatan tujuan mutasi (misal: penyeimbangan stok berkala)..."
                rows={2}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>

            {/* Actions */}
            <div style={{ marginTop: 10, paddingTop: 14, borderTop: '1px solid #e2e8f0' }}>
              {directError && (
                <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 13, display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
                  <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <strong style={{ display: 'block', marginBottom: 2 }}>Data Mutasi Belum Lengkap</strong>
                    <span>{directError}</span>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowDirectModal(false)}
                  disabled={processingDirect}
                  style={{ padding: '9px 16px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSubmitDirectTransfer}
                  disabled={processingDirect}
                  style={{
                    padding: '9px 20px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#016e3f',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: processingDirect ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: '0 1px 2px rgba(1, 110, 63, 0.2)',
                  }}
                >
                  {processingDirect ? 'Menyimpan...' : 'Buat Mutasi & Eksekusi'}
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
                <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>Outlet Pemohon (Tujuan):</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{selectedTransfer.transfer.to_outlet_name}</span>
              </div>
              <div>
                <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>Outlet Sumber (Pengirim):</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
                  {selectedTransfer.transfer.from_outlet_name || (
                    selectedTransfer.transfer.status === 'REJECTED' || selectedTransfer.transfer.status === 'CANCELLED' ? (
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Batal Dialokasikan</span>
                    ) : (
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#d97706' }}>Belum Dialokasikan</span>
                    )
                  )}
                </span>
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
              {selectedTransfer.transfer.status === 'PENDING_APPROVAL' && (
                <button
                  onClick={() => {
                    const t = selectedTransfer.transfer;
                    setSelectedTransfer(null);
                    handleOpenAllocationModal(t);
                  }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#016e3f',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <CheckCircle size={16} /> Alokasikan & Setujui
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* REJECT MODAL */}
      {rejectingTransfer && (
        <Modal
          isOpen={Boolean(rejectingTransfer)}
          onClose={() => {
            if (!processingReject) {
              setRejectingTransfer(null);
              setRejectionReason('');
            }
          }}
          title={`Tolak Mutasi: ${rejectingTransfer.transfer_number}`}
          maxWidth={500}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ margin: 0, fontSize: 13, color: '#475569' }}>
              Berikan alasan penolakan permohonan mutasi dari <strong>{rejectingTransfer.to_outlet_name}</strong> agar staf outlet dapat memahaminya.
            </p>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                Alasan Penolakan <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="Contoh: Stok di seluruh outlet terdekat sedang minim, disarankan order langsung ke Gudang Pusat..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  fontSize: 13,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 10, borderTop: '1px solid #e2e8f0' }}>
              <button
                type="button"
                onClick={() => setRejectingTransfer(null)}
                disabled={processingReject}
                style={{
                  padding: '8px 14px',
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
                onClick={handleReject}
                disabled={processingReject || !rejectionReason.trim()}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: 'none',
                  background: !rejectionReason.trim() ? '#fca5a5' : '#dc2626',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: !rejectionReason.trim() || processingReject ? 'not-allowed' : 'pointer',
                }}
              >
                {processingReject ? 'Menolak...' : 'Tolak Mutasi'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
