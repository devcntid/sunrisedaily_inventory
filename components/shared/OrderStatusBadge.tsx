import React from 'react';
import { Badge } from '@/components/ui/Badge';

interface OrderStatusBadgeProps {
  status: string;
}

const STATUS_MAP: Record<string, { label: string; variant: 'gray' | 'blue' | 'amber' | 'green' }> = {
  PENDING: { label: 'Menunggu', variant: 'gray' },
  PROCESSING: { label: 'Diproses', variant: 'blue' },
  SHIPPED: { label: 'Dikirim', variant: 'amber' },
  COMPLETED: { label: 'Selesai', variant: 'green' },
};

export function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
  const cfg = STATUS_MAP[status] ?? { label: status, variant: 'gray' };
  return (
    <Badge variant={cfg.variant}>{cfg.label}</Badge>
  );
}
