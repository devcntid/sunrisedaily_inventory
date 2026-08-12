'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Table } from '@/components/ui/Table';
import { Toast } from '@/components/ui/Toast';
import { SettingsTabs } from '@/components/ui/SettingsTabs';

export default function UsersManagementPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [outlets, setOutlets] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [toast, setToast] = useState({ open: false, message: '', type: 'info' as any });
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'ADMIN_OUTLET',
    outlet_id: '',
    password: ''
  });

  function openAddUser() {
    setEditingUserId(null);
    setFormData({ name: '', email: '', role: 'ADMIN_OUTLET', outlet_id: '', password: '' });
    setModalOpen(true);
  }

  function openEditUser(user: { id: number, name: string, email: string, role: string, outlet_id?: number | null }) {
    setEditingUserId(user.id);
    setFormData({
      name: user.name || '',
      email: user.email || '',
      role: user.role || 'ADMIN_OUTLET',
      outlet_id: user.outlet_id ? String(user.outlet_id) : '',
      password: '' // empty initially when editing
    });
    setModalOpen(true);
  }

  useEffect(() => {
    fetchUsers();
    fetchOutlets();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (data.success) setUsers(data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function fetchOutlets() {
    try {
      const res = await fetch('/api/outlets');
      const data = await res.json();
      if (data.success) setOutlets(data.data);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const url = editingUserId ? `/api/users/${editingUserId}` : '/api/users';
      const method = editingUserId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          role: formData.role,
          outlet_id: formData.outlet_id ? parseInt(formData.outlet_id) : null,
          ...(formData.password && formData.role === 'ADMIN_OUTLET' ? { password: formData.password } : {})
        })
      });
      const data = await res.json();
      if (data.success) {
        setToast({ open: true, message: data.message, type: 'success' });
        setModalOpen(false);
        setFormData({ name: '', email: '', role: 'ADMIN_OUTLET', outlet_id: '', password: '' });
        fetchUsers();
      } else {
        setToast({ open: true, message: data.message || 'Gagal menyimpan pengguna', type: 'error' });
      }
    } catch (err) {
      setToast({ open: true, message: 'Terjadi kesalahan sistem', type: 'error' });
    }
  }

  return (
    <section className="screen">
      <SettingsTabs />
      <Toast isOpen={toast.open} message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, open: false })} />
      
      <div className="card">
        <div className="card-head">
          <div>
            <h3>Manajemen Pengguna</h3>
            <p className="text-muted">Kelola akun Super Admin dan Admin Outlet</p>
          </div>
          <Button variant="primary" onClick={openAddUser}>+ Tambah Pengguna</Button>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <p style={{ padding: 24 }}>Memuat...</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '10px 16px', background: '#f8fafc', fontSize: 12, color: '#64748b' }}>NAMA</th>
                  <th style={{ textAlign: 'left', padding: '10px 16px', background: '#f8fafc', fontSize: 12, color: '#64748b' }}>EMAIL GOOGLE</th>
                  <th style={{ textAlign: 'left', padding: '10px 16px', background: '#f8fafc', fontSize: 12, color: '#64748b' }}>PERAN</th>
                  <th style={{ textAlign: 'left', padding: '10px 16px', background: '#f8fafc', fontSize: 12, color: '#64748b' }}>OUTLET</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr 
                    key={user.id} 
                    onClick={() => openEditUser(user)}
                    className="hover:bg-slate-50 transition-colors"
                    style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 500 }}>{user.name}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13 }}>{user.email}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: user.role === 'ADMIN_PUSAT' ? '#fef3c7' : '#e0e7ff', color: user.role === 'ADMIN_PUSAT' ? '#92400e' : '#3730a3', fontWeight: 600 }}>
                        {user.role === 'ADMIN_PUSAT' ? 'Super Admin (Pusat)' : user.role === 'ADMIN_OUTLET' ? 'Admin Outlet' : user.role}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#64748b', fontSize: 13 }}>{user.outlet_name || '-'}</td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>Tidak ada pengguna ditemukan.</td>
                  </tr>
                )}
              </tbody>
            </Table>
          )}
        </div>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingUserId ? "Edit Pengguna" : "Tambah Pengguna"} maxWidth={500}>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="alert-banner alert-info" style={{ fontSize: '13px', marginBottom: 20, alignItems: 'flex-start' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginTop: 2 }}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
              <div>
                Super Admin (Pusat) login menggunakan <strong>Google SSO</strong> (tanpa kata sandi). Admin Outlet dapat masuk menggunakan Kata Sandi.
              </div>
            </div>
            
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 6, display: 'block' }}>Nama Lengkap</label>
              <Input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
            </div>
            
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 6, display: 'block' }}>Alamat Email</label>
              <Input type="email" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
            </div>

            {formData.role === 'ADMIN_OUTLET' && (
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 6, display: 'block' }}>
                  Kata Sandi {editingUserId && <span className="muted" style={{ fontWeight: 400 }}>(Kosongkan jika tidak ingin diubah)</span>}
                </label>
                <Input type="password" required={!editingUserId} value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} placeholder={editingUserId ? "Kosongkan jika tidak diubah" : "Masukkan kata sandi"} />
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: formData.role === 'ADMIN_OUTLET' ? '1fr 1fr' : '1fr', gap: 16 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 6, display: 'block' }}>Peran</label>
                <select className="form-control" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value, outlet_id: '' })}>
                  <option value="ADMIN_OUTLET">Admin Outlet</option>
                  <option value="ADMIN_PUSAT">Super Admin (Pusat)</option>
                </select>
              </div>
              
              {formData.role === 'ADMIN_OUTLET' && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 6, display: 'block' }}>Lokasi Outlet</label>
                  <select className="form-control" required value={formData.outlet_id} onChange={e => setFormData({ ...formData, outlet_id: e.target.value })}>
                    <option value="">-- Pilih Outlet --</option>
                    {outlets.map(o => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
          
          <div className="modal-actions" style={{ background: '#f8fafc', borderBottomLeftRadius: 8, borderBottomRightRadius: 8 }}>
            <Button variant="outline" type="button" onClick={() => setModalOpen(false)}>Batal</Button>
            <Button variant="primary" type="submit" style={{ padding: '0 24px' }}>Simpan Pengguna</Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
