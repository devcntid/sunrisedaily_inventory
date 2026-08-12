import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { 
  getOutletMonitoringData, 
  getOutletConsumptionSinceLastRestock,
  type OutletConsumptionSummary
} from '@/lib/queries/outlet-monitoring';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }
  try {
    const data = await getOutletMonitoringData();

    // Hitung juga ringkasan konsumsi pasca-pengadaan untuk semua outlet
    const consumptionEntries = await Promise.all(
      data.outlets.map(async (o) => {
        const summary = await getOutletConsumptionSinceLastRestock(o.id);
        return [o.id, summary] as const;
      })
    );

    const consumptionMap: Record<number, OutletConsumptionSummary> = {};
    for (const [outletId, summary] of consumptionEntries) {
      consumptionMap[outletId] = summary;
    }

    return NextResponse.json({
      success: true,
      data: {
        ...data,
        consumptionMap
      }
    });
  } catch (error: unknown) {
    console.error('Error fetching outlet monitoring:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

