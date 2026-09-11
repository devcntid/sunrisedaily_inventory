import React from 'react';
import { Badge } from '@/components/ui/Badge';

export type TransferStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'COMPLETED' | 'REJECTED' | 'CANCELLED' | string;

interface TransferStatusBadgeProps {
  status: TransferStatus;
}

const TRANSFER_STATUS_MAP: Record<string, { label: string; variant: 'amber' | 'blue' | 'green' | 'red' | 'gray' }> = {
  PENDING_APPROVAL: { label: 'Menunggu Alokasi', variant: 'amber' },
  APPROVED: { label: 'Disetujui / Dikirim', variant: 'blue' },
  COMPLETED: { label: 'Selesai', variant: 'green' },
  REJECTED: { label: 'Ditolak', variant: 'red' },
  CANCELLED: { label: 'Dibatalkan', variant: 'gray' },
};

export function TransferStatusBadge({ status }: TransferStatusBadgeProps) {
  const cfg = TRANSFER_STATUS_MAP[status] ?? { label: status, variant: 'gray' };
  return (
    <Badge variant={cfg.variant}>{cfg.label}</Badge>
  );
}
