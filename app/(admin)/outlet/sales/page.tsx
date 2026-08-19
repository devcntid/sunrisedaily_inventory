'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Table } from '@/components/ui/Table';
import { Select } from '@/components/ui/Select';
import { Toast } from '@/components/ui/Toast';
import { TransactionDetailModal } from '@/components/sales/TransactionDetailModal';
import { Calculator, ShoppingBag, ArrowRight, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

type SalesSummaryRow = {
  menu_id: number;
  display_name: string;
  category_name: string;
  sale_price: number;
  total_qty: number;
  total_revenue: number;
};

type SalesHistoryRow = {
  transaction_id: string;
  created_at: string;
  receipt_number: string | null;
  payment_type: string | null;
  payment_type_label?: string | null;
  collected_by?: string | null;
  served_by?: string | null;
  total_items: number;
  total_revenue: number;
};

export default function SalesAnalyticsPage() {
  const router = useRouter();

  const [outletId, setOutletId] = useState<number | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [data, setData] = useState<SalesSummaryRow[]>([]);
  const [historyData, setHistoryData] = useState<SalesHistoryRow[]>([]);
  const [activeTab, setActiveTab] = useState<'summary' | 'history'>('summary');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
  const [isToastOpen, setIsToastOpen] = useState(false);
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);

  // Filters and Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortBy, setSortBy] = useState('revenue_desc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);

  // Set default dates on mount (Today)
  useEffect(() => {
    const today = new Date();
    // Adjust to local timezone to prevent UTC date shifting
    const todayStr = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    setDateTo(todayStr);
    setDateFrom(todayStr);
  }, []);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data?.outlet_id) setOutletId(d.data.outlet_id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (dateFrom && dateTo && outletId) {
      loadData();
    }
  }, [dateFrom, dateTo, outletId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sales-transactions/summary?outlet_id=${outletId}&dateFrom=${dateFrom}&dateTo=${dateTo}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        if (json.history) setHistoryData(json.history);
        if (json.lastSync) setLastSync(json.lastSync);
      }
    } catch (err) {
    } finally {
      setLoading(false);
    }
  };

  const totalRevenue = data.reduce((sum, r) => sum + Number(r.total_revenue), 0);
  const totalItemsSold = data.reduce((sum, r) => sum + Number(r.total_qty), 0);

  const rp = (v: number) => `Rp ${Math.round(v).toLocaleString('id-ID')}`;

  const handleGenerateEstimation = () => {
    // Navigate to estimation page with current date parameters
    router.push(`/outlet/sales/estimation?dateFrom=${dateFrom}&dateTo=${dateTo}`);
  };

  const handleSyncSales = async () => {
    const todayStr = new Date().toLocaleDateString('en-CA'); // Get local date YYYY-MM-DD
    setSyncing(true);
    try {
      const res = await fetch(`/api/outlet/sync-sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: todayStr }) // Always use today
      });
      const json = await res.json();
      if (json.success) {
        setToastType('success');
        setToastMsg(json.message);
        setIsToastOpen(true);
        loadData(); // Reload sales data
      } else {
        setToastType('error');
        setToastMsg('Gagal: ' + json.message);
        setIsToastOpen(true);
      }
    } catch (err: unknown) {
      setToastType('error');
      setToastMsg('Error: ' + (err instanceof Error ? err.message : 'Unknown error'));
      setIsToastOpen(true);
    } finally {
      setSyncing(false);
    }
  };

  // Extract unique categories for filter
  const categories = Array.from(new Set(data.map(d => d.category_name))).sort();

  // Filter data based on search and category
  const filteredData = data.filter(d => {
    const matchSearch = (d.display_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchCategory = selectedCategory ? d.category_name === selectedCategory : true;
    return matchSearch && matchCategory;
  });

  const filteredHistory = historyData.filter(d => {
    const searchLower = searchQuery.toLowerCase();
    const matchSearch = (d.receipt_number || '').toLowerCase().includes(searchLower) ||
      (d.collected_by || '').toLowerCase().includes(searchLower) ||
      (d.served_by || '').toLowerCase().includes(searchLower);
    return matchSearch;
  });

  const sortedData = [...filteredData].sort((a, b) => {
    if (sortBy === 'revenue_desc') return Number(b.total_revenue) - Number(a.total_revenue);
    if (sortBy === 'qty_desc') return Number(b.total_qty) - Number(a.total_qty);
    if (sortBy === 'name_asc') return a.display_name.localeCompare(b.display_name);
    return 0;
  });

  const totalPages = Math.ceil((activeTab === 'summary' ? sortedData.length : filteredHistory.length) / limit);
  const paginatedData = sortedData.slice((page - 1) * limit, page * limit);
  const paginatedHistory = filteredHistory.slice((page - 1) * limit, page * limit);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedCategory, sortBy, limit, activeTab]);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 3;
    let startPage = Math.max(1, page - Math.floor(maxVisiblePages / 2));
    let endPage = startPage + maxVisiblePages - 1;

    if (endPage > totalPages) {
      endPage = totalPages;
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <section className="screen">
      {/* Header and Stats Card */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16 }}>Analitik Penjualan</h3>
            <p className="muted" style={{ margin: '2px 0 0', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>Pantau penjualan Moka POS</span>
              <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--muted)' }}></span>
              <span>Terakhir disinkronkan: {lastSync ? new Date(lastSync).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Belum pernah'}</span>
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={handleSyncSales}
              disabled={syncing}
              className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold bg-[#016e3f] text-white rounded-md hover:bg-[#015933] transition-colors shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Menarik Penjualan...' : 'Sync Penjualan'}
            </button>
          </div>
        </div>

        {/* Stats row resembling HPP page */}
        <div style={{ display: 'flex', gap: 0, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
          <div style={{
            flex: '1 1 200px', padding: '8px 16px', borderRight: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', gap: 2
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calculator size={14} strokeWidth={2.5} style={{ color: '#016e3f' }} />
              <div className="muted" style={{ fontSize: 11, fontWeight: 500, color: '#64748b' }}>Total Pendapatan</div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--foreground)' }}>{rp(totalRevenue)}</div>
          </div>

          <div style={{
            flex: '1 1 200px', padding: '8px 16px',
            display: 'flex', flexDirection: 'column', gap: 2
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShoppingBag size={14} strokeWidth={2.5} style={{ color: '#016e3f' }} />
              <div className="muted" style={{ fontSize: 11, fontWeight: 500, color: '#64748b' }}>Porsi Terjual</div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--foreground)' }}>{totalItemsSold.toLocaleString('id-ID')}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
        <button
          onClick={() => setActiveTab('summary')}
          style={{
            padding: '8px 4px',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'summary' ? '2px solid #016e3f' : '2px solid transparent',
            color: activeTab === 'summary' ? '#016e3f' : 'var(--muted)',
            fontWeight: activeTab === 'summary' ? 600 : 500,
            cursor: 'pointer',
            fontSize: 13
          }}
        >
          Ringkasan Produk
        </button>
        <button
          onClick={() => setActiveTab('history')}
          style={{
            padding: '8px 4px',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'history' ? '2px solid #016e3f' : '2px solid transparent',
            color: activeTab === 'history' ? '#016e3f' : 'var(--muted)',
            fontWeight: activeTab === 'history' ? 600 : 500,
            cursor: 'pointer',
            fontSize: 13
          }}
        >
          Riwayat Transaksi
        </button>
      </div>

      {/* Main Content Card */}
      <div className="card">
        {/* Filter & Toolbar Section */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          padding: '8px 12px',
          background: '#f8fafc',
          borderBottom: '1px solid var(--border)',
        }}>
          {/* Left Controls: Date Range, Search, Category, Sort, Limit */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="date"
                className="input"
                style={{ padding: '2px 8px', fontSize: 12, width: 120, height: 28, cursor: 'pointer' }}
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                onClick={e => (e.target as HTMLInputElement).showPicker?.()}
                onKeyDown={e => e.preventDefault()}
              />
              <span style={{ fontWeight: 600, color: 'var(--muted)', fontSize: 12 }}>s.d.</span>
              <input
                type="date"
                className="input"
                style={{ padding: '2px 8px', fontSize: 12, width: 120, height: 28, cursor: 'pointer' }}
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                onClick={e => (e.target as HTMLInputElement).showPicker?.()}
                onKeyDown={e => e.preventDefault()}
              />
            </div>

            <input
              className="input"
              placeholder={activeTab === 'summary' ? "Cari nama menu..." : "Cari struk / kasir..."}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: 180, padding: '2px 8px', fontSize: 12, height: 28 }}
            />
            {activeTab === 'summary' && (
              <>
                <Select
                  value={selectedCategory}
                  onChange={(val) => setSelectedCategory(String(val))}
                  options={[
                    { value: '', label: 'Semua Kategori' },
                    ...categories.map(c => ({ value: c, label: c }))
                  ]}
                  style={{ width: 145 }}
                  inputStyle={{ padding: '2px 8px', fontSize: 12, height: 28 }}
                />
                <Select
                  value={sortBy}
                  onChange={(val) => setSortBy(String(val))}
                  options={[
                    { value: 'revenue_desc', label: 'Pendapatan Tertinggi' },
                    { value: 'qty_desc', label: 'Paling Banyak Terjual' },
                    { value: 'name_asc', label: 'Nama Menu (A-Z)' }
                  ]}
                  style={{ width: 155 }}
                  inputStyle={{ padding: '2px 8px', fontSize: 12, height: 28 }}
                />
              </>
            )}

            <Select
              value={limit}
              onChange={(val) => setLimit(Number(val))}
              options={[
                { value: 8, label: '8' },
                { value: 15, label: '15' },
                { value: 32, label: '32' },
                { value: 50, label: '50' }
              ]}
              style={{ width: 62 }}
              inputStyle={{ padding: '2px 6px', fontSize: 12, height: 28 }}
            />
          </div>

          {/* Right: Items found count & Pagination Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, alignSelf: 'flex-end' }}>
            {/* Pagination buttons */}
            {!loading && totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  className="btn btn-outline"
                  style={{ padding: '2px 6px', display: 'flex', alignItems: 'center', height: 26, minWidth: 26, justifyContent: 'center' }}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft size={13} />
                </button>

                <div style={{ display: 'flex', gap: 3 }}>
                  {getPageNumbers().map(p => (
                    <button
                      key={p}
                      className={`btn ${p === page ? 'btn-primary' : 'btn-outline'}`}
                      style={{ padding: '2px 6px', fontSize: 11, height: 26, minWidth: 26, justifyContent: 'center' }}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <button
                  className="btn btn-outline"
                  style={{ padding: '2px 6px', display: 'flex', alignItems: 'center', height: 26, minWidth: 26, justifyContent: 'center' }}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight size={13} />
                </button>
              </div>
            )}
            {/* Item count text */}
            <span className="muted" style={{ fontSize: 12 }}>
              {activeTab === 'summary' ? `${filteredData.length} menu` : `${filteredHistory.length} transaksi`}
            </span>
          </div>
        </div>

        <div className="card-body flush">
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }} className="muted">
              Memuat data penjualan...
            </div>
          ) : (
            <Table>
              {activeTab === 'summary' ? (
                <>
                  <thead>
                    <tr>
                      <th style={{ width: '40%' }}>Nama Menu</th>
                      <th>Kategori</th>
                      <th className="right">Harga Jual</th>
                      <th className="right">Jml Terjual</th>
                      <th className="right">Total Pendapatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.map((d, idx) => (
                      <tr key={`summary-${idx}`}>
                        <td><div style={{ fontWeight: 500, color: 'var(--foreground)' }}>{d.display_name}</div></td>
                        <td>
                          <span style={{ fontSize: 12, color: 'var(--muted)', background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>
                            {d.category_name}
                          </span>
                        </td>
                        <td className="right">{rp(d.sale_price || 0)}</td>
                        <td className="right" style={{ fontWeight: 700 }}>{d.total_qty}</td>
                        <td className="right" style={{ fontWeight: 600, color: '#016e3f' }}>{rp(d.total_revenue)}</td>
                      </tr>
                    ))}
                    {paginatedData.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: 30 }} className="muted">
                          Tidak ada data ditemukan untuk rentang tanggal ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </>
              ) : (
                <>
                  <thead>
                    <tr>
                      <th style={{ width: '20%' }}>Waktu</th>
                      <th style={{ width: '15%' }}>No. Struk</th>
                      <th style={{ width: '25%' }}>Pembayaran</th>
                      <th style={{ width: '20%' }}>Kasir</th>
                      <th className="right" style={{ width: '10%' }}>Jml</th>
                      <th className="right" style={{ width: '10%' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedHistory.map((d, idx) => (
                      <tr
                        key={`history-${d.transaction_id || idx}`}
                        onClick={() => d.transaction_id && setSelectedTxId(d.transaction_id)}
                        style={{ cursor: 'pointer' }}
                        title="Klik untuk melihat detail struk digital"
                      >
                        <td style={{ fontSize: 13 }}>{new Date(d.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                        <td style={{ fontSize: 13, fontFamily: 'monospace', color: 'var(--muted)' }}>{d.receipt_number || '-'}</td>
                        <td>
                          <div style={{ fontWeight: 500, color: 'var(--foreground)', textTransform: 'capitalize' }}>{d.payment_type_label || d.payment_type || '-'}</div>
                        </td>
                        <td>
                          <div style={{ fontSize: 13, color: 'var(--foreground)' }}>{d.served_by || d.collected_by || '-'}</div>
                        </td>
                        <td className="right" style={{ fontWeight: 700 }}>{d.total_items}</td>
                        <td className="right" style={{ fontWeight: 600, color: '#016e3f' }}>{rp(d.total_revenue)}</td>
                      </tr>
                    ))}
                    {paginatedHistory.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: 30 }} className="muted">
                          Tidak ada riwayat transaksi ditemukan untuk rentang tanggal ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </>
              )}
            </Table>
          )}
        </div>

      </div>

      <Toast
        isOpen={isToastOpen}
        message={toastMsg}
        type={toastType}
        onClose={() => setIsToastOpen(false)}
        duration={5000}
      />

      <TransactionDetailModal
        transactionId={selectedTxId}
        onClose={() => setSelectedTxId(null)}
      />
    </section>
  );
}
