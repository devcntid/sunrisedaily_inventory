import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { CentralLocalPurchaseView } from './CentralLocalPurchaseView';

export const metadata = {
  title: 'Belanja Outlet (Lokal) | Admin Pusat',
};

export default async function CentralLocalPurchasesPage() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') {
    redirect('/login');
  }

  return <CentralLocalPurchaseView />;
}
