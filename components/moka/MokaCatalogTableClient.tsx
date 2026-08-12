'use client';

import React, { useState } from 'react';
import { 
    ChevronDown, 
    ChevronRight, 
    Link2, 
    Link2Off, 
    CheckCircle2, 
    AlertCircle, 
    XCircle, 
    Calculator
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import MapRecipeModal from './MapRecipeModal';
import { Table } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';

const rp = (v: number | null | undefined) =>
    v == null || isNaN(Number(v)) || Number(v) === 0 ? '—' : `Rp ${Math.round(Number(v)).toLocaleString('id-ID')}`;

function StatusBadge({ status, ingredientCount, mappedRecipeName }: { status: 'ready' | 'no_ingredients' | 'unmapped'; ingredientCount: number; mappedRecipeName?: string }) {
    if (status === 'ready') {
        return (
            <div className="group" style={{ position: 'relative', display: 'inline-flex' }}>
                <span style={{
                    background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0',
                    padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                    display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'default'
                }}>
                    <CheckCircle2 size={12} strokeWidth={2.5} />
                    Ready
                </span>
                {mappedRecipeName && (
                    <div className="hidden group-hover:block" style={{
                        position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 6,
                        background: '#1e293b', color: '#f8fafc', padding: '4px 8px', borderRadius: 6, fontSize: 11, whiteSpace: 'nowrap', zIndex: 10
                    }}>
                        {mappedRecipeName} ({ingredientCount} Bahan)
                    </div>
                )}
            </div>
        );
    }
    if (status === 'no_ingredients') {
        return (
            <div className="group" style={{ position: 'relative', display: 'inline-flex' }}>
                <span style={{
                    background: '#fefce8', color: '#a16207', border: '1px solid #fef08a',
                    padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                    display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'default'
                }}>
                    <AlertCircle size={12} strokeWidth={2.5} />
                    Warning
                </span>
                {mappedRecipeName && (
                    <div className="hidden group-hover:block" style={{
                        position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 6,
                        background: '#1e293b', color: '#f8fafc', padding: '4px 8px', borderRadius: 6, fontSize: 11, whiteSpace: 'nowrap', zIndex: 10
                    }}>
                        {mappedRecipeName} (0 Bahan)
                    </div>
                )}
            </div>
        );
    }
    return (
        <span style={{
            background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca',
            padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', gap: 4
        }}>
            <Link2Off size={12} strokeWidth={2.5} />
            Belum Dipetakan
        </span>
    );
}

export default function MokaCatalogTableClient({ 
    items, 
    recipes, 
    stats,
    totalCount = 0,
    outletsGrouped, 
    activeOutletId,
    activeSearch,
    activeStatus,
    currentPage,
    totalPages,
    syncButton
}: { 
    items: Record<string, unknown>[], 
    recipes: Record<string, unknown>[],
    stats?: {
        total_items: number;
        ready_items: number;
        no_ingredient_items: number;
        unmapped_items: number;
    },
    totalCount?: number,
    outletsGrouped?: Record<string, { id: number; name: string }[]>,
    activeOutletId?: string,
    activeSearch?: string,
    activeStatus?: string,
    currentPage: number,
    totalPages: number,
    syncButton?: React.ReactNode
}) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [searchInput, setSearchInput] = useState(activeSearch || '');
    
    const router = useRouter();

    const updateFilters = (outletId: string, search: string, status: string, page: number = 1) => {
        const params = new URLSearchParams();
        if (page > 1) params.set('page', page.toString());
        if (outletId) params.set('outlet_id', outletId);
        if (search) params.set('search', search);
        if (status && status !== 'all') params.set('status', status);
        const qs = params.toString();
        router.push(qs ? `?${qs}` : '?');
    };

    const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        updateFilters(activeOutletId || '', activeSearch || '', e.target.value);
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        updateFilters(activeOutletId || '', searchInput, activeStatus || 'all');
    };

    return (
        <>
            {/* Header Card with Stats */}
            <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-head">
                    <div>
                        <h3 style={{ margin: 0, fontFamily: 'var(--font-cabin)', fontSize: 18, fontWeight: 700 }}>Katalog & Pemetaan Moka POS</h3>
                    </div>
                    {syncButton && (
                        <div style={{ marginLeft: 'auto' }}>
                            {syncButton}
                        </div>
                    )}
                </div>

                {/* Top Stat Row */}
                {stats && (
                    <div style={{ display: 'flex', gap: 0, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
                        <div 
                            onClick={() => updateFilters(activeOutletId || '', activeSearch || '', 'all')}
                            style={{
                                flex: '1 1 150px', padding: '16px 20px', borderRight: '1px solid var(--border)',
                                cursor: 'pointer', background: (!activeStatus || activeStatus === 'all') ? '#f8fafc' : '#fff'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Calculator size={16} strokeWidth={2.5} style={{ color: '#475569' }} />
                                <div className="muted" style={{ fontSize: 12, fontWeight: 500, color: '#64748b' }}>Total Barang POS</div>
                            </div>
                            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--foreground)', marginTop: 4 }}>{stats.total_items}</div>
                        </div>

                        <div 
                            onClick={() => updateFilters(activeOutletId || '', activeSearch || '', 'ready')}
                            style={{
                                flex: '1 1 150px', padding: '16px 20px', borderRight: '1px solid var(--border)',
                                cursor: 'pointer', background: (activeStatus === 'ready') ? '#f0fdf4' : '#fff'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <CheckCircle2 size={16} strokeWidth={2.5} style={{ color: '#15803d' }} />
                                <div className="muted" style={{ fontSize: 12, fontWeight: 500, color: '#15803d' }}>Siap Dipotong</div>
                            </div>
                            <div style={{ fontSize: 24, fontWeight: 700, color: '#15803d', marginTop: 4 }}>{stats.ready_items}</div>
                        </div>

                        <div 
                            onClick={() => updateFilters(activeOutletId || '', activeSearch || '', 'no_ingredients')}
                            style={{
                                flex: '1 1 150px', padding: '16px 20px', borderRight: '1px solid var(--border)',
                                cursor: 'pointer', background: (activeStatus === 'no_ingredients') ? '#fefce8' : '#fff'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <AlertCircle size={16} strokeWidth={2.5} style={{ color: '#a16207' }} />
                                <div className="muted" style={{ fontSize: 12, fontWeight: 500, color: '#a16207' }}>Tidak Ada Bahan</div>
                            </div>
                            <div style={{ fontSize: 24, fontWeight: 700, color: '#a16207', marginTop: 4 }}>{stats.no_ingredient_items}</div>
                        </div>

                        <div 
                            onClick={() => updateFilters(activeOutletId || '', activeSearch || '', 'unmapped')}
                            style={{
                                flex: '1 1 150px', padding: '16px 20px',
                                cursor: 'pointer', background: (activeStatus === 'unmapped') ? '#fef2f2' : '#fff'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <XCircle size={16} strokeWidth={2.5} style={{ color: '#b91c1c' }} />
                                <div className="muted" style={{ fontSize: 12, fontWeight: 500, color: '#b91c1c' }}>Belum Dipetakan</div>
                            </div>
                            <div style={{ fontSize: 24, fontWeight: 700, color: '#b91c1c', marginTop: 4 }}>{stats.unmapped_items}</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Main Table Card */}
            <div className="card">
                {/* Filters Row */}
                <div style={{ display: 'flex', gap: 12, padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', alignItems: 'center' }}>
                    <form onSubmit={handleSearch} style={{ display: 'flex', alignItems: 'center' }}>
                        <input
                            className="input" 
                            placeholder="Cari menu Moka..." 
                            value={searchInput}
                            onChange={(e) => {
                                const val = e.target.value;
                                setSearchInput(val);
                                updateFilters(activeOutletId || '', val, activeStatus || 'all');
                            }}
                            style={{ width: 240 }}
                        />
                    </form>

                    {outletsGrouped && Object.keys(outletsGrouped).length > 0 && (
                        <Select
                            value={activeOutletId || ''}
                            onChange={(val) => updateFilters(String(val), activeSearch || '', activeStatus || 'all')}
                            options={[
                                { value: '', label: 'Semua Outlet' },
                                ...Object.entries(outletsGrouped).flatMap(([bizName, outlets]) => [
                                    { value: '', label: bizName, isGroup: true },
                                    ...outlets.map((o: { id: number; name: string }) => ({ value: o.id, label: o.name }))
                                ])
                            ]}
                            style={{ width: 190 }}
                            inputStyle={{ height: 32 }}
                        />
                    )}

                    <Select
                        value={activeStatus || 'all'}
                        onChange={(val) => handleStatusChange({ target: { value: val } } as any)}
                        options={[
                            { value: 'all', label: 'Semua Status Pemetaan' },
                            { value: 'ready', label: 'Hijau (Siap)' },
                            { value: 'no_ingredients', label: 'Kuning (Tidak Ada Bahan)' },
                            { value: 'unmapped', label: 'Merah (Belum Dipetakan)' }
                        ]}
                        style={{ width: 210 }}
                        inputStyle={{ height: 32 }}
                    />

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                        <span className="muted" style={{ fontSize: 13 }}>
                            {totalCount} Menu ditemukan
                        </span>
                        <div 
                            className="group" 
                            style={{ position: 'relative', cursor: 'help', color: 'var(--muted)', display: 'flex', alignItems: 'center' }}
                        >
                            <AlertCircle size={18} />
                            <div 
                                className="hidden group-hover:flex" 
                                style={{
                                    position: 'absolute', top: '100%', right: 0, marginTop: 8, zIndex: 50,
                                    background: '#fff', border: '1px solid var(--border)', borderRadius: 8,
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: 12, width: 240,
                                    flexDirection: 'column', gap: 8
                                }}
                            >
                                <span className="font-bold" style={{ fontSize: 13, marginBottom: 4, color: '#12201a' }}>Indikator Status Pemetaan</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e' }}></span>
                                    <span className="muted"><strong>Hijau</strong> (Resep & Bahan Dipetakan)</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#eab308' }}></span>
                                    <span className="muted"><strong>Kuning</strong> (Dipetakan ke Resep, tapi 0 Bahan)</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }}></span>
                                    <span className="muted"><strong>Merah</strong> (Belum dipetakan ke Resep apapun)</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Table Body */}
                <div className="card-body flush">
                    {items.length === 0 ? (
                        <div className="empty-state" style={{ padding: 40, textAlign: 'center' }}>
                            <p className="muted">Tidak ada data menu Moka yang sesuai filter.</p>
                        </div>
                    ) : (
                        <Table>
                            <thead>
                                <tr>
                                    <th>BARANG & KATEGORI</th>
                                    <th>HARGA & STOK</th>
                                    <th>STATUS PEMETAAN</th>
                                    <th className="center" style={{ width: 110 }}>AKSI</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item: any) => {
                                    const ingCount = item.ingredient_count || 0;
                                    const statusKey: 'ready' | 'no_ingredients' | 'unmapped' = 
                                        !item.internal_recipe_id ? 'unmapped' :
                                        ingCount === 0 ? 'no_ingredients' : 'ready';

                                    return (
                                        <tr key={item.id}>
                                            <td>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <div style={{ fontWeight: 600, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <span>{item.name}</span>
                                                        {item.outlet_name && (
                                                            <span style={{ fontSize: 10, color: '#64748b', background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '1px 6px', borderRadius: 4, fontWeight: 500 }}>
                                                                {item.outlet_name}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{item.category || 'Tidak Berkategori'}</div>
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                    <div style={{ fontSize: 12, color: '#0f172a', fontWeight: 600 }}>
                                                        {rp(item.price)}
                                                    </div>
                                                    <div className="muted" style={{ fontSize: 11 }}>
                                                        Stok Moka: {item.in_stock ?? 0}
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <StatusBadge status={statusKey} ingredientCount={ingCount} mappedRecipeName={item.mapped_recipe_name} />
                                            </td>
                                            <td className="center" onClick={e => e.stopPropagation()}>
                                                <button 
                                                    onClick={() => {
                                                        setSelectedItem(item);
                                                        setIsModalOpen(true);
                                                    }}
                                                    className="btn"
                                                    style={{ 
                                                        padding: '4px 10px', fontSize: 11, fontWeight: 600,
                                                        color: '#016e3f', background: '#f0fdf4', border: '1px solid #bbf7d0',
                                                        borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer',
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                >
                                                    <Link2 size={12} />
                                                    {item.internal_recipe_id ? 'Edit' : 'Petakan Resep'}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </Table>
                    )}
                </div>
                
                {totalPages > 1 && (
                    <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
                        <Pagination 
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={totalCount}
                            itemsPerPage={20}
                            onPageChange={(page) => updateFilters(activeOutletId || '', searchInput, activeStatus || 'all', page)}
                        />
                    </div>
                )}
            </div>

            <MapRecipeModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setSelectedItem(null);
                }}
                mokaItem={selectedItem}
                recipes={recipes as any}
            />
        </>
    );
}
