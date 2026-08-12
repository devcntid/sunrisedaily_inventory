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

const REASON_CATEGORIES = [
  { value: 'SALAH_CATAT', label: 'Salah Catat / Koreksi (+ / -)' },
  { value: 'BONUS_SUPPLIER', label: 'Bonus / Kelebihan Kirim (+)' },
  { value: 'RETUR_BELUM_CATAT', label: 'Retur Belum Dicatat (+)' },
  { value: 'RUSAK', label: 'Rusak (-)' },
  { value: 'KADALUARSA', label: 'Kadaluarsa (-)' },
  { value: 'HILANG_SUSUT', label: 'Hilang / Susut (-)' },
  { value: 'LAINNYA', label: 'Lainnya (+ / -)' },
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
  const [details, setDetails] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [limit, setLimit] = useState<number | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; isOpen: boolean }>({ message: '', type: 'info', isOpen: false });
  const [confirmState, setConfirmState] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void }>({ open: false, title: '', message: '', onConfirm: () => {} });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type, isOpen: true });
  };

  const fetchOpname = useCallback(async () => {
    setLoading(true);
    // Fetch header
    const hRes = await fetch(`/api/opname/${id}`);
    if (hRes.ok) {
      const hData = await hRes.json();
      setHeader(hData.data);
      setIsLocked(hData.data?.status === 'LOCKED');
      
      if (hData.data?.location_id) {
        // Fetch all items for input
        const iRes = await fetch(`/api/opname/items?location_type=OUTLET&location_id=${hData.data.location_id}`);
        const iData = await iRes.json();
        setItems(iData.data ?? []);
      }
    }

    // Fetch existing details for this session
    const dRes = await fetch(`/api/opname/${id}/detail`);
    const dData = await dRes.json();
    setDetails(dData.data ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchOpname(); }, [fetchOpname]);

  const getDetail = (itemId: number) => details.find(d => d.item_id === itemId);

  // Outlet opname: input langsung dalam smallest_unit (gr, ml, Pcs)
  // karena staf outlet menghitung sisa bahan dalam satuan terkecil (misal: sisa 250 gr gula)
  const handleQtyChange = (itemId: number, systemBalance: number, actualQtySmall: string) => {
    if (isLocked) return;
    const numericVal = actualQtySmall.replace(/[^0-9.]/g, '');
    const qtySmall = numericVal === '' ? systemBalance : parseFloat(numericVal);

    const existing = details.find(d => d.item_id === itemId);
    const variance = qtySmall - systemBalance;

    // Reset reason if variance becomes 0
    let reason_category = existing?.reason_category;
    let reason_notes = existing?.reason_notes;
    if (variance === 0) {
      reason_category = undefined;
      reason_notes = undefined;
    }

    if (existing) {
      setDetails(details.map(d => d.item_id === itemId ? { 
        ...d, 
        actual_physical_qty: numericVal === '' ? '' : qtySmall, 
        input_value: numericVal, // preserve exact string input
        variance, 
        reason_category, 
        reason_notes 
      } : d));
    } else {
      setDetails([...details, { 
        item_id: itemId, 
        system_balance: systemBalance, 
        actual_physical_qty: numericVal === '' ? '' : qtySmall, 
        input_value: numericVal, 
        variance 
      }]);
    }
  };

  const handleReasonChange = (itemId: number, field: 'reason_category' | 'reason_notes', value: string) => {
    if (isLocked) return;
    setDetails(details.map(d => d.item_id === itemId ? { ...d, [field]: value } : d));
  };

  const handleSave = async (submit: boolean = false) => {
    // Validate reasons for non-zero variance items
    if (submit) {
      const invalidDetails = details.filter(d => d.variance !== 0 && !d.reason_category);
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
      // Upsert all details
      for (const detail of details) {
        if (detail.actual_physical_qty !== undefined) {
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
          showToast('Opname Stok berhasil dikunci. Penyesuaian telah dicatat pada Log Inventaris Outlet.', 'success');
          fetchOpname();
        } else {
          showToast(data.message || 'Failed to lock opname.', 'error');
        }
      } else {
        showToast(`Draft berhasil disimpan (${details.length} item). Stok belum berubah.`, 'success');
      }
    } catch (err: unknown) {
      showToast((err instanceof Error ? err.message : 'Unknown error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Memuat data opname...</div>;
  if (!header) return <div style={{ padding: 40, textAlign: 'center' }}>Sesi tidak ditemukan.</div>;

  const paginatedItems = limit === 'all' ? items : items.slice((currentPage - 1) * limit, currentPage * limit);
  const totalPages = limit === 'all' ? 1 : Math.ceil(items.length / limit);

  return (
    <section className="screen">
      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ fontSize: 18, margin: 0, fontWeight: 700 }}>Detail Opname Outlet — {new Date(header.count_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</h3>
            <div style={{ marginTop: 8, display: 'flex', gap: 16, alignItems: 'center' }}>
              <Badge variant={isLocked ? 'green' : header.status === 'SUBMITTED' ? 'blue' : 'gray'}>{header.status === 'LOCKED' ? 'Selesai (Terkunci)' : header.status === 'SUBMITTED' ? 'Diajukan' : header.status === 'DRAFT' ? 'Draf' : header.status}</Badge>
              <span className="muted" style={{ fontSize: 13 }}>
                <span className="font-bold">Mulai:</span> {new Date(header.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="muted" style={{ fontSize: 13 }}>
                <span className="font-bold">Terakhir Diubah:</span> {new Date(header.updated_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Button variant="outline" size="sm" onClick={() => setShowMobileFilters(!showMobileFilters)} className="md:hidden" style={{ height: 32, padding: '0 8px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>
            </Button>
            <div className="hidden md:block">
              <Select
                value={limit}
                onChange={(val) => { setLimit(val === 'all' ? 'all' : Number(val)); setCurrentPage(1); }}
                options={[
                  { value: 'all', label: 'Semua' },
                  { value: 8, label: '8' },
                  { value: 32, label: '32' }
                ]}
                inputStyle={{ padding: '4px 10px', height: 32, fontSize: 13, minWidth: 90 }}
                style={{ width: 100 }}
              />
            </div>
            {!isLocked && (
              <>
                <Button variant="outline" size="sm" onClick={() => handleSave(false)} disabled={saving} style={{ padding: '0 8px', height: 32 }}>
                  <span className="hidden md:inline">Simpan Draft</span>
                  <span className="md:hidden" title="Simpan Draft"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg></span>
                </Button>
                <Button variant="primary" size="sm" onClick={() => {
                  setConfirmState({
                    open: true,
                    title: 'Kunci Sesi Opname?',
                    message: 'Apakah Anda yakin ingin mengunci sesi ini? Data tidak dapat diubah setelah dikunci.',
                    onConfirm: () => {
                      setConfirmState(prev => ({ ...prev, open: false }));
                      handleSave(true);
                    }
                  });
                }} disabled={saving} style={{ padding: '0 8px', height: 32 }}>
                  <span className="hidden md:inline">Kunci & Submit</span>
                  <span className="md:hidden" title="Kunci & Submit"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg></span>
                </Button>
              </>
            )}
            <Link href="/opname/outlet">
              <Button variant="outline" size="sm" style={{ padding: '0 8px', height: 32 }}>
                <span className="hidden md:inline">Kembali</span>
                <span className="md:hidden" title="Kembali"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg></span>
              </Button>
            </Link>
          </div>
        </div>
        
        {showMobileFilters && (
          <div className="md:hidden" style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', background: '#f8fafc' }}>
            <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 600 }}>Tampilkan Data</div>
            <Select
              value={limit}
              onChange={(val) => { setLimit(val === 'all' ? 'all' : Number(val)); setCurrentPage(1); }}
              options={[
                { value: 'all', label: 'Semua' },
                { value: 8, label: '8' },
                { value: 32, label: '32' }
              ]}
              inputStyle={{ padding: '4px 10px', height: 32, fontSize: 13, width: '100%' }}
              style={{ width: '100%' }}
            />
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto' }}>
          <Table>
            <thead>
              <tr>
                <th style={{ padding: '12px 16px', fontSize: 12, minWidth: 200 }}>Nama Barang</th>
                <th className="right" style={{ padding: '12px 16px', fontSize: 12, width: 140 }}>Harga</th>
                <th className="right" style={{ padding: '12px 16px', fontSize: 12, width: 120 }}>Stok Sistem</th>
                <th className="right" style={{ width: 140, padding: '12px 16px', fontSize: 12 }}>Stok Fisik</th>
                <th className="right" style={{ width: 100, padding: '12px 16px', fontSize: 12 }}>Selisih</th>
                <th className="right" style={{ width: 130, padding: '12px 16px', fontSize: 12 }}>Est. Nilai Selisih</th>
                <th style={{ width: 180, padding: '12px 16px', fontSize: 12 }}>Alasan</th>
                <th style={{ width: 220, padding: '12px 16px', fontSize: 12 }}>Catatan</th>
              </tr>
            </thead>
            <tbody style={{ fontSize: 12 }}>
              {paginatedItems.map((item: any) => {
                const detail = getDetail(item.item_id);
                // Outlet: tidak pakai konversi — input & tampil langsung dalam smallest_unit
                const smallUnit = formatUnit(item.smallest_unit);

                // actual_physical_qty di DB tersimpan dalam smallest_unit
                const actualSmall = detail?.actual_physical_qty;
                
                let displayVal = detail?.input_value as string | undefined;
                if (displayVal === undefined) {
                  displayVal = actualSmall !== undefined && actualSmall !== null && actualSmall !== '' 
                    ? actualSmall.toString() 
                    : '';
                }

                const varianceSmall = Number(detail?.variance ?? 0);
                const varianceValue = Math.round(Math.abs(Number(varianceSmall)) * Number(item.current_average_price));

                // Stok sistem dalam smallest_unit
                const sysBalSmall = Number(item.system_balance);

                return (
                  <tr key={item.item_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td className="font-bold text-[11px] md:text-[13px]" style={{ padding: '8px 16px' }}>
                      {item.item_name as string}
                      <div className="muted font-normal text-[10px] md:text-[11px]" style={{ marginTop: 2 }}>
                        Satuan: {smallUnit}
                      </div>
                    </td>
                    <td className="right num text-[11px] md:text-[13px]" style={{ padding: '8px 16px' }}>
                      Rp {Math.round(Number(item.current_average_price)).toLocaleString('id-ID')}
                      <div className="muted font-normal text-[10px] md:text-[11px]" style={{ marginTop: 2 }}>
                        / {smallUnit}
                      </div>
                    </td>
                    <td className="right num text-[11px] md:text-[13px]" style={{ padding: '8px 16px' }}>
                      {sysBalSmall.toLocaleString('id-ID')} <span className="muted text-[10px] md:text-[11px]">{smallUnit}</span>
                    </td>
                    <td className="right" style={{ padding: '8px 16px' }}>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="number"
                          className="input right"
                          value={displayVal}
                          onChange={(e) => handleQtyChange(item.item_id as number, item.system_balance as number, e.target.value)}
                          onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          disabled={isLocked}
                          placeholder="0"
                          step="any"
                          style={{ height: 32, width: '100%', fontSize: 13, padding: '4px 8px', paddingRight: 40, borderColor: displayVal === '' ? '#fca5a5' : 'var(--border)' }}
                        />
                        <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#64748b', pointerEvents: 'none', fontWeight: 600 }}>
                          {smallUnit}
                        </span>
                      </div>
                    </td>
                    <td className="right num" style={{ padding: '8px 16px', fontSize: 13 }}>
                      {varianceSmall !== 0 ? (
                        <span style={{ color: varianceSmall > 0 ? 'var(--primary)' : '#dc2626', fontWeight: 600 }}>
                          {varianceSmall > 0 ? '+' : ''}{Number(varianceSmall).toLocaleString('id-ID')}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="right num font-mono" style={{ padding: '8px 16px', fontSize: 13, color: varianceSmall > 0 ? '#016e3f' : varianceSmall < 0 ? '#dc2626' : 'inherit', fontWeight: varianceSmall !== 0 ? 600 : 400 }}>
                      {varianceSmall > 0 ? `+Rp ${varianceValue.toLocaleString('id-ID')}` : varianceSmall < 0 ? `-Rp ${varianceValue.toLocaleString('id-ID')}` : '-'}
                    </td>
                    <td style={{ padding: '8px 16px' }}>
                      {varianceSmall !== 0 ? (
                        <Select
                          value={String(detail?.reason_category || '')}
                          onChange={val => handleReasonChange(item.item_id, 'reason_category', String(val))}
                          disabled={isLocked}
                          options={[
                            { value: '', label: '-- Pilih Alasan --' },
                            ...REASON_CATEGORIES
                          ]}
                          inputStyle={{ height: 32, padding: '0px 8px', fontSize: 12, borderColor: !detail?.reason_category ? '#fca5a5' : 'var(--border)' }}
                          optionStyle={{ padding: '6px 10px', fontSize: 12 }}
                        />
                      ) : (
                        <span className="muted italic" style={{ fontSize: 12 }}>Tidak ada selisih</span>
                      )}
                    </td>
                    <td style={{ padding: '8px 16px' }}>
                      {varianceSmall !== 0 && detail?.reason_category ? (
                        <input
                          type="text"
                          className="input"
                          value={String(detail?.reason_notes || '')}
                          onChange={e => handleReasonChange(item.item_id, 'reason_notes', e.target.value)}
                          disabled={isLocked}
                          placeholder={detail?.reason_category === 'LAINNYA' ? 'Wajib diisi...' : 'Opsional...'}
                          style={{ height: 32, padding: '4px 8px', fontSize: 12, width: '100%', borderColor: (detail?.reason_category === 'LAINNYA' && !String(detail?.reason_notes || '').trim()) ? '#fca5a5' : 'var(--border)' }}
                        />
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <div style={{ padding: '16px' }}>
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
