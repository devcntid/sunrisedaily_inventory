import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { syncItems } from '@/lib/queries/moka_sync';
import { getAllActiveMokaTokens } from '@/lib/queries/moka';

export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN_PUSAT') return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
    try {
        const tokens = await getAllActiveMokaTokens();
        if (!tokens || tokens.length === 0) {
            return NextResponse.json({ success: false, message: 'No active Moka accounts connected.' }, { status: 400 });
        }

        let totalItems = 0;
        const results = await Promise.allSettled(
            tokens.map((token: any) => syncItems(token))
        );

        let successful = 0;
        results.forEach(r => {
            if (r.status === 'fulfilled' && r.value.success) {
                successful++;
                if (r.value.count) totalItems += r.value.count;
            }
        });

        const total = tokens.length;

        if (successful > 0) {
            return NextResponse.json({ success: true, message: `Successfully synced ${totalItems} items across ${successful}/${total} Moka accounts` });
        } else {
            return NextResponse.json({ success: false, message: 'Failed to sync items for all connected accounts.' }, { status: 500 });
        }
    } catch (error: unknown) {
        return NextResponse.json({ success: false, message: (error instanceof Error ? error.message : 'Unknown error') || 'Internal server error' }, { status: 500 });
    }
}
