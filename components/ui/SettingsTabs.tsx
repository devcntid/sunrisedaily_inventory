'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function SettingsTabs() {
  const pathname = usePathname();

  return (
    <div className="tabs" style={{ marginBottom: 24 }}>
      <Link 
        href="/settings" 
        className={`tab ${pathname === '/settings' ? 'active' : ''}`} 
        style={{ textDecoration: 'none', color: pathname === '/settings' ? undefined : 'inherit' }}
      >
        Profil Perusahaan
      </Link>


      <Link 
        href="/settings/users" 
        className={`tab ${pathname.startsWith('/settings/users') ? 'active' : ''}`} 
        style={{ textDecoration: 'none', color: pathname.startsWith('/settings/users') ? undefined : 'inherit' }}
      >
        Manajemen Pengguna
      </Link>

      <Link 
        href="/settings/opening-balance" 
        className={`tab ${pathname.startsWith('/settings/opening-balance') ? 'active' : ''}`} 
        style={{ textDecoration: 'none', color: pathname.startsWith('/settings/opening-balance') ? undefined : 'inherit' }}
      >
        Migrasi Database
      </Link>
    </div>
  );
}
