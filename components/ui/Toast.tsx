'use client';
import { useEffect } from 'react';

export interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  isOpen: boolean;
  onClose: () => void;
  duration?: number;
}

export function Toast({ message, type = 'info', isOpen, onClose, duration = 4000 }: ToastProps) {
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose, duration]);

  if (!isOpen) return null;

  const isError = type === 'error';
  const bgColor = isError ? '#dc2626' : '#016e3f';

  return (
    <div style={{
      position: 'fixed',
      top: 24,
      right: 24,
      zIndex: 99999,
      background: bgColor,
      color: '#ffffff',
      padding: '12px 18px',
      borderRadius: '8px',
      boxShadow: '0 8px 20px rgba(0, 0, 0, 0.15)',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      fontFamily: "'Albert Sans', sans-serif",
      fontSize: '14px',
      fontWeight: 500,
      animation: 'toast-slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      maxWidth: '420px'
    }}>
      <style>{`
        @keyframes toast-slide-in {
          0% { transform: translateX(100%); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
      `}</style>

      <div style={{ flex: 1, lineHeight: '1.4' }}>{message}</div>

      <button
        onClick={onClose}
        style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', padding: 4, display: 'flex', opacity: 0.8 }}
        onMouseOver={e => e.currentTarget.style.opacity = '1'}
        onMouseOut={e => e.currentTarget.style.opacity = '0.8'}
        title="Tutup"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
      </button>
    </div>
  );
}
