import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export function Button({ variant = 'primary', size = 'md', className = '', children, ...props }: ButtonProps) {
  let baseClass = 'btn';
  if (variant === 'primary') baseClass += ' btn-primary';
  if (variant === 'outline') baseClass += ' btn-outline';
  if (variant === 'ghost') baseClass += ' btn-ghost';
  
  if (size === 'sm') baseClass += ' btn-sm';
  if (size === 'lg') baseClass += ' btn-lg';

  return (
    <button className={`${baseClass} ${className}`} {...props}>
      {children}
    </button>
  );
}
