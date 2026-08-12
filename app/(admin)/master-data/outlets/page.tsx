'use client';
import { useState, useEffect, useCallback } from 'react';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import { MasterDataTabs } from '@/components/ui/MasterDataTabs';

interface Outlet { id: number; name: string; type: string; address?: string; street?: string; street2?: string; city?: string; state?: string; zip?: string; country?: string; pic_name?: string; email?: string; phone?: string; map_location?: string; is_active: boolean; created_at: string; venue_id?: number | null; venue_name?: string | null; }

const TYPE_LABELS: Record<string, string> = { STORE: 'Toko', CENTRAL_KITCHEN: 'Dapur Pusat' };
import { Toast } from '@/components/ui/Toast';

export default function OutletsPage() {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Outlet | null>(null);
  const [venues, setVenues] = useState<{id: number, name: string}[]>([]);
  const [form, setForm] = useState({ name: '', type: 'STORE', address: '', street: '', street2: '', city: '', state: '', zip: '', country: '', pic_name: '', email: '', phone: '', map_location: '', is_active: true, venue_id: '' as string | number });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ isOpen: boolean, message: string, type: 'success' | 'error' | 'info' }>({ isOpen: false, message: '', type: 'info' });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => setToast({ isOpen: true, message, type });
  const hideToast = () => setToast(prev => ({ ...prev, isOpen: false }));

  const [confirmDelete, setConfirmDelete] = useState<Outlet | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const fetchOutlets = useCallback(async () => {
    setLoading(true);
    const [resOutlets, resVenues] = await Promise.all([
      fetch('/api/outlets'),
      fetch('/api/settings/venues')
    ]);
    const data = await resOutlets.json();
    const vData = await resVenues.json();
    setOutlets(data.data ?? []);
    setVenues(vData.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchOutlets(); }, [fetchOutlets]);

  function openAdd() { setEditing(null); setForm({ name: '', type: 'STORE', address: '', street: '', street2: '', city: '', state: '', zip: '', country: '', pic_name: '', email: '', phone: '', map_location: '', is_active: true, venue_id: '' }); hideToast(); setShowModal(true); }
  function openEdit(o: Outlet) { setEditing(o); setForm({ name: o.name, type: o.type, address: o.address ?? '', street: o.street ?? '', street2: o.street2 ?? '', city: o.city ?? '', state: o.state ?? '', zip: o.zip ?? '', country: o.country ?? '', pic_name: o.pic_name ?? '', email: o.email ?? '', phone: o.phone ?? '', map_location: o.map_location ?? '', is_active: o.is_active ?? true,
    // Konversi ke string agar cocok dengan value option di <select> (pg BIGINT bisa number atau string)
    venue_id: o.venue_id != null ? String(o.venue_id) : ''
  }); hideToast(); setShowModal(true); }

  async function handleSave() {
    if (!form.name.trim()) { showToast('Nama outlet wajib diisi', 'error'); return; }

    if (form.phone && !/^\d+$/.test(form.phone)) {
      showToast('Nomor telepon hanya boleh berisi angka', 'error');
      return;
    }

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      showToast('Format email tidak valid (harus mengandung @)', 'error');
      return;
    }

    if (form.zip) {
      if (!/^\d+$/.test(form.zip)) {
        showToast('Kode pos hanya boleh berisi angka', 'error');
        return;
      }
      const isIndo = form.country.toLowerCase().includes('indo');
      if (isIndo && form.zip.length > 5) {
        showToast('Maksimal input kodepos adalah 5 digit', 'error');
        return;
      }
      if (!isIndo && form.zip.length > 12) {
        showToast('Maksimal input kodepos adalah 12 digit', 'error');
        return;
      }
    }

    setSaving(true); hideToast();
    try {
      const method = editing ? 'PATCH' : 'POST';
      const body = { ...form, venue_id: form.venue_id ? Number(form.venue_id) : null };
      const finalBody = editing ? { id: editing.id, ...body } : body;
      const res = await fetch('/api/outlets', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(finalBody) });
      const data = await res.json();
      if (!data.success) { showToast(data.message, 'error'); return; }
      setShowModal(false); fetchOutlets();
      showToast('Data outlet berhasil disimpan', 'success');
    } finally { setSaving(false); }
  }

  async function executeDelete() {
    if (!confirmDelete) return;
    await fetch(`/api/outlets?id=${confirmDelete.id}`, { method: 'DELETE' });
    setConfirmDelete(null);
    fetchOutlets();
    showToast('Data outlet berhasil dihapus', 'success');
  }

  function formatDate(iso: string) {
    if (!iso) return '-';
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  }

  const paginatedOutlets = outlets.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(outlets.length / ITEMS_PER_PAGE);

  return (
    <section className="screen">
      <div className="card">
        <MasterDataTabs activeTab="outlets" />
        <div className="card-body flush">
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
            <Button variant="primary" size="sm" onClick={openAdd}>+ Tambah Outlet</Button>
          </div>
          {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Memuat...</div> : (
            <>
              <div className="table-responsive">
                <Table>
                  <thead><tr><th>No.</th><th>Nama Outlet</th><th>Tipe</th><th>PIC</th><th>Telepon</th><th>Email</th><th>Status</th><th className="center">Aksi</th></tr></thead>
                  <tbody>
                    {paginatedOutlets.map((o, idx) => (
                      <tr key={o.id}>
                        <td className="muted">{(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}</td>
                        <td className="font-bold">
                          {o.name}
                        </td>
                        <td><Badge variant={o.type === 'STORE' ? 'blue' : 'green'}>{TYPE_LABELS[o.type] ?? o.type}</Badge></td>
                        <td style={{ fontSize: 13 }}>
                          <div style={{ fontWeight: 600 }}>{o.pic_name || <span className="muted">—</span>}</div>
                          <div style={{ marginTop: 2 }}>
                            {o.venue_name && (
                              <span style={{ fontSize: 10, background: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                                {o.venue_name.toUpperCase()}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ fontSize: 13 }}>
                          {o.phone ? <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {o.phone}
                          </div> : <span className="muted">—</span>}
                        </td>
                        <td style={{ fontSize: 13 }}>
                          {o.email ? <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {o.email}
                          </div> : <span className="muted">—</span>}
                        </td>
                        <td>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 600,
                            background: o.is_active ? '#dcfce7' : '#f1f5f9',
                            color: o.is_active ? '#166534' : '#475569'
                          }}>
                            {o.is_active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td className="center">
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            <Button size="sm" onClick={() => openEdit(o)} title="Edit" style={{ background: 'var(--blue-light)', color: 'var(--blue)', border: '1px solid #bcdcf3' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                            </Button>
                            <Button size="sm" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }} onClick={() => setConfirmDelete(o)} title="Delete">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {paginatedOutlets.length === 0 && (
                      <tr><td colSpan={8} className="center muted" style={{ padding: 32 }}>Outlet tidak ditemukan</td></tr>
                    )}
                  </tbody>
                </Table>
              </div>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={outlets.length}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={setCurrentPage}
              />
            </>
          )}
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Outlet' : 'Outlet Baru'} maxWidth={850}>
        <div className="modal-body" style={{ padding: 24, maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 24, marginTop: 4 }}>
              <div style={{ display: 'flex', gap: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                  <input type="radio" name="outlet_type" checked={form.type === 'STORE'} onChange={() => setForm(f => ({ ...f, type: 'STORE' }))} /> Toko
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                  <input type="radio" name="outlet_type" checked={form.type === 'CENTRAL_KITCHEN'} onChange={() => setForm(f => ({ ...f, type: 'CENTRAL_KITCHEN' }))} /> Dapur Pusat
                </label>
              </div>
              <div style={{ width: 1, background: '#e2e8f0' }}></div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 }} title="Ubah Status Outlet">
                <div style={{ position: 'relative', width: 32, height: 18, background: form.is_active ? '#016e3f' : '#cbd5e1', borderRadius: 9, transition: 'background 0.2s' }}>
                  <div style={{ position: 'absolute', top: 2, left: form.is_active ? 16 : 2, width: 14, height: 14, background: 'white', borderRadius: '50%', transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }} />
                </div>
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} style={{ display: 'none' }} />
                {form.is_active ? 'Aktif' : 'Nonaktif'}
              </label>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {/* Left Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <label style={{ width: 100, fontWeight: 700, fontSize: 13 }}>Nama Outlet</label>
                <input className="input" style={{ flex: 1, padding: '6px 10px', fontSize: 13 }} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="misal: ER Edhos BDG" />
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <label style={{ width: 100, fontWeight: 700, fontSize: 13 }}>PIC</label>
                <input className="input" style={{ flex: 1, padding: '6px 10px', fontSize: 13 }} value={form.pic_name} onChange={e => setForm(f => ({ ...f, pic_name: e.target.value }))} placeholder="misal: Budi Santoso" />
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <label style={{ width: 100, fontWeight: 700, fontSize: 13, paddingTop: 6 }}>Alamat</label>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <input className="input" style={{ padding: '6px 10px', fontSize: 13 }} value={form.street} onChange={e => setForm(f => ({ ...f, street: e.target.value }))} placeholder="Jalan 1" />

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <input className="input" style={{ padding: '6px 10px', fontSize: 13 }} value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Kota" />
                    <input className="input" style={{ padding: '6px 10px', fontSize: 13 }} value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} placeholder="Provinsi" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <input className="input" style={{ padding: '6px 10px', fontSize: 13 }} value={form.zip} onChange={e => setForm(f => ({ ...f, zip: e.target.value.replace(/\D/g, '') }))} placeholder="Kode Pos" maxLength={form.country.toLowerCase().includes('indo') ? 5 : 12} />
                    <input className="input" style={{ padding: '6px 10px', fontSize: 13 }} value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} placeholder="Negara" />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <label style={{ width: 100, fontWeight: 700, fontSize: 13 }}>Telepon</label>
                <input className="input" style={{ flex: 1, padding: '6px 10px', fontSize: 13 }} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '') }))} placeholder="misal: 081234567890" />
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <label style={{ width: 100, fontWeight: 700, fontSize: 13 }}>Email</label>
                <input className="input" style={{ flex: 1, padding: '6px 10px', fontSize: 13 }} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="outlet@example.com" />
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <label style={{ width: 100, fontWeight: 700, fontSize: 13 }}>Lingkungan</label>
                <select className="input" style={{ flex: 1, padding: '6px 10px', fontSize: 13 }} value={String(form.venue_id)} onChange={e => setForm(f => ({ ...f, venue_id: e.target.value }))}>
                  <option value="">-- Tidak Ditautkan --</option>
                  {venues.map(v => (
                    <option key={v.id} value={String(v.id)}>{v.name}</option>
                  ))}
                </select>
              </div>

            </div>
          </div>
        </div>
        <div className="modal-actions" style={{ padding: '12px 24px', borderTop: '1px solid var(--border)', background: '#f8fafc', display: 'flex', gap: 8, justifyContent: 'flex-end', borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>
          <Button variant="outline" onClick={() => setShowModal(false)}>Batal</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Konfirmasi Hapus"
        message={`Hapus outlet ${confirmDelete?.name}?`}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={executeDelete}
        confirmText="Hapus"
        danger={true}
      />
      <Toast message={toast.message} type={toast.type} isOpen={toast.isOpen} onClose={hideToast} />
    </section>
  );
}
