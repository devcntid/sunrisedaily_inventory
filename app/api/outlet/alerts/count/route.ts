import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getOutletStocks } from '@/lib/queries/outlet-inventory';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || !session.outletId) {
      return NextResponse.json({ count: 0 });
    }

    const stocks = await getOutletStocks(session.outletId);
    // Count items where stock is less than or equal to minimum threshold
    const count = stocks.filter(s => 
      s.minimum_threshold !== null && 
      Number(s.current_balance) <= Number(s.minimum_threshold)
    ).length;

    return NextResponse.json({ count });
  } catch (error) {
    console.error('Error fetching outlet alerts count:', error);
    return NextResponse.json({ count: 0 });
  }
}
