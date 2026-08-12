'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { FileText, ChevronLeft, ChevronRight, Search } from 'lucide-react';

interface DeliveryNote {
  id: number;
  delivery_note_number: string;
  outlet_name: string;
  delivery_date: string;
  status: string;
  order_number?: string;
}

export default function DeliveryOrdersPage() {
  const router = useRouter();
  const [notes, setNotes] = useState<DeliveryNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [outletFilter, setOutletFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [outlets, setOutlets] = useState<{id: number, name: string}[]>([]);
  const limit = 20;

  useEffect(() => {
    fetch('/api/outlets')
      .then(r => r.json())
      .then(d => setOutlets(d.data || []))
      .catch(console.error);
  }, []);

  const fetchNotes = useCallback(async (isQuiet = false) => {
    if (!isQuiet) setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });
      if (statusFilter) params.append('status', statusFilter);
      if (outletFilter) params.append('outlet_id', outletFilter);
      if (searchQuery) params.append('search', searchQuery);

      const res = await fetch(`/api/delivery-notes?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      setNotes(data.data ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      console.error(err);
    } finally {
      if (!isQuiet) setLoading(false);
    }
  }, [page, statusFilter, outletFilter, searchQuery]);

  useEffect(() => { 
    fetchNotes(false);
    const interval = setInterval(() => {
      fetchNotes(true);
    }, 3000);
    const handleFocus = () => {
      fetchNotes(true);
    };
    window.addEventListener('focus', handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchNotes]);

  const totalPages = Math.ceil(total / limit);

  return (
    <section className="screen">
      <div className="card">

        <div className="card-head">
          <div>
            <h3>Surat Jalan</h3>
            <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>Daftar pengiriman ke outlet</p>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ width: 220, position: 'relative' }}>
              <Input 
                placeholder="Cari No. SJ..." 
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    setSearchQuery(searchInput);
                    setPage(1);
                  }
                }}
                style={{ paddingRight: 32 }}
              />
              <Search 
                size={16} 
                style={{ position: 'absolute', right: 10, top: 10, color: '#94a3b8', cursor: 'pointer' }} 
                onClick={() => { setSearchQuery(searchInput); setPage(1); }}
              />
            </div>
            <div style={{ width: 180 }}>
              <Select
                value={outletFilter}
                onChange={(val) => { setOutletFilter(String(val)); setPage(1); }}
                options={[
                  { label: 'Semua Outlet', value: '' },
                  ...outlets.map(o => ({ label: o.name, value: String(o.id) }))
                ]}
                searchable
                placeholder="Semua Outlet"
              />
            </div>
            <div style={{ width: 160 }}>
              <Select
                value={statusFilter}
                onChange={(val) => { setStatusFilter(String(val)); setPage(1); }}
                options={[
                  { label: 'Semua Status', value: '' },
                  { label: 'Draft', value: 'DRAFT' },
                  { label: 'Dikirim', value: 'DIKIRIM' },
                  { label: 'Diterima', value: 'DITERIMA' },
                  { label: 'Dibatalkan', value: 'DIBATALKAN' }
                ]}
              />
            </div>
            <Link href="/delivery-orders/create">
              <Button variant="primary" size="sm">+ Buat Surat Jalan</Button>
            </Link>
          </div>
        </div>
        <div className="card-body flush">
          {loading ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Memuat surat jalan...</div>
          ) : notes.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
              <h4>Tidak ada surat jalan</h4>
              <p>Anda belum membuat surat jalan apapun.</p>
            </div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>No. SJ</th>
                  <th>No. PO</th>
                  <th>Outlet Tujuan</th>
                  <th>Tanggal Kirim</th>
                  <th className="center">Status</th>
                </tr>
              </thead>
              <tbody>
                {notes.map(n => (
                  <tr 
                    key={n.id} 
                    onClick={() => router.push(`/delivery-orders/${n.id}`)}
                    style={{ cursor: 'pointer' }}
                    className="hover-bg-muted"
                  >
                    <td className="font-mono text-primary font-bold">
                      {n.delivery_note_number}
                    </td>
                    <td className="font-mono">{n.order_number || '-'}</td>
                    <td className="font-bold">{n.outlet_name}</td>
                    <td>{new Date(n.delivery_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</td>
                    <td className="center">
                      <Badge variant={n.status === 'DITERIMA' ? 'green' : n.status === 'DIKIRIM' ? 'blue' : n.status === 'DIBATALKAN' ? 'red' : 'gray'}>
                        {n.status === 'DIBATALKAN' ? 'Dibatalkan' : 
                         n.status === 'DITERIMA' ? 'Diterima' : 
                         n.status === 'DIKIRIM' ? 'Dikirim' : 
                         n.status === 'DRAFT' ? 'Draft' : n.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderTop: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 13, color: '#64748b' }}>
                Menampilkan {(page - 1) * limit + 1} - {Math.min(page * limit, total)} dari {total} data
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <ChevronLeft size={14} /> Prev
                </Button>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 32, fontSize: 13, fontWeight: 500 }}>
                  {page} / {totalPages}
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={page === totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  Next <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
