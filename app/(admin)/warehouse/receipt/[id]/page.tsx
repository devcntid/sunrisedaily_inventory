import { getPurchaseOrderById } from '@/lib/queries/purchase-orders';
import { notFound } from 'next/navigation';
import ReceiptClient from './ReceiptClient';

export default async function WarehouseReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const po = await getPurchaseOrderById(Number(id));
  
  if (!po) {
    notFound();
  }
  
  // Also pass the items. getPurchaseOrderById includes items if we use the same query, wait let's check it.
  // We need items in PO! Let's pass the raw po object and fetch the items in client if they are missing.
  return <ReceiptClient poId={po.id} />;
}
