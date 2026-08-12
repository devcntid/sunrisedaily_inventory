import { NextRequest, NextResponse } from "next/server";
import { getSession } from '@/lib/auth';
import { mapMokaItemVariant } from "@/lib/queries/moka_items";

export async function POST(req: NextRequest) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN_PUSAT') return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
    try {
        const body = await req.json();
        const { moka_variant_id, internal_recipe_id } = body;

        if (!moka_variant_id) {
            return NextResponse.json({ message: "moka_variant_id is required" }, { status: 400 });
        }

        // internal_recipe_id can be null to remove the mapping
        
        await mapMokaItemVariant(moka_variant_id, internal_recipe_id);

        return NextResponse.json({ 
            success: true, 
            message: "Item mapping saved successfully." 
        });

    } catch (error: unknown) {
        console.error("Error mapping Moka item:", error);
        return NextResponse.json(
            { message: (error instanceof Error ? error.message : 'Unknown error') || "Internal server error" },
            { status: 500 }
        );
    }
}
