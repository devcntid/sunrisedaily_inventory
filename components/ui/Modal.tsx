import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: string | number;
  footer?: React.ReactNode;
  closeOnOutsideClick?: boolean;
}

export function Modal({ isOpen, onClose, title, children, maxWidth = 600, footer, closeOnOutsideClick = true }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay open" onClick={e => { if (closeOnOutsideClick && e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box" style={{ maxWidth }}>
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: title ? undefined : '16px 20px 0 20px', borderBottom: title ? undefined : 'none' }}>
          {title ? (
            <h3 style={{ margin: 0, fontSize: 'inherit' }}>{title}</h3>
          ) : <div />}
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', margin: '-4px', display: 'flex', alignItems: 'center', color: '#64748b', borderRadius: '4px' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'} title="Tutup" aria-label="Tutup">
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">
          {children}
        </div>
        {footer && (
          <div className="modal-actions" style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', background: '#f8fafc', display: 'flex', gap: 8, justifyContent: 'flex-end', borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
