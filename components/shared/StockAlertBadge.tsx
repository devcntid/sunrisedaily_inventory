import React from 'react';
import { Badge } from '@/components/ui/Badge';

interface StockAlertBadgeProps {
  qty: number;
  threshold: number;
}

export function StockAlertBadge({ qty, threshold }: StockAlertBadgeProps) {
  if (qty <= 0) return <Badge variant="red">Habis</Badge>;
  if (qty <= threshold) return <Badge variant="amber">Tipis</Badge>;
  return <Badge variant="green">Aman</Badge>;
}
