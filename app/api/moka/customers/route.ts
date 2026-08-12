import { NextResponse } from "next/server";
import { getSession } from '@/lib/auth';
import { getCustomers } from "@/lib/queries/moka_customers";

export async function GET(req: Request) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN_PUSAT') return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
    try {
        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const search = searchParams.get('search') || '';
        const sort = searchParams.get('sort') || 'newest';
        const hasEmail = searchParams.get('hasEmail') || 'all';
        const outletId = searchParams.get('outlet_id') || '';
        
        const offset = (page - 1) * limit;

        const result = await getCustomers(page, limit, search, sort, hasEmail, outletId);

        return NextResponse.json({
            success: true,
            data: result.data,
            total: result.total,
            page,
            limit
        });

    } catch (error: unknown) {
        console.error("Error fetching customers:", error);
        return NextResponse.json({ success: false, message: (error instanceof Error ? error.message : 'Unknown error') }, { status: 500 });
    }
}
