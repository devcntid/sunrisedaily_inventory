import { NextRequest, NextResponse } from 'next/server';
import { getSalesEstimationData } from '@/lib/queries/sales-transactions';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !session.outletId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  const outletId = session.outletId;

  try {
    const { mokaItems, ingredients, stockMap } = await getSalesEstimationData(outletId);

    if (mokaItems.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // 4. Calculate estimation per Moka Item
    const results = mokaItems.map(mi => {
      const recipeIngredients = ingredients.filter(i => i.recipe_id === mi.internal_recipe_id);
      
      let maxPortions = Infinity;
      
      if (recipeIngredients.length === 0) {
        maxPortions = 0;
      } else {
        for (const ing of recipeIngredients) {
          if (!ing.item_id) {
            maxPortions = 0;
            break;
          }
          const stock = Math.max(0, stockMap[Number(ing.item_id)] || 0);
          const needed = Number(ing.quantity);
          if (needed > 0) {
            const portions = Math.max(0, Math.floor(stock / needed));
            if (portions < maxPortions) {
              maxPortions = portions;
            }
          }
        }
      }

      const breakdown = recipeIngredients.map(ing => {
        const stock = Math.max(0, stockMap[Number(ing.item_id)] || 0);
        const needed = Number(ing.quantity);
        return {
          ingredient_name: ing.ingredient_name || 'Unknown',
          needed_per_portion: needed,
          current_stock: stock,
          unit: ing.smallest_unit || '',
          estimated_portions: needed > 0 ? Math.floor(stock / needed) : 0
        };
      });

      return {
        moka_item_id: mi.moka_item_id,
        name: mi.moka_item_name,
        estimated_portions: maxPortions,
        has_ingredients: recipeIngredients.length > 0,
        unit: mi.yield_unit || 'Pcs',
        breakdown
      };
    });

    // Sort by estimated_portions ASC, then name
    results.sort((a, b) => {
      if (a.estimated_portions !== b.estimated_portions) {
        return a.estimated_portions - b.estimated_portions;
      }
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ success: true, data: results });
  } catch (error: unknown) {
    console.error('Error in sales estimation:', error);
    return NextResponse.json({ success: false, message: (error instanceof Error ? error.message : 'Unknown error') }, { status: 500 });
  }
}
