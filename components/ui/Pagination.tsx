'use client';
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Select } from './Select';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
}

export function Pagination({ currentPage, totalPages, totalItems, itemsPerPage, onPageChange, onLimitChange }: PaginationProps) {
  if (totalPages <= 1 && !onLimitChange) return null;

  return (
    <div className="pagination" style={{ justifyContent: 'flex-end' }}>
      <div className="page-btns">
        <button className="page-btn" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ChevronLeft size={18} />
        </button>
        {Array.from({ length: totalPages }).map((_, i) => {
          const p = i + 1;
          if (p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)) {
            return (
              <button key={p} className={`page-btn ${p === currentPage ? 'active' : ''}`} onClick={() => onPageChange(p)}>
                {p}
              </button>
            );
          }
          if (p === currentPage - 2 || p === currentPage + 2) {
            return <span key={p} className="muted" style={{ padding: '0 4px' }}>…</span>;
          }
          return null;
        })}
        <button className="page-btn" disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
