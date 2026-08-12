'use client';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function DashboardChart({ data }: { data: { date: string, value: number }[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="empty-state" style={{ padding: '32px 0' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3v18h18M18 17l-5-5-4 4-5-5"/></svg>
        <h4>Data tidak tersedia</h4>
        <p>Data inventaris tidak cukup untuk menampilkan tren</p>
      </div>
    );
  }

  const chartData = data.map(d => ({
    ...d,
    labelDate: new Date(d.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
  }));

  return (
    <>
      <div style={{ height: 200, width: '100%', marginTop: 24, outline: 'none' }} tabIndex={-1}>
        <ResponsiveContainer width="100%" height="100%" style={{ outline: 'none' }}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} style={{ outline: 'none' }} tabIndex={-1}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#016e3f" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#016e3f" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="labelDate" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} dy={10} />
            <YAxis 
              yAxisId="left"
              tickFormatter={(val) => `Rp${(val/1000000).toFixed(0)}M`} 
              tick={{ fill: '#64748b', fontSize: 12 }} 
              axisLine={false} 
              tickLine={false} 
              width={65}
            />
            <Tooltip 
              cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '5 5' }}
              formatter={(value: any, name: any) => {
                if (name === 'value') return [`Rp ${Number(value).toLocaleString('id-ID')}`, 'Total Nilai Persediaan'];
                if (name === 'outboundValue') return [`Rp ${Number(value).toLocaleString('id-ID')}`, 'Distribusi ke Outlet'];
                return [value, name];
              }}
              labelStyle={{ color: '#0f172a', fontWeight: 'bold', marginBottom: 4 }}
              contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Area yAxisId="left" type="monotone" dataKey="value" stroke="#016e3f" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
            <Area yAxisId="left" type="monotone" dataKey="outboundValue" stroke="#c0392b" strokeWidth={2} fill="transparent" strokeDasharray="4 3" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-legend" style={{ display: 'flex', gap: 16, marginTop: 12 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}><i style={{background:'#016e3f', width: 12, height: 12, borderRadius: 2}}></i>Total Nilai Persediaan</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}><i style={{background:'#c0392b', width: 12, height: 12, borderRadius: 2}}></i>Distribusi ke Outlet</span>
      </div>
    </>
  );
}
