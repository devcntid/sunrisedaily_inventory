'use client';
import { useState, useEffect } from 'react';
import { Table } from '@/components/ui/Table';
import { Select } from '@/components/ui/Select';
import { Pagination } from '@/components/ui/Pagination';
import { Modal } from '@/components/ui/Modal';
import { ExternalLink, X, Search } from 'lucide-react';
import { Input } from '@/components/ui/Input';

export function CentralLocalPurchaseView() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [outlets, setOutlets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [selectedOutlet, setSelectedOutlet] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  
  // Modal Preview
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    fetchOutlets();
  }, []);

  useEffect(() => {
    fetchPurchases();
    // Mark as read when opened
    fetch('/api/outlets/local-purchases/mark-read', { method: 'POST' }).catch(() => {});
  }, [selectedOutlet, selectedDate]);

  const fetchOutlets = async () => {
    try {
      const res = await fetch('/api/outlets');
      const data = await res.json();
      if (data.success) {
        setOutlets(data.data);
      }
    } catch (err) {
    }
  };

  const fetchPurchases = async () => {
    setLoading(true);
    try {
      const url = new URL(window.location.origin + '/api/outlets/local-purchases');
      if (selectedOutlet) url.searchParams.append('outlet_id', selectedOutlet);
      if (selectedDate) url.searchParams.append('date', selectedDate);
      
      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.success) {
        setPurchases(data.data);
        setCurrentPage(1); // Reset page on filter
      }
    } catch (err) {
    } finally {
      setLoading(false);
    }
  };

  const formatRp = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);

  const paginatedPurchases = purchases.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <>
    <section className="screen">
      <div className="card">
        <div className="card-head">
          <div>
            <h3>Belanja Outlet (Lokal)</h3>
            <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>Monitoring riwayat belanja mandiri dari outlet</p>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ width: 180 }}>
              <Select
                value={selectedOutlet}
                onChange={(val) => { setSelectedOutlet(String(val)); setCurrentPage(1); }}
                options={[
                  { label: 'Semua Outlet', value: '' },
                  ...outlets.map(o => ({ label: o.name, value: String(o.id) }))
                ]}
                searchable
                placeholder="Semua Outlet"
              />
            </div>
            <div style={{ width: 180 }}>
              <Input 
                type="date" 
                value={selectedDate} 
                onChange={(e) => { setSelectedDate(e.target.value); setCurrentPage(1); }} 
              />
            </div>
          </div>
        </div>

        <div className="card-body flush">
          {loading ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Memuat data...</div>
          ) : purchases.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
              <h4>Tidak ada catatan belanja</h4>
              <p>Belum ada riwayat belanja lokal yang sesuai dengan filter Anda.</p>
            </div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Tanggal Belanja</th>
                  <th>Outlet</th>
                  <th>Total Nominal</th>
                  <th>Rincian Barang</th>
                  <th className="center">Bukti Nota</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPurchases.map(p => (
                  <tr key={p.id}>
                    <td>{new Date(p.purchase_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
                    <td className="font-bold">{p.outlet_name}</td>
                    <td className="font-bold text-green-700">{formatRp(p.total_amount)}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {p.items?.map((item: any) => (
                          <div key={item.id} style={{ fontSize: 13 }}>
                            {item.qty}x {item.item_name} @ {formatRp(item.price_per_unit)}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="center">
                      <button 
                        type="button"
                        onClick={() => setPreviewImage(p.receipt_url)} 
                        className="btn btn-outline" 
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '4px 10px' }}
                      >
                        <ExternalLink size={14} /> Lihat Nota
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
      
      {purchases.length > itemsPerPage && (
        <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0' }}>
          <Pagination 
            currentPage={currentPage}
            totalPages={Math.ceil(purchases.length / itemsPerPage)}
            totalItems={purchases.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
      
        </div>
      </div>
    </section>

      {previewImage && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 999999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <img src={previewImage} style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} />
          <button 
            onClick={() => setPreviewImage(null)}
            style={{ position: 'absolute', top: 20, right: 20, background: '#ffffff', border: 'none', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            title="Tutup (Kembali)"
          >
            <X size={20} color="#0f172a" />
          </button>
        </div>
      )}
    </>
  );
}
