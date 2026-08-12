import { Suspense } from 'react';
import TransactionTableClient from '@/components/moka/TransactionTableClient';

import { getOutlets } from '@/lib/queries/master';

export default async function TransactionsPage() {
    const outletsRaw = await getOutlets();
    const outlets = outletsRaw.map(o => ({ id: String(o.id), name: o.name }));

    return (
        <section className="screen">


            <Suspense fallback={<div className="h-64 flex items-center justify-center">Loading...</div>}>
                <TransactionTableClient outlets={outlets} />
            </Suspense>
        </section>
    );
}
