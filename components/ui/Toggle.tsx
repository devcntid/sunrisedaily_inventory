'use client';
import React from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function Toggle({ checked, onChange, label, className = '', size = 'md' }: ToggleProps) {
  const isSm = size === 'sm';
  const width = isSm ? 42 : 54;
  const height = isSm ? 24 : 30;
  const thumbSize = isSm ? 16 : 22;

  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} className={className}>
      <div
        tabIndex={0}
        onClick={() => onChange(!checked)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onChange(!checked);
          }
        }}
        style={{
          width,
          height,
          borderRadius: 30,
          background: checked ? 'var(--primary)' : '#cbd5e1',
          border: '3px solid #f1f5f9',
          boxShadow: '0 2px 4px rgba(0,0,0,0.06), inset 0 2px 4px rgba(0,0,0,0.15)',
          position: 'relative',
          transition: 'background 0.3s ease',
          outline: 'none',
          boxSizing: 'border-box'
        }}
      >
        <div 
          style={{
            position: 'absolute',
            top: '50%',
            left: checked ? `calc(100% - ${thumbSize}px - 1px)` : '1px',
            transform: 'translateY(-50%)',
            width: thumbSize,
            height: thumbSize,
            background: '#ffffff',
            borderRadius: '50%',
            boxShadow: '0 2px 5px rgba(0,0,0,0.2), 0 1px 1px rgba(0,0,0,0.1)',
            transition: 'left 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg 
            width={isSm ? "10" : "12"} height={isSm ? "10" : "12"} viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" 
            style={{ 
              opacity: checked ? 1 : 0, 
              transform: checked ? 'scale(1)' : 'scale(0)',
              transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' 
            }}
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      </div>
      {label && <span style={{ fontSize: isSm ? 12 : 13, fontWeight: 500, userSelect: 'none', color: checked ? 'var(--ink)' : 'var(--muted)', transition: 'color 0.2s' }}>{label}</span>}
    </label>
  );
}
