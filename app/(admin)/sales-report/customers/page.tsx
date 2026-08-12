import { Suspense } from 'react';
import CustomerTableClient from '@/components/moka/CustomerTableClient';
import { getOutletsWithBusiness } from '@/lib/queries/master';

export default async function CustomersPage(props: { searchParams: Promise<{ outlet_id?: string }> }) {
    const searchParams = await props.searchParams;
    const outletId = searchParams?.outlet_id || '';
    const outletsGrouped = await getOutletsWithBusiness();

    return (
        <section className="screen">
            <Suspense fallback={<div className="h-64 flex items-center justify-center">Memuat data...</div>}>
                <CustomerTableClient outletsGrouped={outletsGrouped} activeOutletId={outletId} />
            </Suspense>
        </section>
    );
}
