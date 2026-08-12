import React, { useState, useEffect } from 'react';
import { Select } from '@/components/ui/Select';

interface Item {
  id: number;
  name: string;
  parent_id?: number | null;
  has_children?: boolean;
  purchase_unit?: string;
  current_average_price?: number;
  barcode?: string;
}

interface ItemSelectWithBrandProps {
  value: string | number;
  onChange: (value: string | number) => void;
  items?: Item[]; // Optional pre-fetched items
  placeholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  parentOnly?: boolean;
}

export function ItemSelectWithBrand({ value, onChange, items, placeholder = 'Ketik untuk mencari...', disabled, style, parentOnly = false }: ItemSelectWithBrandProps) {
  const [fetchedItems, setFetchedItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(!items);

  useEffect(() => {
    if (items) {
      setFetchedItems(items);
      setLoading(false);
    } else {
      fetch('/api/items?active_only=true')
        .then(r => r.json())
        .then(d => {
          setFetchedItems(d.data || []);
          setLoading(false);
        })
        .catch(e => {
          console.error('Failed to fetch items', e);
          setLoading(false);
        });
    }
  }, [items]);

  // Format options
  const options = React.useMemo(() => {
    const result: { value: string | number; label: string; isGroup?: boolean; disabled?: boolean }[] = [];
    
    // Pisahkan parent, standalone, dan children
    const parents = fetchedItems.filter(i => !i.parent_id && i.has_children);
    const standalones = fetchedItems.filter(i => !i.parent_id && !i.has_children);
    const children = fetchedItems.filter(i => i.parent_id);

    // 1. Tampilkan Parent beserta Children-nya
    parents.forEach(parent => {
      if (parentOnly) {
        result.push({
          value: parent.id,
          label: parent.name
        });
      } else {
        // Masukkan parent sebagai Group Header
        result.push({
          value: `group-${parent.id}`,
          label: `📦 ${parent.name}`,
          isGroup: true
        });

        // Cari anak-anaknya
        const myChildren = children.filter(c => c.parent_id === parent.id);
        myChildren.forEach(child => {
          result.push({
            value: child.id,
            label: `   ↳ ${child.name}` // indentasi
          });
        });
      }
    });

    // 2. Tampilkan Standalone items
    if (standalones.length > 0 && parents.length > 0) {
      result.push({ value: 'sep', label: 'Barang Lainnya', isGroup: true });
    }

    standalones.forEach(item => {
      result.push({
        value: item.id,
        label: item.name
      });
    });

    return result;
  }, [fetchedItems]);

  if (loading) {
    return (
      <div style={{ ...style, height: 36, display: 'flex', alignItems: 'center', padding: '0 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, color: '#94a3b8', fontSize: 13 }}>
        Memuat data...
      </div>
    );
  }

  return (
    <Select
      value={value}
      onChange={onChange}
      options={options}
      searchable
      placeholder={placeholder}
      disabled={disabled}
      style={style}
    />
  );
}
