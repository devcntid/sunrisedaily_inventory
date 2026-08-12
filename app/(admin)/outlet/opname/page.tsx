'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { Toast } from '@/components/ui/Toast';

interface OpnameSession {
  id: number;
  count_date: string;
  pic_name: string;
  total_value: number;
  status: string;
  created_at: string;
  updated_at: string;
  location_name?: string;
}

export default function OutletOpnamePage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<OpnameSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [outletId, setOutletId] = useState<number | null>(null);
  const [toastInfo, setToastInfo] = useState<{ show: boolean, msg: string, type: 'success' | 'error' | 'info' }>({ show: false, msg: '', type: 'info' });
  const [limit, setLimit] = useState<number | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [filterDate, setFilterDate] = useState('');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const fetchSessions = useCallback(async (oId: number) => {
    setLoading(true);
    const res = await fetch(`/api/opname?location_type=OUTLET&location_id=${oId}`);
    const data = await res.json();
    setSessions(data.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // Get outletId from session via API
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data?.outlet_id) {
          setOutletId(d.data.outlet_id);
          fetchSessions(d.data.outlet_id);
        }
      });
  }, [fetchSessions]);

  const handleStartOpname = async () => {
    if (!outletId) return;
    setCreating(true);
    try {
      const payload = {
        location_type: 'OUTLET',
        location_id: outletId,
        count_date: new Date().toISOString().split('T')[0],
        general_notes: 'Weekly Stock Opname'
      };

      const res = await fetch('/api/opname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success && data.data?.id) {
        router.push(`/outlet/opname/${data.data.id}`);
      } else {
        setToastInfo({ show: true, msg: data.message || 'Gagal memulai opname', type: 'error' });
        setCreating(false);
      }
    } catch (err: unknown) {
      setToastInfo({ show: true, msg: (err instanceof Error ? err.message : 'Unknown error'), type: 'error' });
      setCreating(false);
    }
  };

  const filteredSessions = filterDate ? sessions.filter(s => s.count_date.startsWith(filterDate)) : sessions;

  return (
    <section className="screen">
      {toastInfo.show && <Toast isOpen={true} message={toastInfo.msg} type={toastInfo.type} onClose={() => setToastInfo({ ...toastInfo, show: false })} />}
      <div className="card">
        <div className="card-head" style={{ flexWrap: 'wrap', gap: 16 }}>
          <div style={{ flex: '1 1 auto', minWidth: 200, overflow: 'hidden' }}>
            <h3 className="truncate" style={{ fontSize: 18, margin: 0, fontWeight: 700, whiteSpace: 'nowrap' }}>Stock Opname Outlet</h3>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'nowrap' }}>
            <Button variant="outline" size="sm" onClick={() => setShowMobileFilters(!showMobileFilters)} className="md:hidden" style={{ height: 28, padding: '0 8px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>
            </Button>
            <div className="hidden md:flex gap-2">
              <input 
                type="date" 
                className="input" 
                value={filterDate}
                onChange={e => setFilterDate(e.target.value)}
                style={{ fontSize: 12, padding: '0 12px', height: 28, minWidth: 120, width: 'auto' }}
              />
              <select className="input" style={{ width: 'auto', height: 28, fontSize: 12, padding: '0 8px' }} value={limit} onChange={(e) => { setLimit(e.target.value === 'all' ? 'all' : Number(e.target.value)); setCurrentPage(1); }}>
                <option value="all">Semua</option>
                <option value="8">8</option>
                <option value="32">32</option>
              </select>
            </div>
            <Button variant="primary" style={{ height: 28, padding: '0 12px', fontSize: 12, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }} onClick={handleStartOpname} disabled={creating || !outletId}>
              {creating ? 'Memulai...' : (
                <>
                  <span className="hidden md:inline">+ Mulai Sesi Opname</span>
                  <span className="md:hidden" title="+ Mulai Sesi Opname"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg></span>
                </>
              )}
            </Button>
          </div>
        </div>

        {showMobileFilters && (
          <div className="md:hidden" style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 600 }}>Filter Tanggal</div>
              <input 
                type="date" 
                className="input w-full" 
                value={filterDate}
                onChange={e => setFilterDate(e.target.value)}
                style={{ fontSize: 13, height: 32 }}
              />
            </div>
            <div>
              <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 600 }}>Tampilkan Data</div>
              <select className="input w-full" style={{ height: 32, fontSize: 13 }} value={limit} onChange={(e) => { setLimit(e.target.value === 'all' ? 'all' : Number(e.target.value)); setCurrentPage(1); }}>
                <option value="all">Semua</option>
                <option value="8">8</option>
                <option value="32">32</option>
              </select>
            </div>
          </div>
        )}

        <div className="card-body flush">
          {loading ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Memuat riwayat opname...</div>
          ) : filteredSessions.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              <h4>Belum ada riwayat opname</h4>
              <p>Belum ada data atau tidak ditemukan untuk tanggal yang dipilih.</p>
            </div>
          ) : (
            <>
            <div style={{ padding: '24px 20px 20px' }}>
              {(() => {
                const displayedSessions = limit === 'all' ? filteredSessions : filteredSessions.slice((currentPage - 1) * limit, currentPage * limit);
                const groupedSessions = displayedSessions.reduce((acc, session) => {
                  const dateStr = session.count_date.split('T')[0];
                  if (!acc[dateStr]) acc[dateStr] = [];
                  acc[dateStr].push(session);
                  return acc;
                }, {} as Record<string, OpnameSession[]>);

                const sortedDates = Object.keys(groupedSessions).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

                return sortedDates.map(date => (
                  <div key={date} style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ background: '#016e3f', color: '#fff', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, boxShadow: '0 2px 4px rgba(1, 110, 63, 0.2)' }}>
                        {new Date(date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      </div>
                      <div style={{ flex: 1, height: 1, background: '#e2e8f0', marginLeft: 16 }}></div>
                    </div>
                    <div style={{ display: 'grid', gap: 8, paddingLeft: 8 }}>
                      {groupedSessions[date].map(s => (
                        <div 
                          key={s.id} 
                          onClick={() => router.push(`/outlet/opname/${s.id}`)}
                          className="flex items-center p-2 md:p-3 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-slate-300 hover:shadow-sm transition-all relative"
                        >
                          <div className="hidden md:block" style={{ width: 4, height: '70%', background: s.status === 'LOCKED' ? '#016e3f' : s.status === 'SUBMITTED' ? '#3b82f6' : '#cbd5e1', position: 'absolute', left: 0, top: '15%', borderRadius: '0 4px 4px 0' }}></div>
                          
                          <div className="w-[50px] md:w-[130px] pl-3 md:pl-4">
                            <div className="muted text-[9px] md:text-[10px] mb-1">Waktu</div>
                            <div className="font-bold text-[11px] md:text-[13px] text-slate-900">{new Date(s.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
                          </div>
                          
                          <div className="flex-1 md:w-[180px] md:flex-none px-2 overflow-hidden">
                            <div className="muted text-[9px] md:text-[10px] mb-1">Oleh</div>
                            <div className="font-semibold text-[11px] md:text-[12px] text-slate-700 truncate">
                              <span className="md:hidden">{s.location_name || 'Outlet'}</span>
                              <span className="hidden md:inline">{s.pic_name}</span>
                            </div>
                          </div>
                      
                          <div className="w-[70px] md:flex-1 text-right md:pr-8 px-1 overflow-hidden">
                            <div className="muted text-[9px] md:text-[10px] mb-1 truncate">Est. Selisih</div>
                            <div className="font-mono font-bold text-[11px] md:text-[13px] truncate" style={{ color: Number(s.total_value) > 0 ? '#016e3f' : Number(s.total_value) < 0 ? '#dc2626' : '#94a3b8' }}>
                              {Number(s.total_value) > 0 ? '+' : Number(s.total_value) < 0 ? '-' : ''}Rp{Math.abs(Number(s.total_value)).toLocaleString('id-ID')}
                            </div>
                          </div>
                      
                          <div className="w-[60px] md:w-[140px] text-right">
                            <Badge variant={s.status === 'LOCKED' ? 'green' : s.status === 'SUBMITTED' ? 'blue' : 'gray'}>
                              <span className="md:hidden text-[9px]">{s.status === 'LOCKED' ? 'Selesai' : s.status === 'SUBMITTED' ? 'Submit' : 'Draf'}</span>
                              <span className="hidden md:inline">{s.status === 'LOCKED' ? 'Selesai (Terkunci)' : s.status === 'SUBMITTED' ? 'Diajukan' : s.status === 'DRAFT' ? 'Draf' : s.status}</span>
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
            
            {limit !== 'all' && filteredSessions.length > (limit as number) && (
              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(filteredSessions.length / limit)}
                totalItems={filteredSessions.length}
                itemsPerPage={limit as number}
                onPageChange={setCurrentPage}
              />
            )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
