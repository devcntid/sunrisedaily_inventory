'use client';

import { useRouter } from 'next/navigation';

import { useState, useEffect, Fragment, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import { Toast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { RefreshCcw, Search, Info, Calendar, DollarSign, Package, Download, Zap, Loader2, Bell, Store, AlertCircle, X, ExternalLink } from 'lucide-react';
import { CombinedStockView } from './CombinedStockView';
import { DistributionHistoryView } from './DistributionHistoryView';

interface Outlet {
  id: number;
  name: string;
  last_request_date?: string | null;
  last_do_date?: string | null;
  last_sales_sync?: string | null;
}
interface Category { id: number; name: string; }
interface Item { id: number; name: string; sku: string; category_id: number; minimum_threshold: number; smallest_unit: string; central_stock: number; conversion_ratio: number; purchase_unit?: string; }
interface ConsumedMaterial {
  item_id: number;
  item_name: string;
  smallest_unit: string;
  purchase_unit: string;
  conversion_ratio: number;
  total_consumed_smallest: number;
  consumed_display: string;
}
interface SoldProduct {
  name: string;
  category_name: string;
  item_sold: number;
  net_sales: number;
}
interface OutletConsumptionSummary {
  outlet_id: number;
  last_do_date: string | null;
  last_request_date: string | null;
  total_revenue: number;
  total_qty_sold: number;
  consumed_materials: ConsumedMaterial[];
  sold_products: SoldProduct[];
  period_start_date: string;
}

export default function StockMonitoringPage() {
  const router = useRouter();
  const [data, setData] = useState<{
    outlets: Outlet[];
    items: Item[];
    stockMatrix: Record<number, Record<number, any>>;
    categories: Category[];
    consumptionMap?: Record<number, OutletConsumptionSummary>;
  } | null>(null);

  const [activeTab, setActiveTab] = useState<'PER_OUTLET' | 'GABUNGAN' | 'HISTORY'>('PER_OUTLET');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ open: false, message: '', type: 'success' as 'success' | 'error' | 'info' });
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOutlet, setFilterOutlet] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL'); // ALL, KRITIS, AMAN
  const [filterCategory, setFilterCategory] = useState('ALL');

  const [appliedFilterOutlet, setAppliedFilterOutlet] = useState('ALL');
  const [appliedFilterStatus, setAppliedFilterStatus] = useState('ALL');
  const [appliedFilterCategory, setAppliedFilterCategory] = useState('ALL');

  const applyFilters = () => {
    setAppliedFilterOutlet(filterOutlet);
    setAppliedFilterStatus(filterStatus);
    setAppliedFilterCategory(filterCategory);
    setCurrentPage(1);
  };

  const [showLegendTooltip, setShowLegendTooltip] = useState(false);
  const [showAllMaterials, setShowAllMaterials] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // State untuk Sync Moka Modal
  const [syncModal, setSyncModal] = useState(false);
  const [syncFromDate, setSyncFromDate] = useState(() => {
    const now = new Date();
    return new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 10);
  });
  const [syncToDate, setSyncToDate] = useState(() => {
    const now = new Date();
    return new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 10);
  });
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);
  useEffect(() => { syncingRef.current = syncing; }, [syncing]);
  const [transferring, setTransferring] = useState(false);
  const [showLowStockModal, setShowLowStockModal] = useState(false);
  const [modalFilterOutlet, setModalFilterOutlet] = useState('ALL');
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  
  const previousLowStocksCount = useRef<number | null>(null);



  const { criticalItems, totalLowStocks } = useMemo(() => {
    if (!data) return { criticalItems: [], totalLowStocks: 0 };
    const criticalItemIds = new Set<number>();
    let totalLowStocks = 0;
    
    data.outlets.forEach((outlet: Outlet) => {
      data.items.forEach((item: Item) => {
        const minStock = Number(item.minimum_threshold) || 0;
        if (minStock > 0) {
          const matrixData = data.stockMatrix[item.id]?.[outlet.id];
          const isApplicable = typeof matrixData === 'object' && matrixData !== null ? matrixData.is_applicable !== false : true;
          const qty = typeof matrixData === 'object' && matrixData !== null ? matrixData.stock_smallest : (typeof matrixData === 'number' ? matrixData : 0);
          
          if (isApplicable && qty <= minStock * 1.5) {
            criticalItemIds.add(item.id);
            totalLowStocks++;
          }
        }
      });
    });
    
    const criticalItemsList = data.items.filter((item: Item) => criticalItemIds.has(item.id));
    return { criticalItems: criticalItemsList, totalLowStocks };
  }, [data]);

  useEffect(() => {
    if (data) {
      if (previousLowStocksCount.current !== null && totalLowStocks > previousLowStocksCount.current) {
        const diff = totalLowStocks - previousLowStocksCount.current;
        setToast({ 
          open: true, 
          message: `Ada penambahan ${diff} barang yang stoknya menjadi kritis di outlet! (Total: ${totalLowStocks})`, 
          type: 'error' 
        });
      }
      
      previousLowStocksCount.current = totalLowStocks;
    }
  }, [data, totalLowStocks]);

  const handleCreateDO = (outletId: number) => {
    if (!data) return;
    const itemsToShip: number[] = [];
    
    data.items.forEach(item => {
      const minStock = Number(item.minimum_threshold) || 0;
      if (minStock > 0) {
        const matrixData = data.stockMatrix[item.id]?.[outletId];
        const isApplicable = typeof matrixData === 'object' && matrixData !== null ? matrixData.is_applicable !== false : true;
        const qty = typeof matrixData === 'object' && matrixData !== null ? matrixData.stock_smallest : (typeof matrixData === 'number' ? matrixData : 0);
        if (isApplicable && qty <= minStock * 1.5) {
          itemsToShip.push(item.id);
        }
      }
    });

    if (itemsToShip.length === 0) {
      setToast({ open: true, message: 'Tidak ada barang yang menipis untuk outlet ini.', type: 'info' });
      return;
    }

    router.push(`/delivery-orders/create?order_id=DIRECT&outlet_id=${outletId}&items=${itemsToShip.join(',')}`);
  };



  const handleSyncMoka = async () => {
    if (!syncFromDate || !syncToDate) {
      setToast({ open: true, message: 'Tanggal Mulai dan Sampai harus diisi', type: 'error' });
      return;
    }
    setSyncing(true);
    try {
      const res = await fetch('/api/moka/sync/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date: syncFromDate, end_date: syncToDate })
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Gagal menyinkronkan data Moka');
      }
      setToast({ open: true, message: json.message || 'Sinkronisasi berhasil!', type: 'success' });
      setSyncModal(false);

      if (json.unmatched_menus && json.unmatched_menus.length > 0) {
        const textContent = "Daftar Menu Moka yang tidak ditemukan resepnya di sistem:\n(Silakan lengkapi bahan dan takaran berikut untuk didaftarkan ke Master Menu & HPP)\n\n" + 
                            json.unmatched_menus.map((m: string) => 
                              `- ${m}\n  Bahan 1: ........................ | Takaran: .......... (Satuan Terkecil)\n  Bahan 2: ........................ | Takaran: .......... (Satuan Terkecil)\n  Bahan 3: ........................ | Takaran: .......... (Satuan Terkecil)\n`
                            ).join('\n') +
                            "\nHarap daftarkan menu dan resep di atas ke halaman Master Menu & HPP agar stok bahan dapat terpotong otomatis saat sync.";
        const blob = new Blob([textContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `menu-moka-tidak-cocok-${syncFromDate}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      await fetchData();
    } catch (err: unknown) {
      setToast({ open: true, message: (err instanceof Error ? err.message : 'Unknown error'), type: 'error' });
    } finally {
      setSyncing(false);
    }
  };


  const handleTriggerAllOutlets = async () => {
    setConfirmDialog({
      open: true,
      title: 'Trigger Semua Outlet',
      message: 'Apakah Anda yakin ingin memproses dan menyetujui seluruh pengiriman stok ke semua outlet secara otomatis sekarang?',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, open: false }));
        setTransferring(true);
        try {
          const res = await fetch('/api/outlet-monitoring/transfer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ approve_all_outlets: true })
          });
          const json = await res.json();
          if (!res.ok || !json.success) {
            throw new Error(json.message || 'Gagal memproses pengiriman');
          }
          const nowStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
          setToast({ open: true, message: `${json.message || 'Semua pengiriman berhasil diproses!'} (Tanggal pengiriman diperbarui ke ${nowStr})`, type: 'success' });
          await fetchData();
        } catch (err: unknown) {
          setToast({ open: true, message: (err instanceof Error ? err.message : 'Unknown error'), type: 'error' });
        } finally {
          setTransferring(false);
        }
      }
    });
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/outlet-monitoring');
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      setToast({ open: true, message: 'Gagal mengambil data matriks stok', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Auto-refresh when the window gains focus, but skip if we are currently syncing
    const handleFocus = () => {
      if (!syncingRef.current) {
        fetchData();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const formatUnit = (unit: string) => {
    if (!unit) return '';
    if (unit.toLowerCase() === 'l') return 'Liter';
    return unit;
  };

  const formatQty = (rawQty: number, conversionRatio: number = 1) => {
    const qty = rawQty / (conversionRatio || 1);
    return qty.toLocaleString('id-ID', { maximumFractionDigits: 2 });
  };

  const getStatus = (qty: number, rawMinStock: any) => {
    const minStock = Number(rawMinStock) || 0;
    if (minStock === 0) return 'AMAN'; // if no limit set, assume safe
    if (qty <= minStock) return 'KRITIS';
    if (qty <= minStock * 1.5) return 'MENIPIS';
    return 'AMAN';
  };

  // Filter Items
  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    return data.items.filter((item: Item) => {
      const matchSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.sku && item.sku.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchSearch) return false;
      if (appliedFilterCategory !== 'ALL' && String(item.category_id) !== appliedFilterCategory) return false;

      // Check outlet usage
      if (appliedFilterOutlet !== 'ALL') {
        // Show all items, just treat as 0 if not exist
      }

      if (appliedFilterStatus === 'ALL') return true;

      // Status filter
      let hasStatus = false;
      const outletsToCheck = appliedFilterOutlet === 'ALL'
        ? data.outlets
        : data.outlets.filter((o: Outlet) => String(o.id) === appliedFilterOutlet);

      for (const outlet of outletsToCheck) {
        const rawCell = data.stockMatrix[item.id]?.[outlet.id];
        const qty = typeof rawCell === 'object' && rawCell !== null ? rawCell.stock_smallest : (typeof rawCell === 'number' ? rawCell : 0);
        const status = getStatus(qty, item.minimum_threshold);
        if (appliedFilterStatus === 'KRITIS' && (status === 'KRITIS' || status === 'MENIPIS')) {
          hasStatus = true;
          break;
        }
        if (appliedFilterStatus === 'AMAN' && status === 'AMAN') {
          hasStatus = true;
          break;
        }
      }

      return hasStatus;
    });
  }, [data, searchTerm, appliedFilterCategory, appliedFilterOutlet, appliedFilterStatus]);

  // Reset page when itemsPerPage or searchTerm changes
  useEffect(() => {
    setCurrentPage(1);
  }, [itemsPerPage, searchTerm]);

  const visibleOutlets = appliedFilterOutlet === 'ALL'
    ? (data?.outlets || [])
    : (data?.outlets?.filter((o: Outlet) => String(o.id) === appliedFilterOutlet) || []);

  const totalItems = filteredItems?.length || 0;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedItems = filteredItems?.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const selectedOutletObj = appliedFilterOutlet !== 'ALL' ? data?.outlets?.find(o => String(o.id) === appliedFilterOutlet) : undefined;
  const selectedSummary = selectedOutletObj ? data?.consumptionMap?.[selectedOutletObj.id] : undefined;

  return (
    <section className="screen">
      <div className="card">
        <div className="card-head" style={{ padding: '16px 20px', borderBottom: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 className="text-gray-900" style={{ fontSize: '15px', margin: 0 }}>
              {activeTab === 'GABUNGAN' ? 'Laporan Stok Gabungan' : activeTab === 'HISTORY' ? 'Histori Distribusi Aset' : 'Pemantauan Stok'}
            </h3>
            <p className="text-gray-500 mt-1" style={{ fontSize: '12px', margin: '4px 0 0 0' }}>
              {activeTab === 'GABUNGAN'
                ? 'Rekapitulasi stok keseluruhan di seluruh lokasi.'
                : activeTab === 'HISTORY'
                ? 'Pantau total nilai aset barang yang telah didistribusikan ke masing-masing outlet.'
                : 'Pantau ketersediaan stok fisik secara live di seluruh cabang dan pusat.'}
            </p>
          </div>
        </div>

        <div className="tabs" style={{ marginBottom: 0, padding: '0 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8 }}>
          <button
            onClick={() => setActiveTab('PER_OUTLET')}
            style={{ cursor: 'pointer', background: 'none', border: 'none', borderBottom: activeTab === 'PER_OUTLET' ? '2px solid var(--primary)' : '2px solid transparent', padding: '8px 12px', fontSize: 12, fontWeight: activeTab === 'PER_OUTLET' ? 600 : 500, color: activeTab === 'PER_OUTLET' ? 'var(--primary)' : 'var(--muted)' }}
          >
            Matriks Stok
          </button>
          <button
            onClick={() => setActiveTab('GABUNGAN')}
            style={{ cursor: 'pointer', background: 'none', border: 'none', borderBottom: activeTab === 'GABUNGAN' ? '2px solid var(--primary)' : '2px solid transparent', padding: '8px 12px', fontSize: 12, fontWeight: activeTab === 'GABUNGAN' ? 600 : 500, color: activeTab === 'GABUNGAN' ? 'var(--primary)' : 'var(--muted)' }}
          >
            Total Gabungan
          </button>
          <button
            onClick={() => setActiveTab('HISTORY')}
            style={{ cursor: 'pointer', background: 'none', border: 'none', borderBottom: activeTab === 'HISTORY' ? '2px solid var(--primary)' : '2px solid transparent', padding: '8px 12px', fontSize: 12, fontWeight: activeTab === 'HISTORY' ? 600 : 500, color: activeTab === 'HISTORY' ? 'var(--primary)' : 'var(--muted)' }}
          >
            Histori Distribusi
          </button>
        </div>

        {activeTab === 'HISTORY' ? (
          <DistributionHistoryView />
        ) : activeTab === 'GABUNGAN' ? (
          <CombinedStockView categories={data?.categories || []} />
        ) : (
          <div className="card-body p-0">
            <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div className="text-gray-500 font-medium" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
                Matriks Stok Per Outlet
                <div
                  onMouseEnter={() => setShowLegendTooltip(true)}
                  onMouseLeave={() => setShowLegendTooltip(false)}
                  style={{ display: 'flex', alignItems: 'center' }}
                >
                  <Info size={14} style={{ cursor: 'help', color: '#94a3b8' }} />
                  {showLegendTooltip && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      marginTop: 6,
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      padding: '10px 14px',
                      borderRadius: 6,
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                      zIndex: 50,
                      width: 260,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Panduan Warna Teks</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#334155' }}>
                        <span style={{ fontWeight: 600, color: '#0f172a' }}>100</span> Stok Aman
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#334155' }}>
                        <span style={{ fontWeight: 600, color: '#eab308' }}>20</span> Stok Menipis (Hampir Kritis)
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#334155' }}>
                        <span style={{ fontWeight: 600, color: '#ef4444' }}>-5</span> Stok Kritis / Minus
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSyncModal(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, borderColor: '#016e3f', color: '#016e3f' }}
                  disabled={syncing}
                >
                  <RefreshCcw size={13} className={syncing ? 'animate-spin' : ''} />
                  {syncing ? 'Menyinkronkan...' : 'Sync Moka'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open('/api/outlet-monitoring/export', '_blank')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, borderColor: '#016e3f', color: '#016e3f' }}
                >
                  <Download size={13} />
                  Export Excel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleTriggerAllOutlets}
                  disabled={transferring}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, background: '#016e3f', color: '#ffffff', fontWeight: 600 }}
                  title="Otomatis proses & terima seluruh pengiriman ke semua outlet"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {transferring ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
                    {transferring ? 'Memproses...' : 'Trigger Semua Outlet'}
                  </div>
                </Button>
                {totalLowStocks > 0 && (
                  <button
                    onClick={() => setShowLowStockModal(true)}
                    title="Lihat Peringatan Stok"
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 32,
                      height: 32,
                      borderRadius: 6,
                      background: '#fef2f2',
                      color: '#ef4444',
                      border: '1px solid #fecaca',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fee2e2'}
                    onMouseLeave={e => e.currentTarget.style.background = '#fef2f2'}
                  >
                    <Bell size={16} />
                    <span style={{
                      position: 'absolute',
                      top: -8,
                      right: -12,
                      background: '#ef4444',
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 5px',
                      borderRadius: 10,
                      border: '2px solid #fff',
                      lineHeight: 1
                    }}>
                      {totalLowStocks}
                    </span>
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    className="input"
                    placeholder="Cari barang/SKU..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{ width: 180, padding: '6px 12px 6px 30px', fontSize: 12 }}
                  />
                </div>
                <Select
                  value={filterOutlet}
                  onChange={(val) => setFilterOutlet(String(val))}
                  options={[
                    { value: 'ALL', label: 'Semua Outlet' },
                    ...(data?.outlets?.map((outlet: Outlet) => ({ value: outlet.id.toString(), label: outlet.name })) || [])
                  ]}
                  style={{ width: 160 }}
                />
                <Select
                  value={filterCategory}
                  onChange={(val) => setFilterCategory(String(val))}
                  options={[
                    { value: 'ALL', label: 'Semua Kategori' },
                    ...(data?.categories?.map((cat: { id: number, name: string }) => ({ value: cat.id.toString(), label: cat.name })) || [])
                  ]}
                  style={{ width: 160 }}
                />
                <Select
                  value={filterStatus}
                  onChange={(val) => setFilterStatus(String(val))}
                  options={[
                    { value: 'ALL', label: 'Semua Kondisi' },
                    { value: 'KRITIS', label: 'Stok Kritis/Menipis' },
                    { value: 'AMAN', label: 'Stok Aman' }
                  ]}
                  style={{ width: 160 }}
                />
                <Button variant="primary" size="sm" onClick={applyFilters} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '0 12px', height: '100%', minHeight: 34 }}>
                  Terapkan Filter
                </Button>
              </div>
            </div>

            {/* Panel Intelijen Stok & Konsumsi Outlet */}
            {selectedOutletObj && (
              <div style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', padding: '14px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{selectedOutletObj.name}</span>
                    <span style={{ fontSize: 11, background: '#e2e8f0', color: '#475569', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>
                      Konsumsi Pasca-DO
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                      <Calendar className="w-3.5 h-3.5 text-[#016e3f]" />
                      <span>DO TERAKHIR</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                      {selectedOutletObj.last_do_date
                        ? new Date(selectedOutletObj.last_do_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                        : 'Belum ada DO'}
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
                      Order: {selectedOutletObj.last_request_date ? new Date(selectedOutletObj.last_request_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '-'}
                    </div>
                  </div>

                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                      <DollarSign className="w-3.5 h-3.5 text-[#016e3f]" />
                      <span>PENJUALAN MOKA</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                      Rp {(selectedSummary?.total_revenue || 0).toLocaleString('id-ID')}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                      {selectedSummary?.total_qty_sold || 0} porsi terjual
                    </div>
                  </div>

                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', gridColumn: 'span 2 / auto' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                      <Package size={14} style={{ color: '#64748b' }} />
                      <span>BAHAN DIHABISKAN (AUTO-DEDUCT MOKA)</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {selectedSummary?.consumed_materials && selectedSummary.consumed_materials.length > 0 ? (
                        <>
                          {selectedSummary.consumed_materials
                            .slice(0, showAllMaterials ? undefined : 6)
                            .map((m) => (
                              <span key={m.item_id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4 }}>
                                {m.item_name}: <span style={{ color: '#0f172a' }}>{m.consumed_display}</span>
                              </span>
                            ))}
                          {!showAllMaterials && selectedSummary.consumed_materials.length > 6 && (
                            <button
                              onClick={() => setShowAllMaterials(true)}
                              style={{ background: '#f1f5f9', border: '1px dashed #cbd5e1', color: '#64748b', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4, cursor: 'pointer', transition: 'all 0.2s' }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.borderColor = '#94a3b8'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                            >
                              + {selectedSummary.consumed_materials.length - 6} Lainnya
                            </button>
                          )}
                          {showAllMaterials && selectedSummary.consumed_materials.length > 6 && (
                            <button
                              onClick={() => setShowAllMaterials(false)}
                              style={{ background: 'transparent', border: 'none', color: '#016e3f', fontSize: 11, fontWeight: 600, padding: '3px 4px', cursor: 'pointer', textDecoration: 'underline' }}
                            >
                              Sembunyikan
                            </button>
                          )}
                        </>
                      ) : (
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>
                          Belum ada pemakaian bahan sejak DO terakhir.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="card-body flush">
              {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Memuat matriks stok...</div>
              ) : !data ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>Gagal memuat data.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <Table responsive={false} style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                    <thead>
                      <tr>
                        <th rowSpan={3} style={{ width: 180, minWidth: 180, maxWidth: 180, verticalAlign: 'middle', background: '#ffffff', borderBottom: '2px solid #e2e8f0', borderRight: '1px solid #e2e8f0', position: 'sticky', left: 0, zIndex: 20 }}>
                          Bahan / Produk
                        </th>
                        <th rowSpan={3} className="center" style={{ width: 120, minWidth: 120, maxWidth: 120, background: '#f8fafc', borderBottom: '2px solid #cbd5e1', borderRight: '2px solid #cbd5e1', fontWeight: 700, padding: '0 16px', position: 'sticky', left: 180, zIndex: 20, boxShadow: '2px 0 5px -2px rgba(0,0,0,0.1)' }}>
                          Gudang Pusat
                        </th>
                        {visibleOutlets.map(outlet => {
                          const shortName = outlet.name
                            .replace(/COFFE\s*E?\s*LAB/i, '')
                            .replace(/,/g, '')
                            .replace(/\s+/g, ' ')
                            .trim();
                          const lastDoStr = outlet.last_do_date
                            ? new Date(outlet.last_do_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                            : 'Belum ada DO';
                          return (
                            <th key={outlet.id} colSpan={7} className="center" style={{ borderBottom: '1px solid #cbd5e1', borderRight: '2px solid #cbd5e1', background: '#f8fafc', fontWeight: 700, padding: '8px 6px' }}>
                              <div style={{ fontSize: 13, color: '#0f172a', letterSpacing: '0.02em' }}>{shortName}</div>
                              <div style={{ fontSize: 10, fontWeight: 500, color: '#64748b', marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                <Calendar size={10} />
                                <span>DO Terakhir: {lastDoStr}</span>
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                      <tr>
                        {visibleOutlets.map(outlet => (
                          <Fragment key={outlet.id}>
                            <th rowSpan={2} className="center" style={{ fontSize: 10, background: '#fafaf9', color: '#475569', minWidth: 85, padding: '8px 6px', borderBottom: '1px solid #cbd5e1', fontWeight: 700, borderRight: '1px solid #cbd5e1' }}>Opname<br/>Fisik</th>
                            <th colSpan={2} className="center" style={{ fontSize: 10, background: '#ffffff', color: '#475569', padding: '4px', borderBottom: '1px solid #cbd5e1', borderRight: '1px solid #cbd5e1' }}>IN Satuan</th>
                            <th colSpan={2} className="center" style={{ fontSize: 10, background: '#f9fafb', color: '#475569', padding: '4px', borderBottom: '1px solid #cbd5e1', borderRight: '1px solid #cbd5e1' }}>OUT Satuan</th>
                            <th colSpan={2} className="center" style={{ fontSize: 10, background: '#f1f5f9', color: '#0f172a', padding: '4px', borderBottom: '1px solid #cbd5e1', borderRight: '2px solid #cbd5e1', fontWeight: 700 }}>LIVE STOCK</th>
                          </Fragment>
                        ))}
                      </tr>
                      <tr>
                        {visibleOutlets.map(outlet => (
                          <Fragment key={outlet.id}>
                            <th className="right" style={{ fontSize: 10, background: '#ffffff', color: '#64748b', minWidth: 100, padding: '8px 6px', borderBottom: '2px solid #e2e8f0' }}>Terkecil</th>
                            <th className="right" style={{ fontSize: 10, background: '#ffffff', color: '#64748b', minWidth: 100, padding: '8px 6px', borderBottom: '2px solid #e2e8f0', borderRight: '1px solid #cbd5e1' }}>Kemasan</th>
                            <th className="right" style={{ fontSize: 10, background: '#f9fafb', color: '#64748b', minWidth: 110, padding: '8px 6px', borderBottom: '2px solid #e2e8f0' }}>Terkecil</th>
                            <th className="right" style={{ fontSize: 10, background: '#f9fafb', color: '#64748b', minWidth: 120, padding: '8px 6px', borderBottom: '2px solid #e2e8f0', borderRight: '1px solid #cbd5e1' }}>Kemasan</th>
                            <th className="right" style={{ fontSize: 10, background: '#f1f5f9', color: '#334155', minWidth: 110, padding: '8px 6px', borderBottom: '2px solid #e2e8f0', fontWeight: 600 }}>Terkecil</th>
                            <th className="right" style={{ fontSize: 10, background: '#f1f5f9', color: '#334155', minWidth: 120, padding: '8px 6px', borderRight: '2px solid #cbd5e1', borderBottom: '2px solid #e2e8f0', fontWeight: 600 }}>Kemasan</th>
                          </Fragment>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedItems?.length === 0 ? (
                        <tr>
                          <td colSpan={visibleOutlets.length * 7 + 2} className="center muted">Tidak ada data ditemukan.</td>
                        </tr>
                      ) : (
                        paginatedItems?.map(item => {
                          const ratio = Number(item.conversion_ratio) || 1;
                          return (
                            <tr key={item.id} className="hover-row">
                              <td style={{ width: 180, minWidth: 180, maxWidth: 180, fontWeight: 600, borderRight: '1px solid #f1f5f9', background: '#ffffff', position: 'sticky', left: 0, zIndex: 10, whiteSpace: 'normal', wordWrap: 'break-word' }}>
                                {item.name}
                              </td>

                              {/* Gudang Pusat */}
                              <td className="right" style={{ width: 120, minWidth: 120, maxWidth: 120, padding: '8px 12px', background: '#f8fafc', borderRight: '2px solid #cbd5e1', whiteSpace: 'nowrap', position: 'sticky', left: 180, zIndex: 10, boxShadow: '2px 0 5px -2px rgba(0,0,0,0.1)' }}>
                                {Number(item.central_stock) <= 0 ? (
                                  <span style={{ color: '#ef4444', fontWeight: 600 }}>Kosong</span>
                                ) : (
                                  <>
                                    <div style={{ fontWeight: 700, color: '#0f172a' }}>
                                      {(Number(item.central_stock) / ratio).toLocaleString('id-ID', { maximumFractionDigits: 2 })} <span style={{ fontSize: 11, color: '#64748b', fontWeight: 400 }}>{formatUnit(item.purchase_unit || item.smallest_unit)}</span>
                                    </div>
                                    {ratio > 1 && (
                                      <div style={{ marginTop: 2, fontSize: 11, color: '#64748b' }}>
                                        {Number(item.central_stock).toLocaleString('id-ID', { maximumFractionDigits: 1 })} {item.smallest_unit}
                                      </div>
                                    )}
                                  </>
                                )}
                              </td>

                              {/* Tiap Outlet (6 Kolom) */}
                              {visibleOutlets.map(outlet => {
                                const rawCell = data.stockMatrix[item.id]?.[outlet.id];
                                const cell = typeof rawCell === 'object' && rawCell !== null ? rawCell : {
                                  in_smallest: 0,
                                  in_package: 0,
                                  out_smallest: 0,
                                  out_package: 0,
                                  cups_sold: 0,
                                  stock_smallest: typeof rawCell === 'number' ? rawCell : 0,
                                  stock_package: (typeof rawCell === 'number' ? rawCell : 0) / ratio
                                };

                                const status = getStatus(cell.stock_smallest, item.minimum_threshold);
                                let color = '#0f172a';
                                if (status === 'KRITIS') color = '#ef4444';
                                else if (status === 'MENIPIS') color = '#eab308';

                                const isHidden = (appliedFilterStatus === 'KRITIS' && status === 'AMAN') ||
                                                 (appliedFilterStatus === 'AMAN' && status !== 'AMAN');

                                if (isHidden) {
                                  return (
                                    <Fragment key={outlet.id}>
                                      <td colSpan={7} className="center" style={{ background: '#f8fafc', color: '#cbd5e1', borderRight: '2px solid #cbd5e1', borderBottom: '1px solid #e2e8f0', fontSize: 14 }}>
                                        -
                                      </td>
                                    </Fragment>
                                  );
                                }

                                return (
                                  <Fragment key={outlet.id}>
                                    {/* 5. OPNAME: stok fisik aktual dari opname terakhir (Titik Nol harian) */}
                                    <td className="right" style={{ padding: '8px 6px', background: '#fafaf9', borderRight: '1px solid #cbd5e1', whiteSpace: 'nowrap' }}
                                      title={cell.has_opname
                                        ? `Opname terakhir: ${new Date(cell.opname_date!).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} | IN sejak opname: +${cell.in_since_opname.toLocaleString('id-ID', { maximumFractionDigits: 1 })} | OUT sejak opname: -${cell.out_since_opname.toLocaleString('id-ID', { maximumFractionDigits: 1 })}`
                                        : 'Belum ada data opname untuk item ini'}
                                    >
                                      {cell.has_opname ? (
                                        <>
                                          <span style={{ fontWeight: 700, color: '#0f172a' }}>
                                            {cell.opname_qty.toLocaleString('id-ID', { maximumFractionDigits: 1 })}
                                          </span>{' '}
                                          <span style={{ fontSize: 11, color: '#94a3b8' }}>{item.smallest_unit}</span>
                                          {ratio > 1 && (
                                            <div style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>
                                              {cell.opname_qty_package.toLocaleString('id-ID', { maximumFractionDigits: 2 })} {formatUnit(item.purchase_unit || item.smallest_unit)}
                                            </div>
                                          )}
                                        </>
                                      ) : (
                                        <span style={{ color: '#cbd5e1', fontSize: 11 }}>—</span>
                                      )}
                                    </td>
                                    {/* 1. IN Terkecil */}
                                    <td className="right" style={{ padding: '8px 6px', background: '#ffffff', whiteSpace: 'nowrap' }}>
                                      <span style={{ fontWeight: 500, color: '#334155' }}>{cell.in_smallest.toLocaleString('id-ID', { maximumFractionDigits: 1 })}</span>{' '}
                                      <span style={{ fontSize: 11, color: '#94a3b8' }}>{item.smallest_unit}</span>
                                    </td>
                                    {/* 2. IN Kemasan */}
                                    <td className="right" style={{ padding: '8px 6px', background: '#ffffff', borderRight: '1px solid #cbd5e1', whiteSpace: 'nowrap' }}>
                                      <span style={{ fontWeight: 600, color: '#334155' }}>{cell.in_package.toLocaleString('id-ID', { maximumFractionDigits: 2 })}</span>{' '}
                                      <span style={{ fontSize: 11, color: '#94a3b8' }}>{formatUnit(item.purchase_unit || item.smallest_unit)}</span>
                                    </td>
                                    {/* 3. OUT Terkecil */}
                                    <td className="right" style={{ padding: '8px 6px', background: '#f9fafb', whiteSpace: 'nowrap' }}>
                                      <span style={{ fontWeight: 500, color: cell.out_smallest > 0 ? '#0f172a' : '#94a3b8' }}>
                                        {cell.out_smallest.toLocaleString('id-ID', { maximumFractionDigits: 1 })}
                                      </span>{' '}
                                      <span style={{ fontSize: 11, color: '#94a3b8' }}>{item.smallest_unit}</span>
                                    </td>
                                    {/* 4. OUT Kemasan + Cups */}
                                    <td className="right" style={{ padding: '8px 6px', background: '#f9fafb', borderRight: '1px solid #cbd5e1', whiteSpace: 'nowrap' }}>
                                      <div>
                                        <span style={{ fontWeight: 600, color: cell.out_package > 0 ? '#0f172a' : '#94a3b8' }}>
                                          {cell.out_package.toLocaleString('id-ID', { maximumFractionDigits: 2 })}
                                        </span>{' '}
                                        <span style={{ fontSize: 11, color: '#94a3b8' }}>{formatUnit(item.purchase_unit || item.smallest_unit)}</span>
                                      </div>
                                      {cell.cups_sold > 0 && (() => {
                                        const labelConsumed = cell.unit_consumed > 0
                                          ? `${cell.unit_consumed.toLocaleString('id-ID', { maximumFractionDigits: 2 })} ${item.smallest_unit}`
                                          : null;
                                        return (
                                          <div style={{ fontSize: 10, fontWeight: 600, color: '#475569', background: '#e2e8f0', display: 'inline-block', padding: '2px 5px', borderRadius: 4, marginTop: 3 }} title={`${cell.unit_consumed.toLocaleString('id-ID', { maximumFractionDigits: 2 })} ${item.smallest_unit} terpakai dari ${cell.cups_sold} cup terjual`}>
                                            {labelConsumed ? `${labelConsumed} → ` : ''}{cell.cups_sold} cup
                                          </div>
                                        );
                                      })()}
                                    </td>
                                    {/* 6. Live Stock Terkecil */}
                                    <td className="right" style={{ padding: '8px 6px', background: '#f1f5f9', whiteSpace: 'nowrap' }}>
                                      <span style={{ fontWeight: 500, color }}>{cell.stock_smallest.toLocaleString('id-ID', { maximumFractionDigits: 1 })}</span>{' '}
                                      <span style={{ fontSize: 11, color: '#94a3b8' }}>{item.smallest_unit}</span>
                                    </td>
                                    {/* 7. Live Stock Kemasan */}
                                    <td className="right" style={{ padding: '8px 6px', background: '#f1f5f9', borderRight: '2px solid #cbd5e1', whiteSpace: 'nowrap' }}>
                                      <span style={{ fontWeight: 700, color }}>{cell.stock_package.toLocaleString('id-ID', { maximumFractionDigits: 2 })}</span>{' '}
                                      <span style={{ fontSize: 11, color: '#94a3b8' }}>{formatUnit(item.purchase_unit || item.smallest_unit)}</span>
                                    </td>
                                  </Fragment>
                                );
                              })}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </Table>
                </div>
              )}
            </div>

            <Toast isOpen={toast.open} message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, open: false })} />

            {!loading && data && (
              <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#64748b' }}>
                  <span>Tampilkan</span>
                  <Select
                    value={itemsPerPage.toString()}
                    onChange={(val) => setItemsPerPage(Number(val))}
                    options={[
                      { value: '10', label: '10' },
                      { value: '25', label: '25' },
                      { value: '50', label: '50' },
                      { value: '100', label: '100' }
                    ]}
                    style={{ width: 80, padding: '4px 8px', minHeight: 28 }}
                  />
                  <span>baris per halaman</span>
                </div>
                {totalPages > 1 && (
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPage}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* Modal 1: Sync Sales Moka */}
        <Modal
          isOpen={syncModal}
          onClose={() => setSyncModal(false)}
          title="Sync Penjualan Moka"
          maxWidth={400}
        >
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>
              Pilih rentang tanggal sinkronisasi:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Dari Tanggal
                </label>
                <input
                  type="date"
                  className="input"
                  value={syncFromDate}
                  onChange={e => setSyncFromDate(e.target.value)}
                  style={{ width: '100%', fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Sampai Tanggal
                </label>
                <input
                  type="date"
                  className="input"
                  value={syncToDate}
                  onChange={e => setSyncToDate(e.target.value)}
                  style={{ width: '100%', fontSize: 13 }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
              <Button variant="outline" onClick={() => setSyncModal(false)} disabled={syncing}>
                Batal
              </Button>
              <Button
                variant="primary"
                onClick={handleSyncMoka}
                disabled={syncing}
                style={{ background: '#016e3f', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <RefreshCcw size={14} className={syncing ? 'animate-spin' : ''} />
                {syncing ? 'Menyinkronkan...' : 'Sinkronkan'}
              </Button>
            </div>
          </div>
        </Modal>

        <Modal 
          isOpen={showLowStockModal} 
          onClose={() => setShowLowStockModal(false)} 
          title={`Peringatan Stok Menipis (${totalLowStocks} peringatan)`} 
          maxWidth={1000}
        >
          <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div style={{ position: 'relative', width: '350px' }}>
                <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  className="input"
                  placeholder="Cari nama barang..."
                  value={modalSearchTerm}
                  onChange={e => setModalSearchTerm(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px 8px 32px', fontSize: 13 }}
                />
              </div>
            </div>
            
            <div style={{ maxHeight: '55vh', overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <Table responsive={false} style={{ minWidth: 'max-content' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 20 }}>
                  <tr>
                    <th style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', background: '#f8fafc', left: 0, zIndex: 21, position: 'sticky', whiteSpace: 'nowrap' }}>Bahan / Produk</th>
                    {data?.outlets.map(outlet => (
                      <th key={outlet.id} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                          {outlet.name}
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleCreateDO(outlet.id)}
                            style={{ padding: '4px', height: 26, width: 26, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title={`Buat DO Langsung ke ${outlet.name}`}
                          >
                            <ExternalLink size={14} />
                          </Button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {criticalItems
                    .filter(item => !modalSearchTerm || item.name.toLowerCase().includes(modalSearchTerm.toLowerCase()))
                    .map((item, idx) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 12px', fontSize: 12, fontWeight: 500, color: '#0f172a', borderRight: '1px solid #e2e8f0', background: '#fff', left: 0, zIndex: 10, position: 'sticky', whiteSpace: 'nowrap' }}>
                        {item.name}
                      </td>
                      {data?.outlets.map(outlet => {
                        const minStock = Number(item.minimum_threshold) || 0;
                        const matrixData = data?.stockMatrix[item.id]?.[outlet.id];
                        const isApplicable = typeof matrixData === 'object' && matrixData !== null ? matrixData.is_applicable !== false : true;
                        const qty = typeof matrixData === 'object' && matrixData !== null ? matrixData.stock_smallest : (typeof matrixData === 'number' ? matrixData : 0);
                        
                        let isKritis = false;
                        let isMenipis = false;
                        if (isApplicable && minStock > 0) {
                          if (qty <= minStock) isKritis = true;
                          else if (qty <= minStock * 1.5) isMenipis = true;
                        }
                        const isLow = isKritis || isMenipis;
                        
                        return (
                          <td key={outlet.id} style={{ 
                            padding: '8px 12px', 
                            fontSize: 12, 
                            textAlign: 'right',
                            background: '#fff',
                            borderRight: '1px solid #e2e8f0',
                            whiteSpace: 'nowrap'
                          }}>
                            {!isApplicable ? (
                              <div style={{ textAlign: 'center' }}>
                                <span style={{ color: '#cbd5e1' }}>—</span>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
                                <div style={{ textAlign: 'right' }}>
                                  <span style={{ fontSize: 9, color: '#94a3b8', display: 'block', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Min</span>
                                  <span style={{ color: '#64748b', fontWeight: 500 }}>{formatQty(minStock, 1)} {formatUnit(item.smallest_unit)}</span>
                                </div>
                                <div style={{ width: 1, height: 24, background: '#e2e8f0' }}></div>
                                <div style={{ textAlign: 'right', minWidth: 60 }}>
                                  <span style={{ fontSize: 9, color: '#94a3b8', display: 'block', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Stok</span>
                                  <span style={{ 
                                    fontWeight: isLow ? 600 : 400, 
                                    color: isKritis ? '#ef4444' : isMenipis ? '#f59e0b' : '#0f172a'
                                  }}>
                                    {formatQty(qty, 1)} {formatUnit(item.smallest_unit)}
                                  </span>
                                </div>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {criticalItems.filter(item => !modalSearchTerm || item.name.toLowerCase().includes(modalSearchTerm.toLowerCase())).length === 0 && (
                    <tr>
                      <td colSpan={(data?.outlets.length || 0) + 1} style={{ textAlign: 'center', padding: '40px 16px' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: '50%', background: '#f8fafc', color: '#94a3b8', marginBottom: 12 }}>
                          <Package size={24} />
                        </div>
                        <p style={{ color: '#0f172a', fontSize: 14, fontWeight: 500, margin: '0 0 4px 0' }}>Tidak ada data ditemukan</p>
                        <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Coba ubah kata kunci pencarian Anda.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </div>
          </div>
        </Modal>

        <ConfirmDialog
          open={confirmDialog.open}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmText="Ya, Lanjutkan"
          cancelText="Batal"
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
          loading={transferring}
        />

      </div>
    </section>
  );
}
