'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { Plus, Search, MapPin } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { OrderStatusBadge } from '@/components/shared/OrderStatusBadge';


interface DirectPurchase {
  id: number;
  purchase_date: string;
  receipt_number: string;
  total_amount: string;
  notes: string;
  created_by_name: string;
  item_count: string;
}

export default function DirectPurchasesPage() {
  const [purchases, setPurchases] = useState<DirectPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<any>(null);

  const handleOpenDetail = async (id: number) => {
    setDetailModalOpen(true);
    setDetailLoading(true);
    setSelectedDetail(null);
    try {
      const res = await fetch(`/api/direct-purchases/${id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setSelectedDetail(data.data);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDetailLoading(false);
    }
  };
  
  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/direct-purchases');
      if (res.ok) {
        const data = await res.json();
        setPurchases(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  const filtered = purchases.filter(p => 
    p.receipt_number?.toLowerCase().includes(search.toLowerCase()) ||
    p.notes?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <section className="screen">
      <div className="card">
        <div className="card-head">
          <div>
            <h3>Belanja Pasar</h3>
            <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>Catat pengeluaran tunai untuk belanja langsung ke pasar atau toko lokal.</p>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ width: 250, position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: 10, color: '#94a3b8' }} />
              <input 
                type="text"
                placeholder="Cari referensi atau catatan..."
                className="input"
                style={{ width: '100%', paddingLeft: 36 }}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Link href="/direct-purchases/create">
              <Button variant="primary" size="sm">+ Catat Belanja Baru</Button>
            </Link>
          </div>
        </div>

        <div className="card-body flush">
          {loading ? (
            <div className="muted center" style={{ padding: 40 }}>Memuat data...</div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <MapPin size={40} style={{ margin: '0 auto 16px', color: 'var(--muted)' }} />
              <h4>Tidak ada riwayat belanja</h4>
              <p>Belum ada catatan belanja langsung.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <Table>
                <thead>
                  <tr>
                    <th>Tanggal Belanja</th>
                    <th>No. Referensi / Nota</th>
                    <th>Oleh</th>
                    <th className="center">Total Item</th>
                    <th className="right">Total Nominal</th>
                    <th>Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr 
                      key={p.id} 
                      onClick={() => handleOpenDetail(p.id)}
                      style={{ cursor: 'pointer' }}
                      title="Klik baris untuk melihat detail"
                    >
                      <td className="font-bold">
                        {new Date(p.purchase_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td>
                        <div className="font-bold text-primary">{p.receipt_number || '-'}</div>
                      </td>
                      <td>{p.created_by_name}</td>
                      <td className="center">
                        <Badge variant="gray">{p.item_count} Jenis</Badge>
                      </td>
                      <td className="right font-bold">
                        Rp {Number(p.total_amount).toLocaleString('id-ID')}
                      </td>
                      <td className="muted" style={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.notes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={detailModalOpen} onClose={() => setDetailModalOpen(false)} title="Detail Belanja Pasar" maxWidth={850}>
        {detailLoading ? (
          <div className="center muted" style={{ padding: 40 }}>Memuat rincian...</div>
        ) : selectedDetail ? (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20, padding: 16, backgroundColor: 'var(--bg-muted)', borderRadius: 8 }}>
              <div>
                <p className="muted" style={{ fontSize: 13, marginBottom: 4 }}>Tanggal Belanja</p>
                <div className="font-bold">{new Date(selectedDetail.purchase_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
              </div>
              <div>
                <p className="muted" style={{ fontSize: 13, marginBottom: 4 }}>No. Referensi / Nota</p>
                <div className="font-bold text-primary">{selectedDetail.receipt_number || '-'}</div>
              </div>
              <div>
                <p className="muted" style={{ fontSize: 13, marginBottom: 4 }}>Oleh</p>
                <div className="font-bold">{selectedDetail.created_by_name}</div>
              </div>
              <div>
                <p className="muted" style={{ fontSize: 13, marginBottom: 4 }}>Catatan Umum</p>
                <div className="font-bold">{selectedDetail.notes || '-'}</div>
              </div>
            </div>

            <h4 style={{ marginBottom: 12 }}>Rincian Barang</h4>
            <div className="table-responsive">
              <Table>
                <thead>
                  <tr>
                    <th>Bahan / Barang</th>
                    <th>Toko / Vendor</th>
                    <th>Catatan Barang</th>
                    <th className="right">Kuantitas</th>
                    <th className="right">Harga Satuan</th>
                    <th className="right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDetail.items?.map((item: any, idx: number) => {
                    let displayShop = item.shop_name || '-';
                    let displayNote = '-';
                    const match = displayShop.match(/^(.*?) \((.*?)\)$/);
                    if (match) {
                      displayShop = match[1];
                      displayNote = match[2];
                    }
                    return (
                      <tr key={idx}>
                        <td>
                          <div className="font-bold">{item.item_name}</div>
                          {item.brand_name && <div className="muted" style={{ fontSize: 12 }}>Merek: {item.brand_name}</div>}
                        </td>
                        <td>{displayShop}</td>
                        <td className="muted">{displayNote}</td>
                        <td className="right font-bold">
                          {item.qty} {item.unit}
                        </td>
                        <td className="right">Rp {Number(item.unit_price).toLocaleString('id-ID')}</td>
                        <td className="right font-bold">Rp {Number(item.subtotal).toLocaleString('id-ID')}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border)' }}>
                    <td colSpan={4}></td>
                    <td className="right font-bold" style={{ whiteSpace: 'nowrap' }}>Total Pembelanjaan</td>
                    <td className="right font-bold text-primary" style={{ whiteSpace: 'nowrap' }}>Rp {Number(selectedDetail.total_amount).toLocaleString('id-ID')}</td>
                  </tr>
                </tfoot>
              </Table>
            </div>
          
          </div>
        ) : (
          <div className="center muted" style={{ padding: 40 }}>Data tidak ditemukan.</div>
        )}
      </Modal>

    </section>
  );
}
