'use client';
import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Plus, Trash2, Save } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Table } from '@/components/ui/Table';
import { Toast } from '@/components/ui/Toast';

export default function RecipeBuilderPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const router = useRouter();
  const isNew = params.id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [toastInfo, setToastInfo] = useState<{ show: boolean; msg: string; type: 'success' | 'error' | 'info' }>({ show: false, msg: '', type: 'info' });
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // Master Data
  const [venues, setVenues] = useState<{ id: number; name: string }[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [availableIngredients, setAvailableIngredients] = useState<{ id: number; name: string; standard_cost_per_unit: number; default_unit: string }[]>([]);
  const [availableMenus, setAvailableMenus] = useState<string[]>([]);
  const [menuSuggestions, setMenuSuggestions] = useState<string[]>([]);
  const [showMenuSuggestions, setShowMenuSuggestions] = useState(false);

  // Form State
  const [form, setForm] = useState({
    name: '',
    venue_id: '',
    yield_amount: '1',
    yield_unit: 'pcs',
    x_factor_pct: '10', // as integer percentage for UI
    sale_price: '0',
    category_id: '',
  });

  const [ingredients, setIngredients] = useState<{
    id: string; // temp UI id
    ingredient_id: string;
    ingredient_name: string;
    quantity: string;
    unit: string;
    cost_per_unit: number;
    extension: number;
  }[]>([]);

  const handleMenuNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setForm(f => ({ ...f, name: val }));
    if (val.trim()) {
      const filtered = availableMenus.filter(m => m.toLowerCase().includes(val.toLowerCase()) && m !== val);
      setMenuSuggestions(filtered);
      setShowMenuSuggestions(filtered.length > 0);
    } else {
      setShowMenuSuggestions(false);
    }
  };

  const selectSuggestion = (s: string) => {
    setForm(f => ({ ...f, name: s }));
    setShowMenuSuggestions(false);
  };

  const loadMasterData = async () => {
    const [venueRes, ingRes] = await Promise.all([
      fetch('/api/hpp?limit=1000'), // Returns venues and menus
      fetch('/api/hpp/ingredients?limit=1000') // Fetch all ingredients for dropdown
    ]);
    const venueData = await venueRes.json();
    const ingData = await ingRes.json();
    setVenues(venueData.venues ?? []);
    setCategories(venueData.categories ?? []);
    setAvailableIngredients(ingData.data ?? []);

    if (venueData.data) {
      const uniqueMenus = Array.from(new Set(venueData.data.map((m: any) => m.display_name || m.name)));
      setAvailableMenus(uniqueMenus as string[]);
    }
  };

  const loadRecipe = async () => {
    try {
      const res = await fetch(`/api/hpp/recipes/${params.id}`);
      if (!res.ok) throw new Error('Recipe not found');
      const data = await res.json();

      setForm({
        name: data.recipe.name,
        venue_id: String(data.recipe.venue_id),
        yield_amount: String(data.recipe.yield),
        yield_unit: data.recipe.yield_unit || '',
        x_factor_pct: String((Number(data.recipe.x_factor_pct) * 100).toFixed(0)),
        sale_price: data.recipe.sale_price ? String(Math.round(Number(data.recipe.sale_price))) : '0',
        category_id: data.recipe.category_id ? String(data.recipe.category_id) : '',
      });

      setIngredients(data.ingredients.map((ing: any) => ({
        id: Math.random().toString(36).substring(7),
        ingredient_id: String(ing.ingredient_id),
        ingredient_name: ing.ingredient_name || '',
        quantity: String(Number(ing.quantity)),
        unit: ing.default_unit || ing.unit || '',
        cost_per_unit: Number(ing.standard_cost_per_unit ?? ing.cost_per_unit),
        extension: Number(ing.quantity) * Number(ing.standard_cost_per_unit ?? ing.cost_per_unit),
      })));
    } catch (err: unknown) {
      setToastInfo({ show: true, msg: (err instanceof Error ? err.message : 'Unknown error'), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMasterData().then(() => {
      if (!isNew) {
        loadRecipe();
      } else {
        // If it's a new recipe, check if menu_id is provided to auto-fill
        const params = new URLSearchParams(window.location.search);
        const menuIdQuery = params.get('menu_id');
        if (menuIdQuery) {
          fetch(`/api/hpp/menus/${menuIdQuery}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
              if (data && data.menu) {
                setForm(f => ({
                  ...f,
                  name: data.menu.display_name || data.menu.name,
                  category_id: data.menu.category_id ? String(data.menu.category_id) : '',
                  sale_price: data.menu.sale_price ? String(Math.round(Number(data.menu.sale_price))) : '0',
                }));
              }
            })
            .catch(console.error);
        }
      }
    });
  }, [isNew]);

  // Calculations
  const subtotal = ingredients.reduce((sum, ing) => sum + ing.extension, 0);
  const xFactorValue = subtotal * (Number(form.x_factor_pct) / 100);
  const totalCost = subtotal + xFactorValue;

  const handleAddIngredient = () => {
    setIngredients([...ingredients, {
      id: Math.random().toString(36).substring(7),
      ingredient_id: '',
      ingredient_name: '',
      quantity: '1',
      unit: '',
      cost_per_unit: 0,
      extension: 0,
    }]);
  };

  const handleRemoveIngredient = (id: string) => {
    setIngredients(ingredients.filter(ing => ing.id !== id));
  };

  const handleIngredientChange = (id: string, field: string, value: string) => {
    setIngredients(prev => prev.map(ing => {
      if (ing.id !== id) return ing;

      const updated = { ...ing, [field]: value };

      if (field === 'ingredient_name') {
        const selected = availableIngredients.find(a => a.name === value);
        if (selected) {
          updated.ingredient_id = String(selected.id);
          updated.unit = selected.default_unit || '';
          updated.cost_per_unit = Number(selected.standard_cost_per_unit) || 0;
        } else {
          updated.ingredient_id = '';
        }
      }

      // Recalculate extension
      updated.extension = Number(updated.quantity) * Number(updated.cost_per_unit);

      return updated;
    }));
  };

  const handleSave = async () => {
    if (!form.name || !form.venue_id || !form.category_id || !form.yield_amount || !form.yield_unit || form.x_factor_pct === '' || form.sale_price === '') {
      setToastInfo({ show: true, msg: 'Harap isi semua kolom wajib.', type: 'error' });
      return;
    }

    // Validate ingredients
    for (const ing of ingredients) {
      if (!ing.ingredient_id || Number(ing.quantity) <= 0) {
        setToastInfo({ show: true, msg: 'Harap pilih bahan baku dan masukkan jumlah yang valid untuk semua baris.', type: 'error' });
        return;
      }
    }

    setSaving(true);

    const payload = {
      ...form,
      venue_id: Number(form.venue_id),
      category_id: form.category_id ? Number(form.category_id) : undefined,
      yield_amount: Number(form.yield_amount),
      x_factor_pct: Number(form.x_factor_pct) / 100,
      sale_price: Number(form.sale_price) || 0,
      ingredients: ingredients.map(ing => ({
        ingredient_id: Number(ing.ingredient_id),
        quantity: Number(ing.quantity),
        unit: ing.unit,
        cost_per_unit: ing.cost_per_unit,
      }))
    };

    try {
      const res = await fetch(isNew ? '/api/hpp/recipes' : `/api/hpp/recipes/${params.id}`, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save recipe');
      }

      setToastInfo({ show: true, msg: 'Data Produk berhasil disimpan!', type: 'success' });
      setTimeout(() => {
        router.push('/hpp');
      }, 1000);
    } catch (err: unknown) {
      setToastInfo({ show: true, msg: (err instanceof Error ? err.message : 'Unknown error'), type: 'error' });
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }} className="muted">Memuat data produk...</div>;

  return (
    <section className="screen" style={{ paddingBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn" onClick={() => router.push('/hpp')} style={{ display: 'flex', alignItems: 'center', padding: '4px 10px', fontSize: 12, height: 30 }}>
            <ChevronLeft size={16} /> Kembali
          </button>
          <h2 style={{ margin: 0, color: 'var(--foreground)', fontSize: 18 }}>{isNew ? 'Buat Produk Baru' : 'Edit Produk'}</h2>
        </div>

        <button className="btn btn-primary" style={{ padding: '4px 12px', fontSize: 12, height: 30, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }} onClick={handleSave} disabled={saving}>
          <Save size={14} />
          {saving ? 'Menyimpan...' : 'Simpan Produk'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'flex-start' }}>
        {/* LEFT COLUMN: Metadata */}
        <div className="card">
          <div className="card-head" style={{ padding: '10px 14px', background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: 13, margin: 0, fontWeight: 700 }}>Detail Produk</h3>
          </div>
          <div className="card-body" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ position: 'relative' }}>
              <Input label="Nama Produk / Menu" required placeholder="misal. Americano - Hot Medium" autoComplete="off" value={form.name} onChange={handleMenuNameChange} onFocus={handleMenuNameChange} onBlur={() => setTimeout(() => setShowMenuSuggestions(false), 200)} />
              {showMenuSuggestions && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid var(--border)', borderRadius: 4, zIndex: 10, maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', marginTop: 2 }}>
                  {menuSuggestions.map((s, idx) => (
                    <div key={idx} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: idx < menuSuggestions.length - 1 ? '1px solid var(--border)' : 'none' }} onClick={() => selectSuggestion(s)} onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                      {s}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group" style={{ marginBottom: undefined }}>
              <label className="form-label req">Kategori</label>
              <select required className="input" style={{ width: '100%', height: 34, fontSize: 12 }} value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                <option value="">Pilih...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
              <div className="form-group" style={{ marginBottom: undefined }}>
                <label className="form-label req">Lokasi (Venue)</label>
                <select className="input" style={{ width: '100%', height: 34, fontSize: 12 }} value={form.venue_id} onChange={e => setForm(f => ({ ...f, venue_id: e.target.value }))}>
                  <option value="">Pilih...</option>
                  {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <Input label="Hasil (Yield)" type="number" min="0.1" step="0.1" required value={form.yield_amount} onChange={e => setForm(f => ({ ...f, yield_amount: e.target.value }))} />
              <div className="form-group" style={{ marginBottom: undefined }}>
                <label className="form-label req">Satuan</label>
                <select required className="input" style={{ width: '100%', height: 34, fontSize: 12 }} value={form.yield_unit} onChange={e => setForm(f => ({ ...f, yield_unit: e.target.value }))}>
                  <option value="">Pilih...</option>
                  <option value="pcs">pcs</option>
                  <option value="porsi">porsi</option>
                  <option value="gelas">gelas</option>
                  <option value="cangkir">cangkir</option>
                  <option value="mangkuk">mangkuk</option>
                  <option value="loyang">loyang</option>
                  <option value="irisan">irisan</option>
                  <option value="botol">botol</option>
                  <option value="gram">gram</option>
                  <option value="ml">ml</option>
                  <option value="liter">liter</option>
                  {/* Fallback: tampilkan nilai lama dari DB jika tidak ada di daftar */}
                  {form.yield_unit && !['pcs','porsi','gelas','cangkir','mangkuk','loyang','irisan','botol','gram','ml','liter'].includes(form.yield_unit) && (
                    <option value={form.yield_unit}>{form.yield_unit}</option>
                  )}
                </select>
              </div>

              <Input label="X-Factor (%)" type="number" min="0" step="1" required value={form.x_factor_pct} onChange={e => setForm(f => ({ ...f, x_factor_pct: e.target.value }))} />
            </div>

            <Input 
              label="Harga Jual (Rp)" 
              type="text" 
              required 
              placeholder="misal. 35.000" 
              value={form.sale_price ? Number(form.sale_price).toLocaleString('id-ID') : ''} 
              onChange={e => {
                const val = e.target.value.replace(/\D/g, '');
                setForm(f => ({ ...f, sale_price: val }));
              }} 
            />
          </div>
        </div>

        {/* RIGHT COLUMN: Komposisi Bahan Baku Table */}
        <div className="card" style={{ overflow: 'visible' }}>
          <div className="card-head" style={{ padding: '10px 14px', background: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: 13, margin: 0, fontWeight: 700 }}>Komposisi Bahan Baku</h3>
            </div>
            <button className="btn" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '4px 10px', height: 28, background: '#edf7f2', color: '#016e3f', border: '1px solid #a8dab5', fontWeight: 600 }} onClick={handleAddIngredient}>
              <Plus size={13} /> Tambah Bahan
            </button>
          </div>

          <div className="card-body flush" style={{ overflow: 'visible' }}>
            <Table responsive={false} style={{ overflow: 'visible' }}>
              <thead>
                <tr style={{ fontSize: 12, background: '#f8fafc' }}>
                  <th style={{ width: '38%', padding: '10px 14px' }}>Bahan Baku</th>
                  <th style={{ width: '100px', padding: '10px 8px' }}>Jumlah</th>
                  <th style={{ width: '80px', padding: '10px 8px' }}>Satuan</th>
                  <th className="right" style={{ width: '120px', padding: '10px 8px' }}>Harga / Satuan</th>
                  <th className="right" style={{ width: '130px', padding: '10px 14px' }}>Total Biaya</th>
                  <th style={{ width: '40px', padding: '10px 4px' }}></th>
                </tr>
              </thead>
              <tbody>
                {ingredients.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 40 }} className="muted">
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>Belum ada bahan baku</div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>Klik tombol <strong>"+ Tambah Bahan"</strong> di atas untuk memasukkan bahan produk.</div>
                    </td>
                  </tr>
                ) : (
                  ingredients.map((ing, idx) => (
                    <tr key={ing.id}>
                      <td style={{ position: 'relative', padding: '8px 14px' }}>
                        <input
                          className="input"
                          placeholder="Ketik nama bahan..."
                          style={{ width: '100%', background: '#fff', height: 36, fontSize: 13, padding: '6px 10px' }}
                          value={ing.ingredient_name}
                          onChange={e => handleIngredientChange(ing.id, 'ingredient_name', e.target.value)}
                          onFocus={() => setActiveDropdown(ing.id)}
                          onBlur={() => setTimeout(() => setActiveDropdown(null), 200)}
                        />
                        {activeDropdown === ing.id && (
                          <div style={{
                            position: 'absolute', bottom: '100%', left: 14, right: 14,
                            background: '#fff', border: '1px solid var(--border)',
                            boxShadow: '0 -6px 12px -2px rgb(0 0 0 / 0.12)', zIndex: 50,
                            maxHeight: 200, overflowY: 'auto', borderRadius: 6,
                            marginBottom: 4
                          }}>
                            {availableIngredients
                              .filter(a => a.name.toLowerCase().includes(ing.ingredient_name.toLowerCase()))
                              .map(a => (
                                <div
                                  key={a.id}
                                  style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: '#1e293b', borderBottom: '1px solid #f1f5f9' }}
                                  onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'}
                                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleIngredientChange(ing.id, 'ingredient_name', a.name);
                                    setActiveDropdown(null);
                                  }}
                                >
                                  <div style={{ fontWeight: 600 }}>{a.name}</div>
                                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Satuan: {a.default_unit || '-'} | Harga: Rp {Math.round(Number(a.standard_cost_per_unit || 0)).toLocaleString('id-ID')} / {a.default_unit || 'unit'}</div>
                                </div>
                              ))}
                            {availableIngredients.filter(a => a.name.toLowerCase().includes(ing.ingredient_name.toLowerCase())).length === 0 && (
                              <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--muted)' }}>Bahan tidak ditemukan di Master Barang.</div>
                            )}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '8px 8px' }}>
                        <input className="input" type="number" min="0" step="0.1" style={{ width: '100%', height: 36, fontSize: 13, padding: '6px 8px' }} value={ing.quantity} onChange={e => handleIngredientChange(ing.id, 'quantity', e.target.value)} />
                      </td>
                      <td style={{ padding: '8px 8px' }}>
                        <input className="input" type="text" style={{ width: '100%', height: 36, fontSize: 13, padding: '6px 8px' }} value={ing.unit} onChange={e => handleIngredientChange(ing.id, 'unit', e.target.value)} />
                      </td>
                      <td className="right" style={{ padding: '8px 8px' }}>
                        <input className="input right" type="number" min="0" step="1" style={{ width: '100%', height: 36, fontSize: 13, padding: '6px 8px' }} value={ing.cost_per_unit} onChange={e => handleIngredientChange(ing.id, 'cost_per_unit', e.target.value)} />
                      </td>
                      <td className="right" style={{ fontWeight: 600, fontSize: 13, padding: '8px 14px', color: '#1e293b' }}>
                        Rp {Math.round(ing.extension).toLocaleString('id-ID')}
                      </td>
                      <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                        <button className="btn" style={{ padding: 6, color: '#dc2626', borderRadius: 4 }} onClick={() => handleRemoveIngredient(ing.id)} title="Hapus bahan">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {ingredients.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={4} className="right" style={{ fontWeight: 600, padding: '8px 14px', fontSize: 13, color: '#1e293b' }}>Subtotal Bahan:</td>
                    <td className="right" style={{ fontWeight: 600, padding: '8px 14px', fontSize: 13, color: '#1e293b' }}>Rp {Math.round(subtotal).toLocaleString('id-ID')}</td>
                    <td></td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="right" style={{ fontWeight: 600, padding: '6px 14px', fontSize: 13, color: '#1e293b' }}>X-Factor ({form.x_factor_pct}%):</td>
                    <td className="right" style={{ fontWeight: 600, padding: '6px 14px', fontSize: 13, color: '#1e293b' }}>Rp {Math.round(xFactorValue).toLocaleString('id-ID')}</td>
                    <td></td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="right" style={{ fontWeight: 700, fontSize: 13, color: '#1e293b', padding: '8px 14px' }}>Total Biaya Produk:</td>
                    <td className="right" style={{ fontWeight: 700, fontSize: 13, color: '#1e293b', padding: '8px 14px' }}>Rp {Math.round(totalCost).toLocaleString('id-ID')}</td>
                    <td></td>
                  </tr>
                  <tr style={{ background: '#f8fafc' }}>
                    <td colSpan={4} className="right" style={{ fontWeight: 700, fontSize: 13, color: '#016e3f', padding: '10px 14px' }}>
                      Total HPP per {form.yield_unit || 'portion'}:
                    </td>
                    <td className="right" style={{ fontWeight: 700, fontSize: 13, color: '#016e3f', padding: '10px 14px' }}>
                      Rp {Math.round(totalCost / (Number(form.yield_amount) || 1)).toLocaleString('id-ID')}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </Table>
          </div>
        </div>
      </div>

      <Toast isOpen={toastInfo.show} message={toastInfo.msg} type={toastInfo.type} onClose={() => setToastInfo({ ...toastInfo, show: false })} />
    </section>
  );
}
