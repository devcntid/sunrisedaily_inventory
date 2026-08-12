import { NextRequest, NextResponse } from "next/server";
import { getSession } from '@/lib/auth';
import { getTransactionItems } from "@/lib/queries/moka_transactions";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN_PUSAT') return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    try {
        const { id } = await context.params;

        const items = await getTransactionItems(id);

        return NextResponse.json({
            data: items
        });

    } catch (error: unknown) {
        console.error("Error fetching transaction items:", error);
        return NextResponse.json(
            { message: (error instanceof Error ? error.message : 'Unknown error') || "Internal server error" },
            { status: 500 }
        );
    }
}
