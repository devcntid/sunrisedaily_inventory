import SalesReportClient from '@/components/moka/SalesReportClient';
import { getSyncStatus } from '@/lib/queries/moka_sync';
import { getOutlets } from '@/lib/queries/master';
import { getMokaItemSalesReport } from '@/lib/queries/moka_sales';

export default async function SalesReportPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
    const resolvedSearchParams = await searchParams;
    // Determine filters
    const outletId = typeof resolvedSearchParams.outletId === 'string' ? resolvedSearchParams.outletId : '';
    let startDate = typeof resolvedSearchParams.startDate === 'string' ? resolvedSearchParams.startDate : '';
    let endDate = typeof resolvedSearchParams.endDate === 'string' ? resolvedSearchParams.endDate : '';

    if (!startDate || !endDate) {
        const d = new Date();
        endDate = d.toISOString().split('T')[0];
        d.setDate(d.getDate() - 7);
        startDate = d.toISOString().split('T')[0];
    }

    // Fetch available outlets
    const outletsRaw = await getOutlets();
    const outlets = outletsRaw.map(r => ({ id: String(r.id), name: String(r.name) }));

    const syncStatus = await getSyncStatus();

    // Fetch sales data based on filters
    const salesData = await getMokaItemSalesReport(startDate, endDate, outletId);

    return (
        <section className="screen">
            <SalesReportClient 
                outlets={outlets} 
                lastSync={syncStatus.sales} 
                initialSalesData={salesData} 
                initialStartDate={startDate}
                initialEndDate={endDate}
                initialOutletId={outletId}
            />
        </section>
    );
}
