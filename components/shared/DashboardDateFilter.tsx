'use client';

import { useState, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Calendar, Filter } from 'lucide-react';

interface DashboardDateFilterProps {
  initialStartDate: string;
  initialEndDate: string;
  initialPreset?: string;
}

export default function DashboardDateFilter({
  initialStartDate,
  initialEndDate,
  initialPreset = '7d',
}: DashboardDateFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [preset, setPreset] = useState<string>(initialPreset);
  const [startDate, setStartDate] = useState<string>(initialStartDate);
  const [endDate, setEndDate] = useState<string>(initialEndDate);
  const [showCustom, setShowCustom] = useState<boolean>(initialPreset === 'custom');

  // Helper untuk format YYYY-MM-DD
  function toDateStr(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function applyFilter(newPreset: string, start: string, end: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('preset', newPreset);
    params.set('startDate', start);
    params.set('endDate', end);

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function handlePresetChange(selected: string) {
    setPreset(selected);
    const now = new Date();

    if (selected === '7d') {
      setShowCustom(false);
      const start = new Date(now);
      start.setDate(now.getDate() - 6);
      const startStr = toDateStr(start);
      const endStr = toDateStr(now);
      setStartDate(startStr);
      setEndDate(endStr);
      applyFilter('7d', startStr, endStr);
    } else if (selected === '30d') {
      setShowCustom(false);
      const start = new Date(now);
      start.setDate(now.getDate() - 29);
      const startStr = toDateStr(start);
      const endStr = toDateStr(now);
      setStartDate(startStr);
      setEndDate(endStr);
      applyFilter('30d', startStr, endStr);
    } else if (selected === 'this_month') {
      setShowCustom(false);
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const startStr = toDateStr(start);
      const endStr = toDateStr(now);
      setStartDate(startStr);
      setEndDate(endStr);
      applyFilter('this_month', startStr, endStr);
    } else if (selected === 'custom') {
      setShowCustom(true);
    }
  }

  function handleCustomSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!startDate || !endDate) return;
    applyFilter('custom', startDate, endDate);
  }

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        marginBottom: '20px',
        background: '#ffffff',
        padding: '12px 16px',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
      }}
    >
      {/* Label Periode */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b', fontWeight: 600, fontSize: '13px' }}>
        <Calendar size={16} color="#016e3f" />
        <span>Periode Waktu:</span>
        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
          ({new Date(startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} - {new Date(endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })})
        </span>
        {isPending && (
          <span style={{ fontSize: '11px', color: '#016e3f', fontStyle: 'italic', marginLeft: '4px' }}>
            Memuat data...
          </span>
        )}
      </div>

      {/* Preset Buttons & Custom Picker */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
        <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', gap: '3px' }}>
          {[
            { id: '7d', label: '7 Hari' },
            { id: '30d', label: '30 Hari' },
            { id: 'this_month', label: 'Bulan Ini' },
            { id: 'custom', label: 'Kustom' },
          ].map((item) => {
            const active = preset === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handlePresetChange(item.id)}
                disabled={isPending}
                style={{
                  padding: '5px 12px',
                  fontSize: '12px',
                  fontWeight: active ? 700 : 500,
                  color: active ? '#ffffff' : '#475569',
                  background: active ? '#016e3f' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isPending ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: active ? '0 1px 3px rgba(1, 110, 63, 0.3)' : 'none',
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Form Input Custom Tanggal */}
        {showCustom && (
          <form onSubmit={handleCustomSubmit} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '4px' }}>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input"
              style={{ padding: '4px 8px', fontSize: '12px', height: '30px', width: '130px' }}
              required
            />
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>s/d</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input"
              style={{ padding: '4px 8px', fontSize: '12px', height: '30px', width: '130px' }}
              required
            />
            <button
              type="submit"
              disabled={isPending}
              style={{
                padding: '5px 12px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#ffffff',
                background: '#016e3f',
                border: 'none',
                borderRadius: '6px',
                cursor: isPending ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                height: '30px',
              }}
            >
              <Filter size={12} />
              <span>Terapkan</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
