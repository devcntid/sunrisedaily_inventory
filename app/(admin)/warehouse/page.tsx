import { getPurchaseOrders } from '@/lib/queries/purchase-orders';
import Link from 'next/link';

export default async function WarehousePage() {
  // Fetch all POs, then filter in memory for simplicity or we can pass a specific param if our query supports it
  // Our getPurchaseOrders supports opts.status, but we need multiple statuses.
  // We'll just fetch all and filter for now.
  const allPOs = await getPurchaseOrders();
  
  const pendingReceipts = allPOs.filter(po => 
    po.status === 'PURCHASE_ORDER' || po.status === 'DITERIMA_SEBAGIAN'
  );
  
  const completedReceipts = allPOs.filter(po => po.status === 'SELESAI');

  return (
    <section className="screen">
      <div className="card">

        <div className="card-head">
          <div>
            <h3>Penerimaan Gudang</h3>
            <p className="muted" style={{ margin: 0, marginTop: 4 }}>Kelola penerimaan barang dari vendor (Surat Jalan Masuk)</p>
          </div>
        </div>

      <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', padding: 24 }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', background: '#f8fafc' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#1e293b' }}>Menunggu Penerimaan</h2>
        </div>
        
        {pendingReceipts.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
            <p>Tidak ada pengiriman dari vendor yang sedang ditunggu.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>NO PO</th>
                <th>VENDOR</th>
                <th>TANGGAL ORDER</th>
                <th>DEADLINE</th>
                <th>STATUS</th>
                <th>AKSI</th>
              </tr>
            </thead>
            <tbody>
              {pendingReceipts.map(po => (
                <tr key={po.id}>
                  <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{po.po_number}</td>
                  <td>{po.vendor_name}</td>
                  <td>{new Date(po.order_date).toLocaleDateString('id-ID')}</td>
                  <td>{po.order_deadline ? new Date(po.order_deadline).toLocaleDateString('id-ID') : '—'}</td>
                  <td>
                    <span style={{ 
                      background: po.status === 'DITERIMA_SEBAGIAN' ? '#fef08a' : '#bfdbfe',
                      color: po.status === 'DITERIMA_SEBAGIAN' ? '#854d0e' : '#1e40af',
                      padding: '4px 8px', borderRadius: 16, fontSize: 12, fontWeight: 600
                    }}>
                      {po.status === 'DITERIMA_SEBAGIAN' ? 'Parsial' : 'Menunggu'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Link href={`/warehouse/receipt/${po.id}`}>
                        <button className="btn btn-sm" style={{ background: 'var(--primary)', color: '#fff', border: 'none', whiteSpace: 'nowrap' }}>
                          {po.status === 'DITERIMA_SEBAGIAN' ? 'Terima Sisa' : 'Terima Barang'}
                        </button>
                      </Link>
                      {po.status === 'DITERIMA_SEBAGIAN' && (
                        <a href={`/api/purchase-orders/${po.id}/issue-pdf`} target="_blank" rel="noreferrer">
                          <button className="btn btn-sm" style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', whiteSpace: 'nowrap' }} title="Cetak Laporan Kekurangan Barang">
                            Cetak Retur
                          </button>
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      
      <div style={{ marginTop: 32, background: '#fff', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#1e293b' }}>Riwayat Selesai</h2>
        </div>
        <table className="data-table">
            <thead>
              <tr>
                <th>NO PO</th>
                <th>VENDOR</th>
                <th>TANGGAL ORDER</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {completedReceipts.slice(0, 5).map(po => (
                <tr key={po.id}>
                  <td style={{ fontWeight: 600 }}>{po.po_number}</td>
                  <td>{po.vendor_name}</td>
                  <td>{new Date(po.order_date).toLocaleDateString('id-ID')}</td>
                  <td>
                    <span style={{ background: '#dcfce7', color: '#166534', padding: '4px 8px', borderRadius: 16, fontSize: 12, fontWeight: 600 }}>
                      Selesai
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
        </table>
      </div>
      </div>
    </section>
  );
}
