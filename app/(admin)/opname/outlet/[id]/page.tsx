'use client';
import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Toast } from '@/components/ui/Toast';
import { 
  Search, 
  ArrowLeft, 
  Save, 
  Lock, 
  X,
  AlertCircle,
  User,
  Calendar
} from 'lucide-react';

const REASON_CATEGORIES = [
  { value: 'SALAH_CATAT', label: 'Salah Catat / Koreksi' },
  { value: 'BONUS_SUPPLIER', label: 'Bonus Supplier' },
  { value: 'RETUR_BELUM_CATAT', label: 'Retur Belum Dicatat' },
  { value: 'RUSAK', label: 'Barang Rusak' },
  { value: 'KADALUARSA', label: 'Kadaluarsa' },
  { value: 'HILANG_SUSUT', label: 'Hilang / Susut' },
  { value: 'LAINNYA', label: 'Lainnya' },
];

function formatUnit(unit: string | null | undefined): string {
  if (!unit) return '';
  const u = unit.toLowerCase().trim();
  if (u === 'l') return 'Liter';
  if (u === 'g' || u === 'gr') return 'gram';
  return unit;
}

export default function OutletOpnameDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [header, setHeader] = useState<any>(null);
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [details, setDetails] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [limit, setLimit] = useState<number | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [filterMode, setFilterMode] = useState<'all' | 'top10'>('top10');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; isOpen: boolean }>({ message: '', type: 'info', isOpen: false });
  const [confirmState, setConfirmState] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void }>({ open: false, title: '', message: '', onConfirm: () => {} });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type, isOpen: true });
  };

  const fetchOpname = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch header
      const hRes = await fetch(`/api/opname/${id}`);
      if (hRes.ok) {
        const hData = await hRes.json();
        setHeader(hData.data);
        setIsLocked(hData.data?.status === 'LOCKED');
        
        if (hData.data?.location_id) {
          // Fetch all items for input & top recommendations in parallel
          const [iRes, recRes] = await Promise.all([
            fetch(`/api/opname/items?location_type=OUTLET&location_id=${hData.data.location_id}`),
            fetch(`/api/opname/recommendations?outlet_id=${hData.data.location_id}&limit=10`)
          ]);

          if (iRes.ok) {
            const iData = await iRes.json();
            setItems(iData.data ?? []);
          }

          if (recRes.ok) {
            const recData = await recRes.json();
            setRecommendations(recData.data ?? []);
          }
        }
      }

      // Fetch existing details for this session
      const dRes = await fetch(`/api/opname/${id}/detail`);
      if (dRes.ok) {
        const dData = await dRes.json();
        setDetails(dData.data ?? []);
      }
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchOpname(); }, [fetchOpname]);

  const getDetail = (itemId: number) => details.find(d => Number(d.item_id) === Number(itemId));

  // Coerce all IDs to Numbers for safe Set matching
  const top10ItemIds = new Set(recommendations.slice(0, 10).map(r => Number(r.item_id)));

  // Outlet opname: input langsung dalam smallest_unit (gr, ml, Pcs)
  const handleQtyChange = (itemId: number, systemBalance: number, actualQtySmall: string) => {
    if (isLocked) return;
    const numericVal = actualQtySmall.replace(/[^0-9.]/g, '');
    const qtySmall = numericVal === '' ? systemBalance : parseFloat(numericVal);

    const existing = details.find(d => Number(d.item_id) === Number(itemId));
    const variance = qtySmall - systemBalance;

    // Reset reason if variance becomes 0
    let reason_category = existing?.reason_category;
    let reason_notes = existing?.reason_notes;
    if (variance === 0) {
      reason_category = undefined;
      reason_notes = undefined;
    }

    if (existing) {
      setDetails(details.map(d => Number(d.item_id) === Number(itemId) ? { 
        ...d, 
        actual_physical_qty: numericVal === '' ? '' : qtySmall, 
        input_value: numericVal,
        variance, 
        reason_category, 
        reason_notes 
      } : d));
    } else {
      setDetails([...details, { 
        item_id: Number(itemId), 
        system_balance: systemBalance, 
        actual_physical_qty: numericVal === '' ? '' : qtySmall, 
        input_value: numericVal, 
        variance 
      }]);
    }
  };

  const handleReasonChange = (itemId: number, field: 'reason_category' | 'reason_notes', value: string) => {
    if (isLocked) return;
    setDetails(details.map(d => Number(d.item_id) === Number(itemId) ? { ...d, [field]: value } : d));
  };

  const handleSave = async (submit: boolean = false) => {
    // Validate reasons for non-zero variance items
    if (submit) {
      const invalidDetails = details.filter(d => Number(d.variance) !== 0 && !d.reason_category);
      if (invalidDetails.length > 0) {
        showToast('Alasan wajib diisi untuk barang yang memiliki selisih stok.', 'error');
        return;
      }
      const invalidOthers = details.filter(d => d.reason_category === 'LAINNYA' && !String(d.reason_notes || '').trim());
      if (invalidOthers.length > 0) {
        showToast('Barang dengan alasan "Lainnya" wajib mengisi catatan/keterangan.', 'error');
        return;
      }
    }

    setSaving(true);
    try {
      // Upsert only details that have actual input
      for (const detail of details) {
        if (detail.actual_physical_qty !== undefined && detail.actual_physical_qty !== '') {
          const payload = {
            ...detail,
            item_id: Number(detail.item_id),
            actual_physical_qty: parseFloat(String(detail.actual_physical_qty))
          };
          await fetch(`/api/opname/${id}/detail`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        }
      }

      if (submit) {
        // Lock the opname session
        const res = await fetch(`/api/opname/${id}/lock`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ location_type: 'OUTLET', location_id: header.location_id })
        });
        const data = await res.json();
        if (data.success) {
          showToast('Sampling Opname berhasil dikunci. Penyesuaian stok telah diterapkan pada outlet.', 'success');
          fetchOpname();
        } else {
          showToast(data.message || 'Gagal mengunci sesi opname.', 'error');
        }
      } else {
        showToast(`Draf berhasil disimpan (${details.filter(d => d.actual_physical_qty !== '').length} barang dicatat). Stok belum berubah.`, 'success');
      }
    } catch (err: unknown) {
      showToast((err instanceof Error ? err.message : 'Unknown error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500">
        <div className="w-8 h-8 border-3 border-emerald-700 border-t-transparent rounded-full animate-spin mb-3"></div>
        <div className="text-sm font-medium">Memuat data sampling opname outlet...</div>
      </div>
    );
  }

  if (!header) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200 shadow-sm max-w-lg mx-auto my-12">
        <AlertCircle size={36} className="text-red-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-800">Sesi Opname Tidak Ditemukan</h3>
        <p className="text-xs text-slate-500 mt-1 mb-4">Sesi opname mungkin telah dihapus atau URL tidak valid.</p>
        <Button variant="outline" size="sm" onClick={() => router.push('/opname/central')}>
          Kembali ke Daftar Opname
        </Button>
      </div>
    );
  }

  // Filter items based on filterMode, selectedItemId, and searchQuery
  let displayedItems = items;
  if (selectedItemId) {
    displayedItems = items.filter(i => Number(i.item_id) === Number(selectedItemId));
  } else if (filterMode === 'top10') {
    displayedItems = items.filter(i => top10ItemIds.has(Number(i.item_id)));
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    displayedItems = displayedItems.filter(i => 
      String(i.item_name || '').toLowerCase().includes(q) || 
      String(i.category_name || '').toLowerCase().includes(q)
    );
  }

  const paginatedItems = limit === 'all' ? displayedItems : displayedItems.slice((currentPage - 1) * limit, currentPage * limit);
  const totalPages = limit === 'all' ? 1 : Math.ceil(displayedItems.length / limit);

  return (
    <section className="screen">
      <div className="card shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        
        {/* Header Bar */}
        <div className="p-4 md:p-5 border-b border-slate-200 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                Sampling Outlet
              </span>
              <h2 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight">
                {header.location_name ? `Stock Opname: ${header.location_name}` : 'Stock Opname Outlet'}
              </h2>
            </div>
            
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
              <div className="flex items-center gap-1.5">
                <Badge variant={isLocked ? 'green' : header.status === 'SUBMITTED' ? 'blue' : 'gray'}>
                  {header.status === 'LOCKED' ? 'Selesai (Terkunci)' : header.status === 'SUBMITTED' ? 'Diajukan' : 'Draf'}
                </Badge>
              </div>
              <div className="flex items-center gap-1.5 text-slate-500">
                <Calendar size={13} className="text-slate-400" />
                <span>Tanggal: <strong className="text-slate-700">{new Date(header.count_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-500">
                <User size={13} className="text-slate-400" />
                <span>Auditor: <strong className="text-slate-700">{header.pic_name || 'Admin'}</strong></span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="hidden lg:block">
              <Select
                value={limit}
                onChange={(val) => { setLimit(val === 'all' ? 'all' : Number(val)); setCurrentPage(1); }}
                options={[
                  { value: 'all', label: 'Tampilkan Semua' },
                  { value: 10, label: '10 Baris' },
                  { value: 25, label: '25 Baris' }
                ]}
                inputStyle={{ padding: '4px 10px', height: 32, fontSize: 12, minWidth: 120 }}
              />
            </div>
            
            {!isLocked && (
              <>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleSave(false)} 
                  disabled={saving} 
                  style={{ height: 32, padding: '0 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}
                >
                  <Save size={14} />
                  <span>{saving ? 'Menyimpan...' : 'Simpan Draf'}</span>
                </Button>
                
                <Button 
                  variant="primary" 
                  size="sm" 
                  onClick={() => {
                    setConfirmState({
                      open: true,
                      title: 'Kunci & Terapkan Penyesuaian Stok?',
                      message: 'Apakah Anda yakin ingin mengunci sesi sampling opname ini? Stok outlet akan disesuaikan secara otomatis dan data tidak dapat diubah lagi.',
                      onConfirm: () => {
                        setConfirmState(prev => ({ ...prev, open: false }));
                        handleSave(true);
                      }
                    });
                  }} 
                  disabled={saving} 
                  style={{ height: 32, padding: '0 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}
                >
                  <Lock size={14} />
                  <span>Kunci & Terapkan</span>
                </Button>
              </>
            )}

            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => router.push('/opname/central')} 
              style={{ height: 32, padding: '0 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <ArrowLeft size={14} />
              <span>Kembali</span>
            </Button>
          </div>
        </div>

        {/* Filter & Control Bar (Clean & Simple) */}
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Segmented Filter */}
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start">
            <button
              type="button"
              onClick={() => { setSelectedItemId(null); setFilterMode('top10'); setCurrentPage(1); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                filterMode === 'top10' && !selectedItemId
                  ? 'bg-white text-emerald-800 shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Top 10 Fast-Moving
            </button>

            <button
              type="button"
              onClick={() => { setSelectedItemId(null); setFilterMode('all'); setCurrentPage(1); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                filterMode === 'all' && !selectedItemId
                  ? 'bg-white text-slate-900 shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua Barang ({items.length})
            </button>
          </div>

          {/* Search Bar */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              className="input"
              placeholder="Cari nama barang..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              style={{ width: 220, height: 32, fontSize: 12 }}
            />
            {searchQuery && (
              <button 
                type="button" 
                onClick={() => setSearchQuery('')}
                className="text-xs text-slate-500 hover:text-slate-800 px-1.5 py-0.5 rounded hover:bg-slate-200 transition-colors"
                title="Hapus pencarian"
              >
                <X size={13} />
              </button>
            )}

            <span className="text-xs text-slate-500 whitespace-nowrap ml-2">
              <strong className="text-slate-800">{displayedItems.length}</strong> barang
            </span>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-x-auto">
          {displayedItems.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2 text-slate-400">
                <Search size={18} />
              </div>
              <h4 className="text-sm font-semibold text-slate-800">Tidak ada barang yang cocok</h4>
              <p className="text-xs text-slate-500 mt-1">Coba ganti filter atau kata kunci pencarian Anda.</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3" 
                onClick={() => { setFilterMode('all'); setSelectedItemId(null); setSearchQuery(''); }}
              >
                Tampilkan Semua Barang
              </Button>
            </div>
          ) : (
            <Table>
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] uppercase tracking-wider font-semibold">
                  <th style={{ padding: '10px 16px', minWidth: 220 }}>Nama Barang</th>
                  <th className="right" style={{ padding: '10px 16px', width: 130 }}>Harga Satuan</th>
                  <th className="right" style={{ padding: '10px 16px', width: 120 }}>Stok Sistem</th>
                  <th className="right" style={{ padding: '10px 16px', width: 150 }}>Stok Fisik</th>
                  <th className="right" style={{ padding: '10px 16px', width: 110 }}>Selisih</th>
                  <th className="right" style={{ padding: '10px 16px', width: 140 }}>Nilai Selisih</th>
                  <th style={{ padding: '10px 16px', width: 190 }}>Alasan Selisih</th>
                  <th style={{ padding: '10px 16px', width: 200 }}>Catatan Temuan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginatedItems.map((item: any) => {
                  const itemIdNum = Number(item.item_id);
                  const detail = getDetail(itemIdNum);
                  const smallUnit = formatUnit(item.smallest_unit);
                  const recIdx = recommendations.findIndex(r => Number(r.item_id) === itemIdNum);

                  const actualSmall = detail?.actual_physical_qty;
                  
                  let displayVal = detail?.input_value as string | undefined;
                  if (displayVal === undefined) {
                    displayVal = actualSmall !== undefined && actualSmall !== null && actualSmall !== '' 
                      ? actualSmall.toString() 
                      : '';
                  }

                  const varianceSmall = Number(detail?.variance ?? 0);
                  const varianceValue = Math.round(Math.abs(Number(varianceSmall)) * Number(item.current_average_price || 0));
                  const sysBalSmall = Number(item.system_balance || 0);

                  return (
                    <tr 
                      key={itemIdNum} 
                      className="hover:bg-slate-50 transition-colors"
                    >
                      {/* Nama Barang */}
                      <td style={{ padding: '10px 16px' }}>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900">{item.item_name as string}</span>
                          {recIdx >= 0 && recIdx < 10 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded border bg-emerald-50 text-emerald-800 border-emerald-200">
                              #{recIdx + 1}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {item.category_name || 'Bahan Baku'} • Satuan: {smallUnit}
                        </div>
                      </td>

                      {/* Harga Satuan */}
                      <td className="right num font-mono" style={{ padding: '10px 16px' }}>
                        <span className="text-slate-800 font-medium">Rp {Math.round(Number(item.current_average_price || 0)).toLocaleString('id-ID')}</span>
                        <div className="text-[10px] text-slate-400 font-sans">/ {smallUnit}</div>
                      </td>

                      {/* Stok Sistem */}
                      <td className="right num font-mono" style={{ padding: '10px 16px' }}>
                        <span className="font-semibold text-slate-800">{sysBalSmall.toLocaleString('id-ID')}</span>{' '}
                        <span className="text-[11px] text-slate-400 font-sans">{smallUnit}</span>
                      </td>

                      {/* Input Stok Fisik */}
                      <td className="right" style={{ padding: '10px 16px' }}>
                        <div className="relative">
                          <input
                            type="number"
                            className="input right font-mono font-bold"
                            value={displayVal}
                            onChange={(e) => handleQtyChange(itemIdNum, sysBalSmall, e.target.value)}
                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                            disabled={isLocked}
                            placeholder="0"
                            step="any"
                            style={{ 
                              height: 32, 
                              width: '100%', 
                              fontSize: 13, 
                              padding: '4px 8px', 
                              paddingRight: 42, 
                              borderColor: displayVal !== '' ? 'var(--primary)' : '#cbd5e1',
                              backgroundColor: displayVal !== '' ? '#fff' : '#fafafa'
                            }}
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-sans font-medium pointer-events-none">
                            {smallUnit}
                          </span>
                        </div>
                      </td>

                      {/* Selisih */}
                      <td className="right num font-mono" style={{ padding: '10px 16px' }}>
                        {displayVal !== '' && varianceSmall !== 0 ? (
                          <span className={`font-bold ${varianceSmall > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                            {varianceSmall > 0 ? '+' : ''}{Number(varianceSmall).toLocaleString('id-ID')}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Nilai Selisih */}
                      <td className="right num font-mono" style={{ padding: '10px 16px' }}>
                        {displayVal !== '' && varianceSmall !== 0 ? (
                          <span className={`font-semibold ${varianceSmall > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                            {varianceSmall > 0 ? '+Rp ' : '-Rp '}{varianceValue.toLocaleString('id-ID')}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Alasan Selisih */}
                      <td style={{ padding: '10px 16px' }}>
                        {displayVal !== '' && varianceSmall !== 0 ? (
                          <Select
                            value={String(detail?.reason_category || '')}
                            onChange={val => handleReasonChange(itemIdNum, 'reason_category', String(val))}
                            disabled={isLocked}
                            options={[
                              { value: '', label: '-- Pilih Alasan --' },
                              ...REASON_CATEGORIES
                            ]}
                            inputStyle={{ 
                              height: 30, 
                              padding: '2px 8px', 
                              fontSize: 11, 
                              borderColor: !detail?.reason_category ? '#fca5a5' : '#cbd5e1',
                              backgroundColor: !detail?.reason_category ? '#fef2f2' : '#fff'
                            }}
                          />
                        ) : (
                          <span className="text-[11px] text-slate-300 italic">Sesuai</span>
                        )}
                      </td>

                      {/* Catatan Temuan */}
                      <td style={{ padding: '10px 16px' }}>
                        {displayVal !== '' && varianceSmall !== 0 && detail?.reason_category ? (
                          <input
                            type="text"
                            className="input text-xs"
                            value={String(detail?.reason_notes || '')}
                            onChange={e => handleReasonChange(itemIdNum, 'reason_notes', e.target.value)}
                            disabled={isLocked}
                            placeholder={detail?.reason_category === 'LAINNYA' ? 'Wajib diisi...' : 'Catatan opsional...'}
                            style={{ 
                              height: 30, 
                              padding: '2px 8px', 
                              fontSize: 11, 
                              width: '100%', 
                              borderColor: (detail?.reason_category === 'LAINNYA' && !String(detail?.reason_notes || '').trim()) ? '#fca5a5' : '#cbd5e1' 
                            }}
                          />
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-3 border-t border-slate-200 bg-white">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={displayedItems.length}
                itemsPerPage={limit as number}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState(prev => ({ ...prev, open: false }))}
      />
      
      <Toast
        isOpen={toast.isOpen}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, isOpen: false }))}
      />
    </section>
  );
}
