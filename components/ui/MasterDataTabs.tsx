'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export function MasterDataTabs({ activeTab }: { activeTab: 'items' | 'categories' | 'outlets' | 'vendors' | 'venues' }) {
  return (
    <div className="tabs" style={{ marginBottom: 0 }}>
      <Link href="/master-data/items" className={`tab ${activeTab === 'items' ? 'active' : ''}`} style={{ textDecoration: 'none', color: activeTab === 'items' ? undefined : 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
        Barang
      </Link>
      <Link href="/master-data/categories" className={`tab ${activeTab === 'categories' ? 'active' : ''}`} style={{ textDecoration: 'none', color: activeTab === 'categories' ? undefined : 'inherit' }}>Kategori</Link>
      <Link href="/master-data/outlets" className={`tab ${activeTab === 'outlets' ? 'active' : ''}`} style={{ textDecoration: 'none', color: activeTab === 'outlets' ? undefined : 'inherit' }}>Outlet</Link>
      <Link href="/master-data/vendors" className={`tab ${activeTab === 'vendors' ? 'active' : ''}`} style={{ textDecoration: 'none', color: activeTab === 'vendors' ? undefined : 'inherit' }}>Supplier</Link>
      <Link href="/master-data/venues" className={`tab ${activeTab === 'venues' ? 'active' : ''}`} style={{ textDecoration: 'none', color: activeTab === 'venues' ? undefined : 'inherit' }}>Lingkungan</Link>
    </div>
  );
}
