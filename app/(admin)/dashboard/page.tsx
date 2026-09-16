import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getUnresolvedAlertCount } from '@/lib/queries/alerts';
import { getInventoryValueTrend } from '@/lib/queries/inventory';
import Link from 'next/link';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { OrderStatusBadge } from '@/components/shared/OrderStatusBadge';
import TableRowLink from '@/components/shared/TableRowLink';
import { DashboardChart } from '@/components/ui/DashboardChart';
import { GrossProfitChart } from '@/components/ui/GrossProfitChart';
import { OutletTrendChart } from '@/components/ui/OutletTrendChart';
import DashboardDateFilter from '@/components/shared/DashboardDateFilter';

import { 
  getDashboardStats, 
  getRecentOrders, 
  getRecentAlerts, 
  getIncomingPOs, 
  getFastMovingItems, 
  getGrossProfitAnalytics, 
  getPendingIssues, 
  getOutletIssues, 
  getOutletLowStock, 
  getOutletOrderTrend 
} from '@/lib/queries/dashboard';

function fmt(n: number) {
  return new Intl.NumberFormat('id-ID').format(Math.round(n));
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const resolvedParams = searchParams ? await searchParams : {};
  const preset = typeof resolvedParams.preset === 'string' ? resolvedParams.preset : '7d';
  let startDate = typeof resolvedParams.startDate === 'string' ? resolvedParams.startDate : '';
  let endDate = typeof resolvedParams.endDate === 'string' ? resolvedParams.endDate : '';

  if (!startDate || !endDate) {
    const d = new Date();
    endDate = d.toISOString().split('T')[0];
    const past = new Date();
    past.setDate(d.getDate() - 6);
    startDate = past.toISOString().split('T')[0];
  }

  let periodLabel = '7 Hari Terakhir';
  if (preset === '30d') periodLabel = '30 Hari Terakhir';
  else if (preset === 'this_month') periodLabel = 'Bulan Ini';
  else if (preset === 'custom') {
    periodLabel = `${new Date(startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} - ${new Date(endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`;
  }

  const [stats, recentOrders, grossProfitData, pendingIssues, outletIssues, outletTrend] = await Promise.all([
    getDashboardStats(session.role, session.outletId, startDate, endDate),
    getRecentOrders(session.role, session.outletId, startDate, endDate),
    session.role === 'ADMIN_PUSAT' ? getGrossProfitAnalytics(startDate, endDate) : Promise.resolve([]),
    session.role === 'ADMIN_PUSAT' ? getPendingIssues() : Promise.resolve([]),
    session.role !== 'ADMIN_PUSAT' ? getOutletIssues(session.outletId) : Promise.resolve([]),
    session.role !== 'ADMIN_PUSAT' ? getOutletOrderTrend(session.outletId, startDate, endDate) : Promise.resolve([]),
  ]);

  const trendData = session.role === 'ADMIN_PUSAT' ? await getInventoryValueTrend(stats.stockValue) : [];

  const isCentral = session.role === 'ADMIN_PUSAT';

  return (
    <section className="screen">
      <DashboardDateFilter
        initialStartDate={startDate}
        initialEndDate={endDate}
        initialPreset={preset}
      />

      <div className="kpi-row">
        <div className="kpi-card">
          <div className="kpi-label">Order ({periodLabel})</div>
          <div className="kpi-value">{fmt(stats.ordersPending + stats.ordersProcessing + stats.ordersShipped + stats.ordersCompleted)}</div>
          <div className="kpi-note">dari outlet</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Perlu Konfirmasi</div>
          <div className="kpi-value">{fmt(stats.ordersPending)}</div>
          <div className="kpi-note">{stats.ordersPending > 0 ? 'menunggu' : '✓ Tidak ada'}</div>
        </div>
        {isCentral ? (
          <>
            <div className="kpi-card">
              <div className="kpi-label">Proses Pembelian</div>
              <div className="kpi-value">{fmt(stats.vendorOrdersPending)}</div>
              <div className="kpi-note">tunggu vendor / krm</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Nilai Inventaris</div>
              <div
                className="kpi-value"
                style={{ fontSize: '18px', letterSpacing: '-0.3px' }}
                title={fmtCurrency(stats.stockValue)}
              >
                {fmtCurrency(stats.stockValue)}
              </div>
              <div className="kpi-note">estimasi aset pusat</div>
            </div>
            <Link href="/alerts" style={{ textDecoration: 'none' }} className={`kpi-card ${stats.unresolvedAlerts > 0 ? 'alert' : ''}`}>
              <div className="kpi-label">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight:4}}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                Titik Pemesanan
              </div>
              <div className="kpi-value">{fmt(stats.unresolvedAlerts)}</div>
              <div className="kpi-note">brg &le; min stok</div>
            </Link>
          </>
        ) : (
          <>
            <div className="kpi-card">
              <div className="kpi-label">Proses Pengiriman</div>
              <div className="kpi-value">{fmt(stats.ordersShipped)}</div>
              <div className="kpi-note">sedang dikirim</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Total Order Selesai</div>
              <div className="kpi-value">{fmt(stats.ordersCompleted)}</div>
              <div className="kpi-note">✓ Selesai</div>
            </div>
          </>
        )}
      </div>

      {isCentral ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px', marginTop: '24px' }}>
          <div className="card" style={{ margin: 0 }}>
            <div className="card-head">
              <div>
                <h3>Margin Kasar / Outlet ({periodLabel})</h3>
              </div>
            </div>
            <div className="card-body">
              <GrossProfitChart data={grossProfitData} />
            </div>
          </div>
          <div className="card" style={{ margin: 0 }}>
            <div className="card-head">
              <div>
                <h3>Tren Nilai Inventaris</h3>
              </div>
            </div>
            <div className="card-body">
              <DashboardChart data={trendData} />
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginTop: '24px' }}>
          <div className="card-head">
            <div>
              <h3>Aktivitas Permintaan ({periodLabel})</h3>
            </div>
          </div>
          <div className="card-body">
            <OutletTrendChart data={outletTrend} />
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '24px', alignItems: 'start' }}>
        
        {/* KOLOM KIRI: Beban Kerja, Rekap Outlet, Retur */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          


          {/* 2. Rekap Status Order */}
          <div className="card" style={{ margin: 0 }}>
            <div className="card-head">
              <div>
                <h3>{isCentral ? 'Rekap Status Order per Outlet' : 'Riwayat Permintaan Saya'}</h3>
              </div>
            </div>
            <div className="card-body flush">
              {recentOrders.length === 0 ? (
                <div className="empty-state">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2"/></svg>
                  <h4>Belum ada permintaan</h4>
                  <p>Data tidak ditemukan</p>
                </div>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <th>No. Order</th>
                      {isCentral && <th>Outlet</th>}
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((order: any) => {
                      return (
                        <TableRowLink key={order.id} href={`/requests?open_id=${order.id}`} className="hover-row">
                          <td className="font-mono text-primary font-bold">RO-{String(order.id).padStart(4, '0')}</td>
                          {isCentral && <td className="font-bold">{order.outlet_name}</td>}
                          <td className="center"><OrderStatusBadge status={order.status} /></td>
                        </TableRowLink>
                      );
                    })}
                  </tbody>
                </Table>
              )}
            </div>
          </div>





        </div>

        {/* KOLOM KANAN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* 5. Status Retur Saya (OUTLET) */}
          {!isCentral && (
            <div className="card" style={{ margin: 0 }}>
              <div className="card-head">
                <div>
                  <h3>Tiket Komplain / Retur Saya</h3>
                </div>
              </div>
              <div className="card-body flush">
                {outletIssues.length === 0 ? (
                  <div className="empty-state" style={{ padding: '32px 0' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                    <h4>Bebas Komplain</h4>
                    <p>Tidak ada riwayat tiket masalah baru-baru ini.</p>
                  </div>
                ) : (
                  <Table>
                    <thead>
                      <tr>
                        <th>Surat Jalan</th>
                        <th>Keluhan</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outletIssues.map((issue: any) => (
                        <TableRowLink key={issue.id} href="/returns">
                          <td className="font-mono text-primary font-bold">{issue.dn_number}</td>
                          <td>{issue.issue_type}</td>
                          <td><span className={`badge ${issue.status === 'PENDING' ? 'badge-amber' : 'badge-green'}`}>{issue.status}</span></td>
                        </TableRowLink>
                      ))}
                    </tbody>
                  </Table>
                )}
              </div>
            </div>
          )}
        
        {isCentral && (
          <>
            <div className="card" style={{ margin: 0 }}>
              <div className="card-head">
                <div>
                  <h3>Retur / Masalah (Menunggu)</h3>
                </div>
                <Link href="/returns"><Button variant="outline" size="sm">Lihat Semua</Button></Link>
              </div>
              <div className="card-body flush">
                {pendingIssues.length === 0 ? (
                  <div className="empty-state" style={{ padding: '24px 0' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 13l4 4L19 7"/></svg>
                    <h4>Tidak ada tiket masalah</h4>
                    <p>Semua retur dan komplain sudah diselesaikan</p>
                  </div>
                ) : (
                  <Table>
                    <thead>
                      <tr>
                        <th>Surat Jalan</th>
                        <th>Outlet</th>
                        <th>Masalah</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingIssues.map((issue: any) => (
                        <TableRowLink key={issue.id} href={`/delivery-orders/${issue.dn_number}`}>
                          <td><span className="font-mono text-primary font-bold">{issue.dn_number}</span></td>
                          <td>{issue.outlet_name}</td>
                          <td>
                            <span className={`badge ${issue.issue_type === 'BROKEN' ? 'badge-danger' : issue.issue_type === 'MISSING' ? 'badge-warning' : 'badge-default'}`}>
                              {issue.issue_type === 'BROKEN' ? 'Barang Rusak' : issue.issue_type === 'MISSING' ? 'Kurang/Hilang' : issue.issue_type}
                            </span>
                          </td>
                        </TableRowLink>
                      ))}
                    </tbody>
                  </Table>
                )}
              </div>
            </div>
          </>
        )}
        </div>
      </div>
    </section>
  );
}
