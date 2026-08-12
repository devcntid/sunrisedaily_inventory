import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { syncBusinessAndOutlets } from '@/lib/queries/moka_sync';
import { getAllActiveMokaTokens } from '@/lib/queries/moka';

export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN_PUSAT') return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
    try {
        const tokens = await getAllActiveMokaTokens();
        if (!tokens || tokens.length === 0) {
            return NextResponse.json({ success: false, message: 'No active Moka accounts connected.' }, { status: 400 });
        }

        const results = await Promise.allSettled(
            tokens.map((token: any) => syncBusinessAndOutlets(token))
        );

        const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
        const total = tokens.length;

        if (successful > 0) {
            return NextResponse.json({ success: true, message: `Business and outlets synchronized successfully for ${successful}/${total} accounts.` });
        } else {
            return NextResponse.json({ success: false, message: 'Failed to sync business for all connected accounts.' }, { status: 500 });
        }
    } catch (error: unknown) {
        return NextResponse.json({ success: false, message: (error instanceof Error ? error.message : 'Unknown error') || 'Internal server error' }, { status: 500 });
    }
}
