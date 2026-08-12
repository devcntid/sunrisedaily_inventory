import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getUnresolvedAlertCount } from '@/lib/queries/alerts';
import Sidebar from '@/components/shared/Sidebar';
import TopBar from '@/components/shared/TopBar';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  let alertCount = 0;
  if (session.role === 'ADMIN_PUSAT') {
    try {
      alertCount = await getUnresolvedAlertCount();
    } catch { alertCount = 0; }
  }

  return (
    <div className="app">
      <Sidebar role={session.role as 'ADMIN_PUSAT' | 'ADMIN_OUTLET'} alertCount={alertCount} />
      <div className="main">
        <TopBar user={session} />
        <main className="content">
          {children}
        </main>
      </div>
    </div>
  );
}
