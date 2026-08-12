'use client';

import { useRouter } from 'next/navigation';
import React from 'react';

interface TableRowLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export default function TableRowLink({ href, children, className = '', style }: TableRowLinkProps) {
  const router = useRouter();
  return (
    <tr onClick={() => router.push(href)} className={className} style={{ cursor: 'pointer', ...style }}>
      {children}
    </tr>
  );
}
