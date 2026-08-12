import { NextRequest, NextResponse } from "next/server";
import { getSession } from '@/lib/auth';
import { syncCustomers } from "@/lib/queries/moka_customers";
import { getAllActiveMokaTokens } from "@/lib/queries/moka";

export async function POST(req: NextRequest) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN_PUSAT') return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
    try {
        const tokens = await getAllActiveMokaTokens();
        if (!tokens || tokens.length === 0) {
            return NextResponse.json({ message: "No active Moka accounts connected." }, { status: 400 });
        }

        let totalCount = 0;
        const results = await Promise.allSettled(
            tokens.map((token: any) => syncCustomers(token, String(token.business_id)))
        );

        let successful = 0;
        results.forEach(r => {
            if (r.status === 'fulfilled' && r.value.success) {
                successful++;
                if (r.value.count) totalCount += r.value.count;
            }
        });

        const totalAccounts = tokens.length;

        if (successful > 0) {
            return NextResponse.json({ 
                success: true, 
                message: `Successfully synced ${totalCount} customers across ${successful}/${totalAccounts} accounts.`,
                count: totalCount
            });
        } else {
            return NextResponse.json({ message: 'Failed to sync customers for all connected accounts.' }, { status: 500 });
        }

    } catch (error: unknown) {
        console.error("Sync customers API error:", error);
        return NextResponse.json(
            { message: (error instanceof Error ? error.message : 'Unknown error') || "Internal server error" },
            { status: 500 }
        );
    }
}
