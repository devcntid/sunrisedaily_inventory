import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { LocalPurchaseView } from './LocalPurchaseView';

export const metadata = { title: 'Belanja Sendiri (Lokal) - Outlet' };

export default async function OutletLocalPurchasesPage() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_OUTLET') redirect('/login');

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Belanja Outlet</h2>
      </div>
      <div className="card-body p-0">
        <LocalPurchaseView role="ADMIN_OUTLET" outletId={session.outletId || undefined} />
      </div>
    </div>
  );
}
