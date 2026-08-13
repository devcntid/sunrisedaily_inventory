'use client';
import { useState, useEffect } from 'react';
import { Table } from '@/components/ui/Table';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';

type OutletStockRow = {
  item_id: number;
  item_name: string;
  category_name: string;
  current_balance: number;
  purchase_unit: string;
  smallest_unit: string;
  minimum_threshold: number | null;
  barcode: string | null;
};

function formatUnit(unit: string | null | undefined): string {
  if (!unit) return '';
  const u = unit.toLowerCase().trim();
  if (u === 'l') return 'Liter';
  if (u === 'g' || u === 'gr') return 'gram';
  return unit;
}

export default function OutletInventoryStockPage() {
  const [data, setData] = useState<OutletStockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = (silent = false) => {
    if (!silent) setLoading(true);
    fetch('/api/outlet/inventory')
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          setData(json.data);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveMin = async (itemId: number) => {
    if (saving) return;
    setSaving(true);
    try {
      const parsedStr = editValue.replace(/\./g, '').replace(',', '.');
      const val = parseFloat(parsedStr) || 0;
      const res = await fetch('/api/outlet/inventory/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, minimumThreshold: val })
      });
      if (res.ok) {
        setEditingId(null);
        fetchData(true); // reload silently
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };



  const categories = Array.from(new Set(data.map(d => d.category_name))).sort();

  const filteredData = data.filter(d => {
    const isLowStock = d.minimum_threshold !== null && d.current_balance <= d.minimum_threshold;
    const isOutOfStock = d.current_balance <= 0;
    const status = isOutOfStock ? 'OUT_OF_STOCK' : isLowStock ? 'LOW_STOCK' : 'AVAILABLE';

    const matchCategory = !categoryFilter || d.category_name === categoryFilter;
    const matchStatus = !statusFilter || status === statusFilter;
    const matchSearch = !search.trim() || (() => {
      const code = `ERC${String(d.item_id).padStart(6, '0')}`;
      return d.item_name.toLowerCase().includes(search.toLowerCase()) ||
        code.toLowerCase().includes(search.toLowerCase()) ||
        (d.barcode && d.barcode.toLowerCase().includes(search.toLowerCase()));
    })();

    return matchCategory && matchStatus && matchSearch;
  });

  const totalPages = Math.ceil(filteredData.length / limit);
  const paginatedData = filteredData.slice((page - 1) * limit, page * limit);

  return (
    <section className="screen">
      <div className="card">
        <div className="card-head" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 16 }}>
          <div>
            <h3 style={{ margin: 0 }}>Stok Inventaris Saat Ini</h3>
            <p className="hint" style={{ margin: 0, marginTop: 4 }}>Stok fisik bahan baku dan perlengkapan operasional saat ini di outlet.</p>
          </div>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', width: 220 }}>
                <Search style={{ position: 'absolute', left: 10, top: 8, width: 14, height: 14, color: 'var(--muted)' }} />
                <input
                  type="text"
                  className="input"
                  style={{ paddingLeft: 30, height: 32, fontSize: 13, width: '100%' }}
                  placeholder="Cari barang/barcode..."
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
              <Select
                value={categoryFilter}
                onChange={val => { setCategoryFilter(String(val)); setPage(1); }}
                options={[
                  { value: '', label: 'Semua Kategori' },
                  ...categories.map(c => ({ value: c, label: c }))
                ]}
                style={{ width: 160 }}
                inputStyle={{ height: 32, fontSize: 13 }}
              />
              <Select
                value={statusFilter}
                onChange={val => { setStatusFilter(String(val)); setPage(1); }}
                options={[
                  { value: '', label: 'Semua Status' },
                  { value: 'AVAILABLE', label: 'Tersedia' },
                  { value: 'LOW_STOCK', label: 'Stok Menipis' },
                  { value: 'OUT_OF_STOCK', label: 'Stok Habis' }
                ]}
                style={{ width: 140 }}
                inputStyle={{ height: 32, fontSize: 13 }}
              />
              <Select
                value={limit.toString()}
                onChange={val => { setLimit(Number(val)); setPage(1); }}
                options={[
                  { value: '15', label: '15' },
                  { value: '32', label: '32' },
                  { value: '50', label: '50' },
                  { value: '100', label: '100' }
                ]}
                style={{ width: 70 }}
                inputStyle={{ height: 32, fontSize: 13 }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button className="btn btn-outline" style={{ padding: '2px 6px', display: 'flex', alignItems: 'center', height: 26, minWidth: 26, justifyContent: 'center' }} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft size={13} /></button>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                      let p = page;
                      if (totalPages <= 3) p = i + 1;
                      else if (page <= 2) p = i + 1;
                      else if (page >= totalPages - 1) p = totalPages - 2 + i;
                      else p = page - 1 + i;
                      return (
                        <button key={p} className={`btn ${p === page ? 'btn-primary' : 'btn-outline'}`} style={{ padding: '2px 6px', fontSize: 11, height: 26, minWidth: 26, justifyContent: 'center' }} onClick={() => setPage(p)}>{p}</button>
                      );
                    })}
                  </div>
                  <button className="btn btn-outline" style={{ padding: '2px 6px', display: 'flex', alignItems: 'center', height: 26, minWidth: 26, justifyContent: 'center' }} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}><ChevronRight size={13} /></button>
                </div>
              )}
              <span className="muted" style={{ fontSize: 12 }}>{filteredData.length} barang</span>
            </div>
          </div>
        </div>

        <div className="card-body flush">
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }} className="muted">
              Memuat data stok...
            </div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th style={{ width: 100 }}>KODE</th>
                  <th style={{ width: 320 }}>BARANG</th>
                  <th style={{ width: 120 }}>SATUAN BELI</th>
                  <th style={{ width: 120 }}>SATUAN TERKECIL</th>
                  <th className="right" style={{ width: 160 }}>STOK</th>
                  <th className="right" style={{ width: 160 }}>MIN</th>
                  <th className="center" style={{ width: 100 }}>STATUS</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.map(row => {
                  const isLowStock = row.minimum_threshold !== null && row.current_balance <= row.minimum_threshold;
                  return (
                    <tr
                      key={row.item_id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        if (editingId !== row.item_id) {
                          setEditingId(row.item_id);
                          setEditValue(row.minimum_threshold != null ? row.minimum_threshold.toLocaleString('id-ID') : '0');
                        }
                      }}
                      title="Klik baris untuk mengubah stok minimum"
                    >
                      <td style={{ fontFamily: 'monospace', color: 'var(--muted)', fontSize: 13 }}>
                        {row.barcode || `ERC${String(row.item_id).padStart(6, '0')}`}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{row.item_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{row.category_name}</div>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--muted)' }}>{formatUnit(row.purchase_unit)}</td>
                      <td style={{ fontSize: 13, color: 'var(--muted)' }}>{formatUnit(row.smallest_unit)}</td>

                      <td className="right" style={{ fontSize: 13, color: isLowStock ? 'var(--red)' : 'var(--ink)' }}>
                        {row.current_balance.toLocaleString('id-ID')} <span style={{ fontSize: 12, color: 'var(--muted)' }}>{formatUnit(row.smallest_unit)}</span>
                      </td>

                      <td className="right">
                        <span style={{ fontSize: 13, color: 'var(--ink)' }}>
                          {row.minimum_threshold !== null ? (
                            <>{row.minimum_threshold.toLocaleString('id-ID')} <span style={{ fontSize: 12, color: 'var(--muted)' }}>{formatUnit(row.smallest_unit)}</span></>
                          ) : (
                            <span style={{ color: 'var(--muted)' }}>-</span>
                          )}
                        </span>
                      </td>

                      <td className="center">
                        {row.current_balance <= 0 ? (
                          <span className="badge badge-danger">Stok Habis</span>
                        ) : isLowStock ? (
                          <span className="badge" style={{ background: '#fef08a', color: '#854d0e' }}>Stok Menipis</span>
                        ) : (
                          <span className="badge badge-success">Tersedia</span>
                        )}
                      </td>
                      <td></td>
                    </tr>
                  );
                })}
                {filteredData.length === 0 && (
                  <tr>
                    <td colSpan={8} className="center muted" style={{ padding: 40 }}>
                      Tidak ada data stok yang cocok dengan pencarian/filter ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          )}
        </div>
      </div>
      <Modal
        isOpen={editingId !== null}
        onClose={() => setEditingId(null)}
        title="Ubah Stok Minimum"
        maxWidth={400}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setEditingId(null)} disabled={saving}>Batal</button>
            <button className="btn btn-primary" onClick={() => editingId !== null && handleSaveMin(editingId)} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </>
        }
      >
        <div style={{ padding: '10px 0' }}>
          <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 500 }}>
            Batas Minimum Baru untuk {editingId ? data.find(d => d.item_id === editingId)?.item_name : ''}
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="text"
              className="input"
              autoFocus
              style={{ flex: 1 }}
              value={editValue}
              onChange={e => {
                const clean = e.target.value.replace(/[^0-9,]/g, '');
                const parts = clean.split(',');
                let intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
                if (parts.length > 1) {
                  setEditValue(`${intPart},${parts.slice(1).join('')}`);
                } else {
                  setEditValue(intPart);
                }
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && editingId !== null) handleSaveMin(editingId);
              }}
            />
            <span style={{ color: 'var(--muted)', fontSize: 13 }}>
              {editingId ? formatUnit(data.find(d => d.item_id === editingId)?.smallest_unit) : ''}
            </span>
          </div>
        </div>
      </Modal>
    </section>
  );
}
