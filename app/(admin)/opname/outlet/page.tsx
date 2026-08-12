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
}

export default function OutletOpnamePage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<OpnameSession[]>([]);
  const [user, setUser] = useState<any>(null);
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

  const fetchSessions = useCallback(async (outletId: number) => {
    const res = await fetch(`/api/opname?location_type=OUTLET&location_id=${outletId}`);
    const data = await res.json();
    setSessions(data.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.success && data.data) {
        setUser(data.data);
        if (data.data.outlet_id) {
          await fetchSessions(data.data.outlet_id);
        } else {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };
    init();
  }, [fetchSessions]);

  const handleStartOpname = async () => {
    if (!user?.outlet_id) {
      showToast("Outlet ID not found", 'error');
      return;
    }
    setCreating(true);
    try {
      const payload = {
        location_type: 'OUTLET',
        location_id: user.outlet_id,
        count_date: new Date().toISOString().split('T')[0],
        general_notes: 'Outlet Stock Opname'
      };
      
      const res = await fetch('/api/opname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success && data.data?.id) {
        router.push(`/opname/outlet/${data.data.id}`);
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
        <div className="tabs" style={{ marginBottom: 0 }}>
          <a href="/opname/outlet" className="tab active" style={{ textDecoration: 'none' }}>Stock Opname</a>
          <a href="/outlet/items" className="tab" style={{ textDecoration: 'none', color: 'inherit' }}>Item Reference</a>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--border)', flexWrap: 'nowrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'nowrap', overflow: 'hidden' }}>
            <h3 className="truncate" style={{ fontSize: 15, margin: 0, fontWeight: 700, whiteSpace: 'nowrap' }}>Stock Opname Outlet</h3>
            <input 
              type="date" 
              className="input hidden md:block" 
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              style={{ fontSize: 12, padding: '4px 8px', height: 28, width: 'auto' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'nowrap' }}>
            <Button variant="outline" size="sm" onClick={() => setShowMobileFilters(!showMobileFilters)} className="md:hidden" style={{ height: 28, padding: '0 8px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>
            </Button>
            <Button variant="primary" size="sm" onClick={handleStartOpname} disabled={creating || !user?.outlet_id} style={{ whiteSpace: 'nowrap', height: 28, padding: '0 12px', fontSize: 12 }}>
              {creating ? 'Memulai...' : (
                <>
                  <span className="hidden md:inline">+ Start Daily Report</span>
                  <span className="md:hidden" title="+ Start Daily Report"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg></span>
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
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Memuat riwayat opname...</div>
          ) : !user?.outlet_id ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Anda tidak terkait dengan outlet manapun.</div>
          ) : sessions.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              <h4>Belum ada riwayat opname</h4>
              <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>Pilih outlet untuk memulai atau melihat riwayat opname.</p>
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
                          onClick={() => router.push(`/opname/outlet/${s.id}`)}
                          style={{ 
                            display: 'flex', alignItems: 'center', padding: '8px 12px', 
                            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, 
                            cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                            position: 'relative'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#cbd5e1';
                            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05)';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '#e2e8f0';
                            e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.03)';
                            e.currentTarget.style.transform = 'none';
                          }}
                        >
                          <div style={{ width: 4, height: '70%', background: s.status === 'LOCKED' ? '#016e3f' : s.status === 'SUBMITTED' ? '#3b82f6' : '#cbd5e1', position: 'absolute', left: 0, top: '15%', borderRadius: '0 4px 4px 0' }}></div>
                          <div style={{ width: 130, paddingLeft: 12 }}>
                            <div className="muted" style={{ fontSize: 10, marginBottom: 2 }}>Waktu Mulai</div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{new Date(s.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
                          </div>
                          
                          <div style={{ width: 180 }}>
                            <div className="muted" style={{ fontSize: 10, marginBottom: 2 }}>Dilakukan Oleh</div>
                            <div style={{ fontWeight: 600, fontSize: 12, color: '#334155' }}>{s.pic_name}</div>
                          </div>
              
                          <div style={{ flex: 1, textAlign: 'right', paddingRight: 32 }}>
                            <div className="muted" style={{ fontSize: 10, marginBottom: 2 }}>Estimasi Selisih Nilai</div>
                            <div className="font-mono font-bold" style={{ fontSize: 13, color: Number(s.total_value) > 0 ? '#016e3f' : Number(s.total_value) < 0 ? '#dc2626' : '#94a3b8' }}>
                              {Number(s.total_value) > 0 ? '+Rp ' : Number(s.total_value) < 0 ? '-Rp ' : 'Rp '}{Math.abs(Number(s.total_value)).toLocaleString('id-ID')}
                            </div>
                          </div>
              
                          <div style={{ width: 140, textAlign: 'right' }}>
                            <Badge variant={s.status === 'LOCKED' ? 'green' : s.status === 'SUBMITTED' ? 'blue' : 'gray'}>
                              {s.status === 'LOCKED' ? 'Selesai (Terkunci)' : s.status === 'SUBMITTED' ? 'Diajukan' : s.status === 'DRAFT' ? 'Draf' : s.status}
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
