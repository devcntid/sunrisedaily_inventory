'use client';
import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import { Table } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { Search, Download, AlertTriangle, Clock, CheckCircle2, Building2, Store } from 'lucide-react';
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
  expired_date?: string | null;
  outlet_stocks_map: Record<string, string>;
}

export function CombinedStockView({ categories = [] }: { categories?: { id: number, name: string }[] }) {
  const [data, setData] = useState<CombinedStock[]>([]);
  const [outlets, setOutlets] = useState<{ id: number, name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterOutlet, setFilterOutlet] = useState('ALL');
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
  }, [search, filterOutlet, filterCategory, filterStatus]);

  const selectedOutletObj = useMemo(() => {
    if (filterOutlet === 'ALL' || filterOutlet === 'CENTRAL') return null;
    return outlets.find(o => String(o.id) === filterOutlet);
  }, [outlets, filterOutlet]);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      // Search
      const matchSearch = item.item_name.toLowerCase().includes(search.toLowerCase());
      if (!matchSearch) return false;

      // Category
      if (filterCategory !== 'ALL' && String(item.category_id) !== filterCategory) return false;

      // Status
      if (filterStatus !== 'ALL') {
        const central = Number(item.central_stock);
        let relevantStock = central;

        if (filterOutlet === 'ALL') {
          relevantStock = central + Number(item.outlet_stock);
        } else if (filterOutlet === 'CENTRAL') {
          relevantStock = central;
        } else {
          relevantStock = Number(item.outlet_stocks_map?.[filterOutlet] || 0);
        }

        let status = 'AMAN';
        const minStock = Number(item.minimum_threshold);
        if (minStock > 0) {
          if (relevantStock <= minStock) status = 'KRITIS';
          else if (relevantStock <= minStock * 1.5) status = 'MENIPIS';
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
  }, [data, search, filterCategory, filterStatus, filterOutlet]);

  // Asset Calculation Summaries
  const assetMetrics = useMemo(() => {
    const totalPusat = data.reduce((sum, item) => {
      const r = Number(item.conversion_ratio) || 1;
      return sum + (Math.max(0, Number(item.central_stock)) / r) * Math.round(Number(item.current_average_price) * r);
    }, 0);

    const totalAllOutlets = data.reduce((sum, item) => {
      const r = Number(item.conversion_ratio) || 1;
      let val = 0;
      for (const o of outlets) {
        val += (Math.max(0, Number(item.outlet_stocks_map?.[o.id] || 0)) / r) * Math.round(Number(item.current_average_price) * r);
      }
      return sum + val;
    }, 0);

    const grandTotal = totalPusat + totalAllOutlets;

    let selectedOutletAsset = 0;
    let selectedOutletSkuCount = 0;
    let selectedOutletCriticalAsset = 0;

    if (filterOutlet !== 'ALL' && filterOutlet !== 'CENTRAL') {
      data.forEach(item => {
        const r = Number(item.conversion_ratio) || 1;
        const stock = Number(item.outlet_stocks_map?.[filterOutlet] || 0);
        const val = (Math.max(0, stock) / r) * Math.round(Number(item.current_average_price) * r);
        if (stock > 0) {
          selectedOutletSkuCount += 1;
        }
        selectedOutletAsset += val;

        const minStock = Number(item.minimum_threshold);
        if (minStock > 0 && stock <= minStock) {
          selectedOutletCriticalAsset += val;
        }
      });
    }

    let centralSkuCount = 0;
    let centralCriticalAsset = 0;
    if (filterOutlet === 'CENTRAL') {
      data.forEach(item => {
        const r = Number(item.conversion_ratio) || 1;
        const stock = Number(item.central_stock || 0);
        const val = (Math.max(0, stock) / r) * Math.round(Number(item.current_average_price) * r);
        if (stock > 0) centralSkuCount += 1;
        const minStock = Number(item.minimum_threshold);
        if (minStock > 0 && stock <= minStock) {
          centralCriticalAsset += val;
        }
      });
    }

    return {
      totalPusat,
      totalAllOutlets,
      grandTotal,
      selectedOutletAsset,
      selectedOutletSkuCount,
      selectedOutletCriticalAsset,
      centralSkuCount,
      centralCriticalAsset,
    };
  }, [data, outlets, filterOutlet]);

  const handleExport = () => {
    let exportData: Record<string, any>[] = [];

    if (filterOutlet === 'ALL') {
      exportData = filteredData.map(item => {
        const central = Number(item.central_stock);
        const ratio = Number(item.conversion_ratio) || 1;
        const valPusat = (Math.max(0, central) / ratio) * Math.round(Number(item.current_average_price) * ratio);
        
        const row: Record<string, any> = {
          'Bahan / Produk': item.item_name,
          'Expired Date Terdekat': item.expired_date ? new Date(item.expired_date).toLocaleDateString('id-ID') : '',
          'Pusat (Stok)': `${(central / ratio).toLocaleString('id-ID')} ${item.purchase_unit}`,
          'Pusat (Nilai Rp)': valPusat,
        };

        let valOutlet = 0;
        for (const o of outlets) {
          const oStock = Number(item.outlet_stocks_map?.[o.id] || 0);
          const oVal = (Math.max(0, oStock) / ratio) * Math.round(Number(item.current_average_price) * ratio);
          const simpleName = o.name.replace(/coffeelab|coffee lab|coffelab/i, '').replace(/,/g, '').replace(/\s+/g, ' ').trim();
          row[`${simpleName} (Stok)`] = `${(oStock / ratio).toLocaleString('id-ID')} ${item.purchase_unit}`;
          row[`${simpleName} (Nilai Rp)`] = oVal;
          valOutlet += oVal;
        }

        row['Total Nilai Outlet (Rp)'] = valOutlet;
        row['Grand Total Nilai (Rp)'] = valPusat + valOutlet;
        return row;
      });
    } else if (filterOutlet === 'CENTRAL') {
      exportData = filteredData.map(item => {
        const central = Number(item.central_stock);
        const ratio = Number(item.conversion_ratio) || 1;
        const valPusat = (Math.max(0, central) / ratio) * Math.round(Number(item.current_average_price) * ratio);

        return {
          'Bahan / Produk': item.item_name,
          'Expired Date Terdekat': item.expired_date ? new Date(item.expired_date).toLocaleDateString('id-ID') : '',
          'Stok Gudang Pusat': `${(central / ratio).toLocaleString('id-ID')} ${item.purchase_unit}`,
          'Harga Rata-rata (HPP)': Math.round(Number(item.current_average_price) * ratio),
          'Total Nilai Aset Pusat (Rp)': valPusat,
        };
      });
    } else {
      const oName = selectedOutletObj?.name || 'Outlet';
      exportData = filteredData.map(item => {
        const ratio = Number(item.conversion_ratio) || 1;
        const oStock = Number(item.outlet_stocks_map?.[filterOutlet] || 0);
        const oVal = (Math.max(0, oStock) / ratio) * Math.round(Number(item.current_average_price) * ratio);
        const central = Number(item.central_stock);
        const valPusat = (Math.max(0, central) / ratio) * Math.round(Number(item.current_average_price) * ratio);

        return {
          'Bahan / Produk': item.item_name,
          'Expired Date Terdekat': item.expired_date ? new Date(item.expired_date).toLocaleDateString('id-ID') : '',
          [`Stok ${oName}`]: `${(oStock / ratio).toLocaleString('id-ID')} ${item.purchase_unit}`,
          [`Nilai Aset ${oName} (Rp)`]: oVal,
          'Stok Gudang Pusat': `${(central / ratio).toLocaleString('id-ID')} ${item.purchase_unit}`,
          'Nilai Aset Pusat (Rp)': valPusat,
        };
      });
    }

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    const sheetName = filterOutlet === 'ALL' ? 'Aset_Semua_Lokasi' : filterOutlet === 'CENTRAL' ? 'Aset_Pusat' : 'Aset_Outlet';
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    const filename = filterOutlet === 'ALL'
      ? `Rekap_Aset_Semua_Lokasi_${new Date().toISOString().split('T')[0]}.xlsx`
      : filterOutlet === 'CENTRAL'
      ? `Rekap_Aset_Gudang_Pusat_${new Date().toISOString().split('T')[0]}.xlsx`
      : `Rekap_Aset_${(selectedOutletObj?.name || 'Outlet').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;

    XLSX.writeFile(workbook, filename);
  };

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <>
      <div className="card-body p-0">
        {/* Dynamic KPI Summary Cards */}
        {!loading && data.length > 0 && (
          <div style={{ padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {filterOutlet === 'ALL' ? (
              <>
                <div style={{ background: '#fff', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Aset Gudang Pusat</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a' }}>
                    Rp {assetMetrics.totalPusat.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                  </div>
                </div>
                <div style={{ background: '#fff', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Aset Seluruh Outlet ({outlets.length} Cabang)</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a' }}>
                    Rp {assetMetrics.totalAllOutlets.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                  </div>
                </div>
                <div style={{ background: '#016e3f', padding: '10px 14px', borderRadius: 8, color: '#fff', boxShadow: '0 2px 4px rgba(1,110,63,0.15)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#a7f3d0', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Grand Total Aset Perusahaan</div>
                  <div style={{ fontSize: 17, fontWeight: 800 }}>
                    Rp {assetMetrics.grandTotal.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                  </div>
                </div>
              </>
            ) : filterOutlet === 'CENTRAL' ? (
              <>
                <div style={{ background: '#fff', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Nilai Aset Gudang Pusat</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#016e3f' }}>
                    Rp {assetMetrics.totalPusat.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                  </div>
                </div>
                <div style={{ background: '#fff', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Item Tersedia di Pusat</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a' }}>
                    {assetMetrics.centralSkuCount} <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>SKU Barang</span>
                  </div>
                </div>
                <div style={{ background: '#016e3f', padding: '10px 14px', borderRadius: 8, color: '#fff', boxShadow: '0 2px 4px rgba(1,110,63,0.15)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#a7f3d0', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Kontribusi dari Total Aset</div>
                  <div style={{ fontSize: 17, fontWeight: 800 }}>
                    {assetMetrics.grandTotal > 0 ? ((assetMetrics.totalPusat / assetMetrics.grandTotal) * 100).toFixed(1) : 0}% <span style={{ fontSize: 12, fontWeight: 500, color: '#d1fae5' }}>dari total perusahaan</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div style={{ background: '#fff', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Total Nilai Aset ({selectedOutletObj?.name || 'Outlet'})
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#016e3f' }}>
                    Rp {assetMetrics.selectedOutletAsset.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                  </div>
                </div>
                <div style={{ background: '#fff', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Barang dengan Stok Aktif
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a' }}>
                    {assetMetrics.selectedOutletSkuCount} <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>SKU Barang</span>
                  </div>
                </div>
                <div style={{ background: '#016e3f', padding: '10px 14px', borderRadius: 8, color: '#fff', boxShadow: '0 2px 4px rgba(1,110,63,0.15)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#a7f3d0', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Porsi dari Aset Seluruh Cabang
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 800 }}>
                    {assetMetrics.totalAllOutlets > 0 ? ((assetMetrics.selectedOutletAsset / assetMetrics.totalAllOutlets) * 100).toFixed(1) : 0}% <span style={{ fontSize: 12, fontWeight: 500, color: '#d1fae5' }}>dari aset outlet</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Filter Toolbar */}
        <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div className="text-gray-500 font-medium" style={{ fontSize: 12 }}>
              {filterOutlet === 'ALL'
                ? 'Detail Stok & Aset Seluruh Lokasi'
                : filterOutlet === 'CENTRAL'
                ? 'Detail Stok & Aset Gudang Pusat'
                : `Detail Stok & Aset: ${selectedOutletObj?.name}`}
            </div>
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
                style={{ width: 170, padding: '6px 12px 6px 30px', fontSize: 12 }}
              />
            </div>

            {/* Filter Outlet */}
            <Select
              value={filterOutlet}
              onChange={(val) => setFilterOutlet(String(val))}
              options={[
                { value: 'ALL', label: 'Semua Lokasi' },
                { value: 'CENTRAL', label: 'Gudang Pusat' },
                ...outlets.map(o => ({ value: String(o.id), label: o.name }))
              ]}
              searchable={true}
              style={{ minWidth: 165 }}
              inputStyle={{ height: 32, fontSize: 12 }}
            />

            <Select
              value={filterCategory}
              onChange={(val) => setFilterCategory(String(val))}
              options={[
                { value: 'ALL', label: 'Semua Kategori' },
                ...(categories.map((cat) => ({ value: cat.id.toString(), label: cat.name })))
              ]}
              searchable={true}
              style={{ minWidth: 145 }}
              inputStyle={{ height: 32, fontSize: 12 }}
            />

            <Select
              value={filterStatus}
              onChange={(val) => setFilterStatus(String(val))}
              options={[
                { value: 'ALL', label: 'Semua Kondisi' },
                { value: 'KRITIS', label: 'Stok Menipis' },
                { value: 'AMAN', label: 'Stok Aman' }
              ]}
              style={{ minWidth: 130 }}
              inputStyle={{ height: 32, fontSize: 12 }}
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
              inputStyle={{ height: 32, fontSize: 12 }}
            />
          </div>
        </div>

        {/* Table Content */}
        <div className="card-body flush">
          {loading ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Memuat data...</div>
          ) : filteredData.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>
              <h4>Belum ada data</h4>
              <p>Data stok gabungan tidak ditemukan dengan filter yang dipilih.</p>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <Table>
                  <thead>
                    {filterOutlet === 'ALL' ? (
                      <>
                        <tr>
                          <th rowSpan={2} style={{ padding: '8px 12px', fontSize: 11, width: 250, minWidth: 250, maxWidth: 250, position: 'sticky', left: 0, zIndex: 20, background: '#fff', verticalAlign: 'middle', borderRight: '1px solid #e2e8f0' }}>Bahan / Produk</th>
                          <th rowSpan={2} style={{ padding: '8px 12px', fontSize: 11, width: 140, minWidth: 140, maxWidth: 140, position: 'sticky', left: 250, zIndex: 20, background: '#fff', verticalAlign: 'middle', borderRight: '1px solid #e2e8f0', textAlign: 'center' }}>Expired Date</th>
                          <th colSpan={2} className="center" style={{ padding: '8px 12px', fontSize: 11, position: 'sticky', left: 390, zIndex: 20, background: '#fff', whiteSpace: 'nowrap', textAlign: 'center', borderRight: '1px solid #e2e8f0', boxShadow: '2px 0 4px -2px rgba(0,0,0,0.1)' }}>Pusat</th>
                          {outlets.map(o => (
                            <th key={o.id} colSpan={2} className="center" style={{ padding: '8px 12px', fontSize: 11, whiteSpace: 'nowrap', textAlign: 'center', borderLeft: '1px solid #e2e8f0' }}>{o.name}</th>
                          ))}
                          <th colSpan={2} className="center" style={{ padding: '8px 12px', fontSize: 11, whiteSpace: 'nowrap', textAlign: 'center', borderLeft: '1px solid #e2e8f0' }}>Total Outlet</th>
                          <th colSpan={2} className="center" style={{ padding: '8px 12px', fontSize: 11, whiteSpace: 'nowrap', textAlign: 'center', borderLeft: '1px solid #e2e8f0' }}>Total Keseluruhan</th>
                        </tr>
                        <tr>
                          <th className="right" style={{ padding: '6px 12px', fontSize: 10, width: 100, minWidth: 100, position: 'sticky', left: 390, zIndex: 20, background: '#fff', whiteSpace: 'nowrap' }}>Stok</th>
                          <th className="right" style={{ padding: '6px 12px', fontSize: 10, width: 120, minWidth: 120, position: 'sticky', left: 490, zIndex: 20, background: '#fff', whiteSpace: 'nowrap', borderRight: '1px solid #e2e8f0', boxShadow: '2px 0 4px -2px rgba(0,0,0,0.1)' }}>Nilai (Rp)</th>
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
                      </>
                    ) : filterOutlet === 'CENTRAL' ? (
                      <>
                        <tr>
                          <th rowSpan={2} style={{ padding: '8px 12px', fontSize: 11, width: 250, minWidth: 250, maxWidth: 250, position: 'sticky', left: 0, zIndex: 20, background: '#fff', verticalAlign: 'middle', borderRight: '1px solid #e2e8f0' }}>Bahan / Produk</th>
                          <th rowSpan={2} style={{ padding: '8px 12px', fontSize: 11, width: 140, minWidth: 140, maxWidth: 140, position: 'sticky', left: 250, zIndex: 20, background: '#fff', verticalAlign: 'middle', borderRight: '1px solid #e2e8f0', textAlign: 'center' }}>Expired Date</th>
                          <th colSpan={2} className="center" style={{ padding: '8px 12px', fontSize: 11, background: '#f0fdf4', color: '#166534', whiteSpace: 'nowrap', textAlign: 'center', borderLeft: '1px solid #bbf7d0' }}>Gudang Pusat</th>
                          <th colSpan={2} className="center" style={{ padding: '8px 12px', fontSize: 11, whiteSpace: 'nowrap', textAlign: 'center', borderLeft: '1px solid #e2e8f0' }}>Total Seluruh Outlet</th>
                          <th colSpan={2} className="center" style={{ padding: '8px 12px', fontSize: 11, whiteSpace: 'nowrap', textAlign: 'center', borderLeft: '1px solid #e2e8f0' }}>Grand Total</th>
                        </tr>
                        <tr>
                          <th className="right" style={{ padding: '6px 12px', fontSize: 10, background: '#f0fdf4', color: '#166534', borderLeft: '1px solid #bbf7d0' }}>Stok Pusat</th>
                          <th className="right" style={{ padding: '6px 12px', fontSize: 10, background: '#f0fdf4', color: '#166534' }}>Nilai Aset (Rp)</th>
                          <th className="right" style={{ padding: '6px 12px', fontSize: 10, borderLeft: '1px solid #e2e8f0' }}>Stok</th>
                          <th className="right" style={{ padding: '6px 12px', fontSize: 10 }}>Nilai (Rp)</th>
                          <th className="right" style={{ padding: '6px 12px', fontSize: 10, borderLeft: '1px solid #e2e8f0' }}>Stok</th>
                          <th className="right" style={{ padding: '6px 12px', fontSize: 10 }}>Nilai (Rp)</th>
                        </tr>
                      </>
                    ) : (
                      <>
                        <tr>
                          <th rowSpan={2} style={{ padding: '8px 12px', fontSize: 11, width: 250, minWidth: 250, maxWidth: 250, position: 'sticky', left: 0, zIndex: 20, background: '#fff', verticalAlign: 'middle', borderRight: '1px solid #e2e8f0' }}>Bahan / Produk</th>
                          <th rowSpan={2} style={{ padding: '8px 12px', fontSize: 11, width: 140, minWidth: 140, maxWidth: 140, position: 'sticky', left: 250, zIndex: 20, background: '#fff', verticalAlign: 'middle', borderRight: '1px solid #e2e8f0', textAlign: 'center' }}>Expired Date</th>
                          <th colSpan={2} className="center" style={{ padding: '8px 12px', fontSize: 11, background: '#ecfdf5', color: '#016e3f', whiteSpace: 'nowrap', textAlign: 'center', borderLeft: '1px solid #a7f3d0' }}>
                            {selectedOutletObj?.name || 'Outlet Terpilih'}
                          </th>
                          <th colSpan={2} className="center" style={{ padding: '8px 12px', fontSize: 11, whiteSpace: 'nowrap', textAlign: 'center', borderLeft: '1px solid #e2e8f0' }}>Gudang Pusat</th>
                          <th colSpan={2} className="center" style={{ padding: '8px 12px', fontSize: 11, whiteSpace: 'nowrap', textAlign: 'center', borderLeft: '1px solid #e2e8f0' }}>Total Keseluruhan</th>
                        </tr>
                        <tr>
                          <th className="right" style={{ padding: '6px 12px', fontSize: 10, background: '#ecfdf5', color: '#016e3f', borderLeft: '1px solid #a7f3d0' }}>Stok Outlet</th>
                          <th className="right" style={{ padding: '6px 12px', fontSize: 10, background: '#ecfdf5', color: '#016e3f' }}>Nilai Aset (Rp)</th>
                          <th className="right" style={{ padding: '6px 12px', fontSize: 10, borderLeft: '1px solid #e2e8f0' }}>Stok Pusat</th>
                          <th className="right" style={{ padding: '6px 12px', fontSize: 10 }}>Nilai (Rp)</th>
                          <th className="right" style={{ padding: '6px 12px', fontSize: 10, borderLeft: '1px solid #e2e8f0' }}>Stok</th>
                          <th className="right" style={{ padding: '6px 12px', fontSize: 10 }}>Nilai (Rp)</th>
                        </tr>
                      </>
                    )}
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

                      const selectedOutletStock = filterOutlet !== 'ALL' && filterOutlet !== 'CENTRAL'
                        ? Number(item.outlet_stocks_map?.[filterOutlet] || 0)
                        : 0;
                      const selectedOutletVal = (Math.max(0, selectedOutletStock) / ratio) * Math.round(Number(item.current_average_price) * ratio);

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

                      let totalColor = 'var(--primary)';
                      const minStock = Number(item.minimum_threshold);
                      if (minStock > 0) {
                        if (total <= minStock) totalColor = '#ef4444';
                        else if (total <= minStock * 1.5) totalColor = '#eab308';
                      } else if (total < 0) {
                        totalColor = '#ef4444';
                      }

                      const getExpBadge = (expStr?: string | null) => {
                        if (!expStr) return null;
                        const exp = new Date(expStr);
                        const now = new Date();
                        exp.setHours(0,0,0,0);
                        now.setHours(0,0,0,0);
                        const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                        const formatted = exp.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
                        if (diffDays <= 0) return <span style={{ fontSize: 10, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>{formatted}</span>;
                        if (diffDays <= 30) return <span style={{ fontSize: 10, color: '#d97706', background: '#fffbeb', border: '1px solid #fde68a', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>{formatted}</span>;
                        return <span style={{ fontSize: 10, color: '#166534', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>{formatted}</span>;
                      };

                      if (filterOutlet === 'ALL') {
                        return (
                          <tr key={item.id}>
                            <td className="font-bold" style={{ padding: '8px 12px', fontSize: 12, whiteSpace: 'normal', wordWrap: 'break-word', width: 250, minWidth: 250, maxWidth: 250, position: 'sticky', left: 0, zIndex: 10, background: '#fff', borderRight: '1px solid #e2e8f0' }}>
                              {item.item_name}
                            </td>
                            <td className="center" style={{ padding: '8px 8px', width: 140, minWidth: 140, maxWidth: 140, position: 'sticky', left: 250, zIndex: 10, background: '#fff', borderRight: '1px solid #e2e8f0' }}>
                              {getExpBadge(item.expired_date)}
                            </td>
                            <td className="right" style={{ padding: '8px 12px', position: 'sticky', left: 390, zIndex: 10, background: '#fff' }}>{fmt(central)}</td>
                            <td className="right" style={{ padding: '8px 12px', position: 'sticky', left: 490, zIndex: 10, background: '#fff', borderRight: '1px solid #e2e8f0', boxShadow: '2px 0 4px -2px rgba(0,0,0,0.1)' }}>{fmtRupiah(valPusat)}</td>
                            
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
                      }

                      if (filterOutlet === 'CENTRAL') {
                        return (
                          <tr key={item.id}>
                            <td className="font-bold" style={{ padding: '8px 12px', fontSize: 12, whiteSpace: 'normal', wordWrap: 'break-word', width: 250, minWidth: 250, maxWidth: 250, position: 'sticky', left: 0, zIndex: 10, background: '#fff', borderRight: '1px solid #e2e8f0' }}>
                              {item.item_name}
                            </td>
                            <td className="center" style={{ padding: '8px 8px', width: 140, minWidth: 140, maxWidth: 140, position: 'sticky', left: 250, zIndex: 10, background: '#fff', borderRight: '1px solid #e2e8f0' }}>
                              {getExpBadge(item.expired_date)}
                            </td>
                            <td className="right" style={{ padding: '8px 12px', background: '#f0fdf4', borderLeft: '1px solid #bbf7d0' }}>{fmt(central)}</td>
                            <td className="right" style={{ padding: '8px 12px', background: '#f0fdf4', fontWeight: 700, color: '#166534' }}>{fmtRupiah(valPusat)}</td>
                            <td className="right" style={{ padding: '8px 12px', borderLeft: '1px solid #e2e8f0' }}>{fmt(outlet)}</td>
                            <td className="right" style={{ padding: '8px 12px' }}>{fmtRupiah(valOutlet)}</td>
                            <td className="right" style={{ padding: '8px 12px', borderLeft: '1px solid #e2e8f0' }}>
                              <div style={{ color: totalColor }}>{fmt(total)}</div>
                            </td>
                            <td className="right" style={{ padding: '8px 12px' }}>
                              <div style={{ color: totalColor, fontWeight: 'bold' }}>{fmtRupiah(valTotal)}</div>
                            </td>
                          </tr>
                        );
                      }

                      // Specific outlet selected
                      return (
                        <tr key={item.id}>
                          <td className="font-bold" style={{ padding: '8px 12px', fontSize: 12, whiteSpace: 'normal', wordWrap: 'break-word', width: 250, minWidth: 250, maxWidth: 250, position: 'sticky', left: 0, zIndex: 10, background: '#fff', borderRight: '1px solid #e2e8f0' }}>
                            {item.item_name}
                          </td>
                          <td className="center" style={{ padding: '8px 8px', width: 140, minWidth: 140, maxWidth: 140, position: 'sticky', left: 250, zIndex: 10, background: '#fff', borderRight: '1px solid #e2e8f0' }}>
                            {getExpBadge(item.expired_date)}
                          </td>
                          <td className="right" style={{ padding: '8px 12px', background: '#ecfdf5', borderLeft: '1px solid #a7f3d0' }}>{fmt(selectedOutletStock)}</td>
                          <td className="right" style={{ padding: '8px 12px', background: '#ecfdf5', fontWeight: 700, color: '#016e3f' }}>{fmtRupiah(selectedOutletVal)}</td>
                          <td className="right" style={{ padding: '8px 12px', borderLeft: '1px solid #e2e8f0' }}>{fmt(central)}</td>
                          <td className="right" style={{ padding: '8px 12px' }}>{fmtRupiah(valPusat)}</td>
                          <td className="right" style={{ padding: '8px 12px', borderLeft: '1px solid #e2e8f0' }}>
                            <div style={{ color: totalColor }}>{fmt(total)}</div>
                          </td>
                          <td className="right" style={{ padding: '8px 12px' }}>
                            <div style={{ color: totalColor, fontWeight: 'bold' }}>{fmtRupiah(valTotal)}</div>
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
                  totalItems={filteredData.length}
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
