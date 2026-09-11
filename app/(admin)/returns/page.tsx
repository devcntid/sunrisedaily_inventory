'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { Toast } from '@/components/ui/Toast';
import { Badge } from '@/components/ui/Badge';
import { Image as ImageIcon, Search } from 'lucide-react';

interface ReturnIssue {
  id: number;
  reported_at: string;
  delivery_note_number: string;
  outlet_name: string;
  item_name: string;
  qty_issue: number | string;
  qty_shipped: number | string;
  purchase_unit: string;
  conversion_ratio: number | string | null;
  reason: string;
  photo_url: string | null;
  dn_proof_url?: string | null;
  status: string;
  resolution_notes?: string;
  source_type?: 'DELIVERY_NOTE' | 'OUTLET_TRANSFER';
  from_outlet_name?: string | null;
  transfer_id?: number | null;
}

export default function ReturnsPage() {
  const router = useRouter();
  const [issues, setIssues] = useState<ReturnIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'PENDING' | 'RESOLVED'>('PENDING');
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    id: number | null;
    action: 'REPLACE' | 'WRITE_OFF' | null;
    notes: string;
    source_type?: 'DELIVERY_NOTE' | 'OUTLET_TRANSFER';
  }>({ isOpen: false, id: null, action: null, notes: '', source_type: 'DELIVERY_NOTE' });
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [toast, setToast] = useState<{ isOpen: boolean; message: string; type: 'error' | 'success' | 'info' }>({
    isOpen: false,
    message: '',
    type: 'info',
  });
  const ITEMS_PER_PAGE = 20;
  const lastCountRef = useRef<number | null>(null);

  const showToast = (message: string, type: 'error' | 'success' | 'info' = 'info') => setToast({ isOpen: true, message, type });
  const hideToast = () => setToast(prev => ({ ...prev, isOpen: false }));

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery-note-issues?status=${activeTab}`, { cache: 'no-store' });
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setIssues(list);
      if (activeTab === 'PENDING') {
        setPendingCount(list.length);
        lastCountRef.current = list.length;
      }
    } catch {
      setIssues([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  const fetchIssuesSilent = useCallback(async () => {
    try {
      const res = await fetch('/api/delivery-note-issues?status=PENDING', { cache: 'no-store' });
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      if (lastCountRef.current !== null && list.length > lastCountRef.current) {
        setNewCount(prev => prev + (list.length - lastCountRef.current!));
      }
      lastCountRef.current = list.length;
      setPendingCount(list.length);
      if (activeTab === 'PENDING') setIssues(list);
    } catch {
      // ignore
    }
  }, [activeTab]);

  useEffect(() => {
    setNewCount(0);
    setCurrentPage(1);
    fetchIssues();
  }, [fetchIssues, activeTab]);

  useEffect(() => {
    const interval = setInterval(fetchIssuesSilent, 15000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchIssuesSilent();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchIssuesSilent]);

  const handleResolve = async () => {
    if (!confirmState.id || !confirmState.action) return;
    setResolvingId(confirmState.id);
    const targetSourceType = confirmState.source_type;
    setConfirmState(s => ({ ...s, isOpen: false }));
    try {
      const res = await fetch(`/api/delivery-note-issues/${confirmState.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: confirmState.action,
          notes: confirmState.notes,
          source_type: targetSourceType,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Gagal memproses tiket');
      if (confirmState.action === 'REPLACE' && data.new_dn_id) {
        router.push(`/delivery-orders/${data.new_dn_id}`);
        return;
      }
      showToast('Tiket masalah berhasil diselesaikan.', 'success');
      await fetchIssues();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Error', 'error');
    } finally {
      setResolvingId(null);
    }
  };

  const filteredIssues = issues.filter(i => {
    const search = searchQuery.toLowerCase();
    return (
      (i.delivery_note_number || '').toLowerCase().includes(search) ||
      (i.outlet_name || '').toLowerCase().includes(search) ||
      (i.from_outlet_name || '').toLowerCase().includes(search) ||
      (i.item_name || '').toLowerCase().includes(search) ||
      (i.reason || '').toLowerCase().includes(search)
    );
  });

  const totalPages = Math.ceil(filteredIssues.length / ITEMS_PER_PAGE);
  const paginatedIssues = filteredIssues.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <section className="screen">
      <div className="card">
        <Toast isOpen={toast.isOpen} message={toast.message} type={toast.type} onClose={hideToast} />
        
        {/* Card Header & Tabs */}
        <div style={{ borderBottom: '1px solid var(--border)' }}>
          <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Tiket Masalah</h3>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)' }}>
                Daftar pelaporan selisih atau kerusakan barang dari outlet.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {newCount > 0 && (
                <span style={{
                  fontSize: 11,
                  color: '#dc2626',
                  fontWeight: 600,
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 6,
                  padding: '3px 8px',
                }}>
                  {newCount} tiket baru
                </span>
              )}
              <div style={{ position: 'relative', width: 220 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Cari dokumen / outlet / item..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{
                    width: '100%',
                    padding: '6px 12px 6px 30px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: 13,
                    outline: 'none',
                    boxSizing: 'border-box',
                    background: '#ffffff'
                  }}
                />
              </div>
            </div>
          </div>

          {/* 2 Tabs: Menunggu Tindakan | Riwayat */}
          <div style={{ display: 'flex', padding: '0 20px', gap: 8 }}>
            {(['PENDING', 'RESOLVED'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
                  padding: '12px 14px',
                  fontSize: 13,
                  fontWeight: activeTab === tab ? 700 : 500,
                  color: activeTab === tab ? 'var(--primary)' : 'var(--muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {tab === 'PENDING' ? 'Menunggu Tindakan' : 'Riwayat'}
                {tab === 'PENDING' && pendingCount > 0 && (
                  <span style={{
                    background: '#ef4444',
                    color: '#fff',
                    borderRadius: 99,
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '1px 6px',
                  }}>
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Table Content */}
        <div className="card-body flush">
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Memuat data tiket...</div>
          ) : filteredIssues.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
              </svg>
              <h4>Tidak ada tiket masalah</h4>
              <p>
                {searchQuery
                  ? 'Data tidak ditemukan dengan kata kunci pencarian.'
                  : activeTab === 'PENDING'
                  ? 'Tidak ada laporan masalah yang menunggu tindakan saat ini.'
                  : 'Belum ada riwayat penyelesaian tiket masalah.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>No. Dokumen</th>
                    <th>Outlet</th>
                    <th>Barang</th>
                    <th>Selisih & Masalah</th>
                    {activeTab === 'RESOLVED' && <th>Status / Resolusi</th>}
                    <th className="center" style={{ width: 80 }}>Foto</th>
                    {activeTab === 'PENDING' && <th className="center" style={{ width: 230, minWidth: 230, whiteSpace: 'nowrap' }}>Aksi</th>}
                  </tr>
                </thead>
                <tbody>
                  {paginatedIssues.map(issue => {
                    const conv = Number(issue.conversion_ratio) || 1;
                    const qtyIssue = (Number(issue.qty_issue) / conv).toLocaleString('id-ID');
                    const qtyShipped = (Number(issue.qty_shipped) / conv).toLocaleString('id-ID');
                    const photo = issue.photo_url || issue.dn_proof_url;
                    const tgl = new Date(issue.reported_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
                    const isTransfer = issue.source_type === 'OUTLET_TRANSFER';

                    return (
                      <tr key={`${issue.source_type || 'DN'}_${issue.id}`}>
                        <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>
                          {tgl}
                        </td>
                        <td>
                          <div className="font-mono text-primary font-bold">
                            {issue.delivery_note_number}
                          </div>
                        </td>
                        <td>
                          <div className="font-bold">{issue.outlet_name}</div>
                          {isTransfer && issue.from_outlet_name && (
                            <div className="muted" style={{ fontSize: 11 }}>
                              Dari: {issue.from_outlet_name}
                            </div>
                          )}
                        </td>
                        <td>
                          <div className="font-bold">{issue.item_name}</div>
                          <div className="muted" style={{ fontSize: 11 }}>
                            Dikirim: {qtyShipped} {issue.purchase_unit}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: '#dc2626' }}>
                            Selisih: {qtyIssue} {issue.purchase_unit}
                          </div>
                          <div className="muted" style={{ fontSize: 12, maxWidth: 220 }}>
                            {issue.reason}
                          </div>
                        </td>
                        {activeTab === 'RESOLVED' && (
                          <td>
                            <Badge variant={issue.status === 'APPROVED_REPLACE' ? 'green' : 'amber'}>
                              {issue.status === 'APPROVED_REPLACE' ? 'Ganti Barang' : 'Catat Kerugian'}
                            </Badge>
                            {issue.resolution_notes && (
                              <div className="muted" style={{ fontSize: 11, marginTop: 4, maxWidth: 180 }}>
                                {issue.resolution_notes}
                              </div>
                            )}
                          </td>
                        )}
                        <td className="center">
                          {photo ? (
                            <button
                              type="button"
                              onClick={() => setPreviewPhoto(photo)}
                              title="Lihat Foto Bukti"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                background: '#f8fafc',
                                border: '1px solid #cbd5e1',
                                borderRadius: 6,
                                padding: '4px 8px',
                                fontSize: 12,
                                color: '#334155',
                                cursor: 'pointer',
                              }}
                            >
                              <ImageIcon size={13} /> Foto
                            </button>
                          ) : (
                            <span className="muted" style={{ fontSize: 12 }}>-</span>
                          )}
                        </td>
                        {activeTab === 'PENDING' && (
                          <td className="center" style={{ width: 230, whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setConfirmState({
                                  isOpen: true,
                                  id: issue.id,
                                  action: 'WRITE_OFF',
                                  notes: '',
                                  source_type: issue.source_type || 'DELIVERY_NOTE',
                                })}
                                disabled={resolvingId === issue.id}
                                style={{
                                  fontSize: 12,
                                  height: 30,
                                  padding: '0 12px',
                                  whiteSpace: 'nowrap',
                                  fontWeight: 600,
                                  color: '#334155',
                                  borderColor: '#cbd5e1',
                                  background: '#ffffff',
                                  borderRadius: 6,
                                }}
                              >
                                Catat Kerugian
                              </Button>
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => setConfirmState({
                                  isOpen: true,
                                  id: issue.id,
                                  action: 'REPLACE',
                                  notes: '',
                                  source_type: issue.source_type || 'DELIVERY_NOTE',
                                })}
                                disabled={resolvingId === issue.id}
                                style={{
                                  fontSize: 12,
                                  height: 30,
                                  padding: '0 12px',
                                  whiteSpace: 'nowrap',
                                  fontWeight: 600,
                                  borderRadius: 6,
                                }}
                              >
                                Ganti Barang
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </Table>

              {totalPages > 1 && (
                <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'center' }}>
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={filteredIssues.length}
                    itemsPerPage={ITEMS_PER_PAGE}
                    onPageChange={setCurrentPage}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal Konfirmasi Tindakan */}
      <Modal
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState(s => ({ ...s, isOpen: false }))}
        title={confirmState.action === 'REPLACE' ? 'Konfirmasi Ganti Barang' : 'Konfirmasi Catat Kerugian'}
        maxWidth={440}
      >
        <div style={{ padding: '16px 20px' }}>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
            {confirmState.action === 'REPLACE'
              ? 'Barang pengganti akan diproses untuk dikirimkan ke outlet. Lanjutkan?'
              : 'Selisih barang akan dicatat sebagai kerugian (write-off) dan tidak akan diganti. Lanjutkan?'}
          </p>
          <textarea
            rows={2}
            placeholder="Catatan resolusi (opsional)"
            value={confirmState.notes}
            onChange={e => setConfirmState(s => ({ ...s, notes: e.target.value }))}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              fontSize: 13,
              marginBottom: 14,
              boxSizing: 'border-box',
              outline: 'none',
              fontFamily: 'inherit'
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button variant="outline" onClick={() => setConfirmState(s => ({ ...s, isOpen: false }))}>
              Batal
            </Button>
            <Button variant="primary" onClick={handleResolve} disabled={resolvingId !== null}>
              {resolvingId !== null ? 'Memproses...' : 'Konfirmasi'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Foto */}
      <Modal isOpen={!!previewPhoto} onClose={() => setPreviewPhoto(null)} title="Foto Bukti Masalah" maxWidth={500}>
        {previewPhoto && (
          <div style={{ padding: 16, background: '#f8fafc', display: 'flex', justifyContent: 'center' }}>
            <img src={previewPhoto} alt="Bukti" style={{ maxWidth: '100%', maxHeight: 400, borderRadius: 6, objectFit: 'contain' }} />
          </div>
        )}
      </Modal>
    </section>
  );
}
