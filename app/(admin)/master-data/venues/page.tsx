'use client';
import { useState, useEffect, useCallback } from 'react';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import { MasterDataTabs } from '@/components/ui/MasterDataTabs';
import { Toast } from '@/components/ui/Toast';

interface Venue { id: number; name: string; }

export default function venuesPage() {
  const [venues, setvenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Add Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState('');
  
  // Inline Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  
  const [saving, setSaving] = useState(false);
  
  const [toast, setToast] = useState<{ isOpen: boolean, message: string, type: 'success' | 'error' | 'info' }>({ isOpen: false, message: '', type: 'info' });
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => setToast({ isOpen: true, message, type });
  const hideToast = () => setToast(prev => ({ ...prev, isOpen: false }));

  // Confirm state
  const [confirmDelete, setConfirmDelete] = useState<Venue | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const fetchvenues = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/venues');
    const data = await res.json();
    setvenues(data.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchvenues(); }, [fetchvenues]);

  function openAdd() { setAddName(''); hideToast(); setShowAddModal(true); }
  
  function openEdit(c: Venue) { 
    setEditingId(c.id); 
    setEditName(c.name); 
    hideToast(); 
  }
  
  function cancelEdit() {
    setEditingId(null);
    setEditName('');
    hideToast();
  }

  async function handleAddSave() {
    if (!addName.trim()) { showToast('Nama venue wajib', 'error'); return; }
    setSaving(true); hideToast();
    try {
      const res = await fetch('/api/venues', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: addName }) });
      const data = await res.json();
      if (!data.success) { showToast(data.message, 'error'); return; }
      setShowAddModal(false); 
      fetchvenues();
      showToast('venue berhasil ditambahkan', 'success');
    } finally { setSaving(false); }
  }

  async function handleEditSave(id: number) {
    if (!editName.trim()) { showToast('Nama venue wajib', 'error'); return; }
    setSaving(true); hideToast();
    try {
      const res = await fetch('/api/venues', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, name: editName }) });
      const data = await res.json();
      if (!data.success) { showToast(data.message, 'error'); return; }
      cancelEdit();
      fetchvenues();
      showToast('venue berhasil diperbarui', 'success');
    } finally { setSaving(false); }
  }

  async function executeDelete() {
    if (!confirmDelete) return;
    await fetch(`/api/venues?id=${confirmDelete.id}`, { method: 'DELETE' });
    setConfirmDelete(null);
    fetchvenues();
    showToast('venue berhasil dihapus', 'success');
  }

  const paginatedvenues = venues.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(venues.length / ITEMS_PER_PAGE);

  return (
    <section className="screen">
      <div className="card">
        <MasterDataTabs activeTab="venues" />
        <div className="card-head">
          <div>
            <h3>venue Barang</h3>
          </div>
          <Button variant="primary" size="sm" onClick={openAdd}>+ Tambah venue</Button>
        </div>
        <div className="card-body flush">
          {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Memuat...</div> : (
            <>
              <div className="table-responsive">
                <Table>
                  <thead><tr><th>No.</th><th>Nama venue</th><th className="center">Aksi</th></tr></thead>
                  <tbody>
                    {paginatedvenues.map((c, idx) => {
                      const isEditing = editingId === c.id;
                      return (
                      <tr key={c.id}>
                        <td className="muted">{(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}</td>
                        <td className="font-bold">
                          {isEditing ? (
                            <div>
                              <input 
                                className="input" 
                                value={editName} 
                                onChange={e => setEditName(e.target.value)} 
                                autoFocus 
                                style={{ width: '100%', padding: '6px 10px', fontSize: 14 }}
                                onKeyDown={e => { 
                                  if (e.key === 'Enter') handleEditSave(c.id); 
                                  if (e.key === 'Escape') cancelEdit(); 
                                }}
                              />
                            </div>
                          ) : (
                            c.name
                          )}
                        </td>
                        <td className="center">
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            {isEditing ? (
                              <>
                                <Button size="sm" variant="primary" onClick={() => handleEditSave(c.id)} disabled={saving} style={{ padding: '4px 12px' }}>
                                   Simpan
                                </Button>
                                <Button size="sm" variant="outline" onClick={cancelEdit} disabled={saving} style={{ padding: '4px 12px' }}>
                                   Batal
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button size="sm" onClick={() => openEdit(c)} title="Edit" style={{ background: 'var(--blue-light)', color: 'var(--blue)', border: '1px solid #bcdcf3' }}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                </Button>
                                <Button size="sm" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }} onClick={() => setConfirmDelete(c)} title="Delete">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                    {paginatedvenues.length === 0 && (
                      <tr><td colSpan={3} className="center muted" style={{ padding: 32 }}>venue tidak ditemukan</td></tr>
                    )}
                  </tbody>
                </Table>
              </div>

              <Pagination 
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={venues.length}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={setCurrentPage}
              />
            </>
          )}
        </div>
      </div>

      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Tambah venue" maxWidth={500}>
        <div className="modal-body" style={{ padding: '24px' }}>
          <Input 
            label="Nama venue" 
            value={addName} 
            onChange={e => setAddName(e.target.value)} 
            placeholder="misal: Sirup, Minuman & Susu" 
            autoFocus 
          />
        </div>
        <div className="modal-actions" style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', background: '#f8fafc', display: 'flex', gap: 8, justifyContent: 'flex-end', borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>
          <Button variant="outline" onClick={() => setShowAddModal(false)}>Batal</Button>
          <Button variant="primary" onClick={handleAddSave} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan venue'}</Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Konfirmasi Hapus"
        message={`Hapus venue ${confirmDelete?.name}?`}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={executeDelete}
        confirmText="Hapus"
        danger={true}
      />
      <Toast message={toast.message} type={toast.type} isOpen={toast.isOpen} onClose={hideToast} />
    </section>
  );
}
