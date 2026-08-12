'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Link, Unlink, RefreshCw } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Toast } from '@/components/ui/Toast';

export function ConnectMokaButton() {
    const [isLoading, setIsLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [clientId, setClientId] = useState('');
    const [clientSecret, setClientSecret] = useState('');
    const [error, setError] = useState('');

    const handleOpenModal = () => {
        setClientId('');
        setClientSecret('');
        setError('');
        setShowModal(true);
    };

    const handleConnect = async () => {
        if (!clientId.trim() || !clientSecret.trim()) {
            setError('Client ID and Client Secret are required.');
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            const res = await fetch('/api/moka/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ client_id: clientId.trim(), client_secret: clientSecret.trim() }),
            });
            const data = await res.json();
            if (!res.ok || !data.auth_url) {
                setError(data.error || 'Failed to initiate connection.');
                setIsLoading(false);
                return;
            }
            setShowModal(false);
            window.location.href = data.auth_url;
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <button
                onClick={handleOpenModal}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#016e3f] text-white rounded-md hover:bg-[#015933] transition-colors"
            >
                <Link className="w-3.5 h-3.5" />
                Hubungkan Akun
            </button>

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
                        <h3 className="text-sm font-bold text-gray-900 mb-1">Hubungkan Aplikasi Moka</h3>
                        <p className="text-xs text-gray-500 mb-5">
                            Masukkan Client ID dan Client Secret dari Portal Developer Moka. Setiap akun memiliki kredensial unik.
                        </p>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Client ID</label>
                                <input
                                    type="text"
                                    value={clientId}
                                    onChange={e => setClientId(e.target.value)}
                                    placeholder="Tempel Client ID Moka Anda..."
                                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#016e3f]/30 focus:border-[#016e3f]"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Client Secret</label>
                                <input
                                    type="password"
                                    value={clientSecret}
                                    onChange={e => setClientSecret(e.target.value)}
                                    placeholder="Tempel Client Secret Moka Anda..."
                                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#016e3f]/30 focus:border-[#016e3f]"
                                />
                            </div>
                            {error && <p className="text-xs text-red-500">{error}</p>}
                        </div>

                        <div className="flex items-center justify-end gap-2 mt-5">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleConnect}
                                disabled={isLoading}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#016e3f] text-white rounded-md hover:bg-[#015933] transition-colors disabled:opacity-50"
                            >
                                {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Link className="w-3.5 h-3.5" />}
                                Otorisasi & Hubungkan
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export function SyncMasterButton() {
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
            const bizRes = await fetch('/api/moka/sync/business', { method: 'POST' });
            if (!bizRes.ok) {
                const data = await bizRes.json();
                throw new Error(`Failed to sync profile: ${data.message || 'Server error'}`);
            }

            const itemRes = await fetch('/api/moka/sync/items', { method: 'POST' });
            if (!itemRes.ok) {
                const data = await itemRes.json();
                throw new Error(`Failed to sync products: ${data.message || 'Server error'}`);
            }
            const itemData = await itemRes.json();

            showToast(`Master sync successful! Profiles & ${itemData.message}`, 'success');
            router.refresh();
        } catch (error: any) {
            console.error('Error handling tokens:', error);
            showToast(error.message || 'Network error occurred', 'error');
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
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 hover:text-gray-900 hover:border-gray-400 transition-colors disabled:opacity-50"
            >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                Sync Katalog
            </button>
        </>
    );
}

export function DisconnectAccountButton({ businessId, accountName }: { businessId: number, accountName: string }) {
    const [isLoading, setIsLoading] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
    const [toastOpen, setToastOpen] = useState(false);
    const router = useRouter();

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setToastMessage(message);
        setToastType(type);
        setToastOpen(true);
    };

    const handleDisconnect = async () => {
        setShowConfirm(false);
        setIsLoading(true);
        try {
            const res = await fetch('/api/moka/disconnect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ business_id: businessId })
            });
            if (res.ok) {
                showToast(`Disconnected from ${accountName}`, 'success');
                router.refresh();
            } else {
                showToast('Failed to disconnect account', 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('System error occurred', 'error');
        } finally {
            setIsLoading(false);
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
                onClick={() => setShowConfirm(true)}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-red-200 text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors disabled:opacity-50"
            >
                {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
                Putuskan
            </button>

            <ConfirmDialog
                open={showConfirm}
                title={`Putuskan koneksi ${accountName}?`}
                message={`Apakah Anda yakin ingin memutuskan akun ${accountName}? Sistem tidak akan lagi mengambil data transaksi dari akun ini.`}
                confirmText="Ya, Putuskan"
                cancelText="Batal"
                onConfirm={handleDisconnect}
                onCancel={() => setShowConfirm(false)}
                danger={true}
            />
        </>
    );
}

export function SyncSalesButton() {
    const [isSyncing, setIsSyncing] = useState(false);

    const today = new Date();
    const todayStr = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    const startDate = todayStr;
    const endDate = todayStr;

    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
    const [toastOpen, setToastOpen] = useState(false);
    const router = useRouter();

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setToastMessage(message);
        setToastType(type);
        setToastOpen(true);
    };

    const handleSyncSales = async () => {
        if (!startDate || !endDate) {
            showToast('Silakan pilih rentang tanggal yang valid', 'error');
            return;
        }

        setIsSyncing(true);
        try {
            const res = await fetch('/api/moka/sync/sales', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    start_date: startDate,
                    end_date: endDate
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Gagal sinkronisasi data penjualan');

            showToast(data.message || 'Sinkronisasi penjualan berhasil!', 'success');
            router.refresh();
        } catch (error: any) {
            console.error('Error syncing sales:', error);
            showToast(error.message || 'Terjadi kesalahan sistem', 'error');
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
                onClick={handleSyncSales}
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 hover:text-gray-900 hover:border-gray-400 transition-colors disabled:opacity-50"
            >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                Sync Penjualan
            </button>
        </>
    );
}

export function SyncTransactionsButton() {
    const [isSyncing, setIsSyncing] = useState(false);

    const today = new Date();
    const todayStr = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    const startDate = todayStr;
    const endDate = todayStr;

    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
    const [toastOpen, setToastOpen] = useState(false);
    const router = useRouter();

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setToastMessage(message);
        setToastType(type);
        setToastOpen(true);
    };

    const handleSync = async () => {
        if (!startDate || !endDate) {
            showToast('Silakan pilih rentang tanggal yang valid', 'error');
            return;
        }

        setIsSyncing(true);
        try {
            const res = await fetch('/api/moka/sync/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    start_date: startDate,
                    end_date: endDate
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Gagal sinkronisasi data transaksi');

            showToast(data.message || 'Sinkronisasi transaksi berhasil!', 'success');
            router.refresh();
        } catch (error: any) {
            console.error('Error syncing transactions:', error);
            showToast(error.message || 'Terjadi kesalahan sistem', 'error');
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
                onClick={handleSync}
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 hover:text-gray-900 hover:border-gray-400 transition-colors disabled:opacity-50"
            >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                Sync Transaksi
            </button>
        </>
    );
}

export function SyncCustomersButton() {
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

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            const res = await fetch('/api/moka/sync/customers', { method: 'POST' });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(`Failed to sync customers: ${data.message || 'Server error'}`);
            }

            showToast(`Sinkronisasi pelanggan berhasil!`, 'success');
            router.refresh();
        } catch (error: any) {
            console.error('Error syncing customers:', error);
            showToast(error.message || 'Network error occurred', 'error');
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
                onClick={handleSync}
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 hover:text-gray-900 hover:border-gray-400 transition-colors disabled:opacity-50"
            >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                Sync Pelanggan
            </button>
        </>
    );
}
