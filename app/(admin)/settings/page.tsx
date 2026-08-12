'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SettingsTabs } from '@/components/ui/SettingsTabs';
import { Toast } from '@/components/ui/Toast';
import { HelpCircle } from 'lucide-react';

function InfoTooltip({ text, align = 'right', width = 230 }: { text: string; align?: 'left' | 'right' | 'center'; width?: number }) {
  const [hover, setHover] = useState(false);
  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: 6, cursor: 'help' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <HelpCircle size={15} color="#64748b" />
      {hover && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          ...(align === 'left' ? { left: 0 } : align === 'center' ? { left: '50%', transform: 'translateX(-50%)' } : { right: 0 }),
          marginBottom: 6,
          background: '#ffffff',
          color: '#1e293b',
          border: '1px solid #cbd5e1',
          fontSize: 11.5,
          fontWeight: 500,
          padding: '10px 12px',
          borderRadius: 8,
          width,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          zIndex: 9999,
          lineHeight: 1.4,
          textTransform: 'none'
        }}>
          {text}
        </div>
      )}
    </span>
  );
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', type: 'info' as any });
  const [settings, setSettings] = useState({
    company_name: '',
    notification_email: '',
    company_phone: '',
    company_tax_id: '',
    company_website: '',
    bank_account_info: '',
    warehouse_address: '',
    require_barcode_scan: 'true'
  });

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setSettings({
            company_name: data.data.company_name || '',
            notification_email: data.data.notification_email || '',
            company_phone: data.data.company_phone || '',
            company_tax_id: data.data.company_tax_id || '',
            company_website: data.data.company_website || '',
            bank_account_info: data.data.bank_account_info || '',
            warehouse_address: data.data.warehouse_address || '',
            require_barcode_scan: data.data.require_barcode_scan !== undefined ? data.data.require_barcode_scan : 'true'
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (data.success) {
        setToast({ open: true, message: 'Profil perusahaan berhasil disimpan!', type: 'success' });
      } else {
        setToast({ open: true, message: data.message || 'Gagal menyimpan pengaturan', type: 'error' });
      }
    } catch (e) {
      setToast({ open: true, message: 'Terjadi kesalahan sistem', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="screen">
      <SettingsTabs />
      <Toast isOpen={toast.open} message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, open: false })} />

      <div className="card" style={{ maxWidth: 900, margin: '0 auto', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <div className="card-head" style={{ padding: '14px 20px' }}>
          <div>
            <h3 style={{ fontSize: '15px', margin: 0, fontWeight: 700 }}>Profil Perusahaan</h3>
            <p className="text-muted" style={{ fontSize: '12px', marginTop: '4px', marginBottom: 0 }}>Pengaturan profil dan identitas aplikasi.</p>
          </div>
        </div>
        
        <div className="card-body" style={{ padding: '20px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#64748b', fontSize: 13 }}>
              Memuat pengaturan...
            </div>
          ) : (
            <form onSubmit={handleSave}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="form-group mb-0 md:col-span-2">
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Nama Perusahaan</label>
                  <Input 
                    value={settings.company_name} 
                    onChange={e => setSettings({...settings, company_name: e.target.value})} 
                    required 
                  />
                </div>
                
                <div className="form-group mb-0">
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Nomor Telepon</label>
                  <Input 
                    type="text" 
                    value={settings.company_phone} 
                    onChange={e => setSettings({...settings, company_phone: e.target.value})} 
                  />
                </div>

                <div className="form-group mb-0">
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Email Notifikasi Pusat</label>
                  <Input 
                    type="email" 
                    value={settings.notification_email} 
                    onChange={e => setSettings({...settings, notification_email: e.target.value})} 
                  />
                </div>

                <div className="form-group mb-0">
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">NPWP</label>
                  <Input 
                    type="text" 
                    value={settings.company_tax_id} 
                    onChange={e => setSettings({...settings, company_tax_id: e.target.value})} 
                  />
                </div>

                <div className="form-group mb-0">
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Website</label>
                  <Input 
                    type="text" 
                    value={settings.company_website} 
                    onChange={e => setSettings({...settings, company_website: e.target.value})} 
                  />
                </div>

                <div className="form-group mb-0 md:col-span-2">
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center">
                    Informasi Rekening Bank
                    <InfoTooltip text="Digunakan untuk referensi transfer internal atau pembayaran." width={260} />
                  </label>
                  <textarea 
                    className="form-control" 
                    rows={2}
                    value={settings.bank_account_info} 
                    onChange={e => setSettings({...settings, bank_account_info: e.target.value})} 
                    placeholder="Contoh: Bank BCA - 1234567890 a.n. PT Sunrise Daily"
                    style={{ padding: '10px 12px' }}
                  />
                </div>

                <div className="form-group mb-0 md:col-span-2">
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center">
                    Alamat Lengkap Gudang Pusat
                    <InfoTooltip text="Dicetak pada kop Surat Jalan dan PO." width={230} />
                  </label>
                  <textarea 
                    className="form-control" 
                    rows={2}
                    value={settings.warehouse_address} 
                    onChange={e => setSettings({...settings, warehouse_address: e.target.value})} 
                    style={{ padding: '10px 12px' }}
                  />
                </div>
              </div>

            {/* Pengaturan Operasional */}
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #e2e8f0' }}>
              <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-4">PENGATURAN OPERASIONAL</h2>
              <div style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', position: 'relative', flexShrink: 0, marginTop: 2 }}>
                  <input 
                    type="checkbox" 
                    id="require_barcode_scan"
                    checked={settings.require_barcode_scan === 'true'}
                    onChange={e => setSettings({...settings, require_barcode_scan: e.target.checked ? 'true' : 'false'})}
                    style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                  />
                  <div style={{
                    width: 44, height: 24, background: settings.require_barcode_scan === 'true' ? 'var(--primary)' : '#cbd5e1',
                    borderRadius: 24, position: 'relative', transition: 'background-color 0.3s'
                  }}>
                    <div style={{
                      width: 20, height: 20, background: '#fff', borderRadius: '50%',
                      position: 'absolute', top: 2, left: settings.require_barcode_scan === 'true' ? 22 : 2, transition: 'left 0.3s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                    }}/>
                  </div>
                </label>
                <div>
                  <label htmlFor="require_barcode_scan" className="text-[14px] font-bold text-gray-800 mb-1 cursor-pointer flex items-center">
                    Wajibkan Scan Barcode (Pengiriman & Penerimaan)
                    <InfoTooltip text="Jika dimatikan, staf bisa bypass scan barcode untuk mempercepat proses operasional." align="left" width={280} />
                  </label>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
                <Button variant="primary" type="submit" disabled={saving}>
                  {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
