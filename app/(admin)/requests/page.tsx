'use client';
import React, { useState, useEffect, useCallback, Suspense, Fragment } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Toast } from '@/components/ui/Toast';
import { OrderStatusBadge } from '@/components/shared/OrderStatusBadge';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FileText } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface ShoppingListItemState {
  checked: boolean;
  qty_adjust: string;
  notes: string;
}

interface Order {
  id: number; outlet_name: string; order_date: string; delivery_date: string;
  status: string; item_count: number; created_by_name: string;
}
interface OrderItem {
  id: number; order_id: number; item_name: string; category_name: string;
  purchase_unit: string; smallest_unit: string; qty_request: number; smallest_unit_qty: number;
  qty_approved?: number; approved_smallest_qty?: number;
  fulfillment_status: string; item_status: string; distribution_price?: number;
  additional_notes?: string; center_notes?: string; current_average_price?: number; current_stock?: number;
  conversion_ratio?: number;
}

interface AggregatedProduct {
  item_id: number;
  item_name: string;
  unit: string;
  smallest_unit?: string;
  conversion_ratio?: string;
  total_requested: string;
  central_stock: string;
  breakdown?: Array<{
    outlet_name: string;
    qty: number;
    order_id: number;
    order_date: string;
  }>;
}

const ITEM_STATUS_LABELS: Record<string, string> = {
  DITERIMA_DARI_OUTLET: 'Diterima dari Outlet', PROSES_BELANJA: 'Proses Belanja',
  READY_DI_GUDANG: 'Siap di Gudang', DIKIRIM: 'Dikirim', SELESAI: 'Selesai',
};

function formatDate(dateString: string) {
  if (!dateString) return '';
  const d = new Date(dateString);
  const day = String(d.getDate()).padStart(2, '0');
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = monthNames[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

const getFulfillmentStyle = (val: string) => {
  if (val === 'SANGGUP') return { backgroundColor: '#dcfce7', color: '#166534', borderColor: '#bbf7d0', fontWeight: 'bold' };
  if (val === 'TIDAK') return { backgroundColor: '#fee2e2', color: '#991b1b', borderColor: '#fecaca', fontWeight: 'bold' };
  return { backgroundColor: '#f1f5f9', color: '#475569', borderColor: '#e2e8f0', fontWeight: 'bold' };
};

const getStatusStyle = (val: string) => {
  if (val === 'READY_DI_GUDANG') return { backgroundColor: '#dcfce7', color: '#166534', borderColor: '#bbf7d0', fontWeight: 'bold' };
  if (val === 'PROSES_BELANJA') return { backgroundColor: '#fef3c7', color: '#92400e', borderColor: '#fde68a', fontWeight: 'bold' };
  if (val === 'SELESAI') return { backgroundColor: '#dbeafe', color: '#1e40af', borderColor: '#bfdbfe', fontWeight: 'bold' };
  return { backgroundColor: '#f1f5f9', color: '#475569', borderColor: '#e2e8f0', fontWeight: 'bold' };
};

function RequestsContent() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<{ order: Order; items: OrderItem[] } | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [saving, setSaving] = useState<number | null>(null);
  const [toast, setToast] = useState({ open: false, message: '', type: 'info' as 'success' | 'error' | 'info' });
  const [viewMode, setViewMode] = useState<'by-outlet' | 'by-product' | 'history'>('by-outlet');
  const [histories, setHistories] = useState<any[]>([]);
  const [aggregatedProducts, setAggregatedProducts] = useState<AggregatedProduct[]>([]);
  const [aggCurrentPage, setAggCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAggProduct, setSelectedAggProduct] = useState<AggregatedProduct | null>(null);
  const [shoppingListState, setShoppingListState] = useState<Record<number, ShoppingListItemState>>({});
  const [showPrintConfirm, setShowPrintConfirm] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  const ITEMS_PER_PAGE = 25;
  const AGG_ITEMS_PER_PAGE = 20;

  const searchParams = useSearchParams();
  const openId = searchParams.get('open_id');

  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);

    const res = await fetch(`/api/orders?${params}`);
    const data = await res.json();
    setOrders(data.data ?? []);
    if (!silent) setLoading(false);
    if (!silent) setCurrentPage(1);
  }, [statusFilter, startDate, endDate]);

  const fetchAggregated = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);

    const res = await fetch(`/api/orders/aggregated?${params}`);
    const data = await res.json();
    if (data.success) {
      setAggregatedProducts(data.data);
    }
    const histRes = await fetch('/api/shopping-list-histories');
    const histData = await histRes.json();
    if (histData.success) {
      setHistories(histData.data);
    }
    if (!silent) setLoading(false);
    if (!silent) setAggCurrentPage(1);
  }, [statusFilter, startDate, endDate]);

  useEffect(() => {
    if (viewMode === 'by-outlet') {
      fetchOrders();
    } else {
      fetchAggregated();
    }

    // Auto-refresh interval (silent)
    const interval = setInterval(() => {
      if (viewMode === 'by-outlet') fetchOrders(true);
      else fetchAggregated(true);
    }, 15000);

    return () => clearInterval(interval);
  }, [viewMode, fetchOrders, fetchAggregated]);

  const handleViewOrder = useCallback(async (order: Order) => {
    setSelectedOrder({ order, items: [] });
    // Load items
    const iRes = await fetch(`/api/orders/recap?order_id=${order.id}`);
    if (iRes.ok) {
      const iData = await iRes.json();
      setSelectedOrder({ order, items: iData.data ?? [] });
    }
  }, []);

  useEffect(() => {
    if (!loading && openId && orders.length > 0 && viewMode === 'by-outlet') {
      const orderToOpen = orders.find(o => String(o.id) === openId);
      if (orderToOpen) {
        handleViewOrder(orderToOpen);
        // Hapus parameter open_id dari URL agar tidak terus-menerus memicu modal terbuka
        const url = new URL(window.location.href);
        url.searchParams.delete('open_id');
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, [loading, openId, orders, handleViewOrder, viewMode]);

  async function handleUpdateItem(orderItemId: number, updates: Record<string, unknown>) {
    setSaving(orderItemId);
    try {
      await fetch(`/api/orders/${orderItemId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      fetchOrders();
      if (selectedOrder) {
        setSelectedOrder(prev => prev ? {
          ...prev,
          items: prev.items.map(i => i.id === orderItemId ? { ...i, ...updates } : i)
        } : null);
      }
    } catch (e) {
      console.error(e);
      setToast({ open: true, message: 'Gagal menolak item', type: 'error' });
    } finally {
      setSaving(null);
    }
  }

  function generatePDFFromTableData(tableData: any[], dateStr: string) {
    const doc = new jsPDF('portrait');

    doc.setFontSize(14);
    doc.text('Daftar Belanja Kebutuhan Outlet', 14, 16);
    doc.setFontSize(9);
    doc.text(`Tanggal Cetak: ${dateStr}`, 14, 22);

    autoTable(doc, {
      startY: 28,
      head: [['Nama Barang', 'Jumlah', 'Catatan', 'Harga Beli', 'Toko']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [1, 110, 63], halign: 'center' }, // Sunrise Daily green
      columnStyles: {
        0: { cellWidth: 50 },
        1: { halign: 'center', cellWidth: 30 },
        2: { cellWidth: 40 },
        3: { cellWidth: 30 },
        4: { cellWidth: 35 }
      },
      styles: { fontSize: 9, cellPadding: 3, minCellHeight: 10, valign: 'middle' },
    });

    return doc;
  }

  function generateShoppingListPDF() {
    const tableData: any[] = [];
    aggregatedProducts.forEach(p => {
      const state = shoppingListState[p.item_id] || {};
      if (!state.checked) return;

      const neededPurchase = Number(p.total_requested) || 0;
      const finalQty = state.qty_adjust !== undefined && state.qty_adjust !== '' ? state.qty_adjust : neededPurchase.toLocaleString('id-ID', { maximumFractionDigits: 2 });

      tableData.push([
        p.item_name,
        `${finalQty} ${p.unit}`,
        state.notes || '',
        '', // Harga Asli (empty for manual input)
        '' // Nama Toko / Vendor (empty for manual input)
      ]);
    });

    if (tableData.length === 0) {
      setToast({ open: true, message: 'Tidak ada produk yang dipilih / tersedia.', type: 'info' });
      return null;
    }

    const dateStr = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    const doc = generatePDFFromTableData(tableData, dateStr);
    doc.save('daftar-belanja-pusat.pdf');
    return true;
  }

  const handleSaveHistoryAndClear = async () => {
    const localStorageItems: any[] = [];

    const tableData: any[] = [];
    aggregatedProducts.forEach(p => {
      const state = shoppingListState[p.item_id] || {};
      if (!state.checked) return;
      const neededPurchase = Number(p.total_requested) || 0;
      
      // finalQty is used strictly for display in the PDF (formatted as ID locale if auto-calculated)
      const finalQty = state.qty_adjust !== undefined && state.qty_adjust !== '' ? state.qty_adjust : neededPurchase.toLocaleString('id-ID', { maximumFractionDigits: 2 });
      
      // rawQty is the absolute raw number safely passed to the next page
      const rawQty = state.qty_adjust !== undefined && state.qty_adjust !== '' 
        ? Number(String(state.qty_adjust).replace(',', '.')) 
        : neededPurchase;

      tableData.push([
        p.item_name,
        `${finalQty} ${p.unit}`,
        state.notes || '',
        '', 
        '' 
      ]);

      // Save to array for passing to direct-purchases/create
      localStorageItems.push({
        item_id: p.item_id,
        item_name: p.item_name,
        qty: String(rawQty), 
        unit: p.unit
      });
    });

    try {
      if (typeof window !== 'undefined' && localStorageItems.length > 0) {
        const timestamp = new Date().toLocaleString('id-ID', {
          day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        });
        const newSession = {
          id: Date.now().toString(),
          timestamp: timestamp,
          total_items: localStorageItems.length,
          items: localStorageItems
        };
        
        let existingSessions: any[] = [];
        try {
          const raw = localStorage.getItem('pendingMarketPurchases');
          if (raw) {
            existingSessions = JSON.parse(raw);
            if (!Array.isArray(existingSessions)) existingSessions = [];
          }
        } catch (e) {
          existingSessions = [];
        }
        
        existingSessions.push(newSession);
        localStorage.setItem('pendingMarketPurchases', JSON.stringify(existingSessions));
      }
      await fetch('/api/shopping-list-histories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          created_by: 1,
          created_by_name: 'Admin Pusat',
          total_items: tableData.length,
          print_data: tableData
        })
      });
      const histRes = await fetch('/api/shopping-list-histories');
      const histData = await histRes.json();
      if (histData.success) {
        setHistories(histData.data);
      }
    } catch (e) {
      console.error('Failed to save history', e);
    }
    
    setPdfPreviewUrl(null);
    setShoppingListState({});
    setToast({open: true, message: 'Daftar ceklis telah di-reset & riwayat disimpan.', type: 'success'});
  };

  const handlePrintClick = () => {
    const hasChecked = Object.values(shoppingListState).some(state => state.checked);
    if (!hasChecked) {
      setToast({ open: true, message: 'Harap ceklis minimal satu barang terlebih dahulu untuk dicetak.', type: 'error' });
      return;
    }
    setShowPrintConfirm(true);
  };

  return (
    <section className="screen">
      <Toast isOpen={toast.open} message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, open: false })} />
      <div className="card">
        <div className="card-head" style={{ alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ margin: '0 0 12px 0' }}>Permintaan Outlet</h3>
            <div style={{ display: 'flex', gap: 16, borderBottom: '1px solid var(--border)' }}>
              <div
                style={{ paddingBottom: 6, cursor: 'pointer', fontSize: 12, fontWeight: viewMode === 'by-outlet' ? 600 : 500, color: viewMode === 'by-outlet' ? 'var(--primary)' : 'var(--muted)', borderBottom: viewMode === 'by-outlet' ? '2px solid var(--primary)' : '2px solid transparent', marginBottom: -1 }}
                onClick={() => setViewMode('by-outlet')}
              >
                Per Outlet
              </div>
              <div
                style={{ paddingBottom: 6, cursor: 'pointer', fontSize: 12, fontWeight: viewMode === 'by-product' ? 600 : 500, color: viewMode === 'by-product' ? 'var(--primary)' : 'var(--muted)', borderBottom: viewMode === 'by-product' ? '2px solid var(--primary)' : '2px solid transparent', marginBottom: -1 }}
                onClick={() => setViewMode('by-product')}
              >
                Per Produk
              </div>
              <div
                style={{ paddingBottom: 6, cursor: 'pointer', fontSize: 12, fontWeight: viewMode === 'history' ? 600 : 500, color: viewMode === 'history' ? 'var(--primary)' : 'var(--muted)', borderBottom: viewMode === 'history' ? '2px solid var(--primary)' : '2px solid transparent', marginBottom: -1 }}
                onClick={() => setViewMode('history')}
              >
                Riwayat Belanja
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginTop: -4 }}>
            <input
              type="text"
              className="input"
              style={{ width: 200 }}
              placeholder={viewMode === 'by-outlet' ? 'Cari PO atau Outlet...' : 'Cari nama barang...'}
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); setAggCurrentPage(1); }}
            />
            <input
              type="date"
              className="input"
              style={{ width: 140 }}
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              title="Start Date"
            />
            <span className="muted">-</span>
            <input
              type="date"
              className="input"
              style={{ width: 140 }}
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              title="End Date"
            />
            {viewMode === 'by-outlet' && (
              <Select
                value={statusFilter}
                onChange={val => setStatusFilter(String(val))}
                options={[
                  { value: '', label: 'Semua Status' },
                  { value: 'PENDING', label: 'Menunggu' },
                  { value: 'PROCESSING', label: 'Diproses' },
                  { value: 'SHIPPED', label: 'Dikirim' },
                  { value: 'COMPLETED', label: 'Selesai' }
                ]}
                style={{ width: 140 }}
                inputStyle={{ height: 32 }}
              />
            )}
            {viewMode === 'by-product' && (
              <div style={{ display: 'flex', gap: 8 }}>
                {Object.values(shoppingListState).some(s => s.checked) && (
                  <Button onClick={() => setShoppingListState({})} variant="outline" style={{ display: 'flex', alignItems: 'center', height: 26, padding: '0 8px', fontSize: 11 }}>
                    Bersihkan Ceklis
                  </Button>
                )}
                <Button onClick={handlePrintClick} variant="primary" style={{ display: 'flex', alignItems: 'center', gap: 4, height: 26, padding: '0 8px', fontSize: 11 }}>
                  <FileText size={12} /> Cetak PDF
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="card-body flush">
          {loading && (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Memuat data...</div>
          )}
          
          {!loading && viewMode === 'by-product' && (
            aggregatedProducts.length === 0 ? (
              <div className="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" /></svg>
                <h4>Tidak ada produk tertunda</h4>
                <p>Tidak ada permintaan aktif dari outlet saat ini</p>
              </div>
            ) : (
              <>
                <div className="table-responsive">
                  <Table>
                    <thead>
                      <tr>
                        <th style={{ width: 40, textAlign: 'center', padding: '4px 10px' }}>
                          <input
                            type="checkbox"
                            style={{ cursor: 'pointer' }}
                            checked={
                              aggregatedProducts.length > 0 &&
                              aggregatedProducts.every(p => shoppingListState[p.item_id]?.checked)
                            }
                            onChange={(e) => {
                              const checked = e.target.checked;
                              const newState = { ...shoppingListState };
                              aggregatedProducts.forEach(p => {
                                newState[p.item_id] = { ...newState[p.item_id], checked };
                              });
                              setShoppingListState(newState);
                            }}
                          />
                        </th>
                        <th style={{ padding: '4px 10px', fontSize: 11 }}>Nama Barang</th>
                        <th className="center" style={{ padding: '4px 10px', fontSize: 11 }}>Diminta Outlet</th>
                        <th className="center" style={{ padding: '4px 10px', fontSize: 11 }}>Stok Gudang</th>
                        <th className="center" style={{ padding: '4px 10px', fontSize: 11 }}>Beli (Edit)</th>
                        <th style={{ padding: '4px 10px', fontSize: 11 }}>Catatan Belanja</th>
                        <th className="center" style={{ padding: '4px 10px', fontSize: 11 }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const filteredAgg = aggregatedProducts.filter(p => p.item_name.toLowerCase().includes(searchQuery.toLowerCase()));
                        return filteredAgg.slice((aggCurrentPage - 1) * AGG_ITEMS_PER_PAGE, aggCurrentPage * AGG_ITEMS_PER_PAGE).map(p => {
                          const ratio = Number(p.conversion_ratio) || 1;
                          const neededPurchase = Number(p.total_requested) || 0;
                          const neededRaw = neededPurchase * ratio;
                          const stockRaw = Number(p.central_stock) || 0;

                          const stockPurchase = stockRaw / ratio;

                          const isShortage = neededRaw > stockRaw;

                          const fmt = (num: number) => num.toLocaleString('id-ID', { maximumFractionDigits: 2 });
                          const fmtRaw = (num: number) => num.toLocaleString('id-ID');

                          return (
                            <tr
                              key={p.item_id}
                              className="hover:bg-[#f8fafc] transition-colors"
                            >
                              <td className="center" style={{ padding: '4px 10px' }}>
                                <input
                                  type="checkbox"
                                  checked={shoppingListState[p.item_id]?.checked || false}
                                  onChange={(e) => {
                                    setShoppingListState(prev => ({
                                      ...prev,
                                      [p.item_id]: { ...(prev[p.item_id] || {}), checked: e.target.checked }
                                    }));
                                  }}
                                  style={{ cursor: 'pointer' }}
                                />
                              </td>
                              <td className="font-bold text-primary" style={{ padding: '4px 10px', fontSize: 12, cursor: 'pointer' }} onClick={() => setSelectedAggProduct(p)}>
                                {p.item_name}
                              </td>
                              <td className="center" style={{ padding: '4px 10px' }}>
                                <div className="font-bold text-primary" style={{ fontSize: 12 }}>{fmt(neededPurchase)} <span style={{ fontSize: 11, fontWeight: 'normal' }}>{p.unit}</span></div>
                                {ratio > 1 && <div className="muted" style={{ fontSize: 10 }}>({fmtRaw(neededRaw)} {p.smallest_unit})</div>}
                              </td>
                              <td className="center" style={{ padding: '4px 10px', cursor: 'pointer' }} onClick={() => setSelectedAggProduct(p)}>
                                <div className="text-dark" style={{ fontSize: 12 }}>{fmt(stockPurchase)} <span style={{ fontSize: 11 }}>{p.unit}</span></div>
                                {ratio > 1 && <div className="muted" style={{ fontSize: 10 }}>({fmtRaw(stockRaw)} {p.smallest_unit})</div>}
                              </td>
                              <td className="center" style={{ padding: '4px 10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                  <input
                                    type="text"
                                    className="input right font-bold"
                                    style={{ width: 50, height: 26, padding: '2px 6px', fontSize: 12, borderColor: shoppingListState[p.item_id]?.qty_adjust ? 'var(--primary)' : 'var(--border)' }}
                                    value={shoppingListState[p.item_id]?.qty_adjust !== undefined ? shoppingListState[p.item_id].qty_adjust : neededPurchase}
                                    onChange={(e) => {
                                      setShoppingListState(prev => ({
                                        ...prev,
                                        [p.item_id]: { ...(prev[p.item_id] || {}), qty_adjust: e.target.value, checked: true } // Auto check on edit
                                      }));
                                    }}
                                  />
                                  <span className="muted" style={{ fontSize: 11 }}>{p.unit}</span>
                                </div>
                              </td>
                              <td style={{ padding: '4px 10px' }}>
                                <input
                                  type="text"
                                  className="input"
                                  placeholder="Catatan..."
                                  style={{ width: '100%', minWidth: 140, height: 26, padding: '2px 6px', fontSize: 11 }}
                                  value={shoppingListState[p.item_id]?.notes || ''}
                                  onChange={(e) => {
                                    setShoppingListState(prev => ({
                                      ...prev,
                                      [p.item_id]: { ...(prev[p.item_id] || {}), notes: e.target.value, checked: true } // Auto check on edit
                                    }));
                                  }}
                                />
                              </td>
                              <td className="center" style={{ padding: '4px 10px' }}>
                                {isShortage ? (
                                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 6px', borderRadius: 4, background: '#fee2e2', color: '#991b1b' }}>Perlu Restock</span>
                                ) : (
                                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 6px', borderRadius: 4, background: '#dcfce7', color: '#166534' }}>Stok Tersedia</span>
                                )}
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </Table>
                </div>
                {(() => {
                  const filteredAgg = aggregatedProducts.filter(p => p.item_name.toLowerCase().includes(searchQuery.toLowerCase()));
                  if (filteredAgg.length <= AGG_ITEMS_PER_PAGE) return null;
                  return (
                    <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
                      <Pagination
                        currentPage={aggCurrentPage}
                        totalPages={Math.ceil(filteredAgg.length / AGG_ITEMS_PER_PAGE)}
                        totalItems={filteredAgg.length}
                        itemsPerPage={AGG_ITEMS_PER_PAGE}
                        onPageChange={setAggCurrentPage}
                      />
                    </div>
                  );
                })()}
              </>
            )
          )}

          {!loading && viewMode === 'by-outlet' && (
            orders.length === 0 ? (
              <div className="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" /></svg>
                <h4>Belum ada permintaan</h4>
                <p>Belum ada permintaan masuk dari outlet</p>
              </div>
            ) : (
              <>
              <Table>
                <thead>
                  <tr>
                    <th>No. PO</th><th>Outlet</th><th>Dibuat oleh</th>
                    <th>Tanggal Order</th><th>Tanggal Kirim</th>
                    <th className="center">Barang</th><th className="center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const filteredOrders = orders.filter(o =>
                      o.outlet_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      `PO-${new Date(o.order_date).getFullYear()}-${String(o.id).padStart(5, '0')}`.toLowerCase().includes(searchQuery.toLowerCase())
                    );
                    return filteredOrders.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map(o => (
                      <tr
                        key={o.id}
                        onClick={() => handleViewOrder(o)}
                        style={{ cursor: 'pointer' }}
                        className="hover:bg-[#e6f3ec] transition-colors"
                      >
                        <td className="font-mono text-primary font-bold">PO-{new Date(o.order_date).getFullYear()}-{String(o.id).padStart(5, '0')}</td>
                        <td className="font-bold">{o.outlet_name}</td>
                        <td className="muted">{o.created_by_name?.replace('Coffeelab ', '')}</td>
                        <td>{formatDate(o.order_date)}</td>
                        <td>{formatDate(o.delivery_date)}</td>
                        <td className="center num font-bold">{o.item_count}</td>
                        <td className="center"><OrderStatusBadge status={o.status} /></td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </Table>

              {(() => {
                const filteredOrders = orders.filter(o =>
                  o.outlet_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  `PO-${new Date(o.order_date).getFullYear()}-${String(o.id).padStart(5, '0')}`.toLowerCase().includes(searchQuery.toLowerCase())
                );
                if (filteredOrders.length <= ITEMS_PER_PAGE) return null;
                return (
                  <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
                    <Pagination
                      currentPage={currentPage}
                      totalPages={Math.ceil(filteredOrders.length / ITEMS_PER_PAGE)}
                      totalItems={filteredOrders.length}
                      itemsPerPage={ITEMS_PER_PAGE}
                      onPageChange={setCurrentPage}
                    />
                  </div>
                );
              })()}
            </>
          )
        )}

          {!loading && viewMode === 'history' && (
            <>
              <Table>
                  <thead style={{ background: '#f8fafc' }}>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600 }}>Tanggal Cetak</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600 }}>Dicetak Oleh</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--muted)', fontWeight: 600 }}>Jumlah Barang</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--muted)', fontWeight: 600 }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {histories.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>Belum ada riwayat cetak PDF.</td>
                      </tr>
                    ) : (
                      histories.map(h => (
                        <tr key={h.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                            {new Date(h.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td style={{ padding: '12px 16px' }}>{h.created_by_name}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>{h.total_items} item</td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <Button 
                              variant="outline" 
                              onClick={() => {
                                const dateStr = new Date(h.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
                                const doc = generatePDFFromTableData(h.print_data, dateStr);
                                setPdfPreviewUrl(doc.output('datauristring'));
                              }}
                              style={{ padding: '4px 8px', fontSize: 12, height: 26, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            >
                              <FileText size={12} /> Lihat PDF
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
              </Table>
            </>
          )}
        </div>
      </div>

      <Modal isOpen={!!selectedOrder} onClose={() => setSelectedOrder(null)} title={`Detail Permintaan PO-${selectedOrder ? new Date(selectedOrder.order.order_date).getFullYear() + '-' + String(selectedOrder.order.id).padStart(5, '0') : ''}`} maxWidth={1100}>
        <div className="modal-body" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <p className="muted" style={{ margin: 0 }}>{selectedOrder?.order?.outlet_name}: {selectedOrder ? formatDate(selectedOrder.order.order_date) : ''}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {selectedOrder?.items?.some(i => i.fulfillment_status === 'SANGGUP') && !['SHIPPED', 'COMPLETED', 'DIKIRIM', 'SELESAI'].includes(selectedOrder.order.status) && (
                <Link href={`/delivery-orders/create?order_id=${selectedOrder.order.id}`} style={{ textDecoration: 'none' }}>
                  <Button variant="outline" size="sm" style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}>
                    Kirim ke Outlet
                  </Button>
                </Link>
              )}
            </div>
          </div>

          <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {selectedOrder?.items?.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>
                Data barang kosong atau tidak ditemukan.
              </div>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>Barang</th><th>Kategori</th><th className="right">Jml Diminta</th>
                    <th className="right">Jml Disetujui</th>
                    <th>Catatan Pusat</th>
                    <th className="right">Stok Saat Ini</th>
                    <th>Pemenuhan</th><th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder?.items?.map(item => {
                    const isReadOnly = ['SHIPPED', 'COMPLETED', 'DIKIRIM', 'SELESAI'].includes(selectedOrder.order.status);
                    return (
                      <tr key={item.id}>
                        <td className="font-bold">{item.item_name}</td>
                        <td className="muted">{item.category_name}</td>
                        <td className="right">
                          <div className="muted num" style={{ fontSize: 13 }}>{parseFloat(Number(item.qty_request).toFixed(3)).toLocaleString('id-ID')} {item.purchase_unit}</div>
                        </td>
                        <td className="right">
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                            <input
                              type="number"
                              className="input right font-bold"
                              style={{ width: 70, height: 28, padding: '2px 8px', backgroundColor: isReadOnly ? '#f1f5f9' : 'white' }}
                              defaultValue={item.qty_approved ?? item.qty_request}
                              disabled={isReadOnly}
                              onBlur={(e) => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val) && val >= 0) {
                                  handleUpdateItem(item.id, {
                                    qty_approved: val,
                                    approved_smallest_qty: val * Number(item.conversion_ratio || 1)
                                  });
                                }
                              }}
                            />
                            <span style={{ fontSize: 13 }}>{item.purchase_unit}</span>
                          </div>
                        </td>
                        <td>
                          <input
                            type="text"
                            className="input"
                            style={{ width: 140, height: 28, padding: '2px 8px', fontSize: 12, backgroundColor: isReadOnly ? '#f1f5f9' : 'white' }}
                            placeholder="Alasan / Catatan..."
                            defaultValue={item.center_notes ?? ''}
                            disabled={isReadOnly}
                            onBlur={(e) => {
                              if (e.target.value !== (item.center_notes ?? '')) {
                                handleUpdateItem(item.id, { center_notes: e.target.value });
                              }
                            }}
                          />
                        </td>
                        <td className="right">
                          <div className="font-bold num" style={{ color: Number(item.current_stock) >= (item.approved_smallest_qty ?? item.smallest_unit_qty) ? '#166534' : '#991b1b' }}>
                            {parseFloat((Number(item.current_stock ?? 0) / Number(item.conversion_ratio || 1)).toFixed(3)).toLocaleString('id-ID')} {item.purchase_unit}
                          </div>
                        </td>
                        <td>
                          <Select
                            inputStyle={{ height: 30, padding: '2px 8px', ...getFulfillmentStyle(item.fulfillment_status), opacity: isReadOnly ? 0.7 : 1 }}
                            value={item.fulfillment_status}
                            onChange={val => handleUpdateItem(item.id, { fulfillment_status: String(val) })}
                            disabled={isReadOnly}
                            options={[
                              { value: 'MENUNGGU', label: 'Menunggu' },
                              { value: 'SANGGUP', label: 'Sanggup' },
                              { value: 'TIDAK', label: 'Tidak' }
                            ]}
                          />
                        </td>
                        <td>
                          <Select
                            inputStyle={{ height: 30, padding: '2px 8px', ...getStatusStyle(item.item_status), opacity: isReadOnly ? 0.7 : 1 }}
                            value={item.item_status}
                            onChange={val => handleUpdateItem(item.id, { item_status: String(val) })}
                            disabled={isReadOnly}
                            options={Object.entries(ITEM_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l as string }))}
                          />
                        </td>
                        <td>
                          {saving === item.id && <span className="muted" style={{ fontSize: 11 }}>...</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            )}
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!selectedAggProduct} onClose={() => setSelectedAggProduct(null)} title={`Rincian Permintaan: ${selectedAggProduct?.item_name || ''}`} maxWidth={650}>
        <div className="modal-body" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>Total Diminta:</div>
              <div className="font-bold text-primary" style={{ fontSize: 16 }}>
                {selectedAggProduct ? Number(selectedAggProduct.total_requested).toLocaleString('id-ID', { maximumFractionDigits: 2 }) : 0} {selectedAggProduct?.unit}
              </div>
            </div>
            <div className="right">
              <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>Stok Pusat Saat Ini:</div>
              <div className="font-bold text-dark" style={{ fontSize: 16 }}>
                {selectedAggProduct ? (Number(selectedAggProduct.central_stock) / (Number(selectedAggProduct.conversion_ratio) || 1)).toLocaleString('id-ID', { maximumFractionDigits: 2 }) : 0} {selectedAggProduct?.unit}
              </div>
            </div>
          </div>

          <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <table className="table" style={{ width: '100%', marginBottom: 0 }}>
              <thead style={{ backgroundColor: '#f8fafc' }}>
                <tr>
                  <th style={{ padding: '6px 12px', fontSize: 11, borderBottom: '1px solid var(--border)', color: 'var(--muted)', textAlign: 'left' }}>OUTLET</th>
                  <th style={{ padding: '6px 12px', fontSize: 11, borderBottom: '1px solid var(--border)', color: 'var(--muted)', textAlign: 'left' }}>TANGGAL</th>
                  <th style={{ padding: '6px 12px', fontSize: 11, borderBottom: '1px solid var(--border)', color: 'var(--muted)', textAlign: 'right' }}>JUMLAH</th>
                  <th style={{ padding: '6px 12px', fontSize: 11, borderBottom: '1px solid var(--border)', color: 'var(--muted)', textAlign: 'center' }}>NOMOR PO</th>
                </tr>
              </thead>
              <tbody>
                {selectedAggProduct?.breakdown?.map((b, i) => (
                  <tr key={i} style={{ borderBottom: i < (selectedAggProduct.breakdown?.length || 0) - 1 ? '1px solid #e2e8f0' : 'none' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600, fontSize: 12, color: 'var(--ink)' }}>{b.outlet_name}</td>
                    <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--ink)' }}>{formatDate(b.order_date)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--primary)', fontSize: 12 }}>
                      {Number(b.qty).toLocaleString('id-ID', { maximumFractionDigits: 2 })} {selectedAggProduct.unit}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <Link href={`/requests?open_id=${b.order_id}`} style={{ color: 'var(--primary)', textDecoration: 'underline', fontWeight: 600, fontSize: 12 }}>
                        PO-{new Date(b.order_date).getFullYear()}-{String(b.order_id).padStart(5, '0')}
                      </Link>
                    </td>
                  </tr>
                ))}
                {!selectedAggProduct?.breakdown?.length && (
                  <tr>
                    <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)' }}>
                      Rincian tidak ditemukan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
            <Button variant="outline" onClick={() => setSelectedAggProduct(null)}>Tutup</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={showPrintConfirm}
        title="Cetak Daftar Belanja?"
        message="Apakah anda yakin ingin mencetak daftar belanja? Dokumen akan langsung diunduh."
        onConfirm={async () => {
          setShowPrintConfirm(false);
          const success = generateShoppingListPDF();
          if (success) {
            await handleSaveHistoryAndClear();
          }
        }}
        onCancel={() => setShowPrintConfirm(false)}
        confirmText="Unduh PDF"
        cancelText="Batal"
      />

      <Modal isOpen={!!pdfPreviewUrl} onClose={() => setPdfPreviewUrl(null)} title="Pratinjau PDF Riwayat Belanja" maxWidth={900}>
        <div className="modal-body" style={{ padding: '20px', overflow: 'hidden' }}>
          {pdfPreviewUrl && (
            <iframe src={pdfPreviewUrl} style={{ width: '100%', height: 'calc(90vh - 100px)', border: '1px solid #e2e8f0', borderRadius: 8, background: '#f1f5f9' }}></iframe>
          )}
        </div>
      </Modal>
    </section>
  );
}

export default function RequestsPage() {
  return (
    <Suspense fallback={<div className="screen" style={{ padding: 40, textAlign: 'center' }}>Memuat...</div>}>
      <RequestsContent />
    </Suspense>
  );
}
