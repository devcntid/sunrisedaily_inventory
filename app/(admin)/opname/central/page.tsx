'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Toast } from '@/components/ui/Toast';
import { Pagination } from '@/components/ui/Pagination';
import { Modal } from '@/components/ui/Modal';
import { Building2, Store, Plus, Filter, Calendar } from 'lucide-react';

interface OpnameSession {
  id: number;
  count_date: string;
  pic_name: string;
  total_value: number;
  status: string;
  location_type: string;
  location_id?: number;
  location_name?: string;
  created_at: string;
  updated_at: string;
}

interface Outlet {
  id: number;
  name: string;
}

export default function CentralOpnamePage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<OpnameSession[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('PUSAT');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [filterDate, setFilterDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState<number | 'all'>(15);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [selectOutletModalOpen, setSelectOutletModalOpen] = useState(false);
  const [modalOutletId, setModalOutletId] = useState<string>('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; isOpen: boolean }>({ message: '', type: 'info', isOpen: false });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type, isOpen: true });
  };

  const fetchOutlets = useCallback(async () => {
    try {
      const res = await fetch('/api/outlets');
      if (res.ok) {
        const data = await res.json();
        setOutlets(Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : []);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/api/opname';
      if (selectedLocation === 'PUSAT') {
        url += '?location_type=PUSAT';
      } else if (selectedLocation === 'ALL_OUTLETS') {
        url += '?location_type=OUTLET';
      } else if (selectedLocation) {
        url += `?location_type=OUTLET&location_id=${selectedLocation}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      setSessions(data.data ?? []);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [selectedLocation]);

  useEffect(() => {
    fetchOutlets();
  }, [fetchOutlets]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleStartOpname = async (targetLocationType: string, targetLocationId?: number) => {
    setCreating(true);
    try {
      const isOutlet = targetLocationType === 'OUTLET';
      const outletObj = isOutlet ? outlets.find(o => o.id === targetLocationId) : null;
      const notes = isOutlet 
        ? `Sampling Stock Opname Outlet - ${outletObj?.name || 'Cabang'}`
        : 'Stock Opname Gudang Pusat';

      const payload = {
        location_type: targetLocationType,
        location_id: targetLocationId ?? null,
        count_date: new Date().toISOString().split('T')[0],
        general_notes: notes
      };

      const res = await fetch('/api/opname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success && data.data?.id) {
        setSelectOutletModalOpen(false);
        if (isOutlet) {
          router.push(`/opname/outlet/${data.data.id}`);
        } else {
          router.push(`/opname/central/${data.data.id}`);
        }
      } else {
        showToast(data.message || 'Gagal memulai opname', 'error');
        setCreating(false);
      }
    } catch (err: unknown) {
      showToast((err instanceof Error ? err.message : 'Unknown error'), 'error');
      setCreating(false);
    }
  };

  const handleCreateButtonClick = () => {
    if (selectedLocation === 'PUSAT') {
      handleStartOpname('PUSAT');
    } else if (selectedLocation === 'ALL_OUTLETS') {
      setModalOutletId(outlets[0] ? String(outlets[0].id) : '');
      setSelectOutletModalOpen(true);
    } else {
      handleStartOpname('OUTLET', Number(selectedLocation));
    }
  };

  const filteredSessions = filterDate ? sessions.filter(s => s.count_date.startsWith(filterDate)) : sessions;

  const locationOptions = [
    { value: 'PUSAT', label: 'Gudang Pusat' },
    { value: 'ALL_OUTLETS', label: 'Semua Outlet' },
    ...outlets.map(o => ({ value: String(o.id), label: `Outlet: ${o.name}` }))
  ];

  return (
    <section className="screen">
      <div className="card">
        <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h3 style={{ fontSize: 18, margin: 0, fontWeight: 700, whiteSpace: 'nowrap' }}>Stock Opname</h3>
            <div style={{ width: 200 }}>
              <Select
                value={selectedLocation}
                onChange={val => { setSelectedLocation(String(val)); setCurrentPage(1); }}
                options={locationOptions}
                inputStyle={{ fontSize: 13, height: 32, padding: '4px 10px' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'nowrap' }}>
            <input
              type="date"
              className="input hidden md:block"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              style={{ fontSize: 13, height: 32, minWidth: 130, width: 'auto' }}
            />
            <Button variant="outline" size="sm" onClick={() => setShowMobileFilters(!showMobileFilters)} className="md:hidden" style={{ height: 32, padding: '0 8px' }}>
              <Filter size={14} />
            </Button>
            <Button 
              variant="primary" 
              style={{ height: 32, padding: '0 14px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }} 
              onClick={handleCreateButtonClick} 
              disabled={creating}
            >
              <Plus size={15} />
              <span>{creating ? 'Memulai...' : selectedLocation === 'PUSAT' ? 'Mulai Opname Pusat' : 'Mulai Sampling Opname'}</span>
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
              <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                {selectedLocation === 'PUSAT' 
                  ? 'Belum ada data opname untuk Gudang Pusat.' 
                  : 'Belum ada data opname untuk lokasi yang dipilih.'}
              </p>
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
                      {groupedSessions[date].map(s => {
                        const isOutletSession = s.location_type === 'OUTLET';
                        const targetUrl = isOutletSession ? `/opname/outlet/${s.id}` : `/opname/central/${s.id}`;
                        const locName = isOutletSession ? (s.location_name || 'Outlet') : 'Gudang Pusat';

                        return (
                          <div 
                            key={s.id} 
                            onClick={() => router.push(targetUrl)}
                            className="flex items-center p-2 md:p-3 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-slate-300 hover:shadow-sm transition-all relative"
                          >
                            <div className="hidden md:block" style={{ width: 4, height: '70%', background: s.status === 'LOCKED' ? '#016e3f' : s.status === 'SUBMITTED' ? '#3b82f6' : '#cbd5e1', position: 'absolute', left: 0, top: '15%', borderRadius: '0 4px 4px 0' }}></div>
                            
                            <div className="w-[60px] md:w-[130px] pl-3 md:pl-4">
                              <div className="muted text-[9px] md:text-[10px] mb-1">Waktu</div>
                              <div className="font-bold text-[11px] md:text-[13px] text-slate-900">{new Date(s.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
                            </div>

                            <div className="w-[100px] md:w-[180px] px-2 overflow-hidden">
                              <div className="muted text-[9px] md:text-[10px] mb-1">Lokasi</div>
                              <div className="font-bold text-[11px] md:text-[13px] text-slate-800 truncate flex items-center gap-1">
                                {isOutletSession ? <Store size={13} className="text-amber-600 shrink-0" /> : <Building2 size={13} className="text-emerald-700 shrink-0" />}
                                <span className="truncate">{locName}</span>
                              </div>
                            </div>
                            
                            <div className="flex-1 md:w-[160px] md:flex-none px-2 overflow-hidden">
                              <div className="muted text-[9px] md:text-[10px] mb-1">Auditor / PIC</div>
                              <div className="font-semibold text-[11px] md:text-[12px] text-slate-700 truncate">
                                {s.pic_name}
                              </div>
                            </div>
                        
                            <div className="w-[80px] md:flex-1 text-right md:pr-8 px-1 overflow-hidden">
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
                        );
                      })}
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

      {/* Modal Pilih Outlet untuk Sampling Opname */}
      <Modal
        isOpen={selectOutletModalOpen}
        onClose={() => setSelectOutletModalOpen(false)}
        title="Pilih Outlet untuk Sampling Opname"
      >
        <div style={{ padding: '16px 0' }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Pilih Cabang Outlet yang Akan Diaudit:
            </label>
            <Select
              value={modalOutletId}
              onChange={val => setModalOutletId(String(val))}
              options={outlets.map(o => ({ value: String(o.id), label: o.name }))}
              inputStyle={{ width: '100%', height: 36, fontSize: 13 }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
            <Button variant="outline" onClick={() => setSelectOutletModalOpen(false)}>
              Batal
            </Button>
            <Button 
              variant="primary" 
              onClick={() => handleStartOpname('OUTLET', Number(modalOutletId))}
              disabled={creating || !modalOutletId}
            >
              {creating ? 'Memulai...' : 'Buka Formulir Sampling'}
            </Button>
          </div>
        </div>
      </Modal>

      <Toast
        isOpen={toast.isOpen}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, isOpen: false }))}
      />
    </section>
  );
}

