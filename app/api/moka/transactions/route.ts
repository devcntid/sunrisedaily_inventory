import { NextRequest, NextResponse } from "next/server";
import { getSession } from '@/lib/auth';
import { getTransactions } from "@/lib/queries/moka_transactions";

export async function GET(req: NextRequest) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN_PUSAT') return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    try {
        const { searchParams } = new URL(req.url);
        const outlet_id = searchParams.get("outlet_id");
        const start_date = searchParams.get("start_date");
        const end_date = searchParams.get("end_date");
        const search = searchParams.get("search");
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "20");

        const result = await getTransactions(outlet_id, start_date, end_date, search, page, limit);

        return NextResponse.json({
            data: result.data,
            total: result.total,
            summary: result.summary,
            page,
            limit
        });

    } catch (error: unknown) {
        console.error("Error fetching transactions:", error);
        return NextResponse.json(
            { message: (error instanceof Error ? error.message : 'Unknown error') || "Internal server error" },
            { status: 500 }
        );
    }
}
