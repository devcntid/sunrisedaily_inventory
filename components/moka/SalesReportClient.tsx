'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Filter, RefreshCw, Download, Search, DollarSign, ShoppingCart, Percent, TrendingUp, TrendingDown, Store, Package, ChevronLeft, ChevronRight, BarChart2, Table as TableIcon } from 'lucide-react';
import { Toast } from '@/components/ui/Toast';
import { useRouter } from 'next/navigation';
import { Select } from '@/components/ui/Select';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts';

interface Outlet {
    id: string;
    name: string;
}

interface SalesItem {
    name: string;
    sku: string | null;
    category_name: string;
    item_sold: number;
    gross_sales: number;
    net_sales: number;
    discount: number;
    refund: number;
    cogs: number;
}

interface Props {
    outlets: Outlet[];
    lastSync: Date | null;
    initialSalesData: SalesItem[];
    initialStartDate: string;
    initialEndDate: string;
    initialOutletId: string;
}

export default function SalesReportClient({ outlets, lastSync, initialSalesData, initialStartDate, initialEndDate, initialOutletId }: Props) {
    const router = useRouter();
    const [selectedOutlet, setSelectedOutlet] = useState<string>(initialOutletId);
    const [startDate, setStartDate] = useState(initialStartDate);
    const [endDate, setEndDate] = useState(initialEndDate);
    const [isSyncing, setIsSyncing] = useState(false);

    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
    const [toastOpen, setToastOpen] = useState(false);

    const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');

    const [searchTerm, setSearchTerm] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [isFiltering, setIsFiltering] = useState(false);
    const [page, setPage] = useState(1);
    const ITEMS_PER_PAGE = 20;

    useEffect(() => {
        setPage(1);
    }, [searchTerm, selectedOutlet, startDate, endDate]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        setSearchTerm(searchInput);
    };

    const filteredData = useMemo(() => {
        return initialSalesData.filter(item =>
            item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.sku && item.sku.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [initialSalesData, searchTerm]);

    const totalUnitsSold = filteredData.reduce((sum, item) => sum + item.item_sold, 0);
    const totalGrossSales = filteredData.reduce((sum, item) => sum + item.gross_sales, 0);
    const totalNetSales = filteredData.reduce((sum, item) => sum + item.net_sales, 0);
    const totalRefund = filteredData.reduce((sum, item) => sum + item.refund, 0);
    const totalDiscounts = filteredData.reduce((sum, item) => sum + item.discount, 0);

    const totalCogs = filteredData.reduce((sum, item) => sum + item.cogs, 0);
    const avgMargin = totalNetSales > 0 ? ((totalNetSales - totalCogs) / totalNetSales) * 100 : 0;

    const topProducts = useMemo(() => {
        return [...filteredData]
            .sort((a, b) => b.net_sales - a.net_sales)
            .slice(0, 10);
    }, [filteredData]);

    const formatRp = (val: number) => 'Rp ' + val.toLocaleString('id-ID');
    const formatShortRp = (val: number) => {
        if (val >= 1000000) return 'Rp ' + (val / 1000000).toFixed(1) + 'M';
        if (val >= 1000) return 'Rp ' + (val / 1000).toFixed(0) + 'K';
        return 'Rp ' + val;
    };

    const showToast = (message: string, type: 'success' | 'error' | 'info') => {
        setToastMessage(message);
        setToastType(type);
        setToastOpen(true);
    };

    const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-[20px] font-bold text-gray-900 font-['Cabin']">Ringkasan Penjualan</h1>
                    <p className="text-[13px] text-gray-500 mt-0.5 flex items-center gap-2">
                        <span>Pantau performa bisnis Anda dari integrasi Moka POS</span>
                        <span className="inline-block w-1 h-1 rounded-full bg-gray-300"></span>
                        <span className="text-gray-400">Terakhir sinkron: {lastSync ? new Date(lastSync).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Belum pernah'}</span>
                    </p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    {/* Tombol sinkronisasi telah dipindahkan ke halaman Pengaturan Moka */}
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="bg-white rounded-lg p-2 border border-gray-200 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-1">
                        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Penjualan Bersih</div>
                        <div className="p-1 rounded bg-emerald-50 text-emerald-600"><TrendingUp size={12} /></div>
                    </div>
                    <div className="text-[16px] font-bold text-gray-900 font-['Cabin'] leading-none">{formatRp(totalNetSales)}</div>
                    <div className="text-[9px] text-gray-400 mt-1 flex items-center gap-1">
                        Kotor: <span className="font-medium text-gray-600">{formatRp(totalGrossSales)}</span>
                    </div>
                </div>

                <div className="bg-white rounded-lg p-2 border border-gray-200 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-1">
                        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Barang Terjual</div>
                        <div className="p-1 rounded bg-blue-50 text-blue-600"><Package size={12} /></div>
                    </div>
                    <div className="text-[16px] font-bold text-gray-900 font-['Cabin'] leading-none">{totalUnitsSold.toLocaleString('id-ID')}</div>
                    <div className="text-[9px] text-gray-400 mt-1">Total kuantitas terjual</div>
                </div>
                
                <div className="bg-white rounded-lg p-2 border border-gray-200 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-1">
                        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Pengembalian</div>
                        <div className="p-1 rounded bg-red-50 text-red-600"><TrendingDown size={12} /></div>
                    </div>
                    <div className="text-[16px] font-bold text-gray-900 font-['Cabin'] leading-none">{formatRp(totalRefund)}</div>
                    <div className="text-[9px] text-gray-400 mt-1">Total nilai pengembalian</div>
                </div>

                <div className="bg-white rounded-lg p-2 border border-gray-200 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-1">
                        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Diskon</div>
                        <div className="p-1 rounded bg-amber-50 text-amber-600"><Percent size={12} /></div>
                    </div>
                    <div className="text-[16px] font-bold text-gray-900 font-['Cabin'] leading-none">{formatRp(totalDiscounts)}</div>
                    <div className="text-[9px] text-gray-400 mt-1">Total diskon diberikan</div>
                </div>

                <div className="bg-white rounded-lg p-2 border border-gray-200 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-1">
                        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Rata-rata Margin</div>
                        <div className="p-1 rounded bg-[#016e3f]/10 text-[#016e3f]"><DollarSign size={12} /></div>
                    </div>
                    <div className="text-[16px] font-bold text-gray-900 font-['Cabin'] leading-none">{avgMargin.toFixed(1)}%</div>
                    <div className="text-[9px] text-gray-400 mt-1">Penjualan Bersih vs HPP</div>
                </div>
            </div>

            {/* View Toggle Bar (Data Table & Top Products Buttons) */}
            <div className="flex justify-end mt-3 mb-3">
                <div className="inline-flex bg-gray-100 p-0.5 rounded-lg border border-gray-200">
                    <button
                        onClick={() => setViewMode('table')}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-[13px] font-medium transition-all ${viewMode === 'table' ? 'bg-[#016e3f] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <TableIcon size={14} />
                        Tabel Data
                    </button>
                    <button
                        onClick={() => setViewMode('chart')}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-[13px] font-medium transition-all ${viewMode === 'chart' ? 'bg-[#016e3f] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <BarChart2 size={14} />
                        Grafik Produk Terlaris
                    </button>
                </div>
            </div>

            {/* Bar Chart Section */}
            {viewMode === 'chart' && (
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-[14px] font-bold text-gray-900 font-['Cabin']">10 Produk Terlaris (Berdasarkan Pendapatan)</h3>
                        
                        {/* Filters in Chart view */}
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-md px-2.5 py-1.5 shadow-sm">
                                <Calendar size={13} className="text-gray-400" />
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => {
                                        setStartDate(e.target.value);
                                        setIsFiltering(true);
                                        router.push(`/sales-report?startDate=${e.target.value}&endDate=${endDate}&outletId=${selectedOutlet}`);
                                        setTimeout(() => setIsFiltering(false), 1000);
                                    }}
                                    className="bg-transparent text-[12px] text-gray-700 font-medium focus:outline-none cursor-pointer"
                                />
                                <span className="text-gray-300 text-[10px] font-bold mx-0.5">TO</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => {
                                        setEndDate(e.target.value);
                                        setIsFiltering(true);
                                        router.push(`/sales-report?startDate=${startDate}&endDate=${e.target.value}&outletId=${selectedOutlet}`);
                                        setTimeout(() => setIsFiltering(false), 1000);
                                    }}
                                    className="bg-transparent text-[12px] text-gray-700 font-medium focus:outline-none cursor-pointer"
                                />
                            </div>

                            <Select
                                value={selectedOutlet}
                                onChange={(val) => {
                                    setSelectedOutlet(String(val));
                                    setIsFiltering(true);
                                    router.push(`/sales-report?startDate=${startDate}&endDate=${endDate}&outletId=${val}`);
                                    setTimeout(() => setIsFiltering(false), 1000);
                                }}
                                options={[
                                    { value: '', label: 'Semua Outlet' },
                                    ...outlets.map(o => ({ value: o.id, label: o.name }))
                                ]}
                                style={{ width: 130 }}
                                inputStyle={{ height: 28, fontSize: 11, padding: '0 8px' }}
                            />
                        </div>
                    </div>
                    <div className="p-4 h-[300px] w-full">
                        {topProducts.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={topProducts}
                                    margin={{ top: 10, right: 10, left: 20, bottom: 20 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 10, fill: '#64748b' }}
                                        tickFormatter={(value) => value.length > 15 ? value.substring(0, 15) + '...' : value}
                                        angle={-20}
                                        textAnchor="end"
                                        interval={0}
                                        height={45}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 10, fill: '#64748b' }}
                                        tickFormatter={formatShortRp}
                                        width={60}
                                    />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(1, 110, 63, 0.05)' }}
                                        formatter={(value: any) => [formatRp(Number(value || 0)), 'Total Penjualan']}
                                        labelStyle={{ fontSize: 12, fontWeight: 600, color: '#0f172a', marginBottom: 4 }}
                                        contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        itemStyle={{ fontSize: 12, color: '#016e3f', fontWeight: 600 }}
                                    />
                                    <Bar dataKey="net_sales" radius={[4, 4, 0, 0]}>
                                        {topProducts.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={index === 0 ? '#016e3f' : '#34d399'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                                <TrendingDown size={32} className="mb-2 opacity-50" />
                                <p className="text-[13px]">Tidak ada data penjualan untuk ditampilkan</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Table Section */}
            {viewMode === 'table' && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-3 py-2 border-b border-gray-100 flex flex-wrap gap-2.5 justify-between items-center bg-gray-50/50">
                        {/* Search and Filters inline */}
                        <div className="flex flex-wrap items-center gap-1.5">
                            <form onSubmit={handleSearch} className="relative w-[140px] sm:w-[160px]">
                                <Search className="w-3 h-3 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Cari barang..."
                                    value={searchInput}
                                    onChange={(e) => {
                                        setSearchInput(e.target.value);
                                        setSearchTerm(e.target.value);
                                        setPage(1);
                                    }}
                                    className="w-full text-[11px] border border-gray-200 rounded-md pl-6 pr-2 py-1 focus:outline-none focus:border-[#016e3f] bg-white shadow-sm"
                                />
                                <button type="submit" className="hidden">Cari</button>
                            </form>

                            {/* Date Filter */}
                            <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-md px-2 py-1 shadow-sm">
                                <Calendar size={11} className="text-gray-400" />
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => {
                                        setStartDate(e.target.value);
                                        setIsFiltering(true);
                                        router.push(`/sales-report?startDate=${e.target.value}&endDate=${endDate}&outletId=${selectedOutlet}`);
                                        setTimeout(() => setIsFiltering(false), 1000);
                                    }}
                                    className="bg-transparent text-[11px] text-gray-700 font-medium focus:outline-none cursor-pointer"
                                />
                                <span className="text-gray-300 text-[9px] font-bold mx-0.5">TO</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => {
                                        setEndDate(e.target.value);
                                        setIsFiltering(true);
                                        router.push(`/sales-report?startDate=${startDate}&endDate=${e.target.value}&outletId=${selectedOutlet}`);
                                        setTimeout(() => setIsFiltering(false), 1000);
                                    }}
                                    className="bg-transparent text-[11px] text-gray-700 font-medium focus:outline-none cursor-pointer"
                                />
                            </div>

                            {/* Outlet Filter */}
                            <Select
                                value={selectedOutlet}
                                onChange={(val) => {
                                    setSelectedOutlet(String(val));
                                    setIsFiltering(true);
                                    router.push(`/sales-report?startDate=${startDate}&endDate=${endDate}&outletId=${val}`);
                                    setTimeout(() => setIsFiltering(false), 1000);
                                }}
                                options={[
                                    { value: '', label: 'Semua Outlet' },
                                    ...outlets.map(o => ({ value: o.id, label: o.name }))
                                ]}
                                style={{ width: 130 }}
                                inputStyle={{ height: 28, fontSize: 11, padding: '0 8px' }}
                            />

                            {isFiltering && (
                                <div className="text-[11px] font-medium text-[#016e3f] animate-pulse flex items-center gap-1.5 ml-1">
                                    <RefreshCw size={12} className="animate-spin" /> Memperbarui...
                                </div>
                            )}
                        </div>

                        <div className="text-[12px] text-gray-500 whitespace-nowrap">
                            <span className="font-medium text-gray-900">{filteredData.length}</span> item ditemukan
                        </div>
                    </div>

                    <div className="overflow-x-auto min-h-[300px]">
                        {filteredData.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center px-4 py-8">
                                <Package className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                                <h3 className="text-[15px] font-bold text-gray-900 font-['Cabin']">Data Tidak Ditemukan</h3>
                                <p className="text-[12px] text-gray-500 mt-1.5 max-w-sm">
                                    Tidak ada data penjualan pada periode atau kata kunci ini. Coba ubah filter atau lakukan sinkronisasi dari Moka.
                                </p>
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse min-w-[800px]">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-[11px] font-bold uppercase tracking-wider">
                                        <th className="px-4 py-3 w-[15%] text-left align-middle">KATEGORI</th>
                                        <th className="px-4 py-3 w-[35%] text-left align-middle">NAMA BARANG / VARIAN</th>
                                        <th className="px-4 py-3 w-[15%] text-left align-middle">SKU</th>
                                        <th className="px-4 py-3 w-[10%] text-center align-middle">JUMLAH TERJUAL</th>
                                        <th className="px-4 py-3 w-[12%] text-right align-middle">PENJUALAN KOTOR</th>
                                        <th className="px-4 py-3 w-[13%] text-right align-middle">PENJUALAN BERSIH</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-[13px]">
                                    {filteredData.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE).map((item, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50/80 transition-colors">
                                            <td className="px-4 py-2.5 text-gray-500 text-left align-middle truncate max-w-[150px]">{item.category_name || '-'}</td>
                                            <td className="px-4 py-2.5 font-medium text-gray-900 text-left align-middle truncate max-w-[300px]">{item.name}</td>
                                            <td className="px-4 py-2.5 text-gray-500 text-left align-middle truncate max-w-[150px]">{item.sku || '-'}</td>
                                            <td className="px-4 py-2.5 font-semibold text-gray-700 text-center align-middle">{item.item_sold.toLocaleString('id-ID')}</td>
                                            <td className="px-4 py-2.5 text-gray-500 text-right align-middle">{formatRp(item.gross_sales)}</td>
                                            <td className="px-4 py-2.5 font-bold text-emerald-700 text-right align-middle">{formatRp(item.net_sales)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {totalPages > 1 && (
                        <div className="px-5 py-3 border-t border-gray-100 flex flex-wrap justify-between items-center gap-3">
                            <div className="text-[12px] text-gray-500">
                                Menampilkan <span className="font-medium text-gray-900">{(page - 1) * ITEMS_PER_PAGE + 1}</span> sampai <span className="font-medium text-gray-900">{Math.min(page * ITEMS_PER_PAGE, filteredData.length)}</span> dari <span className="font-medium text-gray-900">{filteredData.length.toLocaleString('id-ID')}</span> item
                            </div>
                            
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
            )}

            <Toast
                isOpen={toastOpen}
                message={toastMessage}
                type={toastType}
                onClose={() => setToastOpen(false)}
            />
        </div>
    );
}
