import { getAllActiveMokaTokens } from '@/lib/queries/moka';
import { getSyncStatus, getOutletsByBusinessId } from '@/lib/queries/moka_sync';
import { ConnectMokaButton, SyncMasterButton, DisconnectAccountButton, SyncSalesButton, SyncTransactionsButton, SyncCustomersButton } from '@/components/moka/MokaActions';
import MokaToaster from '@/components/moka/MokaToaster';
import { Store, AlertCircle, Database } from 'lucide-react';
import Link from 'next/link';

export default async function MokaIntegrationPage(props: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const searchParams = await props.searchParams;
    const tokens = await getAllActiveMokaTokens();
    
    const selectedAccountId = searchParams.account_id as string || (tokens.length > 0 ? tokens[0].business_id.toString() : null);
    const syncStatus = await getSyncStatus(selectedAccountId);
    const mappedOutlets = selectedAccountId ? await getOutletsByBusinessId(selectedAccountId) : [];

    const errorMsg = searchParams.error as string;
    const successMsg = searchParams.success as string;

    return (
        <section className="screen">
            <MokaToaster errorMsg={errorMsg} successMsg={successMsg} />
            <div className="card">
                <div className="card-head" style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6' }}>
                    <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3 w-full">
                        <div>
                            <h3 style={{ fontSize: '16px', margin: 0, fontWeight: 700, color: '#111827' }}>Akun Terhubung Moka POS</h3>
                            <p className="text-muted" style={{ fontSize: '12px', marginTop: '4px', marginBottom: 0 }}>
                                Kelola akun Moka POS yang terhubung untuk sinkronisasi Katalog Moka, Ringkasan Penjualan, Data Transaksi, dan Data Pelanggan.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {tokens.length > 0 && (
                                <>
                                    <SyncMasterButton />
                                    <SyncSalesButton />
                                    <SyncTransactionsButton />
                                    <SyncCustomersButton />
                                </>
                            )}
                            <ConnectMokaButton />
                        </div>
                    </div>
                </div>

                <div className="card-body bg-gray-50/30" style={{ padding: '20px' }}>
                    {tokens.length === 0 ? (
                        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center shadow-sm">
                            <div className="w-12 h-12 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Store className="w-6 h-6" />
                            </div>
                            <h4 className="text-sm font-bold text-gray-900 mb-1">Belum Ada Akun Terhubung</h4>
                            <p className="text-xs text-gray-500 max-w-sm mx-auto mb-4">
                                Anda belum menghubungkan akun Moka POS. Klik tombol di atas untuk menghubungkan akun pertama Anda.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                            
                            {/* Left Column: Accounts List */}
                            <div className="lg:col-span-2 space-y-4">
                                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                    <Database className="w-4 h-4 text-[#016e3f]" />
                                    Daftar Akun Terhubung ({tokens.length})
                                </h3>
                                
                                <div className="space-y-3">
                                    {tokens.map((token: any) => {
                                        const isSelected = selectedAccountId === token.business_id.toString();
                                        return (
                                        <div key={token.id} className={`relative p-4 rounded-xl border transition-colors ${isSelected ? 'bg-green-50/50 border-[#016e3f] shadow-sm ring-1 ring-[#016e3f]/20' : 'bg-white border-gray-200 shadow-sm hover:border-gray-300'}`}>
                                            <Link href={`?account_id=${token.business_id}`} className="absolute inset-0 z-0 rounded-xl" title="Klik untuk melihat status sinkronisasi" />
                                            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pointer-events-none">
                                                <div className="flex items-start sm:items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isSelected ? 'bg-[#016e3f] text-white' : 'bg-[#016e3f]/10 text-[#016e3f]'}`}>
                                                        <Store className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-gray-900">{token.account_name || `ID Akun: ${token.business_id}`}</h4>
                                                        {token.account_email && (
                                                            <p className="text-[11px] text-gray-500 mt-0.5">{token.account_email}</p>
                                                        )}
                                                        <div className="flex items-center gap-2 mt-1.5">
                                                            <span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200">
                                                                ID: {token.business_id}
                                                            </span>
                                                            <span className="text-[10px] flex items-center gap-1 font-medium text-[#016e3f] bg-[#016e3f]/10 px-1.5 py-0.5 rounded border border-[#016e3f]/20">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-[#016e3f] animate-pulse"></span>
                                                                Aktif
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <div className="shrink-0 pt-3 sm:pt-0 border-t sm:border-0 border-gray-100 w-full sm:w-auto flex justify-end pointer-events-auto">
                                                    <DisconnectAccountButton 
                                                        businessId={token.business_id} 
                                                        accountName={token.account_name || 'Akun'} 
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )})}
                                </div>
                            </div>

                            {/* Right Column: Sync Status Summary */}
                            <div>
                                <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 text-[#016e3f]" />
                                    {selectedAccountId ? 'Status Sinkronisasi Akun' : 'Status Sinkronisasi Global'}
                                </h3>
                                
                                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                    <p className="text-[11px] text-gray-500 mb-4 pb-3 border-b border-gray-100">
                                        {selectedAccountId 
                                            ? 'Menampilkan waktu sinkronisasi berhasil terakhir untuk akun yang dipilih.'
                                            : 'Menampilkan waktu sinkronisasi berhasil terakhir dari seluruh akun terhubung.'}
                                    </p>
                                    
                                    <div className="divide-y divide-gray-100">
                                        {[
                                            { label: 'Profil & Outlet Toko', date: syncStatus.business },
                                            { label: 'Katalog Moka (Barang & Menu)', date: syncStatus.items },
                                            { label: 'Ringkasan Penjualan', date: syncStatus.sales },
                                            { label: 'Data Transaksi Kasir', date: syncStatus.transactions },
                                            { label: 'Data Pelanggan', date: syncStatus.customers },
                                        ].map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-center py-2.5 first:pt-0 last:pb-0">
                                                <span className="text-[11.5px] font-medium text-gray-700">{item.label}</span>
                                                {item.date ? (
                                                    <span className="text-[10px] font-bold text-[#016e3f] bg-[#016e3f]/10 px-2 py-0.5 rounded border border-[#016e3f]/10">
                                                        {new Date(item.date).toLocaleString('id-ID', {
                                                            day: '2-digit', month: 'short', year: 'numeric',
                                                            hour: '2-digit', minute: '2-digit'
                                                        })}
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded">Belum pernah</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                {selectedAccountId && (
                                    <div className="mt-6">
                                        <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                                            <Store className="w-4 h-4 text-[#016e3f]" />
                                            Daftar Outlet Tersinkronisasi ({mappedOutlets.length})
                                        </h3>
                                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                            {mappedOutlets.length === 0 ? (
                                                <div className="text-center py-4">
                                                    <p className="text-xs text-gray-500 mb-3">Belum ada outlet yang ditarik dari akun Moka ini.</p>
                                                    <p className="text-[10px] text-gray-400">Silakan klik "Sync Master Data" untuk menarik profil dan daftar outlet toko Anda dari Moka.</p>
                                                </div>
                                            ) : (
                                                <div className="divide-y divide-gray-100">
                                                    {mappedOutlets.map((outlet: any) => (
                                                        <div key={outlet.id} className="py-2.5 first:pt-0 last:pb-0">
                                                            <div className="flex justify-between items-start">
                                                                <div>
                                                                    <div className="text-[12px] font-bold text-gray-800">{outlet.name}</div>
                                                                    <div className="text-[10px] text-gray-500 mt-0.5">{outlet.city || outlet.address || '-'}</div>
                                                                </div>
                                                                <span className="text-[9px] font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200">
                                                                    ID: {outlet.id}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
