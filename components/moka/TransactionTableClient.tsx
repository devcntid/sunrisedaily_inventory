'use client';

import { useState } from 'react';
import { Search, RefreshCw, CreditCard, X, Loader2, Calendar, Store, TrendingUp, TrendingDown, ShoppingCart, DollarSign, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Toast } from '@/components/ui/Toast';
import { Select } from '@/components/ui/Select';

interface Outlet {
    id: string;
    name: string;
}

export default function TransactionTableClient({ outlets }: { outlets: Outlet[] }) {
    const [search, setSearch] = useState('');
    const [outletId, setOutletId] = useState('');

    const [startDate, setStartDate] = useState(() => {
        const d = new Date(); d.setDate(d.getDate() - 7);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

    const [page, setPage] = useState(1);
    const [selectedTrx, setSelectedTrx] = useState<any>(null);
    const [isSyncing, setIsSyncing] = useState(false);

    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
    const [toastOpen, setToastOpen] = useState(false);

    const showToast = (message: string, type: 'success' | 'error' | 'info') => {
        setToastMessage(message); setToastType(type); setToastOpen(true);
    };

    const fetchTransactions = async (page: number, search: string, outlet_id: string, start_date: string, end_date: string) => {
        const params = new URLSearchParams({ page: page.toString(), limit: '20' });
        if (search) params.append('search', search);
        if (outlet_id) params.append('outlet_id', outlet_id);
        if (start_date) params.append('start_date', start_date);
        if (end_date) params.append('end_date', end_date);
        const res = await fetch(`/api/moka/transactions?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
    };

    const { data, isLoading, refetch } = useQuery({
        queryKey: ['moka-transactions', page, search, outletId, startDate, endDate],
        queryFn: () => fetchTransactions(page, search, outletId, startDate, endDate),
        placeholderData: (prev) => prev
    });

    const fetchTransactionItems = async (id: string) => {
        const res = await fetch(`/api/moka/transactions/${id}/items`);
        if (!res.ok) return { data: [] };
        return res.json();
    };

    const handleSync = async () => {
        if (!startDate || !endDate) { showToast('Please select start and end date.', 'error'); return; }
        setIsSyncing(true);
        try {
            const res = await fetch('/api/moka/sync/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ start_date: startDate, end_date: endDate, outlet_id: outletId || undefined })
            });
            const result = await res.json();
            if (res.ok && result.success) {
                showToast(result.message || 'Transactions synced successfully.', 'success');
                refetch();
            } else {
                showToast(result.message || 'Sync failed.', 'error');
            }
        } catch (e: any) {
            showToast(`Network error: ${e.message}`, 'error');
        } finally {
            setIsSyncing(false);
        }
    };

    const handleRowClick = async (trx: { id: number; payment_type?: string; receipt_number?: string; total_collected?: string | number }) => {
        setSelectedTrx({ ...trx, items: [], isLoadingItems: true });
        try {
            const itemsRes = await fetchTransactionItems(String(trx.id));
            setSelectedTrx({ ...trx, items: itemsRes.data, isLoadingItems: false });
        } catch {
            setSelectedTrx((prev: typeof selectedTrx) => ({ ...prev, isLoadingItems: false }));
        }
    };

    const transactions = data?.data || [];
    const total = data?.total || 0;
    const summary = data?.summary;
    const totalCollected = summary?.totalRevenue ?? transactions.reduce((s: number, t: { total_collected?: string | number }) => s + Number(t.total_collected || 0), 0);
    const totalRefunded = summary?.totalRefunded ?? transactions.filter((t: { is_refunded?: boolean }) => t.is_refunded).length;
    const cashCount = summary?.cashCount ?? transactions.filter((t: { payment_type?: string }) => t.payment_type === 'cash').length;

    const ITEMS_PER_PAGE = 20;
    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

    const formatRp = (val: number) => 'Rp ' + val.toLocaleString('id-ID');

    return (
        <div className="space-y-4">
            <Toast message={toastMessage} type={toastType} isOpen={toastOpen} onClose={() => setToastOpen(false)} />

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-[20px] font-bold text-gray-900 font-['Cabin']">Data Transaksi</h1>
                    <p className="text-[13px] text-gray-500 mt-0.5">Lihat dan sinkronkan data transaksi dari integrasi Moka POS</p>
                </div>
                <button
                    onClick={handleSync}
                    disabled={isSyncing}
                    className={`btn flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 font-medium text-[12px] transition-colors shadow-sm w-full sm:w-auto ${isSyncing ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-[#016e3f] text-white hover:bg-[#015933]'}`}
                >
                    <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
                    {isSyncing ? 'Sinkronisasi...' : 'Sinkronisasi Transaksi'}
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white rounded-lg p-2 border border-gray-200 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-1">
                        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Total Pendapatan</div>
                        <div className="p-1 rounded bg-emerald-50 text-emerald-600"><TrendingUp size={12} /></div>
                    </div>
                    <div className="text-[15px] font-bold text-gray-900 font-['Cabin'] leading-none">{formatRp(totalCollected)}</div>
                    <div className="text-[9px] text-gray-400 mt-1">Total pada periode terpilih</div>
                </div>
                <div className="bg-white rounded-lg p-2 border border-gray-200 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-1">
                        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Jumlah Transaksi</div>
                        <div className="p-1 rounded bg-blue-50 text-blue-600"><ShoppingCart size={12} /></div>
                    </div>
                    <div className="text-[15px] font-bold text-gray-900 font-['Cabin'] leading-none">{total.toLocaleString()}</div>
                    <div className="text-[9px] text-gray-400 mt-1">Total pada periode terpilih</div>
                </div>
                <div className="bg-white rounded-lg p-2 border border-gray-200 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-1">
                        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Pengembalian</div>
                        <div className="p-1 rounded bg-red-50 text-red-600"><TrendingDown size={12} /></div>
                    </div>
                    <div className="text-[15px] font-bold text-gray-900 font-['Cabin'] leading-none">{totalRefunded}</div>
                    <div className="text-[9px] text-gray-400 mt-1">Transaksi dikembalikan</div>
                </div>
                <div className="bg-white rounded-lg p-2 border border-gray-200 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-1">
                        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Pembayaran Tunai</div>
                        <div className="p-1 rounded bg-amber-50 text-amber-600"><DollarSign size={12} /></div>
                    </div>
                    <div className="text-[15px] font-bold text-gray-900 font-['Cabin'] leading-none">{cashCount}</div>
                    <div className="text-[9px] text-gray-400 mt-1">Metode tunai (halaman ini)</div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="px-3 py-2 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Search Input */}
                        <div className="relative">
                            <Search size={12} className="text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Cari no struk / kasir..."
                                value={search}
                                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                                className="bg-white border border-gray-200 text-[12px] text-gray-700 rounded-md pl-7 pr-2.5 py-1 w-[180px] shadow-sm focus:outline-none focus:border-[#016e3f] placeholder-gray-400"
                            />
                        </div>

                        {/* Date Range Container */}
                        <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-md px-2.5 py-1 shadow-sm text-[12px]">
                            <Calendar size={12} className="text-gray-400" />
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                                className="bg-transparent text-[12px] text-gray-700 font-medium focus:outline-none cursor-pointer"
                            />
                            <span className="text-gray-400 text-[10px] font-bold tracking-wider px-0.5">TO</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                                className="bg-transparent text-[12px] text-gray-700 font-medium focus:outline-none cursor-pointer"
                            />
                        </div>

                        {/* Outlet Select Dropdown */}
                        <Select
                            value={outletId}
                            onChange={(val) => { setOutletId(String(val)); setPage(1); }}
                            options={[
                                { value: '', label: 'Semua Outlet' },
                                ...outlets.map(o => ({ value: o.id, label: o.name }))
                            ]}
                            style={{ width: 130 }}
                            inputStyle={{ height: 30, fontSize: 12, padding: '0 8px' }}
                        />
                    </div>

                    {/* Right-aligned items found count */}
                    <div className="text-[12px] text-gray-500 font-medium">
                        <span className="font-semibold text-gray-800">{total}</span> transaksi ditemukan
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                {['Tanggal & Waktu', 'No. Struk', 'Outlet', 'Metode Pembayaran', 'Total', 'Kasir', 'Status'].map(col => (
                                    <th key={col} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                                        {col}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                        <Loader2 size={16} className="animate-spin" /> Memuat transaksi...
                                    </div>
                                </td></tr>
                            ) : transactions.length === 0 ? (
                                <tr><td colSpan={7} style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                                    Tidak ada transaksi ditemukan. Coba sinkronisasi atau ubah filter Anda.
                                </td></tr>
                            ) : (
                                transactions.map((trx: any) => (
                                    <tr
                                        key={trx.id}
                                        onClick={() => handleRowClick(trx)}
                                        style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s' }}
                                        onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                                        onMouseLeave={e => (e.currentTarget.style.background = '')}
                                    >
                                        <td style={{ padding: '10px 16px' }}>
                                            <div style={{ fontWeight: 500, color: '#1e293b', fontSize: 12 }}>
                                                {new Date(trx.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </div>
                                            <div style={{ color: '#94a3b8', fontSize: 11 }}>{new Date(trx.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
                                        </td>
                                        <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: '#016e3f', fontWeight: 600, fontSize: 12 }}>{trx.payment_no}</td>
                                        <td style={{ padding: '10px 16px', color: '#475569', fontSize: 12 }}>{trx.outlet_name}</td>
                                        <td style={{ padding: '10px 16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569', fontSize: 12 }}>
                                                <CreditCard size={12} />
                                                <span style={{ textTransform: 'capitalize' }}>{trx.payment_type_label || trx.payment_type}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '10px 16px', fontWeight: 600, color: '#1e293b', fontSize: 12 }}>
                                            {formatRp(Number(trx.total_collected))}
                                        </td>
                                        <td style={{ padding: '10px 16px', color: '#475569', fontSize: 12 }}>{trx.collected_by || '-'}</td>
                                        <td style={{ padding: '10px 16px' }}>
                                            {trx.is_refunded ? (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, background: '#fef2f2', color: '#dc2626', fontSize: 11, fontWeight: 600 }}>
                                                    <RotateCcw size={10} /> Dikembalikan
                                                </span>
                                            ) : (
                                                <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 999, background: '#f0fdf4', color: '#16a34a', fontSize: 11, fontWeight: 600 }}>
                                                    Selesai
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {total > 0 && (
                    <div className="px-5 py-3 border-t border-gray-100 flex flex-wrap justify-between items-center gap-3">
                        <span className="text-[12px] text-gray-500">
                            Menampilkan {((page - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(page * ITEMS_PER_PAGE, total)} dari {total.toLocaleString('id-ID')} transaksi
                        </span>
                        
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className={`w-7 h-7 flex items-center justify-center rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors ${page === 1 ? 'opacity-40 pointer-events-none' : ''}`}
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>

                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum = page;
                                if (totalPages <= 5) pageNum = i + 1;
                                else if (page <= 3) pageNum = i + 1;
                                else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                                else pageNum = page - 2 + i;

                                if (pageNum < 1 || pageNum > totalPages) return null;

                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setPage(pageNum)}
                                        className={`w-7 h-7 flex items-center justify-center rounded border text-[12px] font-medium transition-colors ${
                                            page === pageNum
                                                ? 'bg-[#016e3f] text-white border-[#016e3f]'
                                                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                                        }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}

                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages}
                                className={`w-7 h-7 flex items-center justify-center rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors ${page >= totalPages ? 'opacity-40 pointer-events-none' : ''}`}
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Transaction Detail Centered Modal */}
            {selectedTrx && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
                    onClick={() => setSelectedTrx(null)}
                >
                    <div
                        className="w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col animate-in fade-in zoom-in-95 duration-150"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between shrink-0">
                            <div>
                                <h3 className="font-bold text-gray-900 text-[16px] font-['Cabin']">Transaction Detail</h3>
                                <p className="text-[12px] text-gray-500 font-mono mt-0.5">{selectedTrx.payment_no}</p>
                            </div>
                            <button onClick={() => setSelectedTrx(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <X className="w-4 h-4 text-gray-500" />
                            </button>
                        </div>

                        <div className="p-4 md:p-5 flex flex-col space-y-3 flex-1 min-h-0 overflow-hidden">
                            {/* Transaction Meta Grid */}
                            <div className="bg-gray-50 rounded-lg p-2.5 grid grid-cols-2 gap-y-1.5 text-[11px] shrink-0">
                                <div><span className="text-gray-500 block text-[10px] mb-0.5">Date</span><span className="font-medium text-gray-900">{new Date(selectedTrx.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</span></div>
                                <div><span className="text-gray-500 block text-[10px] mb-0.5">Time</span><span className="font-medium text-gray-900">{new Date(selectedTrx.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span></div>
                                <div><span className="text-gray-500 block text-[10px] mb-0.5">Outlet</span><span className="font-medium text-gray-900 line-clamp-1" title={selectedTrx.outlet_name}>{selectedTrx.outlet_name}</span></div>
                                <div><span className="text-gray-500 block text-[10px] mb-0.5">Cashier</span><span className="font-medium text-gray-900 line-clamp-1" title={selectedTrx.collected_by}>{selectedTrx.collected_by || '-'}</span></div>
                                <div><span className="text-gray-500 block text-[10px] mb-0.5">Payment</span><span className="font-medium text-gray-900 capitalize">{selectedTrx.payment_type_label || selectedTrx.payment_type}</span></div>
                                <div><span className="text-gray-500 block text-[10px] mb-0.5">Status</span>
                                    {selectedTrx.is_refunded
                                        ? <span className="text-red-600 font-semibold">Refunded</span>
                                        : <span className="text-green-600 font-semibold">Completed</span>}
                                </div>
                            </div>

                            {/* Items Ordered Section with Dedicated Inner Scroll Box */}
                            <div className="flex flex-col flex-1 min-h-0 shrink">
                                <div className="flex justify-between items-center mb-2 shrink-0">
                                    <h4 className="font-bold text-gray-900 text-[13px]">Items Ordered</h4>
                                    <span className="text-[11px] font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{selectedTrx.items?.length || 0} items</span>
                                </div>

                                {selectedTrx.isLoadingItems ? (
                                    <div className="py-8 text-center text-[12px] text-gray-500 flex flex-col items-center justify-center gap-2 bg-gray-50/50 rounded-lg border border-gray-100">
                                        <Loader2 className="w-4 h-4 animate-spin text-[#016e3f]" /> Loading items...
                                    </div>
                                ) : selectedTrx.items?.length === 0 ? (
                                    <div className="py-8 text-center text-[12px] text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200 flex items-center justify-center">
                                        No items found.
                                    </div>
                                ) : (
                                    <div className="border border-gray-200 rounded-lg p-3 bg-white overflow-y-auto divide-y divide-gray-100 space-y-2.5 min-h-0 shrink">
                                        {selectedTrx.items?.map((item: any, idx: number) => (
                                            <div key={idx} className="flex justify-between items-start pt-2.5 first:pt-0">
                                                <div className="pr-2">
                                                    <div className="font-medium text-gray-900 text-[12px] leading-tight">{item.item_name}</div>
                                                    {item.item_variant_name && <div className="text-[11px] text-gray-500 mt-0.5">{item.item_variant_name}</div>}
                                                    <div className="text-[11px] text-gray-400 mt-0.5">{item.quantity} × {formatRp(Number(item.price))}</div>
                                                </div>
                                                <div className="font-semibold text-gray-900 text-[12px] whitespace-nowrap">{formatRp(Number(item.gross_sales))}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Financial Summary */}
                            <div className="pt-3 border-t border-gray-100 space-y-1.5 text-[12px] shrink-0">
                                <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{formatRp(Number(selectedTrx.subtotal))}</span></div>
                                {Number(selectedTrx.discounts) > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>- {formatRp(Number(selectedTrx.discounts))}</span></div>}
                                {Number(selectedTrx.taxes) > 0 && <div className="flex justify-between text-gray-600"><span>Tax</span><span>+ {formatRp(Number(selectedTrx.taxes))}</span></div>}
                                {Number(selectedTrx.gratuities) > 0 && <div className="flex justify-between text-gray-600"><span>Service Charge</span><span>+ {formatRp(Number(selectedTrx.gratuities))}</span></div>}
                                <div className="flex justify-between font-bold text-gray-900 pt-2 border-t border-gray-100 text-[14px]">
                                    <span>Total Paid</span>
                                    <span className="text-[#016e3f]">{formatRp(Number(selectedTrx.total_collected))}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
