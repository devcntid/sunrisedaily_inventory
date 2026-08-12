'use client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export function GrossProfitChart({ data }: { data: { outletName: string, revenue: number, cogs: number, marginPct: number }[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="empty-state" style={{ padding: '32px 0' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3v18h18M18 17l-5-5-4 4-5-5"/></svg>
        <h4>Data tidak tersedia</h4>
        <p>Belum ada data penjualan 7 hari terakhir</p>
      </div>
    );
  }

  const formatRupiah = (val: number) => `Rp ${(val / 1000000).toFixed(1)}M`;

  return (
    <>
      <div style={{ height: 300, width: '100%', marginTop: 24, outline: 'none' }} tabIndex={-1}>
        <ResponsiveContainer width="100%" height="100%" style={{ outline: 'none' }}>
          <BarChart data={data} margin={{ top: 20, right: 10, left: 0, bottom: 20 }} style={{ outline: 'none' }} tabIndex={-1}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="outletName" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} dy={10} />
            <YAxis 
              yAxisId="left"
              tickFormatter={formatRupiah} 
              tick={{ fill: '#64748b', fontSize: 12 }} 
              axisLine={false} 
              tickLine={false} 
              width={75}
            />
            <Tooltip 
              cursor={{ fill: '#f1f5f9' }}
              formatter={(value: any, name: any, props: any) => {
                if (name === 'revenue') return [`Rp ${Number(value).toLocaleString('id-ID')}`, 'Pendapatan (Revenue)'];
                if (name === 'cogs') return [`Rp ${Number(value).toLocaleString('id-ID')}`, 'HPP (COGS)'];
                return [value, name];
              }}
              labelStyle={{ color: '#0f172a', fontWeight: 'bold', marginBottom: 4 }}
              contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Legend wrapperStyle={{ paddingTop: '10px' }} formatter={(value) => <span style={{ color: '#334155', fontSize: '13px' }}>{value === 'revenue' ? 'Pendapatan (Revenue)' : 'HPP (COGS)'}</span>} />
            <Bar yAxisId="left" dataKey="revenue" fill="#016e3f" radius={[4, 4, 0, 0]} name="revenue" barSize={40} />
            <Bar yAxisId="left" dataKey="cogs" fill="#c0392b" radius={[4, 4, 0, 0]} name="cogs" barSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ textAlign: 'center', marginTop: '8px', color: '#64748b', fontSize: '12px' }}>
        *Margin Kasar: (Pendapatan - HPP) / Pendapatan
      </div>
    </>
  );
}
