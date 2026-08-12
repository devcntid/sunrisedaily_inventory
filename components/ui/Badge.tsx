import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'green' | 'red' | 'blue' | 'gray' | 'amber' | 'primary';
  className?: string;
}

export function Badge({ children, variant = 'gray', className = '' }: BadgeProps) {
  let baseClass = 'badge';
  if (variant === 'green') baseClass += ' b-green';
  if (variant === 'red') baseClass += ' b-red';
  if (variant === 'blue') baseClass += ' b-blue';
  if (variant === 'amber') baseClass += ' b-amber';
  if (variant === 'gray') baseClass += ' b-gray';
  
  return (
    <span className={`${baseClass} ${className}`}>
      {children}
    </span>
  );
}
