'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import * as XLSX from 'xlsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function InventoryValueTablePage() {
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [reportData, setReportData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    setCurrentPage(1);
  }, [search, categoryFilter, month, year]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/inventory-value?month=${month}&year=${year}`)
      .then(r => r.json())
      .then(d => {
        setReportData(d.data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [month, year]);

  const exportExcel = () => {
    if (reportData.length === 0) {
      alert("Tidak ada data untuk diekspor");
      return;
    }
    
    const wsData = reportData.map(r => ({
      'Nama Barang': r.item_name,
      'Kategori': r.category_name,
      'Total MASUK (Qty)': Number(r.total_in_qty),
      'Total MASUK (Nilai Rp)': Number(r.total_in_qty) * Number(r.current_average_price),
      'Total Distribusi (Qty)': Number(r.total_distribution_qty),
      'Total Distribusi (Nilai Rp)': Number(r.total_distribution_qty) * Number(r.current_average_price),
      'Total Penyesuaian (Qty)': Number(r.total_adj_qty),
      'Total Penyesuaian (Nilai Rp)': Math.abs(Number(r.total_adj_qty)) * Number(r.current_average_price),
      'Saldo Saat Ini (Qty)': Number(r.current_balance),
      'Harga MA Saat Ini': Number(r.current_average_price),
      'Nilai Saat Ini (Rp)': Number(r.current_balance) * Number(r.current_average_price),
    }));

    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan Nilai Persediaan');
    XLSX.writeFile(wb, `Laporan_Persediaan_${year}_${month}.xlsx`);
  };

  const categories = Array.from(new Set(reportData.map((r: any) => String(r.category_name || 'Tidak Berkategori')))).sort();

  const filteredData = reportData.filter((r: any) => {
    const matchSearch = String(r.item_name || '').toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter ? (r.category_name || 'Tidak Berkategori') === categoryFilter : true;
    return matchSearch && matchCat;
  });

  let grandTotalIn = 0;
  let grandTotalDist = 0;
  let grandTotalAdj = 0;
  let grandTotalValue = 0;

  filteredData.forEach(r => {
    const ma = Number(r.current_average_price);
    grandTotalIn += Number(r.total_in_qty) * ma;
    grandTotalDist += Number(r.total_distribution_qty) * ma;
    grandTotalAdj += Math.abs(Number(r.total_adj_qty)) * ma;
    grandTotalValue += Number(r.current_balance) * ma;
  });

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <section style={{ margin: '-16px -20px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 52px)' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff' }}>
        <div className="tabs" style={{ marginBottom: 0, padding: '0 24px', paddingTop: 16 }}>
          <Link href="/reports" className="tab" style={{ textDecoration: 'none', color: 'inherit' }}>Grafik Keuangan</Link>
          <Link href="/reports/sales-analytics" className="tab" style={{ textDecoration: 'none', color: 'inherit' }}>Analitik Penjualan</Link>
          <Link href="/reports/inventory-value" className="tab active" style={{ textDecoration: 'none' }}>Tabel Persediaan</Link>
          <Link href="/price-history" className="tab" style={{ textDecoration: 'none', color: 'inherit' }}>Riwayat Harga</Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ fontSize: 18, margin: 0, fontWeight: 700 }}>Tabel Pengadaan & Persediaan</h3>
            <p className="muted" style={{ margin: 0, marginTop: 4 }}>Tabel rinci nilai persediaan menggunakan Moving Average.</p>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              className="input"
              placeholder="Cari nama barang..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: 180, padding: '2px 8px', fontSize: 12, height: 28 }}
            />
            <Select
              value={categoryFilter}
              onChange={val => setCategoryFilter(String(val))}
              options={[
                { value: '', label: 'Semua Kategori' },
                ...categories.map(c => ({ value: c, label: c }))
              ]}
              style={{ width: 140 }}
              inputStyle={{ padding: '2px 8px', fontSize: 12, height: 28 }}
            />
            <Select 
              value={month} 
              onChange={(val) => setMonth(Number(val))}
              options={Array.from({length: 12}).map((_, i) => ({ value: i+1, label: new Date(0, i).toLocaleString('id-ID', { month: 'long' }) }))}
              style={{ width: 120 }}
              inputStyle={{ padding: '2px 8px', fontSize: 12, height: 28 }}
            />
            <Select 
              value={year} 
              onChange={(val) => setYear(Number(val))}
              options={[year-1, year, year+1].map(y => ({ value: y, label: String(y) }))}
              style={{ width: 80 }}
              inputStyle={{ padding: '2px 8px', fontSize: 12, height: 28 }}
            />
            <Button variant="outline" onClick={exportExcel} style={{ height: 28, fontSize: 12, padding: '0 10px' }}>⬇ Ekspor Excel</Button>
          </div>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Memuat data keuangan...</div>
          ) : reportData.length === 0 ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Tidak ada transaksi ditemukan untuk periode ini.</div>
          ) : filteredData.length === 0 ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Tidak ada data yang sesuai dengan pencarian.</div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th style={{ padding: '10px 24px', fontSize: 11, minWidth: 200 }}>Nama Barang</th>
                  <th style={{ padding: '10px 24px', fontSize: 11, width: 150 }}>Kategori</th>
                  <th className="right" style={{ padding: '10px 24px', fontSize: 11, width: 150 }}>Total Nilai MASUK</th>
                  <th className="right" style={{ padding: '10px 24px', fontSize: 11, width: 150 }}>Nilai Distribusi</th>
                  <th className="right" style={{ padding: '10px 24px', fontSize: 11, width: 150, color: '#dc2626' }}>Nilai Penyesuaian</th>
                  <th className="right" style={{ padding: '10px 24px', fontSize: 11, width: 160, background: '#f8fafc' }}>Nilai Stok Saat Ini</th>
                </tr>
              </thead>
              <tbody style={{ fontSize: 12 }}>
                {paginatedData.map((r: any, i: number) => {
                  const ma = Number(r.current_average_price || 0);
                  const valIn = Math.round(Number(r.total_in_qty) * ma);
                  const valDist = Math.round(Number(r.total_distribution_qty) * ma);
                  const valAdj = Math.round(Math.abs(Number(r.total_adj_qty)) * ma);
                  const valCurrent = Math.round(Number(r.current_balance) * ma);
                  
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td className="font-bold" style={{ padding: '8px 24px' }}>{r.item_name}</td>
                      <td className="muted" style={{ padding: '8px 24px' }}>{r.category_name}</td>
                      <td className="right num" style={{ padding: '8px 24px' }}>Rp {valIn.toLocaleString('id-ID')}</td>
                      <td className="right num" style={{ padding: '8px 24px' }}>Rp {valDist.toLocaleString('id-ID')}</td>
                      <td className="right num" style={{ padding: '8px 24px', color: valAdj > 0 ? '#dc2626' : 'inherit' }}>
                        Rp {valAdj.toLocaleString('id-ID')}
                      </td>
                      <td className="right num font-bold" style={{ padding: '8px 24px', background: '#f8fafc', color: '#016e3f' }}>
                        Rp {valCurrent.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot style={{ position: 'sticky', bottom: 0, zIndex: 10, boxShadow: '0 -2px 10px rgba(0,0,0,0.05)' }}>
                <tr style={{ background: '#f1f5f9', fontWeight: 700, borderTop: '2px solid var(--border)', fontSize: 12 }}>
                  <td colSpan={2} style={{ padding: '12px 24px' }}>TOTAL KESELURUHAN</td>
                  <td className="right num" style={{ padding: '12px 24px' }}>Rp {grandTotalIn.toLocaleString('id-ID')}</td>
                  <td className="right num" style={{ padding: '12px 24px' }}>Rp {grandTotalDist.toLocaleString('id-ID')}</td>
                  <td className="right num" style={{ padding: '12px 24px', color: '#dc2626' }}>Rp {grandTotalAdj.toLocaleString('id-ID')}</td>
                  <td className="right num" style={{ padding: '12px 24px', color: '#016e3f', fontSize: 14 }}>Rp {grandTotalValue.toLocaleString('id-ID')}</td>
                </tr>
              </tfoot>
            </Table>
          )}
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '12px 24px', gap: 16, borderTop: '1px solid var(--border)' }}>
            <span className="muted" style={{ fontSize: 12 }}>
              Menampilkan {filteredData.length} data
            </span>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <Button 
                variant="outline" 
                disabled={currentPage === 1} 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                style={{ height: 28, width: 28, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Sebelumnya"
              >
                <ChevronLeft size={16} />
              </Button>
              
              {(() => {
                const getPageNumbers = (c: number, t: number) => {
                  if (t <= 5) return Array.from({ length: t }, (_, i) => i + 1);
                  if (c <= 3) return [1, 2, 3, 4, 5, '...', t];
                  if (c >= t - 2) return [1, '...', t - 4, t - 3, t - 2, t - 1, t];
                  return [1, '...', c - 1, c, c + 1, '...', t];
                };
                
                return getPageNumbers(currentPage, totalPages).map((p, i) => (
                  typeof p === 'number' ? (
                    <Button
                      key={i}
                      variant={p === currentPage ? "primary" : "outline"}
                      onClick={() => setCurrentPage(p)}
                      style={{ 
                        height: 28, 
                        minWidth: 28, 
                        padding: '0 8px', 
                        fontSize: 12,
                        background: p === currentPage ? '#016e3f' : undefined,
                        color: p === currentPage ? '#fff' : undefined,
                        borderColor: p === currentPage ? '#016e3f' : undefined
                      }}
                    >
                      {p}
                    </Button>
                  ) : (
                    <span key={i} className="muted" style={{ padding: '0 4px', fontSize: 12 }}>{p}</span>
                  )
                ));
              })()}

              <Button 
                variant="outline" 
                disabled={currentPage === totalPages} 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                style={{ height: 28, width: 28, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Selanjutnya"
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
