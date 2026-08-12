'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { OrderStatusBadge } from '@/components/shared/OrderStatusBadge';

interface Order {
  id: number; order_date: string; delivery_date: string;
  status: string; item_count: number; created_by_name: string;
}
interface OrderItem {
  id: number; order_id: number; item_name: string; category_name: string;
  purchase_unit: string; smallest_unit: string; qty_request: number; smallest_unit_qty: number;
  qty_approved?: number; center_notes?: string;
  fulfillment_status: string; item_status: string;
}

const ITEM_STATUS_LABELS: Record<string, string> = {
  DITERIMA_DARI_OUTLET: 'Diterima dari Outlet', PROSES_BELANJA: 'Proses Belanja',
  READY_DI_GUDANG: 'Siap di Gudang', DIKIRIM: 'Dikirim', SELESAI: 'Selesai',
  DIKEMAS: 'Dikemas', PENDING: 'Pending', PROCESSING: 'Diproses'
};

export default function OutletRequestsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<{ order: Order; items: OrderItem[] } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/orders`);
    const data = await res.json();
    setOrders(data.data ?? []);
    setLoading(false);
    setCurrentPage(1);
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  async function handleViewOrder(order: Order) {
    setSelectedOrder({ order, items: [] });
    // Fetch items for this order
    const iRes = await fetch(`/api/orders/recap?order_id=${order.id}`);
    if (iRes.ok) {
      const iData = await iRes.json();
      setSelectedOrder({ order, items: iData.data ?? [] });
    }
  }

  return (
    <section className="screen">
      <div className="card">
        <div className="card-head">
          <div>
            <h3>Permintaan Pembelian Outlet</h3>
          </div>
        </div>
        <div style={{ background: '#f0fdf4', borderBottom: '1px solid #bbf7d0', padding: '16px 20px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <Link href="/outlet/requests/create" style={{ textDecoration: 'none' }}>
            <Button variant="primary" size="sm">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Buat Permintaan
            </Button>
          </Link>
        </div>

        <div className="card-body flush">
          {loading ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Memuat data...</div>
          ) : orders.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" /></svg>
              <h4>Belum ada permintaan</h4>
              <p>Anda belum membuat permintaan barang apapun.</p>
            </div>
          ) : (
            <>
              <Table>
                <thead>
                  <tr>
                    <th>No. PO</th><th>Dibuat Oleh</th>
                    <th>Tanggal Order</th><th>Estimasi Kirim</th>
                    <th className="center">Total Barang</th><th className="center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map(o => (
                    <tr key={o.id} onClick={() => handleViewOrder(o)} style={{ cursor: 'pointer' }} className="hover-row">
                      <td className="font-mono text-primary font-bold">PO-{new Date(o.order_date).getFullYear()}-{String(o.id).padStart(5, '0')}</td>
                      <td className="muted">{o.created_by_name?.replace('Coffeelab ', '')}</td>
                      <td>{new Date(o.order_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                      <td>{new Date(o.delivery_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                      <td className="center num font-bold">{o.item_count}</td>
                      <td className="center"><OrderStatusBadge status={o.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              {orders.length > ITEMS_PER_PAGE && (
                <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)' }}>
                  <div className="muted" style={{ fontSize: 13 }}>
                    Menampilkan {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, orders.length)} dari {orders.length}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Button size="sm" variant="outline" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Seb</Button>
                    <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px', fontSize: 13, fontWeight: 600 }}>
                      Halaman {currentPage} dari {Math.ceil(orders.length / ITEMS_PER_PAGE)}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setCurrentPage(p => Math.min(Math.ceil(orders.length / ITEMS_PER_PAGE), p + 1))} disabled={currentPage === Math.ceil(orders.length / ITEMS_PER_PAGE)}>Lanjut</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Modal isOpen={!!selectedOrder} onClose={() => setSelectedOrder(null)} title={`Detail Permintaan PO-${selectedOrder ? new Date(selectedOrder.order.order_date).getFullYear() + '-' + String(selectedOrder.order.id).padStart(5, '0') : ''}`} maxWidth={900}>
        <div className="modal-body" style={{ padding: '16px 20px' }}>
          <p className="muted" style={{ marginBottom: 20 }}>Dibuat pada {selectedOrder ? new Date(selectedOrder.order.order_date).toLocaleDateString('id-ID') : ''}</p>

          <div style={{ border: '1px solid var(--border)', borderRadius: 8 }}>
            {selectedOrder?.items?.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>
                Data barang kosong atau tidak ditemukan.
              </div>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>Barang</th><th>Kategori</th>
                    <th className="right">Jml Diminta</th>
                    <th className="right">Jml Disetujui</th>
                    <th>Catatan Pusat</th>
                    <th className="center">Pemenuhan</th><th className="center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder?.items?.map(item => (
                    <tr key={item.id}>
                      <td className="font-bold">{item.item_name}</td>
                      <td className="muted" style={{ textTransform: 'capitalize' }}>{item.category_name?.toLowerCase()}</td>
                      <td className="right">
                        <div className="font-bold num">{parseFloat(Number(item.qty_request).toFixed(3)).toLocaleString('id-ID')} {item.purchase_unit}</div>
                      </td>
                      <td className="right">
                        <div className="font-bold num text-primary">{parseFloat(Number(item.qty_approved ?? item.qty_request).toFixed(3)).toLocaleString('id-ID')} {item.purchase_unit}</div>
                      </td>
                      <td>
                        {item.center_notes ? (
                          <div style={{ fontSize: 12, color: 'var(--danger)', fontStyle: 'italic' }}>{item.center_notes}</div>
                        ) : (
                          <span className="muted italic" style={{ fontSize: 12 }}>-</span>
                        )}
                      </td>
                      <td className="center">
                        <Badge variant={item.fulfillment_status === 'SANGGUP' ? 'green' : item.fulfillment_status === 'TIDAK' ? 'red' : 'amber'}>
                          {item.fulfillment_status === 'SANGGUP' ? 'Sanggup' : item.fulfillment_status === 'TIDAK' ? 'Tidak' : 'Menunggu'}
                        </Badge>
                      </td>
                      <td className="center">
                        <Badge variant="gray"><span className="capitalize">{ITEM_STATUS_LABELS[item.item_status] ?? item.item_status?.toLowerCase()}</span></Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        </div>
      </Modal>
    </section>
  );
}
