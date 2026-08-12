'use client';
import { useState, useEffect } from 'react';
import { Table } from '@/components/ui/Table';

interface Item {
  id: number; name: string; category_name: string; purchase_unit: string; smallest_unit: string;
}

export default function OutletItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/items?active_only=true')
      .then(r => r.json())
      .then(d => {
        setItems(d.data ?? []);
        setLoading(false);
      });
  }, []);

  const filtered = search.trim() 
    ? items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    : items;

  return (
    <section className="screen">
      <div className="card">
        <div className="tabs" style={{ marginBottom: 0 }}>
          <a href="/opname/outlet" className="tab" style={{ textDecoration: 'none', color: 'inherit' }}>Stock Opname</a>
          <a href="/outlet/items" className="tab active" style={{ textDecoration: 'none' }}>Item Reference</a>
        </div>
        <div className="card-head">
          <div>
            <h3>Item Reference</h3>
          </div>
          <input
            className="input"
            style={{ maxWidth: 300 }}
            placeholder="Search items..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="card-body flush">
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Loading item reference...</div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th style={{ width: 60 }}>No</th>
                  <th>Item Name</th>
                  <th>Category</th>
                  <th>Purchase Unit</th>
                  <th>Smallest Unit</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, idx) => (
                  <tr key={item.id}>
                    <td className="muted">{idx + 1}</td>
                    <td className="font-bold">{item.name}</td>
                    <td className="muted">{item.category_name}</td>
                    <td>{item.purchase_unit}</td>
                    <td>{item.smallest_unit}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="center muted" style={{ padding: 32 }}>No item found with that name.</td></tr>
                )}
              </tbody>
            </Table>
          )}
        </div>
      </div>
    </section>
  );
}
