import MokaSyncCatalogButton from "@/components/moka/MokaSyncCatalogButton";
import MokaCatalogTableClient from "@/components/moka/MokaCatalogTableClient";
import { getMokaCatalog, getMokaCatalogStats, getOutletsWithBusiness, getRecipesForMapping } from "@/lib/queries/moka_catalog";

export default async function MokaCatalogPage(props: { searchParams: Promise<{ page?: string, outlet_id?: string, search?: string, status?: string }> }) {
    const searchParams = await props.searchParams;
    const page = parseInt(searchParams?.page || '1', 10);
    const outletId = searchParams?.outlet_id || '';
    const search = searchParams?.search || '';
    const status = searchParams?.status || 'all';
    
    const catalog = await getMokaCatalog(outletId, search, status);
    const stats = await getMokaCatalogStats(outletId);
    const outletsGrouped = await getOutletsWithBusiness();
    const allRecipes = await getRecipesForMapping();

    // Map variant level items
    const allItems = catalog.map(row => {
        let displayName = row.item_name;
        if (row.variant_name && row.variant_name.toLowerCase() !== 'regular') {
             displayName = `${row.item_name} — ${row.variant_name}`;
        }
        return {
            id: row.variant_id, // Primary ID for variant mapping
            moka_item_id: row.item_id,
            name: displayName,
            category: row.category_name,
            outlet_name: row.outlet_name,
            price: row.price,
            in_stock: row.in_stock,
            internal_recipe_id: row.internal_recipe_id,
            mapped_recipe_name: row.mapped_recipe_name,
            ingredient_count: row.ingredient_count || 0,
        };
    });
    const totalItems = allItems.length;
    const ITEMS_PER_PAGE = 20;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    const safePage = Math.max(1, Math.min(page, totalPages || 1));

    const startIndex = (safePage - 1) * ITEMS_PER_PAGE;
    const items = allItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const buildQueryString = (pageOverride?: number) => {
        const params = new URLSearchParams();
        if (pageOverride && pageOverride > 1) params.set('page', pageOverride.toString());
        if (outletId) params.set('outlet_id', outletId);
        if (search) params.set('search', search);
        if (status && status !== 'all') params.set('status', status);
        const qs = params.toString();
        return qs ? `?${qs}` : '';
    };

    return (
        <section className="screen">
            <MokaCatalogTableClient 
                items={items} 
                recipes={allRecipes} 
                stats={stats}
                totalCount={totalItems}
                outletsGrouped={outletsGrouped as any} 
                activeOutletId={outletId}
                activeSearch={search}
                activeStatus={status} 
                currentPage={safePage}
                totalPages={totalPages}
                syncButton={<MokaSyncCatalogButton />}
            />
        </section>
    );
}
