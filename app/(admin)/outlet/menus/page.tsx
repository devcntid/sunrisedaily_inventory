'use client';
import { useState, useEffect, useCallback } from 'react';
import { Table } from '@/components/ui/Table';
import { Input } from '@/components/ui/Input';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
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
  id: number; name: string; default_unit: string | null;
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

import { CheckCircle2, AlertCircle, XCircle, Calculator, PackageSearch, FileText, ChevronLeft, ChevronRight, X, Pencil, Trash2, Package, Save, Eye, RefreshCw, Search } from 'lucide-react';

function MarginBadge({ flag }: { flag: string | null }) {
  if (!flag) return <span style={{ color: 'var(--muted)', fontSize: 11 }}>—</span>;
  const colors: Record<string, { bg: string; text: string; border: string; icon: any }> = {
    GREEN: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0', icon: CheckCircle2 },
    YELLOW: { bg: '#fefce8', text: '#a16207', border: '#fef08a', icon: AlertCircle },
    RED: { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca', icon: XCircle },
  };
  const c = colors[flag] ?? { bg: '#f8fafc', text: '#475569', border: '#e2e8f0', icon: CheckCircle2 };
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
  const [data, setData] = useState<MenuRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catId, setCatId] = useState('');
  const [marginFlag, setMarginFlag] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const [detailModal, setDetailModal] = useState<number | null>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
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
  }, [search, catId, marginFlag, page]);


  const openDetail = async (menuId: number) => {
    setDetailModal(menuId);
    setDetailLoading(true);
    setDetailData(null);
    try {
      const res = await fetch(`/api/outlet/menus/${menuId}`);
      if (res.ok) {
        const d = await res.json();
        setDetailData(d);
      }
    } finally {
      setDetailLoading(false);
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
          <span className="muted" style={{ fontSize: 12 }}>
            {total} Menu ditemukan
          </span>
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button className="btn btn-outline" style={{ padding: '2px 6px', display: 'flex', alignItems: 'center', height: 26, minWidth: 26, justifyContent: 'center' }} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft size={13} />
              </button>
              <div style={{ display: 'flex', gap: 3 }}>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let p = page;
                  if (totalPages <= 5) p = i + 1;
                  else if (page <= 3) p = i + 1;
                  else if (page >= totalPages - 2) p = totalPages - 4 + i;
                  else p = page - 2 + i;
                  return (
                    <button key={p} className={`btn ${p === page ? 'btn-primary' : 'btn-outline'}`} style={{ padding: '2px 6px', fontSize: 11, height: 26, minWidth: 26, justifyContent: 'center' }} onClick={() => setPage(p)}>
                      {p}
                    </button>
                  );
                })}
              </div>
              <button className="btn btn-outline" style={{ padding: '2px 6px', display: 'flex', alignItems: 'center', height: 26, minWidth: 26, justifyContent: 'center' }} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                <ChevronRight size={13} />
              </button>
            </div>
          )}
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
              <span className="font-bold" style={{ fontSize: 13, marginBottom: 4, color: '#12201a' }}>Indikator HPP %</span>
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

      {/* Table */}
      <div className="card-body flush">
        {loading ? (
          <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Memuat data...</div>
        ) : data.length === 0 ? (
          <div className="empty-state" style={{ padding: 40 }}>
            <p className="muted">Tidak ada data yang sesuai dengan filter.</p>
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Kategori</th>
                <th>Menu / Varian</th>
                <th className="right">Harga Jual</th>
                <th className="right">HPP</th>
                <th className="right">Laba Kotor</th>
                <th className="right">HPP %</th>
                <th className="right">Margin %</th>
                <th className="center">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map(row => (
                <tr key={row.id} onClick={() => openDetail(row.id)} style={{ cursor: 'pointer' }}>
                  <td><span style={{ fontSize: 12, color: 'var(--muted)', background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>{row.category_name}</span></td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{row.display_name ?? row.name}</div>
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
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>



      {/* Menu Detail Modal */}
      <Modal isOpen={!!detailModal} onClose={() => setDetailModal(null)} title="Detail Menu & HPP" maxWidth={680}>
        {detailLoading ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--muted)' }}>Memuat detail...</div>
        ) : detailData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Header Info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '0 4px' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{detailData.menu.display_name ?? detailData.menu.name}</div>
                {detailData.menu.variant && <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{detailData.menu.variant}</div>}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total HPP</div>
                <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--text)' }}>{rp(detailData.menu.hpp)}</div>
              </div>
            </div>


            {/* Ingredients Table */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>Komposisi Bahan Baku (Resep)</div>
              {detailData.ingredients?.length === 0 ? (
                <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                  Tidak ada resep yang terhubung ke menu ini di outlet Anda.
                </div>
              ) : (
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                  <Table>
                    <thead>
                      <tr>
                        <th>Bahan Baku</th>
                        <th className="right">Qty</th>
                        <th className="center">Satuan</th>
                        <th className="right">Harga/Satuan</th>
                        <th className="right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailData.ingredients.map((ing: any, idx: number) => (
                        <tr key={ing.ingredient_id || ing.item_id || idx}>
                          <td style={{ fontWeight: 500 }}>{ing.ingredient_name || ing.item_name}</td>
                          <td className="right">{Number(ing.qty || ing.quantity || 0).toLocaleString('id-ID')}</td>
                          <td className="center" style={{ color: 'var(--muted)', fontSize: 12 }}>{ing.unit}</td>
                          <td className="right" style={{ color: 'var(--muted)' }}>{Math.round(ing.cost_per_unit || 0).toLocaleString('id-ID')}</td>
                          <td className="right" style={{ fontWeight: 600 }}>{Math.round(ing.cost || 0).toLocaleString('id-ID')}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: '#f8fafc', borderTop: '2px solid var(--border)' }}>
                        <td colSpan={3} style={{ padding: '10px 14px', fontSize: 13 }}></td>
                        <td className="right" style={{ fontWeight: 600, fontSize: 13, padding: '10px 14px' }}>Total Biaya Bahan</td>
                        <td className="right" style={{ fontWeight: 700, color: '#016e3f', fontSize: 14, padding: '10px 14px' }}>
                          {Math.round(detailData.ingredients.reduce((sum: number, i: { cost: number | string }) => sum + Number(i.cost || 0), 0)).toLocaleString('id-ID')}
                        </td>
                      </tr>
                    </tfoot>
                  </Table>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ padding: 20, textAlign: 'center', color: 'red' }}>Failed to load data.</div>
        )}
      </Modal>
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
  const limit = 20;

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
  }, [search, venueId, page]);

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
          <span className="muted" style={{ fontSize: 12 }}>{total} resep</span>
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button className="btn btn-outline" style={{ padding: '2px 6px', display: 'flex', alignItems: 'center', height: 26, minWidth: 26, justifyContent: 'center' }} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft size={13} /></button>
              <div style={{ display: 'flex', gap: 3 }}>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let p = page;
                  if (totalPages <= 5) p = i + 1;
                  else if (page <= 3) p = i + 1;
                  else if (page >= totalPages - 2) p = totalPages - 4 + i;
                  else p = page - 2 + i;
                  return (
                    <button key={p} className={`btn ${p === page ? 'btn-primary' : 'btn-outline'}`} style={{ padding: '2px 6px', fontSize: 11, height: 26, minWidth: 26, justifyContent: 'center' }} onClick={() => setPage(p)}>{p}</button>
                  );
                })}
              </div>
              <button className="btn btn-outline" style={{ padding: '2px 6px', display: 'flex', alignItems: 'center', height: 26, minWidth: 26, justifyContent: 'center' }} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}><ChevronRight size={13} /></button>
            </div>
          )}
        </div>
      </div>

      <div className="card-body flush">
        {loading ? (
          <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Memuat data...</div>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Nama Resep</th>
                <th>Venue</th>
                <th className="right">Hasil (Yield)</th>
                <th className="right">Subtotal Bahan</th>
                <th className="right">Total HPP</th>
                <th className="right">Harga Jual</th>
              </tr>
            </thead>
            <tbody>
              {data.map(row => (
                <tr key={row.id} onClick={() => openViewRecipe(row.id)} style={{ cursor: 'pointer' }}>
                  <td style={{ fontWeight: 600 }}>{row.name}</td>
                  <td>
                    <div>{row.venue_name}</div>
                  </td>
                  <td className="right ">{Number(row.yield).toLocaleString('id-ID')} <span className="muted">{row.yield_unit ?? 'pcs'}</span></td>
                  <td className="right ">{rp(row.subtotal)}</td>
                  <td className="right " style={{ fontWeight: 700, color: '#016e3f' }}>{rp(row.total_cost)}</td>
                  <td className="right ">{row.sale_price ? rp(row.sale_price) : <span className="muted">Bahan Dasar</span>}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>



      {/* Recipe Viewer Modal */}
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
                <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hasil (Yield)</div>
                <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--text)' }}>
                  {Number(viewRecipeData.recipe.yield).toLocaleString('id-ID')} <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 400 }}>{viewRecipeData.recipe.yield_unit ?? 'pcs'}</span>
                </div>
              </div>
            </div>

            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <Table>
                <thead>
                  <tr>
                    <th>Bahan Baku</th>
                    <th className="right">Qty</th>
                    <th className="center">Satuan</th>
                  </tr>
                </thead>
                <tbody>
                  {(viewRecipeData.ingredients || []).map((ing: any, idx: number) => (
                    <tr key={ing.ingredient_id || ing.item_id || idx}>
                      <td style={{ fontWeight: 500 }}>{ing.ingredient_name || ing.item_name}</td>
                      <td className="right">{Number(ing.quantity || ing.qty || 0).toLocaleString('id-ID')}</td>
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
  const [masterItems, setMasterItems] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [toastInfo, setToastInfo] = useState<{ show: boolean, msg: string, type: 'success' | 'error' | 'info' }>({ show: false, msg: '', type: 'info' });
  const [deleting, setDeleting] = useState(false);
  const limit = 20;

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ item_id: '', name: '', default_unit: '', standard_cost_per_unit: '', description: '' });

  const load = useCallback(() => {
    setLoading(true);
    let url = `/api/hpp/ingredients?limit=${limit}&page=${page}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    fetch(url)
      .then(r => r.json())
      .then(d => { setData(d.data ?? []); setTotal(d.total ?? 0); })
      .finally(() => setLoading(false));
  }, [search, page]);

  useEffect(() => {
    load();
    fetch('/api/items').then(r => r.json()).then(d => {
      if (d.success) setMasterItems(d.data);
    });
  }, [load]);

  const handleOpenAdd = () => {
    setEditId(null);
    setForm({ item_id: '', name: '', default_unit: '', standard_cost_per_unit: '', description: '' });
    setModalOpen(true);
  };

  const handleOpenEdit = (row: any) => {
    setEditId(row.id);
    setForm({
      item_id: row.item_id ? String(row.item_id) : '',
      name: row.name,
      default_unit: row.default_unit || '',
      standard_cost_per_unit: row.standard_cost_per_unit ? String(row.standard_cost_per_unit) : '',
      description: row.description || ''
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name) return setToastInfo({ show: true, msg: 'Name is required', type: 'error' });
    setSaving(true);
    try {
      const payload = {
        item_id: form.item_id ? Number(form.item_id) : null,
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
      if (!res.ok) throw new Error('Failed to save');
      setModalOpen(false);
      load();
    } catch (e: unknown) {
      setToastInfo({ show: true, msg: (e instanceof Error ? e.message : 'Unknown error'), type: 'error' });
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
        throw new Error(d.error || 'Failed to delete');
      }
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
        <input className="input" placeholder="Cari nama bahan baku..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ width: 260 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
          <span className="muted" style={{ fontSize: 12 }}>{total} bahan baku</span>
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button className="btn btn-outline" style={{ padding: '2px 6px', display: 'flex', alignItems: 'center', height: 26, minWidth: 26, justifyContent: 'center' }} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft size={13} /></button>
              <div style={{ display: 'flex', gap: 3 }}>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let p = page;
                  if (totalPages <= 5) p = i + 1;
                  else if (page <= 3) p = i + 1;
                  else if (page >= totalPages - 2) p = totalPages - 4 + i;
                  else p = page - 2 + i;
                  return (
                    <button key={p} className={`btn ${p === page ? 'btn-primary' : 'btn-outline'}`} style={{ padding: '2px 6px', fontSize: 11, height: 26, minWidth: 26, justifyContent: 'center' }} onClick={() => setPage(p)}>{p}</button>
                  );
                })}
              </div>
              <button className="btn btn-outline" style={{ padding: '2px 6px', display: 'flex', alignItems: 'center', height: 26, minWidth: 26, justifyContent: 'center' }} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}><ChevronRight size={13} /></button>
            </div>
          )}
        </div>
      </div>

      <div className="card-body flush">
        {loading ? (
          <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Memuat data...</div>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Nama Bahan Baku</th>
                <th>Satuan</th>
                <th className="right">Biaya Standar/Satuan</th>
                <th className="right">Digunakan di Resep</th>
                <th>Deskripsi</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row: any) => (
                <tr key={row.id}>
                  <td style={{ fontWeight: 600 }}>
                    {row.name}
                    {row.is_linked && <span style={{ marginLeft: 8, fontSize: 10, background: '#e0e7ff', color: '#3730a3', padding: '2px 6px', borderRadius: 4 }}>Terhubung</span>}
                  </td>
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
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>



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
          <Table>
            <thead>
              <tr>
                <th>Nama Resep</th>

                <th className="right">Hasil (Yield)</th>
                <th className="right">Biaya Bahan</th>
                <th className="right">HPP (+10%)</th>
                <th className="right">Biaya/Satuan Hasil</th>
                <th className="right">Harga Jual</th>
                <th className="right">HPP %</th>
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
                  <td className="right ">{row.sale_price > 0 ? rp(row.sale_price) : <span className="muted">Bahan Dasar</span>}</td>
                  <td className="right " style={{ color: row.hpp_ratio_pct && row.hpp_ratio_pct > 50 ? '#dc2626' : row.hpp_ratio_pct && row.hpp_ratio_pct > 35 ? '#d97706' : '#166534' }}>
                    {row.hpp_ratio_pct != null ? `${row.hpp_ratio_pct}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </>
  );
}

// ─── Capacity Tab ───────────────────────────────────────────────
type CapacityItem = {
  moka_item_id: string;
  name: string;
  estimated_portions: number;
  has_ingredients: boolean;
  unit: string;
  breakdown: {
    ingredient_id: number;
    ingredient_name: string;
    needed_per_portion: number;
    current_stock: number;
    unit: string;
    estimated_portions: number;
  }[];
};

function CapacityTab() {
  const [data, setData] = useState<CapacityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'green' | 'yellow' | 'red'>('all');
  const [detailModalItem, setDetailModalItem] = useState<CapacityItem | null>(null);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sales-transactions/estimation');
      const json = await res.json();
      if (json.success) {
        setData(json.data || []);
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, limit]);

  const filteredData = data.filter(d => {
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase());
    const portions = Math.max(0, d.estimated_portions || 0);

    if (statusFilter === 'green') return matchSearch && d.has_ingredients && portions > 10;
    if (statusFilter === 'yellow') return matchSearch && d.has_ingredients && portions > 0 && portions <= 10;
    if (statusFilter === 'red') return matchSearch && d.has_ingredients && portions === 0;
    return matchSearch;
  });

  const totalPages = Math.ceil(filteredData.length / limit) || 1;
  const paginatedData = filteredData.slice((page - 1) * limit, page * limit);

  const getPageNumbers = () => {
    const pages: number[] = [];
    const maxVisible = 3;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: 220 }}>
            <Search style={{ position: 'absolute', left: 10, top: 7, width: 14, height: 14, color: 'var(--muted)' }} />
            <input type="text" placeholder="Search menu..." value={search} onChange={e => setSearch(e.target.value)} className="input" style={{ paddingLeft: 30, fontSize: 12, height: 28, width: '100%' }} />
          </div>
          <Select value={statusFilter} onChange={(val) => setStatusFilter(val as any)} options={[{ value: 'all', label: 'All Status' }, { value: 'green', label: 'Aman (> 10)' }, { value: 'yellow', label: 'Menipis (1 - 10)' }, { value: 'red', label: 'Habis (0)' }]} style={{ width: 160 }} inputStyle={{ padding: '2px 8px', fontSize: 12, height: 28 }} />
          <Select value={limit} onChange={(val) => setLimit(Number(val))} options={[{ value: 8, label: '8' }, { value: 15, label: '15' }, { value: 32, label: '32' }, { value: 50, label: '50' }]} style={{ width: 70 }} inputStyle={{ padding: '2px 6px', fontSize: 12, height: 28 }} />
          <Button variant="outline" onClick={fetchData} style={{ height: 28, fontSize: 12, padding: '0 10px', background: '#ffffff' }} disabled={loading}>
            <RefreshCw size={12} className={loading ? 'spin' : ''} style={{ marginRight: 6 }} /> Refresh
          </Button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, alignSelf: 'flex-end' }}>
          {!loading && totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button className="btn btn-outline" style={{ padding: '2px 6px', display: 'flex', alignItems: 'center', height: 26, minWidth: 26, justifyContent: 'center' }} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft size={13} /></button>
              <div style={{ display: 'flex', gap: 3 }}>
                {getPageNumbers().map(p => (
                  <button key={p} className={`btn ${p === page ? 'btn-primary' : 'btn-outline'}`} style={{ padding: '2px 6px', fontSize: 11, height: 26, minWidth: 26, justifyContent: 'center' }} onClick={() => setPage(p)}>{p}</button>
                ))}
              </div>
              <button className="btn btn-outline" style={{ padding: '2px 6px', display: 'flex', alignItems: 'center', height: 26, minWidth: 26, justifyContent: 'center' }} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}><ChevronRight size={13} /></button>
            </div>
          )}
          <span className="muted" style={{ fontSize: 12 }}>{filteredData.length} Menu</span>
        </div>
      </div>

      <div className="card-body flush">
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Mengkalkulasi estimasi porsi menu...</div>
        ) : data.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }} className="empty-state">
            <AlertCircle size={32} style={{ margin: '0 auto 12px', color: 'var(--muted)' }} />
            <h4 style={{ margin: '0 0 6px 0', fontSize: 15, fontWeight: 600 }}>Belum Ada Pemetaan Resep Moka</h4>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>Silakan hubungkan menu Moka POS dengan resep bahan baku di halaman Master Data Moka.</p>
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <th style={{ paddingLeft: 20 }}>NAMA MENU MOKA</th>
                <th className="center" style={{ width: 180 }}>ESTIMASI KAPASITAS</th>
                <th className="center" style={{ width: 180 }}>STATUS STOK</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.length === 0 ? (
                <tr><td colSpan={3} className="center" style={{ padding: 30, color: 'var(--muted)', fontSize: 13 }}>Tidak ada menu yang sesuai dengan filter pencarian.</td></tr>
              ) : (
                paginatedData.map(item => {
                  const portions = Math.max(0, item.estimated_portions || 0);

                  let badgeConfig = { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca', label: 'Habis' };
                  let numColor = 'var(--red)';

                  if (!item.has_ingredients) {
                    badgeConfig = { bg: '#f1f5f9', text: '#64748b', border: '#e2e8f0', label: 'Belum Ada Resep' };
                    numColor = 'var(--muted)';
                  } else if (portions > 10) {
                    badgeConfig = { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0', label: 'Aman' };
                    numColor = 'var(--foreground)';
                  } else if (portions > 0) {
                    badgeConfig = { bg: '#fefce8', text: '#a16207', border: '#fef08a', label: 'Menipis' };
                    numColor = '#d97706';
                  }

                  return (
                    <tr key={item.moka_item_id} onClick={() => setDetailModalItem(item)} style={{ cursor: 'pointer' }}>
                      <td style={{ paddingLeft: 20, fontWeight: 500, fontSize: 13, color: 'var(--foreground)' }}>
                        {item.name}
                      </td>
                      <td className="center">
                        {!item.has_ingredients ? (
                          <span style={{ fontSize: 13, color: 'var(--muted)' }}>—</span>
                        ) : (
                          <span style={{ fontSize: 13, fontWeight: 600, color: numColor }}>
                            {portions} <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--muted)' }}>{item.unit}</span>
                          </span>
                        )}
                      </td>
                      <td className="center">
                        <span style={{
                          background: badgeConfig.bg, color: badgeConfig.text, border: `1px solid ${badgeConfig.border}`,
                          padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 500,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          {badgeConfig.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </Table>
        )}
      </div>

      <Modal isOpen={!!detailModalItem} onClose={() => setDetailModalItem(null)} title="Detail Kapasitas Menu" maxWidth={700}>
        {detailModalItem && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{detailModalItem.name}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>Bahan baku yang menentukan batas maksimal porsi menu ini.</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Maks. Porsi</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: detailModalItem.estimated_portions > 10 ? 'var(--foreground)' : (detailModalItem.estimated_portions > 0 ? '#d97706' : 'var(--danger)') }}>
                  {detailModalItem.estimated_portions} <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--muted)' }}>{detailModalItem.unit}</span>
                </div>
              </div>
            </div>

            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <Table>
                <thead>
                  <tr>
                    <th>Bahan Baku</th>
                    <th className="right">Stok Saat Ini</th>
                    <th className="right">Kebutuhan / {detailModalItem.unit}</th>
                    <th className="right">Kapasitas Porsi</th>
                  </tr>
                </thead>
                <tbody>
                  {detailModalItem.breakdown.length === 0 ? (
                    <tr><td colSpan={4} className="center muted" style={{ padding: 20 }}>Belum ada resep bahan baku.</td></tr>
                  ) : (
                    detailModalItem.breakdown.map((b, i) => {
                      const isBottleneck = b.estimated_portions === detailModalItem.estimated_portions;
                      return (
                        <tr key={`breakdown-${b.ingredient_id}`} style={{ background: isBottleneck ? '#fef2f2' : undefined }}>
                          <td style={{ fontWeight: 500 }}>
                            {b.ingredient_name}
                            {isBottleneck && <span style={{ marginLeft: 8, fontSize: 10, background: '#fee2e2', color: '#b91c1c', padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap' }}>Limit Terendah</span>}
                          </td>
                          <td className="right font-mono" style={{ color: b.current_stock === 0 ? 'var(--danger)' : 'inherit' }}>
                            {Number(b.current_stock).toLocaleString('id-ID', { maximumFractionDigits: 3 })} <span className="muted font-sans" style={{ fontSize: 11 }}>{b.unit}</span>
                          </td>
                          <td className="right font-mono">
                            {Number(b.needed_per_portion).toLocaleString('id-ID', { maximumFractionDigits: 3 })} <span className="muted font-sans" style={{ fontSize: 11 }}>{b.unit}</span>
                          </td>
                          <td className="right font-mono font-bold" style={{ color: isBottleneck ? 'var(--danger)' : 'var(--foreground)' }}>
                            {Number(b.estimated_portions).toLocaleString('id-ID')} <span className="muted font-sans" style={{ fontSize: 11, fontWeight: 400 }}>{detailModalItem.unit}</span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </Table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <Button variant="primary" onClick={() => setDetailModalItem(null)}>Tutup</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function HppPage() {
  const [tab, setTab] = useState<'menus' | 'recipes' | 'ingredients' | 'kitchen'>('menus');
  const [stats, setStats] = useState<Stats | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);

  useEffect(() => {
    fetch('/api/hpp/stats').then(r => r.json()).then(setStats);
    fetch('/api/hpp').then(r => r.json()).then(d => {
      setCategories(d.categories ?? []);
      setVenues(d.venues ?? []);
    });
  }, []);

  const tabDefs = [
    { key: 'menus', label: 'Menu POS & Resep' },
    { key: 'ingredients', label: 'Bahan Baku' },
  ];

  const marginMap = (stats?.marginBreakdown ?? []).reduce((a, b) => ({ ...a, [b.flag]: b.count }), {} as Record<string, number>);

  return (
    <section className="screen">
      {/* Header */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <div>
            <h3>Menu POS & HPP</h3>
            <p className="muted" style={{ margin: '4px 0 0 0', fontSize: 13 }}>
              Daftar menu dan Harga Pokok Penjualan (HPP) Outlet.
            </p>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="card">
        {/* Tabs */}
        <div className="tabs" style={{ marginBottom: 0 }}>
          {tabDefs.map(t => (
            <button
              key={t.key}
              className={`tab${tab === t.key ? ' active' : ''}`}
              onClick={() => setTab(t.key as any)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'menus' && <MenusTab categories={categories} />}
        {tab === 'ingredients' && <IngredientsTab />}
      </div>
    </section>
  );
}
