'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { OrderStatusBadge } from '@/components/shared/OrderStatusBadge';

interface Order {
  id: number; order_date: string; delivery_date: string;
  status: string; item_count: number; created_by_name: string;
}

export default function OutletDashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [criticalMenus, setCriticalMenus] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    // API reads outletId from session server-side, no need to pass it from client
    const [ordersRes, estimationRes] = await Promise.all([
      fetch(`/api/orders?limit=5`),
      fetch(`/api/sales-transactions/estimation`)
    ]);

    if (ordersRes.ok) {
      const data = await ordersRes.json();
      setOrders(data.data ?? []);
    }
    
    if (estimationRes.ok) {
      const data = await estimationRes.json();
      // Take top 5 with the lowest estimated portions
      if (data.success && data.data) {
        setCriticalMenus(data.data.slice(0, 5));
      }
    }

    setLoading(false);
  }, []);

  useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);

  const activeRequests = orders.filter(o => ['PENDING', 'PROCESSING'].includes(o.status)).length;
  const awaitingDelivery = orders.filter(o => o.status === 'SHIPPED').length;

  return (
    <section className="screen">
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 8px 0', fontFamily: 'var(--font-cabin)' }}>Dashboard Outlet</h2>
        <p className="muted" style={{ margin: 0 }}>Ringkasan permintaan terbaru Anda dan aktivitas mendatang.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20, marginBottom: 24 }}>
        <div className="card" style={{ padding: 24, borderLeft: '4px solid var(--primary)' }}>
          <h4 className="muted" style={{ margin: '0 0 12px 0', fontSize: 14 }}>Permintaan Aktif</h4>
          <div style={{ fontSize: 32, fontWeight: 700, fontFamily: 'var(--font-cabin)' }}>{activeRequests}</div>
          <div style={{ marginTop: 12 }}>
            <Link href="/outlet/requests" style={{ fontSize: 13, fontWeight: 600 }}>Lihat semua permintaan &rarr;</Link>
          </div>
        </div>
        <div className="card" style={{ padding: 24, borderLeft: '4px solid #f59e0b' }}>
          <h4 className="muted" style={{ margin: '0 0 12px 0', fontSize: 14 }}>Menunggu Pengiriman</h4>
          <div style={{ fontSize: 32, fontWeight: 700, fontFamily: 'var(--font-cabin)' }}>{awaitingDelivery}</div>
          <div style={{ marginTop: 12 }}>
            <Link href="/outlet/receive-goods" style={{ fontSize: 13, fontWeight: 600 }}>Penerimaan Barang &rarr;</Link>
          </div>
        </div>
        <div className="card" style={{ padding: 24, borderLeft: '4px solid #3b82f6' }}>
          <h4 className="muted" style={{ margin: '0 0 12px 0', fontSize: 14 }}>Stock Opname Berikutnya</h4>
          <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-cabin)' }}>Akhir Bulan</div>
          <div style={{ marginTop: 12 }}>
            <Link href="/outlet/opname" style={{ fontSize: 13, fontWeight: 600 }}>Mulai Opname &rarr;</Link>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        <div className="card h-full flex flex-col">
          <div className="card-head">
            <div>
              <h3>Top 5 Menu Kritis</h3>
            </div>
            <Link href="/outlet/menus">
              <Button variant="outline" size="sm">Lihat Semua</Button>
            </Link>
          </div>
          <div className="card-body flush flex-1">
            {loading ? (
              <div className="muted p-8 text-center">Memuat menu kritis...</div>
            ) : criticalMenus.length === 0 ? (
              <div className="muted p-8 text-center">Menu tidak ditemukan.</div>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>Nama Menu</th>
                    <th className="center">Maks Porsi</th>
                  </tr>
                </thead>
                <tbody>
                  {criticalMenus.map((m: any) => {
                    const portions = Math.max(0, m.estimated_portions || 0);
                    return (
                      <tr key={m.moka_item_id}>
                        <td className="font-semibold text-gray-800">{m.name}</td>
                        <td className="center">
                          <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold ${
                            portions <= 10 ? 'bg-red-100 text-red-700' : 
                            portions <= 50 ? 'bg-amber-100 text-amber-700' : 
                            'bg-green-100 text-green-700'
                          }`}>
                            {portions} Cup
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </div>
        </div>

        <div className="card h-full flex flex-col">
          <div className="card-head">
            <div>
              <h3>Permintaan Terbaru</h3>
            </div>
            <Link href="/outlet/requests/create">
              <Button variant="primary" size="sm">+ Buat Permintaan</Button>
            </Link>
          </div>
        <div className="card-body flush">
          {loading ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Memuat data dashboard...</div>
          ) : orders.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" /></svg>
              <h4>Tidak ada permintaan terbaru</h4>
              <p>Anda belum membuat permintaan apapun baru-baru ini.</p>
            </div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>No. PO</th>
                  <th>Tanggal Order</th>
                  <th>Estimasi Dikirim</th>
                  <th className="center">Total Barang</th>
                  <th className="center">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id}>
                    <td className="font-mono text-primary font-bold">PO-{new Date(o.order_date).getFullYear()}-{String(o.id).padStart(5, '0')}</td>
                    <td>{new Date(o.order_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td>{new Date(o.delivery_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td className="center num font-bold">{o.item_count}</td>
                    <td className="center"><OrderStatusBadge status={o.status} /></td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </div>
      </div>
    </section>
  );
}
