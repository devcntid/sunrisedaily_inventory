import { query } from "@/lib/db";
import { fetchMokaAPIWithToken } from "@/lib/moka/api";

export async function syncBusinessAndOutlets(token: { access_token: string; refresh_token: string; expires_at?: Date | string; [key: string]: unknown }) {
    try {
        if (!token) throw new Error("No token provided");

        // 1. Fetch businesses
        const bizData = await fetchMokaAPIWithToken(token, '/v1/businesses');
        const businesses = bizData.data?.business ? [bizData.data.business] : [];

        const timestamp = new Date();

        for (const biz of businesses) {
            // Upsert Business
            await query(`
                INSERT INTO moka_business (id, name, address, city, province, postal_code, phone, user_id, synchronized_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    address = EXCLUDED.address,
                    city = EXCLUDED.city,
                    province = EXCLUDED.province,
                    postal_code = EXCLUDED.postal_code,
                    phone = EXCLUDED.phone,
                    user_id = EXCLUDED.user_id,
                    synchronized_at = EXCLUDED.synchronized_at,
                    updated_at = CURRENT_TIMESTAMP
            `, [
                biz.id, biz.name, biz.address, biz.city, biz.province,
                biz.postal_code, biz.phone, biz.user_id, timestamp
            ]);

            // 2. Fetch outlets for this business
            const outletData = await fetchMokaAPIWithToken(token, `/v1/businesses/${biz.id}/outlets`);
            const outlets = outletData.data?.outlets || [];

            for (const out of outlets) {
                // Upsert Outlet directly to the main 'outlets' table
                await query(`
                    INSERT INTO outlets (id, name, type, phone, address, city, state, moka_business_id)
                    VALUES ($1, $2, 'STORE', $3, $4, $5, $6, $7)
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        phone = EXCLUDED.phone,
                        address = EXCLUDED.address,
                        city = EXCLUDED.city,
                        state = EXCLUDED.state,
                        moka_business_id = EXCLUDED.moka_business_id
                `, [
                    out.id, out.name, out.phone_number, out.address, out.city, out.province, biz.id
                ]);
            }
        }

        return { success: true };
    } catch (error: unknown) {
        console.error("Error syncing business:", error);
        return { success: false, message: error instanceof Error ? error.message : String(error) };
    }
}

export async function syncItems(token: { access_token: string; refresh_token: string; expires_at?: Date | string; [key: string]: unknown }) {
    try {
        if (!token) throw new Error("No token provided");

        // Get active outlets specific to this business
        const outRes = await query('SELECT id FROM outlets WHERE moka_business_id = $1', [token.business_id]);
        const outlets = outRes.rows;
        const timestamp = new Date();
        let totalItemsSynced = 0;

        for (const out of outlets) {
            let page = 1;
            let totalPages = 1;

            do {
                const itemData = await fetchMokaAPIWithToken(token, `/v1/outlets/${out.id}/items?page=${page}&per_page=50&include_deleted=false`);
                const items = itemData.data?.items || [];
                totalPages = itemData.data?.total_pages || 1;

                for (const item of items) {
                    const categoryName = item.category?.name || 'Uncategorized';
                    
                    // Upsert item
                    await query(`
                        INSERT INTO moka_items (id, business_id, outlet_id, category_id, category_name, name, is_recipe, is_sales_type_price, synchronized_at)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                        ON CONFLICT (id) DO UPDATE SET
                            name = EXCLUDED.name,
                            category_id = EXCLUDED.category_id,
                            category_name = EXCLUDED.category_name,
                            is_recipe = EXCLUDED.is_recipe,
                            is_sales_type_price = EXCLUDED.is_sales_type_price,
                            synchronized_at = EXCLUDED.synchronized_at,
                            updated_at = CURRENT_TIMESTAMP
                    `, [item.id, item.business_id, item.outlet_id, item.category_id, categoryName, item.name, item.is_recipe, item.is_sales_type_price, timestamp]);

                    // Upsert variants
                    if (item.item_variants && item.item_variants.length > 0) {
                        for (const variant of item.item_variants) {
                            await query(`
                                INSERT INTO moka_item_variants (id, item_id, name, price, cogs, in_stock, track_stock, sku, synchronized_at)
                                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                                ON CONFLICT (id) DO UPDATE SET
                                    name = EXCLUDED.name,
                                    price = EXCLUDED.price,
                                    cogs = EXCLUDED.cogs,
                                    in_stock = EXCLUDED.in_stock,
                                    track_stock = EXCLUDED.track_stock,
                                    sku = EXCLUDED.sku,
                                    synchronized_at = EXCLUDED.synchronized_at,
                                    updated_at = CURRENT_TIMESTAMP
                            `, [variant.id, item.id, variant.name, variant.price, variant.cogs, variant.in_stock, variant.track_stock, variant.sku || null, timestamp]);
                        }
                    }
                    totalItemsSynced++;
                }
                
                page++;
            } while (page <= totalPages);
        }

        return { success: true, count: totalItemsSynced };
    } catch (error: unknown) {
        console.error("Error syncing items:", error);
        return { success: false, message: error instanceof Error ? error.message : String(error) };
    }
}

export async function getSyncStatus(businessId?: number | string | null) {
    try {
        let bizRes, itemRes, salesRes, trxRes, custRes;

        if (businessId) {
            bizRes = await query('SELECT MAX(synchronized_at) as last_sync FROM moka_business WHERE id = $1', [businessId]);
            itemRes = await query('SELECT MAX(synchronized_at) as last_sync FROM moka_items WHERE business_id = $1', [businessId]);
            salesRes = await query('SELECT MAX(sync_date) as last_sync FROM moka_item_sales WHERE business_id = $1', [businessId]);
            trxRes = await query('SELECT MAX(synced_at) as last_sync FROM moka_transactions t');
            custRes = await query('SELECT MAX(synced_at) as last_sync FROM moka_customers WHERE business_id = $1', [businessId]);
        } else {
            bizRes = await query('SELECT MAX(synchronized_at) as last_sync FROM moka_business');
            itemRes = await query('SELECT MAX(synchronized_at) as last_sync FROM moka_items');
            salesRes = await query('SELECT MAX(sync_date) as last_sync FROM moka_item_sales');
            trxRes = await query('SELECT MAX(synced_at) as last_sync FROM moka_transactions');
            custRes = await query('SELECT MAX(synced_at) as last_sync FROM moka_customers');
        }

        return {
            business: bizRes.rows[0]?.last_sync || null,
            items: itemRes.rows[0]?.last_sync || null,
            sales: salesRes.rows[0]?.last_sync || null,
            transactions: trxRes.rows[0]?.last_sync || null,
            customers: custRes.rows[0]?.last_sync || null,
        };
    } catch (error) {
        console.error("Error getting sync status:", error);
        return { business: null, items: null, sales: null, transactions: null, customers: null };
    }
}

export async function getMokaOutlets() {
    try {
        const res = await query('SELECT id, name FROM outlets ORDER BY name ASC');
        return res.rows;
    } catch (error) {
        console.error("Error fetching moka outlets:", error);
        return [];
    }
}

export async function getOutletsByBusinessId(businessId: string | number) {
    try {
        const res = await query(
            'SELECT id, name, type, phone, address, city, state FROM outlets WHERE moka_business_id = $1 ORDER BY name ASC',
            [businessId]
        );
        return res.rows;
    } catch (error) {
        console.error("Error fetching outlets by business id:", error);
        return [];
    }
}
