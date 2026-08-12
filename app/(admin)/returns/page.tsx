'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { Toast } from '@/components/ui/Toast';
import { Image as ImageIcon } from 'lucide-react';

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
}

export default function ReturnsPage() {
  const router = useRouter();
  const [issues, setIssues] = useState<ReturnIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'PENDING' | 'RESOLVED'>('PENDING');
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [pendingCount, setPendingCount] = useState(0); // selalu jumlah PENDING, tidak berubah saat pindah tab
  const [newCount, setNewCount] = useState(0); // jumlah tiket baru sejak halaman dibuka
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean; id: number | null; action: 'REPLACE' | 'WRITE_OFF' | null; notes: string;
  }>({ isOpen: false, id: null, action: null, notes: '' });
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [toast, setToast] = useState<{isOpen: boolean, message: string, type: 'error' | 'success' | 'info'}>({isOpen: false, message: '', type: 'info'});
  const ITEMS_PER_PAGE = 20;
  const lastCountRef = useRef<number | null>(null);

  const showToast = (message: string, type: 'error' | 'success' | 'info' = 'info') => setToast({isOpen: true, message, type});
  const hideToast = () => setToast(prev => ({...prev, isOpen: false}));

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
    } catch { setIssues([]); }
    finally { setLoading(false); }
  }, [activeTab]);

  // Silent refresh tanpa loading spinner — hanya untuk tab PENDING
  const fetchIssuesSilent = useCallback(async () => {
    try {
      const res = await fetch('/api/delivery-note-issues?status=PENDING', { cache: 'no-store' });
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      // Deteksi tiket baru
      if (lastCountRef.current !== null && list.length > lastCountRef.current) {
        setNewCount(prev => prev + (list.length - lastCountRef.current!));
      }
      lastCountRef.current = list.length;
      setPendingCount(list.length); // selalu update count badge PENDING
      // Update daftar hanya jika sedang di tab PENDING
      if (activeTab === 'PENDING') setIssues(list);
    } catch { /* abaikan */ }
  }, [activeTab]);

  useEffect(() => {
    setNewCount(0);
    setCurrentPage(1);
    fetchIssues();
  }, [fetchIssues, activeTab]);

  // Polling real-time setiap 15 detik + saat tab kembali aktif
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
    setConfirmState(s => ({ ...s, isOpen: false }));
    try {
      const res = await fetch(`/api/delivery-note-issues/${confirmState.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: confirmState.action, notes: confirmState.notes }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Gagal memproses tiket');
      if (confirmState.action === 'REPLACE' && data.new_dn_id) {
        router.push(`/delivery-orders/${data.new_dn_id}`);
        return;
      }
      await fetchIssues();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Error', 'error');
    } finally {
      setResolvingId(null);
    }
  };

  const filteredIssues = issues.filter(i => 
    i.delivery_note_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.outlet_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.item_name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const totalPages = Math.ceil(filteredIssues.length / ITEMS_PER_PAGE);
  const paginatedIssues = filteredIssues.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <section className="screen">
      <div className="card">
        <Toast isOpen={toast.isOpen} message={toast.message} type={toast.type} onClose={hideToast} />
        {/* Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', padding: '0 20px' }}>
          <div style={{ display: 'flex' }}>
            {(['PENDING', 'RESOLVED'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  background: 'none', border: 'none',
                  borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
                  padding: '12px 14px', fontSize: 12,
                  fontWeight: activeTab === tab ? 700 : 400,
                  color: activeTab === tab ? 'var(--primary)' : 'var(--muted)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {tab === 'PENDING' ? 'Menunggu Tindakan' : 'Riwayat'}
                {tab === 'PENDING' && pendingCount > 0 && (
                  <span style={{
                    background: '#ef4444', color: '#fff',
                    borderRadius: 99, fontSize: 10, fontWeight: 700,
                    padding: '0px 5px', lineHeight: '16px', display: 'inline-block',
                  }}>
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>
          {/* Indikator notif tiket baru dan pencarian */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {newCount > 0 && (
              <span style={{
                fontSize: 11, color: '#dc2626', fontWeight: 600,
                background: '#fef2f2', border: '1px solid #fecaca',
                borderRadius: 6, padding: '3px 8px',
              }}>
                {newCount} tiket baru masuk
              </span>
            )}
            <Input
              placeholder="Cari SJ / Outlet / Item..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              style={{ width: 200, fontSize: 13, height: 32 }}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Memuat...</div>
        ) : filteredIssues.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            {searchQuery ? 'Data tidak ditemukan.' : (activeTab === 'PENDING' ? 'Tidak ada laporan masalah saat ini.' : 'Belum ada riwayat tindakan.')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Surat Jalan</th>
                  <th>Item</th>
                  <th>Masalah</th>
                  {activeTab === 'RESOLVED' && <th>Resolusi</th>}
                  <th style={{ textAlign: 'center', width: 70 }}>Foto</th>
                  {activeTab === 'PENDING' && <th style={{ textAlign: 'right', width: 200 }}></th>}
                </tr>
              </thead>
              <tbody>
                {paginatedIssues.map(issue => {
                  const conv = Number(issue.conversion_ratio) || 1;
                  const qtyIssue = (Number(issue.qty_issue) / conv).toLocaleString('id-ID');
                  const qtyShipped = (Number(issue.qty_shipped) / conv).toLocaleString('id-ID');
                  const photo = issue.photo_url || issue.dn_proof_url;
                  const tgl = new Date(issue.reported_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
                  const jam = new Date(issue.reported_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

                  return (
                    <tr key={issue.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{tgl}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{jam} WIB</div>
                      </td>
                      <td>
                        <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: 'var(--primary)' }}>
                          {issue.delivery_note_number}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{issue.outlet_name}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{issue.item_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>Dikirim: {qtyShipped} {issue.purchase_unit}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#dc2626' }}>
                          {qtyIssue} {issue.purchase_unit}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', maxWidth: 200 }}>{issue.reason}</div>
                      </td>
                      {activeTab === 'RESOLVED' && (
                        <td>
                          <span style={{
                            fontSize: 11, fontWeight: 600,
                            color: issue.status === 'APPROVED_REPLACE' ? 'var(--primary)' : '#92400e',
                          }}>
                            {issue.status === 'APPROVED_REPLACE' ? 'Ganti Barang' : 'Catat Kerugian'}
                          </span>
                          {(issue as any).resolution_notes && (
                            <div style={{ fontSize: 11, color: 'var(--muted)', maxWidth: 180 }}>{(issue as any).resolution_notes}</div>
                          )}
                        </td>
                      )}
                      <td style={{ textAlign: 'center' }}>
                        {photo ? (
                          <button
                            onClick={() => setPreviewPhoto(photo)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 3,
                              background: 'none', border: '1px solid var(--border)',
                              borderRadius: 5, padding: '3px 8px', fontSize: 11,
                              color: 'var(--text)', cursor: 'pointer',
                            }}
                          >
                            <ImageIcon size={10} /> Lihat
                          </button>
                        ) : <span style={{ fontSize: 11, color: 'var(--muted)' }}>—</span>}
                      </td>
                      {activeTab === 'PENDING' && (
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                            <Button
                              variant="outline" size="sm"
                              onClick={() => setConfirmState({ isOpen: true, id: issue.id, action: 'WRITE_OFF', notes: '' })}
                              disabled={resolvingId === issue.id}
                              style={{ fontSize: 11, padding: '3px 10px', height: 'auto' }}
                            >
                              Catat Kerugian
                            </Button>
                            <Button
                              variant="primary" size="sm"
                              onClick={() => setConfirmState({ isOpen: true, id: issue.id, action: 'REPLACE', notes: '' })}
                              disabled={resolvingId === issue.id}
                              style={{ fontSize: 11, padding: '3px 10px', height: 'auto' }}
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
              <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'center' }}>
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

      {/* Modal Konfirmasi */}
      <Modal
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState(s => ({ ...s, isOpen: false }))}
        title={confirmState.action === 'REPLACE' ? 'Ganti Barang' : 'Catat Kerugian'}
        maxWidth={440}
      >
        <div style={{ padding: '16px 20px' }}>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
            {confirmState.action === 'REPLACE'
              ? 'Surat Jalan baru akan otomatis dibuat untuk mengganti barang ini. Lanjutkan?'
              : 'Barang akan dicatat sebagai write-off dan tidak akan diganti. Lanjutkan?'}
          </p>
          <textarea
            className="input"
            rows={2}
            placeholder="Catatan (opsional)"
            value={confirmState.notes}
            onChange={e => setConfirmState(s => ({ ...s, notes: e.target.value }))}
            style={{ width: '100%', resize: 'none', fontSize: 13, marginBottom: 14 }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button variant="outline" onClick={() => setConfirmState(s => ({ ...s, isOpen: false }))}>Batal</Button>
            <Button variant="primary" onClick={handleResolve} disabled={resolvingId !== null}>
              {resolvingId !== null ? 'Memproses...' : 'Konfirmasi'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Foto */}
      <Modal isOpen={!!previewPhoto} onClose={() => setPreviewPhoto(null)} title="Foto Bukti" maxWidth={500}>
        {previewPhoto && (
          <div style={{ padding: 16, background: '#f8fafc', display: 'flex', justifyContent: 'center' }}>
            <img src={previewPhoto} alt="Bukti" style={{ maxWidth: '100%', maxHeight: 400, borderRadius: 6, objectFit: 'contain' }} />
          </div>
        )}
      </Modal>
    </section>
  );
}
