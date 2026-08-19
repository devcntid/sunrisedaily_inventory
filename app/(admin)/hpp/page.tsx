'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Table } from '@/components/ui/Table';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Pagination } from '@/components/ui/Pagination';
import { Toast } from '@/components/ui/Toast';

// ─── Types ───────────────────────────────────────────────────
type Category = { id: number; name: string };
type Venue = { id: number; name: string };

type MenuRow = {
  id: number; category_name: string; name: string;
  variant: string | null; display_name: string | null;
  sale_price: number; hpp: number | null; hpp_ratio: number | null;
  margin_flag: 'GREEN' | 'YELLOW' | 'RED' | null;
};
type RecipeRow = {
  id: number; venue_name: string; name: string;
  yield: number; yield_unit: string | null;
  subtotal: number | null; total_cost: number | null; sale_price: number | null;
};
type IngRow = {
  id: number; item_id?: number | null; name: string; default_unit: string | null;
  standard_cost_per_unit: number | null; description: string | null;
  used_in_recipes: number;
};
type KitchenRow = {
  recipe_id: bigint;
  recipe_name: string; yield_amount: number;
  yield_unit: string | null; sale_price: number;
  raw_cost: number | null; total_cost_with_xfactor: number | null;
  cost_per_unit_yield: number | null; hpp_ratio_pct: number | null;
};
type Stats = {
  totalMenus: number; totalIngredients: number; totalRecipes: number;
  byVenue: { venue: string; count: number }[];
  marginBreakdown: { flag: string; count: number }[];
};

// ─── Helpers ─────────────────────────────────────────────────
const rp = (v: number | null) =>
  v == null ? '—' : `Rp ${Math.round(Number(v)).toLocaleString('id-ID')}`;

const pct = (v: number | null) =>
  v == null ? '—' : `${(Number(v) * 100).toFixed(1)}%`;

import { CheckCircle2, AlertCircle, XCircle, Calculator, PackageSearch, FileText, ChevronLeft, ChevronRight, X, Pencil, Trash2, Package, Save, Eye, Download, Upload } from 'lucide-react';

function MarginBadge({ flag }: { flag: string | null }) {
  if (!flag) return <span style={{ color: 'var(--muted)', fontSize: 11 }}>—</span>;
  const HppStatusStyle: Record<string, { bg: string; text: string; border: string; icon: any }> = {
    GREEN: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0', icon: CheckCircle2 },
    YELLOW: { bg: '#fefce8', text: '#a16207', border: '#fef08a', icon: AlertCircle },
    RED: { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca', icon: XCircle },
  };
  const c = HppStatusStyle[flag] ?? { bg: '#f8fafc', text: '#475569', border: '#e2e8f0', icon: CheckCircle2 };
  const Icon = c.icon;
  return (
    <span style={{
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
      display: 'inline-flex', alignItems: 'center', gap: 4
    }}>
      <Icon size={12} strokeWidth={2.5} /> {flag.charAt(0) + flag.slice(1).toLowerCase()}
    </span>
  );
}

// ─── Tab components ───────────────────────────────────────────

function MenusTab({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [data, setData] = useState<MenuRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catId, setCatId] = useState('');
  const [marginFlag, setMarginFlag] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [toastInfo, setToastInfo] = useState<{ show: boolean; msg: string; type: 'success' | 'error' | 'info' }>({ show: false, msg: '', type: 'info' });

  const [deleteMenuConfirm, setDeleteMenuConfirm] = useState<number | null>(null);
  const [deletingMenu, setDeletingMenu] = useState(false);

  // Import Export Template State
  const [importPreviewData, setImportPreviewData] = useState<any[]>([]);
  const [importSummary, setImportSummary] = useState<any>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importingStatus, setImportingStatus] = useState(false);

  const handleUploadExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Clear input
    e.target.value = '';
    
    const formData = new FormData();
    formData.append('file', file);
    
    setToastInfo({ show: true, msg: 'Membaca file Excel...', type: 'info' });
    
    try {
      const res = await fetch('/api/hpp/template/preview', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      if (res.ok) {
        setImportPreviewData(data.data || []);
        setImportSummary(data.summary || null);
        setIsImportModalOpen(true);
        setToastInfo({ show: false, msg: '', type: 'info' }); // close loading toast
      } else {
        setToastInfo({ show: true, msg: data.error || 'Gagal membaca file', type: 'error' });
      }
    } catch (err: any) {
      setToastInfo({ show: true, msg: err.message || 'Error uploading file', type: 'error' });
    }
  };

  const handleConfirmImport = async () => {
    if (importPreviewData.length === 0 || !importSummary) return;
    if (importSummary.error > 0) {
      return setToastInfo({ show: true, msg: 'Masih ada data error, harap perbaiki file terlebih dahulu', type: 'error' });
    }

    setImportingStatus(true);
    try {
      const res = await fetch('/api/hpp/template/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: importPreviewData })
      });
      const resData = await res.json();
      
      if (res.ok) {
        setToastInfo({ show: true, msg: 'Berhasil mengimpor resep', type: 'success' });
        setIsImportModalOpen(false);
        load();
      } else {
        setToastInfo({ show: true, msg: resData.error || 'Gagal import data', type: 'error' });
      }
    } catch (err: any) {
      setToastInfo({ show: true, msg: err.message || 'Error importing data', type: 'error' });
    } finally {
      setImportingStatus(false);
    }
  };

  const load = useCallback(() => {
    setLoading(true);
    let url = `/api/hpp?limit=${limit}&page=${page}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (catId) url += `&category_id=${catId}`;
    if (marginFlag) url += `&margin_flag=${marginFlag}`;
    fetch(url)
      .then(r => r.json())
      .then(d => { setData(d.data ?? []); setTotal(d.total ?? 0); })
      .finally(() => setLoading(false));
  }, [search, catId, marginFlag, page, limit]);

  const openDetail = async (menuId: number) => {
    try {
      const res = await fetch(`/api/hpp/menus/${menuId}`);
      if (res.ok) {
        const d = await res.json();
        if (d.ingredients?.length > 0) {
          router.push(`/hpp/recipe-builder/${d.ingredients[0].recipe_id}`);
        } else {
          router.push(`/hpp/recipe-builder/new?menu_id=${menuId}`);
        }
      } else {
        setToastInfo({ show: true, msg: 'Gagal memuat resep', type: 'error' });
      }
    } catch (e) {
      setToastInfo({ show: true, msg: 'Gagal membuka resep', type: 'error' });
    }
  };

  const handleDeleteMenu = async () => {
    if (!deleteMenuConfirm) return;
    setDeletingMenu(true);
    try {
      const res = await fetch(`/api/hpp/menus/${deleteMenuConfirm}`, { method: 'DELETE' });
      if (res.ok) {
        setToastInfo({ show: true, msg: 'Menu POS berhasil dihapus', type: 'success' });
        setDeleteMenuConfirm(null);
        load();
      } else {
        const err = await res.json();
        setToastInfo({ show: true, msg: 'Gagal menghapus: ' + (err.error || ''), type: 'error' });
      }
    } catch (e: any) {
      setToastInfo({ show: true, msg: e.message || 'Unknown error', type: 'error' });
    } finally {
      setDeletingMenu(false);
    }
  };

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / limit);

  return (
    <>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="input" placeholder="Cari nama menu..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          style={{ width: 220 }}
        />
        <Select
          value={catId}
          onChange={val => { setCatId(String(val)); setPage(1); }}
          options={[
            { value: '', label: 'Semua Kategori' },
            ...categories.map(c => ({ value: String(c.id), label: c.name }))
          ]}
          style={{ width: 180 }}
          inputStyle={{ height: 32 }}
        />
        <Select
          value={marginFlag}
          onChange={val => { setMarginFlag(String(val)); setPage(1); }}
          options={[
            { value: '', label: 'Semua Margin' },
            { value: 'GREEN', label: 'Hijau (<35%)' },
            { value: 'YELLOW', label: 'Kuning (35–50%)' },
            { value: 'RED', label: 'Merah (>50%)' }
          ]}
          style={{ width: 150 }}
          inputStyle={{ height: 32 }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
          <div style={{ width: 70 }}>
            <Select 
              value={limit} 
              onChange={val => { setLimit(Number(val)); setPage(1); }}
              options={[{ value: 20, label: '20' }, { value: 50, label: '50' }, { value: 100, label: '100' }]}
              inputStyle={{ height: 32, fontSize: 13 }}
            />
          </div>
          <span className="muted" style={{ fontSize: 13, marginLeft: 8 }}>
            {total} Menu ditemukan
          </span>
          <a href="/hpp/recipe-builder/new" className="btn btn-sm btn-primary" style={{ textDecoration: 'none' }}>
            + Buat Data Produk
          </a>
          <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 4px' }} />
          <button onClick={() => window.open('/api/hpp/template/download', '_blank')} className="btn btn-sm" style={{ background: '#fff', border: '1px solid var(--border)' }}>
            <Download size={14} /> Download Template
          </button>
          <label className="btn btn-sm" style={{ background: '#fff', border: '1px solid var(--border)', cursor: 'pointer', margin: 0 }}>
            <Upload size={14} /> Upload Excel
            <input type="file" accept=".xlsx" style={{ display: 'none' }} onChange={handleUploadExcel} />
          </label>
          <div
            className="group"
            style={{ position: 'relative', cursor: 'help', color: 'var(--muted)', display: 'flex', alignItems: 'center' }}
          >
            <AlertCircle size={18} />
            <div
              className="hidden group-hover:flex"
              style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 8, zIndex: 50,
                background: '#fff', border: '1px solid var(--border)', borderRadius: 8,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: 12, width: 230,
                flexDirection: 'column', gap: 8
              }}
            >
              <span className="font-bold" style={{ fontSize: 13, marginBottom: 4, color: '#12201a' }}>Indikator % HPP</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e' }}></span>
                <span className="muted"><strong>Hijau</strong> (&lt; 35% - Sehat)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#eab308' }}></span>
                <span className="muted"><strong>Kuning</strong> (35–50% - Peringatan)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }}></span>
                <span className="muted"><strong>Merah</strong> (&gt; 50% - Kritis)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card-body flush">
        {loading ? (
          <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Memuat data...</div>
        ) : data.length === 0 ? (
          <div className="empty-state" style={{ padding: 40 }}>
            <p className="muted">Tidak ada data yang sesuai filter.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <Table>
              <thead>
                <tr>
                  <th>Kategori</th>
                  <th>Menu</th>
                  <th className="right">Harga Jual</th>
                  <th className="right">HPP</th>
                  <th className="right">Laba Kotor</th>
                  <th className="right">% HPP</th>
                  <th className="right">% Margin</th>
                  <th className="center">Status</th>
                  <th className="right" style={{ width: 90 }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {data.map(row => (
                  <tr key={row.id}>
                    <td><span style={{ fontSize: 12, color: 'var(--muted)', background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>{row.category_name}</span></td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{row.name}</div>
                      {row.variant && <div className="muted" style={{ fontSize: 12 }}>{row.variant}</div>}
                    </td>
                    <td className="right " style={{ fontWeight: 600 }}>{rp(row.sale_price)}</td>
                    <td className="right ">{rp(row.hpp)}</td>
                    <td className="right " style={{ fontWeight: 600, color: '#059669' }}>
                      {row.hpp == null ? '—' : rp(row.sale_price - row.hpp)}
                    </td>
                    <td className="right " style={{ color: row.hpp_ratio && row.hpp_ratio > 0.5 ? '#dc2626' : row.hpp_ratio && row.hpp_ratio > 0.35 ? '#d97706' : '#166534' }}>
                      {pct(row.hpp_ratio)}
                    </td>
                    <td className="right " style={{ fontWeight: 600 }}>
                      {row.hpp_ratio == null ? '—' : pct(1 - row.hpp_ratio)}
                    </td>
                    <td className="center"><MarginBadge flag={row.margin_flag} /></td>
                    <td className="right">
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', whiteSpace: 'nowrap' }}>
                        <button
                          className="btn btn-sm"
                          style={{ padding: '6px', color: '#3b82f6', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6 }}
                          onClick={() => openDetail(row.id)}
                          title="Edit Resep"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className="btn btn-sm"
                          style={{ padding: '6px', color: '#ef4444', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6 }}
                          onClick={() => setDeleteMenuConfirm(row.id)}
                          title="Hapus Menu"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </div>

      {/* Pagination */}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={total}
        itemsPerPage={limit}
        onPageChange={setPage}
      />


      <ConfirmDialog
        open={!!deleteMenuConfirm}
        danger={true}
        title="Hapus Menu POS"
        message="Yakin ingin menghapus menu ini? Tindakan ini permanen."
        confirmText="Ya, Hapus"
        cancelText="Batal"
        onConfirm={handleDeleteMenu}
        onCancel={() => setDeleteMenuConfirm(null)}
        loading={deletingMenu}
      />

      {/* Modal Import Preview */}
      <Modal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} title="Preview Import Resep Menu" maxWidth={1100}>
        <div style={{ padding: 20 }}>
          {importSummary && (
            <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Summary Bar */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ padding: '8px 14px', borderRadius: 8, background: '#f8fafc', border: '1px solid var(--border)', fontSize: 13 }}>
                  <strong>Total:</strong> {importSummary.total} baris
                </div>
                {importSummary.changed > 0 && (
                  <div style={{ padding: '8px 14px', borderRadius: 8, background: '#fffbeb', border: '1px solid #fcd34d', fontSize: 13, color: '#92400e' }}>
                    <strong>{importSummary.changed}</strong> perubahan terdeteksi
                  </div>
                )}
                {importSummary.error > 0 && (
                  <div style={{ padding: '8px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 13, color: '#b91c1c' }}>
                    <strong>{importSummary.error}</strong> error
                  </div>
                )}
                {importSummary.error === 0 && importSummary.changed === 0 && (
                  <div style={{ padding: '8px 14px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: 13, color: '#15803d' }}>
                    Tidak ada perubahan dari data yang ada
                  </div>
                )}
              </div>

              {/* Legend */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 12 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 4, background: '#fef9c3', border: '1px solid #fde047', color: '#713f12' }}>Diubah</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 4, background: '#dbeafe', border: '1px solid #93c5fd', color: '#1e3a8a' }}>Baru</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 4, background: '#fee2e2', border: '1px solid #fca5a5', color: '#7f1d1d' }}>Dihapus</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 4, background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569' }}>Sama</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 4, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>Error</span>
              </div>
              {importSummary.error > 0 && (
                <div style={{ padding: 10, borderRadius: 6, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 13, color: '#b91c1c' }}>
                  ⚠️ Masih terdapat error pada data. Harap perbaiki file Excel Anda dan upload kembali sebelum melanjutkan.
                </div>
              )}
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <Button variant="outline" onClick={() => setIsImportModalOpen(false)}>Batal</Button>
                <Button 
                  variant="primary" 
                  onClick={handleConfirmImport} 
                  disabled={!importSummary || importSummary.error > 0 || importingStatus}
                >
                  {importingStatus ? 'Menyimpan...' : `Proses Import`}
                </Button>
              </div>
            </div>
          )}

          <div style={{ maxHeight: 420, overflowY: 'auto', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <Table>
              <thead>
                <tr>
                  <th style={{ width: 55, textAlign: 'center' }}>Baris</th>
                  <th>Menu</th>
                  <th style={{ width: 120 }}>Varian</th>
                  <th>Bahan</th>
                  <th style={{ textAlign: 'right', width: 120 }}>Takaran</th>
                  <th style={{ width: 130 }}>Perubahan</th>
                </tr>
              </thead>
              <tbody>
                {importPreviewData.map((row, i) => {
                  // Determine row background by change status
                  const rowBg =
                    row.changeStatus === 'CHANGED'   ? '#fefce8' :
                    row.changeStatus === 'NEW'        ? '#eff6ff' :
                    row.changeStatus === 'REMOVED'    ? '#fef2f2' :
                    row.changeStatus === 'ERROR'      ? '#fef2f2' : 'transparent';

                  const changeBadge = () => {
                    if (row.changeStatus === 'CHANGED') return (
                      <div>
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 4, background: '#fef9c3', border: '1px solid #fde047', color: '#713f12', fontSize: 11, fontWeight: 600 }}>Diubah</span>
                        {row.changeDetail && <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{row.changeDetail}</div>}
                      </div>
                    );
                    if (row.changeStatus === 'NEW') return (
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 4, background: '#dbeafe', border: '1px solid #93c5fd', color: '#1e3a8a', fontSize: 11, fontWeight: 600 }}>Baru</span>
                    );
                    if (row.changeStatus === 'REMOVED') return (
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 4, background: '#fee2e2', border: '1px solid #fca5a5', color: '#7f1d1d', fontSize: 11, fontWeight: 600 }}>Dihapus</span>
                    );
                    if (row.changeStatus === 'ERROR') return (
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 4, background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', fontSize: 11, fontWeight: 600 }}>Error: {row.errorMessage}</span>
                    );
                    return (
                      <span style={{ color: '#94a3b8', fontSize: 12 }}>— Sama</span>
                    );
                  };

                  return (
                    <tr key={`import-row-${row.row_index ?? i}`} style={{ background: rowBg }}>
                      <td style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>{row.row_index ?? '—'}</td>
                      <td>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{row.nama_menu}</div>
                        <div className="muted" style={{ fontSize: 10 }}>ID: {row.menu_id}</div>
                      </td>
                      <td>
                        <span style={{ fontSize: 11, background: '#f1f5f9', padding: '1px 6px', borderRadius: 4, color: '#475569' }}>
                          {row.nama_varian && row.nama_varian !== '-' ? row.nama_varian : '—'}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: 13 }}>{row.nama_bahan}</div>
                        <div className="muted" style={{ fontSize: 10 }}>ID: {row.bahan_id}</div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, fontSize: 13 }}>
                        {row.takaran != null ? `${row.takaran} ${row.satuan}` : '—'}
                      </td>
                      <td>{changeBadge()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        </div>
      </Modal>

      <Toast isOpen={toastInfo.show} message={toastInfo.msg} type={toastInfo.type} onClose={() => setToastInfo({ ...toastInfo, show: false })} />
    </>
  );
}

function RecipesTab({ venues }: { venues: Venue[] }) {
  const [data, setData] = useState<RecipeRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [venueId, setVenueId] = useState('');
  const [page, setPage] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [toastInfo, setToastInfo] = useState<{ show: boolean, msg: string, type: 'success' | 'error' | 'info' }>({ show: false, msg: '', type: 'info' });
  const [deleting, setDeleting] = useState(false);
  const [limit, setLimit] = useState(20);

  const [viewRecipeModal, setViewRecipeModal] = useState<number | null>(null);
  const [viewRecipeData, setViewRecipeData] = useState<any>(null);
  const [viewRecipeLoading, setViewRecipeLoading] = useState(false);


  const load = useCallback(() => {
    setLoading(true);
    let url = `/api/hpp/recipes?limit=${limit}&page=${page}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (venueId) url += `&venue_id=${venueId}`;
    fetch(url)
      .then(r => r.json())
      .then(d => { setData(d.data ?? []); setTotal(d.total ?? 0); })
      .finally(() => setLoading(false));
  }, [search, venueId, page, limit]);

  const openViewRecipe = async (id: number) => {
    setViewRecipeModal(id);
    setViewRecipeLoading(true);
    setViewRecipeData(null);
    try {
      const res = await fetch(`/api/hpp/recipes/${id}`);
      if (res.ok) setViewRecipeData(await res.json());
    } finally {
      setViewRecipeLoading(false);
    }
  };

  useEffect(() => { load(); }, [load]);

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/hpp/recipes/${deleteConfirm}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete recipe');
      setDeleteConfirm(null);
      load();
    } catch (e: unknown) {
      setToastInfo({ show: true, msg: (e instanceof Error ? e.message : 'Unknown error'), type: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <>
      {toastInfo.show && <Toast isOpen={true} message={toastInfo.msg} type={toastInfo.type} onClose={() => setToastInfo({ ...toastInfo, show: false })} />}
      <div style={{ display: 'flex', gap: 12, padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="input" placeholder="Cari nama resep..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ width: 220 }} />
        <Select
          value={venueId}
          onChange={val => { setVenueId(String(val)); setPage(1); }}
          options={[
            { value: '', label: 'Semua Venue' },
            ...venues.map(v => ({ value: String(v.id), label: v.name }))
          ]}
          style={{ width: 150 }}
          inputStyle={{ height: 32 }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
          <div style={{ width: 70 }}>
            <Select 
              value={limit} 
              onChange={val => { setLimit(Number(val)); setPage(1); }}
              options={[{ value: 20, label: '20' }, { value: 50, label: '50' }, { value: 100, label: '100' }]}
              inputStyle={{ height: 32, fontSize: 13 }}
            />
          </div>
          <span className="muted" style={{ fontSize: 13 }}>{total} resep</span>
          <a href="/hpp/recipe-builder/new" className="btn btn-primary" style={{ textDecoration: 'none' }}>+ Tambah Resep</a>
        </div>
      </div>

      <div className="card-body flush">
        {loading ? (
          <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Memuat data...</div>
        ) : (
          <div className="table-responsive">
            <Table>
              <thead>
                <tr>
                  <th>Nama Resep</th>
                  <th>Venue</th>
                  <th className="right">Yield (Hasil)</th>
                  <th className="right">Subtotal Bahan</th>
                  <th className="right">Total HPP</th>
                  <th className="right">Harga Jual</th>
                  <th className="right" style={{ width: 120 }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {data.map(row => (
                  <tr key={row.id}>
                    <td style={{ fontWeight: 600 }}>{row.name}</td>
                    <td>
                      <div>{row.venue_name}</div>
                    </td>
                    <td className="right ">{Number(row.yield).toLocaleString('id-ID')} <span className="muted">{row.yield_unit ?? 'pcs'}</span></td>
                    <td className="right ">{rp(row.subtotal)}</td>
                    <td className="right " style={{ fontWeight: 700, color: '#016e3f' }}>{rp(row.total_cost)}</td>
                    <td className="right ">{row.sale_price ? rp(row.sale_price) : <span className="muted">Persiapan Dasar</span>}</td>
                    <td className="right">
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', whiteSpace: 'nowrap' }}>
                        <a href={`/hpp/recipe-builder/${row.id}`} className="btn" style={{ padding: '6px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe', borderRadius: 6 }}>
                          <Pencil size={14} />
                        </a>
                        <button className="btn" style={{ padding: '6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: 6 }} onClick={() => setDeleteConfirm(row.id)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </div>

      {/* Pagination */}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={total}
        itemsPerPage={limit}
        onPageChange={setPage}
      />

      <ConfirmDialog
        open={!!deleteConfirm}
        title="Hapus Resep?"
        message="Apakah Anda yakin ingin menghapus resep ini?"
        confirmText="Hapus"
        cancelText="Batal"
        danger={true}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />

      <Modal isOpen={!!viewRecipeModal} onClose={() => setViewRecipeModal(null)} title="Detail Resep" maxWidth={680}>
        {viewRecipeLoading ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--muted)' }}>Memuat resep...</div>
        ) : viewRecipeData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '0 4px' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{viewRecipeData.recipe.name}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
                  {viewRecipeData.recipe.venue_name}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Yield</div>
                <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--text)' }}>
                  {Number(viewRecipeData.recipe.yield).toLocaleString('id-ID')} <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 400 }}>{viewRecipeData.recipe.yield_unit ?? 'pcs'}</span>
                </div>
              </div>
            </div>

            <div className="table-responsive" style={{ border: '1px solid var(--border)', borderRadius: 8 }}>
              <Table>
                <thead>
                  <tr>
                    <th>Bahan Baku</th>
                    <th className="right">Jml</th>
                    <th className="center">Satuan</th>
                  </tr>
                </thead>
                <tbody>
                  {(viewRecipeData.ingredients || []).map((ing: any) => (
                    <tr key={ing.id}>
                      <td style={{ fontWeight: 500 }}>{ing.ingredient_name}</td>
                      <td className="right">{Number(ing.quantity).toLocaleString('id-ID')}</td>
                      <td className="center" style={{ color: 'var(--muted)', fontSize: 12 }}>{ing.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </div>
        ) : (
          <div style={{ padding: 20, textAlign: 'center', color: 'red' }}>Gagal memuat resep.</div>
        )}
      </Modal>
    </>
  );
}

function IngredientsTab() {
  const [data, setData] = useState<IngRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [limit, setLimit] = useState(20);

  const [toastInfo, setToastInfo] = useState<{ show: boolean; msg: string; type: 'success' | 'error' | 'info' }>({ show: false, msg: '', type: 'info' });
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ item_id: null as number | null, name: '', default_unit: '', standard_cost_per_unit: '', description: '' });
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [masterItems, setMasterItems] = useState<{
    id: number;
    name: string;
    smallest_unit: string;
    conversion_ratio: number;
    current_average_price: number;
    last_purchase_price?: number;
    parent_id?: number | null;
    has_children?: boolean;
  }[]>([]);

  useEffect(() => {
    fetch('/api/items?limit=1000&active_only=true')
      .then(r => r.json())
      .then(d => setMasterItems(d.data ?? []))
      .catch(() => { });
  }, []);

  const getCostPerSmallestUnit = (item: {
    current_average_price?: number | string;
    last_purchase_price?: number | string;
  }) => {
    const avg = Number(item.current_average_price || 0) || Number(item.last_purchase_price || 0);
    return Number(avg.toFixed(2));
  };

  const load = useCallback(() => {
    setLoading(true);
    let url = `/api/hpp/ingredients?limit=${limit}&page=${page}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    fetch(url)
      .then(r => r.json())
      .then(d => { setData(d.data ?? []); setTotal(d.total ?? 0); })
      .finally(() => setLoading(false));
  }, [search, page, limit]);

  useEffect(() => { load(); }, [load]);

  const handleOpenAdd = () => {
    setEditId(null);
    setForm({ item_id: null, name: '', default_unit: '', standard_cost_per_unit: '', description: '' });
    setModalOpen(true);
  };

  const handleOpenEdit = (row: IngRow) => {
    setEditId(row.id);
    setForm({
      item_id: row.item_id ?? null,
      name: row.name,
      default_unit: row.default_unit || '',
      standard_cost_per_unit: row.standard_cost_per_unit != null ? String(Number(row.standard_cost_per_unit)) : '',
      description: row.description || ''
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name) return setToastInfo({ show: true, msg: 'Nama bahan baku wajib diisi', type: 'error' });
    setSaving(true);
    try {
      const payload = {
        item_id: form.item_id || null,
        name: form.name,
        default_unit: form.default_unit,
        standard_cost_per_unit: Number(form.standard_cost_per_unit) || 0,
        description: form.description
      };
      const res = await fetch(editId ? `/api/hpp/ingredients/${editId}` : '/api/hpp/ingredients', {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to save');
      }
      setModalOpen(false);
      setToastInfo({ show: true, msg: 'Bahan baku berhasil disimpan', type: 'success' });
      load();
    } catch (e: unknown) {
      setToastInfo({ show: true, msg: e instanceof Error ? e.message : 'Unknown error', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/hpp/ingredients/${deleteConfirm}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Gagal menghapus');
      }
      setDeleteConfirm(null);
      setToastInfo({ show: true, msg: 'Bahan baku berhasil dihapus', type: 'success' });
      load();
    } catch (e: unknown) {
      setToastInfo({ show: true, msg: e instanceof Error ? e.message : 'Unknown error', type: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  const matchingMasterItems = masterItems
    .filter(i => !i.parent_id) // Hanya tampilkan item induk atau item single, sembunyikan varian/brand
    .filter(i => !form.name.trim() || i.name.toLowerCase().includes(form.name.trim().toLowerCase()))
    .slice(0, 50);

  return (
    <>
      <div style={{ display: 'flex', gap: 12, padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
        <input className="input" placeholder="Cari nama bahan baku..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ width: 260 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
          <div style={{ width: 70 }}>
            <Select 
              value={limit} 
              onChange={val => { setLimit(Number(val)); setPage(1); }}
              options={[{ value: 20, label: '20' }, { value: 50, label: '50' }, { value: 100, label: '100' }]}
              inputStyle={{ height: 32, fontSize: 13 }}
            />
          </div>
          <span className="muted" style={{ fontSize: 13 }}>{total} bahan baku</span>
          <button className="btn btn-primary" onClick={handleOpenAdd}>+ Tambah</button>
        </div>
      </div>

      <div className="card-body flush">
        {loading ? (
          <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Memuat data...</div>
        ) : (
          <div className="table-responsive">
            <Table>
              <thead>
                <tr>
                  <th>Nama Bahan Baku</th>
                  <th>Satuan</th>
                  <th className="right">Biaya Standar/Satuan</th>
                  <th className="right">Digunakan di Resep</th>
                  <th>Deskripsi</th>
                  <th className="right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {data.map(row => (
                  <tr key={row.id}>
                    <td style={{ fontWeight: 600 }}>{row.name}</td>
                    <td><span style={{ fontSize: 13 }}>{row.default_unit ?? '—'}</span></td>
                    <td className="right ">{rp(row.standard_cost_per_unit)}</td>
                    <td className="right">
                      <span style={{
                        background: row.used_in_recipes > 10 ? '#dcfce7' : '#f1f5f9',
                        color: row.used_in_recipes > 10 ? '#166534' : 'var(--muted)',
                        padding: '2px 8px', borderRadius: 99, fontSize: 12, fontWeight: 600,
                      }}>
                        {row.used_in_recipes}
                      </span>
                    </td>
                    <td className="muted" style={{ fontSize: 12 }}>{row.description ?? '—'}</td>
                    <td className="right">
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', whiteSpace: 'nowrap' }}>
                        <button className="btn" style={{ padding: '6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe', borderRadius: 6 }} onClick={() => handleOpenEdit(row)}>
                          <Pencil size={14} />
                        </button>
                        {row.used_in_recipes > 0 ? (
                          <button className="btn" style={{ padding: '6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', color: '#94a3b8', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'not-allowed' }} title="Tidak bisa dihapus karena sudah ditambahkan ke resep bahan produk">
                            <Trash2 size={14} />
                          </button>
                        ) : (
                          <button className="btn" style={{ padding: '6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: 6 }} onClick={() => setDeleteConfirm(row.id)} title="Hapus">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </div>

      {/* Pagination */}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={total}
        itemsPerPage={limit}
        onPageChange={setPage}
      />

      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520, padding: 0, overflow: 'hidden' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border)', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyItems: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                <div style={{ background: '#f1f5f9', padding: 8, borderRadius: 8, color: 'var(--foreground)', display: 'flex' }}>
                  <Package size={20} />
                </div>
                <h2 style={{ fontSize: 18, margin: 0, fontWeight: 700 }}>{editId ? 'Edit Bahan Baku' : 'Bahan Baku Baru'}</h2>
              </div>
              <button className="btn" style={{ border: 'none', padding: 6, color: 'var(--muted)', display: 'flex' }} onClick={() => setModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body form-grid" style={{ padding: '24px', gap: 20 }}>
              <div style={{ gridColumn: '1 / -1', position: 'relative' }}>
                <Input
                  label="Nama Bahan Baku"
                  placeholder="misal: Biji Kopi Arabika"
                  required
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value, item_id: null }))}
                  onFocus={() => setShowNameSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowNameSuggestions(false), 200)}
                />
                {showNameSuggestions && matchingMasterItems.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: '#ffffff',
                    border: '1px solid var(--border)',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                    zIndex: 99999,
                    maxHeight: 220,
                    overflowY: 'auto',
                    borderRadius: '6px',
                    marginTop: '4px'
                  }}>
                    {matchingMasterItems.map(item => {
                      const cost = getCostPerSmallestUnit(item);
                      const isParent = !item.parent_id && item.has_children;
                      const isChild = !!item.parent_id;

                      return (
                        <div
                          key={item.id}
                          style={{
                            padding: '10px 14px',
                            paddingLeft: isChild ? 24 : 14,
                            cursor: 'pointer',
                            fontSize: '13px',
                            color: 'var(--text)',
                            background: '#ffffff',
                            borderBottom: '1px solid #f1f5f9'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                          onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setForm(f => ({
                              ...f,
                              item_id: item.id,
                              name: item.name,
                              default_unit: item.smallest_unit || f.default_unit,
                              standard_cost_per_unit: String(cost)
                            }));
                            setShowNameSuggestions(false);
                          }}
                        >
                          {item.name}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <Input 
                label="Satuan Default" 
                placeholder="misal: gr, ml, pcs" 
                value={form.default_unit} 
                onChange={e => setForm(f => ({ ...f, default_unit: e.target.value }))} 
                readOnly={!!form.item_id}
                style={form.item_id ? { backgroundColor: '#f1f5f9', cursor: 'not-allowed', color: '#64748b' } : undefined}
              />
              <Input 
                label="Biaya Standar / Satuan" 
                placeholder="Rp 0" 
                type="number" 
                min="0" 
                step="any" 
                required 
                value={form.standard_cost_per_unit} 
                onChange={e => setForm(f => ({ ...f, standard_cost_per_unit: e.target.value }))} 
                readOnly={!!form.item_id}
                style={form.item_id ? { backgroundColor: '#f1f5f9', cursor: 'not-allowed', color: '#64748b' } : undefined}
              />

              <div style={{ gridColumn: '1 / -1' }} className="form-group">
                <label className="form-label">Deskripsi</label>
                <textarea className="input" rows={5} placeholder="Tambahkan catatan tentang harga atau konversi satuan di sini..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
            </div>

            <div className="modal-footer" style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button className="btn" style={{ padding: '8px 16px', fontWeight: 600, background: '#fff', border: '1px solid var(--border)' }} onClick={() => setModalOpen(false)}>Batal</button>
              <button className="btn btn-primary" style={{ padding: '8px 24px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }} onClick={handleSave} disabled={saving}>
                {saving ? null : <Save size={16} />}
                {saving ? 'Menyimpan...' : 'Simpan Data'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteConfirm}
        title="Hapus Bahan Baku?"
        message="Apakah Anda yakin ingin menghapus bahan baku ini?"
        confirmText="Hapus"
        cancelText="Batal"
        danger={true}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />

      <Toast isOpen={toastInfo.show} message={toastInfo.msg} type={toastInfo.type} onClose={() => setToastInfo({ ...toastInfo, show: false })} />
    </>
  );
}

function KitchenTab() {
  const [data, setData] = useState<KitchenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    fetch('/api/hpp/recipes?tab=kitchen')
      .then(r => r.json())
      .then(d => setData(d.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = data;

  return (
    <>
      <div style={{ display: 'flex', gap: 12, padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
        <span className="muted" style={{ fontSize: 13, marginLeft: 'auto' }}>{filtered.length} resep</span>
      </div>
      <div className="card-body flush">
        {loading ? (
          <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Memuat data...</div>
        ) : (
          <div className="table-responsive">
            <Table>
              <thead>
                <tr>
                  <th>Nama Resep</th>

                  <th className="right">Yield (Hasil)</th>
                  <th className="right">Biaya Bahan Baku</th>
                  <th className="right">HPP (+10%)</th>
                  <th className="right">Biaya/Satuan Yield</th>
                  <th className="right">Harga Jual</th>
                  <th className="right">% HPP</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => (
                  <tr key={String(row.recipe_id)}>
                    <td style={{ fontWeight: 600 }}>{row.recipe_name}</td>

                    <td className="right ">{Number(row.yield_amount).toLocaleString('id-ID')} <span className="muted">{row.yield_unit}</span></td>
                    <td className="right ">{rp(row.raw_cost)}</td>
                    <td className="right " style={{ fontWeight: 700, color: '#016e3f' }}>{rp(row.total_cost_with_xfactor)}</td>
                    <td className="right ">{rp(row.cost_per_unit_yield)}</td>
                    <td className="right ">{row.sale_price > 0 ? rp(row.sale_price) : <span className="muted">Persiapan Dasar</span>}</td>
                    <td className="right " style={{ color: row.hpp_ratio_pct && row.hpp_ratio_pct > 50 ? '#dc2626' : row.hpp_ratio_pct && row.hpp_ratio_pct > 35 ? '#d97706' : '#166534' }}>
                      {row.hpp_ratio_pct != null ? `${row.hpp_ratio_pct}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </div>
    </>
  );
}

function CategoriesTab({ onUpdated }: { onUpdated?: () => void }) {
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<Category | null>(null);
  const [toastInfo, setToastInfo] = useState<{ show: boolean, msg: string, type: 'success' | 'error' | 'info' }>({ show: false, msg: '', type: 'info' });

  const fetchCats = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/hpp/categories');
    const data = await res.json();
    setCats(data.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchCats(); }, [fetchCats]);

  async function handleAddSave() {
    if (!addName.trim()) { setToastInfo({ show: true, msg: 'Nama kategori wajib diisi', type: 'error' }); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/hpp/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: addName }) });
      const data = await res.json();
      if (!data.success) { setToastInfo({ show: true, msg: data.message || 'Gagal menyimpan', type: 'error' }); return; }
      setShowAddModal(false);
      setToastInfo({ show: true, msg: 'Berhasil ditambah', type: 'success' });
      fetchCats();
      if (onUpdated) onUpdated();
    } catch (e: any) {
      setToastInfo({ show: true, msg: e.message || 'Terjadi kesalahan', type: 'error' });
    } finally { setSaving(false); }
  }

  async function handleEditSave(id: number) {
    if (!editName.trim()) { setToastInfo({ show: true, msg: 'Nama kategori wajib diisi', type: 'error' }); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/hpp/categories', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, name: editName }) });
      const data = await res.json();
      if (!data.success) { setToastInfo({ show: true, msg: data.message || 'Gagal menyimpan', type: 'error' }); return; }
      setEditingId(null);
      setToastInfo({ show: true, msg: 'Berhasil diubah', type: 'success' });
      fetchCats();
      if (onUpdated) onUpdated();
    } catch (e: any) {
      setToastInfo({ show: true, msg: e.message || 'Terjadi kesalahan', type: 'error' });
    } finally { setSaving(false); }
  }

  async function executeDelete() {
    if (!confirmDelete) return;
    try {
      const res = await fetch(`/api/hpp/categories?id=${confirmDelete.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) { setToastInfo({ show: true, msg: data.message || 'Gagal menghapus', type: 'error' }); }
      else { setToastInfo({ show: true, msg: 'Berhasil dihapus', type: 'success' }); }
    } catch (e: any) {
      setToastInfo({ show: true, msg: e.message || 'Terjadi kesalahan', type: 'error' });
    }
    setConfirmDelete(null);
    fetchCats();
    if (onUpdated) onUpdated();
  }

  const totalPages = Math.ceil(cats.length / ITEMS_PER_PAGE);
  const paginatedCats = cats.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className="card-body flush" style={{ padding: '0 20px 40px' }}>
      {toastInfo.show && <Toast isOpen={true} message={toastInfo.msg} type={toastInfo.type} onClose={() => setToastInfo({ ...toastInfo, show: false })} />}
      
      <div style={{ maxWidth: 700, margin: '0 auto', background: '#fff', borderRadius: 8, border: '1px solid var(--border)', marginTop: 24, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Daftar Kategori</h4>
          <button className="btn btn-sm btn-primary" onClick={() => { setAddName(''); setShowAddModal(true); }}>
            + Tambah Kategori
          </button>
        </div>
        <div className="table-responsive">
          <Table>
            <thead>
              <tr>
                <th style={{ width: 60, textAlign: 'center' }}>No.</th>
                <th>Nama Kategori</th>
                <th style={{ width: 120, textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={3} style={{ textAlign: 'center', padding: 40 }} className="muted">Memuat data...</td></tr>
              ) : paginatedCats.length === 0 ? (
                <tr><td colSpan={3} style={{ textAlign: 'center', padding: 40 }} className="muted">Tidak ada kategori.</td></tr>
              ) : paginatedCats.map((c, i) => (
                <tr key={c.id}>
                  <td style={{ textAlign: 'center' }}>{(page - 1) * ITEMS_PER_PAGE + i + 1}</td>
                  <td>
                    {editingId === c.id ? (
                      <Input value={editName} onChange={e => setEditName(e.target.value)} autoFocus style={{ marginBottom: 0, height: 32 }} />
                    ) : c.name}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      {editingId === c.id ? (
                        <>
                          <button className="btn btn-sm btn-primary" onClick={() => handleEditSave(c.id)} disabled={saving}><Save size={14} /></button>
                          <button className="btn btn-sm btn-danger btn-outline" onClick={() => setEditingId(null)} disabled={saving}><X size={14} /></button>
                        </>
                      ) : (
                        <>
                          <button className="btn btn-sm" style={{ background: '#e0f2fe', color: '#0284c7', borderColor: '#bae6fd' }} onClick={() => { setEditingId(c.id); setEditName(c.name); }} title="Edit"><Pencil size={14} /></button>
                          <button className="btn btn-sm btn-danger btn-outline" onClick={() => setConfirmDelete(c)} title="Hapus"><Trash2 size={14} /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </div>

      {totalPages > 1 && (
        <div style={{ maxWidth: 700, margin: '20px auto 0' }}>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={cats.length}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={setPage}
          />
        </div>
      )}

      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Tambah Kategori">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input label="Nama Kategori" value={addName} onChange={e => setAddName(e.target.value)} required placeholder="Misal: Minuman Dingin" autoFocus />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Batal</button>
            <button className="btn btn-primary" onClick={handleAddSave} disabled={saving}>Simpan</button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog open={!!confirmDelete} title="Hapus Kategori" message={`Yakin ingin menghapus kategori "${confirmDelete?.name}"?`} confirmText="Hapus" onConfirm={executeDelete} onCancel={() => setConfirmDelete(null)} />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function HppPage() {
  const [tab, setTab] = useState<'menus' | 'recipes' | 'ingredients' | 'kitchen' | 'categories'>('menus');
  const [stats, setStats] = useState<Stats | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);

  const loadMasterData = useCallback(() => {
    fetch('/api/hpp/stats').then(r => r.json()).then(setStats);
    fetch('/api/hpp').then(r => r.json()).then(d => {
      setCategories(d.categories ?? []);
      setVenues(d.venues ?? []);
    });
  }, []);

  useEffect(() => { loadMasterData(); }, [loadMasterData]);

  const tabDefs = [
    { key: 'menus', label: 'Menu POS & Resep' },
    { key: 'ingredients', label: 'Bahan Baku' },
    { key: 'categories', label: 'Kategori Menu' },
  ] as const;

  const marginMap = (stats?.marginBreakdown ?? []).reduce((a, b) => ({ ...a, [b.flag]: b.count }), {} as Record<string, number>);

  return (
    <section className="screen">
      {/* Header */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <div>
            <h3>HPP & Resep</h3>
          </div>
        </div>

        {/* Stats row */}
        {stats && (
          <div style={{ display: 'flex', gap: 0, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
            {[
              { label: 'Total Menu POS', value: stats.totalMenus, iconColor: '#475569', icon: Calculator },
              { label: 'Total Resep', value: stats.totalRecipes, iconColor: '#475569', icon: FileText },
              { label: 'Bahan Baku', value: stats.totalIngredients, iconColor: '#475569', icon: PackageSearch },
              { label: 'Margin Hijau', value: marginMap['GREEN'] ?? 0, iconColor: '#15803d', icon: CheckCircle2 },
              { label: 'Margin Kuning', value: marginMap['YELLOW'] ?? 0, iconColor: '#a16207', icon: AlertCircle },
              { label: 'Margin Merah', value: marginMap['RED'] ?? 0, iconColor: '#b91c1c', icon: XCircle },
            ].map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.label} style={{
                  flex: '1 1 150px', padding: '16px 20px', borderRight: i < 5 ? '1px solid var(--border)' : 'none',
                  borderBottom: i < 3 ? '1px solid var(--border)' : 'none', // For wrap
                  display: 'flex', flexDirection: 'column', gap: 8
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon size={16} strokeWidth={2.5} style={{ color: s.iconColor }} />
                    <div className="muted" style={{ fontSize: 12, fontWeight: 500, color: '#64748b' }}>{s.label}</div>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--foreground)' }}>{s.value}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Venue row */}
        {/* Venue row */}
        {stats?.byVenue && stats.byVenue.length > 0 && (
          <div style={{ display: 'flex', gap: 16, padding: '12px 20px', borderTop: '1px solid var(--border)', background: '#f8fafc', flexWrap: 'wrap' }}>
            {stats.byVenue.map(v => (
              <div key={v.venue} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  background: v.count > 0 ? '#016e3f' : '#e2e8f0', 
                  color: v.count > 0 ? '#ffffff' : '#64748b',
                  padding: '2px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600,
                }}>{v.venue}</span>
                <span className="muted" style={{ fontSize: 12 }}>{v.count} resep</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="card">
        {/* Tabs */}
        <div className="tabs" style={{ marginBottom: 0 }}>
          {tabDefs.map(t => (
            <button
              key={t.key}
              className={`tab${tab === t.key ? ' active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'menus' && <MenusTab categories={categories} />}
        {tab === 'ingredients' && <IngredientsTab />}
        {tab === 'categories' && <CategoriesTab onUpdated={loadMasterData} />}
      </div>
    </section>
  );
}
