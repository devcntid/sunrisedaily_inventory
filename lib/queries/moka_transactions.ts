import { query } from "@/lib/db";
import { fetchMokaAPIWithToken } from "@/lib/moka/api";

export async function syncTransactions(token: { access_token: string; refresh_token: string; expires_at?: Date | string; [key: string]: unknown }, sinceEpoch: number, untilEpoch: number, outletId?: string) {
    try {
        if (!token) throw new Error("No token provided");

        let outlets: { id: string | number }[] = [];
        if (outletId) {
            const outRes = await query('SELECT id FROM outlets WHERE id = $1', [outletId]);
            outlets = outRes.rows as { id: string | number }[];
        } else {
            const outRes = await query('SELECT id FROM outlets WHERE moka_business_id = $1', [token.business_id]);
            outlets = outRes.rows as { id: string | number }[];
        }

        let totalTrxSynced = 0;
        let totalItemsSynced = 0;
        const timestamp = new Date();

        for (const out of outlets) {
            // PRD Section 8.5: Endpoint for transaction details with Unix epoch params
            let currentUrl: string | null = `/v4/outlets/${out.id}/reports/get_latest_transactions?per_page=50&since=${sinceEpoch}&until=${untilEpoch}&time_filter=created_at&include_promo=true&reorder_type=DESC`;

            while (currentUrl) {
                const resp = await fetchMokaAPIWithToken(token, currentUrl);
                // PRD Section 8.5: Moka response shape: { data: { payments: [...], completed: bool, next_url: string|null }, meta: {...} }
                const innerData = resp.data || {};
                const payments: any[] = innerData.payments || [];

                for (const payment of payments) {
                    // Upsert transaction header
                    await query(`
                        INSERT INTO moka_transactions (
                            id, outlet_id, payment_no, payment_type, payment_type_label, 
                            total_collected, subtotal, discounts, gratuities, taxes, 
                            tendered, change_amount, transaction_date, transaction_time, 
                            collected_by, served_by, order_id, outlet_name, is_refunded, 
                            total_refund, guid, created_at, updated_at, synced_at
                        ) VALUES (
                            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 
                            $16, $17, $18, $19, $20, $21, $22, $23, $24
                        )
                        ON CONFLICT (id) DO UPDATE SET
                            payment_no = EXCLUDED.payment_no,
                            total_collected = EXCLUDED.total_collected,
                            is_refunded = EXCLUDED.is_refunded,
                            total_refund = EXCLUDED.total_refund,
                            updated_at = EXCLUDED.updated_at,
                            synced_at = EXCLUDED.synced_at
                    `, [
                        payment.id,
                        out.id,
                        payment.payment_no,
                        payment.payment_type,
                        payment.payment_type_label,
                        payment.total_collected || 0,
                        payment.subtotal || 0,
                        payment.discounts || 0,
                        payment.gratuities || 0,
                        payment.taxes || 0,
                        payment.tendered || 0,
                        payment.change || 0,         // PRD field: payment.change
                        payment.transaction_date,
                        payment.transaction_time,
                        payment.collected_by,
                        payment.served_by,
                        payment.order_id,
                        payment.outlet_name,
                        payment.is_refunded || false,
                        payment.total_refund || 0,
                        payment.guid,
                        payment.created_at,          // PRD: data.payments[].created_at (TIMESTAMPTZ)
                        payment.updated_at,
                        timestamp
                    ]);
                    totalTrxSynced++;

                    // Upsert checkout items (PRD Section 8.5.2)
                    if (payment.checkouts && payment.checkouts.length > 0) {
                        for (const item of payment.checkouts) {
                            await query(`
                                INSERT INTO moka_transaction_items (
                                    uuid, transaction_id, item_id, item_name, item_variant_id, 
                                    item_variant_name, category_name, sales_type_name, 
                                    quantity, price, gross_sales, net_sales, cogs, sku, 
                                    is_recipe, refunded_quantity
                                ) VALUES (
                                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
                                )
                                ON CONFLICT (uuid) DO UPDATE SET
                                    quantity = EXCLUDED.quantity,
                                    gross_sales = EXCLUDED.gross_sales,
                                    net_sales = EXCLUDED.net_sales
                            `, [
                                item.uuid,           // PRD: checkouts[].uuid (primary key)
                                payment.id,
                                item.item_id,
                                item.item_name,
                                item.item_variant_id,
                                item.item_variant_name,
                                item.category_name,
                                item.sales_type_name,
                                item.quantity || 1,
                                item.price || 0,
                                item.gross_sales || 0,
                                item.net_sales || 0,
                                item.cogs || 0,
                                item.sku || '',
                                item.is_recipe || false,
                                item.refunded_quantity || 0
                            ]);
                            totalItemsSynced++;
                        }
                    }
                }

                // PRD Section 9.2: continue pagination if completed === false and next_url exists
                if (innerData.completed === false && innerData.next_url) {
                    currentUrl = innerData.next_url; // full absolute URL from Moka
                } else {
                    currentUrl = null;
                }
            }
        }

        return { success: true, count: totalTrxSynced, items_count: totalItemsSynced };
    } catch (error: unknown) {
        console.error("Error syncing transactions:", error);
        return { success: false, message: error instanceof Error ? error.message : String(error) };
    }
}

export async function getTransactionItems(transactionId: string) {
    const res = await query(`
        SELECT * FROM moka_transaction_items
        WHERE transaction_id = $1
        ORDER BY uuid ASC
    `, [transactionId]);
    return res.rows;
}

export async function getTransactions(
    outletId: string | null,
    startDate: string | null,
    endDate: string | null,
    search: string | null,
    page: number,
    limit: number
) {
    const offset = (page - 1) * limit;

    let queryStr = `
        SELECT t.*, o.name as outlet_name 
        FROM moka_transactions t
        LEFT JOIN outlets o ON t.outlet_id = o.id
        WHERE 1=1
    `;
    let summaryQueryStr = `
        SELECT 
            COALESCE(SUM(t.total_collected), 0) AS total_revenue,
            COUNT(t.id) AS total_count,
            COALESCE(SUM(CASE WHEN t.is_refunded = true THEN 1 ELSE 0 END), 0) AS total_refunded,
            COALESCE(SUM(CASE WHEN LOWER(t.payment_type) LIKE '%cash%' OR LOWER(t.payment_type_label) LIKE '%cash%' THEN 1 ELSE 0 END), 0) AS cash_count
        FROM moka_transactions t
        LEFT JOIN outlets o ON t.outlet_id = o.id
        WHERE 1=1
    `;
    
    const params: unknown[] = [];
    let paramCount = 1;

    if (outletId) {
        queryStr += ` AND t.outlet_id = $${paramCount}`;
        summaryQueryStr += ` AND t.outlet_id = $${paramCount}`;
        params.push(outletId);
        paramCount++;
    }

    if (startDate && endDate) {
        queryStr += ` AND t.created_at >= $${paramCount} AND t.created_at < ($${paramCount + 1}::date + interval '1 day')`;
        summaryQueryStr += ` AND t.created_at >= $${paramCount} AND t.created_at < ($${paramCount + 1}::date + interval '1 day')`;
        params.push(startDate);
        params.push(endDate);
        paramCount += 2;
    }

    if (search) {
        queryStr += ` AND (t.payment_no ILIKE $${paramCount} OR t.collected_by ILIKE $${paramCount})`;
        summaryQueryStr += ` AND (t.payment_no ILIKE $${paramCount} OR t.collected_by ILIKE $${paramCount})`;
        params.push(`%${search}%`);
        paramCount++;
    }

    queryStr += ` ORDER BY t.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    const queryParams = [...params, limit, offset];

    const [dataRes, summaryRes] = await Promise.all([
        query(queryStr, queryParams),
        query(summaryQueryStr, params)
    ]);

    const summary = summaryRes.rows[0] || {};

    return {
        data: dataRes.rows,
        total: parseInt(summary.total_count || '0'),
        summary: {
            totalRevenue: parseFloat(summary.total_revenue || '0'),
            totalCount: parseInt(summary.total_count || '0'),
            totalRefunded: parseInt(summary.total_refunded || '0'),
            cashCount: parseInt(summary.cash_count || '0')
        }
    };
}

export async function getLastSyncTime(outletId: number) {
    const syncRes = await query(`SELECT MAX(created_at) as last_sync FROM moka_transactions WHERE outlet_id = $1`, [outletId]);
    return syncRes.rows[0]?.last_sync || null;
}

