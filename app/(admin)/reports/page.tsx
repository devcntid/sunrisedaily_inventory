'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';

export default function ReportsPage() {
    const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
    const [year, setYear] = useState<number>(new Date().getFullYear());
    const [groupingType, setGroupingType] = useState<'category' | 'item'>('category');
    const [reportData, setReportData] = useState<Record<string, unknown>[]>([]);
    const [loading, setLoading] = useState(false);

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



    let grandTotalIn = 0;
    let grandTotalDist = 0;
    let grandTotalAdj = 0;
    let grandTotalValue = 0;

    const dataMap = new Map<string, number>();

    reportData.forEach((r: any) => {
        const ma = Number(r.current_average_price);
        const valIn = Number(r.total_in_qty) * ma;
        const valDist = Number(r.total_distribution_qty) * ma;
        const valAdj = Math.abs(Number(r.total_adj_qty)) * ma;
        const valCurrent = Number(r.current_balance) * ma;

        grandTotalIn += valIn;
        grandTotalDist += valDist;
        grandTotalAdj += valAdj;
        grandTotalValue += valCurrent;

        const key = String(groupingType === 'category'
            ? (r.category_name || 'Tidak Berkategori')
            : (r.item_name || 'Tidak Diketahui'));
      
        dataMap.set(key, (dataMap.get(key) || 0) + valCurrent);
    });

    let chartData = Array.from(dataMap.entries()).map(([name, value]) => ({
        name,
        'Nilai Persediaan': value
    }));

    if (groupingType === 'item') {
        chartData.sort((a, b) => b['Nilai Persediaan'] - a['Nilai Persediaan']);
        chartData = chartData.slice(0, 15);
    }

    return (
        <section className="screen">
            <div className="card">
                <div className="tabs" style={{ marginBottom: 0, overflowX: 'auto', whiteSpace: 'nowrap', display: 'flex', gap: 4 }}>
                    <Link href="/reports" className="tab active" style={{ textDecoration: 'none' }}>Grafik Keuangan</Link>
                    <Link href="/reports/inventory-value" className="tab" style={{ textDecoration: 'none', color: 'inherit' }}>Tabel Persediaan</Link>
                    <Link href="/price-history" className="tab" style={{ textDecoration: 'none', color: 'inherit' }}>Riwayat Harga</Link>
                    <Link href="/sales-report" className="tab" style={{ textDecoration: 'none', color: 'inherit' }}>Ringkasan Moka</Link>
                    <Link href="/sales-report/customers" className="tab" style={{ textDecoration: 'none', color: 'inherit' }}>Pelanggan Moka</Link>
                </div>
        <div className="card-head">
          <div>
            <h3>Grafik Keuangan Pengadaan & Persediaan</h3>
            <p className="muted" style={{ margin: 0, marginTop: 4 }}>Nilai dihitung menggunakan algoritma Moving Average.</p>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Select 
              value={groupingType}
              onChange={(val) => setGroupingType(val as 'category' | 'item')}
              options={[
                { value: 'category', label: 'Berdasarkan Kategori' },
                { value: 'item', label: 'Berdasarkan Barang (Top 15)' }
              ]}
              style={{ width: 220 }}
            />
            <Select 
              value={month} 
              onChange={(val) => setMonth(Number(val))}
              options={Array.from({length: 12}).map((_, i) => ({ value: i+1, label: new Date(0, i).toLocaleString('id-ID', { month: 'long' }) }))}
              style={{ width: 140 }}
            />
            <Select 
              value={year} 
              onChange={(val) => setYear(Number(val))}
              options={[year-1, year, year+1].map(y => ({ value: y, label: String(y) }))}
              style={{ width: 100 }}
            />
          </div>
        </div>
        
        {chartData.length > 0 ? (
          <div style={{ padding: '24px' }}>
            <h4 style={{ marginBottom: 16 }}>
              {groupingType === 'category' 
                ? 'Nilai Persediaan Saat Ini Berdasarkan Kategori' 
                : 'Top 15 Nilai Persediaan Saat Ini Berdasarkan Barang'}
            </h4>
            <div style={{ height: 320, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 85 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="name" 
                    tickFormatter={(val) => val.length > 15 ? val.substring(0, 15) + '...' : val} 
                    tick={{ fill: '#64748b', fontSize: 11, angle: -45, textAnchor: 'end', dy: 10 }} 
                    axisLine={{ stroke: '#cbd5e1' }} 
                    tickLine={false} 
                    interval={0} 
                  />
                  <YAxis tickFormatter={(val: any) => `Rp${(Number(val)/1000000).toFixed(1)}M`} tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    formatter={(value: any, name: any) => [`Rp ${Number(value || 0).toLocaleString('id-ID')}`, name] as any}
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="Nilai Persediaan" fill="#016e3f" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div style={{ padding: '64px 24px', textAlign: 'center', color: '#94a3b8' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 16px auto', opacity: 0.5 }}>
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
            <p style={{ margin: 0, fontSize: 14 }}>
              {loading ? 'Memuat data...' : 'Tidak ada data persediaan untuk periode ini.'}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
