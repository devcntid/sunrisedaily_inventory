'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { Toast } from '@/components/ui/Toast';

export default function MokaSyncCatalogButton() {
    const [isSyncing, setIsSyncing] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
    const [toastOpen, setToastOpen] = useState(false);
    const router = useRouter();

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setToastMessage(message);
        setToastType(type);
        setToastOpen(true);
    };

    const handleSyncMaster = async () => {
        setIsSyncing(true);
        try {
            // Fase 2: Sync Business & Outlets
            const bizRes = await fetch('/api/moka/sync/business', { method: 'POST' });
            if (!bizRes.ok) {
                const data = await bizRes.json();
                throw new Error(`Gagal menyinkronkan profil: ${data.message || 'Server error'}`);
            }

            // Fase 3: Sync Items
            const itemRes = await fetch('/api/moka/sync/items', { method: 'POST' });
            if (!itemRes.ok) {
                const data = await itemRes.json();
                throw new Error(`Gagal menyinkronkan produk: ${data.message || 'Server error'}`);
            }
            const itemData = await itemRes.json();

            showToast(`Sinkronisasi berhasil! ${itemData.message || 'Produk diperbarui.'}`, 'success');
            router.refresh();
        } catch (error: any) {
            console.error('Sync items error:', error);
            showToast(error.message || 'Terjadi kesalahan jaringan', 'error');
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <>
            <Toast 
                isOpen={toastOpen} 
                message={toastMessage} 
                type={toastType} 
                onClose={() => setToastOpen(false)} 
            />
            <button 
                onClick={handleSyncMaster} 
                disabled={isSyncing}
                className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-md hover:bg-gray-50 flex items-center gap-2 transition-colors disabled:opacity-50"
            >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-[#016e3f]' : ''}`} />
                {isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Sekarang'}
            </button>
        </>
    );
}
