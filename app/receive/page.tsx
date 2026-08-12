import { Suspense } from 'react';
import { Metadata } from 'next';
import ReceiveClient from './ReceiveClient';

export const metadata: Metadata = {
  title: 'Penerimaan Surat Jalan | Sunrise Daily',
  description: 'Konfirmasi penerimaan barang untuk Surat Jalan.',
};

export default function ReceivePage() {
  return (
    <Suspense fallback={
      <div style={{ height: '100vh', overflowY: 'auto', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Albert Sans, sans-serif' }}>
        <p style={{ color: '#64748b' }}>Memuat...</p>
      </div>
    }>
      <ReceiveClient />
    </Suspense>
  );
}
