import React, { useEffect, useRef, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

export function BarcodeScannerModal({
  isOpen,
  onClose,
  onScan
}: {
  isOpen: boolean;
  onClose: () => void;
  onScan: (text: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReaderRef = useRef<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    if (isOpen) {
      setError('');
      // Dynamic import to avoid SSR issues
      import('@zxing/library').then((zxing) => {
        const codeReader = new zxing.BrowserMultiFormatReader();
        codeReaderRef.current = codeReader;
        
        if (videoRef.current) {
          codeReader.decodeFromVideoDevice(null, videoRef.current, (result, err) => {
            if (result) {
              // Successfully decoded
              onScan(result.getText());
            }
            if (err && !(err instanceof zxing.NotFoundException)) {
              console.error(err);
            }
          }).catch((err) => {
            console.error(err);
            setError('Gagal mengakses kamera. Pastikan browser memiliki izin kamera.');
          });
        }
      });
    } else {
      if (codeReaderRef.current) {
        codeReaderRef.current.reset();
        codeReaderRef.current = null;
      }
    }

    return () => {
      if (codeReaderRef.current) {
        codeReaderRef.current.reset();
      }
    };
  }, [isOpen, onScan]);

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Scan Barcode Barang" 
      maxWidth={500}
    >
      <div style={{ padding: '16px' }}>
        {error ? (
          <div className="bg-red-50 text-red-700 p-4 rounded mb-4 text-center">
            {error}
          </div>
        ) : (
          <p className="text-gray-600 mb-4 text-center">
            Arahkan kamera ke barcode (EAN-13) pada kemasan fisik barang.
          </p>
        )}
        
        <div style={{ position: 'relative', width: '100%', borderRadius: 8, overflow: 'hidden', background: '#000', aspectRatio: '4/3' }}>
          <video 
            ref={videoRef} 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            muted 
            playsInline
          />
          {/* Scanning line animation overlay */}
          <div style={{
            position: 'absolute', top: '50%', left: 0, width: '100%', height: 2,
            background: 'red', boxShadow: '0 0 10px red',
            transform: 'translateY(-50%)', opacity: 0.7
          }}></div>
        </div>
        
        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={onClose}>Tutup Kamera</Button>
        </div>
      </div>
    </Modal>
  );
}
