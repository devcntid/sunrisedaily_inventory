'use client';
import { useState, useEffect } from 'react';

interface Outlet { id: number; name: string; type: string; }

export default function ProfilePage() {
  const [profile, setProfile] = useState<{ id: number; name: string; email: string; role: string; outlet_id: number | null } | null>(null);
  const [outlet, setOutlet] = useState<Outlet | null>(null);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(async d => {
      if (d.success && d.data) {
        setProfile(d.data);
        if (d.data.outlet_id) {
          const res = await fetch('/api/outlets');
          const outletsData = await res.json();
          const outletObj = (outletsData.data ?? []).find((o: Outlet) => o.id === d.data.outlet_id);
          setOutlet(outletObj);
        }
      }
    }).catch(err => {
      console.error(err);
    });
  }, []);

  return (
    <div className="animate-fade-in" style={{ maxWidth: 500 }}>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Profil Akun Saya</h2>
        </div>
        <div className="card-body">
          {profile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700 }}>
                  {profile.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{profile.name}</div>
                  <div style={{ color: 'var(--text-muted)' }}>{profile.email}</div>
                  <span className={`badge ${profile.role === 'ADMIN_PUSAT' ? 'badge-primary' : 'badge-success'}`} style={{ marginTop: 4, display: 'inline-block' }}>
                    {profile.role === 'ADMIN_PUSAT' ? 'Admin Gudang Pusat' : 'Admin Outlet'}
                  </span>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Nama Lengkap</label>
                <input className="form-control" value={profile.name} readOnly disabled />
              </div>
              <div className="form-group">
                <label className="form-label">Email / Username</label>
                <input className="form-control" value={profile.email} readOnly disabled />
              </div>
              <div className="form-group">
                <label className="form-label">Lokasi Tugas</label>
                <input className="form-control" value={outlet ? `${outlet.name} (${outlet.type})` : 'Gudang Pusat'} readOnly disabled />
              </div>

              <div className="alert-banner alert-warning" style={{ marginTop: 12 }}>
                Untuk mengubah kata sandi atau data akun, hubungi IT / Administrator Sistem.
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Memuat profil...</div>
          )}
        </div>
      </div>
    </div>
  );
}
