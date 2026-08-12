'use client';

import { useState, useEffect } from 'react';
import { Toast } from '@/components/ui/Toast';
import { useRouter } from 'next/navigation';

export default function MokaToaster({ errorMsg, successMsg }: { errorMsg?: string, successMsg?: string }) {
    const [toast, setToast] = useState({ open: false, message: '', type: 'info' as any });
    const router = useRouter();

    useEffect(() => {
        if (successMsg) {
            setToast({ open: true, message: 'Berhasil Terhubung! Akun Moka berhasil diotorisasi.', type: 'success' });
            router.replace('/settings/moka'); // Clean up the URL parameters
        } else if (errorMsg) {
            let msg = errorMsg;
            if (errorMsg === 'no_code') msg = 'Tidak mendapatkan authorization code dari Moka.';
            else if (errorMsg === 'missing_env') msg = 'Konfigurasi .env Moka belum lengkap.';
            else if (errorMsg === 'moka_api_error') msg = 'Terjadi penolakan dari API Moka. Silakan coba lagi.';
            else if (errorMsg === 'db_error') msg = 'Gagal menyimpan token ke database.';
            else if (errorMsg === 'internal_error') msg = 'Terjadi kesalahan internal server.';
            setToast({ open: true, message: msg, type: 'error' });
            router.replace('/settings/moka'); // Clean up the URL parameters
        }
    }, [errorMsg, successMsg, router]);

    return (
        <Toast 
            isOpen={toast.open} 
            message={toast.message} 
            type={toast.type} 
            onClose={() => setToast({ ...toast, open: false })} 
        />
    );
}
