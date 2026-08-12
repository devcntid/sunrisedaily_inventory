'use client';
import { useState, useEffect, useCallback, Fragment } from 'react';
import { Table } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { Search, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Select } from '@/components/ui/Select';

interface CombinedStock {
  id: number;
  item_name: string;
  category_name: string;
  category_id: number;
  minimum_threshold: number;
  smallest_unit: string;
  purchase_unit: string;
  conversion_ratio: string;
  central_stock: string;
  outlet_stock: string;
  current_average_price: string;
  outlet_stocks_map: Record<string, string>;
}

export function CombinedStockView({ categories = [] }: { categories?: { id: number, name: string }[] }) {
  const [data, setData] = useState<CombinedStock[]>([]);
  const [outlets, setOutlets] = useState<{ id: number, name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/reports/combined-stock`);
    const json = await res.json();
    setData(json.data ?? []);
    setOutlets(json.outlets ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchReport();
    setCurrentPage(1);
  }, [fetchReport]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterCategory, filterStatus]);

  const filteredData = data.filter(item => {
    // Search
    const matchSearch = item.item_name.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;

    // Category
    if (filterCategory !== 'ALL' && String(item.category_id) !== filterCategory) return false;

    // Status
    if (filterStatus !== 'ALL') {
      const central = Number(item.central_stock);
      const outlet = Number(item.outlet_stock);
      const total = central + outlet;

      let status = 'AMAN';
      const minStock = Number(item.minimum_threshold);
      if (minStock > 0) {
        if (total <= minStock) status = 'KRITIS';
        else if (total <= minStock * 1.5) status = 'MENIPIS';
      }

      if (filterStatus === 'KRITIS' && (status === 'KRITIS' || status === 'MENIPIS')) {
        return true;
      }
      if (filterStatus === 'AMAN' && status === 'AMAN') {
        return true;
      }
      return false;
    }

    return true;
  });

  const handleExport = () => {
    const exportData = filteredData.map(item => {
      const central = Number(item.central_stock);
      const ratio = Number(item.conversion_ratio) || 1;
      const valPusat = (Math.max(0, central) / ratio) * Math.round(Number(item.current_average_price) * ratio);
      
      const row: Record<string, any> = {
        'Bahan / Produk': item.item_name,
        'Pusat': valPusat
      };

      let valOutlet = 0;
      for (const o of outlets) {
        const oStock = Number(item.outlet_stocks_map?.[o.id] || 0);
        const oVal = (Math.max(0, oStock) / ratio) * Math.round(Number(item.current_average_price) * ratio);
        const simpleName = o.name.replace(/coffeelab|coffee lab|coffelab/i, '').replace(/,/g, '').replace(/\s+/g, ' ').trim();
        row[simpleName] = oVal;
        valOutlet += oVal;
      }

      row['Total Outlet'] = valOutlet;
      row['Grand Total'] = valPusat + valOutlet;
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan_Aset");
    
    worksheet['!cols'] = [
      { wch: 30 }, // Bahan / Produk
      { wch: 18 }, // Pusat
      ...outlets.map(() => ({ wch: 18 })), // Each Outlet
      { wch: 22 }, // Total Outlet
      { wch: 22 }  // Grand Total
    ];

    XLSX.writeFile(workbook, `Rekap_Aset_Gudang_dan_Outlet_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <>
      <div className="card-body p-0">
        {!loading && data.length > 0 && (
          <div style={{ padding: '12px 20px', background: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <div style={{ background: '#fff', padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Aset Gudang Pusat</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                Rp {data.reduce((sum, item) => {
                  const r = Number(item.conversion_ratio) || 1;
                  return sum + (Math.max(0, Number(item.central_stock)) / r) * Math.round(Number(item.current_average_price) * r);
                }, 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div style={{ background: '#fff', padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Aset Seluruh Outlet</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                Rp {data.reduce((sum, item) => {
                  const r = Number(item.conversion_ratio) || 1;
                  let val = 0;
                  for (const o of outlets) {
                    val += (Math.max(0, Number(item.outlet_stocks_map?.[o.id] || 0)) / r) * Math.round(Number(item.current_average_price) * r);
                  }
                  return sum + val;
                }, 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div style={{ background: '#016e3f', padding: '8px 12px', borderRadius: 6, color: '#fff', boxShadow: '0 2px 4px rgba(1,110,63,0.15)' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#a7f3d0', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Grand Total Aset Perusahaan</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>
                Rp {data.reduce((sum, item) => {
                  const r = Number(item.conversion_ratio) || 1;
                  let valOut = 0;
                  for (const o of outlets) {
                    valOut += (Math.max(0, Number(item.outlet_stocks_map?.[o.id] || 0)) / r) * Math.round(Number(item.current_average_price) * r);
                  }
                  const valPus = (Math.max(0, Number(item.central_stock)) / r) * Math.round(Number(item.current_average_price) * r);
                  return sum + valPus + valOut;
                }, 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>
        )}

        <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div className="text-gray-500 font-medium" style={{ fontSize: 12 }}>Detail Stok Barang</div>
            <button 
              onClick={handleExport} 
              className="btn btn-outline" 
              style={{ padding: '4px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Download size={14} /> Export Excel
            </button>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                className="input"
                placeholder="Cari barang/SKU..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: 180, padding: '6px 12px 6px 30px', fontSize: 12 }}
              />
            </div>
            <Select
              value={filterCategory}
              onChange={(val) => setFilterCategory(String(val))}
              options={[
                { value: 'ALL', label: 'Semua Kategori' },
                ...(categories.map((cat) => ({ value: cat.id.toString(), label: cat.name })))
              ]}
              style={{ minWidth: 150 }}
            />
            <Select
              value={filterStatus}
              onChange={(val) => setFilterStatus(String(val))}
              options={[
                { value: 'ALL', label: 'Semua Kondisi' },
                { value: 'KRITIS', label: 'Stok Menipis' },
                { value: 'AMAN', label: 'Stok Aman' }
              ]}
              style={{ minWidth: 140 }}
            />
            <Select
              value={itemsPerPage.toString()}
              onChange={(val) => {
                setItemsPerPage(Number(val));
                setCurrentPage(1);
              }}
              options={[
                { value: '20', label: '20' },
                { value: '50', label: '50' },
                { value: '100', label: '100' }
              ]}
              style={{ width: 70 }}
            />
          </div>
        </div>

        <div className="card-body flush">
          {loading ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Memuat data...</div>
          ) : data.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>
              <h4>Belum ada data</h4>
              <p>Data stok gabungan tidak ditemukan.</p>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <Table>
                  <thead>
                    <tr>
                      <th rowSpan={2} style={{ padding: '8px 12px', fontSize: 11, width: 250, minWidth: 250, maxWidth: 250, position: 'sticky', left: 0, zIndex: 20, background: '#fff', verticalAlign: 'middle', borderRight: '1px solid #e2e8f0' }}>Bahan / Produk</th>
                      <th colSpan={2} className="center" style={{ padding: '8px 12px', fontSize: 11, position: 'sticky', left: 250, zIndex: 20, background: '#fff', whiteSpace: 'nowrap', textAlign: 'center', borderRight: '1px solid #e2e8f0', boxShadow: '2px 0 4px -2px rgba(0,0,0,0.1)' }}>Pusat</th>
                      {outlets.map(o => (
                        <th key={o.id} colSpan={2} className="center" style={{ padding: '8px 12px', fontSize: 11, whiteSpace: 'nowrap', textAlign: 'center', borderLeft: '1px solid #e2e8f0' }}>{o.name}</th>
                      ))}
                      <th colSpan={2} className="center" style={{ padding: '8px 12px', fontSize: 11, whiteSpace: 'nowrap', textAlign: 'center', borderLeft: '1px solid #e2e8f0' }}>Total Outlet</th>
                      <th colSpan={2} className="center" style={{ padding: '8px 12px', fontSize: 11, whiteSpace: 'nowrap', textAlign: 'center', borderLeft: '1px solid #e2e8f0' }}>Total Keseluruhan</th>
                    </tr>
                    <tr>
                      <th className="right" style={{ padding: '6px 12px', fontSize: 10, width: 100, minWidth: 100, position: 'sticky', left: 250, zIndex: 20, background: '#fff', whiteSpace: 'nowrap' }}>Stok</th>
                      <th className="right" style={{ padding: '6px 12px', fontSize: 10, width: 120, minWidth: 120, position: 'sticky', left: 350, zIndex: 20, background: '#fff', whiteSpace: 'nowrap', borderRight: '1px solid #e2e8f0', boxShadow: '2px 0 4px -2px rgba(0,0,0,0.1)' }}>Nilai (Rp)</th>
                      {outlets.map(o => (
                        <Fragment key={o.id}>
                          <th className="right" style={{ padding: '6px 12px', fontSize: 10, whiteSpace: 'nowrap', minWidth: 100, borderLeft: '1px solid #e2e8f0' }}>Stok</th>
                          <th className="right" style={{ padding: '6px 12px', fontSize: 10, whiteSpace: 'nowrap', minWidth: 100 }}>Nilai (Rp)</th>
                        </Fragment>
                      ))}
                      <th className="right" style={{ padding: '6px 12px', fontSize: 10, whiteSpace: 'nowrap', borderLeft: '1px solid #e2e8f0' }}>Stok</th>
                      <th className="right" style={{ padding: '6px 12px', fontSize: 10, whiteSpace: 'nowrap' }}>Nilai (Rp)</th>
                      <th className="right" style={{ padding: '6px 12px', fontSize: 10, whiteSpace: 'nowrap', borderLeft: '1px solid #e2e8f0' }}>Stok</th>
                      <th className="right" style={{ padding: '6px 12px', fontSize: 10, whiteSpace: 'nowrap' }}>Nilai (Rp)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.map(item => {
                      const central = Number(item.central_stock);
                      const outlet = Number(item.outlet_stock);
                      const total = central + outlet;
                      const ratio = Number(item.conversion_ratio) || 1;

                      let valOutlet = 0;
                      for (const o of outlets) {
                        const oStock = Number(item.outlet_stocks_map?.[o.id] || 0);
                        valOutlet += (Math.max(0, oStock) / ratio) * Math.round(Number(item.current_average_price) * ratio);
                      }
                      const valPusat = (Math.max(0, central) / ratio) * Math.round(Number(item.current_average_price) * ratio);
                      const valTotal = valPusat + valOutlet;

                      const fmt = (val: number) => {
                        const largeVal = val / ratio;
                        return (
                          <div style={{ whiteSpace: 'nowrap' }}>
                            <div className="font-bold" style={{ fontSize: 12 }}>{largeVal.toLocaleString('id-ID', { maximumFractionDigits: 2 })} <span className="muted font-normal" style={{ fontSize: 10 }}>{item.purchase_unit}</span></div>
                            {ratio > 1 && (
                              <div className="muted" style={{ fontSize: 10 }}>
                                ({val.toLocaleString('id-ID')} {item.smallest_unit})
                              </div>
                            )}
                          </div>
                        );
                      };

                      const fmtRupiah = (val: number) => {
                        return <div style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{val.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</div>;
                      };

                      let totalColor = 'var(--primary)'; // Default hijau
                      const minStock = Number(item.minimum_threshold);
                      if (minStock > 0) {
                        if (total <= minStock) totalColor = '#ef4444'; // Kritis
                        else if (total <= minStock * 1.5) totalColor = '#eab308'; // Menipis
                      } else if (total < 0) {
                        totalColor = '#ef4444'; // Minus
                      }

                      return (
                        <tr key={item.id}>
                          <td className="font-bold" style={{ padding: '8px 12px', fontSize: 12, whiteSpace: 'normal', wordWrap: 'break-word', width: 250, minWidth: 250, maxWidth: 250, position: 'sticky', left: 0, zIndex: 10, background: '#fff', borderRight: '1px solid #e2e8f0' }}>{item.item_name}</td>
                          <td className="right" style={{ padding: '8px 12px', position: 'sticky', left: 250, zIndex: 10, background: '#fff' }}>{fmt(central)}</td>
                          <td className="right" style={{ padding: '8px 12px', position: 'sticky', left: 350, zIndex: 10, background: '#fff', borderRight: '1px solid #e2e8f0', boxShadow: '2px 0 4px -2px rgba(0,0,0,0.1)' }}>{fmtRupiah(valPusat)}</td>
                          
                          {outlets.map(o => {
                            const oStock = Number(item.outlet_stocks_map?.[o.id] || 0);
                            const oVal = (Math.max(0, oStock) / ratio) * Math.round(Number(item.current_average_price) * ratio);
                            return (
                              <Fragment key={o.id}>
                                <td className="right" style={{ padding: '8px 12px', background: '#f8fafc', borderLeft: '1px solid #e2e8f0' }}>
                                  {fmt(oStock)}
                                </td>
                                <td className="right" style={{ padding: '8px 12px', background: '#f8fafc' }}>
                                  {fmtRupiah(oVal)}
                                </td>
                              </Fragment>
                            );
                          })}

                          <td className="right" style={{ padding: '8px 12px', borderLeft: '1px solid #e2e8f0' }}>{fmt(outlet)}</td>
                          <td className="right" style={{ padding: '8px 12px' }}>{fmtRupiah(valOutlet)}</td>
                          <td className="right" style={{ padding: '8px 12px', borderLeft: '1px solid #e2e8f0' }}>
                            <div style={{ color: totalColor }}>
                              {fmt(total)}
                            </div>
                          </td>
                          <td className="right" style={{ padding: '8px 12px' }}>
                            <div style={{ color: totalColor, fontWeight: 'bold' }}>
                              {fmtRupiah(valTotal)}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
              <div style={{ padding: '16px 24px' }}>
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={data.length}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
