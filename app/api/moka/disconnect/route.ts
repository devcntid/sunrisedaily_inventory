import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { deactivateMokaAccount } from '@/lib/queries/moka';

export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN_PUSAT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    try {
        const body = await request.json();
        const { business_id } = body;

        if (!business_id) {
            return NextResponse.json({ error: 'business_id is required' }, { status: 400 });
        }

        const success = await deactivateMokaAccount(Number(business_id));
        
        if (success) {
            return NextResponse.json({ success: true, message: `Account ${business_id} deactivated successfully` });
        } else {
            return NextResponse.json({ error: 'Failed to disconnect account from database' }, { status: 500 });
        }
    } catch (error) {
        console.error("Disconnect error:", error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
