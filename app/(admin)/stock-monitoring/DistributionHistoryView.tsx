'use client';
import { useState, useEffect, Fragment } from 'react';
import { Table } from '@/components/ui/Table';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { BarChart2, List, FileText, Loader2 } from 'lucide-react';
import { Toast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';

interface DO {
  id: number;
  number: string;
  date: string;
  value: number;
  qty: number;
}

interface DistributionOutlet {
  outlet_id: number;
  outlet_name: string;
  total_value: number;
  total_qty: number;
  last_delivery_date: string | null;
  delivery_orders: DO[];
}

export function DistributionHistoryView() {
  const [data, setData] = useState<DistributionOutlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'7days' | '30days' | 'custom'>('30days');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('table');
  const [selectedOutlet, setSelectedOutlet] = useState<DistributionOutlet | null>(null);
  const [toast, setToast] = useState({ open: false, message: '', type: 'success' as 'success' | 'error' | 'info' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/distribution-history?start_date=${startDate}&end_date=${endDate}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        throw new Error(json.message);
      }
    } catch (err: any) {
      setToast({ open: true, message: err.message || 'Gagal mengambil data histori', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (filter === '7days') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(new Date().toISOString().split('T')[0]);
    } else if (filter === '30days') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(new Date().toISOString().split('T')[0]);
    }
  }, [filter]);

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);


  const chartData = data.map(d => ({
    name: d.outlet_name.replace(/coffeelab|coffee lab|coffelab/i, '').trim(),
    Total: d.total_value
  })).sort((a, b) => b.Total - a.Total); // Sort highest first

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header & Controls */}
      <div style={{ padding: '20px', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Select
            value={filter}
            onChange={(v) => setFilter(v as any)}
            options={[
              { value: '7days', label: '7 Hari Terakhir' },
              { value: '30days', label: '30 Hari Terakhir' },
              { value: 'custom', label: 'Kustom Tanggal' }
            ]}
            style={{ width: 160 }}
          />

          {filter === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input" style={{ padding: '6px 12px', fontSize: 13 }} />
              <span>-</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input" style={{ padding: '6px 12px', fontSize: 13 }} />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', background: '#f1f5f9', padding: 4, borderRadius: 6 }}>
          <button
            onClick={() => setViewMode('table')}
            style={{ padding: '6px 12px', borderRadius: 4, border: 'none', background: viewMode === 'table' ? '#fff' : 'transparent', color: viewMode === 'table' ? '#016e3f' : '#64748b', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: viewMode === 'table' ? 600 : 500, cursor: 'pointer', boxShadow: viewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
          >
            <List size={16} /> Tabel Detail
          </button>
          <button
            onClick={() => setViewMode('chart')}
            style={{ padding: '6px 12px', borderRadius: 4, border: 'none', background: viewMode === 'chart' ? '#fff' : 'transparent', color: viewMode === 'chart' ? '#016e3f' : '#64748b', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: viewMode === 'chart' ? 600 : 500, cursor: 'pointer', boxShadow: viewMode === 'chart' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
          >
            <BarChart2 size={16} /> Grafik
          </button>
        </div>
      </div>

      <div style={{ padding: '0 20px 20px' }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#64748b', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <Loader2 className="animate-spin" size={24} /> Memuat data histori...
          </div>
        ) : data.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8', background: '#fff', borderRadius: 8, border: '1px dashed #cbd5e1' }}>
            Tidak ada riwayat pengiriman pada rentang waktu ini.
          </div>
        ) : viewMode === 'chart' ? (
          <div style={{ background: '#fff', padding: 24, borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <h3 style={{ marginBottom: 24, fontSize: 15, fontWeight: 600, color: '#0f172a' }}>Nilai Distribusi Aset per Outlet</h3>
            <div style={{ width: '100%', height: 400 }}>
              <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} angle={-45} textAnchor="end" />
                  <YAxis 
                    tickFormatter={(value) => `Rp ${(value / 1000000).toFixed(1)}M`}
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: '#64748b' }} 
                  />
                  <Tooltip 
                    formatter={(value: any) => [formatRupiah(value as number), 'Total Nilai']}
                    contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}
                  />
                  <Bar dataKey="Total" fill="#016e3f" radius={[4, 4, 0, 0]} maxBarSize={60} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <Table>
              <thead>
                <tr>
                  <th>Nama Outlet</th>
                  <th className="right">Total Jenis Barang</th>
                  <th className="right">Total Nilai (Rp)</th>
                  <th className="right">Rata-rata Nilai / DO</th>
                  <th className="center">DO Terakhir</th>
                  <th className="center">Jumlah Surat Jalan</th>
                </tr>
              </thead>
              <tbody>
                {data.map(item => (
                  <tr 
                    key={item.outlet_id} 
                    onClick={() => setSelectedOutlet(item)}
                    style={{ cursor: 'pointer' }}
                    className="hover:bg-gray-50"
                  >
                    <td className="font-bold">{item.outlet_name}</td>
                    <td className="right">{new Intl.NumberFormat('id-ID').format(item.total_qty)} Item</td>
                    <td className="right font-bold" style={{ color: '#016e3f' }}>{formatRupiah(item.total_value)}</td>
                    <td className="right">{item.delivery_orders.length > 0 ? formatRupiah(item.total_value / item.delivery_orders.length) : '-'}</td>
                    <td className="center">{item.last_delivery_date ? new Date(item.last_delivery_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}</td>
                    <td className="center font-bold" style={{ color: '#64748b' }}>
                      {item.delivery_orders.length} DO
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </div>
      <Toast 
        isOpen={toast.open} 
        message={toast.message} 
        type={toast.type}
        onClose={() => setToast({ ...toast, open: false })}
      />

      {selectedOutlet && (
        <Modal 
          isOpen={!!selectedOutlet} 
          onClose={() => setSelectedOutlet(null)} 
          title={`Rincian DO: ${selectedOutlet.outlet_name}`}
        >
          <div style={{ padding: '0 20px 20px' }}>
            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Total Nilai Distribusi</div>
                <div style={{ fontSize: 18, color: '#016e3f', fontWeight: 700 }}>{formatRupiah(selectedOutlet.total_value)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Jumlah DO</div>
                <div style={{ fontSize: 18, color: '#0f172a', fontWeight: 700 }}>{selectedOutlet.delivery_orders.length}</div>
              </div>
            </div>

            <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
              {selectedOutlet.delivery_orders.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '10px 16px', textAlign: 'left', color: '#64748b' }}>No. Surat Jalan</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', color: '#64748b' }}>Tanggal</th>
                      <th style={{ padding: '10px 16px', textAlign: 'right', color: '#64748b' }}>Nilai Aset</th>
                      <th style={{ padding: '10px 16px', textAlign: 'center', color: '#64748b' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOutlet.delivery_orders.map(doItem => (
                      <tr key={doItem.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 500 }}>{doItem.number}</td>
                        <td style={{ padding: '12px 16px', color: '#475569' }}>{new Date(doItem.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>{formatRupiah(doItem.value)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <button 
                            onClick={() => window.open(`/api/delivery-notes/${doItem.id}/pdf`, '_blank')}
                            className="btn btn-outline"
                            style={{ padding: '6px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 6 }}
                          >
                            <FileText size={14} /> Lihat PDF
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Tidak ada detail surat jalan.</div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
