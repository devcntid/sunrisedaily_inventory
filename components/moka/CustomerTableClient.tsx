'use client';

import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, Users, Mail, Phone, ChevronDown, ChevronRight } from 'lucide-react';
import { Toast } from '@/components/ui/Toast';

export default function CustomerTableClient({ outletsGrouped, activeOutletId }: { outletsGrouped?: Record<string, { id: number; name: string }[]>, activeOutletId?: string }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [sort, setSort] = useState('newest');
    const [hasEmail, setHasEmail] = useState('all');
    const [outletId, setOutletId] = useState(activeOutletId || '');
    const [page, setPage] = useState(1);
    const [data, setData] = useState<Record<string, unknown>[]>([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    
    // For expanded rows
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
    const [toastOpen, setToastOpen] = useState(false);

    const ITEMS_PER_PAGE = 20;

    const showToast = (message: string, type: 'success' | 'error' | 'info') => {
        setToastMessage(message);
        setToastType(type);
        setToastOpen(true);
    };

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/moka/customers?page=${page}&limit=${ITEMS_PER_PAGE}&search=${encodeURIComponent(searchTerm)}&sort=${sort}&hasEmail=${hasEmail}&outlet_id=${outletId}`);
            const json = await res.json();
            if (json.success) {
                setData(json.data);
                setTotal(json.total);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [page, searchTerm, sort, hasEmail, outletId]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        setSearchTerm(searchInput);
    };

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            const res = await fetch('/api/moka/sync/customers', { method: 'POST' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || 'Failed to sync data.');
            
            showToast(json.message || 'Sync successful', 'success');
            setPage(1);
            fetchData();
        } catch (error: unknown) {
            showToast(error instanceof Error ? error.message : String(error), 'error');
        } finally {
            setIsSyncing(false);
        }
    };

    const toggleRow = (id: string) => {
        setExpandedRows(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3">
                <div>
                    <h1 className="text-[20px] font-bold text-gray-900 font-['Cabin']">Data Pelanggan</h1>
                    <p className="text-[13px] text-gray-500 mt-0.5">
                        Sinkronisasi dan kelola database pelanggan dari integrasi Moka POS
                    </p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <button 
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="btn flex items-center justify-center gap-1.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-md px-3 py-1.5 font-medium text-[12px] transition-colors shadow-sm w-full sm:w-auto"
                    >
                        <RefreshCw size={13} className={`${isSyncing ? 'animate-spin text-[#016e3f]' : 'text-gray-500'}`} /> 
                        {isSyncing ? 'Sinkronisasi...' : 'Sinkronisasi Pelanggan'}
                    </button>
                </div>
            </div>

            {/* Main Content Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                
                {/* Search & Filter Bar */}
                <div className="px-3 py-2 border-b border-gray-100 flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center bg-gray-50/50">
                    <div className="flex flex-wrap items-center gap-2">
                        <form onSubmit={handleSearch} className="relative" style={{ width: '220px', minWidth: '220px' }}>
                            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Cari nama atau telepon..."
                                value={searchInput}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setSearchInput(val);
                                    setSearchTerm(val);
                                    setPage(1);
                                }}
                                className="w-full text-[12px] border border-gray-200 rounded-md pl-8 pr-3 py-1.5 focus:outline-none focus:border-[#016e3f] focus:ring-1 focus:ring-[#016e3f] bg-white shadow-sm"
                            />
                            <button type="submit" className="hidden">Cari</button>
                        </form>
                        
                        {outletsGrouped && Object.keys(outletsGrouped).length > 0 && (
                            <select 
                                value={outletId} 
                                onChange={(e) => { setOutletId(e.target.value); setPage(1); }}
                                style={{ width: '145px', minWidth: '145px' }}
                                className="text-[12px] border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:border-[#016e3f] bg-white text-gray-700 shadow-sm"
                            >
                                <option value="">Semua Outlet</option>
                                {Object.entries(outletsGrouped).map(([bizName, outlets]) => (
                                    <optgroup key={bizName} label={`--- ${bizName} ---`}>
                                        {outlets.map((o: { id: number; name: string }) => (
                                            <option key={o.id} value={o.id}>
                                                {o.name}
                                            </option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                        )}

                        <select 
                            value={hasEmail} 
                            onChange={(e) => { setHasEmail(e.target.value); setPage(1); }}
                            style={{ width: '130px', minWidth: '130px' }}
                            className="text-[12px] border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:border-[#016e3f] bg-white text-gray-700 shadow-sm"
                        >
                            <option value="all">Semua Pelanggan</option>
                            <option value="with">Dengan Email</option>
                            <option value="without">Tanpa Email</option>
                        </select>
                        <select 
                            value={sort} 
                            onChange={(e) => { setSort(e.target.value); setPage(1); }}
                            style={{ width: '130px', minWidth: '130px' }}
                            className="text-[12px] border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:border-[#016e3f] bg-white text-gray-700 shadow-sm"
                        >
                            <option value="newest">Terbaru</option>
                            <option value="oldest">Terlama</option>
                            <option value="name_asc">Nama A-Z</option>
                            <option value="name_desc">Nama Z-A</option>
                        </select>
                    </div>
                    <div className="text-[12px] text-gray-500 whitespace-nowrap">
                        <span className="font-medium text-gray-900">{total}</span> pelanggan ditemukan
                    </div>
                </div>

                <div className="overflow-x-auto min-h-[300px]">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-gray-400 space-y-3">
                            <RefreshCw className="w-6 h-6 animate-spin text-[#016e3f]" />
                            <p className="text-[13px]">Memuat data pelanggan...</p>
                        </div>
                    ) : data.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center px-4 py-8">
                            <Users className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                            <h3 className="text-[15px] font-bold text-gray-900 font-['Cabin']">Pelanggan Tidak Ditemukan</h3>
                            <p className="text-[12px] text-gray-500 mt-1.5 max-w-sm">
                                Kami tidak dapat menemukan pelanggan yang sesuai filter saat ini. Coba sinkronisasi dari Moka atau ubah filter Anda.
                            </p>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-[10px] font-bold uppercase tracking-wider">
                                    <th className="px-2 py-2 w-8 text-center"></th>
                                    <th className="px-2 py-2">NAMA PELANGGAN</th>
                                    <th className="px-2 py-2">NO. TELEPON</th>
                                    <th className="px-2 py-2">ALAMAT EMAIL</th>
                                    <th className="px-2 py-2">TANGGAL BERGABUNG</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-[12px]">
                                {data.map((item: any, idx: number) => {
                                    const rowId = String(item.id || idx);
                                    const isExpanded = !!expandedRows[rowId];
                                    const hasName = item.name && item.name !== '-';
                                    
                                    return (
                                        <React.Fragment key={rowId}>
                                            <tr 
                                                className={`transition-colors cursor-pointer group hover:bg-gray-50/80 ${isExpanded ? 'bg-gray-50/80' : ''}`}
                                                onClick={() => toggleRow(rowId)}
                                            >
                                                <td className="px-2 py-1.5 align-middle text-center">
                                                    <button className="text-gray-400 hover:text-gray-600 transition-colors inline-flex items-center justify-center">
                                                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                                    </button>
                                                </td>
                                                <td className="px-2 py-1.5 align-middle">
                                                    <div className={`font-medium ${hasName ? 'text-gray-900' : 'text-gray-500 italic'}`}>
                                                        {item.name || '-'}
                                                    </div>
                                                </td>
                                                <td className="px-2 py-1.5 align-middle">
                                                    {item.phone ? (
                                                        <div className="flex items-center gap-1.5 font-medium text-gray-700">
                                                            <Phone size={11} className="text-gray-400" /> 
                                                            <span>{item.phone}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400 italic">-</span>
                                                    )}
                                                </td>
                                                <td className="px-2 py-1.5 align-middle">
                                                    {item.email ? (
                                                        <div className="flex items-center gap-1.5 text-gray-700">
                                                            <Mail size={11} className="text-gray-400" />
                                                            <span>{item.email}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400 italic">-</span>
                                                    )}
                                                </td>
                                                <td className="px-2 py-1.5 align-middle">
                                                    <div className="text-gray-600">
                                                        {item.moka_created_at ? new Date(item.moka_created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                                                    </div>
                                                </td>
                                            </tr>
                                            
                                            {/* Expanded Detailed Row */}
                                            {isExpanded && (
                                                <tr>
                                                    <td colSpan={5} className="p-0 border-0">
                                                        <div className="bg-white border-b border-gray-100 py-2.5 px-3 shadow-inner">
                                                            <div className="pl-10 pr-3">
                                                                
                                                                {/* Headers */}
                                                                <div className="grid grid-cols-12 gap-4 text-[9px] font-bold text-gray-400 uppercase tracking-widest pb-1.5 border-b border-gray-100 mb-2">
                                                                    <div className="col-span-5">Informasi Pribadi</div>
                                                                    <div className="col-span-7">Lokasi & Alamat</div>
                                                                </div>

                                                                {/* Content */}
                                                                <div className="grid grid-cols-12 gap-4">
                                                                    {/* Col 1: Personal */}
                                                                    <div className="col-span-5">
                                                                        <div className="grid grid-cols-2 gap-3">
                                                                            <div>
                                                                                <div className="text-[10px] text-gray-500 mb-0.5">Jenis Kelamin</div>
                                                                                <div className="text-[11px] font-medium text-gray-800 capitalize">
                                                                                    {item.sex || '-'}
                                                                                </div>
                                                                            </div>
                                                                            <div>
                                                                                <div className="text-[10px] text-gray-500 mb-0.5">Tanggal Lahir</div>
                                                                                <div className="text-[11px] font-medium text-gray-800">
                                                                                    {item.birthday || '-'}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Col 2: Address */}
                                                                    <div className="col-span-7">
                                                                        <div className="flex gap-4">
                                                                            <div className="flex-1">
                                                                                <div className="text-[10px] text-gray-500 mb-0.5">Alamat Lengkap</div>
                                                                                <div className="text-[11px] font-medium text-gray-800">
                                                                                    {item.address || <span className="text-gray-400 italic font-normal">Alamat tidak diisi</span>}
                                                                                </div>
                                                                            </div>
                                                                            <div className="w-[150px]">
                                                                                <div className="text-[10px] text-gray-500 mb-0.5">Kota / Wilayah</div>
                                                                                <div className="text-[11px] font-medium text-gray-800">
                                                                                    {[item.city, item.state, item.postal_code].filter(Boolean).join(', ') || '-'}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination */}
                {!isLoading && totalPages > 1 && (
                    <div className="px-3 py-2 border-t border-gray-100 flex items-center justify-between text-[12px] text-gray-500 bg-gray-50/50">
                        <div>
                            Menampilkan <span className="font-medium text-gray-900">{(page - 1) * ITEMS_PER_PAGE + 1}</span> sampai <span className="font-medium text-gray-900">{Math.min(page * ITEMS_PER_PAGE, total)}</span> dari <span className="font-medium text-gray-900">{total}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <button 
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className={`w-6 h-6 flex items-center justify-center rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 ${page === 1 ? 'opacity-50 pointer-events-none' : ''}`}
                            >
                                <ChevronRight className="w-3.5 h-3.5 rotate-180" />
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
                                        className={`w-6 h-6 flex items-center justify-center rounded border text-[11px] font-medium ${
                                            page === pageNum 
                                            ? 'bg-[#016e3f] text-white border-[#016e3f]' 
                                            : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                                        }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}

                            <button 
                                onClick={() => setPage(p => p + 1)}
                                disabled={page * ITEMS_PER_PAGE >= total}
                                className={`w-6 h-6 flex items-center justify-center rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 ${page * ITEMS_PER_PAGE >= total ? 'opacity-50 pointer-events-none' : ''}`}
                            >
                                <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <Toast 
                isOpen={toastOpen}
                message={toastMessage}
                type={toastType}
                onClose={() => setToastOpen(false)}
            />
        </div>
    );
}
