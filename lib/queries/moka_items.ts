import { query } from "@/lib/db";

export async function mapMokaItemVariant(mokaVariantId: number, internalRecipeId: number | null) {
    await query(`
        UPDATE moka_item_variants 
        SET internal_recipe_id = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
    `, [internalRecipeId, mokaVariantId]);
}
