'use client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function OutletTrendChart({ data }: { data: { labelDate: string, value: number }[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="empty-state" style={{ padding: '32px 0' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3v18h18M18 17l-5-5-4 4-5-5"/></svg>
        <h4>Data tidak tersedia</h4>
        <p>Data aktivitas tidak cukup untuk menampilkan tren</p>
      </div>
    );
  }

  return (
    <div style={{ height: 200, width: '100%', marginTop: 24, paddingBottom: 10, outline: 'none' }} tabIndex={-1}>
      <ResponsiveContainer width="100%" height="100%" style={{ outline: 'none' }}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} style={{ outline: 'none' }} tabIndex={-1}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="labelDate" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} dy={10} />
          <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip 
            cursor={false}
            formatter={(value: any) => [value, 'Jumlah Pesanan (RO)']}
            labelStyle={{ color: '#0f172a', fontWeight: 'bold', marginBottom: 4 }}
            contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
