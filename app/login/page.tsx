'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { signIn } from 'next-auth/react';
import { FullScreenLoader } from '@/components/ui/FullScreenLoader';
import { Toast } from '@/components/ui/Toast';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fullLoading, setFullLoading] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    if (err) {
      setToastMessage(err);
      setToastOpen(true);
      params.delete('error');
      const newSearch = params.toString();
      window.history.replaceState(null, '', window.location.pathname + (newSearch ? `?${newSearch}` : ''));
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setToastOpen(false);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!data.success) {
        setToastMessage(data.message || 'Email atau password salah');
        setToastOpen(true);
        setSubmitting(false);
      } else {
        setSubmitting(false);
        setFullLoading(true);
        const params = new URLSearchParams(window.location.search);
        const cbUrl = params.get('callbackUrl');
        router.push(cbUrl || '/dashboard');
        router.refresh();
      }
    } catch {
      setToastMessage('Terjadi kesalahan. Coba lagi.');
      setToastOpen(true);
      setSubmitting(false);
    }
  }

  return (
    <>
      <Toast isOpen={toastOpen} message={toastMessage} type="error" onClose={() => setToastOpen(false)} />
      <FullScreenLoader open={fullLoading} label="Loading" />
      <div style={{ minHeight: '100dvh', background: 'linear-gradient(135deg, #014f2d 0%, #016e3f 50%, #1a7a4a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        {/* Background decoration */}
        <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: '-10%', right: '-10%', width: 500, height: 500, borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />
          <div style={{ position: 'absolute', bottom: '-15%', left: '-8%', width: 400, height: 400, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
          <div style={{ position: 'absolute', top: '30%', left: '5%', width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.02)' }} />
        </div>

        <div className="animate-fade-in" style={{ display: 'flex', gap: 20, alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: 680, flexWrap: 'wrap' }}>
          <div style={{ width: '100%', maxWidth: 320 }}>
            {/* Card */}
            <div style={{ background: 'white', borderRadius: 16, padding: '24px', boxShadow: '0 24px 80px rgba(0,0,0,0.25)' }}>
              {/* Logo */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
                <div style={{ width: 'auto', height: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: -20 }}>
                  <Image src="/logo-warna.png" alt="Sunrise Daily" width={80} height={80} priority style={{ objectFit: 'contain', width: 'auto', height: 'auto' }} />
                </div>
                <h1 style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-cabin, Cabin, sans-serif)', color: '#1a2e25', marginBottom: 2 }}>Sunrise Daily</h1>
                <p style={{ fontSize: 11, color: '#8aaa9a', textAlign: 'center', lineHeight: 1.4 }}>Centralized Procurement &amp; Inventory System</p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                <div className="form-group">
                  <label className="form-label">Email</label>
                  <div style={{ position: 'relative' }}>
                    <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#8aaa9a' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
                    <input
                      type="email"
                      className="form-control"
                      style={{ paddingLeft: 36, fontSize: 13, height: 38 }}
                      placeholder="admin@sunrisedaily.id"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Password</label>
                  <div style={{ position: 'relative' }}>
                    <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#8aaa9a' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                    <input
                      type={showPass ? 'text' : 'password'}
                      className="form-control"
                      style={{ paddingLeft: 36, paddingRight: 36, fontSize: 13, height: 38 }}
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                    />
                    <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#8aaa9a', padding: 2 }}>
                      {showPass
                        ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                        : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                      }
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting || fullLoading}
                  style={{ width: '100%', marginTop: 2, padding: '10px', fontSize: 13.5, fontWeight: 600, letterSpacing: 0.3 }}
                >
                  Masuk
                </button>
              </form>

              <div style={{ display: 'flex', alignItems: 'center', margin: '14px 0' }}>
                <div style={{ flex: 1, height: 1, background: '#e2e8f0' }}></div>
                <div style={{ padding: '0 8px', fontSize: 11, color: '#94a3b8' }}>ATAU</div>
                <div style={{ flex: 1, height: 1, background: '#e2e8f0' }}></div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setFullLoading(true);
                  const params = new URLSearchParams(window.location.search);
                  const cbUrl = params.get('callbackUrl') || '/dashboard';
                  signIn('google', { callbackUrl: cbUrl });
                }}
                disabled={submitting || fullLoading}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px', fontSize: 13.5, fontWeight: 600, color: '#1e293b', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseOver={(e) => (e.currentTarget.style.background = '#f8fafc')}
                onMouseOut={(e) => (e.currentTarget.style.background = 'white')}
              >
                <svg width="20" height="20" viewBox="0 0 48 48">
                  <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
                  <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
                  <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.222,0-9.653-3.343-11.303-8l-6.571,4.819C9.656,39.663,16.318,44,24,44z" />
                  <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
                </svg>
                <span style={{ fontSize: 13.5 }}>Masuk dengan Google</span>
              </button>

              <p style={{ textAlign: 'center', marginTop: 14, fontSize: 11, color: '#8aaa9a' }}>
                Hanya untuk pengguna internal Sunrise Daily
              </p>

            </div>

            <p style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
              © 2026 Sunrise Daily. Seluruh hak dilindungi.
            </p>
          </div>

        </div>
      </div>
    </>
  );
}
