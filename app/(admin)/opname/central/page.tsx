'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Toast } from '@/components/ui/Toast';
import { Pagination } from '@/components/ui/Pagination';

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

export default function CentralOpnamePage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<OpnameSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [filterDate, setFilterDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState<number | 'all'>(15);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; isOpen: boolean }>({ message: '', type: 'info', isOpen: false });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type, isOpen: true });
  };

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/opname?location_type=PUSAT`);
    const data = await res.json();
    setSessions(data.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const handleStartOpname = async () => {
    setCreating(true);
    try {
      const payload = {
        location_type: 'PUSAT',
        count_date: new Date().toISOString().split('T')[0],
        general_notes: 'Central Warehouse Stock Opname'
      };

      const res = await fetch('/api/opname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success && data.data?.id) {
        router.push(`/opname/central/${data.data.id}`);
      } else {
        showToast(data.message || 'Failed to start opname', 'error');
        setCreating(false);
      }
    } catch (err: unknown) {
      showToast((err instanceof Error ? err.message : 'Unknown error'), 'error');
      setCreating(false);
    }
  };

  const filteredSessions = filterDate ? sessions.filter(s => s.count_date.startsWith(filterDate)) : sessions;

  return (
    <section className="screen">
      <div className="card">
        <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'nowrap', gap: 16 }}>
          <div style={{ overflow: 'hidden' }}>
            <h3 className="truncate" style={{ fontSize: 18, margin: 0, fontWeight: 700, whiteSpace: 'nowrap' }}>Stock Opname Pusat</h3>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'nowrap' }}>
            <input
              type="date"
              className="input hidden md:block"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              style={{ fontSize: 13, height: 28, minWidth: 120, width: 'auto' }}
            />
            <Button variant="outline" size="sm" onClick={() => setShowMobileFilters(!showMobileFilters)} className="md:hidden" style={{ height: 28, padding: '0 8px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>
            </Button>
            <Button variant="primary" style={{ height: 28, padding: '0 12px', fontSize: 12, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }} onClick={handleStartOpname} disabled={creating}>
              {creating ? 'Memulai...' : (
                <>
                  <span className="hidden md:inline">+ Mulai Opname</span>
                  <span className="md:hidden" title="+ Mulai Opname"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg></span>
                </>
              )}
            </Button>
          </div>
        </div>

        {showMobileFilters && (
          <div className="md:hidden" style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', background: '#f8fafc' }}>
            <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 600 }}>Filter Tanggal</div>
            <input 
              type="date" 
              className="input w-full" 
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              style={{ fontSize: 13, height: 32 }}
            />
          </div>
        )}

        <div className="card-body flush" style={{ overflowY: 'auto', background: '#f8fafc' }}>
          {loading ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Memuat riwayat opname...</div>
          ) : filteredSessions.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              <h4>Belum ada riwayat opname</h4>
              <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>Anda belum pernah melakukan opname stok pusat.</p>
            </div>
          ) : (
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
                          onClick={() => router.push(`/opname/central/${s.id}`)}
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
                              <span className="md:hidden">{s.location_name || 'Pusat'}</span>
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
          )}
          
          {limit !== 'all' && filteredSessions.length > (limit as number) && (
            <div style={{ padding: '0 20px 20px' }}>
              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(filteredSessions.length / (limit as number))}
                totalItems={filteredSessions.length}
                itemsPerPage={limit as number}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>
      </div>
      <Toast
        isOpen={toast.isOpen}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, isOpen: false }))}
      />
    </section>
  );
}
