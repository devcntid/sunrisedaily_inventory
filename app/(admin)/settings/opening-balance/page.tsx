'use client';
import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { Toast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SettingsTabs } from '@/components/ui/SettingsTabs';
import { DownloadCloud, UploadCloud, Database } from 'lucide-react';

export default function OpeningBalancePage() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch('/api/items')
      .then(res => res.json())
      .then(data => {
        setItems(data.data ?? []);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const downloadTemplate = () => {
    // Generate template with current items
    const templateData = items.map(item => ({
      'Item ID (JANGAN DIUBAH)': item.id,
      'Kode Barang': `ERC${String(item.id).padStart(5, '0')}`,
      'Nama Barang': item.name,
      'Kategori': item.category_name,
      'Satuan Beli': item.purchase_unit,
      'Stok Fisik (Actual Qty)': 0
    }));

    const ws = XLSX.utils.json_to_sheet(templateData);
    
    // Auto-size columns
    const colWidths = [
      { wch: 25 }, { wch: 15 }, { wch: 40 }, { wch: 20 }, { wch: 15 }, { wch: 25 }
    ];
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template Stok Awal');
    
    XLSX.writeFile(wb, `Template_Stok_Awal_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError('');
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        // Map and validate data
        const validatedData = (data as any[]).map((row: any) => {
          const id = row['Item ID (JANGAN DIUBAH)'];
          const qty = row['Stok Fisik (Actual Qty)'];
          
          const matchedItem = items.find(i => i.id === id);
          
          return {
            item_id: id,
            item_name: matchedItem ? matchedItem.name : row['Nama Barang'] || 'Tidak Ditemukan',
            unit: matchedItem ? matchedItem.purchase_unit : '-',
            qty: parseFloat(qty) || 0,
            valid: !!matchedItem && qty !== undefined && !isNaN(parseFloat(qty)) && parseFloat(qty) >= 0
          };
        }).filter(row => row.qty > 0 || row.valid === false); // Only show rows that have qty > 0 or are invalid

        setPreviewData(validatedData);
      } catch (err: unknown) {
        setError('Gagal membaca file Excel. Pastikan formatnya sesuai template.');
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const handleSave = async () => {
    const invalidRows = previewData.filter(r => !r.valid);
    if (invalidRows.length > 0) {
      setError('Terdapat baris data yang tidak valid. Periksa kembali file Excel Anda.');
      setConfirmOpen(false);
      return;
    }

    const payload = previewData.map(r => ({
      item_id: r.item_id,
      actual_qty: r.qty
    }));

    setSaving(true);
    setConfirmOpen(false);

    try {
      const res = await fetch('/api/inventory/opening-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payload })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.message || 'Gagal menyimpan data');
      
      setSuccess(`Berhasil memigrasikan ${payload.length} barang ke stok awal!`);
      setPreviewData([]);
      setFile(null);
      // Reset input file
      const fileInput = document.getElementById('excel-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="screen">
      <SettingsTabs />
      
      <div className="card" style={{ maxWidth: 800, margin: '0 auto', boxShadow: '0 2px 12px rgba(0,0,0,0.03)' }}>
        <div className="card-head" style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: '#eef2ff', color: '#4f46e5', padding: 8, borderRadius: 8 }}>
              <Database size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', margin: 0, fontWeight: 700, color: '#1e293b' }}>Migrasi Stok Awal (Opening Balance)</h3>
              <p className="text-muted" style={{ margin: 0, marginTop: 2, fontSize: '12px' }}>
                Import data stok fisik ke dalam sistem untuk pertama kali menggunakan Excel.
              </p>
            </div>
          </div>
        </div>

        <div className="card-body" style={{ padding: 24 }}>
          <Toast isOpen={!!error} message={error} type="error" onClose={() => setError('')} />
          <Toast isOpen={!!success} message={success} type="success" onClose={() => setSuccess('')} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 32 }}>
            <div style={{ padding: 24, background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 12, textAlign: 'center', transition: 'all 0.2s' }}>
              <div style={{ display: 'inline-flex', background: '#fff', border: '1px solid #e2e8f0', padding: 12, borderRadius: '50%', marginBottom: 16 }}>
                <DownloadCloud size={24} color="#64748b" />
              </div>
              <h4 style={{ margin: '0 0 8px 0', fontSize: 14, fontWeight: 600 }}>1. Unduh Template</h4>
              <p className="text-muted" style={{ fontSize: 12, marginBottom: 20, lineHeight: 1.5 }}>
                Unduh file Excel berisi seluruh data Master Barang. Isi jumlah stok fisik di kolom yang disediakan.
              </p>
              <Button onClick={downloadTemplate} disabled={loading || items.length === 0} variant="outline" style={{ width: '100%', fontSize: 12 }}>
                {loading ? 'Memuat Data...' : 'Download Template Excel'}
              </Button>
            </div>

            <div style={{ padding: 24, background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 12, textAlign: 'center', transition: 'all 0.2s' }}>
              <div style={{ display: 'inline-flex', background: '#fff', border: '1px solid #e2e8f0', padding: 12, borderRadius: '50%', marginBottom: 16 }}>
                <UploadCloud size={24} color="#64748b" />
              </div>
              <h4 style={{ margin: '0 0 8px 0', fontSize: 14, fontWeight: 600 }}>2. Upload Data</h4>
              <p className="text-muted" style={{ fontSize: 12, marginBottom: 20, lineHeight: 1.5 }}>
                Pilih file Excel yang sudah Anda isi angka stoknya. Jangan mengubah Item ID.
              </p>
              <div style={{ position: 'relative' }}>
                <input 
                  id="excel-upload"
                  type="file" 
                  accept=".xlsx, .xls, .csv" 
                  onChange={handleFileUpload}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                />
                <Button variant="primary" style={{ width: '100%', fontSize: 12, pointerEvents: 'none' }}>
                  Pilih File Excel
                </Button>
              </div>
              {file && (
                <div style={{ marginTop: 12, fontSize: 11, color: '#10b981', fontWeight: 500 }}>
                  File terpilih: {file.name}
                </div>
              )}
            </div>
          </div>

          {previewData.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h4 style={{ margin: 0 }}>Pratinjau Data ({previewData.length} Barang)</h4>
                <Button 
                  variant="primary" 
                  onClick={() => setConfirmOpen(true)}
                  disabled={saving || previewData.some(r => !r.valid)}
                >
                  Eksekusi Import
                </Button>
              </div>
              
              <div className="table-responsive" style={{ maxHeight: 350, overflowY: 'auto', border: '1px solid #f1f5f9', borderRadius: 8 }}>
                <Table>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: '#f8fafc' }}>
                    <tr>
                      <th style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b' }}>ID</th>
                      <th style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b' }}>Nama Barang</th>
                      <th className="right" style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b' }}>Stok (Input)</th>
                      <th className="center" style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((row: any, idx: number) => (
                      <tr key={`ob-${row.item_id ?? idx}`} style={{ background: !row.valid ? '#fef2f2' : 'transparent' }}>
                        <td className="font-mono text-muted">{row.item_id}</td>
                        <td className="font-bold">{row.item_name}</td>
                        <td className="right font-bold num">{row.qty} <span className="muted" style={{ fontSize: 12 }}>{row.unit}</span></td>
                        <td className="center">
                          {row.valid ? (
                            <span className="text-green-600 font-medium text-sm">Valid</span>
                          ) : (
                            <span className="text-red-600 font-medium text-sm">Tidak Valid</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Konfirmasi Import Stok"
        message={`Anda akan memasukkan saldo awal untuk ${previewData.length} barang. Proses ini tidak bisa dibatalkan dan akan langsung menjadi stok aktif di gudang. Lanjutkan?`}
        onConfirm={handleSave}
        onCancel={() => setConfirmOpen(false)}
      />
    </section>
  );
}
