'use client';
import React, { useEffect, useRef, useState } from 'react';

// We import BrowserMultiFormatReader dynamically or ensure the package is installed
// For now, since @zxing/browser is meant to be used on client:
import { BrowserMultiFormatReader } from '@zxing/browser';

interface BarcodeScannerProps {
  onScan: (result: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let controls: { stop: () => void } | null = null;
    const codeReader = new BrowserMultiFormatReader();

    if (videoRef.current) {
      codeReader.decodeFromVideoDevice(undefined, videoRef.current, (result: { getText: () => string } | null | undefined, err: Error & { name?: string } | null | undefined, ctrl: { stop: () => void }) => {
        if (ctrl) controls = ctrl;
        if (result) {
          if (controls) controls.stop();
          onScan(result.getText());
        }
        if (err && err.name !== 'NotFoundException') {
          console.warn('Barcode error:', err);
        }
      }).catch(err => {
        setError('Gagal mengakses kamera. Pastikan izin kamera diberikan.');
      });
    }

    return () => {
      if (controls) {
        controls.stop();
      }
    };
  }, [onScan]);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', padding: 24, borderRadius: 12, maxWidth: 400, width: '100%', textAlign: 'center' }}>
        <h3 style={{ marginTop: 0 }}>Scan Barcode</h3>
        {error ? (
          <p style={{ color: 'red' }}>{error}</p>
        ) : (
          <div style={{ width: '100%', height: 250, background: '#000', overflow: 'hidden', borderRadius: 8, margin: '16px 0' }}>
            <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}
        <button className="btn btn-outline" style={{ width: '100%' }} onClick={onClose}>
          Tutup Scanner
        </button>
      </div>
    </div>
  );
}
