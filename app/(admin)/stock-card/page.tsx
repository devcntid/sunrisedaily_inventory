'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Table } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';

interface LogEntry {
  id: number;
  created_at: string;
  movement_type: 'IN' | 'OUT' | 'ADJ';
  qty_change: number;
  ending_balance: number;
  reference_type: string;
  reference_id: number;
  do_id?: number;
  do_number?: string;
  po_id?: number;
  po_number?: string;
}

export default function StockCardPage() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const [categories, setCategories] = useState<Record<string, unknown>[]>([]);
  const [catFilter, setCatFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [logFilter, setLogFilter] = useState('');
  const [dateFilterStart, setDateFilterStart] = useState('');
  const [dateFilterEnd, setDateFilterEnd] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/items?parent_only=true').then(r => r.json()),
      fetch('/api/categories').then(r => r.json())
    ]).then(([itemsRes, catRes]) => {
      setItems(itemsRes.data ?? []);
      setCategories(catRes.data ?? []);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!selectedItemId) {
      setLogs([]);
      return;
    }
    setLoading(true);
    fetch(`/api/inventory/card?item_id=${selectedItemId}`)
      .then(r => r.json())
      .then(d => {
        setLogs(d.data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedItemId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, catFilter, statusFilter]);

  const selectedItem = items.find(i => String(i.id) === selectedItemId);

  // Derive summaries from the logs (since logs are returned in desc order by created_at)
  const currentBalance = logs.length > 0 ? logs[0].ending_balance : (selectedItem?.current_stock ?? 0);

  const lastIn = logs.find(l => l.movement_type === 'IN')?.created_at;
  const lastOut = logs.find(l => l.movement_type === 'OUT')?.created_at;

  const filteredItems = items.filter((i: any) => {
    if (search) {
      if (!i.name.toLowerCase().includes(search.toLowerCase()) && !String(i.id).includes(search)) return false;
    }
    if (catFilter && String(i.category_id) !== catFilter) return false;
    if (statusFilter) {
      const current = Number(i.current_stock ?? 0);
      const min = Number(i.minimum_threshold ?? 0);
      if (statusFilter === 'SAFE' && current < min) return false;
      if (statusFilter === 'LOW' && (current >= min || current <= 0)) return false;
      if (statusFilter === 'OUT' && current > 0) return false;
    }
    return true;
  });

  const ITEMS_PER_PAGE = 20;
  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const paginatedItems = filteredItems.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Auto-convert smallest unit value to a human-readable central unit based on Master Data
  function toCentralDisplay(valueInSmallest: number, item: any) {
    const ratio = parseFloat(item?.conversion_ratio || '1');
    const pUnit = item?.purchase_unit;
    const sUnit = item?.smallest_unit;

    if (ratio > 1 && pUnit) {
      return { value: valueInSmallest / ratio, unit: pUnit };
    }
    
    // Fallback if no conversion ratio exists
    const u = (sUnit || '').toLowerCase();
    if (u === 'ml') return { value: valueInSmallest / 1000, unit: 'Liter' };
    if (u === 'gr' || u === 'g') return { value: valueInSmallest / 1000, unit: 'Kg' };
    return { value: valueInSmallest, unit: sUnit || '' };
  }

  return (
    <section className="screen">
      <div className="card">
        <div className="card-head">
          <div>
            <h3>Stok Gudang Pusat</h3>
            <p className="muted" style={{ margin: 0, marginTop: 4 }}>
              Stok fisik real-time vs batas minimum
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              className="input"
              placeholder="Cari nama barang..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: 200 }}
            />
            <Select
              value={catFilter}
              onChange={(val: any) => setCatFilter(String(val))}
              options={[
                { value: '', label: 'Semua Kategori' },
                ...categories.map((c: any) => ({ value: String(c.id), label: String(c.name) }))
              ]}
              style={{ width: 150 }}
            />
            <Select
              value={statusFilter}
              onChange={(val: any) => setStatusFilter(String(val))}
              options={[
                { value: '', label: 'Semua Status' },
                { value: 'SAFE', label: 'Aman' },
                { value: 'LOW', label: 'Stok Rendah' },
                { value: 'OUT', label: 'Habis' }
              ]}
              style={{ width: 140 }}
            />
          </div>
        </div>

        <div className="card-body flush">
          {loading ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Memuat inventaris...</div>
          ) : filteredItems.length === 0 ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Tidak ada barang ditemukan.</div>
          ) : (
            <>
              <div className="table-responsive">
                <Table>
                  <thead>
                    <tr>
                      <th style={{ width: 180 }}>Kode</th>
                      <th>Nama Barang</th>
                      <th className="right" style={{ width: 150 }}>Stok Min.</th>
                      <th className="right" style={{ width: 150 }}>Stok Fisik</th>
                      <th className="center" style={{ width: 140 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map((item: any) => {
                      const stock = Number(item.current_stock || 0);
                      const min = Number(item.minimum_threshold || 0);
                      
                      const centralStock = toCentralDisplay(stock, item);
                      const centralMin = toCentralDisplay(min, item);

                      const isOut = stock <= 0;
                      const isLow = stock < min && stock > 0;

                      return (
                        <tr key={item.id} onClick={() => setSelectedItemId(String(item.id))} className="cursor-pointer hover:bg-slate-50 transition-colors" title="Lihat Kartu Stok">
                          <td className="font-mono text-muted" style={{ paddingLeft: 16 }}>
                            {item.barcode || `ERC${String(item.id).padStart(5, '0')}`}
                          </td>
                          <td className="font-bold">{item.name}</td>
                          <td className="right">
                            <div className="num font-bold">{centralMin.value.toLocaleString('id-ID', { maximumFractionDigits: 0 })} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)' }}>{centralMin.unit}</span></div>
                            {centralMin.unit !== item.smallest_unit && <div className="muted" style={{ fontSize: 11 }}>({min.toLocaleString('id-ID')} {item.smallest_unit})</div>}
                          </td>
                          <td className="right">
                            <div className="num font-bold" style={{ color: isOut ? '#dc2626' : isLow ? '#d97706' : '#059669', fontSize: 14 }}>
                              {centralStock.value.toLocaleString('id-ID', { maximumFractionDigits: 0 })} <span style={{ fontSize: 12, fontWeight: 500, color: 'inherit', opacity: 0.8 }}>{centralStock.unit}</span>
                            </div>
                            {centralStock.unit !== item.smallest_unit && <div className="muted" style={{ fontSize: 11 }}>({stock.toLocaleString('id-ID')} {item.smallest_unit})</div>}
                          </td>
                          <td className="center">
                            <Badge variant={isOut ? 'red' : isLow ? 'amber' : 'green'}>
                              {isOut ? 'Habis' : isLow ? 'Stok Rendah' : 'Aman'}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredItems.length}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={setCurrentPage}
              />
            </>
          )}
        </div>
      </div>

      <Modal
        isOpen={!!selectedItemId}
        onClose={() => setSelectedItemId('')}
        title={`Kartu Stok — ${String(selectedItem?.name || '')}`}
        maxWidth={800}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, padding: '16px 24px', background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
          <div>
            <p className="muted" style={{ fontSize: 13, marginBottom: 4 }}>Sisa Stok Saat Ini</p>
            <div style={{ fontSize: 20, fontWeight: 700 }}>
              {(Number(currentBalance) / Number(selectedItem?.conversion_ratio || 1)).toLocaleString('id-ID', { maximumFractionDigits: 0 })} <span className="muted" style={{ fontSize: 14 }}>{String(selectedItem?.purchase_unit || selectedItem?.smallest_unit || '')}</span>
            </div>
            {Number(selectedItem?.conversion_ratio || 1) > 1 && (
              <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                ({Number(currentBalance).toLocaleString('id-ID')} {String(selectedItem?.smallest_unit || '')})
              </div>
            )}
          </div>
          <div>
            <p className="muted" style={{ fontSize: 13, marginBottom: 4 }}>Penerimaan Terakhir (MASUK)</p>
            <div style={{ fontWeight: 600 }}>
              {lastIn ? new Date(lastIn).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
            </div>
          </div>
          <div>
            <p className="muted" style={{ fontSize: 13, marginBottom: 4 }}>Distribusi Terakhir (KELUAR)</p>
            <div style={{ fontWeight: 600 }}>
              {lastOut ? new Date(lastOut).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
            </div>
          </div>
        </div>

        <div className="card-body flush" style={{ overflowY: 'visible' }}>
          {loading ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Memuat data kartu stok...</div>
          ) : logs.length === 0 ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>
              Tidak ada pergerakan inventaris yang tercatat untuk barang ini.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 24px', marginTop: 12, gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="date" className="input" style={{ height: 34, fontSize: 13 }} value={dateFilterStart} onChange={e => setDateFilterStart(e.target.value)} />
                  <span className="muted" style={{ fontSize: 13 }}>-</span>
                  <input type="date" className="input" style={{ height: 34, fontSize: 13 }} value={dateFilterEnd} onChange={e => setDateFilterEnd(e.target.value)} />
                </div>
                <Select
                  value={logFilter}
                  onChange={(val: any) => setLogFilter(String(val))}
                  options={[
                    { value: '', label: 'Semua Mutasi' },
                    { value: 'IN', label: 'Hanya Masuk' },
                    { value: 'OUT', label: 'Hanya Keluar' }
                  ]}
                  style={{ width: 180 }}
                  inputStyle={{ height: 34 }}
                />
              </div>
              <div className="table-responsive" style={{ maxHeight: '450px', overflowY: 'auto' }}>
                <Table>
                  <thead>
                    <tr>
                      <th style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', boxShadow: '0 1px 0 var(--border)' }}>Tanggal & Waktu</th>
                      <th style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', boxShadow: '0 1px 0 var(--border)' }}>Jenis Mutasi</th>
                      <th className="right" style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', boxShadow: '0 1px 0 var(--border)' }}>Perubahan (Jml)</th>
                      <th className="right" style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', boxShadow: '0 1px 0 var(--border)' }}>Nilai (Rp)</th>
                      <th className="right" style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', boxShadow: '0 1px 0 var(--border)' }}>Sisa Stok Akhir</th>
                      <th style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', boxShadow: '0 1px 0 var(--border)' }}>Referensi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.filter(log => {
                      if (logFilter && log.movement_type !== logFilter) return false;
                      const logDate = new Date(log.created_at);
                      if (dateFilterStart) {
                        const start = new Date(dateFilterStart);
                        start.setHours(0, 0, 0, 0);
                        if (logDate < start) return false;
                      }
                      if (dateFilterEnd) {
                        const end = new Date(dateFilterEnd);
                        end.setHours(23, 59, 59, 999);
                        if (logDate > end) return false;
                      }
                      return true;
                    }).map(log => {
                    const ratio = Number(selectedItem?.conversion_ratio || 1);
                    const convertedQtyChange = log.qty_change / ratio;
                    const convertedEndingBalance = log.ending_balance / ratio;

                    return (
                      <tr key={log.id}>
                        <td>
                          {new Date(log.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                          <div className="muted" style={{ fontSize: 12 }}>{new Date(log.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
                        </td>
                        <td>
                          <Badge variant={log.movement_type === 'IN' ? 'green' : log.movement_type === 'OUT' ? 'blue' : 'amber'}>
                            {log.movement_type === 'IN' ? 'Masuk' : log.movement_type === 'OUT' ? 'Keluar' : log.movement_type.charAt(0) + log.movement_type.slice(1).toLowerCase()}
                          </Badge>
                        </td>
                        <td className="right">
                          <div className="font-mono font-bold" style={{ color: log.movement_type === 'OUT' || log.qty_change < 0 ? '#dc2626' : '#16a34a' }}>
                            {log.qty_change > 0 ? '+' : ''}{Number(convertedQtyChange).toLocaleString('id-ID', { maximumFractionDigits: 0 })} <span style={{ fontSize: 11, fontWeight: 500, color: 'inherit', opacity: 0.8 }}>{String(selectedItem?.purchase_unit || selectedItem?.smallest_unit || '')}</span>
                          </div>
                          {ratio > 1 && (
                            <div className="muted font-mono" style={{ fontSize: 11 }}>
                              ({log.qty_change > 0 ? '+' : ''}{Number(log.qty_change).toLocaleString('id-ID')} {String(selectedItem?.smallest_unit || '')})
                            </div>
                          )}
                        </td>
                        <td className="right font-mono font-bold" style={{ color: log.movement_type === 'OUT' || log.qty_change < 0 ? '#dc2626' : 'inherit' }}>
                          Rp {Math.round((Math.abs(log.qty_change) / ratio) * Math.round(Number(selectedItem?.current_average_price || 0) * ratio)).toLocaleString('id-ID')}
                        </td>
                        <td className="right">
                          <div className="font-mono font-bold">
                            {Number(convertedEndingBalance).toLocaleString('id-ID', { maximumFractionDigits: 0 })} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)' }}>{String(selectedItem?.purchase_unit || selectedItem?.smallest_unit || '')}</span>
                          </div>
                          {ratio > 1 && (
                            <div className="muted font-mono" style={{ fontSize: 11 }}>
                              ({Number(log.ending_balance).toLocaleString('id-ID')} {String(selectedItem?.smallest_unit || '')})
                            </div>
                          )}
                        </td>
                        <td>
                          <div className="font-bold">
                            {log.reference_type === 'RECEIPT' ? 'Pembelian (PO)' : 
                             log.reference_type === 'ATOMIC_TRANSFER' ? 'Pengiriman ke Outlet' : 
                             log.reference_type === 'OPNAME_ADJUSTMENT' ? 'Stock Opname' : 
                             log.reference_type === 'ADJUSTMENT' ? 'Penyesuaian Stok' : 
                             log.reference_type === 'BARCODE_SCAN' ? 'Scan Surat Jalan' : 
                             log.reference_type === 'BULK_SHIP' ? 'Kirim Massal' : 
                             log.reference_type}
                          </div>
                          <div className="muted font-mono" style={{ fontSize: 12 }}>
                            {(log.reference_type === 'BARCODE_SCAN' || log.reference_type === 'BULK_SHIP') && log.do_id ? (
                              <Link href={`/delivery-orders/${log.do_id}`} className="text-[#016e3f] hover:underline font-medium">{log.do_number}</Link>
                            ) : log.reference_type === 'RECEIPT' && log.po_id ? (
                              <Link href={`/purchase-orders/${log.po_id}`} className="text-[#016e3f] hover:underline font-medium">{log.po_number}</Link>
                            ) : (log.reference_type === 'OPNAME_ADJUSTMENT' || log.reference_type === 'ADJUSTMENT') && log.reference_id ? (
                              <Link href={`/opname/central/${log.reference_id}`} className="text-[#016e3f] hover:underline font-medium">Ref ID: {log.reference_id}</Link>
                            ) : (
                              <span>Ref ID: {log.reference_id ?? '-'}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
            </div>
          )}
        </div>
      </Modal>
    </section>
  );
}
