import { query } from "@/lib/db";
import { fetchMokaAPIWithToken } from "@/lib/moka/api";

export async function syncCustomers(token: { access_token: string; refresh_token: string; expires_at?: Date | string; [key: string]: unknown }, businessId: string) {
    try {
        if (!token) throw new Error("No token provided");
        let totalCustSynced = 0;
        const timestamp = new Date();

        let currentUrl: string | null = `/v1/businesses/${businessId}/customers`;

        while (currentUrl) {
            const data = await fetchMokaAPIWithToken(token, currentUrl);
            const customers = data.data?.customers || [];

            for (const cust of customers) {
                // Upsert Customer
                await query(`
                    INSERT INTO moka_customers (
                        id, business_id, outlet_id, name, email, phone, 
                        address, city, state, postal_code, birthday, 
                        sex, guid, uniq_id, is_deleted, moka_created_at, 
                        moka_updated_at, synchronized_at, synced_at
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 
                        $12, $13, $14, $15, $16, $17, $18, $19
                    )
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        email = EXCLUDED.email,
                        phone = EXCLUDED.phone,
                        address = EXCLUDED.address,
                        city = EXCLUDED.city,
                        state = EXCLUDED.state,
                        postal_code = EXCLUDED.postal_code,
                        birthday = EXCLUDED.birthday,
                        sex = EXCLUDED.sex,
                        is_deleted = EXCLUDED.is_deleted,
                        moka_updated_at = EXCLUDED.moka_updated_at,
                        synchronized_at = EXCLUDED.synchronized_at,
                        synced_at = EXCLUDED.synced_at
                `, [
                    cust.id,
                    cust.business_id,
                    cust.outlet_id || null,
                    cust.name,
                    cust.email,
                    cust.phone,
                    cust.address,
                    cust.city,
                    cust.state,
                    cust.postal_code,
                    cust.birthday,
                    cust.sex,
                    cust.guid,
                    cust.uniq_id,
                    cust.is_deleted || false,
                    cust.created_at,
                    cust.updated_at,
                    cust.synchronized_at,
                    timestamp
                ]);
                totalCustSynced++;
            }

            if (data.data?.completed === false && data.data?.next_url) {
                currentUrl = data.data.next_url;
            } else {
                currentUrl = null; // Finished
            }
        }

        return { success: true, count: totalCustSynced };
    } catch (error: unknown) {
        console.error("Error syncing customers:", error);
        return { success: false, message: error instanceof Error ? error.message : String(error) };
    }
}

export async function getCustomers(page: number, limit: number, search: string, sort: string, hasEmail: string, outletId: string) {
    const offset = (page - 1) * limit;

    let queryStr = `
        SELECT 
            id, name, email, phone, address, city, state, postal_code, sex, birthday, moka_created_at
        FROM moka_customers
        WHERE is_deleted = false
    `;

    let countQueryStr = `
        SELECT COUNT(*) as total
        FROM moka_customers
        WHERE is_deleted = false
    `;

    const params: unknown[] = [];
    let paramCount = 1;

    if (outletId) {
        queryStr += ` AND outlet_id = $${paramCount}`;
        countQueryStr += ` AND outlet_id = $${paramCount}`;
        params.push(outletId);
        paramCount++;
    }

    if (search) {
        queryStr += ` AND (name ILIKE $${paramCount} OR phone ILIKE $${paramCount})`;
        countQueryStr += ` AND (name ILIKE $${paramCount} OR phone ILIKE $${paramCount})`;
        params.push(`%${search}%`);
        paramCount++;
    }

    if (hasEmail === 'with') {
        queryStr += ` AND email IS NOT NULL AND email != ''`;
        countQueryStr += ` AND email IS NOT NULL AND email != ''`;
    } else if (hasEmail === 'without') {
        queryStr += ` AND (email IS NULL OR email = '')`;
        countQueryStr += ` AND (email IS NULL OR email = '')`;
    }

    let orderBy = 'moka_created_at DESC NULLS LAST';
    if (sort === 'oldest') orderBy = 'moka_created_at ASC NULLS LAST';
    if (sort === 'name_asc') orderBy = 'name ASC NULLS LAST';
    if (sort === 'name_desc') orderBy = 'name DESC NULLS LAST';

    queryStr += ` ORDER BY ${orderBy} LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    const queryParams = [...params, limit, offset];

    const [dataRes, countRes] = await Promise.all([
        query(queryStr, queryParams),
        query(countQueryStr, params)
    ]);

    return {
        data: dataRes.rows,
        total: parseInt(countRes.rows[0].total)
    };
}
