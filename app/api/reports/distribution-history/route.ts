import { NextResponse } from 'next/server';
import { getDistributionHistory } from '@/lib/queries/distribution-history';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    if (!startDate || !endDate) {
      return NextResponse.json({ success: false, message: 'start_date and end_date are required' }, { status: 400 });
    }

    const data = await getDistributionHistory(startDate, endDate);
    
    // Group by outlet
    const groupedData: Record<number, any> = {};
    
    data.forEach(dn => {
      if (!groupedData[dn.outlet_id]) {
        groupedData[dn.outlet_id] = {
          outlet_id: dn.outlet_id,
          outlet_name: dn.outlet_name,
          total_value: 0,
          total_qty: 0,
          last_delivery_date: null as string | null,
          delivery_orders: []
        };
      }
      
      if (dn.delivery_note_id) {
        groupedData[dn.outlet_id].total_value += dn.total_value;
        groupedData[dn.outlet_id].total_qty += dn.total_qty;
        
        const dnDate = new Date(dn.delivery_date);
        const currentDate = groupedData[dn.outlet_id].last_delivery_date ? new Date(groupedData[dn.outlet_id].last_delivery_date) : null;
        if (!currentDate || dnDate > currentDate) {
          groupedData[dn.outlet_id].last_delivery_date = dn.delivery_date;
        }

        groupedData[dn.outlet_id].delivery_orders.push({
          id: dn.delivery_note_id,
          number: dn.delivery_note_number,
          date: dn.delivery_date,
          value: dn.total_value,
          qty: dn.total_qty
        });
      }
    });

    return NextResponse.json({
      success: true,
      data: Object.values(groupedData)
    });
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json({ success: false, message: (err instanceof Error ? err.message : 'Unknown error') }, { status: 500 });
  }
}
