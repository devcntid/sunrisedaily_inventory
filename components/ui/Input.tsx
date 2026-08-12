import React, { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="form-group" style={{ marginBottom: label ? undefined : 0 }}>
        {label && <label className="form-label">{label}</label>}
        <input ref={ref} className={`input ${className}`} {...props} />
        {error && <span style={{ color: '#dc2626', fontSize: 12, marginTop: 4, display: 'block' }}>{error}</span>}
      </div>
    );
  }
);
Input.displayName = 'Input';
