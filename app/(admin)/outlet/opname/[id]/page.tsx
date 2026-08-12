'use client';
import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { HelpCircle } from 'lucide-react';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import { Toast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

const REASON_CATEGORIES = [
  { value: 'SALAH_CATAT', label: 'Salah Catat' },
  { value: 'BONUS_SUPPLIER', label: 'Kelebihan Kirim' },
  { value: 'RETUR_BELUM_CATAT', label: 'Retur Belum Dicatat' },
  { value: 'RUSAK', label: 'Rusak' },
  { value: 'KADALUARSA', label: 'Kadaluarsa' },
  { value: 'HILANG_SUSUT', label: 'Hilang / Susut' },
  { value: 'LAINNYA', label: 'Lainnya' },
];

const formatUnit = (unit: string | undefined | null) => {
  if (!unit) return '';
  const u = unit.trim().toLowerCase();
  if (u === 'gr' || u === 'gram' || u === 'g') return 'gr';
  if (u === 'kg' || u === 'kilogram') return 'Kg';
  if (u === 'ml' || u === 'mililiter') return 'ml';
  if (u === 'l' || u === 'liter') return 'Liter';
  if (u === 'pcs' || u === 'piece' || u === 'pc') return 'Pcs';
  return unit;
};

export default function OutletOpnameDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [header, setHeader] = useState<any>(null);
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [details, setDetails] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [limit, setLimit] = useState<number | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as 'success' | 'error' });
  const [showConfirm, setShowConfirm] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => setToast({ isOpen: true, message, type });

  const fetchOpname = useCallback(async () => {
    setLoading(true);
    // Fetch header
    const hRes = await fetch(`/api/opname/${id}`);
    let locId = 1;
    if (hRes.ok) {
      const hData = await hRes.json();
      setHeader(hData.data);
      setIsLocked(hData.data?.status === 'LOCKED');
      if (hData.data?.location_id) locId = hData.data.location_id;
    }

    // Fetch all items for input
    const iRes = await fetch(`/api/opname/items?location_type=OUTLET&location_id=${locId}`);
    const iData = await iRes.json();
    setItems(iData.data ?? []);

    // Fetch existing details for this session
    const dRes = await fetch(`/api/opname/${id}/detail`);
    const dData = await dRes.json();
    setDetails(dData.data ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchOpname(); }, [fetchOpname]);

  const getDetail = (itemId: number) => details.find(d => d.item_id === itemId);

  const handleQtyChange = (itemId: number, systemBalance: number, actualQty: string) => {
    if (isLocked) return;
    const numericVal = actualQty.replace(/[^0-9.]/g, '');
    const qty = numericVal === '' ? systemBalance : parseFloat(numericVal);

    const existing = details.find(d => d.item_id === itemId);
    if (existing) {
      setDetails(details.map(d => d.item_id === itemId ? { ...d, actual_physical_qty: numericVal, variance: qty - systemBalance } : d));
    } else {
      setDetails([...details, { item_id: itemId, system_balance: systemBalance, actual_physical_qty: numericVal, variance: qty - systemBalance }]);
    }
  };

  const handleReasonChange = (itemId: number, field: 'reason_category' | 'reason_notes', value: string) => {
    if (isLocked) return;
    const existing = details.find(d => d.item_id === itemId);
    if (existing) {
      setDetails(details.map(d => d.item_id === itemId ? { ...d, [field]: value } : d));
    } else {
      setDetails([...details, { item_id: itemId, system_balance: 0, actual_physical_qty: 0, variance: 0, [field]: value }]);
    }
  };

  const handleSave = async (submit: boolean = false) => {
    setSaving(true);
    try {
      // Upsert all details
      for (const detail of details) {
        const payload = {
          ...detail,
          actual_physical_qty: detail.actual_physical_qty === '' ? detail.system_balance : parseFloat(String(detail.actual_physical_qty))
        };
        await fetch(`/api/opname/${id}/detail`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (submit) {
        // Lock the opname session
        const res = await fetch(`/api/opname/${id}/lock`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          showToast('Stock Opname berhasil dikunci.', 'success');
          router.push('/outlet/opname');
        } else {
          showToast(data.message || 'Gagal mengunci opname.', 'error');
        }
      } else {
        showToast('Draft berhasil disimpan.', 'success');
        router.push('/outlet/opname');
      }
    } catch (err: unknown) {
      showToast((err instanceof Error ? err.message : 'Unknown error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Memuat data opname...</div>;
  if (!header) return <div style={{ padding: 40, textAlign: 'center' }}>Sesi tidak ditemukan.</div>;

  const filteredItems = items.filter((item: any) =>
    !searchQuery || String(item.item_name).toLowerCase().includes(searchQuery.toLowerCase())
  );
  const paginatedItems = limit === 'all' ? filteredItems : filteredItems.slice((currentPage - 1) * limit, currentPage * limit);
  const totalPages = limit === 'all' ? 1 : Math.ceil(filteredItems.length / limit);

  return (
    <section className="screen">
      <Toast isOpen={toast.isOpen} message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, isOpen: false })} />
      <div className="card">
        <div className="card-head">
          <div>
            <h3 style={{ fontSize: 15, margin: 0, fontWeight: 700 }}>Detail Opname — {new Date(header.count_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</h3>
            <div style={{ marginTop: 8, display: 'flex', gap: 16, alignItems: 'center' }}>
              <Badge variant={isLocked ? 'green' : header.status === 'SUBMITTED' ? 'blue' : 'gray'}>{header.status === 'LOCKED' ? 'Selesai (Terkunci)' : header.status === 'SUBMITTED' ? 'Diajukan' : header.status === 'DRAFT' ? 'Draf' : header.status}</Badge>
              <span className="muted" style={{ fontSize: 11 }}>
                <span className="font-bold">Mulai:</span> {new Date(header.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="muted" style={{ fontSize: 11 }}>
                <span className="font-bold">Terakhir Diubah:</span> {new Date(header.updated_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Button variant="outline" size="sm" onClick={() => setShowMobileFilters(!showMobileFilters)} className="md:hidden" style={{ height: 32, padding: '0 8px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>
            </Button>
            <div className="hidden md:flex gap-2">
              <input
                type="text"
                className="input"
                placeholder="Cari nama barang..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                style={{ width: 180, height: 32, fontSize: 11 }}
              />
              <Select
                value={limit}
                onChange={(val) => { setLimit(val === 'all' ? 'all' : Number(val)); setCurrentPage(1); }}
                options={[
                  { value: 'all', label: 'Semua' },
                  { value: 8, label: '8' },
                  { value: 32, label: '32' }
                ]}
                inputStyle={{ padding: '4px 10px', height: 32, fontSize: 11, minWidth: 90 }}
                style={{ width: 100 }}
              />
            </div>
            {!isLocked && (
              <>
                <Button variant="outline" size="sm" onClick={() => handleSave(false)} disabled={saving} style={{ padding: '0 8px', height: 32 }}>
                  <span className="hidden md:inline">Simpan Draft</span>
                  <span className="md:hidden" title="Simpan Draft"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg></span>
                </Button>
                <Button variant="primary" size="sm" onClick={() => setShowConfirm(true)} disabled={saving} style={{ padding: '0 8px', height: 32 }}>
                  <span className="hidden md:inline">Kunci & Submit</span>
                  <span className="md:hidden" title="Kunci & Submit"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg></span>
                </Button>
              </>
            )}
            <Link href="/outlet/opname">
              <Button variant="outline" size="sm" style={{ padding: '0 8px', height: 32 }}>
                <span className="hidden md:inline">Kembali</span>
                <span className="md:hidden" title="Kembali"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg></span>
              </Button>
            </Link>
          </div>
        </div>

        {showMobileFilters && (
          <div className="md:hidden" style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <div style={{ marginBottom: 4, fontSize: 11, fontWeight: 600 }}>Cari Barang</div>
              <input
                type="text"
                className="input w-full"
                placeholder="Nama barang..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                style={{ height: 32, fontSize: 12 }}
              />
            </div>
            <div>
              <div style={{ marginBottom: 4, fontSize: 11, fontWeight: 600 }}>Tampilkan Data</div>
              <Select
                value={limit}
                onChange={(val) => { setLimit(val === 'all' ? 'all' : Number(val)); setCurrentPage(1); }}
                options={[
                  { value: 'all', label: 'Semua' },
                  { value: 8, label: '8' },
                  { value: 32, label: '32' }
                ]}
                inputStyle={{ padding: '4px 10px', height: 32, fontSize: 12, width: '100%' }}
                style={{ width: '100%' }}
              />
            </div>
          </div>
        )}

        <div className="card-body flush">
          <Table>
            <thead>
              <tr>
                <th>Nama Barang</th>
                <th>Kategori</th>
                <th className="right">Stok Sistem</th>
                <th className="right" style={{ width: 140 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                    Stok Fisik
                    <span title="Barang tanpa inputan akan otomatis dianggap memiliki selisih (variance) 0." style={{ display: 'inline-flex', cursor: 'help' }}>
                      <HelpCircle size={14} className="muted" />
                    </span>
                  </div>
                </th>
                <th className="right">Selisih</th>
                <th className="right">Est. Nilai Selisih</th>
                <th style={{ width: 180 }}>Alasan</th>
                <th style={{ width: 220 }}>Catatan</th>
              </tr>
            </thead>
            <tbody style={{ fontSize: 11 }}>
              {paginatedItems.map((item: any) => {
                const detail = getDetail(item.item_id);
                const actual = detail ? detail.actual_physical_qty : '';
                const variance = Number(detail ? detail.variance : 0);
                const sysBal = detail ? Number(detail.system_balance) : Number(item.system_balance);
                
                // Cost calculation: absolute variance * current average price
                const cost = Math.abs(Number(variance)) * Number(item.current_average_price);

                const ratio = Number(item.conversion_ratio) || 1;
                const smallUnit = formatUnit(item.smallest_unit);

                return (
                  <tr key={item.item_id}>
                    <td className="font-bold text-[10px] md:text-[12px]">
                      {item.item_name as string}
                      <div className="muted font-normal text-[9px] md:text-[10px]" style={{ marginTop: 2 }}>
                        Satuan: {smallUnit}
                      </div>
                    </td>
                    <td className="muted text-[10px] md:text-[11px]">{item.category_name as string}</td>
                    <td className="right num text-[10px] md:text-[12px]">
                      <div className="font-bold">
                        {sysBal.toLocaleString('id-ID', { maximumFractionDigits: 0 })} {smallUnit}
                      </div>
                    </td>
                    <td className="right">
                      <input
                        type="text"
                        className="input right"
                        value={String(actual ?? '')}
                        onChange={(e) => handleQtyChange(item.item_id, sysBal, e.target.value)}
                        disabled={isLocked}
                        placeholder="0"
                        style={{ height: 28, width: '100%', fontSize: 11, padding: '4px 8px', borderColor: String(actual ?? '') === '' ? '#fca5a5' : 'var(--border)' }}
                      />
                    </td>
                    <td className="right num">
                      {variance !== 0 ? (
                        <div>
                          <span style={{ color: variance > 0 ? 'var(--primary)' : '#dc2626', fontWeight: 600 }}>
                            {variance > 0 ? '+' : ''}{variance.toLocaleString('id-ID', { maximumFractionDigits: 0 })} {smallUnit}
                          </span>
                        </div>
                      ) : '-'}
                    </td>
                    <td className="right num font-mono" style={{ color: variance > 0 ? '#016e3f' : variance < 0 ? '#dc2626' : 'var(--muted)', fontWeight: variance !== 0 ? 600 : 400 }}>
                      {variance > 0 ? `+Rp ${cost.toLocaleString('id-ID', { maximumFractionDigits: 0 })}` : variance < 0 ? `-Rp ${cost.toLocaleString('id-ID', { maximumFractionDigits: 0 })}` : 'Rp 0'}
                    </td>
                    <td>
                      {variance !== 0 ? (
                        <Select
                          value={String(detail?.reason_category || '')}
                          onChange={val => handleReasonChange(item.item_id, 'reason_category', String(val))}
                          disabled={isLocked}
                          options={[
                            { value: '', label: '-- Pilih Alasan --' },
                            ...REASON_CATEGORIES
                          ]}
                          inputStyle={{ height: 28, padding: '0px 8px', fontSize: 11, borderColor: !detail?.reason_category ? '#fca5a5' : 'var(--border)' }}
                        />
                      ) : (
                        <span className="muted italic" style={{ fontSize: 13 }}>Tidak ada selisih</span>
                      )}
                    </td>
                    <td>
                      {variance !== 0 && detail?.reason_category ? (
                        <input
                          type="text"
                          className="input"
                          value={String(detail?.reason_notes || '')}
                          onChange={e => handleReasonChange(item.item_id, 'reason_notes', e.target.value)}
                          disabled={isLocked}
                          placeholder={detail?.reason_category === 'LAINNYA' ? 'Wajib diisi...' : 'Opsional...'}
                          style={{ height: 28, width: '100%', fontSize: 11, padding: '4px 8px', borderColor: (detail?.reason_category === 'LAINNYA' && !String(detail?.reason_notes || '').trim()) ? '#fca5a5' : 'var(--border)' }}
                        />
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>

          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={items.length}
              itemsPerPage={limit as number}
              onPageChange={setCurrentPage}
            />
          )}
        </div>
      </div>

      <ConfirmDialog
        open={showConfirm}
        title="Kunci Sesi Opname"
        message="Apakah Anda yakin ingin mengunci sesi ini? Data tidak dapat diubah setelah dikunci."
        confirmText="Kunci Sesi"
        cancelText="Batal"
        loading={saving}
        onConfirm={() => {
          setShowConfirm(false);
          handleSave(true);
        }}
        onCancel={() => setShowConfirm(false)}
      />
    </section>
  );
}
