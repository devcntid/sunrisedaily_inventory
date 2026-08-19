'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LayoutGrid, AlertOctagon } from 'lucide-react';

interface NavItem {
  href?: string;
  label?: string;
  icon?: React.ReactNode;
  badge?: number;
  section?: string;
  children?: NavItem[];
}

interface SidebarProps {
  role: 'ADMIN_PUSAT' | 'ADMIN_OUTLET';
  alertCount?: number;
}

const ICONS: Record<string, React.ReactNode> = {
  dashboard: <path d="M3 13h8V3H3v10zM13 21h8V11h-8v10zM13 3v6h8V3h-8zM3 21h8v-6H3v6z" />,
  form: <path d="M9 12h6M9 16h6M9 8h6M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />,
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  box: <><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /><path d="M3.27 6.96L12 12l8.73-5.04M12 22.08V12" /></>,
  cart: <><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" /></>,
  truck: <><path d="M1 3h15v13H1z" /><path d="M16 8h4l3 3v5h-7V8z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></>,
  clipboard: <><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="M9 12l2 2 4-4" /></>,
  bell: <><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></>,
  db: <><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14a9 3 0 0018 0V5" /><path d="M3 12a9 3 0 0018 0" /></>,
  trend: <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></>,
  report: <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="15" x2="15" y2="15" /><line x1="9" y1="11" x2="15" y2="11" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></>,
  package: <><path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /><path d="M3.27 6.96L12 12l8.73-5.04M12 22.08V12" /></>,
  user: <><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  hpp: <><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></>
};

function Icon({ name, ...props }: { name: string } & React.SVGProps<SVGSVGElement>) {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>{ICONS[name]}</svg>;
}

const CENTRAL_MENU: NavItem[] = [
  { section: 'RINGKASAN UTAMA' },
  { href: '/dashboard', label: 'Dashboard', icon: <Icon name="dashboard" /> },
  { href: '/alerts', label: 'Peringatan Stok', icon: <Icon name="bell" />, badge: 0 },

  { section: 'INVENTORI & BARANG' },
  { href: '/master-data/items', label: 'Master Data', icon: <Icon name="db" /> },
  { href: '/hpp', label: 'Master Menu & HPP', icon: <Icon name="hpp" /> },
  { href: '/stock-card', label: 'Stok Pusat', icon: <Icon name="clipboard" /> },
  { href: '/stock-monitoring', label: 'Monitoring Stok Terpadu', icon: <LayoutGrid size={15} /> },
  { href: '/opname/central', label: 'Stock Opname', icon: <Icon name="package" /> },

  { section: 'DISTRIBUSI KE OUTLET' },
  { href: '/requests', label: 'Permintaan Outlet', icon: <Icon name="list" /> },
  { href: '/delivery-orders', label: 'Pengiriman (Surat Jalan)', icon: <Icon name="truck" /> },
  { href: '/outlet-purchases', label: 'Belanja Outlet', icon: <Icon name="list" /> },
  { href: '/returns', label: 'Tiket Masalah', icon: <AlertOctagon size={15} /> },

  { section: 'PEMBELIAN' },
  { href: '/purchase-orders', label: 'Pembelian (PO)', icon: <Icon name="cart" /> },
  { href: '/direct-purchases', label: 'Belanja Pasar', icon: <Icon name="cart" /> },
  { href: '/warehouse', label: 'Penerimaan Barang', icon: <Icon name="box" /> },

  { section: 'INTEGRASI MOKA POS' },
  { href: '/master-data/moka-catalog', label: 'Katalog Moka', icon: <Icon name="package" /> },
  { href: '/sales-report', label: 'Ringkasan Penjualan', icon: <Icon name="trend" /> },
  { href: '/sales-report/transactions', label: 'Data Transaksi', icon: <Icon name="list" /> },
  { href: '/sales-report/customers', label: 'Data Pelanggan', icon: <Icon name="user" /> },
  { href: '/settings/moka', label: 'Pengaturan Moka', icon: <Icon name="settings" /> },

  { section: 'LAPORAN & PENGATURAN' },
  { href: '/reports', label: 'Laporan Sistem', icon: <Icon name="report" /> },
  { href: '/settings', label: 'Pengaturan Sistem', icon: <Icon name="settings" /> },
];

const OUTLET_MENU: NavItem[] = [
  { section: 'RINGKASAN UTAMA' },
  { href: '/dashboard', label: 'Dashboard', icon: <Icon name="dashboard" /> },

  { section: 'PENGADAAN BARANG' },
  { href: '/outlet/requests', label: 'Order ke Pusat', icon: <Icon name="cart" /> },
  { href: '/outlet/receive-goods', label: 'Penerimaan Barang', icon: <Icon name="truck" /> },
  { href: '/outlet/local-purchases', label: 'Belanja Outlet', icon: <Icon name="box" /> },

  { section: 'MANAJEMEN STOK & PENJUALAN' },
  { href: '/outlet/inventory/stock', label: 'Stok Outlet (Live)', icon: <Icon name="db" /> },
  { href: '/outlet/sales', label: 'Analitik Penjualan', icon: <Icon name="trend" /> },
  { href: '/outlet/opname', label: 'Stock Opname', icon: <Icon name="clipboard" /> },

  { section: 'KATALOG' },
  { href: '/outlet/menus', label: 'Menu & HPP', icon: <Icon name="hpp" /> },
];

export default function Sidebar({ role, alertCount = 0 }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [liveAlertCount, setLiveAlertCount] = useState(alertCount ?? 0);
  const [liveRequestCount, setLiveRequestCount] = useState(0);
  const [liveReturnsCount, setLiveReturnsCount] = useState(0);
  const [liveLocalPurchaseCount, setLiveLocalPurchaseCount] = useState(0);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menu = role === 'ADMIN_PUSAT' ? CENTRAL_MENU : OUTLET_MENU;

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Listen for hamburger toggle from TopBar
  useEffect(() => {
    const handleToggle = () => {
      // Safely assume if they clicked the hamburger, they are on mobile layout
      // because the hamburger is only visible <= 960px
      setMobileOpen(prev => !prev);
    };
    window.addEventListener('toggle-sidebar', handleToggle);
    return () => window.removeEventListener('toggle-sidebar', handleToggle);
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  useEffect(() => {
    if (pathname === '/returns' && role === 'ADMIN_PUSAT') {
      // Reset badge segera saat halaman /returns dikunjungi
      setLiveReturnsCount(0);
    }
    if (pathname === '/outlet-purchases' && role === 'ADMIN_PUSAT') {
      setLiveLocalPurchaseCount(0);
    }
    if (pathname === '/outlet/receive-goods' && role === 'ADMIN_OUTLET') {
      localStorage.setItem('lastSeenReceiveGoods', Date.now().toString());
      setLiveRequestCount(0);
    }
  }, [pathname, role]);

  useEffect(() => {
    const fetchBadges = async () => {
      try {
        if (role === 'ADMIN_PUSAT') {
          const [alertsRes, reqRes] = await Promise.all([
            fetch('/api/alerts/count', { cache: 'no-store' }),
            fetch('/api/orders/pending-count', { cache: 'no-store' })
          ]);
          if (alertsRes.ok) {
            const data = await alertsRes.json();
            setLiveAlertCount(data.count ?? 0);
          }
          if (reqRes.ok) {
            const data = await reqRes.json();
            setLiveRequestCount(data.count ?? 0);
          }
          // Jangan update badge saat sedang di halaman /returns (sudah di-reset di atas)
          // (Returns and Local Purchases are handled by the 10s fast poll below)
        } else if (role === 'ADMIN_OUTLET') {
          const lastSeenReceiveGoods = localStorage.getItem('lastSeenReceiveGoods') || '';
          const receiveUrl = lastSeenReceiveGoods ? `/api/delivery-notes/shipped-count?since=${lastSeenReceiveGoods}` : '/api/delivery-notes/shipped-count';
          const [reqRes, alertsRes] = await Promise.all([
            fetch(receiveUrl, { cache: 'no-store' }),
            fetch('/api/outlet/alerts/count', { cache: 'no-store' })
          ]);
          if (reqRes.ok) {
            const data = await reqRes.json();
            setLiveRequestCount(data.count ?? 0);
          }
          if (alertsRes.ok) {
            const data = await alertsRes.json();
            setLiveAlertCount(data.count ?? 0);
          }
        }
      } catch (e) {
        // ignore
      }
    };

    fetchBadges();
    // Poll semua badge setiap 30 detik
    const interval = setInterval(fetchBadges, 30000);

    // Re-fetch segera saat tab kembali aktif
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchBadges();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [role]);

  // Polling khusus returns badge setiap 10 detik (real-time) — terpisah dari poll umum
  useEffect(() => {
    if (role !== 'ADMIN_PUSAT') return;

    const fetchFastBadges = async () => {
      try {
        const promises = [];
        if (pathname !== '/returns') promises.push(fetch('/api/returns/pending-count', { cache: 'no-store' }));
        else promises.push(Promise.resolve(null));
        
        if (pathname !== '/outlet-purchases') promises.push(fetch('/api/outlets/local-purchases/unread', { cache: 'no-store' }));
        else promises.push(Promise.resolve(null));

        const [returnsRes, lpRes] = await Promise.all(promises);

        if (returnsRes && returnsRes.ok) {
          const data = await returnsRes.json();
          setLiveReturnsCount(data.count ?? 0);
        }
        if (lpRes && lpRes.ok) {
          const data = await lpRes.json();
          setLiveLocalPurchaseCount(data.count ?? 0);
        }
      } catch { /* abaikan */ }
    };

    const interval = setInterval(fetchFastBadges, 10000);
    // Jalankan sekali saat pertama mount
    fetchFastBadges();
    return () => clearInterval(interval);
  }, [role, pathname]);

  const getEffectiveBadge = (href: string, actualCount: number) => {
    // Hide badge if currently on this page or any sub-page
    if (pathname === href || pathname.startsWith(href + '/')) return 0;
    return actualCount;
  };

  const menuWithBadge = menu.map(item => {
    if (item.href === '/alerts' && role === 'ADMIN_PUSAT') return { ...item, badge: getEffectiveBadge(item.href, liveAlertCount) };
    if (item.href === '/requests' && role === 'ADMIN_PUSAT') return { ...item, badge: getEffectiveBadge(item.href, liveRequestCount) };
    if (item.href === '/returns' && role === 'ADMIN_PUSAT') return { ...item, badge: getEffectiveBadge(item.href, liveReturnsCount) };
    if (item.href === '/outlet-purchases' && role === 'ADMIN_PUSAT') return { ...item, badge: getEffectiveBadge(item.href, liveLocalPurchaseCount) };
    if (item.href === '/outlet/inventory/stock' && role === 'ADMIN_OUTLET') return { ...item, badge: getEffectiveBadge(item.href, liveAlertCount) };
    if (item.href === '/outlet/receive-goods' && role === 'ADMIN_OUTLET') return { ...item, badge: getEffectiveBadge(item.href, liveRequestCount) };
    return item;
  });

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setMobileOpen(false)}
          style={{ display: 'block', position: 'fixed', inset: 0, background: 'rgba(10,18,14,0.45)', zIndex: 15 }}
        />
      )}

      <aside
        className={`sidebar no-print ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}
        style={mobileOpen ? { transform: 'translateX(0)', position: 'fixed', left: 0, top: 0, bottom: 0, width: '220px', zIndex: 100 } : undefined}
      >
        <div className="sidebar-top">
          <div className="brand-wrapper">
            <Image src="/logo-putih.png" alt="Logo" width={50} height={50} className="sunburst" />
            <div className="brand-text">
              <span className="brand-name">Sunrise Daily</span>
              <span className="brand-sub">Sistem Pengadaan & Inventori</span>
            </div>
          </div>
          <button
            className="collapse-btn-top"
            onClick={() => setCollapsed(!collapsed)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </div>

        <nav className="nav-scroll">
          {menuWithBadge.map((item, i) => {
            if ('section' in item && !item.href) {
              return <div key={i} className="nav-section-title">{item.section}</div>;
            }
            let isActive = item.href === '/dashboard' ? pathname === item.href : pathname.startsWith(item.href!);

            // Fix overlapping active states for Moka POS Integration
            if (item.href === '/sales-report') {
              isActive = pathname === '/sales-report';
            }
            if (item.href === '/settings') {
              isActive = pathname.startsWith('/settings') && !pathname.startsWith('/settings/moka');
            }

            if (item.href === '/purchase-orders' && pathname.startsWith('/goods-receipt')) isActive = true;
            if (item.href === '/reports') {
              isActive = pathname === '/reports' || pathname.startsWith('/reports/profit-projection') || pathname.startsWith('/price-history') || pathname.startsWith('/reports/inventory-value');
            }

            if (item.href === '/master-data/items' && (pathname.startsWith('/master-data/items') || pathname.startsWith('/master-data/outlets') || pathname.startsWith('/master-data/vendors') || pathname.startsWith('/master-data/categories'))) isActive = true;
            if (item.href === '/hpp' && pathname.startsWith('/hpp')) isActive = true;
            if (item.href === '/outlet/sales') {
              isActive = pathname === '/outlet/sales';
            }

            return (
              <Link
                key={item.href}
                href={item.href!}
                className={`nav-item ${isActive ? 'active' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                {item.icon}
                <span className="nav-item-text">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="nav-badge">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <button
            onClick={() => setConfirmLogout(true)}
            disabled={loggingOut}
            className="logout-btn"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
            <span className="label">{loggingOut ? 'Keluar...' : 'Keluar'}</span>
          </button>
        </div>
      </aside>

      <ConfirmDialog
        open={confirmLogout}
        title="Keluar?"
        message="Anda harus masuk kembali untuk mengakses sistem."
        confirmText="Ya, Keluar"
        onCancel={() => !loggingOut && setConfirmLogout(false)}
        onConfirm={() => handleLogout()}
        loading={loggingOut}
      />
    </>
  );
}
