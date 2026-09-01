'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { signIn } from 'next-auth/react';
import { FullScreenLoader } from '@/components/ui/FullScreenLoader';
import { Toast } from '@/components/ui/Toast';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

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

  const handleGoogleSignIn = () => {
    setLoading(true);
    const params = new URLSearchParams(window.location.search);
    const cbUrl = params.get('callbackUrl') || '/dashboard';
    signIn('google', { callbackUrl: cbUrl });
  };

  return (
    <>
      <Toast isOpen={toastOpen} message={toastMessage} type="error" onClose={() => setToastOpen(false)} />
      <FullScreenLoader open={loading} label="Menghubungkan ke Google..." />

      <div
        style={{
          minHeight: '100dvh',
          background: 'linear-gradient(135deg, #0d3826 0%, #016e3f 50%, #064e2b 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Ambient background blur circles */}
        <div style={{ position: 'absolute', top: '-15%', right: '-10%', width: 550, height: 550, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-20%', left: '-10%', width: 500, height: 500, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />

        {/* Login Card */}
        <div
          className="animate-fade-in"
          style={{
            width: '100%',
            maxWidth: 440,
            background: '#ffffff',
            borderRadius: 24,
            padding: '40px 32px 32px 32px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {/* Logo & Brand Header */}
          <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: 90, height: 90, position: 'relative', marginBottom: 8 }}>
              <Image
                src="/logo-warna.png"
                alt="Sunrise Daily"
                fill
                priority
                style={{ objectFit: 'contain' }}
              />
            </div>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 800,
                fontFamily: 'var(--font-cabin, Cabin, sans-serif)',
                color: '#0f172a',
                marginBottom: 4,
                lineHeight: 1.2,
              }}
            >
              Sunrise Daily
            </h1>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#016e3f', letterSpacing: 0.2 }}>
              Pusat Pengadaan & Sistem Inventaris
            </p>
          </div>

          <p
            style={{
              fontSize: 13,
              color: '#64748b',
              lineHeight: 1.5,
              marginBottom: 28,
              paddingLeft: 8,
              paddingRight: 8,
            }}
          >
            Gunakan akun Google yang telah terdaftar untuk mengakses sistem.
          </p>

          {/* Google SSO Action Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              background: '#ffffff',
              border: '1.5px solid #e2e8f0',
              borderRadius: 14,
              padding: '14px 20px',
              fontSize: 15,
              fontWeight: 600,
              color: '#1e293b',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
            }}
            onMouseOver={(e) => {
              if (!loading) {
                e.currentTarget.style.background = '#f8fafc';
                e.currentTarget.style.borderColor = '#cbd5e1';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)';
              }
            }}
            onMouseOut={(e) => {
              if (!loading) {
                e.currentTarget.style.background = '#ffffff';
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.03)';
              }
            }}
          >
            <svg width="22" height="22" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
              <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
              <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.222,0-9.653-3.343-11.303-8l-6.571,4.819C9.656,39.663,16.318,44,24,44z" />
              <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
            </svg>
            <span>Masuk dengan Google</span>
          </button>

          <p style={{ textAlign: 'center', marginTop: 16, fontSize: 11.5, color: '#8aaa9a', fontWeight: 500 }}>
            Hanya untuk pengguna internal Sunrise Daily
          </p>

          {/* Footer Terms & Policy */}
          <p style={{ marginTop: 24, fontSize: 11.5, color: '#94a3b8', lineHeight: 1.5 }}>
            Dengan masuk, Anda menyetujui{' '}
            <a href="#" style={{ color: '#016e3f', textDecoration: 'underline', fontWeight: 500 }}>
              Syarat & Ketentuan
            </a>{' '}
            dan{' '}
            <a href="#" style={{ color: '#016e3f', textDecoration: 'underline', fontWeight: 500 }}>
              Kebijakan Privasi
            </a>
            .
          </p>
        </div>

        {/* Copyright notice below card */}
        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 11.5, color: 'rgba(255,255,255,0.6)', position: 'relative', zIndex: 1 }}>
          © 2026 Sunrise Daily. Seluruh hak dilindungi.
        </p>
      </div>
    </>
  );
}

