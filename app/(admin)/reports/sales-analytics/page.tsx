'use client';
import { useState, useEffect } from 'react';
import { Toast } from '@/components/ui/Toast';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function SalesAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [matrix, setMatrix] = useState<any[]>([]);
  const [outletColumns, setOutletColumns] = useState<{ id: number; name: string }[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [search, setSearch] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const totalPages = Math.ceil(matrix.length / pageSize);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 2;
    let startPage = Math.max(1, page - Math.floor(maxVisiblePages / 2));
    let endPage = startPage + maxVisiblePages - 1;

    if (endPage > totalPages) {
      endPage = totalPages;
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  };

  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as any });

  // Init dates (First day of month to today)
  useEffect(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    setDateFrom(firstDay.toISOString().split('T')[0]);
    setDateTo(now.toISOString().split('T')[0]);
  }, []);

  const fetchData = async () => {
    if (!dateFrom || !dateTo) return;
    setLoading(true);
    try {
      const url = new URL(window.location.origin + '/api/reports/sales-matrix');
      url.searchParams.set('dateFrom', dateFrom);
      url.searchParams.set('dateTo', dateTo);
      if (categoryId) url.searchParams.set('categoryId', categoryId);
      if (search) url.searchParams.set('search', search);

      const res = await fetch(url.toString());
      const data = await res.json();

      if (data.success) {
        setMatrix(data.data.matrix);
        setOutletColumns(data.data.outletColumns);
        setCategories(data.data.categories);
        setPage(1); // Reset page on new data
      } else {
        setToast({ isOpen: true, message: data.message || 'Gagal memuat data', type: 'error' });
      }
    } catch (error) {
      setToast({ isOpen: true, message: 'Terjadi kesalahan jaringan', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (dateFrom && dateTo) {
      // Debounce search slightly
      const t = setTimeout(() => {
        fetchData();
      }, 300);
      return () => clearTimeout(t);
    }
  }, [dateFrom, dateTo, categoryId, search]);

  const handleExport = () => {
    // Simple CSV export
    let csvContent = "data:text/csv;charset=utf-8,";
    const headerRow = ["Kategori", "Produk", "Harga", ...outletColumns.map(o => o.name), "Total Qty"];
    csvContent += headerRow.join(",") + "\n";

    matrix.forEach(row => {
      const rowData = [
        `"${row.category_name || ''}"`,
        `"${row.menu_name}"`,
        row.sale_price,
        ...outletColumns.map(o => row.outlets[o.id] || 0),
        row.total_qty
      ];
      csvContent += rowData.join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `sales_matrix_${dateFrom}_to_${dateTo}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fmtCurrency = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

  return (
    <section className="screen">
      <Toast {...toast} onClose={() => setToast({ ...toast, isOpen: false })} />

      <div className="card">
        <div className="tabs" style={{ marginBottom: 0 }}>
          <Link href="/reports" className="tab" style={{ textDecoration: 'none', color: 'inherit' }}>Grafik Keuangan</Link>
          <Link href="/reports/sales-analytics" className="tab active" style={{ textDecoration: 'none' }}>Analitik Penjualan</Link>
          <Link href="/reports/inventory-value" className="tab" style={{ textDecoration: 'none', color: 'inherit' }}>Tabel Persediaan</Link>
          <Link href="/price-history" className="tab" style={{ textDecoration: 'none', color: 'inherit' }}>Riwayat Harga</Link>
        </div>
        <div className="card-head">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 18 }}>Analitik Penjualan (Matriks Produk)</h3>
              <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
                Perbandingan total produk terjual di seluruh outlet.
              </p>
            </div>
            <button className="btn btn-outline btn-sm" onClick={handleExport} disabled={loading || matrix.length === 0} style={{ fontWeight: 600 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Ekspor CSV
            </button>
          </div>
        </div>

        {/* Filters & Top Pagination */}
        <div style={{ display: 'flex', gap: 12, padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="date" className="input" style={{ width: 140 }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="Tanggal Mulai" />
          <input type="date" className="input" style={{ width: 140 }} value={dateTo} onChange={e => setDateTo(e.target.value)} title="Tanggal Selesai" />
          <select className="input" style={{ width: 180 }} value={categoryId} onChange={e => setCategoryId(e.target.value)}>
            <option value="">Semua Kategori</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input
            type="text"
            className="input"
            placeholder="Cari nama menu..."
            style={{ width: 220 }}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div style={{ display: 'flex', alignItems: 'center', marginLeft: 'auto', gap: 16 }}>
            {matrix.length > pageSize && !loading && (
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="btn btn-outline btn-sm" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))} style={{ height: 28, padding: '0 8px', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}><ChevronLeft size={16} /></button>
                {getPageNumbers().map(p => (
                  <button key={p} className={`btn btn-sm ${page === p ? 'btn-primary' : 'btn-outline'}`} onClick={() => setPage(p)} style={{ height: 28, minWidth: 28, padding: '0 8px', fontSize: 12, opacity: page === p ? 1 : 0.7, background: page === p ? undefined : '#fff' }}>{p}</button>
                ))}
                <button className="btn btn-outline btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ height: 28, padding: '0 8px', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}><ChevronRight size={16} /></button>
              </div>
            )}
            <span className="muted" style={{ fontSize: 13 }}>
              {matrix.length} data
            </span>
          </div>
        </div>

        {/* Table Container */}
        <div className="card-body flush">

          <div className="table-responsive">
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Memuat data matriks...</div>
            ) : matrix.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Tidak ada data penjualan yang sesuai dengan kriteria ini.</div>
            ) : (
              <table className="table" style={{ minWidth: 800, fontSize: 12, whiteSpace: 'nowrap' }}>
                <thead>
                  <tr style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>
                    <th style={{ width: 250, minWidth: 250, maxWidth: 250, position: 'sticky', left: 0, background: '#fff', zIndex: 10, boxShadow: '4px 0 8px -2px rgba(0,0,0,0.05)', whiteSpace: 'normal' }}>PRODUK</th>
                    <th style={{ width: 100, textAlign: 'right' }}>HARGA</th>
                    {outletColumns.map(o => (
                      <th key={o.id} style={{ textAlign: 'center', whiteSpace: 'nowrap', padding: '0 24px', borderLeft: '1px solid var(--border)' }}>{o.name}</th>
                    ))}
                    <th style={{ width: 100, textAlign: 'center', background: '#fff', borderLeft: '1px solid var(--border)' }}>TOTAL QTY</th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.slice((page - 1) * pageSize, page * pageSize).map((row) => (
                    <tr key={row.menu_id}>
                      <td style={{ position: 'sticky', left: 0, background: '#fff', zIndex: 9, boxShadow: '4px 0 8px -2px rgba(0,0,0,0.05)', whiteSpace: 'normal', width: 250, minWidth: 250, maxWidth: 250 }}>
                        <div style={{ fontWeight: 600, color: '#1e293b', overflowWrap: 'break-word', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {row.menu_name}
                          {row.category_name && (
                            <span style={{ fontSize: 9, background: '#f1f5f9', color: '#64748b', padding: '2px 6px', borderRadius: 4, fontWeight: 600, letterSpacing: 0.5 }}>
                              {row.category_name.toUpperCase()}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', color: '#64748b' }}>{fmtCurrency(row.sale_price)}</td>
                      {outletColumns.map(o => {
                        const val = row.outlets[o.id] || 0;
                        return (
                          <td key={o.id} style={{ textAlign: 'center', color: val > 0 ? '#1e293b' : '#cbd5e1', fontWeight: val > 0 ? 500 : 400, borderLeft: '1px solid var(--border)' }}>
                            {val > 0 ? val.toLocaleString('id-ID') : '-'}
                          </td>
                        );
                      })}
                      <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--primary)', background: '#fff', borderLeft: '1px solid var(--border)' }}>
                        {row.total_qty.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#fff', fontWeight: 700 }}>
                    <td colSpan={2} style={{ position: 'sticky', left: 0, background: '#fff', zIndex: 10, boxShadow: '4px 0 8px -2px rgba(0,0,0,0.05)', textAlign: 'right', padding: '16px 20px', color: 'var(--text-strong)', letterSpacing: '0.5px', borderTop: '2px solid var(--border)' }}>
                      TOTAL KESELURUHAN QTY
                    </td>
                    {outletColumns.map(o => {
                      const colTotal = matrix.reduce((sum, r) => sum + (r.outlets[o.id] || 0), 0);
                      return (
                        <td key={o.id} style={{ textAlign: 'center', padding: '16px 8px', color: colTotal > 0 ? 'var(--text-strong)' : 'var(--text-muted)', borderLeft: '1px solid var(--border)', borderTop: '2px solid var(--border)' }}>
                          {colTotal > 0 ? colTotal.toLocaleString('id-ID') : '-'}
                        </td>
                      );
                    })}
                    <td style={{ textAlign: 'center', color: 'var(--primary)', padding: '16px 8px', fontSize: 14, background: '#fff', borderLeft: '1px solid var(--border)', borderTop: '2px solid var(--border)' }}>
                      {matrix.reduce((sum, r) => sum + r.total_qty, 0).toLocaleString('id-ID')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

        </div>
      </div>
    </section>
  );
}
