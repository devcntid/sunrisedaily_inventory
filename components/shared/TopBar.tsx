'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

interface TopBarProps {
  user: {
    name: string;
    role: string;
    outletId: number | null;
  };
}

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Ringkasan Utama',
  '/requests/create': 'Buat Permintaan',
  '/requests': 'Permintaan Outlet',
  '/purchase-orders': 'Pembelian (PO)',
  '/goods-receipt': 'Penerimaan Barang',
  '/stock-card': 'Kartu Stok',
  '/delivery-orders': 'Pengiriman (Surat Jalan)',
  '/opname/central': 'Stock Opname Pusat',
  '/outlet/opname': 'Stock Opname Outlet',
  '/alerts': 'Peringatan Stok',
  '/price-history': 'Histori Harga',
  '/reports': 'Laporan Keuangan',
  '/master-data': 'Master Data Hub',
  '/master-data/items': 'Master Items',
  '/master-data/outlets': 'Master Outlets',
  '/master-data/vendors': 'Master Vendors',
  '/master-data/categories': 'Master Categories',
  '/settings/profile': 'Profile & Account',
  '/settings': 'System Settings',
  '/receive-goods': 'Receive Goods',
};

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

export default function TopBar({ user }: TopBarProps) {
  const pathname = usePathname();

  // Find best matching title
  let title = 'Sistem Pengadaan';
  let bestLen = 0;
  for (const [path, t] of Object.entries(PAGE_TITLES)) {
    if (pathname.startsWith(path) && path.length > bestLen) {
      title = t;
      bestLen = path.length;
    }
  }

  const roleLabel = user.role === 'ADMIN_PUSAT' ? 'Admin Pusat' : 'Admin Outlet';

  let displayName = user.name || '';
  if (user.role !== 'ADMIN_PUSAT') {
    displayName = displayName.replace(/^Admin\s+/i, '');
    displayName = displayName.replace(/ER Coffe[e]?lab\s+/i, 'ER ');
    displayName = displayName.replace(/ER Coffe[e]?\s+/i, 'ER ');
  }

  return (
    <header className="topbar no-print">
      <div
        className="hamburger"
        onClick={() => {
          window.dispatchEvent(new Event('toggle-sidebar'));
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
      </div>

      <div>
        <h1 className="page-title">{title}</h1>
        <p className="page-sub">{roleLabel} • Sunrise Daily</p>
      </div>

      <Link href="/settings/profile" className="topbar-right" style={{ textDecoration: 'none', color: 'inherit' }}>
        <div className="avatar">{getInitials(displayName)}</div>
        <div className="who">
          <span className="name">{displayName}</span>
          <span className="role">{roleLabel}</span>
        </div>
      </Link>
    </header>
  );
}
