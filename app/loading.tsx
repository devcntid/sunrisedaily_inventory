'use client';
import { FullScreenLoader } from '@/components/ui/FullScreenLoader';

export default function Loading() {
  return <FullScreenLoader open={true} label="Loading" />;
}
